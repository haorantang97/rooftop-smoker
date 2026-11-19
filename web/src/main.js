// 抽根烟 3D · 主逻辑：渲染、时间、手和烟、多人、界面
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CIG, CIGS, ITEM, ITEMS, addCatalogCigs, addCatalogDrinks, addCatalogSnacks } from '../../public/js/data.js';
import { Snd } from '../../public/js/sound.js';
import { createSky, atmosphere } from './sky.js';
import { createVistas, VISTA_IDS } from './vistas/index.js';
import { createRoof } from './roof.js';
import { createHands, USE } from './hands.js';
import { createSmoke } from './smoke.js';
import { makePerson, peopleLoaded, AVATAR } from './people.js';
import { createControls } from './controls.js';
import { createShop } from './shop3d.js';
import { createCigShop } from './cigshop.js';
import { t, nameOf } from './i18n.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => x * x * (3 - 2 * x);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
// 这一次访问才记住的东西（名字、续上身份的 token）：同一个标签页里刷新还在，关掉网页再进来就当新人、重新起名字
const sess = { get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
try { for (const k of ['smoke.token', 'smoke.named', 'smoke.name']) localStorage.removeItem(k); } catch {} // 以前存在本地的，清掉
// 匿名统计用：设备编号（这台设备一直用同一个，看第二天还来不来）、会话编号（这次访问，刷新不变）；不含任何个人信息
const rid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36));
const DEV_RET = !!store.get('smoke.did', ''); if (!DEV_RET) store.set('smoke.did', rid());
if (new URLSearchParams(location.search).get('internal') === '1') store.set('smoke.internal', true); // 开发者自己的设备：打开一次带 ?internal=1 的链接，以后都不计入统计
if (!sess.get('smoke.sid', '')) sess.set('smoke.sid', rid());
const evQ = [];
function track(e, v) { const m = { t: 'ev', e, ...(v !== undefined ? { v } : {}) }; if (S?.ws?.readyState === 1 && S.helloed) S.ws.send(JSON.stringify(m)); else evQ.push(m); }
const qp = new URLSearchParams(location.search);
const hourNow = () => { if (qp.get('hour') !== null) return Number(qp.get('hour')); const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const BURN_IDLE = 1 / 300, BURN_PUFF = 1 / 22;
// 天台：每套风景一个（roof:<风景>，见 vistas/index.js）；?place=roof:nyc 直接上那个天台，店里可以选
const isRoof = (p) => typeof p === 'string' && p.startsWith('roof:');
// 天台场景全世界统一，由服务器决定（welcome / scene 消息里带）；玩家不能选，只是各自看到自己当地的时间
let ROOF = 'roof:sea';

// Gemini 做的各国香烟：先读进来再搭店（烟柜要用）
try { const r = await fetch(`${import.meta.env.BASE_URL}catalog/cigarettes.json`, { cache: 'no-cache' }); if (r.ok) addCatalogCigs(await r.json()); } catch (e) { console.warn('香烟资产没读到，用内置的 14 种', e); }
// 各国饮料：也是先读进来再搭店（冰柜要摆）
try { const r = await fetch(`${import.meta.env.BASE_URL}catalog/drinks.json`, { cache: 'no-cache' }); if (r.ok) addCatalogDrinks(await r.json()); } catch (e) { console.warn('饮料资产没读到，只用内置的', e); }
try { const r = await fetch(`${import.meta.env.BASE_URL}catalog/snacks.json`, { cache: 'no-cache' }); if (r.ok) addCatalogSnacks(await r.json()); } catch (e) { console.warn('零食资产没读到，只用内置的', e); }

// ---------- 渲染器 ----------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#b8cde2', 0.00011);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 60000);
camera.position.set(0, 1.62, 0); scene.add(camera);

const sky = createSky(scene);
const vistas = createVistas(scene, sky); vistas.set(ROOF.slice(5));
const roof = createRoof(scene);
const smoke = createSmoke(scene);
const shop = createShop(renderer);
// 视线高度跟方块小人的身高对上（别人眼里你也是这么高）
const PLACES = { roof: { scene, world: roof.world, picks: [roof.door, ...roof.seatPicks], eye: AVATAR.eye }, shop: { scene: shop.scene, world: shop.world, picks: [...shop.picks, shop.door], eye: AVATAR.eye } };
let cur = PLACES.roof;

const sun = new THREE.DirectionalLight('#fff4e2', 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 120 }); // 天台 22×16 米
sun.target.position.set(0, 0, 6); scene.add(sun, sun.target);
const moonLight = new THREE.DirectionalLight('#8fa6e0', 0); moonLight.target.position.set(0, 0, 6); scene.add(moonLight, moonLight.target);
const hemi = new THREE.HemisphereLight('#bcd6ff', '#5a5048', 1); scene.add(hemi);

// 环境光照：每隔一段时间用当时的天空重新烘一次
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null, envHour = -99;
function bakeEnv(h, c) {
  if (Math.abs(h - envHour) < 0.05) return;
  envHour = h;
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = sky.sky.material.uniforms[k].value;
  envSky.material.uniforms.sunPosition.value.copy(sky.state.sunDir);
  const old = envRT; envRT = pmrem.fromScene(envScene, 0.04); scene.environment = envRT.texture; old?.dispose();
  scene.environmentIntensity = THREE.MathUtils.lerp(1, 0.08, c.night);
}

// 后期：泛光 + 暗角颗粒
const rt = new THREE.WebGLRenderTarget(Math.max(1, innerWidth), Math.max(1, innerHeight), { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
// 泛光之前先把坏像素清掉（保险）：任何着色器算出 NaN，泛光模糊都会把一个坏像素扩散成一大块黑色方块
// （之前天台上一直有的黑方块就是灯塔光束 pow(负数) 算出的 NaN，已在 sea.js 修掉）；太亮的像素封顶而不是变黑
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (any(notEqual(c, c))) c = vec4(0., 0., 0., 1.);
      gl_FragColor = vec4(min(max(c.rgb, 0.), vec3(600.)), c.a); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.65, 0.82); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.35 }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float v = 1. - dot(d, d) * uVig * 2.2;
      c.rgb *= v; c.rgb += vec3(.06,.025,0.) * uWarm * smoothstep(.9, .0, length(d - vec2(0., -.5)));
      c.rgb += (h(vUv * 1000. + uTime) - .5) * .035; gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
// 像素风预览：整个画面按小像素渲染，按深度和朝向描边（不是《我的世界》那种大方块）。?pixel=3 打开，游戏里按 P 切换
const pixelPass = new RenderPixelatedPass(3, scene, camera, { normalEdgeStrength: 0.2, depthEdgeStrength: 0.4 });
vistas.attach(composer, pixelPass); // 远景全分辨率画，像素化之后再合成（天台保持像素风）
function setPixel(size) {
  composer.passes[0] = size ? pixelPass : renderPass;
  if (size) pixelPass.setPixelSize(size);
  composer.setSize(Math.max(1, innerWidth), Math.max(1, innerHeight));
  S.pixel = size || 0;
}

// ---------- 状态 ----------
const S = {
  ws: null, meId: null, room: 1, players: new Map(), people: new Map(), stats: null, place: ROOF, lastMove: 0, lastSent: '', fade: 0,
  fp: { raise: 0, raiseT: 0, lighter: 0, lighterT: 0, flame: 0, flickT: 9, stubT: 9, waveT: 0, drawT: 1, use: null, openP: 1, eaten: 0 },
  light: null, fails: 0, t: 0, taps: [],
  sound: store.get('smoke.sound', true), entered: false,
};
const me = () => S.players.get(S.meId);
let hands = null;
const loadingDone = () => $('#loading').classList.add('hidden');

