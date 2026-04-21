# AI 자기소개서 생성 서비스 - 프로젝트 계획

## 프로젝트 개요

사용자가 채용 공고 캡처와 이력서/포트폴리오를 업로드하면, AI가 분석하여 기업 맞춤형 자기소개서를 생성해주는 웹 서비스.
합격 자소서 RAG를 통해 높은 완성도의 자소서를 제공한다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js (App Router) |
| Backend | FastAPI (Python) |
| DB + Vector DB + Storage | Supabase (PostgreSQL + pgvector) |
| 인증 | Supabase OAuth (Google + Naver) |
| Vision / 구조화 / 자소서 생성 | Claude Sonnet 4.6 |
| 임베딩 | BGE-M3 (로컬, FlagEmbedding) |

---

## 전체 시스템 흐름

```
[사용자]
  ├─ 채용 공고 캡처 이미지 업로드
  │     └─ Gemini Vision → 공고 내용 구조화 (회사명, 직군, 우대사항, 자소서 문항 등)
  │
  ├─ 이력서 / 포트폴리오 PDF 업로드
  │     ├─ pdfplumber / pymupdf → 텍스트 추출
  │     └─ 파싱 실패 시 → Gemini Vision fallback
  │           └─ 사용자 프로필 구조화 (경력, 기술스택, 프로젝트, 강점 등)
  │
  └─ 자소서 생성 요청
        ├─ RAG: Vector DB에서 해당 기업 합격 자소서 검색
        └─ Claude Sonnet 4.6: 공고 + 프로필 + RAG 결과 → 자소서 생성

[관리자]
  └─ 어드민 페이지에서 합격 자소서 직접 입력 → RAG DB 구축
```

---

## 개발 단계별 계획

### Phase 1 - 핵심 기술 검증 (MVP 전 검증)

> 기술적 리스크가 높은 것부터 먼저 검증

#### 1-1. PDF 파싱 검증
- [ ] `pdfplumber`, `pymupdf` 라이브러리로 이력서 PDF 텍스트 추출 테스트
- [ ] 이미지 기반 PDF 감지 → Gemini Vision fallback 테스트
- [ ] 포트폴리오 PDF (이미지 많음) 파싱 품질 확인
- [ ] 추출 결과를 구조화된 JSON으로 변환 (경력, 기술스택, 프로젝트 등)

---

### Phase 2 - 백엔드 핵심 기능 구현

#### 2-1. 프로젝트 세팅
- [ ] FastAPI 프로젝트 초기 세팅
- [ ] Next.js 프로젝트 초기 세팅
- [ ] Supabase 프로젝트 생성 (DB + Storage + pgvector 활성화)
- [ ] 환경변수 구성 (.env)

#### 2-2. 공고 이미지 분석 API
- [ ] 이미지 업로드 엔드포인트 구현
- [ ] Gemini 2.0 Flash Vision으로 공고 내용 추출
- [ ] 추출 결과 구조화 (회사명, 직군, 자격요건, 우대사항, 자소서 문항)

#### 2-3. 이력서/포트폴리오 파싱 API
- [ ] PDF 업로드 엔드포인트 구현
- [ ] 텍스트 추출 → 구조화 파이프라인 구현
- [ ] Vision fallback 로직 구현
- [ ] 이력서 템플릿 폼 fallback UI 설계

#### 2-4. 자소서 생성 API
- [ ] Claude Sonnet 4.6 API 연동
- [ ] 프롬프트 설계 (공고 + 프로필 + RAG 결과 주입)
- [ ] 자소서 문항별 분리 생성
- [ ] 스트리밍 응답 구현 (UX 향상)

---

### Phase 3 - RAG 파이프라인 구축

#### 3-1. 어드민 데이터 입력
- [ ] 합격 자소서 입력 폼 구현 (회사명, 직군, 문항, 답변)
- [ ] 입력 데이터 저장 및 관리 (목록 조회, 수정, 삭제)

