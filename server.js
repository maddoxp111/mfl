const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { load, save, refresh, putMedia, getMedia, slug, putDoc, getDoc, listDocs, deleteDoc, exportAll, importAll } = require('./db');
const pk = require('./pickem');
const ai = require('./ai');
const cards = require('./cards');
const sv = require('./survivor');
const badges = require('./badges');

const app = express();
const PORT = process.env.PORT || 3000;
// Admin password: the ADMIN_PASSWORD variable if set; otherwise it's created on the
// first visit to /admin/login and kept (hashed) in the data folder with a random
// cookie-signing secret, so nothing secret has to live in this public repo.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const AUTH_FILE = path.join(require('./db').DATA_DIR, 'admin.json');
const adminAuth = (() => {
  if (ADMIN_PASSWORD) return {};
  let a = {};
  try { a = JSON.parse(require('fs').readFileSync(AUTH_FILE, 'utf8')); } catch {}
  if (!a.secret) {
    a.secret = crypto.randomBytes(32).toString('hex');
    require('fs').mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    require('fs').writeFileSync(AUTH_FILE, JSON.stringify(a));
  }
  return a;
})();
const SECRET = process.env.SESSION_SECRET || (ADMIN_PASSWORD ? crypto.createHash('sha256').update('mfl:' + ADMIN_PASSWORD).digest('hex') : adminAuth.secret);
const adminPasswordSet = () => !!(ADMIN_PASSWORD || adminAuth.hash);
function adminPasswordOk(p) {
  if (ADMIN_PASSWORD) return p.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(ADMIN_PASSWORD));
  return !!adminAuth.hash && pk.checkPin(adminAuth, p);
}
const TZ = process.env.TZ_LEAGUE || 'America/Chicago';
const VENUE = 'Thomas Metcalf School';

// GitHub Pages bridge: the github.io copy loads every page live from this server.
// Browsers there can't share our cookies, so the bridge sends them in X-MFL-Auth
// and gets new ones back in X-MFL-Set; redirects come back as X-MFL-Redirect.
const BRIDGE_ORIGINS = ['https://maddoxp111.github.io', ...(process.env.BRIDGE_ORIGINS || '').split(',').filter(Boolean)];
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!BRIDGE_ORIGINS.includes(origin)) return next();
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type, X-MFL-Bridge, X-MFL-Auth, X-MFL-Path',
    'Access-Control-Expose-Headers': 'X-MFL-Set, X-MFL-Redirect',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!req.get('X-MFL-Bridge')) return next();
  req.headers.cookie = req.get('X-MFL-Auth') || '';
  const here = req.get('X-MFL-Path');
  req.headers.referer = here && here.startsWith('/') ? `${req.protocol}://${req.get('host')}${here}` : '';
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) => {
    if (String(name).toLowerCase() === 'set-cookie') {
      const list = [].concat(value).map((c) => String(c).split(';')[0]);
      setHeader('X-MFL-Set', JSON.stringify(list));
    }
    return setHeader(name, value);
  };
  res.redirect = (a, b) => { const url = typeof a === 'number' ? b : a; res.set('X-MFL-Redirect', url).status(200).end(); };
  next();
});
// Gzip pages (they're mostly repeated markup, so they shrink ~10x).
app.use((req, res, next) => {
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const send = res.send.bind(res);
  res.send = (body) => {
    if (typeof body !== 'string' || body.length < 2048 || res.get('Content-Encoding')) return send(body);
    if (!res.get('Content-Type')) res.type('html');
    res.set({ 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    return send(require('zlib').gzipSync(body, { level: 6 }));
  };
  next();
});
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
const smallJson = express.json({ limit: '100kb' });
app.use((req, res, next) => (req.path === '/admin/restore' ? next() : smallJson(req, res, next)));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
// Player photos, served from storage (keys are unique per upload, so cache hard).
app.get('/media/logo/:file', (req, res) => {
  const m = /^([a-z0-9-]+)-([0-9a-f]{10})\.[a-z+]+$/.exec(req.params.file);
  const t = m && load()?.teams?.[m[1]];
  const L = t && logoFile(t);
  if (!L) return res.status(404).end();
  res.set({ 'Content-Type': L.type, 'Cache-Control': `public, max-age=${L.hash === m[2] ? 31536000 : 300}, immutable` }).send(L.buf);
});
app.get('/media/:key', async (req, res, next) => {
  try {
    if (!/^[a-z0-9-]+\.jpg$/.test(req.params.key)) return res.status(404).end();
    const buf = await getMedia(req.params.key);
    if (!buf) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable' }).send(buf);
  } catch (e) { next(e); }
});
app.use(async (req, res, next) => {
  try { await refresh({ fresh: req.method === 'POST' }); next(); } catch (e) { next(e); }
});
// Rolling sessions: anyone who keeps using the site stays signed in. Cookies are
// signed with SESSION_SECRET, so redeploys and password changes don't sign anyone out.
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/static') && !req.path.startsWith('/media')) {
    const c = readCookies(req);
    const left = (v) => Number(String(v || '').split('.')[v && v.split('.').length === 3 ? 1 : 0]) - Date.now();
    const name = currentUser(req);
    if (name && left(c[USER_COOKIE]) < (SESSION_DAYS - 7) * DAY) setUserCookie(req, res, name);
    if (isAdmin(req) && left(c.mfl_admin) < (SESSION_DAYS - 7) * DAY) setAdminCookie(req, res);
  }
  next();
});

// Any admin change can affect ratings and recaps: let the AI analyst catch up.
app.use('/admin', (req, res, next) => {
  if (req.method === 'POST' && !req.path.startsWith('/ai')) res.on('finish', () => scheduleAI());
  next();
});

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dp(ds) {
  if (!ds) return null;
  const d = new Date(ds + 'T12:00:00Z');
  return { dow: DOW[d.getUTCDay()], dowl: DOWL[d.getUTCDay()], mon: MONTHS[d.getUTCMonth()].slice(0, 3), month: MONTHS[d.getUTCMonth()], day: d.getUTCDate(), year: d.getUTCFullYear() };
}
const shortDate = (ds) => { const p = dp(ds); return p ? `${p.dow}, ${p.mon} ${p.day}` : 'TBD'; };
const longDate = (ds) => { const p = dp(ds); return p ? `${p.dowl}, ${p.month} ${p.day}, ${p.year}` : 'Date TBD'; };
const time12 = (t) => { if (!t) return 'TBD'; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
function addDays(ds, n) { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

const bowlName = (db, slug) => db.bowls.find((b) => b.slug === slug)?.name || '';
const teamFull = (t) => `${t.city} ${t.name}`.trim();
const initials = (n) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function readableOn(hex) {
  const n = parseInt((hex || '#000000').slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#0b0b0f' : '#ffffff';
}
// Logos are stored as data URLs but served as their own cached image files, so a
// page that shows a logo 40 times doesn't carry 40 copies of it.
const logoCache = new Map(); // team id -> { src, hash, type, buf }
function logoFile(t) {
  let L = logoCache.get(t.id);
  if (!L || L.src !== t.logo) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(t.logo || '');
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    L = { src: t.logo, type: m[1], ext: { 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[m[1]] || m[1].slice(6), buf, hash: require('crypto').createHash('sha1').update(buf).digest('hex').slice(0, 10) };
    logoCache.set(t.id, L);
  }
  return L;
}
function logo(t, size = 40, cls = '') {
  const L = t.logo && logoFile(t);
  if (L) return `<img class="logo ${cls}" src="/media/logo/${esc(t.id)}-${L.hash}.${L.ext}" alt="${esc(t.name)}" style="width:${size}px;height:${size}px" decoding="async">`;
  return `<span class="logo mono ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.32)}px;background:${esc(t.color)};color:${readableOn(t.color)}">${esc(t.abbr)}</span>`;
}
const TAG_NAMES = { C: 'Captain', TR: 'Team Rep', FA: 'Free Agent' };
const tagName = (tag) => TAG_NAMES[tag] || (tag?.startsWith('Rd') ? 'Draft · ' + tag.replace('Rd', 'Round') : tag || '');
const playerUrl = (tm, p) => `/players/${tm.id}/${p.id}`;
const findPlayerByName = (tm, name) => tm?.roster.find((p) => p.name.toLowerCase() === String(name || '').toLowerCase());
function avatar(tm, p, size = 42, cls = '') {
  const st = `width:${size}px;height:${size}px`;
  if (p?.photo) return `<img class="av photo ${cls}" src="/media/${esc(p.photo)}" alt="${esc(p.name)}" style="${st}" loading="lazy">`;
  return `<span class="av ${cls}" style="${st};font-size:${Math.round(size * 0.34)}px;background:${esc(tm.color)};color:${readableOn(tm.color)}">${initials(p?.name || '?')}</span>`;
}
// Player name as a link to their page when they're on the roster.
function playerLink(tm, name, withAvatar = false) {
  const p = findPlayerByName(tm, name);
  const inner = `${withAvatar ? avatar(tm, p || { name }, 30) : ''}${esc(name)}`;
  return p ? `<a class="plink" href="${playerUrl(tm, p)}">${inner}</a>` : `<span class="plink">${inner}</span>`;
}
// Box-score plays besides touchdowns and interceptions. `by` is an optional second
// player: on the same team (the thrower of a catch) or the other team (the QB sacked).
const STATS = {
  CATCH: { key: 'catch', label: 'Notable catch', short: 'Catches', tag: 'catch', who: 'Who caught it?', by: 'Thrown by (optional)', side: 'same', verb: 'makes a highlight catch', from: 'from' },
  SACK: { key: 'sack', label: 'Sack', short: 'Sacks', tag: 'sack', who: 'Who got the sack?', by: 'QB sacked (optional)', side: 'other', verb: 'sacks', from: '' },
  PBU: { key: 'pbu', label: 'Pass breakup', short: 'PBUs', tag: 'pbu', who: 'Who broke it up?', by: 'Thrown by (optional)', side: 'other', verb: 'breaks up a pass', from: 'from' },
  FLAG: { key: 'flag', label: 'Flag pull', short: 'Flag pulls', tag: 'flag', who: 'Who pulled the flag?', by: null, verb: 'pulls a flag' },
  PEN: { key: 'pen', label: 'Penalty', short: 'Penalties', tag: 'pen', who: 'Who got flagged?', by: null, verb: 'is flagged' },
  PLAY: { key: 'big', label: 'Notable play', short: 'Big plays', tag: 'play', who: 'Who made the play?', by: null, verb: 'makes a notable play' },
};
const EV_TYPES = ['TD', 'INT', ...Object.keys(STATS)];
// Penalty flags a play can carry (type PEN, kind in e.pen).
const PENALTIES = { PI: 'Pass interference', HOLD: 'Holding', GUARD: 'Flag guarding', CONTACT: 'Illegal contact', RUSH: 'Early rush (before 7 bananas)', OFF: 'Offsides', FS: 'False start', FWD: 'Illegal forward pass', DELAY: 'Delay of game', ROUGH: 'Roughing the passer', UNS: 'Unsportsmanlike conduct', OTHER: 'Other' };
const penName = (k) => PENALTIES[k] || 'a penalty';
const otherTeam = (g, id) => (g.home === id ? g.away : g.home);
// One play as a sentence: "Liam Bair catches a TD pass from Maddox Pedon · note".
function playLine(db, g, e) {
  const tm = db.teams[e.team], opp = db.teams[otherTeam(g, e.team)];
  const who = `<b>${e.player ? playerLink(tm, e.player) : 'Unknown'}</b>`;
  let txt;
  if (e.type === 'TD') txt = e.passer ? ` catches a TD pass from <b>${playerLink(tm, e.passer)}</b>` : ' scores a touchdown';
  else if (e.type === 'INT') txt = e.passer ? ` picks off <b>${playerLink(opp, e.passer)}</b>` : ' picks it off';
  else if (e.type === 'PLAY' && e.note) return `${who} <span class="play-what">${esc(e.note)}</span>`;
  else if (e.type === 'PEN') return `${e.player ? who : `<b>${esc(tm.name)}</b>`} flagged for <b>${esc(penName(e.pen))}</b>${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}`;
  else {
    const st = STATS[e.type];
    const by = e.passer ? (st.side === 'same' ? tm : opp) : null;
    txt = ` ${st.verb}${by ? `${st.from ? ' ' + st.from : ''} <b>${playerLink(by, e.passer)}</b>` : ''}`;
  }
  return `${who}${txt}${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}`;
}
const playTag = (e) => (e.type === 'TD' ? ['td', 'Touchdown'] : e.type === 'INT' ? ['int', 'Interception'] : e.type === 'PEN' && PENALTIES[e.pen] ? ['pen', `Flag: ${e.pen === 'PI' ? 'PI' : PENALTIES[e.pen]}`] : [STATS[e.type].tag, STATS[e.type].label]);
function gameLabel(db, g) {
  if (g.type === 'playoff') return bowlName(db, g.bowl);
  if (g.type === 'exhibition') return 'Exhibition';
  return '';
}
const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;
function winner(g) {
  if (!isFinal(g) || g.homeScore === g.awayScore) return null;
  return g.homeScore > g.awayScore ? g.home : g.away;
}
function statusBadge(g) {
  if (g.status === 'final') return '<span class="badge final">Final</span>';
  if (g.status === 'postponed') return '<span class="badge ppd">Postponed</span>';
  if (g.status === 'live') return '<span class="badge live"><i></i>Live</span>';
  return `<span class="badge sched">${g.date ? time12(g.time) : 'TBD'}</span>`;
}

function teamStats(db, id) {
  const s = { w: 0, l: 0, t: 0, pf: 0, pa: 0, td: 0, int: 0, tdAllowed: 0, intThrown: 0, gp: 0, pw: 0, pl: 0, exW: 0, exL: 0, streak: '', form: [] };
  const games = db.games.filter((g) => isFinal(g) && (g.home === id || g.away === id)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const results = [];
  for (const g of games) {
    const mine = g.home === id ? g.homeScore : g.awayScore;
    const theirs = g.home === id ? g.awayScore : g.homeScore;
    const r = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
    if (g.type === 'exhibition') { if (r === 'W') s.exW++; if (r === 'L') s.exL++; continue; }
    s.gp++; s.pf += mine; s.pa += theirs;
    if (r === 'W') s.w++; else if (r === 'L') s.l++; else s.t++;
    if (g.type === 'playoff') { if (r === 'W') s.pw++; if (r === 'L') s.pl++; }
    for (const e of g.events || []) {
      if (e.type === 'TD') { if (e.team === id) s.td++; else s.tdAllowed++; }
      if (e.type === 'INT') { if (e.team === id) s.int++; else s.intThrown++; }
    }
    results.push({ r, g });
  }
  if (results.length) {
    const last = results[results.length - 1].r;
    let n = 0;
    for (let i = results.length - 1; i >= 0 && results[i].r === last; i--) n++;
    s.streak = last + n;
  }
  s.form = results.slice(-5);
  s.pct = s.gp ? ((s.w + s.t / 2) / s.gp).toFixed(3).replace(/^0/, '') : '.000';
  s.diff = s.pf - s.pa;
  return s;
}
const record = (s) => `${s.w}-${s.l}${s.t ? '-' + s.t : ''}`;

function playerLeaders(db) {
  const map = {};
  const bump = (team, name, k) => {
    if (!name) return;
    const key = team + '|' + name;
    map[key] = map[key] || { team, name, td: 0, ptd: 0, int: 0 };
    map[key][k]++;
  };
  for (const g of db.games) {
    if (g.status !== 'final') continue; // player stats count exhibitions too
    for (const e of g.events || []) {
      if (e.type === 'TD') { bump(e.team, e.player, 'td'); bump(e.team, e.passer, 'ptd'); }
      else if (e.type === 'INT') bump(e.team, e.player, 'int');
    }
  }
  return Object.values(map);
}

// ---------- auth ----------
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function isAdmin(req) {
  const c = Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]; }));
  if (!c.mfl_admin) return false;
  const [exp, sig] = c.mfl_admin.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.redirect('/admin/login'));

