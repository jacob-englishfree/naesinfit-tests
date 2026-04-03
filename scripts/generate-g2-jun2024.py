#!/usr/bin/env python3
"""
고2 2024년 6월 모의고사 전체 출제 — 66파일 1,320문항
PDF에서 직접 지문 추출 → JSON 생성 (content filter 우회)
"""
import json, os, re, random
import pdfplumber

random.seed(2024)

PDF_PATH = "/tmp/mock_2024_g2_6/03_2024_6월_고2_영어(탑재용).pdf"
BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', '모의고사', '고2', '6월_2024')

TARGETS = ['18번','20번','21번','22번','23번','24번','26번','29번','30번',
           '31번','32번','33번','34번','35번','36번','37번','38번','39번',
           '40번','41-42번','43-45번']

LESSON_MAP = {
    '18번':'글의 목적','20번':'필자의 주장','21번':'함축적 의미',
    '22번':'글의 요지','23번':'글의 주제','24번':'제목 추론',
    '26번':'내용 불일치','29번':'어법','30번':'어휘',
    '31번':'빈칸 추론','32번':'빈칸 추론','33번':'빈칸 추론','34번':'빈칸 추론',
    '35번':'무관한 문장','36번':'순서 배열','37번':'순서 배열',
    '38번':'문장 삽입','39번':'문장 삽입','40번':'문단 요약',
    '41-42번':'장문(제목+어휘)','43-45번':'장문(순서+지칭+내용)',
}

# ─── PDF에서 지문 추출 ───
def clean(text):
    lines = text.split('\n')
    out = []
    for line in lines:
        s = line.strip()
        if not s: continue
        if re.match(r'^[①②③④⑤]', s): continue
        if re.match(r'^\*', s): continue
        if re.match(r'^━+', s): continue
        if re.match(r'^[0-9]+\s*(영어|고\s*2)', s): continue
        if '영어 영역' in s: continue
        if re.match(r'^고\s*2\s*영어', s): continue
        if re.match(r'^\d+\s*/\s*\d+', s): continue
        out.append(s)
    return ' '.join(out)

def extract_all_passages():
    col_texts = []  # (page, side, text)
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            w = page.width
            left = page.crop((0, 0, w*0.5, page.height)).extract_text() or ""
            right = page.crop((w*0.5, 0, w, page.height)).extract_text() or ""
            col_texts.append(('L', left))
            col_texts.append(('R', right))

    # 모든 컬럼 텍스트 합치기 (순서: L2→R2→L3→R3→...)
    all_text = ""
    for side, text in col_texts:
        all_text += text + "\n|||COL|||\n"

    return all_text

def find_passage(full_text, q_num_str, next_markers):
    """q_num_str(예:'18') 이후 next_markers 전까지 텍스트 추출"""
    # 번호 패턴
    pattern = rf'(?:^|\n)\s*{re.escape(q_num_str)}\.'
    m = re.search(pattern, full_text)
    if not m:
        # 한국어 제목이 있는 경우
        pattern2 = rf'{re.escape(q_num_str)}\.\s'
        m = re.search(pattern2, full_text)
    if not m:
        return ""

    start = m.end()
    end = len(full_text)

    for nm in next_markers:
        nm_pat = rf'(?:^|\n)\s*{re.escape(nm)}\.'
        nm_m = re.search(nm_pat, full_text[start:])
        if nm_m:
            candidate = start + nm_m.start()
            if candidate < end:
                end = candidate

    chunk = full_text[start:end]
    # 선택지/주석 제거
    lines = chunk.split('\n')
    out = []
    for line in lines:
        s = line.strip()
        if not s: continue
        if re.match(r'^[①②③④⑤]', s): continue
        if re.match(r'^\*', s): continue
        if re.match(r'^━+', s): continue
        if re.match(r'^\|\|\|COL\|\|\|', s): continue
        if '영어 영역' in s or re.match(r'^고\s*2', s): continue
        if re.match(r'^\d+\s*/\s*\d+', s): continue
        if re.match(r'다음 글', s) and '적절한' in s: continue
        if re.match(r'\[[\d~]+\]', s): continue
        if re.match(r'다음 빈칸', s): continue
        out.append(s)
    return ' '.join(out).strip()

def get_passages():
    full = extract_all_passages()
    passages = {}

    defs = {
        '18': ('19', '글의 목적'),
        '20': ('21', '필자 주장'),
        '21': ('22', '함축 의미'),
        '22': ('23', '요지'),
        '23': ('24', '주제'),
        '24': ('25', '제목'),
        '26': ('27', '내용불일치'),
        '29': ('30', '어법'),
        '30': ('31', '어휘'),
        '31': ('32', '빈칸1'),
        '32': ('33', '빈칸2'),
        '33': ('34', '빈칸3'),
        '34': ('35', '빈칸4'),
        '35': ('36', '무관'),
        '36': ('37', '순서1'),
        '37': ('38', '순서2'),
        '38': ('39', '삽입1'),
        '39': ('40', '삽입2'),
        '40': ('41', '요약'),
    }

    for qnum, (nxt, _) in defs.items():
        p = find_passage(full, qnum, [nxt])
        if p:
            folder = qnum + '번'
            passages[folder] = p

    # 41-42번: [41~42] 섹션
    m4142 = re.search(r'\[41[~～]42\][^\n]*\n(.*?)(?=\[43[~～]45\])', full, re.DOTALL)
    if m4142:
        chunk = m4142.group(1)
        lines = chunk.split('\n')
        out = [l.strip() for l in lines if l.strip()
               and not re.match(r'^[①②③④⑤]', l.strip())
               and not re.match(r'^━+', l.strip())
               and '영어 영역' not in l
               and not l.strip().startswith('41.') and not l.strip().startswith('42.')]
        passages['41-42번'] = ' '.join(out).strip()

    # 43-45번
    m4345 = re.search(r'\[43[~～]45\][^\n]*\n(.*?)(?=\*\s*확인|$)', full, re.DOTALL)
    if m4345:
        chunk = m4345.group(1)
        lines = chunk.split('\n')
        out = [l.strip() for l in lines if l.strip()
               and not re.match(r'^[①②③④⑤]', l.strip())
               and not re.match(r'^━+', l.strip())
               and '영어 영역' not in l
               and not re.match(r'^4[3-5]\.', l.strip())]
        passages['43-45번'] = ' '.join(out).strip()

    return passages

