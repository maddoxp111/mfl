// 3D Dunk Head to Head: the lobby page (/arcade/dunk3d/versus) and the pieces other pages link it with.
// The live part is public/arcade/dunkversus.js (lobby client), public/arcade/vsnet.js (connection) and public/arcade/dunk3d.js (the game).
//
//   require('./dunkpage')(app, { esc, icon, coins, layout, load, refresh, getDoc, userKey, currentUser, accountOf, survivorNow, assetUrl, results? })
//     results(user, game) -> the player's Head to Head results for that game (optional: the page also loads /arcade/versus/results itself)
//   require('./dunkpage').link()   a "Head to Head" promo card for the 3D Dunk page (HTML)
//   require('./dunkpage').PAGE     '/arcade/dunk3d/versus'
//   require('./dunkpage').lineupOf(db, user) -> { kind: 'lineup' | 'auto' | 'real', ovr, players: [{ pos, n, o, tm }], bench: [names] }
const cards = require('./cards');
const arcadeMod = require('./arcade');

const PAGE = '/arcade/dunk3d/versus';
const MAX_WAGER = 2000, QS = [60, 120, 180], DUNK_KEEP = 6, DUNK_MAX = 8;
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');

// The lineup this player takes into a game, as the page shows it: the saved Dunk lineup (6 to 8 owned cards, all different players), else the six best
// cards he owns (auto-pick), else a real MFL team (the server picks which one when the game starts). Overall = the five starters' average.
function lineupOf(db, user) {
  const own = user ? cards.collection(user) : {};
  const info = (id) => { const c = id && own[id] ? cards.cardInfo(db, id) : null; if (!c) return null; const ca = arcadeMod.bbCardAttrs(db, c.t, c.p, c); return ca ? { c, ca } : null; };
  const row = (x, i, pos) => ({ pos, n: x.c.p.name, o: Math.round(x.ca.attr.ovr), tm: x.c.t.abbr || x.c.t.name, num: x.c.p.number || '' });
  const avg = (rows) => (rows.length ? Math.round(rows.slice(0, 5).reduce((a, r) => a + r.o, 0) / Math.min(5, rows.length)) : 0);
  const ids = user && user.bbLineup && Array.isArray(user.bbLineup.cards) ? user.bbLineup.cards : null;
  if (ids && ids.length >= DUNK_KEEP && ids.length <= DUNK_MAX) {
    const xs = ids.map(info), seen = new Set();
    if (xs.every((x) => x && !seen.has(x.c.pid) && seen.add(x.c.pid))) {
      const rows = xs.map((x, i) => row(x, i, i < 5 ? cards.BB_POS[i] : i === 5 ? '6th' : i === 6 ? '7th' : '8th'));
      return { kind: 'lineup', ovr: avg(rows), players: rows.slice(0, 5), bench: rows.slice(5).map((r) => r.n) };
    }
  }
  const pool = Object.keys(own).map(info).filter(Boolean).sort((a, b) => b.ca.attr.ovr - a.ca.attr.ovr), pick = [], seen = new Set();
  for (const x of pool) { if (!seen.has(x.c.pid)) { seen.add(x.c.pid); pick.push(x); } if (pick.length >= DUNK_KEEP) break; }
  if (pick.length >= DUNK_KEEP) {
    let pos = cards.BB_POS.slice();
    try { const p = cards.bbPlace(pick.slice(0, 5).map((x) => x.ca.attr)); if (Array.isArray(p) && p.length === 5) pos = p; } catch (e) {}
    const rows = pick.map((x, i) => row(x, i, i < 5 ? pos[i] : '6th')).slice(0, 6);
    rows.sort((a, b) => (a.pos === '6th') - (b.pos === '6th') || cards.BB_POS.indexOf(a.pos) - cards.BB_POS.indexOf(b.pos));
    return { kind: 'auto', ovr: avg(rows), players: rows.slice(0, 5), bench: rows.slice(5).map((r) => r.n) };
  }
  return { kind: 'real', ovr: 0, players: [], bench: [] };
}

