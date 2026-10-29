// Flag Pull: tap red ball carriers to pull their flags before they score. Don't touch your blue teammates.
(function () {
  const P = 'fp';
  const CSS = `
.fp-wrap{position:relative;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.fp-hud{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;background:#0f1117;border:1px solid #1d212c;border-bottom:0;border-radius:12px 12px 0 0}
.fp-stat{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.fp-stat span{font-family:'Press Start 2P',monospace;font-size:7px;color:#6f7584}
.fp-stat b{font-family:'Press Start 2P',monospace;font-size:11px;color:#ffc21a;white-space:nowrap;display:flex;gap:3px;align-items:center;height:14px;line-height:14px}
.fp-stat.low b{color:#ff3344;animation:fp-blink .5s steps(2) infinite}
.fp-heart{width:12px;height:11px;display:block}
.fp-heart.gone{opacity:.18;filter:grayscale(1)}
.fp-heart.hurt{animation:fp-hurt .5s ease-out}
.fp-quit{font-family:'Press Start 2P',monospace;font-size:8px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;padding:8px 9px;cursor:pointer}
.fp-quit.sure{background:#ff3344;border-color:#ff3344}
.fp-stage{position:relative;overflow:hidden;background:#07080b;border:1px solid #1d212c;border-radius:0 0 12px 12px;touch-action:none}
.fp-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;cursor:pointer}
.fp-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.fp-pop{position:absolute;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:12px;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:fp-rise .9s ease-out both}
.fp-banner{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:fp-zoom .7s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000}
.fp-banner b{display:block;font-size:19px;line-height:1.3}
.fp-banner i{display:block;font-style:normal;font-size:9px;margin-top:8px;color:#f5f6f8}
.fp-flash{position:absolute;inset:0;animation:fp-fade .45s ease-out both}
.fp-splash{position:absolute;inset:0;background:rgba(7,8,11,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px;gap:14px;z-index:3}
.fp-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:18px;line-height:1.45;text-shadow:3px 3px 0 #6b4f00}
.fp-how{font-size:14px;line-height:1.5;color:#c9ccd4;max-width:300px;margin:0}
.fp-how b{color:#f5f6f8}.fp-how .r{color:#ff5566}.fp-how .bl{color:#5b8cff}
.fp-goal{font-family:'Press Start 2P',monospace;font-size:9px;line-height:1.7;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c}
.fp-goal em{font-style:normal;color:#ffc21a}
.fp-start{font-family:'Press Start 2P',monospace;font-size:13px;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:fp-pulse 1.1s ease-in-out infinite}
.fp-start:active{transform:translateY(3px);box-shadow:0 1px 0 #a37a00}
@keyframes fp-rise{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-220%) scale(1)}}
@keyframes fp-zoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes fp-pulse{50%{transform:scale(1.06)}}
@keyframes fp-blink{50%{opacity:.35}}
@keyframes fp-fade{from{opacity:.55}to{opacity:0}}
@keyframes fp-hurt{0%{transform:scale(1.8)}100%{transform:scale(1)}}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css')) return;
    const s = document.createElement('style'); s.id = P + '-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const HEART = '<svg class="fp-heart" viewBox="0 0 7 6" shape-rendering="crispEdges"><path fill="#ff3344" d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/><path fill="#ff8a95" d="M1 1h1v1H1z"/></svg>';

  // T = seconds to run the field (start -> end of game), I = seconds between runners (start -> end)
  const LEVELS = [
    { lanes: 4, T0: 4.2, T1: 3.0, I0: 1.25, I1: 0.75, mate: 0.12, juke: 0, burst: 0 },
    { lanes: 4, T0: 3.5, T1: 2.4, I0: 1.0, I1: 0.6, mate: 0.2, juke: 0.12, burst: 0 },
    { lanes: 5, T0: 2.9, T1: 2.0, I0: 0.85, I1: 0.5, mate: 0.26, juke: 0.22, burst: 0.1 },
    { lanes: 5, T0: 2.5, T1: 1.6, I0: 0.72, I1: 0.42, mate: 0.32, juke: 0.35, burst: 0.2 },
  ];
  const DUR = 45, LIVES = 3;
  const FONT = '"Press Start 2P", monospace';
  const SKIN = ['#f1c7a0', '#d9a77a', '#a86f45', '#7a4a2a', '#5a3620'];
  const HAIR = ['#2b1a0e', '#4a2e1a', '#111111', '#7a4a1a', '#c9a24a'];

  MFLArcade.register('flagpull', {
    start(ctx) {
      injectCSS();
      try { document.fonts && document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
      const L = LEVELS[Math.max(0, Math.min(3, ctx.level | 0))];
      const rng = ctx.rng;
      let cs = 4242;
      const crand = () => { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; };

      const root = ctx.root;
      root.innerHTML = '';
      const wrap = el('div', 'fp-wrap');
      const hud = el('div', 'fp-hud');
      const sTime = el('div', 'fp-stat', `<span>TIME</span><b>${DUR}</b>`);
      const sFlags = el('div', 'fp-stat', '<span>FLAGS</span><b>0</b>');
      const sLives = el('div', 'fp-stat', `<span>LIVES</span><b>${HEART.repeat(LIVES)}</b>`);
      const sCombo = el('div', 'fp-stat', '<span>COMBO</span><b>-</b>');
      const quit = el('button', 'fp-quit', 'QUIT'); quit.type = 'button';
      hud.append(sTime, sFlags, sLives, sCombo, quit);
      const stage = el('div', 'fp-stage');
      const cv = el('canvas', 'fp-cv');
      const fx = el('div', 'fp-fx');
      stage.append(cv, fx);
      wrap.append(hud, stage);
      root.appendChild(wrap);
      const g = cv.getContext('2d');

      let IW = 200, IH = 290, PX = 2, ezY = 240, laneW = 50, U = 2;
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
        ezY = Math.round(IH * 0.83); laneW = IW / L.lanes; U = Math.max(1, Math.floor(laneW / 17));
        g.imageSmoothingEnabled = false;
      }
      fit();
      const onResize = () => fit();
      window.addEventListener('resize', onResize);
      const laneX = (l) => (l + 0.5) * laneW;

      // ---- state ----
      let state = 'splash', elapsed = 0, lives = LIVES, flags = 0, combo = 0, bestCombo = 0, scored = 0, penalties = 0, spawned = 0;
      let runners = [], particles = [], flying = [], spawnT = 0.7, shake = 0, time = 0, dead = false, raf = 0, last = 0, lastLane = -1;

      function hearts() {
        const b = sLives.querySelector('b'); b.innerHTML = '';
        for (let i = 0; i < LIVES; i++) { const t = document.createElement('template'); t.innerHTML = HEART; const h = t.content.firstChild; if (i >= lives) h.classList.add('gone'); if (i === lives) h.classList.add('hurt'); b.appendChild(h); }
      }
      function updHud() {
        const left = Math.max(0, DUR - elapsed);
        sTime.querySelector('b').textContent = Math.ceil(left);
        sTime.classList.toggle('low', state === 'play' && left <= 5);
        sFlags.querySelector('b').textContent = flags;
        sCombo.querySelector('b').textContent = combo >= 2 ? 'x' + combo : '-';
      }
      function pop(x, y, txt, col, size) {
        const r = cv.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        const e = el('div', 'fp-pop', txt);
        e.style.left = (r.left - sr.left + x / IW * r.width) + 'px';
        e.style.top = (r.top - sr.top + y / IH * r.height) + 'px';
        e.style.color = col; if (size) e.style.fontSize = size + 'px';
        fx.appendChild(e); setTimeout(() => e.remove(), 950);
      }
      function banner(txt, sub, col, ms) {
        fx.querySelectorAll('.fp-banner').forEach((b) => b.remove());
        const b = el('div', 'fp-banner', `<b style="color:${col}">${txt}</b>${sub ? `<i>${sub}</i>` : ''}`);
        fx.appendChild(b);
        if (ms) setTimeout(() => b.remove(), ms);
      }
      function flashScreen(col) { const f = el('div', 'fp-flash'); f.style.background = col; fx.appendChild(f); setTimeout(() => f.remove(), 500); }
      function burst(x, y, n, colors, spd) {
        for (let i = 0; i < n; i++) { const a = crand() * 6.283, v = spd * (0.25 + crand()); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, life: 0.5 + crand() * 0.5, c: colors[i % colors.length] }); }
      }

      function spawn() {
        const f = Math.min(1, elapsed / DUR);
        const T = (L.T0 + (L.T1 - L.T0) * f) * (0.88 + 0.24 * rng());
        let lane = Math.floor(rng() * L.lanes);
        if (lane === lastLane) lane = (lane + 1 + Math.floor(rng() * (L.lanes - 1))) % L.lanes;
        // don't stack on a runner that just entered this lane
        if (runners.some((r) => r.lane === lane && r.p < 0.1 && r.st === 'run')) lane = (lane + 1) % L.lanes;
        lastLane = lane;
        const mate = spawned > 1 && rng() < L.mate;
        const r = {
          lane, x: laneX(lane), p: -0.08, v: 1 / T, mate, st: 'run', t: 0, num: 1 + Math.floor(rng() * 89),
          skin: Math.floor(rng() * SKIN.length), hair: Math.floor(rng() * HAIR.length), ph: rng() * 6,
          juke: null, burst: null, hitFlash: 0,
        };
        if (!mate && rng() < L.juke) { const dir = lane === 0 ? 1 : lane === L.lanes - 1 ? -1 : (rng() < 0.5 ? -1 : 1); r.juke = { at: 0.2 + rng() * 0.35, to: lane + dir, done: false, k: 0, from: lane }; }
        if (!mate && rng() < L.burst) r.burst = { at: 0.3 + rng() * 0.3, on: false };
        runners.push(r);
        spawned++;
        spawnT = (L.I0 + (L.I1 - L.I0) * f) * (0.8 + 0.4 * rng());
      }

      // ---- input ----
      function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * IW, y: (e.clientY - r.top) / r.height * IH }; }
      const sprH = () => 22 * U;
      cv.addEventListener('pointerdown', (e) => {
        if (state !== 'play' || dead) return;
        e.preventDefault();
        const p = pt(e);
        let best = null, bd = 1e9;
        const hx = Math.max(laneW * 0.5, 14), hh = sprH() * 0.75 + 6;
        for (const r of runners) {
          if (r.st !== 'run') continue;
          const ry = r.p * ezY - sprH() * 0.45;
          const dx = Math.abs(p.x - r.x), dy = Math.abs(p.y - ry);
          if (dx < hx && dy < hh) { const d = dx * dx + dy * dy * 0.6; if (d < bd) { bd = d; best = r; } }
        }
        if (!best) { burst(p.x, p.y, 4, ['#d9f7c4', '#6fbf4f'], 15); return; }
        const ry = best.p * ezY;
        if (best.mate) {
          best.st = 'mate-hit'; best.hitFlash = 0.6;
          penalties++; combo = 0;
          loseLife('PENALTY!', "THAT'S YOUR TEAMMATE", '#ffe14d');
          // yellow penalty flag
          flying.push({ x: best.x, y: ry - sprH(), vx: (crand() - 0.5) * 40, vy: -70, rot: 0, life: 1.1, col: '#ffe14d', big: true });
          return;
        }
        best.st = 'pulled'; best.t = 0;
        flags++; combo++; bestCombo = Math.max(bestCombo, combo);
        ctx.sound('catch');
        const side = p.x < best.x ? -1 : 1;
        flying.push({ x: best.x + side * 4 * U, y: ry - 9 * U, vx: side * (40 + crand() * 30), vy: -90 - crand() * 40, rot: 0, life: 0.9, col: '#ffe14d' });
        burst(best.x, ry - 9 * U, 12, ['#ffe14d', '#ffffff', '#ffc21a'], 45);
        shake = Math.max(shake, 2);
        pop(best.x, ry - sprH() - 4, combo >= 5 ? `+1 x${combo}!` : '+1', combo >= 5 ? '#7CFF6B' : '#ffe14d', combo >= 5 ? 12 : 13);
        if (combo > 0 && combo % 10 === 0) { banner(`${combo} COMBO!`, 'LOCKDOWN DEFENSE', '#7CFF6B', 900); ctx.sound('good'); }
        updHud();
      });

      function loseLife(txt, sub, col) {
        lives--; shake = 8; ctx.sound('bad');
        flashScreen(col === '#ffe14d' ? 'rgba(255,225,77,.5)' : 'rgba(255,51,68,.55)');
        hearts();
        if (lives <= 0) { gameOver(false); return; }
        banner(txt, sub, col, 900);
        updHud();
      }

      function gameOver(won) {
        if (state === 'over') return;
        state = 'over';
        updHud();
        if (won) { ctx.sound('whistle'); banner('FINAL WHISTLE', `${flags} FLAGS PULLED`, '#ffc21a'); burst(IW / 2, IH * 0.4, 60, ['#ffc21a', '#fff', '#7CFF6B', '#4cc9ff'], 80); }
        else banner('GAME OVER', `${flags} FLAGS PULLED`, '#ff3344');
        setTimeout(() => finish(won), 1400);
      }
      let finished = false;
      function finish(won, quitted) {
        if (finished) return; finished = true; dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        const secs = Math.round(Math.min(DUR, elapsed));
        ctx.finish({
          won: !!won && !quitted,
          score: flags,
          detail: quitted ? `Quit after ${secs}s (${flags} flags).` : won ? `Survived ${DUR}s with ${lives} ${lives === 1 ? 'life' : 'lives'} left: ${flags} flags pulled.` : `Ran out of lives at ${secs}s: ${flags} flags pulled.`,
          stats: { flags, lives, touchdowns: scored, penalties, bestCombo, seconds: secs },
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
        if (shake > 0) shake = Math.max(0, shake - dt * 20);
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; }
        particles = particles.filter((p) => p.life > 0);
        for (const f of flying) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 220 * dt; f.rot += dt * 14; f.life -= dt; }
        flying = flying.filter((f) => f.life > 0);
        if (state !== 'play' && state !== 'over') return;
        if (state === 'play') {
          elapsed += dt;
          if (elapsed >= DUR) { elapsed = DUR; for (const r of runners) if (r.st === 'run') r.st = 'stop'; gameOver(true); }
          else { spawnT -= dt; if (spawnT <= 0) spawn(); }
          updHud();
        }
        for (const r of runners) {
          r.t += dt;
          if (r.hitFlash > 0) r.hitFlash -= dt;
          if (r.st === 'run' || r.st === 'mate-hit') {
            let v = r.v;
            if (r.burst) { if (!r.burst.on && r.p > r.burst.at) { r.burst.on = true; } if (r.burst.on) v *= 1.55; }
            r.p += v * dt;
            if (r.juke && !r.juke.done && r.p > r.juke.at) {
              r.juke.k = Math.min(1, r.juke.k + dt / 0.28);
              r.x = laneX(r.juke.from) + (laneX(r.juke.to) - laneX(r.juke.from)) * r.juke.k;
              if (r.juke.k >= 1) { r.juke.done = true; r.lane = r.juke.to; }
            } else if (!r.juke || r.juke.done) r.x = laneX(r.lane);
            if (r.p >= 1) {
              if (r.mate || r.st === 'mate-hit') { r.st = 'gone'; }
              else if (state === 'play') {
                r.st = 'td'; r.t = 0; scored++; combo = 0;
                burst(r.x, ezY + 10, 24, ['#ff3344', '#ffffff'], 60);
                loseLife('TOUCHDOWN!', lives > 1 ? `${lives - 1} ${lives - 1 === 1 ? 'LIFE' : 'LIVES'} LEFT` : '', '#ff3344');
              } else r.st = 'stop';
            }
          } else if (r.st === 'pulled') {
            r.p += r.v * dt * Math.max(0, 1 - r.t * 3);
            if (r.t > 0.9) r.st = 'gone';
          } else if (r.st === 'td') {
            if (r.t > 1.1) r.st = 'gone';
          } else if (r.st === 'stop') {
            if (r.t > 3) r.st = 'gone';
          }
        }
        runners = runners.filter((r) => r.st !== 'gone');
      }

      // ---- draw ----
      function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
      function text(t, x, y, size, col, align) {
        g.font = `${size}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(t, Math.round(x) + 1, Math.round(y) + 1);
        g.fillStyle = col; g.fillText(t, Math.round(x), Math.round(y));
      }

      function drawField() {
        const scroll = state === 'play' ? 0 : 0;
        const band = Math.round(ezY / 8);
        for (let i = 0; i < 8; i++) rect(0, i * band + scroll, IW, band + 1, i % 2 ? '#2f7a33' : '#36873a');
        for (let i = 1; i < 8; i++) rect(0, i * band, IW, 1, 'rgba(240,248,240,.45)');
        // lane hash marks
        for (let l = 1; l < L.lanes; l++) for (let y = 4; y < ezY; y += 10) rect(l * laneW, y, 1, 4, 'rgba(240,248,240,.18)');
        // end zone
        rect(0, ezY, IW, IH - ezY, '#6e1622');
        for (let x = -IH; x < IW; x += 12) { g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, IH); g.lineTo(x + 6, IH); g.lineTo(x + 6 + (IH - ezY), ezY); g.lineTo(x + (IH - ezY), ezY); g.fill(); }
        rect(0, ezY, IW, 2, '#ffffff');
        text('END ZONE', IW / 2, ezY + (IH - ezY) / 2 + 1, 8, 'rgba(255,255,255,.55)');
        // pylons
        rect(0, ezY - 2, 3, 6, '#ff8a00'); rect(IW - 3, ezY - 2, 3, 6, '#ff8a00');
      }

      function drawRunner(r) {
        const fy = r.p * ezY; // feet y
        const x = r.x;
        const u = U;
        let alpha = 1, jump = 0, gray = false;
        if (r.st === 'pulled') { alpha = Math.max(0, 1 - Math.max(0, r.t - 0.4) * 2); gray = true; }
        if (r.st === 'td') jump = Math.abs(Math.sin(r.t * 9)) * 5 * u;
        if (r.st === 'stop') alpha = Math.max(0, 1 - r.t / 3);
        if (fy < -sprH() - 4) return;
        g.globalAlpha = alpha;
        const R = (dx, dy, w, h, c) => rect(x + dx * u, fy - jump + dy * u, w * u, h * u, c);
        // shadow
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, fy + u, 5 * u, 1.6 * u, 0, 0, 6.283); g.fill();
        const run = r.st === 'run' || r.st === 'mate-hit';
        const fr = run ? Math.floor((r.t * 10 + r.ph)) % 2 : 0;
        const jersey = gray ? '#7a7f8f' : r.mate ? '#2a62ff' : '#ff3344';
        const jDark = gray ? '#5a5f6c' : r.mate ? '#1a3fa8' : '#a8182a';
        const skin = SKIN[r.skin], hair = HAIR[r.hair];
        // legs
        R(-3, -7 + (fr ? 1 : 0), 2, 5 - (fr ? 1 : 0), skin); R(1, -7 + (fr ? 0 : 1), 2, 5 - (fr ? 0 : 1), skin);
        R(-3, -2 + (fr ? 0 : 0), 2, 2, '#111'); R(1, -2, 2, 2, '#111');
        if (fr) R(-3, -3, 2, 1, '#111'); else R(1, -3, 2, 1, '#111');
        // shorts
        R(-4, -10, 8, 3, '#e8e8e8');
        // flags on hips
        const flagC = '#ffe14d';
        if (r.st !== 'pulled') {
          const sw = run ? (fr ? 1 : 0) : 0;
          R(-6, -10, 2, 5 + sw, flagC); R(4, -10, 2, 6 - sw, flagC);
        } else {
          R(4, -10, 2, 5, flagC);
        }
        // torso
        R(-4, -17, 8, 7, jersey); R(-4, -11, 8, 1, jDark);
        // arms swinging
        R(-6, -17 + (fr ? 0 : 1), 2, 5, jersey); R(4, -17 + (fr ? 1 : 0), 2, 5, jersey);
        R(-6, -12 + (fr ? 0 : 1), 2, 1, skin); R(4, -12 + (fr ? 1 : 0), 2, 1, skin);
        // number
        if (u >= 2) { g.font = `${Math.max(6, 4 * u)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(r.num % 10), Math.round(x), Math.round(fy - jump - 13.5 * u)); }
        else R(-1, -15, 2, 3, '#ffffff');
        // head
        R(-2, -22, 4, 5, skin); R(-2, -22, 4, 1, hair); R(-3, -21, 1, 2, hair); R(2, -21, 1, 2, hair);
        R(-1, -20, 1, 1, '#111'); R(1, -20, 1, 1, '#111');
        // ball (ball carriers)
        if (!r.mate) {
          if (r.st === 'td') { R(-1, -27 - (Math.floor(r.t * 8) % 2), 3, 2, '#9a5424'); R(0, -26, 1, 1, '#fff'); }
          else { R(-7, -15, 3, 4, '#9a5424'); R(-7, -14, 1, 2, '#fff'); }
        }
        if (r.hitFlash > 0 && Math.floor(r.hitFlash * 12) % 2) { g.globalAlpha = 0.6; R(-6, -22, 12, 22, '#ffffff'); }
        g.globalAlpha = 1;
      }

      function draw() {
        g.save();
        if (shake > 0) g.translate(Math.round((crand() - 0.5) * shake), Math.round((crand() - 0.5) * shake));
        g.fillStyle = '#07080b'; g.fillRect(-10, -10, IW + 20, IH + 20);
        drawField();
        const list = runners.slice().sort((a, b) => a.p - b.p);
        for (const r of list) drawRunner(r);
        for (const f of flying) {
          g.save(); g.translate(f.x, f.y); g.rotate(f.rot); g.globalAlpha = Math.min(1, f.life * 2);
          const s = f.big ? 2 : 1;
          g.fillStyle = f.col; g.fillRect(-U * s, -3 * U * s, 2 * U * s, 6 * U * s);
          if (f.big) { g.fillStyle = '#c9a400'; g.fillRect(-U * s, -3 * U * s, U, 6 * U * s); }
          g.restore();
        }
        g.globalAlpha = 1;
        for (const p of particles) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
        g.globalAlpha = 1;
        g.restore();
        // speed-up meter (top progress bar)
        const f = Math.min(1, elapsed / DUR);
        rect(0, 0, IW, 2, 'rgba(0,0,0,.5)'); rect(0, 0, IW * f, 2, f > 0.85 ? '#ff3344' : '#ffc21a');
        if (state === 'play' && elapsed < 2.5 && Math.floor(time * 3) % 2 === 0) text('TAP RED RUNNERS!', IW / 2, 18, 8, '#ffc21a');
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
      const splash = el('div', 'fp-splash', `
        <div class="fp-title">FLAG PULL</div>
        <p class="fp-how"><b>Tap</b> the <b class="r">red</b> ball carriers to pull their flags before they reach the end zone. <b>Don't tap</b> your <b class="bl">blue</b> teammates: that's a penalty! It gets faster as the clock runs.</p>
        <div class="fp-goal">${lvName}: SURVIVE <em>${DUR}s</em><br>${LIVES} LIVES: TD OR PENALTY = -1</div>
        <button type="button" class="fp-start">START</button>`);
      stage.appendChild(splash);
      hearts(); updHud(); draw();
      splash.querySelector('.fp-start').addEventListener('click', () => {
        splash.remove(); ctx.sound('whistle'); state = 'play';
      });

      if (window.__arcTest) window.__arcTest.flagpull = { get state() { return state; }, get runners() { return runners; }, get IW() { return IW; }, get IH() { return IH; }, get ezY() { return ezY; }, sprH, get flags() { return flags; }, get lives() { return lives; } };
    },
  });
})();
