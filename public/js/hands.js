// 第一视角：自己的右手夹着烟、左手拿打火机或饮料
import { lerp, ease, clamp, mix, shade, rgba, lin, rr, glow, ellipse, capsule } from './gfx.js';
import { CIG } from './data.js';
import { HOODIE, SKIN } from './person.js';
import { drawItemV } from './items.js';

// G = 夹烟的位置，a = 旋转，k = 大小，fy = 透视压缩（烟朝向前方时变短）
const POSES = {
  stand: { rest: { G: [1050, 790], a: -0.55, k: 1.8, fy: 1 }, mouth: { G: [850, 985], a: -0.2, k: 2.8, fy: 0.58 } },
  lie: { rest: { G: [1020, 860], a: -0.3, k: 1.75, fy: 1 }, mouth: { G: [800, 950], a: 0, k: 2.2, fy: 0.6 } },
};

export function makeFP() { return { raise: 0, raiseT: 0, lighter: 0, lighterT: 0, flame: 0, flickT: 9, stubT: 9, drawT: 1, sipT: 9, tipW: null, flameW: null }; }
export function updateFP(fp, dt) {
  const toward = (v, t, sp) => (v < t ? Math.min(t, v + sp * dt) : Math.max(t, v - sp * dt));
  fp.raise = toward(fp.raise, fp.raiseT, 3.6);
  fp.lighter = toward(fp.lighter, fp.lighterT, 3.4);
  fp.drawT = Math.min(1, fp.drawT + dt * 2.4);
  fp.flickT += dt; fp.stubT += dt; fp.sipT += dt;
  if (fp.flame > 0) fp.flame -= dt;
}

function cigSpec(brand) {
  const b = CIG[brand] || {};
  const base = { len: 92, filter: 24, w: 10, paper: b.paper || '#f4f2ec', filterCol: b.filter || '#d39a4a', b };
  if (b.bidi) return { ...base, len: 70, filter: 0, w: 7, taper: 0.55, tie: 10, leaf: true };
  if (b.cigarillo) return { ...base, len: 84, filter: 0, w: 12, leaf: true };
  if (b.papirosa) return { ...base, len: 112, filter: 46, w: 10, tube: true };
  if (b.slim) return { ...base, len: 98, filter: 26, w: 7 };
  return base;
}

