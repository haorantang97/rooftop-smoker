// 其他玩家：Q 版上班族小人（衬衫领带 / 卫衣 / 西装 / 开衫，挂工牌，眼睛半睁有黑眼圈），配合像素风渲染
// 每个部位是一块刚性方块，挂在关节上：髋 → 躯干 → 头；肩 → 肘 → 手；髋 → 膝 → 脚
// 动作是关节角度：站着笔直不动；走路正常摆臂迈腿；坐、躺有固定姿势；抽烟 / 喝东西 / 咳嗽捂胸口用两骨骼 IK 把手送到目标
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCig } from './cigarette.js';
import { makeItem } from './items3d.js';
import { glowTex, rng } from './textures.js';
import { CIG } from '../../public/js/data.js';

// Q 版上班族：圆角方脸，两条半睁的眼睛加淡淡的黑眼圈，肩膀微塌；穿搭四种随机，颜色随机，认不出是谁、也看不出男女
const OUTFITS = [
  { kind: 'shirt', cols: ['#f4f2ec', '#dfe8f2', '#f0e2e2', '#e8eee0'], tie: ['#c95454', '#2f4f8a', '#3a6a4a', '#8a5cc2'], badge: true },   // 衬衫 + 松开的领带 + 工牌
  { kind: 'hoodie', cols: ['#9aa0a8', '#4f7fc9', '#5a6a4a', '#3d404c', '#c98a5a', '#b05a5a'], badge: true },                          // 卫衣 + 工牌
  { kind: 'suit', cols: ['#2f3a52', '#3a3a3e', '#4a3b30', '#3a4a44'], tie: ['#7a2f2f', '#2c2c2a', '#3a4f7a'] },                      // 西装 + 领带
  { kind: 'cardigan', cols: ['#d9c8a8', '#a8a49a', '#7a8a5a', '#c8a8a0'] },                                                       // 开衫 + 衬衫领
];
const PANTS = ['#2a2d3a', '#3a3f55', '#4a3b30', '#1c1c22', '#5a5650'];
const HAIR = ['#1d1a1a', '#3b2a20', '#6b4a2b', '#c9a15a', '#7a2f2f', '#2a2622'];
const SKIN = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];
const HAIRSTYLE = ['short', 'side', 'bob', 'buzz', 'messy', 'grey']; // 按 look.hair 选

