#!/usr/bin/env python3
"""
DC-2 + SEM-3 통합 수정 스크립트 v3

핵심 로직:
1. 어법 문항에서 passage의 <u>밑줄</u> 텍스트 출현 순서 추출
2. 각 밑줄에 인접한 마커(①②③④) 확인
3. ch 항목을 밑줄 단어로 매칭하여 텍스트 순서대로 재배열
4. passage 마커를 ①②③④ 텍스트 순서로 재번호
5. ch 내 마커 라벨도 갱신
6. ans 업데이트

A6/A7 해소: 어법/마커형 유형은 절대 스왑 금지.
해소 불가 시: 해당 문항의 DC-2+SEM-3 수정 자체를 스킵 (원본 보존).
"""

import json, re, sys, os, glob, copy
from collections import Counter

MARKERS = ['①','②','③','④','⑤']
MAX_SAME_ANS = 5
MAX_CONSEC = 2

# 이 유형들은 ch 순서가 passage 구조에 의존 → A6/A7 스왑 금지
NO_SWAP_TYPES = {
    '어법', '문맥상 부적절한 어휘', '오류찾기',
    '(A)(B)(C) 조합형', '순서배열', '문장삽입', '어순배열',
    '빈칸 어휘 완성', '빈칸 문맥 완성',
}

MARKER_QUESTION_TYPES = {'어법', '문맥상 부적절한 어휘', '오류찾기'}


def get_underline_marker_pairs(passage):
    """passage에서 (텍스트위치, 마커, 밑줄단어) 쌍을 텍스트 순서로 반환.
    마커와 밑줄이 인접한 (10글자 이내) 경우만 매칭.
    """
    if not passage:
        return []

    pairs = []
    # 모든 마커 위치
    marker_positions = [(m.start(), m.group()) for m in re.finditer(r'[①②③④⑤]', passage)]
    # 모든 밑줄 위치
    underline_positions = [(m.start(), m.group(1)) for m in re.finditer(r'<u>(.*?)</u>', passage)]

    # 각 마커에 가장 가까운 밑줄 매칭
    used_underlines = set()
    for mpos, mchar in marker_positions:
        best_dist = 999
        best_ul = None
        best_ul_idx = None
        for ui, (upos, uword) in enumerate(underline_positions):
            if ui in used_underlines:
                continue
            dist = abs(upos - mpos)
            if dist < best_dist and dist < 20:  # 20글자 이내
                best_dist = dist
                best_ul = uword
                best_ul_idx = ui
        if best_ul is not None:
            pairs.append((mpos, mchar, best_ul))
            used_underlines.add(best_ul_idx)

    # 텍스트 순서로 정렬
    pairs.sort(key=lambda x: x[0])
    return pairs


