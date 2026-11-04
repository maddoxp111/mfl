// MFL Arcade: mini-games that pay out coins, plus the other ways to earn coins
// (daily challenges, the game-day check-in, achievement rewards).
//
// Coins are worked out live from each user's records, like everything else:
//   user.arcade   = [{ id, game, level, risk, stake, seed, at, local, status, payout, score, stats }]
//                   status: open (counts as a loss: refresh/quit forfeits) | won | lost | void
//   user.checkins = ['YYYY-MM-DD', ...]
// Daily challenges and achievement rewards are derived from what the user did.
const crypto = require('crypto');
const path = require('path');
const { Worker } = require('worker_threads');
const cards = require('./cards');

const LEVELS = ['Rookie', 'Pro', 'All-Pro', 'Legend'];
const RISK_MULT = [3, 4, 5, 6];
const OPEN_MAX_MS = 3 * 3600e3; // an unfinished match is a loss after this

// prizes: coins for a win at each level (every win pays, no daily cap). minSec: fastest believable game.
const GAMES = {
  bowl: { name: 'Modern Bowl', emoji: '🏈', tag: 'Retro football with YOUR Lineup.', prizes: [200, 450, 900, 1600], daily: 5, minSec: 50, maxScore: 250, practice: true },
  chess: { name: 'Chess', emoji: '♟️', tag: 'Checkmate the computer.', prizes: [80, 200, 450, 900], daily: 4, minSec: 15, verify: 'chess' },
  pool: { name: '8-Ball Pool', emoji: '🎱', tag: 'Sink your group, then the 8.', prizes: [60, 150, 300, 550], daily: 5, minSec: 10, maxScore: 7 },
  checkers: { name: 'Checkers', emoji: '🔴', tag: 'Jump every piece on the board.', prizes: [60, 150, 300, 550], daily: 4, minSec: 15, verify: 'checkers' },
  connect4: { name: 'Connect Four', emoji: '🟡', tag: 'Four in a row beats the CPU.', prizes: [40, 100, 220, 420], daily: 5, minSec: 6, verify: 'connect4' },
  trivia: { name: 'MFL Trivia', emoji: '🧠', tag: 'How well do you know the league?', prizes: [50, 120, 240, 400], daily: 3, minSec: 10, graded: true },
  fieldgoal: { name: 'Field Goal Frenzy', emoji: '🥅', tag: 'Ten kicks. Wind. Pressure.', prizes: [40, 90, 180, 320], daily: 5, minSec: 25, maxScore: 10, need: [5, 6, 7, 8] },
  bullseye: { name: 'QB Bullseye', emoji: '🎯', tag: 'Hit moving targets downfield.', prizes: [40, 90, 180, 320], daily: 5, minSec: 12, maxScore: 100, need: [8, 13, 18, 24] },
  flagpull: { name: 'Flag Pull', emoji: '🚩', tag: 'Pull flags. Don\'t touch your teammates.', prizes: [30, 80, 160, 300], daily: 5, minSec: 43, maxScore: 100 },
  blitz3d: { name: '3D Blitz', emoji: '🏟️', tag: 'Full 3D football: pull back to throw from the QB, scramble, sprint, real catches, tackles and hurdles, a 66-play playbook with Coach\'s Choice picks, 2-minute quarters. Plus Career mode. The biggest payouts in the Arcade.', prizes: [250, 550, 1100, 2000], daily: 5, minSec: 150, maxScore: 90, isNew: true },
  memory: { name: 'Card Memory', emoji: '🃏', tag: 'Match MFL player cards from memory.', prizes: [30, 70, 150, 280], daily: 5, minSec: 7, maxScore: 12 },
};
// Double or Nothing / Double or Double: a run of Legend 3D Blitz games. After every win you cash out or play on for double.
//   don: nothing up front; the cash-out starts at the Legend prize and doubles with every win. One loss and the run pays nothing.
//   dod: the Legend prize is at risk for the Legend Risk payout; both double with every win. The risk is never capped by the
//        balance (each step charges the previous risk again), so a loss can take an account into debt.
// Each game of a run is an ordinary arcade match with m.run = { id, mode, step, cash, atRisk, pending?, rolled?, cashedOut? }.
// A won step pays nothing until the player cashes out (pending), or is rolled into the next step; its stake stays spent, so
// the coin totals always add up: cashing out at step n nets cash - atRisk, losing at step n loses atRisk.
const RUNS = {
  don: { name: 'Double or Nothing', emoji: '🎲', stake: () => 0, cash: () => GAMES.blitz3d.prizes[3] },
  dod: { name: 'Double or Double', emoji: '🔥', stake: () => GAMES.blitz3d.prizes[3], cash: () => GAMES.blitz3d.prizes[3] * RISK_MULT[3] },
};
const runStep = (mode, step) => { const R = RUNS[mode], s0 = R.stake(), k = 2 ** (step - 1); return { step, cash: R.cash() * k, atRisk: s0 * k, charge: step === 1 ? s0 : s0 * 2 ** (step - 2) }; };
// what the page and the client need to show a run step
const runInfo = (m) => ({ id: m.id, mode: m.run.mode, name: RUNS[m.run.mode].name, emoji: RUNS[m.run.mode].emoji, step: m.run.step, cash: m.run.cash, atRisk: m.run.atRisk, charge: m.stake || 0, next: runStep(m.run.mode, m.run.step + 1) });
// a won step whose choice was never made is cashed out when the player starts anything else: nobody loses coins by walking away
function settlePending(user) {
  let n = 0;
  for (const m of user.arcade || []) if (m.run && m.run.pending && m.status === 'won') { m.payout = m.run.cash; m.run.pending = false; m.run.cashedOut = true; m.run.auto = true; n++; }
  return n;
}
// Games still being finished stay hidden (and can't be started) until their files ship.
const HIDDEN = new Set();
const ORDER = ['blitz3d', 'bowl', 'chess', 'pool', 'trivia', 'checkers', 'connect4', 'fieldgoal', 'bullseye', 'flagpull', 'memory'].filter((g) => !HIDDEN.has(g));
const CPU_TEAMS = [
  { name: 'JV Squad', abbr: 'JV', color: '#64748b', color2: '#e2e8f0' },
  { name: 'Hall Monitors', abbr: 'HMS', color: '#7c3aed', color2: '#f5f3ff' },
  { name: 'Detention Kings', abbr: 'DTK', color: '#b91c1c', color2: '#111111' },
  { name: 'The Faculty', abbr: 'FAC', color: '#0f172a', color2: '#facc15' },
];
// The 11-player Lineup. Modern Bowl's runtime knows the first 8 spots (BOWL_SIZE); 3D Blitz uses
// all 11: WR3 is the slot, and UTIL1, UTIL2, OL1, OL2, OL3 are the five linemen (left to right).
const POSITIONS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL1', 'UTIL2', 'OL1', 'OL2', 'OL3'];
const POS_LABEL = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL', 'UTIL', 'OL', 'OL', 'OL'];
const BOWL_SIZE = 8;

// ---------- player attributes ----------
// Base attributes for every real player: p.attr (set in /admin/ratings) when present, otherwise
// derived from the site rating and the Pick'em tendencies. Skills are 0-99, hgt is inches (54-78)
// and wgt pounds (70-250): these are middle-schoolers. Cards add their deltas on top (bowlPlayer).
const pickem = require('./pickem');
const ATTR_KEYS = ['thr', 'acc', 'spd', 'agi', 'sta', 'str', 'cat', 'def', 'kick', 'hgt', 'wgt'];
const SKILL_KEYS = ATTR_KEYS.slice(0, 9);
const ATTR_RANGE = { hgt: [54, 78], wgt: [70, 250] }; // everything else 0-99
const ATTR_LABEL = { thr: 'Throw power', acc: 'Accuracy', spd: 'Speed', agi: 'Agility', sta: 'Stamina', str: 'Strength', cat: 'Catching', def: 'Defense', kick: 'Kicking', hgt: 'Height', wgt: 'Weight' };
// Body types for 3D Blitz (stored as p.look.build; card effects can override).
const BUILDS = [['slim', 'Slim', 'thin and light'], ['lanky', 'Lanky', 'tall and thin, long arms and legs'], ['normal', 'Normal', 'average frame'], ['stocky', 'Stocky', 'compact and solid'], ['tank', 'Tank', 'big and strong all over'], ['fat', 'Fat', 'wide and heavy around the middle'], ['stubby', 'Stubby', 'short and thick'], ['tall', 'Tall', 'taller than most, normal frame'], ['short', 'Short', 'shorter than most, normal frame']];
const BUILD_IDS = BUILDS.map((b) => b[0]);
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampAttr = (k, v, lo = 0) => (ATTR_RANGE[k] ? clampN(v, ATTR_RANGE[k][0], ATTR_RANGE[k][1]) : clampN(v, lo, 99));
let rateFn = null; // the site's player rating (server.js ratingOf), set when the routes load
function scoutOvr(et, t, p) { // same as server.js scoutRating, for scripts that load this file alone
  if (Number.isFinite(+p.tend?.ovr)) return clampN(Math.round(+p.tend.ovr), 40, 99);
  const v = ['td', 'pass', 'int'].map((k) => et.player(t, p, k)).sort((a, b) => b - a);
  return Math.round(clampN(40 + 0.45 * v[0] + 0.15 * v[1], 40, 95));
}
const etMemo = new WeakMap(); // effTend replays every game, so share it for a moment
function tendOf(db) {
  const m = etMemo.get(db);
  if (m && Date.now() - m.at < 3000) return m.et;
  const et = pickem.effTend(db);
  etMemo.set(db, { at: Date.now(), et });
  return et;
}
// Default height/weight from position, how they joined, their look and a steady per-player spread.
const POS_BODY = [[/QB|QUARTER/, 1, 0], [/RB|RUNNING|HALF/, -1, 8], [/WR|RECEIVER|WIDE/, 1, -6], [/\bTE\b|TIGHT/, 2, 22], [/OL|LINEMAN|CENTER/, 1, 40], [/DL|DEF.*LINE/, 1, 35], [/LB|LINEBACK/, 1, 15], [/DB|CB|CORNER|SAFETY/, 0, -4], [/\bK\b|KICK/, -1, -8]];
const TAG_BODY = { C: [1.5, 10], TR: [0.5, 4], 'Rd 1': [1, 6], 'Rd 2': [0.5, 3], 'Rd 4': [-0.5, -3] };
const BUILD_BODY = { slim: [0, -15], lanky: [2, -12], stocky: [-1, 18], tank: [1, 45], fat: [0, 50], stubby: [-3, 20], tall: [4, 8], short: [-4, -8] };
function bodyOf(t, p) {
  const pos = String(p.position || '').toUpperCase(), L = p.look || {};
  const [, ph, pw] = POS_BODY.find(([re]) => re.test(pos)) || [0, 0, 0];
  const [th, tw] = TAG_BODY[p.tag] || [0, 0];
  const [bh, bw] = BUILD_BODY[L.build] || [0, 0];
  const lh = L.height === 'short' ? -3 : L.height === 'tall' ? 3 : 0;
  const r = hashNum('mfl-body:' + (t ? t.id : '') + ':' + p.id);
  const hgt = clampAttr('hgt', Math.round(61 + ph + th + bh + lh + ((r % 7) - 3)));
  const wgt = clampAttr('wgt', Math.round(105 + pw + tw + bw + (hgt - 61) * 4 + (((r >>> 4) % 31) - 15)));
  return { hgt, wgt };
}
// What a player's attributes are with no admin edits (the Modern Bowl formulas, before card boosts).
function derivedAttrs(db, t, p) {
  const et = tendOf(db);
  const ovr = rateFn ? rateFn(db, t, p) : scoutOvr(et, t, p);
  const td = et.player(t, p, 'td'), pass = et.player(t, p, 'pass'), int = et.player(t, p, 'int');
  const c = (v) => Math.round(clampN(v, 30, 99));
  return { thr: c(ovr * 0.55 + pass * 0.45), acc: c(ovr * 0.6 + pass * 0.4), spd: c(ovr * 0.7 + td * 0.3), agi: c(ovr * 0.75 + td * 0.25), sta: c(ovr * 0.8 + 12),
    str: c(ovr * 0.9 + 4), cat: c(ovr * 0.6 + td * 0.4), def: c(ovr * 0.6 + int * 0.4), kick: c(ovr * 0.8 + 8), ...bodyOf(t, p), ovr: c(ovr) };
}
// Overall for edited attributes: the derived overall moved by the average skill change.
function attrOvr(base, a) {
  const d = SKILL_KEYS.reduce((s, k) => s + (a[k] - base[k]), 0) / SKILL_KEYS.length;
  return clampN(Math.round(base.ovr + d), 0, 99);
}
// playerAttrs(db, team, player) -> { thr, acc, spd, agi, sta, str, cat, def, kick, hgt, wgt, ovr }
function playerAttrs(db, team, player) {
  const t = typeof team === 'string' ? db.teams[team] : team;
  const p = typeof player === 'string' ? t && t.roster.find((x) => x.id === player) : player;
  if (!t || !p) return null;
  const base = derivedAttrs(db, t, p), a = p.attr && typeof p.attr === 'object' ? p.attr : null;
  if (!a) return base;
  const has = (k) => a[k] != null && a[k] !== '' && Number.isFinite(+a[k]);
  const out = {};
  for (const k of ATTR_KEYS) out[k] = has(k) ? clampAttr(k, Math.round(+a[k])) : base[k];
  out.ovr = has('ovr') ? clampN(Math.round(+a.ovr), 0, 99) : attrOvr(base, out);
  return out;
}

