#!/usr/bin/env python3
"""
Fix SEM-3 errors - v5: Comprehensive targeted fix
Handles:
1. Valid combos that keep A6/A7 balanced
2. Cannot-find cases with known correct forms
3. Special cases (blank placeholder, its/it's, etc.)
"""

import json
import re
import subprocess
import os
import copy

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
    return [m.group(1).strip() for m in re.finditer(r'<u>([^<]+)</u>', passage)]


def add_circled_markers(passage, ch_words_raw):
    """Add ①②③④ markers before each <u> in passage, in text order."""
    p = re.sub(r'[①②③④⑤](?=<u>)', '', passage)
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


def strip_all_underlines(passage):
    p = re.sub(r'[①②③④⑤](?=<u>)', '', passage)
    p = re.sub(r'</?u>', '', p)
    return p


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


def save_file(filepath, data):
    full_path = os.path.join(BASE, "data", filepath)
    with open(full_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_file(filepath):
    full_path = os.path.join(BASE, "data", filepath)
    with open(full_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_violations(questions, proposed_changes):
    """Check A6 and A7 violations."""
    from collections import Counter
    answers = []
    for i, q in enumerate(questions):
        a = proposed_changes.get(i, q.get('ans'))
        answers.append(a)

    dist = Counter(a for a in answers if isinstance(a, int) and 1 <= a <= 4)
    a6 = any(v > 5 for v in dist.values())

    a7 = False
    for i in range(len(answers) - 2):
        if answers[i] == answers[i+1] == answers[i+2] and isinstance(answers[i], int):
            a7 = True
            break

    return a6, a7


def reorder_ch_to_text_order(q):
    """
    TypeB fix: reorder ch to match text order of underlines.
    Returns (new_passage, new_ch, new_ans) or None.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1

    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ch_words_lower = [w.lower() for w in ch_words_raw]

    underline_words = get_underline_words_in_order(passage)
    ul_lower = [w.lower() for w in underline_words]

    if len(ul_lower) < 2:
        return None, "fewer than 2 underlines"

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

    pos_to_ch = sorted([(mapping[ci], ci) for ci in range(len(ch_words_lower)) if mapping[ci] != -1])
    unmatched = [ci for ci in range(len(ch_words_lower)) if mapping[ci] == -1]
    new_order = [ci for _, ci in pos_to_ch] + unmatched

    new_ch_raw = [ch_words_raw[new_order[i]] for i in range(len(new_order))]

    new_ans = None
    for new_pos, old_ci in enumerate(new_order):
        if old_ci == ans_idx:
            new_ans = new_pos + 1
            break

    if new_ans is None:
        return None, "cannot find answer in new order"

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
    new_passage = add_circled_markers(passage, new_ch_raw)

    return (new_passage, new_ch, new_ans), f"TypeB reorder, ans={ans}->{new_ans}"


def inject_underline(q, correct_form_in_passage, wrong_form_display, ans_num):
    """
    TypeA fix: replace correct_form with wrong_form in passage, wrap in <u>.
    Returns (new_passage, new_ch, new_ans) or None.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])

    ch_words_raw = [strip_marker_prefix(c) for c in ch]

    # Clean passage (remove markers + underlines)
    clean_passage = strip_all_underlines(passage)
    clean_lower = clean_passage.lower()

    # Find correct_form in clean passage
    cf_lower = correct_form_in_passage.lower()
    idx = clean_lower.find(cf_lower)
    if idx == -1:
        return None, f"cannot find '{correct_form_in_passage}' in passage"

    # Get current underlines positions in clean passage
    existing_underlines = []
    for m in re.finditer(r'<u>([^<]+)</u>', passage):
        word = m.group(1).strip()
        cp = clean_lower.find(word.lower())
        if cp != -1:
            existing_underlines.append((cp, len(word), word))

    # Add new underline
    new_underlines = existing_underlines + [(idx, len(correct_form_in_passage), wrong_form_display)]
    new_underlines.sort(key=lambda x: x[0])

    # Build new passage
    result = ""
    last_end = 0
    for pos, length, display_word in new_underlines:
        result += clean_passage[last_end:pos]
        result += f"<u>{display_word}</u>"
        last_end = pos + length
    result += clean_passage[last_end:]

    # Build new ch in text order
    new_ul_words = [w for _, _, w in new_underlines]

    def normalize(s):
        s = s.lower()
        s = re.sub(r"[^a-z ]", " ", s).strip()
        return re.sub(r'\s+', ' ', s)

    used_ch = set()
    ul_to_ch = {}
    for ul_idx, ul_word in enumerate(new_ul_words):
        ul_norm = normalize(ul_word)
        best_ci = -1
        for ci, cw in enumerate(ch_words_raw):
            if ci in used_ch:
                continue
            cw_norm = normalize(cw)
            if cw_norm == ul_norm or cw_norm in ul_norm or ul_norm in cw_norm:
                best_ci = ci
                break
        if best_ci != -1:
            ul_to_ch[ul_idx] = best_ci
            used_ch.add(best_ci)

    new_ch_raw = []
    new_ans = None
    ans_idx = ans_num - 1
    for ul_idx, ul_word in enumerate(new_ul_words):
        ci = ul_to_ch.get(ul_idx, -1)
        if ci != -1:
            matched = ch_words_raw[ci]
            if ci == ans_idx:
                new_ans = len(new_ch_raw) + 1
        else:
            matched = ul_word
        new_ch_raw.append(matched)

    if new_ans is None:
        new_ans = ans_num  # fallback

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
    new_passage = add_circled_markers(result, new_ch_raw)

    return (new_passage, new_ch, new_ans), f"TypeA inject '{wrong_form_display}' (replacing '{correct_form_in_passage}'), ans->{new_ans}"


