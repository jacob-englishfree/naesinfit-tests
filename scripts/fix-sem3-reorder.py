#!/usr/bin/env python3
"""
SEM-3 수정 스크립트: 어법 문항의 ch를 passage 마커/밑줄 순서에 맞춰 재정렬
+ A6/A7 재발생 시 비어법 비마커 문항으로만 해소

DC-2 적용 후 A6/A7 스왑이 어법 ch 순서를 깨뜨린 경우 사용
"""

import json, re, sys, os, glob, copy
from collections import Counter

MARKERS = ['①','②','③','④','⑤']
MAX_SAME_ANS = 5
MAX_CONSEC = 2

# 스왑 절대 금지 유형 (ch 순서가 passage 구조에 의존)
NO_SWAP_TYPES = {
    '어법', '문맥상 부적절한 어휘', '오류찾기',
    '(A)(B)(C) 조합형', '순서배열', '문장삽입', '어순배열',
    '빈칸 어휘 완성', '빈칸 문맥 완성',
}

def extract_marker_from_ch(ch_text):
    """ch 항목에서 마커 번호 추출: "② laughing" → '②'"""
    ch_text = ch_text.strip()
    for m in MARKERS:
        if ch_text.startswith(m):
            return m
    return None

def find_marker_order_in_passage(passage):
    """passage에서 마커 출현 순서 반환"""
    if not passage: return []
    found = []
    for m in re.finditer(r'[①②③④⑤]', passage):
        c = m.group()
        if c not in found:
            found.append(c)
    return found

def fix_sem3_question(q):
    """어법 문항의 ch를 passage 마커 순서에 맞춰 재정렬.
    Returns: True if modified, False otherwise.
    """
    if q.get('type') not in ['어법', '문맥상 부적절한 어휘', '오류찾기']:
        return False
    if q.get('fmt') != 'mc':
        return False

    ch = q.get('ch', [])
    passage = q.get('passage') or ''
    if not ch or not passage:
        return False

    # ch가 마커형(["①","②","③","④"])이면 이미 정렬됨
    if all(c.strip() in MARKERS for c in ch):
        return False

    # ch에서 마커 번호 추출
    ch_markers = [extract_marker_from_ch(c) for c in ch]
    if None in ch_markers:
        return False  # 마커 추출 불가

    # passage에서 마커 출현 순서
    passage_order = find_marker_order_in_passage(passage)
    if len(passage_order) < 2:
        return False

    # 현재 ch의 마커 순서가 passage 순서와 일치하면 수정 불필요
    ch_marker_order = [m for m in ch_markers if m in passage_order]
    expected_order = [m for m in passage_order if m in ch_markers]

    if ch_marker_order == expected_order:
        return False

    # ch를 passage 마커 순서로 재정렬
    marker_to_ch = {ch_markers[i]: ch[i] for i in range(len(ch))}
    new_ch = []
    for m in expected_order:
        if m in marker_to_ch:
            new_ch.append(marker_to_ch[m])
    # 남은 ch 항목 추가 (마커 없는 것들)
    used_markers = set(expected_order)
    for i, m in enumerate(ch_markers):
        if m not in used_markers:
            new_ch.append(ch[i])

    if len(new_ch) != len(ch):
        return False

    # ans 업데이트: 정답 ch가 이동한 위치
    old_ans = q.get('ans')
    if isinstance(old_ans, int) and 1 <= old_ans <= len(ch):
        ans_ch = ch[old_ans - 1]  # 정답 ch 내용
        try:
            new_ans = new_ch.index(ans_ch) + 1
        except ValueError:
            return False
        q['ans'] = new_ans

    q['ch'] = new_ch

    # det.analysis 내 마커 참조는 passage 기준이므로 변경 불필요
    return True


def check_a6(questions):
    ans_list = [q.get('ans') for q in questions if q.get('fmt') == 'mc']
    counts = Counter(ans_list)
    return {k: v for k, v in counts.items() if v > MAX_SAME_ANS}

def check_a7(questions):
    mc_qs = [(i, q) for i, q in enumerate(questions) if q.get('fmt') == 'mc']
    violations = []
    consec = 1
    for j in range(1, len(mc_qs)):
        if mc_qs[j][1].get('ans') == mc_qs[j-1][1].get('ans'):
            consec += 1
            if consec > MAX_CONSEC:
                violations.append((mc_qs[j][0], mc_qs[j][1].get('ans')))
        else:
            consec = 1
    return violations

def can_safe_swap(q):
    """A6/A7 해소용 스왑 가능 여부 — 어법/마커 관련 유형 절대 금지"""
    if q.get('fmt') != 'mc': return False
    t = q.get('type', '')
    if t in NO_SWAP_TYPES: return False
    ch = q.get('ch', [])
    if len(ch) < 2: return False
    if all(c.strip() in MARKERS for c in ch): return False
    passage = q.get('passage') or ''
    if any(m in passage for m in MARKERS[:4]):
        if t in ['어법', '문맥상 부적절한 어휘', '오류찾기']:
            return False
    return True

