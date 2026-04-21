-- ============================================================
-- 사용자 문서 관리 테이블 및 스토리지 설정
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. user_resumes 테이블
CREATE TABLE IF NOT EXISTS user_resumes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  file_name   TEXT,        -- PDF 원본 파일명
  file_path   TEXT,        -- Supabase Storage 경로
  text_content TEXT,       -- 직접 작성 내용
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_resumes" ON user_resumes;
CREATE POLICY "users_own_resumes" ON user_resumes FOR ALL USING (auth.uid() = user_id);

-- 2. user_portfolios 테이블
CREATE TABLE IF NOT EXISTS user_portfolios (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  file_name   TEXT,
  file_path   TEXT,
  text_content TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_portfolios" ON user_portfolios;
CREATE POLICY "users_own_portfolios" ON user_portfolios FOR ALL USING (auth.uid() = user_id);

-- 3. user_cover_letters 테이블 (직접 작성용)
CREATE TABLE IF NOT EXISTS user_cover_letters (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  company     TEXT,
  position    TEXT,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_cover_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_cover_letters" ON user_cover_letters;
CREATE POLICY "users_own_cover_letters" ON user_cover_letters FOR ALL USING (auth.uid() = user_id);

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
