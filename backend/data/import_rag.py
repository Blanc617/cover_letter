"""
합격 자소서 CSV → 임베딩 생성 → Supabase 일괄 업로드
사용법: python data/import_rag.py data/rag_cover_letters.csv
"""

import sys
import csv
import os
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

print("BGE-M3 모델 로딩 중...")
embedding_model = SentenceTransformer("BAAI/bge-m3")
supabase        = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_embedding(text: str) -> list[float]:
    """BGE-M3로 임베딩 생성"""
    return embedding_model.encode(text).tolist()


def embed_text(company: str, position: str, question: str, answer: str) -> list[float]:
    """검색 쿼리와 동일한 구조(회사+직군+문항)로 임베딩 — 답변 제외로 검색 정확도 향상"""
    combined = f"회사: {company}\n직군: {position}\n문항: {question}"
    return get_embedding(combined)


def import_csv(csv_path: str):
    print(f"\n파일 읽는 중: {csv_path}")

    rows = []
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"총 {len(rows)}개 항목 발견\n")

    success, fail = 0, 0

    for i, row in enumerate(rows, 1):
        company  = row.get("company", "").strip()
        position = row.get("position", "").strip()
        question = row.get("question", "").strip()
        answer   = row.get("answer", "").strip()

        if not all([company, position, question, answer]):
            print(f"[{i}/{len(rows)}] 건너뜀 (빈 필드): {row}")
            fail += 1
            continue

        try:
            print(f"[{i}/{len(rows)}] {company} / {position} - 임베딩 생성 중...")
            embedding = embed_text(company, position, question, answer)

            supabase.table("rag_documents").insert({
                "company":   company,
                "position":  position,
                "question":  question,
                "answer":    answer,
                "embedding": embedding
            }).execute()

            print(f"  → 저장 완료")
            success += 1

        except Exception as e:
            print(f"  → 오류: {e}")
            fail += 1

    print(f"\n{'='*40}")
    print(f"완료: 성공 {success}개 / 실패 {fail}개")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python data/import_rag.py <CSV 파일 경로>")
        print("예시:   python data/import_rag.py data/rag_cover_letters.csv")
        sys.exit(1)

    import_csv(sys.argv[1])
