// Voice commentary for 3D Blitz: the lines in commentary-lines.json are spoken by a
// text-to-speech voice (ElevenLabs), generated on the server the first time a line is
// asked for and kept in DATA_DIR/tts/ so each clip is only paid for once.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./db');

const LINES = require('./commentary-lines.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
const PRONOUNCE_FILE = path.join(DATA_DIR, 'pronounce.json');
const CACHE_DIR = path.join(DATA_DIR, 'tts');
const DEFAULT_MODEL = 'eleven_v3';
const DEFAULT_BASE = 'https://api.elevenlabs.io';
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.85, style: 0.5, use_speaker_boost: true };
const OUTPUT_FORMAT = 'mp3_22050_32';
const MAX_UPSTREAM = 2; // generation requests in flight at once
const UPSTREAM_TIMEOUT = 20000;
const BACKOFF_MS = 60000; // after 401/402/429 (bad key, out of credits, rate limited)
const LEVELS = ['Rookie', 'Pro', 'All-Pro', 'Legend'];

// ---------- config ----------
// Environment first, then the key/voice pasted in Admin > AI (kept in DATA_DIR/secrets.json,
// next to the Anthropic key, never in db.json or backups).
let secretsMemo = { at: 0, v: {} };
function readSecrets() {
  if (Date.now() - secretsMemo.at < 5000) return secretsMemo.v;
  let v = {};
  try { v = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); } catch {}
  secretsMemo = { at: Date.now(), v };
  return v;
}
function writeSecrets(patch) {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); } catch {}
  for (const [k, v] of Object.entries(patch)) { if (v) s[k] = v; else delete s[k]; }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(s), { mode: 0o600 });
  secretsMemo = { at: 0, v: {} };
}
function config() {
  const s = readSecrets(), e = process.env;
  return {
    key: e.ELEVENLABS_API_KEY || s.elevenKey || null,
    keySource: e.ELEVENLABS_API_KEY ? 'variable' : s.elevenKey ? 'admin' : null,
    voice: e.ELEVENLABS_VOICE_ID || s.elevenVoice || null,
    voiceSource: e.ELEVENLABS_VOICE_ID ? 'variable' : s.elevenVoice ? 'admin' : null,
    model: e.ELEVENLABS_MODEL || s.elevenModel || DEFAULT_MODEL,
    modelSource: e.ELEVENLABS_MODEL ? 'variable' : s.elevenModel ? 'admin' : null,
    base: (e.ELEVENLABS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, ''),
  };
}
const enabled = (c = config()) => !!(c.key && c.voice);

// ---------- pronunciations ----------
// JSON defaults, with the admin's list (DATA_DIR/pronounce.json) merged over them. An empty
// respelling in the admin list switches a default off.
let pronMemo = null;
function adminPronounce() {
  try { return JSON.parse(fs.readFileSync(PRONOUNCE_FILE, 'utf8')) || {}; } catch { return {}; }
}
function pronounceMap() {
  if (pronMemo) return pronMemo.map;
  const merged = { ...(LINES.pronounce || {}), ...adminPronounce() };
  const map = Object.fromEntries(Object.entries(merged).filter(([k, v]) => k && v));
  const names = Object.keys(map).sort((a, b) => b.length - a.length);
  const re = names.length ? new RegExp(`(?<![A-Za-z0-9])(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9])`, 'gi') : null;
  const lower = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  pronMemo = { map, re, lower };
  return map;
}
function respell(text) {
  pronounceMap();
  return pronMemo.re ? text.replace(pronMemo.re, (m) => pronMemo.lower[m.toLowerCase()] || m) : text;
}
function savePronounce(text) {
  const map = {};
  for (const row of String(text || '').split(/\r?\n/)) {
    const i = row.indexOf('=');
    if (i < 0) continue;
    const name = row.slice(0, i).trim(), say = row.slice(i + 1).trim();
    if (/^[A-Za-z][A-Za-z'’ -]{0,39}$/.test(name) && /^[A-Za-z0-9 .,'’-]{0,60}$/.test(say)) map[name] = say;
  }
  // Defaults the admin deleted are stored as "" so they stay off.
  for (const k of Object.keys(LINES.pronounce || {})) if (!Object.keys(map).some((n) => n.toLowerCase() === k.toLowerCase())) map[k] = '';
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PRONOUNCE_FILE, JSON.stringify(map, null, 1));
  pronMemo = null;
}

