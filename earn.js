// /coins: every way to earn coins, how much and how often, with a link to where you do it. Every amount is read from the
// code that pays it (pickem.js, cards.js, arcade.js, survivor.js, server.js), so the page stays right when values change.
// Logged in, it starts with where that user's coins came from so far (the same numbers as their balance).
const pk = require('./pickem');
const cards = require('./cards');
const sv = require('./survivor');
const badges = require('./badges');
const AR = require('./arcade');
const BJM = require('./blackjack');

module.exports = function earn(app, h) {
  const { esc, icon, layout, pageHead, load, currentUser, loadAccount, ACHIEVEMENT_COINS } = h;
  const E = AR.EARN, GAMES = AR.GAMES;
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
  const sum = (a, f = (x) => x.amount) => (a || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
  const amt = (n) => `<span class="ei-c">${icon('coin')}${fmt(n)}</span>`;

  // One way to earn: what it is, how much, how often and where.
  const item = (o) => `<div class="ei">
    <div class="ei-h"><b>${o.t}</b><span class="ei-amt">${o.amt}</span></div>
    ${o.p ? `<p>${o.p}</p>` : ''}${o.x || ''}
    <div class="ei-meta"><span class="ei-when">${icon('clock')} ${o.when}</span>${o.href ? `<a href="${o.href}">${o.go || 'Go'} →</a>` : ''}</div></div>`;
  const section = (id, em, title, href, go, body, sub) => `<section class="card earn-sec" id="${id}"><div class="card-h"><h2><span class="em" aria-hidden="true">${em}</span>${esc(title)}</h2>${href ? `<a href="${href}">${go} ${icon('arrow')}</a>` : ''}</div>${sub ? `<p class="earn-sub">${sub}</p>` : ''}${body}</section>`;

  // "Your player": coins for an account the commissioner linked to a real MFL player (playerpay.js, when it's there).
  const PAY_LABEL = { win: 'Your team wins', tdScored: 'You score a touchdown', tdPass: 'You throw a TD pass', int: 'You get an interception', pbu: 'You break up a pass', catch: 'You make a notable catch (at least: the AI rates its note, up to 4×)', play: 'You make a notable play (at least: the AI rates its note, up to 4×)', sack: 'You get a sack', mvp: "You're the game MVP", threwInt: 'You throw an interception', pen: 'A penalty on you' };
  function payTable() {
    let pay = null, mod = null;
    try { mod = require('./playerpay'); pay = mod.payTable(load()); } catch {}
    if (!pay || typeof pay !== 'object') return null;
    const labels = (mod && (mod.LABELS || mod.labels)) || {};
    const rows = Object.entries(pay).map(([k, v]) => [k, typeof v === 'object' && v ? Number(v.amount) : Number(v), typeof v === 'object' && v && v.label]).filter(([, v]) => Number.isFinite(v) && v !== 0);
    const name = (k, v, l) => l || PAY_LABEL[k] || labels[k] || (k === 'flag' ? (v < 0 ? 'A flag on you' : 'You pull a flag') : k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));
    return rows.map(([k, v, l]) => ({ k, v, label: name(k, v, l) }));
  }

  // Where a user's coins came from: one row per source, adding up to the balance.
  function breakdown(user, acct, own = true) {
    const P = acct.points || {}, rate = cards.COINS_PER_POINT || 1;
    const bonus = user.bonuses || [], pb = user.pointBonuses || [], arc = user.arcade || [];
    const net = (f) => arc.filter(f).reduce((s, m) => s + E.matchNet(m), 0);
    const h2h = net((m) => m.versus), career = net((m) => m.career && !m.versus);
    const bjOld = user.bjOld || null, bjHands = arc.filter((m) => m.game === 'blackjack' && m.status !== 'open');
    const bj = net((m) => m.game === 'blackjack') + (bjOld ? (bjOld.wonNet || 0) - (bjOld.lostNet || 0) : 0), bjN = bjHands.length + (bjOld ? bjOld.hands || 0 : 0);
    const h2hN = arc.filter((m) => m.versus && (m.status === 'won' || m.status === 'lost'));
    const daily = bonus.filter((b) => b.reason === 'Daily'), bail = bonus.filter((b) => b.reason === 'Bailout'), gifts = bonus.filter((b) => b.reason !== 'Daily' && b.reason !== 'Bailout');
    const sold = pb.filter((b) => /^Sold /.test(b.reason || '')), otherPb = pb.filter((b) => !/^Sold /.test(b.reason || ''));
    const open = acct.bets.filter((b) => b.status === 'pending');
    const bought = (user.packs || []).filter((p) => p.currency === 'coins' && p.cost);
    const nGames = P.fan && P.fan.results ? P.fan.results.length : 0;
    const playerCoins = ['player', 'playerPay', 'playerCoins'].map((k) => P[k]).find((v) => typeof v === 'number');
    const arcGames = arc.filter((m) => !m.versus && !m.career && m.game !== 'blackjack' && (m.status === 'won' || m.status === 'lost'));
    const rows = [
      ['Sign-up coins', pk.START_COINS, 'Everyone starts here', '#other', true],
      ["Pick'em picks", acct.profit, `${acct.won} won · ${acct.lost} lost`, '#pickem'],
      ['In open picks', -sum(open, (b) => b.stake), `${plural(open.length, 'pick')} waiting on a game. Wins pay when it's final`, '#pickem'],
      ['Daily bonus', sum(daily), plural(daily.length, 'day'), '#pickem'],
      ['Lineup', P.fantasy || 0, nGames ? `${plural(nGames, 'game')} scored${rate !== 1 ? ` · ${fmt(rate)} coins a point` : ''}` : '', '#lineup'],
      ['Your player', playerCoins || 0, '', '#player'],
      ['Survivor', P.survivor || 0, P.survivor ? plural(P.survivor / sv.PRIZE, 'round') + ' won' : '', '#survivor'],
      ['Arcade games', (P.arcade || 0) - h2h - career - bj, arcGames.length ? plural(arcGames.length, 'game') + ' played' : '', '#arcade'],
      ['Hit or Stand', bj, bjN ? plural(bjN, 'hand') + ' played' : '', '#arcade'],
      ['Head to Head', h2h, h2hN.length ? `${h2hN.filter((m) => m.status === 'won').length} won · ${h2hN.filter((m) => m.status === 'lost').length} lost` : '', '#h2h'],
      ['Career wins', career, '', '#career'],
      ['Daily challenges', P.challenges || 0, '', '#daily'],
      ['Game-day check-ins', P.checkins || 0, P.checkins ? plural(P.checkins / E.CHECKIN, 'check-in') : '', '#daily'],
      ['Achievements', P.achieve || 0, P.achieve ? plural(P.achieve / ACHIEVEMENT_COINS, 'achievement') : '', '#achievements'],
      ['Card sales', sum(sold), sold.length ? plural(sold.length, 'card') + ' sold' : '', '#cards'],
      ['Card rewards', sum(otherPb), '', '#cards'],
      ['Bailouts', sum(bail), bail.length ? plural(bail.length, 'bailout') : '', '#other'],
      ['From the commissioner', sum(gifts), gifts.length ? 'Gifts and fixes' : '', '#other'],
      ['Spent on packs', -(P.spent || 0), bought.length ? plural(bought.length, 'pack') + ' bought' : '', '#cards'],
    ];
    // Anything the rows above don't name yet (a new way to earn) still shows, so the rows always add up to the balance.
    const rest = acct.balance - rows.reduce((s, r) => s + r[1], 0);
    if (Math.round(rest)) rows.push(['Other', rest, 'Everything else', '#other']);
    const row = ([label, n, sub, href, keep]) => (!keep && !Math.round(n) ? '' : `<div><span><a href="${own === 'page' ? href : '/coins' + href}">${esc(label)}</a>${sub ? `<small>${esc(sub)}</small>` : ''}</span><b class="${n > 0 ? 'up' : n < 0 ? 'down' : 'zero'}">${signed(n)}</b></div>`);
    return `<section class="card pts-break earn-me"><div class="card-h"><h2>${icon('coin')} ${own ? 'Your coins so far' : 'Where the coins came from'}</h2><b class="big">${fmt(acct.balance)}</b></div>
      <p class="muted sm">${own ? `Where every coin you have came from, @${esc(user.name)}.` : `Every coin @${esc(user.name)} has, by where it came from.`} Tap a row to see how it works on the Earn coins page.</p>
      <div class="pb-rows">${rows.map(row).join('')}<div class="tot"><span>Balance</span><b>${fmt(acct.balance)}</b></div></div></section>`;
  }

  // ---------- a profile's coins: the breakdown, and every change in order ----------
  // Built from the same records the balance is worked out from, so the last running balance is the balance. Things the
  // site doesn't date (achievements, Survivor) are listed as "ongoing"; anything not named still shows as "Other".
  const TZ = h.TZ || 'America/Chicago';
  // a local "YYYY-MM-DD HH:MM" in the league's time zone as an ISO time
  function localIso(day, hm) {
    if (!day) return '';
    const guess = new Date(`${day}T${hm || '12:00'}:00Z`);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess).map((p) => [p.type, p.value]));
    const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
  }
  const gameEnd = (g) => { const t = localIso(g.date, g.time || '12:35'); return t ? new Date(Date.parse(t) + 45 * 60000).toISOString() : ''; };
  const matchOf = (db, g) => (g && db.teams[g.home] && db.teams[g.away] ? `${db.teams[g.home].abbr} vs ${db.teams[g.away].abbr}` : 'a game');
  function coinHistory(db, user, acct, revert) {
    const P = acct.points || {}, A = h.arcade ? h.arcade() : null, rate = cards.COINS_PER_POINT || 1, out = [];
    const add = (at, label, n, sub, kind, dayOnly) => { if (Math.round(n)) out.push({ at: at || '', label, n: Math.round(n), sub: sub || '', kind: kind || '', dayOnly: !!dayOnly }); };
    add(user.created, 'Signed up', pk.START_COINS, 'Everyone starts with these', 'other');
    for (const b of user.bonuses || []) add(b.at, b.reason === 'Daily' ? 'Daily bonus' : b.reason === 'Bailout' ? 'Bailout' : b.reason === 'Admin' ? 'From the commissioner' : String(b.reason || 'Bonus'), b.amount, '', 'other');
    for (const b of user.pointBonuses || []) { const m = /^Sold (.+)$/.exec(b.reason || ''); const c = m && cards.cardInfo(db, m[1]); add(b.at, m ? 'Sold a card' : String(b.reason || 'Card reward'), b.amount, m ? (c ? c.label || m[1] : m[1]) : '', 'cards'); }
    const packName = (t) => (cards.PACKS[t] && cards.PACKS[t].name) || (/^team-/.test(t) && db.teams[t.slice(5)] ? `${db.teams[t.slice(5)].name} team pack` : t);
    for (const p of user.packs || []) if (p.currency === 'coins' && p.cost) add(p.at, 'Bought a pack', -p.cost, packName(p.type), 'cards');
    for (const b of acct.bets || []) {
      const what = b.legs.length > 1 ? `${b.legs.length}-pick combo` : (b.legs[0] && b.legs[0].label) || 'Pick';
      add(b.placed, 'Made a pick', -b.stake, what, 'pickem');
      if (b.status === 'won' || b.status === 'void') {
        const end = b.legs.map((l) => db.games.find((g) => g.id === l.game)).filter(Boolean).map(gameEnd).sort().pop() || b.placed;
        add(end, b.status === 'won' ? 'Pick won' : 'Pick refunded', b.payout, what, 'pickem');
      }
    }
    if (user.bjOld && user.bjOld.hands) { const o = user.bjOld; add(o.to, 'Hit or Stand · older hands', (o.wonNet || 0) - (o.lostNet || 0), `${plural(o.hands, 'hand')}: ${fmt(o.won)} won, ${fmt(o.lost)} lost, ${fmt(o.push)} pushed`, 'arcade'); }
    for (const m of user.arcade || []) {
      const n = E.matchNet(m); if (!n) continue;
      if (m.game === 'blackjack') { add(m.ended || m.at, `Hit or Stand · ${BJM.label(m)}`, n, BJM.detail(m) + (m.status === 'open' ? ' · hand in play' : ''), 'arcade'); continue; }
      const G = (GAMES[m.game] || {}).name || m.game, lv = E.LEVELS && E.LEVELS[m.level];
      const mode = m.versus ? `Head to Head vs @${m.versus.opp || '?'}` : m.run ? `${(E.RUNS && E.RUNS[m.run.mode] && E.RUNS[m.run.mode].name) || 'Run'} game ${m.run.step}` : m.career ? 'Career' : m.risk ? 'Risk mode' : '';
      // what actually happened, not just which way the coins went: a run's won game pays nothing until the cash out (its coins
      // are the stake for the bigger risk), so it reads as a win; an unfinished game says so
      const R = m.run, state = m.status === 'open' ? `${G} in progress` : m.status === 'won' ? `${G} win` : n > 0 ? `${G} win` : `${G} loss`;
      const note = m.status === 'open' ? 'no result yet' : R && m.status === 'won' && R.pending ? `cash out ${Number(R.cash || 0).toLocaleString('en-US')} waiting on the 3D Blitz page` : R && m.status === 'won' && R.rolled ? 'won and played on: this is the extra put at risk' : R && m.status === 'won' && R.cashedOut ? 'cashed out' : '';
      add(m.at, state, n, [lv && (lv.name || lv), mode, note].filter(Boolean).join(' · '), 'arcade');
    }
    if (A && A.challengeDays) for (const d of A.challengeDays(user)) add(localIso(d.day, '23:59'), 'Daily challenges', d.coins, `${d.n} done`, 'arcade', true);
    for (const d of user.checkins || []) add(localIso(d, '12:00'), 'Game-day check-in', E.CHECKIN, '', 'arcade', true);
    for (const r of (P.fan && P.fan.results) || []) add(gameEnd(r.g), 'Lineup', r.total * rate, `${matchOf(db, r.g)} · ${fmt(r.total)} points`, 'cards');
    for (const gp of P.playerGames || []) add(gameEnd(gp.game), 'Your player', gp.total, `${matchOf(db, gp.game)} · ${gp.won ? 'win' : 'loss'} ${gp.score || ''}`, 'player');
    add('', 'Achievements', P.achieve || 0, P.achieve ? plural(P.achieve / ACHIEVEMENT_COINS, 'achievement') : '', 'other');
    add('', 'Survivor rounds won', P.survivor || 0, '', 'other');
    if (revert) out.push({ at: revert.cutoff, label: 'Nov 6 rollback', n: 0, kind: 'note', sub: `Admin-panel coins removed${[['packs', 'pack'], ['bets', 'pick'], ['sales', 'card sale'], ['lineups', 'Lineup change']].map(([k, w]) => (revert[k] || []).length ? `, ${plural(revert[k].length, w)} undone` : '').join('')}` });
    const dated = out.filter((e) => e.at).sort((a, b) => a.at.localeCompare(b.at)), ongoing = out.filter((e) => !e.at);
    let run = 0;
    for (const e of [...dated, ...ongoing]) { run += e.n; e.bal = run; }
    const rest = acct.balance - run;
    if (Math.round(rest)) { run += rest; ongoing.push({ at: '', label: 'Other', n: Math.round(rest), sub: 'Everything else', kind: 'other', bal: run }); }
    return { dated, ongoing };
  }
  h.coinProfile = async (db, user, acct, own) => {
    let revert = null;
    try { revert = h.getDoc ? await h.getDoc(`reverts/20261106/${user.name}`) : null; } catch {}
    const { dated, ongoing } = coinHistory(db, user, acct, revert);
    const when = (iso, dayOnly) => { if (!iso) return 'Ongoing'; const d = new Date(iso); return d.toLocaleString('en-US', dayOnly ? { timeZone: TZ, month: 'short', day: 'numeric' } : { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    const tr = (e) => `<tr class="${e.kind === 'note' ? 'cl-note' : ''}"><td class="l"><b>${esc(e.label)}</b><small>${esc([e.sub, when(e.at, e.dayOnly)].filter(Boolean).join(' · '))}</small></td><td class="${e.n > 0 ? 'up' : e.n < 0 ? 'down' : 'zero'}">${e.kind === 'note' ? '' : signed(e.n)}</td><td class="muted">${fmt(e.bal)}</td></tr>`;
    const rows = [...ongoing.slice().reverse(), ...dated.slice().reverse()], first = rows.slice(0, 40), more = rows.slice(40);
    const head = '<thead><tr><th class="l">What</th><th>Coins</th><th>Balance</th></tr></thead>';
    return breakdown(user, acct, own) + `<section class="card coin-log" id="coin-log"><div class="card-h"><h2>${icon('clock')} Coin history</h2><span class="muted sm">${fmt(rows.length)} changes</span></div>
      <p class="muted sm">Every change to ${own ? 'your' : `@${esc(user.name)}'s`} coins, newest first, with the balance after it. Lineup, player and pick results land when the game ends.</p>
      <div class="scroll"><table class="tbl cl-tbl">${head}<tbody>${first.map(tr).join('')}</tbody></table></div>
      ${more.length ? `<details class="cl-more"><summary>Show the other ${fmt(more.length)}</summary><div class="scroll"><table class="tbl cl-tbl">${head}<tbody>${more.map(tr).join('')}</tbody></table></div></details>` : ''}</section>`;
  };

  app.get('/coins', async (req, res, next) => {
    try {
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      const A = h.arcade();
      const rate = cards.COINS_PER_POINT || 1, R = cards.RARITIES, S = cards.SCORING, PK = cards.PACKS;
      const pp = h.packPrices();
      const lv = (i) => E.LEVELS[i];
      const topLevel = (G) => E.LEVEL_ORDER.filter((i) => i < G.prizes.length);

      // ---------- Pick'em ----------
      const fakeDaily = (n) => h.dailyInfo({ bonuses: Array.from({ length: n }, (_, i) => ({ reason: 'Daily', day: h.addDays(h.today(), -(i + 1)) })) }).amount;
      const dBase = fakeDaily(0), dStep = fakeDaily(1) - dBase, dMax = fakeDaily(60), dDays = dStep ? Math.round((dMax - dBase) / dStep) : 0;
      const dNow = user ? h.dailyInfo(user) : null;
      const champ = PK.prize;
      const pickem = section('pickem', '🎯', "Pick'em", '/pickem', 'Make picks', [
        item({ t: 'Win a pick', amt: 'Your pick × the reward', when: 'Every MFL game',
          p: `Pick what happens in the next game: winners, scores, who scores a TD. Play at least ${fmt(pk.MIN_STAKE)} coins. Right picks pay your coins back plus the reward: <b>+150</b> turns 100 coins into 250. Combos of up to ${pk.MAX_LEGS} picks multiply the rewards. Picks lock ${pk.LOCK_MINUTES} minutes before kickoff.`, href: '/pickem', go: 'Make a pick' }),
        item({ t: 'Daily bonus', amt: dStep ? `${amt(dBase)} to ${fmt(dMax)}` : amt(dBase), when: 'Once a day',
          p: `Claim it on the Pick'em page. ${dStep ? `It grows by ${fmt(dStep)} for every day in a row you claim it, up to ${fmt(dMax)} after ${plural(dDays, 'day')}.` : ''}${dNow ? (dNow.claimed ? " <b>You've claimed today's.</b>" : ` <b>Today's is ${fmt(dNow.amount)} and still waiting.</b>`) : ''}`, href: '/pickem', go: 'Claim it' }),
        item({ t: 'Picker of the Week', amt: 'Free pack', when: 'Every week',
          p: `The best Pick'em profit from Monday to Sunday wins a free ${esc(champ.name)} (${champ.cards} cards${champ.min ? `, ${esc(R[champ.min].name)} or better guaranteed` : ''}).`, href: '/pickem/leaderboard', go: 'Leaderboard' }),
      ].join(''));

      // ---------- Lineup ----------
      const keys = Object.keys(S).filter((k) => S[k]);
      const showRate = rate !== 1;
      const flats = cards.VARIANTS.filter((v) => v.flat && !v.hidden && !v.set);
      const ex = { k: S.pass != null ? 'pass' : keys[0], r: R.legendary ? 'legendary' : cards.SHOWN_RARITIES.at(-1) };
      const lineup = section('lineup', '🃏', 'Lineup', '/pickem/cards', 'Set your Lineup', `
        <p class="earn-sub">Set a Lineup of ${cards.LINEUP_SIZE} player cards. Every MFL game, each card earns coins for what its player does in the box score. ${showRate ? `Every fantasy point pays <b>${fmt(rate)} coins</b>.` : '1 fantasy point = 1 coin.'} The Lineup saved when Pick'em locks (${pk.LOCK_MINUTES} minutes before kickoff) is the one that counts, and it carries over until you change it.</p>
        <div class="scroll"><table class="tbl earn-tbl"><thead><tr><th class="l">Stat</th>${showRate ? '<th>Points</th>' : ''}<th class="r">Coins on a ${esc(R.common.name)} card</th></tr></thead><tbody>
        ${keys.map((k) => `<tr><td class="l">${esc(cards.SCORING_LABEL[k] || k)}</td>${showRate ? `<td>${signed(S[k])}</td>` : ''}<td class="r ${S[k] < 0 ? 'down' : ''}">${signed(S[k] * rate)}</td></tr>`).join('')}</tbody></table></div>
        ${item({ t: 'Better cards earn more', amt: `Up to ${Math.max(...cards.SHOWN_RARITIES.map((r) => R[r].mult))}×`, when: 'Every game, once the final score is in',
          p: `Good plays are multiplied by the card: ${cards.SHOWN_RARITIES.map((r) => `<span class="rar-tag r-${r}">${esc(R[r].name)} ${R[r].mult}×</span>`).join(' ')}. Specialist cards earn ${cards.SPECIAL_BOOST}× more on their specialty. Mistakes are never multiplied. Example: a ${esc(cards.SCORING_LABEL[ex.k] || ex.k)} on a ${esc(R[ex.r].name)} card is ${fmt(S[ex.k] * rate)} × ${R[ex.r].mult} = <b>${fmt(S[ex.k] * rate * R[ex.r].mult)} coins</b>.${flats.length ? ` Some fun cards add a bonus every game they play: ${flats.map((v) => `${esc(v.label)} +${fmt(v.flat * rate)}`).join(', ')}.` : ''}`, href: '/pickem/cards', go: 'My cards' })}`);

      // ---------- Your player ----------
      const pay = payTable();
      const player = section('player', '🏈', 'Your player', null, '', pay && pay.length
        ? `<p class="earn-sub">Play in the MFL? Once the commissioner links your account to you, you earn coins for your team's wins and your own stats, every game you play.</p>
          <div class="scroll"><table class="tbl earn-tbl"><thead><tr><th class="l">When</th><th class="r">Coins</th></tr></thead><tbody>
          ${pay.map((r) => `<tr><td class="l">${esc(r.label)}</td><td class="r ${r.v < 0 ? 'down' : 'up'}">${signed(r.v)}</td></tr>`).join('')}</tbody></table></div>
          <p class="earn-sub">After every game the AI reads all the notes on the plays. A notable catch or play pays more the better it was, and it can give bonus coins to anyone the notes credit: tipping the ball that got picked, the block that sprang a touchdown, a big play on 4th down.</p>
          <div class="ei-meta"><span class="ei-when">${icon('clock')} Every game you play</span><a href="/stats/players">Player stats →</a></div>`
        : `<div class="soon"><b>Coming soon</b><p>MFL players will earn coins for their team's wins and their own stats, once the commissioner links their account.</p></div>`);

      // ---------- Survivor ----------
      const survivor = section('survivor', '🏝️', 'Survivor', '/pickem/survivor', 'Play Survivor', item({ t: 'Win a Survivor round', amt: amt(sv.PRIZE), when: 'Every round',
        p: "Each game, pick one player who has to score a touchdown. Miss and you're out, and you can't use a player twice in a round. The last one standing wins.", href: '/pickem/survivor', go: 'Join the next round' }));

      // ---------- Arcade ----------
      const four = E.LEVEL_ORDER.filter((i) => i < 4);
      const extra = (G) => topLevel(G).filter((i) => !four.includes(i));
      const games = E.ORDER.filter((id) => GAMES[id]);
      const best = Math.max(...games.flatMap((id) => GAMES[id].prizes.map((p, i) => Math.round(p * E.RISK_MULT[i]))));
      const B = GAMES.blitz3d, main = E.RUN_MAIN, don = E.RUNS.don, dod = E.RUNS.dod;
      const factors = E.RUN_LEVELS.map((l) => `${lv(l)} ×${E.RUN_FACTOR[l]}`).join(', ');
      const arcadeSec = section('arcade', '🕹️', 'Arcade', '/arcade', 'Play', `
        <p class="earn-sub">${games.length} games. Beat the computer and you win coins. Every win pays, with no daily cap. Harder levels pay more. Practice is free and pays nothing.</p>
        <div class="scroll"><table class="tbl earn-tbl arc-tbl"><thead><tr><th class="l">Win at</th>${four.map((i) => `<th>${esc(lv(i))}</th>`).join('')}</tr></thead><tbody>
        ${games.map((id) => { const G = GAMES[id], x = extra(G); return `<tr><td class="l"><a href="/arcade/${id}">${G.emoji} ${esc(G.name)}</a>${x.length ? `<small>${x.map((i) => `${esc(lv(i))} ${fmt(G.prizes[i])}`).join(' · ')}</small>` : ''}</td>${four.map((i) => `<td>${G.prizes[i] != null ? fmt(G.prizes[i]) : '–'}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
        ${item({ t: 'Risk mode', amt: `Up to ${amt(best)}`, when: 'Any game you start',
          p: `Put up the whole prize before you play. Win and you get the prize × ${E.LEVEL_ORDER.map((i) => `${E.RISK_MULT[i]} (${esc(lv(i))})`).join(', ')}. Lose and what you put up is gone.`, href: '/arcade', go: 'Arcade' })}
        ${item({ t: `${don.emoji} ${esc(don.name)}`, amt: `${amt(don.cash(main))} and up`, when: 'As many runs as you like',
          p: `A run of ${esc(B.name)} games with nothing up front. Win at ${esc(lv(main))} and you can cash out ${fmt(don.cash(main))}, or play one more. Each more win multiplies it by the next game's level: ${factors}. So ${fmt(don.cash(main))}, then ${fmt(Math.round(don.cash(main) * E.RUN_FACTOR[main]))}, then ${fmt(Math.round(don.cash(main) * E.RUN_FACTOR[main] ** 2))}… One loss and the run pays nothing.`, href: '/arcade/blitz3d?mode=don', go: 'Start a run' })}
        ${item({ t: `${dod.emoji} ${esc(dod.name)}`, amt: `${amt(Math.round(dod.cash(main)))} and up`, when: 'As many runs as you like',
          p: `The bold one. At ${esc(lv(main))} you put ${fmt(dod.stake(main))} at risk to cash out ${fmt(Math.round(dod.cash(main)))}, and both grow with every win (${factors}). Lose and you lose everything at risk, even if it takes you below zero.`, href: '/arcade/blitz3d?mode=dod', go: 'Start a run' })}
        ${item({ t: `${BJM.BJ.emoji} ${esc(BJM.BJ.name)}`, amt: `Bet up to ${amt(BJM.BJ.max)}`, when: 'Every hand you win',
          p: `Bet ${fmt(BJM.BJ.min)} to ${fmt(BJM.BJ.max)} coins a hand against the dealer (never more than you have). A win pays 1:1, a <b>21 in two cards pays ${BJM.BJ.pays.join(':')}</b> (a ${fmt(BJM.BJ.max)} bet wins ${fmt(BJM.bjWin(BJM.BJ.max))}) and a push gives your bet back. Double down (one card, twice the bet) and split pairs once. ${BJM.BJ.decks} decks shuffled every hand, the dealer stands on all 17s. Lose the hand and you lose the bet.`, href: '/arcade/hitorstand', go: 'Play Hit or Stand' })}
        ${item({ t: esc(PK.arcade.name), amt: 'Free pack', when: 'Once a day', p: `${esc(PK.arcade.desc)} ${PK.arcade.cards} cards${PK.arcade.min ? `, ${esc(R[PK.arcade.min].name)} or better guaranteed` : ''}.`, href: '/pickem/packs', go: 'Packs' })}`);

      // ---------- Head to Head ----------
      const h2h = section('h2h', '🆚', 'Head to Head', '/arcade/blitz3d/versus', 'Challenge someone', item({ t: `Beat another player at ${esc(B.name)}`, amt: '2× your wager', when: 'Any time you are both online',
        p: "Challenge someone who's online to a live game. You both put up the same wager (or 0 for a friendly) and the winner takes both. If a game can't be settled, both wagers come back.", href: '/arcade/blitz3d/versus', go: 'Head to Head' }));

      // ---------- Challenges and check-ins ----------
      const todayCh = A.challengeStatus(user || {}, A.today());
      const chList = (list) => `<div class="ch-grid">${list.map((c) => `<div class="chx${c.done ? ' got' : ''}"><span>${c.done ? '✓ ' : ''}${esc(c.text)}</span><b>+${fmt(c.reward)}</b></div>`).join('')}</div>`;
      const easy = E.CHALLENGES.filter((c) => c.easy), hard = E.CHALLENGES.filter((c) => !c.easy);
      const daily = section('daily', '✅', 'Challenges and check-ins', '/arcade', 'Arcade', `
        ${item({ t: 'Daily challenges', amt: `Up to ${amt(Math.max(...easy.map((c) => c.reward)) + hard.map((c) => c.reward).sort((a, b) => b - a).slice(0, 2).reduce((s, x) => s + x, 0))} a day`, when: '3 new ones every day',
          p: `One easy challenge and two harder ones. Coins land as soon as you finish one, no claiming needed. ${user ? 'Today:' : "Today's:"}`, x: chList(todayCh), href: '/arcade', go: 'See your progress' })}
        <details class="earn-more"><summary>Every challenge (${E.CHALLENGES.length})</summary><small>Easy</small>${chList(easy)}<small>Harder</small>${chList(hard)}</details>
        ${item({ t: 'Game-day check-in', amt: amt(E.CHECKIN), when: 'Every game day, 11:30 AM to 2:30 PM', p: 'Tap check in on the Arcade page while the game is on.', href: '/arcade', go: 'Check in' })}`);

      // ---------- Achievements ----------
      const got = user ? new Set(badges.userBadges({ db, acct: pk.account(db, user), user, weeklyWins: 0, survivorWins: (acct.points.survivor || 0) / sv.PRIZE, fantasy: acct.points.fan }).map(([id]) => id)) : new Set();
      const paying = badges.USER_BADGES.filter(([id]) => id !== 'botw');
      const ach = section('achievements', '🏆', 'Achievements', user ? `/pickem/u/${encodeURIComponent(user.name)}` : null, 'My profile', `
        <p class="earn-sub">Every achievement pays <b>${fmt(ACHIEVEMENT_COINS)} coins</b>, once. That's ${fmt(paying.length * ACHIEVEMENT_COINS)} for all ${paying.length}.${user ? ` You have ${got.size}.` : ''} (Picker of the Week pays a free pack instead, see <a href="#pickem">Pick'em</a>.)</p>
        <div class="ach-grid">${paying.map(([id, em, nm, desc]) => `<div class="achx${got.has(id) ? ' got' : ''}"><span class="em">${em}</span><div><b>${esc(nm)}${got.has(id) ? ' ✓' : ''}</b><small>${esc(desc)}</small></div></div>`).join('')}</div>`);

      // ---------- Cards ----------
      const free = Object.entries(PK).filter(([, P]) => P.free);
      const cardsSec = section('cards', '🗂️', 'Cards', '/pickem/cards', 'My cards', `
        ${item({ t: 'Sell extra copies', amt: `${amt(R[cards.SHOWN_RARITIES[0]].sell)} to ${fmt(Math.max(...cards.SHOWN_RARITIES.map((r) => R[r].sell)))}`, when: 'Any time',
          p: `Got two or more of the same card? Sell the extras on My cards: ${cards.SHOWN_RARITIES.map((r) => `<span class="rar-tag r-${r}">${esc(R[r].name)}</span> ${fmt(R[r].sell)}`).join(' · ')}.`, href: '/pickem/cards', go: 'My cards' })}
        ${item({ t: 'Free packs', amt: 'Free cards', when: 'Daily, weekly and more',
          p: 'Free packs give cards, not coins, but cards earn coins in your Lineup and sell for coins.', x: `<ul class="earn-ul">${free.map(([t, P]) => `<li><b>${esc(P.name)}</b> · ${P.cards} card${P.cards === 1 ? '' : 's'}. ${esc(P.desc)}${t === 'milestone' ? ` At ${cards.COLLECTOR_STEPS.slice(0, 5).map(fmt).join(', ')} and more, up to ${fmt(cards.COLLECTOR_STEPS.at(-1))}.` : ''}</li>`).join('')}</ul>`, href: '/pickem/packs', go: 'Packs' })}
        ${item({ t: 'Trades', amt: 'Cards only', when: 'Any time', p: 'Trade cards with other collectors. No coins change hands.', href: '/pickem/trades', go: 'Trades' })}`);

      // ---------- Career ----------
      const careerSec = section('career', '📈', 'Career', '/career', 'Play a career', [GAMES.bowl, B].map((G) => item({ t: `${G.emoji} Win a ${esc(G.name)} Career game`, amt: `${amt(G.prizes[four[0]])} to ${fmt(G.prizes[four.at(-1)])}`, when: 'Every career game you win',
        p: `A career win pays the same as a normal win at your career's level: ${four.map((i) => `${esc(lv(i))} ${fmt(G.prizes[i])}`).join(', ')}.`, href: '/career', go: 'Career' })).join(''));

      // ---------- Other ----------
      const other = section('other', '✨', 'Other', null, '', [
        item({ t: 'Sign up', amt: amt(pk.START_COINS), when: 'Once', p: 'Every new account starts with these.', href: user ? null : '/pickem/signup', go: 'Sign up' }),
        item({ t: 'Bailout', amt: amt(pk.BAILOUT_COINS), when: 'When you run out', p: `Under ${fmt(pk.BAILOUT_BELOW)} coins with no open picks, and no packs bought with coins in the last week? Claim a bailout on My picks.`, href: '/pickem/me', go: 'My picks' }),
        item({ t: 'From the commissioner', amt: 'It depends', when: 'Now and then', p: 'The commissioner can hand out coins, or fix a mistake. They show up on their own.' }),
        item({ t: 'Refunds', amt: 'Your coins back', when: 'When needed', p: 'A postponed or voided game gives back what you played on it. An Arcade game cut off by a site update is refunded too.' }),
      ].join(''));

      // ---------- Where coins go ----------
      const neg = pay ? pay.filter((r) => r.v < 0) : [];
      const spend = `<section class="card earn-sec" id="spend"><div class="card-h"><h2><span class="em" aria-hidden="true">💸</span>Where coins go</h2></div><ul class="earn-ul">
        <li><b>Picks</b> that miss (at least ${fmt(pk.MIN_STAKE)} coins each).</li>
        <li><b>Packs</b>: ${fmt(pp.lo)} to ${fmt(pp.hi)} coins.</li>
        <li><b>Risk mode and Double or Double</b> games you lose. Double or Double can take you below zero.</li>
        <li><b>Head to Head</b> games you lose: your wager.</li>
        <li><b>Hit or Stand</b> hands you lose: your stake (and the extra on a double or split).</li>
        ${S.picked < 0 ? `<li><b>Lineup mistakes</b>: a card loses ${fmt(Math.abs(S.picked * rate))} when its player throws an interception.</li>` : ''}
        ${neg.length ? `<li><b>Your player</b>: ${neg.map((r) => `${esc(r.label.toLowerCase())} ${signed(r.v)}`).join(', ')}.</li>` : ''}
        <li><b>Voided games</b>: if the commissioner voids a game, anything a pick on it paid is taken back.</li></ul></section>`;

      const jump = [['pickem', "Pick'em"], ['lineup', 'Lineup'], ['player', 'Your player'], ['survivor', 'Survivor'], ['arcade', 'Arcade'], ['h2h', 'Head to Head'], ['daily', 'Challenges'], ['achievements', 'Achievements'], ['cards', 'Cards'], ['career', 'Career'], ['other', 'Other'], ['spend', 'Spending']];
      const top = user ? breakdown(user, acct)
        : `<section class="card earn-cta"><div><b>Start with ${fmt(pk.START_COINS)} coins</b><span>Sign up free, then earn more every way below.</span></div><div class="earn-cta-b"><a class="btn" href="/pickem/signup?next=/coins">Sign up</a><a class="btn ghost" href="/pickem/login?next=/coins">Log in</a></div></section>`;
      res.set('Cache-Control', 'no-store').send(layout(req, 'Every way to earn coins', pageHead(`${icon('coin')} MFL coins`, 'Every way to earn coins', "Coins are free and just for fun. Here's everything that pays them: how, how much and how often.") + `<div class="wrap earn">
        <nav class="seg earn-jump" aria-label="Sections">${jump.map(([id, n]) => `<a href="#${id}">${n}</a>`).join('')}</nav>
        ${top}${pickem}${lineup}${player}${survivor}${arcadeSec}${h2h}${daily}${ach}${cardsSec}${careerSec}${other}${spend}
        <p class="muted sm earn-foot">Coins are play money. They can't be bought, sold or traded for anything real. <a href="/pickem/rules">How Pick'em works</a></p>
      </div><style>${CSS}</style>`));
    } catch (e) { next(e); }
  });
};

