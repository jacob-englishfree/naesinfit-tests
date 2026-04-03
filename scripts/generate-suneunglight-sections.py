#!/usr/bin/env python3
"""
수능특강Light 번호별(지문별) 테스트 출제 스크립트
실행: python3 scripts/generate-suneunglight-sections.py

작업:
1. 각 강의 기존 전체 파일에서 지문을 분리
2. 번호별 폴더 생성 + 템플릿 JSON 생성 (questions 채우기 위한 준비)
3. test-catalog.json sections 업데이트

출제 완료 후:
  npm run validate:all
  git add . && git commit -m "수특Light 번호별 테스트 추가"
  git push
"""

import json, os, re, shutil
from pathlib import Path

BASE = Path(__file__).parent.parent / "data/부교재/수능특강Light/영어"
CATALOG_PATH = Path(__file__).parent.parent / "test-catalog.json"

# 강별 메타 정보
GANG_META = {
    1: {"title": "글의 목적 파악", "count": 5},
    2: {"title": "심경/요지",      "count": 5},   # 심경변화는 금지 유형 → 요지/내용이해 위주
    3: {"title": "주제/요지/주장", "count": 2},
    4: {"title": "함축의미/제목추론", "count": 2},
    5: {"title": "어법/어휘",      "count": 2},
}

# 문항 유형 분포 (수능특강 정규와 동일)
WORD_TYPES = [
    {"type": "(A)(B)(C) 조합형",        "diff": "쉬움",  "pts": 4},
    {"type": "반의어 고르기",            "diff": "쉬움",  "pts": 4},
    {"type": "빈칸 어휘 완성",           "diff": "쉬움",  "pts": 4},
    {"type": "동의어 고르기",            "diff": "쉬움",  "pts": 4},
    {"type": "영영풀이 매칭",            "diff": "쉬움",  "pts": 4},
    {"type": "빈칸 어휘 완성",           "diff": "보통",  "pts": 5},
    {"type": "동의어 고르기",            "diff": "보통",  "pts": 5},
    {"type": "(A)(B)(C) 조합형",        "diff": "보통",  "pts": 5},
    {"type": "문맥상 부적절한 어휘",     "diff": "보통",  "pts": 5},
    {"type": "반의어 고르기",            "diff": "보통",  "pts": 5},
    {"type": "다의어 문맥적 의미",       "diff": "보통",  "pts": 5},
    {"type": "빈칸 문맥 완성",           "diff": "보통",  "pts": 5},
    {"type": "문맥상 부적절한 어휘",     "diff": "보통",  "pts": 5},
    {"type": "(A)(B)(C) 조합형",        "diff": "보통",  "pts": 5},
    {"type": "빈칸 문맥 완성",           "diff": "보통",  "pts": 5},
    {"type": "어형 변환 (서술형)",       "diff": "어려움", "pts": 6},
    {"type": "어형 변환 (서술형)",       "diff": "어려움", "pts": 6},
    {"type": "문맥상 부적절한 어휘",     "diff": "어려움", "pts": 6},
    {"type": "동의어 고르기",            "diff": "어려움", "pts": 6},
    {"type": "빈칸 어휘 완성",           "diff": "어려움", "pts": 6},
]

WORKBOOK_TYPES = [
    {"type": "빈칸추론",     "diff": "쉬움",  "pts": 4},
    {"type": "내용일치",     "diff": "쉬움",  "pts": 4},
    {"type": "어법",         "diff": "쉬움",  "pts": 4},
    {"type": "내용일치",     "diff": "쉬움",  "pts": 4},
    {"type": "빈칸 어휘 완성","diff": "쉬움", "pts": 4},
    {"type": "어법",         "diff": "보통",  "pts": 5},
    {"type": "빈칸추론",     "diff": "보통",  "pts": 5},
    {"type": "내용불일치",   "diff": "보통",  "pts": 5},
    {"type": "주제/요지",    "diff": "보통",  "pts": 5},
    {"type": "어법",         "diff": "보통",  "pts": 5},
    {"type": "내용일치",     "diff": "보통",  "pts": 5},
    {"type": "빈칸추론",     "diff": "보통",  "pts": 5},
    {"type": "내용불일치",   "diff": "보통",  "pts": 5},
    {"type": "어법",         "diff": "보통",  "pts": 5},
    {"type": "어순배열",     "diff": "보통",  "pts": 5},
    {"type": "오류찾기",     "diff": "어려움", "pts": 6},
    {"type": "서술형",       "diff": "어려움", "pts": 6},
    {"type": "주제/요지",    "diff": "어려움", "pts": 6},
    {"type": "오류찾기",     "diff": "어려움", "pts": 6},
    {"type": "서술형",       "diff": "어려움", "pts": 6},
]

