// Voice commentary for 3D Blitz: the lines in commentary-lines.json are spoken by a
// text-to-speech voice (ElevenLabs). Every clip is made ahead of time on the server and kept
// in DATA_DIR/tts/ (one file per segment and value); during a game clips are only served.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./db');

const LINES = require('./commentary-lines.json');
// Earlier splits of the same lines, newest first, each with the settings version its clips were made under: while the
// new split's clips are still being made, a line is said in the newest earlier split whose clips all exist.
const PREV_FILES = [['./commentary-lines.prev.json', 2], ['./commentary-lines.prev2.json', 2]];
const PREVS = []; for (const [f, sv] of PREV_FILES) { try { PREVS.push({ lines: require(f), sv }); } catch {} }
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
const PRONOUNCE_FILE = path.join(DATA_DIR, 'pronounce.json');
const CACHE_DIR = path.join(DATA_DIR, 'tts');
const DEFAULT_MODEL = 'eleven_flash_v2_5'; // fast: a new line is ready in about a second, so the call lands with the play
const DEFAULT_BASE = 'https://api.elevenlabs.io';
// Steady delivery: short clips are rendered one at a time, so high stability, little style exaggeration and the same
// lead-in context for every clip keep the tone level from one phrase to the next.
const VOICE_SETTINGS = { stability: 0.95, similarity_boost: 0.9, style: 0, use_speaker_boost: true };
const LEAD_IN = 'And here we go. ';
// Every clip is rendered as the continuation of one anchor clip (request stitching), so the voice keeps the same register
// from phrase to phrase instead of each short clip settling into its own. Request ids expire after two hours, so the
// anchor is remade every 90 minutes from the same text and seed.
const ANCHOR_TEXT = 'Welcome back to the Blitz, folks. What a night for football, and this crowd is loving every second of it.';
const ANCHOR_SEED = 777, ANCHOR_TTL = 90 * 60 * 1000;
const ANCHOR_FILE = path.join(DATA_DIR, 'tts-anchor.json');
// what follows a clip: a continuing phrase gets a mid-sentence read, a closing one a sentence end
const nextText = (text) => (/[.!?]$/.test(text.trim()) ? 'What a night.' : 'and the crowd is loving it.');
// bump when the settings or context change so every clip is made again the same way, instead of mixing takes
const SETTINGS_V = 3;
// The voices the admin can pick from (ids only; useless without the key). The first is the current default.
const DEFAULT_VOICES = [{ id: '5e7CHmBxorsZJP4N1Vbi', label: 'Voice 2' }, { id: 'keCu5L7yj9nJhFRsvWmk', label: 'Voice 1' }];
const OUTPUT_FORMAT = 'mp3_22050_32';
const MAX_UPSTREAM = 2; // generation requests in flight at once
const UPSTREAM_TIMEOUT = 20000;
const BACKOFF_MS = +process.env.TTS_BACKOFF_MS || 60000; // after 401/402/429 (bad key, out of credits, rate limited)

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
    voices: voiceList(s),
    model: e.ELEVENLABS_MODEL || s.elevenModel || DEFAULT_MODEL,
    modelSource: e.ELEVENLABS_MODEL ? 'variable' : s.elevenModel ? 'admin' : null,
    base: (e.ELEVENLABS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, ''),
  };
}
const enabled = (c = config()) => !!(c.key && c.voice);
// the saved list of voices plus the built-in ones, current first
function voiceList(s) {
  const seen = new Set(), out = [];
  for (const v of [...(Array.isArray(s.elevenVoices) ? s.elevenVoices : []), ...DEFAULT_VOICES]) { if (!v || !v.id || seen.has(v.id)) continue; seen.add(v.id); out.push({ id: String(v.id), label: String(v.label || v.id).slice(0, 40) }); }
  return out;
}
// one-time switch to the newer voice for a site that was set up on the first one; the admin can switch back
function migrateVoice() {
  try { const s = readSecrets(); if (s.elevenVoice === DEFAULT_VOICES[1].id && !s.voiceSwitched) writeSecrets({ elevenVoice: DEFAULT_VOICES[0].id, voiceSwitched: 1 }); } catch {}
}

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
// Each line is a list of segments with at most one {var} each. Every segment is its own clip,
// rendered ahead of time for every value its var can take (see "domains" in the JSON); the game
// plays the clips back to back.
const NAME_RE = /^[A-Za-z0-9 .,'’-]{1,40}$/;
const NUM_RE = /^\d{1,3}$/;
const DOWN_RE = /^(1st|2nd|3rd|4th)$/;
// Everything else (names, teams, perk, play, spot, level, period) uses NAME_RE.
const VAR_RE = { yards: NUM_RE, dist: NUM_RE, n: NUM_RE, plays: NUM_RE, cmp: NUM_RE, att: NUM_RE, secs: NUM_RE, hs: NUM_RE, as: NUM_RE, down: DOWN_RE };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const segVars = (seg) => [...seg.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]);
const segVar = (seg) => segVars(seg)[0] || null;
const NAMEISH = new Set(['passer', 'rec', 'carrier', 'player', 'kicker']);

