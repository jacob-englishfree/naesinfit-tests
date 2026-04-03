#!/usr/bin/env python3
"""
수능특강Light 3,4,5강 누락 지문 PDF 추출 + 전체/번호별 파일 업데이트
실행: python3 scripts/extract-suneunglight-passages.py

효과:
- 3,4,5강 각각 Gateway~4번 5개 지문 추출
- 전체/단어.json fullPassage 업데이트
- 번호별 폴더 (3번~5번) 신규 생성
- test-catalog.json sections 업데이트
"""

import pdfplumber, re, json, shutil
from pathlib import Path

BASE = Path(__file__).parent.parent / "data/부교재/수능특강Light/영어"
CATALOG_PATH = Path(__file__).parent.parent / "test-catalog.json"
PDF_BASE = Path("/Users/woobumpark/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/수능특강Light영어(2026학년도_2025출판)/본문분석")

GANG_META = {
    3: {"title": "주제/요지/주장"},
    4: {"title": "함축의미/제목추론"},
    5: {"title": "어법/어휘"},
}

WORD_TYPES = [
    {"type": "(A)(B)(C) 조합형",        "diff": "쉬움",   "pts": 4},
    {"type": "반의어 고르기",            "diff": "쉬움",   "pts": 4},
    {"type": "빈칸 어휘 완성",           "diff": "쉬움",   "pts": 4},
    {"type": "동의어 고르기",            "diff": "쉬움",   "pts": 4},
    {"type": "영영풀이 매칭",            "diff": "쉬움",   "pts": 4},
    {"type": "빈칸 어휘 완성",           "diff": "보통",   "pts": 5},
    {"type": "동의어 고르기",            "diff": "보통",   "pts": 5},
    {"type": "(A)(B)(C) 조합형",        "diff": "보통",   "pts": 5},
    {"type": "문맥상 부적절한 어휘",     "diff": "보통",   "pts": 5},
    {"type": "반의어 고르기",            "diff": "보통",   "pts": 5},
    {"type": "다의어 문맥적 의미",       "diff": "보통",   "pts": 5},
    {"type": "빈칸 문맥 완성",           "diff": "보통",   "pts": 5},
    {"type": "문맥상 부적절한 어휘",     "diff": "보통",   "pts": 5},
    {"type": "(A)(B)(C) 조합형",        "diff": "보통",   "pts": 5},
    {"type": "빈칸 문맥 완성",           "diff": "보통",   "pts": 5},
    {"type": "어형 변환 (서술형)",       "diff": "어려움", "pts": 6},
    {"type": "어형 변환 (서술형)",       "diff": "어려움", "pts": 6},
    {"type": "문맥상 부적절한 어휘",     "diff": "어려움", "pts": 6},
    {"type": "동의어 고르기",            "diff": "어려움", "pts": 6},
    {"type": "빈칸 어휘 완성",           "diff": "어려움", "pts": 6},
]
WORKBOOK_TYPES = [
    {"type": "빈칸추론",      "diff": "쉬움",   "pts": 4},
    {"type": "내용일치",      "diff": "쉬움",   "pts": 4},
    {"type": "어법",          "diff": "쉬움",   "pts": 4},
    {"type": "내용일치",      "diff": "쉬움",   "pts": 4},
    {"type": "빈칸 어휘 완성","diff": "쉬움",   "pts": 4},
    {"type": "어법",          "diff": "보통",   "pts": 5},
    {"type": "빈칸추론",      "diff": "보통",   "pts": 5},
    {"type": "내용불일치",    "diff": "보통",   "pts": 5},
    {"type": "주제/요지",     "diff": "보통",   "pts": 5},
    {"type": "어법",          "diff": "보통",   "pts": 5},
    {"type": "내용일치",      "diff": "보통",   "pts": 5},
    {"type": "빈칸추론",      "diff": "보통",   "pts": 5},
    {"type": "내용불일치",    "diff": "보통",   "pts": 5},
    {"type": "어법",          "diff": "보통",   "pts": 5},
    {"type": "어순배열",      "diff": "보통",   "pts": 5},
    {"type": "오류찾기",      "diff": "어려움", "pts": 6},
    {"type": "서술형",        "diff": "어려움", "pts": 6},
    {"type": "주제/요지",     "diff": "어려움", "pts": 6},
    {"type": "오류찾기",      "diff": "어려움", "pts": 6},
    {"type": "서술형",        "diff": "어려움", "pts": 6},
]
QUIZ_TYPES = [
    {"type": "빈칸추론",              "diff": "쉬움",   "pts": 4},
    {"type": "내용일치",              "diff": "쉬움",   "pts": 4},
    {"type": "동의어 고르기",         "diff": "쉬움",   "pts": 4},
    {"type": "반의어 고르기",         "diff": "쉬움",   "pts": 4},
    {"type": "(A)(B)(C) 조합형",     "diff": "쉬움",   "pts": 4},
    {"type": "어법",                  "diff": "보통",   "pts": 5},
    {"type": "문맥상 부적절한 어휘",  "diff": "보통",   "pts": 5},
    {"type": "내용불일치",            "diff": "보통",   "pts": 5},
    {"type": "빈칸추론",              "diff": "보통",   "pts": 5},
    {"type": "어법",                  "diff": "보통",   "pts": 5},
    {"type": "내용일치",              "diff": "보통",   "pts": 5},
    {"type": "문맥상 부적절한 어휘",  "diff": "보통",   "pts": 5},
    {"type": "어법",                  "diff": "보통",   "pts": 5},
    {"type": "내용불일치",            "diff": "보통",   "pts": 5},
    {"type": "주제/요지",             "diff": "보통",   "pts": 5},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
    {"type": "어순배열",              "diff": "어려움", "pts": 6},
    {"type": "어법",                  "diff": "어려움", "pts": 6},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
]

