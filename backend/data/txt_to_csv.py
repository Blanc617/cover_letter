"""
raw/ 폴더의 txt 파일 → rag_cover_letters.csv 변환

지원 포맷:
  - 표준형  : 질문Q1. / 보기 / 답변  (링커리어 관심기업)
  - 번호형  : 1. 질문텍스트 / 답변텍스트  (잡코리아 등)
  - 자유형식: 문항 구분 없이 자유 서술  → 전체를 하나의 Q&A로 처리

사용법: python data/txt_to_csv.py
출력:   data/rag_cover_letters.csv
"""

import csv
import re
from pathlib import Path

RAW_DIR    = Path(__file__).parent / "raw"
OUTPUT_CSV = Path(__file__).parent / "rag_cover_letters.csv"

FOLDER_TO_FIELD = {
    "웹개발":      "웹개발",
    "해외영업":    "해외영업",
    "AI데이터분석": "AI데이터분석",
}

# ── UI 노이즈 패턴 (링커리어·잡코리아 공통) ──────────────────────────
NOISE_RE = re.compile(
    r"^(자소서 작성|보고있는 합격자소서|스크랩하기|공유하기|새창|목록"
    r"|마음에 드는 문장|최고 품질의 상품들을|다시보지 않기"
    r"|문장 스크랩|복사|공유|기업정보 보러가기|보기"
    r"|👉.+링커리어.+|이 글은.+자기소개서 사례입니다"
    r"|.+채용공고.+합격자료.+|합격자소서 질문 및 내용"
    r"|합격자 정보.+|자소서 작성)$"
)
CHAR_COUNT_RE = re.compile(r"글자수\s*[\d,]+자[\d,]+Byte.*$")
CHAR_LIMIT_RE = re.compile(r"^\(\d+자\)$")  # (700자) 같은 글자수 안내


def is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if NOISE_RE.match(s):
        return True
    if CHAR_LIMIT_RE.match(s):
        return True
    return False


def clean_answer(line: str) -> str:
    """답변 줄 끝에 붙은 글자수 정보 제거"""
    return CHAR_COUNT_RE.sub("", line).strip()


def extract_company(filename: str, first_line: str) -> str:
    """회사명 추출 (번호형 첫 줄 우선, 없으면 파일명에서)"""
    if "/" in first_line:
        return first_line.split("/")[0].strip()
    name = Path(filename).stem
    name = re.sub(r"\s+관심기업.*$", "", name)
    parts = re.split(r"\s{2,}", name)
    return parts[0].strip()


# ── 표준형 파서 ──────────────────────────────────────────────────────
Q_START = re.compile(r"^질문\s*Q\d+\.?$")


def parse_standard(lines: list[str], company: str) -> list[dict]:
    rows = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if Q_START.match(line):
            # 질문 텍스트 수집
            q_lines = []
            i += 1
            while i < len(lines):
                l = lines[i].strip()
                if l in ("보기", "닫기", "답변") or Q_START.match(l):
                    break
                if l and not is_noise(l):
                    q_lines.append(l)
                i += 1
            question = " ".join(q_lines).strip()

            # '답변' 줄까지 스킵
            while i < len(lines) and lines[i].strip() != "답변":
                i += 1
            i += 1  # '답변' 줄 건너뜀

            # 답변 텍스트 수집
            a_lines = []
            while i < len(lines):
                l = lines[i].strip()
                if Q_START.match(l) or l == "닫기":
                    break
                if l and not is_noise(l):
                    cleaned = clean_answer(l)
                    if cleaned:
                        a_lines.append(cleaned)
                i += 1
            answer = "\n".join(a_lines).strip()

            if question and answer:
                rows.append({"company": company, "question": question, "answer": answer})
        else:
            i += 1
    return rows


# ── 번호형 파서 ──────────────────────────────────────────────────────
NUM_Q_RE = re.compile(r"^(\d+)\.\s+(.+)")


