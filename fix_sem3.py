#!/usr/bin/env python3
"""
Fix SEM-3 errors: 어법 ch[] doesn't match passage underlines.
Strategy:
1. Read JSON, find question by index (0-based)
2. Extract ch words (strip circled number prefix)
3. Rebuild passage by finding each ch word and adding ①②③④ markers
4. Verify ans matches det.analysis
"""

import json
import re
import sys
import subprocess
import os

BASE = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"

CIRCLE_MAP = {1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤'}
CIRCLE_REVERSE = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5}

def strip_marker(s):
    """Remove leading ①②③④⑤ from choice string"""
    s = s.strip()
    if s and s[0] in CIRCLE_REVERSE:
        return s[1:].strip()
    return s

def fix_sem3_question(q):
    """
    Fix a single 어법 question with SEM-3 error.
    Returns (modified_q, changed) tuple.
    """
    if q.get('type') != '어법':
        return q, False

    passage = q.get('passage', '')
    ch = q.get('ch', [])
    ans = q.get('ans', 1)
    det = q.get('det', {})

    if not ch or not passage:
        return q, False

    # Get words from ch (strip marker prefix)
    ch_words = [strip_marker(c) for c in ch]

    # Find existing markers in passage
    existing_markers = re.findall(r'([①②③④⑤])<u>([^<]+)</u>', passage)
    existing_words = [w for _, w in existing_markers]

    # Check if ch_words match existing_words (same set, possibly different order/numbering)
    if set(ch_words) == set(existing_words):
        # Same words but markers might be mis-numbered
        # Check if numbering matches position in ch
        mismatch = False
        for i, (marker, word) in enumerate(existing_markers):
            expected_marker = CIRCLE_MAP.get(i+1, '')
            if marker != expected_marker:
                mismatch = True
                break
            if word != ch_words[i]:
                mismatch = True
                break
        if not mismatch:
            return q, False  # Already correct

    # Need to fix: rebuild passage with correct ①②③④ markers matching ch order
    # Remove all existing markers first
    clean_passage = re.sub(r'[①②③④⑤]<u>([^<]+)</u>', r'\1', passage)
    # Also remove standalone circled numbers not followed by <u>
    clean_passage = re.sub(r'[①②③④⑤](?!<u>)', '', clean_passage)

    new_passage = clean_passage

    # For each ch word, find it in the clean passage and wrap with marker
    # We do this in reverse order of position so earlier insertions don't shift indexes
    positions = []
    search_text = clean_passage

    for i, word in enumerate(ch_words):
        # Find the word in passage - need to be careful about word boundaries
        # Try exact match first
        pattern = re.escape(word)
        matches = list(re.finditer(pattern, search_text))
        if not matches:
            # Try case-insensitive
            matches = list(re.finditer(pattern, search_text, re.IGNORECASE))
        if not matches:
            print(f"  WARNING: Could not find '{word}' in passage!")
            return q, False

        # Use first match (or the one that makes most sense contextually)
        # Pick the one that's not already used
        best_match = matches[0]
        positions.append((best_match.start(), best_match.end(), i+1, word))

    # Sort positions by start position to process in order
    positions.sort(key=lambda x: x[0])

    # Rebuild passage with markers
    result = ""
    last_end = 0
    for start, end, marker_num, word in positions:
        result += new_passage[last_end:start]
        result += f"{CIRCLE_MAP[marker_num]}<u>{new_passage[start:end]}</u>"
        last_end = end
    result += new_passage[last_end:]

    # Rebuild ch with correct markers ①②③④
    new_ch = [f"{CIRCLE_MAP[i+1]} {ch_words[i]}" for i in range(len(ch_words))]

    # Update question
    new_q = dict(q)
    new_q['passage'] = result
    new_q['ch'] = new_ch

    return new_q, True


