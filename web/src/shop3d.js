// 3D 便利店：参考日式连锁便利店（7-11 一类）的典型格局简化，招牌和配色是原创的
//  ┌──────────── 后墙：一整排冷饮柜（啤酒 / 嗨棒烧酒 / 清酒威士忌 / 汽水 / 茶水 / 咖啡）┐ ← 左上角是上天台的楼梯门
//  │左墙：敞开式冷藏（便当、饭团、三明治、牛奶果汁）  中间两排货架（零食 / 杯面饼干）   右墙：烟柜 │
//  │                                    货架头上有促销堆头          收银台（口香糖、关东煮、烤肠、咖啡）│
//  │ATM   杂志架（沿着前窗）                     雪糕冰柜        自动门 │
//  └──────────── 前面：落地玻璃，外面是街 ─────────┘
// 货品很多，同一种东西合成一个 InstancedMesh 画（几百件也不卡）；每件能拿的东西 userData.pick = { kind, id, label }
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CIGS, ITEM, ITEMS } from '../../public/js/data.js';
import { makeItem } from './items3d.js';
import { createPackAtlas, packSize } from './packs.js';
import { canvasTex, rng } from './textures.js';
import { t } from './i18n.js';

const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
export const SHOP_SPAWN = [-3.45, -2.75, Math.PI + 0.5];
const R = rng(42);
const jitter = (a) => (R() - 0.5) * a;