def parse_numbered(lines: list[str], company: str) -> list[dict]:
    # 질문 위치 수집
    q_positions = []
    for idx, line in enumerate(lines):
        m = NUM_Q_RE.match(line.strip())
        if m:
            q_positions.append((idx, m.group(2).strip()))

    if not q_positions:
        return []

    rows = []
    for j, (pos, q_first) in enumerate(q_positions):
        end_pos = q_positions[j + 1][0] if j + 1 < len(q_positions) else len(lines)

        # 질문 텍스트: 첫 줄 + 이어지는 비어있지 않은 줄 (빈 줄 전까지)
        q_lines = [q_first]
        k = pos + 1
        while k < end_pos:
            l = lines[k].strip()
            if not l:
                break
            if NUM_Q_RE.match(l) or is_noise(l) or CHAR_LIMIT_RE.match(l):
                k += 1
                continue
            q_lines.append(l)
            k += 1

        question = " ".join(q_lines).strip()

        # 답변 텍스트: 빈 줄 이후부터 다음 질문 전까지
        a_lines = []
        in_answer = False
        for m_idx in range(k, end_pos):
            l = lines[m_idx].strip()
            if not l:
                if in_answer:
                    a_lines.append("")
                continue
            if is_noise(l) or NUM_Q_RE.match(l):
                continue
            in_answer = True
            a_lines.append(l)

        answer = "\n".join(a_lines).strip()

        if question and answer:
            rows.append({"company": company, "question": question, "answer": answer})

    return rows


# ── 자유형식 파서 ────────────────────────────────────────────────────
FREE_SECTION_RE = re.compile(r"^\[.+\]$")


def parse_freeform(lines: list[str], company: str) -> list[dict]:
    """노이즈 제거 후 전체 내용을 하나의 Q&A로 반환"""
    content_lines = []
    for line in lines:
        l = line.strip()
        if not l or is_noise(l):
            continue
        # 헤더 정보 줄 스킵 (첫 1~2줄: 회사/학교 정보)
        if re.match(r"^.+/.+/.+$", l) and len(content_lines) < 3:
            continue
        content_lines.append(l)

    content = "\n".join(content_lines).strip()
    if not content:
        return []

    return [{"company": company, "question": "자유 형식 자기소개서", "answer": content}]


# ── 포맷 감지 ────────────────────────────────────────────────────────
def detect_format(text: str) -> str:
    if re.search(r"^질문\s*Q\d+", text, re.MULTILINE):
        return "standard"
    # 번호형: "1." 패턴이 2개 이상 있어야 번호형으로 판단
    matches = re.findall(r"^\d+\.\s+\S", text, re.MULTILINE)
    if len(matches) >= 2:
        return "numbered"
    return "freeform"


# ── 파일 파싱 ────────────────────────────────────────────────────────
def parse_file(filepath: Path, job_field: str) -> list[dict]:
    try:
        text = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    lines = text.splitlines()
    first_line = lines[0].strip() if lines else ""
    company = extract_company(filepath.name, first_line)
    fmt = detect_format(text)

    if fmt == "standard":
        rows = parse_standard(lines, company)
    elif fmt == "numbered":
        rows = parse_numbered(lines, company)
    else:
        rows = parse_freeform(lines, company)

    for row in rows:
        row["position"] = job_field

    return rows


# ── 메인 ────────────────────────────────────────────────────────────
def main():
    all_rows = []

    for folder_name, job_field in FOLDER_TO_FIELD.items():
        folder = RAW_DIR / folder_name
        if not folder.exists():
            print(f"[SKIP] 폴더 없음: {folder_name}")
            continue

        txt_files = sorted(folder.glob("*.txt"))
        print(f"\n[{folder_name}] {len(txt_files)}개 파일")

        for f in txt_files:
            rows = parse_file(f, job_field)
            print(f"  {'표준' if detect_format(f.read_text(encoding='utf-8', errors='ignore')) == 'standard' else '번호/자유'} | {len(rows):2d}개 | {f.name}")
            all_rows.extend(rows)

    print(f"\n총 {len(all_rows)}개 Q&A → {OUTPUT_CSV.name}")

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["company", "position", "question", "answer"])
        writer.writeheader()
        writer.writerows(all_rows)

    print("완료!")


if __name__ == "__main__":
    main()
