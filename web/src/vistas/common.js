// 各套风景共用的东西：噪声、灯点（Points）、程序化楼窗材质、便宜的水面、山脊
import * as THREE from 'three';
import { rng } from '../textures.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dirFrom as _dirFrom } from '../sky.js';

// ---------- 噪声 ----------
export function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export { rng };
// 画质：手机 / 低端机自动低画质；开发时 ?vq=low / ?vq=high 强制
const VQ = new URLSearchParams(location.search).get('vq');
export const LOW = VQ ? VQ === 'low' : (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4);

const GLSL_HASH = `
float vh21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn21(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(vh21(i), vh21(i + vec2(1., 0.)), u.x), mix(vh21(i + vec2(0., 1.)), vh21(i + vec2(1., 1.)), u.x), u.y); }
`;

// ---------- 灯点 ----------
// 大小按「360 像素高的画面」算（像素风 3 倍时正好一格一像素），远处的灯不小于 uMinPx、近处不超过 uMaxPx；
// 比一个像素还小的灯按面积变暗，这样远处整片灯海不会闪成噪点。自带指数雾（各风景自己的雾浓度）。
// 可选：moving 沿 position→aEnd 来回跑的车灯；streak 水面上竖长的倒影；blink 航空障碍灯那种一闪一闪。
const v4 = new THREE.Vector4();
export function lightsMaterial({ additive = true, moving = false, streak = false, blink = false, horizon = false, minPx = 1, maxPx = 5, fog = 0.0001, gain = 1, twinkle = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    defines: { MOVING: moving ? 1 : 0, STREAK: streak ? 1 : 0, BLINK: blink ? 1 : 0, HORIZON: horizon ? 1 : 0 },
    uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 }, uViewH: { value: 360 }, uFogD: { value: fog }, uMinPx: { value: minPx }, uMaxPx: { value: maxPx }, uGain: { value: gain }, uNight: { value: 1 }, uTwinkle: { value: twinkle } },
    vertexShader: `
      attribute vec3 color; attribute float size; attribute float seed;
      #if MOVING
      attribute vec3 aEnd; attribute float aSpeed; attribute vec3 dayc;
      #endif
      uniform float uTime, uViewH, uFogD, uMinPx, uMaxPx, uGain, uNight, uTwinkle;
      varying vec3 vC; varying float vA; varying float vSeed;
      void main(){
        vec3 p = position;
        #if MOVING
          vec3 d = aEnd - position; float L = max(length(d), 1.);
          p = position + d * fract(seed + uTime * aSpeed / L);
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float dist = max(-mv.z, 0.1);
        float k = max(1., uViewH / 900.); // 全分辨率下：1 档大约是 1~2 个屏幕像素
        float px = size * projectionMatrix[1][1] * uViewH * .5 / dist;
        float mn = uMinPx * k;
        gl_PointSize = clamp(px, mn, uMaxPx * k);
        float e = clamp(px / mn, 0., 1.);
        float f = exp(-pow(uFogD * dist, 2.));
        float a = mix(.35, 1., sqrt(e)) * f * uGain;
        a *= 1. - uTwinkle * (.5 + .5 * sin(uTime * (1.3 + seed * 3.7) + seed * 61.));
        #if BLINK
          a *= step(.82, fract(uTime * .55 + seed));
        #endif
        #if HORIZON
          a *= smoothstep(-.01, .2, normalize((modelMatrix * vec4(p, 1.)).xyz - cameraPosition).y); // 贴近地平线的星星被大气吃掉
        #endif
        vC = color;
        #if MOVING
          vC = mix(dayc, color, uNight);
        #endif
        vA = a; vSeed = seed;
      }`,
    fragmentShader: `
      uniform float uOpacity, uTime; varying vec3 vC; varying float vA; varying float vSeed;
      void main(){
        vec2 q = gl_PointCoord - .5;
        #if STREAK
          float a = exp(-q.x * q.x * 90.) * smoothstep(.5, -.35, q.y) * (.55 + .45 * sin(uTime * 2.3 + vSeed * 40. + q.y * 26.));
        #else
          float d = length(q) * 2.; float a = clamp(1. - d * d, 0., 1.);
        #endif
        gl_FragColor = vec4(vC, a * vA * uOpacity);
      }`,
  });
  return mat;
}
// 建一组灯点。pts: [{x,y,z,c:[r,g,b],s,seed?, ex,ey,ez, v, day:[r,g,b]}]
export function makeLights(pts, opts = {}) {
  const n = pts.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
  const mv = !!opts.moving, end = mv ? new Float32Array(n * 3) : null, spd = mv ? new Float32Array(n) : null, day = mv ? new Float32Array(n * 3) : null;
  pts.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3); col.set(p.c, i * 3); size[i] = p.s; seed[i] = p.seed ?? Math.random();
    if (mv) { end.set([p.ex, p.ey, p.ez], i * 3); spd[i] = p.v; day.set(p.day || [0.2, 0.2, 0.2], i * 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  if (mv) { g.setAttribute('aEnd', new THREE.BufferAttribute(end, 3)); g.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1)); g.setAttribute('dayc', new THREE.BufferAttribute(day, 3)); }
  const mat = lightsMaterial(opts);
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.onBeforeRender = (r) => { r.getCurrentViewport(v4); mat.uniforms.uViewH.value = v4.w; };
  return points;
}

