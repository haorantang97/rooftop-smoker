// 便利店里：第一视角全景，左右转头看。宽 3200，高 1000
import { VH, lerp, mix, shade, rgba, rr, lin, glow, ellipse, mulberry32, perspectiveTiles } from './gfx.js';
import { CIGS } from './data.js';
import { drawItemV } from './items.js';

export const PW = 3200;
export const ZONES = {
  fridge: { x0: 170, x1: 1070, y0: 170, y1: 770, label: '冰柜' },
  snack: { x0: 1120, x1: 2020, y0: 250, y1: 770, label: '零食架' },
  cigs: { x0: 2090, x1: 2940, y0: 180, y1: 640, label: '烟柜' },
  door: { x0: 2990, x1: 3200, y0: 150, y1: 900, label: '上天台' },
};
const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';

export function buildShop(c, sky) {
  const rnd = mulberry32(31);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // 天花板
  c.fillStyle = lin(c, 0, 0, 0, 170, [[0, '#c9cdd0'], [1, '#e6e8e6']]); c.fillRect(0, 0, PW, 170);
  c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; for (let x = 0; x < PW; x += 120) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 170); c.stroke(); } for (const y of [50, 110]) { c.beginPath(); c.moveTo(0, y); c.lineTo(PW, y); c.stroke(); }
  for (let x = 140; x < PW; x += 420) { c.fillStyle = '#ffffff'; rr(c, x, 60, 280, 34, 4); c.fill(); glow(c, x + 140, 110, 300, 'rgba(255,255,255,.4)'); }
  // 监控摄像头
  c.fillStyle = '#3a3c42'; rr(c, 2700, 120, 60, 26, 6); c.fill(); c.fillRect(2724, 100, 8, 22); ellipse(c, 2702, 133, 9, 9, '#111'); ellipse(c, 2702, 133, 3, 3, '#ff3a3a');
  // 墙
  c.fillStyle = lin(c, 0, 170, 0, 770, [[0, '#f3f0e8'], [1, '#e2ddd0']]); c.fillRect(0, 170, PW, 600);
  c.fillStyle = '#c9c3b4'; c.fillRect(0, 166, PW, 6); c.fillStyle = '#b6b0a2'; c.fillRect(0, 748, PW, 22);
  // 左墙：员工门、禁烟、海报
  c.fillStyle = '#d4cfc2'; rr(c, 14, 330, 130, 420, 4); c.fill(); c.fillStyle = '#bdb7a8'; c.fillRect(124, 530, 8, 40);
  c.fillStyle = '#5a5a60'; c.font = `700 14px ${FONT}`; c.fillText('STAFF ONLY', 79, 380);
  ellipse(c, 79, 250, 34, 34, '#d23a2a'); ellipse(c, 79, 250, 27, 27, '#ffffff'); c.fillStyle = '#888'; c.fillRect(56, 245, 40, 10); c.fillStyle = '#ff7a35'; c.fillRect(96, 245, 6, 10);
  c.save(); c.translate(79, 250); c.rotate(-0.78); c.fillStyle = '#d23a2a'; c.fillRect(-30, -4, 60, 8); c.restore();
  c.fillStyle = '#5a5a60'; c.font = `600 12px ${FONT}`; c.fillText('店内禁烟 · 请上天台', 79, 298);

  fridge(c, rnd);
  snacks(c, rnd);
  counter(c, rnd);
  door(c, sky);
  // 地面（透视线每帧另画）
  c.fillStyle = lin(c, 0, 770, 0, VH, [[0, '#d6d2c6'], [1, '#bdb8aa']]); c.fillRect(0, 770, PW, VH - 770);
  for (let x = 300; x < PW; x += 420) { c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(x + 140, 860, 180, 26, 0, 0, Math.PI * 2); c.fill(); }
  // 门口的地垫
  c.fillStyle = '#3a4a44'; rr(c, 2980, 900, 220, 70, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.font = `700 16px ${FONT}`; c.fillText('WELCOME', 3090, 936);
}

