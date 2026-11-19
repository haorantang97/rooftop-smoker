// 天台：前景（栏杆、地面、水箱、烟灰桶、串灯）+ 六种风景，全部跟着本地时间变
import { VW, VH, lerp, clamp, mix, rgba, shade, rr, lin, glow, ellipse, mulberry32, drawSky, drawStars, drawSunMoon, drawClouds, perspectiveTiles, CAN_BLUR } from './gfx.js';
import { MARGIN, ASHTRAY } from './street.js';

const L = -MARGIN, R = VW + MARGIN, HZ = 560; // 地平线
const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';

// 太阳/月亮在天上的位置（给倒影、高光用）
function sunPos(sky) { const h = sky.h; if (h > 5.6 && h < 18.9) { const k = (h - 5.6) / 13.3; return { x: lerp(80, 1520, k), y: HZ - Math.sin(Math.PI * k) * (HZ - 90), up: Math.sin(Math.PI * k), sun: true }; } return null; }
function moonPos(sky) { const mh = (sky.h + 24 - 18.4) % 24; if (mh < 12.2) { const k = mh / 12.2; return { x: lerp(1520, 80, k), y: HZ - Math.sin(Math.PI * k) * (HZ - 110), up: Math.sin(Math.PI * k) }; } return null; }

function ridge(c, rnd, base, amp, step, col, rough = 0.5) {
  c.fillStyle = col; c.beginPath(); c.moveTo(L, VH);
  let y = base - rnd() * amp;
  for (let x = L; x <= R + step; x += step) { y = clamp(y + (rnd() - 0.5) * amp * rough, base - amp, base); c.lineTo(x, y); }
  c.lineTo(R, VH); c.fill();
}

// ---------- 1 城市夜景 ----------
function city(c, sky, rnd, dyn) {
  const n = sky.night;
  if (n > 0.3) glow(c, 800, HZ + 40, 1100, `rgba(255,150,90,${0.12 * n})`);
  const layers = [[HZ - 10, 60, 230, 0.45, '#aab6ca', '#1c2040'], [HZ + 20, 80, 280, 0.25, '#93a0b8', '#141834'], [HZ + 60, 60, 220, 0.08, '#7e8aa2', '#0d1026']];
  for (const [base, minH, maxH, haze, dc, nc] of layers) {
    const col = mix(mix(dc, nc, n), sky.low, haze);
    let x = L;
    while (x < R) {
      const w = 34 + rnd() * 80, h = minH + rnd() ** 1.6 * (maxH - minH);
      c.fillStyle = col; c.fillRect(x, base - h, w, h + 200);
      if (rnd() < 0.25) { c.fillRect(x + w * 0.35, base - h - 20, w * 0.3, 20); if (rnd() < 0.5) { c.fillRect(x + w / 2 - 1, base - h - 60, 2, 40); dyn.blink.push([x + w / 2, base - h - 62]); } }
      for (let wy = base - h + 6; wy < base + 60; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        const r = rnd();
        if (r < 0.02 + 0.3 * n) { c.fillStyle = r < 0.05 ? `rgba(180,210,255,${0.5 * n + 0.1})` : `rgba(255,${(200 + r * 900) % 50 + 190 | 0},140,${0.3 + 0.55 * n})`; c.fillRect(wx, wy, 2.5, 2.5); }
      }
      x += w + rnd() * 4;
    }
  }
  // 电视塔
  const tx = 1080, tc = mix('#8a96ae', '#0e1124', n);
  c.fillStyle = tc; c.beginPath(); c.moveTo(tx - 22, HZ + 40); c.lineTo(tx - 5, HZ - 300); c.lineTo(tx + 5, HZ - 300); c.lineTo(tx + 22, HZ + 40); c.fill();
  ellipse(c, tx, HZ - 230, 34, 20, tc); ellipse(c, tx, HZ - 310, 14, 10, tc); c.fillRect(tx - 2, HZ - 420, 4, 120);
  if (n > 0.3) { for (let k = -28; k <= 28; k += 8) ellipse(c, tx + k, HZ - 228, 2, 2, `rgba(120,220,255,${0.8 * n})`); dyn.blink.push([tx, HZ - 422]); }
  // 跨江大桥
  if (n > 0.2) { c.save(); c.globalCompositeOperation = 'lighter'; for (let x = 120; x < 760; x += 14) ellipse(c, x, HZ + 70 - Math.sin((x - 120) / 640 * Math.PI) * 30, 2, 2, `rgba(255,220,150,${0.7 * n})`); c.restore(); }
  dyn.plane = true;
}

