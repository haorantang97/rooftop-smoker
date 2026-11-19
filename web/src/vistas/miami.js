// 迈阿密霓虹：亚热带海滨城市的黄昏。十二层海边酒店的楼顶，朝南看：
// 左手边是大西洋和一长条白沙滩（彩色的救生员小屋、遮阳伞、一排排棕榈树），浪花一层层推上来；
// 脚下沿着海滨大道是一排粉彩色的装饰艺术风格小酒店：横向遮阳檐、竖着的「鳍」、楼檐和竖鳍上镶着霓虹灯管，天一黑全亮起来；
// 右手边隔着海湾是市中心的摩天楼群（楼顶的彩色灯带慢慢变色）、海边的摩天轮，一条长堤横过海湾，车灯在上面流动；
// 港口停着两艘灯火通明的邮轮，海上还有一艘慢慢开过。日落时天边粉、紫、橙，夜里整片天被城市映成洋红。
// 原创场景：参考的是真实海滨城市的建筑风格（粉彩装饰艺术、棕榈、救生员小屋），不照搬任何具体建筑、作品或宣传画。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, smooth, clamp, lerp, facadeMaterial, bldAttr, makeLights, waterMaterial, updateWater, cloudLayer, makeArt, artSky, GLSL } from './common.js';

const G = -38;                 // 街面（天台往下 38 米，大约十二层）
const WATER = G - 1.4;
// 地理：+x 是西（太阳在那边落下），-x 是东（大西洋），-z 是南
// 海岸往南微微向东弯（美术需要，不照真实地图）
const C = (z) => (z < 0 ? -0.00004 * z * z : 0), dC = (z) => (z < 0 ? -0.00008 * z : 0);
const C_GLSL = '(vGP.z < 0. ? -.00004 * vGP.z * vGP.z : 0.)';
// 南边一个往东伸进海里的海角：北岸是沙滩（岸线 z = PS(x)），往南依次是公园、海角大道、一排门脸朝北（正对天台）的霓虹酒店，后面几座高楼
const PS = (x) => -340 + 30 * Math.sin((x + 250) * 0.002) - 0.00005 * (x + 250) ** 2, dPS = (x) => 0.06 * Math.cos((x + 250) * 0.002) - 0.0001 * (x + 250);
const PS_GLSL = '(-340. + 30. * sin((vGP.x + 250.) * .002) - .00005 * (vGP.x + 250.) * (vGP.x + 250.))';
const PX0 = -1700;            // 海角东头
const SHORE_GLSL = `(-178. + 22. * sin(vGP.z * .0006 + .7) + 10. * sin(vGP.z * .0021) + ${C_GLSL})`;
const SHORE = (z) => -178 + 22 * Math.sin(z * 0.0006 + 0.7) + 10 * Math.sin(z * 0.0021) + C(z); // 沙滩和海的分界
const BAY = (z) => 1250 + 120 * Math.sin(z * 0.0005 + 1.3);   // 岛西边的海湾岸
const MAIN = (z) => 4300 + 180 * Math.sin(z * 0.0004 + 0.4);   // 海湾对岸（市中心）
const ZS = -2700, ZN = 16000;  // 岛的南头、北边
const PARK0 = -74;             // 沙滩和海滨公园的分界（z < 0 时再加上 C(z)，下同）
const PK = (z) => PARK0 + C(z);
const FRONT = -23;             // 海滨大道这排酒店的门脸
const STREET0 = -2350, STREET_P = 135; // 横街：z = -2350 + k·135
const AVES = [60, 360, 660, 960];       // 岛上南北向的大街

const PASTEL = ['#f7b4c8', '#a6e8d4', '#c9b6f2', '#ffd2a2', '#a8d2f6', '#fff0a4', '#f6f0e6', '#ffbea0', '#b4f0de', '#ecc6f2', '#ffe2ec', '#cdeefa'];
const NEON = [[1, 0.16, 0.55], [0.12, 0.9, 1], [0.62, 0.22, 1], [0.4, 1, 0.38], [1, 0.45, 0.12], [0.25, 0.5, 1], [1, 0.3, 0.85], [0.2, 1, 0.8]];
const TRIMS = ['#fbf6ee', '#ffffff', '#f2e8f4', '#e6f6f2', '#fff4e0'];
const ACCENT = ['#5ab8e0', '#f08ab0', '#5ad0b0', '#f0a050', '#a088e0', '#40a8c8', '#f6c040']; // 米白墙上的点缀色
const CONDO = ['#f2f0ea', '#e8eef2', '#9ab8c8', '#c8d8e0', '#dcd6cc', '#7e9cae'];
const GLASS = ['#5a7486', '#3e5668', '#78a0b4', '#2e3e4c', '#8ab0c2', '#4a6272'];

