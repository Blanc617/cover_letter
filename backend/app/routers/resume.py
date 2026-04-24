"""
이력서/포트폴리오 파싱 API
POST /api/resume/parse
"""

from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.parsers.pdf_parser import parse_pdf
from app.parsers.resume_structurer import structure_resume

router = APIRouter()


class StructureTextRequest(BaseModel):
    text: str


@router.post("/structure-text")
async def structure_resume_from_text(body: StructureTextRequest):
    """
    추출된 텍스트 → 구조화된 Profile JSON 반환 (저장된 이력서 재사용 시)
    """
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="텍스트가 비어 있습니다.")
    structured = structure_resume(body.text)
    return {"profile": structured}


@router.post("/parse-text")
async def parse_resume_text_only(file: UploadFile = File(...)):
    """
    PDF 텍스트만 추출 (구조화 없이) — 이전 자소서 파싱용
    """
    if file.content_type != "application/pdf" and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    pdf_bytes = await file.read()
    result = parse_pdf(pdf_bytes)

    if not result["success"]:
        raise HTTPException(status_code=500, detail="PDF 파싱에 실패했습니다.")

    return {"text": result["text"]}


@router.post("/parse")
async def parse_resume(
    resume: UploadFile = File(...),
    portfolio: Optional[UploadFile] = File(None),
):
    """
    이력서(필수) + 포트폴리오(선택) PDF → 구조화된 JSON 반환
    둘 다 파싱 후 합쳐서 Claude로 구조화
    """
    is_pdf = (
        resume.content_type == "application/pdf"
        or (resume.filename or "").lower().endswith(".pdf")
    )
    if not is_pdf:
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    # 이력서 파싱
    resume_bytes = await resume.read()
    resume_result = parse_pdf(resume_bytes)
    if not resume_result["success"]:
        raise HTTPException(status_code=500, detail="이력서 파싱에 실패했습니다.")

    combined_text = f"[이력서]\n{resume_result['text']}"

    # 포트폴리오 파싱 (선택)
    portfolio_text: str | None = None
    if portfolio and portfolio.filename:
        is_portfolio_pdf = (
            portfolio.content_type == "application/pdf"
            or (portfolio.filename or "").lower().endswith(".pdf")
        )
        if not is_portfolio_pdf:
            raise HTTPException(status_code=400, detail="포트폴리오도 PDF 파일만 가능합니다.")
        portfolio_bytes = await portfolio.read()
        portfolio_result = parse_pdf(portfolio_bytes)
        if portfolio_result["success"]:
            portfolio_text = portfolio_result["text"][:3000]
            combined_text += f"\n\n[포트폴리오]\n{portfolio_result['text']}"

    structured = structure_resume(combined_text)
    return {
        "parse_method": resume_result["method"],
        "page_count": resume_result["page_count"],
        "profile": structured,
        "portfolio_text": portfolio_text,
    }
