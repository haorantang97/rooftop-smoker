// 高清渲染的基础工具：坐标系、颜色、天色、烟雾贴图、噪点
// 逻辑画布 1600×1000，按屏幕缩放；所有场景都用这个坐标系
export const VW = 1600, VH = 1000;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const rand = (a, b) => a + Math.random() * (b - a);
export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); const f = (i) => Math.round(lerp(A[i], B[i], clamp(t, 0, 1))).toString(16).padStart(2, '0'); return `#${f(0)}${f(1)}${f(2)}`; }
export function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
export function shade(h, k) { const [r, g, b] = hexRgb(h); const f = (v) => clamp(Math.round(v * k), 0, 255).toString(16).padStart(2, '0'); return `#${f(r)}${f(g)}${f(b)}`; }

export function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
export function lin(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
export function glow(c, x, y, r, col, mid = 0) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); if (mid) g.addColorStop(mid, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function ellipse(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fill(); }
export function capsule(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
export function blurSupported() { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; } }
export const CAN_BLUR = blurSupported();

// ---------- 时间和天色 ----------
// [小时, 天顶, 中段, 地平线, 星星, 夜色]
const SKY = [
  [0, '#04060f', '#0b1027', '#1d1b38', 1, 1], [4.6, '#070b20', '#141a3c', '#2c2946', 0.8, 1],
  [5.6, '#1d2552', '#5a4a78', '#e08a6a', 0.3, 0.8], [6.6, '#3f6fb8', '#86a8d6', '#f6c896', 0, 0.35],
  [8.5, '#3b80d6', '#7fb4ea', '#cfe6f6', 0, 0], [16, '#337ad2', '#78aee6', '#d6e8f2', 0, 0],
  [17.7, '#3a5ea8', '#8a8fbe', '#f6b468', 0, 0.12], [18.7, '#232657', '#6a4a78', '#e8735a', 0.12, 0.5],
  [19.7, '#0d1230', '#2a2450', '#55304e', 0.5, 0.9], [21, '#05081a', '#0e122c', '#221d3a', 0.9, 1],
  [24, '#04060f', '#0b1027', '#1d1b38', 1, 1],
];
export function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  return { h, top: mix(a[1], b[1], t), mid: mix(a[2], b[2], t), low: mix(a[3], b[3], t), stars: lerp(a[4], b[4], t), night: lerp(a[5], b[5], t) };
}
export function localHour(tzMin) {
  const d = new Date();
  if (tzMin === undefined || tzMin === null) return d.getHours() + d.getMinutes() / 60;
  const u = d.getUTCHours() + d.getUTCMinutes() / 60 + tzMin / 60;
  return ((u % 24) + 24) % 24;
}
export function fmtHour(h) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

export function drawSky(c, sky, x0, x1, y0, y1, horizon = y1) {
  c.fillStyle = lin(c, 0, y0, 0, horizon, [[0, sky.top], [0.55, sky.mid], [1, sky.low]]);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}
export function drawStars(c, sky, rnd, x0, x1, y0, y1, n = 220) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rnd()), y = lerp(y0, y1, rnd() ** 1.3), r = 0.5 + rnd() ** 3 * 1.6, a = (0.25 + rnd() * 0.75) * sky.stars;
    if (a < 0.02) continue;
    ellipse(c, x, y, r, r, `rgba(255,250,235,${a})`);
    if (r > 1.6) glow(c, x, y, r * 5, `rgba(200,215,255,${a * 0.25})`);
  }
}
export function drawSunMoon(c, sky, x0, x1, horizon, top) {
  const h = sky.h;
  if (h > 5.6 && h < 18.9) {
    const k = (h - 5.6) / 13.3, x = lerp(x0, x1, k), y = horizon - Math.sin(Math.PI * k) * (horizon - top);
    const warm = 1 - Math.sin(Math.PI * k);
    glow(c, x, y, 320, `rgba(255,${Math.round(lerp(236, 160, warm))},${Math.round(lerp(200, 100, warm))},.28)`);
    glow(c, x, y, 70, `rgba(255,250,230,.6)`);
    ellipse(c, x, y, 28, 28, mix('#fffbea', '#ffb36b', warm));
  }
  const mh = (h + 24 - 18.4) % 24;
  if (mh < 12.2) {
    const k = mh / 12.2, x = lerp(x1, x0, k), y = horizon - Math.sin(Math.PI * k) * (horizon - top - 20);
    glow(c, x, y, 220, `rgba(190,205,255,${0.14 * sky.night})`);
    ellipse(c, x, y, 24, 24, mix('#cfd6e2', '#f3ead0', sky.night));
    c.globalAlpha = 0.35;
    for (const [dx, dy, r] of [[-8, -6, 6], [7, 5, 7], [-3, 10, 3], [10, -9, 3]]) ellipse(c, x + dx, y + dy, r, r, '#c9bc98');
    c.globalAlpha = 1;
  }
}
export function drawClouds(c, sky, rnd, x0, x1, y0, y1, n = 7) {
  const day = 1 - sky.night;
  for (let i = 0; i < n; i++) {
    const cx = lerp(x0, x1, rnd()), cy = lerp(y0, y1, rnd()), w = 140 + rnd() * 260;
    const lit = day > 0.3 ? `rgba(255,255,255,${0.55 * day})` : `rgba(120,110,150,${0.25 * sky.night})`;
    const dark = day > 0.3 ? `rgba(200,210,230,${0.45 * day})` : `rgba(40,40,70,${0.3 * sky.night})`;
    for (let k = 0; k < 7; k++) {
      const x = cx + (k / 6 - 0.5) * w, y = cy + Math.sin(k * 1.7 + i) * 8, r = (0.18 + rnd() * 0.16) * w;
      ellipse(c, x, y + r * 0.25, r * 1.1, r * 0.45, dark);
      ellipse(c, x, y, r, r * 0.5, lit);
    }
  }
}

// ---------- 烟雾贴图：几张软软的烟团，按需缩放 ----------
export const SMOKE = (() => {
  const out = [];
  const rnd = mulberry32(5);
  for (let v = 0; v < 4; v++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 30, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 14 + rnd() * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.1 + rnd() * 0.14})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    }
    out.push(cv);
  }
  return out;
})();
// 按颜色染好的烟团，缓存起来
const tintCache = new Map();
export function smokeSprite(v, rgb) {
  const key = v + ':' + rgb.join(',');
  let cv = tintCache.get(key);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.drawImage(SMOKE[v], 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; c.fillRect(0, 0, 128, 128);
    tintCache.set(key, cv);
  }
  return cv;
}

// 胶片颗粒
export const GRAIN = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d'), img = c.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 22; }
  c.putImageData(img, 0, 0);
  return cv;
})();

// 透视地砖：横线越往下越疏，竖线汇聚到灭点
export function perspectiveTiles(c, x0, x1, y0, y1, vpx, vpy, rows, cols, col) {
  c.strokeStyle = col; c.lineWidth = 1.2;
  for (let i = 1; i <= rows; i++) { const t = (i / rows) ** 1.8, y = lerp(y0, y1, t); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
  const span = (x1 - x0) * 2.4;
  for (let i = -cols; i <= cols; i++) {
    const xb = vpx + (i / cols) * span;
    const t0 = (y0 - vpy) / (y1 - vpy);
    c.beginPath(); c.moveTo(lerp(vpx, xb, t0), y0); c.lineTo(xb, y1); c.stroke();
  }
}
