#!/usr/bin/env node
/**
 * 내신해방공식 테스트 런타임 검증 v2
 * Node.js에서 브라우저 API를 mock하여 JS 실행 + 채점 로직 테스트
 */

const fs = require('fs');
const path = require('path');

const REPO = '/Users/woobumpark/Desktop/naesinfit-tests';
const TARGET = path.join(REPO, '교과서');
const N = s => s.normalize('NFC');

let totalFiles = 0, passCount = 0, failCount = 0;
const failures = [];

function createMockDOM() {
  const elements = {};
  const mockEl = (id) => ({
    value: '', innerHTML: '', textContent: '', innerText: '',
    style: new Proxy({}, { set: () => true, get: () => '' }),
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    querySelector: () => mockEl(),
    querySelectorAll: () => [],
    scrollIntoView(){},
    addEventListener(){},
    removeEventListener(){},
    appendChild(){},
    removeChild(){},
    insertBefore(){},
    getAttribute: () => null,
    setAttribute(){},
    dataset: {},
    offsetHeight: 100,
    children: [],
    parentNode: null,
    id: id || '',
    className: '',
    onclick: null,
  });

  return {
    getElementById: (id) => {
      if (!elements[id]) elements[id] = mockEl(id);
      return elements[id];
    },
    querySelector: () => mockEl(),
    querySelectorAll: () => [],
    createElement: () => mockEl(),
    body: mockEl('body'),
    documentElement: mockEl('html'),
    addEventListener(){},
    _elements: elements,
  };
}

function testFile(filePath, shortPath) {
  totalFiles++;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract all script blocks
    const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (!scripts) {
      failures.push({ file: shortPath, error: 'script 태그 없음' });
      failCount++;
      return;
    }

    const mainScript = scripts.find(s => /const\s+Q\s*=/.test(s));
    if (!mainScript) {
      failures.push({ file: shortPath, error: 'Q 배열이 포함된 script 없음' });
      failCount++;
      return;
    }

    const code = mainScript.replace(/<\/?script[^>]*>/g, '');

    const mockDoc = createMockDOM();
    const timers = [];

    try {
      const fn = new Function(
        'document', 'window', 'localStorage', 'sessionStorage',
        'setTimeout', 'setInterval', 'clearInterval', 'clearTimeout',
        'navigator', 'location', 'history', 'alert', 'confirm', 'prompt',
        'requestAnimationFrame', 'cancelAnimationFrame',
        'HTMLElement', 'getComputedStyle', 'matchMedia', 'fetch',
        'Image', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
        code + `
        ;
        // Test 1: Q array exists and is valid
        if (!Q || !Array.isArray(Q) || Q.length === 0) throw new Error('Q 배열이 비어있거나 없음');

        // Test 2: All questions have required fields
        for (let i = 0; i < Q.length; i++) {
          const q = Q[i];
          if (!q.id) throw new Error('Q['+i+'] id 누락');
          if (!q.stem && !q.passage) throw new Error('Q['+i+'] stem/passage 없음');
          if (q.fmt === 'mc') {
            if (!Array.isArray(q.ch) || q.ch.length < 2) throw new Error('Q['+i+'] 선택지 부족');
            if (q.ans === undefined || q.ans === null) throw new Error('Q['+i+'] 정답 없음');
            if (q.ans < 0 || q.ans >= q.ch.length) throw new Error('Q['+i+'] 정답 인덱스 범위 초과: ans='+q.ans+', ch.length='+q.ch.length);
          }
          if (q.fmt === 'written') {
            if (!q.wa && (!q.accept || q.accept.length === 0)) throw new Error('Q['+i+'] 서술형 정답 없음');
          }
        }

        // Test 3: Essential functions exist
        if (typeof startExam !== 'function') throw new Error('startExam 함수 없음');
        if (typeof renderQ !== 'function') throw new Error('renderQ 함수 없음');

        // Test 4: Total points
        const totalPts = Q.reduce((s,q) => s + (q.pts||0), 0);
        if (totalPts !== 100) throw new Error('총 배점 '+totalPts+'점 (100점 아님)');

        return { qCount: Q.length, totalPts, fns: { startExam: typeof startExam, renderQ: typeof renderQ, submit: typeof submit, sel: typeof sel } };
        `
      );

      const mockWindow = {
        addEventListener(){}, removeEventListener(){},
        scrollTo(){}, scrollBy(){}, scroll(){},
        innerHeight: 800, innerWidth: 400,
        devicePixelRatio: 1,
        navigator: { userAgent: 'test' },
        location: { href: 'http://localhost/', search: '', hash: '' },
        history: { pushState(){}, replaceState(){} },
        getComputedStyle: () => new Proxy({}, { get: () => '0' }),
        matchMedia: () => ({ matches: false, addEventListener(){} }),
        localStorage: { getItem: () => null, setItem(){}, removeItem(){}, clear(){} },
        sessionStorage: { getItem: () => null, setItem(){}, removeItem(){}, clear(){} },
        requestAnimationFrame: (cb) => setTimeout(cb, 16),
        cancelAnimationFrame(){},
      };

      const result = fn(
        mockDoc, mockWindow, mockWindow.localStorage, mockWindow.sessionStorage,
        (cb) => timers.push(cb), () => 1, () => {}, () => {},
        { userAgent: 'test' }, mockWindow.location, mockWindow.history,
        () => {}, () => true, () => '',
        (cb) => setTimeout(cb, 16), () => {},
        function(){}, mockWindow.getComputedStyle, mockWindow.matchMedia,
        () => Promise.resolve({ json: () => ({}) }),
        function(){ this.src=''; }, function(){}, function(){}, function(){}
      );

      passCount++;

    } catch (e) {
      failures.push({ file: shortPath, error: e.message });
      failCount++;
    }

  } catch (e) {
    failures.push({ file: shortPath, error: `파일 읽기 오류: ${e.message}` });
    failCount++;
  }
}

