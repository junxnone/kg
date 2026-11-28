// 鱼骨图的骨线（SVG）：读预渲染 DOM 的位置来画（移植自 jstools/mdfishbone 的 drawLines）。
// 主脊按层次分段，每段自上而下先画绿色（已创建占比），剩下画黄色；斜骨与主干夹角固定为 SLANT_ANGLE。
(() => {
  const board = document.querySelector('.fb-board');
  if (!board) return;
  const TREE = board.dataset.tree === '1';
  const head = board.querySelector('.fb-head');
  const slots = [...board.querySelectorAll('.fb-slot')].map((slot) => {
    const block = slot.querySelector('.fb-block');
    return { block, d: +block.dataset.d, t: +block.dataset.t };
  });
  const NS = 'http://www.w3.org/2000/svg';
  const SLANT_ANGLE = 45; // 斜骨与主干（竖线）的夹角（度），越大骨越平
  const SLANT = 1;
  const GREEN = '#2f9e44', YELLOW = '#fcc419', BONE = '#3b5bdb';

  function draw() {
    board.querySelector('svg.fb-lines')?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'fb-lines');
    const br = board.getBoundingClientRect();
    svg.setAttribute('width', board.scrollWidth);
    svg.setAttribute('height', board.scrollHeight);
    const padL = parseFloat(getComputedStyle(board).paddingLeft);
    const spineX = Math.max(22, Math.round(padL * 0.46));
    const hr = head.getBoundingClientRect();
    const mk = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    const headBottom = hr.bottom - br.top;
    const lastBottom = slots.length ? slots[slots.length - 1].block.getBoundingClientRect().bottom - br.top : headBottom + 20;
    const tan = Math.tan(SLANT_ANGLE * Math.PI / 180);

    // 第一根斜骨不能顶到鱼头：落差不够时加大顶部留白后重画，让每根骨的角度一致
    if (slots.length) {
      const r0 = slots[0].block.getBoundingClientRect();
      const want = (r0.left - br.left - spineX) / tan * SLANT;
      const deficit = headBottom + 8 - (r0.top - br.top + 16 - want);
      if (deficit > 1) {
        board.style.paddingTop = (parseFloat(getComputedStyle(board).paddingTop) + Math.ceil(deficit)) + 'px';
        requestAnimationFrame(draw);
        return;
      }
    }

    // 每个层次的斜骨在主脊上的接点；接点不能高于鱼头，也不能压到上一个层次的接点
    const attach = [];
    slots.forEach((s, i) => {
      const r = s.block.getBoundingClientRect();
      const x0 = r.left - br.left, y0 = r.top - br.top + 16;
      const floor = i === 0 ? headBottom + 8 : attach[i - 1].ya + 24;
      attach.push({ x0, y0, ya: Math.min(y0 - 8, Math.max(floor, y0 - (x0 - spineX) / tan * SLANT)) });
    });

    const pills = [];
    // 树模式没有完成比例：主脊画成一条统一的线
    if (TREE) mk('line', { x1: spineX, y1: headBottom, x2: spineX, y2: lastBottom, stroke: BONE, 'stroke-width': 6 });
    else slots.forEach((s, i) => {
      const start = i === 0 ? headBottom : attach[i].ya;
      const end = i + 1 < slots.length ? attach[i + 1].ya : lastBottom;
      const total = s.d + s.t, ratio = total ? s.d / total : 0, mid = start + (end - start) * ratio;
      if (mid > start) mk('line', { x1: spineX, y1: start, x2: spineX, y2: mid, stroke: GREEN, 'stroke-width': 7 });
      if (end > mid) mk('line', { x1: spineX, y1: mid, x2: spineX, y2: end, stroke: YELLOW, 'stroke-width': 7 });
      if (total) pills.push({ y: Math.min(Math.max(mid, start + 10), end - 10), label: Math.round(ratio * 100) + '%' }); // 绿黄交接处标出完成比例
    });

    const last = slots[slots.length - 1];
    const lastDone = last && last.t === 0 && last.d > 0;
    mk('polygon', {
      points: `${spineX - 13},${lastBottom - 2} ${spineX + 13},${lastBottom - 2} ${spineX},${lastBottom + 20}`,
      fill: TREE ? BONE : lastDone ? GREEN : YELLOW,
    });
    attach.forEach((a) => mk('line', { x1: spineX, y1: a.ya, x2: a.x0, y2: a.y0, stroke: BONE, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    pills.forEach((p) => {
      mk('rect', { class: 'fb-pill', x: spineX - 20, y: p.y - 9, width: 40, height: 18, rx: 9 });
      mk('text', { class: 'fb-pilltxt', x: spineX, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, 'font-weight': 'bold' }).textContent = p.label;
    });
    board.appendChild(svg);
  }

  const redraw = () => { board.style.paddingTop = ''; requestAnimationFrame(draw); };
  redraw();
  document.fonts?.ready.then(redraw); // 字体加载后行高可能变化
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(redraw, 120); });
})();