// ---------- coins ----------
// Same seeded generator as public/arcade/arcade.js and engines.js.
function rngFrom(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function matchNet(m) {
  if (m.status === 'void') return 0;
  if (m.status === 'won') return (m.payout || 0) - (m.stake || 0);
  return -(m.stake || 0); // open or lost
}

// ---------- daily challenges ----------
const CHALLENGES = [
  { id: 'picks2', text: 'Make 2 picks', reward: 75, easy: true, need: 2, count: (d) => d.bets },
  { id: 'arcade3', text: 'Play 3 Arcade games', reward: 100, easy: true, need: 3, count: (d) => d.played },
  { id: 'lineup', text: 'Save your Lineup', reward: 60, easy: true, need: 1, count: (d) => d.lineups },
  { id: 'pack', text: 'Open a pack', reward: 60, easy: true, need: 1, count: (d) => d.packs },
  { id: 'win1', text: 'Win an Arcade game', reward: 120, need: 1, count: (d) => d.wins },
  { id: 'win3', text: 'Win 3 Arcade games', reward: 220, need: 3, count: (d) => d.wins },
  { id: 'bowlwin', text: 'Win a football game (3D Blitz or Modern Bowl)', reward: 200, need: 1, count: (d) => (d.winsBy.bowl || 0) + (d.winsBy.blitz3d || 0) },
  { id: 'bowltd', text: 'Score 3 TDs in one football game (3D Blitz or Modern Bowl)', reward: 150, need: 3, count: (d) => d.bowlTds },
  { id: 'prowin', text: 'Win any game on Pro or harder', reward: 160, need: 1, count: (d) => d.proWins },
  { id: 'risk', text: 'Win a game in Risk mode', reward: 200, need: 1, count: (d) => d.riskWins },
  { id: 'board', text: 'Win at Chess, Checkers or Connect Four', reward: 150, need: 1, count: (d) => (d.winsBy.chess || 0) + (d.winsBy.checkers || 0) + (d.winsBy.connect4 || 0) },
  { id: 'trivia', text: 'Get 6 trivia questions right in one game', reward: 120, need: 6, count: (d) => d.triviaBest },
  { id: 'variety', text: 'Play 3 different Arcade games', reward: 140, need: 3, count: (d) => d.kinds },
];
const CH_START = '2026-10-29';
function hashNum(s) { return parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16); }
function challengesFor(day) {
  const easy = CHALLENGES.filter((c) => c.easy), hard = CHALLENGES.filter((c) => !c.easy);
  const h = hashNum('mfl-ch:' + day);
  const a = hard[h % hard.length], b = hard[(h >>> 8) % hard.length] === a ? hard[((h >>> 8) + 1) % hard.length] : hard[(h >>> 8) % hard.length];
  return [easy[(h >>> 16) % easy.length], a, b];
}