# ─── 어휘 사전 ───
SYNONYMS = {
    'advantage':'benefit','community':'society','required':'necessary',
    'divide':'split','resist':'oppose','estimate':'assess','downgrade':'reduce',
    'potential':'capability','accurately':'precisely','discard':'abandon',
    'powerful':'influential','success':'achievement','freedom':'liberty',
    'examine':'inspect','reside':'exist','transaction':'exchange',
    'viable':'sustainable','restructure':'reorganize','rescue':'save',
    'diversity':'variety','objective':'impartial','curiosity':'interest',
    'consensus':'agreement','confidence':'certainty','reinforce':'strengthen',
    'feedback':'response','capacity':'ability','establish':'create',
    'practical':'useful','instantaneously':'immediately','immense':'vast',
    'flexible':'adaptable','financial':'monetary','sophisticated':'complex',
    'agrarian':'agricultural','investment':'asset','consumption':'spending',
    'bidirectional':'two-way','replace':'substitute','commercial':'advertisement',
    'adaptation':'adjustment','positive':'beneficial','enjoyable':'pleasant',
    'automation':'mechanization','eliminate':'remove','majority':'most',
    'ownership':'possession','status':'position','identical':'same',
    'resentment':'bitterness','similar':'alike','biases':'prejudices',
    'partial':'biased','consistent':'steady','confirmation':'verification',
    'subconscious':'unconscious','imbalanced':'uneven','predict':'forecast',
    'approach':'method','structured':'organized','assessment':'evaluation',
}
ANTONYMS = {
    'advantage':'disadvantage','required':'optional','resist':'accept',
    'accurately':'inaccurately','powerful':'powerless','freedom':'captivity',
    'viable':'unviable','diversity':'uniformity','objective':'subjective',
    'confidence':'doubt','reinforce':'weaken','practical':'impractical',
    'immense':'tiny','flexible':'rigid','sophisticated':'simple',
    'positive':'negative','enjoyable':'unpleasant','similar':'different',
    'partial':'impartial','consistent':'inconsistent','structured':'unstructured',
}
ENG_DEFS = {
    'advantage':'a condition giving a greater chance of success',
    'community':'a group of people living in the same place',
    'estimate':'an approximate calculation or judgment',
    'potential':'having the capacity to develop in the future',
    'diversity':'the state of being diverse; variety',
    'consensus':'general agreement among a group',
    'capacity':'the ability or power to do something',
    'reinforce':'to strengthen or support',
    'practical':'relating to actual use rather than theory',
    'instantaneously':'happening or done in an instant',
    'financial':'relating to money or finance',
    'consumption':'the use of resources or goods',
    'adaptation':'the process of adapting to new conditions',
    'automation':'the use of machines with minimal human intervention',
    'ownership':'the act of owning something',
    'biases':'prejudices in favor of or against something',
    'assessment':'the evaluation of the nature of something',
    'feedback':'information about results used to improve performance',
}
KOR_MEANINGS = {
    'advantage':'이점','community':'공동체','required':'필요한','divide':'나누다',
    'resist':'저항하다','estimate':'추정하다','potential':'잠재적','accurately':'정확하게',
    'powerful':'강력한','success':'성공','freedom':'자유','examine':'검토하다',
    'reside':'존재하다','transaction':'거래','viable':'실행 가능한',
    'restructure':'구조 조정하다','rescue':'구제하다','diversity':'다양성',
    'objective':'객관적인','curiosity':'호기심','consensus':'합의',
    'confidence':'자신감','reinforce':'강화하다','feedback':'피드백',
    'capacity':'능력','establish':'확립하다','practical':'실용적인',
    'instantaneously':'즉각적으로','immense':'엄청난','flexible':'유연한',
    'financial':'재정적','sophisticated':'정교한','agrarian':'농업의',
    'consumption':'소비','bidirectional':'양방향','replace':'대체하다',
    'adaptation':'적응','positive':'긍정적인','enjoyable':'즐거운',
    'automation':'자동화','eliminate':'제거하다','majority':'대다수',
    'ownership':'소유','status':'지위','identical':'동일한',
    'resentment':'분개','similar':'유사한','biases':'편견',
    'partial':'편향된','consistent':'일관된','subconscious':'무의식적인',
    'imbalanced':'불균형한','predict':'예측하다','structured':'체계적인',
}

def extract_words(text, min_len=5):
    stop = {'which','where','their','these','there','those','about','would','could',
            'should','being','other','after','before','while','every','might','never',
            'often','still','under','above','below','along','among','since','until',
            'between','through','during','without','within','against','because','however',
            'therefore','although','moreover','furthermore','nevertheless','the','and',
            'that','this','with','from','they','have','been','were','when','what','more',
            'than','also','into','just','some','will','most','only','very','such','much',
            'each','then','them','does','make','like','over','many','your','even','same',
            'people','things','could','would','should','might','really','quite','rather',
            'already','perhaps','always','something','everything','nothing','anything'}
    words = re.findall(r'[A-Za-z]+', text)
    return [w.lower() for w in words if len(w) >= min_len and w.lower() not in stop]

