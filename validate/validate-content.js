#!/usr/bin/env node
/**
 * NaesinFit Test Pipeline — validate-content.js
 * Deep content validation beyond structural checks.
 *
 * Checks:
 * - Synonym accuracy (basic dictionary)
 * - Antonym accuracy (basic dictionary)
 * - Duplicate question detection (same stem+type)
 * - Type-stem mismatch
 * - Passage-type mismatch
 *
 * Usage: node validate/validate-content.js data/.../단어.json
 *        node validate/validate-content.js --all
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Basic synonym/antonym dictionary (common English word pairs) ──
const SYNONYM_PAIRS = {
  'happy': ['glad', 'joyful', 'pleased', 'delighted', 'cheerful', 'content', 'elated'],
  'sad': ['unhappy', 'sorrowful', 'miserable', 'gloomy', 'depressed', 'melancholy', 'dejected'],
  'big': ['large', 'huge', 'enormous', 'vast', 'immense', 'massive', 'gigantic'],
  'small': ['tiny', 'little', 'minute', 'miniature', 'petite', 'slight', 'compact'],
  'good': ['excellent', 'fine', 'great', 'superb', 'outstanding', 'wonderful', 'splendid'],
  'bad': ['poor', 'terrible', 'awful', 'dreadful', 'horrible', 'atrocious', 'inferior'],
  'fast': ['quick', 'rapid', 'swift', 'speedy', 'hasty', 'brisk', 'prompt'],
  'slow': ['sluggish', 'gradual', 'unhurried', 'leisurely', 'languid', 'plodding'],
  'begin': ['start', 'commence', 'initiate', 'launch', 'embark', 'originate'],
  'end': ['finish', 'conclude', 'terminate', 'cease', 'complete', 'stop'],
  'important': ['significant', 'crucial', 'vital', 'essential', 'critical', 'key', 'pivotal'],
  'difficult': ['hard', 'challenging', 'tough', 'demanding', 'arduous', 'strenuous'],
  'easy': ['simple', 'effortless', 'straightforward', 'uncomplicated'],
  'beautiful': ['pretty', 'gorgeous', 'stunning', 'lovely', 'attractive', 'elegant'],
  'ugly': ['unattractive', 'hideous', 'unsightly', 'grotesque', 'repulsive'],
  'rich': ['wealthy', 'affluent', 'prosperous', 'opulent', 'well-off'],
  'poor': ['impoverished', 'destitute', 'needy', 'penniless', 'indigent'],
  'strong': ['powerful', 'mighty', 'robust', 'sturdy', 'vigorous', 'potent'],
  'weak': ['feeble', 'frail', 'fragile', 'delicate', 'flimsy'],
  'increase': ['grow', 'rise', 'expand', 'enlarge', 'augment', 'boost', 'escalate'],
  'decrease': ['reduce', 'decline', 'diminish', 'shrink', 'lessen', 'lower'],
  'create': ['make', 'produce', 'generate', 'construct', 'build', 'form'],
  'destroy': ['demolish', 'ruin', 'wreck', 'annihilate', 'devastate', 'obliterate'],
  'help': ['assist', 'aid', 'support', 'facilitate', 'contribute'],
  'hinder': ['obstruct', 'impede', 'hamper', 'inhibit', 'block', 'prevent'],
  'allow': ['permit', 'enable', 'authorize', 'let', 'sanction'],
  'forbid': ['prohibit', 'ban', 'bar', 'restrict', 'prevent'],
  'agree': ['concur', 'consent', 'approve', 'accept', 'assent'],
  'disagree': ['oppose', 'object', 'dissent', 'reject', 'dispute'],
  'encourage': ['motivate', 'inspire', 'promote', 'stimulate', 'foster'],
  'discourage': ['deter', 'dissuade', 'dampen', 'demoralize'],
  'accept': ['approve', 'embrace', 'adopt', 'acknowledge', 'welcome'],
  'reject': ['refuse', 'decline', 'deny', 'dismiss', 'repudiate'],
  'succeed': ['prosper', 'thrive', 'flourish', 'triumph', 'prevail'],
  'fail': ['falter', 'collapse', 'flop', 'founder', 'miscarry'],
  'ancient': ['old', 'antique', 'archaic', 'prehistoric', 'aged'],
  'modern': ['contemporary', 'current', 'recent', 'present-day', 'new'],
  'abundant': ['plentiful', 'ample', 'copious', 'profuse', 'lavish'],
  'scarce': ['rare', 'insufficient', 'sparse', 'meager', 'limited'],
  'reveal': ['show', 'disclose', 'expose', 'uncover', 'unveil'],
  'conceal': ['hide', 'cover', 'mask', 'disguise', 'obscure'],
  'genuine': ['authentic', 'real', 'true', 'legitimate', 'sincere'],
  'fake': ['false', 'counterfeit', 'fraudulent', 'phony', 'artificial'],
  'temporary': ['brief', 'short-lived', 'transient', 'fleeting', 'momentary'],
  'permanent': ['lasting', 'enduring', 'perpetual', 'eternal', 'constant'],
  'voluntary': ['willing', 'optional', 'spontaneous', 'deliberate'],
  'mandatory': ['compulsory', 'obligatory', 'required', 'forced'],
  'restrict': ['limit', 'confine', 'constrain', 'curb', 'restrain'],
  'liberate': ['free', 'release', 'emancipate', 'unchain'],
  'systematic': ['methodical', 'organized', 'orderly', 'structured'],
  'chaotic': ['disorganized', 'disordered', 'random', 'confused'],
  'intuitive': ['instinctive', 'natural', 'spontaneous', 'innate'],
  'deliberate': ['intentional', 'calculated', 'planned', 'conscious'],
  'facilitate': ['ease', 'enable', 'simplify', 'expedite', 'promote'],
  'complicate': ['hinder', 'confuse', 'entangle', 'perplex'],
  'precise': ['exact', 'accurate', 'specific', 'definite', 'detailed'],
  'vague': ['ambiguous', 'unclear', 'indefinite', 'imprecise', 'fuzzy']
};

// Build reverse lookup
const synonymLookup = new Map();
Object.entries(SYNONYM_PAIRS).forEach(([key, syns]) => {
  const allWords = [key, ...syns];
  allWords.forEach(w => {
    const existing = synonymLookup.get(w.toLowerCase()) || new Set();
    allWords.forEach(s => {
      if (s.toLowerCase() !== w.toLowerCase()) existing.add(s.toLowerCase());
    });
    synonymLookup.set(w.toLowerCase(), existing);
  });
});

// ── Antonym pairs ──
const ANTONYM_PAIRS = [
  ['happy', 'sad'], ['big', 'small'], ['good', 'bad'], ['fast', 'slow'],
  ['begin', 'end'], ['important', 'trivial'], ['difficult', 'easy'],
  ['beautiful', 'ugly'], ['rich', 'poor'], ['strong', 'weak'],
  ['increase', 'decrease'], ['create', 'destroy'], ['help', 'hinder'],
  ['allow', 'forbid'], ['agree', 'disagree'], ['encourage', 'discourage'],
  ['accept', 'reject'], ['succeed', 'fail'], ['ancient', 'modern'],
  ['abundant', 'scarce'], ['reveal', 'conceal'], ['genuine', 'fake'],
  ['temporary', 'permanent'], ['voluntary', 'mandatory'],
  ['restrict', 'liberate'], ['systematic', 'chaotic'],
  ['intuitive', 'deliberate'], ['facilitate', 'complicate'],
  ['precise', 'vague'], ['optimistic', 'pessimistic'],
  ['active', 'passive'], ['advantage', 'disadvantage'],
  ['complex', 'simple'], ['positive', 'negative'],
  ['natural', 'artificial'], ['public', 'private'],
  ['visible', 'invisible'], ['possible', 'impossible'],
  ['flexible', 'rigid'], ['objective', 'subjective'],
  ['individual', 'collective'], ['abstract', 'concrete'],
  ['rational', 'irrational'], ['dependent', 'independent'],
  ['internal', 'external'], ['constructive', 'destructive'],
  ['prosperity', 'adversity'], ['courage', 'cowardice'],
  ['expand', 'contract'], ['ascend', 'descend'],
  ['advance', 'retreat'], ['include', 'exclude'],
  ['superior', 'inferior'], ['majority', 'minority']
];

const antonymLookup = new Map();
ANTONYM_PAIRS.forEach(([a, b]) => {
  const aSet = antonymLookup.get(a.toLowerCase()) || new Set();
  aSet.add(b.toLowerCase());
  antonymLookup.set(a.toLowerCase(), aSet);

  const bSet = antonymLookup.get(b.toLowerCase()) || new Set();
  bSet.add(a.toLowerCase());
  antonymLookup.set(b.toLowerCase(), bSet);

  // Also add all synonyms as antonym matches
  const aSyns = synonymLookup.get(a.toLowerCase()) || new Set();
  const bSyns = synonymLookup.get(b.toLowerCase()) || new Set();
  aSyns.forEach(syn => {
    const synSet = antonymLookup.get(syn) || new Set();
    synSet.add(b.toLowerCase());
    bSyns.forEach(bs => synSet.add(bs));
    antonymLookup.set(syn, synSet);
  });
  bSyns.forEach(syn => {
    const synSet = antonymLookup.get(syn) || new Set();
    synSet.add(a.toLowerCase());
    aSyns.forEach(as => synSet.add(as));
    antonymLookup.set(syn, synSet);
  });
});

// ── Stem-type expected patterns ──
const STEM_TYPE_PATTERNS = {
  '빈칸': /빈칸|빈 칸|blank/i,
  '순서': /순서|order/i,
  '삽입': /삽입|insert|위치/i,
  '어법': /어법|grammar|문법/i,
  '어휘': /어휘|부적절|적절/i,
  '내용': /내용|일치|불일치|match/i,
  'T/F': /T\/F|true|false|맞으면|틀리면/i,
  '서술형': /서술|쓰시오|쓰세요|write|완성/i,
  '심경': /심경|분위기|기분|emotion|mood|feeling/i,
  '제목': /제목|title/i,
  '주제': /주제|topic|subject/i,
  '요약': /요약|summary/i,
  '목적': /목적|purpose/i,
  '주장': /주장|claim|argue/i
};

class ContentResult {
  constructor(filePath) {
    this.filePath = filePath;
    this.issues = [];  // { id, severity, qid, msg }
  }
  add(id, severity, qid, msg) {
    this.issues.push({ id, severity, qid, msg });
  }
  get pass() {
    return this.issues.filter(i => i.severity === 'S' || i.severity === 'A').length === 0;
  }
}

function validateContent(jsonPath) {
  const result = new ContentResult(jsonPath);

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    result.add('PARSE', 'S', 0, `JSON parse error: ${e.message}`);
    return result;
  }

  const { questions, testType } = data;
  if (!Array.isArray(questions)) {
    result.add('STRUCT', 'S', 0, 'questions is not an array');
    return result;
  }

  // ── CT1: Synonym check ──
  questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (typeNorm !== '동의어 고르기') return;
    if (q.fmt !== 'mc' || !Array.isArray(q.ch)) return;

    // The stem typically contains the target word
    const stemWords = extractKeyWord(q.stem);
    const answer = (q.ch[q.ans] || '').toLowerCase().trim();

    if (stemWords && answer) {
      const knownSyns = synonymLookup.get(stemWords.toLowerCase());
      if (knownSyns && !knownSyns.has(answer)) {
        result.add('CT1', 'B', q.id,
          `동의어 검증: "${stemWords}" <-> "${answer}" — 사전에 없는 동의어 관계 (수동 확인 필요)`);
      }
    }
  });

  // ── CT2: Antonym check ──
  questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (typeNorm !== '반의어 고르기') return;
    if (q.fmt !== 'mc' || !Array.isArray(q.ch)) return;

    const stemWords = extractKeyWord(q.stem);
    const answer = (q.ch[q.ans] || '').toLowerCase().trim();

    if (stemWords && answer) {
      const knownAnts = antonymLookup.get(stemWords.toLowerCase());
      if (knownAnts && !knownAnts.has(answer)) {
        result.add('CT2', 'B', q.id,
          `반의어 검증: "${stemWords}" <-> "${answer}" — 사전에 없는 반의어 관계 (수동 확인 필요)`);
      }
    }
  });

  // ── CT3: Duplicate question detection ──
  const seen = new Map();
  questions.forEach(q => {
    const key = `${(q.type || '').trim()}::${(q.stem || '').trim().substring(0, 50)}`;
    if (seen.has(key)) {
      result.add('CT3', 'A', q.id,
        `중복 의심: Q${seen.get(key)}과 동일한 유형+발문 (type="${q.type}")`);
    } else {
      seen.set(key, q.id);
    }
  });

  // ── CT4: Type-stem mismatch ──
  questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    const stem = (q.stem || '').trim();

    // Check if stem mentions a different question type
    if (typeNorm.includes('빈칸') && STEM_TYPE_PATTERNS['심경'] && STEM_TYPE_PATTERNS['심경'].test(stem)) {
      result.add('CT4', 'A', q.id,
        `유형-발문 불일치: type="${typeNorm}" but stem mentions 심경/분위기`);
    }
    if (typeNorm.includes('빈칸') && /순서/.test(stem) && !/빈칸/.test(stem)) {
      result.add('CT4', 'A', q.id,
        `유형-발문 불일치: type="${typeNorm}" but stem mentions 순서`);
    }
    if (typeNorm === '순서배열' || typeNorm === '글순서') {
      if (/빈칸/.test(stem) && !/순서/.test(stem)) {
        result.add('CT4', 'A', q.id,
          `유형-발문 불일치: type="${typeNorm}" but stem mentions 빈칸`);
      }
    }
    if (typeNorm === '문장삽입' && !/삽입|위치|넣기/.test(stem)) {
      result.add('CT4', 'B', q.id,
        `유형-발문 의심: type="문장삽입" but stem doesn't mention 삽입/위치`);
    }
    if (typeNorm === 'T/F' && !/T\/F|true|false|맞으면|틀리면|일치/.test(stem)) {
      result.add('CT4', 'B', q.id,
        `유형-발문 의심: type="T/F" but stem doesn't mention T/F pattern`);
    }
  });

  // ── CT5: Passage-type mismatch (content/TF with mismatched choices) ──
  questions.forEach(q => {
    const typeNorm = (q.type || '').trim();
    if (!['내용일치', '내용불일치', 'T/F'].includes(typeNorm)) return;
    if (!q.ch || !Array.isArray(q.ch)) return;

    // Check that choices reference content actually in the passage
    const passagePlain = stripHtml(q.passage || '').toLowerCase();
    if (passagePlain.length < 20) return; // Too short to check

    // For content questions, at least the correct answer should relate to passage
    // We do a simple keyword overlap check
    const answerText = (q.ch[q.ans] || '').toLowerCase();
    const answerWords = answerText.split(/\s+/).filter(w => w.length > 4);
    if (answerWords.length > 0) {
      const overlap = answerWords.filter(w => passagePlain.includes(w));
      if (overlap.length === 0 && answerWords.length > 2) {
        result.add('CT5', 'B', q.id,
          `내용-지문 불일치 의심: 정답 선택지의 주요 단어가 지문에 없음`);
      }
    }
  });

  return result;
}

function extractKeyWord(stem) {
  // Extract the target word from stems like "밑줄 친 'facilitate'의 동의어로 ..."
  const match = (stem || '').match(/[''""](\w+)[''""]/);
  if (match) return match[1];

  // Try extracting bold word
  const boldMatch = (stem || '').match(/<b>(\w+)<\/b>/);
  if (boldMatch) return boldMatch[1];

  return null;
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '');
}

function findJsonFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  let files;

  if (args.length === 0 || args[0] === '--all') {
    files = findJsonFiles(path.join(ROOT, 'data'));
  } else {
    files = [path.resolve(args[0])];
  }

  if (files.length === 0) {
    console.log('No JSON files found.');
    return;
  }

  console.log(`Content-validating ${files.length} files...\n`);

  let totalIssues = 0;
  let totalFiles = 0;
  let filesWithIssues = 0;

  const severityCounts = { S: 0, A: 0, B: 0, C: 0 };

  files.forEach(f => {
    const result = validateContent(f);
    totalFiles++;

    if (result.issues.length > 0) {
      filesWithIssues++;
      totalIssues += result.issues.length;
      const rel = path.relative(ROOT, f);
      console.log(`[ISSUES] ${rel} (${result.issues.length})`);
      result.issues.forEach(i => {
        severityCounts[i.severity] = (severityCounts[i.severity] || 0) + 1;
        console.log(`  [${i.severity}] Q${i.qid} ${i.id}: ${i.msg}`);
      });
    }
  });

  console.log('\n--- Content Validation Summary ---');
  console.log(`Files checked: ${totalFiles}`);
  console.log(`Files with issues: ${filesWithIssues}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`  S(치명): ${severityCounts.S || 0}`);
  console.log(`  A(중요): ${severityCounts.A || 0}`);
  console.log(`  B(경미): ${severityCounts.B || 0}`);
  console.log(`  C(개선): ${severityCounts.C || 0}`);

  process.exit((severityCounts.S || 0) + (severityCounts.A || 0) > 0 ? 1 : 0);
}

module.exports = { validateContent };

if (require.main === module) main();
