// 3D 版前端：web/ 是源码，构建到 dist/，开发时把 /ws 转发给 server.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  publicDir: 'public',
  cacheDir: '../.tmp/vite',
  server: { port: 5190, strictPort: true, fs: { allow: ['..'] }, proxy: { '/ws': { target: 'ws://localhost:8790', ws: true } } },
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000, target: 'es2022' }, // es2022：main.js 开头要 await 读资产目录
});
