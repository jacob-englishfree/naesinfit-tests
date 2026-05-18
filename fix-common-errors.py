#!/usr/bin/env python3
"""Fix common validate errors in response.json files"""
import json, glob, re, sys

def fix_file(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)

    changes = []

    for q in data['decisions']:
        qid = q.get('id', '?')
        stem = q.get('stem', '')

        # Fix 1: S-WA-IN-PASSAGE — 서술형 찾기 stem에 "본문에서 찾아" 연속 포함
        if 'wa' in q and '찾아' in stem and '본문에서 찾아' not in stem:
            # Replace "글에서 ... 찾아" with "본문에서 찾아" contiguous
            if '글에서' in stem:
                # Add "본문에서 찾아 쓰시오" at the end
                new_stem = re.sub(r'찾아\s*쓰시오', '본문에서 찾아 쓰시오', stem)
                if new_stem != stem:
                    q['stem'] = new_stem
                    changes.append(f"  Q{qid}: stem에 '본문에서 찾아' 추가")

        # Fix 2: S-COND-IS-WORDORDER — 조건영작에서 조건단어수 = wa단어수 → 더미 추가
        if 'wa' in q and '[조건]' in stem and '배열' not in stem:
            wa = q['wa']
            wa_words = wa.split()
            wa_count = len(wa_words)
            # Check if stem has word count condition matching wa
            wc_match = re.search(r'(\d+)단어', stem)
            if wc_match:
                stem_wc = int(wc_match.group(1))
                if stem_wc != wa_count:
                    # Fix word count mismatch
                    new_stem = stem.replace(f'{stem_wc}단어', f'{wa_count}단어')
                    q['stem'] = new_stem
                    changes.append(f"  Q{qid}: 단어수 {stem_wc}→{wa_count} 수정")

        # Fix 3: 서술형 stem에 "(영어로)" 또는 "(우리말로)" 확인
        if 'wa' in q and 'ch' not in q:
            if '(영어로)' not in stem and '(우리말로)' not in stem and '영어로' not in stem:
                # Check if wa is English
                if re.search(r'[a-zA-Z]', q.get('wa', '')):
                    q['stem'] = stem.rstrip() + ' (영어로)'
                    changes.append(f"  Q{qid}: '(영어로)' 추가")

        # Fix 4: 어순배열 단어수 불일치
        if 'wa' in q and '배열' in stem:
            wa_words = q['wa'].split()
            wa_count = len(wa_words)
            wc_match = re.search(r'(\d+)단어', stem)
            if wc_match:
                stem_wc = int(wc_match.group(1))
                if stem_wc != wa_count:
                    q['stem'] = stem.replace(f'{stem_wc}단어', f'{wa_count}단어')
                    changes.append(f"  Q{qid}: 어순배열 단어수 {stem_wc}→{wa_count}")

    if changes:
        with open(filepath, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Fixed {filepath}:")
        for c in changes:
            print(c)
    else:
        print(f"No fixes needed: {filepath}")

# Process all files
for pattern in ['data/모의고사/고1/3월_2025/*/워크북.response.json',
                'data/모의고사/고1/3월_2025/*/퀴즈.response.json']:
    for f in sorted(glob.glob(pattern)):
        if any(n in f for n in ['21번','22번','23번','24번','26번']):
            fix_file(f)
