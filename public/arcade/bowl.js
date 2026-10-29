// Modern Bowl: a Retro Bowl-style football game. You run the offense; the other
// team's drives are simulated. ctx.data = { mode, home: team, away: team }, where a
// team is { name, abbr, color, color2, players: [{ name, num, pos, ovr, spd, thr, acc, cat, str, kick, def, stars, card }] }
// and pos is QB, RB, WR1, WR2, WR3, TE, UTIL1, UTIL2 (UTIL1 snaps and blocks, UTIL2 kicks).
(function () {
  const FW = 53.33, MID = FW / 2;
  const LVL = [
    { name: 'Rookie', dspd: 5.6, react: 0.55, rush: 1.9, cushion: 4.5, intc: 0.18, td: 0.16, fg: 0.14, track: 1.6, brk: 0.32 },
    { name: 'Pro', dspd: 6.2, react: 0.4, rush: 1.6, cushion: 3.4, intc: 0.3, td: 0.27, fg: 0.15, track: 2.4, brk: 0.24 },
    { name: 'All-Pro', dspd: 6.8, react: 0.28, rush: 1.35, cushion: 2.5, intc: 0.42, td: 0.38, fg: 0.15, track: 3.2, brk: 0.17 },
    { name: 'Legend', dspd: 7.4, react: 0.18, rush: 1.15, cushion: 1.7, intc: 0.55, td: 0.5, fg: 0.14, track: 4, brk: 0.11 },
  ];
  // Routes: waypoints [forward yards, yards toward the middle (negative = toward the sideline)].
  const ROUTES = {
    go: { pts: [[32, 0]] }, seam: { pts: [[32, 2]] }, slant: { pts: [[2, 0], [14, 9]] }, out: { pts: [[7, 0], [7, -14]], stop: true },
    dig: { pts: [[11, 0], [11, 16]] }, post: { pts: [[9, 0], [32, 11]] }, corner: { pts: [[9, 0], [26, -11]] },
    curl: { pts: [[10, 0], [8, 1]], stop: true }, drag: { pts: [[2, 0], [4, 24]] }, flat: { pts: [[1, -9]], stop: true },
    wheel: { pts: [[1, -8], [26, -9]] }, screen: { pts: [[-1, -6]], stop: true }, hitch: { pts: [[6, 0], [5, 0]], stop: true },
  };
  const PLAYS = [
    { name: 'Four Verts', r: { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam', RB: 'flat' } },
    { name: 'Slant Flood', r: { WR1: 'slant', WR2: 'slant', WR3: 'out', TE: 'drag', RB: 'wheel' } },
    { name: 'Mesh', r: { WR1: 'post', WR2: 'hitch', WR3: 'drag', TE: 'drag', RB: 'flat' } },
    { name: 'Smash', r: { WR1: 'hitch', WR2: 'corner', WR3: 'corner', TE: 'out', RB: 'flat' } },
    { name: 'Post Dig', r: { WR1: 'post', WR2: 'dig', WR3: 'curl', TE: 'seam', RB: 'screen' } },
    { name: 'Spider Y', r: { WR1: 'out', WR2: 'go', WR3: 'slant', TE: 'corner', RB: 'wheel' } },
    { name: 'Curl Flat', r: { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE: 'dig', RB: 'screen' } },
  ];
  const SKIN = ['#f1c7a1', '#d9a17a', '#a8714a', '#7a4e2d', '#5a3a22'];
  const css = `.mb-wrap{position:relative;width:100%;user-select:none;-webkit-user-select:none}
.mb-wrap canvas{display:block;width:100%;border-radius:18px;touch-action:none;background:#2f7d32;box-shadow:0 20px 60px -20px rgba(0,0,0,.9)}
.mb-bar{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:10px}
.mb-bar button{font:700 12px Inter;color:#aeb3c0;background:#161922;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 14px;cursor:pointer}
.mb-bar span{font:600 12px Inter;color:#6f7584}`;

  function hashStr(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  MFLArcade.register('bowl', {
    start(ctx) {
      if (!document.getElementById('mb-css')) { const st = document.createElement('style'); st.id = 'mb-css'; st.textContent = css; document.head.appendChild(st); }
      const R = ctx.rng, L = LVL[ctx.level] || LVL[0];
      const home = ctx.data.home, away = ctx.data.away;
      const P = {}; for (const p of home.players) P[p.pos] = p;
      const wrap = document.createElement('div'); wrap.className = 'mb-wrap';
      const cv = document.createElement('canvas'); wrap.appendChild(cv);
      const bar = document.createElement('div'); bar.className = 'mb-bar';
      bar.innerHTML = `<span>${ctx.exhibition ? 'Exhibition' : (ctx.risk ? 'Risk mode · ' : '') + L.name}</span><button type="button" class="mb-quit">Quit</button>`;
      wrap.appendChild(bar);
      ctx.root.appendChild(wrap);
      const g = cv.getContext('2d');
      let W = 0, H = 0, DPR = 1, portrait = false, S = 10, SY = 6;
      function size() {
        const w = ctx.root.clientWidth || 360;
        portrait = w < 620;
        W = w; H = portrait ? Math.round(Math.min(window.innerHeight - 150, w * 1.55)) : Math.round(Math.min(w * 0.58, window.innerHeight - 110));
        H = Math.max(H, 420);
        DPR = Math.min(2, window.devicePixelRatio || 1);
        cv.width = W * DPR; cv.height = H * DPR; cv.style.height = H + 'px';
        g.setTransform(DPR, 0, 0, DPR, 0, 0); g.imageSmoothingEnabled = false;
        S = portrait ? W / 27 : W / 44;   // pixels per yard across the screen
        SY = portrait ? S * 0.78 : S * 0.62; // depth is squashed for the Retro Bowl look
      }
      size();
      window.addEventListener('resize', size);

      // ---------- game state ----------
      const st = {
        us: 0, them: 0, poss: 0, totalPoss: 8, ot: 0, phase: 'intro', t: 0,
        los: 25, fd: 35, down: 1, playIdx: Math.floor(R() * PLAYS.length), runPlay: false,
        stats: { pass: 0, rush: 0, td: 0, comp: 0, att: 0, int: 0, sacks: 0 },
        msg: null, cam: { x: 30, y: MID }, ents: [], def: [], ball: null, carrier: null, aim: null, kick: null, sim: null,
        parts: [],
      };
      let over = false;
      const say = (text, color = '#fff', dur = 1.4, sub = '') => { st.msg = { text, color, t: 0, dur, sub }; };

      function rating(p, k) { return (p && p[k]) || 50; }
      function speedOf(p) { return 5.4 + (rating(p, 'spd') - 40) / 60 * 3.2; }

      // ---------- formation ----------
      function setup() {
        const x0 = st.los, ents = [];
        const add = (pos, x, y) => { const p = P[pos] || { name: pos, ovr: 50 }; ents.push({ pos, p, x, y, vx: 0, vy: 0, face: 1, sk: SKIN[hashStr(p.name) % SKIN.length], route: null, ri: 0 }); };
        add('UTIL1', x0 - 0.6, MID); add('QB', x0 - 4.5, MID); add('RB', x0 - 5.5, MID + 3);
        add('WR1', x0 - 0.6, 5); add('WR2', x0 - 0.6, FW - 5); add('WR3', x0 - 1.2, 13); add('TE', x0 - 0.8, MID + 6.5);
        st.ents = ents;
        const byPos = Object.fromEntries(ents.map((e) => [e.pos, e]));
        const d = [];
        const dp = (role, x, y, target) => d.push({ role, x, y, vx: 0, vy: 0, target, hist: [], sk: SKIN[(d.length * 3) % SKIN.length], tried: false, stun: 0, face: -1 });
        dp('rush', x0 + 4.5, MID - 2); dp('rush', x0 + 4.5, MID + 2.5);
        for (const pos of ['WR1', 'WR2', 'WR3', 'TE']) dp('cover', byPos[pos].x + L.cushion + 1.5, byPos[pos].y, byPos[pos]);
        dp('lb', x0 + 6.5, MID + 1, byPos.RB);
        st.def = d;
        st.ball = { x: x0, y: MID, z: 0.5, holder: byPos.UTIL1, flight: null };
        st.carrier = null; st.aim = null; st.playT = 0; st.thrown = false;
        const play = PLAYS[st.playIdx];
        for (const e of ents) {
          const rk = play.r[e.pos];
          if (!rk || (st.runPlay && e.pos === 'RB')) continue;
          const r = ROUTES[rk], inward = Math.sign(MID - e.y) || 1;
          let cx = e.x, cy = e.y;
          e.route = r.pts.map(([dx, dy]) => { cx += dx; cy = clamp(cy + dy * inward, 1.5, FW - 1.5); return { x: cx, y: cy }; });
          e.stop = !!r.stop; e.ri = 0;
        }
        st.cam.x = x0 + (portrait ? 9 : 10); st.cam.y = MID;
      }

      // ---------- coordinates ----------
      function toScreen(x, y, z = 0) {
        if (portrait) return [W / 2 + (y - st.cam.y) * S, H * 0.62 - (x - st.cam.x) * SY - z * S * 0.9];
        return [W * 0.42 + (x - st.cam.x) * S, H * 0.55 + (y - st.cam.y) * SY - z * S * 0.9];
      }
      function screenDirToWorld(dx, dy) {
        if (portrait) return { x: -dy / SY, y: dx / S };
        return { x: dx / S, y: dy / SY };
      }
      function screenToWorldY(sx, sy) { return portrait ? st.cam.y + (sx - W / 2) / S : st.cam.y + (sy - H * 0.55) / SY; }

      // ---------- drawing ----------
      function px(n) { return Math.max(1, Math.round(n)); }
      function drawField() {
        g.fillStyle = '#2e7d32'; g.fillRect(0, 0, W, H);
        // stripes every 5 yards
        for (let yd = -10; yd < 110; yd += 5) {
          const a = toScreen(yd, 0), b = toScreen(yd + 5, FW);
          g.fillStyle = (Math.floor(yd / 5) % 2 === 0) ? '#2f8a34' : '#2a7a2e';
          if (yd < 0 || yd >= 100) g.fillStyle = yd < 0 ? home.color : away.color;
          if (portrait) g.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]); else g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        }
        // end zone names
        g.save(); g.fillStyle = 'rgba(255,255,255,.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const [cx, team] of [[-5, home], [105, away]]) {
          const [sx, sy] = toScreen(cx, MID);
          g.save(); g.translate(sx, sy); if (!portrait) g.rotate(cx < 0 ? -Math.PI / 2 : Math.PI / 2);
          g.font = `${Math.round(S * 1.6)}px "Press Start 2P"`; g.fillText(team.name.toUpperCase().slice(0, 12), 0, 0); g.restore();
        }
        g.restore();
        // yard lines + numbers
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
        for (let yd = 0; yd <= 100; yd += 5) {
          const a = toScreen(yd, 0), b = toScreen(yd, FW);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          if (yd % 10 === 0 && yd > 0 && yd < 100) {
            const n = yd <= 50 ? yd : 100 - yd;
            g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `${Math.round(S * 0.9)}px "Press Start 2P"`; g.textAlign = 'center'; g.textBaseline = 'middle';
            for (const yy of [6, FW - 6]) { const [sx, sy] = toScreen(yd, yy); g.fillText(String(n), sx, sy); }
          }
        }
        // hash marks
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let yd = 1; yd < 100; yd++) for (const yy of [FW / 2 - 6, FW / 2 + 6]) { const [sx, sy] = toScreen(yd, yy); g.fillRect(sx - 1, sy - 1, 2, 2); }
        // sidelines
        g.strokeStyle = '#fff'; g.lineWidth = 3;
        for (const yy of [0, FW]) { const a = toScreen(-10, yy), b = toScreen(110, yy); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        // line of scrimmage + first down
        if (['presnap', 'play', 'flight', 'carry', 'dead'].includes(st.phase)) {
          for (const [x, c] of [[st.los, '#5aa9ff'], [Math.min(st.fd, 100), '#ffd400']]) {
            const a = toScreen(x, 0), b = toScreen(x, FW); g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          }
        }
      }
      // A little pixel football player. 7 x 11 "pixels".
      function drawGuy(e, team, isDef) {
        const [sx, sy] = toScreen(e.x, e.y);
        const u = px(S * 0.2);
        const moving = Math.hypot(e.vx, e.vy) > 0.4;
        const fr = moving ? Math.floor(st.t * 10 + e.x) % 2 : 0;
        const face = e.face >= 0 ? 1 : -1;
        const helmet = isDef ? team.color2 || '#fff' : team.color2 || '#fff', jersey = team.color;
        const ox = sx - 3.5 * u, oy = sy - 11 * u;
        // shadow
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(sx, sy, 3.6 * u, 1.3 * u, 0, 0, 7); g.fill();
        const R1 = (cx, cy, w, h, c) => { g.fillStyle = c; const x = face > 0 ? cx : 7 - cx - w; g.fillRect(ox + x * u, oy + cy * u, w * u, h * u); };
        R1(2, 0, 3, 1, helmet); R1(1, 1, 5, 2, helmet); R1(5, 2, 2, 1, '#cfd3da'); R1(2, 3, 3, 1, e.sk);
        R1(1, 4, 5, 3, jersey); R1(0, 5, 1, 2, e.sk); R1(6, 5, 1, 2, e.sk);
        R1(1, 7, 5, 1, '#e8e8e8'); R1(0, 7, 1, 2, isDef ? '#ffd400' : '#ff3b3b'); // flag on the hip
        if (fr) { R1(1, 8, 2, 2, '#e8e8e8'); R1(4, 8, 2, 1, '#e8e8e8'); R1(1, 10, 2, 1, '#111'); R1(5, 9, 2, 1, '#111'); }
        else { R1(1, 8, 2, 2, '#e8e8e8'); R1(4, 8, 2, 2, '#e8e8e8'); R1(1, 10, 2, 1, '#111'); R1(4, 10, 2, 1, '#111'); }
        return [sx, oy];
      }
      function drawBall() {
        const b = st.ball; if (!b) return;
        let bx = b.x, by = b.y, bz = b.z;
        if (b.holder && !b.flight) { bx = b.holder.x + 0.3; by = b.holder.y; bz = 0.9; }
        const [gx, gy] = toScreen(bx, by), [sx, sy] = toScreen(bx, by, bz);
        const u = px(S * 0.2);
        if (b.flight) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(gx, gy, 2 * u, 0.8 * u, 0, 0, 7); g.fill(); }
        g.fillStyle = '#7a3e12'; g.fillRect(sx - 2 * u, sy - u, 4 * u, 2 * u); g.fillRect(sx - u, sy - 1.5 * u, 2 * u, 3 * u);
        g.fillStyle = '#fff'; g.fillRect(sx - 0.5 * u, sy - 0.25 * u, u, 0.5 * u);
      }
      function label(text, x, y, c = '#fff', sz = 0.42) {
        g.font = `${Math.max(7, Math.round(S * sz))}px "Press Start 2P"`; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(text, x + 1, y + 1); g.fillStyle = c; g.fillText(text, x, y);
      }
      function drawRoutes() {
        g.setLineDash([4, 5]); g.lineWidth = 2;
        for (const e of st.ents) {
          if (!e.route) continue;
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath();
          let [a, b] = toScreen(e.x, e.y); g.moveTo(a, b);
          for (const p of e.route) { [a, b] = toScreen(p.x, p.y); g.lineTo(a, b); }
          g.stroke();
        }
        if (st.runPlay) { const rb = st.ents.find((e) => e.pos === 'RB'); const [a, b] = toScreen(rb.x, rb.y), [c, d] = toScreen(st.los + 6, rb.y - 2); g.strokeStyle = 'rgba(255,212,0,.8)'; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
        g.setLineDash([]);
      }
      function drawAim() {
        const a = st.aim; if (!a || !a.target) return;
        const qb = st.ball.holder; if (!qb) return;
        const d = dist(qb, a.target), n = 14;
        for (let i = 1; i <= n; i++) {
          const t = i / n, x = qb.x + (a.target.x - qb.x) * t, y = qb.y + (a.target.y - qb.y) * t, z = 1 + 4 * (d * 0.14) * t * (1 - t);
          const [sx, sy] = toScreen(x, y, z); g.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * t})`; g.fillRect(sx - 2, sy - 2, 4, 4);
        }
        const [tx, ty] = toScreen(a.target.x, a.target.y);
        g.strokeStyle = '#ffd400'; g.lineWidth = 2; g.beginPath(); g.ellipse(tx, ty, S * 0.9, S * 0.9 * (portrait ? 0.78 : 0.62), 0, 0, 7); g.stroke();
      }
      function hud() {
        const top = 8, h = 34;
        g.fillStyle = 'rgba(8,9,12,.82)'; g.fillRect(8, top, W - 16, h);
        g.font = `${portrait ? 10 : 12}px "Press Start 2P"`; g.textBaseline = 'middle';
        const q = st.ot ? 'OT' : 'Q' + Math.min(4, Math.floor(st.poss / 2) + 1);
        g.fillStyle = home.color; g.fillRect(8, top, 6, h); g.fillStyle = away.color; g.fillRect(W - 14, top, 6, h);
        g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(`${home.abbr} ${st.us}`, 22, top + h / 2);
        g.textAlign = 'right'; g.fillText(`${st.them} ${away.abbr}`, W - 22, top + h / 2);
        g.textAlign = 'center'; g.fillStyle = '#ffd400'; g.fillText(q, W / 2, top + h / 2);
        if (['presnap', 'play', 'flight', 'carry', 'dead'].includes(st.phase)) {
          const togo = st.fd >= 100 ? 'GOAL' : Math.max(1, Math.round(st.fd - st.los));
          const spot = st.los <= 50 ? `OWN ${Math.round(st.los)}` : `OPP ${Math.round(100 - st.los)}`;
          const t = `${['1ST', '2ND', '3RD', '4TH'][st.down - 1]} & ${togo} · ${spot}`;
          g.font = `${portrait ? 9 : 11}px "Press Start 2P"`; const tw = g.measureText(t).width + 20;
          g.fillStyle = 'rgba(8,9,12,.82)'; g.fillRect(W / 2 - tw / 2, top + h + 4, tw, 22);
          g.fillStyle = '#fff'; g.fillText(t, W / 2, top + h + 15);
        }
        const left = st.ot ? '' : `${Math.max(0, Math.ceil((st.totalPoss - st.poss) / 2))} DRIVES LEFT`;
        if (left && st.phase !== 'over') { g.font = `8px "Press Start 2P"`; g.fillStyle = 'rgba(255,255,255,.6)'; g.textAlign = 'right'; g.fillText(left, W - 12, H - 10); }
      }
      // Buttons drawn on the canvas (pre-snap / 4th down / kicks).
      let buttons = [];
      function button(id, text, x, y, w, h, on = false) {
        buttons.push({ id, x, y, w, h });
        g.fillStyle = on ? '#ffd400' : 'rgba(8,9,12,.85)'; g.fillRect(x, y, w, h);
        g.strokeStyle = on ? '#ffd400' : 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = on ? '#111' : '#fff'; g.font = `${portrait ? 9 : 10}px "Press Start 2P"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 1);
      }
      function banner() {
        const m = st.msg; if (!m) return;
        const k = Math.min(1, m.t / 0.18), sc = 0.6 + 0.4 * k + (m.t < 0.3 ? Math.sin(m.t * 30) * 0.04 : 0);
        g.save(); g.translate(W / 2, H * 0.36); g.scale(sc, sc);
        g.font = `${Math.round(Math.min(W / 13, 34))}px "Press Start 2P"`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(m.text, 3, 3); g.fillStyle = m.color; g.fillText(m.text, 0, 0);
        if (m.sub) { g.font = `${Math.round(Math.min(W / 32, 13))}px "Press Start 2P"`; g.fillStyle = '#fff'; g.fillText(m.sub, 0, Math.min(W / 13, 34) + 4); }
        g.restore();
      }
      function particles(dt) {
        for (const p of st.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; g.fillStyle = p.c; g.fillRect(p.x, p.y, 4, 4); }
        st.parts = st.parts.filter((p) => p.life > 0);
      }
      function confetti(n = 70) { for (let i = 0; i < n; i++) st.parts.push({ x: W / 2 + (R() - 0.5) * W * 0.6, y: H * 0.3, vx: (R() - 0.5) * 300, vy: -R() * 350, life: 1.4 + R(), c: [home.color, '#ffd400', '#fff', home.color2][i % 4] }); }

      // ---------- flow ----------
      function startDrive(x) {
        st.los = clamp(x, 1, 99); st.down = 1; st.fd = Math.min(100, st.los + 10); st.phase = 'presnap';
        st.playIdx = Math.floor(R() * PLAYS.length); st.runPlay = false; setup();
        say(st.ot ? 'OVERTIME' : 'YOUR BALL', '#ffd400', 1.1, st.los <= 50 ? `OWN ${Math.round(st.los)}` : `OPP ${Math.round(100 - st.los)}`);
      }
      function endPlay(x, why) {
        // Ball spotted at x. why: 'tackle' | 'oob' | 'inc' | 'sack' | 'td' | 'int'
        st.phase = 'dead'; st.deadT = 0;
        if (why === 'td') return;
        if (why === 'int') { st.stats.int++; return setTimeout(() => endDrive('int', x), 1300); }
        const gain = why === 'inc' ? 0 : x - st.los;
        if (why !== 'inc') st.los = clamp(x, 1, 99);
        if (st.los >= st.fd) {
          st.down = 1; st.fd = Math.min(100, st.los + 10); say('FIRST DOWN', '#ffd400', 1);
          ctx.sound('good');
        } else {
          st.down++;
          if (why === 'inc') say('INCOMPLETE', '#fff', 0.9);
          else if (why === 'sack') say('SACKED', '#ff5b69', 1, `${Math.round(gain)} YDS`);
          else if (gain >= 8) say(`+${Math.round(gain)} YDS`, '#7CFC9A', 0.9);
          if (st.down > 4) { setTimeout(() => endDrive('downs', st.los), 1100); say('TURNOVER ON DOWNS', '#ff5b69', 1.2); return; }
        }
        setTimeout(() => { if (st.phase === 'dead') { st.phase = st.down === 4 ? 'fourth' : 'presnap'; st.playIdx = Math.floor(R() * PLAYS.length); st.runPlay = false; setup(); } }, 1000);
      }
      function touchdown() {
        st.us += 6; st.stats.td++; st.phase = 'dead'; confetti(); ctx.sound('win');
        say('TOUCHDOWN!', '#ffd400', 1.8, (st.carrier && st.carrier.p.name || '').toUpperCase());
        setTimeout(() => { st.phase = 'pat'; }, 1700);
      }
      function endDrive(why, spot) {
        st.poss++;
        st.phase = 'sim';
        simDrive(why, spot);
      }
      // The other team's drive is simulated (like Retro Bowl): field position, level and your defenders matter.
      function simDrive(why, spot) {
        const defs = home.players.filter((p) => /UTIL/.test(p.pos));
        const defRate = defs.length ? defs.reduce((s, p) => s + (p.def || p.ovr || 50), 0) / defs.length : 50;
        const start = why === 'int' || why === 'downs' ? 100 - spot : why === 'punt' ? clamp(100 - spot - 38, 8, 40) : 25; // their yards from their own goal
        let td = L.td + (start - 25) / 160 - (defRate - 55) / 260 + (away.boost || 0);
        td = clamp(td, 0.06, 0.85);
        const roll = R();
        const res = roll < td ? 'td' : roll < td + L.fg ? 'fg' : roll < td + L.fg + 0.08 ? 'turnover' : 'punt';
        const plays = 3 + Math.floor(R() * 7), yds = res === 'td' ? 100 - start : Math.floor(R() * 40);
        st.sim = { res, lines: [`${away.name.toUpperCase()} BALL`, `${plays} PLAYS · ${yds} YDS`, { td: 'TOUCHDOWN', fg: 'FIELD GOAL', turnover: 'YOUR D FORCES A TURNOVER!', punt: 'THEY PUNT' }[res]], t: 0, start };
        if (res === 'td') st.them += R() < 0.85 ? 7 : R() < 0.5 ? 6 : 8;
        if (res === 'fg') st.them += 3;
        ctx.sound(res === 'td' || res === 'fg' ? 'bad' : 'good');
      }
      function afterSim() {
        const res = st.sim.res; st.sim = null; st.poss++;
        if (gameOverCheck()) return;
        startDrive(res === 'turnover' ? 45 + Math.floor(R() * 15) : res === 'punt' ? 15 + Math.floor(R() * 18) : 25);
      }
      function gameOverCheck() {
        if (st.poss < st.totalPoss) return false;
        if (st.us === st.them && st.ot < 2) { st.ot++; st.totalPoss += 2; say('OVERTIME', '#ffd400', 1.4); return false; }
        st.phase = 'over'; over = true;
        const won = st.us > st.them, tie = st.us === st.them;
        say(won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'FINAL', won ? '#ffd400' : '#fff', 99, `${st.us} - ${st.them}`);
        if (won) confetti(120);
        setTimeout(() => { stop = true; }, 4000);
        setTimeout(() => ctx.finish({ won, tie, score: st.us, opp: st.them, stats: st.stats,
          detail: `${won ? 'Won' : tie ? 'Tied' : 'Lost'} ${st.us}-${st.them} · ${st.stats.td} TD · ${st.stats.pass} pass yds · ${st.stats.rush} rush yds` }), 1800);
        return true;
      }

      // ---------- kicking ----------
      function startKick(kind) {
        // kind: 'xp' or 'fg'
        const k = rating(P.UTIL2, 'kick');
        const yards = kind === 'xp' ? 20 : Math.round(100 - st.los + 17);
        const tol = clamp(0.5 - yards * 0.0068 + (k - 50) / 400 - ctx.level * 0.02, 0.06, 0.5);
        st.kick = { kind, yards, tol, t: 0, speed: 1.6 + yards / 30 + ctx.level * 0.25, needle: 0, done: false };
        st.phase = 'kick';
      }
      function kickTap() {
        const K = st.kick; if (!K || K.done) return;
        K.done = true; K.flight = 0; K.good = Math.abs(K.needle) <= K.tol;
        ctx.sound('kick');
        setTimeout(() => {
          if (K.kind === 'xp') { if (K.good) st.us += 1; say(K.good ? 'EXTRA POINT GOOD' : 'NO GOOD', K.good ? '#7CFC9A' : '#ff5b69', 1.1); }
          else { if (K.good) st.us += 3; say(K.good ? `${K.yards} YD FIELD GOAL!` : 'FIELD GOAL MISSED', K.good ? '#ffd400' : '#ff5b69', 1.3); if (K.good) confetti(40); }
          ctx.sound(K.good ? 'good' : 'bad');
          setTimeout(() => { st.kick = null; endDrive(K.kind === 'fg' && !K.good ? 'downs' : 'score', K.kind === 'fg' && !K.good ? st.los : 0); }, 1200);
        }, 900);
      }
      function drawKick(dt) {
        const K = st.kick; if (!K) return;
        g.fillStyle = 'rgba(5,10,6,.92)'; g.fillRect(0, 0, W, H);
        // sky + field from behind the kicker
        const hz = H * 0.42;
        g.fillStyle = '#10213a'; g.fillRect(0, 0, W, hz);
        g.fillStyle = '#2e7d32'; g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.3, hz); g.lineTo(W * 0.7, hz); g.lineTo(W, H); g.fill();
        const far = clamp(1 - K.yards / 70, 0.25, 0.8);
        const pw = W * 0.34 * far + 30, cx = W / 2, py = hz + 10, ph = H * 0.25 * far + 40;
        g.fillStyle = '#ffd400'; g.fillRect(cx - pw / 2, py - 4, pw, 5); g.fillRect(cx - pw / 2, py - ph, 5, ph); g.fillRect(cx + pw / 2 - 5, py - ph, 5, ph); g.fillRect(cx - 2, py, 4, H * 0.08);
        if (!K.done) { K.t += dt; K.needle = Math.sin(K.t * K.speed * 2.2) * 0.9; }
        // aim needle (green zone = good)
        const my = H * 0.86, mw = Math.min(W * 0.8, 420);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx - mw / 2, my - 10, mw, 20);
        g.fillStyle = 'rgba(124,252,154,.75)'; g.fillRect(cx - (K.tol / 0.9) * mw / 2, my - 10, (K.tol / 0.9) * mw, 20);
        g.fillStyle = '#fff'; g.fillRect(cx + (K.needle / 0.9) * mw / 2 - 2, my - 16, 4, 32);
        label(K.kind === 'xp' ? 'EXTRA POINT' : `${K.yards} YD FIELD GOAL`, cx, H * 0.14, '#ffd400', 0.6);
        if (!K.done) label('TAP WHEN THE BAR IS IN THE GREEN', cx, H * 0.95, '#fff', 0.34);
        // ball flight
        if (K.done) {
          K.flight = Math.min(1, K.flight + dt * 1.2);
          const f = K.flight, bx = cx + K.needle * pw * 1.2 * f, by = H * 0.8 - (H * 0.8 - (py - ph * 0.6)) * f - Math.sin(f * Math.PI) * H * 0.12, r = 14 * (1 - f * 0.75);
          g.fillStyle = '#7a3e12'; g.beginPath(); g.ellipse(bx, by, r, r * 0.7, f * 6, 0, 7); g.fill();
        } else { g.fillStyle = '#7a3e12'; g.beginPath(); g.ellipse(cx, H * 0.8, 14, 10, 0, 0, 7); g.fill(); }
      }

      // ---------- simulation step ----------
      function moveTo(e, tx, ty, sp, dt) {
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (d < 0.05) { e.vx = 0; e.vy = 0; return true; }
        const s = Math.min(sp, d / dt);
        e.vx = (dx / d) * s; e.vy = (dy / d) * s; e.x += e.vx * dt; e.y += e.vy * dt;
        if (Math.abs(e.vx) > 0.3) e.face = Math.sign(e.vx) * (portrait ? 1 : 1);
        return d < 0.3;
      }
      function snap() {
        buttons = [];
        st.phase = 'play'; st.playT = 0; ctx.sound('whistle');
        const qb = st.ents.find((e) => e.pos === 'QB');
        st.ball.holder = qb;
      }
      function step(dt) {
        st.t += dt; st.playT += dt;
        const qb = st.ents.find((e) => e.pos === 'QB'), rb = st.ents.find((e) => e.pos === 'RB'), c = st.ents.find((e) => e.pos === 'UTIL1');
        if (st.phase === 'play' || st.phase === 'flight') {
          // offense
          for (const e of st.ents) {
            if (e === qb) { if (!st.thrown) moveTo(e, st.los - (st.runPlay ? 4.5 : 7), MID, 4, dt); continue; }
            if (e === c) { const r = st.def.filter((d) => d.role === 'rush').sort((a, b) => dist(a, qb) - dist(b, qb))[0]; if (r) moveTo(e, (r.x + qb.x) / 2, (r.y + qb.y) / 2, 4.5, dt); continue; }
            if (st.runPlay && e === rb) {
              if (st.ball.holder === qb && dist(rb, qb) < 1.2 && st.playT > 0.35) { st.ball.holder = rb; st.carrier = rb; st.phase = 'carry'; st.carryStart = st.los; st.carryFromRun = true; st.steerY = null; }
              else moveTo(e, qb.x + 0.5, qb.y, speedOf(e.p), dt);
              continue;
            }
            if (e.route && e.ri < e.route.length) { const w = e.route[e.ri]; if (moveTo(e, w.x, w.y, speedOf(e.p), dt)) e.ri++; }
            else if (e.route && !e.stop) { const a = e.route[e.route.length - 2] || { x: e.x - 1, y: e.y }, b = e.route[e.route.length - 1]; const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; moveTo(e, e.x + (b.x - a.x) / d * 5, clamp(e.y + (b.y - a.y) / d * 5, 1, FW - 1), speedOf(e.p), dt); }
            else { e.vx *= 0.8; e.vy *= 0.8; }
            // track the ball in the air
            if (st.phase === 'flight' && st.ball.flight && st.ball.flight.t > 0.45) {
              const T = st.ball.flight.target, reach = 3 + rating(e.p, 'cat') / 30;
              if (dist(e, T) < reach) moveTo(e, T.x, T.y, speedOf(e.p) * 1.05, dt);
            }
          }
          // defense
          for (const d of st.def) {
            if (d.stun > 0) { d.stun -= dt; continue; }
            if (d.role === 'rush') {
              if (st.playT < L.rush) { d.vx = d.vy = 0; continue; }
              const target = st.ball.holder || qb;
              let sp = L.dspd * 0.92;
              if (dist(d, c) < 1.1) sp *= 0.25 - rating(c.p, 'str') / 900; // blocked
              moveTo(d, target.x, target.y, Math.max(0.6, sp), dt);
            } else {
              const tgt = d.target;
              d.hist.push({ x: tgt.x, y: tgt.y, t: st.playT });
              while (d.hist.length > 1 && st.playT - d.hist[0].t > L.react) d.hist.shift();
              const h = d.hist[0];
              let tx = h.x + (st.playT < 1.2 ? L.cushion : L.cushion * 0.45), ty = h.y;
              if (st.phase === 'flight' && st.ball.flight) { const T = st.ball.flight.target; if (dist(d, T) < L.track + 1.5) { tx = T.x; ty = T.y; } }
              if (d.role === 'lb' && (!tgt.route || st.runPlay)) { tx = st.los + 5; ty = (st.ball.holder || qb).y; }
              moveTo(d, tx, ty, L.dspd * (d.role === 'lb' ? 0.92 : 1), dt);
            }
            // sack / flag pull on the holder
            const hd = st.ball.holder;
            if (hd && st.phase === 'play' && hd === qb && dist(d, qb) < 0.9) { st.stats.sacks++; ctx.sound('bad'); flagFx(qb); endPlay(qb.x, 'sack'); return; }
          }
          // ball flight
          if (st.phase === 'flight') {
            const F = st.ball.flight; F.t += dt / F.T;
            const t = Math.min(1, F.t);
            st.ball.x = F.from.x + (F.target.x - F.from.x) * t; st.ball.y = F.from.y + (F.target.y - F.from.y) * t; st.ball.z = 1 + 4 * F.h * t * (1 - t);
            if (t >= 1) resolveCatch();
          }
        } else if (st.phase === 'carry') {
          const cr = st.carrier;
          // steer toward the finger, always running upfield
          let sp = speedOf(cr.p) * (cr.dive ? 1.4 : 1);
          let ty = st.steerY != null ? clamp(st.steerY, 0.5, FW - 0.5) : cr.y;
          if (cr.juke > 0) { cr.juke -= dt; ty = cr.y + cr.jukeDir * 6; sp *= 1.35; }
          const dy = clamp(ty - cr.y, -3, 3);
          cr.vx = sp * Math.cos(Math.atan2(dy, 4)); cr.vy = sp * Math.sin(Math.atan2(dy, 4));
          cr.x += cr.vx * dt; cr.y += cr.vy * dt; cr.face = 1;
          if (cr.dive) { cr.dive -= dt; if (cr.dive <= 0) { finishCarry(cr.x, 'tackle'); return; } }
          if (cr.x >= 100) { st.stats[st.carryFromRun ? 'rush' : 'pass'] += Math.round(100 - st.carryStart); touchdown(); return; }
          if (cr.y < 0 || cr.y > FW) { say('OUT OF BOUNDS', '#fff', 0.8); finishCarry(cr.x, 'oob'); return; }
          for (const d of st.def) {
            if (d.stun > 0) { d.stun -= dt; continue; }
            const lead = dist(d, cr) / (L.dspd + 0.1) * 0.55;
            moveTo(d, cr.x + cr.vx * lead, cr.y + cr.vy * lead, L.dspd * (d.role === 'rush' ? 0.95 : 1), dt);
            if (dist(d, cr) < 0.85 && !(cr.immune > 0)) {
              const brk = L.brk + (rating(cr.p, 'str') - 50) / 300;
              if (!d.tried && R() < brk) { d.tried = true; d.stun = 0.8; say('BROKE IT!', '#7CFC9A', 0.6); ctx.sound('good'); continue; }
              flagFx(cr); finishCarry(cr.x, 'tackle'); return;
            }
          }
          if (cr.immune > 0) cr.immune -= dt;
          for (const e of st.ents) if (e !== cr) { e.vx *= 0.9; e.vy *= 0.9; }
        }
        // camera
        const focus = st.phase === 'carry' ? st.carrier : st.phase === 'flight' ? { x: st.ball.x, y: st.ball.y } : st.ball.holder || { x: st.los, y: MID };
        if (focus && ['presnap', 'play', 'flight', 'carry', 'dead', 'fourth'].includes(st.phase)) {
          const wantX = focus.x + (portrait ? 7 : 9), wantY = clamp(focus.y, portrait ? 13 : 9, FW - (portrait ? 13 : 9));
          st.cam.x += (wantX - st.cam.x) * Math.min(1, dt * 4); st.cam.y += (wantY - st.cam.y) * Math.min(1, dt * 3);
        }
      }
      function flagFx(e) { const [sx, sy] = toScreen(e.x, e.y); for (let i = 0; i < 10; i++) st.parts.push({ x: sx, y: sy - 10, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, life: 0.6, c: '#ffd400' }); say('FLAG PULLED', '#fff', 0.7); }
      function finishCarry(x, why) {
        const gain = x - (st.carryStart ?? st.los);
        if (st.carryFromRun) st.stats.rush += Math.round(gain);
        else st.stats.pass += Math.round(gain);
        endPlay(x, why);
      }
      function throwBall(target) {
        const qb = st.ball.holder;
        const d = dist(qb, target);
        const acc = rating(P.QB, 'acc'), arm = rating(P.QB, 'thr');
        const err = (1 - acc / 110) * d * 0.09;
        const t2 = { x: target.x + (R() - 0.5) * 2 * err, y: clamp(target.y + (R() - 0.5) * 2 * err, -1, FW + 1) };
        const v = 15 + arm / 12;
        st.ball.flight = { from: { x: qb.x, y: qb.y }, target: t2, T: Math.max(0.35, d / v), t: 0, h: d * 0.14 };
        st.ball.holder = null; st.thrown = true; st.phase = 'flight'; st.stats.att++; st.aim = null;
        ctx.sound('kick');
      }
      function resolveCatch() {
        const T = st.ball.flight.target;
        const recv = st.ents.filter((e) => e.pos !== 'QB').map((e) => ({ e, d: dist(e, T) })).sort((a, b) => a.d - b.d)[0];
        const dfd = st.def.map((d) => ({ d, dd: dist(d, T) })).sort((a, b) => a.dd - b.dd)[0];
        const rr = 1.5 + rating(recv && recv.e.p, 'cat') / 120;
        st.ball.flight = null;
        if (dfd && dfd.dd < 1.3 && (!recv || dfd.dd < recv.d)) {
          if (R() < L.intc) { st.ball.holder = dfd.d; st.ball.x = T.x; st.ball.y = T.y; say('INTERCEPTED', '#ff5b69', 1.3); ctx.sound('lose'); return endPlay(T.x, 'int'); }
          say('BROKEN UP', '#fff', 0.8); ctx.sound('bad'); return endPlay(st.los, 'inc');
        }
        if (recv && recv.d < rr) {
          const crowd = dfd && dfd.dd < 1.6 ? 0.25 : 0;
          const p = clamp(0.62 + rating(recv.e.p, 'cat') / 300 - crowd - recv.d * 0.08, 0.2, 0.97);
          if (R() < p) {
            st.stats.comp++; st.ball.holder = recv.e; st.carrier = recv.e; st.carryStart = st.los; st.carryFromRun = false;
            recv.e.x = T.x; recv.e.y = T.y; st.phase = 'carry'; st.steerY = null; ctx.sound('catch');
            say('CAUGHT', '#7CFC9A', 0.5, (recv.e.p.name || '').toUpperCase());
            if (recv.e.x >= 100) { st.stats.pass += Math.round(100 - st.los); touchdown(); }
            return;
          }
          say('DROPPED', '#fff', 0.8); ctx.sound('bad'); return endPlay(st.los, 'inc');
        }
        say('INCOMPLETE', '#fff', 0.8); return endPlay(st.los, 'inc');
      }

      // ---------- input ----------
      let ptr = null;
      function pos(ev) { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
      function hit(p) { return buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); }
      cv.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
        const p = pos(ev), b = hit(p);
        ptr = { start: p, cur: p, t: performance.now() };
        if (b) { ptr.button = b.id; return; }
        if (st.phase === 'presnap') { snap(); ptr = null; return; }
        if (st.phase === 'kick') { kickTap(); ptr = null; return; }
        if (st.phase === 'play' && st.ball.holder && st.ball.holder.pos === 'QB' && !st.runPlay) st.aim = { start: p, target: null };
        if (st.phase === 'carry') st.steerY = screenToWorldY(p.x, p.y);
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!ptr) return; const p = pos(ev); ptr.cur = p;
        if (st.aim && st.phase === 'play') {
          const dx = st.aim.start.x - p.x, dy = st.aim.start.y - p.y, L2 = Math.hypot(dx, dy);
          if (L2 < 14) { st.aim.target = null; return; }
          const w = screenDirToWorld(dx, dy), wl = Math.hypot(w.x, w.y) || 1;
          const maxD = 32 + rating(P.QB, 'thr') / 7, d = clamp(L2 / (Math.min(W, H) * 0.42), 0.08, 1) * maxD;
          const qb = st.ball.holder;
          st.aim.target = { x: qb.x + (w.x / wl) * d, y: clamp(qb.y + (w.y / wl) * d, -1, FW + 1) };
        }
        if (st.phase === 'carry') {
          st.steerY = screenToWorldY(p.x, p.y);
          // fast swipe upfield = dive
          const el = (performance.now() - ptr.t) / 1000, up = portrait ? ptr.start.y - p.y : p.x - ptr.start.x;
          if (el < 0.25 && up > 55 && !st.carrier.dive) { st.carrier.dive = 0.35; say('DIVE!', '#fff', 0.5); }
        }
      });
      cv.addEventListener('pointerup', (ev) => {
        if (!ptr) return; const p = pos(ev), quick = performance.now() - ptr.t < 220 && Math.hypot(p.x - ptr.start.x, p.y - ptr.start.y) < 12;
        const b = hit(p);
        if (ptr.button && b && b.id === ptr.button) press(b.id);
        else if (st.aim && st.phase === 'play') { if (st.aim.target) throwBall(st.aim.target); st.aim = null; }
        else if (st.phase === 'carry' && quick && !(st.carrier.cool > st.t)) {
          // tap = juke away from the nearest defender
          const cr = st.carrier, nd = st.def.slice().sort((a, b) => dist(a, cr) - dist(b, cr))[0];
          cr.jukeDir = nd && nd.y > cr.y ? -1 : 1; cr.juke = 0.22; cr.immune = 0.32; cr.cool = st.t + 0.9; say('JUKE!', '#7CFC9A', 0.45); ctx.sound('tap');
        }
        if (st.phase === 'carry') st.steerY = null;
        ptr = null;
      });
      // Each button only works in the phase that shows it (taps can land a frame late).
      const BUTTON_PHASE = { run: 'presnap', play: 'presnap', go: 'fourth', punt: 'fourth', fg: 'fourth', xp: 'pat', two: 'pat', kickoff: 'intro' };
      function press(id) {
        if (BUTTON_PHASE[id] && BUTTON_PHASE[id] !== st.phase) return;
        ctx.sound('tap');
        if (id === 'run') { st.runPlay = !st.runPlay; setup(); }
        else if (id === 'play') { st.playIdx = (st.playIdx + 1) % PLAYS.length; setup(); }
        else if (id === 'go') { st.phase = 'presnap'; }
        else if (id === 'punt') { say('PUNT', '#fff', 1); setTimeout(() => endDrive('punt', st.los), 900); st.phase = 'dead'; }
        else if (id === 'fg') startKick('fg');
        else if (id === 'xp') startKick('xp');
        else if (id === 'two') { st.two = true; st.los = 97; st.fd = 100; st.down = 4; st.phase = 'presnap'; setup(); say('2-POINT TRY', '#ffd400', 1); }
        else if (id === 'simok' && st.sim && !st.sim.auto) { st.sim.auto = true; afterSim(); }
      }
      bar.querySelector('.mb-quit').onclick = () => { if (over) return; if (confirm('Quit this game? It counts as a loss.')) { over = true; stop = true; ctx.finish({ won: false, score: st.us, opp: st.them, stats: st.stats, detail: 'You quit the game.' }); } };

      // 2-point tries end after one play.
      const _endPlay = endPlay;
      endPlay = function (x, why) {
        if (st.two) { st.two = false; st.phase = 'dead'; say('NO GOOD', '#ff5b69', 1); setTimeout(() => endDrive('score', 0), 1100); return; }
        return _endPlay(x, why);
      };
      const _touchdown = touchdown;
      touchdown = function () {
        if (st.two) { st.two = false; st.us += 2; st.phase = 'dead'; confetti(40); say('2-POINT GOOD!', '#ffd400', 1.3); ctx.sound('good'); setTimeout(() => endDrive('score', 0), 1300); return; }
        return _touchdown();
      };

      // ---------- loop ----------
      let last = performance.now(), stop = false;
      function frame(now) {
        if (stop) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (st.msg) { st.msg.t += dt; if (st.msg.t > st.msg.dur) st.msg = null; }
        if (['play', 'flight', 'carry'].includes(st.phase)) step(dt);
        else { st.t += dt; step0(dt); }
        render(dt);
        requestAnimationFrame(frame);
      }
      function step0(dt) {
        if (st.sim) { st.sim.t += dt; if (st.sim.t > 3.2 && !st.sim.auto) { st.sim.auto = true; afterSim(); } }
      }
      function render(dt) {
        buttons = [];
        g.clearRect(0, 0, W, H);
        if (st.phase === 'kick') { drawKick(dt); particles(dt); banner(); return; }
        drawField();
        if (st.phase === 'presnap' || st.phase === 'fourth') drawRoutes();
        const all = [...st.ents.map((e) => [e, home, false]), ...st.def.map((d) => [d, away, true])].sort((a, b) => (portrait ? b[0].x - a[0].x : a[0].y - b[0].y));
        for (const [e, team, isD] of all) {
          const [hx, hy] = drawGuy(e, team, isD);
          if (!isD && (st.phase === 'presnap' || (st.phase === 'play' && !st.runPlay)) && e.route) label((e.p.name || '').split(' ').pop().toUpperCase().slice(0, 8), hx, hy - 2, '#fff', 0.36);
          if (st.carrier === e && st.phase === 'carry') { g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(hx - 5, hy - 10); g.lineTo(hx + 5, hy - 10); g.lineTo(hx, hy - 3); g.fill(); }
        }
        drawBall();
        if (st.phase === 'play') drawAim();
        hud();
        const bw = portrait ? Math.min(150, W * 0.4) : 150, bh = 34, by = H - bh - 12;
        if (st.phase === 'presnap') {
          button('run', st.runPlay ? 'RUN PLAY' : 'PASS PLAY', 12, by, bw, bh, st.runPlay);
          if (!st.runPlay) button('play', 'NEW PLAY ↻', W - bw - 12, by, bw, bh);
          label(st.runPlay ? 'HANDOFF TO ' + ((P.RB && P.RB.name) || 'RB').split(' ').pop().toUpperCase() : PLAYS[st.playIdx].name.toUpperCase(), W / 2, by - 30, '#ffd400', 0.45);
          label('TAP THE FIELD TO SNAP', W / 2, by - 10, '#fff', 0.36);
        }
        if (st.phase === 'play' && !st.runPlay && st.playT < 2.2 && !st.aim) label('PULL BACK & RELEASE TO THROW', W / 2, H - 14, '#fff', 0.34);
        if (st.phase === 'carry' && st.t % 4 < 2 && st.playT < 6) label('DRAG TO STEER · TAP TO JUKE · SWIPE UP TO DIVE', W / 2, H - 14, 'rgba(255,255,255,.8)', 0.3);
        if (st.phase === 'fourth') {
          label('4TH DOWN', W / 2, H * 0.6, '#ffd400', 0.6);
          const fgYds = Math.round(100 - st.los + 17), bw2 = Math.min(140, (W - 48) / 3);
          button('go', 'GO FOR IT', W / 2 - bw2 * 1.5 - 12, by, bw2, bh);
          button('punt', 'PUNT', W / 2 - bw2 / 2, by, bw2, bh);
          if (fgYds <= 58) button('fg', `FG ${fgYds}`, W / 2 + bw2 / 2 + 12, by, bw2, bh);
        }
        if (st.phase === 'pat') {
          label('TRY FOR POINT', W / 2, H * 0.6, '#ffd400', 0.6);
          const bw2 = Math.min(170, (W - 36) / 2);
          button('xp', 'KICK XP (+1)', W / 2 - bw2 - 6, by, bw2, bh); button('two', 'GO FOR 2', W / 2 + 6, by, bw2, bh);
        }
        if (st.sim) {
          g.fillStyle = 'rgba(6,7,10,.86)'; g.fillRect(0, 0, W, H);
          const k = st.sim.t;
          st.sim.lines.forEach((ln, i) => { if (k > i * 0.8) label(ln, W / 2, H * 0.36 + i * (S * 1.3 + 8), i === 2 ? (st.sim.res === 'turnover' || st.sim.res === 'punt' ? '#7CFC9A' : '#ff5b69') : '#fff', i === 2 ? 0.62 : 0.45); });
          label(`${home.abbr} ${st.us} - ${st.them} ${away.abbr}`, W / 2, H * 0.36 + 3 * (S * 1.3 + 8) + 10, '#ffd400', 0.45);
          if (k > 2) button('simok', 'CONTINUE ▶', W / 2 - 80, H - 60, 160, 36);
        }
        if (st.phase === 'intro') {
          g.fillStyle = 'rgba(6,7,10,.75)'; g.fillRect(0, 0, W, H);
          label('MODERN BOWL', W / 2, H * 0.28, '#ffd400', 0.9);
          label(`${home.name.toUpperCase()} VS ${away.name.toUpperCase()}`, W / 2, H * 0.28 + 34, '#fff', 0.42);
          const tips = ['TAP THE FIELD TO SNAP', 'PULL BACK & RELEASE TO THROW', 'DRAG TO STEER · TAP TO JUKE', 'SWIPE UPFIELD TO DIVE', 'THEIR DRIVES ARE SIMULATED'];
          tips.forEach((t, i) => label(t, W / 2, H * 0.45 + i * 22, 'rgba(255,255,255,.8)', 0.32));
          button('kickoff', 'KICK OFF ▶', W / 2 - 90, H * 0.75, 180, 40, true);
        }
        particles(dt); banner();
      }
      // intro button
      const _press = press;
      press = function (id) { if (id === 'kickoff') { ctx.sound('whistle'); return startDrive(25); } return _press(id); };

      if (window.__arcTest) { wrap.__st = st; wrap.__toScreen = toScreen; } // test pages only
      document.fonts && document.fonts.load('12px "Press Start 2P"').catch(() => {});
      setup();
      requestAnimationFrame(frame);
    },
  });
})();