// 小像素贴图（最近点采样）：衣服正面的领口、领带、工牌、扣子；脸上的眼睛、黑眼圈、嘴、眼镜
function pixelTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function frontTex(kind, col, tie, badge) { // 32×34，对应躯干正面
  return pixelTex(32, 34, (g) => {
    const dark = new THREE.Color(col).multiplyScalar(0.72).getStyle(), white = '#f6f4ee';
    px(g, 0, 0, 32, 34, col); // 底色就是衣服本身的颜色
    if (kind === 'shirt') {
      px(g, 11, 0, 4, 3, white); px(g, 17, 0, 4, 3, white);                              // 领子
      px(g, 12, 3, 1, 1, '#c8c4b8'); px(g, 19, 3, 1, 1, '#c8c4b8');
      for (let y = 3; y < 18; y++) px(g, 15 + Math.round((y - 3) * 0.12), y, y < 5 ? 2 : 3, 1, tie); // 松开、歪着的领带
      for (let y = 8; y < 32; y += 6) px(g, 16, y, 1, 1, '#b8b4a8');                      // 扣子
    } else if (kind === 'hoodie') {
      px(g, 11, 0, 10, 3, dark); px(g, 13, 3, 1, 7, white); px(g, 18, 3, 1, 6, white);   // 领口 + 抽绳
      px(g, 8, 22, 16, 8, dark); px(g, 8, 22, 16, 1, new THREE.Color(col).multiplyScalar(0.6).getStyle()); // 前兜
    } else if (kind === 'suit') {
      for (let y = 0; y < 14; y++) { px(g, 16 - Math.max(1, 6 - y * 0.45), y, Math.max(2, 12 - y * 0.9), 1, white); } // 里面的白衬衫
      for (let y = 2; y < 14; y++) px(g, 15, y, 2, 1, tie);                                 // 领带
      for (let y = 0; y < 16; y++) { px(g, 9 + y * 0.35, y, 1, 1, dark); px(g, 22 - y * 0.35, y, 1, 1, dark); } // 翻领
      px(g, 15, 18, 2, 1, '#1a1a1a'); px(g, 15, 24, 2, 1, '#1a1a1a');                       // 扣子
    } else {
      for (let y = 0; y < 10; y++) px(g, 16 - Math.max(1, 5 - y * 0.5), y, Math.max(2, 10 - y), 1, white); // V 领里的衬衫
      px(g, 13, 0, 2, 2, white); px(g, 17, 0, 2, 2, white);
      px(g, 15, 10, 2, 24, dark); for (let y = 13; y < 32; y += 5) px(g, 17, y, 1, 1, '#4a4038'); // 门襟 + 扣子
    }
    if (badge) { // 工牌：挂绳 + 卡片
      for (let y = 1; y < 15; y++) { px(g, 10 + y * 0.32, y, 1, 1, '#2f6fc0'); px(g, 22 - y * 0.15, y, 1, 1, '#2f6fc0'); }
      px(g, 19, 15, 6, 8, '#e8f0fa'); px(g, 20, 16, 4, 2, '#2f6fc0'); px(g, 20, 19, 3, 1, '#9aabbd'); px(g, 20, 21, 2, 1, '#9aabbd');
    }
  });
}
function faceTex(skin, glasses) { // 32×32，对应脸的正面：半睁的眼睛、黑眼圈、一道平平的嘴
  return pixelTex(32, 32, (g) => {
    const lid = '#2c2a28', bag = new THREE.Color(skin).lerp(new THREE.Color('#7a6a8a'), 0.35).getStyle();
    g.clearRect(0, 0, 32, 32);
    px(g, 7, 16, 6, 2, lid); px(g, 19, 16, 6, 2, lid);          // 眼皮耷拉着（两像素粗，远处也看得见）
    px(g, 8, 18, 4, 1, lid); px(g, 20, 18, 4, 1, lid);          // 眼珠只露一点
    px(g, 7, 20, 6, 1, bag); px(g, 19, 20, 6, 1, bag);          // 黑眼圈
    px(g, 14, 25, 4, 1, new THREE.Color(skin).multiplyScalar(0.55).getStyle()); // 嘴
    if (glasses) { const f = '#2a2a2a'; for (const x0 of [6, 18]) { px(g, x0, 15, 8, 1, f); px(g, x0, 21, 8, 1, f); px(g, x0, 15, 1, 7, f); px(g, x0 + 7, 15, 1, 7, f); } px(g, 14, 17, 4, 1, f); }
  });
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }; // 0→1 平滑过渡
// 烟盒正面：这包烟压好的像素画（gen/cig/<id>.png），没有就纯色
const packTexCache = new Map(), texLoader = new THREE.TextureLoader();
function packTex(id) {
  if (packTexCache.has(id)) return packTexCache.get(id);
  const t = CIG[id]?.catalog ? texLoader.load(`${import.meta.env.BASE_URL}gen/cig/${id}.png`) : null;
  if (t) { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; }
  packTexCache.set(id, t); return t;
}

// 尺寸（米）：总高约 1.55，头约占三分之一
const HIP_Y = 0.5, THIGH = 0.24, SHIN = 0.22, TORSO = 0.46, HEAD = 0.46, UPPER = 0.2, FORE = 0.19;
export const AVATAR = { HIP_Y, height: 1.55, eye: 1.32 };   // main.js 用 eye 当自己的视线高度，跟别人身高对上

export const peopleReady = Promise.resolve();
export const peopleLoaded = () => true;

// 像素布料：16×16 的小贴图，最近点采样，两三种深浅的方块
const texCache = new Map();
function cloth(color, pattern = 'knit') {
  const key = `${color}|${pattern}`; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); const r = rng(color.length * 13 + pattern.length);
  const base = new THREE.Color(color);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let k = 1 + (r() - 0.5) * 0.08;
    if (pattern === 'knit' && (x + (y >> 1)) % 4 === 0) k *= 0.93;
    if (pattern === 'rib' && x % 2 === 0) k *= 0.88;
    if (pattern === 'denim' && (x + y) % 3 === 0) k *= 0.9;
    const cc = base.clone().multiplyScalar(k); g.fillStyle = `#${cc.getHexString()}`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t); return t;
}
const mat = (color, pattern) => new THREE.MeshStandardMaterial({ map: cloth(color, pattern), roughness: 0.92, metalness: 0 });

