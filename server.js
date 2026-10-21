const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { load, save } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('mfl:' + ADMIN_PASSWORD).digest('hex');
const TZ = process.env.TZ_LEAGUE || 'America/Chicago';

app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dparts(ds) {
  if (!ds) return null;
  const d = new Date(ds + 'T12:00:00Z');
  return { dow: DOW[d.getUTCDay()], mon: MON[d.getUTCMonth()], month: MONTHS[d.getUTCMonth()], day: d.getUTCDate(), year: d.getUTCFullYear() };
}
const shortDate = (ds) => { const p = dparts(ds); return p ? `${p.dow} ${p.mon.charAt(0)}${p.mon.slice(1).toLowerCase()} ${p.day}` : 'TBD'; };
const longDate = (ds) => { const p = dparts(ds); return p ? `${p.dow.charAt(0)}${p.dow.slice(1).toLowerCase()}, ${p.month} ${p.day}, ${p.year}` : 'Date TBD'; };
const time12 = (t) => { if (!t) return 'TBD'; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

const bowlName = (db, slug) => db.bowls.find((b) => b.slug === slug)?.name || '';
const teamFull = (t) => `${t.city} ${t.name}`;
function logo(t, size = 40) {
  if (t.logo) return `<img class="tlogo" src="${esc(t.logo)}" alt="${esc(t.name)}" width="${size}" height="${size}">`;
  return `<span class="tlogo tmono" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px;background:${esc(t.color)};color:${esc(t.color2 === '#111111' ? '#fff' : t.color2)}">${esc(t.abbr)}</span>`;
}
function gameLabel(db, g) {
  if (g.type === 'playoff') return bowlName(db, g.bowl);
  if (g.type === 'exhibition') return 'Exhibition';
  return '';
}
function statusText(g) {
  if (g.status === 'final') return 'FINAL';
  if (g.status === 'postponed') return 'POSTPONED';
  if (g.status === 'live') return 'LIVE';
  return g.date ? time12(g.time) : 'TBD';
}
const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;
function winner(g) {
  if (!isFinal(g) || g.homeScore === g.awayScore) return null;
  return g.homeScore > g.awayScore ? g.home : g.away;
}

function teamStats(db, id) {
  const s = { w: 0, l: 0, t: 0, pf: 0, pa: 0, td: 0, int: 0, tdAllowed: 0, intThrown: 0, gp: 0, pw: 0, pl: 0, exW: 0, exL: 0, streak: '' };
  const counted = db.games.filter((g) => isFinal(g) && (g.home === id || g.away === id)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const results = [];
  for (const g of counted) {
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
    results.push(r);
  }
  if (results.length) {
    const last = results[results.length - 1];
    let n = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
    s.streak = last + n;
  }
  s.pct = s.gp ? ((s.w + s.t / 2) / s.gp).toFixed(3).replace(/^0/, '') : '.000';
  s.diff = s.pf - s.pa;
  return s;
}
const record = (s) => `${s.w}-${s.l}${s.t ? '-' + s.t : ''}`;

function playerLeaders(db) {
  const map = {};
  for (const g of db.games) {
    if (g.status !== 'final' || g.type === 'exhibition') continue;
    for (const e of g.events || []) {
      for (const [role, who] of [[e.type === 'TD' ? 'td' : 'int', e.player], ['ptd', e.type === 'TD' ? e.passer : null]]) {
        if (!who) continue;
        const k = e.team + '|' + who;
        map[k] = map[k] || { team: e.team, name: who, td: 0, ptd: 0, int: 0 };
        map[k][role]++;
      }
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

// ---------- layout ----------
function scoreStrip(db) {
  const t = today();
  const sorted = db.games.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  let idx = sorted.findIndex((g) => g.date >= t);
  if (idx === -1) idx = sorted.length;
  const slice = sorted.slice(Math.max(0, idx - 3), idx + 7);
  return `<div class="strip"><div class="strip-inner">${slice.map((g) => {
    const h = db.teams[g.home], a = db.teams[g.away], w = winner(g);
    const row = (tm, sc) => `<div class="srow ${w && w !== tm.id ? 'lose' : ''}">${logo(tm, 18)}<span class="sabbr">${esc(tm.abbr)}</span><span class="ssc">${isFinal(g) ? sc : ''}</span></div>`;
    return `<a class="scard" href="/games/${g.id}"><div class="shead"><span>${esc(shortDate(g.date))}</span><span class="${g.status === 'postponed' ? 'red' : ''}">${statusText(g)}</span></div>${row(a, g.awayScore)}${row(h, g.homeScore)}${gameLabel(db, g) ? `<div class="stag">${esc(gameLabel(db, g))}</div>` : ''}</a>`;
  }).join('')}</div></div>`;
}

function layout(req, title, body, opts = {}) {
  const db = load();
  const teams = Object.values(db.teams);
  const admin = isAdmin(req);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | MFL.com</title>
<link rel="icon" href="/static/mfl-logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700;800;900&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css">
</head><body>
<header class="nav">
  <div class="nav-inner">
    <button class="burger" aria-label="Menu" onclick="document.body.classList.toggle('menu-open')"><span></span><span></span><span></span></button>
    <a class="brand" href="/"><img src="/static/mfl-logo.webp" alt="MFL"></a>
    <nav class="menu">
      <div class="dd"><button class="ddbtn">Games <i class="caret"></i></button><div class="ddmenu">
        <a href="/schedule">Schedule</a><a href="/scores">Scores</a></div></div>
      <div class="dd"><button class="ddbtn">Playoffs <i class="caret"></i></button><div class="ddmenu">
        ${db.bowls.map((b) => `<a href="/playoffs/${b.slug}">${esc(b.name)}</a>`).join('')}</div></div>
      <div class="dd"><button class="ddbtn">Teams <i class="caret"></i></button><div class="ddmenu">
        ${teams.map((t) => `<a href="/teams/${t.id}" class="ddteam">${logo(t, 22)} ${esc(teamFull(t))}</a>`).join('')}</div></div>
      <div class="dd"><button class="ddbtn">Stats <i class="caret"></i></button><div class="ddmenu">
        <a href="/stats/team">Team Stats</a></div></div>
    </nav>
    <div class="nav-right">${admin ? '<a class="navadmin" href="/admin">Admin</a>' : ''}</div>
  </div>
</header>
${opts.strip === false ? '' : scoreStrip(db)}
<main>${body}</main>
<footer class="foot"><div class="foot-inner">
  <img src="/static/mfl-logo.webp" alt="MFL" class="foot-logo">
  <div><div class="foot-links"><a href="/schedule">Schedule</a><a href="/scores">Scores</a><a href="/stats/team">Team Stats</a>${teams.map((t) => `<a href="/teams/${t.id}">${esc(t.name)}</a>`).join('')}<a href="/admin">Admin</a></div>
  <p class="fine">© ${new Date().getFullYear()} Metcalf Football League. Not affiliated with the National Football League.</p></div>
</div></footer>
<script>
document.querySelectorAll('.ddbtn').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const p=b.parentElement;const o=p.classList.contains('open');document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open'));if(!o)p.classList.add('open');}));
document.addEventListener('click',()=>document.querySelectorAll('.dd.open').forEach(d=>d.classList.remove('open')));
</script>
</body></html>`;
}

function pageHead(title, sub = '') {
  return `<section class="phead"><div class="wrap"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div></section>`;
}

function gameRow(db, g, opts = {}) {
  const h = db.teams[g.home], a = db.teams[g.away], w = winner(g);
  const side = (tm, sc) => `<div class="gr-team ${w && w !== tm.id ? 'lose' : ''}">${logo(tm, 36)}<span class="gr-name"><b>${esc(tm.name)}</b><small>${esc(tm.city)}</small></span>${isFinal(g) ? `<span class="gr-score">${sc}</span>` : ''}</div>`;
  const label = gameLabel(db, g);
  return `<a class="grow ${g.status}" href="/games/${g.id}">
    <div class="gr-teams">${side(a, g.awayScore)}<span class="gr-at">${isFinal(g) ? '' : '@'}</span>${side(h, g.homeScore)}</div>
    <div class="gr-meta">
      ${opts.showDate ? `<span class="gr-date">${esc(longDate(g.date))}</span>` : ''}
      <span class="gr-status ${g.status}">${statusText(g)}</span>
      ${label ? `<span class="pill ${g.type}">${esc(label)}</span>` : ''}
      ${g.reason && (g.status === 'postponed' || g.type === 'exhibition') ? `<span class="gr-reason">${esc(g.reason)}</span>` : ''}
    </div></a>`;
}

function groupByDate(db, games) {
  const groups = {};
  for (const g of games) (groups[g.date || 'TBD'] = groups[g.date || 'TBD'] || []).push(g);
  return Object.entries(groups).map(([d, gs]) => `<div class="day"><h3 class="dayh">${esc(d === 'TBD' ? 'Date TBD' : longDate(d))}</h3>${gs.map((g) => gameRow(db, g)).join('')}</div>`).join('');
}

function monthTabs(base, months, cur) {
  return `<div class="tabs">${months.map((m) => `<a class="${m === cur ? 'on' : ''}" href="${base}?month=${m}">${MONTHS[Number(m.slice(5)) - 1].slice(0, 3)} ${m.slice(2, 4)}</a>`).join('')}</div>`;
}

// ---------- public routes ----------
app.get('/', (req, res) => {
  const db = load();
  const t = today();
  const dated = db.games.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date));
  const lastFinal = [...dated].reverse().find(isFinal);
  const next = dated.find((g) => g.date >= t && g.status === 'scheduled');
  const teams = Object.values(db.teams);
  const nextBowl = db.bowls.map((b) => ({ b, g: db.games.find((g) => g.bowl === b.slug) })).find(({ g }) => g && g.status !== 'final');

  const hero = lastFinal ? (() => {
    const h = db.teams[lastFinal.home], a = db.teams[lastFinal.away], w = winner(lastFinal);
    const wt = w ? db.teams[w] : null;
    const tds = (lastFinal.events || []).filter((e) => e.type === 'TD').length;
    return `<a class="hero" href="/games/${lastFinal.id}" style="--c1:${esc((wt || h).color)}">
      <div class="hero-kicker">${esc(gameLabel(db, lastFinal) || 'Game Recap')} · ${esc(longDate(lastFinal.date))}</div>
      <h2>${wt ? `${esc(wt.name)} take down ${esc(db.teams[w === h.id ? a.id : h.id].name)}, ${Math.max(lastFinal.homeScore, lastFinal.awayScore)}-${Math.min(lastFinal.homeScore, lastFinal.awayScore)}` : `${esc(a.name)} and ${esc(h.name)} tie ${lastFinal.homeScore}-${lastFinal.awayScore}`}</h2>
      <div class="hero-score">${logo(a, 64)}<span>${lastFinal.awayScore}</span><em>FINAL</em><span>${lastFinal.homeScore}</span>${logo(h, 64)}</div>
      <p>${tds ? `${tds} touchdown${tds > 1 ? 's' : ''} on the board.` : ''} View the full box score →</p></a>`;
  })() : `<div class="hero"><h2>Welcome to the MFL</h2></div>`;

  const nextCard = next ? `<div class="card"><h3 class="ch">Next Game</h3>${gameRow(db, next, { showDate: true })}</div>` : '';
  const bowlCard = nextBowl ? `<div class="card"><h3 class="ch">Road to the ${esc(nextBowl.b.name)}</h3><p class="big">${esc(longDate(nextBowl.b.date || nextBowl.g.date))}</p><a class="btn" href="/playoffs/${nextBowl.b.slug}">Bowl Info</a></div>` : '';

  const stand = teams.map((tm) => ({ tm, s: teamStats(db, tm.id) })).sort((x, y) => y.s.w - x.s.w || x.s.l - y.s.l);
  const standings = `<div class="card"><h3 class="ch">Standings</h3><table class="tbl"><thead><tr><th class="l">Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>PF</th><th>PA</th><th>STRK</th></tr></thead><tbody>
    ${stand.map(({ tm, s }) => `<tr><td class="l"><a href="/teams/${tm.id}" class="tcell">${logo(tm, 24)} ${esc(teamFull(tm))}</a></td><td>${s.w}</td><td>${s.l}</td><td>${s.t}</td><td>${s.pct}</td><td>${s.pf}</td><td>${s.pa}</td><td>${s.streak || '-'}</td></tr>`).join('')}
  </tbody></table></div>`;

  const recent = [...dated].reverse().filter(isFinal).slice(0, 5);
  const rules = `<div class="card"><h3 class="ch">League Rules</h3><ul class="rules">
    <li><b>7 Banana Blitz</b></li><li><b>No</b> first downs</li><li><b>Throw-offs</b> instead of kickoffs</li><li><b>No</b> punting</li>
    <li><b>TR</b> = Team Representatives. They can trade non team representatives.</li></ul></div>`;

  res.send(layout(req, 'Official Site of the Metcalf Football League', `
    <div class="wrap home">
      <div class="home-main">${hero}
        <div class="card"><h3 class="ch">Latest Scores <a href="/scores" class="more">All Scores</a></h3>${recent.map((g) => gameRow(db, g, { showDate: true })).join('') || '<p class="muted">No games played yet.</p>'}</div>
      </div>
      <aside class="home-side">${nextCard}${bowlCard}${standings}${rules}</aside>
    </div>`));
});

app.get('/schedule', (req, res) => {
  const db = load();
  const months = [...new Set(db.games.filter((g) => g.date).map((g) => g.date.slice(0, 7)))].sort();
  const t = today().slice(0, 7);
  const cur = months.includes(req.query.month) ? req.query.month : months.includes(t) ? t : months[0];
  const games = db.games.filter((g) => g.date?.startsWith(cur)).sort((a, b) => a.date.localeCompare(b.date));
  const tbd = db.games.filter((g) => !g.date);
  res.send(layout(req, 'Schedule', pageHead('MFL Schedule', '2026-27 Season · Games every Mon, Tue, Thu &amp; Fri at 12:35 PM') +
    `<div class="wrap">${monthTabs('/schedule', months, cur)}${groupByDate(db, games)}${tbd.length ? `<div class="day"><h3 class="dayh">Date TBD</h3>${tbd.map((g) => gameRow(db, g)).join('')}</div>` : ''}</div>`));
});

app.get('/scores', (req, res) => {
  const db = load();
  const t = today();
  const played = db.games.filter((g) => g.date && (g.date <= t || g.status !== 'scheduled'));
  const months = [...new Set(played.map((g) => g.date.slice(0, 7)))].sort();
  const cur = months.includes(req.query.month) ? req.query.month : months[months.length - 1];
  const games = played.filter((g) => g.date.startsWith(cur || '')).sort((a, b) => b.date.localeCompare(a.date));
  res.send(layout(req, 'Scores', pageHead('MFL Scores') +
    `<div class="wrap">${months.length ? monthTabs('/scores', months, cur) : ''}${groupByDate(db, games) || '<p class="muted">No scores yet.</p>'}</div>`));
});

app.get('/games/:id', (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.status(404).send(layout(req, 'Not Found', pageHead('Game not found')));
  const h = db.teams[g.home], a = db.teams[g.away], w = winner(g);
  const qs = g.quarters && (g.quarters.home?.some((x) => x !== '' && x != null) || g.quarters.away?.some((x) => x !== '' && x != null));
  const line = qs ? `<div class="card"><h3 class="ch">Scoring Summary</h3><table class="tbl"><thead><tr><th class="l">Team</th>${g.quarters.home.map((_, i) => `<th>${i < 4 ? 'Q' + (i + 1) : 'OT'}</th>`).join('')}<th>T</th></tr></thead><tbody>
    ${[[a, g.quarters.away, g.awayScore], [h, g.quarters.home, g.homeScore]].map(([tm, q, tot]) => `<tr><td class="l tcell">${logo(tm, 22)} ${esc(tm.abbr)}</td>${q.map((x) => `<td>${x === '' || x == null ? '-' : esc(x)}</td>`).join('')}<td><b>${tot ?? '-'}</b></td></tr>`).join('')}</tbody></table></div>` : '';
  const evs = g.events || [];
  const plays = evs.length ? `<div class="card"><h3 class="ch">Scoring &amp; Turnovers</h3>${evs.map((e) => {
    const tm = db.teams[e.team];
    return `<div class="play">${logo(tm, 28)}<div><span class="pill ${e.type === 'TD' ? 'td' : 'int'}">${e.type === 'TD' ? 'TOUCHDOWN' : 'INTERCEPTION'}</span>${e.quarter ? `<span class="muted"> ${esc(e.quarter)}</span>` : ''}
      <div class="play-txt"><b>${esc(e.player || 'Unknown')}</b>${e.type === 'TD' && e.passer ? ` ${'catches TD from'} <b>${esc(e.passer)}</b>` : e.type === 'TD' ? ' touchdown' : ' intercepts the pass'}${e.note ? ` · ${esc(e.note)}` : ''}</div></div></div>`;
  }).join('')}</div>` : '';
  const boxTeam = (tm) => {
    const rows = {};
    for (const e of evs) {
      if (e.team !== tm.id) continue;
      if (e.player) { rows[e.player] = rows[e.player] || { td: 0, ptd: 0, int: 0 }; rows[e.player][e.type === 'TD' ? 'td' : 'int']++; }
      if (e.type === 'TD' && e.passer) { rows[e.passer] = rows[e.passer] || { td: 0, ptd: 0, int: 0 }; rows[e.passer].ptd++; }
    }
    const r = Object.entries(rows);
    return `<div class="card"><h3 class="ch tcell">${logo(tm, 24)} ${esc(teamFull(tm))}</h3>${r.length ? `<table class="tbl"><thead><tr><th class="l">Player</th><th>TD</th><th>PASS TD</th><th>INT</th></tr></thead><tbody>${r.map(([n, s]) => `<tr><td class="l">${esc(n)}</td><td>${s.td}</td><td>${s.ptd}</td><td>${s.int}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No player stats recorded.</p>'}</div>`;
  };
  const label = gameLabel(db, g);
  res.send(layout(req, `${a.name} vs ${h.name}`, `
    <section class="gamehead" style="--c1:${esc(a.color)};--c2:${esc(h.color)}"><div class="wrap">
      <div class="gh-meta">${label ? `<span class="pill ${g.type}">${esc(label)}</span>` : ''} ${esc(longDate(g.date))}${g.date ? ' · ' + time12(g.time) : ''}</div>
      <div class="gh-row">
        <a href="/teams/${a.id}" class="gh-team ${w && w !== a.id ? 'lose' : ''}">${logo(a, 80)}<div><small>${esc(a.city)}</small><b>${esc(a.name)}</b><small>${record(teamStats(db, a.id))}</small></div></a>
        <div class="gh-score">${isFinal(g) ? `<span class="${w && w !== a.id ? 'lose' : ''}">${g.awayScore}</span><em>FINAL</em><span class="${w && w !== h.id ? 'lose' : ''}">${g.homeScore}</span>` : `<em class="${g.status}">${statusText(g)}</em>`}</div>
        <a href="/teams/${h.id}" class="gh-team home ${w && w !== h.id ? 'lose' : ''}"><div><small>${esc(h.city)}</small><b>${esc(h.name)}</b><small>${record(teamStats(db, h.id))}</small></div>${logo(h, 80)}</a>
      </div>
      ${g.reason ? `<div class="gh-reason">${g.status === 'postponed' ? 'Postponed: ' : ''}${esc(g.reason)}</div>` : ''}
    </div></section>
    <div class="wrap two">${line}${plays}${boxTeam(a)}${boxTeam(h)}
    ${!line && !plays && !isFinal(g) ? '<div class="card"><p class="muted">Box score will be available after the game.</p></div>' : ''}
    ${!line && !plays && isFinal(g) ? '<div class="card"><p class="muted">Box score details were not recorded for this game.</p></div>' : ''}</div>`));
});

app.get('/playoffs/:slug', (req, res) => {
  const db = load();
  const b = db.bowls.find((x) => x.slug === req.params.slug);
  if (!b) return res.status(404).send(layout(req, 'Not Found', pageHead('Bowl not found')));
  const g = db.games.find((x) => x.bowl === b.slug);
  const champ = g && winner(g) ? db.teams[winner(g)] : null;
  res.send(layout(req, b.name, pageHead(b.name, `${esc(longDate(g?.date || b.date))} · ${g?.date ? time12(g.time) : 'Time TBD'}`) + `
    <div class="wrap">
      ${champ ? `<div class="champ" style="--c1:${esc(champ.color)}">${logo(champ, 96)}<div><small>${esc(b.name)} Champions</small><h2>${esc(teamFull(champ))}</h2></div></div>` : ''}
      <div class="card"><h3 class="ch">Matchup</h3>${g ? gameRow(db, g, { showDate: true }) : ''}</div>
      <div class="card"><h3 class="ch">MFL Postseason</h3><table class="tbl"><thead><tr><th class="l">Bowl</th><th class="l">Date</th><th class="l">Result</th></tr></thead><tbody>
      ${db.bowls.map((x) => { const gg = db.games.find((y) => y.bowl === x.slug); const wn = gg && winner(gg) ? db.teams[winner(gg)] : null;
        return `<tr><td class="l"><a href="/playoffs/${x.slug}"><b>${esc(x.name)}</b></a></td><td class="l">${esc(longDate(gg?.date || x.date))}</td><td class="l">${gg && isFinal(gg) ? `${wn ? esc(wn.name) + ' win ' : 'Tie '}${Math.max(gg.homeScore, gg.awayScore)}-${Math.min(gg.homeScore, gg.awayScore)}` : gg?.status === 'postponed' ? 'Postponed' : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>
    </div>`));
});

app.get('/teams/:id', (req, res) => {
  const db = load();
  const tm = db.teams[req.params.id];
  if (!tm) return res.status(404).send(layout(req, 'Not Found', pageHead('Team not found')));
  const s = teamStats(db, tm.id);
  const games = db.games.filter((g) => g.home === tm.id || g.away === tm.id);
  const done = games.filter(isFinal).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const upcoming = games.filter((g) => g.date && g.date >= today() && g.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const leaders = playerLeaders(db).filter((p) => p.team === tm.id);
  const lead = (k) => [...leaders].sort((x, y) => y[k] - x[k])[0];
  res.send(layout(req, teamFull(tm), `
    <section class="teamhead" style="--c1:${esc(tm.color)};--c2:${esc(tm.color2)}"><div class="wrap">${logo(tm, 120)}
      <div><small>${esc(tm.city)}</small><h1>${esc(tm.name)}</h1><p>${record(s)} · Captain: ${esc(tm.captain)}</p></div></div></section>
    <div class="wrap home">
      <div class="home-main">
        <div class="card"><h3 class="ch">Recent Games</h3>${done.map((g) => gameRow(db, g, { showDate: true })).join('') || '<p class="muted">No games yet.</p>'}</div>
        <div class="card"><h3 class="ch">Upcoming <a class="more" href="/schedule">Full Schedule</a></h3>${upcoming.map((g) => gameRow(db, g, { showDate: true })).join('') || '<p class="muted">Nothing scheduled.</p>'}</div>
      </div>
      <aside class="home-side">
        <div class="card"><h3 class="ch">Roster</h3><table class="tbl"><tbody>${tm.roster.map((p) => `<tr><td class="l"><b>${esc(p.name)}</b></td><td class="r">${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}</td></tr>`).join('')}</tbody></table>
          <p class="muted small">C = Captain · TR = Team Representative · FA = Free Agency</p></div>
        <div class="card"><h3 class="ch">Team Leaders</h3>
          ${[['td', 'Touchdowns'], ['ptd', 'Passing TDs'], ['int', 'Interceptions']].map(([k, n]) => { const p = lead(k); return `<div class="leader"><small>${n}</small><b>${p && p[k] ? esc(p.name) : '—'}</b><span>${p && p[k] ? p[k] : ''}</span></div>`; }).join('')}</div>
      </aside>
    </div>`));
});

app.get('/stats/team', (req, res) => {
  const db = load();
  const rows = Object.values(db.teams).map((tm) => ({ tm, s: teamStats(db, tm.id) }));
  const tbl = (title, cols) => `<div class="card"><h3 class="ch">${title}</h3><div class="scroll"><table class="tbl"><thead><tr><th class="l">Team</th>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(({ tm, s }) => `<tr><td class="l"><a class="tcell" href="/teams/${tm.id}">${logo(tm, 24)} ${esc(teamFull(tm))}</a></td>${cols.map((c) => `<td>${c[1](s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const per = (n, gp) => (gp ? (n / gp).toFixed(1) : '0.0');
  res.send(layout(req, 'Team Stats', pageHead('Team Stats', '2026-27 Regular Season &amp; Playoffs (exhibitions excluded)') + `<div class="wrap">
    ${tbl('Offense', [['GP', (s) => s.gp], ['PTS', (s) => s.pf], ['PTS/G', (s) => per(s.pf, s.gp)], ['TD', (s) => s.td], ['TD/G', (s) => per(s.td, s.gp)], ['INT THROWN', (s) => s.intThrown]])}
    ${tbl('Defense', [['GP', (s) => s.gp], ['PTS ALLOWED', (s) => s.pa], ['PA/G', (s) => per(s.pa, s.gp)], ['TD ALLOWED', (s) => s.tdAllowed], ['INT', (s) => s.int]])}
    ${tbl('Record', [['W', (s) => s.w], ['L', (s) => s.l], ['T', (s) => s.t], ['PCT', (s) => s.pct], ['DIFF', (s) => (s.diff > 0 ? '+' : '') + s.diff], ['BOWL W-L', (s) => `${s.pw}-${s.pl}`], ['EXH W-L', (s) => `${s.exW}-${s.exL}`], ['STRK', (s) => s.streak || '-']])}
  </div>`));
});

// ---------- admin ----------
const adminNav = `<div class="tabs"><a href="/admin">Games</a><a href="/admin/game/new">+ New Game</a><a href="/admin/teams">Teams</a><a href="/admin/bowls">Bowls</a><a href="/admin/logout">Log out</a></div>`;

app.get('/admin/login', (req, res) => {
  res.send(layout(req, 'Admin Login', pageHead('Admin Login') + `<div class="wrap narrow"><form method="post" class="card form">
    ${req.query.bad ? '<p class="red">Wrong password.</p>' : ''}<label>Password<input type="password" name="password" autofocus required></label><button class="btn">Log in</button></form></div>`, { strip: false }));
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
  const show = req.query.show || 'recent';
  let games = [...db.games].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  if (show === 'recent') games = games.filter((g) => !g.date || (g.date >= addDays(t, -14) && g.date <= addDays(t, 14)));
  res.send(layout(req, 'Admin', pageHead('Admin Panel') + `<div class="wrap">${adminNav}
    ${req.query.saved ? '<p class="ok">Saved.</p>' : ''}
    <p>${show === 'recent' ? 'Showing games within 2 weeks of today. <a href="/admin?show=all">Show all</a>' : '<a href="/admin">Show recent only</a>'}</p>
    <div class="card"><table class="tbl admin"><thead><tr><th class="l">Date</th><th class="l">Matchup</th><th>Type</th><th>Status</th><th>Score</th><th></th></tr></thead><tbody>
    ${games.map((g) => `<tr class="${g.date === t ? 'today' : ''}"><td class="l">${esc(shortDate(g.date))}</td><td class="l">${esc(db.teams[g.away].abbr)} @ ${esc(db.teams[g.home].abbr)}</td><td>${esc(gameLabel(db, g) || 'Regular')}</td><td>${esc(g.status)}</td><td>${isFinal(g) ? `${g.awayScore}-${g.homeScore}` : ''}</td><td><a class="btn sm" href="/admin/game/${g.id}">Edit</a></td></tr>`).join('')}
    </tbody></table></div></div>`, { strip: false }));
});

function addDays(ds, n) { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function gameForm(db, g, isNew) {
  const teams = Object.values(db.teams);
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const players = teams.flatMap((t) => t.roster.map((p) => p.name));
  const q = g.quarters || { home: ['', '', '', ''], away: ['', '', '', ''] };
  const evRow = (e = {}) => `<div class="evrow">
    <select name="ev_type">${opt('TD', e.type, 'Touchdown')}${opt('INT', e.type, 'Interception')}</select>
    <select name="ev_team">${teams.map((t) => opt(t.id, e.team, t.name)).join('')}</select>
    <input name="ev_player" list="players" placeholder="Scorer / interceptor" value="${esc(e.player)}">
    <input name="ev_passer" list="players" placeholder="Passer (TD only)" value="${esc(e.passer)}">
    <input name="ev_quarter" placeholder="Qtr" value="${esc(e.quarter)}" class="xs">
    <input name="ev_note" placeholder="Note" value="${esc(e.note)}">
    <button type="button" class="btn sm ghost" onclick="this.parentElement.remove()">✕</button></div>`;
  return `<form method="post" class="card form">
    <datalist id="players">${players.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
    <div class="grid">
      <label>Date<input type="date" name="date" value="${esc(g.date || '')}"></label>
      <label>Time<input type="time" name="time" value="${esc(g.time || '12:35')}"></label>
      <label>Away team<select name="away">${teams.map((t) => opt(t.id, g.away, teamFull(t))).join('')}</select></label>
      <label>Home team<select name="home">${teams.map((t) => opt(t.id, g.home, teamFull(t))).join('')}</select></label>
      <label>Type<select name="type">${opt('regular', g.type, 'Regular season')}${opt('exhibition', g.type, 'Exhibition')}${opt('playoff', g.type, 'Playoff bowl')}</select></label>
      <label>Bowl (if playoff)<select name="bowl"><option value="">—</option>${db.bowls.map((b) => opt(b.slug, g.bowl, b.name)).join('')}</select></label>
      <label>Status<select name="status">${opt('scheduled', g.status, 'Scheduled')}${opt('live', g.status, 'Live')}${opt('final', g.status, 'Final')}${opt('postponed', g.status, 'Postponed')}</select></label>
      <label class="wide">Reason (postponed / exhibition)<input name="reason" value="${esc(g.reason)}" placeholder="e.g. Rain, assembly, scrimmage"></label>
    </div>
    <h3>Score</h3>
    <table class="tbl qtbl"><thead><tr><th class="l">Team</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>OT</th><th>Final</th></tr></thead><tbody>
    ${['away', 'home'].map((side) => `<tr><td class="l">${side === 'away' ? 'Away' : 'Home'}</td>${[0, 1, 2, 3, 4].map((i) => `<td><input class="xs" name="q_${side}_${i}" value="${esc(q[side]?.[i] ?? '')}"></td>`).join('')}<td><input class="xs strong" name="${side}Score" value="${esc(g[side + 'Score'] ?? '')}"></td></tr>`).join('')}
    </tbody></table>
    <p class="muted small">Quarter scores are optional. Final score is what counts.</p>
    <h3>Touchdowns &amp; Interceptions</h3>
    <div id="evs">${(g.events || []).map(evRow).join('')}</div>
    <template id="evtpl">${evRow()}</template>
    <button type="button" class="btn sm ghost" onclick="document.getElementById('evs').insertAdjacentHTML('beforeend',document.getElementById('evtpl').innerHTML)">+ Add play</button>
    <div class="actions"><button class="btn">${isNew ? 'Create game' : 'Save game'}</button>
    ${isNew ? '' : `<button class="btn ghost danger" formaction="/admin/game/${g.id}/delete" onclick="return confirm('Delete this game?')">Delete game</button>`}</div>
  </form>`;
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
  g.quarters = { home: [0, 1, 2, 3, 4].map((i) => body[`q_home_${i}`] || ''), away: [0, 1, 2, 3, 4].map((i) => body[`q_away_${i}`] || '') };
  const types = arr(body.ev_type);
  g.events = types.map((t, i) => ({
    type: t === 'INT' ? 'INT' : 'TD', team: arr(body.ev_team)[i], player: (arr(body.ev_player)[i] || '').trim(),
    passer: t === 'TD' ? (arr(body.ev_passer)[i] || '').trim() : '', quarter: (arr(body.ev_quarter)[i] || '').trim(), note: (arr(body.ev_note)[i] || '').trim(),
  })).filter((e) => e.player || e.passer || e.note);
  return g;
}

app.get('/admin/game/new', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'New Game', pageHead('New Game') + `<div class="wrap">${adminNav}${gameForm(db, { home: 'pedon', away: 'xavier', type: 'regular', status: 'scheduled', time: '12:35', events: [] }, true)}</div>`, { strip: false }));
});
app.post('/admin/game/new', requireAdmin, (req, res) => {
  const db = load();
  const g = readGame(req.body, { id: String(db.nextId++) });
  db.games.push(g); save();
  res.redirect('/admin?saved=1');
});
app.get('/admin/game/:id', requireAdmin, (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.redirect('/admin');
  res.send(layout(req, 'Edit Game', pageHead(`Edit Game · ${shortDate(g.date)}`, `<a href="/games/${g.id}" style="color:#fff">View public page →</a>`) + `<div class="wrap">${adminNav}${req.query.saved ? '<p class="ok">Saved.</p>' : ''}${gameForm(db, g, false)}</div>`, { strip: false }));
});
app.post('/admin/game/:id', requireAdmin, (req, res) => {
  const db = load();
  const g = db.games.find((x) => x.id === req.params.id);
  if (!g) return res.redirect('/admin');
  readGame(req.body, g); save();
  res.redirect(`/admin/game/${g.id}?saved=1`);
});
app.post('/admin/game/:id/delete', requireAdmin, (req, res) => {
  const db = load();
  db.games = db.games.filter((x) => x.id !== req.params.id); save();
  res.redirect('/admin?saved=1');
});

app.get('/admin/teams', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'Teams', pageHead('Edit Teams') + `<div class="wrap">${adminNav}${req.query.saved ? '<p class="ok">Saved.</p>' : ''}
    ${Object.values(db.teams).map((t) => `<form method="post" action="/admin/teams/${t.id}" class="card form">
      <h3 class="tcell">${logo(t, 40)} ${esc(teamFull(t))}</h3>
      <div class="grid">
        <label>City / prefix<input name="city" value="${esc(t.city)}"></label>
        <label>Team name<input name="name" value="${esc(t.name)}" required></label>
        <label>Abbreviation<input name="abbr" value="${esc(t.abbr)}" maxlength="4" required></label>
        <label>Captain<input name="captain" value="${esc(t.captain)}"></label>
        <label>Primary color<input type="color" name="color" value="${esc(t.color)}"></label>
        <label>Secondary color<input type="color" name="color2" value="${esc(t.color2)}"></label>
        <label class="wide">Logo (PNG/JPG/SVG, max ~3MB)<input type="file" accept="image/*" onchange="const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{this.form.logo.value=r.result;};r.readAsDataURL(f)"></label>
        <input type="hidden" name="logo" value="">
        <label class="chk"><input type="checkbox" name="clearLogo"> Remove current logo</label>
        <label class="wide">Roster (one per line, "Name | Tag", e.g. "Liam Bair | Rd 2")<textarea name="roster" rows="10">${esc(t.roster.map((p) => p.tag ? `${p.name} | ${p.tag}` : p.name).join('\n'))}</textarea></label>
      </div><div class="actions"><button class="btn">Save ${esc(t.name)}</button></div></form>`).join('')}</div>`, { strip: false }));
});
app.post('/admin/teams/:id', requireAdmin, (req, res) => {
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
  t.roster = String(b.roster || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [name, tag] = l.split('|').map((x) => x.trim()); return { name, tag: tag || '' }; });
  save();
  res.redirect('/admin/teams?saved=1');
});

app.get('/admin/bowls', requireAdmin, (req, res) => {
  const db = load();
  res.send(layout(req, 'Bowls', pageHead('Edit Bowls') + `<div class="wrap">${adminNav}${req.query.saved ? '<p class="ok">Saved.</p>' : ''}
    <form method="post" class="card form"><p class="muted">Change a bowl's name here. To change its date, edit the bowl's game in the Games list.</p>
    ${db.bowls.map((b, i) => `<label>Bowl ${i + 1}<input name="name_${b.slug}" value="${esc(b.name)}"></label>`).join('')}
    <div class="actions"><button class="btn">Save</button></div></form></div>`, { strip: false }));
});
app.post('/admin/bowls', requireAdmin, (req, res) => {
  const db = load();
  for (const b of db.bowls) if (req.body['name_' + b.slug]) b.name = String(req.body['name_' + b.slug]).slice(0, 60);
  save();
  res.redirect('/admin/bowls?saved=1');
});

app.use((req, res) => res.status(404).send(layout(req, 'Not Found', pageHead('Page not found', '<a href="/" style="color:#fff">Back to MFL.com</a>'))));

app.listen(PORT, () => console.log(`MFL running on :${PORT}`));