// Checks a request's query: { e, v, i, <the segment's vars>, p? }, p being an earlier split (1 = the newest).
// Returns { seg, vals, sv } (sv: the settings version of that split's clips) or { error }.
function parse(q) {
  const e = q.e, p = q.p === undefined ? 0 : /^[1-9]$/.test(String(q.p)) ? +q.p : -1, src = p === 0 ? LINES : p > 0 && PREVS[p - 1] ? PREVS[p - 1].lines : null;
  if (!src || typeof e !== 'string' || !has(src.events, e)) return { error: 'unknown event' };
  const ev = src.events[e];
  if (typeof q.v !== 'string' || !/^\d{1,3}$/.test(q.v) || +q.v >= ev.lines.length) return { error: 'bad variant' };
  const line = ev.lines[+q.v];
  if (typeof q.i !== 'string' || !/^\d{1,2}$/.test(q.i) || +q.i >= line.length) return { error: 'bad segment' };
  const seg = line[+q.i], names = segVars(seg), vals = {}, sv = p === 0 ? SETTINGS_V : PREVS[p - 1].sv;
  for (const k of Object.keys(q)) if (k !== 'e' && k !== 'v' && k !== 'i' && k !== 'p' && !names.includes(k)) return { error: `unexpected ${k}` };
  for (const name of names) {
    const value = q[name];
    if (value === undefined) return { error: `missing ${name}` };
    if (typeof value !== 'string' || !(VAR_RE[name] || NAME_RE).test(value)) return { error: `bad ${name}` };
    vals[name] = value;
  }
  return { seg, vals, sv, name: names[0] || null, value: names.length ? vals[names[0]] : null };
}
// the segment with its placeholders filled in: renderSeg(seg, { rec: 'Tabaka', yards: '16' }) or renderSeg(seg, 'rec', 'Tabaka')
const renderSeg = (seg, vals, value) => { if (typeof vals === 'string') vals = { [vals]: value }; return vals ? seg.replace(/\{([a-z]+)\}/g, (m, k) => (vals[k] !== undefined ? vals[k] : m)) : seg; };
// every spoken text of a segment: the product of its vars' values (two names in one clip are never the same player)
function* segTexts(seg, dom) {
  const names = segVars(seg);
  if (!names.length) { yield respell(seg); return; }
  const lists = names.map((n) => dom[n] || []), idx = names.map(() => 0);
  if (lists.some((l) => !l.length)) return;
  for (;;) {
    const vals = {}; names.forEach((n, j) => { vals[n] = lists[j][idx[j]]; });
    if (!(names.length === 2 && NAMEISH.has(names[0]) && NAMEISH.has(names[1]) && vals[names[0]] === vals[names[1]])) yield respell(renderSeg(seg, vals));
    let j = names.length - 1; while (j >= 0 && ++idx[j] === lists[j].length) { idx[j] = 0; j--; }
    if (j < 0) return;
  }
}
const cacheKey = (c, text, sv = SETTINGS_V) => crypto.createHash('sha1').update(`${c.model}|${c.voice}|v${sv}|${text}`).digest('hex');
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

