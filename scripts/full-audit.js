#!/usr/bin/env node
/**
 * full-audit.js — 전체 시스템 완전 점검
 * 실행: node scripts/full-audit.js
 *
 * 점검 항목:
 * 1. test-deploy.ts 등록 × 실제 파일 존재 여부 (교과서/부교재/모의고사)
 * 2. 공유 코드 sync 상태 (naesinfit-shared vs 앱)
 * 3. 활성 학생 wd.selections → 테스트 파일 존재 여부
 * 4. 학생 subKeys 포맷 검증
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SHARED_DEPLOY = path.join(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'test-deploy.ts');
const APP_DEPLOY    = path.join(ROOT, '..', '내신핏v21', 'app', 'src', 'shared', 'constants', 'test-deploy.ts');

// .env 로드 (dotenv 없이 직접)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  });
}

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_KEY || '';

const OK  = '✅';
const ERR = '❌';
const WARN = '⚠️ ';

let totalErrors = 0;
let totalWarns  = 0;
const report = [];
let localOnlyMode = false;  // --local-only 시 파일누락은 warn으로 처리

function log(msg) { process.stdout.write(msg + '\n'); }
function err(msg) { totalErrors++; report.push(`${ERR} ${msg}`); log(`  ${ERR} ${msg}`); }
function warn(msg){ totalWarns++;  report.push(`${WARN}${msg}`); log(`  ${WARN}${msg}`); }
function ok(msg)  { log(`  ${OK} ${msg}`); }
// --local-only 모드에서 파일 누락은 warn(미제작 콘텐츠)으로만 처리
function fileMissing(msg) { if (localOnlyMode) warn(msg); else err(msg); }

// ── HTTP fetch ──
function sbFetch(path) {
  return new Promise((resolve, reject) => {
    const url = `${SB_URL}${path}`;
    const req = https.get(url, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('parse error: ' + data.slice(0,100))); }
      });
    });
    req.on('error', reject);
  });
}

// ── test-deploy.ts 파싱 ──
function parseTestDeploy(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');

  // TEST_APP_DEPLOY
  const tbMatch = src.match(/TEST_APP_DEPLOY[^=]*=\s*(\{[\s\S]*?\});\s*\n/);
  // TEST_APP_SUPPLEMENT_DEPLOY
  const supMatch = src.match(/TEST_APP_SUPPLEMENT_DEPLOY[^=]*=\s*(\{[\s\S]*?\});\s*\n/);
  // TEST_APP_MOCK_DEPLOY
  const mockMatch = src.match(/TEST_APP_MOCK_DEPLOY[^=]*=\s*(\{[\s\S]*?\});\s*$/m);

  function parseObj(str) {
    try {
      // TypeScript → JS 변환: 타입 어노테이션 제거
      const js = str
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
      return (new Function('return ' + js))();
    } catch(e) {
      return {};
    }
  }

  return {
    textbook:   tbMatch   ? parseObj(tbMatch[1])   : {},
    supplement: supMatch  ? parseObj(supMatch[1])  : {},
    mock:       mockMatch ? parseObj(mockMatch[1]) : {},
  };
}

// ── 파일 존재 확인 ──
function fileExists(p) { try { return fs.existsSync(p); } catch{ return false; } }

const TEST_TYPES = ['단어', '워크북', '퀴즈'];

// ─────────────────────────────────────────────
// AUDIT 1: test-deploy.ts vs 실제 파일
// ─────────────────────────────────────────────
function auditFiles(deploy) {
  log('\n━━ [1] test-deploy.ts 등록 vs 실제 파일 ━━');
  let missingFiles = 0;

  // 교과서
  log('\n[교과서]');
  for (const [key, info] of Object.entries(deploy.textbook)) {
    for (const unit of (info.units || [])) {
      const secs = info.sections?.[unit] || ['본문'];
      for (const sec of secs) {
        for (const tt of TEST_TYPES) {
          const p = path.join(DATA, '교과서', info.path, unit, sec, `${tt}.json`);
          if (!fileExists(p)) { fileMissing(`교과서 ${key} ${unit} ${sec} ${tt}.json 없음`); missingFiles++; }
        }
      }
    }
  }
  if (missingFiles === 0) ok('교과서 파일 전부 존재');

  // 부교재
  log('\n[부교재]');
  missingFiles = 0;
  for (const [key, info] of Object.entries(deploy.supplement)) {
    if (!info.units?.length) { warn(`${key}: units 비어있음 (미배포)`); continue; }
    for (const unit of info.units) {
      // 전체 파일 (전체/ 하위폴더 또는 루트 둘 다 체크)
      for (const tt of TEST_TYPES) {
        const p1 = path.join(DATA, '부교재', info.path, unit, '전체', `${tt}.json`);
        const p2 = path.join(DATA, '부교재', info.path, unit, `${tt}.json`);
        if (!fileExists(p1) && !fileExists(p2)) { fileMissing(`부교재 ${key} ${unit} 전체 ${tt}.json 없음`); missingFiles++; }
      }
      // 번호별 파일
      const secs = info.sections?.[unit];
      if (!secs || secs.length === 0) {
        warn(`부교재 ${key} ${unit}: sections 미등록 → 번호별 버튼 안 나옴`);
      } else {
        for (const sec of secs) {
          for (const tt of TEST_TYPES) {
            const p = path.join(DATA, '부교재', info.path, unit, sec, `${tt}.json`);
            if (!fileExists(p)) { fileMissing(`부교재 ${key} ${unit} ${sec} ${tt}.json 없음`); missingFiles++; }
          }
        }
      }
    }
  }
  if (missingFiles === 0) ok('부교재 파일 전부 존재');

  // 모의고사
  log('\n[모의고사]');
  missingFiles = 0;
  for (const [key, info] of Object.entries(deploy.mock)) {
    if (!info.path) { warn(`모의고사 ${key}: path 없음 (미배포)`); continue; }
    for (const item of (info.items || [])) {
      for (const tt of TEST_TYPES) {
        const p = path.join(DATA, '모의고사', info.path, item, `${tt}.json`);
        if (!fileExists(p)) { fileMissing(`모의고사 ${key} ${item} ${tt}.json 없음`); missingFiles++; }
      }
    }
  }
  if (missingFiles === 0) ok('모의고사 파일 전부 존재');
}

// ─────────────────────────────────────────────
// AUDIT 2: shared sync 상태
// ─────────────────────────────────────────────
function auditSync() {
  log('\n━━ [2] shared 코드 sync 상태 ━━');
  const sharedFiles = [
    'constants/test-deploy.ts',
    'utils/test-url.ts',
    'utils/scope.ts',
  ];
  const sharedBase = path.join(ROOT, '..', 'naesinfit-shared', 'src');
  const appBase    = path.join(ROOT, '..', '내신핏v21', 'app', 'src', 'shared');
  const ehgBase    = path.join(ROOT, '..', 'ehg-academy 2', 'src', 'shared');

  for (const f of sharedFiles) {
    const src    = path.join(sharedBase, f);
    const appDst = path.join(appBase, f);
    const ehgDst = path.join(ehgBase, f);

    if (!fileExists(src)) { err(`shared 원본 없음: ${f}`); continue; }

    const srcContent = fs.readFileSync(src, 'utf8');

    if (!fileExists(appDst)) {
      err(`내신해방공식 앱에 없음: ${f}`);
    } else if (fs.readFileSync(appDst, 'utf8') !== srcContent) {
      err(`내신해방공식 앱 불일치: ${f} → sync.sh 필요`);
    } else {
      ok(`내신해방공식 앱 동기화: ${f}`);
    }

    if (!fileExists(ehgDst)) {
      err(`영해공 앱에 없음: ${f}`);
    } else if (fs.readFileSync(ehgDst, 'utf8') !== srcContent) {
      err(`영해공 앱 불일치: ${f} → sync.sh 필요`);
    } else {
      ok(`영해공 앱 동기화: ${f}`);
    }
  }
}

// ─────────────────────────────────────────────
// AUDIT 3 & 4: 학생 wd → 파일 존재 + subKeys 포맷
// ─────────────────────────────────────────────
async function auditStudents(deploy) {
  log('\n━━ [3+4] 활성 학생 테스트 파일 & subKeys 점검 ━━');

  // 전체 students 조회 (wd 포함)
  let students = [];
  try {
    const data = await sbFetch('/rest/v1/students?select=id,name,wd&limit=100');
    if (Array.isArray(data)) students = data;
    else { warn('학생 데이터 조회 실패'); return; }
  } catch(e) {
    warn('Supabase 연결 실패: ' + e.message);
    return;
  }

  // 유효한 contentId 셋 구성
  const validContentIds = new Set();
  for (const [k, v] of Object.entries(deploy.textbook))    { for (const u of v.units||[]) validContentIds.add(`${k}-${u}`); }
  for (const [k, v] of Object.entries(deploy.supplement))  { for (const u of v.units||[]) validContentIds.add(`${k}-${u}`); }
  for (const k of Object.keys(deploy.mock))                { validContentIds.add(k); }

  for (const st of students) {
    const wd = st.wd;
    if (!wd) continue;

    // wd는 {0:{...}, 1:{...}} 형태 (배열 아님)
    const weeks = Array.isArray(wd) ? wd : Object.values(wd);
    // 현재 주차만 검사 (done=false인 첫 주차)
    const curWeek = weeks.find((w) => !w.done) || weeks[weeks.length - 1];
    if (!curWeek) continue;

    const sels = curWeek.selections || [];
    for (const sel of sels) {
      const cid = sel.contentId;
      if (!cid) continue;

      // [4] subKeys 포맷 검증
      const subKeys = sel.subKeys || [];
      for (const sk of subKeys) {
        if (sk === '전체') continue;
        // 번호 포맷: "1번", "Gateway", "본문" 등 허용
        // 잘못된 포맷: "01", "1", "22" (숫자만)
        if (/^\d+$/.test(sk) || /^0\d+/.test(sk)) {
          err(`${st.name}: subKeys "${sk}" 포맷 오류 (→ "${parseInt(sk,10)}번" 이어야 함)`);
        }
      }

      // [3] 파일 존재 확인
      // 교과서
      const tbMatch = cid.match(/^([A-Z0-9]+-[^-]+)-(\d+과)$/);
      if (tbMatch) {
        const key = tbMatch[1], unit = tbMatch[2];
        const info = deploy.textbook[key];
        if (!info) { warn(`${st.name}: ${cid} → test-deploy 미등록`); continue; }
        const secs = subKeys.length > 0 && subKeys[0] !== '전체'
          ? subKeys
          : (info.sections?.[unit] || ['본문']);
        for (const sec of secs) {
          const p = path.join(DATA, '교과서', info.path, unit, sec, '단어.json');
          if (!fileExists(p)) err(`${st.name}: ${cid} [${sec}] 파일 없음`);
        }
        continue;
      }

      // 부교재
      const supMatch = cid.match(/^(.+)-(\d+강)$/);
      if (supMatch) {
        const key = supMatch[1], unit = supMatch[2];
        const info = deploy.supplement[key];
        if (!info) { warn(`${st.name}: ${cid} → test-deploy 미등록`); continue; }
        // 전체 파일
        const pAll = path.join(DATA, '부교재', info.path, unit, '단어.json');
        if (!fileExists(pAll)) err(`${st.name}: ${cid} 전체 파일 없음`);
        // 번호별
        if (subKeys.length > 0 && subKeys[0] !== '전체') {
          for (const sk of subKeys) {
            const p = path.join(DATA, '부교재', info.path, unit, sk, '단어.json');
            if (!fileExists(p)) err(`${st.name}: ${cid} [${sk}] 파일 없음`);
          }
        }
        continue;
      }

      // 모의고사 (모의-YYYY-고N-M월 → 고N-YYYY-M월 변환)
      let mockCid = cid;
      const mockConv = cid.match(/^모의-(\d{4})-(고\d)-(.+)$/);
      if (mockConv) mockCid = `${mockConv[2]}-${mockConv[1]}-${mockConv[3]}`;
      const mockInfo = deploy.mock[mockCid] || deploy.mock[cid];
      if (mockInfo) {
        if (!mockInfo.path) { warn(`${st.name}: ${cid} → path 없음 (미배포)`); continue; }
        const items = subKeys.length > 0 && subKeys[0] !== '전체'
          ? subKeys
          : mockInfo.items;
        for (const item of (items || [])) {
          const p = path.join(DATA, '모의고사', mockInfo.path, item, '단어.json');
          if (!fileExists(p)) err(`${st.name}: ${cid} [${item}] 파일 없음`);
        }
        continue;
      }

      warn(`${st.name}: ${cid} → 어떤 카테고리도 매칭 안 됨`);
    }
  }
}

// ─────────────────────────────────────────────
// AUDIT 5: 학생 subKeys → contents DB 강의 커버리지
// ─────────────────────────────────────────────

/** subKey가 assetKey 목록에 매칭되는지 확인 (범위/강+번호 포함) */
function matchesAssetKey(sk, assetKeys, contentId) {
  if (assetKeys.includes(sk)) return true;
  const skN = sk.match(/^(\d+)번$/)?.[1];
  const gangUnit = contentId?.match(/-(\d+강)$/)?.[1];
  for (const ak of assetKeys) {
    // 범위매칭: "22-25번"
    if (skN) {
      const rm = ak.match(/^(\d+)-(\d+)번$/);
      if (rm && parseInt(skN) >= parseInt(rm[1]) && parseInt(skN) <= parseInt(rm[2])) return true;
    }
    // 강+번호: "7강 3번"
    if (gangUnit && ak === `${gangUnit} ${sk}`) return true;
  }
  return false;
}

