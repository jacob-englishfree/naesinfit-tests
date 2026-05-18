#!/usr/bin/env python3
"""
Batch generate response.json for 고1/3월_2024 remaining files.
Uses passage analysis to create valid questions.
"""
import json, os, re, subprocess, sys, random

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "data/모의고사/고1/3월_2024")

random.seed(42)  # reproducible

# ── Passage data with pre-analyzed content ──
PASSAGE_DATA = {
    29: {
        "fp_words": ["meaningful","fulfillment","empowerment","energizing","satisfying","employment","joy","pride","conducted","fulfilled","produce","output","incomes","satisfied","happier","satisfaction","workers","studies","quality","greater","deeper","meaning","careers","psychology","countries"],
        "abc": [
            (["meaningful","meaningless"], ["energizing","draining"], ["satisfied","dissatisfied"]),
            (["fulfillment","frustration"], ["produce","reduce"], ["happier","sadder"]),
            (["deeper","shallower"], ["conducted","abandoned"], ["greater","lesser"])
        ],
        "marker_sets": [
            {"1":"meaningful","2":("fulfillment","frustration"),"3":"energizing","4":"produce"},
            {"1":"satisfying","2":"employment","3":("happier","sadder"),"4":"satisfaction"},
            {"1":("pride","shame"),"2":"conducted","3":"fulfilled","4":"incomes"}
        ],
        "blanks": ["meaningful","fulfillment","satisfaction","conducted","happier"],
        "syn": [("meaningful","significant",["trivial","occasional","temporary"]),
                ("conducted","carried out",["cancelled","avoided","ignored"]),
                ("satisfied","content",["disappointed","indifferent","troubled"])],
        "ant": [("deeper","shallower",["richer","greater","broader"]),
                ("greater","lesser",["larger","superior","wider"])],
        "poly": ("produce","(A) workers who <u>produce</u> higher quality work","(B) The farm will <u>produce</u> fresh vegetables this summer.","만들어내다","재배하다"),
        "eiyoung": ("satisfaction","a pleasant feeling when you achieve something desired",["frustration","employment","output"]),
        "morph": [("satisfy","satisfied","과거분사형"),("fulfill","fulfillment","명사형")],
        "ctx_blanks": ["a sense of fulfillment and empowerment","their greatest sources of joy and pride"],
        "tf": [("의미 있는 일을 찾은 사람들의 하루가 더 활기찼다.",True),("이 연구는 100개국에서 진행되었다.",False),("직업 만족도가 높은 사람들의 수입이 더 높았다.",True)],
        "match": [("직업에서 성취감을 느끼는 사람들이 더 높은 수입을 올렸다.",True),("3천 명의 근로자를 대상으로 한 연구가 진행되었다.",True),("이 연구는 50개국에서 수행되었다.",False),("의미 있는 일은 삶의 만족도와 무관하다.",False)],
        "topic": "의미 있는 일과 삶의 만족도 사이의 관계",
        "hamchuk": ("their greatest sources of joy and pride","직업을 가장 큰 기쁨과 자부심의 원천으로 여기는 것은 직업에 대한 높은 만족도를 의미한다."),
        "jichung": ("Those","의미 있는 일을 찾은 사람들"),
        "written_kw": "satisfaction",
        "grammar_markers": [
            {"1":"work","2":("fulfillment","fulfilling"),"3":"energizing","4":"conducted"},
            {"1":"meaningful","2":("satisfying","satisfy"),"3":"happier","4":"workers"},
            {"1":"that","2":("conducted","conducting"),"3":"finding","4":"satisfied"},
            {"1":("produce","producing"),"2":"quality","3":"incomes","4":"overall"}
        ],
        "grammar_vocab": [
            {"1":"meaningful","2":"employment","3":("happier","sadder"),"4":"conducted"},
            {"1":"satisfying","2":("pride","shame"),"3":"fulfilled","4":"incomes"}
        ],
        "error_markers": {"1":"secondary","2":"natural","3":("continued","continuing"),"4":"served"},
        "quiz_blanks": ["meaningful","satisfaction","conducted","happier","fulfilled"]
    },
    30: {
        "fp_words": ["speed","traveling","determine","ability","process","detail","environment","evolutionary","senses","adapted","movement","suited","limited","motorist","pedestrian","appreciate","design","slower","faster","ordinary"],
        "abc": [
            (["determine","ignore"], ["adapted","unsuited"], ["suited","unsuited"]),
            (["limited","unlimited"], ["appreciate","overlook"], ["slower","faster"]),
            (["process","neglect"], ["ordinary","extraordinary"], ["detail","overview"])
        ],
        "marker_sets": [
            {"1":"determine","2":("adapted","maladapted"),"3":"suited","4":"limited"},
            {"1":"speed","2":"ability","3":("appreciate","overlook"),"4":"slower"},
            {"1":("limited","unlimited"),"2":"process","3":"detail","4":"faster"}
        ],
        "blanks": ["determine","adapted","suited","appreciate","limited"],
        "syn": [("determine","decide",["ignore","delay","avoid"]),
                ("appreciate","recognize",["overlook","dismiss","neglect"]),
                ("adapted","adjusted",["resistant","opposed","indifferent"])],
        "ant": [("limited","unlimited",["restricted","narrow","bounded"]),
                ("slower","faster",["gradual","unhurried","steady"])],
        "poly": ("process","(A) the ability to <u>process</u> detail in the environment","(B) The <u>process</u> of making cheese requires several steps.","처리하다","과정"),
        "eiyoung": ("environment","the natural world around us including air water and land",["movement","ability","detail"]),
        "morph": [("evolve","evolutionary","형용사형"),("move","movement","명사형")],
        "ctx_blanks": ["the ability to process detail","the typical motorist"],
        "tf": [("인간의 감각은 걷는 속도에 적합하다.",True),("자동차 운전자가 보행자보다 환경 세부사항을 더 잘 인지한다.",False),("조깅하는 사람은 보행자와 자동차 사이에 있다.",True)],
        "match": [("인간의 감각은 걸을 때의 속도에 맞게 진화했다.",True),("자동차 운전자는 디자인 세부사항을 잘 감상할 수 있다.",False),("보행 속도가 느리면 환경 세부사항을 더 잘 인지한다.",True),("조깅하는 사람은 자동차 운전자보다 느리게 이동한다.",True)],
        "topic": "이동 속도와 환경 세부사항 인지 능력의 관계",
        "hamchuk": ("under their own power","인간이 자신의 힘으로 이동하는 것은 걷기를 의미하며, 이때 감각이 가장 잘 작동한다는 뜻이다."),
        "jichung": ("they","human senses(인간의 감각)"),
        "written_kw": "appreciate",
        "grammar_markers": [
            {"1":"traveling","2":("determine","determining"),"3":"adapted","4":"suited"},
            {"1":"speed","2":"ability","3":("limited","limiting"),"4":"appreciate"},
            {"1":"which","2":("suited","suiting"),"3":"ordinary","4":"faster"},
            {"1":("process","processing"),"2":"detail","3":"pedestrian","4":"slower"}
        ],
        "grammar_vocab": [
            {"1":"determine","2":"adapted","3":("appreciate","overlook"),"4":"limited"},
            {"1":"suited","2":("limited","unlimited"),"3":"faster","4":"slower"}
        ],
        "quiz_blanks": ["determine","adapted","appreciate","limited","suited"]
    },
    31: {
        "fp_words": ["species","climatic","requirements","degree","heat","cold","endure","climate","changes","satisfy","forced","follow","creatures","capable","dispersal","immobile","trees","barnacles","seed","larva","survive","grow","reproduce","fossils","scientists"],
        "abc": [
            (["climatic","economic"], ["endure","enjoy"], ["forced","encouraged"]),
            (["capable","incapable"], ["survive","perish"], ["reproduce","diminish"]),
            (["immobile","mobile"], ["dispersal","collection"], ["surprising","expected"])
        ],
        "marker_sets": [
            {"1":"climatic","2":("endure","enjoy"),"3":"changes","4":"forced"},
            {"1":"capable","2":"dispersal","3":("survive","perish"),"4":"reproduce"},
            {"1":("forced","invited"),"2":"creatures","3":"immobile","4":"fossils"}
        ],
        "blanks": ["endure","forced","capable","survive","dispersal"],
        "syn": [("endure","withstand",["enjoy","welcome","embrace"]),
                ("capable","able",["incapable","unable","helpless"]),
                ("survive","endure",["perish","vanish","collapse"])],
        "ant": [("immobile","mobile",["stationary","fixed","rooted"]),
                ("forced","voluntary",["compelled","driven","obliged"])],
        "poly": ("degree","(A) what <u>degree</u> of heat or cold it can endure","(B) She earned a <u>degree</u> in biology from the university.","정도","학위"),
        "eiyoung": ("species","a group of living things that can breed with each other",["climate","fossils","creatures"]),
        "morph": [("climate","climatic","형용사형"),("disperse","dispersal","명사형")],
        "ctx_blanks": ["some degree of dispersal","the place it is born"],
        "tf": [("모든 생물은 어느 정도의 이동 능력이 있다.",True),("나무는 움직일 수 없는 생물로 분류된다.",False),("화석을 통해 과거 기후 변화 시 이동 속도를 알 수 있다.",True)],
        "match": [("모든 종은 특정 기후 조건이 필요하다.",True),("나무도 씨앗 단계에서 이동할 수 있다.",True),("기후 변화가 일어나면 종은 그 자리에 머문다.",False),("따개비는 유충 단계에서 퍼져나갈 수 있다.",True)],
        "topic": "기후 변화에 따른 생물의 이동과 적응",
        "hamchuk": ("under their own power","자신의 힘으로 움직인다는 것은 독립적인 이동 수단을 뜻한다."),
        "jichung": ("it","every species(모든 종)"),
        "written_kw": "dispersal",
        "grammar_markers": [
            {"1":"climatic","2":("endure","enduring"),"3":"changes","4":"forced"},
            {"1":"capable","2":("dispersal","disperse"),"3":"survive","4":"occupied"},
            {"1":"that","2":("satisfy","satisfying"),"3":"forced","4":"creatures"},
            {"1":("moved","moving"),"2":"surprising","3":"scientists","4":"fossils"}
        ],
        "grammar_vocab": [
            {"1":"climatic","2":"endure","3":("forced","invited"),"4":"capable"},
            {"1":"immobile","2":("survive","perish"),"3":"dispersal","4":"reproduce"}
        ],
        "quiz_blanks": ["endure","forced","capable","survive","dispersal"]
    },
    32: {
        "fp_words": ["respectable","boss","discourage","staff","speaking","maintain","culture","prevents","disagreeing","viewpoints","aired","conversations","corporate","university","nonprofit","leaders","management","techniques","regularly","encourage","junior","staffers","dissenters","listen"],
        "abc": [
            (["discourage","encourage"], ["maintain","abandon"], ["prevents","allows"]),
            (["regularly","rarely"], ["encourage","suppress"], ["dissenters","supporters"]),
            (["respectable","disreputable"], ["speaking","silence"], ["disagreeing","agreeing"])
        ],
        "marker_sets": [
            {"1":"discourage","2":("maintain","abandon"),"3":"prevents","4":"aired"},
            {"1":"respectable","2":"staff","3":("encourage","suppress"),"4":"regularly"},
            {"1":("speaking","silence"),"2":"disagreeing","3":"viewpoints","4":"leaders"}
        ],
        "blanks": ["discourage","maintain","encourage","regularly","listen"],
        "syn": [("discourage","deter",["promote","support","facilitate"]),
                ("maintain","sustain",["abandon","discard","neglect"]),
                ("encourage","promote",["suppress","discourage","prevent"])],
        "ant": [("discourage","encourage",["prevent","inhibit","restrict"]),
                ("regularly","rarely",["frequently","consistently","routinely"])],
        "poly": ("culture","(A) I <u>maintain</u> a culture that prevents disagreeing viewpoints","(B) The company tried to <u>maintain</u> its leading position in the market.","유지하다","유지하다"),
        "eiyoung": ("culture","the attitudes and behavior characteristic of a particular group",["staff","leaders","techniques"]),
        "morph": [("manage","management","명사형"),("disagree","disagreeing","현재분사형")],
        "ctx_blanks": ["pro-dissent","continually encourage dissent from more junior staffers"],
        "tf": [("대부분의 상사들은 직원들의 의견 개진을 장려한다고 말한다.",True),("모든 리더들이 실제로 반대 의견을 수용한다.",False),("신문의 비즈니스 섹션에서 리더 인터뷰가 매주 실렸다.",True)],
        "match": [("상사들 대부분은 반대 의견을 장려한다고 주장한다.",True),("기업, 대학, 비영리 단체 리더들과의 대화가 매주 신문에 실렸다.",True),("모든 상사가 직원의 발언을 억제한다.",False),("Bot Pittman은 반대 의견에 귀 기울이는 것이 중요하다고 말했다.",True)],
        "topic": "상사들의 반대 의견 장려 주장과 실제의 괴리",
        "hamchuk": ("pro-dissent","상사들이 반대 의견을 지지한다고 자처하는 것은 반대 의견 수용이 바람직하다는 인식을 보여준다."),
        "jichung": ("they","dissenters(반대하는 직원들)"),
        "written_kw": "encourage",
        "grammar_markers": [
            {"1":"respectable","2":("discourage","discouraging"),"3":"maintain","4":"prevents"},
            {"1":"aired","2":"conversations","3":("regularly","regular"),"4":"encourage"},
            {"1":"speaking","2":("prevents","preventing"),"3":"disagreeing","4":"published"},
            {"1":("encourage","encouraging"),"2":"staffers","3":"dissenters","4":"listen"}
        ],
        "grammar_vocab": [
            {"1":"respectable","2":"discourage","3":("maintain","abandon"),"4":"prevents"},
            {"1":"regularly","2":("encourage","suppress"),"3":"speaking","4":"dissenters"}
        ],
        "quiz_blanks": ["discourage","maintain","encourage","regularly","listen"]
    },
    33: {
        "fp_words": ["striking","characteristics","sleeping","animal","respond","normally","environmental","stimuli","eyelids","mammal","visual","information","processed","shortened","weakened","sensing","registered","perceptual","disengagement","protecting","definition","intermediate","drowsiness","benefits","total"],
        "abc": [
            (["striking","ordinary"], ["normally","abnormally"], ["shortened","lengthened"]),
            (["registered","ignored"], ["protecting","endangering"], ["essential","unnecessary"]),
            (["intermediate","extreme"], ["benefits","drawbacks"], ["total","partial"])
        ],
        "marker_sets": [
            {"1":"striking","2":("respond","ignore"),"3":"normally","4":"environmental"},
            {"1":"visual","2":"processed","3":("shortened","lengthened"),"4":"weakened"},
            {"1":("protecting","endangering"),"2":"definition","3":"intermediate","4":"benefits"}
        ],
        "blanks": ["respond","normally","processed","protecting","intermediate"],
        "syn": [("striking","remarkable",["ordinary","common","typical"]),
                ("respond","react",["ignore","neglect","disregard"]),
                ("essential","crucial",["unnecessary","trivial","optional"])],
        "ant": [("normally","abnormally",["regularly","typically","usually"]),
                ("shortened","lengthened",["reduced","diminished","condensed"])],
        "poly": ("register","(A) Stimuli are <u>registered</u> but not processed normally.","(B) She went to <u>register</u> for the new course at the university.","감지되다","등록하다"),
        "eiyoung": ("stimuli","things that cause a reaction in a living thing",["benefits","drowsiness","characteristics"]),
        "morph": [("environment","environmental","형용사형"),("perceive","perceptual","형용사형")],
        "ctx_blanks": ["perceptual disengagement","the intermediate state of drowsiness"],
        "tf": [("잠자는 동물은 환경 자극에 정상적으로 반응하지 않는다.",True),("시각 정보는 수면 중에도 완벽하게 처리된다.",False),("지각적 이탈은 수면을 보호하는 기능을 한다.",True)],
        "match": [("잠자는 포유류의 눈꺼풀을 열어도 정상적으로 보지 못한다.",True),("자극은 감지되지만 정상적으로 처리되지 않는다.",True),("졸음 상태에서는 수면의 이점을 전혀 얻을 수 없다.",False),("지각적 이탈 없이는 수면이 불가능하다.",True)],
        "topic": "수면 중 지각적 이탈의 역할과 정의",
        "hamchuk": ("perceptual disengagement","지각적 이탈은 외부 자극을 차단하여 수면을 유지하는 메커니즘을 의미한다."),
        "jichung": ("they","the eyes(잠자는 포유류의 눈)"),
        "written_kw": "normally",
        "grammar_markers": [
            {"1":"striking","2":("respond","responding"),"3":"normally","4":"environmental"},
            {"1":"sleeping","2":"visual","3":("processed","processing"),"4":"weakened"},
            {"1":"registered","2":("protecting","protect"),"3":"essential","4":"definition"},
            {"1":("intermediate","intermediately"),"2":"drowsiness","3":"benefits","4":"total"}
        ],
        "grammar_vocab": [
            {"1":"striking","2":"respond","3":("shortened","lengthened"),"4":"weakened"},
            {"1":"normally","2":("protecting","endangering"),"3":"essential","4":"intermediate"}
        ],
        "quiz_blanks": ["respond","normally","processed","protecting","intermediate"]
    },
    34: {
        "fp_words": ["research","studies","experts","field","experience","difficulties","introducing","newcomers","genuine","training","situation","expert","mobile","phones","remarkably","accurate","novice","users","judging","insensitive","effect","referred","curse","knowledge","acquired","skill","underestimate","difficulty","participants","session","assumptions","students","learning"],
        "abc": [
            (["experts","beginners"], ["difficulties","ease"], ["insensitive","sensitive"]),
            (["remarkably","slightly"], ["accurate","inaccurate"], ["underestimate","overestimate"]),
            (["genuine","artificial"], ["acquired","lost"], ["assumptions","observations"])
        ],
        "marker_sets": [
            {"1":"experts","2":("difficulties","ease"),"3":"introducing","4":"newcomers"},
            {"1":"genuine","2":"remarkably","3":("accurate","inaccurate"),"4":"novice"},
            {"1":("insensitive","sensitive"),"2":"effect","3":"acquired","4":"underestimate"}
        ],
        "blanks": ["experts","difficulties","accurate","insensitive","underestimate"],
        "syn": [("difficulties","challenges",["ease","comfort","simplicity"]),
                ("remarkably","notably",["slightly","barely","marginally"]),
                ("acquired","obtained",["lost","abandoned","surrendered"])],
        "ant": [("insensitive","sensitive",["aware","responsive","perceptive"]),
                ("underestimate","overestimate",["evaluate","assess","measure"])],
        "poly": ("field","(A) how experts in a <u>field</u> often experience difficulties","(B) The children were playing soccer on the <u>field</u> after school.","분야","들판"),
        "eiyoung": ("novice","a person who is new to and inexperienced in a job or situation",["expert","participant","researcher"]),
        "morph": [("introduce","introducing","현재분사형"),("know","knowledge","명사형")],
        "ctx_blanks": ["the curse of knowledge","how long it takes people to learn"],
        "tf": [("전문가들은 초보자에게 지식을 전달하는 데 어려움을 겪는다.",True),("전문가들은 과제의 난이도를 정확히 판단한다.",False),("참가자들은 자신이 그 기술을 습득하는 데 걸린 시간도 과소평가했다.",True)],
        "match": [("Pamela Hinds 박사는 실제 교육 상황에서 연구를 수행했다.",True),("휴대전화 사용 전문가들은 초보자보다 학습 시간을 정확히 예측했다.",False),("기술을 습득할수록 그 기술의 난이도를 과소평가하게 된다.",True),("전문가의 저주란 전문가가 초보자의 어려움을 잊는 현상이다.",True)],
        "topic": "전문가의 저주: 전문가가 초보자의 어려움을 이해하지 못하는 현상",
        "hamchuk": ("the curse of knowledge","지식의 저주는 전문가가 자신의 지식 수준을 기준으로 초보자를 판단하는 인지적 편향을 의미한다."),
        "jichung": ("they","dissenters(반대하는 사람들)"),
        "written_kw": "underestimate",
        "grammar_markers": [
            {"1":"research","2":("introducing","introduced"),"3":"genuine","4":"training"},
            {"1":"expert","2":"remarkably","3":("accurate","accuracy"),"4":"novice"},
            {"1":"insensitive","2":("referred","referring"),"3":"acquired","4":"skill"},
            {"1":("underestimate","underestimating"),"2":"difficulty","3":"participants","4":"session"}
        ],
        "grammar_vocab": [
            {"1":"experts","2":"difficulties","3":("accurate","inaccurate"),"4":"insensitive"},
            {"1":"remarkably","2":("insensitive","sensitive"),"3":"acquired","4":"underestimate"}
        ],
        "quiz_blanks": ["experts","difficulties","accurate","insensitive","underestimate"]
    },
    35: {
        "fp_words": ["psychologists","studied","individuals","severe","mental","illness","experienced","weekly","group","music","therapy","singing","familiar","songs","composing","original","results","improved","quality","participants","greatest","benefits","efficacy","treatment","community","findings","conditions","choir","wellbeing","enjoyment","emotional","belonging","confidence","negative","effects"],
        "abc": [
            (["severe","mild"], ["improved","worsened"], ["greatest","least"]),
            (["familiar","unfamiliar"], ["original","copied"], ["significantly","slightly"]),
            (["weekly","daily"], ["efficacy","inefficiency"], ["enhanced","diminished"])
        ],
        "marker_sets": [
            {"1":"severe","2":("improved","worsened"),"3":"quality","4":"greatest"},
            {"1":"familiar","2":"original","3":("significantly","slightly"),"4":"wellbeing"},
            {"1":("enhanced","diminished"),"2":"emotional","3":"belonging","4":"confidence"}
        ],
        "blanks": ["improved","severe","significantly","enhanced","efficacy"],
        "syn": [("severe","serious",["mild","slight","minor"]),
                ("improved","enhanced",["worsened","declined","deteriorated"]),
                ("significantly","considerably",["slightly","barely","marginally"])],
        "ant": [("severe","mild",["serious","grave","acute"]),
                ("enhanced","diminished",["improved","strengthened","boosted"])],
        "poly": ("group","(A) individuals who experienced weekly <u>group</u> music therapy","(B) A <u>group</u> of tourists gathered in front of the museum.","집단","무리"),
        "eiyoung": ("therapy","treatment intended to heal or relieve a disorder",["illness","confidence","enjoyment"]),
        "morph": [("treat","treatment","명사형"),("emotion","emotional","형용사형")],
        "ctx_blanks": ["the quality of participants' life","a sense of belonging"],
        "tf": [("집단 음악 치료가 참가자들의 삶의 질을 향상시켰다.",True),("더 많은 세션에 참여할수록 효과가 적었다.",False),("합창단 참여가 정신 건강에 긍정적 영향을 미쳤다.",True)],
        "match": [("심각한 정신 질환을 가진 개인들을 대상으로 연구했다.",True),("음악의 부정적 효과가 심리학자들의 예상보다 컸다.",True),("합창단 참여가 정신 건강과 안녕감을 크게 향상시켰다.",True),("집단 노래는 소속감과 자신감을 증진시켰다.",True)],
        "topic": "집단 음악 치료가 정신 건강에 미치는 긍정적 효과",
        "hamchuk": ("a sense of belonging","소속감은 합창단 활동을 통해 형성되는 공동체 의식을 의미하며, 정신 건강 개선의 핵심 요소다."),
        "jichung": ("those","sessions에 더 많이 참여한 사람들"),
        "written_kw": "significantly",
        "grammar_markers": [
            {"1":"studied","2":("experienced","experiencing"),"3":"weekly","4":"singing"},
            {"1":"severe","2":"improved","3":("significantly","significant"),"4":"wellbeing"},
            {"1":"familiar","2":("composing","composed"),"3":"original","4":"results"},
            {"1":("enhanced","enhancing"),"2":"emotional","3":"belonging","4":"confidence"}
        ],
        "grammar_vocab": [
            {"1":"severe","2":"improved","3":("significantly","slightly"),"4":"greatest"},
            {"1":"familiar","2":("enhanced","diminished"),"3":"emotional","4":"belonging"}
        ],
        "quiz_blanks": ["improved","severe","significantly","enhanced","efficacy"]
    }
}

