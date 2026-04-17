"""
이력서/포트폴리오 파싱 API
POST /api/resume/parse
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.parsers.pdf_parser import parse_pdf
from app.parsers.resume_structurer import structure_resume

router = APIRouter()


@router.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    """
    이력서/포트폴리오 PDF → 구조화된 JSON 반환
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    pdf_bytes = await file.read()
    result = parse_pdf(pdf_bytes)

    if not result["success"]:
        raise HTTPException(status_code=500, detail="PDF 파싱에 실패했습니다. 텍스트 직접 입력을 이용해주세요.")

    structured = structure_resume(result["text"])
    return {
        "parse_method": result["method"],
        "page_count": result["page_count"],
        "profile": structured
    }
