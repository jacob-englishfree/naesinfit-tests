/* NaesinFit Test Engine v1.0
   Expects these globals before this script runs:
   - const EI = {...}          // exam info
   - const FULL_PASSAGE = "..."  // full passage text
   - const Q = [...]           // questions array
*/

const typeTag = {
  '문장삽입': 'tag-insert',
  '어순배열': 'tag-order',
  '순서배열': 'tag-order',
  '글순서': 'tag-order',
  '어법': 'tag-grammar',
  '어휘': 'tag-vocab',
  '빈칸추론': 'tag-blank',
  '빈칸 추론': 'tag-blank',
  '서술형': 'tag-written',
  '내용이해': 'tag-content',
  '내용일치': 'tag-content',
  '내용불일치': 'tag-content',
  'T/F': 'tag-tf',
  '(A)(B)(C) 조합형': 'tag-combo',
  '문맥상 부적절한 어휘': 'tag-wrong',
  '동의어 고르기': 'tag-syn',
  '반의어 고르기': 'tag-ant',
  '빈칸 어휘 완성': 'tag-blank',
  '다의어 문맥적 의미': 'tag-poly',
  '영영풀이 매칭': 'tag-eng',
  '어형 변환 (서술형)': 'tag-morph',
  '빈칸 문맥 완성': 'tag-ctx',
  '어법 빈칸': 'tag-grammar'
};

let S = { ans: [], cur: 0, ti: null, left: EI.time, start: 0 };

function getHistory() {
  try { return JSON.parse(localStorage.getItem(EI.histKey) || '[]'); }
  catch (e) { return []; }
}

function saveToHistory(r, elapsed) {
  const h = getHistory();
  h.unshift({
    name: document.getElementById('inpName').value.trim(),
    school: document.getElementById('inpSchool').value.trim(),
    grade: document.getElementById('inpGrade').value,
    score: r.score, total: EI.total,
    correct: r.correct, wrong: r.wrong, unanswered: r.unanswered,
    elapsed, date: new Date().toISOString(),
    level: getLevel(r.score).name,
    answers: S.ans.slice()
  });
  if (h.length > 20) h.length = 20;
  localStorage.setItem(EI.histKey, JSON.stringify(h));
}

function updateHCount() {
  const h = getHistory();
  document.getElementById('hCount').textContent = h.length;
}

function toggleHistory() {
  const p = document.getElementById('historyPanel');
  if (p.style.display === 'block') { p.style.display = 'none'; return; }
  const h = getHistory();
  if (!h.length) {
    p.innerHTML = '<p style="text-align:center;color:var(--tl);font-size:13px;padding:20px">\uc544\uc9c1 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>';
    p.style.display = 'block'; return;
  }
  const mk = '\u2460\u2461\u2462\u2463\u2464';
  p.innerHTML = h.map(function (x, idx) {
    return '<div class="history-item" style="flex-wrap:wrap"><div class="hi-left"><div class="hi-name">' + (x.name || '\uc774\ub984\uc5c6\uc74c') + '</div><div class="hi-meta">' + new Date(x.date).toLocaleDateString('ko-KR') + ' \u00b7 ' + x.grade + ' \u00b7 ' + (x.level || '') + '</div></div><div class="hi-right"><div class="hi-score" style="color:' + (x.score >= 80 ? 'var(--p)' : 'var(--r)') + '">' + x.score + '<span style="font-size:11px;color:var(--tl)">/' + x.total + '</span></div></div>' + (x.answers ? '<button onclick="reviewHistory(' + idx + ')" style="width:100%;margin-top:8px;padding:8px;border:1.5px solid var(--pborder);border-radius:8px;background:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--p)">\ud83d\udcdd \uc815\ub2f5\u00b7\ud574\uc124 \ub2e4\uc2dc \ubcf4\uae30</button>' : '') + '</div>';
  }).join('');
  p.style.display = 'block';
}

function getLevel(s) {
  if (s >= 95) return { name: '\ub9c8\uc2a4\ud130', icon: '\ud83d\udc51', range: '95~100', msg: '\uc774 \ub2e8\uc6d0\uc740 \uc815\ubcf5\ud588\uc5b4\uc694!' };
  if (s >= 85) return { name: '\ucc4c\ub9b0\uc800', icon: '\ud83c\udf1f', range: '85~94', msg: '\uac70\uc758 \uc644\ubcbd, \ud55c \ub057 \ucc28\uc774!' };
  if (s >= 75) return { name: '\ud30c\uc774\ud130', icon: '\ud83d\udc8e', range: '75~84', msg: '\ud1b5\uacfc! \uc57d\uc810\ub9cc \uc7a1\uc73c\uba74 \ub9c8\uc2a4\ud130' };
  if (s >= 50) return { name: '\ub8e8\ud0a4', icon: '\ud83d\udd25', range: '50~74', msg: '\uae30\ubcf8\uae30 OK, \uc720\ud615\ubcc4 \ud6c8\ub828 \ud544\uc694' };
  return { name: '\uc2a4\ud0c0\ud130', icon: '\ud83d\udcd6', range: '0~49', msg: '\uc9c0\ubb38 \ud574\uc11d\ubd80\ud130 \ub2e4\uc2dc!' };
}

