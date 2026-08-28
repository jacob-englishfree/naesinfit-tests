#!/usr/bin/env python3
"""
교과서 본문 PDF → 섹션 분리 추출 (본문 + Further Reading/Read More/Culture Notes/Deep Learning 등)

⛔ 근본수정 (2026-08-28): 이그잼 본문 PDF에 부가섹션이 합쳐져 있어, 통째 추출하면
   본문 fullPassage가 오염됨. 이 스크립트는 섹션 헤더를 경계로 본문/섹션을 자동 분리한다.

사용:
  python3 scripts/extract_textbook.py <PDF경로> <출력디렉토리>
    예: scripts/extract_textbook.py ".../공통영어2_이그잼_원본/..._천재(강상구)_1과_본문.pdf" \
        data/교과서/공통영어2/천재강상구/1과
  → <출력디렉토리>/본문/_passage.json + <출력디렉토리>/{섹션명}/_passage.json

  --dry : 파일 안 쓰고 결과만 출력 (검증용)
"""
import fitz, re, json, os, sys

# 섹션 헤더 (라인 전체가 정확히 이 형태 — 출판사 부가섹션명)
SECHDR = re.compile(
    r'^(Read\s*More|READ\s*MORE|Further\s*Reading|More\s*Reading|'
    r'Culture\s*Notes?|Deep\s*Learning|Reading\s*Closer|Extended\s*Reading)$', re.I)
# 페이지 헤더/푸터/메타 (제거)
DROP = re.compile(r'^\s*(20\d\d\s*개정.*|교과서\s*본문|공통영어[12]|영어\s*I{1,2}\b.*|중\d.*|'
                  r'-\s*\d+\s*-|\d+)\s*$')

# 폴더명 정규화 (공통영어1 기존 구조와 일치)
def norm_section(h):
    hl = h.lower().replace(' ', '')
    if 'readmore' in hl:       return 'Read More'
    if 'furtherreading' in hl: return 'Further Reading'
    if 'morereading' in hl:    return 'More Reading'
    if 'culturenote' in hl:    return 'Culture Notes'
    if 'deeplearning' in hl:   return 'Deep Learning'
    if 'readingcloser' in hl:  return 'Reading Closer'
    if 'extendedreading' in hl:return 'Extended Reading'
    return h.strip()

def extract(pdf):
    raw = ''.join(p.get_text() for p in fitz.open(pdf))
    # 영어 라인만 (한글 해석/푸터/빈줄 제거), 순서 보존
    clean = []
    for l in raw.split('\n'):
        s = l.strip()
        if not s: continue
        if re.search('[가-힣]', s): continue      # 한글 라인 = 해석
        if DROP.match(s): continue
        if '│' in s: continue
        if not re.search('[A-Za-z]', s): continue
        clean.append(s)
    # 섹션 헤더로 분할 (첫 등장만 경계, 중복 헤더는 스킵)
    sections = []           # [(name, title, [body_lines])]
    cur_name, cur = '본문', []
    seen = set()
    for s in clean:
        if SECHDR.match(s):
            key = norm_section(s)
            if key in seen:          # 중복 헤더(한글파트 잔재) → 스킵
                continue
            sections.append((cur_name, cur))   # flush 이전 섹션
            cur_name, cur = key, []
            seen.add(key)
        else:
            cur.append(s)
    sections.append((cur_name, cur))
    # (name, [lines]) → (name, title, text)
    out = []
    for name, lines in sections:
        if not lines: continue
        title = lines[0]
        text = re.sub(r'\s+', ' ', ' '.join(lines)).strip()
        out.append((name, title, text))
    return out

def main():
    args = [a for a in sys.argv[1:] if a != '--dry']
    dry = '--dry' in sys.argv
    if len(args) < 2:
        print("사용: extract_textbook.py <PDF경로> <출력디렉토리> [--dry]"); sys.exit(1)
    pdf, outdir = args[0], args[1]
    if not os.path.exists(pdf):
        print(f"❌ PDF 없음: {pdf}"); sys.exit(1)
    secs = extract(pdf)
    for name, title, text in secs:
        ko = len(re.findall('[가-힣]', text))
        leak = bool(SECHDR.search('\n'.join(re.findall(r'[A-Za-z ]+', text))))  # 자기 fullPassage에 딴 헤더?
        print(f"  [{name}] '{title[:45]}' {len(text)}자 한글{ko}"
              + (f"  ⚠️헤더잔재" if leak else ""))
        if not dry:
            # 본문 → {과}/본문/_passage.json, 섹션 → {과}/{섹션}/_passage.json
            # (create-test.js가 --path {과}/{섹션}로 읽는 구조. 공통영어1 기존과 동일)
            d = os.path.join(outdir, name)
            os.makedirs(d, exist_ok=True)
            json.dump({"fullPassage": text, "title": title},
                      open(os.path.join(d, '_passage.json'), 'w'),
                      ensure_ascii=False, indent=2)
    if not dry:
        print(f"✅ {len(secs)}개 섹션 → {outdir}")

if __name__ == '__main__':
    main()
