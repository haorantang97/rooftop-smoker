// 旷野星辰：高原荒漠里一间平房的屋顶（离地三米多）。四周是红土、鼠尾草丛、石头，一条土路歪歪扭扭伸向天边，
// 路边一排歪木桩；门前一架老风车水泵慢慢转。远处是一座座平顶山和孤峰（一层层红色岩层），天边一道长长的崖壁。
// 白天天很蓝；天黑以后银河横过头顶（有暗尘带，银心在右前方低空，随时间慢慢转），星星又多又密，偶尔有流星；
// 地平线上一点远方小镇的微光，很久才有一辆车的车灯在远处公路上划过。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, glowTex } from '../textures.js';
import { rng, fbm, smooth, clamp, lerp, makeLights, ridge, tint, GLSL, cloudLayer, makeArt, artSky, nightSky, instanceModels, loadModel } from './common.js';
import { dirFrom } from '../sky.js';
import { LOW as LOW_W } from './common.js';

const G = -3.6;              // 一层平房
const washZ = (x) => -420 + 130 * Math.sin(x * 0.0031) + 60 * Math.sin(x * 0.011);
function hgt(x, z) {
  const d = Math.hypot(x, z - 6);
  let y = G + (fbm(x * 0.0014 + 3, z * 0.0014, 5) - 0.5) * 18 * smooth(60, 900, d) + (fbm(x * 0.012, z * 0.012, 3) - 0.5) * 1.4 * smooth(12, 50, d);
  const w = washZ(x); y -= 2.6 * Math.exp(-(((z - w) / 16) ** 2)) * smooth(30, 120, d); // 干河床
  return y;
}
const roadX = (z) => 14 * Math.sin(-z * 0.004) + (z < -700 ? (z + 700) * 0.42 : 0) + (z < -1800 ? (z + 1800) * 0.3 : 0);

