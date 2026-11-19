// 货架上东西的 3D 模型（真实尺寸，米），底部在 y=0，正面朝 +z
// 每个模型带两种状态，给第一视角的吃喝动作用：
//   userData.setOpen(p)   p 从 0 到 1：拉环、拧盖、撕盖、撕包装的过程，1 是已经打开
//   userData.setEaten(e)  e 从 0 到 1：吃掉了多少（巧克力变短、关东煮少一个、面变少）
// 外形和包装来自 data.js 的 look：[外形, 主色, 副色, 包装上的字, 包装版式]
// 包装版式参考的是全世界最有名的那几样零食饮料：只保留配色、版式和外形，名字图案全部原创
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ITEM } from '../../public/js/data.js';
import { canvasTex, rng } from './textures.js';

const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Songti SC", serif';
const texCache = new Map();
const V2 = (x, y) => new THREE.Vector2(x, y);

// ---------- Gemini 画的包装图（目录饮料）----------
// 先读压好的像素画 gen/drink/<id>.png，没压过就退回原图 catalog/…；wrap：绕罐身 / 瓶身一圈，图的正中朝前；face：贴在盒子一面上，只取中间一半
const imgLoader = new THREE.ImageLoader(), labelCache = new Map();
function labelTex(it, mode) {
  const key = `${it.id}|${mode}`; if (labelCache.has(key)) return labelCache.get(key);
  const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.magFilter = THREE.NearestFilter; // 像素画：放大时不糊
  if (mode === 'wrap') { t.wrapS = THREE.RepeatWrapping; t.offset.x = 0.5; }
  if (mode === 'face') { t.repeat.set(0.5, 1); t.offset.set(0.25, 0); }
  if (mode === 'front3') { t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.offset.x = 0.5; } // 零食正面图绕圆筒一圈印三遍，正中朝前
  const base = import.meta.env.BASE_URL, done = (img) => { t.image = img; t.needsUpdate = true; };
  imgLoader.load(`${base}gen/${it.catDir || 'drink'}/${it.id}.png`, done, undefined, () => { if (it.label) imgLoader.load(`${base}catalog/${it.label}`, done); });
  labelCache.set(key, t);
  return t;
}

