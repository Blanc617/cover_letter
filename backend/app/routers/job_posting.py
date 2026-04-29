"""
채용 공고 분석 API
POST /api/job-posting/analyze      - 이미지 업로드
POST /api/job-posting/from-url     - URL 크롤링
"""

import base64
import json
import re
import urllib.request
import urllib.error
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import anthropic
from app.config import settings

router = APIRouter()
claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

_EXTRACT_PROMPT = """다음은 채용 공고 페이지의 텍스트입니다. 아래 정보를 추출하여 JSON으로 반환하세요.
없는 항목은 빈 값으로 처리하고, 반드시 유효한 JSON만 반환하세요.

{
  "company": "회사명",
  "position": "채용 직군/직무",
  "employment_type": "고용 형태 (신입/경력/인턴 등)",
  "requirements": ["자격 요건1", "자격 요건2"],
  "preferred": ["우대 사항1", "우대 사항2"],
  "job_description": "주요 업무 내용",
  "questions": ["자소서 문항1", "자소서 문항2"]
}"""


def _parse_job_json(text: str) -> dict:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)


def _fetch_page_text(url: str, max_chars: int = 10000) -> str:
    """URL에서 HTML을 가져와 태그 제거 후 텍스트 반환"""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=400, detail=f"URL을 불러올 수 없습니다: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"URL 요청 실패: {e}")

    # script/style 제거 후 태그 제거
    text = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


@router.post("/analyze")
async def analyze_job_posting(file: UploadFile = File(...)):
    """채용 공고 이미지 → 구조화된 JSON 반환"""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    image_bytes = await file.read()
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime_type = file.content_type

    prompt = "이 이미지는 채용 공고입니다. 이미지에서 다음 정보를 추출하여 JSON으로 반환하세요.\n" + _EXTRACT_PROMPT

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime_type, "data": b64}
                },
                {"type": "text", "text": prompt}
            ]
        }]
    )

    try:
        return _parse_job_json(response.content[0].text)
    except Exception:
        raise HTTPException(status_code=500, detail="공고 분석 중 오류가 발생했습니다.")


class UrlRequest(BaseModel):
    url: str


@router.post("/from-url")
async def analyze_job_posting_from_url(body: UrlRequest):
    """채용 공고 URL 크롤링 → 구조화된 JSON 반환"""
    page_text = _fetch_page_text(body.url)

    prompt = f"{_EXTRACT_PROMPT}\n\n[채용 공고 페이지 텍스트]\n{page_text}"

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        return _parse_job_json(response.content[0].text)
    except Exception:
        raise HTTPException(status_code=500, detail="공고 분석 중 오류가 발생했습니다.")
