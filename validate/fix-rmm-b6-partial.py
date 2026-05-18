#!/usr/bin/env python3
"""
Fix RENDER-MARKER-MISSING errors: partial cases (some markers already present).
Handles:
1. FOUND_UNTAGGED_U: <u>word</u> exists without marker → prepend marker
2. FOUND_CORRECT (arrow): correct form in passage → replace with marker<u>wrongForm</u>
3. FOUND_PLAIN: word exists as plain text → wrap with marker<u>word</u>

Only modifies 'passage' field.
"""

import json
import re
import sys

MARKERS = ['①','②','③','④']

def get_marker_info_from_analysis(analysis, missing_marker):
    """Extract info about missing marker from det.analysis."""
    lines = analysis.split('\n')
    for line in lines:
        if missing_marker not in line:
            continue
        # Pattern: ③ wrongWord → correctWord
        arrow = re.search(r'[①②③④]\s+([a-zA-Z][a-zA-Z\s\-\'\.]+?)\s*→\s*([a-zA-Z][a-zA-Z\s\-\'\.]+)', line)
        if arrow:
            return {'wrong': arrow.group(1).strip(), 'correct': arrow.group(2).strip(), 'type': 'arrow'}
        # Pattern: ③ word: ... or ③ word — ...
        # Also handles: ③ word(오류) or ✅ ③ word:
        word_m = re.search(r'[①②③④]\s+([a-zA-Z][a-zA-Z\s\-\'\./]+?)(?:\s*[:\(—]|\s*→|\s*$)', line)
        if word_m:
            word = word_m.group(1).strip()
            # Clean up trailing punctuation
            word = word.rstrip('.,;: ')
            return {'word': word, 'type': 'plain'}
    return None

def escape_for_re(s):
    return re.escape(s)

def replace_in_passage(passage, marker, wrong_word, correct_form):
    """
    Replace correct_form in passage with marker<u>wrong_word</u>.
    For "to X" → wrongWord cases: replace whole "to X" phrase.
    """
    # Try exact match first (case-sensitive)
    if correct_form in passage:
        # Check if it's already tagged
        if f'{marker}<u>' in passage[max(0, passage.find(correct_form)-3):passage.find(correct_form)+3]:
            return passage  # already fixed
        new_passage = passage.replace(correct_form, f'{marker}<u>{wrong_word}</u>', 1)
        return new_passage
    # Try case-insensitive
    pattern = re.compile(re.escape(correct_form), re.IGNORECASE)
    match = pattern.search(passage)
    if match:
        before = passage[:match.start()]
        after = passage[match.end():]
        return before + f'{marker}<u>{wrong_word}</u>' + after
    return passage

