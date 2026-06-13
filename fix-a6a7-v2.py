#!/usr/bin/env python3
"""
fix-a6a7-v2.py — Fix A6/A7 violations accounting for T/F in distribution.

validate.js counts ALL fmt=mc questions with numeric ans for A6/A7.
T/F questions (ch=["T","F"]) have ans=1 or 2 and count towards distribution.
Only questions with 4 non-marker choices can be swapped.
"""

import json
import sys
import os
import subprocess
import re
import copy

MARKERS = ['①', '②', '③', '④', '⑤']

def is_mc_counted(q):
    """Questions counted by validate.js for A6/A7: fmt=mc + numeric ans."""
    return q.get('fmt') == 'mc' and isinstance(q.get('ans'), int)

def is_swappable(q):
    """Can swap choices (non-marker, non-TF, 4 choices, numeric ans)."""
    if not is_mc_counted(q):
        return False
    ch = q.get('ch', [])
    if len(ch) != 4:
        return False
    # Marker type: all choices are circle markers
    if all(c.strip() in MARKERS for c in ch):
        return False
    return True

def get_dist(questions):
    """Distribution of answers among mc-counted questions."""
    dist = {1: 0, 2: 0, 3: 0, 4: 0}
    for q in questions:
        if is_mc_counted(q):
            ans = q['ans']
            if ans in dist:
                dist[ans] += 1
    return dist

def get_mc_list(questions):
    """List of mc-counted question indices."""
    return [i for i, q in enumerate(questions) if is_mc_counted(q)]

def has_a7(questions):
    """Check for 3 consecutive same answers among mc-counted questions."""
    mc_idx = get_mc_list(questions)
    for i in range(len(mc_idx) - 2):
        a1 = questions[mc_idx[i]]['ans']
        a2 = questions[mc_idx[i+1]]['ans']
        a3 = questions[mc_idx[i+2]]['ans']
        if a1 == a2 == a3:
            return True
    return False

def has_a6(questions):
    dist = get_dist(questions)
    return any(v > 5 for v in dist.values())

def has_a6a7(questions):
    return has_a6(questions) or has_a7(questions)

def would_create_a7(questions, qi, new_ans):
    """Check if changing questions[qi].ans to new_ans creates A7."""
    mc_idx = get_mc_list(questions)
    mc_pos = mc_idx.index(qi) if qi in mc_idx else -1
    if mc_pos < 0:
        return False

    # Simulate
    orig_ans = questions[qi]['ans']
    questions[qi]['ans'] = new_ans

    result = False
    for i in range(max(0, mc_pos - 2), min(len(mc_idx) - 2, mc_pos + 1)):
        if (questions[mc_idx[i]]['ans'] == questions[mc_idx[i+1]]['ans'] == questions[mc_idx[i+2]]['ans']):
            result = True
            break

    questions[qi]['ans'] = orig_ans
    return result

