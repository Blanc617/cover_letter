from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.routers import job_posting, resume, cover_letter, admin, history
from app.parsers.resume_structurer import structure_resume

app = FastAPI(title="AI 자기소개서 생성 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(job_posting.router, prefix="/api/job-posting", tags=["job-posting"])
app.include_router(resume.router,      prefix="/api/resume",      tags=["resume"])
app.include_router(cover_letter.router, prefix="/api/cover-letter", tags=["cover-letter"])
app.include_router(admin.router,        prefix="/api/admin",        tags=["admin"])
app.include_router(history.router,      prefix="/api/history",      tags=["history"])

class StructureTextRequest(BaseModel):
    text: str

@app.post("/api/resume/structure-text")
async def structure_resume_direct(body: StructureTextRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="텍스트가 비어 있습니다.")
    structured = structure_resume(body.text)
    return {"profile": structured}

@app.get("/")
def health_check():
    return {"status": "ok"}
