// 天空：物理天空着色器 + 夜空渐变 + 星星 + 月亮，按本地时间算太阳和月亮的位置
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const deg = Math.PI / 180;

// 小时 → 太阳/月亮高度角和方位角（海在 -Z 方向，日出在左、日落在右）
export function celestial(hour) {
  const h = ((hour % 24) + 24) % 24;
  const sunElev = 62 * Math.sin(Math.PI * (h - 6.4) / 12.2);
  const sunAz = lerp(-115, 115, clamp((h - 6.4) / 12.2, 0, 1));
  const mh = (h - 19 + 24) % 24;
  const moonElev = 50 * Math.sin(Math.PI * mh / 11.5);
  const moonAz = lerp(-80, 95, clamp(mh / 11.5, 0, 1));
  const night = clamp((-sunElev + 1.5) / 13, 0, 1);
  const dusk = clamp(1 - Math.abs(sunElev - 2) / 12, 0, 1) * (1 - night * 0.6); // 日出日落的暖色
  return { h, sunElev, sunAz, moonElev, moonAz, night, dusk };
}
export function dirFrom(elev, az) {
  return new THREE.Vector3().setFromSphericalCoords(1, (90 - elev) * deg, Math.PI - az * deg);
}

function starsMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `attribute float size; attribute float seed; varying float vA; uniform float uTime;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        float tw = 0.65 + 0.35 * sin(uTime * (1.5 + seed * 3.) + seed * 40.);
        vA = tw; gl_PointSize = size; }`,
    fragmentShader: `uniform float uOpacity; varying float vA;
      void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); float a = smoothstep(.5, .0, d);
        a = a * a; gl_FragColor = vec4(vec3(1., .97, .92), a * vA * uOpacity); }`,
  });
}
function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(0.15, inner.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function moonTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(110, 110, 10, 128, 128, 120); gr.addColorStop(0, '#fbf7ea'); gr.addColorStop(1, '#d9d2bd');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.18; g.fillStyle = '#8a8270';
  for (const [x, y, r] of [[90, 100, 30], [160, 150, 40], [120, 180, 18], [175, 85, 16], [70, 160, 12], [140, 60, 10]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createSky(scene) {
  const group = new THREE.Group(); scene.add(group);
  const sky = new Sky(); sky.scale.setScalar(45000); group.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 4.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;

  // 夜空：天黑后盖在物理天空上的一层深蓝渐变
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { uNight: { value: 0 }, uTop: { value: new THREE.Color('#020414') }, uHorizon: { value: new THREE.Color('#131a3a') } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uNight; uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vP;
      void main(){ float h = clamp(vP.y, 0., 1.); vec3 c = mix(uHorizon, uTop, pow(h, .45)); gl_FragColor = vec4(c, uNight * .92); }`,
  }));
  dome.renderOrder = 1; group.add(dome);

  // 星星
  const N = 4200, pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().setFromSphericalCoords(30000, Math.acos(Math.random() * 0.98) , Math.random() * Math.PI * 2);
    pos.set([v.x, Math.abs(v.y) + 300, v.z], i * 3);
    size[i] = Math.random() ** 6 * 3.2 + 0.9; seed[i] = Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('size', new THREE.BufferAttribute(size, 1)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const stars = new THREE.Points(sg, starsMaterial()); stars.renderOrder = 2; stars.frustumCulled = false; group.add(stars);

  // 月亮和光晕
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false }));
  moon.scale.setScalar(900); moon.renderOrder = 3; group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(190,205,255,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(9000); halo.renderOrder = 3; group.add(halo);

  const state = { sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), c: celestial(12) };
  return {
    group, sky, dome, stars, moon, state,
    update(hour, t, camera) {
      const c = celestial(hour); state.c = c;
      state.sunDir.copy(dirFrom(c.sunElev, c.sunAz));
      state.moonDir.copy(dirFrom(c.moonElev, c.moonAz));
      u.sunPosition.value.copy(state.sunDir);
      u.rayleigh.value = lerp(1.4, 2.6, c.dusk);
      u.turbidity.value = lerp(4.5, 7, c.dusk);
      dome.material.uniforms.uNight.value = c.night;
      stars.material.uniforms.uOpacity.value = clamp((c.night - 0.25) / 0.6, 0, 1);
      stars.material.uniforms.uTime.value = t;
      group.position.copy(camera.position);
      const mv = state.moonDir.clone().multiplyScalar(28000);
      moon.position.copy(mv); halo.position.copy(mv);
      const mvis = clamp((c.moonElev + 2) / 6, 0, 1);
      moon.material.opacity = mvis * lerp(0.35, 1, c.night);
      halo.material.opacity = mvis * c.night;
    },
  };
}

// 根据时间给出雾色、环境光等
export function atmosphere(c) {
  const day = new THREE.Color('#b8cde2'), dusk = new THREE.Color('#e5a07c'), night = new THREE.Color('#0c1228');
  const fog = day.clone().lerp(dusk, c.dusk).lerp(night, c.night);
  return {
    fog,
    sunColor: new THREE.Color('#fff4e2').lerp(new THREE.Color('#ff9a55'), c.dusk),
    sunIntensity: clamp(c.sunElev / 12, 0, 1) * 3.2,
    moonIntensity: c.night * clamp((c.moonElev + 2) / 8, 0, 1) * 0.55,
    hemiSky: new THREE.Color('#bcd6ff').lerp(new THREE.Color('#ffb28a'), c.dusk).lerp(new THREE.Color('#1b2448'), c.night),
    hemiGround: new THREE.Color('#5a5048').lerp(new THREE.Color('#0a0a10'), c.night),
    hemiIntensity: lerp(1.1, 0.35, c.night),
    exposure: lerp(0.55, 0.95, c.night),
  };
}