// ---------- 包装印刷 ----------
// wrap：罐子瓶子那种绕一圈的标签，主图画在正中，贴图偏移半圈让正中朝前
function art(design, a, b, word, w, h, wrap = false) {
  const key = `${design}|${a}|${b}|${word}|${w}x${h}|${wrap}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = canvasTex(w, h, (g) => paint(g, design, a, b, word, w, h));
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.offset.x = 0.5; }
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
function outlined(g, text, x, y, fill, strokes) {
  for (const [c, wdt] of strokes) { g.strokeStyle = c; g.lineWidth = wdt; g.lineJoin = 'round'; g.strokeText(text, x, y); }
  g.fillStyle = fill; g.fillText(text, x, y);
}
function paint(g, design, a, b, word, w, h) {
  const r = rng(word.length * 31 + w + h);
  const cx = w / 2, cy = h / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
  const vertical = (fn) => { g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 2); g.translate(-cy, -cx); fn(h, w); g.restore(); }; // 竖着的包装：字沿长边写
  switch (design) {
    case 'wave': { // 红罐 + 白色飘带 + 斜体大字
      fill(a);
      g.fillStyle = b; g.beginPath(); g.moveTo(0, h * 0.62); g.bezierCurveTo(w * 0.3, h * 0.48, w * 0.6, h * 0.8, w, h * 0.6); g.lineTo(w, h * 0.68); g.bezierCurveTo(w * 0.6, h * 0.9, w * 0.3, h * 0.56, 0, h * 0.7); g.fill();
      g.font = `italic 700 ${h * 0.24}px ${SERIF}`; g.fillStyle = b; g.fillText(word, cx, h * 0.4, w * 0.42);
      g.font = `600 ${h * 0.06}px ${FONT}`; g.fillText('ORIGINAL TASTE', cx, h * 0.86);
      break;
    }
    case 'roundel': { // 蓝罐 + 红白蓝圆标
      fill(a); const R = h * 0.2, y0 = h * 0.42;
      g.save(); g.beginPath(); g.arc(cx, y0, R, 0, 7); g.clip();
      g.fillStyle = b; g.fillRect(cx - R, y0 - R, 2 * R, R); g.fillStyle = '#0a2c78'; g.fillRect(cx - R, y0, 2 * R, R);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - R, y0 + R * 0.05); g.bezierCurveTo(cx - R * 0.3, y0 - R * 0.35, cx + R * 0.3, y0 + R * 0.35, cx + R, y0 - R * 0.05); g.lineTo(cx + R, y0 + R * 0.18); g.bezierCurveTo(cx + R * 0.3, y0 + R * 0.55, cx - R * 0.3, y0 - R * 0.1, cx - R, y0 + R * 0.28); g.fill();
      g.restore(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(cx, y0, R, 0, 7); g.stroke();
      g.font = `800 ${h * 0.12}px ${FONT}`; g.fillStyle = '#fff'; g.fillText(word, cx, h * 0.76);
      break;
    }
    case 'splash': { // 绿罐 + 黄绿水花 + 气泡
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0fa04a'); gr.addColorStop(1, a); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = b; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(cx + (r() - 0.5) * w * 0.22, h * 0.5 + (r() - 0.5) * h * 0.3, w * 0.04 + r() * w * 0.05, h * 0.06 + r() * h * 0.08, r() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 4, 0, 7); g.fill(); }
      g.font = `800 ${h * 0.13}px ${FONT}`; outlined(g, word, cx, h * 0.5, '#fff', [['#0a6a2a', 8]]);
      break;
    }
    case 'checker': { // 蓝银格子 + 红太阳
      const n = 4, sw = w / (n * 2), sh = h / 2;
      for (let i = 0; i < n * 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? a : '#c9ccd2'; g.fillRect(i * sw, j * sh, sw + 1, sh + 1); }
      g.fillStyle = '#f2d23a'; g.beginPath(); g.arc(cx, h * 0.42, h * 0.13, 0, 7); g.fill();
      g.fillStyle = b; g.beginPath(); g.arc(cx, h * 0.42, h * 0.11, 0, 7); g.fill();
      g.font = `900 ${h * 0.085}px ${FONT}`; outlined(g, word, cx, h * 0.68, b, [['#f2d23a', 6]]);
      break;
    }
    case 'claw': { // 黑罐 + 荧光绿爪痕
      fill(a); g.strokeStyle = b; g.lineCap = 'round'; g.shadowColor = b; g.shadowBlur = 10;
      for (let k = -1; k <= 1; k++) { g.lineWidth = w * 0.022; g.beginPath(); let x = cx + k * w * 0.05, y = h * 0.12; g.moveTo(x, y); for (let s = 0; s < 9; s++) { x += (r() - 0.5) * w * 0.02 + k * w * 0.004; y += h * 0.075; g.lineTo(x, y); } g.stroke(); }
      g.shadowBlur = 0; g.font = `900 ${h * 0.07}px ${FONT}`; g.fillStyle = b; g.fillText(word, cx, h * 0.92);
      break;
    }
    case 'oval': { // 绿底 + 白椭圆
      fill(a); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, w * 0.16, h * 0.32, 0, 0, 7); g.fill();
      g.strokeStyle = '#c8262c'; g.lineWidth = 5; g.stroke();
      g.font = `800 ${h * 0.2}px ${SERIF}`; g.fillStyle = a; g.fillText(word, cx, cy, w * 0.26);
      g.fillStyle = '#c8262c'; g.beginPath(); g.arc(cx, cy - h * 0.2, h * 0.04, 0, 7); g.fill();
      break;
    }
    case 'beach': { // 透明瓶上直接印：蓝字金拱
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#d9a83a'; g.lineWidth = 6; g.beginPath(); g.arc(cx, h * 0.9, h * 0.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.font = `italic 800 ${h * 0.26}px ${SERIF}`; outlined(g, word, cx, h * 0.55, b, [['#fff', 6]]);
      g.font = `700 ${h * 0.1}px ${FONT}`; g.fillStyle = '#d9a83a'; g.fillText('EXTRA', cx, h * 0.82);
      break;
    }
    case 'dry': { // 银罐 + 黑色大字斜带
      const gr = g.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, i % 2 ? '#e8eaee' : a); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.save(); g.translate(cx, cy); g.transform(1, 0, -0.25, 1, 0, 0); g.fillStyle = b; g.font = `900 ${h * 0.3}px ${FONT}`; g.fillText(word, 0, -h * 0.02); g.restore();
      g.fillStyle = '#c8262c'; g.fillRect(cx - w * 0.12, h * 0.68, w * 0.24, h * 0.025);
      g.font = `700 ${h * 0.07}px ${FONT}`; g.fillStyle = b; g.fillText('辛口 · 生', cx, h * 0.8);
      break;
    }
    case 'stout': { // 黑罐 + 奶油金
      fill(a); g.fillStyle = b; g.fillRect(0, h * 0.18, w, h * 0.04); g.fillRect(0, h * 0.78, w, h * 0.04);
      g.font = `700 ${h * 0.18}px ${SERIF}`; g.fillStyle = b; g.fillText(word, cx, cy, w * 0.4);
      g.font = `500 ${h * 0.06}px ${SERIF}`; g.fillText('IRISH · DRAUGHT', cx, h * 0.66);
      break;
    }
    case 'blacklabel': { // 方瓶黑标：白色花边
      fill(b); g.strokeStyle = '#eee'; g.lineWidth = 3; g.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88); g.lineWidth = 1; g.strokeRect(w * 0.12, h * 0.1, w * 0.76, h * 0.8);
      g.fillStyle = '#eee'; g.font = `700 ${h * 0.1}px ${SERIF}`; g.fillText(word, cx, h * 0.36, w * 0.72);
      g.font = `500 ${h * 0.055}px ${SERIF}`; g.fillText('TENNESSEE', cx, h * 0.52); g.fillText('SOUR MASH', cx, h * 0.62);
      g.font = `italic 500 ${h * 0.05}px ${SERIF}`; g.fillText('since long ago', cx, h * 0.78);
      break;
    }
    case 'tea': { fill('#f4f6ee'); g.fillStyle = a; g.fillRect(0, 0, w, h * 0.16); g.fillRect(0, h * 0.84, w, h * 0.16);
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(47,138,74,${0.3 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * w, h * (0.25 + r() * 0.5), w * 0.03, h * 0.08, r() * 3, 0, 7); g.fill(); }
      g.font = `800 ${h * 0.3}px ${SERIF}`; g.fillStyle = a; g.fillText(word, cx, cy); break; }
    case 'ion': { fill('#fff'); g.fillStyle = b; g.beginPath(); g.moveTo(0, h * 0.55); g.bezierCurveTo(w * 0.3, h * 0.4, w * 0.6, h * 0.7, w, h * 0.5); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.font = `900 ${h * 0.24}px ${FONT}`; g.fillStyle = b; g.fillText(word, cx, h * 0.3); g.font = `700 ${h * 0.08}px ${FONT}`; g.fillStyle = '#fff'; g.fillText('ION WATER', cx, h * 0.78); break; }
    case 'alps': { fill('#f8fbfd'); g.fillStyle = '#9cc8e8'; g.beginPath(); g.moveTo(w * 0.3, h * 0.7); g.lineTo(w * 0.45, h * 0.35); g.lineTo(w * 0.52, h * 0.48); g.lineTo(w * 0.6, h * 0.3); g.lineTo(w * 0.72, h * 0.7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * 0.42, h * 0.42); g.lineTo(w * 0.45, h * 0.35); g.lineTo(w * 0.48, h * 0.42); g.fill();
      g.font = `700 ${h * 0.15}px ${SERIF}`; g.fillStyle = b; g.fillText(word, cx, h * 0.84); break; }
    case 'sunny': { // 黄袋 + 红飘带 + 圆标
      fill(a);
      g.fillStyle = '#ffe15a'; g.beginPath(); g.arc(cx, h * 0.38, w * 0.33, 0, 7); g.fill();
      g.fillStyle = b; g.beginPath(); g.moveTo(-10, h * 0.42); g.bezierCurveTo(w * 0.3, h * 0.34, w * 0.7, h * 0.5, w + 10, h * 0.4); g.lineTo(w + 10, h * 0.55); g.bezierCurveTo(w * 0.7, h * 0.65, w * 0.3, h * 0.49, -10, h * 0.57); g.fill();
      g.font = `900 ${w * 0.2}px ${FONT}`; outlined(g, word, cx, h * 0.49, '#fff', [['#a01418', 6]]);
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgb(250,${205 + r() * 30 | 0},${100 + r() * 40 | 0})`; g.beginPath(); g.ellipse(w * (0.22 + i * 0.14), h * (0.78 + (r() - 0.5) * 0.06), w * 0.09, w * 0.06, r() * 3, 0, 7); g.fill(); g.strokeStyle = 'rgba(180,120,40,.4)'; g.lineWidth = 1.5; g.stroke(); }
      g.font = `700 ${w * 0.07}px ${FONT}`; g.fillStyle = b; g.fillText('CLASSIC · 70g', cx, h * 0.92);
      break;
    }
    case 'tri': { // 黑袋 + 三角片
      fill(a); g.fillStyle = b; g.beginPath(); g.moveTo(0, h * 0.1); g.lineTo(w, 0); g.lineTo(w, h * 0.22); g.lineTo(0, h * 0.3); g.fill();
      for (let i = 0; i < 6; i++) { const x = w * (0.2 + r() * 0.6), y = h * (0.6 + r() * 0.3), s = w * 0.12; g.save(); g.translate(x, y); g.rotate(r() * 6); g.fillStyle = '#f29a2a'; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.9, s * 0.6); g.lineTo(-s * 0.9, s * 0.6); g.fill(); g.fillStyle = 'rgba(200,60,20,.5)'; for (let k = 0; k < 8; k++) g.fillRect((r() - 0.5) * s, (r() - 0.3) * s, 2, 2); g.restore(); }
      g.font = `italic 900 ${w * 0.26}px ${FONT}`; outlined(g, word, cx, h * 0.42, '#fff', [['#c8262c', 8]]);
      break;
    }
    case 'puffs': { // 橙袋 + 芝士条
      fill(a); g.fillStyle = b; for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx, h * 0.38); g.lineTo(cx + Math.cos(t) * w * 0.5, h * 0.38 + Math.sin(t) * w * 0.5); g.lineTo(cx + Math.cos(t + 0.2) * w * 0.5, h * 0.38 + Math.sin(t + 0.2) * w * 0.5); g.fill(); }
      g.strokeStyle = '#e8601a'; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { g.lineWidth = w * 0.06; g.beginPath(); const x = w * (0.2 + r() * 0.6), y = h * (0.66 + r() * 0.22); g.moveTo(x, y); g.quadraticCurveTo(x + w * 0.08, y - h * 0.05, x + w * 0.14, y + h * 0.02); g.stroke(); }
      g.font = `900 ${w * 0.22}px ${FONT}`; outlined(g, word, cx, h * 0.38, '#ffe14a', [['#6a2a10', 8]]);
      break;
    }
    case 'nutbar': vertical((W, H) => { // 棕色包装 + 蓝字白边红框
      g.fillStyle = a; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, H * 0.1, W, H * 0.06);
      g.font = `900 ${H * 0.42}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; outlined(g, word, W / 2, H / 2, b, [['#c8262c', 16], ['#fff', 8]]);
    }); break;
    case 'wafer': vertical((W, H) => { // 红包装 + 白椭圆
      g.fillStyle = a; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.24, H * 0.36, 0, 0, 7); g.fill();
      g.font = `italic 900 ${H * 0.34}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = a; g.fillText(word, W / 2, H / 2, W * 0.4);
    }); break;
    case 'dots': { // 黄袋 + 彩色巧克力豆
      fill(a); g.fillStyle = b; g.fillRect(0, h * 0.72, w, h * 0.28);
      const cols = ['#d6202a', '#1d6fd8', '#22a24a', '#f2781c', '#5a3020', '#ffd21f'];
      for (let i = 0; i < 14; i++) { g.fillStyle = cols[i % 6]; g.beginPath(); g.ellipse(w * (0.12 + r() * 0.76), h * (0.55 + r() * 0.35), w * 0.07, w * 0.055, r() * 3, 0, 7); g.fill(); }
      g.fillStyle = b; g.beginPath(); g.ellipse(cx, h * 0.3, w * 0.34, h * 0.13, 0, 0, 7); g.fill();
      g.font = `900 ${w * 0.24}px ${FONT}`; g.fillStyle = '#fff'; g.fillText(word, cx, h * 0.3);
      break;
    }
    case 'sandwich': vertical((W, H) => { // 蓝色长条装 + 黑色夹心饼干
      g.fillStyle = a; g.fillRect(0, 0, W, H);
      const R = H * 0.34, x0 = W * 0.7;
      g.fillStyle = '#1a1414'; g.beginPath(); g.arc(x0, H * 0.5, R, 0, 7); g.fill();
      g.strokeStyle = '#3a302c'; g.lineWidth = 3; g.beginPath(); g.arc(x0, H * 0.5, R * 0.8, 0, 7); g.stroke(); for (let k = 0; k < 16; k++) { const t = k / 16 * Math.PI * 2; g.beginPath(); g.arc(x0 + Math.cos(t) * R * 0.9, H * 0.5 + Math.sin(t) * R * 0.9, 3, 0, 7); g.stroke(); }
      g.fillStyle = '#f8f6f0'; g.fillRect(x0 - R * 1.4, H * 0.82, R * 1.2, H * 0.06);
      g.font = `900 ${H * 0.3}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = b; g.fillText(word, W * 0.32, H * 0.5, W * 0.4);
    }); break;
    case 'pocky': { // 红盒 + 斜着的巧克力细棒
      fill(a); g.save(); g.translate(cx, h * 0.62); g.rotate(-0.5);
      for (let i = 0; i < 4; i++) { const y = (i - 1.5) * w * 0.1; g.fillStyle = '#e8c890'; g.fillRect(-w * 0.6, y - 4, w * 0.25, 8); g.fillStyle = '#4a2418'; g.fillRect(-w * 0.35, y - 5, w * 1.0, 10); }
      g.restore(); g.font = `italic 900 ${w * 0.3}px ${FONT}`; g.fillStyle = b; g.fillText(word, cx, h * 0.24);
      break;
    }
    case 'alpine': { // 三棱柱：金黄底 + 雪山 + 红字
      fill(a); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w * 0.15, h * 0.75); g.lineTo(w * 0.3, h * 0.3); g.lineTo(w * 0.45, h * 0.75); g.fill();
      g.font = `900 ${h * 0.34}px ${SERIF}`; g.fillStyle = b; g.fillText(word, w * 0.62, cy, w * 0.6);
      break;
    }
    case 'gummy': { // 金黄袋 + 小熊
      fill(a); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(cx, h * 0.65, w * 0.4, 0, 7); g.fill();
      const cols = ['#d6202a', '#22a24a', '#f2781c', '#ffe14a', '#f6f0e0'];
      for (let i = 0; i < 7; i++) { const x = w * (0.18 + r() * 0.64), y = h * (0.52 + r() * 0.36), s = w * 0.07; g.fillStyle = cols[i % 5]; g.beginPath(); g.arc(x, y - s * 1.2, s * 0.7, 0, 7); g.arc(x - s * 0.5, y - s * 1.8, s * 0.3, 0, 7); g.arc(x + s * 0.5, y - s * 1.8, s * 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y, s * 0.85, s, 0, 0, 7); g.fill(); }
      g.font = `900 ${w * 0.22}px ${FONT}`; outlined(g, word, cx, h * 0.22, b, [['#fff', 8]]);
      break;
    }
    case 'mint': { for (let x = 0; x < w; x += w / 10) { g.fillStyle = Math.round(x / (w / 10)) % 2 ? a : '#fff'; g.fillRect(x, 0, w / 10 + 1, h); }
      g.fillStyle = a; g.fillRect(0, h * 0.3, w, h * 0.4); g.font = `900 ${h * 0.3}px ${FONT}`; g.fillStyle = '#fff'; for (const x of [w * 0.25, w * 0.75]) g.fillText(word, x, cy); break; }
    case 'tube': { // 红色长筒 + 一片薯片
      fill(a); g.fillStyle = b; g.beginPath(); g.ellipse(cx, h * 0.62, w * 0.12, h * 0.1, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(180,120,30,.5)'; g.lineWidth = 2; g.stroke();
      g.font = `900 ${h * 0.12}px ${FONT}`; outlined(g, word, cx, h * 0.3, '#fff', [['#6a1010', 6]]);
      g.font = `700 ${h * 0.04}px ${FONT}`; g.fillStyle = '#fff'; g.fillText('ORIGINAL', cx, h * 0.84);
      break;
    }
    case 'cupband': { // 白杯 + 上红带 + 金线
      fill(a); g.fillStyle = b; g.fillRect(0, 0, w, h * 0.42); g.fillStyle = '#d9a83a'; g.fillRect(0, h * 0.42, w, h * 0.03); g.fillRect(0, h * 0.88, w, h * 0.02);
      g.font = `900 ${h * 0.2}px ${FONT}`; g.fillStyle = '#fff'; for (const x of [w * 0.25, w * 0.75]) g.fillText(word, x, h * 0.22, w * 0.42);
      g.font = `700 ${h * 0.09}px ${FONT}`; g.fillStyle = b; for (const x of [w * 0.25, w * 0.75]) g.fillText('· 原味 ·', x, h * 0.66);
      break;
    }
    case 'fire': { // 红杯 + 黑色大字
      fill(a); g.fillStyle = 'rgba(255,200,60,.35)'; for (let i = 0; i < 10; i++) { const x = r() * w; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 20, h * 0.6, x + 8, h * 0.45); g.quadraticCurveTo(x - 10, h * 0.7, x - 14, h); g.fill(); }
      g.font = `900 ${h * 0.5}px ${SERIF}`; g.fillStyle = b; for (const x of [w * 0.25, w * 0.75]) g.fillText(word, x, h * 0.44);
      break;
    }
    case 'lid': { // 杯面盖子
      fill(a === '#d8262c' ? '#d8262c' : '#f6f2e8');
      g.fillStyle = b; g.beginPath(); g.arc(cx, cy, w * 0.3, 0, 7); g.fill();
      g.font = `900 ${w * 0.16}px ${FONT}`; g.fillStyle = '#fff'; g.fillText(word.slice(0, 4), cx, cy);
      g.fillStyle = '#e8e2d0'; g.beginPath(); g.moveTo(w * 0.9, h * 0.44); g.lineTo(w, h * 0.38); g.lineTo(w, h * 0.62); g.lineTo(w * 0.9, h * 0.56); g.fill();
      break;
    }
    case 'noodles': { fill('#e8c06a'); g.strokeStyle = 'rgba(150,100,30,.55)'; g.lineWidth = 2;
      for (let i = 0; i < 60; i++) { g.beginPath(); const y = r() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.12 + i) * 6); g.stroke(); }
      for (let i = 0; i < 14; i++) { g.fillStyle = ['#3a8a3a', '#d23a2a', '#f4d06a', '#8a5a3a'][i % 4]; g.fillRect(r() * w, r() * h, 8, 6); } break; }
    case 'crimp': { fill(a); for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 1.5, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, 0, 1, h); } break; }
    default: { // band / box：通用
      fill(a); g.fillStyle = b; g.fillRect(0, h * 0.36, w, h * 0.3);
      g.font = `900 ${h * 0.18}px ${FONT}`; g.fillStyle = a; for (const x of design === 'box' ? [cx] : [w * 0.25, w * 0.75]) g.fillText(word, x, h * 0.51, w * (design === 'box' ? 0.85 : 0.4));
    }
  }
}

const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const metal = new THREE.MeshStandardMaterial({ color: '#d4d7dc', metalness: 1, roughness: 0.22 });
const metalDark = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.35 });
const film = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, transmission: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
const fromBottom = (geo) => { geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0); return geo; };
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);
// 易拉罐拉环：圆角矩形环（有孔）
function tabRing(s) {
  const sh = new THREE.Shape(); const rr = (x, y, w, h, r, p) => { p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); };
  rr(-s * 0.32, -s * 0.2, s * 0.64, s * 0.9, s * 0.25, sh);
  const hole = new THREE.Path(); rr(-s * 0.2, s * 0.22, s * 0.4, s * 0.34, s * 0.16, hole); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.0006, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); return geo;
}
// 枕头袋：中间鼓、上下封口扁，表面一点皱
function pillow(w, h, d, seed) {
  const geo = new THREE.BoxGeometry(w, h, d, 14, 18, 2); const p = geo.attributes.position, rr = rng(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2);
    const k = (1 - y ** 4) * (1 - 0.38 * x * x);
    p.setZ(i, p.getZ(i) * k + (rr() - 0.5) * 0.0012 * k);
    p.setX(i, p.getX(i) * (1 - 0.03 * (1 - y * y)));
  }
  geo.computeVertexNormals(); return geo;
}

export function makeItem(id) {
  const it = ITEM[id] || ITEM.cola;
  const [shape, a, b, word, design = 'band'] = it.look || ['can', '#888', '#fff', '?'];
  const g = new THREE.Group();
  const add = (geo, mat, y = 0, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; parent.add(m); return m; };
  let height = 0.12, width = 0.07;
  let setOpen = () => {}, setEaten = () => {};
  // 包装图：目录饮料用 Gemini 画的，内置的照旧现场画
  const lab = (w, h, wrap, aa = a, bb = b) => (it.catalog ? labelTex(it, wrap ? 'wrap' : 'face') : art(design, aa, bb, word, w, h, wrap));
  // 零食：目录零食贴 Gemini 画的正面图（front 整张贴一面，front3 绕圆筒），内置的照旧现场画
  const snackArt = (w, h, wrap = false) => (it.catDir === 'snack' ? labelTex(it, wrap ? 'front3' : 'front') : art(design, a, b, word, w, h, wrap));

  if (shape === 'can' || shape === 'tallcan' || shape === 'slimcan' || shape === 'scan') {
    const [r, h] = { can: [0.033, 0.122], tallcan: [0.033, 0.168], slimcan: [0.0265, 0.155], scan: [0.026, 0.1] }[shape];
    height = h; width = r * 2.1;
    // 罐底（往里凹的穹顶 + 圈脚）、罐身（标签）、肩和口沿（金属）
    add(lathe([[0, 0.006], [r * 0.55, 0.003], [r * 0.72, 0], [r * 0.82, 0.001], [r * 0.95, 0.006], [r, 0.014]]), metal);
    add(new THREE.CylinderGeometry(r, r, h - 0.03, 48, 1, true), new THREE.MeshStandardMaterial({ map: lab(512, 256, true), metalness: 0.65, roughness: 0.28 }), 0.014 + (h - 0.03) / 2);
    add(lathe([[r, h - 0.016], [r * 0.97, h - 0.011], [r * 0.86, h - 0.004], [r * 0.85, h - 0.001], [r * 0.87, h], [r * 0.84, h], [r * 0.8, h - 0.003]]), metal);
    const lid = add(new THREE.CircleGeometry(r * 0.8, 40), metalDark, h - 0.003); lid.rotation.x = -Math.PI / 2;
    const score = add(new THREE.RingGeometry(r * 0.2, r * 0.23, 24), new THREE.MeshStandardMaterial({ color: '#7a8088', metalness: 1, roughness: 0.4 }), h - 0.0027); score.rotation.x = -Math.PI / 2; score.position.z = r * 0.38; score.scale.set(1.3, 1, 1);
    const hole = add(new THREE.CircleGeometry(r * 0.21, 24), solid('#0e0c0a', { roughness: 0.9 }), h - 0.0025); hole.rotation.x = -Math.PI / 2; hole.position.z = r * 0.38; hole.scale.set(1.3, 0.9, 1); hole.visible = false;
    add(new THREE.CylinderGeometry(r * 0.06, r * 0.06, 0.001, 12), metal, h - 0.0025); // 铆钉
    const pivot = new THREE.Group(); pivot.position.set(0, h - 0.0022, 0); g.add(pivot);
    const tab = add(tabRing(r * 0.75), metal, 0, pivot); tab.position.z = -r * 0.06;
    setOpen = (p) => { pivot.rotation.x = -Math.sin(Math.min(1, p) * Math.PI) * 1.25; hole.visible = p > 0.45; score.visible = p <= 0.45; };
  } else if (shape === 'longneck' || shape === 'bottle' || shape === 'pet' || shape === 'square') {
    const isPet = shape === 'pet', clear = design === 'beach';
    const pts = {
      longneck: [[0, 0.002], [0.026, 0], [0.03, 0.004], [0.031, 0.012], [0.031, 0.118], [0.028, 0.137], [0.016, 0.172], [0.0125, 0.208], [0.0138, 0.214], [0.0138, 0.222], [0, 0.222]],
      bottle: [[0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.13], [0.03, 0.16], [0.013, 0.19], [0.012, 0.215], [0, 0.215]],
      pet: [[0, 0.004], [0.026, 0], [0.032, 0.008], [0.033, 0.02], [0.033, 0.06], [0.03, 0.068], [0.033, 0.076], [0.033, 0.084], [0.03, 0.092], [0.033, 0.1], [0.033, 0.15], [0.026, 0.178], [0.014, 0.196], [0.013, 0.212], [0, 0.212]],
      square: [[0, 0.15], [0.016, 0.15], [0.014, 0.16], [0.013, 0.19], [0, 0.19]],
    }[shape];
    height = pts[pts.length - 1][1]; width = shape === 'square' ? 0.085 : 0.072;
    const glass = new THREE.MeshPhysicalMaterial({ color: isPet ? '#eef6fa' : clear ? '#f4f2e8' : a, roughness: 0.04, transmission: isPet || clear ? 0.9 : 0.55, thickness: 0.006, ior: 1.5, transparent: true, opacity: isPet ? 0.45 : clear ? 0.35 : 0.9 });
    if (shape === 'square') { // 方瓶：圆角方身 + 圆肩 + 细颈
      add(fromBottom(new RoundedBoxGeometry(0.072, 0.15, 0.072, 3, 0.008)), glass);
      add(fromBottom(new RoundedBoxGeometry(0.066, 0.13, 0.066, 2, 0.006)), solid('#8a4a16', { roughness: 0.2, transparent: true, opacity: 0.85 }), 0.006);
      add(lathe(pts), glass);
      const lab = add(new THREE.PlaneGeometry(0.06, 0.07), new THREE.MeshStandardMaterial({ map: art(design, a, b, word, 256, 300), roughness: 0.6 }), 0.07); lab.position.z = 0.0365;
    } else {
      add(lathe(pts), glass);
      if (isPet || clear) add(lathe(pts.slice(0, clear ? 5 : 11).map(([x, y]) => [x * 0.93, y]).concat([[0, clear ? 0.112 : 0.145]])), new THREE.MeshPhysicalMaterial({ color: clear ? '#f2c24a' : a, roughness: 0.1, transparent: true, opacity: clear ? 0.75 : 0.5 }));
      // 目录饮料的包装图是 2:1，标签加高一点，免得被横向拉扁
      const [ly, lh, lr] = (it.catalog ? { longneck: [0.065, 0.085, 0.0312], bottle: [0.07, 0.09, 0.0365], pet: [0.125, 0.07, 0.0335] } : { longneck: [0.07, 0.06, 0.0312], bottle: [0.07, 0.05, 0.0365], pet: [0.125, 0.05, 0.0335] })[shape];
      const labM = new THREE.MeshStandardMaterial({ map: lab(512, 256, true), roughness: 0.55, transparent: clear, alphaTest: clear ? 0.05 : 0 });
      add(new THREE.CylinderGeometry(lr, lr, lh, 48, 1, true), labM, ly);
      if (shape === 'longneck') add(new THREE.CylinderGeometry(0.0145, 0.0165, 0.02, 32, 1, true), new THREE.MeshStandardMaterial({ color: clear ? b : '#ffffff', roughness: 0.5 }), 0.185);
    }
    const capColor = shape === 'longneck' ? (clear ? '#e8e8e8' : '#c8262c') : isPet ? b : shape === 'square' ? '#111' : '#2a6a3a';
    const cap = add(new THREE.CylinderGeometry(shape === 'longneck' ? 0.0148 : 0.0138, 0.0148, shape === 'square' ? 0.03 : 0.012, shape === 'longneck' ? 21 : 24), solid(capColor, { roughness: 0.35, metalness: shape === 'longneck' ? 0.8 : 0.2 }), height + (shape === 'square' ? 0.01 : 0.002));
    const lime = clear ? add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16, 1, false, 0, Math.PI), solid('#8ac83a', { roughness: 0.5 }), height + 0.004) : null;
    if (lime) { lime.rotation.z = Math.PI / 2; lime.visible = false; }
    const capY = cap.position.y;
    setOpen = (p) => { cap.visible = p < 0.98; cap.rotation.y = shape === 'longneck' ? 0 : p * Math.PI * 4; cap.position.y = capY + Math.max(0, p - (shape === 'longneck' ? 0.4 : 0.6)) * 0.06; if (lime) lime.visible = p >= 0.98; };
  } else if (shape === 'cup') {
    height = 0.1; width = 0.078;
    add(lathe([[0, 0], [0.032, 0], [0.036, 0.098], [0.037, 0.1], [0.0345, 0.1], [0.0315, 0.004], [0, 0.004]]), new THREE.MeshPhysicalMaterial({ color: '#f6f2e0', roughness: 0.08, transmission: 0.5, transparent: true, opacity: 0.85 }));
    add(new THREE.CylinderGeometry(0.0362, 0.0335, 0.04, 40, 1, true), new THREE.MeshStandardMaterial({ map: lab(512, 256, true, b, a), roughness: 0.5 }), 0.05);
    add(new THREE.CircleGeometry(0.034, 32), solid('#e8e0c8', { roughness: 0.15 }), 0.09).rotation.x = -Math.PI / 2;
    const hinge = new THREE.Group(); hinge.position.set(0, 0.1, -0.037); g.add(hinge);
    const lid = add(new THREE.CylinderGeometry(0.037, 0.037, 0.0015, 40), new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 0.9, roughness: 0.3 }), 0, hinge); lid.position.z = 0.037;
    setOpen = (p) => { hinge.rotation.x = -p * 2.4; hinge.visible = p < 0.98; };
  } else if (shape === 'carton') {
    height = 0.13; width = 0.066;
    add(new THREE.BoxGeometry(0.06, 0.1, 0.06), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ map: i === 4 || i === 5 || i < 2 ? (it.catalog ? labelTex(it, 'face') : art('box', a, b, word, 256, 256)) : null, color: i === 2 ? b : '#ffffff', roughness: 0.7 })), 0.05);
    const roof = new THREE.CylinderGeometry(0.0425, 0.0425, 0.06, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 6);
    add(roof, solid(a, { roughness: 0.7 }), 0.11).scale.set(1, 0.7, 1);
    add(new THREE.BoxGeometry(0.06, 0.012, 0.004), solid(a, { roughness: 0.7 }), 0.132);
  } else if (shape === 'bag' || shape === 'pouch') {
    const [w, h, d] = shape === 'bag' ? [0.15, 0.21, 0.055] : [0.12, 0.16, 0.035];
    height = h; width = w + 0.01;
    const shiny = shape === 'bag';
    add(pillow(w, h * 0.9, d, word.length || it.id.length), new THREE.MeshStandardMaterial({ map: snackArt(256, 340), metalness: shiny ? 0.3 : 0.05, roughness: shiny ? 0.4 : 0.75 }), h * 0.5);
    const crimpM = new THREE.MeshStandardMaterial({ map: art('crimp', a, b, '', 256, 32), metalness: shiny ? 0.3 : 0.05, roughness: 0.45 });
    add(new THREE.BoxGeometry(w, h * 0.06, 0.003), crimpM, h * 0.03);
    // 上封口分成左右两半：撕的时候右半边被扯走
    const sealL = add(new THREE.BoxGeometry(w * 0.5, h * 0.06, 0.003), crimpM, h * 0.97); sealL.position.x = -w * 0.25;
    const sealR = add(new THREE.BoxGeometry(w * 0.5, h * 0.06, 0.003), crimpM, h * 0.97); sealR.position.x = w * 0.25;
    const inside = add(new THREE.CircleGeometry(1, 28), solid('#bfc2c6', { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }), h * 0.93); inside.rotation.x = -Math.PI / 2; inside.scale.set(w * 0.44, d * 0.42, 1); inside.visible = false;
    const sy = sealR.position.y;
    setOpen = (q) => { sealR.visible = q < 0.97; sealR.position.set(w * 0.25 + q * w * 0.4, sy + q * 0.035, 0); sealR.rotation.z = q * 0.9; sealL.rotation.z = -q * 0.25; sealL.position.x = -w * 0.25 - q * 0.006; inside.visible = q >= 0.5; };
  } else if (shape === 'tube') {
    height = 0.235; width = 0.08;
    add(new THREE.CylinderGeometry(0.037, 0.037, 0.215, 48, 1, true), new THREE.MeshStandardMaterial({ map: snackArt(512, 400, true), roughness: 0.45 }), 0.1125);
    add(lathe([[0, 0], [0.034, 0], [0.0375, 0.003], [0.0375, 0.005]]), metal);
    const foil = add(new THREE.CircleGeometry(0.036, 40), metal, 0.2205); foil.rotation.x = -Math.PI / 2;
    const chips = add(new THREE.CircleGeometry(0.033, 32), solid('#f2c45a', { roughness: 0.7 }), 0.212); chips.rotation.x = -Math.PI / 2; chips.visible = false;
    const lid = add(lathe([[0, 0.235], [0.036, 0.235], [0.039, 0.232], [0.039, 0.22], [0.0375, 0.22], [0.0375, 0.231], [0, 0.231]]), new THREE.MeshPhysicalMaterial({ color: a, roughness: 0.3, transmission: 0.3, transparent: true, opacity: 0.85 }));
    setOpen = (p) => { lid.visible = p < 0.35; lid.position.y = p * 0.06; foil.visible = p < 0.85; foil.rotation.x = -Math.PI / 2 - Math.max(0, p - 0.35) * 2.6; foil.position.z = -Math.max(0, p - 0.35) * 0.03; chips.visible = p > 0.5; };
    setEaten = (e) => { chips.position.y = 0.212 - e * 0.15; };
  } else if (shape === 'bar') {
    height = 0.14; width = 0.058;
    const W = 0.05, T = 0.013, body = 0.112;
    const chocM = solid(design === 'nutbar' ? '#4a2614' : '#5a3020', { roughness: 0.45 });
    const choc = new THREE.Group(); g.add(choc); choc.position.y = 0.014;
    if (design === 'wafer') for (const x of [-0.011, 0.011]) add(fromBottom(new RoundedBoxGeometry(0.02, 0.108, 0.01, 2, 0.003)), chocM, 0, choc).position.x = x; // 两条
    else { const nut = add(fromBottom(new RoundedBoxGeometry(0.044, 0.108, 0.011, 2, 0.004)), chocM, 0, choc); const p = nut.geometry.attributes.position, rr = rng(7); for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0.004) p.setZ(i, p.getZ(i) + rr() * 0.0012); nut.geometry.computeVertexNormals(); }
    const labelArt = snackArt(256, 512);
    const wrapLow = add(fromBottom(new RoundedBoxGeometry(W, body * 0.62, T, 2, 0.004)), new THREE.MeshStandardMaterial({ map: labelArt, roughness: 0.35, metalness: 0.25 }), 0.014);
    { const uv = wrapLow.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.62); }  // 下半截只用标签的下 62%
    const wrapTop = add(fromBottom(new RoundedBoxGeometry(W, body * 0.38, T, 2, 0.004)), new THREE.MeshStandardMaterial({ map: labelArt, roughness: 0.35, metalness: 0.25 }), 0.014 + body * 0.62);
    { const uv = wrapTop.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.62 + uv.getY(i) * 0.38); }
    const crimpM = new THREE.MeshStandardMaterial({ map: art('crimp', a, b, '', 128, 32), roughness: 0.4, metalness: 0.3 });
    add(new THREE.BoxGeometry(W * 1.05, 0.014, 0.003), crimpM, 0.007); // 下端封口
    const finTop = add(new THREE.BoxGeometry(W * 1.05, 0.014, 0.003), crimpM, 0.014 + body + 0.007);
    const topY = wrapTop.position.y, finY = finTop.position.y;
    setOpen = (p) => { const k = Math.min(1, p * 1.6); finTop.visible = wrapTop.visible = p < 0.6; wrapTop.position.set(k * 0.03, topY + k * 0.01, 0); finTop.position.set(k * 0.03, finY + k * 0.01, 0); wrapTop.rotation.z = finTop.rotation.z = -k * 0.7; };
    setEaten = (e) => { choc.scale.y = 1 - e * 0.5; };
  } else if (shape === 'box' || shape === 'sleeve') {
    const [w, h, d] = shape === 'box' ? [0.07, 0.15, 0.016] : [0.056, 0.17, 0.05];
    height = h; width = w + 0.008;
    add(new THREE.BoxGeometry(w, h, d), [0, 1, 2, 3, 4, 5].map((i) => new THREE.MeshStandardMaterial({ map: i >= 4 ? snackArt(256, Math.round(256 * h / w)) : null, color: i >= 4 ? '#ffffff' : a, roughness: 0.5 })), h / 2);
    const inside = new THREE.Group(); inside.position.y = h - 0.003; g.add(inside); inside.visible = false;
    if (design === 'pocky') for (let i = 0; i < 9; i++) { const s = add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.02, 8), solid(i % 2 ? '#4a2418' : '#e8c890'), 0.004, inside); s.position.x = (i - 4) * 0.006; }
    else for (let i = 0; i < 3; i++) { const c = add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), solid('#1a1414', { roughness: 0.8 }), -0.006, inside); c.rotation.x = Math.PI / 2; c.position.z = (i - 1) * 0.014; }
    const hinge = new THREE.Group(); hinge.position.set(0, h, -d / 2); g.add(hinge);
    add(new THREE.BoxGeometry(w, 0.0015, d), solid(a, { roughness: 0.5 }), 0, hinge).position.z = d / 2;
    setOpen = (p) => { hinge.rotation.x = -p * 1.9; inside.visible = p > 0.3; };
  } else if (shape === 'prism') {
    height = 0.21; width = 0.06;
    const R = 0.03;
    add(new THREE.CylinderGeometry(R, R, 0.2, 3, 1, true), new THREE.MeshStandardMaterial({ map: art(design, a, b, word, 512, 128, true), roughness: 0.45, side: THREE.DoubleSide }), 0.1);
    add(new THREE.CircleGeometry(R, 3), solid(a), 0.0005).rotation.x = Math.PI / 2;
    const choc = add(fromBottom(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.196, 3)), solid('#5a3020', { roughness: 0.4 }), 0.002);
    const cap = add(new THREE.CircleGeometry(R, 3), solid(a), 0.2); cap.rotation.x = -Math.PI / 2;
    setOpen = (p) => { cap.visible = p < 0.5; cap.rotation.x = -Math.PI / 2 + p * 1.4; };
    setEaten = (e) => { choc.scale.y = 1 - e * 0.6; };
  } else if (shape === 'roll') {
    height = 0.078; width = 0.025;
    add(new THREE.CylinderGeometry(0.0105, 0.0105, 0.075, 32, 1, true), new THREE.MeshStandardMaterial({ map: snackArt(256, 128, true), roughness: 0.4 }), 0.0375);
    add(new THREE.CircleGeometry(0.0105, 24), metal, 0.0002).rotation.x = Math.PI / 2;
    const top = add(new THREE.CircleGeometry(0.0105, 24), metal, 0.0752); top.rotation.x = -Math.PI / 2;
    const mint = add(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 24), solid('#f6f6f2', { roughness: 0.5 }), 0.073); mint.visible = false;
    setOpen = (p) => { top.visible = p < 0.5; mint.visible = p >= 0.5; };
  } else if (shape === 'gum') {
    height = 0.08; width = 0.04;
    add(new THREE.BoxGeometry(0.03, 0.08, 0.013), new THREE.MeshStandardMaterial({ map: art('box', a, b, word, 128, 320), roughness: 0.4, metalness: 0.2 }), 0.04);
  } else if (shape === 'onigiri' || shape === 'sandwich') {
    const s = shape === 'sandwich';
    height = s ? 0.12 : 0.1; width = s ? 0.13 : 0.12;
    const food = new THREE.Group(); g.add(food);
    const tri = (r, d) => { const geo = new THREE.CylinderGeometry(r, r, d, 3, 1); geo.rotateX(Math.PI / 2); geo.rotateZ(Math.PI / 2); return fromBottom(geo); };
    if (s) {
      add(tri(0.07, 0.022), solid('#f4e6c4', { roughness: 0.9 }), 0, food).position.z = 0.02;
      add(tri(0.07, 0.022), solid('#f4e6c4', { roughness: 0.9 }), 0, food).position.z = -0.02;
      add(tri(0.066, 0.018), solid(b, { roughness: 0.75 }), 0.002, food);
    } else {
      add(tri(0.055, 0.035), solid('#f8f8f4', { roughness: 0.95 }), 0, food).scale.set(1, 1.1, 1);
      add(new THREE.BoxGeometry(0.05, 0.042, 0.037), solid(b, { roughness: 0.6 }), 0.021, food);
    }
    const wrap = add(tri(s ? 0.076 : 0.06, s ? 0.068 : 0.04), film, -0.002); wrap.scale.set(1.03, 1.05, 1.03);
    const tab = add(new THREE.BoxGeometry(0.008, s ? 0.11 : 0.09, 0.0015), solid('#d23a2a'), s ? 0.05 : 0.04); tab.position.z = s ? 0.035 : 0.021;
    setOpen = (p) => { wrap.visible = p < 0.6; tab.visible = p < 0.35; };
    setEaten = (e) => { food.scale.y = 1 - e * 0.65; };
  } else if (shape === 'cupnoodle') {
    height = 0.11; width = 0.104;
    add(lathe([[0.035, 0], [0.036, 0.004], [0.048, 0.1], [0.0515, 0.101], [0.0515, 0.105], [0.0475, 0.105], [0.0465, 0.102], [0.0345, 0.006]]), solid('#f4f2ec', { roughness: 0.7, side: THREE.DoubleSide }));
    add(new THREE.CylinderGeometry(0.0482, 0.0362, 0.094, 48, 1, true), new THREE.MeshStandardMaterial({ map: snackArt(512, 256, true), roughness: 0.6 }), 0.051);
    add(new THREE.CircleGeometry(0.036, 32), solid(a), 0.001).rotation.x = Math.PI / 2;
    const noodles = add(new THREE.CircleGeometry(0.044, 32), new THREE.MeshStandardMaterial({ map: art('noodles', a, b, word, 128, 128), color: '#b8a890', roughness: 0.75 }), 0.088); noodles.rotation.x = -Math.PI / 2; noodles.visible = false;
    const hinge = new THREE.Group(); hinge.position.set(0, 0.1055, -0.0515); g.add(hinge);
    const lid = add(new THREE.CylinderGeometry(0.0525, 0.0525, 0.0012, 48), [new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.8, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: art('lid', a, b, word, 256, 256), roughness: 0.5 }), metal], 0, hinge); lid.position.z = 0.0515;
    setOpen = (p) => { hinge.rotation.x = -p * 2.75; noodles.visible = p > 0.25; };
    setEaten = (e) => { noodles.position.y = 0.088 - e * 0.055; noodles.scale.setScalar(1 - e * 0.18); };
  } else if (shape === 'skewer' || shape === 'sausage') {
    height = 0.2; width = 0.06;
    add(new THREE.CylinderGeometry(0.002, 0.002, 0.2, 8), solid('#d8b48a'), 0.1);
    if (shape === 'sausage') {
      const sz = add(fromBottom(new THREE.CapsuleGeometry(0.012, 0.09, 8, 16)), solid(a, { roughness: 0.38 }), 0.083);
      for (let i = 0; i < 4; i++) { const c = add(new THREE.TorusGeometry(0.0121, 0.0008, 6, 24, Math.PI), solid('#7a3018'), 0, sz); c.position.y = 0.025 + i * 0.022; c.rotation.set(Math.PI / 2, 0, 0.6); } // 烤出来的斜纹
      setEaten = (e) => { sz.scale.y = 1 - e * 0.8; };
    } else {
      const pieces = [
        add(new THREE.BoxGeometry(0.03, 0.025, 0.015), solid('#c99a5a'), 0.1),
        add(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 24), solid('#efe7cf', { roughness: 0.6 }), 0.13),
        add(new THREE.SphereGeometry(0.022, 24, 16), solid('#f4f0e0', { roughness: 0.5 }), 0.17),
      ];
      setEaten = (e) => { const keep = Math.ceil(3 * (1 - e) - 1e-6); pieces.forEach((m, i) => { m.visible = i < keep; }); };
    }
  } else if (shape === 'icebar') {
    height = 0.15; width = 0.05;
    add(new THREE.BoxGeometry(0.008, 0.06, 0.003), solid(b), 0.03);
    const bar = add(fromBottom(new RoundedBoxGeometry(0.04, 0.08, 0.018, 3, 0.008)), new THREE.MeshPhysicalMaterial({ color: a, roughness: 0.25, clearcoat: 1 }), 0.05);
    setEaten = (e) => { bar.scale.y = 1 - e * 0.8; };
  }

  g.userData = { id, height, width, setOpen, setEaten, style: it.style, openKind: it.open || null };
  return g;
}

// 第一视角里另一只手捏起来的一小块
export function makePiece(kind) {
  const m = {
    cookie: () => new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20), solid('#d8a860', { roughness: 0.9 })),
    oreo: () => { const g = new THREE.Group(); for (const [y, c] of [[-0.0035, '#1a1414'], [0, '#f8f6f0'], [0.0035, '#1a1414']]) { const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, y ? 0.003 : 0.0025, 24), solid(c, { roughness: 0.85 })); m2.position.y = y; g.add(m2); } g.rotation.x = Math.PI / 2; return g; },
    stick: () => { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.1, 8), solid('#4a2418')); a.position.y = 0.02; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 8), solid('#e8c890')); b.position.y = -0.045; g.add(a, b); return g; },
    candy: () => new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#f25a8a', roughness: 0.1, clearcoat: 1 })),
    mint: () => new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20), solid('#f6f6f2', { roughness: 0.5 })),
    gummy: () => { const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: '#e8302a', roughness: 0.2, transmission: 0.4, transparent: true, opacity: 0.9 }); const body = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 10), mat); body.scale.set(1, 1.2, 0.7); const head = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 10), mat); head.position.y = 0.009; g.add(body, head); return g; },
    gum: () => new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.012), solid('#f4fbf2', { roughness: 0.5 })),
    nut: () => new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), solid('#b07a40', { roughness: 0.8 })),
    chip: () => { const geo = new THREE.CircleGeometry(0.016, 14); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2 - p.getY(i) ** 2) * 18); geo.computeVertexNormals(); return new THREE.Mesh(geo, solid('#f2c45a', { roughness: 0.7, side: THREE.DoubleSide })); },
  }[kind] || (() => new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), solid('#ccc')));
  return m();
}
