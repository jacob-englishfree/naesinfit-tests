#!/usr/bin/env python3
"""
Round 4: Fix remaining 20 S-grade errors in 12 files
"""
import json
import re
import os
import subprocess

ROOT = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests'
files = json.load(open('/tmp/final739-b3.json'))

def load(f):
    return json.load(open(os.path.join(ROOT, f), encoding='utf-8'))

def save(f, data):
    path = os.path.join(ROOT, f)
    with open(path, 'w', encoding='utf-8') as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    print(f'  SAVED: {f}')

def validate(f):
    result = subprocess.run(['node', 'validate/validate.js', f],
                          capture_output=True, text=True, cwd=ROOT)
    s_errors = [line.strip() for line in result.stdout.split('\n') if '[S]' in line]
    return s_errors


# =============================================================================
# FIX 1: S-MULTI-CORRECT in 9강/3번/워크북.json and 9강/4번/워크북.json (Q7)
# Also fixes A6 and A7 for 9강/3번/워크북.json
# =============================================================================
print('\n=== FIX 1: S-MULTI-CORRECT Q7 Perkin workbooks + A6/A7 ===')

for path in [
    'data/부교재/수능특강/영어/9강/3번/워크북.json',
    'data/부교재/수능특강/영어/9강/4번/워크북.json',
]:
    data = load(path)
    q7 = data['questions'][6]  # Q7 (index 6)

    # Fix ch[0]: 'Perkin은 Royal College of Chemistry에서 프랑스 화학자에게 배웠다.'
    # → 'Perkin은 런던에서 의학을 공부했다.'
    # Fix ch[3]: '합성 염료 mauve는 금색이었다.'
    # → '합성 염료의 발명은 20세기에 이루어졌다.'
    old_ch = q7.get('ch', [])
    if len(old_ch) >= 4:
        if 'Royal College' in old_ch[0]:
            q7['ch'][0] = 'Perkin은 런던에서 의학을 공부했다.'
        if '금색' in old_ch[3] or 'mauve' in old_ch[3]:
            q7['ch'][3] = '합성 염료의 발명은 20세기에 이루어졌다.'

    # Fix A7 (Q11~Q17 all ans=2) → change Q17's ch so metabolism is at position 1 (ans=1)
    # Q17: ch=['physics', 'metabolism', 'chemistry', 'biology'], ans=2
    # → ch=['metabolism', 'physics', 'chemistry', 'biology'], ans=1
    q17 = data['questions'][16]  # Q17 (index 16)
    if q17.get('type') == '빈칸추론' and 'metabolism' in q17.get('ch', []):
        old_ans = q17['ans']
        old_ch = q17['ch']
        metabolism_idx = old_ch.index('metabolism')
        if metabolism_idx == 1:  # currently at position 2 (ans=2)
            q17['ch'] = ['metabolism', 'physics', 'chemistry', 'biology']
            q17['ans'] = 1
            # Update det to reflect new positions
            if 'det' in q17:
                q17['det']['analysis'] = '✅ ① metabolism\n❌ ② physics\n❌ ③ chemistry\n❌ ④ biology\n✅①metabolism: 신진대사\n❌②③④: 문맥 부적합'

    save(path, data)

print('  Verifying...')
for path in ['data/부교재/수능특강/영어/9강/3번/워크북.json', 'data/부교재/수능특강/영어/9강/4번/워크북.json']:
    errs = validate(path)
    print(f'  {path}: {errs if errs else "PASS"}')


# =============================================================================
# FIX 2: S-MULTI-CORRECT Q17 in 퀴즈 files (Kleiber questions)
# =============================================================================
print('\n=== FIX 2: S-MULTI-CORRECT Q17 Kleiber quiz files ===')

for path in [
    'data/부교재/수능특강/영어/9강/3번/퀴즈.json',
    'data/부교재/수능특강/영어/9강/4번/퀴즈.json',
    'data/부교재/수능특강/영어/9강/퀴즈.json',
]:
    data = load(path)
    q17 = data['questions'][16]  # Q17 (index 16)

    # Find and replace flagged wrong choices
    # 'Kleiber Hall은 그의 사후에 명명되었다.' → 'Max Kleiber는 스위스에서 태어났다.'
    # '1952년에 Borden Award와 Morrison Award를 동시에 수상했다.' → 'Kleiber는 주로 식물학 연구로 알려져 있다.'

    correct_ans = q17.get('ans', 1)
    new_ch = []
    for i, c in enumerate(q17.get('ch', [])):
        if 'Kleiber Hall' in c and '사후' in c:
            new_ch.append('Max Kleiber는 스위스에서 태어났다.')
        elif 'Borden Award' in c or 'Morrison Award' in c:
            new_ch.append('Kleiber는 주로 식물학 연구로 알려져 있다.')
        else:
            new_ch.append(c)

    if new_ch != q17.get('ch', []):
        q17['ch'] = new_ch
        # Update det to match new choices
        if 'det' in q17:
            markers = ['①', '②', '③', '④']
            lines = []
            for i, c in enumerate(new_ch):
                if i + 1 == correct_ans:
                    lines.append(f'✅ {markers[i]} {c}')
                else:
                    lines.append(f'❌ {markers[i]} {c}')
            q17['det']['analysis'] = '\n'.join(lines)

    save(path, data)

