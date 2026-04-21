-- pgvector 확장 활성화
create extension if not exists vector;

-- 합격 자소서 테이블 (RAG용)
create table if not exists rag_documents (
    id          bigserial primary key,
    company     text not null,
    position    text not null,
    question    text not null,
    answer      text not null,
    embedding   vector(1024),
    created_at  timestamptz default now()
);

-- 유사도 검색 함수
create or replace function search_rag_cover_letters(
    query_embedding vector(1024),
    match_company   text,
    match_job_field text,
    match_count     int default 3
)
returns table (
    id       bigint,
    company  text,
    job_field text,
    question text,
    answer   text,
    similarity float
)
language sql stable
as $$
    select
        id,
        company,
        position as job_field,
        question,
        answer,
        1 - (embedding <=> query_embedding) as similarity
    from rag_documents
    where
        (match_company = '' or company ilike '%' || match_company || '%')
        and (match_job_field = '' or position ilike '%' || match_job_field || '%')
    order by embedding <=> query_embedding
    limit match_count;
$$;
