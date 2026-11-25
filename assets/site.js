(() => {
  const base = document.body.dataset.base || '/';
  const $ = (s, r = document) => r.querySelector(s);

  // 主题切换
  $('#theme')?.addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('kg-theme', t);
  });

  // 侧边树：共用 tree.json（缓存后同步渲染，无"加载中"闪烁）
  // - 展开状态 / 滚动位置记在 sessionStorage，翻页后保持
  // - 默认只展开当前文章所在的库和路径，其他库收起
  // - 顶部过滤框：只显示匹配项并展开；◎ 按钮定位当前文章
  const side = $('#tree');
  if (side) {
    const aside = $('#side');
    const ss = {
      get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
      set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    };
    const cur = decodeURIComponent(location.pathname).replace(/^\//, '');
    const rel = (h) => decodeURIComponent(base.replace(/^\//, '') + h);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const SEP = '\u0001';

    let open = new Set(JSON.parse(ss.get('kg-open') || '[]'));
    const curKeys = new Set();
    const find = (n, path) => {
      const p = path.concat(n.n);
      let any = !!(n.h && rel(n.h) === cur);
      for (const c of n.c || []) if (find(c, p)) any = true;
      if (any) curKeys.add(p.join(SEP));
      return any;
    };

    const node = (n, path) => {
      const p = path.concat(n.n);
      const isCur = n.h && rel(n.h) === cur;
      const label = n.h ? `<a href="${base + n.h}"${isCur ? ' class="cur"' : ''}>${esc(n.n)}</a>` : `<span class="dir">${esc(n.n)}</span>`;
      const t = esc(n.n.toLowerCase());
      if (!n.c) return `<li data-t="${t}">${label}</li>`;
      return `<li data-t="${t}"><details data-k="${esc(p.join(SEP))}"><summary>${label}${n.k ? ` <small>${n.k}</small>` : ''}</summary><ul>${n.c.map((c) => node(c, p)).join('')}</ul></details></li>`;
    };

    const applyOpen = () => side.querySelectorAll('details').forEach((d) => { d.open = open.has(d.dataset.k) || curKeys.has(d.dataset.k); });
    const saveOpen = () => ss.set('kg-open', JSON.stringify([...open]));

    const render = (t) => {
      curKeys.clear();
      t.forEach((r) => find(r, []));
      side.innerHTML = `<ul class="tree">${t.map((r) => node(r, [])).join('')}</ul><div class="tree-empty" hidden>没有匹配的文章</div>`;
      applyOpen();
      filter();
      const lb = $('#tree-locate');
      if (lb) lb.hidden = !$('a.cur', side);
    };

    // 展开状态：用户点击摘要后记录（程序性展开不会写入）
    side.addEventListener('click', (e) => {
      const s = e.target.closest('summary');
      if (!s || e.target.closest('a')) return;
      setTimeout(() => {
        const d = s.parentElement;
        if (filterBox.value.trim()) return; // 过滤期间的展开不记录
        d.open ? open.add(d.dataset.k) : open.delete(d.dataset.k);
        saveOpen();
      }, 0);
    });

    // 过滤
    const filterBox = $('#tree-filter');
    let q = '';
    const show = (li, forced) => {
      const own = li.dataset.t.includes(q);
      const d = li.querySelector(':scope > details');
      let child = false;
      if (d) for (const c of d.querySelectorAll(':scope > ul > li')) if (show(c, forced || own)) child = true;
      const vis = forced || own || child;
      li.hidden = !vis;
      if (d && q) d.open = child; // 子孙命中则展开；仅自身命中保持收起
      return vis;
    };
    function filter() {
      q = (filterBox?.value || '').trim().toLowerCase();
      const top = side.querySelectorAll(':scope > ul > li');
      if (!q) {
        side.querySelectorAll('li[hidden]').forEach((li) => (li.hidden = false));
        applyOpen();
        $('.tree-empty', side).hidden = true;
        return;
      }
      let any = false;
      top.forEach((li) => { if (show(li, false)) any = true; });
      $('.tree-empty', side).hidden = any;
    }
    let ft;
    filterBox?.addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(filter, 120); });
    filterBox?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { filterBox.value = ''; filter(); }
    });

    // 定位当前文章
    const locate = () => {
      if (filterBox) { filterBox.value = ''; filter(); }
      const a = $('a.cur', side);
      if (!a) return;
      a.scrollIntoView({ block: 'center' });
      a.classList.add('flash');
      setTimeout(() => a.classList.remove('flash'), 1200);
    };
    const locBtn = $('#tree-locate');
    if (locBtn) {
      locBtn.addEventListener('click', locate);
    }

    // 滚动位置：保存 / 恢复（当前文章不在可视区时再居中）
    let st;
    aside.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => ss.set('kg-scroll', aside.scrollTop), 100); }, { passive: true });
    const restoreScroll = () => {
      const y = +ss.get('kg-scroll');
      if (y) aside.scrollTop = y;
      const a = $('a.cur', side);
      if (a) {
        const r = a.getBoundingClientRect(), b = aside.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom) a.scrollIntoView({ block: 'center' });
      }
    };

    // 缓存：命中则同步渲染，再后台校验更新
    const cached = ss.get('kg-tree');
    const key = base + 'tree.json';
    if (cached) { try { render(JSON.parse(cached)); restoreScroll(); } catch {} }
    fetch(key)
      .then((r) => r.text())
      .then((txt) => {
        if (txt === cached) return;
        ss.set('kg-tree', txt);
        render(JSON.parse(txt));
        restoreScroll();
      })
      .catch(() => { if (!cached) side.textContent = '目录加载失败'; });
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
    document.addEventListener('click', (e) => {
      if (body.classList.contains('kg-open') && !e.target.closest('#side, #kg-toggle')) body.classList.remove('kg-open');
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') body.classList.remove('kg-open'); });
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

// ---- 随机打开一篇文章 ----
(() => {
  const btn = document.getElementById('rand');
  if (!btn) return;
  const base = document.body.dataset.base || '/';
  let list = null;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      list = list || (await (await fetch(base + 'random.json')).json());
      const cur = decodeURIComponent(location.pathname);
      let h;
      do h = list[Math.floor(Math.random() * list.length)];
      while (list.length > 1 && decodeURIComponent(base + h) === cur);
      location.href = base + h;
    } catch {
      btn.disabled = false;
    }
  });
})();
