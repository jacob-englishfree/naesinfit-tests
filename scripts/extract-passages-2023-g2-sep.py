#!/usr/bin/env python3
"""
2023 고2 9월 모의고사 passages 추출 (PyMuPDF 블록 기반)
원본 문제 페이지에서 영어 지문만 좌표 기반 추출
"""
import fitz
import json
import re
import os

PDF_PATH = '/Users/woobumpark/Desktop/영어해방공식&내신핏/원문,참고자료 다모으기(내신핏)/모의고사원본/고2/2023년 고2 9월 모의고사/2023년_고2_9월_인천광역시 교육청_학력평가_지문분석(20231004수정).pdf'

OUT_DIR = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data/모의고사/고2/9월_2023/_passages'

# 원본 문제 pages (1-indexed)
PAGES = {
    18: (3, '목적'),
    19: (7, '심경'),
    20: (11, '주장'),
    21: (15, '함축의미'),
    22: (19, '요지'),
    23: (23, '주제'),
    24: (27, '제목'),
    26: (32, '일치불일치'),
    29: (40, '어법'),
    30: (44, '어휘'),
    31: (47, '빈칸'),
}

def is_english_block(text):
    """Check if text block is primarily English"""
    if not text.strip():
        return False
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    total = len(text.strip())
    if total == 0:
        return False
    return ascii_chars / total > 0.75

def is_choice_block(text):
    """Check if block is a choices block (①~⑤ list, not passage markers)"""
    markers = [m for m in '①②③④⑤' if m in text]
    if len(markers) < 3:
        return False
    # If block is long (>300 chars), it's a passage with markers, not choices
    if len(text.strip()) > 300:
        return False
    # Short block with 3+ markers = likely choices list
    return True

def is_footnote_block(text):
    """Check if block is a footnote (*word: meaning)"""
    t = text.strip()
    return t.startswith('*') and ':' in t[:30]

def is_meta_block(text):
    """Check if block is metadata (WORDS, 정답, 원본문제 etc.)"""
    t = text.strip()
    return any(k in t for k in ['WORDS', '정답', '❙', '출제 가능한', 'CHECK', '해석', '해설'])

def extract_passage(doc, page_num, q_num):
    """Extract English passage blocks from left column"""
    page = doc[page_num - 1]  # 0-indexed
    blocks = page.get_text('blocks')

    # Left column boundary (x < 395)
    LEFT_MAX = 395

    # Find blocks in left column, below question line, above choices
    passage_blocks = []
    found_question = False

    for block in blocks:
        x0, y0, x1, y1, text, block_no, block_type = block

        # Skip right column blocks
        if x0 >= LEFT_MAX:
            continue

        # Skip non-text blocks
        if block_type != 0:
            continue

        text_clean = text.strip()

        # Detect question line
        if re.match(rf'^{q_num}\.', text_clean) or (f'{q_num}.' in text_clean and '다음' in text_clean):
            found_question = True
            continue

        if not found_question:
            continue

        # Stop at choices (①~⑤ list)
        if is_choice_block(text_clean):
            break

        # Stop at footnotes (*word: meaning)
        if is_footnote_block(text_clean):
            break

        # Stop at metadata
        if is_meta_block(text_clean):
            break

        # Keep English blocks (passage content)
        if is_english_block(text_clean):
            # Clean up the text
            cleaned = text.replace('\n', ' ').strip()
            cleaned = re.sub(r'\s+', ' ', cleaned)
            passage_blocks.append(cleaned)

    if not passage_blocks:
        return None

    # Join blocks
    passage = ' '.join(passage_blocks)

    # Clean up special characters
    passage = passage.replace('\xad', '-')  # soft hyphen -> hyphen
    passage = passage.replace('\u00ad', '-')
    passage = passage.replace('\u2019', "'")  # smart quote
    passage = passage.replace('\u201c', '"').replace('\u201d', '"')
    passage = passage.replace('\u2014', '—')  # em dash
    passage = re.sub(r'\s+', ' ', passage).strip()

    # Remove exam markers for 어법/어휘 (①②③④⑤ in passage)
    # Keep them as they are needed for those question types

    return passage

def count_sentences(text):
    parts = re.split(r'(?<=[.!?])\s+', text)
    return len([p for p in parts if p.strip()])

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)

    results = {}

    for q_num, (page_num, q_type) in PAGES.items():
        passage = extract_passage(doc, page_num, q_num)

        if not passage:
            print(f'{q_num}번: FAILED')
            continue

        wc = len(passage.split())
        sc = count_sentences(passage)

        data = {
            'id': f'{q_num}번',
            'subject': '2023년 9월 고2 모의고사',
            'title': f'{q_num}번 - {q_type}',
            'fullPassage': passage,
            'sentenceCount': sc,
            'wordCount': wc
        }

        out_path = os.path.join(OUT_DIR, f'{q_num}번.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        results[q_num] = wc
        print(f'{q_num}번 ({q_type}): {wc}w / {sc}s')
        print(f'  First 150: {passage[:150]}')
        print(f'  Last 100: {passage[-100:]}')
        print()

    doc.close()
    print(f'\nTotal: {len(results)}/11 passages extracted')

if __name__ == '__main__':
    main()
