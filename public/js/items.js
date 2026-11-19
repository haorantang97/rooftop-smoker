// 货架上东西的矢量画法：drawItemV(c, id, 中心 x, 底部 y, 高度)
import { lin, rr, ellipse, shade, mix } from './gfx.js';

const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
// [形状, 主色, 副色, 字]
export const ITEM_LOOK = {
  beer: ['can', '#d9a441', '#f4f0e0', 'LAGER'], soju: ['bottle', '#3f9a5a', '#e8f6ea', '烧酒'], sake: ['cup', '#eef0f2', '#c94f4f', '清酒'],
  highball: ['can', '#e8df5a', '#2a6fb0', 'HIGH'], whisky: ['flask', '#b06a2a', '#efe2c0', 'W'], cola: ['can', '#c62a2a', '#ffffff', 'COLA'],
  coffee: ['can', '#5a3a24', '#e8c38a', 'COFFEE'], milk: ['carton', '#f6f6f2', '#5aa0e8', '牛乳'], chips: ['bag', '#f2c14e', '#c62a2a', '薯片'],
  onigiri: ['onigiri', '#f8f8f4', '#1e2a22', '鲑'], noodle: ['cupnoodle', '#f6f2e8', '#d23a2a', '面'], oden: ['skewer', '#efd8a8', '#a8743a', ''],
  choco: ['bar', '#5a3020', '#d9b44a', 'CHOCO'], icebar: ['icebar', '#9fd3e8', '#d8b48a', ''], gum: ['gum', '#7bc96f', '#ffffff', 'GUM'], sausage: ['sausage', '#c0603a', '#d8b48a', ''],
};

