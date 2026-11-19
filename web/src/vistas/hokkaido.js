// 北海道：四层老楼的楼顶，冬天海边小镇。正前方一条压实雪的街一直通到车站和海边，电线杆一根根排过去，
// 两边是铁皮屋顶的小房子（红、蓝、绿的屋顶上盖着雪），铁路横穿小镇（偶尔来一节单厢柴油车，道口会闪红灯落杆），
// 再往外是防风林隔开的雪原、红色谷仓和筒仓，海边漂着流冰，海对面是一座孤零零的雪火山，左边是一排雪山。
// 夕阳很低，电线杆、房子、树在雪地上拖出长长的影子（假影子：贴在雪上的长条，随太阳转）。天黑后是深蓝的夜空、
// 零星的窗灯和钠灯，海平线上是捕鱿鱼船的渔火。一直在下小雪。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, glowTex } from '../textures.js';
import { rng, fbm, smooth, clamp, lerp, facadeMaterial, bldAttr, bldConst, litRatio, makeLights, waterMaterial, updateWater, ridge, tint, cloudLayer, makeArt, artSky, GLSL, nightSky, instanceModels, loadModel } from './common.js';

const G = -12;               // 地面：四层楼
const WATER = G - 16;           // 小镇在朝海的缓坡上，海面比楼脚低
const MAIN_X = 4, RAIL_Z = -300;
// 海岸线：正前方四百来米就是海，右边更近；左边海岸往远处弯出去，那边是雪原和农家
const coastZ = (x) => (x > -650 ? -440 + 0.16 * x + 30 * Math.sin(x * 0.006) : -440 - 104 - (-650 - x) * 0.55 + 30 * Math.sin(x * 0.006));
function ground(x, z) {
  const town = smooth(420, 800, Math.hypot(x * 0.8, z + 100));
  let y = G + (fbm(x * 0.004, z * 0.004, 4) - 0.5) * 6 * town;
  if (z > 400) y += smooth(400, 2600, z) * 220 * (0.6 + fbm(x * 0.0012, z * 0.001, 4) * 0.8); // 身后的山
  if (x < -1800) y += smooth(-1800, -3200, x) * 120 * fbm(x * 0.002, z * 0.002, 3);          // 左边的岬角
  const cz = coastZ(x);
  y -= Math.pow(smooth(-60, cz + 50, z), 0.9) * (G - WATER - 2.5);                                           // 一路缓缓下坡到海边
  const k = smooth(cz + 30, cz - 25, z);                                                       // 沙滩落进海里
  return lerp(y, WATER - 4, k);
}