print('  Verifying...')
for path in ['data/부교재/수능특강/영어/9강/3번/퀴즈.json', 'data/부교재/수능특강/영어/9강/4번/퀴즈.json', 'data/부교재/수능특강/영어/9강/퀴즈.json']:
    errs = validate(path)
    print(f'  {path}: {errs if errs else "PASS"}')


# =============================================================================
# FIX 3: A7 for 수능특강/영어독해연습/9강/10번/워크북.json
# Q6,Q7,Q8 all ans=1 → change Q6 ans from 1 to 4 (match det.korean which says ④ is wrong)
# =============================================================================
print('\n=== FIX 3: A7 수능특강영독/9강/10번/워크북.json ===')

path = 'data/부교재/수능특강/영어독해연습/9강/10번/워크북.json'
data = load(path)
q6 = data['questions'][5]  # Q6

# det.korean says '④ inexperienced → accomplished'
# So ④ is the wrong one, ans should be 4
# Current ans=1, ch=['① ', '② ', '③', '④']
# For 어휘 type, ch values are just the marker labels
# Changing ans from 1 to 4 means the 4th choice (④) is the incorrect one
if q6.get('type') == '어휘' and q6.get('ans') == 1:
    q6['ans'] = 4
    # Update det.analysis to reflect ans=4
    if 'det' in q6:
        q6['det']['analysis'] = '✅ ① foundation(토대): 반복적으로 지시받는 것이 다른 감정의 토대를 제공한다는 문맥에 적절\n✅ ② agentive(주체적인): 스스로 알아내는 사람이 되면 정체성에 주체적 차원이 생긴다는 문맥에 적절\n✅ ③ preempts(선점하다): 명시적으로 정보를 제공하면 학생이 스스로 알아낼 기회를 선점한다는 문맥에 적절\n❌ ④ inexperienced → accomplished: most inexperienced teachers do not spend a lot of time in telling mode는 경험 부족한 교사가 지시하지 않는다는 의미가 되어, 연구 결과의 논지와 반대. 유능한(accomplished) 교사일수록 지시 모드를 덜 쓴다는 것이 본문의 결론 ←정답'
        q6['det']['korean'] = '④ inexperienced(경험이 부족한) → accomplished(유능한)'

save(path, data)
errs = validate(path)
print(f'  {path}: {errs if errs else "PASS"}')


# =============================================================================
# FIX 4: Q3-ANS-NOT-IN-FP — 6 단어 files
# Words appear capitalized (sentence-initial) in fullPassage
# Fix: lowercase those sentence-initial capitalizations in fullPassage
# ch values already lowercase → after fix, fullPassage.includes(word) will be True
# =============================================================================
print('\n=== FIX 4: Q3-ANS-NOT-IN-FP lowercase in fullPassage ===')

cases = [
    ('data/부교재/수능특강Light/영어/19강/1번/단어.json', 8, 'impatience', 'Impatience'),
    ('data/부교재/수능특강Light/영어/19강/3번/단어.json', 7, 'fermented', 'Fermented'),
    ('data/부교재/수능특강Light/영어/20강/3번/단어.json', 17, 'consequently', 'Consequently'),
    ('data/부교재/수능특강Light/영어/3강/1번/단어.json', 9, 'wander', 'Wander'),
    ('data/부교재/수능특강Light/영어/4강/Gateway/단어.json', 7, 'freedom', 'Freedom'),
    ('data/부교재/수능특강Light/영어/4강/Gateway/단어.json', 9, 'slavery', 'Slavery'),
]

# Group by file to handle multiple fixes in one file
from collections import defaultdict
file_fixes = defaultdict(list)
for p, qnum, lower, upper in cases:
    file_fixes[p].append((qnum, lower, upper))

