-- test_reports: 학생 신고 테이블
-- naesinfit Supabase (enkewpvhaugcmyglifkc)
-- 실행: Supabase SQL Editor에 붙여넣고 실행

create table if not exists public.test_reports (
  id           bigserial primary key,
  student_id   text,
  student_name text,
  content_id   text,
  q_id         text,
  file_path    text,
  reason       text,
  screenshot   text,         -- base64 또는 URL
  user_agent   text,
  reported_at  timestamptz not null default now(),
  resolved     boolean      not null default false,
  resolved_at  timestamptz,
  notes        text
);

create index if not exists idx_test_reports_resolved
  on public.test_reports (resolved, reported_at desc);

create index if not exists idx_test_reports_content
  on public.test_reports (content_id, q_id);

-- RLS: 익명 INSERT 허용, SELECT는 service_role만
alter table public.test_reports enable row level security;

drop policy if exists "anon insert" on public.test_reports;
create policy "anon insert"
  on public.test_reports
  for insert
  to anon
  with check (true);

-- 관리자 조회는 service_role 키로만 (anon select 정책 없음)