function fridge(c, rnd) {
  const Z = ZONES.fridge, w = Z.x1 - Z.x0;
  c.fillStyle = lin(c, Z.x0, 0, Z.x1, 0, [[0, '#9aa2aa'], [0.5, '#c9d0d6'], [1, '#8a9298']]); c.fillRect(Z.x0, Z.y0, w, Z.y1 - Z.y0);
  c.fillStyle = '#20262c'; rr(c, Z.x0 + 20, Z.y0 + 12, w - 40, 34, 6); c.fill();
  c.fillStyle = '#7fe0ff'; c.font = `800 20px ${FONT}`; c.fillText('冷 饮  COLD DRINKS', Z.x0 + w / 2, Z.y0 + 30);
  const drinks = ['beer', 'cola', 'highball', 'coffee', 'soju', 'milk', 'sake', 'whisky'];
  const doors = 4, dw = (w - 30) / doors;
  for (let d = 0; d < doors; d++) {
    const x = Z.x0 + 15 + d * dw, y = Z.y0 + 56, h = Z.y1 - Z.y0 - 76;
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#e6f6ff'], [1, '#bfe2f4']]); c.fillRect(x + 6, y, dw - 12, h);
    for (let s = 0; s < 5; s++) {
      const sy = y + 20 + s * (h - 30) / 5, sh = (h - 30) / 5;
      c.fillStyle = '#9fb0ba'; c.fillRect(x + 6, sy + sh - 8, dw - 12, 6);
      c.fillStyle = '#ffffff'; c.fillRect(x + 10, sy + sh - 2, dw - 20, 10);
      const per = 4;
      for (let k = 0; k < per; k++) { const id = drinks[(d * 2 + s + k * 3) % drinks.length]; drawItemV(c, id, x + 22 + k * (dw - 40) / (per - 1) * 0.92, sy + sh - 8, sh * 0.78); }
      c.fillStyle = '#d23a2a'; c.font = `700 9px ${FONT}`; for (let k = 0; k < per; k++) c.fillText('¥' + (5 + ((d + s + k) * 7) % 15), x + 22 + k * (dw - 40) / (per - 1) * 0.92, sy + sh + 3);
    }
    // 玻璃反光、门框、把手
    c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(x + 30, y); c.lineTo(x + 80, y); c.lineTo(x + 20, y + h); c.lineTo(x - 30 + 36, y + h); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(x + 100, y); c.lineTo(x + 116, y); c.lineTo(x + 56, y + h); c.lineTo(x + 40, y + h); c.fill();
    c.strokeStyle = '#7a8288'; c.lineWidth = 8; c.strokeRect(x + 4, y - 2, dw - 8, h + 4);
    c.fillStyle = lin(c, 0, 0, 12, 0, [[0, '#9aa0a8'], [0.5, '#eef0f2'], [1, '#8a9098']]);
    c.save(); c.translate(x + dw - 26, y + h * 0.35); c.fillRect(0, 0, 10, h * 0.3); c.restore();
  }
  glow(c, Z.x0 + w / 2, Z.y0 + 360, 600, 'rgba(160,220,255,.12)');
}

function snacks(c, rnd) {
  const Z = ZONES.snack, w = Z.x1 - Z.x0;
  c.fillStyle = '#20262c'; rr(c, Z.x0 + w / 2 - 140, Z.y0 - 60, 280, 40, 6); c.fill();
  c.fillStyle = '#ffd36a'; c.font = `800 20px ${FONT}`; c.fillText('零 食  SNACKS', Z.x0 + w / 2, Z.y0 - 40);
  c.fillStyle = '#c9c1ae'; c.fillRect(Z.x0, Z.y0, w, Z.y1 - Z.y0);
  c.fillStyle = 'rgba(0,0,0,.08)'; for (let y = Z.y0 + 12; y < Z.y1; y += 18) for (let x = Z.x0 + 12; x < Z.x1; x += 18) c.fillRect(x, y, 3, 3);
  const rows = [['chips', 'chips', 'choco', 'chips', 'gum'], ['noodle', 'noodle', 'noodle', 'choco', 'gum'], ['onigiri', 'onigiri', 'chips', 'choco', 'onigiri'], ['chips', 'gum', 'choco', 'noodle', 'chips']];
  const rh = (Z.y1 - Z.y0 - 30) / rows.length;
  rows.forEach((row, r) => {
    const sy = Z.y0 + 10 + r * rh;
    c.fillStyle = '#8f8878'; c.fillRect(Z.x0, sy + rh - 12, w, 12);
    c.fillStyle = '#ffe14a'; c.fillRect(Z.x0, sy + rh - 4, w, 12);
    const n = 9;
    for (let k = 0; k < n; k++) {
      const id = row[(k + r) % row.length];
      drawItemV(c, id, Z.x0 + 50 + k * (w - 100) / (n - 1), sy + rh - 12, rh * (id === 'gum' ? 0.5 : id === 'onigiri' ? 0.55 : 0.8));
      c.fillStyle = '#c62a2a'; c.font = `700 10px ${FONT}`; c.fillText('¥' + (3 + ((k + r * 3) * 5) % 12), Z.x0 + 50 + k * (w - 100) / (n - 1), sy + rh + 2);
    }
  });
  c.fillStyle = '#8a8270'; c.fillRect(Z.x0 - 10, Z.y0 - 6, 10, Z.y1 - Z.y0 + 6); c.fillRect(Z.x1, Z.y0 - 6, 10, Z.y1 - Z.y0 + 6);
}

