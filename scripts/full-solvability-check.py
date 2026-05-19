#!/usr/bin/env python3
"""
전수 풀이가능성 검사 — 학생 화면 기준 모든 오류 탐지
68,300문항 전체 대상. 패턴 매칭이 아닌 "이 문제 풀 수 있나?" 관점.
"""
import json, os, re, sys
from collections import defaultdict

data_dir = 'data'
issues = []  # (severity, file, qid, category, desc)

MARKER_TYPES = {'어법', '문맥상 부적절한 어휘'}
WRITTEN_TYPES = {'서술형', '서술형 — 핵심단어', '서술형 — 조건영작', '어순배열', '어형 변환', '오류찾기'}

def check_question(q, fpath, fp):
    """한 문항의 모든 풀이가능성 체크"""
    qid = q.get('id', '?')
    qtype = q.get('type', '')
    fmt = q.get('fmt', '')
    stem = q.get('stem') or ''
    passage = q.get('passage') or ''
    ch = q.get('ch')
    ans = q.get('ans')
    wa = q.get('wa') or ''
    accept = q.get('accept', [])
    det = q.get('det', {})
    korean = det.get('korean') or ''
    analysis = det.get('analysis') or ''
    short = fpath.replace('data/', '')
    found = []

    # ===== 1. 기본 구조 =====
    if fmt == 'mc':
        if not ch or len(ch) == 0:
            found.append(('CRITICAL', 'ch-없음', '선지가 없어서 선택 불가'))
        elif len(ch) != 4 and qtype not in ['T/F', '내용이해 T/F']:
            found.append(('HIGH', 'ch-개수', f'선지 {len(ch)}개 (4개 필수)'))
        if not ans:
            found.append(('CRITICAL', 'ans-없음', '정답이 지정 안 됨'))
        elif ans < 1 or ans > (len(ch) if ch else 4):
            found.append(('CRITICAL', 'ans-범위초과', f'ans={ans} ch는 {len(ch) if ch else 0}개'))
    
    if fmt == 'written':
        if not wa:
            found.append(('CRITICAL', 'wa-없음', '서술형인데 정답(wa)이 없음'))

    # ===== 2. passage 존재 =====
    # 순서배열은 V63-B에 의해 passage=null, 텍스트는 stem에 포함 (의도적)
    if fmt == 'mc' and qtype not in ['영영풀이 매칭', '다의어 문맥적 의미', '순서배열', '글순서']:
        if not passage or len(passage.strip()) < 30:
            found.append(('HIGH', 'passage-없음', 'mc인데 passage가 없거나 30자 미만'))
    
    if fmt == 'written' and qtype not in ['영영풀이 매칭']:
        if not passage or len(passage.strip()) < 30:
            if '찾아' in stem or '찾으' in stem:
                found.append(('CRITICAL', 'passage-없음-찾기', '"찾아쓰시오"인데 passage 없음'))

    # ===== 3. 마커형 (어법/부적절) =====
    if qtype in MARKER_TYPES and fmt == 'mc':
        markers_in_passage = re.findall(r'[①②③④⑤ⓐⓑⓒⓓⓔ]', passage)
        if len(markers_in_passage) < 3:
            found.append(('CRITICAL', '마커부족', f'passage에 마커 {len(markers_in_passage)}개 — 학생이 선택지와 대응 불가'))
        
        # ch가 마커가 아닌 단어인 경우
        if ch and ch[0] not in ['①', '②', '③', '④', '⑤']:
            # ch가 단어형이면 passage에 <u> 필요
            has_underline = '<u>' in passage
            if not has_underline and len(markers_in_passage) == 0:
                found.append(('HIGH', '마커-ch불일치', f'마커도 밑줄도 없는데 ch가 단어: {ch[0][:15]}'))
    
    # ===== 4. 빈칸형 =====
    if qtype in ['빈칸 어휘 완성', '빈칸 문맥 완성', '빈칸추론'] and fmt == 'mc':
        if '____' not in passage and '________' not in passage and '__' not in passage:
            found.append(('CRITICAL', '빈칸없음', '"빈칸에 들어갈" stem인데 passage에 ____ 없음'))
    
    # ===== 5. 문장삽입 =====
    if qtype == '문장삽입':
        # ch가 위치마커여야 함
        if ch and ch[0] not in ['①', '②', '③', '④', '(①)', '(②)']:
            found.append(('CRITICAL', '삽입-ch깨짐', f'문장삽입인데 ch가 위치 아닌 단어: {ch[0][:20]}'))
        # stem에 삽입할 문장 필요
        if '<b>' not in stem and '주어진 문장' not in stem:
            found.append(('HIGH', '삽입-문장없음', '삽입할 문장이 stem에 없음'))
        # passage에 위치마커 필요 (bare ① or parenthesized (①) 둘 다 허용)
        pos_markers = re.findall(r'[①②③④⑤]', passage)
        if len(pos_markers) < 3:
            found.append(('HIGH', '삽입-위치없음', f'passage에 위치마커 {len(pos_markers)}개'))
    
    # ===== 6. 순서배열 =====
    # V63-B: 순서배열은 passage=null, 텍스트는 stem에 포함 (validate.js 정합)
    if qtype == '순서배열':
        check_target = stem if (not passage or len(passage.strip()) < 10) else passage
        if '(A)' not in check_target and '(B)' not in check_target:
            found.append(('HIGH', '순서-마커없음', 'stem/passage에 (A)(B)(C) 없음'))
    
    # ===== 7. 어순배열 =====
    if qtype == '어순배열' and fmt == 'written':
        if '[' not in stem and '/' not in stem and '<b>' not in stem:
            found.append(('CRITICAL', '어순-단어없음', '배열할 단어 목록이 stem에 없음'))
        if '____' not in passage and '________' not in passage:
            found.append(('HIGH', '어순-빈칸없음', 'passage에 빈칸 없음'))
        if wa:
            wc = len(wa.split())
            if wc < 8:
                found.append(('MEDIUM', '어순-단어부족', f'어순배열 {wc}단어 (8~15 권장)'))
    
    # ===== 8. 어형변환 =====
    if qtype == '어형 변환':
        if '(' not in stem and '<b>' not in stem and '[' not in stem:
            found.append(('CRITICAL', '어형-단어없음', '변환할 원형 단어가 stem에 없음'))
        if '____' not in passage and '________' not in passage:
            found.append(('HIGH', '어형-빈칸없음', 'passage에 빈칸 없음'))
    
    # ===== 9. 조건영작 =====
    if qtype == '서술형 — 조건영작':
        if '조건' not in stem and '[' not in stem:
            found.append(('HIGH', '영작-조건없음', 'stem에 [조건] 없음'))
        if wa and '단어)' not in stem:
            found.append(('MEDIUM', '영작-단어수없음', f'(N단어) 조건 없음'))
    
    # ===== 10. 서술형 일반 =====
    if fmt == 'written' and wa:
        if '단어)' not in stem and '찾아' not in stem and '찾으' not in stem:
            if qtype not in ['서술형 — 핵심단어']:
                found.append(('MEDIUM', '서술형-단어수', '(N단어) 없어서 답 길이 모름'))
    
    # ===== 11. det/해설 품질 =====
    if analysis:
        # 번호 중복
        if re.findall(r'([①②③④⑤])\s*\1', analysis):
            found.append(('LOW', '해설-번호중복', '① ① 식 중복'))
        # 해설이 너무 짧음
        if len(analysis) < 15:
            found.append(('LOW', '해설-너무짧음', f'analysis {len(analysis)}자'))
    
    # ===== 12. ans↔det 불일치 (마커형) =====
    if fmt == 'mc' and ans and qtype in MARKER_TYPES:
        ans_marker = chr(9311 + ans)
        # ❌ marker with ←정답
        m = re.search(r'❌\s*([①②③④⑤])[^✅❌]*←\s*정답', analysis)
        if m:
            det_marker = m.group(1)
            if det_marker != ans_marker:
                found.append(('CRITICAL', '정답틀림', f'det가 {det_marker}←정답인데 ans={ans}({ans_marker})'))
        # korean ③ X → Y 패턴
        m2 = re.match(r'^([①②③④⑤])\s+\S+.*→', korean)
        if m2:
            det_marker = m2.group(1)
            if det_marker != ans_marker:
                found.append(('HIGH', '정답의심', f'det.korean이 {det_marker}인데 ans={ans}({ans_marker})'))
    
    # ===== 13. (A)(B)(C) 조합형 =====
    if qtype == '(A)(B)(C) 조합형' and fmt == 'mc':
        if '(A)' not in passage and '<b>(A)</b>' not in passage:
            found.append(('HIGH', 'ABC-마커없음', 'passage에 (A)(B)(C) 없음'))
        if ch and '—' not in (ch[0] or '') and '–' not in (ch[0] or '') and ' - ' not in (ch[0] or ''):
            found.append(('MEDIUM', 'ABC-형식', f'ch에 — 구분자 없음: {(ch[0] or "")[:30]}'))
    
    # ===== 14. 동의어/반의어 =====
    if qtype in ['동의어 고르기', '반의어 고르기'] and fmt == 'mc':
        if '<u>' not in passage:
            found.append(('HIGH', '동반의어-밑줄없음', 'passage에 밑줄(<u>) 없음'))
    
    # ===== 15. 내용이해/T-F =====
    if qtype in ['T/F', '내용이해 T/F']:
        if ch and len(ch) != 2 and not any('True' in c or 'T' == c for c in ch[:2] if c):
            found.append(('HIGH', 'TF-선지오류', f'T/F인데 ch가 True/False 형식 아님'))
    
    for sev, cat, desc in found:
        issues.append((sev, short, qid, cat, desc))

