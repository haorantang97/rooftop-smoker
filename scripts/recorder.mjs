// 本地录音页：http://localhost:5191 。只监听本机，录好的 WAV 存到项目的 sfx-src/（不打包进游戏）
// 用法：node scripts/recorder.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'sfx-src');
const PAGE = path.join(ROOT, 'scripts', 'recorder.html');
const PORT = 5191, MAX = 60 * 1024 * 1024;
fs.mkdirSync(OUT, { recursive: true });

const safe = (s) => String(s || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 60);

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return fs.createReadStream(PAGE).pipe(res);
  }
  // 已经录了哪些
  if (req.method === 'GET' && u.pathname === '/list') {
    const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.wav')).map((f) => ({ name: f.replace(/\.wav$/, ''), size: fs.statSync(path.join(OUT, f)).size }));
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files));
  }
  // 回放已存的文件
  if (req.method === 'GET' && u.pathname === '/file') {
    const f = path.join(OUT, safe(u.searchParams.get('name')) + '.wav');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res);
  }
  // 保存一条：POST /save?name=inhale-long-1，body 是 WAV
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = safe(u.searchParams.get('name'));
    if (!name) { res.writeHead(400); return res.end('bad name'); }
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX) { res.writeHead(413); res.end(); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') { res.writeHead(400); return res.end('not wav'); }
      fs.writeFileSync(path.join(OUT, name + '.wav'), buf);
      console.log('[录音] 存好', name + '.wav', Math.round(buf.length / 1024) + 'KB');
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, name }));
    });
    return;
  }
  // 录屏片段：游戏页面录下的画面，POST /clip?name=give&ext=webm|jpg 存到 .tmp/clips/<name>.<ext>（演示视频的中间产物；jpg 是逐帧）
  if (req.method === 'POST' && u.pathname === '/clip') {
    const name = safe(u.searchParams.get('name'));
    if (!name) { res.writeHead(400); return res.end('bad name'); }
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX) { res.writeHead(413); res.end(); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const dir = path.join(ROOT, '.tmp', 'clips'); fs.mkdirSync(dir, { recursive: true });
      const ext = u.searchParams.get('ext') === 'jpg' ? '.jpg' : '.webm';
      fs.writeFileSync(path.join(dir, name + ext), Buffer.concat(chunks));
      if (ext === '.webm') console.log('[录屏] 存好', name + ext, Math.round(n / 1024) + 'KB');
      res.writeHead(200, { 'access-control-allow-origin': '*' }); res.end('{}');
    });
    return;
  }
  // 删除一条（重录前清掉旧的）
  if (req.method === 'POST' && u.pathname === '/delete') {
    const f = path.join(OUT, safe(u.searchParams.get('name')) + '.wav');
    if (fs.existsSync(f)) fs.unlinkSync(f);
    res.writeHead(200); return res.end('{}');
  }
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`录音页：http://localhost:${PORT}  → 存到 ${OUT}`));
