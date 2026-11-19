// 第一视角的 3D 手（WebXR 开源手模型）+ 袖子 + 烟 + 打火机 + 手上的东西 + 吃喝动作
// 做法：先弯好手指，算出「夹烟点 / 捏东西的点 / 拳心」在手里的位置和朝向，再反推整只手该放在哪里，
// 这样只要说「东西放在镜头前哪里、朝哪」，手就会自然地跟过去
// 吃喝动作：每种动作是一条时间线（USE 表），左手拿东西、右手捏 / 撕 / 拿筷子，右手要干活时烟先叼到嘴上
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeCig } from './cigarette.js';
import { makeItem, makePiece } from './items3d.js';
import { tex, canvasTex } from './textures.js';
import { ITEM, CIG } from '../../public/js/data.js';
import { lookColors } from './people.js';

const SKIN = ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b'];
const HOODIE = ['#c95454', '#4f7fc9', '#5a9e6a', '#d9a441', '#8a5cc2', '#3d404c', '#d77aa0', '#d8d8d8', '#2f7377', '#9b6a43'];
const FINGERS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const CHAIN = (f) => (f === 'thumb' ? ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'] : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip']);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const N = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// 手指弯曲角度（弧度）：[掌指关节, 中间关节, 末端关节]，第四个数是张开角度
const GRIP = {
  smoke: { thumb: [0.35, 0.3, 0.25, 0.25], 'index-finger': [0.22, 0.28, 0.18, 0.1], 'middle-finger': [0.2, 0.3, 0.2, -0.1], 'ring-finger': [0.95, 1.2, 0.7, -0.05], 'pinky-finger': [1.05, 1.25, 0.7, -0.1] },
  pinch: { thumb: [0.6, 0.35, 0.3, 0.6], 'index-finger': [0.6, 0.75, 0.45, 0.05], 'middle-finger': [0.95, 1.05, 0.6, 0], 'ring-finger': [1.15, 1.2, 0.7, 0], 'pinky-finger': [1.2, 1.25, 0.7, -0.05] },
  fist: { thumb: [0.5, 0.35, 0.3, -0.25], 'index-finger': [1.15, 1.25, 0.7, 0], 'middle-finger': [1.2, 1.3, 0.7, 0], 'ring-finger': [1.25, 1.3, 0.7, 0], 'pinky-finger': [1.3, 1.3, 0.7, 0] },
};

// 左手按东西的粗细张开：r 是东西的半径（米），细的接近握拳，粗的（罐子）手指张开包住
const HOLD_OPEN = { thumb: [0.25, 0.15, 0.1, -0.45], 'index-finger': [0.5, 0.55, 0.35, 0], 'middle-finger': [0.55, 0.58, 0.35, 0], 'ring-finger': [0.6, 0.6, 0.35, 0], 'pinky-finger': [0.65, 0.62, 0.35, 0] };
function holdGrip(r) {
  const key = `hold${r.toFixed(3)}`; if (GRIP[key]) return key;
  const t = clamp((r - 0.012) / 0.03, 0, 1), g = {};
  for (const f of FINGERS) g[f] = GRIP.fist[f].map((v, i) => v + (HOLD_OPEN[f][i] - v) * t);
  GRIP[key] = g; return key;
}
// 怎么拿：off 东西中心往手心方向挪多少，k 手握在东西多高处（0 底部，1 顶部），r 握住部分的半径
function holdSpec(id, ud) {
  const shape = ITEM[id]?.look?.[0] || 'can', w = ud.width;
  if (['can', 'tallcan', 'slimcan', 'scan', 'longneck', 'bottle', 'pet', 'cup', 'tube', 'square', 'carton', 'sleeve', 'prism'].includes(shape)) { const r = Math.min(0.038, w / 2.1); return { off: r - 0.016, k: 0.35, r }; }
  if (shape === 'cupnoodle') return { off: 0.022, k: 0.3, r: 0.04 };
  if (['bag', 'pouch', 'onigiri', 'sandwich', 'box'].includes(shape)) return { off: w / 2 - 0.016, k: 0.5, r: 0.016 }; // 捏住左边
  if (shape === 'bar' || shape === 'gum' || shape === 'roll') return { off: 0, k: 0.22, r: 0.013 };            // 握住下面一截
  if (['skewer', 'sausage', 'icebar'].includes(shape)) return { off: 0, k: 0.06, r: 0.006 };                   // 握住签子
  return { off: 0, k: 0.45, r: 0.015 };
}

// ---------- 吃喝动作的时间表（main.js 也用它来放声音、算「打开了 / 吃了一口」）----------
// open：打开的过程落在时间线的哪一段；consume：哪一刻算吃了一口；sound：[时间点, 声音名]
export const USE = {
  tab: { dur: 1.2, open: [0.38, 0.6], sound: [[0.5, 'psst']] },
  cap: { dur: 1.4, open: [0.3, 0.82], sound: [[0.34, 'twist'], [0.6, 'twist']] },
  peel: { dur: 1.4, open: [0.3, 0.8], sound: [[0.34, 'tear']] },
  tear: { dur: 1.3, open: [0.42, 0.58], sound: [[0.45, 'tear']] },
  flap: { dur: 1.2, open: [0.3, 0.72], sound: [[0.32, 'rustle']] },
  sip: { dur: 1.35, consume: 0.55, sound: [[0.5, 'sip']] },
  bite: { dur: 1.1, consume: 0.5, sound: [[0.5, 'bite']] },
  pour: { dur: 1.7, consume: 0.66, sound: [[0.5, 'rustle'], [0.7, 'bite']] },
  pick: { dur: 1.6, consume: 0.72, sound: [[0.3, 'rustle'], [0.74, 'bite']] },
  noodle: { dur: 1.9, consume: 0.74, sound: [[0.72, 'slurp']] },
};

