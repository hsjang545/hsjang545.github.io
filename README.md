# hsjang545.github.io

장현수의 개인 이력 사이트. 주소: https://hsjang545.github.io

기술 글은 별도 저장소 [hsjang545/notes](https://github.com/hsjang545/notes) (https://hsjang545.github.io/notes/)다.

## 내용 고치기

| 고칠 내용 | 파일 |
| --- | --- |
| 경력, 과제, 논문, 특허, 수상, 장학, 교육 | 구글드라이브의 `3_Resources/CV/cv.yaml`을 고친 뒤 아래 "CV 반영" 절차 |
| 소개 문구, 연구 주제, 추가 수상·교육, 리뷰어, 세미나, 전시회, 봉사 | `data/site.yaml` |
| 사진 | `assets/photo.jpg` |
| 디자인 | `assets/style.css` |
| 소개 자료 슬라이드 | 구글드라이브 `3_Resources/CV/개인페이지_소개PPT/`의 PPT를 고친 뒤 `assets/deck/slide-NN.jpg`로 다시 내보내고 `data/deck.yaml` 갱신 |
| 연구 페이지 그림 | `assets/figures/`, 설명은 `data/site.yaml`의 `figures` |

`data/cv.yaml`은 자동 생성 파일이므로 직접 고치지 않는다. 논문 원문 PDF와 PPT 원본은 올리지 않으며 테스트가 이를 검사한다. 공개 PDF는 `assets/cv/`의 공개용 CV뿐이다. 증빙과 원본 CV 출력은 구글드라이브 `3_Resources/CV/개인페이지_비공개/`에 두고 이 저장소에는 올리지 않는다.

## 작업 방식

사이트 파일은 로컬(구글드라이브 포함)에 두지 않고 GitHub에서만 관리한다.

- 문구·설정·그림 수정: GitHub 웹 편집기(저장소 화면에서 `.` 키) 또는 Codespaces에서 고치고 커밋한다.
- `main`에 올리면 GitHub Actions가 `npm test`(빌드와 검사)를 통과한 경우에만 배포한다. 실패하면 Actions 탭에서 원인을 본다.

### CV 반영

원본 `cv.yaml`과 CV 생성 도구는 비공개 정보가 있어 구글드라이브(`3_Resources/CV/`)에 있다. 반영할 때만 드라이브 밖 임시 폴더에 내려받아 실행하고 지운다.

```bash
gh repo clone hsjang545/hsjang545.github.io "$TEMP/site" && cd "$TEMP/site"
npm ci
npm run sync      # 드라이브 cv.yaml → data/cv.yaml (다른 위치면 CV_SOURCE 지정)
npm test          # 빌드와 검사
"$LOCALAPPDATA/cv-build/venv/Scripts/python.exe" tools/public_cv.py   # 공개용 CV PDF 갱신 (CV_BUILD로 도구 위치 지정 가능)
git add -A && git commit -m "CV 갱신" && git push
```

## 공개하지 않는 것

`tools/sync-cv.mjs`가 전화번호, 증빙 파일 경로, 철회 논문, 장학금 금액, 양산차 고객사, 공개 전 특허의 출원번호를 뺀다. 수탁과제 로고는 `data/site.yaml`의 `project_logos`에서 정하며, MPC5.5 과제는 다임러 로고를 공개한다. 이 저장소와 사이트는 누구나 볼 수 있으므로 증빙 원본을 올리지 않는다.