// ---------- lines ----------
const NAME_RE = /^[A-Za-z0-9 .,'’-]{1,40}$/;
const NUM_RE = /^\d{1,3}$/;
const SCORE_RE = /^\d{1,3} to \d{1,3}$/;
const VAR_RE = { yards: NUM_RE, dist: NUM_RE, score: SCORE_RE };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Checks a request's query: { e, v, ...vars }. Returns { ev, v, vars } or { error }.
function parse(q) {
  const e = q.e;
  if (typeof e !== 'string' || !has(LINES.events, e)) return { error: 'unknown event' };
  const ev = LINES.events[e];
  if (typeof q.v !== 'string' || !/^\d{1,3}$/.test(q.v) || +q.v >= ev.lines.length) return { error: 'bad variant' };
  const vars = {};
  for (const k of ev.vars) {
    const val = q[k];
    if (val === undefined) return { error: `missing ${k}` };
    if (typeof val !== 'string' || !(VAR_RE[k] || NAME_RE).test(val)) return { error: `bad ${k}` };
    vars[k] = val;
  }
  for (const k of Object.keys(q)) if (k !== 'e' && k !== 'v' && !ev.vars.includes(k)) return { error: `unexpected ${k}` };
  return { e, ev, v: +q.v, vars };
}
const render = (ev, v, vars) => ev.lines[v].replace(/\{([a-z]+)\}/g, (m, k) => (has(vars, k) ? vars[k] : m));
const cacheKey = (c, text) => crypto.createHash('sha1').update(`${c.model}|${c.voice}|${text}`).digest('hex');
const clipPath = (key) => path.join(CACHE_DIR, key + '.mp3');

// ---------- generation ----------
const state = { calls: 0, ok: 0, fail: 0, backoffUntil: 0, lastError: null, lastErrorAt: 0 };
const inflight = new Map();
let active = 0;
const waiting = [];
function acquire() {
  if (active < MAX_UPSTREAM) { active++; return Promise.resolve(); }
  return new Promise((r) => waiting.push(r));
}
function release() {
  const next = waiting.shift();
  if (next) next(); else active--; // hand the slot straight to the next in line
}
const backoffLeft = () => Math.max(0, state.backoffUntil - Date.now());
class TtsError extends Error {
  constructor(reason, status) { super(reason); this.reason = reason; this.status = status; }
}

async function callUpstream(c, text) {
  const url = `${c.base}/v1/text-to-speech/${encodeURIComponent(c.voice)}?output_format=${OUTPUT_FORMAT}`;
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': c.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: c.model, voice_settings: VOICE_SETTINGS }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
    });
  } catch (e) {
    throw new TtsError(e && (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'upstream timeout' : 'upstream unreachable');
  }
  if (!r.ok) {
    if ([401, 402, 429].includes(r.status)) state.backoffUntil = Date.now() + BACKOFF_MS;
    const why = { 401: 'voice key rejected', 402: 'voice credits used up', 429: 'voice quota or rate limit' }[r.status] || `upstream error ${r.status}`;
    try { await r.arrayBuffer(); } catch {}
    throw new TtsError(why, r.status);
  }
  let buf;
  try { buf = Buffer.from(await r.arrayBuffer()); } catch { throw new TtsError('upstream timeout'); }
  if (buf.length < 64) throw new TtsError('upstream sent no audio');
  return buf;
}

// Makes sure the clip for `text` is on disk; one upstream call per key however many ask.
function ensureClip(c, key, text) {
  const file = clipPath(key);
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    await acquire();
    try {
      if (fs.existsSync(file)) return file;
      if (backoffLeft()) throw new TtsError('voice paused after a quota error', 429);
      state.calls++;
      const buf = await callUpstream(c, text);
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file);
      state.ok++;
      return file;
    } catch (e) {
      state.fail++;
      state.lastError = e instanceof TtsError ? e.reason : 'generation failed';
      state.lastErrorAt = Date.now();
      throw e instanceof TtsError ? e : new TtsError('generation failed');
    } finally {
      release();
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function sendClip(req, res, file, key) {
  const etag = `"${key}"`;
  res.removeHeader('Set-Cookie'); // a publicly cacheable response must never carry a session cookie
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: etag });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  const buf = fs.readFileSync(file);
  res.set('Content-Length', String(buf.length)).end(buf);
}
const noStore = (res) => res.set('Cache-Control', 'no-store');

