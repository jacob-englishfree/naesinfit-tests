const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data/모의고사/고3/9월');

// All passages from the 2026학년도 대학수학능력시험 9월 모의평가 영어
const passages = {
  "19": {
    title: "19번 - 심경변화",
    passage: `Sierra shook as she walked back and forth in front of her professor's office. The week before, she had turned in her art assignment and today, Professor Fox had asked Sierra to come see her. "Oh, no." Sierra thought, "What if she thinks my paintings are horrible?" Sierra's sweating hand turned the door handle. Professor Fox smiled and said, "Sierra, your paintings were amazing and so unique! Can I display them at the school exhibition?" Sierra smiled brightly as she exclaimed, "Oh, this is so wonderful! It's always been a dream of mine to share my art with others! This is the best day ever!"`,
    qType: "심경변화"
  },
  "20": {
    title: "20번 - 주장",
    passage: `Showing up late for work and using abusive language are the kinds of problems that every business wants to eliminate. Business leaders looking to achieve this often focus on finding "bad apples" who break their rules and then punishing them. This assumes that the bad apples are acting badly on purpose. In fact, one common reason that employees give for breaking rules is that they were unaware their behavior was undesirable. There are some actors who knowingly act against policy, but many problems are unintentional failings. If businesses want better employees, those businesses must create clear standards and educate their employees directly about how to follow them. Without these standards there would be no way to distinguish bad apples from merely uninformed apples.`,
    qType: "주장"
  },
  "21": {
    title: "21번 - 함축의미",
    passage: `Here is a fundamental quality of music. Note names repeat because of a perceptual phenomenon that corresponds to the doubling and halving of frequencies. When we double a frequency, we end up with a note that sounds remarkably similar to the one we started out with. This relationship, a frequency ratio of 2:1 or 1:2, is called the octave. It is so important that, in spite of the large differences that exist between musical cultures, every culture we know of has the octave as the basis for its music, even if it has little else in common with other musical traditions. This phenomenon leads to the notion of circularity in pitch perception, and is similar to circularity in colors. Although red and violet fall at opposite ends of the continuum of visible frequencies of electromagnetic energy, we see them as perceptually similar. The same is true in music, and music is often described as having two dimensions, one that accounts for tones going up in frequency and another that accounts for the perceptual sense that we've come back home again each time we double a tone's frequency.`,
    qType: "함축의미"
  },
  "22": {
    title: "22번 - 요지",
    passage: `One reason that people participate in social media is because it builds social relations. We increase our social capital when we successfully engage in social media. Social capital describes the networks of relationships we have that are built on mutuality and sharing of identity, understanding, norms and values. We build ties that may pay off with a job lead or a letter of recommendation. We reinforce our identities through our online presentation in a personal blog or our profile. "The premise behind the notion of social capital is rather simple and straightforward: investment in social relations with expected returns," noted sociologist Nan Lin. Lin's work stresses that it is who you know as much as what you know that shapes our experience in society. With new media, our reach of connecting is all the greater, expanding our "who you know" to greater and greater lengths.`,
    qType: "요지"
  },
  "23": {
    title: "23번 - 주제",
    passage: `In writing a life, the life narrator and the biographer engage different kinds of evidence. Most biographers incorporate multiple forms of evidence, including historical documents, interviews, and family archives, which they evaluate for validity. Relatively few biographers use their personal memories of their subject as reliable evidence, unless they had a personal relationship to the subject of the biography (as a relative, child, friend, or colleague). For life narrators, by contrast, personal memories are the primary archival source. They may have recourse to other kinds of sources — letters, journals, photographs, conversations — and to their knowledge of a historical moment. But the usefulness of such evidence for their stories lies in the ways in which they employ that evidence to support, supplement, or offer commentary on their personalized acts of remembering. In autobiographical narratives, imaginative acts of remembering always overlap with such rhetorical acts as assertion, justification, judgment, conviction, and questioning.`,
    qType: "주제"
  },
  "24": {
    title: "24번 - 제목",
    passage: `Monasteries were the engine rooms of the Middle Ages. At the height of their activities and influence, monasteries provided intellectual leadership for the institutions of Church and civil governments, innovation in religious thought and practice, medical provision, education, visual culture and agricultural development. They did all this while apparently observing self-imposed isolation from the wider community. For monasteries were intended to function as places set apart from the world, in which monks devoted their lives to a permanent rhythm of religious observance, prayer and study. Religious prayer and praise lay at the heart of monasticism. Both those following this life and those outside believed that monastic lives were led for the benefit of wider society, and that the sacrifices made by monks in separating themselves from 'normal' human contact functioned as penances on behalf of the community as well as for their own deliverance. Monks were regarded as leading parallel lives that had the power to save themselves and others.`,
    qType: "제목"
  },
  "26": {
    title: "26번 - 내용불일치",
    passage: `Claude Shannon was an American mathematician and information scientist, famous for being the "father of information theory." As a child, he was interested in electrical devices and built a telegraph that connected to his friend's home half a mile away. At age 21, he started his master's program in electrical engineering. His master's thesis on digital computing theory has been called the "most important master's thesis of all time." During World War II, he worked to help win the war by inventing a machine that helped destroy German rockets. In 1950, with the help of his wife, he built a machine capable of learning by itself. This machine was viewed as part of the foundation of Artificial Intelligence. In 1958, he became a full professor at MIT and continued to teach there for more than 20 years. A biography written about his life called him, the "most important genius you've never heard of."`,
    qType: "내용불일치"
  },
  "29": {
    title: "29번 - 어법",
    passage: `Honey can be eaten by itself or mixed with other ingredients. Natural or pure honey has had no additives, preservatives or synthetic ingredients added. Also ①referred to as 'undiluted', it is usually more expensive than diluted honeys. Natural honey can also be called 'blended honey', ②which honeys from various sources are blended together — not by the bees, but by human processors and distributors in stages after the honey has been collected. Blending is frequently done for taste as well as marketing reasons, especially since some consumers find the darker honeys too ③strong. Mixing different types of honey together can make it more palatable, and also gives a more uniform flavour — this is an important consideration for producers and retailers, who ④feel the need to guarantee reliable, unsurprising (typically mild) flavours to their customers. Clover is one of the most popular honeys in the U.S., and ⑤its mild flavour and taste have become familiar to many Americans.`,
    qType: "어법"
  },
  "30": {
    title: "30번 - 어휘",
    passage: `What is soft-path river engineering? One way to visualize its spirit is to liken it to a footpath in the forest. Suppose a tree falls across a footpath. A soft-path response would be simply to redirect the trail around the fallen tree. A more interventionist response would be to ①remove the tree and restore the original route. A still more interventionist response might be to straighten and pave the path to insert it more ②permanently in the landscape. The true high-modernist step would, of course, be to ③create a superhighway that removes the landscape and bulldozes straight through all obstacles in the topography. Soft-path engineering has the unique advantage of intellectual ④modesty with respect to what we actually know about river movement and its environmental effects. In contrast to hard-path engineering, soft-path engineering accepts variability in the river's movement as ⑤insignificant until proven otherwise. Backwaters, short-lived wetlands, braids and channels, swamps — all undesirable to hard-path engineering — are presumed by soft-path engineers to be ecologically important.`,
    qType: "어휘"
  },
  "31": {
    title: "31번 - 빈칸추론",
    passage: `We know that animals have evolved a variety of patterns to manipulate the perceptions of their predators to afford themselves a modicum of safety. Greater Bower birds utilize __________________ in the mating domain. Males construct a bower; its function is to provide an arena in which males display to females standing in an avenue that leads up to the bower. The males decorate the avenue with a variety of objects, such as stones and shells. But they do not do so in a chaotic manner. The larger objects are placed closer to the bower and the smaller objects farther away. This creates a forced perspective the opposite of the Cinderella Castle; the bower appears smaller than it actually is. Endler and his colleagues suggested that the male courting in the bower now appears larger and thus more attractive to the female. Data on male mating success collected in the wild supports their hypothesis.`,
    qType: "빈칸추론"
  },
  "32": {
    title: "32번 - 빈칸추론",
    passage: `Although empathy is widely praised by scholars and public figures, not everyone is an empathy booster. Critics of empathy argue that empathy will not save us from interpersonal and intergroup conflict. In fact, they argue, empathy makes such conflicts worse. These critics maintain that empathy can be exhausting and lead to burnout, insensitivity to suffering, or worse. They argue that we tend to empathize strongly with our in-group and resist empathizing with out-groups, and even enjoy the suffering of out-groups in competitive or threatening contexts. Thus, the prescription for more empathy __________________, they argue, can further entrench conflict and force us into an us vs. them mentality. Finally, even when we try to empathize with others who are dissimilar from us or in unfamiliar contexts, sometimes we are unable to accurately empathize with their experiences, causing further misunderstandings and frustration. Critics of empathy argue that we should give up on empathy and employ other tools in pursuit of social harmony, e.g., rational compassion or moral emotions like fear, anger, and shame.`,
    qType: "빈칸추론"
  },
  "33": {
    title: "33번 - 빈칸추론",
    passage: `Compared to other ecosystems, forests are relatively diverse, but this should not necessarily be __________________. Wetlands, meadows, and grasslands have a unique biota too, even if it is often not as rich as a forest biota. The ecological problems of this process have been described from a number of places such as Iceland, South Africa, and Australia, but the classic example of this comes from Scotland and northern England. Here the Forestry Commission has drained, fertilized, and fenced extensive areas of wetlands to facilitate turning them into forests. Increasing the extent of forests in Britain is certainly a desirable goal, and most of the Forestry Commission's efforts are directed toward sites that were forested before sheep and their keepers came to the island. However, ecologists frequently complain about the Commission's work because it is not restricted to former forest sites, because the forests established are usually composed of exotic trees, and because the wildlife threatened by this activity includes many uncommon species.`,
    qType: "빈칸추론"
  },
  "34": {
    title: "34번 - 빈칸추론",
    passage: `When gathering the preferences of multiple agents into one collective choice, it is easily seen that certain cases __________________. For example, if there are two alternatives, a and b, and two agents such that one prefers a and the other one b, there is no deterministic way of selecting a single alternative without violating one of two basic fairness conditions known as anonymity and neutrality. Anonymity requires that the collective choice ought to be independent of the agents' identities whereas neutrality requires impartiality towards the alternatives. Allowing lotteries as social outcomes hence seems like a necessity for impartial collective choice. Indeed, most common "deterministic" social choice functions such as plurality rule are only deterministic as long as there is no tie, which is usually resolved by drawing a lot. The use of lotteries for the selection of officials interestingly goes back to the world's first democracy in Athens, where it was widely regarded as a principal characteristic of democracy, and has recently gained increasing attention in political science.`,
    qType: "빈칸추론"
  },
  "35": {
    title: "35번 - 무관한문장",
    passage: `All workers need access to mentors that can provide them with valuable information about their job, their workplace, and the resources that are available within their organization. Mentors also provide much needed psychosocial support. ① Having a diverse network of mentors is important for dominant and minority group members alike. ② Minority group members need diverse mentors so that they can gain insight into what it means to be employed by a particular organization or in a particular field or profession. ③ Majority workers benefit by having a network of diverse mentors because it increases their understanding and sensitivity to the unique realities of diverse workers and their own identity, and perhaps even their own forms of privilege. ④ Mentoring has been typically required and praised as an essential component in the personal development of employers. ⑤ The ultimate goal of these mentoring opportunities is to have individuals be more informed, identified, and engaged in their work and in their organization.`,
    qType: "무관한문장"
  },
  "36": {
    title: "36번 - 순서",
    passage: `Traditionally, when teachers teach writing, they assign topics for students to write on; perhaps they do a bit of brainstorming about the topic during a pre-writing phase, and then have students write about the topic without interruption.`,
    extraA: `(A) In process writing, on the other hand, students may initially brainstorm ideas about a topic and begin writing, but then they have repeated conferences with the teacher and the other students, during which they receive feedback on their writing up to that point, make revisions, based on the feedback they receive, and carry on writing.`,
    extraB: `(B) In this way, students learn to view their writing as someone else's reading and to improve both the expression of meaning and the form of their writing as they draft and redraft. Process writing shifts the emphasis in teaching writing from evaluation to revision.`,
    extraC: `(C) Subsequently, teachers collect and evaluate what students have written. Such instruction is very 'product-oriented;' there is no involvement of the teacher in the act or 'process' of writing.`,
    qType: "순서"
  },
  "37": {
    title: "37번 - 순서",
    passage: `Perhaps at some point you have seen some mathematical writing and not understood it.`,
    extraA: `(A) The complicated notations that might spring to mind — all those strange dashes, squiggles and letters — are obvious signs, but a lot of those are really quite modern. Mathematics had been going on for a long time before the dashes and squiggles were invented.`,
    extraB: `(B) You would not be the first; rest assured, even professional mathematicians sometimes have to rely on discussions with colleagues to properly understand problems they are looking at. But how do you recognise some writing is mathematical in the first place?`,
    extraC: `(C) Put simply, there has to be something mathematical going on for us to say that it is mathematics. And if we are dealing with writing from a very distant past, in a language that is not familiar to us, from a time even before recorded language, that can be sometimes difficult to recognise.`,
    qType: "순서"
  },
  "38": {
    title: "38번 - 문장삽입",
    passage: `As winter approaches, the length of the day shortens, the temperature drops, and plants, including trees, can detect this change.`,
    mainText: `It is worth pointing out that leaves don't drop to the ground because they are dying — rather, the tree initiates an active process of clever recycling called senescence. A tree, like an oak for example, would struggle to survive through a harsh winter if it retained its canopy of leaves. ( ① ) It would risk damage from strong winds and would lose more water from its leaves than it could draw up from the frozen ground. ( ② ) If it didn't blow over, it would die of thirst. ( ③ ) It signals to them that it is time to lose their leaves. ( ④ ) First, however, trees carefully suck all of the useful nutrients out of the leaves and then, with surgical precision, block up that pathway into the leaves. ( ⑤ ) That blocked pathway at the base of the leaf stem creates a weakness and, in the wind, the leaves snap off and fall to the ground.`,
    qType: "문장삽입"
  },
  "39": {
    title: "39번 - 문장삽입",
    passage: `The problem of survival lies at the root of many of the historian's problems, for what has survived may not necessarily be more significant than what has not survived.`,
    mainText: `Historians use evidence in order to understand what happened and why it happened. In architectural history this evidence may take the form of the buildings themselves or their remains, and documents such as plans, drawings, descriptions, diaries or bills. ( ① ) Our picture of any period of history is derived from a multitude of sources, such as the paintings, literature, deeds, buildings and other artefacts that have survived. ( ② ) The Egyptian pyramids have survived thousands of years, but historical significance is not just a question of durability. ( ③ ) These buildings were part of a rich and diverse culture, much of which has been lost. ( ④ ) They are historical facts, but facts by themselves, even such massive facts as the pyramids, are just the first stage in any historical study, and until they have been evaluated, placed in context and interpreted, they tell us little. ( ⑤ ) Different historians may place different values on the same facts, and the discovery of new evidence may modify or change existing theories and interpretations.`,
    qType: "문장삽입"
  },
  "40": {
    title: "40번 - 요약문",
    passage: `In most fiction, characters' lives are limited to the individual work. Readers may disagree on the characteristics and traits of fictional figures, and in drama there is room for different interpretations of characters. However, it is less common for characters in literary fiction to reappear in subsequent works than in genre fiction, where series featuring the same central characters are common. This is even more pronounced in comics, which are typically serialized in newspaper strips or comic books. Thus characters introduced in the 1930s, like Superman and Batman, may still enjoy new adventures decades later. During these characters' long histories, they change in various ways for a variety of reasons. If a character is created by a single author, like Sherlock Holmes, the character's core traits may change little from story to story, but readers learn more about him with each successive story. On the other hand, if characters are the work of several hands over decades, they may change considerably.`,
    qType: "요약문"
  },
  "41-42": {
    title: "41-42번 - 장문(제목+어휘)",
    passage: `While social presence has evolved through many iterations since its first development within the context of the landline telephone, the perception or feeling of being connected with the other person within the context of the conversation has persisted. Some research has explored specific technologies and the extent to which their characteristics lead to a feeling of social presence. For example, some researchers have studied the "richness" of the media, or the (a) number of cues available to convey social presence. A telephone call, which provides for audio cues and immediate feedback, is potentially (b) richer than an email, which provides only textual cues and no immediate feedback. Videoconferencing would be considered richer than the phone because of the addition of (c) visual cues, making it closer to replicating a perceived gold standard of face-to-face, in-person social presence. Researchers have suggested that successful managers would choose rich media for confusing or ambiguous messages and lean or less rich media for messages that were (d) less routine in nature. For example, if you wanted to discuss a complicated client agreement, it would be best to choose a (e) face-to-face meeting. In contrast, if you were going to inform your team about a change in meeting time from 3:00 to 3:30, you might send out a generic email to everyone. These different channels of communication were considered by researchers as a type of container that the message comes in. To be a good communicator, you need to choose the right container.`,
    qType: "장문"
  },
  "43-45": {
    title: "43-45번 - 장문(순서+지칭+내용일치)",
    passage: `(A) Mike had always dreamed about going to a baseball game. He watched his favorite team, the Arrows, on TV all the time, but he had never seen a game in person. One afternoon, Mike's dad came home earlier than usual. "Hey, Mike," he said, "I just got two tickets for tonight's Arrows game. Do you want to go?" Mike was so excited that he ran to grab his Arrows hat. In the car, his dad handed him a new baseball glove and added, "Just in case a fly ball comes our way."`,
    extraB: `(B) Several hours later, Mike's favorite team hit a home run and won the game. Fireworks filled the sky, and the team song played throughout the stadium. When they got home, Mike told his mom all about his favorite plays and showed her the ball he caught. (b) He knew this was a day he would never forget. It wasn't just the game — it was the cheering, the excitement, and best of all, spending time with his dad. He couldn't wait for the next time they would get to go to a game.`,
    extraC: `(C) The stadium was full of people wearing Arrows shirts. Mike couldn't believe how big the stadium looked in person. As the players ran onto the field, Mike and his dad cheered for their team's players. His dad pointed at the player running out to third base, saying "Look, it's Chavez, (c) your favorite player!" Mike saw him warming up on the field and waved hoping to get (d) his attention. After the players warmed up, Mike and his dad went to get some snacks. As soon as they sat back down, the pitcher threw the first pitch.`,
    extraD: `(D) Before long, it was Chavez's turn to hit. He hit a high fly ball into the stands. The whole crowd stood up, but Mike reached up with his glove and grabbed the ball. Everyone clapped and smiled at Mike. (e) He tightly held the ball and felt a little surprised, but very proud. Both teams kept scoring and the game stayed close. Mike and his dad cheered for every hit and held their breath during every big play. They high-fived each other every time the Arrows scored.`,
    qType: "장문"
  }
};

