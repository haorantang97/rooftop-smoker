// 下载 3D 场景用的免费素材到 web/public/assets/（不进 git，重新运行即可恢复）
// 用法：node scripts/fetch-assets.mjs
// 来源：Poly Haven（CC0）、WebXR Input Profiles（MIT）、three.js 示例贴图（MIT）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'web', 'public', 'assets');
const UA = { 'User-Agent': 'smoke-break-asset-fetch/0.1' };

// Poly Haven 材质：[资产 id, 分辨率, 存成的文件夹]
const TEXTURES = [
  ['concrete_floor_worn_001', '2k', 'tex/floor'],
  ['concrete_wall_008', '2k', 'tex/wall'],
  ['rusty_metal_02', '2k', 'tex/metal'],
  ['knitted_fleece', '1k', 'tex/fleece'],
];
const MAPS = { Diffuse: 'diff.jpg', nor_gl: 'nor.jpg', arm: 'arm.jpg' };
const MODELS = [['potted_plant_02', '1k'], ['potted_plant_04', '1k']];
const DIRECT = [
  ['https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/right.glb', 'models/hand/right.glb'],
  ['https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/left.glb', 'models/hand/left.glb'],
  ['https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg', 'tex/waternormals.jpg'],
];

async function get(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function save(url, rel) {
  const file = path.join(OUT, rel);
  if (fs.existsSync(file)) return console.log('已有', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = await get(url);
  fs.writeFileSync(file, buf);
  console.log('下载', rel, (buf.length / 1e6).toFixed(2) + 'MB');
}
const info = async (id) => JSON.parse((await get(`https://api.polyhaven.com/files/${id}`)).toString());

for (const [id, res, dir] of TEXTURES) {
  const f = await info(id);
  for (const [map, name] of Object.entries(MAPS)) await save(f[map][res].jpg.url, `${dir}/${name}`);
}
for (const [id, res] of MODELS) {
  const g = (await info(id)).gltf[res].gltf;
  await save(g.url, `models/${id}/${id}.gltf`);
  for (const [rel, e] of Object.entries(g.include)) await save(e.url, `models/${id}/${rel}`);
}
for (const [url, rel] of DIRECT) await save(url, rel);
fs.writeFileSync(path.join(OUT, 'CREDITS.txt'), [
  '素材来源与协议',
  '- Poly Haven（https://polyhaven.com）CC0：' + [...TEXTURES.map((t) => t[0]), ...MODELS.map((m) => m[0])].join('、'),
  '- WebXR Input Profiles generic-hand（https://github.com/immersive-web/webxr-input-profiles）MIT',
  '- three.js waternormals.jpg（https://github.com/mrdoob/three.js）MIT',
  '',
].join('\n'));
console.log('完成');
