// 第一视角的户外场景：便利店门口的吸烟区、房顶、躺下看到的天空，以及街上的车和路人
import { VW, VH, lerp, clamp, mix, rgba, shade, rr, lin, glow, ellipse, mulberry32, drawSky, drawStars, drawSunMoon, drawClouds, perspectiveTiles, CAN_BLUR } from './gfx.js';

export const MARGIN = 60;          // 背景左右多画一点，留给视差
export const VP = [800, 470];      // 灭点（眼睛高度）
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

// ---------- 远处的城市轮廓 ----------
function skyline(c, rnd, sky, base, minH, maxH, dayCol, nightCol, haze, blinkers) {
  let x = -MARGIN - rnd() * 30;
  const col = mix(mix(dayCol, nightCol, sky.night), sky.low, haze);
  c.fillStyle = col;
  while (x < VW + MARGIN) {
    const w = 40 + rnd() * 90, h = minH + rnd() * (maxH - minH);
    c.fillStyle = col; c.fillRect(x, base - h, w, h + 2);
    if (rnd() < 0.3) c.fillRect(x + w * 0.3, base - h - 14, w * 0.25, 14);
    if (sky.night > 0.2) for (let wy = base - h + 8; wy < base - 6; wy += 9) for (let wx = x + 5; wx < x + w - 5; wx += 8) {
      const r = rnd();
      if (r < 0.03 + 0.22 * sky.night) { c.fillStyle = r < 0.06 ? 'rgba(170,205,255,.55)' : `rgba(255,${200 + (r * 400 % 40) | 0},130,${0.35 + 0.45 * sky.night})`; c.fillRect(wx, wy, 3, 3); }
    } else for (let k = 0; k < (w * h) / 80; k++) rnd();
    if (blinkers && h > maxH * 0.82) { c.fillStyle = col; c.fillRect(x + w / 2 - 1, base - h - 34, 2, 34); blinkers.push([x + w / 2, base - h - 36]); }
    x += w + rnd() * 6;
  }
}

