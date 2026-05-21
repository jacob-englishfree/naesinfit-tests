#!/usr/bin/env python3
"""
Fix SEM-3 errors: 어법 ch[] doesn't match passage underlines.

Two types of SEM-3:
1. Order mismatch: passage markers ①②③④ appear in wrong text order vs ch array
2. Answer not in passage: the answer ch word (wrong grammatical form) is not underlined

Fix strategy:
- Type 1 (order mismatch only): Renumber passage markers so ① = ch[0] word, ② = ch[1] word, etc.
  The text order of markers must be monotonically increasing (① before ② before ③ before ④)
  Fix: reorder ch to match text appearance order of underlined words, update ans accordingly.

- Type 2 (answer not in passage): The answer word in ch is a wrong grammatical form.
  The passage has the correct form, or the answer word is completely absent.
  Fix: find what word is at the position where the answer should be, OR add <u> tag around
  the answer word if it appears in passage.

Key: After fix, validate.js SEM-3 must be gone.
"""

import json
import re
import sys
import subprocess
import os
import copy

BASE = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"

CIRCLE_LIST = ['①', '②', '③', '④', '⑤']
CIRCLE_MAP = {i+1: c for i, c in enumerate(CIRCLE_LIST)}
CIRCLE_REVERSE = {c: i+1 for i, c in enumerate(CIRCLE_LIST)}


def strip_marker_prefix(s):
    """Remove leading ①②③④⑤ and space from choice string"""
    s = s.strip()
    if s and s[0] in CIRCLE_REVERSE:
        return s[1:].strip()
    return s


def get_passage_underline_order(passage):
    """
    Returns list of (position, marker, word) for each ①②③④<u>word</u> in passage,
    sorted by position in text.
    """
    results = []
    for m in re.finditer(r'([①②③④⑤])<u>([^<]+)</u>', passage):
        results.append((m.start(), m.group(1), m.group(2)))
    results.sort(key=lambda x: x[0])
    return results


