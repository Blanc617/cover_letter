"""
자소서 생성 API — 3단계 파이프라인
POST /api/cover-letter/generate  → 스트리밍 응답

[1단계] 회사 웹 검색 → Claude가 회사 컨텍스트 요약
[2단계] 회사 컨텍스트 + 사용자 프로필 → Claude가 강조할 경험 선별
[3단계] 선별된 컨텍스트로 자소서 생성 (스트리밍)
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import Anthropic

logger = logging.getLogger(__name__)
from sentence_transformers import SentenceTransformer
from supabase import create_client
from app.config import settings
from app.dependencies import get_current_user
from app.services.company_research import research_company
from app.services.context_synthesizer import synthesize_company_context, match_user_to_company, analyze_user_style, map_questions_to_experiences

router = APIRouter()
claude = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

embedding_model = SentenceTransformer("BAAI/bge-m3")


class GenerateRequest(BaseModel):
    job_posting: dict
    profile: dict
    prev_cover_letter: str | None = None
    reference_letter_ids: list[int] | None = None
    user_drafts: list[dict] | None = None  # [{"question": "...", "draft": "..."}]


def get_rag_context(company: str, job_field: str, question: str, is_freeform: bool = False) -> str:
    """Vector DB에서 유사 합격 자소서 검색

    - 특정 질문: 회사 + 직군 + 문항 기반으로 유사 사례 3개
    - 자유형식: 직군 기반으로 구성 참고할 사례 5개 (회사·질문 필터 없음)
    """
    try:
        if is_freeform:
            # 자유형식: 같은 직군의 합격 자소서 구성 참고
            query = f"직군: {job_field} 자기소개서 경험 역량 성과 지원 동기"
            embedding = embedding_model.encode(query).tolist()
            result = supabase.rpc("search_rag_cover_letters", {
                "query_embedding": embedding,
                "match_company": None,
                "match_job_field": job_field,
                "match_count": 5
            }).execute()
        else:
            # 특정 질문: 회사 + 직군 + 문항 유사도 기반 검색
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
    """사용자가 지정한 자소서에서 스타일 추출"""
    try:
        if not reference_ids:
            return ""

        result = supabase.table("user_cover_letters") \
            .select("title, company, position, content") \
            .eq("user_id", user_id) \
            .in_("id", reference_ids) \
            .execute()

        if not result.data:
            return ""

        examples = []
        for item in result.data:
            content = item["content"][:2000] + "..." if len(item["content"]) > 2000 else item["content"]
            label = f"{item['company']} - {item['position']}" if item.get("company") else item.get("title", "자소서")
            examples.append(f"[{label}]\n{content}")

        return "\n\n".join(examples)

    except Exception:
        return ""


def get_user_documents_context(user_id: str) -> tuple[str, str]:
    """사용자의 이력서·포트폴리오 텍스트 반환"""
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

    return fetch_texts("user_resumes", 2), fetch_texts("user_portfolios", 2)


def build_prompt(
    job_posting: dict,
    profile: dict,
    question: str,
    company_context: str,
    experience_match: str,
    rag_context: str,
    prev_cover_letter: str | None,
    user_style_context: str,
    portfolio_context: str = "",
    user_draft: str = "",
    is_freeform: bool = False,
    already_written: list[dict] | None = None,
    question_guidance: str = "",
    char_limit: str = "",
) -> str:
    portfolio_section = f"\n포트폴리오 원문:\n{portfolio_context}" if portfolio_context else ""
    activities_text = ", ".join(profile.get("activities", [])) if profile.get("activities") else ""
    activities_line = f"\n활동: {activities_text}" if activities_text else ""
    profile_text = f"""
이름: {profile.get('name', '')}
기술 스택: {', '.join(profile.get('skills', []))}
경력:
{chr(10).join([f"- {e['company']} / {e['position']} ({e['period']}): {e['description']}" for e in profile.get('experience', [])])}
프로젝트:
{chr(10).join([f"- {p['name']} ({p['period']}): {p['description']}" for p in profile.get('projects', [])])}
학력: {', '.join([f"{e['school']} {e['major']} {e['degree']}" for e in profile.get('education', [])])}
자격증: {', '.join(profile.get('certifications', []))}{activities_line}{portfolio_section}
    """.strip()

    job_text = f"""