function getTypeAdvice(t) {
  var m = {
    '(A)(B)(C) \uc870\ud569\ud615': '\ubc18\uc758\uc5b4 \ud568\uc815 \uc8fc\uc758, \uc6d0\ubb38 \ub2e8\uc5b4 \uc815\ud655\ud788 \uc554\uae30',
    '\ubb38\ub9e5\uc0c1 \ubd80\uc801\uc808\ud55c \uc5b4\ud718': '\ubc11\uc904 \ub2e8\uc5b4\uac00 \ubc18\uc758\uc5b4\ub85c \ubc14\ub00c\uc5c8\ub294\uc9c0 \ud655\uc778',
    '\ub3d9\uc758\uc5b4 \uace0\ub974\uae30': '\ub3d9\uc758\uc5b4 \uc30d\uc744 \uc138\ud2b8\ub85c \ubb36\uc5b4 \uc554\uae30',
    '\ubc18\uc758\uc5b4 \uace0\ub974\uae30': '\ubc18\uc758\uc5b4 \uc30d\uc744 \uc138\ud2b8\ub85c \ubb36\uc5b4 \uc554\uae30',
    '\ube48\uce78 \uc5b4\ud718 \uc644\uc131': '\ubb38\ub9e5 \ub2e8\uc11c(clue) \ucc3e\uae30 \uc5f0\uc2b5 \ud544\uc694',
    '\ub2e4\uc758\uc5b4 \ubb38\ub9e5\uc801 \uc758\ubbf8': '\ub2e4\uc758\uc5b4\uc758 \uc5ec\ub7ec \ub73b\uc744 \ubb38\ub9e5\ubcc4\ub85c \uad6c\ubd84',
    '\uc601\uc601\ud480\uc774 \ub9e4\uce6d': '\uc601\uc601\uc0ac\uc804 \uc815\uc758 \uc77d\uae30 \uc5f0\uc2b5',
    '\uc5b4\ud615 \ubcc0\ud658 (\uc11c\uc220\ud615)': '\ud488\uc0ac \ubcc0\ud658 \uaddc\uce59(\uba85\u2194\ud615, \ub3d9\u2194\uba85) \uc815\ub9ac',
    '\ube48\uce78 \ubb38\ub9e5 \uc644\uc131': '\uae00\uc758 \ud750\ub984\uacfc \ub17c\ub9ac\uc801 \uc5f0\uacb0 \ud30c\uc545',
    '\uc5b4\ubc95': '\ud575\uc2ec \uc5b4\ubc95 \uaddc\uce59 \uc815\ub9ac \ubc0f \ubc18\ubcf5 \uc5f0\uc2b5',
    '\ub0b4\uc6a9\uc77c\uce58': '\uc9c0\ubb38\uacfc \uc120\uc9c0\ub97c \uaf3c\uaf3c\ud788 \ub300\uc870',
    '\ub0b4\uc6a9\ubd88\uc77c\uce58': '\ud568\uc815 \uc120\uc9c0\uc758 \ubbf8\uc138\ud55c \ucc28\uc774 \ucc3e\uae30',
    'T/F': '\uc6d0\ubb38\uacfc \uc9c4\uc220\uc744 \uc815\ud655\ud788 \ub300\uc870',
    '\uc11c\uc220\ud615': '\uc815\ud655\ud55c \ucca0\uc790\uc640 \uc5b4\ud615 \ubcc0\ud658 \uc8fc\uc758',
    '\ube48\uce78\ucd94\ub860': '\ube48\uce78 \uc804\ud6c4 \ubb38\ub9e5 \ub2e8\uc11c \ucc3e\uae30',
    '\ube48\uce78 \ucd94\ub860': '\ube48\uce78 \uc804\ud6c4 \ubb38\ub9e5 \ub2e8\uc11c \ucc3e\uae30',
    '\ubb38\uc7a5\uc0bd\uc785': '\uae00\uc758 \ud750\ub984\uacfc \uc5f0\uacb0\uc0ac \ud30c\uc545',
    '\uc5b4\uc21c\ubc30\uc5f4': '\ubb38\uc7a5 \uad6c\uc870(S+V+O) \uc815\ud655\ud788 \ud30c\uc545',
    '\uc5b4\ud718': '\ubb38\ub9e5\uc5d0\uc11c \uc801\uc808\ud55c \uc5b4\ud718 \uace0\ub974\uae30 \uc5f0\uc2b5',
    '\ub0b4\uc6a9\uc774\ud574': '\uc9c0\ubb38 \ud575\uc2ec \ub0b4\uc6a9 \uc815\ud655\ud788 \ud30c\uc545'
  };
  return m[t] || '\ud574\ub2f9 \uc720\ud615 \uc9d1\uc911 \ubcf5\uc2b5 \ud544\uc694';
}

function fmtTime(s) { return Math.floor(s / 60) + '\ubd84 ' + s % 60 + '\ucd08'; }

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 2500);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

/* Section picker (for 부교재 with sec field) */
function toggleAllSec(el) {
  document.querySelectorAll('.sec-cb').forEach(function (cb) { if (cb.value !== 'all') cb.checked = el.checked; });
}

function getSelectedSections() {
  var cbs = document.querySelectorAll('.sec-cb:checked');
  var secs = [];
  cbs.forEach(function (cb) { if (cb.value !== 'all') secs.push(cb.value); });
  return secs;
}

