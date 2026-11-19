// 抽根烟 · 主逻辑：状态、网络、渲染、输入、界面（全程第一视角）
import { VW, VH, clamp, rand, mix, glow, ellipse, skyAt, localHour, fmtHour, smokeSprite, GRAIN } from './gfx.js';
import { CIG, CIGS, ITEM, ITEMS, PHRASES, VISTAS, placeName } from './data.js';
import { Snd } from './sound.js';
import { MARGIN, ASHTRAY, buildStreet, buildStreetNear, buildLieSky, slotPos, makeTraffic, updateTraffic, drawTraffic, drawTrafficLights } from './street.js';
import { buildRoofVista, drawVistaDynamic, roofSlot } from './vistas.js';
import { PW, ZONES, buildShop, drawShopFloor, shopSpot, yawToServerX } from './shop.js';
import { drawPerson } from './person.js';
import { makeFP, updateFP, drawFP, fpGlow } from './hands.js';
import { itemIconURL } from './items.js';

const BURN_IDLE = 1 / 300, BURN_PUFF = 1 / 22;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cvs = $('#game'), ctx = cvs.getContext('2d');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const urlHour = new URLSearchParams(location.search).get('hour');
const hourNow = () => (urlHour !== null ? Number(urlHour) : localHour());

const S = {
  ws: null, meId: null, room: 0, players: new Map(), log: [], stats: null,
  place: 'shop', far: null, near: null, layerKey: '', sky: skyAt(12), dyn: { blink: [] }, blinkers: [],
  parts: [], hearts: [], traffic: makeTraffic(), fp: makeFP(), light: null,
  view: { s: 1, visW: VW, visH: VH, ox: 0, oy: 0, dpr: 1 },
  yaw: 700, par: 0, parT: 0, myY: 214 + Math.random() * 48, lastMoveSent: 0, lastX: null,
  keys: new Set(), drag: null, panHeld: 0, fails: 0, sound: store.get('smoke.sound', true), entered: false, t: 0,
  glitch: 0, glitchThen: null, wallPush: 0, tapLog: [], fade: 1,
  muted: new Set(store.get('smoke.muted', [])), lastSay: 0,
};
const me = () => S.players.get(S.meId);
const outside = () => S.place !== 'shop';
const vistaOf = (pl) => (pl.startsWith('roof:') ? pl.slice(5) : null);
const ambientKey = (pl) => (pl.startsWith('roof') ? 'roof' : pl);

let toastTimer = 0;
function toast(text, ms = 2800) { const el = $('#toast'); el.textContent = text; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms); }
function hintOnce(key, text, delay = 600) { if (store.get(key, false)) return; store.set(key, true); setTimeout(() => toast(text, 5000), delay); }

// ---------- 背景图层：按地点、姿势、分钟和清晰度重建 ----------
function ensureLayers(force) {
  const m = me(), lie = !!(m && m.pose === 'lie'), h = hourNow();
  const q = clamp(S.view.s * S.view.dpr, 0.5, 2);
  const qq = S.place === 'shop' && !lie ? Math.min(q, 4096 / PW) : q;
  const key = `${S.place}|${lie}|${Math.floor(h * 60)}|${qq.toFixed(2)}`;
  if (!force && key === S.layerKey) return;
  S.layerKey = key; S.sky = skyAt(h);
  const mk = (w) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w * qq); cv.height = Math.ceil(VH * qq); return cv; };
  if (S.place === 'shop' && !lie) {
    S.far = mk(PW); const c = S.far.getContext('2d'); c.setTransform(qq, 0, 0, qq, 0, 0); buildShop(c, S.sky); S.near = null;
  } else {
    S.far = mk(VW + MARGIN * 2); S.near = mk(VW + MARGIN * 2);
    const c = S.far.getContext('2d'), cn = S.near.getContext('2d');
    c.setTransform(qq, 0, 0, qq, MARGIN * qq, 0); cn.setTransform(qq, 0, 0, qq, MARGIN * qq, 0);
    S.blinkers = []; S.dyn = { blink: [] };
    if (lie) buildLieSky(c, S.sky, S.place !== 'street');
    else if (S.place === 'street') { buildStreet(c, S.sky, S.blinkers); buildStreetNear(cn, S.sky); }
    else buildRoofVista(c, cn, S.sky, vistaOf(S.place) || 'city', S.dyn);
  }
}

