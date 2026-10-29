// Card Memory: flip MFL player cards and find the pairs before time (or misses) run out.
(function () {
  const P = 'mm';
  const CSS = `
.mm-wrap{position:relative;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;max-width:100%}
.mm-hud{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;background:#0f1117;border:1px solid #1d212c;border-bottom:0;border-radius:12px 12px 0 0}
.mm-stat{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.mm-stat span{font-family:'Press Start 2P',monospace;font-size:7px;color:#6f7584}
.mm-stat b{font-family:'Press Start 2P',monospace;font-size:11px;color:#ffc21a;white-space:nowrap}
.mm-stat.low b{color:#ff3344;animation:mm-blink .5s steps(2) infinite}
.mm-stat.bump b{animation:mm-bump .35s ease-out}
.mm-quit{font-family:'Press Start 2P',monospace;font-size:8px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;padding:8px 9px;cursor:pointer}
.mm-quit.sure{background:#ff3344;border-color:#ff3344}
.mm-bar{height:3px;background:#1d212c;border-left:1px solid #1d212c;border-right:1px solid #1d212c}
.mm-bar i{display:block;height:100%;width:100%;background:#ffc21a;transform-origin:left;transition:background .3s}
.mm-stage{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#162a1b 0%,#0b120d 60%,#07080b 100%);border:1px solid #1d212c;border-top:0;border-radius:0 0 12px 12px;padding:10px;touch-action:manipulation}
.mm-stage.shake{animation:mm-shake .35s linear}
.mm-stage.shake2{animation:mm-shake2 .45s linear}
.mm-grid{display:grid;justify-content:center;margin:0 auto}
.mm-card{position:relative;padding:0;border:0;background:none;cursor:pointer;perspective:700px;font:inherit;color:inherit;outline:none}
.mm-card:focus-visible .mm-back{box-shadow:0 0 0 3px #ffc21a}
.mm-in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .42s cubic-bezier(.3,1.35,.5,1)}
.mm-card.up .mm-in,.mm-card.got .mm-in{transform:rotateY(180deg)}
.mm-card:not(.up):not(.got):hover .mm-in{transform:rotateY(8deg) translateY(-2px)}
.mm-back,.mm-face{position:absolute;inset:0;border-radius:calc(var(--w) * .09);backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.mm-back{background:#141a2e;border:2px solid #2a3350;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 #05060a}
.mm-back::before{content:"";position:absolute;inset:4px;border-radius:calc(var(--w) * .06);border:1px dashed rgba(255,194,26,.35);background:repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 6px,transparent 6px 12px)}
.mm-ball{position:relative;width:46%;aspect-ratio:1.6;background:#9a5424;border-radius:50%;box-shadow:inset -3px -3px 0 #6b3412,0 0 0 2px #3a1d0a}
.mm-ball::after{content:"";position:absolute;left:28%;right:28%;top:46%;height:2px;background:#fff;box-shadow:0 -3px 0 -0px transparent}
.mm-back b{position:absolute;bottom:9%;left:0;right:0;text-align:center;font-family:'Press Start 2P',monospace;font-size:calc(var(--w) * .1);color:#ffc21a;letter-spacing:1px}
.mm-face{transform:rotateY(180deg);background:linear-gradient(160deg,var(--c1) 0%,var(--c1) 45%,var(--c2) 100%);border:3px solid var(--c1);box-shadow:0 3px 0 #05060a;display:flex;flex-direction:column}
.mm-num{position:absolute;top:5%;left:7%;font-family:'Press Start 2P',monospace;font-size:calc(var(--w) * .11);color:var(--tx);text-shadow:1px 1px 0 rgba(0,0,0,.35);z-index:2}
.mm-pic{flex:1;margin:18% 9% 0;border-radius:calc(var(--w) * .06);background:rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;border:2px solid rgba(255,255,255,.55)}
.mm-pic img{width:100%;height:100%;object-fit:cover;display:block}
.mm-pic span{font-family:'Barlow Condensed',Inter,sans-serif;font-weight:900;font-size:calc(var(--w) * .38);color:var(--tx);line-height:1;letter-spacing:.5px;text-shadow:2px 2px 0 rgba(0,0,0,.3)}
.mm-name{padding:5% 4% 2%;text-align:center;font-family:'Barlow Condensed',Inter,sans-serif;font-weight:800;font-size:calc(var(--w) * .15);line-height:1;text-transform:uppercase;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-team{padding:0 4% 7%;text-align:center;font-family:Inter,sans-serif;font-weight:600;font-size:calc(var(--w) * .085);line-height:1.1;color:var(--tx);opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mm-card.got .mm-face{box-shadow:0 0 0 2px #ffc21a,0 0 16px rgba(255,194,26,.55)}
.mm-card.got{animation:mm-got .5s cubic-bezier(.2,1.8,.4,1)}
.mm-ok{position:absolute;right:-5px;top:-5px;width:calc(var(--w) * .24);height:calc(var(--w) * .24);min-width:18px;min-height:18px;background:#7CFF6B;border-radius:50%;box-shadow:0 0 0 2px #07080b;z-index:3;display:none;align-items:center;justify-content:center}
.mm-ok svg{width:62%;height:62%}
.mm-card.got .mm-ok{display:flex;animation:mm-got .4s .1s both}
.mm-peek{position:absolute;left:0;right:0;top:0;height:var(--hh,46px);display:flex;align-items:center;justify-content:center;gap:12px;background:#ffc21a;color:#07080b;font-family:'Press Start 2P',monospace;font-size:12px;border-radius:12px 12px 0 0;z-index:4;animation:mm-zoom2 .3s ease-out both}
.mm-peek b{font-size:16px}
@keyframes mm-zoom2{from{opacity:0;transform:scaleY(.4)}to{opacity:1;transform:none}}
.mm-card.no .mm-in{animation:mm-no .4s linear}
.mm-card.dim{opacity:.55;transition:opacity .4s}
.mm-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5}
.mm-p{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;animation:mm-p .7s ease-out forwards}
.mm-pop{position:absolute;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:12px;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:mm-rise 1s ease-out both}
.mm-banner{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:mm-zoom .7s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000;background:rgba(7,8,11,.78);padding:16px 18px;border-radius:12px;border:2px solid #2a2f3c}
.mm-banner b{display:block;font-size:18px;line-height:1.3}
.mm-banner i{display:block;font-style:normal;font-size:9px;margin-top:8px;color:#f5f6f8}
.mm-splash{position:absolute;inset:0;background:rgba(7,8,11,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px;gap:14px;z-index:6}
.mm-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:17px;line-height:1.45;text-shadow:3px 3px 0 #6b4f00}
.mm-how{font-size:14px;line-height:1.5;color:#c9ccd4;max-width:300px;margin:0}
.mm-how b{color:#f5f6f8}
.mm-goal{font-family:'Press Start 2P',monospace;font-size:9px;line-height:1.8;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c}
.mm-goal em{font-style:normal;color:#ffc21a}
.mm-start{font-family:'Press Start 2P',monospace;font-size:13px;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:mm-pulse 1.1s ease-in-out infinite}
.mm-start:active{transform:translateY(3px);box-shadow:0 1px 0 #a37a00}
@keyframes mm-got{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes mm-no{0%,100%{transform:rotateY(180deg) translateX(0)}20%{transform:rotateY(180deg) translateX(-6px)}40%{transform:rotateY(180deg) translateX(6px)}60%{transform:rotateY(180deg) translateX(-4px)}80%{transform:rotateY(180deg) translateX(4px)}}
@keyframes mm-p{to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}
@keyframes mm-rise{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-200%) scale(1)}}
@keyframes mm-zoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes mm-pulse{50%{transform:scale(1.06)}}
@keyframes mm-blink{50%{opacity:.35}}
@keyframes mm-bump{40%{transform:scale(1.5)}}
@keyframes mm-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,-1px)}}
@keyframes mm-shake2{0%,100%{transform:translate(0,0)}15%{transform:translate(-6px,3px)}30%{transform:translate(5px,-4px)}45%{transform:translate(-4px,-2px)}60%{transform:translate(4px,3px)}80%{transform:translate(-2px,1px)}}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css')) return;
    const s = document.createElement('style'); s.id = P + '-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeColor = (c, d) => (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : d);
  function textOn(hex) {
    let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#0b0d12' : '#ffffff';
  }
  function initials(name) {
    const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return ((w[0][0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  }
  function shortName(name) {
    const w = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (w.length < 2) return w[0] || 'Player';
    return w[0][0] + '. ' + w.slice(1).join(' ');
  }

  // cols x rows on a wide screen (transposed on a narrow phone), time limit, allowed misses, peek seconds
  const LEVELS = [
    { a: 4, b: 3, time: 120, misses: Infinity, peek: 3 },
    { a: 4, b: 4, time: 100, misses: 12, peek: 2.5 },
    { a: 5, b: 4, time: 90, misses: 10, peek: 2 },
    { a: 6, b: 4, time: 75, misses: 8, peek: 1.5 },
  ];
  const FIRST = ['Jayden', 'Mia', 'Liam', 'Ava', 'Noah', 'Zoe', 'Mason', 'Ella', 'Lucas', 'Aria', 'Ethan', 'Nora', 'Caleb', 'Ruby', 'Owen', 'Maya', 'Elijah', 'Lily', 'Carter', 'Sofia'];
  const LAST = ['Reyes', 'Brooks', 'Carter', 'Nguyen', 'Patel', 'Hayes', 'Foster', 'Kim', 'Rivera', 'Bennett', 'Diaz', 'Coleman', 'Price', 'Ward', 'Ortiz', 'Hughes'];
  const TEAMS = [['Hawks', '#1f6feb', '#0b2e6b'], ['Bolts', '#ffc21a', '#a35a00'], ['Rockets', '#ff3344', '#5a0b14'], ['Gators', '#22a35a', '#0b3d22'], ['Storm', '#7b4dff', '#2a1170'], ['Titans', '#f5f6f8', '#6f7584']];

  MFLArcade.register('memory', {
    start(ctx) {
      injectCSS();
      const L = LEVELS[Math.max(0, Math.min(3, ctx.level | 0))];
      const rng = ctx.rng;
      let cs = 777;
      const crand = () => { cs = (cs * 1103515245 + 12345) & 0x7fffffff; return cs / 0x7fffffff; }; // cosmetic only
      const pairs = (L.a * L.b) / 2;
      const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

      // ---- pick players ----
      const src = Array.isArray(ctx.data && ctx.data.players) ? ctx.data.players.filter((p) => p && p.name) : [];
      const seen = new Set();
      let pool = shuffle(src.slice()).filter((p) => { const k = String(p.name).toLowerCase() + '|' + (p.team || ''); if (seen.has(k)) return false; seen.add(k); return true; });
      pool = pool.slice(0, pairs);
      let fi = 0;
      while (pool.length < pairs) {
        const t = TEAMS[Math.floor(rng() * TEAMS.length)];
        const nm = FIRST[Math.floor(rng() * FIRST.length)] + ' ' + LAST[Math.floor(rng() * LAST.length)];
        if (pool.some((p) => p.name === nm)) { fi++; if (fi > 200) break; continue; }
        pool.push({ name: nm, team: t[0], color: t[1], color2: t[2], photo: null, number: 1 + Math.floor(rng() * 89) });
      }
      const people = pool.map((p, i) => {
        const c1 = safeColor(p.color, '#2a62ff');
        return { id: i, name: String(p.name), team: String(p.team || ''), c1, c2: safeColor(p.color2, '#0f1117'), tx: textOn(c1), photo: typeof p.photo === 'string' && p.photo ? p.photo : null, number: p.number != null && p.number !== '' ? String(p.number).slice(0, 3) : '' };
      });
      const deck = shuffle(people.flatMap((p) => [p, p]));

      // ---- DOM ----
      const root = ctx.root;
      root.innerHTML = '';
      const wrap = el('div', 'mm-wrap');
      const hud = el('div', 'mm-hud');
      const sTime = el('div', 'mm-stat', `<span>TIME</span><b>${L.time}</b>`);
      const sPairs = el('div', 'mm-stat', `<span>PAIRS</span><b>0/${pairs}</b>`);
      const sMiss = el('div', 'mm-stat', `<span>${L.misses === Infinity ? 'MISSES' : 'MISSES LEFT'}</span><b>${L.misses === Infinity ? '0' : L.misses}</b>`);
      const quit = el('button', 'mm-quit', 'QUIT'); quit.type = 'button';
      hud.append(sTime, sPairs, sMiss, quit);
      const bar = el('div', 'mm-bar', '<i></i>');
      const stage = el('div', 'mm-stage');
      const grid = el('div', 'mm-grid');
      const fx = el('div', 'mm-fx');
      stage.append(grid, fx);
      wrap.append(hud, bar, stage);
      root.appendChild(wrap);

      const cards = deck.map((p, idx) => {
        const b = el('button', 'mm-card');
        b.type = 'button';
        b.setAttribute('aria-label', 'Card ' + (idx + 1));
        b.style.setProperty('--c1', p.c1); b.style.setProperty('--c2', p.c2); b.style.setProperty('--tx', p.tx);
        const ini = esc(initials(p.name));
        b.innerHTML = `<div class="mm-in"><div class="mm-back"><div class="mm-ball"></div><b>MFL</b></div><div class="mm-face">${p.number ? `<div class="mm-num">#${esc(p.number)}</div>` : ''}<div class="mm-pic">${p.photo ? `<img alt="" draggable="false" src="${esc(p.photo)}">` : `<span>${ini}</span>`}</div><div class="mm-name">${esc(shortName(p.name))}</div><div class="mm-team">${esc(p.team)}</div></div></div><i class="mm-ok"><svg viewBox="0 0 10 10"><path d="M2 5.2l2.2 2.2L8.2 2.8" stroke="#07080b" stroke-width="2" fill="none" stroke-linecap="square"/></svg></i>`;
        const img = b.querySelector('img');
        if (img) img.addEventListener('error', () => { img.parentNode.innerHTML = `<span>${ini}</span>`; });
        grid.appendChild(b);
        const c = { el: b, p, up: false, got: false, idx };
        b.addEventListener('click', () => flip(c));
        return c;
      });

      function layout() {
        const W = Math.min(root.clientWidth || 360, 1000);
        const narrow = W < 600;
        const cols = narrow ? Math.min(L.a, L.b) : Math.max(L.a, L.b), rows = (L.a * L.b) / cols;
        const gap = W < 400 ? 6 : 10;
        const availW = W - 22 - gap * (cols - 1);
        const availH = Math.max(320, (window.innerHeight || 800) - 175) - 22 - gap * (rows - 1);
        let cw = Math.min(availW / cols, availH / rows / 1.34, 140);
        cw = Math.max(52, Math.floor(cw));
        const ch = Math.round(cw * 1.34);
        grid.style.gridTemplateColumns = `repeat(${cols}, ${cw}px)`;
        grid.style.gridAutoRows = ch + 'px';
        grid.style.gap = gap + 'px';
        grid.style.setProperty('--w', cw + 'px');
        cards.forEach((c) => { c.el.style.width = cw + 'px'; c.el.style.height = ch + 'px'; });
        wrap.style.width = Math.min(W, cols * cw + gap * (cols - 1) + 24) + 'px';
      }
      layout();
      const onResize = () => layout();
      window.addEventListener('resize', onResize);

      // ---- state ----
      let state = 'splash', open = [], matched = 0, misses = 0, combo = 0, bestCombo = 0, lock = false, t0 = 0, elapsed = 0, timer = 0, finished = false, flips = 0;
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!finished) fn(); }, ms); timers.add(id); return id; };

      function bump(s) { s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
      function updHud() {
        const left = Math.max(0, L.time - elapsed);
        sTime.querySelector('b').textContent = Math.ceil(left);
        sTime.classList.toggle('low', state === 'play' && left <= 10);
        sPairs.querySelector('b').textContent = `${matched}/${pairs}`;
        if (L.misses === Infinity) sMiss.querySelector('b').textContent = misses;
        else { const ml = L.misses - misses; sMiss.querySelector('b').textContent = Math.max(0, ml); sMiss.classList.toggle('low', ml <= 2); }
        const f = state === 'splash' || state === 'peek' ? 1 : left / L.time;
        const i = bar.querySelector('i'); i.style.transform = `scaleX(${f})`; i.style.background = f < 0.2 ? '#ff3344' : f < 0.45 ? '#ff8a00' : '#ffc21a';
      }
      function centerOf(c) { const r = c.el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2]; }
      function particles(x, y, n, colors) {
        for (let i = 0; i < n; i++) {
          const d = el('div', 'mm-p'); const a = crand() * 6.283;
          const v = 30 + crand() * 70;
          d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.background = colors[i % colors.length];
          d.style.setProperty('--dx', Math.cos(a) * v + 'px'); d.style.setProperty('--dy', Math.sin(a) * v + 'px'); d.style.setProperty('--r', (crand() * 360 | 0) + 'deg');
          if (i % 3 === 0) { d.style.width = d.style.height = '4px'; }
          fx.appendChild(d); setTimeout(() => d.remove(), 750);
        }
      }
      function pop(x, y, txt, col, size) { const e = el('div', 'mm-pop', txt); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.color = col; if (size) e.style.fontSize = size + 'px'; fx.appendChild(e); setTimeout(() => e.remove(), 1050); }
      function banner(txt, sub, col) { fx.querySelectorAll('.mm-banner').forEach((b) => b.remove()); const b = el('div', 'mm-banner', `<b style="color:${col}">${txt}</b>${sub ? `<i>${sub}</i>` : ''}`); fx.appendChild(b); return b; }
      function shake(big) { stage.classList.remove('shake', 'shake2'); void stage.offsetWidth; stage.classList.add(big ? 'shake2' : 'shake'); }

      function flip(c) {
        if (state !== 'play' || lock || c.up || c.got) return;
        c.up = true; c.el.classList.add('up'); flips++;
        ctx.sound('tap');
        open.push(c);
        if (open.length < 2) return;
        const [a, b] = open; open = [];
        if (a.p.id === b.p.id) {
          matched++; combo++; bestCombo = Math.max(bestCombo, combo);
          lock = true;
          later(() => {
            lock = false;
            a.got = b.got = true; a.el.classList.add('got'); b.el.classList.add('got');
            ctx.sound('good');
            const [x1, y1] = centerOf(a), [x2, y2] = centerOf(b);
            particles(x1, y1, 14, ['#ffc21a', '#ffffff', a.p.c1]); particles(x2, y2, 14, ['#ffc21a', '#ffffff', a.p.c1]);
            pop((x1 + x2) / 2, (y1 + y2) / 2, combo >= 2 ? `COMBO x${combo}!` : 'MATCH!', combo >= 2 ? '#7CFF6B' : '#ffc21a', combo >= 3 ? 14 : 12);
            shake(combo >= 3);
            bump(sPairs);
            updHud();
            if (matched === pairs) win();
          }, 300);
        } else {
          misses++; combo = 0;
          lock = true;
          later(() => { a.el.classList.add('no'); b.el.classList.add('no'); ctx.sound('bad'); bump(sMiss); updHud(); }, 420);
          later(() => {
            a.el.classList.remove('no', 'up'); b.el.classList.remove('no', 'up'); a.up = b.up = false; lock = false;
            if (misses > L.misses) lose('TOO MANY MISSES');
          }, 900);
        }
      }

      function tick() {
        if (state !== 'play') return;
        elapsed = (performance.now() - t0) / 1000;
        updHud();
        if (elapsed >= L.time) { elapsed = L.time; lose("TIME'S UP"); }
      }
      function stopTimer() { clearInterval(timer); timer = 0; }

      function win() {
        state = 'over'; stopTimer(); updHud();
        later(() => {
          ctx.sound('whistle');
          banner('ALL MATCHED!', `${Math.round(elapsed)}s, ${misses} MISSES`, '#ffc21a');
          const s = stage.getBoundingClientRect();
          for (let i = 0; i < 5; i++) later(() => particles(s.width * (0.15 + crand() * 0.7), s.height * (0.2 + crand() * 0.5), 22, ['#ffc21a', '#fff', '#7CFF6B', '#4cc9ff', '#ff3344']), i * 140);
          shake(true);
        }, 450);
        later(() => finish(true), 1900);
      }
      function lose(why) {
        if (state === 'over') return;
        state = 'over'; stopTimer(); updHud(); lock = true;
        shake(true);
        banner(why, `${matched}/${pairs} PAIRS`, '#ff3344');
        // reveal the rest
        later(() => cards.forEach((c, i) => { if (!c.got) setTimeout(() => { c.el.classList.add('up', 'dim'); }, i * 25); }), 500);
        later(() => finish(false), 1900);
      }
      function finish(won, quitted) {
        if (finished) return; finished = true; stopTimer();
        timers.forEach((id) => clearTimeout(id)); timers.clear();
        window.removeEventListener('resize', onResize);
        lock = true;
        const secs = Math.round(elapsed);
        ctx.finish({
          won: !!won && !quitted,
          score: matched,
          detail: quitted ? `Quit with ${matched}/${pairs} pairs.` : won ? `Matched all ${pairs} pairs in ${secs}s with ${misses} ${misses === 1 ? 'miss' : 'misses'}.` : `Matched ${matched}/${pairs} pairs (${misses} misses, ${secs}s).`,
          stats: { pairs: matched, total: pairs, misses, seconds: secs, bestCombo, flips },
        });
      }
      let quitArm = 0;
      quit.addEventListener('click', () => {
        if (finished) return;
        if (!quitArm) { quitArm = 1; quit.textContent = 'SURE?'; quit.classList.add('sure'); setTimeout(() => { quitArm = 0; quit.textContent = 'QUIT'; quit.classList.remove('sure'); }, 2200); return; }
        finish(false, true);
      });

      // ---- start: splash -> peek -> play ----
      const lvName = ctx.levelName || ['Rookie', 'Pro', 'All-Pro', 'Legend'][ctx.level | 0];
      const splash = el('div', 'mm-splash', `
        <div class="mm-title">CARD<br>MEMORY</div>
        <p class="mm-how">Tap two cards to flip them. Find the <b>matching players</b>! You get a quick <b>peek</b> at every card first, so remember where they are.</p>
        <div class="mm-goal">${esc(lvName)}: MATCH <em>${pairs} PAIRS</em><br>IN ${L.time}s${L.misses === Infinity ? '' : `, MAX <em>${L.misses}</em> MISSES`}</div>
        <button type="button" class="mm-start">START</button>`);
      stage.appendChild(splash);
      stage.style.minHeight = '420px';
      updHud();
      splash.querySelector('.mm-start').addEventListener('click', () => {
        splash.remove(); stage.style.minHeight = '';
        ctx.sound('whistle');
        state = 'peek';
        cards.forEach((c, i) => later(() => c.el.classList.add('up'), i * 30));
        const steps = Math.ceil(L.peek);
        const b = el('div', 'mm-peek', 'MEMORIZE! <b></b>');
        b.style.setProperty('--hh', hud.offsetHeight + 'px');
        wrap.appendChild(b);
        const startPeek = cards.length * 30 + 400;
        for (let s = 0; s < steps; s++) later(() => { b.querySelector('b').textContent = String(steps - s); }, startPeek + s * 1000 * (L.peek / steps));
        later(() => {
          b.remove();
          cards.forEach((c, i) => later(() => c.el.classList.remove('up'), i * 20));
          later(() => {
            state = 'play'; t0 = performance.now(); elapsed = 0;
            timer = setInterval(tick, 100);
            updHud();
            ctx.sound('tap');
          }, cards.length * 20 + 350);
        }, startPeek + L.peek * 1000);
      });

      if (window.__arcTest) window.__arcTest.memory = { get state() { return state; }, get lock() { return lock; }, ids: () => cards.map((c) => c.p.id), get matched() { return matched; } };
    },
  });
})();