// ---------- 走路和转头 ----------
const typing = () => !S.entered || !!cigShop?.isOpen();
const controls = createControls(canvas, { onClick: (e) => onClick(e), isBlocked: typing });
canvas.addEventListener('pointermove', (e) => { if (!controls.locked() && !controls.S.drag?.moved && e.pointerType !== 'touch') hover(e); });
// 竖屏视野稍微放宽一点（不然左右只看得到一条缝），手的位置在 hands.js 里按屏幕宽窄往中间收
const fitCamera = () => { camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 80 : 70; camera.updateProjectionMatrix(); };
fitCamera();
addEventListener('resize', () => { if (!innerWidth || !innerHeight) return; renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); fitCamera(); });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// 射线看准了什么：最近的那个人，或者能用的东西
function aimAt(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // 点人：射线可能同时穿过前后好几个人，取离你最近的那个
  let near = null, nd = Infinity;
  for (const [id, P] of S.people) { const h = ray.intersectObjects(P.pickables, false)[0]; if (h && h.distance < nd) { nd = h.distance; near = id; } }
  const hit = ray.intersectObjects(cur.picks, true)[0], pk = hit && findPick(hit.object);
  if (near && (!hit || nd <= hit.distance + 0.05)) return { person: near, dist: nd };
  if (pk) return { pk, dist: hit.distance, point: hit.point };
  return null;
}
// 锁定鼠标时屏幕中间那个点就是光标：对准人左键要根烟、右键借个火，不用退出锁定；对准沙发、草坪、门、货架照样左键用
function onClick(e) {
  const m = me(); if (!m) return;
  const a = aimAt(e);
  if (a?.person) {
    if (S.place === 'shop') return notice(t('上了天台才能跟人要烟、借火', 'Bum smokes and lights up on the roof.')); // 小卖部里看得到人，但不能互动
    if (!e.center) return openPerson(S.players.get(a.person), e); // 没锁定（拖动转头 / 触屏）：弹窗选
    if (a.dist > 6) return notice(t('离太远了，走近一点', 'Too far — get closer.'));
    if (e.button === 2 || !sticks(S.players.get(a.person))) return askFire(a.person); // TA 没烟：左键也是借火
    return send({ t: 'ask', to: a.person });
  }
  if (e.button === 2) return;
  if (a?.pk) return usePick(a.pk, a.dist, a.point);
  // 彩蛋：连踢烟灰桶 5 下
  if (isRoof(S.place) && m.pose !== 'lie' && ray.intersectObject(roof.ashtray, true).length) {
    S.taps = S.taps.filter((t) => S.t - t < 3); S.taps.push(S.t); Snd.tap(0.9);
    if (S.taps.length >= 5) { S.taps = []; setPose('lie', { x: controls.S.x, z: controls.S.z, r: controls.S.yaw, y: 0, ex: controls.S.x, ez: controls.S.z }); }
  }
}
function findPick(o) { while (o) { if (o.userData?.pick) return o.userData.pick; o = o.parent; } return null; }
const REACH = 2.6;
// 坐 / 躺：点沙发、躺椅的坐垫就近坐下，点草坪就坐在草坪上
const nearestSeat = (pt) => roof.seats.reduce((b, s) => { const d = Math.hypot(s.x - pt.x, s.z - pt.z); return d < b.d ? { s, d } : b; }, { s: null, d: 1e9 }).s;
function usePick(pk, dist, point) {
  if (pk.kind === 'seat' || pk.kind === 'ground') {
    if (dist > REACH + 0.6) return;
    const m = me(); if (!m || m.pose !== 'stand') return;
    if (pk.kind === 'ground') return setPose('sit', { x: point.x, z: point.z, r: controls.S.yaw, y: 0.06, ex: point.x, ez: point.z, ground: true });
    const st = nearestSeat(point); if (st) return setPose(st.pose, st);
  }
  const wall = pk.kind === 'pack' || pk.kind === 'cigwall';
  if (dist > REACH + (pk.kind === 'door' ? 0.8 : wall ? 1.2 : 0)) return;
  if (pk.kind === 'door') return goPlace(pk.to === 'shop' ? 'shop' : ROOF);
  if (wall) return cigShop.open(pk.id); // 烟柜：打开弹窗挑
  send({ t: 'take', kind: pk.kind, id: pk.id }); Snd.rustle();
}
function hover(e) {
  const a = aimAt(e), tip = $('#aimTip');
  if (e.center) { // 锁定时：准星下面写上左键 / 右键能干什么
    const info = a && aimLabel(a); tip.innerHTML = info ? info.html : ''; tip.classList.toggle('on', !!info); tip.classList.toggle('far', !!info?.far);
    $('#crosshair').classList.toggle('hot', !!info && !info.far); canvas.style.cursor = ''; return;
  }
  tip.classList.remove('on'); $('#crosshair').classList.remove('hot');
  const pk = a?.pk;
  if (!pk) { canvas.style.cursor = a?.person ? 'pointer' : ''; return; }
  const wall = pk.kind === 'pack' || pk.kind === 'cigwall', seat = pk.kind === 'seat' || pk.kind === 'ground';
  const far = a.dist > REACH + (pk.kind === 'door' ? 0.8 : wall ? 1.2 : seat ? 0.6 : 0);
  if (seat && me()?.pose !== 'stand') { canvas.style.cursor = ''; return; }
  canvas.style.cursor = far ? 'grab' : 'pointer';
}
// 鼠标小图标：亮的那半边是要按的键（左键 / 右键），不写字母，免得以为是键盘上的 L / R
const mouseIco = (side) => `<svg class="mouse" viewBox="0 0 14 20" width="12" height="17" aria-hidden="true"><rect x="1" y="1" width="12" height="18" rx="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 1v7" stroke="currentColor" stroke-width="1.2"/>${side === 'L' ? '<path d="M7 1.6A5.4 5.4 0 0 0 1.7 7V8H7Z" fill="#ff8a3d"/>' : '<path d="M7 1.6A5.4 5.4 0 0 1 12.3 7V8H7Z" fill="#ff8a3d"/>'}</svg>`;
const kb = (side, l) => `<span>${mouseIco(side)}${esc(l)}</span>`;
function aimLabel(a) {
  const m = me(); if (!m) return null;
  if (a.person) {
    const p = S.players.get(a.person); if (!p) return null;
    if (S.place === 'shop') return { far: false, html: `<b>${esc(nameOf(p))}</b><i>${t('上天台再跟 TA 要烟借火', 'Meet on the roof to share a smoke')}</i>` };
    const brand = (p.cig && p.brand) || (p.pack?.n > 0 && p.pack.id) || (p.loose?.length && p.loose[0]), img = brand && CIG[brand]?.img ? `<img class="pk" src="${import.meta.env.BASE_URL}gen/cig/${brand}.png" alt="">` : ''; // 跟点人弹窗一样：给看 TA 抽的那包
    return { far: a.dist > 6, html: `${img}<b>${esc(nameOf(p))}</b>${sticks(p) > 0 ? kb('L', t('要根烟', 'Bum a smoke')) + kb('R', t('借个火', 'Ask for a light')) : `<span>${t('借个火', 'Ask for a light')}</span>`}` };
  }
  const pk = a.pk, wall = pk.kind === 'pack' || pk.kind === 'cigwall', seat = pk.kind === 'seat' || pk.kind === 'ground';
  if (seat && m.pose !== 'stand') return null;
  const far = a.dist > REACH + (pk.kind === 'door' ? 0.8 : wall ? 1.2 : seat ? 0.6 : 0);
  let l;
  if (pk.kind === 'seat') l = nearestSeat(a.point)?.pose === 'lie' ? t('躺下', 'Lie down') : t('坐下', 'Sit down');
  else if (pk.kind === 'ground') l = t('坐在草坪上', 'Sit on the grass');
  else if (pk.kind === 'door') l = pk.to === 'shop' ? t('去小卖部', 'Down to the shop') : t('上天台', 'Up to the roof');
  else if (wall) l = t('挑包烟', 'Pick a pack');
  else if (pk.kind === 'item') l = t(`拿${ITEM[pk.id]?.name || ''}`, 'Take it');
  else return null;
  return { far, html: `<span>${esc(l)}</span>` + (far ? `<i>${t('走近一点', 'Get closer')}</i>` : '') }; // 只有一个动作：直接写做什么，不标按键
}
// 姿势：stand / sit / lie。seat = { x, z, r, y, ex, ez }：坐到哪、朝哪、坐垫多高、起来站到哪
function setPose(v, seat = null) {
  const m = me(); if (!m) return;
  const c = controls.S;
  if (v === 'stand') { if (S.seat && S.seat.ex !== undefined) { c.x = S.seat.ex; c.z = S.seat.ez; } S.seat = null; c.seated = false; }
  else { S.seat = seat || { ...(S.seat || {}), x: c.x, z: c.z, r: c.yaw, y: S.seat?.y ?? 0, ex: c.x, ez: c.z }; c.seated = true; c.x = S.seat.x; c.z = S.seat.z; if (S.seat.r !== undefined) c.yaw = c.yawT = S.seat.r; }
  m.pose = v; m.seatY = v === 'stand' ? 0 : S.seat.y;
  send({ t: 'pose', v, y: m.seatY }); S.lastSent = '';
  if (v === 'lie') { c.pitchT = -0.4; c.pitchRange = [-1.45, 0.1]; } else { c.pitchT = -0.05; c.pitchRange = [-0.75, 0.7]; } // 躺着往上看
  renderBar();
}
// 视线高度：站着 / 坐着（坐垫上方约 0.78 米）/ 躺着（贴着躺椅）
const eyeFor = (m) => (!m || m.pose === 'stand' ? cur.eye : m.pose === 'sit' ? (m.seatY || 0) + 0.78 : (m.seatY || 0) + 0.3);
function goPlace(to) { const m = me(); if (!m || S.fade > 0) return; if (m.puffing) endPuff(); if (m.cig) stub(false); S.light = null; S.fade = 1.2; Snd.rustle(); setTimeout(() => send({ t: 'place', to }), 350); }
function enterPlace(to, x, z, r) {
  S.place = to; if (isRoof(to)) { ROOF = to; vistas.set(to.slice(5)); } cur = PLACES[isRoof(to) ? 'roof' : to] || PLACES.roof;
  controls.S.seated = false; S.seat = null; const mm0 = me(); if (mm0) { mm0.pose = 'stand'; mm0.seatY = 0; } // 换地方一定是站着进去
  cur.scene.add(camera); cur.scene.add(smoke.points); renderPass.scene = cur.scene; pixelPass.scene = cur.scene;
  cur.world.others = () => [...S.players.values()].filter((p) => p.id !== S.meId && seen(p)).map((p) => ({ x: p.rx ?? p.x, z: p.rz ?? p.y }));
  controls.setWorld(cur.world, x, z, r);
  for (const P of S.people.values()) P.dispose(); S.people.clear();
  renderBar();
}

