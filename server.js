import crypto from 'node:crypto';
// 抽根烟 · 服务端：静态文件 + WebSocket 多人同步
// 运行：npm start（默认端口 8790，可用 PORT 覆盖）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { CIG, ITEM, PACK_SIZE, LOOSE_MAX, isPlace, VISTAS, VISTA, addCatalogCigs, addCatalogDrinks, addCatalogSnacks } from './public/js/data.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LEGACY = path.join(ROOT, 'public');          // 2D 旧版，挂在 /2d/
const DIST = path.join(ROOT, 'dist');              // 3D 版构建产物（npm run build）
const DATA = path.join(ROOT, 'data');
const STATS_FILE = path.join(DATA, 'stats.json');
const PORT = Number(process.env.PORT) || 8790;

// Gemini 做的各国香烟：启动时读一次，文件有变化（继续出新批次）就再读
const CATALOG_CIGS = path.join(ROOT, 'web', 'public', 'catalog', 'cigarettes.json');
function loadCatalog() {
  try { const n = addCatalogCigs(JSON.parse(fs.readFileSync(CATALOG_CIGS, 'utf8'))); if (n) console.log(`[资产] 新读入 ${n} 种烟，现在一共 ${Object.keys(CIG).length} 种`); }
  catch (e) { if (e.code !== 'ENOENT') console.warn('[资产] cigarettes.json 读取失败：', e.message); }
}
loadCatalog(); fs.watchFile(CATALOG_CIGS, { interval: 5000 }, loadCatalog);
// 各国饮料同理：读进来才能从冰柜里拿
const CATALOG_DRINKS = path.join(ROOT, 'web', 'public', 'catalog', 'drinks.json');
function loadDrinks() {
  try { const n = addCatalogDrinks(JSON.parse(fs.readFileSync(CATALOG_DRINKS, 'utf8'))); if (n) console.log(`[资产] 新读入 ${n} 种饮料，现在一共 ${Object.keys(ITEM).length} 种商品`); }
  catch (e) { if (e.code !== 'ENOENT') console.warn('[资产] drinks.json 读取失败：', e.message); }
}
loadDrinks(); fs.watchFile(CATALOG_DRINKS, { interval: 5000 }, loadDrinks);
// 各国零食同理：读进来才能从货架上拿
const CATALOG_SNACKS = path.join(ROOT, 'web', 'public', 'catalog', 'snacks.json');
function loadSnacks() {
  try { const n = addCatalogSnacks(JSON.parse(fs.readFileSync(CATALOG_SNACKS, 'utf8'))); if (n) console.log(`[资产] 新读入 ${n} 种零食，现在一共 ${Object.keys(ITEM).length} 种商品`); }
  catch (e) { if (e.code !== 'ENOENT') console.warn('[资产] snacks.json 读取失败：', e.message); }
}
loadSnacks(); fs.watchFile(CATALOG_SNACKS, { interval: 5000 }, loadSnacks);

// ---------- 场景（天台风景）：全世界统一，由我们决定、主动推送；玩家只能看到自己当地的时间（白天 / 黄昏 / 夜里） ----------
// 换场景：改 data/scene.json，比如 {"vista":"nyc"}（或者 node scripts/set-scene.mjs nyc），服务器 5 秒内读到，所有在天台上的人一起换过去
const SCENE_FILE = path.join(DATA, 'scene.json');
const SCENES_3D = ['sea', 'nyc', 'hokkaido', 'wilds', 'inaka', 'miami'];
let SCENE = SCENES_3D.includes(process.env.SCENE) ? process.env.SCENE : 'sea';
function loadScene() {
  let v = null;
  try { v = JSON.parse(fs.readFileSync(SCENE_FILE, 'utf8')).vista; } catch (e) { if (e.code !== 'ENOENT') console.warn('[场景] scene.json 读取失败：', e.message); }
  if (!v || !SCENES_3D.includes(v) || !VISTA[v] || v === SCENE) return;
  SCENE = v; console.log(`[场景] 换成 ${v}`);
  for (const room of rooms.values()) {
    broadcast(room, { t: 'scene', vista: SCENE });
    for (const p of room.players.values()) if (p.place.startsWith('roof') && p.place !== 'roof:' + SCENE) handle(p, { t: 'place', to: 'roof:' + SCENE });
    for (const p of room.players.values()) if (p.npc) seatNpc(p);
  }
}
fs.watchFile(SCENE_FILE, { interval: 5000 }, loadScene);

const ROOM_CAP = 40;            // 一家店（店里 + 吸烟区 + 房顶）最多 40 人，满了开分店
const SHOP_FLOOR = { x0: 20, x1: 462, y0: 214, y1: 262 };
// 3D 版出生点 [x, z, 朝向]：进店就站在收银台前、面朝烟柜（一进来就能挑烟）；上天台就在楼梯间门口，背对着门
const SPAWN = { shop: [2.35, 0.9, -Math.PI / 2], roof: [6.2, 10.15, 0], street: [0, 0, 0] };
const ACTS = new Set(['draw', 'flick', 'puff', 'exhale', 'ash', 'stub', 'sip', 'open', 'cough']);
const FIRE_REACH = 2.5; // 借火得走到这么近（米）
const ASK_TIMEOUT = 8000; // 要烟的请求 8 秒没人理就作废（跟对方弹窗消失的时间一致）

// ---------- 统计 ----------
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
let stats = { date: today(), smoked: 0, allTime: 0 };
try { stats = { ...stats, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }; } catch {}
let statsDirty = false;
function bumpSmoked() {
  if (stats.date !== today()) { stats.date = today(); stats.smoked = 0; }
  stats.smoked++; stats.allTime++; statsDirty = true;
}
setInterval(() => {
  if (!statsDirty) return;
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFile(STATS_FILE, JSON.stringify(stats), () => {});
  statsDirty = false;
}, 15000);