// ---------- 粒子 ----------
function nightTint(rgb) { const n = S.sky.night; return [Math.round(rgb[0] * (1 - 0.3 * n) + 20 * n), Math.round(rgb[1] * (1 - 0.28 * n) + 24 * n), Math.round(rgb[2] * (1 - 0.18 * n) + 40 * n)]; }
const tintOf = (brand) => nightTint(CIG[brand]?.smoke || [214, 214, 224]);
function smoke(x, y, o) { S.parts.push({ k: 'smoke', x, y, vx: 0, vy: -20, size: 10, grow: 20, life: 0, max: 3, a: 0.3, v: (Math.random() * 4) | 0, wob: rand(0, 6), drag: 0.6, tint: [214, 214, 224], ...o }); }
function wisp(x, y, k, brand) { smoke(x, y, { vx: rand(-2, 2) * k, vy: rand(-14, -9) * k, size: 3 * k, grow: rand(5, 9) * k, max: rand(2.6, 3.6), a: 0.22, drag: 0.2, tint: tintOf(brand), curl: k }); }
function exhaleAt(x, y, face, amt, k, brand) {
  const n = 10 + Math.round(amt * 20);
  for (let i = 0; i < n; i++) { const sp = rand(14, 30) * (0.5 + amt) * k; smoke(x, y, { vx: face * sp + rand(-4, 4) * k, vy: rand(-8, 2) * k, size: rand(3, 6) * k, grow: rand(10, 20) * k, life: -i * 0.03, max: rand(2.4, 3.8), a: 0.3 + amt * 0.12, drag: 1.4, tint: tintOf(brand) }); }
}
function exhaleFP(amt, brand) {
  const cx = S.view.ox + S.view.visW / 2, n = 18 + Math.round(amt * 24);
  for (let i = 0; i < n; i++) smoke(cx + rand(-40, 40), VH + rand(10, 40), { vx: rand(-90, 90) * (0.6 + amt), vy: rand(-260, -140) * (0.6 + amt), size: rand(90, 160), grow: rand(220, 380), life: -i * 0.025, max: rand(2.6, 4), a: 0.2 + amt * 0.12, drag: 1.25, tint: tintOf(brand) });
}
function ash(x, y, floor, k) { for (let i = 0; i < 6; i++) S.parts.push({ k: 'ash', x: x + rand(-2, 2) * k, y, vx: rand(-8, 8) * k, vy: rand(-12, 0) * k, floor, g: 240 * k, life: 0, max: 2.4, size: rand(0.8, 1.6) * k, rot: rand(0, 6) }); }
function sparks(x, y, n, k) { for (let i = 0; i < n; i++) S.parts.push({ k: 'spark', x, y, vx: rand(-40, 40) * k, vy: rand(-60, -10) * k, g: 160 * k, life: 0, max: rand(0.2, 0.5), size: rand(0.8, 1.6) * k }); }
function updateParts(dt) {
  for (const q of S.parts) {
    q.life += dt; if (q.life < 0) continue;
    if (q.k === 'smoke') { const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy = q.vy * d - 6 * dt * (q.curl || 1); q.x += (q.vx + Math.sin(q.life * 1.8 + q.wob) * 5 * (q.curl || 1)) * dt; q.y += q.vy * dt; q.size += q.grow * dt; q.grow *= Math.exp(-0.3 * dt); }
    else if (q.k === 'ash') { if (q.y < q.floor) { q.vy += q.g * dt; q.x += q.vx * dt; q.y = Math.min(q.floor, q.y + q.vy * dt); q.rot += dt * 6; } }
    else { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  }
  S.parts = S.parts.filter((q) => q.life < q.max);
  if (S.parts.length > 900) S.parts.splice(0, S.parts.length - 900);
  for (const h of S.hearts) h.life += dt;
  S.hearts = S.hearts.filter((h) => h.life < 1.6);
}
function drawParts(c) {
  for (const q of S.parts) {
    if (q.life < 0) continue;
    const k = q.life / q.max;
    if (q.k === 'smoke') {
      const a = q.a * (k < 0.12 ? k / 0.12 : (1 - k) ** 1.4);
      if (a < 0.005) continue;
      c.globalAlpha = a; c.drawImage(smokeSprite(q.v, q.tint), q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    } else if (q.k === 'ash') { c.globalAlpha = 1 - k; c.fillStyle = '#9a958e'; c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillRect(-q.size, -q.size * 0.6, q.size * 2, q.size * 1.2); c.restore(); }
    else { c.globalAlpha = 1 - k; ellipse(c, q.x, q.y, q.size, q.size, '#ffcf70'); }
  }
  c.globalAlpha = 1;
}

// ---------- 每帧更新 ----------
const handsOX = () => S.view.ox + (S.view.visW - VW) / 2;
function myTip() { return S.fp.tipW && [S.fp.tipW[0] + handsOX(), S.fp.tipW[1]]; }
function myFlame() { return S.fp.flameW && [S.fp.flameW[0] + handsOX(), S.fp.flameW[1]]; }

function update(dt) {
  S.t += dt;
  const m = me();
  S.par += (S.parT - S.par) * Math.min(1, dt * 3);
  if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 1.8);
  if (S.place === 'shop' && m) shopLook(dt);
  for (const p of S.players.values()) {
    if (p.place === 'shop') { p.rx += (p.x - p.rx) * Math.min(1, dt * 3); p.ry += (p.y - p.ry) * Math.min(1, dt * 3); }
    if (p.cig === 2) {
      const r = p.puffing ? BURN_PUFF : BURN_IDLE;
      p.burn = Math.min(1, p.burn + r * dt); p.ash = Math.min(1, p.ash + r * dt * 0.85);
      if (p.place === S.place) {
        p.smokeAcc = (p.smokeAcc || 0) + dt;
        const every = p.puffing ? 0.06 : 0.12;
        while (p.smokeAcc > every) {
          p.smokeAcc -= every;
          if (p === m) { const tip = myTip(); if (tip) wisp(tip[0], tip[1], 2.6, p.brand); }
          else if (p._A?.tip) wisp(p._A.tip[0], p._A.tip[1], p._A.k, p.brand);
        }
        if (CIG[p.brand]?.crackle && p.puffing && Math.random() < dt * 8) { const tip = p === m ? myTip() : p._A?.tip; if (tip) sparks(tip[0], tip[1], 1, p === m ? 2 : p._A.k * 0.6); }
      }
    }
    if (p.puffing) p.puffT += dt;
    if (p.flame > 0) p.flame -= dt;
    if (p.sipT > 0) p.sipT -= dt;
    if (p.bubble && (p.bubble.t -= dt) <= 0) p.bubble = null;
  }
  if (m && outside()) updateMine(m, dt);
  updateFP(S.fp, dt);
  if (S.place === 'street') updateTraffic(S.traffic, dt, (lane) => Snd.car(lane ? 0.7 : 0.35));
  updateParts(dt);
  if (S.glitch > 0 && (S.glitch -= dt) <= 0) { const f = S.glitchThen; S.glitchThen = null; f?.(); }
  ensureLayers();
}

function updateMine(m, dt) {
  const L = S.light;
  if (L) {
    L.t += dt;
    if (!L.clicked && L.t > 0.45) { L.clicked = true; Snd.click(); const f = myFlame(); if (f) sparks(f[0], f[1], 6, 2.2); }
    if (!L.done && L.t > 0.7) {
      L.done = true;
      L.ok = Math.random() < (S.fails >= 3 ? 0.85 : 0.45);
      send({ t: 'act', a: 'flick', ok: L.ok });
      if (L.ok) { S.fp.flame = 1.0; S.fails = 0; Snd.flame(); setTimeout(() => { if (m.cig === 1) { m.cig = 2; renderBar(); } }, 350); }
      else {
        S.fails++; Snd.click(0.6);
        const someone = [...S.players.values()].some((p) => p !== m && p.place === S.place && p.cig === 2);
        if (S.fails === 2) toast(someone ? '打火机不太灵…点一个正在抽的人，借个火' : '打火机不太灵，再按一次「点火」');
      }
    }
    if (L.done && L.t > (L.ok ? 1.7 : 1.6)) { S.light = null; S.fp.lighterT = 0; if (!m.puffing) S.fp.raiseT = 0; }
  }
  if (m.cig === 2) {
    if (m.puffing && m.puffT > 3.6) { endPuff(); m.bubble = { text: '咳咳咳', t: 1.8 }; }
    if (m.ash > 0.45) flickAsh(true);
    if (m.burn >= 1 && !S.stubbing) stub(true);
    if (S.t - (m.lastSync || 0) > 2) { m.lastSync = S.t; send({ t: 'sync', burn: +m.burn.toFixed(3), ash: +m.ash.toFixed(3) }); }
  }
}

// 店里：左右转头
function shopLook(dt) {
  let v = 0;
  if (S.keys.has('ArrowLeft') || S.keys.has('KeyA') || S.panHeld === -1) v -= 1;
  if (S.keys.has('ArrowRight') || S.keys.has('KeyD') || S.panHeld === 1) v += 1;
  const maxYaw = Math.max(0, PW - S.view.visW);
  if (v) { S.yaw += v * 900 * dt; S.yawTarget = undefined; S.afterYaw = null; }
  else if (S.yawTarget !== undefined) { S.yaw += (S.yawTarget - S.yaw) * Math.min(1, dt * 6); if (Math.abs(S.yawTarget - S.yaw) < 2) { S.yaw = S.yawTarget; S.yawTarget = undefined; const f = S.afterYaw; S.afterYaw = null; f?.(); } }
  // 彩蛋：在最左边一直往墙里挤
  const pushing = S.yaw <= 0.5 && (v < 0 || S.dragPushLeft);
  if (pushing) S.wallPush += dt; else S.wallPush = Math.max(0, S.wallPush - dt * 0.5);
  if (S.wallPush > 2.4 && !S.glitch) { S.wallPush = 0; glitchTo(() => goPlace('street'), '……你卡进墙里，掉到楼下街边了'); }
  S.yaw = clamp(S.yaw, 0, maxYaw);
  if (performance.now() - S.lastMoveSent > 400) { const x = Math.round(yawToServerX(S.yaw + S.view.visW / 2) * 10) / 10; if (x !== S.lastX) { S.lastX = x; S.lastMoveSent = performance.now(); send({ t: 'move', x, y: Math.round(S.myY * 10) / 10 }); } }
}

// ---------- 渲染 ----------
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = innerWidth, ch = innerHeight;
  if (cvs.width !== Math.round(cw * dpr) || cvs.height !== Math.round(ch * dpr)) { cvs.width = Math.round(cw * dpr); cvs.height = Math.round(ch * dpr); }
  const minW = S.place === 'shop' ? 900 : 1040;
  let s = Math.max(cw / VW, ch / VH); if (cw / s < minW) s = cw / minW;
  const visW = cw / s, visH = ch / s;
  const ox = S.place === 'shop' ? clamp(S.yaw, 0, PW - visW) : (VW - visW) / 2;
  const oy = visH <= VH ? VH - visH : -(visH - VH);
  Object.assign(S.view, { s, visW, visH, ox, oy, dpr });
}