const CSS = `
.earn>section,.earn>p{max-width:880px}
.earn-jump{margin-bottom:20px}
.earn-sec{scroll-margin-top:130px}
.earn-sec .card-h h2{display:flex;align-items:center;gap:8px}
.earn-sec .card-h .em{font-size:20px;line-height:1}
.earn-sub{color:var(--ink2);font-size:14.5px;line-height:1.6;margin:0 0 12px}
.ei{padding:14px 0;border-top:1px solid var(--line)}
.card-h+.ei{border-top:0;padding-top:0}
.ei-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.ei-h b{font:700 15.5px Inter;color:var(--ink)}
.ei-amt{font:800 14.5px Inter;color:#fcd34d;text-align:right;flex-shrink:0;max-width:55%}
.ei-c{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}
.ei-c .ic,.ei-amt .ic{width:14px;height:14px;vertical-align:-2px}
.ei p{margin:4px 0 0;color:var(--ink2);font-size:14px;line-height:1.6}
.ei-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:8px;font:600 12.5px Inter}
.ei-when{display:inline-flex;align-items:center;gap:5px;color:var(--muted)}
.ei-when .ic{width:13px;height:13px}
.ei-meta a{color:var(--red2)}
.earn-tbl{font-size:14px;margin-bottom:10px}
.earn-tbl th,.earn-tbl td{padding:9px 8px}
.earn-tbl td.up{color:#4ade80}.earn-tbl td.down{color:#ff6b7a}
.earn-tbl td small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.earn-tbl a{color:var(--ink)}
.arc-tbl td:not(.l){color:#fcd34d;font-weight:700}
.ei .rar-tag{display:inline-block;margin:2px 0}
.ch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;margin-top:8px}
.chx{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font-size:13.5px;color:var(--ink2)}
.chx b{color:#fcd34d;white-space:nowrap}
.chx.got{border-color:rgba(74,222,128,.45);background:rgba(74,222,128,.06);color:var(--ink)}
.earn-more{margin:12px 0 2px;font-size:13.5px}
.earn-more summary{cursor:pointer;color:var(--red2);font-weight:600}
.earn-more small{display:block;margin:10px 0 0;color:var(--muted);font:700 11px Inter;letter-spacing:.08em;text-transform:uppercase}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.achx{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02)}
.achx .em{font-size:22px;line-height:1}
.achx b{display:block;font-size:14px;color:var(--ink)}
.achx small{display:block;color:var(--muted);font-size:12.5px;line-height:1.4}
.achx.got{border-color:rgba(74,222,128,.45);background:rgba(74,222,128,.06)}
.earn-ul{margin:8px 0 0;padding-left:18px;color:var(--ink2);font-size:14px;line-height:1.6}
.earn-ul li{margin:4px 0}
.earn-ul b{color:var(--ink)}
.soon{padding:14px 16px;border:1px dashed var(--line2);border-radius:12px}
.soon b{color:#fcd34d;font:800 16px var(--disp);text-transform:uppercase}
.soon p{margin:4px 0 0;color:var(--ink2);font-size:14px}
.earn-sub a,.earn-foot a{color:var(--red2)}
.earn-me .pb-rows a{color:var(--ink)}
.earn-me .pb-rows a:hover{color:var(--red2)}
.earn-cta{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-color:rgba(245,179,1,.35)}
.earn-cta b{display:block;font:800 20px var(--disp);color:#fcd34d}
.earn-cta span{color:var(--ink2);font-size:14px}
.earn-cta-b{display:flex;gap:8px}
@media(max-width:760px){
  .earn-sec{padding:16px;scroll-margin-top:120px}
  .ei-h{flex-direction:column;gap:2px}
  .ei-amt{text-align:left;max-width:none}
  .earn-tbl{font-size:13px}
  .earn-tbl th,.earn-tbl td{padding:8px 5px}
  .earn-tbl th{font-size:10px;letter-spacing:.04em}
  .ch-grid{grid-template-columns:1fr}
  .ach-grid{grid-template-columns:1fr 1fr;gap:6px}
  .achx{flex-direction:column;align-items:flex-start;gap:4px;padding:9px 10px}
  .achx .em{font-size:18px}
  .achx b{font-size:13px}
  .achx small{font-size:11.5px}
  .earn-cta-b{width:100%}.earn-cta-b .btn{flex:1;justify-content:center}
}`;