export function drawItemV(c, id, cx, by, h, opts = {}) {
  const look = ITEM_LOOK[id]; if (!look) return;
  const [shape, a, b, word] = look;
  const cold = opts.cold !== false;
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const cyl = (x, y, w, hh, col) => { c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(col, 0.62)], [0.28, shade(col, 1.12)], [0.42, shade(col, 1.25)], [0.7, col], [1, shade(col, 0.55)]]); c.fillRect(x, y, w, hh); };
  if (shape === 'can') {
    const w = h * 0.5, x = cx - w / 2, y = by - h;
    cyl(x, y + h * 0.06, w, h * 0.9, a);
    c.fillStyle = b; c.globalAlpha = 0.9; c.fillRect(x, y + h * 0.38, w, h * 0.22); c.globalAlpha = 1;
    c.fillStyle = shade(a, 0.7); c.font = `800 ${h * 0.11}px ${FONT}`; c.fillText(word, cx, y + h * 0.49, w * 0.9);
    cyl(x + w * 0.04, y, w * 0.92, h * 0.07, '#c8ccd2'); ellipse(c, cx, y, w * 0.46, h * 0.035, '#e4e6ea'); ellipse(c, cx + w * 0.08, y, w * 0.12, h * 0.018, '#9aa0a8');
    cyl(x + w * 0.04, by - h * 0.05, w * 0.92, h * 0.05, '#b8bcc4');
    if (cold) drops(c, x, y + h * 0.1, w, h * 0.8, h);
  } else if (shape === 'bottle') {
    const w = h * 0.36, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.5)], [0.3, shade(a, 1.3)], [1, shade(a, 0.45)]]);
    c.globalAlpha = 0.92;
    rr(c, x, y + h * 0.36, w, h * 0.64, w * 0.18); c.fill();
    c.beginPath(); c.moveTo(x + w * 0.05, y + h * 0.4); c.quadraticCurveTo(x + w * 0.1, y + h * 0.24, cx - w * 0.17, y + h * 0.16); c.lineTo(cx + w * 0.17, y + h * 0.16); c.quadraticCurveTo(x + w * 0.9, y + h * 0.24, x + w * 0.95, y + h * 0.4); c.fill();
    c.fillRect(cx - w * 0.17, y + h * 0.06, w * 0.34, h * 0.12);
    c.globalAlpha = 1;
    c.fillStyle = '#2a6a3a'; rr(c, cx - w * 0.19, y, w * 0.38, h * 0.08, 2); c.fill();
    c.fillStyle = b; c.fillRect(x, y + h * 0.55, w, h * 0.25); c.fillStyle = '#2a5a3a'; c.font = `800 ${h * 0.08}px ${FONT}`; c.fillText(word, cx, y + h * 0.675);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + w * 0.18, y + h * 0.4, w * 0.08, h * 0.5);
  } else if (shape === 'cup') {
    const w = h * 0.62, x = cx - w / 2, y = by - h;
    c.fillStyle = 'rgba(230,240,248,.6)'; c.beginPath(); c.moveTo(x, y + h * 0.08); c.lineTo(x + w, y + h * 0.08); c.lineTo(x + w * 0.92, by); c.lineTo(x + w * 0.08, by); c.fill();
    c.fillStyle = 'rgba(250,246,230,.85)'; c.beginPath(); c.moveTo(x + w * 0.02, y + h * 0.2); c.lineTo(x + w * 0.98, y + h * 0.2); c.lineTo(x + w * 0.92, by - 2); c.lineTo(x + w * 0.08, by - 2); c.fill();
    c.fillStyle = b; c.fillRect(x + w * 0.06, y + h * 0.42, w * 0.88, h * 0.3); c.fillStyle = '#fff'; c.font = `800 ${h * 0.14}px ${FONT}`; c.fillText(word, cx, y + h * 0.57);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, '#b8bcc4'], [0.4, '#f4f6f8'], [1, '#9aa0a8']]); c.fillRect(x - 2, y, w + 4, h * 0.09);
  } else if (shape === 'flask') {
    const w = h * 0.5, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.5)], [0.35, shade(a, 1.35)], [1, shade(a, 0.5)]]);
    rr(c, x, y + h * 0.26, w, h * 0.74, w * 0.2); c.fill();
    c.fillRect(cx - w * 0.16, y + h * 0.1, w * 0.32, h * 0.18);
    c.fillStyle = '#1a1a1e'; rr(c, cx - w * 0.2, y, w * 0.4, h * 0.12, 2); c.fill();
    c.fillStyle = b; rr(c, x + w * 0.12, y + h * 0.45, w * 0.76, h * 0.34, 4); c.fill();
    c.fillStyle = shade(a, 0.6); c.font = `italic 800 ${h * 0.16}px Georgia, serif`; c.fillText(word, cx, y + h * 0.62);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + w * 0.14, y + h * 0.3, w * 0.07, h * 0.6);
  } else if (shape === 'carton') {
    const w = h * 0.46, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.85)], [0.5, a], [1, shade(a, 0.7)]]);
    c.fillRect(x, y + h * 0.22, w, h * 0.78);
    c.beginPath(); c.moveTo(x, y + h * 0.22); c.lineTo(cx, y + h * 0.06); c.lineTo(x + w, y + h * 0.22); c.fill();
    c.fillStyle = shade(a, 0.8); c.fillRect(cx - w * 0.3, y, w * 0.6, h * 0.08);
    c.fillStyle = b; c.fillRect(x, y + h * 0.5, w, h * 0.3); c.fillStyle = '#fff'; c.font = `800 ${h * 0.11}px ${FONT}`; c.fillText(word, cx, y + h * 0.65);
    if (cold) drops(c, x, y + h * 0.25, w, h * 0.7, h);
  } else if (shape === 'bag') {
    const w = h * 0.78, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, y, x + w, by, [[0, shade(a, 1.15)], [0.5, a], [1, shade(a, 0.75)]]);
    c.beginPath(); c.moveTo(x + w * 0.05, y + h * 0.06); c.lineTo(x + w * 0.95, y + h * 0.06); c.quadraticCurveTo(x + w * 1.04, cx, x + w * 0.95, by - h * 0.06); c.lineTo(x + w * 0.05, by - h * 0.06); c.quadraticCurveTo(x - w * 0.04, cx, x + w * 0.05, y + h * 0.06); c.fill();
    c.fillStyle = shade(a, 0.8); for (let k = x + w * 0.05; k < x + w * 0.95; k += w * 0.06) { c.fillRect(k, y, w * 0.03, h * 0.07); c.fillRect(k, by - h * 0.07, w * 0.03, h * 0.07); }
    ellipse(c, cx, y + h * 0.45, w * 0.3, h * 0.18, b); c.fillStyle = '#fff'; c.font = `900 ${h * 0.14}px ${FONT}`; c.fillText(word, cx, y + h * 0.45);
    for (let k = 0; k < 3; k++) ellipse(c, cx - w * 0.2 + k * w * 0.2, y + h * 0.75, w * 0.08, h * 0.05, '#f6d68a');
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + w * 0.12, y + h * 0.12, w * 0.06, h * 0.7);
  } else if (shape === 'onigiri') {
    const w = h * 1.05, y = by - h;
    c.fillStyle = a; c.beginPath(); c.moveTo(cx, y); c.quadraticCurveTo(cx + w * 0.12, y, cx + w * 0.5, by - h * 0.12); c.quadraticCurveTo(cx + w * 0.52, by, cx + w * 0.38, by); c.lineTo(cx - w * 0.38, by); c.quadraticCurveTo(cx - w * 0.52, by, cx - w * 0.5, by - h * 0.12); c.quadraticCurveTo(cx - w * 0.12, y, cx, y); c.fill();
    c.fillStyle = b; c.fillRect(cx - w * 0.24, by - h * 0.46, w * 0.48, h * 0.46);
    c.fillStyle = '#e85a3a'; c.font = `800 ${h * 0.16}px ${FONT}`; c.fillText(word, cx, y + h * 0.36);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(cx - w * 0.1, y + h * 0.15); c.lineTo(cx - w * 0.3, by - h * 0.2); c.lineTo(cx - w * 0.25, by - h * 0.2); c.lineTo(cx - w * 0.06, y + h * 0.15); c.fill();
  } else if (shape === 'cupnoodle') {
    const w = h * 0.8, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.8)], [0.4, a], [1, shade(a, 0.7)]]);
    c.beginPath(); c.moveTo(x, y + h * 0.1); c.lineTo(x + w, y + h * 0.1); c.lineTo(x + w * 0.86, by); c.lineTo(x + w * 0.14, by); c.fill();
    c.fillStyle = b; c.fillRect(x + w * 0.04, y + h * 0.3, w * 0.92, h * 0.28); c.fillStyle = '#fff'; c.font = `900 ${h * 0.18}px ${FONT}`; c.fillText(word, cx, y + h * 0.44);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, '#c8ccd2'], [0.4, '#ffffff'], [1, '#b0b4ba']]); rr(c, x - 3, y, w + 6, h * 0.11, 3); c.fill();
    if (opts.steam) { c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 3; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(cx + k * w * 0.2, y - 4); c.bezierCurveTo(cx + k * w * 0.2 - 10, y - 20, cx + k * w * 0.2 + 10, y - 34, cx + k * w * 0.2, y - 50); c.stroke(); } }
  } else if (shape === 'skewer' || shape === 'sausage') {
    const w = h * 0.22;
    c.fillStyle = b; c.fillRect(cx - w * 0.08, by - h * 0.35, w * 0.16, h * 0.35);
    if (shape === 'sausage') {
      c.fillStyle = lin(c, cx - w / 2, 0, cx + w / 2, 0, [[0, shade(a, 0.7)], [0.35, shade(a, 1.2)], [1, shade(a, 0.6)]]);
      rr(c, cx - w / 2, by - h, w, h * 0.68, w / 2); c.fill();
      c.strokeStyle = shade(a, 0.5); c.lineWidth = w * 0.1; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(cx - w * 0.4, by - h * (0.88 - k * 0.14)); c.lineTo(cx + w * 0.4, by - h * (0.82 - k * 0.14)); c.stroke(); }
    } else {
      ellipse(c, cx, by - h * 0.86, w * 0.75, h * 0.11, '#f4f0e0');
      c.fillStyle = '#efe7cf'; rr(c, cx - w * 0.6, by - h * 0.72, w * 1.2, h * 0.16, 4); c.fill();
      ellipse(c, cx, by - h * 0.46, w * 0.62, h * 0.1, '#c99a5a');
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(cx - w * 0.4, by - h * 0.95, w * 0.2, h * 0.12);
    }
  } else if (shape === 'bar') {
    const w = h * 0.42, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.7)], [0.5, shade(a, 1.2)], [1, shade(a, 0.7)]]); c.fillRect(x, y + h * 0.1, w, h * 0.9);
    c.fillStyle = '#3a1e14'; for (let k = 0; k < 3; k++) rr(c, x + w * 0.1, y + k * h * 0.06, w * 0.8, h * 0.07, 2), c.fill();
    c.fillStyle = b; c.fillRect(x, y + h * 0.4, w, h * 0.16); c.fillStyle = shade(a, 0.6); c.font = `900 ${h * 0.08}px ${FONT}`; c.fillText(word, cx, y + h * 0.48, w);
  } else if (shape === 'icebar') {
    const w = h * 0.4, x = cx - w / 2, y = by - h;
    c.fillStyle = b; c.fillRect(cx - w * 0.12, by - h * 0.3, w * 0.24, h * 0.3);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.75)], [0.35, shade(a, 1.2)], [1, shade(a, 0.75)]]);
    c.beginPath(); c.moveTo(x, by - h * 0.28); c.lineTo(x, y + w / 2); c.arc(cx, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, by - h * 0.28); c.fill();
    ellipse(c, x + w * 0.85, y + h * 0.15, w * 0.22, w * 0.2, 'rgba(0,0,0,0)');
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(x + w * 0.18, y + h * 0.15, w * 0.1, h * 0.4);
  } else if (shape === 'gum') {
    const w = h * 0.6, x = cx - w / 2, y = by - h;
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(a, 0.8)], [0.5, shade(a, 1.15)], [1, shade(a, 0.75)]]); rr(c, x, y, w, h, 6); c.fill();
    c.fillStyle = b; c.font = `900 ${h * 0.16}px ${FONT}`; c.fillText(word, cx, y + h * 0.5);
  }
  c.restore();
}
function drops(c, x, y, w, h, s) {
  for (let i = 0; i < 14; i++) {
    const dx = x + ((i * 37) % 100) / 100 * w, dy = y + ((i * 53) % 100) / 100 * h, r = s * (0.008 + (i % 3) * 0.004);
    ellipse(c, dx, dy, r, r * 1.3, 'rgba(255,255,255,.45)');
  }
}

// 选择面板用的小图
const iconCache = {};
export function itemIconURL(id) {
  if (iconCache[id]) return iconCache[id];
  const cv = document.createElement('canvas'); cv.width = 120; cv.height = 130;
  drawItemV(cv.getContext('2d'), id, 60, 122, 112);
  return (iconCache[id] = cv.toDataURL());
}
