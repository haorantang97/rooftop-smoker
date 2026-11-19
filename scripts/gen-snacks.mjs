// 用 Gemini API（Nano Banana 出图）批量做零食资产：读 docs/gemini-more-snacks.md 的清单（和 gen-cigs.mjs 同一套流程），
// 每款先让文本模型写 JSON（包装、尺寸、配色，格式同 docs/gemini-asset-brief.md 的 snacks.json），再让 Nano Banana 画包装正面，
// 压成 512×640 存到 web/public/catalog/snack/<id>/front.png，追加进 snacks.json。一个产品只做一款（不做同一产品的不同口味）。
//
// 用法：node scripts/gen-snacks.mjs [--list docs/xxx.md] [--limit 5] [--only JP] [--pro] [--dry]
//   --limit N  只做前 N 款（试跑用）    --only JP  只做某个国家
//   --pro      用 Nano Banana Pro（更贵、更准）   --dry  只写 JSON 不出图
// 需要项目根目录 .env 里有 GEMINI_API_KEY（不进 git）。跑完记录在 .tmp/gen-snacks-log.json（失败、被拒的款）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'web/public/catalog');
const JSON_FILE = path.join(CAT, 'snacks.json');

const TMP = path.join(ROOT, '.tmp/gen-snacks'); fs.mkdirSync(TMP, { recursive: true });
const LOG = path.join(ROOT, '.tmp/gen-snacks-log.json');

const args = process.argv.slice(2), flag = (k) => args.includes(k), val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIST = path.resolve(ROOT, val('--list') || 'docs/gemini-more-snacks.md');
const LIMIT = Number(val('--limit')) || Infinity, ONLY = val('--only'), PRO = flag('--pro'), DRY = flag('--dry');

// ---------- key ----------
const env = Object.fromEntries((fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!KEY) { console.error('缺 GEMINI_API_KEY：在项目根目录 .env 里填上'); process.exit(1); }
const API = 'https://generativelanguage.googleapis.com/v1beta';
const call = async (url, body, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: body ? JSON.stringify(body) : undefined });
    if (r.ok) return r.json();
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 4000 * (i + 1))); continue; }
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`);
  }
  throw new Error('重试多次仍失败');
};

// ---------- 选模型：文本用最新的 flash，出图用 Nano Banana（名字里带 image 的 flash；--pro 用 pro image）----------
async function pickModels() {
  const all = []; let token = '';
  do { const j = await call(`${API}/models?pageSize=200${token ? `&pageToken=${token}` : ''}`); all.push(...(j.models || [])); token = j.nextPageToken || ''; } while (token);
  const names = all.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''));
  const ver = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const best = (list) => list.sort((a, b) => ver(b) - ver(a) || a.length - b.length)[0];
  const image = best(names.filter((n) => /image/.test(n) && (PRO ? /pro/.test(n) : /flash/.test(n)) && !/imagen/.test(n)));
  const text = best(names.filter((n) => /^gemini-[\d.]+-flash$/.test(n))) || best(names.filter((n) => /^gemini-.*flash/.test(n) && !/image|tts|live|audio|lite/.test(n)));
  if (!image || !text) throw new Error(`找不到可用模型。可用的：${names.join(', ')}`);
  return { image, text };
}

// ---------- 清单 ----------
function parseList() {
  const items = []; let codes = [], country = '';
  for (const line of fs.readFileSync(LIST, 'utf8').split('\n')) {
    const h = line.match(/^#{2,3}\s+(.+?)（([A-Z /]+)/);
    if (h) { country = h[1].trim(); codes = h[2].split('/').map((s) => s.trim()).filter(Boolean); continue; }
    const m = line.match(/^\d+\.\s+(.+)$/);
    if (m && codes.length) {
      const text = m[1].trim(), tag = text.match(/（([A-Z]{2})[^）]*）\s*$/) || text.match(/\(([A-Z]{2})\)/);
      items.push({ text, code: tag && codes.includes(tag[1]) ? tag[1] : codes[0], group: country });
    }
  }
  return items;
}

const readCat = () => JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const writeCat = (list) => { const tmp = JSON_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list, null, 2)); fs.renameSync(tmp, JSON_FILE); };

// ---------- 一款：先 JSON，再出图 ----------
const SCHEMA_HINT = `{
  "skip": false,
  "id": "两位国家代码小写-一两个原创英文词-品类词，全小写连字符，不能含真实品牌名，例如 jp-starbox-choco-biscuit",
  "name": "中文名（不写品牌，写这是什么：如「蘑菇造型巧克力饼干」「蜂蜜黄油薯片」）",
  "family": "真实产品线的英文名（如 Kinoko no Yama、Honey Butter Chip），同一产品不同口味用同一个",
  "country": "产地中文名", "country_code": "两位大写代码",
  "inspiration": "参考<真实品牌 产品>（English name）",
  "kind": "chips|snack|nuts|jerky|chocolate|candy|gum|cookies|noodles",
  "package": "bag|box|bar|cup|pouch|tin|stick",
  "size_mm": [宽, 高, 厚],
  "colors": { "primary": "#hex", "secondary": "#hex" },
  "type_zh": "两三个字的种类（如 薯片、威化、软糖、杯面、饼干棒）",
  "verb_zh": "吃的动作（如 吃一片、掰一块、吃一颗）",
  "note_zh": "一句有画面感的小描述"
}`;
async function makeJson(models, item, existing) {
  const prompt = `你在给一个便利店主题的像素风游戏做零食资产目录。下面这款真实存在的零食，按要求输出一条 JSON（只输出 JSON）。
