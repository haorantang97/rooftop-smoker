// 第一人称走路：键盘 WASD/方向键管前后左右，Shift 跑；鼠标管方向
// 鼠标转头两种方式：点画面锁定鼠标后直接移动（Esc 释放）；锁不上的环境（内嵌浏览器等）按住左键拖动
// 触屏：拖动转头，左下角摇杆走路
// 碰撞：可走范围是矩形，障碍物是圆和矩形
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createControls(canvas, { onClick, isBlocked }) {
  const S = { x: 0, z: 0, yaw: 0, pitch: -0.05, yawT: 0, pitchT: -0.05, keys: new Set(), stick: null, drag: null, bob: 0, moving: 0, world: null, pitchRange: [-0.75, 0.7], coughT: 9, coughK: 1, cough: 0, tilt: 0, tiltS: 0 };

  const locked = () => document.pointerLockElement === canvas;
  const center = () => ({ clientX: innerWidth / 2, clientY: innerHeight / 2, center: true });
  document.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    S.yawT -= e.movementX * 0.0023;
    S.pitchT = clamp(S.pitchT + e.movementY * 0.0023, S.pitchRange[0], S.pitchRange[1]);
  });
  document.addEventListener('pointerlockchange', () => {
    if (locked()) { S.drag = null; canvas.classList.remove('dragging'); }
    document.body.classList.toggle('locked', locked()); S.onLock?.(locked());
  });
  const lockFailed = () => { if (!S.lockFailed) { S.lockFailed = true; S.onLockFail?.(); } };
  document.addEventListener('pointerlockerror', lockFailed);
  const tryLock = () => {
    if (S.lockFailed || isBlocked() || !canvas.requestPointerLock) return;
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(lockFailed); } catch { lockFailed(); }
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (locked() && (e.button === 0 || e.button === 2)) { onClick({ ...center(), button: e.button }); return; } // 锁定时中间的点就是光标：左键 / 右键都算
      if (e.button !== 0) return;
      // 没锁定：先按拖动转头处理，同时试着锁定鼠标
      S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: S.yawT, pitch: S.pitchT, moved: false, mouse: true };
      canvas.setPointerCapture(e.pointerId); tryLock(); return;
    }
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.4 && e.clientY > innerHeight * 0.45) { // 左下角：摇杆
      S.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; showStick(e.clientX, e.clientY, 0, 0); canvas.setPointerCapture(e.pointerId); return;
    }
    S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: S.yawT, pitch: S.pitchT, moved: false }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (S.stick && e.pointerId === S.stick.id) { S.stick.dx = clamp((e.clientX - S.stick.x0) / 50, -1, 1); S.stick.dy = clamp((e.clientY - S.stick.y0) / 50, -1, 1); showStick(S.stick.x0, S.stick.y0, S.stick.dx, S.stick.dy); return; }
    if (!S.drag || e.pointerId !== S.drag.id) return;
    const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
    if (Math.hypot(dx, dy) > 5) { S.drag.moved = true; canvas.classList.add('dragging'); }
    if (S.drag.mouse) { // 鼠标拖动：和锁定后的方向一致，往右拖看右边
      if (locked()) return;
      S.yawT = S.drag.yaw - dx * 0.0042;
      S.pitchT = clamp(S.drag.pitch + dy * 0.0042, S.pitchRange[0], S.pitchRange[1]);
      return;
    }
    S.yawT = S.drag.yaw + dx * 0.0045;
    S.pitchT = clamp(S.drag.pitch + dy * 0.0045, S.pitchRange[0], S.pitchRange[1]);
  });
  const up = (e) => {
    if (S.stick && e.pointerId === S.stick.id) { S.stick = null; hideStick(); return; }
    const d = S.drag; if (!d || e.pointerId !== d.id) return;
    S.drag = null; canvas.classList.remove('dragging');
    if (!d.moved && !locked()) onClick(e); // 刚锁定成功的那一下不算点击
  };
  // iOS Safari 不认 user-scalable=no：双指捏合、双击都会缩放页面，这里拦掉（左手摇杆 + 右手转头是两根手指同时在屏幕上）
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTap = 0; document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTap < 300 && e.target === canvas) e.preventDefault(); lastTap = now; }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // 右键借火，不弹浏览器菜单
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  // 触控板双指滑动 / 鼠标滚轮：不用按键也能转头（左右滑转身，上下滑抬头低头）
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    S.yawT -= e.deltaX * k * 0.0032;
    S.pitchT = clamp(S.pitchT + e.deltaY * k * 0.0024, S.pitchRange[0], S.pitchRange[1]);
  }, { passive: false });
  addEventListener('keydown', (e) => { if (isBlocked()) return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { S.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); } });
  addEventListener('keyup', (e) => S.keys.delete(e.code));
  addEventListener('blur', () => S.keys.clear());

  const stickEl = document.createElement('div'); stickEl.id = 'stick'; stickEl.innerHTML = '<i></i>'; stickEl.style.display = 'none'; document.body.appendChild(stickEl);
  function showStick(x, y, dx, dy) { stickEl.style.display = ''; stickEl.style.left = `${x}px`; stickEl.style.top = `${y}px`; stickEl.firstChild.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`; }
  function hideStick() { stickEl.style.display = 'none'; }

  function collide(nx, nz) {
    const W = S.world; if (!W) return [nx, nz];
    const R = 0.28;
    nx = clamp(nx, W.bounds[0] + R, W.bounds[1] - R); nz = clamp(nz, W.bounds[2] + R, W.bounds[3] - R);
    for (const o of W.obstacles) {
      if (o.r) { const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), min = o.r + R; if (d < min && d > 1e-4) { nx = o.x + (dx / d) * min; nz = o.z + (dz / d) * min; } }
      else { // 矩形 [x0,x1,z0,z1]
        const cx = clamp(nx, o.x0, o.x1), cz = clamp(nz, o.z0, o.z1), dx = nx - cx, dz = nz - cz, d = Math.hypot(dx, dz);
        if (d < R) { if (d > 1e-4) { nx = cx + (dx / d) * R; nz = cz + (dz / d) * R; } else { // 在矩形里面：从最近的边推出去
          const pushes = [[o.x0 - R - nx, 0], [o.x1 + R - nx, 0], [0, o.z0 - R - nz], [0, o.z1 + R - nz]].sort((a, b) => Math.hypot(...a) - Math.hypot(...b)); nx += pushes[0][0]; nz += pushes[0][1]; } }
      }
    }
    for (const o of W.others?.() || []) { const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz); if (d < 0.5 && d > 1e-4) { nx = o.x + (dx / d) * 0.5; nz = o.z + (dz / d) * 0.5; } }
    if (stuck(nx, nz)) [nx, nz] = freeSpot(nx, nz); // 保险：还卡在家具里（几个障碍物互相推），就挪到最近的空地
    return [nx, nz];
  }
  const R0 = 0.27;
  function stuck(x, z) {
    for (const o of S.world.obstacles) {
      if (o.r) { if (Math.hypot(x - o.x, z - o.z) < o.r + R0) return true; }
      else if (Math.hypot(x - clamp(x, o.x0, o.x1), z - clamp(z, o.z0, o.z1)) < R0) return true;
    }
    return false;
  }
  function freeSpot(x, z) {
    for (let r = 0.1; r <= 3; r += 0.1) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r, b = S.world.bounds;
      if (nx < b[0] + 0.3 || nx > b[1] - 0.3 || nz < b[2] + 0.3 || nz > b[3] - 0.3) continue;
      if (!stuck(nx, nz)) return [nx, nz];
    }
    return [x, z];
  }

  return {
    S, locked, unlock() { if (locked()) document.exitPointerLock(); }, center,
    nudge(dx, dz) { if (!S.seated) [S.x, S.z] = collide(S.x + dx, S.z + dz); }, // 自动挪动（比如走到坐着的人跟前）也要过碰撞
    setWorld(world, x, z, yaw) { S.world = world; S.x = x; S.z = z; S.yaw = S.yawT = yaw; S.pitch = S.pitchT = -0.05; },
    update(dt, canMove) {
      if (S.seated) { S.moving = 0; S.yaw += (S.yawT - S.yaw) * Math.min(1, dt * 10); S.pitch += (S.pitchT - S.pitch) * Math.min(1, dt * 10); if (S.coughT < 3) S.coughT += dt; S.tiltS += (S.tilt - S.tiltS) * Math.min(1, dt * 5); return; } // 坐着 / 躺着：不走也不推开
      let f = 0, s = 0;
      if (canMove && !isBlocked()) {
        if (S.keys.has('KeyW') || S.keys.has('ArrowUp')) f += 1;
        if (S.keys.has('KeyS') || S.keys.has('ArrowDown')) f -= 1;
        if (S.keys.has('KeyD') || S.keys.has('ArrowRight')) s += 1;
        if (S.keys.has('KeyA') || S.keys.has('ArrowLeft')) s -= 1;
        if (S.stick) { f -= S.stick.dy; s += S.stick.dx; }
      }
      const len = Math.hypot(f, s);
      const speed = (S.keys.has('ShiftLeft') || S.keys.has('ShiftRight') ? 2.6 : 1.35);
      if (len > 0.05) {
        f /= Math.max(1, len); s /= Math.max(1, len);
        const sin = Math.sin(S.yaw), cos = Math.cos(S.yaw);
        const vx = (-sin * f + cos * s) * speed, vz = (-cos * f - sin * s) * speed;
        [S.x, S.z] = collide(S.x + vx * dt, S.z + vz * dt);
        S.moving = Math.min(1, S.moving + dt * 6); S.bob += dt * speed * 5.2;
      } else { S.moving = Math.max(0, S.moving - dt * 5); [S.x, S.z] = collide(S.x, S.z); }
      if (S.coughT < 3) S.coughT += dt;
      S.tiltS += (S.tilt - S.tiltS) * Math.min(1, dt * 5);
      S.yaw += (S.yawT - S.yaw) * Math.min(1, dt * 10);
      S.pitch += (S.pitchT - S.pitch) * Math.min(1, dt * 10);
    },
    apply(camera, eye) {
      const bob = Math.sin(S.bob) * 0.022 * S.moving, sway = Math.cos(S.bob * 0.5) * 0.012 * S.moving;
      // 咳嗽：三下，每下头往前一点、镜头抖一下，一下比一下轻
      let c = 0;
      for (let i = 0; i < 3; i++) { const u = S.coughT - i * 0.42; if (u > 0 && u < 0.6) c += S.coughK * (1 - i * 0.25) * u * 30 * Math.exp(-u * 12); }
      S.cough = c;
      const jy = Math.sin(S.coughT * 53) * 0.014 * c, jr = Math.sin(S.coughT * 41 + 1) * 0.01 * c; // 咳嗽的晃动收着点
      camera.position.set(S.x + Math.cos(S.yaw) * sway, eye + bob - 0.015 * c, S.z - Math.sin(S.yaw) * sway);
      camera.rotation.set(0, 0, 0); camera.rotateY(S.yaw + jy); camera.rotateX(-(S.pitch + 0.08 * c - S.tiltS)); camera.rotateZ(jr);
    },
  };
}