// ---------- 动作 ----------
function send(msg) { if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(msg)); }
// 同一个地方的人都看得到（小卖部、天台都是大家共用的）；要烟借火只在天台上
const seen = (p) => p.place === S.place;
const sticks = (p) => (p?.loose?.length || 0) + (p?.pack?.n || 0);
function mainAction() {
  const m = me(); if (!m) return;
  if (S.place === 'shop') return;
  if (S.fp.use) return;
  if (m.cig === 2) return stub(false);
  if (m.cig === 1) return startLight();
  if (S.awaitDraw) return;
  if (!sticks(m)) return;
  S.awaitDraw = true; setTimeout(() => (S.awaitDraw = false), 1500);
  send({ t: 'act', a: 'draw' });
}
// 每根烟一个打火机状态：第 okAt 次（1–3 各三分之一）点着；5% 坏了怎么都点不着
const newLighter = () => ({ tries: 0, okAt: 1 + Math.floor(Math.random() * 3), broken: Math.random() < 0.05, dead: false });
function startLight() { const m = me(); if (!m || m.cig !== 1 || (S.light && !S.light.done) || S.fp.use) return; S.light = { t: S.light ? 0.25 : 0 }; S.fp.raiseT = 1; S.fp.lighterT = 1; }
// 别人的声音：离得越近越清楚（1 米左右正常，3 米外很轻，6 米外基本听不见），按方位分左右
function hear(p) {
  if (!p || !seen(p)) return { v: 0, pan: 0 };
  const dx = (p.rx ?? p.x) - camera.position.x, dz = (p.rz ?? p.y) - camera.position.z, d = Math.hypot(dx, dz);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  return { v: 1 / (1 + (d / 1.3) ** 2.2), pan: d > 0.01 ? Math.max(-0.85, Math.min(0.85, (dx * right.x + dz * right.z) / d)) : 0 };
}
function startPuff() { const m = me(); if (!m || m.cig !== 2 || m.puffing || S.fp.use) return; m.puffing = true; m.puffT = 0; S.fp.raiseT = 1; send({ t: 'act', a: 'puff' }); Snd.inhaleStart(!!CIG[m.brand]?.crackle); $('[data-act="puff"]')?.classList.add('held'); }
// 吸了多久 → 吐多久（秒）：吸 1 秒吐 1.2 秒左右，吸 3 秒吐 2.6 秒左右
// 松开到开始吐：有「吸进肺里」那一下（0.8–1.1 秒）就等它播完再停一会儿；短的一口直接吐
const LUNG_MIN = 0.8, exhaleDelay = (lung) => (lung ? 1500 : 420);
const WAVE_T = 1.0;
// ---------- 双人互动（伸手要、递烟 / 接烟、拿打火机给人点 / 被点、烟头对烟头）----------
// 每个玩家 p.ia = { kind, with: 对方 id, t0, dur }；每帧算成 { kind, e: 0..1 进度包络（前后 0.3 秒淡入淡出）, aim: 对方嘴边 }
const FIRE_REACH = 2.5; // 借火得走到这么近（米），和服务器一致；点火时对方会自己凑过来
const MOUTHY = new Set(['askFire', 'lightTake', 'tipTake', 'tipGive']); // 这些时候烟叼到嘴上
// 要烟 / 借火这种「开口要」的阶段：只朝开口那一刻对方站的地方，不跟着对方转、也不凑过去；对方走远（2.5 米外）就算了
const ASKING = new Set(['ask', 'askFire']);
const GIVE_T = 2.6, LIGHT_T = 3.0; // 递烟、点火动作的时长（秒）
function setInter(id, kind, withId, dur) { const p = S.players.get(id); if (p) p.ia = { kind, with: withId, t0: S.t, dur, at: ASKING.has(kind) ? posOf(withId) : null }; }
function clearInter(id, kinds) { const p = S.players.get(id); if (p?.ia && (!kinds || kinds.includes(p.ia.kind))) p.ia = null; }
function posOf(id) { if (id === S.meId) return { x: controls.S.x, z: controls.S.z }; const q = S.players.get(id); return q ? { x: q.rx ?? q.x, z: q.rz ?? q.y } : null; }
function aimOf(id, kind) {
  if (id === S.meId) { // 我：对准我画面里那根烟的烟头，稍微偏画面中间一点（打火机才不会被我自己的手指挡住）
    const t = me()?.cig && hands?.tipWorld(new THREE.Vector3());
    return t ? t.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), -0.035) : camera.position.clone().add(new THREE.Vector3(0, -0.07, 0));
  }
  const P = S.people.get(id); if (P) { if (kind === 'lightGive' && P.tip()) return P.tip().clone(); return P.mouthW().clone(); } // 给人点火：对准他嘴上那根烟的烟头
  const q = posOf(id); return q ? new THREE.Vector3(q.x, AVATAR.eye - 0.1, q.z) : camera.position.clone();
}
function interOf(p) {
  const I = p?.ia; if (!I) return null;
  const t = S.t - I.t0; if (t > I.dur) { p.ia = null; return null; }
  // e：进出包络（0.3 秒淡入淡出）；u：动作进度 0→1（递烟、点火按它分阶段：拿烟 → 递出 → 接住；凑过去 → 打火 → 低头点着）
  return { kind: I.kind, e: Math.max(0, Math.min(1, t / 0.3, (I.dur - t) / 0.3)), u: t / I.dur, aim: aimOf(I.with, I.kind), tip: I.with === S.meId && !!me()?.cig }; // tip：aim 就是我那根烟的烟头
} // 摆手：抬手 0.2 秒 → 左右左三下 0.6 秒 → 放下 0.2 秒
const exhaleDur = (puffT) => clamp(0.5 + puffT * 0.7, 0.6, 3.2);
function endPuff() {
  const m = me(); if (!m || !m.puffing) return;
  const amt = clamp(m.puffT / 2.4, 0.15, 1), puffT = m.puffT; m.puffing = false; S.fp.raiseT = S.light ? 1 : 0;
  // 呛到只有两种情况：吸到上限（3.6 秒，自动松开）一定呛；吸满 2.4 秒以上小概率呛（普通 5%，烈的 10%）
  // 呛到 = 只有吸这一下：没有「吸进肺里」，也不吐，烟跟着咳嗽一口一口喷出来
  const strong = (CIG[m.brand]?.strength || 3) >= 4;
  const choke = puffT >= 3.6 || (puffT >= 2.4 && Math.random() < (strong ? 0.1 : 0.05));
  const lung = !choke && puffT > LUNG_MIN; // 嘬够久：松开时先吸一口进肺，停一下再吐
  send({ t: 'act', a: 'exhale', amt: +amt.toFixed(2), choke }); Snd.inhaleStop(); if (lung) Snd.lung();
  if (choke) setTimeout(() => cough(puffT >= 3.6 ? 1.0 : 0.75, amt), 250);
  else setTimeout(() => {
    const from = new THREE.Vector3(0, -0.07, -0.16).applyMatrix4(camera.matrixWorld);
    const dir = new THREE.Vector3(0, 0.12, -1).transformDirection(camera.matrixWorld);
    const dur = exhaleDur(puffT);
    const follow = { at: () => new THREE.Vector3(0, -0.07, -0.16).applyMatrix4(camera.matrixWorld), vel: () => S.vel };
    smoke.exhale(from, dir, amt, tint(m.brand), 1, dur, follow); Snd.exhale(amt, 1, dur + 0.3);
  }, exhaleDelay(lung));
  $('[data-act="puff"]')?.classList.remove('held');
}
function flickAsh(auto) { const m = me(); if (!m || m.cig !== 2 || m.ash < 0.04 || S.fp.use) return; S.fp.flickT = 0; setTimeout(() => { const p = hands?.tipWorld(new THREE.Vector3()); if (p) smoke.ash(p); }, 120); m.ash = 0; send({ t: 'act', a: 'ash' }); if (!auto) Snd.tap(); }
function stub(auto) {
  const m = me(); if (!m || !m.cig || S.stubbing) return;
  if (m.puffing) endPuff();
  S.stubbing = true; S.light = null; S.fp.lighterT = 0; S.fp.raiseT = 0; S.fp.stubT = m.pose === 'lie' ? 9 : 0;
  setTimeout(() => {
    S.stubbing = false;
    const counted = m.cig === 2 && m.burn > 0.15;
    m.cig = 0; m.burn = 0; m.ash = 0; m.brand = null; send({ t: 'act', a: 'stub' }); Snd.tap(0.6);
    if (counted) { const d = new Date().toLocaleDateString('sv-SE'), mine = store.get('smoke.mine', { date: d, n: 0 }); if (mine.date !== d) { mine.date = d; mine.n = 0; } mine.n++; store.set('smoke.mine', mine); }
    renderBar();
  }, m.pose === 'lie' ? 60 : 520);
}
// ---------- 吃喝：第一次先打开（拉环 / 拧盖 / 撕开），之后每按一次吃一口，吃完就没了 ----------
const CRUNCHY = /chips|shrimp|puffs|cookie|choco|bar_|toblerone|pocky|icebar|mints/;
const DRINK = (id) => ITEM[id]?.style === 'sip';
function sip() {
  const m = me(); if (!m?.item || S.fp.use || m.puffing || (S.light && !S.light.done) || S.stubbing) return;
  const it = ITEM[m.item], needOpen = !!it.open && S.fp.openP < 1, kind = needOpen ? it.open : it.style;
  if (!USE[kind]) return;
  S.fp.use = { kind, isOpen: needOpen, t: 0, dur: USE[kind].dur, fired: new Set(), id: m.item };
  S.fp.raiseT = 0;
  send({ t: 'act', a: needOpen ? 'open' : 'sip' });
}
function useSound(name, id) {
  if (name === 'bite') return CRUNCHY.test(id) ? Snd.crunch() : Snd.chew();
  Snd[name]?.();
}
function tickUse(dt) {
  const u = S.fp.use; if (!u) return;
  if (me()?.item !== u.id) { S.fp.use = null; return; }
  u.t += dt; const q = u.t / u.dur, spec = USE[u.kind];
  for (const [at, name] of spec.sound) if (q >= at && !u.fired.has(at)) {
    u.fired.add(at); useSound(name, u.id);
    if (name === 'psst' && hands) { const p = hands.itemTopWorld(new THREE.Vector3()); if (p) for (let i = 0; i < 4; i++) smoke.wisp(p.clone(), [0.97, 0.97, 1], 0.25); } // 拉开罐子冒一点气
  }
  if (spec.consume !== undefined && q >= spec.consume && !u.fired.has('eat')) { u.fired.add('eat'); S.fp.eaten = Math.min(1, S.fp.eaten + 1 / (ITEM[u.id].bites || 8)); }
  if (q >= 1) {
    S.fp.use = null;
    if (u.isOpen) S.fp.openP = 1;
    if (S.fp.eaten >= 0.999) send({ t: 'take', kind: 'drop' });
    renderBar();
  }
}
// 呛到：咳三声，镜头跟着抖；抽着烟的话每声咳出一小团烟
// amt：这口吸进去多少，呛出来的烟就有多少（第一声最多，后面越来越少）
function cough(k = 1, amt = 0.3) {
  const c = controls.S; if (c.coughT < 1.4) return;
  c.coughT = 0; c.coughK = k; Snd.cough(k); send({ t: 'act', a: 'cough' });
  const m0 = me(); if (m0) m0.lastAmt = amt;
  for (let i = 0; i < 3; i++) setTimeout(() => {
    const m = me(); if (!m) return;
    const from = new THREE.Vector3(0, -0.07, -0.16).applyMatrix4(camera.matrixWorld);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.05, -1).transformDirection(camera.matrixWorld);
    smoke.exhale(from, dir, amt * 0.75 * (1 - i * 0.3), tint(m.brand || m.lastBrand), 1, 0.35);
  }, 60 + i * 420);
}
const tint = (brand) => { const c = CIG[brand]?.smoke || [214, 214, 224]; return [c[0] / 255, c[1] / 255, c[2] / 255]; };

