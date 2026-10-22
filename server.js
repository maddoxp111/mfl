const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { load, save, refresh, putMedia, getMedia, slug, putDoc, getDoc, listDocs, deleteDoc } = require('./db');
const pk = require('./pickem');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('mfl:' + ADMIN_PASSWORD).digest('hex');
const TZ = process.env.TZ_LEAGUE || 'America/Chicago';
const VENUE = 'Thomas Metcalf School';

app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(express.json({ limit: '100kb' }));
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
    <div class="gc-foot"><span>${icon('pin')} ${VENUE}</span>${g.reason && (g.status === 'postponed' || g.type === 'exhibition') ? `<span class="gc-reason">${esc(g.reason)}</span>` : ''}</div>
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
<link rel="icon" href="/static/mfl-logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Archivo:wght@700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css?v=14">
</head><body>
<header class="hdr"><div class="hdr-in">
  <a class="brand" href="/"><img src="/static/mfl-logo.webp" alt=""><span>MFL</span></a>
  <button class="burger" aria-label="Menu" onclick="document.body.classList.toggle('nav-open')"><span></span><span></span></button>
  <nav class="nav">
    <div class="dd ${on(['/schedule', '/scores', '/games'])}"><button>Games ${icon('chev')}</button><div class="dd-m">
      <a href="/schedule">${icon('cal')} Schedule</a><a href="/scores">${icon('clock')} Scores</a><a href="/history">${icon('swap')} Head-to-Head</a></div></div>
    <div class="dd ${on(['/playoffs'])}"><button>Playoffs ${icon('chev')}</button><div class="dd-m">
      ${db.bowls.map((b) => `<a href="/playoffs/${b.slug}">${icon('trophy')} ${esc(b.name)}</a>`).join('')}</div></div>
    <div class="dd ${on(['/teams'])}"><button>Teams ${icon('chev')}</button><div class="dd-m">
      ${teams.map((t) => `<a href="/teams/${t.id}">${logo(t, 22)} ${esc(teamFull(t))}</a>`).join('')}<a href="/transactions">${icon('swap')} Transactions</a></div></div>
    <div class="dd ${on(['/stats'])}"><button>Stats ${icon('chev')}</button><div class="dd-m">
      <a href="/stats/team">${icon('chart')} Team Stats</a><a href="/stats/players">${icon('star')} Player Leaders</a></div></div>
    <a class="nav-pick ${on(['/pickem'])}" href="/pickem">${icon('coin')} Pick'em</a>
    <div class="acct-box">${user
      ? `<a class="acct" href="/pickem/me" title="My bets">${icon('user')}<b>@${esc(user)}</b><span class="coins">${icon('coin')}<span data-balance>…</span></span></a>`
      : `<a class="acct" href="/pickem/login?next=${encodeURIComponent(cur.startsWith('/pickem') ? cur : '/pickem')}">Log in</a><a class="acct primary" href="/pickem/signup">Sign up</a>`}
    ${admin ? '<a class="nav-admin" href="/admin">Admin</a>' : ''}</div>
  </nav>
</div></header>
${opts.ticker === false ? '' : ticker(db)}
<main>${body}</main>
<footer class="ftr"><div class="wrap ftr-in">
  <div class="ftr-brand"><img src="/static/mfl-logo.webp" alt=""><div><b>Metcalf Football League</b><small>All games at ${VENUE}</small></div></div>
  <div class="ftr-links"><a href="/schedule">Schedule</a><a href="/scores">Scores</a><a href="/pickem">Pick'em</a><a href="/history">Head-to-Head</a><a href="/stats/players">Leaders</a><a href="/calendar.ics">Add to calendar</a>${teams.map((t) => `<a href="/teams/${t.id}">${esc(t.name)}</a>`).join('')}<a href="/admin">Admin</a></div>