// ---------- 对面的一栋楼 ----------
const FACADES = [['#c8b49a', '#2a2630'], ['#b9c0c6', '#22262e'], ['#9a6a58', '#2a1e22'], ['#e2ddd2', '#2c2b33'], ['#a7afb4', '#1e2229'], ['#cdbfa6', '#2b2729']];
function building(c, rnd, sky, x, w, top, base, idx, shop) {
  const n = sky.night;
  const [day, night] = FACADES[idx % FACADES.length];
  const wall = mix(day, night, n * 0.92);
  c.fillStyle = lin(c, 0, top, 0, base, [[0, shade(wall, 1.06)], [1, shade(wall, 0.9)]]);
  c.fillRect(x, top, w, base - top);
  // 楼顶
  c.fillStyle = shade(wall, 0.8); c.fillRect(x - 4, top - 8, w + 8, 10);
  if (rnd() < 0.5) { const tx = x + w * (0.2 + rnd() * 0.5); c.fillStyle = mix('#7a6a5a', '#141218', n); c.fillRect(tx, top - 46, 44, 38); c.fillRect(tx + 6, top - 8, 3, 8); c.fillRect(tx + 35, top - 8, 3, 8); c.fillStyle = shade(mix('#7a6a5a', '#141218', n), 1.2); c.fillRect(tx - 2, top - 50, 48, 6); }
  if (rnd() < 0.4) { c.strokeStyle = mix('#555', '#0c0c10', n); c.lineWidth = 2; const ax = x + w * (0.6 + rnd() * 0.3); c.beginPath(); c.moveTo(ax, top - 8); c.lineTo(ax, top - 70); c.moveTo(ax - 12, top - 50); c.lineTo(ax + 12, top - 50); c.moveTo(ax - 8, top - 62); c.lineTo(ax + 8, top - 62); c.stroke(); }
  // 楼层线
  c.fillStyle = 'rgba(0,0,0,.08)';
  for (let y = top + 50; y < base - 90; y += 50) c.fillRect(x, y, w, 2);
  // 窗户
  const balcony = rnd() < 0.35;
  for (let y = top + 16; y < base - 110; y += 50) {
    for (let wx = x + 14; wx + 34 < x + w - 8; wx += 54) {
      const r = rnd(), r2 = rnd();
      const lit = r < 0.04 + 0.5 * n;
      c.fillStyle = shade(wall, 0.7); c.fillRect(wx - 3, y - 3, 40, 36);
      if (lit) {
        const warm = r2 > 0.18;
        c.fillStyle = lin(c, 0, y, 0, y + 30, warm ? [[0, '#ffd58a'], [1, '#e8954a']] : [[0, '#cfe3ff'], [1, '#7fa6d8']]);
        c.fillRect(wx, y, 34, 30);
        if (r2 < 0.5) { c.fillStyle = warm ? 'rgba(160,90,40,.55)' : 'rgba(40,60,100,.5)'; c.fillRect(wx, y, r2 < 0.25 ? 14 : 34, r2 < 0.25 ? 30 : 9); }
        if (r2 > 0.85) { c.fillStyle = 'rgba(30,20,20,.45)'; c.beginPath(); c.ellipse(wx + 22, y + 30, 6, 12, 0, Math.PI, 0); c.fill(); ellipse(c, wx + 22, y + 13, 4, 4, 'rgba(30,20,20,.45)'); }
        if (n > 0.4) glow(c, wx + 17, y + 15, 40, `rgba(255,200,120,${0.06 * n})`);
      } else {
        c.fillStyle = lin(c, wx, y, wx + 34, y + 30, [[0, mix(sky.mid, '#0a0c16', n * 0.7)], [0.5, mix(sky.low, '#141826', n * 0.8)], [1, mix(sky.top, '#06070c', n)]]);
        c.fillRect(wx, y, 34, 30);
        c.fillStyle = `rgba(255,255,255,${0.12 * (1 - n)})`; c.beginPath(); c.moveTo(wx + 6, y); c.lineTo(wx + 14, y); c.lineTo(wx + 4, y + 30); c.lineTo(wx - 4 + 4, y + 30); c.fill();
      }
      c.fillStyle = shade(wall, 0.62); c.fillRect(wx + 16, y, 2, 30);
      if (rnd() < 0.25) { c.fillStyle = mix('#d8d8d4', '#3a3a40', n); rr(c, wx + 2, y + 34, 22, 12, 2); c.fill(); ellipse(c, wx + 9, y + 40, 4, 4, mix('#9a9a9e', '#222', n)); }
      if (balcony) { c.fillStyle = shade(wall, 0.75); c.fillRect(wx - 6, y + 32, 46, 3); for (let k = wx - 6; k < wx + 40; k += 6) c.fillRect(k, y + 22, 1.5, 10); }
    }
  }
  // 竖招牌
  if (rnd() < 0.55) {
    const sx = x + (rnd() < 0.5 ? 6 : w - 34), sy = base - 230 - rnd() * 80;
    const names = ['烧鸟', '卡拉OK', '旅馆', '牙科', '麻将', '按摩', '书店', '中华料理'];
    const word = names[(rnd() * names.length) | 0];
    const colA = ['#c7372f', '#2f6fb0', '#e8b030', '#2f9a6a', '#8a3ac2'][(rnd() * 5) | 0];
    c.fillStyle = mix('#f4efe4', '#201c22', n * 0.5); rr(c, sx, sy, 28, 22 + word.length * 22, 3); c.fill();
    c.fillStyle = n > 0.35 ? colA : shade(colA, 0.9);
    c.font = `700 19px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    [...word].forEach((ch, i) => c.fillText(ch, sx + 14, sy + 22 + i * 22));
    if (n > 0.35) glow(c, sx + 14, sy + 11 + word.length * 11, 60, rgba(colA, 0.18 * n));
  }
  // 一楼店面
  if (shop) storefront(c, sky, x, w, base, shop);
}

function storefront(c, sky, x, w, base, kind) {
  const n = sky.night, gy = base - 92, sx = x + 8, sw = w - 16;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (kind === 'shutter') {
    c.fillStyle = lin(c, 0, gy, 0, base, [[0, mix('#a8aaae', '#3c3e46', n)], [1, mix('#8a8c90', '#2a2c32', n)]]);
    c.fillRect(sx, gy, sw, 92);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = gy + 3; y < base; y += 5) c.fillRect(sx, y, sw, 1.5);
    c.fillStyle = mix('#3a3c42', '#18181c', n); c.fillRect(sx, gy - 6, sw, 8);
    c.fillStyle = mix('#e8e2d0', '#4a4640', n); c.fillRect(sx + sw * 0.6, gy + 30, 30, 40); c.fillStyle = mix('#c94f4f', '#4a2424', n); c.fillRect(sx + sw * 0.6 + 4, gy + 34, 22, 6);
    return;
  }
  const P = {
    ramen: { sign: '#7a1d1d', text: '拉 面', tc: '#fff3dc', glass: ['#f6dcae', '#ffc777'], light: '255,200,130' },
    laundry: { sign: '#2a5fa8', text: '自助洗衣', tc: '#ffffff', glass: ['#e2f2fa', '#c9ecff'], light: '180,225,255' },
    bar: { sign: '#1c1420', text: '', tc: '#ff6fb0', glass: ['#4a2a44', '#7a3a5a'], light: '255,110,170' },
    pharmacy: { sign: '#f4f6f2', text: '药 局', tc: '#1f8a52', glass: ['#eef7f0', '#d4ffe6'], light: '170,255,200' },
  }[kind];
  c.fillStyle = mix(P.glass[0], P.glass[1], n);
  c.fillRect(sx, gy + 26, sw, 66);
  // 店里的东西
  if (kind === 'laundry') for (let k = sx + 18; k < sx + sw - 20; k += 40) { rr(c, k - 15, gy + 42, 30, 44, 3); c.fillStyle = mix('#f0f4f6', '#9ab0c0', n * 0.5); c.fill(); ellipse(c, k, gy + 62, 11, 11, mix('#8aa0b0', '#2a3a4a', n * 0.6)); ellipse(c, k, gy + 62, 7, 7, mix('#cfe6f4', '#6ab0e0', n)); }
  if (kind === 'ramen') { for (let k = 0; k < 3; k++) { c.fillStyle = mix('#3a1a1a', '#120808', n * 0.5); c.fillRect(sx + 14 + k * (sw - 28) / 3 + 2, gy + 26, (sw - 28) / 3 - 4, 34); } c.fillStyle = '#fff3dc'; c.font = `700 14px ${FONT}`; c.fillText('营业中', sx + sw / 2, gy + 44); }
  if (kind === 'pharmacy') for (let r = 0; r < 3; r++) { c.fillStyle = mix('#c8d6cc', '#5a7a66', n * 0.5); c.fillRect(sx + 6, gy + 44 + r * 16, sw - 12, 3); for (let k = sx + 8; k < sx + sw - 10; k += 9) { c.fillStyle = ['#e85a5a', '#5aa0e8', '#f2c14e', '#7bc96f'][(k + r) % 4]; c.fillRect(k, gy + 36 + r * 16, 6, 8); } }
  if (kind === 'bar') { ellipse(c, sx + sw * 0.3, gy + 60, 8, 8, `rgba(255,190,120,${0.4 + 0.5 * n})`); ellipse(c, sx + sw * 0.7, gy + 60, 8, 8, `rgba(255,190,120,${0.4 + 0.5 * n})`); }
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(sx + 10, gy + 26); c.lineTo(sx + 30, gy + 26); c.lineTo(sx + 12, base); c.lineTo(sx - 8 + 8, base); c.fill();
  c.fillStyle = mix('#555', '#1a1a1e', n); c.fillRect(sx + sw / 2 - 2, gy + 26, 4, 66);
  // 招牌
  c.fillStyle = P.sign; c.fillRect(sx - 4, gy, sw + 8, 26);
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(sx - 4, gy, sw + 8, 3);
  if (P.text) { c.fillStyle = P.tc; c.font = `700 17px ${FONT}`; c.fillText(P.text, sx + sw / 2, gy + 14); }
  if (kind === 'ramen') { // 红灯笼
    const lx = sx + sw - 12, ly = gy - 26;
    if (n > 0.3) glow(c, lx, ly, 70, `rgba(255,90,50,${0.35 * n})`);
    c.fillStyle = lin(c, lx - 13, 0, lx + 13, 0, [[0, '#9a2418'], [0.5, n > 0.3 ? '#ff6a3a' : '#d8402a'], [1, '#9a2418']]);
    c.beginPath(); c.ellipse(lx, ly, 13, 18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let k = -12; k <= 12; k += 6) { c.beginPath(); c.ellipse(lx, ly + k, Math.sqrt(169 - k * k * 0.5), 1.5, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#1a1210'; c.fillRect(lx - 7, ly - 21, 14, 4); c.fillRect(lx - 7, ly + 17, 14, 4);
    c.fillStyle = '#ffe9c8'; c.font = `700 11px ${FONT}`; c.fillText('拉', lx, ly);
    // 暖帘
    for (let k = 0; k < 4; k++) { const nx = sx + 8 + k * (sw - 16) / 4; c.fillStyle = mix('#2a3a6a', '#141a30', n * 0.5); c.fillRect(nx + 1, gy + 26, (sw - 16) / 4 - 2, 24); }
  }
  if (kind === 'bar') { // 霓虹
    const bx = sx + sw / 2, by = gy - 34;
    c.fillStyle = '#120c14'; rr(c, bx - 44, by - 18, 88, 36, 6); c.fill();
    c.font = `800 24px ${FONT}`;
    if (n > 0.3) { glow(c, bx, by, 110, `rgba(255,90,170,${0.3 * n})`); c.shadowColor = '#ff4fa0'; c.shadowBlur = 14; }
    c.fillStyle = n > 0.3 ? '#ffb6dc' : '#8a6a7a'; c.fillText('酒 BAR', bx, by + 1);
    c.shadowBlur = 0;
  }
  if (kind === 'pharmacy') { const px = sx + sw - 20, py = gy - 30; if (n > 0.3) glow(c, px, py, 60, `rgba(60,230,130,${0.4 * n})`); c.fillStyle = n > 0.3 ? '#4dff9a' : '#2fae6a'; c.fillRect(px - 16, py - 5, 32, 10); c.fillRect(px - 5, py - 16, 10, 32); }
  if (n > 0.3) glow(c, sx + sw / 2, base + 14, sw * 0.7, `rgba(${P.light},${0.16 * n})`);
}

// ---------- 吸烟区 ----------
export const ASHTRAY = { x: 1160, y: 640, w: 110, h: 280 };
export function buildStreet(c, sky, blinkers) {
  const n = sky.night, rnd = mulberry32(21), L = -MARGIN, R = VW + MARGIN;
  drawSky(c, sky, L, R, 0, 560, 520);
  drawStars(c, sky, rnd, L, R, 0, 420);
  drawSunMoon(c, sky, 80, 1520, 470, 90);
  drawClouds(c, sky, rnd, L, R, 60, 300, 6);
  if (n > 0.3) glow(c, 800, 520, 900, `rgba(255,150,90,${0.08 * n})`);
  // 远景（带一点雾）
  const far = document.createElement('canvas'); far.width = c.canvas.width; far.height = c.canvas.height;
  const fc = far.getContext('2d'); fc.setTransform(c.getTransform());
  skyline(fc, rnd, sky, 470, 60, 190, '#9aa8bf', '#151a30', 0.35, blinkers);
  skyline(fc, rnd, sky, 470, 30, 110, '#8a98ae', '#10142a', 0.15);
  if (CAN_BLUR) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'blur(1.6px)'; c.drawImage(far, 0, 0); c.restore(); } else { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(far, 0, 0); c.restore(); }
  // 对面的楼
  const shops = ['ramen', 'laundry', 'shutter', 'bar', 'pharmacy', 'shutter', 'ramen'];
  let x = L - 20, i = 0;
  while (x < R) {
    const w = 190 + rnd() * 120, h = 300 + rnd() * 230;
    building(c, rnd, sky, x, w, 610 - h, 610, i, shops[i % shops.length]);
    x += w + 6 + rnd() * 10; i++;
  }
  // 对面人行道
  c.fillStyle = mix('#b4afa6', '#2e2d33', n); c.fillRect(L, 610, R - L, 22);
  c.fillStyle = mix('#d4d0c8', '#3c3b42', n); c.fillRect(L, 628, R - L, 5);
  // 路灯
  const lx = 760;
  c.fillStyle = mix('#5a5c64', '#1c1d22', n);
  c.fillRect(lx - 4, 250, 8, 380); c.fillRect(lx - 8, 618, 16, 12);
  c.strokeStyle = c.fillStyle; c.lineWidth = 6; c.beginPath(); c.moveTo(lx, 254); c.quadraticCurveTo(lx, 222, lx + 50, 220); c.stroke();
  rr(c, lx + 36, 212, 58, 14, 5); c.fill();
  if (n > 0.3) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = lin(c, 0, 226, 0, 770, [[0, `rgba(255,214,150,${0.26 * n})`], [1, 'rgba(255,214,150,0)']]);
    c.beginPath(); c.moveTo(lx + 42, 226); c.lineTo(lx + 88, 226); c.lineTo(lx + 230, 770); c.lineTo(lx - 100, 770); c.fill();
    glow(c, lx + 65, 228, 90, `rgba(255,220,160,${0.5 * n})`);
    c.restore();
    c.fillStyle = '#fff2c8'; c.fillRect(lx + 42, 224, 46, 4);
  }
  // 马路
  c.fillStyle = lin(c, 0, 633, 0, 772, [[0, mix('#5c5d63', '#15151a', n)], [1, mix('#4a4b51', '#101014', n)]]);
  c.fillRect(L, 633, R - L, 139);
  for (let k = 0; k < 1400; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; c.fillRect(L + rnd() * (R - L), 633 + rnd() * 139, 2, 1); }
  c.fillStyle = mix('#e8e2c0', '#6a6650', n);
  for (let k = L; k < R; k += 120) c.fillRect(k + 30, 700, 60, 5);
  // 斑马线（朝灭点收拢）
  c.fillStyle = mix('#e6e6e2', '#3c3c42', n);
  for (let k = 0; k < 7; k++) { const xb = 40 + k * 46; const t = (633 - VP[1]) / (772 - VP[1]); c.beginPath(); c.moveTo(lerp(VP[0], xb, t), 633); c.lineTo(lerp(VP[0], xb + 26, t), 633); c.lineTo(xb + 26, 772); c.lineTo(xb, 772); c.fill(); }
  ellipse(c, 1100, 742, 40, 9, mix('#3a3b40', '#0c0c10', n)); ellipse(c, 1100, 742, 34, 7, mix('#4a4b50', '#16161a', n));
  if (n > 0.4) { // 湿路面上的倒影
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [rx, col] of [[300, '255,200,130'], [560, '255,110,170'], [960, '170,220,255'], [1240, '120,255,170'], [lx + 65, '255,220,160']]) c.fillStyle = lin(c, 0, 640, 0, 772, [[0, `rgba(${col},${0.12 * n})`], [1, 'rgba(0,0,0,0)']]), c.fillRect(rx - 18, 640, 36, 132);
    c.restore();
  }
  // 我们这边的马路牙子和人行道
  c.fillStyle = mix('#c4beb2', '#3a3940', n); c.fillRect(L, 772, R - L, 10);
  c.fillStyle = mix('#8e897f', '#222126', n); c.fillRect(L, 782, R - L, 12);
  c.fillStyle = lin(c, 0, 794, 0, VH, [[0, mix('#a8a297', '#2a2930', n)], [1, mix('#8a8478', '#1f1e24', n)]]);
  c.fillRect(L, 794, R - L, VH - 794);
  perspectiveTiles(c, L, R, 794, VH + 40, VP[0], VP[1], 6, 9, 'rgba(0,0,0,.13)');
  // 电线杆
  const px = 70;
  c.fillStyle = lin(c, px - 14, 0, px + 14, 0, [[0, mix('#5a4c40', '#120f0c', n)], [0.5, mix('#7a6a5a', '#1e1a16', n)], [1, mix('#4a3e34', '#0c0a08', n)]]);
  c.fillRect(px - 13, 40, 26, 750);
  c.fillStyle = mix('#3a3430', '#0a0908', n); c.fillRect(px - 60, 96, 120, 8); c.fillRect(px - 50, 140, 100, 6);
  rr(c, px + 14, 200, 34, 50, 4); c.fill();
  c.strokeStyle = mix('#2a2a2a', '#050508', n); c.lineWidth = 2;
  for (const [y0, sag, y1] of [[98, 60, 120], [100, 80, 150], [142, 50, 170]]) { c.beginPath(); c.moveTo(px - 50, y0); c.quadraticCurveTo(800, y1 + sag, R, y1); c.stroke(); }
  // 店里透出来的暖光，照着我们脚下
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = lin(c, 0, VH, 0, 760, [[0, `rgba(255,232,190,${0.05 + 0.2 * n})`], [1, 'rgba(255,232,190,0)']]);
  c.fillRect(L, 760, R - L, VH - 760);
  c.restore();
}
// 近景：烟灰桶、立牌、屋檐（车从它们后面开过去）
export function buildStreetNear(c, sky) {
  const n = sky.night, L = -MARGIN, R = VW + MARGIN;
  // 烟灰桶
  drawAshtray(c, n);
  // 吸烟区立牌
  const sx = 150, sy = 828;
  c.fillStyle = 'rgba(0,0,0,.25)'; ellipse(c, sx + 50, sy + 72, 60, 8, 'rgba(0,0,0,.25)');
  c.fillStyle = mix('#3a3c44', '#1a1b20', n); c.fillRect(sx + 46, sy - 10, 8, 82);
  c.fillStyle = mix('#f2f0ea', '#9a988e', n * 0.6); rr(c, sx, sy - 60, 100, 64, 6); c.fill();
  c.fillStyle = '#1d8a66'; rr(c, sx + 4, sy - 56, 92, 22, 4); c.fill();
  c.fillStyle = '#fff'; c.font = `700 14px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('吸烟区', sx + 50, sy - 45);
  c.fillStyle = '#3a3a40'; c.font = `600 10px ${FONT}`; c.fillText('SMOKING AREA', sx + 50, sy - 20); c.fillText('请把烟头丢进烟灰桶', sx + 50, sy - 6);
  // 屋檐（离眼睛很近，糊一点）
  const aw = document.createElement('canvas'); aw.width = c.canvas.width; aw.height = c.canvas.height;
  const ac = aw.getContext('2d'); ac.setTransform(c.getTransform());
  awning(ac, n, L, R);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); if (CAN_BLUR) c.filter = 'blur(2.5px)'; c.drawImage(aw, 0, 0); c.restore();
}
function awning(c, n, L, R) {
  const green = mix('#2f8f6a', '#163e30', n * 0.7), white = mix('#f2f5f0', '#7f8c84', n * 0.7);
  for (let x = L - 40, k = 0; x < R; x += 70, k++) {
    c.fillStyle = k % 2 ? white : green;
    c.beginPath(); c.moveTo(x, -10); c.lineTo(x + 70, -10); c.lineTo(x + 70, 96 + Math.sin((x + 35) / 260) * 6); c.lineTo(x, 96 + Math.sin(x / 260) * 6); c.fill();
    c.beginPath(); c.arc(x + 35, 96 + Math.sin((x + 35) / 260) * 6, 35, 0, Math.PI); c.fill();
  }
  c.fillStyle = lin(c, 0, 0, 0, 140, [[0, 'rgba(0,0,0,.35)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.18)']]);
  c.fillRect(L, -10, R - L, 150);
  if (n > 0.3) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,236,200,${0.12 * n})`; c.fillRect(L, -10, R - L, 140); c.restore(); }
}
function drawAshtray(c, n) {
  const { x, y, w, h } = ASHTRAY, cx = x + w / 2, base = y + h;
  ellipse(c, cx, base, w * 0.75, 12, 'rgba(0,0,0,.35)');
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, mix('#6a6e76', '#24262c', n)], [0.35, mix('#c8ccd4', '#5a5e68', n)], [0.6, mix('#9ca0a8', '#3a3d45', n)], [1, mix('#5a5e66', '#1c1e23', n)]]);
  c.fillRect(x, y + 20, w, h - 20);
  ellipse(c, cx, base, w / 2, 10, mix('#5a5e66', '#1c1e23', n));
  // 顶部托盘和沙子
  ellipse(c, cx, y + 20, w / 2 + 10, 16, mix('#4a4d55', '#18191d', n));
  ellipse(c, cx, y + 18, w / 2 + 4, 12, mix('#d8c9a0', '#5a5444', n));
  const r2 = mulberry32(3);
  for (let i = 0; i < 9; i++) {
    const bx = cx + (r2() - 0.5) * w * 0.8, by = y + 14 + r2() * 8, a = r2() * Math.PI;
    c.save(); c.translate(bx, by); c.rotate(a); c.fillStyle = mix('#f4f2ec', '#8a887e', n * 0.6); c.fillRect(-9, -2, 14, 4); c.fillStyle = mix('#d6974a', '#6a4a24', n * 0.6); c.fillRect(-9, -2, 5, 4); c.fillStyle = '#555'; c.fillRect(5, -2, 2, 4); c.restore();
  }
  // 投烟口和标签
  c.fillStyle = mix('#1c1d22', '#060608', n); rr(c, cx - 28, y + 60, 56, 16, 8); c.fill();
  c.fillStyle = mix('#c7372f', '#5a1e1a', n * 0.7); rr(c, cx - 30, y + 110, 60, 46, 4); c.fill();
  c.fillStyle = mix('#ffffff', '#b0a8a0', n * 0.5); c.font = `700 13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('烟灰桶', cx, y + 126); c.font = `600 9px ${FONT}`; c.fillText('ASH TRAY', cx, y + 143);
  c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + w * 0.3, y + 22, 6, h - 30);
}