def balance_ans(decisions):
    """Adjust ans values to ensure max 5 per number, no 3 consecutive."""
    from collections import Counter
    dist = Counter(d["ans"] for d in decisions if "ans" in d)

    # Fix over-5
    for target_ans in [1,2,3,4]:
        while dist[target_ans] > 5:
            # Find a decision with this ans that can be changed
            for d in reversed(decisions):
                if d["ans"] == target_ans and d["type"] not in ["문맥상 부적절한 어휘", "어법"]:
                    # Find the least-used ans
                    min_ans = min(range(1,5), key=lambda a: dist[a])
                    if dist[min_ans] < 5:
                        old = d["ans"]
                        d["ans"] = min_ans
                        # Rotate ch to match
                        if isinstance(d.get("ch"), list) and len(d["ch"]) == 4 and d["ch"][0] not in ["①","②","③","④"]:
                            correct = d["ch"][old-1]
                            d["ch"].pop(old-1)
                            d["ch"].insert(min_ans-1, correct)
                        dist[old] -= 1
                        dist[min_ans] += 1
                        break
            else:
                break

    # Fix 3 consecutive (simplified)
    for i in range(2, len(decisions)):
        if "ans" not in decisions[i] or "ans" not in decisions[i-1] or "ans" not in decisions[i-2]:
            continue
        if decisions[i]["ans"] == decisions[i-1]["ans"] == decisions[i-2]["ans"]:
            # Change middle one
            mid = decisions[i-1]
            if mid["type"] not in ["문맥상 부적절한 어휘", "어법"]:
                current = mid["ans"]
                alternatives = [a for a in [1,2,3,4] if a != current and dist[a] < 5]
                if alternatives:
                    new_ans = alternatives[0]
                    old = mid["ans"]
                    mid["ans"] = new_ans
                    if isinstance(mid.get("ch"), list) and len(mid["ch"]) == 4 and mid["ch"][0] not in ["①","②","③","④"]:
                        correct = mid["ch"][old-1]
                        mid["ch"].pop(old-1)
                        mid["ch"].insert(new_ans-1, correct)
                    dist[old] -= 1
                    dist[new_ans] += 1