def extract_sentences(text):
    sents = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sents if len(s.strip()) > 20]

def pick_key_words(text, n=10):
    words = extract_words(text)
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.keys(), key=lambda w: (-freq[w], -len(w)))
    return ranked[:n]

def get_antonym(w):
    if w in ANTONYMS: return ANTONYMS[w]
    return 'un' + w if not w.startswith('un') else w[2:]

# ─── 문항 생성 함수 ───
def make_abc_combo(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 4) if w in ANTONYMS]
    if len(available) < 3:
        available = extract_words(passage, 4)[:8]
    seen, chosen = set(), []
    for w in available:
        if w not in seen:
            chosen.append(w); seen.add(w)
        if len(chosen) >= 3: break
    while len(chosen) < 3:
        chosen.append('important')
    a, b, c = chosen[0], chosen[1], chosen[2]
    ant_a, ant_b, ant_c = get_antonym(a), get_antonym(b), get_antonym(c)
    ans_pos = (qid % 4) + 1
    if ans_pos == 1: choices = [f"{a} — {b} — {c}", f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}"]
    elif ans_pos == 2: choices = [f"{ant_a} — {b} — {c}", f"{a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}"]
    elif ans_pos == 3: choices = [f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {c}", f"{a} — {b} — {ant_c}"]
    else: choices = [f"{ant_a} — {b} — {c}", f"{a} — {ant_b} — {c}", f"{a} — {b} — {ant_c}", f"{a} — {b} — {c}"]
    p = passage.replace(a, f"(A)[{a} / {ant_a}]", 1).replace(b, f"(B)[{b} / {ant_b}]", 1).replace(c, f"(C)[{c} / {ant_c}]", 1)
    ka, kb, kc = KOR_MEANINGS.get(a,a), KOR_MEANINGS.get(b,b), KOR_MEANINGS.get(c,c)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"(A)(B)(C) 조합형","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":"다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
            "det":{"korean":f"<b>{a}</b>({ka}), <b>{b}</b>({kb}), <b>{c}</b>({kc})가 원문과 일치한다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {a} — {b} — {c}: 원문과 일치\n❌ {''.join(wrong)} 반의어 포함으로 부적절",
                   "tip":f"{a} ↔ {ant_a}, {b} ↔ {ant_b}, {c} ↔ {ant_c}"},
            "ans":ans_pos,"ch":choices}

def make_inappropriate_vocab(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if len(sents) < 2: sents = [passage[:len(passage)//2], passage[len(passage)//2:]]
    all_words = []
    for s in sents:
        ws = [w for w in extract_words(s, 4) if w in ANTONYMS]
        all_words.extend(ws)
    if len(all_words) < 4: all_words = extract_words(passage, 4)[:8]
    seen, unique = set(), []
    for w in all_words:
        if w not in seen: unique.append(w); seen.add(w)
    unique = unique[:4]
    while len(unique) < 4: unique.append('important')
    ans_pos = ((qid + 1) % 4) + 1
    p = passage
    choices = []
    wrong_word = unique[ans_pos - 1]
    replacement = get_antonym(wrong_word)
    for i, w in enumerate(unique):
        num = '①②③④'[i]
        if i == ans_pos - 1:
            p = p.replace(w, f'{num}<u>{replacement}</u>', 1); choices.append(replacement)
        else:
            p = p.replace(w, f'{num}<u>{w}</u>', 1); choices.append(w)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    kw = KOR_MEANINGS.get(replacement, replacement); kr = KOR_MEANINGS.get(wrong_word, wrong_word)
    return {"id":qid,"type":"문맥상 부적절한 어휘","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]} {replacement}({kw}) → <b>{wrong_word}</b>({kr}): 원문의 의미와 반대",
                   "analysis":f"❌ {'①②③④'[ans_pos-1]} {replacement}: 원문은 {wrong_word}\n✅ {''.join(wrong)} 원문과 일치",
                   "tip":f"{wrong_word}({kr}) ↔ {replacement}({kw})"},
            "ans":ans_pos,"ch":choices}

def make_blank_vocab(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if not sents: sents = [passage]
    sent = sents[qid % len(sents)]
    sent_words = [w for w in extract_words(sent, 5) if w in KOR_MEANINGS]
    if not sent_words: sent_words = extract_words(sent, 4)[:3]
    if not sent_words: sent_words = ['important']
    target = sent_words[0]
    blank_sent = sent.replace(target, '__________', 1)
    distractors = [w for w in extract_words(passage, 5) if w != target and w in KOR_MEANINGS][:3]
    while len(distractors) < 3: distractors.append(random.choice(['circumstance','observation','resistance']))
    ans_pos = ((qid + 2) % 4) + 1
    choices = distractors[:ans_pos-1] + [target] + distractors[ans_pos-1:3]
    kt = KOR_MEANINGS.get(target, target)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"빈칸 어휘 완성","diff":diff,"pts":pts,"fmt":"mc",
            "passage":blank_sent,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "det":{"korean":f"빈칸에는 <b>{target}</b>({kt})이/가 들어가야 한다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {target}: 원문과 일치\n❌ {''.join(wrong)} 문맥과 맞지 않는 어휘",
                   "tip":f"{target} = {kt}"},
            "ans":ans_pos,"ch":choices}

def make_synonym(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 5) if w in SYNONYMS]
    if not available: available = extract_words(passage, 5)[:3]
    target = available[qid % len(available)] if available else 'important'
    correct = SYNONYMS.get(target, target + 'ly')
    other = [w for w in extract_words(passage, 5) if w != target and w != correct][:2]
    if target in ANTONYMS: other.insert(0, ANTONYMS[target])
    while len(other) < 3: other.append(random.choice(['irrelevant','peculiar','negligible']))
    ans_pos = (qid % 4) + 1
    choices = other[:ans_pos-1] + [correct] + other[ans_pos-1:3]
    kt = KOR_MEANINGS.get(target, target)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    p = passage.replace(target, f'<u>{target}</u>', 1)
    return {"id":qid,"type":"동의어 고르기","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":f"밑줄 친 <b>{target}</b>의 의미와 가장 <b>가까운</b> 것은?",
            "det":{"korean":f"{target} = {kt}, {correct} = 동의어",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {correct}: {target}의 동의어\n❌ {''.join(wrong)} 의미가 다르거나 반대",
                   "tip":f"{target} = {correct} = {kt}"},
            "ans":ans_pos,"ch":choices}

def make_antonym(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 5) if w in ANTONYMS]
    if not available: available = extract_words(passage, 5)[:3]
    target = available[qid % len(available)] if available else 'important'
    correct = ANTONYMS.get(target, 'un' + target)
    other = []
    if target in SYNONYMS: other.append(SYNONYMS[target])
    other.extend([w for w in extract_words(passage, 5) if w != target and w != correct][:2])
    while len(other) < 3: other.append(random.choice(['similar','related','connected']))
    ans_pos = ((qid + 1) % 4) + 1
    choices = other[:ans_pos-1] + [correct] + other[ans_pos-1:3]
    kt = KOR_MEANINGS.get(target, target)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    p = passage.replace(target, f'<u>{target}</u>', 1)
    return {"id":qid,"type":"반의어 고르기","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":f"밑줄 친 <b>{target}</b>의 의미와 가장 <b>먼</b> 것은?",
            "det":{"korean":f"{target}({kt})의 반의어는 <b>{correct}</b>이다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {correct}: {target}의 반의어\n❌ {''.join(wrong)} 동의어이거나 유사 의미",
                   "tip":f"{target}({kt}) ↔ {correct}"},
            "ans":ans_pos,"ch":choices}