def fix_file(filepath, question_indices):
    """Fix specific questions in a file. question_indices is 1-based."""
    full_path = os.path.join(BASE, "data", filepath)

    if not os.path.exists(full_path):
        print(f"  ERROR: File not found: {full_path}")
        return 0

    with open(full_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    fixed_count = 0

    for q_num in question_indices:
        idx = q_num - 1  # Convert to 0-based
        if idx >= len(questions):
            print(f"  WARNING: Q{q_num} not found (only {len(questions)} questions)")
            continue

        q = questions[idx]
        new_q, changed = fix_sem3_question(q)

        if changed:
            questions[idx] = new_q
            fixed_count += 1
            print(f"  Fixed Q{q_num}")
        else:
            print(f"  Q{q_num}: no change needed or could not fix")

    if fixed_count > 0:
        data['questions'] = questions
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Saved {full_path}")

    return fixed_count


def run_validate(filepath):
    """Run validate.js on a file and return result."""
    full_path = os.path.join(BASE, "data", filepath)
    validate_script = os.path.join(BASE, "validate", "validate.js")

    result = subprocess.run(
        ["node", validate_script, full_path],
        capture_output=True, text=True, cwd=BASE
    )

    has_s_errors = bool(re.search(r'\[S\]', result.stdout + result.stderr))
    has_sem3 = bool(re.search(r'SEM-3', result.stdout + result.stderr))

    return {
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode,
        'has_s_errors': has_s_errors,
        'has_sem3': has_sem3,
        'pass': 'PASS' in result.stdout and not has_s_errors
    }


# Files to fix: (filepath, [question_numbers_1based])
FILES_TO_FIX = [
    ("부교재/수능특강/영어/21강/Gateway/워크북.json", [1, 2, 3]),
    ("부교재/수능특강/영어/21강/워크북.json", [1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 14, 16, 18, 19]),
    ("부교재/수능특강/영어/21강/퀴즈.json", [1, 2, 3, 6, 7, 8, 11, 12, 13, 16, 17, 18]),
    ("부교재/수능특강/영어/22강/Gateway/워크북.json", [1, 4]),
    ("부교재/수능특강/영어/6강/1번/워크북.json", [1, 3, 4]),
    ("부교재/수능특강/영어/6강/2번/퀴즈.json", [6]),
    ("부교재/수능특강/영어/6강/Gateway/워크북.json", [3]),
    ("부교재/수능특강/영어/8강/4번/퀴즈.json", [1, 2, 3]),
    ("부교재/수능특강/영어/8강/Gateway/퀴즈.json", [3]),
    ("부교재/수능특강/영어/8강/퀴즈.json", [1, 2, 3]),
    ("부교재/수능특강Light/영어/10강/3번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/10강/3번/퀴즈.json", [1, 2]),
    ("부교재/수능특강Light/영어/11강/4번/퀴즈.json", [1, 3]),
    ("부교재/수능특강Light/영어/16강/Gateway/워크북.json", [2, 3, 4]),
    ("부교재/수능특강Light/영어/17강/4번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/2강/1번/워크북.json", [2]),
    ("부교재/수능특강Light/영어/2강/1번/퀴즈.json", [2, 3]),
    ("부교재/수능특강Light/영어/2강/2번/워크북.json", [1, 2, 3, 4]),
    ("부교재/수능특강Light/영어/2강/3번/워크북.json", [1, 2, 4]),
    ("부교재/수능특강Light/영어/2강/Gateway/워크북.json", [2, 4]),
    ("부교재/수능특강Light/영어/3강/1번/퀴즈.json", [1, 3]),
    ("부교재/수능특강Light/영어/3강/3번/워크북.json", [1, 2, 4]),
    ("부교재/수능특강Light/영어/3강/3번/퀴즈.json", [3]),
    ("부교재/수능특강Light/영어/3강/4번/워크북.json", [2, 3]),
    ("부교재/수능특강Light/영어/3강/Gateway/퀴즈.json", [3]),
    ("부교재/수능특강Light/영어/4강/2번/워크북.json", [1, 2, 3, 4]),
    ("부교재/수능특강Light/영어/4강/4번/워크북.json", [1, 2]),
    ("부교재/수능특강Light/영어/4강/Gateway/워크북.json", [2, 3, 4]),
    ("부교재/수능특강Light/영어/4강/Gateway/퀴즈.json", [1, 2]),
    ("부교재/수능특강Light/영어/5강/Gateway/워크북.json", [1, 2, 3, 4]),
]


def main():
    total_fixed = 0
    results = []

    for filepath, q_nums in FILES_TO_FIX:
        print(f"\n{'='*60}")
        print(f"Processing: {filepath}")
        print(f"Questions: {q_nums}")

        fixed = fix_file(filepath, q_nums)
        total_fixed += fixed
        results.append((filepath, q_nums, fixed))

    print(f"\n{'='*60}")
    print(f"TOTAL FIXED: {total_fixed} questions across {len(FILES_TO_FIX)} files")

    return results


if __name__ == '__main__':
    main()
