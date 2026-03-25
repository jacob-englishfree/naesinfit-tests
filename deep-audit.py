#!/usr/bin/env python3
"""
deep-audit.py — 내신핏 테스트 전체 HTML 파일 심층 검수 스크립트
606개 파일 (모의고사 414 + 수능특강 192) 대상

검사 항목 8가지:
1. 중복 문항 (같은 ans + 같은 ch 배열)
2. stem 범위 불일치 ("①~③" 인데 밑줄 5개)
3. 정답-해설 불일치 (analysis의 ✅/❌ 순번과 ans 불일치)
4. 유형-stem 불일치 (type과 stem 내용 모순)
5. fmt-stem 불일치 (서술형인데 mc, 또는 반대)
6. 선지 해설 누락 (analysis의 ✅/❌ 개수 < ch 길이)
7. 타이틀 오타 ("번번")
8. 어형변환 괄호 누락 (어형 변환인데 passage에 괄호 없음)
"""

import os
import re
import json
import sys
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
DIRS = [
    os.path.join(BASE, "모의고사"),
    os.path.join(BASE, "부교재"),
]

# ── Helpers ──

def find_html_files():
    files = []
    for d in DIRS:
        if not os.path.isdir(d):
            continue
        for root, _, fnames in os.walk(d):
            for f in fnames:
                if f.endswith('.html'):
                    files.append(os.path.join(root, f))
    return sorted(files)


def extract_questions(content):
    """Extract question objects from HTML content using regex.
    Returns list of dicts with: id, type, diff, pts, fmt, ans, ch, passage, stem, analysis
    """
    questions = []

    # Pattern to match question blocks: {id:N, ...}
    # We look for patterns like {id:1,type:... up to the closing }}
    # Questions end with }}, (next question) or }}]; (end of array)
    q_pattern = re.compile(
        r'\{id:(\d+),type:`([^`]*)`,'
        r'diff:`([^`]*)`,'
        r'pts:(\d+),'
        r'fmt:"([^"]*)",'
        r'ans:(\d+),',
        re.DOTALL
    )

    for m in q_pattern.finditer(content):
        q = {
            'id': int(m.group(1)),
            'type': m.group(2),
            'diff': m.group(3),
            'pts': int(m.group(4)),
            'fmt': m.group(5),
            'ans': int(m.group(6)),
            'start': m.start(),
        }

        # Extract the full question block starting from this match
        # Find the section after ans:N,
        rest = content[m.end():]

        # Extract ch array
        ch_match = re.match(r'\s*ch:\[([^\]]*)\]', rest)
        if ch_match:
            ch_str = ch_match.group(1)
            q['ch'] = re.findall(r'`([^`]*)`', ch_str)
            if not q['ch']:
                q['ch'] = re.findall(r'"([^"]*)"', ch_str)
        else:
            q['ch'] = []

        # Extract passage
        passage_match = re.search(r'passage:`([^`]*)`', rest[:5000])
        passage_replace_match = re.search(r"passage:FULL_PASSAGE\.replace\('([^']*)',\s*'([^']*)'\)", rest[:5000])
        if passage_match:
            q['passage'] = passage_match.group(1)
        elif passage_replace_match:
            q['passage_replace'] = (passage_replace_match.group(1), passage_replace_match.group(2))
            q['passage'] = ''
        else:
            q['passage'] = ''

        # Extract stem
        stem_match = re.search(r'stem:`([^`]*)`', rest[:5000])
        q['stem'] = stem_match.group(1) if stem_match else ''

        # Extract analysis
        analysis_match = re.search(r'analysis:`([^`]*)`', rest[:5000])
        q['analysis'] = analysis_match.group(1) if analysis_match else ''

        questions.append(q)

    # Also handle written-format questions (no ch, has wa/accept)
    w_pattern = re.compile(
        r'\{id:(\d+),type:`([^`]*)`,'
        r'diff:`([^`]*)`,'
        r'pts:(\d+),'
        r'fmt:"(written)",'
        r'wa:`([^`]*)`',
        re.DOTALL
    )
    written_ids = {q['id'] for q in questions}
    for m in w_pattern.finditer(content):
        qid = int(m.group(1))
        if qid in written_ids:
            continue
        q = {
            'id': qid,
            'type': m.group(2),
            'diff': m.group(3),
            'pts': int(m.group(4)),
            'fmt': 'written',
            'ans': -1,  # written has no numeric ans
            'ch': [],
            'start': m.start(),
        }
        rest = content[m.end():]

        passage_match = re.search(r'passage:`([^`]*)`', rest[:5000])
        passage_replace_match = re.search(r"passage:FULL_PASSAGE\.replace\('([^']*)',\s*'([^']*)'\)", rest[:5000])
        if passage_match:
            q['passage'] = passage_match.group(1)
        elif passage_replace_match:
            q['passage_replace'] = (passage_replace_match.group(1), passage_replace_match.group(2))
            q['passage'] = ''
        else:
            q['passage'] = ''

        stem_match = re.search(r'stem:`([^`]*)`', rest[:5000])
        q['stem'] = stem_match.group(1) if stem_match else ''

        analysis_match = re.search(r'analysis:`([^`]*)`', rest[:5000])
        q['analysis'] = analysis_match.group(1) if analysis_match else ''

        questions.append(q)

    questions.sort(key=lambda x: x['id'])
    return questions


