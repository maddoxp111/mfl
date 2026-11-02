const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const career = require('./career-engine');
const saves = require('./career-saves');

module.exports = function registerCareer(app, h, siteTeams) {
  const { load, getDoc, putDoc, currentUser, userKey, layout } = h;
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
  const inline = name => fs.readFileSync(path.join(__dirname, 'public', name), 'utf8').replace(/<\/script/gi, '<\\/script');
  const styles = () => inline('career.css').replace('MFL_PIXEL_FONT', 'data:font/woff2;base64,' + fs.readFileSync(path.join(__dirname, 'public/fonts/mfl-pixel.woff2')).toString('base64'));
  app.get('/career', async (req, res, next) => {
    try {
      const name = await account(req);
      // A new document is a refresh, return, or takeover. No unfinished game
      // from the previous document can be resumed, even if pagehide was lost.
      const doc = name ? await locked(name, () => read(name, null)) : saves.normalize(null, '');
      const initial = JSON.stringify({ signedIn: !!name, client: crypto.randomBytes(16).toString('hex'),
        teams: siteTeams(load()).map(({ players, ...t }) => t), ...saves.snapshot(doc) }).replace(/</g, '\\u003c');
      res.set('Cache-Control', 'no-store').send(layout(req, 'MFL Football Career', `<div class="wrap career-page">
        <div class="career-heading"><a href="/arcade/bowl">← Modern Bowl</a><span>THOMAS METCALF SCHOOL · McLEAN COUNTY</span></div>
        ${!name ? `<section class="career-login"><h1>MFL Football Career</h1><p>Build your Metcalf legacy. Coach either MFL team, develop your roster and bring home the County Cup.</p><a class="pixel-button" href="/pickem/login?next=/career">Log in to save your career</a><a class="pixel-button" href="/pickem/signup?next=/career">Create an account</a></section>` : ''}
        <p id="career-error" class="err" role="alert"></p><p id="career-status" role="status" aria-live="polite"></p>
        <div id="career-hub"></div><section id="career-field" hidden></section>
        <p class="career-note">A fictional MFL competition featuring local middle schools. Leaving or refreshing during a game is a 0–21 loss. Career credits are separate from site coins.</p>
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
            saves.settle(doc); state = saves.create(doc, siteTeams(load()), req.body);
          } else {
            if (!state) throw new Error('Choose a career save first.');
            if (action === 'select') { saves.settle(doc); doc.selected = state.saveId; }
            else if (action === 'delete') {
              doc.saves = doc.saves.filter(s => s.saveId !== state.saveId);
              if (doc.selected === state.saveId) doc.selected = doc.saves[0]?.saveId || null;
            } else if (action === 'play') {
              if (!req.body.client) throw new Error('Reload the career page before playing.');
              match = career.play(state); match.client = req.body.client;
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
