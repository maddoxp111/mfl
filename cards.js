// MFL Cards: collectible player cards, packs and the "Starting 8" fantasy game.
// Points from cards are the same Points earned in Pick'em, and Points buy packs.
const crypto = require('crypto');
const pk = require('./pickem');

// Rarity sets the card's multiplier and how often it shows up in packs.
const RARITIES = {
  common: { name: 'Base', mult: 1, weight: 6200, sell: 5 },
  rare: { name: 'Silver', mult: 1.25, weight: 2600, sell: 15 },
  epic: { name: 'Gold', mult: 1.5, weight: 900, sell: 40 },
  legendary: { name: 'Legend', mult: 2, weight: 90, sell: 150 },
  mythic: { name: 'Mythic 1/1', mult: 3, weight: 8, sell: 500 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

// Specialist cards score extra on one kind of play.
const SPECIALTIES = {
  td: { name: 'Touchdown Machine', short: 'TD Machine', desc: 'Touchdowns score triple', cats: ['td'] },
  pass: { name: 'Gunslinger', short: 'Gunslinger', desc: 'TD passes score triple', cats: ['pass'] },
  int: { name: 'Interception Specialist', short: 'INT Specialist', desc: 'Interceptions score triple', cats: ['int'] },
  def: { name: 'Pass Rusher', short: 'Pass Rusher', desc: 'Sacks, breakups and flag pulls score triple', cats: ['sack', 'pbu', 'flag'] },
  play: { name: 'Playmaker', short: 'Playmaker', desc: 'Notable catches and plays score triple', cats: ['catch', 'big'] },
};
const SPECIAL_BOOST = 3;

// Every player has these cards. Specialist cards are Gold rarity with a 1.25x base.
const VARIANTS = [
  { id: 'base', rarity: 'common', label: 'Base' },
  { id: 'silver', rarity: 'rare', label: 'Silver' },
  { id: 'gold', rarity: 'epic', label: 'Gold' },
  { id: 'spec', rarity: 'epic', label: 'Specialist', mult: 1.25 },
  { id: 'legend', rarity: 'legendary', label: 'Legend' },
  { id: 'mythic', rarity: 'mythic', label: 'Mythic 1/1' },
];

// Fantasy points for one player in one game.
const SCORING = { td: 6, pass: 4, int: 6, catch: 3, sack: 4, pbu: 2, flag: 1, big: 3, picked: -3, mvp: 3, win: 2 };
const SCORING_LABEL = { td: 'Touchdown', pass: 'TD pass', int: 'Interception', catch: 'Notable catch', sack: 'Sack', pbu: 'Pass breakup', flag: 'Flag pull', big: 'Notable play', picked: 'Threw an INT', mvp: 'Game MVP', win: 'Team win' };
const STAT_CAT = { TD: 'td', INT: 'int', CATCH: 'catch', SACK: 'sack', PBU: 'pbu', FLAG: 'flag', PLAY: 'big' };

const LINEUP_SIZE = 8;
const PACKS = {
  starter: { name: 'Starter Pack', cards: 8, cost: 0, desc: '8 Base cards of different players: a full Starting 8. Free, once.' },
  daily: { name: 'Daily Pack', cards: 1, cost: 0, desc: 'One free card every day.' },
  standard: { name: 'Standard Pack', cards: 3, cost: 100, desc: '3 cards. Any rarity can drop.' },
  premium: { name: 'Premium Pack', cards: 5, cost: 350, desc: '5 cards, with at least one Gold or better guaranteed.' },
  prize: { name: 'Champion Pack', cards: 5, cost: 0, desc: 'Premium pack for the Picker of the Week.' },
};

// Which specialty a player's specialist card gets: their strongest tendency,
// or Pass Rusher / Playmaker for players without a scoring/passing/pick strength.
function specialtyOf(db, t, p) {
  const et = pk.effTend(db);
  const v = { td: et.player(t, p, 'td'), pass: et.player(t, p, 'pass'), int: et.player(t, p, 'int') };
  const [best, bv] = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
  if (bv >= 55) return best;
  return /DEF|RUSH|LB|DB|DL|DE|SAFETY|CORNER/i.test(p.position || '') || v.int >= v.td ? 'def' : 'play';
}

function findPlayer(db, pid) {
  for (const t of Object.values(db.teams)) {
    const p = t.roster.find((x) => x.id === pid);
    if (p) return { t, p };
  }
  return null;
}

// "maddox-pedon:gold" -> everything needed to show and score the card.
function cardInfo(db, id) {
  const [pid, vid] = String(id).split(':');
  const v = VARIANTS.find((x) => x.id === vid);
  const who = findPlayer(db, pid);
  if (!v || !who) return null;
  const R = RARITIES[v.rarity];
  const spec = v.id === 'spec' ? specialtyOf(db, who.t, who.p) : null;
  return { id, pid, variant: v.id, label: spec ? SPECIALTIES[spec].short : v.label, rarity: v.rarity, rarityName: R.name, mult: v.mult || R.mult, spec, t: who.t, p: who.p };
}
function catalog(db) {
  return Object.values(db.teams).flatMap((t) => t.roster.flatMap((p) => VARIANTS.map((v) => cardInfo(db, `${p.id}:${v.id}`)))).filter(Boolean);
}

// ---------- packs ----------
const rint = (n) => crypto.randomInt(n);
function rollRarity(minRarity = 'common') {
  const pool = RARITY_ORDER.slice(RARITY_ORDER.indexOf(minRarity));
  const total = pool.reduce((s, r) => s + RARITIES[r].weight, 0);
  let x = rint(total);
  for (const r of pool) { x -= RARITIES[r].weight; if (x < 0) return r; }
  return pool[0];
}
function rollCard(db, rarity) {
  const options = catalog(db).filter((c) => c.rarity === rarity);
  return options[rint(options.length)].id;
}
function openPack(db, type) {
  const P = PACKS[type];
  if (!P) throw new Error('Unknown pack');
  if (type === 'starter') {
    const players = Object.values(db.teams).flatMap((t) => t.roster.map((p) => p.id));
    for (let i = players.length - 1; i > 0; i--) { const j = rint(i + 1); [players[i], players[j]] = [players[j], players[i]]; }
    return players.slice(0, P.cards).map((pid) => `${pid}:base`);
  }
  const out = [];
  for (let i = 0; i < P.cards; i++) out.push(rollCard(db, rollRarity()));
  if ((type === 'premium' || type === 'prize') && !out.some((id) => RARITY_ORDER.indexOf(cardInfo(db, id).rarity) >= 2)) out[rint(out.length)] = rollCard(db, rollRarity('epic'));
  return out;
}

// What a user owns: every pack card, minus cards they sold.
function collection(user) {
  const own = {};
  for (const pack of user.packs || []) for (const id of pack.cards) own[id] = (own[id] || 0) + 1;
  for (const id of user.sold || []) if (own[id]) own[id]--;
  for (const k of Object.keys(own)) if (!own[k]) delete own[k];
  return own;
}

// ---------- fantasy scoring ----------
const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;
// Raw stat lines for everyone in a game: { "team|pid": { td: 1, pass: 0, ... } }.
function gameLines(db, g, mvpKey) {
  const lines = {};
  const w = g.homeScore > g.awayScore ? g.home : g.awayScore > g.homeScore ? g.away : null;
  for (const tid of [g.home, g.away]) {
    for (const p of db.teams[tid]?.roster || []) {
      if (pk.isOut(g, tid, p.id)) continue;
      const n = p.name.toLowerCase(), L = { td: 0, pass: 0, int: 0, catch: 0, sack: 0, pbu: 0, flag: 0, big: 0, picked: 0, mvp: 0, win: w === tid ? 1 : 0 };
      for (const e of g.events || []) {
        const who = (e.player || '').toLowerCase(), by = (e.passer || '').toLowerCase();
        if (e.team === tid && who === n && STAT_CAT[e.type]) L[STAT_CAT[e.type]]++;
        if (e.type === 'TD' && e.team === tid && by === n) L.pass++;
        if (e.type === 'INT' && e.team !== tid && by === n) L.picked++;
      }
      if (mvpKey === tid + '|' + p.id) L.mvp = 1;
      lines[tid + '|' + p.id] = L;
    }
  }
  return lines;
}
// Points a card earns from one stat line. Rarity multiplies the good stuff; the
// specialist boost applies to its plays; mistakes are never multiplied.
function cardScore(card, line) {
  if (!line) return { pts: 0, played: false, parts: [] };
  const boost = card.spec ? SPECIALTIES[card.spec].cats : [];
  let pts = 0;
  const parts = [];
  for (const [k, n] of Object.entries(line)) {
    if (!n) continue;
    const base = SCORING[k] * n;
    const v = base < 0 ? base : base * card.mult * (boost.includes(k) ? SPECIAL_BOOST : 1);
    pts += v;
    parts.push({ k, n, pts: Math.round(v * 10) / 10 });
  }
  return { pts: Math.round(pts * 10) / 10, played: true, parts };
}

// The lineup a user had in for a game: the last one saved before picks locked.
// Saves carry league-local time ("YYYY-MM-DD HH:MM"), compared like Pick'em locks.
function lineupFor(user, g) {
  if (!g.date) return null;
  const lock = `${g.date} ${pk.lockTime(g)}`;
  const hist = (user.lineups || []).filter((l) => l.local < lock);
  return hist.length ? hist[hist.length - 1].cards : null;
}

// A user's fantasy results for every final game they had a lineup in.
function fantasy(db, user, mvpOf) {
  const games = db.games.filter(isFinal).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const results = [];
  for (const g of games) {
    const ids = lineupFor(user, g);
    if (!ids) continue;
    const m = mvpOf ? mvpOf(g) : null;
    const lines = gameLines(db, g, m);
    const cards = ids.map((id) => cardInfo(db, id)).filter(Boolean).map((c) => ({ c, ...cardScore(c, lines[c.t.id + '|' + c.pid]) }));
    const total = Math.round(cards.reduce((s, x) => s + x.pts, 0));
    results.push({ g, cards, total });
  }
  return { results, total: results.reduce((s, r) => s + r.total, 0) };
}

module.exports = { RARITIES, RARITY_ORDER, SPECIALTIES, SPECIAL_BOOST, VARIANTS, SCORING, SCORING_LABEL, LINEUP_SIZE, PACKS, cardInfo, catalog, openPack, collection, gameLines, cardScore, lineupFor, fantasy, findPlayer };