// 在局部坐标里画烟：x 是宽度方向，烟沿 -y 方向，过滤嘴末端在 y = 22
function drawCigLocal(c, me, t) {
  const s = cigSpec(me.brand);
  const end = 22, fTop = end - s.filter;
  const paperLen = (s.len - s.filter) * (1 - me.burn * 0.82);
  const pTop = fTop - paperLen;
  const ashLen = me.cig === 2 ? Math.min(30, me.ash * 64) : 0;
  const aTop = pTop - ashLen;
  const hw = s.w / 2;
  const wAt = (y) => (s.taper ? hw * lerp(1, s.taper, (end - y) / s.len) : hw);
  const body = (y0, y1, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(-wAt(y0), y0); c.lineTo(wAt(y0), y0); c.lineTo(wAt(y1), y1); c.lineTo(-wAt(y1), y1); c.fill(); };
  const cyl = (col) => lin(c, -hw, 0, hw, 0, [[0, shade(col, 0.72)], [0.3, shade(col, 1.04)], [0.45, shade(col, 1.1)], [0.75, shade(col, 0.95)], [1, shade(col, 0.66)]]);
  // 过滤嘴
  if (s.filter) {
    body(end, fTop, cyl(s.tube ? shade(s.paper, 0.97) : s.filterCol));
    if (!s.tube && s.filterCol !== '#ffffff') { c.fillStyle = 'rgba(120,60,20,.35)'; for (let i = 0; i < 26; i++) { const yy = fTop + ((i * 37) % 100) / 100 * s.filter, xx = (((i * 53) % 100) / 100 - 0.5) * s.w * 0.8; c.fillRect(xx, yy, 1.4, 1.4); } }
    if (s.tube) { c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1; for (const yy of [end - 8, end - 14]) { c.beginPath(); c.moveTo(-hw, yy); c.lineTo(hw, yy + 2); c.stroke(); } }
    c.fillStyle = s.tube ? 'rgba(0,0,0,.12)' : '#e6c46a'; c.fillRect(-hw, fTop - 1, s.w, 2);
    ellipse(c, 0, end, hw, 1.6, shade(s.tube ? s.paper : s.filterCol, 0.85));
  }
  // 烟纸 / 烟叶
  if (paperLen > 0) {
    body(fTop, pTop, cyl(s.paper));
    if (s.leaf) { c.strokeStyle = 'rgba(40,20,10,.35)'; c.lineWidth = 0.8; for (let yy = fTop - 4; yy > pTop; yy -= 7) { c.beginPath(); c.moveTo(-wAt(yy), yy); c.lineTo(wAt(yy), yy - 5); c.stroke(); } }
    else { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(hw * 0.35, pTop, 0.8, paperLen); if (me.burn < 0.4) { c.fillStyle = shade(s.b.pack?.[0] || '#888', 0.9); c.fillRect(-hw * 0.6, fTop - 7, s.w * 0.6, 1.6); } }
    if (s.tie) { c.fillStyle = '#c9302c'; c.fillRect(-wAt(end - s.tie) - 0.5, end - s.tie - 2, wAt(end - s.tie) * 2 + 1, 3); }
  }
  // 烧焦的边、烟灰、火头
  if (me.cig === 2) {
    body(pTop + 1.5, pTop - 1.5, '#3a2a20');
    if (ashLen > 0.5) {
      body(pTop - 1, aTop, lin(c, -hw, 0, hw, 0, [[0, '#6e6a66'], [0.4, '#b4b0aa'], [1, '#5e5a56']]));
      c.fillStyle = 'rgba(50,46,44,.5)';
      for (let i = 0; i < ashLen * 1.2; i++) { const yy = pTop - ((i * 41) % 100) / 100 * ashLen, xx = (((i * 67) % 100) / 100 - 0.5) * s.w * 0.9; c.fillRect(xx, yy, 1.6, 1.2); }
      c.fillStyle = 'rgba(255,255,255,.18)'; for (let yy = pTop - 3; yy > aTop; yy -= 4) c.fillRect(-hw, yy, s.w, 0.8);
    }
    const hot = me.puffing ? 1 : 0.55 + 0.1 * Math.sin(t * 3);
    const ey = ashLen > 0.5 ? pTop : pTop - 1;
    c.fillStyle = lin(c, 0, ey + 2, 0, ey - 3, [[0, `rgba(255,${Math.round(90 + 80 * hot)},40,${0.6 + 0.4 * hot})`], [1, `rgba(255,${Math.round(150 + 90 * hot)},${Math.round(60 + 100 * hot)},${0.4 + 0.6 * hot})`]]);
    c.beginPath(); c.ellipse(0, ey, hw + 0.6, 2.6 + hot * 1.4, 0, 0, Math.PI * 2); c.fill();
    if (ashLen <= 0.5) { ellipse(c, 0, ey - 1, hw * 0.9, 2.4, `rgba(255,${Math.round(170 + 70 * hot)},90,${hot})`); for (let i = 0; i < 6; i++) ellipse(c, (i / 5 - 0.5) * s.w * 0.7, ey - 1 + Math.sin(i * 2 + t * 6) * 0.6, 0.9, 0.9, 'rgba(60,30,20,.6)'); }
    return aTop - 1;
  }
  // 没点的时候：烟丝的切面
  ellipse(c, 0, pTop, wAt(pTop), 2, '#8a5a30');
  for (let i = 0; i < 6; i++) ellipse(c, (i / 5 - 0.5) * s.w * 0.6, pTop + Math.sin(i) * 0.6, 0.8, 0.6, '#5a3418');
  return pTop;
}

function skinTone(me, n) { const s = SKIN[me.look.skin % SKIN.length]; return mix(s, shade(s, 0.55), n * 0.45); }
function sleeveTone(me, n) { const h = HOODIE[me.look.hoodie % HOODIE.length]; return mix(h, shade(h, 0.45), n * 0.4); }

