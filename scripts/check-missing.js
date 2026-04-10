#!/usr/bin/env node
/**
 * check-missing.js — 학생별 미출제 테스트 정확 조사
 *
 * ⛔ textbooks.ts 매핑에 의존하지 않음. data/ 폴더를 직접 확인.
 *
 * 사용법: node scripts/check-missing.js
 *         npm run check-missing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// ── Supabase 연결 ──
let sb;
async function initSupabase() {
  let mod;
  try { mod = require('@supabase/supabase-js'); } catch {
    mod = require(path.resolve(ROOT, '..', 'ehg-academy 2', 'node_modules', '@supabase', 'supabase-js'));
  }
  sb = mod.createClient(
    'https://enkewpvhaugcmyglifkc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVua2V3cHZoYXVnY215Z2xpZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTQzMjksImV4cCI6MjA4OTA3MDMyOX0.JJvDYNbxSnsaE30tMFl5x1Daqyx2Wk8bQv6s19tNrY8'
  );
}

// ── textbooks.ts id→path 매핑 (보조용, 직접 확인의 fallback) ──
function loadIdToPath() {
  const tsPath = path.resolve(ROOT, '..', 'naesinfit-shared', 'src', 'constants', 'textbooks.ts');
  const src = fs.readFileSync(tsPath, 'utf8');
  const map = {};
  const re = /id:"([^"]+)"[^}]*?path:"([^"]+)"/g;
  let m;
  while (m = re.exec(src)) map[m[1]] = m[2];
  return map;
}

// ── data/ 폴더 전체 인덱스 구축 ──
function buildDataIndex() {
  const index = {}; // "모의고사/고1/3월/18번" → true
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir)) {
      if (item.startsWith('_') || item.startsWith('.')) continue;
      const full = path.join(dir, item);
      const rel = prefix ? prefix + '/' + item : item;
      if (fs.statSync(full).isDirectory()) {
        walk(full, rel);
      } else if (item.endsWith('.json')) {
        // index the parent folder as having test files
        index[prefix] = true;
      }
    }
  }
  walk(DATA, '');
  return index;
}

// ── contentId + subKey → data/ 경로 변환 ──
function findTestPath(contentId, subKey, idToPath, dataIndex) {
  // 1차: idToPath 매핑 사용
  for (const [id, p] of Object.entries(idToPath)) {
    if (contentId === id || contentId.startsWith(id + '-')) {
      const unit = contentId.startsWith(id + '-') ? contentId.slice(id.length + 1) : '';
      const source = p.startsWith('고') ? '모의고사' :
                     p.includes('/') && !['공통','영어','중2','중3'].some(x => p.startsWith(x)) ? '부교재' : '교과서';

      let testPath;
      if (source === '모의고사') {
        testPath = '모의고사/' + p + '/' + subKey;
      } else if (source === '부교재') {
        testPath = '부교재/' + p + '/' + unit + '/' + subKey;
      } else {
        testPath = '교과서/' + p + '/' + unit + '/' + subKey;
      }

      if (dataIndex[testPath]) return { found: true, path: testPath };
    }
  }

  // 2차: data/ 직접 브루트포스 검색
  // contentId에서 키워드 추출해서 data/ 안에서 찾기
  const keywords = contentId.replace(/-/g, '/').split('/');
  for (const key of Object.keys(dataIndex)) {
    const parts = key.split('/');
    // subKey가 path에 포함돼있는지
    if (!parts.includes(subKey)) continue;
    // contentId 키워드가 충분히 매칭되는지
    const matchCount = keywords.filter(kw => parts.some(p => p.includes(kw) || kw.includes(p))).length;
    if (matchCount >= 2) return { found: true, path: key };
  }

  return { found: false, path: null };
}

// ── 학생 start_date 파싱 ──
function parseStartDate(sd) {
  if (!sd) return null;
  if (sd.includes('-') && sd.length > 5) return new Date(sd + 'T00:00:00');
  const m = sd.match(/(\d+)\/(\d+)/);
  if (m) return new Date('2026-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') + 'T00:00:00');
  return null;
}

// ── 메인 ──
async function main() {
  await initSupabase();
  const idToPath = loadIdToPath();
  const dataIndex = buildDataIndex();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: students } = await sb.from('students').select('name,start_date,weeks,wd,exam_period');
  if (!students) { console.log('학생 데이터 없음'); return; }

  const missing = [];

  for (const s of students) {
    const start = parseStartDate(s.start_date);
    if (!start || isNaN(start)) continue;

    const daysDiff = Math.floor((today - start) / 86400000);
    const wi = Math.min(Math.floor(daysDiff / 7), Math.max((s.weeks || 4) - 1, 0));
    const wd = s.wd || [];

    // 현재 + 다음 주차
    for (let i = wi; i <= wi + 1 && i < wd.length; i++) {
      const w = wd[i];
      if (!w || !w.selections) continue;
      const label = i === wi ? '현재' : '다음';

      for (const sel of w.selections) {
        const cid = sel.contentId;
        if (!cid) continue;
        const subKeys = sel.subKeys || ['전체'];

        // data/ 파일 직접 확인
        let hasAnyTest = false;

        if (subKeys.length === 1 && subKeys[0] === '전체') {
          // "전체" = 해당 contentId의 상위 폴더에 아무 테스트든 있으면 OK
          const result = findTestPath(cid, '전체', idToPath, dataIndex);
          if (result.found) { hasAnyTest = true; }
          else {
            // 번호별/섹션별 폴더가 있는지도 확인 (모의고사 18번~ / 부교재 Ex01~ 등)
            for (const [id, p] of Object.entries(idToPath)) {
              if (cid === id || cid.startsWith(id + '-')) {
                const unit = cid.startsWith(id + '-') ? cid.slice(id.length + 1) : '';
                const source = p.startsWith('고') ? '모의고사' :
                  ['공통','영어','중2','중3'].some(x => p.startsWith(x)) ? '교과서' : '부교재';
                let parentDir;
                if (source === '모의고사') parentDir = path.join(DATA, '모의고사', p);
                else if (source === '부교재') parentDir = path.join(DATA, '부교재', p, unit);
                else parentDir = path.join(DATA, '교과서', p, unit);

                if (fs.existsSync(parentDir)) {
                  const subs = fs.readdirSync(parentDir).filter(f =>
                    !f.startsWith('_') && fs.statSync(path.join(parentDir, f)).isDirectory()
                  );
                  if (subs.length > 0) { hasAnyTest = true; break; }
                }
              }
            }
            // 브루트포스: contentId 키워드로 data/ 검색
            if (!hasAnyTest) {
              const kw = cid.replace(/-/g, '/').split('/');
              for (const key of Object.keys(dataIndex)) {
                const parts = key.split('/');
                const matchCount = kw.filter(k => parts.some(p => p.includes(k) || k.includes(p))).length;
                if (matchCount >= 2) { hasAnyTest = true; break; }
              }
            }
          }
        } else {
          for (const sk of subKeys) {
            const result = findTestPath(cid, sk, idToPath, dataIndex);
            if (result.found) { hasAnyTest = true; break; }
          }
        }

        if (!hasAnyTest) {
          missing.push({ student: s.name, exam: s.exam_period || '', week: label, cid });
        }
      }
    }
  }

  // 중복 제거 + 정렬
  const grouped = {};
  for (const m of missing) {
    const key = m.cid;
    if (!grouped[key]) grouped[key] = { students: [], weeks: new Set(), exams: [] };
    if (!grouped[key].students.includes(m.student)) grouped[key].students.push(m.student);
    grouped[key].weeks.add(m.week);
    if (m.exam && !grouped[key].exams.includes(m.exam)) grouped[key].exams.push(m.exam);
  }

  const sorted = Object.entries(grouped).sort((a, b) => {
    const urgA = a[1].weeks.has('현재') ? 0 : 1;
    const urgB = b[1].weeks.has('현재') ? 0 : 1;
    if (urgA !== urgB) return urgA - urgB;
    return b[1].students.length - a[1].students.length;
  });

  if (sorted.length === 0) {
    console.log('✅ 미출제 테스트 0건 — 전체 학생 현재+다음 주차 정상');
    return;
  }

  console.log(`\n🔴 미출제 테스트 ${sorted.length}건 (data/ 폴더 직접 확인 기준)\n`);
  console.log('주차 | 컨텐츠 | 학생 | 시험');
  console.log('---|---|---|---');
  for (const [cid, info] of sorted) {
    const urg = [...info.weeks].join('/');
    const studs = info.students.join(', ');
    const exam = info.exams[0] || '';
    console.log(`${urg} | ${cid} | ${studs} | ${exam}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
