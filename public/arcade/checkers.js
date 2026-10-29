// MFL Arcade: Checkers (American rules) vs the bot. Rules + AI live in engines.js (MFLEngines.checkers).
// Controls: tap one of your gold pieces, then tap a highlighted square. Jumps are mandatory (pieces that must
// jump pulse); for a multi-jump keep tapping each landing square. Resign = loss.
(function () {
  const CSS = `
.ck-wrap{--bw:360px;--sq:45px;width:var(--bw);max-width:100%;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#f5f6f8;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.ck-bar{display:flex;align-items:center;gap:10px;padding:8px 2px;min-height:44px}
.ck-av{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font:800 13px 'Barlow Condensed',Inter,sans-serif;letter-spacing:.04em;flex:none}
.ck-bar.ai .ck-av{background:#1d212c;color:#ff3344;border:1px solid #2a2f3c}
.ck-bar.me .ck-av{background:#ffc21a;color:#07080b}
.ck-bar.turn .ck-av{box-shadow:0 0 0 2px #07080b,0 0 0 4px #ffc21a}
.ck-bar.ai.turn .ck-av{box-shadow:0 0 0 2px #07080b,0 0 0 4px #ff3344}
.ck-who{display:flex;flex-direction:column;line-height:1.1;min-width:0}
.ck-who b{font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em}
.ck-who small{color:#6f7584;font-size:12px}
.ck-count{margin-left:auto;display:flex;align-items:center;gap:6px;font:800 18px 'Barlow Condensed',Inter,sans-serif}
.ck-count i{width:16px;height:16px;border-radius:50%;display:inline-block}
.ck-bar.me .ck-count i{background:radial-gradient(circle at 35% 30%,#ffe48a,#ffc21a 55%,#c98f00)}
.ck-bar.ai .ck-count i{background:radial-gradient(circle at 35% 30%,#ff8a94,#ff3344 55%,#b3121f)}
.ck-count small{font:600 12px Inter,sans-serif;color:#6f7584}
.ck-think{display:none;gap:3px;margin-left:4px}
.ck-bar.thinking .ck-think{display:inline-flex}
.ck-think span{width:5px;height:5px;border-radius:50%;background:#ff3344;animation:ck-dot 1s infinite ease-in-out}
.ck-think span:nth-child(2){animation-delay:.15s}.ck-think span:nth-child(3){animation-delay:.3s}
@keyframes ck-dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.ck-bw{position:relative;width:var(--bw);height:var(--bw);border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 0 1px #2a2f3c;touch-action:manipulation}
.ck-board{display:grid;grid-template-columns:repeat(8,var(--sq));grid-template-rows:repeat(8,var(--sq))}
.ck-sq{position:relative;display:grid;place-items:center}
.ck-sq.l{background:#c9d1de}
.ck-sq.d{background:#2f3a52;cursor:pointer}
.ck-sq.last{background:#47506a}
.ck-sq.last.from{background:#3c465e}
.ck-sq.tgt::before{content:'';position:absolute;width:32%;height:32%;border-radius:50%;background:#ffc21a;opacity:.85;box-shadow:0 0 12px rgba(255,194,26,.7);z-index:3;animation:ck-pulse 1.1s infinite ease-in-out}
.ck-sq.tgt.jump::before{width:42%;height:42%;background:transparent;border:3px solid #ffc21a;box-sizing:border-box}
@keyframes ck-pulse{0%,100%{transform:scale(.85)}50%{transform:scale(1.05)}}
.ck-co{position:absolute;left:3px;top:2px;font:700 calc(var(--sq)*.19) Inter,sans-serif;color:#6f7d98;pointer-events:none}
.ck-co.f{left:auto;top:auto;right:3px;bottom:1px}
.ck-pc{position:relative;width:78%;height:78%;border-radius:50%;z-index:4;pointer-events:none;transition:transform .12s,opacity .25s}
.ck-pc::after{content:'';position:absolute;inset:17%;border-radius:50%;border:2px solid rgba(0,0,0,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.ck-pc.me{background:radial-gradient(circle at 35% 30%,#ffe9a0 0,#ffc21a 50%,#d39a00 100%);box-shadow:0 calc(var(--sq)*.06) 0 #8a6100,0 calc(var(--sq)*.12) calc(var(--sq)*.18) rgba(0,0,0,.55)}
.ck-pc.ai{background:radial-gradient(circle at 35% 30%,#ff9aa2 0,#ff3344 50%,#b3121f 100%);box-shadow:0 calc(var(--sq)*.06) 0 #6e0a13,0 calc(var(--sq)*.12) calc(var(--sq)*.18) rgba(0,0,0,.55)}
.ck-pc svg{position:absolute;inset:22%;width:56%;height:56%;z-index:1;filter:drop-shadow(0 1px 0 rgba(0,0,0,.25))}
.ck-pc.me svg{color:#7a5200}.ck-pc.ai svg{color:#fff3f4}
.ck-pc.sel{transform:translateY(-6%) scale(1.1);box-shadow:0 0 0 3px #f5f6f8,0 calc(var(--sq)*.14) calc(var(--sq)*.24) rgba(0,0,0,.6)}
.ck-pc.must{animation:ck-must 1s infinite ease-in-out}
@keyframes ck-must{0%,100%{box-shadow:0 0 0 2px rgba(255,255,255,.95),0 0 12px 2px rgba(255,194,26,.7)}50%{box-shadow:0 0 0 4px rgba(255,255,255,.6),0 0 22px 6px rgba(255,194,26,.35)}}
.ck-pc.ghost{opacity:.3;transform:scale(.85)}
.ck-pc.gone{opacity:0;transform:scale(.4)}
.ck-pc.crowned{animation:ck-crown .5s ease-out}
@keyframes ck-crown{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}
.ck-float{position:absolute;left:0;top:0;width:var(--sq);height:var(--sq);display:grid;place-items:center;z-index:10;pointer-events:none}
.ck-status{margin:12px 0 4px;text-align:center;font:800 22px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em;min-height:28px}
.ck-status.must{color:#ffc21a}
.ck-status.bad{color:#ff3344}
.ck-status.win{color:#ffc21a}
.ck-sub{text-align:center;color:#6f7584;font-size:13px;min-height:20px}
.ck-act{display:flex;justify-content:center;gap:10px;margin-top:10px}
.ck-btn{font:800 14px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:10px 20px;border-radius:999px;border:1px solid #2a2f3c;background:#161922;color:#f5f6f8;cursor:pointer;min-height:42px}
.ck-btn:hover{border-color:#6f7584}
.ck-btn.confirm{background:#ff3344;border-color:#ff3344;color:#fff}
.ck-btn:disabled{opacity:.4;cursor:default}
`;
  const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 8.5l4.6 3.6L12 5l4.4 7.1L21 8.5 19.3 17H4.7L3 8.5zM5 18.5h14V20H5z"/></svg>';
  const FILES = 'abcdefgh';

  function start(ctx) {
    const E = window.MFLEngines, K = E.checkers;
    if (!document.getElementById('ck-css')) { const st = document.createElement('style'); st.id = 'ck-css'; st.textContent = CSS; document.head.appendChild(st); }
    const root = ctx.root;
    root.innerHTML = `
<div class="ck-wrap">
  <div class="ck-bar ai"><div class="ck-av">BOT</div><div class="ck-who"><b>MFL Bot <span class="ck-think"><span></span><span></span><span></span></span></b><small>${ctx.levelName || E.LEVELS[ctx.level]} · Red</small></div><div class="ck-count" data-c="ai"></div></div>
  <div class="ck-bw"><div class="ck-board"></div></div>
  <div class="ck-bar me"><div class="ck-av">YOU</div><div class="ck-who"><b>You</b><small>Gold · moves first</small></div><div class="ck-count" data-c="me"></div></div>
  <div class="ck-status">Your move</div>
  <div class="ck-sub">Tap a gold piece, then a glowing square. Jumps are a must!</div>
  <div class="ck-act"><button class="ck-btn" data-a="resign">Resign</button></div>
</div>`;
    const wrap = root.querySelector('.ck-wrap'), bw = root.querySelector('.ck-bw'), boardEl = root.querySelector('.ck-board');
    const statusEl = root.querySelector('.ck-status'), subEl = root.querySelector('.ck-sub'), resignBtn = root.querySelector('[data-a=resign]');
    const barAI = root.querySelector('.ck-bar.ai'), barMe = root.querySelector('.ck-bar.me');

    let state = K.create();
    const moves = [];
    let sel = [], last = null, busy = false, over = false, finished = false;
    const timers = new Set();
    const later = (fn, ms, force) => { const t = setTimeout(() => { timers.delete(t); if (!over || force) fn(); }, ms); timers.add(t); return t; };

    const sqEls = new Array(64);
    for (let row = 7; row >= 0; row--) for (let f = 0; f < 8; f++) {
      const i = row * 8 + f, d = document.createElement('div');
      d.dataset.i = i;
      sqEls[i] = d;
      boardEl.appendChild(d);
    }
    let sqPx = 45;
    function size() {
      const avail = root.clientWidth || 360, vh = window.innerHeight || 800;
      let w = Math.min(avail, 560, Math.max(280, vh - 260));
      w = Math.max(240, Math.floor(w / 8) * 8);
      sqPx = w / 8;
      wrap.style.setProperty('--bw', w + 'px');
      wrap.style.setProperty('--sq', sqPx + 'px');
    }
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }

    const legal = () => (over || busy || state.side !== 0 ? [] : K.moves(state).map((m) => ({ s: m, ...K.parse(m) })));
    const pieceHtml = (v, extra) => v ? `<div class="ck-pc ${v > 0 ? 'me' : 'ai'}${extra || ''}">${Math.abs(v) === 2 ? CROWN : ''}</div>` : '';

    function render() {
      let b = K.board(state);
      const lm = legal();
      const ghosts = new Set();
      // a multi-jump in progress: show the piece where it has got to, jumped pieces faded
      if (sel.length > 1) {
        const v = b[sel[0]]; b = b.slice(); b[sel[0]] = 0; b[sel[sel.length - 1]] = v;
        for (let k = 1; k < sel.length; k++) ghosts.add((sel[k - 1] + sel[k]) >> 1);
      }
      const cand = sel.length ? lm.filter((m) => sel.every((x, k) => m.path[k] === x) && m.path.length > sel.length) : [];
      const targets = new Set(cand.map((m) => m.path[sel.length]));
      const jumping = lm.length && lm[0].caps.length;
      const must = new Set(jumping && !sel.length ? lm.map((m) => m.path[0]) : []);
      const lastSet = new Set(last || []);
      for (let i = 0; i < 64; i++) {
        const r = i >> 3, f = i & 7, dark = !((r + f) & 1);
        let cls = 'ck-sq ' + (dark ? 'd' : 'l');
        if (lastSet.has(i)) cls += ' last' + (last[0] === i ? ' from' : '');
        if (targets.has(i)) cls += ' tgt' + (jumping ? ' jump' : '');
        sqEls[i].className = cls;
        const cur = sel.length ? sel[sel.length - 1] : -1;
        let extra = '';
        if (i === cur) extra += ' sel';
        if (must.has(i)) extra += ' must';
        if (ghosts.has(i)) extra += ' ghost';
        let html = pieceHtml(b[i], extra);
        if (f === 0) html += `<span class="ck-co">${r + 1}</span>`;
        if (r === 0) html += `<span class="ck-co f">${FILES[f]}</span>`;
        sqEls[i].innerHTML = html;
      }
      const cnt = (pred) => K.board(state).filter(pred).length;
      const me = cnt((v) => v > 0), ai = cnt((v) => v < 0), mk = cnt((v) => v === 2), ak = cnt((v) => v === -2);
      root.querySelector('[data-c=me]').innerHTML = `<i></i>${me}${mk ? `<small>${mk} king${mk > 1 ? 's' : ''}</small>` : ''}`;
      root.querySelector('[data-c=ai]').innerHTML = `<i></i>${ai}${ak ? `<small>${ak} king${ak > 1 ? 's' : ''}</small>` : ''}`;
      barMe.classList.toggle('turn', !over && state.side === 0);
      barAI.classList.toggle('turn', !over && state.side === 1);
    }

    function setStatus(text, cls) { statusEl.className = 'ck-status' + (cls ? ' ' + cls : ''); statusEl.textContent = text; }
    function humanPrompt() {
      const lm = legal();
      if (!lm.length) return;
      if (lm[0].caps.length) setStatus(sel.length > 1 ? 'Keep jumping!' : 'You must jump!', 'must');
      else setStatus('Your move');
    }

    const xy = (i) => [(i & 7) * sqPx, (7 - (i >> 3)) * sqPx];
    // Slide a piece along `path` (a float over the board), fading jumped pieces as it passes.
    function fly(path, caps, v, hop, cb) {
      const fromEl = sqEls[path[0]].querySelector('.ck-pc');
      if (fromEl) fromEl.style.opacity = '0';
      const fl = document.createElement('div');
      fl.className = 'ck-float';
      fl.innerHTML = pieceHtml(v, ' sel');
      bw.appendChild(fl);
      const frames = path.map((i) => { const [x, y] = xy(i); return { transform: `translate(${x}px,${y}px)` }; });
      const dur = hop * (path.length - 1);
      fl.style.transform = frames[0].transform;
      caps.forEach((c, k) => later(() => { const el = sqEls[c].querySelector('.ck-pc'); if (el) el.classList.add('gone'); ctx.sound('catch'); }, hop * (k + 0.7), true));
      const finish = () => { fl.remove(); cb(); };
      if (fl.animate) {
        const a = fl.animate(frames, { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
        a.onfinish = finish;
      } else later(finish, dur, true);
    }

    function apply(mvStr, byHuman, fromPartial) {
      const m = K.parse(mvStr);
      const v = K.board(state)[m.path[0]];
      const next = K.play(state, mvStr);
      busy = true;
      const path = fromPartial ? m.path.slice(-2) : m.path;
      const caps = fromPartial ? m.caps.slice(-1) : m.caps;
      // show pre-move position (with a partial jump already drawn), then fly
      fly(path, caps, v, byHuman ? 150 : 230, () => {
        if (finished) return;
        state = next;
        moves.push(mvStr);
        last = m.path;
        sel = [];
        busy = false;
        render();
        const to = m.path[m.path.length - 1];
        const crowned = Math.abs(K.board(state)[to]) === 2 && Math.abs(v) === 1;
        if (crowned) { const el = sqEls[to].querySelector('.ck-pc'); if (el) el.classList.add('crowned'); ctx.sound('good'); }
        else if (!m.caps.length) ctx.sound('tap');
        subEl.textContent = `${byHuman ? 'You' : 'Bot'}: ${mvStr}${crowned ? ' · crowned!' : ''}`;
        const st = K.status(state);
        if (st.over) return end(st);
        if (state.side === 1) botTurn(); else humanPrompt();
      });
    }

    function botTurn() {
      busy = true;
      barAI.classList.add('thinking');
      setStatus('Bot is thinking…');
      render();
      const t0 = Date.now();
      later(() => {
        const mv = E.aiMove('checkers', state, ctx.level, ctx.seed, moves.length);
        later(() => { barAI.classList.remove('thinking'); apply(mv, false); }, Math.max(0, 420 - (Date.now() - t0)));
      }, 120);
    }

    function end(st) {
      over = true; busy = false;
      barAI.classList.remove('thinking');
      resignBtn.disabled = true;
      render();
      const n = Math.ceil(moves.length / 2);
      let res;
      if (st.winner === 0) {
        res = { won: true, detail: st.reason === 'no pieces' ? `You captured every bot piece in ${n} moves` : `The bot ran out of moves: you win in ${n} moves` };
        setStatus('You win!', 'win');
      } else if (st.winner === 1) {
        res = { won: false, detail: st.reason === 'no pieces' ? `The bot took all your pieces in ${n} moves` : `You ran out of moves after ${n} moves` };
        setStatus('Bot wins', 'bad');
      } else {
        res = { won: false, tie: true, detail: st.reason === 'move limit' ? 'Draw: move limit reached' : 'Draw: 40 moves each without a capture or crowning' };
        setStatus('Draw');
      }
      later(() => done(res), 1100, true);
    }

    function done(res) {
      if (finished) return; finished = true; over = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      ctx.finish(Object.assign({ moves: moves.slice() }, res));
    }

    boardEl.addEventListener('click', (e) => {
      const el = e.target.closest('.ck-sq');
      if (!el || over || busy || state.side !== 0) return;
      const i = +el.dataset.i;
      const lm = legal();
      const b = K.board(state);
      if (sel.length) {
        const cand = lm.filter((m) => sel.every((x, k) => m.path[k] === x) && m.path[sel.length] === i);
        if (cand.length) {
          const np = sel.concat(i);
          const full = cand.find((m) => m.path.length === np.length);
          if (full) return apply(full.s, true, sel.length > 1);
          sel = np; ctx.sound('catch'); render(); humanPrompt(); return;
        }
        if (sel.length > 1 && i !== sel[0]) return; // mid-jump: only the next landing (or the start square to undo)
      }
      if (b[i] > 0 && sel[0] !== i) {
        if (lm.some((m) => m.path[0] === i)) { sel = [i]; ctx.sound('tap'); }
        else { sel = []; ctx.sound('bad'); if (lm[0] && lm[0].caps.length) { setStatus('You must jump!', 'must'); } }
      } else sel = [];
      render(); humanPrompt();
    });

    let confirmT = null;
    resignBtn.addEventListener('click', () => {
      if (over) return;
      if (!resignBtn.classList.contains('confirm')) {
        resignBtn.classList.add('confirm'); resignBtn.textContent = 'Tap again to resign';
        confirmT = setTimeout(() => { resignBtn.classList.remove('confirm'); resignBtn.textContent = 'Resign'; }, 2600);
        return;
      }
      clearTimeout(confirmT);
      over = true; resignBtn.disabled = true;
      setStatus('You resigned', 'bad');
      done({ won: false, detail: `You resigned after ${Math.ceil(moves.length / 2)} moves` });
    });

    render();
    humanPrompt();
    root.__checkers = { seed: ctx.seed, level: ctx.level, get state() { return state; }, get moves() { return moves.slice(); }, get busy() { return busy; }, get over() { return over; } };
  }

  window.MFLArcade.register('checkers', { start });
})();