function startExam() {
  var nm = document.getElementById('inpName').value.trim();
  if (!nm) { toast('\uc774\ub984\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694!'); return; }

  /* Section filtering (if sec picker exists) */
  var secPicker = document.getElementById('secPicker');
  var filtered;
  if (secPicker) {
    var secs = getSelectedSections();
    if (secs.length === 0) { toast('\uc2dc\ud5d8 \ubc94\uc704\ub97c \ucd5c\uc18c 1\uac1c \uc120\ud0dd\ud574\uc8fc\uc138\uc694!'); return; }
    filtered = Q.map(function (q, i) { return { q: q, i: i }; }).filter(function (f) { return secs.includes(f.q.sec); });
    S = { ans: Array(filtered.length).fill(null), cur: 0, ti: null, left: EI.time, start: Date.now(), order: shuffle([].concat(Array(filtered.length).keys ? Array.from({ length: filtered.length }, function (_, i) { return i; }) : [])), filtered: filtered.map(function (f) { return f.i; }), secs: secs };
    EI._origTotalQ = EI.totalQ; EI._origTotal = EI.total;
    EI.totalQ = filtered.length;
    EI.total = filtered.reduce(function (s, f) { return s + Q[f.i].pts; }, 0);
  } else {
    S = { ans: Array(Q.length).fill(null), cur: 0, ti: null, left: EI.time, start: Date.now(), order: shuffle(Array.from({ length: Q.length }, function (_, i) { return i; })), filtered: null, secs: null };
  }

  showScreen('examScreen');
  showQ(0);
  startTimer();
  updateProgress();
  initSwipe();
}

function showQ(idx, direction) {
  S.cur = idx;
  var oi = S.order ? S.order[idx] : idx;
  var qi = S.filtered ? S.filtered[oi] : oi;
  var q = Q[qi];
  var tc = typeTag[q.type] || '';
  var mk = '\u2460\u2461\u2462\u2463\u2464';
  var pp = document.getElementById('slidePassage');
  if (direction) {
    pp.classList.add(direction > 0 ? 'fade-out' : 'fade-in');
    setTimeout(function () {
      renderContent(idx, qi, q, tc, mk, pp);
      pp.classList.remove('fade-out', 'fade-in');
    }, 150);
  } else {
    renderContent(idx, qi, q, tc, mk, pp);
  }
}

function renderContent(idx, qi, q, tc, mk, pp) {
  var ph = '<div class="q-badge"><div class="q-num">' + (idx + 1) + '</div><span>' + q.type + '</span><span style="opacity:.6">' + q.diff + ' \u00b7 ' + q.pts + '\uc810</span></div>';
  if (q.passage) ph += '<div class="q-passage">' + q.passage + '</div>';
  else ph += '<div style="padding:30px;text-align:center;color:var(--tl)">\uc774 \ubb38\ud56d\uc740 \uc9c0\ubb38\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</div>';
  pp.innerHTML = ph;
  pp.scrollTop = 0;
  var bt = document.getElementById('slideBottom');
  var bh = '<div class="slide-stem">' + q.stem + '</div><div class="slide-choices">';
  if (q.fmt === 'mc') {
    q.ch.forEach(function (c, ci) {
      var sel = S.ans[qi] === ci ? ' selected' : '';
      bh += '<button class="choice-btn' + sel + '" onclick="selectAns(' + idx + ',' + ci + ')"><span class="c-num">' + mk[ci] + '</span><span>' + c + '</span></button>';
    });
  }
  if (q.fmt === 'written') {
    var val = S.ans[qi] || '';
    bh += '<input class="written-input" value="' + val + '" placeholder="\ub2f5\uc548\uc744 \uc785\ub825\ud558\uc138\uc694..." oninput="writeAns(' + idx + ',this.value)">';
  }
  bh += '</div><div class="slide-nav"><button ' + (idx === 0 ? 'disabled ' : '') + ' onclick="navQ(-1)">\u2190 \uc774\uc804</button><span class="nav-cur">' + (idx + 1) + ' / ' + EI.totalQ + '</span><button class="sn-next" ' + (idx === EI.totalQ - 1 ? 'disabled ' : '') + ' onclick="navQ(1)">\ub2e4\uc74c \u2192</button></div>';
  bt.innerHTML = bh;
}

function selectAns(idx, ci) {
  var qi = S.order ? S.order[idx] : idx;
  if (S.filtered) qi = S.filtered[qi];
  S.ans[qi] = ci;
  var btns = document.querySelectorAll('.slide-choices .choice-btn');
  btns.forEach(function (b, i) {
    b.classList.toggle('selected', i === ci);
    if (i === ci) b.classList.add('just-selected');
  });
  updateProgress();
}

function writeAns(idx, val) {
  var qi = S.order ? S.order[idx] : idx;
  if (S.filtered) qi = S.filtered[qi];
  S.ans[qi] = val.trim() || null;
  updateProgress();
}

function navQ(dir) {
  var next = S.cur + dir;
  if (next >= 0 && next < EI.totalQ) showQ(next, dir);
}

