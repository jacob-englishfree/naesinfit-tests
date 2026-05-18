#!/usr/bin/env python3
"""
Fix RENDER-MARKER-MISSING errors from /tmp/render_marker_missing.json.

Two types of bugs to fix:
1. Double-marker: ①<u>①</u><u>word</u> → ①<u>word</u>
2. Missing marker: word in passage without marker → add marker<u>word</u>
   (uses overlay.markers first, then det.analysis as fallback)

Only modifies 'passage' field. Does not touch type/ans/ch/det/overlay.
"""

import json
import re
import sys

BASE = '/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests/'
MARKERS = ['①', '②', '③', '④']


# ─────────────────────────────────────────────
# Step 1: Fix double-marker bug
# ①<u>①</u><u>word</u>  →  ①<u>word</u>
# ─────────────────────────────────────────────
def fix_double_markers(passage):
    """Remove the doubled ①<u>①</u> pattern, keeping only ①<u>word</u>."""
    # Pattern: marker<u>marker</u><u>word</u>
    def fix_double(m):
        outer_marker = m.group(1)
        word = m.group(2)
        return f'{outer_marker}<u>{word}</u>'
    new = re.sub(
        r'([①②③④])<u>[①②③④]</u><u>([^<]+)</u>',
        fix_double,
        passage
    )
    return new


# ─────────────────────────────────────────────
# Step 2: Extract marker→word mapping from overlay.markers
# ─────────────────────────────────────────────
def get_overlay_mapping(overlay):
    """
    Returns dict: marker → (word_to_mark_in_passage, display_word)
    - word_to_mark_in_passage: what text to find and wrap in passage
    - display_word: what to show (may differ for wrong-word variants)
    """
    mapping = {}
    markers = (overlay or {}).get('markers', {})
    for m, v in markers.items():
        if m not in MARKERS:
            continue
        if isinstance(v, str):
            mapping[m] = (v, v)  # (find, display) same
        elif isinstance(v, dict):
            find = v.get('find') or v.get('display') or ''
            display = v.get('replace') or v.get('display') or find
            if find:
                mapping[m] = (find, display)
    return mapping


# ─────────────────────────────────────────────
# Step 3: Extract marker info from det.analysis (fallback)
# ─────────────────────────────────────────────
def get_analysis_info(analysis, marker):
    """
    Extract word info for a marker from det.analysis text.
    Handles patterns:
    - "③ wrongWord → correctWord" (arrow: correct form is in passage, replace with wrong)
    - "③ word: ..." or "③ word —" (plain: just find and mark this word)
    - "✅ ③ word: ..."
    """
    lines = analysis.split('\n')
    for line in lines:
        if marker not in line:
            continue
        # Arrow pattern: ③ wrong → correct  (word in passage is correct, needs to show wrong)
        arrow = re.search(
            r'[①②③④]\s+([a-zA-Z][a-zA-Z\s\-\'\.]+?)\s*(?:→|->|→)\s*([a-zA-Z][a-zA-Z\s\-\'\.]+)',
            line
        )
        if arrow:
            wrong = arrow.group(1).strip().rstrip('.,;: ')
            correct = arrow.group(2).strip().rstrip('.,;: ')
            return {'type': 'arrow', 'wrong': wrong, 'correct': correct}
        # Plain pattern: ③ word: ... or ③ word —
        plain = re.search(
            r'[①②③④]\s+([a-zA-Z][a-zA-Z\s\-\'\./]+?)(?:\s*[:\(—\-]|\s*→|\s*$)',
            line
        )
        if plain:
            word = plain.group(1).strip().rstrip('.,;: ')
            if word:
                return {'type': 'plain', 'word': word}
    return None


