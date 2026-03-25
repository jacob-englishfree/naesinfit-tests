#!/usr/bin/env python3
"""
deep-fix.py — Scan ALL HTML files under 모의고사/ and 부교재/수능특강/
Fix 6 categories of issues from deep audit.
"""

import os, re, sys
from pathlib import Path

BASE = Path("/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests")
DIRS = [BASE / "모의고사", BASE / "부교재" / "수능특강"]

fixed = {
    "1_title_typo": 0,
    "2_morph_parens": 0,
    "3_stem_range": 0,
    "4_ans_mismatch": [],
    "5_duplicate": [],
    "6_fmt_stem": 0,
    "7_explanation": 0,
}

scanned = 0
modified_files = set()


def find_field(block, field):
    """Find field value handling ', ", and ` quotes."""
    # Try single quotes
    m = re.search(rf"{field}:\s*'((?:[^'\\]|\\.)*)'", block)
    if m:
        return m.group(1), m.group(0), "'"
    # Try double quotes
    m = re.search(rf'{field}:\s*"((?:[^"\\]|\\.)*)"', block)
    if m:
        return m.group(1), m.group(0), '"'
    # Try backticks
    m = re.search(rf'{field}:\s*`((?:[^`\\]|\\.)*)`', block)
    if m:
        return m.group(1), m.group(0), '`'
    return None, None, None


def find_html_files():
    files = []
    for d in DIRS:
        if d.exists():
            for root, _, fnames in os.walk(d):
                for f in fnames:
                    if f.endswith(".html"):
                        files.append(os.path.join(root, f))
    return sorted(files)


def split_q_blocks(content):
    """Split content into question blocks by {id:N pattern."""
    pattern = r'\{id:\s*\d+'
    matches = list(re.finditer(pattern, content))
    blocks = []
    for i, m in enumerate(matches):
        start = m.start()
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            # Find closing of this object
            depth = 0
            end = start
            for j in range(start, min(start + 10000, len(content))):
                if content[j] == '{':
                    depth += 1
                elif content[j] == '}':
                    depth -= 1
                    if depth == 0:
                        end = j + 1
                        break
        blocks.append((start, end, content[start:end]))
    return blocks


def fix_title_typo(content, filepath):
    """Fix 1: Replace '번번' with '번'."""
    n = content.count('번번')
    if n > 0:
        content = content.replace('번번', '번')
    return content, n


def fix_morph_parens(content, filepath):
    """Fix 2: Add base form parentheses for 어형변환 questions."""
    count = 0
    # Re-split each time since content changes
    for _ in range(30):
        found = False
        blocks = split_q_blocks(content)
        for start, end, block in blocks:
            qtype, _, _ = find_field(block, 'type')
            if not qtype or '어형' not in qtype:
                continue
            if '__________' not in block or '__________ (' in block:
                continue

            wa, _, _ = find_field(block, 'wa')
            if not wa:
                continue

            base_form = None
            for fld in ['tip', 'analysis']:
                text, _, _ = find_field(block, fld)
                if text:
                    arrow_m = re.search(r'(\w+)\s*[→→]\s*' + re.escape(wa), text)
                    if arrow_m:
                        base_form = arrow_m.group(1)
                        break

            if base_form:
                new_block = block.replace('__________', f'__________ ({base_form})', 1)
                content = content[:start] + new_block + content[end:]
                count += 1
                found = True
                break
        if not found:
            break

    return content, count


def fix_stem_range(content, filepath):
    """Fix 3: Fix stem range mismatch."""
    count = 0
    for _ in range(30):
        found = False
        blocks = split_q_blocks(content)
        for start, end, block in blocks:
            stem, _, _ = find_field(block, 'stem')
            if not stem:
                continue
            ch_m = re.search(r"ch:\s*\[([^\]]*)\]", block)
            if not ch_m:
                continue
            ch_items = re.findall(r"['\"`][^'\"`]*['\"`]", ch_m.group(1))
            if len(ch_items) == 5:
                for old, new in [('①~③', '①~⑤'), ('①~④', '①~⑤')]:
                    if old in block:
                        new_block = block.replace(old, new, 1)
                        content = content[:start] + new_block + content[end:]
                        count += 1
                        found = True
                        break
            if found:
                break
        if not found:
            break
    return content, count


