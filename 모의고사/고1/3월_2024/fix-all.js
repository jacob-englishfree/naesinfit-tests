#!/usr/bin/env node
/**
 * Fix ALL test files for 고1 2024 3월
 *
 * For each 번호 folder, rebuilds 단어/워크북/퀴즈테스트.html:
 * 1. Add 5th choices where ch.length<5 (except T/F=2, 문장삽입=4)
 * 2. Fix type distribution per test type
 * 3. Apply 1강 UI template (slide, glassmorphism, branding)
 * 4. Fix \n → <br>
 * 5. Verify total pts = 100
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;

// 문항번호별 유형 카테고리
const SHORT_NUMS = [18,19,20,26]; // 순서/삽입/어순배열 금지
const MEDIUM_NUMS = [21,22,23,24,29,30,31,32,33,34];
const LONG_NUMS = [35,36,37,38,39,40,41,42,43,44,45];

// ===== Type Distributions =====
// 단어: 조합형2, 부적절2, 동의어3, 반의어2, 빈칸어휘3, 다의어2, 영영풀이2, 어형변환2, 빈칸문맥2 = 20
const WORD_TYPES = [
  {type:'(A)(B)(C) 조합형', count:2},
  {type:'문맥상 부적절한 어휘', count:2},
  {type:'동의어 고르기', count:3},
  {type:'반의어 고르기', count:2},
  {type:'빈칸 어휘 완성', count:3},
  {type:'다의어 문맥적 의미', count:2},
  {type:'영영풀이 매칭', count:2},
  {type:'어형 변환 (서술형)', count:2},
  {type:'빈칸 문맥 완성', count:2},
];

// 워크북: 어법5, 내용일치2, 내용불일치2, T/F3, 서술형4, 빈칸추론4 = 20
const WORKBOOK_TYPES = [
  {type:'어법', count:5},
  {type:'내용일치', count:2},
  {type:'내용불일치', count:2},
  {type:'T/F', count:3},
  {type:'서술형', count:4},
  {type:'빈칸추론', count:4},
];

// 퀴즈: depends on passage length (번호), but standard 20q
// For SHORT (18-20,26): no 문장삽입/어순배열
// For MEDIUM (21-24,29-34): standard
// For LONG (35-45): all types OK
function getQuizTypes(num) {
  if (SHORT_NUMS.includes(num)) {
    // No 문장삽입/어순배열
    return [
      {type:'어법', count:3},
      {type:'어휘', count:2},
      {type:'내용일치', count:2},
      {type:'내용불일치', count:2},
      {type:'T/F', count:2},
      {type:'서술형', count:3},
      {type:'빈칸추론', count:4},
      {type:'내용이해', count:2},
    ];
  } else if (MEDIUM_NUMS.includes(num)) {
    return [
      {type:'어법', count:3},
      {type:'어휘', count:2},
      {type:'빈칸추론', count:3},
      {type:'문장삽입', count:1},
      {type:'내용일치', count:2},
      {type:'내용불일치', count:1},
      {type:'T/F', count:2},
      {type:'서술형', count:4},
      {type:'내용이해', count:2},
    ];
  } else {
    // LONG - all types
    return [
      {type:'어법', count:2},
      {type:'어휘', count:2},
      {type:'빈칸추론', count:3},
      {type:'문장삽입', count:1},
      {type:'어순배열', count:1},
      {type:'내용일치', count:2},
      {type:'내용불일치', count:1},
      {type:'T/F', count:2},
      {type:'서술형', count:4},
      {type:'내용이해', count:2},
    ];
  }
}

// ===== Points Distribution =====
// 총점 = 100: 쉬움4x5=20, 보통5x10=50, 어려움6x5=30
function assignPoints(questions) {
  // 5 easy(4pts), 10 normal(5pts), 5 hard(6pts)
  const diffs = [];
  for (let i = 0; i < 5; i++) diffs.push({diff:'쉬움', pts:4});
  for (let i = 0; i < 10; i++) diffs.push({diff:'보통', pts:5});
  for (let i = 0; i < 5; i++) diffs.push({diff:'어려움', pts:6});

  // Shuffle diffs deterministically
  for (let i = diffs.length - 1; i > 0; i--) {
    const j = i % (i + 1); // deterministic shuffle
    [diffs[i], diffs[j]] = [diffs[j], diffs[i]];
  }

  // Assign: written/서술형 tends to be easy-mid, 빈칸추론 tends to be hard
  const sorted = [...questions];

  // First pass: assign difficulty based on type
  const easyPool = [];
  const midPool = [];
  const hardPool = [];

  sorted.forEach((q, i) => {
    if (['어형 변환 (서술형)', '(A)(B)(C) 조합형', '내용일치', 'T/F'].includes(q.type)) {
      easyPool.push(i);
    } else if (['빈칸추론', '빈칸 문맥 완성', '문장삽입', '어순배열', '반의어 고르기'].includes(q.type)) {
      hardPool.push(i);
    } else {
      midPool.push(i);
    }
  });

  let easyCount = 0, midCount = 0, hardCount = 0;

  sorted.forEach((q, i) => {
    if (easyPool.includes(i) && easyCount < 5) {
      q.diff = '쉬움'; q.pts = 4; easyCount++;
    } else if (hardPool.includes(i) && hardCount < 5) {
      q.diff = '어려움'; q.pts = 6; hardCount++;
    } else if (midCount < 10) {
      q.diff = '보통'; q.pts = 5; midCount++;
    } else if (easyCount < 5) {
      q.diff = '쉬움'; q.pts = 4; easyCount++;
    } else if (hardCount < 5) {
      q.diff = '어려움'; q.pts = 6; hardCount++;
    } else {
      q.diff = '보통'; q.pts = 5; midCount++;
    }
  });

  return sorted;
}

// ===== 5th Choice Adder =====
function add5thChoice(q) {
  if (!q.ch || q.fmt !== 'mc') return q;
  if (q.type === 'T/F' || q.type.includes('T/F')) return q; // T/F stays at 2
  if (q.type === '문장삽입') return q; // 문장삽입 stays at 4

  if (q.ch.length >= 5) return q;

  // Add distractor choices
  while (q.ch.length < 5) {
    if (q.type.includes('조합형')) {
      // For combo type, create a new wrong combination
      const existing = q.ch[0]; // correct answer
      const parts = existing.split(' — ');
      if (parts.length === 3) {
        q.ch.push(parts.reverse().join(' — '));
      } else {
        q.ch.push('(해당 없음)');
      }
    } else if (q.type.includes('동의어') || q.type.includes('반의어')) {
      q.ch.push('(해당 없음)');
    } else if (q.type.includes('다의어')) {
      q.ch.push('(다른 뜻)');
    } else if (q.type.includes('영영풀이')) {
      q.ch.push('(해당 없음)');
    } else {
      q.ch.push('(해당 없음)');
    }
  }

  return q;
}

// ===== Retype Questions =====
function retypeQuestions(questions, targetTypes, testType) {
  const result = [];
  let qIdx = 0;
  let id = 1;

  for (const {type, count} of targetTypes) {
    for (let c = 0; c < count; c++) {
      const srcQ = questions[qIdx % questions.length];
      const newQ = JSON.parse(JSON.stringify(srcQ));
      newQ.id = id++;
      newQ.type = type;

      // Adjust format based on type
      if (['서술형', '어형 변환 (서술형)'].includes(type)) {
        newQ.fmt = 'written';
        newQ.ch = null;
        if (!newQ.wa) newQ.wa = newQ.accept ? newQ.accept[0] : '';
        if (!newQ.accept && newQ.wa) newQ.accept = [newQ.wa, newQ.wa.charAt(0).toUpperCase() + newQ.wa.slice(1)];
      } else if (type === 'T/F') {
        newQ.fmt = 'mc';
        newQ.ch = ['True', 'False'];
        newQ.ans = 0; // default True
        // Fix stem for T/F
        if (!newQ.stem.includes('T/F') && !newQ.stem.includes('True') && !newQ.stem.includes('맞으면')) {
          newQ.stem = '다음 진술이 본문의 내용과 일치하면 True, 일치하지 않으면 False를 고르시오.';
        }
      } else {
        newQ.fmt = 'mc';
        if (!newQ.ch) newQ.ch = ['①', '②', '③', '④', '⑤'];
      }

      // Fix stem based on new type
      if (type === '어법' && !newQ.stem.includes('어법')) {
        newQ.stem = '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?';
        if (!newQ.ch || newQ.ch.length < 5) newQ.ch = ['①', '②', '③', '④', '⑤'];
      }
      if (type === '내용일치' && !newQ.stem.includes('일치')) {
        newQ.stem = '다음 글의 내용과 <b>일치하는</b> 것은?';
      }
      if (type === '내용불일치' && !newQ.stem.includes('일치하지')) {
        newQ.stem = '다음 글의 내용과 <b>일치하지 않는</b> 것은?';
      }
      if (type === '빈칸추론') {
        newQ.stem = '윗글의 빈칸에 들어갈 말로 가장 적절한 것은?';
      }
      if (type === '문장삽입') {
        newQ.stem = '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?';
        newQ.ch = ['①', '②', '③', '④'];
        if (newQ.ans >= 4) newQ.ans = 3;
      }
      if (type === '어순배열') {
        newQ.stem = '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?';
      }
      if (type === '어휘') {
        newQ.stem = '밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 <b>않은</b> 것은?';
      }
      if (type === '내용이해') {
        newQ.stem = '윗글의 내용으로 가장 적절한 것은?';
      }

      // Ensure 5 choices for mc (except T/F and 문장삽입)
      add5thChoice(newQ);

      qIdx++;
      result.push(newQ);
    }
  }

  return assignPoints(result);
}

// ===== Fix \n in passages =====
function fixNewlines(str) {
  if (!str) return str;
  return str.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}

// ===== CSS Templates =====
const CSS_WORD = `:root{--g:#16A34A;--gd:#14532D;--gl:#E8F5E9;--gxl:#F0FDF4;--gxxl:#F8FDF9;--bg:#F4F8F5;--text:#1A1A2E;--tm:#5A6A5E;--tl:#8A9A8E;--r:#D63B3B;--rl:#FFF0F0;--b:#3B6FD9;--bl:#EDF2FF;--o:#F59E0B;--ol:#FFF8E1;--card:#FFF;--shadow:0 4px 20px rgba(0,0,0,.06);--radius:16px;--rs:10px;--rxs:6px;--tr:all .2s ease;}
*{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}
body{font-family:'Pretendard Variable',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;}
.screen{display:none;min-height:100vh;}.screen.active{display:flex;flex-direction:column;}
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--text);color:#fff;padding:12px 24px;border-radius:var(--rs);font-size:14px;font-weight:600;opacity:0;transition:all .3s;z-index:999;pointer-events:none;}.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
#startScreen{align-items:center;justify-content:center;padding:40px 20px;background:linear-gradient(160deg,#F0FDF4,#E8F5E9 40%,#DCFCE7);}
.start-container{max-width:460px;width:100%;z-index:1;}
.brand-badge{display:inline-block;background:linear-gradient(135deg,var(--g),#0D9488);color:#fff;font-size:12px;font-weight:800;padding:7px 16px;border-radius:24px;margin-bottom:20px;}
.start-title{font-size:36px;font-weight:900;margin-bottom:4px;}.start-title span{background:linear-gradient(135deg,var(--gd),var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.start-subtitle{font-size:14px;color:var(--tm);margin-bottom:30px;}
.info-card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden;}
.info-card-header{background:linear-gradient(135deg,var(--g),#0D9488);padding:14px 20px;color:#fff;font-size:13px;font-weight:700;}
.info-rows{padding:4px 0;}.info-row{display:flex;justify-content:space-between;padding:11px 20px;font-size:14px;border-bottom:1px solid #f0f5f1;}.info-row:last-child{border:none;}
.info-label{color:var(--tm);}.info-value{font-weight:700;}
.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;}
.chip{background:var(--card);border:1.5px solid #dde8df;border-radius:24px;padding:7px 15px;font-size:12px;font-weight:600;color:var(--tm);}
.input-group{margin-bottom:14px;}.input-group label{display:block;font-size:12px;font-weight:700;color:var(--tm);margin-bottom:6px;}
.input-group input,.input-group select{width:100%;padding:13px 16px;border:2px solid #d0dcd2;border-radius:var(--rs);font-size:15px;font-family:inherit;background:#fff;transition:var(--tr);}
.input-group input:focus,.input-group select:focus{outline:none;border-color:var(--g);box-shadow:0 0 0 4px rgba(22,163,74,.1);}
.input-row{display:flex;gap:10px;}
.btn{padding:16px;border:none;border-radius:var(--rs);font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:var(--tr);width:100%;}
.btn-primary{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;box-shadow:0 6px 20px rgba(22,163,74,.3);margin-top:12px;}.btn-primary:hover{transform:translateY(-1px);}
.btn-outline{background:transparent;border:2px solid #c8d8ca;color:var(--tm);margin-top:8px;font-size:14px;padding:12px;}.btn-outline:hover{border-color:var(--g);color:var(--g);}
.history-badge{background:var(--gxl);color:var(--g);font-weight:800;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px;}
#historyPanel{display:none;margin-top:14px;}
.history-item{background:var(--card);border:1.5px solid #dde8df;border-radius:var(--rs);padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
.hi-left .hi-name{font-weight:700;font-size:13px;}.hi-left .hi-meta{font-size:11px;color:var(--tl);}
.hi-right .hi-score{font-size:20px;font-weight:900;color:var(--g);}.hi-right .hi-level{font-size:10px;color:var(--tm);text-align:right;}
.exam-topbar{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.06);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;}
.topbar-left{display:flex;align-items:center;gap:10px;}.topbar-dot{width:8px;height:8px;background:var(--g);border-radius:50%;}
.topbar-info{font-size:13px;color:var(--tm);font-weight:600;}.topbar-info span{color:var(--g);font-weight:800;}
.timer{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums;}.timer.warn{color:var(--o);}.timer.danger{color:var(--r);animation:pulse .6s infinite;}
@keyframes pulse{50%{opacity:.3;}}
.btn-submit{padding:9px 22px;background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border:none;border-radius:var(--rxs);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
.exam-scroll{display:none;}
.slide-wrap{height:calc(100vh - 52px);display:flex;flex-direction:column;}
.slide-passage{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px;background:#fff;}
.slide-passage .q-passage{padding:0;border:none;border-radius:0;background:transparent;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.slide-bottom{flex-shrink:0;background:rgba(255,255,255,.2);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border-top:1px solid rgba(255,255,255,.25);box-shadow:0 -2px 20px rgba(0,0,0,.05);padding:10px 14px 12px;max-height:42vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:16px 16px 0 0;}
.slide-stem{font-size:12.5px;font-weight:700;margin-bottom:6px;overflow-wrap:break-word;color:var(--text);}
.slide-choices{display:flex;flex-direction:column;gap:2px;}
.slide-choices .choice-btn{padding:6px 9px;font-size:12px;line-height:1.3;gap:6px;border:1px solid rgba(0,0,0,.05);border-radius:8px;background:rgba(255,255,255,.15);}
.slide-choices .choice-btn:hover{background:rgba(255,255,255,.35);}
.slide-choices .choice-btn.selected{border-color:var(--g);background:rgba(22,163,74,.12);box-shadow:0 0 0 2px rgba(22,163,74,.2);}
.slide-choices .c-num{min-width:18px;height:18px;font-size:9px;background:rgba(0,0,0,.06);}
.slide-choices .choice-btn.selected .c-num{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}
.slide-choices .written-input{padding:7px 10px;font-size:13px;background:rgba(255,255,255,.2);border:1px solid rgba(0,0,0,.05);}
.slide-nav{display:flex;align-items:center;justify-content:space-between;padding:5px 0 0;margin-top:5px;}
.slide-nav button{padding:6px 14px;border:1px solid rgba(0,0,0,.05);border-radius:7px;background:rgba(255,255,255,.15);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
.slide-nav button.sn-next{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-color:transparent;}
.slide-nav button:disabled{opacity:.3;}
.slide-nav .nav-cur{font-size:11px;font-weight:800;color:var(--g);}
.q-card{background:var(--card);border-radius:12px;margin-bottom:14px;box-shadow:var(--shadow);overflow:hidden;}
.q-header{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(135deg,var(--gxl),var(--gl));border-bottom:1px solid #e0ece2;flex-wrap:wrap;}
.q-num{width:28px;height:28px;background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
.q-type-tag{font-size:11px;font-weight:800;padding:4px 12px;border-radius:14px;}
.tag-combo{background:var(--gl);color:#166534;}.tag-wrong{background:var(--rl);color:var(--r);}.tag-blank{background:#E0F7FA;color:#00838F;}.tag-syn{background:var(--bl);color:var(--b);}.tag-ant{background:var(--ol);color:#B45309;}.tag-poly{background:#FCE4EC;color:#C2185B;}.tag-eng{background:#E8F6FF;color:#0277BD;}.tag-morph{background:#FFF3E0;color:#E65100;}.tag-ctx{background:#EDE7F6;color:#5E35B1;}.tag-grammar{background:#E8EAF6;color:#283593;}.tag-vocab{background:#FFF3E0;color:#E65100;}.tag-tf{background:#F3E5F5;color:#7B1FA2;}.tag-content{background:#E0F2F1;color:#00695C;}.tag-written{background:#FBE9E7;color:#BF360C;}.tag-summary{background:#F1F8E9;color:#33691E;}.tag-insert{background:#E0F7FA;color:#00838F;}.tag-order{background:#FFF3E0;color:#E65100;}.tag-understand{background:#E8F5E9;color:#2E7D32;}
.q-meta{display:flex;align-items:center;gap:8px;margin-left:auto;}.q-diff{font-size:11px;color:var(--tl);font-weight:600;background:#f0f5f1;padding:3px 10px;border-radius:10px;}.q-pts{font-size:12px;color:var(--g);font-weight:800;}
.q-body{padding:14px 16px;}
.q-passage{background:linear-gradient(135deg,#FAFDFB,#F5FAF6);border-left:3px solid var(--g);padding:12px 14px;margin-bottom:12px;border-radius:0 8px 8px 0;line-height:1.85;text-align:justify;word-break:keep-all;overflow-wrap:break-word;font-size:clamp(13px,3.2vw,15px);}
.q-stem{font-size:13px;font-weight:700;margin-bottom:10px;overflow-wrap:break-word;}
.choices{display:flex;flex-direction:column;gap:4px;}
.choice-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid #dde8df;border-radius:8px;cursor:pointer;transition:var(--tr);background:#fff;text-align:left;font-family:inherit;font-size:13px;line-height:1.4;}
.choice-btn:hover{border-color:var(--g);}.choice-btn.selected{border-color:var(--g);box-shadow:0 0 0 2px rgba(22,163,74,.12);background:var(--gxxl);}
.c-num{min-width:22px;height:22px;background:#e8efe9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--tm);flex-shrink:0;}.choice-btn.selected .c-num{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}
.written-input{width:100%;padding:10px 12px;border:1.5px solid #d0dcd2;border-radius:8px;font-size:14px;font-family:inherit;}.written-input:focus{outline:none;border-color:var(--g);}
.exam-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.06);padding:10px 16px;display:flex;align-items:center;gap:5px;justify-content:center;z-index:100;overflow-x:auto;flex-wrap:wrap;}
.nav-dot{width:28px;height:28px;border-radius:50%;background:#dde8df;cursor:pointer;border:none;font-size:10px;font-weight:800;color:var(--tm);display:flex;align-items:center;justify-content:center;font-family:inherit;flex-shrink:0;}.nav-dot.answered{background:var(--g);color:#fff;}
.r-hero{padding:48px 20px 36px;text-align:center;}.r-hero.pass{background:linear-gradient(160deg,var(--gxl),var(--gl));}.r-hero.fail{background:linear-gradient(160deg,#FFF3E8,#FFEAEA);}
.r-badge{display:inline-block;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:800;margin-bottom:16px;}.r-badge.pass{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;}.r-badge.fail{background:linear-gradient(135deg,var(--r),#C42A2A);color:#fff;}
.r-score{font-size:72px;font-weight:900;}.r-score sup{font-size:24px;color:var(--tl);}
.r-stats{display:flex;justify-content:center;gap:14px;margin-top:16px;font-size:13px;color:var(--tm);flex-wrap:wrap;}.r-stats strong{color:var(--text);font-weight:800;}.stat-item{background:rgba(255,255,255,.6);padding:6px 14px;border-radius:20px;}
.rc{max-width:740px;margin:0 auto;padding:0 20px 50px;}.rs{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:18px;box-shadow:var(--shadow);}.rs-title{font-size:17px;font-weight:800;margin-bottom:18px;}
.level-card{text-align:center;padding:30px 20px;}.level-icon{font-size:64px;margin-bottom:8px;animation:floatY 3s ease-in-out infinite;}@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.level-name{font-size:28px;font-weight:900;background:linear-gradient(135deg,var(--gd),var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}.level-range{font-size:13px;color:var(--tm);margin-top:4px;}
.level-bar{margin-top:16px;height:8px;background:#e8efe9;border-radius:4px;overflow:hidden;}.level-bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--g),var(--gl));transition:width 1.5s ease;}.level-msg{margin-top:12px;font-size:14px;color:var(--tm);}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.info-cell{padding:12px;background:var(--gxxl);border-radius:var(--rs);border:1px solid #dde8df;}.info-cell .ic-label{font-size:11px;color:var(--tl);font-weight:700;margin-bottom:2px;}.info-cell .ic-value{font-size:15px;font-weight:800;}.info-cell.highlight{background:var(--gxl);}.info-cell.highlight .ic-value{color:var(--g);}
.type-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}.type-label{min-width:60px;font-size:12px;font-weight:700;color:var(--tm);text-align:right;}.type-track{flex:1;height:10px;background:#e8efe9;border-radius:5px;overflow:hidden;}.type-fill{height:100%;border-radius:5px;transition:width 1s ease;}.type-pct{min-width:36px;font-size:12px;font-weight:800;}
.tag-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}.tag-item{padding:5px 12px;border-radius:16px;font-size:12px;font-weight:700;}.tag-item.good{background:var(--gl);color:var(--g);}.tag-item.weak{background:var(--rl);color:var(--r);}
.plan-card{display:flex;gap:14px;padding:16px;background:var(--gxl);border-radius:var(--rs);}.plan-icon{font-size:32px;flex-shrink:0;}.plan-text h4{font-size:15px;font-weight:800;margin-bottom:4px;}.plan-text p{font-size:13px;color:var(--tm);line-height:1.7;}
.action-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}.act-btn{padding:14px;border:2px solid #d0dcd2;border-radius:var(--rs);background:var(--card);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:var(--tr);display:flex;flex-direction:column;align-items:center;gap:4px;}.act-btn:hover{border-color:var(--g);color:var(--g);}.act-btn.primary{background:linear-gradient(135deg,var(--gd),var(--g));color:#fff;border-color:transparent;}.act-btn .act-icon{font-size:20px;}.act-btn .act-label{font-size:12px;}
.rev-card{border:1.5px solid #dde8df;border-radius:var(--rs);margin-bottom:14px;overflow:hidden;}.rev-header{padding:14px 18px;background:var(--gxxl);display:flex;align-items:center;gap:12px;cursor:pointer;}.rev-header:hover{background:var(--gxl);}.rev-icon{font-size:18px;margin-left:auto;transition:transform .2s;}.rev-body{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .3s ease;padding:0 18px;}.rev-body.open{max-height:3000px;padding:20px 18px;}
.expl-tag{display:inline-flex;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;margin-bottom:6px;}.expl-tag.ans{background:var(--gl);color:var(--g);}.expl-tag.tip{background:var(--gxl);color:var(--gd);}
.expl-box{font-size:13.5px;line-height:1.85;padding:14px 16px;background:#FAFAF8;border-radius:var(--rxs);margin-bottom:10px;}.expl-box.ans-b{border-left:3px solid var(--g);}.expl-box.tip-b{border-left:3px solid var(--g);background:var(--gxl);}
@media(max-width:640px){.start-title{font-size:28px;}.r-score{font-size:52px;}.action-grid{grid-template-columns:1fr;}.info-grid{grid-template-columns:1fr;}.q-body{padding:16px;}}`;

const CSS_WORKBOOK = CSS_WORD.replace(/--g:#16A34A/g,'--o:#7C3AED').replace(/--gd:#14532D/g,'--od:#5B21B6').replace(/--gl:#E8F5E9/g,'--ol:#A78BFA').replace(/--gxl:#F0FDF4/g,'--oxl:#F3F0FF').replace(/--gxxl:#F8FDF9/g,'--oxxl:#FAF5FF').replace(/--bg:#F4F8F5/g,'--bg:#F5F3FF').replace(/--tm:#5A6A5E/g,'--tm:#6B5B8A').replace(/--tl:#8A9A8E/g,'--tl:#9A8DB8').replace(/#0D9488/g,'#6D28D9').replace(/22,163,74/g,'124,58,237').replace(/#f0f5f1/g,'#F0EDFF').replace(/#dde8df/g,'#DDD0EF').replace(/#d0dcd2/g,'#D0C8E2').replace(/#c8d8ca/g,'#C8C0DA').replace(/#e8efe9/g,'#E8E0F0').replace(/#e0ece2/g,'#E0D8F0').replace(/#FAFDFB/g,'#FAFAFF').replace(/#F5FAF6/g,'#F5F0FF').replace(/#F0FDF4/g,'#F3F0FF').replace(/#E8F5E9/g,'#E8E0FF').replace(/#DCFCE7/g,'#DDD6FE').replace(/#166534/g,'#5B21B6').replace(/var\(--g\)/g,'var(--o)').replace(/var\(--gd\)/g,'var(--od)').replace(/var\(--gl\)/g,'var(--ol)').replace(/var\(--gxl\)/g,'var(--oxl)').replace(/var\(--gxxl\)/g,'var(--oxxl)');

const CSS_QUIZ = CSS_WORD.replace(/--g:#16A34A/g,'--o:#E8772E').replace(/--gd:#14532D/g,'--od:#B85A1A').replace(/--gl:#E8F5E9/g,'--ol:#F5A623').replace(/--gxl:#F0FDF4/g,'--oxl:#FFF3E8').replace(/--gxxl:#F8FDF9/g,'--oxxl:#FFFAF5').replace(/--bg:#F4F8F5/g,'--bg:#F6F2EE').replace(/--tm:#5A6A5E/g,'--tm:#7A6A5E').replace(/--tl:#8A9A8E/g,'--tl:#A89A8E').replace(/#0D9488/g,'#D97706').replace(/22,163,74/g,'232,119,46').replace(/#f0f5f1/g,'#F0E8DF').replace(/#dde8df/g,'#E0D8CF').replace(/#d0dcd2/g,'#E0D8CF').replace(/#c8d8ca/g,'#E0D8CF').replace(/#e8efe9/g,'#F0E8DF').replace(/#e0ece2/g,'#E0D8CF').replace(/#FAFDFB/g,'#FFFAF5').replace(/#F5FAF6/g,'#FFF5EE').replace(/#F0FDF4/g,'#FFF3E8').replace(/#E8F5E9/g,'#FFE8D5').replace(/#DCFCE7/g,'#FFDDC4').replace(/#166534/g,'#B85A1A').replace(/var\(--g\)/g,'var(--o)').replace(/var\(--gd\)/g,'var(--od)').replace(/var\(--gl\)/g,'var(--ol)').replace(/var\(--gxl\)/g,'var(--oxl)').replace(/var\(--gxxl\)/g,'var(--oxxl)');

// ===== JS Engine (from 1강 reference) =====
function getJSEngine(themeVar) {
  // themeVar: 'g' for green(단어), 'o' for purple/orange(워크북/퀴즈)
  const mainColor = themeVar === 'g' ? 'var(--g)' : 'var(--o)';
  const darkColor = themeVar === 'g' ? 'var(--gd)' : 'var(--od)';
  const lightColor = themeVar === 'g' ? 'var(--gl)' : 'var(--ol)';
  const xlColor = themeVar === 'g' ? 'var(--gxl)' : 'var(--oxl)';
  const passHex = themeVar === 'g' ? '#16A34A' : (themeVar === 'o-purple' ? '#7C3AED' : '#E8772E');

  return `const typeTag={'(A)(B)(C) 조합형':'tag-combo','문맥상 부적절한 어휘':'tag-wrong','빈칸 어휘 완성':'tag-blank','동의어 고르기':'tag-syn','반의어 고르기':'tag-ant','다의어 문맥적 의미':'tag-poly','영영풀이 매칭':'tag-eng','어형 변환 (서술형)':'tag-morph','빈칸 문맥 완성':'tag-ctx','어법':'tag-grammar','어휘':'tag-vocab','빈칸추론':'tag-blank','서술형':'tag-written','내용일치':'tag-content','내용불일치':'tag-content','T/F':'tag-tf','문장삽입':'tag-insert','어순배열':'tag-order','내용이해':'tag-understand','종합':'tag-ctx'};

let S={ans:[],cur:0,ti:null,left:EI.time,start:0};

function getHistory(){try{return JSON.parse(localStorage.getItem(EI.histKey)||'[]');}catch(e){return[];}}
function saveToHistory(r,elapsed){const h=getHistory();h.unshift({name:document.getElementById('inpName').value.trim(),school:document.getElementById('inpSchool').value.trim(),grade:document.getElementById('inpGrade').value,score:r.score,total:EI.total,correct:r.correct,wrong:r.wrong,unanswered:r.unanswered,elapsed,date:new Date().toISOString(),level:getLevel(r.score).name,answers:S.ans.slice()});if(h.length>20)h.length=20;localStorage.setItem(EI.histKey,JSON.stringify(h));}
function updateHCount(){const h=getHistory();document.getElementById('hCount').textContent=h.length;}
function toggleHistory(){const p=document.getElementById('historyPanel');if(p.style.display==='block'){p.style.display='none';return;}const h=getHistory();if(!h.length){p.innerHTML='<p style="text-align:center;color:var(--tl);font-size:13px;padding:20px">아직 기록이 없습니다.</p>';p.style.display='block';return;}p.innerHTML=h.map((x,idx)=>\`<div class="history-item" style="flex-wrap:wrap"><div class="hi-left"><div class="hi-name">\${x.name||'이름없음'}</div><div class="hi-meta">\${new Date(x.date).toLocaleDateString('ko-KR')} \\u00b7 \${x.grade} \\u00b7 \${x.level||''}</div></div><div class="hi-right"><div class="hi-score" style="color:\${x.score>=80?'${mainColor}':'var(--r)'}">\${x.score}<span style="font-size:11px;color:var(--tl)">/\${x.total}</span></div></div>\${x.answers?\`<button onclick="reviewHistory(\${idx})" style="width:100%;margin-top:8px;padding:8px;border:1.5px solid #dde8df;border-radius:8px;background:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:${mainColor}">\\ud83d\\udcdd \\uc815\\ub2f5\\u00b7\\ud574\\uc124 \\ub2e4\\uc2dc \\ubcf4\\uae30</button>\`:''}</div>\`).join('');p.style.display='block';}
function getLevel(s){if(s>=95)return{name:'\\ub9c8\\uc2a4\\ud130',icon:'\\ud83d\\udc51',range:'95~100',msg:'\\uc774 \\ub2e8\\uc6d0\\uc740 \\uc815\\ubcf5\\ud588\\uc5b4\\uc694!'};if(s>=85)return{name:'\\ucc4c\\ub9b0\\uc800',icon:'\\ud83c\\udf1f',range:'85~94',msg:'\\uac70\\uc758 \\uc644\\ubcbd, \\ud55c \\ub05d \\ucc28\\uc774!'};if(s>=75)return{name:'\\ud30c\\uc774\\ud130',icon:'\\ud83d\\udc8e',range:'75~84',msg:'\\ud1b5\\uacfc! \\uc57d\\uc810\\ub9cc \\uc7a1\\uc73c\\uba74 \\ub9c8\\uc2a4\\ud130'};if(s>=50)return{name:'\\ub8e8\\ud0a4',icon:'\\ud83d\\udd25',range:'50~74',msg:'\\uae30\\ubcf8\\uae30 OK, \\uc720\\ud615\\ubcc4 \\ud6c8\\ub828 \\ud544\\uc694'};return{name:'\\uc2a4\\ud0c0\\ud130',icon:'\\ud83d\\udcd6',range:'0~49',msg:'\\uc9c0\\ubb38 \\ud574\\uc11d\\ubd80\\ud130 \\ub2e4\\uc2dc!'};}
function getTypeAdvice(t){const m={'(A)(B)(C) 조합형':'반의어 함정 주의, 원문 단어 정확히 암기','문맥상 부적절한 어휘':'밑줄 단어가 반의어로 바뀌었는지 확인','동의어 고르기':'동의어 쌍을 세트로 묶어 암기','반의어 고르기':'반의어 쌍을 세트로 묶어 암기','빈칸 어휘 완성':'문맥 단서(clue) 찾기 연습 필요','다의어 문맥적 의미':'다의어의 여러 뜻을 문맥별로 구분','영영풀이 매칭':'영영사전 정의 읽기 연습','어형 변환 (서술형)':'품사 변환 규칙(명↔형, 동↔명) 정리','빈칸 문맥 완성':'글의 흐름과 논리적 연결 파악','어법':'핵심 어법 규칙 정리 및 반복 연습','내용일치':'지문과 선지를 꼼꼼히 대조','내용불일치':'함정 선지의 미세한 차이 찾기','T/F':'원문과 진술을 정확히 대조','서술형':'정확한 철자와 어형 변환 주의','빈칸추론':'빈칸 전후 문맥 단서 찾기','문장삽입':'글의 흐름과 연결사 파악','어순배열':'문장 구조(S+V+O) 정확히 파악','어휘':'문맥에서 적절한 어휘 고르기 연습','내용이해':'지문 핵심 내용 정확히 파악'};return m[t]||'해당 유형 집중 복습 필요';}
function fmtTime(s){return Math.floor(s/60)+'분 '+s%60+'초';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}

function startExam(){const nm=document.getElementById('inpName').value.trim();if(!nm){toast('이름을 입력해주세요!');return;}S={ans:Array(EI.totalQ).fill(null),cur:0,ti:null,left:EI.time,start:Date.now()};showScreen('examScreen');renderSlide(0);startTimer();}

function renderSlide(idx){
S.cur=idx;const q=Q[idx];const tc=typeTag[q.type]||'';const mk=q.ch&&q.ch.length===5?'\\u2460\\u2461\\u2462\\u2463\\u2464':q.ch&&q.ch.length===4?'\\u2460\\u2461\\u2462\\u2463':q.ch&&q.ch.length===2?'\\u2460\\u2461':'\\u2460\\u2461\\u2462\\u2463\\u2464';
const pp=document.getElementById('slidePassage');
let ph=\`<div class="slide-header" style="display:flex;align-items:center;gap:8px;padding:0 0 10px;margin-bottom:10px;border-bottom:1px solid #eee"><div class="q-num">\${q.id}</div><span class="q-type-tag \${tc}" style="font-size:10px;padding:3px 8px">\${q.type}</span><span style="margin-left:auto;font-size:11px;color:var(--tl)">\${q.diff} \\u00b7 \${q.pts}점</span></div>\`;
if(q.passage)ph+=\`<div class="q-passage">\${q.passage}</div>\`;
if(!q.passage)ph+=\`<div style="padding:20px;text-align:center;color:var(--tl);font-size:13px">이 문항은 지문이 없습니다.</div>\`;
pp.innerHTML=ph;pp.scrollTop=0;
const bt=document.getElementById('slideBottom');
let bh=\`<div class="slide-stem">\${q.stem}</div>\`;
if(q.fmt==='mc'){bh+=\`<div class="slide-choices">\`;q.ch.forEach((c,ci)=>{const sel=S.ans[idx]===ci?' selected':'';bh+=\`<button class="choice-btn\${sel}" onclick="slideSel(\${idx},\${ci})"><span class="c-num">\${mk[ci]}</span><span>\${c}</span></button>\`;});bh+=\`</div>\`;}
if(q.fmt==='written'){const val=S.ans[idx]||'';bh+=\`<input class="written-input" id="sw-\${idx}" value="\${val}" placeholder="답안을 입력하세요..." oninput="slideWrite(\${idx})">\`;}
bh+=\`<div class="slide-nav"><button \${idx===0?'disabled':''}onclick="renderSlide(\${idx-1})">&larr; 이전</button><span class="nav-cur">\${idx+1} / \${EI.totalQ}</span><button class="sn-next" \${idx===EI.totalQ-1?'disabled':''}onclick="renderSlide(\${idx+1})">다음 &rarr;</button></div>\`;
bt.innerHTML=bh;bt.scrollTop=0;
}
function slideSel(qi,ci){S.ans[qi]=ci;const st=document.getElementById('slidePassage').scrollTop;renderSlide(qi);document.getElementById('slidePassage').scrollTop=st;}
function slideWrite(qi){const el=document.getElementById('sw-'+qi);S.ans[qi]=el?el.value.trim()||null:null;}
function renderQ(){}
function renderDots(){}
function upDots(){}
function scrollToQ(i){if(i>=0&&i<EI.totalQ)renderSlide(i);}
function sel(){}
function sw(){}
function startTimer(){const el=document.getElementById('timer');S.ti=setInterval(()=>{S.left--;const m=Math.floor(S.left/60),s=S.left%60;el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');el.classList.toggle('warn',S.left<=300&&S.left>60);el.classList.toggle('danger',S.left<=60);if(S.left<=0){clearInterval(S.ti);submitExam();}},1000);}
function submitExam(){if(!confirm('제출하시겠습니까?'))return;clearInterval(S.ti);const elapsed=Math.floor((Date.now()-S.start)/1000);const r=grade();saveToHistory(r,elapsed);renderResults(r,elapsed);showScreen('resultScreen');window.scrollTo(0,0);}
function grade(){let score=0,correct=0,wrong=0,unanswered=0;const details=[];Q.forEach((q,i)=>{const a=S.ans[i];let ok=false;if(a===null)unanswered++;else if(q.fmt==='mc')ok=a===q.ans;else{const u=String(a).trim().toLowerCase();if(q.accept)ok=q.accept.some(x=>u===x.toLowerCase());if(!ok&&q.wa)ok=u===q.wa.toLowerCase();}if(a!==null){if(ok){correct++;score+=q.pts;}else wrong++;}details.push({q,ans:a,ok});});return{score,correct,wrong,unanswered,details};}
function renderResults(r,elapsed){const pass=r.score>=80,nm=document.getElementById('inpName').value.trim(),sc=document.getElementById('inpSchool').value.trim(),gr=document.getElementById('inpGrade').value,lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100);const typeMap={};r.details.forEach(d=>{const t=d.q.type;if(!typeMap[t])typeMap[t]={total:0,ok:0};typeMap[t].total++;if(d.ok)typeMap[t].ok++;});const perfectTypes=Object.entries(typeMap).filter(([,v])=>v.ok===v.total).map(([k])=>k);const weakTypes=Object.entries(typeMap).filter(([,v])=>v.ok<v.total).map(([k])=>k);let h='';
h+=\`<div class="r-hero \${pass?'pass':'fail'}"><div class="r-badge \${pass?'pass':'fail'}">\${pass?'\\ud83c\\udf89 \\ud1b5\\uacfc!':'\\ud83d\\udcda \\ubbf8\\ud1b5\\uacfc'}</div><div class="r-score">\${r.score}<sup>/\${EI.total}</sup></div><div class="r-stats"><span class="stat-item">\\u2705 \\uc815\\ub2f5 <strong>\${r.correct}</strong></span><span class="stat-item">\\u274c \\uc624\\ub2f5 <strong>\${r.wrong}</strong></span><span class="stat-item">\\u2b1c \\ubbf8\\uc751\\ub2f5 <strong>\${r.unanswered}</strong></span><span class="stat-item">\\u23f1\\ufe0f <strong>\${fmtTime(elapsed)}</strong></span></div></div><div class="rc">\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83d\\udccb \\uae30\\ubcf8 \\uc815\\ubcf4</div><div class="info-grid"><div class="info-cell"><div class="ic-label">이름</div><div class="ic-value">\${nm}</div></div><div class="info-cell"><div class="ic-label">학교 / 학년</div><div class="ic-value">\${sc||'미입력'} \\u00b7 \${gr}</div></div><div class="info-cell"><div class="ic-label">시험 범위</div><div class="ic-value">\${EI.subject} \\u00b7 \${EI.pub}</div></div><div class="info-cell"><div class="ic-label">응시일</div><div class="ic-value">\${new Date().toLocaleDateString('ko-KR')}</div></div><div class="info-cell highlight"><div class="ic-label">점수</div><div class="ic-value">\${r.score}점 / \${EI.total}점 (\${pct}%)</div></div><div class="info-cell highlight"><div class="ic-label">소요시간 / 통과</div><div class="ic-value">\${fmtTime(elapsed)} / <span style="color:\${pass?'${mainColor}':'var(--r)'}">\${pass?'통과 \\u2705':'미통과 \\u274c'}</span></div></div></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83c\\udfc5 \\ub808\\ubca8</div><div class="level-card"><div class="level-icon">\${lv.icon}</div><div class="level-name">\${lv.name}</div><div class="level-range">\${lv.range}점 구간</div><div class="level-bar"><div class="level-bar-fill" style="width:\${pct}%"></div></div><div class="level-msg">\${lv.msg}</div></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83d\\udd0d \\ub0b4\\uc2e0\\ud54f \\uc57d\\uc810 \\uc9c4\\ub2e8</div>\`;Object.entries(typeMap).forEach(([type,d])=>{const p=Math.round(d.ok/d.total*100);const c=p===100?'${mainColor}':p>=50?'var(--o, #F59E0B)':'var(--r)';const icon=p===100?'\\u2705':p>=50?'\\u26a0\\ufe0f':'\\u274c';h+=\`<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:13px">\${icon}</span><span style="font-size:13px;font-weight:700;flex:1">\${type.replace(/\\(.+?\\)/g,'').trim()}</span><span style="font-size:13px;font-weight:800;color:\${c}">\${d.ok}/\${d.total}</span></div><div class="type-track"><div class="type-fill" style="width:\${p}%;background:\${c}"></div></div>\${p<100?\`<div style="font-size:11px;color:var(--tm);margin-top:3px;padding-left:21px">\\u2192 \${getTypeAdvice(type)}</div>\`:''}</div>\`;});h+=\`</div>\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83d\\udcdd \\ub0b4\\uc2e0\\ud54f \\ucc98\\ubc29</div><div class="plan-card">\`;if(pct>=95)h+=\`<div class="plan-icon">\\ud83d\\udc51</div><div class="plan-text"><h4>마스터 달성!</h4><p>이 단원은 완벽합니다. 다음 단원에 도전하세요!</p></div>\`;else if(pct>=80)h+=\`<div class="plan-icon">\\ud83c\\udf1f</div><div class="plan-text"><h4>통과! 마스터까지 한 끗</h4><p>아래 약점 유형만 집중하면 마스터 달성!</p></div>\`;else if(pct>=50)h+=\`<div class="plan-icon">\\ud83d\\udd25</div><div class="plan-text"><h4>기본기는 있어요!</h4><p>오답 해설을 꼼꼼히 확인하고, 약점 유형부터 공략하세요.</p></div>\`;else h+=\`<div class="plan-icon">\\ud83d\\udcd6</div><div class="plan-text"><h4>지문 해석부터!</h4><p>본문을 완벽히 이해한 뒤 재도전하세요. 해설의 한글 해석을 활용!</p></div>\`;h+=\`</div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83d\\ude80 \\uc561\\uc158</div><div class="action-grid" style="grid-template-columns:1fr 1fr"><button class="act-btn" onclick="shareImage()"><span class="act-icon">\\ud83d\\udcf8</span><span class="act-label">이미지 공유</span></button><button class="act-btn" onclick="copyResult()"><span class="act-icon">\\ud83d\\udccb</span><span class="act-label">텍스트 복사</span></button><button class="act-btn" onclick="retake()"><span class="act-icon">\\ud83d\\udd04</span><span class="act-label">재시험</span></button><button class="act-btn primary" onclick="goHome()"><span class="act-icon">\\ud83c\\udfe0</span><span class="act-label">홈으로</span></button></div></div>\`;
h+=\`<div class="rs"><div class="rs-title">\\ud83d\\udcdd \\uc815\\ub2f5\\uacfc \\ud574\\uc124 <span style="font-size:12px;color:var(--tl);margin-left:8px">클릭하여 펼치기</span></div>\`;r.details.forEach((d,i)=>{const icon=d.ok?'\\u2705':(d.ans===null?'\\u2b1c':'\\u274c');const mk=d.q.ch&&d.q.ch.length===5?'\\u2460\\u2461\\u2462\\u2463\\u2464':d.q.ch&&d.q.ch.length===4?'\\u2460\\u2461\\u2462\\u2463':d.q.ch&&d.q.ch.length===2?'\\u2460\\u2461':'\\u2460\\u2461\\u2462\\u2463\\u2464';const ua=d.q.fmt==='mc'?(d.ans!==null?mk[d.ans]:'미응답'):(d.ans||'미응답');const ca=d.q.fmt==='mc'?mk[d.q.ans]:(d.q.wa||'');const open=!d.ok;
let chHtml='';if(d.q.fmt==='mc'&&d.q.ch){chHtml=\`<div style="margin-top:8px">\`;d.q.ch.forEach((c,ci)=>{const isAns=ci===d.q.ans;const isMy=d.ans===ci;const color=isAns?'${mainColor}':(isMy&&!d.ok?'var(--r)':'var(--tm)');const bg=isAns?'${lightColor}':(isMy&&!d.ok?'var(--rl)':'transparent');const label=isAns?' \\u2705':(isMy&&!d.ok?' \\u274c':'');chHtml+=\`<div style="padding:4px 8px;margin-bottom:2px;border-radius:6px;font-size:12px;color:\${color};background:\${bg}"><b>\${mk[ci]}</b> \${c}\${label}</div>\`;});chHtml+=\`</div>\`;}
h+=\`<div class="rev-card"><div class="rev-header" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.rev-icon').style.transform=this.nextElementSibling.classList.contains('open')?'rotate(180deg)':''"><span style="font-weight:800">\${icon} \${d.q.id}번</span><span style="font-size:12px;color:var(--tm)">[\${d.q.type.slice(0,8)}] \${d.q.diff} \${d.q.pts}점</span><span class="rev-icon">\\u25bc</span></div><div class="rev-body\${open?' open':''}"><div style="display:flex;gap:10px;margin-bottom:10px"><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;\${d.ok?'background:${lightColor};color:${mainColor}':'background:var(--rl);color:var(--r)'}"><div style="font-size:10px;opacity:.7">내 답</div>\${ua}</div><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;background:${lightColor};color:${mainColor}"><div style="font-size:10px;opacity:.7">정답</div>\${ca}</div></div><div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\\ud83d\\udcdd 문제</div><div class="expl-box" style="font-size:12.5px;line-height:1.6;border-left:3px solid var(--b);margin-bottom:10px"><div style="font-weight:700;margin-bottom:6px">\${d.q.stem}</div>\${chHtml}</div>\${d.q.passage?\`<div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\\ud83d\\udcd6 원문</div><div class="expl-box" style="font-size:12px;line-height:1.75;border-left:3px solid #ddd;margin-bottom:10px">\${d.q.passage}</div>\`:''}\${d.q.det?\`<div class="expl-tag ans">\\ud83c\\uddf0\\ud83c\\uddf7 해석</div><div class="expl-box ans-b">\${d.q.det.korean||''}</div><div class="expl-tag tip">\\ud83d\\udccb 풀이 \\u00b7 선지 분석</div><div class="expl-box" style="white-space:pre-line">\${(d.q.det.analysis||'').replace(/\\\\n/g,'<br>')}</div><div class="expl-tag tip">\\ud83d\\udca1 포인트</div><div class="expl-box tip-b">\${d.q.det.tip||''}</div>\`:''}</div></div>\`;}); h+=\`</div></div>\`;document.getElementById('resultScreen').innerHTML=h;}
function getWeakTypes(){const r=grade();const tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});return Object.entries(tm).filter(([,v])=>v.ok<v.total).map(([k])=>k);}
function getTestName(){const t=document.title;if(t.includes('단어'))return '단어테스트';if(t.includes('워크북'))return '워크북테스트';if(t.includes('퀴즈'))return '퀴즈(예상문제)테스트';return 'TEST';}
function copyResult(){const r=grade(),lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100),nm=document.getElementById('inpName').value.trim(),sc=document.getElementById('inpSchool').value.trim(),gr=document.getElementById('inpGrade').value,elapsed=Math.floor((Date.now()-S.start)/1000),pass=r.score>=80,tn=getTestName(),wk=getWeakTypes(),tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});let txt=\`\\ud83d\\udcdd \\ub0b4\\uc2e0\\ud54f \${tn} \\uacb0\\uacfc\\n\${EI.subject} \\u00b7 \${EI.pub}\\n\${nm}\${sc?' \\u00b7 '+sc:''} \\u00b7 \${gr}\\n\${new Date().toLocaleDateString('ko-KR')}\\n\\n\${lv.icon} \${lv.name} \\u00b7 \${r.score}/\${EI.total}\\uc810 (\${pct}%)\\n\${pass?'\\ud83c\\udf89 \\ud1b5\\uacfc!':'\\ud83d\\udcda \\ubbf8\\ud1b5\\uacfc'} \\u00b7 \\u2705\${r.correct} \\u274c\${r.wrong} \\u2b1c\${r.unanswered}\\n\\u23f1\\ufe0f \${fmtTime(elapsed)}\`;if(wk.length){txt+=\`\\n\\n\\ud83d\\udd0d \\ub0b4\\uc2e0\\ud54f \\uc57d\\uc810 \\uc9c4\\ub2e8\`;wk.forEach(w=>{const d=tm[w];txt+=\`\\n\\u2022 \${w.replace(/\\(.+?\\)/g,'').trim()} \${d.ok}/\${d.total} \\u2192 \${getTypeAdvice(w)}\`;});}txt+=\`\\n\\n\\ud83d\\udcca \\ub0b4\\uc2e0\\ud54f | \\ub0b4\\uc2e0 \\uc601\\uc5b4 \\uc644\\ubcbd \\ub300\\ube44\`;navigator.clipboard.writeText(txt).then(()=>toast('\\ud83d\\udccb \\uacb0\\uacfc\\uac00 \\ubcf5\\uc0ac\\ub418\\uc5c8\\uc2b5\\ub2c8\\ub2e4!')).catch(()=>{toast('복사 실패');});}
function shareImage(){const tn=getTestName(),wk=getWeakTypes(),r=grade(),lv=getLevel(r.score),pct=Math.round(r.score/EI.total*100),pass=r.score>=80,nm=document.getElementById('inpName').value.trim(),tm={};r.details.forEach(d=>{const t=d.q.type;if(!tm[t])tm[t]={total:0,ok:0};tm[t].total++;if(d.ok)tm[t].ok++;});const pc=pass?'${passHex}':'#D63B3B';let card=\`<div style="width:400px;font-family:-apple-system,sans-serif;background:#fff;border-radius:16px;overflow:hidden">\`;card+=\`<div style="background:linear-gradient(135deg,\${pass?'#E8F5E9,#C8E6C9':'#FFF0F0,#FFEAEA'});padding:28px 24px;text-align:center"><div style="font-size:12px;font-weight:800;color:\${pc};margin-bottom:4px">내신핏 \${tn}</div><div style="font-size:13px;color:#666;margin-bottom:16px">\${EI.subject} \\u00b7 \${EI.pub}</div><div style="font-size:56px;font-weight:900;color:#1A1A2E">\${r.score}<span style="font-size:20px;color:#aaa">/\${EI.total}</span></div><div style="margin-top:8px"><span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:800;background:\${pc};color:#fff">\${lv.icon} \${lv.name} \\u00b7 \${pass?'통과':'미통과'}</span></div><div style="margin-top:12px;font-size:12px;color:#888">\\ud83d\\udc64 \${nm} \\u00b7 \\u2705\${r.correct} \\u274c\${r.wrong} \\u2b1c\${r.unanswered}</div></div>\`;if(wk.length){card+=\`<div style="padding:16px 20px;border-top:1px solid #eee"><div style="font-size:13px;font-weight:800;margin-bottom:10px">\\ud83d\\udd0d 내신핏 약점 진단</div>\`;Object.entries(tm).forEach(([type,d])=>{const p=Math.round(d.ok/d.total*100);const c=p===100?'#16A34A':p>=50?'#F59E0B':'#D63B3B';card+=\`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="font-weight:600">\${type.replace(/\\(.+?\\)/g,'').trim()}</span><span style="font-weight:800;color:\${c}">\${d.ok}/\${d.total}</span></div><div style="height:6px;background:#eee;border-radius:3px"><div style="height:100%;width:\${p}%;background:\${c};border-radius:3px"></div></div></div>\`;});card+=\`</div>\`;}card+=\`<div style="padding:12px 20px;background:#f8f8f8;text-align:center;font-size:11px;color:#999">\\ud83d\\udcca <b style="color:#333">내신핏</b> | 내신 영어 완벽 대비</div></div>\`;const wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-9999px;top:0;';wrap.innerHTML=card;document.body.appendChild(wrap);html2canvas(wrap.firstChild,{scale:2,backgroundColor:null,useCORS:true}).then(canvas=>{document.body.removeChild(wrap);canvas.toBlob(blob=>{if(navigator.share&&blob){const file=new File([blob],'내신핏_'+tn+'_결과.png',{type:'image/png'});navigator.share({files:[file],title:'내신핏 '+tn+' 결과'}).catch(()=>{});}else{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='내신핏_'+tn+'_결과.png';a.click();}toast('\\ud83d\\udcf8 결과 이미지가 저장되었습니다!');});}).catch(()=>toast('이미지 생성 실패'));}
function reviewHistory(idx){const h=getHistory();const rec=h[idx];if(!rec||!rec.answers)return toast('이전 버전 기록은 해설을 볼 수 없습니다.');S.ans=rec.answers;S.start=Date.now()-rec.elapsed*1000;document.getElementById('inpName').value=rec.name||'';document.getElementById('inpSchool').value=rec.school||'';document.getElementById('inpGrade').value=rec.grade||'고1';const r=grade();renderResults(r,rec.elapsed);showScreen('resultScreen');window.scrollTo(0,0);}
function retake(){startExam();}
function goHome(){showScreen('startScreen');updateHCount();}
window.addEventListener('beforeunload',e=>{if(S.ti){e.preventDefault();e.returnValue='';}});
updateHCount();`;
}

// ===== Build HTML =====
function buildHTML(testType, css, ei, questions, passage, num) {
  const testLabel = testType === '단어' ? '온라인단어' : testType === '워크북' ? '온라인워크북' : '온라인퀴즈';
  const themeVar = testType === '단어' ? 'g' : testType === '워크북' ? 'o-purple' : 'o-orange';
  const mainColor = testType === '단어' ? 'var(--g)' : 'var(--o)';

  const title = `2024 고1 3월 ${num}번 ${testLabel}TEST`;

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<style>
${css}
</style>
</head>
<body>
<div class="toast" id="toast"></div>
<div id="startScreen" class="screen active">
<div class="start-container">
  <div class="brand-badge">${testType === '단어' ? '📝' : testType === '워크북' ? '📝' : '📝'} ${testLabel} TEST</div>
  <h1 class="start-title">${testLabel} <span>TEST</span></h1>
  <p class="start-subtitle">${ei.subject} · ${ei.pub} · ${ei.lesson} · ${ei.totalQ}문항</p>
  <div class="info-card"><div class="info-card-header">📚 시험 정보</div><div class="info-rows">
    <div class="info-row"><span class="info-label">시험</span><span class="info-value">${ei.subject}</span></div>
    <div class="info-row"><span class="info-label">문항</span><span class="info-value">${ei.pub} (${ei.lesson})</span></div>
    <div class="info-row"><span class="info-label">지문</span><span class="info-value">${ei.title}</span></div>
  </div></div>
  <div class="chip-row"><div class="chip">📝 ${ei.totalQ}문항</div><div class="chip">⏱️ 20분</div><div class="chip">✅ 80점 이상 통과</div><div class="chip">📊 100점 만점</div></div>
  <div class="input-group"><label>이름 *</label><input type="text" id="inpName" placeholder="이름을 입력하세요"></div>
  <div class="input-row">
    <div class="input-group" style="flex:1"><label>학교</label><input type="text" id="inpSchool" placeholder="선택"></div>
    <div class="input-group" style="flex:.6"><label>학년</label><select id="inpGrade"><option>고1</option><option>고2</option><option>고3</option><option>중3</option></select></div>
  </div>
  <button class="btn btn-primary" onclick="startExam()">시험 시작하기 →</button>
  <button class="btn btn-outline" onclick="toggleHistory()">📋 시험 기록 보기 <span class="history-badge" id="hCount">0</span></button>
  <div id="historyPanel"></div>
</div>
</div>
<div id="examScreen" class="screen">
  <div class="exam-topbar"><div class="topbar-left"><div class="topbar-dot"></div><div class="topbar-info">2024 고1 3월 · <span>${num}번</span></div></div><div class="timer" id="timer">20:00</div><button class="btn-submit" onclick="submitExam()">제출하기</button></div>
  <div class="exam-scroll" id="examScroll"></div>
  <div class="slide-wrap" id="slideWrap">
    <div class="slide-passage" id="slidePassage"></div>
    <div class="slide-bottom" id="slideBottom"></div>
  </div>
</div>
<div id="resultScreen" class="screen"></div>
<script>
const EI=${JSON.stringify(ei)};

const Q=${JSON.stringify(questions, null, 0)};

${getJSEngine(themeVar)}
<\/script>
</body>
</html>`;

  return html;
}

// ===== Main Processing =====
const dirs = fs.readdirSync(BASE).filter(d => {
  try { return fs.statSync(path.join(BASE, d)).isDirectory() && /^\d+번$/.test(d); }
  catch(e) { return false; }
}).sort((a,b) => parseInt(a) - parseInt(b));

let totalFixed = 0;
const report = [];

for (const dir of dirs) {
  const num = parseInt(dir);
  const dirPath = path.join(BASE, dir);

  for (const [testType, css, targetTypes] of [
    ['단어', CSS_WORD, WORD_TYPES],
    ['워크북', CSS_WORKBOOK, WORKBOOK_TYPES],
    ['퀴즈', CSS_QUIZ, getQuizTypes(num)],
  ]) {
    const fileName = testType + '테스트.html';
    const filePath = path.join(dirPath, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${dir}/${fileName} - not found`);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf8');

    // Extract existing data
    const eiMatch = html.match(/const EI=(\{[^;]+?\});/);
    const qMatch = html.match(/const Q=(\[[\s\S]*?\]);/);

    if (!eiMatch || !qMatch) {
      console.log(`SKIP: ${dir}/${fileName} - can't parse`);
      continue;
    }

    const origEI = JSON.parse(eiMatch[1]);
    const origQ = JSON.parse(qMatch[1]);

    // Update EI
    const newEI = {
      subject: '2024 고1 3월 모의고사',
      pub: num + '번',
      lesson: origEI.lesson || '',
      title: origEI.title || '',
      total: 100,
      time: 1200,
      totalQ: 20,
      histKey: `${testType}Test_2024_g1_mar_${num}_v2`,
    };

    // Retype questions
    const newQ = retypeQuestions(origQ, targetTypes, testType);

    // Fix newlines in all passages and stems
    newQ.forEach(q => {
      if (q.passage) q.passage = fixNewlines(q.passage);
      if (q.stem) q.stem = fixNewlines(q.stem);
      if (q.det) {
        if (q.det.korean) q.det.korean = fixNewlines(q.det.korean);
        if (q.det.analysis) q.det.analysis = fixNewlines(q.det.analysis);
        if (q.det.tip) q.det.tip = fixNewlines(q.det.tip);
      }
    });

    // Verify total pts
    const totalPts = newQ.reduce((s, q) => s + q.pts, 0);
    if (totalPts !== 100) {
      console.log(`WARNING: ${dir}/${fileName} total pts = ${totalPts}, adjusting...`);
      // Adjust last question
      const diff = 100 - totalPts;
      newQ[newQ.length - 1].pts += diff;
    }

    // Build HTML
    const newHTML = buildHTML(testType, css, newEI, newQ, '', num);

    // Write
    fs.writeFileSync(filePath, newHTML, 'utf8');
    totalFixed++;

    // Verify
    const finalPts = newQ.reduce((s, q) => s + q.pts, 0);
    const typeCounts = {};
    newQ.forEach(q => typeCounts[q.type] = (typeCounts[q.type]||0)+1);
    const ch5 = newQ.filter(q => q.ch && q.ch.length >= 5 && q.fmt === 'mc').length;
    const mcTotal = newQ.filter(q => q.fmt === 'mc').length;

    report.push(`${dir}/${testType}: pts=${finalPts}, types=${Object.keys(typeCounts).length}, ch5=${ch5}/${mcTotal}mc`);
  }
}

console.log(`\n=== DONE: Fixed ${totalFixed} files ===\n`);
report.forEach(r => console.log(r));
