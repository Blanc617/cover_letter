"""
어드민 API - 합격 자소서 관리 (RAG 데이터)
POST   /api/admin/rag          - 합격 자소서 등록
GET    /api/admin/rag          - 목록 조회
PUT    /api/admin/rag/{id}     - 수정
DELETE /api/admin/rag/{id}     - 삭제
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from supabase import create_client
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
embedding_model = SentenceTransformer("BAAI/bge-m3")


class RagDocumentCreate(BaseModel):
    company: str
    position: str
    question: str
    answer: str


class RagDocumentUpdate(BaseModel):
    company: str | None = None
    position: str | None = None
    question: str | None = None
    answer: str | None = None


def generate_embedding(company: str, position: str, question: str, answer: str) -> list[float]:
    text = f"회사: {company}\n직군: {position}\n문항: {question}\n답변: {answer}"
    return embedding_model.encode(text).tolist()


@router.post("/rag", status_code=201)
async def create_rag_document(body: RagDocumentCreate, _: str = Depends(get_current_user)):
    """합격 자소서 등록"""
    embedding = generate_embedding(body.company, body.position, body.question, body.answer)

    result = supabase.table("rag_documents").insert({
        "company": body.company,
        "position": body.position,
        "question": body.question,
        "answer": body.answer,
        "embedding": embedding
    }).execute()

    return result.data[0]


@router.get("/rag")
async def list_rag_documents(company: str = "", position: str = "", limit: int = 50, offset: int = 0):
    """합격 자소서 목록 조회"""
    query = supabase.table("rag_documents").select("id, company, position, question, answer, created_at")

    if company:
        query = query.ilike("company", f"%{company}%")
    if position:
        query = query.ilike("position", f"%{position}%")

    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"items": result.data, "total": len(result.data)}


@router.put("/rag/{doc_id}")
async def update_rag_document(doc_id: int, body: RagDocumentUpdate, _: str = Depends(get_current_user)):
    """합격 자소서 수정"""
    existing = supabase.table("rag_documents").select("*").eq("id", doc_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    current = existing.data[0]
    updated = {
        "company":  body.company  if body.company  is not None else current["company"],
        "position": body.position if body.position is not None else current["position"],
        "question": body.question if body.question is not None else current["question"],
        "answer":   body.answer   if body.answer   is not None else current["answer"],
    }
    updated["embedding"] = generate_embedding(
        updated["company"], updated["position"], updated["question"], updated["answer"]
    )

    result = supabase.table("rag_documents").update(updated).eq("id", doc_id).execute()
    return result.data[0]


@router.delete("/rag/{doc_id}", status_code=204)
async def delete_rag_document(doc_id: int, _: str = Depends(get_current_user)):
    """합격 자소서 삭제"""
    existing = supabase.table("rag_documents").select("id").eq("id", doc_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    supabase.table("rag_documents").delete().eq("id", doc_id).execute()