function pack(c, b, x, y, w, h) {
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(b.pack[0], 0.82)], [0.3, shade(b.pack[0], 1.08)], [1, shade(b.pack[0], 0.75)]]);
  c.fillRect(x, y, w, h);
  c.fillStyle = b.pack[1]; c.fillRect(x, y, w, h * 0.24);
  rr(c, x + w * 0.2, y + h * 0.45, w * 0.6, h * 0.2, 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + w * 0.1, y, w * 0.08, h);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, y + h * 0.82, w, h * 0.18);
}
function counter(c, rnd) {
  const Z = ZONES.cigs, w = Z.x1 - Z.x0;
  // 烟柜
  c.fillStyle = '#2e2622'; c.fillRect(Z.x0, Z.y0, w, Z.y1 - Z.y0);
  c.fillStyle = '#e8c35a'; rr(c, Z.x0 + w / 2 - 150, Z.y0 + 8, 300, 36, 4); c.fill();
  c.fillStyle = '#3a2a10'; c.font = `800 20px ${FONT}`; c.fillText('香 烟  TOBACCO', Z.x0 + w / 2, Z.y0 + 27);
  c.fillStyle = '#fff'; c.font = `600 11px ${FONT}`; c.fillText('来自世界各地 · 全部是虚构的牌子', Z.x0 + w / 2, Z.y0 + 58);
  const cols = 14, rows = 6, pw = (w - 60) / cols, ph = (Z.y1 - Z.y0 - 100) / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) { const b = CIGS[(k + r * 3) % CIGS.length]; pack(c, b, Z.x0 + 30 + k * pw + 6, Z.y0 + 76 + r * ph, pw - 12, ph - 22); }
    c.fillStyle = '#5a4a40'; c.fillRect(Z.x0 + 20, Z.y0 + 76 + r * ph + ph - 18, w - 40, 6);
    c.fillStyle = '#f4f0e6'; for (let k = 0; k < cols; k++) c.fillRect(Z.x0 + 30 + k * pw + 10, Z.y0 + 76 + r * ph + ph - 12, pw - 20, 8);
  }
  for (let x = Z.x0 + 80; x < Z.x1; x += 160) glow(c, x, Z.y0 + 70, 140, 'rgba(255,230,180,.16)');
  c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(Z.x0 + 60, Z.y0 + 70); c.lineTo(Z.x0 + 140, Z.y0 + 70); c.lineTo(Z.x0 + 40, Z.y1); c.lineTo(Z.x0 - 40 + 40, Z.y1); c.fill();
  // 收银台
  const cy = 640;
  c.fillStyle = lin(c, 0, cy, 0, 790, [[0, '#8a7562'], [1, '#5e4c3e']]); c.fillRect(Z.x0 - 30, cy + 20, w + 60, 150);
  c.fillStyle = '#a68e78'; c.fillRect(Z.x0 - 40, cy + 6, w + 80, 18);
  c.fillStyle = '#1d8a66'; rr(c, Z.x0 + 260, cy + 60, 330, 70, 8); c.fill();
  c.fillStyle = '#fff'; c.font = `700 18px ${FONT}`; c.fillText('收银台没人 · 自己拿就行', Z.x0 + 425, cy + 86); c.font = `500 12px ${FONT}`; c.fillText('反正都是像素和矢量做的', Z.x0 + 425, cy + 110);
  // 关东煮锅（冒热气）
  const ox = Z.x0 + 120;
  c.fillStyle = lin(c, ox - 90, 0, ox + 90, 0, [[0, '#8a8e96'], [0.5, '#e4e6ea'], [1, '#7a7e86']]); rr(c, ox - 90, cy - 50, 180, 60, 8); c.fill();
  ellipse(c, ox, cy - 50, 86, 14, '#c9a560');
  for (let k = 0; k < 7; k++) drawItemV(c, 'oden', ox - 70 + k * 23, cy - 44, 70, { cold: false });
  c.fillStyle = '#fff'; c.font = `700 12px ${FONT}`; c.fillText('关东煮', ox, cy - 4);
  // 热狗柜
  const hx = Z.x0 + 720;
  c.fillStyle = 'rgba(255,200,140,.35)'; rr(c, hx - 80, cy - 90, 160, 96, 8); c.fill(); c.strokeStyle = '#8a8e96'; c.lineWidth = 4; c.strokeRect(hx - 80, cy - 90, 160, 96);
  for (let k = 0; k < 5; k++) { c.save(); c.translate(hx - 56 + k * 28, cy - 30); c.rotate(Math.PI / 2); drawItemV(c, 'sausage', 0, 20, 60, { cold: false }); c.restore(); }
  glow(c, hx, cy - 50, 120, 'rgba(255,170,90,.2)');
  // 收银机
  const rx = Z.x0 + 470;
  c.fillStyle = '#2a2a30'; rr(c, rx - 60, cy - 110, 120, 80, 6); c.fill(); c.fillStyle = '#5ad1a0'; rr(c, rx - 50, cy - 102, 100, 54, 4); c.fill();
  c.fillStyle = '#1a3a2a'; c.font = `700 14px ${FONT}`; c.fillText('¥ 0.00', rx, cy - 76);
  c.fillStyle = '#3a3a40'; c.fillRect(rx - 10, cy - 30, 20, 30); c.fillStyle = '#4a4a52'; rr(c, rx - 80, cy - 14, 160, 22, 4); c.fill();
}

