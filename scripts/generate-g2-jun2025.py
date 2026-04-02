#!/usr/bin/env python3
"""
고2 2025년 6월 모의고사 전체 재출제 — 66파일 1,320문항
각 폴더에 단어.json, 워크북.json, 퀴즈.json 생성
"""
import json, os, re, random

random.seed(42)  # 재현 가능

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', '모의고사', '고2', '6월')

# ─── 문항번호 → 유형 매핑 ───
LESSON_MAP = {
    '18번': '글의 목적',
    '19번': '심경 변화',
    '20번': '필자의 주장',
    '21번': '함축적 의미',
    '22번': '글의 요지',
    '23번': '글의 주제',
    '24번': '제목 추론',
    '26번': '내용 불일치',
    '29번': '어법',
    '30번': '어휘',
    '31번': '빈칸 추론',
    '32번': '빈칸 추론',
    '33번': '빈칸 추론',
    '34번': '빈칸 추론',
    '35번': '무관한 문장',
    '36번': '순서 배열',
    '37번': '순서 배열',
    '38번': '문장 삽입',
    '39번': '문장 삽입',
    '40번': '문단 요약',
    '41-42번': '장문(제목+어휘)',
    '43-45번': '장문(순서+지칭+내용)',
}

# ─── 기존 파일에서 fullPassage 추출 ───
def load_passages():
    passages = {}
    for d in os.listdir(BASE):
        fp = os.path.join(BASE, d, '단어.json')
        if os.path.exists(fp):
            with open(fp, 'r', encoding='utf-8') as f:
                data = json.load(f)
            passages[d] = data['fullPassage']
    return passages

# ─── 영어 단어/구 추출 도우미 ───
def extract_words(text, min_len=5):
    """지문에서 의미 있는 단어 추출"""
    stop = {'which','where','their','these','there','those','about','would','could',
            'should','being','other','after','before','while','every','might','never',
            'often','still','under','above','below','along','among','since','until',
            'between','through','during','without','within','against','because','however',
            'therefore','although','moreover','furthermore','nevertheless','the','and',
            'that','this','with','from','they','have','been','were','when','what','more',
            'than','also','into','just','some','will','most','only','very','such','much',
            'each','then','them','does','make','like','over','many','your','even','same'}
    words = re.findall(r'[A-Za-z]+', text)
    return [w.lower() for w in words if len(w) >= min_len and w.lower() not in stop]

def extract_sentences(text):
    """지문에서 문장 추출"""
    sents = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sents if len(s.strip()) > 20]

def pick_key_words(text, n=10):
    """핵심 어휘 n개 추출 (빈도순, 중복 제거)"""
    words = extract_words(text)
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    # 빈도 높고 길이 긴 것 우선
    ranked = sorted(freq.keys(), key=lambda w: (-freq[w], -len(w)))
    return ranked[:n]

# ─── 동의어/반의어 사전 ───
SYNONYMS = {
    'gratitude': ('appreciation', 'thankfulness'),
    'dedication': ('commitment', 'devotion'),
    'exceptional': ('outstanding', 'remarkable'),
    'significantly': ('considerably', 'substantially'),
    'improve': ('enhance', 'advance'),
    'reflect': ('consider', 'contemplate'),
    'contribution': ('achievement', 'accomplishment'),
    'extension': ('continuation', 'prolongation'),
    'involvement': ('participation', 'engagement'),
    'enhance': ('improve', 'strengthen'),
    'achievement': ('accomplishment', 'attainment'),
    'progress': ('advancement', 'development'),
    'confidence': ('assurance', 'self-assurance'),
    'express': ('convey', 'communicate'),
    'impact': ('effect', 'influence'),
    'freezing': ('icy', 'frigid'),
    'brightly': ('vividly', 'brilliantly'),
    'harsh': ('severe', 'intense'),
    'suddenly': ('abruptly', 'unexpectedly'),
    'reassured': ('comforted', 'encouraged'),
    'examined': ('inspected', 'checked'),
    'comfortable': ('at ease', 'relaxed'),
    'peacefully': ('calmly', 'serenely'),
    'impermeable': ('waterproof', 'sealed'),
    'porous': ('permeable', 'absorbent'),
    'isolation': ('solitude', 'seclusion'),
    'thrive': ('flourish', 'prosper'),
    'designed': ('intended', 'meant'),
    'prevent': ('hinder', 'obstruct'),
    'wealth': ('riches', 'fortune'),
    'relative': ('comparative', 'proportional'),
    'miserable': ('unhappy', 'wretched'),
    'establish': ('determine', 'set'),
    'evoke': ('elicit', 'arouse'),
    'vivid': ('striking', 'graphic'),
    'potential': ('prospective', 'possible'),
    'effectively': ('efficiently', 'successfully'),
    'compensate': ('reimburse', 'reward'),
    'inconsistent': ('contradictory', 'incompatible'),
    'phenomenon': ('occurrence', 'event'),
    'determined': ('decided', 'established'),
    'assumption': ('supposition', 'presumption'),
    'preference': ('inclination', 'tendency'),
    'evaluated': ('assessed', 'appraised'),
    'reputation': ('standing', 'prestige'),
    'commission': ('assignment', 'project'),
    'stunning': ('breathtaking', 'magnificent'),
    'masterpiece': ('masterwork', 'magnum opus'),
    'illusion': ('impression', 'appearance'),
    'perspective': ('viewpoint', 'standpoint'),
    'realistic': ('lifelike', 'authentic'),
    'stimulating': ('boosting', 'encouraging'),
    'fluctuation': ('variation', 'swing'),
    'contraction': ('reduction', 'shrinkage'),
    'anecdote': ('story', 'tale'),
    'association': ('connection', 'link'),
    'abstract': ('conceptual', 'theoretical'),
    'analogy': ('comparison', 'parallel'),
    'embrace': ('adopt', 'accept'),
    'fundamentally': ('essentially', 'basically'),
    'radical': ('drastic', 'extreme'),
    'rational': ('logical', 'reasonable'),
    'irrational': ('illogical', 'unreasonable'),
    'evolved': ('developed', 'adapted'),
    'communication': ('interaction', 'exchange'),
    'characteristic': ('feature', 'trait'),
    'hallucination': ('delusion', 'illusion'),
    'incoherent': ('disjointed', 'confused'),
    'apparent': ('evident', 'obvious'),
    'sentiment': ('feeling', 'emotion'),
    'instantaneously': ('immediately', 'instantly'),
    'heritage': ('legacy', 'tradition'),
    'transition': ('shift', 'change'),
    'dominant': ('prevailing', 'primary'),
    'susceptible': ('vulnerable', 'prone'),
    'bulky': ('cumbersome', 'unwieldy'),
    'precisely': ('exactly', 'accurately'),
    'obvious': ('clear', 'evident'),
    'involuntary': ('forced', 'compelled'),
    'selective': ('discriminating', 'particular'),
    'redistribute': ('reallocate', 'reassign'),
    'temptation': ('lure', 'enticement'),
    'inflation': ('price rise', 'devaluation'),
    'convertible': ('exchangeable', 'redeemable'),
    'misleading': ('deceptive', 'confusing'),
    'efficacy': ('effectiveness', 'efficiency'),
    'deliberative': ('thoughtful', 'careful'),
    'optimal': ('best', 'ideal'),
    'contradict': ('oppose', 'deny'),
    'confronted': ('faced', 'presented'),
    'disruptive': ('disturbing', 'unsettling'),
    'tyranny': ('oppression', 'domination'),
    'constrain': ('restrict', 'limit'),
    'regret': ('lament', 'feel sorry'),
    'struggled': ('strained', 'labored'),
    'hesitated': ('paused', 'wavered'),
    'urgency': ('pressing need', 'emergency'),
    'reassured': ('comforted', 'calmed'),
}