회사: {job_posting.get('company', '')}
직군: {job_posting.get('position', '')}
주요 업무: {job_posting.get('job_description', '')}
자격 요건: {', '.join(job_posting.get('requirements', []))}
우대 사항: {', '.join(job_posting.get('preferred', []))}
    """.strip()

    company = job_posting.get('company', '')
    position = job_posting.get('position', '')

    company_section = (
        f"\n\n[회사 분석 — 이 회사가 원하는 것, 문화, 방향성]\n{company_context}"
        if company_context else ""
    )
    match_section = (
        f"\n\n[지원자 경험 매칭 분석 — 이 회사에 강조할 경험과 방향성]\n{experience_match}"
        if experience_match else ""
    )
    style_section = (
        f"\n\n[지원자 글쓰기 분석 결과 — 이 스타일·경험·방향성을 반드시 그대로 따를 것]\n{user_style_context}"
        if user_style_context else ""
    )
    prev_section = (
        f"\n\n[지원자가 직접 제공한 참고 자소서 — 이 사람의 글쓰기 패턴을 반드시 따를 것]\n{prev_cover_letter}"
        if prev_cover_letter else ""
    )
    if rag_context:
        if is_freeform:
            rag_section = (
                f"\n\n[합격 자소서 구성 참고 — 자유형식 작성 가이드]\n"
                f"아래 합격 사례들을 분석하여 서론-본론-결론 흐름, 단락 구성 방식, 마무리 패턴을 파악하고 동일한 구조로 작성할 것.\n"
                f"· 서론: 첫 문장에서 자신을 어떻게 정의하는지 (핵심 역량 선언 / 경험 에피소드 시작 / 문제 제기)\n"
                f"· 본론: 경험을 어떻게 구체화하는지 (사건→행동→결과, 수치 활용, 소제목 방식)\n"
                f"· 결론: 지원 동기·입사 후 기여를 어떻게 연결하는지\n\n"
                f"{rag_context}"
            )
        else:
            rag_section = f"\n\n[유사 합격 자소서 사례 — 구조·완성도 참고]\n{rag_context}"
    else:
        rag_section = ""

    draft_section = (
        f"\n\n[지원자가 직접 작성한 초안]\n{user_draft}"
        if user_draft else ""
    )

    question_guidance_section = (
        f"\n\n[이 문항 전용 작성 가이드 — 아래 소재와 메시지를 중심으로 작성할 것]\n{question_guidance}"
        if question_guidance else ""
    )

    # 이미 작성된 문항 목록 (중복 방지용)
    if already_written:
        already_written_lines = "\n\n".join([
            f"문항 {i+1}: {item['question']}\n요약: {item['answer'][:300]}..."
            for i, item in enumerate(already_written)
        ])
        already_written_section = (
            f"\n\n[이미 작성 완료된 문항 — 아래에 사용된 경험·사례·표현은 이 문항에서 절대 반복하지 말 것]\n"
            f"{already_written_lines}"
        )
    else:
        already_written_section = ""

    # 글자 수 제한: 사용자 지정값 우선, 없으면 기본값
    if char_limit:
        word_count = f"{char_limit} (회사 지정 글자 수 제한 — 반드시 이 범위 안에서 작성할 것. 초과 절대 금지)"
    elif is_freeform:
        word_count = "전체 900~1200자 (단락 합산 기준. 절대 초과 금지)"
    else:
        word_count = "전체 700~1000자 (단락 합산 기준)"

    # 단락 구조 가이드 — 글자 수 제한이 있으면 각 단락 비율로 조정
    if char_limit:
        structure_guide = f"""글자 수 제한({char_limit})에 맞춰 아래 비율로 3단락 구성:
단락 1 (전체의 약 20%): 이 문항의 핵심 답변 두괄식 제시
단락 2 (전체의 약 55%): 핵심 근거 경험을 STAR 구조로 전개
  S(상황): 어떤 상황/과제였는지
  A(행동): 구체적 행동, 수치 포함
  R(결과): 측정 가능한 성과
단락 3 (전체의 약 25%): 이 직무·회사와의 연결 + 기여 방향
글자 수 제한이 짧은 경우(300자 이내) 단락 2를 중심으로 간결하게 압축"""
    elif is_freeform:
        structure_guide = """단락 1 (200~280자): 강한 첫 문장으로 시작. 지원자를 정의하는 핵심 역량·경험 선언 + 구체적 수치나 에피소드로 즉시 뒷받침
단락 2 (350~450자): 가장 강력한 경험 1개를 STAR 구조로 전개
  S(상황): 어떤 맥락/문제가 있었는지 (1~2문장)
  A(행동): 지원자가 구체적으로 취한 행동, 수치 포함 (2~3문장)
  R(결과): 측정 가능한 결과 또는 의미 있는 변화 (1~2문장)
