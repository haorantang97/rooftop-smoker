// 其他人：矢量小人。局部坐标里身高 100、脚底在原点、默认面朝右
import { mix, shade, lin, rr, ellipse, capsule } from './gfx.js';
import { CIG } from './data.js';
import { drawItemV } from './items.js';

export const HOODIE = ['#c95454', '#4f7fc9', '#5a9e6a', '#d9a441', '#8a5cc2', '#3d404c', '#d77aa0', '#d8d8d8', '#2f7377', '#9b6a43'];
export const SKIN = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];
export const HAIR = ['#1d1a1a', '#3b2a20', '#6b4a2b', '#c9a15a', '#7a2f2f', '#9aa0a8'];
export const PANTS = ['#2a2d3a', '#3a3f55', '#4a3b30', '#1c1c22'];

function pose(p) {
  const inMouth = p.cig === 1 || (p.cig === 2 && (p.puffing || p.flame > 0));
  const P = { mouth: [9, -83] };
  if (p.sipT > 0) { P.fe = [13, -62]; P.fh = [10, -83]; P.itemFront = true; }
  else if (inMouth) { P.fe = [14, -63]; P.fh = [13, -80]; P.cig = { from: [9.5, -83], dir: [1, 0.12] }; P.lighter = p.cig === 1 || p.flame > 0; }
  else if (p.cig === 2) { P.fe = [10, -54]; P.fh = [17, -61]; P.cig = { from: [18.5, -62], dir: [0.86, -0.5] }; }
  else if (p.item) { P.fe = [9, -55]; P.fh = [15, -58]; P.itemFront = true; }
  else { P.fe = [7, -57]; P.fh = [6, -50]; P.pocket = true; }
  if (p.item && !P.itemFront) { P.be = [-6, -55]; P.bh = [-2, -48]; P.itemBack = true; } else { P.be = [-5, -57]; P.bh = [-4, -46]; }
  return P;
}