// ---------- 2 海 ----------
function sea(c, sky, rnd, dyn) {
  const n = sky.night;
  ridge(c, rnd, HZ - 4, 50, 30, mix(mix('#7a8aa0', '#141a30', n), sky.low, 0.5), 0.6);
  c.fillStyle = mix(sky.low, '#000', 0); c.fillRect(L, HZ - 2, R - L, 2);
  // 海面
  c.fillStyle = lin(c, 0, HZ, 0, 700, [[0, mix(mix(sky.low, '#2a5a8a', 0.4), '#0a1428', n)], [1, mix('#1a4a74', '#04070f', n)]]);
  c.fillRect(L, HZ, R - L, 160);
  for (let i = 0; i < 160; i++) { const y = HZ + 4 + (rnd() ** 1.5) * 150, w = 10 + (y - HZ) * 0.5 * rnd(); c.fillStyle = `rgba(255,255,255,${0.04 + 0.05 * (1 - n)})`; c.fillRect(L + rnd() * (R - L), y, w, 1.2); }
  const s = sunPos(sky) || moonPos(sky);
  if (s) dyn.glitter = { x: s.x, sun: !!s.sun, warm: s.sun ? 1 - s.up : 0, a: s.sun ? 0.8 : 0.5 * n };
  // 小岛和灯塔
  c.fillStyle = mix(mix('#4a5a6a', '#05070e', n), sky.low, 0.15);
  c.beginPath(); c.moveTo(1180, HZ + 6); c.quadraticCurveTo(1290, HZ - 60, 1420, HZ + 6); c.fill();
  c.fillStyle = mix('#e8e4dc', '#22242a', n); c.fillRect(1318, HZ - 92, 12, 60); c.fillStyle = '#c94f4f'; c.fillRect(1318, HZ - 74, 12, 8); c.fillRect(1318, HZ - 52, 12, 8);
  dyn.lighthouse = [1324, HZ - 96];
  // 海边小镇（近处下方）
  let x = L;
  while (x < R) { const w = 50 + rnd() * 60, h = 20 + rnd() * 40; c.fillStyle = mix('#7a6e66', '#0c0c12', n); c.fillRect(x, 700 - h, w, h + 20); c.beginPath(); c.moveTo(x - 4, 700 - h); c.lineTo(x + w / 2, 700 - h - 18); c.lineTo(x + w + 4, 700 - h); c.fillStyle = mix('#9a4a3a', '#140a0a', n); c.fill(); if (n > 0.3 && rnd() < 0.7) { c.fillStyle = `rgba(255,200,120,${0.7 * n})`; c.fillRect(x + w * 0.3, 700 - h + 8, 6, 6); glow(c, x + w * 0.3 + 3, 700 - h + 11, 20, `rgba(255,190,110,${0.25 * n})`); } x += w + 4; }
  dyn.ships = [{ x: 300, y: HZ + 18, v: 6 }, { x: 900, y: HZ + 40, v: -4 }];
}

