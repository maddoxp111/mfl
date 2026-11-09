// Blackjack in the Arcade: bet coins against the dealer, one hand at a time. Everything happens on the server: the shoe, every
// card and the result. The page only sees the cards dealt so far, and the dealer's hole card once the hand is over.
//
// Rules (BJ below): 6 decks shuffled fresh for every hand, dealer stands on all 17s (hits soft 16 and under), blackjack pays 3:2
// (the half-coin rounded down), a push gives the bet back. The dealer peeks when showing an ace or a ten card: a dealer
// blackjack ends the hand at once and only the first bet is lost. Double down on any first two cards (also after a split, not
// on split aces): the bet doubles and you get one card. Split a pair once (any two cards of the same value, so a king and a
// queen split too): each hand is played in turn, split aces get one card each, and 21 after a split is not a blackjack.
// No insurance. Each hand bets BJ.min to BJ.max coins, never more than the balance, and doubling or splitting needs the
// balance to cover the extra bet (the same as Risk mode, which needs the stake up front).
//
// Each hand is a match in user.arcade: { id, game: 'blackjack', stake, payout, status, at, local, bj }. While it is being
// played it is 'open' (its stake counts as spent, like any open Arcade game); when it ends it is 'won' / 'lost' (by the hand's
// net) or 'void' when it nets zero (a push). Doubles and splits raise the stake. A hand left unfinished is never forfeited: the
// page picks it up again on a reload, and it is played out as if you stood when you deal the next hand, or come back after
// BJ.resumeMin minutes. Other Arcade games never forfeit it (arcade.js skips blackjack hands).
// Only the last BJ.keep finished hands stay in user.arcade; older ones fold into user.bjOld (their stake, payout and net), so a
// lot of hands never pushes other Arcade games out of user.arcade and the coin totals stay exactly the same.
const crypto = require('crypto');

const BJ = { name: 'Blackjack', emoji: '♠️', tag: 'Beat the dealer to 21. Bet up to 150,000 a hand.', min: 100, max: 150000, decks: 6, pays: [3, 2], dealerStandsSoft17: true, keep: 100, resumeMin: 30 };

// ---------- the rules engine (pure: give it a shoe, it plays the hand) ----------
const RANKS = 'A23456789TJQK', SUITS = 'SHDC';
const val = (c) => (c[0] === 'A' ? 1 : 'TJQK'.includes(c[0]) ? 10 : +c[0]);
function total(cards) {
  let t = 0, ace = false;
  for (const c of cards) { t += val(c); if (c[0] === 'A') ace = true; }
  const soft = ace && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}
const natural = (h) => !h.split && h.cards.length === 2 && total(h.cards).total === 21;
const bjWin = (bet) => Math.floor((bet * BJ.pays[0]) / BJ.pays[1]);

