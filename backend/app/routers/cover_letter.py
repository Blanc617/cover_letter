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


def get_item_char_limit(item: dict) -> str:
    min_chars = item.get("min_chars")
    max_chars = item.get("max_chars")
    try:
        min_chars = int(min_chars) if min_chars not in (None, "") else None
    except (TypeError, ValueError):
        min_chars = None
    try:
        max_chars = int(max_chars) if max_chars not in (None, "") else None
    except (TypeError, ValueError):
        max_chars = None

    if min_chars is not None and max_chars is not None:
        return f"{min_chars}~{max_chars}자"
    if max_chars is not None:
        return f"{max_chars}자 이내"
    if min_chars is not None:
        return f"{min_chars}자 이상"
    return (item.get("char_limit") or "").strip()


def parse_char_limit(char_limit: str) -> tuple[int | None, int | None]:
    """Return (min_chars, max_chars) parsed from UI text such as 300~500."""
    import re

    nums = [int(n) for n in re.findall(r"\d+", char_limit or "")]
    if not nums:
        return None, None
    if len(nums) == 1:
        lowered = (char_limit or "").lower()
        if "min" in lowered or "least" in lowered or "이상" in char_limit:
            return nums[0], None
        return None, nums[0]
    return min(nums), max(nums)


def answer_char_count(text: str) -> int:
    """Match the frontend textarea counter closely: count visible string length."""
    return len((text or "").strip())


def trim_to_max_chars(text: str, max_chars: int, min_chars: int | None = None) -> str:
    text = (text or "").strip()
    if len(text) <= max_chars:
        return text
    trimmed = text[:max_chars].rstrip()
    for sep in [". ", "\n", "다. ", "요. ", "니다. "]:
        idx = trimmed.rfind(sep)
        if idx >= max(0, int(max_chars * 0.65)):
            candidate = trimmed[: idx + len(sep)].strip()
            if min_chars is None or len(candidate) >= min_chars:
                return candidate
    return trimmed


def char_limit_status(text: str, min_chars: int | None, max_chars: int | None) -> tuple[bool, int]:
    count = answer_char_count(text)
    if min_chars is not None and count < min_chars:
        return False, count
    if max_chars is not None and count > max_chars:
        return False, count
    return True, count


def char_limit_label(min_chars: int | None, max_chars: int | None) -> str:
    if min_chars is not None and max_chars is not None:
        return f"{min_chars}자 이상 {max_chars}자 이하"
    if max_chars is not None:
        return f"{max_chars}자 이하"
    if min_chars is not None:
        return f"{min_chars}자 이상"
    return "제한 없음"


def build_char_limit_instruction(min_chars: int | None, max_chars: int | None) -> str:
    if min_chars is None and max_chars is None:
        return ""
    label = char_limit_label(min_chars, max_chars)
    return (
        "\n\n[MANDATORY CHARACTER LIMIT]\n"
        f"- Final answer length must be {label}.\n"
        "- Count every Korean character, English letter, number, space, and newline as 1 character.\n"
        "- Do not exceed the maximum under any circumstance.\n"
        "- If the draft is too long, remove secondary details and keep the strongest evidence.\n"
        "- Output only the finished cover-letter answer body."
    )


def final_char_limit_fallback(text: str, max_chars: int, min_chars: int | None = None) -> str:
    """Deterministic last guard: never return text longer than max_chars."""
    text = (text or "").strip()
    if answer_char_count(text) <= max_chars:
        return text
    trimmed = text[:max_chars].rstrip()
    for sep in ["\n\n", "\n", ". ", "다. ", "요. ", "니다. "]:
        idx = trimmed.rfind(sep)
        if idx >= max(0, int(max_chars * 0.75)):
            end = idx + len(sep)
            candidate = trimmed[:end].strip()
            if min_chars is None or answer_char_count(candidate) >= min_chars:
                return candidate
    return trimmed


def is_company_motivation_question(question: str, index: int | None = None) -> bool:
    q = (question or "").replace(" ", "").lower()
    keywords = [
        "지원동기", "지원하게된동기", "지원하게된이유", "지원한동기", "지원이유",
        "왜우리회사", "왜당사", "왜이회사", "당사에지원", "회사에지원",
        "입사후", "포부", "회사선택", "선택한이유", "관심을가지게",
        "why", "motivation", "reasonforapplying",
    ]
    if any(k in q for k in keywords):
        return True
    return index == 0 and any(k in q for k in ["회사", "기업", "당사", "입사", "지원"])


