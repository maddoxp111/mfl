// Card trading between Pick'em accounts, public collections and the collectors leaderboard.
// Trades live in docs "cardtrades/<id>". A completed trade adds the cards to the receiver's
// `tradeIn` and the sender's `tradeOut`, which cards.collection() counts.
const crypto = require('crypto');
const cards = require('./cards');

// How much each rarity counts toward a collection's score.
const SCORE = { common: 1, rare: 3, epic: 10, legendary: 40, mythic: 150, dark: 400, doh: 10000 };
const MAX_CARDS = 10, MAX_OPEN = 5;

module.exports = function trading(app, h) {
  const { esc, icon, layout, pickHead, pickNav, pk } = h;
  const cardArt = (db, c, o) => h.cardArt(db, c, o);

  // One trade at a time, so two accepts can't spend the same card.
  let chain = Promise.resolve();
  const locked = (fn) => (chain = chain.then(fn, fn));

  const userDoc = (name) => (pk.validName(name) ? h.getDoc(h.userKey(name), { fresh: true }) : null);
  const allTrades = async () => (await h.listDocs('cardtrades/')).sort((a, b) => b.at.localeCompare(a.at));
  const flash = (req) => {
    const m = { sent: 'Trade offer sent ✓', accepted: 'Trade done! The cards are yours ✓', declined: 'Trade declined.', cancelled: 'Trade cancelled.', gone: "That trade can't go through: someone no longer has those cards.", bad: 'Something was off with that trade.', many: `You can have ${MAX_OPEN} open offers at a time.` }[req.query.m];
    return m ? `<div class="toast ${/can't|off|can have|declined|cancelled/.test(m) ? 'bad' : ''}">${m}</div>` : '';
  };

  function score(db, own) {
    let s = 0;
    for (const id of Object.keys(own)) { const c = cards.cardInfo(db, id); if (c) s += SCORE[c.rarity] || 0; }
    return s;
  }
  const rank = (c) => cards.RARITY_ORDER.indexOf(c.rarity) * 1000 + h.ratingOf(h.load(), c.t, c.p);
  const sorted = (db, own) => Object.keys(own).map((id) => cards.cardInfo(db, id)).filter(Boolean).sort((a, b) => rank(b) - rank(a));

  // Drop cards the user no longer owns from their current Starting 8.
  function fixLineup(user) {
    const own = cards.collection(user), last = (user.lineups || []).at(-1);
    if (!last || last.cards.every((id) => !id || own[id])) return;
    user.lineups.push({ at: new Date().toISOString(), local: pk.nowLocal(h.TZ), cards: last.cards.map((id) => (id && own[id] ? id : '')) });
  }

  // ---------- collectors leaderboard ----------
  app.get('/pickem/collectors', async (req, res, next) => {
    try {
      const db = h.load(), me = h.currentUser(req);
      const { user, acct } = await h.loadAccount(db, me);
      const rows = (await h.listDocs('users/')).map((u) => { const own = cards.collection(u); return { name: u.name, own, score: score(db, own), n: Object.keys(own).length }; })
        .filter((r) => r.n).sort((a, b) => b.score - a.score || b.n - a.n);
      const total = cards.catalog(db).length;
      res.send(layout(req, 'Top Collectors', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/collectors', me)}
        <div class="card"><div class="card-h"><h2>${icon('trophy')} Top Collectors</h2><span class="muted sm">Collection score</span></div>
          <p class="muted sm">Score counts each different card you own: Base 1, Silver 3, Gold 10, Legend 40, Mythic 150, Dark Matter 400, Big Doh Mi 10,000. Tap anyone to see their cards and offer a trade.</p>
          <ol class="col-lb">${rows.map((r, i) => { const best = sorted(db, r.own).slice(0, 3);
            return `<li class="${r.name === me ? 'me' : ''}"><a href="/pickem/collection/${esc(r.name)}"><span class="col-rk">${i + 1}</span><div class="col-who"><b>@${esc(r.name)}</b><small>${r.n} of ${total} cards · ${best.length ? esc(best[0].rarityName) + ' ' + esc(best[0].p.name) : ''}</small></div>
              <div class="col-best">${best.map((c) => `<span class="col-mini r-${c.rarity}" style="--c:${esc(c.t.color)}" title="${esc(c.p.name + ' · ' + c.label)}">${esc(c.p.name.split(' ').map((x) => x[0]).join(''))}</span>`).join('')}</div><span class="col-sc">${r.score.toLocaleString('en-US')}</span></a></li>`; }).join('') || '<p class="muted">Nobody has cards yet.</p>'}</ol></div>
      </div>`));
    } catch (e) { next(e); }
  });

  // ---------- someone's collection ----------
  app.get('/pickem/collection/:name', async (req, res, next) => {
    try {
      const db = h.load(), me = h.currentUser(req), name = String(req.params.name).toLowerCase();
      const them = await userDoc(name);
      if (!them) return res.status(404).send(layout(req, 'Not Found', h.pageHead('404', 'No collector by that name')));
      const { user, acct } = await h.loadAccount(db, me);
      const own = cards.collection(them), list = sorted(db, own);
      const lineup = new Set(((them.lineups || []).at(-1)?.cards || []).filter((id) => own[id]));
      res.send(layout(req, `@${name}'s cards`, pickHead(user, acct) + `<div class="wrap">${pickNav('', me)}
        <div class="card coll-head"><div><div class="kicker">${icon('star')} Collection</div><h2>@${esc(name)}</h2><p class="muted">${list.length} different cards · score ${score(db, own).toLocaleString('en-US')}</p></div>
          ${me && me !== name ? `<a class="btn" href="/pickem/trade/${esc(name)}">${icon('swap')} Offer a trade</a>` : me === name ? '<a class="btn ghost" href="/pickem/cards">My cards</a>' : `<a class="btn" href="/pickem/login?next=/pickem/collection/${esc(name)}">Log in to trade</a>`}</div>
        ${lineup.size ? `<div class="card"><div class="card-h"><h2>Starting 8</h2></div><div class="mgrid">${[...lineup].map((id) => `<div class="mcell">${cardArt(db, cards.cardInfo(db, id), { small: true })}</div>`).join('')}</div></div>` : ''}
        <div class="card"><div class="card-h"><h2>All cards</h2></div><div class="mgrid">${list.map((c) => `<div class="mcell">${cardArt(db, c, { small: true, count: own[c.id] })}</div>`).join('') || '<p class="muted">No cards yet.</p>'}</div></div>
      </div>`));
    } catch (e) { next(e); }
  });

  // ---------- make an offer ----------
  const picker = (db, own, field, note) => {
    const list = sorted(db, own);
    return list.length ? `<p class="muted sm">${note}</p><div class="mgrid tpick">${list.map((c) => `<label class="mcell tcell"><input type="checkbox" name="${field}" value="${esc(c.id)}">${cardArt(db, c, { small: true, count: own[c.id] })}</label>`).join('')}</div>` : '<p class="muted">No cards.</p>';
  };
  app.get('/pickem/trade/:name', async (req, res, next) => {
    try {
      const db = h.load(), me = h.currentUser(req), name = String(req.params.name).toLowerCase();
      if (!me) return res.redirect(`/pickem/login?next=/pickem/trade/${encodeURIComponent(name)}`);
      const them = await userDoc(name);
      if (!them || name === me) return res.redirect('/pickem/collectors');
      const { user, acct } = await h.loadAccount(db, me);
      res.send(layout(req, 'Offer a trade', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/trades', me)}${flash(req)}
        <form method="post" action="/pickem/trade/${esc(name)}" class="trade-form">
          <div class="card"><div class="card-h"><h2>You give</h2><span class="muted sm" data-cnt="give">0 picked</span></div>${picker(db, cards.collection(user), 'give', `Pick up to ${MAX_CARDS} of your cards.`)}</div>
          <div class="card"><div class="card-h"><h2>You get from @${esc(name)}</h2><span class="muted sm" data-cnt="get">0 picked</span></div>${picker(db, cards.collection(them), 'get', `Pick up to ${MAX_CARDS} of their cards.`)}</div>
          <div class="card trade-send"><label>Message (optional)<input name="note" maxlength="140" placeholder="e.g. Need him for my Starting 8"></label><button class="btn">${icon('swap')} Send offer</button></div>
        </form>
        <script>document.querySelectorAll('.tpick input').forEach(i=>i.addEventListener('change',()=>{const f=i.name,n=document.querySelectorAll('.tpick input[name='+f+']:checked').length;if(n>${MAX_CARDS}){i.checked=false;return}document.querySelector('[data-cnt='+f+']').textContent=n+' picked'}))</script>
      </div>`));
    } catch (e) { next(e); }
  });
  app.post('/pickem/trade/:name', async (req, res, next) => {
    try {
      const db = h.load(), me = h.currentUser(req), name = String(req.params.name).toLowerCase();
      if (!me) return res.redirect('/pickem/login');
      const arr = (v) => [...new Set(v == null ? [] : Array.isArray(v) ? v : [v])].map(String);
      const give = arr(req.body.give), get = arr(req.body.get);
      const [user, them] = await Promise.all([userDoc(me), userDoc(name)]);
      const mine = user && cards.collection(user), theirs = them && cards.collection(them);
      if (!user || !them || name === me || (!give.length && !get.length) || give.length > MAX_CARDS || get.length > MAX_CARDS
        || give.some((id) => !mine[id]) || get.some((id) => !theirs[id])) return res.redirect(`/pickem/trade/${encodeURIComponent(name)}?m=bad`);
      if ((await allTrades()).filter((t) => t.from === me && t.status === 'open').length >= MAX_OPEN) return res.redirect(`/pickem/trade/${encodeURIComponent(name)}?m=many`);
      const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      await h.putDoc('cardtrades/' + id, { id, from: me, to: name, give, get, note: String(req.body.note || '').trim().slice(0, 140), status: 'open', at: new Date().toISOString() });
      res.redirect('/pickem/trades?m=sent');
    } catch (e) { next(e); }
  });

  // ---------- inbox ----------
  const tradeCard = (db, t, me) => {
    const side = (ids, who) => `<div class="tr-side"><small>${who}</small><div class="tr-cards">${ids.map((id) => { const c = cards.cardInfo(db, id); return c ? cardArt(db, c, { small: true }) : ''; }).join('') || '<p class="muted sm">Nothing</p>'}</div></div>`;
    const incoming = t.to === me;
    const act = t.status !== 'open' ? `<span class="tr-st ${t.status}">${{ accepted: 'Done', declined: 'Declined', cancelled: 'Cancelled', failed: 'Fell through' }[t.status]}</span>`
      : incoming ? `<form method="post" action="/pickem/trades/${esc(t.id)}"><button class="btn sm" name="do" value="accept">Accept</button> <button class="btn sm ghost" name="do" value="decline">Decline</button></form>`
        : `<form method="post" action="/pickem/trades/${esc(t.id)}"><button class="btn sm ghost" name="do" value="cancel">Cancel offer</button></form>`;
    return `<div class="card tr ${t.status}"><div class="card-h"><h2>${incoming ? `From <a href="/pickem/collection/${esc(t.from)}">@${esc(t.from)}</a>` : `To <a href="/pickem/collection/${esc(t.to)}">@${esc(t.to)}</a>`}</h2><span class="muted sm">${esc(h.shortDate(t.at.slice(0, 10)))}</span></div>
      ${t.note ? `<p class="tr-note">“${esc(t.note)}”</p>` : ''}
      <div class="tr-grid">${side(incoming ? t.get : t.give, 'You give')}<div class="tr-x">${icon('swap')}</div>${side(incoming ? t.give : t.get, 'You get')}</div><div class="tr-act">${act}</div></div>`;
  };
  app.get('/pickem/trades', async (req, res, next) => {
    try {
      const db = h.load(), me = h.currentUser(req);
      if (!me) return res.redirect('/pickem/login?next=/pickem/trades');
      const { user, acct } = await h.loadAccount(db, me);
      const mine = (await allTrades()).filter((t) => t.from === me || t.to === me);
      const inc = mine.filter((t) => t.status === 'open' && t.to === me), out = mine.filter((t) => t.status === 'open' && t.from === me), past = mine.filter((t) => t.status !== 'open').slice(0, 20);
      res.send(layout(req, 'Trades', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/trades', me)}${flash(req)}
        <div class="card coll-head"><div><div class="kicker">${icon('swap')} Card trades</div><h2>Trade cards with anyone</h2><p class="muted">Find someone on the collectors list, open their cards and offer a trade. They can accept or decline.</p></div><a class="btn" href="/pickem/collectors">${icon('trophy')} Find collectors</a></div>
        <h3 class="tr-h">Offers for you (${inc.length})</h3>${inc.map((t) => tradeCard(db, t, me)).join('') || '<p class="muted">No offers right now.</p>'}
        <h3 class="tr-h">Your offers (${out.length})</h3>${out.map((t) => tradeCard(db, t, me)).join('') || '<p class="muted">You have no open offers.</p>'}
        ${past.length ? `<h3 class="tr-h">History</h3>${past.map((t) => tradeCard(db, t, me)).join('')}` : ''}
      </div>`));
    } catch (e) { next(e); }
  });
  app.post('/pickem/trades/:id', async (req, res, next) => {
    const me = h.currentUser(req);
    if (!me) return res.redirect('/pickem/login?next=/pickem/trades');
    try {
      const m = await locked(async () => {
        const key = 'cardtrades/' + String(req.params.id).replace(/[^a-z0-9]/gi, '');
        const t = await h.getDoc(key, { fresh: true });
        if (!t || t.status !== 'open') return 'bad';
        const done = async (status) => { t.status = status; t.doneAt = new Date().toISOString(); await h.putDoc(key, t); return status; };
        if (req.body.do === 'cancel' && t.from === me) return done('cancelled');
        if (req.body.do === 'decline' && t.to === me) return done('declined');
        if (req.body.do !== 'accept' || t.to !== me) return 'bad';
        const [from, to] = await Promise.all([userDoc(t.from), userDoc(t.to)]);
        const a = from && cards.collection(from), b = to && cards.collection(to);
        if (!a || !b || t.give.some((id) => !a[id]) || t.get.some((id) => !b[id])) { await done('failed'); return 'gone'; }
        (from.tradeOut = from.tradeOut || []).push(...t.give); (to.tradeIn = to.tradeIn || []).push(...t.give);
        (to.tradeOut = to.tradeOut || []).push(...t.get); (from.tradeIn = from.tradeIn || []).push(...t.get);
        fixLineup(from); fixLineup(to);
        await h.putDoc(h.userKey(from.name), from);
        await h.putDoc(h.userKey(to.name), to);
        return done('accepted');
      });
      res.redirect('/pickem/trades?m=' + m);
    } catch (e) { next(e); }
  });
};
