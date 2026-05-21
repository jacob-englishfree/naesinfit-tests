#!/usr/bin/env python3
"""
Fix SEM-3 errors: 어법 ch[] doesn't match passage underlines.
v4: Definitive solution

SEM-3 has two sub-types:
A) "정답 ch[N]='X'가 passage 밑줄에 없음" — answer word not in passage underlines
   Fix: find the CORRECT form in passage (from det arrows), replace with WRONG form, wrap in <u>

B) "어법 ch[] 순서가 passage <u> 밑줄 출현 순서와 불일치" — order mismatch
   Fix: reorder ch to match text order, update ans accordingly
   BUT: must avoid A6 ([S]) and A7 ([S]) violations

Strategy:
1. For each file, analyze ALL questions to fix TOGETHER
2. For Type A: directly add the missing underline (replace correct→wrong form)
3. For Type B: reorder ch+ans to match text order
4. After all changes planned: check for A6/A7 violations
5. If violations: try partial fixes, then accept remaining SEM-3s with note
6. After saving: run validate to confirm no new [S] errors; revert if any

Key improvement: improved arrow extraction handles multi-word forms
"""

import json
import re
import sys
import subprocess
import os
import copy
import itertools

BASE = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"

CIRCLE_LIST = ['①', '②', '③', '④', '⑤']
CIRCLE_MAP = {i+1: c for i, c in enumerate(CIRCLE_LIST)}
CIRCLE_REVERSE = {c: i+1 for i, c in enumerate(CIRCLE_LIST)}


def strip_marker_prefix(s):
    s = (s or '').strip()
    if s and s[0] in CIRCLE_REVERSE:
        return s[1:].strip()
    return s


def get_underline_words_in_order(passage):
    """Returns list of underlined words in text order (just the words, stripped)."""
    return [m.group(1).strip() for m in re.finditer(r'<u>([^<]+)</u>', passage)]


def extract_arrows(det_analysis):
    """
    Extract (wrong_form, correct_form) from det.analysis.
    Handles:
    - '✅ ① engaged → engaging: report + ~ing'
    - '❌② to take → taking:'
    - 'behaviors: 설명. behaviors → behavior.'
    - 'tend being → tend to be.'
    - 'considering → to consider.'
    - '✅ ③ saying → say — 지각동사'

    Returns list of (wrong_lower, correct_lower).
    """
    if not det_analysis:
        return []

    # Remove markers (①②③④⑤) and ❌✅ to simplify
    clean = re.sub(r'[①②③④⑤❌✅]\s*', ' ', det_analysis)

    pairs = []
    for m in re.finditer(r'→', clean):
        pos = m.start()

        # Extract wrong form: look back from →
        before = clean[:pos].rstrip()
        words_before = re.split(r'[\n.;]+', before)
        last_segment = words_before[-1].strip() if words_before else ''
        last_words = last_segment.split()
        # Take last 1-3 English words (skip Korean/non-English)
        eng_words = []
        for w in reversed(last_words):
            if re.match(r"[a-zA-Z']+$", w):
                eng_words.insert(0, w)
                if len(eng_words) >= 3:
                    break
            else:
                break
        wrong = ' '.join(eng_words).strip()

        # Extract correct form: look forward from →
        after = clean[pos+1:].lstrip()
        words_after = re.split(r'[\s]+', after)
        correct_words = []
        for w in words_after:
            # Strip trailing colon/period/comma from word
            clean_w = w.rstrip(':.,(')
            if not clean_w:
                break
            english_part = re.match(r"[a-zA-Z']+", clean_w)
            if english_part:
                correct_words.append(english_part.group())
                # If original word had colon/paren after it, stop here (explanation follows)
                if ':' in w or '(' in w:
                    break
                if len(correct_words) >= 3:
                    break
            else:
                break  # Non-English character (em-dash, Korean, etc.) → stop
        correct = ' '.join(correct_words).strip()

        if wrong and correct and len(wrong) >= 1 and len(correct) >= 1:
            pairs.append((wrong.lower(), correct.lower()))

    return pairs