def fix_question_unified(q):
    """어법 문항의 DC-2 + SEM-3 동시 수정.
    passage 마커를 텍스트 순서 ①②③④로 재번호 + ch 재배열.
    Returns: (modified: bool, old_ans: int, new_ans: int)
    """
    if q.get('type') not in MARKER_QUESTION_TYPES:
        return False, 0, 0
    if q.get('fmt') != 'mc':
        return False, 0, 0

    ch = q.get('ch', [])
    passage = q.get('passage') or ''
    if not ch or not passage:
        return False, 0, 0

    # 마커형 ch (["①","②","③","④"])는 건너뜀 — 단어형만 처리
    if all(c.strip() in MARKERS for c in ch):
        # 마커형이라도 passage 마커 순서 체크
        pairs = get_underline_marker_pairs(passage)
        if not pairs or len(pairs) < 2:
            return False, 0, 0
        # 마커가 이미 텍스트 순서인지 확인
        current_markers = [p[1] for p in pairs]
        expected = [MARKERS[i] for i in range(len(current_markers))]
        if current_markers == expected:
            return False, 0, 0
        # 마커 재번호 + ans 업데이트
        remap = {}
        for i, (_, old_m, _) in enumerate(pairs):
            new_m = MARKERS[i]
            if old_m != new_m:
                remap[old_m] = new_m
        if not remap:
            return False, 0, 0
        # passage 마커 재번호 (플레이스홀더 방식)
        new_passage = passage
        phs = {}
        for j, (old_m, new_m) in enumerate(remap.items()):
            ph = f'__MK{j}__'
            phs[ph] = new_m
            new_passage = new_passage.replace(old_m, ph)
        for ph, new_m in phs.items():
            new_passage = new_passage.replace(ph, new_m)
        q['passage'] = new_passage
        # ans 업데이트
        old_ans = q.get('ans', 0)
        if isinstance(old_ans, int) and 1 <= old_ans <= len(MARKERS):
            old_m = MARKERS[old_ans - 1]
            if old_m in remap:
                new_m = remap[old_m]
                q['ans'] = MARKERS.index(new_m) + 1
        # det 마커 갱신
        det = q.get('det', {})
        for field in ['analysis', 'korean', 'tip']:
            val = det.get(field, '')
            if val and isinstance(val, str) and remap:
                new_val = val
                ph2 = {}
                for j, (old_m, new_m) in enumerate(remap.items()):
                    ph = f'__DT{j}__'
                    ph2[ph] = new_m
                    new_val = new_val.replace(old_m, ph)
                for ph, new_m in ph2.items():
                    new_val = new_val.replace(ph, new_m)
                if new_val != val:
                    det[field] = new_val
        return True, old_ans, q.get('ans', 0)

    # ── 단어형 ch 처리 ──
    pairs = get_underline_marker_pairs(passage)
    if not pairs or len(pairs) < 2:
        return False, 0, 0

    # 이미 올바른지 확인: ch 순서 == 밑줄 텍스트 순서 AND 마커 ①②③④ 순서
    ul_words = [p[2].lower() for p in pairs]
    current_markers = [p[1] for p in pairs]
    expected_markers = [MARKERS[i] for i in range(len(current_markers))]

    # ch에서 주요 단어 추출 (마커 제거)
    def ch_main_word(ch_text):
        clean = re.sub(r'^[①②③④⑤]\s*', '', ch_text).strip()
        # "was → were" 형식에서 첫 단어
        first = clean.split()[0] if clean else ''
        # 특수문자 제거
        first = re.sub(r'[^a-zA-Z]', '', first)
        return first.lower()

    ch_words = [ch_main_word(c) for c in ch]

    # ch → 밑줄 매칭 (단어 기반)
    ch_to_ul_idx = {}
    used_uls = set()
    for ci, cw in enumerate(ch_words):
        best_idx = None
        best_score = 0
        for ui, uw in enumerate(ul_words):
            if ui in used_uls:
                continue
            # 부분 매칭
            if cw == uw:
                score = 100
            elif cw in uw or uw in cw:
                score = 50
            elif cw[:4] == uw[:4] and len(cw) >= 4:
                score = 30
            else:
                score = 0
            if score > best_score:
                best_score = score
                best_idx = ui
        if best_idx is not None and best_score > 0:
            ch_to_ul_idx[ci] = best_idx
            used_uls.add(best_idx)

    if len(ch_to_ul_idx) < len(pairs):
        # 매칭 부족 — 매칭 안 된 것들을 순서대로 채움
        unmatched_ch = [i for i in range(len(ch)) if i not in ch_to_ul_idx]
        unmatched_ul = [i for i in range(len(pairs)) if i not in used_uls]
        for ci, ui in zip(unmatched_ch, unmatched_ul):
            ch_to_ul_idx[ci] = ui

    # 올바른 순서 확인: ch[i]가 i번째 밑줄에 매칭되어야 함
    already_correct = all(ch_to_ul_idx.get(i) == i for i in range(min(len(ch), len(pairs))))
    markers_correct = current_markers == expected_markers

    if already_correct and markers_correct:
        return False, 0, 0

    # ── 재배열 실행 ──
    old_ans = q.get('ans', 0)

    # ch 재배열: ul_idx 순서대로
    new_ch = [None] * len(ch)
    old_to_new_pos = {}

    # 각 밑줄 인덱스(텍스트 순서)에 해당하는 ch를 새 위치에 배치
    for old_ci, ul_idx in sorted(ch_to_ul_idx.items(), key=lambda x: x[1]):
        new_pos = ul_idx
        if new_pos < len(ch):
            old_text = ch[old_ci]
            # 마커 라벨 갱신
            new_marker = MARKERS[new_pos]
            new_text = re.sub(r'^[①②③④⑤]', new_marker, old_text)
            new_ch[new_pos] = new_text
            old_to_new_pos[old_ci] = new_pos

    # 빈 슬롯 채우기 (매칭 안 된 ch)
    empty_slots = [i for i in range(len(ch)) if new_ch[i] is None]
    remaining_ch = [i for i in range(len(ch)) if i not in old_to_new_pos]
    for slot, old_ci in zip(empty_slots, remaining_ch):
        new_ch[slot] = ch[old_ci]
        old_to_new_pos[old_ci] = slot

    if None in new_ch:
        return False, 0, 0

    q['ch'] = new_ch

    # ans 업데이트
    if isinstance(old_ans, int) and 1 <= old_ans <= len(ch):
        old_ans_idx = old_ans - 1
        if old_ans_idx in old_to_new_pos:
            q['ans'] = old_to_new_pos[old_ans_idx] + 1

    # passage 마커 재번호 (①②③④ 텍스트 순서로)
    if not markers_correct:
        remap = {}
        for i, (_, old_m, _) in enumerate(pairs):
            new_m = MARKERS[i]
            if old_m != new_m:
                remap[old_m] = new_m
        if remap:
            new_passage = passage
            phs = {}
            for j, (old_m, new_m) in enumerate(remap.items()):
                ph = f'__MK{j}__'
                phs[ph] = new_m
                new_passage = new_passage.replace(old_m, ph)
            for ph, new_m in phs.items():
                new_passage = new_passage.replace(ph, new_m)
            q['passage'] = new_passage

    # det 업데이트
    det = q.get('det', {})
    remap_det = {}
    for old_ci, new_pos in old_to_new_pos.items():
        if old_ci != new_pos:
            remap_det[MARKERS[old_ci]] = MARKERS[new_pos]
    if remap_det:
        for field in ['analysis', 'korean', 'tip']:
            val = det.get(field, '')
            if val and isinstance(val, str):
                new_val = val
                phs = {}
                for j, (old_m, new_m) in enumerate(remap_det.items()):
                    ph = f'__DT{j}__'
                    phs[ph] = new_m
                    new_val = new_val.replace(old_m, ph)
                for ph, new_m in phs.items():
                    new_val = new_val.replace(ph, new_m)
                if new_val != val:
                    det[field] = new_val

    return True, old_ans, q.get('ans', 0)