export function createWilds(scene) {
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const r = rng(77);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmpC = new THREE.Color();

  // ---------- 地面：近处细、远处粗两块 ----------
  const ochre = new THREE.Color('#b08660'), red = new THREE.Color('#9c5a3a'), pale = new THREE.Color('#c9b08a'), sand = new THREE.Color('#d2bc96'), dark = new THREE.Color('#6e5a46');
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: true });
  // 近处地面的细节：几米尺度的明暗斑驳和碎石点，远了自动淡掉（顶点颜色只有十几米一格）
  groundMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;\n' + GLSL.HASH)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 q = vGW.xz; float fw = length(fwidth(q));
          float n = vn21(q * .35) * .5 + vn21(q * 1.3) * .3 + vn21(q * 4.7) * .2;
          float pebble = step(.86, vh21(floor(q * 3.))) * (1. - smoothstep(.15, .6, fw));
          diffuseColor.rgb *= mix(1., .82 + .36 * n, 1. - smoothstep(.5, 3., fw)) * (1. - pebble * .25); }`);
  };
  groundMat.customProgramCacheKey = () => 'wildsground';
  const terrain = (W, seg, hole) => {
    const g = new THREE.PlaneGeometry(W, W, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let y = hgt(x, z); if (hole && Math.abs(x) < hole && Math.abs(z) < hole) y -= 6; // 远处那块在近处那块底下让开
      p.setY(i, y);
      const n = fbm(x * 0.004, z * 0.004, 4), n2 = fbm(x * 0.03 + 5, z * 0.03, 2);
      const c = ochre.clone().lerp(red, smooth(0.45, 0.7, n)).lerp(pale, smooth(0.55, 0.8, n2) * 0.5).lerp(dark, smooth(0.62, 0.8, fbm(x * 0.02, z * 0.02 + 9, 2)) * 0.35);
      const wz = washZ(x); c.lerp(sand, Math.exp(-(((z - wz) / 20) ** 2)) * 0.8);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const tm = new THREE.Mesh(g, groundMat); tm.userData.recvOnly = true; group.add(tm);
  };
  terrain(2400, 200, 0);
  terrain(40000, 260, 1150);

  // ---------- 平顶山、孤峰：一层层红色岩层 ----------
  const strata = ['#a85a3a', '#b46440', '#bf7048', '#a65638', '#c6805a', '#b0603c', '#ba7a54', '#c99a70'];
  const mesaMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  // 平顶山 / 孤峰：极坐标网格。轮廓有凹凸，崖壁上有竖向冲沟和两三道岩层台阶，底下一圈碎石坡，顶上微微起伏；
  // 颜色是一层层水平的岩层，崖面上挂着深色的「沙漠漆」竖条纹，冲沟里更暗
  const mesa = (cx, cz, rx, rz, h, seed, rot = 0) => {
    const NA = 150, NH = 46, base = G - 10, talusT = 0.33;
    const outline = [];
    for (let i = 0; i < NA; i++) { const a = (i / NA) * Math.PI * 2; outline.push(1 + Math.sin(a * 3 + seed) * 0.08 + (fbm(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + seed * 0.3, 5) - 0.5) * 0.5); }
    const ledges = [0.52 + (seed % 5) * 0.02, 0.74, 0.9];
    const prof = (t) => {
      if (t < talusT) return 1.02 + Math.pow(1 - t / talusT, 1.5) * 0.9;
      let k = 1; for (const L of ledges) k -= smooth(L - 0.012, L + 0.012, t) * 0.035; return k;
    };
    const pos = [], col = [], idx = [];
    const c = new THREE.Color(), varn = new THREE.Color('#3e2a22'), capC = new THREE.Color('#b89a72'), sage = new THREE.Color('#7a8062');
    for (let j = 0; j <= NH; j++) {
      const t = j / NH;
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const cliffK = t > talusT ? 1 : 0;
        const groove = 1 - Math.abs(2 * fbm(ca * 9 + seed, sa * 9 + t * 1.5, 3) - 1);       // 冲沟：脊状噪声
        const rad = outline[i] * prof(t) * (1 - groove * 0.06 * cliffK) * (1 + (fbm(ca * 4 + t * 3, sa * 4 + seed, 3) - 0.5) * 0.08 * (1 - cliffK));
        pos.push(ca * rx * rad, base + t * h, sa * rz * rad);
        if (!cliffK) c.set('#9a5a3c').lerp(new THREE.Color('#b8805a'), t / talusT * 0.7 + (fbm(a * 7, t * 9, 2) - 0.5) * 0.4);
        else {
          const band = Math.floor(t * 15 + (fbm(ca * 3, sa * 3 + seed, 2) - 0.5) * 0.9);
          c.set(strata[((band % strata.length) + strata.length) % strata.length]);
          const streak = smooth(0.55, 0.8, fbm(ca * 40 + seed, sa * 40, 2)) * smooth(talusT, 1, t);   // 沙漠漆
          c.lerp(varn, streak * 0.45 + groove * 0.18);
          if (t > 0.97) c.set('#c4a880');
        }
        col.push(c.r, c.g, c.b);
        if (j < NH) { const a0 = j * NA + i, a1 = j * NA + ((i + 1) % NA), b0 = a0 + NA, b1 = a1 + NA; idx.push(a0, b0, a1, a1, b0, b1); }
      }
    }
    // 顶面：一圈圈往中心收，微微起伏，零星的灌木颜色
    const top = NH * NA, rings = 4;
    for (let k = 1; k <= rings; k++) {
      const f = 1 - k / (rings + 0.6);
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rad = outline[i] * prof(1) * f;
        pos.push(ca * rx * rad, base + h + (fbm(ca * rad * 3 + seed, sa * rad * 3, 3) - 0.5) * h * 0.04 * (1 - f * 0.5), sa * rz * rad);
        c.copy(capC).lerp(sage, smooth(0.55, 0.7, fbm(ca * rad * 12, sa * rad * 12 + seed, 2)) * 0.5); col.push(c.r, c.g, c.b);
        const p0 = top + (k - 1) * NA + i, p1 = top + (k - 1) * NA + ((i + 1) % NA), q0 = p0 + NA, q1 = p1 + NA; idx.push(p0, p1, q0, p1, q1, q0);
      }
    }
    pos.push(0, base + h, 0); col.push(capC.r, capC.g, capC.b);
    const center = pos.length / 3 - 1, last = top + (rings - 1) * NA;
    for (let i = 0; i < NA; i++) idx.push(last + i, last + ((i + 1) % NA), center);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const geo = g.toNonIndexed(); geo.computeVertexNormals();
    const me = new THREE.Mesh(geo, mesaMat); me.position.set(cx, 0, cz); me.rotation.y = rot; me.userData.noShadow = true; group.add(me);
    return me;
  };
  mesa(-1900, -3700, 620, 340, 520, 3, 0.3);
  mesa(1250, -2900, 120, 100, 400, 5);
  mesa(1560, -3080, 90, 80, 330, 7);
  mesa(4300, -5400, 1700, 520, 430, 11, -0.2);
  mesa(300, -9800, 2600, 700, 620, 13, 0.1);
  mesa(-7600, -2600, 1300, 900, 360, 17, 0.6);
  mesa(-4600, 3800, 1500, 500, 270, 19, -0.4);
  mesa(4000, 4400, 900, 520, 330, 23, 0.8);
  mesa(-1200, -8200, 260, 200, 340, 29);
  const farRidge = ridge(group, { z: -19000, x: 0, y: G - 30, width: 46000, depth: 3000, height: 950, seed: 41, low: '#8a6a5a', mid: '#9a7a6a', high: '#aa8a7a', snow: 2, fog: false, segX: 260, segZ: 20, sharp: 0.8 });
  const farRidge2 = ridge(group, { z: 17000, x: 0, y: G - 30, width: 46000, depth: 3000, height: 700, seed: 43, low: '#8a6a5a', mid: '#9a7a6a', high: '#aa8a7a', snow: 2, fog: false, segX: 200, segZ: 20, sharp: 0.8 });

  // ---------- 草丛、刺柏、丝兰、仙人掌、石头：Blender 模型（scripts/blender/wilds*.py），近处细节版、远了低面数版 ----------
  const MODELS = `${import.meta.env.BASE_URL}vista-models/wilds/`;
  const placements = {};
  const place = (name, x, z, rot = 0, s = 1, y) => { (placements[name] ||= []).push([x, y ?? hgt(x, z) - 0.05, z, rot, s]); };
  const scatter = (name, n, dMin, dMax, pw, sMin, sMax, heroR) => {
    for (let i = 0; i < n; i++) {
      const d = dMin + Math.pow(r(), pw) * (dMax - dMin), a = r() * Math.PI * 2, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x - roadX(z)) < 4 && z < 0) continue;                       // 别长在土路上
      place(d < heroR ? name : name + '_lo', x, z, r() * 6, sMin + r() * (sMax - sMin));
    }
  };
  scatter('sage', LOW_W ? 1800 : 4200, 14, 1500, 1.7, 0.5, 1.1, 70);
  scatter('juniper', 220, 30, 2200, 1.3, 0.7, 1.4, 260); scatter('juniper_b', 200, 30, 2200, 1.3, 0.7, 1.4, 260);
  scatter('yucca', 260, 18, 900, 1.5, 0.7, 1.2, 90); scatter('cholla', 220, 18, 900, 1.5, 0.6, 1.2, 90);
  for (let i = 0; i < 700; i++) {
    const d = 22 + Math.pow(r(), 1.5) * 1500, a = r() * Math.PI * 2, x = Math.cos(a) * d, z = Math.sin(a) * d, s = (0.25 + Math.pow(r(), 3) * 1.3) * (d < 60 ? 0.5 : 1);
    place(['boulder_a', 'boulder_b', 'boulder_c'][(r() * 3) | 0], x, z, r() * 6, s, hgt(x, z) - s * 0.25);
  }

  // ---------- 土路和路边的木桩 ----------
  {
    const tex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#bba07a'; g.fillRect(0, 0, w, h); const rr = rng(2);
      for (let i = 0; i < 1500; i++) { const v = 150 + rr() * 60 | 0; g.fillStyle = `rgba(${v},${v - 20},${v - 50},.4)`; g.fillRect(rr() * w, rr() * h, 1 + rr() * 2, 1 + rr() * 3); }
      for (const x of [14, 46]) { g.fillStyle = 'rgba(120,92,64,.55)'; g.fillRect(x, 0, 6, h); }
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(176,134,96,1)'); gr.addColorStop(0.15, 'rgba(176,134,96,0)'); gr.addColorStop(0.85, 'rgba(176,134,96,0)'); gr.addColorStop(1, 'rgba(176,134,96,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    tex.wrapT = THREE.RepeatWrapping;
    const n = 400, pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const z = -6 - (i / n) * 5200, x = roadX(z), z2 = z - 5, x2 = roadX(z2), ang = Math.atan2(x2 - x, z2 - z), w = 2.2;
      for (const s of [-1, 1]) { const px = x + Math.cos(ang) * w * s, pz = z - Math.sin(ang) * w * s; pos.push(px, hgt(px, pz) + 0.05, pz); uv.push(s < 0 ? 0 : 1, -z / 20); }
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })));
    // 路边的围栏：模型一段 12 米，沿着土路的方向一段段接起来（偶尔断一段）
    for (let z = -16; z > -900; z -= 11.8) {
      const x = roadX(z) + 4.2, z2 = z - 11.8, x2 = roadX(z2) + 4.2;
      if (r() < 0.06) continue;
      place('fence', (x + x2) / 2, (z + z2) / 2, Math.atan2(-(z2 - z), x2 - x) + Math.PI, 1, hgt((x + x2) / 2, (z + z2) / 2) - 0.05);
    }
    place('mailbox', roadX(-14) - 3.2, -14, Math.PI / 2);
  }

  // ---------- 风车水泵 ----------
  let wheel = null;
  {
    const wx = 24, wz = -64, wy = hgt(wx, wz);
    loadModel(MODELS + 'windmill.glb').then((gl) => {
      gl.scene.traverse((o) => { if (o.isMesh) { o.material = bodyMat; o.castShadow = true; o.receiveShadow = true; } });
      gl.scene.position.set(wx, wy - 0.05, wz); gl.scene.rotation.y = Math.atan2(-wx, -wz) + 0.35; group.add(gl.scene);   // 叶轮大致朝着我们，带一点侧角
      wheel = gl.scene.getObjectByName('wheel');
    }).catch(() => {});
    place('trough', wx + 5, wz + 2, 0.4);
    place('pickup', roadX(-150) - 7, -150, 2.2);
    place('shed', -38, -52, 0.6);
  }

  // ---------- 夜空（common.js 的 nightSky）、远方小镇的微光 ----------
  const night = nightSky(group, { strength: 1, stars: 4200, meteorEvery: 5, seed: 77 });
  // 远方小镇：地平线上一团暖光，几粒灯
  const town = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,170,100'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
  const td = dirFrom(0.4, -48).multiplyScalar(26000); town.position.copy(td); town.scale.set(9000, 2600, 1); group.add(town);
  const townLights = []; for (let i = 0; i < 40; i++) { const a = (-48 + (r() - 0.5) * 3) * Math.PI / 180, d = 14000 + r() * 3000; townLights.push({ x: Math.sin(a) * d, y: G + 6, z: -Math.cos(a) * d, c: r() < 0.7 ? [1, 0.65, 0.35] : [0.9, 0.92, 1], s: 6 }); }
  const tl = makeLights(townLights, { fog: 0.00002, minPx: 1, maxPx: 2, gain: 0.7 }); group.add(tl);
  // 远处公路上偶尔一辆车
  const cars = [];
  for (let i = 0; i < 3; i++) { const seed = i / 3 + r() * 0.1; for (const off of [0, 1.7]) cars.push({ x: -9000, y: hgt(0, -5200) + 1, z: -5200 + off, ex: 9000, ey: hgt(0, -5200) + 1, ez: -5200 + off, v: 26, seed, c: [1, 0.92, 0.75], s: 1.2, day: [0, 0, 0] }); }
  const carP = makeLights(cars, { fog: 0.00004, moving: true, minPx: 1, maxPx: 2, gain: 1.2 }); group.add(carP);

  farRidge.userData.noShadow = farRidge2.userData.noShadow = true;
  group.traverse((o) => { if (!o.isMesh || o.userData.noShadow) return; o.receiveShadow = true; o.castShadow = !o.userData.recvOnly; });
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const loaded = instanceModels(group, MODELS, placements, { body: bodyMat, leaf: leafMat, glow: () => bodyMat, isTree: (n) => /sage|juniper|yucca|cholla/.test(n), castShadow: (n) => !/_lo$|sage/.test(n) });
  const clouds = cloudLayer(group, { y: 3200, cover: 0.42, scale: 1.6, night: '#0c101a', nightK: 0.12, speed: 5 }); // 高原上零散的积云，日落时烧红
  // 美术配色：高原的深蓝天；日落是橙到深蓝的大渐变，云底烧红，红岩被照得发光；夜里几乎全黑，留给银河
  const art = makeArt([
    [40, { zen: '#1240b8', mid: '#3c80de', hor: '#d4e2ee', glow: '#fff0d8', anti: '#c4d8ee', sun: '#fff2dc', sunK: 3.0, hemi: '#a8c4ee', ground: '#a07a5a', hemiK: 0.9, fog: '#c8d8e8', fogK: 1, cloudLit: '#ffffff', cloudShade: '#a4b6d0', cloudK: 0.9, halo: 1 }],
    [12, { zen: '#1a44b4', mid: '#4a86dc', hor: '#ffd8a8', glow: '#ffb060', anti: '#b0c6e6', sun: '#ffc888', sunK: 3.0, hemi: '#a8b8e0', ground: '#b07a50', hemiK: 0.85, fog: '#f0d0b0', fogK: 1, cloudLit: '#ffe0b8', cloudShade: '#9aa0c8', cloudK: 0.9, halo: 1.3 }],
    [3, { zen: '#134a7e', mid: '#3a7ca4', hor: '#ffb440', glow: '#ff6418', anti: '#e8906a', sun: '#ff7a2a', sunK: 3.0, hemi: '#9478b8', ground: '#a85a3a', hemiK: 0.9, fog: '#f08a5a', fogK: 1.2, cloudLit: '#ff7038', cloudShade: '#5e3a7e', cloudK: 0.95, halo: 2 }],
    [-2, { zen: '#0c2c5c', mid: '#24608a', hor: '#ff5a24', glow: '#e8341a', anti: '#8a5a70', sun: '#ff5020', sunK: 0.7, hemi: '#5e5296', ground: '#6a3a30', hemiK: 0.8, fog: '#b05a5a', fogK: 1.2, cloudLit: '#ff5a3a', cloudShade: '#3a2860', cloudK: 0.95, halo: 1.6 }],
    [-6, { zen: '#061a3c', mid: '#103a5e', hor: '#b0302e', glow: '#c83020', anti: '#2a3058', sun: '#000000', sunK: 0, hemi: '#2a3070', ground: '#3a2a2a', hemiK: 0.7, fog: '#3a3060', fogK: 1, cloudLit: '#c04a40', cloudShade: '#1c1a40', cloudK: 0.8, halo: 0 }],
    [-13, { zen: '#020616', mid: '#06103a', hor: '#1a1e48', glow: '#2a2240', anti: '#121838', sun: '#000000', sunK: 0, hemi: '#141c40', ground: '#1a1614', hemiK: 0.8, fog: '#0c1228', fogK: 1, cloudLit: '#1a1e38', cloudShade: '#06081a', cloudK: 0.25, halo: 0 }],
    [-25, { zen: '#01020a', mid: '#030820', hor: '#0e1430', glow: '#0e1430', anti: '#0a1028', sun: '#000000', sunK: 0, hemi: '#10183a', ground: '#141210', hemiK: 0.85, fog: '#080c1c', fogK: 1, cloudLit: '#10142a', cloudShade: '#04060e', cloudK: 0.15, halo: 0 }],
  ]);
  const skyArt = artSky(group);
  return {
    group, fog: 0.00004, loaded, art, shadow: { center: [0, G, -150], size: 450, normalBias: 0.3 },
    dome: { top: '#01020a', horizon: '#161e3a' },
    update(dt, t, sky, atmo, sc2) {
      const c = sky.state.c, n = c.night;
      art.update(c.sunElev); skyArt.update(art, sky);
      this.dirK = 1; this.envK = 0.9;
      this.glow = { k: lerp(0.5, 0.3, n), t: lerp(0.45, 0.9, n) }; // 夕阳带一点光晕；夜里只让最亮的银心微微晕开
      const moon = clamp((c.moonElev + 2) / 10, 0, 1) * n;
      const dark = smooth(0.55, 0.95, n) * (1 - moon * 0.25); // 游戏里的月亮每晚都在，只让它稍微压一点
      night.update(dt, t, c, { dark });
      sky.stars.material.uniforms.uOpacity.value *= 0.5; // 自带的随机星星减半，主要看 nightSky 的
      sky.moon.material.opacity *= 0.7; // 月亮的大光晕在 index.js 里统一压掉了
      town.material.opacity = smooth(0.3, 0.9, n) * 0.22; tl.material.uniforms.uOpacity.value = smooth(0.3, 0.9, n);
      carP.material.uniforms.uTime.value = t; carP.material.uniforms.uOpacity.value = smooth(0.4, 0.9, n);
      farRidge.material.color.setScalar(1 - n * 0.85); farRidge2.material.color.setScalar(1 - n * 0.85);
      clouds.update(dt, sky, atmo, art);
      if (wheel) wheel.rotation.z -= dt * (1.2 + Math.sin(t * 0.13) * 0.6);
    },
  };
}