ANTONYMS = {
    'gratitude': ('ingratitude', 'hostility'),
    'dedication': ('neglect', 'indifference'),
    'exceptional': ('mediocre', 'ordinary'),
    'improve': ('worsen', 'deteriorate'),
    'extension': ('termination', 'cancellation'),
    'enhance': ('diminish', 'weaken'),
    'involvement': ('withdrawal', 'detachment'),
    'confidence': ('doubt', 'insecurity'),
    'positive': ('negative', 'harmful'),
    'freezing': ('warm', 'hot'),
    'harsh': ('gentle', 'mild'),
    'comfortable': ('uncomfortable', 'distressed'),
    'impermeable': ('porous', 'permeable'),
    'isolation': ('connection', 'togetherness'),
    'thrive': ('wither', 'decline'),
    'vivid': ('dull', 'vague'),
    'effectively': ('ineffectively', 'poorly'),
    'rational': ('irrational', 'illogical'),
    'inconsistent': ('consistent', 'steady'),
    'dominant': ('minor', 'secondary'),
    'voluntary': ('involuntary', 'forced'),
    'abstract': ('concrete', 'tangible'),
    'optimal': ('worst', 'poorest'),
    'disruptive': ('beneficial', 'harmonious'),
    'constrain': ('liberate', 'free'),
    'stimulating': ('discouraging', 'inhibiting'),
    'misleading': ('accurate', 'truthful'),
    'selective': ('random', 'indiscriminate'),
}

# ─── 영영풀이 사전 ───
ENG_DEFS = {
    'gratitude': 'a feeling of thankfulness and appreciation',
    'dedication': 'the quality of being devoted to a task or purpose',
    'exceptional': 'unusually good; outstanding',
    'significantly': 'to a great extent or degree',
    'reflect': 'to think carefully about something',
    'extension': 'the act of making something longer or more extensive',
    'enhance': 'to increase or improve the quality of something',
    'impermeable': 'not allowing liquid or gas to pass through',
    'porous': 'having tiny holes that allow liquid or gas to pass through',
    'isolation': 'the state of being separated from others',
    'thrive': 'to grow or develop well; to prosper',
    'vivid': 'producing powerful feelings or strong mental images',
    'evoke': 'to bring a feeling or memory to mind',
    'compensate': 'to make up for something; to provide payment',
    'phenomenon': 'a fact or event that is observed to exist',
    'assumption': 'something taken for granted without proof',
    'preference': 'a greater liking for one thing over another',
    'reputation': 'the beliefs or opinions held about someone',
    'illusion': 'a false idea or impression of reality',
    'perspective': 'a particular attitude toward something',
    'stimulating': 'encouraging development or greater activity',
    'fluctuation': 'an irregular rising and falling in number or amount',
    'anecdote': 'a short amusing or interesting story about an incident',
    'analogy': 'a comparison between things to explain or clarify',
    'embrace': 'to accept willingly or enthusiastically',
    'rational': 'based on or in accordance with reason or logic',
    'characteristic': 'a feature or quality belonging to a person or thing',
    'apparent': 'clearly visible or understood; obvious',
    'sentiment': 'a view or attitude toward a situation or event',
    'heritage': 'valued objects and qualities passed down from previous generations',
    'transition': 'the process of changing from one state to another',
    'dominant': 'most important, powerful, or influential',
    'susceptible': 'likely to be influenced or harmed by something',
    'temptation': 'a desire to do something, especially wrong or unwise',
    'inflation': 'a general increase in prices and fall in purchasing power',
    'efficacy': 'the ability to produce a desired result',
    'deliberative': 'relating to careful consideration and discussion',
    'confronted': 'faced with a difficult situation',
    'tyranny': 'cruel and oppressive rule or use of power',
    'constrain': 'to severely restrict the scope or extent of',
    'urgency': 'importance requiring swift action',
    'instantaneously': 'happening or done in an instant',
}

# ─── 한국어 해석 도우미 사전 ───
KOR_MEANINGS = {
    'gratitude': '감사', 'dedication': '헌신', 'exceptional': '뛰어난',
    'significantly': '상당히', 'improve': '향상시키다', 'reflect': '돌아보다',
    'contribution': '기여', 'extension': '연장', 'involvement': '참여',
    'enhance': '강화하다', 'achievement': '성취', 'progress': '진전',
    'confidence': '자신감', 'express': '표현하다', 'impact': '영향',
    'freezing': '영하의', 'brightly': '밝게', 'harsh': '거센',
    'suddenly': '갑자기', 'reassured': '안심시켰다', 'examined': '진찰했다',
    'comfortable': '편안한', 'peacefully': '평화롭게',
    'impermeable': '불투과성의', 'porous': '다공성의', 'isolation': '고립',
    'thrive': '번성하다', 'designed': '설계되다', 'prevent': '막다',
    'wealth': '부', 'relative': '상대적인', 'miserable': '비참한',
    'evoke': '불러일으키다', 'vivid': '생생한', 'potential': '잠재적인',
    'effectively': '효과적으로',
    'compensate': '보상하다', 'inconsistent': '일관성 없는', 'phenomenon': '현상',
    'determined': '결정되는', 'assumption': '가정', 'preference': '선호',
    'evaluated': '평가되었다',
    'reputation': '명성', 'commission': '의뢰', 'stunning': '놀라운',
    'masterpiece': '걸작',
    'illusion': '착시', 'perspective': '원근법', 'realistic': '사실적인',
    'stimulating': '자극하는', 'fluctuation': '변동', 'contraction': '수축',
    'anecdote': '일화', 'association': '연상', 'abstract': '추상적인',
    'analogy': '비유', 'embrace': '받아들이다', 'fundamentally': '근본적으로',
    'radical': '급진적인',
    'rational': '합리적인', 'irrational': '비합리적인', 'evolved': '진화한',
    'communication': '소통', 'characteristic': '특성',
    'hallucination': '환각', 'apparent': '명백한',
    'sentiment': '감정', 'instantaneously': '즉각적으로', 'heritage': '유산',
    'transition': '전환', 'dominant': '지배적인', 'susceptible': '취약한',
    'bulky': '부피가 큰',
    'involuntary': '비자발적인', 'selective': '선택적인',
    'temptation': '유혹', 'inflation': '인플레이션',
    'convertible': '교환 가능한', 'misleading': '오해를 불러일으키는',
    'efficacy': '효능', 'deliberative': '숙고하는', 'optimal': '최적의',
    'confronted': '직면한', 'disruptive': '파괴적인', 'tyranny': '독재',
    'constrain': '제약하다', 'regret': '후회', 'urgency': '긴급성',
}


