// 用 Gemini API（Nano Banana 出图）批量做香烟资产：读 docs/gemini-more-cigs.md 的清单，
// 每款先让文本模型写 JSON（规格、配色、口味，规则同 docs/gemini-asset-brief.md），再让 Nano Banana 画烟盒正面，
// 压成 512×768 存到 web/public/catalog/cig/<id>/front.png，追加进 cigarettes.json（和 Antigravity 做的格式一样）。
//
// 用法：node scripts/gen-cigs.mjs [--list docs/xxx.md] [--limit 5] [--only JP] [--pro] [--dry] [--noskip]
//   --limit N  只做前 N 款（试跑用）    --only JP  只做某个国家
//   --pro      用 Nano Banana Pro（更贵、更准）   --dry  只写 JSON 不出图
// 需要项目根目录 .env 里有 GEMINI_API_KEY（不进 git）。跑完记录在 .tmp/gen-cigs-log.json（失败、被拒的款）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'web/public/catalog');
const JSON_FILE = path.join(CAT, 'cigarettes.json');

const TMP = path.join(ROOT, '.tmp/gen-cigs'); fs.mkdirSync(TMP, { recursive: true });
const LOG = path.join(ROOT, '.tmp/gen-cigs-log.json');

const args = process.argv.slice(2), flag = (k) => args.includes(k), val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIST = path.resolve(ROOT, val('--list') || 'docs/gemini-more-cigs.md');
const NOSKIP = flag('--noskip'); // 用户点名要的款：不让模型以「查不到」为由跳过
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
  "id": "两位国家代码小写-一个原创英文词-规格词，全小写连字符，不能含真实品牌名，例如 jp-yokocho-blue-10",
  "name": "中文规格描述（不写品牌，如「蓝色硬盒 10mg」「金色细支」）",
  "name_en": "英文规格描述（不写品牌，如 Blue Hard Pack 10mg）",
  "country": "产地中文名", "country_code": "两位大写代码",
  "region_note": "一句话：这款在当地的地位",
  "inspiration": "参考<真实品牌 规格>（English name）",
  "style": "regular|slim|superslim|short|kretek|bidi|papirosa|cigarillo|roll-your-own|menthol",
  "pack": { "type": "hard|soft|flat|tin|bundle", "primary": "#hex", "secondary": "#hex", "accent": "#hex", "count": 20 },
  "stick": { "length_mm": 84, "diameter_mm": 7.8, "filter": "cork|white|charcoal|hollow|tube|none", "filter_length_mm": 25, "filter_color": "#hex", "tipping_band": "#hex", "paper_color": "#hex", "capsule": false, "flavor": "中文口味" },
  "smoke_tint": [214, 214, 224],
  "strength": 1-5,
  "taste_zh": "一句口味描述",
  "note_zh": "一句有画面感的小描述"
}`;
async function makeJson(models, item, existing) {
  const prompt = `你在给一个香烟主题的像素风游戏做资产目录。下面这款真实存在的香烟，按要求输出一条 JSON（只输出 JSON）。
款式：${item.text}（产地分组：${item.group}，国家代码 ${item.code}）
规则：配色、盒型、烟支规格都按真实产品；name / name_en 只写规格描述，绝不写品牌名；真实品牌只写进 inspiration；尺寸查不到就按同类常见规格。
${NOSKIP ? '这一款是用户点名要的真实产品，不要跳过，按你所知最接近的真实包装来写。' : '以下情况只输出 {\"skip\": true}：①和下面已有的某条是同一产品；②和已有某条是同一系列同一口味、只是焦油 / 尼古丁量不同（同一系列只要一款原味，口味款、爆珠款可以做）；③这一款在市面上并不真实存在。'}\n已有这些款（同一国家）：
${existing.map((e) => '- ' + e.inspiration).join('\n') || '（无）'}
字段格式：
${SCHEMA_HINT}`;
  const j = await call(`${API}/models/${models.text}:generateContent`, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } });
  const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return JSON.parse(txt);
}
async function makeImage(models, item, e) {
  // 只给英文名 / 清单原文（不给中文描述），免得模型把中文规格印到包装上
  const en = (e.inspiration.match(/（([^）]*[A-Za-z][^）]*)）\s*$/) || [])[1] || item.text;
  const prompt = `A perfectly flat, straight-on scan of the FRONT face of the real "${en}" cigarette pack as sold in ${e.country_code || item.code} (list entry: ${item.text}).
Reproduce the actual retail packaging as faithfully as possible: the same colors, layout, logo artwork, typography, foil and print finish, and the local health-warning panel where the real pack has one.
Only print text that appears on the real pack — do NOT add translations, Chinese captions or product descriptions that are not on the real pack.
The front face is a plain rectangle filling 100% of the image: square corners, no white border or margin, no visible lid edge or pack top, no background, no perspective, no shadow, no hands, no 3D render — like a high-resolution flatbed scan of the printed cardboard. Portrait 2:3.`;
  const j = await call(`${API}/models/${models.image}:generateContent`, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '2:3' } } });
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(`没出图：${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || '未知原因'}`);
  const raw = path.join(TMP, `${e.id}.src`); fs.writeFileSync(raw, Buffer.from(part.inlineData.data, 'base64'));
  const dir = path.join(CAT, 'cig', e.id); fs.mkdirSync(dir, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'scale=512:768:flags=lanczos', path.join(dir, 'front.png')]); // 统一成 512×768
  fs.rmSync(raw, { force: true });
}

// ---------- 主流程 ----------
const models = await pickModels();
console.log(`文本模型 ${models.text}，出图模型 ${models.image}`);
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { done: [], skipped: [], failed: [] };
let todo = parseList().filter((it) => !ONLY || it.code === ONLY || it.group.includes(ONLY));
todo = todo.filter((it) => !log.done.includes(it.text) && (NOSKIP || !log.skipped.includes(it.text))).slice(0, LIMIT);
console.log(`这次要做 ${todo.length} 款`);
let n = 0;
for (const it of todo) {
  n++;
  try {
    const cat = readCat(), existing = cat.filter((e) => e.country_code === it.code);
    const e = await makeJson(models, it, existing);
    if (e.skip) { log.skipped.push(it.text); console.log(`[${n}/${todo.length}] 跳过（已有）${it.text}`); continue; }
    if (!e.id || cat.some((x) => x.id === e.id)) e.id = `${it.code.toLowerCase()}-${Date.now().toString(36)}`;
    e.country_code = e.country_code || it.code; delete e.skip;
    e.images = { front: `cig/${e.id}/front.png` };
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
console.log(`完成：做好 ${log.done.length}，跳过 ${log.skipped.length}，失败 ${log.failed.length}（详见 .tmp/gen-cigs-log.json）`);