// ---------- 每帧 ----------
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); S.t += dt;
  const h = hourNow();
  sky.update(h, S.t, camera);
  const c = sky.state.c, atmo = atmosphere(c);
  scene.fog.color.copy(atmo.fog);
  renderer.toneMappingExposure = atmo.exposure;
  sun.position.copy(sky.state.sunDir).multiplyScalar(60).add(sun.target.position); sun.color.copy(atmo.sunColor); sun.intensity = atmo.sunIntensity; sun.castShadow = atmo.sunIntensity > 0.05;
  moonLight.position.copy(sky.state.moonDir).multiplyScalar(60).add(moonLight.target.position); moonLight.intensity = atmo.moonIntensity;
  hemi.color.copy(atmo.hemiSky); hemi.groundColor.copy(atmo.hemiGround); hemi.intensity = atmo.hemiIntensity;
  bakeEnv(h, c);
  vistas.update(dt, S.t, sky, atmo);
  roof.update(c.night, S.t);
  bloom.strength = S.place === 'shop' ? 0.22 : 0.25 + c.night * 0.35; // 夜里泛光别太强，不然火苗和烟头会糊成一团光
  if (S.place === 'shop') renderer.toneMappingExposure = 0.8;
  grade.uniforms.uTime.value = S.t; grade.uniforms.uVig.value = 0.3 + c.night * 0.15;

  // 镜头
  const m = me(), lie = m?.pose === 'lie';
  controls.update(dt, !!m && m.pose === 'stand' && S.fade <= 0);
  controls.apply(camera, eyeFor(m));
  // 被人点火 / 烟头对烟头：头往对方那边凑过去一点（0.2 米），烟头才凑得到他的火上
  const leanIt = m && interOf(m);
  if (leanIt && (leanIt.kind === 'lightTake' || leanIt.kind === 'tipTake' || leanIt.kind === 'tipGive')) {
    // 借火：对方打火机凑过来以后，往前探身、低头把烟头凑到火上（u 0.18→0.38 探过去，0.72→0.9 直起来）
    const lt = leanIt.kind === 'lightTake', w = lt ? ease(clamp((leanIt.u - 0.18) / 0.2, 0, 1)) * (1 - ease(clamp((leanIt.u - 0.72) / 0.18, 0, 1))) : leanIt.e;
    const pp2 = posOf(m.ia.with); if (pp2) { const dx = pp2.x - camera.position.x, dz = pp2.z - camera.position.z, d = Math.hypot(dx, dz); if (d > 0.3) { const k = (lt ? 0.22 : 0.1) * w / d; camera.position.x += dx * k; camera.position.z += dz * k; camera.position.y -= (lt ? 0.07 : 0.04) * w; } }
    if (lt) camera.rotateX(-0.22 * w); // 低头看着烟头
  }
  camera.updateMatrixWorld();
  if (m && performance.now() - S.lastMove > 100) {
    const c = controls.S, key = `${c.x.toFixed(2)},${c.z.toFixed(2)},${c.yaw.toFixed(2)}`;
    if (key !== S.lastSent) { S.lastSent = key; S.lastMove = performance.now(); send({ t: 'move', x: +c.x.toFixed(2), y: +c.z.toFixed(2), r: +c.yaw.toFixed(2) }); }
  }
  if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 1.6);
  $('#fade').style.opacity = Math.min(1, S.fade * 1.6);
  // 自己走路的速度（吐烟时让烟带上一点，往后飘得自然）
  { const c = controls.S, v = S.vel || (S.vel = new THREE.Vector3()); if (S.lastPos && dt > 0) v.set((c.x - S.lastPos.x) / dt, 0, (c.z - S.lastPos.z) / dt).clampLength(0, 4); S.lastPos = { x: c.x, z: c.z }; }
  // 跟坐着 / 躺着的人递烟点火：他不起身，你自己走到他跟前（约 1 米）
  { const mm = me(), mi = mm?.ia, o = mi && !ASKING.has(mi.kind) && S.players.get(mi.with);
    if (o && o.pose !== 'stand' && mm.pose === 'stand') { const dx = (o.rx ?? o.x) - controls.S.x, dz = (o.rz ?? o.y) - controls.S.z, d = Math.hypot(dx, dz); if (d > 1.05) { const st = Math.min(d - 1.0, 1.6 * dt); controls.nudge(dx / d * st, dz / d * st); /* 过碰撞，不会被推进家具中间 */ } } }
  // 店门口的感应门：踩到地垫上就开，开着门直接走出去 → 上天台（出来就在天台的楼梯口）
  if (S.place === 'shop') {
    const cx = controls.S.x, cz = controls.S.z, open = shop.autoDoor.update(shop.autoDoor.near(cx, cz), dt);
    shop.spinSausages(dt);
    if (open > 0.8 && cz > 3.5 && cx > 1.3 && cx < 2.5 && S.fade <= 0 && me()?.pose === 'stand') goPlace(ROOF);
  }
  if (S.place === 'shop' && Math.random() < dt * 6) smoke.wisp(shop.steamAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.2)), [0.95, 0.95, 0.97], 2.2);

  // 玩家
  for (const p of S.players.values()) {
    if (p.cig === 2) { const r = p.puffing ? BURN_PUFF : BURN_IDLE; p.burn = Math.min(1, p.burn + r * dt); p.ash = Math.min(1, p.ash + r * dt * 0.85); }
    if (p.puffing) p.puffT += dt; if (p.flame > 0) p.flame -= dt; if (p.sipT > 0) p.sipT -= dt; if (p.openT > 0) p.openT -= dt; if (p.coughT > 0) p.coughT -= dt; if (p.waveT > 0) p.waveT -= dt;
  }
  syncPeople(dt);
  if (m) updateMine(m, dt);
  tickUse(dt);
  // 我的烟冒烟
  if (m?.cig === 2 && hands) {
    m.smokeAcc = (m.smokeAcc || 0) + dt;
    const every = m.puffing ? 0.035 : 0.07;
    while (m.smokeAcc > every) { m.smokeAcc -= every; const p = hands.tipWorld(tmpV); if (p) smoke.wisp(p, tint(m.brand)); }
  }
  // 手
  if (hands && m) {
    const f = S.fp, tw = (v, t, sp) => (v < t ? Math.min(t, v + sp * dt) : Math.max(t, v - sp * dt));
    const myIt = interOf(m); f.raise = tw(f.raise, myIt && MOUTHY.has(myIt.kind) ? 1 : f.raiseT, 3.2); f.lighter = tw(f.lighter, f.lighterT, 3); f.drawT = Math.min(1, f.drawT + dt * 2.2);
    f.flickT += dt; f.stubT += dt; if (f.flame > 0) f.flame -= dt; if (f.waveT > 0) f.waveT -= dt;
    const at = roof.ashtray.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.86, 0));
    const ashtrayCam = camera.worldToLocal(at.clone());
    const ck = controls.S.cough;
    const shake = new THREE.Vector3(Math.sin(S.t * 61) * 0.004 * ck, 0.014 * ck, 0.01 * ck);
    // 咳嗽捂胸口：咳嗽开始后很快按上去，三声咳完慢慢放下
    const ct = controls.S.coughT, clutch = ct < 2.2 ? Math.min(1, ct / 0.2) * (ct > 1.5 ? Math.max(0, 1 - (ct - 1.5) / 0.7) : 1) : 0;
    const out = hands.update(f, m, S.t, { night: S.place === 'shop' ? 0 : c.night, ashtrayCam: isRoof(S.place) && ashtrayCam.length() < 1.8 ? ashtrayCam : null, lift: 0, shake, clutch, inter: myIt ? { kind: myIt.kind, e: myIt.e, u: myIt.u, aim: camera.worldToLocal(myIt.aim.clone()) } : null });
    controls.S.tilt = out?.tilt || 0;
    // 打开的杯面冒热气
    if (m.item && ITEM[m.item]?.style === 'noodle' && f.openP >= 1 && f.eaten < 1 && !f.use && Math.random() < dt * 2.5) { const p = hands.itemTopWorld(tmpV); if (p) smoke.wisp(p.clone(), [0.95, 0.95, 0.97], 0.45); }
  }
  grade.uniforms.uWarm.value = m?.puffing ? 1 : (S.fp.flame > 0 ? 0.6 : 0);
  // 烟雾受天色影响
  const sl = new THREE.Color().copy(atmo.hemiSky).multiplyScalar(0.55).add(new THREE.Color().copy(atmo.sunColor).multiplyScalar(atmo.sunIntensity * 0.12));
  smoke.update(dt, camera, sl.addScalar(0.18 + c.night * 0.05), new THREE.Color(c.night * 0.05, c.night * 0.035, c.night * 0.02), S.t);

  if (controls.locked() && (S.hoverT = (S.hoverT || 0) + dt) > 0.12) { S.hoverT = 0; hover(controls.center()); }
  composer.render();
  requestAnimationFrame(frame);
}

