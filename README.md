# hsjang545.github.io

장현수의 개인 이력 사이트. 주소: https://hsjang545.github.io

## 내용 고치기

| 고칠 내용 | 파일 |
| --- | --- |
| 경력, 과제, 논문, 특허, 수상, 장학, 교육 | 구글드라이브의 `3_Resources/CV/cv.yaml`을 고친 뒤 `npm run sync` |
| 소개 문구, 연구 주제, 추가 수상·교육, 리뷰어, 세미나, 전시회, 봉사 | `data/site.yaml` |
| 사진 | `assets/photo.jpg` |
| 디자인 | `assets/style.css` |

`data/cv.yaml`은 자동 생성 파일이므로 직접 고치지 않는다.

## 명령

```bash
npm ci          # 처음 한 번
npm run sync    # cv.yaml에서 공개 항목만 가져오기
npm test        # 빌드 후 검사
```

`main`에 올리면 GitHub Actions가 검사를 통과한 경우에만 배포한다.

## 공개하지 않는 것

`tools/sync-cv.mjs`가 전화번호, 증빙 파일 경로, 철회 논문, 장학금 금액, 양산차 고객사, 공개 전 특허의 출원번호를 뺀다. 이 저장소와 사이트는 누구나 볼 수 있으므로 증빙 원본을 올리지 않는다.