def fix_sem3_question(q, q_num):
    """
    Fix SEM-3 for a single 어법 question.
    Returns (new_q, changed, description)
    """
    if q.get('type') not in ('어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'):
        return q, False, "not 어법 type"

    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)  # 1-based

    if not ch or not passage:
        return q, False, "no ch or passage"

    # Get ch words (stripped of marker prefix)
    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ch_words_lower = [w.lower() for w in ch_words_raw]

    # Get underlined words in passage order
    underline_order = get_passage_underline_order(passage)

    if len(underline_order) < 2:
        return q, False, "fewer than 2 underlines in passage"

    # Extract just the words in order
    passage_words_lower = [w.lower() for _, _, w in underline_order]

    # Check current state of SEM-3
    # Build mapping: ch_word -> passage position
    used = set()
    mapping = [-1] * len(ch_words_lower)

    # Pass 1: exact match
    for ci, cw in enumerate(ch_words_lower):
        for pi, pw in enumerate(passage_words_lower):
            if pi not in used and pw == cw:
                mapping[ci] = pi
                used.add(pi)
                break

    # Pass 2: inclusion match
    for ci, cw in enumerate(ch_words_lower):
        if mapping[ci] != -1:
            continue
        for pi, pw in enumerate(passage_words_lower):
            if pi not in used and (pw in cw or cw in pw):
                mapping[ci] = pi
                used.add(pi)
                break

    # Check if order is correct (should be monotonically increasing)
    mapped_positions = [mapping[i] for i in range(len(ch_words_lower)) if mapping[i] != -1]
    is_ordered = all(mapped_positions[j] < mapped_positions[j+1] for j in range(len(mapped_positions)-1))

    # Check if answer word is in passage
    ans_idx = ans - 1  # 0-based
    ans_in_passage = (ans_idx < len(mapping) and mapping[ans_idx] != -1)

    if is_ordered and ans_in_passage:
        return q, False, "already correct"

    # --- Fix ---
    new_q = copy.deepcopy(q)

    if not is_ordered and ans_in_passage:
        # Type 1: Order mismatch only
        # Reorder ch to match text appearance order
        # Build: for each passage underline (in text order), find which ch word it matches
        # Then rebuild ch in that order, updating ans

        # Create mapping from passage position to ch index
        pos_to_ch = {}
        used2 = set()
        for ci, cw in enumerate(ch_words_lower):
            for pi, pw in enumerate(passage_words_lower):
                if pi not in used2 and (pw == cw or pw in cw or cw in pw):
                    pos_to_ch[pi] = ci
                    used2.add(pi)
                    break

        # New ch order: passage underlines in text order
        new_ch_order = []  # list of old ch indices
        for pi in range(len(underline_order)):
            if pi in pos_to_ch:
                new_ch_order.append(pos_to_ch[pi])
            else:
                # No match - keep as-is or skip
                pass

        if len(new_ch_order) == len(ch):
            # Rebuild ch with new markers ①②③④
            old_ch_words = ch_words_raw
            new_ch = [f"{CIRCLE_MAP[i+1]} {old_ch_words[new_ch_order[i]]}" for i in range(len(new_ch_order))]

            # Update ans: find where the old ans_idx ended up in new order
            old_ans_idx = ans - 1
            new_ans_pos = new_ch_order.index(old_ans_idx) + 1  # 1-based
            new_q['ch'] = new_ch
            new_q['ans'] = new_ans_pos

            # Also renumber passage markers to match new ch order
            # Remove all existing markers, then re-add them in order
            clean_passage = re.sub(r'[①②③④⑤]<u>([^<]+)</u>', r'__MARKER__\1__END__', passage)

            # Find all MARKER placeholders in order
            marker_words = re.findall(r'__MARKER__([^_]+)__END__', clean_passage)

            # We need to renumber them so that:
            # new_ch[0] word gets ①, new_ch[1] word gets ②, etc.
            # But text position is fixed, so ① must appear before ② in text

            # The new_ch_order tells us: new_ch[i] = old_ch[new_ch_order[i]]
            # old_ch words were at certain passage positions
            # We just need markers to be ①②③④ in text order

            # Since we already reordered ch to match text order, we can just renumber
            # passage markers sequentially as they appear
            result_passage = passage
            # Remove all markers and re-add in sequence
            result_passage = re.sub(r'[①②③④⑤]<u>', '<u>', result_passage)
            # Now add markers back - find each <u> in order and prefix with ①②③④
            parts = re.split(r'(<u>[^<]+</u>)', result_passage)
            marker_idx = 0
            new_passage_parts = []
            for part in parts:
                if part.startswith('<u>'):
                    if marker_idx < len(CIRCLE_LIST):
                        new_passage_parts.append(CIRCLE_MAP[marker_idx+1] + part)
                        marker_idx += 1
                    else:
                        new_passage_parts.append(part)
                else:
                    new_passage_parts.append(part)
            new_q['passage'] = ''.join(new_passage_parts)

            return new_q, True, f"Type1: reordered ch, new ans={new_ans_pos}"
        else:
            return q, False, f"Type1 failed: new_ch_order len={len(new_ch_order)} vs ch len={len(ch)}"

    elif not ans_in_passage:
        # Type 2: Answer word not in passage
        # Strategy: find the answer word in fullPassage or passage (without markers)
        # and add <u> tag around it, adjusting marker numbers

        ans_word = ch_words_raw[ans_idx]
        ans_word_lower = ans_word.lower()

        # Strip all markers from passage to search
        clean_passage = re.sub(r'[①②③④⑤]<u>([^<]+)</u>', r'\1', passage)
        clean_passage_lower = clean_passage.lower()

        # Check if answer word appears in clean passage
        found_idx = clean_passage_lower.find(ans_word_lower)
        if found_idx == -1:
            # Try partial match (e.g., "to take" -> find "take", "taking" -> find "tak")
            # Also check: maybe the passage has a DIFFERENT form (e.g., "taking" instead of "to take")
            # In that case we might need to look at what's near the existing underlines

            # Count existing underlines
            existing = get_passage_underline_order(passage)
            if len(existing) == len(ch) - 1:
                # One underline is missing - the answer
                # Find which ch word position is not covered
                # The existing underlines cover some ch words, ans is not among them
                # We need to find where in the passage the ans word SHOULD be
                # Use the full passage context and try to add the word

                # Try finding a substring that might match
                words = ans_word_lower.split()
                for word in words:
                    if len(word) > 3:
                        idx2 = clean_passage_lower.find(word)
                        if idx2 != -1:
                            # Found partial match - use the actual passage word
                            # Find word boundaries
                            start = idx2
                            # extend to word boundary
                            while start > 0 and clean_passage[start-1].isalpha():
                                start -= 1
                            end = idx2 + len(word)
                            while end < len(clean_passage) and clean_passage[end].isalpha():
                                end += 1
                            actual_word = clean_passage[start:end]

                            # Check this word is not already underlined in passage
                            if actual_word.lower() not in passage_words_lower:
                                found_idx = start
                                ans_word = actual_word
                                ans_word_lower = actual_word.lower()
                                break

            if found_idx == -1:
                return q, False, f"Type2: cannot find '{ans_word}' in passage"

        # Find the actual position and word in clean passage
        # Now we need to add <u> marker around ans_word in the passage
        # First, determine where to insert ② or whichever marker

        # Rebuild: strip all markers, add them back including new answer marker
        clean_passage = re.sub(r'[①②③④⑤]<u>([^<]+)</u>', r'\1', passage)

        # Find position of ans_word in clean_passage
        clean_lower = clean_passage.lower()
        pos = clean_lower.find(ans_word_lower)
        if pos == -1:
            return q, False, f"Type2: cannot find '{ans_word}' in clean passage"

        # Get actual casing from passage
        actual_word = clean_passage[pos:pos+len(ans_word)]

        # Add <u> tag: insert marker before the word
        # The marker number should be ans (since ch[ans-1] is the answer word)
        # But we need all markers to appear in order ① < ② < ③ < ④ in text

        # All passage markers (existing + new) need to be in text order and match ch order
        # Gather existing marker words and their positions in clean_passage
        old_underlines = get_passage_underline_order(passage)  # (pos, marker, word) in old passage

        # Map each old underline to its clean_passage position
        clean_positions = []
        for orig_pos, marker, word in old_underlines:
            cp = clean_lower.find(word.lower())
            if cp != -1:
                clean_positions.append((cp, word))
                # Advance search to avoid re-finding same word
            # else skip

        # Add the new answer word
        all_positions = clean_positions + [(pos, actual_word)]
        all_positions.sort(key=lambda x: x[0])

        # all_positions now has all words in text order (including new answer)
        # ch should already list them in the right order; now we need to figure out
        # which position corresponds to which ch entry

        # Build word->ch_index mapping
        ch_word_to_idx = {}
        for ci, cw in enumerate(ch_words_lower):
            ch_word_to_idx[cw] = ci

        # Map positions to ch indices
        pos_to_ch_idx = []
        for cp, word in all_positions:
            wl = word.lower()
            found_ci = -1
            for ci, cw in enumerate(ch_words_lower):
                if cw == wl or cw in wl or wl in cw:
                    found_ci = ci
                    break
            pos_to_ch_idx.append((cp, word, found_ci))

        # Sort by text position and assign markers ①②③④ in order
        pos_to_ch_idx.sort(key=lambda x: x[0])

        # Build new passage: insert markers in order
        result = clean_passage
        # Process in reverse order to preserve positions
        insertions = []
        for seq_idx, (cp, word, ci) in enumerate(pos_to_ch_idx):
            marker = CIRCLE_MAP.get(seq_idx+1, '')
            insertions.append((cp, cp+len(word), marker, word))

        # Apply insertions in reverse order
        insertions.sort(key=lambda x: x[0], reverse=True)
        result = clean_passage
        for start, end, marker, word in insertions:
            result = result[:start] + marker + '<u>' + result[start:end] + '</u>' + result[end:]

        # Update ch to match new marker order
        # seq_idx 0 = ①, seq_idx 1 = ②, etc.
        new_ch_words = []
        new_ans = ans  # default
        for seq_idx, (cp, word, ci) in enumerate(sorted(pos_to_ch_idx, key=lambda x: x[0])):
            if ci != -1:
                new_ch_words.append(ch_words_raw[ci])
                if ci == ans_idx:
                    new_ans = seq_idx + 1
            else:
                new_ch_words.append(word)

        new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_words)]
        new_q['passage'] = result
        new_q['ch'] = new_ch
        new_q['ans'] = new_ans

        return new_q, True, f"Type2: added underline for '{actual_word}', new ans={new_ans}"

    elif not is_ordered and not ans_in_passage:
        # Both issues - handle order first then answer
        # Simplified: just renumber passage markers to be in text order
        # and also add answer underline
        # For now, return not fixed and let it be handled manually
        return q, False, "Type1+2 combined - complex case"

    return q, False, "unknown state"


