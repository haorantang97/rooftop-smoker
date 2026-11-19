// 打正式版发布包：先 vite build，再去掉不用上线的东西，打成一个 tar.gz 交给服务器
// 用法：npm run release → .tmp/release/smoke-break.tgz
// 包里：server.js、package.json / package-lock.json、public/（2D 旧版和前后端共用的 data.js、sound.js）、
//       dist/（3D 版，已去掉 Gemini 原图）、web/public/catalog/*.json（服务器读烟和饮料目录）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });

// 先把 Gemini 新画的原图压成像素画（没变的会跳过），免得发布包里还是旧图
run('node', ['scripts/build-catalog.mjs']);
run('npx', ['vite', 'build', '--logLevel', 'warn']);

// Gemini 的原图（catalog/cig、drink、snack 下的大 PNG）不上线：游戏用的是 gen/ 里的像素画
for (const d of ['cig', 'drink', 'snack']) fs.rmSync(path.join(ROOT, 'dist', 'catalog', d), { recursive: true, force: true });

const OUT = path.join(ROOT, '.tmp', 'release');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const jsons = fs.readdirSync(path.join(ROOT, 'web/public/catalog')).filter((f) => f.endsWith('.json')).map((f) => `web/public/catalog/${f}`);
// --no-xattrs + COPYFILE_DISABLE：别把 macOS 的扩展属性打进去（Linux 上解包会刷一屏警告）
run('tar', ['-czf', path.join(OUT, 'smoke-break.tgz'), '--no-xattrs', '--exclude', '.DS_Store', 'server.js', 'package.json', 'package-lock.json', 'public', 'dist', 'deploy/setup-vm.sh', 'scripts/set-scene.mjs', 'scripts/analytics.mjs', ...jsons], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
const mb = (f) => (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(1);
// 补丁包：去掉不常变的贴图和模型（dist/assets/tex、models，占了二十多 MB），更新上线一般传这个就够
// 云主机上：sudo tar -xzf smoke-break-patch.tgz -C /opt/smoke-break && sudo chown -R smoke:smoke /opt/smoke-break && sudo systemctl restart smoke-break
// 只上线当前要推的风景：其余风景的模型（dist/vista-models/<id>）先不传，要推哪套时用 --vistas hokkaido,wilds 带上
const keepVistas = (process.argv.find((a) => a.startsWith('--vistas=')) || '').slice(9).split(',').filter(Boolean);
const vistaEx = fs.existsSync(path.join(ROOT, 'dist/vista-models')) ? fs.readdirSync(path.join(ROOT, 'dist/vista-models')).filter((d) => !keepVistas.includes(d)).flatMap((d) => ['--exclude', `dist/vista-models/${d}`]) : [];
run('tar', ['-czf', path.join(OUT, 'smoke-break-patch.tgz'), '--no-xattrs', '--exclude', '.DS_Store', '--exclude', 'dist/assets/tex', '--exclude', 'dist/assets/models', ...vistaEx, 'server.js', 'package.json', 'package-lock.json', 'public', 'dist', 'deploy/setup-vm.sh', 'scripts/set-scene.mjs', 'scripts/analytics.mjs', ...jsons], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
for (const f of ['smoke-break.tgz', 'smoke-break-patch.tgz']) fs.copyFileSync(path.join(OUT, f), path.join(ROOT, 'output', f)); // 给用户上传的放 output/
console.log(`发布包：.tmp/release/smoke-break.tgz（${mb('smoke-break.tgz')} MB，第一次装用）、smoke-break-patch.tgz（${mb('smoke-break-patch.tgz')} MB，更新用）`);