// ---------- cache info + warming ----------
function cacheStats() {
  let count = 0, bytes = 0;
  try {
    for (const f of fs.readdirSync(CACHE_DIR)) {
      if (!f.endsWith('.mp3')) continue;
      count++;
      try { bytes += fs.statSync(path.join(CACHE_DIR, f)).size; } catch {}
    }
  } catch {}
  return { count, bytes };
}

const lastName = (s) => { const p = String(s || '').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).slice(0, 12); };
function playNames() {
  try {
    const src = fs.readFileSync(path.join(__dirname, 'public', 'arcade', 'blitz3d.js'), 'utf8');
    const names = [...src.matchAll(/\{ id: '[a-z0-9]+', name: '([^']+)', form:/g)].map((m) => m[1]);
    if (names.length) return [...new Set(names)];
  } catch {}
  return ['Inside Zone', 'Slant Flat', 'Four Verts', 'PA Boot', 'RB Screen', 'Hail Mary'];
}
function perkNames() {
  try {
    const P = require('./cards').PERKS;
    const names = Object.values(P).map((p) => p.name).filter((n) => NAME_RE.test(n) && !/doh/i.test(n));
    if (names.length) return names;
  } catch {}
  return ['Laser Arm', 'Shiny Hands', 'Slow-Mo'];
}
const GENERIC = new Set(['home', 'away', 'team', 'level', 'score', 'spot', 'yards', 'dist', 'play']);
const SAMPLES = {
  score: ['14 to 7', '21 to 14', '7 to 7', '28 to 21'],
  spot: ['the 25', 'midfield', 'the 30', 'the 20'],
  yards: ['40', '35', '45', '38'],
  dist: ['3', '7', '10', '1'],
  fg: ['32', '25', '40', '45'],
};
const PLAYER_EVENTS = {
  complete: { yards: ['8', '12', '6'] }, complete_big: { yards: ['35', '42', '28'] }, first_down: {}, td_pass: { yards: ['15', '25', '8'] },
  td_run: { yards: ['5', '12', '30'] }, run: { yards: ['4', '6', '3'] }, run_big: { yards: ['25', '30', '45'] }, incomplete: {},
  catch_wild: {}, juke: {}, hurdle: {}, truck: {}, perk: {},
};

// Every clip worth having before anyone plays: all team/score/etc lines, and each roster
// player's name in the first 3 variants of the common plays.
function warmJobs(db) {
  const teams = Object.values(db?.teams || {});
  const tnames = teams.map((t) => t.name).filter((n) => NAME_RE.test(n));
  if (!tnames.length) tnames.push('Home', 'Away');
  const plays = playNames().filter((n) => NAME_RE.test(n)), perks = perkNames();
  const jobs = [];
  for (const [e, ev] of Object.entries(LINES.events)) {
    if (!ev.vars.every((k) => GENERIC.has(k))) continue;
    if (ev.vars.includes('play')) { // each play name once, rotating through the variants
      plays.forEach((p, i) => jobs.push({ e, v: i % ev.lines.length, vars: { play: p } }));
      continue;
    }
    const usesTeam = ev.vars.some((k) => k === 'home' || k === 'away' || k === 'team');
    const reps = ev.vars.length === 0 ? 1 : usesTeam ? Math.max(tnames.length, 1) : 3;
    ev.lines.forEach((line, v) => {
      for (let i = 0; i < reps; i++) {
        const vars = {};
        for (const k of ev.vars) {
          if (k === 'home' || k === 'team') vars[k] = tnames[i % tnames.length];
          else if (k === 'away') vars[k] = tnames[(i + 1) % tnames.length];
          else if (k === 'level') vars[k] = LEVELS[(i + v) % LEVELS.length];
          else if (k === 'dist' && e.startsWith('fg')) vars[k] = SAMPLES.fg[(i + v) % 4];
          else vars[k] = SAMPLES[k][(i + v) % 4];
        }
        jobs.push({ e, v, vars });
      }
    });
  }
  const players = [];
  for (const t of teams) for (const p of t.roster || []) { const n = lastName(p.name); if (NAME_RE.test(n) && !players.includes(n)) players.push(n); }
  players.forEach((name, pi) => {
    for (const [e, samples] of Object.entries(PLAYER_EVENTS)) {
      const ev = LINES.events[e];
      for (let v = 0; v < Math.min(3, ev.lines.length); v++) {
        const vars = {};
        for (const k of ev.vars) {
          if (['carrier', 'passer', 'rec', 'player', 'kicker'].includes(k)) vars[k] = name;
          else if (k === 'perk') vars[k] = perks[(pi * 3 + v) % perks.length];
          else if (samples[k]) vars[k] = samples[k][v % samples[k].length];
        }
        // A pass needs two names: throw to the next player on the list.
        if (vars.passer && vars.rec) vars.passer = players[(pi + 1) % players.length] === name && players.length > 1 ? players[(pi + 2) % players.length] : players[(pi + 1) % players.length];
        jobs.push({ e, v, vars });
      }
    }
  });
  return jobs;
}

const warm = { running: false, total: 0, done: 0, cached: 0, failed: 0, startedAt: 0, finishedAt: 0, stopped: null };
function startWarm(db) {
  if (warm.running) return { queued: warm.total - warm.done - warm.failed, running: true };
  const c = config();
  if (!enabled(c)) return { queued: 0, error: 'voice not configured' };
  const seen = new Set(), list = [];
  for (const j of warmJobs(db)) {
    const text = respell(render(LINES.events[j.e], j.v, j.vars)), key = cacheKey(c, text);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ key, text });
  }
  Object.assign(warm, { running: true, total: list.length, done: 0, cached: 0, failed: 0, startedAt: Date.now(), finishedAt: 0, stopped: null });
  let next = 0, quotaHits = 0;
  const worker = async () => {
    while (next < list.length && !warm.stopped) {
      const job = list[next++];
      if (fs.existsSync(clipPath(job.key))) { warm.done++; warm.cached++; continue; }
      // Wait out a quota backoff rather than failing everything behind it.
      if (backoffLeft()) {
        if (++quotaHits > 3) { warm.stopped = 'quota'; break; }
        await new Promise((r) => setTimeout(r, backoffLeft() + 250));
      }
      try { await ensureClip(c, job.key, job.text); warm.done++; quotaHits = 0; } catch { warm.failed++; }
    }
  };
  Promise.all([worker(), worker()]).finally(() => { warm.running = false; warm.finishedAt = Date.now(); });
  return { queued: list.length };
}