단락 3 (200~300자): 두 번째 경험·역량을 간결하게 서술 (STAR 압축형)
단락 4 (150~200자): 이 회사를 선택한 구체적 이유 + 입사 후 첫 1년 기여 방향"""
    else:
        structure_guide = """단락 1 (150~200자): 이 문항의 핵심 답변 먼저 제시 (두괄식). 관련성 가장 높은 경험·역량을 한 줄로 선언
단락 2 (350~450자): 핵심 근거 경험 1개를 STAR 구조로 전개
  S(상황): 어떤 상황/과제/문제였는지 (1~2문장)
  A(행동): 지원자가 구체적으로 취한 행동, 수치 포함 (2~3문장)
  R(결과): 측정 가능한 결과 (1~2문장)
단락 3 (200~300자): 이 경험이 이 직무·회사에 어떻게 연결되는지 + 입사 후 구체적 기여 방향"""

    no_style_note_section = (
        "\n• 참고 자소서가 없으므로 정형화된 문체 대신 담백하고 직접적인 문장으로 작성"
        if not (user_style_context or prev_cover_letter or user_draft) else ""
    )
    draft_priority_section = (
        f"\n[최우선 반영 — 지원자 초안]\n초안의 경험·사건·판단은 그대로 유지하고 완성도와 구체성만 높일 것:\n{user_draft}\n"
        if user_draft else ""
    )

    return f"""당신은 대한민국 대기업 서류전형 합격 자소서를 전문으로 쓰는 작가입니다.

━━━ 이번에 작성할 자소서 문항 ━━━
{question}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[지원자 프로필]
{profile_text}

[채용 공고]
{job_text}{company_section}{match_section}{question_guidance_section}{style_section}{prev_section}{draft_section}{already_written_section}{rag_section}

━━━ 합격 자소서의 3가지 기준 ━━━
이 답변은 아래 3가지를 반드시 충족해야 합니다:
① 구체성: 모든 주장에 실제 사건·수치·결과가 뒷받침됨. "열심히 했다" → "N개월 동안 N건을 직접 처리해 N% 향상"
② 차별성: {company}의 {position}에 지원하는 이 사람만 쓸 수 있는 내용. 업무·경험·관점이 구체적으로 드러남
③ 진정성: 프로필에 실제 있는 경험만 사용. 없는 사실 창작 금지

━━━ 작성 구조 ({word_count}) ━━━
{structure_guide}

