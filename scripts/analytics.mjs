// 匿名统计报告：读 data/events/*.jsonl（server.js 写的埋点），算漏斗（每一步还剩多少人）、卡点（最后停在哪一步离开）、留存（第二天 / 第七天还回来的设备）
// 用法：node scripts/analytics.mjs [天数，默认 7] [数据目录，默认 data/events]
// 云主机上：cd /opt/smoke-break && node scripts/analytics.mjs 7
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAYS = Number(process.argv[2]) || 7;
const DIR = path.resolve(ROOT, process.argv[3] || 'data/events');
if (!fs.existsSync(DIR)) { console.log(`还没有数据：${DIR}`); process.exit(0); }

const day = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).sort().slice(-Math.max(DAYS, 8) - 1);
const evs = [];
for (const f of files) for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) { if (!line) continue; try { evs.push(JSON.parse(line)); } catch {} }
// 去掉自己人的设备（data/internal.json，打开过 ?internal=1 的设备），连标记之前的记录也去掉
let internal = new Set(); try { internal = new Set(JSON.parse(fs.readFileSync(path.join(DIR, '..', 'internal.json'), 'utf8'))); } catch {}
for (let i = evs.length - 1; i >= 0; i--) if (internal.has(evs[i].d)) evs.splice(i, 1);
evs.sort((a, b) => a.t - b.t);
const since = Date.now() - DAYS * 86400000, recent = evs.filter((e) => e.t >= since);

// ---------- 会话：一次访问（刷新算同一次）----------
const sessions = new Map();
for (const e of recent) {
  if (!e.s) continue;
  let s = sessions.get(e.s);
  if (!s) sessions.set(e.s, (s = { id: e.s, d: e.d, t0: e.t, t1: e.t, ev: new Set(), dev: null, lang: null, load: null, ret: false, dur: 0, n: {} }));
  s.t1 = Math.max(s.t1, e.t); s.ev.add(e.e); s.n[e.e] = (s.n[e.e] || 0) + 1;
  if (e.e === 'open') { s.dev ??= e.dev; s.lang ??= e.lang; if (s.load === null && e.load != null && !e.resumed) s.load = e.load; s.ret ||= !!e.ret; }
  if (e.e === 'leave' || e.e === 'restart') s.dur += e.dur || 0;
}
const S = [...sessions.values()];