function updateMine(m, dt) {
  const L = S.light;
  if (L) {
    L.t += dt;
    if (!L.clicked && L.t > 0.55) { L.clicked = true; Snd.click(); }
    if (!L.done && L.t > 0.8) {
      const Z = S.lighter || (S.lighter = newLighter());
      Z.tries++; L.done = true; L.ok = !Z.broken && Z.tries >= Z.okAt;
      send({ t: 'act', a: 'flick', ok: L.ok });
      if (L.ok) { S.fp.flame = 1.1; Snd.flame(); setTimeout(() => { if (m.cig === 1) { m.cig = 2; renderBar(); } }, 450); }
      else { Snd.click(0.6); S.fp.flame = 0.08; if (Z.tries >= 3) { Z.dead = true; notice(t('打火机好像坏了，找人借个火', 'Lighter seems broken. Ask someone for a light.')); } } // 坏了也能接着打，只是打不着
    }
    // 这一下打完（0.8 秒处出结果）之后，1 秒没再按就把打火机放下；要再打就再按，手会重新举起来
    if (L.done && L.t > 0.8 + 1.0) { S.light = null; S.fp.lighterT = 0; if (!m.puffing) S.fp.raiseT = 0; }
  }
  if (m.cig === 2) {
    if (m.puffing && m.puffT >= 3.6) endPuff(); // 吸到上限：自动松开，一定会呛
    if (m.ash > 0.45) flickAsh(true);
    if (m.burn >= 1 && !S.stubbing) stub(true);
    if (S.t - (m.lastSync || 0) > 2) { m.lastSync = S.t; send({ t: 'sync', burn: +m.burn.toFixed(3), ash: +m.ash.toFixed(3) }); }
  }
}

// ---------- 其他人 ----------
function syncPeople(dt) {
  for (const [id, P] of S.people) { const p = S.players.get(id); if (!p || !seen(p) || id === S.meId) { P.dispose(); S.people.delete(id); } }
  for (const p of S.players.values()) {
    if (p.id === S.meId || !seen(p)) continue;
    let P = S.people.get(p.id);
    if (!P) { if (!peopleLoaded()) continue; P = makePerson(p); S.people.set(p.id, P); cur.scene.add(P.root); }
    // 位置和朝向平滑跟上，走动时摆腿
    if (p.rx === undefined) { p.rx = p.x; p.rz = p.y; p.rr = p.r || 0; }
    const k = Math.min(1, dt * 10), ox = p.rx, oz = p.rz;
    p.rx += (p.x - p.rx) * k; p.rz += (p.y - p.rz) * k;
    let pp = p.ia && posOf(p.ia.with);
    if (pp && ASKING.has(p.ia.kind) && Math.hypot(pp.x - p.rx, pp.z - p.rz) > 2.5) { p.ia = null; pp = null; } // 开口要的时候对方走开了：手放下，不追
    const face = p.ia && ASKING.has(p.ia.kind) ? (p.ia.at || pp) : pp;
    const want = face && Math.hypot(face.x - p.rx, face.z - p.rz) > 0.05 ? Math.atan2(-(face.x - p.rx), -(face.z - p.rz)) : (p.r || 0); // 互动时面向对方（开口要时只朝开口那一刻的方向）
    let dr = want - p.rr; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); p.rr += dr * k;
    const sp = Math.hypot(p.rx - ox, p.rz - oz) / Math.max(dt, 1e-3);
    p.walk = (p.walk || 0) + ((sp > 0.25 ? 1 : 0) - (p.walk || 0)) * Math.min(1, dt * 8);
    p.walkPhase = (p.walkPhase || 0) + dt * sp * 5.2;
    P.root.position.x = p.rx; P.root.position.z = p.rz; P.root.rotation.y = p.rr;
    // 递烟 / 点火时凑近：两人挪到 0.6–0.75 米（只是画面上挪，播完回原位）；对方是你自己时由他一个人走过来
    p.inter = interOf(p);
    if (p.inter && p.inter.kind !== 'ask' && p.inter.kind !== 'askFire' && pp) {
      // 对方是你：他一个人走过来，停远一点（第一人称里才看得到他整个人伸手过来）
      const toMe = p.ia.with === S.meId, handy = p.inter.kind === 'give' || p.inter.kind === 'take', tipK = p.inter.kind === 'tipGive' || p.inter.kind === 'tipTake';
      const dx = pp.x - p.rx, dz = pp.z - p.rz, d = Math.hypot(dx, dz), gap = toMe ? (handy ? 1.0 : tipK ? 1.12 : 1.0) : (handy ? 0.8 : tipK ? 0.75 : 0.9); // 烟头对烟头两人都探身，站远一点免得撞头
      const other = S.players.get(p.ia.with), still = p.pose !== 'stand', otherStill = other && other.pose !== 'stand';
      const share = still ? 0 : (toMe || otherStill) ? 1 : 0.5, mv = (d - gap) * share * p.inter.e; // 坐着躺着的不挪，站着的那个走过去 // 太远就凑近、太近（比如两人本来就挨着）就让开一点，头才不会撞在一起
      if (d > 0.01) { P.root.position.x += dx / d * mv; P.root.position.z += dz / d * mv; }
    }
    p.seed = p.seed ?? Math.random() * 10;
    P.update(p, S.t, dt);
    if (p.cig === 2) { p.smokeAcc = (p.smokeAcc || 0) + dt; const ev = p.puffing ? 0.05 : 0.1; while (p.smokeAcc > ev) { p.smokeAcc -= ev; const tp = P.tip(); if (tp) smoke.wisp(tp, tint(p.brand), 1.3); } }
  }
}

