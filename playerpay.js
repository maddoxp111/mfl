// "Your player": the admin links an account to a real MFL player, and the account earns
// coins from that player's real games. Worked out live from the box scores like every
// other balance, so linking pays every past game, unlinking takes it all back, and
// fixing a box score fixes the coins.

// Coins per game. The admin can change each one on /admin/pickem (saved in db.playerPay).
const PAYOUTS = {
  win: 50000, //       his team wins the game
  tdScored: 125000, // he scores a TD (a catch or a run)
  tdPass: 75000, //    he throws a TD pass
  int: 50000, //       he intercepts a pass
  pbu: 25000, //       pass breakup
  catch: 25000, //     notable catch
  play: 25000, //      notable play
  threwInt: -25000, // he throws an interception
  pen: -25000, //      a penalty called on him
  flag: 0, //          flag pull (he pulled someone's flag)
};
const LABELS = { win: 'Team win', tdScored: 'TD scored', tdPass: 'TD pass', int: 'Interception', pbu: 'Pass breakup', catch: 'Notable catch', play: 'Notable play', threwInt: 'Interception thrown', pen: 'Penalty', flag: 'Flag pull' };
const RULES = { win: 'his team wins the game', tdScored: 'he scores a touchdown (catch or run)', tdPass: 'he throws a touchdown pass', int: 'he intercepts a pass', pbu: 'he breaks up a pass', catch: 'he makes a notable catch', play: 'he makes a notable play', threwInt: 'he throws an interception', pen: 'a penalty is called on him', flag: 'he pulls a flag' };
const ORDER = Object.keys(PAYOUTS);
// Box-score plays that pay the player named on them (TDs and INTs are handled on their own).
const PLAY_KEY = { PBU: 'pbu', CATCH: 'catch', PLAY: 'play', PEN: 'pen', FLAG: 'flag' };
const MAX_PAY = 10000000;

const isFinal = (g) => g.status === 'final' && g.homeScore != null && g.awayScore != null;
const low = (s) => String(s || '').trim().toLowerCase();
const other = (g, id) => (g.home === id ? g.away : g.home);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const sgn = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

// The defaults with the admin's changes on top.
function payTable(db) {
  const out = { ...PAYOUTS };
  for (const [k, v] of Object.entries((db && db.playerPay) || {})) {
    if (k in PAYOUTS && v !== '' && v != null && Number.isFinite(+v)) out[k] = Math.max(-MAX_PAY, Math.min(MAX_PAY, Math.trunc(+v)));
  }
  return out;
}

// The linked player as he is now: { team (null once released), p }. Links are saved as
// { team, pid, name }; a trade can move him (and change his id), so fall back to his id
// on any team, then his name.
function findPlayer(db, link) {
  if (!link || !link.pid) return null;
  const teams = Object.values(db.teams || {});
  const t0 = db.teams && db.teams[link.team];
  const here = t0 && t0.roster.find((x) => x.id === link.pid);
  if (here) return { team: t0, p: here };
  for (const t of teams) { const p = t.roster.find((x) => x.id === link.pid && (!link.name || low(x.name) === low(link.name))); if (p) return { team: t, p }; }
  for (const t of teams) { const p = link.name && t.roster.find((x) => low(x.name) === low(link.name)); if (p) return { team: t, p }; }
  return link.name ? { team: null, p: { id: link.pid, name: link.name } } : null;
}