def check_ans_mismatch(content, filepath):
    """Fix 4: Log answer-analysis mismatches. DO NOT auto-fix."""
    issues = []
    circled = '①②③④⑤'
    blocks = split_q_blocks(content)

    for start, end, block in blocks:
        id_m = re.search(r'id:\s*(\d+)', block)
        ans_m = re.search(r'ans:\s*(\d+)', block)
        analysis, _, _ = find_field(block, 'analysis')
        stem, _, _ = find_field(block, 'stem')

        if not id_m or not ans_m or not analysis or not stem:
            continue

        qid = id_m.group(1)
        ans = int(ans_m.group(1))
        is_negative = '않은' in stem or '않는' in stem

        correct_markers = re.findall(r'✅\s*([①②③④⑤])', analysis)
        wrong_markers = re.findall(r'❌\s*([①②③④⑤])', analysis)

        expected = circled[ans] if ans < 5 else None
        if not expected:
            continue

        if is_negative and wrong_markers:
            if expected not in wrong_markers:
                issues.append({
                    'file': filepath, 'qid': qid, 'current_ans': ans,
                    'analysis_says': f"❌={wrong_markers}", 'type': 'negative_q_mismatch'
                })
        elif not is_negative and correct_markers and not wrong_markers:
            if expected not in correct_markers:
                issues.append({
                    'file': filepath, 'qid': qid, 'current_ans': ans,
                    'analysis_says': f"✅={correct_markers}", 'type': 'positive_q_mismatch'
                })

    return issues


def detect_duplicates(content, filepath):
    """Fix 5: Detect duplicate questions. Just log."""
    dupes = []
    seen = {}
    blocks = split_q_blocks(content)

    for start, end, block in blocks:
        id_m = re.search(r'id:\s*(\d+)', block)
        qtype, _, _ = find_field(block, 'type')
        stem, _, _ = find_field(block, 'stem')

        if not id_m or not qtype or not stem:
            continue

        qid = id_m.group(1)
        key = (qtype, stem[:80])
        if key in seen:
            dupes.append({
                'file': filepath, 'qid': qid, 'duplicate_of': seen[key],
                'type': qtype, 'stem_preview': stem[:60]
            })
        else:
            seen[key] = qid

    return dupes


def fix_fmt_stem(content, filepath):
    """Fix 6: Fix fmt-stem mismatches."""
    count = 0
    written_keywords = ['쓰시오', '쓰세요', '하시오']

    for _ in range(60):
        found = False
        blocks = split_q_blocks(content)

        for start, end, block in blocks:
            stem, _, _ = find_field(block, 'stem')
            fmt_val, fmt_full, fmt_q = find_field(block, 'fmt')

            if not stem or not fmt_val:
                continue

            has_written_kw = any(kw in stem for kw in written_keywords)

            if has_written_kw and fmt_val == 'mc':
                ans_m = re.search(r'ans:\s*(\d+)', block)
                ch_m = re.search(r"ch:\s*\[([^\]]*)\]", block)
                wa_existing, _, _ = find_field(block, 'wa')

                new_block = block
                new_fmt = fmt_full.replace(f'{fmt_q}mc{fmt_q}', f'{fmt_q}written{fmt_q}')
                new_block = new_block.replace(fmt_full, new_fmt, 1)

                if not wa_existing and ch_m and ans_m:
                    ans = int(ans_m.group(1))
                    ch_items = re.findall(r"['\"`]([^'\"`]*)['\"`]", ch_m.group(1))
                    if ans < len(ch_items):
                        wa = ch_items[ans]
                        wa_cap = wa[0].upper() + wa[1:] if len(wa) > 1 else wa.upper()
                        insert = f",wa:'{wa}',accept:['{wa}','{wa_cap}']"
                        new_block = new_block.replace(new_fmt, new_fmt + insert, 1)

                content = content[:start] + new_block + content[end:]
                count += 1
                found = True
                break

            elif not has_written_kw and fmt_val == 'written' and '배열' not in stem:
                ch_m = re.search(r"ch:\s*\[", block)
                if ch_m:
                    new_fmt = fmt_full.replace(f'{fmt_q}written{fmt_q}', f'{fmt_q}mc{fmt_q}')
                    new_block = block.replace(fmt_full, new_fmt, 1)
                    content = content[:start] + new_block + content[end:]
                    count += 1
                    found = True
                    break

        if not found:
            break

    return content, count


