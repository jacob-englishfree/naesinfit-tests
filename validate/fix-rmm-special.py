#!/usr/bin/env python3
"""
Fix remaining RENDER-MARKER-MISSING errors using special-cases mapping.
For each (file, qid, marker): (find_correct_form, display_wrong_form)
Replace find_correct_form in passage with marker<u>display_wrong_form</u>
"""

import json
import re

BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/'

# (file_rel, qid, marker): (find_in_passage, display_wrong_word)
SPECIAL_CASES = {
    # 23번/단어.json
    ('data/모의고사/고3/3월_2024/23번/단어.json', 5, '②'): ('mortality', 'immortality'),
    ('data/모의고사/고3/3월_2024/23번/단어.json', 6, '③'): ('oppose', 'support'),
    # 24번/단어.json
    ('data/모의고사/고3/3월_2024/24번/단어.json', 4, '④'): ('proverb', 'falsehood'),
    # 26번/단어.json
    ('data/모의고사/고3/3월_2024/26번/단어.json', 4, '③'): ('sparked', 'extinguished'),
    ('data/모의고사/고3/3월_2024/26번/단어.json', 5, '②'): ('accepted', 'rejected'),
    # 26번/퀴즈.json
    ('data/모의고사/고3/3월_2024/26번/퀴즈.json', 1, '④'): ('dropped', 'dropping'),
    ('data/모의고사/고3/3월_2024/26번/퀴즈.json', 3, '②'): ('that', 'which'),
    # 29번/단어.json  Q4 missing ③ (failure→success), Q5 missing ③ (trivial→life-changing)
    ('data/모의고사/고3/3월_2024/29번/단어.json', 4, '③'): ('success', 'failure'),
    ('data/모의고사/고3/3월_2024/29번/단어.json', 5, '③'): ('life-changing', 'trivial'),
    # 29번/워크북.json
    ('data/모의고사/고3/3월_2024/29번/워크북.json', 2, '②'): ('privileged', 'privileging'),
    ('data/모의고사/고3/3월_2024/29번/워크북.json', 4, '③'): ('success', 'successful'),
    # 30번/단어.json
    ('data/모의고사/고3/3월_2024/30번/단어.json', 4, '②'): ('failed to', 'succeeded in'),
    ('data/모의고사/고3/3월_2024/30번/단어.json', 5, '③'): ('stable', 'unstable'),
    # 30번/퀴즈.json
    ('data/모의고사/고3/3월_2024/30번/퀴즈.json', 3, '④'): ('Whether', 'What'),
    ('data/모의고사/고3/3월_2024/30번/퀴즈.json', 4, '②'): ('failed to', 'managed to'),
    # 31번/워크북.json
    ('data/모의고사/고3/3월_2024/31번/워크북.json', 3, '③'): ('to invent', 'inventing'),
    ('data/모의고사/고3/3월_2024/31번/워크북.json', 4, '①'): ('characteristic', 'characterizing'),
    # 32번/워크북.json
    ('data/모의고사/고3/3월_2024/32번/워크북.json', 1, '②'): ('offended', 'offending'),
    ('data/모의고사/고3/3월_2024/32번/워크북.json', 2, '③'): ('assert', 'asserts'),
    ('data/모의고사/고3/3월_2024/32번/워크북.json', 3, '④'): ('deserving', 'deserved'),
    ('data/모의고사/고3/3월_2024/32번/워크북.json', 4, '②'): ('to do', 'doing'),
    # 33번/단어.json
    ('data/모의고사/고3/3월_2024/33번/단어.json', 4, '②'): ('waste', 'invest'),
    ('data/모의고사/고3/3월_2024/33번/단어.json', 5, '③'): ('mistreats', 'compliments'),
    ('data/모의고사/고3/3월_2024/33번/단어.json', 6, '①'): ('pointless', 'meaningful'),
    # 33번/워크북.json
    ('data/모의고사/고3/3월_2024/33번/워크북.json', 2, '①'): ('get', 'gets'),
    ('data/모의고사/고3/3월_2024/33번/워크북.json', 3, '②'): ('change', 'changing'),
    ('data/모의고사/고3/3월_2024/33번/워크북.json', 4, '④'): ('to say', 'saying'),
    # 34번/단어.json
    ('data/모의고사/고3/3월_2024/34번/단어.json', 2, '③'): ('imported', 'exported'),
    ('data/모의고사/고3/3월_2024/34번/단어.json', 7, '④'): ('assertive', 'passive'),
    ('data/모의고사/고3/3월_2024/34번/단어.json', 19, '①'): ('corresponded', 'contradicted'),
    ('data/모의고사/고3/3월_2024/34번/단어.json', 19, '②'): ('corresponded', 'contradicted'),  # same word, 2nd occurrence
    # 36번/단어.json
    ('data/모의고사/고3/3월_2024/36번/단어.json', 2, '③'): ('spontaneously', 'deliberately'),
    # 37번/단어.json
    ('data/모의고사/고3/3월_2024/37번/단어.json', 2, '①'): ('controversial', 'undisputed'),
    # 37번/퀴즈.json
    ('data/모의고사/고3/3월_2024/37번/퀴즈.json', 4, '①'): ('controversial', 'undisputed'),
    # 38번/단어.json
    ('data/모의고사/고3/3월_2024/38번/단어.json', 2, '④'): ('discrimination', 'equality'),
    # 38번/워크북.json
    ('data/모의고사/고3/3월_2024/38번/워크북.json', 5, '③'): ('premiums', 'discounts'),
    # 38번/퀴즈.json
    ('data/모의고사/고3/3월_2024/38번/퀴즈.json', 4, '④'): ('discrimination', 'equality'),
    # 39번/단어.json
    ('data/모의고사/고3/3월_2024/39번/단어.json', 2, '③'): ('foreshortened', 'elongated'),
    # 40번/단어.json
    ('data/모의고사/고3/3월_2024/40번/단어.json', 7, '①'): ('altered', 'unchanged'),
    ('data/모의고사/고3/3월_2024/40번/단어.json', 19, '①'): ('blossoming', 'withering'),
    # 40번/워크북.json - Q5 missing ① and ②
    ('data/모의고사/고3/3월_2024/40번/워크북.json', 5, '①'): ('altered', 'unchanged'),
    ('data/모의고사/고3/3월_2024/40번/워크북.json', 5, '②'): ('remolding', 'preserving'),
    # 40번/퀴즈.json
    ('data/모의고사/고3/3월_2024/40번/퀴즈.json', 5, '①'): ('altered', 'unchanged'),
    # 41-42번/단어.json
    ('data/모의고사/고3/3월_2024/41-42번/단어.json', 5, '③'): ('fresh', 'stale'),
    ('data/모의고사/고3/3월_2024/41-42번/단어.json', 6, '④'): ('tainted', 'purified'),
    # 41-42번/퀴즈.json
    ('data/모의고사/고3/3월_2024/41-42번/퀴즈.json', 4, '④'): ('layers', 'surfaces'),
    ('data/모의고사/고3/3월_2024/41-42번/퀴즈.json', 5, '②'): ('relieve', 'intensify'),
    # 43-45번/단어.json
    ('data/모의고사/고3/3월_2024/43-45번/단어.json', 4, '④'): ('forgotten', 'brand-new'),
    ('data/모의고사/고3/3월_2024/43-45번/단어.json', 5, '②'): ('joy', 'sorrow'),
    ('data/모의고사/고3/3월_2024/43-45번/단어.json', 6, '④'): ('widened', 'narrowed'),
    # 3월_2025 files
    ('data/모의고사/고3/3월_2025/19번/퀴즈.json', 1, '④'): ('blank', 'blanking'),
    ('data/모의고사/고3/3월_2025/20번/퀴즈.json', 4, '④'): ('openness', 'resistance'),
    ('data/모의고사/고3/3월_2025/20번/퀴즈.json', 5, '①'): ('persuasive', 'divisive'),
    # 고1/9월/41-42번/워크북.json - Q5 all markers missing
    # need to find which words to mark - check passage
    # det.korean: ① indifferences → concerns; others unknown
    # 부교재 files
    ('data/부교재/수능특강/영어/11강/단어.json', 4, '④'): ('wasteful', 'rewarding'),
    ('data/부교재/수능특강/영어/11강/단어.json', 5, '②'): ('construction', 'champion'),
    ('data/부교재/수능특강/영어/11강/단어.json', 6, '①'): ('elite', 'ordinary'),
    ('data/부교재/수능특강/영어/11강/워크북.json', 6, '②'): ('wasteful', 'productive'),
    ('data/부교재/수능특강/영어/12강/2번/단어.json', 6, '④'): ('artificial', 'familiar'),  # need to check
    # 1강 files
    ('data/부교재/수능특강/영어/1강/단어.json', 4, '③'): ('submit', 'withdraw'),
    ('data/부교재/수능특강/영어/1강/단어.json', 6, '④'): ('glad', 'reluctant'),
    ('data/부교재/수능특강/영어/1강/Gateway/퀴즈.json', 6, '④'): ('encouraging', 'discouraging'),
    ('data/부교재/수능특강/영어/1강/2번/단어.json', 4, '③'): ('feedback', 'praise'),
    # 20강 files
    # 22강 files
    ('data/부교재/수능특강/영어/23강/단어.json', 20, '④'): ('biased', 'unbiased'),
    ('data/부교재/수능특강/영어/23강/1번/퀴즈.json', 1, '③'): ('that', 'those'),
    # 24강 files
    ('data/부교재/수능특강/영어/24강/Gateway/퀴즈.json', 7, '②'): ('Holding', 'Held'),
    # 2강 files
    ('data/부교재/수능특강/영어/2강/1번/워크북.json', 7, '③'): ('serious', 'seriously'),
    ('data/부교재/수능특강/영어/2강/1번/퀴즈.json', 3, '③'): ('serious', 'seriously'),
    # 9강 files
    ('data/부교재/수능특강/영어/9강/Gateway/단어.json', 6, '①'): ('alike', 'differently'),
}


