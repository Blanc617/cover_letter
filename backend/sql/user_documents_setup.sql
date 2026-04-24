-- ============================================================
-- 사용자 문서 관리 테이블 및 스토리지 설정
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. user_resumes 테이블
CREATE TABLE IF NOT EXISTS user_resumes (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  file_name    TEXT,        -- PDF 원본 파일명
  file_data    TEXT,        -- PDF base64 데이터
  text_content TEXT,        -- 직접 작성 내용 (이력서 폼 JSON 포함)
  category     TEXT DEFAULT '일반',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_resumes" ON user_resumes;
CREATE POLICY "users_own_resumes" ON user_resumes FOR ALL USING (auth.uid() = user_id);
-- 기존 테이블에 컬럼 추가 (이미 실행한 경우)
ALTER TABLE user_resumes ADD COLUMN IF NOT EXISTS file_data TEXT;
ALTER TABLE user_resumes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '일반';

-- 2. user_portfolios 테이블
CREATE TABLE IF NOT EXISTS user_portfolios (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  file_name    TEXT,
  file_data    TEXT,        -- PDF base64 데이터
  text_content TEXT,
  category     TEXT DEFAULT '일반',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_portfolios" ON user_portfolios;
CREATE POLICY "users_own_portfolios" ON user_portfolios FOR ALL USING (auth.uid() = user_id);
-- 기존 테이블에 컬럼 추가 (이미 실행한 경우)
ALTER TABLE user_portfolios ADD COLUMN IF NOT EXISTS file_data TEXT;
ALTER TABLE user_portfolios ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '일반';

-- 3. user_cover_letters 테이블 (직접 작성용)
CREATE TABLE IF NOT EXISTS user_cover_letters (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  company     TEXT,
  position    TEXT,
  content     TEXT NOT NULL,
  category    TEXT DEFAULT '일반',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_cover_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_cover_letters" ON user_cover_letters;
CREATE POLICY "users_own_cover_letters" ON user_cover_letters FOR ALL USING (auth.uid() = user_id);
-- 기존 테이블에 컬럼 추가 (이미 실행한 경우)
ALTER TABLE user_cover_letters ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '일반';

-- 4. cover_letters 테이블 (AI 생성 자소서 히스토리)
CREATE TABLE IF NOT EXISTS cover_letters (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resume_id    BIGINT,
  job_posting  JSONB NOT NULL,   -- { company, position, questions, ... }
  content_json JSONB NOT NULL,   -- [{ question, answer }, ...]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_ai_cover_letters" ON cover_letters;
CREATE POLICY "users_own_ai_cover_letters" ON cover_letters FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 4. Storage 버킷 생성 (이미 있으면 무시)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS 정책
DROP POLICY IF EXISTS "doc_upload" ON storage.objects;
DROP POLICY IF EXISTS "doc_select" ON storage.objects;
DROP POLICY IF EXISTS "doc_delete" ON storage.objects;

CREATE POLICY "doc_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "doc_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "doc_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