</div></footer>
<script>
document.querySelectorAll('.dd>button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const p=b.parentElement,o=p.classList.contains('open');document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'));if(!o)p.classList.add('open');}));
document.addEventListener('click',()=>document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open')));
const t=document.querySelector('.tk.now');if(t)t.parentElement.parentElement.scrollLeft=t.offsetLeft-16;
if(document.querySelector('.acct [data-balance]'))fetch('/pickem/me.json').then(r=>r.json()).then(d=>{if(d.balance!=null)document.querySelectorAll('[data-balance]').forEach(n=>n.textContent=d.balance.toLocaleString('en-US'))}).catch(()=>{});
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
        <div class="col"><a class="card promo" href="/pickem"><div>${icon('coin')}</div><div><b>Pick'em is live</b><span>Free to play. Bet coins on every game, with parlays and player props.</span></div>${icon('arrow')}</a>${standings}${road}${rules}</div>
      </div>
    </div>${countdownScript}`));
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
    <div class="wrap">${isFinal(g) || g.status === 'postponed' ? '' : preview(db, g)}</div>
    <div class="wrap game-grid">${plays}<div class="col">${box(a)}${box(b)}</div></div>${countdownScript}`));
});

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
  return `<div class="card preview" style="--a:${esc(a.color)};--b:${esc(b.color)}">
    <div class="card-h"><h2>Game Preview</h2>${countdown(g)}</div>
    <div class="pv-head"><span>${logo(a, 28)} ${esc(a.abbr)}</span><span>${esc(b.abbr)} ${logo(b, 28)}</span></div>
    ${line('Record', record(sA), record(sB))}
    ${line('Points / game', per(sA.pf, sA.gp), per(sB.pf, sB.gp))}
    ${line('Allowed / game', per(sA.pa, sA.gp), per(sB.pa, sB.gp))}
    ${line('Touchdowns', sA.td, sB.td)}
    ${line('Interceptions', sA.int, sB.int)}
    ${line('Streak', sA.streak || '–', sB.streak || '–')}
    ${line('TD leader', ldr(a), ldr(b))}
    <p class="pv-note">${last ? `Last meeting: <a href="/games/${last.id}">${esc(db.teams[winner(last) || last.home].name)} ${winner(last) ? 'won' : 'tied'} ${Math.max(last.homeScore, last.awayScore)}–${Math.min(last.homeScore, last.awayScore)}</a> on ${esc(shortDate(last.date))}.` : 'First meeting of the season.'}
      ${m ? ` Pick'em gives the ${esc(a.name)} a ${wp(a)}% chance and the ${esc(b.name)} ${wp(b)}%. The spread is <b>${esc(db.teams[m.fav].name)} -${m.line}</b>.` : ''}</p>
    ${open ? `<a class="btn" href="/pickem">${icon('coin')} Make your picks: ${m.list.length} bets</a>` : ''}
  </div>`;
}

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
  const s = { td: 0, ptd: 0, int: 0, log: [] };
  const name = p.name.toLowerCase();
  const games = db.games.filter((g) => g.status === 'final').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const g of games) {
    const row = { g, td: 0, ptd: 0, int: 0, team: null };
    for (const e of g.events || []) {
      const hit = (e.player || '').toLowerCase() === name || (e.type === 'TD' && (e.passer || '').toLowerCase() === name);
      if (!hit || (row.team && row.team !== e.team)) continue;
      row.team = e.team;
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
  if (!p) {
    const moved = Object.values(db.teams).find((t) => t.roster.some((x) => x.id === req.params.pid));
    if (moved) return res.redirect(`/players/${moved.id}/${req.params.pid}`);
    return res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Player not found')));
  }
  const s = playerStats(db, tm, p);
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
        <div class="th-stats"><div><b>${s.td}</b><small>TDs</small></div><div><b>${s.ptd}</b><small>Pass TDs</small></div><div><b>${s.int}</b><small>INTs</small></div><div><b>${s.log.filter((r) => r.g.type !== 'exhibition').length}</b><small>Games w/ stats</small></div></div>
      </div>
    </div></section>
    <div class="wrap home-grid">
      <div class="col">
        <div class="card"><div class="card-h"><h2>Bio</h2></div>${p.bio ? `<div class="bio">${esc(p.bio).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>')}</p></div>` : '<p class="muted">No bio yet.</p>'}</div>
        <div class="card"><div class="card-h"><h2>Game Log</h2></div>${s.log.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th>Result</th><th>TD</th><th>Pass TD</th><th>INT</th></tr></thead><tbody>
          ${s.log.map(({ g, td, ptd, int, team }) => { const o = opp(g, team); const mine = g.home === team ? g.homeScore : g.awayScore; const theirs = g.home === team ? g.awayScore : g.homeScore; const r = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
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
const coins = (n) => `<span class="coins">${icon('coin')}${Number(n).toLocaleString('en-US')}</span>`;
const oddsTxt = (d) => pk.american(d);
function matchName(db, g) { return `${db.teams[g.home].abbr} vs ${db.teams[g.away].abbr}`; }

function oddsBtn(db, g, m, cls = '') {
  return `<button type="button" class="ob ${cls}" data-game="${g.id}" data-key="${esc(m.key)}" data-label="${esc(m.label)}" data-odds="${m.odds}" data-match="${esc(matchName(db, g))}"><span>${esc(m.label)}</span><b>${oddsTxt(m.odds)}</b></button>`;
}
function openGames(db) {
  const g = pk.nextGame(db, TZ);
  return g ? [g] : [];
}

// Bet slip: lives in the browser until submitted; the server re-prices every pick.
function slip(user) {
  return `<aside class="slip" id="slip" hidden>
    <button class="slip-head" type="button" onclick="document.getElementById('slip').classList.toggle('min')"><b>Bet slip</b><span id="slipCount">0</span><span id="slipKind" class="muted"></span></button>
    <div class="slip-body">
      <div id="slipLegs"></div>
      <label class="slip-stake">Bet<input type="number" id="slipStake" min="${pk.MIN_STAKE}" step="10" value="50" inputmode="numeric"></label>
      <div class="slip-sum"><span>Odds <b id="slipOdds">–</b></span><span>To win <b id="slipWin">–</b></span></div>
      ${user ? '<button class="btn slip-go" id="slipGo" type="button">Place bet</button>' : '<a class="btn slip-go" href="/pickem/login?next=/pickem">Log in to bet</a>'}
      <p class="slip-msg" id="slipMsg"></p>
      <button type="button" class="slip-clear" onclick="mflSlip.clear()">Clear slip</button>
    </div>
  </aside>
  <script>
  const mflSlip = (() => {
    const KEY = 'mfl_slip';
    let legs = []; try { legs = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
    const el = (id) => document.getElementById(id);
    const amer = (d) => d >= 2 ? '+' + Math.round((d - 1) * 100) : '-' + Math.round(100 / (d - 1));
    const store = () => { try { localStorage.setItem(KEY, JSON.stringify(legs)); } catch {} };
    function render() {
      document.querySelectorAll('.ob').forEach((b) => b.classList.toggle('on', legs.some((l) => l.game === b.dataset.game && l.key === b.dataset.key)));
      document.querySelectorAll('.combo').forEach((c) => c.classList.toggle('on', JSON.parse(c.dataset.legs).every((x) => legs.some((l) => l.game === x.game && l.key === x.key))));
      el('slip').hidden = !legs.length;
      el('slipCount').textContent = legs.length;
      el('slipKind').textContent = legs.length > 1 ? legs.length + '-leg parlay' : 'Single';
      el('slipLegs').innerHTML = legs.map((l, i) => '<div class="sl"><div><small>' + l.match + '</small><b>' + l.label + '</b></div><span>' + amer(l.odds) + '</span><button type="button" onclick="mflSlip.remove(' + i + ')" aria-label="Remove">✕</button></div>').join('');
      const odds = legs.reduce((x, l) => x * l.odds, 1), stake = Math.floor(+el('slipStake').value || 0);
      el('slipOdds').textContent = legs.length ? amer(odds) : '–';
      el('slipWin').textContent = legs.length && stake ? Math.floor(stake * odds).toLocaleString() : '–';
    }
    document.addEventListener('click', (e) => {
      // Ready-made parlays: add every pick (or take them all back out if already in the slip).
      const c = e.target.closest('.combo');
      if (c) {
        const cl = JSON.parse(c.dataset.legs);
        const has = (x) => legs.some((l) => l.game === x.game && l.key === x.key);
        if (cl.every(has)) legs = legs.filter((l) => !cl.some((x) => x.game === l.game && x.key === l.key));
        else if (legs.length + cl.filter((x) => !has(x)).length > ${pk.MAX_LEGS}) { el('slipMsg').textContent = 'That would go over ${pk.MAX_LEGS} picks.'; el('slip').hidden = false; return; }
        else cl.filter((x) => !has(x)).forEach((x) => legs.push(x));
        el('slipMsg').textContent = ''; el('slip').classList.remove('min'); store(); render();
        return;
      }
      const b = e.target.closest('.ob'); if (!b) return;
      const i = legs.findIndex((l) => l.game === b.dataset.game && l.key === b.dataset.key);
      if (i >= 0) legs.splice(i, 1);
      else if (legs.length >= ${pk.MAX_LEGS}) { el('slipMsg').textContent = 'Max ${pk.MAX_LEGS} picks per parlay.'; }
      else legs.push({ game: b.dataset.game, key: b.dataset.key, label: b.dataset.label, odds: +b.dataset.odds, match: b.dataset.match });
      el('slipMsg').textContent = ''; el('slip').classList.remove('min'); store(); render();
    });
    el('slipStake').addEventListener('input', render);
    const go = el('slipGo');
    if (go) go.addEventListener('click', async () => {
      go.disabled = true; el('slipMsg').textContent = 'Placing bet…'; el('slipMsg').className = 'slip-msg';
      try {
        const r = await fetch('/pickem/bet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks: legs.map((l) => ({ game: l.game, key: l.key })), stake: +el('slipStake').value }) });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error);
        legs = []; store(); render();
        el('slip').hidden = false; el('slipMsg').className = 'slip-msg good';
        el('slipMsg').innerHTML = 'Bet placed! To win ' + d.toWin.toLocaleString() + ' coins. <a href="/pickem/me">My bets →</a>';
        document.querySelectorAll('[data-balance]').forEach((n) => n.textContent = d.balance.toLocaleString());
      } catch (err) { el('slipMsg').className = 'slip-msg bad'; el('slipMsg').textContent = err.message || 'Something went wrong.'; }
      go.disabled = false;
    });
    render();
    return { remove(i) { legs.splice(i, 1); store(); render(); }, clear() { legs = []; store(); render(); } };
  })();
  </script>`;
}

async function loadAccount(db, name) {
  const user = name ? await getDoc(userKey(name)) : null;
  return user ? { user, acct: pk.account(db, user) } : { user: null, acct: null };
}
function pickNav(cur, name) {
  const items = [['/pickem', 'Games'], ['/pickem/me', 'My bets'], ['/pickem/leaderboard', 'Leaderboard'], ['/pickem/rules', 'How it works']];
  return `<div class="seg">${items.map(([h, n]) => `<a class="${cur === h ? 'on' : ''}" href="${h}">${n}</a>`).join('')}${name ? '<a href="/pickem/logout">Log out</a>' : ''}</div>`;
}
function pickHead(user, acct) {
  return `<section class="ph pick-ph"><div class="wrap pick-top">
    <div><div class="kicker">${icon('coin')} Free to play · MFL Coins only</div><h1>Pick'em</h1><p>Bet fake coins on every MFL game. Singles, player props and parlays.</p></div>
    ${user ? `<div class="wallet"><small>@${esc(user.name)}</small><b>${icon('coin')}<span data-balance>${acct.balance.toLocaleString('en-US')}</span></b><span>${acct.won}W · ${acct.lost}L · ${acct.pending} open</span></div>`
      : `<div class="wallet cta"><b>Get ${pk.START_COINS.toLocaleString()} free coins</b><div><a class="btn" href="/pickem/signup">Sign up</a> <a class="btn ghost" href="/pickem/login">Log in</a></div></div>`}
  </div></section>`;
}
function betCard(db, b, opts = {}) {
  const st = { won: 'Won', lost: 'Lost', void: 'Refunded', pending: 'Open' }[b.status];
  return `<div class="bet ${b.status}">
    <div class="bet-h">${opts.who ? `<b>@${esc(opts.who)}</b>` : `<b>${b.legs.length > 1 ? b.legs.length + '-leg parlay' : 'Single'}</b>`}<span class="bet-st">${st}</span></div>
    ${b.legs.map((l, i) => { const g = db.games.find((x) => x.id === l.game); const r = b.res[i];
      return `<div class="bet-leg ${r}"><i></i><div><b>${esc(l.label)}</b><small>${g ? `${esc(matchName(db, g))} · ${esc(shortDate(g.date))}` : 'Game removed'}</small></div><span>${oddsTxt(l.odds)}</span></div>`; }).join('')}
    <div class="bet-f"><span>Bet ${coins(b.stake)} at ${oddsTxt(b.odds)}</span><span>${b.status === 'won' ? `Won ${coins(b.payout)}` : b.status === 'void' ? `Refunded ${coins(b.payout)}` : b.status === 'lost' ? 'Lost' : `To win ${coins(Math.floor(b.stake * b.odds))}`}</span></div>
  </div>`;
}
async function leaderboard(db) {
  const users = await listDocs('users/');
  return users.map((u) => ({ name: u.name, ...pk.account(db, u) })).sort((a, b) => b.balance - a.balance || b.won - a.won);
}

// Compact odds button for player cards: short text on the button, full label in the slip.
function propBtn(db, g, m, short) {
  if (!m) return `<span class="pb off"><span>${short}</span><b>–</b></span>`;
  return `<button type="button" class="ob pb" data-game="${g.id}" data-key="${esc(m.key)}" data-label="${esc(m.label)}" data-odds="${m.odds}" data-match="${esc(matchName(db, g))}"><span>${short}</span><b>${oddsTxt(m.odds)}</b></button>`;
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
  const spr = (t) => m.list.find((x) => x.group === 'Spread' && x.team === t.id);

  // Star cards: always their TD bet, plus 5 rotating picks and a "TD + team wins" combo.
  const cards = stars.map((s) => {
    const pre = (mk) => `${mk}:${s.t.id}:${s.p.id}`;
    const rest = shuffle(['p2td', 'p3td', 'pfirst', 'ppass', 'p2pass', 'pdual', 'pint', 'pint_td'].filter((mk) => k[pre(mk)]), r).slice(0, 5);
    return { ...s, bets: ['ptd', ...rest].map((mk) => ({ m: k[pre(mk)], short: STAR_SHORT[mk] })), combo: [leg(pre('ptd')), leg(`ml:${s.t.id}`)].filter(Boolean) };
  });

  // Ready-made star parlays (at most one "who wins" pick each, so they always validate).
  const C = [];
  const add = (title, keys, tag = '') => { const legs = keys.map(leg); if (legs.every(Boolean)) C.push({ title, tag, legs }); };
  // First names on tickets, unless two stars share one (e.g. two Maddoxes).
  const firsts = stars.map((x) => x.p.name.split(' ')[0].toLowerCase());
  const first = (n) => (firsts.filter((f) => f === n.split(' ')[0].toLowerCase()).length > 1 ? n : n.split(' ')[0]);
  const byTeam = (t) => stars.filter((s) => s.t.id === t.id);
  for (const t of [db.teams[g.home], db.teams[g.away]]) {
    const ss = byTeam(t);
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
      const a = ss[i].p, b = ss[j].p;
      add(`${first(a.name)} & ${first(b.name)} both score`, [`ptd:${t.id}:${a.id}`, `ptd:${t.id}:${b.id}`], 'Duo');
      add(`${first(a.name)} throws, ${first(b.name)} scores`, [`ppass:${t.id}:${a.id}`, `ptd:${t.id}:${b.id}`], 'Connection');
    }
    if (ss.length >= 3) add(`${t.name} big three all score`, ss.slice(0, 3).map((s) => `ptd:${t.id}:${s.p.id}`), 'Trio');
    for (const s of ss) {
      add(`${first(s.p.name)} scores first, ${t.name} win`, [`pfirst:${t.id}:${s.p.id}`, `ml:${t.id}`], 'Statement');
      add(`${first(s.p.name)} goes off: 2+ TDs & ${t.name} 21+`, [`p2td:${t.id}:${s.p.id}`, `tt:${t.id}:21`], 'Big game');
      add(`${first(s.p.name)} does it all, ${t.name} win`, [`pdual:${t.id}:${s.p.id}`, `ml:${t.id}`], 'MVP');
      if (spr(t)) add(`${first(s.p.name)} scores & ${t.name} cover ${pk.fmtLine(spr(t).line)}`, [`ptd:${t.id}:${s.p.id}`, spr(t).key], 'Spread');
      for (const o of byTeam(opp(t))) add(`${first(s.p.name)} picks one off, ${first(o.p.name)} still scores`, [`pint:${t.id}:${s.p.id}`, `ptd:${opp(t).id}:${o.p.id}`], 'Rivalry');
    }
  }
  const caps = stars.filter((s) => s.role === 'Captain');
  if (caps.length === 2) {
    add('Captain clash: both captains score', caps.map((s) => `ptd:${s.t.id}:${s.p.id}`), 'Captains');
    add('Captains both throw a TD', caps.map((s) => `ppass:${s.t.id}:${s.p.id}`), 'Captains');
  }
  const combos = shuffle(C, r).slice(0, 16).map((c) => ({ ...c, odds: c.legs.reduce((x, l) => x * l.odds, 1) }));
  return { cards: shuffle(cards, r), combos };
}
function featuredHtml(db, g, m) {
  const { cards, combos } = featured(db, g, m);
  if (!cards.length) return '';
  const roleIcon = { Captain: 'C', 'Team Rep': 'TR', Hot: '🔥' };
  const comboBtn = (legs, inner, cls) => `<button type="button" class="combo ${cls}" data-legs="${esc(JSON.stringify(legs))}">${inner}</button>`;
  return `<section class="feat">
    <div class="feat-h"><div><span class="kicker">${icon('star')} Featured</span><h2>Star Spotlight</h2></div><small>Captains, team reps and the hottest players. Featured bets change every game.</small></div>
    <div class="spot">${cards.map((c) => `<article class="star" style="--c:${esc(c.t.color)}">
      <div class="star-top"><span class="role r-${c.role === 'Hot' ? 'hot' : 'tag'}">${roleIcon[c.role]} ${c.role === 'Hot' ? 'On fire' : c.role}</span>${c.p.number ? `<span class="star-num">${esc(c.p.number)}</span>` : ''}
        <a href="${playerUrl(c.t, c.p)}" target="_blank" rel="noopener" class="star-photo">${avatar(c.t, c.p, 112, 'xl')}</a></div>
      <div class="star-name"><b>${esc(c.p.name)}</b><small>${logo(c.t, 16)} ${esc(c.t.name)}${c.p.position ? ' · ' + esc(c.p.position) : ''}</small></div>
      <div class="star-bets">${c.bets.map((b) => propBtn(db, g, b.m, b.short)).join('')}</div>
      ${c.combo.length === 2 ? comboBtn(c.combo, `<span>TD + ${esc(c.t.name)} win</span><b>${oddsTxt(c.combo[0].odds * c.combo[1].odds)}</b>`, 'star-combo') : ''}
    </article>`).join('')}</div>
    <div class="feat-h sub"><div><span class="kicker">${icon('coin')} One tap</span><h2>Star Parlays</h2></div><small>Tap a ticket to drop every pick in your slip.</small></div>
    <div class="tickets">${combos.map((c) => comboBtn(c.legs, `<div class="tk-head"><span class="tk-tag">${esc(c.tag)}</span><span class="tk-n">${c.legs.length} picks</span></div>
      <b class="tk-title">${esc(c.title)}</b>
      <ul>${c.legs.map((l) => `<li>${esc(l.label)}<span>${oddsTxt(l.odds)}</span></li>`).join('')}</ul>
      <div class="tk-foot"><span class="tk-odds">${oddsTxt(c.odds)}</span><span class="tk-add">Add parlay</span></div>`, 'ticket')).join('')}</div>
  </section>`;
}

app.get('/pickem', async (req, res, next) => {
  try {
    const db = load();
    const name = currentUser(req);
    const { user, acct } = await loadAccount(db, name);
    const board = (await leaderboard(db)).slice(0, 8);
    const g = pk.nextGame(db, TZ);
    const side = `
      ${user && acct.pending ? `<div class="card"><div class="card-h"><h2>Your open bets</h2><a href="/pickem/me">All ${icon('arrow')}</a></div>${acct.bets.filter((b) => b.status === 'pending').slice(-3).reverse().map((b) => betCard(db, b)).join('')}</div>` : ''}
      <div class="card"><div class="card-h"><h2>Leaderboard</h2><a href="/pickem/leaderboard">Full ${icon('arrow')}</a></div>${board.length ? `<ol class="lb">${board.map((u, i) => `<li class="${u.name === name ? 'me' : ''}"><span class="rank">${i + 1}</span><b>@${esc(u.name)}</b><small>${u.won}W-${u.lost}L</small>${coins(u.balance)}</li>`).join('')}</ol>` : '<p class="muted">Nobody yet. Be first!</p>'}</div>
      <div class="card"><div class="card-h"><h2>How it works</h2></div><ul class="how"><li>Everyone starts with <b>${pk.START_COINS.toLocaleString()} coins</b>. No real money, ever.</li><li>Only the <b>next game</b> is open. Picks lock at <b>12:31</b>, and the next game opens right then.</li><li>Tap odds to add them to your slip. Two or more picks make a <b>parlay</b>.</li><li>No unders or "player does badly" bets, so nobody can win by throwing a game.</li></ul><a href="/pickem/rules">Full rules ${icon('arrow')}</a></div>`;

    if (!g) {
      return res.send(layout(req, "Pick'em", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem', name)}
        <div class="home-grid"><div class="col"><div class="card empty-pick">${icon('clock')}<h2>No game open right now</h2><p class="muted">Picks open for the next scheduled game. Check back soon.</p></div></div><div class="col">${side}</div></div></div>`));
    }

    const m = pk.markets(db, g), k = m.byKey;
    const A = db.teams[g.home], B = db.teams[g.away];
    const wp = (t) => Math.round((k[`ml:${t.id}`]?.p || 0) * 100);
    const sprOf = (t) => m.list.find((x) => x.group === 'Spread' && x.team === t.id);
    // Players with the best shot at a TD first.
    const tdP = (t, p) => k[`ptd:${t.id}:${p.id}`]?.p || 0;
    const playerCard = (t, p) => `<div class="pc" style="--c:${esc(t.color)}">
      <a class="pc-who" href="${playerUrl(t, p)}" target="_blank" rel="noopener">${avatar(t, p, 52)}<div><b>${esc(p.name)}</b><small>${esc([p.number && '#' + p.number, p.position, tagName(p.tag)].filter(Boolean).join(' · '))}</small></div></a>
      <div class="pc-bets">${[['ptd', 'TD'], ['p2td', '2+ TD'], ['p3td', '3+ TD'], ['pfirst', '1st TD'], ['ppass', 'TD pass'], ['p2pass', '2+ pass'], ['pdual', 'Score + throw'], ['pint', 'INT']].map(([mk, n]) => propBtn(db, g, k[`${mk}:${t.id}:${p.id}`], n)).join('')}</div>
    </div>`;
    const teamProps = (t) => `<div class="pteam" data-team="${t.id}"><h3>${logo(t, 26)} ${esc(t.name)}</h3>${[...t.roster].sort((x, y) => tdP(t, y) - tdP(t, x)).map((p) => playerCard(t, p)).join('')}</div>`;
    const groups = {};
    for (const x of m.list) (groups[x.group] = groups[x.group] || []).push(x);
    const gameBets = ['Spread', 'Alt spreads', 'Total points', 'Team points', 'Winning margin', 'Exact margin', 'Specials', 'Turnovers'].filter((n) => groups[n]).map((n) => `<details class="card mk"><summary><h2>${n}</h2><span class="muted sm">${groups[n].length} bets</span>${icon('chev')}</summary><div class="obs">${groups[n].map((x) => oddsBtn(db, g, x)).join('')}</div></details>`).join('');

    res.send(layout(req, "Pick'em", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem', name)}
      <section class="ng" style="--a:${esc(A.color)};--b:${esc(B.color)}">
        <div class="ng-top"><span class="kicker">${icon('fire')} Next game${gameLabel(db, g) ? ' · ' + esc(gameLabel(db, g)) : ''}</span><span class="ng-when">${esc(longDate(g.date))} · ${time12(g.time)} · <a href="/games/${g.id}">Preview</a></span></div>
        <div class="ng-match">
          <div class="ng-team">${logo(A, 84)}<b>${esc(A.name)}</b><small>${record(teamStats(db, A.id))} · ${wp(A)}% to win</small><div class="ng-bets">${propBtn(db, g, k[`ml:${A.id}`], 'To win')}${propBtn(db, g, sprOf(A), 'Spread ' + (sprOf(A) ? pk.fmtLine(sprOf(A).line) : ''))}</div></div>
          <div class="ng-mid"><small>Picks lock in</small><div class="cd" data-ts="${lockTs(g)}"><div><b>–</b><small>days</small></div><div><b>–</b><small>hrs</small></div><div><b>–</b><small>min</small></div><div><b>–</b><small>sec</small></div></div><small>at ${time12(pk.lockTime(g))}</small></div>
          <div class="ng-team">${logo(B, 84)}<b>${esc(B.name)}</b><small>${record(teamStats(db, B.id))} · ${wp(B)}% to win</small><div class="ng-bets">${propBtn(db, g, k[`ml:${B.id}`], 'To win')}${propBtn(db, g, sprOf(B), 'Spread ' + (sprOf(B) ? pk.fmtLine(sprOf(B).line) : ''))}</div></div>
        </div>
        <div class="winbar"><div style="width:${wp(A)}%;background:${esc(A.color)}"><span>${esc(A.abbr)} ${wp(A)}%</span></div><div style="flex:1;background:var(--card2)"><span>Tie ${Math.max(0, 100 - wp(A) - wp(B))}%</span></div><div style="width:${wp(B)}%;background:${esc(B.color)}"><span>${esc(B.abbr)} ${wp(B)}%</span></div></div>
      </section>
      ${featuredHtml(db, g, m)}
      <div class="home-grid">
        <div class="col">
          <section class="card props" id="all-props">
            <div class="card-h"><h2>${icon('star')} Every player</h2><div class="seg mini" id="ptabs"><a class="on" data-t="all">Both teams</a><a data-t="${A.id}">${esc(A.abbr)}</a><a data-t="${B.id}">${esc(B.abbr)}</a></div></div>
            <p class="muted sm">Sorted by who's most likely to score. Tap a price to add it to your slip.</p>
            <div class="pteams">${teamProps(A)}${teamProps(B)}</div>
          </section>
          ${gameBets}
        </div>
        <div class="col">${side}</div>
      </div></div>${slip(user)}${countdownScript}
      <script>document.getElementById('ptabs').addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;document.querySelectorAll('#ptabs a').forEach(x=>x.classList.toggle('on',x===a));document.querySelectorAll('.pteam').forEach(p=>p.hidden=a.dataset.t!=='all'&&p.dataset.team!==a.dataset.t);document.querySelector('.pteams').classList.toggle('one',a.dataset.t!=='all')});
      document.querySelectorAll('.cd').forEach(el=>{const t=+el.dataset.ts;if(t>Date.now())setTimeout(()=>location.reload(),t-Date.now()+1500)});</script>`));
  } catch (e) { next(e); }
});

// Old per-game links all go to the single next-game page now.
app.get('/pickem/game/:id', (req, res) => res.redirect('/pickem'));

app.post('/pickem/bet', async (req, res) => {
  const db = load();
  const name = currentUser(req);
  if (!name) return res.json({ ok: false, error: 'Log in first.' });
  try {
    const user = await getDoc(userKey(name));
    if (!user) return res.json({ ok: false, error: 'Account not found. Log in again.' });
    const built = pk.buildBet(db, req.body.picks, req.body.stake, TZ);
    if (built.error) return res.json({ ok: false, error: built.error });
    const bal = pk.account(db, user).balance;
    if (built.bet.stake > bal) return res.json({ ok: false, error: `You only have ${bal.toLocaleString('en-US')} coins.` });
    user.bets = user.bets || [];
    user.bets.push(built.bet);
    await putDoc(userKey(name), user);
    res.json({ ok: true, balance: bal - built.bet.stake, toWin: Math.floor(built.bet.stake * built.bet.odds) });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: 'Could not place that bet. Try again.' });
  }
});

app.get('/pickem/me', async (req, res, next) => {
  try {
    const db = load();
    const name = currentUser(req);
    if (!name) return res.redirect('/pickem/login?next=/pickem/me');
    const { user, acct } = await loadAccount(db, name);
    if (!user) return res.redirect('/pickem/logout');
    const bets = [...acct.bets].reverse();
    const canBail = acct.balance < pk.BAILOUT_BELOW && !acct.pending;
    res.send(layout(req, 'My bets', pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/me', name)}
      ${canBail ? `<form method="post" action="/pickem/bailout" class="card bail"><div><b>Out of coins?</b><p class="muted">Get a ${pk.BAILOUT_COINS} coin bailout and keep playing.</p></div><button class="btn">Claim ${pk.BAILOUT_COINS} coins</button></form>` : ''}
      <div class="stats-row"><div class="card"><small>Profit</small><b class="${acct.profit >= 0 ? 'up' : 'down'}">${acct.profit >= 0 ? '+' : ''}${acct.profit.toLocaleString('en-US')}</b></div><div class="card"><small>Won</small><b>${acct.won}</b></div><div class="card"><small>Lost</small><b>${acct.lost}</b></div><div class="card"><small>Open</small><b>${acct.pending}</b></div></div>
      <div class="bets">${bets.map((b) => betCard(db, b)).join('') || '<div class="card"><p class="muted">No bets yet. <a href="/pickem">Make your first pick →</a></p></div>'}</div>
    </div>`));
  } catch (e) { next(e); }
});

app.get('/pickem/me.json', async (req, res) => {
  const name = currentUser(req);
  const user = name ? await getDoc(userKey(name)) : null;
  res.set('Cache-Control', 'no-store').json(user ? { name, balance: pk.account(load(), user).balance } : {});
});

app.post('/pickem/bailout', async (req, res) => {
  const db = load();
  const name = currentUser(req);
  if (!name) return res.redirect('/pickem/login');
  const user = await getDoc(userKey(name));
  const acct = user && pk.account(db, user);
  if (acct && acct.balance < pk.BAILOUT_BELOW && !acct.pending) {
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
    const recent = board.flatMap((u) => u.bets.filter((b) => b.status === 'won').map((b) => ({ ...b, who: u.name }))).sort((x, y) => y.payout - x.payout).slice(0, 5);
    res.send(layout(req, "Pick'em Leaderboard", pickHead(user, acct) + `<div class="wrap">${pickNav('/pickem/leaderboard', name)}
      <div class="home-grid"><div class="col"><div class="card"><div class="card-h"><h2>Standings</h2><span class="muted sm">${board.length} players</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>#</th><th class="l">Player</th><th>Coins</th><th>Profit</th><th>W</th><th>L</th><th>Open</th></tr></thead><tbody>
        ${board.map((u, i) => `<tr class="${u.name === name ? 'today' : ''}"><td>${i + 1}</td><td class="l"><b>@${esc(u.name)}</b></td><td>${coins(u.balance)}</td><td class="${u.profit >= 0 ? 'up' : 'down'}">${u.profit >= 0 ? '+' : ''}${u.profit.toLocaleString('en-US')}</td><td>${u.won}</td><td>${u.lost}</td><td>${u.pending}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nobody yet.</td></tr>'}
        </tbody></table></div></div></div>
        <div class="col"><div class="card"><div class="card-h"><h2>${icon('fire')} Biggest wins</h2></div>${recent.map((b) => betCard(db, b, { who: b.who })).join('') || '<p class="muted">No winning bets yet.</p>'}</div></div>
      </div></div>`));
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
      <h3>Coins</h3><p>Everyone starts with ${pk.START_COINS.toLocaleString()} coins. If you drop under ${pk.BAILOUT_BELOW} with no open bets, you can claim a ${pk.BAILOUT_COINS} coin bailout from <a href="/pickem/me">My bets</a>.</p>
      <h3>Placing bets</h3><p>Tap any odds button to add it to your bet slip, choose how much to bet and hit <b>Place bet</b>. One pick is a single. Two or more picks become a <b>parlay</b>: every pick has to hit, but the odds multiply. Parlays can have up to ${pk.MAX_LEGS} picks and can mix games. Within one game you can only take one "who wins" style pick (winner, margin or shutout).</p>
      <h3>Reading odds</h3><p><b>+150</b> means a 100 coin bet wins 150 more. <b>−200</b> means you bet 200 to win 100. Odds come from each team's and player's real stats and update as the season goes.</p>
      <h3>When bets close and pay</h3><p>Only the next game is open for picks. Picks lock at ${time12('12:31')}, ${pk.LOCK_MINUTES} minutes before kickoff, and the following game opens right away. Bets pay out as soon as the final score is posted. If a score gets corrected, bets re-settle automatically. Postponed games are refunded (a parlay just drops that pick). A tie counts as a loss for "win" bets.</p>
      <h3>Why there are no unders</h3><p>Every bet is on something <i>happening</i>: a team winning, scoring a lot, a player scoring or getting a pick. There are no bets on a team scoring less or a player not scoring, so nobody can cash in by playing badly on purpose.</p>
      <h3>The spread</h3><p>The favorite has to win by more than the line (like <b>-5.5</b>). The underdog <b>+5.5</b> wins the bet if they win or lose by 5 or less. The line is built from every past game, exhibitions included, so it moves after every game. Lines always end in .5, so there are no ties.</p>
      <h3>Player props</h3><p>Player bets count what's in the box score. If a play isn't recorded, it doesn't count.</p>
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
    <label>4-digit PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
    <button class="btn">${signup ? 'Create account' : 'Log in'}</button>
    <p class="muted sm">${signup ? 'Already have an account? <a href="/pickem/login">Log in</a>' : 'New here? <a href="/pickem/signup">Sign up</a>'}</p>
  </form></div>`, { ticker: false });
}
app.get('/pickem/login', (req, res) => res.send(authPage(req, 'login')));
app.get('/pickem/signup', (req, res) => res.send(authPage(req, 'signup')));
app.post('/pickem/signup', async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase(), pin = String(req.body.pin || '');
  if (!pk.validName(name)) return res.send(authPage(req, 'signup', 'Usernames are 3-16 letters, numbers or _.'));
  if (!/^\d{4}$/.test(pin)) return res.send(authPage(req, 'signup', 'Your PIN has to be exactly 4 digits.'));
  if (await getDoc(userKey(name))) return res.send(authPage(req, 'signup', 'That username is taken.'));
  await putDoc(userKey(name), { name, ...pk.hashPin(pin), created: new Date().toISOString(), bonuses: [], bets: [] });
  setUserCookie(req, res, name);
  res.redirect(req.body.next && /^\/[a-z0-9/_-]*$/i.test(req.body.next) ? req.body.next : '/pickem');
});
// Slow down PIN guessing: a few tries per name, then a cooldown.
const tries = new Map();
app.post('/pickem/login', async (req, res) => {
  const name = String(req.body.name || '').trim().toLowerCase(), pin = String(req.body.pin || '');
  const t = tries.get(name) || { n: 0, until: 0 };
  if (t.until > Date.now()) return res.send(authPage(req, 'login', 'Too many tries. Wait a minute and try again.'));
  const user = pk.validName(name) ? await getDoc(userKey(name)) : null;
  if (!user || !/^\d{4}$/.test(pin) || !pk.checkPin(user, pin)) {
    t.n++; if (t.n >= 5) { t.n = 0; t.until = Date.now() + 60000; } tries.set(name, t);
    return res.send(authPage(req, 'login', 'Wrong username or PIN.'));
  }
  tries.delete(name);
  setUserCookie(req, res, name);
  res.redirect(req.body.next && /^\/[a-z0-9/_-]*$/i.test(req.body.next) ? req.body.next : '/pickem');
});
app.get('/pickem/logout', (req, res) => { res.setHeader('Set-Cookie', `${USER_COOKIE}=; Path=/; Max-Age=0`); res.redirect('/pickem'); });

// ---------- player leaders ----------
app.get('/stats/players', (req, res) => {
  const db = load();
  const rows = [];
  for (const tm of Object.values(db.teams)) for (const p of tm.roster) {
    const s = playerStats(db, tm, p);
    rows.push({ tm, p, ...s, total: s.td + s.ptd + s.int, gp: s.log.filter((r) => r.g.type !== 'exhibition').length });
  }
  const board = (k, title) => {
    const xs = rows.filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k] || a.p.name.localeCompare(b.p.name)).slice(0, 10);
    const top = xs[0];
    return `<div class="card lead-card"><div class="card-h"><h2>${title}</h2></div>
      ${top ? `<a class="lead-top" href="${playerUrl(top.tm, top.p)}" style="--a:${esc(top.tm.color)}">${avatar(top.tm, top.p, 72)}<div><small>${logo(top.tm, 16)} ${esc(top.tm.name)}</small><b>${esc(top.p.name)}</b></div><span>${top[k]}</span></a>` : '<p class="muted">No stats yet.</p>'}
      ${xs.slice(1).map((r, i) => `<a class="lead-row" href="${playerUrl(r.tm, r.p)}"><span class="rank">${i + 2}</span>${avatar(r.tm, r.p, 30)}<b>${esc(r.p.name)}</b>${logo(r.tm, 18)}<span class="n">${r[k]}</span></a>`).join('')}</div>`;
  };
  const all = rows.sort((a, b) => b.total - a.total || a.p.name.localeCompare(b.p.name));
  res.send(layout(req, 'Player Leaders', pageHead('2026–27 Season', 'Player Leaders', 'Regular season + bowls. Exhibitions not counted.') + `<div class="wrap">
    <div class="lead-grid">${board('td', 'Touchdowns')}${board('ptd', 'Passing TDs')}${board('int', 'Interceptions')}</div>
    <div class="card"><div class="card-h"><h2>All Players</h2></div><div class="scroll"><table class="tbl"><thead><tr><th class="l">Player</th><th class="l">Team</th><th>GP*</th><th>TD</th><th>Pass TD</th><th>INT</th><th>Total</th></tr></thead><tbody>
    ${all.map((r) => `<tr><td class="l"><a class="plink" href="${playerUrl(r.tm, r.p)}">${avatar(r.tm, r.p, 28)}${esc(r.p.name)}</a></td><td class="l"><span class="th">${logo(r.tm, 20)} ${esc(r.tm.abbr)}</span></td><td>${r.gp}</td><td>${r.td || '–'}</td><td>${r.ptd || '–'}</td><td>${r.int || '–'}</td><td><b>${r.total || '–'}</b></td></tr>`).join('')}
    </tbody></table></div><p class="muted sm">*Games with a recorded stat.</p></div>
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

// ---------- admin ----------
const adminNav = (cur) => `<div class="seg admin-seg">${[['/admin', 'Games'], ['/admin/game/new', '+ New game'], ['/admin/players', 'Players'], ['/admin/teams', 'Teams'], ['/admin/transactions', 'Transactions'], ['/admin/pickem', "Pick'em"], ['/admin/tendencies', 'Tendencies'], ['/admin/bowls', 'Bowls'], ['/admin/logout', 'Log out']].map(([h, n]) => `<a class="${cur === h ? 'on' : ''}" href="${h}">${n}</a>`).join('')}</div>`;
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
    res.send(layout(req, "Pick'em Admin", pageHead('Admin', "Pick'em Accounts", 'Reset a forgotten PIN, give coins, or remove an account.') + `<div class="wrap">${adminNav('/admin/pickem')}${savedMsg(req)}
      <div class="card"><div class="scroll"><table class="tbl admin"><thead><tr><th class="l">User</th><th>Coins</th><th>W-L</th><th>Open</th><th class="l">Reset PIN</th><th class="l">Give coins</th><th></th></tr></thead><tbody>
      ${board.map((u) => `<tr><td class="l"><b>@${esc(u.name)}</b></td><td>${coins(u.balance)}</td><td>${u.won}-${u.lost}</td><td>${u.pending}</td>
        <td class="l"><form method="post" action="/admin/pickem/${esc(u.name)}/pin" class="inline"><input name="pin" pattern="[0-9]{4}" maxlength="4" placeholder="New PIN" required><button class="btn sm ghost">Set</button></form></td>
        <td class="l"><form method="post" action="/admin/pickem/${esc(u.name)}/coins" class="inline"><input name="amount" type="number" placeholder="+500" required><button class="btn sm ghost">Give</button></form></td>
        <td><form method="post" action="/admin/pickem/${esc(u.name)}/delete"><button class="btn sm ghost danger" onclick="return confirm('Delete @${esc(u.name)} and all their bets?')">Delete</button></form></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No accounts yet.</td></tr>'}
      </tbody></table></div></div></div>`, { ticker: false }));
  } catch (e) { next(e); }
});
app.post('/admin/pickem/:name/:action', requireAdmin, async (req, res) => {
  const name = String(req.params.name).toLowerCase();
  const user = pk.validName(name) ? await getDoc(userKey(name)) : null;
  if (!user) return res.redirect('/admin/pickem');
  if (req.params.action === 'pin' && /^\d{4}$/.test(req.body.pin || '')) Object.assign(user, pk.hashPin(req.body.pin));
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
function slider(name, v, label, drift = 0) {
  const eff = Math.max(0, Math.min(100, v + drift));
  const autoTxt = (d) => (d ? `auto ${d > 0 ? '+' : ''}${d}` : 'auto 0');
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
        <div class="tgrid"><span></span>${TEND_PLAYER.map(([, n]) => `<span class="th-l"><b>${n}</b></span>`).join('')}
        ${t.roster.map((p) => `<span class="plink">${avatar(t, p, 30)}${esc(p.name)}</span>${TEND_PLAYER.map(([k, n]) => slider(`player.${t.id}.${p.id}.${k}`, tval(p.tend, k), n, dP(t, p, k))).join('')}`).join('')}</div>
      </div>`).join('')}
      <div class="savebar"><button type="button" class="btn ghost" onclick="this.form.querySelectorAll('input[type=range]').forEach(r=>{r.value=50;r.oninput()})">Reset all to 50</button><button class="btn">Save tendencies</button></div>
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
      if (p && TEND_PLAYER.some(([k]) => k === parts[3])) (p.tend = p.tend || {})[parts[3]] = num(v);
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

app.use((req, res) => res.status(404).send(layout(req, 'Not Found', pageHead('404', 'Page not found', '<a href="/">Back home →</a>'))));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Something went wrong. Try again in a moment.'); });

if (require.main === module) app.listen(PORT, () => console.log(`MFL running on :${PORT}`));
module.exports = app;
