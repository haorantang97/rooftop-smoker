// 贴图：下载好的 PBR 材质 + 现场画的 Canvas 贴图
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const base = (p) => `${import.meta.env.BASE_URL}assets/${p}`;

// Poly Haven 的一组 PBR 贴图：diff / nor / arm（AO、粗糙度、金属度）
export function pbr(dir, repeat = [1, 1], opts = {}) {
  const set = (t, srgb) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const diff = set(loader.load(base(`tex/${dir}/diff.jpg`)), true);
  const nor = set(loader.load(base(`tex/${dir}/nor.jpg`)));
  const arm = set(loader.load(base(`tex/${dir}/arm.jpg`)));
  return new THREE.MeshStandardMaterial({ map: diff, normalMap: nor, aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1, ...opts });
}
export function tex(p, repeat) {
  const t = loader.load(base(p));
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
export function canvasTex(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}
export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 软软的烟团贴图
export function smokeTexture() {
  const r = rng(11);
  return canvasTex(256, 256, (g) => {
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, d = r() * 60, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, rad = 30 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.09})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
  }, { srgb: false });
}
export function glowTex(color = '255,255,255') {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.2, `rgba(${color},.5)`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
