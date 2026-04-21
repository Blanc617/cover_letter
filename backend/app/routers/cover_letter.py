"""
자소서 생성 API
POST /api/cover-letter/generate  → 스트리밍 응답
"""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic
from sentence_transformers import SentenceTransformer
from supabase import create_client
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()
claude = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# BGE-M3 모델 로드 (최초 1회)
embedding_model = SentenceTransformer("BAAI/bge-m3")


class GenerateRequest(BaseModel):
    job_posting: dict
    profile: dict
    prev_cover_letter: str | None = None
    reference_letter_ids: list[int] | None = None


def get_rag_context(company: str, job_field: str, question: str) -> str:
    """Vector DB에서 유사 합격 자소서 검색"""
    try:
        query = f"회사: {company}\n직군: {job_field}\n문항: {question}"
        embedding = embedding_model.encode(query).tolist()

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


def get_user_style_context(user_id: str, reference_ids: list[int] | None = None) -> str:
    """사용자가 지정한(또는 최근) 자소서에서 스타일과 강점 방향성 추출"""
    try:
        query = supabase.table("user_cover_letters") \
            .select("title, company, position, content") \
            .eq("user_id", user_id)

        if reference_ids:
            # 사용자가 직접 지정한 자소서만 사용
            query = query.in_("id", reference_ids)
        else:
            # 지정 없으면 사용 안 함 (건너뛰기 선택)
            return ""

        result = query.execute()

        if not result.data:
            return ""

        examples = []
        for item in result.data:
            content = item["content"][:1000] + "..." if len(item["content"]) > 1000 else item["content"]
            label = f"{item['company']} - {item['position']}" if item.get("company") else item.get("title", "자소서")
            examples.append(f"[{label}]\n{content}")

        return "\n\n".join(examples)

    except Exception:
        return ""


def get_user_documents_context(user_id: str) -> tuple[str, str]:
    """사용자가 저장한 이력서·포트폴리오 텍스트 반환 (resume_ctx, portfolio_ctx)"""
    def fetch_texts(table: str, limit: int) -> str:
        try:
            result = supabase.table(table) \
                .select("title, file_name, text_content") \
                .eq("user_id", user_id) \
                .order("created_at", desc=True) \
                .limit(limit) \
                .execute()

            parts = []
            for item in result.data or []:
                text = item.get("text_content") or ""
                if not text:
                    continue
                # form JSON이면 그냥 텍스트로 덤프 (키값 포함)
                try:
                    import json as _json
                    parsed = _json.loads(text)
                    if isinstance(parsed, dict):
                        text = _json.dumps(parsed, ensure_ascii=False, indent=1)
                except Exception:
                    pass
                text = text[:1000] + "..." if len(text) > 1000 else text
                label = item.get("title") or item.get("file_name") or "문서"
                parts.append(f"[{label}]\n{text}")
            return "\n\n".join(parts)
        except Exception:
            return ""

    resume_ctx    = fetch_texts("user_resumes", 2)
    portfolio_ctx = fetch_texts("user_portfolios", 2)
    return resume_ctx, portfolio_ctx


def build_prompt(
    job_posting: dict,
    profile: dict,
    question: str,
    rag_context: str,
    prev_cover_letter: str | None = None,
    user_style_context: str = "",
    user_resume_context: str = "",
    user_portfolio_context: str = "",
) -> str:
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

    resume_section = (
        f"\n\n[지원자의 저장된 이력서 — 경력·프로젝트·역량 상세 참고]\n{user_resume_context}"
        if user_resume_context else ""
    )
    portfolio_section = (
        f"\n\n[지원자의 저장된 포트폴리오 — 프로젝트 상세 및 기술 역량 참고]\n{user_portfolio_context}"
        if user_portfolio_context else ""
    )
    style_section = (
        f"\n\n[지원자의 기존 자소서 — 문체·강점 방향성·표현 습관을 파악하여 동일한 스타일로 작성]\n{user_style_context}"
        if user_style_context else ""
    )
    prev_section = (
        f"\n\n[지원자가 직접 제공한 참고 자소서 — 문체와 표현 방식 참고]\n{prev_cover_letter}"
        if prev_cover_letter else ""
    )
    rag_section = (
        f"\n\n[유사 합격 자소서 사례 — 구조와 완성도 참고]\n{rag_context}"
        if rag_context else ""
    )

    return f"""당신은 취업 자기소개서 전문 작가입니다. 아래 정보를 바탕으로 자기소개서 문항에 대한 답변을 작성해주세요.

[지원자 프로필]
{profile_text}

[채용 공고]
{job_text}{resume_section}{portfolio_section}{style_section}{prev_section}{rag_section}

[작성 규칙]
- 지원자의 실제 경험과 역량을 구체적으로 녹여낼 것
- 저장된 이력서·포트폴리오가 있다면 거기서 구체적인 수치·성과·프로젝트 내용을 적극 활용할 것
- 해당 기업과 직무에 맞는 내용으로 커스터마이징할 것
- 기존 자소서가 있다면 그 문체·어조·강조점을 최대한 반영할 것
- 자연스럽고 진정성 있는 문체로 작성할 것
- 800~1000자 내외로 작성할 것
- 두괄식 구성으로 핵심 내용을 먼저 서술할 것

[자소서 문항]
{question}

위 문항에 대한 자기소개서 답변을 작성해주세요."""


async def stream_cover_letter(
    job_posting: dict,
    profile: dict,
    prev_cover_letter: str | None,
    user_id: str,
    reference_letter_ids: list[int] | None = None,
):
    questions = job_posting.get("questions", [])
    company   = job_posting.get("company", "")
    job_field = job_posting.get("position", "")

    if not questions:
        questions = ["자유 형식 자기소개서를 작성해주세요."]

    # 사용자 데이터 1회 조회 (문항 반복마다 재조회 불필요)
    user_style_context = get_user_style_context(user_id, reference_letter_ids)
    user_resume_ctx, user_portfolio_ctx = get_user_documents_context(user_id)

    for i, question in enumerate(questions):
        yield f"data: {json.dumps({'type': 'question_start', 'index': i, 'question': question}, ensure_ascii=False)}\n\n"

        rag_context = get_rag_context(company, job_field, question)
        prompt = build_prompt(
            job_posting, profile, question,
            rag_context, prev_cover_letter,
            user_style_context, user_resume_ctx, user_portfolio_ctx,
        )

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
async def generate_cover_letter(request: GenerateRequest, user_id: str = Depends(get_current_user)):
    return StreamingResponse(
        stream_cover_letter(
            request.job_posting,
            request.profile,
            request.prev_cover_letter,
            user_id,
            request.reference_letter_ids,
        ),
        media_type="text/event-stream"
    )
