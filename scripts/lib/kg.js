import { articleHref } from './markdown.js';

const MAX_GROUP = 4; // 3dkg 的 levelTextHeights 只有 5 级（0..4）

// 3dkg 的 kg.json：links 必须是无环的树；每个节点必须带 childLinks: []
// 根 kg → 各 wiki → 路径段；url 指向本站对应文章页（目录节点指向 tree.html）
export function genKgJson(cfg, roots) {
  const rootId = 'kg';
  const nodes = [{ id: rootId, group: 0, title: 'kg', url: cfg.siteUrl, visible: true, expand: true, childLinks: [] }];
  const links = [];
  const siteUrl = cfg.siteUrl.replace(/\/$/, '/');

  const walk = (node, parentId, id, depth) => {
    nodes.push({
      id,
      group: Math.min(depth, MAX_GROUP),
      title: node.title,
      url: node.art ? siteUrl + articleHref('', node.art).replace(/^\//, '') : `${siteUrl}tree.html`,
      visible: true,
      expand: true,
      childLinks: [],
    });
    links.push({ source: parentId, target: id, value: depth, visible: true, expand: true });
    for (const k of node.kids.values()) walk(k, id, `${id} ${k.name}`, depth + 1);
  };
  for (const r of roots) walk(r, rootId, r.name, 1);
  return JSON.stringify({ nodes, links }) + '\n';
}