def find_word_in_passage(word_lower, passage_clean, passage_clean_lower):
    """
    Find a word/phrase in passage and return (start, end, actual_text) or None.
    Tries exact match with word boundaries.
    The found range covers the minimum needed to replace with word_lower.
    """
    # Try exact phrase match
    idx = passage_clean_lower.find(word_lower)
    if idx != -1:
        return idx, idx + len(word_lower), passage_clean[idx:idx + len(word_lower)]
    return None


def find_correct_form_in_passage(ans_word_lower, arrows, passage_clean, passage_clean_lower):
    """
    Find the correct form (to replace with wrong form ans_word_lower) in passage.
    Uses arrows to find what correct form to look for.
    Returns (start, end, actual_text) or None.
    """
    # Build set of correct forms to search
    correct_forms = []
    for wrong, correct in arrows:
        if wrong == ans_word_lower or wrong in ans_word_lower or ans_word_lower in wrong:
            correct_forms.append(correct)

    # Try each correct form
    for cf in correct_forms:
        result = find_word_in_passage(cf, passage_clean, passage_clean_lower)
        if result:
            return result, cf

    # Try direct search for ans_word
    result = find_word_in_passage(ans_word_lower, passage_clean, passage_clean_lower)
    if result:
        return result, ans_word_lower

    # Try root matching (for inflections)
    # Find longest common prefix >= 4 chars
    root = None
    for wrong, correct in arrows:
        if wrong == ans_word_lower or wrong in ans_word_lower or ans_word_lower in wrong:
            # Common prefix
            min_len = min(len(ans_word_lower), len(correct))
            for i in range(min(min_len, 4), 0, -1):
                if ans_word_lower[:i] == correct[:i]:
                    root = correct[:i]
                    break
            if root:
                break

    if root and len(root) >= 4:
        for m in re.finditer(re.escape(root), passage_clean_lower):
            # Get full word at this position
            start = m.start()
            end = m.end()
            while end < len(passage_clean) and (passage_clean[end].isalpha() or passage_clean[end] in "'"):
                end += 1
            actual = passage_clean[start:end]
            return (start, end, actual), actual.lower()

    return None, None


def get_clean_passage(passage):
    """Strip all marker prefixes (①②③④) but keep <u> tags."""
    # Remove ①②③④ immediately before <u>
    return re.sub(r'[①②③④⑤](?=<u>)', '', passage)


def strip_all_underlines(passage):
    """Remove <u> tags and ①②③④ markers, returning clean text."""
    p = re.sub(r'[①②③④⑤](?=<u>)', '', passage)
    p = re.sub(r'</?u>', '', p)
    return p


def build_passage_with_underlines(clean_text, underline_specs):
    """
    Build passage with underlines.
    underline_specs: list of (position, length, display_word) sorted by position ascending.
    Returns new passage string.
    """
    result = ""
    last_end = 0
    for pos, length, display_word in sorted(underline_specs, key=lambda x: x[0]):
        result += clean_text[last_end:pos]
        result += f"<u>{display_word}</u>"
        last_end = pos + length
    result += clean_text[last_end:]
    return result


def add_circled_markers(passage, ch_words_raw):
    """
    Add ①②③④ markers before each <u> in passage, in text order.
    Assumes <u> tags appear in the same order as ch_words_raw.
    """
    # Remove existing markers
    p = re.sub(r'[①②③④⑤](?=<u>)', '', passage)

    marker_idx = [0]
    def replace_with_marker(m):
        i = marker_idx[0]
        if i < len(CIRCLE_MAP):
            marker_idx[0] += 1
            return CIRCLE_MAP[i + 1] + m.group(0)  # Wait, i+1 because CIRCLE_MAP is 1-indexed
        return m.group(0)

    # Simple approach: split on <u> and add markers
    parts = re.split(r'(<u>[^<]+</u>)', p)
    mi = 0
    new_parts = []
    for part in parts:
        if part.startswith('<u>'):
            if mi + 1 in CIRCLE_MAP:
                new_parts.append(CIRCLE_MAP[mi + 1] + part)
            else:
                new_parts.append(part)
            mi += 1
        else:
            new_parts.append(part)
    return ''.join(new_parts)


