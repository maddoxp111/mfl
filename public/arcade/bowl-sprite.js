// Player appearance previews for the admin editor.
(function () {
  const SKIN = ['#f1c7a1', '#d9a17a', '#a8714a', '#7a4e2d', '#5a3a22'];

  // ---------- 5x7 pixel font ----------
  // ---------- sprites (original design): tall lanky helmet guys with a dark outline ----------
  // Letters: H helmet, W helmet stripe, F facemask, S skin, A arm, J jersey, D shoulder trim, N number, P pants, K socks, B cleats.
  const shade = (hex, f) => { const n = parseInt(String(hex || '#888').slice(1, 7), 16) || 0x888888; const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const light = (hex) => { const n = parseInt(String(hex || '#888').slice(1, 7), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 150; };
  const BODY = [
    '..HHHH..', '.HHWWHH.', '.HHWHHFF', '.HHHHSF.', '..HSSS..', '...SS...',
    '.DJJJJD.', 'AJJNNJJA', 'AJJNNJJA', '.JJJJJJ.', '..JJJJ..', '..PPPP..', '..PPPP..',
  ];
  // Thin legs that stay close together; a small stride when running.
  const LEGS = [
    ['...PP...', '...PP...', '...P.P..', '...K.K..', '...K.K..', '...K.K..', '..BB.BB.'],
    ['...PP...', '...P.P..', '..P..P..', '..K...K.', '..K...K.', '.K....K.', '.BB...BB'],
    ['...PP...', '...PP...', '...PP...', '...KK...', '...KK...', '...KK...', '...BBB..'],
    ['...PP...', '..P.P...', '..P..P..', '.K...K..', '.K...K..', '.K....K.', 'BB....BB'],
  ];
  // Throwing pose: arm cocked back over the helmet.
  const THROW = ['A.HHHH..', 'AHHWWHH.', 'AHHWHHFF', 'AHHHHSF.', 'J.HSSS..', 'J..SS...', 'JDJJJJD.', '.JJNNJJA', '.JJNNJJA', '.JJJJJJ.', '..JJJJ..', '..PPPP..', '..PPPP..'];
  const CLEATS = { black: '#151515', white: '#f2f2f2', team: null, gold: '#e8b400', red: '#d62828' };
  const spriteCache = new Map();
  // look = { skin: 0-4, height: 'short'|'normal'|'tall', visor: bool, sleeves: bool, cleats: key of CLEATS }.
  // Offense wears its colors; the defense wears white jerseys with colored trim.
  function buildSprite(team, look, frame, flip, def) {
    look = look || {};
    const key = [team.color, team.color2, look.skin, look.height, look.visor, look.sleeves, look.cleats, frame, flip, def].join('|');
    if (spriteCache.has(key)) return spriteCache.get(key);
    let legs = [...LEGS[frame === 9 ? 0 : frame]];
    if (look.height === 'tall') legs = [legs[0], legs[1], legs[1], legs[2], legs[3], legs[4], legs[4], legs[5], legs[6]];
    if (look.height === 'short') legs = [legs[0], legs[2], legs[3], legs[5], legs[6]];
    const rows = [...(frame === 9 ? THROW : BODY), ...legs];
    const col = team.color || '#888', col2 = team.color2 || '#fff', skin = SKIN[Math.max(0, Math.min(4, look.skin | 0))];
    const jersey = def ? '#f1f1f1' : col;
    const pal = def
      ? { H: col, W: light(col) ? shade(col, 0.6) : '#ffffff', F: '#c9ccd3', S: skin, J: jersey, D: col, N: col, P: '#e8e8e8', K: col, B: '#151515' }
      : { H: col, W: light(col) ? shade(col, 0.6) : '#ffffff', F: '#c9ccd3', S: skin, J: jersey, D: light(col2) ? col2 : '#ffffff', N: light(col) ? shade(col, 0.55) : '#ffffff', P: light(col2) ? col2 : '#e8e8e8', K: col, B: '#151515' };
    pal.A = look.sleeves ? jersey : skin;
    if (look.visor) pal.F = '#1b1d2b';
    if (look.cleats && look.cleats in CLEATS) pal.B = CLEATS[look.cleats] || col;
    const W2 = 8, H2 = rows.length, c = document.createElement('canvas'); c.width = W2 + 2; c.height = H2 + 2;
    const x = c.getContext('2d');
    const at = (i, j) => (rows[j] ? rows[j][flip ? W2 - 1 - i : i] : undefined);
    const filled = (i, j) => { const v = at(i, j); return v && v !== '.'; };
    for (let j = -1; j <= H2; j++) for (let i = -1; i <= W2; i++) {
      if (filled(i, j)) { x.fillStyle = pal[at(i, j)]; x.fillRect(i + 1, j + 1, 1, 1); }
      else if (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1)) { x.fillStyle = '#0a0a0d'; x.fillRect(i + 1, j + 1, 1, 1); }
    }
    x.fillStyle = def ? '#ffd400' : '#ff3b3b'; x.fillRect(flip ? W2 - 1 : 2, 13, 1, 3); // flag-football flags
    spriteCache.set(key, c);
    return c;
  }
  window.MFLBowlSprite = buildSprite;

})();