// ---------- 3 雪山 ----------
function snow(c, sky, rnd, dyn) {
  const n = sky.night, h = sky.h;
  const pink = Math.max(0, 1 - Math.abs(h - 6.3) / 0.9, 1 - Math.abs(h - 18.3) / 0.9) * (1 - n * 0.5);
  const peaks = [[100, 260], [360, 170], [620, 240], [880, 130], [1150, 210], [1420, 160], [1660, 250]];
  // 远山
  for (const [layer, off, haze] of [[0, 0, 0.45], [1, 90, 0.2]]) {
    c.fillStyle = mix(mix(layer ? '#5a6a82' : '#8a9ab4', layer ? '#0e1426' : '#18203a', n), sky.low, haze);
    c.beginPath(); c.moveTo(L, VH);
    peaks.forEach(([px, py], i) => { const x = px + (layer ? 130 : 0) - 60, y = py + off + 60; c.lineTo(x - 140, y + 180); c.lineTo(x, y); c.lineTo(x + 140, y + 170); });
    c.lineTo(R, VH); c.fill();
    // 雪顶
    peaks.forEach(([px, py]) => {
      const x = px + (layer ? 130 : 0) - 60, y = py + off + 60;
      const snowCol = mix(mix('#ffffff', '#ffb0a8', pink), '#7a8aa8', n * 0.75);
      c.fillStyle = mix(snowCol, sky.low, haze * 0.6);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 60, y + 70); c.lineTo(x - 36, y + 62); c.lineTo(x - 18, y + 80); c.lineTo(x, y + 64); c.lineTo(x + 22, y + 84); c.lineTo(x + 44, y + 66); c.lineTo(x + 62, y + 72); c.fill();
      c.fillStyle = 'rgba(30,40,80,.18)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 62, y + 72); c.lineTo(x + 44, y + 66); c.lineTo(x + 22, y + 84); c.lineTo(x + 4, y + 66); c.fill();
    });
  }
  // 湖和松林
  c.fillStyle = lin(c, 0, 620, 0, 700, [[0, mix(sky.low, '#0a1020', n * 0.6)], [1, mix('#3a5a7a', '#05080f', n)]]); c.fillRect(L, 620, R - L, 80);
  for (let x = L; x < R; x += 14 + rnd() * 10) { const th = 30 + rnd() * 50, y = 640 + rnd() * 20; c.fillStyle = mix('#1e3a2e', '#05080a', n); c.beginPath(); c.moveTo(x, y - th); c.lineTo(x - th * 0.28, y); c.lineTo(x + th * 0.28, y); c.fill(); }
  ridge(c, rnd, 700, 26, 40, mix('#2a3a34', '#05070a', n), 0.4);
  dyn.snowfall = n > 0.5 ? 0.5 : 0.25;
}

// ---------- 4 云海 ----------
function clouds(c, sky, rnd, dyn) {
  const n = sky.night;
  const s = sunPos(sky);
  // 云上露出来的山尖
  for (const [x, y, w] of [[260, HZ - 120, 220], [1240, HZ - 170, 260], [760, HZ - 60, 160]]) {
    c.fillStyle = mix(mix('#6a7690', '#10142a', n), sky.low, 0.25);
    c.beginPath(); c.moveTo(x - w, HZ + 40); c.lineTo(x - 20, y + 10); c.lineTo(x, y); c.lineTo(x + 24, y + 14); c.lineTo(x + w, HZ + 40); c.fill();
    c.fillStyle = mix('#ffffff', '#8a96b8', n * 0.7); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 30, y + 36); c.lineTo(x + 8, y + 26); c.lineTo(x + 34, y + 40); c.fill();
  }
  if (s && s.up < 0.5) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = -4; k <= 4; k++) { c.fillStyle = `rgba(255,210,150,${0.04 * (1 - s.up * 2)})`; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + k * 180 - 60, 720); c.lineTo(s.x + k * 180 + 60, 720); c.fill(); } c.restore(); }
  // 云海，一层层往近处堆
  const lit = s ? mix('#ffffff', '#ffd2a8', 1 - s.up) : mix('#c8d0e8', '#5a6488', n);
  for (let layer = 0; layer < 5; layer++) {
    const y0 = HZ - 10 + layer * 34, base = 40 + layer * 26;
    for (let x = L - 40; x < R + 40; x += base * 0.7) {
      const sz = base * (0.7 + rnd() * 0.8);
      const yy = y0 + Math.sin(x * 0.01 + layer) * 14 + rnd() * 18 - sz * 0.2;
      ellipse(c, x, yy + sz * 0.3, sz * 1.1, sz * 0.5, mix(mix('#b8c4dc', '#2a3050', n), sky.low, 0.2 - layer * 0.03));
      ellipse(c, x, yy, sz, sz * 0.55, mix(lit, sky.low, 0.25 - layer * 0.05));
    }
  }
  dyn.cloudDrift = true;
}

