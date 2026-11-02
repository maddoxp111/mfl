// Pages for the fun stuff: MFL Cards (collection, packs, Starting 8) and Survivor.
// `h` is the bag of helpers from server.js (layout, auth, storage, formatting).
const cards = require('./cards');
const sv = require('./survivor');
const crypto = require('crypto');

module.exports = function fun(app, h) {
  const { esc, icon, logo, avatar, coins, layout, pickHead, pickNav, pk, TZ } = h;
  const R = cards.RARITIES;
  const POS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL', 'UTIL'];

  // ---------- card artwork ----------
  // How each card type shows the player photo.
  const PHOTO = {
    icon: 'full', allstar: 'full', legend: 'full', mythic: 'full', dark: 'full', clutch: 'full',
    action: 'banner', gold: 'banner', built: 'banner', spooky: 'banner', 'spec-play': 'banner',
    holo: 'fade', silver: 'fade', team: 'fade', doh: 'fade', 'spec-td': 'fade',
    throwback: 'polaroid', trophy: 'polaroid', cutout: 'polaroid', pizza: 'polaroid', upside: 'polaroid',
    pixel: 'tv', glitch: 'tv',
    'spec-pass': 'duo', 'spec-int': 'duo', 'spec-def': 'duo', snow: 'duo',
    spec: 'cut', goat: 'cut',
  };
  function cardArt(db, c, opts = {}) {
    const rt = c.rating || h.ratingOf(db, c.t, c.p);
    const spec = c.spec ? cards.SPECIALTIES[c.spec] : null;
    // Each kind of card (Base, Holo, Gold...) has its own pattern, photo frame and hue; every card of that kind matches.
    // Set cards look like their set (colors, pattern, photo style) with a parallel finish on top.
    const vi = Math.max(0, cards.VARIANTS.findIndex((v) => v.id === c.variant));
    const st = c.set && cards.SET_MAP.get(c.set), si = st ? cards.SETS.indexOf(st) : 0;
    const serial = c.one || c.rarity === 'doh' ? '1/1' : '';
    const look = st ? `setc par-${c.par} ph-${st.photo} pat-${st.pat} fr-${si % 6}` : `v-${c.variant.replace(/^spec-.*/, 'specx')} v-${c.variant} ph-${PHOTO[c.variant] || 'frame'} pat-${vi % 10} fr-${Math.floor(vi / 10) % 6}`;
    return `<div class="mcard r-${c.rarity} ${look} ${opts.cls || ''}" data-id="${esc(c.id)}" data-pid="${esc(c.pid)}" ${opts.fit ? `data-fit="${opts.fit}"` : ''} style="--c:${esc(c.t.color)};--c2:${esc(c.t.color2)};--hue:${(vi * 47) % 360};--ang:${((st ? si : vi) * 53) % 360}deg${st ? `;--s1:${st.c1};--s2:${st.c2}` : ''}">
      <div class="mc-pat"></div><div class="mc-glow"></div><div class="mc-shine"></div>
      <div class="mc-top"><span class="mc-rt">${rt}</span><span class="mc-mult">${c.mult}×</span>${logo(c.t, 22)}</div>
      <div class="mc-photo">${avatar(c.t, c.p, opts.small ? 74 : 104, 'xl')}</div>
      <div class="mc-name">${esc(c.p.name)}</div>
      <div class="mc-var">${spec ? esc((c.variant === 'spec' ? '★ Signature ' : '') + spec.name) : st ? `${st.emoji} ${esc(c.label)}` : esc(c.label)}</div>
      ${spec ? `<div class="mc-spec">${esc(spec.desc)}</div>` : c.quote ? `<div class="mc-spec mc-q">“${esc(c.quote)}”${c.flat ? ` +${c.flat}/game` : ''}</div>` : ''}
      <div class="mc-foot"><span class="mc-rar">${esc(c.rarityName)}</span><span class="mc-ser">${serial}</span>${opts.count > 1 ? `<span class="mc-count">×${opts.count}</span>` : ''}</div>
      <button type="button" class="mc-flip" aria-label="Flip card" aria-pressed="false"></button><div class="mc-back"${opts.back ? ` data-ok="1">${cardBack(db, c)}` : '>'}</div>
    </div>`;
  }
  h.cardArt = cardArt;

  // ---------- card backs ----------
  // Every card flips (CARD_FLIP below) to a back with the full card: who, which card, base
  // ratings with the card's changes, build, in-game effect and fantasy bonus. Backs load on
  // the first flip from /pickem/cards/back (pack results render them inline), so big grids stay light.
  const ATTRS = ['spd', 'agi', 'str', 'sta', 'thr', 'acc', 'cat', 'def', 'kick', 'hgt', 'wgt'];
  const ATTR_NAME = { spd: 'Speed', agi: 'Agility', str: 'Strength', sta: 'Stamina', thr: 'Throwing', acc: 'Accuracy', cat: 'Catching', def: 'Defense', kick: 'Kicking', hgt: 'Height', wgt: 'Weight' };
  const ATTR_RANGE = { hgt: [54, 78], wgt: [70, 250] };
  const BUILD_NAME = { slim: 'Slim', lanky: 'Lanky', normal: 'Normal', stocky: 'Stocky', tank: 'Tank', fat: 'Heavy', stubby: 'Stubby', tall: 'Tall', short: 'Short' };
  const attempt = (fn) => { try { return fn(); } catch { return null; } };
  // Long names (cards.ATTR_LABELS when it exists) for words and tooltips; the card's small table uses ATTR_NAME.
  const attrName = (k) => { const L = cards.ATTR_LABELS && cards.ATTR_LABELS[k]; return typeof L === 'string' ? L : (L && (L.name || L.label)) || ATTR_NAME[k]; };
  const clampAttr = (k, v) => { const [lo, hi] = ATTR_RANGE[k] || [0, 99]; return Math.max(lo, Math.min(hi, Math.round(v))); };
  const fmtAttr = (k, v) => (k === 'hgt' ? `${Math.floor(v / 12)}′${v % 12}″` : k === 'wgt' ? `${v}<small>lb</small>` : String(v));
  // Base ratings: the Arcade's playerAttrs when it exists, else an estimate from rating and tendencies.
  function baseAttrs(db, c) {
    const arc = attempt(() => require('./arcade'));
    if (arc && typeof arc.playerAttrs === 'function') {
      const a = attempt(() => arc.playerAttrs(db, c.t, c.p)) || attempt(() => arc.playerAttrs(db, c.t.id, c.p.id));
      if (a && typeof a === 'object') return { a, est: false };
    }
    const et = pk.effTend(db), ovr = h.ratingOf(db, c.t, c.p);
    const td = et.player(c.t, c.p, 'td'), pass = et.player(c.t, c.p, 'pass'), int = et.player(c.t, c.p, 'int');
    const r = (v) => clampAttr('spd', Math.max(30, v));
    return { a: { spd: r(ovr * 0.7 + td * 0.3), str: r(ovr * 0.9 + 4), thr: r(ovr * 0.55 + pass * 0.45), acc: r(ovr * 0.6 + pass * 0.4), cat: r(ovr * 0.6 + td * 0.4), def: r(ovr * 0.6 + int * 0.4), kick: r(ovr * 0.8 + 8) }, est: true };
  }
  // The in-game effect in words: cards.effectText when it exists, else built from what the card has.
  function effectWords(c, fx) {
    const t = cards.effectText && attempt(() => cards.effectText(c));
    if (t) return esc(t);
    const bits = [];
    const d = fx && fx.attr ? Object.entries(fx.attr).filter(([, v]) => v) : [];
    if (d.length) bits.push(d.map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${attrName(k)}`).join(', '));
    if (fx && fx.build) bits.push(`${BUILD_NAME[fx.build] || fx.build} build`);
    if (c.spec) bits.push(`${cards.SPECIALTIES[c.spec].name}: ${cards.SPECIALTIES[c.spec].desc.toLowerCase()} in fantasy`);
    const st = c.set && cards.SET_MAP.get(c.set);
    if (st) bits.push(`${st.name} set, ${st.seriesName} series`);
    if (c.quote) bits.push(`“${c.quote.replace(/\.$/, '')}”`);
    if (!bits.length) bits.push(c.mult > 1 ? `No tricks: it scores ${c.mult}× in fantasy` : 'A classic card. No tricks');
    return esc(bits.join('. ') + '.');
  }
  function cardBack(db, c) {
    const st = c.set && cards.SET_MAP.get(c.set), par = c.par && cards.PARALLELS.find((x) => x.id === c.par);
    const fx = cards.cardEffects ? attempt(() => cards.cardEffects(c)) : null;
    const { a, est } = baseAttrs(db, c);
    const d = (fx && fx.attr) || {};
    const rows = ATTRS.filter((k) => a[k] != null || d[k]).map((k) => {
      const b = a[k] != null ? Number(a[k]) : null, dv = Math.round(d[k] || 0), v = b != null ? clampAttr(k, b + dv) : null;
      return `<div class="mb-a"><span title="${esc(attrName(k))}">${ATTR_NAME[k] || esc(attrName(k))}</span><i>${b != null ? fmtAttr(k, b) : '–'}</i><em class="${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}">${dv ? (dv > 0 ? '+' : '−') + Math.abs(dv) : ''}</em><b>${v != null ? fmtAttr(k, v) : '–'}</b></div>`;
    }).join('');
    const rt = c.rating || (a.ovr != null ? a.ovr : h.ratingOf(db, c.t, c.p));
    const pos = c.p.position || (cards.packInfo.role ? attempt(() => cards.packInfo.role(db, c.t, c.p)) : '');
    const build = (fx && fx.build) || c.p.look?.build || 'normal';
    const meta = [...(st ? [['Set', `${st.emoji} ${esc(st.name)}`], ['Series', esc(st.seriesName)], ['Parallel', esc(par?.label || 'Base')]] : []),
      ['Overall', esc(rt)], ['Build', esc(BUILD_NAME[build] || build)], ...(c.one || c.rarity === 'doh' ? [['Serial', '1 of 1']] : [])];
    return `<div class="mb"><div class="mb-h">${logo(c.t, 18)}<div><b>${esc(c.p.name)}</b><small>${esc(c.t.name)}${pos ? ' · ' + esc(pos) : ''}${c.p.number ? ' · #' + esc(c.p.number) : ''}</small></div></div>
      <div class="mb-lab"><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span><span>${esc(c.label)}</span></div>
      <dl class="mb-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="mb-attrs"><div class="mb-a mb-ah"><span>${est ? 'Ratings (est.)' : 'Ratings'}</span><i>Base</i><em>Card</em><b>Now</b></div>${rows}</div>
      <p class="mb-fx"><b>In game</b> ${effectWords(c, fx)}</p>
      <p class="mb-fan"><b>Fantasy</b> ${c.mult}× points${c.flat ? ` · +${c.flat} every game` : ''}${c.spec ? ` · ${esc(cards.SPECIALTIES[c.spec].desc)}` : ''}</p></div>`;
  }
  h.cardBack = cardBack;
  app.get('/pickem/cards/back', (req, res) => {
    const db = h.load(), c = cards.cardInfo(db, String(req.query.id || ''));
    if (!c) return res.status(404).send('<p class="mb-wait">Card not found.</p>');
    res.set('Cache-Control', 'private, max-age=120').send(cardBack(db, c));
  });
  // The flip: the ↻ button flips any card; tapping a card flips it too unless tapping it does
  // something else there (lineup picks, trade checkboxes, choose packs, face-down reveals).
  // Added once to every /pickem page that shows a card.
  const CARD_FLIP = `<script id="mcflip-js">(()=>{if(window.__mcFlip)return;window.__mcFlip=1;
    const calm=matchMedia('(prefers-reduced-motion: reduce)');
    const load=(card)=>{const b=card&&card.querySelector(':scope>.mc-back');if(!b||b.dataset.ok)return;b.dataset.ok='1';b.innerHTML='<p class="mb-wait">Loading…</p>';
      fetch('/pickem/cards/back?id='+encodeURIComponent(card.dataset.id)).then((r)=>{if(!r.ok)throw 0;return r.text();}).then((t)=>{b.innerHTML=t;}).catch(()=>{b.dataset.ok='';b.innerHTML='<p class="mb-wait">Could not load. Tap to try again.</p>';});};
    const flip=(card)=>{const on=!card.classList.contains('show-back'),btn=card.querySelector(':scope>.mc-flip'),b=card.querySelector(':scope>.mc-back');if(on)load(card);
      const swap=()=>{card.classList.toggle('show-back',on);if(btn){btn.setAttribute('aria-pressed',on);btn.setAttribute('aria-label',on?'Flip back to the front':'Flip card');}if(b)b.setAttribute('aria-hidden',!on);};
      if(calm.matches)return swap();card.classList.remove('mc-flipping');void card.offsetWidth;card.classList.add('mc-flipping');setTimeout(swap,160);clearTimeout(card._ft);card._ft=setTimeout(()=>card.classList.remove('mc-flipping'),380);};
    const tappable=(card,t)=>!card.classList.contains('pickable')&&!card.closest('label,a,.slot,[data-notap],.flip:not(.on)')&&!t.closest('a,input,select,textarea,button:not(.mc-flip)');
    document.addEventListener('click',(e)=>{const t=e.target;if(!t.closest)return;const card=t.closest('.mcard');if(!card)return;
      if(t.closest('.mc-flip')||(card.classList.contains('show-back')&&t.closest('.mc-back'))||tappable(card,t)){e.preventDefault();e.stopPropagation();flip(card);}},true);
    document.addEventListener('pointerover',(e)=>{const b=e.target.closest&&e.target.closest('.mc-flip');if(b)load(b.closest('.mcard'));},{passive:true});
    document.addEventListener('focusin',(e)=>{if(e.target.classList&&e.target.classList.contains('mc-flip'))load(e.target.closest('.mcard'));});})();</script>`;
  app.use('/pickem', (req, res, next) => {
    const send = res.send.bind(res);
    res.send = (body) => {
      if (typeof body !== 'string' || !body.includes('class="mc-flip"') || body.includes('id="mcflip-js"')) return send(body);
      const at = body.lastIndexOf('</body>');
      return send(at < 0 ? body + CARD_FLIP : body.slice(0, at) + CARD_FLIP + body.slice(at));
    };
    next();
  });

  const needLogin = (req, res, title, what) => res.send(layout(req, title, pickHead(null, null, /^\/pickem\/(cards|packs)/.test(req.path) ? 'cards' : '') + `<div class="wrap">${pickNav(req.path, null)}<div class="card empty-pick">${icon('star')}<h2>Log in to ${what}</h2><p class="muted">Pick'em accounts are free. You get a free Starter Pack too.</p><p><a class="btn" href="/pickem/signup">Sign up</a> <a class="btn ghost" href="/pickem/login?next=${esc(req.path)}">Log in</a></p></div></div>`));
  const flash = (req) => {
    const m = { lineup: 'Starting 8 saved ✓', sold: 'Card sold ✓', poor: 'Not enough coins for that.', used: 'Already claimed.', bad: 'Something was off with that request.', joined: "You're in! Make your pick.", picked: 'Pick saved ✓', locked: 'Picks are locked for this game.' }[req.query.m];
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
      // Lineup slots are positions: QB, RB, WR1, WR2, WR3, TE, UTIL, UTIL ('' = empty).
      const lineup = Array.from({ length: cards.LINEUP_SIZE }, (_, i) => { const id = (latest?.cards || [])[i]; return id && own[id] ? id : ''; });
      const et = pk.effTend(db);
      // How well a card fits each position (used by auto-pick).
      const fit = (c) => { const r = h.ratingOf(db, c.t, c.p), td = et.player(c.t, c.p, 'td'), ps = et.player(c.t, c.p, 'pass'), m = c.mult;
        return [ps * 0.75 + r * 0.25, td * 0.6 + r * 0.4, td * 0.5 + r * 0.5, r * 0.6 + td * 0.4, r].map((v) => Math.round(v * m)).join(','); };
      const fan = acct.points.fan;
      const last = fan.results.at(-1);
      const sortKey = (c) => -cards.RARITY_ORDER.indexOf(c.rarity) * 1000 - h.ratingOf(db, c.t, c.p);
      const mine = all.filter((c) => own[c.id]).sort((a, b) => sortKey(a) - sortKey(b));
      const uniq = mine.length, total = Object.values(own).reduce((s, n) => s + n, 0);
      const slot = (id) => { const c = id && cards.cardInfo(db, id); return c ? cardArt(db, c, { small: true }) : '<div class="slot-empty">+</div>'; };
      const body = `
        <div class="stats-row">${[['Coins', coins(acct.balance)], ['Cards', `${total}`], ['Collected', `${uniq} / ${all.length}`], ['Won by Starting 8', coins(acct.points.fantasy)]].map(([k, v]) => `<div class="card"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
        ${total ? '' : `<a class="card promo" href="/pickem/packs"><div>${icon('star')}</div><div><b>Open your free Starter Pack</b><span>8 cards: a full Starting 8 that earns coins every game.</span></div>${icon('arrow')}</a>`}
        <section class="card lineup-card">
          <div class="card-h"><h2>Starting 8</h2><span class="muted sm">${g ? `Plays in ${esc(h.matchName(db, g))} · ${esc(h.shortDate(g.date))} · locks ${h.time12(pk.lockTime(g))}` : 'No game scheduled'}</span></div>
          <p class="muted sm">Pick 8 cards of different players, one per position. Positions matter in Modern Bowl (your QB throws, your WRs and TE catch, UTIL blocks and kicks). Every game they play, your cards score fantasy points × their multiplier, and you get that many coins (the same coins as Pick'em). Your lineup carries over to the next game until you change it. Tap a card below to add or remove it.</p>
          <form method="post" action="/pickem/lineup" id="lineupForm"><input type="hidden" name="cards" id="lineupInput" value="${esc(lineup.join(','))}">
            <div class="slots" id="slots">${Array.from({ length: cards.LINEUP_SIZE }, (_, i) => `<div class="slot" data-i="${i}"><span class="slot-pos">${POS[i]}</span><div class="slot-c">${slot(lineup[i])}</div></div>`).join('')}</div>
            <div class="lineup-bar"><span id="lineupMsg" class="muted sm">${lineup.filter(Boolean).length}/${cards.LINEUP_SIZE} picked</span><button type="button" class="btn ghost sm" id="autoBtn">Auto-pick best</button><button class="btn sm">Save Starting 8</button></div>
          </form>
        </section>
        ${last ? `<section class="card"><div class="card-h"><h2>Last game: +${last.total} coins</h2><span class="muted sm">${esc(h.matchName(db, last.g))} · ${esc(h.shortDate(last.g.date))}</span></div>
          <div class="fan-rows">${last.cards.sort((a, b) => b.pts - a.pts).map((x) => `<div class="fan-row"><span class="th">${avatar(x.c.t, x.c.p, 30)} <b>${esc(x.c.p.name)}</b> <small class="muted">${esc(x.c.label)} · ${x.c.mult}×</small></span><span class="muted sm">${x.played ? x.parts.map((q) => `${q.n} ${cards.SCORING_LABEL[q.k].toLowerCase()}${q.n > 1 ? 's' : ''}`).join(', ') || 'no stats' : 'did not play'}</span><b class="${x.pts > 0 ? 'up' : x.pts < 0 ? 'down' : ''}">${x.pts > 0 ? '+' : ''}${x.pts}</b></div>`).join('')}</div>
          ${fan.results.length > 1 ? `<p class="muted sm">Earlier: ${fan.results.slice(0, -1).reverse().slice(0, 6).map((r) => `${esc(h.shortDate(r.g.date))} +${r.total}`).join(' · ')}</p>` : ''}</section>` : ''}
        ${pointsBreakdown(acct)}
        <section class="card">
          <div class="card-h"><h2>${view === 'all' ? 'Every card' : 'My collection'}</h2><div class="seg mini"><a class="${view === 'mine' ? 'on' : ''}" href="/pickem/cards">Mine</a><a class="${view === 'all' ? 'on' : ''}" href="/pickem/cards?view=all">All cards</a></div></div>
          <p class="muted sm"><a href="/pickem/cards/book">${icon('star')} Open the Card Book</a> to see every card, which ones you're missing and which packs drop them.</p>${view === 'all' ? `<p class="muted sm">Showing the ${all.filter((c) => !c.set).length} classic cards. The ${all.filter((c) => c.set).length.toLocaleString('en-US')} card-set cards are in the <a href="/pickem/cards/book?tab=sets">Card Book</a>.</p>` : ''}
          <div class="seg mini rfilter">${['all', ...cards.RARITY_ORDER].map((r) => `<a class="${(req.query.r || 'all') === r ? 'on' : ''}" href="/pickem/cards?${view === 'all' ? 'view=all&' : ''}r=${r}">${r === 'all' ? 'All' : esc(R[r].name)}</a>`).join('')}</div>
          <div class="mgrid" id="coll">${(view === 'all' ? all.filter((c) => !c.set).sort((a, b) => sortKey(a) - sortKey(b)) : mine).filter((c) => !R[req.query.r] || c.rarity === req.query.r || (view === 'mine' && lineup.includes(c.id))).map((c) => {
            const n = own[c.id] || 0;
            const sell = view === 'mine' && n > 1 ? `<form method="post" action="/pickem/cards/sell" class="sell"><input type="hidden" name="card" value="${esc(c.id)}"><button class="btn ghost sm" onclick="event.stopPropagation()">Sell 1 extra · +${R[c.rarity].sell} coins</button></form>` : '';
            return `<div class="mcell ${n ? 'owned' : 'missing'}">${cardArt(db, c, { small: true, count: n, cls: n ? 'pickable' : '', fit: n ? fit(c) : null })}${sell}</div>`;
          }).join('') || '<p class="muted">No cards yet. <a href="/pickem/packs">Open a pack →</a></p>'}</div>
        </section>
        <script>(()=>{
          const max=${cards.LINEUP_SIZE},inp=document.getElementById('lineupInput'),slots=document.getElementById('slots'),msg=document.getElementById('lineupMsg');
          let ids=inp.value.split(',');while(ids.length<max)ids.push('');ids=ids.slice(0,max);let sel=-1;
          const POS=${JSON.stringify(['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL', 'UTIL'])};
          const art=(id)=>{const el=document.querySelector('#coll .mcard[data-id="'+id+'"]');return el?el.outerHTML:'';};
          const pidOf=(id)=>id.split(':')[0];
          const draw=()=>{inp.value=ids.join(',');[...slots.children].forEach((s,i)=>{s.querySelector('.slot-c').innerHTML=ids[i]?art(ids[i]):'<div class="slot-empty">+</div>';s.classList.toggle('sel',i===sel);});msg.textContent=(sel>=0?'Pick a card for '+POS[sel]+' · ':'')+ids.filter(Boolean).length+'/'+max+' picked';
            document.querySelectorAll('#coll .mcard.pickable').forEach(c=>c.classList.toggle('in',ids.includes(c.dataset.id)));};
          document.getElementById('coll').addEventListener('click',e=>{const c=e.target.closest('.mcard.pickable');if(!c)return;const id=c.dataset.id;
            if(ids.includes(id)){ids=ids.map(x=>x===id?'':x);}
            else{ids=ids.map(x=>x&&pidOf(x)===c.dataset.pid?'':x);let i=sel>=0?sel:ids.indexOf('');if(i<0){msg.textContent='Your Starting 8 is full. Tap a position to swap it.';return;}ids[i]=id;sel=-1;}draw();});
          // Tap a position to choose it; tap it again to empty it.
          slots.addEventListener('click',e=>{const s=e.target.closest('.slot');if(!s)return;const i=+s.dataset.i;if(sel===i&&ids[i]){ids[i]='';sel=-1;}else sel=sel===i?-1:i;draw();if(sel>=0)document.getElementById('coll').scrollIntoView({behavior:'smooth',block:'start'});});
          // Auto-pick: fill each position with the best unused player for it.
          document.getElementById('autoBtn').onclick=()=>{const all=[...document.querySelectorAll('#coll .mcard.pickable')].map(c=>({id:c.dataset.id,pid:c.dataset.pid,f:(c.dataset.fit||'0,0,0,0,0').split(',').map(Number)}));
            const used=new Set(),col=[0,1,2,2,2,3,4,4];ids=col.map(k=>{const b=all.filter(x=>!used.has(x.pid)).sort((a,b)=>b.f[k]-a.f[k])[0];if(!b)return'';used.add(b.pid);return b.id;});sel=-1;draw();};
          draw();})();</script>`;
      res.send(layout(req, 'My Cards', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/cards', name)}${flash(req)}${body}</div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/lineup', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/cards');
    const db = h.load();
    const user = await freshUser(name);
    const own = cards.collection(user);
    // One card per position (QB, RB, WR1, WR2, WR3, TE, UTIL, UTIL); '' = empty slot.
    const ids = String(req.body.cards || '').split(',').slice(0, cards.LINEUP_SIZE).map((x) => x.trim());
    while (ids.length < cards.LINEUP_SIZE) ids.push('');
    const pids = new Set();
    for (const id of ids) {
      if (!id) continue;
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
  const weekOf = (day) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  async function prizeWeeks(db, name, user) {
    const won = h.weeklyWinners(await h.leaderboard(db)).filter((w) => w.name === name).map((w) => w.week);
    const claimed = new Set((user.packs || []).filter((p) => p.type === 'prize').map((p) => p.week));
    return won.filter((w) => !claimed.has(w));
  }
  const uniqueCount = (user) => Object.keys(cards.collection(user)).length;
  // Free packs a user can claim right now: [{ type, key, note }]. `key` makes each claim one-time.
  async function freeClaims(db, name, user) {
    const packs = user.packs || [], day = localDay(), wk = weekOf(day);
    const has = (type, key) => packs.some((p) => p.type === type && (key == null || p.key === key));
    const out = [];
    if (!has('starter')) out.push({ type: 'starter', key: 'starter' });
    for (const w of await prizeWeeks(db, name, user)) out.push({ type: 'prize', key: w, note: `Picker of the Week reward · week of ${h.shortDate(w)}` });
    const n = uniqueCount(user);
    for (const step of cards.COLLECTOR_STEPS) if (n >= step && !has('milestone', 'c' + step)) out.push({ type: 'milestone', key: 'c' + step, note: `Collected ${step} different cards` });
    if (!packs.some((p) => p.type === 'daily' && p.local?.slice(0, 10) === day)) out.push({ type: 'daily', key: day });
    if (db.games.some((g) => g.date === day && g.status !== 'postponed') && !has('gameday', day)) out.push({ type: 'gameday', key: day, note: "It's game day!" });
    if (!has('weekly', wk)) out.push({ type: 'weekly', key: wk, note: `Week of ${h.shortDate(wk)}` });
    const arcWins = (user.arcade || []).filter((m) => m.status === 'won' && m.local?.slice(0, 10) === day).length;
    if (arcWins >= 3 && !has('arcade', day)) out.push({ type: 'arcade', key: day, note: 'You won 3 Arcade games today!' });
    return out;
  }
  // 1/1 cards someone already owns.
  async function takenOnes(db, users) {
    users = users || await h.listDocs('users/');
    return new Set(users.flatMap((u) => Object.keys(cards.collection(u))).filter((id) => cards.cardInfo(db, id)?.one));
  }
  async function bigPulls(db, users) {
    users = users || await h.listDocs('users/');
    return users.flatMap((u) => (u.packs || []).flatMap((p) => p.cards.map((id) => ({ u: u.name, id, at: p.at })))).filter((x) => cards.RARITY_ORDER.indexOf(cards.cardInfo(db, x.id)?.rarity) >= 3).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  }
  // HOT: the most-opened paid packs of the last 7 days.
  function hotPacks(users) {
    const since = new Date(Date.now() - 7 * 864e5).toISOString(), n = {};
    for (const u of users) for (const p of u.packs || []) if (p.at >= since && p.cost) n[p.type] = (n[p.type] || 0) + 1;
    return new Set(Object.entries(n).filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t));
  }
  const GROUPS = [
    ['free', 'Free', 'Claim these. They refill.'],
    ['core', 'Core', 'Any card in the league can drop. Bigger packs, better guarantees.'],
    ['theme', 'Themes', 'Positions, teams, hot streaks and specialists.'],
    ['body', 'Body Shop', 'Skinny, heavy, tall, short and everything between. A card\'s build changes how the player looks and plays in the games.'],
    ['sets', 'Sets', `${cards.SETS.length} themed sets with 5 versions of every player. Set cards only come from these packs.`],
    ['fun', 'Fun', 'Weird cards, doubles, shiny stuff and packs where you choose what to keep.'],
    ['chase', 'Chase', 'Expensive. Built for the rarest cards.'],
    ['bundle', 'Bundles', 'Several packs in one, for less than buying them one at a time.'],
    ['limited', 'Limited', 'Only on sale some days, plus a Flash Sale that gets cheaper all day.'],
  ];
  const groupOf = (P) => (P.group === 'team' ? 'theme' : P.group);
  const packCtx = (user) => ({ now: pk.nowLocal(TZ), own: user ? cards.collection(user) : {}, lineup: (user?.lineups || []).at(-1)?.cards || [] });
  const fmtN = (n) => Number(n).toLocaleString('en-US');
  const cardCount = (P) => (P.choose ? `Keep ${P.cards} of ${P.choose}` : P.mystery ? `${P.mystery[0]}–${P.mystery[1]} cards` : `${P.cards} card${P.cards === 1 ? '' : 's'}`);
  const PATS = new Set(['stripes', 'dots', 'grid', 'zig', 'check', 'rays', 'stars', 'waves', 'diamond', 'confetti']);
  // The pack graphic: a foil wrapper drawn in CSS from the pack's `art` (colors, emoji, pattern, foil).
  function packArt(db, P, o = {}) {
    const t = P.team && db.teams[P.team], a = P.art || {};
    const [c1, c2] = t ? [t.color, t.color2] : a.c || P.colors || ['#2a3242', '#141821'];
    const title = o.title || P.name.replace(/^Flash Sale: .*/, 'Flash Sale').replace(/ Pack$/, '');
    return `<div class="pkart pat-${PATS.has(a.pat) ? a.pat : 'stripes'}${a.foil ? ' foil-' + a.foil : ''} ${o.cls || ''}" style="--p1:${esc(c1)};--p2:${esc(c2)}">
      <div class="pk-body" aria-hidden="true"><span class="pk-pat"></span><span class="pk-brand">MFL Cards</span><span class="pk-emo">${t ? logo(t, 44) : esc(a.e || '🏈')}</span><b class="pk-nm">${esc(title)}</b><i class="pk-n">${esc(cardCount(P))}</i><span class="pk-shine"></span></div>${o.badges || ''}</div>`;
  }
  const pct = (x) => (x >= 10 ? Math.round(x) : x >= 1 ? x.toFixed(1) : x >= 0.01 ? x.toFixed(2) : '<0.01') + '%';
  // "What's inside": guarantees, features, per-card rarity odds and the pool.
  function oddsPanel(db, P, odds, ctx) {
    const L = [];
    if (P.bundle) L.push(`Inside: ${P.bundle.map(([t, k]) => { const S = cards.packInfo(db, t, ctx); return `${k > 1 ? k + '× ' : ''}${esc(S.name)} (${S.cards} cards, ${fmtN(S.cost)} coins)`; }).join(' + ')}. Worth ${fmtN(P.list)} coins on their own.`);
    if (P.choose) L.push(`You see ${P.choose} different cards and keep ${P.cards}. The others go back in the box.`);
    if (P.pairs) L.push(`${P.pairs} pairs: each pair is one player in two different cards.`);
    if (P.mystery) L.push(`Anywhere from ${P.mystery[0]} to ${P.mystery[1]} cards.`);
    if (P.floor) L.push(`Every card is ${R[P.floor].name} or better.`);
    if (P.min) L.push(`${(P.mins || 1) > 1 ? P.mins : 'At least one'} ${R[P.min].name} or better guaranteed${P.choose ? ' to choose from' : ''}.`);
    if (P.boost && !P.floor) { const z = cards.RARITY_ORDER.filter((r) => P.boost[r] === 0).map((r) => R[r].name); if (z.length) L.push(`No ${z.join(' or ')} cards.`); }
    if (P.rotate) L.push(P.off ? `Not on sale today. Back ${esc(P.back)}.` : `On sale until ${P.until === 'tonight' ? 'tonight' : esc(P.until)}.`);
    if (P.flash) L.push(`${Math.round(P.discount * 100)}% off the ${fmtN(P.list)} coin price right now. ${P.nextDrop != null ? `Drops another 10% at ${h.time12(String(P.nextDrop).padStart(2, '0') + ':00')}.` : "That's as low as it goes today."} One per day, and a new pack tomorrow.`);
    if (P.free) L.push('Free. It refills on its own schedule.');
    if (P.mixed) L.push('Classic cards and set cards both drop.'); else if (P.sets && !P.bundle) L.push('Set cards only.');
    const bars = odds && odds.odds.length ? `<small class="po-k">Odds for each card${P.min && !P.floor ? ' (before the guarantee)' : ''}</small><div class="po-bars">${odds.odds.map((x) => `<div class="po-r r-${x.r}"><span>${esc(R[x.r].name)}</span><i><u style="width:${Math.max(2, x.pct).toFixed(1)}%"></u></i><b>${pct(x.pct)}</b></div>`).join('')}${odds.doh ? `<div class="po-r r-doh"><span>Big Doh Mi</span><i><u style="width:2%"></u></i><b>1 in ${cards.DOH_ODDS >= 1000 ? fmtN(cards.DOH_ODDS / 1000) + 'k' : fmtN(cards.DOH_ODDS)}</b></div>` : ''}</div>` : '';
    const pool = !odds ? '' : !odds.ok ? 'None of these cards are out yet. Restocking soon.' : `${P.bundle ? 'Drops from up to' : 'Drops from'} ${fmtN(odds.size)} different cards of ${odds.players} player${odds.players === 1 ? '' : 's'}${odds.sets ? ` in ${odds.sets} set${odds.sets > 1 ? 's' : ''}` : ''}.`;
    return `<details class="po"><summary>What's inside</summary><div class="po-in">${L.length ? `<ul>${L.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}${bars}<p class="po-pool">${pool}${P.inside ? ` ${esc(P.inside)}` : ''}</p></div></details>`;
  }
  // Short feature tags under each pack's name.
  function packTags(P) {
    const t = [];
    if (P.floor) t.push(`All ${R[P.floor].name}+`);
    else if (P.min) t.push(`${(P.mins || 1) > 1 ? P.mins + '× ' : ''}${R[P.min].name}+ guaranteed`);
    if (P.choose) t.push('You choose');
    if (P.pairs) t.push(`${P.pairs} pairs`);
    if (P.bundle) t.push(`${P.bundle.length} packs in 1`);
    if (P.mixed) t.push('Classic + sets');
    if (P.flash) t.push('Daily deal');
    if (P.rotate) t.push(P.rotate.days ? P.rotate.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' + ') : P.rotate.months ? 'Seasonal' : 'Every other week');
    return t.map((x) => `<span>${esc(x)}</span>`).join('');
  }
  // One pack in the shop. o: { free, key, note, ctx, bal, hot, i }
  function shopItem(db, type, P, o) {
    const free = !!o.free, cost = free ? 0 : P.cost;
    const odds = cards.packInfo.odds ? attempt(() => cards.packInfo.odds(db, type, o.ctx)) : null;
    const soon = !!odds && !odds.ok && !free, off = !!P.off && !free;
    const can = !soon && !off && (free || cost <= o.bal);
    const isNew = !!P.added && Date.now() - Date.parse(P.added) < 45 * 864e5;
    const sale = !free && P.list > P.cost;
    const badges = [free && ['free', 'Free'], isNew && ['new', 'New'], o.hot && ['hot', 'Hot'], sale && ['sale', `Sale −${Math.round((1 - P.cost / P.list) * 100)}%`], off && ['back', `Back ${P.back}`], soon && ['soon', 'Restocking']].filter(Boolean);
    const btn = free ? 'Open free' : off ? `Back ${esc(P.back)}` : soon ? 'Restocking' : can ? `Open · ${icon('coin')}${fmtN(cost)}` : `Need ${fmtN(cost - o.bal)} more`;
    return { can, html: `<article class="psi${can ? ' can' : ''}${off || soon ? ' off' : ''}" id="pk-${esc(type)}" data-g="${esc(o.g)}" data-cost="${cost}" data-n="${P.choose ? P.cards : P.mystery ? Math.round((P.mystery[0] + P.mystery[1]) / 2) : P.cards}" data-new="${isNew ? 1 : 0}" data-i="${o.i}">
      ${packArt(db, P, { badges: badges.length ? `<span class="pk-badges">${badges.map(([k, v]) => `<b class="pkb-${k}">${esc(v)}</b>`).join('')}</span>` : '' })}
      <div class="psi-b"><div class="psi-h"><h3>${esc(P.name)}</h3><span class="psi-price">${free ? '<b>Free</b>' : `${sale ? `<s>${fmtN(P.list)}</s>` : ''}<b>${icon('coin')}${fmtN(cost)}</b>`}</span></div>
        <p class="psi-d">${esc(o.note || P.desc)}</p>
        <div class="psi-tags"><span>${esc(cardCount(P))}</span>${packTags(P)}</div>
        ${oddsPanel(db, P, odds, o.ctx)}
        <form method="post" action="/pickem/packs/open" class="psi-buy"><input type="hidden" name="type" value="${esc(type)}">${o.key ? `<input type="hidden" name="key" value="${esc(o.key)}">` : ''}<button class="btn${can ? '' : ' ghost'}"${can ? '' : ' disabled'}>${btn}</button></form></div>
    </article>` };
  }
  const packMsg = (req) => {
    const m = { closed: "That pack isn't on sale today.", soon: 'That pack is restocking. Check back soon.', limit: 'One a day. A new deal tomorrow.', kept: 'Kept ✓ It\'s in your collection.', gone: 'Someone just pulled that 1 of 1. Pick another one.', pick: 'Pick the right number of cards to keep.' }[req.query.m];
    return m ? `<div class="toast ${/isn't|restocking|One a day|Someone|right number/.test(m) ? 'bad' : ''}">${m}</div>` : flash(req);
  };
  // Where a user's coins came from: picks and the card game are one currency.
  function pointsBreakdown(acct) {
    const P = acct.points, f = (n) => Math.round(n).toLocaleString('en-US'), sg = (n) => (n >= 0 ? '+' : '−') + f(Math.abs(n));
    const picks = acct.balance - P.net;
    return `<div class="card pts-break"><div class="card-h"><h2>${icon('coin')} Your coins</h2><b class="big">${f(acct.balance)}</b></div>
      <p class="muted sm">Coins are the only currency: the same coins you win in Pick'em are earned by your Starting 8 and spent on packs.</p>
      <div class="pb-rows">
        <div><span>From Pick'em (start + picks)</span><b class="${picks >= 0 ? 'up' : 'down'}">${sg(picks)}</b></div>
        <div><span>Starting 8</span><b class="up">+${f(P.fantasy)}</b></div>
        <div><span>Survivor</span><b class="up">+${f(P.survivor)}</b></div>
        <div><span>Card sales &amp; rewards</span><b class="up">+${f(P.bonus)}</b></div>
        <div><span>Spent on packs</span><b class="down">−${f(P.spent)}</b></div>
        <div class="tot"><span>Balance</span><b>${f(acct.balance)}</b></div>
      </div></div>`;
  }
  h.pointsBreakdown = pointsBreakdown;

  app.get('/pickem/packs', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return needLogin(req, res, 'Packs', 'open packs');
      const { user, acct } = await h.loadAccount(db, name);
      const users = await h.listDocs('users/');
      const free = await freeClaims(db, name, user);
      const pulls = await bigPulls(db, users);
      const taken = await takenOnes(db, users);
      const hot = hotPacks(users);
      const bal = acct.balance, ctx = packCtx(user);
      const dailyDone = !free.some((f) => f.type === 'daily');
      let i = 0, nAll = 0, nCan = 0;
      const sections = GROUPS.map(([g, title, sub]) => {
        let items;
        if (g === 'free') {
          items = free.map((f) => shopItem(db, f.type, cards.packInfo(db, f.type, ctx), { free: true, key: f.key, note: f.note, ctx, bal, g, i: i++ }).html);
          if (dailyDone) items.push(`<article class="psi done" data-g="free" data-cost="0" data-n="1" data-new="0" data-i="${i++}">${packArt(db, cards.packInfo(db, 'daily'), { badges: '<span class="pk-badges"><b class="pkb-done">✓ Claimed</b></span>' })}<div class="psi-b"><div class="psi-h"><h3>Daily Pack</h3></div><p class="psi-d">Claimed today. Come back tomorrow for another free card.</p></div></article>`);
        } else {
          items = cards.packTypes(db).map((t) => [t, cards.packInfo(db, t, ctx)]).filter(([, P]) => !P.free && groupOf(P) === g)
            .map(([t, P]) => { const s = shopItem(db, t, P, { ctx, bal, hot: hot.has(t), g, i: i++ }); nAll++; if (s.can) nCan++; return s.html; });
        }
        return items.length ? `<section class="psec" data-g="${g}" id="g-${g}"><header class="psec-h"><h2>${esc(title)}</h2><p>${esc(sub)}</p></header><div class="psi-grid">${items.join('')}</div></section>` : '';
      }).join('');
      const shown = GROUPS.filter(([g]) => sections.includes(`id="g-${g}"`));
      const totalW = Object.values(R).reduce((s, x) => s + x.weight, 0);
      const ones = cards.catalog(db).filter((c) => c.one), left = ones.filter((c) => !taken.has(c.id)).length;
      res.send(layout(req, 'Packs', pickHead(user, acct, 'cards') + `<div class="wrap pshop">${pickNav('/pickem/packs', name)}${packMsg(req)}
        <section class="card pshop-head"><div class="psh-bal"><small>Your coins</small><b>${icon('coin')}${fmtN(bal)}</b></div>
          <p class="psh-sum">You can afford <b>${nCan}</b> of ${nAll} packs.${free.length ? ` <a href="#g-free">${free.length} free pack${free.length > 1 ? 's' : ''} to open →</a>` : ''}</p>
          <a class="btn ghost sm" href="/pickem/cards/book">Card Book</a></section>
        <div class="pshop-bar" id="pshopBar">
          <div class="pchips" role="group" aria-label="Pack groups"><button type="button" data-g="all">All</button>${shown.map(([g, t]) => `<button type="button" data-g="${g}">${esc(t)}</button>`).join('')}</div>
          <div class="pchips" role="group" aria-label="Sort and filter"><button type="button" data-sort="feat">Featured</button><button type="button" data-sort="lo">Price ↑</button><button type="button" data-sort="hi">Price ↓</button><button type="button" data-sort="n">Most cards</button><span class="pc-sep" aria-hidden="true"></span><button type="button" data-f="can">Can afford</button><button type="button" data-f="new">New</button></div>
        </div>
        <section class="psec" id="pflatWrap" hidden><div class="psi-grid" id="pflat"></div></section>
        <p class="pnone" id="pnone" hidden>No packs match. <button type="button" class="btn ghost sm">Show all packs</button></p>
        ${sections}
        <div class="home-grid"><div class="col">${pointsBreakdown(acct)}<div class="card"><div class="card-h"><h2>Rarities &amp; drop rates</h2></div><ul class="how">
          <li>${cards.RARITY_ORDER.map((r) => `<span class="rar-tag r-${r}">${R[r].name}</span> ${r === 'doh' ? (100 / cards.DOH_ODDS) : (R[r].weight / totalW * 100).toFixed(R[r].weight < 100 ? 2 : 0)}%`).join(' · ')} per card in a regular pack. Every pack's own odds are under "What's inside".</li>
          <li>Better cards multiply fantasy points more: ${cards.VARIANTS.filter((v) => !v.set && (!v.id.startsWith('spec-') || v.id === 'spec-td')).map((v) => `${esc(v.id === 'spec-td' ? 'Specialists' : v.label)} ${v.mult || R[v.rarity].mult}×`).join(' · ')}.</li>
          <li>Specialist cards score ${cards.SPECIAL_BOOST}× on their specialty (TDs, TD passes, interceptions, defense or notable plays). Clutch cards score ${cards.SPECIAL_BOOST}× on wins and MVPs.</li>
          <li>Card sets: ${cards.SETS.length} themed sets with 5 versions of every player each (Base ${cards.PARALLELS[0].mult}×, Silver ${cards.PARALLELS[1].mult}×, Gold ${cards.PARALLELS[2].mult}×, Prism ${cards.PARALLELS[3].mult}×, Black ${cards.PARALLELS[4].mult}×). They only come from set packs.</li>
          <li>Mythic and Dark Matter cards are 1 of 1: once someone pulls one, nobody else can. <b>${left} of ${ones.length}</b> are still out there.</li>
          <li>Collect more different cards to unlock free Collector Packs at ${cards.COLLECTOR_STEPS.join(', ')}.</li></ul></div></div>
        <div class="col"><div class="card"><div class="card-h"><h2>${icon('fire')} Big pulls</h2></div>${pulls.length ? `<ol class="lb">${pulls.map((x) => { const c = cards.cardInfo(db, x.id); return `<li><b>@${esc(x.u)}</b><small>${esc(c.p.name)} · ${esc(c.label)}</small><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span></li>`; }).join('')}</ol>` : '<p class="muted">No Legend-or-better pulls yet. Be the first.</p>'}</div></div></div>
        <script>(()=>{const bar=document.getElementById('pshopBar');if(!bar)return;
          const items=[...document.querySelectorAll('.psi')],secs=[...document.querySelectorAll('.psec[data-g]')],flat=document.getElementById('pflat'),flatW=document.getElementById('pflatWrap'),none=document.getElementById('pnone');
          const home=new Map(items.map((el)=>[el,el.parentNode])),blank={g:'all',sort:'feat',can:false,nw:false};let st={...blank};
          try{Object.assign(st,JSON.parse(sessionStorage.getItem('mfl-pshop')||'{}'));}catch(e){}
          if(!bar.querySelector('[data-g="'+st.g+'"]'))st.g='all';
          const draw=()=>{bar.querySelectorAll('[data-g]').forEach((b)=>b.setAttribute('aria-pressed',b.dataset.g===st.g));bar.querySelectorAll('[data-sort]').forEach((b)=>b.setAttribute('aria-pressed',b.dataset.sort===st.sort));
            bar.querySelector('[data-f=can]').setAttribute('aria-pressed',st.can);bar.querySelector('[data-f=new]').setAttribute('aria-pressed',st.nw);
            let n=0;items.forEach((el)=>{const s=(st.g==='all'||el.dataset.g===st.g)&&(!st.can||el.classList.contains('can'))&&(!st.nw||el.dataset.new==='1');el.hidden=!s;if(s)n++;});
            if(st.sort==='feat'){items.forEach((el)=>home.get(el).appendChild(el));flatW.hidden=true;secs.forEach((s)=>{s.hidden=!s.querySelector('.psi:not([hidden])');});}
            else{const k={lo:(el)=>+el.dataset.cost,hi:(el)=>-el.dataset.cost,n:(el)=>-el.dataset.n}[st.sort];items.slice().sort((a,b)=>k(a)-k(b)||a.dataset.i-b.dataset.i).forEach((el)=>flat.appendChild(el));flatW.hidden=!n;secs.forEach((s)=>{s.hidden=true;});}
            none.hidden=n>0;try{sessionStorage.setItem('mfl-pshop',JSON.stringify(st));}catch(e){}};
          bar.addEventListener('click',(e)=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.g)st.g=b.dataset.g;if(b.dataset.sort)st.sort=b.dataset.sort;if(b.dataset.f==='can')st.can=!st.can;if(b.dataset.f==='new')st.nw=!st.nw;draw();});
          none.querySelector('button').onclick=()=>{st={...blank};draw();};
          draw();let t=null;try{t=location.hash&&document.querySelector(location.hash);}catch(e){}if(t){if(t.hidden){st={...blank};draw();}t.scrollIntoView({block:'center'});}})();</script>
      </div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/packs/open', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
    const db = h.load();
    const type = String(req.body.type || '');
    if (!cards.packInfo(db, type)) return res.redirect('/pickem/packs?m=bad');
    const user = await freshUser(name);
    const packs = (user.packs = user.packs || []);
    const ctx = packCtx(user), P = cards.packInfo(db, type, ctx);
    let key = null;
    if (P.free) {
      const want = String(req.body.key || '');
      const claim = (await freeClaims(db, name, user)).find((f) => f.type === type && (f.key === want || type === 'starter' || type === 'daily'));
      if (!claim) return res.redirect('/pickem/packs?m=used');
      key = claim.key;
    } else {
      if (P.off) return res.redirect('/pickem/packs?m=closed');
      const odds = cards.packInfo.odds ? cards.packInfo.odds(db, type, ctx) : null;
      if (odds && !odds.ok) return res.redirect('/pickem/packs?m=soon');
      if (P.limit === 'day' && packs.some((p) => p.type === type && p.local?.slice(0, 10) === ctx.now.slice(0, 10))) return res.redirect('/pickem/packs?m=limit');
      const bal = h.accountOf(db, user, await h.survivorNow(db)).balance;
      if (bal < P.cost) return res.redirect('/pickem/packs?m=poor');
    }
    const ids = cards.openPack(db, type, await takenOnes(db), ctx);
    // Choose packs keep the options in `choices` until the user picks (POST .../pick).
    const pack = { id: crypto.randomBytes(6).toString('hex'), type, cost: P.cost || 0, currency: 'coins', at: new Date().toISOString(), local: ctx.now, cards: P.choose ? [] : ids,
      ...(P.choose ? { choices: ids, keep: P.cards } : {}), ...(cards.PACKS[type] && P.name !== cards.PACKS[type].name ? { name: P.name } : {}), ...(P.base ? { base: P.base } : {}),
      ...(key ? { key } : {}), ...(type === 'prize' ? { week: key } : {}) };
    packs.push(pack);
    // A first pack also sets a Starting 8 if there isn't one yet.
    if (type === 'starter' && !(user.lineups || []).length) (user.lineups = []).push({ at: pack.at, local: pack.local, cards: pack.cards.slice(0, cards.LINEUP_SIZE) });
    await h.putDoc(h.userKey(name), user);
    res.redirect(`/pickem/packs/${pack.id}`);
  });

  // Choose packs: keep `keep` of the `choices` (1/1s someone pulled meanwhile can't be kept).
  app.post('/pickem/packs/:id/pick', async (req, res, next) => {
    try {
      const name = h.currentUser(req);
      if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
      const db = h.load();
      const user = await freshUser(name);
      const pack = (user.packs || []).find((p) => p.id === req.params.id);
      if (!pack) return res.redirect('/pickem/packs');
      const back = `/pickem/packs/${encodeURIComponent(pack.id)}`;
      if (!Array.isArray(pack.choices) || pack.cards.length) return res.redirect(back);
      const want = [...new Set(String(req.body.cards || '').split(',').map((x) => x.trim()).filter(Boolean))];
      if (want.length !== (pack.keep || 1) || want.some((id) => !pack.choices.includes(id))) return res.redirect(back + '?m=pick');
      const taken = await takenOnes(db);
      if (want.some((id) => taken.has(id))) return res.redirect(back + '?m=gone');
      pack.cards = want;
      pack.kept = new Date().toISOString();
      await h.putDoc(h.userKey(name), user);
      res.redirect(back + '?m=kept');
    } catch (e) { next(e); }
  });

  app.get('/pickem/packs/:id', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
      const { user, acct } = await h.loadAccount(db, name);
      const pack = (user.packs || []).find((p) => p.id === req.params.id);
      if (!pack) return res.redirect('/pickem/packs');
      const P = cards.packInfo(db, pack.type, { ...packCtx(user), now: pack.local || pk.nowLocal(TZ) }) || { name: 'Pack', cards: pack.cards.length };
      const choose = Array.isArray(pack.choices), pending = choose && !pack.cards.length, keep = pack.keep || 1, kept = new Set(pack.cards);
      const cs = (choose ? pack.choices : pack.cards).map((id) => cards.cardInfo(db, id)).filter(Boolean);
      const best = (choose && !pending ? cs.filter((c) => kept.has(c.id)) : cs).reduce((m, c) => Math.max(m, cards.RARITY_ORDER.indexOf(c.rarity)), 0), bestR = cards.RARITY_ORDER[best];
      const t = P.team && db.teams[P.team], art = P.art || {};
      const [c1, c2] = t ? [t.color, t.color2] : art.c || P.colors || ['#ff3344', '#5b0d14'];
      const title = pack.name || P.name;
      const sub = pending ? `Reveal them, then keep ${keep === 1 ? 'the one you want' : `the ${keep} you want`}. The rest go back in the box.`
        : choose ? `You kept ${keep === 1 ? '1 card' : keep + ' cards'}. The others went back in the box.`
          : `${cs.length} card${cs.length === 1 ? '' : 's'} · best pull <span class="rar-tag r-${bestR}">${esc(R[bestR].name)}</span>`;
      const Pnow = cards.packInfo(db, pack.type, packCtx(user));
      const again = Pnow && !Pnow.free && !Pnow.off && Pnow.limit !== 'day' ? `<form method="post" action="/pickem/packs/open" class="rv-again"><input type="hidden" name="type" value="${esc(pack.type)}"><button class="btn ghost"${Pnow.cost > acct.balance ? ' disabled' : ''}>Open another · ${icon('coin')}${fmtN(Pnow.cost)}</button></form>` : '';
      res.send(layout(req, 'Pack', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/packs', name)}${packMsg(req)}
        <div class="rv-head">${packArt(db, P, { cls: 'pkart-sm', title: String(title).replace(/^Flash Sale: /, '').replace(/ Pack$/, '') })}<div class="rv-t"><h2>${esc(title)}</h2><p class="muted">${sub}</p></div><button class="btn ghost sm" id="flipAll" type="button">Reveal all</button></div>
        <div class="reveal best-${bestR}${pending ? ' choose' : ''}"${pending ? ` data-notap data-keep="${keep}"` : ''} style="--p1:${esc(c1)};--p2:${esc(c2)}">
          ${cs.map((c, i) => `<div class="flip r-${c.rarity}${choose && !pending ? (kept.has(c.id) ? ' kept' : ' gone') : ''}" data-id="${esc(c.id)}" style="--d:${i * 70}ms" tabindex="0" role="button" aria-label="${pending ? `Card ${i + 1}: reveal it, then press to keep it` : `Reveal card ${i + 1}`}"><div class="flip-in"><div class="flip-back"><span class="fb-e">${t ? logo(t, 40) : esc(art.e || '🏈')}</span><span class="fb-l">MFL</span></div><div class="flip-front">${cardArt(db, c, { back: true })}</div></div>${pending ? '<span class="rv-keep">✓ Keep</span>' : choose && !kept.has(c.id) ? '<span class="rv-gone">Back in the box</span>' : ''}</div>`).join('')}
        </div>
        ${pending ? `<form method="post" action="/pickem/packs/${esc(pack.id)}/pick" class="rv-pick"><input type="hidden" name="cards" id="pickIn"><span id="pickMsg">Tap ${keep === 1 ? 'a card' : keep + ' cards'} to keep.</span><button class="btn" id="pickBtn" disabled>Keep</button></form>` : ''}
        <div class="reveal-go" hidden>${pending ? '' : `<a class="btn" href="/pickem/cards">Go to my cards</a>${again}<a class="btn ghost" href="/pickem/packs#pk-${esc(pack.type)}">Back to the shop</a>`}</div>
        <p class="muted sm center rv-tip">Tap a card (or its ↻ button) to flip it over and read the back.</p>
        <script>(()=>{const rv=document.querySelector('.reveal'),fl=[...rv.querySelectorAll('.flip')],go=document.querySelector('.reveal-go'),all=document.getElementById('flipAll'),choose=rv.classList.contains('choose');
          const ORDER=${JSON.stringify(cards.RARITY_ORDER)},tier=(f)=>ORDER.findIndex((r)=>f.classList.contains('r-'+r)),calm=matchMedia('(prefers-reduced-motion: reduce)').matches,key='mfl-rv-${esc(pack.id)}';
          let seen=${req.query.m === 'kept' ? 'true' : 'false'},timer=0;try{seen=seen||!!sessionStorage.getItem(key);}catch(e){}
          const done=()=>{if(!fl.every((f)=>f.classList.contains('on')))return;go.hidden=false;all.hidden=true;rv.classList.add('all-on');try{sessionStorage.setItem(key,'1');}catch(e){}};
          const open=(f)=>{if(f.classList.contains('on'))return;f.classList.remove('tease');f.classList.add('on');done();};
          const auto=()=>{const q=fl.filter((f)=>!f.classList.contains('on'));const step=()=>{const f=q.shift();if(!f)return;if(f.classList.contains('on'))return step();
            if(tier(f)>=3&&!calm){f.classList.add('tease');timer=setTimeout(()=>{open(f);timer=setTimeout(step,700);},950);}else{open(f);timer=setTimeout(step,calm?30:tier(f)>=2?560:360);}};timer=setTimeout(step,calm?0:450);};
          const keep=+rv.dataset.keep||1,inp=document.getElementById('pickIn'),btn=document.getElementById('pickBtn'),msg=document.getElementById('pickMsg');
          const toggle=(f)=>{const sel=fl.filter((x)=>x.classList.contains('sel'));if(f.classList.contains('sel'))f.classList.remove('sel');else{if(sel.length>=keep){if(keep>1){msg.textContent='You can keep '+keep+'. Tap one to put it back first.';return;}sel[0].classList.remove('sel');}f.classList.add('sel');}
            const now=fl.filter((x)=>x.classList.contains('sel'));fl.forEach((x)=>x.setAttribute('aria-pressed',x.classList.contains('sel')));inp.value=now.map((x)=>x.dataset.id).join(',');btn.disabled=now.length!==keep;
            btn.textContent=now.length===keep?(keep>1?'Keep these '+keep:'Keep this card'):'Keep';msg.textContent=now.length===keep?'Good choice.':'Tap '+(keep-now.length)+' more to keep.';};
          fl.forEach((f)=>{f.addEventListener('click',()=>{if(!f.classList.contains('on')){clearTimeout(timer);open(f);auto();return;}if(choose)toggle(f);});
            f.addEventListener('keydown',(e)=>{if((e.key==='Enter'||e.key===' ')&&e.target===f){e.preventDefault();f.click();}});});
          all.onclick=()=>{clearTimeout(timer);fl.forEach((f,i)=>setTimeout(()=>open(f),calm?0:i*80));};
          if(seen){fl.forEach((f)=>f.classList.add('on','now'));done();}else auto();})();</script>
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
          <p class="muted">Each game, pick one player who has to score a touchdown. If he doesn't, you're out. You can't use the same player twice in a round. If everyone misses the same game, nobody is out. Last one standing wins <b>${sv.PRIZE} coins</b>. A player ruled out doesn't knock you out.</p></div>
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
