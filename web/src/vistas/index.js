// 天台风景注册：每套风景一个天台（roof:<id>），同一个天台模型，换远景、地面高度（楼有多高）、雾和夜空。
//
// 远景单独放一个场景，用近裁剪面 1 米的相机先画到一张图上，再当背景铺在主画面最底下，天台、人、手、烟照常画在上面。
// 原因：主相机近裁剪面是 0.01 米（烟凑到嘴边不能被切掉），几公里外的楼深度精度只剩几十米，前后楼会互相闪穿。
// 远景一律在天台外面，永远在天台后面，所以先画远景再画天台不会出错。天空也挪到远景场景里一起画。
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { smooth, LOW } from './common.js';
import { createSea } from '../sea.js';
import { createNYC } from './nyc.js';
import { createHokkaido } from './hokkaido.js';
import { createWilds } from './wilds.js';
import { createInaka } from './inaka.js';
import { createMiami } from './miami.js';

// ground：远景地面相对天台的高度（米），也就是楼有多高；fog：雾浓度
export const VISTA_DEFS = {
  sea: { name: '海', create: createSea, ground: -22, fog: 0.00011 },
  nyc: { name: '纽约', create: createNYC, ground: -182, fog: 0.0002 },
  hokkaido: { name: '北海道', create: createHokkaido, ground: -12, fog: 0.00006 },
  wilds: { name: '旷野', create: createWilds, ground: -3.6, fog: 0.00004 },
  inaka: { name: '乡间', create: createInaka, ground: -7, fog: 0.00012 },
  miami: { name: '迈阿密霓虹', create: createMiami, ground: -38, fog: 0.00012 },
};
export const VISTA_IDS = Object.keys(VISTA_DEFS);
const DOME_DEF = { top: '#020414', horizon: '#131a3a' };

// 开发用：?tick=1 时浏览器面板藏在后台也照样跑动画循环（后台页面会暂停 requestAnimationFrame，截图验证用）
if (new URLSearchParams(location.search).has('tick')) window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 33);

// 画质：手机 / 低端机远景降到 0.6 倍分辨率、不做多重采样、影子图 2048；开发时 ?vq=low / ?vq=high 强制
const Q = LOW ? { scale: 0.6, samples: 0, shadow: 2048, glow: false } : { scale: 1, samples: 4, shadow: 4096, glow: true };

