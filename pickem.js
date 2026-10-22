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
      else { h.int++; bump(e.player, 'int'); }
    }
  }
  return h;
}

const PRIOR_GAMES = 3, PRIOR_POINTS = 14;
const tdRate = (h) => ((h.pts + PRIOR_POINTS * PRIOR_GAMES) / (h.gp + PRIOR_GAMES)) / 7;

// Admin "tendencies": 0 = very unlikely, 50 = go by stats alone, 100 = very likely.
const tv = (o, k) => (o && Number.isFinite(+o[k]) ? Math.max(0, Math.min(100, +o[k])) : 50);
const playerW = (v) => Math.pow(2, (v - 50) / 15); // 0 -> ~0.1x, 100 -> ~10x
const teamW = (v) => Math.pow(2, (v - 50) / 50); //   0 -> 0.5x, 100 -> 2x

const cache = new Map();
function markets(db, g) {
  const sig = g.id + '|' + db.games.filter(isFinal).map((x) => `${x.id}:${x.homeScore}-${x.awayScore}:${(x.events || []).length}`).join(',') +
    '|' + Object.values(db.teams).map((t) => JSON.stringify(t.tend || {}) + t.roster.map((p) => p.id + p.name + JSON.stringify(p.tend || {})).join()).join();
  if (cache.has(sig)) return cache.get(sig);
  const A = db.teams[g.home], B = db.teams[g.away];
  const hA = history(db, A.id), hB = history(db, B.id);
  // A team's offense tendency raises its scoring; the other team's defense tendency lowers it.
  const lA = tdRate(hA) * teamW(tv(A.tend, 'off')) / teamW(tv(B.tend, 'def'));
  const lB = tdRate(hB) * teamW(tv(B.tend, 'off')) / teamW(tv(A.tend, 'def'));

  // Simulate the game a few thousand times from each team's touchdown rate.
  const N = 6000;
  const r = rng([...String(sig)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const sims = [];
  for (let i = 0; i < N; i++) {
    const a = poisson(lA, r), b = poisson(lB, r);
    const first = a + b ? (r() < lA / (lA + lB) ? 'A' : 'B') : null;
    sims.push({ a: a * 7, b: b * 7, first });
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
  const side = (t) => (t.id === A.id ? ['a', 'b', 'A'] : ['b', 'a', 'B']);

  for (const t of [A, B]) { const [me, op] = side(t); add('Winner', `ml:${t.id}`, `${t.name} win`, P((s) => s[me] > s[op]), { team: t.id, family: 'win' }); }
  for (const t of [A, B]) {
    const [me] = side(t);
    for (const k of [7, 14, 21, 28, 35]) add('Team points', `tt:${t.id}:${k}`, `${t.name} score ${k}+`, P((s) => s[me] >= k), { team: t.id });
  }
  for (const k of [14, 21, 28, 35, 42, 49]) add('Total points', `tot:${k}`, `${k}+ total points`, P((s) => s.a + s.b >= k));
  for (const t of [A, B]) {
    const [me, op] = side(t);
    for (const m of [7, 14, 21]) add('Winning margin', `mar:${t.id}:${m}`, `${t.name} win by ${m}+`, P((s) => s[me] - s[op] >= m), { team: t.id, family: 'win' });
  }
  for (const t of [A, B]) { const [me, op, F] = side(t); add('Specials', `first:${t.id}`, `${t.name} score first`, P((s) => s.first === F), { team: t.id }); add('Specials', `so:${t.id}`, `${t.name} win with a shutout`, P((s) => s[me] > 0 && s[op] === 0), { team: t.id, family: 'win' }); }
  for (const k of [7, 14]) add('Specials', `both:${k}`, `Both teams score ${k}+`, P((s) => s.a >= k && s.b >= k));

  // Player props, from each player's share of their team's plays (with a prior so new players get a price).
  for (const t of [A, B]) {
    const h = t.id === A.id ? hA : hB, lam = t.id === A.id ? lA : lB;
    const passFrac = (h.pass + 0.7 * PRIOR_GAMES) / (h.td + PRIOR_GAMES);
    const intRate = (h.int + 0.8 * PRIOR_GAMES) / (h.gp + PRIOR_GAMES) * teamW(tv(t.tend, 'int'));
    // Each player's share of the team's TDs / passes / picks: stats-based, then
    // scaled by their tendency and re-normalized so the team total stays the same.
    const ph = (pl) => h.players[pl.name.toLowerCase()] || { td: 0, pass: 0, int: 0 };
    const shares = (k, prior) => {
      const w = t.roster.map((pl) => (ph(pl)[k] + prior) * playerW(tv(pl.tend, k)));
      const sum = w.reduce((a, b) => a + b, 0) || 1;
      return Object.fromEntries(t.roster.map((pl, i) => [pl.id, w[i] / sum]));
    };
    const sTd = shares('td', 0.5), sPass = shares('pass', 0.3), sInt = shares('int', 0.3);
    for (const pl of t.roster) {
      const x = lam * sTd[pl.id];
      add('Touchdown scorers', `ptd:${t.id}:${pl.id}`, `${pl.name} scores a TD`, 1 - Math.exp(-x), { team: t.id, player: pl.id });
      add('Touchdown scorers', `p2td:${t.id}:${pl.id}`, `${pl.name} scores 2+ TDs`, 1 - Math.exp(-x) * (1 + x), { team: t.id, player: pl.id });
      const y = lam * passFrac * sPass[pl.id];
      add('TD passes', `ppass:${t.id}:${pl.id}`, `${pl.name} throws a TD pass`, 1 - Math.exp(-y), { team: t.id, player: pl.id });
      const z = intRate * sInt[pl.id];
      add('Interceptions', `pint:${t.id}:${pl.id}`, `${pl.name} gets an INT`, 1 - Math.exp(-z), { team: t.id, player: pl.id });
    }
  }
  const out = { list, byKey: Object.fromEntries(list.map((m) => [m.key, m])) };
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
  if (picks.length > MAX_LEGS) return { error: `Parlays can have up to ${MAX_LEGS} picks.` };
  const legs = [], seen = new Set(), winFamily = new Map();
  for (const pk of picks) {
    const g = db.games.find((x) => x.id === String(pk.game));
    if (!isOpen(db, g, tz)) return { error: 'Picks for that game are closed. Refresh to see the next game.' };
    const m = markets(db, g).byKey[pk.key];
    if (!m) return { error: 'One of those bets is no longer available. Refresh and try again.' };
    const id = g.id + '|' + m.key;
    if (seen.has(id)) return { error: 'You picked the same bet twice.' };
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
  if (!(stake >= MIN_STAKE)) return { error: `Minimum bet is ${MIN_STAKE} coins.` };
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

// American odds, the way sportsbooks show them.
function american(dec) {
  if (dec >= 2) return '+' + Math.round((dec - 1) * 100);
  return '-' + Math.round(100 / (dec - 1));
}

module.exports = { LOCK_MINUTES, lockTime, nextGame, START_COINS, BAILOUT_COINS, BAILOUT_BELOW, MIN_STAKE, MAX_LEGS, isOpen, markets, legResult, betResult, account, buildBet, validName, hashPin, checkPin, american, nowLocal };
