"""data/cv.yaml(공개용)로 CV PDF를 만들어 assets/cv/에 저장한다. 비공개 문구가 있으면 저장하지 않는다.

실행: %LOCALAPPDATA%\\cv-build\\venv\\Scripts\\python.exe tools/public_cv.py (pymupdf 필요)
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

PROJECT = Path(__file__).resolve().parents[1]
BUILD_CV = PROJECT.parents[2] / "3_Resources" / "CV" / "_system" / "build_cv.py"
OUTPUTS = {"*장현수_KR.pdf": "CV_HyeonsooJang_KR.pdf", "*HyeonsooJang_EN.pdf": "CV_HyeonsooJang_EN.pdf"}
FORBIDDEN = re.compile(r"7640|Daimler|벤츠|Benz|10-2026-0194890|10-2025-0200611|만원|KRW|증빙|evidence", re.I)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    text = (PROJECT / "data" / "cv.yaml").read_text(encoding="utf-8").replace("\r\n", "\n")
    # 공개 전 특허는 번호가 없다. CV 도구는 "-"를 번호 없는 출원으로 표시한다.
    text = re.sub(r"(?m)^(\s+)application:\n\1  date:", r'\1application:\n\1  no: "-"\n\1  date:', text)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "cv.yaml").write_text(text, encoding="utf-8")
        subprocess.run([sys.executable, str(BUILD_CV), "--root", str(root), "--lang", "all"], check=True)
        target = PROJECT / "assets" / "cv"
        target.mkdir(exist_ok=True)
        for pattern, name in OUTPUTS.items():
            doc = pymupdf.open(next((root / "출력").glob(pattern)))
            found = FORBIDDEN.findall("".join(page.get_text() for page in doc))
            if found:
                print(f"{name}: 비공개 문구 발견 {found}, 저장하지 않음")
                return 1
            doc.set_metadata({"title": "CV", "author": "Hyeonsoo Jang"})
            doc.save(target / name, garbage=3, deflate=True)
            doc.close()
            print(f"저장: assets/cv/{name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
