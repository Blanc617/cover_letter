"""
합격 자소서 수동 입력 → AI 파싱 → Supabase 저장
사용법: python data/add_rag.py
"""

import sys
import os
import json
import time
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
supabase      = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


# ── 텍스트 입력 (멀티라인) ─────────────────────────────────────────────────

def input_multiline(prompt: str) -> str:
    """여러 줄 입력. 빈 줄 2번 연속 입력 시 종료."""
    print(prompt)
    print("(입력 완료 시 빈 줄에서 Enter 2번)\n")
    lines = []
    empty_count = 0
    while True:
        line = input()
        if line == "":
            empty_count += 1
            if empty_count >= 2:
                break
            lines.append(line)
        else:
            empty_count = 0
            lines.append(line)
    return "\n".join(lines).strip()


# ── GPT로 문항/답변 분리 ──────────────────────────────────────────────────

def parse_cover_letter(company: str, position: str, raw_text: str) -> list[dict]:
    """
    자소서 전체 텍스트에서 문항과 답변 쌍을 추출
    Returns: [{"question": str, "answer": str}, ...]
    """
    prompt = f"""다음은 '{company}' 기업의 '{position}' 직군 합격 자기소개서입니다.
자기소개서에서 문항과 답변 쌍을 모두 추출해주세요.

규칙:
- 문항이 명시되지 않은 경우 내용을 바탕으로 문항을 추정해주세요
- 답변은 원문 그대로 보존해주세요
- 반드시 유효한 JSON 배열만 반환하세요

자기소개서:
{raw_text}

반환 형식:
[
  {{"question": "문항 내용", "answer": "답변 내용"}},
  {{"question": "문항 내용", "answer": "답변 내용"}}
]"""

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000
    )

    text = response.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


# ── 임베딩 생성 ───────────────────────────────────────────────────────────

def get_embedding(company: str, position: str, question: str, answer: str) -> list[float]:
    combined = f"회사: {company}\n직군: {position}\n문항: {question}\n답변: {answer}"
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=combined
    )
    return response.data[0].embedding


# ── Supabase 저장 ─────────────────────────────────────────────────────────

def save_to_db(company: str, position: str, pairs: list[dict]):
    saved = 0
    for pair in pairs:
        embedding = get_embedding(company, position, pair["question"], pair["answer"])
        supabase.table("rag_cover_letters").insert({
            "company":   company,
            "job_field": position,
            "question":  pair["question"],
            "answer":    pair["answer"],
            "embedding": embedding
        }).execute()
        saved += 1
        time.sleep(0.2)
    return saved


# ── 메인 ─────────────────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("  합격 자소서 입력기")
    print("=" * 50)

    while True:
        print()
        company  = input("회사명: ").strip()
        position = input("직군:   ").strip()

        if not company or not position:
            print("회사명과 직군을 입력해주세요.")
            continue

        raw_text = input_multiline("\n자소서 전체 텍스트를 붙여넣으세요:")

        if not raw_text:
            print("텍스트가 비어있습니다.")
            continue

        # 파싱
        print("\n문항/답변 분리 중...")
        try:
            pairs = parse_cover_letter(company, position, raw_text)
        except Exception as e:
            print(f"파싱 오류: {e}")
            continue

        # 결과 미리보기
        print(f"\n총 {len(pairs)}개 문항 추출됨:")
        print("-" * 40)
        for i, pair in enumerate(pairs, 1):
            print(f"[{i}] {pair['question'][:60]}...")
            print(f"    {pair['answer'][:80]}...")
            print()

        # 확인
        confirm = input("저장할까요? (y/n): ").strip().lower()
        if confirm != "y":
            print("취소되었습니다.")
        else:
            print("저장 중...")
            try:
                saved = save_to_db(company, position, pairs)
                print(f"{saved}개 저장 완료!")
            except Exception as e:
                print(f"저장 오류: {e}")

        # 계속 여부
        print()
        cont = input("다음 자소서 입력? (y/n): ").strip().lower()
        if cont != "y":
            print("\n완료!")
            break


if __name__ == "__main__":
    main()