function updateProgress() {
  var answered = S.ans.filter(function (a) { return a !== null; }).length;
  document.getElementById('progressFill').style.width = (answered / EI.totalQ * 100) + '%';
  document.getElementById('ansCount').textContent = answered + '/' + EI.totalQ;
}

function initSwipe() {
  var startX = 0, startY = 0;
  var el = document.getElementById('slideWrap');
  el.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && S.cur < EI.totalQ - 1) navQ(1);
      if (dx > 0 && S.cur > 0) navQ(-1);
    }
  }, { passive: true });
}

/* Compatibility stubs */
function renderSlide(i) { showQ(i); }
function slideSel() {}
function slideWrite() {}
function renderQ() {}
function renderDots() {}
function upDots() {}
function scrollToQ(i) { if (i >= 0 && i < EI.totalQ) showQ(i); }
function openCard() {}
function closeCard() {}
function gcSel() {}
function gcWrite() {}
function gcNav() {}
function sel() {}
function sw() {}

function startTimer() {
  var el = document.getElementById('timer');
  S.ti = setInterval(function () {
    S.left--;
    var m = Math.floor(S.left / 60), s = S.left % 60;
    el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    el.classList.toggle('warn', S.left <= 300 && S.left > 60);
    el.classList.toggle('danger', S.left <= 60);
    if (S.left <= 0) { clearInterval(S.ti); doSubmit(); }
  }, 1000);
}

function submitExam() {
  // 미응답 문항 찾기
  var unanswered = [];
  var total = S.filtered ? S.filtered.length : Q.length;
  for (var i = 0; i < total; i++) {
    if (S.ans[i] === null) unanswered.push(i);
  }

  // 커스텀 모달 생성
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)';

  var title = unanswered.length > 0
    ? '<div style="font-size:18px;font-weight:900;margin-bottom:8px;color:#191F28">미응답 ' + unanswered.length + '문항</div><div style="font-size:13px;color:#6B7684;margin-bottom:16px">풀지 않은 문항이 있습니다. 제출하시겠습니까?</div>'
    : '<div style="font-size:18px;font-weight:900;margin-bottom:8px;color:#191F28">제출하시겠습니까?</div><div style="font-size:13px;color:#6B7684;margin-bottom:16px">전 문항 응답 완료</div>';

  var btnsHtml = '';

  // 미응답 문항 번호 버튼
  if (unanswered.length > 0) {
    btnsHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">';
    unanswered.forEach(function (idx) {
      btnsHtml += '<button onclick="document.body.removeChild(this.closest(\'div[style*=fixed]\'));showQ(' + idx + ')" style="padding:6px 12px;border-radius:8px;border:2px solid #7C3AED;background:#F3EEFF;color:#7C3AED;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">Q' + (idx + 1) + '</button>';
    });
    btnsHtml += '</div>';
  }

  // 제출/취소 버튼
  btnsHtml += '<div style="display:flex;gap:8px">';
  btnsHtml += '<button onclick="document.body.removeChild(this.closest(\'div[style*=fixed]\'))" style="flex:1;padding:12px;border-radius:10px;border:2px solid #E5E8EB;background:#fff;color:#4E5968;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">취소</button>';
  btnsHtml += '<button onclick="document.body.removeChild(this.closest(\'div[style*=fixed]\'));doSubmit()" style="flex:1;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#5B21B6,#7C3AED);color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">제출</button>';
  btnsHtml += '</div>';

  modal.innerHTML = title + btnsHtml;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function doSubmit() {
  clearInterval(S.ti);
  var elapsed = Math.floor((Date.now() - S.start) / 1000);
  var r = grade();
  saveToHistory(r, elapsed);
  renderResults(r, elapsed);
  showScreen('resultScreen');
  window.scrollTo(0, 0);
}

function grade() {
  var score = 0, correct = 0, wrong = 0, unanswered = 0;
  var details = [];
  var qs = S.filtered ? S.filtered.map(function (i) { return Q[i]; }) : Q;
  qs.forEach(function (q, i) {
    var a = S.ans[i];
    var ok = false;
    if (a === null) unanswered++;
    else if (q.fmt === 'mc') ok = a === q.ans;
    else {
      var u = String(a).trim().toLowerCase();
      if (q.accept) ok = q.accept.some(function (x) { return u === x.toLowerCase(); });
      if (!ok && q.wa) ok = u === q.wa.toLowerCase();
    }
    if (a !== null) { if (ok) { correct++; score += q.pts; } else wrong++; }
    details.push({ q: q, ans: a, ok: ok });
  });
  return { score: score, correct: correct, wrong: wrong, unanswered: unanswered, details: details };
}

