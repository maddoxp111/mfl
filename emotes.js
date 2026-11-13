// Player avatars: the move each player's 3D avatar does on his page (the moves live in the 3D engine,
// public/arcade/blitz-avatar.js; their ids are the keys of EMOTES below).
//
// Every player has a default move here (PLAYER_EMOTES: player id -> move id); keep every player's default different.
// The admin can give any player a different move on /admin/moves: that choice is kept in the league data
// (db.avatarMoves: player id -> move id) and wins over the default. A player with neither (a new signing) gets the first
// move nobody on any roster is doing, so he still has his own.

// every move the engine has, with the name shown on the page (same order as the engine)
const EMOTES = {
  xavdance: 'Signature Dance',
  backflip: 'Backflip',
  foldnod: 'Arms Folded',
  dustoff: 'Dust Off',
  hips: 'Hands on Hips',
  calmdown: 'Calm Down',
  tooeasy: 'Too Easy',
  skypoint: 'Point to the Sky',
  slowclap: 'Slow Clap',
  watch: 'Check the Watch',
  waveoff: 'Wave-Off',
  salute: 'Brow Salute',
  neckroll: 'Neck Roll',
  gloves: 'Glove Tug',
  chesttap: 'Chest Pound',
  lean: 'Chill Lean',
  staredown: 'Stare-Down',
  stretch: 'Big Stretch',
  armsout: 'Arms Out',
  jersey: 'Jersey Pop',
  twostep: 'Two-Step',
};
// a real move id (an own key of EMOTES: never a built-in like "constructor" or "__proto__")
const isMove = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(EMOTES, id);

// player id -> his default move
const PLAYER_EMOTES = {
  // Team Xavier (KTCS)
  'xavier-davenport': 'xavdance', // his own dance, motion-captured from his video
  'luka-corrales': 'backflip',
  'charlie-waddell': 'foldnod',
  'carson-tabaka': 'skypoint',
  'braxton-iliff-murphy': 'lean',
  'kamden-doage': 'staredown',
  'wally-barrickman': 'tooeasy',
  'dom-chiodo': 'twostep',
  'kayson-link': 'watch',
  'theo-miner': 'stretch',
  // Pineapples
  'maddox-pedon': 'dustoff',
  'maddox-marsaglia': 'neckroll',
  'giovani-pelaez': 'chesttap',
  'bowen-ince': 'waveoff',
  'liam-bair': 'salute',
  'finn-hopkins': 'hips',
  'clayton-kinsella': 'calmdown',
  'luther-nuesken': 'slowclap',
};

// the admin's choice for a player (or null)
const chosen = (db, id) => {
  const am = db && db.avatarMoves, m = id && am && Object.prototype.hasOwnProperty.call(am, id) ? am[id] : null;
  return isMove(m) ? m : null;
};
const rosterIds = (db) => {
  const out = [];
  for (const t of Object.values((db && db.teams) || {})) for (const p of t.roster || []) out.push(p.id);
  return out;
};

// His default (ignoring the admin's choice): his line in the table, else the first move no one on any roster is using (the
// admin's choices count as used), in table order, else one picked from his id.
function defaultFor(db, player) {
  const id = player && player.id;
  const own = (pid) => (pid && Object.prototype.hasOwnProperty.call(PLAYER_EMOTES, pid) && isMove(PLAYER_EMOTES[pid]) ? PLAYER_EMOTES[pid] : null);
  if (own(id)) return own(id);
  const ids = Object.keys(EMOTES), all = rosterIds(db), used = new Set();
  for (const pid of all) if (pid !== id) { const m = chosen(db, pid) || own(pid); if (m) used.add(m); }
  // new players without a line take the spare moves in roster order, so two of them don't land on the same one
  const fresh = all.filter((pid) => !own(pid) && !chosen(db, pid));
  const spare = ids.filter((e) => !used.has(e));
  const k = fresh.indexOf(id);
  if (k >= 0 && k < spare.length) return spare[k];
  let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ids[h % ids.length];
}

// The move his avatar does: the admin's choice, else his default.
function emoteFor(db, player) {
  return chosen(db, player && player.id) || defaultFor(db, player);
}

module.exports = { EMOTES, PLAYER_EMOTES, isMove, emoteFor, defaultFor };
