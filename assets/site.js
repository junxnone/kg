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

// ---- 本地笔记：全站一份，存 localStorage（键 kg-notes）；每条笔记记录来源文章并链接回去 ----
// 文章页：右下 ✎ 快速记一条；笔记汇总页 notes.html：查看 / 搜索 / 编辑 / 删除 / 勾选清单 / 导出导入
(() => {
  const KEY = 'kg-notes';
  // 每条笔记是一个待办项 {id,url,title,text,done,ts,upd}；旧版 "- [ ] 文字" 格式在读取时迁移
  const LEGACY = /^\s*[-*]\s+\[([ xX])\]\s?/;
  const load = () => {
    let l;
    try { l = JSON.parse(localStorage.getItem(KEY)); } catch { l = null; }
    return (Array.isArray(l) ? l : []).map((n) => {
      if (typeof n.done === 'boolean') return n;
      const m = n.text.match(LEGACY);
      return { ...n, done: !!m && m[1] !== ' ', text: n.text.replace(LEGACY, '') };
    });
  };
  const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { alert('保存失败：浏览器存储不可用或已满'); } };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const base = document.body.dataset.base || '/';
  const when = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false }).slice(0, 16);
  const body = (n) => `<label class="todo${n.done ? ' done' : ''}"><input type="checkbox" data-id="${n.id}"${n.done ? ' checked' : ''}><span>${esc(n.text)}</span></label>`;
  // 勾选 / 取消勾选；返回是否有改动
  const toggle = (e) => {
    const id = e.target.dataset.id;
    if (!id) return false;
    const all = load(), n = all.find((x) => x.id === id);
    if (!n) return false;
    n.done = e.target.checked;
    save(all);
    return true;
  };

  // ---- 文章页：快速记笔记 ----
  if (document.body.classList.contains('article')) {
    const url = decodeURIComponent(location.pathname);
    const title = document.title.split(' · ')[0];
    const btn = Object.assign(document.createElement('button'), { id: 'note-btn', type: 'button', textContent: '✎', title: '给这篇文章记笔记' });
    const panel = document.createElement('div');
    panel.id = 'note-panel';
    panel.hidden = true;
    panel.innerHTML = `<div class="note-bar"><b>记笔记</b><span class="note-tip"></span><a href="${base}notes.html">全部笔记 →</a><button type="button" data-a="x" title="关闭">×</button></div>
<div class="note-mine"></div>
<textarea placeholder="记一条待办…（Ctrl+Enter 保存）" spellcheck="false"></textarea>
<div class="note-foot"><button type="button" data-a="save">保存</button></div>`;
    document.body.append(btn, panel);
    const ta = panel.querySelector('textarea'), tip = panel.querySelector('.note-tip');
    const mine = panel.querySelector('.note-mine');
    const refresh = () => {
      const l = load().filter((n) => n.url === url).sort((a, b) => b.upd - a.upd);
      btn.classList.toggle('has', l.length > 0);
      tip.textContent = l.length ? `本文 ${l.length} 条` : '';
      mine.hidden = !l.length;
      mine.innerHTML = l.map((n) => `<div class="note-item"><time>${when(n.upd)}</time>${body(n)}</div>`).join('');
    };
    mine.addEventListener('change', (e) => { if (toggle(e)) refresh(); });
    const add = () => {
      const text = ta.value.trim();
      if (!text) return;
      const now = Date.now();
      save(load().concat({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), url, title, text, done: false, ts: now, upd: now }));
      ta.value = '';
      refresh();
      tip.textContent = '已保存 ✓';
    };
    btn.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) ta.focus(); });
    panel.addEventListener('click', (e) => {
      const a = e.target.dataset.a;
      if (a === 'x') panel.hidden = true;
      else if (a === 'save') add();
    });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) panel.hidden = true; });
    refresh();

    // 选中正文文字后，在选区上方浮出 "记笔记"：点击后打开面板并把选中文字带入输入框
    // （网页无法往浏览器自带的右键菜单里加项，所以用选区浮层代替；手机上同样可用）
    const md = document.querySelector('.md');
    const pop = Object.assign(document.createElement('button'), { id: 'note-pop', type: 'button', textContent: '✎ 记笔记' });
    pop.hidden = true;
    document.body.append(pop);
    let sel = '';
    const place = () => {
      const s = getSelection();
      const t = s && !s.isCollapsed && md && md.contains(s.anchorNode) && md.contains(s.focusNode) ? s.toString().trim() : '';
      if (!t) { pop.hidden = true; return; }
      sel = t;
      const r = s.getRangeAt(0).getBoundingClientRect();
      pop.hidden = false;
      pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2)) + 'px';
      pop.style.top = (r.top > 56 ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + 'px';
    };
    let pt;
    document.addEventListener('selectionchange', () => { clearTimeout(pt); pt = setTimeout(place, 150); });
    addEventListener('scroll', () => { pop.hidden = true; }, { passive: true });
    pop.addEventListener('mousedown', (e) => e.preventDefault()); // 不让点击清掉选区
    pop.addEventListener('click', () => {
      panel.hidden = false;
      ta.value = (ta.value ? ta.value + '\n' : '') + (sel.length > 500 ? sel.slice(0, 500) + '…' : sel) + '\n';
      pop.hidden = true;
      getSelection().removeAllRanges();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }

  // ---- 笔记汇总页 ----
  const root = document.getElementById('notes-root');
  if (!root) return;
  root.innerHTML = `<form class="notes-new"><input id="notes-new" placeholder="新建待办（不关联文章），回车添加…" autocomplete="off"><button type="submit">添加</button></form>
<div class="notes-tools"><input id="notes-q" type="search" placeholder="搜索笔记 / 文章标题…" autocomplete="off">
<button type="button" data-a="exp">导出</button><button type="button" data-a="imp">导入</button><input type="file" accept=".json,application/json" hidden></div>
<div id="notes-list"></div>`;
  const list = root.querySelector('#notes-list'), q = root.querySelector('#notes-q'), file = root.querySelector('input[type=file]');
  let editId = null;

  const draw = () => {
    const kw = q.value.trim().toLowerCase();
    const all = load().sort((a, b) => b.upd - a.upd);
    const shown = all.filter((n) => !kw || (n.text + ' ' + n.title).toLowerCase().includes(kw));
    list.innerHTML = shown.map((n) => `<section class="note" data-id="${n.id}">
<div class="note-head">${n.url ? `<a href="${esc(n.url)}">${esc(n.title)}</a>` : '<span class="plain">独立待办</span>'}<time>${when(n.upd)}</time>
<span><button type="button" data-a="edit">编辑</button><button type="button" data-a="del">删除</button></span></div>
${editId === n.id ? `<textarea>${esc(n.text)}</textarea><div class="note-foot"><button type="button" data-a="ok">保存</button><button type="button" data-a="cancel">取消</button></div>` : `<div class="note-body">${body(n)}</div>`}</section>`).join('')
      || `<p class="sub">${all.length ? '没有匹配的笔记。' : '还没有笔记。在上面新建一条待办，或打开任意文章，点右下角 ✎ 记一条。'}</p>`;
  };

  root.querySelector('.notes-new').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = root.querySelector('#notes-new'), text = inp.value.trim();
    if (!text) return;
    const now = Date.now();
    save(load().concat({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), url: '', title: '', text, done: false, ts: now, upd: now }));
    inp.value = '';
    q.value = '';
    draw();
  });
  list.addEventListener('change', (e) => { if (toggle(e)) draw(); });
  list.addEventListener('click', (e) => {
    const a = e.target.dataset.a;
    const sec = e.target.closest('.note');
    if (!a || !sec) return;
    const id = sec.dataset.id;
    if (a === 'edit') { editId = id; draw(); list.querySelector('.note textarea')?.focus(); }
    else if (a === 'cancel') { editId = null; draw(); }
    else if (a === 'ok') {
      const text = sec.querySelector('textarea').value.trim();
      const all = load(), n = all.find((x) => x.id === id);
      if (n && text) { n.text = text; n.upd = Date.now(); save(all); }
      editId = null;
      draw();
    } else if (a === 'del' && confirm('删除这条笔记？')) { save(load().filter((x) => x.id !== id)); draw(); }
  });
  q.addEventListener('input', draw);
  root.querySelector('.notes-tools').addEventListener('click', (e) => {
    const a = e.target.dataset.a;
    if (a === 'imp') file.click();
    else if (a === 'exp') {
      const all = load();
      if (!all.length) return alert('还没有任何笔记');
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })),
        download: `kg-notes-${new Date().toISOString().slice(0, 10)}.json`,
      });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
  });
  file.addEventListener('change', async () => {
    try {
      const inc = JSON.parse(await file.files[0].text());
      if (!Array.isArray(inc)) throw 0;
      const all = load(), byId = new Map(all.map((n) => [n.id, n]));
      let n = 0;
      for (const x of inc) {
        if (!x || typeof x.id !== 'string' || typeof x.text !== 'string' || typeof x.url !== 'string') continue;
        const old = byId.get(x.id);
        if (!old) { all.push(x); n++; } else if ((x.upd || 0) > old.upd) { Object.assign(old, x); n++; }
      }
      save(all);
      alert(`已导入 / 更新 ${n} 条笔记`);
      draw();
    } catch { alert('导入失败：不是有效的笔记 JSON'); }
    file.value = '';
  });
  draw();
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