# ─────────────────────────────────────────────
# Step 4: Insert a single missing marker into passage
# ─────────────────────────────────────────────
def insert_marker(passage, marker, find_word, display_word, qid, fixes):
    """
    Find find_word in passage and replace with marker<u>display_word</u>.
    Returns updated passage.
    """
    if not find_word:
        fixes.append(f'  Q{qid} {marker}: SKIP - no find_word')
        return passage

    # Already tagged?
    if f'{marker}<u>' in passage:
        fixes.append(f'  Q{qid} {marker}: already tagged')
        return passage

    # Try exact match
    if find_word in passage:
        idx = passage.find(find_word)
        # Avoid double-tagging
        if idx > 0 and passage[idx-1] in '①②③④':
            fixes.append(f'  Q{qid} {marker}: already tagged (prefix check)')
            return passage
        new_passage = passage.replace(find_word, f'{marker}<u>{display_word}</u>', 1)
        fixes.append(f'  Q{qid} {marker}: inserted "{find_word}" → {marker}<u>{display_word}</u>')
        return new_passage

    # Try case-insensitive
    pattern = re.compile(re.escape(find_word), re.IGNORECASE)
    m = pattern.search(passage)
    if m:
        before = passage[:m.start()]
        after = passage[m.end():]
        new_passage = before + f'{marker}<u>{display_word}</u>' + after
        fixes.append(f'  Q{qid} {marker}: inserted (case-insensitive) "{find_word}" → {marker}<u>{display_word}</u>')
        return new_passage

    # Try first word only (for multi-word phrases)
    first_word = find_word.split()[0]
    if first_word and first_word != find_word and first_word in passage:
        idx = passage.find(first_word)
        if idx > 0 and passage[idx-1] in '①②③④':
            fixes.append(f'  Q{qid} {marker}: already tagged (first-word prefix check)')
            return passage
        new_passage = passage.replace(first_word, f'{marker}<u>{display_word}</u>', 1)
        fixes.append(f'  Q{qid} {marker}: inserted (first-word) "{first_word}" → {marker}<u>{display_word}</u>')
        return new_passage

    fixes.append(f'  Q{qid} {marker}: SKIP - "{find_word}" not found in passage')
    return passage


# ─────────────────────────────────────────────
# Main: process one file
# ─────────────────────────────────────────────
def process_file(filepath):
    full_path = BASE + filepath
    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    modified = False
    all_fixes = []

    for q in data['questions']:
        ch = q.get('ch') or []
        passage = q.get('passage') or ''
        if not passage:
            continue

        # Only marker-type questions: ch must be exactly ["①","②","③","④"] in order
        has_marker_ch = (ch == ['①', '②', '③', '④'])
        if not has_marker_ch:
            continue

        fixes = []
        new_passage = passage

        # ── Fix 1: double-marker bug ──
        after_double_fix = fix_double_markers(new_passage)
        if after_double_fix != new_passage:
            new_passage = after_double_fix
            fixes.append(f'  Q{q["id"]}: fixed double-marker bug')

        # ── Check remaining missing markers ──
        missing = [m for m in MARKERS if m not in new_passage]
        if not missing:
            if new_passage != passage:
                q['passage'] = new_passage
                modified = True
                all_fixes.extend(fixes)
            continue

        # Build marker→word mapping
        overlay = q.get('overlay') or {}
        overlay_map = get_overlay_mapping(overlay)
        analysis = q.get('det', {}).get('analysis', '') or ''

        for missing_m in missing:
            if missing_m in overlay_map:
                find_word, display_word = overlay_map[missing_m]
                new_passage = insert_marker(new_passage, missing_m, find_word, display_word, q['id'], fixes)
            else:
                # Fallback: det.analysis
                info = get_analysis_info(analysis, missing_m)
                if info is None:
                    fixes.append(f'  Q{q["id"]} {missing_m}: NO_INFO from analysis')
                    continue

                if info['type'] == 'arrow':
                    # correct form is in passage, replace with wrong form
                    new_passage = insert_marker(new_passage, missing_m, info['correct'], info['wrong'], q['id'], fixes)
                    # If that didn't work, try wrong form directly
                    if missing_m not in new_passage:
                        new_passage = insert_marker(new_passage, missing_m, info['wrong'], info['wrong'], q['id'], fixes)
                else:
                    # plain: find and mark this word
                    new_passage = insert_marker(new_passage, missing_m, info['word'], info['word'], q['id'], fixes)

        if new_passage != passage:
            q['passage'] = new_passage
            modified = True

        if fixes:
            all_fixes.extend(fixes)

    if modified:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'FIXED: {filepath}')
    else:
        print(f'SKIP:  {filepath}')

    for fix in all_fixes:
        print(fix)

    return modified


if __name__ == '__main__':
    with open('/tmp/render_marker_missing.json', 'r') as f:
        files = json.load(f)

    print(f'Processing {len(files)} files...\n')
    fixed_count = 0
    skip_count = 0

    for filepath in files:
        if process_file(filepath):
            fixed_count += 1
        else:
            skip_count += 1

    print(f'\nDone: {fixed_count} fixed, {skip_count} skipped.')
