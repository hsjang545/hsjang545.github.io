// 구글드라이브의 cv.yaml에서 공개할 내용만 추려 data/cv.yaml로 저장한다.
// 저장소와 사이트는 공개되므로, 원본을 그대로 복사하지 않는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';

const SOURCE = process.env.CV_SOURCE ?? 'G:/내 드라이브/3_Resources/CV/cv.yaml';
const TARGET = new URL('../data/cv.yaml', import.meta.url);

// 내부 관리용 필드는 어느 깊이에 있어도 제거한다.
const INTERNAL_FIELDS = new Set(['evidence', 'translated', 'sort_date']);

function stripInternal(value) {
  if (Array.isArray(value)) return value.filter((v) => !v?.hidden).map(stripInternal);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !INTERNAL_FIELDS.has(k))
        .map(([k, v]) => [k, stripInternal(v)]),
    );
  }
  return value;
}

export function sanitize(source) {
  const cv = stripInternal(source);

  // 연락처는 이메일만, 사진 경로는 사이트에서 따로 관리한다.
  delete cv.profile.phone;
  delete cv.profile.photo;

  // 장학금 금액은 공개하지 않는다.
  for (const s of cv.scholarships ?? []) delete s.description;

  // 고객사 양산차 정보는 공개하지 않는다.
  const mpc = cv.projects.find((p) => p.key === 'proj-mpc55-adas');
  if (mpc) {
    mpc.sponsor = { ko: 'LG전자', en: 'LG Electronics' };
    mpc.summary[0] = {
      ko: '법규·표준·NCAP 및 완성차 요구사항 기반 ADAS 검증 설계 및 수행',
      en: 'Designed and executed ADAS validation based on global safety regulations and OEM requirements (NCAP, ISO, UNECE)',
    };
  }

  // 공개 전 특허 출원은 번호를 표시하지 않는다.
  for (const p of cv.patents ?? []) {
    if (p.kind === 'kr_application' && !p.publication) delete p.application.no;
  }
  return cv;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  // 원본의 "KRW 1,000,000"처럼 따옴표 없는 쉼표가 중복 키로 읽히는 경우가 있어 허용한다.
  // 해당 필드(장학금 금액)는 sanitize에서 제거된다.
  const cv = sanitize(parse(readFileSync(SOURCE, 'utf8'), { uniqueKeys: false }));
  const header = '# tools/sync-cv.mjs가 생성한 공개용 데이터. 직접 고치지 말고 원본 cv.yaml을 고친 뒤 npm run sync를 실행한다.\n';
  writeFileSync(TARGET, header + stringify(cv, { lineWidth: 0 }));
  console.log('data/cv.yaml 저장 완료');
}