const dummy = { look: { hoodie: 0, skin: 0, hair: 0, pants: 0 }, cig: 0 };
// 底栏会盖住画面最下面一截：把手整体抬到底栏上方
function liftAmt() { const bar = $('#bar'); return clamp(((bar?.offsetHeight || 64) + 22) / S.view.s, 0, 170); }

function render() {
  layout();
  const { s, ox, oy, dpr, visW } = S.view;
  const m = me(), lie = !!(m && m.pose === 'lie'), n = S.sky.night;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = S.place === 'shop' && !lie ? '#cfd3d6' : lie ? S.sky.top : mix('#3a4a42', '#0c100e', n);
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.setTransform(s * dpr, 0, 0, s * dpr, -ox * s * dpr, -oy * s * dpr);
  const pb = -S.par * 24, pn = -S.par * 44, ph = S.par * 12;
  const here = [...S.players.values()].filter((p) => p.place === S.place && p !== m);
  let placed = [];

  if (S.place === 'shop' && !lie) {
    if (S.far) ctx.drawImage(S.far, 0, 0, PW, VH);
    drawShopFloor(ctx, ox, visW);
    placed = here.map((p) => { const [x, y, H] = shopSpot({ x: p.rx, y: p.ry }); return { p, x, y, H }; }).sort((a, b) => a.y - b.y);
    for (const o of placed) o.p._A = drawPerson(ctx, o.p, o.x, o.y, o.H, S.t, 0.1);
    drawParts(ctx);
    glowPass(placed);
    ctx.save(); ctx.translate(handsOX(), 0);
    drawFP(ctx, S.fp, m || dummy, S.t, 'stand', { night: 0.05, lift: liftAmt(), par: ph, idleHand: false });
    ctx.restore();
  } else {
    if (S.far) ctx.drawImage(S.far, -MARGIN + pb, 0, VW + MARGIN * 2, VH);
    ctx.save(); ctx.translate(pb, 0);
    if (!lie && S.place !== 'street') drawVistaDynamic(ctx, S.dyn, S.sky, S.t, true);
    if (!lie && S.place === 'street') { drawTraffic(ctx, S.traffic, n); for (const [i, [bx, by]] of S.blinkers.entries()) if ((S.t * 0.8 + i * 0.37) % 1.6 < 0.3) glow(ctx, bx, by, 8, 'rgba(255,60,60,.9)'); }
    ctx.restore();
    if (S.place === 'street' && !lie) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(pb, 0); drawTrafficLights(ctx, S.traffic, n); ctx.restore(); }
    if (S.near && !lie) ctx.drawImage(S.near, -MARGIN + pn, 0, VW + MARGIN * 2, VH);
    if (!lie) {
      placed = here.map((p) => { const [x, y, H] = S.place === 'street' ? slotPos(Math.max(0, p.slot), 'street') : roofSlot(Math.max(0, p.slot)); return { p, x: x + pn, y, H }; }).sort((a, b) => a.y - b.y);
      for (const o of placed) o.p._A = drawPerson(ctx, o.p, o.x, o.y, o.H, S.t, n);
    }
    drawParts(ctx);
    glowPass(placed);
    if (!lie && S.place !== 'street') { ctx.save(); ctx.translate(pn, 0); drawVistaDynamic(ctx, S.dyn, S.sky, S.t, false); ctx.restore(); }
    if (m) {
      ctx.save(); ctx.translate(handsOX(), 0);
      const ashtray = !lie ? [ASHTRAY.x + ASHTRAY.w / 2 + pn - handsOX() + 10, ASHTRAY.y + 30] : null;
      drawFP(ctx, S.fp, m, S.t, lie ? 'lie' : 'stand', { night: n, lift: liftAmt(), par: ph, ashtray });
      ctx.globalCompositeOperation = 'lighter';
      fpGlow(ctx, S.fp, m);
      if (S.fp.flame > 0 && S.fp.flameW) glow(ctx, S.fp.flameW[0], S.fp.flameW[1], 260, `rgba(255,160,70,${0.18 + 0.1 * Math.sin(S.t * 30)})`);
      ctx.restore();
    }
  }

  // ---------- 屏幕空间的后期 ----------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = cvs.width, H = cvs.height;
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${S.place === 'shop' ? 0.18 : 0.25 + 0.25 * n})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (m && m.puffing) { const g = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.9); g.addColorStop(0, 'rgba(255,130,50,.14)'); g.addColorStop(1, 'rgba(255,130,50,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.translate((S.t * 997) % 256, (S.t * 613) % 256); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  if (S.glitch > 0) drawGlitch(W, H);
  if (S.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${S.fade})`; ctx.fillRect(0, 0, W, H); }

  // ---------- 文字层 ----------
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const SX = (x) => (x - ox) * s, SY = (y) => (y - oy) * s;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = (px, w = 400) => `${w} ${px}px -apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif`;
  if (!lie) for (const o of placed) {
    const p = o.p, A = p._A; if (!A) continue;
    const nx = SX(A.head[0]), ny = SY(A.head[1]) - 10;
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
    ctx.font = font(12.5, 500); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(p.name, nx, ny);
    ctx.font = font(10.5); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(`那边 ${fmtHour(localHour(p.tz))}`, nx, ny + 14);
    ctx.shadowBlur = 0;
    if (p.bubble && !S.muted.has(p.id)) bubble(p.bubble, nx, ny - 12, font);
    if (m && m.cig === 1 && outside() && p.cig === 2) { ctx.font = font(16); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 5); ctx.fillText('🔥', nx, ny - 34); ctx.globalAlpha = 1; }
  }
  if (m && m.bubble) bubble(m.bubble, innerWidth / 2, innerHeight * 0.58, font);
  for (const h of S.hearts) { ctx.globalAlpha = 1 - h.life / 1.6; ctx.fillStyle = '#ff8a6a'; ctx.font = font(22); ctx.fillText('♥', SX(h.x), SY(h.y) - h.life * 40); ctx.globalAlpha = 1; }
  if (S.place === 'shop' && S.hoverZone && !S.drag?.moved) { const z = ZONES[S.hoverZone]; ctx.font = font(13, 600); const tx = SX((z.x0 + z.x1) / 2), ty = SY(z.y1) + 20; const tw = ctx.measureText(z.label).width + 26; ctx.fillStyle = 'rgba(20,22,34,.85)'; ctx.beginPath(); ctx.roundRect(tx - tw / 2, ty - 15, tw, 30, 15); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(z.label, tx, ty + 1); }
}
function glowPass(placed) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const o of placed) {
    const p = o.p, A = p._A; if (!A?.tip) continue;
    if (p.cig === 2) glow(ctx, A.tip[0], A.tip[1], (p.puffing ? 9 : 5) * A.k, p.puffing ? 'rgba(255,140,60,.45)' : 'rgba(255,110,50,.28)');
    if (p.flame > 0 && A.flame) glow(ctx, A.flame[0], A.flame[1], 16 * A.k, 'rgba(255,170,80,.4)');
  }
  ctx.restore();
}
function bubble(b, x, y, font) {
  const a = Math.min(1, b.t / 0.4);
  ctx.font = font(14);
  const tw = Math.min(ctx.measureText(b.text).width, 280) + 22, th = 32, bx = x - tw / 2, by = y - th;
  ctx.globalAlpha = a; ctx.fillStyle = 'rgba(248,244,236,.96)';
  ctx.beginPath(); ctx.roundRect(bx, by, tw, th, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, by + th); ctx.lineTo(x + 5, by + th); ctx.lineTo(x, by + th + 6); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillText(b.text, x, by + th / 2 + 1, 280);
  ctx.globalAlpha = 1;
}
function drawGlitch(W, H) {
  for (let i = 0; i < 12; i++) { const y = Math.random() * H, h = rand(6, 60) * S.view.dpr, dx = rand(-90, 90) * S.view.dpr; ctx.drawImage(cvs, 0, y, W, h, dx, y, W, h); }
  ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,0,90' : '0,255,220'},.14)`; ctx.fillRect(0, 0, W, H);
}
let lastT = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; update(dt); render(); requestAnimationFrame(frame); }

