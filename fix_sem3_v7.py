#!/usr/bin/env python3
"""
Fix SEM-3 errors - v7: All remaining cases with specific per-question fixes.
Key improvements over v6:
1. Uses word-boundary search (re.search with \b) for existing underlines
2. Special handling for 3강/3번/워크북 Q2 (replace+add underline)
3. 17강/4번/워크북 Q1 TypeB with ans correction to 3
4. 21강/퀴즈 Q12+Q13 cyclic combo
5. All TypeB and TypeA fixes for 4강/2번, 4강/4번, 4강/Gateway files
"""

import json
import re
import subprocess
import os
import copy
from collections import Counter
from itertools import combinations

BASE = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"

CIRCLE_LIST = ['①', '②', '③', '④', '⑤']
CIRCLE_MAP = {i+1: c for i, c in enumerate(CIRCLE_LIST)}
CIRCLE_REVERSE = {c: i+1 for i, c in enumerate(CIRCLE_LIST)}


def strip_marker_prefix(s):
    s = (s or '').strip()
    if s and s[0] in CIRCLE_REVERSE:
        return s[1:].strip()
    return s


def strip_all_underlines(passage):
    p = re.sub(r'[①②③④⑤](?=<u>)', '', passage)
    p = re.sub(r'</?u>', '', p)
    return p


def add_circled_markers(passage):
    """Renumber all <u> markers in passage in text order."""
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
    """Check A6 and A7 violations using MC-only filter (ans 1-4)."""
    mc_ans = []
    for i, q in enumerate(questions):
        a = proposed_changes.get(i, q.get('ans'))
        if isinstance(a, int) and 1 <= a <= 4:
            mc_ans.append(a)
    dist = Counter(mc_ans)
    a6 = any(v > 5 for v in dist.values())
    a7 = any(mc_ans[i] == mc_ans[i+1] == mc_ans[i+2] for i in range(len(mc_ans) - 2))
    return a6, a7, dict(dist)


def find_word_position(clean_passage, word, search_start=0):
    """Find word in clean passage using word boundary when possible."""
    # Try word boundary first
    pattern = r'\b' + re.escape(word.lower()) + r'\b'
    for m in re.finditer(pattern, clean_passage.lower()):
        if m.start() >= search_start:
            return m.start()
    # Fallback to substring search (for compound words, multi-word phrases)
    pos = clean_passage.lower().find(word.lower(), search_start)
    return pos


def get_existing_underline_positions(passage, clean_passage):
    """Extract existing underline positions using word-boundary search."""
    existing = []
    for m in re.finditer(r'<u>([^<]+)</u>', passage):
        word = m.group(1).strip()
        pos = find_word_position(clean_passage, word)
        if pos != -1:
            existing.append((pos, len(word), word))
    return existing