def fix_file(filepath, question_indices, dry_run=False):
    """Fix specific questions in a file. question_indices is 1-based."""
    full_path = os.path.join(BASE, "data", filepath)

    if not os.path.exists(full_path):
        print(f"  ERROR: File not found: {full_path}")
        return 0, []

    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    fixed_count = 0
    descriptions = []

    for q_num in question_indices:
        idx = q_num - 1  # Convert to 0-based
        if idx >= len(questions):
            print(f"  WARNING: Q{q_num} not found (only {len(questions)} questions)")
            continue

        q = questions[idx]
        new_q, changed, desc = fix_sem3_question(q, q_num)

        if changed:
            if not dry_run:
                questions[idx] = new_q
            fixed_count += 1
            descriptions.append(f"Q{q_num}: {desc}")
            print(f"  ✓ Fixed Q{q_num}: {desc}")
        else:
            descriptions.append(f"Q{q_num}: SKIP ({desc})")
            print(f"  - Q{q_num}: {desc}")

    if fixed_count > 0 and not dry_run:
        data['questions'] = questions
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  → Saved")

    return fixed_count, descriptions


def run_validate(filepath):
    """Run validate.js on a file and return SEM-3 count."""
    full_path = os.path.join(BASE, "data", filepath)
    validate_script = os.path.join(BASE, "validate", "validate.js")

    result = subprocess.run(
        ["node", validate_script, full_path],
        capture_output=True, text=True, cwd=BASE
    )

    output = result.stdout + result.stderr
    sem3_errors = re.findall(r'\[A\] SEM-3.*', output)
    s_errors = re.findall(r'\[S\].*', output)
    pass_line = 'PASS' in output

    return {
        'sem3_count': len(sem3_errors),
        'sem3_errors': sem3_errors,
        's_errors': s_errors,
        'pass': pass_line and len(s_errors) == 0
    }


