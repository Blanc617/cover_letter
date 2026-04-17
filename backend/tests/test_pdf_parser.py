"""
PDF 파싱 검증 테스트
사용법: python tests/test_pdf_parser.py <PDF 파일 경로>
"""

import sys
import json
import io
from pathlib import Path

# Windows 콘솔 UTF-8 출력
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 프로젝트 루트를 path에 추가
sys.path.append(str(Path(__file__).parent.parent))

from app.parsers.pdf_parser import parse_pdf
from app.parsers.resume_structurer import structure_resume


def test_pdf(pdf_path: str):
    print(f"\n{'='*60}")
    print(f"테스트 파일: {pdf_path}")
    print('='*60)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    # 1. 파싱 테스트
    print("\n[1단계] PDF 텍스트 추출 중...")
    result = parse_pdf(pdf_bytes)

    print(f"  파싱 방법: {result['method']}")
    print(f"  페이지 수: {result['page_count']}")
    print(f"  성공 여부: {result['success']}")
    print(f"  추출 글자 수: {len(result['text'])}자")

    if not result['success']:
        print(f"  오류: {result.get('error')}")
        return

    print(f"\n[추출 텍스트 미리보기 (앞 500자)]")
    print("-" * 40)
    print(result['text'][:500])
    print("-" * 40)

    # 2. 구조화 테스트
    print("\n[2단계] 이력서 구조화 중...")
    try:
        structured = structure_resume(result['text'])
        print("\n[구조화 결과]")
        print(json.dumps(structured, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"  구조화 실패: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python tests/test_pdf_parser.py <PDF 파일 경로>")
        print("예시:   python tests/test_pdf_parser.py tests/sample_pdfs/resume.pdf")
        sys.exit(1)

    test_pdf(sys.argv[1])
