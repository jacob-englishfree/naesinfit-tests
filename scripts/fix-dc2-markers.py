#!/usr/bin/env python3
"""
DC-2 마커순서 정렬 스크립트 v2
Phase 1: passage 내 ①②③④ 마커를 텍스트 출현 순서대로 재배치
Phase 2: A6/A7 자동 해소 — 비마커 문항의 선지 스왑으로 분포 재조정

안전장치:
- fullPassage 절대 안 건드림
- passage 내 마커 번호만 재배치
- ans는 정답 단어의 새 마커번호로 업데이트
- det.analysis/korean/tip 내 마커 참조도 전부 교체
- A6/A7 해소 불가 시 해당 파일 롤백 (원본 보존)
"""

import json, re, sys, os, copy, glob
from collections import Counter

MARKERS = ['①','②','③','④','⑤']
MAX_SAME_ANS = 5   # A6: 동일번호 최대 5개
MAX_CONSEC = 2     # A7: 최대 연속 2개

# ── DC-2 마커 수정 함수들 ──

def find_markers_in_order(text):
    if not text: return []
    found = []
    for m in re.finditer(r'[①②③④⑤]', text):
        c = m.group()
        if c not in found:
            found.append(c)
    return found

def is_marker_ch(ch):
    if not ch or len(ch) < 2: return False
    return all(c.strip() in MARKERS for c in ch)

def is_marker_question(q):
    """마커형 문항인지 (선지 스왑 불가)"""
    if q.get('fmt') != 'mc': return False
    ch = q.get('ch', [])
    if is_marker_ch(ch): return True
    # 마커가 passage에 있고 det.analysis에 마커 참조가 있으면 마커형
    passage = q.get('passage') or ''
    if any(m in passage for m in MARKERS[:4]):
        t = q.get('type', '')
        if t in ['어법', '문맥상 부적절한 어휘', '오류찾기', '(A)(B)(C) 조합형']:
            return True
    return False

def build_remap(old_order):
    remap = {}
    for i, old_marker in enumerate(old_order):
        new_marker = MARKERS[i]
        if old_marker != new_marker:
            remap[old_marker] = new_marker
    return remap

def apply_remap_to_text(text, remap):
    if not remap: return text
    placeholders = {}
    for i, (old, new) in enumerate(remap.items()):
        ph = f'__MK{i}__'
        placeholders[ph] = new
        text = text.replace(old, ph)
    for ph, new in placeholders.items():
        text = text.replace(ph, new)
    return text

def fix_dc2_question(q):
    """단일 문항의 DC-2 수정. 변경 여부 반환."""
    if q.get('fmt') != 'mc': return False
    passage = q.get('passage', '')
    if not passage: return False

    old_order = find_markers_in_order(passage)
    if len(old_order) < 2: return False

    expected = sorted(old_order, key=lambda x: MARKERS.index(x))
    if old_order == expected: return False

    remap = build_remap(old_order)
    if not remap: return False

    # 1. passage 마커 재배치
    q['passage'] = apply_remap_to_text(passage, remap)

    # 2. ch 업데이트
    ch = q.get('ch', [])
    if is_marker_ch(ch):
        q['ch'] = [MARKERS[i] for i in range(len(ch))]
    else:
        if len(ch) == len(old_order):
            new_ch = [None] * len(ch)
            for i, old_m in enumerate(old_order):
                old_idx = MARKERS.index(old_m)
                if old_idx < len(ch):
                    new_ch[i] = ch[old_idx]
            if None not in new_ch:
                q['ch'] = new_ch

    # 3. ans 업데이트
    ans = q.get('ans')
    if isinstance(ans, int) and 1 <= ans <= len(MARKERS):
        old_marker = MARKERS[ans - 1]
        if old_marker in remap:
            new_marker = remap[old_marker]
            q['ans'] = MARKERS.index(new_marker) + 1

    # 4. det 업데이트
    det = q.get('det', {})
    for field in ['analysis', 'korean', 'tip']:
        val = det.get(field, '')
        if val and isinstance(val, str):
            new_val = apply_remap_to_text(val, remap)
            if new_val != val:
                det[field] = new_val

    return True