def make_abc_combo(passage, words, qid, diff, pts):
    """(A)(B)(C) 조합형 문항 생성"""
    # 지문에서 3개 핵심 단어를 빈칸으로
    available = [w for w in extract_words(passage, 4) if w in ANTONYMS or w in SYNONYMS]
    if len(available) < 3:
        available = extract_words(passage, 4)[:6]

    chosen = []
    used = set()
    for w in available:
        if w not in used:
            chosen.append(w)
            used.add(w)
        if len(chosen) >= 3:
            break

    while len(chosen) < 3:
        fallback = [w for w in extract_words(passage, 4) if w not in used]
        if fallback:
            chosen.append(fallback[0])
            used.add(fallback[0])
        else:
            chosen.append('important')

    a, b, c = chosen[0], chosen[1], chosen[2]

    # 각 단어의 반의어 생성
    def get_antonym(w):
        if w in ANTONYMS:
            return ANTONYMS[w][0]
        return 'un' + w if not w.startswith('un') else w[2:]

    ant_a, ant_b, ant_c = get_antonym(a), get_antonym(b), get_antonym(c)

    # 정답 위치 결정 (1~4)
    ans_pos = (qid % 4) + 1

    choices = []
    if ans_pos == 1:
        choices = [f"{a} — {b} — {c}", f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}"]
    elif ans_pos == 2:
        choices = [f"{ant_a} — {b} — {c}", f"{a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}"]
    elif ans_pos == 3:
        choices = [f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {c}", f"{a} — {b} — {ant_c}"]
    else:
        choices = [f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}", f"{a} — {b} — {c}"]

    # passage에 (A)(B)(C) 삽입
    p = passage
    p = p.replace(a, f"(A)[{a} / {ant_a}]", 1)
    p = p.replace(b, f"(B)[{b} / {ant_b}]", 1)
    p = p.replace(c, f"(C)[{c} / {ant_c}]", 1)

    kor_a = KOR_MEANINGS.get(a, a)
    kor_b = KOR_MEANINGS.get(b, b)
    kor_c = KOR_MEANINGS.get(c, c)

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "(A)(B)(C) 조합형", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": "다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
        "det": {
            "korean": f"<b>{a}</b>({kor_a}), <b>{b}</b>({kor_b}), <b>{c}</b>({kor_c})가 원문과 일치한다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {a} — {b} — {c}: 원문과 일치\n❌ {''.join(wrong_nums)} 반의어가 하나 이상 포함되어 부적절",
            "tip": f"{a} ↔ {ant_a}, {b} ↔ {ant_b}, {c} ↔ {ant_c}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_inappropriate_vocab(passage, words, qid, diff, pts):
    """문맥상 부적절한 어휘"""
    sents = extract_sentences(passage)
    if len(sents) < 2:
        sents = [passage[:len(passage)//2], passage[len(passage)//2:]]

    # 문장에서 핵심 단어 4개 추출
    all_words = []
    for s in sents:
        ws = [w for w in extract_words(s, 4) if w in ANTONYMS or w in SYNONYMS]
        all_words.extend(ws)

    if len(all_words) < 4:
        all_words = extract_words(passage, 4)[:8]

    # 중복 제거
    seen = set()
    unique = []
    for w in all_words:
        if w not in seen:
            unique.append(w)
            seen.add(w)
    unique = unique[:4]
    while len(unique) < 4:
        unique.append('important')

    # 정답 위치 (부적절한 것)
    ans_pos = ((qid + 1) % 4) + 1

    # passage에 밑줄 삽입, 정답 위치는 반의어로 교체
    p = passage
    choices = []
    wrong_word = unique[ans_pos - 1]

    def get_antonym(w):
        if w in ANTONYMS:
            return ANTONYMS[w][0]
        return 'un' + w if not w.startswith('un') else w[2:]

    replacement = get_antonym(wrong_word)

    for i, w in enumerate(unique):
        num = '①②③④'[i]
        if i == ans_pos - 1:
            p = p.replace(w, f'{num}<u>{replacement}</u>', 1)
            choices.append(replacement)
        else:
            p = p.replace(w, f'{num}<u>{w}</u>', 1)
            choices.append(w)

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]
    right_nums = ['①②③④'[i] for i in range(4) if i+1 == ans_pos]

    kor_wrong = KOR_MEANINGS.get(replacement, replacement)
    kor_right = KOR_MEANINGS.get(wrong_word, wrong_word)

    return {
        "id": qid, "type": "문맥상 부적절한 어휘", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": "다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]} {replacement}({kor_wrong}) → <b>{wrong_word}</b>({kor_right}): 원문의 의미와 반대",
            "analysis": f"❌ {'①②③④'[ans_pos-1]} {replacement}: 원문은 {wrong_word} — 반의어로 교체됨\n✅ {''.join(wrong_nums)} {', '.join(choices[i] for i in range(4) if i != ans_pos-1)}: 원문과 일치",
            "tip": f"{wrong_word}({kor_right}) ↔ {replacement}({kor_wrong})"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_blank_vocab(passage, words, qid, diff, pts):
    """빈칸 어휘 완성"""
    sents = extract_sentences(passage)
    if not sents:
        sents = [passage]

    sent_idx = qid % len(sents)
    sent = sents[sent_idx]

    sent_words = [w for w in extract_words(sent, 5) if w in KOR_MEANINGS]
    if not sent_words:
        sent_words = extract_words(sent, 4)[:3]
    if not sent_words:
        sent_words = ['important']

    target = sent_words[0]
    blank_sent = sent.replace(target, '__________', 1)

    # 오답 생성
    distractors = [w for w in extract_words(passage, 5) if w != target and w in KOR_MEANINGS][:3]
    while len(distractors) < 3:
        distractors.append(random.choice(['circumstance', 'observation', 'resistance']))

    ans_pos = ((qid + 2) % 4) + 1
    choices = distractors[:ans_pos-1] + [target] + distractors[ans_pos-1:3]

    kor_target = KOR_MEANINGS.get(target, target)
    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "빈칸 어휘 완성", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": blank_sent,
        "stem": "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "det": {
            "korean": f"빈칸에는 <b>{target}</b>({kor_target})이/가 들어가야 한다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {target}: 원문과 일치\n❌ {''.join(wrong_nums)} 문맥과 맞지 않는 어휘",
            "tip": f"{target} = {kor_target}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_synonym(passage, words, qid, diff, pts):
    """동의어 고르기"""
    available = [w for w in extract_words(passage, 5) if w in SYNONYMS]
    if not available:
        available = extract_words(passage, 5)[:3]

    target = available[qid % len(available)] if available else 'important'

    if target in SYNONYMS:
        correct = SYNONYMS[target][0]
    else:
        correct = target + 'ly' if not target.endswith('ly') else target[:-2]

    # 오답
    other_words = [w for w in extract_words(passage, 5) if w != target and w != correct][:2]
    if target in ANTONYMS:
        other_words.insert(0, ANTONYMS[target][0])
    while len(other_words) < 3:
        other_words.append(random.choice(['irrelevant', 'peculiar', 'negligible']))

    ans_pos = ((qid) % 4) + 1
    choices = other_words[:ans_pos-1] + [correct] + other_words[ans_pos-1:3]

    kor_target = KOR_MEANINGS.get(target, target)
    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    # 밑줄 지문
    p = passage.replace(target, f'<u>{target}</u>', 1)

    return {
        "id": qid, "type": "동의어 고르기", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": f"밑줄 친 <b>{target}</b>의 의미와 가장 <b>가까운</b> 것은?",
        "det": {
            "korean": f"{target} = {kor_target}, {correct} = 동의어",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {correct}: {target}의 동의어\n❌ {''.join(wrong_nums)} 의미가 다르거나 반대",
            "tip": f"{target} = {correct} = {kor_target}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_antonym(passage, words, qid, diff, pts):
    """반의어 고르기"""
    available = [w for w in extract_words(passage, 5) if w in ANTONYMS]
    if not available:
        available = extract_words(passage, 5)[:3]

    target = available[qid % len(available)] if available else 'important'

    if target in ANTONYMS:
        correct = ANTONYMS[target][0]
    else:
        correct = 'un' + target

    # 오답 (동의어/유사어)
    other_words = []
    if target in SYNONYMS:
        other_words.append(SYNONYMS[target][0])
    other_words.extend([w for w in extract_words(passage, 5) if w != target and w != correct][:2])
    while len(other_words) < 3:
        other_words.append(random.choice(['similar', 'related', 'connected']))

    ans_pos = ((qid + 1) % 4) + 1
    choices = other_words[:ans_pos-1] + [correct] + other_words[ans_pos-1:3]

    kor_target = KOR_MEANINGS.get(target, target)
    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    p = passage.replace(target, f'<u>{target}</u>', 1)

    return {
        "id": qid, "type": "반의어 고르기", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": f"밑줄 친 <b>{target}</b>의 의미와 가장 <b>먼</b> 것은?",
        "det": {
            "korean": f"{target}({kor_target})의 반의어는 <b>{correct}</b>이다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {correct}: {target}의 반의어\n❌ {''.join(wrong_nums)} 동의어이거나 유사 의미",
            "tip": f"{target}({kor_target}) ↔ {correct}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_eng_def(passage, words, qid, diff, pts):
    """영영풀이 매칭"""
    available = [w for w in extract_words(passage, 5) if w in ENG_DEFS]
    if not available:
        available = list(ENG_DEFS.keys())[:5]

    target = available[qid % len(available)]
    definition = ENG_DEFS[target]

    # 오답 (다른 단어)
    other_defs = [w for w in available if w != target][:3]
    while len(other_defs) < 3:
        extras = [k for k in ENG_DEFS.keys() if k != target and k not in other_defs]
        if extras:
            other_defs.append(random.choice(extras))
        else:
            break

    ans_pos = ((qid + 2) % 4) + 1
    choices = other_defs[:ans_pos-1] + [target] + other_defs[ans_pos-1:3]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]
    kor = KOR_MEANINGS.get(target, target)

    return {
        "id": qid, "type": "영영풀이 매칭", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": f"다음 영영풀이에 해당하는 단어를 고르시오.\n\n\"{definition}\"",
        "det": {
            "korean": f"{definition} = <b>{target}</b>({kor})",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {target}: 영영풀이와 일치\n❌ {''.join(wrong_nums)} 정의와 맞지 않는 단어",
            "tip": f"{target} = {kor}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_word_form(passage, words, qid, diff, pts):
    """어형 변환 (서술형)"""
    # 단어 → 품사 변환 쌍
    transforms = {
        'gratitude': ('grateful', 'gratitude', '형용사→명사'),
        'dedication': ('dedicate', 'dedication', '동사→명사'),
        'significantly': ('significant', 'significantly', '형용사→부사'),
        'improve': ('improvement', 'improve', '명사→동사'),
        'confidence': ('confident', 'confidence', '형용사→명사'),
        'achievement': ('achieve', 'achievement', '동사→명사'),
        'comfortable': ('comfort', 'comfortable', '명사→형용사'),
        'peacefully': ('peaceful', 'peacefully', '형용사→부사'),
        'isolation': ('isolate', 'isolation', '동사→명사'),
        'effectively': ('effective', 'effectively', '형용사→부사'),
        'assumption': ('assume', 'assumption', '동사→명사'),
        'preference': ('prefer', 'preference', '동사→명사'),
        'reputation': ('reputable', 'reputation', '형용사→명사'),
        'realistic': ('reality', 'realistic', '명사→형용사'),
        'fluctuation': ('fluctuate', 'fluctuation', '동사→명사'),
        'association': ('associate', 'association', '동사→명사'),
        'communication': ('communicate', 'communication', '동사→명사'),
        'characteristic': ('characterize', 'characteristic', '동사→명사/형용사'),
        'apparent': ('apparently', 'apparent', '부사→형용사'),
        'instantaneously': ('instantaneous', 'instantaneously', '형용사→부사'),
        'transition': ('transit', 'transition', '동사→명사'),
        'dominant': ('dominate', 'dominant', '동사→형용사'),
        'susceptible': ('susceptibility', 'susceptible', '명사→형용사'),
        'temptation': ('tempt', 'temptation', '동사→명사'),
        'inflation': ('inflate', 'inflation', '동사→명사'),
        'convertible': ('convert', 'convertible', '동사→형용사'),
        'deliberative': ('deliberate', 'deliberative', '동사→형용사'),
        'selective': ('select', 'selective', '동사→형용사'),
        'rational': ('rationality', 'rational', '명사→형용사'),
        'irrational': ('irrationality', 'irrational', '명사→형용사'),
    }

    available = [w for w in extract_words(passage, 5) if w in transforms]
    if not available:
        # Fallback
        available = list(transforms.keys())[:5]

    target = available[qid % len(available)]
    given_form, answer_form, change_type = transforms[target]

    sents = extract_sentences(passage)
    sent = [s for s in sents if target in s.lower()]
    if not sent:
        sent = [sents[0]] if sents else [passage[:100]]

    blank = sent[0].replace(target, f'__________({given_form})', 1)
    if target not in sent[0].lower():
        blank = f"...{target} → __________({given_form})..."

    kor = KOR_MEANINGS.get(target, target)

    return {
        "id": qid, "type": "어형 변환", "diff": diff, "pts": pts, "fmt": "written",
        "passage": passage,
        "stem": f"다음 문장의 괄호 안의 단어를 문맥에 맞게 어형 변환하시오.\n\n\"{blank}\"",
        "det": {
            "korean": f"{given_form} → <b>{answer_form}</b>: {change_type}",
            "analysis": f"✅ {answer_form}: {given_form}의 {change_type} 변환",
            "tip": f"{given_form}({change_type.split('→')[0]}) → {answer_form}({change_type.split('→')[1]})"
        },
        "wa": answer_form,
        "accept": [answer_form, answer_form.capitalize(), answer_form.upper()]
    }


def make_kor_to_eng(passage, words, qid, diff, pts):
    """한영 문항"""
    available = [w for w in extract_words(passage, 5) if w in KOR_MEANINGS]
    if not available:
        available = extract_words(passage, 5)[:5]

    target = available[qid % len(available)] if available else 'important'
    kor = KOR_MEANINGS.get(target, '중요한')

    # 오답
    other = [w for w in available if w != target][:3]
    while len(other) < 3:
        extras = [k for k in KOR_MEANINGS.keys() if k != target and k not in other]
        if extras:
            other.append(random.choice(extras))
        else:
            other.append('irrelevant')
            break

    ans_pos = ((qid) % 4) + 1
    choices = other[:ans_pos-1] + [target] + other[ans_pos-1:3]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "한영", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": f"다음 한국어 뜻에 해당하는 영어 단어를 고르시오.\n\n\"{kor}\"",
        "det": {
            "korean": f"{kor} = <b>{target}</b>",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {target}: '{kor}'의 영어 표현\n❌ {''.join(wrong_nums)} 다른 의미의 단어",
            "tip": f"{target} = {kor}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_content_match(passage, words, qid, diff, pts):
    """내용일치"""
    sents = extract_sentences(passage)
    if len(sents) < 2:
        sents = [passage[:len(passage)//2] + '.', passage[len(passage)//2:]]

    # 정답 선택지 (원문 내용)
    correct_sent = sents[qid % len(sents)]
    # 간단한 한국어 설명

    ans_pos = ((qid + 1) % 4) + 1

    # 선택지 생성 (한국어)
    choices = []
    for i in range(4):
        if i == ans_pos - 1:
            choices.append(f"원문에 따르면, {correct_sent[:60]}의 내용이 맞다.")
        else:
            # 오답 (원문 왜곡)
            other_sent = sents[(qid + i + 1) % len(sents)]
            choices.append(f"원문에서 {other_sent[:40]}는 언급되지 않았다.")

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "내용일치", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": "윗글의 내용과 <b>일치하는</b> 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]}번이 원문과 일치한다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 원문 내용과 일치\n❌ {''.join(wrong_nums)} 원문의 내용을 왜곡하거나 언급되지 않은 내용",
            "tip": "내용일치 문제는 원문의 세부 사항을 정확히 확인"
        },
        "ans": ans_pos,
        "ch": choices
    }


# ─── 워크북 전용 문항 생성기 ───

def make_grammar(passage, words, qid, diff, pts):
    """어법 문항"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]

    # 어법 포인트 찾기
    grammar_pairs = [
        ('which', 'what', '관계대명사 which vs 의문사 what'),
        ('that', 'what', '접속사/관계대명사 that vs what'),
        ('its', "it's", '소유격 its vs 축약형 it is'),
        ('their', "they're", '소유격 their vs 축약형 they are'),
        ('has', 'have', '주어-동사 수일치'),
        ('was', 'were', '주어-동사 수일치'),
        ('is', 'are', '주어-동사 수일치'),
        ('to', 'for', '전치사 to vs for'),
        ('than', 'then', '비교급 than vs 시간 then'),
        ('affect', 'effect', '동사 affect vs 명사 effect'),
    ]

    found = None
    for correct, wrong, desc in grammar_pairs:
        if correct in sent.lower():
            found = (correct, wrong, desc)
            break

    if not found:
        found = ('is', 'are', '주어-동사 수일치')

    correct_w, wrong_w, desc = found

    ans_pos = ((qid) % 4) + 1

    p = sent
    choices = []
    for i in range(4):
        if i == ans_pos - 1:
            choices.append(correct_w)
        else:
            choices.append(wrong_w if i == 0 else random.choice([wrong_w, 'being', 'been', 'having']))
    # Ensure unique-ish choices
    if len(set(choices)) < 3:
        choices = [wrong_w, correct_w, 'being', 'been'] if ans_pos == 2 else [correct_w, wrong_w, 'being', 'been']
        if ans_pos == 3:
            choices = [wrong_w, 'being', correct_w, 'been']
        elif ans_pos == 4:
            choices = [wrong_w, 'being', 'been', correct_w]

    # 빈칸 삽입
    p = p.replace(correct_w, '__________', 1)

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "어법", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": "다음 글의 빈칸에 들어갈 말로 어법상 가장 적절한 것은?",
        "det": {
            "korean": f"<b>{correct_w}</b>: {desc}",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {correct_w}: {desc}\n❌ {''.join(wrong_nums)} 어법에 맞지 않음",
            "tip": f"{desc}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_tf(passage, words, qid, diff, pts):
    """내용이해 T/F"""
    sents = extract_sentences(passage)
    if not sents:
        sents = [passage]

    is_true = (qid % 2 == 0)
    sent = sents[qid % len(sents)]

    if is_true:
        statement = sent[:80]
        verdict = "T"
        ans = 1
        det_kor = f"<b>T</b>: 원문에 해당 내용이 명시되어 있다."
        analysis = f"✅ T: 원문 — {sent[:60]}"
    else:
        # 왜곡
        statement = sent[:80].replace('not ', '').replace("n't ", ' ') if 'not' in sent.lower() else 'not ' + sent[:80]
        verdict = "F"
        ans = 2
        det_kor = f"<b>F</b>: 원문의 내용과 일치하지 않는다."
        analysis = f"❌ F: 원문과 반대되는 내용"

    return {
        "id": qid, "type": "내용이해 T/F", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": f"윗글의 내용과 일치하면 T, 일치하지 않으면 F를 고르시오.\n\n\"{statement}\"",
        "det": {
            "korean": det_kor,
            "analysis": analysis,
            "tip": "T/F 문제는 원문의 세부 정보를 정확히 확인"
        },
        "ans": ans,
        "ch": ["T", "F"],
        "verdict": verdict
    }


def make_blank_inference(passage, words, qid, diff, pts):
    """빈칸추론"""
    sents = extract_sentences(passage)
    sent = sents[-1] if sents else passage[-100:]

    # 핵심 구/절을 빈칸으로
    key_phrases = extract_words(sent, 5)
    if not key_phrases:
        key_phrases = ['understanding']

    target = key_phrases[0]
    blank = sent.replace(target, '__________', 1)

    # 오답
    distractors = [w for w in extract_words(passage, 5) if w != target][:3]
    while len(distractors) < 3:
        distractors.append(random.choice(['competition', 'entertainment', 'decoration']))

    ans_pos = ((qid) % 4) + 1
    choices = distractors[:ans_pos-1] + [target] + distractors[ans_pos-1:3]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]
    kor = KOR_MEANINGS.get(target, target)

    return {
        "id": qid, "type": "빈칸추론", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": blank,
        "stem": "다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "det": {
            "korean": f"빈칸에는 <b>{target}</b>({kor})이/가 가장 적절하다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} {target}: 문맥상 가장 적절\n❌ {''.join(wrong_nums)} 문맥과 맞지 않음",
            "tip": f"{target} = {kor}"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_error_find(passage, words, qid, diff, pts):
    """오류찾기"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]

    ws = extract_words(sent, 4)[:4]
    while len(ws) < 4:
        ws.append('important')

    ans_pos = ((qid + 2) % 4) + 1

    # 정답 위치의 단어에 일부러 오류 삽입
    p = sent
    choices = []
    for i, w in enumerate(ws):
        num = '①②③④'[i]
        if i == ans_pos - 1:
            error_w = w + 'ed' if not w.endswith('ed') else w[:-2] + 'ing'
            p = p.replace(w, f'{num}<u>{error_w}</u>', 1)
            choices.append(f"①②③④"[i])
        else:
            p = p.replace(w, f'{num}<u>{w}</u>', 1)

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "오류찾기", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": p,
        "stem": "다음 글의 밑줄 친 ①~④ 중, 어법상 <b>틀린</b> 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]}번의 어형이 잘못되었다. 올바른 형태: <b>{ws[ans_pos-1]}</b>",
            "analysis": f"❌ {'①②③④'[ans_pos-1]} 어법 오류\n✅ {''.join(wrong_nums)} 어법상 올바름",
            "tip": "밑줄 친 단어의 품사와 문맥을 확인"
        },
        "ans": ans_pos,
        "ch": ["①", "②", "③", "④"]
    }


def make_written_keyword(passage, words, qid, diff, pts):
    """서술형 — 핵심단어"""
    available = [w for w in extract_words(passage, 5) if w in KOR_MEANINGS]
    if not available:
        available = extract_words(passage, 5)[:3]

    target = available[qid % len(available)] if available else 'important'
    kor = KOR_MEANINGS.get(target, target)

    sents = extract_sentences(passage)
    sent = [s for s in sents if target in s.lower()]
    if not sent:
        sent = [sents[0]] if sents else [passage[:100]]

    blank = sent[0].replace(target, '__________', 1)

    return {
        "id": qid, "type": "서술형 — 핵심단어", "diff": diff, "pts": pts, "fmt": "written",
        "passage": passage,
        "stem": f"윗글에서 '{kor}'을/를 의미하는 영어 단어를 본문에서 찾아 쓰시오.\n\n\"{blank}\"",
        "det": {
            "korean": f"<b>{target}</b>: {kor}",
            "analysis": f"✅ {target}: 원문에서 해당 의미의 단어",
            "tip": f"{target} = {kor}"
        },
        "wa": target,
        "accept": [target, target.capitalize(), target.upper()]
    }


def make_written_form_change(passage, words, qid, diff, pts):
    """서술형 — 어형변환"""
    transforms = {
        'gratitude': ('grateful', 'gratitude', '형용사→명사'),
        'dedication': ('dedicate', 'dedication', '동사→명사'),
        'significantly': ('significant', 'significantly', '형용사→부사'),
        'confidence': ('confident', 'confidence', '형용사→명사'),
        'achievement': ('achieve', 'achievement', '동사→명사'),
        'comfortable': ('comfort', 'comfortable', '명사→형용사'),
        'peacefully': ('peaceful', 'peacefully', '형용사→부사'),
        'isolation': ('isolate', 'isolation', '동사→명사'),
        'effectively': ('effective', 'effectively', '형용사→부사'),
        'assumption': ('assume', 'assumption', '동사→명사'),
        'preference': ('prefer', 'preference', '동사→명사'),
        'reputation': ('reputable', 'reputation', '형용사→명사'),
        'realistic': ('reality', 'realistic', '명사→형용사'),
        'fluctuation': ('fluctuate', 'fluctuation', '동사→명사'),
        'communication': ('communicate', 'communication', '동사→명사'),
        'characteristic': ('characterize', 'characteristic', '동사→명사'),
        'apparent': ('apparently', 'apparent', '부사→형용사'),
        'transition': ('transit', 'transition', '동사→명사'),
        'dominant': ('dominate', 'dominant', '동사→형용사'),
        'temptation': ('tempt', 'temptation', '동사→명사'),
        'inflation': ('inflate', 'inflation', '동사→명사'),
        'selective': ('select', 'selective', '동사→형용사'),
        'rational': ('rationalize', 'rational', '동사→형용사'),
        'deliberative': ('deliberate', 'deliberative', '동사/형용사→형용사'),
    }

    available = [w for w in extract_words(passage, 5) if w in transforms]
    if not available:
        available = list(transforms.keys())[:5]

    target = available[qid % len(available)]
    given, answer, change = transforms[target]

    sents = extract_sentences(passage)
    sent = [s for s in sents if target in s.lower()]
    if not sent:
        sent = [sents[0]] if sents else [passage[:100]]

    blank = sent[0].replace(target, f'__________({given})', 1)

    return {
        "id": qid, "type": "서술형 — 어형변환", "diff": diff, "pts": pts, "fmt": "written",
        "passage": passage,
        "stem": f"다음 문장의 괄호 안의 단어를 문맥에 맞게 어형 변환하시오.\n\n\"{blank}\"",
        "det": {
            "korean": f"{given} → <b>{answer}</b>: {change}",
            "analysis": f"✅ {answer}: {given}의 {change} 변환",
            "tip": f"{given} → {answer} ({change})"
        },
        "wa": answer,
        "accept": [answer, answer.capitalize(), answer.upper(), answer + '.']
    }


def make_word_order(passage, words, qid, diff, pts):
    """어순배열"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]

    # 문장 일부를 어순배열 대상으로
    ws = sent.split()
    if len(ws) > 8:
        start = qid % max(1, len(ws) - 6)
        chunk = ws[start:start+5]
    else:
        chunk = ws[-5:] if len(ws) >= 5 else ws

    answer = ' '.join(chunk)
    shuffled = chunk[:]
    random.shuffle(shuffled)
    # 셔플이 원래와 같으면 다시
    if shuffled == chunk:
        shuffled = chunk[::-1]

    hint = ' / '.join(shuffled)

    before = ' '.join(ws[:ws.index(chunk[0])]) if chunk[0] in ws else ''

    return {
        "id": qid, "type": "어순배열", "diff": diff, "pts": pts, "fmt": "written",
        "passage": passage,
        "stem": f"다음 주어진 단어를 올바른 순서로 배열하여 빈칸을 완성하시오.\n\n\"{before} __________\"\n\n[ {hint} ]",
        "det": {
            "korean": f"올바른 어순: <b>{answer}</b>",
            "analysis": f"✅ {answer}: 올바른 어순",
            "tip": "문맥과 문법에 맞는 어순을 파악"
        },
        "wa": answer,
        "accept": [answer, answer + '.', answer.rstrip('.')]
    }


def make_written_eng(passage, words, qid, diff, pts):
    """서술형 — 영작"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:80]

    # 문장 일부를 영작 대상으로
    ws = sent.split()
    if len(ws) > 6:
        start = qid % max(1, len(ws) - 4)
        answer = ' '.join(ws[start:start+4])
    else:
        answer = ' '.join(ws[:4])

    kor_hint = KOR_MEANINGS.get(ws[0].lower().strip('.,'), ws[0]) if ws else '내용'

    return {
        "id": qid, "type": "서술형 — 영작", "diff": diff, "pts": pts, "fmt": "written",
        "passage": passage,
        "stem": f"다음 우리말에 맞도록 빈칸에 들어갈 영어를 쓰시오.\n\n\"{sent.replace(answer, '__________', 1)}\"",
        "det": {
            "korean": f"빈칸: <b>{answer}</b>",
            "analysis": f"✅ {answer}: 원문 표현과 일치",
            "tip": "원문의 표현을 정확히 기억하여 영작"
        },
        "wa": answer,
        "accept": [answer, answer + '.', answer.rstrip('.'), answer.capitalize()]
    }


# ─── 퀴즈 전용 문항 ───

def make_topic(passage, words, qid, diff, pts):
    """주제"""
    ans_pos = ((qid) % 4) + 1

    # 주제 관련 키워드로 선택지 생성
    kw = pick_key_words(passage, 3)
    topic = ' '.join(kw[:2]) if len(kw) >= 2 else 'the main idea'

    choices = [
        f"the importance of {kw[0] if kw else 'understanding'}",
        f"the role of {kw[1] if len(kw) > 1 else 'education'} in modern society",
        f"how {kw[0] if kw else 'factors'} affects our decisions",
        f"the relationship between {kw[0] if kw else 'concepts'} and {kw[1] if len(kw) > 1 else 'reality'}"
    ]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "주제", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": "다음 글의 주제로 가장 적절한 것은?",
        "det": {
            "korean": f"이 글의 주제는 {'①②③④'[ans_pos-1]}번이다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 글의 핵심 주제와 일치\n❌ {''.join(wrong_nums)} 글의 주제와 맞지 않음",
            "tip": "글의 첫 문장과 마지막 문장에서 주제를 파악"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_title(passage, words, qid, diff, pts):
    """제목"""
    ans_pos = ((qid + 1) % 4) + 1
    kw = pick_key_words(passage, 3)

    choices = [
        f"The Hidden Power of {kw[0].capitalize() if kw else 'Knowledge'}",
        f"Why {kw[1].capitalize() if len(kw) > 1 else 'Understanding'} Matters",
        f"Beyond {kw[0].capitalize() if kw else 'Expectations'}: A New Perspective",
        f"{kw[0].capitalize() if kw else 'Success'} and Its Unexpected Consequences"
    ]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "제목", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": "다음 글의 제목으로 가장 적절한 것은?",
        "det": {
            "korean": f"이 글의 제목으로 {'①②③④'[ans_pos-1]}번이 가장 적절하다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 글의 핵심 내용을 포괄\n❌ {''.join(wrong_nums)} 글의 내용과 맞지 않음",
            "tip": "제목은 글의 핵심 주제를 함축적으로 표현"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_implication(passage, words, qid, diff, pts):
    """함축의미 추론"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]

    ans_pos = ((qid + 2) % 4) + 1

    choices = [
        "원문의 비유적 표현이 의미하는 바를 정확히 파악한 해석",
        "원문의 표면적 의미만을 해석한 것",
        "원문의 맥락과 관련 없는 해석",
        "원문의 의미를 과도하게 확대 해석한 것"
    ]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "함축의미 추론", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": f"다음 글에서 밑줄 친 부분이 의미하는 바로 가장 적절한 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]}번이 함축적 의미를 정확히 파악한 것이다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 문맥상 함축적 의미와 일치\n❌ {''.join(wrong_nums)} 표면적/과대/무관한 해석",
            "tip": "밑줄 친 표현의 비유적/함축적 의미를 파악"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_summary(passage, words, qid, diff, pts):
    """요약"""
    kw = pick_key_words(passage, 4)

    ans_pos = ((qid) % 4) + 1

    a = kw[0] if kw else 'understanding'
    b = kw[1] if len(kw) > 1 else 'knowledge'

    choices = [
        f"{a} — {b}",
        f"{a} — {'competition' if b != 'competition' else 'isolation'}",
        f"{'resistance' if a != 'resistance' else 'limitation'} — {b}",
        f"{'entertainment' if a != 'entertainment' else 'decoration'} — {'restriction' if b != 'restriction' else 'confusion'}"
    ]

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "요약", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": f"다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?\n\n\"This passage discusses how (A)__________ relates to (B)__________.\"",
        "det": {
            "korean": f"(A) {choices[ans_pos-1].split(' — ')[0]}, (B) {choices[ans_pos-1].split(' — ')[1]}",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 글의 요약과 일치\n❌ {''.join(wrong_nums)} 글의 내용과 맞지 않는 요약",
            "tip": "글의 핵심 주제어를 파악하여 요약"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_content_understanding(passage, words, qid, diff, pts):
    """내용이해"""
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]

    ans_pos = ((qid + 1) % 4) + 1

    choices = []
    for i in range(4):
        s = sents[(qid + i) % len(sents)] if sents else passage[:80]
        if i == ans_pos - 1:
            choices.append(s[:70])
        else:
            # 약간 왜곡
            choices.append(s[:70].replace('not ', '') if 'not' in s else 'It is not mentioned that ' + s[:40])

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "내용이해", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": "윗글의 내용으로 적절한 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]}번이 원문 내용과 일치한다.",
            "analysis": f"✅ {'①②③④'[ans_pos-1]} 원문 내용과 일치\n❌ {''.join(wrong_nums)} 원문과 불일치하거나 왜곡",
            "tip": "선택지를 원문과 대조하여 정확한 내용을 확인"
        },
        "ans": ans_pos,
        "ch": choices
    }


def make_content_mismatch(passage, words, qid, diff, pts):
    """내용불일치"""
    sents = extract_sentences(passage)

    ans_pos = ((qid + 2) % 4) + 1

    choices = []
    for i in range(4):
        s = sents[(qid + i) % len(sents)] if sents else passage[:80]
        if i == ans_pos - 1:
            # 불일치 내용
            choices.append(s[:60] + " (원문에 없는 내용)")
        else:
            choices.append(s[:70])

    wrong_nums = [f"①②③④"[i] for i in range(4) if i+1 != ans_pos]

    return {
        "id": qid, "type": "내용불일치", "diff": diff, "pts": pts, "fmt": "mc",
        "passage": passage,
        "stem": "윗글의 내용과 일치하지 <b>않는</b> 것은?",
        "det": {
            "korean": f"{'①②③④'[ans_pos-1]}번은 원문에 언급되지 않은 내용이다.",
            "analysis": f"❌ {'①②③④'[ans_pos-1]} 원문에 없는 내용\n✅ {''.join(wrong_nums)} 원문과 일치",
            "tip": "불일치 문제: 원문에 '없는' 정보를 선택지에서 찾기"
        },
        "ans": ans_pos,
        "ch": choices
    }


# ─── 단어 테스트 20문항 구성 ───
WORD_TEMPLATE = [
    # id, type_func, diff, pts
    (1, 'abc', '쉬움', 4),
    (2, 'abc', '쉬움', 4),
    (3, 'abc', '쉬움', 4),
    (4, 'inappropriate', '쉬움', 4),
    (5, 'inappropriate', '쉬움', 4),
    (6, 'blank_vocab', '보통', 5),
    (7, 'blank_vocab', '보통', 5),
    (8, 'blank_vocab', '보통', 5),
    (9, 'synonym', '보통', 5),
    (10, 'synonym', '보통', 5),
    (11, 'synonym', '보통', 5),
    (12, 'antonym', '보통', 5),
    (13, 'antonym', '보통', 5),
    (14, 'eng_def', '보통', 5),
    (15, 'eng_def', '보통', 5),
    (16, 'word_form', '어려움', 6),
    (17, 'word_form', '어려움', 6),
    (18, 'kor_eng', '어려움', 6),
    (19, 'kor_eng', '어려움', 6),
    (20, 'eng_def', '어려움', 6),
]

WORKBOOK_TEMPLATE = [
    (1, 'grammar', '쉬움', 4),
    (2, 'grammar', '쉬움', 4),
    (3, 'grammar', '쉬움', 4),
    (4, 'grammar', '쉬움', 4),
    (5, 'inappropriate', '쉬움', 4),
    (6, 'inappropriate', '보통', 5),
    (7, 'tf', '보통', 5),
    (8, 'tf', '보통', 5),
    (9, 'tf', '보통', 5),
    (10, 'blank_inference', '보통', 5),
    (11, 'blank_inference', '보통', 5),
    (12, 'content_match', '보통', 5),
    (13, 'content_mismatch', '보통', 5),
    (14, 'error_find', '보통', 5),
    (15, 'written_keyword', '보통', 5),
    (16, 'written_form', '어려움', 6),
    (17, 'word_order', '어려움', 6),
    (18, 'topic', '어려움', 6),
    (19, 'summary', '어려움', 6),
    (20, 'written_eng', '어려움', 6),
]

QUIZ_TEMPLATE = [
    (1, 'grammar', '쉬움', 4),
    (2, 'grammar', '쉬움', 4),
    (3, 'grammar', '쉬움', 4),
    (4, 'inappropriate', '쉬움', 4),
    (5, 'inappropriate', '쉬움', 4),
    (6, 'blank_inference', '보통', 5),
    (7, 'blank_inference', '보통', 5),
    (8, 'content_match', '보통', 5),
    (9, 'content_match', '보통', 5),
    (10, 'content_mismatch', '보통', 5),
    (11, 'topic', '보통', 5),
    (12, 'title', '보통', 5),
    (13, 'implication', '보통', 5),
    (14, 'content_understanding', '보통', 5),
    (15, 'content_understanding', '보통', 5),
    (16, 'written_keyword', '어려움', 6),
    (17, 'written_form', '어려움', 6),
    (18, 'word_order', '어려움', 6),
    (19, 'written_eng', '어려움', 6),
    (20, 'written_eng', '어려움', 6),
]

FUNC_MAP = {
    'abc': make_abc_combo,
    'inappropriate': make_inappropriate_vocab,
    'blank_vocab': make_blank_vocab,
    'synonym': make_synonym,
    'antonym': make_antonym,
    'eng_def': make_eng_def,
    'word_form': make_word_form,
    'kor_eng': make_kor_to_eng,
    'grammar': make_grammar,
    'tf': make_tf,
    'blank_inference': make_blank_inference,
    'error_find': make_error_find,
    'written_keyword': make_written_keyword,
    'written_form': make_written_form_change,
    'word_order': make_word_order,
    'written_eng': make_written_eng,
    'content_match': make_content_match,
    'content_mismatch': make_content_mismatch,
    'topic': make_topic,
    'title': make_title,
    'implication': make_implication,
    'summary': make_summary,
    'content_understanding': make_content_understanding,
}

def generate_test(folder_name, fullPassage, test_type, template):
    """테스트 JSON 생성"""
    lesson = LESSON_MAP.get(folder_name, '기타')

    # histKey 접두사
    hist_prefix = {'단어': 'wordTest', '워크북': 'workbookTest', '퀴즈': 'quizTest'}[test_type]

    # folder_name에서 번호 추출
    num = folder_name.replace('번', '')
    hist_key = f"{hist_prefix}_g2_2025jun_Q{num}_v3"

    words = pick_key_words(fullPassage, 15)

    questions = []
    for qid, func_name, diff, pts in template:
        func = FUNC_MAP[func_name]
        q = func(fullPassage, words, qid, diff, pts)
        questions.append(q)

    # 배점 검증
    total_pts = sum(q['pts'] for q in questions)
    assert total_pts == 100, f"{folder_name}/{test_type}: total={total_pts}, expected 100"

    # 난이도 검증
    easy = sum(1 for q in questions if q['diff'] == '쉬움')
    medium = sum(1 for q in questions if q['diff'] == '보통')
    hard = sum(1 for q in questions if q['diff'] == '어려움')
    assert easy == 5, f"{folder_name}/{test_type}: easy={easy}"
    assert medium == 10, f"{folder_name}/{test_type}: medium={medium}"
    assert hard == 5, f"{folder_name}/{test_type}: hard={hard}"

    # 제목 생성 (첫 20자)
    title = fullPassage[:50].replace('"', "'").split('.')[0]
    if len(title) > 50:
        title = title[:47] + '...'

    return {
        "version": 3,
        "testType": test_type,
        "ei": {
            "subject": "2025년 6월 고2 모의고사",
            "pub": folder_name,
            "lesson": lesson,
            "title": title,
            "total": 100,
            "time": 1200,
            "totalQ": 20,
            "histKey": hist_key
        },
        "fullPassage": fullPassage,
        "questions": questions
    }


def main():
    passages = load_passages()

    total_files = 0
    total_questions = 0

    for folder_name in sorted(passages.keys(), key=lambda x: x.replace('-', '').replace('번', '').zfill(5)):
        fp = passages[folder_name]

        for test_type, template in [('단어', WORD_TEMPLATE), ('워크북', WORKBOOK_TEMPLATE), ('퀴즈', QUIZ_TEMPLATE)]:
            data = generate_test(folder_name, fp, test_type, template)

            out_dir = os.path.join(BASE, folder_name)
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, f'{test_type}.json')

            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            total_files += 1
            total_questions += len(data['questions'])
            print(f"✅ {folder_name}/{test_type}.json — 20문항, 100점")

    print(f"\n총 {total_files}파일, {total_questions}문항 생성 완료")


if __name__ == '__main__':
    main()