def fix_explanation(content, filepath):
    """Fix 7: Ensure det.analysis is at least 10 chars."""
    count = 0
    circled = '①②③④⑤'

    for _ in range(60):
        found = False
        blocks = split_q_blocks(content)

        for start, end, block in blocks:
            analysis, analysis_full, analysis_q = find_field(block, 'analysis')
            if analysis is None:
                continue
            if len(analysis.strip()) >= 10:
                continue

            ans_m = re.search(r'ans:\s*(\d+)', block)
            fmt_val, _, _ = find_field(block, 'fmt')
            ch_m = re.search(r"ch:\s*\[([^\]]*)\]", block)
            wa, _, _ = find_field(block, 'wa')

            fmt = fmt_val or 'mc'
            new_analysis = None

            if fmt == 'written' and wa:
                new_analysis = f"정답: {wa}. 문맥과 어법에 맞는 형태입니다."
            elif ch_m and ans_m:
                ans = int(ans_m.group(1))
                ch_items = re.findall(r"['\"`]([^'\"`]*)['\"`]", ch_m.group(1))
                if ans < len(ch_items):
                    ans_text = ch_items[ans]
                    c = circled[ans] if ans < 5 else str(ans + 1)
                    new_analysis = f"정답: {c} {ans_text}. 나머지 선지는 문맥에 적절하지 않습니다."

            if new_analysis:
                q = analysis_q or "'"
                new_str = f"analysis:{q}{new_analysis}{q}"
                new_block = block.replace(analysis_full, new_str, 1)
                content = content[:start] + new_block + content[end:]
                count += 1
                found = True
                break

        if not found:
            break

    return content, count


def process_file(filepath):
    global scanned
    scanned += 1

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
    except Exception as e:
        print(f"  [ERROR] {filepath}: {e}")
        return

    content = original
    file_fixes = []

    # Fix 1
    content, n = fix_title_typo(content, filepath)
    if n > 0:
        fixed["1_title_typo"] += n
        file_fixes.append(f"title_typo={n}")

    if 'const Q' not in content:
        if content != original:
            modified_files.add(filepath)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            short = filepath.replace(str(BASE) + '/', '')
            print(f"  [FIXED] {short}: {', '.join(file_fixes)}")
        return

    # Fix 2
    content, n = fix_morph_parens(content, filepath)
    if n > 0:
        fixed["2_morph_parens"] += n
        file_fixes.append(f"morph_parens={n}")

    # Fix 3
    content, n = fix_stem_range(content, filepath)
    if n > 0:
        fixed["3_stem_range"] += n
        file_fixes.append(f"stem_range={n}")

    # Fix 4
    issues = check_ans_mismatch(content, filepath)
    if issues:
        fixed["4_ans_mismatch"].extend(issues)

    # Fix 5
    dupes = detect_duplicates(content, filepath)
    if dupes:
        fixed["5_duplicate"].extend(dupes)

    # Fix 6
    content, n = fix_fmt_stem(content, filepath)
    if n > 0:
        fixed["6_fmt_stem"] += n
        file_fixes.append(f"fmt_stem={n}")

    # Fix 7
    content, n = fix_explanation(content, filepath)
    if n > 0:
        fixed["7_explanation"] += n
        file_fixes.append(f"explanation={n}")

    if content != original:
        modified_files.add(filepath)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        short = filepath.replace(str(BASE) + '/', '')
        print(f"  [FIXED] {short}: {', '.join(file_fixes)}")


