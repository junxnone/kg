(() => {
  const base = document.body.dataset.base || '/';
  const $ = (s, r = document) => r.querySelector(s);

  // 主题切换
  $('#theme')?.addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('kg-theme', t);
  });

  // 侧边树：共用 tree.json，展开到当前文章
  const side = $('#tree');
  if (side) {
    const cur = decodeURIComponent(location.pathname).replace(/^\//, '');
    const rel = (h) => decodeURIComponent(base.replace(/^\//, '') + h);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const node = (n) => {
      const href = n.h ? base + n.h.split('/').map(encodeURIComponent).join('/') : '';
      const isCur = n.h && rel(n.h) === cur;
      const label = n.h ? `<a href="${href}"${isCur ? ' class="cur"' : ''}>${esc(n.n)}</a>` : `<span class="dir">${esc(n.n)}</span>`;
      if (!n.c) return `<li>${label}</li>`;
      const open = isCur || hasCur(n);
      return `<li><details${open ? ' open' : ''}><summary>${label}${n.k ? ` <small>${n.k}</small>` : ''}</summary><ul>${n.c.map(node).join('')}</ul></details></li>`;
    };
    const hasCur = (n) => (n.h && rel(n.h) === cur) || (n.c || []).some(hasCur);
    fetch(base + 'tree.json')
      .then((r) => r.json())
      .then((t) => {
        side.innerHTML = `<ul class="tree">${t.map(node).join('')}</ul>`;
        $('a.cur', side)?.scrollIntoView({ block: 'center' });
      })
      .catch(() => (side.textContent = '目录加载失败'));
  }

  // 标签页过滤
  const cloud = $('#cloud');
  if (cloud) {
    const f = $('#tagfilter'), h = $('#hide1');
    const apply = () => {
      const q = f.value.trim().toLowerCase();
      cloud.querySelectorAll('.tag').forEach((a) => {
        const hide = (h.checked && !q && a.dataset.n === '1') || (q && !a.textContent.toLowerCase().includes(q));
        a.style.display = hide ? 'none' : '';
      });
    };
    f.addEventListener('input', apply);
    h.addEventListener('change', apply);
    apply();
  }


  // mermaid / markmap 按需加载
  if ($('pre.mermaid')) {
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
      m.default.run({ querySelector: 'pre.mermaid' });
    });
  }
  if ($('.markmap')) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/markmap-autoloader@0.18';
    document.head.append(s);
  }
})();
