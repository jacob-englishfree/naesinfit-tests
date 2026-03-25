#!/usr/bin/env python3
"""전체 테스트 파일 Q 배열 품질 검증"""
import os, re, json

root = "/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"
issues = []
total = 0

for dirpath, dirs, files in os.walk(root):
    if '/.git' in dirpath: continue
    for f in files:
        if not f.endswith('테스트.html'): continue
        fp = os.path.join(dirpath, f)
        rel = fp.replace(root + '/', '')
        total += 1
        
        with open(fp, 'r') as fh:
            txt = fh.read()
        
        # Extract Q array
        m = re.search(r'const Q=\[(.*?)\];', txt, re.DOTALL)
        if not m: 
            issues.append(f"❌ {rel}: Q 배열 없음")
            continue
        
        try:
            q_str = '[' + m.group(1) + ']'
            # Simple fixes for JS → JSON
            q_str = re.sub(r'(\w+):', r'"\1":', q_str)
            q_str = q_str.replace("'", '"').replace('`', '"')
            qs = json.loads(q_str)
        except:
            # Can't parse JSON, use regex instead
            qs = None
        
        file_issues = []
        
        # Check with regex patterns instead
        # 1. Count questions
        q_count = len(re.findall(r'"id"\s*:\s*\d+', txt[m.start():m.end()]))
        if q_count != 20:
            file_issues.append(f"문항수 {q_count}≠20")
        
        # 2. Check for ABC type without (A)(B)(C) in passage
        abc_types = re.findall(r'"type"\s*:\s*"[^"]*조합[^"]*".*?"passage"\s*:\s*"([^"]*)"', txt, re.DOTALL)
        for p in abc_types:
            if '(A)' not in p or '(B)' not in p or '(C)' not in p:
                file_issues.append("ABC조합형인데 passage에 (A)(B)(C) 마커 없음")
                break
        
        # 3. Check for 빈칸 type without __________ in passage
        blank_matches = re.findall(r'"type"\s*:\s*"[^"]*빈칸[^"]*".*?"passage"\s*:\s*"([^"]*)"', txt, re.DOTALL)
        blank_missing = 0
        for p in blank_matches:
            if '__________' not in p and '________' not in p:
                blank_missing += 1
        if blank_missing:
            file_issues.append(f"빈칸문제 {blank_missing}개에 __________ 없음")
        
        # 4. Check for 부적절 type without <u> in passage
        wrong_matches = re.findall(r'"type"\s*:\s*"[^"]*부적절[^"]*".*?"passage"\s*:\s*"([^"]*)"', txt, re.DOTALL)
        for p in wrong_matches:
            u_count = p.count('<u>')
            if u_count < 5:
                file_issues.append(f"부적절어휘인데 <u> 밑줄 {u_count}개 (5개 필요)")
                break
        
        # 5. Check ch length for mc questions
        ch_matches = re.findall(r'"fmt"\s*:\s*"mc".*?"ch"\s*:\s*\[([^\]]*)\]', txt, re.DOTALL)
        short_ch = 0
        for ch in ch_matches:
            items = [x.strip() for x in ch.split(',') if x.strip()]
            # T/F has 2, 문장삽입 has 4, rest should have 5
            if len(items) < 4 and len(items) != 2:
                short_ch += 1
            elif len(items) == 4:
                # Check if it's 문장삽입 (OK) or not
                pass
        if short_ch:
            file_issues.append(f"선지 부족 {short_ch}문항")
        
        # 6. Check total points
        pts_matches = re.findall(r'"pts"\s*:\s*(\d+)', txt[m.start():m.end()])
        if pts_matches:
            total_pts = sum(int(p) for p in pts_matches)
            if total_pts != 100:
                file_issues.append(f"총점 {total_pts}≠100")
        
        if file_issues:
            issues.append(f"❌ {rel}: {'; '.join(file_issues)}")

print(f"=== 전수 검증 결과 ===")
print(f"총 파일: {total}")
print(f"문제 파일: {len(issues)}")
print(f"정상 파일: {total - len(issues)}")
print()
for iss in sorted(issues)[:50]:
    print(iss)
if len(issues) > 50:
    print(f"... 외 {len(issues)-50}건")