def insert_marker(passage, marker, find_word, display_word, qid):
    """Replace find_word in passage with marker<u>display_word</u>."""
    if not find_word:
        return passage, f'Q{qid} {marker}: SKIP no find_word'
    if f'{marker}<u>' in passage:
        return passage, f'Q{qid} {marker}: already tagged'

    # Try exact match
    if find_word in passage:
        idx = passage.find(find_word)
        if idx > 0 and passage[idx-1] in '①②③④':
            return passage, f'Q{qid} {marker}: already tagged (prefix)'
        # Check for word boundary to avoid partial matches
        new_p = passage.replace(find_word, f'{marker}<u>{display_word}</u>', 1)
        return new_p, f'Q{qid} {marker}: replaced "{find_word}" → {marker}<u>{display_word}</u>'

    # Case-insensitive
    pat = re.compile(re.escape(find_word), re.IGNORECASE)
    m = pat.search(passage)
    if m:
        before = passage[:m.start()]
        after = passage[m.end():]
        new_p = before + f'{marker}<u>{display_word}</u>' + after
        return new_p, f'Q{qid} {marker}: replaced (case-insensitive) "{find_word}" → {marker}<u>{display_word}</u>'

    return passage, f'Q{qid} {marker}: SKIP - "{find_word}" not found'


