// The season page (/season) and its hero header, which also tops the pack shop and My Cards.
// Everything shown comes from seasons.js (name, cover athlete) and cards.js (the season's cards and packs).
const cards = require('./cards');
const seasons = require('./seasons');

module.exports = function season(app, h) {
  const { esc, layout } = h;
  const fmtN = (n) => Number(n).toLocaleString('en-US');

  // mode 'full' (the season page) or 'mini' (a banner on other pages)
  function seasonHero(mode = 'full') {
    const S = seasons.current(), mini = mode === 'mini';
    const [w1, ...rest] = S.name.split(' ');
    const title = `<span>${esc(w1)}</span> <span>${esc(rest.join(' '))}</span>`;
    return `<section class="s1-hero${mini ? ' mini' : ''}">
      <div class="s1h-bg" aria-hidden="true"><span class="s1h-big">${S.n}</span><span class="s1h-rays"></span></div>
      <div class="s1h-txt">
        <div class="s1h-kick"><b>Season ${S.n}</b><span>MFL Cards</span></div>
        ${mini ? `<div class="s1h-title">${title}</div>` : `<h1 class="s1h-title">${title}</h1>`}
        ${mini ? '' : `<p class="s1h-sub">${esc(S.tag)} New cards for every player, new packs, and a new top rarity: <b>Zenith</b>.</p>`}
        <div class="s1h-cover"><small>Cover athlete</small><b>${esc(S.coverName)}</b><i>#${S.number} · ${esc(S.nick)}</i></div>
        <div class="s1h-cta">${mini
          ? `<a class="btn" href="/season">See Season ${S.n}</a><a class="btn ghost" href="/pickem/packs#g-season">Season ${S.n} packs</a>`
          : `<a class="btn" href="/pickem/packs#g-season">Open Season ${S.n} packs</a><a class="btn ghost" href="#s1-cards">See the cards</a>`}</div>
      </div>
      <img class="s1h-img" src="${esc(S.img)}" alt="${esc(S.coverName)} reaching back for a one-handed catch" width="1049" height="1000">
    </section>`;
  }
  h.seasonHero = seasonHero;

  app.get('/pickem/season', (req, res) => res.redirect('/season'));
  app.get('/season', async (req, res, next) => {
    try {
      const db = h.load(), S = seasons.current();
      const users = await h.listDocs('users/');
      const owner = new Map();
      for (const u of users) for (const [id, n] of Object.entries(cards.collection(u))) if (n > 0 && !owner.has(id)) owner.set(id, u.name);
      const card = (variant) => cards.cardInfo(db, `${S.cover}:${variant}`);
      const art = (c, cls = '') => (c ? h.cardArt(db, c, { cls }) : '');
      const R = cards.RARITIES;
      const S1V = cards.VARIANTS.filter((v) => v.season === S.n);
      const everyone = S1V.filter((v) => !v.only);
      const zen = cards.catalog(db).filter((c) => c.season === S.n && c.rarity === 'zenith');
      const zenLeft = zen.filter((c) => !owner.has(c.id)).length;
      const ones = cards.catalog(db).filter((c) => c.season === S.n && c.one), onesLeft = ones.filter((c) => !owner.has(c.id)).length;
      const nCards = cards.catalog(db).filter((c) => c.season === S.n).length;
      const who = (c) => (!c.one ? '' : owner.has(c.id) ? `<span class="s1-own">Pulled by <a href="/pickem/u/${esc(owner.get(c.id))}">@${esc(owner.get(c.id))}</a></span>` : '<span class="s1-own open">Still out there</span>');
      const packs = cards.packTypes(db).map((t) => [t, cards.packInfo(db, t)]).filter(([, P]) => P.season === S.n).sort((a, b) => a[1].cost - b[1].cost);
      const big = card('s1-bigboy'), cov = card('s1-cover');
      res.send(layout(req, `Season ${S.n}: ${S.name}`, `<div class="wrap s1-page">${seasonHero('full')}
        <section class="s1-sec" id="s1-cover">
          <header class="s1-sh"><span class="s1-k">Cover athlete</span><h2>${esc(S.coverName)}</h2><p>#${S.number} · ${esc(S.nick)}. Two cards in the game are his alone.</p></header>
          <div class="s1-coverrow">
            ${[cov, big].filter(Boolean).map((c) => `<div class="s1-cc">${art(c)}<div class="s1-cap"><b>${esc(c.label)}</b><span><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span> ${c.mult}× points</span>${who(c)}</div></div>`).join('')}
            <div class="s1-coverinfo">
              <p><b>${esc(S.nick)} 1/1</b> is a Zenith card worth ${big ? big.mult : 6}× fantasy points, with every skill maxed and the <b>${esc(big && big.perk ? big.perk.name : 'Big Boy Gravity')}</b> perk: ${esc(big && big.perk ? big.perk.text.charAt(0).toLowerCase() + big.perk.text.slice(1) : '')}.</p>
              <p><b>Cover Athlete</b> is a Mythic card worth ${cov ? cov.mult : 3.5}×, and more than one person can own it.</p>
              <p>Both drop from any Season ${S.n} pack. The <a href="/pickem/packs#pk-s1p-cover">Cover Athlete Pack</a> only has his cards.</p>
            </div>
          </div>
        </section>
        <section class="s1-sec" id="s1-cards">
          <header class="s1-sh"><span class="s1-k">New cards</span><h2>${everyone.length} new cards for every player</h2><p>${fmtN(nCards)} Season ${S.n} cards in all, shown here as ${esc(S.coverName.split(' ')[0])}'s. Each one beats the older cards of its rarity, and they only drop from Season ${S.n} packs.</p></header>
          <div class="mgrid s1-grid">${everyone.map((v) => { const c = card(v.id); return c ? `<div class="mcell">${art(c)}<div class="s1-cap"><b>${esc(v.label)}</b><span><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span> ${c.mult}×${c.perk ? ` · ⚡ ${esc(c.perk.name)}` : ''}</span></div></div>` : ''; }).join('')}</div>
        </section>
        <section class="s1-sec s1-zen" id="s1-zenith">
          <header class="s1-sh"><span class="s1-k">New rarity</span><h2>Zenith</h2><p>The new top of the card game, above Dark Matter.</p></header>
          <ul class="s1-facts">
            <li><b>${R.zenith.mult}×</b><span>fantasy points (${esc(S.nick)} 1/1: ${big ? big.mult : 6}×)</span></li>
            <li><b>Lv 7</b><span>perk level: maxed out, always on</span></li>
            <li><b>${zenLeft}<small>/${zen.length}</small></b><span>Zenith 1/1s still out there</span></li>
            <li><b>${onesLeft}<small>/${ones.length}</small></b><span>Season ${S.n} 1/1s still out there</span></li>
          </ul>
          <p class="muted sm">Every Zenith card is a 1 of 1: once someone pulls one, nobody else can. They only drop from Season ${S.n} packs, and the <a href="/pickem/packs#pk-s1p-fullext">Full Extension Pack</a> is a coin flip for one.</p>
        </section>
        <section class="s1-sec" id="s1-packs">
          <header class="s1-sh"><span class="s1-k">Packs</span><h2>Season ${S.n} packs</h2><p>From a free welcome pack to the best pack in the shop.</p></header>
          <div class="s1-packs">${packs.map(([t, P]) => `<a class="s1-pk" href="/pickem/packs#pk-${esc(t)}"><span class="s1-pk-e" style="--p1:${esc((P.art && P.art.c && P.art.c[0]) || '#38bdf8')}">${esc((P.art && P.art.e) || '🏈')}</span><span class="s1-pk-t"><b>${esc(P.name)}</b><small>${esc(P.desc)}</small></span><span class="s1-pk-c">${P.free ? 'Free' : fmtN(P.cost)}</span></a>`).join('')}</div>
        </section>
      </div>`));
    } catch (e) { next(e); }
  });
};
