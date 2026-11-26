import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { esc, outsideCode } from './util.js';

// 内部链接：/NNNN_x  #/NNNN_x  ./NNNN_x  NNNN_x.md  https://junxnone.github.io/<repo>/#/NNNN_x
const INTERNAL_RE = /^(?:https?:\/\/junxnone\.github\.io\/([\w.-]+)\/)?(?:#?\/|\.\/)?(\d{4})_[^?#]*?(?:\.md)?(?:[?#].*)?$/;

// 解析 ':include :type=iframe width=100% height=600px'，返回嵌入块的 HTML；不支持的返回 ''
// - iframe：直接嵌入；有些网站禁止被嵌入，所以下面总带一个"新窗口打开"链接
// - code：页面脚本（assets/site.js）按 data-src 抓取文本后填进去
const dim = (v, d) => (/^\d+(\.\d+)?(px|%|vh|vw|em|rem)?$/.test(v || '') ? (/^\d+(\.\d+)?$/.test(v) ? `${v}px` : v) : d);
function embedHtml(href, title, label) {
  if (!/^https?:\/\//i.test(href)) return '';
  const o = {};
  for (const p of title.split(/\s+/)) {
    const m = p.match(/^:?([\w-]+)=(.*)$/);
    if (m) o[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  const type = o.type || 'iframe';
  const open = `<a class="embed-open" href="${esc(href)}" target="_blank" rel="noopener">${esc(label || href)} ↗</a>`;
  if (type === 'iframe') {
    return `<span class="embed"><iframe src="${esc(href)}" style="width:${dim(o.width, '100%')};height:${dim(o.height, '400px')}" loading="lazy" allowfullscreen></iframe>${open}</span>`;
  }
  if (type === 'code') return `<span class="embed"><span class="embed-code" data-src="${esc(href)}"><code>加载中…</code></span>${open}</span>`;
  return '';
}

export function createMarkdown() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight(str, lang) {
      if (!lang || !hljs.getLanguage(lang)) return '';
      try {
        return `<pre><code class="hljs language-${esc(lang)}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        return '';
      }
    },
  });
  md.use(anchor, { level: [1, 2, 3, 4, 5, 6] });

  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const t = tokens[idx];
    const lang = t.info.trim().split(/\s+/)[0];
    if (lang === 'mermaid') return `<pre class="mermaid">${esc(t.content)}</pre>\n`;
    if (lang === 'markmap') return `<div class="markmap"><script type="text/template">\n${t.content.replace(/<\/script/gi, '<\\/script')}</script></div>\n`;
    return fence(tokens, idx, opts, env, self);
  };

  // docsify 嵌入语法：[说明](url ':include :type=iframe width=100% height=600px')
  // 在 inline 解析之后，把整个链接替换成嵌入块；识别不了的写法保持为普通链接
  md.core.ruler.push('docsify_embed', (state) => {
    for (const blk of state.tokens) {
      if (blk.type !== 'inline' || !blk.children) continue;
      const ch = blk.children;
      for (let i = 0; i < ch.length; i++) {
        if (ch[i].type !== 'link_open') continue;
        const title = ch[i].attrGet('title') || '';
        if (!title.startsWith(':include')) continue;
        let j = i + 1;
        while (j < ch.length && ch[j].type !== 'link_close') j++;
        if (j >= ch.length) continue;
        const label = ch.slice(i + 1, j).map((c) => c.content).join('');
        const html = embedHtml(ch[i].attrGet('href') || '', title, label);
        if (!html) continue;
        const tok = new state.Token('html_inline', '', 0);
        tok.content = html;
        ch.splice(i, j - i + 1, tok);
      }
    }
  });

  const linkOpen = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx];
    const href = tok.attrGet('href') || '';
    // docsify 的 ':ignore' / ':target=_blank' 等写在 title 里的指令，不应该显示成悬浮提示
    if ((tok.attrGet('title') || '').startsWith(':')) tok.attrs = tok.attrs.filter((a) => a[0] !== 'title');
    const internal = env.resolveLink(href, env.repo);
    if (internal) tok.attrSet('href', internal);
    else if (/^https?:/i.test(href)) {
      tok.attrSet('target', '_blank');
      tok.attrSet('rel', 'noopener');
    }
    return linkOpen(tokens, idx, opts, env, self);
  };
  return md;
}

// 公式在 markdown 之前抽出来用 KaTeX 渲染，再以占位符回填，避免 markdown 吃掉 _ * \ 等
function extractMath(src, env) {
  const put = (tex, display) => {
    let html;
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: true, output: 'html' });
    } catch {
      env.stats.mathFail++;
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    }
    env.math.push(display ? `<div class="math-display">${html}</div>` : html);
    env.stats.math++;
    return `KGMATH${env.math.length - 1}END`;
  };
  return outsideCode(src, (chunk) =>
    chunk
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => put(t.trim(), true))
      .replace(/(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?![\d$])/g, (_, t) => put(t, false)));
}

// 返回 { html, toc, hasMath, hasMermaid, hasMarkmap, text }
export function render(md, article, resolveLink, stats) {
  const env = { repo: article.repo, resolveLink, math: [], stats };
  let html = md.render(extractMath(article.body, env), env);
  html = html.replace(/KGMATH(\d+)END/g, (_, i) => env.math[+i]);
  // 图片懒加载（含文章里手写的 <img>；代码块里的 <img 已被转义，不受影响）
  html = html.replace(/<img\b(?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async"');
  const toc = [...html.matchAll(/<h([2-6]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: +m[1],
    id: m[2],
    text: m[3].replace(/<[^>]+>/g, '').trim(),
  }));
  return {
    html,
    toc,
    hasMath: env.math.length > 0,
    hasMermaid: html.includes('class="mermaid"'),
    hasMarkmap: html.includes('class="markmap"'),
  };
}

// 建立 (repo, NNNN) → 文章 的解析器；按 issue 号解析，issue 改名后旧链接仍有效
export function makeResolver(articles, base) {
  const byKey = new Map(articles.map((a) => [`${a.repo}/${a.num}`, a]));
  return (href, curRepo) => {
    const m = href.match(INTERNAL_RE);
    if (!m) return null;
    const a = byKey.get(`${m[1] || curRepo}/${m[2]}`);
    return a ? articleHref(base, a) : null;
  };
}

export const articleHref = (base, a) => `${base}${a.repo}/${encodeURIComponent(a.file)}.html`;