// His team in one game: the side his plays were credited to. With no plays, the team he was
// on that day: start from his team now and undo every trade, signing and release dated after
// the game (a move dated on game day counts for that game).
function teamFor(g, name, cur, txs, unique) {
  const sides = [g.home, g.away];
  if (unique) {
    const hits = new Set();
    for (const e of g.events || []) {
      if (!sides.includes(e.team)) continue;
      if (low(e.player) === name) hits.add(e.team);
      // The "thrown by" player is on the same team for a TD or catch, the other team for an INT, breakup or sack.
      if (low(e.passer) === name) hits.add(e.type === 'TD' || e.type === 'CATCH' ? e.team : other(g, e.team));
    }
    if (hits.size === 1) return [...hits][0];
  }
  let t = cur;
  for (const tx of txs) {
    if (!g.date || !(tx.date > g.date)) break;
    const inn = (tx.in || []).some((n) => low(n) === name), out = (tx.out || []).some((n) => low(n) === name);
    if (tx.type === 'trade') { if (out) t = tx.team; else if (inn) t = tx.team2; }
    else if (tx.type === 'signing' && inn) t = null;
    else if (tx.type === 'release' && out) t = tx.team;
  }
  return sides.includes(t) ? t : null;
}

// Every final game he played, oldest first:
// { game, team, opp, won, result 'W'|'L'|'T', my, their, score '14–7' (his first),
//   lines [{ key, label, n, each, coins }], raw, total, voided }.
// Deductions come off that game's total, but a game never pays below 0, and a game the
// commissioner voided pays nothing. Games he was ruled out of don't count.
function playerGames(db, link) {
  const who = findPlayer(db, link);
  if (!who) return [];
  const name = low(who.p.name), pay = payTable(db);
  const unique = Object.values(db.teams || {}).flatMap((t) => t.roster).filter((p) => low(p.name) === name).length <= 1;
  const txs = (db.transactions || []).filter((tx) => tx.date && ['trade', 'signing', 'release'].includes(tx.type))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0));
  const out = [];
  const games = (db.games || []).filter(isFinal).sort((a, b) => `${a.date || '9'} ${a.time || ''}`.localeCompare(`${b.date || '9'} ${b.time || ''}`));
  for (const g of games) {
    const team = teamFor(g, name, who.team ? who.team.id : null, txs, unique);
    if (!team) continue;
    if ((g.out || []).some((k) => k === `${team}|${who.p.id}` || k === `${team}|${link.pid}`)) continue;
    const opp = other(g, team);
    const my = g.home === team ? g.homeScore : g.awayScore, their = g.home === team ? g.awayScore : g.homeScore;
    const result = my > their ? 'W' : my < their ? 'L' : 'T';
    const n = Object.fromEntries(ORDER.map((k) => [k, 0]));
    n.win = result === 'W' ? 1 : 0;
    for (const e of g.events || []) {
      const mine = e.team === team, by = low(e.player) === name, threw = low(e.passer) === name;
      if (e.type === 'TD') { if (mine && by) n.tdScored++; if (mine && threw) n.tdPass++; }
      else if (e.type === 'INT') { if (mine && by) n.int++; if (e.team === opp && threw) n.threwInt++; }
      else if (PLAY_KEY[e.type] && mine && by) n[PLAY_KEY[e.type]]++;
    }
    const lines = ORDER.filter((k) => n[k] && pay[k]).map((k) => ({ key: k, label: LABELS[k], n: n[k], each: pay[k], coins: n[k] * pay[k] }));
    const raw = lines.reduce((s, l) => s + l.coins, 0);
    const voided = !!g.betsVoid;
    out.push({ game: g, team, opp, won: result === 'W', result, my, their, score: `${my}–${their}`, lines, raw, total: voided ? 0 : Math.max(0, raw), voided });
  }
  return out;
}
function playerTotal(db, link) {
  return playerGames(db, link).reduce((s, x) => s + x.total, 0);
}