function renderResults(r, elapsed) {
  var pass = r.score >= 80;
  var nm = document.getElementById('inpName').value.trim();
  var sc = document.getElementById('inpSchool').value.trim();
  var gr = document.getElementById('inpGrade').value;
  var lv = getLevel(r.score);
  var pct = Math.round(r.score / EI.total * 100);
  var typeMap = {};
  r.details.forEach(function (d) {
    var t = d.q.type;
    if (!typeMap[t]) typeMap[t] = { total: 0, ok: 0 };
    typeMap[t].total++;
    if (d.ok) typeMap[t].ok++;
  });

  var h = '';
  h += '<div class="r-hero ' + (pass ? 'pass' : 'fail') + '"><div class="r-badge ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '\ud83c\udf89 \ud1b5\uacfc!' : '\ud83d\udcda \ubbf8\ud1b5\uacfc') + '</div><div class="r-score">' + r.score + '<sup>/' + EI.total + '</sup></div><div class="r-stats"><span class="stat-item">\u2705 \uc815\ub2f5 <strong>' + r.correct + '</strong></span><span class="stat-item">\u274c \uc624\ub2f5 <strong>' + r.wrong + '</strong></span><span class="stat-item">\u2b1c \ubbf8\uc751\ub2f5 <strong>' + r.unanswered + '</strong></span><span class="stat-item">\u23f1\ufe0f <strong>' + fmtTime(elapsed) + '</strong></span></div></div><div class="rc">';

  h += '<div class="rs"><div class="rs-title">\ud83d\udccb \uae30\ubcf8 \uc815\ubcf4</div><div class="info-grid"><div class="info-cell"><div class="ic-label">\uc774\ub984</div><div class="ic-value">' + nm + '</div></div><div class="info-cell"><div class="ic-label">\ud559\uad50 / \ud559\ub144</div><div class="ic-value">' + (sc || '\ubbf8\uc785\ub825') + ' \u00b7 ' + gr + '</div></div><div class="info-cell"><div class="ic-label">\uc2dc\ud5d8 \ubc94\uc704</div><div class="ic-value">' + EI.subject + ' \u00b7 ' + EI.pub + '</div></div><div class="info-cell"><div class="ic-label">\uc751\uc2dc\uc77c</div><div class="ic-value">' + new Date().toLocaleDateString('ko-KR') + '</div></div><div class="info-cell highlight"><div class="ic-label">\uc810\uc218</div><div class="ic-value">' + r.score + '\uc810 / ' + EI.total + '\uc810 (' + pct + '%)</div></div><div class="info-cell highlight"><div class="ic-label">\uc18c\uc694\uc2dc\uac04 / \ud1b5\uacfc</div><div class="ic-value">' + fmtTime(elapsed) + ' / <span style="color:' + (pass ? 'var(--p)' : 'var(--r)') + '">' + (pass ? '\ud1b5\uacfc \u2705' : '\ubbf8\ud1b5\uacfc \u274c') + '</span></div></div></div></div>';

  h += '<div class="rs"><div class="rs-title">\ud83c\udfc5 \ub808\ubca8</div><div class="level-card"><div class="level-icon">' + lv.icon + '</div><div class="level-name">' + lv.name + '</div><div class="level-range">' + lv.range + '\uc810 \uad6c\uac04</div><div class="level-bar"><div class="level-bar-fill" style="width:' + pct + '%"></div></div><div class="level-msg">' + lv.msg + '</div></div></div>';

  h += '<div class="rs"><div class="rs-title">\ud83d\udd0d \ub0b4\uc2e0\ud56b \uc57d\uc810 \uc9c4\ub2e8</div>';
  Object.entries(typeMap).forEach(function (entry) {
    var type = entry[0], d = entry[1];
    var p = Math.round(d.ok / d.total * 100);
    var c = p === 100 ? 'var(--p)' : p >= 50 ? 'var(--o)' : 'var(--r)';
    var icon = p === 100 ? '\u2705' : p >= 50 ? '\u26a0\ufe0f' : '\u274c';
    h += '<div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:13px">' + icon + '</span><span style="font-size:13px;font-weight:700;flex:1">' + type.replace(/\(.+?\)/g, '').trim() + '</span><span style="font-size:13px;font-weight:800;color:' + c + '">' + d.ok + '/' + d.total + '</span></div><div class="type-track"><div class="type-fill" style="width:' + p + '%;background:' + c + '"></div></div>' + (p < 100 ? '<div style="font-size:11px;color:var(--tm);margin-top:3px;padding-left:21px">\u2192 ' + getTypeAdvice(type) + '</div>' : '') + '</div>';
  });
  h += '</div>';

  h += '<div class="rs"><div class="rs-title">\ud83d\udcdd \ub0b4\uc2e0\ud56b \ucc98\ubc29</div><div class="plan-card">';
  if (pct >= 95) h += '<div class="plan-icon">\ud83d\udc51</div><div class="plan-text"><h4>\ub9c8\uc2a4\ud130 \ub2ec\uc131!</h4><p>\uc774 \ub2e8\uc6d0\uc740 \uc644\ubcbd\ud569\ub2c8\ub2e4. \ub2e4\uc74c \ub2e8\uc6d0\uc5d0 \ub3c4\uc804\ud558\uc138\uc694!</p></div>';
  else if (pct >= 80) h += '<div class="plan-icon">\ud83c\udf1f</div><div class="plan-text"><h4>\ud1b5\uacfc! \ub9c8\uc2a4\ud130\uae4c\uc9c0 \ud55c \ub057</h4><p>\uc544\ub798 \uc57d\uc810 \uc720\ud615\ub9cc \uc9d1\uc911\ud558\uba74 \ub9c8\uc2a4\ud130 \ub2ec\uc131!</p></div>';
  else if (pct >= 50) h += '<div class="plan-icon">\ud83d\udd25</div><div class="plan-text"><h4>\uae30\ubcf8\uae30\ub294 \uc788\uc5b4\uc694!</h4><p>\uc624\ub2f5 \ud574\uc124\uc744 \uaf3c\uaf3c\ud788 \ud655\uc778\ud558\uace0, \uc57d\uc810 \uc720\ud615\ubd80\ud130 \uacf5\ub7b5\ud558\uc138\uc694.</p></div>';
  else h += '<div class="plan-icon">\ud83d\udcd6</div><div class="plan-text"><h4>\uc9c0\ubb38 \ud574\uc11d\ubd80\ud130!</h4><p>\ubcf8\ubb38\uc744 \uc644\ubcbd\ud788 \uc774\ud574\ud55c \ub4a4 \uc7ac\ub3c4\uc804\ud558\uc138\uc694. \ud574\uc124\uc758 \ud55c\uae00 \ud574\uc11d\uc744 \ud65c\uc6a9!</p></div>';
  h += '</div></div>';

  h += '<div class="rs"><div class="rs-title">\ud83d\ude80 \uc561\uc158</div><div class="action-grid" style="grid-template-columns:1fr 1fr"><button class="act-btn" onclick="shareImage()"><span class="act-icon">\ud83d\udcf8</span><span class="act-label">\uc774\ubbf8\uc9c0 \uacf5\uc720</span></button><button class="act-btn" onclick="copyResult()"><span class="act-icon">\ud83d\udccb</span><span class="act-label">\ud14d\uc2a4\ud2b8 \ubcf5\uc0ac</span></button><button class="act-btn" onclick="retake()"><span class="act-icon">\ud83d\udd04</span><span class="act-label">\uc7ac\uc2dc\ud5d8</span></button><button class="act-btn primary" onclick="goHome()"><span class="act-icon">\ud83c\udfe0</span><span class="act-label">\ud648\uc73c\ub85c</span></button></div></div>';

  h += '<div class="rs"><div class="rs-title">\ud83d\udcdd \uc815\ub2f5\uacfc \ud574\uc124 <span style="font-size:12px;color:var(--tl);margin-left:8px">\ud074\ub9ad\ud558\uc5ec \ud3bc\uce58\uae30</span></div>';
  var mk = '\u2460\u2461\u2462\u2463\u2464';
  r.details.forEach(function (d, i) {
    var icon = d.ok ? '\u2705' : (d.ans === null ? '\u2b1c' : '\u274c');
    var ua = d.q.fmt === 'mc' ? (d.ans !== null ? mk[d.ans] : '\ubbf8\uc751\ub2f5') : (d.ans || '\ubbf8\uc751\ub2f5');
    var ca = d.q.fmt === 'mc' ? mk[d.q.ans] : (d.q.wa || '');
    var open = !d.ok;
    var chHtml = '';
    if (d.q.fmt === 'mc' && d.q.ch) {
      chHtml = '<div style="margin-top:8px">';
      d.q.ch.forEach(function (c, ci) {
        var isAns = ci === d.q.ans;
        var isMy = d.ans === ci;
        var color = isAns ? 'var(--p)' : (isMy && !d.ok ? 'var(--r)' : 'var(--tm)');
        var bg = isAns ? 'var(--pl)' : (isMy && !d.ok ? 'var(--rl)' : 'transparent');
        var label = isAns ? ' \u2705' : (isMy && !d.ok ? ' \u274c' : '');
        chHtml += '<div style="padding:4px 8px;margin-bottom:2px;border-radius:6px;font-size:12px;color:' + color + ';background:' + bg + '"><b>' + mk[ci] + '</b> ' + c + label + '</div>';
      });
      chHtml += '</div>';
    }
    h += '<div class="rev-card"><div class="rev-header" onclick="this.nextElementSibling.classList.toggle(\'open\');this.querySelector(\'.rev-icon\').style.transform=this.nextElementSibling.classList.contains(\'open\')?\'rotate(180deg)\':\'\'"><span style="font-weight:800">' + icon + ' ' + d.q.id + '\ubc88</span><span style="font-size:12px;color:var(--tm)">[' + d.q.type.slice(0, 8) + '] ' + d.q.diff + ' ' + d.q.pts + '\uc810</span><span class="rev-icon">\u25bc</span></div><div class="rev-body' + (open ? ' open' : '') + '"><div style="display:flex;gap:10px;margin-bottom:10px"><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;' + (d.ok ? 'background:var(--pl);color:var(--p)' : 'background:var(--rl);color:var(--r)') + '"><div style="font-size:10px;opacity:.7">\ub0b4 \ub2f5</div>' + ua + '</div><div style="flex:1;padding:8px;border-radius:var(--rxs);text-align:center;font-weight:700;background:var(--pl);color:var(--p)"><div style="font-size:10px;opacity:.7">\uc815\ub2f5</div>' + ca + '</div></div><div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\ud83d\udcdd \ubb38\uc81c</div><div class="expl-box" style="font-size:12.5px;line-height:1.6;border-left:3px solid var(--b);margin-bottom:10px"><div style="font-weight:700;margin-bottom:6px">' + d.q.stem + '</div>' + chHtml + '</div>' + (d.q.passage ? '<div style="font-size:11px;font-weight:800;color:var(--tm);margin-bottom:4px">\ud83d\udcd6 \uc6d0\ubb38</div><div class="expl-box" style="font-size:12px;line-height:1.75;border-left:3px solid #ddd;margin-bottom:10px">' + d.q.passage + '</div>' : '') + (d.q.det ? '<div class="expl-tag ans">\ud83c\uddf0\ud83c\uddf7 \ud574\uc11d</div><div class="expl-box ans-b">' + (d.q.det.korean || '') + '</div><div class="expl-tag tip">\ud83d\udccb \ud480\uc774 \u00b7 \uc120\uc9c0 \ubd84\uc11d</div><div class="expl-box" style="white-space:pre-line">' + ((d.q.det.analysis || '').replace(/\\n/g, '<br>')) + '</div><div class="expl-tag tip">\ud83d\udca1 \ud3ec\uc778\ud2b8</div><div class="expl-box tip-b">' + (d.q.det.tip || '') + '</div>' : '') + '</div></div>';
  });
  h += '</div></div>';
  document.getElementById('resultScreen').innerHTML = h;
}

