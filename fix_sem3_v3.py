#!/usr/bin/env python3
"""
Fix SEM-3 errors: 어법 ch[] doesn't match passage underlines.
v3: handles all cases, avoids A6 errors.

Two types:
1. Order mismatch: passage underlines appear in different text order than ch array
   Fix: reorder ch to match text appearance order of underlined words
   CONSTRAINT: must not introduce A6 errors

2. Answer not in passage underlines: the answer ch word (wrong grammatical form)
   is not underlined in passage
   Fix: use det.analysis X→Y pattern to find Y (correct form) in passage,
        replace with X (wrong form), wrap in <u> tags
        If no det arrow, find the word in passage text and add <u>

Key: The passage underline order MUST match ch array order.
     The ans MUST point to the wrong form.
     A6 (>5 same ans) must not be introduced.

For Type1 + A6 avoidance:
  - Find wrong word via det.analysis
  - Place wrong word at current ans position in new ch
  - Fill remaining positions with other words in text order
  - This way ans value stays the same
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
    s = (s or '').strip()
    if s and s[0] in CIRCLE_REVERSE:
        return s[1:].strip()
    return s


def get_underline_positions(passage):
    """Returns list of (start_pos, word) for <u>word</u> in passage, in text order."""
    results = []
    for m in re.finditer(r'<u>([^<]+)</u>', passage):
        results.append((m.start(), m.group(1).strip()))
    return results  # Already in text order since we scan left to right


def extract_arrow_pairs(det_analysis):
    """
    Extract (wrong_form, correct_form) from det.analysis.
    Pattern: ❌ → X → Y: ... or ❌X → Y
    Returns list of (wrong, correct) pairs (lowercased for matching)
    """
    if not det_analysis:
        return []
    pairs = []
    # Pattern: ❌X → Y or ❌③ X → Y
    for m in re.finditer(r'❌[①②③④⑤]?\s*([^\s→]+)\s*→\s*([^\s:,]+)', det_analysis):
        wrong = m.group(1).strip().rstrip(':,')
        correct = m.group(2).strip().rstrip(':,')
        pairs.append((wrong.lower(), correct.lower()))
    return pairs


def extract_wrong_word_from_det(det, ch_words_lower, passage_lower):
    """
    Identify which ch word is the 'wrong' one (the answer).
    Uses det.analysis arrow patterns.
    Returns the wrong word (lowercased) or None.
    """
    det_analysis = (det or {}).get('analysis', '')
    arrows = extract_arrow_pairs(det_analysis)

    # Check each ch word against arrows
    for wrong_form, correct_form in arrows:
        for cw in ch_words_lower:
            if cw == wrong_form or cw.replace(' ', '') == wrong_form.replace(' ', ''):
                return wrong_form

    # If no direct match, check if any ch word is in arrows
    for wrong_form, correct_form in arrows:
        for cw in ch_words_lower:
            if wrong_form in cw or cw in wrong_form:
                return cw

    return None


def fix_sem3_question(q, q_num, file_all_questions=None):
    """
    Fix SEM-3 for a single 어법 question.
    Returns (new_q, changed, description)
    file_all_questions: all questions in file (for A6 check)
    """
    grammar_types = {'어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'}
    if q.get('type') not in grammar_types:
        return q, False, "not 어법 type"

    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)  # 1-based
    det = q.get('det', {})

    if not ch or not passage:
        return q, False, "no ch or passage"

    # Get ch words stripped
    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ch_words_lower = [w.lower() for w in ch_words_raw]

    # Get underlined words in text order
    underline_positions = get_underline_positions(passage)
    underline_words_lower = [w.lower() for _, w in underline_positions]

    if len(underline_words_lower) < 2:
        return q, False, "fewer than 2 underlines in passage"

    # ── Check current SEM-3 state ──
    # Build mapping: ch_index -> underline_index (position in text)
    used = set()
    mapping = [-1] * len(ch_words_lower)

    # Pass 1: exact match
    for ci, cw in enumerate(ch_words_lower):
        for pi, pw in enumerate(underline_words_lower):
            if pi not in used and pw == cw:
                mapping[ci] = pi
                used.add(pi)
                break

    # Pass 2: inclusion match
    for ci, cw in enumerate(ch_words_lower):
        if mapping[ci] != -1:
            continue
        for pi, pw in enumerate(underline_words_lower):
            if pi not in used and (pw in cw or cw in pw):
                mapping[ci] = pi
                used.add(pi)
                break

    # Check order
    mapped = [(i, mapping[i]) for i in range(len(ch_words_lower)) if mapping[i] != -1]
    is_ordered = all(mapped[j][1] < mapped[j+1][1] for j in range(len(mapped)-1))

    # Check answer in underlines
    ans_idx = ans - 1  # 0-based
    ans_in_underlines = (ans_idx < len(mapping) and mapping[ans_idx] != -1)

    if is_ordered and ans_in_underlines:
        return q, False, "already correct"

    new_q = copy.deepcopy(q)
    det_analysis = (det or {}).get('analysis', '')
    arrows = extract_arrow_pairs(det_analysis)

    # For Type 2: answer not in underlines
    # Need to add the answer word (wrong form) to passage underlines
    if not ans_in_underlines:
        ans_word = ch_words_raw[ans_idx]
        ans_word_lower = ans_word.lower()

        # Find the correct form in passage using det arrows
        correct_form = None
        for wrong, correct in arrows:
            if wrong == ans_word_lower or wrong in ans_word_lower or ans_word_lower in wrong:
                correct_form = correct
                break

        # Search for correct form in passage
        clean_passage = re.sub(r'<u>([^<]+)</u>', r'\1', passage)
        clean_lower = clean_passage.lower()

        target_in_passage = None
        target_start = -1

        if correct_form:
            # Try exact match of correct form
            idx = clean_lower.find(correct_form.lower())
            if idx != -1:
                target_in_passage = clean_passage[idx:idx+len(correct_form)]
                target_start = idx

        if target_in_passage is None:
            # Try finding the wrong word directly
            idx = clean_lower.find(ans_word_lower)
            if idx != -1:
                target_in_passage = clean_passage[idx:idx+len(ans_word)]
                target_start = idx

        if target_in_passage is None:
            # Try finding by root (first few chars)
            root = ans_word_lower[:4]
            if len(root) >= 4:
                idx = clean_lower.find(root)
                if idx != -1:
                    # Find word boundaries
                    start = idx
                    while start > 0 and clean_passage[start-1].isalpha():
                        start -= 1
                    end = idx + len(root)
                    while end < len(clean_passage) and (clean_passage[end].isalpha() or clean_passage[end] == "'"):
                        end += 1
                    target_in_passage = clean_passage[start:end]
                    target_start = start

        if target_in_passage is None:
            return q, False, f"Type2: cannot find '{ans_word}' or its correct form '{correct_form}' in passage"

        # Replace target_in_passage with wrong form (ans_word) in passage
        # Need to preserve the marker prefix if any
        # First, strip existing marker/underline structure
        # Strategy: work on clean passage, then re-add underlines

        # Build list of (position, word) for all underlines in clean passage
        existing_ul_positions = []
        for pi, (orig_pos, word) in enumerate(underline_positions):
            # Find this word in clean passage
            cp = clean_lower.find(word.lower())
            if cp != -1:
                existing_ul_positions.append((cp, word, False))  # (pos, word, is_new)

        # Add new underline (the answer word)
        new_word_display = ans_word  # The wrong form to display
        existing_ul_positions.append((target_start, new_word_display, True))

        # Sort all by position
        all_ul = sorted(existing_ul_positions, key=lambda x: x[0])

        # Build new passage: replace existing words at their positions with <u>word</u>
        # and replace target with wrong form + <u>
        # Process from right to left to preserve positions
        result = clean_passage

        # Create replacement instructions sorted by position descending
        replacements = []
        for pos, word, is_new in all_ul:
            if is_new:
                # Replace correct form at pos with wrong form
                orig_len = len(target_in_passage)
                replacements.append((target_start, target_start + orig_len, f'<u>{new_word_display}</u>'))
            else:
                replacements.append((pos, pos + len(word), f'<u>{word}</u>'))

        # Sort by position descending to apply without offset issues
        replacements.sort(key=lambda x: x[0], reverse=True)

        # Remove duplicates (same position)
        seen_pos = set()
        unique_replacements = []
        for r in replacements:
            if r[0] not in seen_pos:
                unique_replacements.append(r)
                seen_pos.add(r[0])

        for start, end, replacement in sorted(unique_replacements, key=lambda x: x[0], reverse=True):
            result = result[:start] + replacement + result[end:]

        # Now the passage has underlines. Get new underline order.
        new_ul = get_underline_positions(result)
        new_ul_words_lower = [w.lower() for _, w in new_ul]

        # Check that the new ch order matches new underline order
        # Need to reorder ch to match new underline order while keeping ans at ans-1
        new_ch, new_ans = reorder_ch_to_match_underlines(
            ch_words_raw, ans_idx, new_ul_words_lower, arrows
        )

        if new_ch is None:
            return q, False, f"Type2: failed to reorder ch after adding underline"

        # Add markers ①②③④ to ch
        new_ch_with_markers = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch)]

        new_q['passage'] = result
        new_q['ch'] = new_ch_with_markers
        new_q['ans'] = new_ans

        desc = f"Type2: replaced '{target_in_passage}' with '{new_word_display}', ans={new_ans}"
        return new_q, True, desc

    # Type 1: order mismatch only (all words are in underlines but order is wrong)
    # Get all underline words and their text positions
    # We need ch order to match text order
    # CONSTRAINT: keep ans pointing to same word (preserve A6 distribution)

    # Identify which ch word is the answer (wrong form) - it's ch[ans_idx]
    wrong_word = ch_words_lower[ans_idx]

    # Get text order of underlined words
    # mapping maps ch_index -> underline_position_index
    # We need to reorder ch so that the underline positions are in increasing order
    # while keeping ch[ans_idx] = wrong_word

    # Get underline words in text order
    # Find which underline position corresponds to each ch word
    ul_to_ch = {}  # underline_pos_idx -> ch_idx
    for ci, m in enumerate(mapping):
        if m != -1:
            ul_to_ch[m] = ci

    # Text-ordered underline words (those that are in ch)
    text_ordered_ch_indices = []
    for ul_idx in range(len(underline_words_lower)):
        if ul_idx in ul_to_ch:
            text_ordered_ch_indices.append(ul_to_ch[ul_idx])

    # text_ordered_ch_indices = the ch indices in the order they appear in text
    # Currently ch[0],ch[1],ch[2],ch[3] but text order is text_ordered_ch_indices

    # We need new_ch such that:
    # 1. new_ch in text order (new_ch[i] = ch[text_ordered_ch_indices[i]])
    # 2. new_ch[new_ans-1] = wrong_word
    # Constraint: new_ans should ideally = ans (to avoid A6)

    # Find where wrong_word ends up in text order
    wrong_text_pos = next((i for i, ci in enumerate(text_ordered_ch_indices) if ci == ans_idx), -1)
    if wrong_text_pos == -1:
        return q, False, "Type1: cannot find answer word in text order"

    new_ans_natural = wrong_text_pos + 1  # 1-based, this is the natural position

    if new_ans_natural == ans:
        # The answer stays at the same position - just reorder ch
        new_ch_raw = [ch_words_raw[text_ordered_ch_indices[i]] for i in range(len(text_ordered_ch_indices))]
        # Add any unmatched ch words at the end
        for ci in range(len(ch_words_raw)):
            if ci not in text_ordered_ch_indices:
                new_ch_raw.append(ch_words_raw[ci])
        new_ch_with_markers = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
        new_q['ch'] = new_ch_with_markers
        new_q['ans'] = ans  # unchanged

        # Also renumber passage markers to match new ch order
        new_q['passage'] = renumber_passage_markers(passage, new_ch_raw)

        return new_q, True, f"Type1: reordered ch, ans={ans} unchanged"

    else:
        # The answer would move to a different position
        # We need to check if the new distribution causes A6
        # For now, reorder ch and update ans to new_ans_natural
        # Then check against file distribution

        new_ch_raw = [ch_words_raw[text_ordered_ch_indices[i]] for i in range(len(text_ordered_ch_indices))]
        for ci in range(len(ch_words_raw)):
            if ci not in text_ordered_ch_indices:
                new_ch_raw.append(ch_words_raw[ci])
        new_ch_with_markers = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
        new_q['ch'] = new_ch_with_markers
        new_q['ans'] = new_ans_natural

        # Renumber passage markers
        new_q['passage'] = renumber_passage_markers(passage, new_ch_raw)

        return new_q, True, f"Type1: reordered ch, ans changed from {ans} to {new_ans_natural}"


def reorder_ch_to_match_underlines(ch_words_raw, ans_idx, ul_words_lower, arrows):
    """
    Reorder ch words to match underline order.
    Returns (new_ch_raw, new_ans) where new_ch_raw is in text order.
    """
    ch_words_lower = [w.lower() for w in ch_words_raw]

    # Build mapping: ch_idx -> ul_idx
    used = set()
    mapping = [-1] * len(ch_words_lower)

    for ci, cw in enumerate(ch_words_lower):
        for pi, pw in enumerate(ul_words_lower):
            if pi not in used and pw == cw:
                mapping[ci] = pi
                used.add(pi)
                break

    for ci, cw in enumerate(ch_words_lower):
        if mapping[ci] != -1:
            continue
        for pi, pw in enumerate(ul_words_lower):
            if pi not in used and (pw in cw or cw in pw):
                mapping[ci] = pi
                used.add(pi)
                break

    # Sort by text position
    matched = sorted([(mapping[ci], ci) for ci in range(len(ch_words_lower)) if mapping[ci] != -1])
    unmatched = [ci for ci in range(len(ch_words_lower)) if mapping[ci] == -1]

    new_order = [ci for _, ci in matched] + unmatched
    new_ch_raw = [ch_words_raw[ci] for ci in new_order]

    # Find new ans position
    new_ans = None
    for new_pos, old_ci in enumerate(new_order):
        if old_ci == ans_idx:
            new_ans = new_pos + 1  # 1-based
            break

    if new_ans is None:
        return None, None

    return new_ch_raw, new_ans


def renumber_passage_markers(passage, new_ch_raw):
    """
    Renumber ①②③④ markers in passage to match new_ch_raw order.
    Assigns ① to first <u> in text, ② to second, etc.
    """
    # Remove all circled markers (keep <u> tags)
    result = re.sub(r'[①②③④⑤](?=<u>)', '', passage)

    # Find all <u> positions
    parts = re.split(r'(<u>[^<]+</u>)', result)
    marker_idx = 0
    new_parts = []
    for part in parts:
        if part.startswith('<u>'):
            if marker_idx < 4:
                new_parts.append(CIRCLE_MAP[marker_idx+1] + part)
                marker_idx += 1
            else:
                new_parts.append(part)
        else:
            new_parts.append(part)
    return ''.join(new_parts)


def check_a6_violation(filepath, modified_questions_map):
    """
    Check if modifying questions would cause A6 violation.
    modified_questions_map: {q_idx: new_ans}
    """
    full_path = os.path.join(BASE, "data", filepath)
    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    ans_count = {1: 0, 2: 0, 3: 0, 4: 0}

    for i, q in enumerate(questions):
        if i in modified_questions_map:
            a = modified_questions_map[i]
        else:
            a = q.get('ans')
        if isinstance(a, int) and a in ans_count:
            ans_count[a] += 1

    return any(v > 5 for v in ans_count.values()), ans_count


def fix_file(filepath, question_indices, backup=True):
    """Fix specific questions in a file. question_indices is 1-based."""
    full_path = os.path.join(BASE, "data", filepath)

    if not os.path.exists(full_path):
        print(f"  ERROR: File not found: {full_path}")
        return 0, []

    with open(full_path, 'r', encoding='utf-8') as f:
        original_content = f.read()
        data = json.loads(original_content)

    questions = data.get('questions', [])
    pending_changes = {}  # q_idx -> (new_q, desc)

    for q_num in question_indices:
        idx = q_num - 1  # 0-based
        if idx >= len(questions):
            print(f"  WARNING: Q{q_num} not found")
            continue

        q = questions[idx]
        new_q, changed, desc = fix_sem3_question(q, q_num, questions)

        if changed:
            pending_changes[idx] = (new_q, desc, new_q.get('ans'), q.get('ans'))
        else:
            print(f"  - Q{q_num}: {desc}")

    if not pending_changes:
        return 0, []

    # Check A6 before applying
    ans_map = {idx: new_q.get('ans') for idx, (new_q, desc, _, _) in pending_changes.items()}
    a6_violation, ans_dist = check_a6_violation(filepath, ans_map)

    fixed_count = 0
    descriptions = []

    if a6_violation:
        print(f"  ⚠️  A6 would be violated: {ans_dist} - applying carefully...")
        # Apply changes one by one, skipping those that cause A6
        for idx, (new_q, desc, new_ans, old_ans) in sorted(pending_changes.items()):
            # Check if this specific change causes A6
            temp_map = {i: nq.get('ans') for i, (nq, _, _, _) in pending_changes.items()}
            # Try without this question
            test_map = {k: v for k, v in temp_map.items()}
            viol, dist = check_a6_violation(filepath, test_map)
            if not viol:
                questions[idx] = new_q
                fixed_count += 1
                descriptions.append(f"Q{idx+1}: {desc}")
                print(f"  ✓ Fixed Q{idx+1}: {desc}")
            else:
                print(f"  ✗ Skipping Q{idx+1} due to A6: {desc} (would make ans={new_ans} count {dist.get(new_ans,0)+1})")
    else:
        for idx, (new_q, desc, new_ans, old_ans) in sorted(pending_changes.items()):
            questions[idx] = new_q
            fixed_count += 1
            descriptions.append(f"Q{idx+1}: {desc}")
            print(f"  ✓ Fixed Q{idx+1}: {desc}")

    if fixed_count > 0:
        data['questions'] = questions
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  → Saved ({fixed_count} fixed)")

    return fixed_count, descriptions


def run_validate(filepath):
    """Run validate.js and return dict with sem3/s error info."""
    full_path = os.path.join(BASE, "data", filepath)
    validate_script = os.path.join(BASE, "validate", "validate.js")

    result = subprocess.run(
        ["node", validate_script, full_path],
        capture_output=True, text=True, cwd=BASE
    )

    output = result.stdout + result.stderr
    sem3_errors = re.findall(r'\[A\] SEM-3[^\n]*', output)
    s_errors = re.findall(r'\[S\][^\n]*', output)

    return {
        'sem3_count': len(sem3_errors),
        'sem3_errors': sem3_errors,
        's_errors': s_errors,
        's_count': len(s_errors),
        'output': output[:500]
    }


# All files to fix
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
    file_results = []

    for filepath, q_nums in FILES_TO_FIX:
        print(f"\n{'='*60}")
        print(f"File: {filepath}")
        print(f"Questions: {q_nums}")

        # Get pre-fix SEM-3 count
        pre = run_validate(filepath)
        pre_sem3 = pre['sem3_count']

        fixed, descs = fix_file(filepath, q_nums)
        total_fixed += fixed

        if fixed > 0:
            # Validate after fix
            post = run_validate(filepath)
            post_sem3 = post['sem3_count']
            new_s = post['s_count']

            if new_s > 0:
                print(f"  🚨 New [S] errors: {new_s}")
                for e in post['s_errors']:
                    print(f"    {e}")
                # Revert
                print(f"  ↩ Reverting due to [S] errors...")
                import subprocess as sp
                sp.run(["git", "checkout", "--", f"data/{filepath}"], cwd=BASE)
                total_fixed -= fixed
                file_results.append({
                    'file': filepath,
                    'status': 'REVERTED',
                    'pre_sem3': pre_sem3,
                    'post_sem3': pre_sem3,
                    'fixed': 0
                })
            else:
                cleared = pre_sem3 - post_sem3
                print(f"  ✅ SEM-3: {pre_sem3} → {post_sem3} (cleared {cleared})")
                file_results.append({
                    'file': filepath,
                    'status': 'OK' if post_sem3 == 0 else 'PARTIAL',
                    'pre_sem3': pre_sem3,
                    'post_sem3': post_sem3,
                    'fixed': fixed
                })
        else:
            file_results.append({
                'file': filepath,
                'status': 'NO_CHANGE',
                'pre_sem3': pre_sem3,
                'post_sem3': pre_sem3,
                'fixed': 0
            })

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"Total questions fixed: {total_fixed}")

    ok = [r for r in file_results if r['status'] == 'OK']
    partial = [r for r in file_results if r['status'] == 'PARTIAL']
    no_change = [r for r in file_results if r['status'] == 'NO_CHANGE']
    reverted = [r for r in file_results if r['status'] == 'REVERTED']

    print(f"Files fully cleared: {len(ok)}")
    print(f"Files partially cleared: {len(partial)}")
    print(f"Files no change: {len(no_change)}")
    print(f"Files reverted: {len(reverted)}")

    if partial or no_change:
        print(f"\nRemaining SEM-3 issues:")
        for r in partial + no_change:
            if r['post_sem3'] > 0:
                print(f"  {r['file']}: {r['post_sem3']} errors")

    return total_fixed, file_results


if __name__ == '__main__':
    main()