// "You beat KTCS 14–7" (the higher score first).
function resultText(db, gp) {
  const opp = esc((db.teams[gp.opp] || {}).name || 'them');
  const hi = Math.max(gp.my, gp.their), lo = Math.min(gp.my, gp.their);
  return gp.result === 'W' ? `You beat ${opp} ${hi}–${lo}` : gp.result === 'L' ? `You lost to ${opp} ${hi}–${lo}` : `You tied ${opp} ${hi}–${lo}`;
}
// One game's lines as rows (the same look as the coin breakdown).
function linesHtml(gp, totalLabel) {
  const rows = gp.lines.map((l) => `<div><span>${esc(l.label)}${l.n > 1 ? ` × ${l.n}<small>${sgn(l.each)} each</small>` : ''}</span><b class="${l.coins > 0 ? 'up' : 'down'}">${sgn(l.coins)}</b></div>`).join('');
  const note = gp.voided ? 'The commissioner voided this game, so it pays no coins.' : gp.raw < 0 ? 'Deductions stop at 0: playing never costs you coins.' : '';
  return `<div class="pb-rows">${rows || '<div><span class="muted">No plays that pay this game</span><b class="zero">0</b></div>'}${totalLabel ? `<div class="tot"><span>${totalLabel}</span><b>${sgn(gp.total)}</b></div>` : ''}</div>${note ? `<p class="pp-note">${note}</p>` : ''}`;
}

// Popups for the account's next page: a welcome with the back pay right after linking, then
// one per final game he played that the account hasn't seen yet (voided games don't pop).
// link.seen = game ids already shown, link.welcomed = the welcome was closed.
function popups(db, link, seenUrl, max = 5) {
  if (!link) return [];
  const games = playerGames(db, link), who = findPlayer(db, link);
  const seen = new Set((link.seen || []).map(String)), pops = [];
  if (!link.welcomed && who) {
    const back = games.filter((x) => seen.has(String(x.game.id)) && !x.voided);
    const total = back.reduce((s, x) => s + x.total, 0);
    // what his earlier games added up to, line by line (a game that went below 0 paid 0: that shows as its own line)
    const sum = {};
    for (const x of back) for (const l of x.lines) { const o = sum[l.key] || (sum[l.key] = { key: l.key, label: l.label, n: 0, each: l.each, coins: 0 }); o.n += l.n; o.coins += l.coins; }
    const lines = ORDER.map((k) => sum[k]).filter(Boolean), raw = lines.reduce((t, l) => t + l.coins, 0);
    if (total > raw) lines.push({ key: 'floor', label: 'Not taken (a game never pays below 0)', n: 1, each: total - raw, coins: total - raw });
    const linked = `<p>Your account is now linked to your real player: <b>${esc(who.p.name)}</b>${who.team ? ` (${esc(who.team.name)})` : ''}.</p>`;
    pops.push({ id: 'pp-welcome', title: back.length && total > 0 ? 'You got coins!' : 'Your player', seen: seenUrl, button: "Let's go",
      html: linked + (back.length
        ? `<p>You got <b>${fmt(total)} coins</b> for your performance in your ${back.length} previous game${back.length === 1 ? '' : 's'}:</p>${linesHtml({ lines, total, raw: total, voided: false }, 'Coins from past games')}<p>From now on, every game you play pays: wins, touchdowns, interceptions and more, with a popup after each one.</p>`
        : '<p>Every game you play earns you coins: wins, touchdowns, interceptions and more. Your first game pays as soon as it is final.</p>') });
  }
  for (const gp of games) {
    if (pops.length >= max) break;
    if (gp.voided || seen.has(String(gp.game.id))) continue;
    pops.push({ id: 'pp-g' + gp.game.id, title: gp.won ? 'Congrats!' : 'Game recap', seen: seenUrl, button: gp.won ? 'Nice!' : 'Got it',
      html: `<p class="pp-pop-h">${resultText(db, gp)}</p>${linesHtml(gp, 'Coins earned')}<p>${gp.total > 0 ? `You earned <b>${fmt(gp.total)} coins</b>.` : 'No coins this game.'}</p>` });
  }
  return pops;
}

module.exports = { PAYOUTS, LABELS, RULES, ORDER, payTable, findPlayer, playerGames, playerTotal, resultText, linesHtml, popups };