// ---------- 5 极光 ----------
function aurora(c, sky, rnd, dyn) {
  const n = sky.night;
  // 峡湾的山
  c.fillStyle = mix(mix('#8a98b0', '#0a0e1c', n), sky.low, 0.25);
  c.beginPath(); c.moveTo(L, VH); c.lineTo(L, HZ - 60); c.lineTo(120, HZ - 160); c.lineTo(300, HZ - 40); c.lineTo(420, HZ - 90); c.lineTo(520, HZ + 10); c.lineTo(L, HZ + 10); c.fill();
  c.beginPath(); c.moveTo(R, VH); c.lineTo(R, HZ - 80); c.lineTo(1450, HZ - 190); c.lineTo(1260, HZ - 50); c.lineTo(1120, HZ - 110); c.lineTo(980, HZ + 10); c.lineTo(R, HZ + 10); c.fill();
  c.fillStyle = mix('#ffffff', '#5a6a8a', n * 0.7);
  for (const [x, y] of [[120, HZ - 160], [1450, HZ - 190], [420, HZ - 90], [1120, HZ - 110]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 40, y + 40); c.lineTo(x + 6, y + 28); c.lineTo(x + 44, y + 44); c.fill(); }
  // 冰湖倒影
  c.fillStyle = lin(c, 0, HZ + 10, 0, 700, [[0, mix(sky.low, '#08101c', n * 0.5)], [1, mix('#9ab0c8', '#05080f', n)]]); c.fillRect(L, HZ + 10, R - L, 140);
  c.fillStyle = mix('#f4f8fc', '#3a4a5e', n * 0.8); c.fillRect(L, 680, R - L, 20);
  // 小木屋
  c.fillStyle = mix('#6a3a2a', '#120a08', n); c.fillRect(640, 640, 70, 44); c.beginPath(); c.moveTo(630, 642); c.lineTo(675, 612); c.lineTo(720, 642); c.fillStyle = mix('#f4f4f4', '#4a5464', n * 0.7); c.fill();
  if (n > 0.3) { c.fillStyle = `rgba(255,200,120,${0.85 * n})`; c.fillRect(656, 654, 12, 12); glow(c, 662, 660, 50, `rgba(255,190,110,${0.3 * n})`); }
  dyn.aurora = n;
}