export function createHokkaido(scene) {
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const r = rng(1868);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmpC = new THREE.Color();
  const casters = []; // 拖影子的东西 [x, z, 高, 宽]
  const glitU = { uGlitDir: { value: new THREE.Vector3(0, 1, 0) }, uGlitCol: { value: new THREE.Color() }, uGlit: { value: 0 } };

  // ---------- 雪地 ----------
  {
    const W = 9000, D = 7000, g = new THREE.PlaneGeometry(W, D, 300, 230); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const snow = new THREE.Color('#f4f8fc'), blue = new THREE.Color('#dce6f2'), beach = new THREE.Color('#b8b4ac'), forest = new THREE.Color('#5a6a64');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) - 1500;
      const y = ground(x, z); p.setY(i, y); p.setZ(i, z);
      const n = fbm(x * 0.01, z * 0.01, 3);
      const c = snow.clone().lerp(blue, n * 0.6);
      const cz = coastZ(x); if (z < cz + 40 && z > cz - 40) c.lerp(beach, 0.35 * smooth(cz + 40, cz - 10, z));
      if (z > 600) c.lerp(forest, smooth(600, 1400, z) * (0.35 + fbm(x * 0.003, z * 0.003, 3) * 0.5)); // 身后山上的林子（雪里透出深色）
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    // 雪面闪光：每一小块雪有一个随机朝向的「冰晶面」，正好把太阳（夜里是月亮）反射进眼睛的那几粒就闪一下，走动时一闪一闪
    const snowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
    snowMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glitU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW; uniform vec3 uGlitDir, uGlitCol; uniform float uGlit;\n' + GLSL.HASH)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec2 cl = floor(vGW.xz * 1.3); float h1 = vh21(cl), h2 = vh21(cl + 17.3);
            vec3 rn = normalize(vec3(h1 - .5, 1.5, h2 - .5));
            vec3 Vw = normalize(cameraPosition - vGW), Hh = normalize(Vw + uGlitDir);
            float sp = pow(max(dot(rn, Hh), 0.), 260.) * step(.5, vh21(cl + 3.1));
            float dist = length(cameraPosition - vGW);
            totalEmissiveRadiance += uGlitCol * sp * uGlit * (1. - smoothstep(40., 420., dist)); }`);
    };
    snowMat.customProgramCacheKey = () => 'snowglit';
    { const tm = new THREE.Mesh(g, snowMat); tm.userData.recvOnly = true; group.add(tm); }
  }

  // ---------- 海、流冰 ----------
  const water = waterMaterial({ deep: '#1c3442', scale: 1.2, amp: 0.7 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), water); sea.rotation.x = -Math.PI / 2; sea.position.y = WATER; sea.userData.noShadow = true; group.add(sea);
  {
    const floe = new THREE.CircleGeometry(1, 7); floe.rotateX(-Math.PI / 2);
    const p = floe.attributes.position; const rr = rng(4); for (let i = 1; i < p.count; i++) { const k = 0.6 + rr() * 0.6; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    const N = 1400, im = new THREE.InstancedMesh(floe, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), N);
    let n = 0;
    for (let i = 0; i < N * 3 && n < N; i++) {
      const x = (r() - 0.5) * 9000, off = Math.pow(r(), 2.2) * 1800, z = coastZ(x) - 40 - off;
      const s = (4 + r() * 22) * (1 - off / 2600);
      tmpM.compose(tmpP.set(x, WATER + 0.15, z), tmpQ.setFromAxisAngle(up, r() * 6), tmpS.set(s, 1, s * (0.5 + r() * 0.6))); im.setMatrixAt(n, tmpM);
      im.setColorAt(n, tmpC.set('#eef4fa').multiplyScalar(0.85 + r() * 0.15).clone()); n++;
    }
    im.count = n; im.userData.recvOnly = true; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 远山：海对面的雪火山、左边一排雪山、身后近山 ----------
  {
    const g = new THREE.ConeGeometry(5600, 1750, 48, 12); const p = g.attributes.position; const col = new Float32Array(p.count * 3);
    const rock = new THREE.Color('#4a5868'), sn = new THREE.Color('#ffffff'), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rad = Math.hypot(x, z), a = Math.atan2(z, x);
      const e = (y + 875) / 1750; // 0 脚下 → 1 山顶
      const concave = Math.pow(1 - e, 1.7);                       // 火山的凹曲线
      const gully = 1 + Math.sin(a * 23) * 0.04 * e + (fbm(a * 3, e * 4, 3) - 0.5) * 0.12;
      const nr = 5600 * concave * gully + (e > 0.97 ? 0 : 0);
      if (rad > 1) { p.setX(i, x / rad * nr); p.setZ(i, z / rad * nr); }
      tmp.copy(rock).lerp(sn, smooth(0.08, 0.3, e + Math.sin(a * 23) * 0.04));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const fuji = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    fuji.position.set(5200, WATER + 875 - 30, -15500); fuji.userData.noShadow = true; group.add(fuji);
  }
  const ridges = [
    ridge(group, { z: -10000, x: -14500, y: WATER - 60, width: 16000, depth: 4000, height: 1300, seed: 31, low: '#56646e', mid: '#7a8894', high: '#c8d2dc', snow: 0.32, snowCol: '#f4f6f8', mask: (wx) => smooth(-5200, -9000, wx) }),
    ridge(group, { z: 5200, x: 0, y: G - 40, width: 26000, depth: 3600, height: 700, seed: 47, low: '#4e5a58', mid: '#6a7472', high: '#d8dee4', snow: 0.45 }),
    ridge(group, { z: -24000, x: -6000, y: WATER - 80, width: 30000, depth: 5000, height: 1600, seed: 13, low: '#6a7a8a', mid: '#8a98a6', high: '#d4dbe2', snow: 0.4, fog: false, mask: (wx) => smooth(-1000, -9000, wx) }),
  ];

  // ---------- 房子 ----------
  const houses = []; // [x, z, w, d, h, rot, kind]
  const roofCols = ['#a8322a', '#2e5a8a', '#3a6a4a', '#5a3a2a', '#7a2a2a', '#2a4a6a', '#6a6a6a', '#b85a2a'];
  const wallCols = ['#d8d0c0', '#c8bca8', '#e6e0d4', '#a8a090', '#b8a890', '#8a8a86', '#c0c8cc', '#d0b8a0'];
  const occupied = [];
  const free = (x, z, rad) => !occupied.some(([ox, oz, or]) => Math.hypot(ox - x, oz - z) < or + rad);
  // Blender 模型（scripts/blender/hokkaido*.py）的摆放表
  const MODELS = `${import.meta.env.BASE_URL}vista-models/hokkaido/`;
  const placements = {};
  const place = (name, x, z, rot = 0, s = 1, y) => { (placements[name] ||= []).push([x, y ?? ground(x, z), z, rot, s]); };
  // 房子：rot 是正面朝向（0 = 朝 +z，也就是朝我们这边）
  const addHouse = (x, z, rot, big = false) => {
    const s = big ? 1 : 0.72 + r() * 0.2, rad = 6.6 * s;
    if (!free(x, z, rad)) return;
    occupied.push([x, z, rad]);
    const kind = big || r() < 0.22 ? 'house_flat' : ['house_red', 'house_blue', 'house_green'][(r() * 3) | 0];
    houses.push([x, z, 12 * s, 12 * s, 8 * s, rot, kind]);
    place(kind, x, z, rot, s);
  };
  // 主街两边、横街两边
  for (let z = -26; z > -270; z -= 10 + r() * 6) {
    if (Math.abs(z - RAIL_Z) < 22) continue;
    for (const side of [-1, 1]) { if (r() < 0.82) addHouse(MAIN_X + side * (13 + r() * 3), z, side < 0 ? Math.PI / 2 : -Math.PI / 2, z > -200 && r() < 0.2); } // 正面朝街
  }
  for (let x = -520; x < 520; x += 11 + r() * 6) { if (Math.abs(x - MAIN_X) < 14 || Math.abs(x) < 16) continue; if (r() < 0.8) addHouse(x, -27 - r() * 3, 0); if (r() < 0.5 && Math.abs(x) > 18) addHouse(x, 17 + r() * 6, Math.PI); }
  // 背街：一格格散着
  for (let i = 0; i < 1400; i++) {
    const x = (r() - 0.5) * 1300, z = 160 - r() * 440;
    if (Math.abs(x - MAIN_X) < 20 || Math.abs(z - RAIL_Z) < 26 || (Math.abs(x) < 24 && z > -40)) continue;
    const dens = 1 - smooth(260, 620, Math.hypot(x, (z + 60) * 1.4));
    if (r() > dens) continue;
    if (Math.abs((z + 14) % 70) < 6 || Math.abs((x - MAIN_X) % 90) < 5) continue; // 留出小街
    addHouse(x, z, (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.08, r() < 0.06);
  }
  // 雪原上散落的农家
  const farms = [[-900, -420], [-1250, -700], [-1700, -560], [-1050, -980], [-2100, -900]];
  for (const [fx, fz] of farms) { addHouse(fx, fz, r() * 6, false); addHouse(fx + 18, fz + 6, r() * 6, false); place('barn', fx - 26, fz - 16, r() * 6); }

  // ---------- 路：压实的雪路，两道车辙；路边推起来的雪堆 ----------
  const roadTex = canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#b8bec6'; g.fillRect(0, 0, w, h);
    const rr = rng(8);
    for (let i = 0; i < 3000; i++) { const v = 150 + rr() * 70 | 0; g.fillStyle = `rgba(${v},${v + 4},${v + 10},.35)`; g.fillRect(rr() * w, rr() * h, 2, 3 + rr() * 6); }
    for (const x of [30, 44, 84, 98]) { g.fillStyle = 'rgba(70,74,82,.55)'; g.fillRect(x, 0, 9, h); g.fillStyle = 'rgba(40,44,50,.25)'; g.fillRect(x + 2, 0, 4, h); }
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(240,244,248,.9)'); gr.addColorStop(0.12, 'rgba(240,244,248,0)'); gr.addColorStop(0.88, 'rgba(240,244,248,0)'); gr.addColorStop(1, 'rgba(240,244,248,.9)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 });
  const road = (x0, z0, x1, z1, w) => {
    const len = Math.hypot(x1 - x0, z1 - z0), seg = Math.max(2, Math.ceil(len / 25));
    const g = new THREE.PlaneGeometry(w, len, 1, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv, ang = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getZ(i) + len / 2; // 0..len
      const x = x0 + Math.sin(ang) * lz + Math.cos(ang) * lx, z = z0 + Math.cos(ang) * lz - Math.sin(ang) * lx;
      p.setXYZ(i, x, ground(x, z) + 0.06, z); uv.setY(i, lz / 40);
    }
    g.computeVertexNormals(); group.add(new THREE.Mesh(g, roadMat));
  };
  road(MAIN_X, -8, MAIN_X, -420, 9);
  road(-700, -16, 700, -16, 9);
  for (let z = -86; z > -280; z -= 70) road(-560, z, 560, z, 6);
  road(-650, -365, 900, -365 + 0.16 * 1550, 7); // 海边的路
  for (let x = MAIN_X - 450; x < 500; x += 90) if (Math.abs(x - MAIN_X) > 5) road(x, 140, x, -285, 6);
  road(-700, -380, -2300, -1100, 6); // 雪原里的农道
  // 雪堆
  {
    const lump = new THREE.IcosahedronGeometry(1, 1); lump.scale(1, 0.5, 1);
    const N = 900, im = new THREE.InstancedMesh(lump, new THREE.MeshStandardMaterial({ color: '#eef3f8', roughness: 0.95, flatShading: true }), N);
    let n = 0;
    const along = (fx, fz, len, step, axis) => { for (let s = 0; s < len && n < N; s += step) { const x = axis ? fx + s : fx, z = axis ? fz : fz - s; tmpM.compose(tmpP.set(x + (r() - 0.5), ground(x, z) + 0.2, z + (r() - 0.5)), tmpQ.setFromAxisAngle(up, r() * 6), tmpS.set(1.6 + r() * 2, 0.8 + r() * 0.9, 1.4 + r() * 1.5)); im.setMatrixAt(n++, tmpM); } };
    along(MAIN_X - 5.4, -10, 280, 3.2, false); along(MAIN_X + 5.4, -10, 280, 3.2, false);
    along(-700, -21.4, 1400, 3.2, true); along(-700, -10.6, 1400, 3.4, true);
    im.count = n; im.computeBoundingSphere(); group.add(im);
  }

  // ---------- 电线杆和电线 ----------
  const poles = [];  // [x, z, rot]
  const lineRun = (pts) => { for (let i = 0; i < pts.length; i++) { const [x, z] = pts[i], [nx, nz] = pts[Math.min(i + 1, pts.length - 1)], [px, pz] = pts[Math.max(i - 1, 0)]; poles.push([x, z, Math.atan2(nx - px, nz - pz) + Math.PI / 2, i]); } return pts; };
  const runs = [];
  { const a = []; for (let z = -22; z > -400; z -= 34) a.push([MAIN_X + 6.4, z]); runs.push(lineRun(a)); }
  { const a = []; for (let x = -680; x < 700; x += 34) a.push([x, -22.2]); runs.push(lineRun(a)); }
  { const a = []; for (let z = -92; z > -280; z -= 70) { const b = []; for (let x = -540; x < 560; x += 38) b.push([x, z - 3.6]); runs.push(lineRun(b)); } }
  { const a = []; for (let x = -700; x > -2300; x -= 45) a.push([x, -386 - (-700 - x) * 0.45 + 6]); runs.push(lineRun(a)); } // 农道边
  { const a = []; for (let x = -640; x < 900; x += 40) a.push([x, -372 + 0.16 * (x + 650)]); runs.push(lineRun(a)); } // 海边路
  {
    poles.forEach(([x, z, rot, i]) => { place(i % 2 === 0 && Math.hypot(x, z + 300) < 900 ? 'pole_lamp' : 'pole', x, z, rot); casters.push([x, z, 10, 0.5]); });
    // 电线：每两根杆之间三根，往下垂
    const segs = [];
    const wire = (ax, ay, az, bx, by, bz, sag) => { const n = 8; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; segs.push(lerp(ax, bx, t0), lerp(ay, by, t0) - sag * 4 * t0 * (1 - t0), lerp(az, bz, t0), lerp(ax, bx, t1), lerp(ay, by, t1) - sag * 4 * t1 * (1 - t1), lerp(az, bz, t1)); } };
    for (const run of runs) for (let i = 0; i < run.length - 1; i++) {
      const [x0, z0] = run[i], [x1, z1] = run[i + 1], y0 = ground(x0, z0), y1 = ground(x1, z1), ang = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (const [off, hh, sag] of [[-0.9, 9.4, 0.7], [0, 9.4, 0.7], [0.9, 9.4, 0.7], [0, 8.4, 0.9], [0, 6.2, 1.1]]) {
        const ox = Math.sin(ang) * off, oz = Math.cos(ang) * off;
        wire(x0 + ox, y0 + hh, z0 + oz, x1 + ox, y1 + hh, z1 + oz, sag);
      }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2a2c30' })));
  }

  // ---------- 树：防风林（一排排冷杉）、房前屋后零散的、身后山上的 ----------
  const trees = []; // [x, z, s, kind]
  const plant = (x, z, s, kind = 0) => { trees.push([x, z, s, kind]); if (Math.hypot(x, z + 250) > 760 && Math.hypot(x, z) < 1600) casters.push([x, z, s * 9, s * 2.4]); }; // 影子框以内的树有真影子，框外的用贴地假影子
  // 防风林：左边雪原上一排排横的、竖的
  for (const [z0, x0, x1] of [[-520, -2400, -760], [-760, -2600, -900], [-1000, -2800, -1100], [-640, -3000, -2500]]) for (let x = x0; x < x1; x += 4 + r() * 3) if (r() < 0.9 && z0 + (x - x0) * 0.02 > coastZ(x) + 30) plant(x, z0 + (r() - 0.5) * 6 + (x - x0) * 0.02, 1.4 + r() * 0.8);
  for (const [x0, z0, z1] of [[-800, -420, -1100], [-1500, -400, -1300], [-2200, -500, -1400]]) for (let z = z0; z > z1; z -= 5 + r() * 3) if (r() < 0.85 && z > coastZ(x0) + 30) plant(x0 + (r() - 0.5) * 5, z, 1.3 + r() * 0.8);
  for (let i = 0; i < 700; i++) { const x = (r() - 0.5) * 1300, z = 140 - r() * 420; if (Math.abs(x - MAIN_X) < 9 || (Math.abs(x) < 26 && z > -30) || !free(x, z, 2)) continue; if (r() < 0.5) plant(x, z, 0.7 + r() * 0.8, r() < 0.35 ? 1 : 0); }
  for (let i = 0; i < 2600; i++) { const x = (r() - 0.5) * 7000, z = 500 + r() * 2600; if (r() < 0.8) plant(x, z, 1.5 + r() * 2, r() < 0.2 ? 1 : 0); } // 山上
  for (let i = 0; i < 900; i++) { const x = -2600 - r() * 2400, z = -100 - r() * 1800; if (z > coastZ(x) + 60) plant(x, z, 1.4 + r() * 1.6); }
  for (const [x, z, s, kind] of trees) {
    const near = Math.hypot(x, z + 120) < 260;
    const name = kind === 0 ? 'todomatsu' : r() < 0.55 ? 'birch' : 'larch';
    place(near ? name : name + '_lo', x, z, r() * 6, s * 0.75 * (0.9 + r() * 0.25), ground(x, z) - 0.2);
  }

  // ---------- 铁路、道口、单厢柴油车 ----------
  const railM = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.9 });
  const RY = ground(MAIN_X, RAIL_Z);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(9000, 16, 6), new THREE.MeshStandardMaterial({ color: '#d8dee6', roughness: 0.95 })); bed.position.set(0, RY + 0.9 - 8, RAIL_Z); group.add(bed); // 路基：右边地势低，就是一道高堤
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(9000, 0.1, 3), railM); ballast.position.set(0, RY + 0.95, RAIL_Z); group.add(ballast);
  for (const dz of [-0.75, 0.75]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(9000, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: '#8a8c90', roughness: 0.35, metalness: 0.8 })); rl.position.set(0, RY + 1.05, RAIL_Z + dz); group.add(rl); }
  // 道口：两边各一根（模型里栏杆是单独的子物体 arm，可以抬起落下）；红灯用灯点交替闪
  const barriers = [], xLampPts = [];
  for (const [sx, sz, rot] of [[-6, 6, Math.PI], [6, -6, 0]]) {
    const px = MAIN_X + sx, pz = RAIL_Z + sz;
    loadModel(MODELS + 'crossing.glb').then((gl) => {
      gl.scene.traverse((o) => { if (o.isMesh) { o.material = bodyMat; o.castShadow = true; } });
      gl.scene.position.set(px, RY + 0.95, pz); gl.scene.rotation.y = rot; group.add(gl.scene);
      const arm = gl.scene.getObjectByName('arm'); if (arm) barriers.push(arm);
    }).catch(() => {});
    for (const k of [-0.3, 0.3]) xLampPts.push({ x: px + Math.cos(rot) * k, y: RY + 0.95 + 2.75, z: pz - Math.sin(rot) * k + Math.cos(rot) * 0.2 * (sz > 0 ? -1 : 1), c: [1, 0.12, 0.06], s: 0.35 });
  }
  const xLampsA = makeLights(xLampPts.filter((_, i) => i % 2 === 0), { fog: 0.00009, minPx: 1.5, maxPx: 5, gain: 1.6 });
  const xLampsB = makeLights(xLampPts.filter((_, i) => i % 2 === 1), { fog: 0.00009, minPx: 1.5, maxPx: 5, gain: 1.6 });
  group.add(xLampsA, xLampsB);
  // 无人小站和落了雪的贩卖机
  place('station', MAIN_X + 46, RAIL_Z + 7, 0, 1, RY + 0.4);
  place('vending_snow', MAIN_X + 36, RAIL_Z + 8, 0, 1, RY + 0.4);
  place('vending_snow', MAIN_X - 9, -40, Math.PI / 2);
  const train = new THREE.Group(); group.add(train);
  {
    const win = new THREE.MeshStandardMaterial({ color: '#202830', roughness: 0.3, emissive: '#ffe8b8', emissiveIntensity: 0 }); train.userData.win = win;
    loadModel(MODELS + 'train.glb').then((gl) => { gl.scene.traverse((o) => { if (o.isMesh) { o.material = /glow/.test(o.material.name) ? win : bodyMat; o.castShadow = true; } }); train.add(gl.scene); }).catch(() => {});
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,240,210'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    head.scale.setScalar(6); head.position.set(11, 1.6, 0); train.add(head); train.userData.head = head;
    train.position.set(0, RY + 1.1, RAIL_Z);
  }

  // ---------- 渔港：防波堤、红白灯塔、泊着的小渔船 ----------
  const harborLamps = [];
  {
    const conc = new THREE.MeshStandardMaterial({ color: '#b8bcc0', roughness: 0.9 });
    const snowTop = new THREE.MeshStandardMaterial({ color: '#eef3f8', roughness: 0.9 });
    const pier = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, 8, len), conc); b.position.set((x0 + x1) / 2, WATER - 1, (z0 + z1) / 2); b.rotation.y = ang; group.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.3, len), snowTop); t.position.set((x0 + x1) / 2, WATER + 3.1, (z0 + z1) / 2); t.rotation.y = ang; group.add(t);
      for (let k = 0.1; k < 1; k += 0.22) harborLamps.push([lerp(x0, x1, k), WATER + 9, lerp(z0, z1, k)]);
    };
    const cx = 200, cz = coastZ(cx);
    pier(cx, cz + 10, cx, cz - 150); pier(cx, cz - 150, cx + 230, cz - 150);
    pier(cx + 380, coastZ(cx + 380) + 10, cx + 380, cz - 90);
    place('lighthouse', cx + 230, cz - 150, 0, 1, WATER + 3.2); place('lighthouse', cx + 380, cz - 90, 0, 1, WATER + 3.2);
    harborLamps.push([cx + 230, WATER + 13.6, cz - 150, 'red'], [cx + 380, WATER + 13.6, cz - 90, 'green']);
    for (let i = 0; i < 11; i++) place('boat', cx + 20 + (i % 6) * 16 + r() * 4, cz - 40 - Math.floor(i / 6) * 40 - r() * 10, (r() - 0.5) * 0.4, 1, WATER - 0.6);
  }

  // ---------- 灯：路灯、窗外的灯、远处的村子、海上的渔火 ----------
  const lampPts = [], pools = [];
  const sodium = [1, 0.6, 0.28], ledW = [0.85, 0.9, 1];
  poles.forEach(([x, z, rot, i]) => { if (i % 2 === 0 && Math.hypot(x, z + 300) < 900) { const c = Math.abs(x - MAIN_X) < 10 ? sodium : (r() < 0.6 ? sodium : ledW); lampPts.push({ x: x + Math.sin(rot) * 1.12, y: ground(x, z) + 7.4, z: z + Math.cos(rot) * 1.12, c, s: 0.9 }); pools.push([x + Math.sin(rot) * 1.5, z + Math.cos(rot) * 1.5, c]); } });
  for (const [x, y, z, k] of harborLamps) lampPts.push({ x, y, z, c: k === 'red' ? [1, 0.15, 0.1] : k === 'green' ? [0.3, 1, 0.4] : ledW, s: k ? 1.4 : 1.1 });
  for (const [fx, fz] of farms) lampPts.push({ x: fx + 4, y: ground(fx, fz) + 4, z: fz + 5, c: sodium, s: 0.8 });
  // 远处的村子：海岸线上一串一串
  const far = [];
  for (const cx of [-3300, -4300, 2500]) { const cz = coastZ(cx) + 120; for (let i = 0; i < 70; i++) far.push({ x: cx + (r() - 0.5) * 600, y: ground(cx, cz) + 3, z: cz + (r() - 0.5) * 260, c: r() < 0.7 ? sodium : ledW, s: 1.4 }); }
  for (let x = -4400; x < -2400; x += 60) far.push({ x, y: ground(x, coastZ(x) + 200) + 4, z: coastZ(x) + 200 + Math.sin(x * 0.001) * 80, c: sodium, s: 1.2 }); // 海边公路
  const lamps = makeLights([...lampPts, ...far], { fog: 0.00009, minPx: 1, maxPx: 4, gain: 1 }); group.add(lamps);
  // 灯下的雪地上一圈暖光
  const poolTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
  const poolIm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolM, pools.length);
  pools.forEach(([x, z, c], i) => { tmpM.compose(tmpP.set(x, ground(x, z) + 0.12, z), tmpQ.identity(), tmpS.set(15, 1, 15)); poolIm.setMatrixAt(i, tmpM); poolIm.setColorAt(i, tmpC.setRGB(c[0], c[1], c[2])); });
  poolIm.userData.noShadow = true; poolIm.computeBoundingSphere(); group.add(poolIm);
  // 渔火：海平线上一排很亮的白绿灯
  const boats = [];
  for (let i = 0; i < 26; i++) { const x = -9000 + r() * 16000, z = -9000 - r() * 7000; boats.push({ x, y: WATER + 6, z, c: [0.85, 1, 0.9], s: 9, seed: r() }); }
  const fishing = makeLights(boats, { fog: 0.00004, minPx: 1.5, maxPx: 3, gain: 1.6, twinkle: 0.15 }); group.add(fishing);
  const trainHead = makeLights([{ x: 0, y: 0, z: 0, c: [1, 0.95, 0.8], s: 1.4 }], { fog: 0.00009, minPx: 2, maxPx: 6, gain: 1.4 }); train.add(trainHead); trainHead.position.set(10.9, 1.5, 0);

  // ---------- 长影子：贴在雪地上的半透明长条，太阳越低越长 ----------
  const shadowTex = canvasTex(8, 64, (g) => { const gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 64); }, { srgb: false });
  const shG = new THREE.PlaneGeometry(1, 1); shG.rotateX(-Math.PI / 2); shG.translate(0, 0, -0.5); // 从原点往 -z 伸出去
  const shM = new THREE.MeshBasicMaterial({ color: '#3a4c74', alphaMap: shadowTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, fog: true });
  casters.push([0, 6.4, 13, 22]); // 自己这栋楼
  const shadows = new THREE.InstancedMesh(shG, shM, casters.length); shadows.frustumCulled = false; shadows.userData.noShadow = true; group.add(shadows);
  let shadowAz = 999, shadowEl = 999;
  const placeShadows = (sunDir, elev) => {
    const len = 1 / Math.tan(Math.max(elev, 1.2) * Math.PI / 180), ang = Math.atan2(-sunDir.x, -sunDir.z);
    casters.forEach(([x, z, h, w], i) => { const L = Math.min(h * len, h * 40); tmpM.compose(tmpP.set(x, ground(x, z) + 0.1, z), tmpQ.setFromAxisAngle(up, ang + Math.PI), tmpS.set(w, 1, L)); shadows.setMatrixAt(i, tmpM); });
    shadows.instanceMatrix.needsUpdate = true;
  };

  // ---------- 小雪 ----------
  const FLAKES = 1800, fpos = new Float32Array(FLAKES * 3), fsp = [];
  for (let i = 0; i < FLAKES; i++) { fpos.set([(r() - 0.5) * 120, r() * 60 - 20, (r() - 0.5) * 120], i * 3); fsp.push(0.6 + r() * 0.8); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakeM = new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
  const flakes = new THREE.Points(fg, flakeM); flakes.frustumCulled = false; group.add(flakes);

  for (const m of ridges) m.userData.noShadow = true;
  group.traverse((o) => { if (!o.isMesh || o.userData.noShadow) return; o.receiveShadow = true; o.castShadow = !o.userData.recvOnly; });
  // 载入所有摆好的模型
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glowWin = new THREE.MeshStandardMaterial({ color: '#6c7480', roughness: 0.3, emissive: '#ffcf8a', emissiveIntensity: 0 });
  const glowLamp = new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffd8a0', emissiveIntensity: 0 });
  const glowVend = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.3, emissive: '#f4f8ff', emissiveIntensity: 0.4 });
  const loaded = instanceModels(group, MODELS, placements, {
    body: bodyMat, leaf: leafMat, isTree: (n) => /todomatsu|birch|larch/.test(n), castShadow: (n) => !/_lo$/.test(n),
    glow: (n) => (/vending/.test(n) ? glowVend : /pole_lamp|lighthouse/.test(n) ? glowLamp : glowWin),
  });
  const clouds = cloudLayer(group, { y: 1600, cover: 0.46, scale: 0.9, night: '#1c2640', nightK: 0.35, speed: 9 });
  // 钻石星尘：严寒的晴天里空气中闪闪发亮的冰晶，在身边慢慢飘
  const dust = [];
  for (let i = 0; i < 1800; i++) { const x = (r() - 0.5) * 110, y = -10 + r() * 12, z = (r() - 0.5) * 110, a = r() * 6.28; dust.push({ x, y, z, ex: x + Math.cos(a) * 40, ey: y - 6 - r() * 6, ez: z + Math.sin(a) * 40, v: 0.25 + r() * 0.4, seed: r(), c: [1, 0.97, 0.9], s: 0.06, day: [1, 1, 1] }); }
  const dustP = makeLights(dust, { fog: 0, moving: true, minPx: 1, maxPx: 2, gain: 1.6, twinkle: 0.97 }); group.add(dustP);
  // 美术配色：白天是刺眼的白雪和深蓝的天；日落时天边橙红、对面雪山上一道粉紫，雪地被映成粉色；蓝调时刻整片雪原泛蓝；夜里是深蓝色的雪国
  const art = makeArt([
    [40, { zen: '#1450c8', mid: '#4a8ee6', hor: '#e8f2fa', glow: '#ffffff', anti: '#d6e6f6', sun: '#fffaf2', sunK: 3.4, hemi: '#9cbcf0', ground: '#c8d4e4', hemiK: 0.95, fog: '#dce8f4', fogK: 1, cloudLit: '#ffffff', cloudShade: '#a8bcd8', cloudK: 0.85, deep: '#1a3a54', lit: 0, halo: 1.5 }],
    [12, { zen: '#1a4cc0', mid: '#5a92e0', hor: '#fff0dc', glow: '#ffd8a8', anti: '#c8d8f0', sun: '#ffe6c8', sunK: 3.3, hemi: '#a0b4ea', ground: '#d4ccd0', hemiK: 0.95, fog: '#f0e4d8', fogK: 1, cloudLit: '#fff2e0', cloudShade: '#a0aed0', cloudK: 0.85, deep: '#1a3a54', lit: 0.1, halo: 1.7 }],
    [3, { zen: '#2e4e9e', mid: '#8496d4', hor: '#ffcaa8', glow: '#ffa890', anti: '#f6b6d2', sun: '#ffb898', sunK: 5, hemi: '#b0a0e0', ground: '#f4d0dc', hemiK: 1.3, fog: '#eab8c8', fogK: 1.1, cloudLit: '#ffc0b8', cloudShade: '#9488c8', cloudK: 0.9, deep: '#2a3058', lit: 0.55, halo: 2 }],
    [-2, { zen: '#22408e', mid: '#6c78c6', hor: '#f4aac0', glow: '#ff9aa0', anti: '#c8a4dc', sun: '#ff9a90', sunK: 1.6, hemi: '#8a8ad8', ground: '#c0a8d0', hemiK: 1.1, fog: '#c08aa8', fogK: 1.1, cloudLit: '#f4a0c0', cloudShade: '#5a4c9a', cloudK: 0.9, deep: '#1e2450', lit: 0.85, halo: 1.6 }],
    [-6, { zen: '#0a2272', mid: '#2448b0', hor: '#8aa0e8', glow: '#d088a8', anti: '#5068c8', sun: '#000000', sunK: 0, hemi: '#5a7ae0', ground: '#4a64c0', hemiK: 1.4, fog: '#4a64b0', fogK: 1.2, cloudLit: '#b890c8', cloudShade: '#2a3a88', cloudK: 0.8, deep: '#101e48', lit: 1, halo: 0 }],
    [-14, { zen: '#030a2c', mid: '#0a1a54', hor: '#1e3478', glow: '#2a3a80', anti: '#1a2a6a', sun: '#000000', sunK: 0, hemi: '#3048a0', ground: '#2a3c80', hemiK: 1.4, fog: '#18285a', fogK: 1, cloudLit: '#3a4a88', cloudShade: '#101a40', cloudK: 0.5, deep: '#060c22', lit: 1, halo: 0 }],
    [-25, { zen: '#020620', mid: '#08143e', hor: '#16285e', glow: '#1e2e6a', anti: '#14225a', sun: '#000000', sunK: 0, hemi: '#24387c', ground: '#1e2e66', hemiK: 1.3, fog: '#122048', fogK: 1, cloudLit: '#2a3a70', cloudShade: '#0a1230', cloudK: 0.45, deep: '#040818', lit: 0.9, halo: 0 }],
  ]);
  const skyArt = artSky(group);
  const night = nightSky(group, { strength: 0.4, stars: 2600, meteorEvery: 10, lat: 43, seed: 1868 }); // 夜里挂一条淡淡的银河，偶尔有流星
  return {
    group, fog: 0.00006, art, loaded, shadow: { center: [0, G - 6, -250], size: 750, normalBias: 0.6 },
    dome: { top: '#020a26', horizon: '#1a2c5c' },
    update(dt, t, sky, atmo, sc) {
      const c = sky.state.c, n = c.night;
      const A = art.update(c.sunElev);
      skyArt.update(art, sky); night.update(dt, t, c, { dark: smooth(0.6, 0.95, c.night) });
      this.dirK = 1.6; this.envK = 0.8; // 月光照雪
      this.glow = { k: lerp(0.3, 0.6, smooth(0, 0.8, A.lit)), t: lerp(1.4, 0.25, smooth(0, 0.8, A.lit)) }; // 白天雪原泛光；夜里窗灯、路灯有一圈光晕
      glowWin.emissiveIntensity = A.lit * 2.2; glowLamp.emissiveIntensity = A.lit * 3; glowVend.emissiveIntensity = 0.4 + A.lit * 0.9; // 天一擦黑家家户户就亮灯
      const ln = smooth(0.1, 0.8, A.lit);
      // 雪面闪光、钻石星尘：白天跟着太阳，夜里跟着月亮淡淡地闪
      const sunUp = smooth(-1, 6, c.sunElev), moonUp = clamp((c.moonElev + 2) / 8, 0, 1) * n;
      glitU.uGlitDir.value.copy(sunUp > 0.05 ? sky.state.sunDir : sky.state.moonDir);
      glitU.uGlitCol.value.copy(sunUp > 0.05 ? A.sun : new THREE.Color('#b8c8ff')); glitU.uGlit.value = sunUp > 0.05 ? sunUp * 30 : moonUp * 6;
      dustP.material.uniforms.uOpacity.value = sunUp * 0.55 + moonUp * 0.2; dustP.material.uniforms.uTime.value = t;
      lamps.material.uniforms.uOpacity.value = ln; poolM.opacity = ln * 0.32;
      fishing.material.uniforms.uOpacity.value = smooth(0.3, 0.8, n); fishing.material.uniforms.uTime.value = t;
      for (const m of ridges) m.material.color.setScalar(1 - n * 0.7);
      updateWater(water, dt, sky, atmo, { art });
      clouds.update(dt, sky, atmo, art);
      // 影子
      const se = c.sunElev, op = clamp((se - 0.5) / 3, 0, 1) * clamp(1 - n * 2, 0, 1) * 0.8;
      shM.opacity = op * lerp(0.42, 0.6, c.dusk); shadows.visible = op > 0.01;
      if (shadows.visible && (Math.abs(c.sunAz - shadowAz) > 0.3 || Math.abs(se - shadowEl) > 0.15)) { shadowAz = c.sunAz; shadowEl = se; placeShadows(sky.state.sunDir, se); }
      // 列车：两趟对开，每趟大约 7 分钟一个来回
      const SPAN = 9000, V = 21, P = SPAN / V;
      const ph = (t + 40) % (P * 2), dir = ph < P ? 1 : -1, x = dir > 0 ? -SPAN / 2 + ph * V : SPAN / 2 - (ph - P) * V;
      train.position.x = x; train.rotation.y = dir > 0 ? 0 : Math.PI;
      train.userData.win.color.set('#1c242c').lerp(new THREE.Color('#ffe8b8'), ln * 0.9);
      train.userData.head.material.opacity = 0.25 + ln * 0.75; trainHead.material.uniforms.uOpacity.value = 0.5 + ln * 0.5;
      const near = Math.abs(x - MAIN_X) < 420;
      const on = near && Math.floor(t * 1.6) % 2 === 0;
      xLampsA.material.uniforms.uOpacity.value = near && on ? 1 : 0.06; xLampsB.material.uniforms.uOpacity.value = near && !on ? 1 : 0.06;
      for (const b of barriers) b.rotation.z = lerp(b.rotation.z, near ? 0 : -Math.PI * 0.47, Math.min(1, dt * 1.5)); // 栏杆朝 -x 伸出，绕铰链往上抬
      // 雪花跟着人
      const p = fg.attributes.position;
      for (let i = 0; i < FLAKES; i++) {
        let y = p.getY(i) - fsp[i] * dt * 1.2, xx = p.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.4;
        if (y < -20) y += 60;
        p.setXYZ(i, xx, y, p.getZ(i));
      }
      p.needsUpdate = true;
      flakeM.opacity = lerp(0.3, 0.45, n); // 白天晴空里的雪花别太显眼（像星星）
      flakeM.color.setScalar(lerp(1, 0.6, n));
    },
  };
}
