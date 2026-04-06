#!/usr/bin/env python3
"""
Fix det.analysis circled number markers to match ch array order and ans.
- Parses segments starting with [✅❌] ①②③④
- Matches segment content to ch[i] via keyword overlap
- Reassigns circled numbers to match ch index (1-indexed)
- Sets ✅ on the ch[ans-1] segment, ❌ on others
"""
import json, re, sys, os
from difflib import SequenceMatcher

CIRCLED = ['①','②','③','④','⑤']
NUM_TO_C = {i+1: CIRCLED[i] for i in range(5)}
C_TO_NUM = {v:k for k,v in NUM_TO_C.items()}

SEG_RE = re.compile(r'([✅❌])\s*([①②③④⑤])\s*')

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def keyword_score(text, ch_item):
    """Score how well text describes ch_item via keyword overlap."""
    # Strip punctuation, lowercase
    import string
    def tok(s):
        s = s.lower()
        for p in string.punctuation + '\u2014\u2013\u2019\u2018\u201c\u201d':
            s = s.replace(p, ' ')
        return set(w for w in s.split() if len(w) >= 3)
    tt = tok(text)
    cc = tok(ch_item)
    if not cc: return 0
    inter = tt & cc
    return len(inter) / len(cc) if cc else 0

def fix_analysis(analysis, ch, ans):
    """Reorder/renumber analysis to match ch order with ans marked ✅."""
    if not analysis or not isinstance(ch, list) or len(ch) < 2:
        return analysis, False
    # Split analysis by segments starting with [✅❌] circled
    # Find all segment starts
    matches = list(SEG_RE.finditer(analysis))
    if len(matches) < 2:
        return analysis, False

    segments = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i+1].start() if i+1 < len(matches) else len(analysis)
        marker = m.group(1)  # ✅ or ❌
        circled = m.group(2)
        content = analysis[m.end():end].strip()
        segments.append({
            'marker': marker,
            'circled': circled,
            'num': C_TO_NUM[circled],
            'content': content,
            'full': analysis[start:end]
        })

    # Check if already correct (numbers == index+1 and ✅ at ans)
    already_ok = True
    for i, seg in enumerate(segments[:len(ch)]):
        expected_num = i+1
        if seg['num'] != expected_num:
            already_ok = False
            break
        expected_marker = '✅' if (i+1 == ans) else '❌'
        if seg['marker'] != expected_marker:
            already_ok = False
            break
    if already_ok:
        return analysis, False

    # Match each segment to a ch index via content similarity
    # First try direct containment, then keyword score
    used = set()
    seg_to_ch = {}
    for si, seg in enumerate(segments):
        best_idx = -1
        best_score = -1
        for ci, ch_item in enumerate(ch):
            if ci in used: continue
            # Direct substring match (either direction)
            if ch_item.strip() and ch_item.strip() in seg['content']:
                best_idx = ci
                best_score = 999
                break
            s = keyword_score(seg['content'], ch_item)
            if s > best_score:
                best_score = s
                best_idx = ci
        if best_idx >= 0 and best_score > 0:
            used.add(best_idx)
            seg_to_ch[si] = best_idx

    # If we couldn't match all, fallback: assume segment order = current circled number order
    if len(seg_to_ch) < min(len(segments), len(ch)):
        # Fallback: use original circled numbers as ch index
        seg_to_ch = {si: seg['num']-1 for si, seg in enumerate(segments) if seg['num']-1 < len(ch)}

    # Reconstruct analysis in ch order
    ch_to_seg = {v:k for k,v in seg_to_ch.items()}
    # For segments not mapped to any ch, keep them at the end unchanged
    mapped_seg_indices = set(seg_to_ch.keys())

    new_parts = []
    for ci in range(len(ch)):
        if ci in ch_to_seg:
            si = ch_to_seg[ci]
            seg = segments[si]
            new_marker = '✅' if (ci+1 == ans) else '❌'
            new_circled = NUM_TO_C[ci+1]
            # Keep content, replace marker+circled
            new_parts.append(f'{new_marker} {new_circled} {seg["content"]}')

    # Preserve any trailing/unmapped segments or text (rare)
    # Check if there's text before first segment (intro)
    prefix = analysis[:matches[0].start()].strip()
    # Append unmapped segments
    for si, seg in enumerate(segments):
        if si not in mapped_seg_indices:
            new_parts.append(seg['full'].strip())

    # Determine separator: if original uses newlines, use newlines; else space
    if '\n' in analysis:
        sep = '\n'
    else:
        sep = ' '

    result = sep.join(new_parts)
    if prefix:
        result = prefix + sep + result

    return result, True


def process_file(path):
    with open(path) as f:
        d = json.load(f)
    changed = 0
    for qi, q in enumerate(d.get('questions', [])):
        fmt = q.get('fmt', 'mc')
        if fmt != 'mc': continue
        ans = q.get('ans')
        ch = q.get('ch')
        det = q.get('det', {})
        if not isinstance(det, dict) or not isinstance(ans, int) or not isinstance(ch, list):
            continue
        analysis = det.get('analysis', '')
        if not analysis: continue
        new_analysis, modified = fix_analysis(analysis, ch, ans)
        if modified:
            q['det']['analysis'] = new_analysis
            changed += 1
    if changed > 0:
        with open(path, 'w') as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
    return changed

if __name__ == '__main__':
    files = sys.argv[1:]
    if not files:
        print('Usage: fix-analysis-markers.py <file.json> [...]')
        sys.exit(1)
    total = 0
    for fp in files:
        n = process_file(fp)
        print(f'{fp}: {n} questions fixed')
        total += n
    print(f'Total: {total} fixed')
