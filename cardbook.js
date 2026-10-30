// The Card Book: every card in the game, which ones you have, and which packs can drop each one.
const cards = require('./cards');

module.exports = function cardbook(app, h) {
  const { esc, icon, layout, pickHead, pickNav } = h;

  // Can this pack drop this card? Mirrors cards.openPack: the pack's pool, rarity boosts and the starter rule.
  function canDrop(P, type, c) {
    if (type === 'starter') return c.variant === 'base';
    if (P.pool && !P.pool(c)) return false;
    if (c.rarity !== 'doh' && P.boost && P.boost[c.rarity] === 0) return false;
    return true;
  }

  app.get('/pickem/cards/book', async (req, res, next) => {
    try {
      const db = h.load(), name = h.currentUser(req);
      const { user, acct } = await h.loadAccount(db, name);
      const own = user ? cards.collection(user) : {};
      const all = cards.catalog(db);
      const types = cards.packTypes(db).map((t) => ({ t, P: cards.packInfo(db, t) }));
      const teams = Object.values(db.teams);
      const q = req.query, show = ['owned', 'missing'].includes(q.show) ? q.show : 'all', team = db.teams[q.team] ? q.team : '';
      const taken = new Set((await h.listDocs('users/')).flatMap((u) => Object.keys(cards.collection(u))).filter((id) => cards.cardInfo(db, id)?.one));

      // Group cards by card type, in the game's variant order.
      const groups = cards.VARIANTS.map((v) => ({ v, list: all.filter((c) => c.variant === v.id) })).filter((g) => g.list.length);
      const totalOwned = all.filter((c) => own[c.id]).length;
      const packName = ({ t, P }) => (P.free ? `${P.name} (free)` : P.name);
      const qs = (o) => '?' + new URLSearchParams(Object.entries({ show, team, ...o }).filter(([, x]) => x && x !== 'all')).toString();

      const body = groups.map(({ v, list }) => {
        const got = list.filter((c) => own[c.id]).length;
        // Packs that can drop this type for every player, and packs that only drop some players' versions.
        const everyone = types.filter((x) => list.every((c) => canDrop(x.P, x.t, c)));
        const some = types.filter((x) => !everyone.includes(x) && list.some((c) => canDrop(x.P, x.t, c)));
        const shown = list.filter((c) => (!team || c.t.id === team) && (show === 'all' || (show === 'owned') === !!own[c.id]));
        if (!shown.length) return '';
        const c0 = list[0], R = cards.RARITIES[c0.rarity];
        return `<details class="card cb-group" ${got || q.type === v.id ? 'open' : ''} id="t-${esc(v.id)}">
          <summary><span class="rar-tag r-${c0.rarity}">${esc(R.name)}</span><b>${esc(v.spec === 'own' ? 'Signature' : v.label)}</b><span class="cb-mult">${c0.mult}×</span>
            <span class="cb-prog"><i style="width:${Math.round((got / list.length) * 100)}%"></i></span><span class="muted sm">${got}/${list.length}</span>${icon('chev')}</summary>
          <div class="cb-packs"><small>Found in</small>${everyone.map((x) => `<a class="cb-pk ${x.P.free ? 'free' : ''}" href="/pickem/packs">${esc(packName(x))}</a>`).join('') || '<span class="muted sm">No pack drops these right now.</span>'}
            ${some.length ? `<span class="muted sm cb-some">Some players also in: ${some.map((x) => esc(x.P.name)).join(', ')}</span>` : ''}
            ${v.one ? `<span class="muted sm cb-some">1 of 1: once someone pulls one, nobody else can.</span>` : ''}
            ${c0.rarity === 'doh' ? `<span class="muted sm cb-some">A 1 in ${cards.DOH_ODDS.toLocaleString('en-US')} shot on every card pulled.</span>` : ''}</div>
          <div class="mgrid">${shown.map((c) => {
            const extra = some.filter((x) => canDrop(x.P, x.t, c)).map((x) => x.P.name);
            const gone = c.one && taken.has(c.id) && !own[c.id];
            return `<div class="mcell ${own[c.id] ? 'owned' : 'missing'}">${h.cardArt(db, c, { small: true, count: own[c.id] })}
              <small class="cb-st ${own[c.id] ? 'have' : ''}">${own[c.id] ? `✓ You have ${own[c.id] > 1 ? own[c.id] : 'it'}` : gone ? 'Already pulled by someone' : extra.length ? `Also: ${esc(extra.join(', '))}` : 'Not yet'}</small></div>`;
          }).join('')}</div></details>`;
      }).join('');

      res.send(layout(req, 'Card Book', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/cards/book', name)}
        <div class="card cb-head"><div><div class="kicker">${icon('star')} Card Book</div><h2>Every card in the MFL</h2>
          <p class="muted">${all.length} cards across ${groups.length} card types. ${user ? `You have <b>${totalOwned}</b> of them.` : '<a href="/pickem/login?next=/pickem/cards/book">Log in</a> to see which ones you have.'} Each section lists the packs that can drop it.</p>
          ${user ? `<div class="cb-prog big"><i style="width:${((totalOwned / all.length) * 100).toFixed(1)}%"></i></div>` : ''}</div></div>
        <div class="cb-filters">
          <div class="seg mini">${[['all', 'All'], ['owned', 'Have'], ['missing', 'Need']].map(([k, n]) => `<a class="${show === k ? 'on' : ''}" href="${qs({ show: k })}">${n}</a>`).join('')}</div>
          <div class="seg mini"><a class="${team ? '' : 'on'}" href="${qs({ team: '' })}">Both teams</a>${teams.map((t) => `<a class="${team === t.id ? 'on' : ''}" href="${qs({ team: t.id })}">${esc(t.name)}</a>`).join('')}</div>
          <select onchange="location.hash=this.value;document.getElementById(this.value.slice(1)).open=true"><option value="">Jump to a card type…</option>${groups.map(({ v }) => `<option value="#t-${esc(v.id)}">${esc(v.spec === 'own' ? 'Signature' : v.label)}</option>`).join('')}</select>
        </div>
        ${body || '<p class="muted">Nothing matches those filters.</p>'}
      </div>`));
    } catch (e) { next(e); }
  });
};