━━━ 절대 금지 ━━━
• "이를 통해", "이러한 경험을 바탕으로", "뿐만 아니라"로만 시작하는 문장 반복
• "열정", "도전", "성장", "기여", "시너지"를 구체성 없는 추상 결론으로 사용
• 매 문단 "~을 통해 성장했습니다" / "~하는 인재가 되겠습니다" 식 마무리 반복
• 어느 지원자나 쓸 수 있는 범용 표현 ("신뢰 기반", "소통 역량", "적극적 자세", "끊임없이 노력")
• 이미 작성된 다른 문항에서 사용한 경험·에피소드 재사용{no_style_note_section}
{draft_priority_section}
답변 본문만 출력하세요. 제목·설명·메타 코멘트 없이 자소서 내용만 작성하세요."""


async def stream_cover_letter(
    job_posting: dict,
    profile: dict,
    prev_cover_letter: str | None,
    user_id: str,
    reference_letter_ids: list[int] | None = None,
    user_drafts: list[dict] | None = None,
):
    company = job_posting.get("company", "")

    # ── 문항 결정: 5단계 사용자 입력 > 공고 파싱 결과 > 자유형식 ──
    user_questions = [
        item.get("question", "").strip()
        for item in (user_drafts or [])
        if item.get("question", "").strip()
    ]
    if user_questions:
        questions = user_questions
    else:
        questions = job_posting.get("questions", []) or ["자유 형식 자기소개서를 작성해주세요."]

    # ── 1단계: 회사 컨텍스트 수집 및 요약 ──────────────────────────
    yield f"data: {json.dumps({'type': 'stage', 'stage': 1, 'message': '회사 정보 분석 중...'}, ensure_ascii=False)}\n\n"

    raw_research = research_company(company) if company else ""
    company_context = synthesize_company_context(company, job_posting, raw_research) if company else ""

    # ── 2단계: 사용자 경험 매칭 ────────────────────────────────────
    yield f"data: {json.dumps({'type': 'stage', 'stage': 2, 'message': '지원자 경험 분석 중...'}, ensure_ascii=False)}\n\n"

    user_resume_ctx, user_portfolio_ctx = get_user_documents_context(user_id)
    experience_match = match_user_to_company(
        company_context, profile,
        user_resume_ctx, user_portfolio_ctx,
        job_posting,
        questions,
    ) if company_context or user_resume_ctx or user_portfolio_ctx else ""

    # 자유형식 여부 판단
    is_freeform = not bool(user_questions) and not bool([q for q in job_posting.get("questions", []) if str(q).strip()])

    yield f"data: {json.dumps({'type': 'meta', 'is_freeform': is_freeform}, ensure_ascii=False)}\n\n"

    # ── 2-1단계: 문항별 경험·소재 사전 배정 (복수 문항인 경우) ──────
    question_guidance_map: dict[str, str] = {}
    if not is_freeform and len(questions) > 1:
        question_guidance_map = map_questions_to_experiences(questions, profile, experience_match)

    # ── 3단계: 자소서 생성 (문항별 스트리밍) ───────────────────────
    user_letters_raw = get_user_style_context(user_id, reference_letter_ids)
    letters_for_analysis = []
    if user_letters_raw:
        letters_for_analysis.append(user_letters_raw)
    if prev_cover_letter:
        letters_for_analysis.append(prev_cover_letter)
    user_style_context = (
        analyze_user_style("\n\n---\n\n".join(letters_for_analysis))
        if letters_for_analysis else ""
    )

    # 초안 매핑
    draft_map: dict[str, str] = {}
    draft_map_char_limit: dict[str, str] = {}
    freeform_draft = ""
    if user_drafts:
        if user_questions:
            for item in user_drafts:
                q = item.get("question", "").strip()
                d = item.get("draft", "").strip()
                cl = item.get("char_limit", "").strip()
                if q:
                    draft_map[q] = d
                    if cl:
                        draft_map_char_limit[q] = cl
        else:
            # 자유형식: question이 빈 문자열인 경우 draft만 추출
            for item in user_drafts:
                d = item.get("draft", "").strip()
                if d:
                    freeform_draft = d
                    break
            # question이 있는 경우도 처리
            for item in user_drafts:
                q = item.get("question", "").strip()
                d = item.get("draft", "").strip()
                cl = item.get("char_limit", "").strip()
                if q and d:
                    draft_map[q] = d
                if q and cl:
                    draft_map_char_limit[q] = cl

    already_written: list[dict] = []

    try:
        for i, question in enumerate(questions):
            yield f"data: {json.dumps({'type': 'question_start', 'index': i, 'question': question}, ensure_ascii=False)}\n\n"

            rag_context = get_rag_context(company, job_posting.get("position", ""), question, is_freeform)
            portfolio_ctx_for_prompt = profile.get("portfolio_text") or user_portfolio_ctx
            user_draft = draft_map.get(question, "") or (freeform_draft if is_freeform else "")
            question_guidance = question_guidance_map.get(question, "")
            char_limit = draft_map_char_limit.get(question, "")
            prompt = build_prompt(
                job_posting, profile, question,
                company_context, experience_match,
                rag_context, prev_cover_letter,
                user_style_context,
                portfolio_ctx_for_prompt,
                user_draft,
                is_freeform,
                already_written if already_written else None,
                question_guidance,
                char_limit,
            )

            # 글자 수 제한이 있으면 해당 분량에 맞게 토큰 조정 (한국어 1자 ≈ 1.5토큰)
            if char_limit:
                import re as _re
                nums = [int(n) for n in _re.findall(r'\d+', char_limit)]
                target_chars = max(nums) if nums else 1000
                max_tokens = max(800, int(target_chars * 1.8))
            else:
                max_tokens = 1600 if is_freeform else 1700
            answer_buffer = []
            with claude.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                for text in stream.text_stream:
                    answer_buffer.append(text)
                    yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': text}, ensure_ascii=False)}\n\n"

            already_written.append({"question": question, "answer": "".join(answer_buffer)})
            yield f"data: {json.dumps({'type': 'question_end', 'index': i}, ensure_ascii=False)}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    except Exception as e:
        logger.error("stream_cover_letter error: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': '자소서 생성 중 오류가 발생했습니다.'}, ensure_ascii=False)}\n\n"


@router.post("/generate")
async def generate_cover_letter(request: GenerateRequest, user_id: str = Depends(get_current_user)):
    return StreamingResponse(
        stream_cover_letter(
            request.job_posting,
            request.profile,
            request.prev_cover_letter,
            user_id,
            request.reference_letter_ids,
            request.user_drafts,
        ),
        media_type="text/event-stream"
    )


class ReviseRequest(BaseModel):
    results: list[dict]  # [{"question": "...", "answer": "..."}]
    feedback: str
    job_posting: dict
    profile: dict


async def stream_revision(results: list[dict], feedback: str, job_posting: dict):
    company = job_posting.get("company", "")
    position = job_posting.get("position", "")

    # 자유형식 판단: 문항이 기본 자유형식 문구인 경우
    is_freeform = len(results) == 1 and "자유 형식" in results[0].get("question", "")

    for i, item in enumerate(results):
        question = item.get("question", "")
        original_answer = item.get("answer", "")

        yield f"data: {json.dumps({'type': 'question_start', 'index': i, 'question': question}, ensure_ascii=False)}\n\n"

        length_rule = (
            "- 분량: 850~1200자 (이 범위를 반드시 지킬 것. 1200자 초과 절대 금지)\n"
            if is_freeform else
            "- 분량: 원문과 유사한 분량 유지\n"
        )

        prompt = f"""당신은 자기소개서 수정 전문가입니다. 아래 자기소개서를 사용자의 피드백에 맞게 수정해주세요.