module.exports = function arcade(app, h) {
  const { esc, icon, layout, pk, TZ, load, getDoc, putDoc, userKey, currentUser, loadAccount, ratingOf, coins, shortDate } = h;
  const localDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
  const today = () => localDay(new Date().toISOString());

  // What a user did on one day (for challenges).
  function dayFacts(user, day) {
    const ms = (user.arcade || []).filter((m) => m.local?.slice(0, 10) === day);
    const won = ms.filter((m) => m.status === 'won');
    const winsBy = {}; for (const m of won) winsBy[m.game] = (winsBy[m.game] || 0) + 1;
    return {
      bets: (user.bets || []).filter((b) => localDay(b.placed) === day).length,
      played: ms.length, wins: won.length, winsBy, kinds: new Set(ms.map((m) => m.game)).size,
      bowlTds: Math.max(0, ...ms.filter((m) => m.game === 'bowl' || m.game === 'blitz3d').map((m) => m.stats?.td || 0)),
      proWins: won.filter((m) => m.level >= 1).length, riskWins: won.filter((m) => m.risk).length,
      triviaBest: Math.max(0, ...ms.filter((m) => m.game === 'trivia').map((m) => m.score || 0)),
      packs: (user.packs || []).filter((p) => p.local?.slice(0, 10) === day).length,
      lineups: (user.lineups || []).filter((l) => l.local?.slice(0, 10) === day).length,
    };
  }
  function challengeStatus(user, day) {
    const f = dayFacts(user, day);
    return challengesFor(day).map((c) => { const n = c.count(f); return { ...c, n: Math.min(n, c.need), done: n >= c.need }; });
  }
  // Every day since challenges started: coins for each one completed.
  function challengeCoins(user) {
    const days = new Set([...(user.arcade || []).map((m) => m.local?.slice(0, 10)), ...(user.bets || []).map((b) => localDay(b.placed)), ...(user.packs || []).map((p) => p.local?.slice(0, 10)), ...(user.lineups || []).map((l) => l.local?.slice(0, 10))]);
    let total = 0;
    for (const d of days) if (d && d >= CH_START) for (const c of challengeStatus(user, d)) if (c.done) total += c.reward;
    return total;
  }
  const CHECKIN = 150;
  function canCheckIn(db, user) {
    const day = today(), now = pk.nowLocal(TZ).slice(11, 16);
    const game = db.games.find((g) => g.date === day && g.status !== 'postponed');
    if (!game) return { ok: false, why: 'Check-in opens on game days.' };
    if (now < '11:30' || now > '14:30') return { ok: false, why: 'Check-in is open 11:30 AM to 2:30 PM on game days.' };
    if ((user.checkins || []).includes(day)) return { ok: false, done: true, why: 'Checked in today ✓' };
    return { ok: true };
  }
  // Coins from the Arcade, challenges and check-ins (server.js adds these to the wallet).
  function arcadeCoins(user) {
    // won = what wins paid on top of their stakes; lost = stakes lost (Risk mode). Career games are in here too.
    let won = 0, lost = 0, played = 0;
    for (const m of user.arcade || []) { const n = matchNet(m); if (n > 0) won += n; else lost -= n; if (m.status === 'won' || m.status === 'lost') played++; }
    return { arcade: won - lost, arcadeWon: won, arcadeLost: lost, arcadePlayed: played, challenges: challengeCoins(user), checkins: (user.checkins || []).length * CHECKIN };
  }
  h.arcadeCoins = arcadeCoins;

  // ---------- Modern Bowl / 3D Blitz rosters ----------
  rateFn = ratingOf;
  // A player in a game: base attributes (playerAttrs) plus the card's deltas, clamped to game ranges.
  function bowlPlayer(db, t, p, pos, card) {
    const base = playerAttrs(db, t, p);
    const eff = card && typeof cards.cardEffects === 'function' ? cards.cardEffects(card) : null;
    const g = (k, v) => clampAttr(k, Math.round(v), 30);
    const r = {};
    if (eff) {
      const d = eff.attr || {}, dv = (k) => Math.round(+d[k]) || 0;
      for (const k of ATTR_KEYS) r[k] = g(k, base[k] + dv(k));
      // The overall moves by the average skill change (each change kept within 0-99).
      r.ovr = g('ovr', base.ovr + SKILL_KEYS.reduce((s, k) => s + clampN(base[k] + dv(k), 0, 99) - base[k], 0) / SKILL_KEYS.length);
    } else { // no card effects available: the flat boost by card multiplier
      const boost = card ? (card.mult - 1) * 14 + (card.variant === 'pixel' ? 6 : 0) : 0;
      for (const k of ATTR_KEYS) r[k] = g(k, base[k] + (ATTR_RANGE[k] ? 0 : boost));
      r.ovr = g('ovr', base.ovr + boost);
    }
    const build = (eff && BUILD_IDS.includes(eff.build) && eff.build) || (p.look && BUILD_IDS.includes(p.look.build) && p.look.build) || null;
    return { pos, id: p.id, name: p.name, num: p.number || '', ...r, stars: clampN(Math.round(r.ovr / 20), 1, 5), card: card ? card.label : null, look: p.look || null, photo: p.photo ? '/media/' + p.photo : null, build, fx: (eff && eff.fx) || null };
  }
  // A real team's best 11 (fewer if the roster is smaller), placed by what they're good at.
  const FIT = {
    QB: (a) => a.thr * 0.5 + a.acc * 0.4 + a.agi * 0.1, RB: (a) => a.spd * 0.4 + a.agi * 0.35 + a.str * 0.15 + a.cat * 0.1,
    WR: (a) => a.cat * 0.45 + a.spd * 0.35 + a.agi * 0.2, TE: (a) => a.cat * 0.5 + a.str * 0.5,
    UTIL1: (a) => a.ovr * 0.6 + a.str * 0.4, UTIL2: (a) => a.ovr * 0.6 + a.kick * 0.4, OL: (a) => a.str * 0.6 + ((a.wgt - 70) / 180) * 99 * 0.4,
  };
  function realLineup(db, t) {
    const left = t.roster.map((p) => ({ p, a: playerAttrs(db, t, p) }));
    const out = [];
    for (const pos of POSITIONS) {
      const fit = FIT[pos] || FIT[pos.replace(/\d$/, '')];
      left.sort((x, y) => fit(y.a) - fit(x.a));
      const x = left.shift();
      if (x) out.push(bowlPlayer(db, t, x.p, pos, null));
    }
    return out;
  }
  function myLineup(db, user) {
    const own = cards.collection(user);
    const ids = ((user.lineups || []).at(-1)?.cards || []);
    return POSITIONS.map((pos, i) => { const c = ids[i] && own[ids[i]] ? cards.cardInfo(db, ids[i]) : null; return c ? bowlPlayer(db, c.t, c.p, pos, c) : null; });
  }
  function bowlTeam(db, user, which) {
    if (which === 'mine') {
      const ps = user ? myLineup(db, user) : [];
      if (ps.filter(Boolean).length < POSITIONS.length) return null;
      const nm = `${user.name}'s Lineup`;
      return { name: nm.length <= 18 ? nm : user.name.slice(0, 18), abbr: user.name.slice(0, 3).toUpperCase(), color: '#ffc21a', color2: '#151515', players: ps };
    }
    const t = db.teams[which];
    if (t) return { name: t.name, abbr: t.abbr, color: t.color, color2: t.color2, players: realLineup(db, t) };
    const cpu = CPU_TEAMS[Number(String(which).replace('cpu', ''))];
    return cpu ? { ...cpu, players: [] } : null;
  }
  // Modern Bowl's runtime takes the first 8 Lineup spots (QB..UTIL2).
  const bowl8 = (team) => (team && team.players ? { ...team, players: team.players.slice(0, BOWL_SIZE) } : team);
  // One 3D Blitz roster entry (the shared game-roster shape).
  const R_KEYS = ['spd', 'str', 'agi', 'cat', 'thr', 'acc', 'sta', 'kick', 'def', 'hgt', 'wgt', 'ovr'];
  const rosterEntry = (team, p) => ({ id: p.id, name: p.name, pos: p.pos, team: team.name, color: team.color, color2: team.color2, number: p.num || '', photo: p.photo || null,
    look: { ...(p.look || {}), build: p.build || null }, r: Object.fromEntries(R_KEYS.map((k) => [k, p[k]])), fx: p.fx || null });
  const teamOvr = (team) => (team.players || []).filter(Boolean).reduce((s, p, _, a) => s + p.ovr / a.length, 0) || 60;

  // ---------- trivia ----------
  function seasonLines(db) {
    const tot = {};
    for (const g of db.games.filter((x) => x.status === 'final')) {
      const L = cards.gameLines(db, g, null);
      for (const [k, l] of Object.entries(L)) { const o = (tot[k] = tot[k] || { td: 0, pass: 0, int: 0, gp: 0 }); o.td += l.td; o.pass += l.pass; o.int += l.int; o.gp++; }
    }
    return tot;
  }
  function triviaQuiz(db, rng, n) {
    const teams = Object.values(db.teams), players = teams.flatMap((t) => t.roster.map((p) => ({ t, p })));
    const tot = seasonLines(db), stat = (x, k) => tot[x.t.id + '|' + x.p.id]?.[k] || 0;
    const finals = db.games.filter((g) => g.status === 'final' && g.homeScore != null);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const others = (right, pool, k = 3) => shuffle(pool.filter((x) => x !== right)).slice(0, k);
    const gens = [
      () => { const x = pick(players); return { q: `Which team does ${x.p.name} play for?`, a: x.t.name, opts: teams.map((t) => t.name) }; },
      () => { const best = [...players].sort((a, b) => stat(b, 'td') - stat(a, 'td'))[0]; if (!stat(best, 'td')) return null; return { q: 'Who has the most touchdowns this season?', a: best.p.name, opts: [best.p.name, ...others(best, players).map((x) => x.p.name)] }; },
      () => { const best = [...players].sort((a, b) => stat(b, 'pass') - stat(a, 'pass'))[0]; if (!stat(best, 'pass')) return null; return { q: 'Who has thrown the most TD passes?', a: best.p.name, opts: [best.p.name, ...others(best, players).map((x) => x.p.name)] }; },
      () => { const best = [...players].sort((a, b) => stat(b, 'int') - stat(a, 'int'))[0]; if (!stat(best, 'int')) return null; return { q: 'Who has the most interceptions?', a: best.p.name, opts: [best.p.name, ...others(best, players).map((x) => x.p.name)] }; },
      () => { const g = pick(finals); if (!g) return null; const A = db.teams[g.home], B = db.teams[g.away]; const right = `${A.abbr} ${g.homeScore} - ${g.awayScore} ${B.abbr}`; const fake = new Set([right]); while (fake.size < 4) { fake.add(`${A.abbr} ${7 * Math.floor(rng() * 5)} - ${7 * Math.floor(rng() * 5)} ${B.abbr}`); } return { q: `What was the final score on ${shortDate(g.date)}?`, a: right, opts: [...fake] }; },
      () => { const t = pick(teams); const c = t.roster.find((p) => p.tag === 'C'); if (!c) return null; return { q: `Who is the captain of the ${t.name}?`, a: c.name, opts: [c.name, ...others(c, t.roster.concat(...teams.map((x) => x.roster))).map((p) => p.name)] }; },
      () => { const x = pick(players.filter((y) => stat(y, 'td') > 0)); if (!x) return null; const n0 = stat(x, 'td'); const opts = new Set([String(n0)]); while (opts.size < 4) opts.add(String(Math.max(0, n0 + Math.floor(rng() * 7) - 3))); return { q: `How many touchdowns does ${x.p.name} have this season?`, a: String(n0), opts: [...opts] }; },
      () => { const x = pick(players.filter((y) => y.p.number)); if (!x) return null; const opts = new Set([String(x.p.number)]); while (opts.size < 4) opts.add(String(1 + Math.floor(rng() * 30))); return { q: `What number does ${x.p.name} wear?`, a: String(x.p.number), opts: [...opts] }; },
      () => { const g = pick(finals); if (!g) return null; const A = db.teams[g.home], B = db.teams[g.away]; const right = g.homeScore > g.awayScore ? A.name : g.awayScore > g.homeScore ? B.name : 'It was a tie'; return { q: `Who won the game on ${shortDate(g.date)}?`, a: right, opts: [A.name, B.name, 'It was a tie'] }; },
      () => { const x = pick(players); const rows = { C: 'Captain', TR: 'Team Rep', FA: 'Free Agent' }; const right = rows[x.p.tag] || (x.p.tag?.startsWith('Rd') ? `Drafted (${x.p.tag.replace('Rd', 'Round')})` : null); if (!right) return null; return { q: `How did ${x.p.name} join their team?`, a: right, opts: shuffle(['Captain', 'Team Rep', 'Free Agent', 'Drafted (Round 1)', 'Drafted (Round 2)', 'Drafted (Round 3)', 'Drafted (Round 4)'].filter((o) => o !== right)).slice(0, 3).concat(right) }; },
    ];
    const qs = [], seen = new Set();
    for (let tries = 0; qs.length < n && tries < 200; tries++) {
      const q = gens[Math.floor(rng() * gens.length)]();
      if (!q || seen.has(q.q)) continue;
      seen.add(q.q);
      const opts = shuffle([...new Set(q.opts)]).slice(0, 4);
      if (!opts.includes(q.a)) opts[Math.floor(rng() * opts.length)] = q.a;
      qs.push({ q: q.q, opts, a: opts.indexOf(q.a) });
    }
    return qs;
  }
  const TRIVIA = { n: [6, 8, 10, 12], need: [4, 6, 8, 10], secs: [20, 15, 12, 10] };

  // ---------- board-game verification (off the main thread) ----------
  function verifyBoard(game, moves, level, seed) {
    return new Promise((resolve) => {
      const w = new Worker(`const { parentPort, workerData } = require('worker_threads');
        const E = require(workerData.file);
        try { parentPort.postMessage(E.verify(workerData.game, workerData.moves, workerData.level, workerData.seed)); }
        catch (e) { parentPort.postMessage({ result: 'invalid', reason: String(e && e.message || e) }); }`, { eval: true, workerData: { file: path.join(__dirname, 'public/arcade/engines.js'), game, moves, level, seed } });
      const timer = setTimeout(() => { w.terminate(); resolve({ result: 'invalid', reason: 'Verification timed out' }); }, 60000);
      w.on('message', (m) => { clearTimeout(timer); w.terminate(); resolve(m); });
      w.on('error', (e) => { clearTimeout(timer); resolve({ result: 'invalid', reason: e.message }); });
    });
  }

  const jsCache = new Map();
  function gameJs(name) {
    if (!jsCache.has(name)) {
      const src = require('fs').readFileSync(path.join(__dirname, 'public/arcade', name + '.js'), 'utf8');
      jsCache.set(name, src.replace(/<\/script/gi, '<\\/script'));
    }
    return jsCache.get(name);
  }

  // ---------- routes ----------
  require('./career')(app, h, db => Object.values(db.teams).slice(0, 2).map(t => ({
    ...bowlTeam(db, null, t.id), id: t.id,
  })));
  // The supplied runtime has global input handlers, so isolate it in a frame.
  // Inline the scripts to retain Chromebook compatibility (see gameJs above).
  app.get('/play/football', (req, res) => {
    const fs = require('fs');
    const dir = path.join(__dirname, 'public/football');
    const inline = name => '<script>' + fs.readFileSync(path.join(dir, name), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>';
    res.type('html').send(fs.readFileSync(path.join(dir, 'frame.html'), 'utf8')
      .replace('<!-- MFL_EXTENSION -->', () => inline('html5game/uph_poki.js'))
      .replace('<!-- MFL_RUNTIME -->', () => inline('runtime.js'))
      .replace('<!-- MFL_QUALITY -->', () => inline('quality.js'))
      .replace('<!-- MFL_APPEARANCE -->', () => inline('appearance.js'))
      .replace('<!-- MFL_RENDERER -->', () => inline('renderer.js'))
      .replace('<!-- MFL_DIFFICULTY -->', () => inline('difficulty.js'))
      .replace('<!-- MFL_BRIDGE -->', () => inline('bridge.js')));
  });
  const json = (res, o) => res.set('Cache-Control', 'no-store').json(o);
  const paidToday = (user, game) => (user.arcade || []).filter((m) => m.game === game && m.status === 'won' && m.local?.slice(0, 10) === today()).length;

  app.post(['/arcade/start', '/api/m/start'], async (req, res) => {
    try {
      const db = load();
      const G = !HIDDEN.has(req.body.game) && GAMES[req.body.game];
      if (!G) return json(res, { ok: false, error: 'Unknown game.' });
      const runMode = req.body.game === 'blitz3d' && RUNS[req.body.mode] ? req.body.mode : null; // a Double or Nothing / Double or Double run: Legend only
      const level = runMode ? 3 : Math.max(0, Math.min(3, Math.floor(Number(req.body.level) || 0)));
      const career = !runMode && ['bowl', 'blitz3d'].includes(req.body.game) && [true, '1', 'true'].includes(req.body.career); // career games: plain prize, no Risk, no Lineup check
      const practice = !runMode && !career && req.body.mode === 'practice';
      const risk = !runMode && !practice && !career && (req.body.risk === '1' || req.body.risk === true || req.body.risk === 'on');
      const name = currentUser(req);
      if (!practice && !name) return json(res, { ok: false, error: runMode ? 'Log in to start a run.' : 'Log in to play for coins (or pick Practice).' });
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      const seed = crypto.randomBytes(8).toString('hex');
      const rng = rngFrom(seed);
      let data = {}, secret = null;
      if (req.body.game === 'bowl' && !career) {
        const mine = practice ? String(req.body.team || 'mine') : 'mine';
        const home = bowlTeam(db, user, mine);
        if (!home) return json(res, { ok: false, error: mine === 'mine' ? 'Set a full Lineup (all 11 positions) on the Cards page first, or play Practice as a real team.' : 'Pick a team.' });
        let away = practice ? bowlTeam(db, user, String(req.body.opp || 'cpu' + level)) : bowlTeam(db, user, 'cpu' + level);
        if (!away || away.name === home.name) away = bowlTeam(db, user, 'cpu' + level);
        away = { ...bowl8(away), boost: practice && away.players?.length ? (teamOvr(bowl8(away)) - 60) / 250 : 0 };
        data = { mode: practice ? 'practice' : 'coins', home: bowl8(home), away };
      } else if (req.body.game === 'trivia') {
        const quiz = triviaQuiz(db, rng, TRIVIA.n[level]);
        secret = quiz.map((q) => q.a);
        data = { questions: quiz.map(({ q, opts }) => ({ q, opts })), secs: TRIVIA.secs[level], need: TRIVIA.need[level], ...(practice ? { answers: secret } : {}) };
      } else if (req.body.game === 'blitz3d') {
        data = blitzData(db, user);
      } else if (req.body.game === 'memory') {
        data = { players: Object.values(db.teams).flatMap((t) => t.roster.map((p) => ({ name: p.name, team: t.name, color: t.color, color2: t.color2, photo: p.photo ? '/media/' + p.photo : null, number: p.number || '' }))) };
      }
      if (practice) return json(res, { ok: true, id: null, seed, level, levelName: LEVELS[level], risk: false, data });
      user.arcade = user.arcade || [];
      // Starting a new match forfeits any unfinished one (that's the "refresh = you still pay" rule).
      for (const m of user.arcade) if (m.status === 'open') { m.status = 'lost'; m.forfeit = true; }
      settlePending(user);
      const step = runMode ? runStep(runMode, 1) : null;
      const stake = runMode ? step.charge : risk ? G.prizes[level] : 0; // Risk mode: the whole prize goes on the line; a run's risk is never capped by the balance
      if (stake && !runMode) {
        const bal = h.accountOf(db, user, await h.survivorNow(db)).balance;
        if (bal < stake) { await putDoc(userKey(name), user); return json(res, { ok: false, error: `Risk mode costs ${stake} coins up front. You have ${bal}.` }); }
      }
      const m = { id: crypto.randomBytes(6).toString('hex'), game: req.body.game, level, risk, stake, seed, at: new Date().toISOString(), local: pk.nowLocal(TZ), status: 'open', payout: 0 };
      if (secret) m.secret = secret;
      if (career) m.career = true;
      if (runMode) m.run = { id: crypto.randomBytes(4).toString('hex'), mode: runMode, step: 1, cash: step.cash, atRisk: step.atRisk };
      user.arcade.push(m);
      if (user.arcade.length > 600) user.arcade = user.arcade.slice(-600);
      await putDoc(userKey(name), user);
      json(res, { ok: true, id: m.id, seed, level, levelName: LEVELS[level], risk, stake, data, ...(runMode ? { run: runInfo(m) } : {}), ...(career ? { career: true, prize: G.prizes[level], lineup: !!(typeof bowlTeam === 'function' && bowlTeam(db, user, 'mine')) } : {}) });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not start the game.' }); }
  });
  // Your Lineup if you have one (all 11, QB first), otherwise a real team's lineup.
  function blitzData(db, user) {
    const team = bowlTeam(db, user, 'mine') || bowlTeam(db, user, Object.keys(db.teams)[0]);
    return { players: (team.players || []).filter(Boolean).map((p) => rosterEntry(team, p)) };
  }
  // the won step of a run that is waiting for the player's choice
  const pendingRun = (user) => (user && user.arcade || []).find((m) => m.run && m.run.pending && m.status === 'won');
  async function runChoice(req, res, want) {
    const db = load();
    const name = currentUser(req);
    if (!name) return json(res, { ok: false, error: 'Log in again.' });
    const user = await getDoc(userKey(name), { fresh: true });
    const m = (user.arcade || []).find((x) => x.id === String(req.body.id || ''));
    if (!m || !m.run) return json(res, { ok: false, error: 'That run was not found.' });
    if (!m.run.pending || m.status !== 'won') return json(res, { ok: false, error: m.run.cashedOut ? 'That run was already cashed out.' : m.run.rolled ? 'That game was already doubled.' : 'That game has no choice to make.' });
    m.run.pending = false;
    if (want === 'cashout') {
      m.payout = m.run.cash; m.run.cashedOut = true;
      await putDoc(userKey(name), user);
      const bal = h.accountOf(db, user, await h.survivorNow(db)).balance;
      return json(res, { ok: true, payout: m.run.cash, net: m.run.cash - m.run.atRisk, balance: bal });
    }
    // double: the won step is rolled into the next one, which charges the previous risk again (dod) and doubles the cash-out
    m.run.rolled = true;
    for (const x of user.arcade) if (x.status === 'open') { x.status = 'lost'; x.forfeit = true; }
    const step = runStep(m.run.mode, m.run.step + 1), seed = crypto.randomBytes(8).toString('hex');
    const n = { id: crypto.randomBytes(6).toString('hex'), game: 'blitz3d', level: 3, risk: false, stake: step.charge, seed, at: new Date().toISOString(), local: pk.nowLocal(TZ), status: 'open', payout: 0, run: { id: m.run.id, mode: m.run.mode, step: step.step, cash: step.cash, atRisk: step.atRisk } };
    user.arcade.push(n);
    if (user.arcade.length > 600) user.arcade = user.arcade.slice(-600);
    await putDoc(userKey(name), user);
    json(res, { ok: true, id: n.id, seed, level: 3, levelName: LEVELS[3], risk: false, stake: n.stake, data: blitzData(db, user), run: runInfo(n) });
  }
  app.post('/arcade/run/cashout', (req, res) => runChoice(req, res, 'cashout').catch((e) => { console.error(e); json(res, { ok: false, error: 'Could not cash out.' }); }));
  app.post('/arcade/run/double', (req, res) => runChoice(req, res, 'double').catch((e) => { console.error(e); json(res, { ok: false, error: 'Could not start the next game.' }); }));

  app.post(['/arcade/finish', '/api/m/finish'], async (req, res) => {
    try {
      const db = load();
      const name = currentUser(req);
      if (!name) return json(res, { ok: false, error: 'Log in again to save your result.' });
      const user = await getDoc(userKey(name), { fresh: true });
      const m = (user.arcade || []).find((x) => x.id === String(req.body.id || ''));
      if (!m) return json(res, { ok: false, error: 'That game was not found.' });
      if (m.status !== 'open') return json(res, { ok: false, error: m.forfeit ? 'That game was forfeited when another one started.' : 'That game already ended.' });
      const G = GAMES[m.game], r = req.body.result || {};
      const secs = (Date.now() - Date.parse(m.at)) / 1000;
      let won = !!r.won, note = '';
      const score = Number.isFinite(+r.score) ? +r.score : null;
      if (secs > OPEN_MAX_MS / 1000) { won = false; note = 'That game ran too long.'; }
      if (won && secs < G.minSec) { won = false; note = 'That was too fast to count.'; }
      if (won && G.maxScore != null && score != null && (score < 0 || score > G.maxScore)) { won = false; note = 'That score is not possible.'; }
      if (won && G.need && score != null && score < G.need[m.level]) won = false;
      if (G.graded) {
        const ans = Array.isArray(r.answers) ? r.answers : [];
        const right = (m.secret || []).filter((a, i) => Number(ans[i]) === a).length;
        m.score = right; won = right >= TRIVIA.need[m.level] && secs >= G.minSec;
        note = `${right} of ${(m.secret || []).length} right.`;
      }
      if (won && G.verify) {
        const v = await verifyBoard(G.verify, Array.isArray(r.moves) ? r.moves.slice(0, 600).map(String) : [], m.level, m.seed);
        if (v.result !== 'win') { won = false; note = v.result === 'invalid' ? 'That game could not be verified.' : ''; console.warn('arcade verify', name, m.game, v); }
      }
      if (won && m.career && h.careerResult) { const c = await h.careerResult(name, m); if (c && !c.won) { won = false; note = c.note || note; } }
      // Re-read in case another tab changed the user meanwhile.
      const fresh = await getDoc(userKey(name), { fresh: true });
      const fm = (fresh.arcade || []).find((x) => x.id === m.id);
      if (!fm || fm.status !== 'open') return json(res, { ok: false, error: 'That game already ended.' });
      fm.status = won ? 'won' : 'lost';
      fm.payout = won && !fm.run ? Math.round(G.prizes[m.level] * (m.risk ? RISK_MULT[m.level] : 1)) : 0; // every win pays: no daily cap (a run's win waits for the cash out)
      if (fm.run && won) fm.run.pending = true;
      fm.score = m.score ?? score;
      fm.stats = r.stats && typeof r.stats === 'object' ? { td: Math.min(30, +r.stats.td || +r.stats.tds || 0) } : undefined;
      fm.secs = Math.round(secs);
      delete fm.secret;
      await putDoc(userKey(name), fresh);
      const bal = h.accountOf(db, fresh, await h.survivorNow(db)).balance;
      json(res, { ok: true, won, net: fm.status === 'won' ? fm.payout - fm.stake : -fm.stake, balance: bal, message: note, ...(fm.run ? { run: { ...runInfo(fm), choice: won, over: !won } } : {}) });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not save the result.' }); }
  });

  app.post('/arcade/checkin', async (req, res) => {
    const name = currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/arcade');
    const user = await getDoc(userKey(name), { fresh: true });
    if (canCheckIn(load(), user).ok) { (user.checkins = user.checkins || []).push(today()); await putDoc(userKey(name), user); }
    res.redirect('/arcade?m=checkin');
  });

  // ---------- pages ----------
  const fmt = (n) => Number(n).toLocaleString('en-US');
  function earnList(user, db) {
    const ch = user ? challengeStatus(user, today()) : challengesFor(today()).map((c) => ({ ...c, n: 0, done: false }));
    const ci = user ? canCheckIn(db, user) : { ok: false, why: 'Log in to check in on game days.' };
    return `<section class="card arc-earn"><div class="card-h"><h2>${icon('coin')} Daily challenges</h2><span class="muted sm">New ones every day</span></div>
      <div class="ch-list">${ch.map((c) => `<div class="ch ${c.done ? 'done' : ''}"><span class="ch-ic">${c.done ? '✓' : ''}</span><div><b>${esc(c.text)}</b><div class="ch-bar"><i style="width:${Math.round((c.n / c.need) * 100)}%"></i></div></div><span class="ch-r">+${c.reward}</span></div>`).join('')}</div>
      <div class="ci">${ci.ok ? `<form method="post" action="/arcade/checkin"><button class="btn">${icon('pin')} Game-day check-in · +${CHECKIN}</button></form>` : `<span class="muted sm">${icon('pin')} Game-day check-in (+${CHECKIN}): ${esc(ci.why)}</span>`}</div>
    </section>`;
  }
  const WAYS = [
    ['🏈', 'Arcade games', 'Win any Arcade game. Risk mode multiplies it up to 5×.'],
    ['✅', 'Daily challenges', 'Three new challenges every day.'],
    ['📍', 'Game-day check-in', `+${CHECKIN} for showing up on game days.`],
    ['🏆', 'Achievements', '+150 for every achievement you unlock.'],
    ['🎯', "Pick'em", 'Win picks on the next MFL game.'],
    ['🃏', 'Lineup', 'Your cards earn coins every game.'],
    ['🏝️', 'Survivor', 'Last one standing wins 250.'],
    ['📅', 'Daily bonus', 'Log in every day, streaks pay more.'],
    ['💰', 'Sell cards', 'Extra copies sell for coins.'],
  ];
  app.get('/arcade', async (req, res, next) => {
    try {
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      const tile = (id) => { const G = GAMES[id];
        return `<a class="arc-tile ${id === 'bowl' || id === 'blitz3d' ? 'big' : ''}" href="/arcade/${id}"><span class="arc-emoji">${G.emoji}</span><div><b>${esc(G.name)}${G.isNew ? ' <span class="arc-new">NEW</span>' : ''}</b><small>${esc(G.tag)}</small></div><span class="arc-pay">Up to ${fmt(G.prizes[3] * RISK_MULT[3])}</span>${user ? `<span class="arc-left">${paidToday(user, id)} paid ${paidToday(user, id) === 1 ? 'win' : 'wins'} today</span>` : ''}</a>`; };
      const recent = user ? (user.arcade || []).filter((m) => m.status !== 'open').slice(-6).reverse() : [];
      res.send(layout(req, 'Arcade', `<section class="arc-hero"><div class="wrap">
          <div class="arc-hero-in">
            <div><div class="kicker">${icon('star')} New · MFL Arcade</div><h1>Play games.<br>Win coins.</h1>
              <p>${ORDER.length} games, 4 levels each, Risk mode for up to ${RISK_MULT[3]}× the coins, and two new runs in 3D Blitz: Double or Nothing and Double or Double.</p>
              <div class="arc-cta"><a class="btn" href="/arcade/blitz3d?mode=don">${RUNS.don.emoji} Double or Nothing</a><a class="btn ghost" href="/career">MFL Career</a>${user ? `<span class="arc-bal">${coins(acct.balance)}</span>` : `<a class="btn ghost" href="/pickem/signup">Sign up free</a>`}</div></div>
            <div class="arc-hero-art" aria-hidden="true"><div class="px-field"><i></i><i></i><i></i><i></i><b></b></div></div>
          </div></div></section>
        <div class="wrap">${req.query.m === 'checkin' ? '<div class="toast">Checked in ✓</div>' : ''}
          <div class="arc-grid">${ORDER.map(tile).join('')}</div>
          <div class="home-grid"><div class="col">${earnList(user, db)}
            ${recent.length ? `<section class="card"><div class="card-h"><h2>Your recent games</h2></div><ol class="lb">${recent.map((m) => `<li><b>${esc(GAMES[m.game]?.name || m.game)}</b><small>${LEVELS[m.level]}${m.risk ? ' · Risk' : ''}${m.run ? ` · ${RUNS[m.run.mode].name} · game ${m.run.step}` : ''}</small><span class="${m.status === 'won' ? 'up' : 'down'}">${m.run && m.run.pending ? 'Choice waiting' : m.run && m.run.rolled ? 'Doubled' : m.status === 'won' ? '+' + fmt(m.payout - m.stake) : m.stake ? '-' + fmt(m.stake) : 'Loss'}</span></li>`).join('')}</ol></section>` : ''}</div>
            <div class="col"><section class="card"><div class="card-h"><h2>Every way to earn coins</h2></div><div class="ways">${WAYS.map(([e, t, d]) => `<div><span>${e}</span><b>${t}</b><small>${d}</small></div>`).join('')}</div></section>
            <section class="card"><div class="card-h"><h2>How Arcade coins work</h2></div><ul class="how">
              <li>Pick a level: Rookie, Pro, All-Pro or Legend. Harder levels pay more.</li>
              <li><b>Risk mode:</b> you put up the whole prize up front. Win and you get the prize × ${RISK_MULT.join(' / ')} (by level). Lose and every coin you put up is gone.</li>
              <li><b>Double or Nothing (3D Blitz, Legend):</b> nothing up front. After every win, cash out or play again for double: ${fmt(RUNS.don.cash())}, ${fmt(RUNS.don.cash() * 2)}, ${fmt(RUNS.don.cash() * 4)}… One loss and the run pays nothing.</li>
              <li><b>Double or Double (3D Blitz, Legend):</b> ${fmt(RUNS.dod.stake())} at risk for a ${fmt(RUNS.dod.cash())} cash-out, and both double with every win. The risk is never capped by your balance: lose and you go into debt.</li>
              <li>Leaving or refreshing a game counts as a loss.</li>
              <li>Every win pays, as many as you can get. <b>Practice</b> is always free and unlimited.</li></ul></section></div></div>
        </div>`));
    } catch (e) { next(e); }
  });

  // ---------- 3D Blitz career mode (formerly "franchise": routes /api/bf/* and doc keys keep that name) ----------
  // Saves live in docs "blitzfranchise/<user>": { slots: { 1: { meta, data, updated } } }. The client owns
  // the save; the server only stores it (size-capped). Coins for 3D wins go through /api/m/start + /api/m/finish
  // with the career flag, so they get the same server checks as the Arcade.
  const BF_SLOTS = ['1', '2', '3'], BF_MAX = 600 * 1024;
  const bfKey = (name) => 'blitzfranchise/' + name;
  const bfMeta = (m) => (m && typeof m === 'object' ? Object.fromEntries(Object.entries(m).slice(0, 12).map(([k, v]) => [String(k).slice(0, 24), typeof v === 'number' ? v : String(v).slice(0, 80)])) : {});
  // The user's card Lineup for Dynamic Lineup careers (both games). Null until the Lineup is full.
  h.careerLineup = (db, user) => (user ? bowlTeam(db, user, 'mine') : null);
  app.get('/arcade/blitz3d/franchise', (req, res) => res.redirect(302, '/career/blitz'));
  app.get('/career/blitz', async (req, res, next) => {
    try {
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      // Every real MFL player with ratings, photo and look, for building rosters.
      const players = Object.values(db.teams).flatMap((t) => t.roster.map((p) => ({ ...bowlPlayer(db, t, p, '', null), id: p.id, team: t.id, photo: p.photo ? '/media/' + p.photo : null, tag: p.tag || '' })));
      const teams = Object.values(db.teams).map((t) => ({ id: t.id, name: t.name, city: t.city, abbr: t.abbr, color: t.color, color2: t.color2 }));
      const realOf = (nm) => { for (const t of Object.values(db.teams)) { const x = t.roster.find((r) => r.name === nm); if (x) return { id: x.id, team: t.id, photo: x.photo ? '/media/' + x.photo : null }; } return {}; };
      const mine = h.careerLineup(db, user);
      const lineup = mine ? mine.players.filter(Boolean).map((p) => ({ ...p, ...realOf(p.name) })) : null;
      const boot = { user: name || null, players, teams, cpuTeams: CPU_TEAMS, slots: BF_SLOTS, prizes: GAMES.blitz3d.prizes, lineup };
      const script = ['arcade', 'blitz3d', 'blitzfranchise'].map((f) => `<script>${gameJs(f)}</script>`).join('');
      res.send(layout(req, '3D Blitz Career', `<div class="wrap arc-page bf-page">
        <div class="arc-head"><a href="/career" class="muted sm">${icon('arrow')} Career</a><h1><span>🏟️</span> 3D Blitz Career</h1><p class="muted">Build a program, play every game, win titles. Every game you win in 3D pays ${GAMES.blitz3d.prizes.map(fmt).join(' / ')} coins (Rookie / Pro / All-Pro / Legend).</p>${user ? `<span class="arc-bal">${coins(acct.balance)}</span>` : ''}</div>
        ${name ? '' : `<p class="muted sm"><a href="/pickem/login?next=/career/blitz">Log in</a> to save your career to your account and earn coins for wins (otherwise it saves on this device only).</p>`}
        <div id="bfRoot"></div></div>
        <script>window.MFL_BLITZ_CAREER=${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>${script}`, { ticker: false }));
    } catch (e) { next(e); }
  });
  app.get('/api/bf/saves', async (req, res) => {
    const name = currentUser(req);
    if (!name) return json(res, { ok: false, error: 'Log in to use account saves.' });
    const doc = (await getDoc(bfKey(name), { fresh: true })) || { slots: {} };
    json(res, { ok: true, saves: BF_SLOTS.map((slot) => ({ slot, ...(doc.slots[slot] ? { meta: doc.slots[slot].meta, updated: doc.slots[slot].updated } : { empty: true }) })) });
  });
  app.get('/api/bf/save/:slot', async (req, res) => {
    const name = currentUser(req), slot = String(req.params.slot);
    if (!name || !BF_SLOTS.includes(slot)) return json(res, { ok: false, error: 'Not found.' });
    const doc = (await getDoc(bfKey(name), { fresh: true })) || { slots: {} };
    json(res, doc.slots[slot] ? { ok: true, ...doc.slots[slot] } : { ok: false, error: 'Empty slot.' });
  });
  app.post('/api/bf/save/:slot', async (req, res) => {
    const name = currentUser(req), slot = String(req.params.slot);
    if (!name || !BF_SLOTS.includes(slot)) return json(res, { ok: false, error: 'Log in to save.' });
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object' || JSON.stringify(data).length > BF_MAX) return json(res, { ok: false, error: 'That save is too big or empty.' });
    const doc = (await getDoc(bfKey(name), { fresh: true })) || { owner: name, slots: {} };
    doc.owner = name;
    doc.slots[slot] = { meta: bfMeta(req.body.meta), data, updated: new Date().toISOString() };
    await putDoc(bfKey(name), doc);
    json(res, { ok: true, updated: doc.slots[slot].updated });
  });
  app.post('/api/bf/delete/:slot', async (req, res) => {
    const name = currentUser(req), slot = String(req.params.slot);
    if (!name || !BF_SLOTS.includes(slot)) return json(res, { ok: false });
    const doc = (await getDoc(bfKey(name), { fresh: true })) || { owner: name, slots: {} };
    delete doc.slots[slot];
    await putDoc(bfKey(name), doc);
    json(res, { ok: true });
  });

  app.get('/arcade/:game', async (req, res, next) => {
    try {
      const id = req.params.game, G = !HIDDEN.has(id) && GAMES[id];
      if (!G) return next();
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      const fullLineup = !!user && myLineup(db, user).filter(Boolean).length === POSITIONS.length;
      const lineupOk = id !== 'bowl' || fullLineup;
      const levels = LEVELS.map((n, i) => `<label class="lvl"><input type="radio" name="level" value="${i}" ${i === 0 ? 'checked' : ''}><span><b>${n}</b><small>Win ${fmt(G.prizes[i])}</small><em>Risk: put up ${fmt(G.prizes[i])} → win ${fmt(Math.round(G.prizes[i] * RISK_MULT[i]))}</em></span></label>`).join('');
      const teamOpts = (sel) => [user ? ['mine', 'My Lineup'] : null, ...Object.values(db.teams).map((t) => [t.id, t.name]), ...CPU_TEAMS.map((c, i) => ['cpu' + i, c.name + ' (CPU)'])].filter(Boolean).map(([v, n]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
      const teamsIds = Object.keys(db.teams);
      // Game code is inlined into the page: school web filters often block script URLs with words like "arcade" or "games".
      const script = ['arcade', ...(G.verify ? ['engines'] : []), id].map((f) => `<script>${gameJs(f)}</script>`).join('');
      const runs = id === 'blitz3d' ? Object.keys(RUNS) : [], pending = id === 'blitz3d' ? pendingRun(user) : null;
      const want = user && runs.includes(String(req.query.mode)) ? String(req.query.mode) : (user ? 'coins' : 'practice');
      const modeLabel = (m) => m === 'coins' ? `${icon('coin')} Play for coins` : m === 'practice' ? `${icon('star')} Practice${id === 'bowl' ? ' / Exhibition' : ''}` : `${RUNS[m].emoji} ${RUNS[m].name}`;
      const runInfoHtml = runs.map((m) => { const R = RUNS[m], c = R.cash(), r = R.stake(); return `<div class="run-info" data-run="${m}" hidden>${m === 'don'
        ? `<b>Legend only, nothing up front.</b> Win and choose: cash out ${fmt(c)}, or play again for ${fmt(c * 2)}, then ${fmt(c * 4)}, ${fmt(c * 8)}… One loss and the run pays nothing.`
        : `<b>Legend only. ${fmt(r)} at risk for a ${fmt(c)} cash-out.</b> After every win: cash out, or double both: ${fmt(r * 2)} at risk for ${fmt(c * 2)}, then ${fmt(r * 4)} for ${fmt(c * 4)}… The risk is never capped by your balance. Lose and you go into debt.`}</div>`; }).join('');
      res.send(layout(req, G.name, `<div class="wrap arc-page">
        <div class="arc-head"><a href="/arcade" class="muted sm">${icon('arrow')} Arcade</a><h1><span>${G.emoji}</span> ${esc(G.name)}</h1><p class="muted">${esc(G.tag)}</p>${user ? `<span class="arc-bal">${coins(acct.balance)}</span>` : ''}</div>
        ${id === 'blitz3d' ? `<a class="card bf-promo" href="/career/blitz"><span class="bf-promo-e">🏆</span><div><b>Career mode</b><small>Run a program for seasons: 12-team league, playoffs and the Blitz Bowl, recruiting, upgrades and records. 3 save slots. Every 3D win pays coins.</small></div><span class="btn">Play Career ${icon('arrow')}</span></a>` : ''}
        ${id === 'bowl' ? '<section class="card bowl-career-promo" style="padding:20px;margin-bottom:20px"><h2>MFL Football Career</h2><p class="muted">Lead a Metcalf team through a McLean County season. Develop players, build your program, and chase the County Cup.</p><a class="btn" href="/career/bowl">Play Career →</a></section><style>body.arc-playing .bowl-career-promo{display:none}</style>' : ''}
        <section class="arc-setup card"><form id="arcSetup">
          ${pending ? `<div class="run-wait" id="runWait"><b>${RUNS[pending.run.mode].emoji} Your ${RUNS[pending.run.mode].name} run is waiting.</b><span>You won game ${pending.run.step}. Cash out ${fmt(pending.run.cash)}, or double for ${fmt(pending.run.cash * 2)}.</span><button type="button" class="btn" id="runResume">Decide now</button></div>` : ''}
          <div class="arc-modes ${runs.length ? 'four' : ''}">${['coins', 'practice', ...runs].map((m) => `<label class="mode ${runs.includes(m) ? 'run ' + m : ''}"><input type="radio" name="mode" value="${m}" ${m === want ? 'checked' : ''} ${m !== 'practice' && !user ? 'disabled' : ''}><span>${modeLabel(m)}</span></label>`).join('')}</div>
          ${runInfoHtml}
          ${!user ? `<p class="muted sm"><a href="/pickem/login?next=/arcade/${id}">Log in</a> to play for coins${runs.length ? ' or start a run' : ''}. Practice is free.</p>` : ''}
          <div class="lvls">${levels}</div>
          ${id === 'bowl' ? `<div class="bowl-teams" data-practice><label>Your team<select name="team">${teamOpts(user ? 'mine' : teamsIds[0])}</select></label><label>Opponent<select name="opp">${teamOpts(user ? teamsIds[0] : teamsIds[1])}</select></label></div>
            ${user && !lineupOk ? `<p class="muted sm">To play for coins you need a full Lineup (all 11 positions). <a href="/pickem/cards">Set it up →</a></p>` : ''}` : ''}
          ${id === 'blitz3d' ? `<p class="muted sm">${fullLineup ? 'Your Lineup takes the field: all 11 (QB, RB, three WRs, TE and five linemen).' : `Set a full Lineup (all 11 positions) to play with your own cards. <a href="/pickem/cards">Set it up →</a> Until then you play as the ${esc(db.teams[teamsIds[0]]?.name || 'MFL')}.`}</p>` : ''}
          <label class="risk" data-coins><input type="checkbox" name="risk" value="1"><span><b>Risk mode</b><small>Put up the whole prize for ${RISK_MULT[0]}× to ${RISK_MULT[3]}× back when you win. Lose it all when you don't.</small></span></label>
          ${user ? `<p class="muted sm" data-coins>Every win pays. Leaving mid-game counts as a loss.</p>` : ''}
          <button type="submit" class="btn arc-go">${icon('fire')} <span data-label>Play</span></button><p id="arcMsg" class="err"></p>
        </form></section>
        <section id="arcStage" class="arc-stage" hidden></section>
      </div>
      <script>window.MFL_ARCADE=${JSON.stringify({ game: id, pending: pending ? runInfo(pending) : null })};
      (function(){const f=document.getElementById('arcSetup');const RUN=${JSON.stringify(runs)};const sync=()=>{const m=f.mode?f.mode.value:'coins',p=m==='practice',run=RUN.includes(m);
        f.querySelectorAll('[data-coins]').forEach(e=>e.hidden=p||run);f.querySelectorAll('[data-practice]').forEach(e=>e.hidden=!p);f.querySelectorAll('[data-run]').forEach(e=>{if(e.tagName!=='BUTTON')e.hidden=e.getAttribute('data-run')!==m;});
        if((p||run)&&f.risk)f.risk.checked=false;
        f.querySelectorAll('input[name=level]').forEach(i=>{i.disabled=run&&i.value!=='3';if(run&&i.value==='3')i.checked=true;i.closest('.lvl').classList.toggle('locked',run&&i.value!=='3');});
        const b=f.querySelector('.arc-go [data-label]');if(b)b.textContent=run?'Start the run':'Play';};
      f.addEventListener('change',sync);sync();})();</script>${script}`));
    } catch (e) { next(e); }
  });

  // ---------- admin: recent paid wins, with a Void button for anything fishy ----------
  app.get('/admin/arcade', h.requireAdmin, async (req, res) => {
    const users = await h.listDocs('users/');
    const rows = users.flatMap((u) => (u.arcade || []).filter((m) => m.status === 'won' || m.status === 'void').map((m) => ({ u: u.name, m }))).sort((a, b) => b.m.at.localeCompare(a.m.at)).slice(0, 150);
    res.send(layout(req, 'Arcade admin', h.pageHead('Admin', 'Arcade wins') + `<div class="wrap">${h.adminNav('/admin/arcade')}
      <div class="card"><p class="muted sm">Most recent paid wins. Voiding a win removes its coins (and gives back a Risk stake). Fast times or huge scores are worth a look.</p>
      <table class="tbl"><thead><tr><th class="l">When</th><th class="l">Player</th><th class="l">Game</th><th>Level</th><th>Time</th><th>Score</th><th>Coins</th><th></th></tr></thead><tbody>
      ${rows.map(({ u, m }) => `<tr><td class="l">${esc(m.local || '')}</td><td class="l">@${esc(u)}</td><td class="l">${esc(GAMES[m.game]?.name || m.game)}</td><td>${LEVELS[m.level]}${m.risk ? ' · Risk' : ''}</td><td>${m.secs != null ? m.secs + 's' : ''}</td><td>${m.score ?? ''}</td><td>${m.status === 'void' ? 'void' : '+' + fmt(m.payout - m.stake)}</td>
        <td>${m.status === 'won' ? `<form method="post" action="/admin/arcade/void"><input type="hidden" name="u" value="${esc(u)}"><input type="hidden" name="id" value="${esc(m.id)}"><button class="btn ghost sm">Void</button></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No wins yet.</td></tr>'}</tbody></table></div></div>`));
  });
  // ---------- admin: how each real player looks (Modern Bowl and 3D Blitz) and their 3D build ----------
  const LOOK_OPTS = { skin: [0, 1, 2, 3, 4], height: ['short', 'normal', 'tall'], cleats: ['black', 'white', 'team', 'gold', 'red'] };
  const BUILD_SHAPE = { slim: [0.8, 1], lanky: [0.78, 1.1], normal: [1, 1], stocky: [1.18, 0.94], tank: [1.32, 1.05], fat: [1.38, 1], stubby: [1.22, 0.86], tall: [1, 1.12], short: [1, 0.88] };
  app.get('/admin/looks', h.requireAdmin, (req, res) => {
    const db = load();
    const sel = (name, vals, cur, labels) => `<select name="${name}">${vals.map((v, i) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(labels ? labels[i] : v)}</option>`).join('')}</select>`;
    const buildDesc = (b) => { const x = BUILDS.find((y) => y[0] === b); return x ? `${x[1]}: ${x[2]}` : 'Default: set by height'; };
    const rows = Object.values(db.teams).map((t) => `<section class="card"><div class="card-h"><h2>${esc(t.name)}</h2></div><div class="looks">
      ${t.roster.map((p) => { const L = p.look || {}; return `<form method="post" action="/admin/looks/${esc(t.id)}/${esc(p.id)}" class="look" id="${esc(p.id)}" data-color="${esc(t.color)}" data-color2="${esc(t.color2)}">
        <div class="look-art"><canvas width="10" height="25"></canvas><svg class="bsil" viewBox="0 0 40 60" aria-hidden="true"><g><circle cx="20" cy="10" r="6"/><rect x="12" y="17" width="16" height="20" rx="5"/><rect x="13" y="36" width="6" height="21" rx="3"/><rect x="21" y="36" width="6" height="21" rx="3"/><rect x="6" y="18" width="5" height="16" rx="2.5"/><rect x="29" y="18" width="5" height="16" rx="2.5"/></g></svg></div><b>${esc(p.name)}</b>
        <label>Skin ${sel('skin', LOOK_OPTS.skin, L.skin ?? 0, ['Light', 'Fair', 'Tan', 'Brown', 'Dark'])}</label>
        <label>Height ${sel('height', LOOK_OPTS.height, L.height || 'normal', ['Short', 'Normal', 'Tall'])}</label>
        <label>Cleats ${sel('cleats', LOOK_OPTS.cleats, L.cleats || 'black', ['Black', 'White', 'Team color', 'Gold', 'Red'])}</label>
        <label>Build ${sel('build', ['', ...BUILD_IDS], L.build || '', ['Default', ...BUILDS.map((x) => x[1])])}</label>
        <small class="bdesc">${esc(buildDesc(L.build))}</small>
        <label class="chk"><input type="checkbox" name="visor" value="1" ${L.visor ? 'checked' : ''}> Tinted visor</label>
        <label class="chk"><input type="checkbox" name="sleeves" value="1" ${L.sleeves ? 'checked' : ''}> Long sleeves</label>
        <button class="btn sm">Save</button></form>`; }).join('')}</div></section>`).join('');
    res.send(layout(req, 'Looks & builds', h.pageHead('Admin', 'Looks & builds') + `<div class="wrap">${h.adminNav('/admin/looks')}${req.query.saved ? '<div class="toast">Saved ✓</div>' : ''}
      <p class="muted">Set each player's appearance. Skin, height, cleats, visor and sleeves show in Modern Bowl and 3D Blitz; <b>Build</b> shapes the body in 3D Blitz (some cards change it in game). Changes apply to new games. <a href="/admin/ratings">Ratings →</a> <a href="/admin/teams">Team colors →</a></p>${rows}</div>
      <style>.looks{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.look{display:grid;grid-template-columns:70px 1fr;gap:6px 10px;align-items:center;padding:12px;border-radius:14px;background:var(--card2)}
      .look-art{grid-row:span 9;display:flex;flex-direction:column;align-items:center;gap:8px;align-self:start}.look canvas{width:60px;height:auto;image-rendering:pixelated;background:#4a8f3c;border-radius:10px}.look .bsil{width:46px;height:69px;background:var(--card);border-radius:10px}.look .bsil g{transition:transform .15s}
      .look b{font-size:14px}.look label{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;color:var(--ink2)}.look select{background:var(--card);color:var(--ink);border:1px solid var(--line2);border-radius:8px;padding:3px;max-width:120px}.look .bdesc{font-size:11px;color:var(--muted);line-height:1.3;margin-top:-3px}.look .btn{justify-self:start}</style>
      <script>${require('fs').readFileSync(path.join(__dirname, 'public/football/appearance.js'), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>
      <script>(function(){const BD=${JSON.stringify(Object.fromEntries(BUILDS.map((x) => [x[0], x[1] + ': ' + x[2]])))},BS=${JSON.stringify(BUILD_SHAPE)};
      document.querySelectorAll('.look').forEach((f)=>{const c=f.querySelector('canvas'),x=c.getContext('2d'),g=f.querySelector('.bsil g');x.imageSmoothingEnabled=false;g.style.fill=f.dataset.color;
        const draw=()=>{const look={skin:+f.skin.value,height:f.height.value,cleats:f.cleats.value,visor:f.visor.checked,sleeves:f.sleeves.checked};
          const img=MFLFootballLooks.preview({color:f.dataset.color,color2:f.dataset.color2},look);c.width=img.width;c.height=img.height+1;x.imageSmoothingEnabled=false;x.drawImage(img,0,1);
          const b=f.build.value,s=BS[b]||[1,look.height==='short'?0.9:look.height==='tall'?1.1:1];g.setAttribute('transform','translate(20 58) scale('+s[0]+' '+s[1]+') translate(-20 -58)');
          f.querySelector('.bdesc').textContent=BD[b]||'Default: set by height';};
        f.addEventListener('change',draw);draw();});})();</script>`));
  });
  app.post('/admin/looks/:team/:pid', h.requireAdmin, async (req, res) => {
    const db = load(), t = db.teams[req.params.team], p = t && t.roster.find((x) => x.id === req.params.pid);
    if (p) {
      const b = req.body, pick = (v, opts, d) => (opts.map(String).includes(String(v)) ? v : d);
      p.look = { skin: Number(pick(b.skin, LOOK_OPTS.skin, 0)), height: pick(b.height, LOOK_OPTS.height, 'normal'), cleats: pick(b.cleats, LOOK_OPTS.cleats, 'black'), visor: !!b.visor, sleeves: !!b.sleeves, build: pick(b.build, BUILD_IDS, null) };
      await h.save();
    }
    res.redirect('/admin/looks?saved=1#' + encodeURIComponent(req.params.pid));
  });

  // ---------- admin: base ratings (attributes) for every player ----------
  const wantsJson = (req) => req.is('application/json') || /application\/json/.test(req.get('accept') || '');
  const attrText = (k, v) => (k === 'hgt' ? `${Math.floor(v / 12)}'${v % 12}"` : k === 'wgt' ? `${v} lb` : String(v));
  const TAG_NAME = { C: 'Captain', TR: 'Team rep', FA: 'Free agent' };
  app.get('/admin/ratings', h.requireAdmin, (req, res) => {
    const db = load(), teams = Object.values(db.teams);
    const row = (t, p) => {
      const d = derivedAttrs(db, t, p), a = playerAttrs(db, t, p), custom = !!(p.attr && typeof p.attr === 'object');
      const tag = TAG_NAME[p.tag] || (String(p.tag || '').startsWith('Rd') ? 'Round ' + String(p.tag).replace(/\D/g, '') : '');
      const pic = p.photo ? `<img src="/media/${esc(p.photo)}" alt="" loading="lazy">` : `<span style="background:${esc(t.color)}">${esc(p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2))}</span>`;
      return `<form method="post" action="/admin/ratings/${esc(t.id)}/${esc(p.id)}" class="rp${custom ? ' custom' : ''}" id="r-${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}" data-derived="${esc(JSON.stringify(d))}">
        <div class="rp-h"><div class="rp-pic">${pic}</div><div class="rp-n"><b>${esc(p.name)}</b><small>${[p.number ? '#' + esc(p.number) : '', esc(tag)].filter(Boolean).join(' · ')}<span class="rp-st">${custom ? 'Custom' : 'Derived'}</span></small></div>
          <div class="rp-ovr" title="Overall: the derived overall moved by the average skill change"><output>${a.ovr}</output><small>OVR</small></div></div>
        <div class="rp-g">${ATTR_KEYS.map((k) => { const [lo, hi] = ATTR_RANGE[k] || [0, 99]; return `<label class="rs${a[k] !== d[k] ? ' chg' : ''}"><span>${ATTR_LABEL[k]}<output>${attrText(k, a[k])}</output></span><input type="range" name="${k}" min="${lo}" max="${hi}" step="1" value="${a[k]}"></label>`; }).join('')}</div>
        <div class="rp-f"><button class="btn sm rp-save" name="save" value="1">Save</button><button class="btn ghost sm" name="reset" value="1">Reset to derived</button><span class="rp-ok" role="status"></span></div>
      </form>`;
    };
    res.send(layout(req, 'Player ratings', h.pageHead('Admin', 'Player ratings', 'Base attributes every game uses (Modern Bowl and 3D Blitz). Cards add their boosts on top.') + `<div class="wrap rt-page">${h.adminNav('/admin/ratings')}${req.query.saved ? '<div class="toast">Saved ✓</div>' : ''}
      <div class="rt-top"><input type="search" id="rtFind" placeholder="Find a player" autocomplete="off" aria-label="Find a player"><div class="rt-jump">${teams.map((t) => `<a class="chip" href="#rt-${esc(t.id)}"><i style="background:${esc(t.color)}"></i>${esc(t.name)}</a>`).join('')}</div></div>
      <p class="muted sm rt-note">Players start <b>Derived</b>: worked out from their overall (set on <a href="/admin/tendencies">Tendencies</a>) and game results. Move a slider to make them <b>Custom</b>, then Save (or <kbd>Ctrl</kbd>+<kbd>S</kbd> to save every changed player). Skills are 0 to 99; height is in feet and inches, weight in pounds. Builds and looks are on <a href="/admin/looks">Looks &amp; builds</a>.</p>
      ${teams.map((t) => `<section class="card rt-team" id="rt-${esc(t.id)}"><div class="card-h"><h2>${esc(t.name)}</h2><span class="muted sm">${t.roster.length} players</span></div><div class="rt-list">${t.roster.map((p) => row(t, p)).join('')}</div></section>`).join('')}
      <div class="savebar rt-bar" id="rtBar" hidden><span id="rtCount"></span><button type="button" class="btn" id="rtAll">Save all</button></div></div>
      <style>.rt-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px}.rt-top input{flex:1 1 220px;min-width:0;background:var(--card);color:var(--ink);border:1px solid var(--line2);border-radius:999px;padding:10px 16px;font:inherit}
      .rt-jump{display:flex;flex-wrap:wrap;gap:6px}.rt-jump .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:var(--card2);border:1px solid var(--line2);font-size:13px;font-weight:600}.rt-jump .chip i{width:10px;height:10px;border-radius:50%}
      .rt-team{scroll-margin-top:80px}.rt-list{display:grid;gap:12px}.rp{background:var(--card2);border:1px solid transparent;border-radius:14px;padding:14px;scroll-margin-top:80px}.rp.dirty{border-color:var(--amber)}
      .rp-h{display:flex;align-items:center;gap:12px;margin-bottom:10px}.rp-pic img,.rp-pic span{width:42px;height:42px;border-radius:50%;object-fit:cover;display:grid;place-items:center;font:800 14px var(--disp);color:#fff}
      .rp-n{flex:1;min-width:0}.rp-n b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rp-n small{color:var(--muted);font-size:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .rp-st{font:700 10px Inter;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:var(--card);color:var(--muted)}.rp.custom .rp-st{background:rgba(245,179,1,.14);color:var(--amber)}
      .rp-ovr{display:grid;justify-items:center;line-height:1;min-width:52px}.rp-ovr output{font:900 26px var(--disp)}.rp-ovr small{font:700 10px Inter;letter-spacing:.08em;color:var(--muted);margin-top:3px}
      .rp-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 16px}.rs{display:grid;gap:2px;font-size:12px;color:var(--ink2)}.rs span{display:flex;justify-content:space-between;gap:6px}.rs output{font:800 13px var(--disp);color:var(--ink)}
      .rs.chg output{color:var(--amber)}
      .rs input{width:100%;margin:0;height:26px;accent-color:var(--red);padding:0;border:0;background:none}
      .rp-f{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}.rp-save:disabled{opacity:.45;cursor:default}.rp-ok{font-size:13px;font-weight:600;color:var(--green)}.rp-ok.err{color:var(--red2)}
      .rt-bar[hidden],.rp[hidden],.rt-team[hidden]{display:none}.rt-bar span{align-self:center;padding-left:10px;font-weight:600}.rt-note a{color:var(--ink);text-decoration:underline;text-underline-offset:2px}kbd{font:600 11px Inter;background:var(--card2);border:1px solid var(--line2);border-radius:5px;padding:1px 5px}
      @media (max-width:520px){.rp{padding:12px}.rp-g{grid-template-columns:1fr 1fr;gap:6px 12px}.rt-bar{border-radius:16px}}</style>
      <script>(function(){
        const KEYS=${JSON.stringify(ATTR_KEYS)},SK=${JSON.stringify(SKILL_KEYS)};
        const fmt=(k,v)=>k==='hgt'?Math.floor(v/12)+"'"+(v%12)+'"':k==='wgt'?v+' lb':String(v);
        const forms=[...document.querySelectorAll('.rp')],dirty=new Set(),bar=document.getElementById('rtBar'),cnt=document.getElementById('rtCount');
        const vals=(f)=>Object.fromEntries(KEYS.map((k)=>[k,+f.elements[k].value]));
        const bump=()=>{bar.hidden=!dirty.size;cnt.textContent=dirty.size+(dirty.size===1?' player':' players')+' changed';};
        function update(f){const d=JSON.parse(f.dataset.derived),v=vals(f);let s=0;
          for(const k of KEYS){const inp=f.elements[k],lab=inp.closest('.rs');lab.querySelector('output').textContent=fmt(k,v[k]);lab.classList.toggle('chg',v[k]!==d[k]);}
          for(const k of SK)s+=v[k]-d[k];
          f.querySelector('.rp-ovr output').textContent=Math.max(0,Math.min(99,Math.round(d.ovr+s/SK.length)));
          const ch=KEYS.some((k)=>v[k]!==f._saved[k]);f.classList.toggle('dirty',ch);f.querySelector('.rp-save').disabled=!ch;ch?dirty.add(f):dirty.delete(f);bump();}
        async function save(f,reset){const ok=f.querySelector('.rp-ok');ok.className='rp-ok';ok.textContent='Saving…';
          try{const r=await fetch(f.getAttribute('action'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(reset?{reset:1}:vals(f))});
            if(!(r.headers.get('content-type')||'').includes('json'))throw new Error('Log in again to save.');
            const j=await r.json();if(!j.ok)throw new Error(j.error||'Not saved.');
            f.dataset.derived=JSON.stringify(j.derived);for(const k of KEYS)f.elements[k].value=j.attr[k];f._saved=vals(f);
            f.classList.toggle('custom',!!j.custom);f.querySelector('.rp-st').textContent=j.custom?'Custom':'Derived';update(f);
            f.querySelector('.rp-ovr output').textContent=j.attr.ovr;ok.textContent=reset?'Reset ✓':'Saved ✓';clearTimeout(f._t);f._t=setTimeout(()=>{ok.textContent='';},2500);return true;
          }catch(e){ok.className='rp-ok err';ok.textContent=e.message||'Not saved.';return false;}}
        forms.forEach((f)=>{f._saved=vals(f);f.addEventListener('input',()=>update(f));
          f.addEventListener('submit',(e)=>{e.preventDefault();save(f,!!(e.submitter&&e.submitter.name==='reset'));});update(f);});
        const saveAll=async()=>{const b=document.getElementById('rtAll');b.disabled=true;for(const f of [...dirty])await save(f,false);b.disabled=false;};
        document.getElementById('rtAll').addEventListener('click',saveAll);
        document.addEventListener('keydown',(e)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(dirty.size)saveAll();}});
        window.addEventListener('beforeunload',(e)=>{if(dirty.size){e.preventDefault();e.returnValue='';}});
        const q=document.getElementById('rtFind');q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();
          forms.forEach((f)=>{f.hidden=!!s&&!f.dataset.name.includes(s);});document.querySelectorAll('.rt-team').forEach((t)=>{t.hidden=![...t.querySelectorAll('.rp')].some((f)=>!f.hidden);});});
      })();</script>`, { ticker: false }));
  });
  app.post('/admin/ratings/:team/:pid', h.requireAdmin, async (req, res) => {
    const db = load(), t = db.teams[req.params.team], p = t && t.roster.find((x) => x.id === req.params.pid);
    if (!p) return wantsJson(req) ? json(res.status(404), { ok: false, error: 'That player was not found.' }) : res.redirect('/admin/ratings');
    const b = req.body || {}, base = derivedAttrs(db, t, p);
    if (b.reset) delete p.attr;
    else {
      const cur = playerAttrs(db, t, p), a = {};
      for (const k of ATTR_KEYS) { const v = b[k] != null && b[k] !== '' ? Number(b[k]) : NaN; a[k] = Number.isFinite(v) ? clampAttr(k, Math.round(v)) : cur[k]; }
      if (ATTR_KEYS.every((k) => a[k] === base[k])) delete p.attr; // same as derived: keep following the ratings
      else p.attr = { ...a, ovr: attrOvr(base, a) };
    }
    await h.save();
    if (wantsJson(req)) return json(res, { ok: true, custom: !!p.attr, attr: playerAttrs(db, t, p), derived: base });
    res.redirect('/admin/ratings?saved=1#r-' + encodeURIComponent(p.id));
  });
  app.post('/admin/arcade/void', h.requireAdmin, async (req, res) => {
    const name = String(req.body.u || '');
    const user = await getDoc(userKey(name), { fresh: true });
    const m = user && (user.arcade || []).find((x) => x.id === String(req.body.id || ''));
    if (m && m.status === 'won') { m.status = 'void'; await putDoc(userKey(name), user); }
    res.redirect('/admin/arcade');
  });

  return { GAMES, ORDER, LEVELS, RISK_MULT, POSITIONS, POS_LABEL, arcadeCoins, challengeStatus, today, playerAttrs, bowlPlayer, bowlTeam, myLineup, realLineup };
};
const ASSET_V = Date.now().toString(36);
module.exports.GAMES = GAMES;
module.exports.POSITIONS = POSITIONS;
module.exports.POS_LABEL = POS_LABEL;
module.exports.LINEUP_POS = POSITIONS;
module.exports.BOWL_SIZE = BOWL_SIZE;
module.exports.ATTR_KEYS = ATTR_KEYS;
module.exports.ATTR_RANGE = ATTR_RANGE;
module.exports.BUILDS = BUILDS;
module.exports.playerAttrs = playerAttrs;
module.exports.derivedAttrs = derivedAttrs;