// ---------- 6 沙漠星空 ----------
function desert(c, sky, rnd, dyn) {
  const n = sky.night;
  if (n > 0.3) { // 银河
    c.save(); c.translate(800, 300); c.rotate(-0.5);
    for (let i = 0; i < 26; i++) glow(c, (i - 13) * 70, Math.sin(i) * 20, 150, `rgba(210,195,255,${0.07 * n})`);
    for (let i = 0; i < 1600; i++) { const x = (rnd() - 0.5) * 1900, y = (rnd() + rnd() + rnd() - 1.5) * 90; ellipse(c, x, y, rnd() < 0.06 ? 1.6 : 0.8, rnd() < 0.06 ? 1.6 : 0.8, `rgba(255,250,240,${(0.3 + rnd() * 0.7) * n})`); }
    for (let i = 0; i < 12; i++) glow(c, (rnd() - 0.5) * 1500, (rnd() - 0.5) * 40, 50, `rgba(80,40,60,${0.25 * n})`);
    c.restore();
  }
  const dune = (base, amp, freq, phase, day, night) => {
    c.fillStyle = mix(day, night, n); c.beginPath(); c.moveTo(L, VH);
    for (let x = L; x <= R; x += 8) c.lineTo(x, base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + phase * 2) * amp * 0.3);
    c.lineTo(R, VH); c.fill();
  };
  dune(HZ + 10, 26, 0.004, 1, mix('#e8b07a', sky.low, 0.4), '#2a2236');
  dune(HZ + 50, 40, 0.006, 3, '#d8955a', '#211a2c');
  dune(HZ + 100, 46, 0.005, 5, '#c47a42', '#18121f');
  // 骆驼队剪影
  c.fillStyle = mix('#5a3a24', '#05040a', n);
  for (let k = 0; k < 4; k++) { const x = 980 + k * 46, y = HZ + 16 - Math.sin(x * 0.004 + 1) * 26; c.fillRect(x, y - 16, 26, 9); c.fillRect(x + 4, y - 7, 3, 9); c.fillRect(x + 19, y - 7, 3, 9); c.fillRect(x + 22, y - 26, 5, 12); ellipse(c, x + 10, y - 17, 6, 4, c.fillStyle); }
  // 一棵枯树
  c.strokeStyle = mix('#3a2a1a', '#05040a', n); c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(300, 690); c.lineTo(306, 610); c.lineTo(280, 570); c.moveTo(306, 620); c.lineTo(340, 580); c.moveTo(306, 640); c.lineTo(270, 620); c.stroke();
  dyn.shooting = 1.5;
}

const VIEWS = { city, sea, snow, clouds, aurora, desert };

