// 测试用机器人：连进房间，上天台站在指定位置，循环做 抽烟 / 喝 / 咳嗽，方便看别人眼里的样子
// 用法：node scripts/bot.mjs 4.6,3.6,3.14（x,z,朝向）；按 Ctrl+C 或 pkill -f scripts/bot.mjs 停
import WebSocket from 'ws';
const [x, z, r] = (process.argv[2] || '4.6,3.6,3.14').split(',').map(Number);
const ws = new WebSocket('ws://localhost:8790/ws');
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
ws.on('open', async () => {
  send({ t: 'hello', tz: 480 }); await wait(400);
  send({ t: 'take', kind: 'pack', id: 'jp-hokumei-frost-capsule' }); send({ t: 'take', kind: 'item', id: 'cola' });
  send({ t: 'place', to: 'roof:sea' }); await wait(600);
  // 第三个参数写 walk：沿 x 来回走 3 米（看走路动作）
  if (process.argv[3] === 'walk') { let t0 = Date.now(); setInterval(() => { const t = (Date.now() - t0) / 1000, ph = (t % 6) / 6, dir = ph < 0.5 ? 1 : -1, d = ph < 0.5 ? ph * 2 : 2 - ph * 2; send({ t: 'move', x: x + d * 3, y: z, r: dir > 0 ? -Math.PI / 2 : Math.PI / 2 }); }, 100); }
  else setInterval(() => send({ t: 'move', x, y: z, r }), 1000);
  const pose = process.argv[3]; if (pose && pose !== 'walk') { const [v, y] = pose.split(':'); send({ t: 'pose', v, y: Number(y) || 0 }); } // 例如 sit:0.46 / lie:0.42
  for (;;) {
    send({ t: 'take', kind: 'pack', id: 'jp-hokumei-frost-capsule' }); // 每轮补一包，免得抽光
    send({ t: 'act', a: 'draw' }); await wait(1200);
    send({ t: 'act', a: 'flick', ok: true }); await wait(1500);
    for (let i = 0; i < 2; i++) { send({ t: 'act', a: 'puff' }); await wait(2200); send({ t: 'act', a: 'exhale', amt: 0.9 }); await wait(3000); }
    send({ t: 'act', a: 'sip' }); await wait(2500);
    if (Math.random() < 0.08) { send({ t: 'act', a: 'cough' }); await wait(3000); } // 跟玩家一样很少咳
    send({ t: 'act', a: 'stub' }); await wait(1500);
  }
});