export function createVistas(scene, sky) {
  let cur = null, curId = null;
  const vscene = new THREE.Scene(); vscene.fog = scene.fog;
  vscene.add(sky.group);
  const farCam = new THREE.PerspectiveCamera(70, 1, 1, 60000);
  // 灯：照着主场景的太阳、月光、天光每帧抄一份。太阳在远景里投真实的影子（范围、精度由风景自己定 cur.shadow）
  let srcLights = null; const lights = [];
  const sunTarget = new THREE.Vector3(), lastSun = new THREE.Vector3();
  let shadowAge = 99;
  const syncLights = () => {
    if (!srcLights) {
      srcLights = scene.children.filter((o) => o.isDirectionalLight || o.isHemisphereLight);
      for (const L of srcLights) { const c = L.isHemisphereLight ? new THREE.HemisphereLight() : new THREE.DirectionalLight(); if (c.target) vscene.add(c.target); vscene.add(c); lights.push(c); }
      const sun = lights.find((l) => l.isDirectionalLight);
      if (sun) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.autoUpdate = false; sun.userData.isSun = true; }
    }
    const art = cur?.art?.cur;
    srcLights.forEach((L, i) => {
      const c = lights[i]; c.color.copy(L.color); c.intensity = L.intensity * ((L.isHemisphereLight ? cur?.hemiK : cur?.dirK) ?? 1); // 风景可以按需要压暗月光（城里楼面不该被月亮照亮）
      if (art && L.isHemisphereLight) { c.color.copy(art.hemi); c.groundColor.copy(art.ground); c.intensity = art.hemiK; return; } // 美术配色接管天光
      if (art && c.userData.isSun) { c.color.copy(art.sun); c.intensity = art.sunK * smooth(-2, 3, sky.state.c.sunElev); }
      if (L.isHemisphereLight) { c.groundColor.copy(L.groundColor); if (cur?.hemiGround) c.groundColor.lerp(cur.hemiGround, cur.hemiGroundK ?? 1); return; } // 城里夜里地面的灯把楼从下往上照暖
      const dir = tmpV.copy(L.position).sub(L.target.position).normalize();
      const sh = cur?.shadow;
      if (c.userData.isSun && sh && c.intensity > 0.05 && dir.y > 0.01) {
        // 影子框：以风景指定的中心为准，沿太阳方向退远；太阳挪动一点或隔几秒才重画一次影子图
        sunTarget.set(...sh.center); c.target.position.copy(sunTarget); c.position.copy(sunTarget).addScaledVector(dir, sh.size * 2);
        const cam = c.shadow.camera; if (cam.right !== sh.size) { Object.assign(cam, { left: -sh.size, right: sh.size, top: sh.size, bottom: -sh.size, near: 1, far: sh.size * 5 }); cam.updateProjectionMatrix(); c.shadow.bias = sh.bias ?? -0.0005; c.shadow.normalBias = sh.normalBias ?? 1.5; c.shadow.needsUpdate = true; }
        if (!c.castShadow) { c.castShadow = true; c.shadow.needsUpdate = true; }
        if (lastSun.angleTo(dir) > 0.003 || (shadowAge += 1) > 240) { c.shadow.needsUpdate = true; lastSun.copy(dir); shadowAge = 0; }
      } else {
        c.castShadow = false; c.target.position.set(0, 0, 0); c.position.copy(dir).multiplyScalar(1000);
      }
    });
    vscene.environment = scene.environment; vscene.environmentIntensity = scene.environmentIntensity * (cur?.envK ?? 1);
  };
  const tmpV = new THREE.Vector3();

  // 远景用全分辨率（带多重采样抗锯齿）单独画，不跟着天台一起像素化：
  // 主场景里一个排在最前面的「钩子」把远景画进自己的图，同时把主画面的透明度清成 0；
  // 像素化（或普通渲染）之后，合成通道 attach() 再按透明度 / 深度把天台叠在全分辨率的远景上。
  // 没接合成通道时退回老办法：钩子直接把远景铺在主画面底下（会跟着像素化）。
  let rt = null, attached = false, drewFrame = -1, frameNo = 0;
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: { tMap: { value: null }, uOn: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`,
    fragmentShader: `uniform sampler2D tMap; uniform float uOn; varying vec2 vUv; void main(){ if (uOn < .5) discard; gl_FragColor = texture2D(tMap, vUv); }`,
  });
  const bgGeo = new THREE.BufferGeometry(); bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const hook = new THREE.Mesh(bgGeo, bgMat); hook.frustumCulled = false; hook.renderOrder = -1e9;
  const sz = new THREE.Vector2(), clearC = new THREE.Color();
  hook.onBeforeRender = (renderer, sc, camera) => {
    if (sc.overrideMaterial) return; // 像素风的法线通道：不画远景
    const outer = renderer.getRenderTarget();
    if (attached) { renderer.getDrawingBufferSize(sz); sz.set(Math.max(1, Math.round(sz.x * Q.scale)), Math.max(1, Math.round(sz.y * Q.scale))); } else if (outer) sz.set(outer.width, outer.height); else renderer.getDrawingBufferSize(sz);
    const samples = attached ? Q.samples : outer?.samples || 0;
    if (!rt || rt.width !== sz.x || rt.height !== sz.y || rt.samples !== samples) {
      rt?.dispose(); rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples, generateMipmaps: attached && Q.glow, minFilter: attached && Q.glow ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter }); // 多级纹理给光晕用
      if (!attached && outer?.texture.minFilter === THREE.NearestFilter) rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
    }
    farCam.fov = camera.fov; farCam.aspect = camera.aspect; farCam.updateProjectionMatrix();
    camera.matrixWorld.decompose(farCam.position, farCam.quaternion, farCam.scale);
    const dbg = window.__vcam; if (dbg) { farCam.position.set(...dbg.p); farCam.rotation.set(dbg.pitch || 0, dbg.yaw || 0, 0, 'YXZ'); } // 调试：远景单独换个机位看
    syncLights();
    const ac = renderer.autoClear; renderer.autoClear = true;
    renderer.setRenderTarget(rt); renderer.render(vscene, farCam); renderer.setRenderTarget(outer);
    renderer.autoClear = ac;
    bgMat.uniforms.tMap.value = rt.texture; bgMat.uniforms.uOn.value = attached ? 0 : 1;
    if (attached) { renderer.getClearColor(clearC); const a = renderer.getClearAlpha(); renderer.setClearColor(clearC, 0); renderer.clear(true, false, false); renderer.setClearColor(clearC, a); drewFrame = frameNo; }
  };
  scene.add(hook);
  // 合成：天台不透明的地方（像素风时看深度）用天台，其余按透明度把远景透出来（烟、光晕、玻璃照样叠在远景上）
  function attach(composer, pixelPass) {
    const pass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, tVista: { value: null }, tDepth: { value: null }, uMode: { value: 0 }, uGlowK: { value: 0 }, uGlowT: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      // 远景自己的光晕：从多级纹理里取几层模糊，亮过门槛的部分溢出来（美术用，比如雪原泛光、城市灯火的光晕）
      fragmentShader: `uniform sampler2D tDiffuse, tVista, tDepth; uniform float uMode, uGlowK, uGlowT; varying vec2 vUv;
        void main(){ vec4 b = texture2D(tDiffuse, vUv);
          if (uMode < .5) { gl_FragColor = b; return; }
          float a = clamp(b.a, 0., 1.);
          if (uMode > 1.5 && texture2D(tDepth, vUv).r < .9999999) a = 1.;
          vec3 v = texture2D(tVista, vUv).rgb;
          if (uGlowK > 0.) {
            vec3 g = textureLod(tVista, vUv, 3.).rgb * .22 + textureLod(tVista, vUv, 4.).rgb * .28 + textureLod(tVista, vUv, 5.).rgb * .28 + textureLod(tVista, vUv, 6.).rgb * .22;
            v += max(g - uGlowT, 0.) * uGlowK;
          }
          gl_FragColor = vec4(b.rgb + v * (1. - a), 1.); }`,
    });
    const base = pass.render.bind(pass);
    pass.render = (renderer, w, r, dt, m) => {
      const live = drewFrame === frameNo && rt;
      const px = composer.passes[0] === pixelPass;
      pass.uniforms.uMode.value = live ? (px ? 2 : 1) : 0;
      pass.uniforms.tVista.value = rt?.texture ?? null;
      const gl = Q.glow && cur?.glow; pass.uniforms.uGlowK.value = gl ? gl.k : 0; pass.uniforms.uGlowT.value = gl ? gl.t : 1;
      pass.uniforms.tDepth.value = px ? pixelPass.beautyRenderTarget.depthTexture : null;
      base(renderer, w, r, dt, m);
      frameNo++;
    };
    composer.insertPass(pass, 1);
    attached = true;
  }

  const made = {};
  const dome = sky.dome.material.uniforms;
  let halo = null;
  sky.moon.scale.setScalar(560); // 月亮小一点（原来 900，看着像一盏灯）
  return {
    scene: vscene, attach,
    get id() { return curId; },
    get current() { return cur; },
    set(id) {
      const force = new URLSearchParams(location.search).get('vista'); if (force && VISTA_DEFS[force]) id = force; // 开发用：?vista=inaka 只换本机看到的远景
      if (!VISTA_DEFS[id]) id = 'sea';
      if (id === curId) return cur;
      if (cur) cur.group.visible = false;
      made[id] ??= VISTA_DEFS[id].create(vscene);
      cur = made[id]; curId = id; cur.group.visible = true;
      return cur;
    },
    update(dt, t, sky, atmo) {
      if (!cur) return;
      const def = VISTA_DEFS[curId];
      scene.fog.density = cur.fog ?? def.fog;
      dome.uTop.value.set(cur.dome?.top ?? DOME_DEF.top); dome.uHorizon.value.set(cur.dome?.horizon ?? DOME_DEF.horizon);
      cur.update(dt, t, sky, atmo, vscene);
      // 月亮的大光晕（sky.js 里 9000 米的那张）：月亮低的时候会把半边天照成一个大白圆盘，云成了黑剪影，太突兀，压到几乎看不见
      halo ??= sky.group.children.find((o) => o.isSprite && o.scale.x > 5000); if (halo) halo.material.opacity *= 0.06;
      // 有美术天空的风景：藏起物理天空和夜空罩子（星星、月亮照旧），雾色雾浓度跟着调色板
      const art = cur.art?.cur;
      sky.sky.visible = sky.dome.visible = !art;
      if (art) { scene.fog.color.copy(art.fog); scene.fog.density = (cur.fog ?? def.fog) * (art.fogK ?? 1); }
    },
  };
}
