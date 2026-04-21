"""
이력서 저장 / 자소서 저장 / 히스토리 조회
POST /api/history/resume       - 이력서 저장
POST /api/history/cover-letter - 자소서 저장
GET  /api/history              - 자소서 히스토리 목록
GET  /api/history/{id}         - 자소서 상세
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class SaveResumeRequest(BaseModel):
    parsed_json: dict


class SaveCoverLetterRequest(BaseModel):
    resume_id: int | None = None
    job_posting: dict
    content_json: list  # [{ question, answer }, ...]


@router.post("/resume", status_code=201)
async def save_resume(body: SaveResumeRequest, user_id: str = Depends(get_current_user)):
    """파싱된 이력서 저장"""
    result = supabase.table("resumes").insert({
        "user_id": user_id,
        "parsed_json": body.parsed_json,
    }).execute()
    return result.data[0]


@router.post("/cover-letter", status_code=201)
async def save_cover_letter(body: SaveCoverLetterRequest, user_id: str = Depends(get_current_user)):
    """생성된 자소서 저장"""
    result = supabase.table("cover_letters").insert({
        "user_id": user_id,
        "resume_id": body.resume_id,
        "job_posting": body.job_posting,
        "content_json": body.content_json,
    }).execute()
    return result.data[0]


@router.get("")
async def get_history(user_id: str = Depends(get_current_user)):
    """자소서 히스토리 목록"""
    result = supabase.table("cover_letters") \
        .select("id, job_posting, content_json, created_at") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return {"items": result.data}


@router.get("/{cover_letter_id}")
async def get_cover_letter(cover_letter_id: int, user_id: str = Depends(get_current_user)):
    """자소서 상세 조회"""
    result = supabase.table("cover_letters") \
        .select("*") \
        .eq("id", cover_letter_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="자소서를 찾을 수 없습니다.")
    return result.data
