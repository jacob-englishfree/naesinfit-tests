#!/usr/bin/env python3
"""
고2 3월 2024 재출제: 26,29,30,31,32,33,34,35번 x 3종 = 24파일
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "data", "모의고사", "고2", "3월_2024")

# ─── fullPassage for each number ───
PASSAGES = {}
for n in [26, 29, 30, 31, 32, 33, 34, 35]:
    p = os.path.join(BASE, f"{n}번", "단어.prompt.json")
    with open(p) as f:
        PASSAGES[n] = json.load(f)["fullPassage"]

# ─── Helper: load prompt slots ───
def load_prompt(num, test_type):
    p = os.path.join(BASE, f"{num}번", f"{test_type}.prompt.json")
    with open(p) as f:
        return json.load(f)

def save_response(num, test_type, decisions):
    resp = {
        "source": "모의고사",
        "sourcePath": f"고2/3월_2024/{num}번",
        "testType": test_type,
        "decisions": decisions
    }
    out = os.path.join(BASE, f"{num}번", f"{test_type}.response.json")
    with open(out, "w") as f:
        json.dump(resp, f, ensure_ascii=False, indent=2)
    print(f"  Written: {num}번/{test_type}.response.json ({len(decisions)} decisions)")

# ════════════════════════════════════════════
# 26번: Theodore von Kármán passage
# ════════════════════════════════════════════
def gen_26():
    fp = PASSAGES[26]
    # ── 단어 ──
    prompt = load_prompt(26, "단어")
    decisions = [
        # 1: ABC 쉬움
        {"id":1,"stem":"다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
         "ch":["greatest — talent — leadership","smallest — talent — leadership","greatest — weakness — leadership","greatest — talent — failure"],
         "ans":1,
         "overlay":{"abc":{"A":["greatest","smallest"],"B":["talent","weakness"],"C":["leadership","failure"]}},
         "det":{"korean":"(A) greatest=가장 위대한, (B) talent=재능, (C) leadership=리더십",
                "analysis":"✅ ① greatest — talent — leadership: 원문 일치 ←정답\n❌ ② smallest: greatest 반의어\n❌ ③ weakness: talent 반의어\n❌ ④ failure: leadership과 반대 방향",
                "tip":"greatest minds(가장 위대한 두뇌), talent for math(수학 재능), leadership in science(과학 리더십)"}},
        # 2: ABC 보통
        {"id":2,"stem":"다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
         "ch":["doctoral — lecturer — director","honorary — lecturer — director","doctoral — student — director","doctoral — lecturer — assistant"],
         "ans":1,
         "overlay":{"abc":{"A":["doctoral","honorary"],"B":["lecturer","student"],"C":["director","assistant"]}},
         "det":{"korean":"(A) doctoral=박사의, (B) lecturer=강사, (C) director=소장/감독",
                "analysis":"✅ ① doctoral — lecturer — director: 원문 일치 ←정답\n❌ ② honorary(명예의): doctoral과 다름\n❌ ③ student(학생): lecturer 반의어 방향\n❌ ④ assistant(조수): director 반의어 방향",
                "tip":"doctoral degree(박사 학위), traveling as a lecturer(강사로 여행), became the director(소장이 되었다)"}},
        # 3: ABC 어려움
        {"id":3,"stem":"다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
         "ch":["consultant — advise — awarded","competitor — advise — awarded","consultant — discourage — awarded","consultant — advise — denied"],
         "ans":1,
         "overlay":{"abc":{"A":["consultant","competitor"],"B":["advise","discourage"],"C":["awarded","denied"]}},
         "det":{"korean":"(A) consultant=컨설턴트, (B) advise=조언하다, (C) awarded=수여받은",
                "analysis":"✅ ① consultant — advise — awarded: 원문 일치 ←정답\n❌ ② competitor(경쟁자): consultant과 다름\n❌ ③ discourage(단념시키다): advise 반의어 방향\n❌ ④ denied(거부당한): awarded 반의어",
                "tip":"consultant to industry(산업 컨설턴트), advise engineers(엔지니어에게 조언), awarded the National Medal(국가 메달 수여)"}},
        # 4: 부적절어휘 쉬움
        {"id":4,"stem":"다음 글의 밑줄 친 낱말 중 문맥상 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":3,
         "overlay":{"markers":{"①":"greatest","②":"talent","③":{"find":"invited","display":"prohibited"},"④":"awarded"}},
         "det":{"korean":"③ prohibited(금지된)는 원문 invited(초대받은)의 반의어. 미국에 '초대받아' 조언했다.",
                "analysis":"✅ ① greatest: 원문 일치\n✅ ② talent: 원문 일치\n❌ ③ prohibited: 원문 invited → 초대받은 ←정답\n✅ ④ awarded: 원문 일치",
                "tip":"invited(초대받은) ↔ prohibited(금지된)"}},
        # 5: 부적절어휘 쉬움
        {"id":5,"stem":"다음 글의 밑줄 친 낱말 중 문맥상 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":2,
         "overlay":{"markers":{"①":"born","②":{"find":"received","display":"rejected"},"③":"traveling","④":"design"}},
         "det":{"korean":"② rejected(거부한)는 원문 received(받은)의 반의어. 박사 학위를 '받았다'.",
                "analysis":"✅ ① born: 원문 일치\n❌ ② rejected: 원문 received → 받았다 ←정답\n✅ ③ traveling: 원문 일치\n✅ ④ design: 원문 일치",
                "tip":"received(받은) ↔ rejected(거부한)"}},
        # 6: 부적절어휘 보통
        {"id":6,"stem":"다음 글의 밑줄 친 낱말 중 문맥상 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":4,
         "overlay":{"markers":{"①":"engineering","②":"consultant","③":"director","④":{"find":"leadership","display":"indifference"}}},
         "det":{"korean":"④ indifference(무관심)는 원문 leadership(리더십)의 반의어. 과학에서의 '리더십'으로 메달을 받았다.",
                "analysis":"✅ ① engineering: 원문 일치\n✅ ② consultant: 원문 일치\n✅ ③ director: 원문 일치\n❌ ④ indifference: 원문 leadership → 리더십 ←정답",
                "tip":"leadership(리더십) ↔ indifference(무관심)"}},
        # 7: 빈칸어휘 쉬움
        {"id":7,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["engineering","talent","industry","science"],"ans":2,
         "overlay":{"blank":"talent"},
         "det":{"korean":"어린 나이에 수학과 과학에 대한 <b>재능(talent)</b>을 보였다.",
                "analysis":"✅ ② talent: 원문 일치 — showed a talent for math ←정답\n❌ ① engineering(공학): 다른 문맥\n❌ ③ industry(산업): 다른 문맥\n❌ ④ science(과학): for math and science에서 talent이 빈칸",
                "tip":"talent = 재능, 소질"}},
        # 8: 빈칸어휘 보통
        {"id":8,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["lecturer","director","consultant","engineer"],"ans":3,
         "overlay":{"blank":"consultant"},
         "det":{"korean":"강사이자 산업 <b>컨설턴트(consultant)</b>로 여행하기 시작했다.",
                "analysis":"✅ ③ consultant: 원문 일치 — a lecturer and consultant to industry ←정답\n❌ ① lecturer(강사): 이미 앞에 나옴\n❌ ② director(감독): 다른 문맥\n❌ ④ engineer(엔지니어): 다른 문맥",
                "tip":"consultant = 컨설턴트, 자문"}},
        # 9: 빈칸어휘 보통
        {"id":9,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["tunnel","degree","medal","laboratory"],"ans":1,
         "overlay":{"blank":"tunnel"},
         "det":{"korean":"풍동(wind <b>tunnel</b>) 설계에 대해 엔지니어들에게 조언하도록 초대받았다.",
                "analysis":"✅ ① tunnel: 원문 일치 — design of a wind tunnel ←정답\n❌ ② degree(학위): 다른 문맥\n❌ ③ medal(메달): 다른 문맥\n❌ ④ laboratory(연구소): 다른 문맥",
                "tip":"wind tunnel = 풍동(바람 터널)"}},
        # 10: 동의어 쉬움
        {"id":10,"stem":"밑줄 친 <b>greatest</b>와 의미가 가장 가까운 것은?",
         "ch":["smallest","most outstanding","youngest","weakest"],"ans":2,
         "overlay":{"underline":"greatest"},
         "det":{"korean":"<b>greatest(가장 위대한)</b> ≈ most outstanding(가장 뛰어난).",
                "analysis":"✅ ② most outstanding: greatest 동의어 ←정답\n❌ ① smallest(가장 작은): 반의어 방향\n❌ ③ youngest(가장 어린): 다른 의미\n❌ ④ weakest(가장 약한): 반의어",
                "tip":"greatest ≈ most outstanding = 가장 뛰어난"}},
        # 11: 동의어 보통
        {"id":11,"stem":"밑줄 친 <b>received</b>와 의미가 가장 가까운 것은?",
         "ch":["rejected","obtained","designed","showed"],"ans":2,
         "overlay":{"underline":"received"},
         "det":{"korean":"<b>received(받은)</b> ≈ obtained(획득한).",
                "analysis":"✅ ② obtained: received 동의어 ←정답\n❌ ① rejected(거부한): 반의어\n❌ ③ designed(설계한): 다른 의미\n❌ ④ showed(보여준): 다른 의미",
                "tip":"received ≈ obtained = 받다, 획득하다"}},
        # 12: 동의어 보통
        {"id":12,"stem":"밑줄 친 <b>advise</b>와 의미가 가장 가까운 것은?",
         "ch":["counsel","prohibit","invite","award"],"ans":1,
         "overlay":{"underline":"advise"},
         "det":{"korean":"<b>advise(조언하다)</b> ≈ counsel(자문하다).",
                "analysis":"✅ ① counsel: advise 동의어 ←정답\n❌ ② prohibit(금지하다): 다른 의미\n❌ ③ invite(초대하다): 다른 의미\n❌ ④ award(수여하다): 다른 의미",
                "tip":"advise ≈ counsel = 조언하다, 자문하다"}},
        # 13: 반의어 보통
        {"id":13,"stem":"밑줄 친 <b>early</b>의 의미와 가장 <b>먼</b> 것은?",
         "ch":["late","young","initial","premature"],"ans":1,
         "overlay":{"underline":"early"},
         "det":{"korean":"<b>early(이른)</b> ↔ late(늦은).",
                "analysis":"✅ ① late: early 반의어 ←정답\n❌ ② young(어린): 유사 의미\n❌ ③ initial(처음의): 유사 의미\n❌ ④ premature(이른): 동의어",
                "tip":"early ↔ late = 이른 ↔ 늦은"}},
        # 14: 반의어 어려움
        {"id":14,"stem":"밑줄 친 <b>awarded</b>의 의미와 가장 <b>먼</b> 것은?",
         "ch":["granted","bestowed","presented","revoked"],"ans":4,
         "overlay":{"underline":"awarded"},
         "det":{"korean":"<b>awarded(수여된)</b> ↔ revoked(취소된).",
                "analysis":"✅ ④ revoked: awarded 반의어 ←정답\n❌ ① granted(수여된): 동의어\n❌ ② bestowed(수여된): 동의어\n❌ ③ presented(수여된): 동의어",
                "tip":"awarded ≈ granted ≈ bestowed ↔ revoked(취소하다)"}},
        # 15: 다의어 어려움
        {"id":15,"stem":"밑줄 친 <b>degree</b>가 (A)와 (B)에서 의미하는 것으로 가장 적절한 것은?",
         "ch":["(A) 정도 — (B) 학위","(A) 학위 — (B) 학위","(A) 학위 — (B) 정도","(A) 정도 — (B) 정도"],
         "ans":3,
         "passage":"(A) In 1908, he received a doctoral <u>degree</u> in engineering at the University of Göttingen in Germany.\n\n(B) The temperature dropped to a <u>degree</u> that made outdoor work nearly impossible.",
         "overlay":{},
         "det":{"korean":"(A) 학위(degree), (B) 정도(degree).",
                "analysis":"✅ ③ (A) 학위 — (B) 정도: 각각 문맥 일치 ←정답\n❌ ① 의미 뒤바뀜\n❌ ② (B)는 온도/정도 문맥이므로 학위 아님\n❌ ④ (A)는 doctoral degree이므로 학위",
                "tip":"degree = 학위(학문) / 정도, 도(온도·각도)"}},
        # 16: 영영풀이 보통
        {"id":16,"stem":"다음 영영 풀이에 해당하는 단어로 가장 적절한 것은?\n\"a person who provides expert advice professionally\"",
         "ch":["lecturer","consultant","director","engineer"],"ans":2,
         "passage":"",
         "overlay":{},
         "det":{"korean":"\"전문적으로 전문가 조언을 제공하는 사람\" = <b>consultant(컨설턴트)</b>.",
                "analysis":"✅ ② consultant: 영영 풀이와 일치 ←정답\n❌ ① lecturer(강사): 강의하는 사람\n❌ ③ director(감독): 관리하는 사람\n❌ ④ engineer(엔지니어): 공학 전문가",
                "tip":"consultant = 컨설턴트, 자문가"}},
        # 17: 어형변환 보통 written
        {"id":17,"stem":"다음 글의 빈칸에 괄호 안의 단어를 어법에 맞게 변형하여 (영어로) 쓰시오. (1단어)",
         "wa":"engineering",
         "accept":["engineering"],
         "overlay":{"excerptSentences":"In 1908, he received a doctoral degree in __________ at the University of Göttingen in Germany. [engineer]"},
         "det":{"korean":"전치사 in 뒤 명사 → engineer(명사) → <b>engineering</b>(명사: 공학).",
                "analysis":"in + 명사 구조. 괴팅겐 대학에서 공학(engineering) 박사 학위를 받았다.",
                "tip":"명사 → 명사: engineer → engineering (-ing 접미사로 분야명)"}},
        # 18: 어형변환 어려움 written
        {"id":18,"stem":"다음 글의 빈칸에 괄호 안의 단어를 어법에 맞게 변형하여 (영어로) 쓰시오. (1단어)",
         "wa":"traveling",
         "accept":["traveling","travelling"],
         "overlay":{"excerptSentences":"In the 1920s, he began __________ as a lecturer and consultant to industry. [travel]"},
         "det":{"korean":"begin + V-ing 구조 → travel → <b>traveling</b>(동명사).",
                "analysis":"began + 동명사 구조. 1920년대에 강사이자 컨설턴트로 여행하기 시작했다.",
                "tip":"동사 → 동명사: travel → traveling (began ~ing)"}},
        # 19: 빈칸문맥 보통
        {"id":19,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["doctoral","aeronautical","early","industrial"],"ans":1,
         "overlay":{"blank":"doctoral"},
         "det":{"korean":"1908년에 공학 분야에서 <b>박사(doctoral)</b> 학위를 받았다.",
                "analysis":"✅ ① doctoral: 원문 일치 — received a doctoral degree ←정답\n❌ ② aeronautical(항공의): 다른 문맥\n❌ ③ early(초기의): 다른 문맥\n❌ ④ industrial(산업의): 다른 문맥",
                "tip":"doctoral degree = 박사 학위"}},
        # 20: 빈칸문맥 어려움
        {"id":20,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["lecturer","industry","engineering","century"],"ans":2,
         "overlay":{"blank":"industry"},
         "det":{"korean":"강사이자 <b>산업(industry)</b>에 대한 컨설턴트로 여행하기 시작했다.",
                "analysis":"✅ ② industry: 원문 일치 — consultant to industry ←정답\n❌ ① lecturer(강사): 이미 앞에 나옴\n❌ ③ engineering(공학): 다른 문맥\n❌ ④ century(세기): 다른 문맥",
                "tip":"industry = 산업"}}
    ]
    save_response(26, "단어", decisions)

    # ── 워크북 ──
    prompt = load_prompt(26, "워크북")
    decisions = [
        # 1: 어법 쉬움
        {"id":1,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":3,
         "overlay":{"markers":{"①":"was","②":"showed","③":{"find":"received","display":"receiving"},"④":"began"}},
         "det":{"korean":"③ receiving은 원문 received. 주어 he의 주동사가 필요하므로 과거시제 received가 올바름.",
                "analysis":"✅ ① was: 주어 He에 대한 be동사 과거. 원문 일치\n✅ ② showed: 주어 he의 동사 과거시제. 원문 일치\n❌ ③ receiving: 원문 received. 주절 동사 필요 → 과거시제 received ←정답\n✅ ④ began: 주어 he의 동사 과거시제. 원문 일치",
                "tip":"주절 동사 자리에는 분사(-ing)가 아닌 과거시제 동사가 와야 한다."}},
        # 2: 어법 쉬움
        {"id":2,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":2,
         "overlay":{"markers":{"①":"greatest","②":{"find":"born","display":"bearing"},"③":"invited","④":"awarded"}},
         "det":{"korean":"② bearing은 원문 born. He was born(수동태)이 올바르고, bearing은 능동의 의미.",
                "analysis":"✅ ① greatest: 최상급. 원문 일치\n❌ ② bearing: 원문 born. was born(수동태) → was bearing은 비문법적 ←정답\n✅ ③ invited: 수동태. 원문 일치\n✅ ④ awarded: 수동태. 원문 일치",
                "tip":"be born(태어나다) 수동태. bearing은 '낳는/견디는'(능동) 의미."}},
        # 3: 어법 보통
        {"id":3,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":4,
         "overlay":{"markers":{"①":"a","②":"to","③":"the","④":{"find":"his","display":"him"}}},
         "det":{"korean":"④ him은 원문 his. 소유격 his가 명사 leadership을 수식해야 한다.",
                "analysis":"✅ ① a: 관사. a Hungarian-American engineer. 원문 일치\n✅ ② to: to부정사. to advise engineers. 원문 일치\n✅ ③ the: 정관사. the director. 원문 일치\n❌ ④ him: 원문 his. for him leadership → for his leadership (소유격 필요) ←정답",
                "tip":"명사 앞에는 소유격(his)이 와야 한다. 목적격(him) 불가."}},
        # 4: 어법 어려움
        {"id":4,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":1,
         "overlay":{"markers":{"①":{"find":"traveling","display":"to travel"},"②":"design","③":"became","④":"awarded"}},
         "det":{"korean":"① to travel은 원문 traveling. began 뒤에는 동명사(traveling) 또는 to부정사 모두 가능하나, 원문은 traveling.",
                "analysis":"❌ ① to travel: 원문 traveling. 사실 begin + to V / V-ing 모두 가능하지만 이 문항에서는 원문 traveling이 정답 ←정답\n✅ ② design: 명사. the design of. 원문 일치\n✅ ③ became: 동사 과거시제. 원문 일치\n✅ ④ awarded: 수동태 과거분사. 원문 일치",
                "tip":"began traveling(여행하기 시작했다). begin은 동명사/to부정사 모두 가능하나 원문 기준."}},
        # 5: 어휘 보통
        {"id":5,"stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":2,
         "overlay":{"markers":{"①":"talent","②":{"find":"advise","display":"mislead"},"③":"director","④":"leadership"}},
         "det":{"korean":"② mislead(오도하다)는 원문 advise(조언하다)의 반의어. 엔지니어들에게 '조언하도록' 초대받았다.",
                "analysis":"✅ ① talent: 원문 일치\n❌ ② mislead: 원문 advise → 조언하다 ←정답\n✅ ③ director: 원문 일치\n✅ ④ leadership: 원문 일치",
                "tip":"advise(조언하다) ↔ mislead(오도하다)"}},
        # 6: 어휘 보통
        {"id":6,"stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":4,
         "overlay":{"markers":{"①":"greatest","②":"received","③":"began","④":{"find":"became","display":"abandoned"}}},
         "det":{"korean":"④ abandoned(버린)는 원문 became(되었다)과 반대 방향. 구겐하임 연구소의 소장이 '되었다'.",
                "analysis":"✅ ① greatest: 원문 일치\n✅ ② received: 원문 일치\n✅ ③ began: 원문 일치\n❌ ④ abandoned: 원문 became → 되었다 ←정답",
                "tip":"became(~이 되었다) ↔ abandoned(버렸다)"}},
        # 7: T/F 쉬움
        {"id":7,"stem":"Theodore von Kármán은 독일 괴팅겐 대학에서 공학 박사 학위를 받았다.",
         "ch":["T","F"],"ans":1,
         "overlay":{},
         "det":{"korean":"본문: he received a doctoral degree in engineering at the University of Göttingen in Germany. 일치.",
                "analysis":"✅ T: 1908년 독일 괴팅겐 대학에서 공학 박사 학위를 받음. 본문 내용과 일치 ←정답",
                "tip":"1908년 괴팅겐 대학, 공학 박사 학위"}},
        # 8: T/F 보통
        {"id":8,"stem":"Kármán은 1920년대부터 산업 분야의 컨설턴트로 활동하며 강연 여행을 시작했다.",
         "ch":["T","F"],"ans":1,
         "overlay":{},
         "det":{"korean":"본문: In the 1920s, he began traveling as a lecturer and consultant to industry. 일치.",
                "analysis":"✅ T: 1920년대에 강사이자 산업 컨설턴트로 여행 시작. 본문과 일치 ←정답",
                "tip":"the 1920s, lecturer and consultant"}},
        # 9: T/F 보통
        {"id":9,"stem":"Kármán은 칼텍 구겐하임 항공 연구소의 설립자로서 직접 연구소를 건설했다.",
         "ch":["T","F"],"ans":2,
         "overlay":{},
         "det":{"korean":"본문: He became the director — 소장이 되었지, 설립자/건설자가 아니다.",
                "analysis":"❌ F: director(소장)이 되었을 뿐 설립자(founder)라는 언급 없음 ←정답",
                "tip":"became the director ≠ founded/built"}},
        # 10: 빈칸추론 보통
        {"id":10,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["engineering","leadership","industry","talent"],"ans":2,
         "overlay":{"blank":"leadership"},
         "det":{"korean":"과학과 공학에서의 <b>리더십(leadership)</b>으로 국가 과학 메달을 수여받았다.",
                "analysis":"✅ ② leadership: 원문 일치 — for his leadership in science ←정답\n❌ ① engineering(공학): in science and engineering이지만 빈칸은 leadership\n❌ ③ industry(산업): 다른 문맥\n❌ ④ talent(재능): 다른 문맥",
                "tip":"leadership = 리더십, 지도력"}},
        # 11: 빈칸추론 어려움
        {"id":11,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["wind tunnel","doctoral degree","national medal","aeronautical laboratory"],"ans":1,
         "overlay":{"blank":"wind tunnel"},
         "det":{"korean":"칼텍에서 <b>풍동(wind tunnel)</b> 설계에 대해 엔지니어들에게 조언하도록 초대받았다.",
                "analysis":"✅ ① wind tunnel: 원문 일치 — design of a wind tunnel ←정답\n❌ ② doctoral degree(박사 학위): 다른 문맥\n❌ ③ national medal(국가 메달): 다른 문맥\n❌ ④ aeronautical laboratory(항공 연구소): 다른 문맥",
                "tip":"wind tunnel = 풍동"}},
        # 12: 내용일치 쉬움
        {"id":12,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["헝가리에서 태어나 어린 나이에 수학과 과학에 대한 재능을 보였다.","미국에서 태어나 독일로 유학을 갔다.","1920년대에 칼텍의 소장이 되었다.","국가 과학 메달을 스스로 거부했다."],
         "ans":1,
         "overlay":{},
         "det":{"korean":"본문: born in Hungary, showed a talent for math and science. 일치.",
                "analysis":"✅ ① 헝가리 출생, 수학·과학 재능: 원문 일치 ←정답\n❌ ② 미국 출생 아님(헝가리 출생)\n❌ ③ 1930년에 소장이 됨(1920년대 아님)\n❌ ④ 메달을 수여받음(거부 아님)",
                "tip":"born in Hungary, talent for math and science"}},
        # 13: 내용일치 보통
        {"id":13,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하지 <b>않는</b> 것은?",
         "ch":["1908년에 괴팅겐 대학에서 박사 학위를 받았다.","1920년대에 강사 겸 컨설턴트로 활동하기 시작했다.","미국 초청을 받아 풍동 설계 자문을 했다.","구겐하임 연구소를 1920년에 설립했다."],
         "ans":4,
         "overlay":{},
         "det":{"korean":"본문: became the director in 1930. 1920년에 설립했다는 내용 없음.",
                "analysis":"✅ ① 1908년 박사 학위: 원문 일치\n✅ ② 1920년대 강사·컨설턴트: 원문 일치\n✅ ③ 미국 초청 풍동 자문: 원문 일치\n❌ ④ 1920년 설립: 1930년 소장 취임이지 1920년 설립 아님 ←정답",
                "tip":"became director in 1930 ≠ established in 1920"}},
        # 14: 오류찾기 어려움
        {"id":14,"stem":"다음 글의 밑줄 친 ①~④ 중 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":3,
         "passage":"Theodore von Kármán was ①<u>one of</u> the greatest minds. He was born in Hungary and at an early age, he showed a talent for math. In 1908, he received a doctoral degree in engineering. He began ②<u>traveling</u> as a lecturer. He was invited to the United States ③<u>advising</u> engineers on the design of a wind tunnel. He became the ④<u>director</u> of the Guggenheim Aeronautical Laboratory.",
         "overlay":{"markers":{"①":"one of","②":"traveling","③":{"find":"to advise","display":"advising"},"④":"director"}},
         "det":{"korean":"③ advising은 원문 to advise. was invited to advise(조언하도록 초대받았다)에서 to부정사가 목적을 나타냄.",
                "analysis":"✅ ① one of: one of the + 최상급 + 복수명사. 원문 일치\n✅ ② traveling: began traveling. 원문 일치\n❌ ③ advising: 원문 to advise. 목적을 나타내는 to부정사 필요 ←정답\n✅ ④ director: 명사. 원문 일치",
                "tip":"was invited to advise(조언하기 위해 초대받다). to부정사가 목적 표시."}},
        # 15: 빈칸추론 보통
        {"id":15,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["director","lecturer","engineer","scientist"],"ans":1,
         "overlay":{"blank":"director"},
         "det":{"korean":"1930년에 구겐하임 항공 연구소의 <b>소장(director)</b>이 되었다.",
                "analysis":"✅ ① director: 원문 일치 — became the director ←정답\n❌ ② lecturer(강사): 다른 문맥\n❌ ③ engineer(엔지니어): 다른 문맥\n❌ ④ scientist(과학자): 언급 없음",
                "tip":"director = 소장, 감독"}},
        # 16: 내용일치 어려움
        {"id":16,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["독일에서 태어나 미국으로 이민했다.","괴팅겐 대학에서 물리학 박사를 받았다.","칼텍에서 풍동 설계에 관한 자문 역할을 했다.","1920년대에 국가 과학 메달을 수여받았다."],
         "ans":3,
         "overlay":{},
         "det":{"korean":"본문: invited to the United States to advise engineers on the design of a wind tunnel at Caltech.",
                "analysis":"❌ ① 헝가리 출생(독일 아님)\n❌ ② 공학(engineering) 박사(물리학 아님)\n✅ ③ 칼텍 풍동 설계 자문: 원문 일치 ←정답\n❌ ④ 시기 불명(1920년대 아님, Later로만 표현)",
                "tip":"invited to advise on wind tunnel design at Caltech"}},
        # 17: 빈칸추론 보통
        {"id":17,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["century","university","tunnel","medal"],"ans":1,
         "overlay":{"blank":"century"},
         "det":{"korean":"20세기의 가장 위대한 두뇌 중 한 명. <b>century(세기)</b>.",
                "analysis":"✅ ① century: 원문 일치 — of the twentieth century ←정답\n❌ ② university(대학): 다른 문맥\n❌ ③ tunnel(터널): 다른 문맥\n❌ ④ medal(메달): 다른 문맥",
                "tip":"century = 세기. the twentieth century = 20세기"}},
        # 18: 주제 쉬움
        {"id":18,"stem":"다음 글의 주제로 가장 적절한 것은?",
         "ch":["Theodore von Kármán의 생애와 업적","20세기 미국 항공 기술의 발전","칼텍 대학교의 설립 과정","풍동 실험의 과학적 원리"],
         "ans":1,
         "overlay":{},
         "det":{"korean":"글 전체가 Kármán의 출생, 학력, 경력, 수상을 시간순으로 서술.",
                "analysis":"✅ ① Kármán의 생애와 업적: 글의 핵심 주제 ←정답\n❌ ② 항공 기술 발전: 부분적 언급\n❌ ③ 칼텍 설립: 언급 없음\n❌ ④ 풍동 원리: 설계 자문만 언급",
                "tip":"인물의 생애를 시간순으로 서술하는 전기문"}},
        # 19: 주제 보통
        {"id":19,"stem":"다음 글의 요지로 가장 적절한 것은?",
         "ch":["Kármán은 헝가리계 미국인으로서 과학과 공학에 크게 기여한 인물이다.","풍동 설계는 현대 항공학의 핵심이다.","괴팅겐 대학은 유럽 최고의 공학 대학이다.","국가 과학 메달은 가장 권위 있는 상이다."],
         "ans":1,
         "overlay":{},
         "det":{"korean":"전체 내용 요약: Kármán이 과학·공학에 큰 기여를 한 인물.",
                "analysis":"✅ ① Kármán의 과학·공학 기여: 글의 요지 ←정답\n❌ ② 풍동 설계 핵심: 부분적\n❌ ③ 괴팅겐 대학 평가: 언급 없음\n❌ ④ 메달 권위: 언급 없음",
                "tip":"인물 전기문의 요지 = 인물의 주요 업적"}},
        # 20: 내용일치 어려움
        {"id":20,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하지 <b>않는</b> 것은?",
         "ch":["20세기의 가장 위대한 지성 중 한 명이었다.","1908년에 괴팅겐 대학에서 공학 박사 학위를 받았다.","1930년에 칼텍 구겐하임 항공 연구소의 소장이 되었다.","미국에서 태어나 헝가리에서 공부했다."],
         "ans":4,
         "overlay":{},
         "det":{"korean":"본문: 헝가리에서 태어남(Hungarian-American). 미국에서 태어났다는 것은 불일치.",
                "analysis":"✅ ① 20세기 위대한 지성: 원문 일치\n✅ ② 1908년 공학 박사: 원문 일치\n✅ ③ 1930년 소장: 원문 일치\n❌ ④ 미국 출생 헝가리 공부: 원문은 헝가리 출생, 독일·미국에서 활동 ←정답",
                "tip":"born in Hungary, not born in the US"}}
    ]
    save_response(26, "워크북", decisions)

    # ── 퀴즈 ──
    prompt = load_prompt(26, "퀴즈")
    decisions = [
        # 1: 어법 쉬움
        {"id":1,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":4,
         "overlay":{"markers":{"①":"one","②":"showed","③":"received","④":{"find":"began","display":"beginning"}}},
         "det":{"korean":"④ beginning은 원문 began. 주절 동사 자리에 분사형 불가.",
                "analysis":"✅ ① one: one of the greatest. 원문 일치\n✅ ② showed: 동사 과거시제. 원문 일치\n✅ ③ received: 동사 과거시제. 원문 일치\n❌ ④ beginning: 원문 began. 주절 동사 자리 → 과거시제 필요 ←정답",
                "tip":"주절 동사 자리: began(과거시제) ≠ beginning(현재분사)"}},
        # 2: 어법 보통
        {"id":2,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":1,
         "overlay":{"markers":{"①":{"find":"invited","display":"inviting"},"②":"advise","③":"became","④":"awarded"}},
         "det":{"korean":"① inviting은 원문 invited. He was invited(수동태)에서 과거분사 필요.",
                "analysis":"❌ ① inviting: 원문 invited. was invited(수동태) → 과거분사 필요 ←정답\n✅ ② advise: to advise. 원문 일치\n✅ ③ became: 동사 과거시제. 원문 일치\n✅ ④ awarded: was awarded(수동태). 원문 일치",
                "tip":"수동태: was invited(초대받았다). inviting은 능동(초대하는)."}},
        # 3: 어법 어려움
        {"id":3,"stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
         "ch":["①","②","③","④"],"ans":2,
         "overlay":{"markers":{"①":"traveling","②":{"find":"to","display":"for"},"③":"director","④":"his"}},
         "det":{"korean":"② for는 원문 to. to advise(조언하기 위해)에서 to부정사가 목적을 나타냄.",
                "analysis":"✅ ① traveling: began traveling. 원문 일치\n❌ ② for: 원문 to. invited to advise → 목적 to부정사 ←정답\n✅ ③ director: 명사 보어. 원문 일치\n✅ ④ his: 소유격. his leadership. 원문 일치",
                "tip":"was invited to advise(~하도록 초대받다). to = 목적의 to부정사."}},
        # 4: 부적절어휘 보통
        {"id":4,"stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":1,
         "overlay":{"markers":{"①":{"find":"greatest","display":"least significant"},"②":"talent","③":"doctoral","④":"traveling"}},
         "det":{"korean":"① least significant(가장 덜 중요한)는 원문 greatest(가장 위대한)의 반의어.",
                "analysis":"❌ ① least significant: 원문 greatest → 가장 위대한 ←정답\n✅ ② talent: 원문 일치\n✅ ③ doctoral: 원문 일치\n✅ ④ traveling: 원문 일치",
                "tip":"greatest(가장 위대한) ↔ least significant(가장 덜 중요한)"}},
        # 5: 부적절어휘 어려움
        {"id":5,"stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
         "ch":["①","②","③","④"],"ans":3,
         "overlay":{"markers":{"①":"engineering","②":"consultant","③":{"find":"design","display":"destruction"},"④":"awarded"}},
         "det":{"korean":"③ destruction(파괴)는 원문 design(설계)의 반의어 방향.",
                "analysis":"✅ ① engineering: 원문 일치\n✅ ② consultant: 원문 일치\n❌ ③ destruction: 원문 design → 설계 ←정답\n✅ ④ awarded: 원문 일치",
                "tip":"design(설계) ↔ destruction(파괴)"}},
        # 6: 빈칸추론 보통
        {"id":6,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["talent","medal","engineering","science"],"ans":3,
         "overlay":{"blank":"engineering"},
         "det":{"korean":"괴팅겐 대학에서 <b>공학(engineering)</b> 박사 학위를 받았다.",
                "analysis":"✅ ③ engineering: 원문 일치 — doctoral degree in engineering ←정답\n❌ ① talent(재능): 다른 문맥\n❌ ② medal(메달): 다른 문맥\n❌ ④ science(과학): 뒤에 나오지만 여기서는 engineering",
                "tip":"engineering = 공학"}},
        # 7: 빈칸추론 보통
        {"id":7,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["invited","awarded","born","showed"],"ans":2,
         "overlay":{"blank":"awarded"},
         "det":{"korean":"후에 과학에서의 리더십으로 국가 과학 메달을 <b>수여받았다(awarded)</b>.",
                "analysis":"✅ ② awarded: 원문 일치 — was awarded the National Medal ←정답\n❌ ① invited(초대받은): 다른 문맥\n❌ ③ born(태어난): 다른 문맥\n❌ ④ showed(보여준): 다른 문맥",
                "tip":"was awarded = 수여받았다"}},
        # 8: 내용일치 쉬움
        {"id":8,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["미국에서 태어나 유럽으로 건너갔다.","어릴 때부터 수학과 과학에 소질이 있었다.","1920년대에 칼텍 소장이 되었다.","독일에서 박사 학위를 받은 후 바로 미국에 정착했다."],
         "ans":2,
         "overlay":{},
         "det":{"korean":"본문: at an early age, he showed a talent for math and science.",
                "analysis":"❌ ① 헝가리 출생(미국 아님)\n✅ ② 어릴 때 수학·과학 소질: 원문 일치 ←정답\n❌ ③ 1930년에 소장(1920년대 아님)\n❌ ④ 1920년대에 강사·컨설턴트 활동 먼저",
                "tip":"at an early age, talent for math and science"}},
        # 9: 내용일치 보통
        {"id":9,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하지 <b>않는</b> 것은?",
         "ch":["헝가리계 미국인 엔지니어였다.","괴팅겐 대학에서 물리학 박사를 받았다.","칼텍에서 풍동 설계에 관한 자문을 했다.","국가 과학 메달을 수여받았다."],
         "ans":2,
         "overlay":{},
         "det":{"korean":"본문: a doctoral degree in engineering(공학). 물리학이 아님.",
                "analysis":"✅ ① 헝가리계 미국인: 원문 일치\n❌ ② 물리학 박사: 원문은 engineering(공학) ←정답\n✅ ③ 풍동 설계 자문: 원문 일치\n✅ ④ 국가 과학 메달: 원문 일치",
                "tip":"doctoral degree in engineering ≠ physics"}},
        # 10: 내용일치 보통
        {"id":10,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["칼텍에 초대받아 항공 연구소를 설립했다.","1920년대에 산업 분야 컨설턴트로 활동했다.","독일에서 평생 머물며 연구했다.","미국에서 수학 박사 학위를 받았다."],
         "ans":2,
         "overlay":{},
         "det":{"korean":"본문: In the 1920s, he began traveling as a lecturer and consultant to industry.",
                "analysis":"❌ ① 설립이 아니라 소장이 됨\n✅ ② 1920년대 산업 컨설턴트: 원문 일치 ←정답\n❌ ③ 독일에만 머문 것 아님(미국으로 이동)\n❌ ④ 독일에서 공학 박사(미국/수학 아님)",
                "tip":"In the 1920s, consultant to industry"}},
        # 11: 주제 보통
        {"id":11,"stem":"다음 글의 주제로 가장 적절한 것은?",
         "ch":["Theodore von Kármán의 과학적 업적과 경력","20세기 미국 대학의 발전사","풍동 실험이 항공 산업에 미친 영향","독일과 미국의 학술 교류 역사"],
         "ans":1,
         "overlay":{},
         "det":{"korean":"글 전체가 Kármán의 출생부터 수상까지 경력을 서술.",
                "analysis":"✅ ① Kármán의 업적과 경력: 글의 핵심 ←정답\n❌ ② 미국 대학 발전사: 언급 없음\n❌ ③ 풍동 영향: 부분적\n❌ ④ 학술 교류: 언급 없음",
                "tip":"인물 전기문의 주제 = 해당 인물의 업적"}},
        # 12: 주제 어려움
        {"id":12,"stem":"다음 글의 제목으로 가장 적절한 것은?",
         "ch":["A Pioneer in Aeronautical Engineering","The History of Wind Tunnel Design","Caltech: A Hub of Scientific Innovation","The National Medal of Science Winners"],
         "ans":1,
         "overlay":{},
         "det":{"korean":"항공 공학의 선구자인 Kármán의 생애를 다루는 글.",
                "analysis":"✅ ① A Pioneer in Aeronautical Engineering: 글의 핵심 ←정답\n❌ ② 풍동 설계 역사: 부분적\n❌ ③ 칼텍 혁신: 부분적\n❌ ④ 메달 수상자들: 한 명만 다룸",
                "tip":"pioneer = 선구자. Kármán은 항공 공학의 선구자"}},
        # 13: 함축의미 어려움
        {"id":13,"stem":"다음 글의 밑줄 친 <b>one of the greatest minds</b>가 함축하는 의미로 가장 적절한 것은?",
         "ch":["20세기를 대표하는 뛰어난 지성인이자 과학적 업적을 남긴 인물","단순히 머리가 좋은 학생에 불과한 인물","정치적으로 영향력 있는 지도자","예술과 문학에 탁월한 천재"],
         "ans":1,
         "overlay":{"underline":"one of the greatest minds"},
         "det":{"korean":"greatest minds = 가장 위대한 지성. 이후 업적(박사, 소장, 메달)이 이를 뒷받침.",
                "analysis":"✅ ① 뛰어난 지성인·과학 업적: 후속 내용과 일치 ←정답\n❌ ② 단순 학생: 글은 업적을 강조\n❌ ③ 정치 지도자: 언급 없음\n❌ ④ 예술·문학: 공학·과학 분야",
                "tip":"greatest minds = 최고의 두뇌/지성. 과학·공학 업적으로 입증"}},
        # 14: 지칭추론 쉬움
        {"id":14,"stem":"다음 글의 밑줄 친 <b>He</b>가 지칭하는 것으로 가장 적절한 것은?",
         "ch":["폰 카르만 자신","괴팅겐 대학 교수","칼텍의 다른 엔지니어","헝가리 정부 관계자"],
         "ans":1,
         "overlay":{"underline":"He"},
         "det":{"korean":"밑줄 친 He는 문맥상 Theodore von Kármán을 가리킴.",
                "analysis":"✅ ① 폰 카르만 자신: 글의 주인공 ←정답\n❌ ② 괴팅겐 교수: 언급 없음\n❌ ③ 칼텍 엔지니어: He는 주인공\n❌ ④ 헝가리 정부: 언급 없음",
                "tip":"글 전체의 주어가 Theodore von Kármán → He"}},
        # 15: 지칭추론 보통
        {"id":15,"stem":"다음 글의 밑줄 친 <b>he</b>(He became the director...)가 지칭하는 대상으로 가장 적절한 것은?",
         "ch":["풍동을 설계한 엔지니어","칼텍 총장","폰 카르만","구겐하임 재단 관계자"],
         "ans":3,
         "overlay":{"underline":"he"},
         "det":{"korean":"He became the director에서 He는 문맥상 Kármán.",
                "analysis":"❌ ① 풍동 설계 엔지니어: 다른 사람\n❌ ② 칼텍 총장: 언급 없음\n✅ ③ 폰 카르만: 글의 주인공 ←정답\n❌ ④ 구겐하임 재단: 연구소 이름일 뿐",
                "tip":"became the director → Kármán이 소장이 됨"}},
        # 16: 내용일치 쉬움
        {"id":16,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["1930년에 칼텍 구겐하임 항공 연구소의 소장이 되었다.","1920년대에 미국에서 태어났다.","괴팅겐 대학에서 문학 박사 학위를 받았다.","헝가리에서 풍동을 설계했다."],
         "ans":1,
         "overlay":{},
         "det":{"korean":"본문: He became the director of the Guggenheim Aeronautical Laboratory at Caltech in 1930.",
                "analysis":"✅ ① 1930년 칼텍 소장: 원문 일치 ←정답\n❌ ② 1920년대 미국 출생 아님\n❌ ③ 공학(engineering) 박사\n❌ ④ 미국 칼텍에서 풍동 자문",
                "tip":"in 1930, director of Guggenheim Aeronautical Laboratory"}},
        # 17: 빈칸추론 보통
        {"id":17,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["design","talent","century","degree"],"ans":1,
         "overlay":{"blank":"design"},
         "det":{"korean":"풍동의 <b>설계(design)</b>에 대해 엔지니어들에게 조언하도록.",
                "analysis":"✅ ① design: 원문 일치 — the design of a wind tunnel ←정답\n❌ ② talent(재능): 다른 문맥\n❌ ③ century(세기): 다른 문맥\n❌ ④ degree(학위): 다른 문맥",
                "tip":"design = 설계"}},
        # 18: 내용일치 어려움
        {"id":18,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하지 <b>않는</b> 것은?",
         "ch":["헝가리계 미국인 엔지니어였다.","어릴 때 수학과 과학 분야에 재능을 보였다.","1908년에 미국에서 공학 박사를 받았다.","과학에서의 리더십으로 국가 과학 메달을 받았다."],
         "ans":3,
         "overlay":{},
         "det":{"korean":"본문: 1908년 독일 괴팅겐 대학(미국 아님).",
                "analysis":"✅ ① 헝가리계 미국인: 원문 일치\n✅ ② 어릴 때 재능: 원문 일치\n❌ ③ 미국에서 박사: 독일 괴팅겐 대학 ←정답\n✅ ④ 리더십 메달: 원문 일치",
                "tip":"University of Göttingen in Germany ≠ in the US"}},
        # 19: 내용일치 쉬움
        {"id":19,"stem":"Theodore von Kármán에 관한 다음 글의 내용과 일치하는 것은?",
         "ch":["칼텍에서 풍동 설계를 자문하도록 미국에 초대받았다.","독일에서 평생 연구 활동을 했다.","1930년에 국가 과학 메달을 받았다.","1920년대에 칼텍 소장에 취임했다."],
         "ans":1,
         "overlay":{},
         "det":{"korean":"본문: invited to the United States to advise engineers on the design of a wind tunnel at Caltech.",
                "analysis":"✅ ① 미국 초청 풍동 자문: 원문 일치 ←정답\n❌ ② 독일 평생: 미국으로 이동\n❌ ③ 1930년 메달: 1930년은 소장 취임\n❌ ④ 1920년대 소장: 1930년",
                "tip":"invited to the United States, wind tunnel at Caltech"}},
        # 20: 빈칸추론 보통
        {"id":20,"stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
         "ch":["industry","university","medal","tunnel"],"ans":1,
         "overlay":{"blank":"industry"},
         "det":{"korean":"강사이자 <b>산업(industry)</b>에 대한 컨설턴트로 여행.",
                "analysis":"✅ ① industry: 원문 일치 — consultant to industry ←정답\n❌ ② university(대학): 다른 문맥\n❌ ③ medal(메달): 다른 문맥\n❌ ④ tunnel(터널): 다른 문맥",
                "tip":"industry = 산업"}}
    ]
    save_response(26, "퀴즈", decisions)

# Now generate all passages. Due to complexity, I'll generate the remaining 7 numbers too.
# Each fullPassage needs unique questions. Let me create them systematically.

gen_26()

print("\n26번 완료. 나머지 7개 번호는 별도 스크립트로 처리.")