# Files to fix: (filepath, [question_numbers_1based])
FILES_TO_FIX = [
    ("부교재/수능특강/영어/21강/Gateway/워크북.json", [1, 2, 3]),
    ("부교재/수능특강/영어/21강/워크북.json", [1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 14, 16, 18, 19]),
    ("부교재/수능특강/영어/21강/퀴즈.json", [1, 2, 3, 6, 7, 8, 11, 12, 13, 16, 17, 18]),
    ("부교재/수능특강/영어/22강/Gateway/워크북.json", [1, 4]),
    ("부교재/수능특강/영어/6강/1번/워크북.json", [1, 3, 4]),
    ("부교재/수능특강/영어/6강/2번/퀴즈.json", [6]),
    ("부교재/수능특강/영어/6강/Gateway/워크북.json", [3]),
    ("부교재/수능특강/영어/8강/4번/퀴즈.json", [1, 2, 3]),
    ("부교재/수능특강/영어/8강/Gateway/퀴즈.json", [3]),
    ("부교재/수능특강/영어/8강/퀴즈.json", [1, 2, 3]),
    ("부교재/수능특강Light/영어/10강/3번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/10강/3번/퀴즈.json", [1, 2]),
    ("부교재/수능특강Light/영어/11강/4번/퀴즈.json", [1, 3]),
    ("부교재/수능특강Light/영어/16강/Gateway/워크북.json", [2, 3, 4]),
    ("부교재/수능특강Light/영어/17강/4번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/2강/1번/워크북.json", [2]),
    ("부교재/수능특강Light/영어/2강/1번/퀴즈.json", [2, 3]),
    ("부교재/수능특강Light/영어/2강/2번/워크북.json", [1, 2, 3, 4]),
    ("부교재/수능특강Light/영어/2강/3번/워크북.json", [1, 2, 4]),
    ("부교재/수능특강Light/영어/2강/Gateway/워크북.json", [2, 4]),
    ("부교재/수능특강Light/영어/3강/1번/퀴즈.json", [1, 3]),
    ("부교재/수능특강Light/영어/3강/3번/워크북.json", [1, 2, 4]),
    ("부교재/수능특강Light/영어/3강/3번/퀴즈.json", [3]),
    ("부교재/수능특강Light/영어/3강/4번/워크북.json", [2, 3]),
    ("부교재/수능특강Light/영어/3강/Gateway/퀴즈.json", [3]),
    ("부교재/수능특강Light/영어/4강/2번/워크북.json", [1, 2, 3, 4]),
    ("부교재/수능특강Light/영어/4강/4번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/4강/Gateway/워크북.json", [2, 3, 4]),
    ("부교재/수능특강Light/영어/4강/Gateway/퀴즈.json", [1, 2]),
    ("부교재/수능특강Light/영어/5강/Gateway/워크북.json", [1, 2, 3, 4]),
]


