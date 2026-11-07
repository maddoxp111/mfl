// Seasons: a themed drop of new cards and packs with a cover athlete. Season cards and packs
// carry `season: n` (cards.js); season cards only ever drop from that season's packs.
const SEASONS = [
  {
    n: 1,
    name: 'Full Extension',
    start: '2026-11-07',
    cover: 'carson-tabaka', // the cover athlete's player id: his two cover cards are his alone
    coverName: 'Carson Tabaka',
    number: 23,
    nick: 'BigBoyCT',
    img: '/static/s1/carson.webp?v=1',
    tag: 'The season of the one-handed catch.',
  },
];
const current = () => SEASONS[SEASONS.length - 1];
module.exports = { SEASONS, S1: SEASONS[0], current };