# ── A6/A7 검사 + 자동 해소 ──

def check_a6(questions):
    """A6 위반 검사: 동일 ans 번호가 MAX_SAME_ANS 초과"""
    ans_list = [q.get('ans') for q in questions if q.get('fmt') == 'mc']
    counts = Counter(ans_list)
    violations = {k: v for k, v in counts.items() if v > MAX_SAME_ANS}
    return violations

def check_a7(questions):
    """A7 위반 검사: 연속 동일 ans가 MAX_CONSEC 초과"""
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

def can_swap_question(q):
    """이 문항의 선지를 스왑할 수 있는가?"""
    if q.get('fmt') != 'mc': return False
    if is_marker_question(q): return False
    ch = q.get('ch', [])
    if len(ch) < 2: return False
    # 서술형, 순서배열 등은 스왑 불가
    t = q.get('type', '')
    if t in ['순서배열', '문장삽입']: return False
    return True

def swap_choice(q, old_ans_1idx, new_ans_1idx):
    """문항의 선지를 스왑하여 ans를 변경.
    old_ans_1idx: 현재 정답 (1-indexed)
    new_ans_1idx: 새 정답 (1-indexed)
    ch, ans, det.analysis 동시 업데이트.
    """
    ch = q.get('ch', [])
    old_idx = old_ans_1idx - 1
    new_idx = new_ans_1idx - 1

    if old_idx >= len(ch) or new_idx >= len(ch): return False

    # ch 스왑
    ch[old_idx], ch[new_idx] = ch[new_idx], ch[old_idx]
    q['ch'] = ch
    q['ans'] = new_ans_1idx

    # det.analysis 내 ①②③④ 참조 스왑
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

