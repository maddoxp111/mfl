// MFL Cards: collectible player cards, packs and the Lineup fantasy game.
// Lineup fantasy points pay out as Pick'em coins, and coins buy packs.
// Every card also shifts its player's game attributes (see cardEffects): some up, some down.
const crypto = require('crypto');
const pk = require('./pickem');

// Rarity sets how often a card shows up in packs (and what an extra copy sells for).
// Sell values stay far below pack prices: on average a pack's cards sell for well under
// half of what it costs (about an eighth for most packs), so buying packs to sell never pays.
const RARITIES = {
  common: { name: 'Base', mult: 1, weight: 6200, sell: 50 },
  rare: { name: 'Silver', mult: 1.25, weight: 2600, sell: 150 },
  epic: { name: 'Gold', mult: 1.5, weight: 900, sell: 400 },
  legendary: { name: 'Legend', mult: 2, weight: 90, sell: 1500 },
  mythic: { name: 'Mythic', mult: 3, weight: 8, sell: 5000 },
  dark: { name: 'Dark Matter', mult: 4, weight: 2, sell: 15000 },
  // Never rolled by weight: see DOH_ODDS. Hidden: never listed anywhere until someone pulls it.
  doh: { name: 'Big Doh Mi', mult: 101, weight: 0, sell: 100000, hidden: true },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'dark', 'doh'];
// The rarities pages list (odds, filters, help). Hidden ones stay out of every list.
const SHOWN_RARITIES = RARITY_ORDER.filter((r) => !RARITIES[r].hidden);
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
  // Dom only. 101x = every point he scores comes with 100 extra. A hidden card: it is in no list or index until pulled.
  { id: 'doh', rarity: 'doh', label: 'Big Doh Mi', mult: 101, rating: 99, only: 'dom-chiodo', hidden: true, quote: 'Every point he scores: +100 more.' },
];

// ---------- card sets ----------
// 54 themed sets in 9 series. Every player has 5 parallels in every set (Base, Silver, Gold,
// Prism, Black), so the sets add 54 × 5 × roster size cards. Set cards only drop from set packs.
// Each set: [id, name, emoji, color1, color2, pattern 0-9, photo style, quote]
const SERIES = [
  ['school', 'School Days', [
    ['picture-day', 'Picture Day', '📸', '#38bdf8', '#0c4a6e', 1, 'fade', 'Say cheese!'],
    ['hall-pass', 'Hall Pass', '🎫', '#facc15', '#713f12', 4, 'frame', 'Just going to the water fountain.'],
    ['gym-class', 'Gym Class', '🏃', '#f97316', '#431407', 0, 'banner', 'Dodgeball champion.'],
    ['science-fair', 'Science Fair', '🧪', '#4ade80', '#052e16', 5, 'tv', 'Hypothesis: we win.'],
    ['library', 'Library Hush', '📚', '#a78bfa', '#2e1065', 8, 'polaroid', 'Shhh. Playbook study.'],
    ['bus-ride', 'Bus Ride', '🚌', '#fbbf24', '#3f2a05', 7, 'banner', 'Back seat legend.'],
  ]],
  ['spirit', 'Spirit Week', [
    ['pajama-day', 'Pajama Day', '🛌', '#f9a8d4', '#500724', 1, 'fade', 'Slippers on, game face on.'],
    ['crazy-hair', 'Crazy Hair Day', '🤪', '#22d3ee', '#164e63', 3, 'full', 'Helmet barely fits.'],
    ['twin-day', 'Twin Day', '👯', '#c084fc', '#3b0764', 6, 'duo', 'Double trouble.'],
    ['pep-rally', 'Pep Rally', '📣', '#ef4444', '#450a0a', 3, 'banner', 'LOUDER!'],
    ['homecoming', 'Homecoming', '👑', '#fde68a', '#78350f', 9, 'full', 'Crowned on the field.'],
    ['color-war', 'Color War', '🎨', '#34d399', '#4c1d95', 2, 'fade', 'Pick a side.'],
  ]],
  ['bowls', 'Bowl Season', [
    ['halloween', 'Halloween Bowl', '🎃', '#fb923c', '#1c1917', 6, 'full', 'Spooky good.'],
    ['turkey', 'Turkey Bowl', '🦃', '#d97706', '#431407', 0, 'banner', 'Thankful for touchdowns.'],
    ['christmas', 'Christmas Bowl', '🎄', '#22c55e', '#7f1d1d', 1, 'polaroid', 'Wrapped up a win.'],
    ['spring', 'Spring Bowl', '🌸', '#f472b6', '#14532d', 9, 'fade', 'Fresh start.'],
    ['super', 'Super Bowl', '🏆', '#fde047', '#1e1b4b', 3, 'full', 'Winner takes the season.'],
    ['new-year', "New Year's Bowl", '🎆', '#e0e7ff', '#0f172a', 5, 'duo', 'Midnight magic.'],
  ]],
  ['wild', 'Wild World', [
    ['galaxy', 'Galaxy', '🌌', '#818cf8', '#020617', 1, 'full', 'Out of this world.'],
    ['ocean', 'Deep Ocean', '🌊', '#06b6d4', '#082f49', 6, 'fade', 'Making waves.'],
    ['jungle', 'Jungle', '🌴', '#84cc16', '#052e16', 8, 'banner', 'King of the jungle.'],
    ['volcano', 'Volcano', '🌋', '#f97316', '#1c0a00', 3, 'full', 'Erupts every snap.'],
    ['arctic', 'Arctic', '🧊', '#e0f2fe', '#0c4a6e', 4, 'duo', 'Ice in his veins.'],
    ['desert', 'Desert Storm', '🏜️', '#fcd34d', '#78350f', 7, 'polaroid', 'Hot hands.'],
  ]],
  ['art', 'Art Class', [
    ['chalkboard', 'Chalkboard', '🖍️', '#d1fae5', '#1f3d2b', 4, 'frame', 'X\'s and O\'s.'],
    ['blueprint', 'Blueprint', '📐', '#93c5fd', '#1e3a8a', 4, 'duo', 'Built by design.'],
    ['comic', 'Comic Book', '💥', '#facc15', '#991b1b', 1, 'banner', 'KA-POW!'],
    ['graffiti', 'Graffiti', '🎨', '#e879f9', '#1e1b4b', 2, 'full', 'Tagged it.'],
    ['stained-glass', 'Stained Glass', '⛪', '#f59e0b', '#1e3a8a', 8, 'fade', 'A work of art.'],
    ['origami', 'Origami', '🦢', '#fda4af', '#4c0519', 2, 'polaroid', 'Folds defenders.'],
  ]],
  ['arcade', 'Arcade', [
    ['neon', 'Neon Nights', '🌃', '#f0abfc', '#0b0118', 0, 'full', 'Glows in the dark.'],
    ['pixel-plus', 'Pixel Pro', '👾', '#4ade80', '#020617', 4, 'tv', 'Press start.'],
    ['high-score', 'High Score', '🕹️', '#fde047', '#1e1b4b', 5, 'tv', 'New record!'],
    ['circuit', 'Circuit Board', '🔌', '#34d399', '#022c22', 4, 'duo', 'Wired to win.'],
    ['hologram', 'Hologram', '💠', '#67e8f9', '#083344', 9, 'fade', 'Now you see him.'],
    ['vhs', 'VHS Tape', '📼', '#fca5a5', '#1c1917', 7, 'tv', 'Be kind, rewind.'],
  ]],
  ['weather', 'Weather Report', [
    ['thunder', 'Thunderstruck', '⚡', '#fde047', '#1e293b', 3, 'full', 'Lightning fast.'],
    ['rainy-day', 'Rainy Day', '🌧️', '#94a3b8', '#0f172a', 0, 'duo', 'Mud game.'],
    ['sunshine', 'Sunshine', '☀️', '#fde68a', '#c2410c', 3, 'fade', 'Bright future.'],
    ['tornado', 'Tornado', '🌪️', '#cbd5e1', '#334155', 5, 'banner', 'Spins out of tackles.'],
    ['rainbow', 'Rainbow', '🌈', '#f472b6', '#2563eb', 9, 'full', 'Pot of gold.'],
    ['blizzard', 'Blizzard', '❄️', '#f0f9ff', '#1e40af', 1, 'polaroid', 'Snowed in. Still scored.'],
  ]],
  ['snacks', 'Snack Attack', [
    ['cereal', 'Cereal Box', '🥣', '#fb7185', '#7c2d12', 1, 'banner', 'Part of a winning breakfast.'],
    ['nachos', 'Nacho Day', '🧀', '#facc15', '#7c2d12', 2, 'polaroid', 'Extra cheesy.'],
    ['donut', 'Donut Run', '🍩', '#f9a8d4', '#831843', 5, 'fade', 'Sweet moves.'],
    ['hot-sauce', 'Hot Sauce', '🌶️', '#ef4444', '#450a0a', 3, 'full', 'Too spicy to tackle.'],
    ['popcorn', 'Popcorn', '🍿', '#fef3c7', '#991b1b', 0, 'frame', 'Movie star.'],
    ['smoothie', 'Smoothie', '🥤', '#a3e635', '#701a75', 6, 'duo', 'Blended to perfection.'],
  ]],
  ['legends', 'MFL Legends', [
    ['highlight', 'Highlight Reel', '🎬', '#f8fafc', '#18181b', 7, 'full', 'Top 10 play.'],
    ['film-room', 'Film Room', '🎞️', '#d4d4d8', '#27272a', 4, 'tv', 'Studied every snap.'],
    ['playbook', 'Playbook', '📋', '#bbf7d0', '#14532d', 4, 'frame', 'Drawn up in the dirt.'],
    ['captains', 'Captains Club', '🎖️', '#fbbf24', '#1e3a8a', 9, 'banner', 'Leads by example.'],
    ['all-mfl', 'All-MFL', '🌟', '#fde047', '#7f1d1d', 3, 'full', 'First team, all league.'],
    ['hall-of-fame', 'Hall of Fame', '🏛️', '#fef3c7', '#422006', 8, 'fade', 'Forever MFL.'],
  ]],
];
// Parallels: every set card comes in these five.
const PARALLELS = [
  { id: 'base', label: '', rarity: 'common', mult: 1.05 },
  { id: 'silver', label: 'Silver', rarity: 'rare', mult: 1.3 },
  { id: 'gold', label: 'Gold', rarity: 'epic', mult: 1.6 },
  { id: 'prism', label: 'Prism', rarity: 'legendary', mult: 2.1 },
  { id: 'black', label: 'Black', rarity: 'mythic', mult: 2.8 },
];
const SETS = SERIES.flatMap(([series, seriesName, sets]) => sets.map(([id, name, emoji, c1, c2, pat, photo, quote]) => ({ id, name, emoji, c1, c2, pat, photo, quote, series, seriesName })));
const SET_MAP = new Map(SETS.map((x) => [x.id, x]));
for (const st of SETS) for (const par of PARALLELS) {
  VARIANTS.push({ id: `set-${st.id}-${par.id}`, rarity: par.rarity, label: par.label ? `${st.name} ${par.label}` : st.name, mult: par.mult, quote: st.quote, set: st.id, par: par.id });
}
const isSetCard = (c) => !!c.set;

// Body-type cards: they make the player taller, shorter, heavier or lighter in the Arcade games.
// Added after the set cards so every older card keeps its artwork (the art is keyed to list order).
const BODY_VARIANTS = [
  { id: 'skinny', rarity: 'rare', label: 'Skinny', mult: 1.2, quote: 'Turns sideways and disappears.' },
  { id: 'heavy', rarity: 'rare', label: 'Heavyweight', mult: 1.2, quote: 'Hard to move. Harder to tackle.' },
  { id: 'tall', rarity: 'rare', label: 'Tall Order', mult: 1.2, quote: "Catches what you can't reach." },
  { id: 'short', rarity: 'rare', label: 'Short King', mult: 1.2, quote: 'Low center of gravity.' },
  { id: 'beanpole', rarity: 'epic', label: 'Beanpole', mult: 1.45, quote: 'All arms and legs.' },
  { id: 'stout', rarity: 'epic', label: 'Stout', mult: 1.45, quote: 'Built like a fire hydrant.' },
  { id: 'giant', rarity: 'epic', label: 'Giant', mult: 1.5, quote: 'Blocks out the sun.' },
  { id: 'pocket', rarity: 'epic', label: 'Pocket Rocket', mult: 1.5, quote: 'Small. Fast. Gone.' },
];
const BODY_TYPES = BODY_VARIANTS.map((v) => v.id);
VARIANTS.push(...BODY_VARIANTS);
const VARIANT_MAP = new Map(VARIANTS.map((v) => [v.id, v]));

