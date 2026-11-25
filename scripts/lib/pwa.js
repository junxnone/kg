// PWA：manifest + service worker + PNG 图标（不依赖任何图像库，用 zlib 直接编码 PNG）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

// 蓝底 + 白色小图谱（中心节点连三个外围节点）；图形限制在中间 60%，可直接用作 maskable 图标
function iconPng(size) {
  const BG = [37, 99, 235];
  const R = 0.24; // 外围节点到中心的距离
  const outer = [0, 1, 2].map((i) => {
    const a = (-90 + i * 120) * (Math.PI / 180);
    return [0.5 + R * Math.cos(a), 0.5 + R * Math.sin(a)];
  });
  const segDist = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const cover = (d, r) => Math.max(0, Math.min(1, 0.5 - (d - r) * size)); // 约 1px 抗锯齿
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size, py = (y + 0.5) / size;
      let c = Math.max(cover(Math.hypot(px - 0.5, py - 0.5), 0.085));
      for (const o of outer) {
        c = Math.max(c, cover(Math.hypot(px - o[0], py - o[1]), 0.06), cover(segDist(px, py, [0.5, 0.5], o), 0.014));
      }
      for (let k = 0; k < 3; k++) row[1 + x * 3 + k] = Math.round(BG[k] + (255 - BG[k]) * c);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function writePwa(cfg, out) {
  const b = cfg.basePath;
  const put = (rel, data) => {
    const f = path.join(out, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, data);
  };
  for (const s of [180, 192, 512]) put(`icons/icon-${s}.png`, iconPng(s));

  put('manifest.webmanifest', JSON.stringify({
    name: cfg.title,
    short_name: 'KG',
    description: '个人知识站点：aiwiki / xwiki / linux / opt / math',
    start_url: b,
    scope: b,
    id: b,
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    lang: 'zh-CN',
    icons: [
      { src: `${b}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `${b}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, null, 2));

  // 网络优先，离线时回退到缓存；只缓存同源 GET
  put('sw.js', `const CACHE = 'kg-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('${b}')))
  );
});
`);
}