// 漏斗的每一步（按游戏里的顺序）。年龄确认 / 起名字只有第一次来、或新开网页时才有，所以「进门」用 enter 或后面任意一步都算
const has = (s, ...k) => k.some((x) => s.ev.has(x));
const STEPS = [
  ['打开网页', (s) => has(s, 'open')],
  ['过了年龄确认', (s) => has(s, 'age_ok', 'name_shown', 'name_done', 'enter', 'pack', 'to_roof', 'draw') || (has(s, 'open') && !has(s, 'gate', 'age_minor'))],
  ['进门（起好名字）', (s) => has(s, 'enter', 'pack', 'to_roof', 'draw')],
  ['拿了一包烟', (s) => has(s, 'pack')],
  ['上了天台', (s) => has(s, 'to_roof')],
  ['抽出一根', (s) => has(s, 'draw')],
  ['点着了', (s) => has(s, 'lit')],
  ['吸了一口', (s) => has(s, 'puff')],
  ['跟人互动过（要 / 被要）', (s) => has(s, 'ask', 'asked')],
];
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) + '%' : '-');
const pad = (s, n) => { s = String(s); const w = [...s].reduce((k, c) => k + (c.charCodeAt(0) > 255 ? 2 : 1), 0); return s + ' '.repeat(Math.max(0, n - w)); };
const median = (a) => { const v = a.filter((x) => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
const fmtDur = (ms) => (ms == null ? '-' : ms < 60000 ? Math.round(ms / 1000) + ' 秒' : (ms / 60000).toFixed(1) + ' 分钟');

console.log(`\n抽根烟 · 最近 ${DAYS} 天（${day(since)} 起，北京时间）${internal.size ? `  ·  已去掉自己人设备 ${internal.size} 台` : ''}`);
const devs = new Set(S.map((s) => s.d));
console.log(`访问 ${S.length} 次，设备 ${devs.size} 台（新设备 ${S.filter((s) => !s.ret).length} 次访问）  ·  手机 ${S.filter((s) => s.dev === 'm').length} / 电脑 ${S.filter((s) => s.dev === 'd').length}`);
console.log(`加载用时（中位数）${median(S.map((s) => s.load)) != null ? (median(S.map((s) => s.load)) / 1000).toFixed(1) + ' 秒' : '-'}  ·  每次待多久（中位数）${fmtDur(median(S.map((s) => s.dur || null)))}`);
const langs = {}; for (const s of S) if (s.lang) langs[s.lang] = (langs[s.lang] || 0) + 1;
console.log('语言：' + Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  '));

console.log('\n漏斗（每一步还剩多少次访问）');
const base = S.filter(STEPS[0][1]).length;
let prev = base;
for (const [name, ok] of STEPS) { const n = S.filter(ok).length; console.log(`  ${pad(name, 26)}${String(n).padStart(5)}   占打开 ${pct(n, base).padStart(4)}   比上一步 ${pct(n, prev).padStart(4)}`); prev = n; }
const minors = S.filter((s) => has(s, 'age_minor')).length; if (minors) console.log(`  （选了未满 18 岁：${minors}）`);

// 卡点：离开前走到的最后一步
console.log('\n卡点（离开前最后走到哪一步）');
const ended = S.filter((s) => has(s, 'leave'));
const stuck = {};
for (const s of ended) { let last = '打开网页'; for (const [name, ok] of STEPS) if (ok(s)) last = name; if (has(s, 'age_minor')) last = '未满 18 岁'; stuck[last] = (stuck[last] || 0) + 1; }
for (const [k, v] of Object.entries(stuck).sort((a, b) => b[1] - a[1])) console.log(`  ${pad(k, 26)}${String(v).padStart(5)}   ${pct(v, ended.length)}`);

// 留存：设备第一次出现那天 = D0；之后第 1 天、第 7 天有没有再来
console.log('\n留存（按设备第一次来的那天分组）');
const firstDay = new Map(), activeDays = new Map();
for (const e of evs) { if (!e.d || e.e !== 'open') continue; const dd = day(e.t); if (!firstDay.has(e.d)) firstDay.set(e.d, dd); (activeDays.get(e.d) || activeDays.set(e.d, new Set()).get(e.d)).add(dd); }
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00+08:00'); t.setDate(t.getDate() + n); return day(t.getTime()); };
const cohorts = {};
for (const [d, f] of firstDay) (cohorts[f] ||= []).push(d);
const todayStr = day(Date.now());
console.log(`  ${pad('首次来', 12)}${'新设备'.padStart(6)}  ${'次日回来'.padStart(8)}  ${'7 天内又来'.padStart(9)}  ${'第 7 天回来'.padStart(9)}`);
for (const f of Object.keys(cohorts).sort().slice(-DAYS)) {
  const ids = cohorts[f], d1 = addDays(f, 1), d7 = addDays(f, 7);
  const r1 = ids.filter((d) => activeDays.get(d).has(d1)).length;
  const r7any = ids.filter((d) => [...activeDays.get(d)].some((x) => x > f && x <= d7)).length;
  const r7 = ids.filter((d) => activeDays.get(d).has(d7)).length;
  const show = (r, target) => (target > todayStr ? '还没到'.padStart(8) : `${r} (${pct(r, ids.length)})`.padStart(8));
  console.log(`  ${pad(f, 12)}${String(ids.length).padStart(6)}  ${show(r1, d1)}  ${show(r7any, addDays(f, 1))}  ${show(r7, d7)}`);
}

// 互动
const asks = recent.filter((e) => e.e === 'ask'), ans = recent.filter((e) => e.e === 'answered');
if (asks.length) console.log(`\n互动：发出请求 ${asks.length} 次（要烟 ${asks.filter((e) => e.kind === 'cig').length}、借火 ${asks.filter((e) => e.kind === 'fire').length}；对人机 ${asks.filter((e) => e.npc).length}），被答应 ${ans.filter((e) => e.give).length}、被拒 ${ans.filter((e) => !e.give).length}`);
console.log('');