def extract_full_passage(content):
    m = re.search(r'const FULL_PASSAGE=`([^`]*)`', content)
    return m.group(1) if m else ''


# ── Check functions ──

def check_duplicate_questions(filepath, questions):
    """Check 1: Same ans + same ch in multiple questions (excluding T/F & circle-number)"""
    issues = []
    seen = {}
    # Skip T/F questions (O/X choices) and circle-number choices (①②③④⑤)
    # as these naturally share the same choice arrays
    tf_choices = [('O','X'), ('O', 'X', '판단불가'), ('True','False')]
    circle_choices_set = {'①','②','③','④','⑤'}

    for q in questions:
        if not q['ch'] or len(q['ch']) < 2:
            continue
        ch_tuple = tuple(q['ch'])
        # Skip if choices are T/F style
        if ch_tuple in [tuple(t) for t in tf_choices]:
            continue
        # Skip if choices are circle numbers
        if set(q['ch']).issubset(circle_choices_set):
            continue
        key = (q['ans'], ch_tuple)
        if key in seen:
            issues.append(f"  Q{q['id']} duplicates Q{seen[key]} (same ans={q['ans']}, same choices)")
        else:
            seen[key] = q['id']
    return issues


def check_stem_range(filepath, questions):
    """Check 2: Stem says ①~③ but passage has more underlined items"""
    issues = []
    circle_nums = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩']

    for q in questions:
        stem = q['stem']
        passage = q.get('passage', '')

        # Find range in stem like ①~③ or ①~⑤
        range_match = re.search(r'([①②③④⑤⑥⑦⑧⑨⑩])~([①②③④⑤⑥⑦⑧⑨⑩])', stem)
        if not range_match:
            continue

        start_c = range_match.group(1)
        end_c = range_match.group(2)
        if start_c in circle_nums and end_c in circle_nums:
            declared_end = circle_nums.index(end_c)
            # Count actual circled numbers in passage
            actual_circles = set()
            for i, c in enumerate(circle_nums):
                if c in passage:
                    actual_circles.add(i)
            if actual_circles:
                max_actual = max(actual_circles)
                if declared_end < max_actual:
                    issues.append(
                        f"  Q{q['id']}: stem says {start_c}~{end_c} but passage has up to {circle_nums[max_actual]}"
                    )
    return issues


def check_answer_analysis(filepath, questions):
    """Check 3: Analysis says ❌④ but ans doesn't match (circle-number 어법/어휘 only)"""
    issues = []
    circle_nums = ['①','②','③','④','⑤']

    for q in questions:
        if q['fmt'] != 'mc' or not q['analysis']:
            continue
        # Only check questions where choices ARE circle numbers (①②③④⑤)
        if not q['ch'] or q['ch'][0] not in circle_nums:
            continue
        if q['type'] not in ['어법', '어휘']:
            continue

        analysis = q['analysis']

        # For 어법/어휘 with ①~⑤: the ❌ item is the answer (the wrong one)
        wrong_match = re.search(r'❌\s*([①②③④⑤])', analysis)
        if wrong_match:
            wrong_circle = wrong_match.group(1)
            if wrong_circle in circle_nums:
                expected_ans = circle_nums.index(wrong_circle)
                if q['ans'] != expected_ans:
                    issues.append(
                        f"  Q{q['id']}: analysis ❌{wrong_circle} implies ans={expected_ans} but ans={q['ans']}"
                    )
    return issues


def check_type_stem(filepath, questions):
    """Check 4: type says one thing but stem asks something else"""
    issues = []
    type_stem_map = {
        '내용불일치': ['일치하지 않는', '불일치'],
        '내용일치': ['일치하는', '일치'],
        '목적': ['목적'],
        '주제': ['주제'],
        '제목': ['제목'],
        '요지': ['요지'],
        '심경': ['심경', '심정', '기분', '분위기'],
        '빈칸추론': ['빈칸'],
        '주장': ['주장'],
    }
    for q in questions:
        qtype = q['type']
        stem = q['stem']
        if not stem:
            continue
        for mapped_type, keywords in type_stem_map.items():
            if qtype == mapped_type:
                if not any(kw in stem for kw in keywords):
                    # Special: 내용일치 stem can also say "일치"
                    issues.append(
                        f"  Q{q['id']}: type='{qtype}' but stem doesn't contain any of {keywords}"
                    )
                break
    return issues


def check_fmt_stem(filepath, questions):
    """Check 5: stem says 쓰시오 but fmt=mc, or vice versa"""
    issues = []
    for q in questions:
        stem = q['stem']
        fmt = q['fmt']
        if not stem:
            continue
        is_written_stem = any(kw in stem for kw in ['쓰시오', '서술하시오', '적으시오', '작성하시오'])
        if is_written_stem and fmt == 'mc':
            issues.append(f"  Q{q['id']}: stem asks '쓰시오' but fmt='mc'")
        # Reverse: fmt=written but stem asks 고르시오/것은?
        is_mc_stem = any(kw in stem for kw in ['것은?', '고르시오', '고른 것은'])
        if is_mc_stem and fmt == 'written':
            issues.append(f"  Q{q['id']}: stem asks multiple-choice but fmt='written'")
    return issues


