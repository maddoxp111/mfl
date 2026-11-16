// 3D Dunk Head to Head: the constants of the mode, host choice and the server's score witness.
//
// A Dunk match is played on the host's screen (it runs the whole game and streams snapshots to the guest, who plays his own man).
// A host with developer tools could send false snapshots, so the server watches what it relays. It reads only the fixed fields
// of the host's snapshot frames (0x53: clock, score, ball position) and checks, as the game goes on:
//   - every point needs the ball inside the scoring side's hoop in the last two seconds of the host's own time (and each pass of
//     the ball through the hoop pays once), 1 to 3 points at a time, and no side scores faster than the pace limit;
//   - scores never go down, the quarter only moves on at the end of a quarter, the clock never runs backwards inside a quarter
//     and never runs faster than the host's own time, and the host's time never runs faster than real time (x1.15 and a slack);
//   - at the end both players report their final score (the guest's screen recomputes nothing: he reports what he was shown)
//     and both must agree with each other and with the witness.
// A match that breaks a rule is marked: a marked match pays nobody (both stakes back). A plain loss never voids a match.
// VERSUS_LOOSE=1 turns the real-time checks off (tests there play at several times real speed).
const DUNK = {
  GAME: 'dunk3d',
  MAX_WAGER: 2000, // coins per game (until the game is refereed by the server)
  QS: [60, 120, 180], // quarter lengths in seconds
  DEFAULT_QS: 120,
  LEVEL: 2, // the AI teammates of both players play at this level (All-Pro)
  EARLY_SECS: 20, // a player who leaves in the first 20 seconds of game time voids the match instead of losing it
  FINAL_WAIT_MS: Number(process.env.VERSUS_FINAL_MS) > 0 ? Number(process.env.VERSUS_FINAL_MS) : 8000, // after the whistle, how long the other player's final score is waited for
  HTTP_HOLD_MS: 2000, // the HTTPS fallback's long poll while a Dunk lobby/match is open (Blitz holds 8 s)
  RATE: { text: 60, bin: 90 },
  HOST_STALE_MS: 4000, // the host's snapshots stopped this long before his connection did: nobody is to blame
};

// ---------- who hosts ----------
// a, b: { http: bool (on the HTTPS fallback), rtt: ms or null, touch: bool, ram, cores }. -> 0 (a hosts) or 1 (b hosts).
// A WebSocket beats the fallback, then the clearly lower round trip (15 ms or more), then a computer over a phone or tablet,
// then more memory/cores, then a coin flip (rnd() in [0,1)).
function pickHost(a, b, rnd) {
  const A = a || {}, B = b || {};
  if (!!A.http !== !!B.http) return A.http ? 1 : 0;
  const ra = Number(A.rtt), rb = Number(B.rtt);
  if (Number.isFinite(ra) && Number.isFinite(rb) && ra > 0 && rb > 0 && Math.abs(ra - rb) >= 15) return ra < rb ? 0 : 1;
  if (!!A.touch !== !!B.touch) return A.touch ? 1 : 0;
  const pa = (Number(A.ram) || 0) * 4 + (Number(A.cores) || 0), pb = (Number(B.ram) || 0) * 4 + (Number(B.cores) || 0);
  if (pa !== pb && Math.abs(pa - pb) >= 4) return pa > pb ? 0 : 1;
  return (rnd || Math.random)() < 0.5 ? 0 : 1;
}
const cleanCap = (c) => {
  const o = c && typeof c === 'object' ? c : {}, num = (v, max) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.min(max, Number(v)) : null);
  return { touch: !!o.touch, ram: num(o.ram, 64), cores: num(o.cores, 128), rtt: num(o.rtt, 5000) };
};

