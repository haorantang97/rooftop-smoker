// 声音：大部分现场合成；咳嗽（CC0 录音）和抽烟的嘬、吸、吐（项目自己录的）用真人录音（web/public/sfx/），没加载好时退回合成
// 抽烟的真人录音（项目自己录的，原文件在 sfx-src/，用 npm run rec 录）：
// drag 长吸一口 3.3–3.75 秒（按住就从头播，够到 3.6 秒吸到上限的咳嗽，松开淡出）；lung 嘬完吸进肺里；exhale 吐气 1.4–3.5 秒
const REAL = { drag: ['drag1', 'drag2', 'drag3'], lung: ['lung1', 'lung2', 'lung3'], exhale: ['exhale1', 'exhale2', 'exhale3', 'exhale4', 'exhale5'] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const Snd = {
  ac: null, master: null, white: null, brown: null, amb: [], inhale: null, on: true,
  init(on) {
    if (on !== undefined) this.on = on;
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.on ? 0.9 : 0;
    this.master.connect(this.ac.destination);
    const n = this.ac.sampleRate * 2;
    this.white = this.ac.createBuffer(1, n, this.ac.sampleRate);
    this.brown = this.ac.createBuffer(1, n, this.ac.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { w[i] = Math.random() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
  },
  resume() { this.ac?.resume?.(); },
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ac.currentTime, 0.05); },
  // pan：-1 左 … 1 右（别人的声音按方位放）
  out(pan) { if (!pan || !this.ac.createStereoPanner) return this.master; const p = this.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.master); return p; },
  noise({ dur = 0.2, type = 'bandpass', freq = 1000, freq2, q = 1, gain = 0.2, attack = 0.005, buf = 'white', delay = 0, pan = 0 }) {
    if (!this.ac || gain <= 0.0002) return;
    const t = this.ac.currentTime + delay;
    const src = this.ac.createBufferSource(); src.buffer = this[buf];
    const f = this.ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out(pan));
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  // 抽烟的声音都是淡淡的：打火机、火苗、吸、吐；别人的再按距离衰减（v）、按方位放（pan）
  click(v = 1, pan = 0) { this.noise({ dur: 0.04, type: 'highpass', freq: 3500, gain: 0.12 * v, pan }); this.noise({ dur: 0.08, freq: 6000, q: 8, gain: 0.03 * v, pan }); },
  flame(v = 1, pan = 0) { this.noise({ dur: 0.6, freq: 700, q: 0.6, gain: 0.07 * v, attack: 0.04, pan }); },
  rustle(v = 1) { this.noise({ dur: 0.18, freq: 2500, q: 0.8, gain: 0.08 * v }); },
  // 吐气：不是一阵风，是气流过口腔的「呼——」。噪声先去掉低频轰轰声，再过三个口腔共鸣峰（嘴型像轻轻的「呼」，
  // 吐着吐着嘴慢慢合上，共鸣峰往下滑），加一点点嘴唇边的气声；音量慢慢起来、稳住、再慢慢收尾，带一点不均匀的抖动
  exhale(amt, v = 1, dur = 0.7 + amt * 1.1, pan = 0) {
    if (!this.ac || v < 0.01) return;
    const takes = REAL.exhale.map((n) => this.samples[n]).filter(Boolean);
    if (takes.length) {
      // 挑长度最接近这口要吐多久的两遍之一，速度只微调 ±10%
      const close = takes.slice().sort((a, b) => Math.abs(a.duration - dur) - Math.abs(b.duration - dur)).slice(0, 2);
      const b = pick(close), rate = Math.max(0.9, Math.min(1.1, b.duration / Math.max(0.5, dur)));
      const src = this.ac.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
      const g = this.ac.createGain(); g.gain.value = (0.06 + 0.07 * amt) * v;
      src.connect(g).connect(this.out(pan)); src.start();
      return;
    }
    const ac = this.ac, t = ac.currentTime + 0.01, peak = (0.034 + 0.05 * amt) * v;
    const src = ac.createBufferSource(); src.buffer = this.white; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 240; hp.Q.value = 0.6;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.5;
    const sum = ac.createGain(), env = ac.createGain();
    const F = [[620, 470, 1.3, 1], [1250, 980, 1.6, 0.55], [2500, 2300, 2.2, 0.18]];
    for (const [f0, f1, q, gn] of F) {
      const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = q;
      b.frequency.setValueAtTime(f0 * (0.95 + Math.random() * 0.1), t); b.frequency.linearRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); g.gain.value = gn; hp.connect(b).connect(g).connect(sum);
    }
    const air = ac.createBiquadFilter(); air.type = 'highpass'; air.frequency.value = 4200; const ag = ac.createGain(); ag.gain.value = 0.05; hp.connect(air).connect(ag).connect(sum);
    // 包络：前 15% 慢慢起来，到 65% 掉到七成，然后余弦收尾；乘上 4～5 次每秒的轻微抖动
    const N = 96, curve = new Float32Array(N), ph = Math.random() * 6, fl = 4 + Math.random();
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1); let e;
      if (x < 0.15) { const u = x / 0.15; e = u * u * (3 - 2 * u); }
      else if (x < 0.65) e = 1 - 0.3 * (x - 0.15) / 0.5;
      else e = 0.7 * 0.5 * (1 + Math.cos(Math.PI * (x - 0.65) / 0.35));
      curve[i] = Math.max(0.0001, peak * e * (1 + 0.07 * Math.sin(ph + x * dur * fl * 6.283) + 0.04 * (Math.random() - 0.5)));
    }
    env.gain.value = 0.0001; env.gain.setValueCurveAtTime(curve, t, dur);
    src.connect(hp); sum.connect(lp).connect(env).connect(this.out(pan));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  tap(v = 1) { this.noise({ dur: 0.05, freq: 1800, q: 3, gain: 0.12 * v }); },
  sip() { this.noise({ dur: 0.25, freq: 500, q: 2, gain: 0.06 }); this.noise({ dur: 0.12, freq: 900, q: 4, gain: 0.05, delay: 0.3 }); },
  give() { if (!this.ac) return; const t = this.ac.currentTime; for (const [i, f] of [660, 880].entries()) { const o = this.ac.createOscillator(); const g = this.ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.05, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.25); o.connect(g).connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3); } },
  glitch() { this.noise({ dur: 0.5, type: 'bandpass', freq: 300, freq2: 4000, q: 5, gain: 0.2 }); },
  inhaleStart(crackle = false) {
    if (!this.ac || this.inhale) return;
    const t = this.ac.currentTime;
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    const drag = this.samples[pick(REAL.drag)];
    if (drag) { // 按住就从头播长吸气（不循环），松开淡出
      src.buffer = drag; src.playbackRate.value = 0.96 + Math.random() * 0.08;
      g.gain.value = 0.07; src.connect(g).connect(this.master); src.start();
    } else {
      src.buffer = this.white; src.loop = true;
      const f = this.ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.3);
      src.connect(f).connect(g).connect(this.master); src.start();
    }
    // 烟丝燃烧的噼啪声；丁香烟更响
    const timer = setInterval(() => { if (Math.random() < (crackle ? 0.7 : 0.35)) this.noise({ dur: 0.015, type: 'highpass', freq: 5000, gain: (crackle ? 0.05 : 0.022) * Math.random() + 0.006 }); }, 80);
    this.inhale = { src, g, timer };
  },
  inhaleFar(v = 1, pan = 0, crackle = false) { // 别人在吸：几声很轻的噼啪
    for (let i = 0; i < 8; i++) if (Math.random() < (crackle ? 0.7 : 0.4)) this.noise({ dur: 0.015, type: 'highpass', freq: 5000, gain: ((crackle ? 0.05 : 0.022) * Math.random() + 0.006) * v, delay: i * 0.12, pan });
  },
  inhaleStop() {
    if (!this.inhale) return;
    const { src, g, timer } = this.inhale; this.inhale = null;
    clearInterval(timer);
    g.gain.setTargetAtTime(0.0001, this.ac.currentTime, 0.03);
    try { src.stop(this.ac.currentTime + 0.25); } catch {} // 万一已经自己播完了
  },
  // 松开之后那一下「吸进肺里」（只有嘬得够久才有）
  lung(v = 1, pan = 0) { const b = this.samples[pick(REAL.lung)]; if (!this.ac || !b || v < 0.01) return; const src = this.ac.createBufferSource(); src.buffer = b; src.playbackRate.value = 0.95 + Math.random() * 0.1; const g = this.ac.createGain(); g.gain.value = 0.06 * v; src.connect(g).connect(this.out(pan)); src.start(); },
  ambient(place, night) {
    if (!this.ac) return;
    for (const n of this.amb) { try { n.stop(); } catch {} }
    this.amb = [];
    const loop = (buf, type, freq, gain) => {
      const src = this.ac.createBufferSource(); src.buffer = this[buf]; src.loop = true;
      const f = this.ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = this.ac.createGain(); g.gain.value = gain;
      src.connect(f).connect(g).connect(this.master); src.start(0, Math.random() * 2);
      this.amb.push(src);
    };
    const tone = (freq, gain) => { const o = this.ac.createOscillator(); o.frequency.value = freq; const g = this.ac.createGain(); g.gain.value = gain; o.connect(g).connect(this.master); o.start(); this.amb.push(o); };
    if (place === 'shop') { tone(120, 0.006); tone(58, 0.01); loop('brown', 'lowpass', 300, 0.05); }
    if (place === 'street') { loop('brown', 'lowpass', night ? 380 : 650, night ? 0.1 : 0.18); }
    if (place === 'roof') { loop('brown', 'lowpass', 500, 0.16); loop('white', 'bandpass', 300, 0.012); }
  },
  // 吃喝和咳嗽
  psst() { this.noise({ dur: 0.05, type: 'highpass', freq: 2500, gain: 0.25 }); this.noise({ dur: 0.45, type: 'highpass', freq: 4500, freq2: 2500, gain: 0.12, attack: 0.01, delay: 0.03 }); },
  twist() { for (let i = 0; i < 4; i++) this.noise({ dur: 0.03, type: 'highpass', freq: 3000, gain: 0.08, delay: i * 0.05 }); },
  tear() { this.noise({ dur: 0.28, type: 'bandpass', freq: 2200, freq2: 5200, q: 0.7, gain: 0.16, attack: 0.02 }); for (let i = 0; i < 5; i++) this.noise({ dur: 0.02, type: 'highpass', freq: 4000, gain: 0.06, delay: 0.03 + i * 0.045 }); },
  crunch() { for (let i = 0; i < 3; i++) { this.noise({ dur: 0.07, type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 1.2, gain: 0.13, delay: i * 0.17 }); this.noise({ dur: 0.04, type: 'highpass', freq: 5000, gain: 0.05, delay: i * 0.17 + 0.02 }); } },
  chew() { for (let i = 0; i < 3; i++) this.noise({ dur: 0.12, type: 'lowpass', freq: 600, gain: 0.08, attack: 0.03, delay: i * 0.22 }); },
  slurp() { this.noise({ dur: 0.5, type: 'bandpass', freq: 900, freq2: 2400, q: 2, gain: 0.08, attack: 0.08 }); this.noise({ dur: 0.15, type: 'bandpass', freq: 700, q: 3, gain: 0.05, delay: 0.55 }); },
  // 录好的真人声音（咳嗽）：init 之后加载，没加载好之前用合成的
  samples: {},
  async loadSamples(base) {
    if (!this.ac) return;
    await Promise.all(['cough1', 'cough3', 'coughfit', ...REAL.drag, ...REAL.lung, ...REAL.exhale].map(async (n) => {
      try { const r = await fetch(`${base}sfx/${n}.mp3`); this.samples[n] = await this.ac.decodeAudioData(await r.arrayBuffer()); } catch {}
    }));
  },
  play(name, v = 1, rate = 1, pan = 0) {
    const b = this.samples[name]; if (!this.ac || !b) return false;
    const src = this.ac.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = this.ac.createGain(); g.gain.value = v; src.connect(g).connect(this.out(pan)); src.start();
    return true;
  },
  // 咳嗽：k 小于 0.5 一声，正常「咳咳咳」，大于 1.1 呛得厉害一阵猛咳；每次音调随机一点，听起来像不同的人
  cough(k = 1, v = 1, pan = 0) {
    // 收着点：轻的一声，呛到了也只是三声短咳，不用那段猛咳；音量偏小；别人的按距离（v）
    const name = k < 0.8 ? 'cough1' : 'cough3';
    if (v < 0.01) return;
    if (this.play(name, Math.min(0.45, 0.18 + k * 0.2) * v, 0.95 + Math.random() * 0.15, pan)) return;
    this.coughSynth(k * v * 0.5);
  },
  coughSynth(k = 1) {
    // 三声：一声比一声弱
    for (let i = 0; i < 3; i++) {
      const v = k * (1 - i * 0.22), d = i * 0.42;
      this.noise({ dur: 0.05, type: 'lowpass', freq: 900, gain: 0.25 * v, attack: 0.004, delay: d });
      this.noise({ dur: 0.26, type: 'bandpass', freq: 650, freq2: 380, q: 0.8, gain: 0.32 * v, attack: 0.01, delay: d + 0.02 });
      this.noise({ dur: 0.18, type: 'highpass', freq: 2200, gain: 0.05 * v, attack: 0.02, delay: d + 0.04 });
    }
  },
  car(v = 1) { this.noise({ dur: 2.2, type: 'lowpass', freq: 200, freq2: 900, gain: 0.07 * v, attack: 1.0, buf: 'brown' }); },
};
