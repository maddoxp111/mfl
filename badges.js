// Achievements: badges earned automatically by players (from box scores) and by
// Pick'em users (from picks, cards and Survivor). Nothing is stored; it's all derived.
const pk = require('./pickem');
const cards = require('./cards');

const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;

const PLAYER_BADGES = [
  ['hat', '🎩', 'Hat Trick', '3+ touchdowns in one game'],
  ['gunslinger', '🎯', 'Gunslinger', '3+ TD passes in one game'],
  ['dual', '⚡', 'Double Threat', 'Scored and threw a TD in the same game'],
  ['pickscore', '🦅', 'Pick & Score', 'An interception and a touchdown in the same game'],
  ['ballhawk', '🧲', 'Ballhawk', '2+ interceptions in one game'],
  ['highlight', '🎬', 'Highlight Reel', 'Made a notable catch or notable play'],
  ['hunter', '💥', 'QB Hunter', 'Recorded a sack'],
  ['streak', '🔥', 'On Fire', 'Touchdown in 3 straight games'],
  ['mvp', '🏆', 'Game MVP', 'Named MVP of a game'],
  ['mvp3', '👑', 'Triple Crown', '3 game MVPs'],
  ['iron', '🛡️', 'Ironman', 'Played every game (5+ games)'],
  ['champ', '💍', 'Bowl Champion', 'Won a playoff bowl'],
];

// mvpOf(g) -> "team|pid" of the game MVP (or null).
function playerBadges(db, t, p, mvpOf) {
  const key = t.id + '|' + p.id;
  const games = db.games.filter((g) => isFinal(g) && (g.home === t.id || g.away === t.id)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const lines = games.map((g) => ({ g, L: cards.gameLines(db, g, mvpOf(g))[key] })).filter((x) => x.L);
  const has = new Set();
  let run = 0, mvps = 0;
  for (const { g, L } of lines) {
    if (L.td >= 3) has.add('hat');
    if (L.pass >= 3) has.add('gunslinger');
    if (L.td && L.pass) has.add('dual');
    if (L.int && L.td) has.add('pickscore');
    if (L.int >= 2) has.add('ballhawk');
    if (L.catch || L.big) has.add('highlight');
    if (L.sack) has.add('hunter');
    run = L.td ? run + 1 : 0;
    if (run >= 3) has.add('streak');
    if (L.mvp) { mvps++; has.add('mvp'); }
    if (g.type === 'playoff' && L.win) has.add('champ');
  }
  if (mvps >= 3) has.add('mvp3');
  if (games.length >= 5 && lines.length === games.length) has.add('iron');
  return PLAYER_BADGES.filter(([id]) => has.has(id));
}

const USER_BADGES = [
  ['firstwin', '✅', 'First Win', 'Won a pick'],
  ['upset', '🐶', 'Called the Upset', 'Won a "to win" pick on the underdog (+150 or longer)'],
  ['longshot', '🚀', 'Long Shot', 'Won a pick at +1000 or longer'],
  ['comboking', '🧩', 'Combo King', 'Won a 4+ pick combo'],
  ['hot', '🔥', 'Hot Streak', '5 winning picks in a row'],
  ['botw', '⭐', 'Picker of the Week', 'Best profit of a week'],
  ['fantasy', '📈', 'Fantasy Star', '100+ points from a Starting 8 in one game'],
  ['collector', '🗂️', 'Collector', '25 different cards'],
  ['fullsquad', '🧑‍🤝‍🧑', 'Full Squad', 'A card of every player in the league'],
  ['legend', '🌟', 'Legendary Pull', 'Owns a Legend, All-Star or Clutch card'],
  ['mythic', '💎', 'Mythic Pull', 'Owns a Mythic, Icon or Dark Matter card'],
  ['darkmatter', '🌌', 'Dark Matter', 'Owns a Dark Matter 1/1 card'],
  ['hoarder', '📚', 'Card Shark', '100 different cards'],
  ['survivor', '🏝️', 'Survivor', 'Won a Survivor round'],
];

// ctx: { db, acct (pk.account), user, weeklyWins, survivorWins, fantasy }
function userBadges(ctx) {
  const { db, acct, user } = ctx;
  const has = new Set();
  const settled = acct.bets.filter((b) => b.status === 'won' || b.status === 'lost');
  if (settled.some((b) => b.status === 'won')) has.add('firstwin');
  if (acct.bets.some((b) => b.status === 'won' && b.legs.length === 1 && b.legs[0].key.startsWith('ml:') && b.odds >= 2.5)) has.add('upset');
  if (acct.bets.some((b) => b.status === 'won' && b.odds >= 11)) has.add('longshot');
  if (acct.bets.some((b) => b.status === 'won' && b.legs.length >= 4)) has.add('comboking');
  let run = 0;
  for (const b of settled) { run = b.status === 'won' ? run + 1 : 0; if (run >= 5) has.add('hot'); }
  if (ctx.weeklyWins > 0) has.add('botw');
  if ((ctx.fantasy?.results || []).some((r) => r.total >= 100)) has.add('fantasy');
  const own = Object.keys(cards.collection(user));
  if (own.length >= 25) has.add('collector');
  const players = Object.values(db.teams).flatMap((t) => t.roster.map((p) => p.id));
  const ownPlayers = new Set(own.map((id) => id.split(':')[0]));
  if (players.length && players.every((pid) => ownPlayers.has(pid))) has.add('fullsquad');
  const rk = (id) => cards.RARITY_ORDER.indexOf(cards.cardInfo(db, id)?.rarity);
  if (own.some((id) => rk(id) >= 3)) has.add('legend');
  if (own.some((id) => rk(id) >= 4)) has.add('mythic');
  if (own.some((id) => rk(id) >= 5)) has.add('darkmatter');
  if (own.length >= 100) has.add('hoarder');
  if (ctx.survivorWins > 0) has.add('survivor');
  return USER_BADGES.filter(([id]) => has.has(id));
}

module.exports = { PLAYER_BADGES, USER_BADGES, playerBadges, userBadges };