function sign(scene, text, x, y, z, ry, bg, fg, w, glow) {
  const t = canvasTex(512, 96, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 512, 96); if (text) { g.fillStyle = fg; g.font = `800 50px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50, 490); } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 96 / 512), new THREE.MeshStandardMaterial({ map: t, emissive: glow ? '#ffffff' : '#000000', emissiveMap: glow ? t : null, emissiveIntensity: glow ? 0.9 : 0, roughness: 0.5 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  return m;
}
// 层板前沿的价签条：tags = [[位置 0..1, 价格, 是否促销]]
function priceStrip(tags, len) {
  return canvasTex(Math.round(len * 400), 28, (g) => {
    const W = g.canvas.width; g.fillStyle = '#f7f6f0'; g.fillRect(0, 0, W, 28);
    g.fillStyle = '#1d8a66'; g.fillRect(0, 0, W, 3);
    for (const [u, price, sale] of tags) {
      const x = u * W; g.fillStyle = sale ? '#f2d23a' : '#ffffff'; g.fillRect(x + 4, 5, 64, 21); g.strokeStyle = '#c8c4b8'; g.strokeRect(x + 4, 5, 64, 21);
    }
  });
}

export function createShop(renderer) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  scene.background = new THREE.Color('#0b0d14');
  const picks = [];
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const pickable = (obj, pick) => { obj.traverse((o) => { o.userData.pick = pick; }); picks.push(obj); return obj; };
  const steel = new THREE.MeshStandardMaterial({ color: '#b8bec4', metalness: 0.85, roughness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.5 });
  const shelfEdge = new THREE.MeshStandardMaterial({ color: '#ffe14a' });

  // ---------- 货品：先记位置，最后每种东西合成一批 ----------
  const stock = new Map(); // id → Matrix4[]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
  const put = (id, x, y, z, ry = 0, rx = 0, rz = 0) => {
    if (!ITEM[id]) return;
    if (!stock.has(id)) stock.set(id, []);
    stock.get(id).push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s));
  };
  const width = (id) => (ITEM[id] ? makeItemCached(id).userData.width : 0.08);
  const tplCache = new Map();
  function makeItemCached(id) { if (!tplCache.has(id)) { const t = makeItem(id); t.updateMatrixWorld(true); tplCache.set(id, t); } return tplCache.get(id); }
  // 沿一条线摆满：from→to 是层板方向（世界坐标 x 或 z），face 是商品正面朝向（ry），depthRows 是往里摆几排
  function facings(ids, { axis, from, to, y, at, depth = [0], face, stack = 1, gap = 0.006 }) {
    // 每个产品平分这一层的长度，按它自己的宽度算摆几个面（以前按第一个产品的宽度算，窄的杯面会把后面的挤出货架）
    const tags = []; const len = Math.abs(to - from), dir = Math.sign(to - from), seg = len / ids.length;
    let pos = from;
    ids.forEach((id, n) => {
      const w = width(id) + gap, end = (n + 1) * seg, cnt = Math.max(1, Math.floor((end - Math.abs(pos - from)) / w));
      tags.push([Math.abs(pos - from) / len, `${(1 + R() * 4).toFixed(2)}`, R() < 0.18]);
      for (let k = 0; k < cnt; k++) {
        if (Math.abs(pos + dir * w - from) > len + 0.001) break;
        const c = pos + dir * w / 2, stk = typeof stack === 'function' ? stack(id) : stack;
        for (const d of depth) for (let s = 0; s < stk; s++) {
          const h = ITEM[id] ? makeItemCached(id).userData.height : 0.1;
          const px = axis === 'x' ? c : at + d, pz = axis === 'x' ? at + d : c;
          put(id, px + (axis === 'z' ? jitter(0.006) : 0), y + s * (h + 0.002), pz + (axis === 'x' ? jitter(0.006) : 0), face + jitter(0.12));
        }
        pos += dir * w;
      }
    });
    return tags;
  }
  function flushStock() {
    for (const [id, mats] of stock) {
      const tpl = makeItemCached(id);
      tpl.traverseVisible((o) => {
        if (!o.isMesh) return;
        const inst = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
        for (let i = 0; i < mats.length; i++) inst.setMatrixAt(i, _m.multiplyMatrices(mats[i], o.matrixWorld));
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
        inst.castShadow = true; inst.receiveShadow = true;
        scene.add(inst); pickable(inst, { kind: 'item', id, label: ITEM[id].name });
      });
    }
  }
  // 不能拿的装饰（便当、酸奶）也合批
  function decor(geo, mat, positions) {
    const inst = new THREE.InstancedMesh(geo, mat, positions.length);
    positions.forEach(([x, y, z, ry = 0], i) => inst.setMatrixAt(i, _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s)));
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); return inst;
  }
  const stripMesh = (tags, len, x, y, z, ry) => { const m = add(new THREE.PlaneGeometry(len, 0.028), new THREE.MeshStandardMaterial({ map: priceStrip(tags, len), roughness: 0.6 }), x, y, z); m.rotation.y = ry; m.castShadow = false; return m; };

  // ---------- 房间 ----------
  const tile = canvasTex(512, 512, (g) => {
    g.fillStyle = '#e8e5de'; g.fillRect(0, 0, 512, 512);
    const r = rng(5); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.03})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
    g.strokeStyle = '#c4bfb4'; g.lineWidth = 3; for (let k = 0; k <= 512; k += 256) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
  }, { repeat: [10, 8] });
  const floor = add(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.16 }), 0, 0, 0); floor.rotation.x = -Math.PI / 2;
  const wallM = new THREE.MeshStandardMaterial({ color: '#f1eee6', roughness: 0.85 });
  const ceil = add(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ color: '#dcdfe0', roughness: 0.9 }), 0, 3, 0); ceil.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(10, 3, 0.1), wallM, 0, 1.5, -4.05);
  add(new THREE.BoxGeometry(0.1, 3, 8), wallM, -5.05, 1.5, 0);
  add(new THREE.BoxGeometry(0.1, 3, 8), wallM, 5.05, 1.5, 0);
  for (const [x, z, w, ry] of [[0, -3.99, 10, 0], [-4.99, 0, 8, Math.PI / 2], [4.99, 0, 8, -Math.PI / 2]]) {
    for (const [y, col] of [[2.62, '#1d8a66'], [2.52, '#f08a24']]) { const m = add(new THREE.PlaneGeometry(w, 0.08), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }), x, y, z); m.rotation.y = ry; m.castShadow = false; }
  }
  for (const [x, z, w, d] of [[0, -3.98, 10, 0.04], [-4.98, 0, 0.04, 8], [4.98, 0, 0.04, 8]]) add(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshStandardMaterial({ color: '#a9a397' }), x, 0.06, z);
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f0', roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false });
  // 前面落地玻璃：中间 1.2–2.6 米是感应门（门洞上方还是玻璃）
  add(new THREE.BoxGeometry(6.2, 3, 0.03), glass, -1.9, 1.5, 4.0).castShadow = false;
  add(new THREE.BoxGeometry(2.4, 3, 0.03), glass, 3.8, 1.5, 4.0).castShadow = false;
  add(new THREE.BoxGeometry(1.4, 0.7, 0.03), glass, 1.9, 2.65, 4.0).castShadow = false;
  // 感应门：两扇玻璃推拉门，走到地垫上就往两边滑开（main.js 每帧调 autoDoor.update）
  const frontDoorGlass = new THREE.MeshStandardMaterial({ color: '#dff0f6', roughness: 0.03, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false });
  const panels = [-1, 1].map((sd) => { const g = new THREE.Group(); g.position.set(1.9 + sd * 0.35, 0, 3.97); scene.add(g);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.28, 0.02), frontDoorGlass); pane.position.y = 1.15; g.add(pane);
    const fm = new THREE.MeshStandardMaterial({ color: '#9aa3ab', metalness: 0.85, roughness: 0.3 });
    for (const [w, h, x, y] of [[0.04, 2.3, -0.33, 1.15], [0.04, 2.3, 0.33, 1.15], [0.7, 0.05, 0, 0.03], [0.7, 0.05, 0, 2.28]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), fm); f.position.set(x, y, 0); g.add(f); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), fm); bar.position.set(-sd * 0.27, 1.1, -0.03); g.add(bar);
    return { g, sd }; });
  add(new THREE.BoxGeometry(1.5, 0.16, 0.18), new THREE.MeshStandardMaterial({ color: '#7d868e', metalness: 0.8, roughness: 0.35 }), 1.9, 2.38, 3.92); // 门头（感应器在里面）
  const sensor = add(new THREE.BoxGeometry(0.12, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff3030', emissiveIntensity: 0.6 }), 1.9, 2.29, 3.83);
  let doorOpen = 0;
  const autoDoor = {
    // 站在地垫区域（x 1.2–2.6、z 2.9 以外）就开门；open 0..1
    near: (x, z) => x > 1.15 && x < 2.65 && z > 2.85,
    update(want, dt) { doorOpen += ((want ? 1 : 0) - doorOpen) * Math.min(1, dt * (want ? 5 : 3)); for (const p of panels) p.g.position.x = 1.9 + p.sd * (0.35 + 0.68 * doorOpen); sensor.material.emissive.set(want ? '#30ff70' : '#ff3030'); return doorOpen; },
  };
  const frameM = new THREE.MeshStandardMaterial({ color: '#7d868e', metalness: 0.8, roughness: 0.35 });
  for (const x of [-5, -2.5, 0, 1.2, 2.6, 5]) add(new THREE.BoxGeometry(0.08, 3, 0.1), frameM, x, 1.5, 4.0);
  add(new THREE.BoxGeometry(10, 0.08, 0.1), frameM, 0, 2.3, 4.0);
  add(new THREE.BoxGeometry(1.4, 0.01, 0.9), new THREE.MeshStandardMaterial({ color: '#3a4a44', roughness: 1 }), 1.9, 0.005, 3.45);
  const street = canvasTex(1024, 300, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#0b1026'); gr.addColorStop(0.6, '#1d2040'); gr.addColorStop(1, '#2a2632'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 300);
    const r = rng(8); for (let x = -20; x < 1024; x += 70 + r() * 60) { const h = 80 + r() * 160; g.fillStyle = '#12142a'; g.fillRect(x, 300 - h, 60 + r() * 50, h); for (let i = 0; i < 20; i++) if (r() < 0.5) { g.fillStyle = r() < 0.8 ? '#ffc76a' : '#9cc8ff'; g.fillRect(x + 6 + r() * 50, 300 - h + 8 + r() * (h - 20), 5, 6); } }
    g.fillStyle = '#3a3a44'; g.fillRect(0, 270, 1024, 30);
  });
  add(new THREE.PlaneGeometry(26, 7.5), new THREE.MeshBasicMaterial({ map: street }), 0, 2.2, 9).rotation.y = Math.PI;
  for (let x = -3.5; x <= 3.6; x += 2.33) for (const z of [-2.2, 0.2, 2.6]) add(new THREE.BoxGeometry(1.2, 0.04, 0.28), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 1.6 }), x, 2.98, z).castShadow = false;
  for (const [x, z] of [[-2.5, -2], [2.5, -2], [-2.5, 1.8], [2.5, 1.8]]) { const L = new THREE.PointLight('#fff6ea', 5, 9, 1.6); L.position.set(x, 2.8, z); scene.add(L); }
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8478', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 0.9); key.position.set(1, 6, 2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); key.shadow.bias = -0.0005; scene.add(key);

  // ---------- 后墙：冷饮柜（玻璃门），六个门一类 ----------
  const fx0 = -3.3, fx1 = 4.4, fz = -3.6, fw = fx1 - fx0, fc = (fx0 + fx1) / 2;
  add(new THREE.BoxGeometry(fw, 2.3, 0.04), steel, fc, 1.15, -3.98);
  add(new THREE.BoxGeometry(fw, 0.18, 0.78), steel, fc, 2.21, fz);
  add(new THREE.BoxGeometry(fw, 0.22, 0.78), steel, fc, 0.11, fz);
  for (const x of [fx0, fx1]) add(new THREE.BoxGeometry(0.05, 2.3, 0.78), steel, x, 1.15, fz);
  add(new THREE.BoxGeometry(fw, 1.9, 0.02), new THREE.MeshStandardMaterial({ color: '#dfeef6', emissive: '#cfeeff', emissiveIntensity: 0.18, roughness: 0.6 }), fc, 1.2, -3.95);
  const SECTIONS = [ // 每个门：从上到下五层
    { name: '啤 酒', rows: [['lager_green', 'lager_beach'], ['beer_dry'], ['beer_tall'], ['stout', 'beer_dry'], ['beer_tall']] },
    { name: '嗨棒 · 洋酒', rows: [['highball'], ['whisky'], ['soju'], ['sake', 'highball'], ['soju']] },
    { name: '可 乐 汽 水', rows: [['cola'], ['cola_blue'], ['lemon_lime'], ['cola', 'cola_blue'], ['cola']] },
    { name: '能 量 饮 料', rows: [['energy'], ['energy_claw'], ['energy', 'energy_claw'], ['energy'], ['energy_claw']] },
    { name: '茶 · 水', rows: [['tea'], ['sports'], ['water'], ['tea', 'sports'], ['water']] },
    { name: '咖 啡', rows: [['coffee'], ['coffee'], ['coffee', 'tea'], ['sports'], ['coffee']] },
  ];
  // Gemini 做的各国饮料：啤酒在前、其他酒在后，每扇门 5 层、每层 2 种，接在后面加门
  const KIND_ORDER = ['beer', 'lager', 'highball', 'chuhai', 'soju', 'sake', 'makgeolli', 'baijiu', 'ricewine', 'spirit', 'rum', 'arrack'];
  const cat = ITEMS.filter((i) => i.catalog && i.shelf === 'fridge').sort((x, y) => ((KIND_ORDER.indexOf(x.kind) + 99) % 99) - ((KIND_ORDER.indexOf(y.kind) + 99) % 99) || x.country.localeCompare(y.country));
  for (let i = 0; i < cat.length; i += 10) {
    const ids = cat.slice(i, i + 10).map((x) => x.id);
    SECTIONS.push({ name: '', rows: [0, 1, 2, 3, 4].map((r) => ids.slice(r * 2, r * 2 + 2)).map((row, r) => (row.length ? row : [ids[r % ids.length]])) });
  }

  const secW = fw / SECTIONS.length;
  for (let s = 0; s < 5; s++) {
    const y = 0.32 + (4 - s) * 0.38;   // s=0 是最上层
    add(new THREE.BoxGeometry(fw - 0.1, 0.015, 0.62), new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.2, metalness: 0.3 }), fc, y, fz - 0.04);
    SECTIONS.forEach((sec, i) => {
      const x0 = fx0 + i * secW + 0.06, x1 = fx0 + (i + 1) * secW - 0.06;
      const tags = facings(sec.rows[s], { axis: 'x', from: x0, to: x1, y: y + 0.008, at: fz, depth: [0.14, -0.06, -0.24], face: 0 });
      stripMesh(tags, x1 - x0, (x0 + x1) / 2, y - 0.01, fz + 0.271, 0);
    });
  }
  for (let i = 0; i <= SECTIONS.length; i++) { const x = fx0 + secW * i; add(new THREE.BoxGeometry(0.05, 2.0, 0.05), steel, x, 1.2, fz + 0.38); if (i < SECTIONS.length) add(new THREE.BoxGeometry(0.03, 0.6, 0.04), steel, x + 0.12, 1.2, fz + 0.43); }
  add(new THREE.BoxGeometry(fw, 2.0, 0.02), new THREE.MeshStandardMaterial({ color: '#e8f8ff', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.08, depthWrite: false }), fc, 1.2, fz + 0.38).castShadow = false;
  for (const x of [-2, 0.5, 3]) { const L = new THREE.PointLight('#d8f0ff', 0.6, 2.5, 2); L.position.set(x, 1.6, -3.4); scene.add(L); }

  // ---------- 左墙：敞开式冷藏柜（便当、饭团、三明治、牛奶果汁）----------
  const dark = new THREE.MeshStandardMaterial({ color: '#2a3036', roughness: 0.5, metalness: 0.4 });
  add(new THREE.BoxGeometry(0.85, 0.4, 4.6), dark, -4.55, 0.2, 0);
  add(new THREE.BoxGeometry(0.04, 1.6, 4.6), new THREE.MeshStandardMaterial({ color: '#e8f2f6', emissive: '#d8eef8', emissiveIntensity: 0.3 }), -4.97, 1.2, 0);
  add(new THREE.BoxGeometry(0.85, 0.15, 4.6), dark, -4.55, 2.0, 0);
  for (const z of [-2.3, 2.3]) add(new THREE.BoxGeometry(0.85, 2.0, 0.04), dark, -4.55, 1.0, z);
  const chillRows = [null, ['onigiri'], ['sandwich', 'onigiri'], ['milk', 'juice']];
  for (let s = 0; s < 4; s++) {
    const y = 0.45 + s * 0.36, depth = 0.7 - s * 0.08, front = -4.95 + depth;
    add(new THREE.BoxGeometry(depth, 0.02, 4.5), steel, -4.95 + depth / 2, y, 0);
    add(new THREE.BoxGeometry(0.01, 0.04, 4.5), shelfEdge, front, y + 0.01, 0);
    if (!chillRows[s]) continue;
    const tags = facings(chillRows[s], { axis: 'z', from: -2.2, to: 2.2, y: y + 0.012, at: front, depth: [-0.08, -0.25], face: Math.PI / 2 });
    stripMesh(tags, 4.4, front + 0.006, y - 0.004, 0, Math.PI / 2);
  }
  // 最下层是便当（装饰）：黑底托盘 + 透明盖 + 彩色菜
  { const pos = []; for (let z = -2.15; z < 2.15; z += 0.2) for (const d of [0.12, 0.33]) pos.push([-4.95 + 0.7 - d, 0.48, z, jitter(0.1)]);
    decor(new THREE.BoxGeometry(0.17, 0.035, 0.17), new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.5 }), pos);
    decor(new THREE.BoxGeometry(0.15, 0.02, 0.15), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { const r = rng(3); g.fillStyle = '#f4f0e4'; g.fillRect(0, 0, 64, 128); for (let i = 0; i < 40; i++) { g.fillStyle = ['#c84a2a', '#e8a83a', '#4a8a3a', '#8a4a2a', '#f2d46a'][i % 5]; g.fillRect(64 + r() * 60, r() * 120, 10, 8); } }), roughness: 0.7 }), pos.map(([x, y, z, r]) => [x, y + 0.025, z, r]));
    stripMesh([[0.1, '5.80', true], [0.5, '4.90', false]], 4.4, -4.95 + 0.7 + 0.006, 0.446, 0, Math.PI / 2); }

  // ---------- 中间两排货架（两面都摆）+ 货架头的促销堆头 ----------
  const shelfM = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.7 });
  const GONDOLAS = [
    { gx: -2.4, name: '零 食 · 糖 果', sides: { [-1]: [['chips', 'chips_tri'], ['puffs', 'shrimp'], ['chips_tube'], ['choco_dots', 'gummy']], [1]: [['chips_tri', 'chips'], ['bar_nut', 'bar_wafer'], ['toblerone', 'pocky'], ['gummy', 'choco_dots']] } },
    { gx: -0.2, name: '杯 面 · 饼 干', sides: { [-1]: [['noodle', 'noodle_spicy'], ['noodle_spicy'], ['cookie', 'pocky'], ['noodle']], [1]: [['chips_tube'], ['noodle'], ['cookie'], ['bar_nut', 'toblerone']] } },
  ];

  // 有 Gemini 做的零食就全换成它们。按「产品」摆，不按口味：同一个产品的不同口味（乐事原味 / 酸奶油、百奇巧克力 / 草莓）算一个，挨着放；
  // 每层货架放 2–3 个不同的产品，而且按种类错开（薯片旁边是巧克力、饼干），不会一整面全是长得差不多的巧克力排块
  const SNACK_ORDER = ['chips', 'snack', 'nuts', 'jerky', 'chocolate', 'candy', 'gum', 'cookies', 'noodles'];
  const famOf = (i) => { if (i.family) return i.family.toLowerCase(); const m = (i.insp || '').match(/（([^）]*[A-Za-z][^）]*)）[^（]*$/), w = (m ? m[1] : i.insp || '').match(/[A-Za-z][A-Za-z&'!.-]*/); return w ? w[0].toLowerCase() : i.id; };
  const catSnacks = ITEMS.filter((i) => i.catDir === 'snack').sort((p, q) => (SNACK_ORDER.indexOf(p.kind) - SNACK_ORDER.indexOf(q.kind)) || p.look[0].localeCompare(q.look[0]));
  if (catSnacks.length) {
    const fams = new Map(); for (const i of catSnacks) { const k = famOf(i); if (!fams.has(k)) fams.set(k, []); fams.get(k).push(i.id); }
    const famList = [...fams.values()], runs = GONDOLAS.length * 2 * 4, slots = Array.from({ length: runs }, () => []);
    famList.forEach((f, j) => slots[j % runs].push(...f)); // 按种类排好的产品轮流发到每一层：相邻的层、同一层里都是不同种类
    slots.forEach((sl, r) => { if (!sl.length) sl.push(...famList[r % famList.length]); });
    GONDOLAS.forEach((G, gi) => { G.sides = { [-1]: [], [1]: [] }; [-1, 1].forEach((side, si) => { for (let sh = 0; sh < 4; sh++) G.sides[side].push(slots[(gi * 2 + si) * 4 + sh].slice(0, 9)); }); });
  }
  for (const { gx, name, sides } of GONDOLAS) {
    add(new THREE.BoxGeometry(0.12, 1.5, 3.4), shelfM, gx, 0.75, -0.6);
    add(new THREE.BoxGeometry(0.9, 0.1, 3.4), new THREE.MeshStandardMaterial({ color: '#8f8878' }), gx, 0.05, -0.6);
    for (let s = 0; s < 4; s++) {
      const y = 0.25 + s * 0.36;
      for (const side of [-1, 1]) {
        add(new THREE.BoxGeometry(0.4, 0.02, 3.4), shelfM, gx + side * 0.25, y, -0.6);
        add(new THREE.BoxGeometry(0.01, 0.035, 3.4), shelfEdge, gx + side * 0.45, y - 0.005, -0.6);
        const ids = sides[side][s].filter((id) => ITEM[id]), cup = (id) => (ITEM[id].style === 'noodle' ? 2 : 1); // 杯面叠两层，别的一层
        const tags = facings(ids, { axis: 'z', from: -2.22, to: 1.02, y: y + 0.012, at: gx + side * 0.36, depth: [0, -side * 0.16], face: side > 0 ? Math.PI / 2 : -Math.PI / 2, stack: cup, gap: 0.016 });
        stripMesh(tags, 3.24, gx + side * 0.456, y - 0.004, -0.6, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
  }
  // 货架朝门的一头：促销台，能量饮料和薯片堆成小山
  const catEnergy = ITEMS.filter((i) => i.catalog && i.kind === 'energy').map((i) => i.id), catChips = catSnacks.filter((i) => i.kind === 'chips' && i.look[0] === 'bag').map((i) => i.id);
  for (const [gx, ids] of [[-2.4, catEnergy.length >= 2 ? catEnergy.slice(0, 2) : ['energy', 'energy_claw']], [-0.2, catChips.length >= 2 ? catChips.slice(0, 2) : ['chips', 'chips_tri']]]) {
    add(new THREE.BoxGeometry(0.8, 0.5, 0.42), new THREE.MeshStandardMaterial({ color: '#f08a24', roughness: 0.6 }), gx, 0.25, 1.38);
    add(new THREE.PlaneGeometry(0.78, 0.2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 64, (g) => { g.fillStyle = '#c62a2a'; g.fillRect(0, 0, 256, 64); }) }), gx, 0.32, 1.595);
    const w = width(ids[0]) + 0.004, h = makeItemCached(ids[0]).userData.height, n0 = Math.min(10, Math.floor(0.76 / w));
    for (let layer = 0; layer < 3; layer++) {
      const n = n0 - layer;
      for (let i = 0; i < n; i++) for (let d = 0; d < 3 - layer; d++) put(ids[(i + layer) % 2], gx - ((n - 1) / 2) * w + i * w, 0.5 + layer * (h + 0.002), 1.24 + d * 0.11 + layer * 0.055, jitter(0.1));
    }
  }

  // ---------- 前窗：杂志架、ATM ----------
  add(new THREE.BoxGeometry(3.6, 0.9, 0.35), shelfM, -2.4, 0.45, 3.65);
  const covers = ['#c95454', '#4f7fc9', '#f2c14e', '#5a9e6a', '#8a5cc2', '#e98a2b', '#2f7377', '#222428'];
  const TITLES = ['WEEKLY', 'NIGHT', '旅行', 'CAR', '漫画', 'FOOD', 'MUSIC', '电影', 'GAME', 'STYLE', 'CITY'];
  for (let i = 0; i < 22; i++) {
    const tx = canvasTex(128, 176, (g) => { const r = rng(i + 3); g.fillStyle = covers[i % covers.length]; g.fillRect(0, 0, 128, 176); g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `900 26px ${FONT}`; g.textAlign = 'center'; g.fillText(TITLES[i % TITLES.length], 64, 32, 120); g.fillStyle = `hsl(${r() * 360},40%,${55 + r() * 20}%)`; g.fillRect(14, 48, 100, 90); g.fillStyle = '#fff'; g.font = `600 11px ${FONT}`; for (let k = 0; k < 3; k++) g.fillText('· · · · · · ·', 64, 152 + k * 8); });
    const m = add(new THREE.BoxGeometry(0.21, 0.29, 0.006), [0, 1, 2, 3].map(() => white).concat([new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35 }), white]), -4.05 + i * 0.155, 1.02, 3.66); m.rotation.x = 0.25; m.rotation.y = Math.PI;
  }
  add(new RoundedBoxGeometry(0.7, 1.6, 0.6, 3, 0.05), new THREE.MeshStandardMaterial({ color: '#3a3f48', metalness: 0.5, roughness: 0.4 }), -4.55, 0.8, 3.55);
  add(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#4fa8ff', emissiveIntensity: 0.9 }), -4.55, 1.25, 3.24).rotation.y = Math.PI;

  // ---------- 收银台：口香糖小架、关东煮、烤肠、咖啡机 ----------
  const wood = new THREE.MeshStandardMaterial({ color: '#7a6250', roughness: 0.55 });
  add(new THREE.BoxGeometry(0.7, 1.0, 3.6), wood, 3.4, 0.5, 0.9);
  add(new THREE.BoxGeometry(0.8, 0.05, 3.7), new THREE.MeshStandardMaterial({ color: '#cfc6b8', roughness: 0.3 }), 3.4, 1.02, 0.9);
  add(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshStandardMaterial({ map: canvasTex(1152, 240, (g) => { // 收银台正面的绿色横条：写一句提醒
    g.fillStyle = '#1d8a66'; g.fillRect(0, 0, 1152, 240); g.fillStyle = '#f08a24'; g.fillRect(0, 209, 1152, 31);
    const msg = t('上楼顶时记得带包烟', 'Grab a pack before you head up'), cjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(msg), fam = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
    let fs = cjk ? 104 : 88; g.font = `800 ${fs}px ${fam}`; while (g.measureText(msg).width > 1040 && fs > 30) { fs -= 4; g.font = `800 ${fs}px ${fam}`; }
    g.fillStyle = '#f6f1e2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(msg, 576, 102);
  }) }), 3.04, 0.6, 0.9).rotation.y = -Math.PI / 2;
  // 口香糖、糖果三层小台阶
  for (let t = 0; t < 3; t++) {
    add(new THREE.BoxGeometry(0.12, 0.012, 0.5), new THREE.MeshStandardMaterial({ color: '#f4f2ee' }), 3.12 + t * 0.1, 1.05 + t * 0.06, -0.55);
    facings(t === 1 ? ['mints'] : ['gum'], { axis: 'z', from: -0.78, to: -0.32, y: 1.056 + t * 0.06, at: 3.12 + t * 0.1, face: -Math.PI / 2, gap: 0.004 });
  }
  add(new RoundedBoxGeometry(0.35, 0.22, 0.3, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.4 }), 3.45, 1.16, 0.25);
  add(new THREE.PlaneGeometry(0.26, 0.15), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#5ad1a0', emissiveIntensity: 1.2 }), 3.28, 1.2, 0.25).rotation.y = -Math.PI / 2 + 0.3;
  add(new THREE.BoxGeometry(0.5, 0.18, 0.38), steel, 3.4, 1.13, 1.2);
  add(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshStandardMaterial({ color: '#c9a560', roughness: 0.2 }), 3.4, 1.22, 1.2).rotation.x = -Math.PI / 2;
  for (let i = 0; i < 9; i++) put('oden', 3.24 + (i % 3) * 0.12, 1.12, 1.07 + Math.floor(i / 3) * 0.12, 0, 0, jitter(0.4));
  const steamAt = new THREE.Vector3(3.4, 1.28, 1.2);
  // 烤肠机：不锈钢底座 + 一排镀铬滚轴（沿柜台方向），烤肠横躺在两根滚轴之间慢慢转；上面一块斜的亚克力防护罩、顶上一条暖光灯
  const grill = new THREE.Group(); grill.position.set(3.4, 1.045, 1.9); scene.add(grill);
  const chrome = new THREE.MeshStandardMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.18 });
  const gBase = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.07, 0.52, 2, 0.01), steel); gBase.position.y = 0.035; grill.add(gBase);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.01, 0.48), new THREE.MeshStandardMaterial({ color: '#8a8f94', metalness: 0.9, roughness: 0.4 })); tray.position.y = 0.072; grill.add(tray);
  for (const sz of [-1, 1]) { const end = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.02), steel); end.position.set(0, 0.1, sz * 0.25); grill.add(end); }
  const ROLL = 9, rx = (i) => -0.16 + i * 0.04;
  for (let i = 0; i < ROLL; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.48, 16), chrome); r.rotation.x = Math.PI / 2; r.position.set(rx(i), 0.1, 0); grill.add(r); }
  const skinTex = canvasTex(64, 32, (g) => { g.fillStyle = '#b8542a'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#6e2c12'; for (let x = 4; x < 64; x += 9) g.fillRect(x, 0, 3, 32); g.fillStyle = 'rgba(255,220,180,.25)'; g.fillRect(0, 6, 64, 3); });
  const sausM = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.35, metalness: 0.05 });
  const sausages = [];
  for (let i = 0; i < ROLL - 1; i++) for (const sz of [-0.11, 0.11]) { if ((i + (sz > 0)) % 3 === 2) continue; const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.15, 6, 14), sausM); m.rotation.x = Math.PI / 2; m.position.set((rx(i) + rx(i + 1)) / 2, 0.12, sz); m.castShadow = true; grill.add(m); sausages.push(m); }
  const hood = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), new THREE.MeshStandardMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.16, roughness: 0.02, side: THREE.DoubleSide, depthWrite: false }));
  hood.rotation.order = 'ZYX'; hood.rotation.set(0, -Math.PI / 2, -0.55); hood.position.set(-0.13, 0.215, 0); grill.add(hood); // 先转成面朝顾客，再绕长边往后仰（以前顺序反了，玻璃在自己平面里歪着）
  for (const sz of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 8), chrome); post.position.set(0.17, 0.22, sz * 0.24); grill.add(post); }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.5), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ff8a3a', emissiveIntensity: 1.2 })); lamp.position.set(0.17, 0.37, 0); grill.add(lamp);
  const lampL = new THREE.PointLight('#ff9a50', 1.2, 0.9, 2); lampL.position.set(0.1, 0.32, 0); grill.add(lampL);
  for (const sz of [-0.12, 0, 0.12]) { const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), new THREE.MeshStandardMaterial({ color: '#1a1a1a' })); knob.rotation.z = Math.PI / 2; knob.position.set(-0.225, 0.035, sz); grill.add(knob); }
  pickable(grill, { kind: 'item', id: 'sausage', label: '烤肠' });
  add(new RoundedBoxGeometry(0.34, 0.5, 0.36, 3, 0.03), new THREE.MeshStandardMaterial({ color: '#1e1e22', metalness: 0.4, roughness: 0.35 }), 3.4, 1.3, 2.5);
  add(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb060', emissiveIntensity: 0.8 }), 3.22, 1.42, 2.5).rotation.y = -Math.PI / 2;
  for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 20), white, 3.3, 1.1 + i * 0.11, 2.85);

  // ---------- 烟柜：Gemini 做的各国香烟，玻璃门陈列柜 ----------
  // 每个牌子一格：正面并排三盒、往里还码着两层；格子之间留空、立一片透明亚克力隔板；层板前沿是价签条和灯带；整柜罩一排玻璃推拉门
  const cabZ0 = -0.88, cabZ1 = 2.68, cabX = 4.47;
  const backboard = add(new THREE.BoxGeometry(0.35, 2.2, 3.6), new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: 0.55 }), 4.82, 1.4, 0.9);
  const cabM = new THREE.MeshStandardMaterial({ color: '#1c1a1a', roughness: 0.4, metalness: 0.3 });
  for (const z of [cabZ0, cabZ1]) add(new THREE.BoxGeometry(0.36, 2.2, 0.03), cabM, 4.65, 1.4, z);      // 两侧板
  add(new THREE.BoxGeometry(0.4, 0.5, cabZ1 - cabZ0 + 0.03), cabM, 4.65, 0.25, (cabZ0 + cabZ1) / 2);     // 下面的柜体
  add(new THREE.BoxGeometry(0.4, 0.2, cabZ1 - cabZ0 + 0.03), cabM, 4.65, 2.4, (cabZ0 + cabZ1) / 2);      // 顶上灯箱
  add(new THREE.PlaneGeometry(cabZ1 - cabZ0 - 0.06, 0.14), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff4dc', emissiveIntensity: 0.55 }), 4.448, 2.4, (cabZ0 + cabZ1) / 2).rotation.y = -Math.PI / 2;
  const _eLean = new THREE.Euler(0, 0, 0, 'YXZ'); // 先绕竖轴转到朝外，再往后靠
  const allCigs = CIGS.filter((b) => b.catalog);
  const brands = (allCigs.length ? allCigs : CIGS.slice()).sort((a, b) => (a.country || '').localeCompare(b.country || ''));
  const atlas = createPackAtlas(brands);
  const z0 = cabZ0 + 0.06, z1 = cabZ1 - 0.06, L = z1 - z0, ROWS = 8, rowY = (r) => 0.58 + r * 0.205;
  const perRow = Math.ceil(brands.length / ROWS);
  const F = Math.max(1, Math.min(3, Math.floor(L / (perRow * 0.085))));   // 每个牌子并排几盒
  const IN_GAP = 0.01, DEPTH = 3, LEAN = 0.1;                             // 同牌子之间的缝、往里码几层、往后靠的角度
  const packPos = new Map(), dividers = [], tagsByRow = Array.from({ length: ROWS }, () => []);
  for (let r = 0; r < ROWS; r++) {
    const row = brands.slice(r * perRow, (r + 1) * perRow); if (!row.length) continue;
    const gw = row.map((b) => F * packSize(b)[0] + (F - 1) * IN_GAP);
    const gap = (L - gw.reduce((x, y) => x + y, 0)) / row.length;          // 格子之间平均分剩下的地方
    let z = z0 + gap / 2;
    row.forEach((b, i) => {
      const [w, h, d] = packSize(b);
      tagsByRow[r].push([(z - z0 + gw[i] / 2 - 0.08) / L, '', false]);
      for (let k = 0; k < F; k++) for (let j = 0; j < DEPTH; j++) {
        if (!packPos.has(b.id)) packPos.set(b.id, []);
        const lean = j ? 0.02 : LEAN, y = rowY(r) + 0.004 + (h / 2) * Math.cos(lean);
        packPos.get(b.id).push([cabX + 0.06 + d / 2 + (h / 2) * Math.sin(lean) + j * (d + 0.012), y, z + w / 2 + k * (w + IN_GAP), lean]);
      }
      z += gw[i] + gap;
      if (i < row.length - 1) dividers.push([rowY(r) + 0.055, z - gap / 2]);
    });
  }
  const glassAcrylic = new THREE.MeshStandardMaterial({ color: '#dff2ff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
  const dv = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.1, 0.0025), glassAcrylic, dividers.length);
  dividers.forEach(([y, z], k) => dv.setMatrixAt(k, _m.compose(new THREE.Vector3(cabX + 0.13, y, z), _q.identity(), _s)));
  dv.instanceMatrix.needsUpdate = true; scene.add(dv);
  const ledM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff6e6', emissiveIntensity: 1.1 });
  for (let r = 0; r < ROWS; r++) {
    add(new THREE.BoxGeometry(0.24, 0.014, L + 0.1), new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: 0.35 }), cabX + 0.15, rowY(r) - 0.007, (z0 + z1) / 2); // 层板
    add(new THREE.BoxGeometry(0.004, 0.012, L + 0.1), glassAcrylic, cabX + 0.03, rowY(r) + 0.006, (z0 + z1) / 2);                                       // 前沿挡条（透明）
    const st = add(new THREE.PlaneGeometry(L + 0.1, 0.03), new THREE.MeshStandardMaterial({ map: priceStrip(tagsByRow[r], L + 0.1), roughness: 0.5 }), cabX + 0.026, rowY(r) - 0.016, (z0 + z1) / 2);
    st.rotation.y = -Math.PI / 2; st.castShadow = false;
    if (r > 0) { const led = add(new THREE.BoxGeometry(0.012, 0.004, L + 0.06), ledM, cabX + 0.05, rowY(r) - 0.016, (z0 + z1) / 2); led.castShadow = false; } // 层板底下的灯带，照下一层
  }
  brands.forEach((b, i) => {
    const pos = packPos.get(b.id); if (!pos) return;
    const inst = new THREE.InstancedMesh(atlas.geometry(b, i), atlas.material, pos.length);
    pos.forEach(([x, y, z, lean], k) => inst.setMatrixAt(k, _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_eLean.set(-lean, -Math.PI / 2 + jitter(0.03), 0)), _s)));
    inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.castShadow = true; inst.receiveShadow = true;
    scene.add(inst); pickable(inst, { kind: 'pack', id: b.id, label: b.name });
  });
  pickable(backboard, { kind: 'cigwall', label: `${brands.length} 种` });
  // 玻璃推拉门：四扇，铝框
  const doorGlass = new THREE.MeshStandardMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0.1, envMapIntensity: 2.2, depthWrite: false });
  const alu = new THREE.MeshStandardMaterial({ color: '#c4c8cc', metalness: 0.9, roughness: 0.3 });
  const dW = (cabZ1 - cabZ0) / 4;
  for (let k = 0; k < 4; k++) {
    const zc = cabZ0 + dW * (k + 0.5), xo = k % 2 ? 0 : -0.025;
    const gl = add(new THREE.PlaneGeometry(dW, 1.78), doorGlass, cabX + xo, 1.39, zc); gl.rotation.y = -Math.PI / 2; gl.castShadow = false; gl.receiveShadow = false;
    for (const dz of [-dW / 2, dW / 2]) add(new THREE.BoxGeometry(0.02, 1.8, 0.018), alu, cabX + xo, 1.39, zc + dz).castShadow = false;
  }
  for (const y of [0.5, 2.29]) add(new THREE.BoxGeometry(0.06, 0.02, cabZ1 - cabZ0), alu, cabX - 0.012, y, (cabZ0 + cabZ1) / 2);
  for (let z = -0.6; z <= 2.4; z += 0.75) { const Lt = new THREE.SpotLight('#ffe6c0', 6, 3, 0.7, 0.6, 1.5); Lt.position.set(4.2, 2.6, z); Lt.target.position.set(4.7, 1.2, z); scene.add(Lt, Lt.target); }

  // ---------- 后墙左角：上天台的楼梯门 ----------
  const door = add(new THREE.BoxGeometry(1.0, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: '#3a3d44', metalness: 0.7, roughness: 0.35 }), -4.2, 1.05, -3.98);
  add(new THREE.BoxGeometry(0.06, 0.05, 0.06), steel, -3.85, 1.0, -3.92);
  pickable(door, { kind: 'door', to: 'roof', label: '上天台' }); // 去哪个天台由服务器当前的场景决定
  sign(scene, '', -4.2, 2.35, -3.93, 0, '#1d8a66', '#eafff6', 0.4, true); // 门上只亮一块绿灯牌，不写字
  const exitL = new THREE.PointLight('#5affb0', 1.5, 2.5, 2); exitL.position.set(-4.2, 2.3, -3.7); scene.add(exitL);
  add(new THREE.CircleGeometry(0.14, 32), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#d23a2a'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke(); g.fillStyle = '#777'; g.fillRect(28, 58, 56, 12); g.fillStyle = '#ff7a35'; g.fillRect(84, 58, 10, 12); g.beginPath(); g.moveTo(24, 26); g.lineTo(104, 102); g.stroke(); }) }), -3.45, 1.7, -3.99);

  flushStock();

  const obstacles = [
    { x0: fx0 - 0.05, x1: fx1 + 0.05, z0: -4, z1: -3.18 },   // 冷饮柜
    { x0: -5, x1: -4.1, z0: -2.35, z1: 2.35 },              // 冷藏柜
    { x0: -2.9, x1: -1.9, z0: -2.35, z1: 1.62 }, { x0: -0.7, x1: 0.3, z0: -2.35, z1: 1.62 }, // 货架 + 促销台
    { x0: -4.25, x1: -0.55, z0: 3.45, z1: 4 },              // 杂志架
    { x0: -4.95, x1: -4.15, z0: 3.2, z1: 4 },               // ATM
    { x0: 3.0, x1: 3.8, z0: -0.95, z1: 2.75 },              // 收银台
    { x0: 4.4, x1: 5, z0: -0.95, z1: 2.75 },                // 烟柜（玻璃门在 4.445）
  ];
  const spinSausages = (dt) => { for (const m of sausages) m.rotation.y += dt * 0.6; }; // 滚轴带着烤肠慢慢转
  return { scene, picks, steamAt, door, autoDoor, spinSausages, world: { bounds: [-4.95, 4.95, -3.95, 3.9], obstacles } };
}
