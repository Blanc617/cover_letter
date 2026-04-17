"""
추출된 PDF 텍스트 → 구조화된 이력서 JSON으로 변환 (Gemini 활용)
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()


def structure_resume(raw_text: str) -> dict:
    """
    이력서 원문 텍스트를 구조화된 JSON으로 변환

    Returns:
        {
            "name": str,
            "contact": { "email": str, "phone": str, "github": str, ... },
            "summary": str,
            "skills": [str, ...],
            "experience": [
                { "company": str, "position": str, "period": str, "description": str }
            ],
            "education": [
                { "school": str, "major": str, "period": str, "degree": str }
            ],
            "projects": [
                { "name": str, "period": str, "tech_stack": [str], "description": str }
            ],
            "certifications": [str, ...],
            "activities": [str, ...]
        }
    """
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    client = OpenAI(api_key=api_key)

    prompt = f"""다음은 이력서 텍스트입니다. 이 텍스트를 분석하여 아래 JSON 형식으로 구조화해주세요.
없는 항목은 빈 값으로 처리하세요. 반드시 유효한 JSON만 반환하세요.

이력서 텍스트:
{raw_text}

반환 JSON 형식:
{{
  "name": "이름",
  "contact": {{
    "email": "",
    "phone": "",
    "github": "",
    "linkedin": "",
    "blog": ""
  }},
  "summary": "자기소개 요약",
  "skills": ["기술1", "기술2"],
  "experience": [
    {{
      "company": "회사명",
      "position": "직책",
      "period": "2022.03 - 2024.01",
      "description": "담당 업무 설명"
    }}
  ],
  "education": [
    {{
      "school": "학교명",
      "major": "전공",
      "period": "2018.03 - 2022.02",
      "degree": "학사"
    }}
  ],
  "projects": [
    {{
      "name": "프로젝트명",
      "period": "2023.06 - 2023.08",
      "tech_stack": ["Python", "FastAPI"],
      "description": "프로젝트 설명"
    }}
  ],
  "certifications": ["자격증1"],
  "activities": ["대외활동1"]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000
    )
    text = response.choices[0].message.content.strip()

    # ```json ... ``` 블록 제거
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)
