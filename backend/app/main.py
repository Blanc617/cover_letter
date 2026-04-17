from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import job_posting, resume, cover_letter

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

@app.get("/")
def health_check():
    return {"status": "ok"}
