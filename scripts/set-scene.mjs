// 换天台场景（全世界统一）：node scripts/set-scene.mjs nyc   可选 sea / nyc / hokkaido / wilds / inaka / miami
// 写进 data/scene.json，正在跑的服务器 5 秒内读到，所有在天台上的人一起换过去
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const IDS = ['sea', 'nyc', 'hokkaido', 'wilds', 'inaka', 'miami'];
const v = process.argv[2];
if (!IDS.includes(v)) { console.error(`用法：node scripts/set-scene.mjs <${IDS.join(' | ')}>`); process.exit(1); }
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'scene.json'), JSON.stringify({ vista: v }));
console.log(`场景换成 ${v}（服务器 5 秒内生效）`);