// ---------- components ----------
function icon(name) {
  const p = {
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5"/>',
    fire: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3s0 2 2 2c0-3-1-5 1-8z"/>',
  }[name];
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

function ticker(db) {
  const t = today();
  const sorted = db.games.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  let idx = sorted.findIndex((g) => g.date >= t);
  if (idx === -1) idx = sorted.length;
  const slice = sorted.slice(Math.max(0, idx - 4), idx + 8);
  return `<div class="ticker"><div class="ticker-in">${slice.map((g) => {
    const a = db.teams[g.home], b = db.teams[g.away], w = winner(g);
    const row = (tm, sc) => `<div class="tk-row ${w && w !== tm.id ? 'dim' : ''}">${logo(tm, 18)}<span>${esc(tm.abbr)}</span><b>${isFinal(g) ? sc : ''}</b></div>`;
    const lbl = gameLabel(db, g);
    return `<a class="tk ${g.date === t ? 'now' : ''}" href="/games/${g.id}"><div class="tk-top"><span>${esc(g.date === t ? 'Today' : shortDate(g.date))}</span>${statusBadge(g)}</div>${row(a, g.homeScore)}${row(b, g.awayScore)}${lbl ? `<div class="tk-lbl">${esc(lbl)}</div>` : ''}</a>`;
  }).join('')}</div></div>`;
}

function gameCard(db, g, opts = {}) {
  const a = db.teams[g.home], b = db.teams[g.away], w = winner(g);
  const lbl = gameLabel(db, g);
  const side = (tm, sc) => `<div class="gc-team ${w && w !== tm.id ? 'dim' : ''} ${w === tm.id ? 'won' : ''}">${logo(tm, 40)}<div class="gc-name"><b>${esc(tm.name)}</b><small>${esc(tm.city)}</small></div><span class="gc-score">${isFinal(g) ? sc : ''}</span></div>`;
  return `<a class="gc ${g.status}" href="/games/${g.id}" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="gc-head"><span class="gc-date">${opts.noDate ? '' : esc(shortDate(g.date))}</span>${lbl ? `<span class="tag ${g.type}">${esc(lbl)}</span>` : ''}${statusBadge(g)}</div>
    ${side(a, g.homeScore)}${side(b, g.awayScore)}
    <div class="gc-foot"><span>${icon('pin')} ${VENUE}</span>${isFinal(g) && boxStatus(g) !== 'complete' ? `<span class="gc-box">Box score ${boxStatus(g)}</span>` : ''}${g.reason && (g.status === 'postponed' || g.type === 'exhibition') ? `<span class="gc-reason">${esc(g.reason)}</span>` : ''}</div>
  </a>`;
}

function layout(req, title, body, opts = {}) {
  const db = load();
  const teams = Object.values(db.teams);
  const admin = isAdmin(req);
  const user = currentUser(req);
  const cur = req.path;
  const on = (prefixes) => (prefixes.some((p) => cur.startsWith(p)) ? 'on' : '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MFL</title>
<meta name="theme-color" content="#0a0a0d">
<meta name="description" content="Metcalf Football League: schedule, scores, standings, player stats and a just-for-fun prediction game and collectible player cards for the Thomas Metcalf School flag football league.">
<link rel="icon" href="/static/mfl-logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,800;1,900&family=Press+Start+2P&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css?v=55">
</head><body>
<header class="hdr"><div class="hdr-in">
  <a class="brand" href="/"><img src="/static/mfl-logo.webp" alt=""><span>MFL</span></a>
  ${user ? `<a class="hdr-coins" href="/pickem/me" aria-label="My coins">${icon('coin')}<span data-balance>…</span></a>` : ''}
  <a class="hdr-arc" href="/arcade">🕹️ Arcade</a>
  <button class="burger" aria-label="Menu" onclick="document.body.classList.toggle('nav-open')"><span></span><span></span></button>
  <nav class="nav">
    <div class="dd ${on(['/schedule', '/scores', '/games'])}"><button>Games ${icon('chev')}</button><div class="dd-m">
      <a href="/schedule">${icon('cal')} Schedule</a><a href="/scores">${icon('clock')} Scores</a><a href="/history">${icon('swap')} Head-to-Head</a></div></div>
    <div class="dd ${on(['/playoffs'])}"><button>Playoffs ${icon('chev')}</button><div class="dd-m">
      ${db.bowls.map((b) => `<a href="/playoffs/${b.slug}">${icon('trophy')} ${esc(b.name)}</a>`).join('')}</div></div>
    <div class="dd ${on(['/teams'])}"><button>Teams ${icon('chev')}</button><div class="dd-m">
      ${teams.map((t) => `<a href="/teams/${t.id}">${logo(t, 22)} ${esc(teamFull(t))}</a>`).join('')}<a href="/transactions">${icon('swap')} Transactions</a></div></div>
    <div class="dd ${on(['/stats', '/records', '/cards'])}"><button>Stats ${icon('chev')}</button><div class="dd-m">
      <a href="/stats/team">${icon('chart')} Team Stats</a><a href="/stats/players">${icon('star')} Player Leaders</a><a href="/stats/rankings">${icon('fire')} Power Rankings</a><a href="/records">${icon('trophy')} Records Book</a><a href="/cards">${icon('star')} Trading Cards</a></div></div>
    <div class="dd ${on(['/midweek', '/analyst'])}"><button>News ${icon('chev')}</button><div class="dd-m">
      <a href="/midweek">${icon('cal')} Midweek Recap</a><a href="/analyst">${icon('star')} Ask the Analyst</a><a href="/pickem/survivor">${icon('fire')} Survivor</a><a href="/pickem/cards">${icon('trophy')} MFL Cards</a></div></div>
    <div class="nav-main"><a class="nav-arc ${on(['/arcade'])}" href="/arcade">🕹️ Arcade</a>
    <a class="nav-career ${on(['/career'])}" href="/career">🏈 Career</a>
    <a class="nav-cards ${CARD_PAGES.test(cur) ? 'on' : ''}" href="/pickem/cards">🃏 Cards</a>
    <a class="nav-pick ${on(['/pickem']) && !CARD_PAGES.test(cur) ? 'on' : ''}" href="/pickem">${icon('coin')} Pick'em</a></div>
    <div class="acct-box">${user
      ? `<a class="acct" href="/pickem/me" title="My picks">${icon('user')}<b>@${esc(user)}</b><span class="coins">${icon('coin')}<span data-balance>…</span></span></a><a class="acct-out" href="/pickem/logout">Log out</a>`
      : `<a class="acct" href="/pickem/login?next=${encodeURIComponent(cur.startsWith('/pickem') ? cur : '/pickem')}">Log in</a><a class="acct primary" href="/pickem/signup">Sign up</a>`}
    ${admin ? '<a class="nav-admin" href="/admin">Admin</a>' : ''}</div>
  </nav>
</div></header>
${hypeBanner(db, cur)}
${opts.ticker === false ? '' : ticker(db)}
<main>${body}</main>
<footer class="ftr"><div class="wrap ftr-in">
  <div class="ftr-brand"><img src="/static/mfl-logo.webp" alt=""><div><b>Metcalf Football League</b><small>All games at ${VENUE}</small></div></div>
  <div class="ftr-links"><a href="/schedule">Schedule</a><a href="/scores">Scores</a><a href="/arcade">Arcade</a><a href="/career">Career</a><a href="/pickem/cards">Cards</a><a href="/pickem">Pick'em</a><a href="/history">Head-to-Head</a><a href="/stats/players">Leaders</a><a href="/stats/rankings">Rankings</a><a href="/records">Records</a><a href="/cards">Cards</a><a href="/calendar.ics">Add to calendar</a>${teams.map((t) => `<a href="/teams/${t.id}">${esc(t.name)}</a>`).join('')}<a href="/admin">Admin</a></div>
</div></footer>
${hypeBowl(db) ? hypeBarScript : ''}<script>
document.querySelectorAll('.dd>button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const p=b.parentElement,o=p.classList.contains('open');document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'));if(!o)p.classList.add('open');}));
document.addEventListener('click',()=>document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open')));
const t=document.querySelector('.tk.now');if(t)t.parentElement.parentElement.scrollLeft=t.offsetLeft-16;
// The header balance loads after the page so every page stays fast.
if(document.querySelector('.hdr [data-balance]'))fetch('/pickem/me.json').then(r=>r.json()).then(d=>{if(d.balance!=null)document.querySelectorAll('[data-balance]').forEach(n=>n.textContent=d.balance.toLocaleString('en-US'))}).catch(()=>{});
// Start loading a page as soon as a finger or mouse lands on its link.
if(!window.MFL_ORIGIN){const done=new Set();const pf=(e)=>{const a=e.target.closest&&e.target.closest('a[href^="/"]');if(!a||a.target||/^[/](admin|pickem[/]logout|calendar)/.test(a.getAttribute('href')))return;const u=a.href.split('#')[0];if(done.has(u)||u===location.href.split('#')[0])return;done.add(u);const l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);};
document.addEventListener('pointerover',pf,{passive:true});document.addEventListener('touchstart',pf,{passive:true});}
</script>
</body></html>`;
}

const pageHead = (kicker, title, sub = '') => `<section class="ph"><div class="wrap"><div class="kicker">${kicker}</div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></section>`;

function monthTabs(base, months, cur) {
  return `<div class="seg">${months.map((m) => `<a class="${m === cur ? 'on' : ''}" href="${base}?month=${m}">${MONTHS[Number(m.slice(5)) - 1].slice(0, 3)} <small>'${m.slice(2, 4)}</small></a>`).join('')}</div>`;
}
function dayGroups(db, games) {
  const groups = {};
  for (const g of games) (groups[g.date || 'TBD'] = groups[g.date || 'TBD'] || []).push(g);
  const t = today();
  return Object.entries(groups).map(([d, gs]) => `<section class="day"><h3>${d === t ? '<span class="dot"></span>Today · ' : ''}${esc(d === 'TBD' ? 'Date TBD' : longDate(d))}</h3><div class="grid-cards">${gs.map((g) => gameCard(db, g, { noDate: true })).join('')}</div></section>`).join('');
}

function heroResult(db, g) {
  const a = db.teams[g.home], b = db.teams[g.away], w = winner(g);
  const wt = w ? db.teams[w] : null, lt = w ? db.teams[w === a.id ? b.id : a.id] : null;
  const hi = Math.max(g.homeScore, g.awayScore), lo = Math.min(g.homeScore, g.awayScore);
  const tds = (g.events || []).filter((e) => e.type === 'TD');
  return `<a class="hero" href="/games/${g.id}" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="hero-txt"><div class="kicker">${esc(gameLabel(db, g) || 'Final')} · ${esc(longDate(g.date))}</div>
      <h1>${wt ? `${esc(wt.name)} beat ${esc(lt.name)} ${hi}–${lo}` : `${esc(a.name)} and ${esc(b.name)} tie ${hi}–${lo}`}</h1>
      <p>${(() => { const m = gameMvp(db, g); return m ? `MVP: ${esc(m.name)} (${esc(m.line)}).` : tds.length ? `${tds.length} touchdown${tds.length > 1 ? 's' : ''} at ${VENUE}.` : `At ${VENUE}.`; })()} <span class="link">Recap & box score ${icon('arrow')}</span></p></div>
    <div class="hero-board">
      <div class="hb-team ${w && w !== a.id ? 'dim' : ''}">${logo(a, 72)}<b>${esc(a.abbr)}</b></div>
      <div class="hb-score"><span class="${w && w !== a.id ? 'dim' : ''}">${g.homeScore}</span><i>–</i><span class="${w && w !== b.id ? 'dim' : ''}">${g.awayScore}</span></div>
      <div class="hb-team ${w && w !== b.id ? 'dim' : ''}">${logo(b, 72)}<b>${esc(b.abbr)}</b></div>
    </div></a>`;
}
// Kickoff as a real timestamp (league time zone), for live countdowns.
function kickoffTs(g) {
  if (!g.date) return null;
  const local = pk.nowLocal(TZ).replace(' ', 'T') + ':00Z';
  const offset = Date.parse(local) - Math.floor(Date.now() / 60000) * 60000;
  return Date.parse(`${g.date}T${g.time || '12:35'}:00Z`) - offset;
}
const countdown = (g) => (g.status === 'scheduled' && kickoffTs(g) > Date.now() ? `<div class="cd" data-ts="${kickoffTs(g)}"><div><b>–</b><small>days</small></div><div><b>–</b><small>hrs</small></div><div><b>–</b><small>min</small></div><div><b>–</b><small>sec</small></div></div>` : '');
const countdownScript = `<script>(()=>{const els=document.querySelectorAll('.cd');if(!els.length)return;const tick=()=>els.forEach(el=>{let s=Math.max(0,Math.floor((+el.dataset.ts-Date.now())/1000));const v=[Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];el.querySelectorAll('b').forEach((b,i)=>b.textContent=String(v[i]).padStart(2,'0'));if(!s)el.classList.add('done')});tick();setInterval(tick,1000)})()</script>`;

function heroNext(db, g, kicker) {
  const a = db.teams[g.home], b = db.teams[g.away];
  return `<a class="hero" href="/games/${g.id}" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="hero-txt"><div class="kicker">${esc(kicker)}${gameLabel(db, g) ? ' · ' + esc(gameLabel(db, g)) : ''}</div>
      <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
      <p>${icon('cal')} ${esc(longDate(g.date))} &nbsp; ${icon('clock')} ${time12(g.time)} &nbsp; ${icon('pin')} ${VENUE}</p>${countdown(g)}</div>
    <div class="hero-board">
      <div class="hb-team">${logo(a, 72)}<b>${esc(a.abbr)}</b><small>${record(teamStats(db, a.id))}</small></div>
      <div class="hb-score vs"><i>VS</i></div>
      <div class="hb-team">${logo(b, 72)}<b>${esc(b.abbr)}</b><small>${record(teamStats(db, b.id))}</small></div>
    </div></a>`;
}

// ---------- public routes ----------
app.get('/', async (req, res, next) => {
 try {
  const db = load();
  const t = today();
  const lastW = weeklyWinners(await leaderboard(db)).at(-1);
  const mw = (db.midweek || []).at(-1);
  const dated = db.games.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  const lastFinal = [...dated].reverse().find(isFinal);
  const upcoming = dated.filter((g) => g.date >= t && g.status !== 'final' && g.status !== 'postponed');
  const next = upcoming[0];
  const teams = Object.values(db.teams);

  let hero = '';
  if (next && next.date === t) hero = heroNext(db, next, 'Game Day');
  else if (lastFinal) hero = heroResult(db, lastFinal);
  else if (next) hero = heroNext(db, next, 'Up Next');

  const [A, B] = teams;
  const sA = teamStats(db, A.id), sB = teamStats(db, B.id);
  const totalW = sA.w + sB.w;
  const standings = `<div class="card"><div class="card-h"><h2>Standings</h2><a href="/stats/team">Team stats ${icon('arrow')}</a></div>
    ${[[A, sA], [B, sB]].sort((x, y) => y[1].w - x[1].w || x[1].l - y[1].l).map(([tm, s], i) => `<a class="stand" href="/teams/${tm.id}"><span class="rank">${i + 1}</span>${logo(tm, 36)}<div class="stand-n"><b>${esc(tm.name)}</b><small>${esc(tm.city)}</small></div><div class="formguide">${s.form.map((f) => `<i class="${f.r}">${f.r}</i>`).join('')}</div><b class="rec">${record(s)}</b></a>`).join('')}
    <div class="race"><div style="width:${totalW ? (sA.w / totalW) * 100 : 50}%;background:${esc(A.color)}"></div><div style="flex:1;background:${esc(B.color)}"></div></div>
    <div class="race-l"><span>${esc(A.abbr)} ${sA.w}W</span><span>Season series</span><span>${sB.w}W ${esc(B.abbr)}</span></div></div>`;

  const bowls = db.bowls.map((b) => ({ b, g: db.games.find((g) => g.bowl === b.slug) })).filter(({ g }) => g);
  const road = `<div class="card"><div class="card-h"><h2>Road to the Super Bowl</h2></div><ol class="road">
    ${bowls.map(({ b, g }) => { const wn = winner(g); return `<li class="${isFinal(g) ? 'done' : ''}"><a href="/playoffs/${b.slug}"><span class="road-dot"></span><div><b>${esc(b.name)}</b><small>${esc(g.date ? shortDate(g.date) : 'Date TBD')}</small></div>${wn ? `<span class="road-w">${logo(db.teams[wn], 22)} ${esc(db.teams[wn].abbr)}</span>` : ''}</a></li>`; }).join('')}
  </ol></div>`;

  const recent = [...dated].reverse().filter(isFinal).slice(0, 4);
  const rules = `<div class="card"><div class="card-h"><h2>House Rules</h2></div><div class="rules">
    <div><b>7</b><span>Banana blitz</span></div><div><b>0</b><span>First downs</span></div><div><b>↗</b><span>Throw-offs, no kickoffs</span></div><div><b>✕</b><span>No punting</span></div></div>
    <p class="muted sm">TR = Team Representative. Team reps can trade non-team-representatives. One quarter per game.</p></div>`;

  res.send(layout(req, 'Metcalf Football League', `
    <div class="wrap home">
      ${hypeTakeover(db) || hero}
      <a class="arc-promo" href="/arcade"><div class="arc-promo-art" aria-hidden="true"><div class="px-field"><i></i><i></i><i></i><i></i><b></b></div></div>
        <div class="arc-promo-txt"><span class="kicker">🕹️ New · MFL Arcade</span><b>Play Modern Bowl with your Starting 8</b><span>Plus Chess, 8-Ball Pool, Trivia and 6 more games. Win coins, crank up Risk mode for up to 5×.</span></div>
        <span class="btn">Play now ${icon('arrow')}</span></a>
      <div class="home-grid">
        <div class="col">
          <div class="card"><div class="card-h"><h2>Up Next</h2><a href="/schedule">Full schedule ${icon('arrow')}</a></div><div class="list">${upcoming.slice(0, 4).map((g) => gameCard(db, g)).join('') || '<p class="muted">Nothing scheduled.</p>'}</div></div>
          <div class="card"><div class="card-h"><h2>Latest Results</h2><a href="/scores">All scores ${icon('arrow')}</a></div><div class="list">${recent.map((g) => gameCard(db, g)).join('') || '<p class="muted">No games played yet.</p>'}</div></div>
        </div>
        <div class="col">${lastW ? `<a class="card botw" href="/pickem/u/${esc(lastW.name)}"><span class="botw-ic">${icon('star')}</span><div><small>Pick'em Champion of the Week · ${esc(shortDate(lastW.week))}</small><b>@${esc(lastW.name)}</b></div><span class="up">${signed(lastW.profit)}</span></a>` : ''}
          ${mw ? `<a class="card mw-promo" href="/midweek"><small>${icon('cal')} The Midweek Recap · ${esc(shortDate(mw.date))}</small><b>${esc(mw.headline)}</b><span>${esc(mw.intro.slice(0, 140))}${mw.intro.length > 140 ? '…' : ''}</span></a>` : ''}
          <a class="card promo cards-promo" href="/pickem/cards"><div>${icon('trophy')}</div><div><b>MFL Cards</b><span>Open packs, collect rare cards and play your Starting 8 for coins.</span></div>${icon('arrow')}</a>
          <a class="card promo" href="/pickem"><div>${icon('coin')}</div><div><b>Pick'em is live</b><span>Free to play. Pick every game with fake coins, with combos and player picks.</span></div>${icon('arrow')}</a>${standings}${road}${rules}</div>
      </div>
    </div>${countdownScript}`));
 } catch (e) { next(e); }
});

app.get('/schedule', (req, res) => {
  const db = load();
  const months = [...new Set(db.games.filter((g) => g.date).map((g) => g.date.slice(0, 7)))].sort();
  const t = today().slice(0, 7);
  const cur = months.includes(req.query.month) ? req.query.month : months.includes(t) ? t : months[0];
  const games = db.games.filter((g) => g.date?.startsWith(cur)).sort((a, b) => a.date.localeCompare(b.date));
  const tbd = db.games.filter((g) => !g.date);
  res.send(layout(req, 'Schedule', pageHead('2026–27 Season', 'Schedule', `Mon, Tue, Thu &amp; Fri · 12:35 PM · ${VENUE}`) +
    `<div class="wrap">${monthTabs('/schedule', months, cur)}${dayGroups(db, games)}${tbd.length ? `<section class="day"><h3>Date TBD</h3><div class="grid-cards">${tbd.map((g) => gameCard(db, g, { noDate: true })).join('')}</div></section>` : ''}</div>`));
});

app.get('/scores', (req, res) => {
  const db = load();
  const t = today();
  const played = db.games.filter((g) => g.date && (g.date <= t || g.status !== 'scheduled'));
  const months = [...new Set(played.map((g) => g.date.slice(0, 7)))].sort();
  const cur = months.includes(req.query.month) ? req.query.month : months[months.length - 1];
  const games = played.filter((g) => g.date.startsWith(cur || '')).sort((a, b) => b.date.localeCompare(a.date));
  res.send(layout(req, 'Scores', pageHead('2026–27 Season', 'Scores') +
    `<div class="wrap">${months.length ? monthTabs('/scores', months, cur) : ''}${dayGroups(db, games) || '<p class="muted">No scores yet.</p>'}</div>`));
});

app.get('/games/:id', (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Game not found')));
  const a = db.teams[g.home], b = db.teams[g.away], w = winner(g);
  const evs = g.events || [];
  const lbl = gameLabel(db, g);

  const plays = `<div class="card"><div class="card-h"><h2>Plays</h2></div>${evs.length ? `<ol class="plays">${evs.map((e) => {
    const tm = db.teams[e.team] || a;
    const [cls, label] = playTag(e);
    return `<li style="--c:${esc(tm.color)}">${logo(tm, 32)}<div><span class="tag ${cls}">${label}</span>
      <p>${playLine(db, g, e)}</p></div></li>`;
  }).join('')}</ol>` : boxStatus(g) === 'unknown' ? '' : `<p class="muted">${isFinal(g) ? 'No plays were recorded for this game.' : 'Plays will show up here after the game.'}</p>`}${boxNote(g) ? `<p class="box-warn ${boxStatus(g)}">${icon('clock')} ${esc(boxNote(g))}</p>` : ''}</div>`;

  const box = (tm) => {
    const rows = {};
    const r = (n) => (rows[n] = rows[n] || { td: 0, ptd: 0, int: 0, ...Object.fromEntries(Object.values(STATS).map((st) => [st.key, 0])) });
    for (const e of evs) {
      if (e.team !== tm.id) continue;
      if (e.player) r(e.player)[e.type === 'TD' ? 'td' : e.type === 'INT' ? 'int' : STATS[e.type].key]++;
      if (e.type === 'TD' && e.passer) r(e.passer).ptd++;
    }
    const list = Object.entries(rows);
    // Only show the extra stat columns this game actually has.
    const cols = [['td', 'TD'], ['ptd', 'Pass TD'], ['int', 'INT'], ...Object.values(STATS).map((st) => [st.key, st.short])].filter(([k], i) => i < 3 || list.some(([, x]) => x[k]));
    const outNames = tm.roster.filter((p) => pk.isOut(g, tm.id, p.id)).map((p) => p.name);
    const pens = evs.filter((e) => e.team === tm.id && e.type === 'PEN');
    const penLine = pens.length ? `<p class="muted sm out-line">Penalties: ${pens.length} (${esc(Object.entries(pens.reduce((o, e) => ((o[e.pen === 'PI' ? 'PI' : penName(e.pen)] = (o[e.pen === 'PI' ? 'PI' : penName(e.pen)] || 0) + 1), o), {})).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', '))})</p>` : '';
    const outLine = outNames.length ? `<p class="muted sm out-line">Did not play: ${esc(outNames.join(', '))}</p>` : '';
    return `<div class="card"><div class="card-h"><h2 class="th">${logo(tm, 26)} ${esc(tm.name)}</h2></div>${list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="l">Player</th>${cols.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${list.map(([n, x]) => `<tr><td class="l">${playerLink(tm, n, true)}</td>${cols.map(([k]) => `<td>${x[k] || '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="muted">${boxStatus(g) === 'unknown' ? 'Box score unknown.' : 'No player stats recorded.'}</p>`}${penLine}${outLine}</div>`;
  };

  const center = isFinal(g)
    ? `<div class="gh-score"><span class="${w && w !== a.id ? 'dim' : ''}">${g.homeScore}</span><i>–</i><span class="${w && w !== b.id ? 'dim' : ''}">${g.awayScore}</span></div>${statusBadge(g)}`
    : `<div class="gh-score vs"><i>VS</i></div>${statusBadge(g)}`;

  res.send(layout(req, `${a.name} vs ${b.name}`, `
    <section class="gh" style="--a:${esc(a.color)};--b:${esc(b.color)}"><div class="wrap">
      <div class="gh-meta">${lbl ? `<span class="tag ${g.type}">${esc(lbl)}</span>` : ''}<span>${icon('cal')} ${esc(longDate(g.date))}${g.date ? ' · ' + time12(g.time) : ''}</span><span>${icon('pin')} ${VENUE}</span></div>
      <div class="gh-row">
        <a href="/teams/${a.id}" class="gh-team ${w && w !== a.id ? 'dim' : ''}">${logo(a, 96)}<b>${esc(a.name)}</b><small>${esc(a.city)} · ${record(teamStats(db, a.id))}</small></a>
        <div class="gh-mid">${center}</div>
        <a href="/teams/${b.id}" class="gh-team ${w && w !== b.id ? 'dim' : ''}">${logo(b, 96)}<b>${esc(b.name)}</b><small>${esc(b.city)} · ${record(teamStats(db, b.id))}</small></a>
      </div>
      ${g.reason ? `<div class="gh-note">${g.status === 'postponed' ? '<b>Postponed</b> · ' : g.type === 'exhibition' ? '<b>Exhibition</b> · ' : ''}${esc(g.reason)}</div>` : ''}
    </div></section>
    <div class="wrap">${isFinal(g) || g.status === 'postponed' ? '' : preview(db, g)}${recapCard(db, g, req)}${g.status === 'postponed' ? '' : pollCard(db, g, req)}</div>
    <div class="wrap game-grid">${plays}<div class="col">${box(a)}${box(b)}</div></div>${countdownScript}`));
});

function recapCard(db, g, req) {
  if (!isFinal(g)) return '';
  const m = gameMvp(db, g);
  const wait = Math.max(0, RECAP_COOLDOWN - (Date.now() - Date.parse(g.aiRecap?.rewrittenAt || 0)));
  const msg = { off: 'AI recaps are not set up yet.', wait: 'This recap was just rewritten. Try again later.', err: "Couldn't rewrite the recap right now. Try again soon." }[req?.query?.ai];
  const fm = fanMvp(db, g);
  const story = freshRecap(db, g)?.story || [];
  const fanBox = fm ? `<a class="mvp fan" href="${playerUrl(fm.t, fm.p)}" style="--a:${esc(fm.t.color)}"><span class="mvp-tag">${icon('user')} Fan MVP</span>${avatar(fm.t, fm.p, 52)}<b>${esc(fm.p.name)}</b><small>${fm.votes} vote${fm.votes === 1 ? '' : 's'}</small></a>` : '';
  const btn = ai.apiKey() ? `<form method="post" action="/games/${g.id}/recap" class="recap-go"><button class="btn sm ghost" ${wait ? 'disabled' : ''} onclick="this.textContent='Writing…'">${icon('swap')} ${wait ? `Rewrite again in ${Math.ceil(wait / 60000)} min` : 'Rewrite with AI'}</button>${msg ? `<span class="muted sm">${msg}</span>` : ''}</form>` : '';
  return `<div class="card recap" id="recap"><div class="card-h"><h2>Recap</h2>${gameLabel(db, g) ? `<span class="tag ${g.type}">${esc(gameLabel(db, g))}</span>` : ''}</div>
    <div class="recap-body">${m ? `<a class="mvp" href="${m.player ? playerUrl(m.tm, m.player) : '#'}" style="--a:${esc(m.tm.color)}"><span class="mvp-tag">${icon('trophy')} Game MVP</span>${m.player ? avatar(m.tm, m.player, 64) : ''}<b>${esc(m.name)}</b><small>${esc(m.line)}</small></a>` : ''}${fanBox}
    <div class="recap-txt"><p class="recap-lead">${esc(recap(db, g))}</p>${story.length ? `<div class="recap-more" id="rm-${esc(g.id)}">${story.map((x) => `<p>${esc(x)}</p>`).join('')}</div><button type="button" class="btn sm ghost recap-toggle" aria-expanded="false" aria-controls="rm-${esc(g.id)}" onclick="const o=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',!o);this.previousElementSibling.classList.toggle('open',!o);this.textContent=o?'Read the full story':'Show less';if(o)this.closest('.recap').scrollIntoView({block:'start',behavior:'smooth'})">Read the full story</button>` : ''}</div></div>${freshRecap(db, g) ? '<p class="muted sm ai-note">Recap and MVP by our AI analyst.</p>' : ''}${btn}</div>`;
}

// Auto-generated preview for games that haven't been played yet.
function preview(db, g) {
  const a = db.teams[g.home], b = db.teams[g.away];
  const sA = teamStats(db, a.id), sB = teamStats(db, b.id);
  const prev = db.games.filter((x) => isFinal(x) && x.date < (g.date || '9999')).sort((x, y) => y.date.localeCompare(x.date));
  const last = prev[0];
  const lead = (t) => playerLeaders(db).filter((p) => p.team === t.id).sort((x, y) => y.td - x.td)[0];
  const open = pk.isOpen(db, g, TZ);
  const m = open ? pk.markets(db, g) : null;
  const wp = (t) => (m ? Math.round((m.byKey[`ml:${t.id}`]?.p || 0) * 100) : null);
  const per = (n, gp) => (gp ? (n / gp).toFixed(1) : '0.0');
  const line = (label, x, y) => `<div class="pv-row"><b>${x}</b><span>${label}</span><b>${y}</b></div>`;
  const ldr = (t) => { const p = lead(t); return p && p.td ? `${esc(p.name)} (${p.td})` : '–'; };
  const A = g.aiPreview, wk = A?.watch && !pk.isOut(g, ...A.watch.split('|')) ? A.watch : null, watch = wk && cards.findPlayer(db, wk.split('|')[1]);
  const aiBox = A ? `<div class="aipv"><p>${esc(A.text)}</p><div class="aipv-row"><div class="aipv-pred"><small>AI prediction</small><b>${esc(a.abbr)} ${A.ph} – ${A.pa} ${esc(b.abbr)}</b></div>${watch ? `<a class="aipv-watch" href="${playerUrl(watch.t, watch.p)}">${avatar(watch.t, watch.p, 40)}<div><small>Player to watch</small><b>${esc(watch.p.name)}</b><span>${esc(A.why)}</span></div></a>` : ''}</div></div>` : '';
  return `<div class="card preview" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="card-h"><h2>Game Preview</h2>${countdown(g)}</div>${aiBox}
    <div class="pv-head"><span>${logo(a, 28)} ${esc(a.abbr)}</span><span>${esc(b.abbr)} ${logo(b, 28)}</span></div>
    ${line('Record', record(sA), record(sB))}
    ${line('Points / game', per(sA.pf, sA.gp), per(sB.pf, sB.gp))}
    ${line('Allowed / game', per(sA.pa, sA.gp), per(sB.pa, sB.gp))}
    ${line('Touchdowns', sA.td, sB.td)}
    ${line('Interceptions', sA.int, sB.int)}
    ${line('Streak', sA.streak || '–', sB.streak || '–')}
    ${line('TD leader', ldr(a), ldr(b))}
    <p class="pv-note">${last ? `Last meeting: <a href="/games/${last.id}">${esc(db.teams[winner(last) || last.home].name)} ${winner(last) ? 'won' : 'tied'} ${Math.max(last.homeScore, last.awayScore)}–${Math.min(last.homeScore, last.awayScore)}</a> on ${esc(shortDate(last.date))}.` : 'First meeting of the season.'}
      ${m ? ` Pick'em gives the ${esc(a.name)} a ${wp(a)}% chance and the ${esc(b.name)} ${wp(b)}%. To beat the margin pick, the ${esc(db.teams[m.fav].name)} need to win by ${Math.ceil(m.line)} or more.` : ''}</p>
    ${open ? `<a class="btn" href="/pickem">${icon('coin')} Make your picks: ${m.list.length} picks</a>` : ''}
  </div>`;
}

// Each bowl gets its own look. Decorations are emoji/CSS only.
const BOWL_THEMES = {
  'halloween-bowl': { cls: 'halloween', fx: ['🎃', '🦇', '👻', '🕸️'], tag: 'Spooky season showdown' },
  'turkey-bowl': { cls: 'turkey', fx: ['🍂', '🍁', '🦃', '🥧'], tag: 'The Thanksgiving classic' },
  'christmas-bowl': { cls: 'christmas', fx: ['❄️', '❄️', '🎄', '🎁'], tag: 'Holiday bragging rights' },
  'spring-bowl': { cls: 'spring', fx: ['🌸', '🌷', '🌼', '🦋'], tag: 'Fresh start, same rivalry' },
  'super-bowl': { cls: 'super', fx: ['🏆', '✨', '🎉', '⭐'], tag: 'Winner takes the season' },
};
// Bowl hype: from a week before a bowl until the day after it, the whole site promotes it.
// (For the Halloween Bowl on Oct 30 that's through Oct 31; it all disappears on Nov 1.)
function hypeBowl(db) {
  const d = pk.nowLocal(TZ).slice(0, 10);
  for (const b of db.bowls) {
    const g = db.games.find((x) => x.bowl === b.slug);
    if (!g || !g.date || g.status === 'postponed') continue;
    if (d >= addDays(g.date, -7) && d <= addDays(g.date, 1)) return { b, g, th: BOWL_THEMES[b.slug] || { cls: 'super', fx: ['⭐'], tag: 'MFL Postseason' } };
  }
  return null;
}
const hypeState = (g) => (isFinal(g) ? 'final' : kickoffTs(g) <= Date.now() ? 'live' : 'pre');
function hypeBanner(db, cur) {
  const h = hypeBowl(db);
  if (!h || cur === `/playoffs/${h.b.slug}`) return '';
  const { b, g, th } = h, A = db.teams[g.home], B = db.teams[g.away], st = hypeState(g), wn = winner(g);
  const msg = st === 'final'
    ? `${wn ? `<b>${esc(db.teams[wn].name)} win the ${esc(b.name)}!</b>` : `<b>${esc(b.name)} ends in a tie!</b>`}<span>${esc(A.abbr)} ${g.homeScore}–${g.awayScore} ${esc(B.abbr)}</span>`
    : st === 'live'
      ? `<b><i class="hb-live"></i>${esc(b.name)} is ON</b><span>${esc(A.abbr)} vs ${esc(B.abbr)} · ${VENUE}</span>`
      : `<b>${esc(b.name)}</b><span>${esc(A.abbr)} vs ${esc(B.abbr)} · ${g.date === today() ? 'Today' : esc(shortDate(g.date))} ${time12(g.time)} · <span class="hb-cd" data-ts="${kickoffTs(g)}"></span></span>`;
  return `<a class="hype-bar ${th.cls}" href="/playoffs/${b.slug}"><span class="hb-fx" aria-hidden="true">${th.fx[0]}</span><span class="hb-msg">${msg}</span><span class="hb-go">${st === 'final' ? 'Recap' : 'Pregame show'} ${icon('arrow')}</span></a>`;
}
const hypeBarScript = `<script>(()=>{const e=document.querySelector('.hb-cd');if(!e)return;const f=()=>{const s=Math.max(0,Math.floor((+e.dataset.ts-Date.now())/1000));const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);e.textContent=s?'kickoff in '+(d?d+'d ':'')+(d||h?h+'h ':'')+m+'m'+(d?'':' '+String(s%60).padStart(2,'0')+'s'):'kickoff!'};f();setInterval(f,1000)})()</script>`;

// Home page takeover card for the bowl being hyped.
function hypeTakeover(db) {
  const h = hypeBowl(db);
  if (!h) return '';
  const { b, g, th } = h, A = db.teams[g.home], B = db.teams[g.away], st = hypeState(g), wn = winner(g);
  const fx = Array.from({ length: 12 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:-${(i * 1.3) % 8}s;animation-duration:${7 + (i % 4) * 2}s;font-size:${14 + (i % 3) * 8}px">${th.fx[i % th.fx.length]}</i>`).join('');
  const open = pk.isOpen(db, g, TZ);
  return `<section class="hype-take bowl-hero ${th.cls}"><div class="bowl-fx" aria-hidden="true">${fx}</div>
    <div class="ht-in"><div class="kicker">${icon('trophy')} ${st === 'final' ? 'Final' : st === 'live' ? 'Happening now' : g.date === today() ? 'Today' : esc(shortDate(g.date))} · ${esc(th.tag)}</div>
    <h2 class="ht-title">The ${esc(b.name)}</h2>
    <div class="bowl-match">${logo(A, 72)}<div class="bowl-mid">${st === 'final' ? `<b>${g.homeScore}–${g.awayScore}</b><small>${wn ? esc(db.teams[wn].abbr) + ' win' : 'Tie'}</small>` : '<b>VS</b>'}</div>${logo(B, 72)}</div>
    <p class="ht-sub">${st === 'final' ? 'The trophy has been handed out. Relive it all.' : `${esc(A.name)} vs ${esc(B.name)}. One game. Bragging rights until the next bowl.`}</p>
    ${st === 'pre' ? countdown(g) : ''}
    <div class="ht-btns"><a class="btn bowl-cta" href="/playoffs/${b.slug}">${st === 'final' ? 'See the recap' : '📺 Watch the pregame show'}</a>${open ? `<a class="btn ghost" href="/pickem">${icon('coin')} Make your picks</a>` : ''}</div></div></section>`;
}

// Pregame show for a bowl: AI breakdown (if the analyst wrote one) plus numbers that are always there.
function bowlShow(db, b, g, req) {
  const A = db.teams[g.home], B = db.teams[g.away];
  const sA = teamStats(db, A.id), sB = teamStats(db, B.id);
  const R = ratings(db), top = (t) => R.filter((x) => x.t.id === t.id && !pk.isOut(g, t.id, x.p.id)).slice(0, 3);
  const open = pk.isOpen(db, g, TZ), m = open ? pk.markets(db, g) : null;
  const wp = (t) => (m ? Math.round((m.byKey[`ml:${t.id}`]?.p || 0) * 100) : null);
  const meets = db.games.filter((x) => isFinal(x) && ((x.home === A.id && x.away === B.id) || (x.home === B.id && x.away === A.id)));
  const winsOf = (t) => meets.filter((x) => winner(x) === t.id).length, ties = meets.filter((x) => !winner(x)).length;
  const pts = meets.reduce((s, x) => s + x.homeScore + x.awayScore, 0);
  const S = g.aiBowlShow;
  const ai = S ? `<div class="card show-ai"><div class="card-h"><h2>📺 ${esc(S.headline)}</h2><span class="muted sm">MFL AI Analyst</span></div>
      <p class="show-intro">${esc(S.intro)}</p>
      <div class="show-secs">${S.sections.map((s) => `<div class="show-sec"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join('')}</div>
      <div class="show-call"><small>The Analyst's call</small><b>${esc(A.abbr)} ${S.ph} – ${S.pa} ${esc(B.abbr)}</b><span>${esc(S.call)}</span></div></div>`
    : g.aiPreview ? `<div class="card show-ai"><div class="card-h"><h2>📺 The Analyst's Preview</h2><span class="muted sm">MFL AI Analyst</span></div><p class="show-intro">${esc(g.aiPreview.text)}</p>
      <div class="show-call"><small>The Analyst's call</small><b>${esc(A.abbr)} ${g.aiPreview.ph} – ${g.aiPreview.pa} ${esc(B.abbr)}</b>${g.aiPreview.why ? `<span>Player to watch: ${esc(g.aiPreview.why)}</span>` : ''}</div></div>` : '';
  const watch = (t) => `<div class="show-team" style="--a:${esc(t.color)}"><div class="show-th">${logo(t, 30)}<b>${esc(t.name)}: players to watch</b></div>
    ${top(t).map((x, i) => `<a class="show-pl" href="${playerUrl(t, x.p)}">${avatar(t, x.p, 42)}<div><b>${esc(x.p.name)}</b><small>${i === 0 ? 'Go-to player' : i === 1 ? 'Difference maker' : 'X-factor'}${x.td ? ` · ${x.td} TD` : ''}${x.ptd ? ` · ${x.ptd} pass TD` : ''}</small></div><span class="show-r">${x.r}</span></a>`).join('') || '<p class="muted">Roster TBD.</p>'}</div>`;
  const per = (n, gp) => (gp ? (n / gp).toFixed(1) : '0.0');
  const bar = (label, x, y, nx = parseFloat(x) || 0, ny = parseFloat(y) || 0) => { const t = nx + ny || 1; return `<div class="tape-row"><b>${x}</b><div class="tape-bar"><span style="width:${(nx / t) * 100}%;background:${esc(A.color)}"></span><span style="width:${(ny / t) * 100}%;background:${esc(B.color)}"></span><em>${label}</em></div><b>${y}</b></div>`; };
  return `<div class="show">
    <div class="show-head"><span class="show-live">● PREGAME SHOW</span><h2>Everything you need before kickoff</h2></div>
    ${ai}
    <div class="show-grid">
      <div class="card"><div class="card-h"><h2>Tale of the Tape</h2></div>
        <div class="pv-head"><span>${logo(A, 26)} ${esc(A.abbr)}</span><span>${esc(B.abbr)} ${logo(B, 26)}</span></div>
        ${bar('Wins', sA.w, sB.w)}${bar('Points / game', per(sA.pf, sA.gp), per(sB.pf, sB.gp))}${bar('Touchdowns', sA.td, sB.td)}${bar('Interceptions', sA.int, sB.int)}
        <div class="tape-row plain"><b>${record(sA)}</b><em>Record</em><b>${record(sB)}</b></div>
        <div class="tape-row plain"><b>${sA.streak || '–'}</b><em>Streak</em><b>${sB.streak || '–'}</b></div></div>
      <div class="card"><div class="card-h"><h2>By the Numbers</h2></div><div class="show-nums">
        <div><b>${meets.length}</b><small>Meetings this season</small></div>
        <div><b>${winsOf(A)}-${winsOf(B)}${ties ? `-${ties}` : ''}</b><small>Series (${esc(A.abbr)}-${esc(B.abbr)}${ties ? '-T' : ''})</small></div>
        <div><b>${meets.length ? (pts / meets.length).toFixed(1) : '–'}</b><small>Points per meeting</small></div>
        <div><b>${m ? `${wp(A)}%` : '–'}</b><small>Pick'em: ${esc(A.abbr)} win chance</small></div></div>
        ${m ? `<div class="winbar"><div style="width:${wp(A)}%;background:${esc(A.color)}"><span>${esc(A.abbr)} ${wp(A)}%</span></div><div style="width:${100 - wp(A)}%;background:${esc(B.color)}"><span>${esc(B.abbr)} ${100 - wp(A)}%</span></div></div>` : ''}</div>
    </div>
    <div class="show-grid">${watch(A)}${watch(B)}</div>
    ${pollCard(db, g, req)}
    ${open ? `<a class="card show-pick" href="/pickem">${icon('coin')}<div><b>Lock in your ${esc(b.name)} picks</b><span>Winner, player TDs and combos with your MFL coins. Picks lock at kickoff.</span></div>${icon('arrow')}</a>` : ''}
  </div>`;
}
app.get('/playoffs/:slug', (req, res) => {
  const db = load();
  const b = db.bowls.find((x) => x.slug === req.params.slug);
  if (!b) return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Bowl not found')));
  const g = db.games.find((x) => x.bowl === b.slug);
  const champ = g && winner(g) ? db.teams[winner(g)] : null;
  const th = BOWL_THEMES[b.slug] || { cls: 'super', fx: ['⭐'], tag: 'MFL Postseason' };
  const A = g && db.teams[g.home], B = g && db.teams[g.away];
  const fx = Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 53) % 100}%;animation-delay:-${(i * 1.7) % 9}s;animation-duration:${8 + (i % 5) * 2}s;font-size:${16 + (i % 4) * 8}px">${th.fx[i % th.fx.length]}</i>`).join('');
  const open = g && pk.isOpen(db, g, TZ);
  res.send(layout(req, b.name, `
    <section class="bowl-hero ${th.cls}"><div class="bowl-fx" aria-hidden="true">${fx}</div><div class="wrap">
      <div class="kicker">${icon('trophy')} MFL Postseason · ${esc(th.tag)}</div><h1>${esc(b.name)}</h1>
      ${A ? `<div class="bowl-match">${logo(A, 84)}<div class="bowl-mid">${g && isFinal(g) ? `<b>${g.homeScore}–${g.awayScore}</b><small>Final</small>` : '<b>VS</b>'}</div>${logo(B, 84)}</div>` : ''}
      <p>${icon('cal')} ${esc(longDate(g?.date || b.date))} &nbsp; ${icon('clock')} ${g?.date ? time12(g.time) : 'Time TBD'} &nbsp; ${icon('pin')} ${VENUE}</p>
      ${g ? countdown(g) : ''}
      ${open ? `<a class="btn bowl-cta" href="/pickem">${icon('coin')} Make picks for the ${esc(b.name)}</a>` : ''}
    </div></section>
    <div class="wrap">
      ${champ ? `<div class="champ" style="--a:${esc(champ.color)}">${logo(champ, 88)}<div><div class="kicker">${esc(b.name)} Champions</div><h2>${esc(teamFull(champ))}</h2></div></div>` : ''}
      ${g && isFinal(g) ? recapCard(db, g) : g && g.status !== 'postponed' ? bowlShow(db, b, g, req) : ''}
      <div class="bowl-grid">
        <div class="card"><div class="card-h"><h2>The Matchup</h2></div>${g ? gameCard(db, g) : ''}</div>
        <div class="card"><div class="card-h"><h2>All Bowls</h2></div><ol class="road">
        ${db.bowls.map((x) => { const gg = db.games.find((y) => y.bowl === x.slug); const wn = gg && winner(gg) ? db.teams[winner(gg)] : null;
          return `<li class="${gg && isFinal(gg) ? 'done' : ''} ${x.slug === b.slug ? 'cur' : ''}"><a href="/playoffs/${x.slug}"><span class="road-dot"></span><div><b>${(BOWL_THEMES[x.slug]?.fx[0] || '') + ' '}${esc(x.name)}</b><small>${esc(gg?.date ? shortDate(gg.date) : 'Date TBD')}${gg && isFinal(gg) ? ` · ${Math.max(gg.homeScore, gg.awayScore)}–${Math.min(gg.homeScore, gg.awayScore)}` : gg?.status === 'postponed' ? ' · Postponed' : ''}</small></div>${wn ? `<span class="road-w">${logo(wn, 22)} ${esc(wn.abbr)}</span>` : ''}</a></li>`; }).join('')}
        </ol></div>
      </div>
    </div>${countdownScript}`));
});

// Anyone can ask for a fresh team recap, at most once every 5 minutes per team.
app.post('/teams/:id/recap', async (req, res) => {
  const db = load();
  const tm = db.teams[req.params.id];
  if (!tm) return res.redirect('/');
  const back = (q) => res.redirect(`/teams/${tm.id}${q ? '?' + q : ''}#recap`);
  if (!ai.apiKey()) return back('ai=off');
  const last = Date.parse(db.teamRecaps?.[tm.id]?.at || 0);
  if (Date.now() - last < TEAM_COOLDOWN) return back('ai=wait');
  try { await genTeamRecap(tm.id); back(''); } catch (e) { console.error('Team recap:', e); back('ai=err'); }
});

app.get('/teams/:id', (req, res) => {
  const db = load();
  const tm = db.teams[req.params.id];
  if (!tm) return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Team not found')));
  const s = teamStats(db, tm.id);
  const games = db.games.filter((g) => g.home === tm.id || g.away === tm.id);
  const done = games.filter(isFinal).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const upcoming = games.filter((g) => g.date && g.date >= today() && g.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const leaders = playerLeaders(db).filter((p) => p.team === tm.id);
  const lead = (k) => [...leaders].sort((x, y) => y[k] - x[k])[0];
  const TR = db.teamRecaps?.[tm.id];
  const wait = TR ? Math.max(0, TEAM_COOLDOWN - (Date.now() - Date.parse(TR.at))) : 0;
  const ago = TR ? Math.round((Date.now() - Date.parse(TR.at)) / 60000) : 0;
  const msg = { off: 'AI recaps are not set up yet.', wait: 'Hold on, this recap was just updated. Try again in a few minutes.', err: "Couldn't write a new recap right now. Try again soon." }[req.query.ai];
  const recapBox = TR || ai.apiKey() ? `<div class="card team-recap" id="recap"><div class="card-h"><h2>${icon('star')} Team Recap</h2>${TR ? `<span class="muted sm">AI · ${ago < 1 ? 'just now' : ago < 60 ? ago + ' min ago' : esc(shortDate(localDay(TR.at)))}</span>` : ''}</div>
    ${TR ? `<p>${esc(TR.text)}</p>` : '<p class="muted">No recap yet. Tap below to write one.</p>'}
    ${msg ? `<p class="muted sm">${msg}</p>` : ''}
    ${ai.apiKey() ? `<form method="post" action="/teams/${tm.id}/recap" class="recap-go"><button class="btn sm ghost" ${wait ? 'disabled' : ''} onclick="this.textContent='Writing…'">${icon('swap')} ${wait ? `Regenerate in ${Math.ceil(wait / 60000)} min` : 'Regenerate'}</button></form>` : ''}</div>` : '';
  res.send(layout(req, teamFull(tm), `
    <section class="th-hero" style="--a:${esc(tm.color)};--b:${esc(tm.color2)}"><div class="wrap">${logo(tm, 132, 'big')}
      <div><div class="kicker">${esc(tm.city)}</div><h1>${esc(tm.name)}</h1>
      <div class="th-stats"><div><b>${record(s)}</b><small>Record</small></div><div><b>${s.pf}</b><small>Points</small></div><div><b>${s.td}</b><small>TDs</small></div><div><b>${s.int}</b><small>INTs</small></div><div><b>${s.streak || '–'}</b><small>Streak</small></div></div></div></div></section>
    <div class="wrap home-grid">
      <div class="col">
        ${recapBox}
        <div class="card"><div class="card-h"><h2>Roster</h2><span class="muted sm">Captain: ${esc(tm.captain)}</span></div><div class="roster">
          ${tm.roster.map((p) => `<a class="pl" href="${playerUrl(tm, p)}">${avatar(tm, p, 46)}<div><b>${p.number ? `<span class="num">#${esc(p.number)}</span> ` : ''}${esc(p.name)}</b><small>${esc([p.position, tagName(p.tag)].filter(Boolean).join(' · '))}</small></div></a>`).join('')}
        </div></div>
        <div class="card"><div class="card-h"><h2>Recent Results</h2></div><div class="list">${done.map((g) => gameCard(db, g)).join('') || '<p class="muted">No games yet.</p>'}</div></div>
      </div>
      <div class="col">
        <div class="card"><div class="card-h"><h2>Team Leaders</h2></div>
          ${[['td', 'Touchdowns'], ['ptd', 'Passing TDs'], ['int', 'Interceptions']].map(([k, n]) => { const p = lead(k); return `<div class="leader"><span class="av" style="background:${esc(tm.color)};color:${readableOn(tm.color)}">${p && p[k] ? initials(p.name) : '–'}</span><div><small>${n}</small><b>${p && p[k] ? playerLink(tm, p.name) : 'No leader yet'}</b></div><span class="leader-n">${p && p[k] ? p[k] : ''}</span></div>`; }).join('')}</div>
        <div class="card"><div class="card-h"><h2>Upcoming</h2><a href="/schedule">Schedule ${icon('arrow')}</a></div><div class="list">${upcoming.map((g) => gameCard(db, g)).join('') || '<p class="muted">Nothing scheduled.</p>'}</div></div>
        ${(db.transactions || []).some((t) => t.team === tm.id || t.team2 === tm.id) ? `<div class="card"><div class="card-h"><h2>Transactions</h2><a href="/transactions">All ${icon('arrow')}</a></div>${[...db.transactions].filter((t) => t.team === tm.id || t.team2 === tm.id).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5).map((t) => txLine(db, t)).join('')}</div>` : ''}
      </div>
    </div>`));
});

