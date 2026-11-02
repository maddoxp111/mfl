const crypto = require('crypto');
const career = require('./career-engine');
const MAX_SAVES = 5;
function normalize(raw, owner) {
  if (raw?.version === 2 && Array.isArray(raw.saves)) return raw;
  const doc = { version: 2, owner, revision: raw?.revision || 0, selected: null, saves: [] };
  if (raw?.teams) {
    raw.saveId = crypto.randomUUID();
    raw.slot = 1;
    raw.saveName = career.team(raw).name + ' career';
    doc.selected = raw.saveId; doc.saves.push(raw);
  }
  return doc;
}
function settle(doc, client = null) {
  let changed = false;
  for (const state of doc.saves) if (state.pending && (!client || state.pending.client !== client)) {
    career.forfeit(state); changed = true;
  }
  if (changed) doc.revision++;
  return changed;
}
function snapshot(doc) {
  const state = doc.saves.find(s => s.saveId === doc.selected) || null;
  return { revision: doc.revision, selected: state?.saveId || null, maxSaves: MAX_SAVES,
    saves: doc.saves.map(s => {
      const record = career.standings(s).find(t => t.id === s.teamId);
      return { id: s.saveId, slot: s.slot, name: s.saveName, team: career.team(s).name, coach: s.coach, season: s.season,
        week: s.week + 1, complete: s.phase === 'complete', level: career.LEVELS[s.level], titles: s.titles || 0,
        w: record.w, l: record.l, t: record.t, dynamic: !!s.dynamic };
    }), state: state ? { ...career.view(state), revision: doc.revision } : null };
}
function create(doc, teams, body, lineup = null) {
  if (doc.saves.length >= MAX_SAVES) throw new Error('All five save slots are full. Delete a save to start another.');
  const slot = body.slot ? Number(body.slot) : Array.from({ length: MAX_SAVES }, (_, i) => i + 1).find(n => !doc.saves.some(s => s.slot === n));
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SAVES || doc.saves.some(s => s.slot === slot)) throw new Error('That save slot is not empty.');
  const dynamic = body.dynamic === true || body.dynamic === 'on' || body.dynamic === '1';
  if (dynamic && !career.lineupPlayers(lineup)) throw new Error('Dynamic Lineup needs a full Lineup. Set it on the Cards page first.');
  const state = career.start(teams, String(body.team), Number(body.level), body.coach, doc.owner, dynamic ? lineup : null);
  state.saveId = crypto.randomUUID();
  state.slot = slot;
  state.saveName = String(body.saveName || career.team(state).name + ' career').trim().slice(0, 40) || 'MFL career';
  doc.saves.push(state); doc.selected = state.saveId;
  return state;
}
module.exports = { MAX_SAVES, normalize, settle, snapshot, create };