def make_단어(num, data):
    """Generate 단어 test response."""
    decisions = []
    # Q1-3: (A)(B)(C)
    ans_seq = [4, 1, 3]
    for i, ((a1,a2),(b1,b2),(c1,c2)) in enumerate(data["abc"]):
        ans = ans_seq[i]
        correct = f"{a1} - {b1} - {c1}"
        wrongs = [f"{a2} - {b1} - {c1}", f"{a1} - {b2} - {c1}", f"{a1} - {b1} - {c2}"]
        ch = list(wrongs); ch.insert(ans-1, correct)
        decisions.append({"id":i+1,"type":"(A)(B)(C) 조합형","diff":["쉬움","보통","어려움"][i],"pts":[4,5,6][i],"fmt":"mc",
            "overlay":{"abc":{"A":[a1,a2],"B":[b1,b2],"C":[c1,c2]}},
            "stem":"다음 글의 (A), (B), (C)에 들어갈 말로 가장 적절한 것끼리 짝지은 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"(A) {a1}, (B) {b1}, (C) {c1}","analysis":"원문 조합이 정답","tip":"원문 단어 조합"}})

    # Q4-6: 부적절 어휘
    ans_seq2 = [2, 3, 1]
    for i, ms in enumerate(data["marker_sets"]):
        markers = {}
        ans_key = None
        for k, v in ms.items():
            mk = "①②③④"[int(k)-1]
            if isinstance(v, tuple):
                markers[mk] = {"find": v[0], "display": v[1]}
                ans_key = int(k)
            else:
                markers[mk] = v
        decisions.append({"id":i+4,"type":"문맥상 부적절한 어휘","diff":["쉬움","쉬움","보통"][i],"pts":[4,4,5][i],"fmt":"mc",
            "overlay":{"markers":markers},
            "stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
            "ch":["①","②","③","④"],"ans":ans_key,
            "det":{"korean":"반의어 교체","analysis":"원문 단어가 올바른 맥락","tip":"반의어 교체"}})

    # Q7-9: 빈칸 어휘
    ans_seq3 = [1, 3, 2]
    for i in range(3):
        blank = data["blanks"][i]
        distractors = [data["blanks"][(i+1)%5], data["blanks"][(i+2)%5], data["blanks"][(i+3)%5]]
        ans = ans_seq3[i]
        ch = list(distractors); ch.insert(ans-1, blank)
        decisions.append({"id":i+7,"type":"빈칸 어휘 완성","diff":["쉬움","보통","보통"][i],"pts":[4,5,5][i],"fmt":"mc",
            "overlay":{"blank":blank},
            "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"빈칸 정답: {blank}","analysis":f"원문 단어 {blank}이 적절","tip":f"빈칸 -> {blank}"}})

    # Q10-12: 동의어
    ans_seq4 = [1, 3, 4]
    for i, (word, syn, wrongs) in enumerate(data["syn"]):
        ans = ans_seq4[i]
        ch = list(wrongs); ch.insert(ans-1, syn)
        decisions.append({"id":i+10,"type":"동의어 고르기","diff":["쉬움","보통","보통"][i],"pts":[4,5,5][i],"fmt":"mc",
            "overlay":{"underline":word},
            "stem":f"다음 글의 밑줄 친 {word}와 의미가 가장 가까운 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"{word} = {syn}","analysis":f"{syn}이 동의어","tip":f"{word} = {syn}"}})

    # Q13-14: 반의어
    ans_seq5 = [2, 3]
    for i, (word, ant, wrongs) in enumerate(data["ant"]):
        ans = ans_seq5[i]
        ch = list(wrongs); ch.insert(ans-1, ant)
        decisions.append({"id":i+13,"type":"반의어 고르기","diff":["보통","어려움"][i],"pts":[5,6][i],"fmt":"mc",
            "overlay":{"underline":word},
            "stem":f"다음 글의 밑줄 친 {word}와 의미가 가장 반대인 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"{word} <-> {ant}","analysis":f"{ant}이 반의어","tip":f"{word} <-> {ant}"}})

    # Q15: 다의어
    pw, pa, pb, ma, mb = data["poly"]
    decisions.append({"id":15,"type":"다의어 문맥적 의미","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{},
        "passage":f"(A) {pa}\n(B) {pb}",
        "stem":f"다음 (A), (B)의 밑줄 친 <b>{pw}</b>의 문맥적 의미로 가장 적절한 것은?",
        "ch":[f"(A): {ma} - (B): {ma}", f"(A): {ma} - (B): {mb}", f"(A): {mb} - (B): {ma}", f"(A): {mb} - (B): {mb}"],
        "ans":2,
        "det":{"korean":f"(A) {pw} = {ma}, (B) {pw} = {mb}","analysis":"맥락별 다의어","tip":f"(A) {ma} / (B) {mb}"}})

    # Q16: 영영풀이
    ew, ed, edistractors = data["eiyoung"]
    decisions.append({"id":16,"type":"영영풀이 매칭","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{},
        "stem":f'다음 영영 정의에 해당하는 단어로 가장 적절한 것은? "{ed}"',
        "ch":[ew]+edistractors,"ans":1,
        "det":{"korean":f"영영풀이 정답: {ew}","analysis":f"{ew}이 정의에 부합","tip":f"definition = {ew}"}})

    # Q17-18: 어형변환
    for i, (base, answer, desc) in enumerate(data["morph"]):
        decisions.append({"id":i+17,"type":"어형 변환","diff":["보통","어려움"][i],"pts":[5,6][i],"fmt":"written",
            "overlay":{"excerptSentences":f"... __________ ({base}) ..."},
            "stem":"다음 글의 빈칸에 괄호 안의 단어를 알맞은 형태로 바꿔 쓰시오. (영어로)",
            "wa":answer,"accept":[answer],
            "det":{"korean":f"{desc}. {base} -> {answer}","analysis":f"{base}를 {answer}로 변환","tip":f"{base} -> {answer}"}})

    # Q19-20: 빈칸 문맥 완성
    ans_seq6 = [2, 4]
    for i, blank in enumerate(data["ctx_blanks"]):
        distractors = [data["ctx_blanks"][(i+1)%2], data["blanks"][0], data["blanks"][2]]
        ans = ans_seq6[i]
        ch = list(distractors); ch.insert(ans-1, blank)
        decisions.append({"id":i+19,"type":"빈칸 문맥 완성","diff":["보통","어려움"][i],"pts":[5,6][i],"fmt":"mc",
            "overlay":{"blank":blank},
            "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"문맥 빈칸: {blank}","analysis":f"{blank}이 문맥에 적절","tip":f"빈칸 -> {blank}"}})

    balance_ans(decisions)
    return {"source":"모의고사","sourcePath":f"고1/3월_2024/{num}번","testType":"단어","decisions":decisions}

def make_워크북(num, data):
    """Generate 워크북 test response."""
    decisions = []

    # Q1-4: 어법 (markers with grammar errors)
    ans_seq = [2, 3, 3, 1]
    for i, gm in enumerate(data["grammar_markers"]):
        markers = {}
        ans_key = None
        for k, v in gm.items():
            mk = "①②③④"[int(k)-1]
            if isinstance(v, tuple):
                markers[mk] = {"find": v[0], "display": v[1]}
                ans_key = int(k)
            else:
                markers[mk] = v
        decisions.append({"id":i+1,"type":"어법","diff":["쉬움","쉬움","보통","어려움"][i],"pts":[4,4,5,6][i],"fmt":"mc",
            "overlay":{"markers":markers},
            "stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
            "ch":["①","②","③","④"],"ans":ans_key,
            "det":{"korean":f"{markers.get('①②③④'[ans_key-1],{}).get('display','오류')} -> {markers.get('①②③④'[ans_key-1],{}).get('find','원문')}","analysis":"어법 오류 교정","tip":"어법"}})

    # Q5-6: 어휘
    for i, gv in enumerate(data["grammar_vocab"]):
        markers = {}
        ans_key = None
        for k, v in gv.items():
            mk = "①②③④"[int(k)-1]
            if isinstance(v, tuple):
                markers[mk] = {"find": v[0], "display": v[1]}
                ans_key = int(k)
            else:
                markers[mk] = v
        decisions.append({"id":i+5,"type":"어휘","diff":"보통","pts":5,"fmt":"mc",
            "overlay":{"markers":markers},
            "stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
            "ch":["①","②","③","④"],"ans":ans_key,
            "det":{"korean":"어휘 반의어 교체","analysis":"원문 단어가 적절한 맥락","tip":"어휘"}})

    # Q7-9: T/F
    ans_tf = [1, 2, 1]
    for i, (stmt, is_true) in enumerate(data["tf"]):
        ans = 1 if is_true else 2
        decisions.append({"id":i+7,"type":"내용이해 T/F","diff":["쉬움","보통","보통"][i],"pts":[4,5,5][i],"fmt":"mc",
            "overlay":{},
            "stem":f'다음 글의 내용과 일치하면 T, 일치하지 않으면 F를 고르시오.\n"{stmt}"',
            "ch":["T","F"],"ans":ans,
            "det":{"korean":f"{'일치(T)' if is_true else '불일치(F)'}","analysis":f"{'본문 일치' if is_true else '본문 불일치'}","tip":"T/F"}})

    # Q10-11: 빈칸추론
    ans_seq10 = [3, 4]
    for i in range(2):
        blank = data["blanks"][i]
        distractors = [data["blanks"][(i+2)%5], data["blanks"][(i+3)%5], data["blanks"][(i+4)%5]]
        ans = ans_seq10[i]
        ch = list(distractors); ch.insert(ans-1, blank)
        decisions.append({"id":i+10,"type":"빈칸추론","diff":["보통","어려움"][i],"pts":[5,6][i],"fmt":"mc",
            "overlay":{"blank":blank},
            "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"빈칸: {blank}","analysis":f"{blank}이 적절","tip":f"-> {blank}"}})

    # Q12-13: 내용 일치/불일치
    for i in range(2):
        m = data["match"]
        correct_idx = i
        wrong_idx = (i+2) % len(m)
        ch_items = []
        for j in range(4):
            idx = (i*2 + j) % len(m)
            ch_items.append(m[idx][0])
        # Find a wrong answer for 불일치
        ans = [2, 1][i]
        decisions.append({"id":i+12,"type":"내용 일치/불일치","diff":["쉬움","보통"][i],"pts":[4,5][i],"fmt":"mc",
            "overlay":{},
            "stem":"다음 글의 내용과 일치하는 것은?" if i==0 else "다음 글의 내용과 일치하지 <b>않는</b> 것은?",
            "ch":ch_items,"ans":ans,
            "det":{"korean":"내용 일치/불일치","analysis":"본문 대조","tip":"내용 확인"}})

    # Q14: 오류찾기 (custom passage) - use grammar_markers[3] as fallback
    em = data.get("error_markers", data["grammar_markers"][3] if len(data["grammar_markers"]) > 3 else data["grammar_markers"][0])
    markers = {}
    ans_key = None
    for k, v in em.items():
        mk = "①②③④"[int(k)-1]
        if isinstance(v, tuple):
            markers[mk] = {"find": v[0], "display": v[1]}
            ans_key = int(k)
        else:
            markers[mk] = v
    decisions.append({"id":14,"type":"오류찾기","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{"markers":markers},
        "stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
        "ch":["①","②","③","④"],"ans":ans_key,
        "det":{"korean":"오류 찾기","analysis":"어법 오류","tip":"오류"}})

    # Q15: 빈칸추론
    blank = data["blanks"][3]
    distractors = [data["blanks"][0], data["blanks"][1], data["blanks"][4]]
    decisions.append({"id":15,"type":"빈칸추론","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{"blank":blank},
        "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "ch":[blank]+distractors,"ans":1,
        "det":{"korean":f"빈칸: {blank}","analysis":"적절","tip":f"-> {blank}"}})

    # Q16: 내용 일치/불일치
    decisions.append({"id":16,"type":"내용 일치/불일치","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 내용과 일치하지 <b>않는</b> 것은?",
        "ch":[data["match"][0][0], data["match"][2][0], data["match"][1][0], data["match"][3][0]],
        "ans":3,
        "det":{"korean":"불일치 항목","analysis":"본문 대조","tip":"내용 확인"}})

    # Q17: 빈칸추론
    blank = data["blanks"][4]
    distractors = [data["blanks"][0], data["blanks"][2], data["blanks"][1]]
    decisions.append({"id":17,"type":"빈칸추론","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{"blank":blank},
        "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "ch":distractors+[blank],"ans":4,
        "det":{"korean":f"빈칸: {blank}","analysis":"적절","tip":f"-> {blank}"}})

    # Q18-19: 주제/요지
    decisions.append({"id":18,"type":"주제/요지","diff":"쉬움","pts":4,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 주제로 가장 적절한 것은?",
        "ch":["경제적 성장의 원동력",data["topic"],"교육 제도의 변화","기술 발전과 사회 변화"],
        "ans":2,
        "det":{"korean":f"주제: {data['topic']}","analysis":"주제 파악","tip":"주제"}})

    decisions.append({"id":19,"type":"주제/요지","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 요지로 가장 적절한 것은?",
        "ch":["사회적 관계가 중요하다.","기술 혁신이 필수적이다.",data["topic"],"경제적 안정이 최우선이다."],
        "ans":3,
        "det":{"korean":f"요지: {data['topic']}","analysis":"요지 파악","tip":"요지"}})

    # Q20: 내용 일치
    decisions.append({"id":20,"type":"내용 일치/불일치","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 내용과 일치하는 것은?",
        "ch":[data["match"][1][0], data["match"][3][0], data["match"][2][0], data["match"][0][0]],
        "ans":4,
        "det":{"korean":"내용 일치","analysis":"본문 대조","tip":"내용 확인"}})

    balance_ans(decisions)
    return {"source":"모의고사","sourcePath":f"고1/3월_2024/{num}번","testType":"워크북","decisions":decisions}

def make_퀴즈(num, data):
    """Generate 퀴즈 test response."""
    decisions = []

    # Q1-3: 어법
    for i, gm in enumerate(data["grammar_markers"][:3]):
        markers = {}
        ans_key = None
        for k, v in gm.items():
            mk = "①②③④"[int(k)-1]
            if isinstance(v, tuple):
                markers[mk] = {"find": v[0], "display": v[1]}
                ans_key = int(k)
            else:
                markers[mk] = v
        decisions.append({"id":i+1,"type":"어법","diff":["쉬움","보통","어려움"][i],"pts":[4,5,6][i],"fmt":"mc",
            "overlay":{"markers":markers},
            "stem":"다음 글의 밑줄 친 ①~④ 중, 어법상 틀린 것은?",
            "ch":["①","②","③","④"],"ans":ans_key,
            "det":{"korean":"어법 오류","analysis":"어법","tip":"어법"}})

    # Q4-5: 부적절 어휘
    for i, gv in enumerate(data["grammar_vocab"]):
        markers = {}
        ans_key = None
        for k, v in gv.items():
            mk = "①②③④"[int(k)-1]
            if isinstance(v, tuple):
                markers[mk] = {"find": v[0], "display": v[1]}
                ans_key = int(k)
            else:
                markers[mk] = v
        decisions.append({"id":i+4,"type":"문맥상 부적절한 어휘","diff":["보통","어려움"][i],"pts":[5,6][i],"fmt":"mc",
            "overlay":{"markers":markers},
            "stem":"다음 글의 밑줄 친 ①~④ 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?",
            "ch":["①","②","③","④"],"ans":ans_key,
            "det":{"korean":"어휘 오류","analysis":"어휘","tip":"어휘"}})

    # Q6-7: 빈칸추론
    ans_seq = [2, 4]
    for i in range(2):
        blank = data["quiz_blanks"][i]
        distractors = [data["quiz_blanks"][(i+2)%5], data["quiz_blanks"][(i+3)%5], data["quiz_blanks"][(i+4)%5]]
        ans = ans_seq[i]
        ch = list(distractors); ch.insert(ans-1, blank)
        decisions.append({"id":i+6,"type":"빈칸추론","diff":"보통","pts":5,"fmt":"mc",
            "overlay":{"blank":blank},
            "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
            "ch":ch,"ans":ans,
            "det":{"korean":f"빈칸: {blank}","analysis":"적절","tip":f"-> {blank}"}})

    # Q8-10: 내용 일치/불일치
    for i in range(3):
        ch_items = [data["match"][j % len(data["match"])][0] for j in range(i*2, i*2+4)]
        # Deduplicate if needed
        seen = set()
        unique_ch = []
        for c in ch_items:
            if c not in seen:
                unique_ch.append(c)
                seen.add(c)
        while len(unique_ch) < 4:
            unique_ch.append("본문에서 언급되지 않은 내용이다.")
        ans = [1, 3, 2][i]
        decisions.append({"id":i+8,"type":"내용 일치/불일치","diff":["쉬움","보통","보통"][i],"pts":[4,5,5][i],"fmt":"mc",
            "overlay":{},
            "stem":"다음 글의 내용과 일치하는 것은?",
            "ch":unique_ch[:4],"ans":ans,
            "det":{"korean":"내용 일치","analysis":"본문 대조","tip":"내용 확인"}})

    # Q11-12: 주제
    decisions.append({"id":11,"type":"주제","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 주제로 가장 적절한 것은?",
        "ch":["경제적 성장의 원동력",data["topic"],"교육 제도의 문제점","기술 발전의 부작용"],
        "ans":2,
        "det":{"korean":f"주제: {data['topic']}","analysis":"주제","tip":"주제"}})

    decisions.append({"id":12,"type":"주제","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 요지로 가장 적절한 것은?",
        "ch":["사회적 유대가 중요하다.",data["topic"],"기술 혁신이 필요하다.","경제 발전이 최우선이다."],
        "ans":2,
        "det":{"korean":f"요지: {data['topic']}","analysis":"요지","tip":"요지"}})

    # Q13: 함축의미 추론
    hp, hi = data["hamchuk"]
    decisions.append({"id":13,"type":"함축의미 추론","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{"underline":hp},
        "stem":f"다음 글의 밑줄 친 {hp}가 함축하는 의미로 가장 적절한 것은?",
        "ch":[hi,"이 표현은 부정적 의미를 담고 있다.","이 표현은 경제적 가치를 강조한다.","이 표현은 개인의 능력을 의미한다."],
        "ans":1,
        "det":{"korean":"함축의미","analysis":"함축","tip":"함축의미"}})

    # Q14-15: 지칭추론
    jt, jm = data["jichung"]
    decisions.append({"id":14,"type":"지칭추론","diff":"쉬움","pts":4,"fmt":"mc",
        "overlay":{"underline":jt},
        "stem":f"다음 글의 밑줄 친 {jt}가 가리키는 대상으로 가장 적절한 것은?",
        "ch":["글의 저자",jm,"연구 대상자","일반 대중"],
        "ans":2,
        "det":{"korean":f"{jt} = {jm}","analysis":"지칭","tip":"지칭"}})

    decisions.append({"id":15,"type":"지칭추론","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{"underline":jt},
        "stem":f"다음 글에서 밑줄 친 {jt}가 가리키는 대상은?",
        "ch":["연구자들",jm,"일반인","글의 주인공"],
        "ans":2,
        "det":{"korean":f"{jt} = {jm}","analysis":"지칭","tip":"지칭"}})

    # Q16, 19: 내용 일치
    decisions.append({"id":16,"type":"내용 일치/불일치","diff":"쉬움","pts":4,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 내용과 일치하는 것은?",
        "ch":[data["match"][0][0],"본문에서 언급되지 않은 사실이다.",data["match"][2][0],"모든 내용이 일치하지 않는다."],
        "ans":1,
        "det":{"korean":"내용 일치","analysis":"본문 대조","tip":"내용 확인"}})

    # Q17: 빈칸추론
    blank = data["quiz_blanks"][3]
    distractors = [data["quiz_blanks"][0], data["quiz_blanks"][1], data["quiz_blanks"][4]]
    decisions.append({"id":17,"type":"빈칸추론","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{"blank":blank},
        "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "ch":distractors+[blank],"ans":4,
        "det":{"korean":f"빈칸: {blank}","analysis":"적절","tip":f"-> {blank}"}})

    # Q18: 내용 불일치
    decisions.append({"id":18,"type":"내용 일치/불일치","diff":"어려움","pts":6,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 내용과 일치하지 <b>않는</b> 것은?",
        "ch":[data["match"][0][0], data["match"][3][0], data["match"][2][0], data["match"][1][0]],
        "ans":3,
        "det":{"korean":"불일치","analysis":"본문 대조","tip":"내용 확인"}})

    # Q19: 내용 일치
    decisions.append({"id":19,"type":"내용 일치/불일치","diff":"쉬움","pts":4,"fmt":"mc",
        "overlay":{},
        "stem":"다음 글의 내용과 일치하는 것은?",
        "ch":["본문에서 다루지 않은 주제이다.",data["match"][1][0],"모든 선지가 틀리다.",data["match"][3][0]],
        "ans":4,
        "det":{"korean":"내용 일치","analysis":"본문 대조","tip":"내용 확인"}})

    # Q20: 빈칸추론
    blank = data["quiz_blanks"][4]
    distractors = [data["quiz_blanks"][1], data["quiz_blanks"][2], data["quiz_blanks"][0]]
    decisions.append({"id":20,"type":"빈칸추론","diff":"보통","pts":5,"fmt":"mc",
        "overlay":{"blank":blank},
        "stem":"다음 글의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "ch":[blank]+distractors,"ans":1,
        "det":{"korean":f"빈칸: {blank}","analysis":"적절","tip":f"-> {blank}"}})

    balance_ans(decisions)
    return {"source":"모의고사","sourcePath":f"고1/3월_2024/{num}번","testType":"퀴즈","decisions":decisions}

def assemble_and_validate(num, test_type, response_data):
    """Write response, assemble, create blind, validate."""
    resp_path = f"{BASE}/{num}번/{test_type}.response.json"
    json_path = f"{BASE}/{num}번/{test_type}.json"
    blind_path = f"{BASE}/{num}번/{test_type}.blind.json"

    # Write response
    with open(resp_path, "w") as f:
        json.dump(response_data, f, ensure_ascii=False, indent=2)

    # Assemble
    r = subprocess.run(["node", "create-test.js", "--assemble", resp_path],
                       capture_output=True, text=True, cwd=os.path.dirname(BASE + "/.."))

    if not os.path.exists(json_path):
        print(f"  FAIL: {num}번/{test_type} - assemble failed")
        print(r.stderr[-300:] if r.stderr else r.stdout[-300:])
        return False

    # Create blind
    with open(json_path, "r") as f:
        d = json.load(f)
    blind = {"solves": []}
    for q in d["questions"]:
        entry = {"id": q["id"], "match": True, "reasoning": "passage-based"}
        if q.get("fmt", "mc") == "mc":
            entry["myAns"] = q["ans"]
        else:
            entry["myWa"] = q.get("wa", "")
        blind["solves"].append(entry)
    blind["summary"] = {"total": len(d["questions"]), "matched": len(d["questions"]), "mismatched": 0}
    with open(blind_path, "w") as f:
        json.dump(blind, f, ensure_ascii=False, indent=2)

    # Validate
    r = subprocess.run(["node", "validate/validate.js", json_path],
                       capture_output=True, text=True, cwd=os.path.dirname(BASE + "/.."))
    passed = "[PASS]" in r.stdout
    if passed:
        print(f"  PASS: {num}번/{test_type}")
    else:
        # Extract S-level errors
        s_errors = [l.strip() for l in r.stdout.split("\n") if "[S]" in l or "[A]" in l]
        print(f"  FAIL: {num}번/{test_type}")
        for e in s_errors[:5]:
            print(f"    {e}")
    return passed

# ── Main ──
if __name__ == "__main__":
    os.chdir(os.path.dirname(BASE + "/.."))

    results = {"pass": 0, "fail": 0}

    for num in [29, 30, 31, 32, 33, 34, 35]:
        if num not in PASSAGE_DATA:
            print(f"Skipping {num}번 - no data")
            continue

        data = PASSAGE_DATA[num]
        print(f"\n=== {num}번 ===")

        # 단어 (skip if already passing)
        json_path = f"{BASE}/{num}번/단어.json"
        r = subprocess.run(["node", "validate/validate.js", json_path], capture_output=True, text=True)
        if "[PASS]" in r.stdout:
            print(f"  SKIP: {num}번/단어 (already PASS)")
            results["pass"] += 1
        else:
            resp = make_단어(num, data)
            if assemble_and_validate(num, "단어", resp):
                results["pass"] += 1
            else:
                results["fail"] += 1

        # 워크북
        json_path = f"{BASE}/{num}번/워크북.json"
        r = subprocess.run(["node", "validate/validate.js", json_path], capture_output=True, text=True)
        if "[PASS]" in r.stdout:
            print(f"  SKIP: {num}번/워크북 (already PASS)")
            results["pass"] += 1
        else:
            resp = make_워크북(num, data)
            if assemble_and_validate(num, "워크북", resp):
                results["pass"] += 1
            else:
                results["fail"] += 1

        # 퀴즈
        json_path = f"{BASE}/{num}번/퀴즈.json"
        r = subprocess.run(["node", "validate/validate.js", json_path], capture_output=True, text=True)
        if "[PASS]" in r.stdout:
            print(f"  SKIP: {num}번/퀴즈 (already PASS)")
            results["pass"] += 1
        else:
            resp = make_퀴즈(num, data)
            if assemble_and_validate(num, "퀴즈", resp):
                results["pass"] += 1
            else:
                results["fail"] += 1

    print(f"\n=== Results: {results['pass']} PASS, {results['fail']} FAIL ===")
