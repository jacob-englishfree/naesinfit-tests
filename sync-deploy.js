#!/usr/bin/env node
/**
 * GitHub Pages에 배포된 테스트 파일을 스캔하여
 * naesinfit-shared의 TEST_APP_DEPLOY 상수를 자동 업데이트
 *
 * 사용법: node sync-deploy.js
 */
const fs = require("fs");
const path = require("path");

const TESTS_DIR = __dirname;
const TEXTBOOK_DIR = path.join(TESTS_DIR, "교과서");
const SUPPLEMENT_DIR = path.join(TESTS_DIR, "부교재");
const TARGET = path.join(__dirname, "..", "naesinfit-shared", "src", "constants", "test-deploy.ts");

// 교과서 스캔
const textbookDeploy = {};
if (fs.existsSync(TEXTBOOK_DIR)) {
  for (const cat of fs.readdirSync(TEXTBOOK_DIR)) {
    const catPath = path.join(TEXTBOOK_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;
    for (const pub of fs.readdirSync(catPath)) {
      const pubPath = path.join(catPath, pub);
      if (!fs.statSync(pubPath).isDirectory()) continue;
      const units = fs.readdirSync(pubPath).filter(d => fs.statSync(path.join(pubPath, d)).isDirectory() && /과$/.test(d));
      if (units.length > 0) {
        // contentId prefix 추론
        const testFile = units.find(u => fs.existsSync(path.join(pubPath, u, "단어테스트.html")));
        if (testFile) {
          const key = `${cat}/${pub}`;
          textbookDeploy[key] = { path: `${cat}/${pub}`, units };
        }
      }
    }
  }
}

// 부교재 스캔
const supplementDeploy = {};
if (fs.existsSync(SUPPLEMENT_DIR)) {
  for (const cat of fs.readdirSync(SUPPLEMENT_DIR)) {
    const catPath = path.join(SUPPLEMENT_DIR, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;
    for (const sub of fs.readdirSync(catPath)) {
      const subPath = path.join(catPath, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      const units = fs.readdirSync(subPath).filter(d => fs.statSync(path.join(subPath, d)).isDirectory() && /강$/.test(d));
      if (units.length > 0) {
        supplementDeploy[`${cat}/${sub}`] = { path: `${cat}/${sub}`, units };
      }
    }
  }
}

console.log(`교과서: ${Object.keys(textbookDeploy).length}개`);
console.log(`부교재: ${Object.keys(supplementDeploy).length}개`);

// 현재 상수와 비교
if (fs.existsSync(TARGET)) {
  const current = fs.readFileSync(TARGET, "utf-8");
  
  // 새 units 추가 여부 확인
  for (const [key, val] of Object.entries(textbookDeploy)) {
    const unitsStr = val.units.map(u => `"${u}"`).join(",");
    if (!current.includes(unitsStr)) {
      console.log(`  📋 교과서 업데이트 필요: ${key} → ${val.units.join(", ")}`);
    }
  }
  for (const [key, val] of Object.entries(supplementDeploy)) {
    const unitsStr = val.units.map(u => `"${u}"`).join(",");
    if (!current.includes(unitsStr)) {
      console.log(`  📋 부교재 업데이트 필요: ${key} → ${val.units.join(", ")}`);
    }
  }
}

console.log("\n✅ 스캔 완료. 변경 필요한 항목은 위에 표시됨.");