// ---------- 名字 ----------
const NAME_A = ['加班的', '凌晨三点的', '不想上班的', '楼下的', '路过的', '发呆的', '迷路的', '刚下班的', '失眠的', '慢吞吞的', '安静的', '想辞职的', '半夜的', '打工的', '摸鱼的', '吹风的'];
const NAME_B = ['猫', '风', '路灯', '鸽子', '月亮', '打火机', '外卖员', '小狗', '云', '晚风', '橘子', '程序员', '学生', '树', '店员', '司机'];
// 英文名和上面一一对应（英文环境的玩家看到的是这个）
const NAME_A_EN = ['Overtime', '3 AM', 'Work-shy', 'Downstairs', 'Passing', 'Daydreaming', 'Lost', 'Off-duty', 'Sleepless', 'Slowpoke', 'Quiet', 'Quitting', 'Midnight', 'Hustling', 'Slacking', 'Breezy'];
const NAME_B_EN = ['Cat', 'Wind', 'Streetlight', 'Pigeon', 'Moon', 'Lighter', 'Courier', 'Puppy', 'Cloud', 'Breeze', 'Orange', 'Coder', 'Student', 'Tree', 'Clerk', 'Driver'];
const newName = () => { const a = Math.floor(Math.random() * NAME_A.length), b = Math.floor(Math.random() * NAME_B.length); return { name: NAME_A[a] + NAME_B[b], nameEn: `${NAME_A_EN[a]} ${NAME_B_EN[b]}` }; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cleanName = (v) => { if (typeof v !== 'string') return null; const n = [...v.replace(/[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 12).join(''); return n || null; };
const randLook = () => ({ hoodie: rnd(10), skin: rnd(4), hair: rnd(6), pants: rnd(4) });
const rnd = (n) => Math.floor(Math.random() * n);

// ---------- 房间 ----------
const rooms = new Map();
setTimeout(loadScene, 0); // 启动时读一次（等房间表建好）
let nextId = 1;
const human = (p) => !p.npc && !p.bot;
const humansIn = (room) => [...room.players.values()].filter(human).length;
// ---------- 匿名埋点：看用户走到哪一步、第二天还来不来（scripts/analytics.mjs 出报告）----------
// 每台设备一个随机编号 d（存在玩家浏览器里），每次打开一个会话编号 s；不记 IP、不记名字。按天写 data/events/YYYY-MM-DD.jsonl
const EV_DIR = path.join(DATA, 'events');
let evBuf = [];
// 自己人（开发者自己的设备）不计入：设备打开过一次 ?internal=1 就标记，编号记进 data/internal.json，报告里连以前的记录也一起去掉
const INTERNAL_FILE = path.join(DATA, 'internal.json');
let internalIds = new Set(); try { internalIds = new Set(JSON.parse(fs.readFileSync(INTERNAL_FILE, 'utf8'))); } catch {}
function markInternal(did) { if (!did || internalIds.has(did)) return; internalIds.add(did); try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(INTERNAL_FILE, JSON.stringify([...internalIds])); } catch {} console.log(`[埋点] 标记自己人设备 ${did.slice(0, 6)}…`); }
function logEv(p, e, x = {}) { if (!p || !human(p) || !p.did || internalIds.has(p.did)) return; evBuf.push(JSON.stringify({ t: Date.now(), d: p.did, s: p.sid, e, pl: p.place, ...x })); }
function flushEv() { if (!evBuf.length) return; try { fs.mkdirSync(EV_DIR, { recursive: true }); fs.appendFileSync(path.join(EV_DIR, today() + '.jsonl'), evBuf.join('\n') + '\n'); } catch (err) { console.warn('[埋点] 写入失败：', err.message); } evBuf = []; }
setInterval(flushEv, 5000);
const CLIENT_EV = new Set(['gate', 'age_ok', 'age_minor', 'name_shown', 'name_done', 'enter', 'shop_open', 'dice']); // 只在页面上发生、服务器看不到的几步
const idOk = (v) => (typeof v === 'string' && /^[a-z0-9]{8,40}$/i.test(v) ? v : null);
function findRoom() {
  for (const r of rooms.values()) if (humansIn(r) < ROOM_CAP) return r;
  let num = 1;
  while (rooms.has(num)) num++;
  const room = { num, players: new Map() };
  rooms.set(num, room);
  spawnNpcs(room); // 每家店的天台上都有几个假人在抽烟
  return room;
}
const gear = (p) => ({ item: p.item, pack: p.pack ? { id: p.pack.id, n: p.pack.n } : null, loose: p.loose });
const pub = (p) => ({ id: p.id, name: p.name, nameEn: p.nameEn, look: p.look, tz: p.tz, place: p.place, x: p.x, y: p.y, r: p.r || 0, face: p.face, slot: p.slot, ...gear(p), cig: p.cig, brand: p.brand, burn: p.burn, ash: p.ash, pose: p.pose, seatY: p.seatY || 0 });
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}
function freeSlot(room, place) {
  const used = new Set([...room.players.values()].filter((q) => q.place === place).map((q) => q.slot));
  let s = 0; while (used.has(s)) s++;
  return s;
}
function resetCig(p) { p.cig = 0; p.brand = null; p.burn = 0; p.ash = 0; }

// 断线续上：每个浏览器有个 token（存在玩家本地），断开后 30 分钟内用同一个 token 回来，名字、样子、烟盒、手里的东西、在哪、站哪都照旧
const GHOST_TTL = 30 * 60 * 1000;
const ghosts = new Map(); // token → 断开时的样子
setInterval(() => { const now = Date.now(); for (const [k, g] of ghosts) if (now - g.at > GHOST_TTL) ghosts.delete(k); }, 60000);
// 更新上线（systemctl restart）时：关门前把所有在线的人记进 data/ghosts.json，重启后读回来 → 大家掉线几秒自动重连，位置、东西、手上的烟都照旧
const GHOST_FILE = path.join(DATA, 'ghosts.json');
try {
  const saved = JSON.parse(fs.readFileSync(GHOST_FILE, 'utf8')), now = Date.now();
  for (const [k, g] of Object.entries(saved || {})) if (g && now - g.at < GHOST_TTL) ghosts.set(k, { ...g, at: now }); // 重启花的时间不算
  fs.rmSync(GHOST_FILE, { force: true });
  if (ghosts.size) console.log(`[续上] 读回 ${ghosts.size} 个重启前在线的人`);
} catch (e) { if (e.code !== 'ENOENT') console.warn('[续上] ghosts.json 读取失败：', e.message); }
let closing = false;
function saveAndExit(sig) {
  if (closing) return; closing = true;
  try {
    for (const r of rooms.values()) for (const p of r.players.values()) if (human(p)) saveGhost(p);
    fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(GHOST_FILE, JSON.stringify(Object.fromEntries(ghosts)));
    console.log(`[续上] ${sig}：记下 ${ghosts.size} 个人，重启后读回`);
    for (const r of rooms.values()) for (const p of r.players.values()) logEv(p, 'restart', { dur: p.t0 ? Date.now() - p.t0 : 0 }); // 更新重启：不算用户自己离开
    flushEv();
  } catch (e) { console.warn('[续上] 保存失败：', e.message); }
  process.exit(0);
}
process.on('SIGTERM', () => saveAndExit('SIGTERM')); process.on('SIGINT', () => saveAndExit('SIGINT'));
function saveGhost(p) {
  if (!p.token || !p.room) return;
  ghosts.set(p.token, { at: Date.now(), name: p.name, nameEn: p.nameEn, look: p.look, pack: p.pack, loose: p.loose, item: p.item, place: p.place, x: p.x, y: p.y, r: p.r, room: p.room.num,
    cig: p.cig, brand: p.brand, burn: p.burn, ash: p.ash, custom: p.custom || null }); // 正在抽的那根也记下，回来还在手上
}
function join(p, g = null) {
  // 尽量回原来那家店（服务器重启后那家店还没开门就按原来的号开一家），天台上的人还是那批
  if (g && Number.isInteger(g.room) && g.room > 0 && !rooms.has(g.room)) { const r = { num: g.room, players: new Map() }; rooms.set(g.room, r); spawnNpcs(r); }
  const room = (g && rooms.get(g.room) && humansIn(rooms.get(g.room)) < ROOM_CAP && rooms.get(g.room)) || findRoom();
  p.room = room;
  p.place = 'shop'; p.slot = -1; p.pose = 'stand';
  p.x = SPAWN.shop[0] + (Math.random() - 0.5) * 0.3; p.y = SPAWN.shop[1] + (Math.random() - 0.5) * 0.8; p.r = SPAWN.shop[2]; p.face = 1;
  if (g) {
    Object.assign(p, { name: g.name, nameEn: g.nameEn, look: g.look, pack: g.pack, loose: g.loose || [], item: g.item });
    if (String(g.place).startsWith('roof') && (g.cig === 1 || g.cig === 2) && g.brand && CIG[g.brand]) Object.assign(p, { cig: g.cig, brand: g.brand, burn: num(g.burn, 0, 1) ?? 0, ash: num(g.ash, 0, 1) ?? 0 });
    if (String(g.place).startsWith('roof')) { p.place = 'roof:' + SCENE; p.slot = freeSlot(room, p.place); } // 场景换过了就回现在的天台
    if (num(g.x, -60, 60) !== null && num(g.y, -60, 60) !== null) { p.x = g.x; p.y = g.y; p.r = g.r || 0; }
  }
  if (p.custom) { p.name = p.custom; p.nameEn = p.custom; }
  room.players.set(p.id, p);
  send(p.ws, { t: 'welcome', id: p.id, token: p.token, room: room.num, scene: SCENE, players: [...room.players.values()].map(pub), stats: statsPayload() });
  broadcast(room, { t: 'join', p: pub(p) }, p.id);
}
function leave(p) {
  const room = p.room; if (!room) return;
  room.players.delete(p.id);
  broadcast(room, { t: 'leave', id: p.id });
  if (!humansIn(room) && room.num > 1) rooms.delete(room.num);
  p.room = null;
}

function statsPayload() {
  let total = 0;
  const places = { shop: 0, street: 0 };
  for (const v of VISTAS) places['roof:' + v.id] = 0;
  for (const r of rooms.values()) for (const p of r.players.values()) { if (!human(p)) continue; total++; places[p.place] = (places[p.place] || 0) + 1; }
  if (stats.date !== today()) { stats.date = today(); stats.smoked = 0; }
  return { total, places, today: stats.smoked, shops: rooms.size };
}
let lastStats = '';
setInterval(() => {
  const s = JSON.stringify({ t: 'stats', stats: statsPayload() });
  if (s === lastStats) return;
  lastStats = s;
  for (const r of rooms.values()) for (const p of r.players.values()) if (p.ws.readyState === 1) p.ws.send(s);
}, 2000);

// ---------- 消息 ----------
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

function handle(p, m) {
  if (m.t === 'hello') {
    if (p.room) return;
    p.tz = num(m.tz, -840, 840) ?? 0;
    const tok = typeof m.token === 'string' && /^[a-z0-9]{16,40}$/i.test(m.token) ? m.token : null;
    const live = tok && [...rooms.values()].some((r) => [...r.players.values()].some((q) => q.token === tok)); // 同一个浏览器开了两个页面：第二个当新人
    p.token = tok && !live ? tok : crypto.randomUUID().replace(/-/g, '');
    const g = tok && !live ? ghosts.get(tok) : null; if (g) ghosts.delete(tok);
    p.custom = cleanName(m.name); // 玩家自己起的名字（存在他本地，每次连上带过来）
    p.did = idOk(m.did); p.sid = idOk(m.sid); p.t0 = Date.now();
    if (m.internal) markInternal(p.did);
    join(p, g);
    logEv(p, 'open', { dev: m.dev === 'm' ? 'm' : 'd', lang: String(m.lang || '').slice(0, 8), load: num(m.load, 0, 600000), ret: !!m.ret, resumed: !!g });
    return;
  }
  const room = p.room; if (!room) return;
  const fp = p.place !== 'shop';
  if (m.t === 'ev') { if (CLIENT_EV.has(m.e)) logEv(p, m.e, { v: num(m.v, -1e6, 1e6) ?? undefined }); return; }
  switch (m.t) {
    case 'place': {
      const to = String(m.to).startsWith('roof') ? 'roof:' + SCENE : String(m.to); // 上天台只能去当前场景的那个天台
      if (!isPlace(to) || to === p.place) return;
      if (p.cig) resetCig(p);
      p.pose = 'stand';
      p.place = to;
      p.slot = to === 'shop' ? -1 : freeSlot(room, to);
      const sp = SPAWN[to.startsWith('roof') ? 'roof' : to] || SPAWN.shop;
      p.x = sp[0] + (Math.random() - 0.5) * 0.6; p.y = sp[1] + (Math.random() - 0.5) * 0.6; p.r = sp[2];
      broadcast(room, { t: 'place', id: p.id, to, slot: p.slot, x: p.x, y: p.y, r: p.r });
      logEv(p, to === 'shop' ? 'to_shop' : 'to_roof');
      break;
    }
    case 'move': {
      // 3D 版：x/y 是地面上的坐标（米），r 是朝向；每个地方都能走
      const x = num(m.x, -60, 60), y = num(m.y, -60, 60), rr = num(m.r, -100, 100);
      if (x === null || y === null) return;
      p.x = x; p.y = y; if (rr !== null) p.r = rr;
      broadcast(room, { t: 'move', id: p.id, x, y, r: p.r }, p.id);
      break;
    }
    case 'take': {   // 3D 版暂时没有店，天台上也能拿
      if (m.kind === 'pack' && CIG[m.id]) p.pack = { id: m.id, n: PACK_SIZE };
      else if (m.kind === 'item' && ITEM[m.id]) p.item = m.id;
      else if (m.kind === 'drop') p.item = null;
      else return;
      if (m.kind !== 'drop') logEv(p, m.kind === 'pack' ? 'pack' : 'item', { id: m.id });
      broadcast(room, { t: 'gear', id: p.id, ...gear(p) });
      break;
    }
    case 'act': {
      const a = m.a;
      if (!ACTS.has(a)) return;
      if (a === 'sip' || a === 'open') { if (!p.item) return; broadcast(room, { t: 'act', id: p.id, a }, p.id); return; } // 吃喝、拆包装
      if (a === 'cough') { broadcast(room, { t: 'act', id: p.id, a }, p.id); return; } // 呛到了，别人能看到捂胸口
      if (!fp) return;
      const out = { t: 'act', id: p.id, a };
      if (a === 'draw') {
        if (p.cig) return;
        if (p.loose.length) p.brand = p.loose.shift();
        else if (p.pack && p.pack.n > 0) { p.pack.n--; p.brand = p.pack.id; }
        else return;
        p.cig = 1; p.burn = 0; p.ash = 0;
        out.brand = p.brand;
        logEv(p, 'draw');
        broadcast(room, out);   // 自己也要收到，用来确认拿到了哪根
        broadcast(room, { t: 'gear', id: p.id, ...gear(p) });
        return;
      }
      if (a === 'flick') { if (p.cig !== 1) return; out.ok = !!m.ok; if (out.ok) { p.cig = 2; logEv(p, 'lit', { self: 1 }); } }
      if (a === 'puff' || a === 'ash') { if (p.cig !== 2) return; }
      if (a === 'puff') logEv(p, 'puff');
      if (a === 'ash') p.ash = 0;
      if (a === 'exhale') { out.amt = num(m.amt, 0, 1) ?? 0.5; out.choke = !!m.choke; } // choke：这口呛到了，不吐，烟跟着咳嗽出来
      if (a === 'stub') { if (!p.cig) return; logEv(p, 'stub', { burn: Math.round(p.burn * 100) }); if (p.cig === 2 && p.burn > 0.15 && human(p)) bumpSmoked(); resetCig(p); }
      broadcast(room, out, p.id);
      break;
    }
    case 'sync': {
      if (p.cig !== 2) return;
      p.burn = num(m.burn, 0, 1) ?? p.burn;
      p.ash = num(m.ash, 0, 1) ?? p.ash;
      broadcast(room, { t: 'sync', id: p.id, burn: p.burn, ash: p.ash }, p.id);
      break;
    }
    case 'rename': {
      // 起名字 / 改名字：random 就摇一个新的随机名；自己写的最多 12 个字，去掉控制字符和尖括号
      if (m.random) { Object.assign(p, newName()); p.custom = null; }
      else { const n = cleanName(m.name); if (!n) return; p.name = n; p.nameEn = n; p.custom = n; }
      broadcast(room, { t: 'rename', id: p.id, name: p.name, nameEn: p.nameEn });
      break;
    }
    case 'pose': {
      // stand 站着 / sit 坐（沙发、躺椅边、草坪）/ lie 躺（躺椅、草坪、踢烟灰桶的彩蛋）；y 是坐垫或躺椅的高度
      const v = ['stand', 'sit', 'lie'].includes(m.v) ? m.v : 'stand';
      if (!fp && v !== 'stand') return;
      p.pose = v; p.seatY = v === 'stand' ? 0 : (num(m.y, 0, 1.2) ?? 0);
      broadcast(room, { t: 'pose', id: p.id, v, y: p.seatY }, p.id);
      break;
    }
    case 'ask': {
      // 跟别人要根烟（kind: cig）或借个火（kind: fire）：对方 8 秒内选给或不给
      // 借火：自己手里得有根没点的烟，两人得走近（1.6 米内）；对方点「给他点」后用打火机点（他火机坏了又正抽着烟，就烟头对烟头）
      const o = room.players.get(String(m.to)), kind = m.kind === 'fire' ? 'fire' : 'cig';
      if (!o || o === p || o.place !== p.place || p.place === 'shop') return; // 小卖部大家都看得到，但要烟借火只在天台上
      if (o.asks.has(p.id)) return;
      if (kind === 'cig') {
        const has = (o.pack && o.pack.n > 0) || o.loose.length;
        if (!has) { send(p.ws, { t: 'refused', from: o.id, to: p.id, kind, why: 'empty' }); return; }
      } else {
        if (p.cig !== 1 || Math.hypot(p.x - o.x, p.y - o.y) > FIRE_REACH) return;
      }
      const timer = setTimeout(() => { o.asks.delete(p.id); broadcast(room, { t: 'refused', from: o.id, to: p.id, kind, why: 'timeout' }); send(o.ws, { t: 'askGone', from: p.id }); }, ASK_TIMEOUT);
      o.asks.set(p.id, { timer, kind });
      logEv(p, 'ask', { kind, npc: o.npc ? 1 : 0 }); logEv(o, 'asked', { kind });
      send(o.ws, { t: 'ask', from: p.id, kind });
      broadcast(room, { t: 'asked', from: p.id, to: o.id, kind }); // 大家都能看到他伸手要
      break;
    }
    case 'answer': {
      const req = room.players.get(String(m.to));
      const pend = p.asks.get(String(m.to));
      if (!pend) return;
      clearTimeout(pend.timer); p.asks.delete(String(m.to));
      if (!req) return;
      const kind = pend.kind;
      logEv(req, 'answered', { kind, give: m.give ? 1 : 0, npc: p.npc ? 1 : 0 }); logEv(p, 'answer', { kind, give: m.give ? 1 : 0 });
      if (!m.give) { broadcast(room, { t: 'refused', from: p.id, to: req.id, kind, why: m.why === 'nofire' ? 'nofire' : 'no' }); return; }
      if (kind === 'fire') {
        if (req.cig !== 1) return;
        const how = m.how === 'tip' && p.cig === 2 ? 'tip' : 'lighter';
        req.cig = 2;
        broadcast(room, { t: 'lit', from: p.id, to: req.id, how }); // 两边播点火动画，播完烟就点着了
        return;
      }
      let brand = null;
      if (p.loose.length) brand = p.loose.shift();
      else if (p.pack && p.pack.n > 0) { p.pack.n--; brand = p.pack.id; }
      if (!brand) { broadcast(room, { t: 'refused', from: p.id, to: req.id, kind, why: 'empty' }); return; }
      if (req.loose.length < LOOSE_MAX) req.loose.push(brand);
      broadcast(room, { t: 'gave', from: p.id, to: req.id, brand });
      broadcast(room, { t: 'gear', id: p.id, ...gear(p) });
      broadcast(room, { t: 'gear', id: req.id, ...gear(req) });
      break;
    }
  }
}

// ---------- HTTP ----------
const MIME = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.end('ok'); return; }
  let file, base = DIST, rel = url.pathname;
  if (rel === '/2d') { res.writeHead(301, { location: '/2d/' }).end(); return; }
  if (rel.startsWith('/2d/')) { base = LEGACY; rel = rel.slice(3); }
  try { file = path.normalize(path.join(base, decodeURIComponent(rel))); } catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('没有这个页面'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
const conns = new WeakMap();
wss.on('connection', (ws) => {
  const p = {
    id: String(nextId++), ...newName(), look: randLook(), tz: 0, ws, room: null,
    item: null, pack: null, loose: [], asks: new Map(), cig: 0, brand: null, burn: 0, ash: 0,
    alive: true, tokens: 30, last: Date.now(),
  };
  conns.set(ws, p);
  ws.on('pong', () => { p.alive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    p.tokens = Math.min(30, p.tokens + ((now - p.last) / 1000) * 15);
    p.last = now;
    if (p.tokens < 1) return;
    p.tokens--;
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg && typeof msg === 'object') { if (msg.t !== 'sync') p.lastAct = now; handle(p, msg); } // sync 是抽着烟时自动发的，不算「在动」
  });
  ws.on('close', () => { for (const t of p.asks.values()) clearTimeout(t.timer); if (!closing) { logEv(p, 'leave', { dur: p.t0 ? Date.now() - p.t0 : 0, idle: p.kicked ? 1 : undefined }); saveGhost(p); } leave(p); });
});
// 发呆太久（10 分钟没走动、没任何操作，比如网页开着人走了）：请出去，别人那边就不会一直站着个不动的人；他回来点一下就按原样续上
const IDLE_MS = (Number(process.env.IDLE_MIN) || 10) * 60 * 1000; // IDLE_MIN 可调（测试用）
setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) { const p = conns.get(ws); if (p && p.room && !p.kicked && now - (p.lastAct || p.t0 || now) > IDLE_MS) { p.kicked = true; send(ws, { t: 'idle' }); setTimeout(() => ws.close(4000, 'idle'), 200); } }
}, 30000);
setInterval(() => {
  for (const ws of wss.clients) {
    const p = conns.get(ws); if (!p) continue;
    if (!p.alive) { ws.terminate(); continue; }
    p.alive = false; ws.ping();
  }
}, 30000);

