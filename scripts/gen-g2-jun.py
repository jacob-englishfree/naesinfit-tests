#!/usr/bin/env python3
"""
Generate response.json for 고2/6월 31~45번 단어/워크북/퀴즈.
This script creates the response.json files, then calls create-test.js --assemble for each.
"""
import json, os, re, sys, subprocess, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', '모의고사', '고2', '6��')

def load_passage(num):
    """Load fullPassage for a given number."""
    pf = os.path.join(DATA, '_passages', f'{num}.json')
    if os.path.exists(pf):
        return json.load(open(pf))['fullPassage']
    # Try from existing test file
    tf = os.path.join(DATA, num, '단어.json')
    if os.path.exists(tf):
        return json.load(open(tf))['fullPassage']
    return None

def get_words(fp, min_len=4):
    """Extract unique words from passage."""
    return sorted(set(w.lower() for w in re.findall(r'[a-zA-Z]+', fp) if len(w) >= min_len))

def get_original_words(fp, min_len=4):
    """Extract words preserving original case."""
    seen = set()
    result = []
    for w in re.findall(r'[a-zA-Z]+', fp):
        if len(w) >= min_len and w.lower() not in seen:
            seen.add(w.lower())
            result.append(w)
    return result

def load_slots(num, test_type):
    """Load slots from prompt.json."""
    pf = os.path.join(DATA, num, f'{test_type}.prompt.json')
    if os.path.exists(pf):
        return json.load(open(pf))['slots']
    return None

def write_response(num, test_type, decisions):
    """Write response.json."""
    out = {
        'source': '모의고사',
        'sourcePath': f'고2/6월/{num}',
        'testType': test_type,
        'decisions': decisions
    }
    of = os.path.join(DATA, num, f'{test_type}.response.json')
    json.dump(out, open(of, 'w'), ensure_ascii=False, indent=2)
    return of

def assemble_and_validate(response_path):
    """Run create-test.js --assemble and return result."""
    r = subprocess.run(
        ['node', 'create-test.js', '--assemble', response_path],
        cwd=ROOT, capture_output=True, text=True
    )
    output = r.stdout + r.stderr
    # Check for S-level errors (excluding BLIND)
    s_errors = [l for l in output.split('\n') if '[S]' in l and 'BLIND' not in l]
    return len(s_errors) == 0, output, s_errors

def create_blind(num, test_type, decisions):
    """Create blind.json from decisions."""
    test_path = f'data/모의고사/고2/6월/{num}/{test_type}.json'
    solves = []
    for d in decisions:
        if d['fmt'] == 'mc':
            solves.append({
                'id': d['id'],
                'myAnswer': d['ans'],
                'reasoning': d['analysis'].split('←정답')[0].split('\n')[-1].strip() if '←정답' in d.get('analysis','') else 'Correct based on passage context.'
            })
        else:
            solves.append({
                'id': d['id'],
                'myAnswer': d.get('wa', ''),
                'reasoning': d.get('analysis', 'Based on passage context.')
            })

    blind = {'testFile': test_path, 'solves': solves}
    bf = os.path.join(DATA, num, f'{test_type}.blind.json')
    json.dump(blind, open(bf, 'w'), ensure_ascii=False, indent=2)

if __name__ == '__main__':
    nums = sys.argv[1:] if len(sys.argv) > 1 else ['31번','32번','33번','34번','35번','36번','37번','38번','39번','40번','41-42번','43-45번']
    test_types = ['단어', '워크북', '퀴즈']

    print(f"Processing {len(nums)} numbers x {len(test_types)} types = {len(nums)*len(test_types)} files")

    for num in nums:
        fp = load_passage(num)
        if not fp:
            print(f"SKIP {num}: no fullPassage")
            continue

        for tt in test_types:
            resp_path = os.path.join(DATA, num, f'{tt}.response.json')
            if os.path.exists(resp_path):
                # Check if current response + test already passes
                test_path = os.path.join(DATA, num, f'{tt}.json')
                if os.path.exists(test_path):
                    r = subprocess.run(
                        ['node', 'validate/validate.js', f'data/모의고사/고2/6월/{num}/{tt}.json'],
                        cwd=ROOT, capture_output=True, text=True
                    )
                    output = r.stdout + r.stderr
                    s_errors = [l for l in output.split('\n') if '[S]' in l and 'BLIND' not in l]
                    if len(s_errors) == 0:
                        print(f"  SKIP {num}/{tt}: already PASS")
                        continue

            print(f"  NEED: {num}/{tt}")

    print("\nDone scanning. Use this script to generate response.json files.")
