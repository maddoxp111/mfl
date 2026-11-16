// Head to Head for 3D Dunk (two real players, optional coin wager): the lobby page's client.
// Who is online, challenges with a wager, accept / decline, both lineups before the game, READY, then
// window.MFLDunk.play(root, { ..., h2h: { me, role, net, onEvent, attach } }) and the result with the payout.
// The connection is public/arcade/vsnet.js; the game is public/arcade/dunk3d.js (the host's browser runs the game, the guest's sends
// its controls and draws what the host sends: see the engine's 96-net.js). Settlement is the server's alone: this page never reports
// a score as a result and never calls the Arcade's finish.
(function () {
  'use strict';
  const cfg = window.MFL_DUNKVS;
  if (!cfg || !document.getElementById('dvLobby') || !window.MFLVsNet) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const ME = cfg.me, MAXW = cfg.maxWager || 10000, GAME = 'dunk3d';
  const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  const QLABEL = { 60: '1-min', 120: '2-min', 180: '3-min' };
  const qlabel = (q) => QLABEL[q] || Math.round((q || 120) / 60) + '-min';
  const terms = (c) => [c.wager ? fmt(c.wager) + ' coins' : 'Friendly', qlabel(c.qs) + ' quarters'].join(' · ');
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const KIND = { lineup: 'saved lineup', auto: 'auto-picked cards', real: 'a real MFL team' };

  let balance = cfg.balance, online = [], incoming = [], outgoing = null, results = cfg.results || [];
  let formFor = null, sending = false, loggedOut = false;
  let live = null; // the match on this page: { id, m, net, engine, ready, resolved, over, hapi, queue }
  let conn = null;

  // ---------- teams (as the server sends them in `match`: the same team objects the game takes) ----------
  const five = (t) => (t && Array.isArray(t.players) ? t.players.slice(0, 5) : []);
  const ovrOf = (t) => { const f = five(t).map((p) => +(p && p.bb && p.bb.ovr) || 0).filter(Boolean); return f.length ? Math.round(f.reduce((a, b) => a + b, 0) / f.length) : null; };
  // what the server may add to an online row or a challenge: team = { kind: 'lineup' | 'auto' | 'real', ovr, name }
  const teamLine = (t) => (t && (t.kind || t.ovr) ? [KIND[t.kind] || '', t.ovr ? 'team overall ' + t.ovr : ''].filter(Boolean).join(' · ') : '');
  // a challenge carries pv = { [name]: { kind, name, ovr, five: [{ n, pos, o }] } }: what each side will bring (picked when the challenge is sent)
  const pvOf = (c, who) => (c && c.pv && typeof c.pv === 'object' && c.pv[who]) || null;
  const pvFive = (t) => (t && Array.isArray(t.five) ? t.five.map((p) => `<li><i>${esc(p.pos || '')}</i><span>${esc(p.n)}</span><b>${p.o || ''}</b></li>`).join('') : '');
  const pvBlock = (c, other) => {
    const a = pvOf(c, ME), b = pvOf(c, other);
    if (!a && !b) return '';
    const col = (t, who, me) => (t ? `<div class="dkv-team${me ? ' me' : ''}"><div class="dkv-team-h"><div><b>${esc(t.name || '@' + who)}</b><small>${me ? 'you' : '@' + esc(who)} · ${esc(KIND[t.kind] || '')}</small></div><em>${t.ovr || '–'}<small>OVR</small></em></div><ol>${pvFive(t)}</ol></div>` : '');
    return `<details class="dkv-pv"><summary>See both fives</summary><div class="dkv-teams">${col(a, ME, true)}${col(b, other, false)}</div></details>`;
  };

  // ---------- connection ----------
  function setConn(txt) {
    const el = $('dvConn');
    el.className = 'dkv-conn' + (txt ? '' : ' ok');
    el.textContent = txt || (conn && conn.http ? 'Connected (slow connection)' : 'Connected');
    barText(txt && live && live.engine && !live.over ? txt : '', 'conn');
  }
  function barText(txt, who) {
    const bar = $('dvBar');
    if (!bar) return;
    bar.dataset[who] = txt || '';
    const t = bar.dataset.conn || bar.dataset.opp || '';
    bar.hidden = !t;
    bar.textContent = t;
  }
  const sendRaw = (o) => conn.sendJson(o);
  // match messages wait for the connection to come back (in order)
  function out(o) { if (live && live.queue.length) { live.queue.push(o); return; } if (!sendRaw(o) && live && live.queue.length < 100) live.queue.push(o); }
  function flushQueue() { while (live && live.queue.length && conn.connected) { if (!sendRaw(live.queue[0])) break; live.queue.shift(); } }
  const cap = (rtt) => { let touch = false; try { touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches); } catch (e) {} return { touch, ram: +navigator.deviceMemory || 0, cores: +navigator.hardwareConcurrency || 0, rtt: rtt || undefined }; };

  function onOpen(again) {
    if (live && !live.over) { // back after a drop (or a reload): rejoin the match, then send what queued up meanwhile
      sendRaw({ t: 'join', id: live.id, fresh: false });
      if (!live.engine && live.ready) sendRaw({ t: 'ready', id: live.id });
      flushQueue();
    }
  }

  // ---------- server messages ----------
  function onMsg(m) {
    switch (m.t) {
      case 'me': setBalance(m.balance); break;
      case 'online': online = (Array.isArray(m.list) ? m.list : []).filter((p) => !p.game || p.game === GAME); renderOnline(); syncForm(); break;
      case 'challenges': incoming = (m.incoming || []).filter(mine).map(stamp); outgoing = (m.outgoing || []).filter(mine).map(stamp)[0] || null; renderChallenges(); renderOnline(); break;
      case 'challenge': if (m.c && mine(m.c)) { incoming = incoming.filter((c) => c.id !== m.c.id).concat(stamp(m.c)); renderChallenges(); } break;
      case 'challenge-sent': if (m.c && mine(m.c)) { outgoing = stamp(m.c); closeForm(); renderChallenges(); renderOnline(); } break;
      case 'challenge-gone': challengeGone(m); break;
      case 'error': onError(m.msg || 'Something went wrong.'); break;
      case 'match': if (!m.game || m.game === GAME) startMatch(m); break;
      case 'go': onGo(m); break;
      case 'g': if (live && live.net && m.m && typeof m.m === 'object') live.net.deliver(m.m); break; // (the other screen's engine message)
      case 'opp-gone': case 'opp-back': case 'stall': sys(m); break;
      case 'over': onOver(m); break;
      case 'detached': onDetached(m); break;
      default:
    }
  }
  const mine = (c) => !c.game || c.game === GAME; // (a Blitz challenge never shows here)
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
    if (formFor && sending) { sending = false; $('dvFormErr').textContent = msg; syncForm(); return; }
    if (live && !live.engine && !live.over) { const s = $('dvWaitS'); if (s) s.textContent = msg; return; }
    if (live) { console.warn('Head to Head:', msg); return; }
    note(msg, 'bad');
  }
  function note(txt, kind) {
    const el = $('dvNote');
    el.className = 'dkv-note' + (kind ? ' ' + kind : '');
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
    $('dvOnline').innerHTML = online.map((p) => {
      const idle = p.status === 'idle', asked = outgoing && outgoing.to === p.name, tl = teamLine(p.team);
      const btn = !idle || busy ? '' : asked ? '<button class="btn ghost sm" disabled>Challenged</button>' : `<button class="btn sm" type="button" data-ch="${esc(p.name)}">Challenge</button>`;
      return `<li><span class="dkv-dot ${idle ? '' : 'playing'}"></span><div class="dkv-ch"><b>@${esc(p.name)}</b><small>${idle ? 'Here now' : 'In a match'}${tl ? ' · ' + esc(tl) : ''}</small></div>${btn}</li>`;
    }).join('');
    $('dvNobody').hidden = online.length > 0;
    $('dvCount').textContent = online.length ? `${online.length} online` : '';
  }
  function renderChallenges() {
    $('dvInCard').hidden = !incoming.length;
    $('dvIn').innerHTML = incoming.map((c) => {
      const short = c.wager > balance, tl = teamLine(pvOf(c, c.from)), ml = teamLine(pvOf(c, ME));
      return `<li><div class="dkv-ch"><b>@${esc(c.from)}</b><small>${esc(terms(c))}${c.wager ? ` · winner takes ${fmt(c.wager * 2)}` : ''}</small>${tl ? `<small>they bring ${esc(tl)}</small>` : ''}${ml ? `<small>you bring ${esc(ml)}</small>` : ''}${short ? `<small class="bad">you have ${fmt(balance)} coins</small>` : ''}</div><span class="dkv-left" data-deadline="${c.deadline}">${clock(c.deadline - Date.now())}</span>
        <div class="dkv-act"><button class="btn sm" type="button" data-acc="${esc(c.id)}" ${short || live ? 'disabled' : ''}>Accept</button><button class="btn ghost sm" type="button" data-dec="${esc(c.id)}">Decline</button></div>${pvBlock(c, c.from)}</li>`;
    }).join('');
    $('dvOutCard').hidden = !outgoing;
    $('dvOut').innerHTML = outgoing ? `<li><div class="dkv-ch"><b>Waiting for @${esc(outgoing.to)}</b><small>${esc(terms(outgoing))}</small>${teamLine(pvOf(outgoing, outgoing.to)) ? `<small>they bring ${esc(teamLine(pvOf(outgoing, outgoing.to)))}</small>` : ''}${teamLine(pvOf(outgoing, ME)) ? `<small>you bring ${esc(teamLine(pvOf(outgoing, ME)))}</small>` : ''}</div><span class="dkv-left" data-deadline="${outgoing.deadline}">${clock(outgoing.deadline - Date.now())}</span>
      <button class="btn ghost sm" type="button" data-cancel="${esc(outgoing.id)}">Cancel</button>${pvBlock(outgoing, outgoing.to)}</li>` : '';
    const n = incoming.length;
    document.title = (n ? `(${n}) ` : '') + document.title.replace(/^\(\d+\) /, '');
  }
  setInterval(() => { document.querySelectorAll('[data-deadline]').forEach((e) => { e.textContent = clock(+e.getAttribute('data-deadline') - Date.now()); }); }, 250);

  const WORD = { forfeit: (r) => (r.status === 'won' ? 'they quit' : r.by === ME ? 'you quit' : 'quit'), disconnect: (r) => (r.status === 'won' ? 'they left' : r.status === 'lost' ? 'you left' : 'connection lost'),
    tie: () => 'tie, wagers back', review: () => 'scores did not add up, wagers back', cancelled: () => 'called off', restart: () => 'server restart, wagers back', error: () => 'could not start', hostlost: () => 'game was lost, wagers back' };
  function renderResults() {
    const rows = results.filter((r) => !r.game || r.game === GAME);
    $('dvResults').innerHTML = rows.map((r) => {
      const tag = r.status === 'won' ? 'W' : r.status === 'lost' ? 'L' : 'T';
      const day = /^\d{4}-\d\d-\d\d/.test(r.local || '') ? new Date(r.local.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
      const sc = r.me != null && r.them != null && r.status !== 'void' ? `${r.me}–${r.them}` : '';
      const why = WORD[r.reason] ? WORD[r.reason](r) : '';
      const coins = !r.wager ? '<span class="r muted">Friendly</span>' : r.status === 'void' ? '<span class="r muted">Refunded</span>' : `<span class="r ${r.net > 0 ? 'up' : 'down'}">${r.net > 0 ? '+' : ''}${fmt(r.net)}</span>`;
      return `<li><span class="res ${tag}">${r.status === 'void' ? '–' : tag}</span><div class="dkv-ch"><b>vs @${esc(r.opp)}</b><small>${esc([sc, why, r.wager ? fmt(r.wager) + ' coins' : '', day].filter(Boolean).join(' · '))}</small></div>${coins}</li>`;
    }).join('');
    $('dvNoResults').hidden = rows.length > 0;
  }
  async function loadResults() {
    try {
      const r = await (await fetch('/arcade/versus/results?g=' + GAME, { cache: 'no-store', credentials: 'same-origin' })).json();
      if (r && r.ok) { results = r.results || []; setBalance(r.balance); renderResults(); renderChallenges(); }
    } catch (e) {}
  }

  // challenge form (a small dialog, so lobby updates don't reset what you typed)
  function openForm(name) {
    formFor = name; sending = false;
    let o = $('dvModal');
    if (!o) { o = document.createElement('div'); o.id = 'dvModal'; o.className = 'arc-over'; document.body.appendChild(o); }
    const mt = cfg.mine ? teamLine(cfg.mine) : '';
    o.innerHTML = `<div class="arc-over-in"><form class="dkv-form" id="dvForm"><h2>Challenge</h2><p class="muted">@${esc(name)} gets a minute to accept.</p>
      <label>Wager (coins each, up to ${fmt(MAXW)})<input type="number" name="wager" min="0" max="${MAXW}" step="1" value="0" inputmode="numeric" autocomplete="off"></label>
      <div class="dkv-chips" id="dvChips">${[0, 100, 500, 1000, 5000, MAXW].filter((v, i, a) => v <= MAXW && a.indexOf(v) === i).map((v) => `<button type="button" class="btn ghost sm" data-w="${v}">${v ? fmt(v) : 'Friendly'}</button>`).join('')}</div>
      <small class="hint" id="dvWagerHint"></small>
      <div class="lbl">Quarter length</div>
      <div class="arc-modes dkv-three">${(cfg.qs || [60, 120, 180]).map((q) => `<label class="mode"><input type="radio" name="qs" value="${q}" ${q === 120 ? 'checked' : ''}><span>${q / 60} min</span></label>`).join('')}</div>
      <small class="hint">4 quarters, a tie goes to overtime, 3 timeouts each, no pause.</small>
      <div class="dkv-brings" id="dvBrings"><div><small>You bring</small><b>${esc(mt || 'your Dunk team')}</b></div><div id="dvTheirs"></div></div>
      <p class="err" id="dvFormErr"></p>
      <div class="arc-over-b"><button class="btn" type="submit" id="dvSend">Send challenge</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form></div>`;
    o.hidden = false;
    const f = $('dvForm');
    f.wager.addEventListener('input', syncForm);
    $('dvChips').addEventListener('click', (e) => { const b = e.target.closest('button[data-w]'); if (!b) return; f.wager.value = b.getAttribute('data-w'); syncForm(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const wager = Math.floor(+f.wager.value || 0);
      if (wager < 0 || wager > MAXW) { $('dvFormErr').textContent = `Pick 0 to ${fmt(MAXW)} coins.`; return; }
      if (wager > balance) { $('dvFormErr').textContent = `You have ${fmt(balance)} coins.`; return; }
      if (!sendRaw({ t: 'challenge', to: name, wager, qs: +f.qs.value, game: GAME })) { $('dvFormErr').textContent = 'Not connected. Trying again…'; conn.kick(); return; }
      sending = true; $('dvFormErr').textContent = ''; syncForm();
    });
    o.querySelector('[data-close]').addEventListener('click', closeForm);
    o.addEventListener('click', (e) => { if (e.target === o) closeForm(); });
    syncForm();
    setTimeout(() => { try { f.wager.select(); } catch (e) {} }, 30);
  }
  function syncForm() {
    const f = $('dvForm');
    if (!formFor || !f) return;
    const p = online.find((x) => x.name === formFor), w = Math.floor(+f.wager.value || 0);
    $('dvWagerHint').textContent = (w ? `Winner takes ${fmt(w * 2)}.` : '0 = a friendly, no coins.') + ` You have ${fmt(balance)}.`;
    const tl = p ? teamLine(p.team) : '';
    $('dvTheirs').innerHTML = tl ? `<small>@${esc(formFor)} brings</small><b>${esc(tl)}</b>` : '';
    const over = w > MAXW ? `The most is ${fmt(MAXW)} coins.` : w > balance ? `You have ${fmt(balance)} coins.` : '';
    const gone = !p ? `@${formFor} left the lobby.` : p.status !== 'idle' ? `@${formFor} is in a match now.` : over;
    if (!sending) $('dvFormErr').textContent = gone;
    $('dvSend').disabled = !!gone || sending;
    $('dvSend').textContent = sending ? 'Sending…' : 'Send challenge';
  }
  function closeForm() { formFor = null; sending = false; const o = $('dvModal'); if (o) { o.hidden = true; o.innerHTML = ''; } }

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
  // The match message (server design): id, wager, qs, seed, host (a name), youAre 0|1 (0 = host = home), home and away (team objects as
  // /arcade/start gives them), me / opp { name, team } as Head to Head has them, rejoin when this page took over a running match.
  const nameOf = (m, you) => {
    if (you) return (m.me && m.me.name) || ME;
    const o = (m.opp && m.opp.name) || m.oppName || (Array.isArray(m.players) ? m.players.find((n) => n !== ME) : '') || (m.host && m.host !== ME ? m.host : '');
    return o || 'opponent';
  };
  function sides(m) {
    const you = m.youAre === 1 ? 1 : 0;
    const mineT = (m.me && m.me.team) || (you ? m.away : m.home), oppT = (m.opp && m.opp.team) || (you ? m.home : m.away);
    const home = m.home || (you ? oppT : mineT), away = m.away || (you ? mineT : oppT);
    return { you, home, away, mineT, oppT };
  }
  function rosterHtml(t, who, tag, me, kind) {
    const ps = five(t), bench = (t && t.players ? t.players.slice(5) : []).map((p) => p.name).filter(Boolean);
    const ovr = ovrOf(t), c = t && t.color ? esc(t.color) : '#ffc21a', c2 = t && t.color2 ? esc(t.color2) : '#1b1e27';
    return `<div class="dkv-team${me ? ' me' : ''}" style="--c:${c};--c2:${c2}"><div class="dkv-team-h"><span class="dkv-sw"></span><div><b>${esc(t && t.name ? t.name : '@' + who)}</b><small>@${esc(who)} · ${esc(tag)}${kind ? ' · ' + esc(KIND[kind] || kind) : ''}</small></div><em>${ovr || '–'}<small>OVR</small></em></div>
      <ol>${ps.map((p, i) => `<li><i>${POS[i]}</i><span>${esc(p.name)}</span><b>${(p.bb && p.bb.ovr) || ''}</b></li>`).join('')}</ol>${bench.length ? `<p class="dkv-bench">Bench: ${esc(bench.join(', '))}</p>` : ''}</div>`;
  }
  function startMatch(m) {
    if (live && live.id === m.id) return; // already on it
    if (live && !live.over) return;
    if (cfg.skip && cfg.skip[m.id]) return;
    if (live) teardown();
    closeForm();
    note('');
    const S = sides(m);
    const role = S.you === 0 ? 'host' : 'guest';
    const rejoin = !!m.rejoin;
    live = { id: m.id, m, S, role, net: null, engine: false, ready: false, resolved: false, over: null, hapi: null, queue: [], opp: nameOf(m, false) };
    live.net = MFLVsNet.engineNet(conn, { id: m.id, role, canSend: () => !!live && !live.over });
    const stage = $('dvStage');
    const hostName = m.host || (S.you === 0 ? ME : live.opp);
    const iAmHost = S.you === 0;
    stage.innerHTML = `<div class="dkv-stage-top" id="dvTop" hidden><button class="btn ghost sm" type="button" id="dvQuit">Quit match</button></div>
      <div class="card dkv-wait" id="dvWait"><div class="kicker" style="justify-content:center">🏀 Head to Head</div>
        <div class="dkv-teams">${rosterHtml(S.mineT, ME, S.you === 0 ? 'home' : 'away', true, m.kinds && m.kinds[ME])}<i>vs</i>${rosterHtml(S.oppT, live.opp, S.you === 0 ? 'away' : 'home', false, m.kinds && m.kinds[live.opp])}</div>
        <p class="muted dkv-terms">${esc(terms(m))}${m.wager ? ` · winner takes ${fmt(m.wager * 2)}` : ''} · overtime if tied</p>
        <p class="dkv-host">${iAmHost ? 'Your browser runs the game: stay on this page.' : `Host: @${esc(hostName)}. Their browser runs the game.`}${m.http ? ' Slow connection (the HTTPS fallback): expect a little delay.' : ''}</p>
        <h2 id="dvWaitT">${rejoin ? 'Back in the game' : 'Ready?'}</h2><p class="muted" id="dvWaitS">${rejoin ? 'Picking the game back up…' : `Press Ready when you are. @${esc(live.opp)} has to as well${cfg.ready ? ` (${cfg.ready} seconds)` : ''}.`}</p>
        <div class="arc-over-b"><button class="btn" type="button" id="dvReady" ${rejoin ? 'hidden' : ''}>I'm ready</button><button class="btn ghost" type="button" id="dvCancel">Call it off</button></div></div>`;
    stage.hidden = false;
    $('dvLobby').hidden = true;
    document.body.classList.add('arc-playing', 'dkv-playing');
    $('dvCancel').addEventListener('click', () => { live.net && out({ t: 'quit', id: m.id }); const s = $('dvWaitS'); if (s) s.textContent = 'Calling it off…'; $('dvCancel').disabled = true; });
    $('dvQuit').addEventListener('click', () => {
      if (!live || live.over) return;
      if (confirm(`Quit this match? It counts as a loss${live.m.wager ? ` and you lose ${fmt(live.m.wager)} coins` : ''}.`)) out({ t: 'quit', id: live.id });
    });
    $('dvReady').addEventListener('click', onReady);
    renderOnline(); renderChallenges();
    window.scrollTo(0, 0);
    sendRaw({ t: 'join', id: m.id, fresh: true }); // (fresh: this page has no game running yet: a host that reloads has lost the game)
    if (rejoin) {
      if (S.you === 0) { // the host's browser is the game: a reload lost it, and a running game can't be rebuilt from here
        const s = $('dvWaitS'), t = $('dvWaitT'); t.textContent = 'This game was lost'; s.textContent = `It was running in the page that was closed or reloaded, and can't be picked up again. @${live.opp} is told, and the server settles it by its rules.`;
        $('dvReady').hidden = true;
        const back = $('dvCancel').cloneNode(true); back.textContent = 'Back to the lobby'; back.disabled = false;
        $('dvCancel').replaceWith(back);
        back.addEventListener('click', () => { cfg.skip = cfg.skip || {}; cfg.skip[m.id] = 1; teardown(); });
        live.lost = true;
        return;
      }
      launch(true); sendRaw({ t: 'ready', id: m.id }); live.ready = true;
    }
  }
  // READY is a tap: the game is built now (the audio can start without another tap), shown at the go
  function onReady() {
    if (!live || live.engine || live.ready) return;
    $('dvReady').disabled = true;
    if (!launch(false)) return;
    live.ready = true;
    $('dvWaitT').textContent = 'Ready';
    $('dvWaitS').textContent = `Waiting for @${live.opp}…`;
    sendRaw({ t: 'ready', id: live.id });
  }
  function sys(m) {
    if (!live || live.over) return;
    const who = live.opp;
    if (m.t === 'opp-gone') {
      const msg = `@${who} lost connection. Waiting up to ${m.secs || cfg.gone || 60} seconds…`;
      if (live.engine) { barText(msg, 'opp'); if (live.role === 'host' && live.hapi && live.hapi.net) { try { live.hapi.net.hold(true); } catch (e) {} } } else { const s = $('dvWaitS'); if (s) s.textContent = msg; }
    } else if (m.t === 'opp-back') {
      if (live.engine) { barText('', 'opp'); if (live.role === 'host' && live.hapi && live.hapi.net) { try { live.hapi.net.hold(false); } catch (e) {} } } else { const s = $('dvWaitS'); if (s) s.textContent = `@${who} is back. Waiting for the game to load…`; }
    } else if (m.t === 'stall') {
      if (live.engine) barText(m.on === false ? '' : `Waiting for @${esc(m.who && m.who !== ME ? m.who : who)}…`.replace(/&#39;/g, "'"), 'opp');
    }
  }
  function onGo(m) {
    if (!live || live.over || live.lost) return;
    if (live.engine) { if (live.started) return; } // (a rejoin's go after the game is running: it keeps going)
    else if (!launch(true)) return; // a go before READY (this page just took over a running match): build the game now
    start();
  }
  // begin the tip (host) / the play (guest) on both screens at the go
  function start() {
    if (!live || !live.engine || live.started) return;
    live.started = true;
    $('dvWait').hidden = true;
    $('dvTop').hidden = false;
    const root = live.root;
    root.style.cssText = '';
    const stage = $('dvStage');
    const toGame = () => { try { window.scrollTo(0, Math.max(0, stage.getBoundingClientRect().top + window.scrollY - 70)); } catch (e) {} };
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    try { if (live.hapi) live.hapi.begin(); } catch (e) { console.error(e); }
    toGame(); setTimeout(toGame, 60); setTimeout(toGame, 400);
  }
  // build the game (hidden behind the ready card until the go). Returns false if it can't run here.
  function launch(auto) {
    const mineM = live;
    const M = live.m, S = live.S;
    const root = document.createElement('div');
    root.className = 'arc-root';
    root.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;pointer-events:none';
    $('dvStage').appendChild(root);
    live.root = root;
    const H = {
      me: S.you, role: live.role, net: live.net,
      onEvent: (type, d) => onEngineEvent(type, d),
      attach: (api) => { mineM.hapi = api; },
    };
    let p;
    try {
      if (!window.MFLDunk || !window.MFLDunk.play) throw new Error('The game did not load. Refresh and try again.');
      p = window.MFLDunk.play(root, { home: S.home, away: S.away, level: 2, difficulty: 0.66, seed: M.seed, quarterSecs: M.qs || 120, timeouts: 3, noTies: true, h2h: H,
        label: `Head to Head · ${M.wager ? fmt(M.wager) + ' coins' : 'Friendly'}` });
    } catch (e) {
      console.error(e);
      root.remove(); live.root = null;
      const s = $('dvWaitS'); if (s) s.textContent = String((e && e.message) || e);
      $('dvReady').disabled = false;
      return false;
    }
    live.engine = true;
    Promise.resolve(p).then((r) => engineDone(mineM, r), (e) => engineDone(mineM, { quit: true, error: String(e) }));
    return true;
  }
  function onEngineEvent(type, d) {
    // the engine reports its own stalls with an overlay; the server's score witness gets the 'final' through the net (an ev of type final)
    if (type === 'stall' && live && d && d.on === false) barText('', 'opp');
  }
  function engineDone(mineM, r) {
    if (live !== mineM) return;
    live.resolved = true;
    if (r && (r.quit || r.error) && !live.over) out({ t: 'quit', id: live.id }); // the box was closed before the end, or the game could not run
    if (live.over) return backToLobby();
    const wait = '<h2>Final</h2><p class="muted">Waiting for the result…</p>';
    showOverlay(wait, false);
    setTimeout(() => { if (live === mineM && !live.over) showOverlay(wait + '<p class="muted sm">Taking a while. Your result is saved on the server either way.</p>', true); }, 20000);
  }
  function onOver(m) {
    if (!live || live.id !== m.id) { setBalance(m.balance); loadResults(); return; } // another tab's match, or one left behind
    if (live.over) return;
    live.over = m;
    setBalance(m.balance);
    setConn(conn && conn.connected ? '' : 'Reconnecting…');
    barText('', 'opp');
    if (live.engine && live.started && !live.resolved) {
      live.barTimer = setTimeout(() => overBar(m), 2500); // the engine's own final box first; this bar is the way out
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
    const opp = Object.keys(m.score || {}).find((n) => n !== ME) || (live ? live.opp : ''), wager = m.wager != null ? m.wager : live ? live.m.wager : Math.abs(m.net || 0);
    const won = m.winner === ME, lost = !!m.winner && !won, sc = m.score || {};
    const title = won ? 'You win!' : lost ? 'You lost' : 'No contest';
    const score = sc[ME] != null && sc[opp] != null ? `${sc[ME]}–${sc[opp]}` : '';
    const why = { final: score ? (won ? `You beat @${opp} ${score}.` : `@${opp} won ${sc[opp]}–${sc[ME]}.`) : '', forfeit: won ? `@${opp} quit.` : 'You quit.', tie: `Tied ${score}: wagers back.`,
      disconnect: won ? `@${opp} lost connection.` : lost ? 'You lost connection.' : 'A connection dropped before the tip.', cancelled: 'Called off before the tip.', restart: 'The server restarted: wagers back.',
      review: 'The score reports did not add up, so nobody is paid: wagers back.', hostlost: 'The game could not go on, so nobody is paid: wagers back.', error: 'The match could not start.' }[m.reason] || '';
    const coins = m.net > 0 ? `+${fmt(m.net)} coins` : m.net < 0 ? `${fmt(m.net)} coins` : wager ? 'Wager back' : 'Friendly: no coins';
    return { title, why, coins, cls: m.net > 0 ? 'up' : m.net < 0 ? 'down' : '' };
  }
  function overHtml(m) {
    const s = overSummary(m);
    return `<h2>${esc(s.title)}</h2>${s.why ? `<p>${esc(s.why)}</p>` : ''}<p class="arc-coins ${s.cls}">${esc(s.coins)}</p>${m.balance != null ? `<p class="muted">Balance: ${fmt(m.balance)} coins</p>` : ''}`;
  }
  // over arrived but the game is still on screen (its final box): a small bar on top of it with a way out
  function overBar(m) {
    if (!live || live.over !== m || live.resolved) return;
    const s = overSummary(m);
    let bar = $('dvOverBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'dvOverBar'; bar.className = 'dkv-bar'; document.body.appendChild(bar); }
    bar.innerHTML = `<span>${esc(s.title)} · <span class="${s.cls}">${esc(s.coins)}</span></span><button class="btn sm" type="button">Continue</button>`;
    bar.hidden = false;
    bar.querySelector('button').addEventListener('click', backToLobby);
  }
  function showOverlay(html, withContinue) {
    let o = $('dvOver');
    if (!o) { o = document.createElement('div'); o.id = 'dvOver'; o.className = 'arc-over'; o.style.zIndex = '100002'; document.body.appendChild(o); }
    o.innerHTML = `<div class="arc-over-in">${html}${withContinue ? '<div class="arc-over-b"><button class="btn" type="button">Continue</button></div>' : ''}</div>`;
    o.hidden = false;
    if (withContinue) o.querySelector('button').addEventListener('click', backToLobby);
  }
  function backToLobby() {
    if (live && live.engine && !live.resolved) { // the game has no off switch from here: a fresh page is the clean way out
      if (live.over && !live.over.detached) { try { sessionStorage.setItem('mfl-dv-note', JSON.stringify({ ...live.over, wager: live.m.wager })); } catch (e) {} }
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
    ['dvOver', 'dvOverBar'].forEach((id) => { const e = $(id); if (e) e.hidden = true; });
    const stage = $('dvStage');
    stage.hidden = true;
    stage.innerHTML = '';
    $('dvLobby').hidden = false;
    $('dvBar').hidden = true;
    document.body.classList.remove('arc-playing', 'dkv-playing');
    renderOnline(); renderChallenges();
  }
  window.addEventListener('beforeunload', (e) => { if (live && !live.over && !live.lost) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- go ----------
  try { // the result of a match left by reloading the page
    const saved = JSON.parse(sessionStorage.getItem('mfl-dv-note') || 'null');
    sessionStorage.removeItem('mfl-dv-note');
    if (saved && saved.t === 'over') noteOver(saved);
  } catch (e) {}
  renderOnline(); renderChallenges(); renderResults();
  conn = MFLVsNet.connect({
    game: GAME, cap, onStatus: setConn, onOpen, onJson: onMsg,
    onBin: (buf) => { if (live && live.net) live.net.deliver(new Uint8Array(buf)); },
  });
  loadResults();
  window.__dunkVs = { get live() { return live; }, get conn() { return conn; } }; // (tests)
})();
