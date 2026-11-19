// 纽约大都会：五十层楼顶俯瞰中城。正前方一条大道一直通到下城的超高层，左前是阶梯式装饰艺术摩天楼（尖顶），
// 右前是拱形冠顶的钢尖塔，右边东河上三座悬索桥挂着「珍珠项链」灯，河对岸低矮的街区灯海一直铺到天边；
// 身后是中央公园和公园南边的细高「铅笔楼」。楼窗全是程序化的（common.js facadeMaterial），夜里随时间一扇扇熄灭。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, glowTex } from '../textures.js';
import { rng, smooth, clamp, lerp, facadeMaterial, bldAttr, bldConst, litRatio, makeLights, waterMaterial, updateWater, tint, cloudLayer, makeArt, artSky, instanceModels } from './common.js';

const G = -182;              // 街面（天台往下 182 米，大约 50 层）
const WATER = G - 4;
const AVE = 250, STR = 80, AVE_W = 30, STR_W = 18, Z0 = -24; // 大道沿 z（x = k·250），街道沿 x（z = -24 + j·80）
// 曼哈顿岛：西岸、东岸随 z 弯一点，南头收成尖
const xw = (z) => -1750 + 160 * Math.sin(z * 0.00035 + 1) + (z < -7400 ? (-7400 - z) * 0.42 : 0);
const xe = (z) => 1300 + 110 * Math.sin(z * 0.0005 + 2) - (z < -6200 ? (-6200 - z) * 0.3 : 0);
const ZN = 4600, ZS = -9300;
const onIsland = (x, z, m = 0) => z < ZN - m && z > ZS + m && x > xw(z) + m && x < xe(z) - m;
const EAST = (z) => 2150 + 90 * Math.sin(z * 0.0004);   // 东河对岸
const WEST = (z) => -3050 + 120 * Math.sin(z * 0.0003 + 0.5); // 哈德逊河对岸
const PARK = { x0: -760, x1: 260, z0: 1500, z1: 4300 };
const inPark = (x, z, m = 0) => x > PARK.x0 - m && x < PARK.x1 + m && z > PARK.z0 - m && z < PARK.z1 + m;
const BRIDGES = [
  { z: -1900, stone: false, deck: 42, tower: 92 },
  { z: -5300, stone: false, deck: 40, tower: 100 },
  { z: -6950, stone: true, deck: 38, tower: 84 },
];

const MASON = ['#cdbfa6', '#b8a68a', '#8c5240', '#9c6a52', '#6e4c3c', '#a8a49a', '#d9d2c2', '#7a6a5a', '#c4b49a'];
const GLASS = ['#58707e', '#3c5262', '#6e8ea0', '#2e3a46', '#86a2ae', '#4a5a66'];
const OFFICE = ['#9a9a96', '#727678', '#b6b2a8', '#565c62', '#8a8478'];

