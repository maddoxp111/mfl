// MFL Arcade harness: every game registers here and gets the same ctx.
//
//   MFLArcade.register('chess', { start(ctx) { ... ctx.finish({ won: true, moves }) } });
//
// ctx = {
//   root,        // empty <div> the game draws into (it owns everything inside)
//   game,        // game id
//   level,       // 0..3  (Rookie, Pro, All-Pro, Legend)
//   levelName,
//   seed,        // match seed string (from the server)
//   rng,         // seeded random() for this match
//   data,        // game-specific data from the server (rosters, trivia questions...)
//   exhibition,  // true = just for fun, no coins
//   risk,        // true = Risk mode
//   run,         // a Double or Nothing / Double or Double run: { id, mode, name, step, cash, atRisk, next } (3D Blitz only)
//   finish(result),  // call once: { won: bool, score?, detail?, moves?, stats? }
//   sound(name),     // 'tap' | 'good' | 'bad' | 'win' | 'lose' | 'whistle' | 'kick' | 'catch'
// }
(function () {
  // Same generator as engines.js, so the server can replay seeded AI choices.
  function rng(seed) {
    let h = 2166136261 >>> 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let actx = null;
  function sound(name) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = {
        tap: [[660, 0.04]], good: [[660, 0.07], [880, 0.09]], bad: [[220, 0.12], [160, 0.16]],
        win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.22]], lose: [[392, 0.14], [330, 0.14], [262, 0.3]],
        whistle: [[1800, 0.08], [1600, 0.18]], kick: [[140, 0.08]], catch: [[520, 0.05], [700, 0.06]],
      }[name] || [[440, 0.05]];
      let t = actx.currentTime;
      for (const [f, d] of seq) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = name === 'kick' ? 'triangle' : 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
        t += d * 0.9;
      }
    } catch {}
  }

  const A = (window.MFLArcade = { games: {}, rng, sound, register(id, g) { this.games[id] = g; } });

  const $ = (s) => document.querySelector(s);
  const fmt = (n) => Number(n).toLocaleString('en-US');

  function overlay(html) {
    let o = $('#arcOverlay');
    if (!o) { o = document.createElement('div'); o.id = 'arcOverlay'; o.className = 'arc-over'; document.body.appendChild(o); }
    o.innerHTML = `<div class="arc-over-in">${html}</div>`;
    o.hidden = false;
    return o;
  }

  // Start a match (or an exhibition) from the setup form, then hand off to the game.
  A.boot = function () {
    const cfg = window.MFL_ARCADE;
    const form = $('#arcSetup');
    if (!cfg || !form) return;
    let open = null; // a coin match that's running: leaving the page forfeits it
    window.addEventListener('beforeunload', (e) => { if (open && open.risk) { e.preventDefault(); e.returnValue = ''; } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      body.game = cfg.game;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      let start;
      try {
        const r = await fetch('/api/m/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        start = await r.json();
      } catch (err) { start = { ok: false, error: 'Could not reach the server (' + (err && err.message || 'network') + '). Your network may be blocking it.' }; }
      btn.disabled = false;
      if (!start.ok) { $('#arcMsg').textContent = start.error || 'Something went wrong.'; return; }
      $('#arcMsg').textContent = '';
      launch(start);
    });
    const post = async (url, body) => { try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); } catch (err) { return { ok: false, error: 'Could not reach the server (' + (err && err.message || 'network') + ').' }; } };
    const again = `<div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`;
    const balLine = (r) => (r && r.balance != null ? `<p class="muted">Balance: ${fmt(r.balance)} coins${r.balance < 0 ? ' (in debt)' : ''}</p>` : '');
    // a won game of a run: cash out, or double and play the next game right away
    function runChoice(run) {
      const dod = run.mode === 'dod';
      const o = overlay(`<h2>You win!</h2><p>${run.emoji || ''} ${run.name}, game ${run.step}.</p><p class="arc-coins up">${fmt(run.cash)}</p>
        <p class="muted">${dod ? `${fmt(run.atRisk)} at risk right now. Cash out and you net +${fmt(run.cash - run.atRisk)}.` : 'Cash out now, or play one more for double.'}</p>
        <div class="arc-over-b run-b"><button type="button" class="btn" id="runCash">Cash out ${fmt(run.cash)}</button><button type="button" class="btn ghost" id="runDouble">Double: play for ${fmt(run.next.cash)}${dod ? `<small>${fmt(run.next.atRisk)} at risk (${fmt(run.next.charge)} more now)</small>` : ''}</button></div>
        <p class="muted sm"><a href="#" id="runLater">Decide later</a></p>`);
      const busy = (t) => { o.querySelectorAll('button').forEach((b) => { b.disabled = true; }); if (t) o.querySelector('#runCash').textContent = t; };
      o.querySelector('#runLater').addEventListener('click', (e) => { e.preventDefault(); o.hidden = true; if (document.body.classList.contains('arc-playing')) location.reload(); });
      o.querySelector('#runCash').addEventListener('click', async () => {
        busy('Cashing out…');
        const r = await post('/arcade/run/cashout', { id: run.id });
        if (!r.ok) return overlay(`<h2>Hmm</h2><p class="muted">${r.error || 'Could not cash out.'}</p>${again}`);
        overlay(`<h2>Cashed out</h2><p class="arc-coins up">+${fmt(r.net)} coins</p><p class="muted">${run.name}: ${run.step} ${run.step === 1 ? 'win' : 'wins in a row'}.</p>${balLine(r)}${again}`);
        document.querySelectorAll('[data-balance]').forEach((n) => { if (r.balance != null) n.textContent = fmt(r.balance); });
      });
      o.querySelector('#runDouble').addEventListener('click', async () => {
        busy();
        const r = await post('/arcade/run/double', { id: run.id });
        if (!r.ok) return overlay(`<h2>Hmm</h2><p class="muted">${r.error || 'Could not start the next game.'}</p>${again}`);
        o.hidden = true;
        launch(r);
      });
    }
    if (cfg.pending) { const b = document.getElementById('runResume'); if (b) b.addEventListener('click', () => runChoice(cfg.pending)); }
    function launch(start) {
      const game = A.games[cfg.game];
      if (!game) { $('#arcMsg').textContent = 'Game failed to load. Refresh and try again.'; return; }
      const level = Number(start.level || 0);
      open = start.id ? { id: start.id, risk: !!start.risk || !!(start.run && start.stake) } : null;
      document.body.classList.add('arc-playing');
      const stage = $('#arcStage');
      stage.hidden = false;
      form.closest('.arc-setup').hidden = true;
      stage.innerHTML = '<div class="arc-root"></div>';
      const root = stage.querySelector('.arc-root');
      // bring the game into view right away (a smooth scroll gets cancelled on phones when the game resizes the page), then once more after it has sized itself
      const toGame = () => { try { window.scrollTo(0, Math.max(0, stage.getBoundingClientRect().top + window.scrollY - 70)); } catch (e) {} };
      toGame(); setTimeout(toGame, 60); setTimeout(toGame, 400);
      let done = false;
      const ctx = {
        root, game: cfg.game, level, levelName: start.levelName, seed: start.seed, rng: rng(start.seed), data: start.data || {},
        exhibition: !start.id, risk: !!start.risk, run: start.run || null, sound,
        async finish(result) {
          if (done) return; done = true;
          sound(result && result.won ? 'win' : 'lose');
          if (!start.id) {
            overlay(`<h2>${result.won ? 'You win!' : result.tie ? "It's a tie" : 'Game over'}</h2>${result.detail ? `<p>${result.detail}</p>` : ''}<p class="muted">Exhibition: just for fun.</p><div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`);
            return;
          }
          overlay('<h2>Checking the result…</h2>');
          let r;
          try {
            const res = await fetch('/api/m/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: start.id, result }) });
            r = await res.json();
          } catch { r = { ok: false, error: 'Could not reach the server. Your result was not saved.' }; }
          open = null;
          if (r.ok && r.run && r.run.choice) return runChoice(r.run);
          if (r.ok && r.run && r.run.over) {
            const dod = r.run.mode === 'dod';
            return overlay(`<h2>Run over</h2>${result.detail ? `<p>${result.detail}</p>` : ''}<p class="arc-coins down">${dod ? '-' + fmt(r.run.atRisk) + ' coins' : 'Nothing this time'}</p><p class="muted">${r.run.name} ended at game ${r.run.step}.${r.message ? ' ' + r.message : ''}</p>${balLine(r)}${again}`);
          }
          const coins = r.ok ? (r.net > 0 ? `<p class="arc-coins up">+${fmt(r.net)} coins</p>` : r.net < 0 ? `<p class="arc-coins down">${fmt(r.net)} coins</p>` : '') : '';
          overlay(`<h2>${r.won ? 'You win!' : result.tie ? "It's a tie" : 'You lost'}</h2>${result.detail ? `<p>${result.detail}</p>` : ''}${coins}<p class="muted">${r.ok ? (r.message || '') : (r.error || '')}</p>${r.balance != null ? `<p class="muted">Balance: ${fmt(r.balance)} coins</p>` : ''}<div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`);
          document.querySelectorAll('[data-balance]').forEach((n) => { if (r.balance != null) n.textContent = fmt(r.balance); });
        },
      };
      try { game.start(ctx); } catch (err) { console.error(err); overlay(`<h2>Game crashed</h2><p class="muted">${String(err.message || err)}</p><div class="arc-over-b"><a class="btn" href="">Reload</a></div>`); }
    }
  };
  // Show script errors on the page instead of failing silently.
  window.addEventListener('error', (e) => { const m = document.getElementById('arcMsg'); if (m && !document.body.classList.contains('arc-playing')) m.textContent = 'Error: ' + (e.message || 'script failed'); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => A.boot()); else setTimeout(() => A.boot());
})();
