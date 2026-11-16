// The Head to Head connection for a lobby page (used by 3D Dunk's lobby; 3D Blitz keeps its own copy in versus.js).
// One connection per tab to this site's own address: a WebSocket at /ws/versus (token from /arcade/versus/token), or, where the
// site's address can't carry a WebSocket, the same messages over ordinary requests (/arcade/versus/http/*: a long poll brings the
// server's messages, batched POSTs carry ours). The page above it sees one object:
//
//   const conn = MFLVsNet.connect({ game: 'dunk3d', onStatus(txt), onOpen(again), onJson(m), onBin(buf), onLoggedOut() });
//   conn.sendJson(obj) -> bool    conn.sendBin(u8) -> bool    conn.connected    conn.http (true on the long-poll path)
//   conn.kick()  (try now if down)    conn.close()
//   MFLVsNet.engineNet(conn, { id, role, canSend() }) -> the `net` object the 3D Dunk engine wants in opts.h2h.net:
//        { send(x), onmessage, http }   x = Uint8Array (a snapshot / input frame) or a plain object with a `t` (JSON)
//
// Wire mapping between the engine and the server (versus.js): the engine's JSON messages travel as { t: 'g', m: x } and are relayed as they
// are to the other engine (which gets m); binary frames (snapshots, inputs) go through untouched. The engine's 'final' {hs, as, qtr} is
// not for the other engine: it goes to the server as { t: 'final', hs, as, qtr } (the score witness).
(function () {
  'use strict';
  const OPEN = 1;
  const b64 = (buf) => { const u = new Uint8Array(buf); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(t); };
  const unb64 = (t) => { const b = atob(t), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const postJson = (path, body) => fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then((r) => r.json());

  // Looks like a WebSocket to everything below (readyState, send, close, onopen / onmessage / onclose).
  function HttpSock(game) {
    this.http = true; this.readyState = 0; this.binaryType = 'arraybuffer'; this.q = []; this.inflight = false; this.sid = null; this.fails = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    postJson('/arcade/versus/http/open', { g: game }).then((r) => {
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
    const batch = this.q.splice(0, 400); this.inflight = true;
    postJson('/arcade/versus/http/send', { sid: this.sid, m: batch }).then((r) => {
      this.inflight = false;
      if (!r || !r.ok) return this.dead();
      this.flush();
    }).catch(() => { this.inflight = false; this.q = batch.concat(this.q); if (++this.fails > 2) this.dead(); else setTimeout(() => this.flush(), 400); });
  };
  HttpSock.prototype.dead = function () { if (this.readyState === 3) return; this.readyState = 3; if (this.onclose) this.onclose(); };
  HttpSock.prototype.close = function () { if (this.readyState === 3) return; const sid = this.sid; this.readyState = 3; if (sid) postJson('/arcade/versus/http/close', { sid }).catch(() => {}); if (this.onclose) this.onclose(); };

  // The WebSocket first; if it has not opened in 4 seconds (or fails before opening), ordinary requests from then on (remembered for an hour
  // on this device under the same key 3D Blitz's lobby uses, so one slow network is learned once).
  const HTTP_KEY = 'mfl-vs-http', WS_WAIT = 4000;

  function connect(o) {
    o = o || {};
    const game = o.game || 'dunk3d';
    const conn = { game, http: false, connected: false, rtt: null };
    let sock = null, retry = 0, retryTimer = null, connecting = false, loggedOut = false, everOpen = false, closed = false;
    let useHttp = (() => { try { return Date.now() - (+localStorage.getItem(HTTP_KEY) || 0) < 3600e3; } catch (e) { return false; } })();
    const toHttp = () => { useHttp = true; try { localStorage.setItem(HTTP_KEY, String(Date.now())); } catch (e) {} };
    const status = (t) => { if (o.onStatus) { try { o.onStatus(t); } catch (e) {} } };

    function sendRaw(x) {
      if (!sock || sock.readyState !== OPEN) return false;
      try { sock.send(typeof x === 'string' ? x : JSON.stringify(x)); return true; } catch (e) { return false; }
    }
    conn.sendJson = (x) => sendRaw(x);
    conn.sendBin = (u8) => {
      if (!sock || sock.readyState !== OPEN) return false;
      // a backed-up WebSocket drops snapshots and inputs (they are disposable: the next one replaces it)
      if (!sock.http && sock.bufferedAmount > 200 * 1024) return false;
      try { sock.send(u8); return true; } catch (e) { return false; }
    };
    Object.defineProperty(conn, 'connected', { get: () => !!sock && sock.readyState === OPEN });
    Object.defineProperty(conn, 'http', { get: () => !!(sock && sock.http) || (!sock && useHttp) });

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
        const again = everOpen; everOpen = true;
        sendRaw({ t: 'hello', game, cap: o.cap ? o.cap(conn.rtt) : undefined }); // (the game tag: this lobby only sees Dunk players and challenges; cap: what this device is, for the choice of who hosts)
        status('');
        if (o.onOpen) { try { o.onOpen(again); } catch (e) { console.error(e); } }
      };
      ws.onmessage = (e) => {
        if (ws !== sock) return;
        if (typeof e.data !== 'string') { if (o.onBin) { try { o.onBin(e.data); } catch (err) { console.error(err); } } return; }
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (!m || typeof m !== 'object') return;
        if (m.t === 'ping') { sendRaw({ t: 'pong', n: m.n }); return; } // (the server's own round-trip check)
        if (o.onJson) { try { o.onJson(m); } catch (err) { console.error(err); } }
      };
      ws.onclose = () => {
        clearTimeout(t);
        if (ws !== sock) return;
        sock = null;
        if (closed) return;
        if (o.onDown) { try { o.onDown(); } catch (e) {} }
        if (ws.loggedOut) { loggedOut = true; status('Log in again to play.'); if (o.onLoggedOut) o.onLoggedOut(); return; }
        if (!opened && onFirstFail) return onFirstFail();
        later();
      };
      ws.onerror = () => {};
    }
    async function go() {
      clearTimeout(retryTimer);
      if (closed || connecting || loggedOut || (sock && sock.readyState <= OPEN)) return;
      connecting = true;
      status(retry ? 'Reconnecting…' : 'Connecting…');
      if (useHttp) return wire(new HttpSock(game), null);
      let tok = null;
      const t0 = performance.now();
      try { const r = await fetch('/arcade/versus/token?g=' + encodeURIComponent(game), { cache: 'no-store', credentials: 'same-origin' }); tok = await r.json(); conn.rtt = Math.round(performance.now() - t0); } catch (e) {} // (one round trip to this site, for the host choice)
      if (tok && tok.ok === false) { connecting = false; loggedOut = true; status('Log in again to play.'); if (o.onLoggedOut) o.onLoggedOut(); return; }
      if (!tok || !tok.ok) { connecting = false; return later(); }
      let ws;
      // always this page's own address: the server only names the path
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + (String(tok.ws || '').charAt(0) === '/' ? tok.ws : '/ws/versus');
      try { ws = new WebSocket(url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(tok.token) + '&g=' + encodeURIComponent(game)); } catch (e) { connecting = false; toHttp(); return go(); }
      wire(ws, () => { toHttp(); retry = 0; connecting = false; go(); }); // no WebSocket here: ordinary requests instead
    }
    function later() {
      clearTimeout(retryTimer);
      if (closed) return;
      const wait = Math.min(15000, 700 * Math.pow(2, retry++)) * (0.75 + Math.random() * 0.5);
      status('Reconnecting…');
      retryTimer = setTimeout(go, wait);
    }
    conn.kick = () => { if (!sock && !connecting && !loggedOut && !closed) { retry = 0; go(); } };
    conn.close = () => { closed = true; clearTimeout(retryTimer); const s = sock; sock = null; if (s) { s.onclose = null; try { s.close(); } catch (e) {} } };
    window.addEventListener('online', conn.kick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) conn.kick(); });
    go();
    return conn;
  }

  // The `net` object for opts.h2h.net. Whatever arrives before the engine listens waits (in order); what the engine sends while the
  // connection is down is dropped (snapshots and inputs are replaced by the next one; the engine's own stall rules cover a long gap).
  function engineNet(conn, o) {
    let onmessage = null;
    const early = [];
    const net = {
      matchId: o.id, role: o.role,
      get http() { return !!conn.http; },
      send(x) {
        if (o.canSend && !o.canSend()) return;
        if (x && typeof x === 'object' && (x instanceof ArrayBuffer || ArrayBuffer.isView(x))) { conn.sendBin(x instanceof ArrayBuffer ? new Uint8Array(x) : x); return; }
        if (x && typeof x === 'object' && x.t === 'final') { conn.sendJson({ t: 'final', hs: x.hs | 0, as: x.as | 0, qtr: x.qtr | 0 }); return; }
        if (x && typeof x === 'object' && typeof x.t === 'string') conn.sendJson({ t: 'g', m: x });
      },
      // from the lobby: what came from the other end
      deliver(x) {
        if (typeof onmessage !== 'function') { if (early.length < 600) early.push(x); return; }
        try { onmessage(x); } catch (e) { console.error(e); }
      },
    };
    Object.defineProperty(net, 'onmessage', { enumerable: true, get: () => onmessage, set(f) { onmessage = f; if (typeof f === 'function') setTimeout(() => { while (early.length && typeof onmessage === 'function') { const x = early.shift(); try { onmessage(x); } catch (e) { console.error(e); } } }, 0); } });
    return net;
  }

  window.MFLVsNet = { connect, engineNet, HttpSock };
})();