def main():
    print("=" * 70)
    print("deep-fix.py — Scanning ALL HTML files")
    print("=" * 70)

    files = find_html_files()
    print(f"\nFound {len(files)} HTML files to scan.\n")

    for f in files:
        process_file(f)

    # Post-fix verification
    print("\n--- Post-fix verification ---")
    remaining_fmt = 0
    remaining_analysis = 0
    remaining_typo = 0
    for f in files:
        content = open(f, encoding='utf-8').read()
        remaining_typo += content.count('번번')
        if 'const Q' not in content:
            continue
        blocks = split_q_blocks(content)
        for s, e, block in blocks:
            stem, _, _ = find_field(block, 'stem')
            fmt_val, _, _ = find_field(block, 'fmt')
            analysis, _, _ = find_field(block, 'analysis')
            if stem and fmt_val:
                if any(kw in stem for kw in ['쓰시오','쓰세요','하시오']) and fmt_val == 'mc':
                    remaining_fmt += 1
            if analysis is not None and len(analysis.strip()) < 10:
                remaining_analysis += 1

    print(f"  Remaining 번번: {remaining_typo}")
    print(f"  Remaining fmt mismatch (mc+쓰시오): {remaining_fmt}")
    print(f"  Remaining short analysis: {remaining_analysis}")

    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    print(f"\nFiles scanned: {scanned}")
    print(f"Files modified: {len(modified_files)}")

    print(f"\n--- Auto-fixed (this run) ---")
    print(f"  1. Title typo '번번'→'번':       {fixed['1_title_typo']} fixes")
    print(f"  2. 어형변환 괄호 누락:            {fixed['2_morph_parens']} fixes")
    print(f"  3. Stem range ①~③→①~⑤:          {fixed['3_stem_range']} fixes")
    print(f"  6. fmt-stem 불일치:               {fixed['6_fmt_stem']} fixes")
    print(f"  7. 해설 누락/부족 (<10자):        {fixed['7_explanation']} fixes")

    total_auto = (fixed['1_title_typo'] + fixed['2_morph_parens'] +
                  fixed['3_stem_range'] + fixed['6_fmt_stem'] + fixed['7_explanation'])
    print(f"\n  TOTAL auto-fixed: {total_auto}")

    print(f"\n--- Logged for manual review (NOT auto-fixed) ---")
    print(f"  4. 정답-해설 불일치 (CRITICAL): {len(fixed['4_ans_mismatch'])} issues")
    if fixed['4_ans_mismatch']:
        for issue in fixed['4_ans_mismatch']:
            short = issue['file'].replace(str(BASE) + '/', '')
            print(f"     *** {short} Q{issue['qid']}: ans={issue['current_ans']}, "
                  f"analysis={issue['analysis_says']} ({issue['type']})")

    print(f"  5. 중복 문항: {len(fixed['5_duplicate'])} issues")
    if fixed['5_duplicate']:
        by_file = {}
        for d in fixed['5_duplicate']:
            short = d['file'].replace(str(BASE) + '/', '')
            by_file.setdefault(short, []).append(d)
        shown = 0
        for f, dupes in sorted(by_file.items()):
            if shown < 15:
                print(f"     - {f}: {len(dupes)} dupes")
                shown += 1
        if len(by_file) > 15:
            print(f"     ... and {len(by_file) - 15} more files")

    total_unfixable = len(fixed['4_ans_mismatch']) + len(fixed['5_duplicate'])
    print(f"\n  TOTAL unfixable (manual review): {total_unfixable}")

    print(f"\n{'=' * 70}")
    print(f"SUMMARY: {total_auto} auto-fixed across {len(modified_files)} files, "
          f"{total_unfixable} logged for manual review")
    print(f"{'=' * 70}")


if __name__ == '__main__':
    main()
