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
  {
    n: 3,
    date: '2026-11-07',
    title: 'Lineup pays 100 coins a point',
    items: [
      'Lineup players now pay 100 coins per fantasy point instead of 250. It counts for every past game too, so Lineup coins from earlier games went down to match.',
    ],
  },
  {
    n: 4,
    date: '2026-11-07',
    title: 'New pack prices, score panel',
    items: [
      'Pack prices now match how many coins are going around: a Lineup earns most players 30,000 to 40,000 coins a game, so a 1,000-coin pack was pocket change. Most packs cost 10 times what they did (Standard 10,000). The Rookie Rack and Snack Attack Single are 1,000, so a brand-new account can still buy one. The chase packs are 150,000 to 400,000 (Dark Matter 400,000). Packs you already bought keep the price you paid.',
      'Score panel: the commissioner can let people score games. Scorers get a Score link in the menu to enter results, plays and who didn\'t play, and every save is logged with their name.',
      'The admin panel now needs a PIN as well as the password.',
    ],
  },
  {
    n: 5,
    date: '2026-11-07',
    title: 'Season 1: Full Extension',
    items: [
      'Season 1 is here: Full Extension, with Carson Tabaka (#23, BigBoyCT) on the cover. See everything on the new Season 1 page (Cards, then Packs or My Cards, or go to /season).',
      'Nine new cards for every player, all named for Carson: T-Time, Twenty-Three, Cars, Team Chemistry, One-Hand CT, Tabaka Grab, Big Boy Mode, Cover Shoot 1/1 and Full Extension 1/1. Each one beats the older cards of its rarity.',
      "Carson's own two: the Cover Athlete card and the BigBoyCT 1/1, worth 6x fantasy points with every skill maxed.",
      'A new top rarity, Zenith, above Dark Matter: 5x points, every skill maxed and perk level 7. Every Zenith is a 1 of 1.',
      "Season 1 packs, from the free Season 1: Carson Tabaka - Welcome Pack (two free cards for everyone) through Season 1: Carson Tabaka, T-Time, Momma P's Cookies, CT Team Chemistry, Carson Charles Tabaka and BigBoyCT, up to Tabaka Time and Carson's Filet Dinner, the best pack in the shop and a coin flip for a Zenith. Season 1 cards only come from Season 1 packs.",
      'The Cover Athlete Pack: only cover athletes\' cards, starting with Carson. It stays in the shop for good, and every new season adds its cover athlete.',
    ],
  },
  {
    n: 6,
    date: '2026-11-07',
    title: 'Full Extension Essentials',
    items: [
      'New Season 1 pack: Full Extension Essentials - CT. 6 Season 1 cards with a Legend or better guaranteed, for 90,000 coins.',
    ],
  },
  {
    n: 7,
    date: '2026-11-07',
    title: 'Bigger packs, pack boxes',
    items: [
      'Every pack has more cards now: at least 3 and up to 15 (Standard 5, Premium 8, Mega 15, the free Daily Pack 3). Same prices.',
      'Chase packs like Dark Matter, The GOAT Hunt and Carson\'s Filet Dinner got extra cards too. The big chance is still on one card, the hit, and it is always the last one you flip.',
      'Pack boxes: buy 5, 10 or 20 of the same pack for 5%, 10% or 15% off. They open back to back: flip the pack, press Next for the next one, and see the whole box at the end.',
    ],
  },
  {
    n: 8,
    date: '2026-11-07',
    title: 'Play defense in 3D Blitz',
    items: [
      "Key defensive plays: 2 to 4 times a game the CPU's biggest snaps are played live instead of simulated (3rd and 4th downs, the red zone, the two-minute drill, a one-score game late).",
      'You call a real defense (Cover 2, Cover 3, Cover 4, Man, Man Blitz, Zone Blitz, All-Out Blitz, Disguise, Prevent, Press Man, QB Spy, Stack the Box), then play a defender yourself: arrows or drag to move, SHIFT to sprint, SPACE to jump for the ball, X to dive at a runner or a pass, Q to switch to the defender nearest the ball. Leave the stick alone and he plays his assignment.',
      'The CPU runs a real play against you: its quarterback reads the field and throws to the open man, scrambles or throws it away, and its runners juke and spin. A stop, a sack or a pick goes straight back into the drive.',
      'Your defenders are your own Lineup players, and a defender you steer reads the ball better than the AI: time your jump and the pick is yours.',
      'Head to Head: on defense you now play a defender live too, with the same buttons, on top of calling the play.',
    ],
  },
  {
    n: 9,
    date: '2026-11-07',
    title: 'Skill over luck',
    items: [
      "More live defense: 2 to 4 of every CPU drive's snaps are played live now (3rd and 4th downs, the red zone and the two-minute drill always).",
      'A defensive playbook at the bottom of the screen, just like the offense: tabs (Suggested, Zone, Man, Blitz, Special) and play art for every call, showing where everyone lines up, the zones, the man assignments and the blitzers. Same in Head to Head.',
      "Your call decides the simulated snaps too: each one is the CPU's kind of play (run, quick pass, deep shot, screen, play-action...) against your call. Cover 4 shuts down deep shots but gives up runs, Stack the Box stuffs runs but play-action burns it, and so on. Keep making the same call and they start running what beats it. The drive card shows what they ran.",
      'Jukes, spins, stiff arms and hurdles are timed now, not rolled: hit the move just before the tackler gets there for a PERFECT move that beats him for sure. Too early and he adjusts, too late and the hit is on.',
      'Catches, picks and breakups are decided by where the ball is thrown and who is open, not by dice: a good ball to an open receiver is caught, a ball on the defender\'s side can be picked. Throws go where you aim them; on the run they drift the way you are moving, and with a man in your face they sail.',
    ],
  },
];

const latest = () => UPDATES.reduce((a, u) => (!a || u.n > a.n ? u : a), null);

module.exports = { UPDATES, latest };
