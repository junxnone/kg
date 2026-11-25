import { articleHref } from './markdown.js';
import { esc } from './util.js';

const cmp = (a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true });

// repo → 路径段嵌套树。同一路径出现多篇（issue 改名遗留等）时，后者追加 "(NNNN)" 区分
export function buildTree(cfg, articles) {
  const roots = [];
  for (const repo of cfg.repos) {
    const root = { name: repo.name, title: repo.title, art: null, kids: new Map(), repo: repo.name };
    const mine = articles.filter((a) => a.repo === repo.name).sort((a, b) => cmp(a.segs.join('/'), b.segs.join('/')));
    for (const a of mine) {
      let node = root;
      a.segs.forEach((seg, i) => {
        const last = i === a.segs.length - 1;
        let key = seg;
        let kid = node.kids.get(key);
        if (last && kid && kid.art) {
          key = `${seg} (${a.num})`;
          kid = node.kids.get(key);
        }
        if (!kid) {
          kid = { name: key, title: key, art: null, kids: new Map(), repo: repo.name };
          node.kids.set(key, kid);
        }
        if (last) {
          kid.art = a;
          kid.title = a.title;
        }
        node = kid;
      });
    }
    roots.push(root);
  }
  return roots;
}

const sortedKids = (n) => [...n.kids.values()].sort((a, b) => cmp(a.name, b.name));

export const countArts = (n) => (n.art ? 1 : 0) + sortedKids(n).reduce((s, k) => s + countArts(k), 0);

// 给侧边树用的紧凑 JSON：{n: 名称, h: 链接, c: 子节点, k: 篇数}
export function treeJson(cfg, roots) {
  const conv = (n) => {
    const o = { n: n.title };
    if (n.art) o.h = articleHref('', n.art).replace(/^\//, '');
    const c = sortedKids(n).map(conv);
    if (c.length) o.c = c;
    return o;
  };
  return roots.map((r) => ({ n: r.title, k: countArts(r), c: conv(r).c }));
}

// 无 JS 也能用的完整树（tree.html）
export function treeHtml(cfg, roots) {
  const li = (n, depth) => {
    const label = n.art
      ? `<a href="${articleHref(cfg.basePath, n.art)}">${esc(n.title)}</a>`
      : `<span class="dir">${esc(n.title)}</span>`;
    const kids = sortedKids(n);
    if (!kids.length) return `<li>${label}</li>`;
    return `<li${depth === 0 ? ` id="${esc(n.name)}"` : ''}><details${depth < 1 ? ' open' : ''}><summary>${label} <small>${countArts(n)}</small></summary><ul>${kids.map((k) => li(k, depth + 1)).join('')}</ul></details></li>`;
  };
  return `<ul class="tree">${roots.map((r) => li(r, 0)).join('')}</ul>`;
}