#### 3-2. 벡터 DB 구축
- [ ] Supabase pgvector 테이블 설계
- [ ] BGE-M3 모델로 Embedding 생성 (FlagEmbedding 라이브러리)
- [ ] 입력 데이터 Embedding 후 Supabase 저장
- [ ] 유사도 검색 쿼리 구현 (회사명 + 직군 + 문항 기반)

#### 3-3. RAG 연동
- [ ] 자소서 생성 시 관련 합격 자소서 검색
- [ ] 검색 결과를 프롬프트에 주입
- [ ] RAG 유무에 따른 품질 비교 테스트

---

### Phase 4 - 프론트엔드 구현

#### 4-1. 페이지 구성
- [ ] 메인 페이지 (서비스 소개)
- [ ] 공고 업로드 페이지
- [ ] 이력서/포트폴리오 업로드 페이지
- [ ] 이전 자소서 입력 페이지 (PDF 업로드 또는 텍스트 직접 입력)
- [ ] 이력서 템플릿 폼 페이지 (fallback)
- [ ] 자소서 생성 결과 페이지 (스트리밍 표시)
- [ ] 생성 기록 페이지
- [ ] 어드민 페이지 (합격 자소서 입력/관리)

#### 4-2. UI/UX
- [ ] 파일 드래그 앤 드롭 업로드
- [ ] 공고 분석 결과 미리보기 및 수정
- [ ] 이력서 분석 결과 미리보기 및 수정
- [ ] 자소서 실시간 스트리밍 출력
- [ ] 자소서 복사 / 다운로드 기능

---

### Phase 5 - 인증 및 사용자 관리

- [ ] Supabase Auth 설정
- [ ] Google OAuth 연동
- [ ] Naver OAuth 커스텀 provider 연동
- [ ] users 테이블에 `role` 컬럼 추가 (`user` / `admin`)
- [ ] Next.js 미들웨어로 `/admin` 경로 접근 시 role 체크 → admin 아니면 메인으로 리다이렉트
- [ ] 사용자별 이력서 저장 및 불러오기
- [ ] 생성된 자소서 히스토리 저장

---

### Phase 6 - 배포

- [ ] FastAPI → Railway / Render 배포
- [ ] Next.js → Vercel 배포
- [ ] Supabase 프로덕션 설정
- [ ] 환경변수 및 API 키 관리
- [ ] 도메인 연결

---

## DB 테이블 설계 (초안)

```sql
-- 사용자
users (id, email, name, role, created_at)  -- role: 'user' | 'admin'

-- 이력서
resumes (id, user_id, file_url, parsed_json, created_at)

-- 공고
job_postings (id, user_id, image_url, parsed_json, company, position, created_at)

-- 생성된 자소서
cover_letters (id, user_id, resume_id, job_posting_id, content_json, created_at)

-- 합격 자소서 (RAG용)
rag_documents (id, company, position, question, answer, embedding vector(1024), created_at)  -- BGE-M3 차원
```

---

## 리스크 및 고려사항

| 리스크 | 대응 방안 |
|--------|-----------|
| 이미지 기반 PDF 파싱 실패 | Gemini Vision fallback + 템플릿 폼 fallback |
| 네이버 OAuth Supabase 미지원 | 커스텀 OAuth provider 직접 구현 |
| 자소서 품질 편차 | 프롬프트 튜닝 + RAG 보강 |

---

## 현재 진행 상태

- [x] 기술 스택 확정
- [x] 전체 아키텍처 설계
- [x] 프로젝트 초기 세팅 (FastAPI + Next.js)
- [x] Phase 1 - PDF 파싱 검증 (pdfplumber + Claude Vision fallback + 구조화)
- [x] Phase 2 - 백엔드 핵심 기능 구현 (공고 분석 / 이력서 파싱 / 자소서 스트리밍 API)
- [x] Phase 3 - RAG 파이프라인 구축 (Supabase pgvector + BGE-M3 + 어드민 CRUD API)
- [x] Phase 4 - 프론트엔드 구현 (메인·생성·어드민 페이지)
- [x] **Phase 5 - 인증 및 사용자 관리** (Google OAuth + 이력서/자소서 저장 + 히스토리)
- [ ] **Phase 6 - 배포** ← 현재 단계
