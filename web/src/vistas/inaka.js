// 夏日乡间：两层小楼的楼顶，看一片日本乡下的山谷。门前一条乡间小路、电线杆和电线、公交站、两台亮着的自动贩卖机；
// 往前是一块块水田（风吹过来稻浪一层层翻）、有几块灌着水映着天；田间散落着瓦顶和茅草顶的老屋，屋后有树、竹林、土仓；
// 左边一片长草坡，草被风吹得一波一波；田埂边一小片向日葵；山脚下有个红鸟居的小神社；四周是杉树和阔叶树混着的里山，
// 再远是一层层被空气染蓝的山，山后堆着夏天的积雨云，云影在田野上慢慢走。
// 天台是像素风；这里刻意用另一套做法：Blender 建的细模型（scripts/blender/inaka.py）、成片的草叶、稻田着色器、立体的云。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canvasTex, glowTex } from '../textures.js';
import { rng, fbm, smooth, clamp, lerp, makeLights, ridge, makeArt, artSky, GLSL, LOW, nightSky } from './common.js';

const G = -7;                         // 两层楼
const MODELS = `${import.meta.env.BASE_URL}vista-models/inaka/`;
const ZONE = 2400;                    // 近处地块图覆盖的范围（米），中心在 (0, -880)
const ZC = new THREE.Vector2(0, -880);
const WIND = new THREE.Vector2(0.8, -0.6).normalize();

// ---------- 地形：山谷底平，四周起里山 ----------
const valley = (x, z) => Math.max(smooth(-620 - Math.max(0, -z) * 0.12, -1100 - Math.max(0, -z) * 0.2, x), smooth(680 + Math.max(0, -z) * 0.1, 1150 + Math.max(0, -z) * 0.2, x), smooth(-1800, -2700, z), smooth(240, 520, z));
function hgt(x, z) {
  const v = valley(x, z);
  return G + (fbm(x * 0.012, z * 0.012, 2) - 0.5) * 0.5 * (1 - v) + v * v * 35 + Math.pow(fbm(x * 0.0015 + 4, z * 0.0015 + 1, 5), 1.3) * 230 * v;
}
// 林子：成片的，林地和草坡交错（地面着色器里有一模一样的公式，地面颜色和树的分布对得上）
const forestF = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.0041 + 1.3 * Math.sin(z * 0.0023)) + 0.25 * Math.sin(z * 0.0037 + 0.9 * Math.sin(x * 0.0029 + 2));
const GLSL_FOREST = 'float forestF(vec2 p){ return .5 + .25 * sin(p.x * .0041 + 1.3 * sin(p.y * .0023)) + .25 * sin(p.y * .0037 + .9 * sin(p.x * .0029 + 2.)); }';
// 小路和河（地块图、电线杆、房子都用）
const ROAD_Z = -16;
const branch = (t) => new THREE.Vector2(40 + Math.sin(t * 2.2) * 30 + t * 90, -18 - t * 560); // 从门前伸进山谷的小路，t: 0..1
const stream = (t) => new THREE.Vector2(-1100 + t * 2200, -260 - Math.sin(t * 6.5) * 80 - t * 160);

// 共用的着色片段：云影、风浪
const GLSL_WIND = `
uniform float uTime, uCloudK; uniform vec2 uWind;
float cloudSh(vec2 p){ vec2 q = p * .0009 + uWind * uTime * .006; float n = vn21(q) * .62 + vn21(q * 2.3 + 7.) * .38; return mix(1., .62, smoothstep(.46, .7, n) * uCloudK); }
float gust(vec2 p){ float a = dot(p, uWind); return .5 + .5 * sin(a * .09 - uTime * 1.7 + vn21(p * .012) * 7.) * (.55 + .45 * sin(a * .021 - uTime * .45)); }
`;

