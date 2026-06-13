#!/usr/bin/env python3
"""
Fix A6 (answer distribution >5) and A7 (3 consecutive same answers) violations.

Strategy:
1. For A6/A7 on non-marker questions: swap choices within the question
2. For A7 on marker-only runs: swap question POSITIONS with a non-run question
   that has a different ans value
3. For A6 when only marker questions have the over-represented ans:
   swap a marker question's position with a swappable question of different ans,
   then adjust the swappable question's ans if needed
"""

import json
import sys
import os
import subprocess
import re
import copy

def is_marker(q):
    """Check if question is marker type (choices are ①②③④)."""
    return q.get('ch', []) == ['①', '②', '③', '④']

def is_swappable(q):
    """Check if a question's choices can be swapped (reordered)."""
    ch = q.get('ch', [])
    if ch == ['①', '②', '③', '④']:
        return False
    if ch == ['T', 'F']:
        return False
    if len(ch) == 0:
        return False
    if len(ch) != 4:
        return False
    ans = q.get('ans')
    if not isinstance(ans, int):
        return False
    return True

def get_ans_distribution(questions):
    dist = {1: 0, 2: 0, 3: 0, 4: 0}
    for q in questions:
        ans = q.get('ans')
        if isinstance(ans, int) and ans in dist:
            dist[ans] += 1
    return dist

def find_a7_runs(questions):
    """Find first A7 violation (3 consecutive same int answers)."""
    ans_list = [q.get('ans') for q in questions]
    for i in range(len(ans_list) - 2):
        a = ans_list[i]
        if isinstance(a, int) and a == ans_list[i+1] == ans_list[i+2]:
            return (i, i+1, i+2, a)
    return None

def would_create_a7(questions, idx, new_ans):
    """Check if changing questions[idx].ans to new_ans creates A7."""
    if not isinstance(new_ans, int):
        return False
    n = len(questions)
    if idx >= 2:
        if questions[idx-2].get('ans') == questions[idx-1].get('ans') == new_ans:
            return True
    if idx >= 1 and idx + 1 < n:
        if questions[idx-1].get('ans') == new_ans and questions[idx+1].get('ans') == new_ans:
            return True
    if idx + 2 < n:
        if questions[idx+1].get('ans') == new_ans and questions[idx+2].get('ans') == new_ans:
            return True
    return False

def would_position_swap_create_a7(questions, idx_a, idx_b):
    """Check if swapping positions of questions at idx_a and idx_b creates new A7."""
    # Simulate the swap
    qs = list(questions)
    qs[idx_a], qs[idx_b] = qs[idx_b], qs[idx_a]
    # Check all positions around both swap points
    for check_idx in range(len(qs)):
        ans = qs[check_idx].get('ans')
        if not isinstance(ans, int):
            continue
        if check_idx >= 2:
            if qs[check_idx-2].get('ans') == qs[check_idx-1].get('ans') == ans:
                return True
    return False

def swap_choices(q, old_ans_idx, new_ans_idx):
    """Swap two choices and update ans and det.analysis."""
    q = copy.deepcopy(q)
    ch = q['ch']
    ch[old_ans_idx], ch[new_ans_idx] = ch[new_ans_idx], ch[old_ans_idx]
    q['ans'] = new_ans_idx + 1

    det = q.get('det', {})
    if 'analysis' in det:
        analysis = det['analysis']
        markers = ['①', '②', '③', '④']
        old_m = markers[old_ans_idx]
        new_m = markers[new_ans_idx]

        lines = analysis.split('\n')
        old_li = new_li = None
        for li, line in enumerate(lines):
            s = line.strip()
            if s.startswith(old_m):
                old_li = li
            elif s.startswith(new_m):
                new_li = li

        if old_li is not None and new_li is not None:
            old_line = lines[old_li]
            new_line = lines[new_li]
            old_content = old_line.split(old_m, 1)[1] if old_m in old_line else ''
            new_content = new_line.split(new_m, 1)[1] if new_m in new_line else ''
            arrow = ' ←정답'
            old_content = old_content.replace(arrow, '')
            new_content = new_content.replace(arrow, '')
            lines[old_li] = old_m + new_content
            lines[new_li] = new_m + old_content + arrow
            det['analysis'] = '\n'.join(lines)

    q['det'] = det
    return q