function getWeakTypes() {
  var r = grade();
  var tm = {};
  r.details.forEach(function (d) {
    var t = d.q.type;
    if (!tm[t]) tm[t] = { total: 0, ok: 0 };
    tm[t].total++;
    if (d.ok) tm[t].ok++;
  });
  return Object.entries(tm).filter(function (e) { return e[1].ok < e[1].total; }).map(function (e) { return e[0]; });
}

function getTestName() {
  var t = document.title;
  if (t.includes('\ub2e8\uc5b4')) return '\ub2e8\uc5b4\ud14c\uc2a4\ud2b8';
  if (t.includes('\uc6cc\ud06c\ubd81')) return '\uc6cc\ud06c\ubd81\ud14c\uc2a4\ud2b8';
  if (t.includes('\ud034\uc988')) return '\ud034\uc988(\uc608\uc0c1\ubb38\uc81c)\ud14c\uc2a4\ud2b8';
  return 'TEST';
}

function copyResult() {
  var r = grade(), lv = getLevel(r.score), pct = Math.round(r.score / EI.total * 100);
  var nm = document.getElementById('inpName').value.trim();
  var sc = document.getElementById('inpSchool').value.trim();
  var gr = document.getElementById('inpGrade').value;
  var elapsed = Math.floor((Date.now() - S.start) / 1000);
  var pass = r.score >= 80, tn = getTestName(), wk = getWeakTypes();
  var tm = {};
  r.details.forEach(function (d) {
    var t = d.q.type;
    if (!tm[t]) tm[t] = { total: 0, ok: 0 };
    tm[t].total++;
    if (d.ok) tm[t].ok++;
  });
  var secLabel = S.secs ? S.secs.join(', ') : '\uc804\uccb4';
  var txt = '\ud83d\udcdd \ub0b4\uc2e0\ud56b ' + tn + ' \uacb0\uacfc\n' + EI.subject + ' \u00b7 ' + EI.pub + ' [' + secLabel + ']\n' + nm + (sc ? ' \u00b7 ' + sc : '') + ' \u00b7 ' + gr + '\n' + new Date().toLocaleDateString('ko-KR') + '\n\n' + lv.icon + ' ' + lv.name + ' \u00b7 ' + r.score + '/' + EI.total + '\uc810 (' + pct + '%)\n' + (pass ? '\ud83c\udf89 \ud1b5\uacfc!' : '\ud83d\udcda \ubbf8\ud1b5\uacfc') + ' \u00b7 \u2705' + r.correct + ' \u274c' + r.wrong + ' \u2b1c' + r.unanswered + '\n\u23f1\ufe0f ' + fmtTime(elapsed);
  if (wk.length) {
    txt += '\n\n\ud83d\udd0d \ub0b4\uc2e0\ud56b \uc57d\uc810 \uc9c4\ub2e8';
    wk.forEach(function (w) { var d = tm[w]; txt += '\n\u2022 ' + w.replace(/\(.+?\)/g, '').trim() + ' ' + d.ok + '/' + d.total + ' \u2192 ' + getTypeAdvice(w); });
  }
  txt += '\n\n\ud83d\udcca \ub0b4\uc2e0\ud56b | \ub0b4\uc2e0 \uc601\uc5b4 \uc644\ubcbd \ub300\ube44';
  navigator.clipboard.writeText(txt).then(function () { toast('\ud83d\udccb \uacb0\uacfc\uac00 \ubcf5\uc0ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4!'); }).catch(function () { toast('\ubcf5\uc0ac \uc2e4\ud328'); });
}

