#!/usr/bin/env python3
"""
SEM-3 완전 수정 스크립트
어법 문항에서 ch를 passage의 marker+underline 순서에 정확히 매칭.

원리:
1. passage에서 각 마커(①②③④) 위치의 밑줄 단어(<u>word</u>)를 추출
2. ch 각 항목이 어떤 밑줄 단어를 포함하는지 매칭
3. ch 순서를 마커 순서(①→②→③→④)에 맞게 재배열
4. ch 텍스트 내 마커 라벨도 새 위치에 맞게 갱신
5. ans 업데이트

A6/A7 연쇄 발생 시 비어법 문항으로만 해소.
"""

import json, re, sys, os, glob, copy
from collections import Counter

MARKERS = ['①','②','③','④','⑤']
MAX_SAME_ANS = 5
MAX_CONSEC = 2

NO_SWAP_TYPES = {
    '어법', '문맥상 부적절한 어휘', '오류찾기',
    '(A)(B)(C) 조합형', '순서배열', '문장삽입', '어순배열',
}


def get_marker_underline_map(passage):
    """passage에서 각 마커 직후의 <u>단어</u>를 추출.
    Returns: {①: "word1", ②: "word2", ...}
    """
    if not passage:
        return {}
    result = {}
    # 마커 직후(0~5글자 이내) <u>단어</u> 패턴
    for m in MARKERS[:5]:
        idx = passage.find(m)
        if idx < 0:
            continue
        # 마커 이후 텍스트에서 가장 가까운 <u>...</u> 찾기
        after = passage[idx+1:idx+100]
        u_match = re.search(r'<u>(.*?)</u>', after)
        if u_match:
            result[m] = u_match.group(1).strip()
    return result


def match_ch_to_underline(ch_list, marker_underline):
    """ch 항목을 passage의 marker→underline 매핑에 따라 매칭.
    Returns: {marker: ch_index} 또는 None (매칭 불가)
    """
    markers_in_order = sorted(marker_underline.keys(), key=lambda m: MARKERS.index(m))

    # 각 underline 단어가 어느 ch에 있는지 찾기
    marker_to_ch_idx = {}
    used_ch = set()

    for marker in markers_in_order:
        uword = marker_underline[marker].lower()
        best_idx = None
        best_score = 0

        for i, ch in enumerate(ch_list):
            if i in used_ch:
                continue
            ch_lower = ch.lower()
            # 마커 제거 후 비교
            ch_clean = re.sub(r'^[①②③④⑤]\s*', '', ch_lower).strip()

            # 완전 포함 매칭
            if uword in ch_clean:
                score = len(uword)
                # 첫 단어 매칭이면 보너스
                first_word = ch_clean.split()[0] if ch_clean else ''
                if first_word.startswith(uword) or uword.startswith(first_word):
                    score += 100
                if score > best_score:
                    best_score = score
                    best_idx = i

        if best_idx is not None:
            marker_to_ch_idx[marker] = best_idx
            used_ch.add(best_idx)

    if len(marker_to_ch_idx) != len(markers_in_order):
        return None

    return marker_to_ch_idx


def fix_sem3_question(q):
    """어법 문항의 ch를 passage marker+underline 순서에 완전 매칭.
    Returns: True if modified.
    """
    if q.get('type') not in ['어법', '문맥상 부적절한 어휘', '오류찾기']:
        return False
    if q.get('fmt') != 'mc':
        return False

    ch = q.get('ch', [])
    passage = q.get('passage') or ''
    if not ch or not passage:
        return False

    # 마커형 ch는 이미 OK
    if all(c.strip() in MARKERS for c in ch):
        return False

    # passage에서 marker→underline 매핑
    mu_map = get_marker_underline_map(passage)
    if len(mu_map) < 2:
        return False

    markers_in_order = sorted(mu_map.keys(), key=lambda m: MARKERS.index(m))

    # 현재 ch가 이미 올바른 순서인지 확인
    match = match_ch_to_underline(ch, mu_map)
    if match is None:
        return False

    # 이미 올바른 순서인지 확인
    already_correct = True
    for i, marker in enumerate(markers_in_order):
        if i < len(ch) and match.get(marker) != i:
            already_correct = False
            break

    if already_correct:
        return False

    # ch 재배열: marker 순서에 따라
    new_ch = [None] * len(ch)
    old_to_new = {}

    for new_pos, marker in enumerate(markers_in_order):
        old_pos = match[marker]
        if new_pos < len(ch):
            old_ch_text = ch[old_pos]
            # 마커 라벨 갱신: 기존 마커를 새 위치의 마커로 교체
            new_marker = MARKERS[new_pos]
            # ch 텍스트에서 기존 마커를 찾아 교체
            new_ch_text = re.sub(r'^[①②③④⑤]', new_marker, old_ch_text)
            new_ch[new_pos] = new_ch_text
            old_to_new[old_pos] = new_pos

    # 마커 범위 밖 ch (있으면) 채우기
    for i in range(len(ch)):
        if new_ch[i] is None:
            # 아직 배치 안 된 ch 항목 찾기
            for j in range(len(ch)):
                if j not in old_to_new:
                    new_ch[i] = ch[j]
                    old_to_new[j] = i
                    break

    if None in new_ch:
        return False

    # ans 업데이트
    old_ans = q.get('ans')
    if isinstance(old_ans, int) and 1 <= old_ans <= len(ch):
        old_ans_idx = old_ans - 1
        if old_ans_idx in old_to_new:
            q['ans'] = old_to_new[old_ans_idx] + 1

    q['ch'] = new_ch

    # det.analysis 내 마커 참조 업데이트
    det = q.get('det', {})
    analysis = det.get('analysis', '')
    if analysis:
        # 마커 재매핑 빌드
        remap = {}
        for old_pos, new_pos in old_to_new.items():
            old_m = MARKERS[old_pos]
            new_m = MARKERS[new_pos]
            if old_m != new_m:
                remap[old_m] = new_m

        if remap:
            # 충돌 방지: 플레이스홀더 사용
            phs = {}
            for i, (old_m, new_m) in enumerate(remap.items()):
                ph = f'__MRK{i}__'
                phs[ph] = new_m
                analysis = analysis.replace(old_m, ph)
            for ph, new_m in phs.items():
                analysis = analysis.replace(ph, new_m)
            det['analysis'] = analysis

    return True


