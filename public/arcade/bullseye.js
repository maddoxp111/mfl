// QB Bullseye: 10 throws at moving targets. Pull back, aim, release, lead the target.
(function () {
  const P = 'qb';
  const CSS = `
.qb-wrap{position:relative;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.qb-hud{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;background:#0f1117;border:1px solid #1d212c;border-bottom:0;border-radius:12px 12px 0 0}
.qb-stat{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.qb-stat span{font-family:'Press Start 2P',monospace;font-size:7px;color:#6f7584}
.qb-stat b{font-family:'Press Start 2P',monospace;font-size:11px;color:#ffc21a;white-space:nowrap}
.qb-stat.low b{color:#ff3344;animation:qb-blink .5s steps(2) infinite}
.qb-quit{font-family:'Press Start 2P',monospace;font-size:8px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;padding:8px 9px;cursor:pointer}
.qb-quit.sure{background:#ff3344;border-color:#ff3344}
.qb-stage{position:relative;overflow:hidden;background:#07080b;border:1px solid #1d212c;border-radius:0 0 12px 12px;touch-action:none}
.qb-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;cursor:crosshair}
.qb-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.qb-pop{position:absolute;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:12px;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:qb-rise 1.1s ease-out both}
.qb-banner{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:qb-zoom .8s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000}
.qb-banner b{display:block;font-size:20px;line-height:1.3}
.qb-banner i{display:block;font-style:normal;font-size:10px;margin-top:8px}
.qb-splash{position:absolute;inset:0;background:rgba(7,8,11,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px;gap:14px;z-index:3}
.qb-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:17px;line-height:1.45;text-shadow:3px 3px 0 #6b4f00}
.qb-how{font-size:14px;line-height:1.5;color:#c9ccd4;max-width:300px;margin:0}
.qb-how b{color:#f5f6f8}
.qb-key{display:flex;gap:10px;justify-content:center;font-family:'Press Start 2P',monospace;font-size:8px}
.qb-key span{display:flex;align-items:center;gap:5px}
.qb-key i{display:inline-block;width:12px;height:12px;border-radius:50%;border:3px solid}
.qb-goal{font-family:'Press Start 2P',monospace;font-size:9px;line-height:1.7;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c}
.qb-goal em{font-style:normal;color:#ffc21a}
.qb-start{font-family:'Press Start 2P',monospace;font-size:13px;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:qb-pulse 1.1s ease-in-out infinite}
.qb-start:active{transform:translateY(3px);box-shadow:0 1px 0 #a37a00}
@keyframes qb-rise{0%{opacity:0;transform:translate(-50%,-20%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-220%) scale(1)}}
@keyframes qb-zoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes qb-pulse{50%{transform:scale(1.06)}}
@keyframes qb-blink{50%{opacity:.35}}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css')) return;
    const s = document.createElement('style'); s.id = P + '-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // per level: target radius (yd) and speed (yd/s) for near/mid/deep, vertical bob, play clock, points needed
  const LEVELS = [
    { r: [3.2, 2.7, 2.3], v: [1.6, 2.4, 3.2], bob: 0, clock: 15, need: 8 },
    { r: [2.8, 2.3, 1.9], v: [2.4, 3.4, 4.4], bob: 0, clock: 12, need: 13 },
    { r: [2.4, 2.0, 1.6], v: [3.2, 4.4, 5.6], bob: 1.0, clock: 10, need: 18 },
    { r: [2.1, 1.7, 1.35], v: [4.0, 5.4, 7.0], bob: 1.6, clock: 8, need: 24 },
  ];
  const TIERS = [
    { y0: 9, y1: 13, pts: 1, col: '#4cc9ff', dark: '#1b6f96' },
    { y0: 18, y1: 23, pts: 3, col: '#ffc21a', dark: '#a37a00' },
    { y0: 28, y1: 34, pts: 5, col: '#ff3344', dark: '#9a1422' },
  ];
  const THROWS = 10, HALF = 16, MAXD = 44, BULL = 0.38;
  const FONT = '"Press Start 2P", monospace';

  MFLArcade.register('bullseye', {
    start(ctx) {
      injectCSS();
      try { document.fonts && document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
      const L = LEVELS[Math.max(0, Math.min(3, ctx.level | 0))];
      const rng = ctx.rng;
      let cs = 98765;
      const crand = () => { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; };

      const root = ctx.root;
      root.innerHTML = '';
      const wrap = el('div', 'qb-wrap');
      const hud = el('div', 'qb-hud');
      const sThrow = el('div', 'qb-stat', '<span>THROW</span><b>1/10</b>');
      const sPts = el('div', 'qb-stat', '<span>POINTS</span><b>0</b>');
      const sGoal = el('div', 'qb-stat', `<span>GOAL</span><b>${L.need}</b>`);
      const sClock = el('div', 'qb-stat', `<span>CLOCK</span><b>${L.clock}</b>`);
      const quit = el('button', 'qb-quit', 'QUIT'); quit.type = 'button';
      hud.append(sThrow, sPts, sGoal, sClock, quit);
      const stage = el('div', 'qb-stage');
      const cv = el('canvas', 'qb-cv');
      const fx = el('div', 'qb-fx');
      stage.append(cv, fx);
      wrap.append(hud, stage);
      root.appendChild(wrap);
      const g = cv.getContext('2d');

      let IW = 200, IH = 290, PX = 2, S = 6, qbY = 255, cx = 100;
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
        S = IW / (HALF * 2); qbY = Math.round(IH * 0.885); cx = IW / 2;
        g.imageSmoothingEnabled = false;
      }
      fit();
      const onResize = () => fit();
      window.addEventListener('resize', onResize);
      const W2S = (x, y) => [cx + x * S, qbY - y * S];

      // ---- state ----
      let state = 'splash', throwN = 0, points = 0, hits = 0, bulls = 0, streak = 0, clock = L.clock, time = 0;
      let targets = [], ball = null, drag = null, particles = [], shake = 0, qbArm = 0, dead = false, raf = 0, last = 0, nextT = 0, lastLand = null;
      const speedMul = () => 1 + 0.04 * throwN;

      function spawn(tier, fromSide) {
        const r = L.r[tier];
        const dir = rng() < 0.5 ? -1 : 1;
        const v = L.v[tier] * (0.85 + 0.3 * rng());
        const y = TIERS[tier].y0 + (TIERS[tier].y1 - TIERS[tier].y0) * rng();
        const x = fromSide ? -dir * (HALF + r + 1) : (rng() * 2 - 1) * (HALF - r - 1);
        return { tier, r, x, y0: y, y, vx: dir * v, ph: rng() * 6.28, pop: 0, alive: true, enter: fromSide ? 1 : 0 };
      }
      for (let t = 0; t < 3; t++) targets.push(spawn(t, false));

      function updHud() {
        sThrow.querySelector('b').textContent = `${Math.min(throwN + 1, THROWS)}/${THROWS}`;
        sPts.querySelector('b').textContent = points;
        sClock.querySelector('b').textContent = Math.max(0, Math.ceil(clock));
        sClock.classList.toggle('low', state === 'aim' && clock <= 3);
      }
      function pop(x, y, txt, col, size) {
        const r = cv.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        const e = el('div', 'qb-pop', txt);
        e.style.left = (r.left - sr.left + x / IW * r.width) + 'px';
        e.style.top = (r.top - sr.top + y / IH * r.height) + 'px';
        e.style.color = col; if (size) e.style.fontSize = size + 'px';
        fx.appendChild(e); setTimeout(() => e.remove(), 1200);
      }
      function banner(txt, sub, col) {
        fx.querySelectorAll('.qb-banner').forEach((b) => b.remove());
        const b = el('div', 'qb-banner', `<b style="color:${col}">${txt}</b>${sub ? `<i>${sub}</i>` : ''}`);
        fx.appendChild(b);
        return b;
      }
      function burst(x, y, n, colors, spd) {
        for (let i = 0; i < n; i++) { const a = crand() * 6.283, v = spd * (0.25 + crand()); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.6 + crand() * 0.6, c: colors[i % colors.length] }); }
      }

      // ---- input: pull back like a slingshot ----
      function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * IW, y: (e.clientY - r.top) / r.height * IH }; }
      const ypp = () => MAXD / (0.34 * IH); // yards per internal pixel of pull
      function aimFrom(d) {
        const dx = d.c.x - d.s.x, dy = d.c.y - d.s.y;
        if (Math.hypot(dx, dy) < 6) return null;
        let ax = -dx * ypp(), ay = dy * ypp();
        if (ay < 2) ay = 2;
        const len = Math.hypot(ax, ay);
        if (len > MAXD) { ax *= MAXD / len; ay *= MAXD / len; }
        ax = Math.max(-HALF + 0.5, Math.min(HALF - 0.5, ax));
        return { x: ax, y: ay };
      }
      cv.addEventListener('pointerdown', (e) => {
        if (state !== 'aim' || dead || drag) return;
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        const p = pt(e); drag = { id: e.pointerId, s: p, c: p };
      });
      cv.addEventListener('pointermove', (e) => { if (drag && e.pointerId === drag.id) drag.c = pt(e); });
      cv.addEventListener('pointerup', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        drag.c = pt(e);
        const a = aimFrom(drag); drag = null;
        if (state !== 'aim' || !a) return;
        throwBall(a);
      });
      cv.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) drag = null; });

      function throwBall(a) {
        const d = Math.hypot(a.x, a.y);
        ball = { tx: a.x, ty: a.y, d, T: 0.4 + d / 32, t: 0, apex: 1.5 + d * 0.2 };
        state = 'flight'; qbArm = 1;
        ctx.sound('kick');
        updHud();
      }

      function land() {
        const lx = ball.tx, ly = ball.ty;
        let best = null, bestPts = 0, bull = false;
        for (const t of targets) {
          if (!t.alive || t.enter > 0.6) continue;
          const dd = Math.hypot(lx - t.x, ly - t.y);
          if (dd <= t.r) {
            const isB = dd <= t.r * BULL;
            const p = TIERS[t.tier].pts * (isB ? 2 : 1);
            if (p > bestPts) { best = t; bestPts = p; bull = isB; }
          }
        }
        const [sx, sy] = W2S(lx, ly);
        lastLand = { x: lx, y: ly, t: 0.8, hit: !!best };
        if (best) {
          points += bestPts; hits++; streak++; if (bull) bulls++;
          best.alive = false; best.pop = 0.5;
          const [tx, ty] = W2S(best.x, best.y);
          burst(tx, ty, bull ? 50 : 30, [TIERS[best.tier].col, '#ffffff', '#ffc21a'], bull ? 70 : 50);
          shake = bull ? 6 : 3;
          ctx.sound(bull ? 'good' : 'catch');
          if (bull) setTimeout(() => !dead && ctx.sound('catch'), 150);
          pop(tx, ty - 6, bull ? `BULLSEYE +${bestPts}` : `+${bestPts}`, bull ? '#ffc21a' : TIERS[best.tier].col, bull ? 13 : 14);
          if (streak >= 2) setTimeout(() => !dead && pop(IW / 2, IH * 0.5, streak >= 4 ? `${streak} STRAIGHT! ON FIRE` : `${streak} STRAIGHT!`, '#7CFF6B', 10), 250);
          const tier = best.tier;
          setTimeout(() => { if (dead) return; const i = targets.indexOf(best); if (i >= 0) targets[i] = spawn(tier, true); }, 650);
        } else {
          streak = 0;
          ctx.sound('bad');
          burst(sx, sy, 8, ['#d9f7c4', '#6fbf4f'], 25);
          pop(sx, sy - 8, 'INCOMPLETE', '#9aa0ad', 9);
        }
        ball = null;
        endThrow();
      }

      function endThrow() {
        throwN++;
        updHud();
        if (throwN >= THROWS) { state = 'over'; setTimeout(gameOver, 900); return; }
        state = 'wait'; nextT = 0.55;
      }

      function gameOver() {
        if (dead) return;
        const won = points >= L.need;
        banner(won ? 'NICE ARM!' : 'GAME OVER', `${points} POINTS (GOAL ${L.need})`, won ? '#ffc21a' : '#ff3344');
        setTimeout(() => finish(won), 1200);
      }
      let finished = false;
      function finish(won, quitted) {
        if (finished) return; finished = true; dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        ctx.finish({
          won: !!won && !quitted,
          score: points,
          detail: quitted ? `Quit after ${throwN} throws (${points} points).` : `${points} points on ${hits}/${THROWS} hits${bulls ? `, ${bulls} bullseye${bulls > 1 ? 's' : ''}` : ''} (goal ${L.need}).`,
          stats: { points, hits, bulls, throws: throwN, need: L.need },
        });
      }
      let quitArm = 0;
      quit.addEventListener('click', () => {
        if (finished) return;
        if (!quitArm) { quitArm = 1; quit.textContent = 'SURE?'; quit.classList.add('sure'); setTimeout(() => { quitArm = 0; quit.textContent = 'QUIT'; quit.classList.remove('sure'); }, 2200); return; }
        finish(false, true);
      });

      // ---- update ----
      function step(dt) {
        time += dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 16);
        if (qbArm > 0) qbArm = Math.max(0, qbArm - dt * 2.5);
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; }
        particles = particles.filter((p) => p.life > 0);
        if (lastLand) { lastLand.t -= dt; if (lastLand.t <= 0) lastLand = null; }
        if (state === 'splash') return;
        const sm = speedMul();
        for (const t of targets) {
          if (t.pop > 0) t.pop -= dt;
          if (!t.alive) continue;
          t.x += t.vx * sm * dt;
          if (t.enter > 0) { if (Math.abs(t.x) < HALF - t.r) t.enter = 0; }
          else if (t.x > HALF - t.r) { t.x = HALF - t.r; t.vx = -Math.abs(t.vx); }
          else if (t.x < -HALF + t.r) { t.x = -HALF + t.r; t.vx = Math.abs(t.vx); }
          t.y = t.y0 + Math.sin(time * 1.3 + t.ph) * L.bob;
        }
        if (state === 'aim') {
          clock -= dt;
          if (clock <= 0) {
            drag = null; streak = 0;
            ctx.sound('whistle');
            pop(IW / 2, IH * 0.55, 'DELAY OF GAME!', '#ff3344', 11);
            endThrow();
          }
          updHud();
        } else if (state === 'flight') {
          ball.t += dt;
          if (ball.t >= ball.T) land();
        } else if (state === 'wait') {
          nextT -= dt;
          if (nextT <= 0) { state = 'aim'; clock = L.clock; updHud(); }
        }
      }

      // ---- draw ----
      function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
      function text(t, x, y, size, col, align) {
        g.font = `${size}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t, Math.round(x) + 1, Math.round(y) + 1);
        g.fillStyle = col; g.fillText(t, Math.round(x), Math.round(y));
      }
      function circle(x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, 6.2832); g.fill(); }

      function drawField() {
        // grass stripes every 5 yd
        for (let y = -5; y < 60; y += 5) {
          const [, s0] = W2S(0, y), [, s1] = W2S(0, y + 5);
          rect(0, s1, IW, s0 - s1 + 1, (Math.floor(y / 5) & 1) ? '#2f7a33' : '#36873a');
        }
        // yard lines + numbers
        for (let y = 0; y < 60; y += 5) {
          const [, sy] = W2S(0, y);
          if (sy < -4) break;
          rect(0, sy, IW, 1, y === 0 ? 'rgba(80,160,255,.9)' : 'rgba(240,248,240,.6)');
          if (y > 0 && y % 10 === 0) {
            text(String(y), 10, sy - 6, 8, 'rgba(240,248,240,.55)');
            text(String(y), IW - 10, sy - 6, 8, 'rgba(240,248,240,.55)');
          }
          for (let h = 1; h < 5; h++) { const [, hy] = W2S(0, y + h); for (const hx of [-3.1, 3.1]) { const [hx2] = W2S(hx, 0); rect(hx2 - 2, hy, 4, 1, 'rgba(240,248,240,.35)'); } }
        }
      }

      function drawTarget(t) {
        const [sx, sy] = W2S(t.x, t.y), r = t.r * S, T = TIERS[t.tier];
        // shadow
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(sx + 2, sy + 2, r, r, 0, 0, 6.2832); g.fill();
        // tire
        circle(sx, sy, r, '#16181d');
        g.strokeStyle = '#2c3038'; g.lineWidth = 1;
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832 + t.x * 0.15; g.beginPath(); g.moveTo(sx + Math.cos(a) * r * 0.78, sy + Math.sin(a) * r * 0.78); g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); g.stroke(); }
        circle(sx, sy, r * 0.74, T.dark);
        circle(sx, sy, r * 0.62, T.col);
        circle(sx, sy, r * 0.5, '#f5f6f8');
        circle(sx, sy, r * BULL, T.col);
        circle(sx, sy, r * 0.14, '#f5f6f8');
        text(String(T.pts), sx + r + 5, sy - r + 2, 8, T.col);
      }

      function drawQB() {
        const [x, y] = W2S(0, -1.2);
        const u = Math.max(1, Math.round(S * 0.28));
        const R = (dx, dy, w, h, c) => rect(x + dx * u, y + dy * u, w * u, h * u, c);
        R(-5, -1, 10, 5, '#1b3a8a'); // shoulders/jersey
        R(-5, -1, 10, 1, '#2a52b8');
        R(-1, 1, 2, 2, '#ffffff');
        R(-2, -3, 4, 4, '#d9a77a'); R(-2, -3, 4, 2, '#4a2e1a'); // head
        // throwing arm (right)
        if (qbArm > 0.3) { R(4, -6, 2, 6, '#d9a77a'); }
        else if (state === 'aim' && drag) { R(5, 0, 2, 4, '#d9a77a'); circle(x + 6 * u, y + 5 * u, u * 1.5, '#9a5424'); }
        else { R(5, -1, 2, 3, '#d9a77a'); if (state !== 'flight') circle(x + 6 * u, y + 2 * u, u * 1.5, '#9a5424'); }
        R(-7, 0, 2, 3, '#d9a77a');
      }

      function drawAim() {
        if (!(state === 'aim' && drag)) return;
        const a = aimFrom(drag);
        // pull band
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(drag.s.x, drag.s.y); g.lineTo(drag.c.x, drag.c.y); g.stroke();
        circle(drag.s.x, drag.s.y, 2, 'rgba(255,255,255,.5)');
        if (!a) return;
        const d = Math.hypot(a.x, a.y), apex = 1.5 + d * 0.2;
        const [qx, qy] = W2S(0, 0);
        for (let i = 1; i < 24; i++) {
          if (i % 2) continue;
          const f = i / 24, h = 4 * apex * f * (1 - f);
          const [px, py] = W2S(a.x * f, a.y * f);
          rect(px, py - h * S * 0.45, 1, 1, '#ffffff');
        }
        void qx; void qy;
        const [lx, ly] = W2S(a.x, a.y);
        const blink = Math.floor(time * 6) % 2;
        g.strokeStyle = blink ? '#ffc21a' : '#ffffff'; g.lineWidth = 1;
        g.beginPath(); g.arc(lx, ly, 4, 0, 6.2832); g.stroke();
        rect(lx - 7, ly, 4, 1, '#ffc21a'); rect(lx + 4, ly, 4, 1, '#ffc21a'); rect(lx, ly - 7, 1, 4, '#ffc21a'); rect(lx, ly + 4, 1, 4, '#ffc21a');
        text(`${Math.round(d)} YD`, lx, ly - 13, 8, '#ffffff');
      }

      function drawBall() {
        if (!ball) return;
        const f = ball.t / ball.T, h = 4 * ball.apex * f * (1 - f);
        const [gx, gy] = W2S(ball.tx * f, ball.ty * f);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(gx, gy, 3, 1.6, 0, 0, 6.2832); g.fill();
        const by = gy - h * S * 0.45, sc = 1 + h * 0.07;
        const ang = Math.atan2(-ball.ty, ball.tx);
        g.save(); g.translate(gx, by); g.rotate(ang);
        g.fillStyle = '#3a1d0a'; g.beginPath(); g.ellipse(0, 0, 4 * sc + 0.7, 2.4 * sc + 0.7, 0, 0, 6.2832); g.fill();
        g.fillStyle = '#9a5424'; g.beginPath(); g.ellipse(0, 0, 4 * sc, 2.4 * sc, 0, 0, 6.2832); g.fill();
        if (Math.floor(time * 20) % 2) { g.fillStyle = '#fff'; g.fillRect(-2 * sc, -0.5, 4 * sc, 1); }
        g.restore();
      }

      function draw() {
        g.save();
        if (shake > 0) g.translate(Math.round((crand() - 0.5) * shake), Math.round((crand() - 0.5) * shake));
        g.fillStyle = '#07080b'; g.fillRect(-10, -10, IW + 20, IH + 20);
        drawField();
        if (lastLand && !lastLand.hit) { const [lx, ly] = W2S(lastLand.x, lastLand.y); g.globalAlpha = Math.min(1, lastLand.t * 2); rect(lx - 3, ly, 7, 1, '#ff3344'); rect(lx, ly - 3, 1, 7, '#ff3344'); g.globalAlpha = 1; }
        for (const t of targets) if (t.alive) drawTarget(t);
        for (const t of targets) if (!t.alive && t.pop > 0) { const [sx, sy] = W2S(t.x, t.y); g.strokeStyle = `rgba(255,255,255,${t.pop * 2})`; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, t.r * S * (1 + (0.5 - t.pop) * 3), 0, 6.2832); g.stroke(); }
        drawQB();
        drawBall();
        for (const p of particles) { g.globalAlpha = Math.min(1, p.life * 1.5); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
        g.globalAlpha = 1;
        g.restore();
        drawAim();
        if (state === 'aim' && !drag && throwN === 0 && Math.floor(time * 2.5) % 2 === 0) text('PULL BACK + RELEASE', IW / 2, IH - 8, 8, '#ffc21a');
      }

      function loop(ts) {
        if (dead) return;
        const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
        last = ts;
        step(dt); draw();
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      const lvName = ctx.levelName || ['Rookie', 'Pro', 'All-Pro', 'Legend'][ctx.level | 0];
      const splash = el('div', 'qb-splash', `
        <div class="qb-title">QB<br>BULLSEYE</div>
        <p class="qb-how"><b>Drag back</b> like a slingshot, aim at a moving target and <b>let go</b> to throw. The ball takes time to get there, so <b>lead</b> the target! Center ring = <b>double</b>.</p>
        <div class="qb-key"><span><i style="border-color:#4cc9ff"></i>1</span><span><i style="border-color:#ffc21a"></i>3</span><span><i style="border-color:#ff3344"></i>5</span></div>
        <div class="qb-goal">${lvName}: <em>${L.need}+ POINTS</em><br>IN ${THROWS} THROWS</div>
        <button type="button" class="qb-start">START</button>`);
      stage.appendChild(splash);
      draw();
      splash.querySelector('.qb-start').addEventListener('click', () => {
        splash.remove(); ctx.sound('whistle'); state = 'aim'; clock = L.clock; updHud();
      });

      if (window.__arcTest) window.__arcTest.bullseye = { get state() { return state; }, get time() { return time; }, get targets() { return targets; }, get IW() { return IW; }, get IH() { return IH; }, get S() { return S; }, get qbY() { return qbY; }, ypp, speedMul, L, get points() { return points; } };
    },
  });
})();
