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
    home: '소개', research: '연구', projects: '프로젝트', pubs: '논문·특허', cv: 'CV', etc: '기타',
    other: 'English', otherLang: 'en', email: '이메일', expertise: '전문분야', career: '경력', edu: '학력',
    nProjects: '연구과제', nPubs: '논문', nPatents: '특허', nAwards: '수상', now: '현재', related: '관련 자료',
    timeline: '과제 기간', role: '역할', sponsor: '지원', pubTitle: '논문', patTitle: '특허', advisor: '지도교수', thesis: '논문', gpa: '학점',
    award: '수상', scholar: '장학', train: '교육', review: '리뷰어 활동', seminar: '세미나·학회 참석', expo: '전시회 참석', service: '봉사',
    print: '인쇄 또는 PDF 저장', skills: '기술', lang: '어학', pubAward: '논문 수상', registered: '등록', applied: '출원', published: '공개', pending: '공개 전',
    cats: { intl_journal: 'SCIE', intl_conf: '국제 학술대회', dom_journal: '국내 학술지', dom_conf: '국내 학술대회' },
    kinds: { kr_registered: '국내 등록', kr_application: '국내 출원', pct: '해외 출원 (PCT)' },
    updated: '최종 수정', titleSuffix: '장현수',
  },
  en: {
    home: 'About', research: 'Research', projects: 'Projects', pubs: 'Publications & Patents', cv: 'CV', etc: 'Other',
    other: '한국어', otherLang: 'ko', email: 'Email', expertise: 'Expertise', career: 'Experience', edu: 'Education',
    nProjects: 'Projects', nPubs: 'Publications', nPatents: 'Patents', nAwards: 'Awards', now: 'Present', related: 'Related work',
    timeline: 'Project timeline', role: 'Role', sponsor: 'Sponsor', pubTitle: 'Publications', patTitle: 'Patents', advisor: 'Advisor', thesis: 'Thesis', gpa: 'GPA',
    award: 'Awards', scholar: 'Scholarships', train: 'Training', review: 'Peer review', seminar: 'Seminars & conferences attended', expo: 'Exhibitions attended', service: 'Volunteering',
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

// 국제 학술지·학회와 PCT 출원은 국문 페이지에서도 제목, 저자, 학회명을 영어로 쓴다.
const itemLang = (item, l) => (item.category?.startsWith('intl_') || item.kind === 'pct' ? 'en' : l);

function authors(list, l) {
  const me = l === 'ko' ? '장현수' : 'Jang, H.';
  return list.map((a) => (a[l] === me ? `<strong>${esc(a[l])}</strong>` : esc(a[l]))).join(', ');
}

function pubItem(p, l) {
  const il = itemLang(p, l);
  const meta = [p.venue[il], p.volume, p.pages, dot(p.date).slice(0, 7), p.index].filter(Boolean).map(esc).join(' · ');
  const doi = p.doi ? ` <a href="https://doi.org/${esc(p.doi)}">DOI</a>` : '';
  const award = p.award ? `<span class="tag">${esc(p.award[l])}</span>` : '';
  return `<li id="${p.key}"><p class="title">${esc(p.title[il])} ${award}</p><p class="meta">${authors(p.authors, il)}</p><p class="meta">${meta}${doi}</p></li>`;
}

function patentItem(p, l) {
  const t = T[l];
  const il = itemLang(p, l);
  const parts = [];
  if (p.registration) parts.push(`${t.registered} ${esc(p.registration.no)} (${dot(p.registration.date)})`);
  if (p.publication) parts.push(`${t.published} ${esc(p.publication.no)} (${dot(p.publication.date)})`);
  parts.push(`${t.applied} ${p.application.no ? `${esc(p.application.no)} ` : ''}(${dot(p.application.date)})${p.application.no ? '' : ` · ${t.pending}`}`);
  return `<li id="${p.key}"><p class="title">${esc(p.title[il])} <span class="tag">${t.kinds[p.kind]}</span></p><p class="meta">${authors(p.inventors, il)}</p><p class="meta">${parts.join(' · ')}</p></li>`;
}

const simpleList = (items, l) => `<ul class="dated">${items.map((a) => `<li><span class="when">${esc(dot(a.date).slice(0, 7))}</span><div><p class="title">${esc(a.title[l])}</p>${a.org || a.description ? `<p class="meta">${[a.org?.[l], a.description?.[l]].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div></li>`).join('')}</ul>`;

function timeline(l) {
  const startY = 2022;
  const endY = new Date().getFullYear() + 1;
  const months = (endY - startY) * 12;
  const pos = (d) => {
    const now = new Date();
    const [y, m] = d === 'present' ? [now.getFullYear(), now.getMonth() + 2] : String(d).split('-').map(Number);
    return ((y - startY) * 12 + (m - 1)) / months * 100;
  };
  const years = Array.from({ length: endY - startY }, (_, i) => `<span>${startY + i}</span>`).join('');
  const rows = projects.map((p) => {
    const left = pos(p.start);
    // 종료월의 끝까지 막대를 그린다.
    const right = p.end === 'present' ? pos('present') : pos(p.end) + 100 / months;
    return `<a class="bar-row" href="#${p.key}" aria-label="${esc(p.title[l])} ${range(p.start, p.end, T[l])}"><span class="track"><span class="bar" style="left:${left.toFixed(2)}%;width:${(right - left).toFixed(2)}%"></span></span></a>`;
  }).join('');
  return `<div class="gantt" aria-hidden="false"><div class="years" style="grid-template-columns:repeat(${endY - startY},1fr)">${years}</div>${rows}</div>`;
}

const pages = {
  index(l) {
    const t = T[l];
    const k = cv.experience[0];
    const stat = (n, label) => `<div><strong>${n}</strong><span>${label}</span></div>`;
    return `