# ── A6/A7 (safe swap) ──

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
    if q.get('fmt') != 'mc': return False
    t = q.get('type', '')
    if t in NO_SWAP_TYPES: return False
    ch = q.get('ch', [])
    if len(ch) < 2: return False
    if all(c.strip() in MARKERS for c in ch): return False
    return True

def swap_choice(q, old_ans, new_ans):
    ch = q.get('ch', [])
    oi, ni = old_ans-1, new_ans-1
    if oi >= len(ch) or ni >= len(ch): return False
    ch[oi], ch[ni] = ch[ni], ch[oi]
    q['ch'] = ch
    q['ans'] = new_ans
    return True

def fix_a6a7_safe(questions):
    swap_log = []
    for _ in range(50):
        a6 = check_a6(questions)
        a7 = check_a7(questions)
        if not a6 and not a7: return True, swap_log
        fixed = False
        if a6:
            ac = Counter(q.get('ans') for q in questions if q.get('fmt')=='mc')
            for oa in sorted(a6, key=lambda x: -a6[x]):
                targets = sorted([a for a in [1,2,3,4] if a!=oa and ac.get(a,0)<MAX_SAME_ANS], key=lambda a: ac.get(a,0))
                for i, q in enumerate(questions):
                    if q.get('ans')==oa and can_safe_swap(q):
                        for t in targets:
                            if ac.get(t,0)>=MAX_SAME_ANS: continue
                            bk = copy.deepcopy(q)
                            swap_choice(q, oa, t)
                            if check_a7(questions):
                                q['ch']=bk['ch']; q['ans']=bk['ans']
                                continue
                            ac[oa]-=1; ac[t]+=1
                            swap_log.append(f'  A6: Q{q["id"]} {oa}→{t}')
                            fixed=True; break
                        if fixed: break
                if fixed: break
        if not fixed and a7:
            ac = Counter(q.get('ans') for q in questions if q.get('fmt')=='mc')
            for qi,ca in a7:
                q=questions[qi]
                if can_safe_swap(q):
                    for t in [1,2,3,4]:
                        if t==ca or ac.get(t,0)>=MAX_SAME_ANS: continue
                        bk=copy.deepcopy(q)
                        swap_choice(q, ca, t)
                        if check_a6(questions):
                            q['ch']=bk['ch']; q['ans']=bk['ans']; continue
                        ac[ca]-=1; ac[t]+=1
                        swap_log.append(f'  A7: Q{q["id"]} {ca}→{t}')
                        fixed=True; break
                if fixed: break
        if not fixed: return False, swap_log
    return False, swap_log


def process_file(filepath, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'questions' not in data:
        return 0, [], True

    backup = copy.deepcopy(data)
    count = 0
    for q in data['questions']:
        if fix_sem3_question(q):
            count += 1
    if count == 0:
        return 0, [], True

    a6 = check_a6(data['questions'])
    a7 = check_a7(data['questions'])
    swap_log = []
    if a6 or a7:
        ok, swap_log = fix_a6a7_safe(data['questions'])
        if not ok:
            data['questions'] = backup['questions']
            return count, swap_log, False

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return count, swap_log, True


if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if not a.startswith('--')]
    if not args:
        print('Usage: python fix-sem3-complete.py <file_or_dir> [--dry-run]')
        sys.exit(1)

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]

    total = 0; total_files = 0; failed = []
    for fp in files:
        c, swaps, ok = process_file(fp, dry_run=dry_run)
        if c > 0:
            total_files += 1; total += c
            prefix = '[DRY-RUN] ' if dry_run else ''
            status = '✅' if ok else '❌'
            print(f'{prefix}{status} {fp}: {c}건, 스왑 {len(swaps)}건')
            for s in swaps: print(s)
            if not ok: failed.append(fp)

    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"}: {total}건 in {total_files} files, 실패 {len(failed)} ===')
    for f in failed: print(f'  ❌ {f}')