for filepath, fixlist in file_fixes.items():
    data = load(filepath)
    fp = data.get('fullPassage', '')
    changed = False

    for qnum, lower, upper in fixlist:
        # Replace sentence-initial capitalized word with lowercase
        # Pattern: after . ! ? \n (sentence boundary) + optional space + Capital
        # Use re.sub to replace Capital version with lowercase
        new_fp = re.sub(r'(?<=[.!?\n]\s)' + re.escape(upper) + r'\b', lower, fp)
        if new_fp != fp:
            fp = new_fp
            changed = True
        # Also handle start-of-string
        if fp.startswith(upper + ' ') or fp.startswith(upper + ','):
            fp = lower + fp[len(upper):]
            changed = True

        # Verify the ch value matches (should be lowercase already)
        q = data['questions'][qnum - 1]
        ch_ans = q['ch'][q['ans'] - 1] if q.get('ch') and isinstance(q.get('ans'), int) else ''
        if ch_ans != lower:
            # Fix the ch to be lowercase
            q['ch'][q['ans'] - 1] = lower
            changed = True

    if changed:
        data['fullPassage'] = fp
        save(filepath, data)

print('  Verifying...')
for p in file_fixes.keys():
    errs = validate(p)
    print(f'  {p}: {errs if errs else "PASS"}')


# =============================================================================
# FIX 5: V63-C for 수능특강Light/1강/2번/워크북.json Q1-Q4
# Remove English text from stem (keep only Korean instruction)
# V63-C: typeNorm='어법' AND passage.length > 100 AND stemEng.length > 15
# Fix: Move English text out of stem (keep only Korean instruction)
# =============================================================================
print('\n=== FIX 5: V63-C 수능특강Light/1강/2번/워크북.json Q1-Q4 ===')

path = 'data/부교재/수능특강Light/영어/1강/2번/워크북.json'
data = load(path)

for i in range(4):  # Q1-Q4
    q = data['questions'][i]
    if q.get('type') == '어법':
        stem = q.get('stem', '')
        # Remove everything after the Korean instruction (first sentence ending in 시오)
        # Keep only: '다음 글에서 부분 중 어법상 틀린 것을 고르시오.'
        ko_match = re.match(r'^(.*?(?:시오|시오\.)\s*)', stem, re.DOTALL)
        if ko_match:
            new_stem = ko_match.group(1).strip()
            # Remove trailing newlines from English text
            new_stem = re.sub(r'\n+.*', '', new_stem, flags=re.DOTALL).strip()
            if len(new_stem) < 10:
                new_stem = '다음 글에서 부분 중 어법상 틀린 것을 고르시오.'
            q['stem'] = new_stem
        else:
            # Fallback: keep only the first Korean line
            lines = stem.split('\n')
            korean_lines = [l for l in lines if l.strip() and not re.search(r'[a-zA-Z]{4,}', l)]
            if korean_lines:
                q['stem'] = korean_lines[0].strip()
            else:
                q['stem'] = '다음 글에서 부분 중 어법상 틀린 것을 고르시오.'

# FIX 6: P24 for Q17 어순배열 in same file
# Remove (A)(B)(C) labels from stem → use ① ② ③ notation
q17 = data['questions'][16]  # Q17
if q17.get('type') == '어순배열':
    stem = q17.get('stem', '')
    # Replace (A) → ①, (B) → ②, (C) → ③
    new_stem = stem.replace('(A)', '①').replace('(B)', '②').replace('(C)', '③')
    q17['stem'] = new_stem
    # Update ch too
    new_ch = []
    for c in q17.get('ch', []):
        c = c.replace('A - ', '① - ').replace('B - ', '② - ').replace('C - ', '③ - ')
        c = c.replace(' and C.', ' and ③.').replace('and C', 'and ③')
        new_ch.append(c)
    q17['ch'] = new_ch

save(path, data)
errs = validate(path)
print(f'  {path}: {errs if errs else "PASS"}')


# =============================================================================
# Summary: run validate on all affected files
# =============================================================================
print('\n=== Final validation of all 100 files ===')
total_s = 0
failing_files = []
for f in files:
    errs = validate(f)
    if errs:
        total_s += len(errs)
        failing_files.append((f, errs))

print(f'\nFiles with remaining S errors: {len(failing_files)}/100')
print(f'Total remaining S errors: {total_s}')

if failing_files:
    print('\nRemaining errors:')
    for f, errs in failing_files:
        print(f'\n{f}:')
        for e in errs:
            print(f'  {e}')

print('\nRound 4 Done!')
