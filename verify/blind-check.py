#!/usr/bin/env python3
"""
블라인드 풀이 검증 스크립트 (API 미사용)
- det.analysis의 ✅ 정답 단어 ↔ ans가 가리키는 ch 단어 교차검증
- passage ↔ ans 정합성 검증
- 유형별 구조적 검증
"""

import json, glob, re, os, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def clean_html(text):
    if not text: return ''
    return re.sub(r'<[^>]+>', '', str(text)).strip()

def extract_underlined(passage):
    if not passage: return []
    return re.findall(r'<u>([^<]+)</u>', passage)

class BlindChecker:
    def __init__(self):
        self.issues = []
        self.stats = Counter()
        self.errors_by_type = Counter()
        self.checked = 0
        self.match = 0
        self.mismatch = 0
        self.skip = 0

    def add_issue(self, fpath, qid, sev, msg):
        self.issues.append((fpath, qid, sev, msg))

    def check_file(self, fpath):
        try:
            data = json.load(open(fpath, 'r', encoding='utf-8'))
        except Exception as e:
            self.add_issue(fpath, 0, 'S', f'JSON 파싱 실패: {e}')
            return

        questions = data.get('questions', [])
        fp = data.get('fullPassage', '')

        for i, q in enumerate(questions):
            qid = i + 1
            qtype = (q.get('type', '') or '').strip()
            ans = q.get('ans')
            wa = q.get('wa')
            det = q.get('det', {}) or {}
            passage = q.get('passage') or ''
            stem = q.get('stem') or ''
            ch = q.get('ch') or []
            fmt = q.get('fmt', '')

            self.stats[qtype] += 1

            # ═══ 1. MC: det 정답 단어 ↔ ans 정답 단어 교차검증 ═══
            if fmt == 'mc' and ans is not None and ch:
                self.check_det_ans_word(fpath, qid, qtype, ans, det, ch)

            # ═══ 2. 서술형: wa/ans 존재 확인 ═══
            if fmt == 'wr':
                self.check_written(fpath, qid, qtype, ans, wa, q)

            # ═══ 3. 유형별 내용 검증 ═══
            self.check_content(fpath, qid, q, fp)

    def check_det_ans_word(self, fpath, qid, qtype, ans, det, ch):
        """det.analysis에서 ✅로 표시된 정답 단어 ↔ ch[ans-1] 비교"""
        analysis = det.get('analysis', '') or ''
        if not analysis:
            self.skip += 1
            return

        self.checked += 1

        # ans가 가리키는 실제 정답 단어
        ans_idx = ans - 1
        if ans_idx < 0 or ans_idx >= len(ch):
            self.add_issue(fpath, qid, 'S', f'ans={ans} 범위 초과 (ch={len(ch)}개) [{qtype}]')
            self.mismatch += 1
            return

        ans_word = clean_html(ch[ans_idx]).strip().lower()

        # det.analysis에서 ✅ 줄의 단어 추출
        check_words = []
        for line in analysis.split('\n'):
            line = line.strip()
            if '✅' not in line:
                continue
            # "✅ ④ instructor" → "instructor"
            # "✅ ① provided" → "provided"
            # "✅ 정답: 3번" → skip
            if '정답' in line:
                continue
            # Remove ✅, circled numbers, and extract word
            cleaned = re.sub(r'[✅①②③④⑤⑥⑦⑧⑨⑩\s]+', ' ', line).strip()
            if cleaned and len(cleaned) > 0:
                # Take the first meaningful word/phrase
                word = cleaned.split('—')[0].strip().lower()
                word = re.sub(r'^[\d]+\s*', '', word).strip()  # remove leading numbers
                if word and word not in ['정답', '오답', '번']:
                    check_words.append(word)

        if not check_words:
            self.skip += 1
            self.checked -= 1
            return

        # 정답 단어가 det ✅ 단어와 일치하는지
        found_match = False
        for cw in check_words:
            # Exact or substring match
            if ans_word == cw or ans_word in cw or cw in ans_word:
                found_match = True
                break
            # Handle multi-word: "provide — required" 등
            cw_words = re.split(r'[\s,\-–—/]+', cw)
            for w in cw_words:
                w = w.strip().lower()
                if w and (w == ans_word or w in ans_word or ans_word in w):
                    found_match = True
                    break
            if found_match:
                break

        if found_match:
            self.match += 1
        else:
            self.mismatch += 1
            # 실제 불일치 — det이 다른 단어를 정답으로 가리킴
            self.add_issue(fpath, qid, 'S',
                f'det 정답 단어 "{check_words[0]}" ≠ ans 정답 "{ans_word}" [{qtype}]')
            self.errors_by_type[qtype] += 1

    def check_written(self, fpath, qid, qtype, ans, wa, q):
        """서술형 정답 존재 + 기본 검증"""
        if not wa and not ans:
            self.add_issue(fpath, qid, 'S', f'서술형 wa/ans 모두 없음 [{qtype}]')
            self.errors_by_type['서술형_없음'] += 1
            return

        answer = str(wa or ans or '').strip()
        if not answer:
            self.add_issue(fpath, qid, 'S', f'서술형 정답 빈 문자열 [{qtype}]')
            self.errors_by_type['서술형_빈'] += 1
            return

        # accept 배열에 소문자 변형이 있는지 (F10-B 관련)
        accept = q.get('accept', [])
        if accept and isinstance(accept, list):
            # answer와 accept 중 하나라도 같으면 OK
            pass

        # 어형변환: 정답이 영어 단어인지
        if '어형' in qtype and '변환' in qtype:
            if not re.search(r'[a-zA-Z]', answer):
                self.add_issue(fpath, qid, 'A', f'어형변환 정답에 영문 없음: "{answer}" [{qtype}]')

    def check_content(self, fpath, qid, q, fp):
        """유형별 내용 검증"""
        qtype = (q.get('type', '') or '').strip()
        passage = q.get('passage') or ''
        ch = q.get('ch') or []
        ans = q.get('ans')
        stem = q.get('stem') or ''
        fmt = q.get('fmt', '')

        # ── 동의어: 정답이 밑줄 단어와 동일하면 에러 ──
        if '동의어' in qtype and fmt == 'mc' and ch and ans:
            ans_idx = ans - 1
            if 0 <= ans_idx < len(ch):
                answer = clean_html(ch[ans_idx]).strip().lower()
                underlined = extract_underlined(passage)
                for u in underlined:
                    if u.strip().lower() == answer:
                        self.add_issue(fpath, qid, 'S',
                            f'동의어 정답 "{answer}" = 밑줄 단어 (동의어 아님)')
                        self.errors_by_type['동의어=밑줄'] += 1

        # ── 반의어: 정답이 밑줄 단어와 동일하면 에러 ──
        if '반의어' in qtype and fmt == 'mc' and ch and ans:
            ans_idx = ans - 1
            if 0 <= ans_idx < len(ch):
                answer = clean_html(ch[ans_idx]).strip().lower()
                underlined = extract_underlined(passage)
                for u in underlined:
                    if u.strip().lower() == answer:
                        self.add_issue(fpath, qid, 'S',
                            f'반의어 정답 "{answer}" = 밑줄 단어 (반의어 아님)')
                        self.errors_by_type['반의어=밑줄'] += 1

        # ── MC: 선지 중복 ──
        if fmt == 'mc' and ch:
            clean_ch = [clean_html(c).strip().lower() for c in ch]
            if len(set(clean_ch)) < len(clean_ch):
                dupes = [c for c in clean_ch if clean_ch.count(c) > 1]
                self.add_issue(fpath, qid, 'S',
                    f'선지 중복: {list(set(dupes))} [{qtype}]')
                self.errors_by_type['선지중복'] += 1

        # ── MC: ans 범위 ──
        if fmt == 'mc' and ans is not None and ch:
            if not isinstance(ans, int) or ans < 1 or ans > len(ch):
                self.add_issue(fpath, qid, 'S',
                    f'ans={ans} 범위 초과 (ch={len(ch)}개) [{qtype}]')
                self.errors_by_type['ans범위'] += 1

        # ── 서술형 — 영작: passage/fullPassage에서 정답 원문 확인 ──
        if '영작' in qtype and fmt == 'wr':
            answer = str(q.get('wa') or q.get('ans') or '').strip()
            if answer and fp:
                # 영작 정답이 fullPassage에 있어야 (원문 기반)
                if answer.lower() not in fp.lower() and len(answer) > 10:
                    # 긴 영작 정답이 원문에 없으면 의심
                    self.add_issue(fpath, qid, 'B',
                        f'영작 정답 "{answer[:50]}..." fullPassage에 없음')

        # ── 정답 편향 검사 (파일 전체) ──
        # (check_file_level에서 처리)

    def check_file_level(self, fpath, questions):
        """파일 레벨 검사"""
        # 정답 분포
        mc_ans = [q.get('ans') for q in questions if q.get('fmt') == 'mc' and q.get('ans') is not None]
        if len(mc_ans) >= 10:
            dist = Counter(mc_ans)
            total = len(mc_ans)
            for val, cnt in dist.items():
                ratio = cnt / total
                if ratio > 0.45:
                    self.add_issue(fpath, 0, 'A',
                        f'정답 편향: ans={val}이 {cnt}/{total} ({ratio:.0%})')
                    self.errors_by_type['정답편향'] += 1


