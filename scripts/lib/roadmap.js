// RoadMap：文件名里含 "roadmap"（不分大小写）的文章，渲染成鱼骨图（构建阶段生成 HTML，见 fishbone.js）。
// md 里的 docsify 站内链接（/NNNN_x 等）按 issue 编号解析成本站文章地址；找不到的去掉链接只留文字。
import { parseFishbone, fishboneHtml } from './fishbone.js';

export const isRoadmap = (a) => /roadmap/i.test(a.file);

// docsify 站内链接：/NNNN_x  #/NNNN_x  ./NNNN_x  https://junxnone.github.io/<repo>/#/NNNN_x
const LOOKS_INTERNAL = /^(?:https?:\/\/junxnone\.github\.io\/[\w.-]+\/)?(?:#?\/|\.\/)?\d{4}_/;

export function buildRoadmaps(cfg, articles, resolve) {
  return articles.filter(isRoadmap).map((a) => {
    let unresolved = 0;
    const fixHref = (u) => {
      const to = resolve(u, a.repo);
      if (to) return to;
      if (LOOKS_INTERNAL.test(u)) { unresolved++; return null; }
      return u;
    };
    const fb = fishboneHtml(parseFishbone(a.body, fixHref), a.title);
    const total = fb.done + fb.todo;
    return {
      a,
      repo: cfg.repos.find((r) => r.name === a.repo),
      html: fb.html,
      tree: fb.tree,
      done: fb.done,
      todo: fb.todo,
      levels: fb.levels,
      pct: total ? Math.round((fb.done / total) * 100) : null,
      unresolved,
      path: `roadmap/${a.repo}/${encodeURIComponent(a.file)}`, // 不含扩展名
    };
  });
}
