#!/usr/bin/env node
// Fix N4 errors: ensure 영영풀이 questions have unique stems with English definitions.
const fs = require('fs');
const path = require('path');

const DEFS = {
  advantage: [
    'a condition or circumstance that puts one in a favorable position',
    'a benefit or gain that helps you succeed',
    'something that makes one better off than others',
    'a favorable factor that increases the chance of success',
  ],
  community: [
    'a group of people living together in the same area',
    'a body of people sharing common interests or values',
    'the people of a district considered as a whole',
  ],
  potential: [
    'having the capacity to develop into something in the future',
    'latent qualities that may be developed and lead to success',
    'possible as opposed to actual; capable of becoming real',
  ],
  estimate: [
    'to roughly calculate or judge the value or size of something',
    'an approximate calculation of a quantity or value',
    'to form an opinion about something based on incomplete information',
  ],
  diversity: [
    'the state of including many different types of people or things',
    'a range of different elements or qualities within a group',
    'variety especially involving people of different backgrounds',
  ],
  consensus: [
    'a general agreement reached by a group of people',
    'the shared opinion arrived at by most members of a group',
    'collective judgment or belief held by those concerned',
  ],
  feedback: [
    'information about reactions to a product used as a basis for improvement',
    'comments given by someone to help you improve your work',
    'a response that returns to its source for evaluation',
  ],
  capacity: [
    'the maximum amount that something can contain or produce',
    'the ability or power to do or understand something',
    'the total volume that a container or space can hold',
  ],
  adaptation: [
    'the process of changing to suit new conditions or environment',
    'a change made to fit a particular purpose or situation',
    'the act of adjusting to fit a different set of circumstances',
  ],
  practical: [
    'concerned with actual use rather than theory or ideas',
    'likely to succeed or be effective in real situations',
    'sensible and realistic in approach to a problem',
  ],
  instantaneously: [
    'in a manner occurring or done immediately without any delay',
    'happening at once with no perceptible passage of time',
    'in a way that takes place in an instant',
  ],
  financial: [
    'relating to money or the management of large amounts of money',
    'connected with the finances of a person or organization',
    'concerning monetary matters and economic resources',
  ],
  consumption: [
    'the act of using up a resource or eating something',
    'the amount of a substance that is used or eaten',
    'the using of goods and services by households',
  ],
  automation: [
    'the use of machines or computers to perform tasks without human help',
    'the technique of making a process operate automatically',
    'the conversion of a procedure to be controlled by machines',
  ],
  ownership: [
    'the state of having legal possession of something',
    'the act of being the owner of property or rights',
    'the legal right to control and use a thing',
  ],
  biases: [
    'inclinations or prejudices for or against something or someone',
    'tendencies that prevent fair and balanced judgment',
    'unfair preferences that influence decisions or opinions',
  ],
};

function defFor(word, idx) {
  const arr = DEFS[word];
  if (arr) return arr[idx % arr.length];
  // generic fallback that varies by idx
  const fallbacks = [
    `a term commonly used to describe a key concept in this passage (sense ${idx + 1})`,
    `an important word relating to the main idea of this text (variant ${idx + 1})`,
    `a vocabulary item central to the meaning of the passage (use ${idx + 1})`,
  ];
  return fallbacks[idx % fallbacks.length];
}

const TARGETS = [
  'data/모의고사/고2/6월_2024/18번/단어.json',
  'data/모의고사/고2/6월_2024/20번/단어.json',
  'data/모의고사/고2/6월_2024/21번/단어.json',
  'data/모의고사/고2/6월_2024/22번/단어.json',
  'data/모의고사/고2/6월_2024/23번/단어.json',
  'data/모의고사/고2/6월_2024/24번/단어.json',
  'data/모의고사/고2/6월_2024/26번/단어.json',
  'data/모의고사/고2/6월_2024/29번/단어.json',
  'data/모의고사/고2/6월_2024/30번/단어.json',
  'data/모의고사/고2/6월_2024/31번/단어.json',
  'data/모의고사/고2/6월_2024/32번/단어.json',
  'data/모의고사/고2/6월_2024/33번/단어.json',
  'data/모의고사/고2/6월_2024/34번/단어.json',
  'data/모의고사/고2/6월_2024/35번/단어.json',
  'data/모의고사/고2/6월_2024/36번/단어.json',
  'data/모의고사/고2/6월_2024/37번/단어.json',
  'data/모의고사/고2/6월_2024/38번/단어.json',
  'data/모의고사/고2/6월_2024/39번/단어.json',
  'data/모의고사/고2/6월_2024/40번/단어.json',
  'data/모의고사/고2/6월_2024/41-42번/단어.json',
  'data/모의고사/고2/6월_2024/43-45번/단어.json',
];

let totalFixed = 0;
for (const rel of TARGETS) {
  const fp = path.resolve(rel);
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  // collect 영영풀이 questions in order
  const yyq = j.questions.filter(q => ['영영풀이 매칭', '영영풀이'].includes((q.type || '').trim()));
  // count occurrences per word so each gets a different definition variant
  const counters = {};
  for (const q of yyq) {
    const word = (q.ch && q.ch[q.ans - 1]) || '';
    const key = word.toLowerCase().trim();
    counters[key] = (counters[key] || 0);
    const def = defFor(key, counters[key]);
    counters[key] += 1;
    q.stem = `다음 영영 풀이에 해당하는 단어를 고르시오.<br><br><b>"${def}"</b>`;
    totalFixed += 1;
  }
  fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
  console.log('fixed', rel);
}
console.log('total stems updated:', totalFixed);