// HOST：线上设成 127.0.0.1，只让本机的 Cloudflare 隧道连进来；不设就监听所有网卡（开发用）
const HOST = process.env.HOST || undefined;
server.listen(PORT, HOST, () => console.log(`抽根烟 已启动：http://${HOST || 'localhost'}:${PORT}`));

// ---------- 测试用的热心路人 ----------
// 一个服务器自己跑的假玩家：平时在自己那块地方待着；看到你在同一个地方、它又想要了，才走过来跟你要根烟 / 借个火（两样轮流）；
// 你不给（或者不理），它就走回原处，半分钟内不再来烦你；给了就在原地抽完。你跟它要什么它都给。
// BOT=1 才开（默认关）。
const BOT_ON = process.env.BOT === '1'; // 只在 BOT=1 时开（天台上已经有常驻的假人了）
if (BOT_ON) startBot();
function startBot() {
  const ids = Object.keys(CIG);
  const bot = {
    id: 'bot', name: '热心的路人', nameEn: 'Friendly Stranger', look: randLook(), tz: 480, room: null, bot: true,
    item: null, pack: null, loose: [], asks: new Map(), cig: 0, brand: null, burn: 0, ash: 0,
  };
  // state：idle 在原处待着 / go 走过去要 / wait 开口了等回音 / home 被拒后走回原处 / smoke 原地抽烟
  const B = { state: 'idle', next: Date.now() + 5000, until: 0, home: null, tgt: null, mode: 'cig', puffAt: 0, placeAt: 0 };
  const act = (m) => handle(bot, m);
  const refill = () => {
    if (bot.pack && bot.pack.n > 0) return;
    bot.pack = { id: pick(ids.length ? ids : ['red']), n: PACK_SIZE };
    broadcast(bot.room, { t: 'gear', id: bot.id, ...gear(bot) });
  };
  const goHome = (rest) => { B.state = 'home'; B.tgt = null; B.next = Date.now() + rest; };
  bot.ws = {
    readyState: 1,
    send(data) {
      let m; try { m = JSON.parse(data); } catch { return; }
      if (m.t === 'ask') { // 有人跟他要：一秒左右后答应
        setTimeout(() => { if (bot.asks.has(m.from)) act({ t: 'answer', to: m.from, give: true, how: 'lighter' }); }, 800 + Math.random() * 700);
        return;
      }
      if (m.to !== bot.id) return;
      if (m.t === 'gave') { // 要到烟：叼上，接着跟同一个人借火
        setTimeout(() => { if (!bot.cig) act({ t: 'act', a: 'draw' }); B.state = 'go'; B.until = Date.now() + 8000; B.next = Date.now() + 1200; }, 1600);
      } else if (m.t === 'lit') { B.state = 'smoke'; B.tgt = null; B.puffAt = Date.now() + 2500; }
      else if (m.t === 'refused') { // 不给 / 没人理 / 对方没烟：走回去，过一阵再说
        B.mode = B.mode === 'cig' ? 'fire' : 'cig';
        goHome(m.why === 'empty' ? 15000 : 30000 + Math.random() * 15000);
      }
    },
  };
  handle(bot, { t: 'hello', tz: 480 });
  refill();

  const step = (tx, tz, stop, speed, dt) => { // 朝 (tx,tz) 走到离它 stop 米；到了返回 true
    const dx = tx - bot.x, dz = tz - bot.y, d = Math.hypot(dx, dz);
    if (d <= stop + 0.02) return true;
    const s = Math.min(d - stop, speed * dt);
    act({ t: 'move', x: bot.x + (dx / d) * s, y: bot.y + (dz / d) * s, r: Math.atan2(-dx, -dz) });
    return false;
  };
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = Math.min(0.3, (now - last) / 1000); last = now;
    const room = bot.room; if (!room) return;
    const humans = [...room.players.values()].filter((q) => !q.bot);
    if (!humans.length) return;
    const here = humans.filter((q) => q.place === bot.place);
    // 一个人都不在这儿：过几秒换到最近进来的那个人所在的地方（测试用，不然找不到它），到了先在楼梯口待着
    if (!here.length) {
      const to = humans[humans.length - 1].place;
      if (!B.placeAt) B.placeAt = now + 3000;
      if (now > B.placeAt && to !== bot.place) { B.placeAt = 0; act({ t: 'place', to }); B.home = { x: bot.x, z: bot.y }; B.state = 'idle'; B.tgt = null; B.next = Math.max(B.next, now + 4000); }
      return;
    }
    B.placeAt = 0;
    if (!B.home) B.home = { x: bot.x, z: bot.y };
    refill();
    const near = (q) => Math.hypot(q.x - bot.x, q.y - bot.y);
    const tgt = B.tgt && here.find((q) => q.id === B.tgt);
    // 有人贴得太近（比如一起刚上楼）：往旁边让一点
    const close = here.find((q) => near(q) < 0.7);
    if (close && B.state !== 'wait') { const dx = bot.x - close.x, dz = bot.y - close.y, d = Math.hypot(dx, dz) || 1; act({ t: 'move', x: bot.x + (dx / d) * 0.9 * dt, y: bot.y + (dz / d) * 0.9 * dt, r: bot.r }); }

    if (B.state === 'smoke') { // 原地抽：七八秒嘬一口，抽到头掐掉，然后回原处歇一会儿
      if (bot.cig !== 2) { goHome(30000); return; }
      if (now > B.puffAt) {
        B.puffAt = now + 7000 + Math.random() * 3000;
        act({ t: 'act', a: 'puff' });
        setTimeout(() => {
          if (bot.cig !== 2) return;
          act({ t: 'act', a: 'exhale', amt: 0.5 + Math.random() * 0.3 });
          act({ t: 'sync', burn: Math.min(1, bot.burn + 0.08), ash: Math.min(1, bot.ash + 0.1) });
          if (bot.burn >= 0.85) setTimeout(() => { act({ t: 'act', a: 'stub' }); B.mode = B.mode === 'cig' ? 'fire' : 'cig'; goHome(30000); }, 1500);
        }, 1500);
      }
      return;
    }
    if (B.state === 'home') { if (step(B.home.x, B.home.z, 0.05, 1.1, dt)) B.state = 'idle'; return; }
    if (B.state === 'wait') { if (now > B.until) goHome(30000); return; } // 服务器 8 秒超时会发 refused；这是保险
    if (B.state === 'idle') {
      if (now < B.next) return;
      // 想要了：挑 6 米内最近的人走过去（太远就不去，免得满场追人）
      const cand = here.filter((q) => near(q) < 6).sort((x, y) => near(x) - near(y))[0];
      if (!cand) return;
      B.tgt = cand.id; B.state = 'go'; B.until = now + 10000;
      return;
    }
    if (B.state === 'go') {
      if (!tgt || now > B.until) { goHome(20000); return; } // 走了 10 秒还没走到（对方一直在走）：算了
      if (!step(tgt.x, tgt.y, 1.0, 1.2, dt) || now < B.next || tgt.asks.has(bot.id)) return;
      const fp = bot.place !== 'shop';
      if (bot.cig === 1) { if (fp) { B.state = 'wait'; B.until = now + 9500; act({ t: 'ask', to: tgt.id, kind: 'fire' }); } else goHome(20000); return; }
      const tgtHas = (tgt.pack && tgt.pack.n > 0) || tgt.loose.length;
      if (B.mode === 'cig' && tgtHas) { B.state = 'wait'; B.until = now + 9500; act({ t: 'ask', to: tgt.id, kind: 'cig' }); return; }
      if (fp) { act({ t: 'act', a: 'draw' }); B.next = now + 1500; return; } // 自己掏一根，下一拍借火
      goHome(20000);
    }
  }, 150);
  console.log('[测试] 热心的路人已上线（BOT=0 可关掉）');
}

