import fs from 'node:fs';
import path from 'node:path';

const DOC_RE = /^(\d{4})_(.+)\.md$/;

// 读取 <srcDir>/<repo>/docs 下顶层的 NNNN_*.md（不进入 bk/，也自动排除 README/_sidebar/sidebar/hist）
export function readRepo(srcDir, repo) {
  const docs = path.join(srcDir, repo.name, 'docs');
  if (!fs.existsSync(docs)) {
    console.warn(`! ${repo.name}: ${docs} 不存在，跳过`);
    return [];
  }
  const out = [];
  for (const f of fs.readdirSync(docs).sort()) {
    const m = f.match(DOC_RE);
    if (!m || !fs.statSync(path.join(docs, f)).isFile()) continue;
    out.push(parseDoc(fs.readFileSync(path.join(docs, f), 'utf8'), repo, f, m[1], m[2]));
  }
  return out;
}

// wiki_issue2md 写的表格头（不是 YAML）：
// ---\nTitle | x\n-- | --\nCreated @ | `..`\nUpdated @| `..`\nLabels | `a, b`\nEdit @| [here](url)\n\n---
export function parseDoc(text, repo, file, num, rest) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const meta = { created: '', updated: '', labels: [], edit: '' };
  let body = text;
  const hm = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (hm && /^Title\s*\|/m.test(hm[1])) {
    for (const line of hm[1].split('\n')) {
      const m = line.match(/^(Title|Created|Updated|Labels|Edit)(?: @)?\s*\|\s*(.*)$/);
      if (!m) continue;
      const v = m[2].trim();
      const val = v.replace(/^`|`$/g, '').trim();
      if (m[1] === 'Created') meta.created = val;
      else if (m[1] === 'Updated') meta.updated = val;
      else if (m[1] === 'Labels') meta.labels = val.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      else if (m[1] === 'Edit') meta.edit = (v.match(/\((.*?)\)/) || [])[1] || '';
    }
    body = text.slice(hm[0].length);
  }

  const segs = rest.split('_').filter(Boolean);
  return {
    repo: repo.name,
    file: file.replace(/\.md$/, ''),
    num,
    segs,
    title: firstHeading(body) || segs[segs.length - 1] || rest,
    body,
    ...meta,
  };
}

function firstHeading(md) {
  let fence = null;
  for (const line of md.split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (m) return m[1].replace(/[*_`]/g, '').trim();
  }
  return '';
}