export function createNYC(scene) {
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const r = rng(1931);
  const facade = facadeMaterial({ roughness: 0.82 });
  const fu = facade.userData.u;
  const reserved = [];
  const reserve = (x0, x1, z0, z1) => reserved.push([x0, x1, z0, z1]);
  const isReserved = (x0, x1, z0, z1) => reserved.some(([a, b, c, d]) => x1 > a && x0 < b && z1 > c && z0 < d);
  reserve(-14, 14, -6, 18);                     // 自己这栋
  for (const b of BRIDGES) reserve(xe(b.z) - 420, 9e9, b.z - 40, b.z + 40); // 桥头引桥

  // ---------- 一批批盒子（按 1.6 公里一块分开，背后的块能被视锥剔掉）----------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const tiles = new Map();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tmpC = new THREE.Color();
  function box(x, z, w, d, y0, h, color, bld, rot = 0) {
    const key = `${Math.floor(x / 1600)},${Math.floor(z / 1600)}`;
    let t = tiles.get(key); if (!t) tiles.set(key, (t = { m: [], c: [], b: [] }));
    tmpQ.setFromAxisAngle(up, rot);
    tmpM.compose(tmpP.set(x, y0, z), tmpQ, tmpS.set(w, h, d));
    t.m.push(tmpM.clone()); t.c.push(tmpC.set(color).multiplyScalar(0.55 + r() * 0.3).clone()); t.b.push(bld);
  }
  const rooftops = []; // [x, y, z, size] 低楼顶上放水塔
  const tallTops = []; // 高楼顶上的红色航空障碍灯
  const roofSets = []; // 中高层楼顶上的一组屋顶设备
  const crowns = [];   // 高楼顶上打光的一截

  // 一栋楼：按样式叠几层退台
  function building(x, z, w, d, h, style, bias = 1) {
    const seed = r(), col = style === 0 ? MASON[(r() * MASON.length) | 0] : style === 1 ? GLASS[(r() * GLASS.length) | 0] : OFFICE[(r() * OFFICE.length) | 0];
    const bld = [seed, style, G, bias * (style === 2 && r() < 0.2 ? 1.8 : 0.25 + r() * 1.3)]; // 亮灯倾向：有的楼几乎全黑，有的办公楼整栋亮着
    if (style === 0 && h > 70) {                // 婚礼蛋糕式退台
      const h1 = h * (0.3 + r() * 0.2), h2 = h * (0.62 + r() * 0.15), k1 = 0.72 + r() * 0.12, k2 = 0.5 + r() * 0.15;
      box(x, z, w, d, G, h1, col, bld); box(x, z, w * k1, d * k1, G + h1, h2 - h1, col, bld); box(x, z, w * k2, d * k2, G + h2, h - h2, col, bld);
      w *= k2; d *= k2;
    } else if (style === 2 && h > 100) {        // 裙楼 + 塔楼
      const hp = 18 + r() * 16, k = 0.62 + r() * 0.2;
      box(x, z, w, d, G, hp, col, bld); box(x, z, w * k, d * k, G + hp, h - hp, col, bld);
      w *= k; d *= k;
    } else box(x, z, w, d, G, h, col, bld);
    if (h > 40 && r() < 0.65) box(x + (r() - 0.5) * w * 0.3, z + (r() - 0.5) * d * 0.3, w * (0.25 + r() * 0.2), d * (0.25 + r() * 0.2), G + h, 3 + r() * 6, OFFICE[(r() * 5) | 0], [seed, 0, G + h + 20, 0]);
    if (h > 40 && h < 160 && r() < 0.16 && Math.hypot(x, z) < 1800) roofSets.push([x, G + h, z, Math.min(w, d) / 16]);
    if (h < 75 && style === 0 && r() < 0.45) rooftops.push([x + (r() - 0.5) * w * 0.5, G + h, z + (r() - 0.5) * d * 0.5, 0.8 + r() * 0.5]);
    if (h > 150) tallTops.push([x, G + h + 4, z]);
    if (h > 165 && r() < 0.45) crowns.push([x, G + h, z, w * 0.7, d * 0.7, 6 + r() * 14]); // 楼顶打光的冠
  }

  // ---------- 曼哈顿的街区 ----------
  function heightAt(x, z) {
    const mid = Math.exp(-(((x + 100) / 1150) ** 2 + ((z + 1700) / 1500) ** 2));
    const down = Math.exp(-(((x + 380) / 850) ** 2 + ((z + 7350) / 1150) ** 2));
    const parkRow = z > 1050 && z < 1500 && x > -900 && x < 420 ? 0.85 : 0;
    const yards = Math.exp(-(((x + 1420) / 300) ** 2 + ((z + 1400) / 350) ** 2)) * 0.9;
    let d = Math.max(mid, down * 1.05, parkRow, yards, 0.1);
    const shore = Math.min(x - xw(z), xe(z) - x); if (shore < 380) d *= 0.45 + 0.55 * shore / 380; // 河边矮一些，桥才看得见
    const hmax = 28 + (d > 0.4 ? 390 : 300) * d;
    let h = 14 + (hmax - 14) * Math.pow(r(), d > 0.45 ? 1.7 : 2.3);
    if (r() < 0.035 * d) h *= 1.45;
    const dd = Math.hypot(x, z * (z > 0 ? 0.7 : 1));
    if (dd < 1000) h = Math.min(h, 70 + dd * 0.09);                                    // 身边一圈矮一些，才俯瞰得到
    if (z < Z0 && z > -1500 && Math.abs(x) < 170) h = Math.min(h, 118 + (-z) * 0.035); // 正前方别挡视线
    if (z >= Z0 - 2 && z < 80 && Math.abs(x) < 260) h = Math.min(h, 75);              // 自己这个街区
    return h;
  }
  for (let k = -8; k <= 6; k++) {
    for (let j = Math.floor((ZS - Z0) / STR); j <= Math.ceil((ZN - Z0) / STR); j++) {
      let ax0 = k * AVE + AVE_W / 2, ax1 = (k + 1) * AVE - AVE_W / 2;
      const bz0 = Z0 + j * STR + STR_W / 2, bz1 = Z0 + (j + 1) * STR - STR_W / 2;
      if (bz0 > Z0 && (k === -1 || k === 0)) { if (k === 0) continue; ax1 = AVE - AVE_W / 2; } // 自己这栋楼在大道尽头：背后的两个街区连成一块
      const cz = (bz0 + bz1) / 2, cx = (ax0 + ax1) / 2;
      if (inPark(cx, cz, 30)) continue;
      const dist = Math.hypot(cx, cz), scale = 1 + dist / 2400;
      const rows = dist > 3800 ? [[bz0, bz1]] : [[bz0, cz - 0.6], [cz + 0.6, bz1]];
      for (const [z0, z1] of rows) {
        let x = ax0;
        while (x < ax1 - 5) {
          let w = (13 + r() * 34) * scale; if (x + w > ax1 - 9) w = ax1 - x;
          const lx0 = x, lx1 = x + w; x += w + (r() < 0.12 ? 3 + r() * 8 : 0.4);
          const mx = (lx0 + lx1) / 2, mz = (z0 + z1) / 2;
          if (!onIsland(lx0, z0, 6) || !onIsland(lx1, z1, 6) || !onIsland(lx0, z1, 6) || !onIsland(lx1, z0, 6)) continue;
          if (isReserved(lx0, lx1, z0, z1)) continue;
          if (r() < 0.04) continue; // 偶尔空一块：小广场、停车场
          const h = heightAt(mx, mz);
          const style = h > 150 ? (r() < 0.55 ? 1 : r() < 0.66 ? 2 : 0) : h > 60 ? (r() < 0.45 ? 0 : r() < 0.6 ? 2 : 1) : (r() < 0.86 ? 0 : 2);
          building(mx, mz, w - 1, z1 - z0 - 1, h, style);
        }
      }
    }
  }

  // ---------- 河对岸：沿河一条中低层，几处高楼群；更远处只有灯 ----------
  function shoreStrip(edge, dir, z0, z1, depth, clusters) {
    for (let z = z0; z < z1; z += 38 + r() * 18) {
      for (let k = 0; k < depth; k += 44 + r() * 24) {
        const ex = edge(z) + dir * (40 + k), w = 26 + r() * 22, d = 22 + r() * 16;
        if (isReserved(ex - w / 2, ex + w / 2, z - d / 2, z + d / 2)) continue;
        let h = 9 + Math.pow(r(), 2) * 30;
        for (const c of clusters) { const f = Math.exp(-(((ex - c.x) / c.rx) ** 2 + ((z - c.z) / c.rz) ** 2)); h = Math.max(h, 20 + c.h * f * Math.pow(r(), 1.4)); }
        building(ex, z, w, d, h, h > 90 ? (r() < 0.7 ? 1 : 2) : (r() < 0.8 ? 0 : 2), 0.9);
      }
    }
  }
  shoreStrip(EAST, 1, -9800, 4200, 700, [{ x: 2550, z: -1150, rx: 380, rz: 420, h: 210 }, { x: 2700, z: -6600, rx: 520, rz: 600, h: 150 }]);
  shoreStrip(WEST, -1, -9000, 3500, 520, [{ x: -3350, z: -7000, rx: 420, rz: 700, h: 230 }, { x: -3300, z: -2600, rx: 300, rz: 500, h: 120 }]);

  // ---------- 地标 ----------
  const crownMats = [];
  const crownMat = (color, k = 1) => { const m = new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.6, emissive: color, emissiveIntensity: 0 }); m.userData.k = k; crownMats.push(m); return m; };
  const add = (g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; group.add(me); return me; };
  const tiers = (list, style, seed) => { // list: [w, d, y0, y1]
    const g = mergeGeometries(list.map(([w, d, y0, y1]) => { const b = new THREE.BoxGeometry(w, y1 - y0, d); b.translate(0, (y0 + y1) / 2, 0); return b; }));
    return bldConst(g, [seed, style, G, 1.15]);
  };
  // 地标：Blender 模型（scripts/blender/nyc*.py），原创造型，不照抄任何真实建筑
  const MODELS = `${import.meta.env.BASE_URL}vista-models/nyc/`;
  const placements = {};
  const place = (name, x, z, rot = 0, s = 1, y = G) => { (placements[name] ||= []).push([x, y, z, rot, s]); };
  const landmark = (name, x, z, rad, top, rot = 0, s = 1) => { reserve(x - rad, x + rad, z - rad, z + rad); place(name, x, z, rot, s); tallTops.push([x, G + top * s + 3, z]); };
  landmark('deco_tower', -390, -1180, 75, 439);                 // 阶梯式装饰艺术摩天楼 + 系泊杆尖顶（左前）
  landmark('crown_tower', 560, -1060, 45, 323, 0.3);            // 拱形钢冠尖塔（右前）
  landmark('supertall', -470, -7650, 50, 541);                  // 下城的超高层（正前方大道尽头）
  landmark('slant_tower', 260, -1500, 32, 292);                 // 斜顶办公楼，斜面朝着我们
  for (const [x, z, h] of [[-60, 1360, 430], [230, 1300, 472], [-430, 1390, 330], [-250, 1330, 300], [480, 1340, 260]]) landmark('pencil_tower', x, z, 22, 422, Math.PI, h / 422); // 公园南边的铅笔楼（身后）
  for (const [x, z, h] of [[-260, -7080, 250], [-640, -6920, 220], [-130, -7400, 200]]) landmark('pyramid_tower', x, z, 34, 253, 0, h / 253); // 下城金字塔尖顶老楼
  // 7) 西边河畔的新区：几座玻璃塔，顶是斜切的
  for (const [x, z, h, w] of [[-1480, -1380, 390, 52], [-1340, -1520, 330, 44], [-1560, -1600, 300, 40], [-1300, -1250, 270, 46]]) {
    reserve(x - w, x + w, z - w, z + w);
    const b = new THREE.BoxGeometry(w, h, w * 0.8); b.translate(0, h / 2, 0);
    const p = b.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > h - 1 && p.getX(i) > 0) p.setY(i, h - w * 0.5);
    const g = b.toNonIndexed(); g.computeVertexNormals(); bldConst(g, [(x + 2000) / 900, 1, G, 1]);
    const me = add(g, facade, x, G, z); me.rotation.y = 0.4 + (x % 3) * 0.2;
    tallTops.push([x, G + h + 3, z]);
  }

  // 把一批批盒子变成实例化网格
  for (const t of tiles.values()) {
    const g = boxGeo.clone(); bldAttr(g, t.b);
    const im = new THREE.InstancedMesh(g, facade, t.m.length);
    t.m.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, t.c[i]); });
    im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 高楼顶上打光的冠：白天就是楼顶的一截，夜里亮成暖白、冷白或淡金 ----------
  const crownMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), crowns.length);
  crowns.forEach(([x, y, z, w, d, h], i) => {
    tmpM.compose(tmpP.set(x, y, z), tmpQ.identity(), tmpS.set(w, h, d)); crownMesh.setMatrixAt(i, tmpM);
    crownMesh.setColorAt(i, tmpC.set(['#ffe6b8', '#f2f6ff', '#ffd08a', '#cfe2ff', '#ffffff'][(r() * 5) | 0]).clone());
  });
  crownMesh.computeBoundingSphere(); group.add(crownMesh);

  // ---------- 屋顶水箱和屋顶设备（模型）----------
  for (const [x, y, z, s] of rooftops) if (Math.hypot(x, z) < 2600) place('water_tower', x, z, r() * 6, s, y);
  for (const [x, y, z, s] of roofSets) place('rooftop_set', x, z, (r() * 4 | 0) * Math.PI / 2, clamp(s, 0.6, 1.6), y);

  // ---------- 地面：岛、两岸、公园（程序化街道网格，夜里路面有一层钠灯的橙光）----------
  const grounds = [];
  const groundMat = (per, half, off, park = false) => {
    const m = new THREE.MeshStandardMaterial({ color: park ? '#2c3a26' : '#ffffff', roughness: 0.95 });
    const u = { uNight: { value: 0 } }; grounds.push(u);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vGP;')
        .replace('#include <color_fragment>', park ? `#include <color_fragment>
          float gEm = 0.;` : `#include <color_fragment>
          vec2 per = vec2(${per[0].toFixed(1)}, ${per[1].toFixed(1)}), hw = vec2(${half[0].toFixed(1)}, ${half[1].toFixed(1)});
          vec2 q = abs(mod(vGP.xz - vec2(0., ${off.toFixed(1)}) + per * .5, per) - per * .5);
          vec2 fw = fwidth(vGP.xz) + 1e-3;
          vec2 rd = 1. - smoothstep(hw - fw, hw + fw, q);
          vec2 wk = 1. - smoothstep(hw + 4. - fw, hw + 4. + fw, q);
          ${off === Z0 ? 'if (abs(vGP.x) < 20. && vGP.z > -24.) { rd.x = 0.; wk.x = 0.; }' : ''}
          float road = max(rd.x, rd.y), walk = max(wk.x, wk.y) - road;
          float far = smoothstep(3., 12., max(fw.x, fw.y));
          road = mix(road, (hw.x * 2. / per.x + hw.y * 2. / per.y) * .9, far); walk = mix(walk, .12, far);
          diffuseColor.rgb *= vec3(.3, .29, .28) * (1. - road - walk) + vec3(.07, .07, .075) * road + vec3(.42, .4, .37) * walk;
          float gEm = road + walk * .4;`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1., .5, .2) * gEm * uNight * .3;');
    };
    m.customProgramCacheKey = () => `nycg${per}${park}`;
    return m;
  };
  const shapeMesh = (pts, mat, y) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    const me = new THREE.Mesh(g, mat); me.position.y = y; me.receiveShadow = true; group.add(me); return me;
  };
  {
    const pts = [];
    for (let z = ZN; z >= ZS; z -= 100) pts.push([xw(z), z]);
    for (let z = ZS; z <= ZN; z += 100) pts.push([xe(z), z]);
    shapeMesh(pts, groundMat([AVE, STR], [AVE_W / 2, STR_W / 2], Z0), G);
    const east = [[EAST(-16000), -16000]]; for (let z = -16000; z <= 12000; z += 200) east.push([EAST(z), z]); east.push([16000, 12000], [16000, -16000]);
    shapeMesh(east, groundMat([130, 90], [7, 5], 13), G);
    const west = [[-16000, -16000]]; for (let z = -16000; z <= 12000; z += 200) west.push([WEST(z), z]); west.push([-16000, 12000]);
    shapeMesh(west, groundMat([110, 95], [7, 5], 31), G);
    // 岛北头外面接着是陆地（哈莱姆河很窄，直接连上）
    shapeMesh([[xw(ZN), ZN], [xe(ZN), ZN], [EAST(ZN), ZN], [EAST(12000), 12000], [WEST(12000), 12000], [WEST(ZN), ZN]], groundMat([130, 90], [7, 5], 13), G);
    // 公园：草地 + 一个水库
    const park = new THREE.Mesh(new THREE.PlaneGeometry(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0), groundMat(0, 0, 0, true));
    park.rotation.x = -Math.PI / 2; park.position.set((PARK.x0 + PARK.x1) / 2, G + 0.4, (PARK.z0 + PARK.z1) / 2); group.add(park);
  }
  // 公园里的树
  {
    const tree = new THREE.IcosahedronGeometry(1, 0); tree.translate(0, 1, 0);
    const N = 2600, im = new THREE.InstancedMesh(tree, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), N);
    let n = 0;
    for (let i = 0; i < N * 2 && n < N; i++) {
      const x = lerp(PARK.x0 + 10, PARK.x1 - 10, r()), z = lerp(PARK.z0 + 10, PARK.z1 - 10, r());
      if (Math.hypot((x + 250) / 280, (z - 3100) / 230) < 1) continue; // 水库
      const s = 4 + r() * 5;
      tmpM.compose(tmpP.set(x, G, z), tmpQ.identity(), tmpS.set(s, s * (0.8 + r() * 0.5), s)); im.setMatrixAt(n, tmpM);
      im.setColorAt(n, tmpC.set(['#3a5a30', '#466a36', '#2e4a2a', '#5a6a34'][(r() * 4) | 0]).clone()); n++;
    }
    im.count = n; im.castShadow = true; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 水 ----------
  const water = waterMaterial({ deep: '#0e1e26', scale: 1.4, amp: 0.8 });
  const wmesh = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), water); wmesh.rotation.x = -Math.PI / 2; wmesh.position.y = WATER; group.add(wmesh);
  const res = new THREE.Mesh(new THREE.CircleGeometry(1, 32), water); res.rotation.x = -Math.PI / 2; res.scale.set(280, 230, 1); res.position.set(-250, G + 0.6, 3100); group.add(res);

  // ---------- 桥 ----------
  const lightPts = [];      // 普通灯点：钠灯、白灯
  const necklace = [];      // 桥上的项链灯
  const refl = [];          // 水面倒影
  const cars = [];
  const lineMat = new THREE.LineBasicMaterial({ color: '#3a3c40' });
  const steelM = new THREE.MeshStandardMaterial({ color: '#7a8088', roughness: 0.6, metalness: 0.4 });
  const stoneM = new THREE.MeshStandardMaterial({ color: '#a89a84', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0 });
  const VIEW = new THREE.Vector3(0, 1.6, 0);
  // 灯在水面上的倒影位置：视线在水面反射的那一点
  const addRefl = (x, y, z, c, s) => {
    const H = VIEW.y - WATER, hh = y - WATER; if (hh < 0) return;
    const k = H / (H + hh), rx = VIEW.x + (x - VIEW.x) * k, rz = VIEW.z + (z - VIEW.z) * k;
    const onRiver = (rx > xe(rz) + 10 && rx < EAST(rz) - 10) || (rx < xw(rz) - 10 && rx > WEST(rz) + 10) || rz < ZS - 200;
    if (onRiver) refl.push({ x: rx, y: WATER + 0.5, z: rz, c, s: s * 6, seed: r() });
  };
  for (const b of BRIDGES) {
    const xa = xe(b.z) - 60, xb = EAST(b.z) + 60, t0 = xe(b.z) + 110, t1 = EAST(b.z) - 110;
    const dy = WATER + b.deck, top = dy + b.tower;
    // 桥面（两头接引桥坡道下到地面）
    const deck = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 4, 30), steelM); deck.position.set((xa + xb) / 2, dy - 2, b.z); group.add(deck);
    for (const [x0, x1] of [[xa - 380, xa], [xb, xb + 380]]) {
      const len = x1 - x0, ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 3, 26), steelM);
      ramp.position.set((x0 + x1) / 2, (dy + G) / 2 - 1.5, b.z); group.add(ramp);
      ramp.scale.x = Math.hypot(len, dy - G) / len;
      ramp.rotation.z = x0 < xa ? Math.atan2(dy - G, len) : -Math.atan2(dy - G, len);
    }
    // 桥塔（模型：门洞正面朝 -Y，转 90° 让桥面从门洞穿过；按这座桥的塔顶高度缩放）
    for (const tx of [t0, t1]) {
      if (b.stone) place('bridge_tower_stone', tx, b.z, Math.PI / 2, (top - WATER) / 91.6, WATER);
      else place('bridge_tower_steel', tx, b.z, Math.PI / 2, (top - WATER + 8) / 92.2, WATER - 8);
      lightPts.push({ x: tx, y: top + 3, z: b.z, c: [1, 0.12, 0.08], s: 1.5 });
    }
    // 主缆：锚 → 塔顶 → 塔顶 → 锚，挂满灯
    for (const sz of [-14, 14]) {
      const z = b.z + sz, pts = [];
      const seg = (xA, yA, xB, yB, sag, n) => { for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(xA, xB, t), y = lerp(yA, yB, t) - sag * 4 * t * (1 - t); pts.push(new THREE.Vector3(x, y, z)); } };
      seg(xa, dy, t0, top, 12, 20); seg(t0, top, t1, top, top - dy - 4, 60); seg(t1, top, xb, dy, 12, 20);
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      const sus = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (i % 2 === 0) { necklace.push({ x: p.x, y: p.y, z: p.z, c: [1, 0.95, 0.82], s: 1.2 }); addRefl(p.x, p.y, p.z, [1, 0.9, 0.7], 1.2); }
        if (p.y > dy + 2) sus.push(p.x, p.y, z, p.x, dy, z);
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sus, 3));
      group.add(new THREE.LineSegments(sg, lineMat));
    }
    // 桥面路灯和车
    for (let x = xa; x <= xb; x += 28) for (const sz of [-15, 15]) { lightPts.push({ x, y: dy + 7, z: b.z + sz, c: [1, 0.62, 0.3], s: 1.6 }); if (sz < 0) addRefl(x, dy + 7, b.z + sz, [1, 0.55, 0.25], 1.4); }
    for (const [dir, lane] of [[1, -5], [-1, 5]]) {
      const n = 60;
      for (let i = 0; i < n; i++) {
        const head = dir > 0;
        cars.push({ x: dir > 0 ? xa : xb, y: dy + 0.8, z: b.z + lane, ex: dir > 0 ? xb : xa, ey: dy + 0.8, ez: b.z + lane, v: 14 + r() * 6, seed: i / n + r() * 0.01, c: head ? [1, 0.25, 0.18] : [1, 0.9, 0.7], s: 1.3, day: [0.2, 0.2, 0.22] });
      }
    }
  }

  // ---------- 街灯、车流、岸边的灯、远处的灯海 ----------
  const sodium = [1, 0.58, 0.26], led = [0.9, 0.92, 1], warm = [1, 0.75, 0.45];
  // 大道和街道的路灯（曼哈顿）
  for (let k = -8; k <= 6; k++) {
    const ax = k * AVE;
    for (let z = ZS; z < ZN; z += 34) for (const sx of [-AVE_W / 2 - 1, AVE_W / 2 + 1]) {
      const x = ax + sx; if (!onIsland(x, z, 4) || inPark(x, z) || (k === 0 && z > Z0)) continue;
      lightPts.push({ x, y: G + 8, z, c: r() < 0.7 ? sodium : led, s: 1.4 });
    }
  }
  for (let z = Z0; z > ZS; z -= STR) for (let x = -1800; x < 1350; x += 42) { if (!onIsland(x, z, 4)) continue; lightPts.push({ x, y: G + 7, z: z + (r() < 0.5 ? -STR_W / 2 : STR_W / 2), c: r() < 0.6 ? sodium : led, s: 1.2 }); }
  for (let z = Z0 + STR; z < ZN; z += STR) for (let x = -1800; x < 1350; x += 42) { if (!onIsland(x, z, 4) || inPark(x, z)) continue; lightPts.push({ x, y: G + 7, z, c: sodium, s: 1.2 }); }
  // 公园小路的灯
  for (let i = 0; i < 260; i++) { const x = lerp(PARK.x0, PARK.x1, r()), z = lerp(PARK.z0, PARK.z1, r()); lightPts.push({ x, y: G + 4, z, c: warm, s: 1 }); }
  // 岸边步道
  for (let z = ZS + 100; z < ZN; z += 30) {
    lightPts.push({ x: xe(z) - 6, y: G + 6, z, c: led, s: 1.2 }); addRefl(xe(z) - 6, G + 6, z, [0.8, 0.85, 1], 1);
    lightPts.push({ x: xw(z) + 6, y: G + 6, z, c: sodium, s: 1.2 }); addRefl(xw(z) + 6, G + 6, z, [1, 0.55, 0.25], 1);
  }
  for (let z = -12000; z < 9000; z += 34) {
    lightPts.push({ x: EAST(z) + 8, y: G + 6, z, c: sodium, s: 1.2 }); addRefl(EAST(z) + 8, G + 6, z, [1, 0.55, 0.25], 1.2);
    lightPts.push({ x: WEST(z) - 8, y: G + 6, z, c: led, s: 1.2 }); addRefl(WEST(z) - 8, G + 6, z, [0.85, 0.9, 1], 1.2);
  }
  // 对岸远处：沿街排开的灯海，有疏有密
  const carpet = [];
  const sprawl = (inside, x0, x1, z0, z1, px, pz) => {
    for (let z = z0; z < z1; z += pz) {
      const rowOn = r() < 0.9;
      for (let x = x0; x < x1; x += 55 + r() * 30) {
        if (!inside(x, z)) continue;
        const dens = 0.35 + 0.65 * smooth(0.25, 0.65, fbmLite(x * 0.0006, z * 0.0006));
        if (!rowOn || r() > dens) continue;
        carpet.push({ x, y: G + 6, z: z + (r() - 0.5) * 6, c: r() < 0.72 ? sodium : r() < 0.6 ? led : warm, s: 1.4 });
      }
      for (let x = x0 + (r() * px); x < x1; x += px) { // 南北向的街
        if (!inside(x, z) || r() > 0.55) continue;
        carpet.push({ x: x + (r() - 0.5) * 6, y: G + 6, z: z + pz * 0.5, c: sodium, s: 1.4 });
      }
    }
  };
  function fbmLite(x, y) { return (Math.sin(x * 3.1 + Math.sin(y * 2.3)) * 0.5 + Math.sin(y * 4.7 + x * 1.3) * 0.3 + Math.sin(x * 9.1 - y * 7.7) * 0.2) * 0.5 + 0.5; }
  sprawl((x, z) => x > EAST(z) + 30, 2200, 15000, -15000, 10000, 260, 150);
  sprawl((x, z) => x < WEST(z) - 30, -15000, -3000, -15000, 10000, 240, 160);
  sprawl((x, z) => z > ZN && x > WEST(z) && x < EAST(z), -3000, 2200, ZN, 10000, 250, 140);

  // 车流：大道南北双向（迎面白色车头灯、远去红色尾灯），一部分横街，岸边的快速路
  const taxi = [0.95, 0.75, 0.12], carDay = () => (r() < 0.3 ? taxi : r() < 0.5 ? [0.08, 0.08, 0.09] : r() < 0.5 ? [0.8, 0.8, 0.82] : [0.35, 0.36, 0.4]);
  const lane = (x0, z0, x1, z1, toward, n, v) => {
    for (let i = 0; i < n; i++) {
      const seed = (i + r() * 0.6) / n;
      cars.push({ x: x0, y: G + 0.8, z: z0, ex: x1, ey: G + 0.8, ez: z1, v: v * (0.7 + r() * 0.6), seed, c: toward ? [1.6, 1.4, 1.1] : [1.6, 0.22, 0.12], s: 2.2, day: carDay() });
    }
  };
  for (let k = -7; k <= 5; k++) {
    const ax = k * AVE, zTop = k === 0 ? Z0 - 10 : ZN - 50, zBot = ZS + 400;
    if (!onIsland(ax, -1000, 10)) continue;
    const len = zTop - zBot, n = Math.floor(len / 13);
    // 车头朝 +z（朝我们开）看到车头灯，朝 -z 看到尾灯
    lane(ax - 6, zBot, ax - 6, zTop, true, n, 9);
    lane(ax + 6, zTop, ax + 6, zBot, false, n, 9);
  }
  for (let z = Z0 - STR; z > ZS + 600; z -= STR * 3) lane(xw(z) + 60, z, xe(z) - 60, z, false, 40, 7);
  for (let z = Z0 - STR * 2; z > ZS + 600; z -= STR * 3) lane(xe(z) - 60, z, xw(z) + 60, z, false, 40, 7);
  // 岸边快速路：沿着岸线分段
  const shoreRoad = (fx, off, z0, z1, n, toward) => { const step = (z1 - z0) / 12; for (let s = 0; s < 12; s++) { const za = z0 + s * step, zb = za + step; lane(fx(za) + off, za, fx(zb) + off, zb, toward, n, 18); } };
  shoreRoad(xe, -20, ZS + 800, ZN, 30, false); shoreRoad(xe, -26, ZN, ZS + 800, 30, true);
  shoreRoad(xw, 20, ZS + 1500, ZN, 30, false); shoreRoad(xw, 26, ZN, ZS + 1500, 30, true);
  shoreRoad(EAST, 30, -12000, 9000, 40, false); shoreRoad(EAST, 36, 9000, -12000, 40, true);

  // ---------- 时代广场那样的一片广告屏 ----------
  const boards = [];
  {
    const bx = -250, bz = -584;
    const plane = new THREE.PlaneGeometry(1, 1);
    const N = 54, im = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true, fog: true }), N);
    for (let i = 0; i < N; i++) {
      const side = (r() * 4) | 0, w = 8 + r() * 18, h = 6 + r() * 16, y = G + 12 + r() * 48, along = (r() - 0.5) * 220;
      const [x, z, ry] = side === 0 ? [bx - 16, bz + along * 0.5, Math.PI / 2] : side === 1 ? [bx + 16, bz + along * 0.5, -Math.PI / 2] : side === 2 ? [bx + along * 0.3, bz - 10, 0] : [bx + along * 0.3, bz + 10, Math.PI];
      tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(up, ry), tmpS.set(w, h, 1)); im.setMatrixAt(i, tmpM);
      boards.push({ hue: r(), sp: 0.02 + r() * 0.1, k: 0.8 + r() * 0.8 });
      im.setColorAt(i, tmpC.setHSL(r(), 0.8, 0.5));
    }
    im.computeBoundingSphere(); group.add(im); boards.mesh = im;
  }

  // ---------- 灯点网格 ----------
  const F = 0.0002;
  const lamps = makeLights([...lightPts, ...carpet], { fog: F * 0.7, minPx: 1.2, maxPx: 3, gain: 1.5 }); group.add(lamps);
  const neck = makeLights(necklace, { fog: F, minPx: 1, maxPx: 3, gain: 1.1, twinkle: 0.15 }); group.add(neck);
  const reflP = makeLights(refl, { fog: F, streak: true, minPx: 3, maxPx: 14, gain: 0.55 }); group.add(reflP);
  const carP = makeLights(cars, { fog: F, moving: true, additive: false, minPx: 1.3, maxPx: 3, gain: 1 }); group.add(carP);
  const red = makeLights(tallTops.map(([x, y, z]) => ({ x, y, z, c: [1, 0.08, 0.04], s: 2.2, seed: r() * 0.3 })), { fog: F, blink: true, minPx: 1.5, maxPx: 4, gain: 1.4 }); group.add(red);
  // 天上：飞机（白色频闪 + 红绿航行灯），慢慢从远处划过
  const planes = [];
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, d = 9000, y = 600 + r() * 1400, z0 = -3000 - r() * 6000;
    const p0 = [Math.cos(a) * d, y, z0 + Math.sin(a) * d * 0.4], p1 = [-p0[0], y + (r() - 0.5) * 300, z0 - Math.sin(a) * d * 0.4];
    planes.push({ x: p0[0], y: p0[1], z: p0[2], ex: p1[0], ey: p1[1], ez: p1[2], v: 70 + r() * 40, seed: r(), c: [1, 1, 1], s: 3, day: [0, 0, 0] });
  }
  const planeP = makeLights(planes, { fog: F * 0.4, moving: true, blink: true, minPx: 1.5, maxPx: 3, gain: 1.6 }); group.add(planeP);

  // ---------- 河上的渡轮 ----------
  const ferries = [];
  for (let i = 0; i < 4; i++) {
    const zf = -2600 - r() * 5000, east = i % 2 === 0;
    const xa = east ? xe(zf) + 30 : WEST(zf) + 30, xb = east ? EAST(zf) - 30 : xw(zf) - 30;
    ferries.push({ x: xa, y: WATER + 3, z: zf, ex: xb, ey: WATER + 3, ez: zf + (r() - 0.5) * 600, v: 5 + r() * 3, seed: r(), c: [1, 0.9, 0.7], s: 4, day: [0.9, 0.85, 0.7] });
  }
  const ferryP = makeLights(ferries, { fog: F, moving: true, additive: false, minPx: 2, maxPx: 3, gain: 1 }); group.add(ferryP);

  const modelBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 });
  const modelGlow = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#555555' });
  const loaded = instanceModels(group, MODELS, placements, { body: modelBody, glow: () => modelGlow, castShadow: (n) => !/rooftop|water/.test(n) });
  const clouds = cloudLayer(group, { y: 1900, cover: 0.5, scale: 1.2, night: '#7a4c3a', nightK: 0.6 }); // 夜里云底被城市的灯映成橙色
  // 美术配色：白天通透的蓝；日落是深蓝天顶 → 紫 → 橙金的天边，对面一道粉紫；夜里不是黑的，是被整座城映亮的深紫，地平线一圈橙色光雾
  const art = makeArt([
    [40, { zen: '#2462d0', mid: '#5f9ae4', hor: '#d4e2ec', glow: '#fff0d6', anti: '#c4d6ea', sun: '#fff2dc', sunK: 2.6, hemi: '#a8c6ee', ground: '#5c5a5c', hemiK: 0.9, fog: '#c2d2e0', fogK: 1, cloudLit: '#ffffff', cloudShade: '#9ab0ca', cloudK: 0.9, deep: '#1c3644', lit: 0.0, halo: 0.8 }],
    [14, { zen: '#2458c4', mid: '#6a9ee0', hor: '#f4dcbc', glow: '#ffc27a', anti: '#a8c0e4', sun: '#ffd09a', sunK: 2.6, hemi: '#a8bce4', ground: '#6a5a50', hemiK: 0.85, fog: '#e2d0bc', fogK: 1, cloudLit: '#fff0d8', cloudShade: '#98a4c4', cloudK: 0.9, deep: '#1c3644', lit: 0.05, halo: 1 }],
    [4, { zen: '#16388e', mid: '#4a6cc4', hor: '#ff9a4a', glow: '#ff6a24', anti: '#d48ab8', sun: '#ff8a3a', sunK: 2.4, hemi: '#9a86c4', ground: '#5a4040', hemiK: 0.85, fog: '#e8946e', fogK: 1.2, cloudLit: '#ff8a50', cloudShade: '#6c4c90', cloudK: 0.95, deep: '#2a2a48', lit: 0.45, halo: 1.6 }],
    [-1, { zen: '#102a78', mid: '#3448a6', hor: '#ff7a3c', glow: '#ff4e1e', anti: '#a86aae', sun: '#ff5a28', sunK: 0.6, hemi: '#6c64ac', ground: '#4a3240', hemiK: 0.75, fog: '#c86a6a', fogK: 1.3, cloudLit: '#ff6a4a', cloudShade: '#4a3478', cloudK: 0.95, deep: '#1e1c3c', lit: 0.8, halo: 1.6 }],
    [-5, { zen: '#0a1a5a', mid: '#283a96', hor: '#e86a4a', glow: '#d8503a', anti: '#5a4a9a', sun: '#000000', sunK: 0, hemi: '#3e4a96', ground: '#5a3a30', hemiK: 0.7, fog: '#6a4a7a', fogK: 1.5, cloudLit: '#e26a6a', cloudShade: '#2e2a62', cloudK: 0.9, deep: '#10163a', lit: 1, halo: 0 }],
    [-11, { zen: '#060c34', mid: '#141c56', hor: '#8a4458', glow: '#9a4a4a', anti: '#3a2e5e', sun: '#000000', sunK: 0, hemi: '#2a2e62', ground: '#6a4028', hemiK: 0.7, fog: '#5a3a52', fogK: 1.7, cloudLit: '#a85a4a', cloudShade: '#22183a', cloudK: 0.8, deep: '#0a0c22', lit: 1, halo: 0 }],
    [-25, { zen: '#05081c', mid: '#0e1238', hor: '#6e3a4a', glow: '#6e3a4a', anti: '#4a2c48', sun: '#000000', sunK: 0, hemi: '#20244a', ground: '#7a4626', hemiK: 0.75, fog: '#4a3044', fogK: 1.8, cloudLit: '#9a5038', cloudShade: '#1e1426', cloudK: 0.75, deep: '#06080e', lit: 1, halo: 0 }],
  ]);
  const skyArt = artSky(group);
  const crownCols = ['#ffe2a8', '#ffffff', '#ffd27a', '#9cc8ff', '#ffe2a8', '#ffb0a0', '#ffd27a'];
  const warmGround = new THREE.Color('#4a3020');
  const crownToday = new THREE.Color(crownCols[new Date().getDay()]);
  return {
    group, fog: F, art, loaded, shadow: { center: [0, G, -1300], size: 1700, normalBias: 2 },
    dome: { top: '#06081a', horizon: '#4a3038' }, // 地平线上一层城市光污染的橙红
    update(dt, t, sky, atmo, sc) {
      const c = sky.state.c, n = c.night, h = c.h;
      const A = art.update(c.sunElev);
      skyArt.update(art, sky);
      this.dirK = 0.25; this.envK = 0.6;
      sky.stars.material.uniforms.uOpacity.value *= 0.25; // 城里光污染，星星很少
      // 灯火通明：天一暗几乎每扇窗都亮，后半夜也只熄一部分；窗灯亮到能起光晕
      const L = A.lit;
      this.glow = { k: lerp(0.25, 0.75, L), t: lerp(0.7, 0.32, L) }; // 夜里整座城的灯火有一层光晕
      fu.uNight.value = L; fu.uLit.value = lerp(0.35, h > 1 && h < 6 ? 0.62 : 0.8, L); fu.uTime.value = t; fu.uGlow.value = 1.75;
      for (const g of grounds) g.uNight.value = L * 2.2;
      for (const m of crownMats) m.emissiveIntensity = L * (m.userData.k || 1) * 1.6;
      modelGlow.color.setScalar(lerp(0.32, 1.7, L)); // 地标的窗带、冠顶：白天像玻璃，夜里亮起来
      crownMats[0]?.emissive.copy(crownToday);
      stoneM.emissiveIntensity = L * 0.2;
      const ln = smooth(0.1, 0.8, L);
      crownMesh.material.color.setScalar(lerp(0.16, 1.6, ln));
      for (const p of [lamps, neck, reflP, red]) { p.material.uniforms.uOpacity.value = ln; p.material.uniforms.uTime.value = t; p.visible = ln > 0.01; }
      red.material.uniforms.uOpacity.value = 0.35 + 0.65 * ln;
      for (const p of [carP, planeP, ferryP]) { p.material.uniforms.uTime.value = t; p.material.uniforms.uNight.value = ln; }
      carP.material.uniforms.uGain.value = lerp(0.8, 1.6, ln);
      planeP.material.uniforms.uOpacity.value = 0.3 + 0.7 * ln;
      updateWater(water, dt, sky, atmo, { art });
      clouds.update(dt, sky, atmo, art);
      // 广告屏慢慢换颜色
      const im = boards.mesh;
      for (let i = 0; i < 4; i++) { const k = (Math.random() * boards.length) | 0, b = boards[k]; b.hue = (b.hue + b.sp) % 1; im.setColorAt(k, tmpC.setHSL(b.hue, 0.75, 0.5).multiplyScalar(b.k * lerp(0.9, 1.5, n))); }
      im.instanceColor.needsUpdate = true;
    },
  };
}