// The anchor clip's request id for this model and voice: from memory, from disk, or made now (one request at a time).
// Null when it cannot be made; clips are then rendered on the lead-in text alone.
let anchorMemo = null, anchorInflight = null, anchorFailedAt = 0;
function anchorFor(c) {
  const fresh = (a) => !!(a && a.id && a.model === c.model && a.voice === c.voice && Date.now() - a.at < ANCHOR_TTL);
  if (fresh(anchorMemo)) return Promise.resolve(anchorMemo.id);
  try { const a = JSON.parse(fs.readFileSync(ANCHOR_FILE, 'utf8')); if (fresh(a)) { anchorMemo = a; return Promise.resolve(a.id); } } catch {}
  if (anchorInflight) return anchorInflight;
  if (Date.now() - anchorFailedAt < 60000) return Promise.resolve(null);
  anchorInflight = (async () => {
    try {
      const r = await fetch(`${c.base}/v1/text-to-speech/${encodeURIComponent(c.voice)}?output_format=${OUTPUT_FORMAT}`, {
        method: 'POST',
        headers: { 'xi-api-key': c.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: ANCHOR_TEXT, model_id: c.model, voice_settings: VOICE_SETTINGS, seed: ANCHOR_SEED }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT),
      });
      try { await r.arrayBuffer(); } catch {}
      const id = r.ok ? r.headers.get('request-id') : null;
      if (!id) { anchorFailedAt = Date.now(); return null; }
      anchorMemo = { model: c.model, voice: c.voice, id, at: Date.now() };
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(ANCHOR_FILE, JSON.stringify(anchorMemo)); } catch {}
      return id;
    } catch { anchorFailedAt = Date.now(); return null; } finally { anchorInflight = null; }
  })();
  return anchorInflight;
}

