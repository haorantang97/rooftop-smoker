// 烟雾：世界坐标里的软粒子。烟头的细烟往上飘、打卷；吐出来的烟是一大团，慢慢散开
import * as THREE from 'three';
import { smokeTexture } from './textures.js';

const MAX = 2600;
export function createSmoke(scene) {
  const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX), rot = new Float32Array(MAX), tint = new Float32Array(MAX * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('rot', new THREE.BufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: smokeTexture() }, uScale: { value: 800 }, uLight: { value: new THREE.Color(1, 1, 1) }, uWarm: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: `attribute float size; attribute float alpha; attribute float rot; attribute vec3 tint;
      varying float vA; varying float vR; varying vec3 vT; uniform float uScale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        float px = size * uScale / -mv.z; gl_PointSize = clamp(px, 0., 700.); vA = alpha; vR = rot; vT = tint;
        // 离镜头近的变淡（刚吐出来的烟在脸前，不该糊满屏幕），画面上太大的一团也按比例变淡
        vA *= smoothstep(.07, .4, -mv.z) * clamp(700. / max(px, 1.), .25, 1.); }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uLight; uniform vec3 uWarm; varying float vA; varying float vR; varying vec3 vT;
      void main(){ vec2 p = gl_PointCoord - .5; float c = cos(vR), s = sin(vR); p = mat2(c,-s,s,c) * p; vec4 t = texture2D(uMap, p + .5);
        float a = t.r * vA; if (a < .003) discard; gl_FragColor = vec4(vT * uLight + uWarm, a); }`,
  });
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 10; scene.add(points);
  const P = [];
  let head = 0;
  const spawn = (o) => {
    const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.02, grow: 0.05, life: 0, max: 3, a: 0.3, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.6, drag: 0.6, buoy: 0.05, curl: 0.02, tint: [0.85, 0.86, 0.9], seed: Math.random() * 100, ...o };
    if (P.length < MAX) P.push(p); else { P[head] = p; head = (head + 1) % MAX; }
  };
  return {
    points, mat,
    // 烟头冒的细烟（k 用来放大别人的烟，在远处也看得见）
    // 一缕细烟：粒子最多长到 5～6 厘米宽，飘两三秒就散（以前会长到十几厘米，像一大股）
    wisp(at, tint, k = 1) { spawn({ x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * 0.008, vy: 0.035 + Math.random() * 0.025, vz: (Math.random() - 0.5) * 0.008, size: 0.004 * k, grow: 0.024 * k, max: 2.3 + Math.random() * 0.8, a: 0.17, drag: 0.3, buoy: 0.03, curl: 0.03, tint }); },
    // 吐烟：dur 秒内持续吐出来。吸得短只吐一缕，吸得久才多、才浓；烟本身不大，几秒就散
    // follow = { at(), vel() }：自己吐的时候人在走，后吐出来的烟从嘴现在的位置出来，并带上一点走路的速度，
    // 先跟着往前、再慢下来从身边往后飘（不然整团留在原地，人一走就穿过去，什么也看不见）
    exhale(at, dir, amt, tint, k = 1, dur = 0.5, follow = null) {
      const n = Math.round(6 + 30 * amt * amt * (0.6 + dur * 0.4));
      for (let i = 0; i < n; i++) {
        const q = i / n, fade = 1 - q * 0.7;
        // 吐得够远（半米到一米多）才看得见：太近会落在镜头前「变淡」的范围里，整团看不到
        const sp = (0.55 + Math.random() * 0.6) * (0.5 + amt * 0.7) * fade;
        const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.3) * 0.22, (Math.random() - 0.5) * 0.3)).normalize();
        spawn({ follow, x: at.x, y: at.y, z: at.z, vx: d.x * sp, vy: d.y * sp, vz: d.z * sp, life: -q * dur, size: (0.015 + Math.random() * 0.015) * k, grow: (0.05 + Math.random() * 0.05) * k * (0.6 + amt * 0.6), max: 2 + amt * 1.4 + Math.random() * 0.8, a: (0.16 + amt * 0.12) * (0.5 + 0.5 * fade), drag: 0.85, buoy: 0.05, curl: 0.06, tint });
      }
    },
    ash(at) { for (let i = 0; i < 8; i++) spawn({ x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * 0.08, vy: -0.05, vz: (Math.random() - 0.5) * 0.08, size: 0.004, grow: 0, max: 1.6, a: 0.9, drag: 0.2, buoy: -1.4, curl: 0.01, tint: [0.45, 0.43, 0.41] }); },
    update(dt, camera, light, warm, t) {
      mat.uniforms.uScale.value = window.innerHeight * camera.projectionMatrix.elements[5] * 0.5 * Math.min(window.devicePixelRatio || 1, 1.5);
      mat.uniforms.uLight.value.copy(light); mat.uniforms.uWarm.value.copy(warm);
      let n = 0;
      for (const p of P) {
        p.life += dt;
        if (p.life < 0 || p.life > p.max) continue;
        if (p.follow) { const a = p.follow.at(), v = p.follow.vel(); p.x = a.x; p.y = a.y; p.z = a.z; p.vx += v.x * 0.7; p.vz += v.z * 0.7; p.follow = null; }
        const d = Math.exp(-p.drag * dt);
        p.vx = p.vx * d + Math.sin(t * 1.3 + p.seed + p.y * 9) * p.curl * dt;
        p.vz = p.vz * d + Math.cos(t * 1.1 + p.seed + p.y * 7) * p.curl * dt;
        p.vy = p.vy * d + p.buoy * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.size += p.grow * dt; p.grow *= Math.exp(-0.35 * dt); p.rot += p.spin * dt;
        const k = p.life / p.max;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        size[n] = p.size; rot[n] = p.rot;
        alpha[n] = p.a * (k < 0.08 ? k / 0.08 : (1 - k) ** 1.6);
        tint.set(p.tint, n * 3);
        n++;
      }
      g.setDrawRange(0, n);
      for (const k of ['position', 'size', 'alpha', 'rot', 'tint']) g.attributes[k].needsUpdate = true;
    },
  };
}