function frame(origin, yAxis, xHint) {
  const y = yAxis.clone().normalize();
  const x = xHint.clone().sub(y.clone().multiplyScalar(xHint.dot(y))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(origin);
}

async function loadHand(side, skinMat) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/hand/${side}.glb`);
  const root = new THREE.Group(); root.add(gltf.scene);
  const bones = {};
  gltf.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) { o.material = skinMat; o.castShadow = true; o.frustumCulled = false; } });
  gltf.scene.updateMatrixWorld(true);
  // WebXR 手的关节是平级的，串成链条才能整根手指一起弯
  for (const f of FINGERS) {
    const names = CHAIN(f).map((k) => `${f}-${k}`);
    bones.wrist.attach(bones[names[0]]);
    for (let i = 1; i < names.length; i++) bones[names[i - 1]].attach(bones[names[i]]);
  }
  const rest = {}; for (const [k, b] of Object.entries(bones)) rest[k] = b.quaternion.clone();
  return { root, bones, rest, side, grip: null };
}

function applyGrip(h, name, sign) {
  if (h.grip === name) return;
  h.grip = name;
  const grip = GRIP[name], q = new THREE.Quaternion();
  for (const f of FINGERS) {
    const names = CHAIN(f).map((k) => `${f}-${k}`), a = grip[f];
    for (let i = 1; i <= 3; i++) {
      const b = h.bones[names[i]]; if (!b) continue;
      b.quaternion.copy(h.rest[names[i]]);
      if (i === 1) b.quaternion.multiply(q.setFromAxisAngle(V(0, 1, 0), a[3] * sign));
      b.quaternion.multiply(q.setFromAxisAngle(V(1, 0, 0), -a[i - 1]));
    }
  }
  h.root.updateMatrixWorld(true);
}
// 关节在手自己的坐标里的位置
function jp(h, name) { const p = new THREE.Vector3(); h.bones[name].getWorldPosition(p); return h.root.worldToLocal(p); }

// 关键帧：frames = [[时间, {pos, up/dir, face/back}], ...]，按时间插值
const clonePose = (a) => { const o = {}; for (const k of Object.keys(a)) o[k] = a[k].clone(); return o; };
function kf(q, frames) {
  if (q <= frames[0][0]) return clonePose(frames[0][1]);
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i], [t0, a] = frames[i - 1];
    if (q <= t1) { const u = ease((q - t0) / Math.max(1e-6, t1 - t0)); const o = {}; for (const k of Object.keys(a)) o[k] = a[k].clone().lerp(b[k], u); return o; }
  }
  return clonePose(frames[frames.length - 1][1]);
}

export async function createHands(camera, look) {
  const skinMat = new THREE.MeshPhysicalMaterial({ color: SKIN[look.skin % 4], roughness: 0.5, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff8a70'), clearcoat: 0.12, clearcoatRoughness: 0.6 });
  const [R, L] = await Promise.all([loadHand('right', skinMat), loadHand('left', skinMat)]);
  const rig = new THREE.Group(); camera.add(rig);
  rig.add(R.root, L.root);

  // ---------- 右手：捏东西（拉环、撕包装、拿筷子）----------
  applyGrip(R, 'pinch', 1);
  const pinchPt = jp(R, 'thumb-tip').add(jp(R, 'index-finger-tip')).multiplyScalar(0.5);
  const fingerDirP = jp(R, 'index-finger-phalanx-distal').sub(jp(R, 'index-finger-metacarpal')).normalize();
  const sideP = jp(R, 'index-finger-metacarpal').sub(jp(R, 'middle-finger-metacarpal')).normalize();
  const dorsalP = new THREE.Vector3().crossVectors(fingerDirP, sideP).normalize();
  const anchorRP = frame(pinchPt, fingerDirP, dorsalP), anchorRPInv = anchorRP.clone().invert();

  // ---------- 右手：夹烟 ----------
  applyGrip(R, 'smoke', 1);
  const iI = jp(R, 'index-finger-phalanx-intermediate'), mI = jp(R, 'middle-finger-phalanx-intermediate');
  const iD = jp(R, 'index-finger-phalanx-distal'), mD = jp(R, 'middle-finger-phalanx-distal');
  const iP = jp(R, 'index-finger-phalanx-proximal'), mP = jp(R, 'middle-finger-phalanx-proximal');
  const grip = iI.clone().add(mI).multiplyScalar(0.5).lerp(iD.clone().add(mD).multiplyScalar(0.5), 0.25);
  const fingerDirR = iI.clone().add(mI).sub(iP).sub(mP).normalize();
  const sideR = iI.clone().sub(mI).normalize();
  const dorsalR = new THREE.Vector3().crossVectors(fingerDirR, sideR).normalize();
  const anchorR = frame(grip.clone().sub(dorsalR.clone().multiplyScalar(0.016)), dorsalR, fingerDirR);
  const anchorRInv = anchorR.clone().invert();

  // ---------- 左手：握拳（打火机 / 手上的东西）----------
  applyGrip(L, 'fist', -1);
  const lm = ['index-finger-metacarpal', 'pinky-finger-metacarpal', 'index-finger-phalanx-proximal', 'pinky-finger-phalanx-proximal'].map((n) => jp(L, n));
  const palm = lm.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
  const fingerDirL = jp(L, 'middle-finger-phalanx-proximal').sub(jp(L, 'middle-finger-metacarpal')).normalize();
  const sideL = jp(L, 'index-finger-metacarpal').sub(jp(L, 'pinky-finger-metacarpal')).normalize();
  const palmarL = new THREE.Vector3().crossVectors(fingerDirL, sideL).normalize();
  const fistC = palm.clone().add(palmarL.clone().multiplyScalar(0.026)).add(fingerDirL.clone().multiplyScalar(0.035));
  const anchorL = frame(fistC, sideL, palmarL);   // 原点 = 拳心，Y = 拳头竖着的方向（朝食指那边）
  const anchorLInv = anchorL.clone().invert();

  // ---------- Q 版手：藏起写实手的模型，换成圆角手掌 + 大拇指（跟别人眼里的小人同款）----------
  // 掌骨的位置不随手指弯曲变化，按它摆手掌，夹烟 / 捏东西 / 握拳的定位点照旧
  // 卡通三档明暗（亮 / 中 / 暗），Q 版的手指、手掌、拇指轮廓才分得清；色阶贴图用最近邻采样，不做渐变
  const toonRamp = new THREE.DataTexture(new Uint8Array([140, 140, 140, 255, 192, 192, 192, 255, 225, 225, 225, 255]), 3, 1);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;
  const flatSkin = new THREE.MeshToonMaterial({ color: lookColors(look).skin, gradientMap: toonRamp });
  const mitten = (h, tip) => {
    h.root.traverse((o) => { if (o.isSkinnedMesh) o.visible = false; });
    const wrist = jp(h, 'wrist'), knuckle = jp(h, 'middle-finger-phalanx-proximal');
    const idx = jp(h, 'index-finger-metacarpal'), pk = jp(h, 'pinky-finger-metacarpal');
    const dir = knuckle.clone().sub(wrist), len = dir.length(); dir.normalize();
    const side = idx.clone().sub(pk), width = side.length() * 1.55 + 0.02; side.normalize();
    // 左手：连指手套，手掌一直伸到指尖；右手（split）：手掌只到指根，手指另外做成两块，中间夹烟
    const a0 = -len * 0.06, a1 = tip ? len * 1.08 : len * 1.88;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(width, a1 - a0, 0.05, 3, 0.022), flatSkin);
    palm.matrixAutoUpdate = false; palm.matrix.copy(frame(wrist.clone().addScaledVector(dir, (a0 + a1) / 2), dir, side)); palm.castShadow = true; h.root.add(palm);
    const tb = jp(h, 'thumb-metacarpal'), tt = jp(h, 'thumb-phalanx-proximal');
    const td = tt.clone().sub(tb), tl = td.length(); td.normalize();
    const thumb = new THREE.Mesh(new RoundedBoxGeometry(0.032, tl * 1.9 + 0.02, 0.034, 2, 0.013), flatSkin);
    thumb.matrixAutoUpdate = false; thumb.matrix.copy(frame(tb.clone().addScaledVector(td, tl * 1.0), td, side)); thumb.castShadow = true; h.root.add(thumb);
  };
  mitten(R, true); mitten(L);
  // 右手手指：食指一块、中指到小指一块，两块中间留一道缝，烟正好夹在缝里（烟的位置 grip 就在食指和中指之间）
  {
    const kn = iP.clone().add(mP).multiplyScalar(0.5);
    const f0 = kn.clone().sub(grip).dot(fingerDirR) - 0.012, f1 = 0.026; // 从指根到烟再往前一点（指尖）
    const FL = f1 - f0, GAP = 0.0065, WI = 0.025, WO = 0.048, TH = 0.03;
    const block = (w, off) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, FL, TH, 2, 0.011), flatSkin);
      m.matrixAutoUpdate = false; m.matrix.copy(frame(grip.clone().addScaledVector(sideR, off).addScaledVector(fingerDirR, (f0 + f1) / 2), fingerDirR, sideR));
      m.castShadow = true; R.root.add(m);
    };
    block(WI, GAP / 2 + WI / 2);   // 食指
    block(WO, -(GAP / 2 + WO / 2)); // 中指到小指
  }

  // ---------- 袖子：方方的布料袖，颜色跟你的穿搭一致 ----------
  const lc = lookColors(look);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: lc.sleeve, roughness: 0.92 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: lc.suit ? '#f6f4ee' : new THREE.Color(lc.sleeve).multiplyScalar(0.82), roughness: 0.92 });
  // 手和袖子的本色；夜里按夜色压暗（天台灯串离手只有两三米，浅色的手会被照得发白、再被泛光放大成一团）
  const base = { skin: flatSkin.color.clone(), sleeve: sleeveMat.color.clone(), cuff: cuffMat.color.clone() };
  const shade = (night) => { const k = 1 - 0.45 * night; flatSkin.color.copy(base.skin).multiplyScalar(k); sleeveMat.color.copy(base.sleeve).multiplyScalar(k); cuffMat.color.copy(base.cuff).multiplyScalar(k); };
  const sleeve = (h, fingerDir) => {
    const wrist = jp(h, 'wrist'), back = fingerDir.clone().negate();
    const s = new THREE.Group(); s.position.copy(wrist).add(back.clone().multiplyScalar(0.012));
    s.quaternion.setFromUnitVectors(V(0, 1, 0), back);
    const arm = new RoundedBoxGeometry(0.105, 0.36, 0.115, 2, 0.025); arm.translate(0, 0.2, 0); // 袖子别太长：手往前递时不会一路伸到镜头跟前糊住半边画面
    const a = new THREE.Mesh(arm, sleeveMat); a.castShadow = true; s.add(a);
    const cuff = new THREE.Mesh(new RoundedBoxGeometry(0.112, 0.05, 0.122, 2, 0.015), cuffMat); cuff.position.y = 0.03; s.add(cuff);
    h.root.add(s); return s;
  };
  sleeve(R, fingerDirR); const sleeveL = sleeve(L, fingerDirL);

  // ---------- 打火机 ----------
  // 递给别人的那根烟：挂在左手拳心，横着从虎口露出来
  const giveCig = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.084, 10), new THREE.MeshStandardMaterial({ color: '#f6f4ee', roughness: 0.8 }));
  giveCig.matrixAutoUpdate = false; giveCig.matrix.copy(anchorL).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, 0.03, 0));
  giveCig.visible = false; L.root.add(giveCig);
  const lighter = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.025, 0.066, 0.012, 3, 0.004), new THREE.MeshPhysicalMaterial({ color: '#c43c3c', roughness: 0.25, clearcoat: 1 }));
  body.position.y = -0.045; lighter.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.0125), new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.3 }));
  hood.position.y = -0.006; lighter.add(hood);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 16), new THREE.MeshStandardMaterial({ color: '#6a6e76', metalness: 1, roughness: 0.4 }));
  wheel.rotation.z = Math.PI / 2; wheel.position.set(0.006, 0.002, 0); lighter.add(wheel);
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uOn; varying vec2 vUv;
      void main(){ vec2 p = vUv - vec2(.5, 0.); float sway = sin(uTime*13. + p.y*6.) * .035 * p.y;
        p.x += sway; float w = (1. - p.y) * .34 * (.9 + .1*sin(uTime*29.));
        float d = abs(p.x) / max(w, .001); float a = smoothstep(1., .2, d) * smoothstep(1., .55, p.y) * smoothstep(0., .08, p.y);
        vec3 col = mix(vec3(.25,.45,1.), vec3(1.,.55,.15), smoothstep(.02,.22,p.y)); col = mix(col, vec3(1.,.95,.75), smoothstep(.6,.0,d) * smoothstep(.75,.15,p.y));
        gl_FragColor = vec4(col * 1.0, a * uOn); }`,
  });
  const flame = new THREE.Group();
  for (const r of [0, Math.PI / 2]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.042), flameMat); pl.position.y = 0.021; pl.rotation.y = r; flame.add(pl); }
  lighter.add(flame);
  const flameLight = new THREE.PointLight('#ffa040', 0, 2.5, 2); flameLight.position.y = 0.02; lighter.add(flameLight);
  L.root.add(lighter);
  lighter.matrixAutoUpdate = false;
  lighter.matrix.copy(anchorL).multiply(new THREE.Matrix4().makeTranslation(0, 0.024, 0));

  // ---------- 右手捏着的东西：筷子、面条、一小块零食 ----------
  const held = new THREE.Group(); held.matrixAutoUpdate = false; held.matrix.copy(anchorRP); R.root.add(held);
  const STICK = 0.15, SA = 0.9; // 捏点到筷子尖；筷子相对手指往手心那边斜 SA 弧度（手指平着，筷子朝下）
  const chopsticks = new THREE.Group(); chopsticks.rotation.z = SA; held.add(chopsticks);
  const woodM = new THREE.MeshStandardMaterial({ color: '#d9b98a', roughness: 0.7 });
  for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.0018, 0.0032, 0.23, 8); g.translate(0, 0.045, 0); const m = new THREE.Mesh(g, woodM); m.position.x = s * 0.004; m.rotation.z = s * 0.02; chopsticks.add(m); }
  const strands = new THREE.Group(); strands.position.y = STICK; chopsticks.add(strands);
  { const nm = new THREE.MeshStandardMaterial({ color: '#e8c06a', roughness: 0.55 }); for (let i = 0; i < 7; i++) { const pts = []; for (let k = 0; k <= 8; k++) pts.push(V((i - 3) * 0.0015 + Math.sin(k + i) * 0.002, -k * 0.009, Math.cos(k * 1.3 + i) * 0.003)); strands.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0011, 5), nm)); } }
  chopsticks.visible = false;
  let piece = null, pieceKind = null;
  // 递烟 / 接烟：右手捏着的那根烟（过滤嘴在指尖）；递烟时左手端着的烟盒（正面贴这包烟的像素画）
  const fpCig = new THREE.Group(); fpCig.visible = false; held.add(fpCig);
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.062, 10), new THREE.MeshStandardMaterial({ color: '#f6f4ee', roughness: 0.8 })); b.position.y = 0.053; fpCig.add(b);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.022, 10), new THREE.MeshStandardMaterial({ color: '#d8a24a', roughness: 0.7 })); f.position.y = 0.011; fpCig.add(f); }
  const fpPackFront = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), fpPackSide = new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.5 });
  const fpPack = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.088, 0.022), [fpPackSide, fpPackSide, fpPackSide, fpPackSide, fpPackFront, fpPackFront]);
  fpPack.matrixAutoUpdate = false; fpPack.matrix.copy(anchorL).multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); fpPack.visible = false; L.root.add(fpPack); // 大半截露在拳头上面
  let fpPackId = null; const texL = new THREE.TextureLoader();
  const setFpPack = (id) => { if (!id || id === fpPackId) return; fpPackId = id; fpPackSide.color.set(CIG[id]?.pack?.[0] || '#dddddd'); fpPackFront.map = CIG[id]?.catalog ? texL.load(`${import.meta.env.BASE_URL}gen/cig/${id}.png`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; }) : null; fpPackFront.needsUpdate = true; };

  // 倒薯片时掉出来的碎片（颜色跟着手上的东西）
  const CRUMB = { chips: ['#f2c45a'], shrimp: ['#f0b070'], chips_tri: ['#f29a2a', '#e8801c'], puffs: ['#f2781c'], choco_dots: ['#d6202a', '#1d6fd8', '#22a24a', '#f2781c', '#ffd21f', '#5a3020'] };
  let crumbFor = null;
  const crumbs = []; for (let i = 0; i < 10; i++) { const m = makePiece('chip'); m.scale.setScalar(0.7); m.visible = false; rig.add(m); crumbs.push({ m, v: new THREE.Vector3(), life: 0 }); }

  // ---------- 烟、手上的东西、指尖火光 ----------
  let cig = null, cigBrand = null, item = null, itemId = null;
  const emberLight = new THREE.PointLight('#ff6a20', 0, 1.2, 2); rig.add(emberLight);
  const fill = new THREE.PointLight('#ffd8b0', 0, 3, 2); fill.position.set(0.6, 0.5, 0.4); camera.add(fill); // 离镜头远一点，凑到脸前的东西才不会被打爆

  // 镜头坐标里的姿势（米）：烟的过滤嘴位置、烟的朝向、手指的大致朝向
  // 真实的嘴在眼睛下方 9 厘米、几乎贴着镜头，完全在画面外；第一视角游戏的惯例是把「嘴」往前挪到画面下沿，
  // 这样凑到嘴边的动作（喝、咬、吸烟、夹面）都看得见
  const MOUTH = V(0.004, -0.078, -0.11);
  const CIG_ASIDE = new THREE.Matrix4().makeRotationZ(-0.5).multiply(new THREE.Matrix4().makeRotationX(0.35)); // 吃东西时烟在指缝里往外侧偏一点
  // 视野 70°：深度 d 处画面上下各 0.7d。底部中间是按钮栏（横向约占中间三分之一、最下面一成）：
  // 平时两只手从屏幕下边伸进来，右手在按钮栏右边、左手在左边，手腕和袖子往下出画面；
  // 抽烟 / 点火不贴到真正的嘴上（那在镜头正下方、画面外），而是举到画面下半部中间（按钮栏上方）
  const P = {
    stand: {
      rest: { pos: V(0.2, -0.19, -0.4), axis: V(0.5, 0.42, -0.76), finger: V(-0.3, 0.9, -0.2) }, // 烟从掌心穿过指缝、从手背伸出：右手手背朝右外侧，烟头往外（右前上方）伸，看到虎口那面和整根烟
      mouth: { pos: V(0.045, -0.085, -0.27), axis: V(-0.34, 0.24, -0.91), finger: V(-0.55, 0.8, 0.1) }, // 吸的时候烧着的那头朝左前上方斜出去，从手的左边露出来
    },
    lie: {
      rest: { pos: V(0.2, -0.17, -0.4), axis: V(0.5, 0.42, -0.76), finger: V(-0.3, 0.9, -0.2) },
      mouth: { pos: V(0.045, -0.08, -0.27), axis: V(-0.32, 0.24, -0.92), finger: V(-0.55, 0.8, 0.1) },
    },
  };
  const DANGLE = { pos: MOUTH.clone().add(V(0.008, 0.002, 0)), axis: N(0.12, -0.4, -0.9), finger: V(-0.5, 0.5, 0.2) }; // 烟叼在嘴上
  const L_REST = { pos: V(-0.22, -0.2, -0.44), up: V(0.12, 1, 0.12), face: V(0.75, 0, 0.6) };
  const CLUTCH = { pos: V(-0.02, -0.3, -0.24), up: V(0.55, 0.75, 0.35), face: V(0.15, 0.1, 1) }; // 咳嗽：拳头按在胸口
  const R_OUT = { pos: V(0.2, -0.4, -0.45), dir: N(-0.4, 0.4, -0.8), back: V(0.4, 0.9, 0.1) };
  const LH = (pos, up, face = V(1, 0, 0.12)) => ({ pos, up: up.clone().normalize(), face });
  const RH = (pos, dir, back) => ({ pos, dir: dir.clone().normalize(), back });

  // 某个动作在时间点 q 时，左右手应该在哪（ctx：东西的高、宽、吃掉多少）
  function actionPose(use, q, ctx) {
    const { h, w, eaten, off, k: hk } = ctx;
    const side = (l) => { const u = l.up.clone().normalize(); return l.face.clone().sub(u.multiplyScalar(l.face.dot(u))).normalize(); }; // 手心方向
    const topOf = (l) => l.pos.clone().add(l.up.clone().normalize().multiplyScalar((1 - hk) * h)).addScaledVector(side(l), off);
    const toMouth = (up, extra = V(0, 0, 0), hh = h, face = V(1, 0, 0.1)) => { const l = { up, face }; return MOUTH.clone().add(extra).sub(up.clone().normalize().multiplyScalar((1 - hk) * hh)).addScaledVector(side(l), -off); };
    const out = { L: null, R: null, tilt: 0, open: 0, piece: false, sticks: false, strands: false, pour: false };
    const k = use.kind;
    if (k === 'tab' || k === 'cap') {
      const C = LH(V(-0.06, -0.22, -0.36), V(0.02, 1, 0.2));
      out.L = kf(q, [[0, L_REST], [0.25, C], [0.8, C], [1, L_REST]]);
      const T = topOf(C);
      const AT = RH(T.clone().add(V(0.012, 0.006, 0.012)), V(-0.6, 0.15, -0.78), V(0.25, 0.9, 0.35));
      if (k === 'tab') {
        const FLICK = RH(T.clone().add(V(0.012, 0.03, 0.004)), V(-0.55, 0.38, -0.75), V(0.25, 0.9, 0.35));
        out.R = kf(q, [[0.08, R_OUT], [0.35, AT], [0.5, FLICK], [0.62, AT], [0.9, R_OUT]]);
      } else {
        out.R = kf(q, [[0.08, R_OUT], [0.3, AT], [0.82, AT], [0.95, R_OUT]]);
        if (q > 0.3 && q < 0.82) out.R.back = out.R.back.clone().applyAxisAngle(C.up, Math.sin((q - 0.3) / 0.52 * Math.PI * 3) * 0.6); // 拧
        if (q > 0.82) out.R.pos.y += (q - 0.82) * 0.15;
      }
    } else if (k === 'peel' || k === 'flap') {
      const C = LH(V(-0.05, -0.2, -0.36), V(0, 1, 0.45));
      out.L = kf(q, [[0, L_REST], [0.25, C], [0.85, C], [1, L_REST]]);
      const T = topOf(C);
      const EDGE = RH(T.clone().add(V(0.004, 0.006, 0.042)), V(-0.4, 0.2, -0.9), V(0.2, 0.95, 0.15));
      const DONE = RH(T.clone().add(V(0.004, 0.075, -0.02)), V(-0.35, 0.38, -0.86), V(0.2, 0.95, 0.15));
      out.R = kf(q, [[0.08, R_OUT], [0.3, EDGE], [0.8, DONE], [0.98, R_OUT]]);
    } else if (k === 'tear') {
      const C = LH(V(-0.05, -0.2, -0.34), V(0, 1, 0.12));
      const Y = LH(V(-0.075, -0.215, -0.34), V(-0.15, 1, 0.12));
      out.L = kf(q, [[0, L_REST], [0.28, C], [0.45, C], [0.56, Y], [0.82, C], [1, L_REST]]);
      const corner = topOf(C).add(V(w / 2 - 0.012, -0.012, 0.012));
      const PINCH = RH(corner, V(-0.25, 0.55, -0.8), V(0.65, 0.2, 0.73));
      const PULL = RH(corner.clone().add(V(0.075, 0.028, 0.015)), V(0.25, 0.6, -0.75), V(0.72, 0, 0.7));
      out.R = kf(q, [[0.08, R_OUT], [0.38, PINCH], [0.56, PULL], [0.9, R_OUT]]);
    } else if (k === 'sip') {
      const up = N(0.08, 0.4, 0.9).lerp(N(0.05, -0.15, 1), eaten).normalize();
      const SIP = LH(toMouth(up, V(0, 0, -0.008)), up, V(1, 0, 0.1));
      out.L = kf(q, [[0, L_REST], [0.4, SIP], [0.7, SIP], [1, L_REST]]);
      out.tilt = Math.sin(clamp((q - 0.25) / 0.6, 0, 1) * Math.PI) * (0.08 + eaten * 0.3);
    } else if (k === 'bite') {
      const up = N(0.05, 0.5, 0.86), hh = h * (1 - 0.5 * eaten);
      const B = LH(toMouth(up, V(0, 0, -0.016), hh), up, V(1, 0, 0.1));
      out.L = kf(q, [[0, L_REST], [0.42, B], [0.58, B], [1, L_REST]]);
      if (q > 0.45 && q < 0.6) out.L.pos.z -= Math.sin((q - 0.45) / 0.15 * Math.PI) * 0.012; // 咬下去往外一扯
    } else if (k === 'pour') {
      const up = N(0.3, -0.45, 0.84);   // 袋口斜着朝嘴，袋底在左上方，能看到袋子在倒
      const LIFT = LH(V(-0.06, -0.13, -0.32), V(0.1, 1, 0.25));
      const POUR = LH(toMouth(up, V(-0.02, 0.05, -0.12)), up, V(0.85, 0.3, 0.2));
      out.L = kf(q, [[0, L_REST], [0.3, LIFT], [0.5, POUR], [0.78, POUR], [1, L_REST]]);
      out.tilt = Math.sin(clamp((q - 0.3) / 0.6, 0, 1) * Math.PI) * 0.38;
      out.pour = q > 0.5 && q < 0.74;
    } else if (k === 'pick') {
      const C = LH(V(-0.06, -0.23, -0.33), V(0, 1, 0.35));
      out.L = kf(q, [[0, L_REST], [0.2, C], [0.62, C], [1, L_REST]]);
      const IN = RH(topOf(C).add(V(0.004, 0.012, 0.004)), V(-0.45, 0.05, -0.89), V(0.3, 0.9, 0.3));
      const AT = RH(MOUTH.clone().add(V(0.016, -0.004, -0.036)), V(-0.45, 0.3, -0.85), V(0.5, 0.7, 0.4));
      out.R = kf(q, [[0.05, R_OUT], [0.3, IN], [0.38, IN], [0.68, AT], [0.76, AT], [0.98, R_OUT]]);
      out.piece = q > 0.36 && q < 0.74;
    } else if (k === 'noodle') {
      const up = N(0, 0.86, 0.5);
      const CUP = LH(toMouth(up, V(-0.02, -0.095, -0.17)), up);
      const stickDir = (r) => { const b = r.back.clone().sub(r.dir.clone().multiplyScalar(r.back.dot(r.dir))).normalize(); return r.dir.clone().multiplyScalar(Math.cos(SA)).addScaledVector(b, -Math.sin(SA)).normalize(); };
      const holdAt = (tip, dir, back) => { const r = RH(V(0, 0, 0), dir, back); r.pos = tip.clone().sub(stickDir(r).multiplyScalar(STICK)); return r; };
      out.L = kf(q, [[0, L_REST], [0.25, CUP], [0.85, CUP], [1, L_REST]]);
      const DIP = holdAt(topOf(CUP).sub(up.clone().multiplyScalar(0.03)), V(-0.5, 0.12, -0.86), V(0.1, 0.95, 0.2));   // 手平着，筷子朝下伸进杯里
      const LIFT = holdAt(MOUTH.clone().add(V(0.005, 0.012, -0.09)), V(-0.2, 0.5, 0.84), V(0.3, 0.3, -0.9));    // 手腕翻过来，筷子尖停在嘴前，面条垂下来
      out.R = kf(q, [[0.05, R_OUT], [0.3, DIP], [0.42, DIP], [0.68, LIFT], [0.78, LIFT], [0.98, R_OUT]]);
      out.sticks = q > 0.04 && q < 0.99; out.strands = q > 0.42 && q < 0.78;
      out.tilt = 0.05;
    }
    const o = USE[k]?.open; if (o) out.open = clamp((q - o[0]) / (o[1] - o[0]), 0, 1);
    return out;
  }

  const tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3();
  // 竖屏手机画面很窄：两只手往中间收（只挪位置、不改手的样子；靠近嘴边的位置 x 本来就小，基本不动）
  const squeeze = () => { const half = 0.4 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect; return Math.max(0.42, Math.min(1, (half * 0.88) / 0.24)); };
  const place = (h, anchorInv, origin, yAxis, xHint) => {
    const k = squeeze(); if (k < 1) { origin = origin.clone(); origin.x *= k; }
    tmpM.copy(frame(origin, yAxis, xHint)).multiply(anchorInv);
    tmpM.decompose(h.root.position, h.root.quaternion, tmpS);
  };
  const lerpPose = (a, b, t) => ({ pos: a.pos.clone().lerp(b.pos, t), axis: a.axis.clone().normalize().lerp(b.axis.clone().normalize(), t), finger: a.finger.clone().normalize().lerp(b.finger.clone().normalize(), t) });
  const tipCam = new THREE.Vector3(), tmpW = new THREE.Vector3();
  let cigInMouth = false, hold = { off: 0, k: 0.45, r: 0.015 };
  const itemTop = new THREE.Object3D();

  return {
    rig, R, L,
    // fp.use = { kind, t, dur } 正在做的吃喝动作；fp.openP / fp.eaten 是手上东西的状态
    update(fp, me, t, opts) {
      const mode = me.pose === 'lie' ? 'lie' : 'stand';
      if (me.cig && me.brand !== cigBrand) { if (cig) cig.group.removeFromParent(); cig = makeCig(me.brand); cigBrand = me.brand; R.root.add(cig.group); cig.group.matrixAutoUpdate = false; cig.group.matrix.copy(anchorR); cigInMouth = false; }
      if (!me.cig && cig) { cig.group.removeFromParent(); cig = null; cigBrand = null; }
      if (me.item !== itemId) {
        if (item) L.root.remove(item); item = null; itemId = me.item;
        if (itemId) { item = makeItem(itemId); item.matrixAutoUpdate = false; const h = item.userData.height; hold = holdSpec(itemId, item.userData); item.matrix.copy(anchorL).multiply(new THREE.Matrix4().makeTranslation(hold.off, -h * hold.k, 0)); L.root.add(item); item.add(itemTop); itemTop.position.set(0, h, 0); }
      }
      if (item) { item.userData.setOpen(fp.openP || 0); item.userData.setEaten(fp.eaten || 0); }
      if (itemId !== crumbFor) { // 倒出来的碎片换成这样东西的颜色
        crumbFor = itemId; const cols = CRUMB[itemId] || CRUMB.chips;
        crumbs.forEach((c, i) => c.m.material.color.set(cols[i % cols.length]));
      }

      // 递烟 / 接烟（第一人称）：按进度 u 分阶段
      //  递：左手把烟盒端到画面左下 → 右手（自己的烟先叼上）从盒口抽出一根 → 伸到两人中间 → 松手收回
      //  接：等对方抽出烟 → 右手伸到两人中间 → 捏住拿回来
      const it0 = opts.inter && opts.inter.e > 0.02 ? opts.inter : null, iu = it0 ? (it0.u ?? 0.5) : 0;
      let iAct = null, showPack = false, showCig = false;
      if (it0 && (it0.kind === 'give' || it0.kind === 'take')) {
        const mid = it0.aim.clone(); mid.y -= 0.25; if (mid.length() > 0.42) mid.setLength(0.42); mid.y = clamp(mid.y, -0.24, -0.12);
        const OUTH = RH(mid.clone().add(V(0.03, 0, 0)), N(-0.15, 0.15, -1), V(0.2, 0.95, 0.15));
        if (it0.kind === 'give') {
          // 烟盒端在画面左下、盒口朝上露出拳头；抽烟的手只到画面下半部，不挡对方的脸
          const PACK = LH(V(-0.11, -0.165, -0.4), V(0.15, 1, 0.35), V(0.3, 0, 1));
          const top = PACK.pos.clone().addScaledVector(PACK.up, 0.095);
          const AT = RH(top.clone().add(V(0.01, 0.006, 0.004)), N(-0.5, 0.25, -0.83), V(0.3, 0.9, 0.3));
          const PULL = RH(top.clone().add(V(0.03, 0.05, 0.0)), N(-0.4, 0.4, -0.82), V(0.3, 0.9, 0.3));
          iAct = { L: kf(iu, [[0, L_REST], [0.15, PACK], [0.55, PACK], [0.7, L_REST]]), R: kf(iu, [[0.1, R_OUT], [0.28, AT], [0.42, PULL], [0.72, OUTH], [0.82, OUTH], [0.97, R_OUT]]) };
          showPack = iu < 0.66; showCig = iu > 0.3 && iu < 0.76;
          setFpPack(me.pack?.id || me.lastBrand || me.brand);
        } else {
          iAct = { L: null, R: kf(iu, [[0.38, R_OUT], [0.7, OUTH], [0.78, OUTH], [0.96, R_OUT]]) };
          showCig = iu > 0.75 && iu < 0.95;
        }
      }
      // 被点火：烟叼在嘴上、夹烟的手放下去，别挡住对方凑过来的打火机（低头探身在 main.js 的镜头里做）
      if (it0 && it0.kind === 'lightTake' && cig && iu > 0.08 && iu < 0.86) iAct = { L: null, R: clonePose(R_OUT) };
      fpPack.visible = showPack; fpCig.visible = showCig;
      const use = fp.use && item && !iAct ? fp.use : null;
      const q = use ? clamp(use.t / use.dur, 0, 1) : 0;
      const act = iAct || (use ? actionPose(use, q, { h: item.userData.height, w: item.userData.width, eaten: fp.eaten || 0, off: hold.off, k: hold.k }) : null);
      if (act && use && use.isOpen) item.userData.setOpen(act.open); // 正在打开：跟着动作走
      const sway = V(Math.sin(t * 0.7) * 0.004, Math.sin(t * 1.1) * 0.003, 0);
      rig.position.copy(opts.shake || V(0, 0, 0));

      // ---------- 右手 ----------
      if (act && act.R) {
        applyGrip(R, 'pinch', 1);
        R.root.visible = true;
        place(R, anchorRPInv, act.R.pos.clone().add(sway), act.R.dir, act.R.back);
        // 右手要干活：吃零食 / 开包装时烟还夹在指缝里跟着手走（烟头往外侧偏开，不戳到食物和脸）；借火这种双人动作才叼到嘴上
        if (cig && use) { if (cigInMouth) { R.root.add(cig.group); cigInMouth = false; } cig.group.matrix.copy(anchorR).multiply(CIG_ASIDE); }
        else {
          if (cig && !cigInMouth) { rig.add(cig.group); cigInMouth = true; }
          if (cig) cig.group.matrix.copy(frame(DANGLE.pos, DANGLE.axis, DANGLE.finger));
        }
      } else {
        applyGrip(R, 'smoke', 1);
        if (cig && cigInMouth) { R.root.add(cig.group); cig.group.matrix.copy(anchorR); cigInMouth = false; }
        const r = ease(clamp(fp.raise, 0, 1));
        const pose = lerpPose(P[mode].rest, P[mode].mouth, r);
        pose.pos.add(sway).add(V(0, -(1 - ease(clamp(fp.drawT, 0, 1))) * 0.35, 0));
        if (fp.flickT < 0.35) { const qq = fp.flickT / 0.35; pose.axis.add(V(0, 0, Math.sin(qq * Math.PI * 3) * 0.25 * (1 - qq))); pose.pos.y -= Math.sin(qq * Math.PI * 3) * 0.01 * (1 - qq); }
        if (fp.stubT < 1 && opts.ashtrayCam) { const qq = fp.stubT < 0.5 ? ease(fp.stubT / 0.5) : ease((1 - fp.stubT) / 0.5); pose.pos.lerp(opts.ashtrayCam, qq); pose.axis.lerp(V(0, -1, 0), qq); }
        pose.pos.y += (opts.lift || 0) - 0.06 * (opts.clutch || 0); pose.pos.x += 0.03 * (opts.clutch || 0); // 咳嗽时夹烟的手往旁边放开
        // 摆手（拒绝给烟）：右手举到画面右边，手背朝自己、手指朝上，左右摆
        const wE = 1 - (fp.waveT || 0), wv = fp.waveT > 0 ? ease(Math.max(0, Math.min(1, wE / 0.2, fp.waveT / 0.2))) : 0;
        if (wv > 0) { const sw = wE > 0.2 && wE < 0.8 ? Math.sin((wE - 0.2) / 0.6 * Math.PI * 3) : 0; /* 左、右、左三下 */ pose.pos.lerp(V(0.19 + sw * 0.025, -0.08, -0.42), wv); pose.axis.lerp(V(0, 0.1, 1), wv); pose.finger.lerp(V(sw * 0.45, 1, 0.05), wv); }
        R.root.visible = !!me.cig || fp.stubT < 1 || wv > 0;
        place(R, anchorRInv, pose.pos, pose.axis, pose.finger);
      }
      if (cig) cig.update(me, t);
      // 右手捏着的东西
      chopsticks.visible = !!act?.sticks; strands.visible = !!act?.strands;
      const pk = act?.piece ? (ITEM[itemId]?.piece || 'chip') : null;
      if (pk !== pieceKind) { if (piece) piece.removeFromParent(); piece = pk ? makePiece(pk) : null; pieceKind = pk; if (piece) held.add(piece); }

      // ---------- 左手：双人互动优先（给别人点火 / 伸手要 / 递烟 / 接烟），其次自己的打火机，再其次手上的东西 ----------
      // opts.inter = { kind, e: 0..1, aim: 对方嘴边（相机坐标）}
      const it = opts.inter && opts.inter.e > 0.02 ? opts.inter : null, ik2 = it?.kind;
      const reach = ik2 === 'ask'; // 递烟 / 接烟另有分阶段的动作（上面 iAct）
      const lightOther = ik2 === 'lightGive';
      const lr = lightOther ? ease(it.e) : ease(clamp(fp.lighter, 0, 1));
      lighter.visible = lr > 0.01;
      if (item) item.visible = !lighter.visible && !reach && !showPack;
      giveCig.visible = false;
      const clutch = lighter.visible || reach ? 0 : (opts.clutch || 0);
      applyGrip(L, lighter.visible || reach || showPack || !item ? 'fist' : holdGrip(hold.r), -1);
      L.root.visible = lighter.visible || reach || showPack || !!item || clutch > 0.03;
      // 左手往前递 / 给人点火时，袖子从手腕朝镜头方向伸过来，临时缩到四成，免得糊住半边画面
      sleeveL.scale.y = 1 - 0.6 * (reach || lightOther ? ease(it.e) : 0);
      if (reach) {
        // 朝对方伸出去：从平时的位置往对方方向伸，最远离镜头 0.5 米左右
        // 伸到对方胸口的高度、离镜头 0.42 米以内，袖子才不会糊满半边画面
        const to = it.aim.clone(); to.y -= 0.22; if (to.length() > 0.42) to.setLength(0.42); to.y = Math.min(Math.max(to.y, -0.24), -0.1);
        const pos = L_REST.pos.clone().lerp(to.add(V(-0.03, 0, 0)), ease(it.e) * 0.75);
        place(L, anchorLInv, pos.add(sway), V(0.15, 0.85, -0.5), V(0.75, 0, 0.55));
        flameLight.intensity = 0;
      } else if (lighter.visible) {
        let target;
        if (lightOther) { target = it.aim.clone(); if (target.length() > 0.55) target.setLength(0.55); target.add(V(0, -0.045, 0)); } // 凑到对方嘴边的烟头下面
        else {
          const mp = lerpPose(P[mode].rest, P[mode].mouth, 1);
          const tipLen = cig ? cig.spec.len : 0.084;
          const tipPos = mp.pos.clone().add(V(0, opts.lift || 0, 0)).add(mp.axis.clone().normalize().multiplyScalar(tipLen + 0.004));
          target = tipPos.clone().add(V(0, -0.03, 0));
        }
        const from = V(-0.25, -0.5, -0.35);
        place(L, anchorLInv, from.lerp(target, lr).sub(V(0, 0.024, 0)), V(0.05, 1, 0.05), V(0.6, 0, 0.8));
        const fOn = fp.flame > 0 || (lightOther && it.u > 0.3 && it.u < 0.84); // 给人点火：凑到烟头下面才打着，点着了就松开
        flameMat.uniforms.uOn.value = fOn ? 1 : 0;
        flameMat.uniforms.uTime.value = t;
        flameLight.intensity = fOn ? 0.07 + Math.sin(t * 30) * 0.012 : 0; // 打火机离手只有几厘米，光随距离平方衰减，近处会被放大很多：给一点点暖光就够
      } else if (item || clutch > 0.03 || showPack) {
        let l = act?.L || L_REST;
        if (clutch > 0.03) { const e = ease(clutch); l = { pos: l.pos.clone().lerp(CLUTCH.pos, e), up: l.up.clone().lerp(CLUTCH.up, e), face: l.face.clone().lerp(CLUTCH.face, e) }; }
        place(L, anchorLInv, l.pos.clone().add(sway).add(V(0, opts.lift || 0, 0)), l.up, l.face);
        flameLight.intensity = 0;
      }

      // 倒薯片：从袋口掉几片进嘴
      if (act?.pour && item && Math.random() < 0.35) {
        const c = crumbs.find((x) => x.life <= 0);
        if (c) { L.root.updateMatrixWorld(true); itemTop.getWorldPosition(tmpW); c.m.position.copy(rig.worldToLocal(tmpW.clone())); c.v.copy(MOUTH).sub(c.m.position).multiplyScalar(2.2).add(V((Math.random() - 0.5) * 0.06, -0.05, 0)); c.life = 0.45; c.m.visible = true; c.m.rotation.set(Math.random() * 6, Math.random() * 6, 0); }
      }
      for (const c of crumbs) if (c.life > 0) { const dt = 1 / 60; c.life -= dt; c.v.y -= 0.6 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += 0.2; if (c.life <= 0) c.m.visible = false; }

      // 火头的光
      if (cig && me.cig === 2) {
        (cigInMouth ? rig : R.root).updateMatrixWorld(true);
        cig.tip.getWorldPosition(tipCam); emberLight.position.copy(rig.worldToLocal(tipCam.clone()));
        emberLight.intensity = me.puffing ? 0.08 + Math.random() * 0.02 : 0.015 + Math.sin(t * 3) * 0.003; // 烟头照到手上的光：很弱，吸的时候带点橙红跳动
      } else emberLight.intensity = 0;
      fill.intensity = 0.12 + (opts.night || 0) * 0.33; shade(opts.night || 0); // 夜里给手一点补光就够，太强手会自己发白、被泛光放大成一团
      return { tilt: act?.tilt || 0 };
    },
    tipWorld(out) { if (!cig) return null; cig.tip.getWorldPosition(out); return out; },
    flameWorld(out) { if (!lighter.visible) return null; return flame.getWorldPosition(out).add(new THREE.Vector3(0, 0.02, 0)); },
    itemTopWorld(out) { if (!item || !item.visible) return null; return itemTop.getWorldPosition(out); },
    setLook(look2) { const c = lookColors(look2); skinMat.color.set(c.skin); base.skin.set(c.skin); base.sleeve.set(c.sleeve); base.cuff.set(c.suit ? '#f6f4ee' : new THREE.Color(c.sleeve).multiplyScalar(0.82)); shade(0); }, // 跟别人眼里你的穿搭一致
  };
}
