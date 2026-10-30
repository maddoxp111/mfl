// MFL's school-season adaptation of the supplied football game's career loop.
// Season and management state lives here; matches use the original game engine.
const crypto = require('crypto');
const POSITIONS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL1', 'UTIL2'];
const LEVELS = ['Rookie', 'Pro', 'All-Pro', 'Legend'];
// School names identify opponents in a fictional MFL county competition.
// Uniform palettes and student rosters are generated for this game.
const SCHOOLS = [
  ['kingsley', 'Kingsley Junior High', 'Normal', 'KJH', '#dc2626', '#ffffff'],
  ['parkside', 'Parkside Junior High', 'Normal', 'PJH', '#183f27', '#facc15'],
  ['chiddix', 'Chiddix Junior High', 'Normal', 'CJH', '#163c86', '#f8fafc'],
  ['evans', 'Evans Junior High', 'Bloomington', 'EJH', '#1d4ed8', '#facc15'],
  ['bloomington', 'Bloomington Junior High', 'Bloomington', 'BJH', '#6b21a8', '#facc15'],
  ['trivalley', 'Tri-Valley Middle School', 'Downs', 'TVM', '#1e3a8a', '#facc15'],
  ['lexington', 'Lexington Junior High', 'Lexington', 'LJH', '#6b21a8', '#facc15'],
  ['leroy', 'LeRoy Junior High', 'LeRoy', 'LRJ', '#173b77', '#facc15'],
  ['heyworth', 'Heyworth Junior High', 'Heyworth', 'HJH', '#a6192e', '#ffffff'],
  ['ridgeview', 'Ridgeview Junior High', 'Colfax', 'RJH', '#163b6c', '#c0c5cc'],
].map(([id, name, city, abbr, color, color2]) => ({ id: 'school-' + id, name, city, abbr, color, color2, school: true }));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function rng(seed) {
  let n = parseInt(crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 8), 16);
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; };
}
function requireThat(ok, message) { if (!ok) throw new Error(message); }
function recruit(seed, pos, grade = 6) {
  const random = rng(seed), first = ['Jordan', 'Casey', 'Avery', 'Riley', 'Morgan', 'Alex', 'Taylor', 'Quinn', 'Cameron', 'Drew', 'Parker', 'Sam'];
  const last = ['Carter', 'Brooks', 'Reed', 'Hayes', 'Bennett', 'Ellis', 'Lane', 'Perry', 'Wells', 'Cole', 'Reese', 'Bell'];
  const base = 51 + Math.floor(random() * 19) + (grade - 6) * 4;
  const p = { id: seed, pos, name: first[Math.floor(random() * first.length)] + ' ' + last[Math.floor(random() * last.length)],
    num: String(1 + Math.floor(random() * 89)), grade, condition: 100, morale: 75, fictional: true,
    look: { skin: Math.floor(random() * 5), height: ['short', 'normal', 'tall'][Math.floor(random() * 3)], cleats: 'team', visor: false, sleeves: false } };
  for (const stat of ['spd', 'thr', 'acc', 'cat', 'str', 'kick', 'def']) p[stat] = clamp(base + Math.floor(random() * 15) - 7, 40, 92);
  p.ovr = base;
  return p;
}
function schedule(teams, season) {
  const ring = teams.map(t => t.id), rounds = [];
  if (ring.length % 2) ring.push(null);
  for (let r = 0; r < ring.length - 1; r++) {
    const games = [];
    for (let i = 0; i < ring.length / 2; i++) {
      let a = ring[i], b = ring[ring.length - 1 - i];
      if (!a || !b) continue;
      if ((r + i) % 2) [a, b] = [b, a];
      games.push({ id: `s${season}-w${r + 1}-${i}`, home: a, away: b, score: null, opp: null });
    }
    rounds.push({ label: `Week ${r + 1}`, kind: 'regular', games });
    ring.splice(1, 0, ring.pop());
  }
  return rounds;
}
function standings(state) {
  const rows = new Map(state.teams.map(t => [t.id, { id: t.id, name: t.name, abbr: t.abbr, w: 0, l: 0, t: 0, pf: 0, pa: 0 }]));
  for (const round of state.rounds.filter(r => r.kind === 'regular')) for (const g of round.games) {
    if (g.score === null) continue;
    const a = rows.get(g.home), b = rows.get(g.away);
    a.pf += g.score; a.pa += g.opp; b.pf += g.opp; b.pa += g.score;
    if (g.score > g.opp) { a.w++; b.l++; } else if (g.score < g.opp) { b.w++; a.l++; } else { a.t++; b.t++; }
  }
  return [...rows.values()].sort((a, b) => (b.w * 2 + b.t) - (a.w * 2 + a.t) || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.id.localeCompare(b.id));
}
function log(state, title, text) {
  state.news.unshift({ season: state.season, week: state.week, title, text });
  state.news = state.news.slice(0, 50);
}
function team(state) { return state.teams.find(t => t.id === state.teamId); }
function currentGame(state) { return state.rounds[state.week]?.games.find(g => g.home === state.teamId || g.away === state.teamId) || null; }
function opponent(state, game = currentGame(state)) { return game && state.teams.find(t => t.id === (game.home === state.teamId ? game.away : game.home)); }
function candidates(state) {
  return POSITIONS.map(pos => recruit(`${state.seed}-s${state.season}-w${state.week}-tryout-${pos}`, pos));
}
function story(state) {
  const ours = team(state), other = opponent(state), round = state.rounds[state.week];
  if (state.phase === 'complete') return { title: state.champion === state.teamId ? 'The county comes home to Metcalf' : 'One school year ends. A new one begins.',
    text: state.champion === state.teamId ? `${ours.name} brought the McLean County Cup back to Thomas Metcalf. Next year, a new sixth-grade class will try to carry that legacy.` : `The ${state.teams.find(t => t.id === state.champion)?.name || 'county'} program won the McLean County Cup. Celebrate your eighth graders and prepare the next Metcalf team.`, choices: [] };
  if (!other) return { title: 'Watch the county playoffs', text: 'Your season on the field is over. Follow the remaining bracket, then welcome the next class.', choices: [] };
  const rival = other.site;
  const choices = [{ id: 'spirit', label: 'Lead a pep rally', detail: '+8 team morale' }, { id: 'study', label: 'Team study hall', detail: '+6 program credits' }];
  if (round.kind !== 'regular') return { title: `${round.label}: carry Metcalf with you`, text: `${other.name} stand between ${ours.name} and the next chapter. The gym is buzzing and the whole school is behind you.`, choices };
  if (rival) return { title: 'The Metcalf rivalry', text: `${ours.name} and ${other.name} know each other from the same hallways. This week, the school rivalry becomes a county-league matchup. Make the play everyone will talk about at lunch.`, choices };
  const record = standings(state).find(t => t.id === state.teamId);
  if (state.week === 0) return { title: 'From the playground to the county', text: `You have been asked to lead ${ours.name} at Thomas Metcalf School. The MFL — Metcalf Football League — is taking on middle-school programs across McLean County. First up: ${other.name} from ${other.city}. Build a program your classmates can be proud of.`, choices };
  return { title: record.w > record.l ? 'Word is getting around the county' : 'The next practice matters',
    text: `${ours.name} are ${record.w}-${record.l}${record.t ? '-' + record.t : ''}. This week brings ${other.name} from ${other.city}. ${record.w > record.l ? 'Keep the momentum without forgetting the fundamentals.' : 'A tough week does not decide a school year. Bring the group together and get ready for the next kickoff.'}`, choices };
}
function start(siteTeams, teamId, level, coach, owner) {
  requireThat(siteTeams.some(t => t.id === teamId), 'Choose one of the two MFL teams.');
  requireThat(Number.isInteger(level) && level >= 0 && level <= 3, 'Choose a difficulty.');
  const seed = crypto.randomBytes(8).toString('hex');
  const teams = siteTeams.map(t => ({ ...structuredClone(t), site: true, reserves: [], city: 'Thomas Metcalf School',
    players: POSITIONS.map((pos, i) => {
      const p = t.players.find(p => p.pos === pos);
      return p ? { ...structuredClone(p), id: `${t.id}-${pos}`, grade: 6 + i % 3, condition: 100, morale: 75 } : recruit(`${seed}-${t.id}-${pos}`, pos, 6 + i % 3);
    }) }));
  for (const school of SCHOOLS) teams.push({ ...school, players: POSITIONS.map((pos, i) => recruit(`${seed}-${school.id}-${pos}`, pos, 6 + i % 3)) });
  const state = { version: 1, owner, revision: 0, seed, teamId, coach: String(coach || 'Coach').trim().slice(0, 32) || 'Coach', level,
    season: 1, week: 0, phase: 'season', titles: 0, budget: 40, facilities: { training: 0, recovery: 0 },
    trained: false, choice: null, recruited: false, teams, rounds: schedule(teams, 1), pending: null, history: [], news: [] };
  log(state, 'A new MFL chapter', `${state.coach} takes charge of ${team(state).name}. The road from Thomas Metcalf to the McLean County Cup starts here.`);
  return state;
}
function manage(state, action, body) {
  requireThat(!state.pending, 'Finish or forfeit your current matchup before changing the program.');
  requireThat(state.phase !== 'complete' || action === 'next-season', 'Start the next school year first.');
  if (action === 'train') {
    requireThat(currentGame(state) && !state.trained, 'You can train once before each matchup.');
    requireThat(['speed', 'skills', 'recovery'].includes(body.focus), 'Choose a training focus.');
    for (const p of team(state).players) {
      if (body.focus === 'recovery') p.condition = clamp(p.condition + 20 + state.facilities.recovery * 5, 0, 100);
      else {
        const stats = body.focus === 'speed' ? ['spd'] : p.pos === 'QB' ? ['thr', 'acc'] : p.pos === 'UTIL2' ? ['kick'] : ['cat', 'str'];
        for (const stat of stats) p[stat] = clamp(p[stat] + 1 + state.facilities.training, 30, 99);
        p.ovr = clamp(p.ovr + 1, 30, 99); p.condition = clamp(p.condition - 6, 30, 100);
      }
    }
    state.trained = true;
    log(state, 'After-school practice', body.focus === 'recovery' ? 'A lighter practice helps the group recover for game day.' : `The team put in extra ${body.focus === 'speed' ? 'footwork and speed' : 'position skills'} work after class.`);
  } else if (action === 'choice') {
    const choice = story(state).choices.find(c => c.id === body.choice);
    requireThat(!state.choice && choice, 'Choose one story action per matchup.');
    if (choice.id === 'spirit') for (const p of team(state).players) p.morale = clamp(p.morale + 8, 0, 100);
    else state.budget += 6;
    state.choice = choice.id; log(state, choice.label, choice.id === 'spirit' ? 'The Metcalf pep rally gave the whole roster a lift.' : 'The team put schoolwork first. Community support added 6 program credits.');
  } else if (action === 'facility') {
    requireThat(['training', 'recovery'].includes(body.facility), 'Choose a facility.');
    const cost = 25 + state.facilities[body.facility] * 15;
    requireThat(state.facilities[body.facility] < 3 && state.budget >= cost, `This upgrade needs ${cost} program credits (maximum level 3).`);
    state.budget -= cost; state.facilities[body.facility]++;
    log(state, 'Building the program', `${body.facility === 'training' ? 'Practice equipment' : 'Recovery space'} improved to level ${state.facilities[body.facility]}.`);
  } else if (action === 'recruit') {
    requireThat(currentGame(state) && !state.recruited, 'You can welcome one tryout player per matchup.');
    const p = candidates(state).find(p => p.id === body.player);
    requireThat(p && state.budget >= 12, 'A tryout player needs 12 program credits.');
    const ours = team(state), index = ours.players.findIndex(x => x.pos === p.pos), previous = ours.players[index];
    (ours.reserves ||= []).push(previous);
    ours.players[index] = p; state.budget -= 12; state.recruited = true;
    log(state, 'A new face at practice', `${p.name} joins the ${p.pos} spot. ${previous.name} moves to the practice squad for this career.`);
  } else if (action === 'activate') {
    const ours = team(state), reserves = ours.reserves || [];
    const i = reserves.findIndex(p => p.id === body.player);
    requireThat(i >= 0, 'Choose a player from your practice squad.');
    const p = reserves[i], starter = ours.players.findIndex(x => x.pos === p.pos);
    reserves[i] = ours.players[starter]; ours.players[starter] = p;
    log(state, 'Lineup change', `${p.name} returns to the starting ${p.pos} spot for ${ours.name}.`);
  } else if (action === 'difficulty') {
    const level = Number(body.level);
    requireThat(Number.isInteger(level) && level >= 0 && level <= 3, 'Choose a difficulty.'); state.level = level;
  } else if (action === 'next-season') {
    requireThat(state.phase === 'complete', 'Finish the current school year first.');
    const graduates = [...team(state).players, ...(team(state).reserves || [])].filter(p => p.grade === 8).map(p => p.name);
    state.season++; state.week = 0; state.phase = 'season'; state.champion = null;
    for (const t of state.teams) {
      t.players = t.players.map(p => p.grade === 8 ? recruit(`${state.seed}-s${state.season}-${t.id}-${p.pos}`, p.pos) : { ...p, grade: p.grade + 1, condition: 100, morale: 80 });
      t.reserves = (t.reserves || []).filter(p => p.grade !== 8).map(p => ({ ...p, grade: p.grade + 1, condition: 100, morale: 80 }));
    }
    state.rounds = schedule(state.teams, state.season); state.budget += 25; state.trained = false; state.choice = null; state.recruited = false;
    log(state, 'Welcome the next class', `${graduates.join(', ')} graduate from this career roster. New sixth graders join the program, while returning students carry the story forward.`);
  } else throw new Error('Unknown career action.');
}
function play(state) {
  requireThat(state.phase !== 'complete' && currentGame(state), 'There is no matchup to play.');
  if (!state.pending) {
    const fit = p => { const copy = structuredClone(p), factor = (.85 + p.condition * .0015) * (.95 + p.morale * .0005); for (const stat of ['spd', 'thr', 'acc', 'cat', 'str', 'kick', 'def']) copy[stat] = Math.round(p[stat] * factor); return copy; };
    state.pending = { id: currentGame(state).id, token: crypto.randomBytes(16).toString('hex'), level: state.level,
      seed: `${state.seed}-${currentGame(state).id}`, data: { mode: 'career', home: { ...team(state), players: team(state).players.map(fit) }, away: structuredClone(opponent(state)) } };
  }
  return state.pending;
}
function strength(t) { return t.players.reduce((sum, p) => sum + p.ovr, 0) / t.players.length; }
function simulate(state, g) {
  const random = rng(state.seed + '-' + g.id), a = state.teams.find(t => t.id === g.home), b = state.teams.find(t => t.id === g.away);
  const score = t => Math.max(0, Math.round((strength(t) / 16 + random() * 4 - 2.5))) * 7 + (random() < .25 ? 3 : 0);
  g.score = score(a); g.opp = score(b);
}
function advance(state) {
  const round = state.rounds[state.week];
  for (const g of round.games) {
    if (g.score === null) simulate(state, g);
    if (round.kind !== 'regular' && g.score === g.opp) {
      // The native game normally resolves overtime. If it ends tied, resolve a
      // final overtime possession so the school playoff bracket can advance.
      if (rng(state.seed + g.id + '-ot')() < .5) g.score += 3; else g.opp += 3;
      g.overtime = true;
    }
  }
  if (round === state.rounds.at(-1)) {
    if (round.kind === 'regular') {
      const seeds = standings(state).slice(0, 4).map(t => t.id);
      state.rounds.push({ label: 'County semifinals', kind: 'semifinal', games: [[seeds[0], seeds[3]], [seeds[1], seeds[2]]].map(([home, away], i) => ({ id: `s${state.season}-semi-${i}`, home, away, score: null, opp: null })) });
      log(state, 'The county bracket is set', seeds.includes(state.teamId) ? 'Metcalf is in the final four. Two wins will bring home the McLean County Cup.' : 'The county final four is set. Your team missed the cut this year; follow the bracket and prepare next year’s program.');
    } else if (round.kind === 'semifinal') {
      const winners = round.games.map(g => g.score > g.opp ? g.home : g.away);
      state.rounds.push({ label: 'McLean County Cup', kind: 'final', games: [{ id: `s${state.season}-final`, home: winners[0], away: winners[1], score: null, opp: null }] });
    } else {
      const g = round.games[0]; state.champion = g.score > g.opp ? g.home : g.away; state.phase = 'complete';
      const record = standings(state).find(t => t.id === state.teamId);
      state.history.unshift({ season: state.season, ...record, champion: state.teams.find(t => t.id === state.champion).name, title: state.champion === state.teamId });
      state.history = state.history.slice(0, 30);
      if (state.champion === state.teamId) { state.budget += 30; state.titles = (state.titles || 0) + 1; }
      log(state, 'McLean County Cup champions', `${state.teams.find(t => t.id === state.champion).name} finish the school year as county champions.`);
    }
  }
  if (state.phase !== 'complete') state.week++;
  state.pending = null; state.trained = false; state.choice = null; state.recruited = false;
}
function finish(state, body) {
  requireThat(state.pending && body.token === state.pending.token && body.id === state.pending.id, 'That matchup has already ended or is not your active game.');
  const score = body.score, opp = body.opp;
  requireThat([score, opp].every(n => Number.isInteger(n) && n >= 0 && n <= 150), 'The final score is invalid.');
  const g = currentGame(state), home = g.home === state.teamId;
  g.score = home ? score : opp; g.opp = home ? opp : score;
  g.stats = { td: clamp(Math.floor(Number(body.stats?.td) || 0), 0, 30), pass: clamp(Math.floor(Number(body.stats?.pass) || 0), 0, 2000), rush: clamp(Math.floor(Number(body.stats?.rush) || 0), 0, 2000) };
  const ours = team(state), other = opponent(state), result = score > opp ? 'win' : score < opp ? 'loss' : 'tie';
  state.budget += result === 'win' ? 12 : 7;
  for (const p of ours.players) {
    p.condition = clamp(p.condition - 12 + 7 + state.facilities.recovery * 3, 30, 100);
    p.morale = clamp(p.morale + (result === 'win' ? 5 : result === 'loss' ? -3 : 1), 20, 100);
  }
  log(state, `${ours.abbr} ${score} – ${opp} ${other.abbr}`, `${state.rounds[state.week].label}: ${result === 'win' ? 'A win for' : result === 'loss' ? 'A tough loss for' : 'A tied game for'} ${ours.name}. Back to class, then back to practice.`);
  advance(state);
}
function watch(state) {
  requireThat(!state.pending && state.phase !== 'complete' && !currentGame(state), 'Play your own matchup before advancing the week.');
  advance(state);
}
function view(state) {
  if (!state) return null;
  const copy = structuredClone(state);
  copy.pending = state.pending ? { id: state.pending.id } : null;
  delete copy.seed; delete copy.owner;
  return { ...copy, standings: standings(state), story: story(state), candidates: candidates(state), levelName: LEVELS[state.level] };
}
module.exports = { LEVELS, SCHOOLS, POSITIONS, start, manage, play, finish, watch, view, standings, currentGame, team, opponent };
