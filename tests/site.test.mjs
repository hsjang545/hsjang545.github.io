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

// 공개되면 안 되는 내용. 전화번호, 내부 증빙 경로, 철회 논문, 장학금 금액.
const FORBIDDEN = [/7640/, /증빙\b/, /evidence/i, /ICAIMLSC/, /1,048/, /1,000,000/, /100만원/, /10-2026-0194890/, /10-2025-0200611/];

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

test('연구와 프로젝트가 별도 탭이고 서로 연결된다', () => {
  const cv = parse(raw('data/cv.yaml'));
  const site = parse(raw('data/site.yaml'));
  for (const l of ['', 'en/']) {
    const research = raw(join(SITE, `${l}research.html`));
    const projects = raw(join(SITE, `${l}projects.html`));
    assert.ok(!projects.includes('http-equiv="refresh"'), `${l}projects.html`);
    assert.ok(research.includes('href="projects.html"') && projects.includes('aria-current="page"'));
    assert.ok(!/id="proj-/.test(research), `${l}research.html에 과제 본문이 없다`);
    for (const r of site.research) {
      for (const k of r.projects) assert.ok(research.includes(`href="projects.html#${k}"`), `${l}${r.id} -> ${k}`);
    }
    for (const p of cv.projects.filter((x) => !site.hidden_projects.includes(x.key))) {
      const entry = projects.split(`<li id="${p.key}"`)[1].split('<li id="proj-')[0];
      assert.ok(entry.includes('href="research.html#'), `${l}${p.key}`);
    }
  }
  // 과제가 연구 페이지에 있던 때의 앵커는 프로젝트 페이지로 보낸다.
  assert.ok(raw(join(SITE, 'research.html')).includes("location.replace('projects.html'+location.hash)"));
});

test('스타일시트 주소에 버전이 붙고 로고 크기가 HTML에 지정된다', () => {
  for (const f of htmlFiles.filter((x) => !raw(x).includes('http-equiv="refresh"'))) {
    assert.ok(/assets\/style\.css\?v=[0-9a-f]{8}"/.test(raw(f)), f);
  }
  assert.ok(/assets\/deck\/slide-01\.jpg\?v=[0-9a-f]{8}"/.test(raw(join(SITE, 'index.html'))));
  for (const [, tag] of raw(join(SITE, 'projects.html')).matchAll(/(<img class="logo[^>]*>)/g)) assert.ok(/width="\d+" height="\d+"/.test(tag), tag);
});

test('경력·학력은 기관별로 묶고 기관마다 로고가 한 번 나온다', () => {
  for (const [f, up] of [['index.html', ''], [join('en', 'index.html'), '../']]) {
    const page = raw(join(SITE, f));
    for (const file of ['katech.png', 'gist.svg', 'tukorea.png']) {
      assert.equal(page.split(`src="${up}assets/logos/${file}"`).length, 2, `${f}: ${file}`);
    }
  }
});

test('소개 페이지는 경력·학력, 연구 분야, 소개 자료 순서다', () => {
  for (const f of ['index.html', join('en', 'index.html')]) {
    const page = raw(join(SITE, f));
    const at = [page.indexOf('class="block two"'), page.indexOf('class="areas"'), page.indexOf('id="deck"')];
    assert.ok(at.every((i) => i > 0) && at[0] < at[1] && at[1] < at[2], `${f}: ${at}`);
  }
});

test('소개 페이지에 실적 개수를 표시하지 않는다', () => {
  for (const f of ['index.html', join('en', 'index.html')]) assert.ok(!raw(join(SITE, f)).includes('class="tally"'), f);
});

test('모든 과제에 정부 상징 또는 발주처 로고가 나온다', () => {
  const site = parse(raw('data/site.yaml'));
  for (const l of ['', 'en/']) {
    const projects = raw(join(SITE, `${l}projects.html`));
    for (const k of [...site.project_kinds.national, ...site.project_kinds.contract]) assert.ok(site.project_logos[k], k);
    for (const [k, value] of Object.entries(site.project_logos)) {
      const entry = projects.split(`<li id="${k}"`)[1].split('<li id="proj-')[0];
      for (const logo of [value].flat()) {
        assert.equal(Boolean(logo.label), site.project_kinds.national.includes(k), k);
        assert.ok(entry.includes(`assets/logos/${logo.file}`), `${l}${k}: ${logo.file}`);
      }
    }
    const mpc = projects.split('<li id="proj-mpc55-adas"')[1];
    assert.ok(mpc.indexOf('lg.svg') < mpc.indexOf('daimler.svg'));
  }
});

test('소개 페이지에 연구 분야가 요약되고 연구 페이지로 연결된다', () => {
  const site = parse(raw('data/site.yaml'));
  const index = raw(join(SITE, 'index.html'));
  for (const r of site.research) assert.equal(index.includes(`href="research.html#${r.id}"`), r.on_intro !== false, r.id);
  assert.ok(raw(join(SITE, 'research.html')).includes('id="slam"'));
});

test('국문·영문 5개 페이지가 모두 생성되고 CV 탭은 없다', () => {
  assert.ok(!raw(join(SITE, 'index.html')).includes('href="cv.html"'));
  assert.ok(raw(join(SITE, 'cv.html')).includes('url=index.html'));
  for (const p of ['index', 'research', 'projects', 'publications', 'etc']) {
    assert.ok(existsSync(join(SITE, `${p}.html`)), p);
    assert.ok(existsSync(join(SITE, 'en', `${p}.html`)), `en/${p}`);
  }
});

test('사이트 안의 모든 링크와 앵커가 유효하다', () => {
  for (const f of htmlFiles) {
    for (const [, attr] of raw(f).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(attr)) continue;
      const [path, hash] = attr.replace(/\?[^#]*/, '').split('#');
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
  for (const f of ['research.html', 'projects.html']) {
    for (const k of ['proj-sdv', 'proj-mixed-traffic']) assert.ok(!raw(join(SITE, f)).includes(k), `${f}: ${k}`);
  }
  const projects = raw(join(SITE, 'projects.html'));
  const site = parse(raw('data/site.yaml'));
  for (const p of cv.projects) assert.equal(projects.split(`id="${p.key}"`).length, site.hidden_projects.includes(p.key) ? 1 : 2, p.key);
  for (const k of site.hidden_projects) assert.ok(!raw(join(SITE, 'research.html')).includes(k), k);
});

test('국문 페이지도 국제 실적은 영어로, 본인 이름은 굵게 표기한다', () => {
  const ko = raw(join(SITE, 'publications.html'));
  const item = (key) => ko.match(new RegExp(`<li id="${key}">.*?</li>`))[0];
  assert.ok(ko.includes('>SCIE (1)<') && !ko.includes('국제 학술지'));
  assert.ok(item('pub-access-2025').includes('<strong>Jang, H.</strong>') && !/[가-힣]/.test(item('pub-access-2025')));
  assert.ok(item('pub-iccad-2023').includes('<strong>Jang, H.</strong>') && !/[가-힣]/.test(item('pub-iccad-2023')));
  assert.ok(item('pat-traffic-flow-pct').includes('Apparatus for Generating'));
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

test('논문·특허 페이지는 논문과 특허 묶음 아래 세부 구분을 두고 도면은 없다', () => {
  const ko = raw(join(SITE, 'publications.html'));
  const papers = ko.split('<section class="pub-group" id="papers">')[1].split('</section>')[0];
  const patents = ko.split('<section class="pub-group" id="patents">')[1].split('</section>')[0];
  assert.ok(papers.startsWith('<h2>논문 (') && patents.startsWith('<h2>특허 ('));
  assert.ok(papers.includes('<h3>International conference (') && !ko.includes('국제 학술대회'));
  // 세부 구분 제목 바로 뒤의 목록에 해당 특허가 들어 있다.
  const rowOf = (title) => patents.split(`<h3>${title} (`)[1]?.split('</ul>')[0] ?? '';
  for (const k of ['pat-occupant-restraint', 'pat-semiconductor-comm', 'pat-avoidance-path']) assert.ok(rowOf('국내출원').includes(`id="${k}"`), k);
  assert.ok(rowOf('해외출원').includes('id="pat-traffic-flow-pct"'));
  assert.ok(rowOf('국내등록').includes('id="pat-traffic-flow-kr"'));
  assert.ok(!patents.includes('<h3>해외등록'), '빈 구분은 표시하지 않는다');
  // 논문처럼 중요한 것을 먼저: 등록이 출원보다, 해외가 국내보다 앞선다.
  assert.ok(patents.indexOf('<h3>국내등록') < patents.indexOf('<h3>해외출원') && patents.indexOf('<h3>해외출원') < patents.indexOf('<h3>국내출원'));
  for (const l of ['', 'en/']) assert.ok(!/<figure|assets\/figures\/pat-/.test(raw(join(SITE, `${l}publications.html`))), l);
});

test('기술 자문이 기타에, 소속이 소개에 나온다', () => {
  assert.ok(raw(join(SITE, 'etc.html')).includes('(주)HRC테크놀로지'));
  assert.ok(raw(join(SITE, 'index.html')).includes('빅데이터·AIDV연구본부'));
});

test('기타 페이지는 논문 수상이 맨 위이고 일반 수상은 기타 수상이다', () => {
  const etc = raw(join(SITE, 'etc.html'));
  const heads = [...etc.matchAll(/<div class="sheet-row"><h2>([^<]*)<\/h2>/g)].map((m) => m[1]);
  assert.equal(heads[0], '논문 수상');
  assert.ok(heads.includes('기타 수상') && !heads.includes('수상'), heads.join(','));
  assert.equal([...raw(join(SITE, 'en', 'etc.html')).matchAll(/<div class="sheet-row"><h2>([^<]*)<\/h2>/g)][0][1], 'Paper awards');
});

test('문학상은 수상이 아니라 그 외 활동에 나온다', () => {
  const etc = raw(join(SITE, 'etc.html'));
  assert.ok(etc.indexOf('문학상 가작') > etc.indexOf('그 외 활동'));
});

test('의뢰·이직 제안 문구가 없다', () => {
  for (const f of htmlFiles) assert.ok(!/의뢰|이직|채용 문의|hire me|open to/i.test(raw(f)), f);
});
