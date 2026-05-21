#!/usr/bin/env python3
"""
Fix SEM-3 errors - v8: Final remaining cases after v7.
Cases:
1. 6강/1번/워크북 Q3: inject 'restricting' replacing 'restrict'
2. 11강/4번/퀴즈 Q3: inject 'focusing' replacing 'focus' (at verb position)
3. 16강/Gateway/워크북 Q2: inject 'which' replacing 'where'
4. 16강/Gateway/워크북 Q3: inject 'winning' replacing 'won'
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
    """Find word using word boundary when possible."""
    pattern = r'\b' + re.escape(word.lower()) + r'\b'
    for m in re.finditer(pattern, clean_passage.lower()):
        if m.start() >= search_start:
            return m.start()
    # Fallback to substring
    return clean_passage.lower().find(word.lower(), search_start)


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
    """TypeA fix using word-boundary search."""
    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    ans_idx = ans - 1
    ch_words_raw = [strip_marker_prefix(c) for c in ch]
    clean_passage = strip_all_underlines(passage)

    idx = find_word_position(clean_passage, correct_form_in_passage, search_start)
    if idx == -1:
        return None, f"cannot find '{correct_form_in_passage}' (from pos {search_start})"

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
            "shouldn't": "should not", "won't": "will not",
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


def apply_fixes(filepath, fixes_dict, label=""):
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
    # 1. 6강/1번/워크북.json: Q3(restricting)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강/영어/6강/1번/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    # Q3: inject 'restricting' replacing 'restrict'
    r3, d3 = inject_underline(qs[2], 'restrict', 'restricting')
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
    # 2. 11강/4번/퀴즈.json: Q3(focusing)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/11강/4번/퀴즈.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    # Q3: inject 'focusing' replacing 'focus' (verb at ~344)
    # 'focus' at 270 is a NOUN ('the focus of attention') - skip
    # 'focus' at 344 is VERB ('and focus on a char') - inject here
    r3, d3 = inject_underline(qs[2], 'focus', 'focusing', search_start=300)
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
    # 3. 16강/Gateway/워크북.json: Q2(which) + Q3(winning)
    # ============================================================
    print("\n" + "="*60)
    fp = "부교재/수능특강Light/영어/16강/Gateway/워크북.json"
    print(f"Processing: {fp}")
    data = load_file(fp)
    qs = data['questions']

    fixes = {}
    # Q2: inject 'which' replacing 'where' at ~682
    r2, d2 = inject_underline(qs[1], 'where', 'which')
    if r2:
        fixes[1] = r2
        print(f"  Q2 planned: {d2}")

    # Q3: inject 'winning' replacing 'won' at ~1301
    r3, d3 = inject_underline(qs[2], 'won', 'winning')
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
