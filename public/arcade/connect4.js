// MFL Arcade: Connect Four vs the bot. Rules + AI live in engines.js (MFLEngines.connect4).
// Controls: tap (or click) any column to drop a gold disc; on desktop hover previews the drop. Quit = loss.
(function () {
  const CSS = `
.c4-wrap{--cell:50px;--w:350px;width:var(--w);max-width:100%;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#f5f6f8;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.c4-bars{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 2px 2px}
.c4-pl{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:999px;background:#0f1117;border:1px solid #1d212c;transition:border-color .2s,box-shadow .2s}
.c4-pl i{width:22px;height:22px;border-radius:50%;flex:none}
.c4-pl.me i{background:radial-gradient(circle at 35% 30%,#ffe9a0,#ffc21a 55%,#c98f00)}
.c4-pl.ai i{background:radial-gradient(circle at 35% 30%,#ff9aa2,#ff3344 55%,#b3121f)}
.c4-pl b{font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em;line-height:1}
.c4-pl small{display:block;color:#6f7584;font-size:11px;line-height:1.2}
.c4-pl.turn.me{border-color:#ffc21a;box-shadow:0 0 16px rgba(255,194,26,.25)}
.c4-pl.turn.ai{border-color:#ff3344;box-shadow:0 0 16px rgba(255,51,68,.25)}
.c4-think{display:none;gap:3px;margin-left:2px}
.c4-pl.thinking .c4-think{display:inline-flex}
.c4-think span{width:4px;height:4px;border-radius:50%;background:#ff3344;animation:c4-dot 1s infinite ease-in-out}
.c4-think span:nth-child(2){animation-delay:.15s}.c4-think span:nth-child(3){animation-delay:.3s}
@keyframes c4-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}
.c4-board{position:relative;width:var(--w);height:calc(var(--cell)*7);margin-top:4px;touch-action:manipulation}
.c4-back{position:absolute;left:0;right:0;bottom:0;height:calc(var(--cell)*6);border-radius:14px;background:#06070c}
.c4-discs{position:absolute;inset:0;overflow:hidden;border-radius:0 0 14px 14px}
.c4-frame{position:absolute;left:0;right:0;bottom:0;height:calc(var(--cell)*6);border-radius:14px;pointer-events:none;
  background:radial-gradient(circle at 50% 50%,transparent calc(var(--cell)*.39),rgba(0,0,0,.45) calc(var(--cell)*.39 + .5px),rgba(0,0,0,0) calc(var(--cell)*.45)),
    radial-gradient(circle at 50% 50%,transparent calc(var(--cell)*.39),#2446b0 calc(var(--cell)*.39 + .5px));
  background-size:var(--cell) var(--cell);box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.18),inset 0 -4px 0 rgba(0,0,0,.25)}
.c4-disc{position:absolute;width:calc(var(--cell)*.8);height:calc(var(--cell)*.8);border-radius:50%;will-change:transform;transition:opacity .3s}
.c4-disc::after{content:'';position:absolute;inset:18%;border-radius:50%;border:2px solid rgba(0,0,0,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.c4-disc.me{background:radial-gradient(circle at 35% 30%,#ffe9a0 0,#ffc21a 50%,#d39a00 100%)}
.c4-disc.ai{background:radial-gradient(circle at 35% 30%,#ff9aa2 0,#ff3344 50%,#b3121f 100%)}
.c4-disc.ghost{opacity:.45}
.c4-disc.dim{opacity:.35}
.c4-cols{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr);z-index:5}
.c4-col{cursor:pointer;border-radius:10px;transition:background .15s}
.c4-board.can .c4-col:hover{background:linear-gradient(180deg,rgba(255,194,26,0) 0,rgba(255,194,26,.08) 30%,rgba(255,194,26,.08) 100%)}
.c4-board:not(.can) .c4-col{cursor:default}
.c4-rings{position:absolute;inset:0;pointer-events:none;z-index:4}
.c4-ring{position:absolute;width:calc(var(--cell)*.86);height:calc(var(--cell)*.86);border-radius:50%;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 18px 4px rgba(255,255,255,.55);animation:c4-win .9s infinite ease-in-out}
.c4-ring.ai{border-color:#ffd0d4;box-shadow:0 0 18px 4px rgba(255,51,68,.6)}
@keyframes c4-win{0%,100%{transform:scale(.92)}50%{transform:scale(1.06)}}
.c4-hints{position:absolute;left:0;right:0;top:0;height:var(--cell);display:grid;grid-template-columns:repeat(7,1fr);pointer-events:none;transition:opacity .2s}
.c4-hints span{display:grid;place-items:center;color:#ffc21a;opacity:.55;animation:c4-hint 1.4s infinite ease-in-out}
.c4-hints span.full{visibility:hidden}
.c4-hints svg{width:40%;height:40%}
.c4-board:not(.can) .c4-hints,.c4-board.hov .c4-hints{opacity:0}
@keyframes c4-hint{0%,100%{transform:translateY(-12%)}50%{transform:translateY(12%)}}
.c4-status{margin:14px 0 4px;text-align:center;font:800 22px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em;min-height:28px}
.c4-status.win{color:#ffc21a}.c4-status.bad{color:#ff3344}
.c4-sub{text-align:center;color:#6f7584;font-size:13px;min-height:20px}
.c4-act{display:flex;justify-content:center;margin-top:10px}
.c4-btn{font:800 14px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:10px 20px;border-radius:999px;border:1px solid #2a2f3c;background:#161922;color:#f5f6f8;cursor:pointer;min-height:42px}
.c4-btn:hover{border-color:#6f7584}
.c4-btn.confirm{background:#ff3344;border-color:#ff3344;color:#fff}
.c4-btn:disabled{opacity:.4;cursor:default}
`;
  function start(ctx) {
    const E = window.MFLEngines, F = E.connect4;
    if (!document.getElementById('c4-css')) { const st = document.createElement('style'); st.id = 'c4-css'; st.textContent = CSS; document.head.appendChild(st); }
    const root = ctx.root;
    root.innerHTML = `
<div class="c4-wrap">
  <div class="c4-bars">
    <div class="c4-pl me"><i></i><div><b>You</b><small>Gold · first</small></div></div>
    <div class="c4-pl ai"><div style="text-align:right"><b>MFL Bot <span class="c4-think"><span></span><span></span><span></span></span></b><small>${ctx.levelName || E.LEVELS[ctx.level]}</small></div><i></i></div>
  </div>
  <div class="c4-board can"><div class="c4-hints"></div><div class="c4-back"></div><div class="c4-discs"></div><div class="c4-frame"></div><div class="c4-rings"></div><div class="c4-cols"></div></div>
  <div class="c4-status">Your turn</div>
  <div class="c4-sub">Tap a column to drop a disc. Get four in a row!</div>
  <div class="c4-act"><button class="c4-btn" data-a="quit">Give up</button></div>
</div>`;
    const wrap = root.querySelector('.c4-wrap'), boardEl = root.querySelector('.c4-board');
    const discsEl = root.querySelector('.c4-discs'), ringsEl = root.querySelector('.c4-rings'), colsEl = root.querySelector('.c4-cols');
    const statusEl = root.querySelector('.c4-status'), subEl = root.querySelector('.c4-sub'), quitBtn = root.querySelector('[data-a=quit]');
    const plMe = root.querySelector('.c4-pl.me'), plAI = root.querySelector('.c4-pl.ai');

    let state = F.create();
    const moves = [];
    let busy = false, over = false, finished = false, hoverCol = -1, winCells = null, winWho = 0;
    const timers = new Set();
    const later = (fn, ms, force) => { const t = setTimeout(() => { timers.delete(t); if (!over || force) fn(); }, ms); timers.add(t); return t; };
    const discEls = {}; // "c,r" -> element

    let cell = 50;
    function place(el, c, r) { // r = 0 bottom .. 5 top, r = 6 is the preview row above the board
      el.style.left = (c * cell + cell * 0.1) + 'px';
      el.style.top = ((6 - r) * cell + cell * 0.1) + 'px';
    }
    function size() {
      const avail = root.clientWidth || 350, vh = window.innerHeight || 800;
      let w = Math.min(avail, 532, Math.max(259, Math.floor((vh - 250) * 7 / 7)));
      cell = Math.max(36, Math.floor(w / 7));
      wrap.style.setProperty('--cell', cell + 'px');
      wrap.style.setProperty('--w', cell * 7 + 'px');
      for (const k in discEls) { const [c, r] = k.split(',').map(Number); place(discEls[k], c, r); }
      if (preview) place(preview, Math.max(0, hoverCol), 6);
      drawRings();
    }
    const hintsEl = root.querySelector('.c4-hints');
    for (let c = 0; c < 7; c++) {
      const d = document.createElement('div'); d.className = 'c4-col'; d.dataset.c = c; colsEl.appendChild(d);
      const h = document.createElement('span'); h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8l7 8 7-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'; hintsEl.appendChild(h);
    }
    const preview = document.createElement('div');
    preview.className = 'c4-disc me ghost';
    preview.style.display = 'none';
    discsEl.appendChild(preview);
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }

    const canPlay = () => !over && !busy && state.side === 0;
    function setStatus(text, cls) { statusEl.className = 'c4-status' + (cls ? ' ' + cls : ''); statusEl.textContent = text; }
    function turnUI() {
      plMe.classList.toggle('turn', !over && state.side === 0);
      plAI.classList.toggle('turn', !over && state.side === 1);
      boardEl.classList.toggle('can', canPlay());
      for (let c = 0; c < 7; c++) hintsEl.children[c].classList.toggle('full', F.height(state, c) >= 6);
    }

    function drop(col, who, cb) {
      const r = F.height(state, col);
      const el = document.createElement('div');
      el.className = 'c4-disc ' + (who === 0 ? 'me' : 'ai');
      place(el, col, r);
      discsEl.appendChild(el);
      discEls[col + ',' + r] = el;
      const dist = (6 - r) * cell;
      const dur = 260 + (6 - r) * 45;
      if (el.animate) {
        const a = el.animate([
          { transform: `translateY(${-dist}px)`, easing: 'cubic-bezier(.45,0,1,1)' },
          { transform: 'translateY(0)', offset: 0.72, easing: 'cubic-bezier(0,0,.4,1)' },
          { transform: `translateY(${-Math.min(cell * 0.22, dist * 0.12)}px)`, offset: 0.86, easing: 'cubic-bezier(.6,0,1,1)' },
          { transform: 'translateY(0)' },
        ], { duration: dur });
        later(() => { ctx.sound(who === 0 ? 'tap' : 'kick'); }, dur * 0.72, true);
        a.onfinish = cb;
      } else later(cb, 10, true);
    }

    function play(col, byHuman) {
      busy = true;
      turnUI();
      if (byHuman) setStatus('');
      preview.style.display = 'none';
      const mv = String(col);
      drop(col, byHuman ? 0 : 1, () => {
        if (finished) return;
        state = F.play(state, mv);
        moves.push(mv);
        busy = false;
        const st = F.status(state);
        if (st.over) return end(st);
        turnUI();
        if (state.side === 1) botTurn();
        else { setStatus('Your turn'); if (hoverCol >= 0) showPreview(hoverCol); }
      });
    }

    function botTurn() {
      busy = true;
      plAI.classList.add('thinking');
      setStatus('Bot is thinking…');
      turnUI();
      const t0 = Date.now();
      later(() => {
        const mv = E.aiMove('connect4', state, ctx.level, ctx.seed, moves.length);
        later(() => { plAI.classList.remove('thinking'); play(+mv, false); }, Math.max(0, 450 - (Date.now() - t0)));
      }, 100);
    }

    function drawRings() {
      ringsEl.innerHTML = '';
      if (!winCells) return;
      for (const [c, r] of winCells) {
        const d = document.createElement('div');
        d.className = 'c4-ring' + (winWho === 1 ? ' ai' : '');
        d.style.left = (c * cell + cell * 0.07) + 'px';
        d.style.top = ((6 - r) * cell + cell * 0.07) + 'px';
        ringsEl.appendChild(d);
      }
    }

    function end(st) {
      over = true; busy = false;
      plAI.classList.remove('thinking');
      quitBtn.disabled = true;
      turnUI();
      const n = Math.ceil(moves.length / 2);
      let res;
      const line = F.winLine(state);
      if (line) {
        winCells = line; winWho = st.winner;
        const set = new Set(line.map(([c, r]) => c + ',' + r));
        for (const k in discEls) if (!set.has(k)) discEls[k].classList.add('dim');
        drawRings();
      }
      if (st.winner === 0) { res = { won: true, detail: `You got four in a row in ${n} moves` }; setStatus('Four in a row! You win', 'win'); }
      else if (st.winner === 1) { res = { won: false, detail: `The bot got four in a row after ${n} moves` }; setStatus('The bot got four', 'bad'); }
      else { res = { won: false, tie: true, detail: 'Board full: it\'s a draw' }; setStatus('Board full: draw'); }
      subEl.textContent = '';
      later(() => done(res), 1300, true);
    }

    function done(res) {
      if (finished) return; finished = true; over = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      ctx.finish(Object.assign({ moves: moves.slice() }, res));
    }

    function showPreview(c) {
      if (!canPlay() || F.height(state, c) >= 6) { preview.style.display = 'none'; boardEl.classList.remove('hov'); return; }
      preview.style.display = '';
      boardEl.classList.add('hov');
      place(preview, c, 6);
    }
    colsEl.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest('.c4-col');
      if (!el) return;
      hoverCol = +el.dataset.c;
      showPreview(hoverCol);
    });
    colsEl.addEventListener('pointerleave', () => { hoverCol = -1; preview.style.display = 'none'; boardEl.classList.remove('hov'); });
    colsEl.addEventListener('click', (e) => {
      const el = e.target.closest('.c4-col');
      if (!el || !canPlay()) return;
      const c = +el.dataset.c;
      if (F.height(state, c) >= 6) { ctx.sound('bad'); subEl.textContent = 'That column is full.'; return; }
      subEl.textContent = '';
      play(c, true);
    });

    let confirmT = null;
    quitBtn.addEventListener('click', () => {
      if (over) return;
      if (!quitBtn.classList.contains('confirm')) {
        quitBtn.classList.add('confirm'); quitBtn.textContent = 'Tap again to give up';
        confirmT = setTimeout(() => { quitBtn.classList.remove('confirm'); quitBtn.textContent = 'Give up'; }, 2600);
        return;
      }
      clearTimeout(confirmT);
      over = true; quitBtn.disabled = true;
      setStatus('You gave up', 'bad');
      done({ won: false, detail: `You gave up after ${Math.ceil(moves.length / 2)} moves` });
    });

    turnUI();
    root.__c4 = { seed: ctx.seed, level: ctx.level, get state() { return state; }, get moves() { return moves.slice(); }, get busy() { return busy; }, get over() { return over; } };
  }

  window.MFLArcade.register('connect4', { start });
})();