// ---------- 动作 ----------
function send(msg) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(msg)); }
const sticks = (m) => (m?.loose?.length || 0) + (m?.pack?.n || 0);
function mainAction() {
  const m = me(); if (!m) return;
  if (!outside()) { toast('店里禁烟。最右边那扇门上去就是天台'); return; }
  if (m.cig === 2) return stub(false);
  if (m.cig === 1) return startLight();
  if (S.awaitDraw) return;
  if (!sticks(m)) { toast('没烟了。回店里拿一包，或者点一个人跟 TA 要一根'); return; }
  S.awaitDraw = true; setTimeout(() => (S.awaitDraw = false), 1500);
  send({ t: 'act', a: 'draw' });
}
function startLight() {
  const m = me(); if (!m || m.cig !== 1) return;
  if (S.light && !S.light.done) return;
  S.light = { t: S.light ? 0.25 : 0 };
  S.fp.raiseT = 1; S.fp.lighterT = 1;
}
function startPuff() {
  const m = me(); if (!m || m.cig !== 2 || m.puffing || !outside()) return;
  m.puffing = true; m.puffT = 0; S.fp.raiseT = 1;
  send({ t: 'act', a: 'puff' });
  Snd.inhaleStart(!!CIG[m.brand]?.crackle);
  document.querySelector('[data-act="puff"]')?.classList.add('held');
}
function endPuff() {
  const m = me(); if (!m || !m.puffing) return;
  const amt = clamp(m.puffT / 2.4, 0.15, 1);
  m.puffing = false; S.fp.raiseT = S.light ? 1 : 0;
  send({ t: 'act', a: 'exhale', amt: +amt.toFixed(2) });
  Snd.inhaleStop();
  setTimeout(() => { exhaleFP(amt, m.brand); Snd.exhale(amt); }, 380);
  document.querySelector('[data-act="puff"]')?.classList.remove('held');
}
function flickAsh(auto) {
  const m = me(); if (!m || m.cig !== 2 || m.ash < 0.04) return;
  S.fp.flickT = 0;
  setTimeout(() => { const tip = myTip(); if (tip) ash(tip[0], tip[1], VH + 80, 3); }, 90);
  m.ash = 0; send({ t: 'act', a: 'ash' });
  if (!auto) Snd.tap();
}
function stub(auto) {
  const m = me(); if (!m || !m.cig || S.stubbing) return;
  if (m.puffing) endPuff();
  const lie = m.pose === 'lie';
  S.stubbing = true; S.light = null; S.fp.lighterT = 0; S.fp.raiseT = 0;
  S.fp.stubT = lie ? 9 : 0;
  setTimeout(() => {
    S.stubbing = false;
    const counted = m.cig === 2 && m.burn > 0.15;
    const tip = myTip(); if (tip) sparks(tip[0], tip[1], 6, 2);
    m.cig = 0; m.burn = 0; m.ash = 0; m.brand = null;
    send({ t: 'act', a: 'stub' });
    Snd.tap(0.6);
    if (counted) {
      const d = todayKey(), mine = store.get('smoke.mine', { date: d, n: 0 });
      if (mine.date !== d) { mine.date = d; mine.n = 0; }
      mine.n++; store.set('smoke.mine', mine);
      if (auto) toast('一根抽完了。再待会儿，或者再来一根');
    }
    renderBar(); renderMe();
  }, lie ? 60 : 520);
}
function sip() { const m = me(); if (!m || !m.item) return; S.fp.sipT = 0; Snd.sip(); send({ t: 'act', a: 'sip' }); }
function goPlace(to) { const m = me(); if (!m) return; if (m.puffing) endPuff(); S.light = null; send({ t: 'place', to }); }
function setPose(v) { const m = me(); if (!m) return; m.pose = v; send({ t: 'pose', v }); S.fp = makeFP(); ensureLayers(true); renderBar(); }
function glitchTo(fn, msg) { S.glitch = 0.9; S.glitchThen = () => { fn(); if (msg) setTimeout(() => toast(msg, 4000), 300); }; Snd.glitch(); }