app.get('/stats/team', (req, res) => {
  const db = load();
  const [A, B] = Object.values(db.teams);
  const sA = teamStats(db, A.id), sB = teamStats(db, B.id);
  const per = (n, gp) => (gp ? +(n / gp).toFixed(1) : 0);
  const rows = [
    ['Wins', sA.w, sB.w], ['Points scored', sA.pf, sB.pf], ['Points / game', per(sA.pf, sA.gp), per(sB.pf, sB.gp)],
    ['Points allowed', sA.pa, sB.pa, true], ['Touchdowns', sA.td, sB.td], ['Interceptions', sA.int, sB.int],
    ['INTs thrown', sA.intThrown, sB.intThrown, true], ['Point differential', sA.diff, sB.diff], ['Bowl wins', sA.pw, sB.pw],
  ];
  const sgn = (label, v) => (v > 0 && label.includes('differential') ? '+' : '') + v;
  const bar = ([label, x, y, lowerBetter]) => {
    const tot = Math.abs(x) + Math.abs(y);
    const better = x === y ? 0 : (lowerBetter ? x < y : x > y) ? -1 : 1;
    const wa = tot ? (Math.abs(x) / tot) * 100 : 50;
    return `<div class="cmp"><b class="${better === -1 ? 'lead' : ''}">${sgn(label, x)}</b><div class="cmp-mid"><small>${label}</small><div class="cmp-bar"><div style="width:${wa}%;background:${esc(A.color)}"></div><div style="width:${100 - wa}%;background:${esc(B.color)}"></div></div></div><b class="${better === 1 ? 'lead' : ''}">${sgn(label, y)}</b></div>`;
  };
  res.send(layout(req, 'Team Stats', pageHead('2026–27 Season', 'Team Stats', 'Regular season + bowls. Exhibitions not counted.') + `<div class="wrap">
    <div class="card cmp-card">
      <div class="cmp-head"><a href="/teams/${A.id}">${logo(A, 56)}<b>${esc(A.name)}</b><small>${record(sA)}</small></a><span class="muted">Head to head</span><a href="/teams/${B.id}">${logo(B, 56)}<b>${esc(B.name)}</b><small>${record(sB)}</small></a></div>
      ${rows.map(bar).join('')}
    </div>
    <div class="card"><div class="card-h"><h2>Full Table</h2></div><div class="scroll"><table class="tbl"><thead><tr><th class="l">Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>PF</th><th>PA</th><th>DIFF</th><th>TD</th><th>INT</th><th>Bowl</th><th>Exh</th><th>Strk</th></tr></thead><tbody>
    ${[[A, sA], [B, sB]].map(([tm, s]) => `<tr><td class="l"><a class="th" href="/teams/${tm.id}">${logo(tm, 24)} ${esc(tm.name)}</a></td><td>${s.gp}</td><td>${s.w}</td><td>${s.l}</td><td>${s.t}</td><td>${s.pct}</td><td>${s.pf}</td><td>${s.pa}</td><td>${s.diff > 0 ? '+' : ''}${s.diff}</td><td>${s.td}</td><td>${s.int}</td><td>${s.pw}-${s.pl}</td><td>${s.exW}-${s.exL}</td><td>${s.streak || '–'}</td></tr>`).join('')}
    </tbody></table></div></div>
  </div>`));
});

// ---------- players ----------
function playerStats(db, tm, p) {
  const extra = Object.values(STATS).map((st) => st.key);
  const s = { td: 0, ptd: 0, int: 0, picked: 0, log: [], highlights: [] };
  for (const k of extra) s[k] = 0;
  const name = p.name.toLowerCase();
  const games = db.games.filter((g) => g.status === 'final').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const g of games) {
    const row = { g, td: 0, ptd: 0, int: 0, picked: 0, team: null };
    for (const k of extra) row[k] = 0;
    for (const e of g.events || []) {
      // Threw an interception (the INT row's "thrown by" is on the other team).
      if (e.type === 'INT' && (e.passer || '').toLowerCase() === name) {
        const mine = e.team === g.home ? g.away : g.home;
        if (!row.team || row.team === mine) { row.team = mine; row.picked++; }
        continue;
      }
      const hit = (e.player || '').toLowerCase() === name || (e.type === 'TD' && (e.passer || '').toLowerCase() === name);
      if (!hit || (row.team && row.team !== e.team)) continue;
      row.team = e.team;
      if ((e.player || '').toLowerCase() === name) {
        row[e.type === 'TD' ? 'td' : e.type === 'INT' ? 'int' : STATS[e.type].key]++;
        if (e.type === 'CATCH' || e.type === 'PLAY' || (e.note && e.type !== 'FLAG')) s.highlights.push({ g, e });
      }
      if (e.type === 'TD' && (e.passer || '').toLowerCase() === name) row.ptd++;
    }
    if (['td', 'ptd', 'int', 'picked', ...extra].some((k) => row[k])) {
      s.log.push(row);
      for (const k of ['td', 'ptd', 'int', 'picked', ...extra]) s[k] += row[k];
    }
  }
  return s;
}