export function createMiami(scene) {
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const r = rng(1925);
  const facade = facadeMaterial({ roughness: 0.8, ao: 18, shops: 1 });
  const fu = facade.userData.u;
  fu.uStreet.value.set('#ff5aa8'); fu.uStreetK.value = 0.2; // 夜里楼脚被霓虹和街灯映成粉色
  const reserved = [];
  const reserve = (x0, x1, z0, z1) => reserved.push([x0, x1, z0, z1]);
  const isReserved = (x0, x1, z0, z1) => reserved.some(([a, b, c, d]) => x1 > a && x0 < b && z1 > c && z0 < d);
  reserve(-12, 12, -3, 16); // 自己这栋（天台 x -11..11、z -1.6..14.4）

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();
  const pick = (a) => a[(r() * a.length) | 0];

  // ---------- 楼：一批批实例化的盒子（程序化楼窗）----------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const tiles = new Map();
  function box(x, z, sx, sz, y0, h, color, bld, rot = 0, cm = 0.55 + r() * 0.3) {
    const key = `${Math.floor(x / 1600)},${Math.floor(z / 1600)}`;
    let t = tiles.get(key); if (!t) tiles.set(key, (t = { m: [], c: [], b: [] }));
    tmpM.compose(tmpP.set(x, y0, z), tmpQ.setFromAxisAngle(up, rot), tmpS.set(sx, h, sz));
    t.m.push(tmpM.clone()); t.c.push(tmpC.set(color).multiplyScalar(cm).clone()); t.b.push(bld);
  }
  const cyl = []; // 圆角转角（装饰艺术常见的圆柱形转角楼）
  const trim = [];  // 遮阳檐、竖鳍、女儿墙台阶、雨篷：[x, y, z, sx, sy, sz, color]
  const neon = [];  // 霓虹灯管、灯箱招牌：[x, y, z, sx, sy, sz, [r,g,b]]
  const led = [];   // 市中心楼顶的彩色灯带：[x, y, z, sx, sy, sz, hue]
  const lightPts = [], cafe = [], refl = [], cars = [], reflSrc = [], wetRefl = [];
  const palms = []; // [x, z, height, rot, uplight[r,g,b]]
  const T = (x, y, z, sx, sy, sz, c) => trim.push([x, y, z, sx, sy, sz, c]);
  const N = (x, y, z, sx, sy, sz, c) => neon.push([x, y, z, sx, sy, sz, c]);

  // ---------- 海滨大道这排装饰艺术酒店 ----------
  // 每家：粉彩色主体、每层窗上一道白色遮阳檐、门脸中间或一侧一片竖鳍（顶上冒出屋面），楼檐、竖鳍、一楼雨篷镶霓虹；
  // 有的竖鳍上挂一块竖招牌灯箱，有的屋顶立一排发光的「字」（只是一格格亮块，没有真的字）。
  function hotel(fx, zc, th, w, d, floors, nk = 1, promo = false) {
    // 局部坐标：lx 从门脸往里为正（往外为负），lz 沿门脸方向；(fx, zc) 是门脸中点，整栋转 th（th = 0 门脸朝东）
    const cs = Math.cos(th), sn = Math.sin(th), h = floors * 3.4 + 1.6;
    const W2 = (lx, lz) => [fx + cs * lx + sn * lz, zc - sn * lx + cs * lz];
    const TL = (lx, y, lz, sx, sy, sz, c) => { const [x, z] = W2(lx, lz); trim.push([x, y, z, sx, sy, sz, c, th]); };
    const NL = (lx, y, lz, sx, sy, sz, c) => { const [x, z] = W2(lx, lz); const k = (v) => (v < 0.5 ? v * nk : v); neon.push([x, y, z, k(sx), k(sy), k(sz), c, th]);
      if (promo && sz > 3 && sy < 0.5) for (let q = -sz / 2 + 2; q <= sz / 2; q += 7) { const [qx, qz] = W2(lx, lz + q); reflSrc.push([qx, y, qz, c]); } // 海角那排的横灯管在海湾水里拉出倒影
      if (lx < -1.5 && (sy > 2 || sz > 3)) for (let q = -Math.min(sz, 10) / 2; q <= Math.min(sz, 10) / 2; q += 3.5) { const [qx, qz] = W2(-8 + (r() - 0.5) * 7, lz + q); wetRefl.push({ x: qx, y: G + 0.12, z: qz, c, s: sy > 2 ? 3.4 : 2.2, seed: r() }); } }; // 招牌、雨篷灯映在湿路面上（门前大道的中线都在门脸外 8 米）
    // 真实的样子：一半是米白墙配一种亮色点缀（窗眉、竖鳍上色），一半整面粉彩、白色线脚
    const offWhite = r() < 0.45, col = offWhite ? pick(['#f6f0e6', '#fbf6ee', '#f2ece2']) : pick(PASTEL);
    const trimC = offWhite ? pick(ACCENT) : r() < 0.7 ? '#fbf6ee' : pick(TRIMS);
    { const [x, z] = W2(d / 2, 0); box(x, z, d, w, G, h, col, [r(), 0, G, 0.6 + r() * 0.9], th, 0.88 + r() * 0.12); }
    const n1 = pick(NEON), n2 = r() < 0.5 ? n1 : pick(NEON), mq = r() < 0.6 ? pick([NEON[1], NEON[5]]) : n2; // 招牌多半亮青、蓝光
    const brow = r() < 0.35;                                                                           // 窗眉底下打紫色霓虹
    for (let f = 1; f < floors; f++) {
      TL(-0.45, G + (f + 0.82) * 3.4, 0, 0.9, 0.18, w * 0.9, trimC);                                  // 遮阳檐（窗眉）
      if (brow) NL(-0.82, G + (f + 0.82) * 3.4 - 0.13, 0, 0.12, 0.12, w * 0.86, [0.62, 0.22, 1]);
    }
    TL(-1.4, G + 3.3, 0, 2.8, 0.16, w * 0.8, trimC);                                                // 一楼雨篷
    if (r() < 0.85) NL(-2.8, G + 3.25, 0, 0.14, 0.14, w * 0.8, mq);                                  // 雨篷边上的灯管
    NL(-0.14, G + h - 0.3, 0, 0.26, 0.26, w, n1);                                                   // 楼檐灯管
    if (r() < 0.6) for (const s2 of [-1, 1]) NL(d * 0.3, G + h - 0.3, s2 * (w / 2 + 0.06), d * 0.6, 0.26, 0.26, n1);
    if (r() < 0.55) NL(-0.14, G + 4.6, 0, 0.2, 0.2, w * 0.92, n2);                                   // 一楼上沿再一道
    if (r() < 0.78) { // 竖鳍
      const lzf = r() < 0.6 ? 0 : (r() < 0.5 ? -1 : 1) * w * 0.28, fh = 3 + r() * 7, fw = 1.8 + r() * 1.4;
      TL(-0.8, G + (h + fh) / 2, lzf, 1.6, h + fh, fw, trimC);
      TL(0.4, G + h + fh + 0.6, lzf, 2.4, 1.2, fw * 0.6, trimC);                                       // 鳍顶一小截台阶
      for (const s2 of [-1, 1]) NL(-1.65, G + 3.6 + (h + fh - 3.6) / 2, lzf + s2 * (fw / 2 + 0.05), 0.22, h + fh - 3.6, 0.22, n1);
      if (r() < 0.7) { const hh = Math.min(8, h * 0.6); NL(-2.1, G + 3.45 + hh / 2, lzf, 0.35, hh, 1.4, mq); } // 倒 T 招牌：竖招牌立在雨篷上
    } else { // 没有鳍：屋顶正中一个阶梯形女儿墙，有的立一排发光的「字」
      TL(1, G + h + 0.8, 0, 2, 1.6, w * 0.42, trimC); TL(1, G + h + 2.2, 0, 2, 1.2, w * 0.22, trimC);
      if (r() < 0.75) {
        const nL = 5 + ((r() * 4) | 0), lw = 1.2, gap = 0.45, tot = nL * lw + (nL - 1) * gap;
        for (let i = 0; i < nL; i++) { const lh = 1.5 + r() * 0.9; NL(2.2, G + h + 3 + lh / 2, -tot / 2 + lw / 2 + i * (lw + gap), 0.25, lh, lw, n2); }
      }
    }
    if (r() < 0.22) { // 转角的圆柱形凸窗
      const s2 = r() < 0.5 ? -1 : 1, [x, z] = W2(0.6, s2 * (w / 2 - 2.6));
      cyl.push([x, z, 3.2, h + 2, col]);
      NL(-2.65, G + 3.6 + (h - 2) / 2, s2 * (w / 2 - 2.6), 0.2, h - 2, 0.2, n1);
    }
    if (r() < 0.65) { const c = r() < 0.6 ? [1, 0.72, 0.42] : n2; for (let lz = -w * 0.42; lz <= w * 0.42; lz += 2.3) { const [x, z] = W2(-3.6, lz); cafe.push({ x, y: G + 2.9, z, c, s: 0.35 }); } } // 露天咖啡座的串灯
  }
  for (let k = 0; k <= 28; k++) {
    const zA = STREET0 + k * STREET_P + 8, zB = zA + STREET_P - 16;
    let z = zB;
    while (z > zA + 12) {
      let w = 18 + r() * 22; if (z - w < zA + 10) w = z - zA;
      const zc = z - w / 2; z -= w + 0.4;
      if (zc < PS(FRONT) - 118 || isReserved(FRONT + C(zc), FRONT + C(zc) + 30, zc - w / 2, zc + w / 2)) continue;
      const near = Math.abs(zc) < 260; // 身边几家矮一些，别挡正前方
      const floors = !near && r() < 0.1 ? 7 + ((r() * 4) | 0) : near ? 3 + ((r() * 1.6) | 0) : 3 + ((r() * 3.4) | 0);
      hotel(FRONT + C(zc), zc, Math.atan(dC(zc)), w - 0.6, 22 + r() * 14, floors);
    }
  }

  // 海角那排：门脸朝北正对天台，比海滨大道那排高一些（远，得大一点才看得清），霓虹更密
  for (let x = -290; x > PX0 + 90;) {
    let w = 20 + r() * 22; const xc = x - w / 2; x -= w + 0.5;
    if (Math.abs(((xc + 290) % 150 + 150) % 150 - 75) > 66) { x -= 10; continue; } // 每 150 米一条横街
    const fz = PS(xc) - 104, th = Math.atan2(1, dPS(xc)), d = 24 + r() * 14;
    reserve(xc - w / 2 - 4, xc + w / 2 + 4, fz - d - 6, fz + 4);
    hotel(xc, fz, th, w - 0.6, d, r() < 0.3 ? 8 + ((r() * 3) | 0) : 5 + ((r() * 3) | 0), 2, true);
  }

  // ---------- 岛上：南段低矮的粉彩街区；北边沿海一排高层公寓；南头几座高楼 ----------
  function plainBld(x, z, sx, sz, h, colors, style, neonP = 0) {
    box(x, z, sx, sz, G, h, pick(colors), [r(), style, G, 0.5 + r() * 1.1], 0, style === 0 ? 0.75 + r() * 0.25 : 0.6 + r() * 0.35);
    if (r() < neonP) { // 楼顶一圈霓虹（夜里公寓楼顶亮成青色、粉色）
      const c = pick(NEON), y = G + h - 0.4;
      N(x - sx / 2 - 0.1, y, z, 0.25, 0.25, sz, c); N(x + sx / 2 + 0.1, y, z, 0.25, 0.25, sz, c);
      N(x, y, z - sz / 2 - 0.1, sx, 0.25, 0.25, c); N(x, y, z + sz / 2 + 0.1, sx, 0.25, 0.25, c);
    }
  }
  // 海角上霓虹酒店后面几座白色高楼（左前方的天际线）
  for (const [x, z, h, w] of [[-1380, -760, 150, 34], [-1150, -700, 126, 30], [-960, -820, 168, 36], [-720, -740, 110, 30], [-520, -840, 140, 32], [-1560, -960, 96, 30], [-330, -1000, 120, 30], [-860, -1250, 132, 34]]) {
    reserve(x - w, x + w, z - w, z + w); plainBld(x, z, w, w * 1.3, h, CONDO, 2, 0.6);
  }  const lotFill = (x0, x1, z0, z1, fn) => { // 一个街区里排一圈楼
    for (const [za, zb] of [[z0, (z0 + z1) / 2 - 1], [(z0 + z1) / 2 + 1, z1]]) {
      let x = x0;
      while (x < x1 - 6) { let w = 16 + r() * 26; if (x + w > x1 - 8) w = x1 - x; fn(x + w / 2, (za + zb) / 2, w - 1.2, zb - za - 1.2); x += w + (r() < 0.15 ? 4 + r() * 8 : 0.6); }
    }
  };
  for (let k = 0; k <= 28; k++) {
    const zA = STREET0 + k * STREET_P + 8, zB = zA + STREET_P - 16;
    const south = zB < PS(0) - 150; // 海角上（酒店后面）的街区一直排到东头
    const xs = [south ? PX0 + 120 : 15 + C(zB), ...AVES.map((a) => a - 11), BAY((zA + zB) / 2) - 30];
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = i === 0 ? xs[0] : xs[i] + 22, xb = xs[i + 1];
      if (xb - xa < 30) continue;
      lotFill(xa, xb, zA, zB, (x, z, sx, sz) => {
        if (isReserved(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2) || r() < 0.05) return;
        const dd = Math.hypot(x, z);
        let h = 7 + Math.pow(r(), 1.8) * 16; if (r() < 0.06 && dd > 500) h += 14 + r() * 22; // 偶尔一栋高些
        plainBld(x, z, sx, sz, h, PASTEL.concat(TRIMS), r() < 0.82 ? 0 : 2, 0.06);
      });
    }
  }
  // 北边：沿海一排高层公寓（转身往北看是一整面亮着的墙），后面中低层
  for (let z = 1400; z < 9500; z += 0) {
    const w = 46 + r() * 30; const zc = z + w / 2; z += w + 14 + r() * 26;
    const far = (zc - 1400) / 8000, h = 50 + Math.pow(r(), 0.8) * (90 + 80 * Math.min(1, far * 2.5));
    plainBld(-6 + r() * 30, zc, 34 + r() * 18, w, h, CONDO, r() < 0.6 ? 2 : 1, 0.35);
    if (r() < 0.5) plainBld(150 + r() * 120, zc + (r() - 0.5) * 30, 30 + r() * 20, 30 + r() * 20, 30 + r() * 70, CONDO, 2, 0.12);
  }
  for (let z = 1400; z < 9500; z += 70 + r() * 40) for (let x = 320; x < BAY(z) - 40; x += 60 + r() * 40) if (r() < 0.7) plainBld(x, z, 26 + r() * 22, 26 + r() * 22, 8 + Math.pow(r(), 2) * 34, PASTEL.concat(CONDO), r() < 0.7 ? 0 : 2, 0.05);


  // ---------- 海湾对岸：市中心和南边的金融区（玻璃高楼，楼顶彩色灯带）----------
  const downtown = (cx, cz, rx, rz, n, hmax) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 2 * rx, z = cz + (r() - 0.5) * 2 * rz;
      if (x < MAIN(z) + 40) continue;
      const f = Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2) * 1.6);
      const h = 50 + Math.pow(r(), 1.4) * hmax * (0.35 + 0.65 * f), w = 26 + r() * 22, dpt = 26 + r() * 22, rot = (r() - 0.5) * 0.3;
      const style = r() < 0.6 ? 1 : 2;
      box(x, z, w, dpt, G, h, style === 1 ? pick(GLASS) : pick(CONDO), [r(), style, G, 0.8 + r() * 1], rot);
      if (h > 110 && r() < 0.75) { // 楼顶一圈灯带；有的四个角从上到下一条竖灯
        const kind = r(), y = G + h - 2;
        if (kind < 0.5) { const hue = [0.92, 0.8, 0.52, 0.62, 0.95][(r() * 5) | 0]; led.push([x, y, z, w + 0.6, 3, dpt + 0.6, hue, rot]); // 会慢慢变色的楼顶
          if (r() < 0.3) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) led.push([x + sx * w / 2, G + h / 2, z + sz * dpt / 2, 0.8, h, 0.8, hue, rot]); }
        else if (kind < 0.7) led.push([x, y, z, w + 0.6, 4, dpt + 0.6, r() < 0.5 ? 0.0 : 0.47, rot, true]);  // 固定的红顶、蓝绿顶
        else led.push([x, G + h / 2, z - dpt / 2 - 0.3, 1.2, h * 0.92, 1.2, 0.09, rot, true]);              // 沿整栋楼高的一条暖色灯带
      }
      if (h > 150 && r() < 0.6) lightPts.push({ x, y: G + h + 4, z, c: [1, 0.08, 0.04], s: 2.4, blink: true });
    }
  };
  downtown(4950, -1150, 520, 1100, 150, 300);
  downtown(5000, -4100, 450, 900, 90, 230);
  for (let i = 0; i < 700; i++) { // 后面一大片中低层
    const x = MAIN(0) + 300 + r() * 3200, z = -6000 + r() * 11000;
    if (Math.abs(x - 4950) < 500 && z > -2300 && z < 0) continue;
    box(x, z, 30 + r() * 30, 30 + r() * 30, G, 10 + Math.pow(r(), 2) * 50, pick(CONDO.concat(PASTEL)), [r(), r() < 0.5 ? 0 : 2, G, 0.8]);
  }

  // 自己这栋楼的下半截（天台模型自带往下 30 米的楼身，这里补到街面）：粉色，一楼雨篷和霓虹
  box(0, 6.4, 22, 16, G, 9, '#f7b4c8', [0.37, 0, G, 0.8], 0, 0.95);
  T(-12.2, G + 3.3, 6.4, 2.4, 0.16, 14, '#fbf6ee'); N(-13.4, G + 3.25, 6.4, 0.12, 0.12, 14, NEON[1]); N(-11.1, G + 7.6, 6.4, 0.18, 0.18, 16, NEON[0]);
  // 海湾里的小岛：几栋低矮的别墅
  for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, d = r(); box(800 + Math.cos(a) * 280 * d, -3180 + Math.sin(a) * 120 * d, 20 + r() * 20, 20 + r() * 16, G, 8 + r() * 14, pick(PASTEL), [r(), 0, G, 0.6]); }

  // ---------- 把一批批盒子变成实例化网格 ----------
  for (const t of tiles.values()) {
    const g = boxGeo.clone(); bldAttr(g, t.b);
    const im = new THREE.InstancedMesh(g, facade, t.m.length);
    t.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, t.c[i]); });
    im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }
  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 20); g.translate(0, 0.5, 0); bldAttr(g, cyl.map(() => [r(), 0, G, 0.9]));
    const im = new THREE.InstancedMesh(g, facade, Math.max(1, cyl.length)); im.count = cyl.length;
    cyl.forEach(([x, z, rad, h, c], i) => { tmpM.compose(tmpP.set(x, G, z), tmpQ.identity(), tmpS.set(rad, h, rad)); im.setMatrixAt(i, tmpM); im.setColorAt(i, tmpC.set(c).multiplyScalar(0.92)); });
    im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }
  const boxList = (list, mat, colorOf, shadow = true) => {
    const im = new THREE.InstancedMesh(boxGeo, mat, Math.max(1, list.length)); im.count = list.length;
    list.forEach((e, i) => { tmpM.compose(tmpP.set(e[0], e[1] - e[4] / 2, e[2]), tmpQ.setFromAxisAngle(up, e[7] || 0), tmpS.set(e[3], e[4], e[5])); im.setMatrixAt(i, tmpM); im.setColorAt(i, colorOf(e, i)); });
    im.castShadow = shadow; im.receiveShadow = shadow; im.computeBoundingSphere(); group.add(im); return im;
  };
  const trimMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
  boxList(trim, trimMat, (e) => tmpC.set(e[6]));
  const neonMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const neonMesh = boxList(neon, neonMat, (e) => tmpC.setRGB(e[6][0], e[6][1], e[6][2]), false);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const ledMesh = boxList(led, ledMat, (e) => tmpC.setHSL(e[6], 0.85, 0.55), false);

  // ---------- 地面：岛（海滨公园、海滨大道、街道网格）、对岸、港口小岛 ----------
  const grounds = [];
  const groundMat = ({ per, half, off, island = false, tint = [0.62, 0.58, 0.5] }) => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
    const u = { uNight: { value: 0 } }; grounds.push(u);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uNight; varying vec3 vGP;\n${GLSL.HASH}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 per = vec2(${per[0].toFixed(1)}, ${per[1].toFixed(1)}), hw = vec2(${half[0].toFixed(1)}, ${half[1].toFixed(1)});
          vec2 q = abs(mod(vGP.xz - vec2(${off[0].toFixed(1)}, ${off[1].toFixed(1)}) + per * .5, per) - per * .5);
          vec2 fw = fwidth(vGP.xz) + 1e-3;
          vec2 rd = 1. - smoothstep(hw - fw, hw + fw, q);
          vec2 wk = 1. - smoothstep(hw + 3.5 - fw, hw + 3.5 + fw, q);
          ${island ? 'float cx = vGP.x - ' + C_GLSL + '; if (vGP.x < 45.) { rd.x = 0.; wk.x = 0.; }' : ''}
          float road = max(rd.x, rd.y), walk = max(wk.x, wk.y) - road;
          float far = smoothstep(3., 12., max(fw.x, fw.y));
          road = mix(road, (hw.x * 2. / per.x + hw.y * 2. / per.y) * .9, far); walk = mix(walk, .12, far);
          vec3 lot = vec3(${tint.map((v) => v.toFixed(2)).join(',')}) * (.85 + .3 * vn21(vGP.xz * .02));
          float grass = 0., pink = 0.;
          ${island ? `
          float dr = abs(cx + 31.);                                   // 海滨大道
          float pz = vGP.z - ${PS_GLSL};
          if (pz < -60. && cx < -36.) {                                   // 海角：公园、海角大道
            float dq = abs(pz + 96.);
            road = 1. - smoothstep(5. - fw.y, 5. + fw.y, dq); walk = (1. - smoothstep(8.5 - fw.y, 8.5 + fw.y, dq)) - road; pink = 1.;
            if (pz > -90.5) { grass = 1.; road = 0.; walk = 1. - smoothstep(1.6 - fw.y, 1.6 + fw.y, abs(pz + 76. + 4. * sin(vGP.x * .02))); }
          } else {
            if (cx < -14. && pz > -102.) { road = 1. - smoothstep(5. - fw.x, 5. + fw.x, dr); walk = (1. - smoothstep(8.5 - fw.x, 8.5 + fw.x, dr)) - road; pink = 1.; }
            if (cx < -39.5) {                                            // 海滨公园：草地 + 一条弯弯的步道
              grass = 1.; road = 0.;
              float path = abs(cx + 69. + 3.5 * sin(vGP.z * .025)); // 波浪形步道把草地和沙滩隔开
              walk = 1. - smoothstep(1.6 - fw.x, 1.6 + fw.x, path);
            }
          }` : ''}
          vec3 gc = vec3(.25, .4, .16) * (.8 + .4 * vn21(vGP.xz * .08));
          diffuseColor.rgb *= mix(lot, gc, grass) * (1. - road - walk) + vec3(.13, .13, .14) * road + vec3(.82, .78, .72) * walk;
          float gEm = road + walk * .4;`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += mix(vec3(1., .55, .3), vec3(1., .35, .65), pink) * gEm * uNight * .28 + vec3(.9, .25, .75) * road * pink * uNight * .25 * (.4 + .6 * vn21(vGP.xz * vec2(.08, .5)));')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .3, road * pink);');
    };
    m.customProgramCacheKey = () => `miag${island}${per}`;
    return m;
  };
  const shapeMesh = (pts, mat, y) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    const me = new THREE.Mesh(g, mat); me.position.y = y; me.receiveShadow = true; group.add(me); return me;
  };
  {
    const isl = [];
    const zE = PS(PK(-600)) - 64; // 海滨公园和海角公园接上的地方
    for (let z = ZN; z > zE; z -= 100) isl.push([PK(z) + 2, z]);
    for (let x = PK(zE) + 2; x >= PX0; x -= 50) isl.push([x, PS(x) - 64]);
    isl.push([PX0 - 40, PS(PX0) - 200], [PX0, ZS]);
    for (let z = ZS; z <= ZN; z += 100) isl.push([BAY(z), z]);
    shapeMesh(isl, groundMat({ per: [300, STREET_P], half: [10, 7], off: [60, STREET0], island: true }), G);
    const main = []; for (let z = -16000; z <= 16000; z += 200) main.push([MAIN(z), z]); main.push([20000, 16000], [20000, -16000]);
    shapeMesh(main, groundMat({ per: [140, 120], half: [9, 7], off: [MAIN(0), 0], tint: [0.5, 0.48, 0.44] }), G);
    shapeMesh([[2600, -2440], [4100, -2440], [4100, -2960], [2600, -2960]], groundMat({ per: [400, 300], half: [6, 6], off: [2600, -2440], tint: [0.55, 0.55, 0.55] }), G); // 港口
    const fisher = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; fisher.push([800 + Math.cos(a) * 360, -3180 + Math.sin(a) * 170]); }
    shapeMesh(fisher, groundMat({ per: [120, 120], half: [4, 4], off: [800, -3180], tint: [0.32, 0.42, 0.24] }), G);
  }

  // ---------- 沙滩：从海滨公园缓缓斜下去没进海里；湿沙反光、潮线 ----------
  const beachMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
  beachMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGP;\n${GLSL.HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float above = vGP.y - (${WATER.toFixed(2)});
        float n1 = vn21(vGP.xz * .4), n2 = vn21(vGP.xz * .04);
        vec3 sand = mix(vec3(.82, .72, .56), vec3(.9, .8, .66), n2) * (.93 + .1 * n1);
        float wet = 1. - smoothstep(.06, .45, above);
        float wrack = exp(-pow((above - .6) * 7., 2.)) * smoothstep(.4, .7, vn21(vec2(vGP.z * .05, vGP.x * .3)));
        sand *= 1. - .18 * wrack;
        sand = mix(sand, vec3(.5, .43, .35), wet * .7);
        diffuseColor.rgb *= sand;
        float bWet = wet;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .18, bWet);');
  };
  {
    const NZ = 240, NX = 26, z0 = PS(-180) - 60, z1 = 12000;
    const g = new THREE.PlaneGeometry(1, 1, NX, NZ); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, z = lerp(z1, z0, v), sh = SHORE(z); // z 反过来排，面朝上
      const x = lerp(sh - 46, PK(z) + 3, u);
      let y = x < sh ? WATER - (sh - x) * 0.035 : lerp(WATER, G, Math.pow((x - sh) / (PK(z) + 3 - sh), 1.35));
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    const me = new THREE.Mesh(g, beachMat); me.receiveShadow = true; group.add(me);
  }
  // 海角北岸的沙滩（沿 x 方向）
  const PB1 = SHORE(PS(-180) - 30) - 40; // 西头接上海滨那条沙滩
  {
    const g = new THREE.PlaneGeometry(1, 1, 200, 24); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, x = lerp(PX0 - 30, PB1, u), ps = PS(x);
      const z = lerp(ps + 46, ps - 63, v);
      let y = z > ps ? WATER - (z - ps) * 0.035 : lerp(WATER, G, Math.pow((ps - z) / 63, 1.35));
      if (x < PX0 + 10) y = lerp(y, WATER - 2, smooth(PX0 + 10, PX0 - 30, x)); // 东头没进海里
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    const me = new THREE.Mesh(g, beachMat); me.receiveShadow = true; group.add(me);
  }
  const foams = [];
  // 浪花：一层透明的面贴在水面上，一道道白浪往岸上推，岸边一圈来回涌动的白沫
  const foamMat = (dist) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uCol: { value: new THREE.Color() } }]),
    vertexShader: `varying vec3 vGP;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vGP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec3 vGP;
      #include <fog_pars_fragment>
      ${GLSL.HASH}
      void main(){
        float d = ${dist};                                     // 离岸距离（往海里为正）
        float t = uTime;
        float ph = d / 21. + t * .11 + vn21(vec2(vGP.z * .004, 3.)) * 1.5;
        float band = smoothstep(.82, 1., fract(ph)) * smoothstep(70., 12., d) * smoothstep(-1., 6., d);
        band *= smoothstep(.25, .65, vn21(vec2(vGP.z * .06 + floor(ph) * 7., d * .15)));
        float sw = 2.2 + 2. * sin(t * .55 + vGP.z * .012) + 1.2 * sin(t * .9 + vGP.z * .031);
        float edge = exp(-pow((d + sw) / 1.8, 2.)) * (.6 + .4 * vn21(vec2(vGP.z * .3, t * .5)));
        float sheet = smoothstep(-sw - 1., -sw + 2., d) * smoothstep(8., 2., d) * .28 * vn21(vGP.xz * vec2(.3, .08) + t * .2);
        float a = clamp(band * .75 + edge * .9 + sheet, 0., 1.) * smoothstep(-sw - 3., -sw, d);
        if (a < .01) discard;
        gl_FragColor = vec4(uCol, a);
        #include <fog_fragment>
      }`,
  });
  {
    const g = new THREE.PlaneGeometry(1, 1, 8, 220); const p = g.attributes.position, z0 = PS(-200), z1 = 12000;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, z = lerp(z1, z0, v), sh = SHORE(z); p.setXYZ(i, lerp(sh - 80, sh + 8, u), WATER + 0.06, z); }
    const m = foamMat(`${SHORE_GLSL} - vGP.x`); foams.push(m);
    const me = new THREE.Mesh(g, m); me.renderOrder = 2; group.add(me);
  }
  {
    const g = new THREE.PlaneGeometry(1, 1, 160, 8); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, x = lerp(PX0 - 20, PB1 + 30, u), ps = PS(x); p.setXYZ(i, x, WATER + 0.06, lerp(ps - 8, ps + 80, v)); }
    const m = foamMat(`vGP.z - ${PS_GLSL}`); foams.push(m);
    const me = new THREE.Mesh(g, m); me.renderOrder = 2; group.add(me);
  }

  // ---------- 救生员小屋、遮阳伞 ----------
  const cbox = (w, h, d, x, y, z, col, rz = 0) => {
    const b = new THREE.BoxGeometry(w, h, d); if (rz) b.rotateZ(rz); b.translate(x, y, z);
    const c = new THREE.Color(col), a = new Float32Array(b.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
    b.setAttribute('color', new THREE.BufferAttribute(a, 3)); return b;
  };
  const colorize = (g, col) => { const c = new THREE.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  { // 救生员小屋：三种几何原型（方屋、圆屋、斜屋顶），骨架底座抬高约 2 米，木平台和坡道，屋身一色、屋顶另一色
    const WOOD = '#b98a5e', prep = (list) => mergeGeometries(list.map((p) => { if (p.attributes.uv) p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }));
    const base = () => {
      const l = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) l.push(cbox(0.2, 2.2, 0.2, sx * 1.2, 1.1, sz * 1.05, '#e8e4dc'));
      l.push(cbox(0.12, 0.12, 2.3, -1.2, 1.2, 0, '#e8e4dc', 0.9), cbox(0.12, 0.12, 2.3, 1.2, 1.2, 0, '#e8e4dc', -0.9));
      l.push(cbox(3.6, 0.18, 3.1, 0, 2.3, 0, WOOD), cbox(4.2, 0.1, 1, 3.6, 1.15, 0, WOOD, -0.5));
      l.push(cbox(0.05, 0.9, 3.1, -1.78, 2.85, 0, '#f4f2ee'));                             // 前面的栏杆
      l.push(cbox(0.04, 1.5, 0.04, 1.1, 6.4, 1.1, '#888888'), cbox(0.03, 0.45, 0.75, 1.1, 6.9, 1.5, '#e8382a')); // 小旗
      return prep(l);
    };
    const hutBox = () => prep([cbox(2.2, 2.3, 2.6, 0.2, 3.55, 0, '#ffffff'), cbox(0.05, 0.8, 1.9, -0.92, 3.9, 0, '#2a3a46')]);
    const roofBox = () => prep([cbox(3.4, 0.22, 3.6, -0.2, 4.85, 0, '#ffffff', 0.12)]);
    const hutRound = () => { const c = new THREE.CylinderGeometry(1.3, 1.3, 2.3, 14); c.translate(0.1, 3.55, 0); return prep([colorize(c, '#ffffff'), cbox(0.05, 0.8, 1.5, -1.22, 3.9, 0, '#2a3a46')]); };
    const roofRound = () => { const c = new THREE.CylinderGeometry(1.9, 1.9, 0.25, 16); c.translate(0.1, 4.85, 0); return prep([colorize(c, '#ffffff')]); };
    const hutSlant = () => { const b = cbox(2.2, 2.6, 2.6, 0.2, 3.7, 0, '#ffffff'); const p = b.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 4 && p.getX(i) < 0) p.setY(i, p.getY(i) + 0.9); b.computeVertexNormals(); return prep([b, cbox(0.05, 0.9, 1.9, -0.92, 4.1, 0, '#2a3a46')]); };
    const roofSlant = () => prep([cbox(3.6, 0.2, 3.4, 0.0, 5.45, 0, '#ffffff', -0.36)]);
    const protos = [[hutBox(), roofBox()], [hutRound(), roofRound()], [hutSlant(), roofSlant()]];
    const baseG = base();
    const towers = [];
    for (let z = PS(-200) + 60; z < 11000; z += 135 + r() * 40) { const x = SHORE(z) + 42 + r() * 8; towers.push([x, z, lerp(WATER, G, Math.pow((x - SHORE(z)) / (PK(z) + 3 - SHORE(z)), 1.35)), 0]); }
    for (let x = PX0 + 80; x < PB1 - 40; x += 125 + r() * 40) { const ps = PS(x), z = ps - 22 - r() * 6; towers.push([x, z, lerp(WATER, G, Math.pow((ps - z) / 63, 1.35)), Math.PI / 2 - Math.atan(dPS(x))]); }
    const HUT = ['#ff9ec8', '#ffe066', '#7ee08a', '#ffb070', '#b49cff', '#6ee0d8', '#ff7a8a', '#8ad0ff'];
    const mats = towers.map(([x, z, y, rot]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(up, rot + (r() - 0.5) * 0.3), new THREE.Vector3(1, 1, 1)));
    const kind = towers.map(() => (r() * 3) | 0), body = towers.map(() => (r() * HUT.length) | 0), roofC = body.map((b) => (b + 2 + ((r() * 4) | 0)) % HUT.length);
    const inst = (geo, ids, colorOf) => { const im = new THREE.InstancedMesh(geo, bodyMat, Math.max(1, ids.length)); im.count = ids.length; ids.forEach((t, i) => { im.setMatrixAt(i, mats[t]); im.setColorAt(i, colorOf(t)); }); im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); };
    inst(baseG, towers.map((_, i) => i), () => tmpC.set('#ffffff'));
    protos.forEach(([hg, rg], k) => { const ids = towers.map((_, i) => i).filter((i) => kind[i] === k); inst(hg, ids, (t) => tmpC.set(HUT[body[t]])); inst(rg, ids, (t) => tmpC.set(HUT[roofC[t]])); });
  }
  {
    const um = new THREE.ConeGeometry(1.35, 0.45, 8); um.translate(0, 2.25, 0);
    const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4); pole.translate(0, 1.1, 0);
    const chair = new THREE.BoxGeometry(0.7, 0.25, 1.9); chair.translate(0.9, 0.3, 0);
    const g = mergeGeometries([colorize(um.toNonIndexed(), '#ffffff'), colorize(pole.toNonIndexed(), '#dddddd'), colorize(chair.toNonIndexed(), '#f4f4f4')].map((p) => { p.deleteAttribute('uv'); return p; }));
    const list = [];
    for (let z = PS(-200) + 40; z < 900; z += 7 + r() * 3) for (let k = 0; k < 2; k++) if (r() < 0.75) { const x = SHORE(z) + 52 + k * 7 + r() * 2; list.push([x, z + r() * 2, lerp(WATER, G, Math.pow((x - SHORE(z)) / (PK(z) + 3 - SHORE(z)), 1.35))]); }
    for (let x = PX0 + 120; x < PB1 - 30; x += 7 + r() * 3) for (let k = 0; k < 2; k++) if (r() < 0.7) { const ps = PS(x), z = ps - 40 - k * 7 - r() * 2; list.push([x, z, lerp(WATER, G, Math.pow((ps - z) / 63, 1.35))]); }
    const im = new THREE.InstancedMesh(g, bodyMat, list.length);
    const UMB = ['#ff5a8a', '#2ac8d8', '#ffd23a', '#ff8a3a', '#8a5aff', '#ffffff', '#3aa0ff'];
    list.forEach(([x, z, y], i) => {
      tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(up, r() * 6), tmpS.setScalar(1)); im.setMatrixAt(i, tmpM); im.setColorAt(i, tmpC.set(pick(UMB)));
    });
    im.castShadow = true; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 棕榈树：一棵程序化的模型，实例化几千棵；叶子随风摆，夜里海滨大道那几排被地灯从下往上打亮 ----------
  const palmGeo = (() => {
    const H = 11, lean = 0.8, parts = [];
    const at = (t) => new THREE.Vector3(lean * t * t, H * t, 0);
    const build = (pos, col, sw, hh, idx) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    { // 树干：一节节的环纹，往一边微微弯
      const SEG = 12, RAD = 6, pos = [], col = [], sw = [], hh = [], idx = [];
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, c = at(t), rad = lerp(0.3, 0.18, t) * (i === 0 ? 1.35 : 1), ring = i % 2 ? 0.86 : 1.05;
        for (let j = 0; j <= RAD; j++) {
          const a = j / RAD * Math.PI * 2; pos.push(c.x + Math.cos(a) * rad, c.y, c.z + Math.sin(a) * rad);
          const k = lerp(0.44, 0.62, t) * ring; col.push(k * 1.05, k * 0.94, k * 0.8); sw.push(t * t * 0.3); hh.push(t * 0.97);
        }
      }
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      parts.push(build(pos, col, sw, hh, idx));
    }
    const top = at(1), NF = 11, rr = rng(77);
    for (let f = 0; f < NF + 3; f++) { // 叶子：带中脊的 V 形长条，先往上挑再垂下；最后三片是垂着的枯叶
      const dead = f >= NF, a = (f / NF) * Math.PI * 2 + rr() * 0.45;
      let el = dead ? -1.15 - rr() * 0.3 : [0.85, 0.4, 0.05][f % 3] + (rr() - 0.5) * 0.25;
      const L = dead ? 2.6 : 4.3 + rr() * 1.3, STEPS = 7;
      const dh = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      const p = top.clone(), pos = [], col = [], sw = [], hh = [], idx = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS, w = (dead ? 0.32 : 0.95) * Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.92));
        const cC = dead ? [0.42, 0.31, 0.18] : [0.2 + t * 0.08, 0.34 + t * 0.06, 0.1], eC = dead ? [0.5, 0.38, 0.22] : [0.34, 0.47, 0.15];
        for (const [v, c] of [[p.clone(), cC], [p.clone().addScaledVector(side, w).add(new THREE.Vector3(0, -0.3 * w, 0)), eC], [p.clone().addScaledVector(side, -w).add(new THREE.Vector3(0, -0.3 * w, 0)), eC]]) {
          pos.push(v.x, v.y, v.z); col.push(...c); sw.push(0.3 + 0.7 * t); hh.push(1);
        }
        p.addScaledVector(dh.clone().multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)), L / STEPS);
        el -= dead ? 0.04 : 0.27;
      }
      for (let i = 0; i < STEPS; i++) { const c0 = 3 * i, l0 = c0 + 1, r0 = c0 + 2, c1 = c0 + 3, l1 = c0 + 4, r1 = c0 + 5; idx.push(c0, l0, c1, l0, l1, c1, c0, c1, r0, r0, c1, r1); }
      parts.push(build(pos, col, sw, hh, idx));
    }
    return mergeGeometries(parts);
  })();
  const palmU = { uTime: { value: 0 }, uNight: { value: 0 } };
  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  palmMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, palmU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSway; attribute float aH; attribute vec3 aUp; uniform float uTime; varying vec3 vUp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 ip = instanceMatrix[3]; float ph = ip.x * .031 + ip.z * .047;
          float w = sin(uTime * 1.1 + ph) * .6 + sin(uTime * 2.4 + ph * 1.7) * .25;
          transformed.x += w * aSway * .8; transformed.z += cos(uTime * .9 + ph * 1.3) * aSway * .35; transformed.y -= abs(w) * aSway * aSway * .25;
          vUp = aUp * (aH < .99 ? pow(1. - aH, 1.6) * 1.6 + .1 : .32); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vUp;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vUp * uNight * (.35 + diffuseColor.rgb);');
  };
  palmMat.customProgramCacheKey = () => 'miamiPalm';
  const UPL = [[1, 0.78, 0.5], [1, 0.3, 0.7], [0.3, 0.8, 1], [0.7, 0.35, 1], [1, 0.78, 0.5]];
  const P = (x, z, h, upl = null) => palms.push([x, z, h, r() * Math.PI * 2, upl || [0, 0, 0]]);
  for (let z = 1500; z > PS(-50) - 70; z -= 12 + r() * 4) { // 海滨大道两排（地灯打亮）
    const zz = z + (r() - 0.5) * 3;
    if (!isReserved(-46 + C(zz), -36 + C(zz), zz - 2, zz + 2)) P(-42 + C(zz) + (r() - 0.5) * 1.5, zz, 9 + r() * 6, UPL[(Math.floor(z / 270) + 100) % UPL.length]);
    P(-62 + C(z) + (r() - 0.5) * 4, z + (r() - 0.5) * 6, 10 + r() * 6, r() < 0.5 ? UPL[0] : null);
  }
  for (let i = 0; i < 220; i++) { const z = lerp(PS(-50) - 40, 1500, r()); P(lerp(-70, -48, r()) + C(z), z, 8 + r() * 7); }
  for (let x = -60; x > PX0 + 40; x -= 12 + r() * 4) { // 海角公园两排（地灯打亮）
    const ps = PS(x); P(x + (r() - 0.5) * 3, ps - 86 + (r() - 0.5) * 1.5, 9 + r() * 6, UPL[(Math.floor(-x / 270) + 100) % UPL.length]);
    if (r() < 0.8) P(x + (r() - 0.5) * 4, ps - 68 - r() * 4, 10 + r() * 6, r() < 0.5 ? UPL[0] : null);
  }
  for (let i = 0; i < 90; i++) { const z = lerp(ZS + 150, 9000, r()); P(PK(z) - 4 - r() * 14, z, 8 + r() * 6); } // 沙滩边上零星几棵
  for (const ax of [60, 360]) for (let z = ZS + 160; z < 1500; z += 17 + r() * 5) for (const s of [-1, 1]) if (r() < 0.8) P(ax + s * 13, z, 9 + r() * 5);
  for (let z = 1500; z < 9000; z += 22 + r() * 10) P(-56 + (r() - 0.5) * 10, z, 10 + r() * 6, r() < 0.3 ? UPL[(r() * 4) | 0] : null);
  for (let z = -4500; z < 1200; z += 24 + r() * 10) P(MAIN(z) + 25, z, 11 + r() * 5); // 对岸海滨大道
  for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); P(800 + Math.cos(a) * 320 * d, -3180 + Math.sin(a) * 140 * d, 9 + r() * 6); } // 小岛上
  {
    const g = palmGeo.clone(); const up3 = new Float32Array(palms.length * 3); palms.forEach((p, i) => up3.set(p[4], i * 3));
    g.setAttribute('aUp', new THREE.InstancedBufferAttribute(up3, 3));
    const im = new THREE.InstancedMesh(g, palmMat, palms.length);
    palms.forEach(([x, z, h, rot], i) => { tmpM.compose(tmpP.set(x, G, z), tmpQ.setFromAxisAngle(up, rot), tmpS.setScalar(h / 11)); im.setMatrixAt(i, tmpM); });
    im.castShadow = true; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 水 ----------
  const water = waterMaterial({ deep: '#127c8a', scale: 1.6, amp: 0.9 });
  const wmesh = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), water); wmesh.rotation.x = -Math.PI / 2; wmesh.position.y = WATER; group.add(wmesh);
  const VIEW = new THREE.Vector3(0, 1.6, 0);
  const onBay = (x, z) => x > BAY(z) + 15 && x < MAIN(z) - 15 && !(x > 2580 && x < 4120 && z < -2420 && z > -2980);
  const addRefl = (x, y, z, c, s) => { // 灯在海湾水面上的倒影
    const H = VIEW.y - WATER, hh = y - WATER; if (hh < 0) return;
    const k = H / (H + hh), rx = VIEW.x + (x - VIEW.x) * k, rz = VIEW.z + (z - VIEW.z) * k;
    const cove = (rx < SHORE(rz) - 12 && rz > PS(rx) + 12) || rx < PX0 - 30;
    if (onBay(rx, rz) || cove) refl.push({ x: rx, y: WATER + 0.5, z: rz, c, s: s * 6, seed: r() });
  };

  // ---------- 长堤：横过海湾，中间一段拱起来让船过；路灯、车流 ----------
  const steelM = new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.7 });
  const causeway = (xa, za, xb, zb, hump, lanes) => {
    const NSEG = 60, pts = [];
    for (let i = 0; i <= NSEG; i++) { const t = i / NSEG; pts.push(new THREE.Vector3(lerp(xa, xb, t), WATER + 6 + hump * Math.exp(-(((t - 0.42) / 0.09) ** 2)), lerp(za, zb, t))); }
    for (let i = 0; i < NSEG; i++) {
      const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 0.5, 1.6, 26), steelM);
      seg.position.copy(mid); seg.lookAt(b); seg.rotateY(Math.PI / 2); seg.receiveShadow = true; group.add(seg);
      if (i % 2 === 0) { const pier = new THREE.Mesh(new THREE.BoxGeometry(3, mid.y - WATER, 18), steelM); pier.position.set(mid.x, (mid.y + WATER) / 2, mid.z); pier.rotation.y = Math.atan2(-(zb - za), xb - xa); group.add(pier); }
    }
    const nrm = new THREE.Vector3(-(zb - za), 0, xb - xa).normalize();
    const curveAt = (t) => { const f = t * NSEG, i = Math.min(NSEG - 1, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
    for (let t = 0; t <= 1; t += 36 / Math.hypot(xb - xa, zb - za)) for (const s of [-12.5, 12.5]) {
      const p = curveAt(t).addScaledVector(nrm, s); const c = [1, 0.7, 0.42];
      lightPts.push({ x: p.x, y: p.y + 7, z: p.z, c, s: 1.6 }); addRefl(p.x, p.y + 7, p.z, [1, 0.6, 0.35], 1.3);
    }
    for (let l = 0; l < lanes; l++) for (const dir of [1, -1]) {
      const off = (l + 0.5) * 3.4 * dir, n = 70;
      for (let s = 0; s < 6; s++) { // 分六段（车道跟着拱起来）
        const t0 = s / 6, t1 = (s + 1) / 6, A = curveAt(dir > 0 ? t0 : 1 - t0).addScaledVector(nrm, off), B = curveAt(dir > 0 ? t1 : 1 - t1).addScaledVector(nrm, off);
        const toward = (B.x - A.x) < 0; // 往岛这边开（朝着我们）：看见白色车头灯
        for (let i = 0; i < n / 6; i++) cars.push({ x: A.x, y: A.y + 0.9, z: A.z, ex: B.x, ey: B.y + 0.9, ez: B.z, v: 16 + r() * 8, seed: r(), c: toward ? [1.6, 1.4, 1.1] : [1.7, 0.2, 0.12], s: 2.2, day: [0.75, 0.72, 0.7] });
      }
    }
  };
  causeway(BAY(-2250) - 30, -2250, MAIN(-1900) + 30, -1900, 21, 3); // 主跨净空 21 米、双向六车道
  causeway(BAY(1900) - 30, 1900, MAIN(2150) + 30, 2150, 10, 2);

  // ---------- 街灯、海滨大道的车、对岸的灯海 ----------
  const warm = [1, 0.74, 0.46], sodium = [1, 0.6, 0.3], white = [0.92, 0.94, 1];
  for (let x = -40; x > PX0 + 30; x -= 26) { const ps = PS(x); lightPts.push({ x, y: G + 5.5, z: ps - 90.5, c: warm, s: 1.2 }); lightPts.push({ x: x - 13, y: G + 5.5, z: ps - 101.5, c: warm, s: 1.1 }); lightPts.push({ x: x - 6, y: G + 3.5, z: ps - 76 - 4 * Math.sin(x * 0.02), c: r() < 0.7 ? warm : [1, 0.45, 0.8], s: 0.9 }); }
  for (let z = PS(-30) - 100; z < 9000; z += 26) { lightPts.push({ x: -36.5 + C(z), y: G + 5.5, z, c: warm, s: 1.2 }); if (z < 1500) lightPts.push({ x: -25.5 + C(z + 13), y: G + 5.5, z: z + 13, c: warm, s: 1.1 }); }
  for (let z = PS(-50) - 60; z < 1500; z += 32) lightPts.push({ x: -52 - 5 * Math.sin(z * 0.02) + C(z), y: G + 3.5, z, c: r() < 0.7 ? warm : [1, 0.45, 0.8], s: 0.9 });
  for (const ax of AVES) for (let z = ZS + 100; z < 9000; z += 32) for (const s of [-11, 11]) lightPts.push({ x: ax + s, y: G + 7, z, c: r() < 0.6 ? sodium : white, s: 1.2 });
  for (let k = 0; k <= 80; k++) { const z = STREET0 + k * STREET_P; if (z > 9000) break; for (let x = -10 + C(z); x < BAY(z) - 20; x += 40) lightPts.push({ x, y: G + 6, z: z + (r() < 0.5 ? -7 : 7), c: sodium, s: 1.1 }); }
  // 海滨大道上慢慢开的车（敞篷车多）：朝我们开的是车头灯
  const carDay = () => pick([[0.95, 0.95, 0.92], [0.9, 0.4, 0.55], [0.4, 0.75, 0.8], [0.95, 0.8, 0.3], [0.15, 0.15, 0.16], [0.8, 0.2, 0.2]]);
  const lane = (x0, z0, x1, z1, toward, n, v, s = 2) => { for (let i = 0; i < n; i++) cars.push({ x: x0, y: G + 0.8, z: z0, ex: x1, ey: G + 0.8, ez: z1, v: v * (0.7 + r() * 0.6), seed: (i + r() * 0.6) / n, c: toward ? [1.6, 1.4, 1.1] : [1.7, 0.2, 0.12], s, day: carDay() }); };
  for (let x = -40; x > PX0 + 40; x -= 200) { const x2 = Math.max(PX0 + 40, x - 200); lane(x, PS(x) - 94, x2, PS(x2) - 94, false, 6, 6); lane(x2, PS(x2) - 98, x, PS(x) - 98, true, 6, 6); } // 海角大道
  for (let z = PS(-30) - 96; z < 9000; z += 250) { const z2 = Math.min(9000, z + 250), n = 8; lane(-33 + C(z), z, -33 + C(z2), z2, true, n, 6); lane(-29 + C(z2), z2, -29 + C(z), z, false, n, 6); }
  for (const ax of AVES) { lane(ax - 4, ZS + 150, ax - 4, 9000, true, 220, 10); lane(ax + 4, 9000, ax + 4, ZS + 150, false, 220, 10); }
  // 对岸：海滨大道路灯、更远处的灯海
  for (let z = -6000; z < 6000; z += 30) { lightPts.push({ x: MAIN(z) + 14, y: G + 7, z, c: warm, s: 1.4 }); addRefl(MAIN(z) + 14, G + 7, z, [1, 0.6, 0.35], 1.3); }
  lane(MAIN(-6000) + 30, -6000, MAIN(6000) + 30, 6000, false, 200, 14); lane(MAIN(6000) + 36, 6000, MAIN(-6000) + 36, -6000, true, 200, 14);
  const carpet = [];
  for (let z = -15000; z < 15000; z += 140) for (let x = MAIN(z) + 200; x < 16000; x += 50 + r() * 40) if (r() < 0.45) carpet.push({ x, y: G + 6, z: z + (r() - 0.5) * 20, c: r() < 0.7 ? sodium : r() < 0.5 ? white : warm, s: 1.4 });
  for (let z = 9000; z < 15000; z += 130) for (let x = PARK0; x < BAY(z) - 20; x += 50 + r() * 30) if (r() < 0.5) carpet.push({ x, y: G + 6, z, c: sodium, s: 1.3 });
  for (const [x, y, z, c] of reflSrc) addRefl(x, y, z, c, 3.2);
  for (const p of cafe) if (p.z < PS(p.x) - 60 && p.x < -40) addRefl(p.x, p.y, p.z, p.c, 1);
  // 市中心楼顶的灯带也在水里有倒影
  for (const e of led) if (e[4] < 5) { tmpC.setHSL(e[6], 0.85, 0.55); addRefl(e[0], e[1], e[2], [tmpC.r, tmpC.g, tmpC.b], 2.2); }

  // ---------- 邮轮：港口停两艘，海上开过一艘；夜里一排排舷窗、甲板彩灯 ----------
  const ships = [];
  const shipGeo = (() => {
    const L = 290, B = 36, parts = [];
    const hull = (y0, y1, col) => {
      const g = cbox(L, y1 - y0, B, 0, (y0 + y1) / 2, 0, col); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x > L / 2 - 50) p.setZ(i, p.getZ(i) * (1 - ((x - (L / 2 - 50)) / 50) ** 1.6 * 0.92)); }
      g.computeVertexNormals(); return g;
    };
    parts.push(hull(-7, 3, '#1e2a44'), hull(3, 17, '#f6f6f2'));
    for (let k = 0; k < 6; k++) { const l = L * (0.8 - k * 0.045), y = 17 + k * 3.2; parts.push(cbox(l, 3.2, B - 3 - k * 0.6, -8 - k * 2, y + 1.6, 0, '#f8f8f4')); parts.push(cbox(l * 0.98, 0.9, B - 2.8 - k * 0.6, -8 - k * 2, y + 1.9, 0, '#2c3846')); }
    parts.push(cbox(18, 12, 11, -70, 42, 0, '#f6f6f2'), cbox(18.2, 4, 11.2, -70, 46, 0, '#1fa0c8'));
    return mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }));
  })();
  const shipLights = () => {
    const pts = [];
    for (let k = 0; k < 9; k++) { const y = 5 + k * 2.8, len = 290 * (k < 4 ? 0.9 : 0.8 - (k - 4) * 0.045), x0 = (k < 4 ? -2 : -8 - (k - 4) * 2) - len / 2;
      for (let x = x0; x < x0 + len; x += 3.2) for (const s of [-1, 1]) if (r() < 0.82) pts.push({ x, y, z: s * (17.8 - Math.max(0, k - 4) * 0.4), c: r() < 0.75 ? [1, 0.82, 0.55] : [0.85, 0.9, 1], s: 0.9 }); }
    for (let x = -120; x < 110; x += 4) pts.push({ x, y: 37, z: 0, c: NEON[(r() * NEON.length) | 0], s: 1.1 });
    pts.push({ x: -70, y: 49, z: 0, c: [1, 1, 1], s: 3 });
    return pts;
  };
  const makeShip = (x, z, rot) => {
    const sg = new THREE.Group(); sg.position.set(x, WATER, z); sg.rotation.y = rot; group.add(sg);
    const m = new THREE.Mesh(shipGeo, bodyMat); m.castShadow = true; sg.add(m);
    const lp = makeLights(shipLights(), { fog: 0.00008, minPx: 1, maxPx: 2.5, gain: 1.3 }); sg.add(lp);
    ships.push({ g: sg, lp }); return sg;
  };
  makeShip(2960, -3005, 0); makeShip(3640, -3005, Math.PI);
  { // 港口东头几台集装箱起重机（白身红臂），顶上红灯
    const cr = [];
    for (let i = 0; i < 5; i++) {
      const x = 3800 + i * 60, z = -2930;
      for (const s2 of [-1, 1]) cr.push(cbox(2.2, 42, 2.2, x + s2 * 9, 21, z, '#e8e8e4'));
      cr.push(cbox(22, 3, 3, x, 40, z, '#e8e8e4'), cbox(2.6, 2.6, 70, x, 46, z - 18, '#c8402a'), cbox(4, 6, 6, x, 45, z + 6, '#e8e8e4'));
      lightPts.push({ x, y: 50, z: z - 50, c: [1, 0.08, 0.04], s: 2.2, blink: true });
    }
    const g = mergeGeometries(cr.map((p) => { p.deleteAttribute('uv'); return p.toNonIndexed(); }));
    const me = new THREE.Mesh(g, bodyMat); me.position.y = G; me.castShadow = true; group.add(me);
  }
  const seaShip = makeShip(-5200, 0, Math.PI / 2);

  // ---------- 海边的摩天轮（对岸），慢慢转 ----------
  const wheel = new THREE.Group(); wheel.position.set(MAIN(-700) + 45, G, -700); group.add(wheel);
  wheel.lookAt(0, G, 0);
  const rim = new THREE.Group(); rim.position.y = 36; wheel.add(rim);
  {
    const R = 30;
    rim.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 6, 64), steelM));
    const sp = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; sp.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); rim.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: '#b8b4ac' })));
    const lp = []; for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; tmpC.setHSL(i / 96, 0.9, 0.6); lp.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, z: 0, c: [tmpC.r, tmpC.g, tmpC.b], s: 1.4 }); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; for (let k = 1; k < 6; k++) lp.push({ x: Math.cos(a) * R * k / 6, y: Math.sin(a) * R * k / 6, z: 0, c: [1, 0.85, 0.95], s: 0.9 }); }
    rim.userData.lp = makeLights(lp, { fog: 0.0001, minPx: 1, maxPx: 3, gain: 1.4 }); rim.add(rim.userData.lp);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 40, 1), steelM); leg.position.set(s * 9, 18, 0); leg.rotation.z = s * 0.24; wheel.add(leg); }
  }

  // ---------- 灯点网格 ----------
  const F = 0.00012;
  const lamps = makeLights([...lightPts.filter((p) => !p.blink), ...carpet], { fog: F * 0.8, minPx: 1.1, maxPx: 3, gain: 1.4 }); group.add(lamps);
  const red = makeLights(lightPts.filter((p) => p.blink).map((p) => ({ ...p, seed: r() * 0.3 })), { fog: F, blink: true, minPx: 1.5, maxPx: 4, gain: 1.4 }); group.add(red);
  const cafeP = makeLights(cafe, { fog: F, minPx: 1, maxPx: 3, gain: 1.2, twinkle: 0.1 }); group.add(cafeP);
  const reflP = makeLights(refl, { fog: F, streak: true, minPx: 3, maxPx: 22, gain: 0.6 }); group.add(reflP);
  const wetP = makeLights(wetRefl, { fog: F, streak: true, minPx: 2, maxPx: 18, gain: 0.55 }); group.add(wetP); // 像刚下过雨：门前大道映着招牌的霓虹
  const carP = makeLights(cars, { fog: F, moving: true, additive: false, minPx: 1.3, maxPx: 3, gain: 1 }); group.add(carP);
  const planes = [];
  for (let i = 0; i < 5; i++) { // 往西边机场降落的飞机，一架接一架
    const z = -1500 + i * 900 + r() * 400;
    planes.push({ x: -9000, y: 1300 + r() * 300, z, ex: 14000, ey: 120, ez: z + 1200, v: 75 + r() * 15, seed: i / 5, c: [1, 1, 1], s: 3, day: [0, 0, 0] });
  }
  const planeP = makeLights(planes, { fog: F * 0.4, moving: true, blink: true, minPx: 1.5, maxPx: 3, gain: 1.6 }); group.add(planeP);

  const clouds = cloudLayer(group, { y: 2400, cover: 0.5, scale: 1.1, night: '#6a2e5a', nightK: 0.55 });
  // 美术配色：白天碧蓝的天、翡翠色的海；日落天顶紫、天边橙，背对太阳那边（海上）一大片粉；
  // 黄昏天边一道洋红、半空发紫；夜里天不是黑的，是被整座城和霓虹映出来的深紫，地平线一圈洋红光雾
  const art = makeArt([
    [40, { zen: '#2a7fe0', mid: '#69b4f0', hor: '#d6eef4', glow: '#fff4dc', anti: '#bfe0ee', sun: '#fff6e4', sunK: 1.8, hemi: '#a8d0f0', ground: '#b8a888', hemiK: 0.7, fog: '#b8d8ea', fogK: 0.8, cloudLit: '#ffffff', cloudShade: '#a6c4dc', cloudK: 0.85, deep: '#127c8a', lit: 0, halo: 0.8 }],
    [14, { zen: '#2a6ed0', mid: '#78aee8', hor: '#ffe0c0', glow: '#ffc884', anti: '#d0c4ec', sun: '#ffd8a0', sunK: 2.3, hemi: '#b4c4ec', ground: '#d0b08c', hemiK: 0.85, fog: '#f0d8c4', fogK: 1, cloudLit: '#fff0d8', cloudShade: '#a8a8d0', cloudK: 0.9, deep: '#1a6e86', lit: 0.05, halo: 1 }],
    [4, { zen: '#3B1C6E', mid: '#8a4ac0', hor: '#FF8A3D', glow: '#ff7a3a', anti: '#FC94AF', sun: '#ff9048', sunK: 2.2, hemi: '#c088c8', ground: '#a87068', hemiK: 0.95, fog: '#f09aa8', fogK: 1.2, cloudLit: '#ff8a7a', cloudShade: '#7a4aa0', cloudK: 0.95, deep: '#3a3a7a', lit: 0.4, halo: 1.6 }],
    [-1, { zen: '#2a1a6e', mid: '#7a3aa8', hor: '#FC94AF', glow: '#ff6a4a', anti: '#e060b0', sun: '#ff4a40', sunK: 0.5, hemi: '#9a5ab8', ground: '#6a3a58', hemiK: 0.85, fog: '#c85a98', fogK: 1.45, cloudLit: '#FC94AF', cloudShade: '#4a2a7a', cloudK: 0.95, deep: '#2a2a6a', lit: 0.8, halo: 1.4 }],
    [-5, { zen: '#1e1260', mid: '#4a2a8e', hor: '#d0508a', glow: '#c04a6a', anti: '#7a3a9a', sun: '#000000', sunK: 0, hemi: '#5a3a96', ground: '#4a3048', hemiK: 0.75, fog: '#7a3a7a', fogK: 1.7, cloudLit: '#d05a90', cloudShade: '#2e1e5a', cloudK: 0.9, deep: '#12405a', lit: 1, halo: 0 }], // 蓝调：水偏青
    [-11, { zen: '#1A0B2E', mid: '#24164e', hor: '#7a2e6a', glow: '#7a2e5a', anti: '#4a2260', sun: '#000000', sunK: 0, hemi: '#3a2a6a', ground: '#5a3048', hemiK: 0.75, fog: '#4a2650', fogK: 1.9, cloudLit: '#a04a7a', cloudShade: '#1e1234', cloudK: 0.8, deep: '#0a1a2a', lit: 1, halo: 0 }],
    [-25, { zen: '#06061a', mid: '#140e30', hor: '#5a2450', glow: '#5a2450', anti: '#3a1a44', sun: '#000000', sunK: 0, hemi: '#241c44', ground: '#5a2c3a', hemiK: 0.75, fog: '#38203c', fogK: 1.8, cloudLit: '#86406a', cloudShade: '#18101e', cloudK: 0.75, deep: '#06060e', lit: 1, halo: 0 }],
  ]);
  const skyArt = artSky(group);
  const foamC = new THREE.Color();
  const ledHue = led.map((e) => e[6]);
  return {
    group, fog: F, art, loaded: Promise.resolve(), shadow: { center: [-20, G, -420], size: 700, normalBias: 0.8 },
    dome: { top: '#0a0830', horizon: '#5a2450' },
    update(dt, t, sky, atmo) {
      const c = sky.state.c, h = c.h;
      const A = art.update(c.sunElev);
      skyArt.update(art, sky);
      this.dirK = 0.9;
      sky.stars.material.uniforms.uOpacity.value *= 0.35; // 城里光污染，星星稀稀拉拉
      const L = A.lit, ln = smooth(0.1, 0.8, L);
      this.envK = lerp(0.15, 0.6, L); // 白天环境反光调低，不然整片发白（乡间也是这样）
      this.glow = { k: lerp(0.15, 0.9, L), t: lerp(1.3, 0.26, L) }; // 夜里霓虹一圈光晕
      fu.uNight.value = L; fu.uLit.value = lerp(0.3, h > 1 && h < 6 ? 0.45 : 0.72, L); fu.uTime.value = t; fu.uGlow.value = 1.5;
      for (const g of grounds) g.uNight.value = L * 1.6;
      trimMat.color.setScalar(lerp(1, 0.4, L));
      neonMat.color.setScalar(lerp(0.42, 2.8, ln)); // 白天灯管是浅浅的彩色，天黑全亮
      ledMat.color.setScalar(lerp(0.2, 2.2, ln));
      palmU.uTime.value = t; palmU.uNight.value = ln;
      for (const p of [lamps, red, cafeP, reflP, wetP]) { p.material.uniforms.uOpacity.value = ln; p.material.uniforms.uTime.value = t; p.visible = ln > 0.01; }
      red.material.uniforms.uOpacity.value = 0.35 + 0.65 * ln;
      for (const p of [carP, planeP]) { p.material.uniforms.uTime.value = t; p.material.uniforms.uNight.value = ln; }
      carP.material.uniforms.uGain.value = lerp(0.8, 1.6, ln); planeP.material.uniforms.uOpacity.value = 0.3 + 0.7 * ln;
      for (const s of ships) { s.lp.material.uniforms.uOpacity.value = 0.15 + 0.85 * ln; s.lp.material.uniforms.uTime.value = t; }
      rim.userData.lp.material.uniforms.uOpacity.value = 0.2 + 0.8 * ln;
      rim.rotation.z = -t * 0.035;
      seaShip.position.z = 3000 - ((t * 5 + 4000) % 12000);           // 海上那艘慢慢往南开
      updateWater(water, dt, sky, atmo, { art });
      clouds.update(dt, sky, atmo, art);
      foamC.copy(A.cloudLit).lerp(A.hemi, 0.5).multiplyScalar(lerp(1, 0.32, smooth(0, 1, L)));
      for (const m of foams) { m.uniforms.uTime.value = t; m.uniforms.uCol.value.copy(foamC); }
      // 市中心楼顶的灯带慢慢变色
      if (ledMesh.count) {
        for (let i = 0; i < 3; i++) { const k = (Math.random() * led.length) | 0; if (led[k][8]) continue; ledHue[k] = (ledHue[k] + 0.01) % 1; ledMesh.setColorAt(k, tmpC.setHSL(ledHue[k], 0.85, 0.55)); }
        ledMesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