def swap_choices(q, old_idx, new_idx):
    """Swap two choices, update ans and det.analysis."""
    ch = q['ch']
    ch[old_idx], ch[new_idx] = ch[new_idx], ch[old_idx]
    q['ans'] = new_idx + 1

    det = q.get('det', {})
    if 'analysis' in det and det['analysis']:
        mk = ['①', '②', '③', '④']
        mA, mB = mk[old_idx], mk[new_idx]
        lines = det['analysis'].split('\n')
        liA = liB = -1
        for li, line in enumerate(lines):
            s = line.strip()
            if s.startswith(mA): liA = li
            elif s.startswith(mB): liB = li

        if liA >= 0 and liB >= 0:
            arrow = ' ←정답'
            cA = lines[liA].split(mA, 1)[1] if mA in lines[liA] else ''
            cB = lines[liB].split(mB, 1)[1] if mB in lines[liB] else ''
            cA_clean = cA.replace(arrow, '')
            cB_clean = cB.replace(arrow, '')
            aA = arrow in cA
            aB = arrow in cB

            # After swap: A position gets B's content, B gets A's content
            lines[liA] = mA + cB_clean + (arrow if aB else '')
            lines[liB] = mB + cA_clean + (arrow if aA else '')
            det['analysis'] = '\n'.join(lines)

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data['questions']
    modified = False

    for iteration in range(50):
        if not has_a6a7(questions):
            break

        dist = get_dist(questions)
        fixed = False

        # Fix A7 first
        mc_idx = get_mc_list(questions)
        for i in range(len(mc_idx) - 2):
            a1 = questions[mc_idx[i]]['ans']
            a2 = questions[mc_idx[i+1]]['ans']
            a3 = questions[mc_idx[i+2]]['ans']
            if a1 == a2 == a3:
                run_val = a1
                # Try to swap middle question first
                for try_pos in [i+1, i, i+2]:
                    qi = mc_idx[try_pos]
                    if is_swappable(questions[qi]):
                        for target in sorted([1,2,3,4], key=lambda x: dist.get(x,0)):
                            if target == run_val:
                                continue
                            if dist.get(target, 0) >= 5:
                                continue
                            if would_create_a7(questions, qi, target):
                                continue
                            old_idx = questions[qi]['ans'] - 1
                            new_idx = target - 1
                            swap_choices(questions[qi], old_idx, new_idx)
                            dist[run_val] -= 1
                            dist[target] = dist.get(target, 0) + 1
                            modified = True
                            fixed = True
                            break
                    if fixed:
                        break

                # If still not fixed, try position swap
                if not fixed:
                    mid_qi = mc_idx[i+1]
                    for j in range(len(questions)):
                        if j == mid_qi:
                            continue
                        if not is_mc_counted(questions[j]):
                            continue
                        if questions[j]['ans'] == run_val:
                            continue
                        # Try swapping positions
                        questions[mid_qi], questions[j] = questions[j], questions[mid_qi]
                        if not has_a7(questions):
                            modified = True
                            fixed = True
                            break
                        # Revert
                        questions[mid_qi], questions[j] = questions[j], questions[mid_qi]

                if fixed:
                    break

        if fixed:
            continue

        # Fix A6
        over = {k: v for k, v in dist.items() if v > 5}
        if over:
            over_ans = max(over, key=over.get)
            # Find swappable question with over_ans
            for qi in range(len(questions)):
                if questions[qi].get('ans') != over_ans:
                    continue
                if not is_swappable(questions[qi]):
                    continue
                # Pick target
                for target in sorted([1,2,3,4], key=lambda x: dist.get(x,0)):
                    if target == over_ans:
                        continue
                    if dist.get(target, 0) >= 5:
                        continue
                    if would_create_a7(questions, qi, target):
                        continue
                    old_idx = questions[qi]['ans'] - 1
                    new_idx = target - 1
                    swap_choices(questions[qi], old_idx, new_idx)
                    dist[over_ans] -= 1
                    dist[target] = dist.get(target, 0) + 1
                    modified = True
                    fixed = True
                    break
                if fixed:
                    break

        if not fixed:
            break

    if modified:
        data['questions'] = questions
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return modified

def validate(filepath):
    try:
        result = subprocess.run(
            ['node', 'validate/validate.js', filepath],
            capture_output=True, text=True, timeout=30,
            cwd='/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests'
        )
        output = result.stdout + result.stderr
    except:
        output = ''
    first_line = output.strip().split('\n')[0] if output.strip() else ''
    has_err = bool(re.search(r'\[S\] A[67]:', output))
    return first_line, has_err

if __name__ == '__main__':
    os.chdir('/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests')

    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = [l.strip() for l in sys.stdin if l.strip()]

    total = len(files)
    fixed = 0
    still_fail = []

    for i, f in enumerate(files):
        print(f'[{i+1}/{total}] {f}', end=' ... ')

        fl, has = validate(f)
        if not has:
            print('no A6/A7')
            continue

        was_modified = fix_file(f)
        if was_modified:
            fl2, has2 = validate(f)
            if has2:
                print(f'STILL FAIL: {fl2}')
                still_fail.append(f)
            else:
                print(f'FIXED -> {fl2}')
                fixed += 1
        else:
            print('no fix possible')
            still_fail.append(f)

    print(f'\n=== Total: {total}, Fixed: {fixed}, Still failing: {len(still_fail)} ===')
    for f in still_fail:
        print(f'  {f}')