// 两骨骼 IK：把 upper→lower→end 这条链的末端拉到 target，肘部朝 pole；只看世界坐标，不依赖本地坐标轴
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function turn(obj, from, to) {
  _q.setFromUnitVectors(from, to);
  obj.getWorldQuaternion(_q2); _q2.premultiply(_q);
  obj.parent.getWorldQuaternion(_pq); obj.quaternion.copy(_pq.invert().multiply(_q2));
  obj.updateMatrixWorld(true);
}
function ik(upper, lower, end, target, pole, w) {
  if (w <= 0.001) return;
  const save0 = upper.quaternion.clone(), save1 = lower.quaternion.clone();
  const S = upper.getWorldPosition(new THREE.Vector3()), E = lower.getWorldPosition(new THREE.Vector3()), W = end.getWorldPosition(new THREE.Vector3());
  const la = E.distanceTo(S), lb = W.distanceTo(E);
  const dir = target.clone().sub(S); const dist = THREE.MathUtils.clamp(dir.length(), 0.05, (la + lb) * 0.995); dir.normalize();
  const cosA = THREE.MathUtils.clamp((la * la + dist * dist - lb * lb) / (2 * la * dist), -1, 1);
  const pd = pole.clone().sub(S); pd.sub(dir.clone().multiplyScalar(pd.dot(dir))).normalize();
  const Edes = S.clone().addScaledVector(dir, la * cosA).addScaledVector(pd, la * Math.sqrt(1 - cosA * cosA));
  turn(upper, E.clone().sub(S).normalize(), Edes.clone().sub(S).normalize());
  const E2 = lower.getWorldPosition(new THREE.Vector3()), W2 = end.getWorldPosition(new THREE.Vector3());
  turn(lower, W2.sub(E2).normalize(), S.clone().addScaledVector(dir, dist).sub(E2).normalize());
  if (w < 0.999) { upper.quaternion.copy(save0.slerp(upper.quaternion, w)); lower.quaternion.copy(save1.slerp(lower.quaternion, w)); upper.updateMatrixWorld(true); }
}