function door(c, sky) {
  const Z = ZONES.door, w = Z.x1 - Z.x0;
  // 门外是上天台的楼梯间
  c.fillStyle = '#7a828a'; c.fillRect(Z.x0, Z.y0 + 50, w, 720);
  c.fillStyle = lin(c, 0, Z.y0 + 60, 0, 770, [[0, '#3a3e48'], [1, '#22252c']]); c.fillRect(Z.x0 + 12, Z.y0 + 60, w - 24, 710);
  for (let k = 0; k < 9; k++) { const y = 760 - k * 64, x = Z.x0 + 20 + k * 14; c.fillStyle = shade('#6a6e78', 1 - k * 0.04); c.fillRect(x, y - 10, w - 40 - k * 14, 12); c.fillStyle = '#3a3e46'; c.fillRect(x, y + 2, w - 40 - k * 14, 50); }
  glow(c, Z.x0 + w / 2, Z.y0 + 100, 200, 'rgba(255,230,180,.3)');
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(Z.x0 + 30, Z.y0 + 60, 18, 700);
  c.fillStyle = '#7a828a'; c.fillRect(Z.x0 + w / 2 - 4, Z.y0 + 50, 8, 720);
  // 天台指示牌
  c.fillStyle = '#1d8a66'; rr(c, Z.x0 + 10, Z.y0 - 10, w - 20, 50, 6); c.fill();
  glow(c, Z.x0 + w / 2, Z.y0 + 15, 140, 'rgba(80,255,170,.18)');
  c.fillStyle = '#eafff6'; c.font = `800 20px ${FONT}`; c.fillText('↑ 天台吸烟区', Z.x0 + w / 2, Z.y0 + 16);
  // 一小块天色
  c.fillStyle = lin(c, 0, Z.y0 + 70, 0, Z.y0 + 160, [[0, sky.top], [1, sky.low]]); c.fillRect(Z.x0 + w - 90, Z.y0 + 70, 60, 90);
  c.strokeStyle = '#5a5e66'; c.lineWidth = 4; c.strokeRect(Z.x0 + w - 90, Z.y0 + 70, 60, 90);
}

// 每帧画地面的透视线，灭点跟着视线中心走
export function drawShopFloor(c, viewX, visW) {
  perspectiveTiles(c, viewX - 200, viewX + visW + 200, 770, VH + 60, viewX + visW / 2, 470, 6, 10, 'rgba(0,0,0,.09)');
}
// 店里其他人站的位置：服务端 x ∈ [20,462] 映射到全景，y ∈ [214,262] 映射为远近
export function shopSpot(p) {
  const x = lerp(240, PW - 260, (p.x - 20) / 442);
  const d = Math.max(0, Math.min(1, (p.y - 214) / 48));
  return [x, lerp(840, 960, d), lerp(380, 520, d)];
}
export function yawToServerX(yawCenter) { return 20 + Math.max(0, Math.min(1, (yawCenter - 240) / (PW - 500))) * 442; }
