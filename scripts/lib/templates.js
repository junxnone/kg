import { esc, enc, day } from './util.js';
import { articleHref } from './markdown.js';

export function layout(cfg, { title, body, sidebar = false, toc = [], math = false, head = '', cls = '' }) {
  const b = cfg.basePath;
  const tocHtml = toc.length
    ? `<aside class="toc-nav"><div class="page_toc">${toc.map((t) => `<div class="l${t.level}"><a href="#${t.id}" title="${esc(t.text)}">${esc(t.text)}</a></div>`).join('')}</div></aside>`
    : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(cfg.title)}</title>
<script>document.documentElement.dataset.theme=localStorage.getItem('kg-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')</script>
<link rel="stylesheet" href="${b}assets/site.css">
${math ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' : ''}
${head}
</head>
<body data-base="${b}" class="${cls}">
<header class="top">
  <a class="brand" href="${b}">${esc(cfg.title)}</a>
  <nav>
    <a href="${b}tree.html">🌲 树形</a>
    <a href="${b}tags/">🏷️ 标签</a>
    <a href="${b}search.html">🔍 搜索</a>
    <a href="${b}graph.html">🧊 3D</a>
  </nav>
  <form class="q" action="${b}search.html"><input name="q" type="search" placeholder="搜索全部文章…" aria-label="搜索"></form>
</header>
<div class="wrap${sidebar ? ' with-side' : ''}">
${sidebar ? '<aside id="side"><div id="tree" class="side-inner">加载中…</div></aside>' : ''}
<main>
${body}
</main>
${tocHtml}
</div>
<button id="theme" type="button" title="切换黑白主题">◐</button>
<script src="${b}assets/site.js" defer></script>
</body>
</html>
`;
}

const chips = (cfg, tags, tagFile) =>
  tags.map((t) => `<a class="chip" href="${cfg.basePath}tags/${tagFile(t)}.html">${esc(t)}</a>`).join('');

export function articlePage(cfg, a, r, tags, tagFile) {
  const repo = cfg.repos.find((x) => x.name === a.repo);
  const crumbs = [`<a href="${cfg.basePath}tree.html#${enc(a.repo)}">${esc(repo.title)}</a>`, ...a.segs.slice(0, -1).map(esc)].join(' › ');
  const labels = a.labels.map((l) => `<meta data-pagefind-filter="label" content="${esc(l)}">`).join('');
  const body = `<article data-pagefind-body>
<meta data-pagefind-filter="repo" content="${esc(a.repo)}">${labels}
<div class="crumbs">${crumbs}</div>
<div class="meta">
  ${a.created ? `<span>创建 ${day(a.created)}</span>` : ''}${a.updated ? `<span>更新 ${day(a.updated)}</span>` : ''}
  <span>${esc(a.repo)} #${Number(a.num)}</span>
  ${a.edit ? `<a href="${esc(a.edit)}" target="_blank" rel="noopener">✏️ Issue</a>` : ''}
</div>
<div class="chips">${chips(cfg, tags, tagFile)}</div>
<div class="md">${r.html}</div>
</article>`;
  const head = `${r.hasMarkmap ? '<meta name="kg-markmap" content="1">' : ''}${r.hasMermaid ? '<meta name="kg-mermaid" content="1">' : ''}`;
  return layout(cfg, { title: a.title, body, sidebar: true, toc: r.toc, math: r.hasMath, head, cls: 'article' });
}

const li = (cfg, a, extra = '') =>
  `<li><a href="${articleHref(cfg.basePath, a)}">${esc(a.title)}</a> <span class="sub">${esc(a.repo)} › ${esc(a.segs.slice(0, -1).join(' › '))}</span>${extra}</li>`;

export function articleList(cfg, items) {
  return `<ul class="list">${items.map((a) => li(cfg, a, `<time>${day(a.updated || a.created)}</time>`)).join('')}</ul>`;
}

export function homePage(cfg, roots, counts, recent) {
  const cards = cfg.repos
    .map((r) => `<a class="card" href="${cfg.basePath}tree.html#${enc(r.name)}"><b>${esc(r.title)}</b><span>${esc(r.desc)}</span><em>${counts[r.name] || 0} 篇</em></a>`)
    .join('');
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const body = `<section class="hero">
<h1>${esc(cfg.title)}</h1>
<p>${total} 篇文章 · ${cfg.repos.length} 个知识库</p>
<div class="entry">
  <a href="${cfg.basePath}tree.html">🌲 树形浏览</a><a href="${cfg.basePath}search.html">🔍 搜索</a>
  <a href="${cfg.basePath}tags/">🏷️ 标签</a><a href="${cfg.basePath}graph.html">🧊 3D 知识图谱</a>
</div></section>
<div class="cards">${cards}</div>
<h2>最近更新</h2>${articleList(cfg, recent)}`;
  return layout(cfg, { title: '首页', body });
}

export function treePage(cfg, treeHtmlStr) {
  return layout(cfg, { title: '树形浏览', body: `<h1>🌲 树形浏览</h1><p class="sub">点击目录展开，点击标题阅读。</p>${treeHtmlStr}` });
}

export function tagsIndexPage(cfg, tags, tagFile) {
  const items = [...tags].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hans-CN'));
  const max = items[0] ? items[0][1].length : 1;
  const cloud = items
    .map(([t, arts]) => `<a class="tag" data-n="${arts.length}" style="font-size:${(0.85 + 0.9 * Math.log(arts.length) / Math.log(max + 1)).toFixed(2)}em" href="${cfg.basePath}tags/${tagFile(t)}.html">${esc(t)}<sup>${arts.length}</sup></a>`)
    .join(' ');
  const body = `<h1>🏷️ 标签</h1>
<p class="sub">标签 = issue Labels + 路径各层级。共 ${items.length} 个。</p>
<div class="tagbar"><input id="tagfilter" type="search" placeholder="过滤标签…"><label><input id="hide1" type="checkbox" checked> 隐藏仅 1 篇的标签</label></div>
<div class="cloud" id="cloud">${cloud}</div>`;
  return layout(cfg, { title: '标签', body });
}

export function tagPage(cfg, tag, arts) {
  const sorted = [...arts].sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  return layout(cfg, {
    title: `标签 ${tag}`,
    body: `<h1>🏷️ ${esc(tag)} <small>${arts.length} 篇</small></h1><p><a href="${cfg.basePath}tags/">← 全部标签</a></p>${articleList(cfg, sorted)}`,
  });
}

export function searchPage(cfg) {
  const b = cfg.basePath;
  const head = `<link href="${b}pagefind/pagefind-ui.css" rel="stylesheet">`;
  const body = `<h1>🔍 搜索</h1><div id="search"></div>
<script src="${b}pagefind/pagefind-ui.js"></script>
<script>
window.addEventListener('DOMContentLoaded', () => {
  const ui = new PagefindUI({ element: '#search', showSubResults: false, showImages: false, resetStyles: false, pageSize: 20,
    translations: { placeholder: '输入关键词，支持中文', zero_results: '没有找到 [SEARCH_TERM]' } });
  const q = new URLSearchParams(location.search).get('q');
  if (q) ui.triggerSearch(q);
});
</script>`;
  return layout(cfg, { title: '搜索', body, head });
}

export function graphPage(cfg) {
  const src = `${cfg.viewer3d}?json=${enc(cfg.siteUrl + 'kg.json')}`;
  const body = `<iframe class="graph" src="${esc(src)}" title="3D knowledge graph" allowfullscreen></iframe>
<p class="sub">单击节点打开文章，双击展开/折叠，右键聚焦。<a href="${esc(src)}" target="_blank" rel="noopener">全屏打开 ↗</a></p>`;
  return layout(cfg, { title: '3D 知识图谱', body, cls: 'graphpage' });
}

export function notFoundPage(cfg) {
  return layout(cfg, { title: '404', body: `<h1>404</h1><p>页面不存在。<a href="${cfg.basePath}">回首页</a> 或 <a href="${cfg.basePath}search.html">搜索</a>。</p>` });
}