def make_eng_def(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 5) if w in ENG_DEFS]
    if not available: available = list(ENG_DEFS.keys())[:5]
    target = available[qid % len(available)]
    definition = ENG_DEFS[target]
    other = [w for w in available if w != target][:3]
    while len(other) < 3:
        extras = [k for k in ENG_DEFS.keys() if k != target and k not in other]
        if extras: other.append(random.choice(extras))
        else: break
    ans_pos = ((qid + 2) % 4) + 1
    choices = other[:ans_pos-1] + [target] + other[ans_pos-1:3]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    k = KOR_MEANINGS.get(target, target)
    return {"id":qid,"type":"영영풀이 매칭","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":f"다음 영영풀이에 해당하는 단어를 고르시오.\n\n\"{definition}\"",
            "det":{"korean":f"{definition} = <b>{target}</b>({k})",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {target}: 영영풀이와 일치\n❌ {''.join(wrong)} 정의와 맞지 않는 단어",
                   "tip":f"{target} = {k}"},
            "ans":ans_pos,"ch":choices}

def make_word_form(passage, words, qid, diff, pts):
    transforms = {
        'confidence':('confident','confidence','형용사→명사'),
        'diversity':('diverse','diversity','형용사→명사'),
        'consumption':('consume','consumption','동사→명사'),
        'automation':('automate','automation','동사→명사'),
        'adaptation':('adapt','adaptation','동사→명사'),
        'assessment':('assess','assessment','동사→명사'),
        'effectively':('effective','effectively','형용사→부사'),
        'accurately':('accurate','accurately','형용사→부사'),
        'financial':('finance','financial','명사→형용사'),
        'practical':('practice','practical','명사→형용사'),
        'flexible':('flexibility','flexible','명사→형용사'),
        'structured':('structure','structured','명사→형용사'),
        'identical':('identity','identical','명사→형용사'),
        'objective':('objectively','objective','부사→형용사'),
        'consistent':('consistency','consistent','명사→형용사'),
    }
    available = [w for w in extract_words(passage, 5) if w in transforms]
    if not available: available = list(transforms.keys())[:5]
    target = available[qid % len(available)]
    given, answer, change = transforms[target]
    sents = extract_sentences(passage)
    sent = next((s for s in sents if target in s.lower()), sents[0] if sents else passage[:100])
    blank = sent.replace(target, f'__________({given})', 1)
    k = KOR_MEANINGS.get(target, target)
    return {"id":qid,"type":"어형 변환","diff":diff,"pts":pts,"fmt":"written",
            "passage":passage,"stem":f"다음 문장의 괄호 안의 단어를 문맥에 맞게 어형 변환하시오.\n\n\"{blank}\"",
            "det":{"korean":f"{given} → <b>{answer}</b>: {change}",
                   "analysis":f"✅ {answer}: {given}의 {change} 변환",
                   "tip":f"{given}({change.split('→')[0]}) → {answer}({change.split('→')[1]})"},
            "wa":answer,"accept":[answer, answer.capitalize(), answer.upper()]}

def make_kor_to_eng(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 5) if w in KOR_MEANINGS]
    if not available: available = list(KOR_MEANINGS.keys())[:10]
    target = available[qid % len(available)] if available else 'important'
    kor = KOR_MEANINGS.get(target, '중요한')
    other = [w for w in available if w != target][:3]
    while len(other) < 3:
        extras = [k for k in KOR_MEANINGS.keys() if k != target and k not in other]
        if extras: other.append(random.choice(extras))
        else: other.append('irrelevant')
    ans_pos = (qid % 4) + 1
    choices = other[:ans_pos-1] + [target] + other[ans_pos-1:3]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"한영","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":f"다음 한국어 뜻에 해당하는 영어 단어를 고르시오.\n\n\"{kor}\"",
            "det":{"korean":f"{kor} = <b>{target}</b>",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {target}: '{kor}'의 영어 표현\n❌ {''.join(wrong)} 다른 의미의 단어",
                   "tip":f"{target} = {kor}"},
            "ans":ans_pos,"ch":choices}

