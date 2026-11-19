# Rooftop Smoker · 抽根烟

A tiny anonymous multiplayer game: a late-night convenience store with a rooftop. Walk in, grab a pack, head upstairs and share a smoke with strangers — bum a cigarette, ask for a light, watch the city. No tobacco, no nicotine, just pixels.

一个匿名的多人小游戏：深夜便利店，楼顶有天台。进店挑一包烟，上楼跟陌生人一起抽一根——要根烟、借个火、看看风景。

**Play / 在线玩：** https://smokersontheroof.top

## What's inside / 有什么

- First-person 3D (Three.js) with a pixel-art post filter; works on desktop (WASD + mouse) and phones (left stick + drag).
- A store with ~400 cigarette packs from around the world and ~100 snacks; a rooftop with switchable vistas (Miami neon, sea, Hokkaido, wilds, countryside, NYC).
- Real-time multiplayer over WebSocket: ask someone for a cigarette or a light, they accept or refuse, and both sides play the hand-off / lighting animation.
- Rooftop NPCs who smoke on their own, sit, lie down, and a pair who meet up and light each other's cigarettes.
- 16 UI languages (auto by browser language, or `?lang=ja` etc.).
- Anonymous, self-hosted analytics (funnel / drop-off / retention) — no IPs, no names.

## Run locally / 本地运行

```bash
npm install
npm run assets     # download third-party models/textures into web/public/assets
npm run catalog    # build the pixel-art pack/snack images into web/public/gen
npm run server     # game server on :8790
npm run dev        # front end on :5190 (proxies /ws to the server)
```

Then open http://localhost:5190.

Production: `npm run release` builds `dist/` and a tarball; `server.js` serves both the static site and the WebSocket. Switch the global rooftop vista with `node scripts/set-scene.mjs miami`.

## Layout / 目录

| Path | What |
| --- | --- |
| `server.js` | Static server + WebSocket game state, NPCs, reconnect/resume, analytics log |
| `web/src/` | Three.js client: scenes, people, first-person hands, cigarette, smoke, UI, i18n |
| `public/js/` | Data shared by server and client (catalog adapters, items, sound) |
| `web/public/catalog/` | Cigarette / drink / snack catalog JSON and the full-size front images |
| `web/public/vista-models/` | Rooftop vista models |
| `scripts/` | Asset generation (Gemini), catalog builder, release, analytics report, Blender modeling scripts |
| `docs/` | Briefs and AI-generated reference images used to make the assets |

## Notes / 说明

- Pack and snack artwork was generated with an image model to look like real retail packaging, for a non-commercial hobby project. All trademarks belong to their owners. If you own a mark and want something removed, open an issue.
- Asset generation scripts need your own `GEMINI_API_KEY` in `.env` (see `.env.example`); keys are never committed.
- Smoking harms your health. In real life, smoke less if you can. 吸烟有害健康，现实里能少抽就少抽。
