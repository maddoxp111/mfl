// Patch notes, shown on /updates (newest first).
// To ship the next update, add an entry with the next number (n: 2, 3, ...), the date
// (YYYY-MM-DD), a short title and a few plain-text bullets (no HTML: it's escaped).
// The entry with the highest number is the latest one: it pops up once for every
// visitor ("UPDATE N") on their next page load. Older updates never pop up again.
const UPDATES = [
  {
    n: 1,
    date: '2026-11-06',
    title: 'Your player, bigger payouts, patch notes',
    items: [
      'Your player: the commissioner can link your account to your real MFL player. Every win pays 50,000 coins, plus coins for your stats: 125,000 per TD you score, 75,000 per TD pass, 50,000 per interception, 25,000 per pass breakup, notable catch or notable play, minus 25,000 per interception you throw or penalty you get. Past games count, and a popup shows what you earned after every game.',
      'Lineup players pay way more: 250 coins per fantasy point.',
      'Pack prices are up 1.5× to 2× (the most on the top packs) now that coins come easier.',
      'New page: every way to earn coins. Find it as Earn coins in the News menu and at the bottom of every page.',
      "New: these patch notes, and a popup like this one whenever there's an update.",
      'Fair play: every pick on the Nov 6 game was voided and interception picks are off, after players threw interceptions on purpose.',
    ],
  },
  {
    n: 2,
    date: '2026-11-07',
    title: 'Coin history on every profile',
    items: [
      "Every profile now shows where that account's coins came from (Pick'em, Lineup, Arcade, packs and the rest) and a coin history: every change, newest first, with the balance after it.",
      'Nov 6 rollback: coins handed out from the admin panel on Nov 6 were removed, and every pack, pick, card sale, trade and Lineup change made after 10:55 AM that day was undone, site wide. Coins spent on those packs and picks came back. If your Lineup changed back, set it again before the next game.',
      'The admin password was reset and every admin login was signed out.',
    ],
  },
];

const latest = () => UPDATES.reduce((a, u) => (!a || u.n > a.n ? u : a), null);

module.exports = { UPDATES, latest };