<section class="hero">
  <img src="${l === 'ko' ? '' : '../'}assets/photo.jpg" alt="${esc(cv.profile.name[l])}" width="170" height="219">
  <div>
    <h1>${esc(cv.profile.name[l])}</h1>
    <p class="role">${esc(site.intro.role[l])}</p>
    <p class="headline">${esc(site.intro.headline[l])}</p>
    <p>${esc(site.intro.body[l])}</p>
    <p class="links">${t.email} ${esc(cv.profile.email)} · <a href="https://orcid.org/${cv.profile.orcid}">ORCID ${cv.profile.orcid}</a></p>
  </div>
</section>
<div class="stats">${stat(projects.length, t.nProjects)}${stat(pubs.length, t.nPubs)}${stat(patents.length, t.nPatents)}${stat(awards.length + pubAwards.length, t.nAwards)}</div>
<h2>${t.expertise}</h2>
<div class="cols">${site.expertise.map((e) => `<div><h3>${esc(e.title[l])}</h3><p>${esc(e.text[l])}</p></div>`).join('')}</div>
<h2>${t.career}</h2>
<ul class="dated">${k.positions.map((p) => `<li><span class="when">${range(p.start, p.end, t)}</span><div><p class="title">${esc(k.org[l])}</p><p class="meta">${esc(p.dept[l])} · ${esc(p.title[l])}</p></div></li>`).join('')}</ul>
<h2>${t.edu}</h2>
<ul class="dated">${cv.education.map((e) => `<li><span class="when">${range(e.start, e.end, t)}</span><div><p class="title">${esc(e.school[l])}</p><p class="meta">${esc(e.major[l])} · ${esc(e.degree[l])}${e.honors ? ` · ${esc(e.honors[l])}` : ''}</p></div></li>`).join('')}</ul>`;
  },
  research(l) {
    const t = T[l];
    const refs = (r) => {
      const a = [
        ...r.projects.map((k) => `<li><a href="projects.html#${k}">${esc(byKey(cv.projects, k, 'project').title[l])}</a></li>`),
        ...r.publications.map((k) => { const p = byKey(cv.publications, k, 'publication'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }),
        ...r.patents.map((k) => { const p = byKey(cv.patents, k, 'patent'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }),
      ];
      return a.length ? `<details><summary>${t.related} (${a.length})</summary><ul>${a.join('')}</ul></details>` : '';
    };
    return `<h1>${t.research}</h1>${site.research.map((r) => `<article class="topic" id="${r.id}"><h2>${esc(r.title[l])}</h2><p class="meta">${esc(r.period)}</p><p>${esc(r.body[l])}</p>${refs(r)}</article>`).join('')}`;
  },
  projects(l) {
    const t = T[l];
    return `<h1>${t.projects}</h1><h2>${t.timeline}</h2>
<div class="gantt-wrap"><ol class="gantt-labels">${projects.map((p) => `<li><a href="#${p.key}">${esc(p.title[l])}</a></li>`).join('')}</ol>${timeline(l)}</div>
${projects.map((p) => `<article class="topic" id="${p.key}"><h2>${esc(p.title[l])}</h2>
<p class="meta">${range(p.start, p.end, t)} · ${t.sponsor}: ${esc(p.sponsor[l])}${p.agency ? `, ${esc(p.agency[l])}` : ''} · ${t.role}: ${esc(p.role[l])}</p>
<ul>${p.summary.map((s) => `<li>${esc(s[l])}</li>`).join('')}</ul></article>`).join('')}`;
  },
  publications(l) {
    const t = T[l];
    const groups = CAT_ORDER.map((c) => {
      const g = pubs.filter((p) => p.category === c);
      return g.length ? `<h3>${t.cats[c]} (${g.length})</h3><ul class="biblio">${g.map((p) => pubItem(p, l)).join('')}</ul>` : '';
    }).join('');
    return `<h1>${t.pubs}</h1><h2>${t.pubTitle} (${pubs.length})</h2>${groups}<h2>${t.patTitle} (${patents.length})</h2><ul class="biblio">${patents.map((p) => patentItem(p, l)).join('')}</ul>`;
  },
  cv(l) {
    const t = T[l];
    const k = cv.experience[0];
    return `<h1>${esc(cv.profile.name[l])} · CV</h1>