// ---------- card effects ----------
// Every card changes its player's game attributes: some go up, some go down. All of it comes
// from the tables below (never random). Skill attributes are on the 0-99 scale, height is in
// inches and weight in pounds. Only the 1 of 1 cards are all upside.
const ATTR_KEYS = ['thr', 'acc', 'spd', 'agi', 'sta', 'str', 'cat', 'def', 'kick', 'hgt', 'wgt'];
const ATTR_LABELS = { thr: 'Throw power', acc: 'Accuracy', spd: 'Speed', agi: 'Agility', sta: 'Stamina', str: 'Strength', cat: 'Catching', def: 'Defense', kick: 'Kicking', hgt: 'Height', wgt: 'Weight' };
const ATTR_SHORT = { thr: 'THR', acc: 'ACC', spd: 'SPD', agi: 'AGI', sta: 'STA', str: 'STR', cat: 'CAT', def: 'DEF', kick: 'KICK', hgt: 'HGT', wgt: 'WGT' };
const BUILD_LABELS = { slim: 'Slim', lanky: 'Lanky', normal: 'Normal', stocky: 'Stocky', tank: 'Tank', fat: 'Fat', stubby: 'Stubby', tall: 'Tall', short: 'Short' };
// Largest delta allowed: ±12 for skills, ±4 in of height, ±25 lb of weight.
const FX_CAP = { hgt: 4, wgt: 25 }, FX_CAP_SKILL = 12;

// Specialist cards boost what they score on. Signature cards use the same table, scaled up.
const SPEC_FX = {
  td: { spd: 4, str: 3, thr: -2, def: -2 },
  pass: { thr: 5, acc: 3, spd: -2, def: -2 },
  int: { def: 5, cat: 3, thr: -2, kick: -2 },
  def: { def: 4, spd: 3, str: 2, cat: -3 },
  play: { cat: 4, agi: 4, str: -2, def: -2 },
};
// One entry per classic card type. `spec` = use SPEC_FX for the card's specialty, scaled [up, down].
const VARIANT_FX = {
  // Common: small swings both ways.
  base: { a: { sta: 2, cat: 1, kick: -2 } }, // fundamentals, no flash
  team: { a: { def: 3, sta: 2, kick: -1, acc: -1 } }, // plays for the crest
  bench: { a: { sta: 4, spd: -2, acc: -2, agi: -1, wgt: 5 } }, // fresh legs, rusty hands, bench snacks
  trophy: { a: { thr: 1, acc: 1, spd: 1, agi: 1, sta: 1, str: 1, cat: 1, def: 1, kick: -4 } }, // everybody gets +1 (except the kicker)
  pizza: { a: { str: 4, sta: 3, spd: -3, agi: -2, wgt: 15 }, build: 'fat' }, // fueled by cafeteria pizza
  cutout: { a: { def: 3, str: 2, agi: -4, spd: -2, wgt: -10 }, build: 'slim' }, // flat, stiff and surprisingly solid
  // Rare.
  silver: { a: { acc: 3, cat: 3, agi: 2, str: -2 } },
  action: { a: { spd: 5, agi: 3, sta: -3, acc: -1 } }, // caught mid-sprint
  'spec-td': { spec: [1, 1] }, 'spec-pass': { spec: [1, 1] }, 'spec-int': { spec: [1, 1] }, 'spec-def': { spec: [1, 1] }, 'spec-play': { spec: [1, 1] },
  bobble: { a: { cat: 5, sta: 2, acc: -3, agi: -2 }, build: 'stubby' }, // big head sees the ball, wobbles on the throw
  pixel: { a: { spd: 5, kick: 4, agi: -3, cat: -2 } }, // runs in straight lines, very fast
  snow: { a: { agi: 4, cat: 3, sta: 2, thr: -3, spd: -1 } }, // light feet, cold hands
  upside: { a: { kick: 6, agi: 3, acc: -3, thr: -2, hgt: -1 } }, // feet in the air
  // Epic.
  gold: { a: { thr: 4, acc: 4, cat: 4, str: 3, spd: -2, wgt: 5 } }, // gold is heavy
  holo: { a: { agi: 6, spd: 5, cat: 3, str: -2, def: -1 } },
  spec: { spec: [1.6, 0.7] }, // Signature
  duck: { a: { agi: 6, sta: 5, cat: 3, str: -3, wgt: -10 } }, // floats, bounces, squeaks
  built: { a: { str: 8, def: 5, sta: 3, agi: -3, kick: -2, hgt: 1, wgt: 15 }, build: 'tank' },
  throwback: { a: { str: 5, def: 5, sta: 4, thr: -3, acc: -2 } }, // leather-helmet ground game
  spooky: { a: { def: 6, agi: 5, spd: 3, cat: -2, acc: -2 } }, // ghostly jukes, butterfingers
  // Legendary.
  legend: { a: { thr: 6, acc: 6, cat: 5, sta: 5, def: 4, spd: -2 } }, // a step slower, a lot smarter
  allstar: { a: { spd: 8, agi: 6, cat: 6, thr: 4, def: -2 } }, // showtime, skips defense
  clutch: { a: { acc: 8, cat: 6, kick: 6, sta: 3, agi: -2 } },
  glitch: { a: { spd: 10, agi: 9, kick: 6, acc: -4, hgt: 3, wgt: -10 } }, // stretched player model
  // Mythic.
  icon: { a: { thr: 9, acc: 9, cat: 8, spd: 7, def: 6, sta: 6, kick: -2 } },
  // 1 of 1: all upside.
  goat: { a: { thr: 12, acc: 12, spd: 11, agi: 11, cat: 11, sta: 9, str: 7, def: 9, kick: 6 } },
  mythic: { a: { thr: 10, acc: 10, spd: 10, agi: 10, cat: 10, def: 10, sta: 8, str: 8, kick: 8 } },
  dark: { a: { spd: 12, agi: 12, str: 11, def: 11, sta: 10, cat: 9, thr: 9, acc: 9, kick: 7, wgt: 10 } }, // dense
  doh: { a: { thr: 12, acc: 12, spd: 12, agi: 12, sta: 12, str: 12, cat: 12, def: 12, kick: 12, hgt: 2, wgt: 15 } },
  // Body types.
  skinny: { a: { spd: 4, agi: 4, str: -4, def: -2, wgt: -15 }, build: 'slim' },
  heavy: { a: { str: 5, def: 3, spd: -4, sta: -2, wgt: 20 }, build: 'fat' },
  tall: { a: { cat: 5, def: 2, agi: -3, spd: -1, hgt: 3, wgt: 5 }, build: 'tall' },
  short: { a: { agi: 5, spd: 3, cat: -3, thr: -1, hgt: -3, wgt: -5 }, build: 'short' },
  beanpole: { a: { cat: 7, spd: 4, str: -4, def: -1, hgt: 4, wgt: -15 }, build: 'lanky' },
  stout: { a: { str: 7, def: 5, sta: 2, spd: -3, agi: -2, hgt: -2, wgt: 20 }, build: 'stubby' },
  giant: { a: { str: 8, def: 6, cat: 3, spd: -4, agi: -3, hgt: 4, wgt: 25 }, build: 'tank' },
  pocket: { a: { agi: 8, spd: 6, cat: 2, str: -4, hgt: -3, wgt: -15 }, build: 'short' },
};
// Card types without an entry above fall back to their rarity.
const RARITY_FX = {
  common: { sta: 1, cat: 1, kick: -1 }, rare: { cat: 2, spd: 2, str: -1 }, epic: { cat: 3, spd: 3, acc: 2, str: -2 },
  legendary: { cat: 5, spd: 5, acc: 4, str: -2 }, mythic: { cat: 7, spd: 7, acc: 6, thr: 4, str: -1 },
  dark: { cat: 10, spd: 10, acc: 10, thr: 10, str: 10 }, doh: { cat: 12, spd: 12, acc: 12, thr: 12, str: 12 },
};
// Card sets: one small table per set (Base parallel numbers). The parallel scales them:
// [upside ×, downside ×, height/weight ×]. Rarer parallels get much more upside and less downside.
const PARALLEL_FX = { base: [1, 1, 1], silver: [1.6, 0.9, 1.25], gold: [2.2, 0.75, 1.5], prism: [2.9, 0.6, 1.75], black: [3.6, 0.45, 2] };
const SET_FX = {
  // School Days
  'picture-day': { a: { acc: 3, cat: 1, agi: -2 } }, // held still for the photo
  'hall-pass': { a: { spd: 3, agi: 1, def: -2 } },
  'gym-class': { a: { agi: 3, thr: 2, sta: 1, kick: -2 } }, // dodgeball champion
  'science-fair': { a: { acc: 3, kick: 2, str: -2 } },
  library: { a: { def: 2, acc: 2, spd: -2, sta: -1 } },
  'bus-ride': { a: { sta: 3, cat: 1, spd: -2 } }, // napped the whole ride
  // Spirit Week
  'pajama-day': { a: { sta: 3, agi: 1, spd: -3 } }, // slippers
  'crazy-hair': { a: { agi: 2, spd: 2, acc: -2, hgt: 2 } }, // the hair counts
  'twin-day': { a: { cat: 2, def: 2, agi: -2 } }, // trips over his twin
  'pep-rally': { a: { str: 2, sta: 2, spd: 1, acc: -2 } },
  homecoming: { a: { thr: 2, cat: 2, sta: -1, def: -1 } }, // up late at the dance
  'color-war': { a: { def: 3, str: 1, cat: -2 } },
  // Bowl Season
  halloween: { a: { agi: 3, def: 2, cat: -2 } },
  turkey: { a: { str: 3, sta: 1, spd: -2, wgt: 10 }, build: 'stocky' }, // seconds on everything
  christmas: { a: { cat: 3, sta: 1, agi: -2 } }, // great at catching presents
  spring: { a: { spd: 2, sta: 2, str: -2 } },
  super: { a: { thr: 2, acc: 2, cat: 2, sta: -2 } }, // big-game nerves
  'new-year': { a: { kick: 3, acc: 1, sta: -2 } }, // fireworks off the tee, stayed up till midnight
  // Wild World
  galaxy: { a: { thr: 3, kick: 2, acc: -2 } },
  ocean: { a: { sta: 3, agi: 1, spd: -2 } },
  jungle: { a: { str: 3, agi: 1, acc: -2 } },
  volcano: { a: { str: 2, spd: 2, sta: -3 } }, // erupts, then cools off
  arctic: { a: { acc: 3, def: 1, spd: -2 } }, // ice in his veins, and his legs
  desert: { a: { cat: 3, spd: 1, sta: -2, wgt: -5 } },
  // Art Class
  chalkboard: { a: { def: 2, acc: 2, spd: -2 } },
  blueprint: { a: { str: 2, def: 2, agi: -2, hgt: 1 } },
  comic: { a: { str: 3, spd: 1, acc: -2 } }, // KA-POW
  graffiti: { a: { agi: 3, spd: 1, def: -2 } },
  'stained-glass': { a: { acc: 3, cat: 1, str: -2 } }, // pretty, fragile
  origami: { a: { agi: 3, kick: 1, str: -2, wgt: -5 }, build: 'slim' }, // paper light
  // Arcade
  neon: { a: { spd: 3, cat: 1, sta: -2 } },
  'pixel-plus': { a: { spd: 2, kick: 2, agi: -2 } },
  'high-score': { a: { thr: 2, kick: 2, def: -2 } },
  circuit: { a: { acc: 2, agi: 2, sta: -2 } }, // battery drain
  hologram: { a: { agi: 3, def: 1, str: -2, wgt: -5 } }, // see-through
  vhs: { a: { def: 3, sta: 1, spd: -2 } }, // slow-motion replay
  // Weather Report
  thunder: { a: { spd: 3, agi: 1, cat: -2 } },
  'rainy-day': { a: { str: 3, def: 1, cat: -2, agi: -1 } }, // mud game, wet ball
  sunshine: { a: { sta: 2, spd: 2, cat: -2 } }, // sun in his eyes
  tornado: { a: { agi: 3, spd: 1, acc: -2 } }, // dizzy
  rainbow: { a: { thr: 2, kick: 2, str: -2 } }, // big arcs
  blizzard: { a: { str: 2, sta: 2, thr: -2 } }, // cold hands
  // Snack Attack
  cereal: { a: { sta: 3, str: 1, kick: -2 } }, // part of a winning breakfast
  nachos: { a: { cat: 3, str: 1, spd: -2, wgt: 10 } }, // cheesy, sticky fingers
  donut: { a: { agi: 3, cat: 1, sta: -2, wgt: 10 }, build: 'fat' }, // sugar rush, sugar crash
  'hot-sauce': { a: { spd: 3, str: 1, acc: -2 } }, // watery eyes
  popcorn: { a: { agi: 3, cat: 1, def: -2 } },
  smoothie: { a: { sta: 2, agi: 1, acc: 1, str: -2 } },
  // MFL Legends
  highlight: { a: { spd: 2, cat: 2, def: -2 } },
  'film-room': { a: { def: 3, acc: 1, spd: -2 } },
  playbook: { a: { acc: 2, thr: 2, agi: -2 } },
  captains: { a: { sta: 3, def: 1, kick: -2 } },
  'all-mfl': { a: { thr: 1, acc: 1, spd: 1, cat: 1, def: 1, kick: -2 } },
  'hall-of-fame': { a: { thr: 2, acc: 2, cat: 1, spd: -2, wgt: 5 } },
};

