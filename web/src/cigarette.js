// 3D 香烟：真实尺寸（米），沿 +Y 方向，y=0 是过滤嘴末端（叼在嘴里的那头）
import * as THREE from 'three';
import { CIG } from '../../public/js/data.js';
import { canvasTex, rng } from './textures.js';

const cache = new Map();
function mats(brandId) {
  if (cache.has(brandId)) return cache.get(brandId);
  const b = CIG[brandId] || CIG.jiangnan;
  const r = rng(brandId.length * 31);
  const cork = canvasTex(128, 128, (g) => {
    g.fillStyle = b.filter; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${40 + r() * 40 | 0},10,${0.25 + r() * 0.35})`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = b.tipping || '#e8c45a'; g.fillRect(0, 120, 128, 4);
  });
  const paper = canvasTex(256, 512, (g) => {
    g.fillStyle = b.paper; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.035})`; g.fillRect(r() * 256, r() * 512, 1, 2 + r() * 4); }
    g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(200, 0, 2, 512);  // 接缝
    // 靠近过滤嘴的品牌字
    const light = (c) => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16) > 600;
    g.save(); g.translate(128, 470); g.fillStyle = light(b.pack[0]) ? b.pack[1] : b.pack[0];
    g.font = '700 22px Georgia, "PingFang SC", serif'; g.textAlign = 'center'; if (!b.catalog) g.fillText((b.nameEn || b.name).split(' ')[0].toUpperCase(), 0, 0, 200); g.restore();
  });
  const leaf = canvasTex(256, 256, (g) => {
    g.fillStyle = b.paper; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(30,15,5,.35)'; for (let i = 0; i < 30; i++) { g.lineWidth = 0.5 + r() * 1.5; g.beginPath(); const y = r() * 256; g.moveTo(0, y); g.bezierCurveTo(80, y + 30, 170, y - 30, 256, y + 10); g.stroke(); }
  });
  const ash = canvasTex(128, 256, (g) => {
    g.fillStyle = '#a6a29c'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 1400; i++) { const v = 60 + r() * 140 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 8},.7)`; g.fillRect(r() * 128, r() * 256, 1 + r() * 3, 1 + r() * 2); }
    for (let y = 0; y < 256; y += 9 + r() * 10) { g.fillStyle = 'rgba(40,38,36,.35)'; g.fillRect(0, y, 128, 1.5); }
  });
  const isLeaf = b.bidi || b.cigarillo;
  const [pr, pg, pb] = [1, 3, 5].map((i) => parseInt((b.paper || '#ffffff').slice(i, i + 2), 16));
  const gold = b.id === 'nile' || (pr > 180 && pg > 140 && pb < 120 && pr - pb > 90); // 金色烟纸带点金属光泽
  const m = {
    filter: new THREE.MeshStandardMaterial({ map: b.filter === '#ffffff' ? null : cork, color: b.filter === '#ffffff' ? '#f6f6f2' : '#ffffff', roughness: 0.75 }),
    cap: new THREE.MeshStandardMaterial({ color: b.filterType === 'charcoal' ? '#3a3836' : b.filterType === 'hollow' ? '#8a8276' : '#e6dcc8', roughness: 1 }),
    tube: new THREE.MeshStandardMaterial({ color: b.paper, roughness: 0.7 }),
    paper: new THREE.MeshStandardMaterial({ map: isLeaf ? leaf : paper, roughness: gold ? 0.35 : 0.65, metalness: gold ? 0.5 : 0 }),
    burnt: new THREE.MeshStandardMaterial({ color: '#241812', roughness: 1, emissive: '#ff4010', emissiveIntensity: 0 }),
    ash: new THREE.MeshStandardMaterial({ map: ash, roughness: 1 }),
    ember: new THREE.MeshStandardMaterial({ color: '#2a0a02', emissive: '#ff5a14', emissiveIntensity: 0, roughness: 1 }),
    tobacco: new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 1 }),
    tie: new THREE.MeshStandardMaterial({ color: '#c9302c', roughness: 0.8 }),
  };
  cache.set(brandId, m);
  return m;
}

function spec(b) {
  // 资产目录里的烟用真实尺寸（毫米）
  if (b.lenMm) {
    const len = b.lenMm / 1000, r0 = b.diaMm / 2000, filter = b.filterMm / 1000;
    return { len, filter, r0, r1: b.bidi ? r0 * 0.62 : r0, tube: b.filterType === 'tube', hollow: b.filterType === 'hollow' };
  }
  if (b.bidi) return { len: 0.062, filter: 0, r0: 0.0036, r1: 0.0023 };
  if (b.cigarillo) return { len: 0.09, filter: 0, r0: 0.0052, r1: 0.0052 };
  if (b.papirosa) return { len: 0.11, filter: 0.05, r0: 0.0042, r1: 0.0042, tube: true };
  if (b.slim) return { len: 0.1, filter: 0.025, r0: 0.0027, r1: 0.0027 };
  return { len: 0.084, filter: 0.022, r0: 0.0039, r1: 0.0039 };
}

export function makeCig(brandId) {
  const b = CIG[brandId] || CIG.jiangnan, s = spec(b), m = mats(b.id || 'jiangnan');
  const g = new THREE.Group();
  const seg = 28;
  if (s.filter) {
    const fg = new THREE.CylinderGeometry(s.r0, s.r0, s.filter, seg); fg.translate(0, s.filter / 2, 0);
    const f = new THREE.Mesh(fg, s.tube ? m.tube : m.filter); f.castShadow = true; g.add(f);
    const cap = new THREE.Mesh(s.hollow ? new THREE.RingGeometry(s.r0 * 0.45, s.r0 * 0.98, seg) : new THREE.CircleGeometry(s.r0 * 0.98, seg), s.tube ? new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 1 }) : m.cap);
    cap.rotation.x = Math.PI / 2; cap.position.y = 0.0002; g.add(cap);
  }
  const plen = s.len - s.filter;
  // 烟身用单位长度，按剩余长度缩放；贴图跟着裁，过滤嘴那头的字不动
  const pg = new THREE.CylinderGeometry(s.r1, s.r0, 1, seg, 1, true); pg.translate(0, 0.5, 0);
  const paperMat = m.paper.clone(); paperMat.map = m.paper.map.clone(); paperMat.map.needsUpdate = true; paperMat.map.wrapT = THREE.RepeatWrapping;
  const paper = new THREE.Mesh(pg, paperMat); paper.position.y = s.filter; paper.castShadow = true; g.add(paper);
  if (b.bidi) { const tie = new THREE.Mesh(new THREE.CylinderGeometry(s.r0 * 1.06, s.r0 * 1.06, 0.002, seg), m.tie); tie.position.y = 0.008; g.add(tie); }
  const burnt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, seg), m.burnt.clone()); g.add(burnt);
  const ag = new THREE.CylinderGeometry(1, 1, 1, seg, 6); ag.translate(0, 0.5, 0);
  { const p = ag.attributes.position, rr = rng(9); for (let i = 0; i < p.count; i++) { const k = 1 + (rr() - 0.5) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } ag.computeVertexNormals(); }
  const ash = new THREE.Mesh(ag, m.ash); g.add(ash);
  const emberMat = m.ember.clone();
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, seg), emberMat); g.add(ember);
  const endCap = new THREE.Mesh(new THREE.CircleGeometry(1, seg), m.tobacco.clone()); endCap.rotation.x = -Math.PI / 2; g.add(endCap);
  const tip = new THREE.Object3D(); g.add(tip);

  const rAt = (y) => s.r0 + (s.r1 - s.r0) * ((y - s.filter) / plen);
  let glow = 0, lastT = 0; // 吸的时候烟头一圈红炭慢慢烧旺、松开慢慢暗下去
  return {
    group: g, tip, spec: s,
    update(st, t) {
      const cur = Math.max(0.004, plen * (1 - st.burn * 0.85));
      paper.scale.y = cur; paperMat.map.repeat.set(1, cur / plen);
      const top = s.filter + cur, rTop = rAt(top);
      const lit = st.cig === 2;
      burnt.visible = lit; ash.visible = lit && st.ash > 0.01; ember.visible = lit;
      endCap.material = lit ? emberMat : m.tobacco;
      burnt.position.y = top + 0.0007; burnt.scale.set(rTop * 1.01, 0.0014, rTop * 1.01);
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      glow += ((lit && st.puffing ? 1 : 0) - glow) * Math.min(1, dt * (st.puffing ? 3 : 1.6));
      const flick = 0.12 * Math.sin(t * 23) + 0.08 * Math.sin(t * 37.7) + 0.06 * Math.sin(t * 11.3); // 炭火跳动
      const heat = lit ? 0.5 + 0.08 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.3) + glow * (0.5 + flick) : 0;
      burnt.material.emissiveIntensity = lit ? 0.3 + glow * (1.1 + flick) : 0; // 平时只是一点暗红；吸的时候纸边一圈烧成橙红
      burnt.material.emissive.setRGB(1, 0.22 + glow * 0.16, 0.04);
      let end = top;
      if (lit) {
        const al = Math.min(0.03, st.ash * 0.06), band = 0.0026 + glow * 0.0034; // 吸的时候红炭那一段变长，从侧面也看得到一圈橙红
        ember.position.y = top + 0.0006 + band / 2; ember.scale.set(rTop * 1.03, band, rTop * 1.03);
        const a0 = top + 0.0006 + band * 0.8; // 烟灰接在红炭后面，不把它盖住
        ash.position.y = a0; ash.scale.set(rTop * 1.02, Math.max(0.0001, al), rTop * 1.02);
        end = a0 + (ash.visible ? al : 0);
        emberMat.emissiveIntensity = 0.9 + glow * (1.6 + flick * 2);
        emberMat.emissive.setRGB(1, 0.2 + glow * 0.22, 0.03 + glow * 0.05);
      }
      endCap.position.y = (lit && !ash.visible) ? top + 0.0007 + 0.0026 + glow * 0.0034 : top + 0.0001; endCap.scale.setScalar(rTop * 0.98);
      if (lit && ash.visible) { endCap.position.y = end + 0.0001; endCap.material = m.ash; }
      tip.position.y = end + 0.001;
    },
  };
}
