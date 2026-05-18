#!/usr/bin/env node
/**
 * Generate vocabulary test response.json from prompt.json
 * Reads the prompt, analyzes the fullPassage, and creates decisions
 */
const fs = require('fs');
const path = require('path');

const promptFile = process.argv[2];
if (!promptFile) { console.error('Usage: node gen-vocab-response.js <prompt.json>'); process.exit(1); }

const prompt = JSON.parse(fs.readFileSync(promptFile, 'utf8'));
const { source, sourcePath, testType, fullPassage, slots } = prompt;

// Extract words from passage (strip HTML)
const plainText = fullPassage.replace(/<[^>]+>/g, ' ').replace(/\\'/g, "'").replace(/\s+/g, ' ').trim();
const words = plainText.split(/\s+/).filter(w => /^[a-zA-Z]{3,}$/.test(w));
const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];

// Get content words (exclude common function words)
const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','can','may','might','shall','not','no','this','that','these','those','it','its','he','she','they','we','you','his','her','their','our','your','my','me','him','them','us','who','which','what','when','where','how','why','with','from','about','into','through','during','before','after','above','below','between','under','over','out','up','down','off','then','than','so','if','because','as','by','all','each','every','both','few','more','most','other','some','such','very','just','also','now','here','there','only','still','already','even','too','much','many','well','back','been','being','going','new','old','great','good','bad','long','high','small','large','big','little','own','same','different','first','last','next','early','late','right','left','way','time','year','people','man','woman','child','world','life','day','hand','part','place','case','week','company','system','program','question','work','government','number','night','point','home','water','room','mother','area','money','story','fact','month','lot','study','book','eye','job','word','business','issue','side','kind','head','house','service','friend','father','power','hour','game','line','end','members','city','community','group','country','problem','change','during','without','around','school','important','able','need','another','think','make','know','take','come','want','give','use','find','tell','ask','seem','feel','try','leave','call','keep'];
const contentWords = uniqueWords.filter(w => !stopWords.has(w) && w.length >= 4);

// Helper functions
function pickWords(n, exclude = []) {
  const available = contentWords.filter(w => !exclude.includes(w));
  const picked = [];
  for (let i = 0; i < Math.min(n, available.length); i++) {
    picked.push(available[i]);
  }
  return picked;
}

function findInPassage(word) {
  const idx = plainText.toLowerCase().indexOf(word.toLowerCase());
  return idx >= 0;
}

// Synonyms/antonyms banks
const synAntPairs = {
  'impressed': { syn: ['amazed', 'astonished', 'moved'], ant: ['bored', 'indifferent', 'unmoved'] },
  'enormous': { syn: ['huge', 'massive', 'immense'], ant: ['tiny', 'small', 'miniature'] },
  'destroyed': { syn: ['ruined', 'wrecked', 'demolished'], ant: ['built', 'created', 'preserved'] },
  'responded': { syn: ['reacted', 'replied', 'answered'], ant: ['ignored', 'disregarded', 'neglected'] },
  'special': { syn: ['unique', 'particular', 'exceptional'], ant: ['ordinary', 'common', 'regular'] },
  'fantastic': { syn: ['wonderful', 'amazing', 'excellent'], ant: ['terrible', 'dreadful', 'awful'] },
  'grateful': { syn: ['thankful', 'appreciative', 'obliged'], ant: ['ungrateful', 'resentful', 'indifferent'] },
  'challenges': { syn: ['difficulties', 'obstacles', 'hardships'], ant: ['advantages', 'benefits', 'ease'] },
  'positive': { syn: ['optimistic', 'favorable', 'constructive'], ant: ['negative', 'pessimistic', 'harmful'] },
  'powerful': { syn: ['strong', 'mighty', 'influential'], ant: ['weak', 'powerless', 'feeble'] },
  'doubt': { syn: ['question', 'uncertainty', 'skepticism'], ant: ['confidence', 'certainty', 'trust'] },
  'limited': { syn: ['restricted', 'confined', 'bounded'], ant: ['unlimited', 'infinite', 'boundless'] },
  'detect': { syn: ['discover', 'identify', 'notice'], ant: ['overlook', 'miss', 'ignore'] },
  'noble': { syn: ['admirable', 'honorable', 'worthy'], ant: ['ignoble', 'dishonest', 'unworthy'] },
  'improved': { syn: ['enhanced', 'refined', 'upgraded'], ant: ['worsened', 'deteriorated', 'declined'] },
  'diligence': { syn: ['persistence', 'dedication', 'effort'], ant: ['laziness', 'negligence', 'carelessness'] },
  'potential': { syn: ['capability', 'capacity', 'ability'], ant: ['inability', 'limitation', 'weakness'] },
  'sustainable': { syn: ['enduring', 'lasting', 'viable'], ant: ['unsustainable', 'temporary', 'harmful'] },
  'enriches': { syn: ['enhances', 'improves', 'nourishes'], ant: ['depletes', 'exhausts', 'impoverishes'] },
  'healthy': { syn: ['sound', 'robust', 'thriving'], ant: ['unhealthy', 'diseased', 'weak'] },
  'concentrating': { syn: ['focusing', 'attending', 'centering'], ant: ['ignoring', 'neglecting', 'distracting'] },
  'tempting': { syn: ['appealing', 'attractive', 'enticing'], ant: ['repulsive', 'unappealing', 'discouraging'] },
  'assess': { syn: ['evaluate', 'judge', 'examine'], ant: ['ignore', 'overlook', 'neglect'] },
  'spoil': { syn: ['ruin', 'damage', 'harm'], ant: ['improve', 'enhance', 'preserve'] },
  'benefit': { syn: ['profit', 'gain', 'advantage'], ant: ['suffer', 'lose', 'harm'] },
  'refinement': { syn: ['improvement', 'polish', 'enhancement'], ant: ['deterioration', 'decline', 'regression'] },
  'struggle': { syn: ['strive', 'fight', 'effort'], ant: ['ease', 'surrender', 'give up'] },
  'witness': { syn: ['observe', 'see', 'experience'], ant: ['miss', 'overlook', 'ignore'] },
  'confidence': { syn: ['assurance', 'certainty', 'self-belief'], ant: ['doubt', 'uncertainty', 'insecurity'] },
  'shift': { syn: ['change', 'transition', 'alteration'], ant: ['stability', 'constancy', 'permanence'] }
};

console.log(`Generating response for: ${sourcePath} / ${testType}`);
console.log(`Passage words: ${contentWords.length} content words`);
console.log(`Slots: ${slots.length}`);

// This is a stub - actual content generation would need AI
// For now, output the structure
console.log(`\nPlease create the response.json manually for: ${sourcePath} / ${testType}`);
console.log(`Content words available: ${contentWords.slice(0, 20).join(', ')}...`);