// 右手（局部坐标：手指朝左，烟朝上，手腕在右下）
function finger(c, pts, w, skin, nail) {
  c.strokeStyle = skin; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1.2;
  for (let i = 1; i < pts.length - 1; i++) { const [x, y] = pts[i]; c.beginPath(); c.arc(x, y, w * 0.32, -0.6 - Math.PI / 2, 0.6 - Math.PI / 2); c.stroke(); }
  if (nail) {
    const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2];
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.save(); c.translate(x1 - Math.cos(a) * w * 0.25, y1 - Math.sin(a) * w * 0.25); c.rotate(a);
    c.fillStyle = 'rgba(255,225,215,.75)'; rr(c, -w * 0.45, -w * 0.3, w * 0.55, w * 0.6, w * 0.25); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-w * 0.35, -w * 0.18, w * 0.25, w * 0.12);
    c.restore();
  }
}
function rightHand(c, me, t, n, hasCig) {
  const skin = skinTone(me, n), dark = shade(skin, 0.78), light = shade(skin, 1.1), sleeve = sleeveTone(me, n);
  // 袖子
  c.fillStyle = lin(c, 150, 0, 420, 200, [[0, shade(sleeve, 1.05)], [1, shade(sleeve, 0.7)]]);
  c.beginPath(); c.moveTo(146, -8); c.quadraticCurveTo(260, -30, 470, 120); c.lineTo(420, 330); c.quadraticCurveTo(240, 200, 140, 96); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 3; for (const [x0, y0, x1, y1] of [[220, 10, 300, 120], [260, 0, 380, 90], [200, 60, 290, 170]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2 - 10, x1, y1); c.stroke(); }
  // 罗纹袖口
  c.fillStyle = shade(sleeve, 0.85); c.beginPath(); c.moveTo(140, -6); c.lineTo(178, -10); c.lineTo(176, 104); c.lineTo(136, 96); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.2; for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(140 + k * 4.2, -6); c.lineTo(137 + k * 4.4, 98); c.stroke(); }
  // 后面的两根手指（弯着）
  finger(c, [[66, 40], [44, 52], [30, 44]], 16, dark, false);
  finger(c, [[62, 58], [44, 66], [34, 58]], 14, dark, false);
  // 中指（在烟后面）
  finger(c, [[68, 20], [30, 22], [-18, 20]], 17, shade(skin, 0.92), true);
  // 手背
  c.fillStyle = lin(c, 50, -20, 160, 90, [[0, light], [0.55, skin], [1, dark]]);
  c.beginPath(); c.moveTo(54, -16); c.quadraticCurveTo(80, -30, 112, -18); c.lineTo(150, -6); c.lineTo(146, 98); c.quadraticCurveTo(100, 96, 70, 70); c.quadraticCurveTo(46, 30, 54, -16); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = 2; for (const [y0, y1] of [[-4, 10], [16, 32], [36, 52]]) { c.beginPath(); c.moveTo(70, y0); c.quadraticCurveTo(105, (y0 + y1) / 2 - 4, 142, y1); c.stroke(); }
  for (const [x, y] of [[62, -2], [66, 20], [66, 42], [64, 60]]) ellipse(c, x, y, 7, 5, 'rgba(255,255,255,.12)');
  // 大拇指
  finger(c, [[104, 92], [70, 96], [44, 82]], 18, shade(skin, 0.95), true);
  return { skin, dark, light, hasCig };
}
function indexFinger(c, me, n) {
  const skin = skinTone(me, n);
  finger(c, [[64, -6], [26, -8], [-20, -2]], 18, skin, true);
  ellipse(c, 30, -12, 6, 3, 'rgba(255,255,255,.14)');
}

