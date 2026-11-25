import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { esc, outsideCode } from './util.js';

// 内部链接：/NNNN_x  #/NNNN_x  ./NNNN_x  NNNN_x.md  https://junxnone.github.io/<repo>/#/NNNN_x
const INTERNAL_RE = /^(?:https?:\/\/junxnone\.github\.io\/([\w.-]+)\/)?(?:#?\/|\.\/)?(\d{4})_[^?#]*?(?:\.md)?(?:[?#].*)?$/;

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
  md.use(anchor, { level: [1, 2, 3, 4] });

  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const t = tokens[idx];
    const lang = t.info.trim().split(/\s+/)[0];
    if (lang === 'mermaid') return `<pre class="mermaid">${esc(t.content)}</pre>\n`;
    if (lang === 'markmap') return `<div class="markmap"><script type="text/template">\n${t.content.replace(/<\/script/gi, '<\\/script')}</script></div>\n`;
    return fence(tokens, idx, opts, env, self);
  };

  const linkOpen = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx];
    const href = tok.attrGet('href') || '';
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
  const toc = [...html.matchAll(/<h([234]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
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
