// MFL Cards: collectible player cards, packs and the "Starting 8" fantasy game.
// Starting 8 fantasy points pay out as Pick'em coins, and coins buy packs.
const crypto = require('crypto');
const pk = require('./pickem');

// Rarity sets how often a card shows up in packs (and what it sells for).
const RARITIES = {
  common: { name: 'Base', mult: 1, weight: 6200, sell: 5 },
  rare: { name: 'Silver', mult: 1.25, weight: 2600, sell: 15 },
  epic: { name: 'Gold', mult: 1.5, weight: 900, sell: 40 },
  legendary: { name: 'Legend', mult: 2, weight: 90, sell: 150 },
  mythic: { name: 'Mythic', mult: 3, weight: 8, sell: 500 },
  dark: { name: 'Dark Matter', mult: 4, weight: 2, sell: 1500 },
  // Never rolled by weight: see DOH_ODDS.
  doh: { name: 'Big Doh Mi', mult: 101, weight: 0, sell: 10000 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'dark', 'doh'];
// Big Doh Mi: a 1 in 100,000 (0.001%) shot on every card pulled.
const DOH_ODDS = 100000;

// Specialist cards score extra on one kind of play.
const SPECIALTIES = {
  td: { name: 'Touchdown Machine', short: 'TD Machine', desc: 'Touchdowns score triple', cats: ['td'] },
  pass: { name: 'Gunslinger', short: 'Gunslinger', desc: 'TD passes score triple', cats: ['pass'] },
  int: { name: 'Interception Specialist', short: 'INT Specialist', desc: 'Interceptions score triple', cats: ['int'] },
  def: { name: 'Pass Rusher', short: 'Pass Rusher', desc: 'Sacks, breakups and flag pulls score triple', cats: ['sack', 'pbu', 'flag'] },
  play: { name: 'Playmaker', short: 'Playmaker', desc: 'Notable catches and plays score triple', cats: ['catch', 'big'] },
  clutch: { name: 'Clutch', short: 'Clutch', desc: 'Team wins and MVPs score triple', cats: ['win', 'mvp'] },
};
const SPECIAL_BOOST = 3;
const SPEC_KEYS = ['td', 'pass', 'int', 'def', 'play'];

// Every player has all of these cards. `spec: 'own'` is the player's signature
// specialty; `spec: 'td'` etc. are the specialist cards found in themed packs.
const VARIANTS = [
  { id: 'base', rarity: 'common', label: 'Base' },
  { id: 'team', rarity: 'common', label: 'Team Colors', mult: 1.1 },
  { id: 'silver', rarity: 'rare', label: 'Silver' },
  { id: 'action', rarity: 'rare', label: 'Action Shot', mult: 1.3 },
  ...SPEC_KEYS.map((k) => ({ id: 'spec-' + k, rarity: 'rare', label: SPECIALTIES[k].short, mult: 1.1, spec: k })),
  { id: 'gold', rarity: 'epic', label: 'Gold' },
  { id: 'holo', rarity: 'epic', label: 'Holo', mult: 1.6 },
  { id: 'spec', rarity: 'epic', label: 'Signature', mult: 1.25, spec: 'own' },
  { id: 'legend', rarity: 'legendary', label: 'Legend' },
  { id: 'allstar', rarity: 'legendary', label: 'All-Star', mult: 2.25 },
  { id: 'clutch', rarity: 'legendary', label: 'Clutch', mult: 1.75, spec: 'clutch' },
  { id: 'icon', rarity: 'mythic', label: 'Icon', mult: 2.5 },
  // The fun ones. `flat` = bonus points every game they play (never multiplied).
  { id: 'bench', rarity: 'common', label: 'Benchwarmer', mult: 0.8, flat: 4, quote: 'Happy to be here.' },
  { id: 'trophy', rarity: 'common', label: 'Participation Trophy', mult: 1, flat: 3, quote: 'Everybody wins!' },
  { id: 'pizza', rarity: 'common', label: 'Pizza Friday', mult: 1.1, quote: 'Fueled by cafeteria pizza.' },
  { id: 'cutout', rarity: 'common', label: 'Cardboard Cutout', mult: 1.05, quote: 'Surprisingly solid.' },
  { id: 'bobble', rarity: 'rare', label: 'Bobblehead', mult: 1.2, quote: 'Nods at every play.' },
  { id: 'pixel', rarity: 'rare', label: '8-Bit', mult: 1.3, quote: 'Extra good in Modern Bowl.' },
  { id: 'snow', rarity: 'rare', label: 'Snow Day', mult: 1.25, quote: 'School is cancelled. Football is not.' },
  { id: 'upside', rarity: 'rare', label: 'Upside Down', mult: 1.25, quote: 'Printed wrong. Worth more.' },
  { id: 'duck', rarity: 'epic', label: 'Rubber Ducky', mult: 1, flat: 15, quote: 'Squeak.' },
  { id: 'built', rarity: 'epic', label: 'Built Different', mult: 1.7, quote: 'Not like the others.' },
  { id: 'throwback', rarity: 'epic', label: 'Throwback', mult: 1.55, quote: 'Back in my day…' },
  { id: 'spooky', rarity: 'epic', label: 'Spooky', mult: 1.5, quote: 'Halloween Bowl edition.' },
  { id: 'glitch', rarity: 'legendary', label: 'Glitch', mult: 2.1, quote: 'ERR0R: T00 G00D' },
  { id: 'goat', rarity: 'mythic', label: 'The GOAT 1/1', mult: 3.5, one: true, quote: 'Greatest of all time.' },
  { id: 'mythic', rarity: 'mythic', label: 'Mythic 1/1', one: true },
  { id: 'dark', rarity: 'dark', label: 'Dark Matter 1/1', one: true },
  // Dom only. 101x = every point he scores comes with 100 extra.
  { id: 'doh', rarity: 'doh', label: 'Big Doh Mi', mult: 101, rating: 99, only: 'dom-chiodo', quote: 'Every point he scores: +100 more.' },
];

// Fantasy points for one player in one game.
const SCORING = { td: 10, pass: 7, int: 6, catch: 3, sack: 4, pbu: 2, flag: 1, big: 3, picked: -5, mvp: 3, win: 2 };
const SCORING_LABEL = { flat: 'Card bonus', td: 'Touchdown catch or run', pass: 'TD pass', int: 'Interception', catch: 'Notable catch', sack: 'Sack', pbu: 'Pass breakup', flag: 'Flag pull', big: 'Notable play', picked: 'Threw an INT', mvp: 'Game MVP', win: 'Team win' };
const STAT_CAT = { TD: 'td', INT: 'int', CATCH: 'catch', SACK: 'sack', PBU: 'pbu', FLAG: 'flag', PLAY: 'big' };

const LINEUP_SIZE = 8;
const isSpec = (...ks) => (c) => !!c.spec && ks.includes(c.spec);
// Pack types. `pool` limits which cards can drop, `min` guarantees one card of at
// least that rarity, `boost` multiplies rarity weights, `free` packs are claimed.
const PACKS = {
  starter: { name: 'Starter Pack', cards: 8, cost: 0, free: 'once', group: 'free', desc: '8 Base cards of different players: a full Starting 8. Free, once.' },
  daily: { name: 'Daily Pack', cards: 1, cost: 0, free: 'daily', group: 'free', desc: 'One free card every day.' },
  gameday: { name: 'Game Day Pack', cards: 2, cost: 0, free: 'gameday', group: 'free', desc: 'Free on every day there\'s an MFL game.' },
  weekly: { name: 'Weekly Pack', cards: 3, cost: 0, free: 'weekly', group: 'free', min: 'rare', desc: '3 cards free every week, Silver or better guaranteed.' },
  prize: { name: 'Champion Pack', cards: 5, cost: 0, free: 'prize', group: 'free', min: 'epic', desc: 'Premium pack for the Picker of the Week.' },
  arcade: { name: 'Arcade Champ Pack', cards: 3, cost: 0, free: 'arcade', group: 'free', min: 'epic', desc: 'Win 3 Arcade games in a day to unlock it.' },
  milestone: { name: 'Collector Pack', cards: 4, cost: 0, free: 'milestone', group: 'free', min: 'epic', desc: 'Reward for collecting more different cards.' },
  standard: { name: 'Standard Pack', cards: 3, cost: 100, group: 'core', desc: '3 cards. Any rarity can drop.' },
  value: { name: 'Value Pack', cards: 6, cost: 180, group: 'core', desc: '6 cards for the price of 5.' },
  premium: { name: 'Premium Pack', cards: 5, cost: 350, group: 'core', min: 'epic', desc: '5 cards, with at least one Gold or better guaranteed.' },
  mega: { name: 'Mega Pack', cards: 12, cost: 800, group: 'core', min: 'epic', mins: 2, desc: '12 cards with two Gold or better guaranteed.' },
  offense: { name: 'Offense Pack', cards: 3, cost: 160, group: 'theme', pool: isSpec('td', 'pass', 'play'), desc: 'Only Touchdown Machine, Gunslinger and Playmaker cards.' },
  defense: { name: 'Defense Pack', cards: 3, cost: 160, group: 'theme', pool: isSpec('int', 'def'), desc: 'Only Interception Specialist and Pass Rusher cards.' },
  specialist: { name: 'Specialist Pack', cards: 4, cost: 260, group: 'theme', pool: (c) => !!c.spec, min: 'epic', desc: '4 specialist cards with a Signature or better guaranteed.' },
  shine: { name: 'Shine Pack', cards: 3, cost: 300, group: 'theme', pool: (c) => ['action', 'holo', 'allstar', 'icon', 'dark'].includes(c.variant), desc: 'Only Action Shot, Holo, All-Star, Icon and Dark Matter cards.' },
  leaders: { name: 'Captains Pack', cards: 3, cost: 200, group: 'theme', pool: (c) => ['C', 'TR'].includes(c.p.tag), desc: 'Only captains and team reps.' },
  draft: { name: 'Draft Class Pack', cards: 3, cost: 120, group: 'theme', pool: (c) => /^Rd/.test(c.p.tag || ''), desc: 'Only drafted players, any round.' },
  sleeper: { name: 'Sleeper Pack', cards: 4, cost: 110, group: 'theme', pool: (c) => c.p.tag === 'FA' || /Rd [3-9]/.test(c.p.tag || ''), desc: 'Free agents and late-round picks. Cheap, and sneaky good.' },
  lunch: { name: 'Lunch Money Pack', cards: 2, cost: 60, group: 'core', desc: '2 cards for your lunch money.' },
  mystery: { name: 'Mystery Box', cards: 4, cost: 260, group: 'core', mystery: [1, 9], desc: 'Could be 1 card. Could be 9. Nobody knows.' },
  meme: { name: 'Meme Pack', cards: 3, cost: 180, group: 'fun', pool: (c) => ['bench', 'trophy', 'pizza', 'cutout', 'bobble', 'upside', 'duck', 'built'].includes(c.variant), desc: 'Benchwarmers, trophies, rubber duckies and other weird ones.' },
  bitpack: { name: '8-Bit Pack', cards: 3, cost: 240, group: 'fun', pool: (c) => ['pixel', 'throwback', 'glitch'].includes(c.variant), desc: '8-Bit, Throwback and Glitch cards. Built for Modern Bowl.' },
  spooky: { name: 'Spooky Pack', cards: 3, cost: 260, group: 'fun', pool: (c) => ['spooky', 'glitch', 'snow'].includes(c.variant), min: 'epic', desc: 'Spooky cards, with a Gold or better guaranteed.' },
  cafeteria: { name: 'Cafeteria Pack', cards: 4, cost: 120, group: 'fun', pool: (c) => ['pizza', 'trophy', 'bench', 'cutout', 'base', 'team'].includes(c.variant), desc: 'Pizza Friday and friends. Cheap and cheerful.' },
  bobble: { name: 'Bobblehead Box', cards: 2, cost: 200, group: 'fun', pool: (c) => c.variant === 'bobble', desc: 'Two bobbleheads. Nod nod.' },
  snowday: { name: 'Snow Day Pack', cards: 3, cost: 200, group: 'fun', pool: (c) => ['snow', 'upside', 'throwback'].includes(c.variant), desc: 'Snow Day, Upside Down and Throwback cards.' },
  goat: { name: 'GOAT Hunt', cards: 1, cost: 2500, group: 'chase', boost: { common: 0, rare: 0, epic: 0, legendary: 1, mythic: 2 }, pool: (c) => ['goat', 'glitch', 'icon', 'mythic', 'allstar', 'legend'].includes(c.variant), desc: 'One Legend-or-better card with a real shot at The GOAT 1/1.' },
  elite: { name: 'Elite Pack', cards: 3, cost: 1500, group: 'chase', min: 'legendary', desc: '3 cards with a Legend or better guaranteed.' },
  hunt: { name: 'Mythic Hunt', cards: 1, cost: 900, group: 'chase', boost: { common: 0, rare: 0, mythic: 15, dark: 15 }, desc: 'One Gold-or-better card with 15× the usual Mythic and Dark Matter drop rate.' },
  void: { name: 'Dark Matter Pack', cards: 1, cost: 4000, group: 'chase', boost: { common: 0, rare: 0, epic: 0, legendary: 1, mythic: 6, dark: 30 }, desc: 'One Legend or better. About a 1 in 3 shot at Dark Matter.' },
};
// One pack per team: only that team's cards.
const TEAM_PACK = { cards: 3, cost: 140, group: 'team' };
const COLLECTOR_STEPS = [10, 25, 50, 100, 150, 200, 250, 300];
function packInfo(db, type) {
  if (PACKS[type]) return PACKS[type];
  const m = /^team-(.+)$/.exec(type || '');
  const t = m && db.teams[m[1]];
  return t ? { ...TEAM_PACK, name: `${`${t.city} ${t.name}`.trim()} Pack`, team: t.id, pool: (c) => c.t.id === t.id, desc: `3 cards, all ${t.name} players.` } : null;
}
function packTypes(db) {
  return [...Object.keys(PACKS), ...Object.keys(db.teams).map((id) => 'team-' + id)];
}

// Which specialty a player's Signature card gets: their strongest tendency,
// or Pass Rusher / Playmaker for players without a scoring/passing/pick strength.
function specialtyOf(et, t, p) {
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

function makeCard(et, t, p, v) {
  const R = RARITIES[v.rarity];
  const spec = v.spec === 'own' ? specialtyOf(et, t, p) : v.spec || null;
  const label = v.spec === 'own' ? `Signature ${SPECIALTIES[spec].short}` : v.label;
  return { id: `${p.id}:${v.id}`, pid: p.id, variant: v.id, label, rarity: v.rarity, rarityName: R.name, mult: v.mult || R.mult, flat: v.flat || 0, quote: v.quote || '', spec, one: !!v.one, rating: v.rating || null, t, p };
}
// The full card list, rebuilt only when rosters, tendencies or box scores change.
let catKey = null, catVal = [], catMap = new Map();
function catalog(db) {
  const key = JSON.stringify([Object.values(db.teams).map((t) => [t.id, t.tend, t.roster.map((p) => [p.id, p.name, p.tend, p.position, p.grade, p.tag])]), db.games.map((g) => [g.status, g.homeScore, g.awayScore, (g.events || []).length])]);
  if (key !== catKey) {
    const et = pk.effTend(db);
    catVal = Object.values(db.teams).flatMap((t) => t.roster.flatMap((p) => VARIANTS.filter((v) => !v.only || v.only === p.id).map((v) => makeCard(et, t, p, v))));
    catMap = new Map(catVal.map((c) => [c.id, c]));
    catKey = key;
  }
  return catVal;
}
// "maddox-pedon:gold" -> everything needed to show and score the card.
function cardInfo(db, id) {
  catalog(db);
  return catMap.get(String(id)) || null;
}

// ---------- packs ----------
const rint = (n) => crypto.randomInt(n);
function rollRarity(pool, P = {}, minRarity = 'common') {
  const have = new Set(pool.map((c) => c.rarity));
  const rs = RARITY_ORDER.slice(RARITY_ORDER.indexOf(minRarity)).filter((r) => have.has(r));
  const w = (r) => RARITIES[r].weight * (P.boost?.[r] ?? 1);
  const total = rs.reduce((s, r) => s + w(r), 0);
  if (!total) return null;
  let x = rint(total);
  for (const r of rs) { x -= w(r); if (x < 0) return r; }
  return rs[0];
}
function rollCard(pool, P, minRarity) {
  const doh = pool.find((c) => c.rarity === 'doh');
  if (doh && rint(DOH_ODDS) === 0) return doh.id;
  const r = rollRarity(pool, P, minRarity) || rollRarity(pool, {}, minRarity) || rollRarity(pool, {});
  const options = pool.filter((c) => c.rarity === r);
  return options[rint(options.length)].id;
}
// `taken`: ids of 1/1 cards someone already owns (they can't drop again).
function openPack(db, type, taken = new Set()) {
  const P = packInfo(db, type);
  if (!P) throw new Error('Unknown pack');
  if (type === 'starter') {
    const players = Object.values(db.teams).flatMap((t) => t.roster.map((p) => p.id));
    for (let i = players.length - 1; i > 0; i--) { const j = rint(i + 1); [players[i], players[j]] = [players[j], players[i]]; }
    return players.slice(0, P.cards).map((pid) => `${pid}:base`);
  }
  let pool = catalog(db).filter((c) => !taken.has(c.id));
  if (P.pool) { const f = pool.filter(P.pool); if (f.length) pool = f; }
  const out = [];
  const n = P.mystery ? P.mystery[0] + rint(P.mystery[1] - P.mystery[0] + 1) : P.cards;
  const pick = (min) => { const id = rollCard(pool, P, min); if (cardInfo(db, id).one) pool = pool.filter((c) => c.id !== id); return id; };
  for (let i = 0; i < n; i++) out.push(pick());
  // Guarantees: swap random slots for cards of at least `min` rarity.
  if (P.min && pool.some((c) => RARITY_ORDER.indexOf(c.rarity) >= RARITY_ORDER.indexOf(P.min))) {
    const ok = (id) => RARITY_ORDER.indexOf(cardInfo(db, id).rarity) >= RARITY_ORDER.indexOf(P.min);
    const need = Math.min(P.mins || 1, n);
    const low = out.map((id, i) => (ok(id) ? -1 : i)).filter((i) => i >= 0);
    for (let k = out.filter(ok).length; k < need && low.length; k++) out[low.splice(rint(low.length), 1)[0]] = pick(P.min);
  }
  return out;
}

// What a user owns: every pack card plus cards traded in, minus cards sold or traded away.
function collection(user) {
  const own = {};
  for (const pack of user.packs || []) for (const id of pack.cards) own[id] = (own[id] || 0) + 1;
  for (const id of user.tradeIn || []) own[id] = (own[id] || 0) + 1;
  for (const id of [...(user.sold || []), ...(user.tradeOut || [])]) if (own[id]) own[id]--;
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
  if (card.flat) { pts += card.flat; parts.push({ k: 'flat', n: 1, pts: card.flat }); }
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

module.exports = { DOH_ODDS, RARITIES, RARITY_ORDER, SPECIALTIES, SPECIAL_BOOST, SPEC_KEYS, VARIANTS, packInfo, packTypes, COLLECTOR_STEPS, TEAM_PACK, SCORING, SCORING_LABEL, LINEUP_SIZE, PACKS, cardInfo, catalog, openPack, collection, gameLines, cardScore, lineupFor, fantasy, findPlayer };