def extract_passage_from_page(page):
    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    by_line = {}
    for w in words:
        y = round(w['top'] / 5) * 5
        if y not in by_line:
            by_line[y] = []
        by_line[y].append(w)
    lines = []
    for y in sorted(by_line.keys()):
        lw = sorted(by_line[y], key=lambda w: w['x0'])
        lines.append(' '.join(w['text'] for w in lw))
    eng_lines = []
    for l in lines:
        if not re.search(r'[가-힣]', l) and re.search(r'[a-zA-Z]{3,}', l) and '수능특강' not in l and '지문' not in l:
            eng_lines.append(l)
    full = ' '.join(eng_lines)
    full = re.sub(r'\b\d{2}\s+', '', full)
    return re.sub(r'\s+', ' ', full).strip()

def extract_all_passages(gang):
    pdf_name = f"_수능특강 Light 영어 수록 원문(2025) 0{gang}강 본문분석.pdf"
    pdf_path = PDF_BASE / pdf_name
    passages = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        pages = pdf.pages
        jidok_pages = {}
        current_section = None
        for i, page in enumerate(pages):
            txt = page.extract_text() or ''
            lines = [l.strip() for l in txt.split('\n') if l.strip()]
            if len(lines) > 1:
                if lines[1] == 'Gateway':
                    current_section = 'Gateway'
                elif re.match(r'^\d번$', lines[1]):
                    current_section = lines[1]
            if '지문 읽기' in txt and current_section and current_section not in jidok_pages:
                jidok_pages[current_section] = i
        for sec, page_idx in jidok_pages.items():
            passages[sec] = extract_passage_from_page(pages[page_idx])
    return passages