app.get('/players/:team/:pid', (req, res) => {
  const db = load();
  const tm = db.teams[req.params.team];
  const p = tm?.roster.find((x) => x.id === req.params.pid);
  if (!p) {
    const moved = Object.values(db.teams).find((t) => t.roster.some((x) => x.id === req.params.pid));
    if (moved) return res.redirect(`/players/${moved.id}/${req.params.pid}`);
    return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Player not found')));
  }
  const s = playerStats(db, tm, p);
  const rt = ratings(db).find((x) => x.t.id === tm.id && x.p.id === p.id);
  const opp = (g, t) => db.teams[g.home === t ? g.away : g.home];
  const mates = tm.roster.filter((x) => x.id !== p.id);
  const facts = [['Number', p.number && '#' + p.number], ['Position', p.position], ['Grade', p.grade], ['Status', tagName(p.tag)]].filter(([, v]) => v);
  res.send(layout(req, p.name, `
    <section class="pp-hero" style="--a:${esc(tm.color)};--b:${esc(tm.color2)}"><div class="wrap">
      <div class="pp-photo">${avatar(tm, p, 220, 'xl')}${p.number ? `<span class="pp-num">${esc(p.number)}</span>` : ''}</div>
      <div class="pp-info">
        <a class="pp-team" href="/teams/${tm.id}">${logo(tm, 26)} ${esc(teamFull(tm))}</a>
        <h1>${esc(p.name)}</h1>
        <div class="pp-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="th-stats">${rt ? `<a class="rt-big ${tier(rt.r)}" href="/players/${tm.id}/${p.id}/card" title="Power rating · see trading card"><b>${rt.r}</b><small>Rating</small></a>` : ''}<div><b>${s.td}</b><small>TDs</small></div><div><b>${s.ptd}</b><small>Pass TDs</small></div><div><b>${s.int}</b><small>INTs</small></div><div><b>${rt ? rt.mvp : 0}</b><small>MVPs</small></div>${Object.values(STATS).filter((st) => s[st.key]).map((st) => `<div><b>${s[st.key]}</b><small>${st.short}</small></div>`).join('')}</div>${rt?.ai ? `<p class="ai-take">${icon('star')} ${esc(rt.ai)}</p>` : ''}
        <a class="card-link" href="/players/${tm.id}/${p.id}/card">${icon('star')} View trading card</a> <a class="card-link" href="/picks/${tm.id}/${p.id}">${icon('coin')} Picks for ${esc(p.name.split(' ')[0])}</a>
      </div>
    </div></section>
    <div class="wrap home-grid">
      <div class="col">
        <div class="card"><div class="card-h"><h2>Bio</h2></div>${p.bio ? `<div class="bio">${esc(p.bio).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>')}</p></div>` : '<p class="muted">No bio yet.</p>'}</div>
        <div class="card"><div class="card-h"><h2>Game Log</h2></div>${s.log.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th>Result</th><th>TD</th><th>Pass TD</th><th>INT</th><th>Picked off</th><th class="l">Other</th></tr></thead><tbody>
          ${s.log.map(({ g, td, ptd, int, picked, team, ...row }) => { const other = Object.values(STATS).filter((st) => row[st.key]).map((st) => `${row[st.key]} ${st.short.toLowerCase()}`).join(', '); const o = opp(g, team); const mine = g.home === team ? g.homeScore : g.awayScore; const theirs = g.home === team ? g.awayScore : g.homeScore; const r = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
            return `<tr><td class="l"><a href="/games/${g.id}">${esc(shortDate(g.date))}</a>${gameLabel(db, g) ? ` <span class="tag ${g.type}">${esc(gameLabel(db, g))}</span>` : ''}</td><td class="l"><span class="th">${logo(o, 22)} ${esc(o.name)}</span></td><td><span class="res ${r}">${r}</span> ${mine}–${theirs}</td><td>${td || '–'}</td><td>${ptd || '–'}</td><td>${int || '–'}</td><td>${picked ? `<span class="down">${picked}</span>` : '–'}</td><td class="l">${esc(other) || '–'}</td></tr>`; }).join('')}
          </tbody></table></div><p class="muted sm">Totals include exhibition games.</p>` : '<p class="muted">No stats recorded yet.</p>'}</div>
        ${s.highlights.length ? `<div class="card"><div class="card-h"><h2>${icon('fire')} Highlights</h2></div><ol class="plays">${s.highlights.map(({ g, e }) => { const [cls, label] = playTag(e); return `<li style="--c:${esc(tm.color)}"><div><span class="tag ${cls}">${label}</span> <a class="muted sm" href="/games/${g.id}">${esc(shortDate(g.date))}</a><p>${playLine(db, g, e)}</p></div></li>`; }).join('')}</ol></div>` : ''}
      </div>
      <div class="col">
        ${p.aiScout ? `<div class="card scout"><div class="card-h"><h2>Scouting report</h2><span class="muted sm">AI</span></div><p>${esc(p.aiScout.report)}</p>
          <div class="scout-cols"><div><small>Strengths</small><ul>${p.aiScout.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${p.aiScout.grow.length ? `<div><small>Areas to grow</small><ul>${p.aiScout.grow.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>
          ${p.aiScout.comparison ? `<p class="scout-cmp">${icon('star')} ${esc(p.aiScout.comparison)}</p>` : ''}</div>` : ''}
        ${(() => { const bs = badges.playerBadges(db, tm, p, (g) => mvpKeyOf(db, g)); return `<div class="card"><div class="card-h"><h2>Achievements</h2><span class="muted sm">${bs.length} of ${badges.PLAYER_BADGES.length}</span></div>${bs.length ? `<div class="achv">${bs.map(([, e, n, d]) => `<div class="achv-b" title="${esc(d)}"><span>${e}</span><b>${esc(n)}</b><small>${esc(d)}</small></div>`).join('')}</div>` : '<p class="muted sm">No badges yet. Hat tricks, pick-sixes, MVPs and more unlock them.</p>'}</div>`; })()}
        <div class="card"><div class="card-h"><h2>Teammates</h2><a href="/teams/${tm.id}">Team ${icon('arrow')}</a></div><div class="mates">
          ${mates.map((m) => `<a class="mate" href="${playerUrl(tm, m)}">${avatar(tm, m, 36)}<div><b>${esc(m.name)}</b><small>${esc([m.position, tagName(m.tag)].filter(Boolean).join(' · '))}</small></div></a>`).join('')}
        </div></div>
      </div>
    </div>`));
});

// ---------- pick'em ----------
const USER_COOKIE = 'mfl_user';
function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]; }));
}
function currentUser(req) {
  const v = readCookies(req)[USER_COOKIE];
  if (!v) return null;
  const [name, exp, sig] = v.split('.');
  if (!name || !exp || !sig || Number(exp) < Date.now()) return null;
  const good = sign('u:' + name + ':' + exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? name : null;
}
const DAY = 24 * 3600 * 1000;
const SESSION_DAYS = 365;
const secureFlag = (req) => (req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '');
function setUserCookie(req, res, name) {
  const exp = String(Date.now() + SESSION_DAYS * DAY);
  res.append('Set-Cookie', `${USER_COOKIE}=${name}.${exp}.${sign('u:' + name + ':' + exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secureFlag(req)}`);
}
function setAdminCookie(req, res) {
  const exp = String(Date.now() + SESSION_DAYS * DAY);
  res.append('Set-Cookie', `mfl_admin=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}${secureFlag(req)}`);
}
const userKey = (name) => 'users/' + name;
const signed = (n) => `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US')}`;
const coins = (n) => `<span class="coins">${icon('coin')}${Number(n).toLocaleString('en-US')}</span>`;
const oddsTxt = (d) => pk.mult(d);
// Picks a "combo" button adds to the slip (the slip calls the reward multiplier m).
const legsAttr = (legs) => esc(JSON.stringify(legs.map((l) => ({ game: l.game, key: l.key, label: l.label, m: l.odds, match: l.match }))));
function matchName(db, g) { return `${db.teams[g.home].abbr} vs ${db.teams[g.away].abbr}`; }

function oddsBtn(db, g, m, cls = '') {
  return `<button type="button" class="ob ${cls}" data-game="${g.id}" data-key="${esc(m.key)}" data-label="${esc(m.label)}" data-m="${m.odds}" data-match="${esc(matchName(db, g))}"><span>${esc(m.label)}</span><b>${oddsTxt(m.odds)}</b></button>`;
}
function openGames(db) {
  const g = pk.nextGame(db, TZ);
  return g ? [g] : [];
}

// Pick slip: lives in the browser until submitted; the server re-prices every pick.
function slip(user) {
  return `<div class="slip-bg" id="slipBg" onclick="mflSlip.fold(true)"></div>
  <aside class="slip min" id="slip" hidden>
    <button class="slip-head" type="button" onclick="mflSlip.fold()"><b>Pick slip</b><span id="slipCount">0</span><span id="slipKind" class="muted"></span><span class="slip-q" id="slipQuick"></span>${icon('chev')}</button>
    <div class="slip-body">
      <div id="slipLegs"></div>
      <label class="slip-amt">Coins<input type="number" id="slipAmt" min="${pk.MIN_STAKE}" step="10" value="50" inputmode="numeric"></label>
      <div class="slip-sum"><span>Reward <b id="slipMult">–</b></span><span>You'd get <b id="slipWin">–</b></span></div>
      ${user ? '<button class="btn slip-go" id="slipGo" type="button">Lock it in</button>' : '<a class="btn slip-go" href="/pickem/login?next=/pickem">Log in to play</a>'}
      <p class="slip-msg" id="slipMsg"></p>
      <button type="button" class="slip-clear" onclick="mflSlip.clear()">Clear slip</button>
    </div>
  </aside>
  <script>
  const mflSlip = (() => {
    const KEY = 'mfl_slip';
    let legs = []; try { legs = (JSON.parse(localStorage.getItem(KEY)) || []).map((l) => ({ ...l, m: l.m || l['od' + 'ds'] })); } catch {}
    const el = (id) => document.getElementById(id);
    const mx = (d) => d >= 2 ? '+' + Math.round((d - 1) * 100) : '-' + Math.round(100 / (d - 1));
    const store = () => { try { localStorage.setItem(KEY, JSON.stringify(legs)); } catch {} };
    // Phones: the slip is a bar at the bottom that opens into a sheet. Desktop: a panel.
    const phone = () => matchMedia('(max-width: 760px)').matches;
    function fold(min = !el('slip').classList.contains('min')) {
      el('slip').classList.toggle('min', min);
      el('slipBg').classList.toggle('on', !min && phone() && legs.length > 0);
      document.body.classList.toggle('has-slip', legs.length > 0);
    }
    // Adding a pick: phones just bump the bar; desktop opens the panel.
    function opened() { if (phone()) { el('slip').classList.remove('bump'); void el('slip').offsetWidth; el('slip').classList.add('bump'); } else fold(false); }
    function render() {
      document.querySelectorAll('.ob').forEach((b) => b.classList.toggle('on', legs.some((l) => l.game === b.dataset.game && l.key === b.dataset.key)));
      document.querySelectorAll('.combo').forEach((c) => c.classList.toggle('on', JSON.parse(c.dataset.legs).every((x) => legs.some((l) => l.game === x.game && l.key === x.key))));
      el('slip').hidden = !legs.length;
      el('slipCount').textContent = legs.length;
      el('slipKind').textContent = legs.length > 1 ? legs.length + '-pick combo' : 'Single';
      el('slipLegs').innerHTML = legs.map((l, i) => '<div class="sl"><div><small>' + l.match + '</small><b>' + l.label + '</b></div><span>' + mx(l.m) + '</span><button type="button" onclick="mflSlip.remove(' + i + ')" aria-label="Remove">✕</button></div>').join('');
      const m = legs.reduce((x, l) => x * l.m, 1), amt = Math.floor(+el('slipAmt').value || 0);
      el('slipMult').textContent = legs.length ? mx(m) : '–';
      el('slipWin').textContent = legs.length && amt ? Math.floor(amt * m).toLocaleString() : '–';
      el('slipQuick').textContent = legs.length ? mx(m) : '';
      fold(el('slip').classList.contains('min'));
    }
    document.addEventListener('click', (e) => {
      // Ready-made combos: add every pick (or take them all back out if already in the slip).
      const c = e.target.closest('.combo');
      if (c) {
        const cl = JSON.parse(c.dataset.legs);
        const has = (x) => legs.some((l) => l.game === x.game && l.key === x.key);
        if (cl.every(has)) legs = legs.filter((l) => !cl.some((x) => x.game === l.game && x.key === l.key));
        else if (legs.length + cl.filter((x) => !has(x)).length > ${pk.MAX_LEGS}) { el('slipMsg').textContent = 'That would go over ${pk.MAX_LEGS} picks.'; el('slip').hidden = false; return; }
        else cl.filter((x) => !has(x)).forEach((x) => legs.push(x));
        el('slipMsg').textContent = ''; opened(); store(); render();
        return;
      }
      const b = e.target.closest('.ob'); if (!b) return;
      const i = legs.findIndex((l) => l.game === b.dataset.game && l.key === b.dataset.key);
      if (i >= 0) legs.splice(i, 1);
      else if (legs.length >= ${pk.MAX_LEGS}) { el('slipMsg').textContent = 'Max ${pk.MAX_LEGS} picks per combo.'; }
      else legs.push({ game: b.dataset.game, key: b.dataset.key, label: b.dataset.label, m: +b.dataset.m, match: b.dataset.match });
      el('slipMsg').textContent = ''; opened(); store(); render();
    });
    el('slipAmt').addEventListener('input', render);
    const go = el('slipGo');
    if (go) go.addEventListener('click', async () => {
      go.disabled = true; el('slipMsg').textContent = 'Locking in…'; el('slipMsg').className = 'slip-msg';
      try {
        const r = await fetch('/pickem/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks: legs.map((l) => ({ game: l.game, key: l.key })), amount: +el('slipAmt').value }) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error);
        legs = []; store(); render();
        el('slip').hidden = false; el('slip').classList.remove('min'); el('slipMsg').className = 'slip-msg good';
        el('slipMsg').innerHTML = 'Locked in! You could get ' + d.toWin.toLocaleString() + ' coins. <a href="/pickem/me">My picks →</a>';
        document.querySelectorAll('[data-balance]').forEach((n) => n.textContent = d.balance.toLocaleString());
      } catch (err) { el('slipMsg').className = 'slip-msg bad'; el('slipMsg').textContent = err.message || 'Something went wrong.'; }
      go.disabled = false;
    });
    render();
    return { remove(i) { legs.splice(i, 1); store(); render(); }, clear() { legs = []; store(); render(); }, fold };
  })();
  </script>`;
}

// The game MVP as "team|playerId" (for card scoring and badges).
// Cached for a few seconds: points for every user look up every game's MVP.
let mvpMemo = { at: 0, map: new Map() };
function mvpKeyOf(db, g) {
  if (Date.now() - mvpMemo.at > 3000) mvpMemo = { at: Date.now(), map: new Map() };
  const sig = g.id + '|' + g.homeScore + '-' + g.awayScore + '|' + (g.events || []).length + '|' + (g.aiRecap?.at || '');
  if (!mvpMemo.map.has(sig)) { const m = gameMvp(db, g); mvpMemo.map.set(sig, m?.player ? `${m.team}|${m.player.id}` : null); }
  return mvpMemo.map.get(sig);
}
async function survivorNow(db) {
  return sv.survivorState(db, await listDocs('users/'), TZ);
}
// Coins are the one currency. Besides picks, they come from the Starting 8 card
// game, Survivor wins and selling cards, and they buy packs. All worked out live.
// Packs bought before coins paid for them (the old Points) aren't charged.
const ACHIEVEMENT_COINS = 150;
function coinExtras(db, user, svState) {
  const fan = cards.fantasy(db, user, (g) => mvpKeyOf(db, g));
  const survivor = svState ? sv.survivorPoints(svState, user.name) : 0;
  const bonus = (user.pointBonuses || []).reduce((s, b) => s + b.amount, 0);
  const spent = (user.packs || []).filter((p) => p.currency === 'coins').reduce((s, p) => s + (p.cost || 0), 0);
  // Arcade games, daily challenges, game-day check-ins and achievements (arcade.js).
  const ar = arcadeApi ? arcadeApi.arcadeCoins(user) : { arcade: 0, challenges: 0, checkins: 0 };
  const badgesWon = badges.userBadges({ db, acct: pk.account(db, user), user, weeklyWins: 0, survivorWins: survivor / sv.PRIZE, fantasy: fan }).length;
  const achieve = badgesWon * ACHIEVEMENT_COINS;
  const extra = ar.arcade + ar.challenges + ar.checkins + achieve;
  return { fantasy: fan.total, fan, survivor, bonus, spent, arcade: ar.arcade, challenges: ar.challenges, checkins: ar.checkins, achieve, net: fan.total + survivor + bonus - spent + extra };
}
let arcadeApi = null;
function accountOf(db, user, svState) {
  const x = coinExtras(db, user, svState);
  const acct = pk.account(db, user, x.net);
  acct.points = { ...x, picks: acct.profit, balance: acct.balance };
  return acct;
}
async function loadAccount(db, name) {
  const user = name ? await getDoc(userKey(name)) : null;
  if (!user) return { user: null, acct: null };
  return { user, acct: accountOf(db, user, await survivorNow(db)) };
}
// Pick'em and MFL Cards are separate sections, each with its own tab bar.
const CARD_PAGES = /^\/pickem\/(cards|packs|trades?|collectors|collection)(\/|$)/;
function pickNav(cur, name) {
  const items = CARD_PAGES.test(cur)
    ? [['/pickem/cards', 'My cards'], ['/pickem/packs', 'Packs'], ['/pickem/trades', 'Trades'], ['/pickem/collectors', 'Collectors']]
    : [['/pickem', 'Games'], ['/pickem/me', 'My picks'], ['/pickem/survivor', 'Survivor'], ['/pickem/leaderboard', 'Leaderboard'], ['/pickem/rules', 'How it works']];
  return `<div class="seg sec-nav">${items.map(([h, n]) => `<a class="${cur === h ? 'on' : ''}" href="${h}">${n}</a>`).join('')}</div>`;
}
const pts = (n) => `<span class="bpts">${icon('star')}${Number(n).toLocaleString('en-US')}</span>`;
function pickHead(user, acct, mode) {
  const cardsMode = mode === 'cards';
  return `<section class="ph pick-ph ${cardsMode ? 'cards-ph' : ''}"><div class="wrap pick-top">
    ${cardsMode ? `<div><div class="kicker">${icon('star')} Collect · trade · play</div><h1>MFL Cards</h1><p>Open packs, set your Starting 8 and trade cards with other collectors.</p></div>`
      : `<div><div class="kicker">${icon('coin')} Prediction game · MFL coins</div><h1>Pick'em</h1><p>Predict what happens in every MFL game with MFL coins: winners, player picks and combos.</p></div>`}
    ${user ? `<div class="wallet"><small>@${esc(user.name)}</small><b>${icon('coin')}<span data-balance>${acct.balance.toLocaleString('en-US')}</span></b><span>${cardsMode ? `${Object.keys(cards.collection(user)).length} different cards` : `${acct.won}W · ${acct.lost}L · ${acct.pending} open `}</span></div>`
      : `<div class="wallet cta"><b>Start with ${pk.START_COINS.toLocaleString()} coins</b><div><a class="btn" href="/pickem/signup">Sign up</a> <a class="btn ghost" href="/pickem/login">Log in</a></div></div>`}
  </div></section>`;
}
function betCard(db, b, opts = {}) {
  const st = { won: 'Won', lost: 'Lost', void: 'Refunded', pending: 'Open' }[b.status];
  return `<div class="tkt ${b.status}">
    <div class="tkt-h">${opts.who ? `<a href="/pickem/u/${esc(opts.who)}"><b>@${esc(opts.who)}</b></a>` : `<b>${b.legs.length > 1 ? b.legs.length + '-pick combo' : 'Single'}</b>`}<span class="tkt-st">${st}</span></div>
    ${b.legs.map((l, i) => { const g = db.games.find((x) => x.id === l.game); const r = b.res[i];
      const label = l.key.startsWith('spr:') ? pk.marginLabel(db.teams[l.key.split(':')[1]]?.name || '', Math.sign(Number(l.key.split(':')[2])) * pk.SPREAD) : l.label;
      const [lt, la, lb] = l.key.split(':'), out = lt.startsWith('p') && pk.isOut(g, la, lb);
      return `<div class="tkt-leg ${r}"><i></i><div><b>${esc(label)}</b><small>${g ? `${esc(matchName(db, g))} · ${esc(shortDate(g.date))}` : 'Game removed'}${out ? ' · <span class="out-note">Player out, pick removed</span>' : ''}</small></div><span>${oddsTxt(l.odds)}</span></div>`; }).join('')}
    <div class="tkt-f"><span>Played ${coins(b.stake)} at ${oddsTxt(b.odds)}</span><span>${b.status === 'won' ? `Won ${coins(b.payout)}` : b.status === 'void' ? `Refunded ${coins(b.payout)}` : b.status === 'lost' ? 'Lost' : `Could get ${coins(Math.floor(b.stake * b.odds))}`}</span></div>
    ${opts.owner && b.id ? `<div class="tkt-x"><a href="${betLink(opts.owner, b)}">View</a>${shareBtn(opts.owner, b)}</div>` : ''}
  </div>`;
}
async function leaderboard(db) {
  const users = await listDocs('users/');
  const st = sv.survivorState(db, users, TZ);
  return users.map((u) => { const a = accountOf(db, u, st); return { name: u.name, ...a }; }).sort((a, b) => b.balance - a.balance || b.won - a.won);
}

// Compact odds button for player cards: short text on the button, full label in the slip.
function propBtn(db, g, m, short) {
  if (!m) return `<span class="pb off"><span>${short}</span><b>–</b></span>`;
  return `<button type="button" class="ob pb" data-game="${g.id}" data-key="${esc(m.key)}" data-label="${esc(m.label)}" data-m="${m.odds}" data-match="${esc(matchName(db, g))}"><span>${short}</span><b>${oddsTxt(m.odds)}</b></button>`;
}
const lockTs = (g) => kickoffTs({ ...g, time: pk.lockTime(g) });

// ---------- pick'em: featured star bets ----------
// Stars = captains, team reps and the 2 hottest other players per team (by tendency).
// Which bets and parlays get featured is reshuffled for every game.
const STAR_SHORT = { ptd: 'Scores a TD', p2td: '2+ TDs', p3td: 'Hat trick', pfirst: 'First TD', ppass: 'Throws a TD', p2pass: '2+ TD passes', pdual: 'Score + throw', pint: 'Gets an INT', pint_td: 'INT + TD' };
function seeded(seed) {
  let a = [...String(seed)].reduce((x, c) => (x * 31 + c.charCodeAt(0)) | 0, 9);
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// QB / defense / playmaker: the saved position wins; otherwise go by which of
// throwing, picks or scoring the player does most (stats + effective tendencies).
function playerRole(db, t, p, et = pk.effTend(db)) {
  const pos = String(p.position || '').toUpperCase();
  if (/\bQB\b|QUARTERBACK|PASSER/.test(pos)) return 'qb';
  if (/\b(DB|CB|S|LB|DL|DE)\b|SAFETY|CORNER|LINEBACK|DEF|RUSH/.test(pos)) return 'def';
  if (pos) return 'skill';
  const s = playerStats(db, t, p);
  const score = { qb: et.player(t, p, 'pass') + 8 * s.ptd, def: et.player(t, p, 'int') + 8 * s.int, skill: et.player(t, p, 'td') + 8 * s.td };
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] > score.skill + 2 ? best[0] : 'skill';
}
function featured(db, g, m) {
  const k = m.byKey, et = pk.effTend(db), r = seeded('feat:' + g.id + ':' + g.date);
  const stars = [];
  for (const t of [db.teams[g.home], db.teams[g.away]]) {
    const named = t.roster.filter((p) => p.tag === 'C' || p.tag === 'TR');
    const heat = (p) => Math.max(et.player(t, p, 'td'), et.player(t, p, 'pass'), et.player(t, p, 'int'));
    const hot = t.roster.filter((p) => !named.includes(p)).sort((a, b) => heat(b) - heat(a)).slice(0, 2);
    for (const p of named) stars.push({ t, p, role: p.tag === 'C' ? 'Captain' : 'Team Rep' });
    for (const p of hot) stars.push({ t, p, role: 'Hot' });
  }
  const leg = (key) => (k[key] ? { game: g.id, key, label: k[key].label, odds: k[key].odds, match: matchName(db, g) } : null);
  const opp = (t) => db.teams[t.id === g.home ? g.away : g.home];
  const spr = (t) => m.list.find((x) => x.group === 'Margin' && x.team === t.id);

  // Star cards show bets that fit the player's role: QBs get throwing bets, defenders
  // get INT bets, everyone else gets scoring bets. Each role has a fixed headline bet
  // plus rotating picks from its pool, and a "<headline> + team wins" combo.
  for (const s of stars) s.role2 = playerRole(db, s.t, s.p, et);
  const ROLE_BETS = {
    qb: { main: 'ppass', pool: ['p2pass', 'pdual', 'ptd', 'pfirst', 'pint'], combo: 'Throws a TD' },
    def: { main: 'pint', pool: ['pint_td', 'ptd', 'pfirst', 'p2td'], combo: 'Gets an INT' },
    skill: { main: 'ptd', pool: ['p2td', 'p3td', 'pfirst', 'pdual', 'pint_td'], combo: 'TD' },
  };
  const cards = stars.map((s) => {
    const pre = (mk) => `${mk}:${s.t.id}:${s.p.id}`;
    const rb = ROLE_BETS[s.role2];
    const rest = shuffle(rb.pool.filter((mk) => k[pre(mk)]), r).slice(0, 5);
    return { ...s, bets: [rb.main, ...rest].map((mk) => ({ m: k[pre(mk)], short: STAR_SHORT[mk] })), comboName: rb.combo, combo: [leg(pre(rb.main)), leg(`ml:${s.t.id}`)].filter(Boolean) };
  });

  // Ready-made star parlays. Rules that keep them good:
  //  - every player pick fits the player's role (QBs throw, defenders pick, playmakers score)
  //  - no near-locks or near-impossible player picks, and the whole ticket pays +200 to +4000
  //  - at most one "who wins" pick per ticket, and no player on more than 3 tickets
  const C = [];
  const add = (title, tag, keys) => {
    const legs = keys.map(leg);
    if (!legs.every(Boolean)) return;
    const playerOk = keys.every((key) => !/^p/.test(key) || (k[key].p >= 0.1 && k[key].p <= 0.75));
    const odds = legs.reduce((x, l) => x * l.odds, 1);
    const players = keys.filter((key) => /^p/.test(key)).map((key) => key.split(':').slice(1).join(':'));
    if (playerOk && odds >= 2.5 && odds <= 61) C.push({ title, tag, legs, players });
  };
  // First names on tickets, unless two stars share one (e.g. two Maddoxes).
  const firsts = stars.map((x) => x.p.name.split(' ')[0].toLowerCase());
  const first = (n) => (firsts.filter((f) => f === n.split(' ')[0].toLowerCase()).length > 1 ? n : n.split(' ')[0]);
  const byTeam = (t) => stars.filter((s) => s.t.id === t.id);
  const R = {
    qb: { main: 'ppass', big: 'p2pass', verb: 'throws a TD', both: 'both throw a TD', bigVerb: 'throws 2+ TDs' },
    def: { main: 'pint', big: 'pint_td', verb: 'gets a pick', both: 'both get a pick', bigVerb: 'gets a pick-six (INT + TD)' },
    skill: { main: 'ptd', big: 'p2td', verb: 'scores', both: 'both score', bigVerb: 'scores 2+ TDs' },
  };
  const key = (s, which = 'main') => `${R[s.role2][which]}:${s.t.id}:${s.p.id}`;
  const verb = (s) => R[s.role2].verb;
  for (const t of [db.teams[g.home], db.teams[g.away]]) {
    const ss = byTeam(t), o = opp(t);
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
      const [a, b] = [ss[i], ss[j]];
      const qb = [a, b].find((x) => x.role2 === 'qb'), other = qb === a ? b : a;
      if (a.role2 === b.role2) add(`${first(a.p.name)} & ${first(b.p.name)} ${R[a.role2].both}`, { qb: 'Air raid', def: 'Lockdown', skill: 'Duo' }[a.role2], [key(a), key(b)]);
      else if (qb && other.role2 === 'skill') {
        add(`${first(qb.p.name)} throws, ${first(other.p.name)} scores`, 'Connection', [key(qb), key(other)]);
        add(`${first(qb.p.name)} to ${first(other.p.name)} & ${t.name} win`, 'Stack', [key(qb), key(other), `ml:${t.id}`]);
      }
      else add(`${first(a.p.name)} ${verb(a)} & ${first(b.p.name)} ${verb(b)}`, 'Two-way', [key(a), key(b)]);
    }
    // Three-pick team stacks: one per role where possible (QB throws, playmaker scores, defender picks).
    const pickRole = (role, skip = []) => ss.find((s) => s.role2 === role && !skip.includes(s));
    const q = pickRole('qb'), sk = pickRole('skill'), sk2 = pickRole('skill', [sk]), d = pickRole('def');
    if (q && sk && d) add(`${t.name} full team effort`, 'Trio', [key(q), key(sk), key(d)]);
    if (sk && sk2) add(`${first(sk.p.name)} & ${first(sk2.p.name)} both score, ${t.name} win`, 'Trio', [key(sk), key(sk2), `ml:${t.id}`]);
    if (sk && sk2 && q) add(`${first(q.p.name)} spreads it around to ${first(sk.p.name)} & ${first(sk2.p.name)}`, 'Trio', [key(q), key(sk), key(sk2)]);
    for (const s of ss) {
      const n = first(s.p.name);
      add(`${n} ${verb(s)}, ${t.name} win`, 'Statement', [key(s), `ml:${t.id}`]);
      add(`${n} ${R[s.role2].bigVerb}${s.role2 === 'def' ? `, ${t.name} win` : ` & ${t.name} 21+`}`, 'Big game', [key(s, 'big'), s.role2 === 'def' ? `ml:${t.id}` : `tt:${t.id}:21`]);
      if (spr(t)) add(`${n} ${verb(s)} & ${pk.marginLabel(t.name, spr(t).line)}`, 'Margin', [key(s), spr(t).key]);
      for (const x of byTeam(o)) add(`${n} ${verb(s)}, ${first(x.p.name)} answers back`, 'Rivalry', [key(s), key(x)]);
    }
  }
  const caps = stars.filter((s) => s.role === 'Captain');
  if (caps.length === 2) add(`Captain clash: ${first(caps[0].p.name)} ${verb(caps[0])}, ${first(caps[1].p.name)} ${verb(caps[1])}`, 'Captains', caps.map((s) => key(s)));
  // Pick 16 with variety: no player on more than 3 tickets, no type more than 4 times.
  const usedP = {}, usedT = {}, picked = [];
  for (const c of shuffle(C, r)) {
    if (picked.length >= 16) break;
    if (c.players.some((p) => (usedP[p] || 0) >= 3) || (usedT[c.tag] || 0) >= 4) continue;
    c.players.forEach((p) => (usedP[p] = (usedP[p] || 0) + 1));
    usedT[c.tag] = (usedT[c.tag] || 0) + 1;
    picked.push(c);
  }
  const combos = picked.map((c) => ({ ...c, odds: c.legs.reduce((x, l) => x * l.odds, 1) }));
  return { cards: shuffle(cards, r), combos };
}
function featuredHtml(db, g, m) {
  const { cards, combos } = featured(db, g, m);
  if (!cards.length) return '';
  const roleIcon = { Captain: 'C', 'Team Rep': 'TR', Hot: '🔥' };
  const comboBtn = (legs, inner, cls) => `<button type="button" class="combo ${cls}" data-legs="${legsAttr(legs)}">${inner}</button>`;
  return `<section class="feat">
    <div class="feat-h"><div><span class="kicker">${icon('star')} Featured</span><h2>Star Spotlight</h2></div><small>Captains, team reps and the hottest players. Featured picks change every game.</small></div>
    <div class="spot">${cards.map((c) => `<article class="star" style="--c:${esc(c.t.color)}">
      <div class="star-top"><span class="role r-${c.role === 'Hot' ? 'hot' : 'tag'}">${roleIcon[c.role]} ${c.role === 'Hot' ? 'On fire' : c.role}</span>${c.p.number ? `<span class="star-num">${esc(c.p.number)}</span>` : ''}
        <a href="${playerUrl(c.t, c.p)}" target="_blank" rel="noopener" class="star-photo">${avatar(c.t, c.p, 112, 'xl')}</a></div>
      <div class="star-name"><b>${esc(c.p.name)}</b><small>${logo(c.t, 16)} ${esc(c.t.name)} · ${esc(c.p.position || { qb: 'QB', def: 'Defense', skill: 'Playmaker' }[c.role2])}</small></div>
      <div class="star-picks">${c.bets.map((b) => propBtn(db, g, b.m, b.short)).join('')}</div>
      ${c.combo.length === 2 ? comboBtn(c.combo, `<span>${c.comboName} + ${esc(c.t.name)} win</span><b>${oddsTxt(c.combo[0].odds * c.combo[1].odds)}</b>`, 'star-combo') : ''}
    </article>`).join('')}</div>
    <div class="feat-h sub"><div><span class="kicker">${icon('coin')} One tap</span><h2>Star Combos</h2></div><small>Tap a ticket to drop every pick in your slip.</small></div>
    <div class="tickets">${combos.map((c) => comboBtn(c.legs, `<div class="tk-head"><span class="tk-tag">${esc(c.tag)}</span><span class="tk-n">${c.legs.length} picks</span></div>
      <b class="tk-title">${esc(c.title)}</b>
      <ul>${c.legs.map((l) => `<li>${esc(l.label)}<span>${oddsTxt(l.odds)}</span></li>`).join('')}</ul>
      <div class="tk-foot"><span class="tk-mult">${oddsTxt(c.odds)}</span><span class="tk-add">Add combo</span></div>`, 'ticket')).join('')}</div>
  </section>`;
}

// ---------- pick'em: one betting page per player (shareable links) ----------
const ROLE_KEYS = {
  qb: { main: 'ppass', big: 'p2pass', verb: 'throws a TD', bigVerb: 'throws 2+ TDs' },
  def: { main: 'pint', big: 'pint_td', verb: 'gets a pick', bigVerb: 'gets a pick-six (INT + TD)' },
  skill: { main: 'ptd', big: 'p2td', verb: 'scores', bigVerb: 'scores 2+ TDs' },
};
const PROP_ORDER = ['ptd', 'p2td', 'p3td', 'pfirst', 'ppass', 'p2pass', 'pdual', 'pint', 'pint_td'];
const betForUrl = (t, p) => `/picks/${t.id}/${p.id}`;

// Parlays built around one player: every pick fits each player's role.
function playerParlays(db, g, m, t, p) {
  const k = m.byKey, et = pk.effTend(db);
  const leg = (key) => (k[key] ? { game: g.id, key, label: k[key].label, odds: k[key].odds, match: matchName(db, g) } : null);
  const role = (tm, pl) => playerRole(db, tm, pl, et);
  const key = (tm, pl, which = 'main') => `${ROLE_KEYS[role(tm, pl)][which]}:${tm.id}:${pl.id}`;
  const verb = (tm, pl) => ROLE_KEYS[role(tm, pl)].verb;
  const first = (n) => n.split(' ')[0];
  const opp = db.teams[t.id === g.home ? g.away : g.home];
  const me = role(t, p), n = first(p.name);
  // Teammates/opponents most likely to come through at their own role's bet.
  const best = (tm, skip = []) => tm.roster.filter((x) => !skip.includes(x.id) && x.id !== p.id).map((x) => ({ x, pr: k[key(tm, x)]?.p || 0 })).sort((a, b) => b.pr - a.pr).slice(0, 3).map((o) => o.x);
  const mates = best(t), rivals = best(opp);
  const spr = m.list.find((x) => x.group === 'Margin' && x.team === t.id);
  const out = [];
  const add = (title, tag, keys) => {
    const legs = keys.map(leg);
    if (!legs.every(Boolean)) return;
    const odds = legs.reduce((x, l) => x * l.odds, 1);
    if (odds >= 2 && odds <= 120) out.push({ title, tag, legs, odds });
  };
  add(`${n} ${verb(t, p)}, ${t.name} win`, 'Statement', [key(t, p), `ml:${t.id}`]);
  if (spr) add(`${n} ${verb(t, p)} & ${pk.marginLabel(t.name, spr.line)}`, 'Margin', [key(t, p), spr.key]);
  add(`${n} ${ROLE_KEYS[me].bigVerb}${me === 'def' ? `, ${t.name} win` : ` & ${t.name} 21+`}`, 'Big game', [key(t, p, 'big'), me === 'def' ? `ml:${t.id}` : `tt:${t.id}:21`]);
  if (me === 'skill') add(`${n} scores the first TD & ${t.name} win`, 'Statement', [`pfirst:${t.id}:${p.id}`, `ml:${t.id}`]);
  if (me === 'qb') add(`${n} does it all: throws & runs one in, ${t.name} win`, 'MVP', [`pdual:${t.id}:${p.id}`, `ml:${t.id}`]);
  for (const x of mates) {
    const rx = role(t, x);
    if (me === 'qb' && rx === 'skill') {
      add(`${n} throws, ${first(x.name)} scores`, 'Connection', [key(t, p), key(t, x)]);
      add(`${n} to ${first(x.name)} & ${t.name} win`, 'Stack', [key(t, p), key(t, x), `ml:${t.id}`]);
    } else if (rx === 'qb' && me === 'skill') {
      add(`${first(x.name)} throws, ${n} scores`, 'Connection', [key(t, x), key(t, p)]);
      add(`${first(x.name)} to ${n} & ${t.name} win`, 'Stack', [key(t, x), key(t, p), `ml:${t.id}`]);
    } else add(`${n} ${verb(t, p)} & ${first(x.name)} ${verb(t, x)}`, 'Teammates', [key(t, p), key(t, x)]);
  }
  if (mates.length >= 2) add(`${n}, ${first(mates[0].name)} & ${first(mates[1].name)} all deliver`, 'Trio', [key(t, p), key(t, mates[0]), key(t, mates[1])]);
  for (const x of rivals) add(`${n} ${verb(t, p)}, ${first(x.name)} answers back`, 'Rivalry', [key(t, p), key(opp, x)]);
  return out.sort((a, b) => a.odds - b.odds);
}

// Old /bet/... links (already shared) forward to the new /picks/... address.
app.get('/bet/:team/:pid', (req, res) => res.redirect(301, `/picks/${encodeURIComponent(req.params.team)}/${encodeURIComponent(req.params.pid)}`));
app.get('/bet-links', (req, res) => res.redirect(301, '/pick-links'));
app.get('/pickem/bet/:name/:id', (req, res) => res.redirect(301, `/pickem/ticket/${encodeURIComponent(req.params.name)}/${encodeURIComponent(req.params.id)}`));
app.get('/picks/:team/:pid', async (req, res, next) => {
  try {
    const db = load();
    const t = db.teams[req.params.team];
    const p = t?.roster.find((x) => x.id === req.params.pid);
    if (!p) {
      const moved = Object.values(db.teams).find((x) => x.roster.some((y) => y.id === req.params.pid));
      return moved ? res.redirect(`/picks/${moved.id}/${req.params.pid}`) : res.status(404).send(layout(req, 'Not Found', pageHead("Pick'em", 'Player not found')));
    }
    const name = currentUser(req);
    const { user } = await loadAccount(db, name);
    const g = pk.nextGame(db, TZ);
    const plays = g && (g.home === t.id || g.away === t.id);
    const role = playerRole(db, t, p);
    const r = ratings(db).find((x) => x.t.id === t.id && x.p.id === p.id);
    const hero = `<section class="bf-hero" style="--c:${esc(t.color)};--c2:${esc(t.color2)}"><div class="wrap">
      ${avatar(t, p, 150, 'xl')}
      <div><div class="kicker">${icon('coin')} Pick'em · ${logo(t, 18)} ${esc(teamFull(t))}${p.number ? ' · #' + esc(p.number) : ''}</div>
        <h1>Picks for ${esc(p.name)}</h1>
        <p>${esc(p.position || { qb: 'QB', def: 'Defense', skill: 'Playmaker' }[role])}${r ? ` · Rated ${r.r}` : ''} · <a href="${playerUrl(t, p)}">Player page</a> · <a href="/players/${t.id}/${p.id}/card">Trading card</a></p></div>
    </div></section>`;
    if (!plays) {
      return res.send(layout(req, `Picks for ${p.name}`, hero + `<div class="wrap"><div class="card empty-pick">${icon('clock')}<h2>No game open right now</h2><p class="muted">Picks on ${esc(p.name)} open for the next scheduled game. Check back soon.</p><a class="btn" href="/pickem">Go to Pick'em</a></div></div>`));
    }
    const m = pk.markets(db, g);
    const k = m.byKey;
    const A = db.teams[g.home], B = db.teams[g.away];
    const mine = PROP_ORDER.map((mk) => k[`${mk}:${t.id}:${p.id}`]).filter(Boolean);
    const rk = ROLE_KEYS[role];
    // Top picks: their headline role bet, their big-game bet, and their most likely other bet.
    const bestKeys = [rk.main, rk.big];
    const rest = mine.filter((x) => !bestKeys.some((b) => x.key.startsWith(b + ':'))).sort((a, b) => b.p - a.p)[0];
    const best = [...bestKeys.map((b) => k[`${b}:${t.id}:${p.id}`]), rest].filter(Boolean);
    const bestCard = (x, i) => `<button type="button" class="ob bb" data-game="${g.id}" data-key="${esc(x.key)}" data-label="${esc(x.label)}" data-m="${x.odds}" data-match="${esc(matchName(db, g))}">
      <small>${['Top pick', 'Big game', 'Sleeper pick'][i] || 'Pick'}</small><span>${esc(x.label.replace(p.name + ' ', ''))}</span><b>${oddsTxt(x.odds)}</b><em>${Math.round(x.p * 100)}% chance</em></button>`;
    const parlays = playerParlays(db, g, m, t, p);
    const ticket = (c) => `<button type="button" class="combo ticket" data-legs="${legsAttr(c.legs)}"><div class="tk-head"><span class="tk-tag">${esc(c.tag)}</span><span class="tk-n">${c.legs.length} picks</span></div>
      <b class="tk-title">${esc(c.title)}</b><ul>${c.legs.map((l) => `<li>${esc(l.label)}<span>${oddsTxt(l.odds)}</span></li>`).join('')}</ul>
      <div class="tk-foot"><span class="tk-mult">${oddsTxt(c.odds)}</span><span class="tk-add">Add combo</span></div></button>`;
    res.send(layout(req, `Picks for ${p.name}`, hero + `<div class="wrap">
      <div class="bf-game"><span>${logo(A, 26)} ${esc(A.name)} vs ${esc(B.name)} ${logo(B, 26)}</span><span>${esc(longDate(g.date))} · picks lock at ${time12(pk.lockTime(g))}</span>${countdown({ ...g, time: pk.lockTime(g) })}</div>
      <h2 class="sec-h">${icon('star')} Top picks</h2>
      <div class="bb-grid">${best.map(bestCard).join('')}</div>
      <h2 class="sec-h">Every ${esc(p.name.split(' ')[0])} pick</h2>
      <div class="card"><div class="obs">${mine.map((x) => oddsBtn(db, g, x)).join('')}</div></div>
      <h2 class="sec-h">${icon('coin')} ${esc(p.name.split(' ')[0])} combos</h2>
      <div class="tickets">${parlays.map(ticket).join('') || '<p class="muted">No combos right now.</p>'}</div>
      <p class="bf-more"><a class="btn ghost" href="/pickem">See every pick for this game</a></p>
    </div>${slip(user)}${countdownScript}`));
  } catch (e) { next(e); }
});

// Hidden page (not linked anywhere, not indexed): every player's betting link with a copy button.
app.get('/pick-links', (req, res) => {
  const db = load();
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.send(layout(req, 'Player Pick Links', pageHead("Pick'em", 'Player Pick Links', 'Hidden page. Copy any player\'s link and send it to them.') + `<div class="wrap">
    ${Object.values(db.teams).map((t) => `<div class="card"><div class="card-h"><h2 class="th">${logo(t, 28)} ${esc(t.name)}</h2></div><div class="links">
      ${t.roster.map((p) => `<div class="lk">${avatar(t, p, 40)}<div><b>${esc(p.name)}</b><a href="${betForUrl(t, p)}" class="lk-url" data-path="${betForUrl(t, p)}">${betForUrl(t, p)}</a></div><button type="button" class="btn sm" onclick="mflCopy(this)">Copy link</button></div>`).join('')}
    </div></div>`).join('')}
  </div>
  <script>
  document.querySelectorAll('.lk-url').forEach((a) => { a.textContent = (window.MFL_ORIGIN || location.origin) + a.dataset.path; });
  function mflCopy(btn) {
    const url = (window.MFL_ORIGIN || location.origin) + btn.parentElement.querySelector('.lk-url').dataset.path;
    const done = () => { btn.textContent = 'Copied!'; btn.classList.add('ok'); setTimeout(() => { btn.textContent = 'Copy link'; btn.classList.remove('ok'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }
  </script>`, { ticker: false }));
});

app.get('/pickem', async (req, res, next) => {
  try {
    const db = load();
    const name = currentUser(req);
    const { user, acct } = await loadAccount(db, name);
    const board = (await leaderboard(db)).slice(0, 8);
    const g = pk.nextGame(db, TZ);
    const side = `
      ${dailyCard(user)}
      ${user && acct.pending ? `<div class="card"><div class="card-h"><h2>Your open picks</h2><a href="/pickem/me">All ${icon('arrow')}</a></div>${acct.bets.filter((b) => b.status === 'pending').slice(-3).reverse().map((b) => betCard(db, b, { owner: name })).join('')}</div>` : ''}
      <div class="card"><div class="card-h"><h2>Leaderboard</h2><a href="/pickem/leaderboard">Full ${icon('arrow')}</a></div>${board.length ? `<ol class="lb">${board.map((u, i) => `<li class="${u.name === name ? 'me' : ''}"><span class="rank">${i + 1}</span><a href="/pickem/u/${esc(u.name)}"><b>@${esc(u.name)}</b></a><small>${u.won}W-${u.lost}L</small>${coins(u.balance)}</li>`).join('')}</ol>` : '<p class="muted">Nobody yet. Be first!</p>'}</div>
      <div class="card"><div class="card-h"><h2>How it works</h2></div><ul class="how"><li>Everyone starts with <b>${pk.START_COINS.toLocaleString()} coins</b>.</li><li>Only the <b>next game</b> is open. Picks lock at <b>12:31</b>, and the next game opens right then.</li><li>Tap a pick to add it to your slip. Two or more picks make a <b>combo</b>.</li><li>No unders or "player does badly" picks, so nobody can win by throwing a game.</li></ul><a href="/pickem/rules">Full rules ${icon('arrow')}</a></div>`;

    if (!g) {
      return res.send(layout(req, "Pick'em", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem', name)}
        <div class="home-grid"><div class="col"><div class="card empty-pick">${icon('clock')}<h2>No game open right now</h2><p class="muted">Picks open for the next scheduled game. Check back soon.</p></div></div><div class="col">${side}</div></div></div>`));
    }

    const m = pk.markets(db, g), k = m.byKey;
    const A = db.teams[g.home], B = db.teams[g.away];
    const wp = (t) => Math.round((k[`ml:${t.id}`]?.p || 0) * 100);
    const sprOf = (t) => m.list.find((x) => x.group === 'Margin' && x.team === t.id);
    // Players with the best shot at a TD first.
    const tdP = (t, p) => k[`ptd:${t.id}:${p.id}`]?.p || 0;
    // One row per player: tap to open their picks (keeps the page short on phones).
    const playerCard = (t, p, i) => { const td = k[`ptd:${t.id}:${p.id}`];
      return `<details class="pc" style="--c:${esc(t.color)}" ${i < 1 ? 'open' : ''}>
      <summary>${avatar(t, p, 40)}<div class="pc-name"><b>${esc(p.name)}</b><small>${esc([p.number && '#' + p.number, p.position, tagName(p.tag)].filter(Boolean).join(' · ') || t.name)}</small></div>${td ? `<span class="pc-td"><small>TD</small>${oddsTxt(td.odds)}</span>` : ''}${icon('chev')}</summary>
      <div class="pc-picks">${[['ptd', 'Scores a TD'], ['p2td', '2+ TDs'], ['p3td', '3+ TDs'], ['pfirst', 'First TD'], ['ppass', 'TD pass'], ['p2pass', '2+ TD passes'], ['pdual', 'Score + throw'], ['pint', 'Interception']].map(([mk, n]) => propBtn(db, g, k[`${mk}:${t.id}:${p.id}`], n)).join('')}</div>
      <a class="pc-more" href="${playerUrl(t, p)}">${esc(p.name.split(' ')[0])}'s profile ${icon('arrow')}</a>
    </details>`; };
    const teamProps = (t) => `<div class="pteam" data-team="${t.id}"><h3>${logo(t, 26)} ${esc(t.name)}</h3>${[...t.roster].sort((x, y) => tdP(t, y) - tdP(t, x)).map((p, i) => playerCard(t, p, i)).join('')}</div>`;
    const groups = {};
    for (const x of m.list) (groups[x.group] = groups[x.group] || []).push(x);
    const gameBets = ['Margin', 'Total points', 'Team points', 'Winning margin', 'Exact margin', 'Specials', 'Turnovers'].filter((n) => groups[n]).map((n) => `<details class="card mk"><summary><h2>${n}</h2><span class="muted sm">${groups[n].length} picks</span>${icon('chev')}</summary><div class="obs">${groups[n].map((x) => oddsBtn(db, g, x)).join('')}</div></details>`).join('');

    res.send(layout(req, "Pick'em", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem', name)}
      <section class="ng" style="--a:${esc(A.color)};--b:${esc(B.color)}">
        <div class="ng-top"><span class="kicker">${icon('fire')} Next game${gameLabel(db, g) ? ' · ' + esc(gameLabel(db, g)) : ''}</span><a class="ng-when" href="/games/${g.id}">${esc(shortDate(g.date))} · ${time12(g.time)} ${icon('arrow')}</a></div>
        <div class="ng-match">
          <div class="ng-side">${logo(A, 64)}<b>${esc(A.name)}</b><small>${record(teamStats(db, A.id))}</small></div>
          <div class="ng-mid"><small>Picks lock in</small><div class="cd" data-ts="${lockTs(g)}"><div><b>–</b><small>d</small></div><div><b>–</b><small>h</small></div><div><b>–</b><small>m</small></div><div><b>–</b><small>s</small></div></div></div>
          <div class="ng-side">${logo(B, 64)}<b>${esc(B.name)}</b><small>${record(teamStats(db, B.id))}</small></div>
        </div>
        <div class="winbar"><div style="width:${wp(A)}%;background:${esc(A.color)}"><span>${wp(A)}%</span></div><div style="flex:1"><span>Tie ${Math.max(0, 100 - wp(A) - wp(B))}%</span></div><div style="width:${wp(B)}%;background:${esc(B.color)}"><span>${wp(B)}%</span></div></div>
        <div class="ng-grid">
          ${propBtn(db, g, k[`ml:${A.id}`], `${esc(A.name)} win`)}${propBtn(db, g, k[`ml:${B.id}`], `${esc(B.name)} win`)}
          ${propBtn(db, g, sprOf(A), sprOf(A) ? esc(pk.marginLabel(A.name, sprOf(A).line)) : 'Margin')}${propBtn(db, g, sprOf(B), sprOf(B) ? esc(pk.marginLabel(B.name, sprOf(B).line)) : 'Margin')}
        </div>
      </section>
      ${featuredHtml(db, g, m)}
      <div class="home-grid">
        <div class="col">
          <section class="card props" id="all-props">
            <div class="card-h"><h2>${icon('star')} Every player</h2><div class="seg mini" id="ptabs"><a class="on" data-t="all">Both teams</a><a data-t="${A.id}">${esc(A.abbr)}</a><a data-t="${B.id}">${esc(B.abbr)}</a></div></div>
            <p class="muted sm">Most likely to score first. Tap a player to see their picks.</p>
            <div class="pteams">${teamProps(A)}${teamProps(B)}</div>
          </section>
          ${gameBets}
        </div>
        <div class="col">${side}</div>
      </div></div>${slip(user)}${countdownScript}${shareScript}
      <script>document.getElementById('ptabs').addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;document.querySelectorAll('#ptabs a').forEach(x=>x.classList.toggle('on',x===a));document.querySelectorAll('.pteam').forEach(p=>p.hidden=a.dataset.t!=='all'&&p.dataset.team!==a.dataset.t);document.querySelector('.pteams').classList.toggle('one',a.dataset.t!=='all')});
      document.querySelectorAll('.cd').forEach(el=>{const t=+el.dataset.ts;if(t>Date.now())setTimeout(()=>location.reload(),t-Date.now()+1500)});</script>`));
  } catch (e) { next(e); }
});

// Old per-game links all go to the single next-game page now.
app.get('/pickem/game/:id', (req, res) => res.redirect('/pickem'));

app.post(['/pickem/play', '/pickem/bet'], async (req, res) => {
  const db = load();
  const name = currentUser(req);
  if (!name) return res.json({ ok: false, error: 'Log in first.' });
  try {
    const user = await getDoc(userKey(name), { fresh: true });
    if (!user) return res.json({ ok: false, error: 'Account not found. Log in again.' });
    const built = pk.buildBet(db, req.body.picks, req.body.amount ?? req.body.stake, TZ);
    if (built.error) return res.json({ ok: false, error: built.error });
    const bal = accountOf(db, user, await survivorNow(db)).balance;
    if (built.bet.stake > bal) return res.json({ ok: false, error: `You only have ${bal.toLocaleString('en-US')} coins.` });
    user.bets = user.bets || [];
    user.bets.push(built.bet);
    await putDoc(userKey(name), user);
    res.json({ ok: true, balance: bal - built.bet.stake, toWin: Math.floor(built.bet.stake * built.bet.odds) });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: 'Could not lock in that pick. Try again.' });
  }
});

app.get('/pickem/me', (req, res) => {
  const name = currentUser(req);
  res.redirect(name ? `/pickem/u/${name}` : '/pickem/login?next=/pickem/me');
});

app.get('/pickem/me.json', async (req, res) => {
  const name = currentUser(req);
  const user = name ? await getDoc(userKey(name)) : null;
  res.set('Cache-Control', 'no-store').json(user ? { name, balance: accountOf(load(), user, await survivorNow(load())).balance } : {});
});

// Out of coins: a top-up, but not right after spending them on packs.
const canBailout = (user, acct) => acct.balance < pk.BAILOUT_BELOW && !acct.pending && !(user.packs || []).some((p) => p.currency === 'coins' && p.cost && Date.now() - Date.parse(p.at) < 7 * DAY);
app.post('/pickem/bailout', async (req, res) => {
  const db = load();
  const name = currentUser(req);
  if (!name) return res.redirect('/pickem/login');
  const user = await getDoc(userKey(name), { fresh: true });
  const acct = user && accountOf(db, user, await survivorNow(db));
  if (acct && canBailout(user, acct)) {
    user.bonuses = user.bonuses || [];
    user.bonuses.push({ amount: pk.BAILOUT_COINS, reason: 'Bailout', at: new Date().toISOString() });
    await putDoc(userKey(name), user);
  }
  res.redirect('/pickem/me');
});

app.get('/pickem/leaderboard', async (req, res, next) => {
  try {
    const db = load();
    const name = currentUser(req);
    const { user, acct } = await loadAccount(db, name);
    const board = await leaderboard(db);
    const weekly = req.query.view !== 'season';
    const wk = weekOf(today());
    const wb = weekBoard(board, wk);
    const winners = weeklyWinners(board);
    const lastW = winners[winners.length - 1];
    const recent = board.flatMap((u) => u.bets.filter((b) => b.status === 'won').map((b) => ({ ...b, who: u.name }))).sort((x, y) => y.payout - x.payout).slice(0, 5);
    const who = (n) => `<a href="/pickem/u/${esc(n)}"><b>@${esc(n)}</b></a>${winners.some((w) => w.name === n) ? ` <span class="star-b" title="Picker of the Week">${icon('star')}${winners.filter((w) => w.name === n).length}</span>` : ''}`;
    const table = weekly
      ? `<table class="tbl"><thead><tr><th>#</th><th class="l">Player</th><th>Week profit</th><th>W</th><th>L</th></tr></thead><tbody>
        ${wb.map((u, i) => `<tr class="${u.name === name ? 'today' : ''}"><td>${i + 1}</td><td class="l">${who(u.name)}</td><td class="${u.profit >= 0 ? 'up' : 'down'}">${signed(u.profit)}</td><td>${u.won}</td><td>${u.lost}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No picks settled this week yet.</td></tr>'}</tbody></table>`
      : `<table class="tbl"><thead><tr><th>#</th><th class="l">Player</th><th>Coins</th><th>Profit</th><th>W</th><th>L</th><th>Open</th></tr></thead><tbody>
        ${board.map((u, i) => `<tr class="${u.name === name ? 'today' : ''}"><td>${i + 1}</td><td class="l">${who(u.name)}</td><td>${coins(u.balance)}</td><td class="${u.profit >= 0 ? 'up' : 'down'}">${signed(u.profit)}</td><td>${u.won}</td><td>${u.lost}</td><td>${u.pending}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nobody yet.</td></tr>'}</tbody></table>`;
    res.send(layout(req, "Pick'em Leaderboard", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/leaderboard', name)}
      ${lastW ? `<a class="card botw" href="/pickem/u/${esc(lastW.name)}"><span class="botw-ic">${icon('star')}</span><div><small>Picker of the Week · week of ${esc(shortDate(lastW.week))}</small><b>@${esc(lastW.name)}</b></div><span class="up">${signed(lastW.profit)}</span></a>` : ''}
      <div class="home-grid"><div class="col"><div class="card"><div class="card-h"><h2>${weekly ? `This week <small class="muted">from ${esc(shortDate(wk))}</small>` : 'Season standings'}</h2>
        <div class="seg mini"><a class="${weekly ? 'on' : ''}" href="/pickem/leaderboard">This week</a><a class="${weekly ? '' : 'on'}" href="/pickem/leaderboard?view=season">Season</a></div></div>
        <div class="scroll">${table}</div>${weekly ? '<p class="muted sm">Weeks run Monday to Sunday. The top profit each week is crowned Picker of the Week.</p>' : ''}</div></div>
        <div class="col"><div class="card"><div class="card-h"><h2>${icon('fire')} Biggest wins</h2></div>${recent.map((b) => betCard(db, b, { who: b.who, owner: b.who })).join('') || '<p class="muted">No winning picks yet.</p>'}</div>
        ${winners.length ? `<div class="card"><div class="card-h"><h2>Past winners</h2></div><ol class="lb">${[...winners].reverse().map((w) => `<li><b>${esc(shortDate(w.week))}</b><small><a href="/pickem/u/${esc(w.name)}">@${esc(w.name)}</a></small><span class="up">${signed(w.profit)}</span></li>`).join('')}</ol></div>` : ''}</div>
      </div></div>${shareScript}`));
  } catch (e) { next(e); }
});

app.get('/pickem/rules', async (req, res, next) => {
  try {
    const db = load();
    const name = currentUser(req);
    const { user, acct } = await loadAccount(db, name);
    res.send(layout(req, "Pick'em Rules", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/rules', name)}<div class="card prose">
      <h2>How Pick'em works</h2>
      <p><b>It's free and just for fun.</b> MFL Coins are fake. They can't be bought, sold or traded for anything.</p>
      <h3>Coins</h3><p>Everyone starts with ${pk.START_COINS.toLocaleString()} coins. If you drop under ${pk.BAILOUT_BELOW} with no open picks, you can claim a ${pk.BAILOUT_COINS} coin bailout from <a href="/pickem/me">My picks</a>.</p>
      <h3>Making picks</h3><p>Tap any pick to add it to your pick slip, choose how many coins to play and hit <b>Lock it in</b>. One pick is a single. Two or more picks become a <b>combo</b>: every pick has to be right, but the rewards multiply. Combos can have up to ${pk.MAX_LEGS} picks and can mix games. Within one game you can only take one "who wins" style pick (winner, margin or shutout).</p>
      <h3>Reading the numbers</h3><p><b>+150</b> means a 100 coin pick gets 150 more if you're right. <b>−200</b> means you play 200 coins to get 100 more. Unlikely picks have bigger numbers. They come from each team's and player's real stats and update as the season goes.</p>
      <h3>When picks close and pay</h3><p>Only the next game is open for picks. Picks lock at ${time12('12:31')}, ${pk.LOCK_MINUTES} minutes before kickoff, and the following game opens right away. Rewards come in as soon as the final score is posted. If a score gets corrected, picks re-settle automatically. Postponed games are refunded (a combo just drops that pick). A tie counts as a loss for "win" picks.</p>
      <h3>Why there are no unders</h3><p>Every pick is on something <i>happening</i>: a team winning, scoring a lot, a player scoring or getting a pick. There are no picks on a team scoring less or a player not scoring, so nobody gains anything by playing badly on purpose.</p>
      <h3>Margin picks</h3><p>The favorite's margin pick is <b>win by 14 or more</b>. The other team's is <b>within 13</b>: right if they win, or lose by 13 or less. Who's the favorite is based on every past game, exhibitions included.</p>
      <h3>Player props</h3><p>Player picks count what's in the box score. If a play isn't recorded, it doesn't count.</p>
      <h3>Players ruled out</h3><p>If the commissioner marks a player as out for a game (even after it's over), every pick on him is cancelled: singles are refunded, and combos drop that pick and count the rest. Results update by themselves.</p>
      <h3>Coins</h3><p>Coins are the only currency. You win them with picks, your Starting 8 earns them every game (1 fantasy point = 1 coin), Survivor winners get ${sv.PRIZE}, and extra cards sell for coins. Spend them on picks or card packs.</p>
      <h3>MFL Cards &amp; the Starting 8</h3><p>Collect cards of every player: ${cards.RARITY_ORDER.map((r) => `${cards.RARITIES[r].name} (${cards.RARITIES[r].mult}×)`).join(', ')}, and every player has ${cards.VARIANTS.filter((v) => !v.only).length} different cards (Base, Team Colors, Silver, Action Shot, five Specialists, Gold, Holo, Signature, Legend, All-Star, Clutch, Icon, and the 1-of-1 Mythic and Dark Matter), plus one card nobody has pulled yet: Dom's Big Doh Mi, a 0.001% drop that scores 101×. Specialist cards score ${cards.SPECIAL_BOOST}× on their specialty. There are free packs (daily, game day, weekly, collector rewards) and ${cards.packTypes(load()).filter((t) => !cards.packInfo(load(), t).free).length} packs to buy with coins. Set a Starting 8 of different players; every game they score fantasy points (TD catch or run ${cards.SCORING.td}, TD pass ${cards.SCORING.pass}, INT ${cards.SCORING.int}, sack ${cards.SCORING.sack}, notable catch or play ${cards.SCORING.catch}, breakup ${cards.SCORING.pbu}, flag pull ${cards.SCORING.flag}, MVP ${cards.SCORING.mvp}, win ${cards.SCORING.win}, thrown INT ${cards.SCORING.picked}) times the card's multiplier. Your lineup locks with Pick'em at ${time12('12:31')} and carries over until you change it. <a href="/pickem/cards">My cards →</a></p>
      <h3>Survivor</h3><p>Each game, pick a player who has to score a touchdown. Miss and you're out, and you can't reuse a player in a round. Last one standing wins ${sv.PRIZE} coins. <a href="/pickem/survivor">Play Survivor →</a></p>
      <h3>MFL Arcade</h3><p>10 games (Modern Bowl, Chess, 8-Ball Pool, Trivia, Checkers, Connect Four, Field Goal Frenzy, QB Bullseye, Flag Pull and Card Memory), each with 4 levels. Winning pays coins; harder levels pay more and Modern Bowl pays the most. <b>Risk mode</b>: put in a third of the prize up front; a win pays 1.5× to 5× the prize (by level), a loss keeps what you put in. Leaving or refreshing mid-game counts as a loss. Each game pays a limited number of wins per day; Practice is always free. Chess, Checkers and Connect Four games are replayed on the server to confirm a win, and Trivia is graded by the server. <a href="/arcade">Play →</a></p>
      <h3>More ways to earn coins</h3><p>Three daily challenges every day, a game-day check-in (+150 on game days, 11:30 to 2:30), +${ACHIEVEMENT_COINS} for every achievement, a free Arcade Champ Pack for winning 3 Arcade games in a day, plus Pick'em, your Starting 8, Survivor, the daily bonus and selling cards.</p>
      <h3>Starting 8 positions</h3><p>Your Starting 8 has positions: QB, RB, WR1, WR2, WR3, TE and two UTIL. They don't change fantasy points; they decide who does what in Modern Bowl (QB throws, receivers catch, the first UTIL blocks and the second kicks and leads the defense).</p>
      <h3>Picker of the Week</h3><p>The best Pick'em profit each week (Monday to Sunday) is crowned Picker of the Week, shown on the homepage, and wins a free Champion Pack.</p>
    </div></div>`));
  } catch (e) { next(e); }
});

function authPage(req, mode, err = '') {
  const next = /^\/[a-z0-9/_-]*$/i.test(req.query.next || req.body?.next || '') ? (req.query.next || req.body.next) : '/pickem';
  const signup = mode === 'signup';
  return layout(req, signup ? 'Sign up' : 'Log in', `<div class="wrap login"><form method="post" class="card form">
    <img src="/static/mfl-logo.webp" alt="" class="login-logo"><h2>${signup ? "Join Pick'em" : 'Log in'}</h2>
    ${signup ? `<p class="muted sm">Free. You get ${pk.START_COINS.toLocaleString()} coins to start.</p>` : ''}
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <input type="hidden" name="next" value="${esc(next)}">
    <label>Username<input name="name" autocomplete="username" required minlength="3" maxlength="16" pattern="[A-Za-z0-9_]+" placeholder="letters, numbers, _" value="${esc(req.body?.name || '')}"></label>
    <label>Password<input name="pin" type="password" required maxlength="72" ${signup ? 'minlength="6"' : ''} autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
    ${signup ? '<p class="muted sm">At least 6 characters.</p>' : '<p class="muted sm">Made your account with a 4-digit PIN? Just type your PIN here.</p>'}
    <button class="btn">${signup ? 'Create account' : 'Log in'}</button>
    <p class="muted sm">${signup ? 'Already have an account? <a href="/pickem/login">Log in</a>' : 'New here? <a href="/pickem/signup">Sign up</a>'}</p>
  </form></div>`, { ticker: false });
}
app.get('/pickem/login', (req, res) => res.send(authPage(req, 'login')));
app.get('/pickem/signup', (req, res) => res.send(authPage(req, 'signup')));
app.post('/pickem/signup', async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase(), pin = String(req.body.pin || '');
  if (!pk.validName(name)) return res.send(authPage(req, 'signup', 'Usernames are 3-16 letters, numbers or _.'));
  if (pin.length < 6 || pin.length > 72) return res.send(authPage(req, 'signup', 'Your password needs at least 6 characters.'));
  if (await getDoc(userKey(name), { fresh: true })) return res.send(authPage(req, 'signup', 'That username is taken.'));
  await putDoc(userKey(name), { name, ...pk.hashPin(pin), created: new Date().toISOString(), bonuses: [], bets: [] });
  setUserCookie(req, res, name);
  res.redirect(req.body.next && /^\/[a-z0-9/_-]*$/i.test(req.body.next) ? req.body.next : '/pickem');
});
// Slow down password guessing: a few tries per name, then a cooldown.
// Older accounts made with a 4-digit PIN log in by typing that PIN as their password.
const tries = new Map();
app.post('/pickem/login', async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase(), pin = String(req.body.pin || '');
  const t = tries.get(name) || { n: 0, until: 0 };
  if (t.until > Date.now()) return res.send(authPage(req, 'login', 'Too many tries. Wait a minute and try again.'));
  const user = pk.validName(name) ? await getDoc(userKey(name), { fresh: true }) : null;
  if (!user || !pin || pin.length > 72 || !pk.checkPin(user, pin)) {
    t.n++; if (t.n >= 5) { t.n = 0; t.until = Date.now() + 60000; } tries.set(name, t);
    return res.send(authPage(req, 'login', 'Wrong username or password.'));
  }
  tries.delete(name);
  setUserCookie(req, res, name);
  res.redirect(req.body.next && /^\/[a-z0-9/_-]*$/i.test(req.body.next) ? req.body.next : '/pickem');
});
// Change your own password (must know the current one, or the old 4-digit PIN).
app.post('/pickem/password', async (req, res) => {
  const name = currentUser(req);
  if (!name) return res.redirect('/pickem/login?next=/pickem/me');
  const back = (msg, ok) => res.redirect(`/pickem/u/${name}?pw=${ok ? 'ok' : encodeURIComponent(msg)}#password`);
  const cur = String(req.body.current || ''), nw = String(req.body.password || ''), again = String(req.body.again || '');
  const t = tries.get(name) || { n: 0, until: 0 };
  if (t.until > Date.now()) return back('Too many tries. Wait a minute and try again.');
  const user = await getDoc(userKey(name), { fresh: true });
  if (!user) return res.redirect('/pickem/logout');
  if (!cur || cur.length > 72 || !pk.checkPin(user, cur)) {
    t.n++; if (t.n >= 5) { t.n = 0; t.until = Date.now() + 60000; } tries.set(name, t);
    return back('Your current password is wrong.');
  }
  tries.delete(name);
  if (nw.length < 6 || nw.length > 72) return back('Your new password needs at least 6 characters.');
  if (nw !== again) return back("The new passwords don't match.");
  Object.assign(user, pk.hashPin(nw));
  await putDoc(userKey(name), user);
  back('', true);
});
app.get('/pickem/logout', (req, res) => { res.setHeader('Set-Cookie', `${USER_COOKIE}=; Path=/; Max-Age=0`); res.redirect('/pickem'); });

// ---------- player leaders ----------
app.get('/stats/players', (req, res) => {
  const db = load();
  const rows = [];
  for (const tm of Object.values(db.teams)) for (const p of tm.roster) {
    const s = playerStats(db, tm, p);
    rows.push({ tm, p, ...s, total: s.td + s.ptd + s.int, gp: s.log.length });
  }
  const board = (k, title) => {
    const xs = rows.filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k] || a.p.name.localeCompare(b.p.name)).slice(0, 10);
    const top = xs[0];
    return `<div class="card lead-card"><div class="card-h"><h2>${title}</h2></div>
      ${top ? `<a class="lead-top" href="${playerUrl(top.tm, top.p)}" style="--a:${esc(top.tm.color)}">${avatar(top.tm, top.p, 72)}<div><small>${logo(top.tm, 16)} ${esc(top.tm.name)}</small><b>${esc(top.p.name)}</b></div><span>${top[k]}</span></a>` : '<p class="muted">No stats yet.</p>'}
      ${xs.slice(1).map((r, i) => `<a class="lead-row" href="${playerUrl(r.tm, r.p)}"><span class="rank">${i + 2}</span>${avatar(r.tm, r.p, 30)}<b>${esc(r.p.name)}</b>${logo(r.tm, 18)}<span class="n">${r[k]}</span></a>`).join('')}</div>`;
  };
  const all = rows.sort((a, b) => b.total - a.total || a.p.name.localeCompare(b.p.name));
  res.send(layout(req, 'Player Leaders', pageHead('2026–27 Season', 'Player Leaders', 'Every game counts here: regular season, bowls and exhibitions.') + `<div class="wrap">
    <div class="lead-grid">${board('td', 'Touchdowns')}${board('ptd', 'Passing TDs')}${board('int', 'Interceptions')}</div>
    <div class="card"><div class="card-h"><h2>All Players</h2></div><div class="scroll"><table class="tbl"><thead><tr><th class="l">Player</th><th class="l">Team</th><th>GP*</th><th>TD</th><th>Pass TD</th><th>INT</th><th>Total</th></tr></thead><tbody>
    ${all.map((r) => `<tr><td class="l"><a class="plink" href="${playerUrl(r.tm, r.p)}">${avatar(r.tm, r.p, 28)}${esc(r.p.name)}</a></td><td class="l"><span class="th">${logo(r.tm, 20)} ${esc(r.tm.abbr)}</span></td><td>${r.gp}</td><td>${r.td || '–'}</td><td>${r.ptd || '–'}</td><td>${r.int || '–'}</td><td><b>${r.total || '–'}</b></td></tr>`).join('')}
    </tbody></table></div><p class="muted sm">*Games with a recorded stat, exhibitions included.</p></div>
  </div>`));
});