// ---------- 界面 ----------
function btn(act, label, key, cls = '', disabled = false) { return `<button class="act ${cls}" data-act="${act}" ${disabled ? 'disabled' : ''}><span class="k">${key}</span><span class="l">${esc(label)}</span></button>`; }
function renderBar() {
  const m = me(); if (!m) return;
  let h = '';
  if (S.place === 'shop') {
    if (m.item) h += btn('sip', itemVerb(m), 'E');
    h += btn('up', t('上天台', 'Rooftop'), 'Q', 'primary');
  } else {
    // 一个主键走完一根烟：抽一根 → 点火 → 点着了变成「吸一口」（按住吸）；点着之后才有弹烟灰、掐灭（这时小卖部按钮先收起来，Q 键照样能走，走了烟自动掐掉）
    const lit = m.cig === 2;
    if (lit) h += btn('puff', t('吸一口', 'Drag'), t('空格', 'Space'), 'hold primary') + btn('ash', t('弹烟灰', 'Flick ash'), 'X') + btn('main', t('掐灭', 'Stub out'), 'F');
    else h += btn('main', m.cig === 1 ? t('点火', 'Light') : t('抽一根', 'Take one'), t('空格', 'Space'), 'primary', !m.cig && !sticks(m));
    if (m.item) h += btn('sip', itemVerb(m), 'E');
    if (m.pose === 'sit' && S.seat?.ground) h += btn('liedown', t('躺下', 'Lie down'), 'R');
    if (m.pose !== 'stand') h += btn('getup', t('起来', 'Get up'), 'Q'); else if (!lit) h += btn('down', t('小卖部', 'Shop'), 'Q');
  }
  $('#bar').innerHTML = h;
}
// 零食饮料统一两个按钮：没打开是「打开」，打开后吃的是「吃一口」、喝的是「喝一口」（拆法动作照旧按各自的包装）
function itemVerb(m) { const it = ITEM[m.item]; return it.open && S.fp.openP < 1 ? t('打开', 'Open') : DRINK(m.item) ? t('喝一口', 'Sip') : t('吃一口', 'Bite'); }
function doAct(a) { ({ main: mainAction, ash: () => flickAsh(false), sip, up: () => goPlace(ROOF), down: () => goPlace('shop'), getup: () => setPose('stand'), liedown: () => setPose('lie', { ...S.seat, y: 0.04 }) })[a]?.(); }
$('#bar').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && b.dataset.act !== 'puff') doAct(b.dataset.act); });
$('#bar').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-act="puff"]'); if (b && !b.disabled) { e.preventDefault(); b.setPointerCapture?.(e.pointerId); startPuff(); } });
for (const t of ['pointerup', 'pointercancel']) $('#bar').addEventListener(t, (e) => { if (e.target.closest('[data-act="puff"]')) endPuff(); });

function openPerson(p, ev) {
  const m = me(); if (!m || !p) return;
  controls.unlock();
  const M = $('#personMenu');
  // 上面：TA 的名字 + 正在抽的那根（没在抽就是口袋里那包）；下面：TA 有烟才有「要根烟」，「借个火」常驻（条件不够点了会说为什么）
  const brand = (p.cig && p.brand) || (p.pack?.n > 0 && p.pack.id) || (p.loose?.length && p.loose[0]), packImg = brand && CIG[brand]?.img ? `${import.meta.env.BASE_URL}gen/cig/${brand}.png` : null;
  const btns = `${sticks(p) > 0 ? `<button data-p="ask">${t('要根烟', 'Bum a smoke')}</button>` : ''}<button data-p="fire" class="hot">${t('借个火', 'Ask for a light')}</button>`; // TA 没烟就不给「要根烟」
  M.innerHTML = `<b></b>${packImg ? `<img class="pk" src="${packImg}" alt="">` : ''}<div class="row">${btns}</div>`;
  M.querySelector('b').textContent = nameOf(p);
  M.dataset.id = p.id; M.classList.remove('hidden');
  const r = M.getBoundingClientRect();
  M.style.left = `${clamp(ev.clientX - r.width / 2, 8, innerWidth - r.width - 8)}px`; M.style.top = `${clamp(ev.clientY - r.height - 16, 60, innerHeight - r.height - 90)}px`;
}
// 借火：手里没烟但口袋有，就先自动抽出一根再借；烟已经点着、一根都没有、离太远、在店里，都弹一句说清楚
function askFire(id) {
  const m = me(), q = posOf(id); if (!m) return;
  if (S.place === 'shop') return notice(t('店里不能抽烟，去天台再借火吧', 'No smoking in the shop — try the roof.'));
  if (m.cig === 2) return notice(t('你的烟已经点着了', 'Your cigarette is already lit.'));
  if (!q || Math.hypot(q.x - controls.S.x, q.z - controls.S.z) > FIRE_REACH) return notice(t('走近一点再借火', 'Get a bit closer to ask for a light.'));
  if (m.cig === 1) return send({ t: 'ask', to: id, kind: 'fire' });
  if (!sticks(m)) return notice(t('你手上没烟，先跟人要一根吧', 'You have no cigarettes — bum one first.'));
  mainAction(); // 抽出一根
  const t0 = performance.now(), wait = () => { if (me()?.cig === 1) send({ t: 'ask', to: id, kind: 'fire' }); else if (performance.now() - t0 < 2500) setTimeout(wait, 100); };
  setTimeout(wait, 100);
}
$('#personMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b || b.disabled) return;
  const id = $('#personMenu').dataset.id, p = S.players.get(id); $('#personMenu').classList.add('hidden'); if (!p) return;
  if (b.dataset.p === 'ask') send({ t: 'ask', to: id });
  if (b.dataset.p === 'fire') askFire(id);
});
function showAsk(fromId, kind) {
  const p = S.players.get(fromId); if (!p) return;
  const fire = kind === 'fire';
  const el = document.createElement('div'); el.className = 'ask'; el.dataset.from = fromId;
  el.innerHTML = `<span class="who"><b></b>${fire ? t(' 想借个火', ' wants a light') : t(' 想要根烟', ' wants a smoke')}</span><button data-a="1" class="hot"><kbd>Y</kbd>${fire ? t('给他点', 'Light it') : t('给一根', 'Give one')}</button><button data-a="0"><kbd>N</kbd>${t('不给', 'No')}</button><i class="bar"></i>`;
  el.querySelector('b').textContent = nameOf(p);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const give = b.dataset.a === '1';
    if (give && fire) {
      // 用自己的打火机给他点；打火机坏了但自己正抽着，就烟头对烟头；坏了又没在抽，那就帮不了
      const how = !S.lighter?.dead ? 'lighter' : me()?.cig === 2 ? 'tip' : null;
      if (how) send({ t: 'answer', to: fromId, give: true, how });
      else { send({ t: 'answer', to: fromId, give: false, why: 'nofire' }); notice(t('打火机坏了，没法给他点', 'Your lighter is broken.')); }
    } else send({ t: 'answer', to: fromId, give });
    dropAsk(el);
  });
  $(`.ask[data-from="${fromId}"]`)?.remove(); // 同一个人又来要：换成新的
  $('#asks').appendChild(el); Snd.give();
  el._t = setTimeout(() => dropAsk(el), ASK_SHOW * 1000); // 8 秒没人理就自己消失
  // 最多同时 3 个：新的从下面进来，最旧的被顶到上面、慢慢消失
  const live = [...$('#asks').querySelectorAll('.ask:not(.gone)')];
  for (const old of live.slice(0, Math.max(0, live.length - ASK_MAX))) dropAsk(old);
}
const ASK_MAX = 3, ASK_SHOW = 8;
function dropAsk(el) { if (!el || el.classList.contains('gone')) return; clearTimeout(el._t); el.classList.add('gone'); setTimeout(() => el.remove(), 400); }
// 少数必要的提醒（比如火机坏了）：顶部一条，3 秒后淡出；同一句 3 秒内不重复弹
function notice(text) { const el = $('#notice'), now = performance.now(); if (el._t && el.textContent === text && now - el._at < 3000) return; el.textContent = text; el._at = now; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3000); }
function closePops() { $('#personMenu').classList.add('hidden'); $('#picker').classList.add('hidden'); }
// 点人弹窗：点它外面任何地方（包括拖动转头、点别的东西）就关掉；开始走路也关掉
addEventListener('pointerdown', (e) => { const M = $('#personMenu'); if (!M.classList.contains('hidden') && !M.contains(e.target)) M.classList.add('hidden'); }, true);

