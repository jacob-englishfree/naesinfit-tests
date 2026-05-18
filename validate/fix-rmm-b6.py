#!/usr/bin/env python3
"""
Fix RENDER-MARKER-MISSING errors from /tmp/rmm-b6.json
- 어휘 type: prepend ①②③④ to each <u>word</u> in order
- 순서 type (문장삽입): insert ①②③④ markers between sentence parts
Only modifies 'passage' field. Does not change type/ans/ch/det.
"""

import json
import re
import sys
import copy

MARKERS = ['①', '②', '③', '④']

def fix_eohwi_passage(passage):
    """
    어휘 type: find 4 <u>word</u> tags and prepend ①②③④ to each.
    e.g. <u>empathy</u> -> ①<u>empathy</u>
    """
    count = 0
    result = passage

    # Replace each <u>...</u> (non-empty) with marker+<u>...</u>
    def replacer(m):
        nonlocal count
        if count >= 4:
            return m.group(0)  # shouldn't happen
        marker = MARKERS[count]
        count += 1
        return marker + m.group(0)

    result = re.sub(r'<u>[^<]+</u>', replacer, result)
    return result, count


def fix_soonsu_passage(passage, ans):
    """
    순서 (문장삽입) type: insert ①②③④ markers between sentence parts.

    The passage is split by multi-spaces. Some have <u></u> placeholders.
    Structure: sentences separated by '   ' (2+ spaces), possibly with <u></u>

    Strategy:
    1. Split by 2+ spaces
    2. Remove <u></u> parts (they mark the correct answer position)
    3. Get clean sentence parts
    4. For N clean parts, insert ①②③④ between them (N-1 gaps + possibly trailing)
    5. Rebuild with proper markers
    """
    # Split by 2+ spaces
    raw_parts = re.split(r'  +', passage)

    # Identify clean sentence parts (non-empty, not <u></u>)
    clean_parts = []
    for p in raw_parts:
        stripped = p.strip()
        if stripped and stripped != '<u></u>':
            clean_parts.append(stripped)

    n = len(clean_parts)

    if n == 0:
        return passage  # nothing to do

    # Build new passage with ①②③④ inserted between sentences
    # For n sentences, we need n-1 internal gaps + possibly extend
    # The 4 markers go: after part[0], after part[1], after part[2], after part[3]
    # (if n >= 5, marker ④ goes between part[3] and part[4])
    # (if n == 4, marker ④ goes after part[3] - end)

    # Build: part[0] + ' ① ' + part[1] + ' ② ' + part[2] + ' ③ ' + part[3] + ' ④ ' + part[4]
    # For 4 parts: part[0] + ' ① ' + part[1] + ' ② ' + part[2] + ' ③ ' + part[3] + ' ④ '

    result_parts = []
    for i, part in enumerate(clean_parts):
        result_parts.append(part)
        if i < 4:  # add marker after parts 0,1,2,3
            result_parts.append(' ' + MARKERS[i] + ' ')

    # Join all parts (no extra separator since we've added spaces in markers)
    new_passage = ''.join(result_parts).strip()

    # Clean up: ensure single spaces around markers
    # The result may have extra spaces - normalize
    new_passage = re.sub(r'\s+([①②③④])\s+', r' \1 ', new_passage)

    return new_passage


def process_file(filepath):
    """Process a single JSON file and fix RENDER-MARKER-MISSING issues."""
    full_path = base + filepath

    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modified = False
    fixes = []

    for q in data['questions']:
        ch = q.get('ch', [])
        passage = q.get('passage', '') or ''

        # Check if this question needs fixing
        has_marker_ch = (ch == ['①', '②', '③', '④'])
        passage_has_markers = any(m in passage for m in ['①', '②', '③', '④'])

        if not has_marker_ch or passage_has_markers or not passage:
            continue

        qtype = q.get('type', '')
        ans = q.get('ans', 1)

        if qtype == '어휘':
            new_passage, count = fix_eohwi_passage(passage)
            if count == 4 and new_passage != passage:
                q['passage'] = new_passage
                modified = True
                fixes.append(f'  Q{q["id"]} 어휘: inserted {count} markers')
            else:
                fixes.append(f'  Q{q["id"]} 어휘: SKIPPED (u_count={count})')

        elif qtype == '순서':
            new_passage = fix_soonsu_passage(passage, ans)
            if new_passage != passage:
                q['passage'] = new_passage
                modified = True
                fixes.append(f'  Q{q["id"]} 순서 ans={ans}: rebuilt with markers')
            else:
                fixes.append(f'  Q{q["id"]} 순서: SKIPPED (no change)')

        else:
            fixes.append(f'  Q{q["id"]} {qtype}: UNKNOWN TYPE - skipped')

    if modified:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'FIXED: {filepath}')
    else:
        print(f'SKIP:  {filepath} (no changes)')

    for fix in fixes:
        print(fix)

    return modified


if __name__ == '__main__':
    base = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/'

    with open('/tmp/rmm-b6.json', 'r') as f:
        files = json.load(f)

    print(f'Processing {len(files)} files...\n')

    fixed_count = 0
    for filepath in files:
        if process_file(filepath):
            fixed_count += 1

    print(f'\nDone: {fixed_count}/{len(files)} files modified.')
