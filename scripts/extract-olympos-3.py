#!/usr/bin/env python3
"""올림포스 3강 _passages JSON 생성 — PDF 이미지에서 읽은 원문 기반"""
import json, os

BASE = os.path.expanduser("~/Desktop/영어해방공식&내신핏/naesinfit-tests/data/부교재/올림포스전국연합고2/2026/3강")

# 각 섹션별 메타 + fullPassage
sections = {
    "학평": {
        "title": "주장 추론 — 사람들과 접촉하는 열린 리더십",
        "exam": "2025년 06월 고2 학평 20번",
        "fullPassage": "Imagine that you have the best tea in the world and you put it into a bag that's impermeable. It won't work. You just won't be able to make a cup of tea. For the teabag to work, it needs to be porous. You need the tea and the water to come in contact with each other. In our lives too, we cannot survive and thrive in isolation. Leaders need to be careful not to build walls around themselves that prevent people from reaching out to them. As a leader, you need to be able to touch other people. The tea was meant to mix with the water. Similarly, all of us were designed to work with other people, with teams, and with society at large."
    },
    "Ex01": {
        "title": "주장 추론 — 기다림에 대한 전술: 도약의 기회로 관점의 전환",
        "exam": "2025년 09월 고2 학평 20번",
        "fullPassage": '"Tactics" is a term drawn from military usage. Strategies are plans of action directing a military force when attacking another, and tactics are responses to conditions on the ground. In this vein, time is imposed on us by our cultures, by the technologies that have regimented time down to the nanosecond, and by its own finite nature and the fact that we\'re going to live only so long. In response, we must develop tactics for dealing with time and waiting. These aren\'t tactics to eliminate waiting; instead, these are tactics for teaching us how to learn from the seams. These tactics have the potential to reorient us in profound ways, transforming our perspectives on our wait times. Such renewed perspectives transform waiting from a burden to a springboard toward things like creativity, social critique, or reflection on our inner state and the state of our relationships.'
    },
    "Ex02": {
        "title": "주장 추론 — 팬의 권리는 선수에 대한 의무를 동반해야 한다",
        "exam": "2025년 03월 고2 학평 20번",
        "fullPassage": "Fans who are inclined to spend a lot of time thinking about what athletes owe them as fans should also think about the corresponding obligations that fans might have as fans. One who thinks only about what they are entitled to receive from their friends without ever giving a moment's thought to what they owe their friends is, to put it mildly, not a very good friend. Similarly, fans who only think about what athletes owe them without ever thinking about what they owe to athletes have failed to take the fan/athlete relationship all that seriously. As in nearly every other area of human life, whatever special rights fans may possess are limited by a corresponding set of obligations, and fans who never think about how they can be better fans even as they confidently opine about what athletes owe them are hardly fulfilling their end of the bargain."
    },
    "Ex03": {
        "title": "주장 추론 — 비판적 사고를 통한 의사 결정 능력이 수학적 맥락에서 함양되어야 한다",
        "exam": "2024년 10월 고2 학평 20번",
        "fullPassage": "To be mathematically literate means to be able to think critically about societal issues on which mathematics has bearing, so as to make informed decisions about how to solve these problems. Dealing with such complex problems through interdisciplinary approaches, mirroring real-world problems, requires innovative ways of planning and organizing mathematical teaching methods. Navigating our world means being able to quantify, measure, estimate, classify, compare, find patterns, conjecture, justify, prove, and generalize within critical thinking and when using critical thinking. Therefore, making decisions, even qualitatively, is not possible without using mathematics and critical thinking. Thus, teaching mathematics should be done in interaction with critical thinking along with a decision-making process. They can be developed into the mathematical context, so that there is no excuse to not explicitly support students to develop them."
    },
    "Ex04": {
        "title": "주장 추론 — 아이에게 자기 의지로 걱정을 멈출 수 있음을 알려주어야 한다",
        "exam": "2024년 09월 고2 학평 20번",
        "fullPassage": "Merely convincing your children that worry is senseless and that they would be more content if they didn't worry isn't going to stop them from worrying. For some reason, young people seem to believe that worry is a fact of life over which they have little or no control. Consequently, they don't even try to stop. Therefore, you need to convince them that worry, like guilt and fear, is nothing more than an emotion, and like all emotions, is subject to the power of the will. Tell them that they can eliminate worry from their lives by simply refusing to attend to it. Explain to them that if they refuse to act worried regardless of how they feel, they will eventually stop feeling worried and will begin to experience the contentment that accompanies a worry-free life."
    },
    "Ex05": {
        "title": "주장 추론 — 진정한 자기평가를 위한 내면을 들여다볼 필요성",
        "exam": "2024년 06월 고2 학평 20번",
        "fullPassage": 'Most people resist the idea of a true self-estimate, probably because they fear that it might mean downgrading some of their beliefs about who they are and what they\'re capable of. As Goethe\'s maxim goes, it is a great failing "to see yourself as more than you are." How could you really be considered self-aware if you refuse to consider your weaknesses? Don\'t fear self-assessment because you\'re worried that you might have to admit some things about yourself. The second half of Goethe\'s maxim is important too. He states that it is equally damaging "to value yourself at less than your true worth." We underestimate our capabilities just as much and just as dangerously as we overestimate other abilities. Cultivate the ability to judge yourself accurately and honestly. Look inward to discern what you\'re capable of and what it will take to unlock that potential.'
    },
    "Ex06": {
        "title": "주장 추론 — 성공을 이루기 위한 인내심 배양의 중요성",
        "exam": "2024년 03월 고2 학평 20번",
        "fullPassage": "Too many times people, especially in today's generation, expect things to just happen overnight. When we have these false expectations, it tends to discourage us from continuing to move forward. Because this is a high tech society, everything we want has to be within the parameters of our comfort and convenience. If it doesn't happen fast enough, we're tempted to lose interest. So many people don't want to take the time that it requires to be successful. Success is not a matter of mere desire; you should develop patience in order to achieve it. Have you fallen prey to impatience? Great things take time to build."
    },
    "Ex07": {
        "title": "주장 추론 — 농업이 직면한 문제 해결 및 식량과 농산물의 지속적 생산을 위한 방안이 필요하다",
        "exam": "2023년 11월 고2 학평 20번",
        "fullPassage": "Agriculture includes a range of activities such as planting, harvesting, fertilizing, pest management, raising animals, and distributing food and agricultural products. It is one of the oldest and most essential human activities, dating back thousands of years, and has played a critical role in the development of human civilizations, allowing people to create stable food supplies and settle in one place. Today, agriculture remains a vital industry that feeds the world's population, supports rural communities, and provides raw materials for other industries. However, agriculture faces numerous challenges such as climate change, water scarcity, soil degradation, and biodiversity loss. As the world's population continues to grow, it is essential to find sustainable solutions to address the challenges facing agriculture and ensure the continued production of food and other agricultural products."
    },
    "Ex08": {
        "title": "주장 추론 — 문제를 보이는 직원에게 인격적 특성보다는 행동 방식에 대해 제안하라",
        "exam": "2023년 09월 고2 학평 20번",
        "fullPassage": 'Managers frequently try to play psychologist, to "figure out" why an employee has acted in a certain way. Empathizing with employees in order to understand their point of view can be very helpful. However, when dealing with a problem area, in particular, remember that it is not the person who is bad, but the actions exhibited on the job. Avoid making suggestions to employees about personal traits they should change; instead suggest more acceptable ways of performing. For example, instead of focusing on a person\'s "unreliability," a manager might focus on the fact that the employee "has been late to work seven times this month." It is difficult for employees to change who they are; it is usually much easier for them to change how they act.'
    },
    "Ex09": {
        "title": "주장 추론 — 신기술의 도입으로 인한 잠재적인 영향들을 충분히 고려해야 한다",
        "exam": "2023년 06월 고2 학평 20번",
        "fullPassage": "The introduction of new technologies clearly has both positive and negative impacts for sustainable development. Good management of technological resources needs to take them fully into account. Technological developments in sectors such as nuclear energy and agriculture provide examples of how not only environmental benefits but also risks to the environment or human health can accompany technological advances. New technologies have profound social impacts as well. Since the industrial revolution, technological advances have changed the nature of skills needed in workplaces, creating certain types of jobs and destroying others, with impacts on employment patterns. New technologies need to be assessed for their full potential impacts, both positive and negative."
    },
    "Ex10": {
        "title": "주장 추론 — 조직의 신뢰 형성을 위해 구성원에 대한 평가 요소가 명확해야 한다",
        "exam": "2022년 11월 고2 학평 20번",
        "fullPassage": "Clarity in an organization keeps everyone working in one accord and energizes key leadership components like trust and transparency. No matter who or what is being assessed in your organization, what they are being assessed on must be clear and the people must be aware of it. If individuals in your organization are assessed without knowing what they are being assessed on, it can cause mistrust and move your organization away from clarity. For your organization to be productive, cohesive, and successful, trust is essential. Failure to have trust in your organization will have a negative effect on the results of any assessment. It will also significantly hinder the growth of your organization. To conduct accurate assessments, trust is a must \u2014 which comes through clarity. In turn, assessments help you see clearer, which then empowers your organization to reach optimal success."
    },
    "Ex11": {
        "title": "주장 추론 — 나를 위한 시간의 중요성을 인식해야 한다",
        "exam": "2022년 09월 고2 학평 20번",
        "fullPassage": "We usually take time out only when we really need to switch off, and when this happens, we are often overtired, sick, and in need of recuperation. Me time is complicated by negative associations with escapism, guilt, and regret as well as with overwhelm, stress, and fatigue. All these negative connotations mean that we tend to steer clear of it. Well, I am about to change your perception of the importance of me time, to persuade you that you should view it as vital for your health and wellbeing. Take this as permission to set aside some time for yourself! Our need for time in which to do what we choose is increasingly urgent in an overconnected, overwhelmed, and overstimulated world."
    },
    "Ex12": {
        "title": "주장 추론 — 자녀가 다른 문화를 가능한 한 자주 접할 수 있게 해야 한다",
        "exam": "2022년 03월 고2 학평 20번",
        "fullPassage": "Though we are marching toward a more global society, various ethnic groups traditionally do things quite differently, and a fresh perspective is valuable in creating an open-minded child. Extensive multicultural experience makes kids more creative, measured by how many ideas they can come up with and by association skills, and allows them to capture unconventional ideas from other cultures to expand on their own ideas. As a parent, you should expose your children to other cultures as often as possible. If you can, travel with your child to other countries; live there if possible. If neither is possible, there are lots of things you can do at home, such as exploring local festivals, borrowing library books about other cultures, and cooking foods from different cultures at your house."
    }
}

# JSON 파일 생성
for section, data in sections.items():
    dirpath = os.path.join(BASE, section)
    os.makedirs(dirpath, exist_ok=True)

    # _passages 파일 생성
    passages_dir = os.path.join(BASE, "_passages")
    os.makedirs(passages_dir, exist_ok=True)

    passage_file = os.path.join(passages_dir, f"{section}.json")
    with open(passage_file, 'w', encoding='utf-8') as f:
        json.dump({
            "section": section,
            "title": data["title"],
            "exam": data["exam"],
            "fullPassage": data["fullPassage"]
        }, f, ensure_ascii=False, indent=2)

print(f"Created {len(sections)} _passages files")

# 확인
for section in sections:
    fp = os.path.join(BASE, "_passages", f"{section}.json")
    size = os.path.getsize(fp)
    print(f"  {section}.json: {size} bytes")
