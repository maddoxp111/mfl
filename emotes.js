// Player avatars: the move each player's 3D avatar does on his page (the clips live in the 3D engine,
// public/arcade/blitz-avatar.js; their ids are the keys of EMOTES below).
//
// To change a player's move, change his line in PLAYER_EMOTES (player id -> move id). Keep every player's move different.
// A player who isn't in the table yet (a new signing) gets the first move nobody on any roster has, so he still has his own.

// every move the engine has, with the name shown on the page
const EMOTES = {
  xavdance: 'Signature Dance',
  backflip: 'Backflip',
  jumpspin: '360 Jump Spin',
  heelshuffle: 'Heel-Tap Shuffle',
  heisman: 'Stiff-Arm Pose',
  flex: 'Double Flex',
  robot: 'The Robot',
  shimmy: 'Shoulder Shimmy',
  sprinkler: 'The Sprinkler',
  moonglide: 'Moon Glide',
  spike: 'Spike and Point',
  salute: 'Salute',
  boxer: 'Shadow Boxer',
  hero: 'Hands-on-Hips Nod',
  qbclap: 'QB Clap',
  lasso: 'Lasso Throw',
  bow: 'Bow and Arrow',
  airplane: 'Airplane',
  raiseroof: 'Raise the Roof',
  kick: 'Karate Kick',
  cupear: "Can't Hear You",
};

// player id -> move
const PLAYER_EMOTES = {
  // Team Xavier (KTCS)
  'xavier-davenport': 'xavdance', // his own dance, motion-captured from his video
  'luka-corrales': 'backflip',
  'charlie-waddell': 'heisman',
  'carson-tabaka': 'spike',
  'braxton-iliff-murphy': 'moonglide',
  'kamden-doage': 'boxer',
  'wally-barrickman': 'bow',
  'dom-chiodo': 'raiseroof',
  'kayson-link': 'qbclap',
  'theo-miner': 'airplane',
  // Pineapples
  'maddox-pedon': 'jumpspin',
  'maddox-marsaglia': 'shimmy',
  'giovani-pelaez': 'robot',
  'bowen-ince': 'heelshuffle',
  'liam-bair': 'salute',
  'finn-hopkins': 'flex',
  'clayton-kinsella': 'sprinkler',
  'luther-nuesken': 'lasso',
};

// The move for a player: his line in the table, else the first move no one on any roster is using (in table order),
// else one picked from his id.
function emoteFor(db, player) {
  const id = player && player.id;
  if (id && EMOTES[PLAYER_EMOTES[id]]) return PLAYER_EMOTES[id];
  const used = new Set();
  for (const t of Object.values((db && db.teams) || {})) for (const p of t.roster || []) if (p.id !== id && EMOTES[PLAYER_EMOTES[p.id]]) used.add(PLAYER_EMOTES[p.id]);
  const ids = Object.keys(EMOTES);
  // new players without a line take the spare moves in roster order, so two of them don't land on the same one
  const fresh = [];
  for (const t of Object.values((db && db.teams) || {})) for (const p of t.roster || []) if (!EMOTES[PLAYER_EMOTES[p.id]]) fresh.push(p.id);
  const spare = ids.filter((e) => !used.has(e));
  const k = fresh.indexOf(id);
  if (k >= 0 && k < spare.length) return spare[k];
  let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ids[h % ids.length];
}

module.exports = { EMOTES, PLAYER_EMOTES, emoteFor };