# ===== Walk all files =====
file_count = 0
q_count = 0

for root, dirs, files in os.walk(data_dir):
    for fname in files:
        if not any(fname.endswith(x) for x in ['단어.json', '워크북.json', '퀴즈.json']):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, encoding='utf-8') as f:
                d = json.load(f)
        except:
            issues.append(('CRITICAL', fpath.replace('data/',''), 0, 'FILE-BROKEN', 'JSON 파싱 불가'))
            continue
        
        if 'questions' not in d or not isinstance(d['questions'], list):
            continue
        
        fp = d.get('fullPassage', '')
        file_count += 1
        
        for q in d['questions']:
            q_count += 1
            check_question(q, fpath, fp)

# ===== Report =====
print(f'═══════════════════════════════════════')
print(f'  전수 풀이가능성 검사 완료')
print(f'  {file_count}파일 / {q_count}문항 검사')
print(f'═══════════════════════════════════════\n')

by_sev = defaultdict(int)
by_cat = defaultdict(int)
for sev, *_, cat, _ in issues:
    by_sev[sev] += 1
    by_cat[cat] += 1

sev_order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
print('심각도별:')
for s in sev_order:
    emoji = {'CRITICAL':'🔴','HIGH':'🟠','MEDIUM':'🟡','LOW':'⚪'}[s]
    print(f'  {emoji} {s}: {by_sev[s]}건')
