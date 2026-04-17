"""
채용 공고 이미지 분석 API
POST /api/job-posting/analyze
"""

import base64
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from openai import OpenAI
from app.config import settings

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY)


@router.post("/analyze")
async def analyze_job_posting(file: UploadFile = File(...)):
    """
    채용 공고 이미지 → 구조화된 JSON 반환
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    image_bytes = await file.read()
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime_type = file.content_type

    prompt = """이 이미지는 채용 공고입니다. 이미지에서 다음 정보를 추출하여 JSON으로 반환하세요.
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

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                {"type": "text", "text": prompt}
            ]
        }],
        max_tokens=2000
    )

    text = response.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except Exception:
        raise HTTPException(status_code=500, detail="공고 분석 중 오류가 발생했습니다.")
