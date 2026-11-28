// RoadMap：文件名里含 "roadmap"（不分大小写）的文章，用 jstools/mdfishbone 渲染成鱼骨图。
// mdfishbone 只认 md 地址，而且只能给 "/" 开头的链接拼前缀，不会按 issue 编号解析、也不会补 .html，
// 所以这里生成一份链接已改写成本站文章地址的 md（roadmap/<repo>/<file>.md），再交给它渲染。

export const isRoadmap = (a) => /roadmap/i.test(a.file);

// docsify 站内链接：/NNNN_x  #/NNNN_x  ./NNNN_x  https://junxnone.github.io/<repo>/#/NNNN_x
const LOOKS_INTERNAL = /^(?:https?:\/\/junxnone\.github\.io\/[\w.-]+\/)?(?:#?\/|\.\/)?\d{4}_/;

export function buildRoadmaps(cfg, articles, resolve) {
  const items = [];
  for (const a of articles.filter(isRoadmap)) {
    let unresolved = 0;
    // 能按编号找到文章的链接改成本站绝对地址；找不到的内部链接去掉链接只留文字（比指向 404 好）
    let md = a.body.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const to = resolve(href, a.repo);
      if (to) return `[${text}](${new URL(to, cfg.siteUrl).href})`;
      if (LOOKS_INTERNAL.test(href)) { unresolved++; return text; }
      return m;
    });

    // 标题本身是链接时（如 `# [Linux RoadMap](…)`）鱼头会显示成 markdown 源码，去掉链接只留文字
    md = md.replace(/^(# )\[([^\]]*)\]\([^)]*\)[ \t]*$/m, '$1$2');

    // 统计（和 mdfishbone 的规则一致：只数 "- [x]" / "- [ ]" 复选项；## 是层次）
    const done = (md.match(/^\s*- \[[xX]\]/gm) || []).length;
    const todo = (md.match(/^\s*- \[ \]/gm) || []).length;
    const levels = (md.match(/^## /gm) || []).length;
    const total = done + todo;
    items.push({
      a,
      md,
      repo: cfg.repos.find((r) => r.name === a.repo),
      done, todo, levels,
      pct: total ? Math.round((done / total) * 100) : null,
      unresolved,
      path: `roadmap/${a.repo}/${encodeURIComponent(a.file)}`, // 不含扩展名
      mdUrl: new URL(`roadmap/${a.repo}/${encodeURIComponent(a.file)}.md`, cfg.siteUrl).href,
    });
  }
  return items;
}