async function auditLectureCoverage() {
  log('\n━━ [5] 학생 subKeys → contents DB 강의 커버리지 ━━');

  // students 조회
  let students = [];
  try {
    const data = await sbFetch('/rest/v1/students?select=id,name,wd&limit=100');
    if (Array.isArray(data)) students = data;
    else { warn('학생 데이터 조회 실패 (Audit 5 건너뜀)'); return; }
  } catch(e) {
    warn('Supabase 연결 실패 (Audit 5): ' + e.message);
    return;
  }

  // contents 조회 (페이징 필수: 2081개)
  let contents = [];
  try {
    let page = 0;
    while (true) {
      const chunk = await sbFetch(`/rest/v1/contents?select=id,assets&limit=1000&offset=${page * 1000}`);
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      contents = contents.concat(chunk);
      if (chunk.length < 1000) break;
      page++;
    }
  } catch(e) {
    warn('contents 조회 실패 (Audit 5): ' + e.message);
    return;
  }

  const contentsMap = {};
  for (const c of contents) contentsMap[c.id] = c;

  let missingLec = 0;
  for (const st of students) {
    const wd = st.wd;
    if (!wd) continue;
    const weeks = Array.isArray(wd) ? wd : Object.values(wd);
    const curWeek = weeks.find(w => !w.done) || weeks[weeks.length - 1];
    if (!curWeek) continue;

    for (const sel of (curWeek.selections || [])) {
      const cid = sel.contentId;
      if (!cid) continue;
      const c = contentsMap[cid];
      if (!c) continue;  // contents 미등록은 Audit 3에서 처리

      const subKeys = sel.subKeys || [];
      if (subKeys.length === 0 || subKeys[0] === '전체') continue;

      const lectureKeys = Object.keys(c.assets?.lecture || {});
      if (lectureKeys.length === 0) continue;  // 강의 자체가 없으면 패스

      // EBS 전체 강의 케이스: "전체" 키만 있으면 subKeys 무관하게 정상
      if (lectureKeys.length === 1 && lectureKeys[0] === '전체') {
        if (!c.assets?.lecture?.['전체']?.has) {
          warn(`${st.name}: ${cid} EBS 강의 has:false (URL 미등록)`);
        }
        continue;
      }

      for (const sk of subKeys) {
        const lecHas = matchesAssetKey(sk, lectureKeys, cid);
        if (!lecHas) {
          err(`${st.name}: ${cid} [${sk}] 강의 자료 없음 (assets.lecture에 매칭 키 없음)`);
          missingLec++;
        } else {
          // 매칭된 키의 has:true 여부 확인
          const matchedKey = lectureKeys.find(ak => {
            if (ak === sk) return true;
            const skN = sk.match(/^(\d+)번$/)?.[1];
            if (skN) { const rm = ak.match(/^(\d+)-(\d+)번$/); if (rm && parseInt(skN) >= parseInt(rm[1]) && parseInt(skN) <= parseInt(rm[2])) return true; }
            const gu = cid?.match(/-(\d+강)$/)?.[1];
            if (gu && ak === `${gu} ${sk}`) return true;
            return false;
          });
          if (matchedKey && !c.assets?.lecture?.[matchedKey]?.has) {
            warn(`${st.name}: ${cid} [${sk}] → "${matchedKey}" 강의 has:false (URL 미등록)`);
          }
        }
      }
    }
  }
  if (missingLec === 0) ok('모든 학생 subKeys → 강의 커버리지 정상');
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  const localOnly = process.argv.includes('--local-only');
  localOnlyMode = localOnly;  // Audit 1 파일누락 → warn 모드

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`  내신해방공식 전체 시스템 점검 (full-audit)${localOnly ? ' [로컬 전용]' : ''}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // test-deploy.ts 파싱
  let deploy;
  try {
    deploy = parseTestDeploy(SHARED_DEPLOY);
  } catch(e) {
    log(`${ERR} test-deploy.ts 파싱 실패: ${e.message}`);
    process.exit(1);
  }

  auditFiles(deploy);
  auditSync();

  if (!localOnly) {
    await auditStudents(deploy);
    await auditLectureCoverage();
  } else {
    log('\n━━ [3+4+5] Supabase 점검 스킵 (--local-only) ━━');
    ok('로컬 전용 모드: DB 점검 생략');
  }

  // ── 최종 요약 ──
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`  총 오류: ${totalErrors}건 / 경고: ${totalWarns}건`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (totalErrors === 0 && totalWarns === 0) {
    log(`${OK} 전체 시스템 정상`);
  } else {
    log('\n[오류/경고 목록]');
    report.forEach(r => log(r));
  }

  // pre-push hook: 오류 있으면 exit 1로 push 차단
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(e => { log(`치명적 오류: ${e.message}`); process.exit(1); });