// ---------- 躺下：抬头看天 ----------
export function buildLieSky(c, sky, onRoof = false) {
  const n = sky.night, rnd = mulberry32(99), L = -MARGIN, R = VW + MARGIN;
  drawSky(c, sky, L, R, 0, VH, VH);
  drawStars(c, sky, rnd, L, R, 0, VH, onRoof ? 520 : 360);
  drawClouds(c, sky, rnd, L, R, 100, 800, onRoof ? 6 : 9);
  if (onRoof) { // 房顶上躺着：只有天，脚边露出一截栏杆和串灯
    c.fillStyle = mix('#9a9aa4', '#3c3c48', n); c.fillRect(L, VH - 40, R - L, 8); for (let x = L; x < R; x += 120) c.fillRect(x, VH - 40, 6, 40);
    c.strokeStyle = 'rgba(20,20,24,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(L, 120); c.quadraticCurveTo(800, 330, R, 90); c.stroke();
    for (let k = 1; k < 16; k++) { const t = k / 16, x = lerp(L, R, t), y = (1 - t) ** 2 * 120 + 2 * (1 - t) * t * 330 + t * t * 90; ellipse(c, x, y + 10, 6, 8, n > 0.15 ? 'rgba(255,214,140,.95)' : 'rgba(240,235,220,.6)'); if (n > 0.15) glow(c, x, y + 10, 40, `rgba(255,190,110,${0.3 * n})`); }
    return;
  }
  const wall = mix('#9aa0ae', '#0e1020', n), wall2 = mix('#7e8494', '#0a0b16', n);
  c.fillStyle = wall; c.beginPath(); c.moveTo(L, VH); c.lineTo(L, 0); c.lineTo(260, 0); c.lineTo(420, VH); c.fill();
  c.fillStyle = wall2; c.beginPath(); c.moveTo(R, VH); c.lineTo(R, 0); c.lineTo(1280, 0); c.lineTo(1100, VH); c.fill();
  for (let i = 0; i < 11; i++) {
    const y = 30 + i * 90, k = y / VH;
    for (const [x0, x1, s] of [[lerp(150, 330, k), 0, 1], [lerp(1340, 1170, k), 0, -1]]) {
      const lit = rnd() < 0.15 + 0.4 * n;
      c.fillStyle = lit ? `rgba(255,205,130,${0.5 + 0.4 * n})` : mix('#5a6a84', '#0b0c16', n);
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + 40 * s, y + 6); c.lineTo(x0 + 40 * s, y + 46); c.lineTo(x0, y + 40); c.fill();
    }
  }
  if (n > 0.3) { c.fillStyle = '#4a4c56'; rr(c, 1020, 120, 120, 26, 8); c.fill(); c.fillStyle = '#fff2c8'; c.fillRect(1030, 140, 100, 6); glow(c, 1080, 150, 220, `rgba(255,220,160,${0.3 * n})`); }
  // 屋檐从下面探进来
  const green = mix('#2f8f6a', '#163e30', n * 0.7), white = mix('#f2f5f0', '#7f8c84', n * 0.7);
  for (let x = L, k = 0; x < R; x += 80, k++) { c.fillStyle = k % 2 ? white : green; c.fillRect(x, VH - 70, 80, 70); }
}