// ---------- the snapshot frame (see 96-net.js in the engine): header 32 B, ten men of 16 B, ball 17 B ----------
const SNAP = 0x53, HEAD = 32, MAN = 16, BALL = 17;
const RIM_X = 12.25, RIM_Y = 3.333; // yards (11-court.js): the hoops are at x = +-12.25, z = 0
const HOOP_R = 1.0, HOOP_Y0 = 2.4, HOOP_Y1 = 4.2; // a ball sample this close to the rim counts as the ball being in the hoop
function parseSnap(buf) {
  if (!buf || buf.length < HEAD + BALL + MAN || buf[0] !== SNAP) return null;
  const n = (buf.length - HEAD - BALL) / MAN;
  if (n !== (n | 0) || n < 1 || n > 12) return null;
  const rd16 = (o) => buf.readUInt16LE(o), ri16 = (o) => buf.readInt16LE(o), b = HEAD + n * MAN;
  return {
    seq: rd16(1), ts: buf.readUInt32LE(3), ph: buf[13], fl: buf[14], qtr: buf[15], clock: rd16(16) / 50, hs: rd16(20), as: rd16(22),
    ball: { st: buf[b], holder: buf[b + 1], x: ri16(b + 5) / 500, y: ri16(b + 7) / 500, z: ri16(b + 9) / 500 },
  };
}
// the side (0 home/host, 1 away/guest) attacks +x in quarters 1 and 2 (and odd overtimes) for side 0, as the engine's dirOf
const dirOf = (side, qtr) => ((side === 0) === (qtr <= 2 || (qtr > 4 && qtr % 2 === 1)) ? 1 : -1);
const inHoop = (s, dir) => Math.abs(s.x - dir * RIM_X) <= HOOP_R && Math.abs(s.z) <= HOOP_R && s.y >= HOOP_Y0 && s.y <= HOOP_Y1;