// 左手：打火机
function lighterHand(c, me, fp, t, n) {
  const skin = skinTone(me, n), sleeve = sleeveTone(me, n);
  c.fillStyle = lin(c, -60, 60, -200, 300, [[0, shade(sleeve, 1)], [1, shade(sleeve, 0.68)]]);
  c.beginPath(); c.moveTo(-44, 70); c.quadraticCurveTo(-120, 120, -260, 360); c.lineTo(-40, 380); c.quadraticCurveTo(20, 200, 30, 100); c.closePath(); c.fill();
  c.fillStyle = shade(sleeve, 0.85); c.beginPath(); c.moveTo(-48, 66); c.lineTo(34, 92); c.lineTo(28, 126); c.lineTo(-62, 100); c.fill();
  // 手背和握拳
  c.fillStyle = lin(c, -50, 20, 20, 110, [[0, shade(skin, 1.08)], [1, shade(skin, 0.8)]]);
  c.beginPath(); c.moveTo(-40, 24); c.quadraticCurveTo(-10, 10, 14, 30); c.lineTo(30, 96); c.quadraticCurveTo(-10, 112, -50, 92); c.quadraticCurveTo(-60, 56, -40, 24); c.fill();
  // 打火机
  const body = '#c43c3c';
  c.fillStyle = lin(c, -14, 0, 14, 0, [[0, shade(body, 0.6)], [0.3, shade(body, 1.35)], [1, shade(body, 0.6)]]); rr(c, -14, 16, 28, 62, 6); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-8, 20, 3, 52);
  c.fillStyle = lin(c, -14, 0, 14, 0, [[0, '#7a7e86'], [0.4, '#e8eaee'], [1, '#6a6e76']]); c.fillRect(-14, 0, 28, 18);
  c.fillStyle = '#2a2a2e'; for (let k = -9; k <= 9; k += 4.5) c.fillRect(k - 1, 4, 2, 8);
  ellipse(c, 9, -2, 6, 6, '#5a5e66'); c.strokeStyle = '#2a2a2e'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + t * (fp.spin || 0); c.beginPath(); c.moveTo(9 + Math.cos(a) * 3, -2 + Math.sin(a) * 3); c.lineTo(9 + Math.cos(a) * 6, -2 + Math.sin(a) * 6); c.stroke(); }
  // 握着的手指和压着滑轮的大拇指
  for (let k = 0; k < 4; k++) finger(c, [[-24, 30 + k * 14], [10, 28 + k * 14], [18, 34 + k * 14]], 13, shade(skin, 0.92 - k * 0.03), false);
  finger(c, [[-34, 30], [-16, 4], [6, -6]], 15, shade(skin, 1.02), true);
  // 火
  if (fp.flame > 0) {
    const fl = 1 + Math.sin(t * 37) * 0.12 + Math.sin(t * 23) * 0.08, sway = Math.sin(t * 9) * 3;
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, 0, -26, 90, 'rgba(255,160,70,.35)');
    c.restore();
    const flame = (h, w, stops) => { c.fillStyle = lin(c, 0, 0, 0, -h, stops); c.beginPath(); c.moveTo(-w, -4); c.quadraticCurveTo(-w * 1.1, -h * 0.45, sway, -h); c.quadraticCurveTo(w * 1.1, -h * 0.45, w, -4); c.quadraticCurveTo(0, 4, -w, -4); c.fill(); };
    flame(56 * fl, 11, [[0, 'rgba(255,120,30,.0)'], [0.15, 'rgba(255,130,40,.85)'], [0.7, 'rgba(255,190,80,.6)'], [1, 'rgba(255,220,140,0)']]);
    flame(36 * fl, 6.5, [[0, 'rgba(90,140,255,.8)'], [0.25, 'rgba(255,240,200,.95)'], [1, 'rgba(255,230,160,0)']]);
  }
}

// 左手：拿着的东西
function itemHand(c, me, id, n, t) {
  const skin = skinTone(me, n), sleeve = sleeveTone(me, n), h = 300;
  c.fillStyle = lin(c, -40, 0, -260, 300, [[0, shade(sleeve, 1)], [1, shade(sleeve, 0.68)]]);
  c.beginPath(); c.moveTo(-90, -60); c.quadraticCurveTo(-160, 40, -300, 260); c.lineTo(-60, 300); c.quadraticCurveTo(-10, 120, -20, 10); c.closePath(); c.fill();
  drawItemV(c, id, 0, 0, h, { steam: id === 'noodle' });
  const y0 = -h * 0.42;
  c.fillStyle = lin(c, -110, y0, -40, y0 + 120, [[0, shade(skin, 1.06)], [1, shade(skin, 0.8)]]);
  c.beginPath(); c.moveTo(-96, y0 - 20); c.quadraticCurveTo(-60, y0 - 34, -50, y0 - 6); c.lineTo(-46, y0 + 104); c.quadraticCurveTo(-84, y0 + 120, -110, y0 + 90); c.quadraticCurveTo(-120, y0 + 30, -96, y0 - 20); c.fill();
  for (let k = 0; k < 4; k++) finger(c, [[-60, y0 + k * 26], [20, y0 + 4 + k * 26], [52, y0 + 12 + k * 26]], 22, shade(skin, 0.97 - k * 0.04), true);
  finger(c, [[-80, y0 - 10], [-46, y0 - 46], [-16, y0 - 60]], 22, shade(skin, 1.03), true);
}