def fix_a6_a7(questions, verbose=False):
    """A6/A7 위반을 비마커 문항 선지 스왑으로 해소.
    전략: A6 먼저 greedy 해소 → A7 해소 시 A6 재위반 방지.
    A7 해소 시 연속 구간의 가운데 문항을 스왑 (양쪽 연속 끊기).
    Returns: (success, swap_log)
    """
    swap_log = []
    max_iterations = 80

    for iteration in range(max_iterations):
        a6 = check_a6(questions)
        a7 = check_a7(questions)

        if not a6 and not a7:
            return True, swap_log

        fixed_any = False

        # A6 먼저 해소 — 초과 번호 → 부족 번호로 스왑
        if a6:
            ans_counts = Counter(q.get('ans') for q in questions if q.get('fmt') == 'mc')
            for over_ans, count in sorted(a6.items(), key=lambda x: -x[1]):
                # 부족한 번호들 (오름차순)
                under_targets = sorted(
                    [a for a in [1,2,3,4] if a != over_ans and ans_counts.get(a, 0) < MAX_SAME_ANS],
                    key=lambda a: ans_counts.get(a, 0)
                )
                if not under_targets:
                    continue

                # over_ans인 스왑 가능 문항들 수집
                candidates = [(i, q) for i, q in enumerate(questions)
                              if q.get('ans') == over_ans and can_swap_question(q)]

                for idx, q in candidates:
                    if not check_a6(questions):
                        break
                    for target in under_targets:
                        if ans_counts.get(target, 0) >= MAX_SAME_ANS:
                            continue
                        # A7 체크: 스왑 후 이 위치에서 연속이 안 생기는지
                        old_ans = q['ans']
                        q_backup = copy.deepcopy(q)
                        swap_choice(q, old_ans, target)
                        new_a7 = check_a7(questions)
                        if new_a7:
                            # 롤백
                            q['ch'] = q_backup['ch']
                            q['ans'] = q_backup['ans']
                            q['det'] = q_backup.get('det', {})
                            continue
                        else:
                            ans_counts[old_ans] -= 1
                            ans_counts[target] += 1
                            swap_log.append(f'  A6: Q{q["id"]} ans {old_ans}→{target}')
                            fixed_any = True
                            break

        # A7 해소 — 연속 구간 끊기
        a7 = check_a7(questions)
        if a7 and not fixed_any:
            # 연속 구간 찾기 (가장 긴 것부터)
            mc_indices = [i for i, q in enumerate(questions) if q.get('fmt') == 'mc']
            runs = []  # (start_idx, length, ans_value)
            if mc_indices:
                run_start = 0
                for j in range(1, len(mc_indices)):
                    if questions[mc_indices[j]].get('ans') == questions[mc_indices[j-1]].get('ans'):
                        continue
                    else:
                        run_len = j - run_start
                        if run_len > MAX_CONSEC:
                            runs.append((run_start, run_len, questions[mc_indices[run_start]].get('ans')))
                        run_start = j
                run_len = len(mc_indices) - run_start
                if run_len > MAX_CONSEC:
                    runs.append((run_start, run_len, questions[mc_indices[run_start]].get('ans')))

            ans_counts = Counter(q.get('ans') for q in questions if q.get('fmt') == 'mc')

            for run_start, run_len, run_ans in sorted(runs, key=lambda x: -x[1]):
                # 연속 구간 가운데에서 스왑 가능한 문항 찾기
                mid = run_start + run_len // 2
                search_order = sorted(range(run_start, run_start + run_len),
                                      key=lambda x: abs(x - mid))

                for pos in search_order:
                    real_idx = mc_indices[pos]
                    q = questions[real_idx]
                    if not can_swap_question(q):
                        continue

                    for target in [1, 2, 3, 4]:
                        if target == run_ans:
                            continue
                        if ans_counts.get(target, 0) >= MAX_SAME_ANS:
                            continue
                        old_ans = q['ans']
                        q_backup = copy.deepcopy(q)
                        swap_choice(q, old_ans, target)
                        new_a6 = check_a6(questions)
                        new_a7_remaining = check_a7(questions)
                        if new_a6:
                            # A6 재위반 → 롤백
                            q['ch'] = q_backup['ch']
                            q['ans'] = q_backup['ans']
                            q['det'] = q_backup.get('det', {})
                            continue
                        else:
                            ans_counts[old_ans] -= 1
                            ans_counts[target] += 1
                            swap_log.append(f'  A7: Q{q["id"]} ans {old_ans}→{target}')
                            fixed_any = True
                            break
                    if fixed_any:
                        break
                if fixed_any:
                    break

        if not fixed_any:
            return False, swap_log

    return False, swap_log


# ── 파일 처리 ──