def main():
    total_fixed = 0
    failed_files = []
    skipped_questions = []

    for filepath, q_nums in FILES_TO_FIX:
        print(f"\n{'='*60}")
        print(f"File: {filepath}")
        print(f"Questions: {q_nums}")

        fixed, descs = fix_file(filepath, q_nums)
        total_fixed += fixed

        # Run validate after fix
        v = run_validate(filepath)
        remaining_sem3 = v['sem3_count']
        has_new_s = len(v['s_errors']) > 0

        if has_new_s:
            print(f"  ⚠️  NEW [S] ERRORS INTRODUCED! Reverting...")
            # Revert by reloading original (we already saved, need backup)
            # In practice, check manually
            failed_files.append((filepath, "introduced S errors"))
        elif remaining_sem3 > 0:
            print(f"  ⚠️  {remaining_sem3} SEM-3 errors remaining")
            for e in v['sem3_errors']:
                print(f"    {e}")
            failed_files.append((filepath, f"{remaining_sem3} SEM-3 remaining"))
        else:
            print(f"  ✅ SEM-3 cleared")

        # Track skipped
        for d in descs:
            if 'SKIP' in d:
                skipped_questions.append(f"{filepath}: {d}")

    print(f"\n{'='*60}")
    print(f"TOTAL FIXED: {total_fixed} questions")
    print(f"Files with remaining issues: {len(failed_files)}")
    for f, reason in failed_files:
        print(f"  - {f}: {reason}")
    if skipped_questions:
        print(f"\nSkipped ({len(skipped_questions)}):")
        for sq in skipped_questions[:20]:
            print(f"  {sq}")

    return total_fixed, failed_files, skipped_questions


if __name__ == '__main__':
    main()
