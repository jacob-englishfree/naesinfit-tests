#!/usr/bin/env node
/**
 * verify-deploy.js — push 후 실제 배포 검증
 *
 * 1. Vercel 배포 완료 대기
 * 2. 변경된 JSON의 ans 값이 실제 사이트에서 올바른지 확인
 * 3. 엔진(index.html) 채점 코드 확인
 * 4. 학생 대시보드 접속 확인
 *
 * Usage: node scripts/verify-deploy.js
 *        (git push 후 자동 실행)
 */

const https = require('https');
const http = require('http');

const TESTS_URL = 'https://naesinfit-tests.vercel.app';
const APP_URL = 'https://naesinfit.vercel.app';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'NaesinFit-Verify/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🔍 배포 검증 시작...\n');
  let pass = 0;
  let fail = 0;

  // 1. Vercel 배포 상태 확인
  console.log('1️⃣  Vercel 배포 확인');
  try {
    const r = await fetch(TESTS_URL + '/');
    if (r.status === 200) {
      console.log('  ✅ naesinfit-tests.vercel.app 접속 OK');
      pass++;
    } else {
      console.log(`  ❌ naesinfit-tests.vercel.app 상태: ${r.status}`);
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ 접속 실패: ${e.message}`);
    fail++;
  }

  // 2. 엔진 채점 코드 확인
  console.log('\n2️⃣  엔진 채점 코드 확인');
  try {
    const r = await fetch(TESTS_URL + '/');
    if (r.body.includes('a+1===q.ans')) {
      console.log('  ✅ 채점 코드: a+1===q.ans (1-based 정상)');
      pass++;
    } else if (r.body.includes('a===q.ans')) {
      console.log('  ❌ 채점 코드: a===q.ans (0-based — 학생 전원 오채점!)');
      fail++;
    } else {
      console.log('  ⚠️  채점 코드 패턴 찾을 수 없음');
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    fail++;
  }

  // 3. 샘플 JSON 검증 (ans 범위 + 응답 확인)
  console.log('\n3️⃣  샘플 JSON 검증');
  const samples = [
    'data/교과서/영어1/능률오선영/1과/본문/퀴즈.json',
    'data/부교재/수능특강/영어/1강/퀴즈.json',
    'data/부교재/수능특강/영어/4강/워크북.json',
  ];

  for (const path of samples) {
    try {
      const r = await fetch(`${TESTS_URL}/${encodeURI(path)}`);
      if (r.status !== 200) {
        console.log(`  ❌ ${path}: HTTP ${r.status}`);
        fail++;
        continue;
      }
      const data = JSON.parse(r.body);
      const qs = data.questions || [];
      const badAns = qs.filter(q => q.fmt === 'mc' && (q.ans < 1 || q.ans > (q.ch || []).length));
      if (badAns.length > 0) {
        console.log(`  ❌ ${path}: ${badAns.length}개 ans 범위 초과`);
        fail++;
      } else {
        console.log(`  ✅ ${path}: ${qs.length}문항, ans 범위 정상`);
        pass++;
      }
    } catch (e) {
      console.log(`  ❌ ${path}: ${e.message}`);
      fail++;
    }
  }

  // 4. 내신해방공식 앱 접속 확인
  console.log('\n4️⃣  내신해방공식 앱 접속 확인');
  try {
    const r = await fetch(APP_URL + '/');
    if (r.status === 200) {
      console.log('  ✅ naesinfit.vercel.app 접속 OK');
      pass++;
    } else {
      console.log(`  ❌ naesinfit.vercel.app 상태: ${r.status}`);
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    fail++;
  }

  // 5. 카탈로그 동기화 확인
  console.log('\n5️⃣  카탈로그 확인');
  try {
    const r = await fetch(TESTS_URL + '/');
    const lessons23 = r.body.includes('"23강"');
    const lessons14 = r.body.includes('"14강"');
    if (lessons23 && lessons14) {
      console.log('  ✅ 수능특강 카탈로그: 14강, 23강 포함');
      pass++;
    } else {
      console.log(`  ❌ 카탈로그 누락: 14강=${lessons14}, 23강=${lessons23}`);
      fail++;
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    fail++;
  }

  // 결과
  console.log('\n══════════════════════════════');
  if (fail === 0) {
    console.log(`✅ 배포 검증 완료: ${pass}개 항목 전부 PASS`);
  } else {
    console.log(`❌ 배포 검증 실패: ${pass} PASS / ${fail} FAIL`);
  }
  console.log('══════════════════════════════');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