def inject_underline(q, correct_form_in_passage, wrong_form_display, search_start=0):
    """
    TypeA fix: replace correct_form with wrong_form in passage, wrap in <u>.
    Uses word-boundary search for existing underlines.
    Returns (new_passage, new_ch, new_ans) or None.
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1

    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    clean_passage = strip_all_underlines(passage)

    # Find correct_form position
    idx = find_word_position(clean_passage, correct_form_in_passage, search_start)
    if idx == -1:
        return None, f"cannot find '{correct_form_in_passage}' (from pos {search_start}) in passage"

    # Get existing underline positions with word-boundary search
    existing_underlines = get_existing_underline_positions(passage, clean_passage)

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
    new_passage = add_circled_markers(result)

    return (new_passage, new_ch, new_ans), f"TypeA inject '{wrong_form_display}' (replacing '{correct_form_in_passage}'), ans->{new_ans}"


def reorder_ch_to_text_order(q, force_ans=None):
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

    if force_ans is not None:
        new_ans = force_ans
    else:
        new_ans = None
        for new_pos, old_ci in enumerate(new_order):
            if old_ci == ans_idx:
                new_ans = new_pos + 1
                break
        if new_ans is None:
            return None, "cannot find answer in new order"

    new_ch = [f"{CIRCLE_MAP[i+1]} {w}" for i, w in enumerate(new_ch_raw)]
    new_passage = add_circled_markers(passage)

    return (new_passage, new_ch, new_ans), f"TypeB reorder, ans={ans}->{new_ans}"


def inject_at_position(q, inject_pos, inject_len, wrong_form, extra_underlines=None):
    """
    Low-level inject: replace text at inject_pos (len=inject_len) with wrong_form.
    Optionally add extra_underlines = [(pos, len, word), ...] (additional new underlines).
    Returns (new_passage, new_ch, new_ans).
    """
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1
    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    clean_passage = strip_all_underlines(passage)

    existing_underlines = get_existing_underline_positions(passage, clean_passage)

    # Replace existing underline at inject_pos if it overlaps, otherwise add new
    all_underlines = list(existing_underlines)
    # Remove any existing underline that overlaps with inject_pos
    all_underlines = [(p, l, w) for p, l, w in all_underlines
                      if not (p <= inject_pos < p + l)]
    all_underlines.append((inject_pos, inject_len, wrong_form))

    if extra_underlines:
        all_underlines.extend(extra_underlines)

    all_underlines.sort(key=lambda x: x[0])

    result = ""
    last_end = 0
    for pos, length, display_word in all_underlines:
        result += clean_passage[last_end:pos]
        result += f"<u>{display_word}</u>"
        last_end = pos + length
    result += clean_passage[last_end:]

    new_ul_words = [w for _, _, w in all_underlines]

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
    new_passage = add_circled_markers(result)
    return (new_passage, new_ch, new_ans), f"inject_at_pos {inject_pos} -> '{wrong_form}', ans->{new_ans}"


def apply_fixes(filepath, fixes_dict, label=""):
    """
    Apply fixes to a file. Validates after. Reverts if new [S] errors.
    fixes_dict: {q_idx_0based: (new_passage, new_ch, new_ans)}
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
    # 1. 21강/퀴즈.json: Q12+Q13 cyclic swap (4->3, 3->4)
    #    Q12: inject 'to believe' replacing 'believe' at ~2888
    #    Q13: inject 'capability' replacing 'capable' at ~3237
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강/영어/21강/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q12: inject 'to believe' replacing 'believe'
    r12, d12 = inject_underline(qs[11], 'believe', 'to believe')
    if r12:
        fixes[11] = r12
        print(f"  Q12 planned: {d12}")

    # Q13: inject 'capability' replacing 'capable'
    r13, d13 = inject_underline(qs[12], 'capable', 'capability')
    if r13:
        fixes[12] = r13
        print(f"  Q13 planned: {d13}")

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
    # 2. 3강/1번/퀴즈.json: Q1(saying) + Q3(losing)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/1번/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: inject 'saying' replacing 'say' at ~50
    r1, d1 = inject_underline(qs[0], 'say', 'saying')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")

    # Q3: inject 'losing' replacing 'lost' at ~570
    r3, d3 = inject_underline(qs[2], 'lost', 'losing')
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
            # Try subsets
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo},
                                                    f" (subset Q{[i+1 for i in combo]})")
                        total_fixed += fv
                        break
                else:
                    continue
                break
            else:
                print("  SKIP: no valid subset")

    # ============================================================
    # 3. 3강/3번/워크북.json: Q2 special fix (replace what->which + add what at 454)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/3번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    q2 = qs[1]
    # Existing underlines: who(143), made(223), what(435)
    # Replace existing <u>what</u> at 435 with <u>which</u>
    # AND add <u>what</u> at 454
    # Resulting underlines: who(143), made(223), which(435), what(454)
    # New ch: ①who, ②made, ③which, ④what, ans=3 (which)
    clean_q2 = strip_all_underlines(q2['passage'])
    what_pos = find_word_position(clean_q2, 'what')  # should be ~435
    what_pos2 = clean_q2.lower().find('what', what_pos + 4)  # second occurrence ~454
    if what_pos != -1 and what_pos2 != -1:
        print(f"  Q2: what at {what_pos}, what2 at {what_pos2}")
        # Use inject_at_position: replace what at 435 with 'which', add 'what' at 454
        result, desc = inject_at_position(
            q2,
            inject_pos=what_pos,
            inject_len=len('what'),
            wrong_form='which',
            extra_underlines=[(what_pos2, len('what'), 'what')]
        )
        if result:
            fixes[1] = result
            print(f"  Q2 planned: {desc}")
    else:
        print(f"  Q2: could not find two 'what' occurrences")

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
    # 4. 3강/4번/워크북.json: Q3 TypeB reorder
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/3강/4번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q3 = qs[2]
    r3, d3 = reorder_ch_to_text_order(q3)
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
    # 5. 17강/4번/워크북.json: Q1 TypeB reorder with ans=3
    #    (det says ③ moved is error, but ans=2; fix: reorder + set ans=3)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/17강/4번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q1 = qs[0]
    # TypeB reorder: passage ①in, ②meeting -> ch wants meeting=①, in=②
    # After reorder to text order: ①in(45? - meeting at 45, in at 78), wait check:
    # underlines text order: in appears BEFORE meeting in passage text
    # Actually passage markers are ①<u>in</u>, ②<u>meeting</u> which means
    # in appears first in text, meeting second
    # After reorder: new_ch = [in, meeting, moved, alone]
    # Force ans=3 (moved is the error per det ❌③moved)
    r1, d1 = reorder_ch_to_text_order(q1, force_ans=3)
    if r1:
        proposed = {0: r1[2]}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  Q1 planned: {d1}, MC violations: A6={a6}, A7={a7}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, {0: r1})
            total_fixed += f
        else:
            print(f"  SKIP: violations")
    else:
        print(f"  Q1: {d1}")

    # ============================================================
    # 6. 8강/Gateway/퀴즈.json: Q3 inject 'those' replacing 'that' (2nd occurrence)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강/영어/8강/Gateway/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    q3 = qs[2]
    # 'that' at 455 (skip first occurrence at 271)
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
    # 7. 4강/2번/워크북.json: Q1(behaviors) + Q2(being) + Q3(sticks) + Q4(TypeB)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/2번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: inject 'behaviors' replacing 'behavior'
    r1, d1 = inject_underline(qs[0], 'behavior', 'behaviors')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")

    # Q2: inject 'being' replacing 'tend to be'
    r2, d2 = inject_underline(qs[1], 'tend to be', 'being')
    if r2:
        fixes[1] = r2
        print(f"  Q2 planned: {d2}")

    # Q3: inject 'sticks' replacing 'stick' (2nd occurrence, after 'land')
    # 'stick' at 71 is in context 'don't stick where they land' (the first one)
    # 'stick' at 786 is 'cash but stick to disproportionately' (the one we want)
    r3, d3 = inject_underline(qs[2], 'stick', 'sticks', search_start=700)
    if r3:
        fixes[2] = r3
        print(f"  Q3 planned: {d3}")

    # Q4: TypeB reorder
    r4, d4 = reorder_ch_to_text_order(qs[3])
    if r4:
        fixes[3] = r4
        print(f"  Q4 planned: {d4}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            # Try subsets largest first
            found = False
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo},
                                                    f" (subset Q{[i+1 for i in combo]})")
                        total_fixed += fv
                        found = True
                        break
                if found:
                    break
            else:
                print("  SKIP: no valid subset")

    # ============================================================
    # 8. 4강/4번/워크북.json: Q1(considering) + Q2(to use)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/4번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: inject 'considering' replacing 'consider'
    r1, d1 = inject_underline(qs[0], 'consider', 'considering')
    if r1:
        fixes[0] = r1
        print(f"  Q1 planned: {d1}")

    # Q2: inject 'to use' replacing 'use'
    r2, d2 = inject_underline(qs[1], 'use', 'to use')
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
            found = False
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo},
                                                    f" (subset Q{[i+1 for i in combo]})")
                        total_fixed += fv
                        found = True
                        break
                if found:
                    break
            else:
                print("  SKIP: no valid subset")

    # ============================================================
    # 9. 4강/Gateway/워크북.json: Q3(TypeB) + Q4(to realize)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/Gateway/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q3: TypeB reorder
    r3, d3 = reorder_ch_to_text_order(qs[2])
    if r3:
        fixes[2] = r3
        print(f"  Q3 planned: {d3}")

    # Q4: inject 'to realize' replacing 'realizing'
    r4, d4 = inject_underline(qs[3], 'realizing', 'to realize')
    if r4:
        fixes[3] = r4
        print(f"  Q4 planned: {d4}")

    if fixes:
        proposed = {idx: r[2] for idx, r in fixes.items()}
        a6, a7, dist = check_mc_violations(qs, proposed)
        print(f"  MC violations: A6={a6}, A7={a7}, dist={dist}")
        if not a6 and not a7:
            f, pre, post = apply_fixes(fp, fixes)
            total_fixed += f
        else:
            found = False
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo},
                                                    f" (subset Q{[i+1 for i in combo]})")
                        total_fixed += fv
                        found = True
                        break
                if found:
                    break
            else:
                print("  SKIP: no valid subset")

    # ============================================================
    # 10. 4강/Gateway/퀴즈.json: Q1+Q2 TypeA
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/4강/Gateway/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q1: inject 'realized' replacing 'realizing' (or vice versa - check det)
    q1 = qs[0]
    det1 = q1.get('det', {}).get('analysis', '')
    print(f"  Q1 det: {det1[:200]}")
    q1_ul = re.findall(r'<u>([^<]+)</u>', q1['passage'])
    print(f"  Q1 underlines: {q1_ul}")
    # Try inject based on what's in passage
    clean1 = strip_all_underlines(q1['passage'])
    for pair in [('realizing', 'realized'), ('realized', 'realizing'),
                 ('becoming', 'became'), ('become', 'became')]:
        if pair[0].lower() in clean1.lower():
            r, d = inject_underline(q1, pair[0], pair[1])
            if r:
                fixes[0] = r
                print(f"  Q1 planned: {d}")
                break

    # Q2: check det
    q2 = qs[1]
    det2 = q2.get('det', {}).get('analysis', '')
    print(f"  Q2 det: {det2[:200]}")
    q2_ul = re.findall(r'<u>([^<]+)</u>', q2['passage'])
    print(f"  Q2 underlines: {q2_ul}")
    clean2 = strip_all_underlines(q2['passage'])
    for pair in [('become', 'became'), ('became', 'become'),
                 ('establishing', 'established'), ('established', 'establishing')]:
        if pair[0].lower() in clean2.lower():
            r, d = inject_underline(q2, pair[0], pair[1])
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
            found = False
            for r in range(len(fixes), 0, -1):
                for combo in combinations(list(fixes.keys()), r):
                    prop_c = {idx: fixes[idx][2] for idx in combo}
                    a6c, a7c, dc = check_mc_violations(qs, prop_c)
                    if not a6c and not a7c:
                        fv, pre, post = apply_fixes(fp, {idx: fixes[idx] for idx in combo},
                                                    f" (subset Q{[i+1 for i in combo]})")
                        total_fixed += fv
                        found = True
                        break
                if found:
                    break
            else:
                print("  SKIP: no valid subset")

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
    for f in all_files:
        count, _, _, _ = run_validate(f)
        if count > 0:
            print(f"  {f}: {count}")
            grand_total += count

    print(f"\nTotal remaining SEM-3: {grand_total}")


if __name__ == '__main__':
    main()