def pick_best_target(current_ans, dist, forbidden):
    candidates = [(dist.get(n, 0), n) for n in [1,2,3,4] if n != current_ans and n not in forbidden]
    candidates.sort()
    return candidates[0][1] if candidates else None

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data['questions']
    modified = False

    for iteration in range(50):
        dist = get_ans_distribution(questions)
        a7_run = find_a7_runs(questions)
        a6_over = {k: v for k, v in dist.items() if v > 5}

        if not a6_over and not a7_run:
            break

        fixed_one = False

        # --- Fix A7 first ---
        if a7_run:
            ri, rj, rk, run_val = a7_run

            # Strategy 1: Find swappable question IN the run and change its ans
            for qi in [rj, ri, rk]:  # prefer middle
                if is_swappable(questions[qi]):
                    forbidden = {run_val}
                    for c in [1,2,3,4]:
                        if c != run_val and would_create_a7(questions, qi, c):
                            forbidden.add(c)
                    target = pick_best_target(run_val, dist, forbidden)
                    if target:
                        questions[qi] = swap_choices(questions[qi], run_val - 1, target - 1)
                        modified = True
                        fixed_one = True
                        break

            # Strategy 2: Swap POSITIONS - put a different-ans question into the run
            if not fixed_one:
                # Find the middle of the run
                swap_in_idx = rj  # middle position to break

                # Find a question OUTSIDE the run with different ans
                # Prefer questions with different ans that won't create new A7
                for qi in range(len(questions)):
                    if qi in [ri, rj, rk]:
                        continue
                    q_ans = questions[qi].get('ans')
                    if not isinstance(q_ans, int) or q_ans == run_val:
                        continue

                    # Check if swapping positions would create new A7
                    if not would_position_swap_create_a7(questions, swap_in_idx, qi):
                        # Do the position swap
                        questions[swap_in_idx], questions[qi] = questions[qi], questions[swap_in_idx]
                        modified = True
                        fixed_one = True
                        break

            # Strategy 3: Swap positions with ANY different-ans question
            if not fixed_one:
                for qi in range(len(questions)):
                    if qi in [ri, rj, rk]:
                        continue
                    q_ans = questions[qi].get('ans')
                    if not isinstance(q_ans, int) or q_ans == run_val:
                        continue
                    # Force swap even if it might create A7 (we'll fix it next iteration)
                    questions[rj], questions[qi] = questions[qi], questions[rj]
                    modified = True
                    fixed_one = True
                    break

            if fixed_one:
                continue

        # --- Fix A6 ---
        if a6_over:
            over_ans = max(a6_over, key=a6_over.get)

            # Strategy 1: Find a swappable question with over_ans and change it
            for qi in range(len(questions)):
                if questions[qi].get('ans') == over_ans and is_swappable(questions[qi]):
                    forbidden = set()
                    for c in [1,2,3,4]:
                        if c != over_ans and would_create_a7(questions, qi, c):
                            forbidden.add(c)
                    target = pick_best_target(over_ans, dist, forbidden)
                    if target:
                        questions[qi] = swap_choices(questions[qi], over_ans - 1, target - 1)
                        modified = True
                        fixed_one = True
                        break

            # Strategy 2: Find a swappable question with underrepresented ans,
            # change it to have ans=over_ans, freeing up a slot
            # (This doesn't help - it increases over_ans count)
            # Actually we need: find swappable with different ans, that is near a marker with over_ans,
            # swap positions, then change the swappable's ans
            if not fixed_one:
                # Find a marker question with over_ans and a swappable with different ans
                under_ans = min(dist, key=dist.get)
                for qi in range(len(questions)):
                    if (questions[qi].get('ans') == over_ans and
                        is_marker(questions[qi])):
                        # Find a swappable nearby with under_ans that we can change to over_ans
                        # Actually, we need to SWAP a marker(over_ans) with a swappable(different_ans)
                        # then change the swappable(now at marker's old position) to have a different ans
                        # Wait, that doesn't change anything.
                        #
                        # Better: find a swappable with any non-over ans, and change its choices
                        # so its ans becomes something else, reducing... no.
                        #
                        # The real fix: find ANY swappable question and change it FROM over_ans
                        # But if no swappable has over_ans, we're stuck.
                        pass

                # If truly stuck (all over_ans questions are markers), try position swaps
                # to at least group them differently
                # Actually, for A6 we just need fewer of over_ans.
                # If we can find a swappable question that currently has a different ans,
                # we could change it... but that increases its target's count.
                # The real fix needs to reduce over_ans count, which means changing a question
                # that has ans=over_ans. If all such questions are markers, we're stuck
                # unless we can change the marker's ans (which means changing which marker is wrong
                # in the passage - not possible).
                pass

        if not fixed_one:
            break

    if modified:
        data['questions'] = questions
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')

    return modified

def validate_file(filepath):
    result = subprocess.run(
        ['node', 'validate/validate.js', filepath],
        capture_output=True, text=True,
        cwd='/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests'
    )
    output = result.stdout + result.stderr
    first_line = output.strip().split('\n')[0] if output.strip() else ''
    has_a6a7 = bool(re.search(r'\[S\] A[67]:', output))
    return first_line, has_a6a7, output

if __name__ == '__main__':
    os.chdir('/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests')

    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        print('Finding FAIL files...')
        result = subprocess.run(
            ['bash', '-c', r'''find data/교과서 -maxdepth 10 \( -name "단어.json" -o -name "워크북.json" -o -name "퀴즈.json" \) | while IFS= read -r f; do result=$(node validate/validate.js "$f" 2>&1 | head -1); if echo "$result" | grep -q FAIL; then echo "$f"; fi; done'''],
            capture_output=True, text=True, timeout=600
        )
        files = [f for f in result.stdout.strip().split('\n') if f]

    total = len(files)
    fixed = 0
    still_fail = []

    for i, filepath in enumerate(files):
        print(f'[{i+1}/{total}] {filepath}')

        fl, has_a6a7, out = validate_file(filepath)
        if not has_a6a7:
            print(f'  -> No A6/A7, skip')
            continue

        was_modified = fix_file(filepath)
        if was_modified:
            fl2, has_a6a7_2, out2 = validate_file(filepath)
            if has_a6a7_2:
                print(f'  -> STILL A6/A7!')
                for line in out2.split('\n'):
                    if '[S] A6' in line or '[S] A7' in line:
                        print(f'     {line.strip()}')
                still_fail.append(filepath)
            else:
                print(f'  -> {fl2}')
                fixed += 1
        else:
            print(f'  -> No fix possible')
            still_fail.append(filepath)

    print(f'\n=== Summary ===')
    print(f'Total: {total}, Fixed: {fixed}, Still failing: {len(still_fail)}')
    if still_fail:
        for f in still_fail:
            print(f'  {f}')