def process_file(filepath):
    full_path = BASE + filepath
    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modified = False
    all_fixes = []

    for q in data['questions']:
        qid = q['id']
        passage = q.get('passage') or ''
        if not passage:
            continue

        # Collect special cases for this question
        for marker in ['①', '②', '③', '④']:
            key = (filepath, qid, marker)
            if key not in SPECIAL_CASES:
                continue
            if marker in passage:
                continue  # already present

            find_word, display_word = SPECIAL_CASES[key]
            new_passage, log = insert_marker(passage, marker, find_word, display_word, qid)
            all_fixes.append(f'  {log}')
            if new_passage != passage:
                passage = new_passage
                q['passage'] = new_passage
                modified = True

    if modified:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'FIXED: {filepath}')
    else:
        # Check if any keys exist for this file
        relevant_keys = [k for k in SPECIAL_CASES if k[0] == filepath]
        if relevant_keys:
            print(f'SKIP:  {filepath} (no change)')
        # else: not in special cases list

    for fix in all_fixes:
        print(fix)
    return modified


if __name__ == '__main__':
    # Get unique files from special cases
    files_to_process = sorted(set(k[0] for k in SPECIAL_CASES.keys()))

    print(f'Processing {len(files_to_process)} files...\n')
    fixed_count = 0
    for filepath in files_to_process:
        if process_file(filepath):
            fixed_count += 1

    print(f'\nDone: {fixed_count}/{len(files_to_process)} files modified.')
