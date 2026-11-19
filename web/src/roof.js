// 天台：豪华公寓的屋顶。中间一块草坪，四周木地板和石板路；靠海一边是矮墙加无框玻璃栏杆（不挡风景），
// 左边躺椅和遮阳伞，右边 L 形沙发和凉棚，后面是电梯小屋（门通楼下小卖部），串灯从凉棚拉到草坪上空
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pbr, canvasTex, rng, glowTex } from './textures.js';

export const EDGE_Z = -1.6;          // 前面（朝海）栏杆的位置
const X0 = -11, X1 = 11, Z1 = 14.4;  // 天台范围：x -11..11，z EDGE_Z..14.4
const W = X1 - X0, D = Z1 - EDGE_Z, CX = 0, CZ = (EDGE_Z + Z1) / 2;

function sandTexture() {
  const r = rng(3);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#cbbd96'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { const v = 150 + r() * 80 | 0; g.fillStyle = `rgba(${v},${v - 12},${v - 40},.6)`; g.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(60,55,50,${0.15 + r() * 0.25})`; g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 10, 0, Math.PI * 2); g.fill(); }
  });
}
// 木地板：一条条长木板，颜色深浅不一
const deckTex = () => canvasTex(512, 512, (g) => {
  const r = rng(11); const pw = 512 / 8;
  for (let i = 0; i < 8; i++) {
    let y = -r() * 300;
    while (y < 512) { const len = 180 + r() * 260, v = 0.85 + r() * 0.3; g.fillStyle = `rgb(${150 * v | 0},${104 * v | 0},${70 * v | 0})`; g.fillRect(i * pw + 1, y, pw - 2, len - 2); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(70,40,20,${0.08 + r() * 0.1})`; g.fillRect(i * pw + 3 + r() * (pw - 6), y + r() * len, 1, 10 + r() * 30); } y += len; }
  }
}, { repeat: [16, 11] }); // 一块板约 17 厘米宽
// 草坪
const grassTex = () => canvasTex(256, 256, (g) => {
  const r = rng(5); g.fillStyle = '#4f8a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(40,${100 + r() * 40 | 0},30,.6)` : `rgba(${110 + r() * 40 | 0},${160 + r() * 40 | 0},70,.5)`; g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3); }
}, { repeat: [6, 4] });
// 石板路
const stoneTex = () => canvasTex(256, 256, (g) => {
  const r = rng(9); g.fillStyle = '#8e8a82'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 128) { const v = 175 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 3 + ((y / 64) % 2) * 64, y + 3, 122, 58); }
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
}, { repeat: [1, 6] });