// ---------- 天台上常驻的假人 ----------
// 每家店的天台上 6 个：2 个坐沙发、1 个躺躺椅、1 个站在栏杆边、2 个结伴面对面抽；平时自己一根接一根地抽（抽完歇一会儿）。小卖部里另有 2 个逛店的。
// 跟他们要烟、借火都会答应，但像真人一样慢半拍（1–3 秒）；其中一个（spot.stingy）有七成会拒绝给烟，借火照样给。
// 位置和天台上的座位一致（web/src/roof.js 的 seatSpot：沙发 x 4.8 / 5.8 / 6.8、z 2.2，躺椅 x -7.6 / -6.4、z 0.95）。
const NPC_SPOTS = [
  { pose: 'sit', x: 4.8, z: 2.2, r: 0, y: 0.46 },
  { pose: 'sit', x: 6.8, z: 2.2, r: 0, y: 0.46, stingy: true },
  { pose: 'lie', x: -7.6, z: 0.95, r: 0, y: 0.42 },
  { pose: 'stand', x: 1.9, z: -1.1, r: 0.25 },
  // 结伴的两个：一起走到天台某处面对面站着，一个掏烟、另一个拿打火机给他点（有时先跟对方要一根），各抽各的（长短随机），抽完换个地方再来
  { pose: 'stand', x: -1.5, z: 4.0, r: Math.PI, pair: 'a' },
  { pose: 'stand', x: -1.5, z: 4.9, r: 0, pair: 'b' },
  // 小卖部里两个逛店的：沿着货架通道走，停下来时转身对着货架挑一会儿（第三个数是停下时的朝向）；店里不抽烟、不互动
  { place: 'shop', pose: 'stand', x: -1.3, z: -1.6, r: Math.PI / 2, route: [[-1.3, -1.6, Math.PI / 2], [-1.3, 0.6, -Math.PI / 2], [-1.3, 2.4], [1.0, 2.4], [1.0, 0.4, Math.PI / 2], [1.0, -1.6, Math.PI / 2], [1.0, -2.75, 0], [-1.3, -2.75, 0]] },
  { place: 'shop', pose: 'stand', x: -3.0, z: -2.75, r: 0, route: [[-3.0, -2.75, 0], [0.8, -2.75, 0], [2.0, -2.75, 0], [2.2, 1.6, -Math.PI / 2], [2.2, 2.6], [-3.5, 2.6, Math.PI / 2], [-3.5, -0.8, Math.PI / 2], [-3.5, -2.75]] },
];
let nextNpc = 1;
function spawnNpcs(room) {
  for (const spot of NPC_SPOTS) {
    const n = {
      id: 'npc' + nextNpc++, ...newName(), look: randLook(), tz: 480, room, npc: true, spot,
      item: null, pack: null, loose: [], asks: new Map(), cig: 0, brand: null, burn: 0, ash: 0, pose: 'stand', seatY: 0, slot: -1,
      ai: { next: Date.now() + 2000 + Math.random() * 20000, puffAt: 0, busyUntil: 0, wp: 0, waitUntil: Date.now() + Math.random() * 6000 },
    };
    n.ws = {
      readyState: 1,
      send(data) {
        let m; try { m = JSON.parse(data); } catch { return; }
        if (m.t !== 'ask') return;
        // 有人来要：愣一下（1–3 秒）再答应；小气的那个多半不给烟
        n.ai.busyUntil = Date.now() + 9000;
        setTimeout(() => {
          if (!n.asks.has(m.from)) return;
          const no = m.kind === 'cig' && n.spot.stingy && Math.random() < 0.7;
          handle(n, { t: 'answer', to: m.from, give: !no, how: 'lighter' });
          n.ai.busyUntil = Date.now() + 4000;
        }, 1000 + Math.random() * 2000);
      },
    };
    room.players.set(n.id, n);
    seatNpc(n);
  }
}
function seatNpc(n) {
  const sp = n.spot;
  n.place = sp.place === 'shop' ? 'shop' : 'roof:' + SCENE; n.slot = n.place === 'shop' ? -1 : freeSlot(n.room, n.place);
  n.x = sp.x; n.y = sp.z; n.r = sp.r; n.pose = sp.pose; n.ai.wp = 0; n.seatY = sp.pose === 'stand' ? 0 : sp.y;
  if (!n.pack || n.pack.n <= 0) { const ids = Object.keys(CIG); n.pack = { id: pick(ids.length ? ids : ['red']), n: PACK_SIZE }; }
  broadcast(n.room, { t: 'join', p: pub(n) }); // 客户端按 id 更新（已经有了就覆盖）
}
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const watched = [...room.players.values()].some((q) => human(q) && q.place === 'roof:' + SCENE);
    for (const n of room.players.values()) {
      if (!n.npc || n.place === 'shop' || !watched || now < n.ai.busyUntil) continue; // 店里的不抽烟
      const act = (m) => handle(n, m), A = n.ai;
      if (!n.cig) {
        if (now < A.next) continue;
        if (n.spot.pair && !A.pairGo) continue; // 结伴的两个由下面的「结伴」逻辑决定什么时候掏烟
        if (!n.pack || n.pack.n <= 0) { n.pack = { id: n.pack?.id || pick(Object.keys(CIG)), n: PACK_SIZE }; broadcast(room, { t: 'gear', id: n.id, ...gear(n) }); }
        act({ t: 'act', a: 'draw' });
        A.pairGo = false;
        A.step = 0.04 + Math.random() * 0.1; A.gap = 5000 + Math.random() * 6000; // 每根烟长短不一：吸 7–25 口，每口间隔也随人随根变（大约 1–4 分钟一根）
        A.next = now + 1500; // 掏出来，过一下再点
        continue;
      }
      if (n.cig === 1) { if (A.waitFire) continue; if (now >= A.next) { act({ t: 'act', a: 'flick', ok: true }); A.puffAt = now + 2500; } continue; } // 等同伴点火的那个不自己点
      if (now < A.puffAt) continue;
      A.puffAt = now + (A.gap || 8000) * (0.7 + Math.random() * 0.6);
      act({ t: 'act', a: 'puff' });
      setTimeout(() => {
        if (n.cig !== 2) return;
        act({ t: 'act', a: 'exhale', amt: 0.45 + Math.random() * 0.35 });
        act({ t: 'sync', burn: Math.min(1, n.burn + (A.step || 0.09)), ash: Math.min(1, n.ash + 0.12) });
        if (n.ash > 0.6 && Math.random() < 0.5) act({ t: 'act', a: 'ash' });
        if (n.burn >= 0.9) setTimeout(() => { if (n.cig) { act({ t: 'act', a: 'stub' }); A.next = Date.now() + 15000 + Math.random() * 30000; } }, 1500);
      }, 1200 + Math.random() * 1000);
    }
  }
}, 400);

