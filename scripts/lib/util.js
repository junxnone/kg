export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const enc = encodeURIComponent;

// 与 tt/scripts/lib.js 相同：只对代码以外的部分做变换
export const CODE_RE = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)|`[^`\n]*`/g;

export function outsideCode(md, fn) {
  let out = '', last = 0;
  for (const m of md.matchAll(CODE_RE)) {
    out += fn(md.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(md.slice(last));
}

// 标签 / 文件名安全化
export function safeName(s) {
  return String(s).trim().replace(/[\\/:*?"<>|#%&+\s]+/g, '_') || '_';
}

export const day = (iso) => (iso || '').slice(0, 10);