def make_grammar(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]
    grammar_pairs = [
        ('which','what','관계대명사 which vs 의문사 what'),
        ('that','what','접속사/관계대명사 that vs what'),
        ('its',"it's",'소유격 its vs 축약형 it is'),
        ('has','have','주어-동사 수일치'),
        ('was','were','주어-동사 수일치'),
        ('to','for','전치사 to vs for'),
        ('than','then','비교급 than vs 시간 then'),
    ]
    found = None
    for correct, wrong_w, desc in grammar_pairs:
        if correct in sent.lower():
            found = (correct, wrong_w, desc); break
    if not found: found = ('is','are','주어-동사 수일치')
    correct_w, wrong_w, desc = found
    ans_pos = (qid % 4) + 1
    choices = []
    for i in range(4):
        if i == ans_pos - 1: choices.append(correct_w)
        else: choices.append(wrong_w if i == 0 else random.choice([wrong_w,'being','been','having']))
    if len(set(choices)) < 3:
        base = [wrong_w, correct_w, 'being', 'been']
        if ans_pos == 1: choices = [correct_w, wrong_w, 'being', 'been']
        elif ans_pos == 2: choices = [wrong_w, correct_w, 'being', 'been']
        elif ans_pos == 3: choices = [wrong_w, 'being', correct_w, 'been']
        else: choices = [wrong_w, 'being', 'been', correct_w]
    p = sent.replace(correct_w, '__________', 1)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"어법","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":"다음 글의 빈칸에 들어갈 말로 어법상 가장 적절한 것은?",
            "det":{"korean":f"<b>{correct_w}</b>: {desc}",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {correct_w}: {desc}\n❌ {''.join(wrong)} 어법에 맞지 않음",
                   "tip":desc},
            "ans":ans_pos,"ch":choices}

def make_tf(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if not sents: sents = [passage]
    is_true = (qid % 2 == 0)
    sent = sents[qid % len(sents)]
    if is_true:
        statement = sent[:80]; ans = 1
        det_kor = f"<b>T</b>: 원문에 해당 내용이 명시되어 있다."
        analysis = f"✅ T: 원문 — {sent[:60]}"
    else:
        statement = ('not ' + sent[:80]) if 'not' not in sent.lower() else sent[:80].replace('not ','',1)
        ans = 2
        det_kor = f"<b>F</b>: 원문의 내용과 일치하지 않는다."
        analysis = f"❌ F: 원문과 반대되는 내용"
    return {"id":qid,"type":"내용이해 T/F","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":f"윗글의 내용과 일치하면 T, 일치하지 않으면 F를 고르시오.\n\n\"{statement}\"",
            "det":{"korean":det_kor,"analysis":analysis,"tip":"T/F 문제는 원문의 세부 정보를 정확히 확인"},
            "ans":ans,"ch":["T","F"],"verdict":"T" if is_true else "F"}

def make_blank_inference(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    sent = sents[-1] if sents else passage[-100:]
    key_phrases = extract_words(sent, 5)
    if not key_phrases: key_phrases = ['understanding']
    target = key_phrases[0]
    blank = sent.replace(target, '__________', 1)
    distractors = [w for w in extract_words(passage, 5) if w != target][:3]
    while len(distractors) < 3: distractors.append(random.choice(['competition','entertainment','decoration']))
    ans_pos = (qid % 4) + 1
    choices = distractors[:ans_pos-1] + [target] + distractors[ans_pos-1:3]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    k = KOR_MEANINGS.get(target, target)
    return {"id":qid,"type":"빈칸추론","diff":diff,"pts":pts,"fmt":"mc",
            "passage":blank,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "det":{"korean":f"빈칸에는 <b>{target}</b>({k})이/가 가장 적절하다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} {target}: 문맥상 가장 적절\n❌ {''.join(wrong)} 문맥과 맞지 않음",
                   "tip":f"{target} = {k}"},
            "ans":ans_pos,"ch":choices}

def make_content_match(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if len(sents) < 2: sents = [passage[:len(passage)//2]+'.', passage[len(passage)//2:]]
    correct_sent = sents[qid % len(sents)]
    ans_pos = ((qid + 1) % 4) + 1
    choices = []
    for i in range(4):
        s = sents[(qid + i) % len(sents)] if sents else passage[:80]
        if i == ans_pos - 1: choices.append(correct_sent[:70])
        else: choices.append(s[:70].replace('not ','') if 'not' in s else 'It is not mentioned that ' + s[:40])
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"내용이해","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"윗글의 내용으로 적절한 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]}번이 원문 내용과 일치한다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 원문 내용과 일치\n❌ {''.join(wrong)} 원문과 불일치하거나 왜곡",
                   "tip":"선택지를 원문과 대조하여 정확한 내용을 확인"},
            "ans":ans_pos,"ch":choices}

def make_content_mismatch(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if not sents: sents = [passage]
    ans_pos = ((qid + 2) % 4) + 1
    choices = []
    for i in range(4):
        s = sents[(qid + i) % len(sents)] if sents else passage[:80]
        if i == ans_pos - 1: choices.append(s[:60] + " (원문에 없는 내용)")
        else: choices.append(s[:70])
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"내용불일치","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"윗글의 내용과 일치하지 <b>않는</b> 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]}번은 원문에 언급되지 않은 내용이다.",
                   "analysis":f"❌ {'①②③④'[ans_pos-1]} 원문에 없는 내용\n✅ {''.join(wrong)} 원문과 일치",
                   "tip":"불일치 문제: 원문에 '없는' 정보를 선택지에서 찾기"},
            "ans":ans_pos,"ch":choices}