export function createRoof(scene) {
  const group = new THREE.Group(); scene.add(group);
  const wallMat = pbr('wall', [6, 0.3]);
  const facadeMat = pbr('wall', [8, 9]);
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#2e3036', roughness: 0.4, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.25, metalness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.75 });
  const teak = new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.6 });
  const cushion = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.95 });
  const cushion2 = new THREE.MeshStandardMaterial({ color: '#3f5a6a', roughness: 0.95 });
  const hedgeM = new THREE.MeshStandardMaterial({ color: '#3d6b2e', roughness: 1 });
  const planterM = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.55, metalness: 0.2 });
  const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const add = (g, mat, x, y, z, parent = group) => { const me = shade(new THREE.Mesh(g, mat)); me.position.set(x, y, z); parent.add(me); return me; };
  const obstacles = [];
  const block = (x0, x1, z0, z1) => obstacles.push({ x0, x1, z0, z1 });

  // ---------- 地面：木地板一圈，石板路，中间草坪 ----------
  const floor = add(new THREE.PlaneGeometry(W, D), wood, CX, 0, CZ); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const lawn = add(new THREE.BoxGeometry(10, 0.06, 7), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }), 0, 0.03, 6.2); lawn.castShadow = false;
  for (const [x, z, w, d] of [[0, 2.65, 10.3, 0.15], [0, 9.75, 10.3, 0.15], [-5.08, 6.2, 0.15, 7.2], [5.08, 6.2, 0.15, 7.2]]) add(new THREE.BoxGeometry(w, 0.08, d), new THREE.MeshStandardMaterial({ color: '#b9b2a4', roughness: 0.7 }), x, 0.04, z);
  const path = add(new THREE.PlaneGeometry(1.6, 12), new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.8 }), 7.4, 0.005, 6.4); path.rotation.x = -Math.PI / 2; path.castShadow = false;
  add(new THREE.BoxGeometry(W, 30, D), facadeMat, CX, -15.02, CZ);   // 楼体

  // ---------- 边上：45 厘米矮墙 + 无框玻璃栏杆 ----------
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.3, metalness: 0, envMapIntensity: 0.15, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }); // 清玻璃：几乎不反光，不挡风景
  const edge = (x, z, len, alongX) => {
    const [w, d] = alongX ? [len, 0.3] : [0.3, len];
    add(new THREE.BoxGeometry(w, 0.45, d), wallMat, x, 0.225, z);
    add(new THREE.BoxGeometry(alongX ? len : 0.36, 0.05, alongX ? 0.36 : len), new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.6 }), x, 0.475, z);
    const g = add(new THREE.BoxGeometry(alongX ? len : 0.02, 0.65, alongX ? 0.02 : len), glass, x, 0.83, z); g.castShadow = false; g.renderOrder = 5;
    const rail = add(new THREE.BoxGeometry(alongX ? len : 0.05, 0.035, alongX ? 0.05 : len), steel, x, 1.16, z); rail.castShadow = false;
  };
  edge(CX, EDGE_Z - 0.15, W, true);
  edge(X0 - 0.15, CZ, D, false); edge(X1 + 0.15, CZ, D, false);
  add(new THREE.BoxGeometry(W + 0.6, 1.1, 0.3), wallMat, CX, 0.55, Z1 + 0.15);   // 后墙高一点

  // ---------- 后面：电梯小屋，门通楼下 ----------
  const hutX = 6.2, hutZ = 12.6;
  add(new THREE.BoxGeometry(4.2, 3.0, 3.4), new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.7 }), hutX, 1.5, hutZ);
  add(new THREE.BoxGeometry(4.6, 0.14, 3.8), darkMetal, hutX, 3.07, hutZ);
  const doorZ = hutZ - 1.72;
  const door = add(new THREE.BoxGeometry(1.4, 2.3, 0.05), new THREE.MeshPhysicalMaterial({ color: '#9ab8c4', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 }), hutX, 1.15, doorZ);
  door.userData.pick = { kind: 'door', to: 'shop', label: '下楼去小卖部' };
  add(new THREE.BoxGeometry(1.55, 0.06, 0.08), steel, hutX, 2.33, doorZ); for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 2.36, 0.08), steel, hutX + sx * 0.75, 1.17, doorZ);
  const doorSign = add(new THREE.PlaneGeometry(1.1, 0.2), new THREE.MeshStandardMaterial({ map: canvasTex(512, 96, (g) => { g.fillStyle = '#1d8a66'; g.fillRect(0, 0, 512, 96); }), emissive: '#ffffff', emissiveIntensity: 0.4 }), hutX, 2.6, doorZ - 0.03); doorSign.rotation.y = Math.PI; doorSign.castShadow = false;
  doorSign.material.emissiveMap = doorSign.material.map;
  const doorLamp = add(new THREE.BoxGeometry(0.5, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 2 }), hutX, 2.85, doorZ - 0.06);
  const doorLight = new THREE.PointLight('#ffcf8a', 0, 8, 2); doorLight.position.set(hutX, 2.7, doorZ - 0.5); group.add(doorLight);
  block(hutX - 2.15, hutX + 2.15, hutZ - 1.75, hutZ + 1.75);

  // ---------- 左前：两张躺椅 + 遮阳伞 ----------
  const lounger = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    add(new THREE.BoxGeometry(0.7, 0.08, 1.4), teak, 0, 0.3, 0.2, g);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.05, 0.28, 0.05), teak, sx * 0.3, 0.14, 0.2 + sz * 0.62, g);
    add(new RoundedBoxGeometry(0.66, 0.08, 1.3, 2, 0.03), cushion, 0, 0.38, 0.22, g);
    const back = add(new RoundedBoxGeometry(0.66, 0.08, 0.7, 2, 0.03), cushion, 0, 0.69, -0.66, g); back.rotation.x = 0.9; // 靠背：靠近坐垫那头低、外头（头那头）高
  };
  lounger(-7.6, 0.6, Math.PI); lounger(-6.4, 0.6, Math.PI);
  block(-8.05, -5.95, -0.35, 1.6);
  add(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 10), steel, -7.0, 1.25, 1.9);
  const canopy = add(new THREE.ConeGeometry(1.7, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#efe8da', roughness: 0.9, side: THREE.DoubleSide }), -7.0, 2.45, 1.9); canopy.receiveShadow = false;
  add(new THREE.CylinderGeometry(0.25, 0.3, 0.08, 16), darkMetal, -7.0, 0.04, 1.9);
  obstacles.push({ x: -7.0, z: 1.9, r: 0.25 });

  // ---------- 右前：凉棚下面一组 L 形沙发和茶几 ----------
  const sx0 = 4.2, sz0 = 0.2;
  const sofa = (x, z, w, d, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g); add(new RoundedBoxGeometry(w, 0.4, d, 2, 0.05), cushion2, 0, 0.2, 0, g); add(new RoundedBoxGeometry(w, 0.45, 0.22, 2, 0.06), cushion2, 0, 0.55, d / 2 - 0.11, g); for (let i = 0; i < Math.round(w / 0.8); i++) add(new RoundedBoxGeometry(0.7, 0.14, d - 0.3, 2, 0.05), cushion, -w / 2 + 0.4 + i * 0.8, 0.46, -0.1, g); };
  sofa(sx0 + 1.6, sz0 + 2.2, 3.2, 0.9, 0); sofa(sx0 - 0.25, sz0 + 1.1, 2.4, 0.9, -Math.PI / 2); // 长沙发面朝大海，侧边的面朝茶几
  add(new RoundedBoxGeometry(1.4, 0.06, 0.8, 2, 0.02), teak, sx0 + 1.6, 0.4, sz0 + 1.0); add(new THREE.BoxGeometry(1.2, 0.36, 0.6), darkMetal, sx0 + 1.6, 0.18, sz0 + 1.0);
  block(sx0 - 0.75, sx0 + 3.25, sz0 + 1.7, sz0 + 2.7); block(sx0 - 0.75, sx0 + 0.25, sz0 - 0.1, sz0 + 2.7); block(sx0 + 0.85, sx0 + 2.35, sz0 + 0.55, sz0 + 1.7); block(sx0 + 0.25, sx0 + 0.85, sz0 + 0.55, sz0 + 1.7); // 茶几连同它和沙发之间那条缝、侧沙发旁边的小角落一起挡住（缝只比人宽一点，钻进去就出不来）
  // 凉棚：四根柱子 + 一排木条
  for (const [x, z] of [[sx0 - 1, sz0 - 0.4], [sx0 + 3.5, sz0 - 0.4], [sx0 - 1, sz0 + 3], [sx0 + 3.5, sz0 + 3]]) { add(new THREE.BoxGeometry(0.14, 2.8, 0.14), teak, x, 1.4, z); obstacles.push({ x, z, r: 0.12 }); }
  for (const z of [sz0 - 0.4, sz0 + 3]) add(new THREE.BoxGeometry(4.7, 0.16, 0.12), teak, sx0 + 1.25, 2.86, z);
  for (let x = sx0 - 0.9; x <= sx0 + 3.45; x += 0.42) add(new THREE.BoxGeometry(0.06, 0.12, 3.6), teak, x, 2.98, sz0 + 1.3);

  // ---------- 烟灰桶（点它五下有彩蛋），放在栏杆边、沙发和躺椅中间 ----------
  const ashtray = new THREE.Group(); ashtray.position.set(1.2, 0, -0.95); group.add(ashtray);
  const binMat = new THREE.MeshStandardMaterial({ color: '#8a8e96', roughness: 0.35, metalness: 0.9 });
  const bin = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.78, 32), binMat)); bin.position.y = 0.39; ashtray.add(bin);
  const dish = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.05, 32), darkMetal)); dish.position.y = 0.8; ashtray.add(dish);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(0.185, 32), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = 0.826; ashtray.add(sand);
  const butt = new THREE.CylinderGeometry(0.0039, 0.0039, 0.03, 8), buttF = new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8);
  const paperM = new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.8 }), corkM = new THREE.MeshStandardMaterial({ color: '#c98a42', roughness: 0.8 });
  const r = rng(7);
  for (let i = 0; i < 11; i++) {
    const b = new THREE.Group(); const a = new THREE.Mesh(butt, paperM); a.position.y = 0.025; const f = new THREE.Mesh(buttF, corkM); b.add(a, f);
    b.position.set((r() - 0.5) * 0.26, 0.832, (r() - 0.5) * 0.26); b.rotation.set(Math.PI / 2 - 0.2 + r() * 0.4, 0, r() * Math.PI * 2); ashtray.add(b);
  }
  ashtray.rotation.y = Math.PI;
  obstacles.push({ x: 1.2, z: -0.95, r: 0.28 });

  // ---------- 绿篱和大花盆 ----------
  for (const [x, z, w, d] of [[-8.6, 6.2, 0.6, 6], [8.6, 3.2, 0.6, 3.4], [-2.8, 11.6, 5, 0.6]]) { add(new RoundedBoxGeometry(w, 0.75, d, 3, 0.15), hedgeM, x, 0.375, z); block(x - w / 2, x + w / 2, z - d / 2, z + d / 2); }
  const gl = new GLTFLoader();
  const plant = (id, x, z, s, ry) => {
    add(new THREE.BoxGeometry(0.7, 0.6, 0.7), planterM, x, 0.3, z); obstacles.push({ x, z, r: 0.45 });
    gl.load(`${import.meta.env.BASE_URL}assets/models/${id}/${id}.gltf`, (g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); g.scene.position.set(x, 0.45, z); g.scene.scale.setScalar(s); g.scene.rotation.y = ry; group.add(g.scene); });
  };
  plant('potted_plant_04', -10.2, -0.9, 1.7, 0.4); plant('potted_plant_02', 10.2, -0.9, 1.5, 1.2); plant('potted_plant_04', -10.2, 13.6, 1.8, 2.0);
  plant('potted_plant_02', -1.6, -0.9, 1.2, 0.6); plant('potted_plant_04', 3.0, 13.6, 1.6, 1.0);

  // ---------- 串灯：从凉棚拉到草坪上空，四角有灯杆 ----------
  const bulbs = [], lights = [];
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#2a2218', emissive: '#ffb860', emissiveIntensity: 0, roughness: 0.6 }); // 底色暗：旁边照地面的点光源不会把灯泡照成雪亮的一团
  const wireMat = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.8 });
  const glowM = new THREE.SpriteMaterial({ map: glowTex('255,190,110'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const strand = (a, b, sag, count) => {
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.004, 5), wireMat));
    for (let i = 1; i < count; i++) {
      const p = curve.getPoint(i / count);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), bulbMat); bulb.position.copy(p).add(new THREE.Vector3(0, -0.06, 0)); bulb.scale.y = 1.3; group.add(bulb);
      const gs = new THREE.Sprite(glowM); gs.position.copy(bulb.position); gs.scale.setScalar(0.36); group.add(gs);
      bulbs.push(bulb);
    }
    for (const k of [0.25, 0.75]) { const L = new THREE.PointLight('#ffb870', 0, 8, 2); L.position.copy(curve.getPoint(k)).add(new THREE.Vector3(0, -0.15, 0)); group.add(L); lights.push(L); }
  };
  const poles = [[-5.2, 2.4], [5.2, 2.4], [-5.2, 10.0], [5.2, 10.0]];
  // 灯杆加高到 4.4 米、线垂得浅一点：串灯挂在头顶高处，不在眼前晃
  const PH = 4.4, SY = PH - 0.05;
  for (const [x, z] of poles) { add(new THREE.CylinderGeometry(0.035, 0.045, PH, 10), darkMetal, x, PH / 2, z); obstacles.push({ x, z, r: 0.1 }); }
  strand(new THREE.Vector3(-5.2, SY, 2.4), new THREE.Vector3(5.2, SY, 2.4), 0.45, 22);
  strand(new THREE.Vector3(-5.2, SY, 10), new THREE.Vector3(5.2, SY, 10), 0.45, 22);
  strand(new THREE.Vector3(-5.2, SY, 2.4), new THREE.Vector3(5.2, SY, 10), 0.6, 26);
  strand(new THREE.Vector3(5.2, SY, 2.4), new THREE.Vector3(-5.2, SY, 10), 0.6, 26);
  strand(new THREE.Vector3(sx0 - 1, 2.95, sz0 - 0.4), new THREE.Vector3(-5.2, SY, 2.4), 0.35, 18);

  // ---------- 能坐能躺的地方 ----------
  // x/z 是人站的位置（坐：屁股；躺：头），r 是朝向（0 面朝大海），y 是坐垫 / 躺椅高度，ex/ez 是起来以后站到哪
  const seats = [];
  const seatPicks = [];
  const seatSpot = (pose, x, z, r, y, ex, ez, label) => { seats.push({ pose, x, z, r, y, ex, ez, label }); return seats.length - 1; };
  for (const dx of [-1.0, 0, 1.0]) seatSpot('sit', sx0 + 1.6 + dx, sz0 + 2.2 - 0.2, 0, 0.46, sx0 + 1.6 + dx, sz0 + 1.45, '坐沙发');
  for (const dz of [-0.6, 0.6]) seatSpot('sit', sx0 - 0.25 + 0.2, sz0 + 1.1 + dz, -Math.PI / 2, 0.46, sx0 + 0.75, sz0 + 1.1 + dz, '坐沙发');
  for (const x of [-7.6, -6.4]) seatSpot('lie', x, 0.95, 0, 0.42, x + (x < -7 ? -0.75 : 0.75), 0.6, '躺躺椅');
  // 沙发、躺椅上的坐垫可以点；按座位离得最近的那个坐
  group.traverse((o) => { if (o.isMesh && (o.material === cushion || o.material === cushion2) && !o.userData.pick) { o.userData.pick = { kind: 'seat' }; seatPicks.push(o); } });
  lawn.userData.pick = { kind: 'ground', label: '坐在草坪上' }; seatPicks.push(lawn);

  const world = { bounds: [X0 + 0.25, X1 - 0.25, EDGE_Z + 0.2, Z1 - 0.25], obstacles };
  return {
    group, ashtray, door, world, seats, seatPicks,
    update(n, t) {
      bulbMat.emissiveIntensity = 0.15 + n * 0.65; // 别太亮：像素风加泛光会把灯泡糊成发光的大方块，晃眼
      glowM.opacity = n * 0.22;
      for (const [i, L] of lights.entries()) L.intensity = n * (9 + Math.sin(t * 2.3 + i) * 0.6);
      doorLight.intensity = 0.6 + n * 4; // 出生点就在门口，太亮会把凑到脸前的手和东西打爆
      doorLamp.material.emissiveIntensity = 0.5 + n * 3;
    },
  };
}
