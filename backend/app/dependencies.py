"""
FastAPI 의존성 - JWT 토큰으로 사용자 인증
"""

from fastapi import Header, HTTPException
from supabase import create_client
from app.config import settings


def get_current_user(authorization: str = Header(...)):
    """Authorization: Bearer <token> 헤더에서 user_id 추출"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없습니다.")

    token = authorization.removeprefix("Bearer ").strip()
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.auth.get_user(token)
    if not response.user:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

    return response.user.id