// A shuffled 6-deck shoe from a random seed: Fisher-Yates driven by HMAC-SHA256(key, seed:block), unbiased (rejection sampling).
function shoeFor(seed, key) {
  const cards = [];
  for (let d = 0; d < BJ.decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
  let block = 0, buf = Buffer.alloc(0), off = 0;
  const u32 = () => {
    if (off + 4 > buf.length) { buf = crypto.createHmac('sha256', String(key || 'mfl-bj')).update(seed + ':' + block++).digest(); off = 0; }
    const v = buf.readUInt32BE(off); off += 4; return v;
  };
  const below = (n) => { const lim = Math.floor(0x100000000 / n) * n; let v; do v = u32(); while (v >= lim); return v % n; };
  for (let i = cards.length - 1; i > 0; i--) { const j = below(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

// s: { base, pos, dealer: [cards], hands: [{ cards, bet, doubled, split, aces, done, outcome, payout }], cur, phase, peek }
function deal(bet, shoe) {
  const s = { base: bet, pos: 0, dealer: [], hands: [{ cards: [], bet, doubled: false, split: false, aces: false, done: false }], cur: 0, phase: 'player', peek: false };
  const draw = () => shoe[s.pos++], h = s.hands[0];
  h.cards.push(draw()); s.dealer.push(draw()); h.cards.push(draw()); s.dealer.push(draw());
  s.peek = val(s.dealer[0]) === 1 || val(s.dealer[0]) === 10; // the dealer checks the hole card for blackjack
  const dealerBJ = s.peek && total(s.dealer).total === 21;
  if (natural(h) || dealerBJ) { h.done = true; finish(s, shoe); }
  return s;
}
// What the player may do now. afford(n): can the balance cover n more coins.
function legal(s, afford = () => true) {
  const h = s.phase === 'player' && s.hands[s.cur];
  if (!h || h.done) return { hit: false, stand: false, double: false, split: false };
  return {
    hit: !h.aces, stand: true,
    double: h.cards.length === 2 && !h.aces && !!afford(h.bet),
    split: s.hands.length === 1 && h.cards.length === 2 && val(h.cards[0]) === val(h.cards[1]) && !!afford(h.bet),
  };
}
// The hand in play is done: move to the next one (a split hand gets its second card now), or let the dealer play.
function advance(s, shoe) {
  const draw = () => shoe[s.pos++];
  while (s.cur < s.hands.length && s.hands[s.cur].done) {
    s.cur++;
    const h = s.hands[s.cur];
    if (h && h.cards.length === 1) { h.cards.push(draw()); if (h.aces || total(h.cards).total === 21) h.done = true; }
  }
  if (s.cur >= s.hands.length) finish(s, shoe);
}
function act(s, action, shoe, afford = () => true) {
  const can = legal(s, afford);
  if (!can[action]) return { ok: false, error: s.phase !== 'player' ? 'That hand is over.' : action === 'double' || action === 'split' ? `You can't ${action} now${s.hands[s.cur] && s.hands[s.cur].cards.length === 2 && !afford(s.hands[s.cur].bet) ? ': not enough coins' : ''}.` : `You can't ${action} now.` };
  const draw = () => shoe[s.pos++], h = s.hands[s.cur];
  if (action === 'hit') { h.cards.push(draw()); if (total(h.cards).total >= 21) h.done = true; }
  else if (action === 'stand') h.done = true;
  else if (action === 'double') { h.bet *= 2; h.doubled = true; h.cards.push(draw()); h.done = true; }
  else if (action === 'split') {
    const [a, b] = h.cards, aces = a[0] === 'A';
    s.hands = [{ cards: [a], bet: h.bet, doubled: false, split: true, aces, done: false }, { cards: [b], bet: h.bet, doubled: false, split: true, aces, done: false }];
    const f = s.hands[0]; f.cards.push(draw()); if (aces || total(f.cards).total === 21) f.done = true;
  }
  advance(s, shoe);
  return { ok: true };
}
// Played out as if the player stood on everything left (a hand left unfinished).
function standAll(s, shoe) { let n = 0; while (s.phase === 'player' && n++ < 10) act(s, 'stand', shoe, () => false); return s; }
// The dealer plays (unless every hand busted, or the hand ended on a blackjack), then every hand is paid.
function finish(s, shoe) {
  const draw = () => shoe[s.pos++];
  const dealerBJ = total(s.dealer).total === 21 && s.dealer.length === 2;
  const live = s.hands.some((h) => total(h.cards).total <= 21) && !(s.hands.length === 1 && natural(s.hands[0])) && !(s.peek && dealerBJ);
  if (live) while (total(s.dealer).total < 17) s.dealer.push(draw()); // stands on all 17s, soft ones too
  const d = total(s.dealer).total;
  for (const h of s.hands) {
    const t = total(h.cards).total;
    if (natural(h)) [h.outcome, h.payout] = dealerBJ ? ['push', h.bet] : ['blackjack', h.bet + bjWin(h.bet)];
    else if (dealerBJ && s.peek && s.hands.length === 1 && h.cards.length === 2) [h.outcome, h.payout] = ['dealerbj', 0];
    else if (t > 21) [h.outcome, h.payout] = ['bust', 0];
    else if (d > 21 || t > d) [h.outcome, h.payout] = ['win', 2 * h.bet];
    else if (t === d) [h.outcome, h.payout] = ['push', h.bet];
    else [h.outcome, h.payout] = ['lose', 0];
    h.done = true;
  }
  s.phase = 'done'; s.cur = s.hands.length;
  return s;
}
const stakeOf = (s) => s.hands.reduce((t, h) => t + h.bet, 0);
const payoutOf = (s) => (s.phase === 'done' ? s.hands.reduce((t, h) => t + h.payout, 0) : 0);

// ---------- labels (coin history, recent hands) ----------
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const OUT_WORD = { blackjack: 'blackjack', win: 'win', push: 'push', lose: 'lose', bust: 'bust', dealerbj: 'dealer blackjack' };
// "won 3,000 (blackjack 3:2)", "lost 1,000 (bust)", "push", "won 1,000 (split: win · push)"
function label(m) {
  const b = m.bj || {}, hs = b.hands || [];
  if (m.status === 'open') return 'in progress';
  const net = (m.payout || 0) - (m.stake || 0);
  const head = net > 0 ? `won ${fmt(net)}` : net < 0 ? `lost ${fmt(-net)}` : 'push';
  let why = '';
  if (hs.length > 1) why = `split: ${hs.map((h) => OUT_WORD[h.outcome] || h.outcome).join(' · ')}`;
  else if (hs[0]) { const h = hs[0]; why = h.outcome === 'blackjack' ? `blackjack ${BJ.pays.join(':')}` : h.outcome === 'bust' ? 'bust' : h.outcome === 'dealerbj' ? 'dealer blackjack' : h.outcome === 'push' ? '' : ''; if (h.doubled) why = why ? `doubled, ${why}` : 'doubled'; }
  if (m.refund) why = 'refunded';
  return why ? `${head} (${why})` : head;
}
// "Bet 2,000 · you 20, dealer 18"
function detail(m) {
  const b = m.bj || {}, hs = b.hands || [];
  if (!hs.length) return '';
  const you = hs.map((h) => (natural(h) ? 'blackjack' : total(h.cards).total)).join(' and ');
  return `Bet ${fmt(b.base || m.stake)} · you ${you}${m.status === 'open' ? '' : `, dealer ${b.dealer && b.dealer.length === 2 && total(b.dealer).total === 21 ? 'blackjack' : total(b.dealer || []).total}`}`;
}

// ---------- routes ----------
module.exports = function blackjack(app, h) {
  const { esc, icon, layout, pk, TZ, load, getDoc, putDoc, userKey, currentUser, coins } = h;
  const key = (seed) => (h.sign ? h.sign('blackjack:' + seed) : 'mfl-bj');
  const shoeOf = (m) => shoeFor(m.bj.seed, key(m.bj.seed));
  const json = (res, o) => res.set('Cache-Control', 'no-store').json(o);
  const balanceOf = async (db, user) => h.accountOf(db, user, await h.survivorNow(db)).balance;

  // write a hand's state back onto its match: stake, payout, status, and the record once it is over
  function sync(m) {
    const s = m.bj;
    m.stake = stakeOf(s);
    if (s.phase !== 'done') { m.status = 'open'; m.payout = 0; return m; }
    m.payout = payoutOf(s);
    const net = m.payout - m.stake;
    m.status = net > 0 ? 'won' : net < 0 ? 'lost' : 'void';
    for (const x of s.hands) { x.total = total(x.cards).total; delete x.done; if (!x.split) delete x.split; if (!x.aces) delete x.aces; if (!x.doubled) delete x.doubled; }
    s.dealerTotal = total(s.dealer).total;
    s.result = s.hands.length > 1 ? (net > 0 ? 'won' : net < 0 ? 'lost' : 'push') : s.hands[0].outcome;
    m.ended = new Date().toISOString();
    delete s.seed; delete s.pos; delete s.cur; delete s.peek; // the rest of the shoe is never needed again
    return m;
  }
  // Every unfinished hand is played out as if the player stood (never forfeited). Returns the hands it settled.
  function settleOpen(user, filter) {
    const out = [];
    for (const m of user.arcade || []) if (m.game === 'blackjack' && m.status === 'open' && m.bj && (!filter || filter(m))) { standAll(m.bj, shoeOf(m)); sync(m); m.bj.auto = true; out.push(m); }
    return out;
  }
  h.blackjackSettle = settleOpen;
  // keep the last BJ.keep finished hands; fold older ones into user.bjOld (stake, payout and net stay counted)
  function fold(user) {
    const done = (user.arcade || []).filter((m) => m.game === 'blackjack' && m.status !== 'open');
    if (done.length <= BJ.keep) return;
    const old = new Set(done.slice(0, done.length - BJ.keep));
    const o = user.bjOld = user.bjOld || { hands: 0, stake: 0, payout: 0, won: 0, lost: 0, push: 0, wonNet: 0, lostNet: 0, from: null, to: null };
    for (const m of old) {
      const net = m.status === 'void' ? 0 : (m.payout || 0) - (m.stake || 0);
      o.hands++; o.stake += m.stake || 0; o.payout += net + (m.stake || 0);
      if (net > 0) { o.won++; o.wonNet += net; } else if (net < 0) { o.lost++; o.lostNet += -net; } else o.push++;
      if (!o.from) o.from = m.at; o.to = m.at;
    }
    user.arcade = user.arcade.filter((m) => !old.has(m));
  }
  // What the page sees: the dealer's hole card stays hidden until the hand is over.
  function view(m, bal) {
    const s = m.bj, done = s.phase === 'done';
    const afford = (n) => bal >= n;
    const dealer = done ? s.dealer : [s.dealer[0], null];
    const can = done ? { hit: false, stand: false, double: false, split: false } : legal(s, afford);
    return {
      id: m.id, bet: s.base, stake: m.stake, status: m.status, done, payout: done ? m.payout : 0, net: done ? m.payout - m.stake : null, label: done ? label(m) : '',
      dealer: { cards: dealer, total: done ? total(s.dealer).total : total([s.dealer[0]]).total, blackjack: done && s.dealer.length === 2 && total(s.dealer).total === 21 },
      hands: s.hands.map((x, i) => ({ cards: x.cards, total: total(x.cards).total, soft: total(x.cards).soft, bet: x.bet, doubled: !!x.doubled, split: !!x.split, outcome: x.outcome || null, payout: done ? x.payout : null, active: !done && i === s.cur, blackjack: natural(x) })),
      can, auto: !!s.auto,
    };
  }
  const recentOf = (user) => (user.arcade || []).filter((m) => m.game === 'blackjack' && m.status !== 'open' && m.bj).slice(-8).reverse()
    .map((m) => ({ id: m.id, at: m.at, net: m.status === 'void' ? 0 : m.payout - m.stake, label: label(m), detail: detail(m), cards: { dealer: m.bj.dealer, hands: (m.bj.hands || []).map((x) => x.cards) } }));
  const resumable = (m) => Date.now() - Date.parse(m.at) < BJ.resumeMin * 60e3;

  // One action at a time per player (a double tap can't play a card twice).
  const locks = new Map();
  function locked(name, fn) {
    const prev = locks.get(name) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => {}).then(() => { if (locks.get(name) === tail) locks.delete(name); });
    locks.set(name, tail);
    return run;
  }

  // the state of the table: the hand in play (or the last one), the balance and the recent hands
  app.get('/arcade/blackjack/state', async (req, res) => {
    try {
      const name = currentUser(req);
      if (!name) return json(res, { ok: true, user: null, limits: { min: BJ.min, max: BJ.max } });
      await locked(name, async () => {
        const db = load(), user = await getDoc(userKey(name), { fresh: true });
        const stale = settleOpen(user, (m) => !resumable(m)); // left for too long: played out as a stand
        if (stale.length) { fold(user); await putDoc(userKey(name), user); }
        const bal = await balanceOf(db, user);
        const open = (user.arcade || []).find((m) => m.game === 'blackjack' && m.status === 'open' && m.bj);
        json(res, { ok: true, user: name, balance: bal, limits: { min: BJ.min, max: BJ.max }, hand: open ? view(open, bal) : stale.length ? view(stale.at(-1), bal) : null, recent: recentOf(user) });
      });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not load the table.' }); }
  });

  app.post('/arcade/blackjack/deal', async (req, res) => {
    try {
      const name = currentUser(req);
      if (!name) return json(res, { ok: false, error: 'Log in to play Blackjack.' });
      const raw = req.body && req.body.bet, bet = typeof raw === 'number' ? raw : /^\s*\d+\s*$/.test(String(raw)) ? Number(raw) : NaN;
      if (!Number.isSafeInteger(bet) || bet < BJ.min || bet > BJ.max) return json(res, { ok: false, error: `Bet a whole number of coins from ${fmt(BJ.min)} to ${fmt(BJ.max)}.` });
      await locked(name, async () => {
        const db = load(), user = await getDoc(userKey(name), { fresh: true });
        user.arcade = user.arcade || [];
        const settled = settleOpen(user); // a hand still open is played out as a stand first
        const bal = await balanceOf(db, user);
        if (bet > bal) {
          if (settled.length) { fold(user); await putDoc(userKey(name), user); }
          return json(res, { ok: false, error: `You have ${fmt(bal)} coins: bet that or less.`, balance: bal, settled: settled.map((m) => view(m, bal)) });
        }
        const seed = crypto.randomBytes(16).toString('hex');
        const m = { id: crypto.randomBytes(6).toString('hex'), game: 'blackjack', stake: bet, payout: 0, status: 'open', at: new Date().toISOString(), local: pk.nowLocal(TZ), bj: null };
        const s = deal(bet, shoeFor(seed, key(seed)));
        s.seed = seed;
        m.bj = s;
        sync(m);
        user.arcade.push(m);
        fold(user);
        if (user.arcade.length > 600) user.arcade = user.arcade.slice(-600);
        await putDoc(userKey(name), user);
        const after = await balanceOf(db, user);
        json(res, { ok: true, hand: view(m, after), balance: after, settled: settled.map((x) => view(x, after)), recent: recentOf(user) });
      });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not deal.' }); }
  });

  for (const action of ['hit', 'stand', 'double', 'split']) {
    app.post('/arcade/blackjack/' + action, async (req, res) => {
      try {
        const name = currentUser(req);
        if (!name) return json(res, { ok: false, error: 'Log in again.' });
        await locked(name, async () => {
          const db = load(), user = await getDoc(userKey(name), { fresh: true });
          const m = (user.arcade || []).find((x) => x.id === String((req.body && req.body.id) || '') && x.game === 'blackjack');
          if (!m || !m.bj) return json(res, { ok: false, error: 'That hand was not found.' });
          if (m.status !== 'open' || m.bj.phase !== 'player') return json(res, { ok: false, error: 'That hand is over.', hand: view(m, await balanceOf(db, user)) });
          const bal = await balanceOf(db, user);
          const r = act(m.bj, action, shoeOf(m), (n) => bal >= n);
          if (!r.ok) return json(res, { ok: false, error: r.error, hand: view(m, bal) });
          sync(m);
          if (m.status !== 'open') fold(user);
          await putDoc(userKey(name), user);
          const after = await balanceOf(db, user);
          json(res, { ok: true, hand: view(m, after), balance: after, recent: m.status !== 'open' ? recentOf(user) : undefined });
        });
      } catch (e) { console.error(e); json(res, { ok: false, error: 'Something went wrong. Try again.' }); }
    });
  }

  app.get('/arcade/blackjack', async (req, res, next) => {
    try {
      const name = currentUser(req);
      const { user, acct } = await h.loadAccount(load(), name);
      const chips = [[100, '100'], [1000, '1K'], [10000, '10K'], [50000, '50K']];
      res.send(layout(req, 'Blackjack', `<div class="wrap arc-page bj-page">
        <div class="arc-head"><a href="/arcade" class="muted sm">${icon('arrow')} Arcade</a><h1><span>${BJ.emoji}</span> Blackjack</h1><p class="muted">${esc(BJ.tag)}</p>${user ? `<span class="arc-bal" id="bjBal">${coins(acct.balance)}</span>` : ''}</div>
        <section class="bj-table" id="bjTable">
          <div class="bj-felt">
            <div class="bj-seat bj-dealer"><div class="bj-lbl">Dealer <b class="bj-tot" id="bjDTot"></b></div><div class="bj-cards" id="bjDealer"></div></div>
            <div class="bj-arc" aria-hidden="true">Blackjack pays ${BJ.pays.join(' to ')} · Dealer stands on all 17s</div>
            <div class="bj-banner" id="bjBanner" role="status" aria-live="polite" hidden></div>
            <div class="bj-hands" id="bjHands"></div>
          </div>
          <div class="bj-ctl">
            <div class="bj-acts" id="bjActs">
              <button class="btn" data-act="hit" disabled>Hit</button><button class="btn" data-act="stand" disabled>Stand</button><button class="btn ghost" data-act="double" disabled>Double</button><button class="btn ghost" data-act="split" disabled>Split</button>
            </div>
            ${user ? `<form class="bj-bet" id="bjBet" autocomplete="off">
              <label class="bj-amt"><span>Bet</span><input id="bjAmt" name="bet" type="number" inputmode="numeric" min="${BJ.min}" max="${BJ.max}" step="1" value="${BJ.min}" aria-label="Bet in coins"></label>
              <div class="bj-chips">${chips.map(([v, t]) => `<button type="button" class="bj-chip c${v}" data-chip="${v}" aria-label="Add ${fmt(v)}">${t}</button>`).join('')}<button type="button" class="bj-chip cmax" data-chip="max" aria-label="Max bet">MAX</button><button type="button" class="bj-clear" data-chip="clear">Clear</button></div>
              <button type="submit" class="btn bj-deal" id="bjDeal">${icon('fire')} Deal</button>
              <p class="bj-msg" id="bjMsg" role="alert"></p>
            </form>` : `<div class="bj-login"><p>Log in to bet coins at the table.</p><a class="btn" href="/pickem/login?next=/arcade/blackjack">Log in</a> <a class="btn ghost" href="/pickem/signup?next=/arcade/blackjack">Sign up free</a></div>`}
          </div>
        </section>
        <div class="bj-low">
          ${user ? `<section class="card bj-recent"><div class="card-h"><h2>Recent hands</h2></div><ol class="lb" id="bjRecent"><li class="muted">No hands yet.</li></ol></section>` : ''}
          <section class="card"><div class="card-h"><h2>How it works</h2></div><ul class="how">
            <li>Bet ${fmt(BJ.min)} to ${fmt(BJ.max)} coins a hand (never more than you have). Get closer to 21 than the dealer without going over.</li>
            <li>A win pays 1 to 1. A <b>blackjack</b> (an ace and a ten card) pays <b>${BJ.pays.join(' to ')}</b>: ${fmt(BJ.max)} wins ${fmt(bjWin(BJ.max))}. A tie is a push: your bet comes back.</li>
            <li><b>Double</b> on any first two cards: your bet doubles and you get one more card. <b>Split</b> a pair once into two hands, each with its own bet; split aces get one card each, and 21 after a split is not a blackjack. Doubling and splitting need the coins to cover the extra bet.</li>
            <li>The dealer stands on all 17s and checks for blackjack when showing an ace or a ten. ${BJ.decks} decks, shuffled fresh for every hand. No insurance.</li>
            <li>Leave in the middle of a hand and nothing is lost: it's still here when you come back, and it's played out as a stand when you deal the next hand (or come back after ${BJ.resumeMin} minutes).</li>
          </ul></section>
        </div>
      </div><style>${CSS}</style><script>window.MFL_BJ=${JSON.stringify({ user: user ? user.name : null, min: BJ.min, max: BJ.max, balance: user ? acct.balance : null }).replace(/</g, '\\u003c')};${CLIENT}</script>`));
    } catch (e) { next(e); }
  });

  return { settleOpen, fold, label, detail };
};

const CSS = `
.bj-table{border-radius:24px;overflow:hidden;border:1px solid rgba(255,194,26,.35);background:var(--card);margin-bottom:18px}
.bj-felt{position:relative;padding:18px 18px 22px;min-height:380px;display:flex;flex-direction:column;gap:14px;background:radial-gradient(120% 90% at 50% 0%,#17784a 0%,#0e5a37 45%,#083a24 100%);box-shadow:inset 0 0 0 6px #3b2412,inset 0 0 0 8px rgba(255,194,26,.35),inset 0 20px 60px rgba(0,0,0,.35)}
.bj-seat{display:flex;flex-direction:column;align-items:center;gap:8px}
.bj-lbl{font:700 12px Inter;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:8px}
.bj-tot{display:inline-flex;min-width:28px;justify-content:center;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.4);color:#fff;font:800 14px var(--disp);letter-spacing:0}
.bj-tot:empty{display:none}
.bj-cards{display:flex;justify-content:center;min-height:98px;padding-left:22px}
.bj-card{--w:68px;width:var(--w);height:calc(var(--w)*1.4);margin-left:-22px;border-radius:8px;background:#fdfdfb;color:#111;position:relative;box-shadow:0 2px 0 rgba(0,0,0,.15),0 6px 14px rgba(0,0,0,.35);font-family:Georgia,'Times New Roman',serif;flex:none}
.bj-card.red{color:#c8102e}
.bj-card .ix{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:.95;font-weight:700;font-size:calc(var(--w)*.27)}
.bj-card .ix i{font-style:normal;font-size:calc(var(--w)*.22)}
.bj-card .tl{top:5px;left:6px}.bj-card .br{bottom:5px;right:6px;transform:rotate(180deg)}
.bj-card .pip{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--w)*.52)}
.bj-card .pip.face{font:700 calc(var(--w)*.42) Georgia,serif}
.bj-card.back{background:repeating-linear-gradient(45deg,#b91c1c 0 6px,#991b1b 6px 12px);border:4px solid #fdfdfb}
.bj-card.back::after{content:'';position:absolute;inset:6px;border:2px solid rgba(255,255,255,.45);border-radius:4px}
.bj-card.new{animation:bjIn .28s ease-out both}
@keyframes bjIn{from{transform:translate(30px,-40px) rotate(8deg);opacity:0}to{transform:none;opacity:1}}
.bj-arc{text-align:center;font:700 11px Inter;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,214,102,.75);border-top:1px solid rgba(255,214,102,.25);border-bottom:1px solid rgba(255,214,102,.25);padding:6px 0;margin:0 8%}
.bj-banner{align-self:center;padding:10px 18px;border-radius:14px;font:800 18px var(--disp);text-transform:uppercase;letter-spacing:.02em;background:rgba(0,0,0,.55);color:#fff;text-align:center;border:1px solid rgba(255,255,255,.15)}
.bj-banner.win{background:rgba(22,163,74,.9);border-color:#4ade80}.bj-banner.lose{background:rgba(185,28,28,.9);border-color:#f87171}.bj-banner.push{background:rgba(30,41,59,.92)}
.bj-banner small{display:block;font:600 12.5px Inter;text-transform:none;letter-spacing:0;opacity:.9;margin-top:2px}
.bj-hands{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}
.bj-hand{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 10px 10px;border-radius:16px;border:2px solid transparent;transition:.15s}
.bj-hand.active{border-color:rgba(255,214,102,.8);background:rgba(255,214,102,.08)}
.bj-hand .bj-chipbet{font:800 12px Inter;color:#fcd34d;background:rgba(0,0,0,.45);padding:3px 10px;border-radius:999px}
.bj-hand .oc{font:800 11px Inter;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff}
.bj-hand .oc.win,.bj-hand .oc.blackjack{background:#16a34a}.bj-hand .oc.lose,.bj-hand .oc.bust,.bj-hand .oc.dealerbj{background:#b91c1c}
.bj-empty{color:rgba(255,255,255,.6);font-size:14px;text-align:center;padding:30px 0}
.bj-ctl{padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line2)}
.bj-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bj-acts .btn{justify-content:center;padding:13px 6px;font-size:15px}
.bj-bet{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
.bj-amt{display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--line2);border-radius:999px;padding:4px 6px 4px 14px}
.bj-amt span{font:700 11px Inter;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.bj-amt input{width:110px;background:transparent;border:0;color:#fcd34d;font:800 18px var(--disp);padding:6px 4px;outline:none;-moz-appearance:textfield}
.bj-amt input::-webkit-inner-spin-button,.bj-amt input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.bj-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.bj-chip{width:46px;height:46px;border-radius:50%;border:3px dashed rgba(255,255,255,.85);color:#fff;font:800 12px Inter;cursor:pointer;box-shadow:0 0 0 3px rgba(0,0,0,.35),0 4px 10px rgba(0,0,0,.4);flex:none}
.bj-chip.c100{background:#2563eb}.bj-chip.c1000{background:#16a34a}.bj-chip.c10000{background:#111;border-color:#fcd34d;color:#fcd34d}.bj-chip.c50000{background:#7c3aed}.bj-chip.cmax{background:#dc2626}
.bj-chip:active{transform:scale(.94)}
.bj-clear{background:none;border:0;color:var(--muted);font:600 13px Inter;cursor:pointer;padding:6px}
.bj-deal{justify-content:center;min-width:120px}
.bj-msg{grid-column:1/-1;margin:0;color:#ff8a95;font-size:13.5px;min-height:0}
.bj-msg:empty{display:none}
.bj-login{text-align:center}.bj-login p{margin:0 0 10px;color:var(--ink2)}
.bj-low{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.bj-recent .lb li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:baseline}
.bj-recent .lb b{font-size:14px}
.bj-recent .lb small{grid-column:1/-1;margin:0}
.bj-recent .lb .amt{font-weight:800;white-space:nowrap}.bj-recent .lb .up{color:#4ade80}.bj-recent .lb .down{color:#ff6b7a}.bj-recent .lb .zero{color:var(--muted)}
.bj-mini{grid-column:1/-1;color:var(--muted);font-size:12px;letter-spacing:.02em}
@media(max-width:760px){
  .bj-felt{padding:14px 10px 16px;min-height:330px;gap:10px}
  .bj-card{--w:54px;margin-left:-20px}
  .bj-cards{min-height:76px;padding-left:20px}
  .bj-hands{gap:6px}
  .bj-hand{padding:6px 4px 8px}
  .bj-hands.two .bj-card{--w:46px;margin-left:-22px}
  .bj-bet{grid-template-columns:1fr auto}
  .bj-chips{grid-column:1/-1;order:3;justify-content:space-between}
  .bj-chip{width:44px;height:44px;font-size:11.5px}
  .bj-amt input{width:100%}
  .bj-low{grid-template-columns:1fr}
  .bj-banner{font-size:16px}
}`;

// The page script: draws the table from what the server sends, and sends each action as a JSON POST.
const CLIENT = `(function(){
var C=window.MFL_BJ,$=function(i){return document.getElementById(i)},hand=null,busy=false,bal=C.balance,shown={};
var fmt=function(n){return Math.round(+n||0).toLocaleString('en-US')};
var SUIT={S:'♠',H:'♥',D:'♦',C:'♣'},FACE={J:'J',Q:'Q',K:'K'};
function card(c,isNew){if(!c)return '<div class="bj-card back'+(isNew?' new':'')+'" aria-label="Face-down card"></div>';
  var r=c[0]==='T'?'10':c[0],s=SUIT[c[1]],red=c[1]==='H'||c[1]==='D',mid=FACE[c[0]]?'<div class="pip face">'+FACE[c[0]]+s+'</div>':'<div class="pip">'+s+'</div>';
  return '<div class="bj-card'+(red?' red':'')+(isNew?' new':'')+'" aria-label="'+r+s+'"><div class="ix tl">'+r+'<i>'+s+'</i></div>'+mid+'<div class="ix br">'+r+'<i>'+s+'</i></div></div>';}
function cards(key,list){var n=shown[key]||0,h=list.map(function(c,i){return card(c,i>=n||(key==='d'&&i===1&&c&&shown.dh))}).join('');shown[key]=list.length;if(key==='d')shown.dh=!list[1];return h;}
var WORD={blackjack:'Blackjack!',win:'Win',push:'Push',lose:'Lose',bust:'Bust',dealerbj:'Dealer BJ'};
function draw(){
  var H=hand,dC=$('bjDealer'),pH=$('bjHands'),b=$('bjBanner');
  if(!H){dC.innerHTML='';$('bjDTot').textContent='';pH.className='bj-hands';pH.innerHTML='<div class="bj-empty">'+(C.user?'Place your bet and deal.':'Log in to play.')+'</div>';b.hidden=true;acts();return;}
  dC.innerHTML=cards('d',H.dealer.cards);$('bjDTot').textContent=H.done&&H.dealer.blackjack?'BJ':H.dealer.total;
  pH.className='bj-hands'+(H.hands.length>1?' two':'');
  pH.innerHTML=H.hands.map(function(x,i){var t=x.blackjack?'BJ':(x.soft&&x.total<21&&!H.done?'soft ':'')+x.total;
    return '<div class="bj-hand'+(x.active?' active':'')+'"><div class="bj-lbl">'+(H.hands.length>1?'Hand '+(i+1):'You')+' <b class="bj-tot">'+t+'</b></div><div class="bj-cards">'+cards('h'+i,x.cards)+'</div><span class="bj-chipbet">'+fmt(x.bet)+(x.doubled?' · doubled':'')+'</span>'+(x.outcome?'<span class="oc '+x.outcome+'">'+WORD[x.outcome]+'</span>':'')+'</div>';}).join('');
  if(H.done){var cls=H.net>0?'win':H.net<0?'lose':'push';b.className='bj-banner '+cls;
    var big=H.hands.length===1&&H.hands[0].outcome==='blackjack'?'Blackjack! +'+fmt(H.net):H.net>0?'You win +'+fmt(H.net):H.net<0?(H.hands.length===1&&H.hands[0].outcome==='bust'?'Bust ':H.hands.length===1&&H.hands[0].outcome==='dealerbj'?'Dealer blackjack ':'Dealer wins ')+'−'+fmt(-H.net):'Push: bet back';
    b.innerHTML=big+'<small>'+(H.auto?'Played out as a stand. ':'')+'Dealer '+(H.dealer.blackjack?'blackjack':H.dealer.total>21?'busts with '+H.dealer.total:'has '+H.dealer.total)+'</small>';b.hidden=false;}
  else b.hidden=true;
  acts();}
function acts(){var can=hand&&!hand.done?hand.can:{};document.querySelectorAll('#bjActs [data-act]').forEach(function(x){x.disabled=busy||!can[x.getAttribute('data-act')];});
  var d=$('bjDeal');if(d)d.disabled=busy||!!(hand&&!hand.done);var f=$('bjBet');if(f)f.classList.toggle('off',!!(hand&&!hand.done));}
function setBal(n){if(n==null)return;bal=n;var e=document.querySelector('#bjBal .coins');if(e){var t=e.lastChild;if(t&&t.nodeType===3)t.textContent=fmt(n);e.classList.toggle('debt',n<0);}
  document.querySelectorAll('.hdr [data-balance]').forEach(function(x){x.textContent=fmt(n)});}
var pc=function(c){return (c[0]==='T'?'10':c[0])+SUIT[c[1]]},row=function(l){return (l||[]).map(pc).join(' ')};
function recent(list){var o=$('bjRecent');if(!o||!list)return;o.innerHTML=list.length?list.map(function(r){return '<li><b>'+r.label.replace(/^./,function(c){return c.toUpperCase()})+'</b><span class="amt '+(r.net>0?'up':r.net<0?'down':'zero')+'">'+(r.net>0?'+':r.net<0?'−':'')+fmt(Math.abs(r.net))+'</span><small>'+r.detail+'</small><span class="bj-mini">Dealer '+row(r.cards.dealer)+' · You '+r.cards.hands.map(row).join(' | ')+'</span></li>'}).join(''):'<li class="muted">No hands yet.</li>';}
function msg(t){var m=$('bjMsg');if(m)m.textContent=t||'';}
function post(url,body){return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).catch(function(e){return {ok:false,error:'Could not reach the server.'}});}
function got(r){busy=false;if(r.balance!=null)setBal(r.balance);if(r.recent)recent(r.recent);if(r.hand){if(!hand||hand.id!==r.hand.id)shown={};hand=r.hand;}if(!r.ok)msg(r.error||'Something went wrong.');else msg('');draw();}
document.querySelectorAll('#bjActs [data-act]').forEach(function(x){x.addEventListener('click',function(){if(busy||!hand)return;busy=true;acts();post('/arcade/blackjack/'+x.getAttribute('data-act'),{id:hand.id}).then(got);});});
var f=$('bjBet'),amt=$('bjAmt');
function clamp(v){v=Math.floor(+v||0);return Math.max(0,Math.min(C.max,v));}
if(f){f.addEventListener('click',function(e){var c=e.target.closest('[data-chip]');if(!c)return;var v=c.getAttribute('data-chip'),cur=clamp(amt.value);
    if(v==='clear')amt.value='';else if(v==='max')amt.value=Math.max(C.min,Math.min(C.max,bal==null?C.max:bal));else amt.value=clamp((amt.dataset.touched!=='1'?0:cur)+(+v));amt.dataset.touched='1';msg('');});
  amt.addEventListener('input',function(){amt.dataset.touched='1'});
  f.addEventListener('submit',function(e){e.preventDefault();if(busy)return;var v=String(amt.value).trim();if(!/^\\d+$/.test(v)||+v<C.min||+v>C.max){msg('Bet a whole number from '+fmt(C.min)+' to '+fmt(C.max)+'.');return;}
    busy=true;acts();msg('');shown={};hand=null;post('/arcade/blackjack/deal',{bet:+v}).then(got);});}
document.addEventListener('keydown',function(e){if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;var k={h:'hit',s:'stand',d:'double',p:'split'}[e.key];if(k){var b=document.querySelector('#bjActs [data-act='+k+']');if(b&&!b.disabled)b.click();}});
fetch('/arcade/blackjack/state',{cache:'no-store'}).then(function(r){return r.json()}).then(function(r){if(r.balance!=null)setBal(r.balance);recent(r.recent);hand=r.hand||null;draw();}).catch(function(){draw();});
draw();})();`;

Object.assign(module.exports, { BJ, total, natural, shoeFor, deal, legal, act, standAll, finish, stakeOf, payoutOf, label, detail, bjWin });