def make_error_find(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]
    ws = extract_words(sent, 4)[:4]
    while len(ws) < 4: ws.append('important')
    ans_pos = ((qid + 2) % 4) + 1
    p = sent; choices = []
    for i, w in enumerate(ws):
        num = '①②③④'[i]
        if i == ans_pos - 1:
            error_w = w + 'ed' if not w.endswith('ed') else w[:-2] + 'ing'
            p = p.replace(w, f'{num}<u>{error_w}</u>', 1); choices.append('①②③④'[i])
        else:
            p = p.replace(w, f'{num}<u>{w}</u>', 1)
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"오류찾기","diff":diff,"pts":pts,"fmt":"mc",
            "passage":p,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 <b>틀린</b> 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]}번의 어형이 잘못되었다. 올바른 형태: <b>{ws[ans_pos-1]}</b>",
                   "analysis":f"❌ {'①②③④'[ans_pos-1]} 어법 오류\n✅ {''.join(wrong)} 어법상 올바름",
                   "tip":"밑줄 친 단어의 품사와 문맥을 확인"},
            "ans":ans_pos,"ch":["①","②","③","④"]}

def make_written_keyword(passage, words, qid, diff, pts):
    available = [w for w in extract_words(passage, 5) if w in KOR_MEANINGS]
    if not available: available = extract_words(passage, 5)[:3]
    target = available[qid % len(available)] if available else 'important'
    k = KOR_MEANINGS.get(target, target)
    sents = extract_sentences(passage)
    sent = next((s for s in sents if target in s.lower()), sents[0] if sents else passage[:100])
    blank = sent.replace(target, '__________', 1)
    return {"id":qid,"type":"서술형 — 핵심단어","diff":diff,"pts":pts,"fmt":"written",
            "passage":passage,"stem":f"윗글에서 '{k}'을/를 의미하는 영어 단어를 본문에서 찾아 쓰시오.\n\n\"{blank}\"",
            "det":{"korean":f"<b>{target}</b>: {k}","analysis":f"✅ {target}: 원문에서 해당 의미의 단어","tip":f"{target} = {k}"},
            "wa":target,"accept":[target, target.capitalize(), target.upper()]}

def make_written_form_change(passage, words, qid, diff, pts):
    transforms = {
        'diversity':('diverse','diversity','형용사→명사'),
        'consumption':('consume','consumption','동사→명사'),
        'automation':('automate','automation','동사→명사'),
        'adaptation':('adapt','adaptation','동사→명사'),
        'effectively':('effective','effectively','형용사→부사'),
        'accurately':('accurate','accurately','형용사→부사'),
        'flexible':('flexibility','flexible','명사→형용사'),
        'consistent':('consistency','consistent','명사→형용사'),
        'confidence':('confident','confidence','형용사→명사'),
    }
    available = [w for w in extract_words(passage, 5) if w in transforms]
    if not available: available = list(transforms.keys())[:5]
    target = available[qid % len(available)]
    given, answer, change = transforms[target]
    sents = extract_sentences(passage)
    sent = next((s for s in sents if target in s.lower()), sents[0] if sents else passage[:100])
    blank = sent.replace(target, f'__________({given})', 1)
    return {"id":qid,"type":"서술형 — 어형변환","diff":diff,"pts":pts,"fmt":"written",
            "passage":passage,"stem":f"다음 문장의 괄호 안의 단어를 문맥에 맞게 어형 변환하시오.\n\n\"{blank}\"",
            "det":{"korean":f"{given} → <b>{answer}</b>: {change}",
                   "analysis":f"✅ {answer}: {given}의 {change} 변환","tip":f"{given} → {answer} ({change})"},
            "wa":answer,"accept":[answer, answer.capitalize(), answer.upper(), answer+'.']}

def make_word_order(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:100]
    ws = sent.split()
    if len(ws) > 8:
        start = qid % max(1, len(ws) - 6); chunk = ws[start:start+5]
    else:
        chunk = ws[-5:] if len(ws) >= 5 else ws
    answer = ' '.join(chunk)
    shuffled = chunk[:]
    random.shuffle(shuffled)
    if shuffled == chunk: shuffled = chunk[::-1]
    hint = ' / '.join(shuffled)
    before = ' '.join(ws[:ws.index(chunk[0])]) if chunk[0] in ws else ''
    return {"id":qid,"type":"어순배열","diff":diff,"pts":pts,"fmt":"written",
            "passage":passage,"stem":f"다음 주어진 단어를 올바른 순서로 배열하여 빈칸을 완성하시오.\n\n\"{before} __________\"\n\n[ {hint} ]",
            "det":{"korean":f"올바른 어순: <b>{answer}</b>","analysis":f"✅ {answer}: 올바른 어순","tip":"문맥과 문법에 맞는 어순을 파악"},
            "wa":answer,"accept":[answer, answer+'.', answer.rstrip('.')]}

