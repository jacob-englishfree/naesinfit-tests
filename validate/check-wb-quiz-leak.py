#!/usr/bin/env python3
# N7 크로스파일 게이트: 같은 지문 폴더의 워크북 ↔ 예상문제(퀴즈) 정답 상호노출 검사
# 사고(2026-09-06): 예상문제 어형변환/조건영작 정답이 워크북의 정답(서술형 wa, 오류찾기 det 교정어)과
#                    같아 워크북 먼저 푼 학생이 예상문제 정답을 학습. validate(파일단위)가 못 잡음.
# 사용: python3 validate/check-wb-quiz-leak.py <지문폴더>   (예: data/부교재/.../1강/1번)
import json, re, sys, os

def norm(s): return re.sub(r'\s+',' ',(s or '')).strip().lower()

def answer_tokens(qs):
    """워크북/퀴즈 정답으로 학생이 '알게 되는' 단어·구 집합."""
    toks=set()
    for q in qs:
        t=q.get('type','')
        if q.get('wa'): toks.add(norm(q['wa']))                       # 서술형/어형변환/조건영작/어순배열
        ov=q.get('overlay') or {}
        if ov.get('blank'): toks.add(norm(ov['blank']))
        if q.get('fmt')=='mc' and q.get('ans') and q.get('ch') and '빈칸' in t:
            toks.add(norm(q['ch'][q['ans']-1]))
        # 오류찾기: det.analysis 의 '원문 X ... ←정답' 교정어 추출
        an=(q.get('det') or {}).get('analysis','')
        for m in re.finditer(r'원문\s+([A-Za-z][A-Za-z\- ]{1,40}?)[\s,，]', an):
            toks.add(norm(m.group(1)))
    # 기능어/짧은 토큰 제거 (단일 단어인 경우만)
    STOP={'the','a','an','is','are','was','were','be','to','of','and','or'}
    return {w for w in toks if w and (' ' in w or (len(w)>3 and w not in STOP))}

def main():
    folder=sys.argv[1]
    wbf=os.path.join(folder,'워크북.json'); qzf=os.path.join(folder,'퀴즈.json')
    if not (os.path.exists(wbf) and os.path.exists(qzf)):
        print(f"[SKIP] 워크북/퀴즈 없음: {folder}"); return
    wb=json.load(open(wbf))['questions']; qz=json.load(open(qzf))['questions']
    wb_ans=answer_tokens(wb)
    dup=[]
    for q in qz:
        for w in ([norm(q['wa'])] if q.get('wa') else []) + ([norm((q.get('overlay') or {}).get('blank'))] if (q.get('overlay') or {}).get('blank') else []):
            if w and w in wb_ans:
                dup.append((q['id'], w))
    if dup:
        print(f"[FAIL] {folder} — 워크북↔예상문제 정답 중복 {len(dup)}건:")
        for qid,w in dup: print(f"   퀴즈 Q{qid} 정답 '{w[:50]}' 이 워크북 정답과 동일")
        sys.exit(1)
    print(f"[PASS] {folder} — 워크북↔예상문제 정답 중복 0건")
    sys.exit(0)

if __name__=='__main__': main()
