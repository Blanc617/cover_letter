"""
자소서 생성 API
POST /api/cover-letter/generate  → 스트리밍 응답
"""

import json
import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic
from openai import OpenAI
from supabase import create_client
from app.config import settings

router = APIRouter()
claude  = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class GenerateRequest(BaseModel):
    job_posting: dict   # analyze_job_posting 결과
    profile: dict       # parse_resume 결과


def get_rag_context(company: str, job_field: str, question: str) -> str:
    """Vector DB에서 유사 합격 자소서 검색"""
    try:
        query = f"회사: {company}\n직군: {job_field}\n문항: {question}"
        embedding_resp = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=query
        )
        embedding = embedding_resp.data[0].embedding

        result = supabase.rpc("search_rag_cover_letters", {
            "query_embedding": embedding,
            "match_company": company,
            "match_job_field": job_field,
            "match_count": 3
        }).execute()

        if not result.data:
            return ""

        contexts = []
        for item in result.data:
            contexts.append(
                f"[합격 사례 - {item['company']} / {item['job_field']}]\n"
                f"문항: {item['question']}\n"
                f"답변: {item['answer']}"
            )
        return "\n\n".join(contexts)

    except Exception:
        return ""


def build_prompt(job_posting: dict, profile: dict, question: str, rag_context: str) -> str:
    profile_text = f"""
이름: {profile.get('name', '')}
기술 스택: {', '.join(profile.get('skills', []))}
경력:
{chr(10).join([f"- {e['company']} / {e['position']} ({e['period']}): {e['description']}" for e in profile.get('experience', [])])}
프로젝트:
{chr(10).join([f"- {p['name']} ({p['period']}): {p['description']}" for p in profile.get('projects', [])])}
학력: {', '.join([f"{e['school']} {e['major']} {e['degree']}" for e in profile.get('education', [])])}
자격증: {', '.join(profile.get('certifications', []))}
    """.strip()

    job_text = f"""
회사: {job_posting.get('company', '')}
직군: {job_posting.get('position', '')}
주요 업무: {job_posting.get('job_description', '')}
자격 요건: {', '.join(job_posting.get('requirements', []))}
우대 사항: {', '.join(job_posting.get('preferred', []))}
    """.strip()

    rag_section = f"\n\n[참고: 유사 합격 자소서 사례]\n{rag_context}" if rag_context else ""

    return f"""당신은 취업 자기소개서 전문 작가입니다. 아래 정보를 바탕으로 자기소개서 문항에 대한 답변을 작성해주세요.

[지원자 프로필]
{profile_text}

[채용 공고]
{job_text}{rag_section}

[작성 규칙]
- 지원자의 실제 경험과 역량을 구체적으로 녹여낼 것
- 해당 기업과 직무에 맞는 내용으로 커스터마이징할 것
- 자연스럽고 진정성 있는 문체로 작성할 것
- 800~1000자 내외로 작성할 것
- 두괄식 구성으로 핵심 내용을 먼저 서술할 것

[자소서 문항]
{question}

위 문항에 대한 자기소개서 답변을 작성해주세요."""


async def stream_cover_letter(job_posting: dict, profile: dict):
    questions = job_posting.get("questions", [])
    company   = job_posting.get("company", "")
    job_field = job_posting.get("position", "")

    if not questions:
        questions = ["자유 형식 자기소개서를 작성해주세요."]

    for i, question in enumerate(questions):
        yield f"data: {json.dumps({'type': 'question_start', 'index': i, 'question': question}, ensure_ascii=False)}\n\n"

        rag_context = get_rag_context(company, job_field, question)
        prompt = build_prompt(job_posting, profile, question, rag_context)

        with claude.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': text}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'question_end', 'index': i}, ensure_ascii=False)}\n\n"

    yield "data: {\"type\": \"done\"}\n\n"


@router.post("/generate")
async def generate_cover_letter(request: GenerateRequest):
    return StreamingResponse(
        stream_cover_letter(request.job_posting, request.profile),
        media_type="text/event-stream"
    )