print()

print('유형별 (CRITICAL+HIGH만):')
crit_high = [(cat, cnt) for cat, cnt in by_cat.items() 
             if any(i[0] in ['CRITICAL','HIGH'] and i[3]==cat for i in issues)]
for cat in sorted(by_cat.keys(), key=lambda x: -sum(1 for i in issues if i[3]==x and i[0] in ['CRITICAL','HIGH'])):
    c = sum(1 for i in issues if i[3]==cat and i[0]=='CRITICAL')
    h = sum(1 for i in issues if i[3]==cat and i[0]=='HIGH')
    if c+h == 0: continue
    print(f'  {cat}: CRITICAL {c} + HIGH {h} = {c+h}건')
print()

# Save detailed report
report = {
    'timestamp': __import__('datetime').datetime.now().isoformat(),
    'totalFiles': file_count,
    'totalQuestions': q_count,
    'summary': dict(by_sev),
    'byCategory': dict(by_cat),
    'issues': [{'severity':s,'file':f,'qid':q,'category':c,'desc':d} for s,f,q,c,d in issues]
}
with open('solvability-report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f'상세 리포트: solvability-report.json')
print(f'\nCRITICAL 샘플 (처음 20건):')
crit = [i for i in issues if i[0]=='CRITICAL']
for sev, f, qid, cat, desc in crit[:20]:
    print(f'  🔴 {f} Q{qid} [{cat}] {desc}')