async function callUpstream(c, text) {
  const url = `${c.base}/v1/text-to-speech/${encodeURIComponent(c.voice)}?output_format=${OUTPUT_FORMAT}`;
  const anchor = await anchorFor(c);
  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': c.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: c.model, voice_settings: VOICE_SETTINGS, previous_text: LEAD_IN, next_text: nextText(text), ...(anchor ? { previous_request_ids: [anchor] } : {}) }),
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
      keysMemo.set.add(key);
      if (++madeSinceManifest >= 50) { madeSinceManifest = 0; manifestMemo.at = 0; } // the game's manifest learns of new clips as they land
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

// ---------- domains: every value each var can take ----------
const lastName = (s) => { const p = String(s || '').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).slice(0, 12); };
// A value with a character the request pattern refuses ("Boo!") is spoken and requested without it ("Boo").
const clean = (s) => String(s || '').replace(/[^A-Za-z0-9 .,'’-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const uniq = (a) => [...new Set(a.map(clean).filter((x) => NAME_RE.test(x)))];
function playNames() {
  try {
    const src = fs.readFileSync(path.join(__dirname, 'public', 'arcade', 'blitz3d.js'), 'utf8');
    const names = [...src.matchAll(/\{ id: '[a-z0-9]+', name: '([^']+)', form:/g)].map((m) => m[1]);
    if (names.length) return uniq(names);
  } catch {}
  return [];
}
function perkNames() {
  try {
    const cards = require('./cards');
    const hidden = new Set((cards.VARIANTS || []).filter((v) => v.hidden).map((v) => v.id));
    return uniq(Object.values(cards.PERKS).filter((p) => !hidden.has(p.id)).map((p) => p.name));
  } catch { return []; }
}
function domainValues(name, db, spec = LINES.domains[name]) {
  if (!spec) return [];
  if (spec.values) return spec.values;
  if (spec.min !== undefined) { const out = []; for (let n = spec.min; n <= spec.max; n += spec.step || 1) out.push(String(n)); return out; }
  const teams = Object.values(db?.teams || {});
  if (spec.from === 'roster') return uniq(teams.flatMap((t) => (t.roster || []).map((p) => lastName(p.name))));
  if (spec.from === 'teams') return uniq([...teams.map((t) => t.name), ...(spec.plus || [])]);
  if (spec.from === 'perks') return perkNames();
  if (spec.from === 'plays') return playNames();
  return [];
}

// The order clips are made in, which is the order a part-made library fills up in: the first variant of every event, the
// calls a game hears most first, then the second variant of every event, and so on, so every event has a line ready early
// and variety grows from there.
const PRIORITY = 'snap_pass snap_run throw_to caught_live run_live complete run incomplete first_down play_call situation situation_1st situation_long situation_short td_pass td_run td_short xp_good xp_miss pressure open_field tackle_live drop sack run_big complete_big run_loss no_gain interception cpu_td cpu_punt cpu_fg cpu_drive_start drive_start kickoff_cpu kr_return intro end_q1 halftime end_q3 final_win final_loss two_minute third_down fourth_go turnover_downs punt fg_good fg_miss color coach_note drive_note clock_note score_lead score_trail score_tied player_catches player_rush qb_line'.split(' ');
function lineOrder() {
  const ids = Object.keys(LINES.events), rank = new Map(PRIORITY.map((k, i) => [k, i]));
  ids.sort((a, b) => (rank.has(a) ? rank.get(a) : 1e3 + ids.indexOf(a)) - (rank.has(b) ? rank.get(b) : 1e3 + ids.indexOf(b)));
  const out = [], most = Math.max(...ids.map((k) => LINES.events[k].lines.length));
  for (let v = 0; v < most; v++) for (const k of ids) if (LINES.events[k].lines[v]) out.push(LINES.events[k].lines[v]);
  return out;
}
// The whole space: every segment of every variant of every event x every value of its var.
// Identical texts (the same name in {passer} and {rec}, say) are one clip.
function plan(db, c = config()) {
  const dom = {};
  for (const k of Object.keys(LINES.domains)) dom[k] = domainValues(k, db);
  const clips = new Map();
  let chars = 0;
  for (const line of lineOrder()) for (const seg of line) for (const text of segTexts(seg, dom)) {
    const key = cacheKey(c, text);
    if (clips.has(key)) continue;
    clips.set(key, text);
    chars += text.length;
  }
  return { clips, chars, domains: Object.fromEntries(Object.entries(dom).map(([k, v]) => [k, v.length])) };
}
// the clips on disk, by key (read again every 30 s; a clip made by a run is added as it lands)
let keysMemo = { at: 0, set: new Set() };
function existingKeys() {
  if (Date.now() - keysMemo.at < 30000) return keysMemo.set;
  const set = new Set();
  try { for (const f of fs.readdirSync(CACHE_DIR)) if (f.endsWith('.mp3')) set.add(f.slice(0, -4)); } catch {}
  keysMemo = { at: Date.now(), set };
  return set;
}
const lineReady = (line, dom, c, keys, sv) => line.every((seg) => { for (const text of segTexts(seg, dom)) if (!keys.has(cacheKey(c, text, sv))) return false; return true; });
// What the game needs per event: the variant count, the vars, the var names of each segment of each variant, which
// variants have every clip on disk, and for the others the newest earlier split of the event whose clips all exist
// (p: which split, v: its variant, segs: its segments' vars). Worked out at most every 30 s.
let manifestMemo = { at: 0, key: '', events: null }, madeSinceManifest = 0;
function manifestEvents(db, c) {
  const mk = `${c.model}|${c.voice}`;
  if (manifestMemo.events && manifestMemo.key === mk && Date.now() - manifestMemo.at < 30000) return manifestMemo.events;
  const dom = {};
  for (const k of Object.keys(LINES.domains)) dom[k] = domainValues(k, db);
  const keys = existingKeys(), segsOf = (l) => l.map(segVars);
  const events = {};
  for (const [id, ev] of Object.entries(LINES.events)) {
    const o = { n: ev.lines.length, vars: ev.vars, segs: ev.lines.map(segsOf), ready: ev.lines.map((l) => lineReady(l, dom, c, keys, SETTINGS_V)) };
    if (!o.ready.every(Boolean)) {
      const prev = o.ready.map((r, v) => {
        if (r) return null;
        for (let p = 0; p < PREVS.length; p++) {
          const pe = PREVS[p].lines.events[id]; if (!pe || !pe.lines.length) continue;
          const pv = v % pe.lines.length;
          if (lineReady(pe.lines[pv], dom, c, keys, PREVS[p].sv)) return { p: p + 1, v: pv, segs: segsOf(pe.lines[pv]) };
        }
        return null;
      });
      if (prev.some(Boolean)) o.prev = prev;
    }
    events[id] = o;
  }
  manifestMemo = { at: Date.now(), key: mk, events };
  return events;
}
const readiness = (events) => { let ready = 0, total = 0, fallback = 0; for (const o of Object.values(events)) { total += o.n; ready += o.ready.filter(Boolean).length; if (o.prev) fallback += o.prev.filter(Boolean).length; } return { ready, total, fallback }; };
function coverage(p) {
  let have = 0, missingChars = 0;
  for (const [key, text] of p.clips) { if (fs.existsSync(clipPath(key))) have++; else missingChars += text.length; }
  return { total: p.clips.size, have, chars: p.chars, missingChars };
}
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

// ---------- warming (the only place clips are made) ----------
const warm = { running: false, total: 0, missing: 0, done: 0, failed: 0, startedAt: 0, finishedAt: 0, stopped: null, trigger: null };
function startWarm(db, trigger = 'manual') {
  if (warm.running) return { queued: warm.missing - warm.done - warm.failed, running: true };
  const c = config();
  if (!enabled(c)) return { queued: 0, error: 'voice not configured' };
  const p = plan(db, c);
  const list = [...p.clips].filter(([key]) => !fs.existsSync(clipPath(key)));
  Object.assign(warm, { running: true, total: p.clips.size, missing: list.length, done: 0, failed: 0, startedAt: Date.now(), finishedAt: 0, stopped: null, trigger });
  let next = 0, quotaInARow = 0;
  const worker = async () => {
    while (next < list.length && !warm.stopped) {
      const [key, text] = list[next++];
      if (backoffLeft()) await new Promise((r) => setTimeout(r, backoffLeft() + 250)); // wait out a quota pause
      if (warm.stopped) break;
      try {
        await ensureClip(c, key, text);
        warm.done++; quotaInARow = 0;
      } catch (e) {
        warm.failed++;
        if ([401, 402, 429].includes(e.status)) { if (++quotaInARow >= 3) warm.stopped = 'quota'; } else quotaInARow = 0;
      }
    }
  };
  Promise.all([worker(), worker()]).finally(() => { warm.running = false; warm.finishedAt = Date.now(); manifestMemo.at = 0; });
  return { queued: list.length, total: p.clips.size };
}
// On boot and every 6 hours: new roster names, pronunciations or a model change get rendered
// without anyone pressing the button.
const AUTO_EVERY = 6 * 3600 * 1000;
function startAuto(load, delay = +process.env.TTS_WARM_DELAY_MS || 20000) {
  const run = () => {
    const db = load();
    if (!db) return setTimeout(run, 5000).unref(); // data not loaded yet
    try { if (enabled()) startWarm(db, 'auto'); } catch { state.lastError = 'auto warm failed'; }
  };
  setTimeout(run, delay).unref();
  setInterval(run, AUTO_EVERY).unref();
}

// ---------- admin block (Admin > AI) ----------
const NAME_VARS = new Set(['passer', 'rec', 'carrier', 'player', 'kicker']);
const NAME_SEGS = new Set(Object.values(LINES.events).flatMap((ev) => ev.lines.flat().filter((s) => NAME_VARS.has(segVar(s))).map((s) => s.replace(/\{[a-z]+\}/, '{name}')))).size;
const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
const fmtN = (n) => n.toLocaleString('en-US');
function adminBlock(esc, req, db) {
  const c = config(), st = cacheStats(), p = plan(db, c), cov = coverage(p);
  const pron = Object.entries(pronounceMap()).map(([k, v]) => `${k} = ${v}`).join('\n');
  const lines = Object.values(LINES.events).reduce((n, ev) => n + ev.lines.length, 0);
  const msg = req.query.voice === 'saved' ? '<p class="muted sm"><b>Saved.</b></p>' : req.query.voice === 'bad' ? '<p class="err">That key, voice id or model doesn\'t look right. Nothing was saved.</p>' : '';
  const src = (s) => (s === 'variable' ? 'from the environment' : s === 'admin' ? 'saved here' : '');
  return `<div class="card" id="voice"><div class="card-h"><h2>Voice commentary</h2><span class="muted sm">3D Blitz</span></div>
    <p class="muted">An announcer voice reads the 3D Blitz play-by-play (${fmtN(lines)} lines across ${Object.keys(LINES.events).length} events). Every clip is made ahead of time with ElevenLabs, here on the server, for every name, team and number a line can use; during a game nothing is generated, the game only plays clips that are already made. The job runs when the server starts and every 6 hours (only missing clips are made), or now with the button.</p>
    ${msg}
    <p>${c.key ? `Key: <b>set</b> (${src(c.keySource)}, ends in <code>${esc(c.key.slice(-4))}</code>)` : 'Key: <b>not set</b>'} · Voice: ${c.voice ? `<code>${esc(c.voice)}</code>` : '<b>not set</b>'} · Model: <code>${esc(c.model)}</code></p>
    <p>All clips: <b>${fmtN(cov.total)}</b> (about <b>${fmtN(cov.chars)}</b> characters of speech) · Made: <b id="ttsHave">${fmtN(cov.have)}</b> of ${fmtN(cov.total)} (<span id="ttsPct">${cov.total ? Math.floor((cov.have / cov.total) * 100) : 0}</span>%) · Still to make: <span id="ttsMissChars">${fmtN(cov.missingChars)}</span> characters</p>
    <p class="muted sm">On disk: <span id="ttsCount">${fmtN(st.count)}</span> files, <span id="ttsSize">${fmtBytes(st.bytes)}</span>. Each new roster name adds ${fmtN(NAME_SEGS)} clips.</p>
    <p class="muted sm" id="ttsWarm"></p>
    <p><button class="btn sm" id="ttsWarmBtn" type="button" ${enabled(c) ? '' : 'disabled'}>Make missing clips now</button>
      <button class="btn sm ghost" id="ttsTestBtn" type="button" ${enabled(c) ? '' : 'disabled'}>Test a line</button> <span class="muted sm" id="ttsTestMsg"></span></p>
    <form method="post" action="/admin/tts/settings" class="form" autocomplete="off">
      ${c.keySource === 'variable' ? '' : `<label>ElevenLabs API key<input name="key" type="password" autocomplete="off" placeholder="${c.key ? 'Saved: leave blank to keep it' : 'Paste the key'}"></label>
      ${c.keySource === 'admin' ? '<label class="sm"><input type="checkbox" name="clearKey" value="1"> Remove the saved key</label>' : ''}`}
      ${c.voiceSource === 'variable' ? '' : `<fieldset style="border:0;padding:0;margin:0 0 10px"><legend class="sm" style="margin-bottom:6px">Voice <span class="muted">(switching makes that voice's clips on the next run; clips already made for a voice stay, so switching back is instant)</span></legend>
        ${c.voices.map((v) => `<label class="sm" style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="radio" name="voicePick" value="${esc(v.id)}" ${c.voice === v.id ? 'checked' : ''}> <b>${esc(v.label)}</b> <code>${esc(v.id)}</code>${c.voice === v.id ? ' · current' : ''}</label>`).join('')}
        <label class="sm" style="display:flex;gap:8px;align-items:center;margin:6px 0 0;flex-wrap:wrap">Add a voice <input name="newVoice" placeholder="voice id" maxlength="64" style="width:220px"> <input name="newLabel" placeholder="name it" maxlength="40" style="width:140px"></label></fieldset>`}
      ${c.modelSource === 'variable' ? '' : `<label>Model<input name="model" value="${esc(c.modelSource === 'admin' ? c.model : '')}" placeholder="${DEFAULT_MODEL}" maxlength="64"></label>`}
      <label>Pronunciations <span class="muted sm">(one <code>Name = respelling</code> per line; used only for the voice, never shown)</span>
        <textarea name="pronounce" rows="6" spellcheck="false" style="width:100%;font-family:ui-monospace,monospace">${esc(pron)}</textarea></label>
      <p class="muted sm">Keys are stored only on the server, never in backups. Changing the voice, the model or a pronunciation means those clips are made again (the next run, or the button).</p>
      <button class="btn">Save voice settings</button></form>
  </div>
  <script>(function(){
    var wb=document.getElementById('ttsWarmBtn'),tb=document.getElementById('ttsTestBtn'),wm=document.getElementById('ttsWarm'),tm=document.getElementById('ttsTestMsg'),poll=null,$=function(i){return document.getElementById(i)};
    function n(x){return Number(x).toLocaleString('en-US')}
    function show(s){$('ttsCount').textContent=n(s.cache.count);$('ttsSize').textContent=s.cache.size;$('ttsHave').textContent=n(s.coverage.have);$('ttsPct').textContent=s.coverage.total?Math.floor(s.coverage.have/s.coverage.total*100):0;$('ttsMissChars').textContent=n(s.coverage.missingChars);
      var w=s.warm,t='';if(w.missing||w.running||w.finishedAt){t=(w.running?'Making clips'+(w.trigger==='auto'?' (automatic run)':'')+': ':'Last run: ')+n(w.done)+' made / '+n(w.failed)+' failed / '+n(w.missing)+' to make'+(w.running?'…':w.stopped==='quota'?'. Stopped after 3 quota errors in a row: check the ElevenLabs credits.':' ✓');}
      if(s.backoff)t+=' · paused '+s.backoff+'s after a quota error';wm.textContent=t;
      if(w.running&&!poll){poll=setInterval(status,2000);wb.disabled=true;}
      if(!w.running&&poll){clearInterval(poll);poll=null;wb.disabled=false;}}
    function status(){fetch('/admin/tts/status').then(function(r){return r.json()}).then(show).catch(function(){});}
    wb&&wb.addEventListener('click',function(){wb.disabled=true;wm.textContent='Starting…';fetch('/admin/tts/warm',{method:'POST'}).then(function(r){return r.json()}).then(function(){status();}).catch(function(){wb.disabled=false;wm.textContent='Could not start.';});});
    tb&&tb.addEventListener('click',function(){tb.disabled=true;tm.textContent='Generating…';fetch('/admin/tts/test',{cache:'no-store'}).then(function(r){
      if(!r.ok)return r.json().then(function(d){throw new Error(d.error||'failed')});var line=decodeURIComponent(r.headers.get('X-Line')||'');
      return r.blob().then(function(b){var a=new Audio(URL.createObjectURL(b));tm.textContent='“'+line+'”';return a.play().catch(function(){tm.textContent+=' (press play was blocked by the browser)';});});
    }).catch(function(e){tm.textContent='Failed: '+e.message;}).finally(function(){tb.disabled=false;status();});});
    status();
  })();</script>`;
}

// ---------- routes ----------
function register(app, h) {
  migrateVoice();
  app.get('/arcade/tts/manifest', (req, res) => {
    const c = config();
    res.set('Cache-Control', 'private, max-age=60'); // enabled depends on who is asking: clips need a login
    res.json({
      enabled: enabled(c) && !!h.currentUser(req),
      model: c.model,
      events: manifestEvents(h.load(), c),
    });
  });

  // Serve only: a clip that was not made ahead of time is a 404, never a call to the voice service.
  app.get('/arcade/tts', (req, res) => {
    noStore(res);
    if (!h.currentUser(req)) return res.status(401).json({ error: 'log in' });
    const r = parse(req.query);
    if (r.error) return res.status(400).json({ error: r.error });
    const c = config();
    if (!enabled(c)) return res.status(204).end();
    const key = cacheKey(c, respell(renderSeg(r.seg, r.vals)), r.sv), file = clipPath(key);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not rendered' });
    sendClip(req, res, file, key);
  });

  app.get('/admin/tts/status', h.requireAdmin, (req, res) => {
    const st = cacheStats(), cov = coverage(plan(h.load()));
    noStore(res).json({ enabled: enabled(), cache: { count: st.count, bytes: st.bytes, size: fmtBytes(st.bytes) }, coverage: cov, lines: readiness(manifestEvents(h.load(), config())), warm, backoff: Math.ceil(backoffLeft() / 1000), upstream: { calls: state.calls, ok: state.ok, failed: state.fail, lastError: state.lastError } });
  });

  app.post('/admin/tts/warm', h.requireAdmin, (req, res) => {
    noStore(res).json(startWarm(h.load(), 'manual'));
  });

  // One short line with a random roster name, made from its segment clips (missing ones are made
  // now: this is the admin page, not a game) and played back to back.
  app.get('/admin/tts/test', h.requireAdmin, async (req, res) => {
    noStore(res);
    const c = config();
    if (!enabled(c)) return res.status(400).json({ error: 'set a key and a voice first' });
    const names = domainValues('player', h.load());
    const name = names.length ? names[Math.floor(Math.random() * names.length)] : 'Pedon';
    const e = ['first_down', 'juke', 'catch_wild', 'td_short'][Math.floor(Math.random() * 4)];
    const line = LINES.events[e].lines[Math.floor(Math.random() * LINES.events[e].lines.length)];
    try {
      const parts = [];
      const vals = (seg) => Object.fromEntries(segVars(seg).map((k) => [k, name]));
      for (const seg of line) {
        const text = respell(renderSeg(seg, vals(seg))), key = cacheKey(c, text);
        parts.push(fs.readFileSync(await ensureClip(c, key, text)));
      }
      res.set('X-Line', encodeURIComponent(line.map((s) => renderSeg(s, vals(s))).join(' ')));
      res.set('Content-Type', 'audio/mpeg').end(Buffer.concat(parts));
    } catch (e) {
      res.status(503).json({ error: e.reason || 'voice unavailable' });
    }
  });

  app.post('/admin/tts/settings', h.requireAdmin, (req, res) => {
    const b = req.body || {}, patch = {};
    const key = String(b.key || '').trim(), model = b.model === undefined ? undefined : String(b.model).trim();
    const newVoice = String(b.newVoice || '').trim(), newLabel = String(b.newLabel || '').trim();
    let voice = b.voicePick === undefined ? (b.voice === undefined ? undefined : String(b.voice).trim()) : String(b.voicePick).trim();
    if (key && !/^[A-Za-z0-9_-]{16,200}$/.test(key)) return res.redirect('/admin/ai?voice=bad#voice');
    if (newVoice && !/^[A-Za-z0-9]{6,64}$/.test(newVoice)) return res.redirect('/admin/ai?voice=bad#voice');
    if (newVoice) { const s = readSecrets(), list = voiceList(s).filter((v) => v.id !== newVoice); patch.elevenVoices = [{ id: newVoice, label: newLabel || 'Voice ' + (list.length + 1) }, ...list]; if (voice === undefined || !voice) voice = newVoice; }
    if (voice && !/^[A-Za-z0-9]{6,64}$/.test(voice)) return res.redirect('/admin/ai?voice=bad#voice');
    if (model && !/^[a-z0-9_]{2,64}$/.test(model)) return res.redirect('/admin/ai?voice=bad#voice');
    if (key) patch.elevenKey = key; else if (b.clearKey) patch.elevenKey = null;
    const before = config();
    if (voice !== undefined) { patch.elevenVoice = voice || null; patch.voiceSwitched = 1; }
    if (model !== undefined) patch.elevenModel = model || null;
    if (Object.keys(patch).length) writeSecrets(patch);
    if (b.pronounce !== undefined) savePronounce(b.pronounce);
    const after = config();
    if ((after.voice !== before.voice || after.model !== before.model) && enabled(after)) { // a new voice or model: stop the current run and start on the new clips right away
      if (warm.running) warm.stopped = 'settings changed';
      setTimeout(() => { try { startWarm(h.load(), 'settings'); } catch {} }, warm.running ? 1500 : 10);
    }
    res.redirect('/admin/ai?voice=saved#voice');
  });
}

module.exports = { register, startAuto, startWarm, warm, adminBlock, parse, renderSeg, segVars, segTexts, respell, config, plan, coverage, manifestEvents, domainValues, LINES, PREVS, VOICE_SETTINGS, LEAD_IN, ANCHOR_TEXT, DEFAULT_VOICES };