// ---------- admin block (Admin > AI) ----------
const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
function adminBlock(esc, req) {
  const c = config(), st = cacheStats();
  const pron = Object.entries(pronounceMap()).map(([k, v]) => `${k} = ${v}`).join('\n');
  const lines = Object.values(LINES.events).reduce((n, ev) => n + ev.lines.length, 0);
  const msg = req.query.voice === 'saved' ? '<p class="muted sm"><b>Saved.</b></p>' : req.query.voice === 'bad' ? '<p class="err">That key, voice id or model doesn\'t look right. Nothing was saved.</p>' : '';
  const src = (s) => (s === 'variable' ? 'from the environment' : s === 'admin' ? 'saved here' : '');
  return `<div class="card" id="voice"><div class="card-h"><h2>Voice commentary</h2><span class="muted sm">3D Blitz</span></div>
    <p class="muted">An announcer voice reads the 3D Blitz play-by-play (${lines} lines across ${Object.keys(LINES.events).length} events). Each clip is made once with ElevenLabs and kept on the server, so replays cost nothing. Without a key and voice the game stays silent.</p>
    ${msg}
    <p>${c.key ? `Key: <b>set</b> (${src(c.keySource)}, ends in <code>${esc(c.key.slice(-4))}</code>)` : 'Key: <b>not set</b>'} · Voice: ${c.voice ? `<code>${esc(c.voice)}</code>` : '<b>not set</b>'} · Model: <code>${esc(c.model)}</code></p>
    <p>Cache: <b id="ttsCount">${st.count}</b> clips, <span id="ttsSize">${fmtBytes(st.bytes)}</span> <span class="muted sm" id="ttsWarm"></span></p>
    <p><button class="btn sm" id="ttsWarmBtn" type="button" ${enabled(c) ? '' : 'disabled'}>Warm the cache</button>
      <button class="btn sm ghost" id="ttsTestBtn" type="button" ${enabled(c) ? '' : 'disabled'}>Test a line</button> <span class="muted sm" id="ttsTestMsg"></span></p>
    <form method="post" action="/admin/tts/settings" class="form" autocomplete="off">
      ${c.keySource === 'variable' ? '' : `<label>ElevenLabs API key<input name="key" type="password" autocomplete="off" placeholder="${c.key ? 'Saved: leave blank to keep it' : 'Paste the key'}"></label>
      ${c.keySource === 'admin' ? '<label class="sm"><input type="checkbox" name="clearKey" value="1"> Remove the saved key</label>' : ''}`}
      ${c.voiceSource === 'variable' ? '' : `<label>Voice id<input name="voice" value="${esc(c.voiceSource === 'admin' ? c.voice : '')}" placeholder="from the ElevenLabs voice library" maxlength="64"></label>`}
      ${c.modelSource === 'variable' ? '' : `<label>Model<input name="model" value="${esc(c.modelSource === 'admin' ? c.model : '')}" placeholder="${DEFAULT_MODEL}" maxlength="64"></label>`}
      <label>Pronunciations <span class="muted sm">(one <code>Name = respelling</code> per line; used only for the voice, never shown)</span>
        <textarea name="pronounce" rows="6" spellcheck="false" style="width:100%;font-family:ui-monospace,monospace">${esc(pron)}</textarea></label>
      <p class="muted sm">Keys are stored only on the server, never in backups. Changing the voice, model or a pronunciation makes new clips; old ones stay cached.</p>
      <button class="btn">Save voice settings</button></form>
  </div>
  <script>(function(){
    var wb=document.getElementById('ttsWarmBtn'),tb=document.getElementById('ttsTestBtn'),wm=document.getElementById('ttsWarm'),tm=document.getElementById('ttsTestMsg'),poll=null;
    function show(s){document.getElementById('ttsCount').textContent=s.cache.count;document.getElementById('ttsSize').textContent=s.cache.size;
      var w=s.warm;if(w.total){wm.textContent='· warming: '+w.done+' done / '+w.failed+' failed / '+w.total+' total'+(w.running?'…':w.stopped?' (stopped: voice quota)':' ✓');}
      if(s.backoff)wm.textContent+=' · paused '+s.backoff+'s after a quota error';
      if(!w.running&&poll){clearInterval(poll);poll=null;wb.disabled=false;}}
    function status(){fetch('/admin/tts/status').then(function(r){return r.json()}).then(show).catch(function(){});}
    wb&&wb.addEventListener('click',function(){wb.disabled=true;wm.textContent='· starting…';fetch('/admin/tts/warm',{method:'POST'}).then(function(r){return r.json()}).then(function(d){wm.textContent='· queued '+d.queued;if(!poll)poll=setInterval(status,1500);status();}).catch(function(){wb.disabled=false;wm.textContent='· could not start';});});
    tb&&tb.addEventListener('click',function(){tb.disabled=true;tm.textContent='Generating…';fetch('/admin/tts/test',{cache:'no-store'}).then(function(r){
      if(!r.ok)return r.json().then(function(d){throw new Error(d.error||'failed')});var line=decodeURIComponent(r.headers.get('X-Line')||'');
      return r.blob().then(function(b){var a=new Audio(URL.createObjectURL(b));tm.textContent='“'+line+'”';return a.play().catch(function(){tm.textContent+=' (press play was blocked by the browser)';});});
    }).catch(function(e){tm.textContent='Failed: '+e.message;}).finally(function(){tb.disabled=false;status();});});
    status();
  })();</script>`;
}