// ---------- 店里：转头看货架、拿东西 ----------
function lookAt(zone, then) { const z = ZONES[zone]; S.yawTarget = clamp((z.x0 + z.x1) / 2 - S.view.visW / 2, 0, PW - S.view.visW); S.afterYaw = then; }
function zoneAt(wx, wy) { for (const [k, z] of Object.entries(ZONES)) if (wx >= z.x0 && wx <= z.x1 && wy >= z.y0 && wy <= z.y1) return k; return null; }
function openZone(k) {
  const m = me(); if (!m) return;
  if (k === 'door') return openVistas();
  let html = '';
  if (k === 'cigs') {
    html = `<header><b>烟柜</b><small>来自世界各地（牌子都是编的）。拿一包会换掉口袋里那包。</small></header><div class="grid packs">` +
      CIGS.map((b) => `<button data-take="pack:${b.id}" class="${m.pack?.id === b.id ? 'on' : ''}"><i class="pk" style="--a:${b.pack[0]};--b:${b.pack[1]}"></i><span><em>${esc(b.region)}</em><b>${esc(b.name)}</b><small>${esc(b.note)}</small></span></button>`).join('') + '</div>';
  } else {
    const list = ITEMS.filter((i) => i.shelf === k);
    html = `<header><b>${k === 'fridge' ? '冰柜' : '零食架'}</b><small>每次只能拿一样，拿新的会把手上的放回去。</small></header><div class="grid items">` +
      list.map((i) => `<button data-take="item:${i.id}" class="${m.item === i.id ? 'on' : ''}"><img src="${itemIconURL(i.id)}" alt=""><b>${esc(i.name)}</b></button>`).join('') + '</div>' +
      (m.item ? `<footer><button data-take="drop">把手上的${esc(ITEM[m.item].name)}放回去</button></footer>` : '');
  }
  showPicker(html);
}
function openVistas() {
  const st = S.stats?.places || {};
  const html = `<header><b>上天台</b><small>每个天台对着不一样的风景，天色跟着你那边的时间（现在 ${fmtHour(hourNow())}）。</small></header><div class="grid vistas">` +
    VISTAS.map((v) => `<button data-go="roof:${v.id}" class="${S.place === 'roof:' + v.id ? 'on' : ''}"><i class="vt vt-${v.id}"></i><span><b>${esc(v.name)}</b><small>${esc(v.note)}</small><em>${st['roof:' + v.id] || 0} 人在抽</em></span></button>`).join('') + '</div>' +
    (S.place !== 'shop' ? '<footer><button data-go="shop">回店里</button></footer>' : '');
  showPicker(html);
}
function showPicker(html) { const P = $('#picker'); P.innerHTML = html + '<button class="x" data-close>×</button>'; P.classList.remove('hidden'); }
$('#picker').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return $('#picker').classList.add('hidden');
  const g = e.target.closest('[data-go]');
  if (g) { $('#picker').classList.add('hidden'); if (g.dataset.go !== S.place) goPlace(g.dataset.go); return; }
  const b = e.target.closest('[data-take]'); if (!b) return;
  const [kind, id] = b.dataset.take.split(':');
  send({ t: 'take', kind, id });
  Snd.rustle();
  $('#picker').classList.add('hidden');
  if (kind === 'pack') toast(`拿了一包 ${CIG[id].name}（${CIG[id].region}），20 根`);
  if (kind === 'item') toast(`拿了${ITEM[id].name}`);
});

// ---------- 别人：要烟、借火、屏蔽 ----------
function openPerson(p, ev) {
  const m = me(); if (!m) return;
  const M = $('#personMenu');
  const canFire = outside() && m.cig === 1 && p.cig === 2;
  const has = sticks(p) > 0, muted = S.muted.has(p.id);
  const gear = [p.item ? `手上：${ITEM[p.item]?.name}` : '', p.pack ? `口袋：${CIG[p.pack.id]?.name}（${CIG[p.pack.id]?.region}）` : ''].filter(Boolean).join(' · ');
  M.innerHTML = `<b>${esc(p.name)}</b><small>那边现在 ${fmtHour(localHour(p.tz))}${gear ? ' · ' + esc(gear) : ''}</small>
    <div class="row"><button data-p="ask" ${has ? '' : 'disabled'}>${has ? '要根烟' : 'TA 没烟了'}</button>${canFire ? '<button data-p="fire" class="hot">借个火</button>' : ''}<button data-p="mute">${muted ? '取消屏蔽' : '屏蔽 TA 的消息'}</button></div>`;
  M.dataset.id = p.id; M.classList.remove('hidden');
  const r = M.getBoundingClientRect();
  M.style.left = `${clamp(ev.clientX - r.width / 2, 8, innerWidth - r.width - 8)}px`;
  M.style.top = `${clamp(ev.clientY - r.height - 16, 60, innerHeight - r.height - 90)}px`;
}
$('#personMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  const id = $('#personMenu').dataset.id, p = S.players.get(id);
  $('#personMenu').classList.add('hidden');
  if (!p) return;
  if (b.dataset.p === 'ask') { send({ t: 'ask', to: id }); toast(`问 ${p.name} 要根烟…`); }
  if (b.dataset.p === 'fire') send({ t: 'fire', to: id });
  if (b.dataset.p === 'mute') { if (S.muted.has(id)) S.muted.delete(id); else S.muted.add(id); store.set('smoke.muted', [...S.muted]); toast(S.muted.has(id) ? `不再显示 ${p.name} 的消息` : `重新显示 ${p.name} 的消息`); renderLog(); }
});
function showAsk(fromId) {
  const p = S.players.get(fromId); if (!p) return;
  const el = document.createElement('div');
  el.className = 'ask'; el.dataset.from = fromId;
  el.innerHTML = `<span><b></b> 想跟你要根烟<small>你还剩 ${sticks(me())} 根</small></span><button data-a="1" class="hot">给一根</button><button data-a="0">不给</button><i class="bar"></i>`;
  el.querySelector('b').textContent = p.name;
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; send({ t: 'answer', to: fromId, give: b.dataset.a === '1' }); el.remove(); });
  $('#asks').appendChild(el); Snd.give();
}

