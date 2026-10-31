# hsjang545.github.io

장현수의 개인 이력 사이트. 주소: https://hsjang545.github.io

## 내용 고치기

| 고칠 내용 | 파일 |
| --- | --- |
| 경력, 과제, 논문, 특허, 수상, 장학, 교육 | 구글드라이브의 `3_Resources/CV/cv.yaml`을 고친 뒤 `npm run sync` |
| 소개 문구, 연구 주제, 추가 수상·교육, 리뷰어, 세미나, 전시회, 봉사 | `data/site.yaml` |
| 사진 | `assets/photo.jpg` |
| 디자인 | `assets/style.css` |

| 소개 자료 슬라이드 | `_초안/`의 PPT를 고친 뒤 `assets/deck/slide-NN.jpg`로 다시 내보내고 `data/deck.yaml` 갱신 |
| 연구 페이지 그림 | `assets/figures/`, 설명은 `data/site.yaml`의 `figures` |

`data/cv.yaml`은 자동 생성 파일이므로 직접 고치지 않는다. 논문 원문 PDF와 PPT 원본은 올리지 않으며 테스트가 이를 검사한다. 공개 PDF는 `assets/cv/`의 공개용 CV뿐이다. `_비공개/`(증빙, 원본 CV 출력)는 Git에서 제외되며 올리면 안 된다. CV를 고치면 `node tools/check.mjs --sync` 후 `%LOCALAPPDATA%\cv-build\venv\Scripts\python.exe tools/public_cv.py`를 실행한다.

## 명령

```bash
node tools/check.mjs          # 빌드 후 검사
node tools/check.mjs --sync   # cv.yaml에서 공개 항목을 가져온 뒤 빌드 후 검사
git add -A && git commit -m "내용" && git push   # 배포
```

`main`에 올리면 GitHub Actions가 검사를 통과한 경우에만 배포한다.

이 폴더는 구글드라이브에 있다. 드라이브 안에서는 `npm ci`가 실패하고 `node_modules`를 동기화할 이유도 없으므로, `check.mjs`가 `%LOCALAPPDATA%\hsjang545-site`에 복사해 실행한다. 이 폴더에서 `npm ci`를 직접 실행하지 않는다. `.git`도 드라이브로 동기화되므로 한 번에 PC 한 대에서만 작업한다.

## 공개하지 않는 것

`tools/sync-cv.mjs`가 전화번호, 증빙 파일 경로, 철회 논문, 장학금 금액, 양산차 고객사, 공개 전 특허의 출원번호를 뺀다. 이 저장소와 사이트는 누구나 볼 수 있으므로 증빙 원본을 올리지 않는다.
