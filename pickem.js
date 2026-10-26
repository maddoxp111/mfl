// MFL Pick'em: free play-money betting on league games (MFL Coins, no real money).
// Only "something happens" bets are offered (wins, overs, players scoring) and
// never unders, so nobody can win by playing badly on purpose.
const crypto = require('crypto');

const START_COINS = 1000;
const BAILOUT_COINS = 500;
const BAILOUT_BELOW = 50;
const VIG = 0.92; // house edge: fair odds are multiplied by this
const MAX_LEGS = 10;
const MIN_STAKE = 10;

// ---------- time / locking ----------
function nowLocal(tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
// Only the next game is open. Picks lock 4 minutes before kickoff (12:31 for a
// 12:35 game), and at that moment the following game opens.
const LOCK_MINUTES = 4;
function lockTime(g) {
  const [h, m] = (g.time || '12:35').split(':').map(Number);
  const t = h * 60 + m - LOCK_MINUTES;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function nextGame(db, tz) {
  const now = nowLocal(tz);
  return db.games
    .filter((g) => g.date && g.status === 'scheduled' && now < `${g.date} ${lockTime(g)}`)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] || null;
}
const isOpen = (db, g, tz) => !!g && nextGame(db, tz)?.id === g.id;

// ---------- odds model ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda, r) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;

// Per-team scoring history (all finished games, exhibitions included: more data helps).
function history(db, teamId) {
  const h = { gp: 0, pts: 0, td: 0, pass: 0, int: 0, players: {} };
  for (const g of db.games) {
    if (!isFinal(g) || (g.home !== teamId && g.away !== teamId)) continue;
    h.gp++;
    h.pts += g.home === teamId ? g.homeScore : g.awayScore;
    for (const e of g.events || []) {
      if (e.team !== teamId) continue;
      const bump = (name, k) => {
        if (!name) return;
        const key = name.toLowerCase();
        h.players[key] = h.players[key] || { td: 0, pass: 0, int: 0 };
        h.players[key][k]++;
      };
      if (e.type === 'TD') { h.td++; bump(e.player, 'td'); if (e.passer) { h.pass++; bump(e.passer, 'pass'); } }
      else if (e.type === 'INT') { h.int++; bump(e.player, 'int'); }
    }
  }
  return h;
}

const PRIOR_GAMES = 3, PRIOR_POINTS = 14;
const tdRate = (h) => ((h.pts + PRIOR_POINTS * PRIOR_GAMES) / (h.gp + PRIOR_GAMES)) / 7;

// Admin "tendencies": 0 = very unlikely, 50 = go by stats alone, 100 = very likely.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tv = (o, k) => (o && Number.isFinite(+o[k]) ? clamp(+o[k], 0, 100) : 50);
const playerW = (v) => Math.pow(2, (v - 50) / 15); // 0 -> ~0.1x, 100 -> ~10x
const teamW = (v) => Math.pow(2, (v - 50) / 50); //   0 -> 0.5x, 100 -> 2x

// Tendencies drift a little after every finished game (exhibitions too): up when a
// player/team produces, down a bit when they don't. The admin slider is the
// starting point; drift is recomputed from game results, so fixing a box score fixes it.
const DRIFT_MAX = 30;
function tendDrift(db) {
  const teams = {}, players = {};
  const T = (id) => (teams[id] = teams[id] || { off: 0, def: 0, int: 0 });
  const Pl = (tid, pid) => (players[tid + '|' + pid] = players[tid + '|' + pid] || { td: 0, pass: 0, int: 0 });
  const games = db.games.filter(isFinal).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
  for (const g of games) {
    const evs = g.events || [];
    const recorded = evs.some((e) => e.type === 'TD' || e.type === 'INT'); // without a box score we only know the score
    for (const [me, op] of [[g.home, g.away], [g.away, g.home]]) {
      const tdsFor = recorded ? evs.filter((e) => e.type === 'TD' && e.team === me).length : Math.round((g.home === me ? g.homeScore : g.awayScore) / 7);
      const tdsAgainst = recorded ? evs.filter((e) => e.type === 'TD' && e.team === op).length : Math.round((g.home === me ? g.awayScore : g.homeScore) / 7);
      const t = T(me);
      t.off += (tdsFor - 2) * 2;
      t.def += (2 - tdsAgainst) * 2;
      if (recorded) t.int += evs.some((e) => e.type === 'INT' && e.team === me) ? 3 : -1;
      if (!recorded || !db.teams[me]) continue;
      for (const pl of db.teams[me].roster) {
        const n = pl.name.toLowerCase(), d = Pl(me, pl.id);
        const did = (fn) => evs.some((e) => e.team === me && fn(e));
        d.td += did((e) => e.type === 'TD' && (e.player || '').toLowerCase() === n) ? 6 : -2;
        d.pass += did((e) => e.type === 'TD' && (e.passer || '').toLowerCase() === n) ? 6 : -1;
        // Threw a pick (logged on the other team's INT row): passing tendency drops.
        if (evs.some((e) => e.type === 'INT' && e.team !== me && (e.passer || '').toLowerCase() === n)) d.pass -= 3;
        d.int += did((e) => e.type === 'INT' && (e.player || '').toLowerCase() === n) ? 6 : -1;
      }
    }
  }
  for (const o of [...Object.values(teams), ...Object.values(players)]) for (const k in o) o[k] = clamp(o[k], -DRIFT_MAX, DRIFT_MAX);
  return { teams, players };
}
// What the odds actually use: admin base + automatic drift, kept within 0-100.
function effTend(db, drift = tendDrift(db)) {
  const team = (t, k) => clamp(tv(t.tend, k) + (drift.teams[t.id]?.[k] || 0), 0, 100);
  const player = (t, p, k) => clamp(tv(p.tend, k) + (drift.players[t.id + '|' + p.id]?.[k] || 0), 0, 100);
  return { team, player, drift };
}

// Spread line: expected margin, always on a half point so there are no pushes.
// League rule: every spread is 13.5 (favorite -13.5, underdog +13.5).
const SPREAD = 13.5;
function spreadLine(margin) {
  const l = Math.round(Math.abs(margin) * 2) / 2;
  return l % 1 === 0 ? l + 0.5 : l;
}
const fmtLine = (v) => (v > 0 ? '+' + v : String(v));

const cache = new Map();
function markets(db, g) {
  const sig = g.id + '|' + db.games.filter(isFinal).map((x) => `${x.id}:${x.homeScore}-${x.awayScore}:${JSON.stringify(x.events || [])}`).join(',') +
    '|' + Object.values(db.teams).map((t) => JSON.stringify(t.tend || {}) + t.roster.map((p) => p.id + p.name + JSON.stringify(p.tend || {})).join()).join();
  if (cache.has(sig)) return cache.get(sig);
  const A = db.teams[g.home], B = db.teams[g.away];
  const hA = history(db, A.id), hB = history(db, B.id);
  const et = effTend(db);
  // A team's offense tendency raises its scoring; the other team's defense tendency lowers it.
  const lA = tdRate(hA) * teamW(et.team(A, 'off')) / teamW(et.team(B, 'def'));
  const lB = tdRate(hB) * teamW(et.team(B, 'off')) / teamW(et.team(A, 'def'));
  const intRate = (t, h) => (h.int + 0.8 * PRIOR_GAMES) / (h.gp + PRIOR_GAMES) * teamW(et.team(t, 'int'));
  const iA = intRate(A, hA), iB = intRate(B, hB);

  // Simulate the game a few thousand times from each team's touchdown and pick rates.
  const N = 8000;
  const r = rng([...String(sig)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const sims = [];
  const pickSide = () => (r() < lA / (lA + lB) ? 'A' : 'B');
  for (let i = 0; i < N; i++) {
    const a = poisson(lA, r), b = poisson(lB, r);
    const first = a + b ? pickSide() : null, last = a + b ? (a && b ? pickSide() : a ? 'A' : 'B') : null;
    sims.push({ a: a * 7, b: b * 7, first, last, ia: poisson(iA, r), ib: poisson(iB, r) });
  }
  const P = (fn) => sims.filter(fn).length / N;

  const list = [];
  // Every bet is always offered: long shots just pay a lot (capped at +10000)
  // and near-locks pay very little.
  const add = (group, key, label, p, extra = {}) => {
    p = Math.min(0.985, Math.max(0.009, p || 0));
    const odds = Math.max(1.02, Math.min(101, Math.round((VIG / p) * 100) / 100));
    list.push({ group, key, label, odds, p, ...extra });
  };
  const side = (t) => (t.id === A.id ? ['a', 'b', 'A', 'ia'] : ['b', 'a', 'B', 'ib']);

  for (const t of [A, B]) { const [me, op] = side(t); add('Winner', `ml:${t.id}`, `${t.name} win`, P((s) => s[me] > s[op]), { team: t.id, family: 'win' }); }

  // Spread from the average simulated margin (built from every past game, exhibitions included).
  const margin = sims.reduce((x, s) => x + s.a - s.b, 0) / N;
  const line = SPREAD;
  const fav = margin >= 0 ? A : B, dog = fav === A ? B : A;
  const [fm, fo] = side(fav);
  add('Spread', `spr:${fav.id}:${-line}`, `${fav.name} ${fmtLine(-line)}`, P((s) => s[fm] - s[fo] > line), { team: fav.id, family: 'win', line: -line });
  add('Spread', `spr:${dog.id}:${line}`, `${dog.name} ${fmtLine(line)}`, P((s) => s[fm] - s[fo] < line), { team: dog.id, family: 'win', line });

  for (const t of [A, B]) {
    const [me] = side(t);
    for (const k of [7, 14, 21, 28, 35]) add('Team points', `tt:${t.id}:${k}`, `${t.name} score ${k}+`, P((s) => s[me] >= k), { team: t.id });
  }
  for (const k of [14, 21, 28, 35, 42, 49]) add('Total points', `tot:${k}`, `${k}+ total points`, P((s) => s.a + s.b >= k));
  for (const t of [A, B]) {
    const [me, op] = side(t);
    for (const m of [7, 14, 21]) add('Winning margin', `mar:${t.id}:${m}`, `${t.name} win by ${m}+`, P((s) => s[me] - s[op] >= m), { team: t.id, family: 'win' });
    for (const m of [7, 14]) add('Exact margin', `exm:${t.id}:${m}`, `${t.name} win by exactly ${m}`, P((s) => s[me] - s[op] === m), { team: t.id, family: 'win' });
  }
  add('Exact margin', 'tie', 'Game ends in a tie', P((s) => s.a === s.b), { family: 'win' });
  for (const t of [A, B]) {
    const [me, op, F] = side(t);
    add('Specials', `first:${t.id}`, `${t.name} score first`, P((s) => s.first === F), { team: t.id });
    add('Specials', `last:${t.id}`, `${t.name} score the last TD`, P((s) => s.last === F), { team: t.id });
    add('Specials', `so:${t.id}`, `${t.name} win with a shutout`, P((s) => s[me] > 0 && s[op] === 0), { team: t.id, family: 'win' });
    add('Specials', `fl:${t.id}`, `${t.name} score first AND win`, P((s) => s.first === F && s[me] > s[op]), { team: t.id, family: 'win' });
  }
  for (const k of [7, 14]) add('Specials', `both:${k}`, `Both teams score ${k}+`, P((s) => s.a >= k && s.b >= k));
  for (const t of [A, B]) { const [, , , mi] = side(t); add('Turnovers', `int1:${t.id}`, `${t.name} get an INT`, P((s) => s[mi] >= 1), { team: t.id }); add('Turnovers', `int2:${t.id}`, `${t.name} get 2+ INTs`, P((s) => s[mi] >= 2), { team: t.id }); }
  add('Turnovers', 'bothint', 'Both teams get an INT', P((s) => s.ia >= 1 && s.ib >= 1));
  add('Turnovers', 'int3', '3+ total INTs', P((s) => s.ia + s.ib >= 3));

  // Player props, from each player's share of their team's plays (with a prior so new players get a price).
  for (const t of [A, B]) {
    const h = t.id === A.id ? hA : hB, lam = t.id === A.id ? lA : lB, ti = t.id === A.id ? iA : iB;
    const [, , F] = side(t);
    const pFirstTeam = P((s) => s.first === F);
    const passFrac = (h.pass + 0.7 * PRIOR_GAMES) / (h.td + PRIOR_GAMES);
    // Each player's share of the team's TDs / passes / picks: stats-based, then
    // scaled by their tendency and re-normalized so the team total stays the same.
    const ph = (pl) => h.players[pl.name.toLowerCase()] || { td: 0, pass: 0, int: 0 };
    const shares = (k, prior) => {
      const w = t.roster.map((pl) => (ph(pl)[k] + prior) * playerW(et.player(t, pl, k)));
      const sum = w.reduce((a, b) => a + b, 0) || 1;
      return Object.fromEntries(t.roster.map((pl, i) => [pl.id, w[i] / sum]));
    };
    const sTd = shares('td', 0.5), sPass = shares('pass', 0.3), sInt = shares('int', 0.3);
    const atLeast = (x, k) => { let c = 0, term = Math.exp(-x); for (let i = 0; i < k; i++) { c += term; term *= x / (i + 1); } return 1 - c; };
    for (const pl of t.roster) {
      const x = lam * sTd[pl.id], y = lam * passFrac * sPass[pl.id], z = ti * sInt[pl.id];
      const o = { team: t.id, player: pl.id };
      add('Touchdown scorers', `ptd:${t.id}:${pl.id}`, `${pl.name} scores a TD`, atLeast(x, 1), o);
      add('Touchdown scorers', `p2td:${t.id}:${pl.id}`, `${pl.name} scores 2+ TDs`, atLeast(x, 2), o);
      add('Touchdown scorers', `p3td:${t.id}:${pl.id}`, `${pl.name} scores 3+ TDs (hat trick)`, atLeast(x, 3), o);
      add('Touchdown scorers', `pfirst:${t.id}:${pl.id}`, `${pl.name} scores the first TD`, pFirstTeam * sTd[pl.id], o);
      add('TD passes', `ppass:${t.id}:${pl.id}`, `${pl.name} throws a TD pass`, atLeast(y, 1), o);
      add('TD passes', `p2pass:${t.id}:${pl.id}`, `${pl.name} throws 2+ TD passes`, atLeast(y, 2), o);
      add('TD passes', `pdual:${t.id}:${pl.id}`, `${pl.name} scores AND throws a TD`, atLeast(x, 1) * atLeast(y, 1), o);
      add('Interceptions', `pint:${t.id}:${pl.id}`, `${pl.name} gets an INT`, atLeast(z, 1), o);
      add('Interceptions', `pint_td:${t.id}:${pl.id}`, `${pl.name} gets an INT AND scores a TD`, atLeast(z, 1) * atLeast(x, 1), o);
    }
  }
  const out = { list, byKey: Object.fromEntries(list.map((m) => [m.key, m])), line, fav: fav.id, margin };
  if (cache.size > 200) cache.clear();
  cache.set(sig, out);
  return out;
}

// ---------- settlement ----------
// Results are worked out live from the current game data, so fixing a score
// in admin automatically re-settles every bet on that game.
function legResult(db, leg) {
  const g = db.games.find((x) => x.id === leg.game);
  if (!g || g.status === 'postponed') return 'void';
  if (!isFinal(g)) return 'pending';
  const [type, a, b] = leg.key.split(':');
  const score = (t) => (g.home === t ? g.homeScore : g.awayScore);
  const opp = (t) => (g.home === t ? g.awayScore : g.homeScore);
  const team = db.teams[a];
  const name = (team?.roster.find((p) => p.id === b)?.name || leg.playerName || '').toLowerCase();
  const evs = (g.events || []).filter((e) => e.team === a);
  const count = (fn) => evs.filter(fn).length;
  const ok = (v) => (v ? 'won' : 'lost');
  switch (type) {
    case 'ml': return ok(score(a) > opp(a));
    case 'tt': return ok(score(a) >= +b);
    case 'tot': return ok(g.homeScore + g.awayScore >= +a);
    case 'mar': return ok(score(a) - opp(a) >= +b);
    case 'so': return ok(score(a) > 0 && opp(a) === 0);
    case 'both': return ok(g.homeScore >= +a && g.awayScore >= +a);
    case 'first': {
      const td = (g.events || []).find((e) => e.type === 'TD');
      if (td) return ok(td.team === a);
      return g.homeScore + g.awayScore === 0 ? 'lost' : 'void'; // points but no plays recorded
    }
    // Every spread counts at 13.5, including bets placed back when lines differed.
    case 'spr': return ok(score(a) - opp(a) + Math.sign(Number(b)) * SPREAD > 0);
    case 'exm': return ok(score(a) - opp(a) === +b);
    case 'tie': return ok(g.homeScore === g.awayScore);
    case 'fl': {
      const td = (g.events || []).find((e) => e.type === 'TD');
      if (!(score(a) > opp(a))) return 'lost';
      if (td) return ok(td.team === a);
      return 'void';
    }
    case 'last': {
      const tds = (g.events || []).filter((e) => e.type === 'TD');
      if (tds.length) return ok(tds[tds.length - 1].team === a);
      return g.homeScore + g.awayScore === 0 ? 'lost' : 'void';
    }
    case 'int1': return ok(count((e) => e.type === 'INT') >= 1);
    case 'int2': return ok(count((e) => e.type === 'INT') >= 2);
    case 'bothint': return ok([g.home, g.away].every((t) => (g.events || []).some((e) => e.type === 'INT' && e.team === t)));
    case 'int3': return ok((g.events || []).filter((e) => e.type === 'INT').length >= 3);
    case 'p3td': return ok(count((e) => e.type === 'TD' && (e.player || '').toLowerCase() === name) >= 3);
    case 'pfirst': {
      const td = (g.events || []).find((e) => e.type === 'TD');
      if (td) return ok(td.team === a && (td.player || '').toLowerCase() === name);
      return g.homeScore + g.awayScore === 0 ? 'lost' : 'void';
    }
    case 'p2pass': return ok(count((e) => e.type === 'TD' && (e.passer || '').toLowerCase() === name) >= 2);
    case 'pdual': return ok(count((e) => e.type === 'TD' && (e.player || '').toLowerCase() === name) >= 1 && count((e) => e.type === 'TD' && (e.passer || '').toLowerCase() === name) >= 1);
    case 'pint_td': return ok(count((e) => e.type === 'INT' && (e.player || '').toLowerCase() === name) >= 1 && count((e) => e.type === 'TD' && (e.player || '').toLowerCase() === name) >= 1);
    case 'ptd': return ok(count((e) => e.type === 'TD' && (e.player || '').toLowerCase() === name) >= 1);
    case 'p2td': return ok(count((e) => e.type === 'TD' && (e.player || '').toLowerCase() === name) >= 2);
    case 'ppass': return ok(count((e) => e.type === 'TD' && (e.passer || '').toLowerCase() === name) >= 1);
    case 'pint': return ok(count((e) => e.type === 'INT' && (e.player || '').toLowerCase() === name) >= 1);
    default: return 'void';
  }
}
function betResult(db, bet) {
  const res = bet.legs.map((l) => legResult(db, l));
  if (res.includes('lost')) return { status: 'lost', payout: 0, res };
  if (res.includes('pending')) return { status: 'pending', payout: 0, res };
  const live = bet.legs.filter((_, i) => res[i] === 'won');
  if (!live.length) return { status: 'void', payout: bet.stake, res };
  // Pay the price shown when the bet was placed unless a pick was refunded.
  const odds = live.length === bet.legs.length ? bet.odds : live.reduce((x, l) => x * l.odds, 1);
  return { status: 'won', payout: Math.floor(bet.stake * odds), res };
}
function account(db, user) {
  let bal = START_COINS + (user.bonuses || []).reduce((s, b) => s + b.amount, 0);
  let won = 0, lost = 0, pending = 0, profit = 0;
  const bets = (user.bets || []).map((b) => {
    const r = betResult(db, b);
    bal -= b.stake;
    if (r.status !== 'pending') bal += r.payout;
    if (r.status === 'won') { won++; profit += r.payout - b.stake; }
    if (r.status === 'lost') { lost++; profit -= b.stake; }
    if (r.status === 'pending') pending++;
    return { ...b, ...r };
  });
  return { balance: bal, won, lost, pending, profit, bets };
}

// ---------- bet validation ----------
function buildBet(db, picks, stake, tz) {
  if (!Array.isArray(picks) || !picks.length) return { error: 'Pick at least one bet.' };
  if (picks.length > MAX_LEGS) return { error: `Combos can have up to ${MAX_LEGS} picks.` };
  const legs = [], seen = new Set(), winFamily = new Map();
  for (const pk of picks) {
    const g = db.games.find((x) => x.id === String(pk.game));
    if (!isOpen(db, g, tz)) return { error: 'Picks for that game are closed. Refresh to see the next game.' };
    const m = markets(db, g).byKey[pk.key];
    if (!m) return { error: 'One of those picks is no longer available. Refresh and try again.' };
    const id = g.id + '|' + m.key;
    if (seen.has(id)) return { error: 'You added the same pick twice.' };
    seen.add(id);
    if (m.family === 'win') {
      // Only one "who wins" style pick per game, so parlays can't double-dip.
      if (winFamily.has(g.id)) return { error: 'Only one winner / margin / shutout pick per game in a parlay.' };
      winFamily.set(g.id, m.team);
    }
    const playerName = m.player ? db.teams[m.team].roster.find((p) => p.id === m.player)?.name : undefined;
    legs.push({ game: g.id, key: m.key, label: m.label, odds: m.odds, playerName });
  }
  const odds = Math.round(legs.reduce((x, l) => x * l.odds, 1) * 100) / 100;
  stake = Math.floor(Number(stake));
  if (!(stake >= MIN_STAKE)) return { error: `Minimum pick is ${MIN_STAKE} coins.` };
  return { bet: { id: crypto.randomBytes(6).toString('hex'), placed: new Date().toISOString(), stake, odds, legs } };
}

// ---------- accounts ----------
const validName = (u) => /^[a-z0-9_]{3,16}$/.test(u);
function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(pin), salt, 32).toString('hex') };
}
function checkPin(user, pin) {
  const { hash } = hashPin(pin, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// American odds, the way pick sites show them.
function american(dec) {
  if (dec >= 2) return '+' + Math.round((dec - 1) * 100);
  return '-' + Math.round(100 / (dec - 1));
}

module.exports = { SPREAD, tendDrift, effTend, fmtLine, LOCK_MINUTES, lockTime, nextGame, START_COINS, BAILOUT_COINS, BAILOUT_BELOW, MIN_STAKE, MAX_LEGS, isOpen, markets, legResult, betResult, account, buildBet, validName, hashPin, checkPin, american, nowLocal };