// ---------- 消息 ----------
function addLog(e) { S.log.push(e); if (S.log.length > 40) S.log.shift(); renderLog(); }
function renderLog() {
  const items = S.log.filter((e) => !S.muted.has(e.id)).slice(-6);
  $('#log').innerHTML = items.map((e) => `<p class="${e.id === S.meId ? 'mine' : ''}"><em>${esc(placeName(e.place))}</em><b>${esc(e.name)}</b>${esc(e.text)}</p>`).join('');
  $('#log').classList.toggle('hidden', !items.length);
}
function sendSay(text) {
  text = String(text || '').trim().slice(0, 60); if (!text) return;
  if (S.t - S.lastSay < 1.8) { toast('说慢一点'); return; }
  S.lastSay = S.t; send({ t: 'say', text });
}
function openChat() { $('#chat').classList.remove('hidden'); $('#chatInput').focus(); }
function closeChat() { $('#chat').classList.add('hidden'); $('#chatInput').blur(); }
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendSay($('#chatInput').value); $('#chatInput').value = ''; closeChat(); });
$('#chatPhrases').innerHTML = PHRASES.map((t) => `<button type="button">${esc(t)}</button>`).join('');
$('#chatPhrases').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { sendSay(b.textContent); closeChat(); } });

// ---------- 界面 ----------
const todayKey = () => new Date().toLocaleDateString('sv-SE');
function renderMe() {
  const m = me(); if (!m) return;
  const mine = store.get('smoke.mine', { date: todayKey(), n: 0 });
  const n = mine.date === todayKey() ? mine.n : 0;
  const pocket = m.pack ? `${CIG[m.pack.id].name}（${CIG[m.pack.id].region}）剩 ${m.pack.n} 根` : '没有烟';
  const loose = m.loose?.length ? ` + 别人给的 ${m.loose.length} 根` : '';
  $('#me').innerHTML = `你是 <b></b><br>口袋：${esc(pocket + loose)}${m.item ? ` · 手上：${esc(ITEM[m.item].name)}` : ''}<br>今天抽了 ${n} 根${n ? `，省下 ¥${(n * 1.25).toFixed(2)}` : ''}`;
  $('#me b').textContent = m.name;
}
function btn(act, label, key, cls = '', disabled = false) { return `<button class="act ${cls}" data-act="${act}" ${disabled ? 'disabled' : ''}><span class="k">${key}</span><span class="l">${esc(label)}</span></button>`; }
function renderBar() {
  const m = me(); if (!m) return;
  let h = '';
  if (S.place === 'shop') {
    h += btn('zone:cigs', '烟柜', '1') + btn('zone:fridge', '冰柜', '2') + btn('zone:snack', '零食', '3');
    if (m.item) h += btn('sip', ITEM[m.item].verb, 'E');
    h += btn('chat', '说话', 'T') + btn('up', '上天台', 'Q', 'primary');
  } else {
    const lit = m.cig === 2;
    const main = m.cig === 2 ? '掐灭' : m.cig === 1 ? '点火' : sticks(m) ? '抽一根' : '没烟了';
    h += btn('main', main, 'F', lit ? '' : 'primary', !m.cig && !sticks(m));
    h += btn('puff', '吸一口', '空格', 'hold', !lit) + btn('ash', '弹烟灰', 'X', '', !lit);
    if (m.item) h += btn('sip', ITEM[m.item].verb, 'E');
    h += btn('chat', '说话', 'T');
    if (m.pose === 'lie') h += btn('getup', '起来', 'Q');
    else if (S.place === 'street') h += btn('in', '回店里', 'Q');
    else h += btn('vistas', '换个天台', 'Q');
  }
  $('#bar').innerHTML = h;
  $('#panL').classList.toggle('hidden', S.place !== 'shop'); $('#panR').classList.toggle('hidden', S.place !== 'shop');
}
function doAct(a) {
  if (a.startsWith('zone:')) { const z = a.slice(5); return lookAt(z, () => openZone(z)); }
  ({ main: mainAction, ash: () => flickAsh(false), sip, chat: openChat, up: () => lookAt('door', openVistas), in: () => goPlace('shop'), vistas: openVistas, getup: () => { setPose('stand'); toast('拍拍身上的灰，站起来了'); } })[a]?.();
}
$('#bar').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && b.dataset.act !== 'puff') doAct(b.dataset.act); });
$('#bar').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-act="puff"]'); if (b && !b.disabled) { e.preventDefault(); b.setPointerCapture?.(e.pointerId); startPuff(); } });
for (const t of ['pointerup', 'pointercancel']) $('#bar').addEventListener(t, (e) => { if (e.target.closest('[data-act="puff"]')) endPuff(); });
for (const [id, d] of [['#panL', -1], ['#panR', 1]]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); S.panHeld = d; el.setPointerCapture?.(e.pointerId); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => { S.panHeld = 0; });
}
function renderHeader() {
  const st = S.stats;
  $('#roomName').textContent = `深夜便利店 #${S.room || 1}`;
  $('#placeName').textContent = placeName(S.place);
  const here = [...S.players.values()].filter((p) => p.place === S.place).length;
  $('#stats').innerHTML = `这里 <span>${here}</span> 人 · 全站 <span>${st?.total ?? S.players.size}</span> · 今天一共抽了 <span>${st?.today ?? 0}</span> 根`;
  $('#clock').textContent = `你那边 ${fmtHour(hourNow())}`;
}
setInterval(renderHeader, 10000);

