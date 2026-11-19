// 把 Gemini 产出的资产图（web/public/catalog/，大 PNG）做成游戏用的像素画 PNG，放到 web/public/gen/
// 做法：先缩成很小的像素格（烟盒高 56 格、饮料标签 104×52、零食高 64 格），再按整数倍最近邻放大，
// 真实包装上的细字会变成色块（规避直接照搬），烟柜缩略图和 3D 贴图看到的都是清晰的像素块
// 用法：npm run catalog（只处理新的或改过的图）；用 ffmpeg（brew 装的那个）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAT = path.join(ROOT, 'web/public/catalog');
const OUT = path.join(ROOT, 'web/public/gen');

// [JSON 文件, 图片字段, 输出子目录, 像素格（宽:高，-1 按比例）, 放大倍数]
const JOBS = [
  ['cigarettes.json', 'front', 'cig', '-2:56', 5],
  ['drinks.json', 'label', 'drink', '104:52', 5],
  ['snacks.json', 'front', 'snack', '-2:64', 5],
];

let made = 0, skipped = 0, missing = 0;
for (const [file, field, dir, grid, up] of JOBS) {
  const p = path.join(CAT, file);
  if (!fs.existsSync(p)) continue;
  let list; try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.warn(`读不了 ${file}：${e.message}`); continue; }
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const e of list) {
    const src = e.images?.[field] && path.join(CAT, e.images[field]);
    if (!src || !fs.existsSync(src)) { missing++; continue; }
    const dst = path.join(OUT, dir, `${e.id}.png`);
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) { skipped++; continue; }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `scale=${grid}:flags=area,scale=iw*${up}:ih*${up}:flags=neighbor`, dst], { stdio: 'ignore' });
    made++;
  }
}
console.log(`压好 ${made} 张，跳过没变的 ${skipped} 张，缺图 ${missing} 条 → web/public/gen/`);
