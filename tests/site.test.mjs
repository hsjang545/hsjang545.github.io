import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { sanitize } from '../tools/sync-cv.mjs';

const SITE = '_site';
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(SITE).filter((f) => f.endsWith('.html'));
const raw = (f) => readFileSync(f, 'utf8');

// 공개되면 안 되는 내용. 전화번호, 양산차 고객사, 내부 증빙 경로, 철회 논문, 장학금 금액.
const FORBIDDEN = [/7640/, /Daimler/i, /벤츠/, /Benz/i, /증빙\b/, /evidence/i, /ICAIMLSC/, /1,048/, /1,000,000/, /100만원/, /10-2026-0194890/, /10-2025-0200611/];

test('공개 데이터와 페이지에 비공개 정보가 없다', () => {
  for (const f of ['data/cv.yaml', ...htmlFiles]) {
    const text = raw(f);
    for (const re of FORBIDDEN) assert.ok(!re.test(text), `${f}: ${re}`);
  }
});

test('sanitize가 내부 필드를 제거한다', () => {
  const out = sanitize({
    profile: { phone: 'x', photo: 'y', email: 'e' },
    projects: [{ key: 'p', evidence: ['a'], translated: 'ko', hidden: false }],
    publications: [{ key: 'h', hidden: true }, { key: 'v' }],
    scholarships: [{ key: 's', description: { ko: '장학금 100만원', en: 'KRW 1' } }, { key: 't', description: { ko: '4개 학기' } }],
    patents: [
      { kind: 'kr_application', application: { no: '1', date: 'd' } },
      { kind: 'kr_application', application: { no: '2', date: 'd' }, publication: { no: '3' } },
    ],
  });
  assert.deepEqual(out.profile, { email: 'e' });
  assert.equal(out.projects[0].evidence, undefined);
  assert.equal(out.projects[0].translated, undefined);
  assert.deepEqual(out.publications.map((p) => p.key), ['v']);
  assert.equal(out.scholarships[0].description, undefined);
  assert.deepEqual(out.scholarships[1].description, { ko: '4개 학기' });
  assert.equal(out.patents[0].application.no, undefined);
  assert.equal(out.patents[1].application.no, '2');
});

test('공개 CV 외의 PDF가 사이트와 저장 자료에 없다', () => {
  const allowed = /assets[\\/]cv[\\/]CV_HyeonsooJang_EN\.pdf$/;
  const files = [...walk(SITE), ...walk('assets'), ...walk('data')];
  for (const f of files) assert.ok(!/\.pdf$/i.test(f) || allowed.test(f), f);
  for (const f of htmlFiles) {
    for (const [, u] of raw(f).matchAll(/(?:href|src)="([^"]*\.pdf)/gi)) assert.ok(allowed.test(u), `${f}: ${u}`);
  }
  assert.ok(raw(join(SITE, 'index.html')).includes('href="assets/cv/CV_HyeonsooJang_EN.pdf" download'));
  assert.ok(raw(join(SITE, 'en', 'index.html')).includes('href="../assets/cv/CV_HyeonsooJang_EN.pdf" download'));
});

test('소개 자료를 슬라이드 이미지로 넘겨 볼 수 있고 PPT 원본은 없다', () => {
  const slides = parse(raw('data/deck.yaml'));
  for (const f of ['index.html', join('en', 'index.html')]) {
    const page = raw(join(SITE, f));
    assert.equal(page.split('assets/deck/').length - 1, slides.length, f);
    for (const c of ['deck-prev', 'deck-next', 'deck-count']) assert.ok(page.includes(c), c);
  }
  assert.ok(!walk(SITE).some((f) => /\.pptx?$/i.test(f)));
});

test('연구와 프로젝트가 한 탭으로 합쳐지고 이전 주소는 이동한다', () => {
  for (const f of htmlFiles.filter((x) => !/projects\.html$/.test(x))) assert.ok(!raw(f).includes('href="projects.html"'), f);
  assert.ok(raw(join(SITE, 'projects.html')).includes('url=research.html'));
  assert.ok(raw(join(SITE, 'en', 'projects.html')).includes('url=research.html'));
});