款式：${item.text}（产地分组：${item.group}，国家代码 ${item.code}）
规则：包装形式、尺寸、配色都按真实产品；name 只写这是什么，绝不写品牌名；真实品牌只写进 inspiration 和 family；尺寸查不到就按同类常见规格。
package 选最接近的：袋装 bag、纸盒 box、单条排块 bar、杯面 cup、立袋 pouch、罐 / 筒 tin、细长条装 stick。
以下情况只输出 {\"skip\": true}：①和下面已有的某条是同一个产品（只是口味不同也算同一个）；②这一款在市面上并不真实存在。
已有这些款：
${existing.map((e) => '- ' + e.inspiration).join('\n') || '（无）'}
字段格式：
${SCHEMA_HINT}`;
  const j = await call(`${API}/models/${models.text}:generateContent`, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } });
  const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return JSON.parse(txt);
}
async function makeImage(models, item, e) {
  const en = (e.inspiration.match(/（([^）]*[A-Za-z][^）]*)）\s*$/) || [])[1] || item.text;
  const prompt = `A perfectly flat, straight-on scan of the FRONT face of the real "${en}" snack package as sold in ${e.country_code || item.code} (list entry: ${item.text}).
Reproduce the actual retail packaging as faithfully as possible: the same colors, layout, logo artwork, product photo / illustration, typography and print finish.
Only print text that appears on the real package — do NOT add translations, Chinese captions or descriptions that are not on the real package.
The front face fills 100% of the image: no background, no white border or margin, no perspective, no shadow, no hands, no 3D render, no crimped seal edges shown as a 3D shape — like a high-resolution flatbed scan of the printed front panel. Portrait 4:5.`;
  const j = await call(`${API}/models/${models.image}:generateContent`, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5' } } });
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`没出图：${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || '未知原因'}`);
  const raw = path.join(TMP, `${e.id}.src`); fs.writeFileSync(raw, Buffer.from(part.inlineData.data, 'base64'));
  const dir = path.join(CAT, 'snack', e.id); fs.mkdirSync(dir, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'scale=512:640:flags=lanczos', path.join(dir, 'front.png')]); // 统一成 512×640
  fs.rmSync(raw, { force: true });
}

// ---------- 主流程 ----------
const models = await pickModels();
console.log(`文本模型 ${models.text}，出图模型 ${models.image}`);
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { done: [], skipped: [], failed: [] };
let todo = parseList().filter((it) => !ONLY || it.code === ONLY || it.group.includes(ONLY));
todo = todo.filter((it) => !log.done.includes(it.text) && !log.skipped.includes(it.text)).slice(0, LIMIT);
console.log(`这次要做 ${todo.length} 款`);
let n = 0;
for (const it of todo) {
  n++;
  try {
    const cat = readCat(), existing = cat; // 零食少，全部给它对照（同一产品不同口味也算重复）
    const e = await makeJson(models, it, existing);
    if (e.skip) { log.skipped.push(it.text); console.log(`[${n}/${todo.length}] 跳过（已有）${it.text}`); continue; }
    if (!e.id || cat.some((x) => x.id === e.id)) e.id = `${it.code.toLowerCase()}-${Date.now().toString(36)}`;
    e.country_code = e.country_code || it.code; delete e.skip;
    e.images = { front: `snack/${e.id}/front.png` };
    if (!DRY) await makeImage(models, it, e);
    const cat2 = readCat(); cat2.push(e); writeCat(cat2); // 每款做完立刻写进去，游戏随时能读到
    log.done.push(it.text); log.failed = log.failed.filter((f) => f.text !== it.text);
    console.log(`[${n}/${todo.length}] ✓ ${it.code} ${e.name}（${e.inspiration}）`);
  } catch (err) {
    log.failed = log.failed.filter((f) => f.text !== it.text); log.failed.push({ text: it.text, error: String(err.message || err).slice(0, 300) });
    console.log(`[${n}/${todo.length}] ✗ ${it.text}：${String(err.message || err).slice(0, 160)}`);
  }
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
}
console.log(`完成：做好 ${log.done.length}，跳过 ${log.skipped.length}，失败 ${log.failed.length}（详见 .tmp/gen-snacks-log.json）`);
