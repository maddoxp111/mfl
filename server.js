const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { load, save, refresh, putMedia, getMedia, slug } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('mfl:' + ADMIN_PASSWORD).digest('hex');
const TZ = process.env.TZ_LEAGUE || 'America/Chicago';
const VENUE = 'Thomas Metcalf School';

app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
// Player photos, served from storage (keys are unique per upload, so cache hard).
app.get('/media/:key', async (req, res, next) => {
  try {
    if (!/^[a-z0-9-]+\.jpg$/.test(req.params.key)) return res.status(404).end();
    const buf = await getMedia(req.params.key);
    if (!buf) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(buf);
  } catch (e) { next(e); }
});
app.use(async (req, res, next) => {
  try { await refresh(); next(); } catch (e) { next(e); }
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
function logo(t, size = 40, cls = '') {
  if (t.logo) return `<img class="logo ${cls}" src="${esc(t.logo)}" alt="${esc(t.name)}" style="width:${size}px;height:${size}px">`;
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
    if (g.status !== 'final' || g.type === 'exhibition') continue;
    for (const e of g.events || []) {
      if (e.type === 'TD') { bump(e.team, e.player, 'td'); bump(e.team, e.passer, 'ptd'); }
      else bump(e.team, e.player, 'int');
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
    <div class="gc-foot"><span>${icon('pin')} ${VENUE}</span>${g.reason && (g.status === 'postponed' || g.type === 'exhibition') ? `<span class="gc-reason">${esc(g.reason)}</span>` : ''}</div>
  </a>`;
}

function layout(req, title, body, opts = {}) {
  const db = load();
  const teams = Object.values(db.teams);
  const admin = isAdmin(req);
  const cur = req.path;
  const on = (prefixes) => (prefixes.some((p) => cur.startsWith(p)) ? 'on' : '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MFL</title>
<meta name="theme-color" content="#0a0a0d">
<link rel="icon" href="/static/mfl-logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Archivo:wght@700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css?v=8">
</head><body>
<header class="hdr"><div class="hdr-in">
  <a class="brand" href="/"><img src="/static/mfl-logo.webp" alt=""><span>MFL</span></a>
  <button class="burger" aria-label="Menu" onclick="document.body.classList.toggle('nav-open')"><span></span><span></span></button>
  <nav class="nav">
    <div class="dd ${on(['/schedule', '/scores', '/games'])}"><button>Games ${icon('chev')}</button><div class="dd-m">
      <a href="/schedule">${icon('cal')} Schedule</a><a href="/scores">${icon('clock')} Scores</a></div></div>
    <div class="dd ${on(['/playoffs'])}"><button>Playoffs ${icon('chev')}</button><div class="dd-m">
      ${db.bowls.map((b) => `<a href="/playoffs/${b.slug}">${icon('trophy')} ${esc(b.name)}</a>`).join('')}</div></div>
    <div class="dd ${on(['/teams'])}"><button>Teams ${icon('chev')}</button><div class="dd-m">
      ${teams.map((t) => `<a href="/teams/${t.id}">${logo(t, 22)} ${esc(teamFull(t))}</a>`).join('')}</div></div>
    <div class="dd ${on(['/stats'])}"><button>Stats ${icon('chev')}</button><div class="dd-m">
      <a href="/stats/team">Team Stats</a></div></div>
    ${admin ? '<a class="nav-admin" href="/admin">Admin</a>' : ''}
  </nav>
</div></header>
${opts.ticker === false ? '' : ticker(db)}
<main>${body}</main>
<footer class="ftr"><div class="wrap ftr-in">
  <div class="ftr-brand"><img src="/static/mfl-logo.webp" alt=""><div><b>Metcalf Football League</b><small>All games at ${VENUE}</small></div></div>
  <div class="ftr-links"><a href="/schedule">Schedule</a><a href="/scores">Scores</a><a href="/stats/team">Stats</a>${teams.map((t) => `<a href="/teams/${t.id}">${esc(t.name)}</a>`).join('')}<a href="/admin">Admin</a></div>
</div></footer>
<script>
document.querySelectorAll('.dd>button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const p=b.parentElement,o=p.classList.contains('open');document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'));if(!o)p.classList.add('open');}));
document.addEventListener('click',()=>document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open')));
const t=document.querySelector('.tk.now');if(t)t.parentElement.parentElement.scrollLeft=t.offsetLeft-16;
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
      <p>${tds.length ? `${tds.length} touchdown${tds.length > 1 ? 's' : ''} at ${VENUE}.` : `At ${VENUE}.`} <span class="link">Box score ${icon('arrow')}</span></p></div>
    <div class="hero-board">
      <div class="hb-team ${w && w !== a.id ? 'dim' : ''}">${logo(a, 72)}<b>${esc(a.abbr)}</b></div>
      <div class="hb-score"><span class="${w && w !== a.id ? 'dim' : ''}">${g.homeScore}</span><i>–</i><span class="${w && w !== b.id ? 'dim' : ''}">${g.awayScore}</span></div>
      <div class="hb-team ${w && w !== b.id ? 'dim' : ''}">${logo(b, 72)}<b>${esc(b.abbr)}</b></div>
    </div></a>`;
}
function heroNext(db, g, kicker) {
  const a = db.teams[g.home], b = db.teams[g.away];
  return `<a class="hero" href="/games/${g.id}" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="hero-txt"><div class="kicker">${esc(kicker)}${gameLabel(db, g) ? ' · ' + esc(gameLabel(db, g)) : ''}</div>
      <h1>${esc(a.name)} vs ${esc(b.name)}</h1>
      <p>${icon('cal')} ${esc(longDate(g.date))} &nbsp; ${icon('clock')} ${time12(g.time)} &nbsp; ${icon('pin')} ${VENUE}</p></div>
    <div class="hero-board">
      <div class="hb-team">${logo(a, 72)}<b>${esc(a.abbr)}</b><small>${record(teamStats(db, a.id))}</small></div>
      <div class="hb-score vs"><i>VS</i></div>
      <div class="hb-team">${logo(b, 72)}<b>${esc(b.abbr)}</b><small>${record(teamStats(db, b.id))}</small></div>
    </div></a>`;
}

// ---------- public routes ----------
app.get('/', (req, res) => {
  const db = load();
  const t = today();
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
      ${hero}
      <div class="home-grid">
        <div class="col">
          <div class="card"><div class="card-h"><h2>Up Next</h2><a href="/schedule">Full schedule ${icon('arrow')}</a></div><div class="list">${upcoming.slice(0, 4).map((g) => gameCard(db, g)).join('') || '<p class="muted">Nothing scheduled.</p>'}</div></div>
          <div class="card"><div class="card-h"><h2>Latest Results</h2><a href="/scores">All scores ${icon('arrow')}</a></div><div class="list">${recent.map((g) => gameCard(db, g)).join('') || '<p class="muted">No games played yet.</p>'}</div></div>
        </div>
        <div class="col">${standings}${road}${rules}</div>
      </div>
    </div>`));
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

  const plays = `<div class="card"><div class="card-h"><h2>Scoring &amp; Turnovers</h2></div>${evs.length ? `<ol class="plays">${evs.map((e) => {
    const tm = db.teams[e.team] || a;
    return `<li style="--c:${esc(tm.color)}">${logo(tm, 32)}<div><span class="tag ${e.type === 'TD' ? 'td' : 'int'}">${e.type === 'TD' ? 'Touchdown' : 'Interception'}</span>
      <p><b>${e.player ? playerLink(tm, e.player) : 'Unknown'}</b>${e.type === 'TD' ? (e.passer ? ` catches a TD pass from <b>${playerLink(tm, e.passer)}</b>` : ' scores a touchdown') : ' picks it off'}${e.note ? ` <span class="muted">· ${esc(e.note)}</span>` : ''}</p></div></li>`;
  }).join('')}</ol>` : `<p class="muted">${isFinal(g) ? 'No plays were recorded for this game.' : 'Plays will show up here after the game.'}</p>`}</div>`;

  const box = (tm) => {
    const rows = {};
    const r = (n) => (rows[n] = rows[n] || { td: 0, ptd: 0, int: 0 });
    for (const e of evs) {
      if (e.team !== tm.id) continue;
      if (e.player) r(e.player)[e.type === 'TD' ? 'td' : 'int']++;
      if (e.type === 'TD' && e.passer) r(e.passer).ptd++;
    }
    const list = Object.entries(rows);
    return `<div class="card"><div class="card-h"><h2 class="th">${logo(tm, 26)} ${esc(tm.name)}</h2></div>${list.length ? `<table class="tbl"><thead><tr><th class="l">Player</th><th>TD</th><th>Pass TD</th><th>INT</th></tr></thead><tbody>${list.map(([n, s]) => `<tr><td class="l">${playerLink(tm, n, true)}</td><td>${s.td || '–'}</td><td>${s.ptd || '–'}</td><td>${s.int || '–'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No player stats recorded.</p>'}</div>`;
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
    <div class="wrap game-grid">${plays}<div class="col">${box(a)}${box(b)}</div></div>`));
});

app.get('/playoffs/:slug', (req, res) => {
  const db = load();
  const b = db.bowls.find((x) => x.slug === req.params.slug);
  if (!b) return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Bowl not found')));
  const g = db.games.find((x) => x.bowl === b.slug);
  const champ = g && winner(g) ? db.teams[winner(g)] : null;
  res.send(layout(req, b.name, `
    <section class="ph bowl"><div class="wrap"><div class="kicker">${icon('trophy')} MFL Postseason</div><h1>${esc(b.name)}</h1>
      <p>${icon('cal')} ${esc(longDate(g?.date || b.date))} &nbsp; ${icon('clock')} ${g?.date ? time12(g.time) : 'Time TBD'} &nbsp; ${icon('pin')} ${VENUE}</p></div></section>
    <div class="wrap">
      ${champ ? `<div class="champ" style="--a:${esc(champ.color)}">${logo(champ, 88)}<div><div class="kicker">${esc(b.name)} Champions</div><h2>${esc(teamFull(champ))}</h2></div></div>` : ''}
      <div class="bowl-grid">
        <div class="card"><div class="card-h"><h2>The Matchup</h2></div>${g ? gameCard(db, g) : ''}</div>
        <div class="card"><div class="card-h"><h2>All Bowls</h2></div><ol class="road">
        ${db.bowls.map((x) => { const gg = db.games.find((y) => y.bowl === x.slug); const wn = gg && winner(gg) ? db.teams[winner(gg)] : null;
          return `<li class="${gg && isFinal(gg) ? 'done' : ''} ${x.slug === b.slug ? 'cur' : ''}"><a href="/playoffs/${x.slug}"><span class="road-dot"></span><div><b>${esc(x.name)}</b><small>${esc(gg?.date ? shortDate(gg.date) : 'Date TBD')}${gg && isFinal(gg) ? ` · ${Math.max(gg.homeScore, gg.awayScore)}–${Math.min(gg.homeScore, gg.awayScore)}` : gg?.status === 'postponed' ? ' · Postponed' : ''}</small></div>${wn ? `<span class="road-w">${logo(wn, 22)} ${esc(wn.abbr)}</span>` : ''}</a></li>`; }).join('')}
        </ol></div>
      </div>
    </div>`));
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
  res.send(layout(req, teamFull(tm), `
    <section class="th-hero" style="--a:${esc(tm.color)};--b:${esc(tm.color2)}"><div class="wrap">${logo(tm, 132, 'big')}
      <div><div class="kicker">${esc(tm.city)}</div><h1>${esc(tm.name)}</h1>
      <div class="th-stats"><div><b>${record(s)}</b><small>Record</small></div><div><b>${s.pf}</b><small>Points</small></div><div><b>${s.td}</b><small>TDs</small></div><div><b>${s.int}</b><small>INTs</small></div><div><b>${s.streak || '–'}</b><small>Streak</small></div></div></div></div></section>
    <div class="wrap home-grid">
      <div class="col">
        <div class="card"><div class="card-h"><h2>Roster</h2><span class="muted sm">Captain: ${esc(tm.captain)}</span></div><div class="roster">
          ${tm.roster.map((p) => `<a class="pl" href="${playerUrl(tm, p)}">${avatar(tm, p, 46)}<div><b>${p.number ? `<span class="num">#${esc(p.number)}</span> ` : ''}${esc(p.name)}</b><small>${esc([p.position, tagName(p.tag)].filter(Boolean).join(' · '))}</small></div></a>`).join('')}
        </div></div>
        <div class="card"><div class="card-h"><h2>Recent Results</h2></div><div class="list">${done.map((g) => gameCard(db, g)).join('') || '<p class="muted">No games yet.</p>'}</div></div>
      </div>
      <div class="col">
        <div class="card"><div class="card-h"><h2>Team Leaders</h2></div>
          ${[['td', 'Touchdowns'], ['ptd', 'Passing TDs'], ['int', 'Interceptions']].map(([k, n]) => { const p = lead(k); return `<div class="leader"><span class="av" style="background:${esc(tm.color)};color:${readableOn(tm.color)}">${p && p[k] ? initials(p.name) : '–'}</span><div><small>${n}</small><b>${p && p[k] ? playerLink(tm, p.name) : 'No leader yet'}</b></div><span class="leader-n">${p && p[k] ? p[k] : ''}</span></div>`; }).join('')}</div>
        <div class="card"><div class="card-h"><h2>Upcoming</h2><a href="/schedule">Schedule ${icon('arrow')}</a></div><div class="list">${upcoming.map((g) => gameCard(db, g)).join('') || '<p class="muted">Nothing scheduled.</p>'}</div></div>
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
  const s = { td: 0, ptd: 0, int: 0, log: [] };
  const name = p.name.toLowerCase();
  const games = db.games.filter((g) => g.status === 'final' && (g.home === tm.id || g.away === tm.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const g of games) {
    const row = { g, td: 0, ptd: 0, int: 0 };
    for (const e of g.events || []) {
      if (e.team !== tm.id) continue;
      if ((e.player || '').toLowerCase() === name) row[e.type === 'TD' ? 'td' : 'int']++;
      if (e.type === 'TD' && (e.passer || '').toLowerCase() === name) row.ptd++;
    }
    if (row.td || row.ptd || row.int) {
      s.log.push(row);
      if (g.type !== 'exhibition') { s.td += row.td; s.ptd += row.ptd; s.int += row.int; }
    }
  }
  return s;
}

app.get('/players/:team/:pid', (req, res) => {
  const db = load();
  const tm = db.teams[req.params.team];
  const p = tm?.roster.find((x) => x.id === req.params.pid);
  if (!p) return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Player not found')));
  const s = playerStats(db, tm, p);
  const opp = (g) => db.teams[g.home === tm.id ? g.away : g.home];
  const mates = tm.roster.filter((x) => x.id !== p.id);
  const facts = [['Number', p.number && '#' + p.number], ['Position', p.position], ['Grade', p.grade], ['Status', tagName(p.tag)]].filter(([, v]) => v);
  res.send(layout(req, p.name, `
    <section class="pp-hero" style="--a:${esc(tm.color)};--b:${esc(tm.color2)}"><div class="wrap">
      <div class="pp-photo">${avatar(tm, p, 220, 'xl')}${p.number ? `<span class="pp-num">${esc(p.number)}</span>` : ''}</div>
      <div class="pp-info">
        <a class="pp-team" href="/teams/${tm.id}">${logo(tm, 26)} ${esc(teamFull(tm))}</a>
        <h1>${esc(p.name)}</h1>
        <div class="pp-facts">${facts.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="th-stats"><div><b>${s.td}</b><small>TDs</small></div><div><b>${s.ptd}</b><small>Pass TDs</small></div><div><b>${s.int}</b><small>INTs</small></div><div><b>${s.log.filter((r) => r.g.type !== 'exhibition').length}</b><small>Games w/ stats</small></div></div>
      </div>
    </div></section>
    <div class="wrap home-grid">
      <div class="col">
        <div class="card"><div class="card-h"><h2>Bio</h2></div>${p.bio ? `<div class="bio">${esc(p.bio).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>')}</p></div>` : '<p class="muted">No bio yet.</p>'}</div>
        <div class="card"><div class="card-h"><h2>Game Log</h2></div>${s.log.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th>Result</th><th>TD</th><th>Pass TD</th><th>INT</th></tr></thead><tbody>
          ${s.log.map(({ g, td, ptd, int }) => { const o = opp(g); const mine = g.home === tm.id ? g.homeScore : g.awayScore; const theirs = g.home === tm.id ? g.awayScore : g.homeScore; const r = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
            return `<tr><td class="l"><a href="/games/${g.id}">${esc(shortDate(g.date))}</a>${gameLabel(db, g) ? ` <span class="tag ${g.type}">${esc(gameLabel(db, g))}</span>` : ''}</td><td class="l"><span class="th">${logo(o, 22)} ${esc(o.name)}</span></td><td><span class="res ${r}">${r}</span> ${mine}–${theirs}</td><td>${td || '–'}</td><td>${ptd || '–'}</td><td>${int || '–'}</td></tr>`; }).join('')}
          </tbody></table></div><p class="muted sm">Season totals don't count exhibitions.</p>` : '<p class="muted">No stats recorded yet.</p>'}</div>
      </div>
      <div class="col">
        <div class="card"><div class="card-h"><h2>Teammates</h2><a href="/teams/${tm.id}">Team ${icon('arrow')}</a></div><div class="mates">
          ${mates.map((m) => `<a class="mate" href="${playerUrl(tm, m)}">${avatar(tm, m, 36)}<div><b>${esc(m.name)}</b><small>${esc([m.position, tagName(m.tag)].filter(Boolean).join(' · '))}</small></div></a>`).join('')}
        </div></div>
      </div>
    </div>`));
});

// ---------- admin ----------
const adminNav = (cur) => `<div class="seg admin-seg">${[['/admin', 'Games'], ['/admin/game/new', '+ New game'], ['/admin/players', 'Players'], ['/admin/teams', 'Teams'], ['/admin/bowls', 'Bowls'], ['/admin/logout', 'Log out']].map(([h, n]) => `<a class="${cur === h ? 'on' : ''}" href="${h}">${n}</a>`).join('')}</div>`;
const savedMsg = (req) => (req.query.saved ? '<div class="toast">Saved ✓</div>' : '');

app.get('/admin/login', (req, res) => {
  res.send(layout(req, 'Admin Login', `<div class="wrap login"><form method="post" class="card form">
    <img src="/static/mfl-logo.webp" alt="" class="login-logo"><h2>Admin</h2>
    ${req.query.bad ? '<p class="err">Wrong password.</p>' : ''}<label>Password<input type="password" name="password" autofocus required></label><button class="btn">Log in</button></form></div>`, { ticker: false }));
});
app.post('/admin/login', (req, res) => {
  const p = String(req.body.password || '');
  const ok = p.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(ADMIN_PASSWORD));
  if (!ok) return res.redirect('/admin/login?bad=1');
  const exp = String(Date.now() + 30 * 24 * 3600 * 1000);
  res.setHeader('Set-Cookie', `mfl_admin=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
  res.redirect('/admin');
});
app.get('/admin/logout', (req, res) => { res.setHeader('Set-Cookie', 'mfl_admin=; Path=/; Max-Age=0'); res.redirect('/'); });

app.get('/admin', requireAdmin, (req, res) => {
  const db = load();
  const t = today();
  const all = req.query.show === 'all';
  let games = [...db.games].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  if (!all) games = games.filter((g) => !g.date || (g.date >= addDays(t, -14) && g.date <= addDays(t, 14)));
  res.send(layout(req, 'Admin', pageHead('Admin', 'Manage Games') + `<div class="wrap">${adminNav('/admin')}${savedMsg(req)}
    <p class="muted">${all ? '<a href="/admin">Show only ±2 weeks</a>' : 'Showing games within 2 weeks of today · <a href="/admin?show=all">Show all</a>'}</p>
    <div class="card"><div class="scroll"><table class="tbl admin"><thead><tr><th class="l">Date</th><th class="l">Matchup</th><th>Type</th><th>Status</th><th>Score</th><th></th></tr></thead><tbody>
    ${games.map((g) => `<tr class="${g.date === t ? 'today' : ''}"><td class="l">${esc(shortDate(g.date))}</td><td class="l">${esc(db.teams[g.home].abbr)} vs ${esc(db.teams[g.away].abbr)}</td><td>${esc(gameLabel(db, g) || 'Regular')}</td><td>${statusBadge(g)}</td><td>${isFinal(g) ? `${g.homeScore}–${g.awayScore}` : ''}</td><td class="r"><a class="btn sm" href="/admin/game/${g.id}">Edit</a></td></tr>`).join('')}
    </tbody></table></div></div></div>`, { ticker: false }));
});

function gameForm(db, g, isNew) {
  const teams = Object.values(db.teams);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const t1 = db.teams[g.home] || teams[0], t2 = db.teams[g.away] || teams[1];
  // Every play row posts all five fields so the arrays stay aligned in readGame.
  const evRow = (e) => {
    const tm = db.teams[e.team] || t1;
    const td = e.type !== 'INT';
    return `<div class="ev" style="--c:${esc(tm.color)}">
      <input type="hidden" name="ev_type" value="${td ? 'TD' : 'INT'}"><input type="hidden" name="ev_team" value="${esc(tm.id)}">
      <div class="ev-who">${logo(tm, 30)}<span class="tag ${td ? 'td' : 'int'}">${td ? 'TD' : 'INT'}</span></div>
      <input name="ev_player" list="pl-${esc(tm.id)}" placeholder="${td ? 'Who scored?' : 'Who intercepted?'}" value="${esc(e.player)}">
      ${td ? `<input name="ev_passer" list="pl-${esc(tm.id)}" placeholder="Thrown by (optional)" value="${esc(e.passer)}">` : '<input type="hidden" name="ev_passer" value=""><span class="ev-gap"></span>'}
      <input name="ev_note" class="ev-note" placeholder="Note" value="${esc(e.note)}">
      <button type="button" class="ev-x" onclick="this.parentElement.remove();mflEmpty()" aria-label="Remove play">✕</button>
    </div>`;
  };
  const tpl = teams.flatMap((t) => ['TD', 'INT'].map((type) => `<template id="tpl-${t.id}-${type}">${evRow({ team: t.id, type })}</template>`)).join('');
  const addBtns = teams.map((t) => `<div class="add-team">${logo(t, 22)}<b>${esc(t.name)}</b><button type="button" class="chip td" onclick="mflAdd('${t.id}','TD')">+ Touchdown</button><button type="button" class="chip int" onclick="mflAdd('${t.id}','INT')">+ Interception</button></div>`).join('');
  const statusPills = [['scheduled', 'Scheduled'], ['live', 'Live'], ['final', 'Final'], ['postponed', 'Postponed']]
    .map(([v, n]) => `<label class="pill-r"><input type="radio" name="status" value="${v}" ${g.status === v ? 'checked' : ''}><span>${n}</span></label>`).join('');
  return `<form method="post" class="form ge">
    ${teams.map((t) => `<datalist id="pl-${t.id}">${t.roster.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>`).join('')}
    <input type="hidden" name="home" value="${esc(t1.id)}"><input type="hidden" name="away" value="${esc(t2.id)}">

    <section class="card">
      <div class="card-h"><h2>Result</h2></div>
      <div class="pills">${statusPills}</div>
      <div class="sb">
        <label class="sb-team">${logo(t1, 64)}<b>${esc(t1.name)}</b><input type="number" min="0" inputmode="numeric" name="homeScore" value="${esc(g.homeScore ?? '')}" placeholder="–"></label>
        <span class="sb-vs">VS</span>
        <label class="sb-team">${logo(t2, 64)}<b>${esc(t2.name)}</b><input type="number" min="0" inputmode="numeric" name="awayScore" value="${esc(g.awayScore ?? '')}" placeholder="–"></label>
      </div>
      <p class="muted sm center">Set the status to <b>Final</b> and enter both scores to post the result.</p>
    </section>

    <section class="card">
      <div class="card-h"><h2>Box Score</h2><span class="muted sm">Touchdowns &amp; interceptions · leave out anything you don't know</span></div>
      <div id="evs">${(g.events || []).map(evRow).join('')}</div>
      <p id="evEmpty" class="empty" ${(g.events || []).length ? 'hidden' : ''}>No plays added yet. Use the buttons below to add touchdowns and interceptions.</p>
      <div class="adds">${addBtns}</div>
      ${tpl}
    </section>

    <section class="card">
      <div class="card-h"><h2>Game Details</h2></div>
      <div class="fgrid">
        <label>Date<input type="date" name="date" value="${esc(g.date || '')}"></label>
        <label>Time<input type="time" name="time" value="${esc(g.time || '12:35')}"></label>
        <label>Game type<select name="type" onchange="document.getElementById('bowlF').hidden=this.value!=='playoff'">${opt('regular', g.type, 'Regular season')}${opt('exhibition', g.type, 'Exhibition')}${opt('playoff', g.type, 'Playoff bowl')}</select></label>
        <label id="bowlF" ${g.type === 'playoff' ? '' : 'hidden'}>Bowl<select name="bowl"><option value="">—</option>${db.bowls.map((b) => opt(b.slug, g.bowl, b.name)).join('')}</select></label>
        <label class="wide">Reason <small class="muted">(shown for postponed or exhibition games)</small><input name="reason" value="${esc(g.reason)}" placeholder="e.g. Rain, assembly, scrimmage"></label>
      </div>
    </section>

    <div class="savebar">
      ${isNew ? '<a class="btn ghost" href="/admin">Cancel</a>' : `<button class="btn ghost danger" formaction="/admin/game/${g.id}/delete" onclick="return confirm('Delete this game for good?')">Delete game</button>`}
      <button class="btn">${isNew ? 'Create game' : 'Save changes'}</button>
    </div>
  </form>
  <script>
  function mflEmpty(){document.getElementById('evEmpty').hidden=!!document.querySelector('#evs .ev');}
  function mflAdd(t,type){const tp=document.getElementById('tpl-'+t+'-'+type);document.getElementById('evs').insertAdjacentHTML('beforeend',tp.innerHTML);mflEmpty();const rows=document.querySelectorAll('#evs .ev');rows[rows.length-1].querySelector('input[name=ev_player]').focus();}
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
  g.homeScore = num(body.homeScore); g.awayScore = num(body.awayScore);
  delete g.quarters;
  const types = arr(body.ev_type);
  g.events = types.map((t, i) => ({
    type: t === 'INT' ? 'INT' : 'TD', team: arr(body.ev_team)[i], player: (arr(body.ev_player)[i] || '').trim(),
    passer: t === 'TD' ? (arr(body.ev_passer)[i] || '').trim() : '', note: (arr(body.ev_note)[i] || '').trim(),
  })).filter((e) => e.player || e.passer || e.note);
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
        <label class="wide">Logo (PNG/JPG/SVG, under ~3MB)<input type="file" accept="image/*" onchange="const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{this.form.logo.value=r.result;};r.readAsDataURL(f)"></label>
        <input type="hidden" name="logo" value="">
        <label class="chk"><input type="checkbox" name="clearLogo"> Remove current logo</label>
        <label class="wide">Roster: one per line as "Name | Tag" (tags: C, TR, Rd 1, FA…). Edit bios &amp; photos under Players.<textarea name="roster" rows="10">${esc(t.roster.map((p) => (p.tag ? `${p.name} | ${p.tag}` : p.name)).join('\n'))}</textarea></label>
      </div><div class="actions"><button class="btn">Save ${esc(t.name)}</button></div></form>`).join('')}</div>`, { ticker: false }));
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
  else if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(b.logo || '')) t.logo = b.logo;
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

app.use((req, res) => res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Page not found', '<a href="/">Back home →</a>'))));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Something went wrong. Try again in a moment.'); });

if (require.main === module) app.listen(PORT, () => console.log(`MFL running on :${PORT}`));
module.exports = app;