// ---------- routes ----------
function register(app, h) {
  app.get('/arcade/tts/manifest', (req, res) => {
    const c = config();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ enabled: enabled(c), model: c.model, events: Object.fromEntries(Object.entries(LINES.events).map(([k, ev]) => [k, { n: ev.lines.length, vars: ev.vars }])) });
  });

  app.get('/arcade/tts', async (req, res) => {
    noStore(res);
    if (!h.currentUser(req)) return res.status(401).json({ error: 'log in' });
    const r = parse(req.query);
    if (r.error) return res.status(400).json({ error: r.error });
    const c = config();
    if (!enabled(c)) return res.status(204).end();
    const text = respell(render(r.ev, r.v, r.vars)), key = cacheKey(c, text), file = clipPath(key);
    if (fs.existsSync(file)) return sendClip(req, res, file, key);
    if (backoffLeft()) return res.status(503).json({ error: 'voice paused', retryAfter: Math.ceil(backoffLeft() / 1000) });
    try {
      await ensureClip(c, key, text);
      sendClip(req, res, file, key);
    } catch (e) {
      res.status(503).json({ error: e.reason || 'voice unavailable' });
    }
  });

  app.get('/admin/tts/status', h.requireAdmin, (req, res) => {
    const st = cacheStats();
    noStore(res).json({ enabled: enabled(), cache: { count: st.count, bytes: st.bytes, size: fmtBytes(st.bytes) }, warm, backoff: Math.ceil(backoffLeft() / 1000), upstream: { calls: state.calls, ok: state.ok, failed: state.fail, lastError: state.lastError } });
  });

  app.post('/admin/tts/warm', h.requireAdmin, (req, res) => {
    noStore(res).json(startWarm(h.load()));
  });

  // One short line with a random roster name, for checking the voice from the admin page.
  app.get('/admin/tts/test', h.requireAdmin, async (req, res) => {
    noStore(res);
    const c = config();
    if (!enabled(c)) return res.status(400).json({ error: 'set a key and a voice first' });
    const names = Object.values(h.load()?.teams || {}).flatMap((t) => (t.roster || []).map((p) => lastName(p.name))).filter((n) => NAME_RE.test(n));
    const name = names.length ? names[Math.floor(Math.random() * names.length)] : 'Pedon';
    const pick = [['first_down', { player: name }], ['juke', { carrier: name }], ['catch_wild', { rec: name }], ['td_short', { carrier: name }]][Math.floor(Math.random() * 4)];
    const ev = LINES.events[pick[0]], v = Math.floor(Math.random() * ev.lines.length);
    const shown = render(ev, v, pick[1]), text = respell(shown), key = cacheKey(c, text);
    try {
      const file = await ensureClip(c, key, text);
      res.set('X-Line', encodeURIComponent(shown));
      res.set('Content-Type', 'audio/mpeg').end(fs.readFileSync(file));
    } catch (e) {
      res.status(503).json({ error: e.reason || 'voice unavailable' });
    }
  });

  app.post('/admin/tts/settings', h.requireAdmin, (req, res) => {
    const b = req.body || {}, patch = {};
    const key = String(b.key || '').trim(), voice = b.voice === undefined ? undefined : String(b.voice).trim(), model = b.model === undefined ? undefined : String(b.model).trim();
    if (key && !/^[A-Za-z0-9_-]{16,200}$/.test(key)) return res.redirect('/admin/ai?voice=bad#voice');
    if (voice && !/^[A-Za-z0-9]{6,64}$/.test(voice)) return res.redirect('/admin/ai?voice=bad#voice');
    if (model && !/^[a-z0-9_]{2,64}$/.test(model)) return res.redirect('/admin/ai?voice=bad#voice');
    if (key) patch.elevenKey = key; else if (b.clearKey) patch.elevenKey = null;
    if (voice !== undefined) patch.elevenVoice = voice || null;
    if (model !== undefined) patch.elevenModel = model || null;
    if (Object.keys(patch).length) writeSecrets(patch);
    if (b.pronounce !== undefined) savePronounce(b.pronounce);
    res.redirect('/admin/ai?voice=saved#voice');
  });
}

module.exports = { register, adminBlock, parse, render, respell, config, LINES };