// ---------- 程序化楼窗 ----------
// 按世界坐标在墙面上画窗格（不用贴图，任何大小的盒子、实例化都能用）。每栋楼一个 aBld 属性：
// x 种子、y 样式（0 砖石小窗 / 1 玻璃幕墙 / 2 办公楼横条窗）、z 底部高度、w 亮灯倾向。
// 窗格比一个像素还小时退化成平均亮度，不闪。夜里亮灯数随时间变（uLit），偶尔有窗户开关。
export function facadeMaterial({ roughness = 0.85, glow = 1, ao = 50, shops = 1 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness, metalness: 0 });
  const u = { uNight: { value: 0 }, uLit: { value: 0.4 }, uTime: { value: 0 }, uGlow: { value: glow }, uStreet: { value: new THREE.Color('#ff9a50') }, uStreetK: { value: 0.16 }, uAO: { value: ao }, uShop: { value: shops } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aBld; varying vec4 vBld; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 fw = vec4(transformed, 1.); vec3 fn = objectNormal;
          #ifdef USE_INSTANCING
            fw = instanceMatrix * fw; fn = mat3(instanceMatrix) * fn;
          #endif
          fw = modelMatrix * fw; vWP = fw.xyz; vWN = mat3(modelMatrix) * fn; vBld = aBld; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight, uLit, uTime, uGlow, uStreetK, uAO, uShop; uniform vec3 uStreet;
        varying vec4 vBld; varying vec3 vWP; varying vec3 vWN;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 fN = normalize(vWN);
        float fWall = 1. - step(.5, abs(fN.y));
        float st = vBld.y;
        float winW = st < .5 ? 2.6 : (st < 1.5 ? 1.7 : 3.1);
        float flH = st < 1.5 ? 3.4 : 4.;
        vec2 ws = st < .5 ? vec2(.46, .52) : (st < 1.5 ? vec2(.9, .8) : vec2(.86, .58));
        vec3 fT = normalize(vec3(-fN.z, 0., fN.x) + 1e-5);
        vec2 cell = vec2(dot(vWP, fT) / winW, (vWP.y - vBld.z) / flH);
        vec2 cid = floor(cell); vec2 cf = fract(cell) - .5;
        vec2 cw = fwidth(cell);
        float blur = smoothstep(.3, .85, max(cw.x, cw.y));
        vec2 m2 = 1. - smoothstep(ws * .5 - cw, ws * .5 + cw, abs(cf));
        float fWin = mix(m2.x * m2.y, ws.x * ws.y, blur) * fWall * step(.6, cell.y);
        float sd = vBld.x * 97.;
        float hw = fh(cid + sd), hf = fh(vec2(cid.y, sd * 1.7)), hc = fh(vec2(sd * 3.1, floor(cid.x / 5.)));
        float thr = uLit * vBld.w * (.25 + 1.5 * hf * hf) * (.6 + .8 * hc) + .05 * sin(uTime * .04 + hw * 300.);
        // 窗格比像素小时：按「几乘几扇窗」一块（约一个像素）算，这一块要么亮要么暗，远处的楼是星星点点的灯，
        // 不是一整面均匀发亮的墙；块大小跟着远近走，站着不动时画面是稳的
        vec2 lv = max(vec2(0.), ceil(log2(cw * 1.4)));
        vec2 bid = floor(cell / exp2(lv));
        float bh = fh(bid + sd + lv.x * 13.7 + lv.y * 5.3), bf = fh(vec2(bid.y, sd + lv.y));
        float litB = step(bh, uLit * vBld.w * (.15 + .85 * bf)) * (.3 + .55 * fh(bid + sd + 5.));
        float litS = step(hw, thr) * (.45 + .9 * fh(cid + sd + 3.)) * m2.x * m2.y;
        float lit = mix(litS, litB * (st > .5 ? 1. : .75), blur) * fWall * step(.6, cell.y);
        float hcol = fh(mix(cid, bid, blur) * 1.31 + sd + 7.);
        vec3 warm = vec3(1., .6, .28), cool = vec3(.72, .84, 1.), pale = vec3(1., .86, .62);
        vec3 lc = hcol < .62 ? warm : (hcol < .9 ? pale : cool);
        if (st > 1.5) lc = mix(lc, cool, .55);
        vec3 glassC = st > .5 ? vec3(.06, .085, .12) : vec3(.05, .055, .065);
        glassC *= mix(.75 + .5 * fh(cid + sd + 11.), 1., blur);                    // 每块玻璃反光深浅不一
        float hy = vWP.y - vBld.z;
        // 墙面细节：砖石楼的竖向墙垛、每层的窗间墙；离得近才看得出，远了自动淡掉
        float near = 1. - blur;
        float pier = st < .5 ? (step(.5, fract(cell.x * .5)) * .08 - .04) : 0.;
        float spandrel = smoothstep(.34, .5, abs(cf.y)) * (st > 1.5 ? .18 : .1);
        vec3 wallC = diffuseColor.rgb * (1. + (pier - spandrel) * near);
        // 一楼店面：深色玻璃，夜里多半亮着暖光
        float shop = fWall * (1. - step(4.6, hy)) * step(.4, hy) * uShop;
        float shopLit = step(.3, fh(vec2(floor(dot(vWP, fT) / 9.), sd)));
        diffuseColor.rgb = mix(mix(wallC, glassC, fWin), vec3(.05, .05, .055), shop * .8);
        diffuseColor.rgb *= .58 + .42 * smoothstep(0., uAO, hy);                     // 街谷底下暗（假环境光遮蔽）
        diffuseColor.rgb *= 1. - .25 * (1. - fWall);                                  // 屋顶比墙面暗一点
        diffuseColor.rgb *= 1. - .7 * uNight;                                         // 夜里墙面压暗，窗灯才显得出来
        vec3 fEmit = lc * lit * uNight * uGlow * .6;
        fEmit += vec3(1., .72, .45) * shop * shopLit * uNight * uGlow * .55;
        fEmit += uStreet * uStreetK * exp(-max(hy, 0.) / 16.) * step(0., hy) * uNight * fWall;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .3, fWin);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, .3, fWin * step(.5, st));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += fEmit;`);
  };
  mat.customProgramCacheKey = () => 'facade2';
  return mat;
}
// 给几何体（或实例化网格）挂 aBld
export function bldAttr(geom, list) { // list: 每个实例 [seed, style, baseY, litBias]
  const a = new Float32Array(list.length * 4); list.forEach((v, i) => a.set(v, i * 4));
  geom.setAttribute('aBld', new THREE.InstancedBufferAttribute(a, 4));
}
export function bldConst(geom, v) { // 普通网格：每个顶点一样
  const n = geom.attributes.position.count, a = new Float32Array(n * 4); for (let i = 0; i < n; i++) a.set(v, i * 4);
  geom.setAttribute('aBld', new THREE.BufferAttribute(a, 4));
  return geom;
}
// 一天里亮灯的比例：傍晚最多，后半夜最少
export function litRatio(h) {
  const x = ((h % 24) + 24) % 24;
  if (x >= 17 && x < 23) return lerp(0.55, 0.5, (x - 17) / 6);
  if (x >= 23 || x < 5) { const k = (x >= 23 ? x - 23 : x + 1) / 6; return lerp(0.5, 0.16, smooth(0, 1, k)); }
  if (x < 8) return lerp(0.16, 0.3, (x - 5) / 3);
  return 0.3;
}

// ---------- 便宜的水面：程序化法线 + 菲涅尔天光 + 太阳/月亮的碎光（不做实时反射）----------
export function waterMaterial({ deep = '#0a1a24', scale = 1, amp = 1 } = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: new THREE.Color('#9ab4cc') }, uHor: { value: new THREE.Color('#c8d4dc') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uGlit: { value: 1 }, uScale: { value: scale }, uAmp: { value: amp },
  }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: `varying vec3 vWP;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uGlit, uScale, uAmp; uniform vec3 uDeep, uSky, uHor, uSunDir, uSunCol; varying vec3 vWP;
      #include <fog_pars_fragment>
      ${GLSL_HASH}
      float hgt(vec2 p){ float t = uTime; return vn21(p * .08 + vec2(t * .05, t * .03)) * .6 + vn21(p * .23 - vec2(t * .08, -t * .04)) * .3 + vn21(p * .61 + vec2(t * .15, t * .1)) * .12; }
      void main(){
        vec2 p = vWP.xz / uScale; float e = .5, h0 = hgt(p);
        vec2 g = vec2(hgt(p + vec2(e, 0.)) - h0, hgt(p + vec2(0., e)) - h0) / e;
        float dist = length(cameraPosition - vWP);
        float amp = uAmp * 1.4 / (1. + dist * .0012);
        vec3 N = normalize(vec3(-g.x * amp, 1., -g.y * amp));
        vec3 V = normalize(cameraPosition - vWP);
        float fr = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 skyc = mix(uHor, uSky, clamp(R.y * 2.5, 0., 1.));
        vec3 col = mix(uDeep, skyc, clamp(fr, 0., 1.));
        float s = max(dot(R, uSunDir), 0.);
        col += uSunCol * (pow(s, 600.) * 9. + pow(s, 40.) * .35) * uGlit;
        gl_FragColor = vec4(col, 1.);
        #include <fog_fragment>
      }`,
  });
}
export function updateWater(mat, dt, sky, atmo, { night = '#020610', deep, art } = {}) {
  const u = mat.uniforms, c = sky.state.c, n = c.night;
  u.uTime.value += dt;
  if (art) { // 水面照着美术天空的颜色反光
    const a = art.cur, moon = c.sunElev < -2;
    u.uSunDir.value.copy(moon ? sky.state.moonDir : sky.state.sunDir).normalize();
    if (moon) u.uSunCol.value.set('#9aaad8').multiplyScalar(clamp((c.moonElev + 2) / 8, 0, 1) * 0.5); else u.uSunCol.value.copy(a.sun).multiplyScalar(a.sunK * 0.5);
    u.uDeep.value.copy(a.deep); u.uSky.value.copy(a.mid); u.uHor.value.copy(a.hor);
    return;
  }
  const moon = c.sunElev < -2;
  u.uSunDir.value.copy(moon ? sky.state.moonDir : sky.state.sunDir).normalize();
  if (moon) u.uSunCol.value.set('#9aaad8').multiplyScalar(clamp((c.moonElev + 2) / 8, 0, 1) * 0.6);
  else u.uSunCol.value.copy(atmo.sunColor).multiplyScalar(clamp((c.sunElev + 1) / 6, 0, 1));
  if (deep) u.uDeep.value.set(deep).lerp(new THREE.Color(night), n);
  u.uSky.value.copy(atmo.hemiSky).multiplyScalar(lerp(0.75, 0.35, n));
  u.uHor.value.copy(atmo.fog);
}

// ---------- 山脊：有高有低的一长条（跟 sea.js 一个做法）----------
export function ridge(group, { z, x = 0, y = 0, width, depth, height, seed, low, mid, high, snow = 2, snowCol = '#eef2f6', mask, fog = true, segX = 220, segZ = 30, sharp = 1.6 }) {
  const g = new THREE.PlaneGeometry(width, depth, segX, segZ); g.rotateX(-Math.PI / 2);
  const pp = g.attributes.position, col = new Float32Array(pp.count * 3), cL = new THREE.Color(low), cM = new THREE.Color(mid), cH = new THREE.Color(high), cS = new THREE.Color(snowCol), tmp = new THREE.Color();
  for (let i = 0; i < pp.count; i++) {
    const lx = pp.getX(i), lz = pp.getZ(i), wx = lx + x;
    const prof = Math.pow(Math.sin(Math.PI * (lz / depth + 0.5)), 1.4);
    const peaks = 0.25 + 0.75 * Math.pow(fbm(wx * 0.00042 + seed, seed * 1.7, 4), sharp) * 1.8;
    const detail = fbm(wx * 0.0021 + seed * 3, lz * 0.003 + seed, 6);
    const k = mask ? mask(wx) : 1;
    const h = height * prof * peaks * (0.55 + 0.6 * detail) * k;
    pp.setY(i, h);
    const e = h / height;
    tmp.copy(cL).lerp(cM, smooth(0.1, 0.45, e)).lerp(cH, smooth(0.45, 0.8, e));
    if (e > snow) tmp.lerp(cS, smooth(snow, snow + 0.12, e) * (0.75 + detail * 0.3));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog });
  const me = new THREE.Mesh(g, mt); me.position.set(x, y, z); group.add(me);
  return me;
}

// 小工具：一个顶点颜色的几何体（合并前给每部分上色）
export function tint(geom, color) {
  const g = geom.index ? geom.toNonIndexed() : geom; const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
export const GLSL = { HASH: GLSL_HASH };

// ---------- 云层：一大片高空的程序化云（分形噪声），被太阳照亮、日落时染红、夜里可以被城市灯光从底下映亮 ----------
export function cloudLayer(group, { y = 2200, size = 60000, cover = 0.5, scale = 1, night = '#1a2030', nightK = 0.25, speed = 6 } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCover: { value: cover }, uScale: { value: scale }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
      uAmb: { value: new THREE.Color('#9ab0c8') }, uNight: { value: 0 }, uNightCol: { value: new THREE.Color(night) }, uNightK: { value: nightK }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vWP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime, uCover, uScale, uNight, uNightK, uOpacity; uniform vec3 uSun, uSunCol, uAmb, uNightCol; varying vec3 vWP;
      ${GLSL_HASH}
      float cf(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 6; i++){ s += a * vn21(p); p = p * 2.07 + vec2(1.7, 9.2); a *= .5; } return s; }
      void main(){
        vec2 p = vWP.xz / (1800. * uScale) + vec2(uTime * .004, uTime * .0015);
        float base = cf(p * .35) * .6 + cf(p) * .4;
        float d = smoothstep(1. - uCover, 1. - uCover + .28, base);
        if (d < .003) discard;
        // 往太阳那边挪一点再取一次：差值当厚度，算明暗（迎光面亮、背光面暗）
        vec2 off = normalize(uSun.xz + 1e-4) * .06;
        float d2 = smoothstep(1. - uCover, 1. - uCover + .28, cf((p + off) * .35) * .6 + cf(p + off) * .4);
        float lit = clamp(.55 + (d - d2) * 2.2, 0., 1.);
        vec3 V = normalize(vWP - cameraPosition);
        float silver = pow(max(dot(V, uSun), 0.), 6.) * (1. - d) * 1.5;               // 朝着太阳看：云边发亮
        vec3 col = uAmb * (.55 + .25 * d) + uSunCol * (lit * .9 + silver);
        col = mix(col, uNightCol * (.6 + .4 * d), uNight) ;
        float dist = length(vWP.xz - cameraPosition.xz);
        float fade = 1. - smoothstep(14000., 29000., dist);                            // 远处淡进天边
        float a = d * fade * mix(.92, uNightK, uNight) * uOpacity;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.renderOrder = 4; mesh.userData.noShadow = true;
  group.add(mesh);
  return {
    mesh, mat,
    update(dt, sky, atmo, art) {
      const c = sky.state.c, u = mat.uniforms;
      u.uTime.value += dt * speed;
      u.uSun.value.copy(sky.state.sunDir);
      if (art) { // 美术配色：迎光面、背光面的颜色直接取调色板（晚霞时云底烧红、夜里被城市映亮都在调色板里）
        const a = art.cur; u.uSunCol.value.copy(a.cloudLit); u.uAmb.value.copy(a.cloudShade); u.uNight.value = 0; u.uOpacity.value = a.cloudK; return;
      }
      const sunUp = smooth(-4, 6, c.sunElev);
      u.uSunCol.value.copy(atmo.sunColor).multiplyScalar(sunUp * lerp(1, 1.5, c.dusk));
      u.uAmb.value.copy(atmo.hemiSky).multiplyScalar(lerp(0.85, 0.5, c.dusk)).lerp(new THREE.Color('#ffb090'), c.dusk * 0.35);
      u.uNight.value = c.night;
    },
  };
}

// ---------- 美术调色：按太阳高度在几组手调的配色之间插值（不追求物理正确，追求好看）----------
// keys: [[太阳高度, { zen 天顶, mid 半空, hor 地平线, glow 太阳那侧天边, anti 背对太阳的天边, sun 阳光色, sunK 阳光强度,
//   hemi 天光, ground 地面反光, hemiK 天光强度, fog 雾色, fogK 雾浓度倍数, cloudLit 云迎光面, cloudShade 云背光面, cloudK 云不透明度,
//   deep 水色, lit 窗灯（0..1）, halo 太阳光晕 }], ...] 高度从高到低排。stretch < 1 把日落前后那段拉长，好看的天空停留得更久。
export function makeArt(keys, { stretch = 0.55 } = {}) {
  const ks = keys.map(([e, o]) => [e, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v]))]);
  const cur = {}; for (const [k, v] of Object.entries(ks[0][1])) cur[k] = v.isColor ? v.clone() : v;
  return {
    cur, keys: ks,
    update(sunElev) {
      const e = sunElev * stretch;
      let i = 0; while (i < ks.length - 1 && e < ks[i + 1][0]) i++;
      const [e0, a] = ks[i], [e1, b] = ks[Math.min(i + 1, ks.length - 1)];
      const t = e1 === e0 ? 0 : smooth(0, 1, clamp((e0 - e) / (e0 - e1), 0, 1));
      for (const k of Object.keys(cur)) { const va = a[k], vb = b[k] ?? va; if (va?.isColor) cur[k].copy(va).lerp(vb, t); else if (typeof va === 'number') cur[k] = lerp(va, vb, t); }
      return cur;
    },
  };
}
// 美术天空：天顶 → 半空 → 地平线的渐变，太阳那侧的天边烧成暖色，背对太阳的天边一道粉紫，太阳带一圈大光晕
export function artSky(group) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZen: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uAnti: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uHalo: { value: 1 }, uGlowW: { value: 0.18 } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .99999; }`,
    fragmentShader: `uniform vec3 uZen, uMid, uHor, uGlow, uAnti, uSunCol, uSun; uniform float uHalo, uGlowW; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float hp = max(d.y, 0.);
        vec3 col = mix(uHor, uMid, smoothstep(0., .2, hp));
        col = mix(col, uZen, smoothstep(.12, .8, hp));
        vec2 dh = normalize(d.xz + 1e-5), sh = normalize(uSun.xz + 1e-5);
        float az = dot(dh, sh) * .5 + .5;
        float nearH = exp(-hp / uGlowW);
        col = mix(col, uGlow, pow(az, 2.4) * nearH);
        col = mix(col, uAnti, pow(1. - az, 2.) * exp(-hp / (uGlowW * 1.6)) * .85);
        if (d.y < 0.) col = mix(uHor, uHor * .55, smoothstep(0., -.25, d.y));
        float cs = dot(d, normalize(uSun));
        col += uSunCol * (smoothstep(.99955, .9997, cs) * 8. + pow(max(cs, 0.), 900.) * 3. + pow(max(cs, 0.), 60.) * .6 * uHalo + pow(max(cs, 0.), 8.) * .18 * uHalo);
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 180.; // 抖一下，免得渐变出色阶
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30000, 64, 32), mat); mesh.renderOrder = -10; mesh.frustumCulled = false; mesh.userData.noShadow = true;
  group.add(mesh);
  return {
    mesh,
    update(art, sky, cam) {
      const a = art.cur, u = mat.uniforms;
      u.uZen.value.copy(a.zen); u.uMid.value.copy(a.mid); u.uHor.value.copy(a.hor); u.uGlow.value.copy(a.glow); u.uAnti.value.copy(a.anti);
      u.uSun.value.copy(sky.state.sunDir); u.uHalo.value = a.halo ?? 1;
      u.uSunCol.value.copy(a.sun).multiplyScalar(smooth(-3, 1, sky.state.c.sunElev) * 1.2);
      if (cam) mesh.position.copy(cam);
    },
  };
}

// ---------- 夜空：银河（挂在天上的一条，不铺满天）、不太密的星星、几团想象中的星云、时不时划过的流星 ----------
// strength：银河和星云整体亮度（旷野 1，有月亮的风景淡一些）；meteorEvery：平均几秒一颗流星
export function nightSky(group, { strength = 1, stars = 3600, meteorEvery = 6, lat = 36, seed = 9 } = {}) {
  const r = rng(seed);
  // 银河坐标系：晚上十点前后，银心在南边偏右的低空，银河从那里斜斜拱向东北
  const C0 = _dirFrom(14, 28), Z2 = new THREE.Vector3(-0.55, 1, 0.25).normalize();
  const GN = new THREE.Vector3().crossVectors(C0, Z2).normalize(), GT = new THREE.Vector3().crossVectors(GN, C0).normalize();
  const toWorld = (gx, gy, gz) => new THREE.Vector3().addScaledVector(C0, gx).addScaledVector(GN, gy).addScaledVector(GT, gz);
  const POLE = new THREE.Vector3(0, Math.sin(lat * Math.PI / 180), Math.cos(lat * Math.PI / 180));
  const heavens = new THREE.Group(); group.add(heavens);
  const N3 = `float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(mix(h31(i), h31(i + vec3(1., 0., 0.)), f.x), mix(h31(i + vec3(0., 1., 0.)), h31(i + vec3(1., 1., 0.)), f.x), f.y),
                 mix(mix(h31(i + vec3(0., 0., 1.)), h31(i + vec3(1., 0., 1.)), f.x), mix(h31(i + vec3(0., 1., 1.)), h31(i + vec3(1., 1., 1.)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vn3(p); p *= 2.03; a *= .5; } return s; }`;
  const mwMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
    uniforms: { uOpacity: { value: 0 }, uC: { value: C0 }, uN: { value: GN }, uT: { value: GT } },
    vertexShader: `varying vec3 vO; varying vec3 vW; void main(){ vO = normalize(position); vW = normalize((modelMatrix * vec4(position, 0.)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uC, uN, uT; varying vec3 vO; varying vec3 vW;
      ${N3}
      void main(){
        vec3 g = vec3(dot(vO, uC), dot(vO, uN), dot(vO, uT));
        float lat = g.y, lon = atan(g.z, g.x);
        float core = exp(-lon * lon * 3.5);                                   // 银心只是一小段
        float w = .042 + .035 * core;                                         // 主带半宽约 2.5°–4.5°
        float band = exp(-lat * lat / (w * w));
        float halo = exp(-lat * lat / .012) * .18;                            // 两边很淡的一层
        float n = fbm3(g * 7.), n2 = fbm3(g * 16. + 3.), n3 = fbm3(g * 34. + 7.);
        float dust = smoothstep(.46, .7, fbm3(g * 11. + vec3(1.7, 0., 2.)));
        float rift = exp(-pow((lat - .01 * sin(lon * 4.)) / (.01 + .014 * core), 2.)) * smoothstep(-.1, .8, n); // 中间一道暗缝
        float I = (band * (.35 + .65 * n) * (1. - .75 * dust) * (1. - .8 * rift) + halo * n) * (.55 + 1.1 * core);
        I += exp(-lat * lat / .0016) * core * .5 * n2;
        I *= .7 + .6 * n3;
        vec3 col = mix(vec3(.62, .72, 1.), vec3(1., .84, .64), clamp(core * .85 + .2 * (n2 - .5), 0., 1.));
        float hor = smoothstep(-.02, .2, vW.y);
        gl_FragColor = vec4(col * I * .28 * hor * uOpacity, 1.);
      }`,
  });
  const mw = new THREE.Mesh(new THREE.SphereGeometry(28000, 96, 48), mwMat); mw.userData.noShadow = true; heavens.add(mw);
  // 星云和远方的星系：天上「挂着」的几小团，每团 3°–6°
  const nebMat = (col1, col2, shape) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uA: { value: new THREE.Color(col1) }, uB: { value: new THREE.Color(col2) }, uSeed: { value: r() * 10 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv * 2. - 1.; vW = normalize((modelMatrix * vec4(position, 1.)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uOpacity, uSeed; uniform vec3 uA, uB; varying vec2 vUv; varying vec3 vW;
      ${N3}
      void main(){
        vec2 p = vUv;
        ${shape === 'galaxy'
          ? `vec2 q = mat2(.8, -.6, .6, .8) * p; q.y *= 3.2; float d = length(q); float a = exp(-d * d * 2.2) * (.75 + .5 * fbm3(vec3(q * 3., uSeed))) + exp(-d * d * 40.) * .9; vec3 col = mix(uB, uA, exp(-d * 3.));`
          : `float d = length(p); float f = fbm3(vec3(p * 2.2, uSeed)), f2 = fbm3(vec3(p * 5. + 3., uSeed));
             float a = smoothstep(1., .1, d + (f - .5) * .9) * (.4 + .9 * f2); a *= 1. - smoothstep(.55, .75, fbm3(vec3(p * 4. + 9., uSeed))) * .6;
             vec3 col = mix(uB, uA, smoothstep(.3, .8, f2));`}
        float hor = smoothstep(-.02, .2, vW.y);
        gl_FragColor = vec4(col * a * .5 * hor * uOpacity, 1.);
      }`,
  });
  const nebs = [];
  const addNeb = (gx, gy, gz, size, c1, c2, shape) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), nebMat(c1, c2, shape));
    m.position.copy(toWorld(gx, gy, gz).normalize().multiplyScalar(26000)); m.lookAt(0, 0, 0); m.userData.noShadow = true; heavens.add(m); nebs.push(m);
  };
  addNeb(0.98, 0.03, 0.18, 2400, '#ff7aa8', '#7a3aa0', 'nebula');   // 银心旁边一团品红
  addNeb(0.9, -0.05, -0.42, 1800, '#7ad8ff', '#3a5ab8', 'nebula');  // 一团青蓝
  addNeb(0.2, 0.06, 0.97, 2000, '#ffb88a', '#a84a6a', 'nebula');    // 银河另一头一团暖橙
  addNeb(-0.35, 0.62, 0.7, 2600, '#f4f0ff', '#8a9ad8', 'galaxy');   // 远处一个斜着的旋涡星系
  // 星星：不太密，亮星少而亮
  const sp = [], sc = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.92, 0.78], [1, 0.8, 0.6], [0.75, 0.85, 1]];
  for (let i = 0; i < stars; i++) {
    let gx, gy, gz;
    if (r() < 0.35) { const lon = (r() - 0.5) * Math.PI * 2, la = (r() + r() - 1) * 0.08; gx = Math.cos(lon) * Math.cos(la); gz = Math.sin(lon) * Math.cos(la); gy = Math.sin(la); }
    else { const u = r() * 2 - 1, a = r() * Math.PI * 2; gy = u; gx = Math.sqrt(1 - u * u) * Math.cos(a); gz = Math.sqrt(1 - u * u) * Math.sin(a); }
    const v = toWorld(gx, gy, gz).multiplyScalar(27000), b = Math.pow(r(), 9);
    sp.push({ x: v.x, y: v.y, z: v.z, c: sc[(r() * sc.length) | 0], s: 70 + b * 520, seed: r() });
  }
  const starP = makeLights(sp, { fog: 0, minPx: 1, maxPx: 3.2, gain: 0.7, twinkle: 0.3, horizon: true }); heavens.add(starP);
  // 流星：一条发光的细丝，头亮尾淡；偶尔一颗带绿色的大火流星
  const MN = 4, mPos = new Float32Array(MN * 4 * 3), mCol = new Float32Array(MN * 4 * 4);
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mPos, 3)); mg.setAttribute('color', new THREE.BufferAttribute(mCol, 4));
  const idx = []; for (let k = 0; k < MN; k++) { const b = k * 4; idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); } mg.setIndex(idx);
  const meteors = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  meteors.frustumCulled = false; meteors.userData.noShadow = true; group.add(meteors);
  const live = Array.from({ length: MN }, () => ({ t: -1 })); let next = 2;
  const up = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), side = new THREE.Vector3();
  return {
    heavens,
    update(dt, t, c, { dark = 1, cam } = {}) {
      heavens.quaternion.setFromAxisAngle(POLE, -(c.h - 22) * 15 * Math.PI / 180);
      const k = dark * strength;
      mwMat.uniforms.uOpacity.value = k; for (const m of nebs) m.material.uniforms.uOpacity.value = k;
      starP.material.uniforms.uOpacity.value = dark; starP.material.uniforms.uTime.value = t;
      // 流星
      if (dark > 0.4 && (next -= dt) < 0) {
        next = meteorEvery * (0.3 + r() * 1.4);
        const m = live.find((x) => x.t < 0);
        if (m) {
          const el = 22 + r() * 50, az = (r() - 0.5) * 300, big = r() < 0.12;
          m.a = _dirFrom(el, az); const s2 = new THREE.Vector3().crossVectors(m.a, up).normalize();
          m.b = m.a.clone().addScaledVector(s2, (r() - 0.5) * 0.6).addScaledVector(up, -0.1 - r() * 0.25).normalize();
          m.t = 0; m.dur = big ? 1.4 + r() * 0.6 : 0.45 + r() * 0.6; m.w = big ? 70 : 28 + r() * 20; m.col = big ? [0.75, 1, 0.8] : [1, 0.96, 0.9]; m.br = big ? 2.2 : 0.8 + r() * 0.8;
        }
      }
      live.forEach((m, i) => {
        const b = i * 4;
        if (m.t < 0) { for (let j = 0; j < 4; j++) mCol.set([0, 0, 0, 0], (b + j) * 4); return; }
        m.t += dt; const p = m.t / m.dur;
        if (p >= 1) { m.t = -1; return; }
        tmpA.lerpVectors(m.a, m.b, p).normalize().multiplyScalar(25000); tmpB.lerpVectors(m.a, m.b, Math.max(0, p - 0.4)).normalize().multiplyScalar(25000);
        side.subVectors(tmpA, tmpB).cross(tmpA).normalize().multiplyScalar(m.w);
        const fade = Math.sin(p * Math.PI) * m.br * dark;
        mPos.set([tmpA.x + side.x, tmpA.y + side.y, tmpA.z + side.z, tmpA.x - side.x, tmpA.y - side.y, tmpA.z - side.z, tmpB.x + side.x * 0.2, tmpB.y + side.y * 0.2, tmpB.z + side.z * 0.2, tmpB.x - side.x * 0.2, tmpB.y - side.y * 0.2, tmpB.z - side.z * 0.2], b * 3);
        mCol.set([...m.col, fade, ...m.col, fade, ...m.col, 0, ...m.col, 0], b * 4);
      });
      mg.attributes.position.needsUpdate = true; mg.attributes.color.needsUpdate = true;
      if (cam) meteors.position.copy(cam);
    },
  };
}