def swap_choice_safe(q, old_ans, new_ans):
    """안전한 선지 스왑 (마커 없는 유형만)"""
    ch = q.get('ch', [])
    old_idx = old_ans - 1
    new_idx = new_ans - 1
    if old_idx >= len(ch) or new_idx >= len(ch): return False
    ch[old_idx], ch[new_idx] = ch[new_idx], ch[old_idx]
    q['ch'] = ch
    q['ans'] = new_ans
    det = q.get('det', {})
    analysis = det.get('analysis', '')
    if analysis:
        old_m = MARKERS[old_idx]
        new_m = MARKERS[new_idx]
        ph_old = '__SWAP_OLD__'
        ph_new = '__SWAP_NEW__'
        analysis = analysis.replace(old_m, ph_old)
        analysis = analysis.replace(new_m, ph_new)
        analysis = analysis.replace(ph_old, new_m)
        analysis = analysis.replace(ph_new, old_m)
        det['analysis'] = analysis
    return True

def fix_a6a7_safe(questions):
    """비어법/비마커 문항만으로 A6/A7 해소"""
    swap_log = []
    for _ in range(50):
        a6 = check_a6(questions)
        a7 = check_a7(questions)
        if not a6 and not a7:
            return True, swap_log

        fixed = False
        if a6:
            ans_counts = Counter(q.get('ans') for q in questions if q.get('fmt') == 'mc')
            for over_ans in sorted(a6, key=lambda x: -a6[x]):
                under_targets = sorted(
                    [a for a in [1,2,3,4] if a != over_ans and ans_counts.get(a,0) < MAX_SAME_ANS],
                    key=lambda a: ans_counts.get(a,0)
                )
                for i, q in enumerate(questions):
                    if q.get('ans') == over_ans and can_safe_swap(q):
                        for target in under_targets:
                            if ans_counts.get(target, 0) >= MAX_SAME_ANS: continue
                            q_bk = copy.deepcopy(q)
                            swap_choice_safe(q, over_ans, target)
                            if check_a7(questions):
                                q['ch'] = q_bk['ch']; q['ans'] = q_bk['ans']
                                q['det'] = q_bk.get('det', {})
                                continue
                            ans_counts[over_ans] -= 1
                            ans_counts[target] += 1
                            swap_log.append(f'  A6-safe: Q{q["id"]} ans {over_ans}→{target}')
                            fixed = True
                            break
                        if fixed: break
                if fixed: break

        if not fixed and a7:
            mc_indices = [i for i, q in enumerate(questions) if q.get('fmt') == 'mc']
            ans_counts = Counter(q.get('ans') for q in questions if q.get('fmt') == 'mc')
            for q_idx, consec_ans in a7:
                q = questions[q_idx]
                if can_safe_swap(q):
                    for target in [1,2,3,4]:
                        if target == consec_ans: continue
                        if ans_counts.get(target, 0) >= MAX_SAME_ANS: continue
                        q_bk = copy.deepcopy(q)
                        swap_choice_safe(q, consec_ans, target)
                        new_a6 = check_a6(questions)
                        if new_a6:
                            q['ch'] = q_bk['ch']; q['ans'] = q_bk['ans']
                            q['det'] = q_bk.get('det', {})
                            continue
                        ans_counts[consec_ans] -= 1
                        ans_counts[target] += 1
                        swap_log.append(f'  A7-safe: Q{q["id"]} ans {consec_ans}→{target}')
                        fixed = True
                        break
                if fixed: break

        if not fixed:
            return False, swap_log
    return False, swap_log


def process_file(filepath, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'questions' not in data:
        return 0, [], True

    backup = copy.deepcopy(data)

    # Phase 1: SEM-3 수정 (어법 ch 순서 복원)
    sem3_count = 0
    for q in data['questions']:
        if fix_sem3_question(q):
            sem3_count += 1

    if sem3_count == 0:
        return 0, [], True

    # Phase 2: A6/A7 해소 (비어법만으로)
    a6 = check_a6(data['questions'])
    a7 = check_a7(data['questions'])

    swap_log = []
    if a6 or a7:
        success, swap_log = fix_a6a7_safe(data['questions'])
        if not success:
            # A6/A7 해소 실패 → SEM-3 수정도 롤백
            data['questions'] = backup['questions']
            return sem3_count, swap_log, False

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return sem3_count, swap_log, True


if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if not a.startswith('--')]

    if not args:
        print('Usage: python fix-sem3-reorder.py <file_or_dir> [--dry-run]')
        sys.exit(1)

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]

    total_sem3 = 0
    total_files = 0
    failed = []

    for fp in files:
        count, swaps, success = process_file(fp, dry_run=dry_run)
        if count > 0:
            total_files += 1
            total_sem3 += count
            prefix = '[DRY-RUN] ' if dry_run else ''
            status = '✅' if success else '❌'
            print(f'{prefix}{status} {fp}: SEM-3 {count}건 수정, 스왑 {len(swaps)}건')
            for s in swaps:
                print(s)
            if not success:
                failed.append(fp)

    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"}: SEM-3 {total_sem3}건 in {total_files} files ===')
    if failed:
        print(f'❌ 실패: {len(failed)}건')
        for f in failed:
            print(f'  {f}')