// ---------- 第一视角里其他人站的位置 [x, 脚底 y] ----------
const STREET_SLOTS = [[300, 935], [600, 920], [130, 870], [430, 858], [720, 866], [960, 852], [1180, 846], [60, 818], [250, 812], [480, 810], [700, 806], [920, 808], [1130, 805], [1460, 816], [360, 798], [580, 797], [820, 796], [1030, 797], [1240, 798], [160, 799]];
export function slotPos(slot, place) {
  const list = STREET_SLOTS;
  const [x, y] = list[slot % list.length];
  const lap = Math.floor(slot / list.length);
  const yy = y - lap * 6;
  const h = lerp(150, 330, clamp((yy - 790) / 150, 0, 1));
  return [x + lap * 34, yy, h];
}

// ---------- 车流和路人 ----------
export function makeTraffic() { return { cars: [], peds: [], nextCar: 1.5, nextPed: 2 }; }
const CAR_COLS = ['#c94f4f', '#e8e8e8', '#2a2d3a', '#4f7fc9', '#d9a441', '#5a9e6a', '#8a8d95', '#f4f4f4', '#1c1c20'];
export function updateTraffic(T, dt, onCar) {
  T.nextCar -= dt; T.nextPed -= dt;
  if (T.nextCar <= 0) {
    const lane = Math.random() < 0.5 ? 0 : 1, dir = lane ? 1 : -1;
    const r = Math.random(), type = r < 0.12 ? 'scooter' : r < 0.2 ? 'bus' : r < 0.36 ? 'taxi' : 'car';
    const len = { car: 230, taxi: 230, bus: 520, scooter: 90 }[type] * (lane ? 1 : 0.8);
    T.cars.push({ lane, dir, len, type, x: dir > 0 ? -len - 80 : VW + 80, v: (lane ? 420 : 300) * (0.75 + Math.random() * 0.5), col: CAR_COLS[(Math.random() * CAR_COLS.length) | 0] });
    T.nextCar = 2.5 + Math.random() * 7;
    onCar?.(lane);
  }
  if (T.nextPed <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; T.peds.push({ x: dir > 0 ? -30 : VW + 30, dir, v: 40 + Math.random() * 25, col: CAR_COLS[(Math.random() * CAR_COLS.length) | 0], ph: Math.random() * 6, h: 64 + Math.random() * 10 }); T.nextPed = 4 + Math.random() * 9; }
  for (const car of T.cars) car.x += car.dir * car.v * dt;
  for (const p of T.peds) { p.x += p.dir * p.v * dt; p.ph += dt * 7; }
  T.cars = T.cars.filter((c) => c.x > -700 && c.x < VW + 700);
  T.peds = T.peds.filter((p) => p.x > -60 && p.x < VW + 60);
}
export function drawTraffic(c, T, n) {
  for (const p of T.peds) {
    const y = 622, h = p.h, sw = Math.sin(p.ph) * 5;
    const body = mix(p.col, '#101016', n * 0.75), skin = mix('#d8b090', '#2a2420', n * 0.75);
    capsule(c, p.x - 2, y - h * 0.45, p.x - 2 + sw, y - 2, 5, mix('#2a2a30', '#0a0a0e', n));
    capsule(c, p.x + 2, y - h * 0.45, p.x + 2 - sw, y - 2, 5, mix('#2a2a30', '#0a0a0e', n));
    c.fillStyle = body; rr(c, p.x - 7, y - h * 0.82, 14, h * 0.4, 5); c.fill();
    ellipse(c, p.x, y - h * 0.9, 6, 7, skin);
  }
  for (const car of [...T.cars].sort((a, b) => a.lane - b.lane)) drawCar(c, car, n);
}
function capsule(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function drawCar(c, car, n) {
  const s = car.lane ? 1 : 0.78, base = car.lane ? 758 : 700, L = car.len, x = car.x, f = car.dir;
  c.save(); c.translate(x + (f < 0 ? L : 0), base); c.scale(f * s / (car.lane ? 1 : 0.8) * (car.lane ? 1 : 0.8) / s * s, s);
  // 统一按朝右画，宽度 L/s
  const w = L / s;
  ellipse(c, w / 2, 2, w / 2, 6, 'rgba(0,0,0,.35)');
  const body = mix(car.type === 'taxi' ? '#f2c14e' : car.type === 'bus' ? '#3a7a5a' : car.col, '#0c0c10', n * 0.5);
  if (car.type === 'scooter') {
    capsule(c, 14, -14, 76, -14, 6, '#222');
    ellipse(c, 16, -14, 14, 14, '#151515'); ellipse(c, 76, -14, 14, 14, '#151515'); ellipse(c, 16, -14, 6, 6, '#777'); ellipse(c, 76, -14, 6, 6, '#777');
    c.fillStyle = body; rr(c, 20, -40, 50, 18, 8); c.fill();
    c.fillStyle = mix('#e8b030', '#4a3810', n * 0.5); rr(c, 2, -82, 40, 36, 3); c.fill();
    c.fillStyle = mix('#3a5a8a', '#101828', n); rr(c, 44, -84, 18, 30, 6); c.fill(); ellipse(c, 54, -94, 9, 10, mix('#f2f2f2', '#555', n));
    c.restore(); return;
  }
  const H = car.type === 'bus' ? 150 : 60, cab = car.type === 'bus' ? 0 : 40;
  c.fillStyle = lin(c, 0, -H - cab, 0, 0, [[0, shade(body, 1.25)], [0.6, body], [1, shade(body, 0.7)]]);
  rr(c, 0, -H - 10, w, H, car.type === 'bus' ? 14 : 18); c.fill();
  if (cab) { c.beginPath(); c.moveTo(w * 0.2, -H - 6); c.lineTo(w * 0.32, -H - cab - 4); c.lineTo(w * 0.72, -H - cab - 4); c.lineTo(w * 0.86, -H - 6); c.fill(); }
  const glass = mix('#9fc3dd', '#16202e', n);
  c.fillStyle = lin(c, 0, -H - cab, 0, -H, [[0, shade(glass, 1.2)], [1, shade(glass, 0.8)]]);
  if (cab) { c.beginPath(); c.moveTo(w * 0.25, -H - 8); c.lineTo(w * 0.34, -H - cab + 2); c.lineTo(w * 0.51, -H - cab + 2); c.lineTo(w * 0.51, -H - 8); c.fill(); c.beginPath(); c.moveTo(w * 0.54, -H - 8); c.lineTo(w * 0.54, -H - cab + 2); c.lineTo(w * 0.7, -H - cab + 2); c.lineTo(w * 0.81, -H - 8); c.fill(); }
  else for (let k = 30; k < w - 60; k += 70) { rr(c, k, -H + 6, 56, 50, 6); c.fill(); }
  if (car.type === 'bus') { rr(c, w - 50, -H + 6, 40, 90, 6); c.fill(); c.fillStyle = '#ffb030'; c.font = `700 18px ${FONT}`; c.textAlign = 'center'; c.fillText('32 路', w - 120, -H + 76); }
  if (car.type === 'taxi') { c.fillStyle = '#fff6c8'; rr(c, w * 0.44, -H - cab - 16, 30, 12, 3); c.fill(); c.fillStyle = '#222'; c.font = `700 9px ${FONT}`; c.textAlign = 'center'; c.fillText('TAXI', w * 0.44 + 15, -H - cab - 9); }
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(w * 0.52, -H - 6, 2, H - 10);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(8, -H + 8, w - 16, 3);
  for (const wx of car.type === 'bus' ? [70, w - 90] : [w * 0.2, w * 0.8]) { ellipse(c, wx, -12, 24, 24, '#111'); ellipse(c, wx, -12, 12, 12, mix('#b8bcc4', '#3a3c44', n)); }
  c.fillStyle = n > 0.3 ? '#fff6dc' : '#e8e8e0'; rr(c, w - 10, -H + 14, 10, 12, 3); c.fill();
  c.fillStyle = n > 0.3 ? '#ff3a2a' : '#b8302a'; rr(c, 0, -H + 12, 8, 14, 3); c.fill();
  c.restore();
}
export function drawTrafficLights(c, T, n) {
  if (n < 0.3) return;
  for (const car of T.cars) {
    if (car.type === 'scooter') continue;
    const s = car.lane ? 1 : 0.78, base = car.lane ? 758 : 700, H = (car.type === 'bus' ? 150 : 60) * s;
    const front = car.dir > 0 ? car.x + car.len : car.x, back = car.dir > 0 ? car.x : car.x + car.len;
    glow(c, front + car.dir * 60 * s, base - H + 20 * s, 160 * s, `rgba(255,240,200,${0.28 * n})`);
    glow(c, front, base - H + 20 * s, 30 * s, `rgba(255,250,230,${0.8 * n})`);
    glow(c, back, base - H + 19 * s, 26 * s, `rgba(255,50,30,${0.6 * n})`);
  }
}