// Main
console.log('🧪 런타임 테스트 v2 시작...\n');

const subjects = fs.readdirSync(TARGET).filter(f =>
  fs.statSync(path.join(TARGET, f)).isDirectory()
);

for (const subject of subjects.map(N)) {
  const subjectPath = path.join(TARGET, subject);
  const publishers = fs.readdirSync(subjectPath).filter(f =>
    fs.statSync(path.join(subjectPath, f)).isDirectory()
  );

  for (const pub of publishers.map(N)) {
    const pubPath = path.join(subjectPath, pub);
    const lessons = fs.readdirSync(pubPath).filter(f =>
      fs.statSync(path.join(pubPath, f)).isDirectory()
    );

    for (const lesson of lessons.map(N)) {
      const lessonPath = path.join(pubPath, lesson);
      const relPath = `${subject}/${pub}/${lesson}`;

      for (const tf of ['단어테스트.html', '워크북테스트.html', '퀴즈테스트.html']) {
        const testPath = path.join(lessonPath, tf);
        if (!fs.existsSync(testPath)) continue;

        const shortPath = `${relPath}/${tf}`;
        testFile(testPath, shortPath);
      }
    }
  }
}

// Report
console.log('='.repeat(80));
console.log('🧪 런타임 테스트 결과');
console.log('='.repeat(80));
console.log(`총 파일: ${totalFiles}개`);
console.log(`✅ 통과: ${passCount}개`);
console.log(`❌ 실패: ${failCount}개`);

if (failures.length > 0) {
  // Group by error type
  const cats = {};
  failures.forEach(f => {
    const key = f.error.replace(/Q\[\d+\]/g, 'Q[N]').replace(/\d+점/g, 'N점').replace(/ans=\d+/g,'ans=N').replace(/ch\.length=\d+/g,'ch.length=N');
    if (!cats[key]) cats[key] = [];
    cats[key].push(f.file);
  });

  console.log('\n─── 실패 유형별 분류 ───');
  Object.entries(cats).sort((a,b) => b[1].length - a[1].length).forEach(([err, files]) => {
    console.log(`\n  [${err}] (${files.length}건)`);
    files.slice(0, 5).forEach(f => console.log(`    ${f}`));
    if (files.length > 5) console.log(`    ... 외 ${files.length - 5}건`);
  });
}

process.exit(failCount > 0 ? 1 : 0);
