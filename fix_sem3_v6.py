#!/usr/bin/env python3
"""
Fix SEM-3 errors - v6: Final comprehensive fix
Uses MC-only A7 check (written questions with ans=0 excluded).
Handles all remaining cases with specific known fixes.
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


def check_mc_violations(questions, proposed_changes):
    """
    Check A6 and A7 violations using MC-only filter.
    Written questions (ans=0 or non-int) are excluded.
    """
    from collections import Counter
    mc_ans = []
    for i, q in enumerate(questions):
        a = proposed_changes.get(i, q.get('ans'))
        if isinstance(a, int) and 1 <= a <= 4:
            mc_ans.append(a)

    dist = Counter(mc_ans)
    a6 = any(v > 5 for v in dist.values())
    a7 = any(mc_ans[i] == mc_ans[i+1] == mc_ans[i+2] for i in range(len(mc_ans) - 2))

    return a6, a7, dict(dist)


def inject_underline(q, correct_form_in_passage, wrong_form_display, search_start=0):
    """
    TypeA fix: replace correct_form with wrong_form in passage, wrap in <u>.
    search_start: minimum position in clean passage to start searching (to avoid wrong occurrences).
    Returns (new_passage, new_ch, new_ans) or None.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1

    ch_words_raw = [strip_marker_prefix(c) for c in ch]

    clean_passage = strip_all_underlines(passage)
    clean_lower = clean_passage.lower()

    cf_lower = correct_form_in_passage.lower()
    idx = clean_lower.find(cf_lower, search_start)
    if idx == -1:
        return None, f"cannot find '{correct_form_in_passage}' (from pos {search_start}) in passage"

    existing_underlines = []
    for m in re.finditer(r'<u>([^<]+)</u>', passage):
        word = m.group(1).strip()
        cp = clean_lower.find(word.lower())
        if cp != -1:
            existing_underlines.append((cp, len(word), word))

    new_underlines = existing_underlines + [(idx, len(correct_form_in_passage), wrong_form_display)]
    new_underlines.sort(key=lambda x: x[0])

    result = ""
    last_end = 0
    for pos, length, display_word in new_underlines:
        result += clean_passage[last_end:pos]
        result += f"<u>{display_word}</u>"
        last_end = pos + length
    result += clean_passage[last_end:]

    new_ul_words = [w for _, _, w in new_underlines]

    def normalize(s):
        s = s.lower()
        contractions = {
            "haven't": "have not", "hasn't": "has not", "can't": "cannot",
            "couldn't": "could not", "wouldn't": "would not", "didn't": "did not",
            "doesn't": "does not", "isn't": "is not", "aren't": "are not",
            "wasn't": "was not", "weren't": "were not", "hadn't": "had not",
            "shouldn't": "should not", "won't": "will not", "it's": "it is",
            "i'm": "i am", "i've": "i have", "i'll": "i will", "i'd": "i would",
        }
        for cont, exp in contractions.items():
            s = s.replace(cont, exp)
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
        new_ans = ans

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
    new_passage = add_circled_markers(result, new_ch_raw)

    return (new_passage, new_ch, new_ans), f"TypeA inject '{wrong_form_display}' (replacing '{correct_form_in_passage}'), ans->{new_ans}"


def reorder_ch_to_text_order(q):
    """TypeB fix: reorder ch to match text order of underlines."""
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1

    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    ch_words_lower = [w.lower() for w in ch_words_raw]

    underline_words = [m.group(1).strip() for m in re.finditer(r'<u>([^<]+)</u>', passage)]
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


