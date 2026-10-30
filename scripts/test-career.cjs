const assert = require('node:assert/strict');
const C = require('../career-engine');
const teams = ['pineapples', 'ktcs'].map((id, j) => ({ id, name: id === 'ktcs' ? 'KTCS' : 'Pineapples', abbr: id.slice(0, 3).toUpperCase(), color: '#ffcc00', color2: '#111111', players: C.POSITIONS.map((pos, i) => ({ pos, name: `MFL Player ${j}-${i}`, ovr: 70, spd: 70, thr: 70, acc: 70, cat: 70, str: 70, kick: 70, def: 70, look: { skin: 3, visor: true } })) }));
const fresh = () => C.start(teams, teams[0].id, 0, 'Metcalf Coach', 'career_test');
const state = fresh();
assert.equal(state.teams.length, 12);
assert.equal(state.rounds.length, 11);
const meetings = new Set();
for (const round of state.rounds) {
  assert.equal(new Set(round.games.flatMap(g => [g.home, g.away])).size, 12);
  for (const g of round.games) { const key = [g.home, g.away].sort().join('|'); assert(!meetings.has(key)); meetings.add(key); }
}
assert.equal(meetings.size, 66);
assert.deepEqual(C.team(state).players[0].look, teams[0].players[0].look);
assert.match(C.view(state).story.text, /Thomas Metcalf/);
assert.throws(() => C.watch(state));
const oldSpeed = C.team(state).players[0].spd;
C.manage(state, 'facility', { facility: 'training' });
C.manage(state, 'train', { focus: 'speed' });
assert.equal(C.team(state).players[0].spd, oldSpeed + 2);
assert.throws(() => C.manage(state, 'train', { focus: 'skills' }));
const beforeBudget = state.budget;
C.manage(state, 'choice', { choice: 'study' }); assert.equal(state.budget, beforeBudget + 6);
assert.throws(() => C.manage(state, 'choice', { choice: 'study' }));
const candidate = C.view(state).candidates[0];
C.manage(state, 'recruit', { player: candidate.id });
assert.equal(C.team(state).players[0].name, candidate.name);
assert.equal(C.team(state).reserves.length, 1);
const previousStarter = C.team(state).reserves[0];
C.manage(state, 'activate', { player: previousStarter.id });
assert.equal(C.team(state).players[0].id, previousStarter.id);
assert.equal(C.team(state).reserves[0].id, candidate.id);
assert.throws(() => C.manage(state, 'recruit', { player: candidate.id }));
assert.throws(() => C.manage(state, 'difficulty', { level: -1 }));
const match = structuredClone(C.play(state));
assert.equal(C.play(state).token, match.token);
assert(!('token' in C.view(state).pending));
assert.throws(() => C.manage(state, 'train', { focus: 'skills' }));
assert.throws(() => C.finish(state, { ...match, token: 'wrong', score: 21, opp: 7 }));
assert.throws(() => C.finish(state, { ...match, score: -1, opp: 7 }));
C.finish(state, { ...match, score: 42, opp: 7 });
assert.equal(state.week, 1); assert.equal(C.standings(state).find(t => t.id === state.teamId).w, 1);
assert.throws(() => C.finish(state, { ...match, score: 42, opp: 7 }));
const fromAway = state.rounds.flatMap(r => r.games).find(g => g.id === match.id);
assert.equal(fromAway.home === state.teamId ? fromAway.score : fromAway.opp, 42);
assert.equal(state.pending, null); assert.equal(state.trained, false);
while (state.phase !== 'complete') {
  if (C.currentGame(state)) { const m = C.play(state); C.finish(state, { ...m, score: 42, opp: 7 }); }
  else C.watch(state);
}
assert.equal(state.champion, state.teamId);
assert.equal(state.rounds.length, 13);
assert.equal(state.history[0].w, 11); assert.equal(state.history[0].title, true);
assert.equal(state.titles, 1);
const graduates = C.team(state).players.filter(p => p.grade === 8).map(p => p.id), grade6 = C.team(state).players.find(p => p.grade === 6);
assert.throws(() => C.play(state));
assert.throws(() => C.manage(state, 'train', { focus: 'speed' }));
C.manage(state, 'next-season', {});
assert.equal(state.season, 2); assert.equal(state.week, 0); assert.equal(state.facilities.training, 1);
assert.equal(state.rounds.length, 11); assert(C.team(state).players.every(p => !graduates.includes(p.id)));
assert.equal(C.team(state).players.find(p => p.id === grade6.id).grade, 7);
assert(C.team(state).players.some(p => p.grade === 6 && p.fictional));
assert.equal(C.team(state).reserves[0].grade, 7);
assert.deepEqual(teams[0].players[0].spd, 70); // Source league never changes.
const losing = fresh();
while (losing.phase !== 'complete') {
  const g = C.currentGame(losing);
  if (g) { const m = C.play(losing); C.finish(losing, { ...m, score: 0, opp: 49 }); }
  else C.watch(losing);
}
assert.equal(losing.history[0].l, 11); assert.notEqual(losing.champion, losing.teamId);
const tied = fresh();
for (let i = 0; i < 11; i++) { const m = C.play(tied); C.finish(tied, { ...m, score: 42, opp: 0 }); }
const semi = C.play(tied); C.finish(tied, { ...semi, score: 14, opp: 14 });
assert(tied.rounds[11].games.every(g => g.score !== g.opp));
assert(tied.rounds[11].games.find(g => g.id === semi.id).overtime);
console.log('PASS: 12-team round robin, site roster isolation, training/facilities/tryouts, story limits, pending match tokens, duplicate finishes, undefeated and eliminated seasons, playoff overtime, graduation and next-year continuity');