// ---------- Blender 模型：载入 .glb，按摆放表建实例化网格 ----------
// placements: { 模型名: [[x, y, z, 朝向, 缩放], ...] }；材质：body（顶点颜色）/ leaf（树）/ glow(模型名)（夜里发光的部分）
export function softFoliage(geo) { // 树冠法线改成从树冠中心往外放射：叶子是软的一团
  const p = geo.attributes.position, nrm = geo.attributes.normal, col = geo.attributes.color;
  if (!nrm || !col) return;
  const c = new THREE.Vector3(), tmp = new THREE.Vector3(); let k = 0;
  const leaf = (i) => { const r = col.getX(i), g = col.getY(i), b = col.getZ(i); return g > r * 1.1 && g > b; };
  for (let i = 0; i < p.count; i++) if (leaf(i)) { c.add(tmp.fromBufferAttribute(p, i)); k++; }
  if (!k) return; c.divideScalar(k);
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    if (!leaf(i)) continue;
    tmp.fromBufferAttribute(p, i).sub(c); tmp.y *= 1.3; tmp.normalize();
    n.fromBufferAttribute(nrm, i).lerp(tmp, 0.8).normalize(); nrm.setXYZ(i, n.x, n.y, n.z);
  }
  nrm.needsUpdate = true;
}
const _loader = new GLTFLoader();
export function loadModel(url) { return _loader.loadAsync(url); }
export function instanceModels(group, base, placements, { body, leaf, glow, isTree = () => false, castShadow = () => true } = {}) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  return Promise.all(Object.entries(placements).filter(([, l]) => l.length).map(async ([name, list]) => {
    const gl = await _loader.loadAsync(base + name + '.glb');
    gl.scene.updateMatrixWorld(true);
    const meshes = []; gl.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const src of meshes) {
      const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld);
      const isGlow = /glow/.test(src.material.name);
      if (!isGlow && isTree(name)) softFoliage(geo);
      const mat = isGlow ? glow(name) : isTree(name) ? (leaf || body) : body;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, rot, s], i) => { m4.compose(pv.set(x, y, z), q.setFromAxisAngle(upv, rot), sv.setScalar(s)); im.setMatrixAt(i, m4); });
      im.castShadow = !isGlow && castShadow(name); im.receiveShadow = !isTree(name);
      im.computeBoundingSphere(); group.add(im);
    }
  })).catch((e) => console.warn('风景模型没载入', e));
}