// ---------- perks ----------
// Every card type has a perk: one on-field quirk the games act out. Keyed by variant id, and by
// set id for set cards (all five parallels share the set's perk; the parallel makes it stronger).
// [id, name, what happens on the field, when it triggers]
const PERK_ROWS = [
  ['base', 'Try Hard', 'After a mistake he hustles to make up for it: a short burst of speed with a little dust cloud', 'the play after he drops a pass or misses a tackle'],
  ['team', 'Team Spirit', 'Sparks in his team colors jump to the nearest teammate, who gets a quick speed boost', 'every time he makes a catch or a block'],
  ['silver', 'Shiny Hands', 'His gloves glint and the ball sticks: that catch cannot be dropped', 'the first pass thrown his way on each drive'],
  ['action', 'Motion Blur', 'He leaves a speed streak and shoots forward in a quick burst', 'his first cut on each play'],
  ['spec-td', 'End Zone Magnet', 'He gets pulled toward the goal line: extra speed while running at the end zone', 'carrying the ball inside the 20-yard line'],
  ['spec-pass', 'Laser Arm', 'His throws fly flat and fast with no wobble and are harder to pick off', 'every pass longer than 15 yards'],
  ['spec-int', 'Sticky Gloves', 'He jumps the route and lunges at the ball, with a better chance to intercept', 'a pass thrown within 3 yards of him on defense'],
  ['spec-def', 'Steam Engine', 'He puffs steam and his first step off the line is extra quick', 'every snap on defense'],
  ['spec-play', 'Highlight Hunter', 'A star pops over his head and his diving catch range grows', 'contested and diving catches'],
  ['gold', 'Golden Spiral', 'His next throw or catch leaves a gold trail and lands right on target', 'the play after a completion he was part of'],
  ['holo', 'Afterimage', 'He leaves a shimmering copy of himself behind, and the nearest defender chases the copy for half a second', 'every juke'],
  ['spec', 'Signature Move', 'He does his own little spin and his specialty move works no matter what', 'the first time his specialty comes up each game'],
  ['legend', 'Old Pro', 'He reads the play early and drifts toward where the ball is going before it is thrown', 'every pass play while he is on defense'],
  ['allstar', 'Showtime', 'He high-steps into open space and gets a big speed boost while nobody is near him', 'when no defender is within 5 yards of him'],
  ['clutch', 'Ice Cold', 'He gets a frosty blue glow and a boost to speed and accuracy', 'the last 2 minutes of a half, or when his team is behind'],
  ['icon', 'Spotlight', 'A spotlight follows him and the first defender who tries to tackle him freezes for a beat, starstruck', 'the first tackle attempt on him each play'],
  ['bench', 'Nap Time', 'He dozes off for a beat (Zzz bubble) after a long play, then pops up with fresh legs', 'after any play of 20 yards or more'],
  ['trophy', 'Everybody Wins', 'Confetti bursts and the whole team gets a small speed boost on the next play', 'every first down his team gains'],
  ['pizza', 'Extra Cheese', 'One tackler is not enough: it takes two defenders to bring him down', 'every time a single defender tries to tackle him'],
  ['cutout', 'Flat Out', 'A big hit folds him flat like cardboard, then he pops back up with a boing', 'every time he is hit while blocking'],
  ['bobble', 'Wobble Head', 'His big head spots lobs early (bigger catch window), but after a hit he wobbles, dizzy, for a beat', 'lob passes his way, and after he is hit'],
  ['pixel', '8-Bit Runner', 'He runs in blocky 8-direction moves, and straight-line runs get extra fast', 'after carrying the ball in a straight line for 1 second'],
  ['snow', 'Snow Day', 'Snow puffs off his cleats and defenders near him slip', 'when he cuts with a defender within 2 yards'],
  ['upside', 'Topsy-Turvy', 'He cartwheels upside down right over a defender diving at his legs', 'when a defender dives at him low'],
  ['duck', 'Squeaky', 'He squeaks and bounces off the first tackle like a rubber toy', 'the first tackle attempt on him each play'],
  ['built', 'Bulldozer', 'Defenders he blocks get shoved back 2 yards and fall over', 'every block he makes'],
  ['throwback', 'Leather Helmet', 'Old-school style: he lowers his shoulder and always falls forward for an extra yard', 'every time he is tackled with the ball'],
  ['spooky', 'Boo!', 'He turns see-through for a moment and the closest defender jumps back, scared', 'once a play, when a defender gets within 2 yards'],
  ['glitch', 'Lag Spike', 'He teleports a yard sideways in a burst of glitchy pixels', 'every juke (once every few seconds)'],
  ['goat', 'GOAT Aura', 'A golden aura (and a little bleat) lifts every teammate within 5 yards by +2 in all skills', 'always, while he is on the field'],
  ['mythic', 'Slow-Mo', 'Time slows down for a beat so he can pick the perfect lane', 'his first cut on each drive'],
  ['dark', 'Gravity Well', 'Passes thrown near him bend toward him, and defenders right next to him move in slow motion', 'any pass within 5 yards, and always within 2 yards'],
  ['doh', 'Big Doh Mi', 'Coins rain down and the scoreboard flashes +100', 'every time he touches the ball'],
  ['skinny', 'Sideways', 'He turns sideways and slips through gaps too small for anyone else', 'running between two players who are close together'],
  ['heavy', 'Earthquake', 'The ground shakes when he lands a hit and nearby players stumble', 'every tackle or block he makes'],
  ['tall', 'Sky Grab', 'He reaches over defenders to snag high passes no one else can get', 'passes thrown above head height'],
  ['short', 'Duck Under', 'High tackles sail right over his head', 'a defender tackles high at him'],
  ['beanpole', 'Noodle Arms', 'His arms stretch like noodles and his diving catch reaches an extra yard', 'every diving catch'],
  ['stout', 'Fire Hydrant', 'He cannot be pushed off his spot while blocking', 'when a defender bull-rushes him'],
  ['giant', 'Eclipse', 'His huge shadow blocks the view: passes thrown over him get batted down more often', 'a pass thrown within 3 yards of him'],
  ['pocket', 'Launch Pad', 'A little rocket puff and he goes from standing still to full speed instantly', 'his first step after stopping or cutting'],
  // Sets
  ['picture-day', 'Say Cheese', 'A camera flash pops and blinds the closest defender for half a second', 'every catch he makes'],
  ['hall-pass', 'Hall Pass', 'He flashes a hall pass and walks right through a tackle', 'the first tackle on him each game'],
  ['gym-class', 'Dodgeball', 'He automatically sidesteps a diving tackle', 'the first diving tackle at him each drive'],
  ['science-fair', 'Calculated', 'A dotted arc shows his throw or kick, and it lands exactly on target', 'his first throw or kick each half'],
  ['library', 'Quiet Feet', 'His footsteps make no sound: defenders do not turn to chase him until he is 2 yards past', 'running past a defender'],
  ['bus-ride', 'Late Bus', 'He is a beat late out of the huddle, but after a rest one defender cannot tackle him', 'the first play after he sits out or after a timeout'],
  ['pajama-day', 'Sleepwalker', 'He yawns at the snap (a slow start), then glides in fuzzy slippers that never slip', 'every snap'],
  ['crazy-hair', 'Hair Tangle', 'Whoever tackles him gets tangled in his wild hair and is slow to get up', 'after every tackle on him'],
  ['twin-day', 'Seeing Double', 'A twin copy runs a mirror route and the defense has to guess which one is real', 'the first 2 seconds of each pass play'],
  ['pep-rally', 'Megaphone', 'He yells the snap count and his line gets a jump off the snap', 'every 3rd and 4th down'],
  ['homecoming', 'Slow Dance', 'He moves in slow motion, but every catch he makes is perfect', 'the first drive of the second half'],
  ['color-war', 'Paint Splat', 'Each tackle leaves a paint splat, and the next runner over that spot slips', 'every tackle he makes'],
  ['halloween', 'Trick or Treat', 'A coin flip: treat, he slips out of the tackle; trick, he trips over his own cape', 'the first tackle attempt on him each drive'],
  ['turkey', 'Drumstick Stiff-Arm', 'His stiff-arm (drumstick in hand) shoves a tackler 2 yards away', 'one defender squares up in front of him'],
  ['christmas', 'Present Drop', 'A gift box pops out when he goes down, and the next pass to him gets a bigger catch window', 'every time he is tackled'],
  ['spring', 'Spring Step', 'He boings over players lying on the ground instead of tripping', 'running over a fallen player'],
  ['super', 'Big Game', 'His jersey sparkles and all his ups count double', 'the second half of a game within 7 points'],
  ['new-year', 'Countdown', 'Fireworks go off behind him and he gets a burst of speed', 'the last 10 seconds of each half'],
  ['galaxy', 'Zero Gravity', 'His jumps go higher and he floats a moment longer, like on the moon', 'every jump or leaping catch'],
  ['ocean', 'Riptide', 'Teammates running right behind him get pulled along in his wake', 'a teammate within 2 yards behind him'],
  ['jungle', 'Vine Swing', 'He swings on a vine back in bounds instead of stepping out', 'a catch or run right at the sideline'],
  ['volcano', 'Eruption', 'He explodes off the snap with a huge burst, then cools off and slows down', 'every snap'],
  ['arctic', 'Ice Trail', 'He leaves an icy trail, and anyone chasing right behind him slides', 'when a defender chases him from behind'],
  ['desert', 'Sandstorm', 'A dust cloud kicks up when he cuts, and the defender behind him loses sight of him for a beat', 'every hard cut'],
  ['chalkboard', 'Draw It Up', 'A chalk line draws his route, and the throw to him on that route is perfect', 'the first pass play of each drive'],
  ['blueprint', 'By The Plans', 'He and the closest lineman lock into a double-team block', 'every run play'],
  ['comic', 'KA-POW', 'A comic word bubble pops and the ball carrier is knocked back a yard', 'every tackle he makes'],
  ['graffiti', 'Tagged', 'He tags the defender who missed him with paint, and that defender is slower for the rest of the play', 'a defender misses a tackle on him'],
  ['stained-glass', 'Glass Act', 'He shines in open space (bigger catch window), but a big hit cracks him and he is slow the next play', 'in open space, and after a big hit'],
  ['origami', 'Paper Airplane', 'He folds into a paper plane and glides an extra yard on dives', 'every dive'],
  ['neon', 'Glow Up', 'A neon trail lights him up and the quarterback looks his way first', 'when he is open on a pass play'],
  ['pixel-plus', 'Extra Life', 'A 1UP pops and the fumble or drop is erased', 'the first fumble or drop each game'],
  ['high-score', 'Combo Meter', 'A combo counter climbs with each catch; at 3x he gets a speed boost', 'catches in a row on the same drive'],
  ['circuit', 'Short Circuit', 'Sparks fly: the tackler gets zapped back a step, but he freezes for a beat too', 'every big hit on him'],
  ['hologram', 'Flicker', 'He flickers out of sight at the snap and his defender loses him', 'the snap of every pass play'],
  ['vhs', 'Rewind', 'The tape rewinds and he ends up back at the line of scrimmage instead of losing yards', 'the first time each game he is tackled behind the line'],
  ['thunder', 'Thunderclap', 'Lightning strikes with a boom and defenders within 3 yards flinch', 'when he reaches top speed'],
  ['rainy-day', 'Mudder', 'He never slows down in the mud and shoves the pile forward a yard', 'short-yardage and goal-line runs'],
  ['sunshine', 'Solar Power', 'He soaks up sunshine and gets his energy back twice as fast', 'plays he is not part of'],
  ['tornado', 'Spin Cycle', 'His spin move carries him farther and knocks a nearby defender off balance', 'every spin move'],
  ['rainbow', 'Rainbow Arc', 'His lobs and kicks fly in a rainbow arc and drop right over defenders', 'every lob pass and kick'],
  ['blizzard', 'Whiteout', 'A snow flurry swirls around him and passes thrown into his area wobble', 'passes thrown near him while he is on defense'],
  ['cereal', 'Breakfast Boost', 'Fueled by breakfast: extra speed and energy', 'the first quarter only'],
  ['nachos', 'Cheesy Grip', 'The ball sticks to his cheesy fingers and never drops, but he is slow to hand it off', 'every pass he gets his hands on'],
  ['donut', 'Sugar Rush', 'Sprinkles fly and he gets a big speed burst', 'every third time he touches the ball'],
  ['hot-sauce', 'Hot Feet', 'His feet heat up and he runs faster the longer he carries the ball', 'after 3 seconds with the ball'],
  ['popcorn', 'Kernel Pop', 'He pops straight up and lands a yard to the side, sometimes away from the tackle', 'one in three hits on him'],
  ['smoothie', 'Smooth Moves', 'He glides through cuts without losing any speed', 'every change of direction'],
  ['highlight', 'Instant Replay', 'A slow-motion replay frame plays and he gains +1 agility for the rest of the game (up to +3)', 'every play of 15 yards or more'],
  ['film-room', 'Studied Tape', 'He has seen this one before and jumps the play', 'when the other team runs the same play twice in a row'],
  ['playbook', 'Audible', 'He shifts to the most open spot before the snap', 'once each drive, before the snap'],
  ['captains', "Captain's Call", 'He rallies the team and everyone gets their energy back', 'right after his team loses the ball'],
  ['all-mfl', 'Swiss Army', 'A role badge shows over him and he gets +2 to the main skill of whatever spot he lines up at', 'every play'],
  ['hall-of-fame', 'Bronze Statue', 'He freezes in a bronze statue pose and his teammates get +1 to everything next drive', 'right after he scores'],
];
const PERKS = Object.fromEntries(PERK_ROWS.map(([id, name, text, when]) => [id, { id, name, text, when }]));