function createWitness(opts) {
  const o = opts || {}, qs = o.qs || DUNK.DEFAULT_QS, loose = !!o.loose;
  const W = {
    qs, snaps: 0, bad: 0, flagged: 0, reasons: [], score: [0, 0], qtr: 1, clock: qs, ph: 0, ts: 0, at: 0, firstAt: 0, firstTs: 0, rejected: 0,
    samples: [], used: 0, last: null, pts: [[], []],
    flag(why) { this.flagged++; if (this.reasons.length < 20) this.reasons.push(why); },
    // game seconds played (regulation), for the 'first 20 seconds' rule
    elapsed() { return this.snaps ? (this.qtr > 4 ? 4 * qs : (this.qtr - 1) * qs + (qs - this.clock)) : 0; },
    // the end of the game as the snapshots show it: the fourth quarter or overtime at 0:00 (or the engine's own 'over'), not tied
    ended() { return this.snaps > 0 && this.qtr >= 4 && (this.clock <= 1.5 || this.ph >= 8) && this.score[0] !== this.score[1]; }, // (the host's own 'over' flag counts only in the fourth quarter or overtime: a host cannot end the game early by setting it)
    snap(buf, now) {
      const s = parseSnap(buf);
      if (!s) { this.bad++; return false; }
      const prev = this.last, dtMs = prev ? s.ts - prev.ts : 0;
      if (!prev) { this.firstAt = now; this.firstTs = s.ts; }
      if (prev) {
        // the host's own time: forward, and no faster than real time
        if (dtMs < -50) this.flag(`host time went back ${dtMs} ms`);
        if (!loose && (s.ts - this.firstTs) > (now - this.firstAt) * 1.15 + 3000) this.flag(`host time ahead of real time (${s.ts - this.firstTs} ms in ${now - this.firstAt} ms)`);
        // the quarter: forward by one at most, and only at the end of one
        if (s.qtr < prev.qtr) this.flag(`quarter went back ${prev.qtr} to ${s.qtr}`);
        else if (s.qtr > prev.qtr && (s.qtr - prev.qtr > 1 || (!loose && prev.clock > 2.5 && prev.ph < 8))) this.flag(`quarter moved on ${prev.qtr} to ${s.qtr} with ${prev.clock}s left`);
        else if (s.qtr === prev.qtr) {
          // the clock: down only, no faster than the host's time between the two frames
          if (s.clock > prev.clock + 0.3) this.flag(`clock went up ${prev.clock} to ${s.clock}`);
          else if (!loose && prev.clock - s.clock > Math.max(0, dtMs) / 1000 * 1.15 + 0.6) this.flag(`clock ran ${(prev.clock - s.clock).toFixed(2)}s in ${dtMs} ms`);
        }
        if (s.hs < prev.hs || s.as < prev.as) this.flag(`score went down ${prev.hs}-${prev.as} to ${s.hs}-${s.as}`);
      } else if (s.hs + s.as > 12) this.flag(`first frame already ${s.hs}-${s.as}`);
      // the ball: a trail of samples (the host's time), kept for two and a half seconds
      this.samples.push({ ts: s.ts, x: s.ball.x, y: s.ball.y, z: s.ball.z, qtr: s.qtr });
      while (this.samples.length && s.ts - this.samples[0].ts > 2500) this.samples.shift();
      // points: each needs a pass of the ball through that side's hoop in the last 2 s, a new pass for every score
      const sc = [s.hs, s.as];
      for (let side = 0; side < 2; side++) {
        const d = sc[side] - this.score[side];
        if (d <= 0) continue;
        if (d > 3) { this.flag(`side ${side} +${d} in one frame`); this.score[side] = sc[side]; continue; }
        const dirs = prev && prev.qtr !== s.qtr ? [dirOf(side, prev.qtr), dirOf(side, s.qtr)] : [dirOf(side, s.qtr)];
        let hit = null;
        for (const m of this.samples) if (m.ts > this.used + 300 && s.ts - m.ts <= 2000 && m.ts <= s.ts && dirs.some((dr) => inHoop(m, dr))) hit = m; // the latest
        if (!hit) this.flag(`side ${side} +${d} with no ball in the hoop`);
        else this.used = hit.ts;
        // pace: no side scores more than 10 points in 10 s of the host's time, and 14 between them
        const w = this.pts[side];
        while (w.length && s.ts - w[0].ts > 10000) w.shift();
        w.push({ ts: s.ts, n: d });
        const mine = w.reduce((a, x) => a + x.n, 0), all = mine + this.pts[1 - side].filter((x) => s.ts - x.ts <= 10000).reduce((a, x) => a + x.n, 0);
        if (mine > 10 || all > 14) this.flag(`pace: ${mine} for side ${side}, ${all} together in 10 s`);
        this.score[side] = sc[side];
      }
      this.qtr = s.qtr; this.clock = s.clock; this.ph = s.ph; this.ts = s.ts; this.at = now; this.last = s; this.snaps++;
      return true;
    },
    // What the match is worth once the finals are in. fin = { host: {hs, as}|null, guest: {hs, as}|null }; waited = the wait for the
    // other's final has run out. -> null (not decided yet) or { winner: 0|1|null, reason, disagree?: 'host'|'guest' }
    verdict(fin, waited) {
      if (this.flagged) return { winner: null, reason: 'review' };
      if (!this.snaps) return { winner: null, reason: 'review' };
      const [h, g] = [fin.host, fin.guest], w = { hs: this.score[0], as: this.score[1] };
      const same = (a, b) => !!a && !!b && a.hs === b.hs && a.as === b.as;
      if (h && g && !same(h, g)) {
        // exactly one of the two agrees with what the server saw: that one is right, and the other cannot void the game by lying (a loser's false final)
        const hm = same(h, w), gm = same(g, w);
        if (hm !== gm && w.hs !== w.as) return { winner: w.hs > w.as ? 0 : 1, reason: 'final', disagree: hm ? 'guest' : 'host' };
        return { winner: null, reason: 'dispute', disagree: hm ? 'guest' : gm ? 'host' : 'both' };
      }
      if (!(h && g) && !waited) return null;
      const f = h || g;
      if (!f) return { winner: null, reason: 'review' }; // no final from anyone
      if (!same(f, w)) return { winner: null, reason: 'dispute', disagree: h && !same(h, w) ? 'host' : 'guest' };
      if (w.hs === w.as) return { winner: null, reason: 'tie' };
      return { winner: w.hs > w.as ? 0 : 1, reason: 'final' };
    },
  };
  return W;
}

module.exports = { DUNK, pickHost, cleanCap, parseSnap, createWitness, dirOf, inHoop, RIM_X, RIM_Y };