QUIZ_TYPES = [
    {"type": "빈칸추론",              "diff": "쉬움",  "pts": 4},
    {"type": "내용일치",              "diff": "쉬움",  "pts": 4},
    {"type": "동의어 고르기",         "diff": "쉬움",  "pts": 4},
    {"type": "반의어 고르기",         "diff": "쉬움",  "pts": 4},
    {"type": "(A)(B)(C) 조합형",     "diff": "쉬움",  "pts": 4},
    {"type": "어법",                  "diff": "보통",  "pts": 5},
    {"type": "문맥상 부적절한 어휘",  "diff": "보통",  "pts": 5},
    {"type": "내용불일치",            "diff": "보통",  "pts": 5},
    {"type": "빈칸추론",              "diff": "보통",  "pts": 5},
    {"type": "어법",                  "diff": "보통",  "pts": 5},
    {"type": "내용일치",              "diff": "보통",  "pts": 5},
    {"type": "문맥상 부적절한 어휘",  "diff": "보통",  "pts": 5},
    {"type": "어법",                  "diff": "보통",  "pts": 5},
    {"type": "내용불일치",            "diff": "보통",  "pts": 5},
    {"type": "주제/요지",             "diff": "보통",  "pts": 5},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
    {"type": "어순배열",              "diff": "어려움", "pts": 6},
    {"type": "어법",                  "diff": "어려움", "pts": 6},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
    {"type": "서술형",                "diff": "어려움", "pts": 6},
]

def get_passages(gang_num):
    """기존 단어.json fullPassage에서 지문 분리"""
    path = BASE / f"{gang_num}강/단어.json"
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    fp = d["fullPassage"]
    paras = [p.strip() for p in fp.split("\n\n") if p.strip()]
    return paras

def make_template(test_type, gang_num, ex_num, passage, title, types_list):
    """번호별 JSON 템플릿 생성 (questions는 TODO placeholder)"""
    gang_str = f"{gang_num:02d}"
    ex_str = ex_num

    type_key = {
        "단어": "wordTest",
        "워크북": "workbookTest",
        "퀴즈": "quizTest"
    }[test_type]

    hist_key = f"{type_key}_suneungLight_eng_L{gang_str}_ex{ex_str}_v3"

    # TODO placeholder 문항 생성 (출제자가 채워야 함)
    questions = []
    for i, t in enumerate(types_list, 1):
        questions.append({
            "id": i,
            "type": t["type"],
            "diff": t["diff"],
            "pts": t["pts"],
            "fmt": "sa" if "서술형" in t["type"] or "어형" in t["type"] else "mc",
            "passage": passage,
            "stem": f"TODO: {t['type']} 문항 stem 작성",
            "ans": 1,
            "ch": ["TODO 선택지1", "TODO 선택지2", "TODO 선택지3", "TODO 선택지4"],
            "det": {
                "korean": "TODO: 한국어 해설",
                "analysis": "TODO: ✅/❌ 분석",
                "tip": "TODO: 팁"
            },
            "_TODO": True  # 출제 필요 표시
        })

    return {
        "version": 3,
        "testType": test_type,
        "ei": {
            "subject": "수능특강Light",
            "pub": "영어",
            "lesson": f"{gang_num}강",
            "section": f"{ex_num}번",
            "title": title,
            "total": 100,
            "time": 1200,
            "totalQ": 20,
            "histKey": hist_key
        },
        "fullPassage": passage,
        "questions": questions
    }

def move_existing_to_jeonche(gang_num):
    """기존 단어/워크북/퀴즈.json을 전체/ 폴더로 이동"""
    gang_dir = BASE / f"{gang_num}강"
    jeonche_dir = gang_dir / "전체"
    jeonche_dir.mkdir(exist_ok=True)

    for fname in ["단어.json", "워크북.json", "퀴즈.json"]:
        src = gang_dir / fname
        dst = jeonche_dir / fname
        if src.exists() and not dst.exists():
            shutil.move(str(src), str(dst))
            print(f"  이동: {gang_num}강/{fname} → {gang_num}강/전체/{fname}")

def update_catalog(sections_map):
    """test-catalog.json 수능특강Light sections 업데이트"""
    with open(CATALOG_PATH, encoding="utf-8") as f:
        cat = json.load(f)

    light = cat["부교재"]["수능특강Light영어2026"]
    light["sections"] = sections_map
    # units도 "전체" 포함 확인
    # units는 현재 ["1강","2강",...] — 그대로 유지, sections로 번호별 분기

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
    print(f"✅ test-catalog.json sections 업데이트 완료")

def main():
    sections_map = {}

    for gang_num, meta in GANG_META.items():
        passages = get_passages(gang_num)
        count = len(passages)
        print(f"\n=== {gang_num}강: {meta['title']} ({count}개 지문) ===")

        # 기존 파일 → 전체/ 폴더로 이동
        move_existing_to_jeonche(gang_num)

        sections_map[f"{gang_num}강"] = ["전체"] + [f"{i}번" for i in range(1, count + 1)]

        for ex_num, passage in enumerate(passages, 1):
            ex_dir = BASE / f"{gang_num}강/{ex_num}번"
            ex_dir.mkdir(exist_ok=True)

            for test_type, types_list in [("단어", WORD_TYPES), ("워크북", WORKBOOK_TYPES), ("퀴즈", QUIZ_TYPES)]:
                out_path = ex_dir / f"{test_type}.json"
                if out_path.exists():
                    print(f"  SKIP (기존 파일): {gang_num}강/{ex_num}번/{test_type}.json")
                    continue

                data = make_template(test_type, gang_num, ex_num, passage, meta["title"], types_list)
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  생성: {gang_num}강/{ex_num}번/{test_type}.json")

    update_catalog(sections_map)

    print("\n" + "="*60)
    print("📋 다음 단계: 각 TODO 문항을 실제 출제로 교체")
    print("  - _TODO: true 인 문항들을 SOP 8단계에 따라 출제")
    print("  - 출제 후: npm run validate:all")
    print("  - PASS 후: git push")
    print("="*60)

if __name__ == "__main__":
    main()
