"""
3단계 파이프라인의 1·2단계를 담당하는 서비스

1단계: 회사 검색 결과 → Claude가 회사 컨텍스트 요약
2단계: 회사 컨텍스트 + 사용자 프로필 → Claude가 강조할 경험 선별
2-1단계: 전체 문항 기준으로 경험·소재를 겹치지 않게 문항별 배정
"""

from anthropic import Anthropic
from app.config import settings

claude = Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def synthesize_company_context(
    company: str,
    job_posting: dict,
    raw_research: str,
) -> str:
    """
    1단계: 검색 결과를 Claude로 정제하여 회사 컨텍스트 요약 생성
    검색 결과가 없으면 공고 텍스트만으로 요약
    """
    job_text = f"""
회사: {company}
직군: {job_posting.get('position', '')}
주요 업무: {job_posting.get('job_description', '')}
자격 요건: {', '.join(job_posting.get('requirements', []))}
우대 사항: {', '.join(job_posting.get('preferred', []))}
    """.strip()

    research_section = (
        f"\n\n[웹 검색 결과]\n{raw_research}"
        if raw_research
        else "\n\n(웹 검색 결과 없음 — 공고 텍스트만으로 분석)"
    )

    prompt = f"""다음은 {company}의 채용 공고와 웹 검색 결과입니다.
이 정보를 분석하여 아래 7가지 항목을 간결하게 정리해주세요.

[채용 공고]
{job_text}{research_section}

---
아래 형식으로 출력하세요:

## 이 회사가 원하는 인재상
(어떤 성향, 가치관, 역량을 가진 사람을 원하는지 3~5줄)

## 기업 문화 및 핵심 가치
(회사가 중시하는 문화, 가치, 일하는 방식 3~5줄)

## 최근 사업 방향 및 관심사
(회사가 현재 집중하는 사업, 기술, 방향 2~4줄)

## 자소서에서 강조해야 할 키워드
(쉼표로 구분된 5~8개 키워드)

## 이 회사만의 차별점 — 자소서에서 반드시 반영할 것
(동종업계 경쟁사 대비 이 회사가 가진 고유한 특성, 문화, 전략적 포지션. 지원자가 "왜 다른 회사가 아닌 이 회사인가"를 구체적으로 답할 수 있도록 2~4줄로 서술)

## 이 직무에서 즉시 기여할 수 있는 영역
(채용 공고의 주요 업무·자격 요건을 분석해, 신입/경력 지원자가 입사 첫 해에 실질적으로 기여할 수 있는 영역 2~3개)

## 이 직무 면접관이 자소서에서 가장 보고 싶어하는 것
(이 회사·이 직무 특성상 서류 심사자가 중점적으로 체크하는 포인트 3~4줄)
"""

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1400,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def match_user_to_company(
    company_context: str,
    profile: dict,
    user_resume_context: str,
    user_portfolio_context: str,
    job_posting: dict,
    questions: list[str] | None = None,
) -> str:
    """
    2단계: 회사 컨텍스트 + 사용자 프로필 → 강조할 경험·역량 선별
    questions가 있으면 문항 맥락도 고려
    """
    profile_text = f"""
이름: {profile.get('name', '')}
기술 스택: {', '.join(profile.get('skills', []))}
경력:
{chr(10).join([f"- {e['company']} / {e['position']} ({e['period']}): {e['description']}" for e in profile.get('experience', [])])}
프로젝트:
{chr(10).join([f"- {p['name']} ({p['period']}): {p['description']}" for p in profile.get('projects', [])])}
학력: {', '.join([f"{e['school']} {e['major']} {e['degree']}" for e in profile.get('education', [])])}
자격증: {', '.join(profile.get('certifications', []))}
활동: {', '.join(profile.get('activities', []))}
    """.strip()

    resume_section = (
        f"\n\n[저장된 이력서]\n{user_resume_context}" if user_resume_context else ""
    )
    portfolio_section = (
        f"\n\n[저장된 포트폴리오]\n{user_portfolio_context}" if user_portfolio_context else ""
    )

    questions_section = ""
    if questions:
        questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])
        questions_section = f"\n\n[자소서 문항 목록]\n{questions_text}"

    prompt = f"""다음은 지원자의 프로필과 {job_posting.get('company', '')} {job_posting.get('position', '')} 직무의 회사 분석 결과입니다.

[회사 분석]
{company_context}

[지원자 프로필]
{profile_text}{resume_section}{portfolio_section}{questions_section}

---
지원자의 경험과 역량 중 이 회사·직무에 가장 잘 맞는 것을 선별하여 아래 형식으로 출력하세요.

## STAR 구조로 정리한 핵심 경험 (상위 4개)
각 경험을 아래 형식으로 정리하세요:

[경험명]
- 상황(S): 어떤 맥락/문제가 있었는지 한 줄
- 행동(A): 지원자가 구체적으로 한 것 (수치 포함 시 반드시 기재)
- 결과(R): 측정 가능한 성과 또는 의미 있는 변화 (수치 없으면 "수치 불명확"으로 표기)
- 이 직무 연결점: 이 경험이 {job_posting.get('company', '')} {job_posting.get('position', '')}에서 어떻게 활용될 수 있는지

## 부각할 기술·역량
(이 직무에서 특히 어필될 기술/역량 3~5개와 이유)

## 자소서 전체 방향성
(이 지원자가 이 회사에 지원할 때 어떤 스토리라인으로 써야 하는지 3~5줄)

## 문항별 핵심 소재 (문항 목록이 있는 경우)
(각 문항에 가장 적합한 경험·소재를 1~2개씩 짧게 배정. 문항 번호 기준으로 나열)

## 피해야 할 내용
(이 회사·직무와 맞지 않아 언급을 최소화할 내용)
"""

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1600,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def map_questions_to_experiences(
    questions: list[str],
    profile: dict,
    experience_match: str,
) -> dict[str, str]:
    """
    2-1단계: 전체 문항을 한 번에 보고 각 문항에 사용할 경험·소재를 겹치지 않게 배정.
    반환값: { "문항 텍스트": "이 문항 전용 작성 가이드" }
    """
    if not questions or len(questions) <= 1:
        return {}

    experiences_text = f"""
경력:
{chr(10).join([f"- {e['company']} / {e['position']} ({e['period']}): {e['description']}" for e in profile.get('experience', [])])}
프로젝트:
{chr(10).join([f"- {p['name']} ({p['period']}): {p['description']}" for p in profile.get('projects', [])])}
활동: {', '.join(profile.get('activities', []))}
    """.strip()

    questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])

    prompt = f"""지원자가 아래 여러 자소서 문항에 답해야 합니다.
각 문항에 어떤 경험·소재를 쓸지 겹치지 않게 배정해주세요.

[문항 목록]
{questions_text}

[지원자 경험·소재]
{experiences_text}

[경험 매칭 분석]
{experience_match}

---
각 문항에 대해 아래 형식으로 정확히 출력하세요.
같은 경험이나 에피소드가 두 문항에 중복되지 않도록 서로 다른 소재를 배정하세요.
특히 1번 문항이 지원동기/회사 선택 이유/입사 후 포부를 묻는 문항이면 프로젝트를 길게 배정하지 말고,
회사 선택 이유, 회사의 사업·문화·직무 과제와 연결되는 관점, 보조 근거 경험 1개만 배정하세요.
프로젝트명과 구현 내용을 여러 문항에 반복 배정하지 마세요.

문항 1: [핵심 의도: 이 문항이 진짜 묻는 것] | [사용할 소재: 경험/프로젝트 1~2개] | [강조 메시지: 이 문항의 핵심 주장 한 줄]
문항 2: [핵심 의도: ...] | [사용할 소재: ...] | [강조 메시지: ...]
...
(문항 수만큼 반복)"""

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    # "문항 N: ..." 형식을 파싱하여 questions 인덱스와 매핑
    result: dict[str, str] = {}
    lines = raw.split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        for i, q in enumerate(questions):
            prefix = f"문항 {i+1}:"
            if line.startswith(prefix):
                guidance = line[len(prefix):].strip()
                result[q] = guidance
                break
    return result


