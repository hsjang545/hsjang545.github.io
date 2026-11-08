// data/*.yaml로 _site/ 아래에 국문·영문 정적 페이지를 생성한다.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const read = (p) => parse(readFileSync(new URL(p, root), 'utf8'));
const cv = read('data/cv.yaml');
const site = read('data/site.yaml');
const OUT = new URL('_site/', root);
// 스타일이나 슬라이드를 고치면 주소가 바뀌어 브라우저가 이전 파일을 캐시에서 쓰지 않는다.
const ver = (path) => createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex').slice(0, 8);
const CSS_VER = ver('assets/style.css');

const T = {
  ko: {
    home: '소개', research: '연구 및 개발', projectsTab: '프로젝트', pubs: '논문·특허', cv: 'CV', etc: '기타',
    other: 'English', otherLang: 'en', email: '이메일', expertise: '전문분야', career: '경력', edu: '학력',
    now: '현재',
    deck: '소개 자료', deckNote: '', prev: '이전', next: '다음', full: '전체 화면',
    projects: '연구과제', pubOut: '관련 논문', patOut: '관련 특허', relatedProject: '관련 과제', platBuilt: '구현 내용', relatedResearch: '관련 연구 및 개발', areas: '전문 분야', wip: '작성 중',
    role: '역할', sponsor: '지원', pubTitle: '논문', patTitle: '특허', advisor: '지도교수', thesis: '학위논문', gpa: '학점',
    national: '국가과제', contract: '수탁과제', misc: '기타', otherAct: '그 외 활동', consult: '기술 자문', award: '기타 수상', scholar: '장학', train: '교육', review: '리뷰어 활동', seminar: '세미나·학회 참석', expo: '전시회 참석', service: '봉사',
    print: '인쇄 또는 PDF 저장', skills: '기술', lang: '어학', pubAward: '논문 수상', registered: '등록', applied: '출원', published: '공개', pending: '공개 전',
    cats: { intl_journal: 'SCIE', intl_conf: 'International conference', dom_journal: '국내 학술지', dom_conf: '국내 학술대회' },
    patGroups: { intl_reg: '해외등록', kr_reg: '국내등록', intl_app: '해외출원', kr_app: '국내출원' },
    updated: '최종 수정', titleSuffix: '장현수',
  },
  en: {
    home: 'About', research: 'Research & Development', projectsTab: 'Projects', pubs: 'Publications & Patents', cv: 'CV', etc: 'Other',
    other: '한국어', otherLang: 'ko', email: 'Email', expertise: 'Expertise', career: 'Experience', edu: 'Education',
    now: 'Present',
    deck: 'Introduction slides', deckNote: 'In Korean.', prev: 'Previous', next: 'Next', full: 'Full screen',
    projects: 'Projects', pubOut: 'Publications', patOut: 'Patents', relatedProject: 'Related projects', platBuilt: 'What I built', relatedResearch: 'Related R&D', areas: 'Expertise', wip: 'Work in progress',
    role: 'Role', sponsor: 'Sponsor', pubTitle: 'Publications', patTitle: 'Patents', advisor: 'Advisor', thesis: 'Thesis', gpa: 'GPA',
    national: 'Government-funded', contract: 'Contract research', misc: 'Misc.', otherAct: 'Other activities', consult: 'Technical consulting', award: 'Other awards', scholar: 'Scholarships', train: 'Training', review: 'Peer review', seminar: 'Seminars and conferences attended', expo: 'Exhibitions attended', service: 'Volunteering',
    print: 'Print or save as PDF', skills: 'Skills', lang: 'Languages', pubAward: 'Paper awards', registered: 'Registered', applied: 'Filed', published: 'Published', pending: 'Unpublished',
    cats: { intl_journal: 'SCIE', intl_conf: 'International conferences', dom_journal: 'Domestic journals', dom_conf: 'Domestic conferences' },
    patGroups: { intl_reg: 'International registrations', kr_reg: 'Domestic registrations', intl_app: 'International applications', kr_app: 'Domestic applications' },
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
const projects = cv.projects.filter((p) => !site.hidden_projects?.includes(p.key)).sort((a, b) => String(b.start).localeCompare(String(a.start)));
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

// 특허는 국내·해외와 출원·등록으로 나눈다. kr_로 시작하지 않는 종류(PCT 등)는 해외다.
// 심사를 거친 등록을 출원보다, 같은 단계에서는 해외를 국내보다 앞에 둔다.
const PAT_GROUPS = [
  ['intl_reg', (p) => !p.kind.startsWith('kr_') && p.registration],
  ['kr_reg', (p) => p.kind.startsWith('kr_') && p.registration],
  ['intl_app', (p) => !p.kind.startsWith('kr_') && !p.registration],
  ['kr_app', (p) => p.kind.startsWith('kr_') && !p.registration],
];

function patentItem(p, l) {
  const t = T[l];
  const il = itemLang(p, l);
  const parts = [];
  if (p.registration) parts.push(`${t.registered} ${esc(p.registration.no)} (${dot(p.registration.date)})`);
  if (p.publication) parts.push(`${t.published} ${esc(p.publication.no)} (${dot(p.publication.date)})`);
  parts.push(`${t.applied} ${p.application.no ? `${esc(p.application.no)} ` : ''}(${dot(p.application.date)})${p.application.no ? '' : `, ${t.pending}`}`);
  const tag = p.kind === 'pct' ? ' <span class="tag">PCT</span>' : '';
  return `<li id="${p.key}"><p class="title">${esc(p.title[il])}${tag}</p><p class="meta">${authors(p.inventors, il)}</p><p class="meta">${parts.join(', ')}</p></li>`;
}

const simpleList = (items, l) => `<ul class="dated">${items.map((a) => `<li><span class="when">${esc(a.period ?? dot(a.date).slice(0, 7))}</span><div><p class="title">${esc(a.title[l])}</p>${a.org || a.description ? `<p class="meta">${[a.org?.[l], a.description?.[l]].filter(Boolean).map(esc).join(', ')}</p>` : ''}</div></li>`).join('')}</ul>`;

// 소개 자료 뷰어. 슬라이드 이미지만 싣고 PPT 원본은 올리지 않는다.
function deckViewer(l, up) {
  const t = T[l];
  const slides = read('data/deck.yaml');
  const n = slides.length;
  const imgs = slides.map((s, i) => `<img src="${up}assets/deck/${esc(s.file)}?v=${ver(`assets/deck/${s.file}`)}" alt="${esc(`${i + 1}/${n}: ${s.title}`)}" width="1600" height="900" loading="${i < 2 ? 'eager' : 'lazy'}"${i ? ' hidden' : ''}>`).join('');
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

// 경력·학력 기관 로고. 크기를 HTML에도 지정해 스타일이 늦게 와도 크게 보이지 않게 한다.
const orgLogo = (key, l, up) => {
  const o = site.org_logos?.[key];
  return o ? `<img class="org-logo${o.mono ? ' mono' : ''}" src="${up}assets/logos/${esc(o.file)}" width="${o.size[0]}" height="${o.size[1]}" style="width:${o.size[0]}px" alt="${esc(o.name[l])}" loading="lazy">` : '';
};
// 기관마다 이름과 로고를 한 줄에 두고, 그 아래에 기간별 직위나 학위를 나열한다.
const orgBlock = (key, name, rows, l, up) => `<li class="org"><div class="org-head"><p class="title">${esc(name)}</p>${orgLogo(key, l, up)}</div><ul class="dated">${rows.map(([when, what]) => `<li><span class="when">${when}</span><p>${what}</p></li>`).join('')}</ul></li>`;
// 그림 파일이 언어별로 다르면 file을 {ko, en}으로 쓴다.
const figure = (f, l, up) => `<figure><img src="${up}assets/figures/${esc(typeof f.file === 'object' ? f.file[l] : f.file)}" alt="${esc(f.caption[l])}" loading="lazy"><figcaption>${esc(f.caption[l])}</figcaption></figure>`;
// 사이트를 만드는 동안 큰 제목 옆에 '작성 중' 표시를 붙인다. site.yaml의 wip을 false로 바꾸면 사라진다.
const wipBadge = (t) => (site.wip ? ` <span class="wip">${t.wip}</span>` : '');
const head = (t, title, lead, extra = '') => `<section class="page-head"><div class="wrap"><h1>${esc(title)}${wipBadge(t)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}${extra}</div></section>`;

// 소개 상단의 외부 링크. 주소가 비어 있는 항목은 싣지 않는다.
const heroLinks = (up) => [
  [`${up}assets/cv/CV_HyeonsooJang_EN.pdf`, 'CV (PDF)', true],
  [`https://orcid.org/${cv.profile.orcid}`, 'ORCID'],
  [site.intro.linkedin, 'LinkedIn'],
  [site.intro.remember, 'Remember'],
  [site.intro.scholar, 'Google Scholar'],
].filter(([href]) => href).map(([href, label, dl]) => `<a href="${esc(href)}"${dl ? ' download' : ''}>${label}</a>`);

const pages = {
  index(l, up) {
    const t = T[l];
    return `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <h1>${esc(cv.profile.name[l])}${wipBadge(t)}</h1>
    <p class="role">${site.intro.role[l].map((line, i) => (i ? esc(line) : `<strong>${esc(line)}</strong>`)).join('<br>')}</p>
    <p class="email"><a href="mailto:${esc(cv.profile.email)}">${esc(cv.profile.email)}</a></p>
    <p class="links">${heroLinks(up).join('')}</p>
  </div>
  <img src="${up}assets/photo.jpg" alt="${esc(cv.profile.name[l])}" width="496" height="638">
</div></section>
<div class="wrap">
<section class="block intro-rows">
  <div class="sheet-row"><h2>${t.career}</h2><ul class="orgs">${cv.experience.map((k) => orgBlock(k.key, k.org[l], k.positions.map((p) => [range(p.start, p.end, t), `${esc(p.dept[l])}, ${esc(p.title[l])}`]), l, up)).join('')}</ul></div>
  <div class="sheet-row"><h2>${t.edu}</h2><ul class="orgs">${cv.education.map((e) => orgBlock(e.key, e.school[l], [[range(e.start, e.end, t), `${esc(e.major[l])}, ${esc(e.degree[l])}${e.honors ? `, ${esc(e.honors[l])}` : ''}`]], l, up)).join('')}</ul></div>
  <div class="sheet-row"><h2>${t.areas}</h2><ul class="areas">${site.research.filter((r) => r.on_intro !== false).map((r) => `<li><a href="research.html#${r.id}">${esc(r.short[l])}</a><span class="desc">${esc(r.body[l])}</span></li>`).join('')}</ul></div>
</section>
${deckViewer(l, up)}
</div>`;
  },
  research(l, up) {
    const t = T[l];
    const refs = (title, items) => (items.length ? `<div class="outputs"><h3>${title}</h3><ul class="plain">${items.join('')}</ul></div>` : '');
    const toc = `<ul class="topics">${site.research.map((r) => `<li><a href="#${r.id}">${esc(r.short[l])}</a></li>`).join('')}</ul>`;
    // 직접 구축한 플랫폼. 계층 도식(센서, 기술 스택)을 먼저 두고, 구현 내용과 GUI 화면을 그 아래에 싣는다.
    const platforms = (r, l, up) => (r.platforms?.length ? `<div class="platforms">${r.platforms.map((pf) => {
      const p = byKey(cv.projects, pf.project, 'project');
      const built = `<div><h4>${t.platBuilt}</h4><ul class="points">${pf.built[l].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
      const figs = (pf.figures ?? []).map((f) => figure(f, l, up)).join('');
      return `<section class="platform" id="${pf.id}"><h3>${esc(pf.name[l])}</h3><p class="meta">${t.relatedProject}: <a href="projects.html#${pf.project}">${esc(p.title[l])}</a> <span class="by">${range(p.start, p.end, t)}</span></p>
${pf.diagram ? `<div class="diagram">${figure(pf.diagram, l, up)}</div>` : ''}<div class="platform-grid${figs ? '' : ' solo'}">${built}${figs ? `<div>${figs}</div>` : ''}</div></section>`;
    }).join('')}</div>` : '');
    const topic = (r) => {
      const figures = r.figures ?? [];
      const text = `<div><h2>${esc(r.title[l])}</h2><p class="span">${esc(r.period)}</p><p>${esc(r.body[l])}</p>
${refs(t.relatedProject, r.projects.map((k) => { const p = byKey(cv.projects, k, 'project'); return `<li><a href="projects.html#${k}">${esc(p.title[l])}</a> <span class="by">${range(p.start, p.end, t)}</span></li>`; }))}
${refs(t.pubOut, r.publications.map((k) => { const p = byKey(cv.publications, k, 'publication'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }))}
${refs(t.patOut, r.patents.map((k) => { const p = byKey(cv.patents, k, 'patent'); return `<li><a href="publications.html#${k}">${esc(p.title[itemLang(p, l)])}</a></li>`; }))}</div>`;
      return `<article class="topic${figures.length ? '' : ' solo'}" id="${r.id}">${text}${figures.length ? `<div>${figures.map((f) => figure(f, l, up)).join('')}</div>` : ''}${platforms(r, l, up)}</article>`;
    };
    // 과제가 이 페이지에 있던 때의 주소(research.html#proj-...)는 프로젝트 페이지로 보낸다.
    return `${head(t, t.research, '', toc)}<div class="wrap">${site.research.map(topic).join('')}</div>
<script>if(/^#proj-/.test(location.hash))location.replace('projects.html'+location.hash);</script>`;
  },
  projects(l, up) {
    const t = T[l];
    const item = (p) => {
      const meta = [range(p.start, p.end, t), site.project_sponsor_notes?.[p.key]?.[l] ?? p.sponsor[l], p.agency?.[l], p.role[l]].filter(Boolean).map(esc).join(', ');
      const topics = site.research.filter((r) => r.projects.includes(p.key));
      const points = p.summary.length ? `<ul class="points">${p.summary.map((s) => `<li>${esc(s[l])}</li>`).join('')}</ul>` : '';
      const related = topics.length ? `<p class="meta">${t.relatedResearch}: ${topics.map((r) => `<a href="research.html#${r.id}">${esc(r.short[l])}</a>`).join(', ')}</p>` : '';
      const logos = [site.project_logos?.[p.key] ?? []].flat();
      const body = `<p class="title">${esc(p.title[l])}</p><p class="meta">${meta}</p>${points}${related}`;
      if (!logos.length) return `<li id="${p.key}">${body}</li>`;
      const mark = (logo) => {
        const img = `<img class="logo${logo.mono ? ' mono' : ''}${logo.label ? ' emblem' : ''}" src="${up}assets/logos/${esc(logo.file)}" ${logo.label ? 'width="18" height="18"' : 'width="84" height="20"'} alt="${logo.label ? '' : esc(logo.name[l])}" loading="lazy">`;
        if (logo.label) return `<span class="org-mark" title="${esc(logo.name[l])}">${img}<span>${esc(logo.label[l])}</span></span>`;
        return logo.role ? `<span class="logo-role"><span>${esc(logo.role[l])}</span>${img}</span>` : img;
      };
      return `<li id="${p.key}" class="with-logo"><div>${body}</div><div class="logos">${logos.map(mark).join('')}</div></li>`;
    };
    projects.forEach((p) => kindOf(p.key, t));
    const groups = ['national', 'contract'].map((kind) => {
      const g = projects.filter((p) => site.project_kinds[kind].includes(p.key));
      return g.length ? `<div class="sheet-row"><h2>${t[kind]} (${g.length})</h2><ul class="biblio">${g.map(item).join('')}</ul></div>` : '';
    }).join('');
    return `${head(t, t.projectsTab, '')}<div class="wrap sheet">${groups}</div>`;
  },
  publications(l) {
    const t = T[l];
    const row = (title, items) => (items.length ? `<div class="sheet-row"><h3>${title} (${items.length})</h3><ul class="biblio">${items.join('')}</ul></div>` : '');
    const group = (id, title, n, rows) => `<section class="pub-group" id="${id}"><h2>${title} (${n})</h2>${rows}</section>`;
    const pubRows = CAT_ORDER.map((c) => row(t.cats[c], pubs.filter((p) => p.category === c).map((p) => pubItem(p, l)))).join('');
    const patRows = PAT_GROUPS.map(([k, test]) => row(t.patGroups[k], patents.filter(test).map((p) => patentItem(p, l)))).join('');
    return `${head(t, t.pubs, '')}<div class="wrap sheet">${group('papers', t.pubTitle, pubs.length, pubRows)}${group('patents', t.patTitle, patents.length, patRows)}</div>`;
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
      minor(t.misc, site.other_activities),
    ].join('');
    return `${head(t, t.etc, '')}<div class="wrap sheet">
${sec(t.pubAward, pa)}${sec(t.award, awards)}${sec(t.scholar, scholarships)}${sec(t.review, site.reviews)}${sec(t.consult, site.consulting)}
<div class="sheet-row"><h2>${t.otherAct}</h2><div class="minors">${others}</div></div></div>`;
  },
};

// 이전 주소 cv.html은 소개 페이지로 이동한다. CV는 소개 페이지의 PDF로 내려받는다.
const NAV = [['index', 'home'], ['research', 'research'], ['projects', 'projectsTab'], ['publications', 'pubs'], ['etc', 'etc']];

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
<link rel="stylesheet" href="${up}assets/style.css?v=${CSS_VER}">
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

const redirect = (to) => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><title>${to}</title></head><body><a href="${to}">${to}</a></body></html>\n`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(new URL('en/', OUT), { recursive: true });
cpSync(new URL('assets/', root), new URL('assets/', OUT), { recursive: true });
for (const l of ['ko', 'en']) {
  const dir = l === 'ko' ? '' : 'en/';
  for (const [page] of NAV) {
    writeFileSync(new URL(`${dir}${page}.html`, OUT), layout(page, l, pages[page](l, l === 'ko' ? '' : '../')));
  }
  writeFileSync(new URL(`${dir}cv.html`, OUT), redirect('index.html'));
}
console.log(`_site 생성: 페이지 ${NAV.length * 2}개`);