def check_missing_choice_analysis(filepath, questions):
    """Check 6: analysis has fewer ✅/❌ markers than ch.length"""
    issues = []
    for q in questions:
        if not q['ch'] or not q['analysis'] or q['fmt'] != 'mc':
            continue
        # Only check for 어법/어휘 type where all choices should be analyzed
        if q['type'] not in ['어법', '어휘']:
            continue
        num_ch = len(q['ch'])
        num_markers = len(re.findall(r'[✅❌]', q['analysis']))
        if num_markers < num_ch:
            issues.append(
                f"  Q{q['id']}: {num_ch} choices but only {num_markers} ✅/❌ markers in analysis"
            )
    return issues


def check_title_typo(filepath, content):
    """Check 7: '번번' in title or topbar"""
    issues = []
    if '번번' in content:
        matches = re.findall(r'(\d+번번)', content)
        for m in matches:
            issues.append(f"  Found '{m}' typo in title/topbar")
    return issues


def check_morphology_no_parens(filepath, questions, full_passage):
    """Check 8: 어형 변환 type but passage blank doesn't have (base_word)"""
    issues = []
    for q in questions:
        if '어형' not in q['type'] and '어형 변환' not in q['type']:
            continue

        # Check actual passage content
        passage = q.get('passage', '')

        # If passage uses FULL_PASSAGE.replace, reconstruct
        if 'passage_replace' in q:
            orig, replacement = q['passage_replace']
            passage = full_passage.replace(orig, replacement)

        # 어형변환 passage should have __________ (word) pattern
        if '__________' in passage:
            # Check if there's a parenthesized word near the blank
            blank_pattern = re.search(r'__________\s*\([^)]+\)', passage)
            if not blank_pattern:
                issues.append(
                    f"  Q{q['id']}: type='{q['type']}' has blank without parenthesized base word"
                )
    return issues


# ── Main ──

def main():
    files = find_html_files()
    print(f"=== deep-audit.py: 내신핏 테스트 심층 검수 ===")
    print(f"총 {len(files)}개 HTML 파일 스캔\n")

    category_names = [
        "1. 중복 문항 (same ans + same choices)",
        "2. stem 범위 불일치 (①~③ vs actual)",
        "3. 정답-해설 불일치 (❌ marker vs ans)",
        "4. 유형-stem 불일치 (type vs stem content)",
        "5. fmt-stem 불일치 (written vs mc)",
        "6. 선지 해설 누락 (✅/❌ < ch.length)",
        "7. 타이틀 오타 (번번)",
        "8. 어형변환 괄호 누락",
    ]

    all_issues = {i: [] for i in range(8)}
    error_files = []

    for filepath in files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            error_files.append((filepath, str(e)))
            continue

        relpath = os.path.relpath(filepath, BASE)
        questions = extract_questions(content)
        full_passage = extract_full_passage(content)

        checks = [
            (0, check_duplicate_questions(filepath, questions)),
            (1, check_stem_range(filepath, questions)),
            (2, check_answer_analysis(filepath, questions)),
            (3, check_type_stem(filepath, questions)),
            (4, check_fmt_stem(filepath, questions)),
            (5, check_missing_choice_analysis(filepath, questions)),
            (6, check_title_typo(filepath, content)),
            (7, check_morphology_no_parens(filepath, questions, full_passage)),
        ]

        for cat_idx, issues in checks:
            if issues:
                all_issues[cat_idx].append((relpath, issues))

    # ── Report ──
    print("=" * 70)
    print("검사 결과 요약")
    print("=" * 70)

    total_issues = 0
    for i in range(8):
        file_count = len(all_issues[i])
        issue_count = sum(len(issues) for _, issues in all_issues[i])
        total_issues += issue_count
        status = f"🔴 {issue_count}건 ({file_count}파일)" if issue_count > 0 else "✅ 0건"
        print(f"  {category_names[i]}: {status}")

    print(f"\n총 이슈: {total_issues}건")
    print("=" * 70)

    # Detail
    for i in range(8):
        if not all_issues[i]:
            continue
        print(f"\n{'─' * 70}")
        print(f"[{category_names[i]}]")
        print(f"{'─' * 70}")
        for relpath, issues in all_issues[i]:
            print(f"\n📄 {relpath}")
            for iss in issues:
                print(iss)

    if error_files:
        print(f"\n{'─' * 70}")
        print(f"[읽기 오류: {len(error_files)}건]")
        for fp, err in error_files:
            print(f"  {os.path.relpath(fp, BASE)}: {err}")

    print(f"\n=== 스캔 완료: {len(files)}파일, {total_issues}이슈 ===")
    return 1 if total_issues > 0 else 0


if __name__ == '__main__':
    sys.exit(main())
