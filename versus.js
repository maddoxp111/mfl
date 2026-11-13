// Head to Head: 3D Blitz, one player against another, live. The lobby (who's online, challenges) and the match
// relay run over one connection per tab, always to the site's own address: a WebSocket at /ws/versus, or the same messages
// over ordinary requests (/arcade/versus/http/*) where the hosting in front of the site can't carry WebSockets. The page is
// /arcade/blitz3d/versus.
//
// Coins: accepting a challenge adds an 'open' 3D Blitz record to both players with the wager as its stake (an open
// record already counts its stake as spent, so that holds both wagers). The winner's record is 'won' and pays 2x the
// wager, the loser's is 'lost'; a void record gives the stake back. Matches live only in memory, so open Head to Head
// records with no live match (after a restart) are voided.
//
// Messages are JSON text frames { t, ... }; binary frames from a player go to the other player as they are.
//   client -> server: challenge { to, wager, qs, venue, big, touch } · decline { id } · cancel { id } · accept { id }
//                     join { id } · ready { id } · ev { type, data } · quit { id }
//   server -> client: me · online · challenges · challenge · challenge-sent · challenge-gone · error
//                     match · go · ev · opp-gone · opp-back · over · detached
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');

module.exports = function versus(app, h) {
  const { esc, icon, coins, layout, load, refresh, getDoc, putDoc, listDocs, userKey, currentUser, accountOf, survivorNow, pk, TZ, sign, assetUrl } = h;
  const envMs = (k, d) => (Number(process.env[k]) > 0 ? Number(process.env[k]) : d);
  const GONE_MS = envMs('VERSUS_GONE_MS', 60e3); // a player with no connection to a live match for this long forfeits
  const CHALLENGE_MS = envMs('VERSUS_CHALLENGE_MS', 60e3);
  const OFFLINE_MS = envMs('VERSUS_OFFLINE_MS', 4000); // grace before a user with no open tab counts as gone
  const SCAN_MS = envMs('VERSUS_SCAN_MS', 5000); // after start: void open records left by a restart
  const TOKEN_MS = 10 * 60e3;
  const QS = [60, 120, 180], MAX_WAGER = 10000000;
  // Where a match is played: The Stadium and Hancock Stadium (the stadium's rules), or Wildcat Blacktop ('metcalf': its house rules,
  // one game clock of 4 quarters' length, and the challenger's field size and two-hand touch settings, carried with the match).
  const VENUES = ['stadium', 'hancock', 'metcalf'];
  const metOpts = (venue, o) => (venue === 'metcalf' ? { big: !!(o && o.big), touch: !!(o && o.touch) } : {});
  const MAX_TEXT = 64 * 1024, MAX_FRAME = 256 * 1024, MAX_BUFFERED = 256 * 1024, RATE = { text: 40, bin: 60 };
  const WS_PATH = '/ws/versus', PAGE = '/arcade/blitz3d/versus';
  // Score guards (the game is played on the players' screens, so their reports are checked): only the side with the ball moves
  // the score; points come no faster than a touchdown and a two-point try; the game clock can't run faster than real time; and
  // the game is only over at the end of the 4th or in overtime. A report that breaks a rule is ignored and the match is marked:
  // a marked match pays nobody (both stakes back). VERSUS_LOOSE=1 turns the clock and end-of-game checks off for tests (games
  // there run at several times real speed).
  const LOOSE = process.env.VERSUS_LOOSE === '1', PTS_WIN_MS = 10e3, PTS_MAX = 8;
  const OPEN = 1;
  const hex = (n) => crypto.randomBytes(n).toString('hex');
  const fmt = (n) => Number(n).toLocaleString('en-US');

  // ---------- socket auth: name.exp.sig, signed with the cookie secret (own prefix) ----------
  function makeToken(name) {
    const exp = Date.now() + TOKEN_MS;
    return `${name}.${exp}.${sign('ws:' + name + ':' + exp)}`;
  }
  function tokenUser(t) {
    const [name, exp, sig, extra] = String(t || '').split('.');
    if (extra !== undefined || !name || !exp || !sig || !pk.validName(name) || !(Number(exp) > Date.now())) return null;
    const good = sign('ws:' + name + ':' + exp);
    return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? name : null;
  }
  // The login cookie works too, but only from this site's own pages.
  function cookieUser(req) {
    const origin = req.headers.origin;
    if (origin) { try { if (new URL(origin).host !== req.headers.host) return null; } catch { return null; } }
    return currentUser(req);
  }

  // ---------- state ----------
  const socks = new Map(); // name -> Set of open sockets (one per tab)
  const offTimers = new Map(); // name -> timer: no tab open, about to count as offline
  const challenges = new Map(); // id -> { id, from, to, wager, qs, exp, timer, fromWs }
  const matches = new Map(); // id -> live match
  const ended = new Map(); // id -> finished match (kept a while so a late join still gets 'over')
  const playing = new Map(); // name -> live match
  const busy = new Set(); // names being put into a match right now

  const send = (ws, msg) => { if (ws && ws.readyState === OPEN) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } };
  const toUser = (name, msg) => { const s = socks.get(name); if (s) for (const ws of s) send(ws, msg); };
  const hasTab = (name) => (socks.get(name)?.size || 0) > 0;
  const isOnline = (name) => hasTab(name) || offTimers.has(name);
  const otherOf = (M, name) => (M.players[0] === name ? M.players[1] : M.players[0]);
  const err = (ws, msg) => send(ws, { t: 'error', msg });

  // One write at a time per user doc (from this module), so a refund and a new match can't overwrite each other.
  const locks = new Map();
  function withLock(name, fn) {
    const run = (locks.get(name) || Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => {});
    locks.set(name, tail);
    tail.then(() => { if (locks.get(name) === tail) locks.delete(name); });
    return run;
  }

  async function balanceOf(user, svState) {
    await refresh();
    const db = load();
    return accountOf(db, user, svState || await survivorNow(db)).balance;
  }

  // ---------- presence ----------
  function onlineList(except) {
    const names = new Set([...socks.keys(), ...offTimers.keys()]);
    return [...names].filter((n) => n !== except && isOnline(n)).map((name) => ({ name, status: playing.has(name) ? 'playing' : 'idle' }))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'idle' ? -1 : 1));
  }
  function broadcastOnline(skip) {
    for (const [name, set] of socks) { if (name === skip) continue; const msg = { t: 'online', list: onlineList(name) }; for (const ws of set) send(ws, msg); }
  }

  // ---------- challenges ----------
  const pub = (c) => ({ id: c.id, from: c.from, to: c.to, wager: c.wager, qs: c.qs, venue: c.venue || 'stadium', ...metOpts(c.venue, c), exp: c.exp, left: Math.max(0, c.exp - Date.now()) });
  const challengesOf = (name) => {
    const all = [...challenges.values()];
    return { incoming: all.filter((c) => c.to === name).map(pub), outgoing: all.filter((c) => c.from === name).map(pub) };
  };
  function dropChallenge(c, why) {
    if (challenges.get(c.id) !== c) return;
    challenges.delete(c.id);
    clearTimeout(c.timer);
    const msg = { t: 'challenge-gone', id: c.id, why };
    toUser(c.from, msg);
    toUser(c.to, msg);
  }
  const dropChallengesOf = (name, why) => { for (const c of [...challenges.values()]) if (c.from === name || c.to === name) dropChallenge(c, why); };

  async function onChallenge(ws, name, msg) {
    const to = String(msg.to || '').trim().toLowerCase().replace(/^@/, '');
    const wager = msg.wager == null || msg.wager === '' ? 0 : Number(msg.wager);
    const qs = QS.includes(Number(msg.qs)) ? Number(msg.qs) : 120;
    const venue = VENUES.includes(msg.venue) ? msg.venue : 'stadium';
    if (to === name) return err(ws, "You can't challenge yourself.");
    if (!pk.validName(to)) return err(ws, 'Pick a player to challenge.');
    if (!Number.isInteger(wager) || wager < 0 || wager > MAX_WAGER) return err(ws, `A wager is a whole number of coins from 0 to ${fmt(MAX_WAGER)}.`);
    const check = () => (!hasTab(to) ? `@${to} is not online.` : playing.has(to) || busy.has(to) ? `@${to} is in a match right now.` : playing.has(name) || busy.has(name) ? 'Finish your match first.' : null);
    if (check()) return err(ws, check());
    if (wager > 0) {
      const user = await getDoc(userKey(name), { fresh: true });
      const bal = user ? await balanceOf(user) : 0;
      if (bal < wager) return err(ws, `You have ${fmt(bal)} coins, not enough for a ${fmt(wager)}-coin wager.`);
      if (check()) return err(ws, check());
    }
    for (const old of [...challenges.values()]) if (old.from === name) dropChallenge(old, 'replaced');
    const c = { id: hex(6), from: name, to, wager, qs, venue, ...metOpts(venue, { big: msg.big === true, touch: msg.touch === true }), exp: Date.now() + CHALLENGE_MS, fromWs: ws };
    c.timer = setTimeout(() => dropChallenge(c, 'expired'), CHALLENGE_MS);
    challenges.set(c.id, c);
    toUser(to, { t: 'challenge', c: pub(c) });
    toUser(name, { t: 'challenge-sent', c: pub(c) });
  }
  function onDecline(ws, name, id, mine, why) {
    const c = challenges.get(String(id || ''));
    if (!c || c[mine] !== name) return send(ws, { t: 'challenge-gone', id: String(id || ''), why: 'gone' });
    dropChallenge(c, why);
  }

  // ---------- teams ----------
  const rgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const near = (a, b) => { const x = rgb(a), y = rgb(b); return !!x && !!y && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110; };
  const abbrOf = (name) => { const l = name.replace(/[^a-z]/gi, ''); return (l.length >= 2 ? l : name.replace(/_/g, '')).slice(0, 3).toUpperCase() || 'MFL'; };
  // Each side: the user's Lineup (or the default real team), named after the user, in its first player's colors.
  function teamsFor(db, ua, ub) {
    const mk = (u, fb) => {
      const players = (h.blitzData(db, u).players || []).filter(Boolean);
      const p0 = players[0] || {};
      return { name: u.name, abbr: abbrOf(u.name), color: rgb(p0.color) ? p0.color : fb[0], color2: rgb(p0.color2) ? p0.color2 : fb[1], players };
    };
    const A = mk(ua, ['#ffc21a', '#1b1e27']), B = mk(ub, ['#c8102e', '#f2f4f7']);
    if (B.abbr === A.abbr) {
      const l = ub.name.replace(/[^a-z0-9]/gi, '').toUpperCase();
      B.abbr = (l.slice(0, 2) + l.slice(-1)) !== A.abbr ? l.slice(0, 2) + l.slice(-1) : A.abbr.slice(0, 2) + '2';
    }
    // Same colors on both sides (two gold Lineups, or two players on the default team): the second side changes.
    if (near(A.color, B.color)) {
      const alt = [['#c8102e', '#f2f4f7'], ['#1d4ed8', '#f2f4f7'], ['#16a34a', '#f2f4f7'], ['#f2f4f7', '#15171d']].find(([c]) => !near(c, A.color));
      B.color = alt[0]; B.color2 = alt[1];
      B.players = B.players.map((p) => ({ ...p, color: B.color, color2: B.color2 }));
    }
    return { [ua.name]: A, [ub.name]: B };
  }

  // ---------- matches ----------
  function matchMsg(M, name, extra) {
    const other = otherOf(M, name);
    return { t: 'match', id: M.id, wager: M.wager, qs: M.qs, venue: M.venue || 'stadium', ...metOpts(M.venue, M), seed: M.seed, recvFirst: M.recvFirst === name, me: { name, team: M.teams[name] }, opp: { name: other, team: M.teams[other] }, ...(extra || {}) };
  }
  // The latest tracked state, as the given player sees it (pre/hand data are as their sender sent them).
  function snapshot(M, name) {
    const other = otherOf(M, name), pov = (who) => (who == null ? null : who === name ? 'me' : 'opp');
    return { me: M.score[name], opp: M.score[other], qtr: M.qtr, clock: M.clock, ball: pov(M.poss), st: M.st, stBy: pov(M.stBy), pre: M.pre, preBy: pov(M.preBy), hand: M.hand, handBy: pov(M.handBy) };
  }

  async function onAccept(ws, name, id) {
    const c = challenges.get(String(id || ''));
    if (!c || c.to !== name) { send(ws, { t: 'challenge-gone', id: String(id || ''), why: 'gone' }); return err(ws, 'That challenge is no longer open.'); }
    if (c.exp <= Date.now()) { dropChallenge(c, 'expired'); return err(ws, 'That challenge expired.'); }
    if (!hasTab(c.from)) { dropChallenge(c, 'offline'); return err(ws, `@${c.from} is not online any more.`); }
    if (playing.has(name) || busy.has(name)) return err(ws, 'Finish your match first.');
    if (playing.has(c.from) || busy.has(c.from)) return err(ws, `@${c.from} is in a match right now.`);
    challenges.delete(c.id);
    clearTimeout(c.timer);
    const pair = [c.from, c.to];
    pair.forEach((n) => busy.add(n));
    let M = null;
    try {
      const [first, second] = [...pair].sort();
      await withLock(first, () => withLock(second, async () => {
        await refresh();
        const db = load();
        const [ua, ub] = await Promise.all(pair.map((n) => getDoc(userKey(n), { fresh: true })));
        if (!ua || !ub) { const gone = { t: 'challenge-gone', id: c.id, why: 'gone' }; toUser(c.from, gone); toUser(c.to, gone); return err(ws, 'That account was not found.'); }
        if (c.wager > 0) {
          const svState = await survivorNow(db);
          const short = [];
          for (const u of [ua, ub]) if (accountOf(db, u, svState).balance < c.wager) short.push('@' + u.name);
          if (short.length) {
            const msg = { t: 'error', msg: `${short.join(' and ')} ${short.length > 1 ? "don't" : "doesn't"} have ${fmt(c.wager)} coins any more, so the challenge is off.` };
            const gone = { t: 'challenge-gone', id: c.id, why: 'funds' };
            for (const n of pair) { toUser(n, msg); toUser(n, gone); }
            return;
          }
        }
        M = {
          id: hex(8), seed: hex(8), wager: c.wager, qs: c.qs, venue: c.venue || 'stadium', ...metOpts(c.venue, c), players: [...pair], recvFirst: pair[crypto.randomInt(2)],
          rec: { [c.from]: hex(6), [c.to]: hex(6) }, teams: teamsFor(db, ua, ub),
          sock: { [c.from]: null, [c.to]: null }, ready: new Set(), started: false, over: false, gone: {},
          score: { [c.from]: 0, [c.to]: 0 }, pts: {}, clockAt: 0, flagged: 0, qtr: 1, clock: c.venue === 'metcalf' ? c.qs * 4 : c.qs, st: null, stBy: null, poss: null, pre: null, preBy: null, hand: null, handBy: null, created: Date.now(),
        };
        matches.set(M.id, M); // before the records are written, so nothing voids them as left over
        for (const n of pair) playing.set(n, M);
        const at = new Date().toISOString(), local = pk.nowLocal(TZ);
        for (const u of [ua, ub]) {
          u.arcade = u.arcade || [];
          u.arcade.push({ id: M.rec[u.name], game: 'blitz3d', level: 3, risk: false, stake: c.wager, seed: M.seed, at, local, status: 'open', payout: 0, versus: { id: M.id, opp: otherOf(M, u.name), wager: c.wager, qs: c.qs, ...(M.venue !== 'stadium' ? { venue: M.venue, ...metOpts(M.venue, M) } : {}) } });
          if (u.arcade.length > 600) u.arcade = u.arcade.slice(-600);
        }
        await putDoc(userKey(ua.name), ua);
        await putDoc(userKey(ub.name), ub);
      }));
    } catch (e) {
      console.error('versus: could not start a match', e);
      const msg = { t: 'error', msg: 'Could not start the match. Try again.' };
      for (const n of pair) toUser(n, msg);
      if (M) { pair.forEach((n) => busy.delete(n)); await settle(M, null, 'error'); }
      return;
    } finally {
      pair.forEach((n) => busy.delete(n));
    }
    if (!M) return;
    // Both have a minute to load the game and say they're ready, like a dropped connection.
    for (const n of M.players) startGone(M, n, false);
    const fromWs = c.fromWs && c.fromWs.readyState === OPEN ? c.fromWs : [...(socks.get(c.from) || [])].pop();
    send(fromWs, matchMsg(M, c.from));
    send(ws.readyState === OPEN ? ws : [...(socks.get(c.to) || [])].pop(), matchMsg(M, c.to));
    const gone = { t: 'challenge-gone', id: c.id, why: 'accepted' };
    for (const n of pair) { toUser(n, gone); dropChallengesOf(n, 'busy'); }
    console.log(`versus: match ${M.id} @${c.from} vs @${c.to}, wager ${c.wager}, ${c.qs}s quarters${M.venue !== 'stadium' ? ', at ' + M.venue + (M.big ? ' (big field)' : '') + (M.touch ? ' (touch)' : '') : ''}`);
    broadcastOnline();
  }

  function startGone(M, name, tell) {
    if (M.over || M.gone[name]) return;
    M.gone[name] = { tell, timer: setTimeout(() => goneOut(M, name), GONE_MS) };
    if (tell) send(M.sock[otherOf(M, name)], { t: 'opp-gone', secs: Math.round(GONE_MS / 1000) });
  }
  function clearGone(M, name) {
    const g = M.gone[name];
    if (!g) return false;
    clearTimeout(g.timer);
    delete M.gone[name];
    return g.tell;
  }
  function goneOut(M, name) {
    if (M.over || !M.gone[name]) return;
    delete M.gone[name];
    const other = otherOf(M, name);
    // Before kickoff, or both players gone: nobody loses.
    if (!M.started || M.gone[other] || !M.sock[other]) return settle(M, null, 'disconnect', name);
    settle(M, other, 'disconnect', name);
  }
  function maybeStart(M) {
    if (M.started || M.over || M.ready.size < 2 || !M.players.every((p) => M.sock[p])) return;
    M.started = true;
    M.goAt = Date.now();
    for (const p of M.players) send(M.sock[p], { t: 'go' });
  }

  function onJoin(ws, name, id) {
    const M = matches.get(String(id || ''));
    if (!M || !M.players.includes(name)) {
      const E = ended.get(String(id || ''));
      if (E && E.overMsg && E.overMsg[name]) return send(ws, E.overMsg[name]);
      return err(ws, 'That match is over.');
    }
    if (M.over) return; // settling: 'over' is on its way
    const prev = M.sock[name];
    if (prev === ws) return maybeStart(M);
    if (prev) { prev.matchId = null; send(prev, { t: 'detached', id: M.id }); }
    M.sock[name] = ws;
    ws.matchId = M.id;
    const told = clearGone(M, name);
    const other = otherOf(M, name);
    if (M.started) {
      send(ws, { t: 'go', resume: snapshot(M, name) });
      send(M.sock[other], { t: 'opp-back' });
    } else {
      if (told) send(M.sock[other], { t: 'opp-back' });
      maybeStart(M);
    }
  }
  function onReady(ws, name, id) {
    const M = matches.get(String(id || ''));
    if (!M || M.over || !M.players.includes(name)) return;
    if (M.sock[name] !== ws) onJoin(ws, name, id);
    if (M.started || M.sock[name] !== ws) return;
    M.ready.add(name);
    maybeStart(M);
  }

  // Keep score, quarter, clock and the ball from what the players send ('st' is from the sender's side).
  let badLogs = 0;
  function track(M, name, type, data) {
    const other = otherOf(M, name);
    const st = data && typeof data === 'object' ? data.st : null;
    if (st && typeof st === 'object') {
      const me = Number(st.me), opp = Number(st.opp), now = Date.now();
      const ok = (v, cur) => Number.isInteger(v) && v >= cur && v - cur <= 8;
      // pace: no player scores more than a touchdown and a try's worth of points in a short window
      const pace = (p, v) => { if (v <= M.score[p]) return true; const w = (M.pts[p] || []).filter((x) => now - x.t < PTS_WIN_MS); return w.reduce((a, x) => a + x.n, 0) + (v - M.score[p]) <= PTS_MAX; };
      // clock: the game clock can't have run more than the real time since the last report (plus a little slack). Wildcat Blacktop
      // has one clock for the whole game (4 quarters' worth, counting down; its quarter is only which stretch of it this is) until
      // overtime, which has quarters like the stadium's.
      const q = Number(st.qtr), c = Number(st.clock), one = M.venue === 'metcalf' && q <= 4;
      const ran = Number.isFinite(q) && Number.isFinite(c) && M.clockAt ? (one ? M.clock - c : (q - M.qtr) * M.qs + (M.clock - c)) : 0;
      const clockOk = LOOSE || !M.clockAt || !Number.isFinite(q) || (q >= M.qtr && (one || q - M.qtr <= 1) && ran <= (now - M.clockAt) / 1000 * 1.15 + 3);
      const turnOk = M.poss == null || M.poss === name;
      if (ok(me, M.score[name]) && ok(opp, M.score[other]) && turnOk && clockOk && pace(name, me) && pace(other, opp)) {
        for (const [p, v] of [[name, me], [other, opp]]) if (v > M.score[p]) (M.pts[p] = (M.pts[p] || []).filter((x) => now - x.t < PTS_WIN_MS)).push({ t: now, n: v - M.score[p] });
        M.clockAt = now;
        M.score[name] = me;
        M.score[other] = opp;
        if (Number.isFinite(Number(st.qtr))) M.qtr = Math.max(0, Math.min(99, Math.round(Number(st.qtr))));
        if (Number.isFinite(Number(st.clock))) M.clock = Math.max(0, Math.min(3600, Number(st.clock)));
        M.st = st;
        M.stBy = name;
      } else {
        M.flagged = (M.flagged || 0) + 1;
        if (badLogs++ < 200) console.warn(`versus ${M.id}: ignored a report from @${name} (${type}): ${JSON.stringify({ me: st.me, opp: st.opp, qtr: st.qtr, clock: st.clock })}, have ${M.score[name]}-${M.score[other]} q${M.qtr} ${M.clock}, ball @${M.poss}`);
      }
    }
    if (type === 'pre') { M.poss = name; M.pre = data == null ? null : data; M.preBy = name; M.hand = null; M.handBy = null; }
    else if (type === 'hand') { M.poss = other; M.hand = data == null ? null : data; M.handBy = name; }
    else if (type === 'kick') M.poss = other; // the kicking side gives the ball away with the kick (after its own report is checked)
  }
  function onEv(ws, name, msg) {
    const M = ws.matchId && matches.get(ws.matchId);
    if (!M || M.over || M.sock[name] !== ws) return;
    const type = String(msg.type == null ? '' : msg.type).slice(0, 40);
    track(M, name, type, msg.data);
    send(M.sock[otherOf(M, name)], { t: 'ev', type, data: msg.data === undefined ? null : msg.data });
    if (type === 'final') {
      // over only at the end of the 4th or in overtime, called by the side with the ball
      const st = msg.data && msg.data.st, endOk = LOOSE || (M.qtr >= 5 || (M.qtr >= 4 && M.clock <= 1));
      if (!endOk || (M.poss != null && M.poss !== name)) { M.flagged = (M.flagged || 0) + 1; console.warn(`versus ${M.id}: early or out-of-turn final from @${name} (q${M.qtr} ${M.clock}, ball @${M.poss})`, st && JSON.stringify(st)); return; }
      const [a, b] = M.players;
      if (M.flagged) settle(M, null, 'review', name); // a report broke the rules somewhere: nobody is paid, both stakes come back
      else if (M.score[a] === M.score[b]) settle(M, null, 'tie', name);
      else settle(M, M.score[a] > M.score[b] ? a : b, 'final', name);
    }
  }
  function onQuit(ws, name, id) {
    const M = matches.get(String(id || '')) || playing.get(name);
    if (!M || M.over || !M.players.includes(name)) return;
    if (!M.started) return settle(M, null, 'cancelled', name);
    settle(M, otherOf(M, name), 'forfeit', name);
  }

  // Pay out: the winner's record 'won' (2x the wager), the loser's 'lost'; no winner = both void (stakes back).
  async function settle(M, winner, reason, by) {
    if (M.over) return;
    M.over = true;
    M.endedAt = new Date().toISOString();
    for (const p of M.players) { clearGone(M, p); if (playing.get(p) === M) playing.delete(p); }
    matches.delete(M.id);
    M.overMsg = {};
    ended.set(M.id, M);
    setTimeout(() => ended.delete(M.id), 10 * 60e3).unref?.();
    broadcastOnline();
    const status = (p) => (winner == null ? 'void' : winner === p ? 'won' : 'lost');
    const balance = {};
    for (const p of M.players) {
      try {
        await withLock(p, async () => {
          const u = await getDoc(userKey(p), { fresh: true });
          const r = u && (u.arcade || []).find((x) => x.id === M.rec[p]);
          if (r && (r.status === 'open' || (r.status === 'lost' && r.forfeit))) {
            const other = otherOf(M, p);
            r.status = status(p);
            r.payout = r.status === 'won' ? 2 * M.wager : 0;
            r.score = M.score[p];
            r.stats = { opp: M.score[other] };
            delete r.forfeit;
            if (reason === 'tie') r.tie = true;
            if (by === p && (reason === 'forfeit' || reason === 'cancelled')) r.quit = true;
            if (M.goAt) r.secs = Math.round((Date.now() - M.goAt) / 1000);
            r.versus = { ...(r.versus || {}), id: M.id, opp: other, wager: M.wager, qs: M.qs, reason, endedAt: M.endedAt, ...(by ? { by } : {}) };
            await putDoc(userKey(p), u);
          } else console.warn(`versus ${M.id}: @${p}'s record ${M.rec[p]} is ${r ? r.status : 'missing'}, left as it is`);
          balance[p] = u ? await balanceOf(u) : null;
        });
      } catch (e) { console.error(`versus ${M.id}: could not settle @${p}`, e); balance[p] = null; }
    }
    const score = Object.fromEntries(M.players.map((p) => [p, M.score[p]]));
    for (const p of M.players) {
      const s = status(p);
      M.overMsg[p] = { t: 'over', id: M.id, winner: winner || null, reason, by: by || null, score, payout: s === 'won' ? 2 * M.wager : s === 'void' ? M.wager : 0, net: s === 'won' ? M.wager : s === 'lost' ? -M.wager : 0, balance: balance[p] };
      toUser(p, M.overMsg[p]);
    }
    console.log(`versus: match ${M.id} over (${reason}): ${M.players.map((p) => `@${p} ${M.score[p]}`).join(', ')}${winner ? `, @${winner} wins ${M.wager}` : ', void'}`);
  }

  // Open Head to Head records with no live match (the server restarted mid-game, or a crash): void, stakes back.
  async function voidLeftovers(name) {
    return withLock(name, async () => {
      const u = await getDoc(userKey(name), { fresh: true });
      let n = 0;
      for (const r of (u && u.arcade) || []) {
        if (!r.versus || r.status !== 'open' || matches.has(r.versus.id)) continue;
        r.status = 'void';
        r.payout = 0;
        r.versus = { ...r.versus, reason: 'restart', endedAt: new Date().toISOString() };
        n++;
      }
      if (n) { await putDoc(userKey(name), u); console.log(`versus: voided ${n} left-over match record(s) for @${name}`); }
      return u;
    });
  }
  async function scanLeftovers() {
    try {
      const users = await listDocs('users/');
      for (const u of users) if ((u.arcade || []).some((r) => r.versus && r.status === 'open' && !matches.has(r.versus.id))) await voidLeftovers(u.name);
    } catch (e) { console.error('versus: restart scan failed', e); }
  }

  // ---------- connections ----------
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME, perMessageDeflate: false });
  async function onConnect(ws, name) {
    ws.user = name;
    ws.matchId = null;
    ws.alive = true;
    ws.rate = { at: 0, text: 0, bin: 0 };
    const wasOnline = isOnline(name);
    if (offTimers.has(name)) { clearTimeout(offTimers.get(name)); offTimers.delete(name); }
    if (!socks.has(name)) socks.set(name, new Set());
    socks.get(name).add(ws);
    ws.on('message', (data, isBinary) => { try { onMessage(ws, data, isBinary); } catch (e) { console.error('versus message', e); } });
    ws.on('close', () => onClose(ws));
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    try {
      const user = await voidLeftovers(name);
      if (!user) { err(ws, 'Account not found.'); return ws.close(4001, 'no account'); }
      const balance = await balanceOf(user);
      if (ws.readyState !== OPEN) return;
      send(ws, { t: 'me', name, balance });
      send(ws, { t: 'online', list: onlineList(name) });
      send(ws, { t: 'challenges', ...challengesOf(name) });
      // A reloaded page gets its live match back (unless another tab is playing it).
      const M = playing.get(name);
      if (M && !M.over && !(M.sock[name] && M.sock[name].readyState === OPEN)) send(ws, matchMsg(M, name, { rejoin: true }));
    } catch (e) {
      console.error('versus: hello failed', e);
      err(ws, 'Could not load your account.');
      return ws.close(1011, 'error');
    }
    if (!wasOnline) broadcastOnline(name); // (this user just got its own list)
  }
  function onClose(ws) {
    const name = ws.user, set = socks.get(name);
    if (set) { set.delete(ws); if (!set.size) socks.delete(name); }
    const M = ws.matchId && matches.get(ws.matchId);
    if (M && !M.over && M.sock[name] === ws) {
      M.sock[name] = null;
      if (!M.started) M.ready.delete(name);
      startGone(M, name, true);
    }
    if (!hasTab(name) && !offTimers.has(name)) {
      offTimers.set(name, setTimeout(() => {
        offTimers.delete(name);
        if (hasTab(name)) return;
        dropChallengesOf(name, 'offline');
        broadcastOnline();
      }, OFFLINE_MS));
    }
  }
  let dropped = 0, droppedAt = 0;
  const drop = (why) => { dropped++; if (Date.now() - droppedAt > 60e3) { console.warn(`versus: dropped ${dropped} message(s) in the last minute (latest: ${why})`); dropped = 0; droppedAt = Date.now(); } };
  function onMessage(ws, data, isBinary) {
    const now = Date.now(), r = ws.rate;
    if (now - r.at >= 1000) { r.at = now; r.text = 0; r.bin = 0; }
    const name = ws.user;
    if (isBinary) {
      if (++r.bin > RATE.bin) return drop('binary rate');
      const M = ws.matchId && matches.get(ws.matchId);
      if (!M || M.over || M.sock[name] !== ws) return;
      const to = M.sock[otherOf(M, name)];
      if (!to || to.readyState !== OPEN) return;
      if (to.bufferedAmount > MAX_BUFFERED) return drop('receiver backed up');
      to.send(data, { binary: true });
      return;
    }
    if (++r.text > RATE.text) return drop('text rate');
    if (data.length > MAX_TEXT) return drop('text too big');
    let msg;
    try { msg = JSON.parse(data.toString('utf8')); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const fail = (e) => { console.error('versus', msg.t, e); err(ws, 'Something went wrong. Try again.'); };
    switch (msg.t) {
      case 'challenge': return onChallenge(ws, name, msg).catch(fail);
      case 'decline': return onDecline(ws, name, msg.id, 'to', 'declined');
      case 'cancel': return onDecline(ws, name, msg.id, 'from', 'cancelled');
      case 'accept': return onAccept(ws, name, msg.id).catch(fail);
      case 'join': return onJoin(ws, name, msg.id);
      case 'ready': return onReady(ws, name, msg.id);
      case 'ev': return onEv(ws, name, msg);
      case 'quit': return onQuit(ws, name, msg.id);
      default:
    }
  }

  let attached = 0;
  function attach(server) {
    if (!server || typeof server.on !== 'function') return;
    server.on('upgrade', (req, socket, head) => {
      let url;
      try { url = new URL(req.url, 'http://localhost'); } catch { url = null; }
      if (!url || url.pathname !== WS_PATH) {
        if (server.listenerCount('upgrade') <= 1) socket.destroy();
        return;
      }
      const name = tokenUser(url.searchParams.get('t')) || cookieUser(req);
      if (!name) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => onConnect(ws, name));
    });
    if (attached++) return;
    // Ping every socket: dead ones get closed (which starts the disconnect clock), and proxies keep idle ones open.
    setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.alive) { ws.terminate(); continue; }
        ws.alive = false;
        try { ws.ping(); } catch (e) {}
      }
    }, 25e3).unref();
    setTimeout(scanLeftovers, SCAN_MS).unref();
  }

  const json = (res, o) => res.set('Cache-Control', 'no-store').json(o);
  // ---------- the same connection over ordinary requests ----------
  // Where the site's own address can't carry a WebSocket (some hosting set-ups in front of this server can't), the page talks to this
  // same server over ordinary requests on that address instead: a long poll brings the server's messages (it answers at once
  // when something is waiting, otherwise after HTTP_HOLD), and batched POSTs carry the page's. An
  // HttpSock behaves like a ws socket (send, close, readyState, bufferedAmount, 'message' and 'close' events), so everything above
  // treats both kinds the same. Binary frames travel as base64. A session with no poll for HTTP_IDLE is closed (which starts the
  // usual disconnect clock).
  const HTTP_HOLD = envMs('VERSUS_HTTP_HOLD_MS', 8000), HTTP_IDLE = envMs('VERSUS_HTTP_IDLE_MS', 30000), HTTP_MAX_Q = 2e6;
  const hsocks = new Map();
  class HttpSock extends EventEmitter {
    constructor(name) { super(); this.sid = hex(16); this.name = name; this.readyState = OPEN; this.q = []; this.qBytes = 0; this.waiter = null; this.seen = Date.now(); this.http = true; }
    get bufferedAmount() { return this.qBytes; }
    send(data) {
      if (this.readyState !== OPEN) return;
      const bin = typeof data !== 'string';
      const item = bin ? { b: Buffer.from(data).toString('base64') } : { s: data }, n = (item.b || item.s).length;
      if (bin && this.qBytes + n > HTTP_MAX_Q) return; // far behind: drop picture frames, never messages
      this.q.push(item); this.qBytes += n; this.flush();
    }
    flush() {
      if (!this.waiter || !this.q.length) return;
      const w = this.waiter; this.waiter = null; clearTimeout(w.timer);
      const out = this.q; this.q = []; this.qBytes = 0;
      json(w.res, { ok: true, m: out });
    }
    ping() {}
    terminate() { this.close(); }
    close() {
      if (this.readyState !== OPEN) return;
      this.readyState = 3; hsocks.delete(this.sid);
      if (this.waiter) { const w = this.waiter; this.waiter = null; clearTimeout(w.timer); json(w.res, { ok: false, closed: true }); }
      this.emit('close');
    }
  }
  const hsockOf = (req) => { const s = hsocks.get(String((req.body && req.body.sid) || '')); return s && s.name === currentUser(req) ? s : null; };
  const httpJson = express.json({ limit: '1mb' });
  app.post('/arcade/versus/http/open', httpJson, (req, res) => {
    const name = currentUser(req);
    if (!name) return json(res, { ok: false, error: 'login' });
    const s = new HttpSock(name); hsocks.set(s.sid, s);
    onConnect(s, name);
    json(res, { ok: true, sid: s.sid, hold: HTTP_HOLD });
  });
  app.post('/arcade/versus/http/poll', httpJson, (req, res) => {
    const s = hsockOf(req); if (!s) return json(res, { ok: false, closed: true });
    s.seen = Date.now();
    if (s.waiter) { const w = s.waiter; s.waiter = null; clearTimeout(w.timer); json(w.res, { ok: true, m: [] }); }
    const w = { res, timer: setTimeout(() => { if (s.waiter === w) { s.waiter = null; s.seen = Date.now(); json(res, { ok: true, m: [] }); } }, HTTP_HOLD) };
    s.waiter = w;
    req.on('close', () => { if (s.waiter === w && !res.headersSent) { s.waiter = null; clearTimeout(w.timer); } });
    s.flush();
  });
  app.post('/arcade/versus/http/send', httpJson, (req, res) => {
    const s = hsockOf(req); if (!s) return json(res, { ok: false, closed: true });
    s.seen = Date.now();
    const m = Array.isArray(req.body.m) ? req.body.m.slice(0, 400) : [];
    for (const it of m) {
      if (!it || typeof it !== 'object') continue;
      if (typeof it.b === 'string') { if (it.b.length <= MAX_FRAME * 1.4) s.emit('message', Buffer.from(it.b, 'base64'), true); }
      else if (typeof it.s === 'string') s.emit('message', Buffer.from(it.s, 'utf8'), false);
    }
    json(res, { ok: true });
  });
  app.post('/arcade/versus/http/close', httpJson, (req, res) => { const s = hsockOf(req); if (s) s.close(); json(res, { ok: true }); });
  setInterval(() => { const now = Date.now(); for (const s of [...hsocks.values()]) if (!s.waiter && now - s.seen > HTTP_IDLE) s.close(); }, 5000).unref();

  // ---------- pages ----------
  app.get('/arcade/versus/token', (req, res) => {
    const name = currentUser(req);
    if (!name) return json(res, { ok: false, error: 'Log in to play Head to Head.' });
    json(res, { ok: true, token: makeToken(name), ws: WS_PATH }); // a path: the page opens it on its own address
  });
  // Your last 10 finished Head to Head games.
  function results(user) {
    return (user.arcade || []).filter((m) => m.versus && m.status !== 'open').slice(-10).reverse().map((m) => ({
      id: m.id, at: m.at, local: m.local || '', status: m.status, opp: m.versus.opp, me: m.score ?? null, them: m.stats && m.stats.opp != null ? m.stats.opp : null,
      wager: m.versus.wager || 0, qs: m.versus.qs || 120, venue: m.versus.venue || 'stadium', reason: m.versus.reason || '', by: m.versus.by || null, net: m.status === 'won' ? (m.payout || 0) - (m.stake || 0) : m.status === 'lost' ? -(m.stake || 0) : 0,
    }));
  }
  app.get('/arcade/versus/results', async (req, res) => {
    try {
      const name = currentUser(req);
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      if (!user) return json(res, { ok: false, error: 'Log in to play Head to Head.' });
      json(res, { ok: true, balance: await balanceOf(user), results: results(user) });
    } catch (e) { console.error(e); json(res, { ok: false, error: 'Could not load your results.' }); }
  });

  // The game code loads as ordinary script files from /static/arcade/ (gzipped, cached until the file changes).
  const gameScript = (file) => `<script src="${esc(assetUrl('arcade/' + file + '.js'))}"></script>`;
  const CSS = `<style>
.vs-conn{display:inline-flex;align-items:center;gap:8px;font:600 13px Inter;color:var(--muted);margin:0 0 14px}.vs-conn:empty{display:none}
.vs-conn::before{content:'';width:8px;height:8px;border-radius:50%;background:#f5b301}.vs-conn.ok::before{background:#4ade80}
.vs-note{display:block;margin:0 0 14px;padding:10px 14px;border-radius:14px;background:var(--card2);border:1px solid var(--line2);font-weight:600}.vs-note:empty{display:none}
.vs-note.good{background:rgba(34,197,94,.12);border-color:rgba(74,222,128,.35);color:#4ade80}.vs-note.bad{background:rgba(239,43,58,.12);border-color:rgba(255,85,99,.35);color:var(--red2)}
.vs-list li{flex-wrap:wrap;row-gap:6px}.vs-list li b{min-width:0;overflow:hidden;text-overflow:ellipsis}
.vs-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;flex:none}.vs-dot.playing{background:#f5b301}
.vs-list .btn{flex:none}.vs-act{display:flex;gap:6px;flex:none}
.vs-ch{display:flex;flex-direction:column;gap:2px;margin-right:auto;min-width:0}.vs-ch small{color:var(--muted);font-size:12.5px}
.vs-left{font:800 15px var(--disp);color:#fcd34d;font-variant-numeric:tabular-nums;min-width:38px;text-align:right}
.vs-res .r{margin-left:auto;font-weight:700;white-space:nowrap}
#vsIn li{background:rgba(255,194,26,.08);border:1px solid rgba(255,194,26,.35);border-radius:14px;padding:10px 12px;margin-bottom:8px}
.vs-form>label,.vs-form .lbl{display:flex;flex-direction:column;gap:6px;font:700 12px Inter;color:var(--ink2);margin:0 0 12px;text-align:left}.vs-form .lbl{margin:0 0 6px}
.vs-form input[type=number]{background:var(--card2);color:var(--ink);border:1px solid var(--line2);border-radius:12px;padding:11px;font:700 16px Inter;width:100%}
.vs-form .arc-modes{grid-template-columns:repeat(3,1fr)}.vs-form .arc-modes.vs-two{grid-template-columns:1fr 1fr}.vs-form .arc-modes span{padding:10px 6px}
.vs-form small.hint{display:block;color:var(--muted);text-align:left;margin:-6px 0 12px}.vs-form .err{min-height:1em;margin:4px 0 0}
.vs-wait{text-align:center;padding:26px 18px}.vs-wait h2{font:800 32px/1 var(--disp);text-transform:uppercase;margin:6px 0 8px}.vs-wait p{margin:6px 0}
.vs-vs{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;font:800 22px var(--disp);text-transform:uppercase}.vs-vs i{font-style:normal;color:var(--muted);font-size:16px}
.vs-tm{display:inline-flex;align-items:center;gap:8px}.vs-tm::before{content:'';width:14px;height:14px;border-radius:4px;background:var(--c,#ffc21a);box-shadow:inset 0 -4px 0 var(--c2,#1b1e27)}
.vs-bar{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:100003;display:flex;align-items:center;gap:10px;max-width:calc(100% - 20px);padding:8px 8px 8px 14px;border-radius:999px;background:rgba(15,17,23,.94);border:1px solid var(--line2);box-shadow:0 10px 30px rgba(0,0,0,.6);font:700 14px Inter}
.vs-bar[hidden]{display:none}.vs-bar.conn{padding:8px 14px;color:#fcd34d}
.vs-stage-top{display:flex;justify-content:flex-end;margin:0 0 8px}
body.vs-playing .ftr{display:none}
@media(max-width:760px){.vs-list li{padding:10px 4px}.vs-wait h2{font-size:26px}}
</style>`;

  app.get(PAGE, async (req, res, next) => {
    try {
      await refresh();
      const db = load();
      const name = currentUser(req);
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      const balance = user ? await balanceOf(user) : null;
      const secs = Math.round(GONE_MS / 1000);
      const firstTeam = Object.values(db.teams)[0];
      const how = `<section class="card"><div class="card-h"><h2>How it works</h2></div><ul class="how">
        <li>Pick someone under <b>Online now</b> and send a challenge: a wager (0 for a friendly), 1, 2 or 3-minute quarters and where: The Stadium, Hancock Stadium or Wildcat Blacktop (its house rules: throw-offs, touchdowns worth 7, one game clock and a last play, and on the small field 7 on 7 with no rush before 7 banana; you pick the field size and tackle or two-hand touch). They have a minute to accept.</li>
        <li>When they accept, both wagers are held until the game ends. The winner gets both: 2× the wager.</li>
        <li>Your Lineup takes the field (all 11). No full Lineup yet? You play as the ${esc(firstTeam ? firstTeam.name : 'MFL')}.</li>
        <li>No ties: a tied game goes to overtime. Quitting a game that has kicked off counts as a loss.</li>
        <li>Lose your connection and you have ${secs} seconds to come back before it counts as a loss. If the server restarts mid-game, both wagers come back.</li></ul></section>`;
      const head = `<div class="arc-head"><a href="/arcade/blitz3d" class="muted sm">${icon('arrow')} 3D Blitz</a><h1><span>🆚</span> Head to Head</h1><p class="muted">3D Blitz, live, against another MFL player. Put coins on it, or play a friendly.</p>${user ? `<span class="arc-bal"><span class="coins">${icon('coin')}<span data-balance>${fmt(balance)}</span></span></span>` : ''}</div>`;
      if (!user) {
        return res.send(layout(req, 'Head to Head', `${CSS}<div class="wrap arc-page vs-page">${head}
          <section class="card"><p>Log in to see who's online and challenge them to a game of 3D Blitz.</p><div class="arc-cta"><a class="btn" href="/pickem/login?next=${encodeURIComponent(PAGE)}">Log in</a><a class="btn ghost" href="/pickem/signup">Sign up free</a></div></section>${how}</div>`));
      }
      const boot = { me: user.name, balance, results: results(user), gone: secs, qs: QS, venues: VENUES, maxWager: MAX_WAGER, challengeSecs: Math.round(CHALLENGE_MS / 1000) };
      res.send(layout(req, 'Head to Head', `${CSS}<div class="wrap arc-page vs-page">${head}
        <div id="vsLobby">
          <p class="vs-conn" id="vsConn">Connecting…</p>
          <p class="vs-note" id="vsNote"></p>
          <div class="home-grid"><div class="col">
            <section class="card" id="vsInCard" hidden><div class="card-h"><h2>${icon('fire')} Challenges for you</h2></div><ol class="lb vs-list" id="vsIn"></ol></section>
            <section class="card" id="vsOutCard" hidden><div class="card-h"><h2>Your challenge</h2></div><ol class="lb vs-list" id="vsOut"></ol></section>
            <section class="card"><div class="card-h"><h2>Online now</h2><span class="muted sm" id="vsCount"></span></div>
              <ol class="lb vs-list" id="vsOnline"></ol><p class="empty" id="vsNobody" hidden>Nobody else is here right now. Send a friend this page: they'll show up here when they open it.</p></section>
          </div><div class="col">
            <section class="card"><div class="card-h"><h2>Your Head to Head games</h2></div><ol class="lb vs-res" id="vsResults"></ol><p class="empty" id="vsNoResults" hidden>No games yet.</p></section>
            ${how}
          </div></div>
        </div>
        <section id="vsStage" class="arc-stage" hidden></section>
      </div>
      <div class="vs-bar conn" id="vsConnBar" hidden></div>
      <script>window.MFL_VERSUS=${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>
      ${gameScript('blitz3d')}${gameScript('versus')}`));
    } catch (e) { next(e); }
  });

  return { attach, wsPath: WS_PATH };
};
