#!/usr/bin/env python3
"""Generate response.json files for 고1/3월_2024 tests (29-35번)."""
import json
import os
import subprocess
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data/모의고사/고1/3월_2024")

# ── passage data ──
PASSAGES = {}
for n in [29, 30, 31, 32, 33, 34, 35]:
    with open(os.path.join(DATA, f"{n}번/단어.prompt.json"), "r") as f:
        d = json.load(f)
    # Clean fullPassage (strip escape sequences for analysis)
    fp = d["fullPassage"]
    PASSAGES[n] = {
        "fp": fp,
        "clean": re.sub(r'\\[①②③④⑤]', '', fp)
    }

# ── Per-passage content knowledge ──
# Key words FROM the fullPassage for each number (for overlay targets)
CONTENT = {
    29: {
        "topic": "meaningful work and happiness",
        "key_words": ["meaningful", "fulfillment", "empowerment", "energizing", "satisfying", "employment", "joy", "pride", "conducted", "fulfilled", "produce", "output", "incomes", "satisfied", "happier", "satisfaction", "workers"],
        "abc_sets": [
            {"A": ["meaningful", "meaningless"], "B": ["energizing", "draining"], "C": ["satisfied", "dissatisfied"]},
            {"A": ["fulfillment", "frustration"], "B": ["produce", "reduce"], "C": ["happier", "sadder"]},
            {"A": ["deeper", "shallower"], "B": ["conducted", "abandoned"], "C": ["greater", "lesser"]}
        ],
        "markers_sets": [
            {"①": "meaningful", "②": {"find": "fulfillment", "display": "frustration"}, "③": "energizing", "④": "produce"},
            {"①": "satisfying", "②": "employment", "③": {"find": "happier", "display": "sadder"}, "④": "satisfaction"},
            {"①": {"find": "pride", "display": "shame"}, "②": "conducted", "③": "fulfilled", "④": "incomes"}
        ],
        "blanks": ["meaningful", "fulfillment", "satisfaction", "conducted", "happier"],
        "synonyms": [
            ("meaningful", ["significant", "trivial", "irrelevant", "superficial"]),
            ("conducted", ["performed", "cancelled", "avoided", "ignored"]),
            ("satisfied", ["content", "disappointed", "indifferent", "troubled"])
        ],
        "antonyms": [
            ("satisfied", ["discontented", "pleased", "content", "fulfilled"]),
            ("deeper", ["shallower", "richer", "greater", "broader"])
        ],
        "polysemy_word": "produce",
        "polysemy_a": "workers who produce higher quality work",
        "polysemy_b": "The farm will produce fresh vegetables this summer.",
        "polysemy_ch": ["(A): 생산하다 — (B): 생산하다", "(A): 만들어내다 — (B): 재배하다", "(A): 재배하다 — (B): 만들어내다", "(A): 만들어내다 — (B): 만들어내다"],
        "polysemy_ans": 2,
        "eiyoung_word": "satisfaction",
        "eiyoung_def": "a pleasant feeling that you get when you receive something you wanted or achieve something you desired",
        "morph_pairs": [("satisfy", "satisfying", "형용사형. 만족스러운"), ("fulfil", "fulfillment", "명사형. 성취감")],
        "context_blanks": ["a sense of fulfillment and empowerment", "their greatest sources of joy and pride"],
        "tf_true": "의미 있는 일을 찾은 사람들은 더 만족스러운 삶을 살았다.",
        "tf_false": "이 연구는 100개국에서 진행되었다.",
        "match_correct": "직업에서 더 큰 성취감을 느끼는 사람들이 더 높은 수입을 올렸다.",
        "match_wrong": "이 연구는 5천 명의 근로자를 대상으로 했다.",
        "topic_answer": "의미 있는 일과 삶의 만족도 사이의 관계",
        "hamchuk_phrase": "their greatest sources of joy and pride",
        "jichung_target": "Those",
        "written_answer": "satisfaction"
    }
}

# This script generates basic templates. Due to the massive scope,
# I'll generate the 단어 type (most formulaic) for all 7 passages.

def make_단어_response(num, passage_data):
    """Generate 단어 response for a passage number."""
    info = CONTENT.get(num)
    if not info:
        return None

    decisions = []
    ans_count = {1: 0, 2: 0, 3: 0, 4: 0}

    def pick_ans(preferred):
        """Pick ans that doesn't exceed 5 per number."""
        for a in [preferred] + [1,2,3,4]:
            if ans_count[a] < 5:
                ans_count[a] += 1
                return a
        return preferred  # fallback

    # Q1-3: (A)(B)(C) 조합형
    for i, (diff, pts) in enumerate([(("쉬움",4)), (("보통",5)), (("어려움",6))]):
        abc = info["abc_sets"][i]
        correct = f'{abc["A"][0]} — {abc["B"][0]} — {abc["C"][0]}'
        wrongs = [
            f'{abc["A"][1]} — {abc["B"][0]} — {abc["C"][0]}',
            f'{abc["A"][0]} — {abc["B"][1]} — {abc["C"][0]}',
            f'{abc["A"][0]} — {abc["B"][0]} — {abc["C"][1]}'
        ]
        # Distribute ans
        target_ans = [4, 1, 4][i]
        ch = list(wrongs)  # start with 3 wrongs
        ch.insert(target_ans - 1, correct)  # insert correct at target position
        ans = pick_ans(target_ans)
        # Adjust if needed
        if ans != target_ans:
            ch.remove(correct)
            ch.insert(ans - 1, correct)

        decisions.append({
            "id": i + 1, "type": "(A)(B)(C) 조합형", "diff": diff, "pts": pts, "fmt": "mc",
            "overlay": {"abc": abc},
            "stem": "다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
            "ch": ch, "ans": ans,
            "det": {"korean": f'(A) {abc["A"][0]}, (B) {abc["B"][0]}, (C) {abc["C"][0]}',
                    "analysis": "원문 조합이 정답", "tip": "원문 단어 조합"}
        })

    # Q4-6: 문맥상 부적절한 어휘
    for i, (diff, pts) in enumerate([(("쉬움",4)), (("쉬움",4)), (("보통",5))]):
        markers = info["markers_sets"][i]
        # Find which marker has find/display
        ans_marker = None
        for k, v in markers.items():
            if isinstance(v, dict):
                ans_marker = k
                break
        ans_num = "①②③④".index(ans_marker) + 1
        ans = pick_ans(ans_num)

        decisions.append({
            "id": i + 4, "type": "문맥상 부적절한 어휘", "diff": diff, "pts": pts, "fmt": "mc",
            "overlay": {"markers": markers},
            "stem": '다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?',
            "ch": ["①", "②", "③", "④"], "ans": ans,
            "det": {"korean": "원문과 반의어 교체", "analysis": f"정답은 ←정답", "tip": "반의어 교체"}
        })

    return {"source": "모의고사", "sourcePath": f"고1/3월_2024/{num}번", "testType": "단어", "decisions": decisions}

# For now, just print what we have
for num in CONTENT:
    result = make_단어_response(num, PASSAGES[num])
    if result:
        print(f"{num}번 단어: {len(result['decisions'])} decisions generated")

print("\nThis script needs more work to be complete.")
print("Manual creation is more reliable for quality.")