def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else 'data/부교재/수능특강'
    exclude = sys.argv[2] if len(sys.argv) > 2 else '수능특강Light'

    os.chdir(ROOT)

    files = sorted(glob.glob(f'{target_dir}/**/*.json', recursive=True))
    if exclude:
        files = [f for f in files if exclude not in f]

    print(f'=== 블라인드 풀이 검증 (단어 기준) ===')
    print(f'대상: {len(files)}개 파일')
    print()

    checker = BlindChecker()

    for f in files:
        try:
            data = json.load(open(f, 'r', encoding='utf-8'))
        except:
            checker.add_issue(f, 0, 'S', 'JSON 파싱 실패')
            continue

        questions = data.get('questions', [])
        checker.check_file_level(f, questions)
        checker.check_file(f)

    # ═══ 결과 출력 ═══
    s_issues = [x for x in checker.issues if x[2] == 'S']
    a_issues = [x for x in checker.issues if x[2] == 'A']
    b_issues = [x for x in checker.issues if x[2] == 'B']

    print(f'━━━━━━━━━━━━━━━━━━━━━━━━')
    print(f'검사 파일: {len(files)}개')
    print(f'det↔ans 교차검증: {checker.checked}건 (일치: {checker.match}, 불일치: {checker.mismatch}, 스킵: {checker.skip})')
    print(f'S급 에러: {len(s_issues)}건')
    print(f'A급 에러: {len(a_issues)}건')
    print(f'B급 참고: {len(b_issues)}건')
    print()

    if s_issues:
        print(f'═══ S급 에러 ({len(s_issues)}건) ═══')
        by_file = defaultdict(list)
        for fpath, qid, sev, msg in s_issues:
            by_file[fpath].append((qid, msg))

        for fpath in sorted(by_file.keys()):
            short = fpath.replace('data/부교재/수능특강/영어/', '')
            items = by_file[fpath]
            print(f'\n  {short}:')
            for qid, msg in items:
                print(f'    Q{qid}: {msg}')

    if a_issues:
        print(f'\n═══ A급 에러 ({len(a_issues)}건) ═══')
        by_file = defaultdict(list)
        for fpath, qid, sev, msg in a_issues:
            by_file[fpath].append((qid, msg))
        for fpath in sorted(by_file.keys()):
            short = fpath.replace('data/부교재/수능특강/영어/', '')
            items = by_file[fpath]
            print(f'\n  {short}:')
            for qid, msg in items:
                print(f'    Q{qid}: {msg}')

    print(f'\n═══ 에러 유형별 집계 ═══')
    for t, c in checker.errors_by_type.most_common():
        print(f'  {t}: {c}건')

    return 1 if s_issues else 0

if __name__ == '__main__':
    sys.exit(main())