const CSS = `<style>
.dkv-conn{display:inline-flex;align-items:center;gap:8px;font:600 13px Inter;color:var(--muted);margin:0 0 14px}.dkv-conn:empty{display:none}
.dkv-conn::before{content:'';width:8px;height:8px;border-radius:50%;background:#f5b301}.dkv-conn.ok::before{background:#4ade80}
.dkv-note{display:block;margin:0 0 14px;padding:10px 14px;border-radius:14px;background:var(--card2);border:1px solid var(--line2);font-weight:600}.dkv-note:empty{display:none}
.dkv-note.good{background:rgba(34,197,94,.12);border-color:rgba(74,222,128,.35);color:#4ade80}.dkv-note.bad{background:rgba(239,43,58,.12);border-color:rgba(255,85,99,.35);color:var(--red2)}
.dkv-list{list-style:none;margin:0;padding:0}
.dkv-list li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:8px;padding:10px 4px;border-bottom:1px solid var(--line)}.dkv-list li:last-child{border-bottom:0}
.dkv-dot{width:9px;height:9px;border-radius:50%;background:#4ade80;flex:none}.dkv-dot.playing{background:#f5b301}
.dkv-list .btn{flex:none}.dkv-act{display:flex;gap:6px;flex:none}
.dkv-ch{display:flex;flex-direction:column;gap:2px;margin-right:auto;min-width:0;flex:1 1 140px}.dkv-ch b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dkv-ch small{color:var(--muted);font-size:12.5px}.dkv-ch small.bad{color:var(--red2)}
.dkv-left{font:800 15px var(--disp);color:#fcd34d;font-variant-numeric:tabular-nums;min-width:38px;text-align:right}
.dkv-res .r{margin-left:auto;font-weight:700;white-space:nowrap}.dkv-res .r.up{color:#4ade80}.dkv-res .r.down{color:#ff6b7a}
.dkv-res .res{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:800 13px Inter;background:var(--card3);flex:none}.dkv-res .res.W{background:#4ade80;color:#06230f}.dkv-res .res.L{background:#ff6b7a;color:#2a0509}
#dvIn li{background:rgba(255,194,26,.08);border:1px solid rgba(255,194,26,.35);border-radius:14px;padding:10px 12px;margin-bottom:8px}
.dkv-form>label,.dkv-form .lbl{display:flex;flex-direction:column;gap:6px;font:700 12px Inter;color:var(--ink2);margin:0 0 12px;text-align:left}.dkv-form .lbl{margin:0 0 6px}
.dkv-form input[type=number]{background:var(--card2);color:var(--ink);border:1px solid var(--line2);border-radius:12px;padding:11px;font:700 16px Inter;width:100%}
.dkv-form .arc-modes.dkv-three{grid-template-columns:repeat(3,1fr)}.dkv-form .arc-modes span{padding:10px 6px}
.dkv-form small.hint{display:block;color:var(--muted);text-align:left;margin:-6px 0 12px}.dkv-form .err{min-height:1.2em;margin:4px 0 0}
.dkv-chips{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 10px}
.dkv-brings{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;margin:0 0 6px}.dkv-brings>div{display:flex;flex-direction:column;gap:2px;padding:9px 11px;border-radius:12px;background:var(--card2)}.dkv-brings>div:empty{display:none}.dkv-brings small{color:var(--muted);font-size:11.5px}.dkv-brings b{font-size:13px}
.dkv-wait{text-align:center;padding:22px 16px}.dkv-wait h2{font:800 30px/1 var(--disp);text-transform:uppercase;margin:12px 0 8px}.dkv-wait p{margin:6px 0}
.dkv-terms{font-size:14px}.dkv-host{font:600 13px Inter;color:var(--ink2)}
.dkv-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;margin:12px 0 4px;text-align:left}
.dkv-teams>i{font:800 16px var(--disp);font-style:normal;color:var(--muted);align-self:center;text-transform:uppercase}
.dkv-team{background:var(--card2);border:1px solid var(--line2);border-radius:16px;padding:12px;min-width:0}.dkv-team.me{border-color:rgba(255,194,26,.55)}
.dkv-team-h{display:flex;align-items:center;gap:10px;margin-bottom:8px}.dkv-team-h>div{min-width:0;flex:1}.dkv-team-h b{display:block;font:800 18px/1.1 var(--disp);text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dkv-team-h small{display:block;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dkv-sw{width:14px;height:34px;border-radius:5px;background:var(--c,#ffc21a);box-shadow:inset -5px 0 0 var(--c2,#1b1e27);flex:none}
.dkv-team-h em{font:800 28px/1 var(--disp);font-style:normal;color:#fcd34d;text-align:right;flex:none}.dkv-team-h em small{display:block;font:700 9.5px Inter;letter-spacing:.08em;color:var(--muted)}
.dkv-team ol{list-style:none;margin:0;padding:0}.dkv-team li{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line);font-size:13.5px}.dkv-team li:first-child{border-top:0}
.dkv-team li i{font:800 10px 'Press Start 2P',monospace;font-style:normal;color:#ffc21a;letter-spacing:0}.dkv-team li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dkv-team li b{font:800 15px var(--disp);color:var(--ink)}
.dkv-pv{flex:1 1 100%;margin-top:4px}.dkv-pv summary{cursor:pointer;font:700 12.5px Inter;color:var(--ink2)}.dkv-pv .dkv-teams{margin-top:8px}
.dkv-bench{margin:8px 0 0!important;color:var(--muted);font-size:12px;line-height:1.35}
.dkv-bar{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:100003;display:flex;align-items:center;gap:10px;max-width:calc(100% - 20px);padding:8px 8px 8px 14px;border-radius:999px;background:rgba(15,17,23,.94);border:1px solid var(--line2);box-shadow:0 10px 30px rgba(0,0,0,.6);font:700 14px Inter}
.dkv-bar[hidden]{display:none}.dkv-bar.conn{padding:8px 14px;color:#fcd34d}.dkv-bar .up{color:#4ade80}.dkv-bar .down{color:#ff6b7a}
.dkv-stage{position:relative}.dkv-stage-top{display:flex;justify-content:flex-end;margin:0 0 8px}
.dkv-mine .dkv-team{background:transparent;border:0;padding:0}
.dkv-mine-s{color:var(--ink2);font-size:13.5px;margin:0 0 10px}
body.dkv-playing .ftr{display:none}
@media(max-width:760px){.dkv-list li{padding:10px 2px}.dkv-wait h2{font-size:26px}.dkv-teams{grid-template-columns:1fr;gap:8px}.dkv-teams>i{justify-self:center}.dkv-team li{font-size:13px;padding:4px 0}}
</style>`;