<p class="links">${esc(cv.profile.email)} · ORCID ${cv.profile.orcid} <button type="button" id="print-cv" class="no-print">${t.print}</button></p>
<h2>${t.edu}</h2><ul class="dated">${cv.education.map((e) => `<li><span class="when">${range(e.start, e.end, t)}</span><div><p class="title">${esc(e.school[l])}, ${esc(e.degree[l])}</p><p class="meta">${esc(e.major[l])} · ${t.gpa} ${esc(e.gpa)}${e.honors ? ` · ${esc(e.honors[l])}` : ''}</p><p class="meta">${esc(e.lab[l])} · ${t.advisor}: ${esc(e.advisor[l])} · ${t.thesis}: ${esc(e.thesis[l])}</p></div></li>`).join('')}</ul>
<h2>${t.career}</h2><ul class="dated">${k.positions.map((p) => `<li><span class="when">${range(p.start, p.end, t)}</span><div><p class="title">${esc(k.org[l])}, ${esc(p.title[l])}</p><p class="meta">${esc(p.dept[l])}</p></div></li>`).join('')}</ul>
<h2>${t.projects}</h2><ul class="dated">${projects.map((p) => `<li><span class="when">${range(p.start, p.end, t)}</span><div><p class="title">${esc(p.title[l])}</p><p class="meta">${esc(p.sponsor[l])}</p></div></li>`).join('')}</ul>
<h2>${t.pubTitle}</h2><ul class="biblio">${CAT_ORDER.flatMap((c) => pubs.filter((p) => p.category === c)).map((p) => pubItem(p, l)).join('')}</ul>
<h2>${t.patTitle}</h2><ul class="biblio">${patents.map((p) => patentItem(p, l)).join('')}</ul>
<h2>${t.award}</h2>${simpleList(awards, l)}
<h2>${t.scholar}</h2>${simpleList(cv.scholarships, l)}
<h2>${t.skills}</h2><p>${cv.skills.programming.map(esc).join(', ')}</p>
<p>${t.lang}: ${cv.skills.languages.map((s) => `${esc(s.test)} ${esc(s.score)} (${dot(s.date)})`).join(', ')}</p>
<script>document.getElementById('print-cv').addEventListener('click',function(){window.print()});</script>`;
  },
  etc(l) {
    const t = T[l];
    const pa = pubAwards.map((p) => ({ date: p.date, title: p.award, org: p.title }));
    const sec = (title, items) => (items.length ? `<h2>${title}</h2>${simpleList(items, l)}` : '');
    return `<h1>${t.etc}</h1>
${sec(t.award, awards)}${sec(t.pubAward, pa)}${sec(t.scholar, cv.scholarships)}${sec(t.review, site.reviews)}${sec(t.train, training)}
${sec(t.seminar, [...site.seminars].sort(byDateDesc))}${sec(t.expo, [...site.exhibitions].sort(byDateDesc))}${sec(t.service, site.service)}`;
  },
};

const NAV = [['index', 'home'], ['research', 'research'], ['projects', 'projects'], ['publications', 'pubs'], ['cv', 'cv'], ['etc', 'etc']];

function layout(page, l, body) {
  const t = T[l];
  const up = l === 'ko' ? '' : '../';
  const otherHref = l === 'ko' ? `en/${page}.html` : `../${page}.html`;
  const label = NAV.find(([p]) => p === page)[1];
  const title = page === 'index' ? t.titleSuffix : `${t[label]} · ${t.titleSuffix}`;
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
<a class="brand" href="index.html">${esc(cv.profile.name[l])}</a>
<nav aria-label="${l === 'ko' ? '주 메뉴' : 'Main'}">${NAV.map(([p, key]) => `<a href="${p}.html"${p === page ? ' aria-current="page"' : ''}>${t[key]}</a>`).join('')}<a class="lang" href="${otherHref}" lang="${t.otherLang}">${t.other}</a></nav>
</div></header>
<main class="wrap">${body}</main>
<footer class="wrap"><p>${esc(cv.profile.name[l])} · ${t.updated} ${new Date().toISOString().slice(0, 10)}</p></footer>
</body>
</html>
`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(new URL('en/', OUT), { recursive: true });
cpSync(new URL('assets/', root), new URL('assets/', OUT), { recursive: true });
for (const l of ['ko', 'en']) {
  for (const [page] of NAV) {
    const file = new URL(`${l === 'ko' ? '' : 'en/'}${page}.html`, OUT);
    writeFileSync(file, layout(page, l, pages[page](l)));
  }
}
console.log(`_site 생성: 페이지 ${NAV.length * 2}개`);
