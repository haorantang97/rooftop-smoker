// 照着真品照片重画烟盒正面：把用户给的实物照片交给 Nano Banana，画成正面平铺图，存到 web/public/catalog/cig/<id>/front.png（512×768）
// 用法：node scripts/gen-from-photo.mjs <烟的 id> <照片路径> ["补充说明"]
// 需要项目根目录 .env 里的 GEMINI_API_KEY；Mac 上加 NODE_USE_ENV_PROXY=1
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, photo, note = ''] = process.argv.slice(2);
if (!id || !photo || !fs.existsSync(photo)) { console.error('用法：node scripts/gen-from-photo.mjs <id> <照片> ["说明"]'); process.exit(1); }
const env = Object.fromEntries((fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.error('缺 GEMINI_API_KEY'); process.exit(1); }
const API = 'https://generativelanguage.googleapis.com/v1beta';
const call = async (url, body) => {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return r.json();
    const t = await r.text(); if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (i + 1))); continue; }
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  }
  throw new Error('重试多次仍失败');
};
const models = (await call(`${API}/models?pageSize=200`)).models.map((m) => m.name.replace('models/', ''));
const ver = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
const image = models.filter((n) => /image/.test(n) && /flash/.test(n) && !/imagen/.test(n)).sort((a, b) => ver(b) - ver(a) || a.length - b.length)[0];
const ext = path.extname(photo).toLowerCase(), mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
const prompt = `This is a photo of a real cigarette pack. Redraw ONLY its front face as a perfectly flat, straight-on, high-resolution scan of the printed cardboard.
Keep everything exactly as on the real pack: colors, layout, logo, artwork/illustration, every piece of text in the same language and position, the health-warning panel. Do not add or translate any text, do not invent new elements.
Remove the photo's background, perspective, lighting, shadows, reflections and the lid gap line; the front face fills 100% of the image with square corners and no border. Portrait 2:3. ${note}`;
const j = await call(`${API}/models/${image}:generateContent`, {
  contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: fs.readFileSync(photo).toString('base64') } }, { text: prompt }] }],
  generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '2:3' } },
});
const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
if (!part) { console.error('没出图：', j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason); process.exit(1); }
const tmp = path.join(ROOT, '.tmp', `${id}.photo-src`); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, Buffer.from(part.inlineData.data, 'base64'));
const dir = path.join(ROOT, 'web/public/catalog/cig', id); fs.mkdirSync(dir, { recursive: true });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=512:768:flags=lanczos', path.join(dir, 'front.png')]);
fs.rmSync(tmp, { force: true });
console.log(`✓ ${id} ← ${path.basename(photo)}（${image}）`);
