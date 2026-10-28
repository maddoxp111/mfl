// Survivor pool: each game, everyone still alive picks one player who has to score a
// touchdown. Miss and you're out; you can't use the same player twice in a round. The
// last one standing wins the round (and Points), then a new round starts next game.
// Everything is worked out live from the picks and the box scores, so fixing a box
// score or marking a player out re-settles it automatically.
const pk = require('./pickem');

const PRIZE = 250; // Points for winning a round
const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;

function scored(db, g, team, pid) {
  const p = db.teams[team]?.roster.find((x) => x.id === pid);
  if (!p) return false;
  return (g.events || []).some((e) => e.type === 'TD' && e.team === team && (e.player || '').toLowerCase() === p.name.toLowerCase());
}
const teamOf = (db, pid) => Object.values(db.teams).find((t) => t.roster.some((p) => p.id === pid))?.id;

function survivorState(db, users, tz) {
  const now = pk.nowLocal(tz);
  const games = db.games.filter((g) => g.date && g.status !== 'postponed').sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const startId = db.survivor?.start;
  let i = Math.max(0, games.findIndex((g) => g.id === startId));
  if (!startId) i = games.findIndex((g) => g.status === 'scheduled' && now < `${g.date} ${pk.lockTime(g)}`);
  const finished = [];
  let n = 1;
  let cur = null;
  while (i >= 0 && i < games.length) {
    const r = n;
    const entry = (u) => u.survivor?.[r];
    let alive = null, startGame = null;
    const history = [];
    for (; i < games.length; i++) {
      const g = games[i], lock = `${g.date} ${pk.lockTime(g)}`;
      if (!alive) {
        // The round starts at the first game that locks with 2+ entries.
        const entrants = users.filter((u) => entry(u)?.joined && entry(u).joined < lock);
        if (now < lock || entrants.length < 2) {
          if (now < lock) { cur = { n: r, active: false, entrants: users.filter((u) => entry(u)?.joined).map((u) => u.name), alive: [], pickGame: g, history }; break; }
          continue;
        }
        alive = new Set(entrants.map((u) => u.name));
        startGame = g;
      }
      if (now < lock) { cur = { n: r, active: true, alive: [...alive], startGame, pickGame: g, history }; break; }
      if (!isFinal(g)) { cur = { n: r, active: true, alive: [...alive], startGame, pickGame: null, waiting: g, history }; break; }
      const results = {};
      for (const name of alive) {
        const u = users.find((x) => x.name === name);
        const pid = entry(u)?.picks?.[g.id];
        const team = pid && teamOf(db, pid);
        results[name] = !pid ? { pid: null, res: 'nopick' } : team && pk.isOut(g, team, pid) ? { pid, res: 'out' } : team && scored(db, g, team, pid) ? { pid, res: 'safe' } : { pid, res: 'miss' };
      }
      const missed = Object.keys(results).filter((k) => results[k].res === 'miss' || results[k].res === 'nopick');
      const allMissed = missed.length === alive.size;
      if (!allMissed) for (const k of missed) alive.delete(k);
      history.push({ g, results, allMissed });
      if (alive.size <= 1) {
        finished.push({ n: r, winner: [...alive][0] || null, startGame, endGame: g, history });
        i++;
        alive = null;
        break;
      }
    }
    if (!cur && alive) cur = { n: r, active: true, alive: [...alive], startGame, pickGame: null, history }; // ran out of scheduled games
    if (cur || i >= games.length) break;
    n++;
  }
  if (!cur) cur = { n, active: false, entrants: [], alive: [], pickGame: null, history: [] };
  return { round: cur, finished, prize: PRIZE };
}

// Points a user has won from Survivor.
const survivorPoints = (state, name) => state.finished.filter((f) => f.winner === name).length * PRIZE;

module.exports = { PRIZE, survivorState, survivorPoints, scored, teamOf };