def apply_fixes(filepath, fixes_dict, label=""):
    """
    Apply fixes to a file. Validates after. Reverts if new [S] errors.
    fixes_dict: {q_idx_0based: (new_passage, new_ch, new_ans)}
    Returns (fixed_count, pre_sem3, post_sem3).
    """
    pre_sem3, _, pre_s, _ = run_validate(filepath)

    data = load_file(filepath)
    questions = data['questions']

    for q_idx, (new_passage, new_ch, new_ans) in sorted(fixes_dict.items()):
        q = questions[q_idx]
        questions[q_idx] = {**q, 'passage': new_passage, 'ch': new_ch, 'ans': new_ans}

    data['questions'] = questions
    save_file(filepath, data)

    post_sem3, sem3_list, post_s, s_list = run_validate(filepath)

    if post_s > pre_s:
        print(f"  REVERT{label}: new [S] errors: {s_list[:3]}")
        revert_file(filepath)
        return 0, pre_sem3, pre_sem3

    changed_qs = [q_idx + 1 for q_idx in sorted(fixes_dict.keys())]
    cleared = pre_sem3 - post_sem3
    print(f"  SAVED{label}: Q{changed_qs} fixed. SEM-3: {pre_sem3} → {post_sem3} (cleared {cleared})")
    if post_sem3 > 0:
        for e in sem3_list[:3]:
            print(f"    {e}")
    return len(fixes_dict), pre_sem3, post_sem3