addEventListener('keydown', (e) => {
  if (cigShop.isOpen()) { if (e.key === 'Escape') cigShop.close(); return; }
  if (!S.entered || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
  const k = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) $('#personMenu').classList.add('hidden');
  if (k === 'Space') { e.preventDefault(); if (me()?.cig === 2) startPuff(); else mainAction(); } else if (k === 'KeyF') mainAction(); else if (k === 'KeyX') flickAsh(false); else if (k === 'KeyE') sip();
  else if (k === 'KeyQ') { const mm = me(); if (mm && mm.pose !== 'stand') doAct('getup'); else goPlace(S.place === 'shop' ? ROOF : 'shop'); }
  else if (k === 'KeyR' && me()?.pose === 'sit' && S.seat?.ground) doAct('liedown');
  else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) && me() && me().pose !== 'stand') doAct('getup'); // 坐着按方向键就起来
  else if (k === 'KeyY' || k === 'KeyN') { const card = [...document.querySelectorAll('#asks .ask:not(.gone)')].pop(); if (card) card.querySelector(`[data-a="${k === 'KeyY' ? 1 : 0}"]`).click(); }
  else if (k === 'Escape') closePops();
  else if (k === 'KeyP') { setPixel(S.pixel ? 0 : 3); }
});
addEventListener('keyup', (e) => { if (e.code === 'Space') endPuff(); });
addEventListener('blur', () => endPuff());
$('#soundBtn').addEventListener('click', () => { S.sound = !S.sound; store.set('smoke.sound', S.sound); $('#soundBtn').textContent = S.sound ? '🔊' : '🔇'; Snd.init(S.sound); Snd.setOn(S.sound); Snd.resume(); });
$('#soundBtn').textContent = S.sound ? '🔊' : '🔇';

// ---------- 烟柜弹窗 ----------
const cigShop = createCigShop({
  onTake: (id) => { send({ t: 'take', kind: 'pack', id }); Snd.rustle(); },
  onToggle: (open) => { if (open) { controls.unlock(); controls.S.keys.clear(); track('shop_open'); } },
});

// ---------- 网络 ----------
function mkPlayer(d) { return { ...d, puffing: false, puffT: 0, flame: 0, sipT: 0, loose: d.loose || [] }; }
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); S.ws = ws;
  ws.onopen = () => { $('#conn').classList.add('hidden'); send({ t: 'hello', internal: store.get('smoke.internal', false) || undefined, did: store.get('smoke.did', ''), sid: sess.get('smoke.sid', ''), ret: DEV_RET, dev: matchMedia('(pointer: coarse)').matches ? 'm' : 'd', lang: document.documentElement.lang, load: Math.round(performance.now()), tz: -new Date().getTimezoneOffset(), token: sess.get('smoke.token', '') || undefined, name: (sess.get('smoke.named', false) && sess.get('smoke.name', '')) || undefined }); };
  ws.onclose = () => { if (S.ws !== ws) return; if (S.idle) { $('#idle').classList.remove('hidden'); return; } $('#conn').classList.remove('hidden'); setTimeout(connect, 1500); }; // 发呆被请出去：不自动重连，等他点「回来」
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
}
function onMsg(m) {
  const p = m.id ? S.players.get(m.id) : null, mine = m.id === S.meId;
  switch (m.t) {
    case 'welcome': {
      S.meId = m.id; S.room = m.room; S.stats = m.stats; S.players.clear();
      S.helloed = true; while (evQ.length) S.ws.send(JSON.stringify(evQ.shift())); // 连上之前记下的页面动作补发
      if (m.token) sess.set('smoke.token', m.token); // 断线 / 刷新 / 服务器更新后拿这个回到原来的样子和位置（只在这次访问里有效）
      if (!$('#nameCard').classList.contains('hidden') && !$('#nameIn').value) { const d = m.players.find((q) => q.id === m.id); if (d) $('#nameIn').value = nameOf(d); }
      if (VISTA_IDS.includes(m.scene)) { ROOF = 'roof:' + m.scene; vistas.set(m.scene); }
      for (const d of m.players) S.players.set(d.id, mkPlayer(d));
      // 进门先在小卖部；开发时可以用 ?place=roof&pack=…&item=… 直接准备好
      if (qp.get('pack')) send({ t: 'take', kind: 'pack', id: qp.get('pack') });
      if (qp.get('item')) send({ t: 'take', kind: 'item', id: qp.get('item') });
      const mm = me(); enterPlace(mm.place, mm.x, mm.y, mm.r || 0);
      if (qp.get('place') === 'roof' || isRoof(qp.get('place'))) send({ t: 'place', to: ROOF });
      break;
    }
    case 'join': S.players.set(m.p.id, mkPlayer(m.p)); break;
    case 'leave': S.players.delete(m.id); break;
    case 'stats': S.stats = m.stats; break;
    case 'scene': if (VISTA_IDS.includes(m.vista)) { ROOF = 'roof:' + m.vista; if (!isRoof(S.place)) vistas.set(m.vista); renderBar(); } break; // 我们换了场景：在天台上的人服务器会把他挪过去
    case 'move': if (p) { p.x = m.x; p.y = m.y; if (m.r !== undefined) p.r = m.r; } break;
    case 'place': if (p) { Object.assign(p, { place: m.to, slot: m.slot, x: m.x, y: m.y, r: m.r, rx: undefined, cig: 0, burn: 0, ash: 0, puffing: false, pose: 'stand' }); if (mine) { p.brand = null; enterPlace(m.to, m.x, m.y, m.r); } } break;
    case 'gear': if (p) { if (mine && p.item !== m.item) { S.fp.use = null; S.fp.openP = ITEM[m.item]?.open ? 0 : 1; S.fp.eaten = 0; } p.item = m.item; p.pack = m.pack; p.loose = m.loose; if (mine) { if (m.pack) store.set('smoke.pack', m.pack.id); renderBar(); } } break;
    case 'idle': S.idle = true; controls.unlock(); break;
    case 'pose': if (p) { p.pose = m.v; p.seatY = m.y ?? 0; } break;
    case 'rename': if (p) { p.name = m.name; p.nameEn = m.nameEn; if (mine && !$('#nameCard').classList.contains('hidden')) { $('#nameIn').value = nameOf(p); $('#nameIn').select(); } } break;
    case 'sync': if (p) { p.burn = m.burn; p.ash = m.ash; } break;
    case 'act': {
      if (!p) break;
      if (mine) { if (m.a === 'draw') { S.awaitDraw = false; S.lighter = newLighter(); p.cig = 1; p.brand = m.brand; p.lastBrand = m.brand; p.burn = 0; p.ash = 0; S.fp.drawT = 0; Snd.rustle(); renderBar(); } break; }
      const P = S.people.get(p.id), { v: hv, pan: hp } = hear(p);
      if (m.a === 'draw') { p.cig = 1; p.brand = m.brand; p.burn = 0; p.ash = 0; }
      if (m.a === 'flick') { if (m.ok) { p.cig = 2; p.flame = 0.9; } } // 别人打火机的咔哒、火苗声不放（只听得到自己的，不然满场都是）
      if (m.a === 'puff') { p.puffing = true; p.puffT = 0; Snd.inhaleFar(hv, hp, false); } // 别人吸烟：吸气声照旧，只是不放烟丝燃烧的噼啪声
      if (m.a === 'exhale') { p.puffing = false; p.lastAmt = m.amt ?? 0.5; if (m.choke) return; const pt = (m.amt ?? 0.5) * 2.4; setTimeout(() => { const P2 = S.people.get(p.id); if (!P2 || p.place !== S.place) return; const h2 = hear(p); const from = P2.mouthW().clone(), dir = new THREE.Vector3(0, 0.1, -1).applyQuaternion(P2.root.quaternion); const dur = exhaleDur(pt); smoke.exhale(from, dir, (m.amt ?? 0.5) * 0.8, tint(p.brand), 1.0, dur); Snd.exhale(m.amt ?? 0.5, h2.v, dur + 0.3, h2.pan); }, exhaleDelay(pt > LUNG_MIN)); }
      if (m.a === 'ash' || m.a === 'stub') { const tp = P?.tip(); if (tp) smoke.ash(tp.clone()); p.ash = 0; if (m.a === 'stub') { p.cig = 0; p.burn = 0; p.puffing = false; p.brand = null; } }
      if (m.a === 'sip') p.sipT = 1.1;
      if (m.a === 'open') p.openT = 1.2;
      if (m.a === 'cough') { p.coughT = 1.5; Snd.cough(0.6, hv, hp); const amt = p.lastAmt ?? 0.3; p.lastAmt = 0.3; for (let i = 0; i < 3; i++) setTimeout(() => { const P2 = S.people.get(p.id); if (!P2 || p.place !== S.place) return; smoke.exhale(P2.mouthW().clone(), new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, -1).applyQuaternion(P2.root.quaternion), amt * 0.6 * (1 - i * 0.3), tint(p.brand), 1.0, 0.35); }, 60 + i * 420); } // 别人咳嗽：按距离；呛到的烟跟着喷出来
      break;
    }
    case 'ask': showAsk(m.from, m.kind); break;
    case 'asked': setInter(m.from, m.kind === 'fire' ? 'askFire' : 'ask', m.to, 9); break; // 他在跟人要：伸手 / 叼着烟凑过去等火
    case 'askGone': dropAsk($(`.ask[data-from="${m.from}"]:not(.gone)`)); break;
    case 'gave': { // 递烟：给的人把烟递过去，要的人伸手接
      clearInter(m.to, ['ask']); setInter(m.from, 'give', m.to, GIVE_T); setInter(m.to, 'take', m.from, GIVE_T); // 从烟盒里抽一根 → 递过去 → 对方接住
      if (m.to === S.meId || m.from === S.meId) setTimeout(() => Snd.give(), GIVE_T * 720);
      break;
    }
    case 'lit': { // 借火：对方拿打火机凑过来点（他火机坏了就烟头对烟头），点着之前烟还是没点的
      clearInter(m.to, ['askFire']);
      const tip = m.how === 'tip', dur = tip ? 2.2 : LIGHT_T, req = S.players.get(m.to), giver = S.players.get(m.from);
      setInter(m.from, tip ? 'tipGive' : 'lightGive', m.to, dur); setInter(m.to, tip ? 'tipTake' : 'lightTake', m.from, dur);
      if (req) req.cig = 1;
      if (!tip && (m.from === S.meId || m.to === S.meId)) setTimeout(() => Snd.click(1, 0), dur * 300); // 打火机凑到烟头下面才打着；跟我无关的借火不出声
      if (tip && giver) setTimeout(() => { giver.puffing = true; setTimeout(() => { giver.puffing = false; }, 600); }, dur * 450); // 烟头对上时他嘬一下，烟头更亮
      setTimeout(() => {
        const r = S.players.get(m.to); if (!r) return;
        r.cig = 2; r.flame = 0.5; if (m.from === S.meId || m.to === S.meId) Snd.flame(1, 0);
        if (m.to === S.meId) { S.light = null; S.fp.lighterT = 0; renderBar(); }
      }, dur * (tip ? 0.7 : 0.62));
      break;
    }
    // 拒绝给烟：拒绝的人右手摆一摆（所有人都看得到；自己拒绝的话第一人称也摆）
    case 'refused': {
      clearInter(m.to, ['ask', 'askFire']); const a = S.players.get(m.from); if (m.why === 'no' && a) { a.waveT = WAVE_T; if (a.id === S.meId) S.fp.waveT = WAVE_T; }
      if (m.to === S.meId && a) notice(nameOf(a) + (t({ no: ' 拒绝了你的请求', timeout: ' 没有理你', empty: '的烟抽完了', nofire: ' 没有火' }, { no: ' turned you down', timeout: ' didn\'t answer', empty: ' is out of smokes', nofire: ' has no fire' })[m.why] || t(' 拒绝了你的请求', ' turned you down'))); // 被拒的人顶上弹一条
      break;
    }
  }
}

