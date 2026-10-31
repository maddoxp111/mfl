// 3D Blitz Franchise mode: build a middle-school program, play every game in 3D Blitz (or sim it),
// win titles, recruit, and keep your history across seasons. Plain JS, no libraries.
//
// Talks to: window.MFL_FRANCHISE (boot data), window.MFLBlitz.play(root, opts) (the 3D engine, optional),
// and the save API /api/bf/* (logged in) or localStorage mfl-bf-slot-<n> (logged out).
// Everything renders inside #bfRoot; all CSS classes are prefixed bf-.
(function () {
  'use strict';
  const ROOT = document.getElementById('bfRoot');
  if (!ROOT) return;

  const SAVE_VERSION = 1;
  const MAX_SAVE = 590 * 1024;

  // ---------- small helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (v != null && v !== '' && isFinite(+v) ? +v : (d === undefined ? 0 : d)));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(num(n)).toLocaleString('en-US');
  const sum = (a, f) => a.reduce((t, x) => t + (f ? f(x) : x), 0);
  const avg = (a, f) => (a.length ? sum(a, f) / a.length : 0);
  const by = (f, dir) => (a, b) => (dir === 1 ? f(a) - f(b) : f(b) - f(a));
  const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + 's'}`;
  const pct = (w, l, t) => { const g = w + l + t; return g ? (w + t * 0.5) / g : 0; };
  const pctStr = (p) => (p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, ''));
  const lastName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : p[0] || ''; };
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const initials = (n) => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  function timeAgo(iso) {
    const t = Date.parse(iso || '');
    if (!isFinite(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return plural(Math.floor(s / 60), 'minute') + ' ago';
    if (s < 86400) return plural(Math.floor(s / 3600), 'hour') + ' ago';
    if (s < 86400 * 30) return plural(Math.floor(s / 86400), 'day') + ' ago';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Seeded random (same generator family as the Arcade), so a save always plays out the same way.
  function hashStr(seed) {
    let h = 2166136261 >>> 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let a = hashStr(seed);
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const gauss = (r) => (r() + r() + r() + r() - 2) / 2; // about -1..1, bell shaped
  const chance = (r, p) => r() < p;
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function wpick(r, items, wf) {
    const ws = items.map((x) => Math.max(0, wf(x)));
    let t = sum(ws) * r();
    for (let i = 0; i < items.length; i++) { t -= ws[i]; if (t <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function poisson(r, lam) { const L = Math.exp(-Math.max(0, lam)); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 20); return k - 1; }
  function uid() {
    try { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  }

  // Colors
  function hexOk(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()); }
  function hexRgb(c) { c = hexOk(c) ? c.trim() : '#888888'; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function lum(c) { const [r, g, b] = hexRgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  const ink = (bg) => (lum(bg) > 0.36 ? '#0b0c10' : '#ffffff');
  // A team color that reads on the dark UI (falls back to color2, then lightens).
  function accent(t) {
    const c1 = hexOk(t && t.color) ? t.color : '#ffc21a', c2 = hexOk(t && t.color2) ? t.color2 : '#f5f6f8';
    if (contrast(c1, '#0f1117') >= 2.6) return c1;
    if (contrast(c2, '#0f1117') >= 2.6) return c2;
    return '#c9ced8';
  }
  // Text color on top of the team's main color (color2 when it contrasts well enough).
  function onColor(t) { const c1 = hexOk(t && t.color) ? t.color : '#ffc21a', c2 = hexOk(t && t.color2) ? t.color2 : ink(c1); return contrast(c1, c2) >= 2.4 ? c2 : ink(c1); }

  // ---------- boot data ----------
  const BOOT = (function () {
    const b = window.MFL_FRANCHISE && typeof window.MFL_FRANCHISE === 'object' ? window.MFL_FRANCHISE : {};
    const players = (Array.isArray(b.players) ? b.players : []).filter((p) => p && p.name && p.id).map((p) => ({
      id: String(p.id).slice(0, 60), team: String(p.team || ''), name: String(p.name).slice(0, 40), num: /^\d{1,2}$/.test(String(p.num == null ? '' : p.num).trim()) ? +p.num : null,
      photo: typeof p.photo === 'string' && /^\/[A-Za-z0-9_\-./%]+$/.test(p.photo) && p.photo.indexOf('..') < 0 ? p.photo : null,
      look: p.look && typeof p.look === 'object' ? p.look : null, tag: String(p.tag || '').slice(0, 12),
      ovr: clamp(num(p.ovr, 65), 30, 99), spd: clamp(num(p.spd, 62), 30, 99), thr: clamp(num(p.thr, 60), 30, 99), acc: clamp(num(p.acc, 60), 30, 99), cat: clamp(num(p.cat, 60), 30, 99),
      str: clamp(num(p.str, 62), 30, 99), kick: clamp(num(p.kick, 60), 30, 99), def: clamp(num(p.def, 60), 30, 99),
    }));
    const teams = (Array.isArray(b.teams) ? b.teams : []).filter((t) => t && t.id && t.name).map((t) => ({
      id: String(t.id).slice(0, 30), name: String(t.name).slice(0, 30), city: String(t.city || '').slice(0, 40), abbr: String(t.abbr || t.name).slice(0, 4).toUpperCase(),
      color: hexOk(t.color) ? t.color : '#ffc21a', color2: hexOk(t.color2) ? t.color2 : '#111111',
    }));
    const cpuTeams = (Array.isArray(b.cpuTeams) ? b.cpuTeams : []).filter((t) => t && t.name);
    return { user: b.user ? String(b.user) : null, players, teams, cpuTeams, slots: Array.isArray(b.slots) && b.slots.length ? b.slots.map(String).slice(0, 3) : ['1', '2', '3'] };
  })();

  // ---------- football data ----------
  const POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'];
  const POS_NAME = { QB: 'Quarterback', RB: 'Running Back', WR: 'Wide Receiver', TE: 'Tight End', OL: 'Offensive Line', DL: 'Defensive Line', LB: 'Linebacker', DB: 'Defensive Back', K: 'Kicker' };
  const OFF_POS = ['QB', 'RB', 'WR', 'TE', 'OL'], DEF_POS = ['DL', 'LB', 'DB'];
  const STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 2, DL: 2, LB: 2, DB: 3, K: 1 };
  const ROSTER_TARGET = { QB: 2, RB: 2, WR: 4, TE: 2, OL: 3, DL: 3, LB: 2, DB: 3, K: 1 }; // 22
  const ROSTER_MIN = 18, ROSTER_MAX = 26;
  const RK = ['spd', 'agi', 'str', 'thr', 'acc', 'cat', 'blk', 'tck', 'cov', 'kick'];
  const RNAME = { spd: 'Speed', agi: 'Agility', str: 'Strength', thr: 'Throw Power', acc: 'Accuracy', cat: 'Catching', blk: 'Blocking', tck: 'Flag Pulling', cov: 'Coverage', kick: 'Kicking' };
  const RSHORT = { spd: 'SPD', agi: 'AGI', str: 'STR', thr: 'THR', acc: 'ACC', cat: 'CTH', blk: 'BLK', tck: 'FLG', cov: 'COV', kick: 'KCK' };
  const WT = {
    QB: { thr: 0.32, acc: 0.38, agi: 0.1, spd: 0.12, str: 0.08 },
    RB: { spd: 0.33, agi: 0.3, str: 0.2, cat: 0.12, blk: 0.05 },
    WR: { spd: 0.34, cat: 0.36, agi: 0.24, str: 0.06 },
    TE: { cat: 0.32, blk: 0.28, str: 0.22, spd: 0.18 },
    OL: { blk: 0.56, str: 0.34, agi: 0.1 },
    DL: { str: 0.34, tck: 0.32, spd: 0.2, agi: 0.14 },
    LB: { tck: 0.36, cov: 0.22, spd: 0.22, str: 0.2 },
    DB: { cov: 0.42, spd: 0.3, agi: 0.18, cat: 0.1 },
    K: { kick: 0.86, str: 0.14 },
  };
  const NUM_RANGE = { QB: [1, 19], RB: [20, 49], WR: [80, 89, 10, 19], TE: [80, 89, 40, 49], OL: [50, 79], DL: [90, 99, 50, 79], LB: [40, 59], DB: [20, 49], K: [1, 19] };

  const DIFFS = [
    { name: 'Rookie', eng: 0, note: 'Learning the ropes. CPU defenses are slower.' },
    { name: 'Pro', eng: 0.33, note: 'A fair fight for most players.' },
    { name: 'All-Pro', eng: 0.66, note: 'Tight coverage and a faster pass rush.' },
    { name: 'Legend', eng: 1, note: 'Only for the best. Every throw is contested.' },
  ];
  const CHAMP = 'Blitz Bowl', TROPHY = 'Golden Flag';
  const DIVS = ['Recess', 'Homeroom'];

  const FIRST = ['Aiden', 'Mateo', 'Jalen', 'Ethan', 'Noah', 'Liam', 'Caleb', 'Owen', 'Elijah', 'Lucas', 'Mason', 'Logan', 'Isaac', 'Jaylen', 'Carter', 'Wyatt', 'Leo', 'Miles',
    'Gavin', 'Dylan', 'Nolan', 'Eli', 'Cooper', 'Ryder', 'Asher', 'Micah', 'Brody', 'Tyson', 'Kai', 'Xander', 'Emmett', 'Rowan', 'Jace', 'Declan', 'Zion', 'Malik', 'Andre', 'Darius',
    'Marcus', 'Tavian', 'Jordan', 'Cameron', 'Reid', 'Bennett', 'Silas', 'Hudson', 'Grayson', 'Easton', 'Theo', 'Luca', 'Diego', 'Santiago', 'Rafael', 'Nico', 'Omar', 'Amir',
    'Kenji', 'Hiro', 'Arjun', 'Rohan', 'Dev', 'Tariq', 'Kofi', 'Jamal', 'Terrell', 'DeShawn', 'Brandon', 'Tyler', 'Austin', 'Chase', 'Blake', 'Tucker', 'Parker', 'Beckett',
    'Sawyer', 'Finnegan', 'Quinn', 'Colby', 'Landon', 'Maddox', 'Bryce', 'Trey', 'Kaden', 'Jasper', 'Felix', 'Oscar', 'Hugo', 'Ezra', 'Abel', 'Callum', 'Desmond', 'Isaiah',
    'Jude', 'Knox', 'Lennox', 'Manny', 'Rio', 'Sebastian', 'Tobias', 'Vince', 'Wesley', 'Zane'];
  const LAST = ['Alvarez', 'Bennett', 'Brooks', 'Carter', 'Castillo', 'Chen', 'Coleman', 'Cruz', 'Daniels', 'Delgado', 'Dixon', 'Ellis', 'Espinoza', 'Fischer', 'Fleming', 'Foster',
    'Garza', 'Gibson', 'Graham', 'Greene', 'Hale', 'Hammond', 'Hayes', 'Holloway', 'Hughes', 'Ibarra', 'Jackson', 'Jennings', 'Kaminski', 'Keller', 'Kim', 'Lambert', 'Lawson',
    'Lindqvist', 'Lopez', 'Lowery', 'Maddox', 'Malone', 'Marsh', 'Mendoza', 'Mercer', 'Monroe', 'Morales', 'Nakamura', 'Nash', 'Nguyen', 'Novak', 'Okafor', 'Oliver', 'Ortega',
    'Owens', 'Park', 'Patel', 'Pearson', 'Perry', 'Porter', 'Quinn', 'Ramirez', 'Reyes', 'Rhodes', 'Rivera', 'Robinson', 'Rojas', 'Russo', 'Salazar', 'Sanders', 'Santos',
    'Schaefer', 'Shah', 'Shaw', 'Silva', 'Sloan', 'Soto', 'Stanton', 'Stone', 'Sullivan', 'Tanaka', 'Thornton', 'Torres', 'Tran', 'Turner', 'Underwood', 'Valdez', 'Vance',
    'Vargas', 'Wade', 'Walsh', 'Ward', 'Warner', 'Webb', 'Whitaker', 'Wilder', 'Winters', 'Wolfe', 'Yates', 'Young', 'Zamora', 'Zimmerman', 'Abara', 'Becker', 'Calloway',
    'Dubois', 'Esposito', 'Farrell', 'Gallo', 'Haddad', 'Iverson', 'Jovanovic', 'Kowalski', 'Lucero', 'Mbeki', 'Navarro', 'Osei', 'Pruitt', 'Ruiz', 'Sato', 'Teller', 'Vu'];
  const SCHOOLS = ['Maple Grove Elementary', 'Cedar Park Elementary', 'Riverside Elementary', 'Oak Hollow Elementary', 'Sunnyside Elementary', 'Lakeview Elementary',
    'Pine Ridge Elementary', 'Westbrook Elementary', 'Hillcrest Elementary', 'Brookfield Elementary', 'Willow Creek Elementary', 'Stonegate Elementary'];

  // The fictional league. The first four names already exist as Arcade CPU teams.
  const FICTION = [
    { key: 'faculty', name: 'The Faculty', abbr: 'FAC', color: '#0f172a', color2: '#facc15', tier: 74, div: 1, nick: 'the teachers', field: 'Staff Lot Stadium' },
    { key: 'detention', name: 'Detention Kings', abbr: 'DTK', color: '#b91c1c', color2: '#111111', tier: 71, div: 0, nick: 'the Kings', field: 'Room 104 Field' },
    { key: 'hall', name: 'Hall Monitors', abbr: 'HMS', color: '#7c3aed', color2: '#f5f3ff', tier: 67, div: 1, nick: 'the Monitors', field: 'Hallway Field' },
    { key: 'jv', name: 'JV Squad', abbr: 'JV', color: '#64748b', color2: '#e2e8f0', tier: 56, div: 0, nick: 'the Squad', field: 'Back Field' },
    { key: 'rockets', name: 'Recess Rockets', abbr: 'RKT', color: '#0284c7', color2: '#f8fafc', tier: 66, div: 0, nick: 'the Rockets', field: 'Playground Park' },
    { key: 'cafe', name: 'Cafeteria Crushers', abbr: 'CAF', color: '#ea580c', color2: '#1c1917', tier: 63, div: 0, nick: 'the Crushers', field: 'Lunchroom Lawn' },
    { key: 'sparks', name: 'Science Fair Sparks', abbr: 'SFS', color: '#c026d3', color2: '#fdf4ff', tier: 64, div: 1, nick: 'the Sparks', field: 'Volcano Field' },
    { key: 'pythons', name: 'Pop Quiz Pythons', abbr: 'PQP', color: '#15803d', color2: '#fde047', tier: 62, div: 1, nick: 'the Pythons', field: 'Pencil Point Field' },
    { key: 'falcons', name: 'Field Trip Falcons', abbr: 'FTF', color: '#a16207', color2: '#fef3c7', tier: 60, div: 1, nick: 'the Falcons', field: 'Bus Loop Bowl' },
    { key: 'yetis', name: 'Snow Day Yetis', abbr: 'YTI', color: '#7dd3fc', color2: '#1e3a8a', tier: 61, div: 0, nick: 'the Yetis', field: 'Frost Field' },
    // spares, only used if the boot data has fewer than two real teams
    { key: 'hornets', name: 'Homework Hornets', abbr: 'HWH', color: '#facc15', color2: '#111827', tier: 63, div: 0, nick: 'the Hornets', field: 'Study Hall Field' },
    { key: 'lynx', name: 'Late Bell Lynx', abbr: 'LBL', color: '#0d9488', color2: '#ecfeff', tier: 62, div: 1, nick: 'the Lynx', field: 'Tardy Track' },
  ];
  const COLOR_PRESETS = [
    ['#ffc21a', '#111111'], ['#ff3344', '#ffffff'], ['#2563eb', '#f8fafc'], ['#16a34a', '#f0fdf4'], ['#7c3aed', '#fde047'], ['#f97316', '#1f2937'],
    ['#0ea5e9', '#0f172a'], ['#db2777', '#fdf2f8'], ['#14b8a6', '#042f2e'], ['#e5e7eb', '#1d4ed8'], ['#111827', '#f59e0b'], ['#84cc16', '#14532d'],
  ];

  const PERS = {
    leader: { n: 'Leader', d: 'Keeps the whole team fired up. Boosts chemistry.' },
    worker: { n: 'Hard Worker', d: 'First one at practice. Extra training XP.' },
    clown: { n: 'Class Clown', d: 'Keeps the locker room loose. Good for chemistry, a little less focused.' },
    competitor: { n: 'Competitor', d: 'Hates to lose. Big mood swings after wins and losses.' },
    teamfirst: { n: 'Team Player', d: 'Happy in any role, even as a backup.' },
    free: { n: 'Free Spirit', d: 'Unpredictable. Some weeks are great, some are not.' },
    quiet: { n: 'Quiet Type', d: 'Steady and calm. Mood rarely changes.' },
    showtime: { n: 'Showtime', d: 'Loves the spotlight. Happiest with the ball in their hands.' },
  };
  const PERS_KEYS = Object.keys(PERS);
  const TRAITS = {
    clutch: { n: 'Clutch', d: 'Plays better in close games and the playoffs.' },
    iron: { n: 'Iron Kid', d: 'Almost never gets hurt.' },
    film: { n: 'Film Junkie', d: 'Studies everything. More XP from training.' },
    bloomer: { n: 'Late Bloomer', d: 'Bigger jumps in the offseason.' },
    fan: { n: 'Fan Favorite', d: 'The crowd loves this kid. Extra points at home games.' },
    motor: { n: 'Nonstop Motor', d: 'Never takes a play off. More defensive stats.' },
  };
  const TRAIT_KEYS = Object.keys(TRAITS);
  // Badges earned from ratings (not stored).
  const BADGES = [['spd', 88, 'Speedster'], ['thr', 88, 'Cannon Arm'], ['acc', 88, 'Pinpoint'], ['cat', 88, 'Sure Hands'], ['agi', 88, 'Ankle Breaker'], ['blk', 86, 'Brick Wall'], ['tck', 86, 'Flag Hawk'], ['cov', 86, 'Lockdown'], ['kick', 86, 'Big Leg'], ['str', 90, 'Powerhouse']];
  const INJ = [['Tweaked ankle', 1], ['Sore shoulder', 1], ['Jammed finger', 1], ['Bumped knee', 1], ['Stubbed toe', 1], ['Sore back', 1], ['Sore hamstring', 2], ['Sprained wrist', 2], ['Twisted ankle', 2], ['Bruised ribs', 2], ['Strained calf', 2], ['Sprained ankle', 3]];
  const AWAY = [['Family trip', 1], ['Science fair', 1], ['Caught a cold', 1], ['Band concert', 1], ['Grandma\'s birthday', 1]];
  const FOCUS = {
    passing: { n: 'Passing', d: 'QBs work on arm strength and accuracy. Receivers run routes.', pos: { QB: 1.6, WR: 0.7, TE: 0.5 }, keys: ['thr', 'acc', 'cat'] },
    running: { n: 'Running', d: 'Backs work on speed and cuts. Linemen work on blocking.', pos: { RB: 1.6, OL: 1.1, TE: 0.6, QB: 0.3 }, keys: ['spd', 'agi', 'str', 'blk'] },
    catching: { n: 'Catching', d: 'Hands, hands, hands. Receivers, tight ends and backs.', pos: { WR: 1.5, TE: 1.2, RB: 0.7 }, keys: ['cat', 'agi'] },
    defense: { n: 'Defense', d: 'Flag pulling, coverage and pass rush drills.', pos: { DL: 1.3, LB: 1.4, DB: 1.4 }, keys: ['tck', 'cov', 'str'] },
    conditioning: { n: 'Conditioning', d: 'Everyone runs. Small XP for all, fewer injuries this week.', pos: { QB: 0.5, RB: 0.6, WR: 0.6, TE: 0.6, OL: 0.6, DL: 0.6, LB: 0.6, DB: 0.6, K: 0.4 }, keys: ['spd', 'str'] },
    bonding: { n: 'Team Bonding', d: 'Pizza and film night. Big boost to chemistry and morale, little XP.', pos: { QB: 0.2, RB: 0.2, WR: 0.2, TE: 0.2, OL: 0.2, DL: 0.2, LB: 0.2, DB: 0.2, K: 0.2 }, keys: ['agi'] },
  };
  const INTENSITY = [{ n: 'Light', x: 0.6, mor: 2, inj: 0.8 }, { n: 'Normal', x: 1, mor: 0, inj: 1 }, { n: 'Hard', x: 1.45, mor: -2, inj: 1.25 }];
  const FAC = {
    train: { n: 'Training Field', d: (l) => (l > 1 ? `+${(l - 1) * 12}% XP from practice` : 'A basic practice field'), short: 'More practice XP' },
    film: { n: 'Film Room', d: (l) => `${2 + l} free scouting reports${l > 1 ? `, +${((l - 1) * 0.4).toFixed(1)} game-plan bonus` : ''}`, short: 'Scouting and game plans' },
    locker: { n: 'Locker Room', d: (l) => `Morale settles at ${58 + l * 3}, chemistry grows faster`, short: 'Morale and chemistry' },
    stadium: { n: 'Stadium & Crowd', d: (l) => `+${l * 8} points per home game, louder crowd`, short: 'Home field and points' },
    medical: { n: 'Medical Center', d: (l) => (l > 1 ? `${(l - 1) * 12}% fewer injuries${l >= 4 ? ', faster healing' : ''}` : 'A first-aid kit and an ice pack'), short: 'Fewer injuries' },
  };
  const FAC_KEYS = Object.keys(FAC);
  const FAC_COST = [0, 0, 120, 220, 340, 500];
  const STAFF = {
    oc: { n: 'Offensive Coordinator', short: 'OC', d: (s) => `+${(s * 0.6).toFixed(1)} offense, more XP for the offense` },
    dc: { n: 'Defensive Coordinator', short: 'DC', d: (s) => `+${(s * 0.6).toFixed(1)} defense, more XP for the defense` },
    tr: { n: 'Head Trainer', short: 'TR', d: (s) => `${s * 8}% fewer injuries, quicker recovery` },
  };
  const STAFF_COST = [0, 0, 60, 130, 220, 340];
  const OFFER_COST = [0, 0, 5, 15, 30, 50];

  // ---------- the franchise state ----------
  let S = null; // current save (plain JSON-able object)
  let RC = null; // roster cache: teamId -> [players]
  const invalidate = () => { RC = null; };
  function roster(tid) {
    if (!RC) { RC = {}; for (const id in S.players) { const p = S.players[id]; (RC[p.t] || (RC[p.t] = [])).push(p); } }
    return RC[tid] || [];
  }
  const TM = (id) => (S && S.teams[id]) || null;
  const PL = (id) => (S && S.players[id]) || null;
  const userTeam = () => TM(S.user);
  const teamIds = () => S.order.slice();

  // ---------- ratings ----------
  function posOvr(pos, r) {
    const w = WT[pos] || WT.WR;
    let o = 0;
    for (const k in w) o += w[k] * num(r[k], 50);
    return clamp(Math.round(o), 30, 99);
  }
  const ovr = (p) => posOvr(p.pos, p.r);
  const healthy = (p) => !p.inj || p.inj.w <= 0;
  function potGrade(v) {
    return v >= 95 ? 'A+' : v >= 90 ? 'A' : v >= 86 ? 'A-' : v >= 82 ? 'B+' : v >= 78 ? 'B' : v >= 74 ? 'B-' : v >= 70 ? 'C+' : v >= 66 ? 'C' : v >= 62 ? 'C-' : 'D';
  }
  function fixRatings(r) { for (const k of RK) r[k] = clamp(Math.round(num(r[k], 45)), 30, 99); return r; }
  // Nudge the ratings that matter for `pos` so the overall lands on `target`.
  function aimRatings(r, pos, target) {
    for (let i = 0; i < 4; i++) {
      const d = target - posOvr(pos, r);
      if (Math.abs(d) < 1) break;
      for (const k in WT[pos]) r[k] = clamp(r[k] + d, 30, 99);
    }
    return fixRatings(r);
  }
  function genRatings(rng, pos, target) {
    const w = WT[pos], r = {};
    for (const k of RK) r[k] = w[k] ? target + gauss(rng) * 8 : target * 0.6 + 14 + gauss(rng) * 10;
    if (pos !== 'K') r.kick = 32 + rng() * 26;
    if (pos !== 'QB') r.thr = Math.min(r.thr, 40 + rng() * 30);
    if (pos === 'OL' || pos === 'DL') { r.spd -= 6; r.str += 4; }
    if (pos === 'DB' || pos === 'WR') r.spd += 3;
    return aimRatings(fixRatings(r), pos, target);
  }
  function genLook(rng) {
    return { skin: rint(rng, 0, 4), height: pick(rng, ['short', 'normal', 'normal', 'tall']), cleats: pick(rng, ['black', 'black', 'white', 'team', 'gold', 'red']), visor: chance(rng, 0.25), sleeves: chance(rng, 0.3) };
  }
  function cleanLook(l) {
    if (!l || typeof l !== 'object') return null;
    return { skin: clamp(num(l.skin, 1) | 0, 0, 4), height: ['short', 'normal', 'tall'].includes(l.height) ? l.height : 'normal', cleats: ['black', 'white', 'team', 'gold', 'red'].includes(l.cleats) ? l.cleats : 'black', visor: !!l.visor, sleeves: !!l.sleeves };
  }
  function usedNames() { const s = new Set(); for (const id in S.players) s.add(S.players[id].n); return s; }
  function genName(rng, used) {
    for (let i = 0; i < 12; i++) { const n = pick(rng, FIRST) + ' ' + pick(rng, LAST); if (!used || !used.has(n)) { if (used) used.add(n); return n; } }
    return pick(rng, FIRST) + ' ' + pick(rng, LAST) + ' Jr.';
  }
  function pickNum(rng, tid, pos) {
    const taken = new Set(roster(tid).map((p) => p.num));
    const rg = NUM_RANGE[pos] || [1, 99];
    for (let i = 0; i < 40; i++) {
      const pairI = rg.length > 2 && rng() < 0.4 ? 2 : 0;
      const n = rint(rng, rg[pairI], rg[pairI + 1]);
      if (!taken.has(n)) return n;
    }
    for (let n = 1; n < 100; n++) if (!taken.has(n)) return n;
    return 0;
  }
  function genPot(rng, grade, cur) {
    const room = grade <= 6 ? 12 + rng() * 22 : grade === 7 ? 6 + rng() * 16 : 2 + rng() * 9;
    return clamp(Math.round(cur + room + gauss(rng) * 4), 40, 99);
  }
  // A brand new generated kid.
  function makePlayer(rng, o) {
    const pos = o.pos, grade = o.grade || 6;
    const target = clamp(Math.round(o.target), 34, 92);
    const r = genRatings(rng, pos, target);
    const p = {
      id: 'g' + S.nid++, n: o.name || genName(rng, o.used), t: o.team || '', pos, g: grade, num: 0, ph: null, lk: genLook(rng), mfl: null,
      r, pot: o.pot || genPot(rng, grade, target), xp: 0, mor: rint(rng, 58, 78), pers: pick(rng, PERS_KEYS), tr: [], inj: null,
      s: {}, c: {}, yrs: [], aw: [], rk: S.season, ps: {},
    };
    if (chance(rng, 0.28)) p.tr.push(pick(rng, TRAIT_KEYS));
    if (p.tr[0] === 'bloomer') p.pot = clamp(p.pot + 5, 40, 99);
    if (o.team) p.num = pickNum(rng, o.team, pos);
    return p;
  }
  function addPlayer(p) { S.players[p.id] = p; invalidate(); return p; }

  // Real MFL kid -> franchise player, at a position that fits.
  function realRatings(bp, rng) {
    const j = () => gauss(rng) * 5;
    return fixRatings({ spd: bp.spd + j(), agi: (bp.spd + bp.ovr) / 2 + j(), str: bp.str + j() * 0.6, thr: bp.thr + j(), acc: bp.acc + j(), cat: bp.cat + j(), blk: bp.str * 0.86 + j(), tck: bp.def + j(), cov: bp.def + j(), kick: bp.kick + j() * 0.6 });
  }
  function realPlayer(bp, pos, team, rng, base) {
    const r = aimRatings(base || realRatings(bp, rng), pos, bp.ovr);
    const grade = wpick(rng, [6, 7, 8], (g) => (g === 7 ? 4 : 3));
    const p = {
      id: 'm-' + bp.id, n: bp.name, t: team, pos, g: grade, num: 0, ph: bp.photo, lk: cleanLook(bp.look), mfl: bp.id, tag: bp.tag || '',
      r, pot: clamp(bp.ovr + rint(rng, 4, 14), 50, 99), xp: 0, mor: rint(rng, 64, 82), pers: pick(rng, PERS_KEYS), tr: [], inj: null,
      s: {}, c: {}, yrs: [], aw: [], rk: S.season, ps: {},
    };
    if (bp.tag === 'C') { p.pers = 'leader'; p.tr.push('clutch'); } else if (chance(rng, 0.35)) p.tr.push(pick(rng, TRAIT_KEYS));
    if (!p.lk) p.lk = genLook(rngFrom(S.seed + ':look:' + bp.id));
    return p;
  }
  // Greedy: best passer at QB, then receivers, back, and the rest on defense.
  const REAL_ORDER = ['QB', 'WR', 'WR', 'RB', 'WR', 'TE', 'DB', 'LB', 'DB', 'DL', 'LB', 'OL', 'DL', 'OL', 'WR', 'DB', 'RB', 'TE'];
  function placeReal(bps, seed) {
    const left = bps.map((bp) => ({ bp, r: realRatings(bp, rngFrom(seed + ':real:' + bp.id)) }));
    const out = [];
    let i = 0;
    while (left.length) {
      const pos = REAL_ORDER[i++ % REAL_ORDER.length];
      left.sort((a, b) => posOvr(pos, b.r) - posOvr(pos, a.r));
      const x = left.shift();
      out.push({ bp: x.bp, pos, r: x.r });
    }
    return out;
  }
  function bestPos(bp, opts, seed) {
    const r = realRatings(bp, rngFrom(seed + ':real:' + bp.id));
    return { pos: opts.slice().sort((a, b) => posOvr(b, r) - posOvr(a, r))[0], r };
  }

  // Fill a team up to its target roster with generated kids around `tier`.
  function fillRoster(t, rng, tier, used, minOnly) {
    const ps = roster(t.id);
    const have = {}; for (const p of ps) have[p.pos] = (have[p.pos] || 0) + 1;
    const made = [];
    for (const pos of POS) {
      const want = minOnly ? STARTERS[pos] + (pos === 'QB' || pos === 'WR' || pos === 'DB' ? 1 : 0) : ROSTER_TARGET[pos];
      for (let k = have[pos] || 0; k < want; k++) {
        const grade = wpick(rng, [6, 7, 8], (g) => (g === 6 ? 3 : 4));
        const starterish = k < STARTERS[pos];
        const target = tier + (starterish ? 2 : -6) + (grade - 7) * 3 + gauss(rng) * 6;
        made.push(addPlayer(makePlayer(rng, { pos, grade, target, team: t.id, used })));
      }
    }
    return made;
  }

  // ---------- depth chart & lineups ----------
  function fixDepth(t, resort) {
    const ps = roster(t.id);
    const d = t.depth && typeof t.depth === 'object' ? t.depth : {};
    const out = {};
    for (const pos of POS) {
      const mine = ps.filter((p) => p.pos === pos);
      const ids = new Set(mine.map((p) => p.id));
      let list = (Array.isArray(d[pos]) ? d[pos] : []).filter((id) => ids.has(id));
      const seen = new Set(list);
      list = list.filter((id, i) => list.indexOf(id) === i);
      const extra = mine.filter((p) => !seen.has(p.id)).sort(by(ovr));
      list = list.concat(extra.map((p) => p.id));
      if (resort) list.sort((a, b) => ovr(PL(b)) - ovr(PL(a)));
      out[pos] = list;
    }
    t.depth = out;
    return out;
  }
  // Starters by position (healthy only). Holes get the best healthy bench kid for that spot.
  function lineup(t) {
    const d = t.depth || fixDepth(t);
    const used = new Set(), L = {};
    for (const pos of POS) {
      L[pos] = [];
      for (const id of d[pos] || []) {
        const p = PL(id);
        if (p && p.t === t.id && healthy(p) && L[pos].length < STARTERS[pos]) { L[pos].push(p); used.add(p.id); }
      }
    }
    const bench = () => roster(t.id).filter((p) => healthy(p) && !used.has(p.id));
    for (const pos of POS) {
      while (L[pos].length < STARTERS[pos]) {
        const b = bench().sort((a, x) => posOvr(pos, x.r) - posOvr(pos, a.r))[0];
        if (!b) break;
        (L._fill || (L._fill = {}))[b.id] = pos; L[pos].push(b); used.add(b.id);
      }
    }
    return L;
  }
  const slotOvr = (p, pos) => posOvr(pos, p.r);
  function unit(L, pos) { const a = L[pos] || []; const n = STARTERS[pos]; let s = 0; for (let i = 0; i < n; i++) s += a[i] ? slotOvr(a[i], pos) : 32; return s / n; }
  function staffStars(t, key) {
    if (t.id === S.user) return num(S.staff && S.staff[key] && S.staff[key].s, 1);
    return clamp(Math.round((num(t.tier, 62) - 52) / 7), 1, 4);
  }
  function teamRatings(t, L) {
    L = L || lineup(t);
    const off = unit(L, 'QB') * 0.3 + unit(L, 'RB') * 0.12 + unit(L, 'WR') * 0.3 + unit(L, 'TE') * 0.1 + unit(L, 'OL') * 0.18;
    const def = unit(L, 'DL') * 0.3 + unit(L, 'LB') * 0.3 + unit(L, 'DB') * 0.4;
    const k = unit(L, 'K');
    const so = staffStars(t, 'oc') * 0.6, sd = staffStars(t, 'dc') * 0.6;
    return { off: clamp(Math.round(off + so), 30, 99), def: clamp(Math.round(def + sd), 30, 99), k: Math.round(k), ovr: clamp(Math.round((off + so) * 0.5 + (def + sd) * 0.43 + k * 0.07), 30, 99), rawOff: off, rawDef: def };
  }
  function moraleAvg(t) { const ps = roster(t.id); return ps.length ? avg(ps, (p) => num(p.mor, 60)) : 60; }
  function moraleWord(m) { return m >= 85 ? 'Fired up' : m >= 70 ? 'Happy' : m >= 52 ? 'Okay' : m >= 38 ? 'Down' : 'Upset'; }
  function chemWord(c) { return c >= 85 ? 'Like family' : c >= 70 ? 'Clicking' : c >= 52 ? 'Getting there' : c >= 38 ? 'Shaky' : 'Strangers'; }
  // Strength used by the simulator (ratings plus chemistry, morale, home field, coaching).
  function simStrength(t, home, L) {
    const R = teamRatings(t, L);
    let bonus = (num(t.chem, 55) - 55) / 18 + (moraleAvg(t) - 62) / 22;
    if (home) bonus += 1.4 + (t.id === S.user ? (S.fac.stadium - 1) * 0.35 : 0.4);
    if (t.id === S.user) bonus += (S.fac.film - 1) * 0.4;
    return { off: R.off + bonus, def: R.def + bonus, k: R.k, R };
  }
  function badgesOf(p) { return BADGES.filter(([k, v]) => num(p.r[k]) >= v && (WT[p.pos][k] || k === 'spd')).map((b) => b[2]); }

  // ---------- staff ----------
  function genStaff(rng, stars, used) { return { n: 'Coach ' + pick(rng, LAST), s: stars }; }
  function genHires(rng) {
    const out = {};
    for (const k of Object.keys(STAFF)) {
      const cur = num(S.staff[k] && S.staff[k].s, 1);
      out[k] = [cur + 1, cur + 1 + (chance(rng, 0.4) ? 1 : 0), Math.max(2, cur)].map((s) => genStaff(rng, clamp(s, 2, 5))).filter((c, i, a) => a.findIndex((x) => x.s === c.s) === i).sort((a, b) => a.s - b.s);
    }
    return out;
  }

  // ---------- league creation ----------
  function mkTeam(o) {
    return {
      id: o.id, name: o.name, abbr: o.abbr, color: o.color, color2: o.color2, div: o.div, kind: o.kind, coach: o.coach || '', nick: o.nick || 'the ' + o.name, field: o.field || o.name + ' Field', tier: o.tier || 62,
      depth: {}, prest: 50, chem: 55, w: 0, l: 0, t: 0, dw: 0, dl: 0, dt: 0, pf: 0, pa: 0, strk: 0, best: 0, ts: {}, pr: 6, prPrev: 6, exp: 6,
      at: { w: 0, l: 0, t: 0, titles: 0, po: 0, fin: 0 },
    };
  }
  function createLeague(cfg) {
    const seed = cfg.seed || uid();
    S = {
      v: SAVE_VERSION, id: uid(), seed, name: cfg.name || 'My Franchise', created: new Date().toISOString(), coach: cfg.coach || 'Coach', diff: clamp(cfg.diff | 0, 0, 3), qmin: [2, 3, 4].includes(cfg.qmin) ? cfg.qmin : 2, poSize: cfg.po === 8 ? 8 : 4,
      season: 1, year: new Date().getFullYear(), phase: 'regular', week: 0, user: null, teams: {}, order: [], players: {}, nid: 1, sched: [], po: null, news: [],
      pts: 150, fac: { train: 1, film: 1, locker: 1, stadium: 1, medical: 1 }, staff: {}, hire: null, train: { f: 'passing', i: 1 },
      hist: { seasons: [], hof: [], rec: { L: { g: {}, s: {}, c: {} }, U: { g: {}, s: {}, c: {} }, T: {} }, titles: {} },
      box: {}, last: null, off: null, goal: null, cr: { w: 0, l: 0, t: 0, titles: 0, coy: 0, po: 0 }, cfg: { mode: cfg.mode, realId: cfg.realId || null, custom: cfg.custom || null, picks: cfg.picks || [] },
    };
    invalidate();
    const rng = rngFrom(seed + ':league');
    const used = new Set(BOOT.players.map((p) => p.name));
    const reals = BOOT.teams.slice(0, 2);
    const picks = cfg.mode === 'custom' ? (cfg.picks || []).map((id) => BOOT.players.find((p) => p.id === id)).filter(Boolean).slice(0, 3) : [];
    const pickIds = new Set(picks.map((p) => p.id));
    const divs = [[], []];
    if (cfg.mode === 'custom') {
      const c = cfg.custom || {};
      const name = String(c.name || 'My School').slice(0, 24);
      divs[0].push(mkTeam({ id: 'school', name, abbr: String(c.abbr || name.slice(0, 3)).toUpperCase().slice(0, 4), color: hexOk(c.color) ? c.color : '#ffc21a', color2: hexOk(c.color2) ? c.color2 : '#111111', div: 0, kind: 'custom', tier: 60, nick: 'the ' + name, field: name + ' Field' }));
    }
    reals.forEach((rt, i) => divs[i % 2].push(mkTeam({ id: rt.id, name: rt.name, abbr: rt.abbr, color: rt.color, color2: rt.color2, div: i % 2, kind: 'real', nick: 'the ' + rt.name, field: (rt.city || rt.name) + ' Field' })));
    for (const f of FICTION) {
      if (divs[0].length + divs[1].length >= 12) break;
      if (divs[0].some((t) => t.id === f.key) || divs[1].some((t) => t.id === f.key)) continue;
      let d = f.div;
      if (divs[d].length >= 6) d = 1 - d;
      if (divs[d].length >= 6) continue;
      const bc = BOOT.cpuTeams.find((x) => x.name === f.name);
      divs[d].push(mkTeam({ id: f.key, name: f.name, abbr: f.abbr, color: bc && hexOk(bc.color) ? bc.color : f.color, color2: bc && hexOk(bc.color2) ? bc.color2 : f.color2, div: d, kind: 'cpu', tier: f.tier, nick: f.nick, field: f.field }));
    }
    for (const d of [0, 1]) for (const t of divs[d]) { t.div = d; S.teams[t.id] = t; S.order.push(t.id); }
    S.user = cfg.mode === 'custom' ? 'school' : (S.teams[cfg.realId] ? cfg.realId : (reals[0] && reals[0].id) || S.order[0]);
    // rosters
    for (const id of S.order) {
      const t = S.teams[id];
      t.coach = id === S.user ? S.coach : 'Coach ' + pick(rng, LAST);
      if (t.kind === 'real') {
        const bps = BOOT.players.filter((p) => p.team === id && !pickIds.has(p.id));
        for (const x of placeReal(bps, seed)) { const p = addPlayer(realPlayer(x.bp, x.pos, id, rng, x.r)); p.num = x.bp.num && !roster(id).some((q) => q !== p && q.num === x.bp.num) ? x.bp.num : pickNum(rng, id, x.pos); }
        t.tier = bps.length ? Math.round(avg(bps, (p) => p.ovr) - 7) : 62;
        fillRoster(t, rng, t.tier, used);
      } else if (t.kind === 'custom') {
        const opts = ['QB', 'WR', 'RB', 'TE', 'DB', 'LB'];
        for (const bp of picks) { const b = bestPos(bp, opts, seed); const p = addPlayer(realPlayer(bp, b.pos, id, rng, b.r)); p.num = pickNum(rng, id, b.pos); }
        fillRoster(t, rng, t.tier, used);
      } else fillRoster(t, rng, t.tier, used);
      fixDepth(t, true);
      t.chem = rint(rng, 48, 62);
      t.prest = clamp(Math.round((t.tier - 50) * 2.2 + (t.kind === 'real' ? 10 : 0)), 12, 70);
    }
    if (TM(S.user).kind === 'custom') TM(S.user).prest = 25;
    S.staff = { oc: genStaff(rng, 1), dc: genStaff(rng, 1), tr: genStaff(rng, 1) };
    S.hire = genHires(rng);
    S.sched = makeSchedule(rngFrom(seed + ':sched:1'));
    powerRank(true);
    for (const id of S.order) { TM(id).exp = TM(id).pr; TM(id).prPrev = TM(id).pr; }
    setGoal();
    const ut = userTeam();
    news(`${S.coach} takes over ${ut.name}. Season 1 kicks off!`, 'off', ut.id);
    const top = S.order.map(TM).sort((a, b) => a.pr - b.pr)[0];
    news(`Preseason power rankings: ${top.name} start at #1. ${ut.name} open at #${ut.pr}.`, 'pr', top.id);
    return S;
  }

  // A preseason goal from where the team is expected to finish. Meeting it pays a bonus.
  function setGoal() {
    const r = userTeam().pr;
    S.goal = r <= 2 ? { k: 'title', t: `Win the ${CHAMP}` } : r <= Math.min(5, S.poSize) ? { k: 'po', t: 'Make the playoffs' } : r <= 8 ? { k: 'w6', t: 'Win at least 6 games' } : { k: 'w4', t: 'Win at least 4 games' };
  }
  function goalMet() {
    const g = S.goal, t = userTeam();
    if (!g) return false;
    if (g.k === 'title') return !!(S.po && S.po.champ === S.user);
    if (g.k === 'po') return !!(S.po && S.po.seeds.includes(S.user));
    return t.w >= (g.k === 'w6' ? 6 : 4);
  }
  // Full round robin (every team plays every other team once = 11 weeks).
  function makeSchedule(rng) {
    const ids = shuffle(rng, S.order);
    const n = ids.length, arr = ids.slice(), weeks = [];
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; games.push((r + i) % 2 ? [a, b] : [b, a]); }
      weeks.push(games);
      arr.splice(1, 0, arr.pop());
    }
    // Rivalry week last: the two real MFL teams (or the user's closest rival by tier).
    const reals = S.order.filter((id) => TM(id).kind === 'real');
    const pair = reals.length === 2 ? reals : [S.user, S.order.filter((id) => id !== S.user && TM(id).div === TM(S.user).div).sort((a, b) => TM(b).tier - TM(a).tier)[0]];
    const wi = weeks.findIndex((g) => g.some(([h, a]) => (h === pair[0] && a === pair[1]) || (h === pair[1] && a === pair[0])));
    const ordered = shuffle(rng, weeks.filter((_, i) => i !== wi));
    if (wi >= 0) ordered.push(weeks[wi]);
    return ordered.map((g, w) => g.map(([h, a], i) => ({ id: `s${S.season}w${w + 1}g${i}`, h, a, done: false, riv: !!(pair[0] && pair[1] && ((h === pair[0] && a === pair[1]) || (h === pair[1] && a === pair[0]))) })));
  }
  function weatherFor(gid, wk) {
    const r = rngFrom(S.seed + ':wx:' + gid), x = r();
    const late = wk >= 8;
    if (late) return x < 0.33 ? 'clear' : x < 0.58 ? 'night' : x < 0.82 ? 'rain' : 'snow';
    return x < 0.55 ? 'clear' : x < 0.85 ? 'night' : 'rain';
  }
  const WX = { clear: 'Sunny', night: 'Friday night lights', rain: 'Rain', snow: 'Snow' };

  // ---------- simulation ----------
  const SK = ['pa', 'pc', 'py', 'ptd', 'pi', 'ra', 'ry', 'rtd', 'rc', 'rcy', 'rctd', 'fga', 'fgm', 'tk', 'sk', 'it', 'skd'];
  function addLine(dst, line) { for (const k in line) if (typeof line[k] === 'number' && line[k]) dst[k] = (dst[k] || 0) + line[k]; return dst; }
  const offVal = (s) => num(s.py) * 0.05 + num(s.ptd) * 5 - num(s.pi) * 3 + num(s.ry) * 0.085 + num(s.rtd) * 5 + num(s.rcy) * 0.09 + num(s.rctd) * 5.5 + num(s.rc) * 0.3 + num(s.fgm) * 2.5;
  const defVal = (s) => num(s.tk) * 0.8 + num(s.sk) * 4 + num(s.it) * 6;
  const gameVal = (s) => offVal(s) + defVal(s);

  // One drive: returns { pts, kind: 'pass'|'rush'|'fg'|'miss'|'int'|'fum'|'punt'|'safety' }
  function drive(rng, off, def, k, wx, boost) {
    const d = off - def;
    const wp = wx === 'snow' ? 0.04 : wx === 'rain' ? 0.025 : 0;
    const pTD = clamp(0.27 + d * 0.0105 - wp + (boost || 0), 0.05, 0.64);
    const pFG = clamp(0.12 + d * 0.002, 0.05, 0.2);
    const x = rng();
    if (x < pTD) {
      let pts = 6;
      if (rng() < 0.06) pts += rng() < 0.45 ? 2 : 0;
      else pts += rng() < clamp(0.86 + (k - 60) / 250 - wp, 0.7, 0.99) ? 1 : 0;
      return { pts, kind: rng() < 0.58 + (wx === 'snow' || wx === 'rain' ? -0.12 : 0) ? 'pass' : 'rush' };
    }
    if (x < pTD + pFG) return rng() < clamp(0.62 + (k - 55) / 90 - wp * 2, 0.35, 0.95) ? { pts: 3, kind: 'fg' } : { pts: 0, kind: 'miss' };
    if (rng() < clamp(0.13 - d * 0.003, 0.04, 0.26)) return { pts: 0, kind: rng() < 0.62 ? 'int' : 'fum' };
    if (rng() < 0.006) return { pts: 0, kind: 'safety' };
    return { pts: 0, kind: 'punt' };
  }
  // Split a final score into drives (for games the engine played).
  function decompose(score, rng) {
    score = Math.max(0, Math.round(score));
    const out = [];
    let best = null;
    for (let td = Math.floor(score / 7); td >= 0 && !best; td--) {
      for (const v of [0, -1, 1]) { // 0: all 7s, -1: one missed kick (6), +1: one two-pointer (8)
        if (v && !td) continue;
        const rem = score - td * 7 - v;
        if (rem >= 0 && rem % 3 === 0) { best = { td, v, fg: rem / 3, sf: 0 }; break; }
      }
    }
    if (!best) { const td = Math.floor(score / 7); let rem = score - td * 7; let sf = 0; while (rem % 3 && rem >= 2) { rem -= 2; sf++; } best = { td, v: 0, fg: Math.floor(rem / 3), sf }; }
    for (let i = 0; i < best.td; i++) out.push({ pts: 7 + (i === 0 ? best.v : 0), kind: rng() < 0.58 ? 'pass' : 'rush' });
    for (let i = 0; i < best.fg; i++) out.push({ pts: 3, kind: 'fg' });
    return { drives: out, safeties: best.sf };
  }

  // Box score lines for one team's offense, plus what its opponent's defense earned.
  function offenseBox(t, L, drives, oppL, rng, wx) {
    const lines = {}, line = (p) => lines[p.id] || (lines[p.id] = {});
    const qb = L.QB[0], rb = L.RB[0], wrs = L.WR.filter(Boolean), te = L.TE[0], k = L.K[0];
    const covAvg = avg(oppL.DB.concat(oppL.LB).filter(Boolean), (p) => p.r.cov) || 55;
    const front = avg(oppL.DL.concat(oppL.LB).filter(Boolean), (p) => (p.r.tck + p.r.str) / 2) || 55;
    const passTD = drives.filter((d) => d.kind === 'pass').length, rushTD = drives.filter((d) => d.kind === 'rush').length;
    const ints = drives.filter((d) => d.kind === 'int').length, fums = drives.filter((d) => d.kind === 'fum').length;
    const fgs = drives.filter((d) => d.kind === 'fg').length, miss = drives.filter((d) => d.kind === 'miss').length;
    const wxPass = wx === 'snow' ? 0.9 : wx === 'rain' ? 0.93 : 1;
    let pa = 0, pc = 0, py = 0;
    if (qb) {
      pa = clamp(Math.round(17 + rng() * 9 + passTD * 1.5 - rushTD * 0.5), 8, 36);
      const cp = clamp(0.54 + (qb.r.acc - covAvg) / 170 + gauss(rng) * 0.07, 0.34, 0.84) * wxPass;
      pc = Math.min(pa, Math.max(passTD, Math.round(pa * cp)));
      const recSpd = avg(wrs, (p) => p.r.spd) || 60;
      const ypc = clamp(9.2 + (qb.r.thr - 60) / 12 + (recSpd - covAvg) / 16 + gauss(rng) * 2, 5, 17) * wxPass;
      py = Math.max(0, Math.round(pc * ypc + passTD * 9));
      Object.assign(line(qb), { pa, pc, py, ptd: passTD, pi: ints });
    }
    // runs
    let ra = 0, ry = 0;
    if (rb) {
      ra = clamp(Math.round(11 + rng() * 8 + rushTD * 1.5), 5, 28);
      const ypc = clamp(3.9 + (slotOvr(rb, 'RB') - front) / 16 + gauss(rng) * 0.8, 1.4, 8.5);
      ry = Math.round(ra * ypc + rushTD * 4);
      let qbTD = 0, rb2TD = 0;
      for (let i = 0; i < rushTD; i++) { const x = rng(); if (qb && x < 0.18) qbTD++; else if (x < 0.32) rb2TD++; }
      const rb2 = (t.depth && t.depth.RB || []).map(PL).find((p) => p && p !== rb && p.t === t.id && healthy(p) && !POS.some((pos) => (L[pos] || []).includes(p)));
      if (rb2) {
        const a2 = Math.max(1, Math.round(ra * (0.2 + rng() * 0.12))), y2 = Math.round(a2 * clamp(ypc + gauss(rng) * 0.9 - 0.4, 1, 8));
        Object.assign(line(rb2), { ra: a2, ry: y2, rtd: rb2TD });
        Object.assign(line(rb), { ra: ra - a2, ry: ry - y2, rtd: rushTD - qbTD - rb2TD });
      } else Object.assign(line(rb), { ra, ry, rtd: rushTD - qbTD });
      if (qb) { const qa = rint(rng, 1, 5), qy = Math.round(qa * clamp(2 + (qb.r.spd - 60) / 10 + gauss(rng) * 2, -1, 9)); Object.assign(line(qb), { ra: qa, ry: qy, rtd: qbTD }); ra += qa; ry += qy; }
      if (fums) { const who = rng() < 0.75 ? rb : qb || rb; line(who).fum = (line(who).fum || 0) + fums; }
    }
    // catches
    const tgt = [];
    wrs.forEach((p, i) => tgt.push({ p, w: [0.3, 0.22, 0.16][i] || 0.1 }));
    if (te) tgt.push({ p: te, w: 0.17 });
    if (rb) tgt.push({ p: rb, w: 0.12 });
    if (tgt.length && pc) {
      const wf = (x) => x.w * (0.6 + x.p.r.cat / 150);
      const rec = new Map(tgt.map((x) => [x.p, { rc: 0, rcy: 0, rctd: 0 }]));
      for (let i = 0; i < pc; i++) rec.get(wpick(rng, tgt, wf).p).rc++;
      const total = sum([...rec.values()], (v) => v.rc) || 1;
      let left = py;
      const arr = [...rec.entries()];
      arr.forEach(([p, v], i) => { const share = i === arr.length - 1 ? left : Math.round(py * (v.rc / total) * clamp(0.75 + (p.r.spd - 55) / 90 + gauss(rng) * 0.15, 0.4, 1.6)); v.rcy = Math.max(v.rc ? v.rc * 2 : 0, Math.min(left, share)); left -= v.rcy; });
      if (left > 0) { const top = arr.sort((a, b) => b[1].rc - a[1].rc)[0]; if (top) top[1].rcy += left; }
      for (let i = 0; i < passTD; i++) { const who = wpick(rng, tgt.filter((x) => rec.get(x.p).rc > 0).length ? tgt.filter((x) => rec.get(x.p).rc > 0) : tgt, wf).p; const v = rec.get(who); v.rctd++; if (!v.rc) { v.rc = 1; v.rcy += 12; } }
      for (const [p, v] of rec) if (v.rc) Object.assign(line(p), addLine(line(p), v));
    }
    if (k && (fgs || miss)) Object.assign(line(k), { fga: fgs + miss, fgm: fgs });
    const oppDL = avg(oppL.DL.filter(Boolean), (p) => (p.r.str + p.r.tck) / 2) || 55, myOL = avg(L.OL.filter(Boolean), (p) => p.r.blk) || 55;
    const sacks = qb ? Math.min(6, poisson(rng, clamp(1.3 + (oppDL - myOL) / 22, 0.3, 3.5))) : 0;
    if (qb && sacks) line(qb).skd = sacks;
    const plays = pa + ra + sacks;
    const team = { plays, yds: py + ry - sacks * 4, py, ry, to: ints + fums, sacks, pts: sum(drives, (d) => d.pts), top: 0 };
    return { lines, team, credit: { tk: pc + ra - sum(drives, (d) => (d.kind === 'pass' || d.kind === 'rush' ? 1 : 0)), sk: sacks, it: ints, ff: fums } };
  }
  // Hand out flag pulls, sacks and interceptions to a defense.
  function defenseCredit(L, credit, rng, lines) {
    const line = (p) => lines[p.id] || (lines[p.id] = {});
    const dl = L.DL.filter(Boolean), lb = L.LB.filter(Boolean), db = L.DB.filter(Boolean);
    const all = [...dl.map((p) => ({ p, w: 0.08 })), ...lb.map((p) => ({ p, w: 0.24 })), ...db.map((p) => ({ p, w: 0.13 }))];
    if (!all.length) return lines;
    const wf = (x) => x.w * (0.6 + x.p.r.tck / 140) * (x.p.tr.includes('motor') ? 1.3 : 1);
    for (let i = 0; i < Math.max(0, credit.tk); i++) { const p = wpick(rng, all, wf).p; line(p).tk = (line(p).tk || 0) + 1; }
    const rush = [...dl.map((p) => ({ p, w: 0.6 })), ...lb.map((p) => ({ p, w: 0.3 }))];
    for (let i = 0; i < credit.sk; i++) { const p = wpick(rng, rush.length ? rush : all, (x) => x.w * (0.5 + x.p.r.str / 120)).p; line(p).sk = (line(p).sk || 0) + 1; }
    const cov = [...db.map((p) => ({ p, w: 0.7 })), ...lb.map((p) => ({ p, w: 0.3 }))];
    for (let i = 0; i < credit.it; i++) { const p = wpick(rng, cov.length ? cov : all, (x) => x.w * (0.5 + x.p.r.cov / 120)).p; line(p).it = (line(p).it || 0) + 1; }
    return lines;
  }
  function timeSplit(rng, a, b) { const tot = S.qmin * 4 * 60, x = clamp(0.5 + (a.plays - b.plays) / 120 + gauss(rng) * 0.04, 0.32, 0.68); a.top = Math.round(tot * x); b.top = tot - a.top; }

  // Simulate a whole game between two teams. `po` = playoff (no ties), `neutral` = no home field.
  function simGame(g, o) {
    o = o || {};
    const rng = rngFrom(S.seed + ':sim:' + g.id + (o.salt || ''));
    const H = TM(g.h), A = TM(g.a), LH = lineup(H), LA = lineup(A);
    const sh = simStrength(H, !g.neu, LH), sa = simStrength(A, false, LA);
    const wx = g.wx || 'clear';
    const n = 9 + (rng() < 0.5 ? 1 : 0);
    const dh = [], da = [];
    const clutch = (L) => (POS.some((pos) => (L[pos] || []).some((p) => p.tr.includes('clutch'))) ? 0.015 : 0);
    for (let i = 0; i < n; i++) { dh.push(drive(rng, sh.off, sa.def, sh.k, wx, i >= n - 2 ? clutch(LH) : 0)); da.push(drive(rng, sa.off, sh.def, sa.k, wx, i >= n - 2 ? clutch(LA) : 0)); }
    let hs = sum(dh, (d) => d.pts) + 2 * da.filter((d) => d.kind === 'safety').length;
    let as = sum(da, (d) => d.pts) + 2 * dh.filter((d) => d.kind === 'safety').length;
    let ot = 0;
    while (hs === as && (o.po || ot < 2) && ot < 12) {
      ot++;
      const x = drive(rng, sh.off + 4, sa.def, sh.k, wx, 0.08), y = drive(rng, sa.off + 4, sh.def, sa.k, wx, 0.08);
      dh.push(x); da.push(y); hs += x.pts; as += y.pts;
      if (o.po && ot >= 11 && hs === as) { hs += 3; dh.push({ pts: 3, kind: 'fg' }); }
    }
    const bh = offenseBox(H, LH, dh, LA, rng, wx), ba = offenseBox(A, LA, da, LH, rng, wx);
    const lines = Object.assign({}, bh.lines, ba.lines);
    defenseCredit(LA, bh.credit, rng, lines); defenseCredit(LH, ba.credit, rng, lines);
    timeSplit(rng, bh.team, ba.team);
    bh.team.pts = hs; ba.team.pts = as;
    return { hs, as, ot: ot > 0, lines, tb: { h: bh.team, a: ba.team }, LH, LA, hl: simHighlights(rng, H, A, dh, da, lines) };
  }
  function simHighlights(rng, H, A, dh, da, lines) {
    const out = [];
    const nm = (id) => lastName((PL(id) || {}).n || '');
    const tops = Object.keys(lines).map((id) => ({ id, v: gameVal(lines[id]), s: lines[id] })).sort((a, b) => b.v - a.v).slice(0, 4);
    for (const x of tops) {
      const s = x.s, p = PL(x.id);
      if (!p) continue;
      if (s.ptd >= 2) out.push(`${nm(x.id)} throws ${s.ptd} TDs (${s.py} yds)`);
      else if (s.rtd >= 2 || s.ry >= 100) out.push(`${nm(x.id)} runs for ${s.ry} yds${s.rtd ? ', ' + plural(s.rtd, 'TD') : ''}`);
      else if (s.rctd >= 2 || s.rcy >= 90) out.push(`${nm(x.id)}: ${s.rc} catches, ${s.rcy} yds${s.rctd ? ', ' + plural(s.rctd, 'TD') : ''}`);
      else if (s.it >= 1) out.push(`${nm(x.id)} picks off ${plural(s.it, 'pass', 'passes')}`);
      else if (s.sk >= 2) out.push(`${nm(x.id)} gets ${s.sk} sacks`);
    }
    return out.slice(0, 4);
  }
  // Lines that came from the engine (keyed by user player id) -> our short keys.
  const ENG_MAP = { passAtt: 'pa', passCmp: 'pc', passYds: 'py', passTD: 'ptd', passInt: 'pi', rushAtt: 'ra', rushYds: 'ry', rushTD: 'rtd', rec: 'rc', recYds: 'rcy', recTD: 'rctd', fgAtt: 'fga', fgMade: 'fgm', sacked: 'skd' };
  function engineLines(stats, ids) {
    const out = {};
    if (!stats || typeof stats !== 'object') return out;
    for (const id of Object.keys(stats)) {
      if (!ids.has(id)) continue;
      const src = stats[id] || {}, l = {};
      for (const k in ENG_MAP) { const v = Math.round(num(src[k])); if (v) l[ENG_MAP[k]] = clamp(v, -99, 999); }
      if (Object.keys(l).length) out[id] = l;
    }
    return out;
  }

  // ---------- news ----------
  function news(text, kind, tm) {
    const w = S.phase === 'playoffs' ? 'P' : S.phase === 'offseason' ? 'O' : String(Math.min(S.week + 1, S.sched.length || 11));
    S.news.unshift({ s: S.season, w, t: String(text).slice(0, 180), k: kind || 'game', tm: tm || null });
    if (S.news.length > 60) S.news.length = 60;
  }

  // ---------- standings ----------
  const recStr = (t) => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;
  const tPct = (t) => pct(t.w, t.l, t.t);
  function regGames() { const out = []; for (const wk of S.sched) for (const g of wk) if (g.done) out.push(g); return out; }
  function h2h(ids) {
    const set = new Set(ids), rec = {};
    for (const id of ids) rec[id] = { w: 0, l: 0, t: 0 };
    for (const g of regGames()) {
      if (!set.has(g.h) || !set.has(g.a)) continue;
      const w = gameWinner(g);
      if (!w) { rec[g.h].t++; rec[g.a].t++; } else { rec[w].w++; rec[w === g.h ? g.a : g.h].l++; }
    }
    return rec;
  }
  // Tiebreakers: win %, head-to-head among the tied teams, division record, point differential, points scored, coin flip.
  function sortTeams(ids) {
    const groups = {};
    for (const id of ids) { const k = tPct(TM(id)).toFixed(4); (groups[k] || (groups[k] = [])).push(id); }
    const out = [];
    for (const k of Object.keys(groups).sort((a, b) => b - a)) {
      const g = groups[k];
      if (g.length === 1) { out.push(g[0]); continue; }
      const hh = h2h(g);
      const coin = (id) => hashStr(S.seed + ':coin:' + S.season + ':' + id);
      g.sort((a, b) => {
        const A = TM(a), B = TM(b);
        return pct(hh[b].w, hh[b].l, hh[b].t) - pct(hh[a].w, hh[a].l, hh[a].t) || pct(B.dw, B.dl, B.dt) - pct(A.dw, A.dl, A.dt) || (B.pf - B.pa) - (A.pf - A.pa) || B.pf - A.pf || coin(b) - coin(a);
      });
      out.push(...g);
    }
    return out;
  }
  const divTeams = (d) => sortTeams(S.order.filter((id) => TM(id).div === d));
  function seedList() {
    const winners = sortTeams([0, 1].map((d) => divTeams(d)[0]).filter(Boolean));
    const rest = sortTeams(S.order.filter((id) => !winners.includes(id)));
    return winners.concat(rest).slice(0, S.poSize);
  }
  function gameWinner(g) { if (!g.done) return null; if (g.fw) return g.fw; return g.hs > g.as ? g.h : g.as > g.hs ? g.a : null; }

  // ---------- power rankings ----------
  function powerRank(pre) {
    const sc = (t) => {
      const gp = t.w + t.l + t.t, R = teamRatings(t);
      if (pre || !gp) return R.ovr + num(t.prest) * 0.05;
      const w8 = Math.min(1, gp / 6);
      return R.ovr * (1.1 - w8 * 0.5) + tPct(t) * 40 * w8 + clamp((t.pf - t.pa) / gp, -21, 21) * 0.6 * w8 + clamp(t.strk, -4, 4) * 0.8;
    };
    const ids = S.order.slice().sort((a, b) => sc(TM(b)) - sc(TM(a)));
    ids.forEach((id, i) => { const t = TM(id); t.prPrev = t.pr || i + 1; t.pr = i + 1; });
  }
  function prBlurb(t) {
    const d = t.prPrev - t.pr, gp = t.w + t.l + t.t;
    if (!gp) {
      const R = teamRatings(t), ps = roster(t.id), star = ps.slice().sort((a, b) => ovr(b) - ovr(a))[0];
      const last = S.hist.seasons[S.hist.seasons.length - 1];
      if (last && last.champ.id === t.id) return `Defending ${CHAMP} champions.`;
      if (star && ovr(star) >= 80) return `Led by ${star.pos} ${star.n} (${ovr(star)} OVR).`;
      if (R.off >= R.def + 3) return 'High-powered offense on paper.';
      if (R.def >= R.off + 3) return 'Built on defense.';
      const young = ps.filter((p) => p.g === 6).length, old = ps.filter((p) => p.g === 8).length;
      if (young >= old + 4) return 'Young roster with lots of upside.';
      if (old >= young + 4) return 'Veteran group with plenty of 8th graders.';
      return star ? `Balanced roster. Watch ${star.pos} ${lastName(star.n)}.` : 'Balanced roster, no glaring holes.';
    }
    if (t.l === 0 && gp >= 3) return 'Still perfect. Everyone is chasing them.';
    if (t.strk >= 3) return `Rolling: ${t.strk} wins in a row.`;
    if (t.strk <= -3) return `Skidding: ${-t.strk} straight losses.`;
    if (d >= 3) return 'Big climb this week.';
    if (d <= -3) return 'Took a tumble this week.';
    if (t.pf - t.pa > gp * 10) return 'Winning big, week after week.';
    if (t.w === 0) return 'Still looking for that first win.';
    return tPct(t) >= 0.5 ? 'Steady and dangerous.' : 'Fighting to stay in the race.';
  }

  // ---------- records book ----------
  const REC_KEYS = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['rc', 'Catches'], ['rcy', 'Receiving yards'], ['rctd', 'Receiving TDs'], ['tk', 'Flag pulls'], ['sk', 'Sacks'], ['it', 'Interceptions'], ['fgm', 'Field goals']];
  const REC_MIN = { py: 250, ptd: 4, ry: 150, rtd: 3, rc: 10, rcy: 150, rctd: 3, tk: 12, sk: 3, it: 2, fgm: 3 };
  function recCheck(book, scope, p, stats, extra) {
    const R = S.hist.rec[book][scope];
    const out = [];
    for (const [k, label] of REC_KEYS) {
      const v = num(stats[k]);
      if (v <= 0) continue;
      const cur = R[k];
      if (cur && cur.id === p.id && scope === 'c') { if (v > cur.v) Object.assign(cur, { v, s: S.season }); continue; }
      if (!cur || v > cur.v) {
        R[k] = { v, n: p.n, id: p.id, t: (TM(p.t) || {}).abbr || '', s: S.season, w: extra || '' };
        const mult = scope === 'g' ? 1 : scope === 's' ? 7 : 16;
        const seasoned = S.season > 1 || S.week >= 5 || S.phase !== 'regular';
        if (cur && book === 'L' && seasoned && v >= (REC_MIN[k] || 3) * mult) out.push(`${p.n} set a league ${scope === 'g' ? 'single-game' : scope === 's' ? 'single-season' : 'career'} record: ${fmt(v)} ${label.toLowerCase()}.`);
      }
    }
    return out;
  }
  function recordsFromLines(lines, wlabel) {
    const msgs = [];
    for (const id in lines) {
      const p = PL(id);
      if (!p) continue;
      msgs.push(...recCheck('L', 'g', p, lines[id], wlabel));
      if (p.t === S.user) recCheck('U', 'g', p, lines[id], wlabel);
    }
    return msgs;
  }
  function teamRec(key, v, t, extra, label) {
    const R = S.hist.rec.T;
    if (!R[key] || v > R[key].v) { R[key] = { v, n: t.name, t: t.abbr, s: S.season, w: extra || '', l: label || '' }; return true; }
    return false;
  }

  // ---------- applying a game ----------
  function applyGame(g, res, po) {
    g.hs = res.hs; g.as = res.as; g.ot = !!res.ot; g.done = true;
    if (res.fw) g.fw = res.fw;
    const H = TM(g.h), A = TM(g.a), win = gameWinner(g);
    if (!po) {
      for (const [t, o, pf, pa] of [[H, A, g.hs, g.as], [A, H, g.as, g.hs]]) {
        const div = t.div === o.div;
        if (!win) { t.t++; if (div) t.dt++; t.strk = 0; } else if (win === t.id) { t.w++; if (div) t.dw++; t.strk = t.strk > 0 ? t.strk + 1 : 1; t.best = Math.max(t.best || 0, t.strk); } else { t.l++; if (div) t.dl++; t.strk = t.strk < 0 ? t.strk - 1 : -1; }
        t.pf += pf; t.pa += pa;
      }
    }
    for (const [t, tb, ob] of [[H, res.tb.h, res.tb.a], [A, res.tb.a, res.tb.h]]) {
      const ts = t.ts || (t.ts = {});
      ts.g = (ts.g || 0) + 1; ts.yds = (ts.yds || 0) + num(tb.yds); ts.yda = (ts.yda || 0) + num(ob.yds); ts.py = (ts.py || 0) + num(tb.py); ts.ry = (ts.ry || 0) + num(tb.ry);
      ts.to = (ts.to || 0) + num(tb.to); ts.tk = (ts.tk || 0) + num(ob.to); ts.pts = (ts.pts || 0) + num(tb.pts); ts.ptsa = (ts.ptsa || 0) + num(ob.pts);
    }
    // player stats: season + career (playoff stats also go in `ps`)
    const played = new Set();
    for (const t of [H, A]) for (const p of roster(t.id)) if (healthy(p)) played.add(p.id);
    for (const id of played) { const p = PL(id); p.s.gp = (p.s.gp || 0) + 1; p.c.gp = (p.c.gp || 0) + 1; }
    for (const id in res.lines) {
      const p = PL(id);
      if (!p) continue;
      addLine(p.s, res.lines[id]); addLine(p.c, res.lines[id]);
      if (po) addLine(p.ps || (p.ps = {}), res.lines[id]);
    }
    const wl = po ? (S.po && poRoundName(S.po.r)) || 'Playoffs' : 'Week ' + (S.week + 1);
    const msgs = recordsFromLines(res.lines, wl);
    for (const [t, pts] of [[H, g.hs], [A, g.as]]) if (teamRec('pts', pts, t, wl, 'Most points in a game') && pts >= 35) msgs.push(`${t.name} set a league record with ${pts} points in a game.`);
    // compact leaders for the scoreboard
    g.ld = Object.keys(res.lines).map((id) => [id, gameVal(res.lines[id])]).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => [x[0], statSummary(res.lines[x[0]], PL(x[0]))]);
    if (g.h === S.user || g.a === S.user) {
      S.box[g.id] = { hs: g.hs, as: g.as, ot: g.ot, fw: g.fw || null, hl: (res.hl || []).slice(0, 12), tb: res.tb, ln: res.lines, pog: res.pog || null, mode: res.mode || 'sim', wx: g.wx || null, q: res.quit ? 1 : 0 };
    }
    return msgs;
  }
  function statSummary(l, p) {
    if (!l) return '';
    const parts = [];
    if (l.pa) parts.push(`${l.pc || 0}/${l.pa}, ${l.py || 0} yds${l.ptd ? ', ' + l.ptd + ' TD' : ''}${l.pi ? ', ' + l.pi + ' INT' : ''}`);
    if (l.ra && (!l.pa || l.ry >= 30 || l.rtd)) parts.push(`${l.ra} car, ${l.ry || 0} yds${l.rtd ? ', ' + l.rtd + ' TD' : ''}`);
    if (l.rc) parts.push(`${l.rc} rec, ${l.rcy || 0} yds${l.rctd ? ', ' + l.rctd + ' TD' : ''}`);
    if (l.fga) parts.push(`${l.fgm || 0}/${l.fga} FG`);
    if (l.tk || l.sk || l.it) parts.push([l.tk ? l.tk + ' pulls' : '', l.sk ? l.sk + ' sack' + (l.sk > 1 ? 's' : '') : '', l.it ? l.it + ' INT' : ''].filter(Boolean).join(', '));
    return parts.slice(0, 2).join(' · ');
  }

  // ---------- weekly development ----------
  function levelUps(p, keys, rng, out) {
    let guard = 0;
    while (p.xp >= 100 && guard++ < 8) {
      p.xp -= 100;
      const o = ovr(p);
      const prob = clamp(0.3 + (p.pot - o) / 12, 0.1, 1);
      if (rng() > prob) continue;
      const opts = RK.filter((k) => WT[p.pos][k] || (keys && keys.includes(k) && k !== 'kick' && k !== 'thr'));
      const k = wpick(rng, opts, (k) => (WT[p.pos][k] || 0.08) + (keys && keys.includes(k) ? 0.15 : 0));
      if (p.r[k] >= 99) continue;
      p.r[k] = Math.min(99, p.r[k] + 1);
      if (out) out.push([p.id, k]);
    }
  }
  function xpFromLine(l, starter, won, pog) {
    l = l || {};
    return (starter ? 12 : 5) + num(l.py) / 15 + num(l.ptd) * 10 + num(l.ry) / 8 + num(l.rtd) * 10 + num(l.rc) * 3 + num(l.rcy) / 10 + num(l.rctd) * 10 + num(l.fgm) * 6 + num(l.tk) * 1.5 + num(l.sk) * 6 + num(l.it) * 10 + (won ? 5 : 0) + (pog ? 20 : 0);
  }
  function trainTeam(t, rng, focusKey, inten, rep) {
    const F = FOCUS[focusKey] || FOCUS.passing, I = INTENSITY[clamp(inten, 0, 2)];
    const mine = t.id === S.user;
    const fac = mine ? 1 + (S.fac.train - 1) * 0.12 : 1.1;
    for (const p of roster(t.id)) {
      const pw = F.pos[p.pos] || 0.15;
      let x = 22 * pw * I.x * fac * (p.inj && p.inj.w > 0 ? 0.3 : 1);
      if (p.pers === 'worker') x *= 1.25; else if (p.pers === 'clown') x *= 0.9;
      if (p.tr.includes('film')) x *= 1.2;
      const st = OFF_POS.includes(p.pos) ? staffStars(t, 'oc') : DEF_POS.includes(p.pos) ? staffStars(t, 'dc') : 1;
      x *= 1 + st * 0.05;
      x *= 0.85 + num(p.mor, 60) / 333;
      p.xp = num(p.xp) + x;
      if (mine && rep) rep.txp[p.id] = (rep.txp[p.id] || 0) + Math.round(x);
      levelUps(p, F.keys, rng, mine && rep ? rep.lvl : null);
    }
  }
  function gameXP(t, lines, L, won, pogId, rng, rep) {
    const starters = new Set(); for (const pos of POS) for (const p of L[pos] || []) starters.add(p.id);
    const mine = t.id === S.user;
    for (const p of roster(t.id)) {
      if (!healthy(p)) continue;
      let x = xpFromLine(lines[p.id], starters.has(p.id), won, p.id === pogId) * (0.85 + num(p.mor, 60) / 333);
      if (mine) x *= 1 + (S.fac.train - 1) * 0.04;
      p.xp = num(p.xp) + x;
      if (mine && rep) rep.gxp[p.id] = (rep.gxp[p.id] || 0) + Math.round(x);
      levelUps(p, null, rng, mine && rep ? rep.lvl : null);
    }
  }
  function moodWeek(t, res, L, lines, rng, inten, bonding) {
    const starters = new Set(); for (const pos of POS) for (const p of L[pos] || []) starters.add(p.id);
    const mine = t.id === S.user;
    const base = mine ? 58 + S.fac.locker * 3 : 64;
    const ps = roster(t.id);
    for (const p of ps) {
      let d = res === 'W' ? 3 : res === 'L' ? -3 : res === 'T' ? 0 : 0;
      if (p.pers === 'competitor') d *= 2; else if (p.pers === 'quiet') d *= 0.5;
      if (p.pers === 'free') d += rint(rng, -4, 4);
      if (starters.has(p.id)) d += 1;
      else if (p.pers !== 'teamfirst' && healthy(p)) {
        const st = (t.depth[p.pos] || []).slice(0, STARTERS[p.pos]).map(PL).filter(Boolean);
        if (st.length && ovr(p) >= Math.min(...st.map(ovr)) - 1) d -= 2; else d -= 0.4;
      }
      if (p.pers === 'showtime' && ['QB', 'RB', 'WR', 'TE'].includes(p.pos)) { const l = lines[p.id] || {}; d += num(l.ra) + num(l.rc) >= 8 || num(l.pa) >= 10 ? 2 : -1; }
      if (mine) d += INTENSITY[clamp(inten, 0, 2)].mor + (bonding ? 3 : 0);
      p.mor = clamp(Math.round((num(p.mor, 60) + d + (base - num(p.mor, 60)) * 0.08) * 10) / 10, 15, 100);
    }
    const leaders = ps.filter((p) => p.pers === 'leader').length, clowns = ps.filter((p) => p.pers === 'clown').length;
    let c = 0.7 + Math.min(leaders, 3) * 0.35 + Math.min(clowns, 2) * 0.2 + (res === 'W' ? 1.2 : res === 'L' ? -0.7 : 0);
    if (mine) c += (S.fac.locker - 1) * 0.4 + (bonding ? 4 : 0);
    t.chem = clamp(Math.round((num(t.chem, 55) + c) * 10) / 10, 20, 100);
  }
  function injuriesFor(t, L, rng, rep, wx) {
    const mine = t.id === S.user;
    const starters = []; for (const pos of POS) for (const p of L[pos] || []) starters.push(p);
    let mult = mine ? (1 - (S.fac.medical - 1) * 0.12) * (1 - num(S.staff.tr && S.staff.tr.s, 1) * 0.08) * INTENSITY[clamp(S.train.i, 0, 2)].inj * (S.train.f === 'conditioning' ? 0.5 : 1) : 0.85;
    if (wx === 'snow' || wx === 'rain') mult *= 1.1;
    for (const p of starters) {
      if (p.inj && p.inj.w > 0) continue;
      let pr = 0.02 * mult * (p.tr.includes('iron') ? 0.35 : 1);
      if (rng() < pr) {
        const [d, w0] = pick(rng, INJ);
        let w = w0;
        if (mine && S.fac.medical >= 4 && w > 1 && rng() < 0.35) w--;
        p.inj = { d, w, k: 'inj' };
        if (rep && mine) rep.inj.push(p.id);
      } else if (rng() < 0.005) {
        const [d, w] = pick(rng, AWAY);
        p.inj = { d, w, k: 'away' };
        if (rep && mine) rep.inj.push(p.id);
      }
    }
  }
  function healWeek(rep) {
    for (const id in S.players) {
      const p = S.players[id];
      if (p.inj && p.inj.w > 0) {
        p.inj.w--;
        if (p.inj.w <= 0) { p.inj = null; if (rep && p.t === S.user) rep.back.push(p.id); }
      } else if (p.inj) p.inj = null;
    }
  }

  // ---------- a week (or a playoff round) ----------
  // userRes (optional): the user's own game, already decided by the engine or a sim:
  //   { hs, as, ot, lines, tb, hl, pog, mode, fw?, quit? } in schedule orientation (hs = home team).
  function newReport() { return { gxp: {}, txp: {}, lvl: [], inj: [], back: [], pts: [], msgs: [], game: null, others: [] }; }
  function processGames(games, userRes, po, rep) {
    const rng = rngFrom(S.seed + ':wk:' + S.season + ':' + (po ? 'p' + S.po.r : S.week));
    const results = [];
    for (const g of games) {
      if (g.done) continue;
      g.wx = g.wx || weatherFor(g.id, po ? 11 : S.week);
      const mine = g.h === S.user || g.a === S.user;
      let res = mine && userRes ? userRes : simGame(g, { po });
      if (!res.LH) { res.LH = lineup(TM(g.h)); res.LA = lineup(TM(g.a)); }
      if (!res.pog) {
        let best = null, bv = -1;
        const win = res.fw || (res.hs > res.as ? g.h : res.as > res.hs ? g.a : null);
        for (const id in res.lines) { const p = PL(id); if (!p) continue; const v = gameVal(res.lines[id]) + (p.t === win ? 4 : 0); if (v > bv) { bv = v; best = id; } }
        res.pog = best;
      }
      rep.msgs.push(...applyGame(g, res, po));
      results.push({ g, res });
    }
    healWeek(rep); // kids who sat out this week count down; new injuries come after
    // XP, mood and injuries for everyone who played
    for (const { g, res } of results) {
      for (const [tid, L, side] of [[g.h, res.LH, 'h'], [g.a, res.LA, 'a']]) {
        const t = TM(tid), w = gameWinner(g);
        const r = !w ? 'T' : w === tid ? 'W' : 'L';
        gameXP(t, res.lines, L, r === 'W', res.pog, rng, rep);
        moodWeek(t, r, L, res.lines, rng, t.id === S.user ? S.train.i : 1, t.id === S.user && S.train.f === 'bonding');
        injuriesFor(t, L, rng, rep, g.wx);
        if (tid === S.user) {
          rep.game = { g, res, r, side };
          const cr = S.cr; if (!po) { if (r === 'W') cr.w++; else if (r === 'L') cr.l++; else cr.t++; }
          let pts = r === 'W' ? 40 : r === 'L' ? 15 : 25;
          rep.pts.push([r === 'W' ? 'Win' : r === 'L' ? 'Game played' : 'Tie', pts]);
          if (po && r === 'W') { rep.pts.push(['Playoff win', 60]); pts += 60; }
          if (side === 'h' && !g.neu) { const h = S.fac.stadium * 8; rep.pts.push(['Home crowd', h]); pts += h; const fans = roster(S.user).filter((p) => p.tr.includes('fan')).length; if (fans) { rep.pts.push(['Fan favorites', fans * 5]); pts += fans * 5; } }
          S.pts += pts;
        }
      }
    }
    // practice for every team
    for (const id of S.order) {
      const t = TM(id);
      if (id === S.user) trainTeam(t, rng, S.train.f, S.train.i, rep);
      else trainTeam(t, rng, pick(rng, ['passing', 'running', 'catching', 'defense', 'conditioning']), 1, null);
    }
    for (const id of S.order) if (id !== S.user || userTeam().auto !== false) fixDepth(TM(id), true); else fixDepth(TM(id));
    return results;
  }
  function weekNews(results, rep) {
    const ut = userTeam();
    for (const { g, res } of results) {
      const H = TM(g.h), A = TM(g.a), w = gameWinner(g);
      const W = w ? TM(w) : null, Lz = w ? TM(w === g.h ? g.a : g.h) : null;
      const ws = w === g.h ? g.hs : g.as, ls = w === g.h ? g.as : g.hs;
      if (g.h === S.user || g.a === S.user) {
        const opp = g.h === S.user ? A : H;
        if (!w) news(`${ut.name} and ${opp.name} battle to a ${g.hs}-${g.as} tie${g.ot ? ' after overtime' : ''}.`, 'game', ut.id);
        else if (w === S.user) news(`${ut.name} beat ${opp.name} ${ws}-${ls}${g.ot ? ' in overtime' : ''}${g.fw ? '' : ''}.${res.pog && PL(res.pog) && PL(res.pog).t === S.user ? ' ' + lastName(PL(res.pog).n) + ' was the player of the game.' : ''}`, 'win', ut.id);
        else news(`${ut.name} fall to ${opp.name} ${ls}-${ws}${g.ot ? ' in overtime' : ''}${g.fw && res.quit ? ' (left early)' : ''}.`, 'loss', opp.id);
        continue;
      }
      if (W && Lz && W.prPrev - Lz.prPrev >= 5) news(`Upset! ${W.name} stun #${Lz.prPrev} ${Lz.name}, ${ws}-${ls}.`, 'upset', W.id);
      else if (W && ws - ls >= 28) news(`${W.name} roll past ${Lz.name}, ${ws}-${ls}.`, 'game', W.id);
      else if (g.ot) news(`${W ? W.name + ' outlast ' + Lz.name + ' ' + ws + '-' + ls : H.name + ' and ' + A.name + ' tie ' + g.hs + '-' + g.as} in overtime.`, 'game', W ? W.id : H.id);
    }
    // the best individual game this week
    let best = null;
    for (const { res } of results) for (const id in res.lines) { const v = gameVal(res.lines[id]); if (!best || v > best.v) best = { id, v, l: res.lines[id] }; }
    if (best && best.v >= 28) { const p = PL(best.id); news(`Big game: ${p.n} (${TM(p.t).abbr}) went off for ${statSummary(best.l, p)}.`, 'star', p.t); }
    for (const id of S.order) { const t = TM(id); if (t.strk === 4 || t.strk === 6 || t.strk === 8) news(`${t.name} have won ${t.strk} straight.`, 'streak', id); }
    // milestones (season totals crossing a mark this week)
    for (const { res } of results) for (const id in res.lines) {
      const p = PL(id), l = res.lines[id];
      for (const [k, mark, label] of [['py', 1000, 'passing yards'], ['ry', 500, 'rushing yards'], ['rcy', 500, 'receiving yards'], ['ptd', 15, 'TD passes']]) {
        const now = num(p.s[k]), before = now - num(l[k]);
        if (before < mark && now >= mark) news(`Milestone: ${p.n} passes ${fmt(mark)} ${label} this season.`, 'milestone', p.t);
      }
    }
    for (const id of rep.inj) { const p = PL(id); if (p) news(`${p.n} (${p.pos}): ${p.inj.d.toLowerCase()}, out ${plural(p.inj.w, 'week')}.`, 'inj', S.user); }
    for (const m of rep.msgs.slice(0, 3)) news(m, 'rec');
  }
  function playWeek(userRes) {
    const rep = newReport();
    const games = S.sched[S.week] || [];
    const results = processGames(games, userRes, false, rep);
    rep.others = results.filter(({ g }) => g.h !== S.user && g.a !== S.user).map(({ g }) => g.id);
    powerRank();
    weekNews(results, rep);
    rep.week = S.week;
    S.week++;
    if (S.week >= S.sched.length) startPlayoffs();
    return rep;
  }
  function userGameNow() {
    if (S.phase === 'regular') return (S.sched[S.week] || []).find((g) => g.h === S.user || g.a === S.user) || null;
    if (S.phase === 'playoffs' && S.po && !S.po.champ) return (S.po.rounds[S.po.r] || []).find((g) => !g.done && (g.h === S.user || g.a === S.user)) || null;
    return null;
  }

  // ---------- playoffs ----------
  function poRoundName(r) {
    const total = (S.po ? S.po.size : S.poSize) === 8 ? 3 : 2;
    if (r === total - 1) return CHAMP;
    return total === 3 ? ['Quarterfinals', 'Semifinals'][r] || 'Playoffs' : 'Semifinals';
  }
  function startPlayoffs() {
    S.phase = 'playoffs';
    const seeds = seedList();
    const pairs = S.poSize === 8 ? [[0, 7], [3, 4], [1, 6], [2, 5]] : [[0, 3], [1, 2]];
    const r0 = pairs.filter(([a, b]) => seeds[a] && seeds[b]).map(([a, b], i) => ({ id: `s${S.season}p0g${i}`, h: seeds[a], a: seeds[b], sh: a + 1, sa: b + 1, done: false }));
    S.po = { size: S.poSize, seeds, rounds: [r0], r: 0, champ: null, ru: null };
    for (const id of seeds) TM(id).at.po++;
    if (seeds.includes(S.user)) S.cr.po++;
    news(`The playoff field is set: ${seeds.map((id, i) => '#' + (i + 1) + ' ' + TM(id).abbr).join(', ')}.`, 'po', seeds[0]);
    if (seeds.includes(S.user)) news(`${userTeam().name} are in the playoffs as the #${seeds.indexOf(S.user) + 1} seed!`, 'po', S.user);
    else news(`${userTeam().name} missed the playoffs this year. There's always next season.`, 'po', S.user);
  }
  function playRound(userRes) {
    const rep = newReport();
    const po = S.po, games = po.rounds[po.r];
    const last = po.r === (po.size === 8 ? 2 : 1);
    if (last) for (const g of games) g.neu = true;
    const results = processGames(games, userRes, true, rep);
    rep.others = results.filter(({ g }) => g.h !== S.user && g.a !== S.user).map(({ g }) => g.id);
    rep.round = po.r;
    for (const { g } of results) {
      const w = gameWinner(g), Lz = w === g.h ? g.a : g.h;
      if (last) news(`${TM(w).name} win the ${CHAMP}, beating ${TM(Lz).name} ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' in overtime' : ''}!`, 'champ', w);
      else news(`${poRoundName(po.r)}: ${TM(w).name} beat ${TM(Lz).name} ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' (OT)' : ''}.`, 'po', w);
    }
    for (const m of rep.msgs.slice(0, 2)) news(m, 'rec');
    if (last) {
      const g = games[0];
      po.champ = gameWinner(g); po.ru = po.champ === g.h ? g.a : g.h;
      rep.champ = po.champ;
      seasonEnd(rep);
    } else {
      const winners = games.map((g) => gameWinner(g));
      const seedOf = (id) => po.seeds.indexOf(id) + 1;
      const next = [];
      for (let i = 0; i < winners.length; i += 2) {
        let [a, b] = [winners[i], winners[i + 1]];
        if (seedOf(b) < seedOf(a)) [a, b] = [b, a];
        next.push({ id: `s${S.season}p${po.r + 1}g${i / 2}`, h: a, a: b, sh: seedOf(a), sa: seedOf(b), done: false, neu: po.r + 1 === (po.size === 8 ? 2 : 1) });
      }
      po.rounds.push(next);
      po.r++;
    }
    powerRank();
    return rep;
  }

  // ---------- awards & season end ----------
  function seasonAwards() {
    const all = Object.values(S.players).filter((p) => num(p.s.gp) >= 3);
    const tp = (p) => tPct(TM(p.t) || { w: 0, l: 0, t: 0 });
    const top = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a))[0] || null;
    const mvp = top(all, (p) => (offVal(p.s) + defVal(p.s) * 0.8) * (0.55 + tp(p) * 0.9) + ovr(p) * 0.15);
    const opoy = top(all.filter((p) => p.pos !== 'K' && p !== mvp), (p) => offVal(p.s) + ovr(p) * 0.05);
    const dpoy = top(all.filter((p) => DEF_POS.includes(p.pos)), (p) => defVal(p.s) + ovr(p) * 0.05);
    const roy = top(all.filter((p) => p.rk === S.season), (p) => offVal(p.s) + defVal(p.s) + ovr(p) * 0.2);
    const coyT = S.order.map(TM).sort((a, b) => (tPct(b) * 11 + b.exp * 0.9) - (tPct(a) * 11 + a.exp * 0.9))[0];
    const posVal = {
      QB: (p) => offVal(p.s), RB: (p) => offVal(p.s), WR: (p) => offVal(p.s), TE: (p) => offVal(p.s) + ovr(p) * 0.3,
      OL: (p) => ovr(p) + num((TM(p.t).ts || {}).ry) / 60 + tp(p) * 10, DL: (p) => defVal(p.s) + ovr(p) * 0.2, LB: (p) => defVal(p.s) + ovr(p) * 0.2, DB: (p) => defVal(p.s) + ovr(p) * 0.2, K: (p) => num(p.s.fgm) * 3 + ovr(p) * 0.3,
    };
    const al1 = [], al2 = [];
    for (const pos of POS) {
      const n = pos === 'WR' || pos === 'DB' ? 3 : STARTERS[pos];
      const list = all.filter((p) => p.pos === pos).sort((a, b) => posVal[pos](b) - posVal[pos](a));
      al1.push(...list.slice(0, n).map((p) => p.id)); al2.push(...list.slice(n, n * 2).map((p) => p.id));
    }
    return { mvp: mvp && mvp.id, opoy: opoy && opoy.id, dpoy: dpoy && dpoy.id, roy: roy && roy.id, coy: coyT && coyT.id, al1, al2 };
  }
  const AWARD_NAMES = { mvp: 'MVP', opoy: 'Offensive Player of the Year', dpoy: 'Defensive Player of the Year', roy: 'Rookie of the Year', coy: 'Coach of the Year', al1: 'All-League 1st Team', al2: 'All-League 2nd Team', champ: CHAMP + ' Champion' };
  function snapP(id) { const p = PL(id); if (!p) return null; const t = TM(p.t) || {}; return { id, n: p.n, pos: p.pos, t: t.abbr, c: t.color, tid: t.id, ph: p.ph || null, line: statSummary(p.s, p) || '' }; }
  function seasonEnd(rep) {
    const A = seasonAwards();
    S.lastAwards = A;
    const ut = userTeam();
    for (const k of ['mvp', 'opoy', 'dpoy', 'roy']) if (A[k]) { const p = PL(A[k]); p.aw.push([k, S.season]); p.mor = clamp(p.mor + 10, 0, 100); if (p.t === S.user) S.pts += 25; news(`${AWARD_NAMES[k]}: ${p.n} (${TM(p.t).abbr}).`, 'award', p.t); }
    for (const id of A.al1) { const p = PL(id); p.aw.push(['al1', S.season]); if (p.t === S.user) S.pts += 10; }
    for (const id of A.al2) PL(id).aw.push(['al2', S.season]);
    if (A.coy) { const t = TM(A.coy); news(`Coach of the Year: ${t.id === S.user ? S.coach : t.coach} of ${t.name}.`, 'award', t.id); if (t.id === S.user) { S.cr.coy++; S.pts += 40; } }
    const champ = TM(S.po.champ), ru = TM(S.po.ru);
    champ.at.titles++; ru.at.fin++;
    (S.hist.titles[champ.id] || (S.hist.titles[champ.id] = [])).push(S.season);
    for (const p of roster(champ.id)) p.aw.push(['champ', S.season]);
    if (champ.id === S.user) { S.cr.titles++; S.pts += 200; }
    // season & career records, history line per player
    for (const id in S.players) {
      const p = S.players[id];
      for (const m of recCheck('L', 's', p, p.s).concat(recCheck('L', 'c', p, p.c)).slice(0, 2)) news(m, 'rec', p.t);
      if (p.t === S.user) { recCheck('U', 's', p, p.s); recCheck('U', 'c', p, p.c); }
      const st = {}; for (const k in p.s) if (p.s[k]) st[k] = p.s[k];
      p.yrs.push({ s: S.season, t: (TM(p.t) || {}).abbr || '', g: p.g, o: ovr(p), st });
      if (p.yrs.length > 4) p.yrs = p.yrs.slice(-4);
    }
    for (const id of S.order) {
      const t = TM(id);
      teamRec('bestw', t.w + tPct(t) / 10, t, `${recStr(t)} in Season ${S.season}`, 'Best regular season');
      teamRec('spts', t.pf, t, `Season ${S.season}`, 'Most points in a season');
      teamRec('strk', t.best || 0, t, `Season ${S.season}`, 'Longest win streak');
      t.at.w += t.w; t.at.l += t.l; t.at.t += t.t;
      const won = S.po.champ === id ? 25 : S.po.ru === id ? 12 : S.po.seeds.includes(id) ? 6 : 0;
      t.prest = clamp(Math.round(num(t.prest, 40) * 0.7 + (tPct(t) * 45 + won + avg(FAC_KEYS, (k) => (id === S.user ? S.fac[k] : 2)) * 3) * 0.3 + 4), 5, 100);
    }
    const seed = S.po.seeds.indexOf(S.user);
    let fin = 'Missed the playoffs';
    if (S.po.champ === S.user) fin = 'Champions'; else if (S.po.ru === S.user) fin = 'Runner-up';
    else if (seed >= 0) { const r = S.po.rounds.findIndex((rd) => rd.some((g) => (g.h === S.user || g.a === S.user) && gameWinner(g) !== S.user)); fin = 'Lost in the ' + poRoundName(r); }
    const div = divTeams(ut.div).indexOf(S.user) + 1;
    const met = goalMet();
    if (S.goal) { if (met) { S.pts += 75; news(`Goal met: ${S.goal.t.toLowerCase()}. The boosters chipped in 75 points!`, 'award', S.user); } else news(`Missed this year's goal (${S.goal.t.toLowerCase()}).`, 'off', S.user); }
    S.hist.seasons.push({
      s: S.season, y: S.year, champ: { id: champ.id, n: champ.name, a: champ.abbr, c: champ.color }, ru: { id: ru.id, n: ru.name, a: ru.abbr },
      user: { id: ut.id, n: ut.name, rec: recStr(ut), pf: ut.pf, pa: ut.pa, div, seed: seed + 1, fin, goal: S.goal ? S.goal.t : '', met: met ? 1 : 0 },
      aw: { mvp: snapP(A.mvp), opoy: snapP(A.opoy), dpoy: snapP(A.dpoy), roy: snapP(A.roy), coy: A.coy ? { n: A.coy === S.user ? S.coach : TM(A.coy).coach, t: TM(A.coy).abbr, tn: TM(A.coy).name } : null },
      al: A.al1.map(snapP).filter(Boolean).map((x) => ({ n: x.n, pos: x.pos, t: x.t, id: x.id })),
      top: S.order.map(TM).sort((a, b) => a.pr - b.pr).slice(0, 3).map((t) => t.abbr),
    });
    S.phase = 'offseason';
    S.off = { step: 'recap' };
    rep.seasonOver = true;
  }

  // ---------- offseason ----------
  const OFF_STEPS = ['recap', 'grad', 'dev', 'recruit', 'signed', 'transfer', 'ready'];
  const OFF_LABEL = { recap: 'Season recap', grad: 'Graduation', dev: 'Development', recruit: 'Recruiting', signed: 'Signing Day', transfer: 'New in town', ready: 'Next season' };
  const AW_W = { mvp: 70, opoy: 45, dpoy: 45, roy: 20, al1: 16, al2: 8, champ: 6 };
  function careerLine(c, pos) {
    c = c || {};
    const parts = [];
    if (num(c.py) >= 200) parts.push(`${fmt(c.py)} pass yds, ${num(c.ptd)} TD`);
    if (num(c.ry) >= 150) parts.push(`${fmt(c.ry)} rush yds, ${num(c.rtd)} TD`);
    if (num(c.rcy) >= 150) parts.push(`${fmt(c.rcy)} rec yds, ${num(c.rctd)} TD`);
    if (num(c.tk) >= 20 || DEF_POS.includes(pos)) parts.push(`${num(c.tk)} flag pulls${num(c.sk) ? ', ' + num(c.sk) + ' sacks' : ''}${num(c.it) ? ', ' + num(c.it) + ' INT' : ''}`);
    if (num(c.fga)) parts.push(`${num(c.fgm)}/${num(c.fga)} FG`);
    return parts.slice(0, 2).join(' · ') || `${num(c.gp)} games played`;
  }
  const awardScore = (p) => sum(p.aw || [], (a) => AW_W[a[0]] || 0);
  const hofScore = (p) => offVal(p.c) * 0.55 + defVal(p.c) * 0.7 + awardScore(p) + ovr(p) * 0.6;
  function awardLabels(p) {
    const order = ['mvp', 'opoy', 'dpoy', 'roy', 'champ', 'al1', 'al2'];
    const cnt = {};
    for (const [k] of p.aw || []) cnt[k] = (cnt[k] || 0) + 1;
    return order.filter((k) => cnt[k]).map((k) => (cnt[k] > 1 ? cnt[k] + 'x ' : '') + (k === 'champ' ? CHAMP + ' champ' : AWARD_NAMES[k]));
  }
  function doGraduation() {
    const grads = Object.values(S.players).filter((p) => p.g >= 8);
    const mine = [], hof = [];
    const scored = grads.map((p) => ({ p, v: hofScore(p) })).sort((a, b) => b.v - a.v);
    scored.forEach(({ p, v }, i) => {
      const t = TM(p.t) || {};
      const mvp = p.aw.some((a) => a[0] === 'mvp');
      const league = (i < 2 && v >= 200) || mvp || v >= 330;
      const school = !league && p.t === S.user && v >= 120 && !mine.some((x) => x.hof);
      const inducted = league || school;
      if (inducted) {
        const yrs = p.yrs.map((y) => y.s);
        const e = { n: p.n, pos: p.pos, t: t.abbr, tn: t.name, c: t.color, c2: t.color2, ph: p.ph || null, s0: yrs.length ? Math.min(...yrs) : S.season, s1: S.season, line: careerLine(p.c, p.pos), aw: awardLabels(p), o: ovr(p), my: p.t === S.user ? 1 : 0, lg: league ? 1 : 0, in: S.season };
        S.hist.hof.push(e); hof.push(e);
        news(league ? `${p.n} (${t.abbr}) is headed to the league Hall of Fame.` : `${p.n} joins the ${t.name} Hall of Fame.`, 'award', p.t);
      }
      if (p.t === S.user) mine.push({ n: p.n, pos: p.pos, num: p.num, ph: p.ph || null, o: ovr(p), yrs: p.yrs.length, line: careerLine(p.c, p.pos), aw: awardLabels(p), hof: inducted ? 1 : 0, mfl: p.mfl ? 1 : 0 });
      delete S.players[p.id];
    });
    if (S.hist.hof.length > 80) { S.hist.hof.sort((a, b) => b.my - a.my || b.in - a.in); S.hist.hof.length = 80; }
    S.off.hof = hof.filter((e) => e.lg).map((e) => e.n);
    invalidate();
    for (const id of S.order) fixDepth(TM(id));
    S.off.grads = mine; S.off.gradAll = grads.length;
    news(`${plural(grads.length, 'eighth grader')} graduated across the league. Good luck in high school!`, 'off');
  }
  function devJump(p, rng) {
    const o0 = ovr(p);
    const growth = p.g === 7 ? 4.6 : 3.3;
    let jump = growth * clamp((p.pot - o0) / 14, 0.12, 1.5) + gauss(rng) * 1.6 + (p.pers === 'worker' ? 1 : 0) + (p.tr.includes('bloomer') ? 2.5 : 0);
    let note = '';
    if (chance(rng, 0.1)) { p.r.str = clamp(p.r.str + 3, 30, 99); p.r.spd = clamp(p.r.spd + 1, 30, 99); note = 'Growth spurt!'; }
    jump = clamp(jump, -1, 11);
    for (const k in WT[p.pos]) p.r[k] = clamp(Math.round(p.r[k] + jump * (1 + gauss(rng) * 0.45)), 30, 99);
    for (const k of RK) if (!WT[p.pos][k] && k !== 'kick' && k !== 'thr') p.r[k] = clamp(Math.round(p.r[k] + rng() * 2), 30, 99);
    const o1 = ovr(p);
    if (!note && o1 - o0 >= 7) note = 'Breakout summer!';
    else if (!note && o1 - o0 <= 0) note = 'Needs a big year.';
    return { from: o0, to: o1, note };
  }
  function doDevelopment() {
    const rng = rngFrom(S.seed + ':dev:' + S.season);
    const mine = [];
    for (const id in S.players) {
      const p = S.players[id];
      p.g = clamp(p.g + 1, 6, 8);
      const d = devJump(p, rng);
      p.xp = Math.round(num(p.xp) * 0.5); p.inj = null; p.mor = clamp(Math.round(num(p.mor, 60) * 0.6 + 26), 30, 100);
      if (p.t === S.user) mine.push({ id: p.id, from: d.from, to: d.to, note: d.note });
    }
    mine.sort((a, b) => (b.to - b.from) - (a.to - a.from));
    S.off.dev = mine;
    for (const id of S.order) fixDepth(TM(id), id !== S.user || userTeam().auto !== false);
  }

  // Recruiting: a class of incoming 6th graders. Stars are public, potential is hidden until scouted.
  const STAR_W = [0, 12, 30, 32, 18, 8];
  function genRecruit(rng, i, used, o) {
    const pos = o.pos, st = o.st;
    const cur = [0, 39, 45, 51, 57, 63][st] + gauss(rng) * 4 + (o.bump || 0);
    let pot = cur + 14 + rng() * 22;
    const gem = chance(rng, 0.1), bust = !gem && chance(rng, 0.1);
    if (gem) pot += 10; if (bust) pot -= 9;
    const r = genRatings(rng, pos, cur);
    return { id: (o.pre || 'r') + S.season + '-' + i, n: genName(rng, used), pos, st, g: o.g || 6, r, pot: clamp(Math.round(pot), 45, 99), pers: pick(rng, PERS_KEYS), tr: chance(rng, 0.28) ? [pick(rng, TRAIT_KEYS)] : [], lk: genLook(rng), sc: o.sc || 0, fit: rint(rng, -10, 18), of: 0, vis: 0, to: null, hs: pick(rng, SCHOOLS), cost: o.cost || 0 };
  }
  function genClass() {
    const rng = rngFrom(S.seed + ':class:' + S.season);
    const used = usedNames();
    const bag = [];
    const W = { QB: 3, RB: 3, WR: 6, TE: 3, OL: 5, DL: 5, LB: 4, DB: 5, K: 2 };
    for (const pos of POS) for (let i = 0; i < W[pos]; i++) bag.push(pos);
    const pool = shuffle(rng, bag).map((pos, i) => genRecruit(rng, i, used, { pos, st: wpick(rng, [1, 2, 3, 4, 5], (s) => STAR_W[s]) }));
    pool.sort((a, b) => b.st - a.st || POS.indexOf(a.pos) - POS.indexOf(b.pos));
    S.off.pool = pool; S.off.scouts = 2 + S.fac.film; S.off.signedDone = false;
  }
  function posNeed(tid, pos, extra) {
    const have = roster(tid).filter((p) => p.pos === pos && (S.phase !== 'offseason' || S.off.step !== 'recap' || p.g < 8)).length + (extra || 0);
    return have < STARTERS[pos] ? 2 : have < ROSTER_TARGET[pos] ? 1 : 0;
  }
  function interestFor(tid, rc) {
    const t = TM(tid);
    const fac = tid === S.user ? avg(FAC_KEYS, (k) => S.fac[k]) : 1.5 + num(t.prest) / 40;
    const fit = tid === S.user ? rc.fit : (hashStr(rc.id + tid) % 29) - 10;
    let v = 22 + num(t.prest) * 0.36 + (fac - 1) * 5 + fit - (rc.st - 3) * 5 + posNeed(tid, rc.pos) * 7;
    if (tid === S.user && rc.vis) v += 14;
    if (S.po && S.po.champ === tid) v += 6;
    return clamp(Math.round(v), 3, 99);
  }
  const interestWord = (v) => (v >= 75 ? 'Very high' : v >= 58 ? 'High' : v >= 40 ? 'Medium' : v >= 25 ? 'Low' : 'Very low');
  const openSpots = () => Math.max(0, ROSTER_MAX - roster(S.user).length);
  const offersOut = () => (S.off && S.off.pool ? S.off.pool.filter((r) => r.of).length : 0);
  const maxOffers = () => Math.min(openSpots(), 10) + 2;
  function signingDay() {
    const rng = rngFrom(S.seed + ':sign:' + S.season);
    const pool = S.off.pool;
    const room = {}; for (const id of S.order) room[id] = (id === S.user ? ROSTER_MAX : 23) - roster(id).length;
    const cpuOffers = {};
    for (const id of S.order) {
      if (id === S.user) continue;
      const t = TM(id);
      const n = Math.max(0, room[id]) + 1;
      const aim = 2 + num(t.prest) / 30;
      const ranked = pool.slice().sort((a, b) => (posNeed(id, b.pos) * 6 - Math.abs(b.st - aim) * 4 + (hashStr(b.id + id) % 7)) - (posNeed(id, a.pos) * 6 - Math.abs(a.st - aim) * 4 + (hashStr(a.id + id) % 7)));
      for (const rc of ranked.slice(0, n)) (cpuOffers[rc.id] || (cpuOffers[rc.id] = [])).push(id);
    }
    const signed = [], lost = [], classes = {};
    for (const rc of pool.slice().sort((a, b) => b.st - a.st || b.pot - a.pot)) {
      const suit = (cpuOffers[rc.id] || []).slice();
      if (rc.of) suit.push(S.user);
      const ok = suit.filter((id) => room[id] > 0);
      if (!ok.length) { if (rc.of) lost.push({ n: rc.n, pos: rc.pos, st: rc.st, to: null }); continue; }
      const tid = wpick(rng, ok, (id) => Math.pow(interestFor(id, rc) + (id === S.user ? 8 : 0), 2));
      room[tid]--;
      rc.to = tid;
      const p = recruitToPlayer(rc, tid, rng);
      (classes[tid] || (classes[tid] = [])).push(rc.st);
      if (tid === S.user) signed.push(p.id); else if (rc.of) lost.push({ n: rc.n, pos: rc.pos, st: rc.st, to: TM(tid).abbr });
    }
    const ranks = S.order.map((id) => ({ id, n: (classes[id] || []).length, pts: sum(classes[id] || [], (s) => s * s) })).sort((a, b) => b.pts - a.pts);
    S.off.signed = signed; S.off.lost = lost; S.off.classRank = ranks.map((x) => [x.id, x.n, x.pts]);
    S.off.signedDone = true;
    const top = ranks[0];
    if (top && top.n) news(`Signing Day: ${TM(top.id).name} land the top recruiting class (${top.n} recruits).`, 'off', top.id);
    const star = pool.filter((r) => r.st === 5 && r.to)[0];
    if (star) news(`Five-star ${POS_NAME[star.pos].toLowerCase()} ${star.n} picks ${TM(star.to).name}.`, 'off', star.to);
    news(`${userTeam().name} signed ${plural(signed.length, 'recruit')}.`, 'off', S.user);
    invalidate();
    for (const id of S.order) fixDepth(TM(id));
  }
  function recruitToPlayer(rc, tid, rng) {
    const p = {
      id: 'g' + S.nid++, n: rc.n, t: tid, pos: rc.pos, g: rc.g || 6, num: 0, ph: null, lk: rc.lk || genLook(rng), mfl: null, r: Object.assign({}, rc.r), pot: rc.pot, xp: 0, mor: 70,
      pers: rc.pers, tr: rc.tr.slice(), inj: null, s: {}, c: {}, yrs: [], aw: [], rk: S.season + 1, ps: {}, st: rc.st,
    };
    addPlayer(p);
    p.num = pickNum(rng, tid, p.pos);
    return p;
  }
  function genTransfers() {
    const rng = rngFrom(S.seed + ':fa:' + S.season);
    const used = usedNames();
    const fa = [];
    for (let i = 0; i < 5; i++) {
      const st = wpick(rng, [2, 3, 4], (s) => (s === 3 ? 3 : 2));
      const g = chance(rng, 0.6) ? 7 : 8;
      fa.push(genRecruit(rng, i, used, { pos: pick(rng, POS.filter((p) => p !== 'K')), st, g, sc: 2, pre: 'f', bump: (g - 6) * 5, cost: 20 + st * 22 }));
    }
    S.off.fa = fa;
  }
  function finishTransfers() {
    const rng = rngFrom(S.seed + ':fa2:' + S.season);
    for (const rc of (S.off.fa || []).filter((r) => !r.to)) {
      const opts = S.order.filter((id) => id !== S.user && roster(id).length < 23);
      if (!opts.length || rng() < 0.3) continue;
      rc.to = pick(rng, opts);
      recruitToPlayer(rc, rc.to, rng).rk = S.season + 1;
    }
  }
  // Walk-ons fill any holes so every team can field a lineup.
  function fillWalkOns() {
    const rng = rngFrom(S.seed + ':walk:' + S.season);
    const used = usedNames();
    const mineBefore = new Set(roster(S.user).map((p) => p.id));
    for (const id of S.order) {
      const t = TM(id);
      const base = 45 + num(t.prest) * 0.1;
      const walk = (pos) => { const g = rng() < 0.35 ? 7 : 6; const p = addPlayer(makePlayer(rng, { pos, grade: g, target: base + (g - 6) * 5 + gauss(rng) * 4, team: id, used })); p.rk = S.season + 1; p.walk = 1; return p; };
      for (const pos of POS) { let have = roster(id).filter((p) => p.pos === pos).length; while (have++ < ROSTER_TARGET[pos]) walk(pos); }
      while (roster(id).length < ROSTER_MIN) walk(pick(rng, ['WR', 'DB', 'LB', 'OL', 'DL']));
    }
    return roster(S.user).filter((p) => !mineBefore.has(p.id)).map((p) => p.id);
  }
  function advanceOffseason() {
    const step = S.off.step;
    if (step === 'recap') { doGraduation(); S.off.step = 'grad'; }
    else if (step === 'grad') { doDevelopment(); S.off.step = 'dev'; }
    else if (step === 'dev') { genClass(); S.off.step = 'recruit'; }
    else if (step === 'recruit') { signingDay(); S.off.step = 'signed'; }
    else if (step === 'signed') { genTransfers(); S.off.step = 'transfer'; }
    else if (step === 'transfer') { finishTransfers(); S.off.walk = fillWalkOns(); S.off.step = 'ready'; }
    else if (step === 'ready') newSeason();
  }
  function newSeason() {
    const returning = {};
    for (const id of S.order) { const t = TM(id); returning[id] = roster(id).filter((p) => p.yrs.length).length / Math.max(1, roster(id).length); }
    S.season++; S.year++;
    S.week = 0; S.phase = 'regular'; S.po = null; S.box = {}; S.last = null; S.lastAwards = null; S.off = null;
    for (const id of S.order) {
      const t = TM(id);
      Object.assign(t, { w: 0, l: 0, t: 0, dw: 0, dl: 0, dt: 0, pf: 0, pa: 0, strk: 0, best: 0, ts: {} });
      const leaders = roster(id).filter((p) => p.pers === 'leader').length;
      t.chem = clamp(Math.round(36 + returning[id] * 40 + leaders * 2 + (id === S.user ? (S.fac.locker - 1) * 3 : 4)), 25, 90);
      if (id !== S.user) t.tier = clamp(teamRatings(t).ovr - 2, 48, 82);
    }
    for (const id in S.players) { const p = S.players[id]; p.s = {}; p.ps = {}; p.inj = null; }
    for (const id of S.order) fixDepth(TM(id), id !== S.user || userTeam().auto !== false);
    S.sched = makeSchedule(rngFrom(S.seed + ':sched:' + S.season));
    powerRank(true);
    for (const id of S.order) { TM(id).exp = TM(id).pr; TM(id).prPrev = TM(id).pr; }
    setGoal();
    S.hire = genHires(rngFrom(S.seed + ':hire:' + S.season));
    const top = S.order.map(TM).sort((a, b) => a.pr - b.pr)[0];
    news(`Season ${S.season} kicks off! Preseason #1: ${top.name}. ${userTeam().name} start at #${userTeam().pr}.`, 'off', top.id);
    trimSave();
  }
  function trimSave() {
    if (S.news.length > 60) S.news.length = 60;
    S.hist.seasons.forEach((x, i) => { if (S.hist.seasons.length - i > 12) delete x.al; });
    if (S.hist.seasons.length > 60) S.hist.seasons = S.hist.seasons.slice(-60);
    for (const id in S.players) { const p = S.players[id]; if (p.yrs.length > 4) p.yrs = p.yrs.slice(-4); if (p.aw.length > 30) p.aw = p.aw.slice(-30); for (const k of ['s', 'c', 'ps']) for (const x in p[k] || {}) if (!p[k][x]) delete p[k][x]; }
  }

  // ---------- load / validate / migrate ----------
  function migrate(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('This save is empty or broken.');
    const v = num(d.v, 0);
    if (v > SAVE_VERSION) throw new Error('This save was made by a newer version. Refresh the page to update.');
    // Future format changes go here, one step at a time: if (v < 2) { ...; d.v = 2; }
    d.v = SAVE_VERSION;
    return d;
  }
  function validate(d) {
    if (!d.teams || typeof d.teams !== 'object' || !Array.isArray(d.order) || d.order.length < 4) throw new Error('This save is missing its league.');
    d.order = d.order.filter((id) => d.teams[id]);
    if (!d.teams[d.user]) throw new Error('This save is missing your team.');
    if (!d.players || typeof d.players !== 'object') throw new Error('This save is missing its players.');
    d.seed = String(d.seed || uid()); d.id = d.id || uid(); d.name = String(d.name || 'My Franchise').slice(0, 40); d.coach = String(d.coach || 'Coach').slice(0, 30);
    d.diff = clamp(num(d.diff, 1) | 0, 0, 3); d.qmin = [2, 3, 4].includes(d.qmin) ? d.qmin : 2; d.poSize = d.poSize === 8 ? 8 : 4;
    d.season = Math.max(1, num(d.season, 1) | 0); d.year = num(d.year, new Date().getFullYear()) | 0; d.week = Math.max(0, num(d.week, 0) | 0);
    if (!['regular', 'playoffs', 'offseason'].includes(d.phase)) d.phase = 'regular';
    d.nid = Math.max(num(d.nid, 1), 1); d.pts = Math.max(0, Math.round(num(d.pts, 0)));
    d.fac = d.fac && typeof d.fac === 'object' ? d.fac : {}; for (const k of FAC_KEYS) d.fac[k] = clamp(num(d.fac[k], 1) | 0, 1, 5);
    d.staff = d.staff && typeof d.staff === 'object' ? d.staff : {}; for (const k of Object.keys(STAFF)) { const s = d.staff[k]; d.staff[k] = s && typeof s === 'object' ? { n: String(s.n || 'Coach'), s: clamp(num(s.s, 1) | 0, 1, 5) } : { n: 'Coach Smith', s: 1 }; }
    d.train = d.train && FOCUS[d.train.f] ? { f: d.train.f, i: clamp(num(d.train.i, 1) | 0, 0, 2) } : { f: 'passing', i: 1 };
    d.news = Array.isArray(d.news) ? d.news.filter((n) => n && n.t).slice(0, 60) : [];
    d.box = d.box && typeof d.box === 'object' ? d.box : {};
    d.cr = Object.assign({ w: 0, l: 0, t: 0, titles: 0, coy: 0, po: 0 }, d.cr || {});
    const h = d.hist = d.hist && typeof d.hist === 'object' ? d.hist : {};
    h.seasons = Array.isArray(h.seasons) ? h.seasons.filter(Boolean) : []; h.hof = Array.isArray(h.hof) ? h.hof.filter(Boolean) : []; h.titles = h.titles && typeof h.titles === 'object' ? h.titles : {};
    h.rec = h.rec && typeof h.rec === 'object' ? h.rec : {};
    for (const b of ['L', 'U']) { h.rec[b] = h.rec[b] && typeof h.rec[b] === 'object' ? h.rec[b] : {}; for (const sc of ['g', 's', 'c']) h.rec[b][sc] = h.rec[b][sc] && typeof h.rec[b][sc] === 'object' ? h.rec[b][sc] : {}; }
    h.rec.T = h.rec.T && typeof h.rec.T === 'object' ? h.rec.T : {};
    for (const id of d.order) {
      const t = d.teams[id];
      t.id = id; t.name = String(t.name || id).slice(0, 30); t.abbr = String(t.abbr || t.name.slice(0, 3)).slice(0, 4); t.color = hexOk(t.color) ? t.color : '#888888'; t.color2 = hexOk(t.color2) ? t.color2 : '#111111';
      t.div = t.div === 1 ? 1 : 0; t.coach = String(t.coach || 'Coach'); t.tier = num(t.tier, 62);
      for (const k of ['w', 'l', 't', 'dw', 'dl', 'dt', 'pf', 'pa', 'strk', 'best', 'prest', 'chem', 'pr', 'prPrev', 'exp']) t[k] = num(t[k], k === 'chem' ? 55 : k === 'prest' ? 40 : k.startsWith('pr') || k === 'exp' ? 6 : 0);
      t.ts = t.ts && typeof t.ts === 'object' ? t.ts : {}; t.depth = t.depth && typeof t.depth === 'object' ? t.depth : {};
      t.at = Object.assign({ w: 0, l: 0, t: 0, titles: 0, po: 0, fin: 0 }, t.at || {});
    }
    for (const id of Object.keys(d.players)) {
      const p = d.players[id];
      if (!p || typeof p !== 'object' || !d.teams[p.t] || !POS.includes(p.pos)) { delete d.players[id]; continue; }
      p.id = id; p.n = String(p.n || 'Player').slice(0, 40); p.g = clamp(num(p.g, 7) | 0, 6, 8); p.num = clamp(num(p.num, 0) | 0, 0, 99);
      p.r = p.r && typeof p.r === 'object' ? p.r : {}; fixRatings(p.r);
      p.pot = clamp(num(p.pot, 70), 30, 99); p.xp = Math.max(0, num(p.xp, 0)); p.mor = clamp(num(p.mor, 60), 0, 100);
      if (!PERS[p.pers]) p.pers = 'quiet';
      p.tr = Array.isArray(p.tr) ? p.tr.filter((x) => TRAITS[x]) : [];
      for (const k of ['s', 'c', 'ps']) p[k] = p[k] && typeof p[k] === 'object' ? p[k] : {};
      p.yrs = Array.isArray(p.yrs) ? p.yrs : []; p.aw = Array.isArray(p.aw) ? p.aw.filter(Array.isArray) : [];
      p.rk = num(p.rk, 1); p.ph = typeof p.ph === 'string' && /^\/[A-Za-z0-9_\-./%]+$/.test(p.ph) ? p.ph : null; p.lk = cleanLook(p.lk);
      if (p.inj && !(p.inj.w > 0)) p.inj = null;
    }
    d.sched = Array.isArray(d.sched) ? d.sched.map((wk) => (Array.isArray(wk) ? wk.filter((g) => g && d.teams[g.h] && d.teams[g.a]) : [])) : [];
    if (!d.sched.length) throw new Error('This save is missing its schedule.');
    d.week = Math.min(d.week, d.sched.length);
    if (d.phase === 'playoffs' && (!d.po || !Array.isArray(d.po.rounds) || !d.po.rounds.length)) { d.phase = 'regular'; d.week = d.sched.length; }
    if (d.phase === 'offseason' && (!d.off || !OFF_STEPS.includes(d.off.step))) d.off = { step: 'recap' };
    if (d.phase !== 'offseason') d.off = null;
    if (d.off) {
      if (['recruit', 'signed'].includes(d.off.step) && !Array.isArray(d.off.pool)) d.off.step = 'dev';
      if (d.off.step === 'transfer' && !Array.isArray(d.off.fa)) d.off.fa = [];
      d.off.scouts = Math.max(0, num(d.off.scouts, 0) | 0);
      for (const k of ['grads', 'dev', 'signed', 'lost', 'classRank', 'walk']) if (d.off[k] != null && !Array.isArray(d.off[k])) delete d.off[k];
    }
    if (d.po) { d.po.rounds = d.po.rounds.map((rd) => (Array.isArray(rd) ? rd.filter((g) => g && d.teams[g.h] && d.teams[g.a]) : [])); d.po.seeds = Array.isArray(d.po.seeds) ? d.po.seeds.filter((id) => d.teams[id]) : []; d.po.r = clamp(num(d.po.r, 0) | 0, 0, d.po.rounds.length - 1); d.po.size = d.po.size === 8 ? 8 : 4; }
    if (d.prac && !(Array.isArray(d.prac.top) && d.prac.top.every(Array.isArray))) d.prac = null;
    for (const id of Object.keys(d.box)) { const b = d.box[id]; if (!b || typeof b !== 'object' || !b.tb || !b.tb.h || !b.tb.a) delete d.box[id]; }
    if (d.goal && !(d.goal.k && d.goal.t)) d.goal = null;
    if (d.hire && typeof d.hire !== 'object') d.hire = null;
    return d;
  }
  function loadState(data) {
    const d = validate(migrate(JSON.parse(JSON.stringify(data))));
    S = d; invalidate();
    for (const id of S.order) fixDepth(TM(id));
    if (S.phase === 'regular' && S.week >= S.sched.length) startPlayoffs();
    return S;
  }

  // ---------- saves: account (API) or this device (localStorage) ----------
  const ACCOUNT = !!BOOT.user;
  const LS_KEY = (slot) => 'mfl-bf-slot-' + slot;
  let LS_OK = true;
  try { localStorage.setItem('mfl-bf-probe', '1'); localStorage.removeItem('mfl-bf-probe'); } catch (e) { LS_OK = false; }
  const MEM = {};
  async function api(path, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 20000);
    try {
      const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin', signal: ctl && ctl.signal } : { credentials: 'same-origin', cache: 'no-store', signal: ctl && ctl.signal });
      let j = null;
      try { j = await r.json(); } catch (e) { j = null; }
      if (!j) throw new Error(r.status === 413 ? 'That save is too big.' : 'The server did not answer (' + r.status + ').');
      return j;
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('The connection timed out.');
      throw e;
    } finally { clearTimeout(tm); }
  }
  function localRead(slot) {
    let s = null;
    try { s = LS_OK ? localStorage.getItem(LS_KEY(slot)) : MEM[slot] || null; } catch (e) { return null; }
    if (!s) return null;
    try { const x = JSON.parse(s); return x && x.data && typeof x.data === 'object' ? x : { broken: true }; } catch (e) { return { broken: true }; }
  }
  function localWrite(slot, obj) {
    const s = JSON.stringify(obj);
    if (!LS_OK) { MEM[slot] = s; return; }
    try { localStorage.setItem(LS_KEY(slot), s); } catch (e) { throw new Error('This device is out of space for saves.'); }
  }
  const Store = {
    async list() {
      if (ACCOUNT) {
        const j = await api('/api/bf/saves');
        if (!j.ok) throw new Error(j.error || 'Could not load your saves.');
        return BOOT.slots.map((s) => { const x = (j.saves || []).find((v) => String(v.slot) === s) || { empty: true }; return x.empty || !x.meta ? { slot: s, empty: true } : { slot: s, meta: x.meta || {}, updated: x.updated || null }; });
      }
      return BOOT.slots.map((s) => { const x = localRead(s); return !x ? { slot: s, empty: true } : x.broken ? { slot: s, broken: true, meta: {} } : { slot: s, meta: x.meta || {}, updated: x.updated || null }; });
    },
    async load(slot) {
      if (ACCOUNT) { const j = await api('/api/bf/save/' + encodeURIComponent(slot)); if (!j.ok || !j.data) throw new Error(j.error || 'Could not load that save.'); return j; }
      const x = localRead(slot);
      if (!x) throw new Error('That slot is empty.');
      if (x.broken) throw new Error('That save is damaged and cannot be opened.');
      return x;
    },
    async save(slot, data, meta) {
      if (ACCOUNT) { const j = await api('/api/bf/save/' + encodeURIComponent(slot), { data, meta }); if (!j.ok) throw new Error(j.error || 'Could not save.'); return j.updated || new Date().toISOString(); }
      const updated = new Date().toISOString();
      localWrite(slot, { meta, data, updated });
      return updated;
    },
    async remove(slot) {
      if (ACCOUNT) { const j = await api('/api/bf/delete/' + encodeURIComponent(slot), {}); if (!j.ok) throw new Error(j.error || 'Could not delete that save.'); return; }
      try { if (LS_OK) localStorage.removeItem(LS_KEY(slot)); else delete MEM[slot]; } catch (e) { throw new Error('Could not delete that save.'); }
    },
  };
  function phaseLabel(d) {
    d = d || S;
    if (d.phase === 'playoffs') return 'Playoffs';
    if (d.phase === 'offseason') return 'Offseason';
    return d.week >= (d.sched || []).length ? 'Regular season done' : 'Week ' + (d.week + 1);
  }
  function metaOf() {
    const t = userTeam();
    return { name: S.name, team: t.name, abbr: t.abbr, color: t.color, color2: t.color2, season: S.season, when: phaseLabel(), record: recStr(t), coach: S.coach, titles: S.cr.titles, diff: DIFFS[S.diff].name, v: SAVE_VERSION };
  }
  function shrinkForSave() {
    trimSave();
    let size = JSON.stringify(S).length;
    if (size <= MAX_SAVE) return size;
    S.news.length = Math.min(S.news.length, 20);
    for (const id in S.box) if (S.box[id].ln) { delete S.box[id].ln; }
    for (const id in S.players) { const p = S.players[id]; p.yrs = p.yrs.slice(-2); }
    S.hist.seasons.forEach((x) => { delete x.al; });
    S.hist.hof = S.hist.hof.slice(-40);
    return JSON.stringify(S).length;
  }
  const Saver = {
    slot: null, status: 'idle', fails: 0, timer: 0, pending: false, inflight: null, again: false, err: '', size: 0,
    mark() {
      if (!S || !this.slot) return;
      S.updated = new Date().toISOString();
      this.pending = true; this.fails = 0;
      this.set('saving');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 300);
    },
    flush() {
      if (!S || !this.slot) return Promise.resolve();
      if (this.inflight) { this.again = true; return this.inflight; }
      if (!this.pending) return Promise.resolve();
      clearTimeout(this.timer);
      this.pending = false; this.set('saving');
      let data;
      try { this.size = shrinkForSave(); data = JSON.parse(JSON.stringify(S)); } catch (e) { this.err = 'Could not prepare the save.'; this.set('error'); return Promise.resolve(); }
      const slot = this.slot, meta = metaOf();
      this.inflight = Store.save(slot, data, meta).then(() => {
        this.fails = 0; this.err = '';
        this.set(this.pending ? 'saving' : 'saved');
      }).catch((e) => {
        this.fails++; this.pending = true; this.err = (e && e.message) || 'Save failed.';
        if (this.fails < 3) { this.set('saving'); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1500 * this.fails); } else this.set('error');
      }).finally(() => {
        this.inflight = null;
        if (this.again) { this.again = false; if (this.pending) this.flush(); }
      });
      return this.inflight;
    },
    retry() { this.fails = 0; this.pending = true; return this.flush(); },
    dirty() { return this.pending || !!this.inflight || this.status === 'error'; },
    set(st) { this.status = st; paintSave(); },
  };
  window.addEventListener('beforeunload', (e) => { if (S && Saver.slot && Saver.dirty()) { try { Saver.flush(); } catch (x) {} if (ACCOUNT || Saver.status === 'error') { e.preventDefault(); e.returnValue = ''; } } });
  window.addEventListener('pagehide', () => { if (S && Saver.slot && !ACCOUNT && Saver.pending) { try { Saver.flush(); } catch (x) {} } });

  // ---------- styles ----------
  const CSS = `
#bfRoot{--bg:#07080b;--s1:#0f1117;--s2:#161922;--s3:#1d212c;--s4:#252a37;--tx:#f5f6f8;--mu:#6f7584;--mu2:#a3a9b6;--gold:#ffc21a;--red:#ff3344;--green:#2bd576;--blue:#5aa9ff;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.13);--tc:#ffc21a;--tca:#ffc21a;--tco:#111;--hdr:60px;--disp:'Barlow Condensed','Inter',system-ui,sans-serif;
  position:relative;min-height:60vh;color:var(--tx);font:14px/1.45 Inter,system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;text-align:left}
#bfRoot *{box-sizing:border-box}
:where(#bfRoot) button{font:inherit;color:inherit}
#bfRoot img{max-width:100%}
.bf-ic{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px}
.bf-ic.bf-fill{fill:currentColor;stroke:none}
.bf-h{font:800 22px/1.05 var(--disp);text-transform:uppercase;letter-spacing:.01em;margin:0}
.bf-h2{font:800 18px/1.1 var(--disp);text-transform:uppercase;letter-spacing:.02em;margin:0}
.bf-k{font:700 10.5px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--mu2)}
.bf-mu{color:var(--mu2)}.bf-mu2{color:var(--mu)}.bf-sm{font-size:12.5px}.bf-xs{font-size:11px}
.bf-gold{color:var(--gold)}.bf-red{color:var(--red)}.bf-green{color:var(--green)}
.bf-px{font-family:'Press Start 2P',monospace;letter-spacing:0}
.bf-row{display:flex;align-items:center;gap:10px;min-width:0}
.bf-row.bf-wrap{flex-wrap:wrap}.bf-row.bf-at{align-items:flex-start}.bf-row.bf-sb{justify-content:space-between}
.bf-sp{flex:1 1 auto;min-width:0}
.bf-grid{display:grid;gap:12px}
.bf-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.bf-trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.bf-card{background:var(--s1);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.bf-card.bf-flat{background:var(--s2)}
.bf-card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;min-width:0}
.bf-card-h .bf-h2{font-size:17px}
.bf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 16px;border-radius:12px;border:1px solid var(--line2);background:var(--s3);color:var(--tx);font:700 14px/1.1 Inter,sans-serif;cursor:pointer;text-decoration:none;transition:transform .12s,background .15s,border-color .15s,opacity .15s;touch-action:manipulation;user-select:none;-webkit-user-select:none;white-space:nowrap}
.bf-btn:hover{background:var(--s4)}
.bf-btn:active{transform:scale(.97)}
.bf-btn:focus-visible,.bf-tab:focus-visible,.bf-lk:focus-visible,.bf-chipbtn:focus-visible,.bf-pick:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.bf-btn[disabled]{opacity:.45;cursor:not-allowed;transform:none}
.bf-btn.bf-pri{background:var(--gold);border-color:var(--gold);color:#121212}
.bf-btn.bf-pri:hover{background:#ffd04d}
.bf-btn.bf-team{background:var(--tc);border-color:var(--tc);color:var(--tco)}
.bf-btn.bf-ghost{background:transparent}
.bf-btn.bf-danger{background:transparent;border-color:rgba(255,51,68,.5);color:#ff6b78}
.bf-btn.bf-danger:hover{background:rgba(255,51,68,.12)}
.bf-btn.bf-sm{min-height:36px;padding:7px 12px;font-size:13px;border-radius:10px}
.bf-btn.bf-xs{min-height:30px;padding:5px 10px;font-size:12px;border-radius:9px}
.bf-btn.bf-block{width:100%}
.bf-btn.bf-big{min-height:54px;font-size:16px;border-radius:14px;padding:12px 20px}
.bf-btn.bf-icon{padding:0;width:44px}
.bf-btn.bf-icon.bf-sm{width:36px}
.bf-btns{display:flex;gap:8px;flex-wrap:wrap}
.bf-btns>.bf-btn{flex:1 1 0}
.bf-lk{background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;cursor:pointer;text-align:left;display:inline-flex;align-items:center;gap:8px;min-width:0;max-width:100%}
.bf-lk:hover .bf-u{text-decoration:underline}
.bf-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:var(--s3);border:1px solid var(--line);font:700 11px/1.3 Inter,sans-serif;color:var(--mu2);white-space:nowrap}
.bf-chip.bf-gold{background:rgba(255,194,26,.12);border-color:rgba(255,194,26,.35);color:var(--gold)}
.bf-chip.bf-red{background:rgba(255,51,68,.12);border-color:rgba(255,51,68,.35);color:#ff7380}
.bf-chip.bf-green{background:rgba(43,213,118,.12);border-color:rgba(43,213,118,.3);color:var(--green)}
.bf-chip.bf-blue{background:rgba(90,169,255,.12);border-color:rgba(90,169,255,.3);color:var(--blue)}
.bf-chipbtn{cursor:pointer}
.bf-sh{position:relative;display:inline-grid;place-items:center;flex:none;width:40px;height:44px;background:var(--c);color:var(--c2);border-radius:9px 9px 50% 50%/9px 9px 34% 34%;box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),0 4px 14px rgba(0,0,0,.35)}
.bf-sh b{font:900 14px/1 var(--disp);letter-spacing:.02em;text-transform:uppercase;margin-top:-4px}
.bf-sh.bf-xs{width:22px;height:24px;border-radius:5px 5px 50% 50%/5px 5px 34% 34%}.bf-sh.bf-xs b{font-size:8.5px;margin-top:-2px}
.bf-sh.bf-s{width:30px;height:33px}.bf-sh.bf-s b{font-size:11px}
.bf-sh.bf-l{width:64px;height:70px;border-radius:13px 13px 50% 50%/13px 13px 34% 34%}.bf-sh.bf-l b{font-size:22px}
.bf-sh.bf-xl{width:96px;height:106px;border-radius:18px 18px 50% 50%/18px 18px 34% 34%}.bf-sh.bf-xl b{font-size:32px}
.bf-av{position:relative;display:inline-grid;place-items:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--c,#333);color:var(--c2,#fff);font:800 14px/1 var(--disp);overflow:hidden;box-shadow:0 0 0 2px var(--s1),0 0 0 3px var(--c,#333)}
.bf-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:var(--s3)}
.bf-av.bf-s{width:30px;height:30px;font-size:11px}.bf-av.bf-l{width:72px;height:72px;font-size:24px}.bf-av.bf-xl{width:104px;height:104px;font-size:34px;box-shadow:0 0 0 3px var(--s1),0 0 0 6px var(--c,#333)}
.bf-ovr{display:inline-grid;place-items:center;min-width:34px;height:28px;padding:0 6px;border-radius:8px;font:800 16px/1 var(--disp);background:var(--s3);color:var(--tx);flex:none}
.bf-ovr.bf-ov5{background:linear-gradient(135deg,#ffd75a,#e6a600);color:#1a1300}.bf-ovr.bf-ov4{background:#17824a;color:#eafff2}.bf-ovr.bf-ov3{background:#1d4f8f;color:#e8f2ff}.bf-ovr.bf-ov2{background:#3a3f4d}.bf-ovr.bf-ov1{background:#2a2d36;color:#a3a9b6}
.bf-ovr.bf-lg{min-width:54px;height:44px;font-size:28px;border-radius:11px}
.bf-stars{color:var(--gold);letter-spacing:1px;font-size:13px;white-space:nowrap}.bf-stars i{font-style:normal;color:#3a3f4d}
.bf-meter{display:block;height:6px;border-radius:99px;background:var(--s3);overflow:hidden;min-width:40px}.bf-meter i{display:block;height:100%;border-radius:inherit;background:var(--mc,var(--gold));width:var(--v)}
.bf-rb{display:grid;grid-template-columns:96px 1fr 30px;align-items:center;gap:8px;font-size:12.5px;padding:3px 0}
.bf-rb span{color:var(--mu2)}.bf-rb b{font:800 15px/1 var(--disp);text-align:right}
.bf-rb .bf-meter{height:8px}
.bf-empty{text-align:center;padding:26px 12px;color:var(--mu2)}
.bf-empty .bf-ic{width:34px;height:34px;color:var(--mu);margin-bottom:6px}
.bf-empty b{display:block;color:var(--tx);font:800 18px/1.2 var(--disp);text-transform:uppercase;margin-bottom:4px}
.bf-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -14px;padding:0 14px}
.bf-tbl{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.bf-tbl th{font:700 10px/1.2 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);text-align:right;padding:6px 6px;border-bottom:1px solid var(--line2);white-space:nowrap}
.bf-tbl td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.bf-tbl th:first-child,.bf-tbl td:first-child,.bf-tbl .bf-l{text-align:left}
.bf-tbl tr.bf-me td{background:rgba(255,194,26,.07)}
.bf-tbl tr.bf-cut td{border-bottom:2px dashed rgba(255,194,26,.35)}
.bf-tbl tr:last-child td{border-bottom:0}
.bf-tbl .bf-lk{max-width:170px}
.bf-seg{display:flex;gap:4px;padding:4px;background:var(--s2);border:1px solid var(--line);border-radius:999px;overflow-x:auto;scrollbar-width:none;max-width:100%}
.bf-seg::-webkit-scrollbar{display:none}
.bf-seg button{flex:1 0 auto;min-height:36px;padding:6px 14px;border:0;border-radius:999px;background:transparent;color:var(--mu2);font:700 13px/1 Inter,sans-serif;cursor:pointer;white-space:nowrap}
.bf-seg button.bf-on{background:var(--s4);color:var(--tx);box-shadow:inset 0 0 0 1px var(--line2)}
.bf-in{animation:bfIn .22s ease-out both}
@keyframes bfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes bfUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes bfFade{from{opacity:0}to{opacity:1}}
@keyframes bfPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
@keyframes bfPulse{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes bfShine{from{background-position:-200% 0}to{background-position:200% 0}}
/* app shell */
.bf-app{padding-bottom:12px}
.bf-top{display:flex;align-items:center;gap:10px;padding:4px 0 12px;min-width:0}
.bf-top .bf-tn{font:800 20px/1 var(--disp);text-transform:uppercase;letter-spacing:.01em}
.bf-top .bf-tsub{font-size:12px;color:var(--mu2);margin-top:3px}
.bf-pts{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(255,194,26,.1);border:1px solid rgba(255,194,26,.3);color:var(--gold);font:800 15px/1 var(--disp);white-space:nowrap;cursor:pointer}
.bf-pts small{font:700 9px/1 Inter;letter-spacing:.1em;opacity:.8}
.bf-save{display:inline-flex;align-items:center;gap:6px;font:600 11.5px/1 Inter,sans-serif;color:var(--mu2);white-space:nowrap;background:none;border:0;padding:6px 2px;cursor:default}
.bf-save i{width:7px;height:7px;border-radius:50%;background:var(--green);flex:none}
.bf-save.bf-saving i{background:var(--gold);animation:bfPulse 1s infinite}
.bf-save.bf-error{color:#ff7380;cursor:pointer;text-decoration:underline}.bf-save.bf-error i{background:var(--red)}
.bf-tabs{display:flex;gap:4px;position:sticky;top:var(--hdr);z-index:30;margin:0 0 14px;padding:8px 0;background:rgba(7,8,11,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.bf-tab{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;border:0;background:transparent;color:var(--mu2);font:700 14px/1 Inter,sans-serif;cursor:pointer;white-space:nowrap;position:relative}
.bf-tab:hover{color:var(--tx);background:var(--s2)}
.bf-tab.bf-on{color:var(--tx);background:var(--s3)}
.bf-tab.bf-on::after{content:'';position:absolute;left:14px;right:14px;bottom:-9px;height:2px;border-radius:2px;background:var(--gold)}
.bf-tab .bf-dot{position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--red)}
.bf-main{min-height:50vh}
/* hub */
.bf-hub{display:grid;gap:12px}
.bf-next{position:relative;overflow:hidden;border-radius:20px;padding:16px;border:1px solid var(--line2);background:radial-gradient(120% 90% at 0% 0%,color-mix(in srgb,var(--c1) 45%,transparent),transparent 60%),radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,var(--c2) 42%,transparent),transparent 60%),var(--s1)}
.bf-next .bf-k{color:#e9ecf2}
.bf-match{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:14px 0 10px}
.bf-side{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;min-width:0}
.bf-side .bf-nm{font:800 17px/1.05 var(--disp);text-transform:uppercase;max-width:100%;overflow-wrap:anywhere}
.bf-side .bf-rec{font-size:12px;color:var(--mu2)}
.bf-vs{font:900 15px/1 var(--disp);color:var(--mu2);text-align:center}
.bf-vs b{display:block;font-size:30px;color:var(--tx);letter-spacing:.02em}
.bf-cmp{display:grid;grid-template-columns:34px 1fr 52px 1fr 34px;align-items:center;gap:6px;font-size:12px;margin:4px 0}
.bf-cmp b{font:800 16px/1 var(--disp)}.bf-cmp b:last-child{text-align:right}
.bf-cmp span{text-align:center;color:var(--mu2);font:700 10px/1 Inter;letter-spacing:.1em}
.bf-cmp .bf-meter{height:7px}.bf-cmp .bf-meter.bf-r{transform:scaleX(-1)}
.bf-qa{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bf-qa .bf-btn{flex-direction:column;gap:5px;min-height:70px;padding:8px 4px;font-size:11.5px;white-space:normal;text-align:center;line-height:1.15;border-radius:14px}
.bf-qa .bf-ic{width:22px;height:22px;color:var(--gold)}
.bf-news{list-style:none;margin:0;padding:0}
.bf-news li{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.4}
.bf-news li:last-child{border-bottom:0}
.bf-news .bf-nw{flex:none;font:800 11px/1 var(--disp);color:var(--mu);width:30px;padding-top:3px;text-transform:uppercase}
.bf-news .bf-bul{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:var(--nc,var(--mu))}
.bf-score{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:9px 10px;border-radius:12px;background:var(--s2);border:1px solid var(--line);font-size:13px;align-items:center;cursor:pointer;text-align:left;width:100%}
.bf-score .bf-tm{display:flex;align-items:center;gap:7px;min-width:0}
.bf-score .bf-tm span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bf-score .bf-pt{font:800 17px/1 var(--disp);text-align:right}
.bf-score .bf-w{color:var(--tx)}.bf-score .bf-lz{color:var(--mu2)}
.bf-score .bf-ld{grid-column:1/-1;font-size:11px;color:var(--mu);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bf-scores{display:grid;grid-template-columns:1fr;gap:8px}
.bf-wl{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;font:800 13px/1 var(--disp);flex:none}
.bf-wl.bf-W{background:rgba(43,213,118,.16);color:var(--green)}.bf-wl.bf-L{background:rgba(255,51,68,.14);color:#ff6b78}.bf-wl.bf-T{background:var(--s3);color:var(--mu2)}
/* schedule */
.bf-wk{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:var(--s1);border:1px solid var(--line);margin-bottom:8px;width:100%;text-align:left;cursor:pointer;color:inherit}
.bf-wk.bf-cur{border-color:rgba(255,194,26,.6);box-shadow:0 0 0 1px rgba(255,194,26,.25) inset}
.bf-wk .bf-wn{font:800 13px/1 var(--disp);color:var(--mu2);text-transform:uppercase;text-align:center}
.bf-wk .bf-wn b{display:block;font-size:22px;color:var(--tx)}
.bf-wk .bf-res{font:800 17px/1 var(--disp);text-align:right;white-space:nowrap}
.bf-tag{display:inline-block;font:700 10px/1 Inter;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:5px;background:var(--s3);color:var(--mu2);vertical-align:1px}
.bf-tag.bf-riv{background:rgba(255,51,68,.15);color:#ff7380}.bf-tag.bf-po{background:rgba(255,194,26,.15);color:var(--gold)}
/* roster */
.bf-plist{display:flex;flex-direction:column}
.bf-prow{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line);width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;cursor:pointer;color:inherit}
.bf-prow:hover{background:rgba(255,255,255,.02)}
.bf-prow .bf-pn{font-weight:700;font-size:14px}
.bf-prow .bf-ps{font-size:12px;color:var(--mu2);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bf-pos{display:inline-block;min-width:26px;text-align:center;font:800 11px/1 var(--disp);letter-spacing:.04em;padding:3px 4px;border-radius:5px;background:var(--s3);color:var(--mu2)}
.bf-inj{color:#ff6b78;font-weight:700}
.bf-dc{display:grid;gap:12px}
.bf-dcg h4{margin:0 0 6px;display:flex;align-items:center;justify-content:space-between;font:800 15px/1 var(--disp);text-transform:uppercase;letter-spacing:.03em}
.bf-dci{display:grid;grid-template-columns:22px auto 1fr auto auto;align-items:center;gap:8px;padding:6px 6px;border-radius:10px;background:var(--s2);margin-bottom:5px;border:1px solid var(--line)}
.bf-dci.bf-st{background:color-mix(in srgb,var(--tc) 12%,var(--s2));border-color:color-mix(in srgb,var(--tc) 35%,transparent)}
.bf-dci.bf-out{opacity:.6}
.bf-dci .bf-n{font:800 13px/1 var(--disp);color:var(--mu2);text-align:center}
.bf-dci .bf-mv{display:flex;gap:4px}
.bf-dci .bf-mv .bf-btn{width:36px;min-height:36px;padding:0}
.bf-focus{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bf-pick{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;border-radius:14px;background:var(--s2);border:1px solid var(--line2);cursor:pointer;text-align:left;color:inherit;min-height:44px}
.bf-pick:hover{border-color:rgba(255,255,255,.25)}
.bf-pick.bf-on{border-color:var(--gold);background:rgba(255,194,26,.08);box-shadow:0 0 0 1px var(--gold) inset}
.bf-pick b{font:800 16px/1.1 var(--disp);text-transform:uppercase}
.bf-pick small{color:var(--mu2);font-size:12px;line-height:1.35}
.bf-pick .bf-ck{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;background:var(--gold);color:#111;display:none;place-items:center}
.bf-pick.bf-on .bf-ck{display:grid}.bf-pick .bf-ck .bf-ic{width:13px;height:13px;stroke-width:3}
/* player sheet */
.bf-phead{display:flex;gap:14px;align-items:center;padding:4px 0 14px}
.bf-phead .bf-pname{font:800 26px/1 var(--disp);text-transform:uppercase}
.bf-kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.bf-kv>div{background:var(--s2);border:1px solid var(--line);border-radius:12px;padding:9px 10px;min-width:0}
.bf-kv b{display:block;font:800 19px/1.1 var(--disp);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bf-kv span{font:700 9.5px/1.2 Inter;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)}
.bf-spark{display:flex;align-items:flex-end;gap:6px;height:64px;padding-top:6px}
.bf-spark div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%;font-size:10px;color:var(--mu2)}
.bf-spark i{display:block;width:100%;max-width:34px;border-radius:6px 6px 2px 2px;background:linear-gradient(var(--tca),color-mix(in srgb,var(--tca) 40%,transparent))}
.bf-spark b{font:800 12px/1 var(--disp);color:var(--tx)}
/* sheets & overlays */
.bf-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:flex-end;justify-content:center;background:rgba(4,5,8,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:bfFade .18s both}
.bf-sheet{position:relative;width:100%;max-width:640px;max-height:92vh;max-height:92dvh;overflow-y:auto;overscroll-behavior:contain;background:var(--s1);border:1px solid var(--line2);border-bottom:0;border-radius:22px 22px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));animation:bfUp .24s cubic-bezier(.2,.8,.2,1) both;box-shadow:0 -20px 60px rgba(0,0,0,.5)}
.bf-sheet.bf-sm{max-width:440px}
.bf-sheet-h{display:flex;align-items:center;gap:10px;margin:-2px 0 12px;position:sticky;top:-16px;z-index:2;background:var(--s1);padding:6px 0 8px}
.bf-sheet-h .bf-h{font-size:21px}
.bf-grab{width:40px;height:4px;border-radius:4px;background:var(--line2);margin:-6px auto 10px}
.bf-toast{position:fixed;left:16px;right:16px;margin:0 auto;width:fit-content;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:260;background:var(--s3);border:1px solid var(--line2);color:var(--tx);padding:10px 16px;border-radius:999px;font-weight:700;font-size:13.5px;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:bfUp .2s both;max-width:calc(100vw - 32px);text-align:center}
/* full-screen flows */
.bf-flow{display:flex;flex-direction:column;gap:12px}
.bf-fhead{display:flex;align-items:center;gap:10px}
.bf-banner{position:relative;overflow:hidden;border-radius:20px;padding:18px 16px;text-align:center;border:1px solid var(--line2);background:radial-gradient(100% 120% at 0% 0%,color-mix(in srgb,var(--c1) 55%,transparent),transparent 60%),radial-gradient(100% 120% at 100% 0%,color-mix(in srgb,var(--c2) 50%,transparent),transparent 60%),var(--s1)}
.bf-final{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:10px 0 6px}
.bf-final .bf-big{font:900 54px/1 var(--disp);letter-spacing:-.01em}
.bf-final .bf-big.bf-lose{color:var(--mu2)}
.bf-result{display:inline-block;font:900 13px/1 var(--disp);letter-spacing:.14em;padding:6px 12px;border-radius:999px;text-transform:uppercase}
.bf-result.bf-W{background:var(--green);color:#03250f}.bf-result.bf-L{background:var(--red);color:#fff}.bf-result.bf-T{background:var(--s4);color:var(--tx)}
.bf-keys{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.bf-keys li{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--s2);border-radius:12px;border:1px solid var(--line);font-size:13.5px}
.bf-keys li b.bf-n{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--gold);color:#111;font:800 12px/1 var(--disp)}
.bf-engine{position:relative;min-height:60vh}
.bf-pog{display:flex;align-items:center;gap:14px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(255,194,26,.16),rgba(255,194,26,.02));border:1px solid rgba(255,194,26,.35)}
.bf-xp{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:13px}
.bf-xp .bf-up{color:var(--green);font-weight:700}
.bf-hl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.bf-hl li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px}
.bf-hl li::before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:7px}
/* slots & wizard */
.bf-slots{display:grid;gap:12px}
.bf-slot{position:relative;overflow:hidden;border-radius:18px;padding:14px;background:var(--s1);border:1px solid var(--line);min-width:0}
.bf-slot.bf-full{background:linear-gradient(120deg,color-mix(in srgb,var(--c1) 22%,var(--s1)),var(--s1) 60%)}
.bf-slot .bf-slotn{font:800 11px/1 Inter;letter-spacing:.14em;color:var(--mu);text-transform:uppercase}
.bf-steps{display:flex;gap:6px;margin:0 0 14px}
.bf-steps i{flex:1;height:4px;border-radius:4px;background:var(--s3)}.bf-steps i.bf-on{background:var(--gold)}
.bf-choice{display:grid;gap:10px}
.bf-tcard{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:14px;border-radius:16px;background:linear-gradient(110deg,color-mix(in srgb,var(--c1) 26%,var(--s2)),var(--s2) 70%);border:1px solid var(--line2);cursor:pointer;text-align:left;color:inherit;width:100%}
.bf-tcard.bf-on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
.bf-tcard .bf-h2{font-size:21px}
.bf-faces{display:flex;margin-top:6px}.bf-faces .bf-av{margin-right:-8px}
.bf-in-f{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.bf-in-f label{font:700 11px/1 Inter;letter-spacing:.12em;text-transform:uppercase;color:var(--mu2)}
.bf-inp{width:100%;min-height:46px;padding:10px 12px;border-radius:12px;border:1px solid var(--line2);background:var(--s2);color:var(--tx);font:600 16px/1.2 Inter,sans-serif;outline:none}
.bf-inp:focus{border-color:var(--gold)}
.bf-sw{display:flex;flex-wrap:wrap;gap:8px}
.bf-swb{width:44px;height:44px;border-radius:12px;border:2px solid transparent;cursor:pointer;background:linear-gradient(135deg,var(--a) 50%,var(--b) 50%);padding:0}
.bf-swb.bf-on{border-color:#fff;box-shadow:0 0 0 2px var(--gold)}
.bf-colin{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mu2)}
.bf-colin input{width:48px;height:40px;border:1px solid var(--line2);border-radius:10px;background:var(--s2);padding:3px;cursor:pointer}
.bf-mflp{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.bf-mflp .bf-pick{flex-direction:row;align-items:center;gap:10px;padding:8px 30px 8px 8px}
.bf-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bf-opts.bf-three{grid-template-columns:repeat(3,1fr)}
/* standings & bracket */
.bf-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(200px,1fr);gap:14px;overflow-x:auto;padding-bottom:6px}
.bf-round{display:flex;flex-direction:column;justify-content:space-around;gap:10px}
.bf-bg{border-radius:12px;background:var(--s2);border:1px solid var(--line);overflow:hidden}
.bf-bg .bf-bt{display:grid;grid-template-columns:18px auto 1fr auto;align-items:center;gap:7px;padding:8px 10px;font-size:13px}
.bf-bg .bf-bt+.bf-bt{border-top:1px solid var(--line)}
.bf-bg .bf-bt.bf-w{font-weight:800}.bf-bg .bf-bt.bf-lz{color:var(--mu2)}
.bf-bg .bf-bt .bf-s{font:800 11px/1 var(--disp);color:var(--mu)}
.bf-bg .bf-bt .bf-p{font:800 16px/1 var(--disp)}
.bf-bg.bf-me{border-color:rgba(255,194,26,.5)}
/* program */
.bf-fac{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;border-radius:14px;background:var(--s2);border:1px solid var(--line)}
.bf-fac .bf-fi{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--s3);color:var(--gold)}
.bf-fac .bf-fi .bf-ic{width:22px;height:22px}
.bf-lvl{display:flex;gap:3px;margin:5px 0}.bf-lvl i{width:18px;height:6px;border-radius:3px;background:var(--s4)}.bf-lvl i.bf-on{background:var(--gold)}
/* recruiting */
.bf-rc{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px;border-radius:14px;background:var(--s2);border:1px solid var(--line);margin-bottom:8px}
.bf-rc.bf-of{border-color:rgba(255,194,26,.55);background:color-mix(in srgb,var(--gold) 6%,var(--s2))}
.bf-rc .bf-rcn{font-weight:700}
.bf-rc .bf-rcm{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--mu2);margin-top:3px}
.bf-rc .bf-rca{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.bf-int{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mu2)}
.bf-int .bf-meter{width:56px}
.bf-stepper{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px}
.bf-stepper::-webkit-scrollbar{display:none}
.bf-stepper span{flex:none;font:700 11px/1 Inter;letter-spacing:.06em;text-transform:uppercase;padding:7px 10px;border-radius:999px;background:var(--s2);color:var(--mu)}
.bf-stepper span.bf-on{background:var(--gold);color:#111}.bf-stepper span.bf-done{color:var(--mu2);background:var(--s3)}
/* trophy */
.bf-trophy{position:fixed;inset:0;z-index:240;display:grid;place-items:center;padding:20px;background:radial-gradient(70% 55% at 50% 36%,rgba(255,194,26,.3),transparent 70%),#07080b;animation:bfFade .3s both;text-align:center;overflow:auto}
.bf-trophy .bf-cup{width:140px;height:160px;margin:0 auto 6px;animation:bfPop .7s cubic-bezier(.2,.9,.3,1.3) both}
.bf-trophy h2{font:900 40px/1 var(--disp);text-transform:uppercase;margin:6px 0;background:linear-gradient(90deg,#fff3c4,#ffc21a,#fff3c4);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bfShine 3s linear infinite}
.bf-confetti{position:fixed;inset:0;pointer-events:none;z-index:250;width:100%;height:100%}
.bf-load{display:grid;place-items:center;min-height:240px;color:var(--mu2)}
.bf-spin{width:28px;height:28px;border-radius:50%;border:3px solid var(--s4);border-top-color:var(--gold);animation:bfSpin .8s linear infinite;margin:0 auto 10px}
@keyframes bfSpin{to{transform:rotate(360deg)}}
.bf-note{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:rgba(90,169,255,.08);border:1px solid rgba(90,169,255,.25);font-size:13px;color:#cfe3ff}
.bf-note.bf-warn{background:rgba(255,194,26,.08);border-color:rgba(255,194,26,.3);color:#ffe7a3}
.bf-note.bf-err{background:rgba(255,51,68,.08);border-color:rgba(255,51,68,.3);color:#ffc2c8}
.bf-note .bf-ic{margin-top:1px}
.bf-two{display:grid;gap:12px}
.bf-hide-s{display:none}
@media (max-width:759px){
  .bf-tabs{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:120;margin:0;padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(7,1fr);gap:0;border-bottom:0;border-top:1px solid var(--line2);background:rgba(10,11,15,.94)}
  .bf-tab{flex-direction:column;gap:3px;padding:7px 0 6px;font-size:10px;letter-spacing:.01em;border-radius:10px;min-height:52px;justify-content:center}
  .bf-tab .bf-ic{width:21px;height:21px}
  .bf-tab.bf-on{background:transparent;color:var(--gold)}
  .bf-tab.bf-on::after{left:30%;right:30%;top:0;bottom:auto}
  body.bf-navpad{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}
}
@media (min-width:560px){
  .bf-scores{grid-template-columns:1fr 1fr}
  .bf-focus{grid-template-columns:repeat(3,1fr)}
  .bf-hide-s{display:table-cell}
  .bf-qa{grid-template-columns:repeat(4,1fr)}
}
@media (min-width:760px){
  .bf-top{padding-bottom:6px}
  .bf-ov{align-items:center;padding:20px}
  .bf-sheet{border-radius:22px;border-bottom:1px solid var(--line2);max-height:86vh}
  .bf-grab{display:none}
  .bf-toast{bottom:28px}
  .bf-slots{grid-template-columns:repeat(3,1fr)}
  .bf-two{grid-template-columns:1fr 1fr}
  .bf-hub{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start}
  .bf-hub>.bf-full{grid-column:1/-1}
  .bf-choice{grid-template-columns:1fr 1fr}
  .bf-final .bf-big{font-size:72px}
  .bf-tw{margin:0;padding:0}
}
@media (prefers-reduced-motion:reduce){.bf-in,.bf-sheet,.bf-ov,.bf-trophy,.bf-trophy .bf-cup,.bf-toast{animation:none!important}.bf-trophy h2{animation:none}}
`;
  function injectCSS() {
    if (document.getElementById('bf-css')) return;
    const s = document.createElement('style');
    s.id = 'bf-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- UI building blocks ----------
  const ICONS = {
    hub: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    sched: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    roster: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.3 4.4 2 5 5.4"/>',
    stand: '<path d="M3 20h18M5 20v-6h4v6M10 20V8h4v12M15 20v-9h4v9"/>',
    league: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    prog: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5"/>',
    hist: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    ff: '<path d="M4 6l7 6-7 6zM13 6l7 6-7 6z"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    clear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    rain: '<path d="M7 16a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 7a4.5 4.5 0 0 1 .5 9H7zM8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
    medical: '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',
    train: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    locker: '<rect x="4" y="3" width="7" height="18" rx="1"/><rect x="13" y="3" width="7" height="18" rx="1"/><path d="M8 8v2M16 8v2"/>',
    stadium: '<ellipse cx="12" cy="8" rx="9" ry="3.5"/><path d="M3 8v7c0 2 4 3.5 9 3.5s9-1.5 9-3.5V8M8 11.2V18M16 11.2V18"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    flame: '<path d="M12 3c1.2 3.2 5 5.3 5 10a5 5 0 0 1-10 0c0-2.3 1.2-3.6 2.3-4.6.2 1.8 1 2.9 2.2 3.3C11 9 11 6 12 3z"/>',
    heart: '<path d="M12 20s-7-4.4-9-8.5C1.6 8.4 3.4 5 6.7 5c2 0 3.3 1 5.3 3 2-2 3.3-3 5.3-3 3.3 0 5.1 3.4 3.7 6.5-2 4.1-9 8.5-9 8.5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    scout: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    grad: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c2 2 10 2 12 0v-5M22 9v6"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v15h-7"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>',
    exit: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  const ic = (n, cls) => `<svg class="bf-ic${cls ? ' bf-' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const tierOf = (v) => (v >= 85 ? 'ov5' : v >= 75 ? 'ov4' : v >= 65 ? 'ov3' : v >= 55 ? 'ov2' : 'ov1');
  const barColor = (v) => (v >= 85 ? '#ffc21a' : v >= 75 ? '#2bd576' : v >= 65 ? '#5aa9ff' : v >= 50 ? '#8a90a0' : '#ff6b78');
  function sh(t, size) { if (!t) return ''; return `<span class="bf-sh${size ? ' bf-' + size : ''}" style="--c:${t.color};--c2:${onColor(t)}" aria-hidden="true"><b>${esc(t.abbr)}</b></span>`; }
  function av(p, size, team) {
    const t = team || TM(p.t) || { color: '#3a3f4d', color2: '#ffffff' };
    const img = p.ph ? `<img src="${esc(p.ph)}" alt="" loading="lazy" decoding="async">` : '';
    return `<span class="bf-av${size ? ' bf-' + size : ''}" style="--c:${t.color};--c2:${onColor(t)}" aria-hidden="true">${esc(initials(p.n))}${img}</span>`;
  }
  const ovrB = (v, cls) => `<span class="bf-ovr bf-${tierOf(v)}${cls ? ' bf-' + cls : ''}" title="Overall ${v}">${v}</span>`;
  const meter = (v, max, color) => `<span class="bf-meter"><i style="--v:${clamp((v / (max || 100)) * 100, 0, 100).toFixed(1)}%;--mc:${color || barColor(v)}"></i></span>`;
  function starsH(n) { n = clamp(n | 0, 0, 5); return `<span class="bf-stars" role="img" aria-label="${n} star${n === 1 ? '' : 's'}">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`; }
  const tLink = (t, size) => (t ? `<button class="bf-lk" data-a="team" data-id="${esc(t.id)}">${sh(t, size || 'xs')}<span class="bf-u bf-trunc">${esc(t.name)}</span></button>` : '');
  const pLink = (p, txt) => (p ? `<button class="bf-lk" data-a="player" data-id="${esc(p.id)}"><span class="bf-u bf-trunc">${esc(txt || p.n)}</span></button>` : '');
  const gradeLabel = (g) => ord(g) + ' grade';
  const keyRatings = (pos, r) => Object.keys(WT[pos]).sort((a, b) => WT[pos][b] - WT[pos][a]).slice(0, 3).map((k) => RSHORT[k] + ' ' + r[k]).join(' · ');
  const posTag = (pos) => `<span class="bf-pos">${pos}</span>`;
  const wxIcon = (wx) => ic(wx || 'clear');
  const injTxt = (p) => (p.inj ? `${p.inj.d}, out ${plural(p.inj.w, 'week')}` : '');
  function seg(name, opts, cur) { return `<div class="bf-seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? 'bf-on' : ''}" data-a="sub" data-k="${name}" data-v="${v}">${l}</button>`).join('')}</div>`; }
  function empty(icon, title, text, btn) { return `<div class="bf-empty">${ic(icon)}<b>${esc(title)}</b><div>${text}</div>${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`; }
  const card = (title, body, right, cls) => `<section class="bf-card ${cls || ''}">${title ? `<div class="bf-card-h"><h3 class="bf-h2">${title}</h3>${right || ''}</div>` : ''}${body}</section>`;
  const NEWS_C = { win: '#2bd576', loss: '#ff3344', upset: '#ff9f1a', star: '#ffc21a', inj: '#ff6b78', streak: '#ff9f1a', milestone: '#5aa9ff', po: '#ffc21a', champ: '#ffc21a', award: '#c084fc', rec: '#5aa9ff', off: '#a3a9b6', pr: '#a3a9b6' };
  function newsList(items) {
    if (!items.length) return empty('list', 'No news yet', 'Play a game and the headlines will roll in.');
    return `<ul class="bf-news">${items.map((n) => `<li><span class="bf-nw">${n.w === 'P' ? 'PO' : n.w === 'O' ? 'OFF' : 'W' + esc(n.w)}</span><span class="bf-bul" style="--nc:${NEWS_C[n.k] || '#6f7584'}"></span><span>${esc(n.t)}</span></li>`).join('')}</ul>`;
  }
  function scoreCard(g) {
    const H = TM(g.h), A = TM(g.a), w = gameWinner(g);
    const row = (t, s) => `<div class="bf-tm ${g.done ? (w === t.id ? 'bf-w' : w ? 'bf-lz' : '') : ''}">${sh(t, 'xs')}<span>${esc(t.name)}</span>${g.sh ? `<small class="bf-mu2">#${t.id === g.h ? g.sh : g.sa}</small>` : ''}</div><div class="bf-pt ${g.done ? (w === t.id ? 'bf-w' : w ? 'bf-lz' : '') : ''}">${g.done ? s : ''}</div>`;
    const ld = g.ld && g.ld[0] && PL(g.ld[0][0]) ? `${lastName(PL(g.ld[0][0]).n)}: ${g.ld[0][1]}` : '';
    const mine = g.h === S.user || g.a === S.user;
    return `<button class="bf-score" data-a="${g.done && mine ? 'box' : 'matchup'}" data-id="${esc(g.id)}">${row(A, g.as)}${row(H, g.hs)}<div class="bf-ld">${g.done ? (g.fw && S.box[g.id] && S.box[g.id].q ? 'Left early · ' : '') + (g.ot ? 'Final/OT' : 'Final') + (ld ? ' · ' + esc(ld) : '') : (g.neu ? 'Neutral field' : 'at ' + esc(H.name)) + ' · ' + esc(WX[g.wx || weatherFor(g.id, g.sh ? 11 : Math.max(0, S.sched.findIndex((wk) => wk.includes(g))))] || '')}</div></button>`;
  }
  function findGame(id) {
    for (const wk of S.sched) for (const g of wk) if (g.id === id) return g;
    if (S.po) for (const rd of S.po.rounds) for (const g of rd) if (g.id === id) return g;
    return null;
  }
  function gameLabel(g) {
    if (S.po) for (let r = 0; r < S.po.rounds.length; r++) if (S.po.rounds[r].includes(g)) return poRoundName(r);
    const w = S.sched.findIndex((wk) => wk.includes(g));
    return 'Week ' + (w + 1);
  }

  // ---------- top bar & tabs ----------
  const TABS = [['hub', 'Hub'], ['sched', 'Schedule'], ['roster', 'Roster'], ['stand', 'Standings'], ['league', 'League'], ['prog', 'Program'], ['hist', 'History']];
  function saveInd() {
    const st = Saver.status, cls = st === 'error' ? 'error' : st === 'saving' ? 'saving' : '';
    const txt = st === 'error' ? 'Not saved · Retry' : st === 'saving' ? 'Saving…' : 'Saved';
    const tip = st === 'error' ? Saver.err : ACCOUNT ? 'Saved to your account' : 'Saved on this device';
    return `<button type="button" class="bf-save${cls ? ' bf-' + cls : ''}" data-save ${st === 'error' ? 'data-a="retrySave"' : 'tabindex="-1"'} title="${esc(tip)}" aria-live="polite"><i></i><span>${txt}</span></button>`;
  }
  function paintSave() { if (!ROOT) return; ROOT.querySelectorAll('[data-save]').forEach((el) => { el.outerHTML = saveInd(); }); }
  function topBar() {
    const t = userTeam();
    return `<div class="bf-top">${sh(t)}<div class="bf-sp"><div class="bf-tn bf-trunc">${esc(t.name)}</div><div class="bf-tsub bf-row" style="gap:6px"><span class="bf-trunc">${recStr(t)} · S${S.season} · ${esc(phaseLabel())}</span>${saveInd()}</div></div>
      <button class="bf-pts" data-a="tab" data-tab="prog" title="Program points: spend them on facilities, staff and recruits">${fmt(S.pts)}<small>PTS</small></button>
      <button class="bf-btn bf-icon bf-sm bf-ghost" data-a="menu" aria-label="Franchise menu">${ic('dots')}</button></div>`;
  }
  function tabBar() {
    const alert = { hub: S.phase === 'offseason' || !!userGameNow(), roster: roster(S.user).some((p) => p.inj && p.inj.w > 0 && (userTeam().depth[p.pos] || []).indexOf(p.id) < STARTERS[p.pos]) };
    return `<nav class="bf-tabs" aria-label="Franchise sections">${TABS.map(([k, l]) => `<button class="bf-tab ${UI.tab === k ? 'bf-on' : ''}" data-a="tab" data-tab="${k}" ${UI.tab === k ? 'aria-current="page"' : ''}>${ic(k)}<span>${l}</span>${k === 'roster' && alert.roster ? '<i class="bf-dot" title="An injured starter"></i>' : ''}</button>`).join('')}</nav>`;
  }

  // ---------- Hub ----------
  function cmpRow(label, a, b) {
    return `<div class="bf-cmp"><b>${a}</b>${meter(a, 99, a >= b ? 'var(--gold)' : '#5c6272')}<span>${label}</span><span class="bf-meter bf-r"><i style="--v:${clamp(b / 0.99, 0, 100).toFixed(1)}%;--mc:${b > a ? 'var(--gold)' : '#5c6272'}"></i></span><b>${b}</b></div>`;
  }
  function nextGameCard() {
    const g = userGameNow(), ut = userTeam();
    if (!g) {
      if (S.phase === 'playoffs') {
        const out = !S.po.seeds.includes(S.user);
        return `<section class="bf-next" style="--c1:${ut.color};--c2:#ffc21a"><div class="bf-k">${esc(poRoundName(S.po.r))}</div><h3 class="bf-h" style="margin:8px 0 4px">${out ? 'Missed the playoffs' : 'Eliminated'}</h3><p class="bf-mu" style="margin:0 0 12px">${out ? `The top ${S.poSize} teams made the bracket.` : 'Your season is over, but the playoffs go on.'} Watch the rest, then get ready for the offseason.</p><div class="bf-btns"><button class="bf-btn bf-pri bf-big" data-a="simRound">${ic('ff')} Sim ${esc(poRoundName(S.po.r))}</button><button class="bf-btn bf-big" data-a="sub" data-k="stand" data-v="bracket" data-tab="stand">Bracket</button></div></section>`;
      }
      return '';
    }
    const home = g.h === S.user, opp = TM(home ? g.a : g.h);
    const RU = teamRatings(ut), RO = teamRatings(opp);
    const wx = g.wx || weatherFor(g.id, S.phase === 'playoffs' ? 11 : S.week);
    const po = S.phase === 'playoffs';
    const label = po ? poRoundName(S.po.r) : 'Week ' + (S.week + 1);
    const where = g.neu ? 'Neutral field' : home ? 'Home' : 'Away';
    return `<section class="bf-next" style="--c1:${ut.color};--c2:${opp.color}">
      <div class="bf-row bf-sb bf-wrap"><span class="bf-k">${esc(label)} · ${where}</span><span class="bf-row" style="gap:6px">${g.riv ? '<span class="bf-tag bf-riv">Rivalry</span>' : ''}${po ? '<span class="bf-tag bf-po">Playoffs</span>' : ''}<span class="bf-chip">${wxIcon(wx)} ${esc(WX[wx])}</span></span></div>
      <div class="bf-match"><div class="bf-side">${sh(ut, 'l')}<div class="bf-nm">${esc(ut.name)}</div><div class="bf-rec">${recStr(ut)} · #${ut.pr}</div></div>
        <div class="bf-vs">${home || g.neu ? 'vs' : 'at'}<b>${po && g.sh ? '#' + (home ? g.sh : g.sa) + ' v #' + (home ? g.sa : g.sh) : 'VS'}</b></div>
        <div class="bf-side">${sh(opp, 'l')}<button class="bf-lk bf-nm" data-a="team" data-id="${opp.id}" style="justify-content:center"><span class="bf-u">${esc(opp.name)}</span></button><div class="bf-rec">${recStr(opp)} · #${opp.pr}</div></div></div>
      ${cmpRow('OFF', RU.off, RO.off)}${cmpRow('DEF', RU.def, RO.def)}${cmpRow('OVR', RU.ovr, RO.ovr)}
      <div class="bf-btns" style="margin-top:12px"><button class="bf-btn bf-pri bf-big" data-a="pregame">${ic('play', 'fill')} Play</button><button class="bf-btn bf-big" data-a="simGame">${ic('ff')} Sim game</button></div>
    </section>`;
  }
  function lastGameCard() {
    const id = S.last, g = id && findGame(id), b = id && S.box[id];
    if (!g || !g.done) return '';
    const home = g.h === S.user, opp = TM(home ? g.a : g.h), w = gameWinner(g);
    const r = !w ? 'T' : w === S.user ? 'W' : 'L';
    const us = home ? g.hs : g.as, them = home ? g.as : g.hs;
    const pog = b && b.pog && PL(b.pog);
    return card('Last game', `<div class="bf-row"><span class="bf-wl bf-${r}">${r}</span><div class="bf-sp"><b>${us}-${them}</b> ${home ? 'vs' : 'at'} ${esc(opp.name)}${g.ot ? ' (OT)' : ''}<div class="bf-sm bf-mu">${esc(gameLabel(g))}${pog ? ` · Player of the game: ${esc(pog.n)}` : ''}</div></div><button class="bf-btn bf-sm" data-a="box" data-id="${g.id}">Box score</button></div>`);
  }
  function snapshotCard() {
    const t = userTeam(), R = teamRatings(t), ps = roster(t.id);
    const hurt = ps.filter((p) => p.inj && p.inj.w > 0);
    const mor = moraleAvg(t);
    return card('Team snapshot', `<div class="bf-kv"><div><span>Overall</span><b>${R.ovr}</b></div><div><span>Offense</span><b>${R.off}</b></div><div><span>Defense</span><b>${R.def}</b></div></div>
      <div style="margin-top:12px" class="bf-col"><div><div class="bf-row bf-sb bf-sm"><span>${ic('flame')} Chemistry</span><b>${esc(chemWord(t.chem))}</b></div>${meter(t.chem, 100, '#ff9f1a')}</div>
      <div><div class="bf-row bf-sb bf-sm"><span>${ic('heart')} Morale</span><b>${esc(moraleWord(mor))}</b></div>${meter(mor, 100, '#ff5c8a')}</div></div>
      ${S.goal ? `<div class="bf-row bf-sb bf-sm" style="margin-top:12px;padding:9px 10px;border-radius:10px;background:var(--s2)"><span>${ic('league')} Season goal</span><b class="bf-gold">${esc(S.goal.t)}</b></div>` : ''}
      <div style="margin-top:12px"><div class="bf-k" style="margin-bottom:6px">Injury report</div>${hurt.length ? hurt.map((p) => `<div class="bf-row bf-sm" style="padding:4px 0">${posTag(p.pos)}${pLink(p)}<span class="bf-sp"></span><span class="bf-inj">${esc(injTxt(p))}</span></div>`).join('') : '<div class="bf-sm bf-mu">Everybody is healthy.</div>'}</div>`, `<span class="bf-chip">#${t.pr} in power rankings</span>`);
  }
  function standingsMini() {
    const d = userTeam().div;
    const ids = divTeams(d);
    return card(`${DIVS[d]} Division`, `<table class="bf-tbl"><thead><tr><th>Team</th><th>W-L</th><th>Diff</th><th>Strk</th></tr></thead><tbody>${ids.map((id) => { const t = TM(id); return `<tr class="${id === S.user ? 'bf-me' : ''}"><td class="bf-l">${tLink(t)}</td><td>${recStr(t)}</td><td>${t.pf - t.pa > 0 ? '+' : ''}${t.pf - t.pa}</td><td>${strkStr(t)}</td></tr>`; }).join('')}</tbody></table>`, `<button class="bf-btn bf-xs bf-ghost" data-a="tab" data-tab="stand">All ${ic('right')}</button>`);
  }
  const strkStr = (t) => (t.strk > 0 ? 'W' + t.strk : t.strk < 0 ? 'L' + -t.strk : '-');
  function aroundLeague() {
    const wk = S.phase === 'playoffs' ? (S.po.r > 0 ? S.po.rounds[S.po.r - 1] : S.sched[S.sched.length - 1]) : S.sched[S.week - 1];
    if (!wk) return card('Around the league', empty('league', 'Season opener up next', 'Scores from around the league show up here after Week 1.'));
    const games = wk.filter((g) => g.done && g.h !== S.user && g.a !== S.user);
    return card('Around the league', `<div class="bf-scores">${games.map(scoreCard).join('')}</div>`, `<button class="bf-btn bf-xs bf-ghost" data-a="sub" data-tab="league" data-k="league" data-v="scores">Scores ${ic('right')}</button>`);
  }
  function quickActions() {
    const F = FOCUS[S.train.f];
    return `<div class="bf-qa bf-full"><button class="bf-btn" data-a="sub" data-tab="roster" data-k="roster" data-v="depth">${ic('list')}Depth chart</button><button class="bf-btn" data-a="sub" data-tab="roster" data-k="roster" data-v="train">${ic('train')}Practice: ${esc(F.n)}</button><button class="bf-btn" data-a="tab" data-tab="prog">${ic('prog')}Upgrades</button><button class="bf-btn" data-a="sub" data-tab="league" data-k="league" data-v="leaders">${ic('star')}Leaders</button></div>`;
  }
  function viewHub() {
    if (S.phase === 'offseason') return viewOffseason();
    return `<div class="bf-hub"><div class="bf-col">${nextGameCard()}${quickActions()}${lastGameCard()}${card('Latest news', newsList(S.news.slice(0, 6)), `<button class="bf-btn bf-xs bf-ghost" data-a="sub" data-tab="league" data-k="league" data-v="news">All ${ic('right')}</button>`)}</div>
      <div class="bf-col">${snapshotCard()}${standingsMini()}${aroundLeague()}</div></div>`;
  }

  // ---------- Schedule ----------
  function viewSchedule() {
    const sub = UI.sub.sched || 'mine';
    let body = '';
    if (sub === 'mine') {
      const rows = S.sched.map((wk, w) => {
        const g = wk.find((x) => x.h === S.user || x.a === S.user);
        if (!g) return `<div class="bf-wk"><div class="bf-wn">Wk<b>${w + 1}</b></div><div class="bf-mu">Bye week</div><div></div></div>`;
        return schedRow(g, 'Wk', w + 1, S.phase === 'regular' && w === S.week);
      });
      if (S.po) S.po.rounds.forEach((rd, r) => { const g = rd.find((x) => x.h === S.user || x.a === S.user); if (g) rows.push(schedRow(g, 'PO', r + 1, !g.done && S.po.r === r)); });
      body = `${S.phase === 'regular' && S.week < S.sched.length ? `<div class="bf-row bf-sb bf-wrap" style="margin-bottom:10px"><span class="bf-mu bf-sm">${plural(S.sched.length - S.week, 'game')} left in the regular season</span><button class="bf-btn bf-sm" data-a="simToEnd">${ic('ff')} Sim to playoffs</button></div>` : ''}${rows.join('')}`;
    } else {
      const wk = UI.week == null ? (S.phase === 'regular' ? Math.min(S.week, S.sched.length - 1) : 'P') : UI.week;
      const chips = S.sched.map((_, w) => `<button class="${wk === w ? 'bf-on' : ''}" data-a="weekSel" data-w="${w}">Wk ${w + 1}</button>`).join('') + (S.po ? `<button class="${wk === 'P' ? 'bf-on' : ''}" data-a="weekSel" data-w="P">Playoffs</button>` : '');
      let games = [];
      if (wk === 'P' && S.po) games = [].concat(...S.po.rounds);
      else games = S.sched[wk] || [];
      body = `<div class="bf-seg" style="margin-bottom:12px">${chips}</div><div class="bf-scores">${games.map(scoreCard).join('')}</div>`;
    }
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">Schedule</h2>${seg('sched', [['mine', 'My games'], ['league', 'League week']], sub)}</div>${body}</div>`;
  }
  function schedRow(g, pre, n, cur) {
    const home = g.h === S.user, opp = TM(home ? g.a : g.h), w = gameWinner(g);
    const r = !g.done ? '' : !w ? 'T' : w === S.user ? 'W' : 'L';
    const us = home ? g.hs : g.as, them = home ? g.as : g.hs;
    const wx = g.wx || weatherFor(g.id, n - 1);
    const act = g.done ? 'box' : cur ? 'pregame' : 'team';
    return `<button class="bf-wk ${cur ? 'bf-cur' : ''}" data-a="${act}" data-id="${act === 'team' ? opp.id : g.id}"><div class="bf-wn">${pre}<b>${n}</b></div>
      <div class="bf-row" style="min-width:0">${sh(opp, 's')}<div class="bf-sp"><div class="bf-trunc" style="font-weight:700">${g.neu ? 'vs' : home ? 'vs' : 'at'} ${esc(opp.name)}</div><div class="bf-xs bf-mu bf-row" style="gap:6px">${recStr(opp)}${g.riv ? ' <span class="bf-tag bf-riv">Rivalry</span>' : ''}${g.sh ? ' <span class="bf-tag bf-po">' + esc(gameLabel(g)) + '</span>' : ''}${!g.done ? ' · ' + wxIcon(wx) : ''}</div></div></div>
      <div class="bf-res">${g.done ? `<span class="bf-wl bf-${r}">${r}</span> ${us}-${them}${g.ot ? '<small class="bf-mu"> OT</small>' : ''}` : cur ? '<span class="bf-chip bf-gold">Up next</span>' : ''}</div></button>`;
  }

  // ---------- Roster ----------
  function viewRoster() {
    const sub = UI.sub.roster || 'players';
    const body = sub === 'depth' ? viewDepth() : sub === 'train' ? viewTraining() : viewPlayers();
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">Roster</h2>${seg('roster', [['players', 'Players'], ['depth', 'Depth chart'], ['train', 'Practice']], sub)}</div>${body}</div>`;
  }
  function playerRow(p, extra) {
    const t = TM(p.t);
    return `<button class="bf-prow" data-a="player" data-id="${p.id}">${av(p, '', t)}<div style="min-width:0"><div class="bf-pn bf-trunc">${esc(p.n)}${p.mfl ? ' <span class="bf-chip bf-gold" title="Real MFL player">MFL</span>' : ''}</div><div class="bf-ps">${posTag(p.pos)}<span>#${p.num}</span><span>${ord(p.g)}</span>${p.inj ? `<span class="bf-inj">${ic('medical')} ${esc(p.inj.d)} (${p.inj.w}w)</span>` : `<span>${esc(PERS[p.pers].n)}</span>`}${extra || ''}</div></div>${ovrB(ovr(p))}</button>`;
  }
  function viewPlayers() {
    const f = UI.filter.pos || 'all';
    const t = userTeam(), ps = roster(t.id);
    const list = ps.filter((p) => f === 'all' || (f === 'off' ? OFF_POS.includes(p.pos) : f === 'def' ? DEF_POS.includes(p.pos) : p.pos === 'K'))
      .sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || (t.depth[a.pos] || []).indexOf(a.id) - (t.depth[b.pos] || []).indexOf(b.id));
    const grads = ps.filter((p) => p.g === 8).length;
    return `<div class="bf-kv"><div><span>Players</span><b>${ps.length}</b></div><div><span>Avg OVR</span><b>${Math.round(avg(ps, ovr))}</b></div><div><span>8th graders</span><b>${grads}</b></div></div>
      ${seg('pos', [['all', 'All'], ['off', 'Offense'], ['def', 'Defense'], ['k', 'Kicker']], f)}
      <div class="bf-card" style="padding:4px 12px"><div class="bf-plist">${list.map((p) => playerRow(p)).join('') || empty('roster', 'Nobody here', 'No players at this spot.')}</div></div>`;
  }
  function viewDepth() {
    const t = userTeam();
    fixDepth(t);
    const L = lineup(t);
    const rec = [...L.WR, ...L.TE].filter(Boolean).slice(0, 4);
    const fill = L._fill || {};
    const preview = `<div class="bf-note">${ic('info')}<div><b>On the field in 3D Blitz:</b> QB ${L.QB[0] ? esc(L.QB[0].n) : '?'} · Receivers ${rec.map((p) => esc(lastName(p.n))).join(', ') || '?'} · RB ${L.RB[0] ? esc(lastName(L.RB[0].n)) : '?'}. Injured kids sit automatically and the next one up plays.</div></div>`;
    const groups = POS.map((pos) => {
      const ids = t.depth[pos] || [];
      const items = ids.map((id, i) => {
        const p = PL(id), st = i < STARTERS[pos], out = p.inj && p.inj.w > 0;
        return `<div class="bf-dci ${st ? 'bf-st' : ''} ${out ? 'bf-out' : ''}"><span class="bf-n">${i + 1}</span>${av(p, 's', t)}<div style="min-width:0">${pLink(p)}<div class="bf-xs bf-mu">${out ? `<span class="bf-inj">${esc(injTxt(p))}</span>` : st ? 'Starter' : 'Backup'} · ${ord(p.g)}</div></div>${ovrB(ovr(p))}<div class="bf-mv"><button class="bf-btn bf-sm bf-ghost" data-a="depthMv" data-pos="${pos}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.n)} up">${ic('up')}</button><button class="bf-btn bf-sm bf-ghost" data-a="depthMv" data-pos="${pos}" data-i="${i}" data-d="1" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(p.n)} down">${ic('down')}</button></div></div>`;
      }).join('');
      const fills = (L[pos] || []).filter((p) => fill[p.id] === pos).map((p) => `<div class="bf-xs bf-mu" style="margin:2px 0 6px">${esc(p.n)} (${p.pos}) fills in at ${pos} this week.</div>`).join('');
      return `<div class="bf-dcg"><h4>${POS_NAME[pos]} <span class="bf-xs bf-mu">${STARTERS[pos]} starter${STARTERS[pos] > 1 ? 's' : ''}</span></h4>${items || '<div class="bf-sm bf-mu">Nobody at this position.</div>'}${fills}</div>`;
    }).join('');
    return `${preview}<div class="bf-row bf-sb bf-wrap"><span class="bf-sm bf-mu">${t.auto !== false ? 'Auto mode: best healthy players start every week.' : 'Custom order. Your changes stay until you switch back to auto.'}</span><button class="bf-btn bf-sm ${t.auto !== false ? 'bf-pri' : ''}" data-a="autoDepth">${t.auto !== false ? ic('check') + ' Auto on' : 'Use auto'}</button></div><div class="bf-card"><div class="bf-dc">${groups}</div></div>`;
  }
  function viewTraining() {
    const cur = S.train.f;
    const picks = Object.keys(FOCUS).map((k) => `<button class="bf-pick ${cur === k ? 'bf-on' : ''}" data-a="focus" data-v="${k}" aria-pressed="${cur === k}"><span class="bf-ck">${ic('check')}</span><b>${esc(FOCUS[k].n)}</b><small>${esc(FOCUS[k].d)}</small></button>`).join('');
    const rep = S.prac;
    let last = '';
    if (rep && rep.top && rep.top.length) {
      last = card('Last week at practice', `<div class="bf-sm bf-mu" style="margin-bottom:8px">${esc(FOCUS[rep.f] ? FOCUS[rep.f].n : '')} · ${esc(INTENSITY[rep.i] ? INTENSITY[rep.i].n : '')}</div><div class="bf-xp">${rep.top.map(([id, x]) => { const p = PL(id); if (!p) return ''; const ups = (rep.lvl || []).filter((l) => l[0] === id).map((l) => '+1 ' + RSHORT[l[1]]); return `<span>${pLink(p)} <span class="bf-xs bf-mu">${p.pos}</span></span><span><b>+${x} XP</b>${ups.length ? ` <span class="bf-up">${ups.join(', ')}</span>` : ''}</span>`; }).join('')}</div>`);
    }
    return `${card('Practice focus', `<p class="bf-sm bf-mu" style="margin:0 0 10px">Pick what the team works on this week. Practice gives XP, and every 100 XP is a shot at a rating boost (better potential = better chances).</p><div class="bf-focus">${picks}</div>`)}
      ${card('Intensity', `<div class="bf-opts bf-three">${INTENSITY.map((I, i) => `<button class="bf-pick ${S.train.i === i ? 'bf-on' : ''}" data-a="intensity" data-v="${i}" aria-pressed="${S.train.i === i}"><span class="bf-ck">${ic('check')}</span><b>${I.n}</b><small>${i === 0 ? 'Less XP, happier kids, fewer injuries' : i === 1 ? 'The usual' : 'More XP, a little grumpy, a bit more risk'}</small></button>`).join('')}</div>`)}
      ${last}`;
  }

  // ---------- Standings ----------
  function viewStandings() {
    const sub = UI.sub.stand || 'div';
    let body = '';
    if (sub === 'div') {
      const seeds = new Set(seedList());
      body = [0, 1].map((d) => card(`${DIVS[d]} Division`, `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Team</th><th>W-L${S.order.some((id) => TM(id).t) ? '-T' : ''}</th><th>Pct</th><th class="bf-hide-s">Div</th><th class="bf-hide-s">PF</th><th class="bf-hide-s">PA</th><th>Diff</th><th>Strk</th></tr></thead><tbody>${divTeams(d).map((id, i) => {
        const t = TM(id);
        return `<tr class="${id === S.user ? 'bf-me' : ''}"><td class="bf-l"><span class="bf-row" style="gap:6px"><span class="bf-xs bf-mu" style="width:12px">${i + 1}</span>${tLink(t)}${seeds.has(id) ? '<span class="bf-gold bf-xs" title="In playoff position">●</span>' : ''}</span></td><td>${recStr(t)}</td><td>${pctStr(tPct(t))}</td><td class="bf-hide-s">${t.dw}-${t.dl}${t.dt ? '-' + t.dt : ''}</td><td class="bf-hide-s">${t.pf}</td><td class="bf-hide-s">${t.pa}</td><td>${t.pf - t.pa > 0 ? '+' : ''}${t.pf - t.pa}</td><td>${strkStr(t)}</td></tr>`;
      }).join('')}</tbody></table></div>`)).join('') + `<p class="bf-xs bf-mu" style="margin:0"><span class="bf-gold">●</span> In playoff position (top ${S.poSize}: both division winners, then the best records). Ties are broken by head-to-head, then division record, point differential, points scored, and finally a coin flip.</p>`;
    } else if (sub === 'power') {
      const ids = S.order.slice().sort((a, b) => TM(a).pr - TM(b).pr);
      body = `<div class="bf-card" style="padding:4px 12px">${ids.map((id) => {
        const t = TM(id), d = t.prPrev - t.pr, R = teamRatings(t);
        return `<button class="bf-prow" data-a="team" data-id="${id}"><span class="bf-row" style="gap:8px"><b style="font:800 22px/1 var(--disp);width:26px;text-align:center">${t.pr}</b>${sh(t, 's')}</span><div style="min-width:0"><div class="bf-pn bf-trunc">${esc(t.name)} <span class="bf-mu bf-sm">${recStr(t)}</span></div><div class="bf-ps"><span class="${d > 0 ? 'bf-green' : d < 0 ? 'bf-red' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '–'}</span><span>${esc(prBlurb(t))}</span></div></div>${ovrB(R.ovr)}</button>`;
      }).join('')}</div>`;
    } else body = viewBracket();
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">Standings</h2>${seg('stand', [['div', 'Divisions'], ['power', 'Power'], ['bracket', S.po ? 'Bracket' : 'Playoff race']], sub)}</div>${body}</div>`;
  }
  function viewBracket() {
    if (!S.po) {
      const seeds = seedList();
      return card('If the season ended today', `<p class="bf-sm bf-mu" style="margin:0 0 10px">${S.poSize} teams make the playoffs. Division winners get the top two seeds.</p>${seeds.map((id, i) => { const t = TM(id); return `<div class="bf-row" style="padding:7px 0;border-bottom:1px solid var(--line)"><b style="font:800 18px/1 var(--disp);width:22px">${i + 1}</b>${tLink(t, 's')}<span class="bf-sp"></span><span class="bf-sm">${recStr(t)}</span></div>`; }).join('')}`);
    }
    const total = S.po.size === 8 ? 3 : 2;
    const rounds = [];
    for (let r = 0; r < total; r++) {
      const rd = S.po.rounds[r];
      const n = S.po.size / Math.pow(2, r + 1);
      const games = rd || Array.from({ length: n }, () => null);
      rounds.push(`<div class="bf-round"><div class="bf-k" style="text-align:center">${esc(poRoundName(r))}</div>${games.map((g) => {
        if (!g) return `<div class="bf-bg"><div class="bf-bt bf-lz"><span class="bf-s"></span><span></span><span>TBD</span><span></span></div><div class="bf-bt bf-lz"><span class="bf-s"></span><span></span><span>TBD</span><span></span></div></div>`;
        const w = gameWinner(g);
        const row = (id, sd, s) => { const t = TM(id); return `<div class="bf-bt ${g.done ? (w === id ? 'bf-w' : 'bf-lz') : ''}"><span class="bf-s">${sd}</span>${sh(t, 'xs')}<span class="bf-trunc">${esc(t.name)}</span><span class="bf-p">${g.done ? s : ''}</span></div>`; };
        return `<button class="bf-bg ${g.h === S.user || g.a === S.user ? 'bf-me' : ''}" data-a="${g.done && (g.h === S.user || g.a === S.user) ? 'box' : 'matchup'}" data-id="${g.id}" style="padding:0;width:100%;text-align:left;cursor:pointer;color:inherit">${row(g.h, g.sh, g.hs)}${row(g.a, g.sa, g.as)}</button>`;
      }).join('')}</div>`);
    }
    const champ = S.po.champ ? TM(S.po.champ) : null;
    return `${champ ? `<div class="bf-note bf-warn">${ic('hist')}<div><b>${esc(champ.name)}</b> won the ${CHAMP}!</div></div>` : ''}<div class="bf-card"><div class="bf-bracket">${rounds.join('')}</div></div>`;
  }

  // ---------- League ----------
  const LEADERS = [['py', 'Passing yards'], ['ptd', 'Passing TDs'], ['ry', 'Rushing yards'], ['rtd', 'Rushing TDs'], ['rcy', 'Receiving yards'], ['rc', 'Catches'], ['rctd', 'Receiving TDs'], ['tk', 'Flag pulls'], ['sk', 'Sacks'], ['it', 'Interceptions'], ['fgm', 'Field goals']];
  function viewLeague() {
    const sub = UI.sub.league || 'scores';
    let body = '';
    if (sub === 'scores') {
      const wk = UI.week == null ? (S.phase === 'regular' ? Math.max(0, S.week - 1) : 'P') : UI.week;
      const chips = S.sched.map((_, w) => `<button class="${wk === w ? 'bf-on' : ''}" data-a="weekSel" data-w="${w}">Wk ${w + 1}</button>`).join('') + (S.po ? `<button class="${wk === 'P' ? 'bf-on' : ''}" data-a="weekSel" data-w="P">Playoffs</button>` : '');
      const games = wk === 'P' && S.po ? [].concat(...S.po.rounds) : S.sched[wk] || [];
      body = `<div class="bf-seg">${chips}</div><div class="bf-scores">${games.map(scoreCard).join('')}</div>`;
    } else if (sub === 'leaders') {
      const cat = UI.filter.lead || 'py';
      const label = (LEADERS.find((x) => x[0] === cat) || LEADERS[0])[1];
      const list = Object.values(S.players).filter((p) => num(p.s[cat]) > 0).sort((a, b) => num(b.s[cat]) - num(a.s[cat])).slice(0, 10);
      body = `<div class="bf-seg">${LEADERS.map(([k, l]) => `<button class="${k === cat ? 'bf-on' : ''}" data-a="sub" data-k="lead" data-v="${k}">${l}</button>`).join('')}</div>
        ${card(esc(label), list.length ? list.map((p, i) => `<button class="bf-prow" data-a="player" data-id="${p.id}"><span class="bf-row" style="gap:8px"><b style="font:800 18px/1 var(--disp);width:20px;text-align:center;color:${i === 0 ? 'var(--gold)' : 'var(--mu2)'}">${i + 1}</b>${av(p, 's')}</span><div style="min-width:0"><div class="bf-pn bf-trunc">${esc(p.n)}</div><div class="bf-ps">${posTag(p.pos)}<span>${esc(TM(p.t).name)}</span></div></div><b style="font:800 20px/1 var(--disp)">${fmt(p.s[cat])}</b></button>`).join('') : empty('star', 'No stats yet', 'Leaders show up after the first week of games.'))}`;
    } else if (sub === 'teams') {
      body = `<div class="bf-card" style="padding:4px 12px">${S.order.slice().sort((a, b) => TM(a).div - TM(b).div || tPct(TM(b)) - tPct(TM(a))).map((id) => {
        const t = TM(id), R = teamRatings(t);
        return `<button class="bf-prow" data-a="team" data-id="${id}">${sh(t)}<div style="min-width:0"><div class="bf-pn bf-trunc">${esc(t.name)}${id === S.user ? ' <span class="bf-chip bf-gold">You</span>' : t.kind === 'real' ? ' <span class="bf-chip">MFL</span>' : ''}</div><div class="bf-ps"><span>${recStr(t)}</span><span>${DIVS[t.div]}</span><span>OFF ${R.off} · DEF ${R.def}</span></div></div>${ovrB(R.ovr)}</button>`;
      }).join('')}</div>`;
    } else if (sub === 'stats') {
      const rows = S.order.map(TM).map((t) => { const g = Math.max(1, num(t.ts.g)); return { t, g: num(t.ts.g), ppg: num(t.ts.pts) / g, papg: num(t.ts.ptsa) / g, ypg: num(t.ts.yds) / g, yapg: num(t.ts.yda) / g, to: num(t.ts.tk) - num(t.ts.to) }; }).sort((a, b) => b.ppg - a.ppg);
      body = card('Team stats', `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Team</th><th>PTS/G</th><th>OPP/G</th><th>YDS/G</th><th>ALLOW/G</th><th>TO +/-</th></tr></thead><tbody>${rows.map((x) => `<tr class="${x.t.id === S.user ? 'bf-me' : ''}"><td class="bf-l">${tLink(x.t)}</td><td>${x.g ? x.ppg.toFixed(1) : '-'}</td><td>${x.g ? x.papg.toFixed(1) : '-'}</td><td>${x.g ? x.ypg.toFixed(0) : '-'}</td><td>${x.g ? x.yapg.toFixed(0) : '-'}</td><td>${x.g ? (x.to > 0 ? '+' : '') + x.to : '-'}</td></tr>`).join('')}</tbody></table></div>`);
    } else {
      body = card('League news', newsList(S.news));
    }
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">League</h2>${seg('league', [['scores', 'Scores'], ['leaders', 'Leaders'], ['teams', 'Teams'], ['stats', 'Team stats'], ['news', 'News']], sub)}</div>${body}</div>`;
  }

  // ---------- Program ----------
  const FAC_IC = { train: 'train', film: 'film', locker: 'locker', stadium: 'stadium', medical: 'medical' };
  function viewProgram() {
    const t = userTeam(), mor = moraleAvg(t);
    const facs = FAC_KEYS.map((k) => {
      const l = S.fac[k], cost = FAC_COST[l + 1];
      return `<div class="bf-fac"><span class="bf-fi">${ic(FAC_IC[k])}</span><div style="min-width:0"><div class="bf-row bf-sb"><b>${esc(FAC[k].n)}</b><span class="bf-xs bf-mu">Level ${l}/5</span></div><div class="bf-lvl">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= l ? 'bf-on' : ''}"></i>`).join('')}</div><div class="bf-xs bf-mu">Now: ${esc(FAC[k].d(l))}${l < 5 ? `<br>Next: ${esc(FAC[k].d(l + 1))}` : ''}</div>
        ${l < 5 ? `<button class="bf-btn bf-sm ${S.pts >= cost ? 'bf-pri' : ''}" style="margin-top:8px" data-a="upgrade" data-k="${k}" ${S.pts >= cost ? '' : 'disabled'}>Upgrade · ${cost} pts</button>` : '<span class="bf-chip bf-gold" style="margin-top:8px">Maxed out</span>'}</div></div>`;
    }).join('');
    const staff = Object.keys(STAFF).map((k) => {
      const s = S.staff[k], cands = (S.hire && S.hire[k]) || [];
      return `<div class="bf-fac"><span class="bf-fi">${ic('clip')}</span><div style="min-width:0"><div class="bf-row bf-sb bf-wrap"><b>${esc(STAFF[k].n)}</b>${starsH(s.s)}</div><div class="bf-sm">${esc(s.n)}</div><div class="bf-xs bf-mu">${esc(STAFF[k].d(s.s))}</div>
        ${cands.filter((c) => c.s > s.s).length ? `<div class="bf-col" style="gap:6px;margin-top:8px">${cands.filter((c) => c.s > s.s).map((c, i) => `<div class="bf-row bf-sb" style="gap:6px"><span class="bf-sm bf-trunc">${esc(c.n)} ${starsH(c.s)}</span><button class="bf-btn bf-xs ${S.pts >= STAFF_COST[c.s] ? 'bf-pri' : ''}" data-a="hire" data-k="${k}" data-i="${cands.indexOf(c)}" ${S.pts >= STAFF_COST[c.s] ? '' : 'disabled'}>Hire · ${STAFF_COST[c.s]}</button></div>`).join('')}</div>` : '<div class="bf-xs bf-mu" style="margin-top:6px">New candidates show up every offseason.</div>'}</div></div>`;
    }).join('');
    const pers = {}; for (const p of roster(t.id)) pers[p.pers] = (pers[p.pers] || 0) + 1;
    const cr = S.cr;
    return `<div class="bf-col"><h2 class="bf-h">Program</h2>
      <div class="bf-two">${card('Program points', `<div class="bf-row"><b style="font:900 40px/1 var(--disp);color:var(--gold)">${fmt(S.pts)}</b><span class="bf-mu bf-sm">points to spend</span></div><ul class="bf-sm bf-mu" style="margin:10px 0 0;padding-left:18px;line-height:1.7"><li>Win: +40 · Loss: +15 · Tie: +25</li><li>Home games: +${S.fac.stadium * 8} (Stadium level ${S.fac.stadium})</li><li>Playoff wins +60 · Title +200 · Awards +10 to +40</li></ul>`)}
        ${card('Head coach', `<div class="bf-row">${sh(t, 'l')}<div><div style="font:800 22px/1 var(--disp);text-transform:uppercase">${esc(S.coach)}</div><div class="bf-sm bf-mu">Career ${cr.w}-${cr.l}${cr.t ? '-' + cr.t : ''} · ${plural(cr.titles, 'title')} · ${plural(cr.po, 'playoff trip')}${cr.coy ? ' · ' + cr.coy + 'x Coach of the Year' : ''}</div><div class="bf-xs bf-mu" style="margin-top:4px">Program prestige ${starsH(Math.round(clamp(t.prest, 0, 100) / 20))}</div></div></div>`)}</div>
      ${card('Facilities', `<div class="bf-grid">${facs}</div>`)}
      ${card('Coaching staff', `<div class="bf-grid">${staff}</div>`)}
      ${card('Team culture', `<div class="bf-col"><div><div class="bf-row bf-sb bf-sm"><span>${ic('flame')} Chemistry: ${esc(chemWord(t.chem))}</span><b>${Math.round(t.chem)}</b></div>${meter(t.chem, 100, '#ff9f1a')}</div><div><div class="bf-row bf-sb bf-sm"><span>${ic('heart')} Morale: ${esc(moraleWord(mor))}</span><b>${Math.round(mor)}</b></div>${meter(mor, 100, '#ff5c8a')}</div>
        <div class="bf-row bf-wrap" style="gap:6px">${Object.keys(pers).map((k) => `<span class="bf-chip" title="${esc(PERS[k].d)}">${esc(PERS[k].n)} × ${pers[k]}</span>`).join('')}</div>
        <p class="bf-xs bf-mu" style="margin:0">Winning, playing time and Team Bonding practices lift morale. Leaders and Class Clowns help chemistry. Better chemistry and morale make your team play a little better in every game.</p></div>`)}</div>`;
  }

  // ---------- History ----------
  function viewHistory() {
    const sub = UI.sub.hist || 'seasons';
    const H = S.hist;
    let body = '';
    if (sub === 'seasons') {
      const titles = H.seasons.filter((x) => x.champ.id === S.user);
      body = `${card('Trophy case', titles.length ? `<div class="bf-row bf-wrap" style="gap:12px">${titles.map((x) => `<div style="text-align:center">${cupSVG(44)}<div class="bf-xs bf-mu">Season ${x.s}</div></div>`).join('')}</div>` : `<div class="bf-sm bf-mu">No ${TROPHY} yet. ${S.season === 1 ? 'Your first season is underway.' : 'Keep building.'}</div>`)}
        ${H.seasons.length ? card('Season by season', `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Season</th><th>Your record</th><th>Finish</th><th>Champion</th></tr></thead><tbody>${H.seasons.slice().reverse().map((x) => `<tr class="${x.champ.id === S.user ? 'bf-me' : ''}"><td class="bf-l">S${x.s} <span class="bf-xs bf-mu">${x.y}</span></td><td>${esc(x.user.rec)}</td><td>${esc(x.user.fin)}</td><td>${esc(x.champ.n)}</td></tr>`).join('')}</tbody></table></div>`) : card('', empty('hist', 'History starts here', 'Finish your first season and it will be written into the books.'))}
        ${card('All-time records', `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Team</th><th>W-L-T</th><th>Titles</th><th>Playoffs</th></tr></thead><tbody>${S.order.map(TM).sort((a, b) => b.at.titles - a.at.titles || pct(b.at.w, b.at.l, b.at.t) - pct(a.at.w, a.at.l, a.at.t)).map((t) => `<tr class="${t.id === S.user ? 'bf-me' : ''}"><td class="bf-l">${tLink(t)}</td><td>${t.at.w}-${t.at.l}-${t.at.t}</td><td>${t.at.titles}</td><td>${t.at.po}</td></tr>`).join('')}</tbody></table></div>`)}`;
    } else if (sub === 'awards') {
      body = H.seasons.length ? H.seasons.slice().reverse().map((x) => card(`Season ${x.s}`, `<div class="bf-col" style="gap:6px">${['mvp', 'opoy', 'dpoy', 'roy'].map((k) => x.aw[k] ? `<div class="bf-row bf-sm"><span class="bf-chip bf-gold" style="min-width:52px;justify-content:center">${k === 'mvp' ? 'MVP' : k.toUpperCase()}</span><b class="bf-trunc">${esc(x.aw[k].n)}</b><span class="bf-mu bf-trunc">${esc(x.aw[k].pos)} · ${esc(x.aw[k].t)}</span></div>` : '').join('')}${x.aw.coy ? `<div class="bf-row bf-sm"><span class="bf-chip bf-gold" style="min-width:52px;justify-content:center">COY</span><b>${esc(x.aw.coy.n)}</b><span class="bf-mu">${esc(x.aw.coy.t)}</span></div>` : ''}
        ${x.al ? `<details style="margin-top:6px"><summary class="bf-sm bf-mu" style="cursor:pointer">All-League 1st Team</summary><div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:8px">${x.al.map((a) => `<div class="bf-xs"><span class="bf-pos">${a.pos}</span> ${esc(a.n)} <span class="bf-mu">${esc(a.t)}</span></div>`).join('')}</div></details>` : ''}</div>`, `<span class="bf-chip">${esc(x.champ.a)} champs</span>`)).join('') : card('', empty('star', 'No awards yet', 'MVP, Offensive and Defensive Player of the Year, Rookie of the Year and Coach of the Year are handed out after the ' + CHAMP + '.'));
    } else if (sub === 'hof') {
      const f = UI.filter.hof || 'my';
      const list = H.hof.filter((e) => (f === 'all' ? e.lg !== 0 : e.my)).sort((a, b) => b.in - a.in);
      body = `${seg('hof', [['my', 'My school'], ['all', 'Whole league']], f)}${list.length ? `<div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">${list.map((e) => `<div class="bf-card bf-flat"><div class="bf-row">${av({ n: e.n, ph: e.ph }, 'l', { color: e.c || '#444', color2: e.c2 || '#fff' })}<div style="min-width:0"><div style="font:800 18px/1.05 var(--disp);text-transform:uppercase">${esc(e.n)}</div><div class="bf-xs bf-mu">${esc(e.pos)} · ${esc(e.tn || e.t)} · Seasons ${e.s0}-${e.s1}</div></div></div><div class="bf-sm" style="margin-top:8px">${esc(e.line)}</div>${e.aw && e.aw.length ? `<div class="bf-row bf-wrap" style="gap:5px;margin-top:6px">${e.aw.slice(0, 4).map((a) => `<span class="bf-chip bf-gold">${esc(a)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>` : card('', empty('star', 'The Hall is waiting', 'Legends are inducted when they graduate after great careers. Win awards and pile up stats to get in.'))}`;
    } else {
      const book = UI.filter.book || 'L', scope = UI.filter.scope || 'g';
      const R = H.rec[book][scope];
      const rows = scope === 't' ? Object.keys(H.rec.T).map((k) => { const r = H.rec.T[k]; return `<tr><td class="bf-l">${esc(r.l || k)}</td><td><b>${k === 'bestw' ? esc(String(r.w).split(' in ')[0]) : fmt(r.v)}</b></td><td class="bf-l">${esc(r.n)}</td><td class="bf-hide-s">S${r.s}${r.w && !['bestw', 'spts', 'strk'].includes(k) ? ' · ' + esc(r.w) : ''}</td></tr>`; }).join('')
        : REC_KEYS.filter(([k]) => R[k]).map(([k, label]) => { const r = R[k]; return `<tr><td class="bf-l">${esc(label)}</td><td><b>${fmt(r.v)}</b></td><td class="bf-l">${r.id && PL(r.id) ? pLink(PL(r.id), r.n) : esc(r.n)} <span class="bf-xs bf-mu">${esc(r.t)}</span></td><td class="bf-hide-s">S${r.s}${r.w ? ' · ' + esc(r.w) : ''}</td></tr>`; }).join('');
      body = `<div class="bf-row bf-wrap">${seg('book', [['L', 'League'], ['U', 'My school']], book)}${seg('scope', [['g', 'Game'], ['s', 'Season'], ['c', 'Career'], ['t', 'Team']], scope)}</div>${card('', rows ? `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Record</th><th>Mark</th><th>Holder</th><th class="bf-hide-s">When</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('book', 'The book is empty', 'Records get set as games are played.'))}`;
    }
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">History</h2>${seg('hist', [['seasons', 'Seasons'], ['awards', 'Awards'], ['hof', 'Hall of Fame'], ['records', 'Records']], sub)}</div>${body}</div>`;
  }
  function cupSVG(size) {
    return `<svg width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 120 138" aria-hidden="true"><defs><linearGradient id="bfg${size}" x1="0" x2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset=".5" stop-color="#ffc21a"/><stop offset="1" stop-color="#c98a00"/></linearGradient></defs>
      <path d="M30 10h60v28c0 22-13 38-30 38S30 60 30 38z" fill="url(#bfg${size})"/><path d="M30 18H14c0 18 8 28 20 30M90 18h16c0 18-8 28-20 30" fill="none" stroke="#ffc21a" stroke-width="7" stroke-linecap="round"/>
      <path d="M52 74h16v18H52z" fill="#d99a00"/><path d="M36 92h48l6 16H30z" fill="url(#bfg${size})"/><rect x="24" y="108" width="72" height="16" rx="3" fill="#3a2a00"/><path d="M47 30l13-8 13 8-5 2v12H52V32z" fill="#fff6cf" opacity=".85"/><path d="M60 22v-8" stroke="#fff6cf" stroke-width="3"/><path d="M60 14l14 4-14 4z" fill="#ff3344"/></svg>`;
  }

  // ---------- playing a game ----------
  const engineReady = () => !!(window.MFLBlitz && typeof window.MFLBlitz.play === 'function');
  function gameCtx(g) {
    const home = g.h === S.user, oppId = home ? g.a : g.h;
    const po = S.phase === 'playoffs';
    const wx = g.wx || weatherFor(g.id, po ? 11 : S.week);
    const lbl = po ? poRoundName(S.po.r) : 'Week ' + (S.week + 1);
    const H = TM(g.h), A = TM(g.a);
    return { g, home, oppId, po, wx, label: `${lbl} · ${A.name} ${g.neu ? 'vs' : 'at'} ${H.name}`, short: lbl };
  }
  function enginePlayer(p, slot) {
    const pos = slot || p.pos;
    return { id: p.id, name: p.n, pos, num: p.num, photo: p.ph || null, look: p.lk || null, ovr: posOvr(pos, p.r), spd: p.r.spd, thr: p.r.thr, acc: p.r.acc, cat: p.r.cat, str: p.r.str, agi: p.r.agi, kick: p.r.kick };
  }
  // Starters in the order the engine reads them: QB, receivers (WR, TE), RB, then the rest, then the bench.
  function engineTeam(t) {
    const L = lineup(t), R = teamRatings(t, L), fill = L._fill || {};
    const order = [];
    const push = (p, pos) => { if (p && !order.some((x) => x.p === p)) order.push({ p, pos }); };
    push(L.QB[0], 'QB'); for (const p of L.WR) push(p, 'WR'); for (const p of L.TE) push(p, 'TE'); push(L.RB[0], 'RB');
    for (const pos of ['OL', 'DL', 'LB', 'DB', 'K']) for (const p of L[pos]) push(p, pos);
    const seen = new Set(order.map((x) => x.p.id));
    const bench = roster(t.id).filter((p) => healthy(p) && !seen.has(p.id)).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || ovr(b) - ovr(a));
    return {
      name: t.name, abbr: t.abbr, color: t.color, color2: t.color2, ovrOff: clamp(R.off, 30, 99), ovrDef: clamp(R.def, 30, 99),
      players: order.map((x) => enginePlayer(x.p, fill[x.p.id] ? x.pos : x.p.pos === x.pos ? x.pos : x.pos)).concat(bench.map((p) => enginePlayer(p))),
    };
  }
  function engineOpts(ctx) {
    const att = (UI.attempt[ctx.g.id] = (UI.attempt[ctx.g.id] || 0) + 1);
    return {
      home: engineTeam(userTeam()), away: engineTeam(TM(ctx.oppId)), difficulty: DIFFS[S.diff].eng, seed: `${S.seed}:${ctx.g.id}:${att}`,
      quarterSecs: S.qmin * 60, timeouts: 2, label: ctx.label, playoff: ctx.po, weather: ctx.wx,
    };
  }
  function topSecs(v) { if (typeof v === 'number' && isFinite(v)) return Math.round(v); const m = /^(\d+):(\d\d)$/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : 0; }
  // Turn an engine result into a game result in schedule orientation (hs = home team).
  function fromEngine(ctx, r) {
    const ut = userTeam(), opp = TM(ctx.oppId);
    const LU = lineup(ut), LO = lineup(opp);
    const ids = new Set(roster(ut.id).map((p) => p.id));
    const lines = engineLines(r.stats, ids);
    const us = clamp(Math.round(num(r.homeScore)), 0, 199), them = clamp(Math.round(num(r.awayScore)), 0, 199);
    const rng = rngFrom(S.seed + ':eng:' + ctx.g.id + ':' + (UI.attempt[ctx.g.id] || 0));
    const dec = decompose(them, rng);
    const drives = dec.drives.slice();
    const T0 = r.team && typeof r.team === 'object' ? r.team : {};
    const played = r.quit ? clamp(num(T0.plays) / 34, 0, 1) : 1; // a game left early only gets the drives that happened
    while (drives.length < Math.round(9 * played)) drives.push(rng() < 0.18 ? { pts: 0, kind: 'int' } : { pts: 0, kind: 'punt' });
    const ob = offenseBox(opp, LO, shuffle(rng, drives), LU, rng, ctx.wx);
    Object.assign(lines, ob.lines);
    defenseCredit(LU, ob.credit, rng, lines);
    const uL = Object.keys(lines).filter((id) => ids.has(id)).map((id) => lines[id]);
    const uTD = sum(uL, (l) => num(l.rtd)) + sum(uL, (l) => num(l.ptd));
    const T = r.team && typeof r.team === 'object' ? r.team : {};
    const py = sum(uL, (l) => num(l.py)), ry = sum(uL, (l) => num(l.ry)), skd = sum(uL, (l) => num(l.skd));
    defenseCredit(LO, { tk: Math.max(0, sum(uL, (l) => num(l.pc) + num(l.ra)) - uTD), sk: num(T.sacks, skd) | 0, it: sum(uL, (l) => num(l.pi)), ff: 0 }, rng, lines);
    const tbU = { plays: num(T.plays, sum(uL, (l) => num(l.pa) + num(l.ra))) | 0, yds: num(T.yards, py + ry) | 0, py, ry, to: num(T.turnovers, sum(uL, (l) => num(l.pi))) | 0, sacks: num(T.sacks, skd) | 0, pts: us, top: topSecs(T.timeOfPoss), d3: num(T.thirdDownAtt) ? `${num(T.thirdDownConv) | 0}/${num(T.thirdDownAtt) | 0}` : '' };
    const tbO = Object.assign(ob.team, { pts: them });
    if (!tbU.top) timeSplit(rng, tbU, tbO); else tbO.top = Math.max(0, S.qmin * 240 - tbU.top);
    const hl = (Array.isArray(r.highlights) ? r.highlights : []).filter((x) => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 12);
    const res = { ot: !!r.overtime, lines, hl, mode: 'engine', LH: ctx.home ? LU : LO, LA: ctx.home ? LO : LU };
    if (ctx.home) Object.assign(res, { hs: us, as: them, tb: { h: tbU, a: tbO } }); else Object.assign(res, { hs: them, as: us, tb: { h: tbO, a: tbU } });
    if (ctx.po && res.hs === res.as) { if (ctx.home) res.hs++; else res.as++; } // safety: playoffs can't tie
    return res;
  }
  function quickResult(ctx, mode) {
    const att = (UI.attempt[ctx.g.id] = (UI.attempt[ctx.g.id] || 0) + 1);
    const res = simGame(ctx.g, { po: ctx.po, salt: mode === 'quick' ? ':q' + att : '' });
    res.mode = mode || 'sim';
    return res;
  }
  function finishUserGame(ctx, res) {
    ctx.g.wx = ctx.g.wx || ctx.wx;
    const rep = ctx.po ? playRound(res) : playWeek(res);
    S.last = ctx.g.id;
    S.prac = { f: S.train.f, i: S.train.i, top: Object.keys(rep.txp).sort((a, b) => rep.txp[b] - rep.txp[a]).slice(0, 8).map((id) => [id, rep.txp[id]]), lvl: rep.lvl.slice(0, 40) };
    UI.post = rep; UI.screen = 'postgame'; UI.trophy = rep.champ === S.user;
    Saver.mark();
    render(); scrollTop();
  }
  async function playEngine() {
    const g = userGameNow(); if (!g) return;
    const ctx = gameCtx(g);
    if (!engineReady()) { finishUserGame(ctx, quickResult(ctx, 'quick')); return; }
    const opts = engineOpts(ctx);
    UI.screen = 'engine'; UI.ctx = ctx; render(); scrollTop();
    const mount = document.getElementById('bf-engine-mount');
    let result = null, err = null;
    try { result = await window.MFLBlitz.play(mount, opts); } catch (e) { err = e; console.warn('[franchise] engine error', e); }
    try { if (mount) mount.innerHTML = ''; } catch (e) {}
    if (!S) return;
    if (err || !result || typeof result !== 'object' || result.noGL || result.error) {
      UI.screen = 'pregame'; render();
      openSheet('engineErr', { msg: result && result.noGL ? 'this device or browser can\'t run 3D graphics right now' : (err && err.message) || (result && result.error) || 'the game ended without a result', nogl: !!(result && result.noGL) });
      return;
    }
    if (result.quit) { UI.screen = 'pregame'; UI.quitRes = result; render(); openSheet('quit', { us: num(result.homeScore), them: num(result.awayScore) }); return; }
    finishUserGame(ctx, fromEngine(ctx, result));
  }
  function simUserGame() {
    const g = userGameNow(); if (!g) return;
    finishUserGame(gameCtx(g), quickResult(gameCtx(g), 'sim'));
  }
  function gameKeys(ctx) {
    const ut = userTeam(), opp = TM(ctx.oppId), RU = teamRatings(ut), RO = teamRatings(opp), LU = lineup(ut), LO = lineup(opp);
    const keys = [];
    const gap = RU.off - RO.def;
    keys.push(gap >= 5 ? `Your offense (${RU.off}) has the edge on their defense (${RO.def}). Stay aggressive and take your shots downfield.` : gap <= -5 ? `Their defense is tough (${RO.def} DEF vs your ${RU.off} offense). Take the short, safe throws and protect the ball.` : `Even matchup: your ${RU.off} offense against their ${RO.def} defense. Move the chains and win third downs.`);
    const db = LO.DB.filter(Boolean).sort((a, b) => ovr(a) - ovr(b))[0], wr = LU.WR.filter(Boolean).sort((a, b) => ovr(b) - ovr(a))[0];
    if (db && wr) keys.push(`Test their coverage: ${db.n} (#${db.num}, ${ovr(db)} OVR) is their weakest defensive back. Look for ${firstName(wr.n)} ${lastName(wr.n)} (${ovr(wr)} OVR).`);
    const star = roster(opp.id).filter(healthy).sort((a, b) => (gameVal(b.s) - gameVal(a.s)) || ovr(b) - ovr(a))[0];
    if (star) keys.push(`Watch out for ${star.n} (${star.pos})${star.s.gp ? `: ${statSummary(star.s, star) || ovr(star) + ' OVR'} this season.` : `, their best player at ${ovr(star)} OVR.`}`);
    if (ctx.wx === 'rain' || ctx.wx === 'snow') keys.push(`${ctx.wx === 'snow' ? 'Snow' : 'Rain'} in the forecast: the ball is slippery. Hold on tight and lean on the run game.`);
    if (ctx.g.riv) keys.push('Rivalry game! The whole school is watching.');
    if (ctx.po) keys.push('Win or go home. Playoff games keep going in overtime until someone wins.');
    return keys.slice(0, 4);
  }
  function viewPregame() {
    const g = userGameNow();
    if (!g) { UI.screen = 'app'; return viewApp(); }
    const ctx = gameCtx(g), ut = userTeam(), opp = TM(ctx.oppId), RU = teamRatings(ut), RO = teamRatings(opp), L = lineup(ut);
    const starters = [['QB', L.QB[0]], ['WR', L.WR[0]], ['WR', L.WR[1]], ['WR', L.WR[2]], ['TE', L.TE[0]], ['RB', L.RB[0]], ['K', L.K[0]]].filter((x) => x[1]);
    const hurt = roster(ut.id).filter((p) => p.inj && p.inj.w > 0);
    return `<div class="bf-flow bf-in"><div class="bf-fhead"><button class="bf-btn bf-sm bf-ghost" data-a="closeFlow">${ic('back')} Back</button><span class="bf-k">Game day</span></div>
      <section class="bf-banner" style="--c1:${ut.color};--c2:${opp.color}"><div class="bf-k">${esc(ctx.short)} · ${g.neu ? 'Neutral field' : ctx.home ? 'Home' : 'Away'} · ${esc(WX[ctx.wx])}</div>
        <div class="bf-match"><div class="bf-side">${sh(ut, 'xl')}<div class="bf-nm">${esc(ut.name)}</div><div class="bf-rec">${recStr(ut)}</div></div><div class="bf-vs">${ctx.home || g.neu ? 'vs' : 'at'}<b>VS</b></div><div class="bf-side">${sh(opp, 'xl')}<div class="bf-nm">${esc(opp.name)}</div><div class="bf-rec">${recStr(opp)}</div></div></div>
        ${cmpRow('OFF', RU.off, RO.off)}${cmpRow('DEF', RU.def, RO.def)}${cmpRow('OVR', RU.ovr, RO.ovr)}${cmpRow('KICK', RU.k, RO.k)}</section>
      ${card('Keys to the game', `<ol class="bf-keys">${gameKeys(ctx).map((k, i) => `<li><b class="bf-n">${i + 1}</b><span>${esc(k)}</span></li>`).join('')}</ol>`)}
      ${card('Your starters', `<div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${starters.map(([pos, p]) => `<button class="bf-lk" data-a="player" data-id="${p.id}" style="padding:6px;border-radius:12px;background:var(--s2);border:1px solid var(--line)">${av(p, 's')}<span style="min-width:0"><span class="bf-pos">${pos}</span> <span class="bf-u bf-sm">${esc(lastName(p.n))}</span></span><span class="bf-sp"></span>${ovrB(posOvr(pos, p.r))}</button>`).join('')}</div>${hurt.length ? `<div class="bf-xs bf-inj" style="margin-top:8px">Out: ${hurt.map((p) => esc(p.n) + ' (' + esc(p.inj.d.toLowerCase()) + ')').join(', ')}</div>` : ''}`, `<button class="bf-btn bf-xs bf-ghost" data-a="sub" data-tab="roster" data-k="roster" data-v="depth">Depth chart ${ic('right')}</button>`)}
      ${card('Game settings', `<div class="bf-row bf-sb bf-wrap"><span class="bf-sm">${esc(DIFFS[S.diff].name)} · ${S.qmin}-minute quarters · Practice: ${esc(FOCUS[S.train.f].n)}</span><button class="bf-btn bf-sm" data-a="settings">${ic('gear')} Change</button></div>`)}
      ${engineReady() ? '' : `<div class="bf-note bf-warn">${ic('info')}<div>The 3D game is getting an upgrade right now, so <b>Play</b> will quick-sim this game for you. You still get the full box score, XP and stats.</div></div>`}
      <div class="bf-btns"><button class="bf-btn bf-pri bf-big" data-a="play">${ic('play', 'fill')} ${engineReady() ? 'Play in 3D Blitz' : 'Play (quick sim)'}</button><button class="bf-btn bf-big" data-a="simGame">${ic('ff')} Sim game</button></div></div>`;
  }
  function viewEngine() {
    const c = UI.ctx;
    return `<div class="bf-flow"><div class="bf-row bf-sb"><span class="bf-k">${esc(c ? c.label : '')}</span><span class="bf-xs bf-mu">Franchise game · no coins</span></div><div class="bf-engine" id="bf-engine-mount"></div></div>`;
  }
  function fmtTop(s) { s = Math.round(num(s)); return s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '-'; }
  function boxTables(lines, tid) {
    const ps = Object.keys(lines).map((id) => PL(id)).filter((p) => p && p.t === tid);
    const L = (p) => lines[p.id];
    const pass = ps.filter((p) => num(L(p).pa) > 0), rush = ps.filter((p) => num(L(p).ra) > 0), rec = ps.filter((p) => num(L(p).rc) > 0), kick = ps.filter((p) => num(L(p).fga) > 0), def = ps.filter((p) => num(L(p).tk) + num(L(p).sk) + num(L(p).it) > 0);
    const tbl = (title, cols, list, row) => (list.length ? `<div class="bf-k" style="margin:10px 0 4px">${title}</div><div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Player</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${list.map((p) => `<tr><td class="bf-l">${pLink(p, lastName(p.n) ? firstName(p.n)[0] + '. ' + lastName(p.n) : p.n)}</td>${row(L(p)).map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '');
    return tbl('Passing', ['C/ATT', 'YDS', 'TD', 'INT'], pass.sort((a, b) => num(L(b).pa) - num(L(a).pa)), (l) => [`${num(l.pc)}/${num(l.pa)}`, num(l.py), num(l.ptd), num(l.pi)])
      + tbl('Rushing', ['CAR', 'YDS', 'AVG', 'TD'], rush.sort((a, b) => num(L(b).ry) - num(L(a).ry)), (l) => [num(l.ra), num(l.ry), (num(l.ry) / Math.max(1, num(l.ra))).toFixed(1), num(l.rtd)])
      + tbl('Receiving', ['REC', 'YDS', 'TD'], rec.sort((a, b) => num(L(b).rcy) - num(L(a).rcy)), (l) => [num(l.rc), num(l.rcy), num(l.rctd)])
      + tbl('Kicking', ['FG', 'PCT'], kick, (l) => [`${num(l.fgm)}/${num(l.fga)}`, Math.round((num(l.fgm) / Math.max(1, num(l.fga))) * 100) + '%'])
      + tbl('Defense', ['PULLS', 'SACK', 'INT'], def.sort((a, b) => gameVal(L(b)) - gameVal(L(a))), (l) => [num(l.tk), num(l.sk), num(l.it)]);
  }
  function teamStatsCmp(tbA, tbB, tA, tB) {
    const rows = [['Total yards', 'yds'], ['Passing', 'py'], ['Rushing', 'ry'], ['Plays', 'plays'], ['Turnovers', 'to'], ['Sacks taken', 'sacks'], ['Time of possession', 'top']];
    if (tbA.d3 || tbB.d3) rows.push(['Third downs', 'd3']);
    return `<div class="bf-tw"><table class="bf-tbl"><thead><tr><th></th><th>${esc(tA.abbr)}</th><th>${esc(tB.abbr)}</th></tr></thead><tbody>${rows.map(([l, k]) => `<tr><td class="bf-l">${l}</td><td>${k === 'top' ? fmtTop(tbA[k]) : k === 'd3' ? esc(tbA[k] || '-') : num(tbA[k])}</td><td>${k === 'top' ? fmtTop(tbB[k]) : k === 'd3' ? esc(tbB[k] || '-') : num(tbB[k])}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function viewPostgame() {
    const rep = UI.post, G = rep && rep.game;
    if (!G) { UI.screen = 'app'; return viewApp(); }
    const g = G.g, res = G.res, ut = userTeam(), home = g.h === S.user, opp = TM(home ? g.a : g.h);
    const us = home ? g.hs : g.as, them = home ? g.as : g.hs, r = G.r;
    const pog = res.pog && PL(res.pog);
    const myTb = home ? res.tb.h : res.tb.a, opTb = home ? res.tb.a : res.tb.h;
    const xp = Object.keys(Object.assign({}, rep.gxp, rep.txp)).map((id) => ({ id, x: num(rep.gxp[id]) + num(rep.txp[id]) })).sort((a, b) => b.x - a.x);
    const ups = {}; for (const [id, k] of rep.lvl) (ups[id] || (ups[id] = [])).push(RSHORT[k]);
    const upIds = Object.keys(ups);
    const modeNote = res.mode === 'quick' ? 'Quick-simmed (3D engine not available)' : res.mode === 'sim' ? 'Simulated' : res.quit ? 'Left early: counted as a loss' : 'Played in 3D Blitz';
    const champ = rep.champ;
    const ptsTotal = sum(rep.pts, (x) => x[1]);
    const others = (rep.others || []).map(findGame).filter(Boolean);
    return `<div class="bf-flow bf-in">
      <section class="bf-banner" style="--c1:${ut.color};--c2:${opp.color}"><div class="bf-k">${esc(gameLabel(g))} · Final${g.ot ? ' / OT' : ''}</div>
        <div class="bf-final"><div class="bf-side">${sh(ut, 'l')}<div class="bf-nm">${esc(ut.name)}</div></div><div><span class="bf-big ${r === 'L' ? 'bf-lose' : ''}">${us}</span><span class="bf-big bf-mu2" style="font-size:32px;margin:0 6px">–</span><span class="bf-big ${r === 'W' ? 'bf-lose' : ''}">${them}</span></div><div class="bf-side">${sh(opp, 'l')}<div class="bf-nm">${esc(opp.name)}</div></div></div>
        <span class="bf-result bf-${r}">${r === 'W' ? (champ === S.user ? 'Champions!' : 'Victory') : r === 'L' ? 'Defeat' : 'Tie'}</span><div class="bf-xs bf-mu" style="margin-top:8px">${esc(modeNote)}</div></section>
      ${champ === S.user ? `<button class="bf-btn bf-pri bf-big bf-block" data-a="trophy">${ic('hist')} Lift the ${TROPHY} again</button>` : ''}
      ${pog ? `<div class="bf-pog">${av(pog, 'l')}<div style="min-width:0"><div class="bf-k" style="color:var(--gold)">Player of the game</div><div style="font:800 22px/1.05 var(--disp);text-transform:uppercase">${pLink(pog)}</div><div class="bf-sm bf-mu">${esc(pog.pos)} · ${esc(TM(pog.t).name)} · ${esc(statSummary(res.lines[pog.id], pog))}</div></div></div>` : ''}
      <div class="bf-two">${res.hl && res.hl.length ? card('Highlights', `<ul class="bf-hl">${res.hl.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`) : ''}
        ${card('Team stats', teamStatsCmp(myTb, opTb, ut, opp))}</div>
      ${card(esc(ut.name) + ' box score', boxTables(res.lines, ut.id) || '<div class="bf-sm bf-mu">No stats were recorded.</div>')}
      <div class="bf-two">${card('XP gained', `<div class="bf-xp">${xp.slice(0, 10).map(({ id, x }) => { const p = PL(id); return p ? `<span class="bf-trunc">${pLink(p)} <span class="bf-xs bf-mu">${p.pos}</span></span><span><b>+${x}</b>${ups[id] ? ` <span class="bf-up">${ups[id].map((k) => '+1 ' + k).join(', ')}</span>` : ''}</span>` : ''; }).join('')}</div>${upIds.length ? `<div class="bf-sm bf-green" style="margin-top:8px">${plural(rep.lvl.length, 'rating boost')} this week!</div>` : ''}`)}
        ${card('Program points', `<div class="bf-xp">${rep.pts.map(([l, v]) => `<span>${esc(l)}</span><b class="bf-gold">+${v}</b>`).join('')}<span><b>Total</b></span><b class="bf-gold">+${ptsTotal}</b></div>${rep.inj.length || rep.back.length ? `<div style="margin-top:10px">${rep.inj.map((id) => { const p = PL(id); return p ? `<div class="bf-sm"><span class="bf-inj">${ic('medical')} ${esc(p.n)}</span>: ${esc(injTxt(p))}</div>` : ''; }).join('')}${rep.back.map((id) => { const p = PL(id); return p ? `<div class="bf-sm bf-green">${ic('check')} ${esc(p.n)} is back</div>` : ''; }).join('')}</div>` : ''}`)}</div>
      ${card(esc(opp.name) + ' box score', boxTables(res.lines, opp.id) || '<div class="bf-sm bf-mu">No stats.</div>')}
      ${others.length ? card('Around the league', `<div class="bf-scores">${others.map(scoreCard).join('')}</div>`) : ''}
      <button class="bf-btn bf-pri bf-big bf-block" data-a="postDone">Continue ${ic('right')}</button></div>`;
  }

  // ---------- trophy & confetti ----------
  let confettiStop = null;
  function showTrophy() {
    const layer = document.getElementById('bf-fx');
    if (!layer) return;
    const ut = userTeam(), A = S.lastAwards || {};
    const mvp = A.mvp && PL(A.mvp);
    layer.innerHTML = `<div class="bf-trophy" role="dialog" aria-modal="true" aria-label="Champions"><div><div class="bf-cup">${cupSVG(140)}</div><div class="bf-k" style="color:var(--gold)">Season ${S.season} · ${esc(String(S.year))}</div><h2>${CHAMP} Champions</h2><div style="display:flex;justify-content:center;margin:10px 0">${sh(ut, 'l')}</div><div style="font:800 24px/1 var(--disp);text-transform:uppercase">${esc(ut.name)}</div><p class="bf-mu" style="max-width:360px;margin:10px auto">${esc(S.coach)} and ${esc(ut.nick)} take home the ${TROPHY}. ${S.cr.titles > 1 ? `That's title number ${S.cr.titles}!` : 'The first title of a dynasty?'}${mvp ? ` League MVP: ${esc(mvp.n)}.` : ''}</p><button class="bf-btn bf-pri bf-big" data-a="trophyClose">Continue</button></div></div><canvas class="bf-confetti"></canvas>`;
    confetti(layer.querySelector('canvas'), [ut.color, ut.color2, '#ffc21a', '#ffffff']);
    const b = layer.querySelector('[data-a="trophyClose"]'); if (b) b.focus();
  }
  function hideTrophy() { if (confettiStop) confettiStop(); const l = document.getElementById('bf-fx'); if (l) l.innerHTML = ''; UI.trophy = false; }
  function confetti(cv, colors) {
    if (!cv || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const rnd = rngFrom('confetti' + Date.now());
    const ps = Array.from({ length: 160 }, () => ({ x: rnd() * W, y: -rnd() * H * 0.6, vx: (rnd() - 0.5) * 3 * dpr, vy: (2 + rnd() * 4) * dpr, s: (5 + rnd() * 7) * dpr, a: rnd() * 6, va: (rnd() - 0.5) * 0.3, c: colors[Math.floor(rnd() * colors.length)] }));
    let raf = 0, t0 = performance.now(), live = true;
    const step = (t) => {
      if (!live) return;
      ctx.clearRect(0, 0, W, H);
      const age = (t - t0) / 1000;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx *= 0.995;
        if (p.y > H + 20 && age < 3.5) { p.y = -20; p.x = rnd() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = age > 5 ? Math.max(0, 1 - (age - 5)) : 1; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (age < 6.2) raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    confettiStop = () => { live = false; cancelAnimationFrame(raf); };
  }

  // ---------- offseason screens (inside the Hub) ----------
  function scoutView(rc) {
    const o = posOvr(rc.pos, rc.r), h = hashStr(rc.id);
    if (rc.sc >= 2) return { ovr: String(o), pot: potGrade(rc.pot) };
    if (rc.sc === 1) { const c = o + ((h % 3) - 1) * 2; return { ovr: `${c - 4}-${c + 4}`, pot: `${potGrade(rc.pot - 6)} to ${potGrade(rc.pot + 6)}` }; }
    const c = o + ((h % 7) - 3) * 2; return { ovr: `${Math.max(30, Math.round((c - 10) / 5) * 5)}-${Math.round((c + 10) / 5) * 5}`, pot: '?' };
  }
  function recruitRow(rc, fa) {
    const sv = scoutView(rc), it = interestFor(S.user, rc);
    const neutral = { color: '#2a2f3c', color2: '#e8ebf1' };
    const taken = rc.to && rc.to !== S.user;
    const btns = fa
      ? (rc.to === S.user ? '<span class="bf-chip bf-green">Joined ✓</span>' : taken ? `<span class="bf-chip">Joined ${esc(TM(rc.to).abbr)}</span>` : `<button class="bf-btn bf-sm ${S.pts >= rc.cost && openSpots() > 0 ? 'bf-pri' : ''}" data-a="signFA" data-id="${rc.id}" ${S.pts >= rc.cost && openSpots() > 0 ? '' : 'disabled'}>Sign · ${rc.cost}</button>`)
      : `${rc.sc < 2 ? `<button class="bf-btn bf-xs" data-a="scout" data-id="${rc.id}">${ic('scout')} Scout${S.off.scouts > 0 ? ' (free)' : ' · 10'}</button>` : ''}
        ${rc.of ? `<button class="bf-btn bf-xs bf-pri" data-a="unoffer" data-id="${rc.id}" title="Tap to take back the offer">${ic('check')} Offered</button>${rc.vis ? '<span class="bf-chip bf-green">Visited</span>' : `<button class="bf-btn bf-xs" data-a="visit" data-id="${rc.id}">Visit · 10</button>`}` : `<button class="bf-btn bf-xs" data-a="offer" data-id="${rc.id}">Offer${OFFER_COST[rc.st] ? ' · ' + OFFER_COST[rc.st] : ''}</button>`}`;
    return `<div class="bf-rc ${rc.of || rc.to === S.user ? 'bf-of' : ''}">${av({ n: rc.n, ph: null }, '', neutral)}<div style="min-width:0"><div class="bf-rcn bf-trunc">${esc(rc.n)}</div><div class="bf-rcm">${posTag(rc.pos)}${starsH(rc.st)}<span>${fa ? ord(rc.g) + ' grade' : esc(rc.hs)}</span></div>
      <div class="bf-rcm"><span>OVR <b style="color:var(--tx)">${sv.ovr}</b></span><span>Potential <b style="color:var(--tx)">${sv.pot}</b></span>${rc.sc >= 2 ? `<span>${esc(PERS[rc.pers].n)}</span>${rc.tr.map((k) => `<span class="bf-chip">${esc(TRAITS[k].n)}</span>`).join('')}` : ''}</div>
      ${fa ? '' : `<div class="bf-int">Interest ${meter(it, 100, it >= 58 ? '#2bd576' : it >= 40 ? '#ffc21a' : '#ff6b78')} <b>${interestWord(it)}</b></div>`}</div><div class="bf-rca">${btns}</div></div>`;
  }
  function viewOffseason() {
    const st = S.off.step, si = OFF_STEPS.indexOf(st);
    const stepper = `<div class="bf-stepper">${OFF_STEPS.map((k, i) => `<span class="${i === si ? 'bf-on' : i < si ? 'bf-done' : ''}">${i < si ? '✓ ' : ''}${OFF_LABEL[k]}</span>`).join('')}</div>`;
    const next = (label) => `<button class="bf-btn bf-pri bf-big bf-block" data-a="offNext">${label} ${ic('right')}</button>`;
    const last = S.hist.seasons[S.hist.seasons.length - 1];
    let body = '';
    if (st === 'recap') {
      const ch = last && TM(last.champ.id);
      const aw = last ? last.aw : {};
      const awCard = (k, label) => { const x = aw[k]; if (!x) return ''; const p = PL(x.id) || { n: x.n, ph: x.ph, t: x.tid }; return `<div class="bf-card bf-flat"><div class="bf-k" style="color:var(--gold)">${label}</div><div class="bf-row" style="margin-top:8px">${av(p, '', TM(x.tid) || undefined)}<div style="min-width:0"><div style="font-weight:800" class="bf-trunc">${PL(x.id) ? pLink(PL(x.id)) : esc(x.n)}</div><div class="bf-xs bf-mu bf-trunc">${esc(x.pos)} · ${esc(x.t)}${x.line ? ' · ' + esc(x.line) : ''}</div></div></div></div>`; };
      body = `<section class="bf-banner" style="--c1:${ch ? ch.color : '#ffc21a'};--c2:#ffc21a">${cupSVG(64)}<div class="bf-k">Season ${S.season} champion</div><h2 class="bf-h" style="font-size:30px;margin:6px 0">${esc(last ? last.champ.n : '')}</h2><div class="bf-sm bf-mu">Beat ${esc(last ? last.ru.n : '')} in the ${CHAMP}</div></section>
        ${card('Your season', `<div class="bf-kv"><div><span>Record</span><b>${esc(last ? last.user.rec : '')}</b></div><div><span>Division</span><b>${last ? ord(last.user.div) : ''}</b></div><div><span>Finish</span><b style="font-size:15px">${esc(last ? last.user.fin : '')}</b></div></div>${last && last.user.goal ? `<div class="bf-note ${last.user.met ? '' : 'bf-warn'}" style="margin-top:10px">${ic(last.user.met ? 'check' : 'info')}<div>Season goal: <b>${esc(last.user.goal)}</b>. ${last.user.met ? 'Done! +75 points from the boosters.' : 'Not this year.'}</div></div>` : ''}`)}
        <div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${awCard('mvp', 'Most Valuable Player')}${awCard('opoy', 'Offensive Player of the Year')}${awCard('dpoy', 'Defensive Player of the Year')}${awCard('roy', 'Rookie of the Year')}${aw.coy ? `<div class="bf-card bf-flat"><div class="bf-k" style="color:var(--gold)">Coach of the Year</div><div class="bf-row" style="margin-top:8px">${sh(S.order.map(TM).find((t) => t.abbr === aw.coy.t) || userTeam(), 's')}<div><b>${esc(aw.coy.n)}</b><div class="bf-xs bf-mu">${esc(aw.coy.tn || aw.coy.t)}</div></div></div></div>` : ''}</div>
        ${last && last.al ? card('All-League 1st Team', `<div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px">${last.al.map((a) => `<div class="bf-sm ${PL(a.id) && PL(a.id).t === S.user ? 'bf-gold' : ''}">${posTag(a.pos)} ${PL(a.id) ? pLink(PL(a.id)) : esc(a.n)} <span class="bf-xs bf-mu">${esc(a.t)}</span></div>`).join('')}</div>`) : ''}
        ${next('Graduation day')}`;
    } else if (st === 'grad') {
      const gs = S.off.grads || [];
      body = `${card(`Farewell, eighth graders`, gs.length ? `<p class="bf-sm bf-mu" style="margin:0 0 10px">These kids are off to high school. Thanks for everything!</p><div class="bf-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${gs.map((x) => `<div class="bf-card bf-flat"><div class="bf-row">${av({ n: x.n, ph: x.ph }, 'l', userTeam())}<div style="min-width:0"><div style="font:800 18px/1.05 var(--disp);text-transform:uppercase" class="bf-trunc">${esc(x.n)}</div><div class="bf-xs bf-mu">${esc(x.pos)} · #${x.num} · ${plural(x.yrs, 'season')} · ${x.o} OVR</div>${x.hof ? '<span class="bf-chip bf-gold" style="margin-top:4px">Hall of Fame</span>' : ''}</div></div><div class="bf-sm" style="margin-top:8px">${esc(x.line)}</div>${x.aw.length ? `<div class="bf-row bf-wrap" style="gap:5px;margin-top:6px">${x.aw.slice(0, 3).map((a) => `<span class="bf-chip bf-gold">${esc(a)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>` : empty('grad', 'No graduates', 'Your whole team comes back next year.'))}
        <div class="bf-note">${ic('info')}<div>${plural(S.off.gradAll || 0, 'eighth grader')} graduated across the league.${S.off.hof && S.off.hof.length ? ' Hall of Fame: ' + esc(S.off.hof.join(', ')) + '.' : ''}</div></div>${next('Summer development')}`;
    } else if (st === 'dev') {
      const ds = (S.off.dev || []).filter((d) => PL(d.id));
      body = `${card('Summer development', `<p class="bf-sm bf-mu" style="margin:0 0 10px">Everybody moved up a grade. Young players with high potential grow the most.</p>${ds.map((d) => { const p = PL(d.id), dl = d.to - d.from; return `<button class="bf-prow" data-a="player" data-id="${p.id}">${av(p)}<div style="min-width:0"><div class="bf-pn bf-trunc">${esc(p.n)}</div><div class="bf-ps">${posTag(p.pos)}<span>Now ${ord(p.g)}</span>${d.note ? `<span class="${dl > 0 ? 'bf-green' : 'bf-mu'}">${esc(d.note)}</span>` : ''}</div></div><span class="bf-row" style="gap:6px"><span class="bf-mu bf-sm">${d.from}</span>${ic('right')}${ovrB(d.to)}<b class="${dl > 0 ? 'bf-green' : dl < 0 ? 'bf-red' : 'bf-mu'}" style="width:28px;text-align:right">${dl > 0 ? '+' : ''}${dl}</b></span></button>`; }).join('') || empty('trend', 'Nobody to develop', '')}`)}${next('Start recruiting')}`;
    } else if (st === 'recruit') {
      const f = UI.filter.rpos || 'all';
      const needs = POS.filter((pos) => posNeed(S.user, pos) > 0);
      const list = S.off.pool.filter((r) => f === 'all' || (f === 'of' ? r.of : r.pos === f));
      body = `${card('Recruiting', `<div class="bf-kv"><div><span>Open spots</span><b>${openSpots()}</b></div><div><span>Offers</span><b>${offersOut()}/${maxOffers()}</b></div><div><span>Free scouts</span><b>${S.off.scouts}</b></div></div>
        <p class="bf-sm bf-mu" style="margin:10px 0 0">Scout to see a recruit's real rating and hidden potential. Offer a spot, then invite them for a visit to raise their interest. On Signing Day they pick between every school that offered.${needs.length ? ` <b style="color:var(--tx)">Needs: ${needs.join(', ')}</b>` : ''}</p>`)}
        <div class="bf-seg">${[['all', 'All'], ['of', 'My offers'], ...POS.map((p) => [p, p])].map(([v, l]) => `<button class="${f === v ? 'bf-on' : ''}" data-a="sub" data-k="rpos" data-v="${v}">${l}</button>`).join('')}</div>
        <div>${list.map((rc) => recruitRow(rc)).join('') || empty('scout', 'No recruits here', f === 'of' ? 'You have not offered anyone yet.' : 'Try another position.')}</div>
        <button class="bf-btn bf-pri bf-big bf-block" data-a="signDay">${ic('star')} Go to Signing Day (${offersOut()} offer${offersOut() === 1 ? '' : 's'})</button>`;
    } else if (st === 'signed') {
      const mine = (S.off.signed || []).map(PL).filter(Boolean);
      const rank = (S.off.classRank || []).findIndex((x) => x[0] === S.user) + 1;
      body = `${card('Signing Day', mine.length ? `<div class="bf-plist">${mine.map((p) => playerRow(p, starsH(p.st || 0))).join('')}</div>` : empty('scout', 'No signees', 'Nobody picked your school this year. Walk-ons will fill the roster.'), rank ? `<span class="bf-chip bf-gold">Class rank #${rank}</span>` : '')}
        ${(S.off.lost || []).length ? card('Chose somewhere else', (S.off.lost || []).map((x) => `<div class="bf-row bf-sm" style="padding:5px 0">${posTag(x.pos)}<b class="bf-trunc">${esc(x.n)}</b>${starsH(x.st)}<span class="bf-sp"></span><span class="bf-mu">${x.to ? 'Chose ' + esc(x.to) : 'No spot left'}</span></div>`).join('')) : ''}
        ${card('Top recruiting classes', (S.off.classRank || []).slice(0, 5).map((x, i) => `<div class="bf-row" style="padding:5px 0">${'<b style="width:18px">' + (i + 1) + '</b>'}${tLink(TM(x[0]))}<span class="bf-sp"></span><span class="bf-sm bf-mu">${plural(x[1], 'recruit')}</span></div>`).join(''))}${next('New in town')}`;
    } else if (st === 'transfer') {
      body = `${card('New in town', `<p class="bf-sm bf-mu" style="margin:0 0 10px">These kids just moved to the area and are looking for a team. They are fully scouted. Signing one costs program points.</p>${(S.off.fa || []).map((rc) => recruitRow(rc, true)).join('')}`, `<span class="bf-chip">${openSpots()} spots open</span>`)}${next('Get ready for next season')}`;
    } else if (st === 'ready') {
      const t = userTeam(), R = teamRatings(t);
      const proj = S.order.slice().sort((a, b) => teamRatings(TM(b)).ovr - teamRatings(TM(a)).ovr).indexOf(S.user) + 1;
      const newbies = roster(S.user).filter((p) => p.rk === S.season + 1);
      const walk = (S.off.walk || []).filter((id) => PL(id));
      const counts = POS.map((pos) => [pos, roster(S.user).filter((p) => p.pos === pos).length]);
      body = `${card(`Season ${S.season + 1} preview`, `<div class="bf-kv"><div><span>Overall</span><b>${R.ovr}</b></div><div><span>Projected</span><b>#${proj}</b></div><div><span>Roster</span><b>${roster(S.user).length}</b></div></div><div class="bf-row bf-wrap" style="gap:6px;margin-top:10px">${counts.map(([p, n]) => `<span class="bf-chip ${n < STARTERS[p] ? 'bf-red' : ''}">${p} ${n}</span>`).join('')}</div>`)}
        ${card('New faces', newbies.length ? `<div class="bf-plist">${newbies.map((p) => playerRow(p, p.walk ? '<span class="bf-chip">Walk-on</span>' : p.st ? starsH(p.st) : '')).join('')}</div>` : empty('roster', 'Same crew', 'No new players this year.'))}
        <button class="bf-btn bf-pri bf-big bf-block" data-a="offNext">${ic('play', 'fill')} Start Season ${S.season + 1}</button>`;
    }
    return `<div class="bf-col"><div class="bf-row bf-sb bf-wrap"><h2 class="bf-h">Offseason</h2><span class="bf-chip">Season ${S.season} is in the books</span></div>${stepper}${body}</div>`;
  }

  // ---------- sheets ----------
  function sheetPlayer(id) {
    const p = PL(id);
    if (!p) return `<div class="bf-sheet-h"><h3 class="bf-h">Player</h3><span class="bf-sp"></span>${closeBtn()}</div>${empty('roster', 'Not on a team anymore', 'This player has graduated.')}`;
    const t = TM(p.t), mine = p.t === S.user, o = ovr(p);
    const keys = RK.slice().sort((a, b) => (WT[p.pos][b] || 0) - (WT[p.pos][a] || 0));
    const main = keys.filter((k) => WT[p.pos][k]), rest = keys.filter((k) => !WT[p.pos][k]);
    const bars = (ks) => ks.map((k) => `<div class="bf-rb"><span>${RNAME[k]}</span>${meter(p.r[k], 99)}<b>${p.r[k]}</b></div>`).join('');
    const s = p.s, c = p.c;
    const statKV = (x) => {
      const items = [];
      if (num(x.pa)) items.push(['Pass yds', fmt(x.py)], ['Pass TD', num(x.ptd)], ['Comp', `${num(x.pc)}/${num(x.pa)}`], ['INT', num(x.pi)]);
      if (num(x.ra)) items.push(['Rush yds', fmt(x.ry)], ['Rush TD', num(x.rtd)], ['Carries', num(x.ra)]);
      if (num(x.rc)) items.push(['Catches', num(x.rc)], ['Rec yds', fmt(x.rcy)], ['Rec TD', num(x.rctd)]);
      if (num(x.fga)) items.push(['FG', `${num(x.fgm)}/${num(x.fga)}`]);
      if (num(x.tk) || num(x.sk) || num(x.it)) items.push(['Flag pulls', num(x.tk)], ['Sacks', num(x.sk)], ['INT', num(x.it)]);
      items.unshift(['Games', num(x.gp)]);
      if (!num(x.gp)) return '<div class="bf-sm bf-mu">No games played yet.</div>';
      return `<div class="bf-kv">${items.slice(0, 9).map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div>`;
    };
    const devs = p.yrs.map((y) => [('S' + y.s), y.o]).concat([[S.phase === 'offseason' ? 'Now' : 'Now', o]]);
    const mx = Math.max(...devs.map((d) => d[1]), 60), mn = Math.min(...devs.map((d) => d[1]), 40) - 8;
    const badges = badgesOf(p);
    const starter = mine && (t.depth[p.pos] || []).indexOf(p.id) >= 0 && (t.depth[p.pos] || []).indexOf(p.id) < STARTERS[p.pos];
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><span class="bf-k">${esc(POS_NAME[p.pos])}</span><span class="bf-sp"></span>${closeBtn()}</div>
      <div class="bf-phead">${av(p, 'xl', t)}<div style="min-width:0"><div class="bf-pname">${esc(p.n)}</div><div class="bf-sm bf-mu" style="margin-top:4px">#${p.num} · ${p.pos} · ${gradeLabel(p.g)}</div><div style="margin-top:6px">${tLink(t, 's')}</div></div><span class="bf-sp"></span><div style="text-align:center">${ovrB(o, 'lg')}<div class="bf-xs bf-mu" style="margin-top:4px">OVR</div></div></div>
      <div class="bf-row bf-wrap" style="gap:6px;margin-bottom:12px">${p.mfl ? '<span class="bf-chip bf-gold">Real MFL player</span>' : ''}${p.st ? `<span class="bf-chip">Recruited ${'★'.repeat(p.st)}</span>` : ''}<span class="bf-chip bf-blue" title="${esc(PERS[p.pers].d)}">${esc(PERS[p.pers].n)}</span>${p.tr.map((k) => `<span class="bf-chip bf-green" title="${esc(TRAITS[k].d)}">${esc(TRAITS[k].n)}</span>`).join('')}${badges.map((b) => `<span class="bf-chip bf-gold">${esc(b)}</span>`).join('')}${p.inj ? `<span class="bf-chip bf-red">${ic('medical')} ${esc(injTxt(p))}</span>` : ''}</div>
      ${mine ? `<div class="bf-kv" style="margin-bottom:12px"><div><span>Potential</span><b>${potGrade(p.pot)}</b></div><div><span>Morale</span><b style="font-size:15px">${esc(moraleWord(p.mor))}</b></div><div><span>Next boost</span><b>${Math.floor(num(p.xp))}/100</b></div></div>` : ''}
      <div class="bf-card bf-flat" style="margin-bottom:12px"><div class="bf-k" style="margin-bottom:6px">Ratings</div>${bars(main)}<details><summary class="bf-xs bf-mu" style="cursor:pointer;margin-top:6px">Other ratings</summary>${bars(rest)}</details></div>
      <div class="bf-k" style="margin:4px 0 6px">Season ${S.season}</div>${statKV(s)}
      <div class="bf-k" style="margin:14px 0 6px">Career</div>${statKV(c)}
      ${devs.length > 1 ? `<div class="bf-k" style="margin:14px 0 2px">Development</div><div class="bf-spark" style="--tca:${accent(t)}">${devs.map(([l, v]) => `<div><b>${v}</b><i style="height:${clamp(((v - mn) / (mx - mn)) * 100, 8, 100)}%"></i><span>${l}</span></div>`).join('')}</div>` : ''}
      ${p.yrs.length ? `<div class="bf-k" style="margin:14px 0 6px">By season</div><div class="bf-tw"><table class="bf-tbl"><thead><tr><th>Season</th><th>Team</th><th>Gr</th><th>OVR</th><th class="bf-l">Line</th></tr></thead><tbody>${p.yrs.map((y) => `<tr><td class="bf-l">S${y.s}</td><td>${esc(y.t)}</td><td>${y.g}</td><td>${y.o}</td><td class="bf-l bf-xs">${esc(statSummary(y.st || {}, p) || '-')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${p.aw.length ? `<div class="bf-k" style="margin:14px 0 6px">Awards</div><div class="bf-row bf-wrap" style="gap:6px">${p.aw.map(([k, s0]) => `<span class="bf-chip bf-gold">${esc(k === 'champ' ? CHAMP + ' champ' : AWARD_NAMES[k] || k)} · S${s0}</span>`).join('')}</div>` : ''}
      ${mine ? `<div class="bf-k" style="margin:16px 0 6px">Coach's options</div><div class="bf-row bf-wrap">${!starter && healthy(p) ? `<button class="bf-btn bf-sm bf-pri" data-a="makeStarter" data-id="${p.id}">${ic('up')} Make starter</button>` : ''}<label class="bf-sm bf-mu" for="bf-pos-${p.id}">Position</label><select id="bf-pos-${p.id}" class="bf-inp" style="width:auto;min-height:38px;font-size:14px" data-ch="pos" data-id="${p.id}">${POS.map((x) => `<option value="${x}" ${x === p.pos ? 'selected' : ''}>${x} (${posOvr(x, p.r)})</option>`).join('')}</select></div>` : ''}`;
  }
  const closeBtn = () => `<button class="bf-btn bf-icon bf-sm bf-ghost" data-a="close" aria-label="Close">${ic('x')}</button>`;
  function sheetTeam(id) {
    const t = TM(id); if (!t) return '';
    const R = teamRatings(t), ps = roster(id).slice().sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || (t.depth[a.pos] || []).indexOf(a.id) - (t.depth[b.pos] || []).indexOf(b.id));
    const best = roster(id).slice().sort((a, b) => ovr(b) - ovr(a)).slice(0, 4);
    const games = [];
    for (const wk of S.sched) for (const g of wk) if (g.h === id || g.a === id) games.push(g);
    const res = games.filter((g) => g.done).map((g) => { const w = gameWinner(g), r = !w ? 'T' : w === id ? 'W' : 'L'; const o = TM(g.h === id ? g.a : g.h); return `<span class="bf-chip" title="${esc(o.name)}"><span class="bf-wl bf-${r}" style="width:18px;height:18px;font-size:11px">${r}</span> ${esc(o.abbr)} ${g.h === id ? g.hs + '-' + g.as : g.as + '-' + g.hs}</span>`; });
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><span class="bf-k">${DIVS[t.div]} Division</span><span class="bf-sp"></span>${closeBtn()}</div>
      <div class="bf-phead">${sh(t, 'xl')}<div style="min-width:0"><div class="bf-pname">${esc(t.name)}</div><div class="bf-sm bf-mu" style="margin-top:4px">${recStr(t)} · #${t.pr} power · ${esc(id === S.user ? S.coach : t.coach)}</div><div class="bf-xs bf-mu" style="margin-top:4px">Prestige ${starsH(Math.round(clamp(t.prest, 0, 100) / 20))}${t.at.titles ? ` · ${plural(t.at.titles, 'title')}` : ''}</div></div></div>
      <div class="bf-kv" style="margin-bottom:12px"><div><span>Overall</span><b>${R.ovr}</b></div><div><span>Offense</span><b>${R.off}</b></div><div><span>Defense</span><b>${R.def}</b></div></div>
      <div class="bf-k" style="margin-bottom:6px">Best players</div><div class="bf-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">${best.map((p) => `<button class="bf-lk" data-a="player" data-id="${p.id}" style="padding:8px;border-radius:12px;background:var(--s2);border:1px solid var(--line)">${av(p, 's', t)}<span style="min-width:0" class="bf-trunc"><span class="bf-u bf-sm">${esc(firstName(p.n)[0] + '. ' + lastName(p.n))}</span><br><span class="bf-xs bf-mu">${p.pos}</span></span><span class="bf-sp"></span>${ovrB(ovr(p))}</button>`).join('')}</div>
      ${res.length ? `<div class="bf-k" style="margin-bottom:6px">This season</div><div class="bf-row bf-wrap" style="gap:6px;margin-bottom:12px">${res.join('')}</div>` : ''}
      <div class="bf-k" style="margin-bottom:2px">Roster</div><div class="bf-plist">${ps.map((p) => playerRow(p)).join('')}</div>`;
  }
  function sheetBox(gid) {
    const g = findGame(gid); if (!g) return '';
    const b = S.box[gid], H = TM(g.h), A = TM(g.a), w = gameWinner(g);
    const head = `<div class="bf-grab"></div><div class="bf-sheet-h"><span class="bf-k">${esc(gameLabel(g))} · Final${g.ot ? '/OT' : ''}</span><span class="bf-sp"></span>${closeBtn()}</div>
      <div class="bf-final"><div class="bf-side">${sh(A, 'l')}<div class="bf-nm">${esc(A.name)}</div></div><div><span class="bf-big ${w === g.h ? 'bf-lose' : ''}" style="font-size:44px">${g.as}</span><span class="bf-big bf-mu2" style="font-size:26px;margin:0 6px">–</span><span class="bf-big ${w === g.a ? 'bf-lose' : ''}" style="font-size:44px">${g.hs}</span></div><div class="bf-side">${sh(H, 'l')}<div class="bf-nm">${esc(H.name)}</div></div></div>`;
    if (!b) return head + `<div class="bf-col">${(g.ld || []).map(([id, txt]) => { const p = PL(id); return p ? `<div class="bf-row bf-sm">${av(p, 's')}${pLink(p)}<span class="bf-mu">${esc(txt)}</span></div>` : ''; }).join('')}</div>`;
    const pog = b.pog && PL(b.pog);
    return head + `${b.q ? '<div class="bf-note bf-warn" style="margin-bottom:10px">Left early: counted as a loss.</div>' : ''}${pog ? `<div class="bf-pog" style="margin-bottom:12px">${av(pog)}<div><div class="bf-k" style="color:var(--gold)">Player of the game</div><b>${pLink(pog)}</b><div class="bf-xs bf-mu">${esc(statSummary(b.ln ? b.ln[pog.id] : null, pog))}</div></div></div>` : ''}
      ${b.hl && b.hl.length ? `<div class="bf-k" style="margin-bottom:6px">Highlights</div><ul class="bf-hl" style="margin-bottom:12px">${b.hl.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <div class="bf-k" style="margin-bottom:4px">Team stats</div>${teamStatsCmp(b.tb.a, b.tb.h, A, H)}
      ${b.ln ? `<div class="bf-k" style="margin:14px 0 0;color:var(--tx)">${esc(A.name)}</div>${boxTables(b.ln, A.id)}<div class="bf-k" style="margin:14px 0 0;color:var(--tx)">${esc(H.name)}</div>${boxTables(b.ln, H.id)}` : ''}`;
  }
  function sheetMatchup(gid) {
    const g = findGame(gid); if (!g) return '';
    if (g.done && (g.h === S.user || g.a === S.user)) return sheetBox(gid);
    const H = TM(g.h), A = TM(g.a), RH = teamRatings(H), RA = teamRatings(A);
    if (g.done) return sheetBox(gid);
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><span class="bf-k">${esc(gameLabel(g))} · Preview</span><span class="bf-sp"></span>${closeBtn()}</div>
      <div class="bf-match"><div class="bf-side">${sh(A, 'l')}<div class="bf-nm">${esc(A.name)}</div><div class="bf-rec">${recStr(A)}</div></div><div class="bf-vs">at<b>VS</b></div><div class="bf-side">${sh(H, 'l')}<div class="bf-nm">${esc(H.name)}</div><div class="bf-rec">${recStr(H)}</div></div></div>
      ${cmpRow('OFF', RA.off, RH.off)}${cmpRow('DEF', RA.def, RH.def)}${cmpRow('OVR', RA.ovr, RH.ovr)}
      <div class="bf-btns" style="margin-top:12px"><button class="bf-btn" data-a="team" data-id="${A.id}">${esc(A.abbr)} roster</button><button class="bf-btn" data-a="team" data-id="${H.id}">${esc(H.abbr)} roster</button></div>`;
  }
  function sheetMenu() {
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><h3 class="bf-h">${esc(S.name)}</h3><span class="bf-sp"></span>${closeBtn()}</div>
      <p class="bf-sm bf-mu" style="margin:-4px 0 12px">Slot ${esc(Saver.slot)} · ${ACCOUNT ? 'saved to your account' : 'saved on this device'} · ${esc(DIFFS[S.diff].name)} · ${S.qmin}-min quarters</p>
      <div class="bf-col" style="gap:8px"><button class="bf-btn bf-block" data-a="settings">${ic('gear')} Game settings</button><button class="bf-btn bf-block" data-a="rename">${ic('pen')} Rename franchise</button><button class="bf-btn bf-block" data-a="help">${ic('info')} How Franchise works</button><button class="bf-btn bf-block" data-a="exitSlots">${ic('exit')} Switch franchise</button><button class="bf-btn bf-block bf-danger" data-a="restart">${ic('restart')} Restart this franchise</button></div>`;
  }
  function sheetSettings() {
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><h3 class="bf-h">Game settings</h3><span class="bf-sp"></span>${closeBtn()}</div>
      <div class="bf-k" style="margin-bottom:6px">Difficulty (3D games)</div><div class="bf-opts" style="margin-bottom:14px">${DIFFS.map((d, i) => `<button class="bf-pick ${S.diff === i ? 'bf-on' : ''}" data-a="setDiff" data-v="${i}"><span class="bf-ck">${ic('check')}</span><b>${d.name}</b><small>${esc(d.note)}</small></button>`).join('')}</div>
      <div class="bf-k" style="margin-bottom:6px">Quarter length</div><div class="bf-opts bf-three">${[2, 3, 4].map((q) => `<button class="bf-pick ${S.qmin === q ? 'bf-on' : ''}" data-a="setQ" data-v="${q}"><span class="bf-ck">${ic('check')}</span><b>${q} min</b><small>${q === 2 ? 'Quick games' : q === 3 ? 'A bit longer' : 'Full length'}</small></button>`).join('')}</div>`;
  }
  function sheetHelp() {
    const li = (t, d) => `<li style="margin-bottom:8px"><b>${t}</b><br><span class="bf-mu">${d}</span></li>`;
    return `<div class="bf-grab"></div><div class="bf-sheet-h"><h3 class="bf-h">How Franchise works</h3><span class="bf-sp"></span>${closeBtn()}</div><ul class="bf-sm" style="padding-left:18px;margin:0">
      ${li('Play or sim every game', 'Play your games in 3D Blitz, or sim them. Every other game in the league is simulated from team ratings.')}
      ${li('11 weeks, then playoffs', `Every team plays every other team once. Division winners plus the best records make the top ${S.poSize}. The final is the ${CHAMP}.`)}
      ${li('Grow your players', 'Stats and practice give XP. Every 100 XP is a chance at a rating boost. Potential decides how high a kid can climb.')}
      ${li('Keep the team happy', 'Wins, playing time and Team Bonding lift morale. Chemistry grows every week. Both help in close games.')}
      ${li('Spend program points', 'Earn points from games, playoff runs and awards. Spend them on facilities, staff, recruiting and new players.')}
      ${li('Offseason', '8th graders graduate, everyone else grows, and you recruit a new class of 6th graders. Then a new season starts, and your history keeps adding up.')}
      ${li('Saving', ACCOUNT ? 'Everything saves to your account automatically.' : 'Everything saves on this device automatically. Log in to save to your account instead.')}</ul>`;
  }
  function sheetConfirm(d) {
    return `<div class="bf-sheet-h"><h3 class="bf-h">${esc(d.title)}</h3><span class="bf-sp"></span>${closeBtn()}</div><p class="bf-mu" style="margin:0 0 16px">${d.html || esc(d.msg)}</p><div class="bf-btns"><button class="bf-btn" data-a="close">Cancel</button><button class="bf-btn ${d.danger ? 'bf-danger' : 'bf-pri'}" data-a="confirmYes">${esc(d.yes || 'OK')}</button></div>`;
  }
  function sheetRename(d) {
    return `<div class="bf-sheet-h"><h3 class="bf-h">Rename franchise</h3><span class="bf-sp"></span>${closeBtn()}</div><div class="bf-in-f"><label for="bf-rn">Franchise name</label><input id="bf-rn" class="bf-inp" maxlength="32" value="${esc(d.name || '')}" autocomplete="off"></div><div class="bf-btns"><button class="bf-btn" data-a="close">Cancel</button><button class="bf-btn bf-pri" data-a="renameSave">Save name</button></div>`;
  }
  function sheetQuit(d) {
    return `<div class="bf-sheet-h"><h3 class="bf-h">You left the game</h3></div><p class="bf-mu" style="margin:0 0 6px">The score was <b style="color:var(--tx)">${d.us}-${d.them}</b> when you left.</p><p class="bf-mu" style="margin:0 0 16px">Count it as a loss and move on, or replay the game from the start?</p><div class="bf-col" style="gap:8px"><button class="bf-btn bf-pri bf-block" data-a="quitReplay">${ic('restart')} Replay the game</button><button class="bf-btn bf-block" data-a="quitSim">${ic('ff')} Sim it instead</button><button class="bf-btn bf-danger bf-block" data-a="quitLoss">Count it as a loss</button></div>`;
  }
  function sheetEngineErr(d) {
    return `<div class="bf-sheet-h"><h3 class="bf-h">${d.nogl ? '3D is not available' : 'Game interrupted'}</h3><span class="bf-sp"></span>${closeBtn()}</div><p class="bf-mu" style="margin:0 0 16px">${d.nogl ? `The 3D game could not start: ${esc(d.msg)}. You can sim this game instead, or try again in a different browser.` : `The 3D game stopped before the final whistle (${esc(d.msg)}). Nothing was recorded.`}</p><div class="bf-btns"><button class="bf-btn" data-a="play">${ic('restart')} Try again</button><button class="bf-btn bf-pri" data-a="simGame">${ic('ff')} Sim this game</button></div>`;
  }
  function openSheet(kind, data) { UI.sheet = { kind, data: data || {} }; renderSheet(); }
  function closeSheet() { UI.sheet = null; renderSheet(); }
  function renderSheet() {
    const L = document.getElementById('bf-layer');
    if (!L) return;
    if (!UI.sheet) { L.innerHTML = ''; document.documentElement.style.overflow = ''; return; }
    const { kind, data } = UI.sheet;
    let body;
    try {
    body = kind === 'player' ? sheetPlayer(data.id) : kind === 'team' ? sheetTeam(data.id) : kind === 'box' ? sheetBox(data.id) : kind === 'matchup' ? sheetMatchup(data.id)
      : kind === 'menu' ? sheetMenu() : kind === 'settings' ? sheetSettings() : kind === 'help' ? sheetHelp() : kind === 'confirm' ? sheetConfirm(data) : kind === 'rename' ? sheetRename(data)
      : kind === 'quit' ? sheetQuit(data) : kind === 'engineErr' ? sheetEngineErr(data) : '';
    } catch (e) { console.error('[franchise]', e); body = `<div class="bf-sheet-h"><span class="bf-sp"></span>${closeBtn()}</div>${errorCard(e)}`; }
    const small = ['confirm', 'rename', 'quit', 'engineErr', 'menu'].includes(kind);
    const keep = kind === 'quit';
    L.innerHTML = `<div class="bf-ov" data-ov="${keep ? 'keep' : 'close'}"><div class="bf-sheet ${small ? 'bf-sm' : ''}" role="dialog" aria-modal="true" tabindex="-1">${body}</div></div>`;
    document.documentElement.style.overflow = 'hidden';
    const sheet = L.querySelector('.bf-sheet');
    const f = sheet && (sheet.querySelector('input') || sheet.querySelector('.bf-btn.pri') || sheet);
    if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  function toast(msg) {
    const l = document.getElementById('bf-toast'); if (!l) return;
    l.innerHTML = `<div class="bf-toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toast.t); toast.t = setTimeout(() => { l.innerHTML = ''; }, 2600);
  }
  function confirmBox(title, msg, yes, fn, danger) { UI.confirmFn = fn; openSheet('confirm', { title, msg, yes, danger }); }

  // ---------- save slots ----------
  const UI = { screen: 'slots', tab: 'hub', sub: {}, filter: {}, sheet: null, slots: null, slotErr: null, loading: null, week: null, post: null, trophy: false, attempt: {}, anim: true, confirmFn: null, quitRes: null, ctx: null, renameSlot: null };
  async function showSlots() {
    if (S && Saver.slot) { try { await Saver.flush(); } catch (e) {} }
    S = null; invalidate(); Saver.slot = null; Saver.status = 'idle'; Saver.pending = false;
    Object.assign(UI, { screen: 'slots', sheet: null, slots: null, slotErr: null, loading: null, post: null, trophy: false, anim: true });
    hideTrophy(); renderSheet(); render();
    try { UI.slots = await Store.list(); } catch (e) { UI.slotErr = (e && e.message) || 'Could not load your saves.'; }
    if (UI.screen === 'slots') render();
  }
  function slotCard(s) {
    if (UI.loading === s.slot) return `<div class="bf-slot"><div class="bf-slotn">Slot ${esc(s.slot)}</div><div class="bf-load"><div><div class="bf-spin"></div>Opening…</div></div></div>`;
    if (s.empty) return `<div class="bf-slot"><div class="bf-slotn">Slot ${esc(s.slot)}</div>${empty('plus', 'Empty slot', 'Start a new program here.', `<button class="bf-btn bf-pri" data-a="slotNew" data-slot="${esc(s.slot)}">${ic('plus')} New franchise</button>`)}</div>`;
    if (s.broken) return `<div class="bf-slot"><div class="bf-slotn">Slot ${esc(s.slot)}</div>${empty('info', 'Damaged save', 'This save could not be read.', `<button class="bf-btn bf-danger" data-a="slotDelete" data-slot="${esc(s.slot)}">${ic('trash')} Delete it</button>`)}</div>`;
    const m = s.meta || {};
    const t = { color: hexOk(m.color) ? m.color : '#666666', color2: hexOk(m.color2) ? m.color2 : '#ffffff', abbr: String(m.abbr || '?').slice(0, 4) };
    return `<div class="bf-slot bf-full" style="--c1:${t.color}"><div class="bf-row bf-sb"><span class="bf-slotn">Slot ${esc(s.slot)}</span><span class="bf-xs bf-mu">${s.updated ? 'Played ' + esc(timeAgo(s.updated)) : ''}</span></div>
      <div class="bf-row" style="margin:12px 0">${sh(t, 'l')}<div style="min-width:0"><div class="bf-h2 bf-trunc" style="font-size:21px">${esc(m.name || m.team || 'Franchise')}</div><div class="bf-sm bf-mu bf-trunc">${esc(m.team || '')} · ${esc(m.coach || '')}</div></div></div>
      <div class="bf-kv"><div><span>Season</span><b>${esc(m.season || 1)}</b></div><div><span>Record</span><b>${esc(m.record || '0-0')}</b></div><div><span>Titles</span><b>${esc(m.titles || 0)}</b></div></div>
      <div class="bf-xs bf-mu" style="margin-top:8px">${esc(m.when || '')}${m.diff ? ' · ' + esc(m.diff) : ''}</div>
      <button class="bf-btn bf-pri bf-block" style="margin-top:12px" data-a="slotOpen" data-slot="${esc(s.slot)}">${ic('play', 'fill')} Continue</button>
      <div class="bf-btns" style="margin-top:8px"><button class="bf-btn bf-sm" data-a="slotRename" data-slot="${esc(s.slot)}">${ic('pen')} Rename</button><button class="bf-btn bf-sm" data-a="slotRestart" data-slot="${esc(s.slot)}">${ic('restart')} Restart</button><button class="bf-btn bf-sm bf-danger" data-a="slotDelete" data-slot="${esc(s.slot)}" aria-label="Delete slot ${esc(s.slot)}">${ic('trash')}</button></div></div>`;
  }
  function viewSlots() {
    const note = ACCOUNT ? `Saved to your account (${esc(BOOT.user)}). Play on any device.` : LS_OK ? 'Saved on this device. Log in to save to your account instead.' : 'This browser is blocking saves, so progress will be lost when you leave the page.';
    let body;
    if (UI.slotErr) body = `<div class="bf-note bf-err">${ic('info')}<div>${esc(UI.slotErr)}<div style="margin-top:8px"><button class="bf-btn bf-sm" data-a="reloadSlots">${ic('restart')} Try again</button></div></div></div>`;
    else if (!UI.slots) body = `<div class="bf-load"><div><div class="bf-spin"></div>Loading your saves…</div></div>`;
    else body = `<div class="bf-slots">${UI.slots.map(slotCard).join('')}</div>`;
    return `<div class="bf-col ${UI.anim ? 'bf-in' : ''}"><div><h2 class="bf-h">Your franchises</h2><div class="bf-sm bf-mu" style="margin-top:4px">${note}</div></div>${body}
      <div class="bf-card bf-flat"><div class="bf-row bf-at">${ic('info')}<div class="bf-sm bf-mu">Run a middle-school program for as many seasons as you like: play every game in 3D Blitz (or sim it), set your depth chart, train your players, upgrade facilities, recruit 6th graders and chase the ${CHAMP}. Up to three franchises at once.</div></div></div></div>`;
  }
  async function openSlot(slot) {
    UI.loading = slot; render();
    try {
      const x = await Store.load(slot);
      loadState(x.data);
      Saver.slot = slot; Saver.status = 'saved'; Saver.fails = 0; Saver.err = '';
      Object.assign(UI, { loading: null, screen: 'app', tab: 'hub', sub: {}, filter: {}, week: null, post: null, attempt: {}, anim: true });
      render(); scrollTop();
    } catch (e) {
      S = null; UI.loading = null; render();
      toast((e && e.message) || 'Could not open that save.');
    }
  }
  function restartFranchise() {
    const cfg = { mode: S.cfg.mode, realId: S.cfg.realId, custom: S.cfg.custom, picks: S.cfg.picks, coach: S.coach, diff: S.diff, qmin: S.qmin, po: S.poSize, name: S.name };
    createLeague(cfg);
    Object.assign(UI, { screen: 'app', tab: 'hub', sub: {}, filter: {}, week: null, post: null, attempt: {}, anim: true });
    Saver.mark(); render(); scrollTop();
    toast('Fresh start! Season 1 begins.');
  }

  // ---------- new franchise wizard ----------
  let W = null;
  function startWizard(slot) {
    W = { step: 0, slot, mode: BOOT.teams.length ? null : 'custom', realId: null, custom: { name: '', abbr: '', color: COLOR_PRESETS[0][0], color2: COLOR_PRESETS[0][1], abbrTouched: false }, picks: [], coach: BOOT.user ? BOOT.user : '', name: '', nameTouched: false, diff: 1, qmin: 2, po: 4, seed: uid() };
    UI.screen = 'wizard'; UI.anim = true; render(); scrollTop();
  }
  function wzTeam() {
    if (W.mode === 'custom') { const c = W.custom; return { name: c.name.trim() || 'New School', abbr: (c.abbr.trim() || autoAbbr(c.name) || 'NEW').toUpperCase().slice(0, 4), color: c.color, color2: c.color2 }; }
    return BOOT.teams.find((t) => t.id === W.realId) || null;
  }
  function autoAbbr(n) { const w = String(n || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return ''; return (w.length > 1 ? w.map((x) => x[0]).join('') : w[0].slice(0, 3)).toUpperCase().slice(0, 4); }
  const cleanCoach = (n) => { const s = String(n || '').replace(/^\s*coach\s+/i, '').trim().slice(0, 24); return 'Coach ' + (s || 'Rookie'); };
  function realPreview(tid) {
    const bps = BOOT.players.filter((p) => p.team === tid);
    return placeReal(bps, W.seed).map((x) => { const r = aimRatings(Object.assign({}, x.r), x.pos, x.bp.ovr); return { bp: x.bp, pos: x.pos, r, o: posOvr(x.pos, r) }; });
  }
  function bootAv(bp, size, t) { return av({ n: bp.name, ph: bp.photo }, size, t || BOOT.teams.find((x) => x.id === bp.team) || { color: '#444', color2: '#fff' }); }
  function viewWizard() {
    const steps = `<div class="bf-steps">${[0, 1, 2, 3].map((i) => `<i class="${i <= W.step ? 'bf-on' : ''}"></i>`).join('')}</div>`;
    const head = `<div class="bf-fhead" style="margin-bottom:10px"><button class="bf-btn bf-sm bf-ghost" data-a="wzBack">${ic('back')} ${W.step ? 'Back' : 'Saves'}</button><span class="bf-k">New franchise · Slot ${esc(W.slot)}</span></div>${steps}`;
    let body = '', can = true, nextLbl = 'Next';
    if (W.step === 0) {
      const cards = BOOT.teams.slice(0, 2).map((t) => {
        const ps = BOOT.players.filter((p) => p.team === t.id).sort((a, b) => (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || b.ovr - a.ovr);
        return `<button class="bf-tcard ${W.mode === 'real' && W.realId === t.id ? 'bf-on' : ''}" style="--c1:${t.color}" data-a="wzReal" data-id="${esc(t.id)}">${sh(t, 'l')}<div style="min-width:0"><div class="bf-k">Real MFL team${t.city ? ' · ' + esc(t.city) : ''}</div><div class="bf-h2">${esc(t.name)}</div><div class="bf-sm bf-mu">${plural(ps.length, 'real player')} · avg ${Math.round(avg(ps, (p) => p.ovr)) || '-'} OVR</div><div class="bf-faces">${ps.slice(0, 6).map((p) => bootAv(p, 's', t)).join('')}</div></div></button>`;
      }).join('');
      body = `<h2 class="bf-h">Pick your program</h2><p class="bf-mu bf-sm">Coach a real MFL team with its real players, or found a brand-new school and build it from scratch.</p><div class="bf-choice">${cards}
        <button class="bf-tcard ${W.mode === 'custom' ? 'bf-on' : ''}" style="--c1:#ffc21a" data-a="wzCustom"><span class="bf-sh bf-l" style="--c:#1d212c;--c2:#ffc21a"><b>+</b></span><div><div class="bf-k">Custom</div><div class="bf-h2">Found a new school</div><div class="bf-sm bf-mu">Your name, your colors. Start from scratch and bring along up to 3 MFL players.</div></div></button></div>`;
      can = !!W.mode;
    } else if (W.step === 1 && W.mode === 'real') {
      const t = wzTeam();
      const pv = realPreview(t.id);
      body = `<div class="bf-row" style="margin-bottom:10px">${sh(t, 'l')}<div><div class="bf-k">Your team</div><h2 class="bf-h">${esc(t.name)}</h2></div></div>
        ${card('Your MFL players', `<p class="bf-sm bf-mu" style="margin:0 0 8px">Positions are picked from each player's ratings. You can change them later.</p><div class="bf-plist">${pv.map(({ bp, pos, o, r }) => `<div class="bf-prow" style="cursor:default">${bootAv(bp, '', t)}<div style="min-width:0"><div class="bf-pn bf-trunc">${esc(bp.name)}</div><div class="bf-ps">${posTag(pos)}${bp.tag === 'C' ? '<span class="bf-chip bf-gold">Captain</span>' : ''}<span>${esc(keyRatings(pos, r))}</span></div></div>${ovrB(o)}</div>`).join('')}</div>`)}
        <div class="bf-note">${ic('info')}<div>The rest of the roster is filled with new players. ${esc((BOOT.teams.find((x) => x.id !== t.id) || {}).name || 'The other MFL team')} will be a CPU rival in your league, with all of its real players.</div></div>`;
    } else if (W.step === 1) {
      const c = W.custom, t = wzTeam();
      body = `<h2 class="bf-h">Found your school</h2>
        <div class="bf-row" style="margin:12px 0"><span id="bf-wz-prev">${sh(t, 'xl')}</span><div><div class="bf-k">Preview</div><div id="bf-wz-pn" style="font:800 22px/1.05 var(--disp);text-transform:uppercase">${esc(t.name)}</div></div></div>
        <div class="bf-in-f"><label for="bf-wz-name">School name</label><input id="bf-wz-name" class="bf-inp" maxlength="24" placeholder="Lakeside Lightning" value="${esc(c.name)}" autocomplete="off"></div>
        <div class="bf-in-f"><label for="bf-wz-abbr">Short name (2 to 4 letters)</label><input id="bf-wz-abbr" class="bf-inp" maxlength="4" placeholder="${esc(autoAbbr(c.name) || 'LKL')}" value="${esc(c.abbr)}" autocomplete="off" style="text-transform:uppercase;max-width:140px"></div>
        <div class="bf-in-f"><label>Colors</label><div class="bf-sw">${COLOR_PRESETS.map(([a, b], i) => `<button class="bf-swb ${c.color === a && c.color2 === b ? 'bf-on' : ''}" style="--a:${a};--b:${b}" data-a="wzPreset" data-i="${i}" aria-label="Color set ${i + 1}"></button>`).join('')}</div>
          <div class="bf-row bf-wrap" style="margin-top:8px"><span class="bf-colin">Main <input type="color" id="bf-wz-c1" value="${c.color}"></span><span class="bf-colin">Trim <input type="color" id="bf-wz-c2" value="${c.color2}"></span></div></div>
        ${card(`Bring MFL players (${W.picks.length}/3)`, `<p class="bf-sm bf-mu" style="margin:0 0 8px">Optional. Pick up to three real MFL kids to join your school. They leave their old team.</p><div class="bf-mflp">${BOOT.players.map((bp) => { const on = W.picks.includes(bp.id); const bt = BOOT.teams.find((x) => x.id === bp.team); return `<button class="bf-pick ${on ? 'bf-on' : ''}" data-a="wzPick" data-id="${esc(bp.id)}" aria-pressed="${on}"><span class="bf-ck">${ic('check')}</span>${bootAv(bp, 's', bt)}<span style="min-width:0"><span class="bf-sm bf-trunc" style="display:block;font-weight:700">${esc(bp.name)}</span><span class="bf-xs bf-mu">${esc(bt ? bt.abbr : '')} · ${bp.ovr} OVR</span></span></button>`; }).join('')}</div>`)}`;
      can = c.name.trim().length >= 2;
    } else if (W.step === 2) {
      const t = wzTeam();
      if (!W.nameTouched) W.name = `${t.name} Dynasty`;
      body = `<h2 class="bf-h">Coach & rules</h2>
        <div class="bf-in-f" style="margin-top:12px"><label for="bf-wz-coach">Your coach name</label><input id="bf-wz-coach" class="bf-inp" maxlength="24" placeholder="Your name" value="${esc(W.coach)}" autocomplete="off"></div>
        <div class="bf-in-f"><label for="bf-wz-fname">Franchise name</label><input id="bf-wz-fname" class="bf-inp" maxlength="32" value="${esc(W.name)}" autocomplete="off"></div>
        <div class="bf-k" style="margin:4px 0 6px">Difficulty (3D games)</div><div class="bf-opts" style="margin-bottom:14px">${DIFFS.map((d, i) => `<button class="bf-pick ${W.diff === i ? 'bf-on' : ''}" data-a="wzSet" data-k="diff" data-v="${i}" aria-pressed="${W.diff === i}"><span class="bf-ck">${ic('check')}</span><b>${d.name}</b><small>${esc(d.note)}</small></button>`).join('')}</div>
        <div class="bf-k" style="margin-bottom:6px">Quarter length</div><div class="bf-opts bf-three" style="margin-bottom:14px">${[2, 3, 4].map((q) => `<button class="bf-pick ${W.qmin === q ? 'bf-on' : ''}" data-a="wzSet" data-k="qmin" data-v="${q}" aria-pressed="${W.qmin === q}"><span class="bf-ck">${ic('check')}</span><b>${q} min</b><small>${q === 2 ? 'Quick' : q === 3 ? 'Longer' : 'Full'}</small></button>`).join('')}</div>
        <div class="bf-k" style="margin-bottom:6px">Playoffs</div><div class="bf-opts">${[4, 8].map((n) => `<button class="bf-pick ${W.po === n ? 'bf-on' : ''}" data-a="wzSet" data-k="po" data-v="${n}" aria-pressed="${W.po === n}"><span class="bf-ck">${ic('check')}</span><b>Top ${n}</b><small>${n === 4 ? 'Semifinals, then the ' + CHAMP : 'Quarterfinals, semis and the ' + CHAMP}</small></button>`).join('')}</div>`;
      can = true;
    } else {
      const t = wzTeam();
      const picks = W.picks.map((id) => BOOT.players.find((p) => p.id === id)).filter(Boolean);
      body = `<h2 class="bf-h">Ready to kick off?</h2>
        <section class="bf-banner" style="--c1:${t.color};--c2:${t.color2};margin-top:12px"><div style="display:flex;justify-content:center">${sh(t, 'xl')}</div><h3 class="bf-h" style="margin-top:10px">${esc(t.name)}</h3><div class="bf-sm bf-mu">${esc(cleanCoach(W.coach))} · ${esc(W.name)}</div></section>
        <div class="bf-kv"><div><span>Difficulty</span><b style="font-size:16px">${DIFFS[W.diff].name}</b></div><div><span>Quarters</span><b>${W.qmin} min</b></div><div><span>Playoffs</span><b>Top ${W.po}</b></div></div>
        ${picks.length ? `<div class="bf-sm bf-mu">Bringing: ${picks.map((p) => esc(p.name)).join(', ')}</div>` : ''}
        <div class="bf-note">${ic('info')}<div>A 12-team league in two divisions, 11 weeks, then the playoffs. Every season ends with the ${CHAMP}. Your franchise saves automatically.</div></div>`;
      nextLbl = 'Kick off Season 1';
    }
    return `<div class="bf-col ${UI.anim ? 'bf-in' : ''}">${head}${body}<button class="bf-btn bf-pri bf-big bf-block" data-a="${W.step === 3 ? 'wzCreate' : 'wzNext'}" ${can ? '' : 'disabled'}>${nextLbl} ${ic('right')}</button></div>`;
  }
  function wzPaintPreview() {
    const t = wzTeam(), p = document.getElementById('bf-wz-prev'), n = document.getElementById('bf-wz-pn');
    if (p) p.innerHTML = sh(t, 'xl');
    if (n) n.textContent = t.name;
    const a = document.getElementById('bf-wz-abbr'); if (a && !W.custom.abbrTouched) a.placeholder = autoAbbr(W.custom.name) || 'LKL';
    const btn = ROOT.querySelector('[data-a="wzNext"]'); if (btn) btn.disabled = W.custom.name.trim().length < 2;
  }

  // ---------- render ----------
  function errorCard(e) { return `<div class="bf-note bf-err">${ic('info')}<div>Something went wrong on this screen. Your save is safe.<div class="bf-xs" style="margin-top:4px;opacity:.8">${esc(e && e.message)}</div><div style="margin-top:8px"><button class="bf-btn bf-sm" data-a="tab" data-tab="hub">Back to the Hub</button></div></div></div>`; }
  function viewApp() {
    const v = { hub: viewHub, sched: viewSchedule, roster: viewRoster, stand: viewStandings, league: viewLeague, prog: viewProgram, hist: viewHistory }[UI.tab] || viewHub;
    let main;
    try { main = v(); } catch (e) { console.error('[franchise]', e); main = errorCard(e); }
    return `<div class="bf-app">${topBar()}${tabBar()}<main class="bf-main ${UI.anim ? 'bf-in' : ''}" id="bf-main">${main}</main></div>`;
  }
  function render() {
    const app = document.getElementById('bf-app');
    if (!app) return;
    let html;
    try {
      if (UI.screen === 'wizard' && W) html = viewWizard();
      else if (!S || UI.screen === 'slots') html = viewSlots();
      else if (UI.screen === 'pregame') html = viewPregame();
      else if (UI.screen === 'engine') html = viewEngine();
      else if (UI.screen === 'postgame') html = viewPostgame();
      else { UI.screen = 'app'; html = viewApp(); }
    } catch (e) { console.error('[franchise]', e); html = errorCard(e); }
    document.body.classList.toggle('bf-navpad', !!S && UI.screen === 'app');
    if (UI.screen === 'engine' && document.getElementById('bf-engine-mount')) return; // never wipe a running game
    app.innerHTML = html;
    UI.anim = false;
    if (UI.screen === 'postgame' && UI.trophy && !document.querySelector('.bf-trophy')) showTrophy();
  }
  function rerender() { render(); if (UI.sheet) renderSheet(); }
  function scrollTop() {
    try {
      const hdr = parseFloat(getComputedStyle(ROOT).getPropertyValue('--hdr')) || 60;
      const r = ROOT.getBoundingClientRect();
      if (r.top < hdr || r.top > innerHeight * 0.4) window.scrollTo(0, Math.max(0, window.scrollY + r.top - hdr - 10));
    } catch (e) {}
  }
  function go(tab) { UI.tab = tab; UI.screen = 'app'; UI.week = null; UI.anim = true; closeSheet(); render(); scrollTop(); }

  // ---------- actions ----------
  const findRecruit = (id) => (S.off && [...(S.off.pool || []), ...(S.off.fa || [])].find((r) => r.id === id)) || null;
  const SUBS = ['sched', 'roster', 'stand', 'league', 'hist'];
  const ACT = {
    tab: (b) => go(b.dataset.tab),
    sub(b) {
      const k = b.dataset.k, v = b.dataset.v, tabChange = b.dataset.tab && b.dataset.tab !== UI.tab;
      if (b.dataset.tab) { UI.tab = b.dataset.tab; UI.screen = 'app'; }
      if (SUBS.includes(k)) { UI.sub[k] = v; UI.week = null; } else UI.filter[k] = v;
      if (UI.sheet) closeSheet();
      UI.anim = !!tabChange; render(); if (tabChange) scrollTop();
    },
    menu: () => openSheet('menu'),
    retrySave: () => Saver.retry(),
    player: (b) => openSheet('player', { id: b.dataset.id }),
    team: (b) => openSheet('team', { id: b.dataset.id }),
    box: (b) => openSheet('box', { id: b.dataset.id }),
    matchup: (b) => openSheet('matchup', { id: b.dataset.id }),
    close: () => closeSheet(),
    pregame() { if (!userGameNow()) return; closeSheet(); UI.screen = 'pregame'; UI.anim = true; render(); scrollTop(); },
    play() { closeSheet(); playEngine(); },
    simGame() { closeSheet(); simUserGame(); },
    closeFlow() { UI.screen = 'app'; UI.anim = true; render(); },
    postDone() { hideTrophy(); UI.post = null; UI.screen = 'app'; UI.tab = 'hub'; UI.anim = true; render(); scrollTop(); },
    trophy: () => showTrophy(),
    trophyClose: () => hideTrophy(),
    simToEnd() {
      const left = S.sched.length - S.week;
      confirmBox('Sim to the playoffs?', `This sims your last ${plural(left, 'game')} of the regular season using your current depth chart and practice plan.`, 'Sim the rest', () => {
        let guard = 0, w = 0, l = 0;
        while (S.phase === 'regular' && guard++ < 20) { const rep = playWeek(null); if (rep.game) { S.last = rep.game.g.id; if (rep.game.r === 'W') w++; else if (rep.game.r === 'L') l++; } }
        Saver.mark(); UI.anim = true; render(); scrollTop();
        toast(`Went ${w}-${l} the rest of the way. ${S.po && S.po.seeds.includes(S.user) ? 'Playoffs, here we come!' : 'Missed the playoffs.'}`);
      });
    },
    simRound() {
      if (S.phase !== 'playoffs' || userGameNow()) return;
      const rep = playRound(null);
      Saver.mark(); UI.anim = true; render();
      if (rep.champ) toast(`${TM(rep.champ).name} win the ${CHAMP}!`);
    },
    weekSel(b) { UI.week = b.dataset.w === 'P' ? 'P' : +b.dataset.w; render(); },
    depthMv(b) {
      const t = userTeam(), pos = b.dataset.pos, i = +b.dataset.i, d = +b.dataset.d, a = t.depth[pos];
      if (!a || i + d < 0 || i + d >= a.length) return;
      [a[i], a[i + d]] = [a[i + d], a[i]];
      t.auto = false; Saver.mark(); render();
    },
    autoDepth() { const t = userTeam(); t.auto = t.auto === false; if (t.auto) fixDepth(t, true); Saver.mark(); render(); toast(t.auto ? 'Auto depth chart on' : 'Custom depth chart'); },
    makeStarter(b) { const p = PL(b.dataset.id), t = userTeam(); if (!p || p.t !== S.user) return; const a = t.depth[p.pos].filter((x) => x !== p.id); a.unshift(p.id); t.depth[p.pos] = a; t.auto = false; Saver.mark(); rerender(); toast(`${p.n} is a starter now`); },
    focus(b) { if (!FOCUS[b.dataset.v]) return; S.train.f = b.dataset.v; Saver.mark(); render(); },
    intensity(b) { S.train.i = clamp(+b.dataset.v | 0, 0, 2); Saver.mark(); render(); },
    upgrade(b) {
      const k = b.dataset.k, l = S.fac[k], cost = FAC_COST[l + 1];
      if (!FAC[k] || l >= 5 || S.pts < cost) return;
      S.pts -= cost; S.fac[k] = l + 1;
      news(`${userTeam().name} upgraded the ${FAC[k].n} to level ${l + 1}.`, 'off', S.user);
      Saver.mark(); render(); toast(`${FAC[k].n} is now level ${l + 1}!`);
    },
    hire(b) {
      const k = b.dataset.k, c = S.hire && S.hire[k] && S.hire[k][+b.dataset.i];
      if (!c || S.pts < STAFF_COST[c.s]) return;
      S.pts -= STAFF_COST[c.s]; S.staff[k] = { n: c.n, s: c.s }; S.hire[k] = S.hire[k].filter((x) => x !== c && x.s > c.s);
      news(`${userTeam().name} hired ${c.n} as ${STAFF[k].n}.`, 'off', S.user);
      Saver.mark(); render(); toast(`Welcome aboard, ${c.n}!`);
    },
    offNext() {
      if (S.phase !== 'offseason') return;
      const was = S.off.step;
      advanceOffseason();
      if (was === 'ready') { UI.tab = 'hub'; toast(`Season ${S.season} is here!`); }
      Saver.mark(); UI.anim = true; render(); scrollTop();
    },
    signDay() {
      const n = offersOut();
      confirmBox('Go to Signing Day?', n ? `You have ${plural(n, 'offer')} out. Recruits will choose between every school that offered them. This is final.` : 'You have not offered anyone. Walk-ons will fill any open spots. Go anyway?', 'Signing Day!', () => { advanceOffseason(); Saver.mark(); UI.anim = true; render(); scrollTop(); });
    },
    scout(b) {
      const rc = findRecruit(b.dataset.id); if (!rc || rc.sc >= 2) return;
      if (S.off.scouts > 0) S.off.scouts--; else if (S.pts >= 10) S.pts -= 10; else return toast('You need 10 points to scout.');
      rc.sc++; Saver.mark(); render();
    },
    offer(b) {
      const rc = findRecruit(b.dataset.id); if (!rc || rc.of) return;
      if (offersOut() >= maxOffers()) return toast(`You can have ${maxOffers()} offers out (open spots + 2).`);
      const cost = OFFER_COST[rc.st];
      if (S.pts < cost) return toast(`You need ${cost} points to offer a ${rc.st}-star recruit.`);
      S.pts -= cost; rc.of = 1; Saver.mark(); render();
    },
    unoffer(b) { const rc = findRecruit(b.dataset.id); if (!rc || !rc.of) return; S.pts += OFFER_COST[rc.st]; rc.of = 0; Saver.mark(); render(); },
    visit(b) { const rc = findRecruit(b.dataset.id); if (!rc || rc.vis || !rc.of) return; if (S.pts < 10) return toast('You need 10 points for a visit.'); S.pts -= 10; rc.vis = 1; Saver.mark(); render(); toast(`${rc.n} loved the visit!`); },
    signFA(b) {
      const rc = findRecruit(b.dataset.id); if (!rc || rc.to) return;
      if (openSpots() <= 0) return toast('Your roster is full.');
      if (S.pts < rc.cost) return toast(`You need ${rc.cost} points.`);
      S.pts -= rc.cost; rc.to = S.user;
      recruitToPlayer(rc, S.user, rngFrom(S.seed + rc.id)).rk = S.season + 1;
      fixDepth(userTeam());
      news(`${rc.n} moved to town and joined ${userTeam().name}.`, 'off', S.user);
      Saver.mark(); render(); toast(`${rc.n} joined the team!`);
    },
    settings: () => openSheet('settings'),
    setDiff(b) { S.diff = clamp(+b.dataset.v | 0, 0, 3); Saver.mark(); rerender(); },
    setQ(b) { const q = +b.dataset.v; if ([2, 3, 4].includes(q)) S.qmin = q; Saver.mark(); rerender(); },
    rename() { UI.renameSlot = null; openSheet('rename', { name: S.name }); },
    async renameSave() {
      const inp = document.getElementById('bf-rn'); const v = inp ? inp.value.trim().slice(0, 32) : '';
      if (!v) return toast('Type a name first.');
      if (UI.renameSlot) {
        const slot = UI.renameSlot; UI.renameSlot = null; closeSheet();
        try { const x = await Store.load(slot); const d = validate(migrate(x.data)); d.name = v; const keep = S; S = d; invalidate(); const meta = metaOf(); S = keep; invalidate(); await Store.save(slot, d, meta); toast('Renamed!'); } catch (e) { toast((e && e.message) || 'Could not rename.'); }
        UI.slots = await Store.list().catch(() => UI.slots); render(); return;
      }
      S.name = v; Saver.mark(); closeSheet(); render(); toast('Renamed!');
    },
    help: () => openSheet('help'),
    exitSlots() { closeSheet(); showSlots(); },
    restart() { confirmBox('Restart this franchise?', 'Same team, coach and settings, but everything else starts over at Season 1: records, players, history. This cannot be undone.', 'Restart', () => restartFranchise(), true); },
    confirmYes() { const fn = UI.confirmFn; UI.confirmFn = null; closeSheet(); if (fn) fn(); },
    quitLoss() {
      closeSheet();
      const g = userGameNow(); if (!g || !UI.quitRes) return;
      const ctx = gameCtx(g), res = fromEngine(ctx, UI.quitRes);
      res.fw = ctx.oppId; res.quit = true; UI.quitRes = null;
      finishUserGame(ctx, res);
    },
    quitReplay() { closeSheet(); UI.quitRes = null; playEngine(); },
    quitSim() { closeSheet(); UI.quitRes = null; simUserGame(); },
    reloadSlots: () => showSlots(),
    slotNew: (b) => startWizard(b.dataset.slot),
    slotOpen: (b) => openSlot(b.dataset.slot),
    slotRename(b) { const s = (UI.slots || []).find((x) => x.slot === b.dataset.slot); UI.renameSlot = b.dataset.slot; openSheet('rename', { name: (s && s.meta && s.meta.name) || '' }); },
    slotRestart(b) {
      const slot = b.dataset.slot;
      confirmBox('Restart this franchise?', 'Same team, coach and settings, but everything starts over at Season 1. This cannot be undone.', 'Restart', async () => {
        try { const x = await Store.load(slot); loadState(x.data); Saver.slot = slot; restartFranchise(); } catch (e) { S = null; toast((e && e.message) || 'Could not restart.'); }
      }, true);
    },
    slotDelete(b) {
      const slot = b.dataset.slot;
      confirmBox(`Delete slot ${slot}?`, 'This franchise and all of its history will be gone for good.', 'Delete', async () => {
        try { await Store.remove(slot); toast('Deleted.'); } catch (e) { toast((e && e.message) || 'Could not delete.'); }
        showSlots();
      }, true);
    },
    wzBack() { if (!W) return; if (W.step === 0) { W = null; showSlots(); return; } W.step--; UI.anim = true; render(); scrollTop(); },
    wzNext() { if (!W) return; W.step = Math.min(3, W.step + 1); UI.anim = true; render(); scrollTop(); },
    wzReal(b) { W.mode = 'real'; W.realId = b.dataset.id; W.picks = []; render(); },
    wzCustom() { W.mode = 'custom'; render(); },
    wzPreset(b) { const p = COLOR_PRESETS[+b.dataset.i]; if (!p) return; W.custom.color = p[0]; W.custom.color2 = p[1]; render(); },
    wzPick(b) { const id = b.dataset.id, i = W.picks.indexOf(id); if (i >= 0) W.picks.splice(i, 1); else if (W.picks.length < 3) W.picks.push(id); else return toast('You can bring up to 3 MFL players.'); render(); },
    wzSet(b) { const k = b.dataset.k, v = +b.dataset.v; if (k === 'diff') W.diff = clamp(v, 0, 3); if (k === 'qmin' && [2, 3, 4].includes(v)) W.qmin = v; if (k === 'po') W.po = v === 8 ? 8 : 4; render(); },
    wzCreate() {
      if (!W) return;
      const t = wzTeam();
      const cfg = { mode: W.mode, realId: W.realId, custom: W.mode === 'custom' ? { name: t.name, abbr: t.abbr, color: t.color, color2: t.color2 } : null, picks: W.mode === 'custom' ? W.picks.slice() : [], coach: cleanCoach(W.coach), diff: W.diff, qmin: W.qmin, po: W.po, name: (W.name || '').trim().slice(0, 32) || `${t.name} Dynasty`, seed: W.seed };
      try { createLeague(cfg); } catch (e) { console.error('[franchise]', e); S = null; return toast('Could not create the franchise. Try again.'); }
      Saver.slot = W.slot; W = null;
      Object.assign(UI, { screen: 'app', tab: 'hub', sub: {}, filter: {}, week: null, post: null, attempt: {}, anim: true });
      Saver.mark(); render(); scrollTop();
      openSheet('help');
    },
  };
  function onClick(e) {
    const ov = e.target.classList && e.target.classList.contains('bf-ov') ? e.target : null;
    if (ov) { if (ov.dataset.ov !== 'keep') closeSheet(); return; }
    const b = e.target.closest && e.target.closest('[data-a]');
    if (!b || !ROOT.contains(b) || b.disabled) return;
    const fn = ACT[b.dataset.a];
    if (!fn) return;
    e.preventDefault();
    try { const r = fn(b, e); if (r && typeof r.catch === 'function') r.catch((err) => { console.error('[franchise]', err); toast('Something went wrong. Your last save is safe.'); }); } catch (err) { console.error('[franchise]', err); toast('Something went wrong. Your last save is safe.'); }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset && el.dataset.ch === 'pos' && S) {
      const p = PL(el.dataset.id); if (!p || p.t !== S.user || !POS.includes(el.value)) return;
      p.pos = el.value; fixDepth(userTeam()); Saver.mark(); rerender(); toast(`${p.n} now plays ${POS_NAME[p.pos]}`);
      return;
    }
    if (!W) return;
    if (el.id === 'bf-wz-c1' && hexOk(el.value)) { W.custom.color = el.value; render(); }
    if (el.id === 'bf-wz-c2' && hexOk(el.value)) { W.custom.color2 = el.value; render(); }
  }
  function onInput(e) {
    const el = e.target;
    if (!W) return;
    if (el.id === 'bf-wz-name') { W.custom.name = el.value.slice(0, 24); wzPaintPreview(); }
    else if (el.id === 'bf-wz-abbr') { W.custom.abbr = el.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4); W.custom.abbrTouched = !!W.custom.abbr; if (el.value !== W.custom.abbr) el.value = W.custom.abbr; wzPaintPreview(); }
    else if (el.id === 'bf-wz-c1' && hexOk(el.value)) { W.custom.color = el.value; wzPaintPreview(); }
    else if (el.id === 'bf-wz-c2' && hexOk(el.value)) { W.custom.color2 = el.value; wzPaintPreview(); }
    else if (el.id === 'bf-wz-coach') W.coach = el.value.slice(0, 24);
    else if (el.id === 'bf-wz-fname') { W.name = el.value.slice(0, 32); W.nameTouched = true; }
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.bf-trophy')) { hideTrophy(); return; }
    if (UI.sheet && UI.sheet.kind !== 'quit') closeSheet();
    if (e.target && e.target.id === 'bf-rn' && e.key === 'Enter') ACT.renameSave();
  }

  // ---------- boot ----------
  function boot() {
    injectCSS();
    ROOT.innerHTML = '<div id="bf-app"></div><div id="bf-layer"></div><div id="bf-fx"></div><div id="bf-toast" aria-live="polite"></div>';
    try { const hdr = document.querySelector('.hdr'); if (hdr && getComputedStyle(hdr).position === 'sticky') ROOT.style.setProperty('--hdr', hdr.offsetHeight + 'px'); else ROOT.style.setProperty('--hdr', '0px'); } catch (e) {}
    ROOT.addEventListener('click', onClick);
    ROOT.addEventListener('change', onChange);
    ROOT.addEventListener('input', onInput);
    ROOT.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'bf-rn') { e.preventDefault(); ACT.renameSave(); } });
    ROOT.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList.contains('bf-av')) t.remove(); }, true);
    document.addEventListener('keydown', onKey);
    if (window.__bfDebug) window.__bf = { get S() { return S; }, UI, Saver, playWeek, playRound, advanceOffseason, interestFor, render, rerender, size: () => JSON.stringify(S).length, seasonAwards, simGame, userGameNow, engineTeam, engineOpts, gameCtx, sortTeams, seedList };
    showSlots();
  }
  boot();
})();