// ---------- head-to-head ----------
app.get('/history', (req, res) => {
  const db = load();
  const [A, B] = Object.values(db.teams);
  const games = db.games.filter(isFinal).sort((a, b) => a.date.localeCompare(b.date));
  const real = games.filter((g) => g.type !== 'exhibition');
  const pts = (g, t) => (g.home === t.id ? g.homeScore : g.awayScore);
  const rec = (gs, t) => gs.filter((g) => winner(g) === t.id).length;
  const ties = real.filter((g) => !winner(g)).length;
  let streak = { team: null, n: 0 }, best = { [A.id]: 0, [B.id]: 0 }, run = { team: null, n: 0 };
  for (const g of real) {
    const w = winner(g);
    run = w && w === run.team ? { team: w, n: run.n + 1 } : { team: w, n: w ? 1 : 0 };
    if (w) best[w] = Math.max(best[w], run.n);
  }
  streak = run;
  const margin = (g) => Math.abs(g.homeScore - g.awayScore);
  const by = (fn) => [...real].sort(fn)[0];
  const biggest = real.length ? by((x, y) => margin(y) - margin(x)) : null;
  const highest = real.length ? by((x, y) => (y.homeScore + y.awayScore) - (x.homeScore + x.awayScore)) : null;
  const lowest = real.length ? by((x, y) => (x.homeScore + x.awayScore) - (y.homeScore + y.awayScore)) : null;
  const shutouts = real.filter((g) => winner(g) && Math.min(g.homeScore, g.awayScore) === 0);
  const avg = real.length ? (real.reduce((s, g) => s + g.homeScore + g.awayScore, 0) / real.length).toFixed(1) : '–';
  const gline = (g) => g ? `<a href="/games/${g.id}">${esc(db.teams[winner(g) || g.home].abbr)} ${Math.max(g.homeScore, g.awayScore)}–${Math.min(g.homeScore, g.awayScore)} · ${esc(shortDate(g.date))}</a>` : '–';
  const wA = rec(real, A), wB = rec(real, B);
  res.send(layout(req, 'Head-to-Head', pageHead('All-time series', 'Head-to-Head') + `<div class="wrap">
    <div class="card h2h" style="--a:${esc(A.color)};--b:${esc(B.color)}">
      <a href="/teams/${A.id}" class="h2h-t">${logo(A, 72)}<b>${esc(A.name)}</b></a>
      <div class="h2h-mid"><div class="h2h-score"><span>${wA}</span><i>–</i><span>${wB}</span></div><small>${ties ? `${ties} tie${ties > 1 ? 's' : ''} · ` : ''}${real.length} game${real.length === 1 ? '' : 's'}</small>
        <div class="race"><div style="width:${wA + wB ? (wA / (wA + wB)) * 100 : 50}%;background:${esc(A.color)}"></div><div style="flex:1;background:${esc(B.color)}"></div></div>
        <small>${streak.team ? `${esc(db.teams[streak.team].name)} have won ${streak.n} straight` : 'No streak yet'}</small></div>
      <a href="/teams/${B.id}" class="h2h-t">${logo(B, 72)}<b>${esc(B.name)}</b></a>
    </div>
    <div class="rec-grid">
      <div class="card"><small>Biggest win</small><b>${gline(biggest)}</b></div>
      <div class="card"><small>Highest scoring</small><b>${gline(highest)}</b></div>
      <div class="card"><small>Lowest scoring</small><b>${gline(lowest)}</b></div>
      <div class="card"><small>Avg. total points</small><b>${avg}</b></div>
      <div class="card"><small>Longest win streak</small><b>${esc(A.abbr)} ${best[A.id]} · ${esc(B.abbr)} ${best[B.id]}</b></div>
      <div class="card"><small>Shutouts</small><b>${esc(A.abbr)} ${shutouts.filter((g) => winner(g) === A.id).length} · ${esc(B.abbr)} ${shutouts.filter((g) => winner(g) === B.id).length}</b></div>
      <div class="card"><small>Bowl wins</small><b>${esc(A.abbr)} ${rec(real.filter((g) => g.type === 'playoff'), A)} · ${esc(B.abbr)} ${rec(real.filter((g) => g.type === 'playoff'), B)}</b></div>
      <div class="card"><small>Exhibitions</small><b>${esc(A.abbr)} ${rec(games.filter((g) => g.type === 'exhibition'), A)} · ${esc(B.abbr)} ${rec(games.filter((g) => g.type === 'exhibition'), B)}</b></div>
    </div>
    <div class="card"><div class="card-h"><h2>Every result</h2></div><div class="scroll"><table class="tbl"><thead><tr><th class="l">Date</th><th class="l">Game</th><th>${esc(A.abbr)}</th><th>${esc(B.abbr)}</th><th class="l">Winner</th></tr></thead><tbody>
    ${[...games].reverse().map((g) => { const w = winner(g); return `<tr><td class="l"><a href="/games/${g.id}">${esc(shortDate(g.date))}</a></td><td class="l">${gameLabel(db, g) ? `<span class="tag ${g.type}">${esc(gameLabel(db, g))}</span>` : 'Regular season'}</td><td><b>${pts(g, A)}</b></td><td><b>${pts(g, B)}</b></td><td class="l">${w ? `<span class="th">${logo(db.teams[w], 20)} ${esc(db.teams[w].name)}</span>` : 'Tie'}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">No games yet.</td></tr>'}
    </tbody></table></div></div>
  </div>`));
});

// ---------- transactions ----------
const TX_TYPES = { trade: 'Trade', signing: 'Signing', release: 'Release', note: 'Note' };
function txLine(db, t) {
  const tm = db.teams[t.team], t2 = db.teams[t.team2];
  const names = (xs) => xs.map((n) => `<b>${esc(n)}</b>`).join(', ');
  let text = '';
  if (t.type === 'trade') text = `${esc(tm?.name)} trade ${names(t.out || [])} to ${esc(t2?.name)}${(t.in || []).length ? ` for ${names(t.in)}` : ''}`;
  else if (t.type === 'signing') text = `${esc(tm?.name)} sign ${names(t.in || [])}`;
  else if (t.type === 'release') text = `${esc(tm?.name)} release ${names(t.out || [])}`;
  else text = esc(t.note);
  return `<div class="tx"><span class="tag tx-${t.type}">${TX_TYPES[t.type]}</span><div><p>${text}</p>${t.note && t.type !== 'note' ? `<small class="muted">${esc(t.note)}</small>` : ''}</div><span class="tx-d">${esc(shortDate(t.date))}</span>
    <div class="tx-logos">${tm ? logo(tm, 26) : ''}${t2 ? logo(t2, 26) : ''}</div></div>`;
}
app.get('/transactions', (req, res) => {
  const db = load();
  const txs = [...(db.transactions || [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  res.send(layout(req, 'Transactions', pageHead('2026–27 Season', 'Transactions', 'Trades, signings and releases. Team reps can trade non-team-representatives.') + `<div class="wrap">
    <div class="card">${txs.map((t) => txLine(db, t)).join('') || '<p class="muted">No transactions yet.</p>'}</div></div>`));
});

// ---------- calendar ----------
app.get('/calendar.ics', (req, res) => {
  const db = load();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MFL//Schedule//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:MFL Games', `X-WR-TIMEZONE:${TZ}`];
  for (const g of db.games) {
    if (!g.date) continue;
    const [h, mi] = (g.time || '12:35').split(':').map(Number);
    const start = `${g.date.replace(/-/g, '')}T${String(h).padStart(2, '0')}${String(mi).padStart(2, '0')}00`;
    const endM = h * 60 + mi + 30;
    const end = `${g.date.replace(/-/g, '')}T${String(Math.floor(endM / 60)).padStart(2, '0')}${String(endM % 60).padStart(2, '0')}00`;
    const a = db.teams[g.home], b = db.teams[g.away];
    const score = isFinal(g) ? ` (${a.abbr} ${g.homeScore}–${g.awayScore} ${b.abbr})` : g.status === 'postponed' ? ' (POSTPONED)' : '';
    lines.push('BEGIN:VEVENT', `UID:mfl-game-${g.id}@mfl`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;TZID=${TZ}:${start}`, `DTEND;TZID=${TZ}:${end}`,
      `SUMMARY:${gameLabel(db, g) ? gameLabel(db, g) + ': ' : ''}${a.name} vs ${b.name}${score}`, `LOCATION:${VENUE}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="mfl.ics"' }).send(lines.join('\r\n'));
});

// ---------- MVP, recaps, ratings, records, cards ----------
// Game MVP is decided automatically from the box score: TD 6, TD pass 4, INT 5, +3 for being on the winning team.
function gameMvp(db, g) {
  if (!isFinal(g)) return null;
  const A = freshRecap(db, g);
  if (A?.mvp) {
    const [team, pid] = A.mvp.split('|'), tm = db.teams[team], player = tm?.roster.find((x) => x.id === pid);
    if (player) return { team, name: player.name, tm, player, line: A.mvpWhy, ai: true };
  }
  if (!(g.events || []).length) return null;
  const pts = {};
  const bump = (team, name, k, v) => {
    if (!name) return;
    const id = team + '|' + name.toLowerCase();
    pts[id] = pts[id] || { team, name, score: 0, td: 0, pass: 0, int: 0 };
    pts[id].score += v; pts[id][k]++;
  };
  for (const e of g.events) {
    if (e.type === 'TD') { bump(e.team, e.player, 'td', 6); bump(e.team, e.passer, 'pass', 4); }
    else if (e.type === 'INT') bump(e.team, e.player, 'int', 5);
  }
  const w = winner(g);
  for (const p of Object.values(pts)) if (p.team === w) p.score += 3;
  const best = Object.values(pts).sort((a, b) => b.score - a.score || b.td - a.td)[0];
  if (!best) return null;
  const tm = db.teams[best.team];
  const line = [best.td && `${best.td} TD`, best.pass && `${best.pass} TD pass${best.pass > 1 ? 'es' : ''}`, best.int && `${best.int} INT`].filter(Boolean).join(', ');
  return { ...best, tm, player: findPlayerByName(tm, best.name), line };
}
function mvpCounts(db) {
  const c = {};
  for (const g of db.games) {
    const m = gameMvp(db, g);
    if (m) c[m.team + '|' + m.name.toLowerCase()] = (c[m.team + '|' + m.name.toLowerCase()] || 0) + 1;
  }
  return c;
}

// Plain-English recap written from the score and box score.
function recap(db, g) {
  if (!isFinal(g)) return '';
  const A = freshRecap(db, g);
  if (A) return A.text;
  const a = db.teams[g.home], b = db.teams[g.away], w = winner(g);
  const W = w ? db.teams[w] : null, L = w ? db.teams[w === a.id ? b.id : a.id] : null;
  const hi = Math.max(g.homeScore, g.awayScore), lo = Math.min(g.homeScore, g.awayScore), margin = hi - lo;
  const lbl = gameLabel(db, g);
  const where = `${lbl ? `in the ${lbl === 'Exhibition' ? 'exhibition' : lbl}` : ''} at ${VENUE}`.trim();
  const how = !W ? 'battled to a' : margin >= 21 ? 'rolled past' : margin >= 14 ? 'pulled away from' : lo === 0 ? 'shut out' : 'edged';
  const out = [];
  out.push(W ? `The ${W.name} ${how} the ${L.name} ${hi}–${lo} ${where}.` : `The ${a.name} and ${b.name} ${how} ${hi}–${lo} tie ${where}.`);
  const evs = g.events || [];
  const tds = evs.filter((e) => e.type === 'TD'), ints = evs.filter((e) => e.type === 'INT');
  // Touchdowns, one sentence per team: "For the Pineapples, Liam Bair (2) and Bowen Ince scored, with Maddox Pedon throwing 2 TDs."
  const list = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1) : xs[0]);
  for (const tid of [w || g.home, w ? (w === g.home ? g.away : g.home) : g.away]) {
    const mine = tds.filter((e) => e.team === tid);
    if (!mine.length) continue;
    const sc = {}, th = {};
    for (const e of mine) { const k = e.player || 'Unknown'; sc[k] = (sc[k] || 0) + 1; if (e.passer) th[e.passer] = (th[e.passer] || 0) + 1; }
    const scorers = Object.entries(sc).sort((x, y) => y[1] - x[1]).map(([n, c]) => n + (c > 1 ? ` (${c})` : ''));
    const throwers = Object.entries(th).sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} throwing ${c > 1 ? c + ' TDs' : 'one'}`);
    out.push(`For the ${db.teams[tid]?.name}, ${list(scorers)} found the end zone${throwers.length ? `, with ${list(throwers)}` : ''}.`);
  }
  if (tds[0]?.player) out.push(`${tds[0].player} opened the scoring.`);
  if (ints.length) out.push(`${ints.map((e) => (e.player || 'Someone') + (e.passer ? ` (picking off ${e.passer})` : '')).join(', ')} came up with ${ints.length > 1 ? `${ints.length} interceptions` : 'an interception'} on defense.`);
  const m = gameMvp(db, g);
  if (m) out.push(`${m.name} takes home MVP honors with ${m.line}.`);
  if (W && g.type !== 'exhibition') {
    const s = teamStats(db, W.id);
    out.push(`The ${W.name} move to ${record(s)}${s.streak && +s.streak.slice(1) > 1 ? ` and have won ${s.streak.slice(1)} straight` : ''}.`);
  }
  return out.join(' ');
}

// Player power rating, 40-99 (used when the AI analyst isn't set up). It starts from
// the commissioner's scouting (tendencies, see scoutRating) and games nudge it: each team
// game gets a production score (TD 6, TD pass 4, INT 5, MVP 2, win 2; thrown INT -5,
// loss -2), averaged with recent games counting more (each older game 15% less). Box
// scores are incomplete, so the nudge is small and grows with games played.
// `until` lets us compare to the ratings before the last game.
const RECENT_DECAY = 0.85;
// The commissioner's starting rating for a player: their Overall slider (how good and
// impactful they are in a game, 40-99) when set; otherwise mostly their best skill
// tendency plus a little for their second-best.
const overallOf = (p) => (Number.isFinite(+p.tend?.ovr) ? Math.max(40, Math.min(99, Math.round(+p.tend.ovr))) : null);
function scoutRating(et, t, p) {
  if (overallOf(p) != null) return overallOf(p);
  const v = ['td', 'pass', 'int'].map((k) => et.player(t, p, k)).sort((a, b) => b - a);
  return Math.round(Math.max(40, Math.min(95, 40 + 0.45 * v[0] + 0.15 * v[1])));
}
function statRatings(db, until = null) {
  // Exhibitions count for player ratings.
  const games = db.games.filter((g) => isFinal(g) && (!until || g.date < until)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const mvpOf = new Map(games.map((g) => [g.id, gameMvp(db, g)]));
  const et = pk.effTend(db);
  const out = [];
  for (const t of Object.values(db.teams)) {
    const teamGames = games.filter((g) => g.home === t.id || g.away === t.id);
    for (const p of t.roster) {
      const tg = teamGames.filter((g) => !pk.isOut(g, t.id, p.id)); // games they actually played
      const gp = tg.length;
      const n = p.name.toLowerCase();
      const tot = { td: 0, pass: 0, int: 0, picked: 0, wins: 0, losses: 0, mvp: 0 };
      let wSum = 0, pSum = 0;
      tg.forEach((g, i) => {
        const x = { td: 0, pass: 0, int: 0, picked: 0, mvp: 0 };
        for (const e of g.events || []) {
          if (e.team === t.id && (e.player || '').toLowerCase() === n) { if (e.type === 'TD') x.td++; else if (e.type === 'INT') x.int++; }
          if (e.type === 'TD' && e.team === t.id && (e.passer || '').toLowerCase() === n) x.pass++;
          if (e.type === 'INT' && e.team !== t.id && (e.passer || '').toLowerCase() === n) x.picked++; // threw the pick
        }
        const m = mvpOf.get(g.id);
        if (m && m.team === t.id && m.name.toLowerCase() === n) x.mvp = 1;
        const w = winner(g), win = w === t.id ? 1 : 0, loss = w && w !== t.id ? 1 : 0;
        const prod = 6 * x.td + 4 * x.pass + 5 * x.int + 2 * x.mvp + 2 * win - 5 * x.picked - 2 * loss;
        const weight = Math.pow(RECENT_DECAY, gp - 1 - i); // newest game = 1
        wSum += weight; pSum += weight * prod;
        for (const k in x) tot[k] += x[k];
        tot.wins += win; tot.losses += loss;
      });
      const perGame = wSum ? pSum / wSum : 0;
      const trust = gp / (gp + 4); // how much the stats count vs. the 60 starting point
      // Diminishing returns going up; going down is straight-line so bad games always hurt.
      const value = perGame >= 0 ? 55 * (1 - Math.exp(-perGame / 15)) - 10 : -10 + 1.5 * perGame;
      // Box scores are incomplete, so games only nudge the scouting rating.
      const base = scoutRating(et, t, p);
      const r = Math.round(Math.max(40, Math.min(99, base + 0.4 * trust * value)));
      out.push({ t, p, r, base, ...tot, gp });
    }
  }
  return out.sort((a, b) => b.r - a.r || b.td - a.td);
}
// When the AI analyst has run, its ratings (and one-line takes) replace the formula.
// `until` (the ratings before the last game) uses the AI's previous run.
function ratings(db, until = null) {
  const out = statRatings(db, until);
  const A = db.ai?.players;
  if (!A) return out;
  const src = until ? db.ai.prev : A;
  if (!src) return until ? ratings(db) : out;
  for (const x of out) {
    const a = src[x.t.id + '|' + x.p.id];
    if (!a) continue;
    x.r = Math.max(40, Math.min(99, Math.round(a.r)));
    if (!until) x.ai = a.take;
  }
  return out.sort((a, b) => b.r - a.r || b.td - a.td);
}
const tier = (r) => (r >= 90 ? 'legend' : r >= 80 ? 'gold' : r >= 70 ? 'silver' : 'bronze');
const TIER_NAME = { legend: 'Legend', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function tradingCard(db, x, opts = {}) {
  const { t, p, r } = x;
  const tr = tier(r);
  const role = p.position || { qb: 'QB', def: 'DEF', skill: 'ATH' }[playerRole(db, t, p)];
  return `<a class="tcard ${tr}" href="${opts.link || `/players/${t.id}/${p.id}/card`}" style="--c:${esc(t.color)};--c2:${esc(t.color2)}">
    <div class="tc-shine"></div>
    <div class="tc-top"><div class="tc-r"><b>${r}</b><small>${esc(role)}</small></div>${logo(t, 30)}</div>
    <div class="tc-photo">${avatar(t, p, opts.big ? 200 : 140, 'xl')}</div>
    <div class="tc-name">${esc(p.name)}</div>
    <div class="tc-stats"><div><b>${x.td}</b><small>TD</small></div><div><b>${x.pass}</b><small>PASS</small></div><div><b>${x.int}</b><small>INT</small></div><div><b>${x.mvp}</b><small>MVP</small></div></div>
    <div class="tc-foot"><span>${TIER_NAME[tr]}</span><span>MFL 2026–27${p.number ? ' · #' + esc(p.number) : ''}</span></div>
  </a>`;
}

// ---------- AI analyst (Claude Haiku 5.5) ----------
const hashOf = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const playLabel = (e) => (e.type === 'TD' ? 'touchdown' : e.type === 'INT' ? 'interception' : e.type === 'PEN' ? `penalty: ${penName(e.pen).toLowerCase()}` : STATS[e.type].label.toLowerCase());
const secondRole = (e) => (e.type === 'TD' ? 'thrown_by' : e.type === 'INT' ? 'thrown_by_opponent' : e.type === 'SACK' ? 'qb_sacked' : e.type === 'CATCH' ? 'thrown_by' : e.type === 'PBU' ? 'thrown_by_opponent' : 'other');
// How much of a game's box score was recorded: complete (default), incomplete or unknown.
const BOX_STATUS = { complete: 'Complete', incomplete: 'Incomplete', unknown: 'Unknown' };
const boxStatus = (g) => (BOX_STATUS[g.boxStatus] ? g.boxStatus : 'complete');
const boxNote = (g) => ({ incomplete: 'Box score is incomplete: some plays from this game were not recorded, so player stats may be missing.', unknown: 'Box score unknown: the plays from this game were not recorded, so no player stats count from it.' })[boxStatus(g)] || '';
function aiGame(db, g) {
  const w = winner(g);
  return {
    date: g.date, type: g.type === 'playoff' ? `playoff (${bowlName(db, g.bowl)})` : g.type,
    score: { [db.teams[g.home].name]: g.homeScore, [db.teams[g.away].name]: g.awayScore },
    winner: w ? db.teams[w].name : 'tie',
    plays: (g.events || []).map((e) => ({ team: db.teams[e.team]?.name, play: playLabel(e), player: e.player || 'unknown', ...(e.passer ? { [secondRole(e)]: e.passer } : {}), ...(e.note ? { note: e.note } : {}) })),
    ...(g.notes ? { coach_notes: g.notes } : {}),
    ...(boxStatus(g) !== 'complete' ? { box_score: boxStatus(g) === 'unknown' ? 'unknown: plays were not recorded, do not read anything into missing stats' : 'incomplete: some plays are missing, stats undercount' } : {}),
    ...((g.out || []).length ? { did_not_play: g.out.map((k) => { const [tid, pid] = k.split('|'); return db.teams[tid]?.roster.find((p) => p.id === pid)?.name; }).filter(Boolean) } : {}),
  };
}
// Everything the rating depends on. previous_rating is added after hashing so a
// new run isn't triggered just because the last run changed it.
function aiRatingsInput(db) {
  const et = pk.effTend(db), base = statRatings(db);
  const games = db.games.filter(isFinal).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return {
    teams: Object.values(db.teams).map((t) => { const s = teamStats(db, t.id); return { name: t.name, record: record(s), points_for: s.pf, points_against: s.pa, tendencies: { offense: et.team(t, 'off'), defense: et.team(t, 'def'), interceptions: et.team(t, 'int') } }; }),
    players: base.map((x) => {
      const s = playerStats(db, x.t, x.p);
      return {
        key: x.t.id + '|' + x.p.id, name: x.p.name, team: x.t.name, status: tagName(x.p.tag) || undefined, position: x.p.position || undefined,
        ...(x.p.bio ? { bio: x.p.bio.slice(0, 400) } : {}),
        tendencies: { scores_tds: et.player(x.t, x.p, 'td'), throws_tds: et.player(x.t, x.p, 'pass'), gets_ints: et.player(x.t, x.p, 'int') },
        totals: { games_played: x.gp, td: s.td, td_passes: s.ptd, ints: s.int, threw_ints: s.picked, ...Object.fromEntries(Object.values(STATS).map((st) => [st.short.toLowerCase().replace(/ /g, '_'), s[st.key]])) },
        scouting_rating: x.base,
      };
    }),
    games: games.map((g) => aiGame(db, g)),
  };
}
function aiRecapInput(db, g) {
  return { game: aiGame(db, g), rosters: [g.home, g.away].map((id) => ({ team: db.teams[id].name, players: db.teams[id].roster.map((p) => ({ key: id + '|' + p.id, name: p.name })) })) };
}
function aiTeamInput(db, t) {
  const s = teamStats(db, t.id), rt = ratings(db).filter((x) => x.t.id === t.id);
  const next = db.games.filter((g) => (g.home === t.id || g.away === t.id) && g.status === 'scheduled' && g.date && g.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    team: teamFull(t), record: record(s), points_for: s.pf, points_against: s.pa, streak: s.streak || null, captain: t.captain,
    roster: rt.map((x) => ({ name: x.p.name, status: tagName(x.p.tag) || undefined, position: x.p.position || undefined, rating: x.r, ...(x.ai ? { analyst_take: x.ai } : {}) })),
    games: db.games.filter((g) => isFinal(g) && (g.home === t.id || g.away === t.id)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).map((g) => aiGame(db, g)),
    next_game: next ? { date: next.date, opponent: db.teams[otherTeam(next, t.id)].name, type: next.type } : null,
  };
}
const RECAP_COOLDOWN = 30 * 60 * 1000;
const recapBusy = new Set();
async function genGameRecap(id) {
  if (recapBusy.has(id)) return;
  recapBusy.add(id);
  try {
    const db = load(), g = db.games.find((x) => x.id === id);
    if (!g) return;
    const inp = aiRecapInput(db, g);
    const out = await ai.writeRecap(inp);
    const g2 = load().games.find((x) => x.id === id);
    if (!g2) return;
    const valid = inp.rosters.some((r) => r.players.some((p) => p.key === out.mvp_key));
    g2.aiRecap = { hash: recapHash(inp), text: String(out.recap || ''), story: (out.story || []).map(String).filter(Boolean).slice(0, 14), mvp: valid ? out.mvp_key : null, mvpWhy: String(out.mvp_reason || '').slice(0, 120), at: new Date().toISOString(), rewrittenAt: g2.aiRecap?.rewrittenAt };
    await save();
  } finally { recapBusy.delete(id); }
}
// Anyone can ask the AI for a fresh take on a game's recap, once every 30 minutes per game.
app.post('/games/:id/recap', async (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g || !isFinal(g)) return res.redirect('/');
  const back = (q) => res.redirect(`/games/${g.id}${q ? '?' + q : ''}#recap`);
  if (!ai.apiKey()) return back('ai=off');
  if (Date.now() - Date.parse(g.aiRecap?.rewrittenAt || 0) < RECAP_COOLDOWN) return back('ai=wait');
  try {
    await genGameRecap(g.id);
    const g2 = load().games.find((x) => x.id === g.id);
    if (g2?.aiRecap) { g2.aiRecap.rewrittenAt = new Date().toISOString(); await save(); }
    back('');
  } catch (e) { console.error('Game recap:', e); back('ai=err'); }
});
const TEAM_COOLDOWN = 5 * 60 * 1000;
const teamBusy = new Set();
async function genTeamRecap(id) {
  if (teamBusy.has(id)) return;
  teamBusy.add(id);
  try {
    let db = load();
    const inp = aiTeamInput(db, db.teams[id]);
    const out = await ai.writeTeamRecap(inp);
    db = load();
    (db.teamRecaps = db.teamRecaps || {})[id] = { hash: hashOf(inp), text: String(out.recap || ''), at: new Date().toISOString() };
    await save();
  } finally { teamBusy.delete(id); }
}
const RECAP_FORMAT = 2; // bump to rewrite every recap
const recapHash = (inp) => hashOf({ ...inp, format: RECAP_FORMAT });
function freshRecap(db, g) {
  const A = g.aiRecap;
  return A && A.hash === recapHash(aiRecapInput(db, g)) ? A : null;
}

const aiState = { running: false, again: false, timer: null, lastRun: null, lastError: null };
function scheduleAI(delay = 4000) {
  if (!ai.apiKey()) return;
  clearTimeout(aiState.timer);
  aiState.timer = setTimeout(runAI, delay);
}
async function runAI() {
  if (aiState.running) { aiState.again = true; return; }
  aiState.running = true;
  try {
    await refresh({ fresh: true });
    let db = load();
    // 1. A recap and MVP for each final game whose plays changed.
    for (const id of db.games.filter(isFinal).map((g) => g.id)) {
      db = load();
      const g = db.games.find((x) => x.id === id);
      if (!g || freshRecap(db, g)) continue;
      await genGameRecap(id);
    }
    // 2. Ratings for the whole league (after recaps, since the MVPs feed into them), only when something they depend on changed.
    db = load();
    const input = aiRatingsInput(db), h = hashOf(input);
    if (db.ai?.hash !== h) {
      const out = await ai.rateLeague(input);
      db = load();
      const keys = new Set(input.players.map((p) => p.key));
      const players = {};
      const scout = Object.fromEntries(input.players.map((p) => [p.key, p.scouting_rating]));
      for (const p of out.players || []) {
        if (!keys.has(p.key) || !Number.isFinite(p.rating)) continue;
        const b = scout[p.key], r = Math.max(b - 12, Math.min(b + 12, Math.round(p.rating))); // stay near the commissioner's scouting
        players[p.key] = { r: Math.max(40, Math.min(99, r)), take: String(p.take || '').slice(0, 200) };
      }
      const gamesKey = db.games.filter(isFinal).map((g) => g.id).sort().join(',');
      // "Previous" ratings (for the arrows) move forward only when a new game is in.
      // (v2 ratings are anchored to scouting; arrows don't compare against the old v1 ones.)
      const prev = db.ai?.v !== 2 ? null : db.ai.gamesKey !== gamesKey ? db.ai.players : db.ai.prev || null;
      db.ai = { v: 2, hash: h, at: new Date().toISOString(), model: ai.MODEL, summary: String(out.summary || ''), players, prev, gamesKey };
      await save();
    }
    // 3. Team summaries, when anything they cover changed.
    for (const id of Object.keys(load().teams)) {
      db = load();
      if (db.teamRecaps?.[id]?.hash !== hashOf(aiTeamInput(db, db.teams[id]))) await genTeamRecap(id);
    }
    // 4. Pre-game previews for the next few games.
    for (const g of upcomingForPreview(load())) {
      db = load();
      const inp = aiPreviewInput(db, g), hh = hashOf(inp);
      if (g.aiPreview?.hash === hh) continue;
      const out = await ai.writePreview(inp);
      const g2 = load().games.find((x) => x.id === g.id);
      if (!g2) continue;
      const keys = new Set(inp.teams.flatMap((t) => t.roster.filter((p) => !p.ruled_out).map((p) => p.key))); // never a player who's out
      g2.aiPreview = { hash: hh, text: String(out.preview || ''), ph: Math.max(0, out.predicted_home | 0), pa: Math.max(0, out.predicted_away | 0), watch: keys.has(out.watch_key) ? out.watch_key : null, why: String(out.watch_reason || '').slice(0, 160), at: new Date().toISOString() };
      await save();
    }
    // 4b. The pregame show for a bowl that's being hyped.
    { db = load(); const h = hypeBowl(db);
      if (h && h.g.status === 'scheduled') {
        const inp = { ...aiPreviewInput(db, h.g), bowl: { name: h.b.name, theme: h.th.tag } }, hh = hashOf(inp);
        if (h.g.aiBowlShow?.hash !== hh) {
          const out = await ai.writeBowlShow(inp);
          const g2 = load().games.find((x) => x.id === h.g.id);
          if (g2) {
            g2.aiBowlShow = { hash: hh, headline: String(out.headline || '').slice(0, 120), intro: String(out.intro || ''), sections: (out.sections || []).slice(0, 6).map((x) => ({ title: String(x.title || ''), body: String(x.body || '') })), ph: Math.max(0, out.predicted_home | 0), pa: Math.max(0, out.predicted_away | 0), call: String(out.call || '').slice(0, 240), at: new Date().toISOString() };
            await save();
          }
        }
      } }
    // 5. Scouting reports, for players whose numbers changed.
    for (const [tid, pid] of Object.values(load().teams).flatMap((t) => t.roster.map((p) => [t.id, p.id]))) {
      db = load();
      const t = db.teams[tid], p = t?.roster.find((x) => x.id === pid);
      if (!p) continue;
      const inp = aiScoutInput(db, t, p), hh = hashOf(inp);
      if (p.aiScout?.hash === hh) continue;
      const out = await ai.writeScouting(inp);
      const p2 = load().teams[tid]?.roster.find((x) => x.id === pid);
      if (!p2) continue;
      p2.aiScout = { hash: hh, report: String(out.report || ''), strengths: (out.strengths || []).slice(0, 4).map(String), grow: (out.grow || []).slice(0, 2).map(String), comparison: String(out.comparison || ''), at: new Date().toISOString() };
      await save();
    }
    // 6. The Midweek Recap, on Wednesdays.
    if (midweekDue(load())) await genMidweek(midweekDue(load()));
    aiState.lastError = null;
  } catch (e) {
    aiState.lastError = ai.describeError(e);
    console.error('AI analyst:', e);
  } finally {
    aiState.lastRun = new Date().toISOString();
    aiState.running = false;
    if (aiState.again) { aiState.again = false; scheduleAI(1000); }
  }
}

// ---------- more AI: previews, scouting, Midweek Recap, Ask the Analyst ----------
function rosterForAI(db, t, g) {
  const rt = Object.fromEntries(ratings(db).filter((x) => x.t.id === t.id).map((x) => [x.p.id, x]));
  return t.roster.map((p) => ({ key: t.id + '|' + p.id, name: p.name, rating: rt[p.id]?.r, ...(rt[p.id]?.ai ? { analyst_take: rt[p.id].ai } : {}), ...(p.position ? { position: p.position } : {}), ...(g && pk.isOut(g, t.id, p.id) ? { ruled_out: true } : {}) }));
}
function upcomingForPreview(db) {
  const t = today();
  return db.games.filter((g) => g.status === 'scheduled' && g.date && g.date >= t && g.date <= addDays(t, 7)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 3);
}
function aiPreviewInput(db, g) {
  const open = pk.isOpen(db, g, TZ), m = open ? pk.markets(db, g) : null;
  const finals = db.games.filter(isFinal).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 4);
  return {
    game: { date: g.date, home_key: g.home, away_key: g.away, type: g.type === 'playoff' ? `playoff (${bowlName(db, g.bowl)})` : g.type },
    teams: [g.home, g.away].map((id) => { const t = db.teams[id], st = teamStats(db, id); return { key: id, name: t.name, record: record(st), points_for: st.pf, points_against: st.pa, streak: st.streak || null, roster: rosterForAI(db, t, g) }; }),
    recent_games: finals.map((x) => aiGame(db, x)),
    ...(m ? { pickem_odds: { [db.teams[g.home].name]: Math.round((m.byKey[`ml:${g.home}`]?.p || 0) * 100) + '% to win', [db.teams[g.away].name]: Math.round((m.byKey[`ml:${g.away}`]?.p || 0) * 100) + '% to win' } } : {}),
  };
}
function aiScoutInput(db, t, p) {
  const et = pk.effTend(db), x = ratings(db).find((y) => y.t.id === t.id && y.p.id === p.id), s = playerStats(db, t, p);
  return {
    name: p.name, team: teamFull(t), status: tagName(p.tag) || undefined, position: p.position || undefined, number: p.number || undefined, bio: p.bio || undefined,
    power_rating: x?.r, scouting_rating: x?.base, analyst_take: x?.ai,
    tendencies: { scores_tds: et.player(t, p, 'td'), throws_tds: et.player(t, p, 'pass'), gets_ints: et.player(t, p, 'int') },
    totals: { games: s.log.length, td: s.td, td_passes: s.ptd, ints: s.int, threw_ints: s.picked, ...Object.fromEntries(Object.values(STATS).map((st) => [st.short.toLowerCase().replace(/ /g, '_'), s[st.key]])) },
    achievements: badges.playerBadges(db, t, p, (g) => mvpKeyOf(db, g)).map((b) => b[2]),
  };
}

// Midweek Recap: every Wednesday (from 7am league time), covering the week since last Wednesday.
function midweekDue(db) {
  const now = pk.nowLocal(TZ), d = now.slice(0, 10);
  if (new Date(d + 'T12:00:00Z').getUTCDay() !== 3 || now.slice(11) < '07:00') return null;
  return (db.midweek || []).some((x) => x.date === d) ? null : d;
}
async function genMidweek(date) {
  let db = load();
  const from = addDays(date, -7);
  const inWin = (ds) => ds > from && ds <= date;
  const now = ratings(db);
  const prevSnap = (db.midweek || []).at(-1)?.snapshot || null;
  const movers = prevSnap ? now.map((x) => ({ name: x.p.name, team: x.t.name, now: x.r, before: prevSnap[x.t.id + '|' + x.p.id] })).filter((x) => x.before != null && x.now !== x.before).sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before)).slice(0, 6) : [];
  const users = await listDocs('users/');
  const board = await leaderboard(db);
  const pickem = board.map((u) => { const bets = u.bets.filter((b) => b.status !== 'pending' && inWin(localDay(b.placed))); return { user: '@' + u.name, won: bets.filter((b) => b.status === 'won').length, lost: bets.filter((b) => b.status === 'lost').length, profit: bets.reduce((s, b) => s + (b.status === 'won' ? b.payout - b.stake : b.status === 'lost' ? -b.stake : 0), 0) }; }).filter((u) => u.won + u.lost).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const bigWins = board.flatMap((u) => u.bets.filter((b) => b.status === 'won' && inWin(localDay(b.placed))).map((b) => ({ user: '@' + u.name, payout: b.payout, picks: b.legs.map((l) => l.label) }))).sort((a, b) => b.payout - a.payout).slice(0, 3);
  const pulls = users.flatMap((u) => (u.packs || []).filter((p) => inWin(localDay(p.at))).flatMap((p) => p.cards.map((id) => ({ user: '@' + u.name, c: cards.cardInfo(db, id) })))).filter((x) => x.c && cards.RARITY_ORDER.indexOf(x.c.rarity) >= 2).map((x) => ({ user: x.user, card: `${x.c.p.name} ${x.c.label} (${x.c.rarityName})` })).slice(0, 8);
  const st = sv.survivorState(db, users, TZ);
  const input = {
    covering: { from_after: from, through: date },
    games: db.games.filter((g) => isFinal(g) && inWin(g.date)).sort((a, b) => a.date.localeCompare(b.date)).map((g) => aiGame(db, g)),
    standings: Object.values(db.teams).map((t) => ({ team: t.name, record: record(teamStats(db, t.id)) })),
    power_rankings_top10: now.slice(0, 10).map((x) => ({ name: x.p.name, team: x.t.name, rating: x.r })),
    rating_movers: movers,
    pickem_top: pickem, pickem_biggest_wins: bigWins, card_pulls: pulls,
    survivor: { round: st.round.n, alive: st.round.alive.length, champions: st.finished.map((f) => f.winner).filter(Boolean).map((n) => '@' + n) },
    upcoming: upcomingForPreview(db).map((g) => ({ date: g.date, matchup: matchName(db, g), ai_prediction: g.aiPreview ? `${g.aiPreview.ph}-${g.aiPreview.pa}` : null })),
  };
  const out = await ai.writeMidweek(input);
  db = load();
  db.midweek = (db.midweek || []).filter((x) => x.date !== date);
  db.midweek.push({ date, from, headline: String(out.headline || 'The Midweek Recap'), intro: String(out.intro || ''), sections: (out.sections || []).slice(0, 8).map((x) => ({ title: String(x.title), body: String(x.body) })), at: new Date().toISOString(), snapshot: Object.fromEntries(now.map((x) => [x.t.id + '|' + x.p.id, x.r])) });
  db.midweek.sort((a, b) => a.date.localeCompare(b.date));
  await save();
}
// Check for a due Midweek Recap every 15 minutes.
setInterval(() => { try { if (ai.apiKey() && midweekDue(load())) scheduleAI(1000); } catch {} }, 15 * 60 * 1000).unref();

