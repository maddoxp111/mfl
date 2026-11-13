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
//   rsm,         // a run game's saves (3D Blitz only): { snap (the save to continue from, or null), seq, save(json, { seq, live, beacon }) -> Promise<true | false | 'gone'> }
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
    // A finished game's result is never lost to a server update: it is retried for up to 4 minutes, and kept on this device until
    // it lands, so the next Arcade page sends it if this one is closed (within the 3 hours a game stays open).
    const UNSENT = 'mfl-arc-unsent';
    const keep = (x) => { try { if (x) localStorage.setItem(UNSENT, JSON.stringify(x)); else localStorage.removeItem(UNSENT); } catch (e) {} };
    async function sendFinish(id, result, onWait) {
      keep({ id, result, at: Date.now() });
      const t0 = Date.now();
      for (let n = 1; ; n++) {
        try {
          const res = await fetch('/arcade/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result }) });
          if (res.status < 500) { const r = await res.json(); keep(null); return r; } // a real answer (even a refusal): done
        } catch (e) {} // down or restarting (the update page is not JSON either)
        if (Date.now() - t0 > 240e3) return { ok: false, kept: true, error: 'Could not reach the server. Your result is kept on this device and goes in the next time you open the Arcade.' };
        if (onWait) onWait(n);
        await new Promise((ok) => setTimeout(ok, Math.min(15000, 1500 * n)));
      }
    }
    const resent = (async () => { // a result from last time that never arrived
      let u = null; try { u = JSON.parse(localStorage.getItem(UNSENT) || 'null'); } catch (e) {}
      if (!u || !u.id) return;
      if (Date.now() - (u.at || 0) > 3 * 3600e3) { keep(null); return; }
      const r = await sendFinish(u.id, u.result);
      if (!r || r.kept) return;
      const m = $('#arcMsg');
      if (r.ok) { if (m) m.textContent = `Your last game's result is in: ${r.won ? 'a win' : 'a loss'}${r.net ? ` (${r.net > 0 ? '+' : ''}${fmt(r.net)} coins)` : ''}.`; if (r.run && r.run.choice) setTimeout(() => location.reload(), 1500); }
    })();
    window.addEventListener('beforeunload', (e) => { if (open && open.risk) { e.preventDefault(); e.returnValue = ''; } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      body.game = cfg.game;
      // starting a new run ends a run game in progress (anything else leaves it waiting to be continued)
      if (cfg.resume && body.mode && body.mode !== 'coins' && body.mode !== 'practice' && !confirm(`Starting a new run ends your ${cfg.resume.name} game ${cfg.resume.step} in progress (it counts as a loss). Start anyway?`)) return;
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      // a kept result from last time goes in first (starting a game would otherwise count that one as unfinished)
      try { const u = JSON.parse(localStorage.getItem('mfl-arc-unsent') || 'null'); if (u) { $('#arcMsg').textContent = 'Saving your last game\'s result first…'; await resent; const again = JSON.parse(localStorage.getItem('mfl-arc-unsent') || 'null'); if (again) await sendFinish(again.id, again.result); } } catch (e) {}
      let start;
      try {
        const r = await fetch('/arcade/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        start = await r.json();
      } catch (err) { start = { ok: false, error: 'Could not reach the server (' + (err && err.message || 'network') + '). Check your connection and try again.' }; }
      btn.disabled = false;
      if (!start.ok) { $('#arcMsg').textContent = start.error || 'Something went wrong.'; return; }
      $('#arcMsg').textContent = '';
      launch(start);
    });
    const post = async (url, body) => { try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); } catch (err) { return { ok: false, error: 'Could not reach the server (' + (err && err.message || 'network') + ').' }; } };
    const again = `<div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`;
    const balLine = (r) => (r && r.balance != null ? `<p class="muted">Balance: ${fmt(r.balance)} coins${r.balance < 0 ? ' (in debt)' : ''}</p>` : '');
    // 3D Blitz runs: the next game's setup can change before it starts (where, Metcalf's big field and two-hand touch, time of day,
    // weather). It starts from the last game's (run.opts); a run at Metcalf always has the crowd. Picks are remembered like the setup screen's.
    const NX_TOD = [['morning', '🌄', 'Morning'], ['noon', '☀️', 'Noon'], ['sunset', '🌇', 'Sunset'], ['night', '🌙', 'Night']];
    const NX_WX = [['clear', '☀️', 'Sunny'], ['cloudy', '⛅', 'Partly cloudy'], ['overcast', '☁️', 'Overcast'], ['rain', '🌧️', 'Rain'], ['storm', '⛈️', 'Thunder&shy;storm'], ['snow', '❄️', 'Snow'], ['fog', '🌫️', 'Fog']];
    const nxPut = (k, v) => { try { localStorage.setItem('mfl-blitz-' + k, v); } catch (e) {} };
    function runOptsHtml(o) {
      const chip = (n, v, e, t, on) => `<label><input type="radio" name="nx-${n}" value="${v}" ${on ? 'checked' : ''}><span><i>${e}</i><b ${n === 'weather' && v === 'clear' ? 'data-nx-sunny' : ''}>${t}</b></span></label>`;
      const tog = (k, e, t, on, lk) => `<label class="bz-tog ${lk ? 'locked' : ''}"><input type="checkbox" name="nx-${k}" value="1" ${on ? 'checked' : ''} ${lk ? 'disabled' : ''}><span><i>${e}</i><b>${t}</b></span></label>`;
      return `<details class="run-opts" id="runOpts"><summary><span>Next game</span><b data-nx-sum></b><em data-nx-tg>Change</em></summary><div class="run-opts-in">
        <fieldset class="bz-defmode"><legend>Where</legend><div class="bz-chips run-vn">${chip('venue', 'stadium', '🏟️', 'The Stadium', o.venue !== 'metcalf' && o.venue !== 'hancock')}${chip('venue', 'metcalf', '🏫', 'Wildcat Blacktop', o.venue === 'metcalf')}${chip('venue', 'hancock', '🔴', 'Hancock Stadium', o.venue === 'hancock')}</div></fieldset>
        <fieldset class="bz-defmode" data-nx-met><legend>Wildcat Blacktop settings</legend><div class="bz-togs">${tog('crowd', '👥', 'Crowd', true, true)}${tog('big', '📏', 'Big field', o.big)}${tog('touch', '✋', 'Two-hand touch', o.touch)}</div><p class="bz-lock">🔒 A run always has the crowd on.</p></fieldset>
        <fieldset class="bz-defmode"><legend>Time of day</legend><div class="bz-chips run-tod">${NX_TOD.map(([v, e, t]) => chip('tod', v, e, t, o.tod === v)).join('')}</div></fieldset>
        <fieldset class="bz-defmode"><legend>Weather</legend><div class="bz-chips run-wx">${NX_WX.map(([v, e, t]) => chip('weather', v, e, t, o.weather === v)).join('')}</div></fieldset></div></details>`;
    }
    function runOptsRead(o) {
      const val = (n, d) => { const i = o.querySelector(`input[name=nx-${n}]:checked`); return i ? i.value : d; }, on = (k) => { const i = o.querySelector(`input[name=nx-${k}]`); return !!(i && i.checked); };
      const venue = val('venue', 'stadium'), met = venue === 'metcalf';
      return { venue, crowd: met, big: met && on('big'), touch: met && on('touch'), tod: val('tod', met ? 'noon' : 'night'), weather: val('weather', 'clear') };
    }
    function runOptsWire(o) {
      const d = o.querySelector('#runOpts'); if (!d) return;
      const sync = () => {
        const x = runOptsRead(o), clr = x.tod === 'night' ? 'Clear' : 'Sunny', nm = (L, v) => (L.find((r) => r[0] === v) || [])[2] || '';
        o.querySelectorAll('[data-nx-met]').forEach((e) => { e.hidden = x.venue !== 'metcalf'; });
        o.querySelectorAll('[data-nx-sunny]').forEach((e) => { e.textContent = clr; });
        o.querySelector('[data-nx-sum]').textContent = [x.venue === 'metcalf' ? 'Wildcat Blacktop' : x.venue === 'hancock' ? 'Hancock Stadium' : 'The Stadium', x.big ? 'Big field' : '', x.touch ? 'Two-hand touch' : '', nm(NX_TOD, x.tod), x.weather === 'clear' ? clr : nm(NX_WX, x.weather).replace(/\u00ad|&shy;/g, '')].filter(Boolean).join(' · ');
      };
      d.addEventListener('toggle', () => { d.querySelector('[data-nx-tg]').textContent = d.open ? 'Done' : 'Change'; });
      d.addEventListener('change', (e) => {
        const n = e.target && e.target.name ? e.target.name.replace(/^nx-/, '') : '';
        if (n === 'venue' || n === 'tod' || n === 'weather') nxPut(n, e.target.value);
        if (n === 'big' || n === 'touch') { let m = {}; try { m = JSON.parse(localStorage.getItem('mfl-blitz-met') || '{}') || {}; } catch (x) {} m[n] = e.target.checked; nxPut('met', JSON.stringify(m)); }
        sync();
      });
      sync();
    }
    // a won game of a run: cash out, or play one more at the level picked (its multiplier: Legend x1.5, Hall of Fame x2, GOAT x2.5)
    function runChoice(run) {
      const dod = run.mode === 'dod', nx = run.next || {};
      const go = (l) => nx[l] ? `<button type="button" class="btn ghost ${+l === run.main ? 'main' : ''}" data-go="${l}">${+l === run.main ? '<em>Main</em>' : ''}Play on at ${nx[l].levelName} ×${run.factor ? run.factor[l] : ''}: ${fmt(nx[l].cash)}${dod ? `<small>${fmt(nx[l].atRisk)} at risk (${fmt(nx[l].charge)} more now)</small>` : ''}</button>` : '';
      const o = overlay(`<h2>You win!</h2><p>${run.emoji || ''} ${run.name}, game ${run.step}${run.levelName ? ' at ' + run.levelName : ''}.</p><p class="arc-coins up">${fmt(run.cash)}</p>
        <p class="muted">${dod ? `Cash out and ${fmt(run.cash)} goes to your balance, ${fmt(run.cash - run.atRisk)} more than the ${fmt(run.atRisk)} you have at risk.` : 'Cash out now, or play one more.'}</p>
        ${run.opts ? runOptsHtml(run.opts) : ''}<div class="arc-over-b run-b"><button type="button" class="btn" id="runCash">Cash out ${fmt(run.cash)}</button>${(run.order || Object.keys(nx)).map(go).join('')}<button type="button" class="btn ghost later" id="runLater">Continue later<small>Your run stays saved on the 3D Blitz page</small></button></div>`);
      runOptsWire(o);
      const busy = (t) => { o.querySelectorAll('button,input').forEach((b) => { b.disabled = true; }); if (t) o.querySelector('#runCash').textContent = t; };
      o.querySelector('#runLater').addEventListener('click', () => { o.hidden = true; if (document.body.classList.contains('arc-playing')) location.reload(); });
      o.querySelector('#runCash').addEventListener('click', async () => {
        busy('Cashing out…');
        const r = await post('/arcade/run/cashout', { id: run.id });
        if (!r.ok) return overlay(`<h2>Hmm</h2><p class="muted">${r.error || 'Could not cash out.'}</p>${again}`);
        overlay(`<h2>Cashed out</h2><p class="arc-coins up">+${fmt(r.payout)} coins</p><p class="muted">${run.name}: ${run.step} ${run.step === 1 ? 'win' : 'wins in a row'}.${r.atRisk ? ` Net +${fmt(r.net)} after the ${fmt(r.atRisk)} you had at risk.` : ''}</p>${balLine(r)}${again}`);
        document.querySelectorAll('[data-balance]').forEach((n) => { if (r.balance != null) n.textContent = fmt(r.balance); });
      });
      o.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', async () => {
        const nx = run.opts ? runOptsRead(o) : {}; busy();
        const r = await post('/arcade/run/double', { id: run.id, level: +b.getAttribute('data-go'), ...nx });
        if (!r.ok) return overlay(`<h2>Hmm</h2><p class="muted">${r.error || 'Could not start the next game.'}</p>${again}`);
        o.hidden = true;
        launch(r);
      }));
    }
    if (cfg.pending) { const b = document.getElementById('runResume'); if (b) b.addEventListener('click', () => runChoice(cfg.pending)); }
    // a run game left in progress: continue it from its latest save
    if (cfg.resume) {
      const b = document.getElementById('runContinue');
      if (b) b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await post('/arcade/run/resume', { id: cfg.resume.id });
        b.disabled = false;
        if (!r.ok) { $('#arcMsg').textContent = r.error || 'Could not continue the game.'; return; }
        const w = document.getElementById('runCont'); if (w) w.hidden = true;
        launch(r);
      });
    }
    // a run game's save: sent as text so a page going away can send it with a beacon; a refusal of a game that is over is 'gone'
    function sendSave(id, json, o) {
      const body = '{"id":' + JSON.stringify(id) + ',"seq":' + (o.seq | 0) + ',"live":' + JSON.stringify(o.live || null) + ',"snap":' + json + '}';
      if (o.beacon && navigator.sendBeacon) { try { if (navigator.sendBeacon('/arcade/run/save', new Blob([body], { type: 'text/plain' }))) return Promise.resolve(true); } catch (e) {} }
      return fetch('/arcade/run/save', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: !!o.beacon && body.length < 60000 })
        .then((r) => r.json()).then((r) => (r && r.ok ? true : r && r.gone ? 'gone' : false), () => false);
    }
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
        rsm: start.id && start.run && cfg.game === 'blitz3d' ? { snap: start.save ? start.save.snap : null, seq: start.save ? start.save.seq | 0 : 0, save: (json, o) => sendSave(start.id, json, o || {}) } : null,
        async finish(result) {
          if (done) return; done = true;
          sound(result && result.won ? 'win' : 'lose');
          if (!start.id) {
            overlay(`<h2>${result.won ? 'You win!' : result.tie ? "It's a tie" : 'Game over'}</h2>${result.detail ? `<p>${result.detail}</p>` : ''}<p class="muted">Exhibition: just for fun.</p><div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`);
            return;
          }
          overlay('<h2>Checking the result…</h2>');
          const r = await sendFinish(start.id, result, (n) => overlay(`<h2>Saving your result…</h2><p class="muted">The server isn't answering (it may be updating). Still trying${'.'.repeat(1 + (n % 3))} Don't close this page.</p>`));
          if (!r.ok && r.kept) return overlay(`<h2>Result not saved yet</h2><p class="muted">${r.error}</p><div class="arc-over-b"><a class="btn" href="">Try again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`);
          open = null;
          if (r.ok && r.run && r.run.choice) return runChoice(r.run);
          if (r.ok && r.run && r.run.over) {
            const dod = r.run.mode === 'dod';
            return overlay(`<h2>Run over</h2>${result.detail ? `<p>${result.detail}</p>` : ''}<p class="arc-coins down">${dod ? '-' + fmt(r.run.atRisk) + ' coins' : 'Nothing this time'}</p><p class="muted">${r.run.name} ended at game ${r.run.step}.${r.message ? ' ' + r.message : ''}</p>${balLine(r)}${again}`);
          }
          const coins = r.ok ? (r.net > 0 ? `<p class="arc-coins up">+${fmt(r.net)} coins</p>` : r.net < 0 ? `<p class="arc-coins down">${fmt(r.net)} coins</p>` : '') : '';
          overlay(`<h2>${!r.ok ? 'Result not saved' : r.won ? 'You win!' : result.tie ? "It's a tie" : 'You lost'}</h2>${result.detail ? `<p>${result.detail}</p>` : ''}${coins}<p class="muted">${r.ok ? (r.message || '') : (r.error || '')}</p>${r.balance != null ? `<p class="muted">Balance: ${fmt(r.balance)} coins</p>` : ''}<div class="arc-over-b"><a class="btn" href="">Play again</a><a class="btn ghost" href="/arcade">Arcade</a></div>`);
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