# ============================================================
# HAND-CRAFTED FIXES FOR EACH REMAINING CASE
# Each entry: (filepath, q_num_1based, fix_func_or_manual_fix)
# ============================================================

def apply_fixes_to_file(filepath, fixes_dict):
    """
    Apply a dict of {q_idx_0based: (new_passage, new_ch, new_ans)} to a file.
    Validates after. Reverts if new [S] errors appear.
    Returns (fixed_count, pre_sem3, post_sem3).
    """
    pre_sem3, _, pre_s, _ = run_validate(filepath)

    data = load_file(filepath)
    questions = data['questions']

    changed = []
    for q_idx, (new_passage, new_ch, new_ans) in sorted(fixes_dict.items()):
        q = questions[q_idx]
        questions[q_idx] = {**q, 'passage': new_passage, 'ch': new_ch, 'ans': new_ans}
        changed.append(q_idx + 1)

    data['questions'] = questions
    save_file(filepath, data)

    post_sem3, sem3_list, post_s, s_list = run_validate(filepath)

    if post_s > pre_s:
        print(f"  REVERT: new [S] errors ({post_s - pre_s} new): {s_list[:3]}")
        revert_file(filepath)
        return 0, pre_sem3, pre_sem3

    cleared = pre_sem3 - post_sem3
    print(f"  SAVED: Q{changed} fixed. SEM-3: {pre_sem3} → {post_sem3} (cleared {cleared})")
    if post_sem3 > 0:
        for e in sem3_list[:5]:
            print(f"    {e}")
    return len(changed), pre_sem3, post_sem3


def get_type_b_fix(filepath, q_num):
    """Get the TypeB fix for a question."""
    data = load_file(filepath)
    q = data['questions'][q_num - 1]
    result, desc = reorder_ch_to_text_order(q)
    if result:
        return result, desc
    return None, desc


def get_type_a_fix(filepath, q_num, correct_form, wrong_form):
    """Get the TypeA fix for a question."""
    data = load_file(filepath)
    q = data['questions'][q_num - 1]
    result, desc = inject_underline(q, correct_form, wrong_form, q['ans'])
    if result:
        return result, desc
    return None, desc


