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
const RISK_MULT = [1.5, 2.5, 3.5, 5];
const OPEN_MAX_MS = 3 * 3600e3; // an unfinished match is a loss after this

// prizes: coins for a win at each level. daily: paid wins per day. minSec: fastest believable game.
const GAMES = {
  bowl: { name: 'Modern Bowl', emoji: '🏈', tag: 'Retro football with YOUR Starting 8. The biggest payouts in the Arcade.', prizes: [200, 450, 900, 1600], daily: 5, minSec: 50, maxScore: 250, practice: true },
  chess: { name: 'Chess', emoji: '♟️', tag: 'Checkmate the computer.', prizes: [80, 200, 450, 900], daily: 4, minSec: 15, verify: 'chess' },
  pool: { name: '8-Ball Pool', emoji: '🎱', tag: 'Sink your group, then the 8.', prizes: [60, 150, 300, 550], daily: 5, minSec: 10, maxScore: 7 },
  checkers: { name: 'Checkers', emoji: '🔴', tag: 'Jump every piece on the board.', prizes: [60, 150, 300, 550], daily: 4, minSec: 15, verify: 'checkers' },
  connect4: { name: 'Connect Four', emoji: '🟡', tag: 'Four in a row beats the CPU.', prizes: [40, 100, 220, 420], daily: 5, minSec: 6, verify: 'connect4' },
  trivia: { name: 'MFL Trivia', emoji: '🧠', tag: 'How well do you know the league?', prizes: [50, 120, 240, 400], daily: 3, minSec: 10, graded: true },
  fieldgoal: { name: 'Field Goal Frenzy', emoji: '🥅', tag: 'Ten kicks. Wind. Pressure.', prizes: [40, 90, 180, 320], daily: 5, minSec: 25, maxScore: 10, need: [5, 6, 7, 8] },
  bullseye: { name: 'QB Bullseye', emoji: '🎯', tag: 'Hit moving targets downfield.', prizes: [40, 90, 180, 320], daily: 5, minSec: 12, maxScore: 100, need: [8, 13, 18, 24] },
  flagpull: { name: 'Flag Pull', emoji: '🚩', tag: 'Pull flags. Don\'t touch your teammates.', prizes: [30, 80, 160, 300], daily: 5, minSec: 43, maxScore: 100 },
  blitz3d: { name: '3D Blitz', emoji: '🏟️', tag: 'Full 3D football. Throw, juke and score before the clock runs out.', prizes: [150, 350, 700, 1200], daily: 5, minSec: 130, maxScore: 105, need: [14, 21, 21, 21], isNew: true },
  memory: { name: 'Card Memory', emoji: '🃏', tag: 'Match MFL player cards from memory.', prizes: [30, 70, 150, 280], daily: 5, minSec: 7, maxScore: 12 },
};
// Games still being finished stay hidden (and can't be started) until their files ship.
const HIDDEN = new Set();
const ORDER = ['bowl', 'blitz3d', 'chess', 'pool', 'trivia', 'checkers', 'connect4', 'fieldgoal', 'bullseye', 'flagpull', 'memory'].filter((g) => !HIDDEN.has(g));
const CPU_TEAMS = [
  { name: 'JV Squad', abbr: 'JV', color: '#64748b', color2: '#e2e8f0' },
  { name: 'Hall Monitors', abbr: 'HMS', color: '#7c3aed', color2: '#f5f3ff' },
  { name: 'Detention Kings', abbr: 'DTK', color: '#b91c1c', color2: '#111111' },
  { name: 'The Faculty', abbr: 'FAC', color: '#0f172a', color2: '#facc15' },
];
const POSITIONS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL1', 'UTIL2'];
const POS_LABEL = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL', 'UTIL'];

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
  { id: 'lineup', text: 'Save your Starting 8', reward: 60, easy: true, need: 1, count: (d) => d.lineups },
  { id: 'pack', text: 'Open a pack', reward: 60, easy: true, need: 1, count: (d) => d.packs },
  { id: 'win1', text: 'Win an Arcade game', reward: 120, need: 1, count: (d) => d.wins },
  { id: 'win3', text: 'Win 3 Arcade games', reward: 220, need: 3, count: (d) => d.wins },
  { id: 'bowlwin', text: 'Win a Modern Bowl game', reward: 200, need: 1, count: (d) => d.winsBy.bowl || 0 },
  { id: 'bowltd', text: 'Score 3 TDs in one Modern Bowl game', reward: 150, need: 3, count: (d) => d.bowlTds },
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
      bowlTds: Math.max(0, ...ms.filter((m) => m.game === 'bowl').map((m) => m.stats?.td || 0)),
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
    const arc = (user.arcade || []).reduce((s, m) => s + matchNet(m), 0);
    return { arcade: arc, challenges: challengeCoins(user), checkins: (user.checkins || []).length * CHECKIN };
  }
  h.arcadeCoins = arcadeCoins;

  // ---------- Modern Bowl rosters ----------
  function bowlPlayer(db, t, p, pos, card) {
    const et = pk.effTend(db);
    const ovr = ratingOf(db, t, p);
    const boost = card ? (card.mult - 1) * 14 + (card.variant === 'pixel' ? 6 : 0) : 0;
    const td = et.player(t, p, 'td'), pass = et.player(t, p, 'pass'), int = et.player(t, p, 'int');
    const c = (v) => Math.round(Math.max(30, Math.min(99, v + boost)));
    return { pos, name: p.name, num: p.number || '', ovr: c(ovr), spd: c(ovr * 0.7 + td * 0.3), thr: c(ovr * 0.55 + pass * 0.45), acc: c(ovr * 0.6 + pass * 0.4), cat: c(ovr * 0.6 + td * 0.4), str: c(ovr * 0.9 + 4), kick: c(ovr * 0.8 + 8), def: c(ovr * 0.6 + int * 0.4), stars: Math.max(1, Math.min(5, Math.round((ovr + boost) / 20))), card: card ? card.label : null, look: p.look || null };
  }
  // A real team's best 8, placed by what they're good at.
  function realLineup(db, t) {
    const et = pk.effTend(db);
    const left = [...t.roster];
    const take = (score) => { left.sort((a, b) => score(b) - score(a)); return left.shift(); };
    const out = [];
    const QB = take((p) => et.player(t, p, 'pass')); if (QB) out.push(['QB', QB]);
    const RB = take((p) => et.player(t, p, 'td') + ratingOf(db, t, p) * 0.3); if (RB) out.push(['RB', RB]);
    for (const pos of ['WR1', 'WR2', 'WR3', 'TE', 'UTIL1', 'UTIL2']) { const p = take((x) => ratingOf(db, t, x) + et.player(t, x, 'td') * 0.3); if (p) out.push([pos, p]); }
    return out.map(([pos, p]) => bowlPlayer(db, t, p, pos, null));
  }
  function myLineup(db, user) {
    const own = cards.collection(user);
    const ids = ((user.lineups || []).at(-1)?.cards || []);
    return ids.map((id, i) => { const c = own[id] ? cards.cardInfo(db, id) : null; return c ? bowlPlayer(db, c.t, c.p, POSITIONS[i], c) : null; });
  }
  function bowlTeam(db, user, which) {
    if (which === 'mine') {
      const ps = user ? myLineup(db, user) : [];
      if (ps.filter(Boolean).length < 8) return null;
      return { name: `${user.name}'s 8`.slice(0, 18), abbr: user.name.slice(0, 3).toUpperCase(), color: '#ffc21a', color2: '#151515', players: ps };
    }
    const t = db.teams[which];
    if (t) return { name: t.name, abbr: t.abbr, color: t.color, color2: t.color2, players: realLineup(db, t) };
    const cpu = CPU_TEAMS[Number(String(which).replace('cpu', ''))];
    return cpu ? { ...cpu, players: [] } : null;
  }
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
      const level = Math.max(0, Math.min(3, Math.floor(Number(req.body.level) || 0)));
      const practice = req.body.mode === 'practice';
      const risk = !practice && (req.body.risk === '1' || req.body.risk === true || req.body.risk === 'on');
      const name = currentUser(req);
      if (!practice && !name) return json(res, { ok: false, error: 'Log in to play for coins (or pick Practice).' });
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      const seed = crypto.randomBytes(8).toString('hex');
      const rng = rngFrom(seed);
      let data = {}, secret = null;
      if (req.body.game === 'bowl') {
        const mine = practice ? String(req.body.team || 'mine') : 'mine';
        const home = bowlTeam(db, user, mine);
        if (!home) return json(res, { ok: false, error: mine === 'mine' ? 'Set a full Starting 8 (all 8 positions) on the Cards page first, or play Practice as a real team.' : 'Pick a team.' });
        let away = practice ? bowlTeam(db, user, String(req.body.opp || 'cpu' + level)) : bowlTeam(db, user, 'cpu' + level);
        if (!away || away.name === home.name) away = bowlTeam(db, user, 'cpu' + level);
        away = { ...away, boost: practice && away.players?.length ? (teamOvr(away) - 60) / 250 : 0 };
        data = { mode: practice ? 'practice' : 'coins', home, away };
      } else if (req.body.game === 'trivia') {
        const quiz = triviaQuiz(db, rng, TRIVIA.n[level]);
        secret = quiz.map((q) => q.a);
        data = { questions: quiz.map(({ q, opts }) => ({ q, opts })), secs: TRIVIA.secs[level], need: TRIVIA.need[level], ...(practice ? { answers: secret } : {}) };
      } else if (req.body.game === 'blitz3d') {
        // Your Starting 8 if you have one (QB first), otherwise a real team's lineup.
        const team = bowlTeam(db, user, 'mine') || bowlTeam(db, user, Object.keys(db.teams)[0]);
        const photoOf = (nm) => { for (const t of Object.values(db.teams)) { const x = t.roster.find((r) => r.name === nm); if (x) return x.photo ? '/media/' + x.photo : null; } return null; };
        data = { players: (team.players || []).filter(Boolean).map((p) => ({ name: p.name, pos: p.pos, team: team.name, color: team.color, color2: team.color2, number: p.num || '', photo: photoOf(p.name), look: p.look || null })) };
      } else if (req.body.game === 'memory') {
        data = { players: Object.values(db.teams).flatMap((t) => t.roster.map((p) => ({ name: p.name, team: t.name, color: t.color, color2: t.color2, photo: p.photo ? '/media/' + p.photo : null, number: p.number || '' }))) };
      }
      if (practice) return json(res, { ok: true, id: null, seed, level, levelName: LEVELS[level], risk: false, data });
      user.arcade = user.arcade || [];
      // Starting a new match forfeits any unfinished one (that's the "refresh = you still pay" rule).
      for (const m of user.arcade) if (m.status === 'open') { m.status = 'lost'; m.forfeit = true; }
      if (paidToday(user, req.body.game) >= G.daily) return json(res, { ok: false, error: `You've hit today's max of ${G.daily} paid ${G.name} wins. Play Practice, or try another game!` });
      const stake = risk ? Math.round(G.prizes[level] / 3) : 0;
      if (stake) {
        const bal = h.accountOf(db, user, await h.survivorNow(db)).balance;
        if (bal < stake) { await putDoc(userKey(name), user); return json(res, { ok: false, error: `Risk mode costs ${stake} coins up front. You have ${bal}.` }); }
      }
      const m = { id: crypto.randomBytes(6).toString('hex'), game: req.body.game, level, risk, stake, seed, at: new Date().toISOString(), local: pk.nowLocal(TZ), status: 'open', payout: 0 };
      if (secret) m.secret = secret;
      user.arcade.push(m);
      if (user.arcade.length > 600) user.arcade = user.arcade.slice(-600);
      await putDoc(userKey(name), user);
      json(res, { ok: true, id: m.id, seed, level, levelName: LEVELS[level], risk, stake, data });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not start the game.' }); }
  });

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
      // Re-read in case another tab changed the user meanwhile.
      const fresh = await getDoc(userKey(name), { fresh: true });
      const fm = (fresh.arcade || []).find((x) => x.id === m.id);
      if (!fm || fm.status !== 'open') return json(res, { ok: false, error: 'That game already ended.' });
      const capped = won && paidToday(fresh, m.game) >= G.daily;
      fm.status = won ? 'won' : 'lost';
      fm.payout = won && !capped ? Math.round(G.prizes[m.level] * (m.risk ? RISK_MULT[m.level] : 1)) : 0;
      if (capped) { fm.payout = m.stake; note = "Today's paid-win max was already reached."; } // risk stake returned
      fm.score = m.score ?? score;
      fm.stats = r.stats && typeof r.stats === 'object' ? { td: Math.min(30, +r.stats.td || 0) } : undefined;
      fm.secs = Math.round(secs);
      delete fm.secret;
      await putDoc(userKey(name), fresh);
      const bal = h.accountOf(db, fresh, await h.survivorNow(db)).balance;
      json(res, { ok: true, won, net: fm.status === 'won' ? fm.payout - fm.stake : -fm.stake, balance: bal, message: note });
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
    ['🏈', 'Arcade games', 'Win any of the 10 games. Risk mode multiplies it up to 5×.'],
    ['✅', 'Daily challenges', 'Three new challenges every day.'],
    ['📍', 'Game-day check-in', `+${CHECKIN} for showing up on game days.`],
    ['🏆', 'Achievements', '+150 for every achievement you unlock.'],
    ['🎯', "Pick'em", 'Win picks on the next MFL game.'],
    ['🃏', 'Starting 8', 'Your cards earn coins every game.'],
    ['🏝️', 'Survivor', 'Last one standing wins 250.'],
    ['📅', 'Daily bonus', 'Log in every day, streaks pay more.'],
    ['💰', 'Sell cards', 'Extra copies sell for coins.'],
  ];
  app.get('/arcade', async (req, res, next) => {
    try {
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      const tile = (id) => { const G = GAMES[id]; const left = user ? G.daily - paidToday(user, id) : G.daily;
        return `<a class="arc-tile ${id === 'bowl' || id === 'blitz3d' ? 'big' : ''}" href="/arcade/${id}"><span class="arc-emoji">${G.emoji}</span><div><b>${esc(G.name)}${G.isNew ? ' <span class="arc-new">NEW</span>' : ''}</b><small>${esc(G.tag)}</small></div><span class="arc-pay">Up to ${fmt(G.prizes[3] * RISK_MULT[3])}</span>${user ? `<span class="arc-left">${Math.max(0, left)} paid wins left today</span>` : ''}</a>`; };
      const recent = user ? (user.arcade || []).filter((m) => m.status !== 'open').slice(-6).reverse() : [];
      res.send(layout(req, 'Arcade', `<section class="arc-hero"><div class="wrap">
          <div class="arc-hero-in">
            <div><div class="kicker">${icon('star')} New · MFL Arcade</div><h1>Play games.<br>Win coins.</h1>
              <p>${ORDER.length} games, 4 levels each, and Risk mode for up to 5× the coins. Modern Bowl puts YOUR Starting 8 on the field.</p>
              <div class="arc-cta"><a class="btn" href="/arcade/bowl">${icon('fire')} Play Modern Bowl</a><a class="btn ghost" href="/career">MFL Career</a>${user ? `<span class="arc-bal">${coins(acct.balance)}</span>` : `<a class="btn ghost" href="/pickem/signup">Sign up free</a>`}</div></div>
            <div class="arc-hero-art" aria-hidden="true"><div class="px-field"><i></i><i></i><i></i><i></i><b></b></div></div>
          </div></div></section>
        <div class="wrap">${req.query.m === 'checkin' ? '<div class="toast">Checked in ✓</div>' : ''}
          <div class="arc-grid">${ORDER.map(tile).join('')}</div>
          <div class="home-grid"><div class="col">${earnList(user, db)}
            ${recent.length ? `<section class="card"><div class="card-h"><h2>Your recent games</h2></div><ol class="lb">${recent.map((m) => `<li><b>${esc(GAMES[m.game]?.name || m.game)}</b><small>${LEVELS[m.level]}${m.risk ? ' · Risk' : ''}</small><span class="${m.status === 'won' ? 'up' : 'down'}">${m.status === 'won' ? '+' + fmt(m.payout - m.stake) : m.stake ? '-' + fmt(m.stake) : 'Loss'}</span></li>`).join('')}</ol></section>` : ''}</div>
            <div class="col"><section class="card"><div class="card-h"><h2>Every way to earn coins</h2></div><div class="ways">${WAYS.map(([e, t, d]) => `<div><span>${e}</span><b>${t}</b><small>${d}</small></div>`).join('')}</div></section>
            <section class="card"><div class="card-h"><h2>How Arcade coins work</h2></div><ul class="how">
              <li>Pick a level: Rookie, Pro, All-Pro or Legend. Harder levels pay more.</li>
              <li><b>Risk mode:</b> you put in a third of the prize up front. Win and you get the prize × ${RISK_MULT.join(' / ')} (by level). Lose and the coins you put in are gone.</li>
              <li>Leaving or refreshing a game counts as a loss.</li>
              <li>Each game pays out a limited number of wins per day. <b>Practice</b> is always free and unlimited.</li></ul></section></div></div>
        </div>`));
    } catch (e) { next(e); }
  });

  app.get('/arcade/:game', async (req, res, next) => {
    try {
      const id = req.params.game, G = !HIDDEN.has(id) && GAMES[id];
      if (!G) return next();
      const db = load();
      const name = currentUser(req);
      const { user, acct } = await loadAccount(db, name);
      const left = user ? G.daily - paidToday(user, id) : G.daily;
      const lineupOk = id !== 'bowl' || (user && myLineup(db, user).filter(Boolean).length === 8);
      const levels = LEVELS.map((n, i) => `<label class="lvl"><input type="radio" name="level" value="${i}" ${i === 0 ? 'checked' : ''}><span><b>${n}</b><small>Win ${fmt(G.prizes[i])}</small><em>Risk: ${fmt(Math.round(G.prizes[i] / 3))} → ${fmt(Math.round(G.prizes[i] * RISK_MULT[i]))}</em></span></label>`).join('');
      const teamOpts = (sel) => [user ? ['mine', 'My Starting 8'] : null, ...Object.values(db.teams).map((t) => [t.id, t.name]), ...CPU_TEAMS.map((c, i) => ['cpu' + i, c.name + ' (CPU)'])].filter(Boolean).map(([v, n]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
      const teamsIds = Object.keys(db.teams);
      // Game code is inlined into the page: school web filters often block script URLs with words like "arcade" or "games".
      const script = ['arcade', ...(G.verify ? ['engines'] : []), id].map((f) => `<script>${gameJs(f)}</script>`).join('');
      res.send(layout(req, G.name, `<div class="wrap arc-page">
        <div class="arc-head"><a href="/arcade" class="muted sm">${icon('arrow')} Arcade</a><h1><span>${G.emoji}</span> ${esc(G.name)}</h1><p class="muted">${esc(G.tag)}</p>${user ? `<span class="arc-bal">${coins(acct.balance)}</span>` : ''}</div>
        ${id === 'bowl' ? '<section class="card bowl-career-promo" style="padding:20px;margin-bottom:20px"><h2>MFL Football Career</h2><p class="muted">Lead a Metcalf team through a McLean County season. Develop players, build your program, and chase the County Cup.</p><a class="btn" href="/career">Play Franchise / Career →</a></section><style>body.arc-playing .bowl-career-promo{display:none}</style>' : ''}
        <section class="arc-setup card"><form id="arcSetup">
          <div class="arc-modes">${['coins', 'practice'].map((m) => `<label class="mode"><input type="radio" name="mode" value="${m}" ${(m === 'coins' && user) || (m === 'practice' && !user) ? 'checked' : ''} ${m === 'coins' && !user ? 'disabled' : ''}><span>${m === 'coins' ? `${icon('coin')} Play for coins` : `${icon('star')} Practice${id === 'bowl' ? ' / Exhibition' : ''}`}</span></label>`).join('')}</div>
          ${!user ? `<p class="muted sm"><a href="/pickem/login?next=/arcade/${id}">Log in</a> to play for coins. Practice is free.</p>` : ''}
          <div class="lvls">${levels}</div>
          ${id === 'bowl' ? `<div class="bowl-teams" data-practice><label>Your team<select name="team">${teamOpts(user ? 'mine' : teamsIds[0])}</select></label><label>Opponent<select name="opp">${teamOpts(user ? teamsIds[0] : teamsIds[1])}</select></label></div>
            ${user && !lineupOk ? `<p class="muted sm">To play for coins you need a full Starting 8. <a href="/pickem/cards">Set it up →</a></p>` : ''}` : ''}
          <label class="risk" data-coins><input type="checkbox" name="risk" value="1"><span><b>Risk mode</b><small>Pay a third of the prize up front for ${RISK_MULT[0]}× to ${RISK_MULT[3]}× the win.</small></span></label>
          ${user ? `<p class="muted sm" data-coins>${left > 0 ? `${left} paid ${left === 1 ? 'win' : 'wins'} left today.` : 'No paid wins left today: Practice is still open.'} Leaving mid-game counts as a loss.</p>` : ''}
          <button type="submit" class="btn arc-go">${icon('fire')} Play</button><p id="arcMsg" class="err"></p>
        </form></section>
        <section id="arcStage" class="arc-stage" hidden></section>
      </div>
      <script>window.MFL_ARCADE=${JSON.stringify({ game: id })};
      (function(){const f=document.getElementById('arcSetup');const sync=()=>{const p=f.mode&&f.mode.value==='practice';f.querySelectorAll('[data-coins]').forEach(e=>e.hidden=p);f.querySelectorAll('[data-practice]').forEach(e=>e.hidden=!p);if(p&&f.risk)f.risk.checked=false;};f.addEventListener('change',sync);sync();})();</script>${script}`));
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
  // ---------- admin: how each real player looks in Modern Bowl ----------
  const LOOK_OPTS = { skin: [0, 1, 2, 3, 4], height: ['short', 'normal', 'tall'], cleats: ['black', 'white', 'team', 'gold', 'red'] };
  app.get('/admin/looks', h.requireAdmin, (req, res) => {
    const db = load();
    const sel = (name, vals, cur, labels) => `<select name="${name}">${vals.map((v, i) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(labels ? labels[i] : v)}</option>`).join('')}</select>`;
    const rows = Object.values(db.teams).map((t) => `<section class="card"><div class="card-h"><h2>${esc(t.name)}</h2></div><div class="looks">
      ${t.roster.map((p) => { const L = p.look || {}; return `<form method="post" action="/admin/looks/${esc(t.id)}/${esc(p.id)}" class="look" data-color="${esc(t.color)}" data-color2="${esc(t.color2)}">
        <canvas width="10" height="25"></canvas><b>${esc(p.name)}</b>
        <label>Skin ${sel('skin', LOOK_OPTS.skin, L.skin ?? 0, ['Light', 'Fair', 'Tan', 'Brown', 'Dark'])}</label>
        <label>Height ${sel('height', LOOK_OPTS.height, L.height || 'normal', ['Short', 'Normal', 'Tall'])}</label>
        <label>Cleats ${sel('cleats', LOOK_OPTS.cleats, L.cleats || 'black', ['Black', 'White', 'Team color', 'Gold', 'Red'])}</label>
        <label class="chk"><input type="checkbox" name="visor" value="1" ${L.visor ? 'checked' : ''}> Tinted visor</label>
        <label class="chk"><input type="checkbox" name="sleeves" value="1" ${L.sleeves ? 'checked' : ''}> Long sleeves</label>
        <button class="btn sm">Save</button></form>`; }).join('')}</div></section>`).join('');
    res.send(layout(req, 'Game looks', h.pageHead('Admin', 'Modern Bowl looks') + `<div class="wrap">${h.adminNav('/admin/looks')}${req.query.saved ? '<div class="toast">Saved ✓</div>' : ''}
      <p class="muted">Set each player's appearance in Modern Bowl. Changes apply to new games. <a href="/admin/teams">Edit team colors →</a></p>${rows}</div>
      <style>.looks{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.look{display:grid;grid-template-columns:70px 1fr;gap:6px 10px;align-items:center;padding:12px;border-radius:14px;background:var(--card2)}
      .look canvas{grid-row:span 6;width:60px;height:auto;image-rendering:pixelated;background:#4a8f3c;border-radius:10px}.look b{font-size:14px}.look label{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:var(--ink2)}.look select{background:var(--card);color:var(--ink);border:1px solid var(--line2);border-radius:8px;padding:3px}.look .btn{justify-self:start}</style>
      <script>${require('fs').readFileSync(path.join(__dirname, 'public/football/appearance.js'), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>
      <script>document.querySelectorAll('.look').forEach((f)=>{const c=f.querySelector('canvas'),x=c.getContext('2d');x.imageSmoothingEnabled=false;
        const draw=()=>{const look={skin:+f.skin.value,height:f.height.value,cleats:f.cleats.value,visor:f.visor.checked,sleeves:f.sleeves.checked};
          const img=MFLFootballLooks.preview({color:f.dataset.color,color2:f.dataset.color2},look);c.width=img.width;c.height=img.height+1;x.imageSmoothingEnabled=false;x.drawImage(img,0,1);};
        f.addEventListener('change',draw);draw();});</script>`));
  });
  app.post('/admin/looks/:team/:pid', h.requireAdmin, async (req, res) => {
    const db = load(), t = db.teams[req.params.team], p = t && t.roster.find((x) => x.id === req.params.pid);
    if (p) {
      const b = req.body, pick = (v, opts, d) => (opts.map(String).includes(String(v)) ? v : d);
      p.look = { skin: Number(pick(b.skin, LOOK_OPTS.skin, 0)), height: pick(b.height, LOOK_OPTS.height, 'normal'), cleats: pick(b.cleats, LOOK_OPTS.cleats, 'black'), visor: !!b.visor, sleeves: !!b.sleeves };
      await h.save();
    }
    res.redirect('/admin/looks?saved=1#' + encodeURIComponent(req.params.pid));
  });
  app.post('/admin/arcade/void', h.requireAdmin, async (req, res) => {
    const name = String(req.body.u || '');
    const user = await getDoc(userKey(name), { fresh: true });
    const m = user && (user.arcade || []).find((x) => x.id === String(req.body.id || ''));
    if (m && m.status === 'won') { m.status = 'void'; await putDoc(userKey(name), user); }
    res.redirect('/admin/arcade');
  });

  return { GAMES, ORDER, LEVELS, RISK_MULT, POSITIONS, POS_LABEL, arcadeCoins, challengeStatus, today };
};
const ASSET_V = Date.now().toString(36);
module.exports.GAMES = GAMES;
module.exports.POSITIONS = POSITIONS;
module.exports.POS_LABEL = POS_LABEL;
