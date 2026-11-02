const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const career = require('./career-engine');
const saves = require('./career-saves');

module.exports = function registerCareer(app, h, siteTeams) {
  const { load, getDoc, putDoc, currentUser, userKey, layout, esc } = h;
  const GAMES = () => require('./arcade').GAMES;
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const locks = new Map(), key = name => 'careers/' + name;
  const json = (res, data, status = 200) => res.status(status).set('Cache-Control', 'no-store').json(data);
  async function locked(name, fn) {
    const task = (locks.get(name) || Promise.resolve()).catch(() => {}).then(fn);
    locks.set(name, task);
    try { return await task; } finally { if (locks.get(name) === task) locks.delete(name); }
  }
  async function account(req) {
    const name = currentUser(req);
    return name && await getDoc(userKey(name)) ? name : null;
  }
  async function read(name, client) {
    const raw = await getDoc(key(name), { fresh: true }), doc = saves.normalize(raw, name);
    const changed = saves.settle(doc, client);
    if (changed || (raw && raw.version !== 2)) await putDoc(key(name), doc);
    return doc;
  }
  // The user's card Lineup (arcade.js provides it). Dynamic Lineup careers read it at game time.
  const lineupOf = (db, user) => { try { return (user && h.careerLineup && h.careerLineup(db, user)?.players) || null; } catch { return null; } };
  async function userLineup(name) { return lineupOf(load(), await getDoc(userKey(name), { fresh: true })); }
  function syncSaves(doc, lineup) {
    let changed = false;
    for (const s of doc.saves) if (s.dynamic && !s.pending) { try { changed = career.syncLineup(s, lineup) || changed; } catch {} }
    return changed;
  }
  // Coins paid for career wins (arcade matches started with the career flag).
  const careerCoins = (user, game) => (user?.arcade || []).filter(m => m.career && m.game === game && m.status === 'won').reduce((n, m) => n + (m.payout || 0) - (m.stake || 0), 0);
  // /api/m/finish asks this before paying a Modern Bowl career match: the win must
  // match the result recorded through this career's own token flow.
  h.careerResult = async (name, m) => {
    if (m.game !== 'bowl') return null;
    const doc = saves.normalize(await getDoc(key(name), { fresh: true }), name);
    for (const s of doc.saves) for (const round of s.rounds) for (const g of round.games) if (g.arcade === m.id) {
      const home = g.home === s.teamId, us = home ? g.score : g.opp, them = home ? g.opp : g.score;
      return { won: !g.forfeit && us > them, note: g.forfeit ? 'That career game was forfeited.' : us > them ? '' : 'Your career recorded that game as a loss.' };
    }
    return { won: false, note: 'Save the career result before claiming coins.' };
  };
  const inline = name => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8').replace(/<\/script/gi, '<\\/script');
  const styles = () => inline('career.css').replace('MFL_PIXEL_FONT', 'data:font/woff2;base64,' + fs.readFileSync(path.join(__dirname, 'public/fonts/mfl-pixel.woff2')).toString('base64'));
  // ---------- /career: the hub for both careers ----------
  app.get('/career', async (req, res, next) => {
    try {
      const name = await account(req), db = load();
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      const bowlDoc = name ? saves.normalize(await getDoc(key(name)), name) : null;
      const blitzDoc = name ? (await getDoc('blitzfranchise/' + name)) || { slots: {} } : null;
      const G = GAMES(), lineup = lineupOf(db, user), range = g => `${fmt(G[g].prizes[0])} to ${fmt(G[g].prizes[3])}`;
      const rec = (w, l, t) => `${w}–${l}${t ? '–' + t : ''}`;
      const bowlSnap = bowlDoc && saves.snapshot(bowlDoc), bowlSel = bowlSnap && bowlSnap.saves.find(s => s.id === bowlSnap.selected);
      const blitzSlots = blitzDoc ? Object.values(blitzDoc.slots || {}).filter(x => x && x.meta) : [];
      const blitzLast = blitzSlots.slice().sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))[0];
      const progress = (game, used, max, line) => !name ? '<p class="ch-prog">Log in to save careers to your account and earn coins for wins.</p>'
        : `<ul class="ch-prog"><li><b>${used}</b> of ${max} save slots used</li>${line ? `<li>${line}</li>` : ''}<li class="ch-coins">+${fmt(careerCoins(user, game))} coins from career wins</li></ul>`;
      const tile = (game, href, cls, art, title, pitch, prog) => `<a class="ch-tile ${cls}" href="${href}"><span class="ch-art" aria-hidden="true">${art}</span>
        <span class="ch-name">${title}</span><span class="ch-pitch">${pitch}</span>${prog}
        <span class="ch-foot"><span class="ch-pay">Wins pay ${range(game)} coins</span><span class="btn">Play →</span></span></a>`;
      res.set('Cache-Control', 'no-store').send(layout(req, 'Career', `<div class="wrap ch-page">
        <div class="ch-head"><div class="kicker">MFL Career</div><h1>Pick your career</h1>
          <p class="muted">Run a program for whole seasons. Every career win pays the same coins as Play for coins at your career's difficulty: Rookie, Pro, All-Pro or Legend.${name && !career.lineupPlayers(lineup) ? ' Set a full Lineup on the <a href="/pickem/cards">Cards page</a> to unlock Dynamic Lineup careers.' : ''}</p></div>
        <div class="ch-grid">
          ${tile('bowl', '/career/bowl', 'ch-bowl', '🏈', 'Modern Bowl Career', 'Coach a Metcalf team through a McLean County season of retro football and bring home the County Cup.',
            progress('bowl', bowlSnap ? bowlSnap.saves.length : 0, saves.MAX_SAVES, bowlSel && `${esc(bowlSel.name)} · ${esc(bowlSel.team)} · ${rec(bowlSel.w, bowlSel.l, bowlSel.t)}`))}
          ${tile('blitz3d', '/career/blitz', 'ch-blitz', '🏟️', '3D Blitz Career', 'Build a 3D Blitz program in a 12-team league: play every game in 3D, recruit, upgrade and win the Blitz Bowl.',
            progress('blitz3d', blitzSlots.length, 3, blitzLast && `${esc(blitzLast.meta.name || blitzLast.meta.team || 'Career')} · Season ${esc(blitzLast.meta.season || 1)} · ${esc(blitzLast.meta.record || '0-0')}`))}
        </div></div><style>${inline('career-hub.css')}</style>`));
    } catch (err) { next(err); }
  });
  app.get('/career/bowl', async (req, res, next) => {
    try {
      const name = await account(req), user = name ? await getDoc(userKey(name), { fresh: true }) : null, lineup = lineupOf(load(), user);
      // A new document is a refresh, return, or takeover. No unfinished game
      // from the previous document can be resumed, even if pagehide was lost.
      // Dynamic Lineup saves pick up Lineup changes made since the last visit.
      const doc = name ? await locked(name, async () => { const d = await read(name, null); if (syncSaves(d, lineup)) await putDoc(key(name), d); return d; }) : saves.normalize(null, '');
      const initial = JSON.stringify({ signedIn: !!name, client: crypto.randomBytes(16).toString('hex'),
        teams: siteTeams(load()).map(({ players, ...t }) => t), prizes: GAMES().bowl.prizes, lineup: !!career.lineupPlayers(lineup), coins: careerCoins(user, 'bowl'),
        ...saves.snapshot(doc) }).replace(/</g, '\\u003c');
      res.set('Cache-Control', 'no-store').send(layout(req, 'Modern Bowl Career', `<div class="wrap career-page">
        <div class="career-heading"><a href="/arcade/bowl">← Modern Bowl</a><span>THOMAS METCALF SCHOOL · McLEAN COUNTY</span></div>
        ${!name ? `<section class="career-login"><h1>MFL Football Career</h1><p>Build your Metcalf legacy. Coach either MFL team, develop your roster and bring home the County Cup.</p><a class="pixel-button" href="/pickem/login?next=/career/bowl">Log in to save your career</a><a class="pixel-button" href="/pickem/signup?next=/career/bowl">Create an account</a></section>` : ''}
        <p id="career-error" class="err" role="alert"></p><p id="career-status" role="status" aria-live="polite"></p>
        <div id="career-hub"></div><section id="career-field" hidden></section>
        <p class="career-note">A fictional MFL competition featuring local middle schools. Leaving or refreshing during a game is a 0–21 loss. Program credits stay in your career; every win you play also pays site coins at your career's difficulty (${GAMES().bowl.prizes.map(fmt).join(' / ')}).</p>
      </div><style>${styles()}</style><script>window.MFL_CAREER=${initial};</script><script>${inline('career.js')}</script>`, { ticker: false }));
    } catch (err) { next(err); }
  });
  app.get('/api/career', async (req, res, next) => {
    try {
      const name = await account(req);
      if (!name) return json(res, { ok: false, error: 'Log in to save a career.' }, 401);
      await locked(name, async () => json(res, { ok: true, ...saves.snapshot(await read(name, req.query.client || null)) }));
    } catch (err) { next(err); }
  });
  app.post('/api/career/:action', async (req, res, next) => {
    try {
      if (!req.is('application/json')) return json(res, { ok: false, error: 'Send a JSON career action.' }, 415);
      const name = await account(req);
      if (!name) return json(res, { ok: false, error: 'Log in again to continue your career.' }, 401);
      await locked(name, async () => {
        const action = req.params.action;
        // Lifecycle forfeits use the exact game token instead of a revision:
        // delayed beacons must never forfeit a later game or a different slot.
        const raw = await getDoc(key(name), { fresh: true }), doc = saves.normalize(raw, name);
        let state = doc.saves.find(s => s.saveId === (req.body.save || doc.selected)), match;
        if (action === 'abandon') {
          if (state?.pending?.id === req.body.id && state.pending.token === req.body.token) {
            career.forfeit(state); doc.revision++; await putDoc(key(name), doc);
          }
          return json(res, { ok: true, ...saves.snapshot(doc) });
        }
        const takeover = ['new', 'select', 'delete'].includes(action);
        if (saves.settle(doc, takeover ? null : req.body.client || null)) await putDoc(key(name), doc);
        if (Number(req.body.revision) !== doc.revision) return json(res, { ok: false, error: 'Your saves changed in another tab. The latest save has been loaded.', ...saves.snapshot(doc) }, 409);
        try {
          if (action === 'new') {
            saves.settle(doc); state = saves.create(doc, siteTeams(load()), req.body, req.body.dynamic ? await userLineup(name) : null);
          } else {
            if (!state) throw new Error('Choose a career save first.');
            if (action === 'select') { saves.settle(doc); doc.selected = state.saveId; }
            else if (action === 'delete') {
              doc.saves = doc.saves.filter(s => s.saveId !== state.saveId);
              if (doc.selected === state.saveId) doc.selected = doc.saves[0]?.saveId || null;
            } else if (action === 'play') {
              if (!req.body.client) throw new Error('Reload the career page before playing.');
              if (state.dynamic && !state.pending) career.syncLineup(state, await userLineup(name));
              // The arcade match (started with the career flag) pays coins when this game is won.
              const arcade = req.body.arcade ? String(req.body.arcade) : null;
              if (arcade) {
                const m = ((await getDoc(userKey(name), { fresh: true }))?.arcade || []).find(x => x.id === arcade);
                const used = doc.saves.some(s => s.pending?.arcade === arcade || s.rounds.some(r => r.games.some(g => g.arcade === arcade)));
                if (!m || !m.career || m.game !== 'bowl' || m.status !== 'open' || m.level !== state.level || used) throw new Error('That coin game could not be linked. Press play again.');
              }
              match = career.play(state); match.client = req.body.client; if (arcade) match.arcade = arcade;
            } else if (action === 'finish') career.finish(state, req.body);
            else if (action === 'watch') career.watch(state);
            else career.manage(state, action, req.body);
          }
        } catch (err) { return json(res, { ok: false, error: err.message, ...saves.snapshot(doc) }, 400); }
        doc.revision++;
        await putDoc(key(name), doc);
        json(res, { ok: true, ...saves.snapshot(doc), ...(match ? { match } : {}) });
      });
    } catch (err) { next(err); }
  });
};
