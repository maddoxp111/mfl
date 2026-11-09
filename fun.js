// Pages for the fun stuff: MFL Cards (collection, packs, Lineup) and Survivor.
// `h` is the bag of helpers from server.js (layout, auth, storage, formatting).
const cards = require('./cards');
const sv = require('./survivor');
const crypto = require('crypto');

module.exports = function fun(app, h) {
  const { esc, icon, logo, avatar, coins, layout, pickHead, pickNav, pk, TZ } = h;
  const R = cards.RARITIES;
  const POS = cards.LINEUP_POS;
  // Which auto-pick column each position uses: 0 QB, 1 RB, 2 WR, 3 TE, 4 UTIL, 5 OL.
  const POS_COL = POS.map((p) => ({ QB: 0, RB: 1, TE: 3 })[p] ?? (/^WR/.test(p) ? 2 : /^UTIL/.test(p) ? 4 : 5));
  const POS_GROUP = (p) => (/^UTIL/.test(p) ? 'util' : /^OL/.test(p) ? 'ol' : 'skill');
  // The Lineup groups (the same order as POS_COL) and the ones a player likes, set in admin as p.pref.
  const LU_GROUPS = ['QB', 'RB', 'WR', 'TE', 'UTIL', 'OL'];
  // 3D Blitz at Metcalf is 7 on 7: these spots play, the rest of the line sits (the engine's M7 in 10-setup.js)
  const M7_POS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'OL1'];
  const prefOf = (p) => (Array.isArray(p && p.pref) ? LU_GROUPS.filter((k) => p.pref.includes(k)) : []);
  // A card's own overall (cards.cardOvr): the number that says how good the card is, from its rarity, how strong a
  // version it is and the player's rating. The front shows it; the back shows what it does in game.
  const ovrOf = (db, c) => cards.cardOvr(c, h.ratingOf(db, c.t, c.p));
  h.cardOvr = ovrOf;

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
    // Season 1
    's1-ttime': 'banner', 's1-23': 'fade', 's1-cars': 'banner', 's1-chem': 'polaroid', 's1-onehand': 'full', 's1-tabaka': 'cut',
    's1-bbmode': 'full', 's1-shoot': 'full', 's1-fullext': 'full', 's1-cover': 'cover', 's1-bigboy': 'cover',
  };
  // The cover athlete's two cover cards use the real cover photo (a cutout) instead of his avatar.
  const S1 = require('./seasons').S1;
  const COVER_ART = new Set(['s1-cover', 's1-bigboy']);
  function cardArt(db, c, opts = {}) {
    const rt = ovrOf(db, c);
    const spec = c.spec ? cards.SPECIALTIES[c.spec] : null;
    // Each kind of card (Base, Holo, Gold...) has its own pattern, photo frame and hue; every card of that kind matches.
    // Set cards look like their set (colors, pattern, photo style) with a parallel finish on top.
    const vi = Math.max(0, cards.VARIANTS.findIndex((v) => v.id === c.variant));
    const st = c.set && cards.SET_MAP.get(c.set), si = st ? cards.SETS.indexOf(st) : 0;
    const serial = c.one || c.rarity === 'doh' ? '1/1' : '';
    const look = (st ? `setc par-${c.par} ph-${st.photo} pat-${st.pat} fr-${si % 6}` : `v-${c.variant.replace(/^spec-.*/, 'specx')} v-${c.variant} ph-${PHOTO[c.variant] || 'frame'} pat-${vi % 10} fr-${Math.floor(vi / 10) % 6}`) + (c.season ? ` s${c.season}c` : '');
    const photo = COVER_ART.has(c.variant) ? `<img class="mc-cover" src="${esc(S1.img)}" alt="" loading="lazy">` : avatar(c.t, c.p, opts.small ? 74 : 104, 'xl');
    return `<div class="mcard r-${c.rarity} ${look} ${opts.cls || ''}" data-id="${esc(c.id)}" data-pid="${esc(c.pid)}" ${opts.fit ? `data-fit="${opts.fit}"` : ''} style="--c:${esc(c.t.color)};--c2:${esc(c.t.color2)};--hue:${(vi * 47) % 360};--ang:${((st ? si : vi) * 53) % 360}deg${st ? `;--s1:${st.c1};--s2:${st.c2}` : ''}">
      <div class="mc-pat"></div><div class="mc-glow"></div><div class="mc-shine"></div>
      <div class="mc-top"><span class="mc-rt" title="Card overall: how good this card is"><b>${rt}</b><small>OVR</small></span>${c.season ? `<span class="mc-season" title="Season ${c.season}">S${c.season}</span>` : ''}${logo(c.t, 22)}</div>
      <div class="mc-photo">${photo}</div>
      <div class="mc-name">${esc(c.p.name)}</div>
      <div class="mc-var">${spec ? esc((c.variant === 'spec' ? '★ Signature ' : '') + spec.name) : st ? `${st.emoji} ${esc(c.label)}` : esc(c.label)}</div>
      ${cardPerkFront(c)}
      ${c.season ? `<div class="mc-s1tag">Season ${c.season}</div>` : ''}
      <div class="mc-foot"><span class="mc-rar" title="${esc(tierWords(c))}">${esc(c.rarityName)}${c.rarity === 'common' ? '' : ` · ${esc(tierOfCard(c).name)}`}</span><span class="mc-ser">${serial}</span>${opts.count > 1 ? `<span class="mc-count">×${opts.count}</span>` : ''}</div>
      <button type="button" class="mc-flip" aria-label="Flip card" aria-pressed="false"></button><div class="mc-back"${opts.back ? ` data-ok="1">${cardBack(db, c)}` : '>'}</div>
    </div>`;
  }
  h.cardArt = cardArt;
  // Every card does something: its perk (an on-field quirk), its rating changes and its rarity tier.
  // The front shows the card's overall and its perk name; the back and the Card Book say it all.
  const perkOfCard = (c) => (cards.perkOf ? attempt(() => cards.perkOf(c)) : null);
  const tierOfCard = (c) => (cards.tierOf ? cards.tierOf(c.rarity) : { name: c.rarityName, text: '' });
  const tierWords = (c) => { const t = tierOfCard(c); return `${t.rarity || c.rarityName} tier, ${t.name}: ${t.text}`; };
  // The front keeps the perk name; the skill changes, the fantasy multiplier and scoring are on the back.
  function cardPerkFront(c) {
    const P = perkOfCard(c);
    return P ? `<div class="mc-perk" title="${esc(`${P.name}: ${P.text} (${P.when}).`)}"><span aria-hidden="true">⚡</span> ${esc(P.name)}</div>` : '';
  }
  // The Lineup's cards together: total rating ups and downs, and every perk with its position.
  function lineupFx(db, ids, title = 'What your saved Lineup does in game') {
    const cs = ids.map((id, i) => ({ c: id && cards.cardInfo(db, id), pos: POS[i] })).filter((x) => x.c);
    if (!cs.length || !cards.cardEffects) return '';
    const tot = {};
    const arc = attempt(() => require('./arcade'));
    let ovrSum = 0;
    for (const { c } of cs) {
      const ca = arc && typeof arc.cardAttrs === 'function' ? attempt(() => arc.cardAttrs(db, c.t, c.p, c)) : null;
      ovrSum += ovrOf(db, c);
      if (ca) { for (const [k, v] of Object.entries(ca.attr)) if (k !== 'ovr') tot[k] = (tot[k] || 0) + v - ca.base[k]; continue; }
      const e = attempt(() => cards.cardEffects(c)); if (e) for (const [k, v] of Object.entries(e.attr)) tot[k] = (tot[k] || 0) + v;
    }
    const lab = (k) => (k === 'hgt' ? 'in' : k === 'wgt' ? 'lb' : (cards.ATTR_SHORT && cards.ATTR_SHORT[k]) || k);
    const bits = Object.entries(tot).filter(([, v]) => v).sort((x, y) => y[1] - x[1]).map(([k, v]) => `<i class="${v > 0 ? 'up' : 'down'}" title="${esc(attrName(k))}">${v > 0 ? '+' : '−'}${Math.abs(v)} ${lab(k)}</i>`);
    const perks = cs.map(({ c, pos }) => { const P = perkOfCard(c); return P ? `<li><b>${esc(pos)} · ${esc(P.name)}</b>${P.lv > 1 ? ` <span class="muted sm">level ${P.lv}</span>` : ''} <span class="muted sm">${esc(c.p.name)}, ${esc(c.label)}</span><small>${esc(P.text)} (${esc(P.when)}).</small></li>` : ''; }).join('');
    return `<details class="lineup-fx" open><summary><b>${esc(title)}</b></summary>
      <p class="muted sm">Lineup overall <b>${Math.round(ovrSum / cs.length)}</b>. Every card plays at its overall in the Arcade; all ${cs.length} added up, your players' ratings change by:</p><div class="fx-tot">${bits.join(' ') || '<span class="muted">No changes</span>'}</div>
      <ul class="perk-list">${perks}</ul></details>`;
  }
  h.lineupFx = lineupFx;
  h.cardPerk = perkOfCard;
  h.tierWords = tierWords;

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
    // The card plays at its overall (arcade cardAttrs): the Card column is the move to the card's overall plus its own changes.
    const arc = attempt(() => require('./arcade'));
    const ca = arc && typeof arc.cardAttrs === 'function' ? attempt(() => arc.cardAttrs(db, c.t, c.p, c)) : null;
    const { a, est } = ca ? { a: ca.base, est: false } : baseAttrs(db, c);
    const d = (fx && fx.attr) || {};
    const ovr = ovrOf(db, c), pr = h.ratingOf(db, c.t, c.p), sh = ca ? ca.shift : 0;
    const body = (k) => k === 'hgt' || k === 'wgt';
    const rows = ATTRS.filter((k) => a[k] != null || d[k]).map((k) => {
      const b = a[k] != null ? Number(a[k]) : null, dv = Math.round(d[k] || 0) + (body(k) ? 0 : sh);
      const v = ca && ca.attr[k] != null ? ca.attr[k] : b != null ? clampAttr(k, b + dv) : null;
      return `<div class="mb-a"><span title="${esc(attrName(k))}">${ATTR_NAME[k] || esc(attrName(k))}</span><i>${b != null ? fmtAttr(k, b) : '–'}</i><em class="${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}">${dv ? (dv > 0 ? '+' : '−') + Math.abs(dv) : ''}</em><b>${v != null ? fmtAttr(k, v) : '–'}</b></div>`;
    }).join('');
    const pos = c.p.position || (cards.packInfo.role ? attempt(() => cards.packInfo.role(db, c.t, c.p)) : '');
    const build = (fx && fx.build) || c.p.look?.build || 'normal';
    const meta = [...(st ? [['Set', `${st.emoji} ${esc(st.name)}`], ['Series', esc(st.seriesName)], ['Parallel', esc(par?.label || 'Base')]] : []),
      ['Player rating', esc(pr)], ['Build', esc(BUILD_NAME[build] || build)], ...(c.one || c.rarity === 'doh' ? [['Serial', '1 of 1']] : [])];
    return `<div class="mb"><div class="mb-h">${logo(c.t, 18)}<div><b>${esc(c.p.name)}</b><small>${esc(c.t.name)}${pos ? ' · ' + esc(pos) : ''}${c.p.number ? ' · #' + esc(c.p.number) : ''}</small></div></div>
      <div class="mb-lab"><span class="rar-tag r-${c.rarity}">${esc(c.rarityName)}</span><span>${esc(c.label)}</span></div>
      <p class="mb-ovr"><b>${ovr}</b><span><small>Overall</small>Plays at ${ovr} in the Arcade. ${esc(c.p.name.split(' ')[0])} is ${/^(8|11|18)/.test(String(pr)) && String(pr).length === 2 ? 'an' : 'a'} ${pr}: skills ${ovr === pr ? 'about the same' : `${ovr > pr ? '+' : '−'}${Math.abs(ovr - pr)} on average`}.</span></p>
      <dl class="mb-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="mb-attrs"><div class="mb-a mb-ah"><span>${est ? 'Ratings (est.)' : 'Ratings'}</span><i>Base</i><em>Card</em><b>Now</b></div>${rows}</div>
      ${(() => { const P = perkOfCard(c); return P ? `<p class="mb-perk"><b>Perk · ${esc(P.name)}${P.lv > 1 ? ` · level ${P.lv}` : ''}</b>${esc(P.text)}. <span class="muted">When: ${esc(P.when)}.</span></p>` : ''; })()}
      ${(() => { const S = cards.superstarOf ? cards.superstarOf(ovr, pos, ca && ca.attr) : null; return S ? `<p class="mb-perk"><b>3D Blitz · ${esc(S.tier)} (${ovr})</b>${ovr >= 99 ? 'A shimmering 99 badge and a white-gold glow' : 'A gold OVR badge and a gold glow'}, a callout on big plays${S.ability ? `. ${esc(S.ability.name)}${pos ? ` at ${esc(pos)}` : ''}: ${esc(S.ability.text)}` : ''}.</p>` : ''; })()}
      <p class="mb-fx"><b>In game</b> ${effectWords(c, fx)}</p>
      <p class="mb-tier"><b>${esc(tierOfCard(c).rarity || c.rarityName)} tier · ${esc(tierOfCard(c).name)}</b>${esc(tierOfCard(c).text)}</p>
      <p class="mb-fan"><b>Fantasy</b> ${c.mult}× points${c.flat ? ` · +${c.flat} every game` : ''}${c.spec ? ` · ${esc(cards.SPECIALTIES[c.spec].desc)}` : ''}</p>
      ${c.quote ? `<p class="mb-q">“${esc(c.quote)}”</p>` : ''}</div>`;
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
  app.use(['/pickem', '/season'], (req, res, next) => {
    const send = res.send.bind(res);
    res.send = (body) => {
      if (typeof body !== 'string' || !body.includes('class="mc-flip"') || body.includes('id="mcflip-js"')) return send(body);
      const at = body.lastIndexOf('</body>');
      return send(at < 0 ? body + CARD_FLIP : body.slice(0, at) + CARD_FLIP + body.slice(at));
    };
    next();
  });

  // ---------- last game: what each Lineup card scored, as words and math ----------
  // "10 TD passes × 35 × 1.25 = 438 · win +10". Every Lineup player gets a row, even with 0 points.
  const STAT_WORDS = { td: ['TD', 'TDs'], pass: ['TD pass', 'TD passes'], int: ['interception', 'interceptions'], catch: ['notable catch', 'notable catches'], sack: ['sack', 'sacks'], pbu: ['pass breakup', 'pass breakups'], flag: ['flag pull', 'flag pulls'], big: ['notable play', 'notable plays'], picked: ['INT thrown', 'INTs thrown'], mvp: ['game MVP', 'game MVPs'], win: ['win', 'wins'] };
  const pts = (v) => Math.round(v).toLocaleString('en-US');
  const minus = (v) => '−' + pts(Math.abs(v));
  function partMath(c, q) {
    if (q.k === 'flat') return `card bonus +${pts(q.pts)}`;
    const w = STAT_WORDS[q.k] || [q.k, q.k], word = q.n === 1 ? w[0] : w[1], base = cards.SCORING[q.k];
    if (base < 0) return q.n === 1 ? `${word} ${minus(q.pts)}` : `${q.n} ${word} × ${minus(base)} = ${minus(q.pts)}`;
    const boost = !!c.spec && cards.SPECIALTIES[c.spec].cats.includes(q.k);
    const f = [base, ...(c.mult !== 1 ? [c.mult] : []), ...(boost ? [cards.SPECIAL_BOOST] : [])];
    if (q.n === 1 && f.length === 1) return `${word} +${pts(q.pts)}`;
    return `${q.n} ${word} × ${f.join(' × ')} = ${pts(q.pts)}`;
  }
  function lastGame(db, last, fan) {
    const rows = [...last.cards].sort((a, b) => b.pts - a.pts || (a.pos || '').localeCompare(b.pos || ''));
    const toCoins = (p) => p * cards.COINS_PER_POINT;
    return `<section class="card last-game"><div class="card-h"><h2>Last game: +${pts(toCoins(last.total))} coins</h2><span class="muted sm">${esc(h.matchName(db, last.g))} · ${esc(h.shortDate(last.g.date))}</span></div>
      <p class="muted sm">What each card in your Lineup scored. Points = stat × points per stat × the card's multiplier (mistakes are never multiplied). 1 point = ${cards.COINS_PER_POINT} coins: ${pts(last.total)} points paid ${pts(toCoins(last.total))} coins.</p>
      <div class="fan-rows">${rows.map((x) => {
        const line = !x.played ? ['Did not play · 0 pts'] : x.parts.length ? x.parts.map((q) => partMath(x.c, q)) : ['Played, no stats · 0 pts'];
        return `<div class="fan-row${x.pts ? '' : ' zero'}"><span class="fan-av">${avatar(x.c.t, x.c.p, 40)}</span><span class="fan-main"><b>${esc(x.c.p.name)}</b><small>${x.pos ? `<i class="fan-pos">${esc(x.pos)}</i> ` : ''}<span class="rar-tag r-${x.c.rarity}">${esc(x.c.rarityName)}</span> ${esc(x.c.label)} · ${x.c.mult}×</small><span class="fan-math">${line.map((t) => `<span>${esc(t)}</span>`).join(' · ')}</span></span><b class="fan-pts ${x.pts > 0 ? 'up' : x.pts < 0 ? 'down' : ''}">${x.pts > 0 ? '+' : x.pts < 0 ? '−' : ''}${pts(Math.abs(x.pts))}</b></div>`;
      }).join('')}</div>
      ${fan.results.length > 1 ? `<p class="muted sm">Earlier: ${fan.results.slice(0, -1).reverse().slice(0, 6).map((r) => `${esc(h.shortDate(r.g.date))} +${pts(toCoins(r.total))}`).join(' · ')} coins</p>` : ''}</section>`;
  }

  const needLogin = (req, res, title, what) => res.send(layout(req, title, pickHead(null, null, /^\/pickem\/(cards|packs)/.test(req.path) ? 'cards' : '') + `<div class="wrap">${pickNav(req.path, null)}<div class="card empty-pick">${icon('star')}<h2>Log in to ${what}</h2><p class="muted">Pick'em accounts are free. You get a free Starter Pack too.</p><p><a class="btn" href="/pickem/signup">Sign up</a> <a class="btn ghost" href="/pickem/login?next=${esc(req.path)}">Log in</a></p></div></div>`));
  const flash = (req) => {
    const m = { lineup: 'Lineup saved ✓', sold: 'Card sold ✓', poor: 'Not enough coins for that.', used: 'Already claimed.', bad: 'Something was off with that request.', joined: "You're in! Make your pick.", picked: 'Pick saved ✓', locked: 'Picks are locked for this game.' }[req.query.m];
    return m ? `<div class="toast ${/Not|Already|off|locked/.test(m) ? 'bad' : ''}">${m}</div>` : '';
  };
  const freshUser = async (name) => h.getDoc(h.userKey(name), { fresh: true });

  // ---------- My Cards + Lineup ----------
  app.get('/pickem/cards', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return needLogin(req, res, 'Cards', 'collect MFL Cards');
      const { user, acct } = await h.loadAccount(db, name);
      const own = cards.collection(user);
      // Hidden cards (Big Doh Mi) are not in the index until you pull one.
      const all = cards.catalog(db).filter((c) => !c.hidden || own[c.id]);
      const view = req.query.view === 'all' ? 'all' : 'mine';
      const g = pk.nextGame(db, TZ);
      const latest = (user.lineups || []).at(-1);
      // Lineup slots are positions: cards.LINEUP_POS, QB first ('' = empty). Older 8-card lineups keep their first 8.
      const lineup = Array.from({ length: cards.LINEUP_SIZE }, (_, i) => { const id = (latest?.cards || [])[i]; return id && own[id] ? id : ''; });
      const et = pk.effTend(db);
      // Real player attributes when the Arcade provides them (optional).
      const arc = require('./arcade');
      const attrsOf = (c) => { try { const a = typeof arc.cardAttrs === 'function' && arc.cardAttrs(db, c.t, c.p, c); return a && a.attr && Number.isFinite(a.attr.str) ? a.attr : null; } catch { return null; } };
      // How well a card fits each position column (QB, RB, WR, TE, UTIL, OL), used by auto-pick.
      // The card's own effects count too: a Pizza Friday card blocks better and catches worse.
      const fitArr = (c) => {
        const r = ovrOf(db, c), td = et.player(c.t, c.p, 'td'), ps = et.player(c.t, c.p, 'pass'), m = c.mult;
        const d = cards.cardEffects(c).attr, b = attrsOf(c); // b: the ratings the card plays at (arcade cardAttrs)
        let f = [ps * 0.75 + r * 0.25 + (d.thr + d.acc) / 2, td * 0.6 + r * 0.4 + (d.spd + d.agi) / 2, td * 0.5 + r * 0.5 + (d.spd + d.cat) / 2,
          r * 0.6 + td * 0.4 + (d.cat + d.str) / 2, r + (d.str + d.kick + d.def) / 3, r * 0.8 + (d.str + d.def) / 2 + d.wgt / 5];
        if (b) {
          const v = (k) => b[k] || 0, heft = Math.max(0, Math.min(99, ((b.wgt || 120) - 70) / 1.8));
          const g = [(v('thr') + v('acc')) / 2, (v('spd') + v('agi')) / 2, (v('spd') + v('cat')) / 2, (v('cat') + v('str')) / 2, (v('str') + v('kick') + v('def')) / 3, v('str') * 0.6 + v('def') * 0.1 + heft * 0.3];
          f = f.map((x, i) => (x + g[i]) / 2);
        }
        return f.map((x) => Math.round(x * m));
      };
      const fit = (c) => fitArr(c).join(',');
      const fan = acct.points.fan;
      const last = fan.results.at(-1);
      const sortKey = (c) => -ovrOf(db, c) * 100 - cards.RARITY_ORDER.indexOf(c.rarity);
      const mine = all.filter((c) => own[c.id]).sort((a, b) => sortKey(a) - sortKey(b));
      const uniq = mine.length, total = Object.values(own).reduce((s, n) => s + n, 0);
      const slot = (id) => { const c = id && cards.cardInfo(db, id); return c ? cardArt(db, c, { small: true }) : '<div class="slot-empty">+</div>'; };
      // The player picker: one entry per player you own, with his cards (best first), the Lineup
      // groups he likes (set in admin) and, when none are set, the two groups his ratings fit best.
      const byPid = new Map();
      for (const c of mine) {
        let P = byPid.get(c.pid);
        if (!P) byPid.set(c.pid, (P = { pid: c.pid, n: c.p.name, t: c.t.abbr || c.t.name, av: avatar(c.t, c.p, 44), pref: prefOf(c.p), cards: [] }));
        P.cards.push({ id: c.id, l: c.label, r: c.rarity, rn: c.rarityName, o: ovrOf(db, c), m: c.mult, f: fitArr(c) });
      }
      const roster = [...byPid.values()].map((P) => ({ ...P, auto: LU_GROUPS.map((gp, k) => [gp, Math.max(...P.cards.map((x) => x.f[k]))]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([gp]) => gp) }));
      const shown = (view === 'all' ? all.filter((c) => !c.set).sort((a, b) => sortKey(a) - sortKey(b)) : mine).filter((c) => !R[req.query.r] || c.rarity === req.query.r || (view === 'mine' && lineup.includes(c.id)));
      // Art for owned cards the grid below does not show (a rarity filter, or set cards on "All cards"), so any pick can be drawn in its slot.
      const inGrid = new Set(shown.map((c) => c.id));
      const bank = mine.filter((c) => !inGrid.has(c.id)).map((c) => cardArt(db, c, { small: true })).join('');
      const S = cards.SCORING;
      const scoreLine = `TD ${S.td} · TD pass ${S.pass} · INT ${S.int} · sack ${S.sack} · notable catch or play ${S.catch} · breakup ${S.pbu} · flag pull ${S.flag} · MVP ${S.mvp} · win ${S.win} · thrown INT ${S.picked}`;
      const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
      const body = `
        <div class="stats-row">${[['Coins', coins(acct.balance)], ['Cards', `${total}`], ['Collected', `${uniq} / ${all.length}`], ['Won by Lineup', coins(acct.points.fantasy)]].map(([k, v]) => `<div class="card"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
        ${total ? '' : `<a class="card promo" href="/pickem/packs"><div>${icon('star')}</div><div><b>Open your free Starter Pack</b><span>${cards.LINEUP_SIZE} cards: a full Lineup that earns coins every game.</span></div>${icon('arrow')}</a>`}
        <section class="card lineup-card" id="lineupCard">
          <div class="card-h"><h2>Lineup</h2><span class="muted sm">${g ? `Plays in ${esc(h.matchName(db, g))} · ${esc(h.shortDate(g.date))} · locks ${h.time12(pk.lockTime(g))}` : 'No game scheduled'}</span></div>
          <p class="muted sm">Pick ${cards.LINEUP_SIZE} cards of different players, one per position. Every game they play, your cards score fantasy points × their multiplier, paid in coins (the same coins as Pick'em). In the Arcade your QB throws, the RB runs, WRs and the TE catch, UTIL and OL block, and every card plays at its overall (the big number on the front; flip a card to see its exact ratings). Your Lineup carries over until you change it.</p>
          <p class="lu-score sm"><b>Points</b> ${scoreLine}. Every point pays ${cards.COINS_PER_POINT} coins: a QB with 10 TD passes on a Base card scores ${10 * S.pass} points, ${(10 * S.pass * cards.COINS_PER_POINT).toLocaleString('en-US')} coins.</p>
          <p class="lu-m7 sm"><span class="m7b">Metcalf: 7 on 7</span> In 3D Blitz at Metcalf only your QB, RB, WR1-3, TE and OL1 (the center) play. UTIL1, UTIL2, OL2 and OL3 sit, and the defense has one lineman.</p>
          <p class="lu-how sm"><b>Tap a spot</b>, then pick a player. Tap a filled spot, then another spot to swap them (or drag on a computer). Tap a spot twice to empty it.</p>
          <form method="post" action="/pickem/lineup" id="lineupForm"><input type="hidden" name="cards" id="lineupInput" value="${esc(lineup.join(','))}">
            <div class="slots" id="slots">${Array.from({ length: cards.LINEUP_SIZE }, (_, i) => `<div class="slot g-${POS_GROUP(POS[i])}" data-i="${i}" role="button" tabindex="0" aria-label="${POS[i]}"><span class="slot-pos">${POS[i]}</span>${M7_POS.includes(POS[i]) ? '<span class="slot-m7" title="Plays at Metcalf (7 on 7)">7v7</span>' : '<span class="slot-m7 off" title="Sits at Metcalf (7 on 7)">sits at Metcalf</span>'}<div class="slot-c" data-cur="${esc(lineup[i])}">${slot(lineup[i])}</div></div>`).join('')}</div>
            <div class="lineup-bar"><span id="lineupMsg" class="muted sm">${lineup.filter(Boolean).length}/${cards.LINEUP_SIZE} picked</span><button type="button" class="btn ghost sm" id="autoBtn">Auto-pick best</button><button class="btn sm" id="saveLineup">Save Lineup</button></div>
          </form>
          ${roster.length ? `<div class="lu-picker" id="luPicker">
            <div class="lu-head">
              <div class="lu-top"><div class="lu-target" id="luTarget">My players</div><button type="button" class="btn sm" id="luBack" hidden>Back to Lineup</button></div>
              <div class="lu-mini" id="luMini" role="group" aria-label="Lineup spots">${POS.map((p, i) => `<button type="button" data-i="${i}" class="g-${POS_GROUP(p)}"><b>${p}</b><span></span></button>`).join('')}</div>
              <div class="lu-filters"><div class="lu-chips" id="luChips" role="group" aria-label="Show players who like a position">${['ALL', ...LU_GROUPS].map((gp) => `<button type="button" data-g="${gp}">${gp === 'ALL' ? 'All' : gp}<i></i></button>`).join('')}</div>
                <input type="search" id="luSearch" class="lu-search" placeholder="Search your players" aria-label="Search your players" autocomplete="off" enterkeyhint="search"></div>
            </div>
            <div class="lu-list" id="luList"></div>
            <p class="lu-none muted sm" id="luNone" hidden><span id="luNoneTxt">No players match.</span> <button type="button" class="btn ghost sm" id="luAll">Show all my players</button></p>
          </div>` : ''}
          ${lineupFx(db, lineup)}
          <div class="lineup-pick" id="lineupPick" hidden><span id="lineupPickTxt">Pick a player for <b id="lineupPickPos"></b></span><button type="button" class="btn ghost sm" id="lineupPickChange" hidden>Change</button><button type="button" class="btn ghost sm" id="lineupPickDone">Done</button></div>
          <template id="artBank">${bank}</template>
        </section>
        ${last ? lastGame(db, last, fan) : ''}
        ${pointsBreakdown(acct)}
        <section class="card">
          <div class="card-h"><h2>${view === 'all' ? 'Every card' : 'My collection'}</h2><div class="seg mini"><a class="${view === 'mine' ? 'on' : ''}" href="/pickem/cards">Mine</a><a class="${view === 'all' ? 'on' : ''}" href="/pickem/cards?view=all">All cards</a></div></div>
          <p class="muted sm"><a href="/pickem/cards/book">${icon('star')} Open the Card Book</a> to see every card, which ones you're missing and which packs drop them.</p>${view === 'all' ? `<p class="muted sm">Showing the ${all.filter((c) => !c.set).length} classic cards. The ${all.filter((c) => c.set).length.toLocaleString('en-US')} card-set cards are in the <a href="/pickem/cards/book?tab=sets">Card Book</a>.</p>` : ''}
          <div class="seg mini rfilter">${['all', ...cards.SHOWN_RARITIES].map((r) => `<a class="${(req.query.r || 'all') === r ? 'on' : ''}" href="/pickem/cards?${view === 'all' ? 'view=all&' : ''}r=${r}">${r === 'all' ? 'All' : esc(R[r].name)}</a>`).join('')}</div>
          <div class="mgrid" id="coll">${shown.map((c) => {
            const n = own[c.id] || 0;
            const sell = view === 'mine' && n > 1 ? `<form method="post" action="/pickem/cards/sell" class="sell"><input type="hidden" name="card" value="${esc(c.id)}"><button class="btn ghost sm" onclick="event.stopPropagation()">Sell 1 extra · +${R[c.rarity].sell} coins</button></form>` : '';
            return `<div class="mcell ${n ? 'owned' : 'missing'}">${cardArt(db, c, { small: true, count: n, cls: n ? 'pickable' : '', fit: n ? fit(c) : null })}${sell}</div>`;
          }).join('') || '<p class="muted">No cards yet. <a href="/pickem/packs">Open a pack →</a></p>'}</div>
        </section>
        <script>(()=>{
          const max=${cards.LINEUP_SIZE},inp=document.getElementById('lineupInput'),slots=document.getElementById('slots'),msg=document.getElementById('lineupMsg');
          let ids=inp.value.split(',');while(ids.length<max)ids.push('');ids=ids.slice(0,max);
          const POS=${json(POS)},COL=${json(POS_COL)},GROUPS=${json(LU_GROUPS)},GRP=POS.map(p=>p.replace(/[0-9]+$/,''));
          const ROSTER=${json(roster)};
          const $=(id)=>document.getElementById(id);
          const coll=$('coll'),picker=$('luPicker'),list=$('luList'),chips=$('luChips'),search=$('luSearch'),mini=$('luMini'),target=$('luTarget'),backBtn=$('luBack'),none=$('luNone');
          const pill=$('lineupPick'),pillTxt=$('lineupPickTxt'),pillChange=$('lineupPickChange');
          const phone=matchMedia('(max-width:760px)');
          const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
          const pidOf=(id)=>id.split(':')[0];
          const byPid={},cardOf={};ROSTER.forEach(P=>{byPid[P.pid]=P;P.cards.forEach(c=>{cardOf[c.id]=c;});});
          // sel: the chosen spot (-1 none). sheet: the player list is open for it (full screen on phones).
          let sel=-1,sheet=false,filt='ALL',q='',open={},flashAt=[];
          // Card art for a slot: the collection grid, the slots as first drawn, or the bank of other owned cards.
          const known={};const keep=(el)=>{known[el.dataset.id]=el.outerHTML;};
          slots.querySelectorAll('.mcard').forEach(keep);const bank=$('artBank');if(bank)bank.content.querySelectorAll('.mcard').forEach(keep);
          const art=(id)=>{const el=coll&&coll.querySelector('.mcard[data-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]');return el?el.outerHTML:known[id]||'';};
          const slotOf=(pid)=>ids.findIndex(x=>x&&pidOf(x)===pid);
          const nameOf=(id)=>{const P=id&&byPid[pidOf(id)];return P?P.n:'';};
          const likes=(P,g)=>P.pref.length?P.pref.includes(g):P.auto.includes(g);
          const level=(P,g)=>P.pref.includes(g)?2:!P.pref.length&&P.auto.includes(g)?1:0;
          const best=(P,k)=>k<0?P.cards[0]:P.cards.reduce((a,c)=>(c.f[k]>a.f[k]?c:a),P.cards[0]);
          const groupNow=()=>sel>=0?GRP[sel]:filt!=='ALL'?filt:null;
          let said=0,sayT=0;const count=()=>ids.filter(Boolean).length+'/'+max+' picked';
          const say=(t)=>{msg.textContent=t;said=1;clearTimeout(sayT);sayT=setTimeout(()=>{said=0;msg.textContent=count();},4000);};
          // Put a card in spot i. If its player is already in another spot, the two players trade places.
          const place=(id,i)=>{const j=slotOf(pidOf(id));if(j>=0&&j!==i)ids[j]=ids[i];ids[i]=id;flashAt=[i].concat(j>=0&&j!==i?[j]:[]);};
          const pickCard=(id,fromChip)=>{const P=byPid[pidOf(id)];if(!P)return;
            if(sel>=0){place(id,sel);say(P.n+' → '+POS[sel]);sel=-1;sheet=false;filt='ALL';}
            else{const j=slotOf(P.pid);
              if(j>=0&&(ids[j]===id||!fromChip)){ids[j]='';say(P.n+' taken out of '+POS[j]);}
              else if(j>=0){ids[j]=id;flashAt=[j];say(P.n+' now uses this card');}
              else{let i=ids.findIndex((x,k)=>!x&&likes(P,GRP[k]));if(i<0)i=ids.indexOf('');if(i<0){say('Your Lineup is full. Tap a spot first to swap someone out.');return;}place(id,i);say(P.n+' → '+POS[i]);}}
            draw();};
          const choose=(i,openSheet)=>{sel=i;filt=GRP[i];q='';if(search)search.value='';sheet=openSheet;draw();
            if(sheet&&list){list.scrollTop=0;if(!phone.matches&&picker){const r=picker.getBoundingClientRect();if(r.top>innerHeight-120||r.top<0)picker.scrollIntoView({behavior:'smooth',block:'start'});}}};
          // Tap a spot: choose it (an empty one opens the list). Tap another spot next: the two swap. Tap the same spot again: empty it.
          const tapSlot=(i)=>{if(sel===i){if(ids[i]){say(nameOf(ids[i])+' taken out of '+POS[i]);ids[i]='';}sel=-1;sheet=false;filt='ALL';draw();return;}
            if(sel>=0&&ids[sel]){const a=ids[sel];ids[sel]=ids[i];ids[i]=a;flashAt=[sel,i];say(ids[sel]?nameOf(a)+' ⇄ '+nameOf(ids[sel]):nameOf(a)+' moved to '+POS[i]);sel=-1;sheet=false;filt='ALL';draw();return;}
            choose(i,!ids[i]);};
          slots.addEventListener('click',e=>{const s=e.target.closest('.slot');if(!s||e.target.closest('.mc-flip'))return;e.preventDefault();tapSlot(+s.dataset.i);});
          slots.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const s=e.target.closest('.slot');if(!s)return;e.preventDefault();tapSlot(+s.dataset.i);});
          // Drag and drop between spots (and from the player list onto a spot) on a computer.
          let drag=null;
          const over=(s,on)=>s&&s.classList.toggle('drop',on);
          slots.addEventListener('dragstart',e=>{const s=e.target.closest('.slot');if(!s||!ids[+s.dataset.i])return e.preventDefault();drag={slot:+s.dataset.i};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain','slot:'+s.dataset.i);}catch(x){}s.classList.add('dragging');});
          slots.addEventListener('dragend',()=>{drag=null;slots.querySelectorAll('.dragging,.drop').forEach(s=>s.classList.remove('dragging','drop'));});
          slots.addEventListener('dragover',e=>{const s=e.target.closest('.slot');if(!s||!drag)return;e.preventDefault();slots.querySelectorAll('.drop').forEach(x=>x!==s&&over(x,false));over(s,true);});
          slots.addEventListener('dragleave',e=>{const s=e.target.closest('.slot');if(s&&!s.contains(e.relatedTarget))over(s,false);});
          slots.addEventListener('drop',e=>{const s=e.target.closest('.slot');if(!s||!drag)return;e.preventDefault();const i=+s.dataset.i;
            if(drag.slot!=null&&drag.slot!==i){const a=ids[drag.slot];ids[drag.slot]=ids[i];ids[i]=a;flashAt=[drag.slot,i];say(ids[drag.slot]?nameOf(a)+' ⇄ '+nameOf(ids[drag.slot]):nameOf(a)+' moved to '+POS[i]);}
            else if(drag.card){place(drag.card,i);say(nameOf(drag.card)+' → '+POS[i]);}
            drag=null;sel=-1;sheet=false;filt='ALL';draw();});
          // The player list.
          const row=(P,k)=>{const g=k>=0?GROUPS[k]:null,c=best(P,k),at=slotOf(P.pid),lv=g?level(P,g):0;
            const go=sel>=0?(ids[sel]===c.id?'In this spot':at===sel?'Use this card':at>=0?'Move here':'Pick'):(at>=0?'Remove':'Add');
            const likesTxt=P.pref.length?'Likes '+P.pref.join(', '):'Best at '+P.auto.join(', ');
            const more=P.cards.length>1?'<button type="button" class="lu-more" aria-expanded="'+(!!open[P.pid])+'">'+P.cards.length+' cards</button>':'';
            return '<div class="lu-row'+(at>=0?' in':'')+(lv===2?' liked':'')+'" data-pid="'+esc(P.pid)+'" draggable="true">'
              +'<span class="lu-av">'+P.av+'</span>'
              +'<div class="lu-main"><b class="lu-n">'+esc(P.n)+'</b><span class="lu-meta">'+esc(P.t)+' · '+(lv===2?'<em>★ '+esc(likesTxt)+'</em>':esc(likesTxt))+'</span>'
              +'<span class="lu-card"><span class="lu-ovr">'+c.o+'</span><span class="rar-tag r-'+esc(c.r)+'">'+esc(c.rn)+'</span> <span class="lu-cl">'+esc(c.l)+' · '+c.m+'×</span>'+more+'</span>'
              +(at>=0?'<span class="lu-in">✓ In Lineup · '+POS[at]+'</span>':'')+'</div>'
              +'<div class="lu-side">'+(g?'<span class="lu-fit" title="How well his best card fits '+g+'"><b>'+c.f[k]+'</b><small>fit '+g+'</small></span>':'')
              +'<button type="button" class="btn sm lu-go'+(go==='Remove'?' ghost':'')+'" data-id="'+esc(c.id)+'"'+(go==='In this spot'?' disabled':'')+'>'+go+'</button></div>'
              +(open[P.pid]?'<div class="lu-cards">'+P.cards.map(x=>'<button type="button" class="lu-cc'+(ids.includes(x.id)?' on':'')+'" data-id="'+esc(x.id)+'"><span class="lu-ovr">'+x.o+'</span><span class="rar-tag r-'+esc(x.r)+'">'+esc(x.rn)+'</span> '+esc(x.l)+' · '+x.m+'×'+(k>=0?' · fit '+x.f[k]:'')+'</button>').join('')+'</div>':'')
              +'</div>';};
          const renderList=()=>{if(!list)return;const g=groupNow(),k=g?GROUPS.indexOf(g):-1;
            let rows=ROSTER.filter(P=>(filt==='ALL'||likes(P,filt))&&(!q||P.n.toLowerCase().includes(q)||P.t.toLowerCase().includes(q)));
            if(k>=0)rows=rows.slice().sort((a,b)=>level(b,g)-level(a,g)||best(b,k).f[k]-best(a,k).f[k]);
            list.innerHTML=rows.map(P=>row(P,k)).join('');none.hidden=rows.length===ROSTER.length;$('luNoneTxt').textContent=rows.length?(ROSTER.length-rows.length)+' more player'+(ROSTER.length-rows.length===1?'':'s')+' hidden by the filter.':'No players match.';
            chips.querySelectorAll('button').forEach(b=>{const gg=b.dataset.g;b.classList.toggle('on',gg===filt);b.setAttribute('aria-pressed',gg===filt);b.querySelector('i').textContent=gg==='ALL'?ROSTER.length:ROSTER.filter(P=>likes(P,gg)).length;});};
          const drawSlot=(s,i)=>{const c=s.querySelector('.slot-c');if(c.dataset.cur!==ids[i]){c.dataset.cur=ids[i];c.innerHTML=ids[i]?art(ids[i]):'<div class="slot-empty">+</div>';c.querySelectorAll('.mcard').forEach(m=>m.classList.remove('in','show-back','mc-flipping'));}
            s.classList.toggle('sel',i===sel);s.classList.toggle('swap-from',sel>=0&&!!ids[sel]&&i!==sel);s.draggable=!!ids[i];s.setAttribute('aria-pressed',i===sel);
            if(flashAt.includes(i)){s.classList.remove('flash');void s.offsetWidth;s.classList.add('flash');}};
          const draw=()=>{inp.value=ids.join(',');[...slots.children].forEach(drawSlot);flashAt=[];
            if(!said)msg.textContent=count();
            if(sel>=0){const who=nameOf(ids[sel]);pill.hidden=sheet&&phone.matches;pillTxt.innerHTML=who?'<b>'+POS[sel]+'</b> · '+esc(who)+'<small>Tap another spot to swap</small>':'Pick a player for <b>'+POS[sel]+'</b>';pillChange.hidden=!who||(sheet&&!phone.matches);}
            else pill.hidden=true;
            document.body.classList.toggle('lu-sheet',sheet&&sel>=0);
            if(picker){picker.classList.toggle('filling',sel>=0);backBtn.hidden=sel<0;
              target.innerHTML=sel>=0?'Filling <b>'+POS[sel]+'</b><small>'+(ids[sel]?'Now: '+esc(nameOf(ids[sel])):'Empty spot')+'</small>':'My players<small>'+ROSTER.length+' player'+(ROSTER.length===1?'':'s')+' · tap a spot above to fill it</small>';
              mini.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('on',i===sel);b.classList.toggle('full',!!ids[i]);b.querySelector('span').textContent=ids[i]?nameOf(ids[i]).split(' ')[0]:'+';});}
            if(coll)coll.querySelectorAll('.mcard.pickable').forEach(c=>c.classList.toggle('in',ids.includes(c.dataset.id)));
            renderList();};
          const done=()=>{sel=-1;sheet=false;filt='ALL';draw();slots.scrollIntoView({behavior:'smooth',block:'center'});};
          $('lineupPickDone').onclick=()=>{sel=-1;sheet=false;filt='ALL';draw();};
          pillChange.onclick=()=>{if(sel>=0)choose(sel,true);};
          if(picker){
            backBtn.onclick=done;$('luAll').onclick=()=>{filt='ALL';q='';search.value='';renderList();};
            chips.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;filt=b.dataset.g;renderList();});
            search.addEventListener('input',()=>{q=search.value.trim().toLowerCase();renderList();});
            mini.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.i;if(i!==sel)choose(i,true);});
            list.addEventListener('click',e=>{const m=e.target.closest('.lu-more');if(m){const r=m.closest('.lu-row');open[r.dataset.pid]=!open[r.dataset.pid];renderList();return;}
              const b=e.target.closest('.lu-go,.lu-cc');if(b&&!b.disabled)pickCard(b.dataset.id,b.classList.contains('lu-cc'));});
            list.addEventListener('dragstart',e=>{const r=e.target.closest('.lu-row');if(!r)return;const b=r.querySelector('.lu-go');drag={card:b.dataset.id};try{e.dataTransfer.setData('text/plain','card:'+b.dataset.id);}catch(x){}});
            list.addEventListener('dragend',()=>{drag=null;slots.querySelectorAll('.drop').forEach(s=>s.classList.remove('drop'));});
            document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sel>=0){sel=-1;sheet=false;filt='ALL';draw();}});
          }
          // Tapping a card in the collection grid still works: it fills the chosen spot, or the first open one he likes.
          if(coll)coll.addEventListener('click',e=>{const c=e.target.closest('.mcard.pickable');if(!c||e.target.closest('.mc-flip'))return;const id=c.dataset.id;
            if(!cardOf[id])return;if(sel<0&&ids.includes(id)){const j=ids.indexOf(id);ids[j]='';say(nameOf(id)+' taken out of '+POS[j]);draw();return;}pickCard(id,true);});
          // Auto-pick: the best player-and-spot matches first, each player once. Spots a player likes (set by the league) count 30% more.
          $('autoBtn').onclick=()=>{const pairs=[],used=new Set(),out=ids.map(()=>'');
            ROSTER.forEach(P=>COL.forEach((k,i)=>{const c=best(P,k);pairs.push({i,pid:P.pid,id:c.id,v:c.f[k]*(P.pref.includes(GROUPS[k])?1.3:1)});}));
            pairs.sort((a,b)=>b.v-a.v).forEach(x=>{if(out[x.i]||used.has(x.pid))return;out[x.i]=x.id;used.add(x.pid);});
            ids=out;sel=-1;sheet=false;filt='ALL';flashAt=ids.map((x,i)=>i);say('Auto-picked '+ids.filter(Boolean).length+'/'+max+'. Save to keep it.');draw();};
          addEventListener('pageshow',()=>{document.body.classList.remove('lu-sheet');});
          draw();})();</script>`;
      res.send(layout(req, 'My Cards', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/cards', name)}${flash(req)}${h.seasonHero ? h.seasonHero('mini') : ''}${body}</div>`));
    } catch (e) { next(e); }
  });

  app.post('/pickem/lineup', async (req, res) => {
    const name = h.currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/cards');
    const db = h.load();
    const user = await freshUser(name);
    const own = cards.collection(user);
    // One card per position (cards.LINEUP_POS: QB, RB, WR1-3, TE, UTIL1-2, OL1-3); '' = empty slot.
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
    if (!has('s1p-welcome')) out.push({ type: 's1p-welcome', key: 's1', note: `Season ${S1.n} is here: two free Season ${S1.n} cards for everyone.` });
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
    ['season', `Season ${S1.n}: ${S1.name}`, `The newest cards and the best ones in the game, up to the new Zenith rarity. Season ${S1.n} cards only come from these packs.`],
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
    return `<div class="pkart pat-${PATS.has(a.pat) ? a.pat : 'stripes'}${a.foil ? ' foil-' + a.foil : ''}${P.season || P.allSeasons ? ` pk-season${P.season ? ` pk-s${P.season}` : ''}` : ''} ${o.cls || ''}" style="--p1:${esc(c1)};--p2:${esc(c2)}">
      <div class="pk-body" aria-hidden="true"><span class="pk-pat"></span><span class="pk-brand">${esc(P.brand || (P.season ? `Season ${P.season}` : 'MFL Cards'))}</span><span class="pk-emo">${t ? logo(t, 44) : esc(a.e || '🏈')}</span><b class="pk-nm">${esc(title)}</b><i class="pk-n">${esc(cardCount(P))}</i><span class="pk-shine"></span></div>${o.badges || ''}</div>`;
  }
  const pct = (x) => (x >= 10 ? Math.round(x) : x >= 1 ? x.toFixed(1) : x >= 0.01 ? x.toFixed(2) : '<0.01') + '%';
  // "What's inside": guarantees, features, per-card rarity odds and the pool.
  function oddsPanel(db, P, odds, ctx) {
    const L = [];
    if (P.bundle) L.push(`Inside: ${P.bundle.map(([t, k]) => { const S = cards.packInfo(db, t, ctx); return `${k > 1 ? k + '× ' : ''}${esc(S.name)} (${S.cards} cards, ${fmtN(S.cost)} coins)`; }).join(' + ')}. Worth ${fmtN(P.list)} coins on their own.`);
    if (P.choose) L.push(`You see ${P.choose} different cards and keep ${P.cards}. The others go back in the box.`);
    if (P.pairs) L.push(`${P.pairs} pairs: each pair is one player in two different cards.`);
    if (P.mystery) L.push(`Anywhere from ${P.mystery[0]} to ${P.mystery[1]} cards.`);
    if (P.hits) L.push(`The last ${P.hits === 1 ? 'card is the hit' : `${P.hits} cards are the hits`}: ${P.floor ? `${R[P.floor].name} or better, ` : ''}with the boosted odds below. The other ${P.cards - P.hits} ${P.cards - P.hits === 1 ? 'is a regular card' : 'are regular cards'} from the same pool${P.fillFloor ? ` (${R[P.fillFloor].name} or better)` : ''}.`);
    else if (P.floor) L.push(`Every card is ${R[P.floor].name} or better.`);
    if (P.min) L.push(`${(P.mins || 1) > 1 ? P.mins : 'At least one'} ${R[P.min].name} or better guaranteed${P.choose ? ' to choose from' : ''}.`);
    if (P.boost && !P.floor) { const z = cards.RARITY_ORDER.filter((r) => P.boost[r] === 0).map((r) => R[r].name); if (z.length) L.push(`No ${z.join(' or ')} cards.`); }
    if (P.rotate) L.push(P.off ? `Not on sale today. Back ${esc(P.back)}.` : `On sale until ${P.until === 'tonight' ? 'tonight' : esc(P.until)}.`);
    if (P.flash) L.push(`${Math.round(P.discount * 100)}% off the ${fmtN(P.list)} coin price right now. ${P.nextDrop != null ? `Drops another 10% at ${h.time12(String(P.nextDrop).padStart(2, '0') + ':00')}.` : "That's as low as it goes today."} One per day, and a new pack tomorrow.`);
    if (P.free) L.push('Free. It refills on its own schedule.');
    if (P.mixed) L.push('Classic cards and set cards both drop.'); else if (P.sets && !P.bundle) L.push('Set cards only.');
    const fillBars = odds && odds.fill && odds.fill.length ? `<small class="po-k">Odds for the other ${P.cards - odds.hits} card${P.cards - odds.hits === 1 ? '' : 's'}</small><div class="po-bars">${odds.fill.map((x) => `<div class="po-r r-${x.r}"><span>${esc(R[x.r].name)}</span><i><u style="width:${Math.max(2, x.pct).toFixed(1)}%"></u></i><b>${pct(x.pct)}</b></div>`).join('')}</div>` : '';
    const bars = odds && odds.odds.length ? `<small class="po-k">${odds.hits ? `Odds for the ${odds.hits === 1 ? 'hit (the last card)' : `${odds.hits} hits (the last cards)`}` : `Odds for each card${P.min && !P.floor ? ' (before the guarantee)' : ''}`}</small><div class="po-bars">${odds.odds.map((x) => `<div class="po-r r-${x.r}"><span>${esc(R[x.r].name)}</span><i><u style="width:${Math.max(2, x.pct).toFixed(1)}%"></u></i><b>${pct(x.pct)}</b></div>`).join('')}</div>` : '';
    const pool = !odds ? '' : !odds.ok ? 'None of these cards are out yet. Restocking soon.' : `${P.bundle ? 'Drops from up to' : 'Drops from'} ${fmtN(odds.size)} different cards of ${odds.players} player${odds.players === 1 ? '' : 's'}${odds.sets ? ` in ${odds.sets} set${odds.sets > 1 ? 's' : ''}` : ''}.`;
    return `<details class="po"><summary>What's inside</summary><div class="po-in">${L.length ? `<ul>${L.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}${bars}${fillBars}<p class="po-pool">${pool}${P.inside ? ` ${esc(P.inside)}` : ''}</p></div></details>`;
  }
  // Short feature tags under each pack's name.
  function packTags(P) {
    const t = [];
    if (P.hits) t.push(P.fillFloor ? `All ${R[P.fillFloor].name}+` : `${P.hits > 1 ? P.hits + ' hits' : '1 hit'}`);
    else if (P.floor) t.push(`All ${R[P.floor].name}+`);
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
    // Boxes: 5, 10 or 20 of this pack for less, opened back to back.
    const BX = cards.packInfo.BOXES, boxes = !free && !soon && !off && cards.packInfo.boxOk(P) ? `<div class="psi-boxes"><small>Box of 5, 10 or 20 · coins</small>${Object.keys(BX).map(Number).map((n) => { const tot = cards.packInfo.boxPrice(cost, n) * n, ok = tot <= o.bal; return `<button name="box" value="${n}" class="pbx${ok ? '' : ' poor'}"${ok ? '' : ' disabled'} title="${n} ${esc(P.name)} packs, ${Math.round(BX[n] * 100)}% off"><b>×${n}</b><span>${fmtN(tot)}</span><i>−${Math.round(BX[n] * 100)}%</i></button>`; }).join('')}</div>` : '';
    return { can, html: `<article class="psi${can ? ' can' : ''}${off || soon ? ' off' : ''}" id="pk-${esc(type)}" data-g="${esc(o.g)}" data-cost="${cost}" data-n="${P.choose ? P.cards : P.mystery ? Math.round((P.mystery[0] + P.mystery[1]) / 2) : P.cards}" data-new="${isNew ? 1 : 0}" data-i="${o.i}">
      ${packArt(db, P, { badges: badges.length ? `<span class="pk-badges">${badges.map(([k, v]) => `<b class="pkb-${k}">${esc(v)}</b>`).join('')}</span>` : '' })}
      <div class="psi-b"><div class="psi-h"><h3>${esc(P.name)}</h3><span class="psi-price">${free ? '<b>Free</b>' : `${sale ? `<s>${fmtN(P.list)}</s>` : ''}<b>${icon('coin')}${fmtN(cost)}</b>`}</span></div>
        <p class="psi-d">${esc(o.note || P.desc)}</p>
        <div class="psi-tags"><span>${esc(cardCount(P))}</span>${packTags(P)}</div>
        ${oddsPanel(db, P, odds, o.ctx)}
        <form method="post" action="/pickem/packs/open" class="psi-buy"><input type="hidden" name="type" value="${esc(type)}">${o.key ? `<input type="hidden" name="key" value="${esc(o.key)}">` : ''}<button class="btn${can ? '' : ' ghost'}"${can ? '' : ' disabled'}>${btn}</button>${boxes}</form></div>
    </article>` };
  }
  const packMsg = (req) => {
    const m = { nobox: "That pack doesn't come in boxes.", closed: "That pack isn't on sale today.", soon: 'That pack is restocking. Check back soon.', limit: 'One a day. A new deal tomorrow.', kept: 'Kept ✓ It\'s in your collection.', gone: 'Someone just pulled that 1 of 1. Pick another one.', pick: 'Pick the right number of cards to keep.' }[req.query.m];
    return m ? `<div class="toast ${/isn't|restocking|One a day|Someone|right number|doesn't come/.test(m) ? 'bad' : ''}">${m}</div>` : flash(req);
  };
  // Where a user's coins came from: picks and the card game are one currency.
  function pointsBreakdown(acct) {
    const P = acct.points, f = (n) => Math.round(n).toLocaleString('en-US'), sg = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n));
    // Every source of coins gets a row, so the rows add up to the balance. Pick'em is what's left: the start plus picks.
    const picks = acct.balance - P.net;
    const won = P.arcadeWon != null ? P.arcadeWon : Math.max(0, P.arcade || 0), lost = P.arcadeLost != null ? P.arcadeLost : Math.max(0, -(P.arcade || 0));
    const nGames = P.fan && P.fan.results ? P.fan.results.length : 0;
    const row = (label, n, sub, cls) => `<div${cls ? ` class="${cls}"` : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><b class="${n > 0 ? 'up' : n < 0 ? 'down' : 'zero'}">${sg(n)}</b></div>`;
    return `<div class="card pts-break"><div class="card-h"><h2>${icon('coin')} Your coins</h2><b class="big">${f(acct.balance)}</b></div>
      <p class="muted sm">Coins are the only currency: the same coins you win in Pick'em are earned by your Lineup and the Arcade and spent on packs.</p>
      <div class="pb-rows">
        ${row("From Pick'em (start + picks)", picks)}
        ${P.playerLink ? row('<a href="#your-player">Your player</a>', P.player, `${esc(P.playerLink.p.name)} · ${(P.playerGames || []).length} game${(P.playerGames || []).length === 1 ? '' : 's'}`) : ''}
        ${row('Lineup', P.fantasy, nGames ? `${nGames} game${nGames === 1 ? '' : 's'} · ${f(P.fan.total)} points × ${cards.COINS_PER_POINT}` : '')}
        ${row('Arcade games', P.arcade || 0, `won ${f(won)} · lost ${f(lost)}${P.arcadePlayed ? ` · ${P.arcadePlayed} game${P.arcadePlayed === 1 ? '' : 's'}` : ''}`, 'pb-arc')}
        ${row('Daily challenges', P.challenges || 0)}
        ${row('Game-day check-ins', P.checkins || 0)}
        ${row('Achievements', P.achieve || 0)}
        ${row('Survivor', P.survivor)}
        ${row('Card sales &amp; rewards', P.bonus)}
        ${row('Spent on packs', -P.spent)}
        <div class="tot"><span>Balance</span><b>${f(acct.balance)}</b></div>
      </div></div>${h.playerCard ? h.playerCard(h.load(), acct) : ''}`;
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
      const totalW = Object.entries(R).filter(([r]) => r !== 'zenith').reduce((s, [, x]) => s + x.weight, 0);
      const paid = cards.packTypes(db).map((t) => cards.packInfo(db, t, ctx)).filter((P) => !P.free && !P.flash && !P.season && !P.allSeasons).map((P) => P.cost);
      const s1Packs = cards.packTypes(db).map((t) => cards.packInfo(db, t, ctx)).filter((P) => (P.season || P.allSeasons) && !P.free), s1Costs = s1Packs.map((P) => P.cost);
      const s1Top = s1Packs.reduce((a, P) => (!a || P.cost > a.cost ? P : a), null);
      const tierPrice = (lo, hi) => { const n = paid.filter((c) => c >= lo && c < hi); const a = Math.min(...n), b = Math.max(...n); return !n.length ? '' : a === b ? fmtN(a) : `${fmtN(a)} to ${fmtN(b)}`; };
      const ones = cards.catalog(db).filter((c) => c.one), left = ones.filter((c) => !taken.has(c.id)).length;
      res.send(layout(req, 'Packs', pickHead(user, acct, 'cards') + `<div class="wrap pshop">${pickNav('/pickem/packs', name)}${packMsg(req)}${h.seasonHero ? h.seasonHero('mini') : ''}
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
          <li>${cards.SHOWN_RARITIES.filter((r) => r !== 'zenith').map((r) => `<span class="rar-tag r-${r}">${R[r].name}</span> ${(R[r].weight / totalW * 100).toFixed(R[r].weight < 100 ? 2 : 0)}%`).join(' · ')} per card in a regular pack. <span class="rar-tag r-zenith">Zenith</span> cards only come from Season ${S1.n} packs. Every pack's own odds are under "What's inside".</li>
          <li><b>Prices follow the odds.</b> Everyday packs ${tierPrice(0, 7500)} coins · bigger packs with guarantees ${tierPrice(7500, 20000)} · Legend-or-better packs, 1 of 1 hunts and Prism or Black set packs ${tierPrice(20000, 100000)} · Dark Matter, The Vault and the Black Label Box ${tierPrice(100000, Infinity)}. The best packs take a real grind.</li>
          <li>Extra copies sell for ${cards.SHOWN_RARITIES.map((r) => `<span class="rar-tag r-${r}">${R[r].name}</span> ${fmtN(R[r].sell)}`).join(' · ')} coins (on <a href="/pickem/cards">My cards</a>). A pack's cards sell for far less than the pack costs.</li>
          <li><b>Every card has its own overall (OVR)</b>, the big number on the front: the better the card, the higher it is. Each rarity has its range (${cards.SHOWN_RARITIES.filter((r) => cards.OVR_BAND[r]).map((r) => `<span class="rar-tag r-${r}">${R[r].name}</span> ${cards.OVR_BAND[r][0]}–${cards.OVR_BAND[r][1]}`).join(' · ')}); better players sit higher in it, the stronger versions of a rarity up to 3 higher, and 1 of 1s 1 more. In the Arcade a card plays at its overall. Flip a card (↻) for its skill changes, perk and fantasy multiplier.</li>
          <li>Better cards multiply fantasy points more: ${cards.VARIANTS.filter((v) => !v.set && !v.hidden && (!v.id.startsWith('spec-') || v.id === 'spec-td')).map((v) => `${esc(v.id === 'spec-td' ? 'Specialists' : v.label)} ${v.mult || R[v.rarity].mult}×`).join(' · ')}.</li>
          ${cards.tierOf ? `<li><b>What each rarity does:</b> every card has a perk (an on-field quirk) and changes its player's ratings, and its rarity adds a boost on top. ${cards.SHOWN_RARITIES.map((r) => { const T = cards.tierOf(r); return `<span class="rar-tag r-${r}">${R[r].name}</span> <b>${esc(T.name)}</b>: ${esc(T.text)}`; }).join(' ')} <a href="/pickem/rules#card-effects">Every card's effect →</a></li>` : ''}
          <li>Specialist cards score ${cards.SPECIAL_BOOST}× on their specialty (TDs, TD passes, interceptions, defense or notable plays). Clutch cards score ${cards.SPECIAL_BOOST}× on wins and MVPs.</li>
          <li>Card sets: ${cards.SETS.length} themed sets with 5 versions of every player each (Base ${cards.PARALLELS[0].mult}×, Silver ${cards.PARALLELS[1].mult}×, Gold ${cards.PARALLELS[2].mult}×, Prism ${cards.PARALLELS[3].mult}×, Black ${cards.PARALLELS[4].mult}×). They only come from set packs.</li>
          <li><b>Season ${S1.n} packs</b> run ${fmtN(Math.min(...s1Costs))} to ${fmtN(Math.max(...s1Costs))} coins. Their cards beat the older cards of the same rarity, and ${esc(s1Top ? s1Top.name : '')} is the best pack in the shop.</li>
          <li>Mythic, Dark Matter and Zenith cards are 1 of 1: once someone pulls one, nobody else can. <b>${left} of ${ones.length}</b> are still out there.</li>
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
    const BX = cards.packInfo.BOXES, boxN = !P.free && BX[+req.body.box] != null ? +req.body.box : 0;
    if (boxN && !cards.packInfo.boxOk(P)) return res.redirect('/pickem/packs?m=nobox');
    const per = boxN ? cards.packInfo.boxPrice(P.cost, boxN) : P.cost;
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
      if (bal < per * (boxN || 1)) return res.redirect('/pickem/packs?m=poor');
    }
    if (boxN) {
      // A box: boxN packs at the box price each, opened now and shown one after another. A 1/1 pulled early in the box can't drop again later in it.
      const taken = await takenOnes(db), boxId = crypto.randomBytes(5).toString('hex'), t0 = Date.now(), made = [];
      for (let i = 0; i < boxN; i++) {
        const ids = cards.openPack(db, type, taken, ctx);
        for (const id of ids) if (cards.cardInfo(db, id)?.one) taken.add(id);
        const pk1 = { id: crypto.randomBytes(6).toString('hex'), type, cost: per, currency: 'coins', at: new Date(t0 + i).toISOString(), local: ctx.now, cards: ids, box: { id: boxId, i, n: boxN },
          ...(cards.PACKS[type] && P.name !== cards.PACKS[type].name ? { name: P.name } : {}), ...(P.base ? { base: P.base } : {}) };
        packs.push(pk1); made.push(pk1);
      }
      await h.putDoc(h.userKey(name), user);
      return res.redirect(`/pickem/packs/${made[0].id}`);
    }
    const ids = cards.openPack(db, type, await takenOnes(db), ctx);
    // Choose packs keep the options in `choices` until the user picks (POST .../pick).
    const pack = { id: crypto.randomBytes(6).toString('hex'), type, cost: P.cost || 0, currency: 'coins', at: new Date().toISOString(), local: ctx.now, cards: P.choose ? [] : ids,
      ...(P.choose ? { choices: ids, keep: P.cards } : {}), ...(cards.PACKS[type] && P.name !== cards.PACKS[type].name ? { name: P.name } : {}), ...(P.base ? { base: P.base } : {}),
      ...(key ? { key } : {}), ...(type === 'prize' ? { week: key } : {}) };
    packs.push(pack);
    // A first pack also sets a full Lineup (one card per player) if there isn't one yet.
    if (type === 'starter' && !(user.lineups || []).length) (user.lineups = []).push({ at: pack.at, local: pack.local, cards: pack.cards.slice(0, cards.LINEUP_SIZE).map((id, i, a) => (a.findIndex((x) => x.split(':')[0] === id.split(':')[0]) === i ? id : '')) });
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

  // The whole box at once: every card from its packs, best first.
  app.get('/pickem/packs/box/:id', async (req, res, next) => {
    try {
      const db = h.load();
      const name = h.currentUser(req);
      if (!name) return res.redirect('/pickem/login?next=/pickem/packs');
      const { user, acct } = await h.loadAccount(db, name);
      const box = (user.packs || []).filter((p) => p.box && p.box.id === req.params.id).sort((a, b) => a.box.i - b.box.i);
      if (!box.length) return res.redirect('/pickem/packs');
      const P = cards.packInfo(db, box[0].type, packCtx(user)) || { name: 'Pack' };
      const n = {}; for (const p of box) for (const id of p.cards) n[id] = (n[id] || 0) + 1;
      const cs = Object.keys(n).map((id) => cards.cardInfo(db, id)).filter(Boolean)
        .sort((a, b) => cards.RARITY_ORDER.indexOf(b.rarity) - cards.RARITY_ORDER.indexOf(a.rarity) || b.mult - a.mult || a.p.name.localeCompare(b.p.name));
      const total = box.reduce((s, p) => s + (p.cost || 0), 0), nCards = box.reduce((s, p) => s + p.cards.length, 0);
      const byR = cards.RARITY_ORDER.map((r) => [r, cs.filter((c) => c.rarity === r).reduce((s, c) => s + n[c.id], 0)]).filter(([r, k]) => k && !(R[r].hidden && !cs.some((c) => c.rarity === r)));
      const Pnow = cards.packInfo(db, box[0].type, packCtx(user)), again = Pnow && cards.packInfo.boxOk(Pnow) ? cards.packInfo.boxPrice(Pnow.cost, box.length) * box.length : 0;
      res.send(layout(req, 'Box', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/packs', name)}
        <div class="rv-head">${packArt(db, P, { cls: 'pkart-sm', title: String(P.name).replace(/ Pack$/, '') })}<div class="rv-t"><span class="rv-box">Box of ${box.length}</span><h2>${esc(P.name)}</h2><p class="muted">${nCards} cards from ${box.length} packs · ${icon('coin')}${fmtN(total)} · ${byR.map(([r, k]) => `<span class="rar-tag r-${r}">${k} ${esc(R[r].name)}</span>`).join(' ')}</p></div></div>
        <div class="mgrid box-grid">${cs.map((c) => `<div class="mcell">${h.cardArt(db, c, { count: n[c.id] })}</div>`).join('')}</div>
        <div class="reveal-go box-go"><a class="btn" href="/pickem/cards">Go to my cards</a>${again ? `<form method="post" action="/pickem/packs/open" class="rv-again"><input type="hidden" name="type" value="${esc(box[0].type)}"><input type="hidden" name="box" value="${box.length}"><button class="btn ghost"${again > acct.balance ? ' disabled' : ''}>Another box of ${box.length} · ${icon('coin')}${fmtN(again)}</button></form>` : ''}<a class="btn ghost" href="/pickem/packs#pk-${esc(box[0].type)}">Back to the shop</a></div>
        <details class="card box-packs"><summary>Pack by pack</summary><ol>${box.map((p) => { const b = p.cards.map((id) => cards.cardInfo(db, id)).filter(Boolean).reduce((m, c) => (cards.RARITY_ORDER.indexOf(c.rarity) > cards.RARITY_ORDER.indexOf(m.rarity) ? c : m), { rarity: 'common' }); return `<li><a href="/pickem/packs/${esc(p.id)}">Pack ${p.box.i + 1}</a> · ${p.cards.length} cards${b.p ? ` · best: <span class="rar-tag r-${b.rarity}">${esc(b.rarityName)}</span> ${esc(b.p.name)}, ${esc(b.label)}` : ''}</li>`; }).join('')}</ol></details>
      </div>`));
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
      // A pack from a box: "Pack 3 of 10", then Next (or the whole box after the last one).
      const box = pack.box ? (user.packs || []).filter((p) => p.box && p.box.id === pack.box.id).sort((a, b) => a.box.i - b.box.i) : null;
      const next = box ? box[box.indexOf(pack) + 1] : null, boxN = box ? box.length : 0, boxAt = box ? box.indexOf(pack) + 1 : 0;
      const boxCost = box && Pnow && cards.packInfo.boxOk(Pnow) ? cards.packInfo.boxPrice(Pnow.cost, boxN) * boxN : 0;
      const again = Pnow && !Pnow.free && !Pnow.off && Pnow.limit !== 'day' ? (box ? (boxCost ? `<form method="post" action="/pickem/packs/open" class="rv-again"><input type="hidden" name="type" value="${esc(pack.type)}"><input type="hidden" name="box" value="${boxN}"><button class="btn ghost"${boxCost > acct.balance ? ' disabled' : ''}>Another box of ${boxN} · ${icon('coin')}${fmtN(boxCost)}</button></form>` : '')
        : `<form method="post" action="/pickem/packs/open" class="rv-again"><input type="hidden" name="type" value="${esc(pack.type)}"><button class="btn ghost"${Pnow.cost > acct.balance ? ' disabled' : ''}>Open another · ${icon('coin')}${fmtN(Pnow.cost)}</button></form>`) : '';
      const goBtns = box && next ? `<a class="btn rv-next" href="/pickem/packs/${esc(next.id)}">Next pack (${boxAt + 1} of ${boxN}) →</a><a class="btn ghost" href="/pickem/packs/box/${esc(pack.box.id)}">Skip to the whole box</a>`
        : box ? `<a class="btn rv-next" href="/pickem/packs/box/${esc(pack.box.id)}">See the whole box (${boxN} packs) →</a>${again}<a class="btn ghost" href="/pickem/packs#pk-${esc(pack.type)}">Back to the shop</a>`
          : `<a class="btn" href="/pickem/cards">Go to my cards</a>${again}<a class="btn ghost" href="/pickem/packs#pk-${esc(pack.type)}">Back to the shop</a>`;
      res.send(layout(req, 'Pack', pickHead(user, acct, 'cards') + `<div class="wrap">${pickNav('/pickem/packs', name)}${packMsg(req)}
        <div class="rv-head">${packArt(db, P, { cls: 'pkart-sm', title: String(title).replace(/^Flash Sale: /, '').replace(/ Pack$/, '') })}<div class="rv-t">${box ? `<span class="rv-box">Box · pack ${boxAt} of ${boxN}</span>` : ''}<h2>${esc(title)}</h2><p class="muted">${sub}</p></div><button class="btn ghost sm" id="flipAll" type="button">Reveal all</button></div>
        <div class="reveal best-${bestR}${pending ? ' choose' : ''}"${pending ? ` data-notap data-keep="${keep}"` : ''} style="--p1:${esc(c1)};--p2:${esc(c2)}">
          ${cs.map((c, i) => `<div class="flip r-${c.rarity}${choose && !pending ? (kept.has(c.id) ? ' kept' : ' gone') : ''}" data-id="${esc(c.id)}" style="--d:${i * 70}ms" tabindex="0" role="button" aria-label="${pending ? `Card ${i + 1}: reveal it, then press to keep it` : `Reveal card ${i + 1}`}"><div class="flip-in"><div class="flip-back"><span class="fb-e">${t ? logo(t, 40) : esc(art.e || '🏈')}</span><span class="fb-l">MFL</span></div><div class="flip-front">${cardArt(db, c, { back: true })}</div></div>${pending ? '<span class="rv-keep">✓ Keep</span>' : choose && !kept.has(c.id) ? '<span class="rv-gone">Back in the box</span>' : ''}</div>`).join('')}
        </div>
        ${pending ? `<form method="post" action="/pickem/packs/${esc(pack.id)}/pick" class="rv-pick"><input type="hidden" name="cards" id="pickIn"><span id="pickMsg">Tap ${keep === 1 ? 'a card' : keep + ' cards'} to keep.</span><button class="btn" id="pickBtn" disabled>Keep</button></form>` : ''}
        <div class="reveal-go" hidden>${pending ? '' : goBtns}</div>
        <p class="muted sm center rv-tip">Tap a card (or its ↻ button) to flip it over and read the back.</p>
        <script>(()=>{const rv=document.querySelector('.reveal'),fl=[...rv.querySelectorAll('.flip')],go=document.querySelector('.reveal-go'),all=document.getElementById('flipAll'),choose=rv.classList.contains('choose');
          const ORDER=${JSON.stringify(cs.some((c) => c.hidden) ? cards.RARITY_ORDER : cards.SHOWN_RARITIES)},tier=(f)=>ORDER.findIndex((r)=>f.classList.contains('r-'+r)),calm=matchMedia('(prefers-reduced-motion: reduce)').matches,key='mfl-rv-${esc(pack.id)}';
          let seen=${req.query.m === 'kept' ? 'true' : 'false'},timer=0;try{seen=seen||!!sessionStorage.getItem(key);}catch(e){}
          const done=()=>{if(!fl.every((f)=>f.classList.contains('on')))return;go.hidden=false;all.hidden=true;rv.classList.add('all-on');try{sessionStorage.setItem(key,'1');}catch(e){}const nx=go.querySelector('.rv-next');if(nx)nx.focus({preventScroll:true});};
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
