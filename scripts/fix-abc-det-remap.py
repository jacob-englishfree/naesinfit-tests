#!/usr/bin/env python3
"""
(A)(B)(C) 조합형 det.analysis 마커 재매핑 스크립트

det.analysis의 ①②③④가 현재 ch 순서와 불일치할 때,
det 내용물↔ch 단어 매칭으로 올바른 마커 매핑을 찾고 재매핑.

안전장치:
- det.analysis의 TEXT 내용은 보존 (마커 번호만 교체)
- 매칭 불확실 시 스킵 (수동 확인 필요)
- validate로 사후 검증
"""

import json, re, sys, os, glob, copy

MARKERS = ['①','②','③','④']

def extract_words(text):
    """텍스트에서 영어 단어 3글자 이상 추출 (소문자)"""
    return set(w.lower() for w in re.findall(r'[a-zA-Z]{3,}', text))

def parse_det_segments(analysis):
    """det.analysis를 마커별 세그먼트로 분리"""
    segments = {}
    marker_positions = []
    for m in MARKERS:
        idx = analysis.find(m)
        if idx >= 0:
            marker_positions.append((idx, m))
    marker_positions.sort()

    for i, (pos, m) in enumerate(marker_positions):
        start = pos + 1
        if i + 1 < len(marker_positions):
            end = marker_positions[i+1][0]
        else:
            end = len(analysis)
        # (A) 등 후반부 해설 시작점 찾기
        for stop in ['(A)', '(A) ']:
            si = analysis.find(stop, start)
            if start < si < end:
                end = si
        segments[m] = analysis[start:end].strip()

    return segments

def match_det_to_ch(segments, ch):
    """det 세그먼트를 ch 항목에 매칭. Returns: {det_marker: ch_index}"""
    ch_words = [extract_words(c) for c in ch]

    # 각 세그먼트의 단어를 ch와 비교
    matches = {}
    used_ch = set()

    for m in MARKERS[:len(ch)]:
        if m not in segments:
            continue
        seg_clean = re.sub(r'[✅❌←]|정답|원문.*', '', segments[m])
        seg_words = extract_words(seg_clean)

        if not seg_words:
            continue

        best_score = 0
        best_idx = -1
        for ci, cw in enumerate(ch_words):
            if ci in used_ch or not cw:
                continue
            overlap = len(seg_words & cw)
            if overlap > best_score:
                best_score = overlap
                best_idx = ci

        if best_score >= 2 and best_idx >= 0:
            matches[m] = best_idx
            used_ch.add(best_idx)

    return matches

def remap_analysis(analysis, remap):
    """det.analysis 내 마커를 재매핑"""
    if not remap:
        return analysis
    # 플레이스홀더로 교체 (충돌 방지)
    phs = {}
    for i, (old_m, new_m) in enumerate(remap.items()):
        ph = f'__ABC{i}__'
        phs[ph] = new_m
        analysis = analysis.replace(old_m, ph)
    for ph, new_m in phs.items():
        analysis = analysis.replace(ph, new_m)
    return analysis

def fix_question(q):
    """단일 (A)(B)(C) 문항의 det.analysis 마커 재매핑.
    Returns: (modified, details)
    """
    if q.get('type') != '(A)(B)(C) 조합형':
        return False, ''

    ch = q.get('ch', [])
    det = q.get('det', {})
    analysis = det.get('analysis', '')
    ans = q.get('ans', 0)

    if not analysis or not ch or ans < 1 or ans > len(ch):
        return False, ''
    if len(ch) < 4:
        return False, ''

    # det 파싱
    segments = parse_det_segments(analysis)
    if len(segments) < 3:
        return False, ''

    # det→ch 매칭
    matches = match_det_to_ch(segments, ch)

    # 안전장치: 4개 마커 전부 1:1 매칭이어야 함 (빠짐 없이)
    n_markers = min(len(ch), 4)
    if len(matches) < n_markers:
        return False, 'incomplete match'

    # 매칭된 ch 인덱스가 전부 다른지 확인 (1:1 대응)
    matched_indices = list(matches.values())
    if len(set(matched_indices)) != len(matched_indices):
        return False, 'ambiguous match'

    # 현재 매핑이 이미 맞는지 확인
    already_correct = all(
        matches.get(MARKERS[i]) == i
        for i in range(n_markers)
    )
    if already_correct:
        return False, ''

    # 재매핑 빌드: 현재 det 마커 → 올바른 마커
    remap = {}
    for det_marker, ch_idx in matches.items():
        correct_marker = MARKERS[ch_idx]
        if det_marker != correct_marker:
            remap[det_marker] = correct_marker

    if not remap:
        return False, ''

    # 안전장치: 재매핑이 전사(bijection)인지 확인
    new_markers = set(remap.values())
    old_markers = set(remap.keys())
    # 재매핑 대상이 아닌 마커는 그대로여야 함
    unchanged = set(MARKERS[:n_markers]) - old_markers
    if unchanged & new_markers:
        # 충돌: 변경 안 된 마커와 새 마커가 겹침
        # 전체 순열이 아닌 부분 교체 시 발생 → 스킵
        return False, 'non-bijective remap'

    # 적용
    new_analysis = remap_analysis(analysis, remap)
    det['analysis'] = new_analysis

    details = ', '.join(f'{k}→{v}' for k, v in remap.items())
    return True, details


def process_file(filepath, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'questions' not in data:
        return 0, []

    fixes = []
    for q in data['questions']:
        modified, details = fix_question(q)
        if modified:
            fixes.append((q['id'], details))

    if fixes and not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return len(fixes), fixes


if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if not a.startswith('--')]

    if not args:
        print('Usage: python fix-abc-det-remap.py <file_or_dir> [--dry-run]')
        sys.exit(1)

    target = args[0]
    if os.path.isdir(target):
        files = sorted(glob.glob(os.path.join(target, '**', '*.json'), recursive=True))
        files = [f for f in files if f.endswith(('단어.json','워크북.json','퀴즈.json'))]
    else:
        files = [target]

    total = 0; total_files = 0
    for fp in files:
        count, fixes = process_file(fp, dry_run=dry_run)
        if count > 0:
            total_files += 1
            total += count
            prefix = '[DRY-RUN] ' if dry_run else '[FIXED]'
            print(f'{prefix} {fp}: {count}건')
            for qid, details in fixes:
                print(f'  Q{qid}: {details}')

    print(f'\n=== {"DRY-RUN" if dry_run else "APPLIED"}: {total}건 in {total_files} files ===')
