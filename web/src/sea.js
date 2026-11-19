// 海边：海面（反射+法线波浪）、山坡上的小镇、海岛灯塔、远山、渔船
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tex, canvasTex, rng, glowTex } from './textures.js';

const SEA_Y = -24;

function noise2(x, y) { return Math.sin(x * 0.013 + Math.sin(y * 0.021) * 2) * 0.5 + Math.sin(y * 0.017 + x * 0.007) * 0.5; }
// 值噪声 + 分形（山脊用）
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o = 6) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSea(scene) {
  const group = new THREE.Group(); scene.add(group);
  const r = rng(42);

  // ---------- 海面 ----------
  const normals = tex('tex/waternormals.jpg'); normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  const water = new Water(new THREE.PlaneGeometry(30000, 30000), {
    textureWidth: 1024, textureHeight: 1024, waterNormals: normals,
    sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x0a2a3c, distortionScale: 3.2, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = SEA_Y;
  water.material.uniforms.size.value = 2.2;
  group.add(water);

  // ---------- 山坡和沙滩（楼脚下一直到海边）----------
  const tw = 900, td = 330, terr = new THREE.PlaneGeometry(tw, td, 180, 66);
  terr.rotateX(-Math.PI / 2);
  const tp = terr.attributes.position, colors = new Float32Array(tp.count * 3);
  const grass = new THREE.Color('#4a5a3a'), rock = new THREE.Color('#6a6258'), sand = new THREE.Color('#cdb894'), wetSand = new THREE.Color('#8a7a62');
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), zLocal = tp.getZ(i), z = zLocal - td / 2 + 30; // z 从 +30 到 -300
    const k = Math.min(1, Math.max(0, (-z) / 260));          // 0 楼脚下 → 1 海边
    let y = -21.5 - k * 2.4 + noise2(x, z) * 0.9 * (1 - k) - Math.max(0, k - 0.85) * 14;
    if (Math.abs(x) > 260) y += (Math.abs(x) - 260) * 0.12 + noise2(x * 2, z) * 4;   // 两边的岬角
    tp.setY(i, y); tp.setZ(i, z);
    const c = k > 0.86 ? (k > 0.93 ? wetSand : sand) : grass.clone().lerp(rock, Math.abs(noise2(x * 3, z * 3)) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  terr.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terr.computeVertexNormals();
  const ground = new THREE.Mesh(terr, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true; group.add(ground);
  // 浪花线
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(tw, 6), new THREE.MeshBasicMaterial({ color: '#e8f2f4', transparent: true, opacity: 0.35, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, SEA_Y + 0.05, -258); group.add(foam);

  // ---------- 小镇：带亮灯窗户的房子 ----------
  const winTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 30; y < h - 20; y += 60) for (let x = 24; x < w - 20; x += 56) {
      const lit = Math.random() < 0.55;
      g.fillStyle = lit ? (Math.random() < 0.8 ? '#ffc76a' : '#bcd8ff') : '#000'; g.fillRect(x, y, 24, 28);
    }
  });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const roofG = new THREE.ConeGeometry(0.78, 0.45, 4, 1); roofG.rotateY(Math.PI / 4); roofG.translate(0, 1.22, 0);
  const N = 170;
  const walls = new THREE.InstancedMesh(box, wallMat, N), roofs = new THREE.InstancedMesh(roofG, roofMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const wallCols = ['#e8e2d6', '#d8c8b0', '#f2efe8', '#c8d0d4', '#e6d2c0', '#b8c4b8'], roofCols = ['#9a3a2a', '#3a4a5a', '#5a3a2a', '#2a5a6a', '#7a5a3a'];
  let n = 0; const housePts = [];
  for (let i = 0; i < N * 3 && n < N; i++) {
    const x = (r() - 0.5) * 520, z = -30 - r() * 200;
    if (Math.abs(x) < 26 && z > -60) continue; // 楼正下方留空
    const k = Math.min(1, (-z) / 260), y = -21.5 - k * 2.4 + noise2(x, z) * 0.9 * (1 - k);
    const w = 5 + r() * 6, h = 4 + r() * 7, d = 5 + r() * 6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.4);
    m.compose(p.set(x, y - 0.3, z), q, s.set(w, h, d)); walls.setMatrixAt(n, m);
    m.compose(p.set(x, y - 0.3, z), q, s.set(w * 1.05, h, d * 1.05)); roofs.setMatrixAt(n, m);
    housePts.push([x, z, Math.max(w, d)]);
    walls.setColorAt(n, new THREE.Color(wallCols[(r() * wallCols.length) | 0]));
    roofs.setColorAt(n, new THREE.Color(roofCols[(r() * roofCols.length) | 0]));
    n++;
  }
  walls.count = roofs.count = n; walls.castShadow = roofs.castShadow = true; walls.receiveShadow = true;
  group.add(walls, roofs);

  // 海边路灯
  const lampPos = [];
  for (let x = -420; x <= 420; x += 22) lampPos.push(x, -23.6 + 4.5, -236 + Math.sin(x * 0.02) * 3);
  for (let i = 0; i < 60; i++) { const x = (r() - 0.5) * 480, z = -40 - r() * 190; const k = Math.min(1, (-z) / 260); lampPos.push(x, -21.5 - k * 2.4 + 4, z); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
  const lamps = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTex('255,200,130'), size: 2.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  group.add(lamps);

  // ---------- 远山和海岛 ----------
  const mountMat = new THREE.MeshStandardMaterial({ color: '#3a4a52', roughness: 1, flatShading: true });
  const mountain = (x, z, w, h, seed) => {
    const g = new THREE.ConeGeometry(w, h, 9, 4); const pp = g.attributes.position; const rr = rng(seed);
    for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i); if (yy < h / 2 - 1) { pp.setX(i, pp.getX(i) * (0.8 + rr() * 0.5)); pp.setZ(i, pp.getZ(i) * (0.8 + rr() * 0.5)); pp.setY(i, yy + (rr() - 0.5) * h * 0.08); } }
    g.computeVertexNormals();
    const me = new THREE.Mesh(g, mountMat); me.position.set(x, SEA_Y + h / 2 - 20, z); me.scale.z = 0.6; group.add(me); return me;
  };
  // 三层山脊：最远一排横在海平线上（中间低，留出开阔海面），左边近处是岬角，右边是另一段海岸；越远越蓝越朦胧
  const ridgeMats = [];
  const ridge = ({ z, x = 0, width, depth, height, seed, low, mid, high, snow = 2, mask, fog = true }) => {
    const g = new THREE.PlaneGeometry(width, depth, 260, 34); g.rotateX(-Math.PI / 2);
    const pp = g.attributes.position, col = new Float32Array(pp.count * 3), cL = new THREE.Color(low), cM = new THREE.Color(mid), cH = new THREE.Color(high), cS = new THREE.Color('#eef2f6'), tmp = new THREE.Color();
    for (let i = 0; i < pp.count; i++) {
      const lx = pp.getX(i), lz = pp.getZ(i), wx = lx + x;
      const prof = Math.pow(Math.sin(Math.PI * (lz / depth + 0.5)), 1.4);                 // 前后两边落到海里
      const peaks = 0.25 + 0.75 * Math.pow(fbm(wx * 0.00042 + seed, seed * 1.7, 4), 1.6) * 1.8; // 有高有低的主峰
      const detail = fbm(wx * 0.0021 + seed * 3, lz * 0.003 + seed, 6);
      const k = mask ? mask(wx) : 1;
      const h = height * prof * peaks * (0.55 + 0.6 * detail) * k;
      pp.setY(i, h);
      const e = h / height;
      tmp.copy(cL).lerp(cM, smooth(0.1, 0.45, e)).lerp(cH, smooth(0.45, 0.8, e));
      if (e > snow) tmp.lerp(cS, smooth(snow, snow + 0.15, e) * (0.7 + detail * 0.3));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog }); ridgeMats.push(mt);
    const me = new THREE.Mesh(g, mt); me.position.set(x, SEA_Y - 40, z); group.add(me); return me;
  };
  ridge({ z: -15500, width: 46000, depth: 5000, height: 2900, seed: 11, low: '#4a5a66', mid: '#5c6a78', high: '#7a8794', snow: 0.62, fog: false, mask: (wx) => 0.45 + 0.55 * smooth(1500, 9000, Math.abs(wx - 600)) }); // 太远了，雾会把它盖没：颜色本身已经是远山的灰蓝
  ridge({ z: -6200, x: -9200, width: 12000, depth: 3400, height: 1150, seed: 23, low: '#2f4a32', mid: '#46583c', high: '#6a6a5c', snow: 0.9, mask: (wx) => smooth(-1800, -4200, wx) });
  ridge({ z: -8200, x: 9800, width: 12000, depth: 3000, height: 820, seed: 37, low: '#344c38', mid: '#4c5c46', high: '#6c6e62', snow: 0.95, mask: (wx) => smooth(2600, 5200, wx) });
  const island = mountain(1500, -3200, 420, 230, 5);
  // 灯塔
  const lhH = 44, stripes = canvasTex(64, 256, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c8382c' : '#f4f2ec'; g.fillRect(0, i * 32, 64, 32); } });
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, lhH, 20), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 }));
  lh.position.set(1580, island.position.y + 100 + lhH / 2, -3160); group.add(lh);
  const lampY = lh.position.y + lhH / 2 + 4;
  const lhLamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 8), new THREE.MeshBasicMaterial({ color: '#fff4d0' }));
  lhLamp.position.set(1580, lampY, -3160); group.add(lhLamp);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    // vY 要先夹到 0..1：开了多重采样抗锯齿，三角形边缘的像素会在三角形外面取值，vY 略小于 0，
    // pow(负数) 是 NaN，泛光会把它扩散成一大块黑色方块（白天光束不可见也照样会算）
    fragmentShader: `uniform float uOpacity; varying float vY; void main(){ gl_FragColor = vec4(1., .95, .8, pow(clamp(vY, 0., 1.), 2.5) * uOpacity * .5); }`,
  });
  const beamG = new THREE.ConeGeometry(120, 2600, 24, 1, true); beamG.translate(0, -1300, 0); beamG.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamG, beamMat); beam.position.copy(lhLamp.position); group.add(beam);
  const lhGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,240,200'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lhGlow.position.copy(lhLamp.position); lhGlow.scale.setScalar(120); group.add(lhGlow);

  // ---------- 小镇周围山坡上的树 ----------
  {
    const crown = new THREE.IcosahedronGeometry(1, 0); crown.translate(0, 1.5, 0); crown.scale(1, 1.25, 1);
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 5); trunk.translate(0, 0.6, 0);
    const treeG = mergeGeometries([trunk.toNonIndexed(), crown.toNonIndexed()]);
    const treeCols = treeG.attributes.position.count, tc = new Float32Array(treeCols * 3), tcount = trunk.toNonIndexed().attributes.position.count;
    for (let i = 0; i < treeCols; i++) tc.set(i < tcount ? [0.35, 0.25, 0.18] : [1, 1, 1], i * 3);
    treeG.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const TN = 420, trees = new THREE.InstancedMesh(treeG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), TN);
    const greens = ['#3e5e34', '#4a6a38', '#355a3a', '#5a6e3a', '#2f4f30'];
    let tn = 0;
    for (let i = 0; i < TN * 4 && tn < TN; i++) {
      const x = (r() - 0.5) * 880, z = -20 - r() * 215;
      if (Math.abs(x) < 30 && z > -55) continue;
      const k = Math.min(1, (-z) / 260); if (k > 0.82) continue;                      // 不种在沙滩上
      if (housePts.some(([hx, hz, hs]) => Math.hypot(hx - x, hz - z) < hs * 0.7 + 5)) continue; // 不挡房子和窗户的灯
      const y = -21.5 - k * 2.4 + noise2(x, z) * 0.9 * (1 - k) + (Math.abs(x) > 260 ? (Math.abs(x) - 260) * 0.12 : 0);
      const sc = 1.5 + r() * 2.0;
      m.compose(p.set(x, y - 0.2, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), s.set(sc, sc * (0.8 + r() * 0.5), sc));
      trees.setMatrixAt(tn, m); trees.setColorAt(tn, new THREE.Color(greens[(r() * greens.length) | 0])); tn++;
    }
    trees.count = tn; trees.castShadow = true; trees.receiveShadow = true; group.add(trees);
  }
  // ---------- 云：低多边形的一团团，慢慢飘 ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const parts = []; const cn = 5 + ((r() * 5) | 0);
    for (let k = 0; k < cn; k++) { const ball = new THREE.IcosahedronGeometry(1, 1); ball.scale(1 + r() * 0.8, 0.55 + r() * 0.3, 0.8 + r() * 0.5); ball.translate((k - cn / 2) * 1.1 + (r() - 0.5), r() * 0.4, (r() - 0.5) * 0.8); parts.push(ball); }
    const cl = new THREE.Mesh(mergeGeometries(parts), cloudMat); const sc = 140 + r() * 260;
    cl.scale.setScalar(sc); cl.position.set((r() - 0.5) * 24000, 900 + r() * 1300, -2500 - r() * 11000); group.add(cl); clouds.push({ m: cl, v: 4 + r() * 8 });
  }

  // ---------- 渔船 ----------
  const boats = [];
  const hullG = new THREE.BoxGeometry(14, 3, 4); hullG.translate(0, 1.5, 0);
  const cabG = new THREE.BoxGeometry(5, 3, 3); cabG.translate(-2, 4.5, 0);
  const boatG = mergeGeometries([hullG, cabG]);
  const boatMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.7 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(boatG, boatMat); b.position.set((r() - 0.5) * 3000, SEA_Y, -500 - r() * 2200); b.rotation.y = r() * Math.PI; group.add(b);
    const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,220,150'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    light.position.set(0, 8, 0); light.scale.setScalar(18); b.add(light);
    boats.push({ mesh: b, light, v: 0.6 + r() * 1.4, dir: r() < 0.5 ? 1 : -1 });
  }

  return {
    group, water, boats,
    update(dt, t, sky, atmo) {
      const c = sky.state.c, n = c.night;
      const u = water.material.uniforms;
      u.time.value += dt * 0.55;
      const useMoon = c.sunElev < -2;
      u.sunDirection.value.copy(useMoon ? sky.state.moonDir : sky.state.sunDir).normalize();
      u.sunColor.value.copy(useMoon ? new THREE.Color('#9aaad8').multiplyScalar(Math.max(0, Math.min(1, (c.moonElev + 2) / 8)) * 0.8) : atmo.sunColor);
      u.waterColor.value.set('#0a2a3c').lerp(new THREE.Color('#020812'), n);
      wallMat.emissiveIntensity = n * 1.6;
      lamps.material.opacity = Math.min(1, n * 1.4);
      beamMat.uniforms.uOpacity.value = n; beam.visible = n > 0.01; // 白天看不见就不画
      beam.rotation.y = t * 0.7;
      lhGlow.material.opacity = 0.3 + n * 0.7;
      lhLamp.material.color.setScalar(0.6 + n * 0.4);
      mountMat.color.set('#3a4a52').lerp(new THREE.Color('#0a0e18'), n);
      for (const mt of ridgeMats) mt.color.setScalar(1 - n * 0.78);
      cloudMat.color.set('#ffffff').lerp(new THREE.Color('#ffd6b0'), c.dusk || 0).lerp(new THREE.Color('#2a3048'), n);
      for (const cl of clouds) { cl.m.position.x += cl.v * dt; if (cl.m.position.x > 13000) cl.m.position.x = -13000; }
      for (const b of boats) { b.mesh.position.x += b.v * b.dir * dt; b.mesh.position.y = SEA_Y + Math.sin(t * 0.8 + b.v) * 0.4; b.light.material.opacity = n; }
    },
  };
}