def main():
    total_fixed = 0
    total_pre = 0
    total_post = 0

    # ============================================================
    # 1. 21강/워크북.json: Apply combo Q9+Q13+Q18+Q19 together
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강/영어/21강/워크북.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    fixes = {}

    # Q9 (idx 8): TypeA - convincing (replace 'convinced' in passage)
    result, desc = inject_underline(questions[8], 'convinced', 'convincing', questions[8]['ans'])
    if result:
        fixes[8] = result
        print(f"  Q9 planned: {desc}")

    # Q13 (idx 12): TypeB - reorder
    result, desc = reorder_ch_to_text_order(questions[12])
    if result:
        fixes[12] = result
        print(f"  Q13 planned: {desc}")

    # Q18 (idx 17): TypeB - reorder
    result, desc = reorder_ch_to_text_order(questions[17])
    if result:
        fixes[17] = result
        print(f"  Q18 planned: {desc}")

    # Q19 (idx 18): TypeB - reorder
    result, desc = reorder_ch_to_text_order(questions[18])
    if result:
        fixes[18] = result
        print(f"  Q19 planned: {desc}")

    # Verify no violations
    proposed = {idx: r[2] for idx, r in fixes.items()}
    a6, a7 = check_violations(questions, proposed)
    print(f"  Violation check: A6={a6}, A7={a7}")

    if not a6 and not a7:
        f, pre, post = apply_fixes_to_file(filepath, fixes)
        total_fixed += f; total_pre += pre; total_post += post
    else:
        print(f"  SKIP: violations detected")
        _, pre_s, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 2. 21강/퀴즈.json: Apply combo Q3+Q18 together
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강/영어/21강/퀴즈.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    fixes = {}

    # Q3 (idx 2): TypeB - reorder
    result, desc = reorder_ch_to_text_order(questions[2])
    if result:
        fixes[2] = result
        print(f"  Q3 planned: {desc}")

    # Q18 (idx 17): TypeB - reorder
    result, desc = reorder_ch_to_text_order(questions[17])
    if result:
        fixes[17] = result
        print(f"  Q18 planned: {desc}")

    proposed = {idx: r[2] for idx, r in fixes.items()}
    a6, a7 = check_violations(questions, proposed)
    print(f"  Violation check: A6={a6}, A7={a7}")

    if not a6 and not a7:
        f, pre, post = apply_fixes_to_file(filepath, fixes)
        total_fixed += f; total_pre += pre; total_post += post
    else:
        print(f"  SKIP: violations detected")
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 3. 6강/2번/퀴즈.json Q6: Replace _____ blank with 'by'
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강/영어/6강/2번/퀴즈.json"
    print(f"Processing: {filepath}")

    pre_sem3, _, pre_s, _ = run_validate(filepath)
    data = load_file(filepath)
    q = data['questions'][5]  # Q6
    passage = q['passage']

    # Replace ④<u>_____</u> with ④<u>by</u>
    new_passage = passage.replace('④<u>_____</u>', '④<u>by</u>')
    if new_passage != passage:
        data['questions'][5] = {**q, 'passage': new_passage}
        save_file(filepath, data)
        post_sem3, _, post_s, s_list = run_validate(filepath)
        if post_s > pre_s:
            print(f"  REVERT: {s_list[:2]}")
            revert_file(filepath)
            total_pre += pre_sem3; total_post += pre_sem3
        else:
            print(f"  SAVED Q6: replaced blank with 'by'. SEM-3: {pre_sem3} → {post_sem3}")
            total_fixed += 1; total_pre += pre_sem3; total_post += post_sem3
    else:
        print(f"  No change needed (blank not found)")
        total_pre += pre_sem3; total_post += pre_sem3

    # ============================================================
    # 4. 2강/2번/워크북.json Q2: 'it's' -> replace 'its' with 'it is'
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강Light/영어/2강/2번/워크북.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    # Q2 (idx 1): TypeA - ch shows '④ it is', passage shows 'its' (correct form)
    # The arrow is: it's -> its, but ch shows 'it is' (expanded form)
    # We need to: find 'its' in passage and replace with 'it is' + <u>
    result, desc = inject_underline(questions[1], 'its', 'it is', questions[1]['ans'])

    if result:
        proposed = {1: result[2]}
        a6, a7 = check_violations(questions, proposed)
        print(f"  Q2 planned: {desc}")
        print(f"  Violation check: A6={a6}, A7={a7}")

        if not a6 and not a7:
            f, pre, post = apply_fixes_to_file(filepath, {1: result})
            total_fixed += f; total_pre += pre; total_post += post
        else:
            print(f"  SKIP: violations")
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s; total_post += pre_s
    else:
        print(f"  Q2 cannot fix: {desc}")
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 5. 3강/3번/퀴즈.json Q3: going (replace 'go ' with 'going')
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강Light/영어/3강/3번/퀴즈.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    # Q3 (idx 2): 'going' is wrong form. Correct form is 'go' (after 'allow')
    # The passage context: 'allow either the criticism or the praise to go to your head'
    # We need to replace 'go ' with 'going' (note trailing space to avoid matching 'going')

    # Find 'go ' in passage with context
    q = questions[2]
    passage = q['passage']
    # Find 'to go ' in passage
    pos = passage.lower().find('to go ')
    if pos != -1:
        correct_form = passage[pos+3:pos+5]  # 'go'
        print(f"  Found 'go' at pos {pos+3}")
        result, desc = inject_underline(q, 'go', 'going', q['ans'])
        if result:
            proposed = {2: result[2]}
            a6, a7 = check_violations(questions, proposed)
            print(f"  Q3 planned: {desc}")
            print(f"  Violation check: A6={a6}, A7={a7}")

            if not a6 and not a7:
                f, pre, post = apply_fixes_to_file(filepath, {2: result})
                total_fixed += f; total_pre += pre; total_post += post
            else:
                print(f"  SKIP: violations")
                pre_s, _, _, _ = run_validate(filepath)
                total_pre += pre_s; total_post += pre_s
        else:
            print(f"  Q3 cannot fix: {desc}")
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s; total_post += pre_s
    else:
        print(f"  Q3: 'go' not found in passage")
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 6. 3강/4번/워크북.json Q2: giving (replace 'give ' with 'giving')
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강Light/영어/3강/4번/워크북.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    # Q2 (idx 1): 'giving' is wrong. Correct is 'give'
    q = questions[1]
    result, desc = inject_underline(q, 'give', 'giving', q['ans'])

    if result:
        proposed = {1: result[2]}
        a6, a7 = check_violations(questions, proposed)
        print(f"  Q2 planned: {desc}")
        print(f"  Violation check: A6={a6}, A7={a7}")

        if not a6 and not a7:
            f, pre, post = apply_fixes_to_file(filepath, {1: result})
            total_fixed += f; total_pre += pre; total_post += post
        else:
            print(f"  SKIP: violations")
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s; total_post += pre_s
    else:
        print(f"  Q2 cannot fix: {desc}")
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 7. 4강/Gateway/워크북.json Q4: to realize (replace 'realizing' with 'to realize')
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강Light/영어/4강/Gateway/워크북.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    # Q4 (idx 3): ch='③ to realize', wrong form. Correct form in passage='realizing'
    q = questions[3]
    result, desc = inject_underline(q, 'realizing', 'to realize', q['ans'])

    if result:
        proposed = {3: result[2]}
        a6, a7 = check_violations(questions, proposed)
        print(f"  Q4 planned: {desc}")
        print(f"  Violation check: A6={a6}, A7={a7}")

        if not a6 and not a7:
            f, pre, post = apply_fixes_to_file(filepath, {3: result})
            total_fixed += f; total_pre += pre; total_post += post
        else:
            print(f"  SKIP: violations")
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s; total_post += pre_s
    else:
        print(f"  Q4 cannot fix: {desc}")
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # 8. 4강/Gateway/퀴즈.json Q1+Q2: realized/became
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강Light/영어/4강/Gateway/퀴즈.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    fixes = {}

    # Q1 (idx 0): 'realized' wrong. Correct='realizing'
    q1 = questions[0]
    result1, desc1 = inject_underline(q1, 'realizing', 'realized', q1['ans'])
    if result1:
        fixes[0] = result1
        print(f"  Q1 planned: {desc1}")
    else:
        print(f"  Q1 cannot fix: {desc1}")

    # Q2 (idx 1): 'became' wrong. Correct='become'
    q2 = questions[1]
    result2, desc2 = inject_underline(q2, 'become', 'became', q2['ans'])
    if result2:
        fixes[1] = result2
        print(f"  Q2 planned: {desc2}")
    else:
        print(f"  Q2 cannot fix: {desc2}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7 = check_violations(questions, proposed)
        print(f"  Violation check: A6={a6}, A7={a7}")

        if not a6 and not a7:
            f, pre, post = apply_fixes_to_file(filepath, fixes)
            total_fixed += f; total_pre += pre; total_post += post
        else:
            # Try individually
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s
            fixed_any = False
            for idx, fix_result in sorted(fixes.items()):
                proposed_single = {idx: fix_result[2]}
                a6s, a7s = check_violations(questions, proposed_single)
                if not a6s and not a7s:
                    fv, pre_v, post_v = apply_fixes_to_file(filepath, {idx: fix_result})
                    total_fixed += fv
                    fixed_any = True
                    # Reload after fix
                    data = load_file(filepath)
                    questions = data['questions']
                    break
            if not fixed_any:
                total_post += pre_s
    else:
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # Check final state
    post_sem3, _, _, _ = run_validate("부교재/수능특강Light/영어/4강/Gateway/퀴즈.json")
    total_post += post_sem3  # Replace whatever was already added

    # ============================================================
    # 9. 6강/1번/워크북.json Q3+Q4: restricting/laid
    # ============================================================
    print("\n" + "="*60)
    filepath = "부교재/수능특강/영어/6강/1번/워크북.json"
    print(f"Processing: {filepath}")

    data = load_file(filepath)
    questions = data['questions']

    fixes = {}

    # Q3 (idx 2): 'restricting' wrong. Correct='to restrict' (found at pos 575 in passage)
    q3 = questions[2]
    result3, desc3 = inject_underline(q3, 'to restrict', 'restricting', q3['ans'])
    if result3:
        fixes[2] = result3
        print(f"  Q3 planned: {desc3}")
    else:
        print(f"  Q3 cannot fix: {desc3}")

    # Q4 (idx 3): 'laid' wrong. Correct='lay' (found in passage)
    q4 = questions[3]
    result4, desc4 = inject_underline(q4, 'lay', 'laid', q4['ans'])
    if result4:
        fixes[3] = result4
        print(f"  Q4 planned: {desc4}")
    else:
        print(f"  Q4 cannot fix: {desc4}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7 = check_violations(questions, proposed)
        print(f"  Violation check: A6={a6}, A7={a7}")

        if not a6 and not a7:
            f, pre, post = apply_fixes_to_file(filepath, fixes)
            total_fixed += f; total_pre += pre; total_post += post
        else:
            pre_s, _, _, _ = run_validate(filepath)
            total_pre += pre_s
            post_so_far = pre_s
            for idx, fix_result in sorted(fixes.items()):
                data = load_file(filepath)
                questions = data['questions']
                proposed_single = {idx: fix_result[2]}
                a6s, a7s = check_violations(questions, proposed_single)
                if not a6s and not a7s:
                    fv, pv, posv = apply_fixes_to_file(filepath, {idx: fix_result})
                    total_fixed += fv
                    post_so_far = posv
            total_post += post_so_far
    else:
        pre_s, _, _, _ = run_validate(filepath)
        total_pre += pre_s; total_post += pre_s

    # ============================================================
    # Count remaining SEM-3 in all target files
    # ============================================================
    print("\n" + "="*60)
    print("FINAL SCAN - Remaining SEM-3 in all target files:")

    all_files = [
        "부교재/수능특강/영어/21강/Gateway/워크북.json",
        "부교재/수능특강/영어/21강/워크북.json",
        "부교재/수능특강/영어/21강/퀴즈.json",
        "부교재/수능특강/영어/22강/Gateway/워크북.json",
        "부교재/수능특강/영어/6강/1번/워크북.json",
        "부교재/수능특강/영어/6강/2번/퀴즈.json",
        "부교재/수능특강/영어/6강/Gateway/워크북.json",
        "부교재/수능특강/영어/8강/4번/퀴즈.json",
        "부교재/수능특강/영어/8강/Gateway/퀴즈.json",
        "부교재/수능특강/영어/8강/퀴즈.json",
        "부교재/수능특강Light/영어/10강/3번/워크북.json",
        "부교재/수능특강Light/영어/10강/3번/퀴즈.json",
        "부교재/수능특강Light/영어/11강/4번/퀴즈.json",
        "부교재/수능특강Light/영어/16강/Gateway/워크북.json",
        "부교재/수능특강Light/영어/17강/4번/워크북.json",
        "부교재/수능특강Light/영어/2강/1번/워크북.json",
        "부교재/수능특강Light/영어/2강/1번/퀴즈.json",
        "부교재/수능특강Light/영어/2강/2번/워크북.json",
        "부교재/수능특강Light/영어/2강/3번/워크북.json",
        "부교재/수능특강Light/영어/2강/Gateway/워크북.json",
        "부교재/수능특강Light/영어/3강/1번/퀴즈.json",
        "부교재/수능특강Light/영어/3강/3번/워크북.json",
        "부교재/수능특강Light/영어/3강/3번/퀴즈.json",
        "부교재/수능특강Light/영어/3강/4번/워크북.json",
        "부교재/수능특강Light/영어/3강/Gateway/퀴즈.json",
        "부교재/수능특강Light/영어/4강/2번/워크북.json",
        "부교재/수능특강Light/영어/4강/4번/워크북.json",
        "부교재/수능특강Light/영어/4강/Gateway/워크북.json",
        "부교재/수능특강Light/영어/4강/Gateway/퀴즈.json",
        "부교재/수능특강Light/영어/5강/Gateway/워크북.json",
    ]

    grand_total_sem3 = 0
    for fp in all_files:
        count, _, _, _ = run_validate(fp)
        if count > 0:
            print(f"  {fp}: {count}")
            grand_total_sem3 += count

    print(f"\nTotal remaining SEM-3 in target files: {grand_total_sem3}")
    print(f"Questions fixed this run: {total_fixed}")


if __name__ == '__main__':
    main()