# ── A6/A7 (어법 절대 금지) ──

def check_a6(qs):
    c = Counter(q.get('ans') for q in qs if q.get('fmt')=='mc')
    return {k:v for k,v in c.items() if v > MAX_SAME_ANS}

def check_a7(qs):
    mc = [(i,q) for i,q in enumerate(qs) if q.get('fmt')=='mc']
    viols = []; con = 1
    for j in range(1, len(mc)):
        if mc[j][1].get('ans') == mc[j-1][1].get('ans'):
            con += 1
            if con > MAX_CONSEC: viols.append((mc[j][0], mc[j][1].get('ans')))
        else: con = 1
    return viols

def can_safe_swap(q):
    if q.get('fmt') != 'mc': return False
    if q.get('type', '') in NO_SWAP_TYPES: return False
    ch = q.get('ch', [])
    if len(ch) < 2: return False
    if all(c.strip() in MARKERS for c in ch): return False
    return True

def swap_ch(q, oa, na):
    ch = q.get('ch', [])
    oi, ni = oa-1, na-1
    if oi >= len(ch) or ni >= len(ch): return False
    ch[oi], ch[ni] = ch[ni], ch[oi]
    q['ch'] = ch; q['ans'] = na
    return True

def fix_a6a7(qs):
    log = []
    for _ in range(50):
        a6 = check_a6(qs); a7 = check_a7(qs)
        if not a6 and not a7: return True, log
        done = False
        if a6:
            ac = Counter(q.get('ans') for q in qs if q.get('fmt')=='mc')
            for oa in sorted(a6, key=lambda x:-a6[x]):
                tgts = sorted([a for a in [1,2,3,4] if a!=oa and ac.get(a,0)<MAX_SAME_ANS], key=lambda a:ac.get(a,0))
                for q in qs:
                    if q.get('ans')==oa and can_safe_swap(q):
                        for t in tgts:
                            if ac.get(t,0)>=MAX_SAME_ANS: continue
                            bk=copy.deepcopy(q)
                            swap_ch(q,oa,t)
                            if check_a7(qs):
                                q['ch']=bk['ch'];q['ans']=bk['ans'];continue
                            ac[oa]-=1;ac[t]+=1
                            log.append(f'  A6: Q{q["id"]} {oa}→{t}')
                            done=True;break
                        if done: break
                if done: break
        if not done and a7:
            ac=Counter(q.get('ans') for q in qs if q.get('fmt')=='mc')
            for qi,ca in a7:
                q=qs[qi]
                if can_safe_swap(q):
                    for t in [1,2,3,4]:
                        if t==ca or ac.get(t,0)>=MAX_SAME_ANS: continue
                        bk=copy.deepcopy(q)
                        swap_ch(q,ca,t)
                        if check_a6(qs):
                            q['ch']=bk['ch'];q['ans']=bk['ans'];continue
                        ac[ca]-=1;ac[t]+=1
                        log.append(f'  A7: Q{q["id"]} {ca}→{t}')
                        done=True;break
                if done: break
        if not done: return False, log
    return False, log