def build_question_strategy(
    question: str,
    company: str,
    position: str,
    index: int,
    is_motivation: bool,
) -> str:
    if is_motivation:
        return f"""

[문항 전략 — 지원동기/회사 이해 중심]
- 이 문항은 경험 자랑이 아니라 "왜 {company}인가"와 "왜 {position}인가"를 설득하는 답변이다.
- 첫 문단 이후에도 회사의 사업 방향, 일하는 방식, 직무 과제와 연결된 내용이 계속 살아 있어야 한다.
- 이력서·포트폴리오의 프로젝트는 최대 1개만 짧게 사용한다. 프로젝트 설명이 본문 절반을 넘으면 실패다.
- 구조: ① {company}를 선택한 구체적 이유 → ② 그 이유와 맞닿은 지원자의 관점/경험 1개 → ③ 입사 후 기여 방향.
- 회사 정보는 홍보 문구처럼 나열하지 말고, 지원자가 그 지점에 끌린 이유와 직무 기여 방식으로 연결한다.
"""
    return f"""

[문항 전략 — 소재 중복 방지]
- 이 문항에서는 하나의 핵심 경험 또는 프로젝트만 깊게 사용한다.
- 이력서·포트폴리오에 있는 여러 프로젝트를 나열하지 않는다.
- 다른 문항에서 이미 쓴 경험, 프로젝트명, 성과, 표현은 반복하지 않는다.
- 문항 {index + 1}의 질문 의도에 직접 답하는 내용만 남기고, 관련 낮은 프로젝트 설명은 과감히 제외한다.
"""


import time as _time

# DB 직군 목록 캐시 (5분)
_job_field_cache: dict = {"fields": [], "ts": 0.0}
_CACHE_TTL = 300

# 직무명 정규화 결과 캐시 (프로세스 재시작 전까지 유지)
_normalize_cache: dict[str, str] = {}


def _get_rag_job_fields() -> list[str]:
    """RAG DB에서 직군 카테고리 목록 조회 (5분 캐싱)"""
    now = _time.time()
    if now - _job_field_cache["ts"] < _CACHE_TTL and _job_field_cache["fields"]:
        return _job_field_cache["fields"]
    try:
        result = supabase.table("rag_documents").select("position").execute()
        seen: set[str] = set()
        fields: list[str] = []
        for row in (result.data or []):
            p = (row.get("position") or "").strip()
            if p and p not in seen:
                seen.add(p)
                fields.append(p)
        _job_field_cache["fields"] = fields
        _job_field_cache["ts"] = now
        return fields
    except Exception:
        return []


def _normalize_job_field(position: str) -> str:
    """사용자 입력 직무명을 DB의 RAG 카테고리로 정규화.

    1차: 부분 문자열 매칭
    2차: Claude Haiku로 의미 분류
    실패 시 원본 반환.
    """
    if not position:
        return position
    if position in _normalize_cache:
        return _normalize_cache[position]

    available = _get_rag_job_fields()
    if not available:
        _normalize_cache[position] = position
        return position

    # 1차: 단순 키워드 부분 매칭
    pos_lower = position.lower().replace(" ", "")
    for field in available:
        field_lower = field.lower().replace(" ", "")
        if field_lower in pos_lower or pos_lower in field_lower:
            _normalize_cache[position] = field
            return field

    # 2차: Claude Haiku로 의미 기반 분류
    try:
        fields_str = ", ".join(available)
        prompt = (
            f"직무명 '{position}'을 아래 카테고리 중 가장 유사한 것 하나로만 답하세요.\n"
            f"카테고리: {fields_str}\n"
            f"정확히 카테고리 이름만 출력하세요. 해당 없으면 빈 문자열로 답하세요."
        )
        resp = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=30,
            messages=[{"role": "user", "content": prompt}],
        )
        matched = resp.content[0].text.strip()
        if matched in available:
            _normalize_cache[position] = matched
            return matched
    except Exception:
        pass

    _normalize_cache[position] = position
    return position