const midweekBody = (x) => `<article class="mw">${x.sections.map((s) => `<section><h3>${esc(s.title)}</h3><p>${esc(s.body).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p></section>`).join('')}</article>`;
app.get(['/midweek', '/midweek/:date'], (req, res) => {
  const db = load();
  const all = [...(db.midweek || [])].reverse();
  const x = req.params.date ? all.find((m) => m.date === req.params.date) : all[0];
  if (req.params.date && !x) return res.status(404).send(layout(req, 'Not Found', pageHead('Midweek Recap', 'Issue not found')));
  res.send(layout(req, 'Midweek Recap', pageHead(`The Midweek Recap${x ? ' · ' + esc(longDate(x.date)) : ''}`, x ? x.headline : 'The Midweek Recap', x ? esc(x.intro) : 'A new issue drops every Wednesday, covering everything since the Wednesday before.') + `<div class="wrap home-grid">
    <div class="col">${x ? `<div class="card">${midweekBody(x)}<p class="muted sm">Written by the MFL's AI analyst · covering ${esc(shortDate(addDays(x.from, 1)))} to ${esc(shortDate(x.date))}</p></div>` : `<div class="card empty-pick">${icon('cal')}<h2>First issue coming Wednesday</h2><p class="muted">Check back then.</p></div>`}</div>
    <div class="col"><div class="card"><div class="card-h"><h2>Past issues</h2></div>${all.length ? `<ol class="lb">${all.map((m) => `<li><a href="/midweek/${m.date}"><b>${esc(shortDate(m.date))}</b></a><small>${esc(m.headline)}</small></li>`).join('')}</ol>` : '<p class="muted">None yet.</p>'}</div>
      <a class="card promo" href="/analyst"><div>${icon('star')}</div><div><b>Ask the Analyst</b><span>Got a question about the league? Ask our AI.</span></div>${icon('arrow')}</a></div>
  </div>`));
});

// Ask the Analyst: rate-limited so nobody can run up the bill.
const askLog = new Map(); let askDay = '', askToday = 0;
const ASK_EXAMPLES = ['Who is the best QB in the league?', 'Who wins the next game, and why?', 'Who should I pick in Survivor?', 'Who has been the most underrated player?', 'What should I pick in Pick\'em today?'];
function analystInput(db) {
  const next = pk.nextGame(db, TZ), m = next ? pk.markets(db, next) : null;
  return {
    today: today(),
    standings: Object.values(db.teams).map((t) => { const s = teamStats(db, t.id); return { team: teamFull(t), record: record(s), points_for: s.pf, points_against: s.pa, streak: s.streak || null }; }),
    power_rankings: ratings(db).map((x) => ({ name: x.p.name, team: x.t.name, rating: x.r, ...(x.ai ? { take: x.ai } : {}), td: x.td, td_passes: x.pass, ints: x.int, threw_ints: x.picked, mvps: x.mvp })),
    games: db.games.filter(isFinal).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 20).map((g) => aiGame(db, g)),
    next_game: next ? { date: next.date, matchup: matchName(db, next), ai_preview: next.aiPreview?.text, pickem_win_chance: m ? { [db.teams[next.home].name]: Math.round((m.byKey[`ml:${next.home}`]?.p || 0) * 100) + '%', [db.teams[next.away].name]: Math.round((m.byKey[`ml:${next.away}`]?.p || 0) * 100) + '%' } : null, top_player_picks: m ? m.list.filter((x) => x.key.startsWith('ptd:')).sort((a, b) => b.p - a.p).slice(0, 6).map((x) => ({ pick: x.label, chance: Math.round(x.p * 100) + '%' })) : [] } : null,
  };
}
const analystPage = (req, q = '', a = '', err = '') => layout(req, 'Ask the Analyst', pageHead('AI · Claude Haiku 5.5', 'Ask the Analyst', 'Ask anything about the MFL: players, teams, matchups, Pick\'em, Survivor.') + `<div class="wrap" style="max-width:860px">
  <form method="post" action="/analyst" class="card form ask"><label>Your question<textarea name="q" rows="3" maxlength="300" required placeholder="e.g. Who's the best defender in the league?">${esc(q)}</textarea></label>
    <div class="ask-ex">${ASK_EXAMPLES.map((x) => `<button type="button" class="chip" onclick="this.form.q.value=this.textContent">${esc(x)}</button>`).join('')}</div>
    <button class="btn" onclick="this.textContent='Thinking…'">${icon('star')} Ask</button>${ai.apiKey() ? '' : ' <span class="muted sm">The Analyst is not set up yet.</span>'}</form>
  ${err ? `<div class="card"><p class="err">${esc(err)}</p></div>` : ''}
  ${a ? `<div class="card ans"><div class="card-h"><h2>The Analyst</h2></div><p class="ans-q">"${esc(q)}"</p><p class="ans-a">${esc(a).replace(/\n/g, '<br>')}</p></div>` : ''}
</div>`);
app.get('/analyst', (req, res) => res.send(analystPage(req)));
app.post('/analyst', async (req, res) => {
  const q = String(req.body.q || '').trim().slice(0, 300);
  if (!q) return res.send(analystPage(req));
  if (!ai.apiKey()) return res.send(analystPage(req, q, '', 'The Analyst is not set up yet.'));
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const day = today();
  if (askDay !== day) { askDay = day; askToday = 0; askLog.clear(); }
  const mine = (askLog.get(ip) || []).filter((t) => Date.now() - t < 24 * 3600 * 1000);
  if (mine.length && Date.now() - mine[mine.length - 1] < 15000) return res.send(analystPage(req, q, '', 'One question every 15 seconds. Try again in a moment.'));
  if (mine.length >= 25 || askToday >= 400) return res.send(analystPage(req, q, '', "That's enough questions for today. Come back tomorrow!"));
  askLog.set(ip, [...mine, Date.now()]); askToday++;
  try {
    const out = await ai.answerQuestion({ question: q, league: analystInput(load()) });
    res.send(analystPage(req, q, String(out.answer || '')));
  } catch (e) { console.error('Analyst:', e); res.send(analystPage(req, q, '', "The Analyst couldn't answer right now. Try again soon.")); }
});

// ---------- fan polls: who wins (before the game) and fan MVP (after) ----------
const MVP_POLL_DAYS = 3;
function pollState(db, g) {
  const lock = `${g.date} ${pk.lockTime(g)}`, now = pk.nowLocal(TZ);
  return { winOpen: g.status === 'scheduled' && !!g.date && now < lock, mvpOpen: isFinal(g) && !!g.date && today() <= addDays(g.date, MVP_POLL_DAYS) };
}
function tally(g, kind) {
  const c = {};
  for (const v of Object.values(g.votes?.[kind] || {})) c[v] = (c[v] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function fanMvp(db, g) {
  const top = tally(g, 'mvp')[0];
  if (!top) return null;
  const [tid, pid] = top[0].split('|'), t = db.teams[tid], p = t?.roster.find((x) => x.id === pid);
  return p ? { t, p, votes: top[1] } : null;
}
function pollCard(db, g, req) {
  const st = pollState(db, g), me = currentUser(req), A = db.teams[g.home], B = db.teams[g.away];
  if (st.winOpen || (!isFinal(g) && Object.keys(g.votes?.win || {}).length)) {
    const t = tally(g, 'win'), n = t.reduce((s, x) => s + x[1], 0), mine = me && g.votes?.win?.[me];
    const pct = (id) => (n ? Math.round(((t.find((x) => x[0] === id)?.[1] || 0) / n) * 100) : 50);
    return `<div class="card poll" id="poll"><div class="card-h"><h2>Fan poll: who wins?</h2><span class="muted sm">${n} vote${n === 1 ? '' : 's'}</span></div>
      ${st.winOpen ? `<form method="post" action="/games/${g.id}/vote" class="poll-opts"><input type="hidden" name="kind" value="win">${[A, B].map((t) => `<button name="choice" value="${t.id}" class="poll-btn ${mine === t.id ? 'on' : ''}" style="--c:${esc(t.color)}">${logo(t, 28)} ${esc(t.name)}</button>`).join('')}</form>` : ''}
      <div class="winbar"><div style="width:${pct(A.id)}%;background:${esc(A.color)}"><span>${esc(A.abbr)} ${pct(A.id)}%</span></div><div style="width:${pct(B.id)}%;background:${esc(B.color)}"><span>${esc(B.abbr)} ${pct(B.id)}%</span></div></div>
      <p class="muted sm">${me ? (mine ? 'Your vote is in. You can change it until picks lock.' : 'Tap a team to vote.') : '<a href="/pickem/login">Log in</a> to vote.'}</p></div>`;
  }
  if (isFinal(g)) {
    const t = tally(g, 'mvp'), n = t.reduce((s, x) => s + x[1], 0), mine = me && g.votes?.mvp?.[me];
    if (!st.mvpOpen && !n) return '';
    const name = (k) => { const [tid, pid] = k.split('|'); return db.teams[tid]?.roster.find((p) => p.id === pid); };
    const players = [g.home, g.away].flatMap((tid) => db.teams[tid].roster.filter((p) => !pk.isOut(g, tid, p.id)).map((p) => ({ t: db.teams[tid], p })));
    return `<div class="card poll" id="poll"><div class="card-h"><h2>Fan MVP vote</h2><span class="muted sm">${n} vote${n === 1 ? '' : 's'}${st.mvpOpen ? ` · open ${MVP_POLL_DAYS} days` : ' · closed'}</span></div>
      ${t.length ? `<div class="poll-res">${t.slice(0, 5).map(([k, v]) => { const p = name(k), tm = db.teams[k.split('|')[0]]; return p ? `<div class="pr-row"><span class="th">${avatar(tm, p, 28)} ${esc(p.name)}</span><div class="pr-bar"><i style="width:${Math.round((v / n) * 100)}%;background:${esc(tm.color)}"></i></div><b>${v}</b></div>` : ''; }).join('')}</div>` : ''}
      ${st.mvpOpen ? (me ? `<form method="post" action="/games/${g.id}/vote" class="form poll-mvp"><input type="hidden" name="kind" value="mvp"><select name="choice" required><option value="">Pick your MVP…</option>${players.map(({ t, p }) => `<option value="${t.id}|${p.id}" ${mine === t.id + '|' + p.id ? 'selected' : ''}>${esc(p.name)} (${esc(t.abbr)})</option>`).join('')}</select><button class="btn sm">Vote</button></form>` : '<p class="muted sm"><a href="/pickem/login">Log in</a> to vote.</p>') : ''}</div>`;
  }
  return '';
}
app.post('/games/:id/vote', async (req, res) => {
  const me = currentUser(req);
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.redirect('/');
  if (!me) return res.redirect(`/pickem/login?next=/games/${g.id}`);
  const st = pollState(db, g), kind = String(req.body.kind), choice = String(req.body.choice || '');
  const ok = kind === 'win' ? st.winOpen && [g.home, g.away].includes(choice)
    : kind === 'mvp' ? st.mvpOpen && [g.home, g.away].some((tid) => choice.startsWith(tid + '|') && db.teams[tid].roster.some((p) => choice === tid + '|' + p.id && !pk.isOut(g, tid, p.id))) : false;
  if (ok) { ((g.votes = g.votes || {})[kind] = g.votes[kind] || {})[me] = choice; await save(); }
  res.redirect(`/games/${g.id}#poll`);
});

app.get('/stats/rankings', (req, res) => {
  const db = load();
  const now = ratings(db);
  const lastGame = db.games.filter((g) => isFinal(g)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const before = lastGame ? ratings(db, lastGame.date) : now;
  const prevRank = Object.fromEntries(before.map((x, i) => [x.t.id + '|' + x.p.id, i]));
  const byAI = !!db.ai?.players;
  res.send(layout(req, 'Power Rankings', pageHead('2026–27 Season', 'Power Rankings', byAI ? 'Every player rated 40–99 by our AI analyst, starting from scouting tendencies and updated from every game: stats, wins and losses, and the notes on each play.' : 'Every player rated 40–99, starting from the commissioner\'s scouting and nudged by every game: TDs, TD passes, INTs, MVPs and wins push it up; losses and getting picked off pull it down.') + `<div class="wrap">
    ${byAI && db.ai.summary ? `<div class="card ai-sum"><div class="card-h"><h2>${icon('star')} Analyst's take</h2><span class="muted sm">AI · updated ${esc(shortDate(localDay(db.ai.at)))}</span></div><p>${esc(db.ai.summary)}</p></div>` : ''}
    <div class="pr-top">${now.slice(0, 3).map((x) => tradingCard(db, x)).join('')}</div>
    <div class="card"><div class="scroll"><table class="tbl pr"><thead><tr><th>#</th><th></th><th class="l">Player</th><th class="l">Team</th><th>Rating</th><th>TD</th><th>Pass TD</th><th>INT</th><th>Picked</th><th>W-L</th><th>MVP</th></tr></thead><tbody>
    ${now.map((x, i) => { const pr = prevRank[x.t.id + '|' + x.p.id]; const mv = pr == null ? 0 : pr - i;
      return `<tr><td><b>${i + 1}</b></td><td class="mv ${mv > 0 ? 'up' : mv < 0 ? 'down' : ''}">${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '–'}</td><td class="l"><a class="plink" href="${playerUrl(x.t, x.p)}">${avatar(x.t, x.p, 30)}${esc(x.p.name)}</a></td><td class="l"><span class="th">${logo(x.t, 20)} ${esc(x.t.abbr)}</span></td><td><span class="rt ${tier(x.r)}" ${x.ai ? `title="${esc(x.ai)}"` : ''}>${x.r}</span></td><td>${x.td}</td><td>${x.pass}</td><td>${x.int}</td><td>${x.picked ? `<span class="down">${x.picked}</span>` : 0}</td><td>${x.wins}-${x.losses}</td><td>${x.mvp}</td></tr>`; }).join('')}
    </tbody></table></div><p class="muted sm">${byAI ? 'Rated by AI (Claude Haiku 5.5). Tap a player to see why.' : 'Includes every game, exhibitions too. Wins, TDs, TD passes, INTs and MVPs raise a rating; losses and throwing picks lower it.'} Arrows show movement since the last game.</p></div>
    <p><a class="btn ghost" href="/cards">${icon('star')} See every trading card</a></p>
  </div>`));
});

app.get('/cards', (req, res) => {
  const db = load();
  const all = ratings(db);
  res.send(layout(req, 'Trading Cards', pageHead('2026–27 Season', 'Trading Cards', 'Every MFL player. Ratings and stats update after every game. Tap a card to share it.') + `<div class="wrap">
    ${Object.values(db.teams).map((t) => `<div class="cards-team"><h2 class="th">${logo(t, 30)} ${esc(t.name)}</h2><div class="cards-grid">${all.filter((x) => x.t.id === t.id).map((x) => tradingCard(db, x)).join('')}</div></div>`).join('')}
  </div>`));
});

app.get('/players/:team/:pid/card', (req, res) => {
  const db = load();
  const x = ratings(db).find((y) => y.t.id === req.params.team && y.p.id === req.params.pid);
  if (!x) return res.redirect('/cards');
  const url = `/players/${x.t.id}/${x.p.id}/card`;
  res.send(layout(req, `${x.p.name} Card`, `<div class="wrap card-page">
    ${tradingCard(db, x, { big: true, link: playerUrl(x.t, x.p) })}
    <div class="card-side"><div class="kicker">${icon('star')} Trading card</div><h1>${esc(x.p.name)}</h1>
      <p class="muted">${TIER_NAME[tier(x.r)]} card · rated ${x.r} · ${esc(teamFull(x.t))}</p>
      <div class="actions"><button class="btn" type="button" onclick="mflShare('${url}','${esc(x.p.name).replace(/'/g, '')} MFL card')">Share card</button><a class="btn ghost" href="${playerUrl(x.t, x.p)}">Player page</a><a class="btn ghost" href="/cards">All cards</a></div>
      <p class="muted sm" id="shareMsg">Tip: screenshot the card to save it.</p></div>
  </div>${shareScript}`, { ticker: false }));
});

app.get('/records', (req, res) => {
  const db = load();
  const games = db.games.filter((g) => isFinal(g) && g.type !== 'exhibition');
  const single = { td: [], pass: [], int: [] };
  for (const g of db.games.filter(isFinal)) {
    const per = {};
    for (const e of g.events || []) {
      const add = (name, k) => { if (!name) return; const id = e.team + '|' + name; per[id] = per[id] || { team: e.team, name, td: 0, pass: 0, int: 0 }; per[id][k]++; };
      if (e.type === 'TD') { add(e.player, 'td'); add(e.passer, 'pass'); } else if (e.type === 'INT') add(e.player, 'int');
    }
    for (const p of Object.values(per)) for (const k of ['td', 'pass', 'int']) if (p[k]) single[k].push({ ...p, n: p[k], g });
  }
  const top = (arr) => arr.sort((a, b) => b.n - a.n || a.g.date.localeCompare(b.g.date))[0];
  const season = ratings(db);
  const best = (k) => [...season].sort((a, b) => b[k] - a[k])[0];
  const teamPts = games.flatMap((g) => [{ t: db.teams[g.home], n: g.homeScore, g }, { t: db.teams[g.away], n: g.awayScore, g }]).sort((a, b) => b.n - a.n)[0];
  const margin = [...games].sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0];
  const combined = [...games].sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0];
  let run = { team: null, n: 0 }, longest = { team: null, n: 0 };
  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) { const w = winner(g); run = w && w === run.team ? { team: w, n: run.n + 1 } : { team: w, n: w ? 1 : 0 }; if (run.n > longest.n) longest = { ...run }; }
  const rec = (title, value, who, sub) => `<div class="card rec"><small>${title}</small><b>${value ?? '–'}</b><span>${who || 'Not set yet'}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const pl = (x) => (x ? `${esc(x.name || x.p.name)} · ${esc(db.teams[x.team || x.t.id].abbr)}` : '');
  const gl = (g) => (g ? `<a href="/games/${g.id}">${esc(shortDate(g.date))}</a>` : '');
  const sTd = top(single.td), sPass = top(single.pass), sInt = top(single.int);
  const bTd = best('td'), bPass = best('pass'), bInt = best('int'), bMvp = best('mvp');
  res.send(layout(req, 'Records Book', pageHead('All-time', 'Records Book', 'The best single-game and season marks in MFL history. Player records include exhibitions; team records count official games only.') + `<div class="wrap">
    <h2 class="sec-h">Single game: players</h2><div class="rec-grid">
      ${rec('Most TDs', sTd?.n, pl(sTd), gl(sTd?.g))}${rec('Most TD passes', sPass?.n, pl(sPass), gl(sPass?.g))}${rec('Most INTs', sInt?.n, pl(sInt), gl(sInt?.g))}</div>
    <h2 class="sec-h">Single game: teams</h2><div class="rec-grid">
      ${rec('Most points', teamPts?.n, teamPts ? esc(teamPts.t.name) : '', gl(teamPts?.g))}${rec('Biggest win', margin ? Math.abs(margin.homeScore - margin.awayScore) : null, margin && winner(margin) ? esc(db.teams[winner(margin)].name) : '', gl(margin))}${rec('Most combined points', combined ? combined.homeScore + combined.awayScore : null, combined ? `${combined.homeScore}–${combined.awayScore}` : '', gl(combined))}</div>
    <h2 class="sec-h">Season leaders</h2><div class="rec-grid">
      ${rec('TDs', bTd?.td || null, bTd?.td ? pl(bTd) : '')}${rec('TD passes', bPass?.pass || null, bPass?.pass ? pl(bPass) : '')}${rec('INTs', bInt?.int || null, bInt?.int ? pl(bInt) : '')}${rec('Game MVPs', bMvp?.mvp || null, bMvp?.mvp ? pl(bMvp) : '')}${rec('Longest win streak', longest.n || null, longest.team ? esc(db.teams[longest.team].name) : '')}${rec('Top power rating', season[0]?.r, pl(season[0]))}</div>
  </div>`));
});

const shareScript = `<script>function mflShare(path,title){const url=(window.MFL_ORIGIN||location.origin)+path;if(navigator.share){navigator.share({title,url}).catch(()=>{});return}navigator.clipboard.writeText(url).then(()=>{const m=document.getElementById('shareMsg');if(m)m.textContent='Link copied! Paste it anywhere.';else alert('Link copied!')}).catch(()=>prompt('Copy this link:',url))}</script>`;

// ---------- pick'em: profiles, weekly board, daily bonus, sharing ----------
// Weeks run Monday-Sunday in league time.
function weekOf(ds) {
  const d = new Date(ds + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const localDay = (iso) => { const d = new Date(iso); return isNaN(d) ? today() : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); };
const betProfit = (b) => (b.status === 'won' ? b.payout - b.stake : b.status === 'lost' ? -b.stake : 0);
function weekBoard(board, wk) {
  return board.map((u) => {
    const bets = u.bets.filter((b) => b.status !== 'pending' && weekOf(localDay(b.placed)) === wk);
    return { name: u.name, profit: bets.reduce((s, b) => s + betProfit(b), 0), won: bets.filter((b) => b.status === 'won').length, lost: bets.filter((b) => b.status === 'lost').length, n: bets.length };
  }).filter((u) => u.n).sort((a, b) => b.profit - a.profit || b.won - a.won);
}
// Picker of the Week: best profit in each finished week (needs to be positive).
function weeklyWinners(board) {
  const thisWeek = weekOf(today());
  const weeks = new Set(board.flatMap((u) => u.bets.map((b) => weekOf(localDay(b.placed)))));
  const out = [];
  for (const wk of [...weeks].filter((w) => w < thisWeek).sort()) {
    const top = weekBoard(board, wk)[0];
    if (top && top.profit > 0) out.push({ week: wk, name: top.name, profit: top.profit });
  }
  return out;
}
function profileStats(db, acct) {
  const settled = acct.bets.filter((b) => b.status === 'won' || b.status === 'lost');
  const singles = settled.filter((b) => b.legs.length === 1), parlays = settled.filter((b) => b.legs.length > 1);
  const rate = (xs) => (xs.length ? Math.round((xs.filter((b) => b.status === 'won').length / xs.length) * 100) : 0);
  const best = acct.bets.filter((b) => b.status === 'won').sort((a, b) => b.payout - a.payout)[0];
  let streak = 0, kind = '';
  for (const b of [...settled].reverse()) { if (!kind) kind = b.status; if (b.status !== kind) break; streak++; }
  const favs = {};
  for (const b of acct.bets) for (const l of b.legs) { const m = /^p[a-z_0-9]*:([^:]+):(.+)$/.exec(l.key); if (m) { const k = m[1] + '|' + m[2]; favs[k] = (favs[k] || 0) + 1; } }
  const favKey = Object.entries(favs).sort((a, b) => b[1] - a[1])[0];
  let fav = null;
  if (favKey) { const [tid, pid] = favKey[0].split('|'); const t = db.teams[tid]; const p = t?.roster.find((x) => x.id === pid); if (p) fav = { t, p, n: favKey[1] }; }
  return { settled: settled.length, winRate: rate(settled), singles: { n: singles.length, rate: rate(singles) }, parlays: { n: parlays.length, rate: rate(parlays) }, best, streak: streak ? `${kind === 'won' ? 'W' : 'L'}${streak}` : '–', fav, staked: acct.bets.reduce((s, b) => s + b.stake, 0) };
}

// Daily bonus: 50 coins, +10 for each day in a row (up to +50), once per day.
const DAILY_BASE = 50;
function dailyInfo(user) {
  const days = new Set((user.bonuses || []).filter((b) => b.reason === 'Daily').map((b) => b.day));
  const t = today();
  let streak = 0;
  for (let d = addDays(t, -1); days.has(d); d = addDays(d, -1)) streak++;
  return { claimed: days.has(t), streak, amount: DAILY_BASE + 10 * Math.min(streak, 5) };
}
function dailyCard(user) {
  if (!user) return '';
  const d = dailyInfo(user);
  if (d.claimed) return `<div class="card daily done">${icon('coin')}<div><b>Daily bonus claimed</b><span>Come back tomorrow${d.streak + 1 > 1 ? ` to keep your ${d.streak + 1}-day streak` : ''}.</span></div></div>`;
  return `<form method="post" action="/pickem/daily" class="card daily">${icon('coin')}<div><b>Daily bonus: ${d.amount} coins</b><span>${d.streak ? `${d.streak}-day streak! ` : ''}Log in every day for up to ${DAILY_BASE + 50}.</span></div><button class="btn">Claim</button></form>`;
}
app.post('/pickem/daily', async (req, res) => {
  const name = currentUser(req);
  if (!name) return res.redirect('/pickem/login');
  const user = await getDoc(userKey(name), { fresh: true });
  if (user) {
    const d = dailyInfo(user);
    if (!d.claimed) {
      (user.bonuses = user.bonuses || []).push({ amount: d.amount, reason: 'Daily', day: today(), at: new Date().toISOString() });
      await putDoc(userKey(name), user);
    }
  }
  res.redirect(req.get('referer')?.includes('/pickem') ? new URL(req.get('referer')).pathname : '/pickem');
});

const betLink = (owner, b) => `/pickem/ticket/${owner}/${b.id}`;
function shareBtn(owner, b) {
  return `<button type="button" class="tkt-share" onclick="mflShare('${betLink(owner, b)}','My MFL ${b.legs.length > 1 ? b.legs.length + '-pick combo' : 'pick'}')">${icon('arrow')} Share</button>`;
}

app.get('/pickem/u/:name', async (req, res, next) => {
  try {
    const db = load();
    const me = currentUser(req);
    const uname = String(req.params.name).toLowerCase();
    const user = pk.validName(uname) ? await getDoc(userKey(uname)) : null;
    if (!user) return res.status(404).send(layout(req, 'Not Found', pageHead("Pick'em", 'Player not found')));
    const board = await leaderboard(db);
    const acct = board.find((u) => u.name === uname);
    const st = profileStats(db, acct);
    const rank = board.findIndex((u) => u.name === uname) + 1;
    const botw = weeklyWinners(board).filter((w) => w.name === uname);
    const ubadges = badges.userBadges({ db, acct, user, weeklyWins: botw.length, survivorWins: acct.points.survivor / sv.PRIZE, fantasy: acct.points.fan });
    const mine = me === uname;
    const { user: viewer, acct: vAcct } = await loadAccount(db, me);
    const tile = (k, v, cls = '') => `<div class="card"><small>${k}</small><b class="${cls}">${v}</b></div>`;
    const canBail = mine && canBailout(user, acct);
    res.send(layout(req, `@${uname}`, pickHead(viewer, vAcct) + `<div class="wrap">${pickNav(mine ? '/pickem/me' : '', me)}
      <div class="prof card">
        <div class="prof-av">${esc(uname.slice(0, 2).toUpperCase())}</div>
        <div><h2>@${esc(uname)}</h2><p class="muted">#${rank} of ${board.length} · joined ${esc(shortDate(localDay(user.created)))}</p>
          <div class="badges">${botw.map((w) => `<span class="badge-b">${icon('star')} Picker of the Week · ${esc(shortDate(w.week))}</span>`).join('')}${st.winRate >= 60 && st.settled >= 5 ? '<span class="badge-b hot">🔥 Sharp</span>' : ''}${st.best && st.best.odds >= 10 ? '<span class="badge-b">💰 Long-shot hitter</span>' : ''}</div></div>
        <div class="prof-bal">${coins(acct.balance)}<small>coins</small></div>
        <div class="prof-acts"><a class="btn sm ghost" href="/pickem/collection/${esc(uname)}">${icon('star')} See their cards</a>${me && !mine ? `<a class="btn sm" href="/pickem/trade/${esc(uname)}">${icon('swap')} Offer a trade</a>` : ''}</div>
      </div>
      ${ubadges.length ? `<div class="card"><div class="card-h"><h2>Achievements</h2><span class="muted sm">${ubadges.length} of ${badges.USER_BADGES.length}</span></div><div class="achv">${ubadges.map(([, e, n, d]) => `<div class="achv-b" title="${esc(d)}"><span>${e}</span><b>${esc(n)}</b><small>${esc(d)}</small></div>`).join('')}</div></div>` : ''}
      ${mine ? dailyCard(user) : ''}
      ${canBail ? `<form method="post" action="/pickem/bailout" class="card bail"><div><b>Out of coins?</b><p class="muted">Get a ${pk.BAILOUT_COINS} coin bailout and keep playing.</p></div><button class="btn">Claim ${pk.BAILOUT_COINS} coins</button></form>` : ''}
      <div class="stats-row six">${tile('Starting 8', coins(acct.points.fantasy))}${tile('Profit', signed(acct.profit), acct.profit >= 0 ? 'up' : 'down')}${tile('Record', `${acct.won}-${acct.lost}`)}${tile('Win rate', st.winRate + '%')}${tile('Streak', st.streak)}${tile('Singles', `${st.singles.rate}% <small>of ${st.singles.n}</small>`)}${tile('Combos', `${st.parlays.rate}% <small>of ${st.parlays.n}</small>`)}</div>
      ${mine ? `<details class="card pw-card" id="password" ${req.query.pw ? 'open' : ''}><summary><h2>Change password</h2>${icon('chev')}</summary>
        ${req.query.pw === 'ok' ? '<p class="toast">Password changed ✓</p>' : req.query.pw ? `<p class="err">${esc(req.query.pw)}</p>` : ''}
        <form method="post" action="/pickem/password" class="form pw-form">
          <label>Current password <small class="muted">(or your old 4-digit PIN)</small><input type="password" name="current" required maxlength="72" autocomplete="current-password"></label>
          <label>New password <small class="muted">(at least 6 characters)</small><input type="password" name="password" required minlength="6" maxlength="72" autocomplete="new-password"></label>
          <label>New password again<input type="password" name="again" required minlength="6" maxlength="72" autocomplete="new-password"></label>
          <button class="btn">Change password</button>
          <p class="muted sm">Forgot your current password? Ask the league admin to reset it.</p>
        </form></details>` : ''}
      <p class="muted sm">Pick points are just for bragging rights: every winning pick earns 10, plus 5 for each extra combo pick and more for long shots.</p>
      <div class="home-grid"><div class="col">
        <div class="card-h"><h2>Pick history</h2><span class="muted sm">${acct.bets.length} picks · ${st.staked.toLocaleString('en-US')} coins played</span></div>
        <div class="tkts">${[...acct.bets].reverse().map((b) => betCard(db, b, { owner: uname })).join('') || '<div class="card"><p class="muted">No picks yet.</p></div>'}</div>
      </div><div class="col">
        ${st.best ? `<div class="card"><div class="card-h"><h2>${icon('fire')} Best hit</h2></div>${betCard(db, st.best, { owner: uname })}</div>` : ''}
        ${st.fav ? `<div class="card"><div class="card-h"><h2>Favorite player to pick</h2></div><a class="lead-top" href="${playerUrl(st.fav.t, st.fav.p)}" style="--a:${esc(st.fav.t.color)}">${avatar(st.fav.t, st.fav.p, 56)}<div><small>${logo(st.fav.t, 16)} ${esc(st.fav.t.name)}</small><b>${esc(st.fav.p.name)}</b></div><span>${st.fav.n}</span></a><p class="muted sm">Picks on this player</p></div>` : ''}
      </div></div>
    </div>${shareScript}`));
  } catch (e) { next(e); }
});

// Public page for one bet, so people can share their parlays and others can tail them.
app.get('/pickem/ticket/:name/:id', async (req, res, next) => {
  try {
    const db = load();
    const uname = String(req.params.name).toLowerCase();
    const user = pk.validName(uname) ? await getDoc(userKey(uname)) : null;
    const bet = user && pk.account(db, user).bets.find((b) => b.id === req.params.id);
    if (!pick) return res.status(404).send(layout(req, 'Not Found', pageHead("Pick'em", 'Pick not found')));
    const me = currentUser(req);
    const { user: viewer, acct } = await loadAccount(db, me);
    const open = bet.legs.every((l) => pk.isOpen(db, db.games.find((g) => g.id === l.game), TZ));
    const legs = bet.legs.map((l) => { const g = db.games.find((x) => x.id === l.game); const m = g && pk.markets(db, g).byKey[l.key]; return m ? { game: g.id, key: l.key, label: m.label, odds: m.odds, match: matchName(db, g) } : null; });
    const canTail = open && legs.every(Boolean);
    res.send(layout(req, `@${uname}'s ${bet.legs.length > 1 ? 'combo' : 'pick'}`, pickHead(viewer, acct) + `<div class="wrap share-tkt">
      <div class="kicker">${icon('coin')} Shared pick</div><h1>@${esc(uname)}'s ${bet.legs.length > 1 ? `${bet.legs.length}-pick combo` : 'pick'}</h1>
      ${betCard(db, bet, { owner: uname })}
      ${canTail ? `<button type="button" class="combo btn tail" data-legs="${legsAttr(legs)}">${icon('coin')} Copy these picks (${oddsTxt(legs.reduce((x, l) => x * l.odds, 1))} now)</button>` : `<p class="muted">${bet.status === 'pending' ? 'Picks are closed for this game.' : 'This pick is settled.'} <a href="/pickem">See the next game →</a></p>`}
      <p><a href="/pickem/u/${esc(uname)}">See @${esc(uname)}'s profile →</a></p>
    </div>${canTail ? slip(viewer) : ''}${shareScript}`));
  } catch (e) { next(e); }
});

// ---------- admin ----------
const adminNav = (cur) => `<div class="seg admin-seg">${[['/admin', 'Games'], ['/admin/game/new', '+ New game'], ['/admin/players', 'Players'], ['/admin/teams', 'Teams'], ['/admin/transactions', 'Transactions'], ['/admin/pickem', "Pick'em"], ['/admin/arcade', 'Arcade'], ['/admin/looks', 'Game looks'], ['/admin/tendencies', 'Tendencies'], ['/admin/bowls', 'Bowls'], ['/admin/ai', 'AI'], ['/admin/logout', 'Log out']].map(([h, n]) => `<a class="${cur === h ? 'on' : ''}" href="${h}">${n}</a>`).join('')}</div>`;
const savedMsg = (req) => (req.query.saved ? '<div class="toast">Saved ✓</div>' : '');

app.get('/admin/login', (req, res) => {
  res.send(layout(req, 'Admin Login', `<div class="wrap login"><form method="post" class="card form">
    <img src="/static/mfl-logo.webp" alt="" class="login-logo"><h2>Admin</h2>
    ${adminPasswordSet() ? '' : '<p class="muted sm">No admin password yet. Choose one (at least 8 characters).</p>'}
    ${req.query.bad ? `<p class="err">${adminPasswordSet() ? 'Wrong password.' : 'Use at least 8 characters.'}</p>` : ''}<label>Password<input type="password" name="password" autofocus required></label><button class="btn">${adminPasswordSet() ? 'Log in' : 'Set password'}</button></form></div>`, { ticker: false }));
});
app.post('/admin/login', (req, res) => {
  const p = String(req.body.password || '');
  if (!adminPasswordSet()) {
    if (p.length < 8 || p.length > 72) return res.redirect('/admin/login?bad=1');
    Object.assign(adminAuth, pk.hashPin(p));
    require('fs').writeFileSync(AUTH_FILE, JSON.stringify(adminAuth));
  } else if (!adminPasswordOk(p)) return res.redirect('/admin/login?bad=1');
  setAdminCookie(req, res);
  res.redirect('/admin');
});
app.get('/admin/logout', (req, res) => { res.setHeader('Set-Cookie', 'mfl_admin=; Path=/; Max-Age=0'); res.redirect('/'); });

app.get('/admin', requireAdmin, (req, res) => {
  const db = load();
  const t = today();
  const all = req.query.show === 'all';
  let games = [...db.games].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  if (!all) games = games.filter((g) => !g.date || (g.date >= addDays(t, -14) && g.date <= addDays(t, 14)));
  // The game to enter next: today's, else the most recent one still missing a result, else the next one.
  const sorted = [...db.games].filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  const focus = sorted.find((g) => g.date === t && g.status !== 'postponed') || [...sorted].reverse().find((g) => g.date < t && g.status === 'scheduled') || sorted.find((g) => g.date > t && g.status === 'scheduled');
  const fa = focus && db.teams[focus.home], fb = focus && db.teams[focus.away];
  const focusCard = focus ? `<a class="card admin-focus" href="/admin/game/${focus.id}" style="--a:${esc(fa.color)};--b:${esc(fb.color)}">
      <div><span class="kicker">${focus.date === t ? 'Today' : focus.date < t ? 'Needs a result' : 'Up next'}</span><b>${logo(fa, 34)} ${esc(fa.name)} <i>vs</i> ${esc(fb.name)} ${logo(fb, 34)}</b><small>${esc(longDate(focus.date))} · ${time12(focus.time)}${gameLabel(db, focus) ? ' · ' + esc(gameLabel(db, focus)) : ''}</small></div>
      <span class="btn">${isFinal(focus) ? 'Edit box score' : 'Enter result'} ${icon('arrow')}</span></a>` : '';
  res.send(layout(req, 'Admin', pageHead('Admin', 'Manage Games') + `<div class="wrap">${adminNav('/admin')}${savedMsg(req)}${focusCard}
    <p class="muted">${all ? '<a href="/admin">Show only ±2 weeks</a>' : 'Showing games within 2 weeks of today · <a href="/admin?show=all">Show all</a>'}</p>
    <div class="card"><div class="scroll"><table class="tbl admin"><thead><tr><th class="l">Date</th><th class="l">Matchup</th><th>Type</th><th>Status</th><th>Score</th><th></th></tr></thead><tbody>
    ${games.map((g) => `<tr class="${g.date === t ? 'today' : ''}" onclick="if(!event.target.closest('a'))this.querySelector('a').click()"><td class="l">${esc(shortDate(g.date))}</td><td class="l">${esc(db.teams[g.home].abbr)} vs ${esc(db.teams[g.away].abbr)}</td><td>${esc(gameLabel(db, g) || 'Regular')}</td><td>${statusBadge(g)}</td><td>${isFinal(g) ? `${g.homeScore}–${g.awayScore}` : ''}</td><td class="r"><a class="btn sm ${!isFinal(g) && g.status !== 'postponed' && g.date && g.date <= t ? 'go' : ''}" href="/admin/game/${g.id}">${isFinal(g) ? 'Edit' : g.date && g.date <= t && g.status !== 'postponed' ? 'Enter result' : 'Edit'}</a></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><div class="card-h"><h2>Backup</h2></div>
      <p class="muted sm">One file with all league data, Pick'em accounts and photos. Restoring replaces everything with the file's contents.</p>
      <p><a class="btn sm" href="/admin/backup.json">Download backup</a></p>
      <form id="restore"><input type="file" accept="application/json,.json" required> <button class="btn sm">Restore from file</button> <span class="muted sm" id="restoreMsg"></span></form>
    </div></div>
    <script>document.getElementById('restore').addEventListener('submit',async(e)=>{e.preventDefault();const f=e.target.querySelector('input').files[0],m=document.getElementById('restoreMsg');if(!f||!confirm('Replace ALL site data with this backup?'))return;m.textContent='Restoring…';try{const r=await fetch('/admin/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:await f.text()});const d=await r.json();m.textContent=d.ok?'Restored: '+d.docs+' accounts, '+d.media+' photos.':d.error}catch(err){m.textContent='Restore failed.'}});</script>`, { ticker: false }));
});
app.get('/admin/ai', requireAdmin, (req, res) => {
  const db = load();
  const src = ai.keySource(), key = ai.apiKey();
  const recaps = db.games.filter((g) => isFinal(g) && freshRecap(db, g)).length, finals = db.games.filter(isFinal).length;
  res.send(layout(req, 'AI', pageHead('Admin', 'AI Analyst') + `<div class="wrap">${adminNav('/admin/ai')}${savedMsg(req)}
    <div class="card"><div class="card-h"><h2>What it does</h2><span class="muted sm">${ai.MODEL}</span></div>
      <p class="muted">After you save a game, a player, a trade or tendencies, Claude Haiku 5.5 re-rates every player for the power rankings and trading cards, and writes the recap and picks the MVP for any game whose plays changed. It starts from the tendencies, then uses the box scores and reads the notes (a note like "tipped by Pedon" gives Pedon partial credit). Without a key, the site uses the built-in formula.</p></div>
    <div class="card"><div class="card-h"><h2>Status</h2></div>
      <p>${key ? `Key: <b>set</b> (${src === 'variable' ? 'from the ANTHROPIC_API_KEY variable' : 'saved here'}, ends in <code>${esc(key.slice(-4))}</code>)` : 'Key: <b>not set</b>'}</p>
      <p>Ratings: ${db.ai?.at ? `updated ${esc(new Date(db.ai.at).toLocaleString('en-US', { timeZone: TZ }))}` : 'not run yet'} · Recaps: ${recaps} of ${finals} final games</p>
      <p>${aiState.running ? '<b>Running now…</b>' : aiState.lastRun ? `Last run ${esc(new Date(aiState.lastRun).toLocaleString('en-US', { timeZone: TZ }))}` : ''}${aiState.lastError ? ` · <span class="err">${esc(aiState.lastError)}</span>` : ''}</p>
      <form method="post" action="/admin/ai/run" style="display:inline"><button class="btn sm" ${key ? '' : 'disabled'}>Run now</button></form>
      <form method="post" action="/admin/ai/midweek" style="display:inline"><button class="btn sm ghost" ${key ? '' : 'disabled'}>Write this week's Midweek Recap now</button></form>
    </div>
    ${src === 'variable' ? '' : `<div class="card"><div class="card-h"><h2>API key</h2></div>
      <form method="post" action="/admin/ai/key" class="form"><label>Anthropic API key<input name="key" type="password" autocomplete="off" placeholder="sk-ant-…"></label>
      <p class="muted sm">Stored only on the server, never in backups. Leave it blank and save to remove it.</p><button class="btn">Save key</button></form></div>`}
  </div>`, { ticker: false }));
});
app.post('/admin/ai/key', requireAdmin, (req, res) => {
  const key = String(req.body.key || '').trim();
  if (key && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) return res.redirect('/admin/ai?err=1');
  ai.setApiKey(key || null);
  res.redirect('/admin/ai?saved=1');
});
app.post('/admin/ai/midweek', requireAdmin, async (req, res) => {
  // The issue for the most recent Wednesday (today if it's Wednesday).
  let d = today();
  while (new Date(d + 'T12:00:00Z').getUTCDay() !== 3) d = addDays(d, -1);
  try { await genMidweek(d); res.redirect('/midweek'); } catch (e) { aiState.lastError = ai.describeError(e); res.redirect('/admin/ai'); }
});
app.post('/admin/ai/run', requireAdmin, (req, res) => {
  const db = load();
  delete db.ai?.hash; // force a fresh rating run
  scheduleAI(100);
  res.redirect('/admin/ai?saved=1');
});

app.get('/admin/backup.json', requireAdmin, async (req, res, next) => {
  try {
    res.set('Content-Disposition', `attachment; filename="mfl-backup-${today()}.json"`).json(await exportAll());
  } catch (e) { next(e); }
});
app.post('/admin/restore', requireAdmin, express.json({ limit: '60mb' }), async (req, res) => {
  try { res.json({ ok: true, ...(await importAll(req.body)) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

// Player picker for the box score: that team's roster. A saved name that isn't on the
// roster anymore (traded, renamed) stays selectable so editing doesn't lose it.
function rosterSelect(tm, name, cur, placeholder) {
  const names = tm.roster.map((p) => p.name);
  const extra = cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase()) ? [cur] : [];
  return `<select name="${name}" class="ev-sel ${cur ? '' : 'empty'}" onchange="this.classList.toggle('empty',!this.value)">
    <option value="">${esc(placeholder)}</option>
    ${[...names, ...extra].map((n) => `<option value="${esc(n)}" ${cur && n.toLowerCase() === cur.toLowerCase() ? 'selected' : ''}>${esc(n)}${extra.includes(n) ? ' (not on roster)' : ''}</option>`).join('')}
  </select>`;
}
// Short names and hints for the play builder.
const PLAY_TYPES = [
  ['TD', 'Touchdown', 'td', 'Who scored?'],
  ['INT', 'Interception', 'int', 'Who intercepted it?'],
  ...Object.entries(STATS).map(([k, st]) => [k, st.label, st.tag, st.who]),
];
function gameForm(db, g, isNew) {
  const teams = Object.values(db.teams);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const t1 = db.teams[g.home] || teams[0], t2 = db.teams[g.away] || teams[1];
  // Every play row posts all five fields so the arrays stay aligned in readGame.
  const evRow = (e) => {
    const tm = db.teams[e.team] || t1, opp = tm.id === t1.id ? t2 : t1;
    const type = EV_TYPES.includes(e.type) ? e.type : 'TD', st = STATS[type];
    const tag = type === 'TD' ? ['td', 'Touchdown'] : type === 'INT' ? ['int', 'Interception'] : [st.tag, st.label];
    const second = type === 'TD' ? rosterSelect(tm, 'ev_passer', e.passer, 'Thrown by (or a run)')
      : type === 'INT' ? rosterSelect(opp, 'ev_passer', e.passer, 'Thrown by (who got picked?)')
      : st.by ? rosterSelect(st.side === 'same' ? tm : opp, 'ev_passer', e.passer, st.by) : '<input type="hidden" name="ev_passer" value="">';
    const pen = type === 'PEN' ? `<select name="ev_pen">${Object.entries(PENALTIES).map(([k, n]) => `<option value="${k}" ${(e.pen || 'PI') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '<input type="hidden" name="ev_pen" value="">';
    const ph = type === 'PEN' ? 'Note (optional), e.g. wiped out a TD' : type === 'PLAY' ? 'What happened? e.g. blocked the ball at the line' : type === 'CATCH' ? 'What happened? e.g. one-handed in traffic' : 'Note (optional), e.g. tipped by Pedon';
    return `<div class="ev ev-${tag[0]}" style="--c:${esc(tm.color)}">
      <input type="hidden" name="ev_type" value="${type}"><input type="hidden" name="ev_team" value="${esc(tm.id)}">
      <div class="ev-who"><span class="ev-n"></span>${logo(tm, 28)}<span class="tag ${tag[0]}">${tag[1]}</span></div>
      <div class="ev-fields">
        ${rosterSelect(tm, 'ev_player', e.player, type === 'TD' ? 'Who scored?' : type === 'INT' ? 'Who intercepted?' : st.who)}
        ${pen}${second}
        <input name="ev_note" class="ev-note" placeholder="${ph}" value="${esc(e.note)}">
      </div>
      <div class="ev-act">
        <button type="button" onclick="mflMove(this,-1)" aria-label="Move up" title="Move up">↑</button>
        <button type="button" onclick="mflMove(this,1)" aria-label="Move down" title="Move down">↓</button>
        <button type="button" class="ev-x" onclick="mflRemove(this)" aria-label="Remove play" title="Remove">✕</button>
      </div>
    </div>`;
  };
  const tpl = teams.flatMap((t) => EV_TYPES.map((type) => `<template id="tpl-${t.id}-${type}">${evRow({ team: t.id, type })}</template>`)).join('');
  const statusPills = [['scheduled', 'Scheduled'], ['live', 'Live'], ['final', 'Final'], ['postponed', 'Postponed']]
    .map(([v, n]) => `<label class="pill-r"><input type="radio" name="status" value="${v}" ${g.status === v ? 'checked' : ''}><span>${n}</span></label>`).join('');
  // The play builder: pick a team, pick the play, tap the player.
  const builder = `<div class="bsb" id="pb">
    <div class="pb-step"><span>1</span>Team</div>
    <div class="pb-teams">${[t1, t2].map((t, i) => `<button type="button" class="pb-team ${i ? '' : 'on'}" data-team="${t.id}" style="--c:${esc(t.color)}">${logo(t, 30)}<b>${esc(t.name)}</b></button>`).join('')}</div>
    <div class="pb-step"><span>2</span>Play</div>
    <div class="pb-types">${PLAY_TYPES.map(([k, n, cls, hint], i) => `<button type="button" class="pb-type ${cls} ${i ? '' : 'on'}" data-type="${k}" data-hint="${esc(hint)}">${esc(n)}</button>`).join('')}</div>
    <div class="pb-step"><span>3</span><em id="pbHint">Who scored?</em> <small class="muted">Tap a player to add the play</small></div>
    ${[t1, t2].map((t, i) => `<div class="pb-roster" data-team="${t.id}" ${i ? 'hidden' : ''}>${t.roster.map((p) => `<button type="button" class="pb-p" data-name="${esc(p.name)}">${avatar(t, p, 34)}<span>${esc(p.name)}</span></button>`).join('')}<button type="button" class="pb-p pb-unk" data-name=""><span class="av" style="background:var(--card2)">?</span><span>Unknown</span></button></div>`).join('')}
  </div>`;
  const evs = g.events || [];
  return `<form method="post" class="form ge" id="gameForm">
    <input type="hidden" name="home" value="${esc(t1.id)}"><input type="hidden" name="away" value="${esc(t2.id)}">

    <section class="card">
      <div class="card-h"><h2>Result</h2></div>
      <div class="pills">${statusPills}</div>
      <div class="sb">
        <label class="sb-team">${logo(t1, 64)}<b>${esc(t1.name)}</b><input type="number" min="0" inputmode="numeric" name="homeScore" value="${esc(g.homeScore ?? '')}" placeholder="–"></label>
        <span class="sb-vs">VS</span>
        <label class="sb-team">${logo(t2, 64)}<b>${esc(t2.name)}</b><input type="number" min="0" inputmode="numeric" name="awayScore" value="${esc(g.awayScore ?? '')}" placeholder="–"></label>
      </div>
      <div class="tdsum" id="tdSum" hidden><span></span><button type="button" class="btn sm ghost" onclick="mflUseScore()">Use this score</button></div>
      <p class="muted sm center">Set the status to <b>Final</b> and enter both scores to post the result.</p>
    </section>

    <section class="card">
      <div class="card-h"><h2>Box Score</h2><span class="muted sm" id="evCount">${evs.length} play${evs.length === 1 ? '' : 's'}</span></div>
      <div class="box-st"><span class="muted sm">Box score is</span><div class="pills">${Object.entries(BOX_STATUS).map(([v, n]) => `<label class="pill-r"><input type="radio" name="boxStatus" value="${v}" ${boxStatus(g) === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      ${builder}
      <div id="evs">${evs.map(evRow).join('')}</div>
      <p id="evEmpty" class="empty" ${evs.length ? 'hidden' : ''}>No plays yet. Pick a team and a play above, then tap the player.</p>
      ${tpl}
    </section>

    <section class="card">
      <div class="card-h"><h2>Did not play</h2><span class="muted sm" id="outCount"></span></div>
      <p class="muted sm">Tap anyone who was out. Every pick on them is cancelled: singles are refunded, and combos drop that pick and count the rest.</p>
      ${[t1, t2].map((t) => `<div class="out-team"><span class="th">${logo(t, 22)} ${esc(t.name)}</span><div class="out-chips">${t.roster.map((p) => `<label class="out-chip"><input type="checkbox" name="out" value="${esc(t.id + '|' + p.id)}" ${(g.out || []).includes(t.id + '|' + p.id) ? 'checked' : ''}><span>${avatar(t, p, 26)}${esc(p.name)}</span></label>`).join('')}</div></div>`).join('')}
    </section>

    <section class="card">
      <div class="card-h"><h2>Coach's notes</h2><span class="muted sm">Private · the AI reads these</span></div>
      <textarea name="notes" rows="4" maxlength="2000" placeholder="How did people play? e.g. dom blocked terribly, pedon pressured the ball well, chuck threw the ball in cover well">${esc(g.notes || '')}</textarea>
      <p class="muted sm">Used for the recap, MVP, power rankings and ratings. Never shown on the site.</p>
    </section>

    <details class="card details" ${isNew ? 'open' : ''}>
      <summary><h2>Game details</h2><span class="muted sm">${esc(longDate(g.date))} · ${time12(g.time || '12:35')} · ${esc(gameLabel(db, g) || 'Regular season')}</span>${icon('chev')}</summary>
      <div class="fgrid">
        <label>Date<input type="date" name="date" value="${esc(g.date || '')}"></label>
        <label>Time<input type="time" name="time" value="${esc(g.time || '12:35')}"></label>
        <label>Game type<select name="type" onchange="document.getElementById('bowlF').hidden=this.value!=='playoff'">${opt('regular', g.type, 'Regular season')}${opt('exhibition', g.type, 'Exhibition')}${opt('playoff', g.type, 'Playoff bowl')}</select></label>
        <label id="bowlF" ${g.type === 'playoff' ? '' : 'hidden'}>Bowl<select name="bowl"><option value="">—</option>${db.bowls.map((b) => opt(b.slug, g.bowl, b.name)).join('')}</select></label>
        <label class="wide">Reason <small class="muted">(shown for postponed or exhibition games)</small><input name="reason" value="${esc(g.reason)}" placeholder="e.g. Rain, assembly, scrimmage"></label>
      </div>
    </details>

    <div class="savebar">
      ${isNew ? '<a class="btn ghost" href="/admin">Cancel</a>' : `<button class="btn ghost danger" formaction="/admin/game/${g.id}/delete" onclick="return confirm('Delete this game for good?')">Delete</button>`}
      <span class="savebar-msg" id="dirty"></span>
      <button class="btn">${isNew ? 'Create game' : 'Save changes'}</button>
    </div>
  </form>
  <script>
  (()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const form=$('#gameForm'),evs=$('#evs');
  let team=$('.pb-team.on').dataset.team,type=$('.pb-type.on').dataset.type,dirty=false;
  const mark=()=>{dirty=true;$('#dirty').textContent='Unsaved changes';};
  const refresh=()=>{
    const rows=$$('.ev',evs);$('#evEmpty').hidden=rows.length>0;
    $('#evCount').textContent=rows.length+' play'+(rows.length===1?'':'s');
    // Touchdowns are worth 7: offer the score the plays add up to.
    const td={};rows.forEach(r=>{if($('[name=ev_type]',r).value==='TD'){const t=$('[name=ev_team]',r).value;td[t]=(td[t]||0)+7;}});
    const nOut=$$('input[name=out]:checked').length;$('#outCount').textContent=nOut?nOut+' out':'';
    const h=td['${t1.id}']||0,a=td['${t2.id}']||0,box=$('#tdSum');
    const cur=[form.homeScore.value,form.awayScore.value].join('-');
    box.hidden=!(h||a)||cur===h+'-'+a;
    box.dataset.h=h;box.dataset.a=a;$('span',box).textContent='Touchdowns add up to ${esc(t1.abbr)} '+h+' – ${esc(t2.abbr)} '+a;
  };
  window.mflUseScore=()=>{const b=$('#tdSum');form.homeScore.value=b.dataset.h;form.awayScore.value=b.dataset.a;const f=$('input[name=status][value=final]');if(f)f.checked=true;mark();refresh();};
  window.mflRemove=(btn)=>{btn.closest('.ev').remove();mark();refresh();};
  window.mflMove=(btn,d)=>{const r=btn.closest('.ev'),o=d<0?r.previousElementSibling:r.nextElementSibling;if(!o)return;d<0?o.before(r):o.after(r);mark();};
  const add=(name)=>{
    evs.insertAdjacentHTML('beforeend',$('#tpl-'+team+'-'+type).innerHTML);
    const row=evs.lastElementChild,sel=$('[name=ev_player]',row);
    sel.value=name;sel.classList.toggle('empty',!name);
    row.classList.add('fresh');setTimeout(()=>row.classList.remove('fresh'),900);
    const next=$('select[name=ev_passer]',row)||(type==='PLAY'||type==='CATCH'?$('.ev-note',row):null);
    if(next)next.focus({preventScroll:true});
    row.scrollIntoView({block:'nearest',behavior:'smooth'});
    mark();refresh();
  };
  $$('.pb-team').forEach(b=>b.onclick=()=>{team=b.dataset.team;$$('.pb-team').forEach(x=>x.classList.toggle('on',x===b));$$('.pb-roster').forEach(r=>r.hidden=r.dataset.team!==team);});
  $$('.pb-type').forEach(b=>b.onclick=()=>{type=b.dataset.type;$$('.pb-type').forEach(x=>x.classList.toggle('on',x===b));$('#pbHint').textContent=b.dataset.hint;});
  $$('.pb-p').forEach(b=>b.onclick=()=>add(b.dataset.name));
  form.addEventListener('input',()=>{mark();refresh();});
  form.addEventListener('submit',()=>{dirty=false;});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  refresh();
  })();
  </script>`;
}

function readGame(body, g) {
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  g.date = body.date || null;
  g.time = body.time || '12:35';
  g.home = body.home; g.away = body.away;
  g.type = ['regular', 'exhibition', 'playoff'].includes(body.type) ? body.type : 'regular';
  g.bowl = g.type === 'playoff' ? body.bowl || null : null;
  g.status = ['scheduled', 'live', 'final', 'postponed'].includes(body.status) ? body.status : 'scheduled';
  g.reason = String(body.reason || '').slice(0, 300);
  g.notes = String(body.notes || '').trim().slice(0, 2000);
  if (BOX_STATUS[body.boxStatus] && body.boxStatus !== 'complete') g.boxStatus = body.boxStatus; else delete g.boxStatus;
  const valid = new Set([g.home, g.away].flatMap((id) => (load().teams[id]?.roster || []).map((p) => id + '|' + p.id)));
  g.out = [...new Set(arr(body.out))].filter((k) => valid.has(k));
  g.homeScore = num(body.homeScore); g.awayScore = num(body.awayScore);
  delete g.quarters;
  const types = arr(body.ev_type);
  g.events = types.map((t, i) => ({
    type: EV_TYPES.includes(t) ? t : 'TD', team: arr(body.ev_team)[i], player: (arr(body.ev_player)[i] || '').trim(),
    passer: (arr(body.ev_passer)[i] || '').trim(), note: (arr(body.ev_note)[i] || '').trim(),
    ...(t === 'PEN' ? { pen: PENALTIES[arr(body.ev_pen)[i]] ? arr(body.ev_pen)[i] : 'OTHER' } : {}),
  })).filter((e) => e.player || e.passer || e.note || e.pen);
  return g;
}

app.get('/admin/game/new', requireAdmin, (req, res) => {
  const db = load();
  const ids = Object.keys(db.teams);
  res.send(layout(req, 'New Game', pageHead('Admin', 'New Game') + `<div class="wrap">${adminNav('/admin/game/new')}${gameForm(db, { home: ids[0], away: ids[1], type: 'regular', status: 'scheduled', time: '12:35', events: [] }, true)}</div>`, { ticker: false }));
});
app.post('/admin/game/new', requireAdmin, async (req, res) => {
  const db = load();
  db.games.push(readGame(req.body, { id: String(db.nextId++) }));
  await save();
  res.redirect('/admin?saved=1');
});
app.get('/admin/game/:id', requireAdmin, (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.redirect('/admin');
  res.send(layout(req, 'Edit Game', pageHead('Admin', `Edit · ${shortDate(g.date)}`, `<a href="/games/${g.id}">View public page →</a>`) + `<div class="wrap">${adminNav('')}${savedMsg(req)}${gameForm(db, g, false)}</div>`, { ticker: false }));
});
app.post('/admin/game/:id', requireAdmin, async (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.redirect('/admin');
  readGame(req.body, g);
  await save();
  res.redirect(`/admin/game/${g.id}?saved=1`);
});
app.post('/admin/game/:id/delete', requireAdmin, async (req, res) => {
  const db = load();
  db.games = db.games.filter((x) => x.id !== req.params.id);
  await save();
  res.redirect('/admin?saved=1');
});

app.get('/admin/teams', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'Teams', pageHead('Admin', 'Edit Teams') + `<div class="wrap">${adminNav('/admin/teams')}${savedMsg(req)}
    ${Object.values(db.teams).map((t) => `<form method="post" action="/admin/teams/${t.id}" class="card form">
      <h3 class="th">${logo(t, 44)} ${esc(teamFull(t))}</h3>
      <div class="fgrid">
        <label>Prefix<input name="city" value="${esc(t.city)}"></label>
        <label>Team name<input name="name" value="${esc(t.name)}" required></label>
        <label>Abbreviation<input name="abbr" value="${esc(t.abbr)}" maxlength="4" required></label>
        <label>Captain<input name="captain" value="${esc(t.captain)}"></label>
        <label>Primary color<input type="color" name="color" value="${esc(t.color)}"></label>
        <label>Secondary color<input type="color" name="color2" value="${esc(t.color2)}"></label>
        <label class="wide">Logo (PNG/JPG/SVG; big images are shrunk automatically)<input type="file" accept="image/*" onchange="mflLogo(this)"></label>
        <input type="hidden" name="logo" value="">
        <label class="chk"><input type="checkbox" name="clearLogo"> Remove current logo</label>
        <label class="wide">Roster: one per line as "Name | Tag" (tags: C, TR, Rd 1, FA…). Edit bios &amp; photos under Players.<textarea name="roster" rows="10">${esc(t.roster.map((p) => (p.tag ? `${p.name} | ${p.tag}` : p.name)).join('\n'))}</textarea></label>
      </div><div class="actions"><button class="btn">Save ${esc(t.name)}</button></div></form>`).join('')}</div>
    <script>
    // Shrink logos to 256px before upload so pages stay fast.
    function mflLogo(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{
      if(/svg/.test(f.type)){inp.form.logo.value=r.result;return;}
      const im=new Image();im.onload=()=>{const k=Math.min(1,256/Math.max(im.width,im.height)),c=document.createElement('canvas');
        c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        inp.form.logo.value=c.toDataURL('image/webp',0.86);};im.src=r.result;};r.readAsDataURL(f);}
    </script>`, { ticker: false }));
});
app.post('/admin/teams/:id', requireAdmin, async (req, res) => {
  const db = load();
  const t = db.teams[req.params.id];
  if (!t) return res.redirect('/admin/teams');
  const b = req.body;
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
  t.city = String(b.city || '').slice(0, 60); t.name = String(b.name || t.name).slice(0, 60);
  t.abbr = String(b.abbr || t.abbr).slice(0, 4).toUpperCase(); t.captain = String(b.captain || '').slice(0, 60);
  t.color = hex(b.color, t.color); t.color2 = hex(b.color2, t.color2);
  if (b.clearLogo) t.logo = null;
  else if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(b.logo || '')) { t.logo = b.logo; shrinkLogos(db); }
  const old = t.roster;
  const used = new Set();
  t.roster = String(b.roster || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, tag] = l.split('|').map((x) => x.trim());
    const prev = old.find((p) => p.name.toLowerCase() === name.toLowerCase() && !used.has(p.id));
    let id = prev?.id || slug(name), i = 2;
    while (!prev && (used.has(id) || old.some((p) => p.id === id))) id = `${slug(name)}-${i++}`;
    used.add(id);
    return { ...(prev || {}), id, name, tag: tag || '' };
  });
  await save();
  res.redirect('/admin/teams?saved=1');
});

app.get('/admin/players', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'Players', pageHead('Admin', 'Players', 'Click a player to edit their bio, photo, number and position. Add or remove players under Teams.') + `<div class="wrap">${adminNav('/admin/players')}${savedMsg(req)}
    ${Object.values(db.teams).map((tm) => `<div class="card"><div class="card-h"><h2 class="th">${logo(tm, 28)} ${esc(teamFull(tm))}</h2></div><div class="roster">
      ${tm.roster.map((p) => `<a class="pl" href="/admin/players/${tm.id}/${p.id}">${avatar(tm, p, 46)}<div><b>${esc(p.name)}</b><small>${p.photo ? '' : 'No photo · '}${p.bio ? 'Has bio' : 'No bio'}</small></div></a>`).join('')}
    </div></div>`).join('')}</div>`, { ticker: false }));
});

app.get('/admin/players/:team/:pid', requireAdmin, (req, res) => {
  const db = load();
  const tm = db.teams[req.params.team];
  const p = tm?.roster.find((x) => x.id === req.params.pid);
  if (!p) return res.redirect('/admin/players');
  res.send(layout(req, 'Edit Player', pageHead('Admin', p.name, `<a href="${playerUrl(tm, p)}">View player page →</a>`) + `<div class="wrap">${adminNav('')}${savedMsg(req)}
    ${req.query.err ? `<p class="err">${esc(req.query.err)}</p>` : ''}
    <form method="post" class="card form">
      <h3>Photo</h3>
      <div class="photo-edit">
        <div class="crop" id="crop" ${p.photo ? `data-src="/media/${esc(p.photoOrig || p.photo)}"` : ''}>
          <img id="cropImg" alt="" draggable="false" hidden>
          <div class="crop-empty" id="cropEmpty" ${p.photo ? 'hidden' : ''}>${avatar(tm, p, 120, 'xl')}<span>No photo yet</span></div>
        </div>
        <div class="crop-side">
          <label class="btn ghost file-btn">${p.photo ? 'Upload a different photo' : 'Upload a photo'}<input type="file" accept="image/*" id="photoIn" hidden></label>
          <div id="cropTools" hidden>
            <p class="sm"><b>Drag the photo</b> to choose what shows in the square. Use the slider to zoom.</p>
            <label class="zoom">Zoom<input type="range" id="zoom" min="1" max="4" step="0.01" value="1"></label>
            <button type="button" class="btn sm ghost" id="cropReset">Reset</button>
          </div>
          <input type="hidden" name="photo" id="photoData"><input type="hidden" name="photoOrig" id="photoOrig">
          ${p.photo ? '<label class="chk"><input type="checkbox" name="clearPhoto"> Remove photo</label>' : ''}
          ${p.photo && !p.photoOrig ? '<p class="muted sm">This photo was uploaded before cropping existed, so you can only zoom in on it. Upload the original again to choose a different area.</p>' : ''}
        </div>
      </div>
      <h3>Details</h3>
      <div class="fgrid">
        <label>Name<input name="name" value="${esc(p.name)}" required></label>
        <label>Number<input name="number" value="${esc(p.number || '')}" maxlength="3" placeholder="e.g. 12"></label>
        <label>Position<input name="position" value="${esc(p.position || '')}" placeholder="e.g. QB, WR, Rusher"></label>
        <label>Grade<input name="grade" value="${esc(p.grade || '')}" placeholder="e.g. 8th"></label>
        <label>Status tag<input name="tag" value="${esc(p.tag || '')}" placeholder="C, TR, Rd 1, FA"></label>
        <label class="wide">Bio<textarea name="bio" rows="8" placeholder="Write something about this player…">${esc(p.bio || '')}</textarea></label>
      </div>
      <div class="actions"><button class="btn">Save player</button><a class="btn ghost" href="/admin/players">Back</a></div>
    </form></div>
    <script>
    (() => {
      const box = document.getElementById('crop'), img = document.getElementById('cropImg'), zoom = document.getElementById('zoom');
      const out = document.getElementById('photoData'), orig = document.getElementById('photoOrig');
      let iw = 0, ih = 0, base = 1, z = 1, x = 0, y = 0, dirty = false;
      const V = () => box.clientWidth;
      const clamp = () => {
        const s = base * z, v = V();
        x = Math.min(0, Math.max(v - iw * s, x));
        y = Math.min(0, Math.max(v - ih * s, y));
      };
      const draw = () => {
        clamp();
        const s = base * z;
        img.style.width = iw * s + 'px'; img.style.height = ih * s + 'px';
        img.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      };
      const load = (src, isNew) => {
        const im = new Image();
        im.onload = () => {
          iw = im.naturalWidth; ih = im.naturalHeight;
          img.src = src; img.hidden = false;
          document.getElementById('cropEmpty').hidden = true;
          document.getElementById('cropTools').hidden = false;
          base = V() / Math.min(iw, ih); z = 1; zoom.value = 1;
          x = (V() - iw * base) / 2; y = (V() - ih * base) / 2;
          dirty = isNew; draw();
        };
        im.src = src;
      };
      if (box.dataset.src) load(box.dataset.src, false);

      document.getElementById('photoIn').addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const im = new Image();
        im.onload = () => {
          // Keep a resized original so the crop can be changed later.
          const m = Math.min(1, 1600 / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width = Math.round(im.width * m); c.height = Math.round(im.height * m);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', 0.85);
          orig.value = url;
          load(url, true);
        };
        im.src = URL.createObjectURL(f);
      });

      let drag = null;
      box.addEventListener('pointerdown', (e) => { if (!iw) return; drag = { px: e.clientX, py: e.clientY, x, y }; box.setPointerCapture(e.pointerId); box.classList.add('dragging'); });
      box.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; dirty = true; draw(); });
      const end = () => { drag = null; box.classList.remove('dragging'); };
      box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
      const setZoom = (nz) => {
        const v = V(), cx = (v / 2 - x) / (base * z), cy = (v / 2 - y) / (base * z);
        z = Math.min(4, Math.max(1, nz)); zoom.value = z;
        x = v / 2 - cx * base * z; y = v / 2 - cy * base * z; dirty = true; draw();
      };
      zoom.addEventListener('input', () => setZoom(+zoom.value));
      box.addEventListener('wheel', (e) => { if (!iw) return; e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
      document.getElementById('cropReset').addEventListener('click', () => { z = 1; zoom.value = 1; x = (V() - iw * base) / 2; y = (V() - ih * base) / 2; dirty = true; draw(); });

      box.closest('form').addEventListener('submit', () => {
        if (!iw || !dirty) return;
        const s = base * z, c = document.createElement('canvas'); c.width = c.height = 640;
        c.getContext('2d').drawImage(img, -x / s, -y / s, V() / s, V() / s, 0, 0, 640, 640);
        out.value = c.toDataURL('image/jpeg', 0.88);
      });
    })();
    </script>`, { ticker: false }));
});

app.post('/admin/players/:team/:pid', requireAdmin, async (req, res) => {
  const db = load();
  const tm = db.teams[req.params.team];
  const p = tm?.roster.find((x) => x.id === req.params.pid);
  if (!p) return res.redirect('/admin/players');
  const b = req.body;
  const back = `/admin/players/${tm.id}/${p.id}`;
  const name = String(b.name || '').trim().slice(0, 60) || p.name;
  if (name !== p.name) {
    // Keep box-score stats attached to the renamed player.
    const oldName = p.name.toLowerCase();
    for (const g of db.games) for (const e of g.events || []) {
      if (e.team !== tm.id) continue;
      if ((e.player || '').toLowerCase() === oldName) e.player = name;
      if ((e.passer || '').toLowerCase() === oldName) e.passer = name;
    }
    if (tm.captain.toLowerCase() === oldName) tm.captain = name;
    p.name = name;
  }
  p.number = String(b.number || '').replace(/[^0-9]/g, '').slice(0, 3);
  p.position = String(b.position || '').slice(0, 30);
  p.grade = String(b.grade || '').slice(0, 20);
  p.tag = String(b.tag || '').slice(0, 10);
  p.bio = String(b.bio || '').slice(0, 4000);
  const jpeg = (v) => {
    const m = /^data:image\/jpeg;base64,(.+)$/.exec(v || '');
    return m ? Buffer.from(m[1], 'base64') : null;
  };
  const crop = jpeg(b.photo), original = jpeg(b.photoOrig);
  if ((crop?.length || 0) > 3 * 1024 * 1024 || (original?.length || 0) > 3 * 1024 * 1024) return res.redirect(back + '?err=' + encodeURIComponent('That photo is too big.'));
  const stamp = Date.now().toString(36);
  if (b.clearPhoto) { p.photo = null; p.photoOrig = null; }
  else if (crop) {
    await putMedia(`${tm.id}-${p.id}-${stamp}.jpg`, crop, 'image/jpeg');
    p.photo = `${tm.id}-${p.id}-${stamp}.jpg`;
    if (original) {
      await putMedia(`${tm.id}-${p.id}-${stamp}-orig.jpg`, original, 'image/jpeg');
      p.photoOrig = `${tm.id}-${p.id}-${stamp}-orig.jpg`;
    }
  }
  await save();
  res.redirect(back + '?saved=1');
});

// ---------- admin: transactions ----------
app.get('/admin/transactions', requireAdmin, (req, res) => {
  const db = load();
  const teams = Object.values(db.teams);
  const [A, B] = teams;
  const pick = (t, name) => `<div class="pickp"><h4>${logo(t, 22)} ${esc(t.name)}</h4>${t.roster.map((p) => `<label class="chk"><input type="checkbox" name="${name}" value="${esc(p.id)}"> ${esc(p.name)} <small class="muted">${esc(tagName(p.tag))}</small></label>`).join('')}</div>`;
  const txs = [...(db.transactions || [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  res.send(layout(req, 'Transactions', pageHead('Admin', 'Transactions', 'Trades move players between rosters (photos, bios and stats go with them).') + `<div class="wrap">${adminNav('/admin/transactions')}${savedMsg(req)}
    ${req.query.err ? `<p class="err">${esc(req.query.err)}</p>` : ''}
    <form method="post" class="card form">
      <div class="card-h"><h2>Log a trade</h2></div><input type="hidden" name="type" value="trade">
      <div class="trade-grid">${pick(A, 'outA')}<div class="trade-x">${icon('swap')}</div>${pick(B, 'outB')}</div>
      <div class="fgrid"><label>Date<input type="date" name="date" value="${today()}"></label><label class="wide">Note (optional)<input name="note" placeholder="e.g. Team reps agreed at lunch"></label></div>
      <div class="actions"><button class="btn">Make trade</button></div>
    </form>
    <div class="fgrid2">
      <form method="post" class="card form"><div class="card-h"><h2>Sign a player</h2></div><input type="hidden" name="type" value="signing">
        <label>Team<select name="team">${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>Player name<input name="name" required></label><label>Tag<input name="tag" value="FA" placeholder="FA, Rd 1…"></label>
        <label>Date<input type="date" name="date" value="${today()}"></label><label>Note<input name="note"></label>
        <div class="actions"><button class="btn">Sign</button></div></form>
      <form method="post" class="card form"><div class="card-h"><h2>Release a player</h2></div><input type="hidden" name="type" value="release">
        <label>Player<select name="player">${teams.map((t) => `<optgroup label="${esc(t.name)}">${t.roster.map((p) => `<option value="${t.id}|${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label>Date<input type="date" name="date" value="${today()}"></label><label>Note<input name="note"></label>
        <div class="actions"><button class="btn ghost danger" onclick="return confirm('Remove this player from the roster?')">Release</button></div></form>
      <form method="post" class="card form"><div class="card-h"><h2>Fix a roster mistake</h2></div><input type="hidden" name="type" value="fix">
        <p class="muted sm">Moves a player to the other team without posting a transaction. Use it when someone was put on the wrong team.</p>
        <label>Player<select name="player">${teams.map((t) => `<optgroup label="${esc(t.name)} → move to ${esc(teams.find((x) => x.id !== t.id)?.name || '')}">${t.roster.map((p) => `<option value="${t.id}|${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <div class="actions"><button class="btn">Move to the other team</button></div></form>
      <form method="post" class="card form"><div class="card-h"><h2>Other news</h2></div><input type="hidden" name="type" value="note">
        <label>Team (optional)<select name="team"><option value="">—</option>${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>What happened<input name="note" required></label><label>Date<input type="date" name="date" value="${today()}"></label>
        <div class="actions"><button class="btn">Post</button></div></form>
    </div>
    <div class="card"><div class="card-h"><h2>History</h2></div>${txs.map((t) => `<div class="tx-admin">${txLine(db, t)}<form method="post" action="/admin/transactions/${t.id}/delete"><button class="btn sm ghost" onclick="return confirm('Delete this entry? (It does not undo roster changes.)')">Delete</button></form></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div>
  </div>`, { ticker: false }));
});
app.post('/admin/transactions', requireAdmin, async (req, res) => {
  const db = load();
  const b = req.body;
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : today();
  const note = String(b.note || '').slice(0, 300);
  db.transactions = db.transactions || [];
  db.nextTx = db.nextTx || 1;
  const tx = { id: db.nextTx++, date, type: b.type, note };
  const fail = (m) => res.redirect('/admin/transactions?err=' + encodeURIComponent(m));
  const move = (from, to, ids) => ids.map((id) => {
    const i = from.roster.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const [p] = from.roster.splice(i, 1);
    let nid = p.id, n = 2;
    while (to.roster.some((x) => x.id === nid)) nid = `${p.id}-${n++}`;
    p.id = nid;
    to.roster.push(p);
    return p.name;
  }).filter(Boolean);
  if (b.type === 'trade') {
    const [A, B] = Object.values(db.teams);
    const outA = arr(b.outA), outB = arr(b.outB);
    if (!outA.length && !outB.length) return fail('Pick at least one player to trade.');
    tx.team = A.id; tx.team2 = B.id;
    tx.out = move(A, B, outA); tx.in = move(B, A, outB);
    if (!tx.out.length) { tx.team = B.id; tx.team2 = A.id; tx.out = tx.in; tx.in = []; }
  } else if (b.type === 'signing') {
    const t = db.teams[b.team]; const name = String(b.name || '').trim().slice(0, 60);
    if (!t || !name) return fail('Pick a team and enter a name.');
    let id = slug(name), n = 2;
    while (t.roster.some((p) => p.id === id)) id = `${slug(name)}-${n++}`;
    t.roster.push({ id, name, tag: String(b.tag || '').slice(0, 10) });
    tx.team = t.id; tx.in = [name];
  } else if (b.type === 'release') {
    const [tid, pid] = String(b.player || '').split('|');
    const t = db.teams[tid]; const i = t ? t.roster.findIndex((p) => p.id === pid) : -1;
    if (i < 0) return fail('Player not found.');
    tx.team = t.id; tx.out = [t.roster[i].name];
    t.roster.splice(i, 1);
  } else if (b.type === 'fix') {
    const [tid, pid] = String(b.player || '').split('|');
    const from = db.teams[tid], to = Object.values(db.teams).find((t) => t.id !== tid);
    if (!from || !to || !move(from, to, [pid]).length) return fail('Player not found.');
    await save();
    return res.redirect('/admin/transactions?saved=1');
  } else if (b.type === 'note') {
    if (!note) return fail('Write what happened.');
    tx.team = db.teams[b.team] ? b.team : null;
  } else return fail('Unknown type.');
  db.transactions.push(tx);
  await save();
  res.redirect('/admin/transactions?saved=1');
});
app.post('/admin/transactions/:id/delete', requireAdmin, async (req, res) => {
  const db = load();
  db.transactions = (db.transactions || []).filter((t) => String(t.id) !== req.params.id);
  await save();
  res.redirect('/admin/transactions?saved=1');
});

// ---------- admin: pick'em ----------
app.get('/admin/pickem', requireAdmin, async (req, res, next) => {
  try {
    const db = load();
    const board = await leaderboard(db);
    res.send(layout(req, "Pick'em Admin", pageHead('Admin', "Pick'em Accounts", 'Reset a forgotten password, give coins, or remove an account.') + `<div class="wrap">${adminNav('/admin/pickem')}${savedMsg(req)}
      <div class="card"><div class="scroll"><table class="tbl admin"><thead><tr><th class="l">User</th><th>Coins</th><th>W-L</th><th>Open</th><th class="l">Reset password</th><th class="l">Give coins</th><th></th></tr></thead><tbody>
      ${board.map((u) => `<tr><td class="l"><b>@${esc(u.name)}</b></td><td>${coins(u.balance)}</td><td>${u.won}-${u.lost}</td><td>${u.pending}</td>
        <td class="l"><form method="post" action="/admin/pickem/${esc(u.name)}/pin" class="inline"><input name="pin" minlength="4" maxlength="72" placeholder="New password" required><button class="btn sm ghost">Set</button></form></td>
        <td class="l"><form method="post" action="/admin/pickem/${esc(u.name)}/coins" class="inline"><input name="amount" type="number" placeholder="+500" required><button class="btn sm ghost">Give</button></form></td>
        <td><form method="post" action="/admin/pickem/${esc(u.name)}/delete"><button class="btn sm ghost danger" onclick="return confirm('Delete @${esc(u.name)} and all their picks?')">Delete</button></form></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No accounts yet.</td></tr>'}
      </tbody></table></div></div></div>`, { ticker: false }));
  } catch (e) { next(e); }
});
// One-time fix after spreads became 13.5: move old spread picks on unplayed games to
// the 13.5 line at today's 13.5 price, and re-total each affected parlay. Safe to run again.
app.post('/admin/pickem/reprice-spreads', requireAdmin, async (req, res) => {
  const db = load();
  const changed = [];
  for (const user of await listDocs('users/')) {
    let touched = false;
    for (const bet of user.bets || []) {
      let betTouched = false;
      for (const l of bet.legs) {
        if (!l.key.startsWith('spr:')) continue;
        const [, team, line] = l.key.split(':');
        const g = db.games.find((x) => x.id === l.game);
        if (!g || isFinal(g) || g.status === 'postponed') continue;
        const side = Math.sign(Number(line)) * pk.SPREAD;
        const now = pk.markets(db, g).byKey[`spr:${team}:${side}`];
        if (!now || (l.key === now.key && l.odds === now.odds)) continue;
        changed.push(`@${user.name}: ${l.label} ${pk.mult(l.odds)} → ${now.label} ${pk.mult(now.odds)}`);
        Object.assign(l, { key: now.key, label: now.label, odds: now.odds });
        betTouched = true;
      }
      if (betTouched) { bet.odds = Math.round(bet.legs.reduce((x, l) => x * l.odds, 1) * 100) / 100; touched = true; }
    }
    if (touched) await putDoc(userKey(user.name), user);
  }
  res.type('text/plain').send(changed.length ? changed.join('\n') : 'No spread picks needed changing.');
});

app.post('/admin/pickem/:name/:action', requireAdmin, async (req, res) => {
  const name = String(req.params.name).toLowerCase();
  const user = pk.validName(name) ? await getDoc(userKey(name), { fresh: true }) : null;
  if (!user) return res.redirect('/admin/pickem');
  if (req.params.action === 'pin' && String(req.body.pin || '').length >= 4 && String(req.body.pin).length <= 72) Object.assign(user, pk.hashPin(String(req.body.pin)));
  else if (req.params.action === 'coins' && Number.isFinite(+req.body.amount)) (user.bonuses = user.bonuses || []).push({ amount: Math.trunc(+req.body.amount), reason: 'Admin', at: new Date().toISOString() });
  else if (req.params.action === 'delete') { await deleteDoc(userKey(name)); return res.redirect('/admin/pickem?saved=1'); }
  await putDoc(userKey(name), user);
  res.redirect('/admin/pickem?saved=1');
});

// ---------- admin: pick'em tendencies ----------
// 0-100 sliders that nudge Pick'em odds (50 = go by stats only). They never change real stats.
const TEND_TEAM = [['off', 'Offense', 'Scores a lot'], ['def', 'Defense', 'Holds the other team down'], ['int', 'Picks', 'Gets interceptions']];
const TEND_PLAYER = [['td', 'Scores TDs'], ['pass', 'Throws TDs'], ['int', 'Gets INTs']];
const tval = (o, k) => (o && Number.isFinite(+o[k]) ? +o[k] : 50);
function slider(name, v, label, drift = 0, o = {}) {
  const eff = Math.max(0, Math.min(100, v + drift));
  const autoTxt = (d) => (d ? `auto ${d > 0 ? '+' : ''}${d}` : 'auto 0');
  if (o.overall) return `<div class="tslider ovr" data-label="${esc(label)}"><input type="range" name="${name}" min="40" max="99" step="1" value="${v}" oninput="this.nextElementSibling.textContent=this.value"><output>${v}</output></div>`;
  return `<div class="tslider" data-v="${v}" data-label="${esc(label)}"><input type="range" name="${name}" min="0" max="100" step="5" value="${v}" data-drift="${drift}" oninput="const d=+this.dataset.drift,e=Math.max(0,Math.min(100,+this.value+d));this.nextElementSibling.textContent=this.value;this.parentElement.dataset.v=this.value;this.parentElement.querySelector('.eff b').textContent=e"><output>${v}</output>
    <small class="eff ${drift > 0 ? 'up' : drift < 0 ? 'down' : ''}" title="Automatic change from game results">${autoTxt(drift)} → <b>${eff}</b></small></div>`;
}
app.get('/admin/tendencies', requireAdmin, (req, res) => {
  const db = load();
  const teams = Object.values(db.teams);
  const drift = pk.tendDrift(db);
  const dT = (t, k) => drift.teams[t.id]?.[k] || 0, dP = (t, p, k) => drift.players[t.id + '|' + p.id]?.[k] || 0;
  res.send(layout(req, 'Tendencies', pageHead('Admin', "Pick'em Tendencies", "Slider = your starting point (0 very unlikely, 50 stats only, 100 very likely). After every game it adjusts automatically: up when a player or team produces, down a bit when they don't. The odds use the number after the arrow.") + `<div class="wrap">${adminNav('/admin/tendencies')}${savedMsg(req)}
    <form method="post" class="form tend">
      <div class="card"><div class="card-h"><h2>Teams</h2></div>
        <div class="tgrid tgrid-team"><span></span>${TEND_TEAM.map(([, n, d]) => `<span class="th-l"><b>${n}</b><small>${d}</small></span>`).join('')}
        ${teams.map((t) => `<span class="th">${logo(t, 28)} ${esc(t.name)}</span>${TEND_TEAM.map(([k, n]) => slider(`team.${t.id}.${k}`, tval(t.tend, k), n, dT(t, k))).join('')}`).join('')}</div>
      </div>
      ${teams.map((t) => `<div class="card"><div class="card-h"><h2 class="th">${logo(t, 28)} ${esc(t.name)} players</h2></div>
        <div class="tgrid tgrid-p"><span></span><span class="th-l"><b>Overall</b><small>How good &amp; impactful in a game (sets the rating)</small></span>${TEND_PLAYER.map(([, n]) => `<span class="th-l"><b>${n}</b></span>`).join('')}
        ${t.roster.map((p) => `<span class="plink">${avatar(t, p, 30)}${esc(p.name)}</span>${slider(`player.${t.id}.${p.id}.ovr`, overallOf(p) ?? scoutRating(pk.effTend(db), t, p), 'Overall', 0, { overall: true })}${TEND_PLAYER.map(([k, n]) => slider(`player.${t.id}.${p.id}.${k}`, tval(p.tend, k), n, dP(t, p, k))).join('')}`).join('')}</div>
      </div>`).join('')}
      <div class="savebar"><button type="button" class="btn ghost" onclick="this.form.querySelectorAll('.tslider:not(.ovr) input[type=range]').forEach(r=>{r.value=50;r.oninput()})">Reset skills to 50</button><button class="btn">Save tendencies</button></div>
    </form></div>`, { ticker: false }));
});
app.post('/admin/tendencies', requireAdmin, async (req, res) => {
  const db = load();
  const num = (v) => Math.max(0, Math.min(100, Math.round(+v)));
  for (const [key, v] of Object.entries(req.body)) {
    if (!Number.isFinite(+v)) continue;
    const parts = key.split('.');
    if (parts[0] === 'team' && parts.length === 3) {
      const t = db.teams[parts[1]];
      if (t && TEND_TEAM.some(([k]) => k === parts[2])) (t.tend = t.tend || {})[parts[2]] = num(v);
    } else if (parts[0] === 'player' && parts.length === 4) {
      const p = db.teams[parts[1]]?.roster.find((x) => x.id === parts[2]);
      if (p && parts[3] === 'ovr') (p.tend = p.tend || {}).ovr = Math.max(40, Math.min(99, Math.round(+v)));
      else if (p && TEND_PLAYER.some(([k]) => k === parts[3])) (p.tend = p.tend || {})[parts[3]] = num(v);
    }
  }
  await save();
  res.redirect('/admin/tendencies?saved=1');
});

app.get('/admin/bowls', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'Bowls', pageHead('Admin', 'Edit Bowls') + `<div class="wrap">${adminNav('/admin/bowls')}${savedMsg(req)}
    <form method="post" class="card form"><p class="muted">Rename bowls here. To change a bowl's date (like the Christmas Bowl), edit its game in the Games list.</p>
    <div class="fgrid">${db.bowls.map((b, i) => `<label>Bowl ${i + 1}<input name="name_${b.slug}" value="${esc(b.name)}"></label>`).join('')}</div>
    <div class="actions"><button class="btn">Save</button></div></form></div>`, { ticker: false }));
});
app.post('/admin/bowls', requireAdmin, async (req, res) => {
  const db = load();
  for (const b of db.bowls) if (req.body['name_' + b.slug]) b.name = String(req.body['name_' + b.slug]).slice(0, 60);
  await save();
  res.redirect('/admin/bowls?saved=1');
});

// ---------- MFL Cards & Survivor (fun.js) ----------
let ratingMemo = { at: 0, map: null };
function ratingOf(db, t, p) {
  if (!ratingMemo.map || Date.now() - ratingMemo.at > 3000) ratingMemo = { at: Date.now(), map: Object.fromEntries(ratings(db).map((x) => [x.p.id, x.r])) };
  return ratingMemo.map[p.id] ?? 60;
}
{ const funH = { esc, icon, logo, avatar, pts, coins, layout, pickHead, pickNav, pageHead, pk, TZ, load, save, getDoc, putDoc, listDocs, userKey, currentUser, loadAccount, accountOf, survivorNow, leaderboard, weeklyWinners, matchName, shortDate, time12, ratingOf };
  require('./fun')(app, funH);
  require('./trading')(app, funH); }

arcadeApi = require('./arcade')(app, { esc, icon, layout, pk, TZ, load, getDoc, putDoc, listDocs, userKey, currentUser, loadAccount, accountOf, survivorNow, ratingOf, coins, shortDate, requireAdmin, adminNav, pageHead, save });

app.use((req, res) => res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Page not found', '<a href="/">Back home →</a>'))));
app.use((err, req, res, next) => { console.error(err); res.status(500).send(`Something went wrong. Try again in a moment.<!-- ${esc(err && (err.name + ': ' + err.message))} -->`); });

// AI text written before the no-betting-words rule: clean it once on startup.
function degambleAI(db) {
  const before = JSON.stringify([db.games, db.midweek, db.teamRecaps, db.teams]);
  for (const g of db.games) for (const k of ['aiRecap', 'aiPreview', 'aiBowlShow']) if (g[k]) g[k] = ai.degamble(g[k]);
  if (db.midweek) db.midweek = ai.degamble(db.midweek);
  if (db.teamRecaps) db.teamRecaps = ai.degamble(db.teamRecaps);
  for (const t of Object.values(db.teams)) for (const p of t.roster) if (p.aiScout) p.aiScout = ai.degamble(p.aiScout);
  return before !== JSON.stringify([db.games, db.midweek, db.teamRecaps, db.teams]);
}
// Team logos uploaded as huge PNGs get shrunk to 256px (pages and caches stay small).
function shrinkLogos(db) {
  let changed = false;
  for (const t of Object.values(db.teams)) {
    const m = /^data:image\/png;base64,(.+)$/.exec(t.logo || '');
    if (!m || m[1].length < 400 * 1024) continue;
    try {
      const small = require('./shrinkpng').shrinkPng(Buffer.from(m[1], 'base64'));
      if (small) { t.logo = 'data:image/png;base64,' + small.toString('base64'); changed = true; console.log(`Shrunk ${t.id} logo: ${m[1].length} -> ${t.logo.length}`); }
    } catch (e) { console.error('logo shrink failed', t.id, e.message); }
  }
  return changed;
}

if (require.main === module) {
  refresh().then(async (db) => { const a = shrinkLogos(db), b = degambleAI(db); if (a || b) await save(); }).catch((e) => console.error(e));
  app.listen(PORT, () => console.log(`MFL running on :${PORT}`));
  scheduleAI(15000); // catch up on anything that changed while the server was down
  // On Railway also listen on a fixed port, for the TCP proxy Vercel forwards to.
  if (process.env.RAILWAY_ENVIRONMENT && String(PORT) !== '8080') app.listen(8080, () => console.log('MFL also on :8080'));
}
module.exports = app;
