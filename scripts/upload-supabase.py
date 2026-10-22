#!/usr/bin/env python3
# 테스트 JSON을 Supabase 스토리지에 업로드 (Vercel Build CPU 절감 — data는 Supabase가 서빙)
# deploy-json.js가 git push 후 자동 호출. 인자 = 배포한 data/*.json 경로들.
# 경로(한글)를 SHA-256 영문 key로 변환(Supabase key 한글 불가) — index.html fetchDataJson과 동일 규칙.
import sys, os, hashlib, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
PROJ = 'enkewpvhaugcmyglifkc'
BASE = f'https://{PROJ}.supabase.co/storage/v1'

# .env.local에서 service key
KEY = None
envf = os.path.join(ROOT, '.env.local')
if os.path.exists(envf):
    for line in open(envf, encoding='utf-8'):
        if line.strip().startswith('NF_SUPABASE_SERVICE_KEY='):
            KEY = line.split('=', 1)[1].strip()
if not KEY:
    print('⚠️ NF_SUPABASE_SERVICE_KEY 없음 (.env.local) — Supabase 업로드 건너뜀 (로컬 fallback으로 서빙됨)')
    sys.exit(0)

ok = 0; fail = 0
for arg in sys.argv[1:]:
    f = os.path.abspath(arg)
    if not f.endswith('.json') or (DATA + os.sep) not in f:
        continue  # data/ JSON만
    rel = os.path.relpath(f, DATA)
    # 검증 산출물은 학생 서빙 대상 아님 — 업로드 제외(서빙용 단어/워크북/퀴즈/_passage만)
    if rel.endswith(('.adversarial.json', '.blind.json', '.cross-blind.json', '.response.json', '.prompt.json')):
        continue
    key = hashlib.sha256(rel.encode('utf-8')).hexdigest() + '.json'
    try:
        content = open(f, 'rb').read()
        h = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
             'x-upsert': 'true', 'cache-control': 'max-age=60, stale-while-revalidate=86400'}
        req = urllib.request.Request(f'{BASE}/object/tests/{key}', data=content, headers=h, method='POST')
        urllib.request.urlopen(req, timeout=40)
        ok += 1
    except Exception as e:
        fail += 1
        print(f'  ⚠️ Supabase 업로드 실패 {rel}: {str(e)[:50]}')
print(f'☁️ Supabase 스토리지 업로드: 성공 {ok}개' + (f', 실패 {fail}개(로컬 fallback 유지)' if fail else ''))