test('국문·영문 4개 페이지가 모두 생성되고 CV 탭은 없다', () => {
  assert.ok(!raw(join(SITE, 'index.html')).includes('href="cv.html"'));
  assert.ok(raw(join(SITE, 'cv.html')).includes('url=index.html'));
  for (const p of ['index', 'research', 'publications', 'etc']) {
    assert.ok(existsSync(join(SITE, `${p}.html`)), p);
    assert.ok(existsSync(join(SITE, 'en', `${p}.html`)), `en/${p}`);
  }
});

test('사이트 안의 모든 링크와 앵커가 유효하다', () => {
  for (const f of htmlFiles) {
    for (const [, attr] of raw(f).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(attr)) continue;
      const [path, hash] = attr.split('#');
      const target = path ? resolve(dirname(f), path) : resolve(f);
      assert.ok(existsSync(target), `${f} -> ${attr}`);
      if (hash) assert.ok(raw(target).includes(`id="${hash}"`), `${f} -> ${attr}`);
    }
  }
});

test('모든 공개 항목이 페이지에 나온다', () => {
  const cv = parse(raw('data/cv.yaml'));
  const pubs = raw(join(SITE, 'publications.html'));
  for (const p of [...cv.publications, ...cv.patents]) assert.ok(pubs.includes(`id="${p.key}"`), p.key);
  for (const k of ['proj-sdv', 'proj-mixed-traffic']) assert.ok(!raw(join(SITE, 'research.html')).includes(k), k);
  const research = raw(join(SITE, 'research.html'));
  for (const p of cv.projects) assert.equal(research.split(`id="${p.key}"`).length, 2, p.key);
});

test('국문 페이지도 국제 실적은 영어로, 본인 이름은 굵게 표기한다', () => {
  const ko = raw(join(SITE, 'publications.html'));
  const item = (key) => ko.match(new RegExp(`<li id="${key}">.*?</li>`))[0];
  assert.ok(ko.includes('>SCIE (1)<') && !ko.includes('국제 학술지'));
  assert.ok(item('pub-access-2025').includes('<strong>Jang, H.</strong>') && !/[가-힣]/.test(item('pub-access-2025')));
  assert.ok(item('pub-iccad-2023').includes('<strong>Jang, H.</strong>') && !/[가-힣]/.test(item('pub-iccad-2023')));
  assert.ok(item('pat-traffic-flow-pct').includes('Apparatus for Generating') && item('pat-traffic-flow-pct').includes('해외 출원'));
  assert.ok(item('pub-ksae-2023-rules').includes('<strong>장현수</strong>'));
  const cv = parse(raw('data/cv.yaml'));
  for (const l of ['', 'en/']) {
    const page = raw(join(SITE, `${l}publications.html`));
    for (const p of [...cv.publications, ...cv.patents]) {
      assert.ok(page.match(new RegExp(`<li id="${p.key}">.*?</li>`))[0].includes('<strong>'), `${l}${p.key}`);
    }
  }
});

test('기타 페이지에 봉사 기간과 내역이 나온다', () => {
  const etc = raw(join(SITE, 'etc.html'));
  for (const s of ['2016.10 – 2019.12', '자원봉사 총 122시간', '시흥에코센터', '고운지역아동센터', '충인지역아동센터']) {
    assert.ok(etc.includes(s), s);
  }
});

test('공개·등록 특허에만 도면이 있고 기술 자문이 기타에 나온다', () => {
  const ko = raw(join(SITE, 'publications.html'));
  const item = (key) => ko.match(new RegExp(`<li id="${key}">.*?</li>`))[0];
  assert.ok(item('pat-avoidance-path').includes('pat-avoidance-2.jpg'));
  assert.ok(item('pat-traffic-flow-kr').includes('pat-traffic-3.jpg'));
  for (const k of ['pat-occupant-restraint', 'pat-semiconductor-comm', 'pat-traffic-flow-pct']) assert.ok(!item(k).includes('<figure'), k);
  assert.ok(raw(join(SITE, 'etc.html')).includes('(주)HRC테크놀로지'));
  assert.ok(raw(join(SITE, 'index.html')).includes('빅데이터·AIDV연구본부'));
});

test('의뢰·이직 제안 문구가 없다', () => {
  for (const f of htmlFiles) assert.ok(!/의뢰|이직|채용 문의|hire me|open to/i.test(raw(f)), f);
});