// ---------- rarity tiers ----------
// Each rarity adds its own boost on top of the card's own effect, and sets the perk level
// (higher level = the perk is stronger or happens more often). `top` = bonus to the card's best
// skills in order; `rest` = bonus to every other skill; `shrink` = how many downsides get 1 smaller
// (never smaller than −1, so a card with a downside keeps it).
const TIERS = {
  common: { name: 'Rookie', lv: 1, top: [], rest: 0, shrink: 0, text: 'No extra boost. Perk at level 1.' },
  rare: { name: 'Polished', lv: 2, top: [1], rest: 0, shrink: 0, text: '+1 to the best skill. Perk level 2 (25% stronger or more often).' },
  epic: { name: 'Golden', lv: 3, top: [2, 1], rest: 0, shrink: 0, text: '+2 to the best skill, +1 to the next. Perk level 3 (50% stronger or more often).' },
  legendary: { name: 'Legendary', lv: 4, top: [3, 2, 1], rest: 0, shrink: 1, text: '+3 / +2 / +1 to the top three skills, the biggest downside shrinks by 1. Perk level 4 (75% stronger).' },
  mythic: { name: 'Mythical', lv: 5, top: [4, 3, 2], rest: 0, shrink: 99, text: '+4 / +3 / +2 to the top three skills, every downside shrinks by 1. Perk level 5 (twice as strong).' },
  dark: { name: 'Event Horizon', lv: 6, top: [5, 4, 3], rest: 1, shrink: 99, text: '+5 / +4 / +3 to the top three skills, +1 to every other skill. Perk level 6: always on, no cooldowns.' },
  doh: { name: '101×', lv: 7, top: [], rest: 0, shrink: 0, text: 'Every point he scores comes with 100 more (101× scoring). Perk level 7: maxed out.' },
};
const tierOf = (rarity) => ({ id: rarity, rarity: (RARITIES[rarity] || RARITIES.common).name, ...(TIERS[rarity] || TIERS.common) });
// A card's perk: { id, name, text, when, lv }. Set cards use their set's perk.
function perkOf(card) {
  if (typeof card === 'string') card = { variant: card.includes(':') ? card.slice(card.indexOf(':') + 1) : card };
  if (!card) return null;
  const v = VARIANT_MAP.get(card.variant || card.id || '') || {};
  const set = card.set || v.set || null, rarity = card.rarity || v.rarity || 'common';
  const P = PERKS[set || card.variant || v.id];
  return P ? { ...P, lv: (TIERS[rarity] || TIERS.common).lv } : null;
}
const isBodyAttr = (k) => k === 'hgt' || k === 'wgt';
function scaleFx(a, up, down, body = 1) {
  const out = {};
  for (const [k, v] of Object.entries(a)) {
    if (isBodyAttr(k)) out[k] = Math.sign(v) * Math.max(k === 'wgt' ? 5 : 1, Math.round(Math.abs(v) * body));
    else out[k] = v > 0 ? Math.max(1, Math.round(v * up)) : Math.min(-1, Math.round(v * down));
  }
  return out;
}
// What a card does to its player in the games:
// { attr: { thr, acc, spd, agi, sta, str, cat, def, kick, hgt, wgt }, build, fx: { variant, set, par, rarity, spec } }.
// Takes a card from cardInfo (or a VARIANTS entry, or a card / variant id).
function cardEffects(card) {
  const attr = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0]));
  if (typeof card === 'string') card = { variant: card.includes(':') ? card.slice(card.indexOf(':') + 1) : card };
  if (!card) return { attr, build: null, fx: null };
  const variant = card.variant || card.id || '';
  const v = VARIANT_MAP.get(variant) || {};
  const set = card.set || v.set || null, par = card.par || v.par || null, rarity = card.rarity || v.rarity || 'common';
  const spec = card.spec || (v.spec && v.spec !== 'own' ? v.spec : null);
  const one = !!(card.one ?? v.one) || rarity === 'doh';
  let a, build = null;
  if (set && SET_FX[set]) {
    const [up, down, body] = PARALLEL_FX[par] || PARALLEL_FX.base;
    a = scaleFx(SET_FX[set].a, up, down, body);
    build = SET_FX[set].build || null;
  } else if (VARIANT_FX[variant]) {
    const T = VARIANT_FX[variant];
    a = T.spec ? scaleFx(SPEC_FX[spec] || SPEC_FX.play, T.spec[0], T.spec[1]) : T.a;
    build = T.build || null;
  } else a = RARITY_FX[rarity] || RARITY_FX.common;
  for (const [k, n] of Object.entries(a)) attr[k] = Math.round(n);
  // The rarity tier's own boost, on top of the card's effect.
  const T = TIERS[rarity] || TIERS.common;
  const skills = ATTR_KEYS.filter((k) => !isBodyAttr(k));
  const ranked = skills.slice().sort((x, y) => attr[y] - attr[x] || skills.indexOf(x) - skills.indexOf(y));
  T.top.forEach((n, i) => { attr[ranked[i]] += n; });
  if (T.rest) for (const k of ranked.slice(T.top.length)) attr[k] += T.rest;
  if (T.shrink) {
    const downs = skills.filter((k) => attr[k] < -1).sort((x, y) => attr[x] - attr[y]).slice(0, T.shrink);
    for (const k of downs) attr[k] += 1;
  }
  for (const k of ATTR_KEYS) {
    const cap = FX_CAP[k] || FX_CAP_SKILL;
    attr[k] = Math.max(-cap, Math.min(cap, attr[k]));
  }
  // Only 1 of 1 cards may be all upside.
  if (!one && !skills.some((k) => attr[k] < 0)) attr.kick -= 1;
  const perk = perkOf({ variant, set, rarity });
  return { attr, build, fx: { variant, set, par, rarity, spec, perk: perk ? perk.id : null, perkLv: T.lv } };
}
// Short summary for the back of a card: "+4 STR, +3 STA, −3 SPD, −2 AGI, +15 lb · Fat build".
// Skills first (ups, then downs, biggest first), then height and weight.
function effectText(card, opts = {}) {
  const e = card && card.attr && 'build' in card ? card : cardEffects(card);
  const parts = ATTR_KEYS.filter((k) => e.attr[k]).map((k) => ({ k, v: e.attr[k] }))
    .sort((x, y) => isBodyAttr(x.k) - isBodyAttr(y.k) || (isBodyAttr(x.k) ? 0 : (y.v > 0) - (x.v > 0) || Math.abs(y.v) - Math.abs(x.v)));
  const txt = parts.map(({ k, v }) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${k === 'hgt' ? 'in' : k === 'wgt' ? 'lb' : ATTR_SHORT[k]}`).join(', ');
  const b = e.build ? `${BUILD_LABELS[e.build] || e.build} build` : '';
  const out = [txt, b];
  // { perk: true } adds the perk and the rarity tier: "… · Perk: Squeaky · Golden tier".
  if (opts.perk && card) {
    const P = perkOf(e.fx ? { variant: e.fx.variant, set: e.fx.set, rarity: e.fx.rarity } : card);
    if (P) out.push(`Perk: ${P.name}`);
    const r = e.fx ? e.fx.rarity : card.rarity;
    if (r) out.push(`${tierOf(r).name} tier`);
  }
  return out.filter(Boolean).join(' · ');
}

// Fantasy points for one player in one game.
const SCORING = { td: 10, pass: 7, int: 6, catch: 3, sack: 4, pbu: 2, flag: 1, big: 3, picked: -5, mvp: 3, win: 2 };
const SCORING_LABEL = { flat: 'Card bonus', td: 'Touchdown catch or run', pass: 'TD pass', int: 'Interception', catch: 'Notable catch', sack: 'Sack', pbu: 'Pass breakup', flag: 'Flag pull', big: 'Notable play', picked: 'Threw an INT', mvp: 'Game MVP', win: 'Team win' };
const STAT_CAT = { TD: 'td', INT: 'int', CATCH: 'catch', SACK: 'sack', PBU: 'pbu', FLAG: 'flag', PLAY: 'big' };

// The Lineup: 11 cards of different players, one per position. Modern Bowl uses the first 8;
// 3D Blitz uses all 11 (UTIL1, UTIL2 and OL1-3 are its five offensive linemen).
const LINEUP_POS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'UTIL1', 'UTIL2', 'OL1', 'OL2', 'OL3'];
const LINEUP_SIZE = LINEUP_POS.length;
const isSpec = (...ks) => (c) => !!c.spec && ks.includes(c.spec);
// Pack types. `pool` limits which cards can drop, `min` guarantees one card of at
// least that rarity, `boost` multiplies rarity weights, `free` packs are claimed.
// Prices follow each pack's odds: the average "chase value" of what it drops (about
// Base 300, Silver 700, Gold 2,000, Legend 20,000, Mythic 100,000, Dark Matter 500,000,
// a 1 of 1 counting double) times about 1.2 sets the price, rounded onto a ladder:
//   everyday packs 1,000 to 7,000 · bigger packs with guarantees 8,000 to 25,000 ·
//   Legend-or-better packs in the tens of thousands · Dark Matter, 1 of 1 hunts and
//   Prism/Black set packs 100,000 to 400,000 (the 1 of 1 hunts and Prism Chase sit at the
//   100,000 floor of that tier). Day deals (Monday, Weekend, Sleeper) run a little under.
//   Bundles are about 12% off their packs. Paid packs are the same for everyone, and a
//   purchase keeps the price it was bought at (user.packs[].cost).
const PACKS = {
  starter: { name: 'Starter Pack', cards: LINEUP_SIZE, cost: 0, free: 'once', group: 'free', desc: `${LINEUP_SIZE} Base cards of different players: a full Lineup. Free, once.` },
  daily: { name: 'Daily Pack', cards: 1, cost: 0, free: 'daily', group: 'free', desc: 'One free card every day.' },
  gameday: { name: 'Game Day Pack', cards: 2, cost: 0, free: 'gameday', group: 'free', desc: 'Free on every day there\'s an MFL game.' },
  weekly: { name: 'Weekly Pack', cards: 3, cost: 0, free: 'weekly', group: 'free', min: 'rare', desc: '3 cards free every week, Silver or better guaranteed.' },
  prize: { name: 'Champion Pack', cards: 5, cost: 0, free: 'prize', group: 'free', min: 'epic', desc: 'Premium pack for the Picker of the Week.' },
  arcade: { name: 'Arcade Champ Pack', cards: 3, cost: 0, free: 'arcade', group: 'free', min: 'epic', desc: 'Win 3 Arcade games in a day to unlock it.' },
  milestone: { name: 'Collector Pack', cards: 4, cost: 0, free: 'milestone', group: 'free', min: 'epic', desc: 'Reward for collecting more different cards.' },
  standard: { name: 'Standard Pack', cards: 3, cost: 4000, group: 'core', desc: '3 cards. Any rarity can drop.' },
  value: { name: 'Value Pack', cards: 6, cost: 6500, group: 'core', desc: '6 cards for the price of 5.' },
  premium: { name: 'Premium Pack', cards: 5, cost: 11000, group: 'core', min: 'epic', desc: '5 cards, with at least one Gold or better guaranteed.' },
  mega: { name: 'Mega Pack', cards: 12, cost: 22500, group: 'core', min: 'epic', mins: 2, desc: '12 cards with two Gold or better guaranteed.' },
  offense: { name: 'Offense Pack', cards: 3, cost: 3750, group: 'theme', pool: isSpec('td', 'pass', 'play'), desc: 'Only Touchdown Machine, Gunslinger and Playmaker cards.' },
  defense: { name: 'Defense Pack', cards: 3, cost: 3750, group: 'theme', pool: isSpec('int', 'def'), desc: 'Only Interception Specialist and Pass Rusher cards.' },
  specialist: { name: 'Specialist Pack', cards: 4, cost: 8500, group: 'theme', pool: (c) => !!c.spec, min: 'epic', desc: '4 specialist cards with a Signature or better guaranteed.' },
  shine: { name: 'Shine Pack', cards: 3, cost: 8500, group: 'theme', pool: (c) => ['action', 'holo', 'allstar', 'icon', 'dark'].includes(c.variant), desc: 'Only Action Shot, Holo, All-Star, Icon and Dark Matter cards.' },
  leaders: { name: 'Captains Pack', cards: 3, cost: 4000, group: 'theme', pool: (c) => ['C', 'TR'].includes(c.p.tag), desc: 'Only captains and team reps.' },
  draft: { name: 'Draft Class Pack', cards: 3, cost: 4000, group: 'theme', pool: (c) => /^Rd/.test(c.p.tag || ''), desc: 'Only drafted players, any round.' },
  sleeper: { name: 'Sleeper Pack', cards: 4, cost: 4000, group: 'theme', pool: (c) => c.p.tag === 'FA' || /Rd [3-9]/.test(c.p.tag || ''), desc: 'Free agents and late-round picks. Cheap, and sneaky good.' },
  lunch: { name: 'Lunch Money Pack', cards: 2, cost: 2500, group: 'core', desc: '2 cards for your lunch money.' },
  mystery: { name: 'Mystery Box', cards: 4, cost: 6500, group: 'core', mystery: [1, 9], desc: 'Could be 1 card. Could be 9. Nobody knows.' },
  meme: { name: 'Meme Pack', cards: 3, cost: 2000, group: 'fun', pool: (c) => ['bench', 'trophy', 'pizza', 'cutout', 'bobble', 'upside', 'duck', 'built'].includes(c.variant), desc: 'Benchwarmers, trophies, rubber duckies and other weird ones.' },
  bitpack: { name: '8-Bit Pack', cards: 3, cost: 5500, group: 'fun', pool: (c) => ['pixel', 'throwback', 'glitch'].includes(c.variant), desc: '8-Bit, Throwback and Glitch cards. Built for Modern Bowl.' },
  spooky: { name: 'Spooky Pack', cards: 3, cost: 7000, group: 'fun', pool: (c) => ['spooky', 'glitch', 'snow'].includes(c.variant), min: 'epic', desc: 'Spooky cards, with a Gold or better guaranteed.' },
  cafeteria: { name: 'Cafeteria Pack', cards: 4, cost: 1500, group: 'fun', pool: (c) => ['pizza', 'trophy', 'bench', 'cutout', 'base', 'team'].includes(c.variant), desc: 'Pizza Friday and friends. Cheap and cheerful.' },
  bobble: { name: 'Bobblehead Box', cards: 2, cost: 1750, group: 'fun', pool: (c) => c.variant === 'bobble', desc: 'Two bobbleheads. Nod nod.' },
  snowday: { name: 'Snow Day Pack', cards: 3, cost: 3750, group: 'fun', pool: (c) => ['snow', 'upside', 'throwback'].includes(c.variant), desc: 'Snow Day, Upside Down and Throwback cards.' },
  bodyshop: { name: 'Body Shop Pack', cards: 3, cost: 3750, group: 'fun', pool: (c) => BODY_TYPES.includes(c.variant), desc: 'Body-type cards: Skinny, Heavyweight, Tall Order, Short King, Beanpole, Stout, Giant and Pocket Rocket. They change how tall and heavy your players are in the Arcade.' },
  goat: { name: 'GOAT Hunt', cards: 1, cost: 100000, group: 'chase', boost: { common: 0, rare: 0, epic: 0, legendary: 1, mythic: 2 }, pool: (c) => ['goat', 'glitch', 'icon', 'mythic', 'allstar', 'legend'].includes(c.variant), desc: 'One Legend-or-better card with a real shot at The GOAT 1/1.' },
  elite: { name: 'Elite Pack', cards: 3, cost: 60000, group: 'chase', min: 'legendary', desc: '3 cards with a Legend or better guaranteed.' },
  hunt: { name: 'Mythic Hunt', cards: 1, cost: 100000, group: 'chase', boost: { common: 0, rare: 0, mythic: 15, dark: 15 }, desc: 'One Gold-or-better card with 15× the usual Mythic and Dark Matter drop rate.' },
  void: { name: 'Dark Matter Pack', cards: 1, cost: 400000, group: 'chase', boost: { common: 0, rare: 0, epic: 0, legendary: 1, mythic: 6, dark: 30 }, desc: 'One Legend or better. About a 1 in 3 shot at Dark Matter.' },
};
// Set packs: one per series, plus packs across every set.
const SET_COLORS = { school: ['#0369a1', '#0c2133'], spirit: ['#be185d', '#2a0717'], bowls: ['#b45309', '#1c1105'], wild: ['#4338ca', '#0b0a24'], art: ['#0f766e', '#04201d'], arcade: ['#7e22ce', '#13041f'], weather: ['#475569', '#0b1220'], snacks: ['#dc2626', '#2a0606'], legends: ['#a16207', '#1a1203'] };
for (const [series, seriesName, sets] of SERIES) {
  PACKS['series-' + series] = { name: `${seriesName} Pack`, cards: 4, cost: 4000, group: 'sets', sets: true, colors: SET_COLORS[series], pool: (c) => SET_MAP.get(c.set)?.series === series, desc: `4 cards from the ${seriesName} sets: ${sets.map((x) => x[1]).join(', ')}.` };
}
Object.assign(PACKS, {
  'set-hunter': { name: 'Set Hunter Pack', cards: 6, cost: 6000, group: 'sets', sets: true, colors: ['#0e7490', '#05161c'], desc: '6 cards from any of the 54 card sets.' },
  'set-gold': { name: 'Golden Ticket', cards: 3, cost: 11000, group: 'sets', sets: true, min: 'epic', mins: 2, colors: ['#ca8a04', '#1f1503'], desc: '3 set cards with two Gold or better guaranteed.' },
  'set-prism': { name: 'Prism Chase', cards: 1, cost: 100000, group: 'sets', sets: true, boost: { common: 0, rare: 0, epic: 0, legendary: 1, mythic: 4 }, colors: ['#db2777', '#1e1b4b'], desc: 'One Prism or Black set card. About 1 in 4 is Black.' },
  'set-black': { name: 'Black Label', cards: 1, cost: 125000, group: 'sets', sets: true, pool: (c) => c.par === 'black', colors: ['#18181b', '#000000'], desc: 'One guaranteed Black parallel from any set.' },
});

// ---------- more packs ----------
// Extra pack features, handled by packInfo and openPack:
//   floor: every card is at least this rarity      mixed: classic and set cards can both drop
//   choose: show this many cards, the opener keeps `cards` of them
//   pairs: this many pairs, each one player in two different versions
//   bundle: [[type, count], ...] several packs in one (cards and list price are added up below)
//   rotate: on sale only some weekdays ({ days }), months ({ months }) or weeks ({ weeks, phase })
//   flash: today's deal on another pack, cheaper every few hours; limit: 'day' = one per day
//   live(db, ctx, P): fields worked out when shown or opened (rival team, last game's scorers...)
//   art: { c: [color1, color2], e: emoji, pat: pattern, foil } draws the pack in the shop
//   inside: what the pool holds, for the shop's "what's inside" panel
const NEW_PACK = '2026-11-02';
const inVariants = (...ids) => (c) => ids.includes(c.variant);
const inSets = (...ids) => (c) => ids.includes(c.set);
const inSeries = (...ids) => (c) => ids.includes(SET_MAP.get(c.set)?.series);
const atPos = (pos) => (db) => ({ pool: (c) => rolePos(db, c.t, c.p) === pos });
const rotating = (db, ctx, P) => rotation(P.rotate, nowOf(ctx));
const PATTERNS = ['stripes', 'dots', 'grid', 'zig', 'check', 'rays', 'stars', 'waves', 'diamond', 'confetti'];
Object.assign(PACKS, {
  // Core
  rookie: { name: 'Rookie Rack', cards: 1, cost: 1000, group: 'core', added: NEW_PACK, art: { c: ['#64748b', '#0f172a'], e: '🧢', pat: 'dots' }, desc: 'One card, any rarity. The cheapest way into the shop.' },
  'silver-stack': { name: 'Silver Stack', cards: 5, cost: 15000, group: 'core', floor: 'rare', added: NEW_PACK, art: { c: ['#cbd5e1', '#1e293b'], e: '🥈', pat: 'stripes', foil: 'silver' }, desc: '5 cards and every one is Silver or better.' },
  'mystery-mega': { name: 'Mystery Mega', cards: 12, cost: 15000, group: 'core', mixed: true, mystery: [5, 20], added: NEW_PACK, art: { c: ['#7c3aed', '#14052b'], e: '🎁', pat: 'confetti', foil: 'holo' }, desc: 'Somewhere between 5 and 20 cards, classic and set cards mixed together.' },
  // Themes: positions, the other team, last game's scorers
  'pos-qb': { name: 'QB Room', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: atPos('QB'), inside: 'Quarterbacks: a saved QB position, or each team\'s top passer.', art: { c: ['#b91c1c', '#1f0505'], e: '🎯', pat: 'rays' }, desc: '3 quarterback cards. Your QB throws in the games.' },
  'pos-rb': { name: 'Backfield Pack', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: atPos('RB'), inside: 'Running backs: a saved RB position, or each team\'s top scorer after the QB.', art: { c: ['#ea580c', '#260c02'], e: '💨', pat: 'zig' }, desc: '3 running back cards. Speed and strength up the middle.' },
  'pos-wr': { name: 'Wideout Pack', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: atPos('WR'), inside: 'Wide receivers: a saved WR position, or each team\'s next three scorers.', art: { c: ['#0284c7', '#03192b'], e: '🙌', pat: 'waves' }, desc: '3 wide receiver cards. Hands, speed and big plays.' },
  'pos-te': { name: 'Tight End Pack', cards: 2, cost: 2500, group: 'theme', added: NEW_PACK, live: atPos('TE'), inside: 'Tight ends: a saved TE position, or one more pass catcher per team.', art: { c: ['#0d9488', '#03201d'], e: '🧤', pat: 'grid' }, desc: '2 tight end cards. Half blocker, half receiver.' },
  'pos-line': { name: 'Trenches Pack', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: atPos('OL'), inside: 'Linemen and utility players: everyone who is not a QB, RB, WR or TE.', art: { c: ['#57534e', '#0c0a09'], e: '🛡️', pat: 'check' }, desc: '3 linemen and utility players. They block for everyone else.' },
  rival: { name: 'Rival Pack', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: (db, ctx) => rivalPack(db, ctx), art: { c: ['#dc2626', '#1e1b4b'], e: '⚔️', pat: 'diamond' }, desc: '3 cards from the other MFL team: the one your collection is up against.' },
  'hot-hand': { name: 'Hot Hand', cards: 3, cost: 4000, group: 'theme', added: NEW_PACK, live: (db) => hotHandPack(db), art: { c: ['#f97316', '#3b0a02'], e: '🔥', pat: 'rays', foil: 'gold' }, desc: '3 cards of players who scored in the latest final game.' },
  // Body Shop: the body-type card variants (skinny, heavy, tall, short, beanpole, stout, giant, pocket)
  'body-skinny': { name: 'Noodle Pack', cards: 3, cost: 3750, group: 'body', added: NEW_PACK, pool: inVariants('skinny', 'pocket', 'beanpole'), inside: 'Skinny, Pocket and Beanpole cards: slim builds.', art: { c: ['#facc15', '#422006'], e: '🍜', pat: 'waves' }, desc: 'Slim builds only: Skinny, Pocket and Beanpole cards.' },
  'body-beanpole': { name: 'Beanpole Box', cards: 2, cost: 4500, group: 'body', added: NEW_PACK, pool: inVariants('beanpole'), inside: 'Beanpole cards only: tall and slim.', art: { c: ['#4ade80', '#052e16'], e: '🌱', pat: 'stripes' }, desc: '2 Beanpole cards: tall and slim.' },
  'body-big': { name: 'Big Boy Pack', cards: 3, cost: 3750, group: 'body', added: NEW_PACK, pool: inVariants('heavy', 'stout', 'giant'), inside: 'Heavy, Stout and Giant cards: the big builds.', art: { c: ['#b45309', '#1c0a00'], e: '🍔', pat: 'check' }, desc: 'Heavy, Stout and Giant cards. Hard to move.' },
  'body-short': { name: 'Short Stack', cards: 3, cost: 3750, group: 'body', added: NEW_PACK, pool: inVariants('short', 'stout', 'pocket'), inside: 'Short, Stout and Pocket cards: low to the ground.', art: { c: ['#f59e0b', '#451a03'], e: '🥞', pat: 'dots' }, desc: 'Short, Stout and Pocket cards. Low to the ground.' },
  'body-tall': { name: 'Tall Order', cards: 3, cost: 3750, group: 'body', added: NEW_PACK, pool: inVariants('tall', 'beanpole', 'giant'), inside: 'Tall, Beanpole and Giant cards: the tall builds.', art: { c: ['#38bdf8', '#082f49'], e: '🦒', pat: 'stripes' }, desc: 'Tall, Beanpole and Giant cards. Over the top of everyone.' },
  'body-giant': { name: 'Giant Box', cards: 1, cost: 2500, group: 'body', added: NEW_PACK, pool: inVariants('giant'), inside: 'Giant cards only: tall and built like a tank.', art: { c: ['#a8a29e', '#1c1917'], e: '🗿', pat: 'grid', foil: 'silver' }, desc: 'One Giant card: tall and built like a tank.' },
  'body-mega': { name: 'Body Shop Mega', cards: 8, cost: 10000, group: 'body', added: NEW_PACK, pool: inVariants('skinny', 'heavy', 'tall', 'short', 'beanpole', 'stout', 'giant', 'pocket'), inside: 'Every body type: Skinny, Heavy, Tall, Short, Beanpole, Stout, Giant and Pocket.', art: { c: ['#ec4899', '#2e0a1f'], e: '🏋️', pat: 'confetti', foil: 'holo' }, desc: '8 cards of every body type in one big pack.' },
  // Sets: one-set minis are generated below
  'snack-single': { name: 'Snack Attack Single', cards: 1, cost: 1000, group: 'sets', sets: true, added: NEW_PACK, pool: inSeries('snacks'), inside: 'The Snack Attack series: Cereal Box, Nacho Day, Donut Run, Hot Sauce, Popcorn and Smoothie.', art: { c: ['#ef4444', '#2a0606'], e: '🍿', pat: 'dots' }, desc: 'One Snack Attack set card. A cheap snack.' },
  'double-feature': { name: 'Double Feature', cards: 4, cost: 4500, group: 'sets', sets: true, pairs: 2, added: NEW_PACK, art: { c: ['#e11d48', '#1c1917'], e: '🎞️', pat: 'grid' }, desc: '2 pairs of set cards: each pair is the same player in two versions.' },
  // Fun
  'pick-one': { name: 'Pick One', cards: 1, choose: 3, floor: 'rare', cost: 6500, group: 'fun', added: NEW_PACK, art: { c: ['#06b6d4', '#082f49'], e: '👆', pat: 'dots' }, desc: 'See 3 Silver-or-better cards and keep the one you want.' },
  'draft-day': { name: 'Draft Day', cards: 2, choose: 5, min: 'epic', cost: 10000, group: 'fun', added: NEW_PACK, art: { c: ['#2563eb', '#0b1437'], e: '📝', pat: 'grid' }, desc: 'See 5 cards (one Gold or better) and draft the 2 you like best.' },
  doubles: { name: 'Doubles', cards: 6, pairs: 3, cost: 8000, group: 'fun', added: NEW_PACK, art: { c: ['#a855f7', '#1e0b3a'], e: '👯', pat: 'diamond' }, desc: '3 pairs: each pair is one player in two different cards.' },
  'coin-flip': { name: 'Coin Flip', cards: 1, cost: 4500, group: 'fun', boost: { rare: 0, epic: 6.2, legendary: 6.2, mythic: 6.2, dark: 6.2 }, added: NEW_PACK, art: { c: ['#eab308', '#1f1503'], e: '🪙', pat: 'rays', foil: 'gold' }, desc: 'One card. Heads it\'s a Base card, tails it\'s Gold or better. 50/50.' },
  sparkle: { name: 'Sparkle Pack', cards: 3, cost: 3000, group: 'fun', mixed: true, added: NEW_PACK, pool: (c) => ['holo', 'action', 'allstar'].includes(c.variant) || ['hologram', 'rainbow', 'stained-glass'].includes(c.set) || c.par === 'prism', inside: 'Holo, Action Shot and All-Star cards, the Hologram, Rainbow and Stained Glass sets, and Prism parallels of any set.', art: { c: ['#f0abfc', '#3b0764'], e: '✨', pat: 'stars', foil: 'holo' }, desc: 'Only the shiny ones: Holo, Prism, Hologram and friends.' },
  'fire-ice': { name: 'Fire & Ice', cards: 4, cost: 4000, group: 'fun', mixed: true, added: NEW_PACK, pool: (c) => c.variant === 'snow' || ['volcano', 'hot-sauce', 'desert', 'sunshine', 'arctic', 'blizzard'].includes(c.set), inside: 'Fire: Volcano, Hot Sauce, Desert Storm and Sunshine. Ice: Arctic, Blizzard and Snow Day.', art: { c: ['#f97316', '#0ea5e9'], e: '🔥🧊', pat: 'zig' }, desc: 'Hot and cold cards in one pack: Volcano, Hot Sauce, Arctic, Blizzard, Snow Day.' },
  galaxy: { name: 'Galaxy Pack', cards: 3, cost: 3750, group: 'fun', mixed: true, added: NEW_PACK, pool: (c) => ['allstar', 'icon', 'dark'].includes(c.variant) || ['galaxy', 'neon', 'new-year'].includes(c.set), inside: 'All-Star, Icon and Dark Matter cards plus the Galaxy, Neon Nights and New Year\'s Bowl sets.', art: { c: ['#4338ca', '#020617'], e: '🌌', pat: 'stars' }, desc: 'Starry cards from deep space, with a tiny shot at Dark Matter.' },
  retro: { name: 'Retro Arcade', cards: 3, cost: 3000, group: 'fun', mixed: true, added: NEW_PACK, pool: (c) => ['pixel', 'throwback', 'glitch'].includes(c.variant) || ['pixel-plus', 'high-score', 'vhs', 'circuit'].includes(c.set), inside: '8-Bit, Throwback and Glitch cards plus the Pixel Pro, High Score, VHS Tape and Circuit Board sets.', art: { c: ['#22c55e', '#020617'], e: '🕹️', pat: 'grid' }, desc: 'Pixels, VHS tapes and glitches. Press start.' },
  // Chase
  'gold-rush': { name: 'Gold Rush', cards: 3, cost: 25000, group: 'chase', floor: 'epic', added: NEW_PACK, art: { c: ['#facc15', '#3f2a05'], e: '💰', pat: 'rays', foil: 'gold' }, desc: '3 cards and every one is Gold or better.' },
  vault: { name: 'The Vault', cards: 3, cost: 350000, group: 'chase', floor: 'legendary', boost: { mythic: 3, dark: 3 }, added: NEW_PACK, art: { c: ['#94a3b8', '#020617'], e: '🔐', pat: 'grid', foil: 'silver' }, desc: '3 cards, every one Legend or better, with triple the Mythic and Dark Matter odds.' },
  'black-box': { name: 'Black Label Box', cards: 3, cost: 350000, group: 'chase', sets: true, pool: (c) => c.par === 'black', added: NEW_PACK, art: { c: ['#27272a', '#000000'], e: '🎩', pat: 'diamond', foil: 'black' }, desc: '3 Black parallels from any set.' },
  // Bundles (cards and list price are added up below)
  'bundle-locker': { name: 'Locker Room', cost: 15500, group: 'bundle', bundle: [['premium', 1], ['standard', 1], ['lunch', 1]], added: NEW_PACK, art: { c: ['#16a34a', '#052e16'], e: '🎒', pat: 'check' }, desc: 'A Premium, a Standard and a Lunch Money pack: 10 cards for less.' },
  'bundle-season': { name: 'Season Ticket', cost: 33000, group: 'bundle', bundle: [['mega', 1], ['premium', 1], ['standard', 1]], added: NEW_PACK, art: { c: ['#2563eb', '#0b1437'], e: '🎟️', pat: 'stripes', foil: 'gold' }, desc: 'A Mega, a Premium and a Standard pack: 20 cards for the whole season.' },
  'bundle-sets': { name: 'Set Collector', cost: 18500, group: 'bundle', bundle: [['set-hunter', 1], ['set-gold', 1], ['series-bowls', 1]], added: NEW_PACK, art: { c: ['#0e7490', '#05161c'], e: '🗂️', pat: 'diamond' }, desc: 'Set Hunter, Golden Ticket and Bowl Season packs: 13 set cards.' },
  'bundle-body': { name: 'Body Shop Bundle', cost: 10000, group: 'bundle', bundle: [['body-big', 1], ['body-short', 1], ['body-tall', 1]], added: NEW_PACK, art: { c: ['#ec4899', '#2e0a1f'], e: '💪', pat: 'zig' }, desc: 'Big Boy, Short Stack and Tall Order packs: 9 body-type cards.' },
  // Limited: rotating packs and the daily Flash Sale
  flash: { name: 'Flash Sale', cards: 5, cost: 450, group: 'limited', limit: 'day', flash: { from: ['premium', 'shine', 'specialist', 'silver-stack', 'set-gold', 'sparkle', 'elite'], drop: 0.1, every: 4, steps: 5 }, live: (db, ctx, P) => flashDeal(db, ctx, P), added: NEW_PACK, art: { c: ['#fde047', '#7c2d12'], e: '⚡', pat: 'rays', foil: 'gold' }, desc: 'A different pack on sale every day. 10% off at midnight, 10% more every 4 hours.' },
  fnl: { name: 'Friday Night Lights', cards: 4, cost: 10000, group: 'limited', min: 'epic', rotate: { days: [5, 6] }, live: rotating, added: NEW_PACK, art: { c: ['#1e3a8a', '#020617'], e: '🏟️', pat: 'rays' }, desc: '4 cards with a Gold or better guaranteed. Fridays and Saturdays only.' },
  weekend: { name: 'Weekend Warrior', cards: 6, cost: 6000, group: 'limited', rotate: { days: [6, 0] }, live: rotating, added: NEW_PACK, art: { c: ['#16a34a', '#022c22'], e: '🛹', pat: 'zig' }, desc: '6 cards for less than a Value Pack. Saturdays and Sundays only.' },
  monday: { name: 'Monday Blues', cards: 3, cost: 3000, group: 'limited', min: 'rare', rotate: { days: [1] }, live: rotating, added: NEW_PACK, art: { c: ['#3b82f6', '#0b1437'], e: '😴', pat: 'waves' }, desc: '3 cards with a Silver or better, cheap. Mondays only.' },
  humpday: { name: 'Hump Day Holo', cards: 2, cost: 4000, group: 'limited', rotate: { days: [3] }, live: rotating, pool: inVariants('holo', 'action', 'allstar', 'icon'), inside: 'Holo, Action Shot, All-Star and Icon cards.', added: NEW_PACK, art: { c: ['#f472b6', '#4c0519'], e: '🐫', pat: 'stars', foil: 'holo' }, desc: '2 shiny cards: Holo, Action Shot, All-Star or Icon. Wednesdays only.' },
  'throwback-week': { name: 'Throwback Week', cards: 3, cost: 3000, group: 'limited', mixed: true, rotate: { weeks: 2, phase: 0 }, live: rotating, pool: (c) => ['throwback', 'pixel', 'cutout'].includes(c.variant) || ['vhs', 'chalkboard', 'film-room'].includes(c.set), inside: 'Throwback, 8-Bit and Cardboard Cutout cards plus the VHS Tape, Chalkboard and Film Room sets.', added: NEW_PACK, art: { c: ['#a16207', '#1c1917'], e: '📼', pat: 'stripes' }, desc: 'Old-school cards. On sale every other week.' },
  'turkey-feast': { name: 'Turkey Bowl Feast', cards: 4, cost: 4000, group: 'limited', sets: true, rotate: { months: [11] }, live: rotating, pool: (c) => c.set === 'turkey' || SET_MAP.get(c.set)?.series === 'snacks', inside: 'The Turkey Bowl set plus the whole Snack Attack series.', added: NEW_PACK, art: { c: ['#d97706', '#431407'], e: '🦃', pat: 'check' }, desc: '4 Turkey Bowl and Snack Attack set cards. November only.' },
  'trick-treat': { name: 'Trick or Treat', cards: 3, cost: 3000, group: 'limited', mixed: true, rotate: { months: [10] }, live: rotating, pool: (c) => c.variant === 'spooky' || c.set === 'halloween', inside: 'Spooky cards and the Halloween Bowl set.', added: NEW_PACK, art: { c: ['#fb923c', '#1c1917'], e: '🎃', pat: 'zig' }, desc: 'Spooky cards and Halloween Bowl set cards. October only.' },
  frosty: { name: 'Frosty Pack', cards: 3, cost: 3000, group: 'limited', mixed: true, rotate: { months: [12, 1, 2] }, live: rotating, pool: (c) => c.variant === 'snow' || ['arctic', 'blizzard', 'christmas', 'new-year'].includes(c.set), inside: 'Snow Day cards plus the Arctic, Blizzard, Christmas Bowl and New Year\'s Bowl sets.', added: NEW_PACK, art: { c: ['#e0f2fe', '#1e40af'], e: '⛄', pat: 'dots' }, desc: 'Snow Day, Arctic, Blizzard and holiday bowl cards. December to February.' },
});
// One-set mini packs for the most popular sets.
for (const id of ['halloween', 'super', 'galaxy', 'comic', 'pixel-plus', 'hot-sauce', 'all-mfl', 'rainbow']) {
  const st = SET_MAP.get(id);
  PACKS['mini-' + id] = { name: `${st.name} Mini`, cards: 2, cost: 2000, group: 'sets', sets: true, pool: inSets(id), added: NEW_PACK, art: { c: [st.c1, st.c2], e: st.emoji, pat: PATTERNS[st.pat] }, desc: `2 cards from the ${st.name} set only. “${st.quote}”` };
}
for (const P of Object.values(PACKS)) if (P.bundle) {
  P.cards = P.bundle.reduce((s, [t, n]) => s + PACKS[t].cards * n, 0);
  P.list = P.bundle.reduce((s, [t, n]) => s + PACKS[t].cost * n, 0);
}
// Shop art for the original packs: [colors, emoji, pattern, foil].
const PACK_ART = {
  starter: [['#16a34a', '#0b1f14'], '🏈', 'stripes'], daily: [['#1e3a5f', '#0c1626'], '📅', 'dots'], gameday: [['#0f766e', '#062420'], '🏟️', 'rays'], weekly: [['#1d4ed8', '#0a1533'], '🗓️', 'grid'],
  prize: [['#be123c', '#2a0710'], '🏆', 'rays', 'gold'], arcade: [['#7c3aed', '#1e0b3a'], '🕹️', 'grid'], milestone: [['#0891b2', '#04222b'], '📚', 'diamond'],
  standard: [['#6d28d9', '#1a0f29'], '🏈', 'stripes'], value: [['#4d7c0f', '#141f04'], '💵', 'check'], premium: [['#ca8a04', '#2a1702'], '⭐', 'rays', 'gold'], mega: [['#ea580c', '#2a0e02'], '💥', 'confetti'],
  lunch: [['#65a30d', '#1a2e05'], '🍱', 'dots'], mystery: [['#6d28d9', '#12051f'], '❓', 'confetti'],
  offense: [['#dc2626', '#2a0505'], '🏃', 'zig'], defense: [['#2563eb', '#050f2a'], '🛡️', 'check'], specialist: [['#0d9488', '#03201d'], '🎯', 'diamond'], shine: [['#db2777', '#3b0764'], '💎', 'stars', 'holo'],
  leaders: [['#ca8a04', '#1f1503'], '🎖️', 'stripes'], draft: [['#475569', '#0f141b'], '📋', 'grid'], sleeper: [['#334155', '#020617'], '💤', 'waves'],
  meme: [['#f59e0b', '#3b1d02'], '🦆', 'confetti'], bitpack: [['#16a34a', '#052e16'], '👾', 'grid'], spooky: [['#ea580c', '#1c0a00'], '👻', 'zig'], cafeteria: [['#f97316', '#3b1505'], '🍕', 'check'],
  bobble: [['#0ea5e9', '#082f49'], '🤪', 'dots'], snowday: [['#7dd3fc', '#1e3a8a'], '❄️', 'dots'],
  goat: [['#fde68a', '#422006'], '🐐', 'rays', 'gold'], elite: [['#7e22ce', '#12021f'], '💠', 'diamond', 'holo'], hunt: [['#be123c', '#1a0208'], '🔮', 'stars'], void: [['#2e1065', '#000000'], '🕳️', 'stars', 'black'],
  'set-hunter': [['#0e7490', '#05161c'], '🧭', 'diamond'], 'set-gold': [['#ca8a04', '#1f1503'], '🎫', 'rays', 'gold'], 'set-prism': [['#db2777', '#1e1b4b'], '🔷', 'stars', 'holo'], 'set-black': [['#27272a', '#000000'], '🎱', 'diamond', 'black'],
};
for (const [k, [c, e, pat, foil]] of Object.entries(PACK_ART)) if (PACKS[k] && !PACKS[k].art) PACKS[k].art = { c, e, pat, foil };
for (const [series, , sets] of SERIES) if (PACKS['series-' + series] && !PACKS['series-' + series].art) PACKS['series-' + series].art = { c: SET_COLORS[series], e: sets[0][2], pat: 'diamond' };

// One pack per team: only that team's cards.
const TEAM_PACK = { cards: 3, cost: 4000, group: 'team' };
const COLLECTOR_STEPS = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
// `ctx` (optional): { now: 'YYYY-MM-DD HH:MM' league time, own: collection, lineup: card ids }.
// Packs with `live` get their per-request fields (price, pool, on-sale state) merged in.
function packInfo(db, type, ctx = {}) {
  const P = PACKS[type];
  if (P) return P.live ? { ...P, ...P.live(db, ctx || {}, P) } : P;
  const m = /^team-(.+)$/.exec(type || '');
  const t = m && db.teams[m[1]];
  return t ? { ...TEAM_PACK, name: `${`${t.city} ${t.name}`.trim()} Pack`, team: t.id, pool: (c) => c.t.id === t.id, desc: `3 cards, all ${t.name} players.` } : null;
}
function packTypes(db) {
  return [...Object.keys(PACKS), ...Object.keys(db.teams).map((id) => 'team-' + id)];
}
const nowOf = (ctx) => (ctx && ctx.now) || pk.nowLocal(process.env.TZ_LEAGUE || 'America/Chicago');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Rotating packs: { off: true, back: 'Friday' } when not on sale, else { off: false, until }.
function rotation(R, now) {
  if (!R) return { off: false };
  const d = new Date(now.slice(0, 10) + 'T12:00:00Z'), dow = d.getUTCDay(), mon = d.getUTCMonth();
  if (R.days) {
    if (R.days.includes(dow)) { let k = 0; while (k < 6 && R.days.includes((dow + k + 1) % 7)) k++; return { off: false, until: k ? DAY_NAMES[(dow + k) % 7] : 'tonight' }; }
    let k = 1; while (k < 7 && !R.days.includes((dow + k) % 7)) k++;
    return { off: true, back: k === 1 ? 'tomorrow' : DAY_NAMES[(dow + k) % 7] };
  }
  if (R.months) {
    const has = (m) => R.months.includes((m % 12) + 1);
    if (has(mon)) { let k = 0; while (k < 11 && has(mon + k + 1)) k++; return { off: false, until: `the end of ${MONTH_NAMES[(mon + k) % 12]}` }; }
    let k = 1; while (k < 12 && !has(mon + k)) k++;
    return { off: true, back: `in ${MONTH_NAMES[(mon + k) % 12]}` };
  }
  if (R.weeks) {
    const wk = Math.floor((d - Date.UTC(2026, 0, 5)) / (7 * 864e5)), at = ((wk % R.weeks) + R.weeks) % R.weeks;
    const k = ((R.phase || 0) - at + R.weeks) % R.weeks;
    return k ? { off: true, back: k === 1 ? 'Monday' : `in ${k} weeks` } : { off: false, until: 'Sunday' };
  }
  return { off: false };
}
// Flash Sale: one pack a day (picked from `flash.from` by the date), cheaper every few hours.
const dayHash = (s) => parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16);
function flashDeal(db, ctx, P) {
  const F = P.flash, now = nowOf(ctx), hr = Number(now.slice(11, 13)) || 0;
  const base = F.from[dayHash('flash:' + now.slice(0, 10)) % F.from.length], B = packInfo(db, base, ctx);
  const step = Math.min(F.steps, 1 + Math.floor(hr / F.every)), discount = Math.round(step * F.drop * 100) / 100;
  return { base, cards: B.cards, pool: B.pool, min: B.min, mins: B.mins, boost: B.boost, sets: B.sets, mixed: B.mixed, floor: B.floor, mystery: B.mystery, inside: B.inside,
    list: B.cost, cost: Math.max(5, Math.round((B.cost * (1 - discount)) / 5) * 5), discount, nextDrop: step < F.steps ? step * F.every : null,
    name: `Flash Sale: ${B.name}`, desc: `Today's deal is the ${B.name} (${B.desc.replace(/\.$/, '')}). ${Math.round(discount * 100)}% off right now.` };
}
// Rival Pack: the team the user's collection is NOT built around (their next opponent, or
// the team they own the fewest cards of). Without a user it can be any team.
function rivalPack(db, ctx) {
  const n = {};
  for (const [id, k] of Object.entries(ctx.own || {})) { const c = cardInfo(db, id); if (c) n[c.t.id] = (n[c.t.id] || 0) + k; }
  for (const id of ctx.lineup || []) { const c = id && cardInfo(db, id); if (c) n[c.t.id] = (n[c.t.id] || 0) + 5; }
  const home = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!home || !db.teams[home] || Object.keys(db.teams).length < 2) return {};
  const g = db.games.filter((x) => x.status === 'scheduled' && (x.home === home || x.away === home)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  const rid = g ? (g.home === home ? g.away : g.home) : Object.keys(db.teams).filter((x) => x !== home).sort((a, b) => (n[a] || 0) - (n[b] || 0))[0];
  const R = db.teams[rid], H = db.teams[home];
  if (!R) return {};
  return { name: `Rival Pack: ${R.name}`, team: R.id, pool: (c) => c.t.id === R.id, desc: `3 ${R.name} cards. Your collection is mostly ${H.name}, so these are the other side.`, inside: `Only ${R.city ? R.city + ' ' : ''}${R.name} players.` };
}
// Hot Hand: everyone who scored or threw a TD in the latest final game (the winners if
// that game has no play-by-play).
function hotHandPack(db) {
  const g = db.games.filter(isFinal).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0];
  if (!g) return {};
  const ids = new Map();
  for (const e of g.events || []) if (e.type === 'TD') for (const who of [e.player, e.passer]) {
    const p = db.teams[e.team]?.roster.find((x) => x.name.toLowerCase() === String(who || '').toLowerCase());
    if (p) ids.set(p.id, p.name);
  }
  const win = g.homeScore > g.awayScore ? g.home : g.awayScore > g.homeScore ? g.away : null;
  if (!ids.size) for (const p of (win && db.teams[win]?.roster) || []) ids.set(p.id, p.name);
  if (!ids.size) return {};
  return { pool: (c) => ids.has(c.pid), inside: `From the ${g.date} game (${db.teams[g.home]?.abbr || g.home} ${g.homeScore}, ${db.teams[g.away]?.abbr || g.away} ${g.awayScore}): ${[...ids.values()].join(', ')}.` };
}
// Position for position packs: a saved position when it names one, otherwise a depth chart
// from tendencies (best passer QB, best scorer RB, next three WR, next TE, the rest linemen).
let roleKey = null, roleMap = new Map();
function rolePos(db, t, p) {
  catalog(db);
  if (roleKey !== catKey) {
    roleMap = new Map();
    const et = pk.effTend(db);
    const named = (s) => (/\bQB\b|QUARTER/.test(s) ? 'QB' : /\b(RB|HB|FB)\b|RUNNING/.test(s) ? 'RB' : /\bWR\b|RECEIV|WIDE|SLOT/.test(s) ? 'WR' : /\bTE\b|TIGHT/.test(s) ? 'TE' : /\b(OL|DL|DE|C|G|T)\b|LINE|CENTER|GUARD|TACKLE|UTIL|RUSH/.test(s) ? 'OL' : null);
    for (const tm of Object.values(db.teams)) {
      const left = [];
      for (const pl of tm.roster) { const r = named(String(pl.position || '').toUpperCase()); if (r) roleMap.set(pl.id, r); else left.push(pl); }
      const count = (r) => tm.roster.filter((pl) => roleMap.get(pl.id) === r).length;
      const take = (r, want, score) => { left.sort((a, b) => score(b) - score(a)); for (const pl of left.splice(0, Math.max(0, want - count(r)))) roleMap.set(pl.id, r); };
      take('QB', 1, (pl) => et.player(tm, pl, 'pass'));
      take('RB', 1, (pl) => et.player(tm, pl, 'td'));
      take('WR', 3, (pl) => et.player(tm, pl, 'td'));
      take('TE', 1, (pl) => et.player(tm, pl, 'td') + et.player(tm, pl, 'pass') * 0.2);
      for (const pl of left) roleMap.set(pl.id, 'OL');
    }
    roleKey = catKey;
  }
  return roleMap.get(p.id) || 'OL';
}
// The cards a pack draws from. `ok` is false when its own pool is empty right now
// (openPack then falls back to every card, and the shop shows the pack as restocking).
function packPool(db, P, taken = new Set()) {
  const base = catalog(db).filter((c) => !taken.has(c.id) && (P.mixed || (P.sets ? !!c.set : !c.set)));
  if (!P.pool) return { pool: base, base, ok: true };
  const f = base.filter(P.pool);
  return f.length ? { pool: f, base, ok: true } : { pool: base, base, ok: false };
}
// What's inside a pack, for the shop: pool size, per-card rarity odds (RARITIES weights ×
// boosts, at or above the floor), and the Big Doh Mi chance. Cached per catalog version.
const oddsCache = new Map();
function packOdds(db, type, ctx = {}) {
  const P = packInfo(db, type, ctx);
  if (!P) return null;
  if (P.bundle) {
    const subs = P.bundle.map(([t, n]) => ({ type: t, n, odds: packOdds(db, t, ctx) }));
    return { ok: subs.every((s) => s.odds && s.odds.ok), subs, size: Math.max(...subs.map((s) => s.odds?.size || 0)), players: Math.max(...subs.map((s) => s.odds?.players || 0)), odds: [], doh: subs.some((s) => s.odds?.doh) };
  }
  catalog(db);
  const key = [catKey, type, P.name, P.base || '', P.team || '', P.inside || ''].join('|');
  if (oddsCache.has(key)) return oddsCache.get(key);
  const { pool, ok } = type === 'starter' ? { pool: catalog(db).filter((c) => c.variant === 'base'), ok: true } : packPool(db, P);
  const have = new Set(pool.map((c) => c.rarity));
  const rs = RARITY_ORDER.filter((r) => r !== 'doh' && have.has(r) && RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(P.floor || 'common'));
  let w = (r) => RARITIES[r].weight * (P.boost?.[r] ?? 1);
  if (!rs.reduce((s, r) => s + w(r), 0)) w = (r) => RARITIES[r].weight; // same fallback as rollCard
  const total = rs.reduce((s, r) => s + w(r), 0) || 1;
  const res = { ok, size: pool.length, players: new Set(pool.map((c) => c.pid)).size, sets: new Set(pool.map((c) => c.set).filter(Boolean)).size,
    odds: type === 'starter' ? [{ r: 'common', pct: 100 }] : rs.map((r) => ({ r, pct: (w(r) / total) * 100 })).filter((x) => x.pct > 0), doh: type !== 'starter' && have.has('doh') };
  if (oddsCache.size > 400) oddsCache.clear();
  oddsCache.set(key, res);
  return res;
}
// Can this pack drop this card? Mirrors openPack (pool, set rule, boosts, floor, bundles).
function packCanDrop(db, type, c, P = packInfo(db, type)) {
  if (!P) return false;
  if (P.bundle) return P.bundle.some(([t]) => packCanDrop(db, t, c));
  if (type === 'starter') return c.variant === 'base';
  if (!P.mixed && !!P.sets !== !!c.set) return false; // set cards only come from set packs
  if (P.pool && !P.pool(c)) return false;
  if (c.rarity !== 'doh' && P.boost && P.boost[c.rarity] === 0) return false;
  if (P.floor && c.rarity !== 'doh' && RARITY_ORDER.indexOf(c.rarity) < RARITY_ORDER.indexOf(P.floor)) return false;
  return true;
}
// Shop helpers ride on packInfo so the export list stays as it is.
Object.assign(packInfo, { odds: packOdds, canDrop: packCanDrop, role: rolePos, rotation, NEW: NEW_PACK });

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
  return { id: `${p.id}:${v.id}`, pid: p.id, variant: v.id, label, rarity: v.rarity, rarityName: R.name, mult: v.mult || R.mult, flat: v.flat || 0, quote: v.quote || '', spec, one: !!v.one, hidden: !!(v.hidden || R.hidden), rating: v.rating || null, set: v.set || null, par: v.par || null, t, p, perk: perkOf(v), tier: tierOf(v.rarity) };
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
  return (options.length ? options : pool)[rint(options.length || pool.length)].id;
}
// `taken`: ids of 1/1 cards someone already owns (they can't drop again).
// `ctx`: see packInfo. Choose packs return the cards to choose from (P.choose of them).
function openPack(db, type, taken = new Set(), ctx = {}) {
  const P = packInfo(db, type, ctx);
  if (!P) throw new Error('Unknown pack');
  // Bundles open every pack inside; a 1/1 pulled in one can't drop again in the next.
  if (P.bundle) {
    const out = [], seen = new Set(taken);
    for (const [t, k] of P.bundle) for (let i = 0; i < k; i++) for (const id of openPack(db, t, seen, ctx)) { out.push(id); if (cardInfo(db, id)?.one) seen.add(id); }
    return out;
  }
  if (type === 'starter') {
    // A full Lineup of Base cards, all different players. A league smaller than that fills up with repeats.
    const players = Object.values(db.teams).flatMap((t) => t.roster.map((p) => p.id));
    for (let i = players.length - 1; i > 0; i--) { const j = rint(i + 1); [players[i], players[j]] = [players[j], players[i]]; }
    const out = players.slice(0, P.cards);
    while (players.length && out.length < P.cards) out.push(players[rint(players.length)]);
    return out.map((pid) => `${pid}:base`);
  }
  let { pool, base } = packPool(db, P, taken);
  const out = [];
  const n = P.choose || (P.mystery ? P.mystery[0] + rint(P.mystery[1] - P.mystery[0] + 1) : P.cards);
  const drop = (id) => { if (cardInfo(db, id).one) pool = pool.filter((c) => c.id !== id); return id; };
  // A pool can run dry when it was only 1/1s: refill it with everything that isn't one.
  const pick = (min) => { if (!pool.length) pool = base.filter((c) => !c.one); return drop(rollCard(pool, P, min)); };
  if (P.pairs) {
    // Each pair: a card, then another version of the same player (from the pack's pool if it has one).
    for (let i = 0; i < P.pairs; i++) {
      const a = pick(P.floor), pid = cardInfo(db, a).pid;
      const mates = pool.filter((c) => c.pid === pid && c.id !== a);
      const alt = mates.length ? mates : base.filter((c) => c.pid === pid && c.id !== a && !c.one);
      out.push(a, alt.length ? drop(rollCard(alt, P, P.floor)) : pick(P.floor));
    }
    return out;
  }
  // Choose packs show different cards; everything else can repeat.
  for (let i = 0, tries = 0; i < n; tries++) { const id = pick(P.floor); if (P.choose && out.includes(id) && tries < n * 25) continue; out.push(id); i++; }
  // Guarantees: swap random slots for cards of at least `min` rarity.
  if (P.min && pool.some((c) => RARITY_ORDER.indexOf(c.rarity) >= RARITY_ORDER.indexOf(P.min))) {
    const ok = (id) => RARITY_ORDER.indexOf(cardInfo(db, id).rarity) >= RARITY_ORDER.indexOf(P.min);
    const need = Math.min(P.mins || 1, n);
    const low = out.map((id, i) => (ok(id) ? -1 : i)).filter((i) => i >= 0);
    const pickNew = (min) => { let id = pick(min); for (let t = 0; P.choose && out.includes(id) && t < 25; t++) id = pick(min); return id; };
    for (let k = out.filter(ok).length; k < need && low.length; k++) out[low.splice(rint(low.length), 1)[0]] = pickNew(P.min);
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

module.exports = { SERIES, SETS, SET_MAP, PARALLELS, isSetCard, DOH_ODDS, RARITIES, RARITY_ORDER, SHOWN_RARITIES, SPECIALTIES, SPECIAL_BOOST, SPEC_KEYS, VARIANTS, packInfo, packTypes, COLLECTOR_STEPS, TEAM_PACK, SCORING, SCORING_LABEL, LINEUP_SIZE, LINEUP_POS, PACKS, cardInfo, catalog, openPack, collection, gameLines, cardScore, lineupFor, fantasy, findPlayer,
  BODY_TYPES, ATTR_KEYS, ATTR_LABELS, ATTR_SHORT, BUILD_LABELS, VARIANT_FX, SET_FX, PARALLEL_FX, cardEffects, effectText, PERKS, perkOf, TIERS, tierOf };
