#!/usr/bin/env python3
"""
DC-2 마커순서 정렬 스크립트
passage 내 ①②③④ 마커를 텍스트 출현 순서대로 ①②③④로 재배치
+ ch, ans, det.analysis, det.korean, det.tip 전부 동기화

안전장치:
- fullPassage 절대 안 건드림
- passage 내 마커 번호만 재배치
- ans는 정답 단어의 새 마커번호로 업데이트
- det.analysis 내 ①②③④ 참조도 전부 교체
"""

import json, re, sys, os, copy

MARKERS = ['①','②','③','④','⑤']
MARKER_TYPES = ['어법', '문맥상 부적절한 어휘', '오류찾기', '어휘',
                '(A)(B)(C) 조합형', '빈칸 어휘 완성', '빈칸 문맥 완성',
                '동의어 고르기', '반의어 고르기']

def find_markers_in_order(text):
    """passage에서 마커 출현 순서 반환 (중복 제거)"""
    if not text: return []
    found = []
    for m in re.finditer(r'[①②③④⑤]', text):
        c = m.group()
        if c not in found:
            found.append(c)
    return found

def is_marker_ch(ch):
    """ch가 마커형인지 (["①","②","③","④"])"""
    if not ch or len(ch) < 2: return False
    return all(c.strip() in MARKERS for c in ch)

def build_remap(old_order):
    """old_order의 마커를 ①②③④ 순서로 매핑하는 딕셔너리"""
    remap = {}
    for i, old_marker in enumerate(old_order):
        new_marker = MARKERS[i]
        if old_marker != new_marker:
            remap[old_marker] = new_marker
    return remap

def apply_remap_to_text(text, remap):
    """텍스트 내 마커를 remap에 따라 교체 (충돌 방지: 임시 플레이스홀더 사용)"""
    if not remap: return text
    # Step 1: 원래 마커 → 임시 플레이스홀더
    placeholders = {}
    for i, (old, new) in enumerate(remap.items()):
        ph = f'__MK{i}__'
        placeholders[ph] = new
        text = text.replace(old, ph)
    # Step 2: 임시 플레이스홀더 → 새 마커
    for ph, new in placeholders.items():
        text = text.replace(ph, new)
    return text

def fix_question(q, dry_run=False):
    """단일 문항의 DC-2 수정. 변경사항 반환."""
    if q.get('fmt') != 'mc': return None
    passage = q.get('passage', '')
    if not passage: return None
    
    old_order = find_markers_in_order(passage)
    if len(old_order) < 2: return None
    
    expected = sorted(old_order, key=lambda x: MARKERS.index(x))
    if old_order == expected: return None  # 이미 정렬됨
    
    remap = build_remap(old_order)
    if not remap: return None
    
    # Compute projected ans change
    ans = q.get('ans')
    projected_ans = ans
    if isinstance(ans, int) and 1 <= ans <= len(MARKERS):
        old_marker = MARKERS[ans - 1]
        if old_marker in remap:
            new_marker = remap[old_marker]
            projected_ans = MARKERS.index(new_marker) + 1

    changes = {
        'qid': q['id'],
        'type': q['type'],
        'old_order': ''.join(old_order),
        'new_order': ''.join(expected),
        'remap': {k:v for k,v in remap.items()},
        'old_ans': ans,
        'new_ans': projected_ans,
        'details': []
    }

    if dry_run:
        return changes
    
    # 1. passage 마커 재배치
    q['passage'] = apply_remap_to_text(passage, remap)
    changes['details'].append('passage markers remapped')
    
    # 2. ch 업데이트
    ch = q.get('ch', [])
    if is_marker_ch(ch):
        # 마커형 ch: 항상 ["①","②","③","④"]로 정규화
        q['ch'] = [MARKERS[i] for i in range(len(ch))]
        changes['details'].append('ch normalized to sequential')
    else:
        # 단어형 ch: old_order 순서에서 new_order 순서로 재배열
        # old_order[i]의 단어가 MARKERS[i] 위치로 이동
        if len(ch) == len(old_order):
            # old_order의 각 마커가 ch의 어느 인덱스에 있었는지 파악
            old_marker_to_idx = {MARKERS[i]: i for i in range(len(MARKERS)) if i < len(ch)}
            new_ch = [None] * len(ch)
            for i, old_m in enumerate(old_order):
                # old_order[i]는 passage에서 i번째로 나타난 마커
                # 이 마커의 원래 ch 인덱스 = MARKERS.index(old_m)
                old_idx = MARKERS.index(old_m)
                if old_idx < len(ch):
                    # 새 위치는 MARKERS[i] = expected[i]의 인덱스 = i
                    new_ch[i] = ch[old_idx]
            if None not in new_ch:
                q['ch'] = new_ch
                changes['details'].append(f'ch reordered')
    
    # 3. ans 업데이트
    ans = q.get('ans')
    if isinstance(ans, int) and 1 <= ans <= len(MARKERS):
        old_marker = MARKERS[ans - 1]  # ans=3 → ③
        if old_marker in remap:
            new_marker = remap[old_marker]
            new_ans = MARKERS.index(new_marker) + 1
            q['ans'] = new_ans
            changes['new_ans'] = new_ans
            changes['details'].append(f'ans {ans}→{new_ans}')
        else:
            changes['new_ans'] = ans
    
    # 4. det 업데이트
    det = q.get('det', {})
    for field in ['analysis', 'korean', 'tip']:
        val = det.get(field, '')
        if val and isinstance(val, str):
            new_val = apply_remap_to_text(val, remap)
            if new_val != val:
                det[field] = new_val
                changes['details'].append(f'det.{field} markers remapped')
    
    return changes

def process_file(filepath, dry_run=False):
    """파일 처리. 변경사항 목록 반환."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'questions' not in data: return []
    
    all_changes = []
    for q in data['questions']:
        change = fix_question(q, dry_run=dry_run)
        if change:
            all_changes.append(change)
    
    if all_changes and not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    return all_changes

if __name__ == '__main__':
    import glob
    
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if not a.startswith('--')]
    
    if not args:
        print('Usage: python fix-dc2-markers.py <file_or_dir> [--dry-run]')
        sys.exit(1)
    
    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]
    
    total_changes = 0
    total_files = 0
    for fp in files:
        changes = process_file(fp, dry_run=dry_run)
        if changes:
            total_files += 1
            total_changes += len(changes)
            for c in changes:
                prefix = '[DRY-RUN] ' if dry_run else '[FIXED] '
                print(f'{prefix}{fp} Q{c["qid"]} ({c["type"]}): {c["old_order"]}→{c["new_order"]} ans:{c.get("old_ans")}→{c.get("new_ans",c.get("old_ans"))} {", ".join(c["details"])}')
    
    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"}: {total_changes} questions in {total_files} files ===')