function shareImage() {
  var tn = getTestName(), wk = getWeakTypes(), r = grade(), lv = getLevel(r.score);
  var pct = Math.round(r.score / EI.total * 100), pass = r.score >= 80;
  var nm = document.getElementById('inpName').value.trim();
  var tm = {};
  r.details.forEach(function (d) {
    var t = d.q.type;
    if (!tm[t]) tm[t] = { total: 0, ok: 0 };
    tm[t].total++;
    if (d.ok) tm[t].ok++;
  });
  var pc = pass ? '#16A34A' : '#D63B3B';
  var card = '<div style="width:400px;font-family:-apple-system,sans-serif;background:#fff;border-radius:16px;overflow:hidden">';
  card += '<div style="background:linear-gradient(135deg,' + (pass ? '#E8F5E9,#C8E6C9' : '#FFF0F0,#FFEAEA') + ');padding:28px 24px;text-align:center"><div style="font-size:12px;font-weight:800;color:' + pc + ';margin-bottom:4px">\ub0b4\uc2e0\ud56b ' + tn + '</div><div style="font-size:13px;color:#666;margin-bottom:16px">' + EI.subject + ' \u00b7 ' + EI.pub + '</div><div style="font-size:56px;font-weight:900;color:#1A1A2E">' + r.score + '<span style="font-size:20px;color:#aaa">/' + EI.total + '</span></div><div style="margin-top:8px"><span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:800;background:' + pc + ';color:#fff">' + lv.icon + ' ' + lv.name + ' \u00b7 ' + (pass ? '\ud1b5\uacfc' : '\ubbf8\ud1b5\uacfc') + '</span></div><div style="margin-top:12px;font-size:12px;color:#888">\ud83d\udc64 ' + nm + ' \u00b7 \u2705' + r.correct + ' \u274c' + r.wrong + ' \u2b1c' + r.unanswered + '</div></div>';
  if (wk.length) {
    card += '<div style="padding:16px 20px;border-top:1px solid #eee"><div style="font-size:13px;font-weight:800;margin-bottom:10px">\ud83d\udd0d \ub0b4\uc2e0\ud56b \uc57d\uc810 \uc9c4\ub2e8</div>';
    Object.entries(tm).forEach(function (entry) {
      var type = entry[0], d = entry[1];
      var p = Math.round(d.ok / d.total * 100);
      var c = p === 100 ? '#16A34A' : p >= 50 ? '#F59E0B' : '#D63B3B';
      card += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="font-weight:600">' + type.replace(/\(.+?\)/g, '').trim() + '</span><span style="font-weight:800;color:' + c + '">' + d.ok + '/' + d.total + '</span></div><div style="height:6px;background:#eee;border-radius:3px"><div style="height:100%;width:' + p + '%;background:' + c + ';border-radius:3px"></div></div></div>';
    });
    card += '</div>';
  }
  card += '<div style="padding:12px 20px;background:#f8f8f8;text-align:center;font-size:11px;color:#999">\ud83d\udcca <b style="color:#333">\ub0b4\uc2e0\ud56b</b> | \ub0b4\uc2e0 \uc601\uc5b4 \uc644\ubcbd \ub300\ube44</div></div>';
  var wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;';
  wrap.innerHTML = card;
  document.body.appendChild(wrap);
  html2canvas(wrap.firstChild, { scale: 2, backgroundColor: null, useCORS: true }).then(function (canvas) {
    document.body.removeChild(wrap);
    canvas.toBlob(function (blob) {
      if (navigator.share && blob) {
        var file = new File([blob], '\ub0b4\uc2e0\ud56b_' + tn + '_\uacb0\uacfc.png', { type: 'image/png' });
        navigator.share({ files: [file], title: '\ub0b4\uc2e0\ud56b ' + tn + ' \uacb0\uacfc' }).catch(function () {});
      } else {
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = '\ub0b4\uc2e0\ud56b_' + tn + '_\uacb0\uacfc.png';
        a.click();
      }
      toast('\ud83d\udcf8 \uacb0\uacfc \uc774\ubbf8\uc9c0\uac00 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4!');
    });
  }).catch(function () { toast('\uc774\ubbf8\uc9c0 \uc0dd\uc131 \uc2e4\ud328'); });
}