// ---------- 启动 ----------
function startAudio() { Snd.init(S.sound); Snd.resume(); if (!Snd.samplesLoading) { Snd.samplesLoading = true; Snd.loadSamples(import.meta.env.BASE_URL); } } // 不放背景环境声，只有动作音效
// 浏览器（尤其 iPhone Safari）要在真正的点击 / 触摸 / 按键里才肯出声：任何一次操作都试着把声音打开，
// 没开成（或者切到别的 App 回来被挂起）就下次操作再试；再放一个静音的小片段把 iOS 的声音通道「解锁」
function unlockAudio() {
  if (!S.entered) return;
  startAudio(); const ac = Snd.ac; if (!ac || ac.state === 'running') return;
  ac.resume?.();
  try { const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(0); } catch {}
}
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, unlockAudio, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && Snd.ac && Snd.ac.state !== 'running') Snd.ac.resume?.(); });
// 年龄确认：满 18 岁才进；点了未满 18 岁就断开、只留一句「不能进入」（这台设备记住，下次打开也一样）
const blockMinor = () => { $('#ageCard').classList.add('hidden'); $('#blocked').classList.remove('hidden'); $('#gate').classList.remove('hidden'); if (S.ws) { const w = S.ws; S.ws = null; w.close(); } };
// 进门：满 18 岁之后先起个名字（每次打开网页起一次，刷新不用重起），起好再进
const enterGame = () => { S.entered = true; $('#gate').classList.add('hidden'); startAudio(); track('enter'); };
function askName() {
  $('#ageCard').classList.add('hidden'); $('#nameCard').classList.remove('hidden'); $('#gate').classList.remove('hidden'); track('name_shown');
  const inp = $('#nameIn'), m = me(); inp.value = m ? nameOf(m) : ''; inp.placeholder = t('起个名字', 'Your name');
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}
function confirmName() {
  const v = $('#nameIn').value.replace(/\s+/g, ' ').trim().slice(0, 12), m = me();
  if (v && (!m || v !== nameOf(m))) send({ t: 'rename', name: v });
  track('name_done', v && (!m || v !== nameOf(m)) ? 1 : 0); // 1 = 自己改了名字
  sess.set('smoke.name', v || (m ? nameOf(m) : '')); sess.set('smoke.named', true);
  enterGame();
}
$('#enterBtn').addEventListener('click', () => { track('age_ok'); store.set('smoke.adult', true); if (sess.get('smoke.named', false)) enterGame(); else askName(); });
$('#nameBtn').addEventListener('click', confirmName);
$('#backBtn').addEventListener('click', () => { S.idle = false; $('#idle').classList.add('hidden'); $('#conn').classList.remove('hidden'); connect(); }); // 回来：按原样续上（位置、东西都在）
$('#nameIn').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') confirmName(); });
$('#diceBtn').addEventListener('click', () => { send({ t: 'rename', random: true }); track('dice'); }); // 摇一个新的随机名
$('#minorBtn').addEventListener('click', () => { track('age_minor'); store.set('smoke.minor', true); setTimeout(blockMinor, 150); }); // 先把这一步报上去再断开
const isMinor = store.get('smoke.minor', false);
if (isMinor) blockMinor();
else if (store.get('smoke.adult', false) && !sess.get('smoke.named', false)) askName(); // 满过 18 岁但这次访问还没起名字：先起名字
else if (store.get('smoke.adult', false)) { S.entered = true; } /* 声音在第一次操作时由 unlockAudio 打开 */
else { $('#gate').classList.remove('hidden'); track('gate'); } // 第一次来：先年龄确认

const look0 = { hoodie: 1, skin: 0, hair: 0, pants: 0 };
createHands(camera, look0).then((h) => { hands = h; const m = me(); if (m) h.setLook(m.look); }).catch((e) => console.error('手模型加载失败', e));
if (!isMinor) connect();
// 默认像素风（用户选的画风）；?pixel=0 看写实，?pixel=4 换像素大小
{ const px = qp.get('pixel'); setPixel(px === null ? 3 : Number(px) > 0 ? Math.max(2, Math.min(8, Number(px))) : 0); }
requestAnimationFrame(frame);
setTimeout(loadingDone, 600);
// 自己的形象拿到以后给手上色
setInterval(() => { const m = me(); if (hands && m && !hands._looked) { hands.setLook(m.look); hands._looked = true; } }, 500);
// 调试用
window.__smoke = { aimClick: (button = 0) => onClick({ ...controls.center(), button }), aimHover: () => hover(controls.center()), vistas, controls: controls.S, cigShop, setPose, roof, S, scene, camera, get hands() { return hands; }, bloom, composer };