export function drawFP(c, fp, me, t, mode, opts = {}) {
  const n = opts.night || 0, lift = opts.lift || 0, par = opts.par || 0;
  const sway = [Math.sin(t * 0.7) * 4 + par, Math.sin(t * 1.1) * 3 - lift];
  const P = POSES[mode] || POSES.stand;
  const r = ease(fp.raise);
  let G = [lerp(P.rest.G[0], P.mouth.G[0], r), lerp(P.rest.G[1], P.mouth.G[1], r)];
  let a = lerp(P.rest.a, P.mouth.a, r), k = lerp(P.rest.k, P.mouth.k, r), fy = lerp(P.rest.fy, P.mouth.fy, r);
  let dy = (1 - ease(fp.drawT)) * 300;
  if (fp.flickT < 0.35) { const q = fp.flickT / 0.35; dy += Math.sin(q * Math.PI * 3) * 14 * (1 - q); a += Math.sin(q * Math.PI * 3) * 0.05 * (1 - q); }
  if (fp.stubT < 1 && opts.ashtray) { const q = fp.stubT < 0.5 ? ease(fp.stubT / 0.5) : ease((1 - fp.stubT) / 0.5); G = [lerp(G[0], opts.ashtray[0], q), lerp(G[1], opts.ashtray[1], q)]; a = lerp(a, 0.9, q); k *= 1 - q * 0.35; }
  G = [G[0] + sway[0], G[1] + sway[1] + dy];

  // 左手
  const lr = ease(fp.lighter);
  fp.flameW = null;
  if (lr > 0.01 && me.cig) {
    const tip = fp.tipW || [G[0], G[1] - 80];
    const target = [tip[0] + 4, tip[1] + 34];
    const x = lerp(380, target[0], lr), y = lerp(1260, target[1], lr);
    c.save(); c.translate(x, y); c.rotate(lerp(0.5, 0.12, lr)); c.scale(1.25, 1.25);
    lighterHand(c, me, fp, t, n);
    c.restore();
    fp.flameW = [x, y - 30];
  } else if (me.item) {
    let x = 360 + sway[0] * 0.8, y = 1060 + sway[1];
    if (mode === 'lie') { x = 360; y = 1120; }
    if (fp.sipT < 1.1) { const q = Math.sin(Math.PI * clamp(fp.sipT / 1.1, 0, 1)); x = lerp(x, 760, q); y = lerp(y, 1010, q); }
    c.save(); c.translate(x, y); c.rotate(fp.sipT < 1.1 ? -0.25 * Math.sin(Math.PI * clamp(fp.sipT / 1.1, 0, 1)) : -0.06); c.scale(1, 1);
    itemHand(c, me, me.item, n, t);
    c.restore();
  }

  // 右手和烟
  fp.tipW = null;
  if (me.cig || (fp.stubT < 1 && opts.ashtray)) {
    c.save(); c.translate(G[0], G[1]); c.rotate(a); c.scale(k, k * fy);
    rightHand(c, me, t, n, true);
    let ty = 0;
    if (me.cig) ty = drawCigLocal(c, me, t);
    indexFinger(c, me, n);
    c.restore();
    if (me.cig) { const yy = ty * k * fy; fp.tipW = [G[0] - yy * Math.sin(a), G[1] + yy * Math.cos(a)]; }
  } else if (opts.idleHand !== false) {
    // 空着的右手垂在右下角
    c.save(); c.translate(1350 + sway[0], 1060 + sway[1]); c.rotate(-1.1); c.scale(1.3, 1.3);
    rightHand(c, me, t, n, false);
    finger(c, [[64, -6], [36, -2], [20, 10]], 18, skinTone(me, n), true);
    c.restore();
  }
}
export function fpGlow(c, fp, me) {
  if (!fp.tipW || me.cig !== 2) return;
  const [x, y] = fp.tipW;
  glow(c, x, y, me.puffing ? 150 : 60, me.puffing ? 'rgba(255,130,50,.35)' : 'rgba(255,110,50,.2)');
  glow(c, x, y, me.puffing ? 22 : 10, me.puffing ? 'rgba(255,220,140,.9)' : 'rgba(255,160,80,.6)');
}
