// MFL Trivia: questions come from the server (built from real league stats) and the
// server grades the answers, so the client never knows which option is right.
(function () {
  const css = `.tv{max-width:640px;margin:0 auto}
.tv-top{display:flex;justify-content:space-between;align-items:center;font:800 13px 'Press Start 2P',monospace;color:#ffc21a;margin-bottom:12px}
.tv-bar{height:8px;border-radius:99px;background:#1d212c;overflow:hidden;margin-bottom:18px}.tv-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffc21a,#ff3344);transition:width .1s linear}
.tv-q{font:800 26px/1.15 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.01em;margin:0 0 16px;min-height:60px}
.tv-o{display:grid;gap:10px}
.tv-o button{display:flex;align-items:center;gap:12px;text-align:left;padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.11);background:#161922;color:#f5f6f8;font:600 16px Inter;cursor:pointer;transition:transform .08s,background .12s}
.tv-o button:hover{background:#1d212c}.tv-o button:active{transform:scale(.98)}
.tv-o button i{font-style:normal;flex:0 0 30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#0f1117;color:#ffc21a;font:800 13px 'Press Start 2P',monospace}
.tv-o button.picked{background:#ffc21a;color:#1a1300;border-color:#ffc21a}.tv-o button.picked i{background:rgba(0,0,0,.15);color:#1a1300}
.tv-foot{display:flex;justify-content:space-between;align-items:center;margin-top:16px;color:#6f7584;font:600 13px Inter}
.tv-foot button{background:none;border:1px solid rgba(255,255,255,.12);color:#aeb3c0;border-radius:99px;padding:7px 14px;font:700 12px Inter;cursor:pointer}`;
  MFLArcade.register('trivia', {
    start(ctx) {
      if (!document.getElementById('tv-css')) { const s = document.createElement('style'); s.id = 'tv-css'; s.textContent = css; document.head.appendChild(s); }
      const Q = ctx.data.questions || [], secs = ctx.data.secs || 15, need = ctx.data.need || Math.ceil(Q.length * 0.7);
      const answers = [];
      let i = 0, t0 = 0, timer = null, done = false;
      const el = document.createElement('div'); el.className = 'tv'; ctx.root.appendChild(el);
      function show() {
        if (i >= Q.length) return end(false);
        const q = Q[i];
        el.innerHTML = `<div class="tv-top"><span>Q${i + 1}/${Q.length}</span><span>NEED ${need}</span><span id="tvT">${secs}</span></div><div class="tv-bar"><i id="tvB" style="width:100%"></i></div>
          <h2 class="tv-q"></h2><div class="tv-o">${q.opts.map((o, k) => `<button type="button" data-k="${k}"><i>${'ABCD'[k]}</i><span></span></button>`).join('')}</div>
          <div class="tv-foot"><span>${ctx.exhibition ? 'Practice' : ctx.levelName}</span><button type="button" class="tv-quit">Quit</button></div>`;
        el.querySelector('.tv-q').textContent = q.q;
        el.querySelectorAll('.tv-o button span').forEach((s, k) => { s.textContent = q.opts[k]; });
        el.querySelectorAll('.tv-o button').forEach((b) => b.onclick = () => pick(+b.dataset.k, b));
        el.querySelector('.tv-quit').onclick = () => end(true);
        t0 = performance.now();
        clearInterval(timer);
        timer = setInterval(() => {
          const left = secs - (performance.now() - t0) / 1000;
          const T = document.getElementById('tvT'), B = document.getElementById('tvB');
          if (T) T.textContent = Math.max(0, Math.ceil(left)); if (B) B.style.width = Math.max(0, left / secs * 100) + '%';
          if (left <= 0) { clearInterval(timer); answers[i] = -1; ctx.sound('bad'); i++; show(); }
        }, 100);
      }
      function pick(k, b) {
        if (done || answers[i] != null) return;
        clearInterval(timer); answers[i] = k; b.classList.add('picked'); ctx.sound('tap');
        setTimeout(() => { i++; show(); }, 350);
      }
      function end(quit) {
        if (done) return; done = true; clearInterval(timer);
        while (answers.length < Q.length) answers.push(-1);
        el.innerHTML = '<p class="tv-q">Grading…</p>';
        // The server grades; for practice we can't know, so practice shows "submitted".
        const key = ctx.data.answers; // only sent for Practice
        if (key) { const right = key.filter((a, k) => answers[k] === a).length; return ctx.finish({ won: !quit && right >= need, answers, score: right, detail: `${right} of ${Q.length} right (needed ${need}).` }); }
        ctx.finish({ won: !quit, answers, detail: quit ? 'You quit.' : `Need ${need} of ${Q.length} right to win.` });
      }
      if (!Q.length) { el.innerHTML = '<p class="tv-q">No questions yet. Check back after a game!</p>'; return; }
      show();
    },
  });
})();