[지원 정보]
회사: {company}
직무: {position}

[문항]
{question}

[기존 답변]
{original_answer}

[사용자 수정 요청]
{feedback}

[수정 규칙]
- 피드백에서 언급된 부분만 수정하고, 나머지는 최대한 원문 그대로 유지할 것
- 전체적인 흐름과 글쓰기 스타일을 유지할 것
- 없는 경험이나 사실을 추가로 창작하지 말 것
{length_rule}- 답변 본문만 출력하고 설명이나 메타 코멘트는 절대 포함하지 말 것"""

        try:
            with claude.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': text}, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error("stream_revision error at question %d: %s", i, e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': '수정 중 오류가 발생했습니다.'}, ensure_ascii=False)}\n\n"
            return

        yield f"data: {json.dumps({'type': 'question_end', 'index': i}, ensure_ascii=False)}\n\n"

    yield 'data: {"type": "done"}\n\n'


@router.post("/revise")
async def revise_cover_letter(request: ReviseRequest, user_id: str = Depends(get_current_user)):
    return StreamingResponse(
        stream_revision(request.results, request.feedback, request.job_posting),
        media_type="text/event-stream"
    )


class EvaluateRequest(BaseModel):
    results: list[dict]
    job_posting: dict


@router.post("/evaluate")
async def evaluate_cover_letter(request: EvaluateRequest, user_id: str = Depends(get_current_user)):
    import re

    company = request.job_posting.get("company", "")
    position = request.job_posting.get("position", "")

    all_content = "\n\n".join([
        f"[문항 {i + 1}]\n질문: {r.get('question', '')}\n답변: {r.get('answer', '')}"
        for i, r in enumerate(request.results)
    ])

    prompt = f"""아래 자기소개서를 5가지 기준으로 평가해주세요.

[지원 정보]
회사: {company}
직무: {position}

[자기소개서]
{all_content}

다음 JSON 형식으로만 응답하세요 (다른 텍스트나 마크다운 코드블록 없이 순수 JSON만):
{{
  "criteria": [
    {{"name": "직무 적합성", "score": <1~10 정수>, "good": "<잘된 점 1~2문장>", "weak": "<개선점 1~2문장>"}},
    {{"name": "구체성", "score": <1~10 정수>, "good": "<잘된 점 1~2문장>", "weak": "<개선점 1~2문장>"}},
    {{"name": "논리적 구성", "score": <1~10 정수>, "good": "<잘된 점 1~2문장>", "weak": "<개선점 1~2문장>"}},
    {{"name": "차별성", "score": <1~10 정수>, "good": "<잘된 점 1~2문장>", "weak": "<개선점 1~2문장>"}},
    {{"name": "진정성", "score": <1~10 정수>, "good": "<잘된 점 1~2문장>", "weak": "<개선점 1~2문장>"}}
  ]
}}"""

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("evaluate JSON parse error: %s | raw: %s", e, text[:200])
        raise HTTPException(status_code=500, detail="평가 결과 파싱에 실패했습니다.")
    except Exception as e:
        logger.error("evaluate_cover_letter error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="자소서 평가 중 오류가 발생했습니다.")
