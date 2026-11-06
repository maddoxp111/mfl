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
      'New page: every way to earn coins.',
      "New: these patch notes, and a popup like this one whenever there's an update.",
      'Fair play: every pick on the Nov 6 game was voided and interception picks are off, after players threw interceptions on purpose.',
    ],
  },
];

const latest = () => UPDATES.reduce((a, u) => (!a || u.n > a.n ? u : a), null);

module.exports = { UPDATES, latest };