def make_todo_file(test_type, gang_num, sec_name, sec_num, passage, title, types_list):
    gang_str = f"{gang_num:02d}"
    type_key = {"단어": "wordTest", "워크북": "workbookTest", "퀴즈": "quizTest"}[test_type]
    hist_key = f"{type_key}_suneungLight_eng_L{gang_str}_ex{sec_num}_v3"
    questions = []
    for i, t in enumerate(types_list, 1):
        questions.append({
            "id": i,
            "type": t["type"],
            "diff": t["diff"],
            "pts": t["pts"],
            "fmt": "sa" if "서술형" in t["type"] or "어형" in t["type"] else "mc",
            "passage": passage,
            "stem": f"TODO: {t['type']} stem",
            "ans": 1,
            "ch": ["TODO1", "TODO2", "TODO3", "TODO4"],
            "det": {"korean": "TODO", "analysis": "TODO", "tip": "TODO"},
            "_TODO": True
        })
    return {
        "version": 3,
        "testType": test_type,
        "ei": {
            "subject": "수능특강Light",
            "pub": "영어",
            "lesson": f"{gang_num}강",
            "section": sec_name,
            "title": title,
            "total": 100,
            "time": 1200,
            "totalQ": 20,
            "histKey": hist_key
        },
        "fullPassage": passage,
        "questions": questions
    }

def main():
    section_order = ['Gateway', '1번', '2번', '3번', '4번']
    sec_num_map = {'Gateway': 0, '1번': 1, '2번': 2, '3번': 3, '4번': 4}

    for gang_num, meta in GANG_META.items():
        print(f"\n=== {gang_num}강 지문 추출 중 ===")
        passages = extract_all_passages(gang_num)
        for sec, txt in passages.items():
            print(f"  {sec}: {len(txt)}자 — {txt[:60]}...")

        gang_dir = BASE / f"{gang_num}강"

        # 전체 파일 fullPassage 업데이트
        for test_type in ["단어", "워크북", "퀴즈"]:
            path = gang_dir / "전체" / f"{test_type}.json"
            if path.exists():
                with open(path, encoding="utf-8") as f:
                    d = json.load(f)
                d["fullPassage"] = "\n\n".join(passages[s] for s in section_order if s in passages)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(d, f, ensure_ascii=False, indent=2)
                print(f"  ✅ 전체/{test_type}.json fullPassage 업데이트")

        # 번호별 폴더 생성 (기존 2개 삭제 후 5개 재생성)
        for sec_name in section_order:
            if sec_name not in passages:
                continue
            # sec_name → 폴더명 (Gateway→Gateway, 1번→1번)
            folder_name = sec_name
            sec_dir = gang_dir / folder_name
            sec_dir.mkdir(exist_ok=True)
            sec_num = sec_num_map[sec_name]

            for test_type, types_list in [("단어", WORD_TYPES), ("워크북", WORKBOOK_TYPES), ("퀴즈", QUIZ_TYPES)]:
                out_path = sec_dir / f"{test_type}.json"
                if out_path.exists():
                    with open(out_path, encoding="utf-8") as f:
                        existing = json.load(f)
                    # fullPassage만 업데이트 (이미 출제된 경우 유지)
                    existing["fullPassage"] = passages[sec_name]
                    existing["ei"]["section"] = sec_name
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(existing, f, ensure_ascii=False, indent=2)
                else:
                    data = make_todo_file(test_type, gang_num, sec_name, sec_num, passages[sec_name], meta["title"], types_list)
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  {'✅' if out_path.exists() else '생성'}: {gang_num}강/{folder_name}/{test_type}.json")

    # test-catalog.json 업데이트 (3,4,5강 sections 수정)
    with open(CATALOG_PATH, encoding="utf-8") as f:
        cat = json.load(f)
    light = cat["부교재"]["수능특강Light영어2026"]
    for gang_num in GANG_META:
        light["sections"][f"{gang_num}강"] = ["전체", "Gateway", "1번", "2번", "3번", "4번"]
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
    print("\n✅ test-catalog.json 업데이트 완료")
    print("→ node scripts/sync-catalog.js 실행 필요")

if __name__ == "__main__":
    main()