// ---------- 网络 ----------
function mkPlayer(d) { return { ...d, rx: d.x, ry: d.y, face: d.face || 1, puffing: false, puffT: 0, flame: 0, sipT: 0, bubble: null, loose: d.loose || [] }; }
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  ws.onopen = () => { $('#conn').classList.add('hidden'); send({ t: 'hello', tz: -new Date().getTimezoneOffset() }); };
  ws.onclose = () => { if (S.ws === ws) { $('#conn').classList.remove('hidden'); setTimeout(connect, 1500); } };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
}
function enterPlace(to) {
  S.place = to; S.fp = makeFP(); S.light = null; S.parts = []; S.wallPush = 0; S.fade = 1; S.traffic = makeTraffic();
  $('#picker').classList.add('hidden'); $('#personMenu').classList.add('hidden');
  if (to === 'shop') { S.yaw = PW - 1200; S.lastX = null; }
  layout(); ensureLayers(true);
  if (S.entered) Snd.ambient(ambientKey(to), S.sky.night > 0.5);
  renderBar(); renderHeader(); renderMe();
  if (to.startsWith('roof')) hintOnce('smoke.hint.roof', '「抽一根」→「点火」→ 按住「吸一口」。点别人可以要烟、借火');
}
function onMsg(m) {
  const p = m.id ? S.players.get(m.id) : null, mine = m.id === S.meId;
  switch (m.t) {
    case 'welcome': {
      S.meId = m.id; S.room = m.room; S.stats = m.stats;
      S.players.clear(); for (const d of m.players) S.players.set(d.id, mkPlayer(d));
      S.log = m.log.map((e) => ({ ...e })); renderLog();
      enterPlace('shop'); S.yaw = 700;
      hintOnce('smoke.hint.shop', '左右拖动画面环顾四周 · 点货架拿东西 · 最右边的门上天台');
      // 开发用：?pack=brume&item=beer&place=roof:sea 进来直接准备好
      const qp = new URLSearchParams(location.search);
      if (qp.get('pack')) send({ t: 'take', kind: 'pack', id: qp.get('pack') });
      if (qp.get('item')) send({ t: 'take', kind: 'item', id: qp.get('item') });
      if (qp.get('place')) setTimeout(() => goPlace(qp.get('place')), 150);
      break;
    }
    case 'join': S.players.set(m.p.id, mkPlayer(m.p)); renderHeader(); break;
    case 'leave': S.players.delete(m.id); $(`.ask[data-from="${m.id}"]`)?.remove(); renderHeader(); break;
    case 'stats': S.stats = m.stats; renderHeader(); break;
    case 'move': if (p) { p.x = m.x; p.y = m.y; } break;
    case 'place': {
      if (!p) break;
      Object.assign(p, { place: m.to, slot: m.slot, x: m.x, y: m.y, rx: m.x, ry: m.y, cig: 0, burn: 0, ash: 0, puffing: false, pose: 'stand' });
      if (mine) { p.brand = null; enterPlace(m.to); } else renderHeader();
      break;
    }
    case 'gear': if (p) { p.item = m.item; p.pack = m.pack; p.loose = m.loose; if (mine) { renderMe(); renderBar(); } } break;
    case 'pose': if (p) p.pose = m.v; break;
    case 'sync': if (p) { p.burn = m.burn; p.ash = m.ash; } break;
    case 'say': if (p && !S.muted.has(m.id) && p.place === S.place) p.bubble = { text: m.text, t: 5 }; addLog(m); break;
    case 'act': {
      if (!p) break;
      if (mine) { if (m.a === 'draw') { S.awaitDraw = false; p.cig = 1; p.brand = m.brand; p.burn = 0; p.ash = 0; S.fp.drawT = 0; Snd.rustle(); renderBar(); renderMe(); } break; }
      const vis = p.place === S.place, A = p._A, k = A?.k || 2;
      switch (m.a) {
        case 'draw': p.cig = 1; p.brand = m.brand; p.burn = 0; p.ash = 0; break;
        case 'flick': if (vis && A?.tip) { sparks(A.tip[0], A.tip[1], 4, k * 0.5); Snd.click(0.3); } if (m.ok) { p.cig = 2; p.flame = 0.8; if (vis) Snd.flame(0.3); } break;
        case 'puff': p.puffing = true; p.puffT = 0; break;
        case 'exhale': p.puffing = false; if (vis && A) { exhaleAt(A.mouth[0], A.mouth[1], p.face, m.amt ?? 0.5, k, p.brand); Snd.exhale(m.amt ?? 0.5, 0.3); } break;
        case 'ash': if (vis && A?.tip) ash(A.tip[0], A.tip[1], A.feet[1], k * 0.5); p.ash = 0; break;
        case 'stub': if (vis && A?.tip) ash(A.tip[0], A.tip[1], A.feet[1], k * 0.5); p.cig = 0; p.burn = 0; p.ash = 0; p.puffing = false; p.brand = null; break;
        case 'sip': p.sipT = 1; break;
      }
      break;
    }
    case 'ask': showAsk(m.from); break;
    case 'askGone': $(`.ask[data-from="${m.from}"]`)?.remove(); break;
    case 'asked': { const a = S.players.get(m.from); if (a && a.place === S.place && a.id !== S.meId) a.bubble = { text: '能给根烟吗？', t: 3 }; break; }
    case 'gave': {
      const a = S.players.get(m.from), b = S.players.get(m.to);
      if (a && a.id !== S.meId && a.place === S.place) a.bubble = { text: '拿去', t: 2.5 };
      heartBetween(a, b);
      if (m.to === S.meId) { toast(`${a?.name ?? '有人'} 给了你一根 ${CIG[m.brand]?.name}（${CIG[m.brand]?.region}）`); Snd.give(); }
      if (m.from === S.meId) toast(`给了 ${b?.name ?? 'TA'} 一根`);
      break;
    }
    case 'refused': {
      const a = S.players.get(m.from);
      if (m.why === 'no' && a && a.place === S.place && a.id !== S.meId) a.bubble = { text: '不给', t: 2.5 };
      if (m.to === S.meId) toast({ no: `${a?.name ?? 'TA'} 摇了摇头`, empty: `${a?.name ?? 'TA'} 也没烟了`, timeout: `${a?.name ?? 'TA'} 没理你` }[m.why] || '没要到');
      break;
    }
    case 'fire': {
      const a = S.players.get(m.from), b = S.players.get(m.to);
      if (!a || !b) break;
      a.cig = 2; a.flame = 0.5; heartBetween(a, b);
      if (a.id === S.meId) { S.fails = 0; S.light = null; S.fp.lighterT = 0; S.fp.raiseT = 1; Snd.flame(); toast(`凑过去跟 ${b.name} 对了个火`); setTimeout(() => { if (!a.puffing) S.fp.raiseT = 0; }, 1000); renderBar(); }
      else if (b.id === S.meId) { Snd.flame(0.5); toast(`${a.name} 凑过来借了个火`); }
      break;
    }
  }
}
function heartBetween(a, b) {
  if (!a || !b || a.place !== S.place) return;
  const mine = [S.view.ox + S.view.visW / 2, 760];
  const pa = a.id === S.meId ? mine : a._A?.head, pb = b.id === S.meId ? mine : b._A?.head;
  if (pa && pb) S.hearts.push({ x: (pa[0] + pb[0]) / 2, y: Math.min(pa[1], pb[1]) - 10, life: 0 });
}

