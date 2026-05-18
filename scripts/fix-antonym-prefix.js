#!/usr/bin/env node
/**
 * Fix S-ANTONYM-PREFIX: 접두사 반의어 → 의미적 반의어로 교체
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

const ANTONYM_MAP = {
  'unimportant': 'trivial',
  'unrelated': 'tangential',
  'unhelpful': 'detrimental',
  'unhappy': 'miserable',
  'uncomfortable': 'awkward',
  'unfamiliar': 'alien',
  'unlikely': 'doubtful',
  'unable': 'powerless',
  'unaware': 'oblivious',
  'uncertain': 'doubtful',
  'unclear': 'ambiguous',
  'uncommon': 'rare',
  'unconscious': 'dormant',
  'uncontrolled': 'chaotic',
  'unexpected': 'surprising',
  'unfair': 'biased',
  'unfortunate': 'regrettable',
  'unhealthy': 'toxic',
  'unknown': 'obscure',
  'unnecessary': 'redundant',
  'unpleasant': 'disagreeable',
  'unpopular': 'despised',
  'unrealistic': 'fanciful',
  'unreliable': 'questionable',
  'unsafe': 'hazardous',
  'unsatisfied': 'frustrated',
  'unsuccessful': 'futile',
  'unusual': 'peculiar',
  'unwanted': 'superfluous',
  'unwilling': 'reluctant',
  'unwise': 'foolish',
  'unnatural': 'artificial',
  'unnoticed': 'overlooked',
  'unpredictable': 'erratic',
  'unproductive': 'wasteful',
  'uneven': 'lopsided',
  'unstable': 'volatile',
  'untrue': 'false',
  'unusable': 'broken',
  'unacceptable': 'intolerable',
  'unavoidable': 'certain',
  'unbiased': 'neutral',
  'unchanged': 'static',
  'unconventional': 'radical',
  'undeniable': 'obvious',
  'underdeveloped': 'primitive',
  'unfounded': 'baseless',
  'uninformed': 'naive',
  'unintended': 'accidental',
  'unjust': 'biased',
  'unlimited': 'boundless',
  'unmatched': 'peerless',
  'unmotivated': 'apathetic',
  'unnoticed': 'overlooked',
  'unorganized': 'chaotic',
  'unprepared': 'vulnerable',
  'unqualified': 'amateur',
  'unresolved': 'pending',
  'unseen': 'hidden',
  'unsettled': 'turbulent',
  'unskilled': 'clumsy',
  'unspoken': 'tacit',
  'unsuitable': 'wrong',
  'unsupported': 'abandoned',
  'untested': 'experimental',
  'untouched': 'pristine',
  'untrained': 'raw',
  'unused': 'idle',
  'impossible': 'hopeless',
  'implausible': 'far-fetched',
  'impatient': 'restless',
  'imperfect': 'flawed',
  'impolite': 'rude',
  'improper': 'wrong',
  'impure': 'tainted',
  'immature': 'childish',
  'immoral': 'corrupt',
  'immovable': 'rigid',
  'impractical': 'absurd',
  'imprecise': 'vague',
  'inactive': 'dormant',
  'inadequate': 'lacking',
  'inaccurate': 'erroneous',
  'inappropriate': 'wrong',
  'incapable': 'powerless',
  'incomplete': 'partial',
  'inconsistent': 'erratic',
  'incorrect': 'wrong',
  'independent': 'autonomous',
  'indirect': 'roundabout',
  'ineffective': 'futile',
  'inefficient': 'wasteful',
  'inevitable': 'certain',
  'inexperienced': 'amateur',
  'infinite': 'boundless',
  'informal': 'casual',
  'inhuman': 'cruel',
  'insecure': 'vulnerable',
  'insignificant': 'negligible',
  'insufficient': 'lacking',
  'intolerant': 'bigoted',
  'invalid': 'void',
  'invisible': 'hidden',
  'involuntary': 'forced',
  'irrational': 'absurd',
  'irregular': 'erratic',
  'irrelevant': 'beside the point',
  'irresponsible': 'reckless',
  'irreversible': 'permanent',
  'inward': 'internal',
  'disadvantage': 'drawback',
  'disagree': 'oppose',
  'disappear': 'vanish',
  'disappoint': 'frustrate',
  'disapprove': 'reject',
  'disconnect': 'sever',
  'discourage': 'deter',
  'dishonest': 'deceitful',
  'dislike': 'loathe',
  'disorder': 'chaos',
  'displace': 'relocate',
  'dissatisfied': 'frustrated',
  'dissimilar': 'distinct',
  'distrust': 'suspicion',
  'discomfort': 'pain',
  'disbelief': 'skepticism',
  'disobey': 'defy',
  'disregard': 'neglect',
  'disrespect': 'contempt',
  'misunderstand': 'confuse',
  'misjudge': 'err',
  'mislead': 'deceive',
  'misuse': 'abuse',
  'misplace': 'lose',
  'misinform': 'deceive',
  'nonexistent': 'absent',
  'nonsense': 'absurdity',
  'outward': 'external',
  'unsure': 'hesitant',
  'disreputable': 'notorious',
  'unconvincing': 'weak',
  'unavailable': 'scarce',
  'implicit': 'subtle',
  'instinct': 'intuition',
  'misery': 'suffering',
};

function escRE(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let fixed = 0, filesFixed = 0, skipped = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && !['_passages','reports','.git','node_modules'].includes(e.name)) walk(f);
    else if ((e.name === '워크북.json' || e.name === '퀴즈.json') && !e.name.includes('.blind') && !e.name.includes('.cross') && !e.name.includes('.prompt') && !e.name.includes('.response') && !e.name.includes('.adversarial')) processFile(f);
  }
}

function processFile(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (!data.questions || !Array.isArray(data.questions)) return;

  let changed = false;
  for (const q of data.questions) {
    if (q.fmt !== 'mc' || !Array.isArray(q.ch)) continue;

    // Check each choice for prefix antonyms (all types)
    const type = (q.type || '').trim();

    for (let i = 0; i < q.ch.length; i++) {
      if (i + 1 === q.ans) continue; // Don't change the correct answer
      const word = (q.ch[i] || '').trim();
      const lower = word.toLowerCase();

      // Check if this is a prefix antonym
      let isPrefix = false;
      let base = '';
      for (const prefix of ['un', 'im', 'in', 'ir', 'il', 'dis', 'mis', 'non']) {
        if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
          base = lower.substring(prefix.length);
          // Check if the base word is in the passage (indicating prefix manipulation)
          const passage = (q.passage || '') + ' ' + (data.fullPassage || '');
          if (passage.toLowerCase().includes(base)) {
            isPrefix = true;
            break;
          }
        }
      }

      if (!isPrefix) continue;

      const replacement = ANTONYM_MAP[lower];
      if (!replacement) {
        skipped.push(`${path.relative(ROOT, file)} Q${q.id || '?'} ch[${i}]="${word}"`);
        continue;
      }

      // Preserve capitalization
      let newWord = replacement;
      if (word[0] === word[0].toUpperCase()) {
        newWord = replacement[0].toUpperCase() + replacement.slice(1);
      }

      q.ch[i] = newWord;

      // Update det references
      if (q.det) {
        if (q.det.analysis) {
          q.det.analysis = q.det.analysis.replace(new RegExp(escRE(word), 'g'), newWord);
        }
        if (q.det.korean) {
          q.det.korean = q.det.korean.replace(new RegExp(escRE(word), 'g'), newWord);
        }
      }

      changed = true;
      fixed++;
    }
  }

  if (changed) {
    filesFixed++;
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

walk(DATA_DIR);
console.log(`S-ANTONYM-PREFIX 수정: ${fixed}건 in ${filesFixed} files`);
if (skipped.length > 0) {
  console.log(`\nSkipped (no replacement): ${skipped.length}`);
  skipped.forEach(s => console.log(`  ${s}`));
}
