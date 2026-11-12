const fs=require("fs");const path=require("path");
const TS=fs.readFileSync("/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-shared/src/constants/test-deploy.ts","utf8");
const DATA="data";
// 엔트리 파싱: "KEY": { path: "...", units: [...], sections: {...} }
function parseBlock(varName){
  const start=TS.indexOf(varName);
  // 해당 객체 영역만 (다음 'export const' 전까지)
  const after=TS.slice(start);
  const end=after.search(/\n(export const|const [A-Z])/);
  const seg=end>0?after.slice(0,end):after;
  const entries={};
  const re=/"([^"]+)":\s*\{\s*path:\s*"([^"]+)"\s*,\s*units:\s*\[([^\]]*)\]/g;
  let m;
  while((m=re.exec(seg))){
    const key=m[1], p=m[2];
    const units=m[3].split(",").map(s=>s.trim().replace(/^"|"$/g,"")).filter(Boolean);
    entries[key]={path:p,units};
  }
  return entries;
}
const TB=parseBlock("TEST_APP_DEPLOY");          // 교과서
const SUP=parseBlock("TEST_APP_SUPPLEMENT_DEPLOY"); // 부교재
function hasTestData(dir){
  if(!fs.existsSync(dir))return false;
  // 재귀로 단어/워크북/퀴즈.json 하나라도 있으면 true
  const stack=[dir];let depth=0;
  while(stack.length&&depth<5000){const d=stack.pop();depth++;for(const f of fs.readdirSync(d)){const fp=path.join(d,f);const st=fs.statSync(fp);if(st.isDirectory())stack.push(fp);else if(/^(단어|워크북|퀴즈)\.json$/.test(f))return true;}}
  return false;
}
function actualUnits(baseType,p){
  const dir=path.join(DATA,baseType,p);
  if(!fs.existsSync(dir))return {missing:true,units:[]};
  const units=fs.readdirSync(dir).filter(f=>{const fp=path.join(dir,f);return fs.statSync(fp).isDirectory()&&!f.startsWith("_")&&hasTestData(fp);});
  return {missing:false,units};
}
function report(label,baseType,entries){
  console.log(`\n========== ${label} ==========`);
  let gaps=0;
  for(const [key,e] of Object.entries(entries)){
    const act=actualUnits(baseType,e.path);
    if(act.missing){ console.log(`  ⚠️ ${key}: 데이터폴더 없음 (${e.path})`); continue; }
    const mapSet=new Set(e.units);
    const missing=act.units.filter(u=>!mapSet.has(u));
    const extra=e.units.filter(u=>!act.units.includes(u));
    if(missing.length){ gaps++; console.log(`  🔴 ${key} (${e.path}): 매핑누락 [${missing.join(", ")}]  | 매핑=${e.units.length}개 데이터=${act.units.length}개`); }
  }
  console.log(`  → 갭 있는 엔트리: ${gaps}`);
  return gaps;
}
const g1=report("교과서 (TEST_APP_DEPLOY)","교과서",TB);
const g2=report("부교재 (TEST_APP_SUPPLEMENT_DEPLOY)","부교재",SUP);
console.log(`\n총 갭 엔트리: ${g1+g2}`);
