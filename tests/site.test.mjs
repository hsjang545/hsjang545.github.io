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

test('국문·영문 6개 페이지가 모두 생성된다', () => {
  for (const p of ['index', 'research', 'projects', 'publications', 'cv', 'etc']) {
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
  const projects = raw(join(SITE, 'projects.html'));
  for (const p of cv.projects) assert.ok(projects.includes(`id="${p.key}"`), p.key);
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

test('의뢰·이직 제안 문구가 없다', () => {
  for (const f of htmlFiles) assert.ok(!/의뢰|이직|채용 문의|hire me|open to/i.test(raw(f)), f);
});
