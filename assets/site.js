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
      const href = n.h ? base + n.h : ''; // n.h 已是 percent-encoded
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
    const f = $('#tagfilter');
    const apply = () => {
      const q = f.value.trim().toLowerCase();
      cloud.querySelectorAll('.tag').forEach((a) => {
        const hide = q && !a.textContent.toLowerCase().includes(q);
        a.style.display = hide ? 'none' : '';
      });
      cloud.querySelectorAll('.layer').forEach((l) => {
        l.style.display = [...l.querySelectorAll('.tag')].some((a) => a.style.display !== 'none') ? '' : 'none';
      });
    };
    f.addEventListener('input', apply);
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

// ---- docsify 式侧边栏开关 / aiwiki 式 TOC / 回到顶部 ----
(() => {
  const body = document.body;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const mk = (tag, id, text, title, fn) => {
    const e = document.createElement(tag);
    Object.assign(e, { id, textContent: text, title, type: 'button' });
    e.addEventListener('click', fn);
    body.append(e);
    return e;
  };

  // 侧边栏：宽屏默认展开，选择记在 localStorage（窄屏 <800px 改为右侧 KG 弹出树，见下）
  if (document.getElementById('side')) {
    const narrow = () => innerWidth < 800;
    body.classList.toggle('side-collapsed', store.get('side-collapsed') === '1');
    mk('button', 'side-toggle', '☰', '显示/隐藏侧边栏', () => {
      body.classList.toggle('side-collapsed');
      store.set('side-collapsed', body.classList.contains('side-collapsed') ? '1' : '0');
    });

    // 窄屏：右侧 KG 按钮弹出/收起树；点击文章链接后自动收起；与 TOC 互斥
    mk('button', 'kg-toggle', 'KG', '显示/隐藏文章树', () => {
      body.classList.toggle('kg-open');
      if (body.classList.contains('kg-open') && narrow()) body.classList.add('toc-collapsed');
    });
    document.getElementById('side').addEventListener('click', (e) => {
      if (e.target.closest('a')) body.classList.remove('kg-open');
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('#toc-toggle')) body.classList.remove('kg-open');
    });
    addEventListener('resize', () => { if (!narrow()) body.classList.remove('kg-open'); });
  }

  // TOC：宽屏默认展开，窄屏收起
  const toc = document.querySelector('aside.toc-nav');
  if (!toc) body.classList.add('toc-empty');
  else {
    const apply = () => {
      const s = store.get('toc-collapsed');
      body.classList.toggle('toc-collapsed', s === null ? innerWidth < 1300 : s === '1');
    };
    mk('button', 'toc-toggle', 'TOC', '显示/隐藏目录', () => {
      store.set('toc-collapsed', body.classList.contains('toc-collapsed') ? '0' : '1');
      apply();
    });
    apply();
    addEventListener('resize', apply);

    // 窄屏（手机）点击目录链接后自动收起，不改变保存的偏好
    toc.addEventListener('click', (e) => {
      if (e.target.closest('a') && innerWidth < 1300) body.classList.add('toc-collapsed');
    });

    // 滚动高亮当前标题
    const links = [...toc.querySelectorAll('a')];
    const heads = links.map((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        let cur = -1;
        heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top < 90) cur = i; });
        links.forEach((a, i) => a.classList.toggle('active', i === cur));
      });
    }, { passive: true });
  }

  // 回到顶部：滚动超过 500px 出现
  const up = mk('button', 'scroll-btn', '↑', '回到顶部', () => scrollTo({ top: 0, behavior: 'smooth' }));
  addEventListener('scroll', () => { up.style.display = scrollY >= 500 ? 'block' : 'none'; }, { passive: true });
})();

// ---- 最近页：tab 切换（#upd 直达最近更新）----
(() => {
  const tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;
  const show = (k) => {
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.tab === k));
    document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.id !== 'pane-' + k; });
    history.replaceState(null, '', '#' + k);
  };
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  if (location.hash === '#upd') show('upd');
})();

// ---- PWA：注册 service worker（"添加到主屏幕 / 安装应用"需要）----
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register((document.body.dataset.base || '/') + 'sw.js').catch(() => {}));
}
