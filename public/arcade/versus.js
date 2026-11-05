// Head to Head (3D Blitz, player vs player): the lobby page's client.
// Gets a short-lived token from /arcade/versus/token, opens the WebSocket it names (?t=<token>) or, where that is blocked, the
// same connection over HTTPS on the site's own domain (/arcade/versus/http/*), shows who's online
// and the challenges, and runs a match: join + ready, then window.MFLBlitz.play(root, { ..., versus: net }) on 'go'.
// The engine talks to the other player through `net` (see versus.js on the server for the messages).
(function () {
  'use strict';
  const cfg = window.MFL_VERSUS;
  if (!cfg || !document.getElementById('vsLobby')) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const OPEN = 1;
  const ME = cfg.me;
  const QLABEL = { 60: '1-min', 120: '2-min', 180: '3-min' };
  const terms = (wager, qs) => `${wager ? fmt(wager) + ' coins' : 'Friendly'} · ${QLABEL[qs] || Math.round(qs / 60) + '-min'} quarters`;
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let sock = null, retry = 0, retryTimer = null, connecting = false, loggedOut = false;
  let balance = cfg.balance, online = [], incoming = [], outgoing = null, results = cfg.results || [];
  let formFor = null, sending = false;
  let live = null; // the match on this page: { id, m, net, engine, resolved, over, queue, early }

  // ---------- connection ----------
  function sendRaw(o) {
    if (!sock || sock.readyState !== OPEN) return false;
    try { sock.send(JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  // match messages wait for the connection to come back (in order)
  function out(o) { if (live && live.queue.length) { live.queue.push(o); return; } if (!sendRaw(o) && live && live.queue.length < 500) live.queue.push(o); }
  function flushQueue() { while (live && live.queue.length && sock && sock.readyState === OPEN) { if (!sendRaw(live.queue[0])) break; live.queue.shift(); } }

  // The same connection over plain HTTPS on the site's own domain, for networks that block the WebSocket to the game server (school
  // filters among them): a long poll brings the server's messages, batched POSTs carry ours. It looks like a WebSocket to the rest
  // of this file (readyState, send, close, onopen / onmessage / onclose).
  const b64 = (buf) => { const u = new Uint8Array(buf); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(t); };
  const unb64 = (t) => { const b = atob(t), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const postJson = (path, body) => fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());
  function HttpSock() {
    this.http = true; this.readyState = 0; this.binaryType = 'arraybuffer'; this.q = []; this.inflight = false; this.sid = null; this.fails = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    postJson('/arcade/versus/http/open').then((r) => {
      if (this.readyState !== 0) return;
      if (!r || !r.ok) { this.loggedOut = !!(r && r.error === 'login'); return this.dead(); }
      this.sid = r.sid; this.readyState = OPEN; if (this.onopen) this.onopen(); this.poll();
    }).catch(() => this.dead());
  }
  HttpSock.prototype.poll = function () {
    if (this.readyState !== OPEN) return;
    postJson('/arcade/versus/http/poll', { sid: this.sid }).then((r) => {
      if (this.readyState !== OPEN) return;
      if (!r || !r.ok) return this.dead();
      this.fails = 0;
      for (const it of r.m || []) { if (this.readyState !== OPEN) return; if (this.onmessage) this.onmessage({ data: it.b != null ? unb64(it.b) : it.s }); }
      this.poll();
    }).catch(() => { if (++this.fails > 2) this.dead(); else setTimeout(() => this.poll(), 500); });
  };
  Object.defineProperty(HttpSock.prototype, 'bufferedAmount', { get() { let n = 0; for (const x of this.q) n += (x.b || x.s).length; return n; } });
  HttpSock.prototype.send = function (data) {
    if (this.readyState !== OPEN) throw new Error('not open');
    this.q.push(typeof data === 'string' ? { s: data } : { b: b64(data) });
    if (!this.inflight && !this.soon) { this.soon = true; setTimeout(() => { this.soon = false; this.flush(); }, 0); } // one request for everything sent in this moment
  };
  HttpSock.prototype.flush = function () {
    if (this.inflight || !this.q.length || this.readyState !== OPEN) return;
    const batch = this.q.splice(0, 300); this.inflight = true;
    postJson('/arcade/versus/http/send', { sid: this.sid, m: batch }).then((r) => {
      this.inflight = false;
      if (!r || !r.ok) return this.dead();
      this.flush();
    }).catch(() => { this.inflight = false; this.q = batch.concat(this.q); if (++this.fails > 2) this.dead(); else setTimeout(() => this.flush(), 400); });
  };
  HttpSock.prototype.dead = function () { if (this.readyState === 3) return; this.readyState = 3; if (this.onclose) this.onclose(); };
  HttpSock.prototype.close = function () { if (this.readyState === 3) return; const sid = this.sid; this.readyState = 3; if (sid) postJson('/arcade/versus/http/close', { sid }).catch(() => {}); if (this.onclose) this.onclose(); };

  // Which way to connect: the WebSocket first; if it has not opened in 4 seconds (or fails before opening), HTTPS from then on
  // (remembered for an hour on this device, so the next visit goes straight there).
  const HTTP_KEY = 'mfl-vs-http', WS_WAIT = 4000;
  let useHttp = (() => { try { return Date.now() - (+localStorage.getItem(HTTP_KEY) || 0) < 3600e3; } catch (e) { return false; } })();
  function toHttp() { useHttp = true; try { localStorage.setItem(HTTP_KEY, String(Date.now())); } catch (e) {} }
  function wire(ws, onFirstFail) {
    let opened = false;
    const t = onFirstFail ? setTimeout(() => { if (!opened && ws === sock) { ws.onclose = null; try { ws.close(); } catch (e) {} sock = null; onFirstFail(); } }, WS_WAIT) : 0;
    ws.binaryType = 'arraybuffer';
    sock = ws;
    connecting = false;
    ws.onopen = () => {
      if (ws !== sock) return;
      opened = true; clearTimeout(t);
      retry = 0;
      setConn('');
      if (live && !live.over) { // back after a drop: rejoin the match, then send what queued up meanwhile
        sendRaw({ t: 'join', id: live.id });
        if (!live.engine) sendRaw({ t: 'ready', id: live.id });
        flushQueue();
      }
    };
    ws.onmessage = (e) => {
      if (ws !== sock) return;
      if (typeof e.data !== 'string') return frameIn(e.data);
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m && typeof m === 'object') onMsg(m);
    };
    ws.onclose = () => {
      clearTimeout(t);
      if (ws !== sock) return;
      sock = null;
      if (ws.loggedOut) { loggedOut = true; setConn('Log in again to play.'); return; }
      if (!opened && onFirstFail) return onFirstFail();
      later();
    };
    ws.onerror = () => {};
  }
  async function connect() {
    clearTimeout(retryTimer);
    if (connecting || loggedOut || (sock && sock.readyState <= OPEN)) return;
    connecting = true;
    setConn(retry ? 'Reconnecting…' : 'Connecting…');
    if (useHttp) return wire(new HttpSock(), null);
    let tok = null;
    try { const r = await fetch('/arcade/versus/token', { cache: 'no-store', credentials: 'same-origin' }); tok = await r.json(); } catch (e) {}
    if (tok && tok.ok === false) { connecting = false; loggedOut = true; setConn('Log in again to play.'); return; }
    if (!tok || !tok.ok) { connecting = false; return later(); }
    let ws;
    try { ws = new WebSocket(tok.ws + (tok.ws.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(tok.token)); } catch (e) { connecting = false; toHttp(); return connect(); }
    wire(ws, () => { toHttp(); retry = 0; connecting = false; connect(); }); // blocked or not answering: over HTTPS instead
  }
  function later() {
    clearTimeout(retryTimer);
    const wait = Math.min(15000, 700 * Math.pow(2, retry++)) * (0.75 + Math.random() * 0.5);
    setConn('Reconnecting…');
    retryTimer = setTimeout(connect, wait);
  }
  const kick = () => { if (!sock && !connecting && !loggedOut) { retry = 0; connect(); } };
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  function setConn(txt) {
    const el = $('vsConn');
    el.className = 'vs-conn' + (txt ? '' : ' ok');
    el.textContent = txt || 'Connected';
    const bar = $('vsConnBar');
    bar.hidden = !(txt && live && live.engine && !live.over);
    bar.textContent = txt || '';
  }

  // ---------- server messages ----------
  function onMsg(m) {
    switch (m.t) {
      case 'me': setBalance(m.balance); break;
      case 'online': online = Array.isArray(m.list) ? m.list : []; renderOnline(); syncForm(); break;
      case 'challenges': incoming = (m.incoming || []).map(stamp); outgoing = (m.outgoing || []).map(stamp)[0] || null; renderChallenges(); renderOnline(); break;
      case 'challenge': if (m.c) { incoming = incoming.filter((c) => c.id !== m.c.id).concat(stamp(m.c)); renderChallenges(); } break;
      case 'challenge-sent': if (m.c) { outgoing = stamp(m.c); closeForm(); renderChallenges(); renderOnline(); } break;
      case 'challenge-gone': challengeGone(m); break;
      case 'error': onError(m.msg || 'Something went wrong.'); break;
      case 'match': startMatch(m); break;
      case 'go': onGo(m); break;
      case 'ev': deliver(m.type, m.data); break;
      case 'opp-gone': case 'opp-back': sys(m); break;
      case 'over': onOver(m); break;
      case 'detached': onDetached(m); break;
      default:
    }
  }
  const stamp = (c) => ({ ...c, deadline: Date.now() + (c.left != null ? c.left : Math.max(0, c.exp - Date.now())) });
  const WHY = { declined: 'declined', expired: 'ran out of time', offline: 'went offline', busy: 'is in another match now', funds: 'is off: not enough coins', replaced: 'was replaced', cancelled: 'was called off', accepted: '', gone: '' };
  function challengeGone(m) {
    const was = outgoing && outgoing.id === m.id ? outgoing : null;
    const inc = incoming.find((c) => c.id === m.id);
    incoming = incoming.filter((c) => c.id !== m.id);
    if (was) outgoing = null;
    renderChallenges(); renderOnline();
    if (live || !WHY[m.why]) return;
    if (was && m.why !== 'replaced') note(m.why === 'declined' ? `@${was.to} declined your challenge.` : `Your challenge to @${was.to} ${WHY[m.why]}.`);
    else if (inc && m.why !== 'declined') note(`@${inc.from}'s challenge ${m.why === 'cancelled' ? 'was called off' : WHY[m.why]}.`);
  }
  function onError(msg) {
    if (formFor && sending) { sending = false; $('vsFormErr').textContent = msg; syncForm(); return; }
    if (live && !live.engine && !live.over) { $('vsWaitS').textContent = msg; return; }
    if (live) { console.warn('Head to Head:', msg); return; }
    note(msg, 'bad');
  }
  function note(txt, kind) {
    const el = $('vsNote');
    el.className = 'vs-note' + (kind ? ' ' + kind : '');
    el.textContent = txt || '';
  }
  function setBalance(n) {
    if (n == null || !Number.isFinite(+n)) return;
    balance = +n;
    document.querySelectorAll('[data-balance]').forEach((e) => { e.textContent = fmt(balance); });
  }

  // ---------- lobby ----------
  function renderOnline() {
    const busy = !!live;
    $('vsOnline').innerHTML = online.map((p) => {
      const idle = p.status === 'idle', asked = outgoing && outgoing.to === p.name;
      const btn = !idle || busy ? '' : asked ? '<button class="btn ghost sm" disabled>Challenged</button>' : `<button class="btn sm" type="button" data-ch="${esc(p.name)}">Challenge</button>`;
      return `<li><span class="vs-dot ${idle ? '' : 'playing'}"></span><b>@${esc(p.name)}</b><small>${idle ? 'Here now' : 'In a match'}</small>${btn}</li>`;
    }).join('');
    $('vsNobody').hidden = online.length > 0;
    $('vsCount').textContent = online.length ? `${online.length} online` : '';
  }
  function renderChallenges() {
    $('vsInCard').hidden = !incoming.length;
    $('vsIn').innerHTML = incoming.map((c) => {
      const short = c.wager > balance;
      return `<li><div class="vs-ch"><b>@${esc(c.from)}</b><small>${esc(terms(c.wager, c.qs))}${short ? ` · you have ${fmt(balance)}` : ''}</small></div><span class="vs-left" data-deadline="${c.deadline}">${clock(c.deadline - Date.now())}</span>
        <div class="vs-act"><button class="btn sm" type="button" data-acc="${esc(c.id)}" ${short || live ? 'disabled' : ''}>Accept</button><button class="btn ghost sm" type="button" data-dec="${esc(c.id)}">Decline</button></div></li>`;
    }).join('');
    $('vsOutCard').hidden = !outgoing;
    $('vsOut').innerHTML = outgoing ? `<li><div class="vs-ch"><b>Waiting for @${esc(outgoing.to)}</b><small>${esc(terms(outgoing.wager, outgoing.qs))}</small></div><span class="vs-left" data-deadline="${outgoing.deadline}">${clock(outgoing.deadline - Date.now())}</span>
      <button class="btn ghost sm" type="button" data-cancel="${esc(outgoing.id)}">Cancel</button></li>` : '';
    const n = incoming.length;
    document.title = (n ? `(${n}) ` : '') + document.title.replace(/^\(\d+\) /, '');
  }
  setInterval(() => { document.querySelectorAll('[data-deadline]').forEach((e) => { e.textContent = clock(+e.getAttribute('data-deadline') - Date.now()); }); }, 250);

  const WORD = { forfeit: (r) => (r.status === 'won' ? 'they quit' : r.by === ME ? 'you quit' : 'quit'), disconnect: (r) => (r.status === 'won' ? 'they left' : r.status === 'lost' ? 'you left' : 'connection lost'),
    tie: () => 'tie, wagers back', review: () => 'scores did not add up, wagers back', cancelled: () => 'called off', restart: () => 'server restart, wagers back', error: () => 'could not start' };
  function renderResults() {
    $('vsResults').innerHTML = results.map((r) => {
      const tag = r.status === 'won' ? 'W' : r.status === 'lost' ? 'L' : 'T';
      const day = /^\d{4}-\d\d-\d\d/.test(r.local || '') ? new Date(r.local.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
      const sc = r.me != null && r.them != null && r.status !== 'void' ? `${r.me}–${r.them}` : '';
      const why = WORD[r.reason] ? WORD[r.reason](r) : '';
      const coins = !r.wager ? '<span class="r muted">Friendly</span>' : r.status === 'void' ? '<span class="r muted">Refunded</span>' : `<span class="r ${r.net > 0 ? 'up' : 'down'}">${r.net > 0 ? '+' : ''}${fmt(r.net)}</span>`;
      return `<li><span class="res ${tag}">${r.status === 'void' ? '–' : tag}</span><div class="vs-ch"><b>vs @${esc(r.opp)}</b><small>${esc([sc, why, r.wager ? fmt(r.wager) + ' coins' : '', day].filter(Boolean).join(' · '))}</small></div>${coins}</li>`;
    }).join('');
    $('vsNoResults').hidden = results.length > 0;
  }
  async function loadResults() {
    try {
      const r = await (await fetch('/arcade/versus/results', { cache: 'no-store', credentials: 'same-origin' })).json();
      if (r && r.ok) { results = r.results || []; setBalance(r.balance); renderResults(); renderChallenges(); }
    } catch (e) {}
  }

  // challenge form (a small dialog, so lobby updates don't reset what you typed)
  function openForm(name) {
    formFor = name; sending = false;
    let o = $('vsModal');
    if (!o) { o = document.createElement('div'); o.id = 'vsModal'; o.className = 'arc-over'; document.body.appendChild(o); }
    o.innerHTML = `<div class="arc-over-in"><form class="vs-form" id="vsForm"><h2>Challenge</h2><p class="muted">@${esc(name)} gets a minute to accept.</p>
      <label>Wager (coins each)<input type="number" name="wager" min="0" max="${cfg.maxWager}" step="1" value="0" inputmode="numeric" autocomplete="off"></label>
      <small class="hint" id="vsWagerHint"></small>
      <div class="lbl">Quarter length</div>
      <div class="arc-modes">${cfg.qs.map((q) => `<label class="mode"><input type="radio" name="qs" value="${q}" ${q === 120 ? 'checked' : ''}><span>${q / 60} min</span></label>`).join('')}</div>
      <p class="err" id="vsFormErr"></p>
      <div class="arc-over-b"><button class="btn" type="submit" id="vsSend">Send challenge</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form></div>`;
    o.hidden = false;
    const f = $('vsForm');
    f.wager.addEventListener('input', syncForm);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const wager = Math.floor(+f.wager.value || 0);
      if (wager < 0 || wager > cfg.maxWager) { $('vsFormErr').textContent = `Pick 0 to ${fmt(cfg.maxWager)} coins.`; return; }
      if (wager > balance) { $('vsFormErr').textContent = `You have ${fmt(balance)} coins.`; return; }
      if (!sendRaw({ t: 'challenge', to: name, wager, qs: +f.qs.value })) { $('vsFormErr').textContent = 'Not connected. Trying again…'; kick(); return; }
      sending = true; $('vsFormErr').textContent = ''; syncForm();
    });
    o.querySelector('[data-close]').addEventListener('click', closeForm);
    o.addEventListener('click', (e) => { if (e.target === o) closeForm(); });
    syncForm();
    setTimeout(() => { try { f.wager.select(); } catch (e) {} }, 30);
  }
  function syncForm() {
    const f = $('vsForm');
    if (!formFor || !f) return;
    const p = online.find((x) => x.name === formFor), w = Math.floor(+f.wager.value || 0);
    $('vsWagerHint').textContent = (w ? `Winner takes ${fmt(w * 2)}.` : '0 = a friendly, no coins.') + ` You have ${fmt(balance)}.`;
    const gone = !p ? `@${formFor} left the lobby.` : p.status !== 'idle' ? `@${formFor} is in a match now.` : '';
    if (gone && !sending) $('vsFormErr').textContent = gone;
    $('vsSend').disabled = !!gone || sending;
    $('vsSend').textContent = sending ? 'Sending…' : 'Send challenge';
  }
  function closeForm() { formFor = null; sending = false; const o = $('vsModal'); if (o) { o.hidden = true; o.innerHTML = ''; } }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    const a = (k) => b.getAttribute(k);
    if (a('data-ch')) openForm(a('data-ch'));
    else if (a('data-acc')) { if (sendRaw({ t: 'accept', id: a('data-acc') })) { b.disabled = true; b.textContent = 'Starting…'; } else note('Not connected yet. Try again in a moment.', 'bad'); }
    else if (a('data-dec')) sendRaw({ t: 'decline', id: a('data-dec') });
    else if (a('data-cancel')) sendRaw({ t: 'cancel', id: a('data-cancel') });
  });

  // ---------- the match ----------
  function makeNet(m) {
    let onMessage = null, onFrame = null;
    const net = {
      matchId: m.id, me: { name: m.me.name }, opp: { name: m.opp.name }, recvFirst: !!m.recvFirst, wager: m.wager, qs: m.qs, seed: m.seed, resume: null,
      send(type, data) { if (live && live.net === net && !live.over) out({ t: 'ev', type, data }); },
      sendFrame(buf) { if (sock && sock.readyState === OPEN && live && live.net === net && !live.over) { try { sock.send(buf); } catch (e) {} } },
      get lag() { return sock && sock.http ? 420 : 140; }, // how far behind to play the other side's stream back (HTTPS arrives in batches)
      quit() { if (live && live.net === net && !live.over) out({ t: 'quit', id: m.id }); },
    };
    // anything that arrives before the engine is listening waits for it
    Object.defineProperty(net, 'onMessage', { enumerable: true, get: () => onMessage, set(f) { onMessage = f; if (typeof f === 'function') setTimeout(flushEarly, 0); } });
    Object.defineProperty(net, 'onFrame', { enumerable: true, get: () => onFrame, set(f) { onFrame = f; } });
    return net;
  }
  function deliver(type, data) {
    if (!live) return;
    const f = live.net.onMessage;
    if (typeof f !== 'function' || live.early.length) { if (live.early.length < 400) live.early.push([type, data]); return; }
    try { f(type, data); } catch (e) { console.error(e); }
  }
  function flushEarly() {
    if (!live) return;
    const f = live.net.onMessage;
    while (live && live.early.length && typeof f === 'function') { const [t, d] = live.early.shift(); try { f(t, d); } catch (e) { console.error(e); } }
  }
  function frameIn(buf) {
    if (!live || typeof live.net.onFrame !== 'function') return;
    try { live.net.onFrame(buf); } catch (e) { console.error(e); }
  }
  function sys(m) {
    if (!live || live.over) return;
    if (live.engine) return deliver('sys', m);
    if (m.t === 'opp-gone') $('vsWaitS').textContent = `@${live.m.opp.name} lost connection. Waiting up to ${m.secs || cfg.gone} seconds…`;
    else if (m.t === 'opp-back') $('vsWaitS').textContent = `@${live.m.opp.name} is back. Waiting for the game to load…`;
  }

  function startMatch(m) {
    if (live && live.id === m.id) return; // already on it
    if (live && !live.over) return;
    if (live) teardown();
    closeForm();
    note('');
    live = { id: m.id, m, net: makeNet(m), engine: false, resolved: false, over: null, queue: [], early: [] };
    const tm = (t, label) => `<span class="vs-tm" style="--c:${esc(t.color)};--c2:${esc(t.color2)}">${label}</span>`;
    const stage = $('vsStage');
    stage.innerHTML = `<div class="vs-stage-top" id="vsTop" hidden><button class="btn ghost sm" type="button" id="vsQuit">Quit match</button></div>
      <div class="card vs-wait" id="vsWait"><div class="kicker" style="justify-content:center">🆚 Head to Head</div>
        <div class="vs-vs">${tm(m.me.team, '@' + esc(m.me.name))}<i>vs</i>${tm(m.opp.team, '@' + esc(m.opp.name))}</div>
        <p class="muted">${esc(terms(m.wager, m.qs))}${m.wager ? ` · winner takes ${fmt(m.wager * 2)}` : ''} · ${m.recvFirst ? 'you receive the opening kickoff' : `@${esc(m.opp.name)} receives the opening kickoff`}</p>
        <h2 id="vsWaitT">Getting ready</h2><p class="muted" id="vsWaitS">Waiting for @${esc(m.opp.name)}…</p>
        <div class="arc-over-b"><button class="btn ghost" type="button" id="vsCancel">Call it off</button></div></div>`;
    stage.hidden = false;
    $('vsLobby').hidden = true;
    document.body.classList.add('arc-playing', 'vs-playing');
    $('vsCancel').addEventListener('click', () => { live.net.quit(); $('vsWaitS').textContent = 'Calling it off…'; $('vsCancel').disabled = true; });
    $('vsQuit').addEventListener('click', () => {
      if (!live || live.over) return;
      if (confirm(`Quit this match? It counts as a loss${live.m.wager ? ` and you lose ${fmt(live.m.wager)} coins` : ''}.`)) live.net.quit();
    });
    renderOnline(); renderChallenges();
    window.scrollTo(0, 0);
    sendRaw({ t: 'join', id: m.id });
    sendRaw({ t: 'ready', id: m.id }); // the game code is already on the page
  }
  function onGo(m) {
    if (!live || live.over) return;
    if (live.engine) return deliver('sys', m); // back after a drop: the engine picks up from the snapshot
    if (m.resume) live.net.resume = m.resume;
    launch();
  }
  function launch() {
    live.engine = true;
    $('vsWait').hidden = true;
    $('vsTop').hidden = false;
    const stage = $('vsStage');
    const root = document.createElement('div');
    root.className = 'arc-root';
    stage.appendChild(root);
    const toGame = () => { try { window.scrollTo(0, Math.max(0, stage.getBoundingClientRect().top + window.scrollY - 70)); } catch (e) {} };
    toGame(); setTimeout(toGame, 60); setTimeout(toGame, 400);
    const M = live.m, mine = live;
    let p;
    try {
      if (!window.MFLBlitz || !window.MFLBlitz.play) throw new Error('The game did not load. Refresh and try again.');
      p = window.MFLBlitz.play(root, { home: M.me.team, away: M.opp.team, versus: live.net, seed: M.seed, quarterSecs: M.qs, timeouts: 2, noTies: true, difficulty: 1, offense: 1, weather: 'night',
        label: `Head to Head · ${M.wager ? fmt(M.wager) + ' coins' : 'Friendly'}` });
    } catch (e) { console.error(e); p = Promise.resolve({ quit: true, error: String((e && e.message) || e) }); }
    Promise.resolve(p).then((r) => engineDone(mine, r), (e) => engineDone(mine, { quit: true, error: String(e) }));
  }
  function engineDone(mine, r) {
    if (live !== mine) return;
    live.resolved = true;
    if (live.over) return backToLobby();
    if (r && r.quit) live.net.quit(); // the engine already does this; harmless twice
    const wait = '<h2>Final</h2><p class="muted">Waiting for the result…</p>';
    showOverlay(wait, false);
    setTimeout(() => { if (live === mine && !live.over) showOverlay(wait + '<p class="muted sm">Taking a while. Your result is saved on the server either way.</p>', true); }, 20000);
  }
  function onOver(m) {
    if (!live || live.id !== m.id) { setBalance(m.balance); loadResults(); return; } // another tab's match
    if (live.over) return;
    live.over = m;
    setBalance(m.balance);
    setConn(sock && sock.readyState === OPEN ? '' : 'Reconnecting…');
    if (live.engine && !live.resolved) {
      deliver('sys', m); // the engine shows it in its final box; closing that box brings you back here
      live.barTimer = setTimeout(() => overBar(m), 6000);
      return;
    }
    if (live.resolved) return backToLobby();
    showOverlay(overHtml(m), true);
  }
  function onDetached(m) {
    if (!live || live.id !== m.id) return;
    live.over = live.over || { t: 'over', id: m.id, detached: true };
    if (live.engine && !live.resolved) { showOverlay('<h2>Moved</h2><p class="muted">This match is now being played in another tab.</p>', true); return; }
    backToLobby();
  }
  function overSummary(m) {
    const opp = Object.keys(m.score || {}).find((n) => n !== ME) || (live ? live.m.opp.name : ''), wager = m.wager != null ? m.wager : live ? live.m.wager : Math.abs(m.net || 0);
    const won = m.winner === ME, lost = !!m.winner && !won, sc = m.score || {};
    const title = won ? 'You win!' : lost ? 'You lost' : 'No contest';
    const score = sc[ME] != null && sc[opp] != null ? `${sc[ME]}–${sc[opp]}` : '';
    const why = { final: score ? (won ? `You beat @${opp} ${score}.` : `@${opp} won ${sc[opp]}–${sc[ME]}.`) : '', forfeit: won ? `@${opp} quit.` : 'You quit.', tie: `Tied ${score}: wagers back.`,
      disconnect: won ? `@${opp} lost connection.` : lost ? 'You lost connection.' : 'A connection dropped before kickoff.', cancelled: 'Called off before kickoff.', restart: 'The server restarted: wagers back.', review: 'The score reports did not add up, so nobody is paid: wagers back.', error: 'The match could not start.' }[m.reason] || '';
    const coins = m.net > 0 ? `+${fmt(m.net)} coins` : m.net < 0 ? `${fmt(m.net)} coins` : wager ? 'Wager back' : 'Friendly: no coins';
    return { title, why, coins, cls: m.net > 0 ? 'up' : m.net < 0 ? 'down' : '' };
  }
  function overHtml(m) {
    const s = overSummary(m);
    return `<h2>${esc(s.title)}</h2>${s.why ? `<p>${esc(s.why)}</p>` : ''}<p class="arc-coins ${s.cls}">${esc(s.coins)}</p>${m.balance != null ? `<p class="muted">Balance: ${fmt(m.balance)} coins</p>` : ''}`;
  }
  // over arrived but the engine is still on screen: a small bar on top of it with a way out
  function overBar(m) {
    if (!live || live.over !== m || live.resolved) return;
    const s = overSummary(m);
    let bar = $('vsOverBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'vsOverBar'; bar.className = 'vs-bar'; document.body.appendChild(bar); }
    bar.innerHTML = `<span>${esc(s.title)} · <span class="${s.cls}">${esc(s.coins)}</span></span><button class="btn sm" type="button">Continue</button>`;
    bar.hidden = false;
    bar.querySelector('button').addEventListener('click', backToLobby);
  }
  function showOverlay(html, withContinue) {
    let o = $('vsOver');
    if (!o) { o = document.createElement('div'); o.id = 'vsOver'; o.className = 'arc-over'; o.style.zIndex = '100002'; document.body.appendChild(o); }
    o.innerHTML = `<div class="arc-over-in">${html}${withContinue ? '<div class="arc-over-b"><button class="btn" type="button">Continue</button></div>' : ''}</div>`;
    o.hidden = false;
    if (withContinue) o.querySelector('button').addEventListener('click', backToLobby);
  }
  function backToLobby() {
    if (live && live.engine && !live.resolved) { // the engine has no off switch: a fresh page is the clean way out
      if (live.over && !live.over.detached) { try { sessionStorage.setItem('mfl-vs-note', JSON.stringify({ ...live.over, wager: live.m.wager })); } catch (e) {} }
      live = null;
      location.reload();
      return;
    }
    const m = live && live.over;
    teardown();
    if (m && !m.detached) noteOver(m);
    loadResults();
  }
  function noteOver(m) { const s = overSummary(m), dot = (t) => (t && !/[.!?:]$/.test(t) ? t + '.' : t); note([s.title, s.why, s.coins].filter(Boolean).map(dot).join(' '), s.cls === 'up' ? 'good' : s.cls === 'down' ? 'bad' : ''); }
  function teardown() {
    if (live) clearTimeout(live.barTimer);
    live = null;
    ['vsOver', 'vsOverBar'].forEach((id) => { const e = $(id); if (e) e.hidden = true; });
    const stage = $('vsStage');
    stage.hidden = true;
    stage.innerHTML = '';
    $('vsLobby').hidden = false;
    $('vsConnBar').hidden = true;
    document.body.classList.remove('arc-playing', 'vs-playing');
    renderOnline(); renderChallenges();
  }
  window.addEventListener('beforeunload', (e) => { if (live && !live.over) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- go ----------
  try { // the result of a match left by reloading the page
    const saved = JSON.parse(sessionStorage.getItem('mfl-vs-note') || 'null');
    sessionStorage.removeItem('mfl-vs-note');
    if (saved && saved.t === 'over') noteOver(saved);
  } catch (e) {}
  renderOnline(); renderChallenges(); renderResults();
  connect();
})();
