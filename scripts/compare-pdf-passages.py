#!/usr/bin/env python3
"""
Phase 3: EBS 수능특강 원본 PDF ↔ fullPassage 자동 비교

1. PDF에서 영문 passage 추출
2. JSON fullPassage와 단어 단위 diff
3. 차이 리포트 출력
"""
import fitz
import json
import os
import re
import sys
from difflib import SequenceMatcher

PDF_PATH = "/Users/woobumpark/Desktop/영어해방공식&내신핏/데이터/영어해방공식,내신해방공식/2026내신해방공식/2027학년도 EBS수능특강/원본/2027학년도 EBS수능특강 영어.pdf"
DATA_ROOT = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/data/부교재/수능특강/영어"

def extract_pdf_passages(pdf_path):
    """Extract English passages from EBS PDF, grouped roughly."""
    doc = fitz.open(pdf_path)
    passages = []
    current = []
    for page_num in range(len(doc)):
        text = doc[page_num].get_text()
        # Extract English sentences (lines with mostly English)
        for line in text.split('\n'):
            en_chars = sum(1 for c in line if c.isascii() and c.isalpha())
            total = len(line.strip())
            if total > 20 and en_chars / max(total, 1) > 0.5:
                current.append(line.strip())
            elif current and len(' '.join(current)) > 100:
                passages.append({
                    'text': ' '.join(current),
                    'page': page_num
                })
                current = []
        if current and len(' '.join(current)) > 100:
            passages.append({
                'text': ' '.join(current),
                'page': page_num
            })
            current = []
    return passages

def normalize_text(s):
    """Normalize for comparison."""
    if not s:
        return ''
    # Remove HTML tags
    s = re.sub(r'<[^>]+>', '', s)
    # Remove markers
    s = re.sub(r'[①②③④⑤⑥⑦⑧⑨⑩]', '', s)
    # Normalize whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def get_json_passages(data_root):
    """Collect all fullPassage from JSON files."""
    results = []
    for gang in sorted(os.listdir(data_root)):
        gang_path = os.path.join(data_root, gang)
        if not os.path.isdir(gang_path):
            continue
        for root, dirs, files in os.walk(gang_path):
            dirs[:] = [d for d in dirs if d != '_passages']
            for f in files:
                if not f.endswith('.json'):
                    continue
                fp = os.path.join(root, f)
                try:
                    data = json.load(open(fp, 'r', encoding='utf-8'))
                except:
                    continue
                full = data.get('fullPassage', '')
                if full and len(full) > 50:
                    rel = os.path.relpath(fp, data_root)
                    results.append({
                        'file': rel,
                        'gang': gang,
                        'passage': normalize_text(full)
                    })
    return results

def find_best_match(json_passage, pdf_passages, min_ratio=0.6):
    """Find the best matching PDF passage for a JSON fullPassage."""
    # Use first 80 chars for quick filter
    words = json_passage.split()[:15]
    query = ' '.join(words).lower()

    best_ratio = 0
    best_match = None

    for pp in pdf_passages:
        pdf_text = pp['text'].lower()
        # Quick check: do any query words appear?
        if not any(w in pdf_text for w in query.split()[:3]):
            continue

        # Detailed comparison
        ratio = SequenceMatcher(None,
            json_passage[:500].lower(),
            pdf_text[:500].lower()
        ).ratio()

        if ratio > best_ratio:
            best_ratio = ratio
            best_match = pp

    if best_ratio >= min_ratio:
        return best_match, best_ratio
    return None, best_ratio

def word_diff(a, b):
    """Word-level diff between two texts."""
    wa = a.split()
    wb = b.split()
    sm = SequenceMatcher(None, wa, wb)
    diffs = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        diffs.append({
            'type': tag,
            'json': ' '.join(wa[i1:i2]),
            'pdf': ' '.join(wb[j1:j2])
        })
    return diffs

def main():
    print("PDF 로딩...")
    pdf_passages = extract_pdf_passages(PDF_PATH)
    print(f"PDF에서 {len(pdf_passages)}개 passage 추출")

    print("JSON fullPassage 수집...")
    json_passages = get_json_passages(DATA_ROOT)
    print(f"JSON에서 {len(json_passages)}개 fullPassage 수집")

    # Deduplicate JSON passages by gang+passage hash
    seen = set()
    unique_json = []
    for jp in json_passages:
        key = jp['gang'] + '|' + jp['passage'][:100]
        if key not in seen:
            seen.add(key)
            unique_json.append(jp)
    print(f"중복 제거 후 {len(unique_json)}개")

    matched = 0
    mismatched = 0
    unmatched = 0
    issues = []

    for jp in unique_json:
        best, ratio = find_best_match(jp['passage'], pdf_passages)
        if best is None:
            unmatched += 1
            continue

        matched += 1
        # Word-level diff
        diffs = word_diff(
            normalize_text(jp['passage'])[:1000],
            normalize_text(best['text'])[:1000]
        )

        if len(diffs) > 3:
            mismatched += 1
            issues.append({
                'file': jp['file'],
                'gang': jp['gang'],
                'ratio': round(ratio, 3),
                'diff_count': len(diffs),
                'diffs': diffs[:10],
                'pdf_page': best['page']
            })

    print(f"\n=== 결과 ===")
    print(f"매칭: {matched}, 불일치: {mismatched}, 미매칭: {unmatched}")
    print(f"불일치율: {mismatched}/{matched} = {mismatched/max(matched,1)*100:.1f}%")

    # Sort issues by diff count
    issues.sort(key=lambda x: -x['diff_count'])

    print(f"\n=== 불일치 TOP 20 ===")
    for iss in issues[:20]:
        print(f"\n{iss['file']} (p{iss['pdf_page']}, ratio={iss['ratio']}, diffs={iss['diff_count']})")
        for d in iss['diffs'][:5]:
            print(f"  {d['type']}: JSON[{d['json'][:50]}] ↔ PDF[{d['pdf'][:50]}]")

    # Save full report
    report_path = os.path.join(os.path.dirname(DATA_ROOT), 'reports', 'pdf-passage-compare.json')
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {'matched': matched, 'mismatched': mismatched, 'unmatched': unmatched},
            'issues': issues
        }, f, ensure_ascii=False, indent=2)
    print(f"\n리포트: {report_path}")

if __name__ == '__main__':
    main()