function reviewHistory(idx) {
  var h = getHistory();
  var rec = h[idx];
  if (!rec || !rec.answers) return toast('\uc774\uc804 \ubc84\uc804 \uae30\ub85d\uc740 \ud574\uc124\uc744 \ubcfc \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.');
  S.ans = rec.answers;
  S.start = Date.now() - rec.elapsed * 1000;
  document.getElementById('inpName').value = rec.name || '';
  document.getElementById('inpSchool').value = rec.school || '';
  document.getElementById('inpGrade').value = rec.grade || '\uace01';
  var r = grade();
  renderResults(r, rec.elapsed);
  showScreen('resultScreen');
  window.scrollTo(0, 0);
}

function retake() { location.reload(); }
function goHome() { showScreen('startScreen'); updateHCount(); }
function showHomeModal() {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  var modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:300px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
  modal.innerHTML = '<div style="font-size:18px;font-weight:900;margin-bottom:8px;color:#191F28">처음으로 돌아가시겠습니까?</div><div style="font-size:13px;color:#6B7684;margin-bottom:16px">진행 중인 시험이 초기화됩니다.</div><div style="display:flex;gap:8px"><button onclick="document.body.removeChild(this.closest(\'div[style*=fixed]\'))" style="flex:1;padding:12px;border-radius:10px;border:2px solid #E5E8EB;background:#fff;color:#4E5968;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">취소</button><button onclick="document.body.removeChild(this.closest(\'div[style*=fixed]\'));goHome()" style="flex:1;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#5B21B6,#7C3AED);color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit">처음으로</button></div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

window.addEventListener('beforeunload', function (e) {
  if (S.ti) { e.preventDefault(); e.returnValue = ''; }
});
