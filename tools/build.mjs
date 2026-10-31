// data/*.yaml로 _site/ 아래에 국문·영문 정적 페이지를 생성한다.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const read = (p) => parse(readFileSync(new URL(p, root), 'utf8'));
const cv = read('data/cv.yaml');
const site = read('data/site.yaml');
const OUT = new URL('_site/', root);

const T = {
  ko: {
    home: '소개', research: '연구·프로젝트', pubs: '논문·특허', cv: 'CV', etc: '기타',
    other: 'English', otherLang: 'en', email: '이메일', expertise: '전문분야', career: '경력', edu: '학력',
    nProjects: '연구과제', nPubs: '논문', nPatents: '특허', nAwards: '수상', now: '현재',
    deck: '소개 자료', deckNote: '', prev: '이전', next: '다음', full: '전체 화면',
    projects: '연구과제', pubOut: '관련 논문', patOut: '관련 특허', relatedProject: '관련 과제',
    role: '역할', sponsor: '지원', pubTitle: '논문', patTitle: '특허', advisor: '지도교수', thesis: '학위논문', gpa: '학점',
    national: '국가과제', contract: '수탁과제', otherAct: '그 외 활동', consult: '기술 자문', award: '수상', scholar: '장학', train: '교육', review: '리뷰어 활동', seminar: '세미나·학회 참석', expo: '전시회 참석', service: '봉사',
    print: '인쇄 또는 PDF 저장', skills: '기술', lang: '어학', pubAward: '논문 수상', registered: '등록', applied: '출원', published: '공개', pending: '공개 전',
    cats: { intl_journal: 'SCIE', intl_conf: '국제 학술대회', dom_journal: '국내 학술지', dom_conf: '국내 학술대회' },
    kinds: { kr_registered: '국내 등록', kr_application: '국내 출원', pct: '해외 출원 (PCT)' },
    updated: '최종 수정', titleSuffix: '장현수',
  },
  en: {
    home: 'About', research: 'Research & Projects', pubs: 'Publications & Patents', cv: 'CV', etc: 'Other',
    other: '한국어', otherLang: 'ko', email: 'Email', expertise: 'Expertise', career: 'Experience', edu: 'Education',
    nProjects: 'projects', nPubs: 'publications', nPatents: 'patents', nAwards: 'awards', now: 'Present',
    deck: 'Introduction slides', deckNote: 'In Korean.', prev: 'Previous', next: 'Next', full: 'Full screen',
    projects: 'Projects', pubOut: 'Publications', patOut: 'Patents', relatedProject: 'Related project',
    role: 'Role', sponsor: 'Sponsor', pubTitle: 'Publications', patTitle: 'Patents', advisor: 'Advisor', thesis: 'Thesis', gpa: 'GPA',
    national: 'Government-funded', contract: 'Contract research', otherAct: 'Other activities', consult: 'Technical consulting', award: 'Awards', scholar: 'Scholarships', train: 'Training', review: 'Peer review', seminar: 'Seminars and conferences attended', expo: 'Exhibitions attended', service: 'Volunteering',
    print: 'Print or save as PDF', skills: 'Skills', lang: 'Languages', pubAward: 'Paper awards', registered: 'Registered', applied: 'Filed', published: 'Published', pending: 'Unpublished',
    cats: { intl_journal: 'SCIE', intl_conf: 'International conferences', dom_journal: 'Domestic journals', dom_conf: 'Domestic conferences' },
    kinds: { kr_registered: 'KR registered', kr_application: 'KR application', pct: 'PCT application' },
    updated: 'Last updated', titleSuffix: 'Hyeonsoo Jang',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = (d) => String(d).replace(/-/g, '.');
const range = (a, b, t) => `${dot(a)} – ${b === 'present' ? t.now : dot(b)}`;
const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

function byKey(list, key, kind) {
  const item = list.find((x) => x.key === key);
  if (!item) throw new Error(`site.yaml의 ${kind} 키를 찾을 수 없음: ${key}`);
  return item;
}

const CAT_ORDER = ['intl_journal', 'intl_conf', 'dom_journal', 'dom_conf'];
const pubs = [...cv.publications].sort(byDateDesc);
const patents = [...cv.patents].sort((a, b) => b.application.date.localeCompare(a.application.date));
const projects = [...cv.projects].sort((a, b) => String(b.start).localeCompare(String(a.start)));
const awards = [...cv.awards, ...site.extra_awards].sort(byDateDesc);
const training = [...cv.training, ...site.extra_training].sort(byDateDesc);
const pubAwards = pubs.filter((p) => p.award);
const scholarships = [...cv.scholarships].sort(byDateDesc);
const kindOf = (key, t) => {
  if (site.project_kinds.national.includes(key)) return t.national;
  if (site.project_kinds.contract.includes(key)) return t.contract;
  throw new Error(`site.yaml의 project_kinds에 없는 과제: ${key}`);
};

// 국제 학술지·학회와 PCT 출원은 국문 페이지에서도 제목, 저자, 학회명을 영어로 쓴다.
const itemLang = (item, l) => (item.category?.startsWith('intl_') || item.kind === 'pct' ? 'en' : l);

function authors(list, l) {
  const me = l === 'ko' ? '장현수' : 'Jang, H.';
  return list.map((a) => (a[l] === me ? `<strong>${esc(a[l])}</strong>` : esc(a[l]))).join(', ');
}

function pubItem(p, l) {
  const il = itemLang(p, l);
  const meta = [p.venue[il], p.volume, p.pages, dot(p.date).slice(0, 7), p.index].filter(Boolean).map(esc).join(', ');
  const doi = p.doi ? ` <a href="https://doi.org/${esc(p.doi)}">DOI</a>` : '';
  const award = p.award ? `<span class="tag">${esc(p.award[l])}</span>` : '';
  return `<li id="${p.key}"><p class="title">${esc(p.title[il])} ${award}</p><p class="meta">${authors(p.authors, il)}</p><p class="meta">${meta}${doi}</p></li>`;
}

function patentItem(p, l, up = '') {
  const t = T[l];
  const il = itemLang(p, l);
  const figs = site.patent_figures?.[p.key] ?? [];
  const drawings = up !== null && figs.length ? `<div class="drawings">${figs.map((f) => `<figure><img src="${up}assets/figures/${esc(f.file)}" alt="${esc(`${p.title[il]} ${f.caption[l]}`)}" loading="lazy"><figcaption>${esc(f.caption[l])}</figcaption></figure>`).join('')}</div>` : '';
  const parts = [];
  if (p.registration) parts.push(`${t.registered} ${esc(p.registration.no)} (${dot(p.registration.date)})`);
  if (p.publication) parts.push(`${t.published} ${esc(p.publication.no)} (${dot(p.publication.date)})`);
  parts.push(`${t.applied} ${p.application.no ? `${esc(p.application.no)} ` : ''}(${dot(p.application.date)})${p.application.no ? '' : `, ${t.pending}`}`);
  return `<li id="${p.key}"><p class="title">${esc(p.title[il])} <span class="tag">${t.kinds[p.kind]}</span></p><p class="meta">${authors(p.inventors, il)}</p><p class="meta">${parts.join(', ')}</p>${drawings}</li>`;
}

const simpleList = (items, l) => `<ul class="dated">${items.map((a) => `<li><span class="when">${esc(a.period ?? dot(a.date).slice(0, 7))}</span><div><p class="title">${esc(a.title[l])}</p>${a.org || a.description ? `<p class="meta">${[a.org?.[l], a.description?.[l]].filter(Boolean).map(esc).join(', ')}</p>` : ''}</div></li>`).join('')}</ul>`;

// 소개 자료 뷰어. 슬라이드 이미지만 싣고 PPT 원본은 올리지 않는다.
function deckViewer(l, up) {
  const t = T[l];
  const slides = read('data/deck.yaml');
  const n = slides.length;
  const imgs = slides.map((s, i) => `<img src="${up}assets/deck/${esc(s.file)}" alt="${esc(`${i + 1}/${n}: ${s.title}`)}" width="1600" height="900" loading="${i < 2 ? 'eager' : 'lazy'}"${i ? ' hidden' : ''}>`).join('');
  return `<section class="block" id="deck"><h2>${t.deck}</h2>${l === 'en' ? `<p class="note deck-note">${t.deckNote}</p>` : ''}
<div class="deck" tabindex="0" role="group" aria-roledescription="${esc(t.deck)}" aria-label="${esc(t.deck)}"><div class="deck-stage">${imgs}</div>
<div class="deck-bar"><button type="button" class="deck-prev">${t.prev}</button><span class="deck-count" aria-live="polite">1 / ${n}</span><button type="button" class="deck-next">${t.next}</button><button type="button" class="deck-full">${t.full}</button></div></div>
<script>(function(){var d=document.querySelector('.deck'),im=d.querySelectorAll('img'),c=d.querySelector('.deck-count'),p=d.querySelector('.deck-prev'),x=d.querySelector('.deck-next'),i=0,sx=null;
function go(k){i=Math.max(0,Math.min(im.length-1,k));im.forEach(function(m,j){m.hidden=j!==i});if(im[i+1])im[i+1].loading='eager';c.textContent=(i+1)+' / '+im.length;p.disabled=i===0;x.disabled=i===im.length-1}
p.addEventListener('click',function(){go(i-1)});x.addEventListener('click',function(){go(i+1)});
d.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){go(i-1);e.preventDefault()}if(e.key==='ArrowRight'){go(i+1);e.preventDefault()}});
var s=d.querySelector('.deck-stage');s.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});s.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)go(i+(dx<0?1:-1));sx=null});
s.addEventListener('click',function(e){var r=s.getBoundingClientRect();go(i+(e.clientX-r.left>r.width/2?1:-1))});
d.querySelector('.deck-full').addEventListener('click',function(){if(document.fullscreenElement)document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen()});go(0)})();</script></section>`;
}

const figure = (f, l, up) => `<figure><img src="${up}assets/figures/${esc(f.file)}" alt="${esc(f.caption[l])}" loading="lazy"><figcaption>${esc(f.caption[l])}</figcaption></figure>`;
const head = (title, lead, extra = '') => `<section class="page-head"><div class="wrap"><h1>${esc(title)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}${extra}</div></section>`;

const pages = {
  index(l, up) {
    const t = T[l];
    const k = cv.experience[0];
    const stat = (n, label) => `<li><b>${n}</b>${label}</li>`;
    return `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <h1>${esc(cv.profile.name[l])}</h1>
    <p class="role">${esc(site.intro.role[l])}</p>
    <p class="headline">${esc(site.intro.headline[l])}</p>
    <p class="contact">${t.email} ${esc(cv.profile.email)}<br><a href="https://orcid.org/${cv.profile.orcid}">ORCID ${cv.profile.orcid}</a><br><a href="${up}assets/cv/CV_HyeonsooJang_EN.pdf" download>CV (PDF)</a>${site.intro.scholar ? `<br><a href="${esc(site.intro.scholar)}">Google Scholar</a>` : ''}</p>
  </div>
  <img src="${up}assets/photo.jpg" alt="${esc(cv.profile.name[l])}" width="496" height="638">
</div></section>
<div class="wrap">
<section class="block"><ul class="tally">${stat(projects.length, t.nProjects)}${stat(pubs.length, t.nPubs)}${stat(patents.length, t.nPatents)}${stat(awards.length + pubAwards.length, t.nAwards)}</ul></section>
${deckViewer(l, up)}
<section class="block two">
  <div><h2>${t.career}</h2><ul class="dated">${k.positions.map((p) => `<li><span class="when">${range(p.start, p.end, t)}</span><div><p class="title">${esc(k.org[l])}</p><p class="meta">${esc(p.dept[l])}, ${esc(p.title[l])}</p></div></li>`).join('')}</ul></div>
  <div><h2>${t.edu}</h2><ul class="dated">${cv.education.map((e) => `<li><span class="when">${range(e.start, e.end, t)}</span><div><p class="title">${esc(e.school[l])}</p><p class="meta">${esc(e.major[l])}, ${esc(e.degree[l])}${e.honors ? `, ${esc(e.honors[l])}` : ''}</p></div></li>`).join('')}</ul></div>
</section>
</div>`;
  },
  research(l, up) {
    const t = T[l];
    const project = (k) => {
      const p = byKey(cv.projects, k, 'project');
      const info = `${esc(p.title[l])}<small>${range(p.start, p.end, t)}, ${kindOf(p.key, t)}, ${esc(p.sponsor[l])}${p.agency ? `, ${esc(p.agency[l])}` : ''}, ${esc(p.role[l])}</small>`;
      if (!p.summary.length) return `<div class="project-plain" id="${p.key}">${info}</div>`;
      return `<details class="project" id="${p.key}"><summary>${info}</summary><ul>${p.summary.map((s) => `<li>${esc(s[l])}</li>`).join('')}</ul></details>`;
    };
    const refs = (title, items) => (items.length ? `<div class="outputs"><h3>${title}</h3><ul class="plain">${items.join('')}</ul></div>` : '');
    const toc = `<ul class="topics">${site.research.map((r) => `<li><a href="#${r.id}">${esc(r.short[l])}</a></li>`).join('')}</ul>`;
    const topic = (r) => {
      const figures = r.figures ?? [];
      const text = `<div><h2>${esc(r.title[l])}</h2><p class="span">${esc(r.period)}</p><p>${esc(r.body[l])}</p>
${r.projects.map(project).join('')}
${refs(t.relatedProject, (r.project_links ?? []).map((k) => `<li><a href="#${k}">${esc(byKey(cv.projects, k, 'project').title[l])}</a></li>`))}
${refs(t.pubOut, r.publications.map((k) => { const p = byKey(cv.publications, k, 'publication'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }))}
${refs(t.patOut, r.patents.map((k) => { const p = byKey(cv.patents, k, 'patent'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }))}</div>`;
      return `<article class="topic${figures.length ? '' : ' solo'}" id="${r.id}">${text}${figures.length ? `<div>${figures.map((f) => figure(f, l, up)).join('')}</div>` : ''}</article>`;
    };
    // 목록이나 다른 곳에서 특정 과제로 들어오면 그 과제를 펼친다.
    return `${head(t.research, '', toc)}<div class="wrap">${site.research.map(topic).join('')}</div>
<script>function o(){var e=location.hash&&document.getElementById(location.hash.slice(1));if(e&&e.tagName==='DETAILS'){e.open=true;e.scrollIntoView()}}addEventListener('hashchange',o);o();</script>`;
  },
  publications(l, up) {
    const t = T[l];
    const groups = CAT_ORDER.map((c) => {
      const g = pubs.filter((p) => p.category === c);
      return g.length ? `<div class="sheet-row"><h2>${t.cats[c]} (${g.length})</h2><ul class="biblio">${g.map((p) => pubItem(p, l)).join('')}</ul></div>` : '';
    }).join('');
    return `${head(t.pubs, '')}<div class="wrap sheet">${groups}<div class="sheet-row"><h2>${t.patTitle} (${patents.length})</h2><ul class="biblio">${patents.map((p) => patentItem(p, l, up)).join('')}</ul></div></div>`;
  },
  etc(l) {
    const t = T[l];
    const pa = pubAwards.map((p) => ({ date: p.date, title: p.award, org: p.title }));
    const sec = (title, items) => (items.length ? `<div class="sheet-row"><h2>${title}</h2>${simpleList(items, l)}</div>` : '');
    // 교육, 참석, 봉사는 작은 글씨 목록으로 한곳에 묶는다.
    const when = (a) => esc(a.period ?? dot(a.date).slice(0, 7));
    const minor = (title, items) => (items.length ? `<div class="minor"><h3>${title}</h3><ul>${items.map((a) => `<li><span class="when">${when(a)}</span> ${esc(a.title[l])}${a.org ? ` <span class="by">(${esc(a.org[l])})</span>` : ''}</li>`).join('')}</ul></div>` : '');
    const others = [
      minor(t.train, training),
      minor(t.seminar, [...site.seminars].sort(byDateDesc)),
      minor(t.expo, [...site.exhibitions].sort(byDateDesc)),
      minor(t.service, site.service),
    ].join('');
    return `${head(t.etc, '')}<div class="wrap sheet">
${sec(t.award, awards)}${sec(t.pubAward, pa)}${sec(t.scholar, scholarships)}${sec(t.review, site.reviews)}${sec(t.consult, site.consulting)}
<div class="sheet-row"><h2>${t.otherAct}</h2><div class="minors">${others}</div></div></div>`;
  },
};

// 이전 주소 cv.html은 소개 페이지로 이동한다. CV는 소개 페이지의 PDF로 내려받는다.
const NAV = [['index', 'home'], ['research', 'research'], ['publications', 'pubs'], ['etc', 'etc']];

function layout(page, l, body) {
  const t = T[l];
  const up = l === 'ko' ? '' : '../';
  const otherHref = l === 'ko' ? `en/${page}.html` : `../${page}.html`;
  const label = NAV.find(([p]) => p === page)[1];
  const title = page === 'index' ? t.titleSuffix : `${t[label]}, ${t.titleSuffix}`;
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(site.intro.headline[l])}">
<link rel="icon" href="data:,">
<link rel="alternate" hreflang="${t.otherLang}" href="${otherHref}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${up}assets/style.css">
</head>
<body>
<header class="site"><div class="wrap">
<nav aria-label="${l === 'ko' ? '주 메뉴' : 'Main'}">${NAV.map(([p, key]) => `<a href="${p}.html"${p === page ? ' aria-current="page"' : ''}>${t[key]}</a>`).join('')}<a class="lang" href="${otherHref}" lang="${t.otherLang}">${t.other}</a></nav>
</div></header>
<main>${body}</main>
<footer class="wrap"><p>${esc(cv.profile.name[l])}, ${t.updated} ${new Date().toISOString().slice(0, 10)}</p></footer>
</body>
</html>
`;
}

// 이전 주소로 들어와도 연구·프로젝트 페이지로 이동한다.
const redirect = (to) => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><title>${to}</title></head><body><a href="${to}">${to}</a></body></html>\n`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(new URL('en/', OUT), { recursive: true });
cpSync(new URL('assets/', root), new URL('assets/', OUT), { recursive: true });
for (const l of ['ko', 'en']) {
  const dir = l === 'ko' ? '' : 'en/';
  for (const [page] of NAV) {
    writeFileSync(new URL(`${dir}${page}.html`, OUT), layout(page, l, pages[page](l, l === 'ko' ? '' : '../')));
  }
  writeFileSync(new URL(`${dir}projects.html`, OUT), redirect('research.html'));
  writeFileSync(new URL(`${dir}cv.html`, OUT), redirect('index.html'));
}
console.log(`_site 생성: 페이지 ${NAV.length * 2}개`);
