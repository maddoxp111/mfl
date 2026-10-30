const fs = require('fs');
const path = require('path');
const career = require('./career-engine');

module.exports = function registerCareer(app, h, siteTeams) {
  const { load, getDoc, putDoc, currentUser, userKey, layout } = h;
  const locks = new Map();
  const key = name => 'careers/' + name;
  const json = (res, data, status = 200) => res.status(status).set('Cache-Control', 'no-store').json(data);
  // Serialize account career mutations and reject stale tabs before saving.
  async function locked(name, fn) {
    const previous = locks.get(name) || Promise.resolve();
    const task = previous.catch(() => {}).then(fn);
    locks.set(name, task);
    try { return await task; } finally { if (locks.get(name) === task) locks.delete(name); }
  }
  async function account(req) {
    const name = currentUser(req);
    return name && await getDoc(userKey(name)) ? name : null;
  }
  const inline = name => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8').replace(/<\/script/gi, '<\\/script');
  app.get('/career', async (req, res, next) => {
    try {
      const name = await account(req), state = name ? await getDoc(key(name), { fresh: true }) : null;
      const initial = JSON.stringify({ signedIn: !!name, account: name, teams: siteTeams(load()).map(({ players, ...t }) => t), state: career.view(state) }).replace(/</g, '\\u003c');
      res.set('Cache-Control', 'no-store').send(layout(req, 'MFL Football Career', `<div class="wrap career-page">
        <div class="career-heading"><a href="/arcade/bowl" class="muted sm">← Modern Bowl</a><div class="kicker">Thomas Metcalf School · McLean County</div><h1>MFL Football Career</h1><p>Metcalf Football League. Your school. Your program. Your story.</p></div>
        ${!name ? `<section class="card career-login"><h2>Build your Metcalf legacy</h2><p>Coach either MFL team against middle schools across McLean County. Develop your roster, play a full season, and bring home the County Cup.</p><a class="btn" href="/pickem/login?next=/career">Log in to save your career</a><a class="btn ghost" href="/pickem/signup?next=/career">Create an account</a></section>` : ''}
        <p id="career-error" class="err" role="alert"></p><p id="career-status" role="status" aria-live="polite"></p>
        <div id="career-hub"></div><section id="career-field" hidden></section>
        <p class="muted sm career-note">A fictional MFL school competition featuring the two site teams and McLean County middle schools. School opponent rosters and uniform palettes are created for the game. Program credits belong to this career; your site coins are separate.</p>
      </div><style>${inline('career.css')}</style><script>window.MFL_CAREER=${initial};</script><script>${inline('career.js')}</script>`));
    } catch (err) { next(err); }
  });
  app.get('/api/career', async (req, res, next) => {
    try {
      const name = await account(req);
      if (!name) return json(res, { ok: false, error: 'Log in to save a career.' }, 401);
      json(res, { ok: true, state: career.view(await getDoc(key(name), { fresh: true })) });
    } catch (err) { next(err); }
  });
  app.post('/api/career/:action', async (req, res, next) => {
    try {
      if (!req.is('application/json')) return json(res, { ok: false, error: 'Send a JSON career action.' }, 415);
      const name = await account(req);
      if (!name) return json(res, { ok: false, error: 'Log in again to continue your career.' }, 401);
      await locked(name, async () => {
        let state = await getDoc(key(name), { fresh: true });
        if (Number(req.body.revision) !== (state?.revision || 0)) return json(res, { ok: false, error: 'Your career changed in another tab. Reload to use the latest save.', state: career.view(state) }, 409);
        const action = req.params.action;
        let match;
        try {
          if (action === 'new') {
            if (state) throw new Error('Your career already exists. Continue it from the season hub.');
            state = career.start(siteTeams(load()), String(req.body.team), Number(req.body.level), req.body.coach, name);
          } else {
            if (!state) throw new Error('Choose your MFL team to begin.');
            if (action === 'play') match = career.play(state);
            else if (action === 'finish') career.finish(state, req.body);
            else if (action === 'watch') career.watch(state);
            else if (action === 'forfeit') {
              if (!state.pending || req.body.id !== state.pending.id) throw new Error('There is no active matchup to forfeit.');
              career.finish(state, { id: state.pending.id, token: state.pending.token, score: 0, opp: 21 });
            } else career.manage(state, action, req.body);
          }
        } catch (err) { return json(res, { ok: false, error: err.message }, 400); }
        state.revision++;
        await putDoc(key(name), state);
        json(res, { ok: true, state: career.view(state), ...(match ? { match } : {}) });
      });
    } catch (err) { next(err); }
  });
};
