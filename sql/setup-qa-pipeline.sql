-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 내신해방공식 QA 파이프라인 전체 DB 셋업
-- Supabase Dashboard → SQL Editor에서 한번 실행
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─── 1. answer_overrides (정답 오버라이드) ───
CREATE TABLE IF NOT EXISTS answer_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  original_ans INTEGER,
  corrected_ans INTEGER,
  corrected_by TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, question_index)
);

CREATE INDEX IF NOT EXISTS idx_answer_overrides_scope ON answer_overrides(scope);

ALTER TABLE answer_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ao_anon_select" ON answer_overrides FOR SELECT TO anon USING (true);
CREATE POLICY "ao_anon_insert" ON answer_overrides FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "ao_anon_update" ON answer_overrides FOR UPDATE TO anon USING (true);

-- ─── 2. question_results (문항별 정답/오답 기록) ───
CREATE TABLE IF NOT EXISTS question_results (
  id BIGSERIAL PRIMARY KEY,
  -- 학생 정보
  student_name TEXT NOT NULL,
  school TEXT,
  -- 테스트 정보
  scope TEXT NOT NULL,           -- "교과서/공통영어1/비상홍/1과/본문" 등
  test_type TEXT NOT NULL,       -- "vocab" | "workbook" | "quiz"
  -- 문항 정보
  question_index INTEGER NOT NULL,  -- 1-based
  question_type TEXT,               -- "빈칸어휘", "내용일치" 등
  question_stem TEXT,               -- stem 앞 200자
  correct_ans TEXT,                 -- 출제 정답
  -- 학생 응답
  student_answer TEXT,              -- 학생이 선택/입력한 답
  is_correct BOOLEAN NOT NULL,      -- 정답 여부
  -- 메타
  score_id UUID,                    -- test_scores 레코드 연결용 (optional)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 핵심 인덱스: 문항별 정답률 집계용
CREATE INDEX IF NOT EXISTS idx_qr_scope_qi ON question_results(scope, question_index);
-- 시간순 조회용
CREATE INDEX IF NOT EXISTS idx_qr_created ON question_results(created_at DESC);
-- 학생별 조회용
CREATE INDEX IF NOT EXISTS idx_qr_student ON question_results(student_name, created_at DESC);

ALTER TABLE question_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr_anon_insert" ON question_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "qr_anon_select" ON question_results FOR SELECT TO anon USING (true);

-- ─── 3. error_reports에 created_at 컬럼 추가 (없으면) ───
-- (기존 테이블에 created_at이 없어서 order by 에러났음)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_reports' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE error_reports ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ─── 4. 문항별 정답률 집계 뷰 (의심 문항 감지용) ───
CREATE OR REPLACE VIEW question_accuracy AS
SELECT
  scope,
  question_index,
  question_type,
  question_stem,
  correct_ans,
  COUNT(*) AS total_attempts,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  ) AS accuracy_pct,
  MAX(created_at) AS last_attempt
FROM question_results
GROUP BY scope, question_index, question_type, question_stem, correct_ans;

-- ━━ 완료 ━━
-- 확인: SELECT * FROM question_accuracy WHERE accuracy_pct < 15 ORDER BY total_attempts DESC;
