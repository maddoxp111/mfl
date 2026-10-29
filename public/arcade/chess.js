// MFL Arcade: Chess vs the bot. Rules + AI live in engines.js (MFLEngines.chess), so the server can replay.
// Controls: tap a piece, then tap a highlighted square (tap the piece again to cancel). Pawns reaching the
// last rank open a promotion picker. Resign = loss.
(function () {
  const CSS = `
.chess-wrap{--bw:360px;--sq:45px;width:var(--bw);max-width:100%;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#f5f6f8;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.chess-bar{display:flex;align-items:center;gap:10px;padding:8px 2px;min-height:44px}
.chess-av{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;font:800 13px 'Barlow Condensed',Inter,sans-serif;letter-spacing:.04em;flex:none}
.chess-bar.ai .chess-av{background:#1d212c;color:#ff3344;border:1px solid #2a2f3c}
.chess-bar.me .chess-av{background:#ffc21a;color:#07080b}
.chess-who{display:flex;flex-direction:column;line-height:1.1;min-width:0;flex:none}
.chess-who small{white-space:nowrap}
.chess-who b{font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em}
.chess-who small{color:#6f7584;font-size:12px}
.chess-capt{margin-left:auto;display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:0;min-height:20px;min-width:0;flex:1;font-family:'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols 2','DejaVu Sans',sans-serif;font-size:17px;line-height:1}
.chess-chip{display:inline-flex;flex-wrap:wrap;justify-content:flex-end;background:#cfd6e2;border-radius:8px;padding:2px 6px 2px 8px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.12)}
.chess-chip:empty{display:none}
.chess-capt i{font-style:normal;margin-left:-3px}
.chess-capt .w{color:#fbfbfd;text-shadow:0 0 1px #111,1px 0 0 #111,-1px 0 0 #111,0 1px 0 #111,0 -1px 0 #111}
.chess-capt .b{color:#14161c}
.chess-capt em{font:700 12px Inter,sans-serif;color:#6f7584;margin-left:6px;font-style:normal}
.chess-bar.turn .chess-av{box-shadow:0 0 0 2px #07080b,0 0 0 4px #ffc21a}
.chess-bar.ai.turn .chess-av{box-shadow:0 0 0 2px #07080b,0 0 0 4px #ff3344}
.chess-think{display:none;gap:3px;margin-left:4px}
.chess-bar.thinking .chess-think{display:inline-flex}
.chess-think span{width:5px;height:5px;border-radius:50%;background:#ff3344;animation:chess-dot 1s infinite ease-in-out}
.chess-think span:nth-child(2){animation-delay:.15s}.chess-think span:nth-child(3){animation-delay:.3s}
@keyframes chess-dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.chess-bw{position:relative;width:var(--bw);height:var(--bw);border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 0 1px #2a2f3c;touch-action:manipulation}
.chess-board{display:grid;grid-template-columns:repeat(8,var(--sq));grid-template-rows:repeat(8,var(--sq));width:var(--bw);height:var(--bw)}
.chess-sq{position:relative;display:grid;place-items:center;cursor:pointer}
.chess-sq.l{background:#cfd6e2}.chess-sq.d{background:#6c7c98}
.chess-sq.last::after{content:'';position:absolute;inset:0;background:rgba(255,194,26,.38)}
.chess-sq.sel::after{content:'';position:absolute;inset:0;background:rgba(255,194,26,.62)}
.chess-sq.chk{background-image:radial-gradient(circle,rgba(255,51,68,1) 0,rgba(255,51,68,.75) 35%,rgba(255,51,68,0) 72%)}
.chess-sq.tgt::before{content:'';position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(7,8,11,.32);z-index:3;pointer-events:none}
.chess-sq.tgt.cap::before{width:86%;height:86%;background:transparent;border:calc(var(--sq)*.08) solid rgba(7,8,11,.38);box-sizing:border-box}
.chess-sq.tgt:hover::before{background:rgba(255,194,26,.55)}
.chess-sq.tgt.cap:hover::before{border-color:rgba(255,194,26,.8);background:transparent}
.chess-co{position:absolute;font:700 calc(var(--sq)*.2) Inter,sans-serif;pointer-events:none;z-index:2;opacity:.9}
.chess-co.r{left:3px;top:2px}.chess-co.f{right:3px;bottom:1px}
.chess-sq.l .chess-co{color:#6c7c98}.chess-sq.d .chess-co{color:#cfd6e2}
.chess-pc{position:relative;z-index:4;font-family:'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols 2','DejaVu Sans',sans-serif;font-size:calc(var(--sq)*.8);line-height:1;pointer-events:none;will-change:transform;transform:translateY(-2%)}
.chess-pc.w{color:#fbfbfd;text-shadow:0 0 1px #111,1px 0 0 #111,-1px 0 0 #111,0 1px 0 #111,0 -1px 0 #111,0 3px 4px rgba(0,0,0,.45)}
.chess-pc.b{color:#14161c;text-shadow:0 0 1px rgba(255,255,255,.35),0 3px 4px rgba(0,0,0,.4)}
.chess-pc.lift{transform:translateY(-8%) scale(1.08)}
.chess-promo{position:absolute;inset:0;z-index:20;background:rgba(7,8,11,.72);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
.chess-promo[hidden]{display:none}
.chess-promo-in{background:#161922;border:1px solid #2a2f3c;border-radius:16px;padding:14px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.6);animation:chess-pop .18s ease-out}
.chess-promo-in p{margin:0 0 10px;font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#ffc21a}
.chess-promo-in div{display:flex;gap:8px}
.chess-promo button{width:calc(var(--sq)*1.25);height:calc(var(--sq)*1.25);min-width:54px;min-height:54px;border-radius:12px;border:1px solid #2a2f3c;background:#cfd6e2;cursor:pointer;display:grid;place-items:center;padding:0}
.chess-promo button:hover,.chess-promo button:focus-visible{background:#ffc21a;outline:none}
.chess-promo button span{font-family:'Segoe UI Symbol','Apple Symbols','Noto Sans Symbols 2','DejaVu Sans',sans-serif;font-size:calc(max(var(--sq),44px)*.9);line-height:1;color:#fbfbfd;text-shadow:0 0 1px #111,1px 0 0 #111,-1px 0 0 #111,0 1px 0 #111,0 -1px 0 #111}
@keyframes chess-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
.chess-status{margin:12px 0 8px;text-align:center;font:800 22px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em;min-height:28px}
.chess-status.check{color:#ff3344;animation:chess-shake .35s}
.chess-status.win{color:#ffc21a}
@keyframes chess-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.chess-moves{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:6px 2px;min-height:34px;font:600 13px Inter,sans-serif;color:#9aa1b0;mask-image:linear-gradient(90deg,transparent 0,#000 18px)}
.chess-moves::-webkit-scrollbar{display:none}
.chess-moves span{flex:none;padding:3px 7px;border-radius:7px;background:#0f1117;border:1px solid #1d212c;white-space:nowrap}
.chess-moves span b{color:#6f7584;font-weight:600;margin-right:4px}
.chess-moves span.cur{border-color:#ffc21a;color:#f5f6f8}
.chess-moves .chess-empty{background:none;border:none;color:#6f7584}
.chess-act{display:flex;justify-content:center;gap:10px;margin-top:8px}
.chess-btn{font:800 14px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:10px 20px;border-radius:999px;border:1px solid #2a2f3c;background:#161922;color:#f5f6f8;cursor:pointer;min-height:42px}
.chess-btn:hover{border-color:#6f7584}
.chess-btn.confirm{background:#ff3344;border-color:#ff3344;color:#fff}
.chess-btn:disabled{opacity:.4;cursor:default}
`;
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const FILES = 'abcdefgh';
  const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
  const sqIdx = (s) => (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 8;
  const glyph = (pc) => `<span class="chess-pc ${pc === pc.toUpperCase() ? 'w' : 'b'}">${GLYPH[pc.toLowerCase()]}︎</span>`;

  function start(ctx) {
    const E = window.MFLEngines, C = E.chess;
    if (!document.getElementById('chess-css')) { const st = document.createElement('style'); st.id = 'chess-css'; st.textContent = CSS; document.head.appendChild(st); }
    const root = ctx.root;
    root.innerHTML = `
<div class="chess-wrap">
  <div class="chess-bar ai"><div class="chess-av">BOT</div><div class="chess-who"><b>MFL Bot <span class="chess-think"><span></span><span></span><span></span></span></b><small>${ctx.levelName || E.LEVELS[ctx.level]} · Black</small></div><div class="chess-capt" data-c="ai"></div></div>
  <div class="chess-bw"><div class="chess-board"></div>
    <div class="chess-promo" hidden><div class="chess-promo-in"><p>Promote to</p><div></div></div></div></div>
  <div class="chess-bar me"><div class="chess-av">YOU</div><div class="chess-who"><b>You</b><small>White · moves first</small></div><div class="chess-capt" data-c="me"></div></div>
  <div class="chess-status">Your move</div>
  <div class="chess-moves"><span class="chess-empty">Tap a piece, then tap where it goes.</span></div>
  <div class="chess-act"><button class="chess-btn" data-a="resign">Resign</button></div>
</div>`;
    const wrap = root.querySelector('.chess-wrap'), boardEl = root.querySelector('.chess-board');
    const statusEl = root.querySelector('.chess-status'), movesEl = root.querySelector('.chess-moves');
    const promoEl = root.querySelector('.chess-promo'), resignBtn = root.querySelector('[data-a=resign]');
    const barAI = root.querySelector('.chess-bar.ai'), barMe = root.querySelector('.chess-bar.me');

    let state = C.create();
    const moves = [], sans = [];
    let sel = -1, last = null, busy = false, over = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!over || fn.force) fn(); }, ms); timers.add(t); return t; };

    // squares: display order rank 8 -> 1 (human plays White at the bottom)
    const sqEls = new Array(64);
    for (let row = 7; row >= 0; row--) for (let f = 0; f < 8; f++) {
      const i = row * 8 + f, d = document.createElement('div');
      d.className = 'chess-sq ' + ((row + f) % 2 ? 'l' : 'd');
      d.dataset.i = i;
      sqEls[i] = d;
      boardEl.appendChild(d);
    }

    function size() {
      const avail = root.clientWidth || 360;
      const vh = window.innerHeight || 800;
      let bw = Math.min(avail, 560, Math.max(280, vh - 270));
      bw = Math.max(240, Math.floor(bw / 8) * 8);
      wrap.style.setProperty('--bw', bw + 'px');
      wrap.style.setProperty('--sq', bw / 8 + 'px');
    }
    size();
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }

    const legal = () => (over || busy ? [] : C.moves(state));
    function render() {
      const b = C.board(state);
      const lm = legal();
      const tg = new Map();
      if (sel >= 0) for (const m of lm) if (sqIdx(m) === sel) tg.set(sqIdx(m.slice(2, 4)), m);
      const checkSq = C.inCheck(state) ? b.indexOf(state.side === 0 ? 'K' : 'k') : -1;
      for (let i = 0; i < 64; i++) {
        const el = sqEls[i], pc = b[i];
        let cls = 'chess-sq ' + ((Math.floor(i / 8) + (i % 8)) % 2 ? 'l' : 'd');
        if (last && (i === last[0] || i === last[1])) cls += ' last';
        if (i === sel) cls += ' sel';
        if (i === checkSq) cls += ' chk';
        if (tg.has(i)) cls += ' tgt' + (pc || (b[sel] === 'P' && i % 8 !== sel % 8) ? ' cap' : '');
        el.className = cls;
        let html = pc ? glyph(pc) : '';
        if (i % 8 === 0) html += `<span class="chess-co r">${Math.floor(i / 8) + 1}</span>`;
        if (i < 8) html += `<span class="chess-co f">${FILES[i]}</span>`;
        el.innerHTML = html;
        if (i === sel && pc) el.firstChild.classList.add('lift');
      }
      // captured material
      const count = (arr, ch) => arr.filter((x) => x === ch).length;
      const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
      let meVal = 0, aiVal = 0, meHtml = '', aiHtml = '';
      for (const t of ['q', 'r', 'b', 'n', 'p']) {
        const lostBlack = Math.max(0, start[t] - count(b, t)), lostWhite = Math.max(0, start[t] - count(b, t.toUpperCase()));
        meHtml += `<i class="b">${GLYPH[t]}︎</i>`.repeat(lostBlack);
        aiHtml += `<i class="w">${GLYPH[t]}︎</i>`.repeat(lostWhite);
      }
      for (const pc of b) if (pc) { if (pc === pc.toUpperCase()) meVal += VAL[pc.toLowerCase()]; else aiVal += VAL[pc]; }
      root.querySelector('[data-c=me]').innerHTML = `<span class="chess-chip">${meHtml}</span>` + (meVal > aiVal ? `<em>+${meVal - aiVal}</em>` : '');
      root.querySelector('[data-c=ai]').innerHTML = `<span class="chess-chip">${aiHtml}</span>` + (aiVal > meVal ? `<em>+${aiVal - meVal}</em>` : '');
      barMe.classList.toggle('turn', !over && state.side === 0);
      barAI.classList.toggle('turn', !over && state.side === 1);
    }

    function renderMoves() {
      if (!sans.length) return;
      let html = '';
      for (let i = 0; i < sans.length; i += 2) {
        html += `<span class="${i >= sans.length - 2 ? 'cur' : ''}"><b>${i / 2 + 1}.</b>${sans[i]}${sans[i + 1] ? ' ' + sans[i + 1] : ''}</span>`;
      }
      movesEl.innerHTML = html;
      movesEl.scrollLeft = movesEl.scrollWidth;
    }

    function setStatus(text, cls) {
      statusEl.className = 'chess-status' + (cls ? ' ' + cls : '');
      statusEl.textContent = text;
    }

    // slide the piece that just landed on `to` from `from`
    function animate(from, to) {
      const el = sqEls[to].querySelector('.chess-pc');
      if (!el || !el.animate) return;
      const sq = boardEl.clientWidth / 8;
      const dx = ((from % 8) - (to % 8)) * sq, dy = (Math.floor(to / 8) - Math.floor(from / 8)) * sq;
      el.animate([{ transform: `translate(${dx}px,${dy}px) scale(1.1)` }, { transform: 'translate(0,0) scale(1)' }], { duration: 190, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }

    function apply(mv, byHuman) {
      const before = C.board(state);
      const san = C.san(state, mv);
      state = C.play(state, mv);
      moves.push(mv); sans.push(san);
      const from = sqIdx(mv), to = sqIdx(mv.slice(2, 4));
      last = [from, to];
      sel = -1;
      render();
      animate(from, to);
      // castling: also slide the rook
      if (/[Kk]/.test(before[from]) && Math.abs(to - from) === 2) {
        const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
        animate(rf, rt);
      }
      renderMoves();
      const captured = before[to] || (/[Pp]/.test(before[from]) && from % 8 !== to % 8);
      const st = C.status(state);
      if (st.over) return end(st);
      if (C.inCheck(state)) { ctx.sound('whistle'); setStatus(state.side === 0 ? 'Check! Your move' : 'Check!', 'check'); }
      else { ctx.sound(captured ? (byHuman ? 'good' : 'bad') : 'tap'); setStatus(state.side === 0 ? 'Your move' : 'Bot is thinking…'); }
      if (state.side === 1) botTurn();
    }

    function botTurn() {
      busy = true;
      barAI.classList.add('thinking');
      render();
      const t0 = Date.now();
      later(() => {
        const mv = E.aiMove('chess', state, ctx.level, ctx.seed, moves.length);
        const wait = Math.max(0, 480 - (Date.now() - t0));
        later(() => {
          barAI.classList.remove('thinking');
          busy = false;
          apply(mv, false);
          if (!over && !C.inCheck(state)) setStatus('Your move');
        }, wait);
      }, 140);
    }

    function end(st) {
      over = true; busy = false;
      barAI.classList.remove('thinking');
      render();
      const n = Math.ceil(moves.length / 2);
      let res;
      if (st.winner === 0) { res = { won: true, detail: `Checkmate in ${n} moves` }; setStatus('Checkmate! You win', 'win'); }
      else if (st.winner === 1) { res = { won: false, detail: `Checkmated in ${n} moves` }; setStatus('Checkmate', 'check'); }
      else {
        const why = { stalemate: 'Stalemate', '50-move rule': '50-move rule', 'insufficient material': 'Not enough pieces to mate', 'threefold repetition': 'Threefold repetition', 'move limit': 'Move limit reached' }[st.reason] || st.reason;
        res = { won: false, tie: true, detail: `Draw: ${why} after ${n} moves` }; setStatus('Draw: ' + why);
      }
      resignBtn.disabled = true;
      const f = () => done(res); f.force = true;
      later(f, 1100);
    }

    let finished = false;
    function done(res) {
      if (finished) return; finished = true;
      over = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      ctx.finish(Object.assign({ moves: moves.slice() }, res));
    }

    function choosePromotion(cands) {
      const box = promoEl.querySelector('.chess-promo-in div');
      box.innerHTML = '';
      for (const t of ['q', 'r', 'b', 'n']) {
        const mv = cands.find((m) => m[4] === t);
        if (!mv) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[t]);
        btn.innerHTML = `<span>${GLYPH[t]}︎</span>`;
        btn.addEventListener('click', (e) => { e.stopPropagation(); promoEl.hidden = true; apply(mv, true); });
        box.appendChild(btn);
      }
      promoEl.hidden = false;
    }
    promoEl.addEventListener('click', (e) => { if (e.target === promoEl) { promoEl.hidden = true; sel = -1; render(); } });

    boardEl.addEventListener('click', (e) => {
      const el = e.target.closest('.chess-sq');
      if (!el || over || busy || state.side !== 0) return;
      const i = +el.dataset.i;
      const b = C.board(state);
      const lm = legal();
      if (sel >= 0) {
        const cands = lm.filter((m) => sqIdx(m) === sel && sqIdx(m.slice(2, 4)) === i);
        if (cands.length > 1) return choosePromotion(cands);
        if (cands.length === 1) return apply(cands[0], true);
      }
      if (b[i] && b[i] === b[i].toUpperCase() && i !== sel) {
        sel = i;
        if (!lm.some((m) => sqIdx(m) === i)) ctx.sound('bad'); else ctx.sound('tap');
      } else sel = -1;
      render();
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
      over = true;
      resignBtn.disabled = true;
      setStatus('You resigned');
      done({ won: false, detail: `You resigned after ${Math.ceil(moves.length / 2)} moves` });
    });

    render();
    // test hook: lets automated tests read the position
    root.__chess = { seed: ctx.seed, level: ctx.level, get state() { return state; }, get moves() { return moves.slice(); }, get busy() { return busy; }, get over() { return over; } };
  }

  window.MFLArcade.register('chess', { start });
})();
