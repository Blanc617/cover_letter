"""
PDF 파싱 모듈
1차: pdfplumber로 텍스트 추출
2차: 텍스트 추출 실패(이미지 기반 PDF) 시 → Gemini Vision fallback
"""

import pdfplumber
import fitz  # pymupdf
import io
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


# ── 1. pdfplumber 텍스트 추출 ──────────────────────────────────────────────

def extract_text_pdfplumber(pdf_bytes: bytes) -> str:
    """pdfplumber로 PDF 텍스트 추출"""
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text.strip())
    return "\n\n".join(text_parts)


# ── 2. pymupdf 텍스트 추출 ─────────────────────────────────────────────────

def extract_text_pymupdf(pdf_bytes: bytes) -> str:
    """pymupdf로 PDF 텍스트 추출 (pdfplumber 보조)"""
    text_parts = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        text = page.get_text()
        if text.strip():
            text_parts.append(text.strip())
    doc.close()
    return "\n\n".join(text_parts)


# ── 3. 이미지 기반 PDF 감지 ────────────────────────────────────────────────

def is_image_based_pdf(pdf_bytes: bytes, threshold: int = 50) -> bool:
    """
    텍스트 추출량이 threshold 글자 미만이면 이미지 기반 PDF로 판단
    """
    text = extract_text_pdfplumber(pdf_bytes)
    return len(text.strip()) < threshold


# ── 4. PDF → 이미지 변환 (Vision fallback용) ──────────────────────────────

def pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> list[bytes]:
    """PDF 각 페이지를 PNG 이미지 bytes 리스트로 변환"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        images.append(pix.tobytes("png"))
    doc.close()
    return images


# ── 5. Claude Vision fallback ─────────────────────────────────────────────

def extract_text_claude_vision(pdf_bytes: bytes) -> str:
    """이미지 기반 PDF → Claude Vision으로 텍스트 추출"""
    import base64
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")

    client = anthropic.Anthropic(api_key=api_key)
    images = pdf_to_images(pdf_bytes)
    all_text = []

    for img_bytes in images:
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64
                        }
                    },
                    {
                        "type": "text",
                        "text": (
                            "이 이미지는 이력서 또는 포트폴리오 PDF의 한 페이지입니다. "
                            "이미지에 있는 모든 텍스트를 원문 그대로 추출해주세요. "
                            "레이아웃 구조(섹션 제목, 항목 등)를 최대한 유지해주세요."
                        )
                    }
                ]
            }]
        )
        all_text.append(response.content[0].text)

    return "\n\n".join(all_text)


# ── 6. 메인 파싱 함수 ──────────────────────────────────────────────────────

def parse_pdf(pdf_bytes: bytes) -> dict:
    """
    PDF 파싱 메인 함수
    Returns:
        {
            "text": str,           # 추출된 전체 텍스트
            "method": str,         # 사용된 파싱 방법
            "page_count": int,     # 페이지 수
            "success": bool
        }
    """
    # 페이지 수 확인
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    doc.close()

    # 1차: pdfplumber
    text = extract_text_pdfplumber(pdf_bytes)
    if len(text.strip()) >= 50:
        return {
            "text": text,
            "method": "pdfplumber",
            "page_count": page_count,
            "success": True
        }

    # 2차: pymupdf
    text = extract_text_pymupdf(pdf_bytes)
    if len(text.strip()) >= 50:
        return {
            "text": text,
            "method": "pymupdf",
            "page_count": page_count,
            "success": True
        }

    # 3차: Claude Vision fallback
    try:
        text = extract_text_claude_vision(pdf_bytes)
        return {
            "text": text,
            "method": "gemini_vision",
            "page_count": page_count,
            "success": True
        }
    except Exception as e:
        return {
            "text": "",
            "method": "failed",
            "page_count": page_count,
            "success": False,
            "error": str(e)
        }