def main():
    total_fixed = 0

    # ============================================================
    # 1. 21강/퀴즈.json: Q2+Q3+Q6 TypeB combo (cyclic swap)
    #    Q2: 3->4, Q3: 4->2, Q6: 2->3
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강/영어/21강/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    for q_num, desc in [(2, "Q2"), (3, "Q3"), (6, "Q6")]:
        result, d = reorder_ch_to_text_order(qs[q_num - 1])
        if result:
            fixes[q_num - 1] = result
            print(f"  {desc} planned: {d}")

    proposed = {idx: r[2] for idx, r in fixes.items()}
    a6, a7, dist = check_mc_violations(qs, proposed)
    print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
    if not a6 and not a7:
        f, pre, post = apply_fixes(fp, fixes)
        total_fixed += f

    # ============================================================
    # 2. 3강/1번/퀴즈.json: Q1(saying) + Q3(losing)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/1번/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: saying (wrong). Correct in passage = 'say' (after allow to say/let go)
    r1, d1 = inject_underline(qs[0], 'say', 'saying')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")
    # Q3: losing (wrong). Correct in passage = 'lost' or 'lose'
    # Let's check
    q3_pass = strip_all_underlines(qs[2]['passage'])
    for cw in ['lose ', 'lost ']:
        pos = q3_pass.lower().find(cw)
        if pos != -1:
            print(f"  Q3: found '{cw.strip()}' in passage at {pos}")
            r3, d3 = inject_underline(qs[2], cw.strip(), 'losing')
            if r3:
                fixes[2] = r3
                print(f"  Q3 planned: {d3}")
            break

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            print(f"  SKIP: violations")

    # ============================================================
    # 3. 3강/3번/워크북.json: Q1(to make), Q2(which), Q4(that)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/3번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: 'to make' wrong. det says 'to make → for making' so correct form = 'for making'
    q1 = qs[0]
    q1_clean = strip_all_underlines(q1['passage'])
    # Look for 'for making' first (correct form from det)
    if 'for making' in q1_clean.lower():
        print(f"  Q1: found 'for making' in passage")
        r, d = inject_underline(q1, 'for making', 'to make')
        if r:
            fixes[0] = r
            print(f"  Q1 planned: {d}")
    else:
        for cw in ['to make', 'make ', 'makes ']:
            pos = q1_clean.lower().find(cw)
            if pos != -1:
                print(f"  Q1: found '{cw.strip()}' at {pos}")
                r, d = inject_underline(q1, cw.strip(), 'to make')
                if r:
                    fixes[0] = r
                    print(f"  Q1 planned: {d}")
                break

    # Q2: 'which' wrong. Look for 'that' or 'where' in passage
    q2 = qs[1]
    det2 = q2.get('det', {}).get('analysis', '')
    print(f"  Q2 det: {det2[:200]}")
    q2_clean = strip_all_underlines(q2['passage'])
    # find what the correct form should be from det
    # look for arrow in det
    for cw in ['where', 'that']:
        pos = q2_clean.lower().find(cw)
        if pos != -1:
            # Need to find the one that matches context - try first occurrence
            r, d = inject_underline(q2, cw, 'which')
            if r and r[2] == q2['ans']:  # ans position should stay same
                fixes[1] = r
                print(f"  Q2 planned: {d}")
                break
            elif r:
                fixes[1] = r
                print(f"  Q2 planned (ans changed): {d}")
                break

    # Q4: 'that' wrong. Look for 'what' in passage
    q4 = qs[3]
    det4 = q4.get('det', {}).get('analysis', '')
    print(f"  Q4 det: {det4[:200]}")
    q4_clean = strip_all_underlines(q4['passage'])
    for cw in ['what', 'which']:
        pos = q4_clean.lower().find(cw)
        if pos != -1:
            r, d = inject_underline(q4, cw, 'that')
            if r:
                fixes[3] = r
                print(f"  Q4 planned: {d}")
                break

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            # Try subsets
            from itertools import combinations
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo}, f" (subset {[i+1 for i in combo]})")
                        total_fixed += fv
                        break
                else:
                    continue
                break
            else:
                print("  SKIP: no valid subset")

    # ============================================================
    # 4. 3강/Gateway/퀴즈.json: Q3(what -> ans=2)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/Gateway/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q3 = qs[2]
    det3 = q3.get('det', {}).get('analysis', '')
    print(f"  Q3 det: {det3[:200]}")
    q3_clean = strip_all_underlines(q3['passage'])
    print(f"  Q3 ch: {q3['ch']}")
    ul3 = re.findall(r'<u>([^<]+)</u>', q3['passage'])
    print(f"  Q3 underlines: {ul3}")

    # 'what' is wrong form. Look for 'that' or 'which' in passage
    for cw in ['that', 'which', 'where']:
        r, d = inject_underline(q3, cw, 'what')
        if r:
            proposed = {2: r[2]}
            a6, a7, dist = check_mc_violations(qs, proposed)
            print(f"  Q3 planned '{cw}'->'what': {d}, MC violations: A6={a6}, A7={a7}")
            if not a6 and not a7:
                f, pre, post = apply_fixes(fp, {2: r})
                total_fixed += f
                break
    else:
        print("  Q3: no valid fix found")

    # ============================================================
    # 5. 3강/3번/퀴즈.json: Q3(going) - inject 'go' -> 'going'
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/3번/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q3 = qs[2]
    q3_clean = strip_all_underlines(q3['passage'])
    ul3 = re.findall(r'<u>([^<]+)</u>', q3['passage'])
    print(f"  Q3 underlines: {ul3}")

    # 'allow ... to go' -- find 'go' (word boundary)
    # We need to find 'go' that appears AFTER 'allow' in passage
    allow_pos = q3_clean.lower().find('allow')
    if allow_pos != -1:
        # Find 'go' after allow
        go_pos = q3_clean.lower().find(' go ', allow_pos)
        if go_pos != -1:
            print(f"  Found ' go ' after 'allow' at {go_pos+1}")
            r, d = inject_underline(q3, 'go', 'going', search_start=allow_pos)
            if r:
                proposed = {2: r[2]}
                a6, a7, dist = check_mc_violations(qs, proposed)
                print(f"  Q3 planned: {d}, MC violations: A6={a6}, A7={a7}")
                if not a6 and not a7:
                    f, pre, post = apply_fixes(fp, {2: r})
                    total_fixed += f
                else:
                    print(f"  SKIP: violations")
        else:
            print("  Q3: 'go' not found after allow")

    # ============================================================
    # 6. 3강/4번/워크북.json: Q2(giving) - inject 'give' -> 'giving'
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/4번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q2 = qs[1]
    r, d = inject_underline(q2, 'give', 'giving')
    if r:
        proposed = {1: r[2]}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  Q2 planned: {d}, MC violations: A6={a6}, A7={a7}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, {1: r})
            total_fixed += f
        else:
            print(f"  SKIP: violations")
    else:
        print(f"  Q2: {d}")

    # ============================================================
    # 7. 4강/2번/워크북.json: Q1+Q2 (both TypeA, ans stays same)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/2번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: behaviors. Replace 'behavior' -> 'behaviors'
    r1, d1 = inject_underline(qs[0], 'behavior', 'behaviors')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")

    # Q2: being. Replace 'tend to be' -> 'being'
    r2, d2 = inject_underline(qs[1], 'tend to be', 'being')
    if r2:
        fixes[1] = r2
        print(f"  Q2 planned: {d2}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            print(f"  SKIP: violations")

    # ============================================================
    # 8. 4강/4번/워크북.json: Q1(considering) + Q2(to use)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/4번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: considering. Look for 'consider' in passage
    q1 = qs[0]
    det1 = q1.get('det', {}).get('analysis', '')
    print(f"  Q1 det: {det1[:200]}")
    q1_clean = strip_all_underlines(q1['passage'])
    for cw in ['consider', 'considered', 'considers', 'to consider']:
        pos = q1_clean.lower().find(cw)
        if pos != -1:
            print(f"  Q1: found '{cw}' at {pos}")
            r, d = inject_underline(q1, cw, 'considering')
            if r:
                fixes[0] = r
                print(f"  Q1 planned: {d}")
            break

    # Q2: to use. Look for 'use' or 'using' in passage
    q2 = qs[1]
    det2 = q2.get('det', {}).get('analysis', '')
    print(f"  Q2 det: {det2[:200]}")
    q2_clean = strip_all_underlines(q2['passage'])
    for cw in ['use ', 'uses ', 'using ']:
        pos = q2_clean.lower().find(cw)
        if pos != -1:
            print(f"  Q2: found '{cw.strip()}' at {pos}")
            r, d = inject_underline(q2, cw.strip(), 'to use')
            if r:
                fixes[1] = r
                print(f"  Q2 planned: {d}")
            break

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            from itertools import combinations
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo})
                        total_fixed += fv
                        break
                else:
                    continue
                break

    # ============================================================
    # 9. 4강/Gateway/워크북.json: Q2(examining) + Q3(TypeB)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/Gateway/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q2: examining. Look for 'examine' in passage
    q2 = qs[1]
    det2 = q2.get('det', {}).get('analysis', '')
    print(f"  Q2 det: {det2[:200]}")
    q2_clean = strip_all_underlines(q2['passage'])
    for cw in ['examine', 'examines', 'examined', 'to examine']:
        pos = q2_clean.lower().find(cw)
        if pos != -1:
            print(f"  Q2: found '{cw}' at {pos}")
            r, d = inject_underline(q2, cw, 'examining')
            if r:
                fixes[1] = r
                print(f"  Q2 planned: {d}")
            break

    # Q3: TypeB reorder
    q3 = qs[2]
    r3, d3 = reorder_ch_to_text_order(q3)
    if r3:
        fixes[2] = r3
        print(f"  Q3 planned: {d3}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            from itertools import combinations
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo})
                        total_fixed += fv
                        break
                else:
                    continue
                break

    # ============================================================
    # 10. 4강/Gateway/퀴즈.json: Q1(realized->realizing) + Q2(became->become)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/Gateway/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: realized wrong. Correct = 'realizing' in passage
    r1, d1 = inject_underline(qs[0], 'realizing', 'realized')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")

    # Q2: became wrong. Correct = 'become' in passage
    r2, d2 = inject_underline(qs[1], 'become', 'became')
    if r2:
        fixes[1] = r2
        print(f"  Q2 planned: {d2}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            from itertools import combinations
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo})
                        total_fixed += fv
                        break
                else:
                    continue
                break

    # ============================================================
    # 11. 8강/Gateway/퀴즈.json: Q3(those) - inject 'that' (2nd occurrence) -> 'those'
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강/영어/8강/Gateway/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q3 = qs[2]
    q3_clean = strip_all_underlines(q3['passage'])
    # used underline is at ~286 in passage
    # We need 'that' AFTER 'used' position (~286)
    # Find 'that' after position 300 in clean passage
    r3, d3 = inject_underline(q3, 'that', 'those', search_start=300)
    if r3:
        proposed = {2: r3[2]}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  Q3 planned: {d3}, MC violations: A6={a6}, A7={a7}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, {2: r3})
            total_fixed += f
        else:
            print(f"  SKIP: violations")
    else:
        print(f"  Q3: {d3}")

    # ============================================================
    # FINAL SCAN
    # ============================================================
    print("\n" + "="*60)
    print(f"Questions fixed this run: {total_fixed}")
    print("\nFINAL SCAN - Remaining SEM-3:")

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

    grand_total = 0
    for fp in all_files:
        count, _, _, _ = run_validate(fp)
        if count > 0:
            print(f"  {fp}: {count}")
            grand_total += count

    print(f"\nTotal remaining SEM-3: {grand_total}")


if __name__ == '__main__':
    main()