def compute_ans_distribution(questions, proposed_changes):
    """
    Compute ans distribution after applying proposed_changes.
    proposed_changes: dict of {q_idx: new_ans}
    Returns {1:count, 2:count, 3:count, 4:count}
    """
    dist = {1: 0, 2: 0, 3: 0, 4: 0}
    for i, q in enumerate(questions):
        a = proposed_changes.get(i, q.get('ans'))
        if isinstance(a, int) and 1 <= a <= 4:
            dist[a] += 1
    return dist


def check_violations(questions, proposed_changes):
    """Check for A6 (>5 same) and A7 (3+ consecutive same) violations."""
    dist = compute_ans_distribution(questions, proposed_changes)

    # A6: any answer > 5
    a6 = any(v > 5 for v in dist.values())

    # A7: 3+ consecutive same answer
    answers = [proposed_changes.get(i, q.get('ans')) for i, q in enumerate(questions)]
    a7 = False
    for i in range(len(answers) - 2):
        if answers[i] == answers[i+1] == answers[i+2] and isinstance(answers[i], int):
            a7 = True
            break

    return a6, a7, dist


def fix_sem3_question_type_a(q, ans_idx):
    """
    Fix Type A: answer word not in passage underlines.
    Find the correct form in passage and replace with wrong form.
    Returns (new_passage, new_ch, new_ans) or None if cannot fix.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    det = q.get('det', {})

    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ans_word = ch_words_raw[ans_idx]
    ans_word_lower = ans_word.lower()

    # Extract arrows from det.analysis
    arrows = extract_arrows(det.get('analysis', ''))

    # Build clean passage for searching
    clean_passage = strip_all_underlines(passage)
    clean_lower = clean_passage.lower()

    target_start = -1
    target_len = 0
    target_actual = None

    result_tuple, found_form = find_correct_form_in_passage(ans_word_lower, arrows, clean_passage, clean_lower)
    if result_tuple:
        target_start, target_end, target_actual = result_tuple
        target_len = target_end - target_start

    if target_start == -1:
        return None, f"Type A: cannot find '{ans_word}' (arrows: {arrows}) in passage"

    # Get current underlines and their positions in clean passage
    existing_underlines = []
    for m in re.finditer(r'<u>([^<]+)</u>', passage):
        # Find position of this word in clean passage
        word = m.group(1).strip()
        cp = clean_lower.find(word.lower())
        if cp != -1:
            existing_underlines.append((cp, len(word), word))

    # Add the new underline (wrong form replaces correct form)
    new_underlines = existing_underlines + [(target_start, target_len, ans_word)]

    # Sort by text position
    new_underlines.sort(key=lambda x: x[0])

    # Build new passage
    new_passage = build_passage_with_underlines(clean_passage, new_underlines)

    # New ch: ordered by text position of underlined words
    new_ul_words = [w for _, _, w in new_underlines]

    # Map old ch words to new positions
    # The underlined words in text order are now new_ul_words
    # We need to construct new_ch matching this order

    # Build a 1-1 mapping: ul_position -> old ch_index
    old_ch_lower = [w.lower() for w in ch_words_raw]

    def normalize_for_match(s):
        """Normalize contractions and punctuation for comparison."""
        s = s.lower()
        contractions = {"couldn't": "could not", "wouldn't": "would not",
                        "didn't": "did not", "doesn't": "does not",
                        "isn't": "is not", "aren't": "are not",
                        "wasn't": "was not", "weren't": "were not",
                        "hadn't": "had not", "haven't": "have not",
                        "shouldn't": "should not", "won't": "will not",
                        "can't": "cannot", "it's": "it is", "i'm": "i am"}
        for cont, exp in contractions.items():
            s = s.replace(cont, exp)
        return re.sub(r"[^a-z ]", "", s).strip()

    used_ch = set()
    ul_to_ch = {}
    for ul_idx, ul_word in enumerate(new_ul_words):
        ul_norm = normalize_for_match(ul_word)
        best_ci = -1
        for ci, cw in enumerate(ch_words_raw):
            if ci in used_ch:
                continue
            cw_norm = normalize_for_match(cw)
            if cw_norm == ul_norm or cw_norm in ul_norm or ul_norm in cw_norm:
                best_ci = ci
                break
        if best_ci != -1:
            ul_to_ch[ul_idx] = best_ci
            used_ch.add(best_ci)

    new_ch_raw = []
    new_ans = None
    for ul_idx, ul_word in enumerate(new_ul_words):
        ci = ul_to_ch.get(ul_idx, -1)
        if ci != -1:
            matched = ch_words_raw[ci]  # Use original ch word
            if ci == ans_idx:
                new_ans = len(new_ch_raw) + 1
        else:
            matched = ul_word  # Fallback to underline word
        new_ch_raw.append(matched)

    if new_ans is None:
        new_ans = ans_idx + 1  # fallback

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
    new_passage = add_circled_markers(new_passage, new_ch_raw)

    return (new_passage, new_ch, new_ans), f"TypeA: replaced correct form with '{ans_word}', new ans={new_ans}"


def fix_sem3_question_type_b(q, ans_idx):
    """
    Fix Type B: order mismatch.
    Reorder ch to match text appearance order of underlines.
    Returns (new_passage, new_ch, new_ans) or None.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])

    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ch_words_lower = [w.lower() for w in ch_words_raw]

    # Get underlines in text order
    underline_words_in_order = get_underline_words_in_order(passage)
    ul_lower = [w.lower() for w in underline_words_in_order]

    if len(ul_lower) < 2:
        return None, "Type B: fewer than 2 underlines"

    # Match ch words to underline positions
    used = set()
    mapping = [-1] * len(ch_words_lower)

    for ci, cw in enumerate(ch_words_lower):
        for pi, pw in enumerate(ul_lower):
            if pi not in used and pw == cw:
                mapping[ci] = pi
                used.add(pi)
                break

    for ci, cw in enumerate(ch_words_lower):
        if mapping[ci] != -1:
            continue
        for pi, pw in enumerate(ul_lower):
            if pi not in used and (pw in cw or cw in pw):
                mapping[ci] = pi
                used.add(pi)
                break

    # Build new ch order: text-position order
    pos_to_ch = sorted([(mapping[ci], ci) for ci in range(len(ch_words_lower)) if mapping[ci] != -1])
    unmatched = [ci for ci in range(len(ch_words_lower)) if mapping[ci] == -1]

    new_order = [ci for _, ci in pos_to_ch] + unmatched
    new_ch_raw = [ch_words_raw[new_order[i]] for i in range(len(new_order))]

    # Find new ans
    new_ans = None
    for new_pos, old_ci in enumerate(new_order):
        if old_ci == ans_idx:
            new_ans = new_pos + 1
            break

    if new_ans is None:
        return None, "Type B: cannot find answer in new order"

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]

    # Renumber passage markers to match new order
    new_passage = add_circled_markers(passage, new_ch_raw)

    return (new_passage, new_ch, new_ans), f"TypeB: reordered ch, new ans={new_ans}"


