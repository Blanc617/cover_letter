-- pgvector 확장 활성화 (Supabase 대시보드에서 먼저 활성화 필요)
create extension if not exists vector;

-- 기존 테이블/함수 제거 후 재생성 (BGE-M3 1024차원으로 통일)
drop function if exists search_rag_cover_letters;
drop table if exists rag_cover_letters;

-- 합격 자소서 RAG 테이블
create table rag_cover_letters (
    id          bigserial primary key,
    company     text not null,           -- 회사명
    job_field   text not null,           -- 직군
    question    text not null,           -- 자소서 문항
    answer      text not null,           -- 자소서 답변
    embedding   vector(1024),            -- BAAI/bge-m3
    created_at  timestamptz default now()
);

-- 유사도 검색 인덱스 (IVFFlat, 100개 정도면 충분)
create index if not exists rag_cover_letters_embedding_idx
    on rag_cover_letters
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 10);

-- 유사도 검색 함수
create or replace function search_rag_cover_letters(
    query_embedding vector(1024),
    match_company   text default null,
    match_job_field text default null,
    match_count     int  default 5
)
returns table (
    id          bigint,
    company     text,
    job_field   text,
    question    text,
    answer      text,
    similarity  float
)
language sql stable
as $$
    select
        id,
        company,
        job_field,
        question,
        answer,
        1 - (embedding <=> query_embedding) as similarity
    from rag_cover_letters
    where
        (match_company   is null or company   ilike '%' || match_company   || '%')
        and
        (match_job_field is null or job_field ilike '%' || match_job_field || '%')
    order by embedding <=> query_embedding
    limit match_count;
$$;
