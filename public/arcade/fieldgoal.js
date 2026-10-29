// Field Goal Frenzy: 10 kicks, swipe up to kick, beat the wind.
(function () {
  const P = 'fg';
  const CSS = `
.fg-wrap{position:relative;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.fg-hud{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;background:#0f1117;border:1px solid #1d212c;border-bottom:0;border-radius:12px 12px 0 0}
.fg-stat{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.fg-stat span{font-family:'Press Start 2P',monospace;font-size:7px;color:#6f7584;letter-spacing:.5px}
.fg-stat b{font-family:'Press Start 2P',monospace;font-size:11px;color:#ffc21a;white-space:nowrap}
.fg-quit{font-family:'Press Start 2P',monospace;font-size:8px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;padding:8px 9px;cursor:pointer}
.fg-quit.sure{background:#ff3344;border-color:#ff3344}
.fg-stage{position:relative;overflow:hidden;background:#07080b;border:1px solid #1d212c;border-radius:0 0 12px 12px;touch-action:none}
.fg-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;cursor:grab}
.fg-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.fg-banner{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:fg-pop .9s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000,-1px -1px 0 #000}
.fg-banner b{display:block;font-size:22px;line-height:1.3}
.fg-banner i{display:block;font-style:normal;font-size:10px;margin-top:8px;color:#f5f6f8}
.fg-good b{color:#ffc21a}.fg-bad b{color:#ff3344}
.fg-combo{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:11px;color:#7CFF6B;text-shadow:2px 2px 0 #000;animation:fg-rise 1.3s ease-out both;white-space:nowrap}
.fg-splash{position:absolute;inset:0;background:rgba(7,8,11,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px;gap:14px;z-index:3}
.fg-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:17px;line-height:1.45;text-shadow:3px 3px 0 #6b4f00}
.fg-how{font-size:14px;line-height:1.5;color:#c9ccd4;max-width:300px;margin:0}
.fg-how b{color:#f5f6f8}
.fg-goal{font-family:'Press Start 2P',monospace;font-size:9px;line-height:1.7;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c}
.fg-goal em{font-style:normal;color:#ffc21a}
.fg-start{font-family:'Press Start 2P',monospace;font-size:13px;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:fg-pulse 1.1s ease-in-out infinite}
.fg-start:active{transform:translateY(3px);box-shadow:0 1px 0 #a37a00}
@keyframes fg-pop{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes fg-rise{0%{opacity:0;transform:translate(-50%,-30%)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-160%)}}
@keyframes fg-pulse{50%{transform:scale(1.06)}}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css')) return;
    const s = document.createElement('style'); s.id = P + '-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  const LEVELS = [
    { d0: 20, d1: 45, postW: 9.0, w0: 1, w1: 8, need: 5 },
    { d0: 20, d1: 50, postW: 7.8, w0: 2, w1: 11, need: 6 },
    { d0: 25, d1: 53, postW: 6.8, w0: 3, w1: 14, need: 7 },
    { d0: 28, d1: 57, postW: 6.2, w0: 5, w1: 18, need: 8 },
  ];
  const KICKS = 10, G = 10.7, ANG = 40 * Math.PI / 180, WIND_K = 0.11, TS = 1.45;
  const BAR = 3.33, UPR = 7, CAM_D = 12, V0 = 10, V1 = 27.5;
  const FONT = '"Press Start 2P", monospace';

  MFLArcade.register('fieldgoal', {
    start(ctx) {
      injectCSS();
      try { document.fonts && document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
      const L = LEVELS[Math.max(0, Math.min(3, ctx.level | 0))];
      // Kick plan (seeded): distance and wind for each kick.
      const plan = [];
      for (let i = 0; i < KICKS; i++) {
        const d = Math.round(L.d0 + (L.d1 - L.d0) * i / (KICKS - 1));
        const wmax = L.w0 + (L.w1 - L.w0) * i / (KICKS - 1);
        const mph = Math.round(wmax * (0.55 + 0.45 * ctx.rng()));
        const dir = ctx.rng() < 0.5 ? -1 : 1;
        plan.push({ d, mph, dir });
      }
      // cosmetic random (keeps ctx.rng sequence clean)
      let cs = 1234567;
      const crand = () => { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; };

      const root = ctx.root;
      root.innerHTML = '';
      const wrap = el('div', 'fg-wrap');
      const hud = el('div', 'fg-hud');
      const sKick = el('div', 'fg-stat', '<span>KICK</span><b>1/10</b>');
      const sMade = el('div', 'fg-stat', `<span>MADE</span><b>0</b>`);
      const sNeed = el('div', 'fg-stat', `<span>NEED</span><b>${L.need}</b>`);
      const sDist = el('div', 'fg-stat', '<span>DIST</span><b>20 YD</b>');
      const quit = el('button', 'fg-quit', 'QUIT');
      quit.type = 'button';
      hud.append(sKick, sMade, sNeed, sDist, quit);
      const stage = el('div', 'fg-stage');
      const cv = el('canvas', 'fg-cv');
      const fx = el('div', 'fg-fx');
      stage.append(cv, fx);
      wrap.append(hud, stage);
      root.appendChild(wrap);
      const g = cv.getContext('2d');

      let IW = 200, IH = 290, PX = 2, F = 250, hy = 87, CAM_H = 7.8, cx = 100;
      function fit() {
        const rw = Math.max(260, Math.min(root.clientWidth || 360, 560));
        const maxH = Math.max(360, (window.innerHeight || 800) - 150);
        let cw = rw, ch = Math.round(cw * 1.45);
        if (ch > maxH) { ch = maxH; cw = Math.round(ch / 1.45); }
        PX = Math.max(2, Math.round(cw / 200));
        IW = Math.floor(cw / PX); IH = Math.floor(IW * 1.45);
        cv.width = IW; cv.height = IH;
        cv.style.width = IW * PX + 'px'; cv.style.height = IH * PX + 'px';
        wrap.style.width = IW * PX + 2 + 'px';
        F = 1.25 * IW; hy = Math.round(0.3 * IH); cx = IW / 2;
        CAM_H = (0.86 * IH - hy) * CAM_D / F;
        g.imageSmoothingEnabled = false;
        stars = [];
        for (let i = 0; i < 40; i++) stars.push([crand() * IW, crand() * (hy - 22), crand()]);
        crowd = [];
        for (let i = 0; i < 260; i++) crowd.push([crand() * IW, crand(), Math.floor(crand() * 6)]);
      }
      let stars = [], crowd = [];
      fit();
      const onResize = () => { fit(); };
      window.addEventListener('resize', onResize);

      function proj(x, y, z) {
        const d = Math.max(0.6, z + CAM_D), s = F / d;
        return [cx + x * s, hy + (CAM_H - y) * s, s];
      }

      // ---- state ----
      let state = 'splash', kick = 0, made = 0, streak = 0, best = 0, longest = 0;
      let ball = null, drag = null, windup = 0, resultT = 0, verdict = null, shake = 0, flash = 0, time = 0;
      let particles = [], kickerT = 0, dead = false, raf = 0, last = 0;
      const cur = () => plan[Math.min(kick, KICKS - 1)];

      function updHud() {
        sKick.querySelector('b').textContent = `${Math.min(kick + 1, KICKS)}/${KICKS}`;
        sMade.querySelector('b').textContent = made;
        sDist.querySelector('b').textContent = cur().d + ' YD';
      }
      updHud();

      function banner(txt, sub, good) {
        fx.innerHTML = '';
        const b = el('div', 'fg-banner ' + (good ? 'fg-good' : 'fg-bad'), `<b>${txt}</b>${sub ? `<i>${sub}</i>` : ''}`);
        fx.appendChild(b);
      }
      function combo(txt) { const c = el('div', 'fg-combo', txt); fx.appendChild(c); }

      function burst(x, y, n, colors, spd, up) {
        for (let i = 0; i < n; i++) {
          const a = crand() * Math.PI * 2, v = spd * (0.3 + crand());
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), life: 1 + crand() * 0.8, c: colors[i % colors.length], s: crand() < 0.3 ? 2 : 1 });
        }
      }

      // ---- input ----
      function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * IW, y: (e.clientY - r.top) / r.height * IH, t: performance.now() }; }
      cv.addEventListener('pointerdown', (e) => {
        if (state !== 'aim' || dead) return;
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        const p = pt(e);
        drag = { id: e.pointerId, s: p, c: p, pts: [p] };
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const p = pt(e); drag.c = p; drag.pts.push(p);
        if (drag.pts.length > 40) drag.pts.shift();
      });
      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const p = pt(e); drag.c = p;
        const sw = swipeInfo(drag);
        drag = null;
        if (state !== 'aim') return;
        if (!sw) { hint = 1.6; return; }
        launch(sw);
      };
      cv.addEventListener('pointerup', endDrag);
      cv.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
      let hint = 0;

      function swipeInfo(d) {
        const dx = d.c.x - d.s.x, dy = d.c.y - d.s.y;
        const len = Math.hypot(dx, dy);
        if (len < 10 || dy > -6) return null;
        const full = IH * 0.45;
        const dur = d.c.t - d.s.t;
        let power = Math.min(1, len / full);
        if (dur > 500) power *= Math.max(0.6, 1 - (dur - 500) / 2000);
        // aim: where the swipe ray crosses the crossbar on screen
        const [bx, by] = proj(0, 0, 0);
        const barY = proj(0, BAR, cur().d)[1];
        const t = (barY - by) / dy;
        const sx = bx + dx * t;
        const xAim = (sx - cx) * (cur().d + CAM_D) / F;
        return { power, slope: xAim / cur().d, dx, dy };
      }
      function preview(d) { const sw = swipeInfo(d); return sw; }

      function launch(sw) {
        state = 'windup'; windup = 0.28; kickerT = 0;
        const v = V0 + (V1 - V0) * sw.power;
        const vz = v * Math.cos(ANG), vy = v * Math.sin(ANG);
        ball = { x: 0, y: 0.15, z: 0, vx: vz * sw.slope, vy, vz, spin: 0, trail: [], judged: false, done: false, after: 0, power: sw.power };
        lastPower = sw.power;
      }
      let lastPower = 0;

      function judge(x, y) {
        const k = cur(), hw = L.postW / 2, ax = Math.abs(x);
        let good = false, txt = '', sub = '', doink = false;
        if (y < BAR) {
          if (ax < hw && y > BAR - 0.45) { doink = true; txt = 'DOINK!'; sub = 'OFF THE CROSSBAR'; ball.vz *= -0.3; ball.vy = Math.abs(ball.vy) * 0.3; }
          else { txt = 'NO GOOD'; sub = 'SHORT: SWIPE LONGER'; }
        } else if (ax <= hw - 0.15) { good = true; txt = "IT'S GOOD!"; }
        else if (ax <= hw + 0.25) {
          doink = true;
          if (ax < hw) { good = true; txt = 'DOINK... GOOD!'; ball.vx = -Math.sign(x) * Math.abs(ball.vx) * 0.6 - Math.sign(x) * 1.5; }
          else { txt = 'DOINK!'; sub = x < 0 ? 'NO GOOD - LEFT' : 'NO GOOD - RIGHT'; ball.vx = Math.sign(x) * (Math.abs(ball.vx) * 0.6 + 2); ball.vz *= 0.35; }
        } else { txt = 'NO GOOD'; sub = x < 0 ? 'WIDE LEFT' : 'WIDE RIGHT'; }
        verdict = { good, txt, sub, doink };
        ball.judged = true;
        if (good) {
          made++; streak++; best = Math.max(best, streak); longest = Math.max(longest, k.d);
          ctx.sound('good');
          setTimeout(() => !dead && ctx.sound('catch'), 160);
          shake = doink ? 7 : 5; flash = 0.35;
          const [px, py] = proj(0, BAR + 2, k.d);
          burst(px, py, 60, ['#ffc21a', '#ffffff', '#ff3344', '#7CFF6B', '#4cc9ff'], 55, 20);
          for (let i = 0; i < 3; i++) setTimeout(() => { if (!dead) burst(IW * (0.2 + crand() * 0.6), hy * (0.25 + crand() * 0.5), 40, ['#ffc21a', '#fff', '#ff8a00'], 45, 0); }, 150 + i * 220);
          banner(txt, sub || `${k.d} YARDS`, true);
          if (streak >= 2) combo(streak >= 5 ? `ON FIRE! ${streak} STRAIGHT` : `${streak} IN A ROW!`);
        } else {
          streak = 0;
          ctx.sound('bad');
          shake = doink ? 6 : 3;
          if (doink) { const [px, py] = proj(Math.sign(x) * hw, BAR + 1, k.d); burst(px, py, 14, ['#ffc21a', '#fff'], 30, 0); }
          banner(txt, sub, false);
        }
        updHud();
      }

      function nextKick() {
        kick++;
        fx.innerHTML = '';
        verdict = null; ball = null;
        const left = KICKS - kick;
        if (kick >= KICKS || made + left < L.need) { endGame(); return; }
        state = 'aim'; updHud();
        ctx.sound('tap');
      }

      function endGame() {
        state = 'over';
        const won = made >= L.need;
        banner(won ? 'VICTORY!' : 'GAME OVER', `${made}/${KICKS} MADE`, won);
        updHud();
        setTimeout(() => finish(won), 1300);
      }
      let finished = false;
      function finish(won, quitted) {
        if (finished) return; finished = true; dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        const tried = Math.min(kick + (verdict ? 1 : 0), KICKS);
        ctx.finish({
          won: !!won && !quitted,
          score: made,
          detail: quitted ? `Quit after ${tried} kicks (${made} made).` : `Made ${made} of ${tried} field goals (needed ${L.need}).${longest ? ` Long: ${longest} yd.` : ''}`,
          stats: { made, kicks: tried, need: L.need, longest, bestStreak: best },
        });
      }
      let quitArm = 0;
      quit.addEventListener('click', () => {
        if (finished) return;
        if (!quitArm) { quitArm = 1; quit.textContent = 'SURE?'; quit.classList.add('sure'); setTimeout(() => { quitArm = 0; quit.textContent = 'QUIT'; quit.classList.remove('sure'); }, 2200); return; }
        finish(false, true);
      });

      // ---- simulation ----
      function step(dt) {
        time += dt;
        if (hint > 0) hint -= dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 18);
        if (flash > 0) flash -= dt;
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.99; p.life -= dt; }
        particles = particles.filter((p) => p.life > 0);
        if (state === 'windup') {
          windup -= dt; kickerT = Math.min(1, kickerT + dt / 0.28);
          if (windup <= 0) { state = 'flight'; ctx.sound('kick'); const [bx, by] = proj(0, 0, 0); burst(bx, by, 10, ['#d9f7c4', '#6fbf4f'], 25, 10); }
        } else if (state === 'flight' || state === 'result') {
          if (ball && !ball.done) {
            const k = cur();
            const wa = k.mph * k.dir * WIND_K;
            let h = dt * TS;
            const n = 4;
            for (let i = 0; i < n; i++) {
              const sdt = h / n;
              const pz = ball.z, px = ball.x, py = ball.y;
              ball.vx += wa * sdt; ball.vy -= G * sdt;
              ball.x += ball.vx * sdt; ball.y += ball.vy * sdt; ball.z += ball.vz * sdt;
              if (!ball.judged && pz < k.d && ball.z >= k.d) {
                const f = (k.d - pz) / (ball.z - pz);
                judge(px + (ball.x - px) * f, py + (ball.y - py) * f);
                state = 'result'; resultT = 1.75;
              }
              if (ball.y <= 0 && ball.vy < 0) {
                if (!ball.judged) { judge(ball.x, -1); state = 'result'; resultT = 1.6; }
                ball.y = 0; ball.vy = -ball.vy * 0.35; ball.vz *= 0.5; ball.vx *= 0.5;
                if (Math.abs(ball.vy) < 1.2) ball.done = true;
              }
            }
            ball.spin += dt * 14;
            const [sx, sy] = proj(ball.x, ball.y, ball.z);
            ball.trail.push([sx, sy]); if (ball.trail.length > 10) ball.trail.shift();
            if (ball.judged) { ball.after += dt; if (ball.after > 1.4) ball.done = true; }
          }
          if (state === 'result') { resultT -= dt; if (resultT <= 0) nextKick(); }
          kickerT = Math.min(1, kickerT + dt * 2);
        }
      }

      // ---- drawing ----
      function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
      function quad(a, b, c, d, col) { g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }
      function text(t, x, y, size, col, align) {
        g.font = `${size}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#000'; g.fillText(t, Math.round(x) + 1, Math.round(y) + 1);
        g.fillStyle = col; g.fillText(t, Math.round(x), Math.round(y));
      }

      function drawSky() {
        const grd = g.createLinearGradient(0, 0, 0, hy);
        grd.addColorStop(0, '#060818'); grd.addColorStop(1, '#1b2452');
        g.fillStyle = grd; g.fillRect(0, 0, IW, hy);
        for (const [x, y, b] of stars) { const tw = (Math.sin(time * 2 + b * 20) + 1) / 2; g.fillStyle = tw > 0.5 ? '#ffffff' : '#7f88b8'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
        // stands
        const sTop = hy - 20;
        rect(0, sTop, IW, 20, '#141824');
        for (let r = 0; r < 4; r++) rect(0, sTop + 3 + r * 4, IW, 1, '#1d2232');
        const cols = ['#ff3344', '#ffc21a', '#ffffff', '#4cc9ff', '#7a7f8f', '#2a2f3c'];
        for (const [x, ry, c] of crowd) {
          const y = sTop + 2 + Math.floor(ry * 16);
          const bob = verdict && verdict.good && Math.sin(time * 18 + x) > 0 ? -1 : 0;
          g.fillStyle = cols[c]; g.fillRect(Math.round(x), y + bob, 1, 1);
        }
        if (crand() < 0.25) { g.fillStyle = '#ffffff'; g.fillRect(Math.floor(crand() * IW), sTop + 2 + Math.floor(crand() * 15), 1, 1); }
        // light towers
        for (const lx of [IW * 0.12, IW * 0.88]) {
          rect(lx - 1, sTop - 30, 2, 30, '#2a2f3c');
          rect(lx - 7, sTop - 36, 14, 6, '#3a4052');
          for (let i = 0; i < 4; i++) rect(lx - 6 + i * 3.4, sTop - 35, 2, 2, '#fffbe0');
          const lg = g.createRadialGradient(lx, sTop - 33, 1, lx, sTop - 33, 30);
          lg.addColorStop(0, 'rgba(255,250,210,.35)'); lg.addColorStop(1, 'rgba(255,250,210,0)');
          g.fillStyle = lg; g.fillRect(lx - 30, sTop - 63, 60, 60);
        }
        rect(0, hy - 1, IW, 1, '#0b0d14');
      }

      function drawField() {
        const k = cur();
        g.fillStyle = '#1f4a22'; g.fillRect(0, hy, IW, IH - hy);
        const goalZ = k.d - 10, far = k.d + 4;
        const HW = 26.6;
        // stripes every 5 yards from ball spot backward and forward
        let z = goalZ - Math.ceil((goalZ + 8) / 5) * 5;
        let idx = Math.round((goalZ - z) / 5);
        for (; z < goalZ; z += 5, idx--) {
          const z0 = Math.max(z, -CAM_D + 1.5), z1 = Math.min(z + 5, goalZ);
          if (z1 <= z0) continue;
          quad(proj(-HW, 0, z0), proj(HW, 0, z0), proj(HW, 0, z1), proj(-HW, 0, z1), idx % 2 ? '#2f7a33' : '#36873a');
        }
        // end zone
        quad(proj(-HW, 0, goalZ), proj(HW, 0, goalZ), proj(HW, 0, k.d), proj(-HW, 0, k.d), '#6e1622');
        for (let i = -6; i <= 6; i++) {
          const a = proj(i * 4, 0, goalZ + 1), b = proj(i * 4 + 2, 0, goalZ + 1), c = proj(i * 4 + 5, 0, k.d - 1), d = proj(i * 4 + 3, 0, k.d - 1);
          quad(a, b, c, d, 'rgba(255,255,255,0.06)');
        }
        // beyond end line
        quad(proj(-HW - 30, 0, k.d), proj(HW + 30, 0, k.d), proj(HW + 30, 0, far + 60), proj(-HW - 30, 0, far + 60), '#173819');
        // back wall with MFL signs
        const w0 = proj(-80, 1.6, k.d + 14), w1 = proj(80, 0, k.d + 14);
        const lowH = w0[1] - hy;
        if (lowH > 0) {
          rect(0, hy, IW, lowH, '#141824');
          const cols = ['#ff3344', '#ffc21a', '#ffffff', '#4cc9ff', '#7a7f8f', '#2a2f3c'];
          for (let i = 0; i < crowd.length; i += 2) { const [x, ry, c] = crowd[i]; g.fillStyle = cols[c]; g.fillRect(Math.round(x), Math.round(hy + 1 + ry * (lowH - 2)), 1, 1); }
        }
        rect(0, w0[1], IW, w1[1] - w0[1], '#0f1117');
        rect(0, w0[1], IW, 1, '#ffc21a');
        const wh = w1[1] - w0[1];
        if (wh >= 4) {
          g.font = `${wh >= 8 ? 8 : 5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          const step = Math.max(30, Math.round(w0[2] * 12));
          for (let sx = ((cx % step) + step) % step - step; sx < IW + step; sx += step) { g.fillStyle = (Math.round((sx - cx) / step) & 1) ? '#ffc21a' : '#ff3344'; g.fillText('MFL', Math.round(sx), Math.round(w0[1] + wh / 2 + 1)); }
        }
        // sidelines
        g.strokeStyle = '#e8f0e8'; g.lineWidth = 1;
        for (const sx of [-HW, HW]) { const a = proj(sx, 0, -CAM_D + 1.5), b = proj(sx, 0, k.d); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        // yard lines
        for (let yl = 0; yl <= 50; yl += 5) {
          const zz = goalZ - yl;
          if (zz < -CAM_D + 2) break;
          const a = proj(-HW, 0, zz), b = proj(HW, 0, zz);
          const thick = yl === 0 ? 2 : 1;
          g.fillStyle = yl === 0 ? '#ffffff' : 'rgba(240,248,240,0.75)';
          g.fillRect(Math.round(a[0]), Math.round(a[1]), Math.round(b[0] - a[0]), Math.max(thick, Math.round(a[2] * 0.12)));
          // hash marks
          for (let h = 1; h < 5; h++) {
            const hz = zz - h;
            if (hz < -CAM_D + 2) break;
            for (const hx of [-3.1, 3.1]) { const p = proj(hx, 0, hz); rect(p[0] - p[2] * 0.4, p[1], p[2] * 0.8, 1, 'rgba(240,248,240,0.55)'); }
          }
        }
        // line of scrimmage (blue) and ball spot
        const s0 = proj(-HW, 0, 7), s1 = proj(HW, 0, 7);
        rect(s0[0], s0[1], s1[0] - s0[0], Math.max(1, s0[2] * 0.1), 'rgba(80,160,255,0.7)');
      }

      function drawPosts() {
        const k = cur(), hw = L.postW / 2;
        const base = proj(0, 0, k.d + 1.6), barL = proj(-hw, BAR, k.d), barR = proj(hw, BAR, k.d), mid = proj(0, BAR, k.d);
        const s = mid[2];
        const t = Math.max(1, Math.round(s * 0.28));
        // shadow
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.round(barL[0]), Math.round(base[1]) + 1, Math.round(barR[0] - barL[0]), Math.max(1, Math.round(s * 0.2)));
        // padded base post with gooseneck
        const nk = proj(0, BAR - 0.8, k.d + 1.6);
        rect(base[0] - t, nk[1], t * 2, base[1] - nk[1], '#e0a800');
        rect(base[0] - t - 1, base[1] - s * 1.8, t * 2 + 2, s * 1.8, '#2b3446');
        const nk2 = proj(0, BAR - 0.8, k.d);
        rect(Math.min(nk[0], nk2[0]) - t / 2, nk2[1], t, Math.max(1, nk[1] - nk2[1]) + 1, '#e0a800');
        rect(mid[0] - t / 2, nk2[1], t, mid[1] - nk2[1], '#ffc21a');
        // crossbar
        rect(barL[0], mid[1] - t / 2, barR[0] - barL[0], t, '#ffc21a');
        rect(barL[0], mid[1] + t / 2, barR[0] - barL[0], 1, '#a37a00');
        // uprights
        for (const x of [-hw, hw]) {
          const top = proj(x, BAR + UPR, k.d), bot = proj(x, BAR, k.d);
          rect(bot[0] - t / 2, top[1], t, bot[1] - top[1] + t / 2, '#ffc21a');
          rect(bot[0] + t / 2, top[1], 1, bot[1] - top[1], '#a37a00');
          // wind ribbon
          const len = 1 + k.mph * 0.18 * s;
          const wv = Math.sin(time * (4 + k.mph * 0.3) + x) * Math.max(1, s * 0.3);
          g.fillStyle = '#ff3344';
          g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(top[0] + k.dir * len, top[1] + s * 0.25 + wv); g.lineTo(top[0], top[1] + s * 0.6); g.closePath(); g.fill();
        }
      }

      function drawBall() {
        if (!ball) return;
        const [sx, sy, s] = proj(ball.x, ball.y, ball.z);
        const sh = proj(ball.x, 0, ball.z);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(sh[0], sh[1], Math.max(1, s * 0.35), Math.max(0.6, s * 0.12), 0, 0, Math.PI * 2); g.fill();
        // trail
        for (let i = 0; i < ball.trail.length; i++) {
          const [tx, ty] = ball.trail[i];
          g.fillStyle = `rgba(255,255,255,${(i / ball.trail.length) * 0.35})`;
          g.fillRect(Math.round(tx), Math.round(ty), 1, 1);
        }
        const r = Math.max(1.6, s * 0.36);
        const squash = Math.abs(Math.cos(ball.spin));
        g.save(); g.translate(sx, sy);
        g.fillStyle = '#3a1d0a';
        g.beginPath(); g.ellipse(0, 0, r + 0.8, r * (0.55 + 0.45 * squash) + 0.8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#9a5424';
        g.beginPath(); g.ellipse(0, 0, r, r * (0.55 + 0.45 * squash), 0, 0, Math.PI * 2); g.fill();
        if (r > 2.5) { g.fillStyle = '#c47a3a'; g.fillRect(Math.round(-r * 0.5), Math.round(-r * 0.4 * squash) - 1, Math.max(1, Math.round(r * 0.5)), 1); }
        if (squash > 0.4 && r > 2) { g.fillStyle = '#fff'; g.fillRect(Math.round(-r * 0.35), 0, Math.max(1, Math.round(r * 0.7)), 1); }
        g.restore();
      }

      function person(ax, ay, u, jersey, num, pose) {
        // back view, anchored at feet (ax, ay); u = pixel unit
        const R = (x, y, w, h, c) => rect(ax + x * u, ay - y * u, w * u, h * u, c);
        if (pose === 'kneel') {
          R(-3, 3, 6, 3, '#e8e8e8'); // shorts/leg on ground
          R(-4, 1, 3, 1, '#1a1a1a'); R(2, 1, 3, 1, '#1a1a1a');
          R(-3, 9, 6, 6, jersey); R(-4, 8, 1, 4, jersey); R(3, 8, 1, 4, jersey);
          R(-2, 12, 4, 3, '#5a3a22'); R(-2, 12, 4, 1, '#3a2414');
          return;
        }
        const step = pose || 0;
        R(-3, 6, 2, 6 - step, '#d9a77a'); R(1, 6 + step * 0.6, 2, 6, '#d9a77a');
        R(-3, 1, 2, 1, '#111'); R(1, 1 + step * 0.6, 2, 1, '#111');
        R(-3, 8, 6, 3, '#e8e8e8');
        R(-4, 15, 8, 7, jersey); R(-5, 14, 1, 5, jersey); R(4, 14, 1, 5, jersey);
        R(-5, 9, 1, 1, '#d9a77a'); R(4, 9, 1, 1, '#d9a77a');
        if (u >= 1) { g.font = `${Math.max(5, Math.round(u * 5))}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(num, Math.round(ax), Math.round(ay - 11.5 * u)); }
        R(-2, 18, 4, 3, '#4a2e1a'); R(-2, 18, 4, 1, '#2e1c10');
      }

      function drawKicker() {
        const [bx, by, s] = proj(0, 0, 0);
        const u = Math.max(1, Math.round(s * 0.11));
        // holder kneels to the left of the ball
        const hp = proj(-0.9, 0, 0.2);
        person(hp[0], hp[1], u, '#1b3a8a', '', 'kneel');
        // kicker approaches from back-left
        let t = state === 'windup' ? kickerT : (state === 'aim' ? 0 : 1);
        const kz = -2.4 + t * 1.7, kx = -2.1 + t * 1.4;
        const kp = proj(kx, 0, kz);
        const ku = Math.max(1, Math.round(kp[2] * 0.11));
        const pose = state === 'aim' ? 0 : (state === 'windup' ? (Math.floor(kickerT * 6) % 2) * 2 : 4);
        person(kp[0], kp[1], ku, '#1b3a8a', '3', pose);
        if (!ball || state === 'aim' || state === 'windup') {
          // ball on the hold
          const r = Math.max(2, s * 0.36);
          g.fillStyle = '#3a1d0a'; g.beginPath(); g.ellipse(bx, by - r, r * 0.65 + 0.8, r + 0.8, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#9a5424'; g.beginPath(); g.ellipse(bx, by - r, r * 0.65, r, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.fillRect(Math.round(bx), Math.round(by - r * 1.6), 1, Math.max(1, Math.round(r * 1.2)));
        }
      }

      function drawWind() {
        const k = cur();
        const w = 124, h = 16, x = Math.round(IW / 2 - w / 2), y = 4;
        g.fillStyle = 'rgba(7,8,11,0.72)'; g.fillRect(x, y, w, h);
        g.fillStyle = '#2a2f3c'; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
        const ay = y + 8;
        text('WIND', x + 4, ay, 8, '#6f7584', 'left');
        text(k.mph ? `${k.mph} MPH` : 'CALM', x + w - 4, ay, 8, k.mph >= 12 ? '#ff3344' : k.mph >= 7 ? '#ffc21a' : '#f5f6f8', 'right');
        if (!k.mph) return;
        const ax = x + 42, len = 6 + Math.min(10, Math.round(k.mph * 0.6));
        const wob = Math.round(Math.sin(time * 6) * 1);
        g.fillStyle = '#4cc9ff';
        const x0 = ax + (k.dir > 0 ? 0 : len) + wob, x1 = ax + (k.dir > 0 ? len : 0) + wob;
        g.fillRect(Math.min(x0, x1), ay - 1, Math.abs(x1 - x0), 2);
        for (let i = 0; i < 4; i++) g.fillRect(x1 - k.dir * i, ay - 3 + i, 1, 7 - i * 2);
      }

      function drawAim() {
        if (state === 'aim' && drag) {
          const sw = preview(drag);
          if (sw) {
            const k = cur();
            // dotted guide toward aim point at bar
            const [bx, by] = proj(0, 0, 0);
            const ap = proj(sw.slope * k.d, BAR + 1, k.d);
            const n = 16;
            for (let i = 1; i < n; i++) {
              if (i % 2) continue;
              const f = i / n;
              g.fillStyle = 'rgba(255,255,255,0.7)';
              g.fillRect(Math.round(bx + (ap[0] - bx) * f), Math.round(by + (ap[1] - by) * f), 1, 1);
            }
            rect(ap[0] - 2, ap[1], 5, 1, '#fff'); rect(ap[0], ap[1] - 2, 1, 5, '#fff');
          }
          // swipe trail
          g.strokeStyle = 'rgba(255,194,26,0.8)'; g.lineWidth = 2; g.beginPath();
          drag.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
          // power meter
          const pw = sw ? sw.power : 0;
          drawPower(pw);
        } else if (state !== 'aim' && ball && state !== 'splash') {
          drawPower(lastPower, true);
        }
        if (state === 'aim' && !drag && (kick === 0 || hint > 0) && Math.floor(time * 2.5) % 2 === 0) {
          text(hint > 0 ? 'SWIPE UP!' : 'SWIPE UP TO KICK', IW / 2, IH - 10, 8, '#ffc21a');
        }
      }
      function drawPower(p, dim) {
        const x = IW - 12, y = Math.round(IH * 0.5), h = Math.round(IH * 0.36), w = 6;
        g.globalAlpha = dim ? 0.5 : 1;
        g.fillStyle = 'rgba(7,8,11,0.75)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        const fh = Math.round(h * p);
        g.fillStyle = p > 0.85 ? '#ff3344' : p > 0.55 ? '#ffc21a' : '#7CFF6B';
        g.fillRect(x, y + h - fh, w, fh);
        g.fillStyle = '#6f7584'; for (let i = 1; i < 4; i++) g.fillRect(x - 2, y + Math.round(h * i / 4), 2, 1);
        g.globalAlpha = 1;
      }

      function drawParticles() { for (const p of particles) { g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } g.globalAlpha = 1; }

      function draw() {
        g.save();
        if (shake > 0) g.translate(Math.round((crand() - 0.5) * shake), Math.round((crand() - 0.5) * shake));
        g.fillStyle = '#07080b'; g.fillRect(-10, -10, IW + 20, IH + 20);
        drawSky();
        drawField();
        const behind = ball && ball.z > cur().d;
        if (behind) drawBall();
        drawPosts();
        if (!behind) drawBall();
        drawKicker();
        drawParticles();
        g.restore();
        drawWind();
        drawAim();
        if (flash > 0) { g.fillStyle = `rgba(255,240,180,${flash * 0.6})`; g.fillRect(0, 0, IW, IH); }
      }

      function loop(ts) {
        if (dead) return;
        const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
        last = ts;
        step(dt);
        draw();
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      // ---- splash ----
      const splash = el('div', 'fg-splash', `
        <div class="fg-title">FIELD GOAL<br>FRENZY</div>
        <p class="fg-how"><b>Swipe up</b> from the ball toward the posts. Swipe direction aims, a <b>longer, faster</b> swipe kicks harder. Watch the <b>wind</b>: it curves the ball!</p>
        <div class="fg-goal">${ctx.levelName || ['Rookie', 'Pro', 'All-Pro', 'Legend'][ctx.level | 0]}: MAKE <em>${L.need} OF 10</em><br>${L.d0}-${L.d1} YARDS</div>
        <button type="button" class="fg-start">START</button>`);
      stage.appendChild(splash);
      splash.querySelector('.fg-start').addEventListener('click', () => {
        splash.remove();
        ctx.sound('whistle');
        state = 'aim';
      });

      // test hook (only when a test page asks for it)
      if (window.__arcTest) window.__arcTest.fieldgoal = { get state() { return state; }, plan, L, proj: (x, y, z) => proj(x, y, z), get IW() { return IW; }, get IH() { return IH; }, get F() { return F; }, CAM_D, BAR, get kick() { return kick; }, get made() { return made; } };
    },
  });
})();