module.exports = function dunkVersusPage(app, h) {
  const { esc, icon, coins, layout, load, refresh, getDoc, userKey, currentUser, accountOf, survivorNow, assetUrl } = h;
  const gameScript = (file) => `<script src="${esc(assetUrl('arcade/' + file + '.js'))}"></script>`;

  const mineCard = (L) => {
    if (!L) return '';
    if (L.kind === 'real') return `<p class="dkv-mine-s">You have no saved Dunk lineup and fewer than six cards, so you play as a real MFL team. <a href="/arcade/dunk3d">Build a lineup →</a></p>`;
    const rows = L.players.map((p) => `<li><i>${esc(p.pos)}</i><span>${esc(p.n)}</span><b>${p.o}</b></li>`).join('');
    return `<p class="dkv-mine-s">${L.kind === 'lineup' ? 'Your saved Dunk lineup takes the court.' : 'No saved Dunk lineup: your six best cards play (auto-pick).'} Team overall <b>${L.ovr}</b>. <a href="/arcade/dunk3d">Edit lineup →</a></p>
      <div class="dkv-mine"><div class="dkv-team"><ol>${rows}</ol>${L.bench.length ? `<p class="dkv-bench">Bench: ${esc(L.bench.join(', '))}</p>` : ''}</div></div>`;
  };

  app.get(PAGE, async (req, res, next) => {
    try {
      await refresh();
      const db = load();
      const name = currentUser(req);
      const user = name ? await getDoc(userKey(name), { fresh: true }) : null;
      let balance = null;
      if (user) { try { balance = accountOf(db, user, await survivorNow(db)).balance; } catch (e) { balance = 0; } }
      const secs = Math.round((Number(process.env.VERSUS_GONE_MS) > 0 ? Number(process.env.VERSUS_GONE_MS) : 60e3) / 1000);
      const firstTeam = Object.values(db.teams)[0];
      const how = `<section class="card"><div class="card-h"><h2>How it works</h2></div><ul class="how">
        <li>Pick someone under <b>Online now</b> and send a challenge: a wager of 0 to ${fmtN(MAX_WAGER)} coins (0 is a friendly) and 1, 2 or 3-minute quarters. They have a minute to accept.</li>
        <li>When they accept, both wagers are held until the game ends. The winner gets both: 2× the wager.</li>
        <li>Your saved Dunk lineup takes the court. No lineup yet? Your six best cards play, and with fewer than six cards you play as the ${esc(firstTeam ? firstTeam.name : 'MFL')}. The same real player can be on both sides. Your teammates and theirs play at the All-Pro level.</li>
        <li>4 quarters, a tie goes to overtime, 3 timeouts each, subs at timeouts and quarter breaks, no pause. One of the two browsers runs the game (the lobby says which): keep this page open and in front.</li>
        <li>Quitting after the tip counts as a loss. Lose your connection and you have ${secs} seconds to come back. If the server restarts, or the game can't be finished, both wagers come back.</li></ul></section>`;
      const head = `<div class="arc-head"><a href="/arcade/dunk3d" class="muted sm">${icon('arrow')} 3D Dunk</a><h1><span>🏀</span> Head to Head</h1><p class="muted">3D Dunk, live, against another MFL player. Put coins on it, or play a friendly.</p>${user ? `<span class="arc-bal"><span class="coins">${icon('coin')}<span data-balance>${fmtN(balance)}</span></span></span>` : ''}</div>`;
      if (!user) {
        return res.send(layout(req, 'Dunk Head to Head', `${CSS}<div class="wrap arc-page dkv-page">${head}
          <section class="card"><p>Log in to see who's online and challenge them to a game of 3D Dunk.</p><div class="arc-cta"><a class="btn" href="/pickem/login?next=${encodeURIComponent(PAGE)}">Log in</a><a class="btn ghost" href="/pickem/signup">Sign up free</a></div></section>${how}</div>`));
      }
      let mine = null;
      try { mine = lineupOf(db, user); } catch (e) { console.error('dunk versus: lineup', e); }
      let results = [];
      try { if (typeof h.results === 'function') results = h.results(user, 'dunk3d') || []; } catch (e) {}
      const boot = { me: user.name, balance, results, gone: secs, qs: QS, maxWager: MAX_WAGER, game: 'dunk3d', mine: mine ? { kind: mine.kind, ovr: mine.ovr } : null };
      res.send(layout(req, 'Dunk Head to Head', `${CSS}<div class="wrap arc-page dkv-page">${head}
        <div id="dvLobby">
          <p class="dkv-conn" id="dvConn">Connecting…</p>
          <p class="dkv-note" id="dvNote"></p>
          <div class="home-grid"><div class="col">
            <section class="card" id="dvInCard" hidden><div class="card-h"><h2>${icon('fire')} Challenges for you</h2></div><ol class="dkv-list" id="dvIn"></ol></section>
            <section class="card" id="dvOutCard" hidden><div class="card-h"><h2>Your challenge</h2></div><ol class="dkv-list" id="dvOut"></ol></section>
            <section class="card"><div class="card-h"><h2>Online now</h2><span class="muted sm" id="dvCount"></span></div>
              <ol class="dkv-list" id="dvOnline"></ol><p class="empty" id="dvNobody" hidden>Nobody else is here right now. Send a friend this page: they'll show up here when they open it.</p></section>
            <section class="card"><div class="card-h"><h2>Your team</h2></div>${mineCard(mine)}</section>
          </div><div class="col">
            <section class="card"><div class="card-h"><h2>Your Head to Head games</h2></div><ol class="dkv-list dkv-res" id="dvResults"></ol><p class="empty" id="dvNoResults" hidden>No games yet.</p></section>
            ${how}
          </div></div>
        </div>
        <section id="dvStage" class="arc-stage dkv-stage" hidden></section>
      </div>
      <div class="dkv-bar conn" id="dvBar" hidden></div>
      <script>window.MFL_DUNKVS=${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>
      ${gameScript('dunk3d')}${gameScript('vsnet')}${gameScript('dunkversus')}`));
    } catch (e) { next(e); }
  });
};

module.exports.PAGE = PAGE;
module.exports.MAX_WAGER = MAX_WAGER;
module.exports.lineupOf = lineupOf;
// the promo card for the 3D Dunk page (the same look as the one on the 3D Blitz page)
module.exports.link = () => `<a class="card bf-promo" href="${PAGE}"><span class="bf-promo-e">🆚</span><div><b>Head to Head</b><small>Play another MFL player live, your Dunk lineup against theirs. Put up to ${fmtN(MAX_WAGER)} coins on it, or play a friendly.</small></div><span class="btn">Play</span></a>`;
module.exports.CSS = CSS;