def analyze_question_sem3(q, q_num):
    """
    Analyze a question for SEM-3 issues.
    Returns list of issue types: 'missing_answer', 'order_mismatch', or []
    """
    grammar_types = {'어법', '어법 빈칸', '어법 밑줄형', '어법 빈칸형', '어법 5지선다'}
    if q.get('type') not in grammar_types:
        return []

    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)

    if not ch or not passage:
        return []

    ch_words_lower = [strip_marker_prefix(c).lower() for c in ch]
    ul_lower = [w.lower() for w in get_underline_words_in_order(passage)]

    if len(ul_lower) < 2:
        return []

    # Match
    used = set()
    mapping = [-1] * len(ch_words_lower)

    for ci, cw in enumerate(ch_words_lower):
        for pi, pw in enumerate(ul_lower):
            if pi not in used and pw == cw:
                mapping[ci] = pi
                used.add(pi)
                break

    for ci, cw in enumerate(ch_words_lower):
        if mapping[ci] != -1:
            continue
        for pi, pw in enumerate(ul_lower):
            if pi not in used and (pw in cw or cw in pw):
                mapping[ci] = pi
                used.add(pi)
                break

    issues = []

    # Check order
    matched_pos = [mapping[i] for i in range(len(ch_words_lower)) if mapping[i] != -1]
    if len(matched_pos) >= 2:
        if any(matched_pos[j] >= matched_pos[j+1] for j in range(len(matched_pos)-1)):
            issues.append('order_mismatch')

    # Check answer
    ans_idx = ans - 1
    if ans_idx < len(mapping) and mapping[ans_idx] == -1:
        issues.append('missing_answer')

    return issues


