"""
합격 자소서 크롤링 가능 여부 검증
- 사람인
- 잡코리아
- 링커리어
"""

import asyncio
import sys
import io
from playwright.async_api import async_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


# ── 사람인 ─────────────────────────────────────────────────────────────────

async def crawl_saramin(page):
    print("\n" + "="*60)
    print("[사람인] 합격 자소서 크롤링 테스트")
    print("="*60)

    url = "https://www.saramin.co.kr/zf_user/bbs/intro-letter/list"
    print(f"URL: {url}")

    try:
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        title = await page.title()
        print(f"페이지 제목: {title}")

        # 로그인 필요 여부 체크
        current_url = page.url
        if "login" in current_url or "auth" in current_url:
            print("결과: 로그인 필요 (접근 불가)")
            return

        # 자소서 목록 셀렉터 탐색
        selectors = [
            ".intro_list li",
            ".list_item",
            ".cover_letter_list li",
            "article",
            ".item_recruit",
        ]
        for sel in selectors:
            items = await page.query_selector_all(sel)
            if items:
                print(f"목록 셀렉터 발견: '{sel}' ({len(items)}개)")
                # 첫 번째 항목 텍스트 미리보기
                text = await items[0].inner_text()
                print(f"첫 항목 미리보기: {text[:200]}")
                break
        else:
            # 페이지 HTML 일부 출력
            content = await page.content()
            print(f"셀렉터 미발견. 페이지 HTML 앞 500자:")
            print(content[:500])

    except Exception as e:
        print(f"오류: {e}")


# ── 잡코리아 ───────────────────────────────────────────────────────────────

async def crawl_jobkorea(page):
    print("\n" + "="*60)
    print("[잡코리아] 합격 자소서 크롤링 테스트")
    print("="*60)

    url = "https://www.jobkorea.co.kr/goodjob/Tip/Cover"
    print(f"URL: {url}")

    try:
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)

        title = await page.title()
        print(f"페이지 제목: {title}")

        current_url = page.url
        if "login" in current_url or "member" in current_url.lower():
            print("결과: 로그인 필요 (접근 불가)")
            return

        selectors = [
            ".tplList li",
            ".list-item",
            ".cover-letter-list li",
            ".selfintro-list li",
            ".lst-cover li",
            "article",
        ]
        for sel in selectors:
            items = await page.query_selector_all(sel)
            if items:
                print(f"목록 셀렉터 발견: '{sel}' ({len(items)}개)")
                text = await items[0].inner_text()
                print(f"첫 항목 미리보기: {text[:200]}")
                break
        else:
            content = await page.content()
            print(f"셀렉터 미발견. 페이지 HTML 앞 500자:")
            print(content[:500])

    except Exception as e:
        print(f"오류: {e}")


# ── 링커리어 ───────────────────────────────────────────────────────────────

async def crawl_linkareer(page):
    print("\n" + "="*60)
    print("[링커리어] 합격 자소서 크롤링 테스트")
    print("="*60)

    url = "https://linkareer.com/cover-letter/list"
    print(f"URL: {url}")

    try:
        await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)

        title = await page.title()
        print(f"페이지 제목: {title}")

        current_url = page.url
        if "login" in current_url or "signin" in current_url:
            print("결과: 로그인 필요 (접근 불가)")
            return

        selectors = [
            ".CoverLetterCard",
            ".cover-letter-item",
            "[class*='CoverLetter']",
            "[class*='cover']",
            "article",
            ".list-item",
        ]
        for sel in selectors:
            items = await page.query_selector_all(sel)
            if items:
                print(f"목록 셀렉터 발견: '{sel}' ({len(items)}개)")
                text = await items[0].inner_text()
                print(f"첫 항목 미리보기: {text[:200]}")
                break
        else:
            content = await page.content()
            print(f"셀렉터 미발견. 페이지 HTML 앞 500자:")
            print(content[:500])

    except Exception as e:
        print(f"오류: {e}")


# ── 메인 ───────────────────────────────────────────────────────────────────

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="ko-KR",
        )
        page = await context.new_page()

        await crawl_saramin(page)
        await crawl_jobkorea(page)
        await crawl_linkareer(page)

        await browser.close()
        print("\n\n[테스트 완료]")


if __name__ == "__main__":
    asyncio.run(main())
