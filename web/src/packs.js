// 烟盒：所有牌子的正面图拼成一张大贴图（atlas），每个牌子一个几何体，正面 UV 指向自己那一格
// 有 Gemini 资产图的用图（先读 web/public/gen/ 里压过的小图，没有再读原图），没有的用程序画的
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CW = 96, CH = 144, COLS = 16;           // 每格 96×144（2:3，和资产图一样）
const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
const BASE = import.meta.env.BASE_URL;

// 盒子尺寸（米）：宽、高、厚
export function packSize(b) {
  if (b.packType === 'tin') return [0.088, 0.105, 0.02];
  if (b.packType === 'flat') return [0.07, 0.095, 0.013];
  if (b.packType === 'bundle') return [0.045, 0.075, 0.028];
  if (b.slim) return [0.048, 0.098, 0.017];
  if (b.packType === 'soft') return [0.056, 0.086, 0.021];
  return [0.055, 0.088, 0.022];
}

function drawFallback(g, b, x, y) {
  g.fillStyle = b.pack[0]; g.fillRect(x, y, CW, CH);
  g.fillStyle = b.pack[1]; g.fillRect(x, y, CW, 32); g.fillRect(x + 12, y + 70, CW - 24, 28);
  g.fillStyle = b.pack[0]; g.font = `800 15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText((b.nameEn || b.name).split(' ')[0], x + CW / 2, y + 84, CW - 28);
  g.fillStyle = b.pack[1]; g.font = `600 10px ${FONT}`; g.fillText(b.region, x + CW / 2, y + 48, CW - 10);
  g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x, y + CH - 30, CW, 30);
  g.fillStyle = '#fff'; g.font = `600 10px ${FONT}`; g.fillText('SMOKING HARMS', x + CW / 2, y + CH - 15);
}

export function createPackAtlas(brands) {
  const rows = Math.ceil((brands.length + 1) / COLS);
  const W = CW * COLS, H = CH * rows;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const cell = (i) => [(i % COLS) * CW, Math.floor(i / COLS) * CH];
  const uv = (i) => { const [x, y] = cell(i); return [x / W, 1 - (y + CH) / H, (x + CW) / W, 1 - y / H]; };
  // 最后一格涂白：盒子侧面用这一格 + 顶点颜色上色
  const wi = brands.length; { const [x, y] = cell(wi); g.fillStyle = '#fff'; g.fillRect(x, y, CW, CH); }
  brands.forEach((b, i) => {
    const [x, y] = cell(i); drawFallback(g, b, x, y);
    if (!b.img) return;
    const img = new Image();
    img.onload = () => { g.imageSmoothingEnabled = false; g.drawImage(img, x, y, CW, CH); g.imageSmoothingEnabled = true; texture.needsUpdate = true; }; // 像素画：贴的时候别糊
    img.onerror = () => { if (img.dataset.fallback) return; img.dataset.fallback = '1'; img.src = `${BASE}catalog/${b.img}`; };
    img.src = `${BASE}gen/cig/${b.id}.png`;
  });
  texture.needsUpdate = true;
  const [wu0, wv0, wu1, wv1] = uv(wi), white = [(wu0 + wu1) / 2, (wv0 + wv1) / 2];
  const material = new THREE.MeshPhysicalMaterial({ map: texture, vertexColors: true, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35 });

  // 一个牌子的盒子：圆角（真烟盒的棱是圆的），正面 +z 用整张图；
  // 侧面取图最左边一窄条、顶面取最上面一窄条、底面取最下面一窄条——颜色和花纹跟正面接得上，像真盒子包过来；背面用整张图
  function geometry(b, i) {
    const [w, h, d] = packSize(b);
    const soft = b.packType === 'soft' || b.packType === 'bundle';
    const geo = new RoundedBoxGeometry(w, h, d, 2, soft ? 0.004 : 0.0016);
    const uvA = geo.attributes.uv, n = uvA.count, col = new Float32Array(n * 3).fill(1);
    const face = new Int8Array(n).fill(-1), idx = geo.index;
    for (const g of geo.groups) for (let k = g.start; k < g.start + g.count; k++) face[idx ? idx.getX(k) : k] = g.materialIndex; // 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
    const [u0, v0, u1, v1] = uv(i), du = u1 - u0, dv = v1 - v0;
    for (let k = 0; k < n; k++) {
      const x = uvA.getX(k), y = uvA.getY(k), f = face[k];
      if (f === 4 || f === 5) uvA.setXY(k, u0 + x * du, v0 + y * dv);
      else if (f === 0 || f === 1) uvA.setXY(k, u0 + (0.02 + x * 0.08) * du, v0 + y * dv);       // 侧面：最左边 8%
      else if (f === 2) uvA.setXY(k, u0 + x * du, v0 + (0.93 + y * 0.05) * dv);                  // 顶：最上面一条
      else uvA.setXY(k, u0 + x * du, v0 + (0.02 + y * 0.05) * dv);                                 // 底
      if (f !== 4 && f !== 5) col.set([0.9, 0.9, 0.9], k * 3); // 侧面稍暗一点，棱角更清楚
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.clearGroups();
    return geo;
  }
  return { texture, material, geometry, uv };
}