// ---------- 天台前景 ----------
function rooftop(c, sky, rnd) {
  const n = sky.night;
  // 栏杆
  c.fillStyle = mix('#7a7a84', '#2a2a32', n);
  c.fillRect(L, 628, R - L, 8);
  for (let x = L + 20; x < R; x += 140) c.fillRect(x, 628, 7, 80);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(L, 628, R - L, 2);
  // 女儿墙
  c.fillStyle = lin(c, 0, 700, 0, 790, [[0, mix('#c4c0b8', '#46444e', n)], [1, mix('#9a968e', '#2a2930', n)]]); c.fillRect(L, 700, R - L, 90);
  c.fillStyle = mix('#dcd8d0', '#5a5862', n); c.fillRect(L, 694, R - L, 10);
  for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(L + rnd() * (R - L), 704 + rnd() * 80, 20 + rnd() * 60, 2); }
  // 地面
  c.fillStyle = lin(c, 0, 790, 0, VH, [[0, mix('#9a958c', '#2c2a32', n)], [1, mix('#7a756c', '#1c1b20', n)]]); c.fillRect(L, 790, R - L, VH - 790);
  perspectiveTiles(c, L, R, 790, VH + 40, 800, 560, 5, 8, 'rgba(0,0,0,.14)');
  for (let i = 0; i < 6; i++) ellipse(c, rnd() * VW, 830 + rnd() * 150, 60 + rnd() * 90, 7 + rnd() * 6, 'rgba(0,0,0,.1)');
  // 水箱
  const tx = -10;
  c.fillStyle = mix('#3a3640', '#0c0b10', n); c.fillRect(tx + 30, 560, 12, 260); c.fillRect(tx + 190, 560, 12, 260); c.fillRect(tx + 30, 690, 172, 8);
  c.fillStyle = lin(c, tx, 0, tx + 230, 0, [[0, mix('#5a6a7a', '#1a1e26', n)], [0.4, mix('#8a9aaa', '#2a3038', n)], [1, mix('#4a5664', '#12151a', n)]]);
  c.fillRect(tx, 320, 230, 250);
  for (const y of [370, 440, 510]) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(tx, y, 230, 7); }
  ellipse(c, tx + 115, 320, 115, 18, mix('#9aaabb', '#2c323c', n));
  c.fillStyle = mix('#c94f4f', '#4a1e1e', n * 0.7); c.fillRect(tx + 60, 400, 110, 26); c.fillStyle = '#fff'; c.font = `700 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('生活用水', tx + 115, 413);
  // 盆栽
  const pots = [[260, 800, 1], [1470, 800, 0.8]];
  for (const [px, py, k] of pots) {
    c.fillStyle = mix('#a85a3a', '#2a1610', n); c.beginPath(); c.moveTo(px - 30 * k, py - 50 * k); c.lineTo(px + 30 * k, py - 50 * k); c.lineTo(px + 22 * k, py); c.lineTo(px - 22 * k, py); c.fill();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; c.strokeStyle = mix('#3a7a3a', '#0a1a0c', n); c.lineWidth = 8 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py - 50 * k); c.quadraticCurveTo(px + Math.cos(a) * 50 * k, py - 90 * k, px + Math.cos(a) * 90 * k, py - 50 * k - Math.sin(-a) * 80 * k); c.stroke(); }
  }
  ashtray(c, n);
}
function ashtray(c, n) {
  const { x, y, w, h } = ASHTRAY, cx = x + w / 2, base = y + h;
  ellipse(c, cx, base, w * 0.75, 12, 'rgba(0,0,0,.35)');
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, mix('#6a6e76', '#24262c', n)], [0.35, mix('#c8ccd4', '#5a5e68', n)], [0.6, mix('#9ca0a8', '#3a3d45', n)], [1, mix('#5a5e66', '#1c1e23', n)]]);
  c.fillRect(x, y + 20, w, h - 20);
  ellipse(c, cx, base, w / 2, 10, mix('#5a5e66', '#1c1e23', n));
  ellipse(c, cx, y + 20, w / 2 + 10, 16, mix('#4a4d55', '#18191d', n));
  ellipse(c, cx, y + 18, w / 2 + 4, 12, mix('#d8c9a0', '#5a5444', n));
  const r2 = mulberry32(3);
  for (let i = 0; i < 9; i++) { const bx = cx + (r2() - 0.5) * w * 0.8, by = y + 14 + r2() * 8; c.save(); c.translate(bx, by); c.rotate(r2() * Math.PI); c.fillStyle = mix('#f4f2ec', '#8a887e', n * 0.6); c.fillRect(-9, -2, 14, 4); c.fillStyle = mix('#d6974a', '#6a4a24', n * 0.6); c.fillRect(-9, -2, 5, 4); c.restore(); }
  c.fillStyle = mix('#1c1d22', '#060608', n); rr(c, cx - 28, y + 60, 56, 16, 8); c.fill();
  c.fillStyle = mix('#c7372f', '#5a1e1a', n * 0.7); rr(c, cx - 30, y + 110, 60, 46, 4); c.fill();
  c.fillStyle = mix('#ffffff', '#b0a8a0', n * 0.5); c.font = `700 13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('烟灰桶', cx, y + 126); c.font = `600 9px ${FONT}`; c.fillText('ASH TRAY', cx, y + 143);
  c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + w * 0.3, y + 22, 6, h - 30);
}