def get_rag_context(company: str, job_field: str, question: str, is_freeform: bool = False) -> str:
    """Vector DB에서 유사 합격 자소서 검색

    - 특정 질문: 1차 같은 회사+직군, 2차 직군만, 3차 전체(벡터 유사도)
    - 자유형식: 직군 기반으로 구성 참고할 사례 5개
    """
    # 사용자 입력 직무명을 RAG 카테고리로 정규화
    normalized_field = _normalize_job_field(job_field)

    try:
        if is_freeform:
            query = f"직군: {normalized_field} 자기소개서 경험 역량 성과 지원 동기"
            embedding = embedding_model.encode(query).tolist()
            result = supabase.rpc("search_rag_cover_letters", {
                "query_embedding": embedding,
                "match_company": "",
                "match_job_field": normalized_field,
                "match_count": 5
            }).execute()
            # fallback: 전체에서 벡터 유사도만으로 검색
            if not result.data:
                result = supabase.rpc("search_rag_cover_letters", {
                    "query_embedding": embedding,
                    "match_company": "",
                    "match_job_field": "",
                    "match_count": 5
                }).execute()
        else:
            query = f"회사: {company}\n직군: {normalized_field}\n문항: {question}"
            embedding = embedding_model.encode(query).tolist()

            # 1차: 같은 회사 + 직군으로 검색
            result = supabase.rpc("search_rag_cover_letters", {
                "query_embedding": embedding,
                "match_company": company,
                "match_job_field": normalized_field,
                "match_count": 3
            }).execute()

            # 2차 fallback: 직군만으로 재검색
            if not result.data:
                result = supabase.rpc("search_rag_cover_letters", {
                    "query_embedding": embedding,
                    "match_company": "",
                    "match_job_field": normalized_field,
                    "match_count": 3
                }).execute()

            # 3차 fallback: 직군 필터 없이 벡터 유사도만으로 검색
            if not result.data:
                result = supabase.rpc("search_rag_cover_letters", {
                    "query_embedding": embedding,
                    "match_company": "",
                    "match_job_field": "",
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
    question_index: int,
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
    is_motivation = is_company_motivation_question(question, question_index)
    question_strategy_section = build_question_strategy(
        question, company, position, question_index, is_motivation
    )

    company_section = (
        f"\n\n[회사 분석 — 반드시 아래 내용을 자소서에 구체적으로 반영할 것]\n"
        f"※ 이 회사의 인재상·핵심 가치·사업 방향을 단순 나열하지 말고, 지원자의 경험과 연결하여 '왜 이 회사인가'를 설득력 있게 녹여낼 것\n"
        f"※ '이 회사만의 차별점'과 '강조 키워드'는 반드시 자소서 본문에 한 번 이상 반영할 것\n"
        f"{company_context}"
        if company_context else ""
    )
    match_section = (
        f"\n\n[지원자 경험 매칭 분석 — 이 회사에 강조할 경험과 방향성]\n"
        f"※ 아래 분석은 소재 후보입니다. 이 문항에는 질문 의도에 맞는 핵심 소재 1개만 선별해서 사용할 것\n"
        f"{experience_match}"
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
                f"\n\n[합격 자소서 사례 — 아래 3가지를 추출하여 반드시 적용할 것]\n"
                f"① 서론 패턴: 첫 문장에서 지원자를 어떻게 정의하는지 (역량 선언 / 에피소드 시작 / 문제 제기) → 동일한 방식으로 시작\n"
                f"② 경험 서술 밀도: 사건→행동→결과 흐름에서 수치·구체성을 어느 수준으로 쓰는지 → 동일한 밀도 유지\n"
                f"③ 마무리 연결: 지원 동기와 입사 후 기여를 어떻게 연결하는지 → 같은 구조로 마무리\n\n"
                f"{rag_context}"
            )
        else:
            rag_section = (
                f"\n\n[유사 합격 자소서 사례 — 아래 3가지를 추출하여 반드시 적용할 것]\n"
                f"① 문장 밀도·호흡: 합격 답변이 한 문장에 얼마나 많은 정보를 담는지, 단문/장문 비율 → 동일하게 따를 것\n"
                f"② STAR 구체성 수준: S·A·R 각각을 몇 문장으로 쓰는지, 수치를 어떻게 제시하는지 → 동일한 수준으로 작성\n"
                f"③ 직무 연결 방식: 경험과 이 직무를 어떻게 연결하는지 → 같은 논리 구조 적용\n\n"
                f"{rag_context}"
            )
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
        import re as _re2
        _nums = [int(n) for n in _re2.findall(r'\d+', char_limit)]
        _max_c = max(_nums) if _nums else 0
        _min_c = min(_nums) if len(_nums) >= 2 else 0
        _range_str = f"{_min_c}자 이상 {_max_c}자 이하" if _min_c else f"{_max_c}자 이하"
        word_count = (
            f"【글자 수 엄수】{_range_str} (한글·영문·숫자·띄어쓰기·줄바꿈 모두 각 1자)\n"
            f"  ※ 아래 단락별 글자 수 예산을 반드시 지키며, 각 단락을 쓸 때마다 누적 글자 수를 확인할 것\n"
            f"  ※ 마지막 단락은 반드시 완성된 문장으로 자연스럽게 끝낼 것 — 문장 중간에 절대 끊지 말 것"
        )
    elif is_freeform:
        word_count = "전체 900~1200자 (단락 합산 기준. 절대 초과 금지)"
    else:
        word_count = "전체 700~1000자 (단락 합산 기준)"

    # 단락 구조 가이드 — 글자 수 제한이 있으면 단락별 정확한 글자 수 예산으로 안내
    if char_limit:
        if _max_c and _max_c <= 300:
            _p1 = int(_max_c * 0.35)
            _p2 = _max_c - _p1
            if is_motivation:
                structure_guide = f"""【단락별 글자 수 예산 — 합산 {_max_c}자 이내】
단락 1 (약 {_p1}자): {company}를 선택한 구체적 이유와 직무 관심을 두괄식으로 제시
단락 2 (약 {_p2}자): 회사 방향과 맞닿은 지원자 경험 1개만 짧게 연결 + 입사 후 기여 방향
※ 프로젝트 상세 설명을 길게 쓰지 말고, 회사 선택 이유가 본문의 중심이 되게 할 것"""
            else:
                structure_guide = f"""【단락별 글자 수 예산 — 합산 {_max_c}자 이내】
단락 1 (약 {_p1}자): 핵심 답변 두괄식 + 대표 경험 1줄 요약
단락 2 (약 {_p2}자): 구체적 경험 STAR 압축형 서술 + 직무 연결 마무리
※ 마지막 문장은 완성된 형태로 자연스럽게 끝낼 것"""
        else:
            _p1 = int(_max_c * 0.20) if _max_c else 0
            _p2 = int(_max_c * 0.55) if _max_c else 0
            _p3 = (_max_c - _p1 - _p2) if _max_c else 0
            if is_motivation:
                _p1 = int(_max_c * 0.35) if _max_c else 0
                _p2 = int(_max_c * 0.40) if _max_c else 0
                _p3 = (_max_c - _p1 - _p2) if _max_c else 0
                structure_guide = f"""【단락별 글자 수 예산 — 합산 {_max_c}자 이내】
단락 1 (약 {_p1}자): {company}를 선택한 이유. 회사의 사업 방향/문화/직무 과제 중 1~2개를 지원자 관점으로 해석
단락 2 (약 {_p2}자): 그 이유와 연결되는 지원자 경험 1개만 근거로 제시. 프로젝트 상세 기능 나열 금지
단락 3 (약 {_p3}자): {position}에서 입사 후 기여할 구체적 방식. 회사 맥락으로 마무리
※ 첫 줄만 지원동기이고 나머지가 프로젝트 설명이면 실패다. 모든 단락이 {company}와 연결되어야 한다."""
            else:
                structure_guide = f"""【단락별 글자 수 예산 — 합산 {_max_c}자 이내】
단락 1 (약 {_p1}자): 이 문항의 핵심 답변 두괄식 제시
단락 2 (약 {_p2}자): 핵심 근거 경험을 STAR 구조로 전개
  S(상황): 어떤 상황/과제였는지
  A(행동): 구체적 행동, 수치 포함
  R(결과): 측정 가능한 성과
단락 3 (약 {_p3}자): 이 직무·회사와의 연결 + 기여 방향
※ 각 단락을 마칠 때마다 누적 글자 수를 확인하고, 단락 3은 반드시 완성된 문장으로 자연스럽게 끝낼 것"""
    elif is_freeform:
        structure_guide = """단락 1 (200~280자): 강한 첫 문장으로 시작. 지원자를 정의하는 핵심 역량·경험 선언 + 구체적 수치나 에피소드로 즉시 뒷받침
단락 2 (350~450자): 가장 강력한 경험 1개를 STAR 구조로 전개
  S(상황): 어떤 맥락/문제가 있었는지 (1~2문장)
  A(행동): 지원자가 구체적으로 취한 행동, 수치 포함 (2~3문장)
  R(결과): 측정 가능한 결과 또는 의미 있는 변화 (1~2문장)
단락 3 (200~300자): 두 번째 경험·역량을 간결하게 서술 (STAR 압축형)
단락 4 (150~200자): 이 회사를 선택한 구체적 이유 + 입사 후 첫 1년 기여 방향"""
    else:
        if is_motivation:
            structure_guide = f"""단락 1 (250~320자): {company}를 선택한 구체적 이유. 회사의 방향/문화/직무 과제를 지원자 관점으로 해석
단락 2 (300~380자): 그 이유와 연결되는 지원자 경험 1개만 근거로 제시. 프로젝트 기능·구현 설명 나열 금지
단락 3 (180~260자): {position}에서 입사 후 어떻게 기여할지 회사 맥락으로 마무리
※ 첫 줄 외에는 프로젝트 설명만 반복하는 답변은 실패다. 회사 선택 이유와 직무 기여가 본문의 중심이어야 한다."""
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
    strict_char_instruction = ""
    if char_limit:
        min_chars, max_chars = parse_char_limit(char_limit)
        strict_char_instruction = build_char_limit_instruction(min_chars, max_chars)

    return f"""당신은 대한민국 대기업 서류전형 합격 자소서를 전문으로 쓰는 작가입니다.

━━━ 이번에 작성할 자소서 문항 ━━━
{question}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[지원자 프로필]
{profile_text}

[채용 공고]
{job_text}{company_section}{match_section}{question_guidance_section}{question_strategy_section}{style_section}{prev_section}{draft_section}{already_written_section}{rag_section}

━━━ 합격 자소서의 4가지 기준 ━━━
이 답변은 아래 4가지를 반드시 충족해야 합니다:
① 구체성: 모든 주장에 실제 사건·수치·결과가 뒷받침됨. "열심히 했다" → "N개월 동안 N건을 직접 처리해 N% 향상"
② 차별성: {company}의 {position}에 지원하는 이 사람만 쓸 수 있는 내용. 업무·경험·관점이 구체적으로 드러남
③ 회사 맞춤: {company}의 인재상·핵심 가치·사업 방향이 지원자의 경험과 연결된 형태로 본문에 녹아 있어야 함. "왜 {company}인가"에 대한 답이 자소서에서 느껴져야 함
④ 진정성: 프로필에 실제 있는 경험만 사용. 없는 사실 창작 금지

━━━ 작성 구조 ({word_count}) ━━━
{structure_guide}
{strict_char_instruction}

━━━ 절대 금지 ━━━
• "이를 통해", "이러한 경험을 바탕으로", "뿐만 아니라"로만 시작하는 문장 반복
• "열정", "도전", "성장", "기여", "시너지"를 구체성 없는 추상 결론으로 사용
• 매 문단 "~을 통해 성장했습니다" / "~하는 인재가 되겠습니다" 식 마무리 반복
• 어느 지원자나 쓸 수 있는 범용 표현 ("신뢰 기반", "소통 역량", "적극적 자세", "끊임없이 노력")
• {company} 회사 정보를 단순 나열하거나 홍보하듯 쓰는 것 (경험과 연결 없는 "귀사는 ~합니다" 식 서술)
• 이력서·포트폴리오의 프로젝트 내용을 여러 개 반복하거나, 문항 의도보다 프로젝트 설명을 더 길게 쓰는 것
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

    raw_research = research_company(company, job_posting.get("position", "")) if company else ""
    company_context = synthesize_company_context(company, job_posting, raw_research) if company else ""

    # ── 2단계: 사용자 경험 매칭 ────────────────────────────────────
    yield f"data: {json.dumps({'type': 'stage', 'stage': 2, 'message': '지원자 경험 분석 중...'}, ensure_ascii=False)}\n\n"

    user_resume_ctx_db, user_portfolio_ctx_db = get_user_documents_context(user_id)
    # 세션에서 파싱한 이력서(profile)가 있으면 DB 이력서 무시 — 최신 데이터 우선
    has_session_profile = bool(profile.get("experience") or profile.get("skills") or profile.get("projects"))
    user_resume_ctx = "" if has_session_profile else user_resume_ctx_db
    # 포트폴리오: 세션 제공분 우선, 없으면 DB 데이터
    user_portfolio_ctx = profile.get("portfolio_text") or user_portfolio_ctx_db
    experience_match = match_user_to_company(
        company_context, profile,
        user_resume_ctx, user_portfolio_ctx,
        job_posting,
        questions,
    ) if company_context or profile or user_portfolio_ctx else ""

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
                cl = get_item_char_limit(item)
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
                cl = get_item_char_limit(item)
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
                job_posting, profile, question, i,
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

            # 글자 수 제한이 있으면 서버에서 검증한 최종본만 클라이언트에 보낸다.
            min_chars, max_chars = parse_char_limit(char_limit)
            if char_limit:
                target_chars = max_chars or min_chars or 1000
                max_tokens = max(500, int(target_chars * 1.25))
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
                    if not char_limit:
                        yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': text}, ensure_ascii=False)}\n\n"

            full_answer = "".join(answer_buffer)

            # ── 글자 수 보정: 최대 3회 완전 재작성 시도 후 하드컷 보장 ──
            if char_limit and max_chars is not None:
                range_str = char_limit_label(min_chars, max_chars)
                for attempt in range(3):
                    actual = answer_char_count(full_answer)
                    if actual <= max_chars and (min_chars is None or actual >= min_chars):
                        break
                    if actual > max_chars:
                        issue = f"현재 {actual}자로 최대({max_chars}자)를 초과"
                    else:
                        issue = f"현재 {actual}자로 최소({min_chars}자)에 미달"
                    correction_prompt = (
                        f"아래 자소서 답변은 {issue}합니다.\n"
                        f"글자 수 제한 [{range_str}]에 맞게 처음부터 완성도 있게 다시 작성해주세요.\n\n"
                        f"【작성 규칙】\n"
                        f"① 글자 수: 한글·영문·숫자·띄어쓰기·줄바꿈 모두 각 1자, 합산 {range_str}\n"
                        f"② 최대 글자 수를 넘길 위험이 있으면 보조 설명보다 핵심 경험·수치·근거를 우선할 것\n"
                        f"③ 최소 글자 수를 채우되, 최대 글자 수는 어떤 경우에도 넘기지 말 것\n"
                        f"④ 마지막 문장은 반드시 완성된 문장으로 자연스럽게 끝낼 것\n"
                        f"⑤ 답변 본문만 출력, 제목·설명·메타 코멘트 없이\n\n"
                        f"[원본 답변 — 경험·사실은 유지하되 분량을 조정하여 재작성]\n{full_answer}"
                    )
                    resp = claude.messages.create(
                        model="claude-sonnet-4-6",
                        max_tokens=max(500, int(max_chars * 1.25)),
                        messages=[{"role": "user", "content": correction_prompt}]
                    )
                    full_answer = resp.content[0].text.strip()

                # 하드컷: 재작성 후에도 초과하면 서버에서 반드시 최대 글자 수 이내로 만든다.
                if answer_char_count(full_answer) > max_chars:
                    full_answer = final_char_limit_fallback(full_answer, max_chars, min_chars)

                yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': full_answer}, ensure_ascii=False)}\n\n"
            elif char_limit:
                yield f"data: {json.dumps({'type': 'text', 'index': i, 'content': full_answer}, ensure_ascii=False)}\n\n"

            already_written.append({"question": question, "answer": full_answer})
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