def process_file(filepath, dry_run=False, verbose=False, selective=False):
    """파일의 DC-2 수정 + A6/A7 자동 해소.
    selective=True: 전체 수정 실패 시 문항별 선택적 수정 시도.
    Returns: (dc2_count, a6a7_swaps, success, skipped_qs)
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'questions' not in data:
        return 0, [], True, []

    # 원본 백업 (롤백용)
    backup = copy.deepcopy(data)

    # Phase 1: DC-2 수정 (전체)
    dc2_count = 0
    for q in data['questions']:
        if fix_dc2_question(q):
            dc2_count += 1

    if dc2_count == 0:
        return 0, [], True, []

    # Phase 2: A6/A7 검사 + 자동 해소
    success, swap_log = fix_a6_a7(data['questions'], verbose=verbose)

    if success:
        if not dry_run:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return dc2_count, swap_log, True, []

    # ── 전체 수정 실패 → selective 모드 ──
    if not selective:
        return dc2_count, swap_log, False, []

    # 원본 복원
    data = copy.deepcopy(backup)

    # 문항별로 하나씩 시도: A6/A7 안전한 것만 적용
    applied_qs = []
    skipped_qs = []
    swap_log = []

    for i, q in enumerate(data['questions']):
        q_backup = copy.deepcopy(q)
        if fix_dc2_question(q):
            # A6/A7 체크
            a6 = check_a6(data['questions'])
            a7 = check_a7(data['questions'])
            if a6 or a7:
                # 비마커 스왑으로 해소 시도
                temp_success, temp_swaps = fix_a6_a7(data['questions'], verbose=False)
                if temp_success:
                    applied_qs.append(q['id'])
                    swap_log.extend(temp_swaps)
                else:
                    # 해소 불가 → 이 문항만 롤백
                    data['questions'][i] = q_backup
                    # 스왑 시도로 변경된 다른 문항도 복원
                    data = copy.deepcopy(backup)
                    # 이전 성공분 재적용
                    for j, q2 in enumerate(data['questions']):
                        if q2['id'] in applied_qs:
                            fix_dc2_question(q2)
                    # 성공분에 대한 A6/A7 재해소
                    if applied_qs:
                        fix_a6_a7(data['questions'], verbose=False)
                    skipped_qs.append(q_backup['id'])
            else:
                applied_qs.append(q['id'])

    actual_dc2 = len(applied_qs)
    if actual_dc2 > 0:
        # 최종 A6/A7 확인
        final_a6 = check_a6(data['questions'])
        final_a7 = check_a7(data['questions'])
        if final_a6 or final_a7:
            # 최종 해소 시도
            final_ok, final_swaps = fix_a6_a7(data['questions'], verbose=False)
            if final_ok:
                swap_log.extend(final_swaps)
            else:
                # 전부 롤백
                return dc2_count, swap_log, False, list(range(1, dc2_count+1))

        if not dry_run:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    return actual_dc2, swap_log, True, skipped_qs


if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    verbose = '--verbose' in args
    selective = '--selective' in args
    args = [a for a in args if not a.startswith('--')]

    if not args:
        print('Usage: python fix-dc2-markers.py <file_or_dir> [--dry-run] [--verbose] [--selective]')
        print('  Phase 1: DC-2 마커순서 정렬')
        print('  Phase 2: A6/A7 자동 해소 (비마커 문항 선지 스왑)')
        print('  --selective: 전체 수정 불가 시 문항별 선택적 수정')
        sys.exit(1)

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]

    total_dc2 = 0
    total_swaps = 0
    total_files = 0
    total_skipped = 0
    failed_files = []

    for fp in files:
        dc2_count, swap_log, success, skipped = process_file(
            fp, dry_run=dry_run, verbose=verbose, selective=selective)
        if dc2_count > 0 or skipped:
            total_files += 1
            total_dc2 += dc2_count
            total_swaps += len(swap_log)
            total_skipped += len(skipped)

            prefix = '[DRY-RUN] ' if dry_run else ''
            if success and not skipped:
                status = '✅'
            elif success and skipped:
                status = f'⚠️ PARTIAL (skipped Q{",Q".join(str(s) for s in skipped)})'
            else:
                status = '❌ ROLLBACK'
            print(f'{prefix}{status} {fp}: DC-2 {dc2_count}건 수정, A6/A7 스왑 {len(swap_log)}건')
            for log in swap_log:
                print(log)

            if not success:
                failed_files.append(fp)

    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"} ===')
    print(f'DC-2 수정: {total_dc2}건 in {total_files} files')
    print(f'A6/A7 스왑: {total_swaps}건')
    if total_skipped:
        print(f'⚠️ 선택적 스킵: {total_skipped} questions (구조적 한계)')
    if failed_files:
        print(f'❌ 롤백 (A6/A7 미해소): {len(failed_files)}건')
        for f in failed_files:
            print(f'  {f}')
    else:
        print(f'✅ 전부 성공')