def fix_partial_markers(f_rel, base):
    """Fix a single file's partial RENDER-MARKER-MISSING issues."""
    full_path = base + f_rel

    with open(full_path, 'r', encoding='utf-8') as fh:
        data = json.load(fh)

    modified = False
    fixes = []

    for q in data['questions']:
        ch = q.get('ch') or []
        passage = q.get('passage') or ''
        has_marker_ch = (len(ch) == 4 and
                         all(re.match(r'^[①②③④⑤]\s*$', c.strip())
                             for c in ch if isinstance(c, str)))
        if not has_marker_ch or not passage:
            continue

        present = [m for m in MARKERS if m in passage]
        missing = [m for m in MARKERS if m not in passage]
        if not missing or not present:
            continue  # all markers present, or none present (handled by fix-rmm-b6.py)

        analysis = q.get('det', {}).get('analysis', '')
        new_passage = passage

        for missing_m in missing:
            info = get_marker_info_from_analysis(analysis, missing_m)
            if not info:
                fixes.append(f'  Q{q["id"]} {missing_m}: NO_EXTRACT from analysis')
                continue

            if info['type'] == 'arrow':
                wrong = info['wrong']
                correct = info['correct']

                # Try to find correct form in passage and replace
                test_passage = replace_in_passage(new_passage, missing_m, wrong, correct)
                if test_passage != new_passage:
                    new_passage = test_passage
                    fixes.append(f'  Q{q["id"]} {missing_m}: replaced "{correct}" with {missing_m}<u>{wrong}</u>')
                else:
                    # Try first word of correct
                    correct_first = correct.split()[0]
                    test_passage2 = replace_in_passage(new_passage, missing_m, wrong, correct_first)
                    if test_passage2 != new_passage:
                        new_passage = test_passage2
                        fixes.append(f'  Q{q["id"]} {missing_m}: replaced first-word "{correct_first}" with {missing_m}<u>{wrong}</u>')
                    else:
                        fixes.append(f'  Q{q["id"]} {missing_m}: SKIP arrow: correct="{correct}" not found in passage')

            elif info['type'] == 'plain':
                word = info['word']

                # Check if word is in <u>word</u> without marker → prepend marker
                untagged_u = re.search(r'(?<![①②③④])<u>' + re.escape(word) + r'</u>', new_passage)
                if untagged_u:
                    new_passage = new_passage[:untagged_u.start()] + missing_m + new_passage[untagged_u.start():]
                    fixes.append(f'  Q{q["id"]} {missing_m}: prepended to <u>{word}</u>')
                    continue

                # Check if word is plain text → wrap with marker<u>word</u>
                # Try full phrase first, then first word
                for target in [word, word.split()[0]]:
                    if target and target in new_passage:
                        # Make sure it's not already tagged
                        idx = new_passage.find(target)
                        if idx > 0 and new_passage[idx-1] in '①②③④':
                            fixes.append(f'  Q{q["id"]} {missing_m}: already tagged "{target}"')
                            break
                        # For "are" (common word), be more precise
                        if len(target) <= 3:
                            # Use word boundary
                            pattern = re.compile(r'\b' + re.escape(target) + r'\b')
                            match = pattern.search(new_passage)
                            if match:
                                before = new_passage[:match.start()]
                                after = new_passage[match.end():]
                                new_passage = before + f'{missing_m}<u>{target}</u>' + after
                                fixes.append(f'  Q{q["id"]} {missing_m}: wrapped plain "{target}" with {missing_m}<u>{target}</u> (word boundary)')
                                break
                        else:
                            new_passage = new_passage.replace(target, f'{missing_m}<u>{target}</u>', 1)
                            fixes.append(f'  Q{q["id"]} {missing_m}: wrapped plain "{target}" with {missing_m}<u>{target}</u>')
                            break
                else:
                    fixes.append(f'  Q{q["id"]} {missing_m}: SKIP plain: "{word}" not found')

        if new_passage != passage:
            q['passage'] = new_passage
            modified = True

    if modified:
        with open(full_path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        print(f'FIXED: {f_rel}')
    else:
        print(f'SKIP:  {f_rel}')

    for fix in fixes:
        print(fix)

    return modified


if __name__ == '__main__':
    base = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/'

    with open('/tmp/rmm-b6.json', 'r') as fh:
        files = json.load(fh)

    # Add the special cases map for complex replacements
    SPECIAL_CASES = {
        # (file_rel, qid, marker): (wrong_word, correct_form_in_passage)
        ('data/부교재/수능특강Light/영어/7강/4번/워크북.json', 3, '③'): ('them', 'whom'),
        ('data/부교재/수능특강Light/영어/7강/4번/워크북.json', 6, '③'): ('ignore', 'follow'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 2, '②'): ('weather', 'whether'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 3, '④'): ('misunderstand', 'understand'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 6, '②'): ('showing', 'showed'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 10, '①'): ('homogeneously', 'homogeneous'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 11, '③'): ('more precious', 'precious'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 14, '④'): ('an astounding floods', 'astounding flood'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 18, '①'): ('uncredentialed', 'credentialed'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 19, '②'): ('containing', 'contains'),
        ('data/부교재/올림포스독해의기본2/2025/10강/전체/워크북.json', 20, '①'): ('misleading', 'misled'),
    }

    # Process special cases first
    special_files = set(k[0] for k in SPECIAL_CASES.keys())
    for f_rel in special_files:
        full_path = base + f_rel
        with open(full_path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)

        modified = False
        for q in data['questions']:
            passage = q.get('passage') or ''
            for marker in MARKERS:
                key = (f_rel, q['id'], marker)
                if key not in SPECIAL_CASES:
                    continue
                if marker in passage:
                    continue  # already fixed

                wrong, correct = SPECIAL_CASES[key]
                new_passage = replace_in_passage(passage, marker, wrong, correct)
                if new_passage != passage:
                    q['passage'] = new_passage
                    passage = new_passage
                    modified = True
                    print(f'SPECIAL FIXED: {f_rel} Q{q["id"]} {marker}: {correct} → {marker}<u>{wrong}</u>')
                else:
                    print(f'SPECIAL SKIP: {f_rel} Q{q["id"]} {marker}: correct="{correct}" not found')

        if modified:
            with open(full_path, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)

    print()
    print('=== Auto-extract fixes ===')
    fixed_count = 0
    for f_rel in files:
        if fix_partial_markers(f_rel, base):
            fixed_count += 1

    print(f'\nDone: {fixed_count} files modified.')
