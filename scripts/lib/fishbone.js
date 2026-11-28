// 鱼骨图：解析与 HTML 生成（移植自 jstools/mdfishbone，构建阶段完成；骨线在浏览器里画，见 assets/fishbone.js）
//   ## 标题                 一个层次（一根骨）
//   - 文字                  主题（缩进 0）；缩进 ≥1 级的无复选框项是子主题，显示为「主题 / 子主题」
//   - [x] [文字](url)       已创建的条目；- [ ] 文字 是未创建的条目
// md 里既没有 "## " 也没有复选框时进入树模式（纯嵌套列表按缩进深度分层，没有完成比例）
import { esc } from './util.js';

// fixHref(url) → 最终链接，返回 null 表示去掉链接只留文字
export function parseFishbone(md, fixHref) {
  const node = (text) => {
    const m = text.match(/^\[(.+?)\]\((.+?)\)$/);
    return m ? { text: m[1], href: fixHref(m[2]) } : { text, href: null };
  };
  const tree = !/^## /m.test(md) && !/^\s*- \[[ xX]\]\s/m.test(md);
  const levels = [];
  let cur = null, grp = null, parent = null;
  const stack = [];

  for (const line of md.split(/\r?\n/)) {
    if (tree) {
      if (/^---\s*$/.test(line)) break; // 遇到单独的 --- 行停止（docsify 侧边栏末尾的分隔线和署名）
      const m = line.match(/^(\s*)- (.*)$/);
      if (!m) continue;
      const depth = Math.floor(m[1].length / 2), n = node(m[2].trim());
      if (depth === 0) { cur = { title: n.text, href: n.href, groups: [] }; levels.push(cur); grp = null; stack.length = 0; }
      else if (!cur) continue;
      else if (depth === 1) { grp = { name: n.text, href: n.href, items: [] }; cur.groups.push(grp); stack.length = 0; }
      else if (grp) { stack.length = depth - 2; stack[depth - 2] = n.text; grp.items.push({ text: stack.join(' / '), href: n.href, done: null }); }
      continue;
    }
    if (/^# /.test(line)) continue; // 标题用文章标题，不从 md 里取
    if (/^## /.test(line)) {
      const n = node(line.slice(3).trim());
      cur = { title: n.text, href: n.href, groups: [] };
      levels.push(cur);
      grp = parent = null;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^(\s*)- (\[([ xX])\]\s+)?(.*)$/);
    if (!m) continue;
    const depth = Math.floor(m[1].length / 2), isItem = !!m[2], text = m[4].trim();
    if (!isItem) {
      const n = node(text);
      if (depth === 0) { grp = { name: n.text, href: n.href, items: [] }; parent = grp; }
      else grp = { name: (parent ? parent.name + ' / ' : '') + n.text, href: n.href, items: [] };
      cur.groups.push(grp);
    } else if (grp) {
      const n = node(text);
      grp.items.push({ done: m[3].toLowerCase() === 'x', text: n.text, href: n.href });
    }
  }
  return { levels, tree };
}

// 站内链接是绝对路径（/kg/...），原窗口打开；其余（http…）新标签页
const link = (text, href) =>
  href ? `<a href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ''}>${esc(text)}</a>` : esc(text);

export function fishboneHtml({ levels, tree }, title) {
  let done = 0, todo = 0;
  const slots = levels.map((lv) => {
    const d = lv.groups.reduce((a, g) => a + g.items.filter((x) => x.done).length, 0);
    const t = lv.groups.reduce((a, g) => a + g.items.filter((x) => x.done === false).length, 0);
    done += d; todo += t;
    // 树模式没有「已创建 / 未创建」，只显示条目数（没有条目的主题自己算一项）
    const cnt = lv.groups.reduce((a, g) => a + (g.items.length || 1), 0);
    const small = !tree || cnt ? `<small>${tree ? `${cnt} 项` : `已创建 ${d} / 未创建 ${t}`}</small>` : '';
    const groups = lv.groups
      .filter((g) => g.items.length || tree)
      .map((g) => {
        const chips = g.items.map((x) => {
          const kind = x.done === null ? 'plain' : x.done ? 'done' : 'todo';
          return x.href
            ? `<a class="fb-chip ${kind}" href="${esc(x.href)}"${/^https?:/i.test(x.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(x.text)}</a>`
            : `<span class="fb-chip ${kind}">${esc(x.text)}</span>`;
        }).join('');
        return `<div class="fb-grp"><div class="fb-gname">${link(g.name, g.href)}</div><div class="fb-items">${chips}</div></div>`;
      }).join('');
    return `<div class="fb-slot"><div class="fb-block" data-d="${d}" data-t="${t}"><div class="fb-lv">${link(lv.title, lv.href)}${small}</div>${groups}</div></div>`;
  });
  return {
    html: `<div class="fb-board" data-tree="${tree ? 1 : 0}">${slots.join('')}<div class="fb-head">${esc(title)}</div></div>`,
    done, todo, levels: levels.length, tree,
  };
}