def fix_file(filepath, question_indices):
    """
    Fix SEM-3 errors in specific questions of a file.
    Applies all changes together to check A6/A7.
    Returns (fixed_count, descriptions).
    """
    full_path = os.path.join(BASE, "data", filepath)

    if not os.path.exists(full_path):
        print(f"  ERROR: File not found: {full_path}")
        return 0, []

    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])

    # Plan all changes first
    planned_changes = {}  # q_idx -> (new_q, desc)

    for q_num in question_indices:
        idx = q_num - 1
        if idx >= len(questions):
            print(f"  WARNING: Q{q_num} not found")
            continue

        q = questions[idx]
        issues = analyze_question_sem3(q, q_num)

        if not issues:
            print(f"  - Q{q_num}: already correct or not applicable")
            continue

        ans_idx = q['ans'] - 1

        if 'missing_answer' in issues:
            result, desc = fix_sem3_question_type_a(q, ans_idx)
        elif 'order_mismatch' in issues:
            result, desc = fix_sem3_question_type_b(q, ans_idx)
        else:
            result, desc = None, "unknown issue"

        if result:
            new_passage, new_ch, new_ans = result
            new_q = copy.deepcopy(q)
            new_q['passage'] = new_passage
            new_q['ch'] = new_ch
            new_q['ans'] = new_ans
            planned_changes[idx] = (new_q, desc)
        else:
            print(f"  - Q{q_num}: {desc}")

    if not planned_changes:
        return 0, []

    # Check violations with ALL planned changes
    proposed_ans = {idx: new_q['ans'] for idx, (new_q, _) in planned_changes.items()}
    a6, a7, dist = check_violations(questions, proposed_ans)

    descriptions = []

    if a6 or a7:
        print(f"  ⚠️  Violations detected (A6={a6}, A7={a7}): {dist}")
        print(f"     Applying subset that doesn't violate...")

        # Try applying changes one at a time, keeping those that don't violate
        applied = {}
        for idx in sorted(planned_changes.keys()):
            new_q, desc = planned_changes[idx]
            # Test this change
            test_applied = {**applied, idx: new_q['ans']}
            a6t, a7t, _ = check_violations(questions, test_applied)
            if not a6t and not a7t:
                applied[idx] = new_q['ans']
                questions[idx] = new_q
                descriptions.append(f"Q{idx+1}: {desc}")
                print(f"  ✓ Fixed Q{idx+1}: {desc}")
            else:
                print(f"  ✗ Skip Q{idx+1}: would cause A6={a6t}/A7={a7t}: {desc}")

        fixed_count = len(applied)
    else:
        # Apply all changes
        for idx, (new_q, desc) in sorted(planned_changes.items()):
            questions[idx] = new_q
            descriptions.append(f"Q{idx+1}: {desc}")
            print(f"  ✓ Fixed Q{idx+1}: {desc}")
        fixed_count = len(planned_changes)

    if fixed_count > 0:
        data['questions'] = questions
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  → Saved ({fixed_count} questions fixed)")

    return fixed_count, descriptions