export function drawPerson(c, p, x, y, H, t, n) {
  const S = H / 100, f = p.face || 1, lie = p.pose === 'lie';
  const m = new DOMMatrix().translate(x, y);
  if (lie) m.rotateSelf(0, 0, -90 * f).translateSelf(-8 * S * f, 0);
  m.scaleSelf(S * f, S);
  const toW = (lx, ly) => { const q = m.transformPoint(new DOMPoint(lx, ly)); return [q.x, q.y]; };
  const dim = (col, k = 0.45) => mix(col, shade(col, 0.42), n * k);
  const hood = dim(HOODIE[p.look.hoodie % HOODIE.length]), skin = dim(SKIN[p.look.skin % SKIN.length], 0.4);
  const hair = dim(HAIR[p.look.hair % HAIR.length], 0.3), pants = dim(PANTS[p.look.pants % PANTS.length], 0.3);
  const P = pose(p);

  c.save();
  if (!lie) ellipse(c, x, y, 20 * S, 3.5 * S, 'rgba(0,0,0,.28)');
  else ellipse(c, x - 40 * S * f, y + 4 * S, 55 * S, 5 * S, 'rgba(0,0,0,.28)');
  c.setTransform(c.getTransform().multiply(m));

  // 后面的手臂
  capsule(c, -3, -72, P.be[0], P.be[1], 6.5, shade(hood, 0.72));
  capsule(c, P.be[0], P.be[1], P.bh[0], P.bh[1], 5.8, shade(hood, 0.72));
  ellipse(c, P.bh[0], P.bh[1], 2.6, 2.8, shade(skin, 0.85));
  if (P.itemBack) drawItemV(c, p.item, P.bh[0], P.bh[1] + 5, 11, { cold: false });
  // 腿
  capsule(c, -2, -44, -3, -22, 8.5, shade(pants, 0.85)); capsule(c, -3, -22, -4, -4, 7.5, shade(pants, 0.85));
  capsule(c, 4, -44, 5, -22, 8.5, pants); capsule(c, 5, -22, 6, -4, 7.5, pants);
  c.fillStyle = dim('#2a2a2e', 0.2); rr(c, -8, -4.5, 12, 4.5, 2); c.fill(); rr(c, 2, -4.5, 12, 4.5, 2); c.fill();
  c.fillStyle = dim('#e8e8e8', 0.4); c.fillRect(-8, -1.4, 12, 1.4); c.fillRect(2, -1.4, 12, 1.4);
  // 身体（卫衣）
  c.fillStyle = lin(c, -10, 0, 13, 0, [[0, shade(hood, 0.72)], [0.6, hood], [1, shade(hood, 1.12)]]);
  c.beginPath(); c.moveTo(-8, -74); c.quadraticCurveTo(-2, -79.5, 6, -77.5); c.quadraticCurveTo(13.5, -74, 12.5, -64); c.lineTo(11.5, -42); c.quadraticCurveTo(2, -38.5, -9.5, -42); c.lineTo(-10.5, -64); c.quadraticCurveTo(-11, -72, -8, -74); c.fill();
  c.fillStyle = shade(hood, 0.82); c.fillRect(-9.5, -44.5, 21, 3);
  ellipse(c, -5, -76, 6, 3.6, shade(hood, 0.66));
  c.strokeStyle = shade(hood, 0.7); c.lineWidth = 0.7; c.beginPath(); c.moveTo(1, -54); c.lineTo(11, -54); c.stroke();
  c.strokeStyle = dim('#f0f0f0', 0.4); c.lineWidth = 0.6; c.beginPath(); c.moveTo(6, -76); c.lineTo(6.5, -68); c.moveTo(8.5, -75.5); c.lineTo(9, -68.5); c.stroke();
  // 头
  c.fillStyle = skin; c.fillRect(1, -81, 5, 5);
  c.fillStyle = lin(c, -5, 0, 11, 0, [[0, shade(skin, 0.85)], [1, shade(skin, 1.06)]]);
  c.beginPath(); c.ellipse(3, -88, 7.6, 8.6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(9.8, -90); c.lineTo(12, -86.5); c.lineTo(10, -85.5); c.fill();
  ellipse(c, 0.5, -87.5, 1.6, 2.4, shade(skin, 0.8));
  const blink = (t * 0.7 + Number(p.id) * 1.3) % 4 < 0.12 || p.puffing;
  if (blink) { c.strokeStyle = '#2a1e1a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(6.6, -89); c.lineTo(8.6, -88.8); c.stroke(); }
  else ellipse(c, 7.6, -89.2, 0.8, 1.1, '#1e1614');
  c.strokeStyle = shade(hair, 0.9); c.lineWidth = 0.8; c.beginPath(); c.moveTo(6, -92); c.lineTo(9.2, -91.6); c.stroke();
  if (!P.cig || P.cig.from[1] > -75) { c.strokeStyle = shade(skin, 0.6); c.lineWidth = 0.6; c.beginPath(); c.moveTo(8, -83.4); c.lineTo(9.6, -83.6); c.stroke(); }
  hairStyle(c, p.look.hair % 6, hair, hood);
  // 前面的手臂
  capsule(c, 5, -72, P.fe[0], P.fe[1], 6.8, hood);
  capsule(c, P.fe[0], P.fe[1], P.fh[0], P.fh[1], 6, hood);
  if (P.pocket) { c.fillStyle = shade(hood, 0.78); rr(c, 1, -55, 11, 8, 2); c.fill(); }
  else { ellipse(c, P.fh[0], P.fh[1], 2.6, 2.9, skin); }
  if (P.itemFront) drawItemV(c, p.item, P.fh[0] + 1, P.fh[1] + 5, 11, { cold: false });
  // 烟
  let tip = null;
  if (P.cig) {
    const b = CIG[p.brand] || {};
    const [fx, fy] = P.cig.from, [dx, dy] = P.cig.dir;
    const L = 9 * (1 - p.burn * 0.8), A = p.cig === 2 ? Math.min(2.4, p.ash * 5) : 0;
    c.lineCap = 'butt';
    capsule(c, fx, fy, fx + dx * 2.6, fy + dy * 2.6, 1.5, dim(b.filter || '#d39a4a', 0.3));
    capsule(c, fx + dx * 2.6, fy + dy * 2.6, fx + dx * L, fy + dy * L, 1.5, dim(b.paper || '#f4f2ec', 0.3));
    if (A > 0) capsule(c, fx + dx * L, fy + dy * L, fx + dx * (L + A), fy + dy * (L + A), 1.5, dim('#9a9590', 0.2));
    const tx = fx + dx * (L + A + 0.6), ty = fy + dy * (L + A + 0.6);
    if (p.cig === 2) ellipse(c, tx, ty, 0.9, 0.9, p.puffing ? '#ffd27a' : '#ff6a2a');
    tip = toW(tx, ty);
  }
  // 打火机
  let flame = null;
  if (P.lighter) {
    c.fillStyle = '#c43c3c'; rr(c, P.fh[0] + 0.5, P.fh[1] - 1, 2.6, 5, 0.8); c.fill();
    if (p.flame > 0) { ellipse(c, P.fh[0] + 1.8, P.fh[1] - 3, 1, 2, '#ffb84a'); flame = toW(P.fh[0] + 1.8, P.fh[1] - 3); }
  }
  c.restore();
  const head = toW(3, -99), feet = toW(0, 0);
  const pts = [toW(-12, -100), toW(14, -100), toW(-12, 0), toW(14, 0)];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { tip, flame, mouth: toW(...P.mouth), head, feet, k: S, box: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } };
}

function hairStyle(c, s, hair, hood) {
  c.fillStyle = hair;
  if (s === 0) { c.beginPath(); c.ellipse(2.4, -91.5, 8, 6, -0.1, Math.PI * 0.95, Math.PI * 2.08); c.fill(); c.beginPath(); c.moveTo(-4.8, -91); c.quadraticCurveTo(-5.8, -85, -3, -82); c.lineTo(-1, -90); c.fill(); }
  if (s === 1) { c.beginPath(); c.moveTo(10, -92); c.quadraticCurveTo(6, -99, -1, -97.5); c.quadraticCurveTo(-7, -95, -6.5, -86); c.quadraticCurveTo(-6, -80, -2, -79.5); c.lineTo(1, -88); c.quadraticCurveTo(6, -91, 10, -90); c.fill(); }
  if (s === 2) { c.beginPath(); c.ellipse(2.4, -91.5, 8, 6, -0.1, Math.PI * 0.95, Math.PI * 2.08); c.fill(); c.beginPath(); c.ellipse(-7.5, -86, 2.6, 6, 0.3, 0, Math.PI * 2); c.fill(); }
  if (s === 3) { c.globalAlpha = 0.75; c.beginPath(); c.ellipse(2.6, -90.5, 7.6, 5.4, -0.1, Math.PI, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  if (s === 4) { const hat = shade(hood, 0.9); c.fillStyle = hat; c.beginPath(); c.ellipse(2.6, -91.5, 8.4, 7.4, 0, Math.PI, Math.PI * 2); c.fill(); c.fillStyle = shade(hat, 0.82); rr(c, -6, -92.5, 17.2, 3.4, 1.4); c.fill(); ellipse(c, 2.6, -99.6, 1.8, 1.6, shade(hat, 1.15)); }
  if (s === 5) { c.beginPath(); c.ellipse(2.4, -91.5, 8, 6, -0.1, Math.PI * 0.95, Math.PI * 2.08); c.fill(); ellipse(c, -3.2, -98, 3.6, 3.4, hair); }
}