// ---------- 鼠标和触摸 ----------
const toWorld = (ev) => [S.view.ox + ev.clientX / S.view.s, S.view.oy + ev.clientY / S.view.s];
function personAt(wx, wy) {
  const m = me();
  return [...S.players.values()].filter((p) => p.place === S.place && p !== m && p._A).sort((a, b) => b._A.feet[1] - a._A.feet[1])
    .find((p) => { const b = p._A.box; return wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1; });
}
cvs.addEventListener('pointermove', (ev) => {
  S.parT = clamp((ev.clientX / innerWidth - 0.5) * 2, -1, 1);
  const [wx, wy] = toWorld(ev);
  if (S.place === 'shop') {
    if (S.drag) {
      const dx = ev.clientX - S.drag.x;
      if (Math.abs(dx) > 6) S.drag.moved = true;
      if (S.drag.moved) { const want = S.drag.yaw - dx / S.view.s; S.yaw = clamp(want, 0, PW - S.view.visW); S.yawTarget = undefined; S.dragPushLeft = want < -30; }
    }
    S.hoverZone = zoneAt(wx, wy);
    cvs.style.cursor = S.drag?.moved ? 'grabbing' : S.hoverZone || personAt(wx, wy) ? 'pointer' : 'grab';
  } else cvs.style.cursor = personAt(wx, wy) ? 'pointer' : 'default';
});
cvs.addEventListener('pointerdown', (ev) => {
  closePops();
  if (S.place === 'shop') { S.drag = { x: ev.clientX, yaw: S.yaw, moved: false }; cvs.setPointerCapture?.(ev.pointerId); }
});
cvs.addEventListener('pointerup', (ev) => {
  const drag = S.drag; S.drag = null; S.dragPushLeft = false;
  if (drag?.moved) return;
  const m = me(); if (!m || S.glitch > 0) return;
  const [wx, wy] = toWorld(ev);
  if (m.pose !== 'lie') { const hit = personAt(wx, wy); if (hit) return openPerson(hit, ev); }
  if (S.place === 'shop') { const z = zoneAt(wx, wy); if (z) lookAt(z, () => openZone(z)); return; }
  // 彩蛋：连踢烟灰桶 5 下，摔倒躺着抽
  const pn = -S.par * 44, A = ASHTRAY;
  if (m.pose !== 'lie' && wx > A.x + pn - 10 && wx < A.x + A.w + pn + 10 && wy > A.y - 10 && wy < A.y + A.h) {
    S.tapLog = S.tapLog.filter((t) => S.t - t < 3); S.tapLog.push(S.t); Snd.tap(0.9);
    if (S.tapLog.length >= 5) { S.tapLog = []; glitchTo(() => setPose('lie'), '被烟灰桶绊了一跤。算了，就躺着抽吧'); }
  }
});
cvs.addEventListener('pointerleave', () => { S.parT = 0; S.hoverZone = null; });
function closePops() { for (const id of ['#personMenu', '#picker']) $(id).classList.add('hidden'); }

// ---------- 键盘 ----------
addEventListener('keydown', (e) => {
  if (!S.entered || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement === $('#chatInput')) { if (e.key === 'Escape') closeChat(); return; }
  const k = e.code;
  if (S.place === 'shop' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(k)) { S.keys.add(k); e.preventDefault(); return; }
  if (e.repeat) { if (k === 'Space') e.preventDefault(); return; }
  if (k === 'Space') { e.preventDefault(); startPuff(); }
  else if (k === 'KeyF') mainAction();
  else if (k === 'KeyX') flickAsh(false);
  else if (k === 'KeyE') sip();
  else if (k === 'KeyT' || k === 'Enter') { e.preventDefault(); openChat(); }
  else if (k === 'KeyQ') { const m = me(); if (!m) return; if (S.place === 'shop') doAct('up'); else if (m.pose === 'lie') doAct('getup'); else if (S.place === 'street') goPlace('shop'); else openVistas(); }
  else if (S.place === 'shop' && /^Digit[123]$/.test(k)) doAct('zone:' + ['cigs', 'fridge', 'snack'][Number(k.slice(5)) - 1]);
  else if (k === 'Escape') { closePops(); closeChat(); }
});
addEventListener('keyup', (e) => { S.keys.delete(e.code); if (e.code === 'Space') endPuff(); });
addEventListener('blur', () => { S.keys.clear(); endPuff(); });
document.addEventListener('click', (e) => { if (!e.target.closest('.pop, #game, #bar, #chat, #asks')) closePops(); });

$('#soundBtn').addEventListener('click', () => {
  S.sound = !S.sound; store.set('smoke.sound', S.sound);
  $('#soundBtn').textContent = S.sound ? '🔊' : '🔇';
  Snd.init(S.sound); Snd.setOn(S.sound); Snd.resume();
  if (S.sound) Snd.ambient(ambientKey(S.place), S.sky.night > 0.5);
});
$('#soundBtn').textContent = S.sound ? '🔊' : '🔇';

// ---------- 进门 ----------
function startAudio() { Snd.init(S.sound); Snd.resume(); Snd.ambient(ambientKey(S.place), S.sky.night > 0.5); }
$('#enterBtn').addEventListener('click', () => { S.entered = true; store.set('smoke.adult', true); $('#gate').classList.add('hidden'); startAudio(); });
if (store.get('smoke.adult', false)) { S.entered = true; const unlock = () => { startAudio(); removeEventListener('pointerdown', unlock); }; addEventListener('pointerdown', unlock); }
else $('#gate').classList.remove('hidden');

layout(); ensureLayers(true); renderHeader(); connect(); requestAnimationFrame(frame);
