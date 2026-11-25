// 用法: node scripts/build.js [--src sources] [--out dist]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from '../site.config.js';
import { readRepo } from './lib/parse.js';
import { createMarkdown, render, makeResolver } from './lib/markdown.js';
import { buildTree, treeJson, treeHtml } from './lib/tree.js';
import { genKgJson } from './lib/kg.js';
import { safeName } from './lib/util.js';
import * as T from './lib/templates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const SRC = path.resolve(arg('--src', path.join(ROOT, 'sources')));
const OUT = path.resolve(arg('--out', path.join(ROOT, 'dist')));

const write = (rel, content) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. 读取
const articles = cfg.repos.flatMap((r) => readRepo(SRC, r));
const counts = Object.fromEntries(cfg.repos.map((r) => [r.name, articles.filter((a) => a.repo === r.name).length]));
console.log('articles:', counts);
if (!articles.length) {
  console.error(`没有读到任何文章，检查 --src (${SRC})`);
  process.exit(1);
}

// 2. 标签 = Labels ∪ 路径各层级（跨库同名合并）
const tags = new Map();
const tagsOf = new Map();
for (const a of articles) {
  const ts = [...new Set([...a.labels, ...a.segs])];
  tagsOf.set(a, ts);
  for (const t of ts) {
    if (!tags.has(t)) tags.set(t, []);
    tags.get(t).push(a);
  }
}
const tagFiles = new Map();
const used = new Set(['index']); // tags/index.html 留给标签云
for (const t of tags.keys()) {
  let f = safeName(t), n = 2;
  while (used.has(f.toLowerCase())) f = `${safeName(t)}_${n++}`;
  used.add(f.toLowerCase());
  tagFiles.set(t, f);
}
const tagFile = (t) => encodeURIComponent(tagFiles.get(t));

// 3. 文章页
const md = createMarkdown();
const resolve = makeResolver(articles, cfg.basePath);
const stats = { math: 0, mathFail: 0 };
for (const a of articles) {
  const r = render(md, a, resolve, stats);
  write(`${a.repo}/${a.file}.html`, T.articlePage(cfg, a, r, tagsOf.get(a), tagFile));
}

// 4. 树 / 标签 / 首页 / 搜索 / 图谱
const roots = buildTree(cfg, articles);
write('tree.json', JSON.stringify(treeJson(cfg, roots)));
write('tree.html', T.treePage(cfg, treeHtml(cfg, roots)));
write('kg.json', genKgJson(cfg, roots));

write('tags/index.html', T.tagsIndexPage(cfg, tags, tagFile));
for (const [t, arts] of tags) write(`tags/${tagFiles.get(t)}.html`, T.tagPage(cfg, t, arts));

write('index.html', T.homePage(cfg, roots, counts));
write('recent.html', T.recentPage(cfg, articles));
write('search.html', T.searchPage(cfg));
write('graph.html', T.graphPage(cfg));
write('404.html', T.notFoundPage(cfg));
write('.nojekyll', '');

// 5. 静态资源
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });

console.log(`pages: ${articles.length} articles, ${tags.size} tags`);
console.log(`math: ${stats.math} formulas, ${stats.mathFail} failed (rendered as red source)`);