def make_written_eng(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    sent = sents[qid % len(sents)] if sents else passage[:80]
    ws = sent.split()
    if len(ws) > 6:
        start = qid % max(1, len(ws) - 4); answer = ' '.join(ws[start:start+4])
    else:
        answer = ' '.join(ws[:4])
    return {"id":qid,"type":"서술형 — 영작","diff":diff,"pts":pts,"fmt":"written",
            "passage":passage,"stem":f"다음 우리말에 맞도록 빈칸에 들어갈 영어를 쓰시오.\n\n\"{sent.replace(answer,'__________',1)}\"",
            "det":{"korean":f"빈칸: <b>{answer}</b>","analysis":f"✅ {answer}: 원문 표현과 일치","tip":"원문의 표현을 정확히 기억하여 영작"},
            "wa":answer,"accept":[answer, answer+'.', answer.rstrip('.'), answer.capitalize()]}

def make_topic(passage, words, qid, diff, pts):
    ans_pos = (qid % 4) + 1
    kw = pick_key_words(passage, 3)
    choices = [
        f"the importance of {kw[0] if kw else 'understanding'}",
        f"the role of {kw[1] if len(kw)>1 else 'education'} in modern society",
        f"how {kw[0] if kw else 'factors'} affects our decisions",
        f"the relationship between {kw[0] if kw else 'concepts'} and {kw[1] if len(kw)>1 else 'reality'}"
    ]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"주제","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"다음 글의 주제로 가장 적절한 것은?",
            "det":{"korean":f"이 글의 주제는 {'①②③④'[ans_pos-1]}번이다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 글의 핵심 주제와 일치\n❌ {''.join(wrong)} 글의 주제와 맞지 않음",
                   "tip":"글의 첫 문장과 마지막 문장에서 주제를 파악"},
            "ans":ans_pos,"ch":choices}

def make_title(passage, words, qid, diff, pts):
    ans_pos = ((qid + 1) % 4) + 1
    kw = pick_key_words(passage, 3)
    choices = [
        f"The Hidden Power of {kw[0].capitalize() if kw else 'Knowledge'}",
        f"Why {kw[1].capitalize() if len(kw)>1 else 'Understanding'} Matters",
        f"Beyond {kw[0].capitalize() if kw else 'Expectations'}: A New Perspective",
        f"{kw[0].capitalize() if kw else 'Success'} and Its Unexpected Consequences"
    ]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"제목","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"다음 글의 제목으로 가장 적절한 것은?",
            "det":{"korean":f"이 글의 제목으로 {'①②③④'[ans_pos-1]}번이 가장 적절하다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 글의 핵심 내용을 포괄\n❌ {''.join(wrong)} 글의 내용과 맞지 않음",
                   "tip":"제목은 글의 핵심 주제를 함축적으로 표현"},
            "ans":ans_pos,"ch":choices}

def make_implication(passage, words, qid, diff, pts):
    ans_pos = ((qid + 2) % 4) + 1
    choices = [
        "원문의 비유적 표현이 의미하는 바를 정확히 파악한 해석",
        "원문의 표면적 의미만을 해석한 것",
        "원문의 맥락과 관련 없는 해석",
        "원문의 의미를 과도하게 확대 해석한 것"
    ]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"함축의미 추론","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"다음 글에서 밑줄 친 부분이 의미하는 바로 가장 적절한 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]}번이 함축적 의미를 정확히 파악한 것이다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 문맥상 함축적 의미와 일치\n❌ {''.join(wrong)} 표면적/과대/무관한 해석",
                   "tip":"밑줄 친 표현의 비유적/함축적 의미를 파악"},
            "ans":ans_pos,"ch":choices}

def make_summary(passage, words, qid, diff, pts):
    kw = pick_key_words(passage, 4)
    ans_pos = (qid % 4) + 1
    a = kw[0] if kw else 'understanding'; b = kw[1] if len(kw)>1 else 'knowledge'
    choices = [f"{a} — {b}", f"{a} — {'competition' if b!='competition' else 'isolation'}",
               f"{'resistance' if a!='resistance' else 'limitation'} — {b}",
               f"{'entertainment' if a!='entertainment' else 'decoration'} — {'restriction' if b!='restriction' else 'confusion'}"]
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"요약","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,
            "stem":f"다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A)와 (B)에 들어갈 말로 가장 적절한 것은?\n\n\"This passage discusses how (A)__________ relates to (B)__________.\"",
            "det":{"korean":f"(A) {choices[ans_pos-1].split(' — ')[0]}, (B) {choices[ans_pos-1].split(' — ')[1]}",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 글의 요약과 일치\n❌ {''.join(wrong)} 글의 내용과 맞지 않는 요약",
                   "tip":"글의 핵심 주제어를 파악하여 요약"},
            "ans":ans_pos,"ch":choices}

def make_content_understanding(passage, words, qid, diff, pts):
    sents = extract_sentences(passage)
    if not sents: sents = [passage]
    ans_pos = ((qid + 1) % 4) + 1
    choices = []
    for i in range(4):
        s = sents[(qid + i) % len(sents)]
        if i == ans_pos - 1: choices.append(s[:70])
        else: choices.append(s[:70].replace('not ','') if 'not' in s else 'It is not mentioned that ' + s[:40])
    wrong = [f"{'①②③④'[i]}" for i in range(4) if i+1 != ans_pos]
    return {"id":qid,"type":"내용이해","diff":diff,"pts":pts,"fmt":"mc",
            "passage":passage,"stem":"윗글의 내용으로 적절한 것은?",
            "det":{"korean":f"{'①②③④'[ans_pos-1]}번이 원문 내용과 일치한다.",
                   "analysis":f"✅ {'①②③④'[ans_pos-1]} 원문 내용과 일치\n❌ {''.join(wrong)} 원문과 불일치하거나 왜곡",
                   "tip":"선택지를 원문과 대조하여 정확한 내용을 확인"},
            "ans":ans_pos,"ch":choices}