// 走动的假人：150 毫秒走一步（约 0.8 米 / 秒），到点停 4–10 秒；有人跟他要东西时站住不走
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const here = new Set([...room.players.values()].filter(human).map((q) => q.place)); // 有真人在的地方，假人才动
    for (const n of room.players.values()) {
      if (!n.npc || !n.spot.route || now < n.ai.busyUntil || now < n.ai.waitUntil || !here.has(n.place)) continue;
      const route = n.spot.route, [tx, tz, face] = route[(n.ai.wp + 1) % route.length];
      const dx = tx - n.x, dz = tz - n.y, d = Math.hypot(dx, dz), st = 0.8 * 0.15;
      if (d <= st) { handle(n, { t: 'move', x: tx, y: tz, r: face ?? n.r }); n.ai.wp = (n.ai.wp + 1) % route.length; n.ai.waitUntil = now + (face !== undefined ? 4000 + Math.random() * 6000 : 300); continue; } // 停在货架前就转身挑一会儿，拐角处不停
      handle(n, { t: 'move', x: n.x + (dx / d) * st, y: n.y + (dz / d) * st, r: Math.atan2(-dx, -dz) });
    }
  }
}, 150);

// ---------- 结伴的两个假人 ----------
// 走到下面某个碰头点面对面站好 → 一个掏烟自己点上，另一个掏烟跟他借火（三成先跟他要一根）→ 两人各抽各的 → 都抽完了歇一会儿，换个碰头点
const MEET = [[[-1.5, 4.0], [-1.5, 4.9]], [[2.6, 6.2], [3.5, 6.2]], [[-3.0, -0.6], [-2.1, -0.6]], [[0.6, 8.7], [0.6, 7.8]], [[-4.2, 7.0], [-3.3, 7.0]]];
const faceTo = (from, to) => Math.atan2(-(to.x - from.x), -(to.y - from.y));
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const a = [...room.players.values()].find((n) => n.npc && n.spot.pair === 'a'), b = [...room.players.values()].find((n) => n.npc && n.spot.pair === 'b');
    if (!a || !b || a.place !== 'roof:' + SCENE || b.place !== a.place) continue;
    if (![...room.players.values()].some((q) => human(q) && q.place === a.place)) continue;
    const P = room.pair || (room.pair = { st: 'rest', until: now + 3000, meet: 0 });
    if (P.st === 'rest') {
      if (now < P.until || a.cig || b.cig) continue;
      let k = Math.floor(Math.random() * MEET.length); if (k === P.meet) k = (k + 1) % MEET.length;
      P.meet = k; P.st = 'walk'; P.until = now + 40000; continue;
    }
    if (P.st === 'walk') {
      let done = 0;
      for (const [n, tgt] of [[a, MEET[P.meet][0]], [b, MEET[P.meet][1]]]) {
        if (now < n.ai.busyUntil) continue;
        const dx = tgt[0] - n.x, dz = tgt[1] - n.y, d = Math.hypot(dx, dz), st = 0.8 * 0.3;
        if (d <= 0.02) { done++; continue; }
        if (d <= st) handle(n, { t: 'move', x: tgt[0], y: tgt[1], r: n.r });
        else handle(n, { t: 'move', x: n.x + (dx / d) * st, y: n.y + (dz / d) * st, r: Math.atan2(-dx, -dz) });
      }
      if (done === 2 || now > P.until) {
        handle(a, { t: 'move', x: a.x, y: a.y, r: faceTo(a, b) }); handle(b, { t: 'move', x: b.x, y: b.y, r: faceTo(b, a) }); // 面对面
        const giver = Math.random() < 0.5 ? a : b, taker = giver === a ? b : a;
        P.giver = giver.id; P.taker = taker.id; P.st = 'start'; P.until = now + 1500 + Math.random() * 2000;
      }
      continue;
    }
    const giver = P.giver === a.id ? a : b, taker = giver === a ? b : a;
    if (P.st === 'start') {
      if (now < P.until) continue;
      giver.ai.pairGo = true; giver.ai.next = 0; // 他掏烟、自己点上
      taker.ai.waitFire = true;
      if (Math.random() < 0.3 && !taker.cig) { handle(taker, { t: 'ask', to: giver.id, kind: 'cig' }); taker.ai.next = now + 6000; } // 先跟同伴要一根（同伴 1–3 秒后给）
      else taker.ai.next = now + 2500;
      taker.ai.pairGo = true;
      P.st = 'light'; P.until = now + 30000; continue;
    }
    if (P.st === 'light') {
      if (giver.cig === 2 && taker.cig === 1 && !giver.asks.has(taker.id) && now > (P.askedAt || 0) + 12000) { handle(taker, { t: 'ask', to: giver.id, kind: 'fire' }); P.askedAt = now; }
      if (taker.cig === 2) { taker.ai.waitFire = false; taker.ai.puffAt = now + 3000; P.st = 'smoke'; P.until = now + 8 * 60000; }
      else if (now > P.until) { taker.ai.waitFire = false; P.st = 'smoke'; P.until = now + 8 * 60000; } // 借不着就自己点
      continue;
    }
    if (P.st === 'smoke') {
      if (now > P.until) { a.ai.pairGo = b.ai.pairGo = false; a.ai.waitFire = b.ai.waitFire = false; } // 保险：卡住了就收场
      if (!a.cig && !b.cig && !a.ai.pairGo && !b.ai.pairGo) { P.st = 'rest'; P.until = now + 10000 + Math.random() * 20000; P.askedAt = 0; }
    }
  }
}, 300);
