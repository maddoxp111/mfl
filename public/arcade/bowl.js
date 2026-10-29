// Modern Bowl: a Retro Bowl-style football game (original art in that style).
// You run the offense; the other team's drives are simulated.
//
// ctx.data = { mode, home, away } where a team is
//   { name, abbr, color, color2, players: [{ name, num, pos, ovr, spd, thr, acc, cat, str, kick, def, stars, card }] }
// and pos is QB, RB, WR1, WR2, WR3, TE, UTIL1 (snaps + blocks), UTIL2 (kicks + leads the defense).
//
// Everything is drawn into a small low-res canvas (180 px tall) that CSS scales up with
// hard pixel edges, like the real thing. World units are yards: x = 0 own goal line,
// 100 = their goal line; y = 0 far sideline (top of the screen), 53.3 near sideline.
(function () {
  const FW = 53.33, MID = FW / 2;
  const LH = 240, FY0 = 13, PY = (LH - 3 - FY0) / FW, PX = PY * 2.55; // field band and pixels per yard (depth squashed)
  const QLEN = 150; // 2:30 quarters
  const LVL = [
    { name: 'Rookie', dspd: 5.6, react: 0.55, rush: 2.0, cushion: 4.5, intc: 0.18, td: 0.18, fg: 0.14, track: 1.6, brk: 0.32 },
    { name: 'Pro', dspd: 6.2, react: 0.4, rush: 1.7, cushion: 3.4, intc: 0.3, td: 0.28, fg: 0.15, track: 2.4, brk: 0.24 },
    { name: 'All-Pro', dspd: 6.8, react: 0.28, rush: 1.45, cushion: 2.5, intc: 0.42, td: 0.38, fg: 0.15, track: 3.2, brk: 0.17 },
    { name: 'Legend', dspd: 7.4, react: 0.18, rush: 1.25, cushion: 1.7, intc: 0.55, td: 0.5, fg: 0.14, track: 4, brk: 0.11 },
  ];
  // Routes: waypoints [forward yards, yards toward the middle (negative = toward the sideline)].
  const ROUTES = {
    go: { pts: [[32, 0]] }, seam: { pts: [[32, 2]] }, slant: { pts: [[2, 0], [14, 9]] }, out: { pts: [[7, 0], [7, -14]], stop: true },
    dig: { pts: [[11, 0], [11, 16]] }, post: { pts: [[9, 0], [32, 11]] }, corner: { pts: [[9, 0], [26, -11]] },
    curl: { pts: [[10, 0], [8, 1]], stop: true }, drag: { pts: [[2, 0], [4, 24]] }, flat: { pts: [[1, -9]], stop: true },
    wheel: { pts: [[1, -8], [26, -9]] }, hitch: { pts: [[6, 0], [5, 0]], stop: true },
  };
  const PLAYS = [
    { WR1: 'go', WR2: 'go', WR3: 'seam', TE: 'seam' }, { WR1: 'slant', WR2: 'slant', WR3: 'out', TE: 'drag' },
    { WR1: 'post', WR2: 'hitch', WR3: 'drag', TE: 'drag' }, { WR1: 'hitch', WR2: 'corner', WR3: 'corner', TE: 'out' },
    { WR1: 'post', WR2: 'dig', WR3: 'curl', TE: 'seam' }, { WR1: 'out', WR2: 'go', WR3: 'slant', TE: 'corner' },
    { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE: 'dig' },
  ];
  const SKIN = ['#f1c7a1', '#d9a17a', '#a8714a', '#7a4e2d', '#5a3a22'];

  // ---------- 5x7 pixel font ----------
  const G = {
    A: '.###.#...##...#######...##...##...#', B: '####.#...##...#####.#...##...#####.', C: '.###.#...##....#....#....#...#.###.', D: '####.#...##...##...##...##...#####.',
    E: '######....#....####.#....#....#####', F: '######....#....####.#....#....#....', G: '.###.#...##....#.####...##...#.####', H: '#...##...##...#######...##...##...#',
    I: '#####..#....#....#....#....#..#####', J: '..###...#....#....#.#..#.#..#..##..', K: '#...##..#.#.#..##...#.#..#..#.#...#', L: '#....#....#....#....#....#....#####',
    M: '#...###.###.#.##.#.##...##...##...#', N: '#...###..##.#.##..###...##...##...#', O: '.###.#...##...##...##...##...#.###.', P: '####.#...##...#####.#....#....#....',
    Q: '.###.#...##...##...##.#.##..#..##.#', R: '####.#...##...#####.#.#..#..#.#...#', S: '.#####....#.....###.....#....#####.', T: '#####..#....#....#....#....#....#..',
    U: '#...##...##...##...##...##...#.###.', V: '#...##...##...##...##...#.#.#...#..', W: '#...##...##...##.#.##.#.###.###...#', X: '#...##...#.#.#...#...#.#.#...##...#',
    Y: '#...##...#.#.#...#....#....#....#..', Z: '#####....#...#...#...#...#....#####',
    0: '.###.#...##..###.#.###..##...#.###.', 1: '..#...##....#....#....#....#...###.', 2: '.###.#...#....#...#...#...#...#####', 3: '#####...#...#.....#.....##...#.###.',
    4: '...#...##..#.#.#..#.#####...#....#.', 5: '######....####.....#....##...#.###.', 6: '..##..#...#....####.#...##...#.###.', 7: '#####....#...#...#...#....#....#...',
    8: '.###.#...##...#.###.#...##...#.###.', 9: '.###.#...##...#.####....#...#..##..',
    ' ': '...................................', '&': '.##..#..#.#.#...#...#.#.##..#..##.#', '-': '...............#####...............', ':': '.......#..............#............',
    '.': '................................#..', '!': '..#....#....#....#....#.........#..', '?': '.###.#...#....#...#...#.........#..', '+': '.......#....#..#####..#....#.......',
    '/': '....#....#...#...#...#...#....#....', "'": '..#....#...........................', ',': '...........................#...#...', '>': '.#.....#.....#.....#...#...#...#...',
    '(': '...#...#...#....#....#.....#.....#.', ')': '.#.....#.....#....#....#...#...#...', '%': '##..###..#...#...#...#...#..###..##', '#': '.#.#..#.#.#####.#.#.#####.#.#..#.#.',
    '<': '...#...#...#...#.....#.....#.....#.',
    a: '...........###.....#.#####...#.####', b: '#....#....####.#...##...##...#####.', c: '...........###.#....#....#...#.###.', d: '....#....#.#####...##...##...#.####', e: '...........###.#...#######.....###.', f: '..##..#..#.#...###...#....#....#...', g: '......#####...##...#.####....#.###.', h: '#....#....#.##.##..##...##...##...#', i: '..#........##....#....#....#...###.', j: '...#........##....#....#.#..#..##..', k: '#....#....#..#.#.#..##...#.#..#..#.', l: '.##....#....#....#....#....#...###.', m: '..........##.#.#.#.##.#.##...##...#', n: '..........#.##.##..##...##...##...#', o: '...........###.#...##...##...#.###.', p: '..........####.#...#####.#....#....', q: '...........#####...#.####....#....#', r: '..........#.##.##..##....#....#....', s: '...........#####.....###.....#####.', t: '.#....#...###...#....#....#..#..##.', u: '..........#...##...##...##..##.##.#', v: '..........#...##...##...#.#.#...#..', w: '..........#...##...##.#.##.#.#.#.#.', x: '..........#...#.#.#...#...#.#.#...#', y: '..........#...##...#.####....#.###.', z: '..........#####...#...#...#...#####', '×': '.....#...#.#.#...#...#.#.#...#.....', '·': '.................#.................', '^': '..#...#.#.#...#....................',
  };
  function glyph(c) { return (G[c] || G[c.toUpperCase()] || G['?']).padEnd(35, '.'); }

  MFLArcade.register('bowl', {
    start(ctx) {
      const R = ctx.rng, L = LVL[ctx.level] || LVL[0];
      const home = ctx.data.home, away = ctx.data.away;
      const P = {}; for (const p of home.players) if (p) P[p.pos] = p;
      const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

      // ---------- DOM ----------
      if (!document.getElementById('mb-css')) {
        const st = document.createElement('style'); st.id = 'mb-css';
        st.textContent = `.mb-wrap{position:relative;width:100%;user-select:none;-webkit-user-select:none}
.mb-screen{position:relative;width:100%;background:#000;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(0,0,0,.9)}
.mb-screen canvas{display:block;width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none}
.mb-wrap:fullscreen{background:#000;display:flex;flex-direction:column;justify-content:center}
.mb-wrap:fullscreen .mb-screen{border-radius:0;max-height:100vh}
.mb-wrap:fullscreen canvas{width:auto;height:100vh;max-width:100vw;margin:0 auto;object-fit:contain}
.mb-rot{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0b0d12;color:#fff;font:13px 'Press Start 2P',monospace;text-align:center;padding:20px;line-height:1.6}
.mb-rot b{font-size:34px}
.mb-rot button,.mb-bar button{font:700 12px Inter;color:#d6d9e0;background:#161922;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 14px;cursor:pointer}
.mb-bar{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap}
.mb-bar>span{font:600 12px Inter;color:#6f7584}
.mb-btns{display:flex;gap:6px}
@media (orientation:portrait) and (max-width:700px){.mb-wrap:not(.mb-anyway) .mb-rot{display:flex}}`;
        document.head.appendChild(st);
      }
      const wrap = document.createElement('div'); wrap.className = 'mb-wrap';
      wrap.innerHTML = `<div class="mb-screen"><canvas></canvas><div class="mb-rot"><b>↻</b><div>TURN YOUR PHONE<br>SIDEWAYS</div><button type="button" class="mb-any">Play anyway</button></div></div>
        <div class="mb-bar"><span>${ctx.exhibition ? 'Exhibition' : (ctx.risk ? 'Risk mode · ' : '') + L.name}${fine ? ' · Click/Space snap · Drag back to throw · Click the RB to hand off · ↑↓ juke · Space dive · P pause' : ''}</span>
        <span class="mb-btns"><button type="button" class="mb-snd">Sound on</button><button type="button" class="mb-full">Fullscreen</button><button type="button" class="mb-pause">Pause</button><button type="button" class="mb-quit">Quit</button></span></div>`;
      ctx.root.appendChild(wrap);
      const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
      wrap.querySelector('.mb-any').onclick = () => wrap.classList.add('mb-anyway');
      let LW = 320;
      function size() {
        const box = wrap.getBoundingClientRect();
        const aspect = document.fullscreenElement === wrap ? window.innerWidth / window.innerHeight : Math.max(1.5, Math.min(2.2, box.width / Math.max(260, Math.min(window.innerHeight - 160, box.width * 0.6))));
        LW = Math.round(Math.max(360, Math.min(540, LH * aspect)));
        cv.width = LW; cv.height = LH; g.imageSmoothingEnabled = false;
      }
      size();
      window.addEventListener('resize', size);
      document.addEventListener('fullscreenchange', size);
      wrap.querySelector('.mb-full').onclick = async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else { await wrap.requestFullscreen(); try { await screen.orientation.lock('landscape'); } catch {} }
        } catch {}
      };

      // ---------- sound: crowd + chiptune blips ----------
      let muted = false; try { muted = localStorage.getItem('mb-mute') === '1'; } catch {}
      let actx = null, crowdGain = null;
      function crowd() {
        if (muted || crowdGain) return;
        try {
          actx = actx || new (window.AudioContext || window.webkitAudioContext)();
          const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
          const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
          const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
          crowdGain = actx.createGain(); crowdGain.gain.value = 0.025;
          src.connect(f).connect(crowdGain).connect(actx.destination); src.start();
        } catch {}
      }
      function cheer(level = 0.12, t = 1.6) { if (!crowdGain || muted) return; const n = actx.currentTime; crowdGain.gain.cancelScheduledValues(n); crowdGain.gain.setValueAtTime(level, n); crowdGain.gain.exponentialRampToValueAtTime(0.025, n + t); }
      const sfx = (n) => { if (!muted) ctx.sound(n); };
      const sndBtn = wrap.querySelector('.mb-snd');
      const syncSnd = () => { sndBtn.textContent = muted ? 'Sound off' : 'Sound on'; if (crowdGain) crowdGain.gain.value = muted ? 0 : 0.025; };
      sndBtn.onclick = () => { muted = !muted; try { localStorage.setItem('mb-mute', muted ? '1' : '0'); } catch {} if (!muted) crowd(); syncSnd(); };
      syncSnd();

      // ---------- pixel helpers ----------
      function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
      function textW(s, sc = 1) { return String(s).length * 6 * sc - sc; }
      function text(s, x, y, c = '#fff', sc = 1, align = 'left', shadow = '#000') {
        s = String(s);
        let x0 = align === 'center' ? x - textW(s, sc) / 2 : align === 'right' ? x - textW(s, sc) : x;
        x0 = Math.round(x0); y = Math.round(y);
        for (const pass of shadow ? [1, 0] : [0]) {
          g.fillStyle = pass ? shadow : c;
          let cx = x0 + pass * sc;
          for (const ch of s) {
            const gl = glyph(ch);
            for (let i = 0; i < 35; i++) if (gl[i] === '#') g.fillRect(cx + (i % 5) * sc, y + pass * sc + Math.floor(i / 5) * sc, sc, sc);
            cx += 6 * sc;
          }
        }
      }
      function box(x, y, w, h, fill = 'rgba(8,10,16,.88)', edge = '#fff') { rect(x, y, w, h, edge); rect(x + 1, y + 1, w - 2, h - 2, fill); }
      const shade = (hex, f) => { const n = parseInt(String(hex || '#888').slice(1, 7), 16) || 0x888888; const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
      const light = (hex) => { const n = parseInt(String(hex || '#888').slice(1, 7), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 150; };

      // ---------- sprites: little outlined helmet guys, built once per team and skin ----------
      // 11 x 16, Retro Bowl-ish proportions: big round helmet, wide shoulder pads.
      // Letters: H helmet, W helmet stripe, F facemask, S skin, J jersey, D shoulder trim, N number, P pants, K socks, B cleats.
      // Tall, lanky 8 x 21 guys (original design): small round helmet, thin torso, long legs.
      const BODY = [
        '..HHHH..', '.HHWWHH.', '.HHWHHFF', '.HHHHSF.', '..HSSS..', '...SS...',
        '.DJJJJD.', 'SJJNNJJS', 'SJJNNJJS', '.JJJJJJ.', '..JJJJ..', '..PPPP..', '..PPPP..',
      ];
      const LEGS = [
        ['..P..P..', '..P..P..', '..P..P..', '..K..K..', '..K..K..', '..K..K..', '.BB.BB..', '........'],
        ['..PP.P..', '.PP...P.', '.P....P.', 'KK.....K', 'K......K', 'K.......', 'BB....BB', '........'],
        ['...PP...', '...PP...', '...PP...', '...KK...', '...KK...', '...KK...', '..BBB...', '........'],
        ['..P.PP..', '.P...PP.', '.P....P.', 'K.....KK', 'K......K', '.......K', 'BB....BB', '........'],
      ];
      // Throwing pose: arm cocked back over the helmet.
      const THROW = ['S.HHHH..', 'SHHWWHH.', 'SHHWHHFF', 'SHHHHSF.', 'J.HSSS..', 'J..SS...', 'JDJJJJD.', '.JJNNJJS', '.JJNNJJS', '.JJJJJJ.', '..JJJJ..', '..PPPP..', '..PPPP..'];
      const spriteCache = new Map();
      // Offense wears its colors; the defense wears white jerseys with colored trim (home vs away look).
      function sprite(team, skin, frame, flip, def) {
        const key = team.abbr + skin + frame + flip + def;
        if (spriteCache.has(key)) return spriteCache.get(key);
        const rows = frame === 9 ? [...THROW, ...LEGS[0]] : [...BODY, ...LEGS[frame]];
        const col = team.color || '#888', col2 = team.color2 || '#fff';
        const pal = def
          ? { H: col, W: light(col) ? shade(col, 0.6) : '#ffffff', F: '#c9ccd3', S: skin, J: '#f1f1f1', D: col, N: col, P: '#e8e8e8', K: col, B: '#151515' }
          : { H: col, W: light(col) ? shade(col, 0.6) : '#ffffff', F: '#c9ccd3', S: skin, J: col, D: light(col2) ? col2 : '#ffffff', N: light(col) ? shade(col, 0.55) : '#ffffff', P: light(col2) ? col2 : '#e8e8e8', K: col, B: '#151515' };
        const W2 = 8, c = document.createElement('canvas'); c.width = W2 + 2; c.height = 23;
        const x = c.getContext('2d');
        const at = (i, j) => (rows[j] ? rows[j][flip ? W2 - 1 - i : i] : undefined);
        const filled = (i, j) => { const v = at(i, j); return v && v !== '.'; };
        for (let j = -1; j <= 21; j++) for (let i = -1; i <= W2; i++) {
          if (filled(i, j)) { x.fillStyle = pal[at(i, j)]; x.fillRect(i + 1, j + 1, 1, 1); }
          else if (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1)) { x.fillStyle = '#0a0a0d'; x.fillRect(i + 1, j + 1, 1, 1); }
        }
        // flag-football flags on the hips
        x.fillStyle = def ? '#ffd400' : '#ff3b3b'; x.fillRect(flip ? W2 - 1 : 2, 13, 1, 3);
        spriteCache.set(key, c);
        return c;
      }

      // ---------- game state ----------
      const st = {
        us: 0, them: 0, q: 1, clock: QLEN, ot: 0, phase: 'intro', t: 0, playT: 0, half2: false,
        los: 25, fd: 35, down: 1, play: PLAYS[0], ents: [], def: [], ball: null, carrier: null, aim: null, kick: null, sim: null,
        stats: { pass: 0, rush: 0, td: 0, comp: 0, att: 0, int: 0, sacks: 0 }, msg: null, parts: [], cam: 25, crowdT: 0,
      };
      let over = false, stop = false, paused = false;
      const say = (t1, color = '#fff', dur = 1.4, sub = '') => { st.msg = { t1, color, t: 0, dur, sub }; };
      const rating = (p, k) => (p && p[k]) || 50;
      const speedOf = (p) => 5.4 + (rating(p, 'spd') - 40) / 60 * 3.2;
      const hashStr = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      function setup() {
        const x0 = st.los, ents = [];
        const add = (pos, x, y) => { const p = P[pos] || { name: pos, ovr: 50 }; ents.push({ pos, p, x, y, vx: 0, vy: 0, sk: SKIN[hashStr(p.name) % SKIN.length], route: null, ri: 0, anim: 0 }); };
        add('UTIL1', x0 - 0.6, MID); add('QB', x0 - 4.5, MID); add('RB', x0 - 5.5, MID + 3);
        add('WR1', x0 - 0.6, 4); add('WR2', x0 - 0.6, FW - 4); add('WR3', x0 - 1.2, 12); add('TE', x0 - 0.8, MID + 8.2);
        // the rest of the offensive line (they block; they're not in your Starting 8)
        for (const [i, dy] of [[1, -2.7], [2, 2.7], [3, -5.4], [4, 5.4]]) { const base = P.UTIL1 || { ovr: 55 }; ents.push({ pos: 'OL', p: { ...base, name: 'Lineman ' + i, ovr: base.ovr, str: base.str }, x: x0 - 0.7, y: MID + dy, vx: 0, vy: 0, sk: SKIN[(i * 7 + 1) % SKIN.length], route: null, ri: 0, anim: 0 }); }
        st.ents = ents;
        const by = Object.fromEntries(ents.map((e) => [e.pos, e]));
        const d = [];
        const dp = (role, x, y, target) => d.push({ role, x, y, vx: 0, vy: 0, target, hist: [], sk: SKIN[(d.length * 3 + st.down) % SKIN.length], tried: false, stun: 0, anim: 0 });
        for (const dy of [-4.1, -1.4, 1.4, 4.1]) dp('dl', x0 + 1.3, MID + dy);
        for (const pos of ['WR1', 'WR2', 'WR3', 'TE']) dp('cover', by[pos].x + L.cushion + 1.5, by[pos].y, by[pos]);
        dp('lb', x0 + 5.5, MID + 2, by.RB); dp('spy', x0 + 5.5, MID - 3); dp('safe', x0 + 14, MID);
        st.def = d;
        st.ball = { x: x0, y: MID, z: 0.5, holder: by.UTIL1, flight: null };
        st.carrier = null; st.aim = null; st.playT = 0; st.thrown = false; st.handoff = false;
        st.play = PLAYS[Math.floor(R() * PLAYS.length)];
        for (const e of ents) {
          const rk = st.play[e.pos]; if (!rk) continue;
          const r = ROUTES[rk], inward = Math.sign(MID - e.y) || 1;
          let cx = e.x, cy = e.y;
          e.route = r.pts.map(([dx, dy]) => { cx += dx; cy = clamp(cy + dy * inward, 1.5, FW - 1.5); return { x: cx, y: cy }; });
          e.stop = !!r.stop; e.ri = 0;
        }
      }

      // ---------- coordinates ----------
      const camLeft = () => LW * 0.4;
      const sx = (x) => Math.round((x - st.cam) * PX + camLeft());
      const sy = (y, z = 0) => Math.round(FY0 + y * PY - z * PX * 0.75);
      const toWorldDir = (dx, dy) => ({ x: dx / PX, y: dy / PY });

      // ---------- drawing ----------
      // Big field numbers, drawn once into little canvases (upside-down copies for the far side).
      const numCache = new Map();
      function bigNum(n, flip) {
        const key = n + (flip ? 'f' : '');
        if (numCache.has(key)) return numCache.get(key);
        const sc = 3, c = document.createElement('canvas'); c.width = textW(n, sc) + 2; c.height = 7 * sc + 2;
        const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,.82)';
        let cx = 0;
        for (const ch of n) { const gl = glyph(ch); for (let i = 0; i < 35; i++) if (gl[i] === '#') x.fillRect(cx + (i % 5) * sc, Math.floor(i / 5) * sc, sc, sc); cx += 6 * sc; }
        let out = c;
        if (flip) { out = document.createElement('canvas'); out.width = c.width; out.height = c.height; const y = out.getContext('2d'); y.translate(c.width, c.height); y.rotate(Math.PI); y.drawImage(c, 0, 0); }
        numCache.set(key, out);
        return out;
      }
      function drawField() {
        rect(0, 0, LW, LH, '#3d7f2f');
        // grass stripes every 5 yards, end zones in team colors
        for (let yd = -10; yd < 110; yd += 5) {
          const a = sx(yd), b = sx(yd + 5); if (b < 0 || a > LW) continue;
          let c = Math.floor((yd + 10) / 5) % 2 === 0 ? '#4a8f3c' : '#45883a';
          if (yd < 0) c = shade(home.color, 0.8); else if (yd >= 100) c = shade(away.color, 0.8);
          rect(a, FY0, b - a, LH - FY0, c);
        }
        // end zone names, big and sideways
        for (const [cx, team] of [[-5, home], [105, away]]) {
          const x = sx(cx); if (x < -60 || x > LW + 60) continue;
          const name = team.name.toUpperCase().slice(0, 10), n = name.length, step = 16;
          const y0 = Math.round(sy(MID) - (n * step) / 2);
          for (let i = 0; i < n; i++) text(name[i], x - 4, y0 + i * step, light(team.color) ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.75)', 2, 'left', null);
        }
        // yard lines every 5, full height
        for (let yd = 0; yd <= 100; yd += 5) {
          const x = sx(yd); if (x < -2 || x > LW + 2) continue;
          rect(x, FY0, yd % 10 === 0 || yd === 0 || yd === 100 ? 2 : 1, LH - FY0, 'rgba(255,255,255,.9)');
        }
        // hash marks: along both sidelines and two rows in the middle
        for (let yd = 1; yd < 100; yd++) {
          const x = sx(yd); if (x < 0 || x > LW || yd % 5 === 0) continue;
          for (const yy of [1.2, MID - 6, MID + 6, FW - 1.2]) rect(x, sy(yy) - 1, 1, 3, 'rgba(255,255,255,.85)');
        }
        // big numbers near both sidelines (far ones upside down), with arrows toward the near goal
        for (let yd = 10; yd <= 90; yd += 10) {
          const x = sx(yd); if (x < -40 || x > LW + 40) continue;
          const n = String(yd <= 50 ? yd : 100 - yd);
          const top = bigNum(n, true), bot = bigNum(n, false);
          g.drawImage(top, x - Math.round(top.width / 2) + 1, sy(6.5) - Math.round(top.height / 2));
          g.drawImage(bot, x - Math.round(bot.width / 2) + 1, sy(FW - 6.5) - Math.round(bot.height / 2));
          if (yd !== 50) {
            const dir = yd < 50 ? -1 : 1, ax = x + dir * (Math.round(bot.width / 2) + 5);
            for (const yy of [6.5, FW - 6.5]) { const ay = sy(yy); for (let i = 0; i < 4; i++) rect(ax + dir * -i, ay - i, 1, i * 2 + 1, 'rgba(255,255,255,.82)'); }
          }
        }
        // sidelines
        rect(0, FY0 - 1, LW, 2, '#ffffff'); rect(0, LH - 2, LW, 2, '#ffffff');
        // line of scrimmage + first down marker
        if (['presnap', 'play', 'flight', 'carry', 'dead', 'fourth'].includes(st.phase)) {
          rect(sx(st.los), FY0, 2, LH - FY0, '#3f6fff');
          if (st.fd < 100) rect(sx(st.fd), FY0, 2, LH - FY0, '#ffe000');
        }
      }
      // Pre-snap: routes with arrowheads, a ring under the QB, stars over the best players.
      function arrowLine(pts, color) {
        for (let k = 0; k < pts.length - 1; k++) {
          const [x1, y1] = pts[k], [x2, y2] = pts[k + 1], n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
          for (let i = 0; i <= n; i++) rect(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 2, 2, color);
        }
        const [xa, ya] = pts[pts.length - 2], [xb, yb] = pts[pts.length - 1], ang = Math.atan2(yb - ya, xb - xa);
        for (let i = 1; i <= 5; i++) for (const s2 of [-1, 1]) rect(xb - Math.cos(ang + s2 * 0.6) * i, yb - Math.sin(ang + s2 * 0.6) * i, 2, 2, color);
      }
      function drawPresnap() {
        for (const e of st.ents) {
          if (!e.route) continue;
          const pts = [[sx(e.x), sy(e.y)], ...e.route.map((w) => [sx(w.x), sy(w.y)])];
          if (!e.stop) { const a = e.route[e.route.length - 2] || { x: e.x, y: e.y }, b = e.route[e.route.length - 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1; pts.push([sx(b.x + (b.x - a.x) / d * 6), sy(b.y + (b.y - a.y) / d * 6)]); }
          arrowLine(pts, e.pos === 'TE' ? '#5aa0ff' : '#3ddc5a');
        }
        const rb = st.ents.find((e) => e.pos === 'RB');
        if (rb) arrowLine([[sx(rb.x), sy(rb.y)], [sx(rb.x + 2), sy(rb.y + 2)], [sx(rb.x + 7), sy(rb.y + 2)]], '#5aa0ff');
        const qb = st.ents.find((e) => e.pos === 'QB');
        if (qb) { const x = sx(qb.x), y = sy(qb.y); for (let a = 0; a < 24; a++) rect(x + Math.cos(a / 24 * 6.283) * 8, y - 6 + Math.sin(a / 24 * 6.283) * 8, 1, 1, '#ffffff'); }
        // "1st & 10" tag by the ball
        const s1 = `${['1st', '2nd', '3rd', '4th'][st.down - 1]} & ${st.fd >= 100 ? 'Goal' : Math.max(1, Math.round(st.fd - st.los))}`;
        const tx = sx(st.los) + 4, ty = sy(MID + 10);
        rect(tx, ty, textW(s1) + 8, 11, '#000'); text(s1, tx + 4, ty + 2, '#fff', 1, 'left', null);
      }
      function star(x, y) { rect(x, y - 2, 1, 1, '#ffe000'); rect(x - 1, y - 1, 3, 1, '#ffe000'); rect(x - 2, y, 5, 1, '#ffe000'); rect(x - 1, y + 1, 3, 1, '#ffe000'); rect(x - 1, y + 2, 1, 1, '#ffe000'); rect(x + 1, y + 2, 1, 1, '#ffe000'); }
      function drawGuy(e, team, def) {
        const moving = Math.hypot(e.vx, e.vy) > 0.4;
        e.anim += moving ? Math.hypot(e.vx, e.vy) * 0.03 : 0;
        const frame = e.pos === 'QB' && st.aim && st.aim.target && st.ball.holder === e ? 9 : e.throwT > st.t ? 9 : moving ? 1 + (Math.floor(e.anim * 4) % 3) : 0;
        const face = e.pos === 'QB' && st.aim && st.aim.target ? st.aim.target.x < e.x : Math.abs(e.vx) > 0.2 ? e.vx < 0 : def;
        const x = sx(e.x), y = sy(e.y);
        if (x < -12 || x > LW + 12) return;
        rect(x - 4, y - 1, 8, 2, 'rgba(0,0,0,.3)');
        g.drawImage(sprite(team, e.sk, frame, face, def), x - 5, y - 22);
      }
      function drawBall() {
        const b = st.ball; if (!b) return;
        let bx = b.x, by = b.y, bz = b.z;
        if (b.holder && !b.flight) { bx = b.holder.x + 0.25; by = b.holder.y; bz = 1.1; }
        const x = sx(bx), y = sy(by, bz);
        if (b.flight) rect(sx(bx) - 1, sy(by) - 1, 3, 1, 'rgba(0,0,0,.35)');
        rect(x - 2, y - 1, 4, 2, '#7a3e12'); rect(x - 1, y - 2, 2, 4, '#7a3e12'); rect(x, y - 1, 1, 1, '#f2e6d0');
      }
      const arcH = (d) => 0.5 + d * 0.08 + Math.max(0, d - 18) * 0.04; // deeper = higher floater
      function drawAim() {
        const a = st.aim; if (!a || !a.target) return;
        const qb = st.ball.holder; if (!qb) return;
        const d = dist(qb, a.target), h = arcH(d), n = Math.max(10, Math.round(d * 1.2));
        for (let i = 1; i <= n; i++) {
          const t = i / n, x = qb.x + (a.target.x - qb.x) * t, y = qb.y + (a.target.y - qb.y) * t, z = 2.2 + 4 * h * t * (1 - t);
          if (i % 2 === 0) rect(sx(x), sy(y), 1, 1, 'rgba(0,0,0,.35)');
          rect(sx(x), sy(y, z), 2, 2, i % 3 ? '#ffffff' : '#ffe000');
        }
        const tx = sx(a.target.x), ty = sy(a.target.y);
        for (let k = 0; k < 20; k++) { const ang = k / 20 * 6.283; rect(tx + Math.cos(ang) * 6, ty + Math.sin(ang) * 3, 1, 1, '#ffe000'); }
        rect(tx - 1, ty - 1, 3, 3, '#ffe000');
      }
      const fmtClock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
      function hud() {
        rect(0, 0, LW, 11, '#000');
        text(`${home.abbr.slice(0, 3)} ${st.us}   ${away.abbr.slice(0, 3)} ${st.them}`, 4, 2, '#fff', 1, 'left', null);
        text(st.ot ? `OT` : `${['1st', '2nd', '3rd', '4th'][Math.min(4, st.q) - 1]} Qtr ${fmtClock(st.clock)}`, LW / 2, 2, '#fff', 1, 'center', null);
        if (['presnap', 'play', 'flight', 'carry', 'dead', 'fourth'].includes(st.phase))
          text(`${['1st', '2nd', '3rd', '4th'][st.down - 1]} & ${st.fd >= 100 ? 'Goal' : Math.max(1, Math.round(st.fd - st.los))}`, LW - 4, 2, '#fff', 1, 'right', null);
      }
      let buttons = [];
      function button(id, label, x, y, w, h = 15, hot = false) {
        buttons.push({ id, x, y, w, h });
        box(x, y, w, h, hot ? '#ffd400' : 'rgba(10,12,18,.92)', hot ? '#fff3a0' : '#ffffff');
        text(label, x + w / 2, y + Math.round((h - 7) / 2), hot ? '#111' : '#fff', 1, 'center', null);
      }
      function banner() {
        const m = st.msg; if (!m) return;
        const sc = m.t1.length > 12 ? 2 : 3, pop = m.t < 0.12 ? 1 : 0;
        const y = Math.round(LH * 0.33) - pop * 2;
        text(m.t1, LW / 2, y, m.color, sc, 'center', '#000');
        if (m.sub) text(m.sub, LW / 2, y + sc * 7 + 5, '#fff', 1, 'center', '#000');
      }
      function particles(dt) {
        for (const p of st.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.life -= dt; rect(p.x, p.y, 2, 2, p.c); }
        st.parts = st.parts.filter((p) => p.life > 0);
      }
      function fireworks(n = 60) { for (let i = 0; i < n; i++) st.parts.push({ x: LW / 2 + (R() - 0.5) * LW * 0.7, y: LH * 0.35 + (R() - 0.5) * 40, vx: (R() - 0.5) * 120, vy: -40 - R() * 90, life: 1 + R(), c: [home.color, '#ffd400', '#fff', '#ff5b69', '#7cfc9a'][i % 5] }); }

      // ---------- clock ----------
      function runClock(sec) {
        if (st.ot) return;
        st.clock -= sec;
        while (st.clock <= 0 && st.q < 4) {
          st.q++; st.clock += QLEN;
          if (st.q === 3) st.halftime = true;
        }
      }
      const timeUp = () => !st.ot && st.q >= 4 && st.clock <= 0;

      // ---------- flow ----------
      function startDrive(x, why = '') {
        st.los = clamp(x, 1, 99); st.down = 1; st.fd = Math.min(100, st.los + 10); st.phase = 'presnap'; setup();
        st.cam = st.los + 10;
        say(why || '1ST & 10', '#ffd400', 1.1, st.los <= 50 ? `BALL ON OWN ${Math.round(st.los)}` : `BALL ON OPP ${Math.round(100 - st.los)}`);
      }
      function nextSnap() {
        if (timeUp()) return endGame();
        if (st.halftime) { st.halftime = false; say('HALFTIME', '#ffd400', 1.6, `${home.abbr} ${st.us} - ${st.them} ${away.abbr}`); setTimeout(() => endDrive('half', st.los), 1700); st.phase = 'dead'; return; }
        st.phase = st.down === 4 ? 'fourth' : 'presnap'; setup();
      }
      function endPlay(x, why, clockStops) {
        st.phase = 'dead';
        if (st.two) { st.two = false; say('NO GOOD', '#ff5b69', 1); setTimeout(() => endDrive('score', 0), 1100); return; }
        if (why === 'int') { st.stats.int++; return setTimeout(() => endDrive('int', x), 1300); }
        runClock(clockStops ? 3 : 18);
        const gain = why === 'inc' ? 0 : x - st.los;
        if (why !== 'inc') st.los = clamp(x, 1, 99);
        if (st.los >= st.fd) { st.down = 1; st.fd = Math.min(100, st.los + 10); say('FIRST DOWN', '#ffd400', 1); sfx('good'); cheer(0.06, 1); }
        else {
          st.down++;
          if (why === 'inc') say('INCOMPLETE', '#fff', 0.9);
          else if (why === 'sack') say('SACKED', '#ff5b69', 1, `${Math.round(gain)} YDS`);
          else if (gain >= 8) say(`+${Math.round(gain)} YARDS`, '#7cfc9a', 0.9);
          if (st.down > 4) { say('TURNOVER ON DOWNS', '#ff5b69', 1.3); setTimeout(() => endDrive('downs', st.los), 1300); return; }
        }
        setTimeout(() => { if (st.phase === 'dead') nextSnap(); }, 1050);
      }
      function touchdown() {
        if (st.two) { st.two = false; st.us += 2; st.phase = 'dead'; fireworks(40); cheer(0.12); say('2 POINTS!', '#ffd400', 1.3); sfx('good'); setTimeout(() => endDrive('score', 0), 1300); return; }
        st.us += 6; st.stats.td++; st.phase = 'dead'; fireworks(); sfx('win'); cheer(0.16, 2.4); st.crowdT = 2.5;
        say('TOUCHDOWN!', '#ffd400', 2, (st.carrier && st.carrier.p.name || '').toUpperCase());
        runClock(8);
        setTimeout(() => { st.phase = 'pat'; }, 2000);
      }
      function endDrive(why, spot) {
        if (timeUp() && why !== 'half') return endGame();
        st.phase = 'sim'; simDrive(why, spot);
      }
      // The other team's drive is simulated (like the real game): field position, level and your defenders matter.
      function simDrive(why, spot) {
        const defs = home.players.filter((p) => p && /UTIL/.test(p.pos));
        const defRate = defs.length ? defs.reduce((s, p) => s + (p.def || p.ovr || 50), 0) / defs.length : 50;
        const start = why === 'int' || why === 'downs' ? 100 - spot : why === 'punt' ? clamp(100 - spot - 38, 8, 40) : 25;
        let td = L.td + (start - 25) / 160 - (defRate - 55) / 260 + (away.boost || 0);
        td = clamp(td, 0.06, 0.85);
        const roll = R();
        let res = roll < td ? 'td' : roll < td + L.fg ? 'fg' : roll < td + L.fg + 0.09 ? 'turnover' : 'punt';
        const used = res === 'td' ? 70 + R() * 80 : res === 'fg' ? 60 + R() * 70 : 30 + R() * 60;
        const plays = 3 + Math.floor(R() * 8), yds = Math.round(res === 'td' ? 100 - start : 5 + R() * 40);
        const wasQ = st.q; runClock(used);
        if (!st.ot && st.q === 4 && st.clock <= 0 && res !== 'td' && res !== 'fg') res = 'clock';
        if (res === 'td') st.them += R() < 0.88 ? 7 : R() < 0.5 ? 6 : 8;
        if (res === 'fg') st.them += 3;
        st.sim = { res, t: 0, lines: [`${away.name.toUpperCase()} DRIVE`, `${plays} PLAYS  ${yds} YARDS  ${fmtClock(used)}`, { td: 'TOUCHDOWN', fg: 'FIELD GOAL', turnover: 'YOUR DEFENSE GETS A TURNOVER!', punt: 'THEY PUNT', clock: 'THEY RUN OUT THE CLOCK' }[res]], half: wasQ <= 2 && st.q >= 3 };
        sfx(res === 'td' || res === 'fg' ? 'bad' : 'good');
        if (st.halftime) st.halftime = false;
      }
      function afterSim() {
        const res = st.sim.res; st.sim = null;
        if (st.ot) { st.otPoss = (st.otPoss || 0) + 1; }
        if (timeUp() || (st.ot && st.otPoss >= 2 && st.us !== st.them)) return endGame();
        if (st.ot && st.otPoss >= 2) { st.otPoss = 0; if (st.ot >= 2) return endGame(); st.ot++; }
        startDrive(st.ot ? 75 : res === 'turnover' ? 45 + Math.floor(R() * 15) : res === 'punt' ? 15 + Math.floor(R() * 18) : 25, st.ot ? 'OVERTIME' : '');
      }
      function endGame() {
        if (over) return;
        if (st.us === st.them && !st.ot) { st.ot = 1; st.otPoss = 0; st.q = 5; say('OVERTIME', '#ffd400', 1.6); setTimeout(() => startDrive(75, 'OVERTIME'), 1700); st.phase = 'dead'; return; }
        st.phase = 'over'; over = true;
        const won = st.us > st.them, tie = st.us === st.them;
        say(won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'FINAL', won ? '#ffd400' : '#fff', 99, `${home.abbr} ${st.us} - ${st.them} ${away.abbr}`);
        if (won) { fireworks(120); cheer(0.18, 3); st.crowdT = 4; }
        setTimeout(() => ctx.finish({ won, tie, score: st.us, opp: st.them, stats: st.stats,
          detail: `${won ? 'Won' : tie ? 'Tied' : 'Lost'} ${st.us}-${st.them} · ${st.stats.td} TD · ${st.stats.pass} pass yds · ${st.stats.rush} rush yds` }), 1800);
        setTimeout(() => { stop = true; }, 5000);
      }

      // ---------- kicking: swipe up behind the kicker ----------
      function startKick(kind) {
        const yards = kind === 'xp' ? 20 : Math.round(100 - st.los + 17);
        const wind = Math.round((R() - 0.5) * (4 + ctx.level * 6));
        st.kick = { kind, yards, wind, done: false, t: 0, ball: null, drag: null };
        st.phase = 'kick';
      }
      function kickRelease(dx, dy) {
        const K = st.kick; if (!K || K.done) return;
        if (dy > -10) return; // must swipe up
        const k = rating(P.UTIL2, 'kick');
        const power = Math.min(1.15, -dy / 70) * (0.85 + k / 400);
        const need = K.yards / 60;
        const aim = dx / 60 + K.wind * 0.012 * (K.yards / 40) + (R() - 0.5) * (1 - k / 120) * 0.2;
        K.done = true; K.good = power >= need && Math.abs(aim) < (0.13 + k / 900 - ctx.level * 0.008);
        K.short = power < need; K.aim = aim; K.f = 0;
        sfx('kick');
        setTimeout(() => {
          if (K.kind === 'xp') { if (K.good) st.us += 1; say(K.good ? 'EXTRA POINT GOOD' : 'NO GOOD', K.good ? '#7cfc9a' : '#ff5b69', 1.1); }
          else { if (K.good) { st.us += 3; fireworks(40); cheer(0.12); } say(K.good ? `${K.yards} YD FIELD GOAL` : K.short ? 'SHORT!' : 'WIDE!', K.good ? '#ffd400' : '#ff5b69', 1.3); }
          sfx(K.good ? 'good' : 'bad');
          runClock(5);
          setTimeout(() => { st.kick = null; endDrive(K.kind === 'fg' && !K.good ? 'downs' : 'score', st.los); }, 1300);
        }, 1000);
      }
      function drawKick(dt) {
        const K = st.kick; if (!K) return;
        // sky, stands and field seen from behind the kicker
        rect(0, 0, LW, LH, '#0e1830');
        for (let i = 0; i < 60; i++) { const h = (i * 2654435761) >>> 0; rect(h % LW, (h >> 8) % 40, 1, 1, '#2c3a5c'); }
        rect(0, 40, LW, 22, '#1b1f2a');
        for (let i = 0; i < LW / 3; i++) { const h = (i * 40503) >>> 0; rect(i * 3, 44 + (h % 14), 2, 2, SKIN[h % 5]); rect(i * 3, 46 + (h % 14), 2, 1, [home.color, away.color, '#ccc'][h % 3]); }
        const hz = 62;
        rect(0, hz, LW, LH - hz, '#3f9a3f');
        for (let i = 0; i < 6; i++) rect(0, hz + 8 + i * 18, LW, 1, 'rgba(255,255,255,.35)');
        const far = clamp(1 - K.yards / 70, 0.25, 0.85), cx = LW / 2, pw = Math.round(30 + 60 * far), py = hz + 4, ph = Math.round(30 + 34 * far);
        rect(cx - pw / 2, py, pw, 2, '#ffd400'); rect(cx - pw / 2, py - ph, 2, ph, '#ffd400'); rect(cx + pw / 2 - 2, py - ph, 2, ph, '#ffd400'); rect(cx - 1, py, 2, 14, '#ffd400');
        text(K.kind === 'xp' ? 'EXTRA POINT' : `${K.yards} YARD FIELD GOAL`, cx, 6, '#ffd400', 1, 'center');
        text(`WIND ${K.wind > 0 ? '>' : K.wind < 0 ? '<' : ''} ${Math.abs(K.wind)} MPH`, cx, 16, '#fff', 1, 'center');
        // holder kneeling and the kicker lined up behind the ball
        g.drawImage(sprite(home, SKIN[1], 0, false, false), cx - 22, LH - 46);
        if (!K.done) g.drawImage(sprite(home, SKIN[0], 0, false, false), cx - 6, LH - 30);
        else g.drawImage(sprite(home, SKIN[0], 1, false, false), cx - 6, LH - 40);
        text(`${home.abbr} ${st.us} - ${st.them} ${away.abbr}`, 4, LH - 10, '#ffd400', 1, 'left');
        if (!K.done) {
          text(fine ? 'DRAG UP FROM THE BALL AND RELEASE' : 'SWIPE UP TO KICK', cx, 28, '#fff', 1, 'center');
          rect(cx - 3, LH - 36, 6, 6, '#7a3e12'); rect(cx - 2, LH - 38, 4, 10, '#7a3e12'); rect(cx - 1, LH - 35, 2, 1, '#f2e6d0');
          if (K.drag) { const { dx, dy } = K.drag; for (let i = 1; i <= 10; i++) rect(cx + dx * i / 10, LH - 34 + dy * i / 10, 2, 2, '#fff'); }
        } else {
          K.f = Math.min(1, K.f + dt * 1.1);
          const f = K.f, endX = cx + K.aim * pw * 2.2, endY = K.short ? py + 8 : py - ph * 0.7;
          const bx = cx + (endX - cx) * f, by = LH - 34 + (endY - (LH - 34)) * f - Math.sin(f * Math.PI) * 40, s = Math.max(2, Math.round(7 * (1 - f * 0.7)));
          rect(bx - s / 2, by - s / 2, s, s, '#7a3e12');
        }
      }

      // ---------- simulation ----------
      function moveTo(e, tx, ty, sp, dt) {
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        if (d < 0.05) { e.vx = 0; e.vy = 0; return true; }
        const s = Math.min(sp, d / dt);
        e.vx = (dx / d) * s; e.vy = (dy / d) * s; e.x += e.vx * dt; e.y += e.vy * dt;
        return d < 0.3;
      }
      function snap() {
        buttons = []; st.phase = 'play'; st.playT = 0; sfx('whistle'); crowd();
        st.ball.holder = st.ents.find((e) => e.pos === 'QB');
      }
      function handoff() {
        if (st.phase !== 'play' || st.thrown || st.handoff || st.playT > 1.6) return;
        st.handoff = true; // RB comes to the QB, then takes it
      }
      function step(dt) {
        st.t += dt; st.playT += dt;
        if (!st.ot && ['play', 'flight', 'carry'].includes(st.phase)) runClock(dt);
        const qb = st.ents.find((e) => e.pos === 'QB'), rb = st.ents.find((e) => e.pos === 'RB'), c = st.ents.find((e) => e.pos === 'UTIL1');
        if (st.phase === 'play' || st.phase === 'flight') {
          for (const e of st.ents) {
            if (e === qb) { if (!st.thrown) moveTo(e, st.los - (st.handoff ? 4.5 : 7), MID, 4, dt); continue; }
            if (e === c || e.pos === 'OL') { // linemen block the closest pass rusher
              const r = st.def.filter((d) => d.role === 'dl').sort((a, b) => dist(a, e) - dist(b, e))[0];
              if (r) moveTo(e, Math.min(st.los, (r.x + qb.x) / 2 + 0.6), (r.y * 2 + qb.y) / 3, 4.2, dt); continue; }
            if (e === rb && st.handoff && st.ball.holder === qb) {
              if (dist(rb, qb) < 1.2) { st.ball.holder = rb; st.carrier = rb; st.phase = 'carry'; st.carryStart = st.los; st.fromRun = true; say('HANDOFF', '#fff', 0.5); }
              else moveTo(e, qb.x + 0.5, qb.y, speedOf(e.p), dt);
              continue;
            }
            if (e === rb && !e.route) { // RB checks down into the flat
              moveTo(e, Math.max(st.los + 1, e.x), clamp(e.y + 4, 1, FW - 1), speedOf(e.p) * 0.6, dt); continue;
            }
            if (e.route && e.ri < e.route.length) { const w = e.route[e.ri]; if (moveTo(e, w.x, w.y, speedOf(e.p), dt)) e.ri++; }
            else if (e.route && !e.stop) { const a = e.route[e.route.length - 2] || { x: e.x - 1, y: e.y }, b = e.route[e.route.length - 1]; const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; moveTo(e, e.x + (b.x - a.x) / d * 5, clamp(e.y + (b.y - a.y) / d * 5, 1, FW - 1), speedOf(e.p), dt); }
            else { e.vx *= 0.8; e.vy *= 0.8; }
            if (st.phase === 'flight' && st.ball.flight && st.ball.flight.t > 0.45) {
              const T = st.ball.flight.target, reach = 3 + rating(e.p, 'cat') / 30;
              if (dist(e, T) < reach) moveTo(e, T.x, T.y, speedOf(e.p) * 1.05, dt);
            }
          }
          for (const d of st.def) {
            if (d.stun > 0) { d.stun -= dt; continue; }
            if (d.role === 'dl') {
              // Rushers lean on the line; after a moment some of them get free.
              if (!d.free && st.playT > L.rush && R() < dt * (0.35 + ctx.level * 0.12)) d.free = true;
              const target = st.ball.holder || qb;
              let sp = L.dspd * 0.9;
              const blocked = !d.free && st.ents.some((b) => (b === c || b.pos === 'OL') && dist(b, d) < 1.2);
              if (blocked) sp *= Math.max(0.05, 0.16 + ctx.level * 0.04 - (rating(c.p, 'str') - 50) / 600);
              moveTo(d, target.x, target.y, Math.max(0.3, sp), dt);
            } else if (d.role === 'spy') {
              moveTo(d, st.los + 5, (st.ball.holder || qb).y, L.dspd * 0.85, dt);
            } else if (d.role === 'safe') {
              const deep = Math.max(...st.ents.filter((e) => e.route).map((e) => e.x));
              let tx = Math.max(st.los + 12, deep + 3), ty = MID;
              if (st.phase === 'flight' && st.ball.flight) { const T = st.ball.flight.target; if (dist(d, T) < L.track + 5) { tx = T.x; ty = T.y; } }
              moveTo(d, tx, ty, L.dspd * 0.95, dt);
            } else {
              const tgt = d.target;
              d.hist.push({ x: tgt.x, y: tgt.y, t: st.playT });
              while (d.hist.length > 1 && st.playT - d.hist[0].t > L.react) d.hist.shift();
              const h = d.hist[0];
              let tx = h.x + (st.playT < 1.2 ? L.cushion : L.cushion * 0.45), ty = h.y;
              if (st.phase === 'flight' && st.ball.flight) { const T = st.ball.flight.target; if (dist(d, T) < L.track + 1.5) { tx = T.x; ty = T.y; } }
              if (d.role === 'lb' && (!tgt.route || st.handoff)) { tx = st.los + 5; ty = (st.ball.holder || qb).y; }
              moveTo(d, tx, ty, L.dspd * (d.role === 'lb' ? 0.92 : 1), dt);
            }
            const hd = st.ball.holder;
            if (hd && st.phase === 'play' && hd === qb && dist(d, qb) < 0.9) { st.stats.sacks++; sfx('bad'); flagFx(qb); endPlay(qb.x, 'sack'); return; }
          }
          if (st.phase === 'flight') {
            const F = st.ball.flight; F.t += dt / F.T;
            const t = Math.min(1, F.t);
            st.ball.x = F.from.x + (F.target.x - F.from.x) * t; st.ball.y = F.from.y + (F.target.y - F.from.y) * t; st.ball.z = 2.2 * (1 - t) + 0.9 * t + 16 * F.h * t * (1 - t);
            if (t >= 1) resolveCatch();
          }
        } else if (st.phase === 'carry') {
          const cr = st.carrier;
          let sp = speedOf(cr.p) * (cr.dive ? 1.5 : 1);
          let vy = 0;
          if (cr.juke > 0) { cr.juke -= dt; vy = cr.jukeDir * sp * 1.25; sp *= 0.9; }
          cr.vx = sp; cr.vy = vy; cr.x += cr.vx * dt; cr.y += cr.vy * dt;
          if (cr.dive) { cr.dive -= dt; if (cr.dive <= 0) { finishCarry(cr.x, 'tackle'); return; } }
          if (cr.x >= 100) { st.stats[st.fromRun ? 'rush' : 'pass'] += Math.round(100 - st.carryStart); touchdown(); return; }
          if (cr.y < 0 || cr.y > FW) { say('OUT OF BOUNDS', '#fff', 0.8); finishCarry(cr.x, 'oob', true); return; }
          for (const d of st.def) {
            if (d.stun > 0) { d.stun -= dt; d.vx = d.vy = 0; continue; }
            const lead = dist(d, cr) / (L.dspd + 0.1) * 0.55;
            moveTo(d, cr.x + cr.vx * lead, cr.y + cr.vy * lead, L.dspd * (d.role === 'dl' ? 0.9 : 1), dt);
            if (dist(d, cr) < 0.85 && !(cr.immune > 0)) {
              const brk = L.brk + (rating(cr.p, 'str') - 50) / 300;
              if (!d.tried && R() < brk) { d.tried = true; d.stun = 0.8; say('BROKEN TACKLE!', '#7cfc9a', 0.6); sfx('good'); continue; }
              flagFx(cr); finishCarry(cr.x, 'tackle'); return;
            }
          }
          if (cr.immune > 0) cr.immune -= dt;
          for (const e of st.ents) if (e !== cr) { e.vx *= 0.9; e.vy *= 0.9; e.x += e.vx * dt; }
        }
      }
      function camera(dt) {
        let fx = st.los + 10;
        if (st.phase === 'carry' && st.carrier) fx = st.carrier.x + 8;
        else if (st.phase === 'flight' && st.ball.flight) fx = st.ball.x + 6;
        else if (st.phase === 'play') { const qb = st.ball.holder || st.ents.find((e) => e.pos === 'QB'); fx = Math.min(st.los + 8 + Math.min(10, st.playT * 3), qb.x + (camLeft() - 24) / PX); }
        const minC = -10 + camLeft() / PX, maxC = 110 - (LW - camLeft()) / PX;
        fx = clamp(fx, minC, maxC);
        st.cam += (fx - st.cam) * Math.min(1, dt * 3.5);
      }
      function flagFx(e) { const x = sx(e.x), y = sy(e.y) - 10; for (let i = 0; i < 10; i++) st.parts.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 70, life: 0.6, c: '#ffd400' }); say('FLAG PULLED', '#fff', 0.7); }
      function finishCarry(x, why, oob) {
        const gain = x - (st.carryStart ?? st.los);
        if (st.fromRun) st.stats.rush += Math.round(gain); else st.stats.pass += Math.round(gain);
        endPlay(x, why, oob);
      }
      function throwBall(target) {
        const qb = st.ball.holder;
        const d = dist(qb, target);
        const acc = rating(P.QB, 'acc'), arm = rating(P.QB, 'thr');
        const err = (1 - acc / 110) * d * 0.09;
        const t2 = { x: target.x + (R() - 0.5) * 2 * err, y: clamp(target.y + (R() - 0.5) * 2 * err, -1, FW + 1) };
        st.ball.flight = { from: { x: qb.x, y: qb.y }, target: t2, T: Math.max(0.3, d / (17 + arm / 10) * (1 + Math.max(0, d - 18) / 60)), t: 0, h: arcH(d) / 4 + 0.2 };
        qb.throwT = st.t + 0.3;
        st.ball.holder = null; st.thrown = true; st.phase = 'flight'; st.stats.att++; st.aim = null; sfx('kick');
      }
      function resolveCatch() {
        const T = st.ball.flight.target;
        const recv = st.ents.filter((e) => ['RB', 'WR1', 'WR2', 'WR3', 'TE'].includes(e.pos)).map((e) => ({ e, d: dist(e, T) })).sort((a, b) => a.d - b.d)[0];
        const dfd = st.def.map((d) => ({ d, dd: dist(d, T) })).sort((a, b) => a.dd - b.dd)[0];
        const rr = 1.5 + rating(recv && recv.e.p, 'cat') / 120;
        st.ball.flight = null;
        if (dfd && dfd.dd < 1.3 && (!recv || dfd.dd < recv.d)) {
          if (R() < L.intc) { st.ball.holder = dfd.d; say('INTERCEPTED', '#ff5b69', 1.3); sfx('lose'); return endPlay(T.x, 'int'); }
          say('BROKEN UP', '#fff', 0.8); sfx('bad'); return endPlay(st.los, 'inc', true);
        }
        if (recv && recv.d < rr) {
          const crowdD = dfd && dfd.dd < 1.6 ? 0.25 : 0;
          const p = clamp(0.62 + rating(recv.e.p, 'cat') / 300 - crowdD - recv.d * 0.08, 0.2, 0.97);
          if (R() < p) {
            st.stats.comp++; st.ball.holder = recv.e; st.carrier = recv.e; st.carryStart = st.los; st.fromRun = false;
            recv.e.x = T.x; recv.e.y = T.y; st.phase = 'carry'; sfx('catch');
            say('CAUGHT!', '#7cfc9a', 0.5, (recv.e.p.name || '').toUpperCase());
            if (recv.e.x >= 100) { st.stats.pass += Math.round(100 - st.los); touchdown(); }
            return;
          }
          say('DROPPED', '#fff', 0.8); sfx('bad'); return endPlay(st.los, 'inc', true);
        }
        say('INCOMPLETE', '#fff', 0.8); return endPlay(st.los, 'inc', true);
      }
      function juke(dir) {
        const cr = st.carrier; if (!cr || st.phase !== 'carry' || cr.cool > st.t || cr.dive) return;
        cr.jukeDir = dir; cr.juke = 0.28; cr.immune = 0.32; cr.cool = st.t + 0.7; say('JUKE!', '#7cfc9a', 0.4); sfx('tap');
      }
      function dive() { const cr = st.carrier; if (cr && st.phase === 'carry' && !cr.dive) { cr.dive = 0.3; say('DIVE!', '#fff', 0.5); } }

      // ---------- input ----------
      let ptr = null;
      function lpos(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * LW / r.width, y: (ev.clientY - r.top) * LH / r.height }; }
      const hit = (p) => buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      const BUTTON_PHASE = { go: 'fourth', punt: 'fourth', fg: 'fourth', xp: 'pat', two: 'pat', kickoff: 'intro', simok: 'sim' };
      function press(id) {
        if (BUTTON_PHASE[id] && BUTTON_PHASE[id] !== st.phase) return;
        sfx('tap');
        if (id === 'kickoff') { crowd(); sfx('whistle'); startDrive(25); }
        else if (id === 'go') { st.phase = 'presnap'; }
        else if (id === 'punt') { st.phase = 'dead'; say('PUNT', '#fff', 1); runClock(6); setTimeout(() => endDrive('punt', st.los), 900); }
        else if (id === 'fg') startKick('fg');
        else if (id === 'xp') startKick('xp');
        else if (id === 'two') { st.two = true; st.los = 97; st.fd = 100; st.down = 4; st.phase = 'presnap'; setup(); say('2 POINT TRY', '#ffd400', 1); }
        else if (id === 'simok' && st.sim && !st.sim.done) { st.sim.done = true; afterSim(); }
      }
      cv.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); if (paused || over) return;
        cv.setPointerCapture(ev.pointerId);
        const p = lpos(ev), b = hit(p);
        ptr = { start: p, cur: p, t: performance.now(), button: b && b.id };
        if (b) return;
        if (st.phase === 'presnap') { snap(); ptr = null; return; }
        if (st.phase === 'kick' && st.kick && !st.kick.done) st.kick.drag = { dx: 0, dy: 0 };
      });
      cv.addEventListener('pointermove', (ev) => {
        if (!ptr || paused) return;
        const p = lpos(ev); ptr.cur = p;
        const dx = ptr.start.x - p.x, dy = ptr.start.y - p.y, L2 = Math.hypot(dx, dy);
        if (st.phase === 'play' && st.ball.holder && st.ball.holder.pos === 'QB' && !st.handoff && L2 > 5) {
          const w = toWorldDir(dx, dy), wl = Math.hypot(w.x, w.y) || 1;
          const maxD = 32 + rating(P.QB, 'thr') / 7, d = clamp(L2 / 70, 0.08, 1) * maxD;
          const qb = st.ball.holder;
          st.aim = { target: { x: qb.x + (w.x / wl) * d, y: clamp(qb.y + (w.y / wl) * d, -1, FW + 1) } };
        }
        if (st.phase === 'kick' && st.kick && st.kick.drag) st.kick.drag = { dx: p.x - ptr.start.x, dy: p.y - ptr.start.y };
      });
      cv.addEventListener('pointerup', (ev) => {
        if (!ptr) return;
        const p = lpos(ev), dt = performance.now() - ptr.t, mx = p.x - ptr.start.x, my = p.y - ptr.start.y, moved = Math.hypot(mx, my);
        const b = hit(p);
        if (ptr.button) { if (b && b.id === ptr.button) press(b.id); }
        else if (st.phase === 'play' && st.aim && st.aim.target) throwBall(st.aim.target);
        else if (st.phase === 'play' && moved < 6) {
          // tap the running back to hand it off
          const rb = st.ents.find((e) => e.pos === 'RB');
          if (rb && Math.hypot(p.x - sx(rb.x), p.y - (sy(rb.y) - 8)) < 16) handoff();
        } else if (st.phase === 'carry') {
          if (moved < 8 && dt < 300) dive();
          else if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8) juke(Math.sign(my));
        } else if (st.phase === 'kick' && st.kick && !st.kick.done) kickRelease(mx, my);
        st.aim = st.phase === 'play' ? null : st.aim;
        if (st.kick) st.kick.drag = null;
        ptr = null;
      });

      // keyboard (computer controls)
      const held = {};
      function onKey(e) {
        if (stop || over || !cv.isConnected) return;
        if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
        const k = e.key;
        if (e.type === 'keyup') { held[k] = false; return; }
        const go = k === ' ' || k === 'Enter';
        const known = go || /^[hHpP123kK wWsS]$/.test(k) || k === 'Escape' || k.startsWith('Arrow');
        if (!known) return;
        e.preventDefault();
        if (e.repeat || held[k]) return;
        held[k] = true;
        const syncPause = () => { wrap.querySelector('.mb-pause').textContent = paused ? 'Resume' : 'Pause'; };
        if (k === 'p' || k === 'P' || k === 'Escape') { paused = !paused; syncPause(); return; }
        if (paused) { if (go) { paused = false; syncPause(); } return; }
        switch (st.phase) {
          case 'intro': if (go) press('kickoff'); break;
          case 'presnap': if (go) snap(); break;
          case 'play': if (/[hH]/.test(k)) handoff(); break;
          case 'fourth': if (k === '1') press('go'); else if (k === '2') press('punt'); else if (k === '3') press('fg'); break;
          case 'pat': if (k === '1' || go) press('xp'); else if (k === '2') press('two'); break;
          case 'kick': if (go && st.kick && !st.kick.done) kickRelease(0, -70 * (st.kick.yards / 60) - 6); break;
          case 'carry': if (go || k === 'ArrowRight') dive(); else if (/^(ArrowUp|w|W)$/.test(k)) juke(-1); else if (/^(ArrowDown|s|S)$/.test(k)) juke(1); break;
          case 'sim': if (go) press('simok'); break;
        }
      }
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
      wrap.querySelector('.mb-pause').onclick = (e) => { if (!over) paused = !paused; e.currentTarget.textContent = paused ? 'Resume' : 'Pause'; e.currentTarget.blur(); };
      wrap.querySelector('.mb-quit').onclick = () => {
        if (over) return;
        if (confirm('Quit this game? It counts as a loss.')) { over = true; stop = true; ctx.finish({ won: false, score: st.us, opp: st.them, stats: st.stats, detail: 'You quit the game.' }); }
      };

      // ---------- loop ----------
      let last = performance.now();
      function frame(now) {
        if (stop) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        buttons = [];
        if (!paused) {
          if (st.msg) { st.msg.t += dt; if (st.msg.t > st.msg.dur) st.msg = null; }
          if (st.crowdT > 0) st.crowdT -= dt;
          if (['play', 'flight', 'carry'].includes(st.phase)) step(dt); else st.t += dt;
          if (st.sim) { st.sim.t += dt; if (st.sim.t > 3.4 && !st.sim.done) { st.sim.done = true; afterSim(); } }
          camera(dt);
        }
        render(paused ? 0 : dt);
        if (paused) { rect(0, 0, LW, LH, 'rgba(0,0,0,.6)'); text('PAUSED', LW / 2, LH / 2 - 12, '#ffd400', 3, 'center'); text(fine ? 'PRESS P TO RESUME' : 'TAP RESUME', LW / 2, LH / 2 + 14, '#fff', 1, 'center'); }
        requestAnimationFrame(frame);
      }
      function render(dt) {
        if (st.phase === 'kick') { drawKick(dt); particles(dt); banner(); return; }
        drawField();
        if (st.phase === 'presnap' || st.phase === 'fourth') drawPresnap();
        const all = [...st.ents.map((e) => [e, home, false]), ...st.def.map((d) => [d, away, true])].sort((a, b) => a[0].y - b[0].y);
        for (const [e, team, d] of all) { drawGuy(e, team, d); if (!d && e.p && e.p.stars >= 4 && e.pos !== 'OL') star(sx(e.x), sy(e.y) - 27); }
        if (st.phase === 'carry' && st.carrier) { const x = sx(st.carrier.x), y = sy(st.carrier.y) - 30; rect(x - 2, y, 5, 1, '#ffd400'); rect(x - 1, y + 1, 3, 1, '#ffd400'); rect(x, y + 2, 1, 1, '#ffd400'); }
        drawBall();
        if (st.phase === 'play') drawAim();
        hud();
        const hint = (s) => text(s, LW / 2, LH - 16, '#fff', 1, 'center');
        if (st.phase === 'presnap') hint(fine ? 'CLICK OR PRESS SPACE TO SNAP' : 'TAP TO SNAP');
        if (st.phase === 'play' && st.playT < 2.4 && !st.aim && !st.handoff) hint(fine ? 'DRAG BACK TO THROW · CLICK RB TO HAND OFF' : 'PULL BACK TO THROW · TAP RB TO HAND OFF');
        if (st.phase === 'carry' && st.playT < 6 && (st.t % 3) < 2) hint(fine ? 'UP/DOWN TO JUKE · SPACE TO DIVE' : 'SWIPE UP/DOWN TO JUKE · TAP TO DIVE');
        if (st.phase === 'fourth') {
          box(LW / 2 - 70, LH / 2 - 26, 140, 14, '#0d1018', '#ffd400'); text('4TH DOWN', LW / 2, LH / 2 - 22, '#ffd400', 1, 'center', null);
          const fgYds = Math.round(100 - st.los + 17), bw = 60, kn = (n) => (fine ? `${n} ` : '');
          button('go', kn(1) + 'GO', LW / 2 - bw * 1.5 - 6, LH / 2 - 6, bw);
          button('punt', kn(2) + 'PUNT', LW / 2 - bw / 2, LH / 2 - 6, bw);
          if (fgYds <= 58) button('fg', `${kn(3)}FG ${fgYds}`, LW / 2 + bw / 2 + 6, LH / 2 - 6, bw);
        }
        if (st.phase === 'pat') {
          box(LW / 2 - 70, LH / 2 - 26, 140, 14, '#0d1018', '#ffd400'); text('TRY FOR POINT', LW / 2, LH / 2 - 22, '#ffd400', 1, 'center', null);
          button('xp', (fine ? '1 ' : '') + 'KICK XP', LW / 2 - 76, LH / 2 - 6, 72); button('two', (fine ? '2 ' : '') + 'GO FOR 2', LW / 2 + 4, LH / 2 - 6, 72);
        }
        if (st.sim) {
          rect(0, 0, LW, LH, 'rgba(4,6,12,.86)');
          const k = st.sim.t, y0 = Math.round(LH * 0.28);
          st.sim.lines.forEach((ln, i) => { if (k > i * 0.7) text(ln, LW / 2, y0 + i * 16, i === 2 ? (['turnover', 'punt', 'clock'].includes(st.sim.res) ? '#7cfc9a' : '#ff5b69') : '#fff', i === 2 ? 2 : 1, 'center'); });
          text(`${home.abbr} ${st.us} - ${st.them} ${away.abbr}`, LW / 2, y0 + 58, '#ffd400', 1, 'center');
          text(st.ot ? 'OVERTIME' : `Q${st.q}  ${fmtClock(st.clock)}`, LW / 2, y0 + 70, '#9fd3ff', 1, 'center');
          if (k > 1.6) button('simok', fine ? 'SPACE TO CONTINUE' : 'CONTINUE', LW / 2 - 60, LH - 30, 120);
        }
        if (st.phase === 'intro') {
          rect(0, 0, LW, LH, 'rgba(4,6,12,.72)');
          text('MODERN BOWL', LW / 2, 26, '#ffd400', 3, 'center');
          text(`${home.name} VS ${away.name}`.slice(0, 44), LW / 2, 56, '#fff', 1, 'center');
          const tips = fine
            ? ['CLICK OR SPACE TO SNAP', 'CLICK + DRAG BACK, RELEASE TO THROW', 'CLICK THE RB (OR H) TO HAND OFF', 'UP/DOWN OR W/S TO JUKE, SPACE TO DIVE', 'THEIR DRIVES ARE SIMULATED']
            : ['TAP TO SNAP', 'PULL BACK AND RELEASE TO THROW', 'TAP THE RB TO HAND OFF', 'SWIPE UP/DOWN TO JUKE, TAP TO DIVE', 'THEIR DRIVES ARE SIMULATED'];
          tips.forEach((t, i) => text(t, LW / 2, 76 + i * 11, '#c9d1e0', 1, 'center', null));
          button('kickoff', fine ? 'KICK OFF (SPACE)' : 'KICK OFF', LW / 2 - 60, LH - 34, 120, 16, true);
        }
        particles(dt); banner();
      }

      if (window.__arcTest) { wrap.__st = st; wrap.__toScreen = (x, y, z) => { const r = cv.getBoundingClientRect(); return [sx(x) * r.width / LW, sy(y, z) * r.height / LH]; }; } // test pages only
      setup();
      requestAnimationFrame(frame);
    },
  });
})();