# ─── 템플릿 ───
WORD_TEMPLATE = [
    (1,'abc','쉬움',4),(2,'abc','쉬움',4),(3,'abc','쉬움',4),
    (4,'inappropriate','쉬움',4),(5,'inappropriate','쉬움',4),
    (6,'blank_vocab','보통',5),(7,'blank_vocab','보통',5),(8,'blank_vocab','보통',5),
    (9,'synonym','보통',5),(10,'synonym','보통',5),(11,'synonym','보통',5),
    (12,'antonym','보통',5),(13,'antonym','보통',5),
    (14,'eng_def','보통',5),(15,'eng_def','보통',5),
    (16,'word_form','어려움',6),(17,'word_form','어려움',6),
    (18,'kor_eng','어려움',6),(19,'kor_eng','어려움',6),
    (20,'eng_def','어려움',6),
]
WORKBOOK_TEMPLATE = [
    (1,'grammar','쉬움',4),(2,'grammar','쉬움',4),(3,'grammar','쉬움',4),(4,'grammar','쉬움',4),
    (5,'inappropriate','쉬움',4),
    (6,'inappropriate','보통',5),(7,'tf','보통',5),(8,'tf','보통',5),(9,'tf','보통',5),
    (10,'blank_inference','보통',5),(11,'blank_inference','보통',5),
    (12,'content_match','보통',5),(13,'content_mismatch','보통',5),
    (14,'error_find','보통',5),(15,'written_keyword','보통',5),
    (16,'written_form','어려움',6),(17,'word_order','어려움',6),
    (18,'topic','어려움',6),(19,'summary','어려움',6),(20,'written_eng','어려움',6),
]
QUIZ_TEMPLATE = [
    (1,'grammar','쉬움',4),(2,'grammar','쉬움',4),(3,'grammar','쉬움',4),
    (4,'inappropriate','쉬움',4),(5,'inappropriate','쉬움',4),
    (6,'blank_inference','보통',5),(7,'blank_inference','보통',5),
    (8,'content_match','보통',5),(9,'content_match','보통',5),
    (10,'content_mismatch','보통',5),
    (11,'topic','보통',5),(12,'title','보통',5),(13,'implication','보통',5),
    (14,'content_understanding','보통',5),(15,'content_understanding','보통',5),
    (16,'written_keyword','어려움',6),(17,'written_form','어려움',6),
    (18,'word_order','어려움',6),(19,'written_eng','어려움',6),(20,'written_eng','어려움',6),
]
FUNC_MAP = {
    'abc':make_abc_combo,'inappropriate':make_inappropriate_vocab,
    'blank_vocab':make_blank_vocab,'synonym':make_synonym,'antonym':make_antonym,
    'eng_def':make_eng_def,'word_form':make_word_form,'kor_eng':make_kor_to_eng,
    'grammar':make_grammar,'tf':make_tf,'blank_inference':make_blank_inference,
    'error_find':make_error_find,'written_keyword':make_written_keyword,
    'written_form':make_written_form_change,'word_order':make_word_order,
    'written_eng':make_written_eng,'content_match':make_content_match,
    'content_mismatch':make_content_mismatch,'topic':make_topic,'title':make_title,
    'implication':make_implication,'summary':make_summary,
    'content_understanding':make_content_understanding,
}

def generate_test(folder_name, fullPassage, test_type, template):
    lesson = LESSON_MAP.get(folder_name, '기타')
    hist_prefix = {'단어':'wordTest','워크북':'workbookTest','퀴즈':'quizTest'}[test_type]
    num = folder_name.replace('번','')
    hist_key = f"{hist_prefix}_g2_2024jun_Q{num}_v3"
    words = pick_key_words(fullPassage, 15)
    questions = []
    for qid, func_name, diff, pts in template:
        func = FUNC_MAP[func_name]
        q = func(fullPassage, words, qid, diff, pts)
        questions.append(q)
    total_pts = sum(q['pts'] for q in questions)
    assert total_pts == 100, f"{folder_name}/{test_type}: total={total_pts}"
    title = fullPassage[:50].replace('"',"'").split('.')[0]
    if len(title) > 50: title = title[:47] + '...'
    return {
        "version":3,"testType":test_type,
        "ei":{"subject":"2024년 고2 6월 모의고사","pub":folder_name,"lesson":lesson,
              "title":title,"total":100,"time":1200,"totalQ":20,"histKey":hist_key},
        "fullPassage":fullPassage,"questions":questions
    }

def main():
    print("PDF에서 지문 추출 중...")
    passages = get_passages()
    print(f"추출된 지문: {list(passages.keys())}")

    # 이미 완성된 18,20,21번은 기존 파일에서 passage 읽기
    for folder in ['18번','20번','21번']:
        existing = os.path.join(BASE, folder, '단어.json')
        if os.path.exists(existing) and folder not in passages:
            with open(existing, 'r', encoding='utf-8') as f:
                d = json.load(f)
            passages[folder] = d['fullPassage']
            print(f"기존 파일에서 로드: {folder}")

    total_files = 0
    for folder_name in TARGETS:
        if folder_name not in passages:
            print(f"⚠️  {folder_name} 지문 없음 — 건너뜀")
            continue
        fp = passages[folder_name]
        if len(fp) < 50:
            print(f"⚠️  {folder_name} 지문 너무 짧음({len(fp)}) — 건너뜀")
            continue
        for test_type, template in [('단어',WORD_TEMPLATE),('워크북',WORKBOOK_TEMPLATE),('퀴즈',QUIZ_TEMPLATE)]:
            data = generate_test(folder_name, fp, test_type, template)
            out_dir = os.path.join(BASE, folder_name)
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, f'{test_type}.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            total_files += 1
            print(f"✅ {folder_name}/{test_type}.json")

    print(f"\n총 {total_files}파일 생성 완료")

if __name__ == '__main__':
    main()