def run_validate(filepath):
    full_path = os.path.join(BASE, "data", filepath)
    result = subprocess.run(
        ["node", "validate/validate.js", full_path],
        capture_output=True, text=True, cwd=BASE
    )
    output = result.stdout + result.stderr
    sem3 = re.findall(r'\[A\] SEM-3[^\n]*', output)
    s_errs = re.findall(r'\[S\][^\n]*', output)
    return len(sem3), sem3, len(s_errs), s_errs


def revert_file(filepath):
    subprocess.run(
        ["git", "checkout", "--", f"data/{filepath}"],
        cwd=BASE, capture_output=True
    )


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
    summary = []

    for filepath, q_nums in FILES_TO_FIX:
        print(f"\n{'='*60}")
        print(f"File: {filepath}")
        print(f"Target Qs: {q_nums}")

        pre_sem3, _, pre_s, _ = run_validate(filepath)

        fixed, descs = fix_file(filepath, q_nums)

        if fixed > 0:
            post_sem3, sem3_list, post_s, s_list = run_validate(filepath)

            if post_s > pre_s:
                print(f"  🚨 New [S] errors ({post_s - pre_s} new):")
                for e in s_list:
                    print(f"    {e}")
                print(f"  ↩ Reverting...")
                revert_file(filepath)
                total_fixed -= fixed  # don't count
                summary.append({'file': filepath, 'status': 'REVERTED', 'pre': pre_sem3, 'post': pre_sem3, 'fixed': 0})
            else:
                total_fixed += fixed
                cleared = pre_sem3 - post_sem3
                status = 'CLEAR' if post_sem3 == 0 else 'PARTIAL'
                print(f"  {'✅' if post_sem3 == 0 else '⚠️ '} SEM-3: {pre_sem3} → {post_sem3} (cleared {cleared})")
                if post_sem3 > 0:
                    for e in sem3_list:
                        print(f"    {e}")
                summary.append({'file': filepath, 'status': status, 'pre': pre_sem3, 'post': post_sem3, 'fixed': fixed})
        else:
            summary.append({'file': filepath, 'status': 'NO_CHANGE', 'pre': pre_sem3, 'post': pre_sem3, 'fixed': 0})

    print(f"\n{'='*60}")
    print(f"FINAL SUMMARY")
    print(f"Total questions fixed: {total_fixed}")

    cleared = [r for r in summary if r['status'] == 'CLEAR']
    partial = [r for r in summary if r['status'] == 'PARTIAL']
    no_change = [r for r in summary if r['status'] == 'NO_CHANGE']
    reverted = [r for r in summary if r['status'] == 'REVERTED']

    print(f"Files fully cleared: {len(cleared)}/{len(FILES_TO_FIX)}")
    print(f"Files partially cleared: {len(partial)}")
    print(f"Files no change: {len(no_change)}")
    print(f"Files reverted: {len(reverted)}")

    total_pre = sum(r['pre'] for r in summary)
    total_post = sum(r['post'] for r in summary)
    print(f"Total SEM-3 errors: {total_pre} → {total_post} (cleared {total_pre - total_post})")

    if partial or no_change:
        print(f"\nRemaining SEM-3 ({sum(r['post'] for r in partial + no_change)}):")
        for r in partial + no_change:
            if r['post'] > 0:
                print(f"  {r['file']}: {r['post']} errors")

    return total_fixed, summary


if __name__ == '__main__':
    main()