// 第一视角的手也用同一套穿搭颜色（袖子、皮肤）
export function lookColors(L) {
  const OF = OUTFITS[L.hoodie % OUTFITS.length];
  return { sleeve: OF.cols[(L.hoodie + L.pants) % OF.cols.length], skin: SKIN[L.skin % SKIN.length], suit: OF.kind === 'suit' };
}
export function makePerson(p) {
  const L = p.look || { hoodie: 0, skin: 0, hair: 0, pants: 0 };
  const OF = OUTFITS[L.hoodie % OUTFITS.length], col = OF.cols[(L.hoodie + L.pants) % OF.cols.length], tie = OF.tie ? OF.tie[(L.hair + L.hoodie) % OF.tie.length] : null;
  const style = HAIRSTYLE[L.hair % HAIRSTYLE.length], skinC = SKIN[L.skin % SKIN.length], hairC = style === 'grey' ? '#a8acb2' : HAIR[(L.hair + L.skin) % HAIR.length];
  const glasses = (L.skin + L.hair + L.hoodie) % 3 === 0;
  const suit = OF.kind === 'suit';
  const pantsC = suit ? new THREE.Color(col).multiplyScalar(0.9).getStyle() : PANTS[L.pants % PANTS.length];
  const sleeveC = OF.kind === 'shirt' ? col : col;
  const M = {
    top: mat(col, OF.kind === 'hoodie' || OF.kind === 'cardigan' ? 'knit' : 'flat'), cuff: mat(new THREE.Color(col).multiplyScalar(0.82).getStyle(), 'rib'),
    pants: mat(pantsC, suit ? 'flat' : 'denim'), skin: mat(skinC, 'flat'), hair: mat(hairC, 'knit'),
    shoe: mat(suit ? '#3a2a20' : '#2a2a2e', 'flat'), sole: mat(suit ? '#1a1410' : '#e8e6e0', 'flat'),
    front: new THREE.MeshStandardMaterial({ map: frontTex(OF.kind, col, tie, OF.badge), roughness: 0.9 }),
    face: new THREE.MeshStandardMaterial({ map: faceTex(skinC, glasses), transparent: true, roughness: 0.9 }),
  };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const box = (w, h, d, m, parent, x = 0, y = 0, z = 0, r = 0.02) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  // ---------- 腿 ----------
  const hips = joint(body, 0, HIP_Y, 0);
  const legs = [-1, 1].map((sx) => {
    const hip = joint(hips, sx * 0.095, 0, 0);
    box(0.16, THIGH + 0.02, 0.17, M.pants, hip, 0, -THIGH / 2);
    const knee = joint(hip, 0, -THIGH, 0);
    box(0.15, SHIN, 0.16, M.pants, knee, 0, -SHIN / 2 + 0.01);
    const foot = joint(knee, 0, -SHIN, 0);
    box(0.16, 0.07, 0.24, M.shoe, foot, 0, -0.02, -0.035, 0.025);
    box(0.165, 0.025, 0.245, M.sole, foot, 0, -0.05, -0.035, 0.01);
    return { hip, knee, foot };
  });
  // ---------- 躯干：衣服正面贴一层像素贴图（领口、领带、工牌、扣子）----------
  const torso = joint(hips, 0, 0.02, 0);
  box(0.44, TORSO, 0.28, M.top, torso, 0, TORSO / 2, 0, 0.05);
  if (OF.kind === 'hoodie' || OF.kind === 'cardigan') box(0.45, 0.05, 0.29, M.cuff, torso, 0, 0.025, 0, 0.02); // 下摆罗纹
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.43), M.front); front.position.set(0, TORSO * 0.52, -0.1415); front.rotation.y = Math.PI; torso.add(front);
  if (OF.kind === 'hoodie') box(0.36, 0.1, 0.12, M.top, torso, 0, TORSO + 0.01, 0.1, 0.04);             // 背后的帽子
  if (suit) box(0.46, 0.06, 0.3, M.top, torso, 0, TORSO - 0.03, 0, 0.03);                             // 西装垫肩
  // ---------- 头：圆角方脸 + 像素五官（半睁的眼、黑眼圈）+ 头发 ----------
  const neck = joint(torso, 0, TORSO + 0.01, 0);
  const head = joint(neck, 0, 0, 0);
  box(HEAD, HEAD, HEAD * 0.95, M.skin, head, 0, HEAD / 2, 0, 0.12);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(HEAD * 0.86, HEAD * 0.86), M.face); face.position.set(0, HEAD * 0.47, -HEAD * 0.476); face.rotation.y = Math.PI; head.add(face);
  const H = HEAD;
  const capTop = (h) => box(H + 0.024, H * h, H * 0.97 + 0.02, M.hair, head, 0, H - H * h / 2 + 0.012, 0.004, 0.1);
  const back = (h) => box(H + 0.02, H * h, H * 0.36, M.hair, head, 0, H - H * h / 2 + 0.01, H * 0.32, 0.08);
  if (style === 'buzz') { capTop(0.16); back(0.3); }
  else if (style === 'bob') { capTop(0.3); back(0.78); for (const sx of [-1, 1]) box(0.07, H * 0.62, H * 0.8, M.hair, head, sx * (H / 2 + 0.01), H * 0.66, 0.04, 0.03); box(H * 0.92, H * 0.14, 0.05, M.hair, head, 0, H * 0.86, -H * 0.47, 0.02); }
  else if (style === 'side') { capTop(0.28); back(0.55); const f = box(H * 0.7, H * 0.13, 0.05, M.hair, head, -H * 0.12, H * 0.86, -H * 0.47, 0.02); f.rotation.z = 0.22; }
  else if (style === 'messy') { capTop(0.3); back(0.55); const rr = rng(L.hair * 7 + L.skin); for (let i = 0; i < 4; i++) { const t = box(0.09, 0.07, 0.09, M.hair, head, (rr() - 0.5) * H * 0.7, H + 0.03, (rr() - 0.5) * H * 0.6, 0.02); t.rotation.set(rr() - 0.5, rr(), rr() - 0.5); } box(H * 0.86, H * 0.1, 0.05, M.hair, head, 0, H * 0.88, -H * 0.47, 0.02); }
  else if (style === 'grey') { capTop(0.2); back(0.5); for (const sx of [-1, 1]) box(0.05, H * 0.3, H * 0.5, M.hair, head, sx * (H / 2 + 0.008), H * 0.66, 0.08, 0.02); } // 年纪大一点，发际线靠后
  else { capTop(0.28); back(0.55); box(H * 0.9, H * 0.1, 0.05, M.hair, head, 0, H * 0.88, -H * 0.47, 0.02); }
  // ---------- 手臂 ----------
  const arms = [-1, 1].map((sx) => {
    const sh = joint(torso, sx * 0.29, TORSO - 0.07, 0);
    box(0.13, UPPER + 0.02, 0.14, M.top, sh, 0, -UPPER / 2);
    const el = joint(sh, 0, -UPPER, 0);
    box(0.12, FORE, 0.13, M.top, el, 0, -FORE / 2 + 0.01);
    box(0.125, 0.035, 0.135, OF.kind === 'suit' ? mat('#f6f4ee', 'flat') : M.cuff, el, 0, -FORE + 0.02, 0, 0.01); // 袖口（西装露一点白衬衫）
    const hand = joint(el, 0, -FORE, 0);
    box(0.1, 0.1, 0.1, M.skin, hand, 0, -0.045, 0, 0.035);
    const grip = joint(hand, 0, -0.06, -0.05);
    return { sh, el, hand, grip };
  });
  const [AL, AR] = arms;
  // 双人互动用的小道具（挂在左手上）：递给别人的那根烟、给别人点火的打火机和火苗
  const handCig = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.08, 8), mat('#f4f2ec', 'flat'));
  handCig.rotation.z = Math.PI / 2; handCig.position.set(0.035, 0, 0); handCig.visible = false; AL.grip.add(handCig);
  const lighterG = new THREE.Group(); lighterG.visible = false; AL.grip.add(lighterG);
  // 递烟时左手端着的烟盒（正面贴这包烟的像素画）和手里捏着的那根烟；位置每帧按世界坐标摆
  const packFront = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), packSide = new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.5 });
  const packG = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.088, 0.022), [packSide, packSide, packSide, packSide, packFront, packFront]); packG.scale.setScalar(1.35); packG.visible = false; root.add(packG); // Q 版手大，道具放大一点才看得清
  let packId = null;
  const setPack = (id) => { if (id === packId) return; packId = id; const c = CIG[id]; packSide.color.set(c?.pack?.[0] || '#dddddd'); packFront.map = packTex(id); packFront.needsUpdate = true; };
  const heldCig = new THREE.Group(); heldCig.scale.setScalar(1.5); heldCig.visible = false; root.add(heldCig);
  { const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.062, 8), mat('#f4f2ec', 'flat')); body.position.y = 0.031 + 0.022; heldCig.add(body);
    const filt = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.022, 8), mat('#d8a24a', 'flat')); filt.position.y = 0.011; heldCig.add(filt); }
  lighterG.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.055, 0.014), mat('#c8372f', 'flat')));
  const lFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,190,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  lFlame.scale.setScalar(0.07); lFlame.position.y = 0.05; lighterG.add(lFlame);

  // 点人用的隐形胶囊（射线检测便宜）
  const hit = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.78; root.add(hit);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,120,50'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  glow.scale.setScalar(0.06); root.add(glow);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,180,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  flame.scale.setScalar(0.07); root.add(flame);

  let cig = null, brand = null, item = null, itemId = null;
  const tipW = new THREE.Vector3(), mouthW = new THREE.Vector3(), headW = new THREE.Vector3();
  const A = { lhip: [0, 0], rhip: [0, 0], lknee: 0, rknee: 0, lsh: [0, 0], rsh: [0, 0], lel: 0, rel: 0, torso: 0, neck: 0, y: 0, lie: 0 };
  const W = { r: 0, l: 0 };
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  // 把 obj（挂在 root 下）放到世界坐标 pos，自身 Y 轴朝 axis
  const place = (obj, pos, axis, side) => {
    const y = axis.clone().normalize(), x = new THREE.Vector3().crossVectors(y, side).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    tmpM.makeBasis(x, y, z).setPosition(pos); tmpM.premultiply(root.matrixWorld.clone().invert()); tmpM.decompose(obj.position, obj.quaternion, tmpV);
  };

  return {
    root, mouth: null, pickables: [hit],
    update(st, t, dt) {
      if (st.cig && st.brand !== brand) { if (cig) cig.group.removeFromParent(); cig = makeCig(st.brand); brand = st.brand; root.add(cig.group); }
      if (!st.cig && cig) { cig.group.removeFromParent(); cig = null; brand = null; }
      if (st.item !== itemId) { if (item) item.removeFromParent(); item = null; itemId = st.item; if (itemId) { item = makeItem(itemId); root.add(item); } }
      const pose = st.pose || 'stand', seatY = st.seatY || 0;
      // 摆手（拒绝给烟）：共 1 秒，抬手 0.2 秒 → 左右左三下 0.6 秒 → 放下 0.2 秒
      const wE = 1 - (st.waveT || 0), wave = st.waveT > 0 ? Math.max(0, Math.min(1, wE / 0.2, st.waveT / 0.2)) : 0;
      const wSw = wE > 0.2 && wE < 0.8 ? Math.sin((wE - 0.2) / 0.6 * Math.PI * 3) : 0;
      // 双人互动：st.inter = { kind, e: 0..1 进度包络, aim: 对方嘴边（世界坐标）}
      const it = st.inter && st.inter.e > 0.02 ? st.inter : null, ik2 = it?.kind;
      const mouthy = ik2 === 'askFire' || ik2 === 'lightTake' || ik2 === 'tipTake' || ik2 === 'tipGive' || (st.cig && (ik2 === 'give' || ik2 === 'lightGive')); // 自己在抽、又要腾出右手递烟 / 护火：烟先叼上
      const inMouth = wave <= 0 && (mouthy || st.cig === 1 || (st.cig === 2 && (st.puffing || st.flame > 0)));
      const coughT = st.coughT > 0 ? 1.5 - st.coughT : -1;                     // 咳嗽开始后过了多久
      const cough = coughT >= 0 ? Math.min(1, coughT / 0.15) * Math.min(1, st.coughT / 0.3) : 0;
      const jerk = coughT >= 0 ? [0, 0.42, 0.84].reduce((s, c0) => { const u = coughT - c0; return s + (u > 0 && u < 0.35 ? Math.sin(u / 0.35 * Math.PI) : 0); }, 0) : 0;

      // ---------- 目标关节角（弧度）----------
      const T = { lhip: [0, 0], rhip: [0, 0], lknee: 0, rknee: 0, lsh: [0.04, 0], rsh: [0.04, 0], lel: 0.06, rel: 0.06, torso: 0.04, neck: 0.1, y: 0, lie: 0 }; // 下班的样子：肩膀微塌、头有点低（静止，不晃）
      const walk = pose === 'stand' ? (st.walk || 0) : 0, ph = st.walkPhase || 0;
      if (walk > 0.01) { // 正常走路：迈腿、后腿屈膝、反向摆臂、身体轻微起伏
        const s = Math.sin(ph), c = Math.cos(ph);
        T.lhip[0] = s * 0.5 * walk; T.rhip[0] = -s * 0.5 * walk;
        T.lknee = Math.max(0, -c) * 0.7 * walk; T.rknee = Math.max(0, c) * 0.7 * walk;
        T.lsh[0] = -s * 0.4 * walk; T.rsh[0] = s * 0.4 * walk; T.lel = -0.15 * walk; T.rel = -0.15 * walk;
        T.y = Math.abs(c) * 0.025 * walk;
      }
      if (pose === 'sit') { // 坐：大腿水平向前，小腿垂下；坐在地上（seatY≈0）腿往前伸
        const ground = seatY < 0.1;
        T.lhip[0] = T.rhip[0] = ground ? 1.9 : Math.PI / 2; T.lknee = T.rknee = ground ? 0.8 : Math.PI / 2; // 地上：膝盖抬起来，脚在前面着地
        T.lhip[1] = 0.08; T.rhip[1] = -0.08;
        T.y = seatY - HIP_Y + 0.07; T.torso = ground ? -0.12 : -0.06;
        T.lsh[0] = T.rsh[0] = 0.35; T.lel = T.rel = 0.5;
      }
      if (pose === 'lie') { T.lie = 1; T.y = seatY + 0.15; T.lsh[1] = 0.12; T.rsh[1] = -0.12; } // 仰面躺：身体转平，背贴着躺椅或地面
      if (cough > 0) { T.torso += 0.12 * cough + 0.18 * jerk; T.neck = 0.15 * cough + 0.1 * jerk; }
      if (it && (ik2 === 'tipTake' || ik2 === 'tipGive')) { T.torso += 0.22 * it.e; T.neck += 0.1 * it.e; }
      else if (it && ik2 === 'lightTake') { // 借火：对方打火机凑过来以后才往前探身、低头把烟头凑到火上，点着了再直起来
        const w = sm((it.u - 0.15) / 0.2) * (1 - sm((it.u - 0.72) / 0.18));
        T.torso += 0.17 * w; T.neck += 0.3 * w;
      }

      // 平滑过渡；角度约定：正的 hip / sh = 往前抬，正的 knee = 小腿往后弯，正的 el = 前臂往前弯
      const k = 1 - Math.exp(-dt * 10);
      for (const key of Object.keys(T)) { if (Array.isArray(T[key])) { A[key][0] = lerp(A[key][0], T[key][0], k); A[key][1] = lerp(A[key][1], T[key][1], k); } else A[key] = lerp(A[key], T[key], k); }
      legs[0].hip.rotation.set(A.lhip[0], 0, A.lhip[1]); legs[1].hip.rotation.set(A.rhip[0], 0, A.rhip[1]);
      legs[0].knee.rotation.set(-A.lknee, 0, 0); legs[1].knee.rotation.set(-A.rknee, 0, 0);
      AL.sh.rotation.set(A.lsh[0], 0, -A.lsh[1]); AR.sh.rotation.set(A.rsh[0], 0, -A.rsh[1]);
      AL.el.rotation.set(A.lel, 0, 0); AR.el.rotation.set(A.rel, 0, 0);
      torso.rotation.set(-A.torso, 0, 0); neck.rotation.set(-A.neck, 0, 0); // 正的 torso / neck = 往前弯
      body.position.y = A.y; body.rotation.x = A.lie * Math.PI / 2;
      body.position.z = -A.lie * 1.35; // 躺下时头在站的位置，脚朝前伸出去
      root.updateMatrixWorld(true);

      // ---------- 手：IK 到目标（世界坐标）----------
      const q = root.getWorldQuaternion(tmpQ);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const hq = head.getWorldQuaternion(new THREE.Quaternion());
      const hUp = new THREE.Vector3(0, 1, 0).applyQuaternion(hq), hFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(hq);
      head.getWorldPosition(headW);
      mouthW.copy(headW).addScaledVector(hUp, HEAD * 0.32).addScaledVector(hFwd, HEAD * 0.48 + 0.015);   // 脸正面偏下
      const tq = torso.getWorldQuaternion(new THREE.Quaternion());
      const tUp = new THREE.Vector3(0, 1, 0).applyQuaternion(tq), tFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(tq);
      const chest = torso.getWorldPosition(new THREE.Vector3()).addScaledVector(tUp, TORSO * 0.62).addScaledVector(tFwd, 0.15);
      // 双人互动的目标（按动作进度 u 分阶段）：
      //  递烟（give）：左手把烟盒端到胸前 → 右手从盒口抽出一根 → 伸到两人中间递过去 → 松手收回
      //  接烟（take）：等对方抽出烟 → 伸手到两人中间 → 捏住拿回胸前
      //  点火（lightGive）：左手打火机凑到对方烟头下面 → 打着，右手拢在火苗边上挡风 → 点着收回
      //  借火（lightTake）：烟叼着，低头往前把烟头凑到火上（躯干在上面）；左手拢在嘴前
      const toAim = it ? it.aim.clone().sub(chest).setY(0) : null; if (toAim) toAim.normalize();
      const u = it ? (it.u ?? 0.5) : 0;
      let rT = null, lT = null, packAt = null, rCig = false, lCig = false, flameOn = false;
      const handoff = it && (ik2 === 'give' || ik2 === 'take') ? chest.clone().addScaledVector(toAim, clamp(it.aim.clone().sub(chest).setY(0).length() * 0.5, 0.22, 0.45)).addScaledVector(tUp, -0.06) : null;
      if (ik2 === 'give') {
        packAt = chest.clone().addScaledVector(tFwd, 0.2).addScaledVector(tUp, -0.08).addScaledVector(right, -0.03);
        if (u < 0.62) lT = packAt;
        const top = packAt.clone().addScaledVector(tUp, 0.07), pulled = top.clone().addScaledVector(tUp, 0.1);
        if (u > 0.16 && u < 0.88) rT = u < 0.3 ? top : u < 0.45 ? top.clone().lerp(pulled, sm((u - 0.3) / 0.15)) : pulled.clone().lerp(handoff, sm((u - 0.45) / 0.3));
        rCig = u > 0.3 && u < 0.76;
        if (u >= 0.62) packAt = null;
      } else if (ik2 === 'take') {
        const rest = chest.clone().addScaledVector(tFwd, 0.12).addScaledVector(right, st.cig ? -0.2 : 0.2).addScaledVector(tUp, -0.06);
        const tg = u < 0.42 ? null : u < 0.72 ? rest.clone().lerp(handoff, sm((u - 0.42) / 0.3)) : u < 0.8 ? handoff : handoff.clone().lerp(rest, sm((u - 0.8) / 0.18));
        if (st.cig) { lT = tg; lCig = u > 0.75; } else { rT = tg; rCig = u > 0.75; } // 自己手里夹着烟就用左手接
      } else if (ik2 === 'lightGive') {
        const F = it.tip ? it.aim.clone().add(new THREE.Vector3(0, -0.075, 0)) : it.aim.clone().addScaledVector(toAim, -0.02).add(new THREE.Vector3(0, -0.075, 0)); // 火苗顶在烟头正下方
        if (u < 0.86) lT = F;
        flameOn = u > 0.3 && u < 0.84;
        if (u > 0.26 && u < 0.84) rT = F.clone().addScaledVector(right, 0.05).addScaledVector(toAim, 0.015).addScaledVector(tUp, 0.04); // 右手拢着挡风
      } else if (ik2 === 'lightTake') {
        if (u > 0.22 && u < 0.78) lT = mouthW.clone().addScaledVector(hFwd, 0.1).addScaledVector(hUp, -0.04).addScaledVector(right, -0.035);
      } else if (ik2 === 'ask') lT = chest.clone().addScaledVector(toAim, 0.42).addScaledVector(tUp, -0.04).addScaledVector(right, -0.04);
      // 右手：拿烟（抽的时候到嘴边，平时在胸前偏右）
      if (rT) { /* 互动占用了 */ }
      else if (wave > 0) rT = chest.clone().addScaledVector(right, 0.3 + wSw * 0.08).addScaledVector(tUp, 0.32).addScaledVector(tFwd, 0.14); // 右手举到脸旁边，左右摆
      else if (inMouth) rT = mouthW.clone().addScaledVector(hFwd, 0.07).addScaledVector(right, 0.03).addScaledVector(hUp, -0.03);
      else if (st.openT > 0) rT = chest.clone().addScaledVector(tFwd, 0.14).addScaledVector(right, 0.08).addScaledVector(tUp, -0.06);
      else if (cig) rT = chest.clone().addScaledVector(tFwd, 0.12).addScaledVector(right, 0.2).addScaledVector(tUp, -0.06);
      // 左手：互动优先，其次咳嗽捂胸口，再其次喝东西 / 拆包装 / 拿着东西
      if (lT || (it && (ik2 === 'give' || ik2 === 'lightGive' || ik2 === 'take') && !st.cig)) { /* 互动占用了（或在收回） */ }
      else if (cough > 0.05) lT = chest.clone().addScaledVector(right, -0.03).addScaledVector(tFwd, -0.06);
      else if (st.sipT > 0) lT = mouthW.clone().addScaledVector(hFwd, 0.12).addScaledVector(right, -0.04).addScaledVector(hUp, -0.06);
      else if (st.openT > 0) lT = chest.clone().addScaledVector(tFwd, 0.14).addScaledVector(right, -0.08).addScaledVector(tUp, -0.06);
      else if (item) lT = chest.clone().addScaledVector(tFwd, 0.12).addScaledVector(right, -0.2).addScaledVector(tUp, -0.16);
      const kk = 1 - Math.exp(-dt * 9);
      W.r = lerp(W.r, rT ? 1 : 0, kk); W.l = lerp(W.l, lT ? 1 : 0, kk);
      if (rT) W.rt = rT; if (lT) W.lt = lT;
      const poleR = chest.clone().addScaledVector(tUp, -0.5).addScaledVector(right, 0.45).addScaledVector(tFwd, -0.15);
      const poleL = chest.clone().addScaledVector(tUp, -0.5).addScaledVector(right, -0.45).addScaledVector(tFwd, -0.15);
      if (W.rt) ik(AR.sh, AR.el, AR.grip, W.rt, poleR, W.r);
      if (W.lt) ik(AL.sh, AL.el, AL.grip, W.lt, poleL, W.l);
      root.updateMatrixWorld(true);

      // ---------- 烟和手上的东西 ----------
      if (cig) {
        const g = AR.grip.getWorldPosition(new THREE.Vector3());
        if (inMouth) place(cig.group, mouthW, hFwd.clone().addScaledVector(right, 0.35).addScaledVector(hUp, -0.2), hUp); // 过滤嘴在嘴上，烟朝前偏右
        else place(cig.group, g, tFwd.clone().addScaledVector(tUp, 0.5).addScaledVector(right, 0.3), tUp);
        cig.update(st, t);
      }
      if (item) {
        const g = AL.grip.getWorldPosition(new THREE.Vector3()), h = item.userData.height;
        const tilt = st.sipT > 0 && W.l > 0.5 ? hFwd.clone().negate().multiplyScalar(0.9).add(hUp) : tUp.clone();
        place(item, g.clone().addScaledVector(tilt.clone().normalize(), -h * 0.4), tilt, right);
      }
      handCig.visible = false;
      // 递烟用的烟盒（左手端着）、手里捏着的那根烟（右手或左手）
      const pid = st.pack?.id || st.brand;
      if (packAt && pid) { setPack(pid); packG.visible = true; place(packG, AL.grip.getWorldPosition(new THREE.Vector3()).addScaledVector(tUp, 0.03), tUp, tFwd); } else packG.visible = false;
      if (rCig || lCig) { const g = (rCig ? AR.grip : AL.grip).getWorldPosition(new THREE.Vector3()); heldCig.visible = true; place(heldCig, g.addScaledVector(tUp, 0.01), toAim.clone().addScaledVector(tUp, ik2 === 'give' && u < 0.45 ? 2.5 : 0.15).normalize(), tUp); } else heldCig.visible = false;
      lighterG.visible = ik2 === 'lightGive' && u < 0.9; lFlame.material.opacity = flameOn ? 0.75 : 0;
      if (item) item.visible = !(lighterG.visible || packG.visible || ik2 === 'give' || ik2 === 'take' || ik2 === 'ask');
      root.updateMatrixWorld(true);
      if (cig) cig.tip.getWorldPosition(tipW);
      glow.visible = !!cig && st.cig === 2; if (glow.visible) { glow.position.copy(root.worldToLocal(tipW.clone())); glow.material.opacity = st.puffing ? 0.5 : 0.25; glow.scale.setScalar(st.puffing ? 0.055 : 0.035); }
      flame.material.opacity = st.flame > 0 ? 0.6 : 0; if (st.flame > 0) flame.position.copy(root.worldToLocal(tipW.clone())).add(new THREE.Vector3(0, -0.02, 0));
    },
    tip: () => (cig && brand ? tipW : null),
    mouthW: () => mouthW,
    headTop: () => headW.clone().add(new THREE.Vector3(0, HEAD + 0.25, 0)),
    dispose() { root.removeFromParent(); for (const m of Object.values(M)) m.dispose(); },
  };
}
