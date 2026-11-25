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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} · ${esc(cfg.title)}</title>
<script>document.documentElement.dataset.theme=localStorage.getItem('kg-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')</script>
<link rel="stylesheet" href="${b}assets/site.css">
<link rel="manifest" href="${b}manifest.webmanifest">
<meta name="theme-color" content="#2563eb">
<link rel="apple-touch-icon" href="${b}icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="KG">
${math ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' : ''}
${head}
</head>
<body data-base="${b}" class="${cls}">
<header class="top">
  <a class="brand" href="${b}">${esc(cfg.title)}</a>
  <nav>
    <a href="${b}tree.html">🌲 树形</a>
    <a href="${b}tags/">🏷️ 标签</a>
    <a href="${b}recent.html">🆕 最近</a>
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
<div class="head"><div class="crumbs">${crumbs}</div><a class="edit-btn" href="${esc(a.edit || `https://github.com/${repo.repo}/issues/${Number(a.num)}`)}" target="_blank" rel="noopener" title="在 GitHub 打开对应 issue 编辑">✏️ Edit</a></div>
<div class="meta">
  ${a.created ? `<span>创建 ${day(a.created)}</span>` : ''}${a.updated ? `<span>更新 ${day(a.updated)}</span>` : ''}
  <span>${esc(a.repo)} #${Number(a.num)}</span>
</div>
<div class="chips">${chips(cfg, tags, tagFile)}</div>
<div class="md">${r.html}</div>
</article>`;
  const head = `${r.hasMarkmap ? '<meta name="kg-markmap" content="1">' : ''}${r.hasMermaid ? '<meta name="kg-mermaid" content="1">' : ''}`;
  return layout(cfg, { title: a.title, body, sidebar: true, toc: r.toc, math: r.hasMath, head, cls: 'article' });
}

const li = (cfg, a, extra = '') =>
  `<li><a href="${articleHref(cfg.basePath, a)}">${esc(a.title)}</a> <span class="sub">${esc(a.repo)} › ${esc(a.segs.slice(0, -1).join(' › '))}</span>${extra}</li>`;

export function articleList(cfg, items, field = 'updated') {
  return `<ul class="list">${items.map((a) => li(cfg, a, `<time>${day(a[field] || a.created)}</time>`)).join('')}</ul>`;
}

export function homePage(cfg, roots, counts) {
  const cards = cfg.repos
    .map((r) => `<a class="card" href="${cfg.basePath}tree.html#${enc(r.name)}"><b>${esc(r.title)}</b><span>${esc(r.desc)}</span><em>${counts[r.name] || 0} 篇</em></a>`)
    .join('');
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const body = `<section class="hero">
<h1>${esc(cfg.title)}</h1>
<p>${total} 篇文章 · ${cfg.repos.length} 个知识库</p>
<div class="entry">
  <a href="${cfg.basePath}tree.html">🌲 树形浏览</a><a href="${cfg.basePath}search.html">🔍 搜索</a>
  <a href="${cfg.basePath}tags/">🏷️ 标签</a><a href="${cfg.basePath}recent.html">🆕 最近</a><a href="${cfg.basePath}graph.html">🧊 3D 知识图谱</a>
</div></section>
<div class="cards">${cards}</div>
`;
  return layout(cfg, { title: '首页', body });
}

export function treePage(cfg, treeHtmlStr) {
  return layout(cfg, { title: '树形浏览', body: `<h1>🌲 树形浏览</h1><p class="sub">点击目录展开，点击标题阅读。</p>${treeHtmlStr}` });
}

export function tagsIndexPage(cfg, tags, tagFile) {
  const items = [...tags].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hans-CN'));
  const max = Math.max(1, ...items.map(([, a]) => a.length));
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  // 词云：字号按词频（对数）缩放；颜色按名称哈希取色相
  const size = (n) => (0.8 + 2.7 * Math.log(n) / Math.log(max + 1)).toFixed(2);
  const tag = ([t, arts]) =>
    `<a class="tag" data-n="${arts.length}" title="${arts.length} 篇" style="font-size:${size(arts.length)}em;--h:${hash(t) % 360}" href="${cfg.basePath}tags/${tagFile(t)}.html">${esc(t)}</a>`;
  // 频率从高到低，每 50 个一层；层内用固定种子洗牌（构建结果稳定），所以每层内位置随机
  let seed = 20240607;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const layers = [];
  const LAYERS = 6; // 只显示频率最高的 6 层（300 个）
  for (let i = 0; i < Math.min(items.length, LAYERS * 50); i += 50) {
    const layer = items.slice(i, i + 50);
    for (let j = layer.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1));
      [layer[j], layer[k]] = [layer[k], layer[j]];
    }
    layers.push(`<div class="layer">${layer.map(tag).join(' ')}</div>`);
  }
  const body = `<h1>🏷️ 标签云</h1>
<p class="sub">共 ${items.length} 个标签，这里显示频率最高的 ${Math.min(items.length, LAYERS * 50)} 个（issue Labels + 路径各层级）；字号越大文章越多，从上到下频率递减，每 50 个一层。点击查看包含该标签的文章列表。</p>
<div class="tagbar"><input id="tagfilter" type="search" placeholder="过滤标签…"></div>
<div class="cloud" id="cloud">${layers.join('')}</div>`;
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

// 最近：两个 tab —— 最新文章（按创建时间）/ 最近更新（按更新时间）
export function recentPage(cfg, articles, limit = 100) {
  // 最近更新 只列创建之后真正被修改过的文章（更新时间比创建时间晚 1 小时以上）
  const edited = (a) => a.updated && (!a.created || Date.parse(a.updated) - Date.parse(a.created) > 3600e3);
  const top = (field) => [...articles].filter((a) => a[field] && (field !== 'updated' || edited(a))).sort((a, b) => b[field].localeCompare(a[field])).slice(0, limit);
  const body = `<h1>🆕 最近</h1>
<div class="tabs" role="tablist">
  <button type="button" class="tab on" data-tab="new" role="tab">最新文章</button>
  <button type="button" class="tab" data-tab="upd" role="tab">最近更新</button>
</div>
<section class="pane" id="pane-new">${articleList(cfg, top('created'), 'created')}</section>
<section class="pane" id="pane-upd" hidden>${articleList(cfg, top('updated'), 'updated')}</section>`;
  return layout(cfg, { title: '最近', body });
}