def process_file(filepath, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if 'questions' not in data:
        return 0, [], True, []

    backup = copy.deepcopy(data)

    # 문항별 선택적 적용
    applied = []
    skipped = []

    for i, q in enumerate(data['questions']):
        q_backup = copy.deepcopy(q)
        modified, old_ans, new_ans = fix_question_unified(q)
        if not modified:
            continue

        # A6/A7 체크
        a6 = check_a6(data['questions'])
        a7 = check_a7(data['questions'])
        if a6 or a7:
            ok, _ = fix_a6a7(data['questions'])
            if not ok:
                # 이 문항 롤백
                data['questions'][i] = q_backup
                # 이전 스왑도 롤백해야 할 수 있음 — 전체 복원 후 재적용
                data = copy.deepcopy(backup)
                for prev_qi in applied:
                    for j, q2 in enumerate(data['questions']):
                        if q2.get('id') == prev_qi:
                            fix_question_unified(q2)
                # 이전 성공분에 대한 A6/A7 재해소
                if applied:
                    fix_a6a7(data['questions'])
                skipped.append(q_backup.get('id', i+1))
                continue

        applied.append(q.get('id', i+1))

    if not applied:
        return 0, [], True, skipped

    # 최종 검증
    final_a6 = check_a6(data['questions'])
    final_a7 = check_a7(data['questions'])
    swap_log = []
    if final_a6 or final_a7:
        ok, swap_log = fix_a6a7(data['questions'])
        if not ok:
            return len(applied), swap_log, False, skipped

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return len(applied), swap_log, True, skipped


if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if not a.startswith('--')]
    if not args:
        print('Usage: python fix-dc2-sem3-unified.py <file_or_dir> [--dry-run]')
        sys.exit(1)

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]

    total = 0; tf = 0; failed = []; total_skip = 0
    for fp in files:
        c, swaps, ok, skipped = process_file(fp, dry_run=dry_run)
        if c > 0 or skipped:
            tf += 1; total += c; total_skip += len(skipped)
            pfx = '[DRY-RUN] ' if dry_run else ''
            if ok and not skipped:
                st = '✅'
            elif ok and skipped:
                st = f'⚠️ PARTIAL(skip Q{",Q".join(str(s) for s in skipped)})'
            else:
                st = '❌'
            print(f'{pfx}{st} {fp}: {c}건 수정, 스왑 {len(swaps)}, 스킵 {len(skipped)}')
            for s in swaps: print(s)
            if not ok: failed.append(fp)

    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"}: {total}건/{tf} files, 스킵 {total_skip}q, 실패 {len(failed)} ===')