// Helper: generate histKey
function histKey(testType, num) {
  const prefix = testType === '단어' ? 'wordTest' : testType === '워크북' ? 'workbookTest' : 'quizTest';
  return `${prefix}_2025_g3_sep_${num}_v3`;
}

// Generate 단어 test for a given question
function generateDaneoTest(num, data) {
  const fp = data.passage;
  // Extract key words from passage for questions
  const words = extractKeyWords(fp);

  return {
    version: 3,
    testType: "단어",
    ei: {
      subject: "2025년 9월 고3 모의고사",
      pub: "고3",
      lesson: "9월",
      title: data.title,
      total: 100,
      time: 1200,
      totalQ: 20,
      histKey: histKey('단어', num)
    },
    fullPassage: fp,
    questions: generateDaneoQuestions(fp, words)
  };
}

function extractKeyWords(passage) {
  // Simple extraction of notable/academic words
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','can','could','must','of','in','to','for','with','on','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','and','but','or','if','while','that','this','these','those','it','its','they','their','them','he','she','his','her','we','our','you','your','who','which','what','i','me','my']);

  const words = passage.replace(/[^a-zA-Z\s]/g, '').split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toLowerCase());

  return [...new Set(words)].slice(0, 30);
}

function generateDaneoQuestions(passage, words) {
  // This will be filled per-question with proper content
  return [];
}

// For each question number, we need proper hand-crafted questions
// Since auto-generation can't guarantee quality, we'll write each one

// Let me write them all out properly
// I'll create a comprehensive generator that outputs the files

const questionNumbers = ['19','20','21','22','23','24','26','29','30','31','32','33','34','35','36','37','38','39','40','41-42','43-45'];

console.log('Generating JSON files for 고3 9월 모의고사...');
console.log(`Questions to generate: ${questionNumbers.length} x 3 types = ${questionNumbers.length * 3} files`);
console.log('18번 already created manually (3 files)');
console.log('Total: ' + (questionNumbers.length * 3 + 3) + ' files');

// The generation needs hand-crafted questions per passage
// This script serves as a framework; actual content must be written manually