export function createInaka(scene) {
  const group = new THREE.Group(); scene.add(group); group.visible = false;
  const r = rng(808);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmpC = new THREE.Color();
  const U = { uTime: { value: 0 }, uCloudK: { value: 1 }, uWind: { value: WIND.clone() } };
  const shared = { uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uMid: { value: new THREE.Color() } };

  // ---------- 地块图：水田 / 灌水的田和河 / 路，一张 Canvas 画好当贴图用 ----------
  const RES = LOW ? 1024 : 2048, px = RES / ZONE;
  const toPx = (x, z) => [(x - ZC.x) * px + RES / 2, (z - ZC.y) * px + RES / 2];
  const plots = []; // 水田的格子（放稻子用）
  const zoneCanvas = document.createElement('canvas'); zoneCanvas.width = zoneCanvas.height = RES;
  const zc = zoneCanvas.getContext('2d');
  {
    zc.fillStyle = '#000'; zc.fillRect(0, 0, RES, RES);
    // 水田：沿着山谷底一行行排，格子大小不一、略歪；每块之间留一条田埂
    for (let z = -40; z > -1900; z -= 26 + r() * 22) {
      const rowH = 22 + r() * 16;
      for (let x = -1000; x < 1000;) {
        const w = 28 + r() * 40, cx = x + w / 2, cz = z - rowH / 2;
        x += w;
        if (valley(cx, cz) > 0.02 || (cx < -150 && cz > -260)) continue;      // 左前方留给草坡
        if (Math.hypot(cx, cz) < 45) continue;
        const water = r() < 0.16;
        const lev = 0.7;                                                    // 田埂宽（米）
        const [a, b] = toPx(x - w + lev, z - lev), [c, d] = toPx(x - lev, z - rowH + lev);
        zc.fillStyle = water ? '#ffff00' : '#ff0000';
        const sk = (r() - 0.5) * 3 * px;
        zc.beginPath(); zc.moveTo(a + sk, b); zc.lineTo(c, b); zc.lineTo(c - sk, d); zc.lineTo(a, d); zc.closePath(); zc.fill();
        plots.push({ x0: x - w + lev, x1: x - lev, z0: z - rowH + lev, z1: z - lev, water });
      }
    }
    // 小河：一道窄窄的水
    zc.strokeStyle = '#00ff00'; zc.lineCap = 'round'; zc.lineWidth = 7 * px; zc.beginPath();
    for (let i = 0; i <= 80; i++) { const p = stream(i / 80); const [a, b] = toPx(p.x, p.y); i ? zc.lineTo(a, b) : zc.moveTo(a, b); }
    zc.stroke();
    // 路：门前的柏油路、伸进山谷的小路、田间的土路
    const line = (pts, w, col) => { zc.strokeStyle = col; zc.lineWidth = w * px; zc.lineJoin = 'round'; zc.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = toPx(x, z); i ? zc.lineTo(a, b) : zc.moveTo(a, b); }); zc.stroke(); };
    line([[-800, ROAD_Z], [800, ROAD_Z]], 6, '#0000ff');
    line(Array.from({ length: 40 }, (_, i) => { const p = branch(i / 39); return [p.x, p.y]; }), 4.2, '#0000ff');
    line([[-420, -330], [-120, -300], [120, -340], [420, -310]], 2.4, '#000080');
    line([[-300, -150], [-200, -500]], 2.2, '#000080');
  }
  const zoneTex = new THREE.CanvasTexture(zoneCanvas); zoneTex.colorSpace = THREE.NoColorSpace; zoneTex.anisotropy = 8;
  const zoneData = zc.getImageData(0, 0, RES, RES).data;
  const zoneAt = (x, z) => { const [a, b] = toPx(x, z); const i = ((Math.min(RES - 1, Math.max(0, b | 0)) * RES) + Math.min(RES - 1, Math.max(0, a | 0))) * 4; return [zoneData[i] / 255, zoneData[i + 1] / 255, zoneData[i + 2] / 255]; };

  // ---------- 地面材质：草地、稻田（风吹稻浪）、水面、路、远处的林子，带云影 ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 });
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, shared, { tZone: { value: zoneTex } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGW; uniform sampler2D tZone; uniform vec3 uSunDir, uSunCol, uSky, uHor, uMid;
        ${GLSL.HASH}${GLSL_WIND}${GLSL_FOREST}
        float gWater = 0.; float gCS = 1.;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 p = vGW.xz; vec2 zuv = (p - vec2(${ZC.x.toFixed(1)}, ${ZC.y.toFixed(1)})) / ${ZONE.toFixed(1)} + .5;
          float inZ = step(0., zuv.x) * step(zuv.x, 1.) * step(0., zuv.y) * step(zuv.y, 1.);
          vec4 z = texture2D(tZone, zuv) * inZ;
          float fw = length(fwidth(p));
          float n1 = vn21(p * .05), n2 = vn21(p * .23 + 3.), n3 = vn21(p * 1.1 + 9.);
          float slope = 1. - normalize(vNormal).y;
          // 草地：几种绿斑驳，近处有细碎的明暗
          vec3 grass = mix(vec3(.24, .42, .12), vec3(.42, .56, .18), n1) * (.82 + .3 * n2) * mix(.85 + .3 * n3, 1., smoothstep(.5, 3., fw));
          grass = mix(grass, vec3(.5, .52, .24), smoothstep(.6, .8, vn21(p * .011)) * .4);
          // 远处的山：杉林深绿、阔叶林浅绿，一团团树冠
          float hill = smoothstep(2., 18., vGW.y - (${G.toFixed(1)}));
          float canopy = vn21(p * .07) * .6 + vn21(p * .21) * .4;
          vec3 forest = mix(vec3(.08, .2, .09), vec3(.24, .4, .14), smoothstep(.35, .75, vn21(p * .004 + 2.))) * (.65 + .55 * canopy);
          float fm = smoothstep(.5, .6, forestF(p)) * smoothstep(1., 10., vGW.y - (${G.toFixed(1)}));
          vec3 col = mix(grass, forest, clamp(fm + slope * .9 + smoothstep(120., 260., vGW.y - (${G.toFixed(1)})), 0., 1.));
          // 稻田：亮黄绿，风吹过一道道亮的稻浪
          float g = gust(p);
          vec3 rice = mix(vec3(.36, .6, .16), vec3(.62, .74, .26), g * .7) * (.9 + .15 * n2);
          col = mix(col, rice, z.r * (1. - z.g));
          // 水：灌了水的田、小河 —— 映着天
          gWater = z.g;
          // 路
          col = mix(col, vec3(.22, .22, .23) * (.9 + .2 * n3), step(.8, z.b));
          col = mix(col, vec3(.58, .5, .38) * (.85 + .3 * n2), step(.3, z.b) * (1. - step(.8, z.b)));
          // 草地上也有风吹过的亮带
          col *= 1. + (g - .5) * .14 * (1. - z.r) * (1. - hill);
          diffuseColor.rgb = col;
          gCS = cloudSh(p); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .06, gWater);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= gCS; reflectedLight.directSpecular *= gCS;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (gWater > .01) { // 水面：按菲涅尔混天色，太阳碎光
          vec3 V = normalize(cameraPosition - vGW); vec2 pp = vGW.xz;
          vec3 N = normalize(vec3((vn21(pp * .6 + uTime * .3) - .5) * .08, 1., (vn21(pp * .6 - uTime * .25 + 5.) - .5) * .08));
          float fr = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
          vec3 R = reflect(-V, N);
          vec3 skyc = mix(uHor, uMid, clamp(R.y * 3., 0., 1.));
          float sp = pow(max(dot(R, uSunDir), 0.), 400.) * 6.;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.05, .07, .06), gWater);
          totalEmissiveRadiance += (skyc * fr * .9 + uSunCol * sp) * gWater * gCS;
        }`);
  };
  groundMat.customProgramCacheKey = () => 'inakaground';
  const terrain = (W, seg, cz, hole) => {
    const g = new THREE.PlaneGeometry(W, W, seg, seg); g.rotateX(-Math.PI / 2); g.translate(0, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); let y = hgt(x, z); if (hole && Math.abs(x - hole[0]) < hole[2] && Math.abs(z - hole[1]) < hole[2]) y -= 8; p.setY(i, y); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; group.add(m); return m;
  };
  terrain(ZONE, LOW ? 220 : 360, ZC.y, null);
  terrain(16000, 260, -2000, [ZC.x, ZC.y, ZONE / 2 - 30]);

  // ---------- 远山：一层层被空气染蓝 ----------
  const ridges = [
    ridge(group, { z: -3600, x: 0, y: G - 20, width: 18000, depth: 2200, height: 520, seed: 5, low: '#2e4a30', mid: '#3e5a38', high: '#4e6a44', snow: 2, segX: 200, segZ: 18 }),
    ridge(group, { z: -6200, x: 1500, y: G - 30, width: 26000, depth: 3000, height: 900, seed: 9, low: '#3a5446', mid: '#4a6050', high: '#5a6e5c', snow: 2, fog: false, segX: 200, segZ: 18 }),
    ridge(group, { z: -10500, x: -2000, y: G - 40, width: 36000, depth: 4000, height: 1500, seed: 17, low: '#5a7080', mid: '#6a8090', high: '#7a90a0', snow: 2, fog: false, segX: 200, segZ: 18 }),
    ridge(group, { z: 4200, x: 0, y: G - 20, width: 20000, depth: 2400, height: 600, seed: 21, low: '#2e4a30', mid: '#3e5a38', high: '#4e6a44', snow: 2, segX: 160, segZ: 16 }),
  ];
  ridges.forEach((m, i) => { m.userData.noShadow = true; m.userData.k = i === 3 ? 0.2 : [0.15, 0.45, 0.72][i]; m.material.color.set('#ffffff'); });

  // ---------- 草叶：近处成片的草，被风吹得一波一波；逆光时草尖发亮 ----------
  const grassMat = (rice) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uBase: { value: new THREE.Color(rice ? '#2e5a14' : '#36581a') }, uTip: { value: new THREE.Color(rice ? '#8ab838' : '#b8c858') }, uStiff: { value: rice ? 0.45 : 1 } }]),
    vertexShader: `attribute vec4 aOff; attribute vec2 aSc;
      uniform float uTime, uStiff; uniform vec2 uWind;
      varying float vT; varying float vV; varying vec3 vWP; varying float vCS;
      ${GLSL.HASH}${GLSL_WIND.replace('uniform float uTime, uCloudK; uniform vec2 uWind;', 'uniform float uCloudK;')}
      #include <fog_pars_vertex>
      void main(){
        float t = position.y; vT = t; vV = aOff.w;
        float c = cos(aOff.w * 6.283), s = sin(aOff.w * 6.283);
        vec3 lp = vec3(position.x * aSc.x, t * aSc.y, 0.);
        lp = vec3(lp.x * c, lp.y, lp.x * s);
        vec2 wp = aOff.xz;
        float g = gust(wp);
        float bend = (g * 1.1 + .25 + .15 * sin(uTime * 2.3 + aOff.w * 30.)) * uStiff;
        vec3 p = aOff.xyz + lp;
        p.xz += uWind * bend * t * t * aSc.y * .55;
        p.y -= bend * t * t * aSc.y * .18;
        vWP = p; vCS = cloudSh(p.xz);
        vec4 mvPosition = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uBase, uTip, uSunDir, uSunCol, uSky, uGround; varying float vT; varying float vV; varying vec3 vWP; varying float vCS;
      #include <fog_pars_fragment>
      void main(){
        float hv = fract(vV * 13.7);
        vec3 col = mix(uBase, uTip, vT) * (.82 + .36 * hv);
        col = mix(col, col * vec3(1.15, 1.05, .7), step(.82, fract(vV * 7.3)) * vT);   // 有的草尖偏黄，有的偏青
        vec3 V = normalize(cameraPosition - vWP);
        float sunUp = max(uSunDir.y, 0.);
        vec3 light = mix(uGround, uSky, .55 + .45 * vT) * .8 + uSunCol * (.55 + .5 * vT) * sunUp * vCS;
        float back = pow(max(dot(-V, uSunDir), 0.), 5.) * vT * vCS;   // 逆光：草尖透亮
        col = col * light + uSunCol * col * back * 2.2;
        gl_FragColor = vec4(col, 1.);
        #include <fog_fragment>
      }`,
  });
  const GU = { ...U, ...shared };
  const makeGrass = (pts, rice) => {
    const blade = new THREE.BufferGeometry();
    const v = [-0.5, 0, 0, 0.5, 0, 0, -0.38, 0.33, 0, 0.38, 0.33, 0, -0.22, 0.66, 0, 0.22, 0.66, 0, 0, 1, 0];
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    const geo = new THREE.InstancedBufferGeometry().copy(blade); geo.instanceCount = pts.length / 6;
    const off = new Float32Array(pts.length / 6 * 4), sc = new Float32Array(pts.length / 6 * 2);
    for (let i = 0, k = 0; i < pts.length; i += 6, k++) { off.set([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]], k * 4); sc.set([pts[i + 4], pts[i + 5]], k * 2); }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); geo.setAttribute('aSc', new THREE.InstancedBufferAttribute(sc, 2));
    const mat = grassMat(rice); Object.assign(mat.uniforms, GU);
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.noShadow = true; group.add(mesh);
    return mat;
  };
  const grassPts = [], ricePts = [];
  {
    const NG = LOW ? 60000 : 220000;
    for (let i = 0; i < NG * 2.5 && grassPts.length / 6 < NG; i++) {
      const d = 10 + Math.pow(r(), 1.7) * 260, a = Math.PI * (0.55 + r() * 1.9), x = Math.cos(a) * d * 1.3, z = Math.sin(a) * d - 8;
      const [pr, pw, pb] = zoneAt(x, z); if (pr > 0.3 || pw > 0.3 || pb > 0.2 || valley(x, z) > 0.4) continue;
      if (Math.abs(z - ROAD_Z) < 5) continue;
      const tall = smooth(0.4, 0.75, fbm(x * 0.02, z * 0.02, 2));                            // 有的地方是一人高的芒草，有的地方矮
      grassPts.push(x, hgt(x, z) - 0.05, z, r(), 0.06 + r() * 0.06, (0.35 + r() * 0.5) * (1 + tall * 1.4));
    }
    for (const pl of plots) {
      const cx = (pl.x0 + pl.x1) / 2, cz = (pl.z0 + pl.z1) / 2, d = Math.hypot(cx, cz);
      if (pl.water || d > 170) continue;
      const step = 0.3 + d * 0.0025;                                                           // 稻子一行行、一株株
      for (let x = pl.x0 + 0.3; x < pl.x1; x += step) for (let z = pl.z0 + 0.3; z < pl.z1; z += step * 0.8) {
        if (ricePts.length / 6 > (LOW ? 60000 : 320000)) break;
        for (let k = 0; k < 4; k++) ricePts.push(x + (r() - 0.5) * 0.2, G - 0.05, z + (r() - 0.5) * 0.2, r(), 0.05 + r() * 0.04, 0.5 + r() * 0.22);
      }
    }
  }
  const grassM = makeGrass(grassPts, false), riceM = makeGrass(ricePts, true);

  // ---------- 云：夏天一堆堆的积雨云（很多软边的面片拼成，朝太阳一面亮、底下暗）----------
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uSun: shared.uSunDir, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uOpacity: { value: 1 }, uTime: U.uTime },
    vertexShader: `attribute vec4 aC; attribute vec4 aN; varying vec2 vUv; varying float vL; varying float vH; varying float vSeed; uniform vec3 uSun; uniform float uTime;
      void main(){
        vUv = position.xy; vH = aN.w; vSeed = aC.w;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), upv = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 c = aC.xyz + vec3(uTime * 2.5, 0., 0.);
        vec3 p = c + (right * position.x + upv * position.y) * aN.x * 1.0;
        vL = clamp(.5 + .55 * dot(normalize(vec3(aN.y, aN.w * 1.4 - .3, aN.z)), uSun), 0., 1.);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `uniform vec3 uLit, uShade; uniform float uOpacity; varying vec2 vUv; varying float vL; varying float vH; varying float vSeed;
      ${GLSL.HASH}
      void main(){
        float d = length(vUv);
        float edge = vn21(vUv * 3. + vSeed * 40.) * .35 + vn21(vUv * 7. + vSeed * 13.) * .15;
        float a = smoothstep(1., .55, d + edge * .6);
        if (a < .01) discard;
        float l = vL * (.65 + .5 * vH);
        vec3 col = mix(uShade, uLit, smoothstep(.05, .85, l));
        col *= .92 + .16 * edge;
        gl_FragColor = vec4(col, a * uOpacity * .9);
      }`,
  });
  {
    const cl = [];
    const cumulus = (cx, cy, cz, R) => {
      const n = Math.round(60 + R / 25);
      for (let i = 0; i < n; i++) {
        // 花椰菜形：下面平、往上一团团鼓起来
        const u = r(), a = r() * Math.PI * 2, rad = Math.sqrt(r()) * R * (1 - u * 0.55);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.55, y = u * R * 1.15 * (0.75 + r() * 0.4);
        const s = R * (0.22 + r() * 0.2) * (1 - u * 0.35);
        const nrm = new THREE.Vector3(x, y - R * 0.3, z).normalize();
        cl.push({ p: [cx + x, cy + y, cz + z], s, n: [nrm.x, nrm.z], h: u, seed: r() });
      }
    };
    for (const [x, z, R] of [[-4200, -11500, 1300], [-1200, -14000, 1800], [2800, -12000, 1500], [7000, -15000, 2000], [-8800, -10000, 1200], [4600, -8500, 800], [-2600, -8000, 600], [10000, -8000, 1100], [-9000, 3000, 1400], [5000, 6000, 1500], [-5600, -6000, 450], [1200, -7000, 500]]) cumulus(x, 1500 + R * 0.45, z, R);
    cl.sort((a, b) => Math.hypot(b.p[0], b.p[2]) - Math.hypot(a.p[0], a.p[2]) || a.p[1] - b.p[1]);
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry().copy(quad); geo.instanceCount = cl.length;
    const aC = new Float32Array(cl.length * 4), aN = new Float32Array(cl.length * 4);
    cl.forEach((c, i) => { aC.set([...c.p, c.seed], i * 4); aN.set([c.s, c.n[0], c.n[1], c.h], i * 4); });
    geo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 4)); geo.setAttribute('aN', new THREE.InstancedBufferAttribute(aN, 4));
    const m = new THREE.Mesh(geo, cloudMat); m.frustumCulled = false; m.renderOrder = 3; m.userData.noShadow = true; group.add(m);
  }

  // ---------- Blender 做的模型：房子、树、电线杆、贩卖机…… ----------
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const glowWin = new THREE.MeshStandardMaterial({ color: '#7c848c', roughness: 0.3, metalness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0 });
  const glowVend = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.3, emissive: '#f4f8ff', emissiveIntensity: 0.4 });
  const glowLamp = new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#fff0d0', emissiveIntensity: 0 });
  // 云影、风：给标准材质打补丁
  const patch = (mat, wind) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
          varying vec3 vGW; uniform float uTime; uniform vec2 uWind;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          ${wind ? `{ vec3 ip = vec3(0.);
            #ifdef USE_INSTANCING
              ip = instanceMatrix[3].xyz;
            #endif
            float h = max(position.y - 2., 0.); float w = sin(uTime * 1.4 + ip.x * .07 + ip.z * .05) * .5 + sin(uTime * 2.9 + ip.x * .3 + position.y) * .25;
            transformed.xz += uWind * w * h * h * .006; }` : ''}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          { vec4 wq = vec4(transformed, 1.);
            #ifdef USE_INSTANCING
              wq = instanceMatrix * wq;
            #endif
            vGW = (modelMatrix * wq).xyz; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vGW; ${GLSL.HASH}${GLSL_WIND}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { float cs = cloudSh(vGW.xz); reflectedLight.directDiffuse *= cs; reflectedLight.directSpecular *= cs; }`);
    };
    mat.customProgramCacheKey = () => 'inaka' + (wind ? 'w' : '') + mat.uuid;
  };
  patch(bodyMat, false); patch(leafMat, true);
  const placements = {}; // 模型名 → [[x, y, z, 朝向, 缩放]]
  // 细节树（一棵一万多面）只用在近处，远了自动换低面数版本
  const HERO = LOW ? 140 : 230;
  const lod = (name, x, z) => (/^tree_(keyaki|oak|cedar)$/.test(name) && Math.hypot(x, z) > HERO ? name + '_lo' : name);
  const place = (name, x, z, rot = 0, s = 1, y) => { name = lod(name, x, z); (placements[name] ||= []).push([x, y ?? hgt(x, z), z, rot, s]); };
  const lights = [], pools = [];

  // 门前的路：电线杆一路排过去，路边的公交站和两台贩卖机，路口一面反射镜
  const poles = [];
  for (let x = -741; x <= 760; x += 38) poles.push([x, ROAD_Z - 4.2]); // 错开正前方，别正好一根杆子挡在眼前
  for (let i = 1; i < 18; i++) { const p = branch(i / 18); poles.push([p.x + 3.4, p.y]); }
  poles.forEach(([x, z], i) => place(i % 5 === 2 ? 'pole_lamp' : i % 7 === 3 ? 'pole_tr' : 'pole', x, z, 0));
  poles.forEach(([x, z], i) => { if (i % 5 === 2) { lights.push({ x, y: hgt(x, z) + 6.45, z: z + 1.35, c: [1, 0.86, 0.6], s: 0.9 }); pools.push([x, z + 2, 14, [1, 0.8, 0.55]]); } });
  place('busstop', -34, ROAD_Z - 7.5, Math.PI); place('vending_red', -26, ROAD_Z - 7.2, Math.PI); place('vending_white', -24.8, ROAD_Z - 7.2, Math.PI);
  pools.push([-25.4, ROAD_Z - 6, 7, [0.45, 0.5, 0.55]]);
  place('mirror', 44, ROAD_Z - 5.5, Math.PI * 0.8);
  // 田间的农家：老屋 + 土仓 / 铁皮棚 + 屋后的树和竹林
  const farms = [
    { x: -120, z: -110, rot: 0.15, house: 'minka_thatch' }, { x: 110, z: -150, rot: -0.2, house: 'minka_gray', kura: true }, { x: -40, z: -260, rot: 0.05, house: 'minka_sekishu' },
    { x: 230, z: -90, rot: -0.35, house: 'minka_navy' }, { x: -240, z: -60, rot: 0.4, house: 'minka_gray' }, { x: 60, z: -380, rot: 0, house: 'minka_thatch' },
    { x: 300, z: -300, rot: -0.5, house: 'minka_sekishu', kura: true }, { x: -300, z: -330, rot: 0.6, house: 'minka_navy' }, { x: 470, z: -180, rot: -0.9, house: 'minka_gray' },
    { x: -500, z: -200, rot: 0.9, house: 'minka_thatch' }, { x: 180, z: -560, rot: 0.1, house: 'minka_gray' }, { x: -170, z: -600, rot: -0.1, house: 'minka_sekishu' },
    { x: 420, z: -760, rot: -0.3, house: 'minka_thatch' }, { x: -420, z: -820, rot: 0.3, house: 'minka_gray', kura: true }, { x: 40, z: -980, rot: 0, house: 'minka_navy' },
    { x: -640, z: -520, rot: 0.8, house: 'minka_sekishu' }, { x: 640, z: -520, rot: -0.8, house: 'minka_gray' },
  ];
  // 自己这栋楼两边和身后的村子
  for (const [x, z, rot, h] of [[-48, 22, 0, 'minka_gray'], [52, 18, 0.1, 'minka_navy'], [-90, 60, -0.1, 'minka_sekishu'], [100, 70, 0.2, 'minka_gray'], [-20, 95, 0, 'minka_navy'], [-150, 30, 0.3, 'minka_thatch'], [160, 30, -0.2, 'minka_sekishu']]) farms.push({ x, z, rot: rot + Math.PI, house: h, village: true });
  for (const f of farms) {
    const fr = f.rot + Math.PI;                                            // 房子正面朝山谷（朝我们这边）
    place(f.house, f.x, f.z, fr);
    const ox = Math.sin(fr), oz = Math.cos(fr);                            // 房子正面方向
    if (f.kura) place('kura', f.x - Math.cos(fr) * 11, f.z + Math.sin(fr) * 11 - oz * 2, fr);
    else if (!f.village && r() < 0.7) place(r() < 0.5 ? 'shed_blue' : 'shed_red', f.x + Math.cos(fr) * 10, f.z - Math.sin(fr) * 10, fr + 0.1);
    // 屋后一排树（防风林）和竹子
    for (let k = 0; k < 7; k++) {
      const t = (k / 6 - 0.5) * 26, bx = f.x - ox * (9 + r() * 4) + Math.cos(fr) * t, bz = f.z - oz * (9 + r() * 4) - Math.sin(fr) * t;
      place(k % 3 === 1 ? 'bamboo' : r() < 0.5 ? 'tree_keyaki' : 'tree_oak', bx, bz, r() * 6, 0.8 + r() * 0.4);
    }
    if (!f.village) place('tree_maple', f.x + ox * 7 + Math.cos(fr) * 6, f.z + oz * 7 - Math.sin(fr) * 6, r() * 6, 0.9);
    lights.push({ x: f.x + ox * 5, y: hgt(f.x, f.z) + 2.6, z: f.z + oz * 5, c: [1, 0.78, 0.5], s: 0.5 });
  }
  // 神社：山脚下，红鸟居对着田
  place('shrine', -640, -380, Math.PI * 0.6);
  for (let k = 0; k < 16; k++) place('tree_cedar', -660 - r() * 50, -350 - r() * 70, r() * 6, 0.9 + r() * 0.4);
  // 向日葵：右前方田埂边一小片
  const sunflowers = [];
  for (let x = 70; x < 135; x += 1.25) for (let z = -38; z > -78; z -= 1.25) if (r() < 0.85) sunflowers.push([x + (r() - 0.5) * 0.4, z + (r() - 0.5) * 0.4]);
  // 河边零散的树、田间孤树
  for (let i = 0; i < 40; i++) { const p = stream(r()); place(r() < 0.6 ? 'tree_oak' : 'tree_keyaki', p.x + (r() - 0.5) * 30, p.y + (r() - 0.5) * 16, r() * 6, 0.7 + r() * 0.5); }
  // 里山的树：成片的林子。近处用细模型，中距离用低面数版，再远是极简的树团（在下面单独建）
  const farTrees = [];
  {
    let n = 0; const N = LOW ? 3000 : 9000, NF = LOW ? 5000 : 16000;
    for (let i = 0; i < (N + NF) * 8 && (n < N || farTrees.length < NF); i++) {
      const x = (r() - 0.5) * 4400, z = -3000 + r() * 3600, v = valley(x, z);
      if (v < 0.04) continue;
      if (forestF(x, z) < 0.5 + r() * 0.1) continue;                         // 只长在林地里
      const y = hgt(x, z); if (y - G < 1.5) continue;
      const d = Math.hypot(x, z), cedar = Math.sin(x * 0.011 + z * 0.007) + (r() - 0.5) * 0.8 > 0.2;
      if (d < 1100 && n < N) { place(cedar ? (d < 550 ? 'tree_cedar' : 'tree_cedar_lo') : (d < 550 ? (r() < 0.5 ? 'tree_keyaki' : 'tree_oak') : (r() < 0.5 ? 'tree_keyaki_lo' : 'tree_oak_lo')), x, z, r() * 6, 0.8 + r() * 0.6); n++; }
      else if (d >= 1100 && farTrees.length < NF) farTrees.push([x, y, z, cedar, 0.9 + r() * 0.7]);
    }
  }

  // 载入模型，按名字建实例化网格
  const loader = new GLTFLoader();
  const isTree = (n) => /tree|bamboo|sunflower/.test(n);
  const all = { ...placements, sunflower: sunflowers.map(([x, z]) => [x, G, z, r() * 0.6 - 0.3 + Math.PI, 0.85 + r() * 0.35]) };
  const loaded = Promise.all(Object.entries(all).map(async ([name, list]) => {
    const gl = await loader.loadAsync(MODELS + name + '.glb');
    const meshes = []; gl.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const src of meshes) {
      const geo = src.geometry.clone(); src.updateWorldMatrix(true, false); geo.applyMatrix4(src.matrixWorld);
      const glow = /glow/.test(src.material.name);
      if (!glow && isTree(name)) softFoliage(geo);
      const mat = glow ? (/vending/.test(name) ? glowVend : /pole_lamp/.test(name) ? glowLamp : glowWin) : isTree(name) ? leafMat : bodyMat;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, rot, s], i) => { tmpM.compose(tmpP.set(x, y - 0.05, z), tmpQ.setFromAxisAngle(up, rot), tmpS.setScalar(s)); im.setMatrixAt(i, tmpM); });
      im.castShadow = !glow && !/_lo$/.test(name); im.receiveShadow = !isTree(name);
      im.computeBoundingSphere(); group.add(im);
    }
  })).catch((e) => console.warn('乡间的模型没载入', e));

  // 电线：每两根杆子之间几根下垂的线
  {
    const segs = [];
    const wire = (a, b, sag) => { const n = 10; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; segs.push(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) - sag * 4 * t0 * (1 - t0), lerp(a[2], b[2], t0), lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) - sag * 4 * t1 * (1 - t1), lerp(a[2], b[2], t1)); } };
    const run = (list) => { for (let i = 0; i < list.length - 1; i++) { const [x0, z0] = list[i], [x1, z1] = list[i + 1]; const y0 = hgt(x0, z0), y1 = hgt(x1, z1); for (const [dx, h, sag] of [[-0.98, 10.5, 0.8], [0, 10.5, 0.8], [0.98, 10.5, 0.8], [-0.68, 9.7, 0.95], [0.68, 9.7, 0.95], [0, 7.4, 1.2]]) wire([x0 + dx, y0 + h, z0], [x1 + dx, y1 + h, z1], sag); } };
    run(poles.slice(0, 41)); run(poles.slice(41));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#26282c', transparent: true, opacity: 0.85 })));
  }

  // 远处的树团：杉树是细长的锥，阔叶树是一团；下面暗上面亮的顶点颜色
  for (const cedar of [true, false]) {
    const geo = cedar ? new THREE.ConeGeometry(2.4, 13, 7).translate(0, 8, 0) : new THREE.IcosahedronGeometry(4, 1).scale(1, 0.85, 1).translate(0, 6, 0);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c0 = new THREE.Color(cedar ? '#1e3a1e' : '#3c6428'), c1 = new THREE.Color(cedar ? '#0c1c0e' : '#1c3412');
    for (let i = 0; i < p.count; i++) { const k = clamp((p.getY(i) - 2) / 10, 0, 1); tmpC.copy(c1).lerp(c0, k); col.set([tmpC.r, tmpC.g, tmpC.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); softFoliage(geo);
    const list = farTrees.filter((t) => t[3] === cedar);
    const im = new THREE.InstancedMesh(geo, leafMat, list.length);
    list.forEach(([x, y, z, , s2], i) => { tmpM.compose(tmpP.set(x, y - 0.5, z), tmpQ.setFromAxisAngle(up, r() * 6), tmpS.setScalar(s2)); im.setMatrixAt(i, tmpM); });
    im.computeBoundingSphere(); im.userData.noShadow = true; group.add(im);
  }

  // ---------- 灯、萤火虫、飞鸟 ----------
  const lampP = makeLights(lights, { fog: 0.00012, minPx: 1, maxPx: 4, gain: 1.2 }); group.add(lampP);
  const poolTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
  const poolIm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolM, pools.length);
  pools.forEach(([x, z, s, c], i) => { tmpM.compose(tmpP.set(x, hgt(x, z) + 0.1, z), tmpQ.identity(), tmpS.set(s, 1, s)); poolIm.setMatrixAt(i, tmpM); poolIm.setColorAt(i, tmpC.setRGB(...c)); });
  poolIm.userData.noShadow = true; group.add(poolIm);
  // 萤火虫：夜里在田边、河边慢慢飘，一闪一闪
  const flies = [];
  for (let i = 0; i < (LOW ? 250 : 600); i++) {
    const p = r() < 0.6 ? stream(r()) : new THREE.Vector2((r() - 0.5) * 300, -30 - r() * 200);
    const x = p.x + (r() - 0.5) * 20, z = p.y + (r() - 0.5) * 14, y = hgt(x, z) + 0.4 + r() * 1.6;
    if (Math.hypot(x, z) > 420) continue;
    const a = r() * 6.28;
    flies.push({ x, y, z, ex: x + Math.cos(a) * 6, ey: y + (r() - 0.5) * 1.5, ez: z + Math.sin(a) * 6, v: 0.25 + r() * 0.3, seed: r(), c: [0.75, 1, 0.45], s: 0.12, day: [0, 0, 0] });
  }
  const flyP = makeLights(flies, { fog: 0.0001, moving: true, minPx: 1.8, maxPx: 4, gain: 2.6, twinkle: 0.95 }); group.add(flyP);
  // 飞鸟：一小群燕子在田野上空绕圈
  const birdGeo = new THREE.BufferGeometry(); birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0.2, 0, 0, -0.3, 0, 0.05, 0.4, 1, 0, 0.2, 0, 0, -0.3, 0, 0.05, 0.4], 3));
  const birdMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color('#1a1c22') } }, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; attribute float aPh; void main(){ vec3 p = position; float f = sin(uTime * 14. + aPh * 20.) * .7; p.y += abs(p.x) * f; vec4 w = instanceMatrix * vec4(p * .5, 1.); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.); }`,
  });
  const NB = 18, birds = new THREE.InstancedMesh(birdGeo, birdMat, NB); birds.frustumCulled = false; birds.userData.noShadow = true;
  birdGeo.setAttribute('aPh', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: NB }, () => r())), 1)); group.add(birds);
  const birdOff = Array.from({ length: NB }, () => [(r() - 0.5) * 30, (r() - 0.5) * 8, (r() - 0.5) * 30, r()]);

  // ---------- 美术配色：盛夏的蓝天白云、油绿的田；傍晚金橙、对面一抹粉；入夜深蓝 ----------
  const art = makeArt([
    [40, { zen: '#1a62dc', mid: '#56a0ee', hor: '#cfe6f6', glow: '#ffffff', anti: '#bcdcf4', sun: '#fff8ea', sunK: 3.4, hemi: '#a8ccf4', ground: '#6a8a4a', hemiK: 1.0, fog: '#b8d4ee', fogK: 2.2, cloudLit: '#ffffff', cloudShade: '#c2d2e6', cloudK: 1, lit: 0, halo: 1.2 }],
    [14, { zen: '#1e5cd0', mid: '#5c9ae4', hor: '#f0e4cc', glow: '#ffe2b0', anti: '#b4cce8', sun: '#ffe2b8', sunK: 3.3, hemi: '#a8c0e8', ground: '#7a8a48', hemiK: 0.95, fog: '#dcd8d0', fogK: 2, cloudLit: '#fff4e0', cloudShade: '#bcc0d8', cloudK: 1, lit: 0.05, halo: 1.5 }],
    [3, { zen: '#3462b4', mid: '#8aa6dc', hor: '#ffd890', glow: '#ffae3c', anti: '#cdb8e2', sun: '#ffc060', sunK: 3.2, hemi: '#a49cd4', ground: '#8a6a3c', hemiK: 0.9, fog: '#f2cc98', fogK: 2, cloudLit: '#ffd08a', cloudShade: '#a090c0', cloudK: 1, lit: 0.5, halo: 2 }],
    [-2, { zen: '#22409c', mid: '#6676c2', hor: '#ffb070', glow: '#ff8c3c', anti: '#b49ccc', sun: '#ff8a40', sunK: 0.9, hemi: '#7a72b8', ground: '#5a4232', hemiK: 0.85, fog: '#b07a90', fogK: 1.2, cloudLit: '#ffa070', cloudShade: '#5a4888', cloudK: 1, lit: 0.85, halo: 1.6 }],
    [-6, { zen: '#0c2070', mid: '#22409e', hor: '#6a78c0', glow: '#c07890', anti: '#3e4e9e', sun: '#000000', sunK: 0, hemi: '#3a4a96', ground: '#2a3040', hemiK: 0.9, fog: '#3a4a86', fogK: 1.1, cloudLit: '#a888b8', cloudShade: '#3a4480', cloudK: 0.8, lit: 1, halo: 0 }],
    [-14, { zen: '#030a26', mid: '#08164a', hor: '#182a62', glow: '#1e2c66', anti: '#14205a', sun: '#000000', sunK: 0, hemi: '#3a50a0', ground: '#1e2c48', hemiK: 1.5, fog: '#142450', fogK: 1, cloudLit: '#4a5a90', cloudShade: '#26346a', cloudK: 0.4, lit: 1, halo: 0 }],
    [-25, { zen: '#02061a', mid: '#06103a', hor: '#122150', glow: '#162456', anti: '#101a4a', sun: '#000000', sunK: 0, hemi: '#34488e', ground: '#1a2640', hemiK: 1.4, fog: '#101c40', fogK: 1, cloudLit: '#3e4c80', cloudShade: '#202c5c', cloudK: 0.35, lit: 0.95, halo: 0 }],
  ]);
  const skyArt = artSky(group);
  const night = nightSky(group, { strength: 0.5, stars: 2800, meteorEvery: 8, seed: 808 }); // 夜里挂一条淡淡的银河，偶尔有流星
  const ridgeCol = new THREE.Color();

  return {
    group, fog: 0.00012, art, loaded,
    shadow: { center: [0, G, -110], size: 260, normalBias: 0.4 },
    update(dt, t, sky, atmo) {
      const c = sky.state.c, n = c.night;
      const A = art.update(c.sunElev); skyArt.update(art, sky); night.update(dt, t, c, { dark: smooth(0.6, 0.95, c.night) });
      this.dirK = lerp(1.1, 2.2, n); this.envK = 0.12; // 夜里月光照田野亮一点 // 环境贴图是物理天空烘的，偏白，会把整片绿蒙上一层奶白：这里几乎不用它
      this.glow = { k: lerp(0, 0.55, A.lit), t: lerp(2, 0.45, A.lit) }; // 白天不加光晕（会发白），入夜灯火才晕开
      U.uTime.value = t; U.uCloudK.value = smooth(-2, 8, c.sunElev);
      shared.uSunDir.value.copy(sky.state.sunDir); shared.uSunCol.value.copy(A.sun).multiplyScalar(A.sunK * 0.36 * smooth(-2, 3, c.sunElev));
      shared.uSky.value.copy(A.hemi).multiplyScalar(A.hemiK * 0.55); shared.uGround.value.copy(A.ground).multiplyScalar(A.hemiK * 0.45);
      shared.uHor.value.copy(A.hor); shared.uMid.value.copy(A.mid);
      cloudMat.uniforms.uLit.value.copy(A.cloudLit); cloudMat.uniforms.uShade.value.copy(A.cloudShade); cloudMat.uniforms.uOpacity.value = A.cloudK;
      for (const m of ridges) m.material.color.copy(ridgeCol.setRGB(1, 1, 1).lerp(A.hor, m.userData.k).multiplyScalar(lerp(1, 0.45, n)));
      const L = A.lit;
      glowWin.emissiveIntensity = L * 2.6; glowLamp.emissiveIntensity = L * 3; glowVend.emissiveIntensity = 0.4 + L * 0.8;
      lampP.material.uniforms.uOpacity.value = smooth(0.2, 0.8, L); poolM.opacity = smooth(0.2, 0.8, L) * 0.35;
      flyP.material.uniforms.uOpacity.value = smooth(0.7, 1, L) * smooth(0.5, 0.9, n); flyP.material.uniforms.uTime.value = t;
      // 燕子：白天到黄昏，在田野上空绕大圈
      const bv = smooth(-3, 2, c.sunElev); birds.visible = bv > 0.01;
      if (birds.visible) {
        const cx = Math.cos(t * 0.11) * 90 + 10, cz = -140 + Math.sin(t * 0.11) * 70, cy = G + 22 + Math.sin(t * 0.3) * 6, hd = t * 0.11 + Math.PI / 2;
        birdOff.forEach(([ox, oy, oz, ph], i) => {
          const wob = Math.sin(t * (1 + ph) + ph * 10) * 3;
          tmpM.compose(tmpP.set(cx + ox + wob, cy + oy, cz + oz), tmpQ.setFromAxisAngle(up, -hd + Math.sin(t + ph * 6) * 0.3), tmpS.setScalar(1)); birds.setMatrixAt(i, tmpM);
        });
        birds.instanceMatrix.needsUpdate = true;
      }
      sky.stars.material.uniforms.uOpacity.value = Math.min(1.3, sky.stars.material.uniforms.uOpacity.value * 1.3);
    },
  };
}

// 树冠的法线改成从树冠中心往外放射（叶子是软的一团，不是一块块硬面）
function softFoliage(geo) {
  const p = geo.attributes.position, nrm = geo.attributes.normal, col = geo.attributes.color;
  if (!nrm || !col) return;
  const c = new THREE.Vector3(), tmp = new THREE.Vector3(); let k = 0;
  const leaf = (i) => { const r = col.getX(i), g = col.getY(i), b = col.getZ(i); return g > r * 1.1 && g > b; };
  for (let i = 0; i < p.count; i++) if (leaf(i)) { c.add(tmp.fromBufferAttribute(p, i)); k++; }
  if (!k) return; c.divideScalar(k);
  let rad = 0; for (let i = 0; i < p.count; i++) if (leaf(i)) rad = Math.max(rad, tmp.fromBufferAttribute(p, i).distanceTo(c));
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    if (!leaf(i)) continue;
    tmp.fromBufferAttribute(p, i).sub(c); tmp.y *= 1.3; tmp.normalize();
    n.fromBufferAttribute(nrm, i).lerp(tmp, 0.8).normalize(); nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
}
