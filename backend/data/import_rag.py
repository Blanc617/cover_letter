"""
합격 자소서 CSV → 임베딩 생성 → Supabase 일괄 업로드
사용법: python data/import_rag.py data/rag_cover_letters.csv
"""

import sys
import csv
import os
import time
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY")
SUPABASE_URL    = os.getenv("SUPABASE_URL")
SUPABASE_KEY    = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

openai_client   = OpenAI(api_key=OPENAI_API_KEY)
supabase        = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_embedding(text: str) -> list[float]:
    """OpenAI text-embedding-3-small로 임베딩 생성"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


def embed_text(company: str, position: str, question: str, answer: str) -> list[float]:
    """검색 품질을 위해 문항+답변을 합쳐서 임베딩"""
    combined = f"회사: {company}\n직군: {position}\n문항: {question}\n답변: {answer}"
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

            supabase.table("rag_cover_letters").insert({
                "company":   company,
                "job_field": position,
                "question":  question,
                "answer":    answer,
                "embedding": embedding
            }).execute()

            print(f"  → 저장 완료")
            success += 1

            # API 속도 제한 방지
            time.sleep(0.3)

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