def analyze_user_style(letters_text: str) -> str:
    """
    사용자의 이전 자소서 → 말투·경험·방향성을 구조화된 형태로 사전 분석
    생성 단계에서 Claude가 이 분석 결과를 그대로 따르도록 활용
    """
    prompt = f"""다음은 지원자가 실제로 작성한 자기소개서입니다.
이 자소서를 꼼꼼히 읽고, 새 자소서 작성 시 즉시 활용할 수 있도록 아래 3가지를 구체적으로 분석해주세요.

[지원자의 자기소개서]
{letters_text}

---
아래 형식으로 출력하세요. 각 항목은 새 자소서를 쓰는 작가가 바로 따를 수 있을 만큼 구체적으로 작성하세요.

## 문체·말투 패턴
- 문장 어미: (예: ~했습니다 체 / ~했다 체 / 혼용 여부)
- 호흡·문장 길이: (예: 단문 중심 / 장문 서술형 / 혼합)
- 자주 쓰는 연결어·표현: (실제 예시 3~5개 인용)
- 감정·가치 표현 방식: (예: 직접 서술 / 사례로 간접 표현)

## 반복적으로 강조한 경험·역량
(이 사람이 여러 자소서에서 일관되게 부각해온 경험, 프로젝트, 역할, 성과를 구체적으로 나열 — 새 자소서에 그대로 활용 가능한 소재)

## 자기 어필 방향성과 스토리라인
(이 사람이 자신을 어떤 각도로 표현해왔는지 — 예: "문제를 직접 찾아 해결하는 실행력" / "팀을 이끄는 리더십" / "기술적 깊이와 비즈니스 이해를 겸비" 등. 새 자소서도 이 방향성을 유지할 것)
"""

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
