"""
회사 정보 수집 서비스
Tavily API로 4가지 각도의 쿼리를 실행하여 회사 컨텍스트를 수집
"""

from tavily import TavilyClient
from app.config import settings


SEARCH_QUERIES = [
    "{company} 인재상 핵심가치",
    "{company} 기업문화 조직문화",
    "{company} 사업 방향 최근 뉴스",
    "{company} 채용 후기 면접",
]


def research_company(company: str) -> str:
    """
    회사명으로 4가지 쿼리 검색 → 결과를 합쳐서 반환
    Tavily API 키가 없으면 빈 문자열 반환
    """
    if not settings.TAVILY_API_KEY:
        return ""

    client = TavilyClient(api_key=settings.TAVILY_API_KEY)
    all_results: list[str] = []

    for query_template in SEARCH_QUERIES:
        query = query_template.format(company=company)
        try:
            response = client.search(
                query=query,
                search_depth="basic",
                max_results=3,
                include_raw_content=False,
            )
            for item in response.get("results", []):
                content = item.get("content", "").strip()
                if content:
                    all_results.append(f"[{query}]\n{content}")
        except Exception:
            continue

    return "\n\n".join(all_results)