export function buildRoofVista(c, cn, sky, vista, dyn) {
  const rnd = mulberry32({ city: 7, sea: 13, snow: 17, clouds: 19, aurora: 23, desert: 29 }[vista] || 7);
  Object.assign(dyn, { blink: [], plane: false, glitter: null, lighthouse: null, ships: null, snowfall: 0, aurora: 0, cloudDrift: false, shooting: 0.6, vista });
  drawSky(c, sky, L, R, 0, 720, HZ + 20);
  drawStars(c, sky, rnd, L, R, 0, HZ - 40, vista === 'desert' || vista === 'aurora' ? 420 : 260);
  if (vista !== 'clouds') drawSunMoon(c, sky, 80, 1520, HZ, 90); else drawSunMoon(c, sky, 80, 1520, HZ - 20, 90);
  if (vista !== 'desert' && vista !== 'aurora') drawClouds(c, sky, rnd, L, R, 80, 320, 4);
  (VIEWS[vista] || city)(c, sky, rnd, dyn);
  rooftop(cn, sky, rnd);
}

// ---------- 天台上会动的东西 ----------
export function drawVistaDynamic(c, dyn, sky, t, behind) {
  const n = sky.night;
  if (behind) {
    if (dyn.aurora > 0.25) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const baseY = 170 + band * 60;
        for (let x = L; x < R; x += 10) {
          const y = baseY + Math.sin(x * 0.004 + t * 0.25 + band) * 50 + Math.sin(x * 0.011 - t * 0.4) * 18;
          const h = 160 + Math.sin(x * 0.007 + t * 0.3 + band * 2) * 70;
          const a = (0.09 + 0.07 * Math.sin(x * 0.02 + t + band)) * dyn.aurora;
          c.fillStyle = lin(c, 0, y - h, 0, y + 20, [[0, 'rgba(160,80,255,0)'], [0.45, `rgba(140,90,255,${a * 0.6})`], [0.85, `rgba(80,255,170,${a * 1.6})`], [1, 'rgba(80,255,170,0)']]);
          c.fillRect(x, y - h, 11, h + 20);
        }
      }
      // 湖面倒影
      c.globalAlpha = 0.25; c.fillStyle = `rgba(80,255,170,${0.12 * dyn.aurora})`; c.fillRect(L, HZ + 14, R - L, 120); c.globalAlpha = 1;
      c.restore();
    }
    if (dyn.glitter) {
      const g = dyn.glitter;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 64; i++) {
        const k = i / 70, y = HZ + 4 + k * k * 150, spread = 20 + k * 120;
        const x = g.x + Math.sin(i * 12.9 + t * (1.5 + (i % 5) * 0.3)) * spread;
        const a = g.a * (0.25 + 0.75 * Math.abs(Math.sin(i * 3.1 + t * 2)));
        c.fillStyle = g.sun ? `rgba(255,${Math.round(lerp(240, 170, g.warm))},${Math.round(lerp(200, 110, g.warm))},${a * 0.5})` : `rgba(220,230,255,${a * 0.5})`;
        c.fillRect(x - 6 - k * 14, y, 12 + k * 28, 1.6 + k * 1.5);
      }
      c.restore();
    }
    if (dyn.ships) for (const s of dyn.ships) { const x = ((s.x + t * s.v) % 1800 + 1800) % 1800 - 100; c.fillStyle = mix('#3a3a44', '#08080c', n); c.fillRect(x, s.y - 6, 40, 6); c.fillRect(x + 10, s.y - 14, 16, 8); if (n > 0.3) ellipse(c, x + 18, s.y - 10, 1.6, 1.6, `rgba(255,220,150,${0.9 * n})`); }
    if (dyn.lighthouse && n > 0.25) {
      const [lx, ly] = dyn.lighthouse, a = t * 0.9;
      c.save(); c.globalCompositeOperation = 'lighter';
      const dir = Math.cos(a), len = 900 * Math.abs(dir);
      c.fillStyle = lin(c, lx, 0, lx + Math.sign(dir) * len, 0, [[0, `rgba(255,240,200,${0.3 * n})`], [1, 'rgba(255,240,200,0)']]);
      c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.sign(dir) * len, ly - 50); c.lineTo(lx + Math.sign(dir) * len, ly + 40); c.fill();
      glow(c, lx, ly, 40 + 30 * Math.abs(dir), `rgba(255,240,200,${0.7 * n})`);
      c.restore();
    }
    for (const [i, [bx, by]] of dyn.blink.entries()) if ((t * 0.8 + i * 0.37) % 1.6 < 0.3) { glow(c, bx, by, 10, 'rgba(255,60,60,.9)'); }
    if (dyn.plane) { const px = ((t * 26) % 2200) - 300, py = 160 + Math.sin(t * 0.05) * 20; ellipse(c, px, py, 1.6, 1.6, 'rgba(255,255,255,.8)'); if (t % 1.2 < 0.15) glow(c, px + 4, py, 10, 'rgba(255,70,70,.9)'); }
    if (dyn.shooting && n > 0.5) {
      const period = 9 / dyn.shooting, k = (t % period) / period;
      if (k < 0.08) { const seed = Math.floor(t / period); const sx = 200 + (seed * 397 % 1200), sy = 60 + (seed * 131 % 200); const p = k / 0.08; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = lin(c, sx + p * 260, sy + p * 110, sx + p * 260 - 120, sy + p * 110 - 50, [[0, `rgba(255,255,255,${0.9 * (1 - p)})`], [1, 'rgba(255,255,255,0)']]); c.lineWidth = 2; c.beginPath(); c.moveTo(sx + p * 260, sy + p * 110); c.lineTo(sx + p * 260 - 120, sy + p * 110 - 50); c.stroke(); c.restore(); }
    }
  } else {
    // 前景：串灯（离眼睛近）和雪花
    lights(c, n, t);
    if (dyn.snowfall) { c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 120 * dyn.snowfall; i++) { const x = ((i * 137.5 + Math.sin(t * 0.6 + i) * 30 + t * 12) % (VW + 100)) - 50, y = ((i * 89.3 + t * (40 + (i % 7) * 10)) % (VH + 40)) - 20, r = 1 + (i % 4) * 0.7; ellipse(c, x, y, r, r, 'rgba(255,255,255,.7)'); } }
  }
}
function lights(c, n, t) {
  const bulbs = [];
  for (const [x0, y0, x1, y1, sag] of [[L, 40, 820, 70, 70], [820, 70, R, 30, 80]]) {
    c.strokeStyle = 'rgba(20,20,24,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); c.stroke();
    for (let k = 1; k < 12; k++) { const tt = k / 12, x = (1 - tt) ** 2 * x0 + 2 * (1 - tt) * tt * (x0 + x1) / 2 + tt * tt * x1, y = (1 - tt) ** 2 * y0 + 2 * (1 - tt) * tt * ((y0 + y1) / 2 + sag * 2) + tt * tt * y1; bulbs.push([x, y + 8]); }
  }
  for (const [i, [x, y]] of bulbs.entries()) {
    const on = n > 0.15, fl = 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7);
    c.fillStyle = '#1a1a1e'; c.fillRect(x - 2, y - 10, 4, 5);
    ellipse(c, x, y, 5, 7, on ? `rgba(255,214,140,${0.95 * fl})` : 'rgba(240,235,220,.6)');
    if (on) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, 34, `rgba(255,190,110,${0.35 * n * fl})`); c.restore(); }
  }
}
// 天台上站人的位置 [x, 脚底 y]
const ROOF_SLOTS = [[380, 940], [660, 925], [180, 880], [470, 866], [760, 872], [1000, 862], [1180, 900], [300, 826], [540, 820], [760, 816], [980, 818], [1160, 820], [1520, 840], [420, 800], [640, 798], [860, 797], [1080, 798], [210, 805]];
export function roofSlot(slot) {
  const [x, y] = ROOF_SLOTS[slot % ROOF_SLOTS.length];
  const lap = Math.floor(slot / ROOF_SLOTS.length), yy = y - lap * 6;
  return [x + lap * 34, yy, lerp(150, 330, clamp((yy - 790) / 150, 0, 1))];
}
