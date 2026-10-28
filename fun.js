// Pages for the fun stuff: MFL Cards (collection, packs, Starting 8) and Survivor.
// `h` is the bag of helpers from server.js (layout, auth, storage, formatting).
const cards = require('./cards');
const sv = require('./survivor');
const crypto = require('crypto');

module.exports = function fun(app, h) {
  const { esc, icon, logo, avatar, pts, layout, pickHead, pickNav, pk, TZ } = h;
  const R = cards.RARITIES;

  // ---------- card artwork ----------
  function cardArt(db, c, opts = {}) {
    const rt = h.ratingOf(db, c.t, c.p);
    const spec = c.spec ? cards.SPECIALTIES[c.spec] : null;
    return `<div class="mcard r-${c.rarity} ${opts.cls || ''}" data-id="${esc(c.id)}" data-pid="${esc(c.pid)}" style="--c:${esc(c.t.color)};--c2:${esc(c.t.color2)}">
      <div class="mc-glow"></div><div class="mc-shine"></div>
      <div class="mc-top"><span class="mc-rt">${rt}</span><span class="mc-mult">${c.mult}×</span>${logo(c.t, 22)}</div>
      <div class="mc-photo">${avatar(c.t, c.p, opts.small ? 74 : 104, 'xl')}</div>
      <div class="mc-name">${esc(c.p.name)}</div>
      <div class="mc-var">${spec ? `${esc(spec.name)}` : esc(c.label)}</div>
      ${spec ? `<div class="mc-spec">${esc(spec.desc)}</div>` : ''}
      <div class="mc-foot"><span class="mc-rar">${esc(c.rarityName)}</span>${opts.count > 1 ? `<span class="mc-count">×${opts.count}</span>` : ''}</div>
    </div>`;
  }
  h.cardArt = cardArt;

  const needLogin = (req, res, title, what) => res.send(layout(req, title, pickHead(null, null) + `<div class="wrap">${pickNav(req.path, null)}<div class="card empty-pick">${icon('star')}<h2>Log in to ${what}</h2><p class="muted">Pick'em accounts are free. You get a free Starter Pack too.</p><p><a class="btn" href="/pickem/signup">Sign up</a> <a class="btn ghost" href="/pickem/login?next=${esc(req.path)}">Log in</a></p></div></div>`));
  const flash = (req) => {
    const m = { lineup: 'Starting 8 saved ✓', sold: 'Card sold ✓', poor: 'Not enough Points for that.', used: 'Already claimed.', bad: 'Something was off with that request.', joined: "You're in! Make your pick.", picked: 'Pick saved ✓', locked: 'Picks are locked for this game.' }[req.query.m];
    return m ? `<div class="toast ${/Not|Already|off|locked/.test(m) ? 'bad' : ''}">${m}</div>` : '';
  };
  const freshUser = async (name) => h.getDoc(h.userKey(name), { fresh: true });

  // ---------- My Cards + Starting 8 ----------
  app.get('/pickem/cards', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return needLogin(req, res, 'Cards', 'collect MFL Cards');
      const { user, acct } = await h.loadAccount(db, name);
      const own = cards.collection(user);
      const all = cards.catalog(db);
      const view = req.query.view === 'all' ? 'all' : 'mine';
      const g = pk.nextGame(db, TZ);
      const latest = (user.lineups || []).at(-1);
      const lineup = (latest?.cards || []).filter((id) => own[id]);
      const fan = acct.points.fan;
      const last = fan.results.at(-1);
      const sortKey = (c) => -cards.RARITY_ORDER.indexOf(c.rarity) * 1000 - h.ratingOf(db, c.t, c.p);
      const mine = all.filter((c) => own[c.id]).sort((a, b) => sortKey(a) - sortKey(b));
      const uniq = mine.length, total = Object.values(own).reduce((s, n) => s + n, 0);
      const slot = (id) => { const c = id && cards.cardInfo(db, id); return c ? cardArt(db, c, { small: true }) : '<div class="slot-empty">+</div>'; };
      const body = `
        <div class="stats-row">${[['Points', pts(acct.points.balance)], ['Cards', `${total}`], ['Collected', `${uniq} / ${all.length}`], ['Starting 8 points', `${acct.points.fantasy.toLocaleString('en-US')}`]].map(([k, v]) => `<div class="card"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
        ${total ? '' : `<a class="card promo" href="/pickem/packs"><div>${icon('star')}</div><div><b>Open your free Starter Pack</b><span>8 cards: a full Starting 8 to score points every game.</span></div>${icon('arrow')}</a>`}
        <section class="card lineup-card">
          <div class="card-h"><h2>Starting 8</h2><span class="muted sm">${g ? `Plays in ${esc(h.matchName(db, g))} · ${esc(h.shortDate(g.date))} · locks ${h.time12(pk.lockTime(g))}` : 'No game scheduled'}</span></div>
          <p class="muted sm">Pick 8 cards of different players. Every game they play, your cards score fantasy points × their multiplier, and those become Points (the same Points as Pick'em). Your lineup carries over to the next game until you change it. Tap a card below to add or remove it.</p>
          <form method="post" action="/pickem/lineup" id="lineupForm"><input type="hidden" name="cards" id="lineupInput" value="${esc(lineup.join(','))}">
            <div class="slots" id="slots">${Array.from({ length: cards.LINEUP_SIZE }, (_, i) => `<div class="slot">${slot(lineup[i])}</div>`).join('')}</div>
            <div class="lineup-bar"><span id="lineupMsg" class="muted sm">${lineup.length}/${cards.LINEUP_SIZE} picked</span><button type="button" class="btn ghost sm" id="autoBtn">Auto-pick best</button><button class="btn sm">Save Starting 8</button></div>
          </form>
        </section>
        ${last ? `<section class="card"><div class="card-h"><h2>Last game: ${last.total} points</h2><span class="muted sm">${esc(h.matchName(db, last.g))} · ${esc(h.shortDate(last.g.date))}</span></div>
          <div class="fan-rows">${last.cards.sort((a, b) => b.pts - a.pts).map((x) => `<div class="fan-row"><span class="th">${avatar(x.c.t, x.c.p, 30)} <b>${esc(x.c.p.name)}</b> <small class="muted">${esc(x.c.label)} · ${x.c.mult}×</small></span><span class="muted sm">${x.played ? x.parts.map((q) => `${q.n} ${cards.SCORING_LABEL[q.k].toLowerCase()}${q.n > 1 ? 's' : ''}`).join(', ') || 'no stats' : 'did not play'}</span><b class="${x.pts > 0 ? 'up' : x.pts < 0 ? 'down' : ''}">${x.pts > 0 ? '+' : ''}${x.pts}</b></div>`).join('')}</div>
          ${fan.results.length > 1 ? `<p class="muted sm">Earlier: ${fan.results.slice(0, -1).reverse().slice(0, 6).map((r) => `${esc(h.shortDate(r.g.date))} ${r.total} pts`).join(' · ')}</p>` : ''}</section>` : ''}
        <section class="card">
          <div class="card-h"><h2>${view === 'all' ? 'Every card' : 'My collection'}</h2><div class="seg mini"><a class="${view === 'mine' ? 'on' : ''}" href="/pickem/cards">Mine</a><a class="${view === 'all' ? 'on' : ''}" href="/pickem/cards?view=all">All cards</a></div></div>
          ${view === 'all' ? `<p class="muted sm">${all.length} cards: every player has Base, Silver, Gold, Specialist, Legend and a Mythic 1/1. Drop odds per card: ${cards.RARITY_ORDER.map((r) => `${R[r].name} ${(R[r].weight / Object.values(R).reduce((s, x) => s + x.weight, 0) * 100).toFixed(R[r].weight < 100 ? 2 : 0)}%`).join(' · ')}.</p>` : ''}
          <div class="mgrid" id="coll">${(view === 'all' ? [...all].sort((a, b) => sortKey(a) - sortKey(b)) : mine).map((c) => {
            const n = own[c.id] || 0;
            const sell = view === 'mine' && n > 1 ? `<form method="post" action="/pickem/cards/sell" class="sell"><input type="hidden" name="card" value="${esc(c.id)}"><button class="btn ghost sm" onclick="event.stopPropagation()">Sell 1 extra · +${R[c.rarity].sell} pts</button></form>` : '';
            return `<div class="mcell ${n ? 'owned' : 'missing'}">${cardArt(db, c, { small: true, count: n, cls: n ? 'pickable' : '' })}${sell}</div>`;
          }).join('') || '<p class="muted">No cards yet. <a href="/pickem/packs">Open a pack →</a></p>'}</div>
        </section>
        <script>(()=>{
          const max=${cards.LINEUP_SIZE},inp=document.getElementById('lineupInput'),slots=document.getElementById('slots'),msg=document.getElementById('lineupMsg');
          let ids=inp.value?inp.value.split(','):[];
          const art=(id)=>{const el=document.querySelector('#coll .mcard[data-id="'+id+'"]');return el?el.outerHTML:'';};
          const pidOf=(id)=>id.split(':')[0];
          const draw=()=>{inp.value=ids.join(',');[...slots.children].forEach((s,i)=>{s.innerHTML=ids[i]?art(ids[i]):'<div class="slot-empty">+</div>';});msg.textContent=ids.length+'/'+max+' picked';
            document.querySelectorAll('#coll .mcard.pickable').forEach(c=>c.classList.toggle('in',ids.includes(c.dataset.id)));};
          document.getElementById('coll').addEventListener('click',e=>{const c=e.target.closest('.mcard.pickable');if(!c)return;const id=c.dataset.id;
            if(ids.includes(id))ids=ids.filter(x=>x!==id);
            else{ids=ids.filter(x=>pidOf(x)!==c.dataset.pid);if(ids.length>=max){msg.textContent='Your Starting 8 is full. Tap a card in it to remove it first.';return;}ids.push(id);}draw();});
          slots.addEventListener('click',e=>{const c=e.target.closest('.mcard');if(!c)return;ids=ids.filter(x=>x!==c.dataset.id);draw();});
          document.getElementById('autoBtn').onclick=()=>{const best={};document.querySelectorAll('#coll .mcard.pickable').forEach(c=>{const s=+c.querySelector('.mc-rt').textContent*parseFloat(c.querySelector('.mc-mult').textContent);if(!best[c.dataset.pid]||best[c.dataset.pid].s<s)best[c.dataset.pid]={id:c.dataset.id,s};});ids=Object.values(best).sort((a,b)=>b.s-a.s).slice(0,max).map(x=>x.id);draw();};
          draw();})();</script>`;
      res.send(layout(req, 'My Cards', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/cards', name)}${flash(req)}${body}</div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/lineup', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/cards');
    const db = h.load();
    const user = await freshUser(name);
    const own = cards.collection(user);
    const ids = [...new Set(String(req.body.cards || '').split(',').filter(Boolean))].slice(0, cards.LINEUP_SIZE);
    const pids = new Set();
    for (const id of ids) {
      const c = cards.cardInfo(db, id);
      if (!c || !own[id] || pids.has(c.pid)) return res.redirect('/pickem/cards?m=bad');
      pids.add(c.pid);
    }
    (user.lineups = user.lineups || []).push({ at: new Date().toISOString(), local: pk.nowLocal(TZ), cards: ids });
    if (user.lineups.length > 400) user.lineups = user.lineups.slice(-400);
    await h.putDoc(h.userKey(name), user);
    res.redirect('/pickem/cards?m=lineup');
  });

  app.post('/pickem/cards/sell', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/cards');
    const db = h.load();
    const user = await freshUser(name);
    const id = String(req.body.card || '');
    const c = cards.cardInfo(db, id);
    if (!c || (cards.collection(user)[id] || 0) < 2) return res.redirect('/pickem/cards?m=bad');
    (user.sold = user.sold || []).push(id);
    (user.pointBonuses = user.pointBonuses || []).push({ amount: R[c.rarity].sell, reason: 'Sold ' + id, at: new Date().toISOString() });
    await h.putDoc(h.userKey(name), user);
    res.redirect('/pickem/cards?m=sold');
  });

  // ---------- packs ----------
  const localDay = () => pk.nowLocal(TZ).slice(0, 10);
  async function prizeWeeks(db, name, user) {
    const won = h.weeklyWinners(await h.leaderboard(db)).filter((w) => w.name === name).map((w) => w.week);
    const claimed = new Set((user.packs || []).filter((p) => p.type === 'prize').map((p) => p.week));
    return won.filter((w) => !claimed.has(w));
  }
  async function bigPulls(db) {
    const users = await h.listDocs('users/');
    return users.flatMap((u) => (u.packs || []).flatMap((p) => p.cards.map((id) => ({ u: u.name, id, at: p.at })))).filter((x) => ['legendary', 'mythic'].includes(cards.cardInfo(db, x.id)?.rarity)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }

  app.get('/pickem/packs', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return needLogin(req, res, 'Packs', 'open packs');
      const { user, acct } = await h.loadAccount(db, name);
      const packs = user.packs || [];
      const starterDone = packs.some((p) => p.type === 'starter');
      const dailyDone = packs.some((p) => p.type === 'daily' && p.local?.slice(0, 10) === localDay());
      const prize = await prizeWeeks(db, name, user);
      const pulls = await bigPulls(db);
      const bal = acct.points.balance;
      const shop = [
        !starterDone && ['starter', 'Free'],
        ...prize.map((w) => ['prize', 'Free', w]),
        ['daily', dailyDone ? 'Come back tomorrow' : 'Free'],
        ['standard', `${cards.PACKS.standard.cost} pts`],
        ['premium', `${cards.PACKS.premium.cost} pts`],
      ].filter(Boolean);
      res.send(layout(req, 'Packs', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/packs', name)}${flash(req)}
        <div class="packs">${shop.map(([type, price, week]) => {
          const P = cards.PACKS[type], can = type === 'daily' ? !dailyDone : (P.cost <= bal);
          return `<form method="post" action="/pickem/packs/open" class="pack pk-${type}"><input type="hidden" name="type" value="${type}">${week ? `<input type="hidden" name="week" value="${esc(week)}">` : ''}
            <div class="pack-art"><span>MFL</span><b>${esc(P.name.replace(' Pack', ''))}</b><i>${P.cards} card${P.cards > 1 ? 's' : ''}</i></div>
            <div class="pack-info"><b>${esc(P.name)}</b><small>${esc(week ? `Picker of the Week prize · week of ${h.shortDate(week)}` : P.desc)}</small></div>
            <button class="btn ${can ? '' : 'ghost'}" ${can ? '' : 'disabled'}>${can ? `Open · ${esc(price)}` : esc(type === 'daily' ? price : `Need ${P.cost} pts`)}</button></form>`;
        }).join('')}</div>
        <div class="home-grid"><div class="col"><div class="card"><div class="card-h"><h2>How Points work</h2></div><ul class="how">
          <li>You have ${pts(bal)} Points (${acct.points.earned.toLocaleString('en-US')} earned, ${acct.points.spent.toLocaleString('en-US')} spent).</li>
          <li>Earn Points by winning picks, from your Starting 8 every game, by winning Survivor (${sv.PRIZE} pts) and by selling extra cards.</li>
          <li>Rarities: ${cards.RARITY_ORDER.map((r) => `<b>${R[r].name}</b> ${R[r].mult}×`).join(' · ')}. Specialist cards score ${cards.SPECIAL_BOOST}× on their specialty.</li>
          <li>Mythic 1/1 cards drop about once in every ${Math.round(Object.values(R).reduce((s, x) => s + x.weight, 0) / R.mythic.weight).toLocaleString('en-US')} cards. Good luck.</li></ul></div></div>
        <div class="col"><div class="card"><div class="card-h"><h2>${icon('fire')} Big pulls</h2></div>${pulls.length ? `<ol class="lb">${pulls.map((x) => { const c = cards.cardInfo(db, x.id); return `<li><b>@${esc(x.u)}</b><small>${esc(c.p.name)} · ${esc(c.label)}</small><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span></li>`; }).join('')}</ol>` : '<p class="muted">No Legend or Mythic pulls yet. Be the first.</p>'}</div></div></div>
      </div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/packs/open', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
    const db = h.load();
    const type = String(req.body.type || '');
    const P = cards.PACKS[type];
    if (!P) return res.redirect('/pickem/packs?m=bad');
    const user = await freshUser(name);
    const packs = (user.packs = user.packs || []);
    let week = null;
    if (type === 'starter' && packs.some((p) => p.type === 'starter')) return res.redirect('/pickem/packs?m=used');
    if (type === 'daily' && packs.some((p) => p.type === 'daily' && p.local?.slice(0, 10) === localDay())) return res.redirect('/pickem/packs?m=used');
    if (type === 'prize') {
      week = String(req.body.week || '');
      if (!(await prizeWeeks(db, name, user)).includes(week)) return res.redirect('/pickem/packs?m=used');
    }
    if (P.cost) {
      const acct = pk.account(db, user);
      const bal = h.pointsOf(db, user, acct, await h.survivorNow(db)).balance;
      if (bal < P.cost) return res.redirect('/pickem/packs?m=poor');
    }
    const pack = { id: crypto.randomBytes(6).toString('hex'), type, cost: P.cost, at: new Date().toISOString(), local: pk.nowLocal(TZ), cards: cards.openPack(db, type), ...(week ? { week } : {}) };
    packs.push(pack);
    // A first pack also sets a Starting 8 if there isn't one yet.
    if (type === 'starter' && !(user.lineups || []).length) (user.lineups = []).push({ at: pack.at, local: pack.local, cards: pack.cards.slice(0, cards.LINEUP_SIZE) });
    await h.putDoc(h.userKey(name), user);
    res.redirect(`/pickem/packs/${pack.id}`);
  });

  app.get('/pickem/packs/:id', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
      const { user, acct } = await h.loadAccount(db, name);
      const pack = (user.packs || []).find((p) => p.id === req.params.id);
      if (!pack) return res.redirect('/pickem/packs');
      const cs = pack.cards.map((id) => cards.cardInfo(db, id)).filter(Boolean);
      const best = cs.reduce((m, c) => Math.max(m, cards.RARITY_ORDER.indexOf(c.rarity)), 0);
      res.send(layout(req, 'Pack', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/packs', name)}
        <div class="reveal-head"><h2>${esc(cards.PACKS[pack.type].name)}</h2><p class="muted">Tap each card to flip it.</p><button class="btn ghost sm" id="flipAll">Flip all</button></div>
        <div class="reveal best-${cards.RARITY_ORDER[best]}">${cs.map((c, i) => `<div class="flip r-${c.rarity}" style="--d:${i * 90}ms"><div class="flip-in"><div class="flip-back"><span>MFL</span></div><div class="flip-front">${cardArt(db, c)}</div></div></div>`).join('')}</div>
        <p class="reveal-go center" hidden><a class="btn" href="/pickem/cards">Go to my cards</a> <a class="btn ghost" href="/pickem/packs">Open another</a></p>
        <script>(()=>{const fl=[...document.querySelectorAll('.flip')],go=document.querySelector('.reveal-go');const done=()=>{if(fl.every(f=>f.classList.contains('on')))go.hidden=false;};
          fl.forEach(f=>f.onclick=()=>{f.classList.add('on');done();});document.getElementById('flipAll').onclick=()=>{fl.forEach((f,i)=>setTimeout(()=>{f.classList.add('on');done();},i*180));};})();</script>
      </div>`));
    } catch (e) { next(e); }
  });

  // ---------- Survivor ----------
  app.get('/pickem/survivor', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      const { user, acct } = await h.loadAccount(db, name);
      const users = await h.listDocs('users/');
      const st = sv.survivorState(db, users, TZ);
      const r = st.round;
      const me = name ? users.find((u) => u.name === name) : null;
      const entry = me?.survivor?.[r.n];
      const alive = r.active ? r.alive.includes(name) : !!entry?.joined;
      const used = new Set(Object.values(entry?.picks || {}));
      const g = r.pickGame;
      const myPick = g && entry?.picks?.[g.id];
      const canJoin = name && !entry?.joined && !r.active;
      const pfor = (pid) => { const w = cards.findPlayer(db, pid); return w ? `${avatar(w.t, w.p, 24)} ${esc(w.p.name)}` : '–'; };
      const resTxt = { safe: '✅', miss: '❌', nopick: '⛔ no pick', out: '🟡 out (safe)' };
      const players = g ? [g.home, g.away].flatMap((tid) => db.teams[tid].roster.map((p) => ({ t: db.teams[tid], p }))) : [];
      res.send(layout(req, 'Survivor', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/survivor', name)}${flash(req)}
        <section class="card sv-hero"><div><span class="kicker">Survivor · Round ${r.n}</span><h2>${r.active ? `${r.alive.length} still alive` : `${r.entrants.length} entered`}</h2>
          <p class="muted">Each game, pick one player who has to score a touchdown. If he doesn't, you're out. You can't use the same player twice in a round. If everyone misses the same game, nobody is out. Last one standing wins <b>${sv.PRIZE} Points</b>. A player ruled out doesn't knock you out.</p></div>
          ${canJoin ? `<form method="post" action="/pickem/survivor/join"><button class="btn">Join Round ${r.n}</button></form>` : !name ? '<a class="btn" href="/pickem/login?next=/pickem/survivor">Log in to play</a>' : r.active && !alive ? '<span class="badge">You\'re out this round</span>' : alive ? `<span class="badge final">You're in</span>` : ''}
        </section>
        ${alive && g ? `<section class="card"><div class="card-h"><h2>Your pick: ${esc(h.matchName(db, g))}</h2><span class="muted sm">${esc(h.shortDate(g.date))} · locks ${h.time12(pk.lockTime(g))}</span></div>
          <form method="post" action="/pickem/survivor/pick"><input type="hidden" name="game" value="${esc(g.id)}"><div class="sv-grid">${players.map(({ t, p }) => {
            const off = used.has(p.id) && myPick !== p.id, out = pk.isOut(g, t.id, p.id);
            return `<label class="sv-p ${off || out ? 'off' : ''}"><input type="radio" name="pid" value="${esc(p.id)}" ${myPick === p.id ? 'checked' : ''} ${off || out ? 'disabled' : ''}><span>${avatar(t, p, 30)}<b>${esc(p.name)}</b><small>${off ? 'used' : out ? 'out' : esc(t.abbr)}</small></span></label>`;
          }).join('')}</div><p><button class="btn">Save pick</button></p></form></section>` : ''}
        <div class="home-grid"><div class="col">
          <section class="card"><div class="card-h"><h2>Round ${r.n} board</h2></div>
            ${r.history.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="l">Player</th>${r.history.map((x) => `<th>${esc(h.shortDate(x.g.date))}</th>`).join('')}</tr></thead><tbody>
              ${[...new Set(r.history.flatMap((x) => Object.keys(x.results)))].map((n) => `<tr><td class="l"><b>@${esc(n)}</b>${r.alive.includes(n) ? ' <span class="up">alive</span>' : ''}</td>${r.history.map((x) => { const q = x.results[n]; return `<td>${q ? `${q.pid ? pfor(q.pid) + ' ' : ''}${resTxt[q.res]}` : ''}</td>`; }).join('')}</tr>`).join('')}
            </tbody></table></div>` : `<p class="muted">${r.active ? 'First game hasn\'t been played yet.' : 'The round starts at the next game with at least 2 players in.'}</p>`}
            ${g && (r.active ? r.alive : r.entrants).length ? `<p class="muted sm">Picked for ${esc(h.shortDate(g.date))}: ${(r.active ? r.alive : r.entrants).map((n) => { const u = users.find((x) => x.name === n); return `@${esc(n)} ${u?.survivor?.[r.n]?.picks?.[g.id] ? '✓' : '…'}`; }).join(' · ')} (picks are revealed when the game locks)</p>` : ''}
          </section></div>
          <div class="col"><section class="card"><div class="card-h"><h2>${icon('trophy')} Champions</h2></div>${st.finished.length ? `<ol class="lb">${[...st.finished].reverse().map((f) => `<li><b>Round ${f.n}</b><small>${f.winner ? `@${esc(f.winner)}` : 'No winner'}</small><span class="muted sm">${esc(h.shortDate(f.endGame.date))}</span></li>`).join('')}</ol>` : '<p class="muted">No champions yet.</p>'}</section></div></div>
      </div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/survivor/join', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/survivor');
    const db = h.load();
    const st = sv.survivorState(db, await h.listDocs('users/'), TZ);
    if (st.round.active) return res.redirect('/pickem/survivor?m=locked');
    if (!db.survivor) { db.survivor = { start: st.round.pickGame?.id || null }; await h.save(); }
    const user = await freshUser(name);
    user.survivor = user.survivor || {};
    if (!user.survivor[st.round.n]) user.survivor[st.round.n] = { joined: pk.nowLocal(TZ), picks: {} };
    await h.putDoc(h.userKey(name), user);
    res.redirect('/pickem/survivor?m=joined');
  });

  app.post('/pickem/survivor/pick', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/survivor');
    const db = h.load();
    const st = sv.survivorState(db, await h.listDocs('users/'), TZ);
    const r = st.round, g = r.pickGame;
    if (!g || String(req.body.game) !== g.id) return res.redirect('/pickem/survivor?m=locked');
    const user = await freshUser(name);
    const entry = user.survivor?.[r.n];
    const alive = r.active ? r.alive.includes(name) : !!entry?.joined;
    const pid = String(req.body.pid || '');
    const team = sv.teamOf(db, pid);
    const usedElsewhere = Object.entries(entry?.picks || {}).some(([gid, p]) => p === pid && gid !== g.id);
    if (!alive || !team || ![g.home, g.away].includes(team) || usedElsewhere || pk.isOut(g, team, pid)) return res.redirect('/pickem/survivor?m=bad');
    entry.picks[g.id] = pid;
    await h.putDoc(h.userKey(name), user);
    res.redirect('/pickem/survivor?m=picked');
  });
};
