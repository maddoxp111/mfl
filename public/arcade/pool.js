/* MFL Arcade: 8-Ball Pool.
 *
 * Top-down canvas pool vs a CPU with 4 levels. World units: the playing surface is 200 x 100,
 * ball radius 2.8. Physics runs at a fixed 900 Hz step (no tunneling at max speed: < 0.8 units/step),
 * with sliding -> rolling friction, elastic ball-ball impacts, cushion + pocket-jaw segments.
 *
 * The physics/rules/AI core has no DOM use and is exported for Node tests (module.exports).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 200, H = 100, R = 2.8, D2 = 4 * R * R;
  const CUSH = 3.4, WOOD = 6.5, EDGE = CUSH + WOOD;
  const CM = 7.0, SM = 5.0, JC = 2.2, JS = 1.0; // corner/side mouth half-openings and jaw slants
  const HSTEP = 1 / 900;
  const V_MAX = 700, F_ROLL = 26, D_LIN = 0.4, A_SLIDE = 450, E_BALL = 0.97, E_CUSH = 0.78, V_STOP = 1.0;
  const BREAK_BOOST = 1.4; // the break shot hits harder (max ~980 units/s, still < R/2 per step)
  const CUE_ROLL = 0.5; // fraction of natural roll the cue ball gets when struck (a little follow)
  const HEAD = { x: 50, y: 50 }, FOOT = { x: 150, y: 50 };
  const MAX_SHOT_T = 25; // seconds; any shot is force-stopped after this (never happens in practice)

  const SQ = Math.SQRT1_2;
  // r: capture radius, dr: drawn hole, aim: mouth centre (best line in, measured), dir: into the pocket,
  // minCos: steepest approach that still drops (measured in sim), halfW: centre-line tolerance at the mouth.
  const POCKETS = [
    { x: -1.4, y: -1.4, r: 5.0, dr: 5.5, aim: { x: 3.2, y: 3.2 }, dir: { x: -SQ, y: -SQ }, minCos: 0.66, halfW: 2.3 },
    { x: 100, y: -3.4, r: 4.0, dr: 4.7, aim: { x: 100, y: 0 }, dir: { x: 0, y: -1 }, minCos: 0.68, halfW: 2.3 },
    { x: W + 1.4, y: -1.4, r: 5.0, dr: 5.5, aim: { x: W - 3.2, y: 3.2 }, dir: { x: SQ, y: -SQ }, minCos: 0.66, halfW: 2.3 },
    { x: -1.4, y: H + 1.4, r: 5.0, dr: 5.5, aim: { x: 3.2, y: H - 3.2 }, dir: { x: -SQ, y: SQ }, minCos: 0.66, halfW: 2.3 },
    { x: 100, y: H + 3.4, r: 4.0, dr: 4.7, aim: { x: 100, y: H }, dir: { x: 0, y: 1 }, minCos: 0.68, halfW: 2.3 },
    { x: W + 1.4, y: H + 1.4, r: 5.0, dr: 5.5, aim: { x: W - 3.2, y: H - 3.2 }, dir: { x: SQ, y: SQ }, minCos: 0.66, halfW: 2.3 },
  ];

  // Cushion polygons (for drawing) and their playing-side segments (for physics).
  const CUSHIONS = (function () {
    const top = [
      [[CM, 0], [100 - SM, 0], [100 - SM + JS, -CUSH], [CM - JC, -CUSH]],
      [[100 + SM, 0], [W - CM, 0], [W - CM + JC, -CUSH], [100 + SM - JS, -CUSH]],
    ];
    const out = [];
    for (const p of top) { out.push(p); out.push(p.map(([x, y]) => [x, H - y])); }
    const left = [[0, CM], [0, H - CM], [-CUSH, H - CM + JC], [-CUSH, CM - JC]];
    out.push(left); out.push(left.map(([x, y]) => [W - x, y]));
    return out;
  })();
  const SEGS = (function () {
    const s = [];
    for (const p of CUSHIONS) {
      // nose (p0-p1) and the two jaws (p1-p2, p0-p3)
      for (const [a, b] of [[p[0], p[1]], [p[1], p[2]], [p[0], p[3]]]) {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        s.push({ ax: a[0], ay: a[1], dx, dy, l2: dx * dx + dy * dy });
      }
    }
    return s;
  })();

  const isSolid = (n) => n >= 1 && n <= 7;
  const isStripe = (n) => n >= 9 && n <= 15;
  const groupOf = (n) => (isSolid(n) ? 'solids' : isStripe(n) ? 'stripes' : null);
  const other = (g) => (g === 'solids' ? 'stripes' : g === 'stripes' ? 'solids' : null);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // ---------------------------------------------------------------- physics
  function makeBall(n, x, y) { return { n, x, y, vx: 0, vy: 0, ux: 0, uy: 0, on: true, m: false, rx: 0, ry: 0 }; }

  function rack(rnd) {
    const balls = [makeBall(0, HEAD.x, HEAD.y)];
    // 8 in the middle, one solid + one stripe in the back corners, the rest shuffled.
    const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(solids); shuffle(stripes);
    const apex = rnd() < 0.5 ? solids.pop() : stripes.pop();
    const cornerA = solids.pop(), cornerB = stripes.pop();
    const rest = shuffle(solids.concat(stripes));
    const sp = 2 * R + 0.01, dx = sp * Math.sqrt(3) / 2;
    const slots = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j <= i; j++) slots.push([i, j]);
    const flip = rnd() < 0.5;
    const pos = [];
    for (const [i, j] of slots) {
      let n;
      if (i === 0) n = apex;
      else if (i === 2 && j === 1) n = 8;
      else if (i === 4 && j === 0) n = flip ? cornerA : cornerB;
      else if (i === 4 && j === 4) n = flip ? cornerB : cornerA;
      else n = rest.pop();
      const jx = (rnd() - 0.5) * 0.006, jy = (rnd() - 0.5) * 0.006;
      pos[n] = [FOOT.x + i * dx + jx, FOOT.y + (j - i / 2) * sp + jy];
    }
    for (let n = 1; n <= 15; n++) balls[n] = makeBall(n, pos[n][0], pos[n][1]);
    return balls;
  }

  function newEv() { return { first: -1, pocketed: [], rails: 0, clacks: [], pockets: [] }; }

  function pocketBall(b, p, ev) {
    b.on = false; b.m = false; b.vx = b.vy = b.ux = b.uy = 0;
    ev.pocketed.push(b.n); ev.pockets.push({ n: b.n, x: b.x, y: b.y, px: p.x, py: p.y });
  }

  function step(balls, h, ev) {
    const n = balls.length;
    // integrate friction + motion
    for (let i = 0; i < n; i++) {
      const b = balls[i];
      if (!b.on || !b.m) continue;
      let rx = b.ux - b.vx, ry = b.uy - b.vy;
      const rel = Math.sqrt(rx * rx + ry * ry);
      if (rel > 1e-6) {
        const k = Math.min(rel, A_SLIDE * h) / rel; rx *= k; ry *= k;
        b.vx += rx * (2 / 7); b.vy += ry * (2 / 7); b.ux -= rx * (5 / 7); b.uy -= ry * (5 / 7);
      }
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > 0) { const dec = (F_ROLL + D_LIN * sp) * h, k = sp > dec ? (sp - dec) / sp : 0; b.vx *= k; b.vy *= k; }
      const su = Math.sqrt(b.ux * b.ux + b.uy * b.uy);
      if (su > 0) { const dec = (F_ROLL + D_LIN * su) * h, k = su > dec ? (su - dec) / su : 0; b.ux *= k; b.uy *= k; }
      if (sp < V_STOP && su < V_STOP) { b.vx = b.vy = b.ux = b.uy = 0; b.m = false; continue; }
      b.x += b.vx * h; b.y += b.vy * h;
      b.rx += b.ux * h; b.ry += b.uy * h;
    }
    // ball-ball
    for (let i = 0; i < n; i++) {
      const a = balls[i];
      if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const b = balls[j];
        if (!b.on || (!a.m && !b.m)) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        // Rewind to the exact moment of contact (within this step) so the impact normal is exact.
        const wx = b.vx - a.vx, wy = b.vy - a.vy, w2 = wx * wx + wy * wy, pw = dx * wx + dy * wy;
        let tc = 0;
        if (pw < 0 && w2 > 1e-9) {
          const disc = pw * pw - w2 * (d2 - D2);
          tc = (-pw - Math.sqrt(Math.max(0, disc))) / w2; // <= 0
          if (tc < -h) tc = -h; if (tc > 0) tc = 0;
          a.x += a.vx * tc; a.y += a.vy * tc; b.x += b.vx * tc; b.y += b.vy * tc;
          dx = b.x - a.x; dy = b.y - a.y;
        }
        let d = Math.sqrt(dx * dx + dy * dy), nx, ny;
        if (d < 1e-9) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn > 0) {
          const imp = vn * (1 + E_BALL) / 2;
          a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
          a.m = b.m = true;
          if (ev.first < 0) { if (a.n === 0) ev.first = b.n; else if (b.n === 0) ev.first = a.n; }
          if (vn > 25 && ev.clacks.length < 40) ev.clacks.push(vn);
        }
        if (tc < 0) { a.x -= a.vx * tc; a.y -= a.vy * tc; b.x -= b.vx * tc; b.y -= b.vy * tc; }
        // resolve any remaining overlap (resting contact, rack)
        dx = b.x - a.x; dy = b.y - a.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2 * R) {
          if (d < 1e-9) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
          const ov = (2 * R - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        }
      }
    }
    // cushions + pockets
    for (let i = 0; i < n; i++) {
      const b = balls[i];
      if (!b.on || !b.m) continue;
      if (!(b.x > R + 0.5 && b.x < W - R - 0.5 && b.y > R + 0.5 && b.y < H - R - 0.5)) {
        for (let k = 0; k < SEGS.length; k++) {
          const s = SEGS[k];
          let t = ((b.x - s.ax) * s.dx + (b.y - s.ay) * s.dy) / s.l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = s.ax + s.dx * t, qy = s.ay + s.dy * t;
          let nx = b.x - qx, ny = b.y - qy;
          const d2 = nx * nx + ny * ny;
          if (d2 < R * R && d2 > 1e-12) {
            const d = Math.sqrt(d2); nx /= d; ny /= d;
            b.x = qx + nx * R; b.y = qy + ny * R;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) { b.vx -= (1 + E_CUSH) * vn * nx; b.vy -= (1 + E_CUSH) * vn * ny; ev.rails++; }
            const un = b.ux * nx + b.uy * ny;
            if (un < 0) { b.ux -= (1 + E_CUSH) * un * nx; b.uy -= (1 + E_CUSH) * un * ny; }
          }
        }
        for (let k = 0; k < 6; k++) {
          const p = POCKETS[k], dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < p.r * p.r) { pocketBall(b, p, ev); break; }
        }
        // Failsafe: the only way off the slate is through a pocket.
        if (b.on && (b.x < -R * 1.5 || b.x > W + R * 1.5 || b.y < -R * 1.5 || b.y > H + R * 1.5)) {
          let best = POCKETS[0], bd = Infinity;
          for (const p of POCKETS) { const d = (b.x - p.x) ** 2 + (b.y - p.y) ** 2; if (d < bd) { bd = d; best = p; } }
          pocketBall(b, best, ev);
        }
      }
      if (b.on && !(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy))) {
        // Never expected; keeps the game alive if it ever happens.
        b.vx = b.vy = b.ux = b.uy = 0; b.m = false;
        const p = freeSpot(balls, b.n === 0 ? HEAD : FOOT, b.n); b.x = p.x; b.y = p.y;
      }
    }
  }

  function anyMoving(balls) { for (const b of balls) if (b.on && b.m) return true; return false; }

  function shoot(cue, ang, speed) {
    cue.vx = Math.cos(ang) * speed; cue.vy = Math.sin(ang) * speed;
    cue.ux = cue.vx * CUE_ROLL; cue.uy = cue.vy * CUE_ROLL; cue.m = true;
  }

  function freeSpot(balls, spot, self) {
    const ok = (x, y) => balls.every((o) => !o.on || o.n === self || (o.x - x) ** 2 + (o.y - y) ** 2 > (2 * R + 0.2) ** 2);
    if (ok(spot.x, spot.y)) return { x: spot.x, y: spot.y };
    const dirx = spot.x < W / 2 ? -1 : 1;
    for (let k = 1; k < 400; k++) {
      const ring = Math.ceil(k / 8), a = (k % 8) * Math.PI / 4;
      const x = clamp(spot.x + Math.cos(a) * ring * 1.5 * R * (Math.cos(a) * dirx >= 0 ? 1 : 0.6), R + 0.2, W - R - 0.2);
      const y = clamp(spot.y + Math.sin(a) * ring * 1.5 * R, R + 0.2, H - R - 0.2);
      if (ok(x, y)) return { x, y };
    }
    return { x: spot.x, y: spot.y };
  }

  function cloneBalls(bs) { return bs.map((b) => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, ux: 0, uy: 0, on: b.on, m: false, rx: 0, ry: 0 })); }

  function simulate(bs, ang, speed) {
    const b = cloneBalls(bs), ev = newEv();
    shoot(b[0], ang, speed);
    let t = 0;
    while (t < MAX_SHOT_T) { for (let k = 0; k < 30; k++) step(b, HSTEP, ev); t += 30 * HSTEP; if (!anyMoving(b)) break; }
    return { balls: b, ev, t };
  }

  // ---------------------------------------------------------------- rules
  // groups = { p: 'solids'|'stripes'|null, c: ... }, shooter = 'p' | 'c'
  function remaining(balls, g) { let k = 0; for (const b of balls) if (b.on && groupOf(b.n) === g) k++; return k; }

  function judge(before, groups, shooter, ev, isBreak) {
    const mine = groups[shooter];
    const onEight = !!mine && remaining(before, mine) === 0;
    const out = { foul: false, reason: '', keep: false, assign: null, end: null, endReason: '', respot8: false, scratch: false };
    const f = ev.first;
    if (f < 0) { out.foul = true; out.reason = 'No ball hit'; }
    else if (!mine) { if (f === 8 && !isBreak) { out.foul = true; out.reason = 'Hit the 8 first'; } }
    else if (onEight) { if (f !== 8) { out.foul = true; out.reason = 'Had to hit the 8 first'; } }
    else if (groupOf(f) !== mine) { out.foul = true; out.reason = f === 8 ? 'Hit the 8 first' : 'Hit the wrong group first'; }
    if (ev.pocketed.includes(0)) { out.foul = true; out.scratch = true; out.reason = 'Scratch'; }
    if (ev.pocketed.includes(8)) {
      if (isBreak) out.respot8 = true;
      else if (onEight && !out.foul) { out.end = 'win'; out.endReason = 'sank the 8'; return out; }
      else { out.end = 'loss'; out.endReason = out.scratch ? 'scratched on the 8' : !onEight ? 'sank the 8 too early' : 'fouled on the 8'; return out; }
    }
    let g = mine;
    if (!g && !out.foul) {
      const firstBall = ev.pocketed.find((n) => n !== 0 && n !== 8);
      if (firstBall) { g = groupOf(firstBall); out.assign = g; }
    }
    if (!out.foul && g && ev.pocketed.some((n) => groupOf(n) === g)) out.keep = true;
    return out;
  }

  function targetsFor(balls, g) {
    const t = [];
    if (!g) { for (const b of balls) if (b.on && b.n !== 0 && b.n !== 8) t.push(b.n); return t; }
    for (const b of balls) if (b.on && groupOf(b.n) === g) t.push(b.n);
    if (!t.length && balls[8].on) t.push(8);
    return t;
  }

  // ---------------------------------------------------------------- AI
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    const qx = ax + dx * t - px, qy = ay + dy * t - py; return qx * qx + qy * qy;
  }
  function rollDist(v) { return v <= 0 ? 0 : v / D_LIN - F_ROLL / (D_LIN * D_LIN) * Math.log(1 + D_LIN * v / F_ROLL); }
  function speedFor(dist) { let lo = 0, hi = 3000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (rollDist(m) < dist) lo = m; else hi = m; } return hi; }

  // Ghost-ball candidates: every legal target into every pocket with clear paths. p = make chance at aim noise sig (rad).
  function candidates(balls, targets, sig) {
    const C = balls[0], out = [];
    if (!C.on) return out;
    for (const tn of targets) {
      const T = balls[tn];
      for (let pi = 0; pi < 6; pi++) {
        const P = POCKETS[pi];
        let dx = P.aim.x - T.x, dy = P.aim.y - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
        const cosA = dx * P.dir.x + dy * P.dir.y;
        if (cosA < P.minCos) continue;
        const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R;
        if (gx < R - 0.3 || gx > W - R + 0.3 || gy < R - 0.3 || gy > H - R + 0.3) continue;
        let cx = gx - C.x, cy = gy - C.y; const dCG = Math.hypot(cx, cy);
        if (dCG < 0.3) continue;
        cx /= dCG; cy /= dCG;
        const cut = cx * dx + cy * dy;
        if (cut < 0.14) continue;
        let blocked = false;
        const lim = (2 * R - 0.05) ** 2;
        for (const b of balls) {
          if (!b.on || b.n === 0 || b.n === tn) continue;
          if (segDist2(b.x, b.y, C.x, C.y, gx, gy) < lim || segDist2(b.x, b.y, T.x, T.y, P.aim.x, P.aim.y) < lim) { blocked = true; break; }
        }
        if (blocked) continue;
        const halfW = P.halfW * (0.35 + 0.65 * cosA);
        const tolObj = Math.atan(halfW / Math.max(dTP, 1));
        const tolAim = tolObj * (2 * R * cut) / Math.max(dCG, 2 * R);
        let p = erf(tolAim / (sig * Math.SQRT2));
        p *= 0.75 + 0.25 * cut; // thin cuts are less reliable than the line math says
        out.push({ t: tn, pi, ang: Math.atan2(cy, cx), cut, dCG, dTP, p, gx, gy });
      }
    }
    return out;
  }

  // 1-D replay of the friction model: speed left after travelling dist (0 if it stops first).
  function speedAfter(v, u, dist) {
    const h = 1 / 300; let x = 0;
    while (x < dist) {
      let r = u - v; const rel = Math.abs(r);
      if (rel > 1e-6) { const k = Math.min(rel, A_SLIDE * h) / rel; r *= k; v += r * (2 / 7); u -= r * (5 / 7); }
      v = Math.max(0, v - (F_ROLL + D_LIN * v) * h); u = Math.max(0, u - (F_ROLL + D_LIN * u) * h);
      if (v < V_STOP && u < V_STOP) return 0;
      x += v * h;
    }
    return v;
  }
  function bisect(f, target) { let lo = 0, hi = 1400; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return hi; }
  // Cue speed that sends the object ball into the pocket with a little pace left.
  function estSpeed(c) {
    const vObj = bisect((v) => speedAfter(v, 0, c.dTP + 3), 40);
    const vImp = vObj / (Math.max(0.2, c.cut) * (1 + E_BALL) / 2);
    return clamp(bisect((v) => speedAfter(v, v * CUE_ROLL, Math.max(0, c.dCG)), vImp) * 1.05, 50, V_MAX);
  }

  function bestP(balls, g, sig) {
    let best = 0;
    for (const c of candidates(balls, targetsFor(balls, g), sig)) if (c.p > best) best = c.p;
    return best;
  }

  const LV = [
    { name: 'Rookie', sigma: 1.6, pow: 0.3, sims: 0, mul: [1], bad: 0.4, safety: 0, guide: Infinity, obj: 48, tan: 30 },
    { name: 'Pro', sigma: 0.7, pow: 0.14, sims: 3, mul: [0.95, 1.3], bad: 0.08, safety: 0, guide: Infinity, obj: 32, tan: 22 },
    { name: 'All-Pro', sigma: 0.32, pow: 0.07, sims: 6, mul: [0.85, 1.1, 1.45], bad: 0, safety: 3, guide: 120, obj: 20, tan: 14 },
    { name: 'Legend', sigma: 0.1, pow: 0.03, sims: 10, mul: [0.8, 1.0, 1.3, 1.75], bad: 0, safety: 5, guide: 70, obj: 12, tan: 8 },
  ];
  const HUMAN_SIG = 0.45 * Math.PI / 180;

  // Returns { ang, speed, kind, target } (before execution noise).
  function aiPlan(balls, groups, level, rnd) {
    const L = LV[level], sig = L.sigma * Math.PI / 180, me = 'c', opp = 'p';
    const tg = targetsFor(balls, groups[me]);
    const cands = candidates(balls, tg, sig).sort((a, b) => b.p - a.p);
    const C = balls[0];
    if (!L.sims) {
      if (cands.length) {
        let c = cands[0];
        if (rnd() < L.bad) c = cands[Math.floor(rnd() * cands.length)];
        else if (cands.length > 1 && rnd() < 0.35) c = cands[Math.floor(rnd() * Math.min(3, cands.length))];
        return { ang: c.ang, speed: estSpeed(c), kind: 'pot', target: c.t };
      }
      const tn = tg[Math.floor(rnd() * tg.length)], T = balls[tn];
      return { ang: Math.atan2(T.y - C.y, T.x - C.x) + (rnd() - 0.5) * 0.1, speed: 160 + rnd() * 260, kind: 'hit', target: tn };
    }
    const value = (sim, c) => {
      const o = judge(balls, groups, me, sim.ev, false);
      if (o.end === 'loss') return -20;
      if (o.end === 'win') return 12 * (c ? c.p : 0.3) - 1;
      if (o.foul) return -1.6 - (o.scratch ? 0.4 : 0);
      const g2 = Object.assign({}, groups);
      if (o.assign) { g2[me] = o.assign; g2[opp] = other(o.assign); }
      if (o.keep) {
        const next = sim.balls[8].on ? bestP(sim.balls, g2[me], sig) : 1;
        const pm = c ? c.p : 0.5;
        return pm * (1 + 0.7 * next) + (1 - pm) * -0.35;
      }
      return -0.25 - 0.8 * bestP(sim.balls, g2[opp], HUMAN_SIG);
    };
    let best = null, bv = -Infinity;
    for (const c of cands.slice(0, L.sims)) {
      const base = estSpeed(c);
      for (const m of L.mul) {
        const sp = clamp(base * m, 60, V_MAX);
        const sim = simulate(balls, c.ang, sp);
        const madeTarget = sim.ev.pocketed.includes(c.t);
        let v = madeTarget ? value(sim, c) : Math.min(value(sim, null), -0.3);
        v -= (sp / V_MAX) * 0.08;
        if (v > bv) { bv = v; best = { ang: c.ang, speed: sp, kind: 'pot', target: c.t }; }
      }
    }
    if (L.safety && bv < 0.3) {
      const near = tg.map((n) => balls[n]).sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y)).slice(0, L.safety);
      for (const T of near) {
        const d = Math.hypot(T.x - C.x, T.y - C.y), base = Math.atan2(T.y - C.y, T.x - C.x);
        const maxOff = Math.asin(Math.min(1, 2 * R * 0.92 / Math.max(d, 2 * R)));
        for (const f of [-0.75, -0.35, 0, 0.35, 0.75]) {
          for (const sp of [120, 200, 320]) {
            const ang = base + f * maxOff;
            const sim = simulate(balls, ang, sp);
            const v = value(sim, null) - 0.05;
            if (v > bv) { bv = v; best = { ang, speed: sp, kind: 'safety', target: T.n }; }
          }
        }
      }
    }
    if (!best) {
      const T = balls[tg[0]];
      best = { ang: Math.atan2(T.y - C.y, T.x - C.x), speed: 260, kind: 'hit', target: T.n };
    }
    return best;
  }

  function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function aiNoise(plan, level, rnd) {
    const L = LV[level];
    return { ang: plan.ang + gauss(rnd) * L.sigma * Math.PI / 180, speed: clamp(plan.speed * (1 + gauss(rnd) * L.pow), 40, V_MAX) };
  }

  const core = { W, H, R, V_MAX, BREAK_BOOST, HSTEP, POCKETS, SEGS, LV, rack, step, simulate, shoot, newEv, anyMoving, judge, targetsFor, candidates, aiPlan, aiNoise, estSpeed, freeSpot, groupOf, remaining, rollDist, speedFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof window === 'undefined' || !window.MFLArcade) return;

  // ================================================================ UI
  const COLORS = {
    0: [244, 241, 232], 1: [246, 190, 0], 2: [28, 78, 205], 3: [214, 34, 40], 4: [96, 40, 150], 5: [244, 110, 28],
    6: [12, 138, 74], 7: [128, 30, 34], 8: [22, 22, 26],
  };
  for (let n = 9; n <= 15; n++) COLORS[n] = COLORS[n - 8];
  const css = (n) => `rgb(${COLORS[n].join(',')})`;

  const CSS = `
.pl-wrap{position:relative;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;max-width:100%;overflow:hidden}
.pl-hud{display:flex;gap:8px;align-items:stretch;margin-bottom:6px}
.pl-side{flex:1 1 0;min-width:0;background:#0f1117;border:1px solid #1d212c;border-radius:12px;padding:6px 9px;transition:border-color .2s,box-shadow .2s}
.pl-side.on{border-color:#ffc21a;box-shadow:0 0 0 1px #ffc21a55,0 0 18px #ffc21a22}
.pl-who{font:800 15px/1.1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-who b{color:#ffc21a;font-weight:800}
.pl-tray{display:flex;gap:3px;margin-top:4px;min-height:13px;flex-wrap:nowrap}
.pl-mb{width:13px;height:13px;border-radius:50%;flex:0 0 13px;box-shadow:inset -2px -2px 3px rgba(0,0,0,.45),inset 1px 1px 2px rgba(255,255,255,.35);transition:opacity .3s,transform .3s}
.pl-mb.gone{opacity:.18;transform:scale(.8)}
.pl-turn{text-align:center;font:800 18px/1.2 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;min-height:22px;color:#ffc21a}
.pl-turn.cpu{color:#9aa3b5}
.pl-stage{position:relative;line-height:0}
.pl-stage canvas{display:block;touch-action:none;margin:0 auto;cursor:crosshair}
.pl-toast{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);background:rgba(7,8,11,.74);border:1px solid #ffc21a66;color:#f5f6f8;padding:7px 13px;border-radius:12px;font:800 18px/1.15 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;max-width:80%;line-height:1.15}
.pl-toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.pl-toast.bad{border-color:#ff334499;color:#ffd0d4}
.pl-toast small{display:block;font:600 12px Inter,sans-serif;text-transform:none;letter-spacing:0;color:#c9cdd6;margin-top:3px}
.pl-ctrl{display:flex;gap:8px;align-items:center;margin-top:8px}
.pl-btn{appearance:none;border:1px solid #2a2f3d;background:#161922;color:#f5f6f8;border-radius:10px;height:38px;min-width:42px;padding:0 10px;font:700 14px Inter,sans-serif;cursor:pointer;touch-action:manipulation}
.pl-btn:active{background:#1d212c}
.pl-btn.quit{color:#ff8a95;border-color:#ff334455}
.pl-btn.quit.arm{background:#ff3344;color:#fff;border-color:#ff3344}
.pl-pow{flex:1;position:relative;height:16px;border-radius:9px;background:#0f1117;border:1px solid #1d212c;overflow:hidden}
.pl-pow i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#2fd27a,#ffc21a 60%,#ff3344);border-radius:9px}
.pl-pow span{position:absolute;inset:0;white-space:nowrap;overflow:hidden;display:flex;align-items:center;justify-content:center;font:700 10px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f5f6f8;text-shadow:0 1px 2px #000}
.pl-info{margin-top:7px;font:500 11.5px/1.45 Inter,sans-serif;color:#6f7584;text-align:center}
.pl-info b{color:#9aa3b5;font-weight:600}
`;

  function start(ctx) {
    const level = clamp(Number(ctx.level) || 0, 0, 3), L = LV[level];
    const rnd = ctx.rng;
    const look = window.MFLArcade.rng(String(ctx.seed) + ':look'); // cosmetic only
    if (!document.getElementById('pl-css')) { const st = document.createElement('style'); st.id = 'pl-css'; st.textContent = CSS; document.head.appendChild(st); }

    const root = ctx.root;
    root.innerHTML = `<div class="pl-wrap">
      <div class="pl-hud"><div class="pl-side pl-p"><div class="pl-who"></div><div class="pl-tray"></div></div>
      <div class="pl-side pl-c"><div class="pl-who"></div><div class="pl-tray"></div></div></div>
      <div class="pl-turn"></div>
      <div class="pl-stage"><canvas></canvas><div class="pl-toast"></div></div>
      <div class="pl-ctrl"><button class="pl-btn pl-l" aria-label="Aim left">&#9664;</button><div class="pl-pow"><i></i><span>Pull back to shoot</span></div><button class="pl-btn pl-r" aria-label="Aim right">&#9654;</button><button class="pl-btn quit">Give up</button></div>
      <div class="pl-info"><b>8-Ball:</b> open table until the first ball drops &mdash; that's your group (solids 1&ndash;7 or stripes 9&ndash;15). Sink your group, then the 8. Scratch, no hit, or hitting the other group first = foul, turn passes. Sinking the 8 early or scratching on it = loss.</div>
    </div>`;
    const $ = (s) => root.querySelector(s);
    const canvas = $('canvas'), g = canvas.getContext('2d');
    const toastEl = $('.pl-toast'), turnEl = $('.pl-turn'), powFill = $('.pl-pow i'), powTxt = $('.pl-pow span');
    const sideP = $('.pl-p'), sideC = $('.pl-c');

    // ---- game state
    const balls = rack(rnd);
    const groups = { p: null, c: null };
    let turn = 'p', isBreak = true, phase = 'aim', over = false, shots = 0;
    let aim = Math.atan2(FOOT.y - HEAD.y, FOOT.x - HEAD.x);
    let power = 0; // 0..1 shown in meter
    let ev = null, simT = 0, acc = 0, before = null, shooter = 'p';
    const anims = []; // pocketing animations
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!over) fn(); }, ms); timers.add(id); return id; };
    let ai = null; // current AI animation { from, to, speed, t0, plan }
    let lastClack = 0;
    const t0 = performance.now();

    // ball orientation (cosmetic), body->world rotation matrix
    function initOrient(b, vert) {
      const yaw = (look() - 0.5) * 0.6 + (vert ? Math.PI / 2 : 0), tilt = look() * 0.35, ta = look() * Math.PI * 2;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      b.M = [c, -s, 0, s, c, 0, 0, 0, 1];
      rotate(b, Math.cos(ta), Math.sin(ta), tilt);
      b.dirty = true;
    }
    function rotate(b, kx, ky, th) {
      const c = Math.cos(th), s = Math.sin(th), t = 1 - c;
      // Rodrigues with kz = 0
      const r = [c + t * kx * kx, t * kx * ky, s * ky, t * kx * ky, c + t * ky * ky, -s * kx, -s * ky, s * kx, c];
      const M = b.M, o = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = r[i * 3] * M[j] + r[i * 3 + 1] * M[3 + j] + r[i * 3 + 2] * M[6 + j];
      // re-orthonormalize columns
      for (let j = 0; j < 3; j++) {
        if (j > 0) for (let k = 0; k < j; k++) { const d = o[k] * o[j] + o[3 + k] * o[3 + j] + o[6 + k] * o[6 + j]; o[j] -= d * o[k]; o[3 + j] -= d * o[3 + k]; o[6 + j] -= d * o[6 + k]; }
        const l = Math.hypot(o[j], o[3 + j], o[6 + j]) || 1; o[j] /= l; o[3 + j] /= l; o[6 + j] /= l;
      }
      b.M = o; b.dirty = true;
    }

    // ---- layout
    let LY = { vert: false, s: 1, ox: 0, oy: 0, cw: 300, ch: 200, dpr: 1 };
    let tableLayer = null, shadowSpr = null, glyphs = null;
    const toS = (x, y) => (LY.vert ? [LY.ox + y * LY.s, LY.oy + (W - x) * LY.s] : [LY.ox + x * LY.s, LY.oy + y * LY.s]);
    const toW = (sx, sy) => (LY.vert ? [W - (sy - LY.oy) / LY.s, (sx - LY.ox) / LY.s] : [(sx - LY.ox) / LY.s, (sy - LY.oy) / LY.s]);
    const worldTf = (c2, dpr) => { const s = LY.s * dpr; if (LY.vert) c2.setTransform(0, -s, s, 0, LY.ox * dpr, (LY.oy + W * LY.s) * dpr); else c2.setTransform(s, 0, 0, s, LY.ox * dpr, LY.oy * dpr); };

    function layout() {
      const cw = Math.max(260, Math.floor(root.clientWidth || 360));
      const vh = window.innerHeight || 800;
      const vert = cw < 620 || (cw < 760 && vh > cw * 1.25);
      const TW = W + 2 * EDGE, TH = H + 2 * EDGE;
      let s, ch;
      const maxH = Math.max(300, vh - (vert ? 185 : 210));
      if (vert) { s = cw / TH; ch = TW * s; if (ch > maxH) { s = maxH / TW; ch = maxH; } }
      else { s = cw / TW; ch = TH * s; if (ch > maxH) { s = maxH / TH; ch = maxH; } }
      ch = Math.round(ch);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const vertChanged = LY.vert !== vert;
      LY = { vert, s, cw, ch, dpr, ox: 0, oy: 0 };
      if (vert) { LY.ox = (cw - TH * s) / 2 + EDGE * s; LY.oy = (ch - TW * s) / 2 + EDGE * s; }
      else { LY.ox = (cw - TW * s) / 2 + EDGE * s; LY.oy = (ch - TH * s) / 2 + EDGE * s; }
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      buildTable(); buildShadow();
      if (!glyphs) buildGlyphs();
      for (const b of balls) { if (!b.M || vertChanged) initOrient(b, vert); b.dirty = true; }
      draw();
    }

    function buildGlyphs() {
      glyphs = {};
      const N = 48;
      const c = document.createElement('canvas'); c.width = c.height = N;
      const x = c.getContext('2d', { willReadFrequently: true });
      for (let n = 1; n <= 15; n++) {
        x.clearRect(0, 0, N, N);
        x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `800 ${n > 9 ? 27 : 32}px Inter, Arial, sans-serif`;
        if (n > 9) { x.save(); x.translate(N / 2, N / 2 + 2); x.scale(0.86, 1); x.fillText(String(n), 0, 0); x.restore(); }
        else x.fillText(String(n), N / 2, N / 2 + 2);
        const d = x.getImageData(0, 0, N, N).data, m = new Float32Array(N * N);
        for (let i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] / 255;
        glyphs[n] = { N, m };
      }
    }

    function buildShadow() {
      const rp = R * LY.s * LY.dpr, sz = Math.ceil(rp * 3.2);
      shadowSpr = document.createElement('canvas'); shadowSpr.width = shadowSpr.height = sz;
      const x = shadowSpr.getContext('2d'), gr = x.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, sz, sz);
    }

    function buildTable() {
      const dpr = LY.dpr;
      tableLayer = document.createElement('canvas'); tableLayer.width = canvas.width; tableLayer.height = canvas.height;
      const x = tableLayer.getContext('2d');
      worldTf(x, dpr);
      const rr = (x0, y0, w, h, r) => { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); };
      // outer shadow
      x.save(); x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 18 * dpr; x.shadowOffsetY = 4 * dpr;
      rr(-EDGE, -EDGE, W + 2 * EDGE, H + 2 * EDGE, 4.5); x.fillStyle = '#3d2414'; x.fill(); x.restore();
      // wood with grain
      const wg = x.createLinearGradient(0, -EDGE, 0, H + EDGE);
      wg.addColorStop(0, '#7a4a2a'); wg.addColorStop(0.06, '#5c341b'); wg.addColorStop(0.5, '#4a2914'); wg.addColorStop(0.94, '#5c341b'); wg.addColorStop(1, '#7a4a2a');
      rr(-EDGE, -EDGE, W + 2 * EDGE, H + 2 * EDGE, 4.5); x.fillStyle = wg; x.fill();
      x.save(); rr(-EDGE, -EDGE, W + 2 * EDGE, H + 2 * EDGE, 4.5); x.clip();
      x.lineWidth = 0.18;
      for (let i = 0; i < 70; i++) {
        const yy = -EDGE + look() * (H + 2 * EDGE), a = 0.05 + look() * 0.09;
        x.strokeStyle = look() < 0.5 ? `rgba(20,8,2,${a})` : `rgba(160,100,60,${a * 0.7})`;
        x.beginPath(); x.moveTo(-EDGE, yy);
        for (let xx = -EDGE; xx <= W + EDGE; xx += 10) x.lineTo(xx, yy + Math.sin(xx * 0.05 + i) * 0.6);
        x.stroke();
      }
      x.restore();
      // inner bevel
      x.strokeStyle = 'rgba(255,220,180,0.18)'; x.lineWidth = 0.35;
      rr(-EDGE + 0.4, -EDGE + 0.4, W + 2 * EDGE - 0.8, H + 2 * EDGE - 0.8, 4.2); x.stroke();
      // cushion bed + playing felt
      x.fillStyle = '#063a22'; x.fillRect(-CUSH, -CUSH, W + 2 * CUSH, H + 2 * CUSH);
      const fg = x.createRadialGradient(W / 2, H / 2, 5, W / 2, H / 2, W * 0.62);
      fg.addColorStop(0, '#1f9a5c'); fg.addColorStop(0.55, '#15814b'); fg.addColorStop(1, '#0c5c35');
      x.fillStyle = fg; x.fillRect(0, 0, W, H);
      // subtle felt speckle
      for (let i = 0; i < 900; i++) { x.fillStyle = look() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)'; x.fillRect(look() * W, look() * H, 0.35, 0.35); }
      // head string, spots
      x.strokeStyle = 'rgba(255,255,255,0.13)'; x.lineWidth = 0.25; x.setLineDash([1.2, 1.2]);
      x.beginPath(); x.moveTo(HEAD.x, 0); x.lineTo(HEAD.x, H); x.stroke(); x.setLineDash([]);
      x.fillStyle = 'rgba(255,255,255,0.35)';
      for (const p of [HEAD, FOOT]) { x.beginPath(); x.arc(p.x, p.y, 0.55, 0, Math.PI * 2); x.fill(); }
      // cushions
      for (const p of CUSHIONS) {
        x.beginPath(); x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) x.lineTo(p[i][0], p[i][1]); x.closePath();
        x.fillStyle = '#137a47'; x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.25; x.stroke();
        x.beginPath(); x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]);
        x.strokeStyle = 'rgba(120,230,160,0.45)'; x.lineWidth = 0.4; x.stroke();
      }
      // diamonds
      x.fillStyle = '#f3e7cf';
      const dia = (cx, cy) => { x.beginPath(); x.moveTo(cx, cy - 0.9); x.lineTo(cx + 0.6, cy); x.lineTo(cx, cy + 0.9); x.lineTo(cx - 0.6, cy); x.closePath(); x.fill(); };
      const my = CUSH + WOOD / 2;
      for (const xx of [25, 50, 75, 125, 150, 175]) { dia(xx, -my); dia(xx, H + my); }
      for (const yy of [25, 50, 75]) { dia(-my, yy); dia(W + my, yy); }
      // pockets
      for (const p of POCKETS) {
        x.beginPath(); x.arc(p.x, p.y, p.dr + 1.1, 0, Math.PI * 2); x.fillStyle = '#20140c'; x.fill();
        x.strokeStyle = 'rgba(255,210,150,0.22)'; x.lineWidth = 0.3; x.stroke();
        const pg = x.createRadialGradient(p.x - 0.6, p.y - 0.6, 0.3, p.x, p.y, p.dr);
        pg.addColorStop(0, '#000'); pg.addColorStop(0.7, '#050505'); pg.addColorStop(1, '#1d1d1d');
        x.beginPath(); x.arc(p.x, p.y, p.dr, 0, Math.PI * 2); x.fillStyle = pg; x.fill();
      }
      // watermark
      x.setTransform(1, 0, 0, 1, 0, 0);
      const [cx, cy] = toS(W / 2, H / 2);
      x.save(); x.translate(cx * dpr, cy * dpr); if (LY.vert) x.rotate(-Math.PI / 2);
      x.font = `900 ${Math.round(22 * LY.s * dpr)}px 'Barlow Condensed', Inter, sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,0.05)';
      x.fillText('MFL', 0, 0); x.restore();
    }

    // Per-pixel 3D ball sprite (rotates as it rolls).
    const LIT = (() => { const v = [-0.42, -0.55, 0.72], l = Math.hypot(...v); return v.map((a) => a / l); })();
    const HV = (() => { const v = [LIT[0], LIT[1], LIT[2] + 1], l = Math.hypot(...v); return v.map((a) => a / l); })();
    function renderBall(b) {
      const rp = R * LY.s * LY.dpr, D = Math.ceil(rp * 2) + 2;
      if (!b.cv || b.cv.width !== D) { b.cv = document.createElement('canvas'); b.cv.width = b.cv.height = D; b.cx = b.cv.getContext('2d'); b.img = b.cx.createImageData(D, D); }
      const data = b.img.data, c = D / 2, M = b.M, vert = LY.vert;
      const base = COLORS[b.n], stripe = b.n > 8, gl = glyphs[b.n];
      for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
          const idx = (py * D + px) * 4;
          const X = (px + 0.5 - c) / rp, Y = (py + 0.5 - c) / rp, r2 = X * X + Y * Y;
          const r = Math.sqrt(r2);
          const al = clamp((1 - r) * rp + 0.5, 0, 1);
          if (al <= 0) { data[idx + 3] = 0; continue; }
          const Z = Math.sqrt(Math.max(0, 1 - Math.min(r2, 1)));
          const wx = vert ? -Y : X, wy = vert ? X : Y;
          const bx = M[0] * wx + M[3] * wy + M[6] * Z, by = M[1] * wx + M[4] * wy + M[7] * Z, bz = M[2] * wx + M[5] * wy + M[8] * Z;
          let cr = base[0], cg = base[1], cb = base[2];
          if (b.n === 0) {
            if (Math.abs(bz) > 0.955) { cr = 200; cg = 30; cb = 40; }
          } else {
            if (stripe && Math.abs(bx) > 0.5) { cr = 244; cg = 241; cb = 232; }
            const az = Math.abs(bz);
            if (az > 0.86) {
              let m = 0;
              if (az > 0.875) {
                const u = (bz > 0 ? bx : -bx) / 0.5, v = by / 0.5;
                const gx = Math.floor((u * 0.62 + 1) / 2 * gl.N), gy = Math.floor((v * 0.62 + 1) / 2 * gl.N);
                if (gx >= 0 && gy >= 0 && gx < gl.N && gy < gl.N) m = gl.m[gy * gl.N + gx];
                const w = 245 * (1 - m) + 18 * m; cr = w; cg = w; cb = w;
              } else { cr = cr * 0.5 + 122; cg = cg * 0.5 + 120; cb = cb * 0.5 + 116; }
            }
          }
          const diff = Math.max(0, X * LIT[0] + Y * LIT[1] + Z * LIT[2]);
          const sh = (0.34 + 0.78 * diff) * (0.8 + 0.2 * Z);
          const hd = Math.max(0, X * HV[0] + Y * HV[1] + Z * HV[2]);
          const h2 = hd * hd, h4 = h2 * h2, h8 = h4 * h4, h16 = h8 * h8;
          const spec = h16 * h16 * h16 * 0.95 + h8 * 0.07;
          data[idx] = Math.min(255, cr * sh + 255 * spec);
          data[idx + 1] = Math.min(255, cg * sh + 255 * spec);
          data[idx + 2] = Math.min(255, cb * sh + 255 * spec);
          data[idx + 3] = al * 255;
        }
      }
      b.cx.putImageData(b.img, 0, 0);
      b.dirty = false;
    }

    // ---- aim guide geometry (ray from cue ball)
    function guide(ang) {
      const C = balls[0], dx = Math.cos(ang), dy = Math.sin(ang);
      let tb = Infinity, hit = null;
      for (const b of balls) {
        if (!b.on || b.n === 0) continue;
        const ox = C.x - b.x, oy = C.y - b.y, bb = dx * ox + dy * oy, cc = ox * ox + oy * oy - D2, disc = bb * bb - cc;
        if (disc < 0) continue;
        const t = -bb - Math.sqrt(disc);
        if (t > -0.01 && t < tb) { tb = Math.max(0, t); hit = b; }
      }
      let tr = Infinity;
      if (dx > 1e-9) tr = Math.min(tr, (W - R - C.x) / dx); if (dx < -1e-9) tr = Math.min(tr, (R - C.x) / dx);
      if (dy > 1e-9) tr = Math.min(tr, (H - R - C.y) / dy); if (dy < -1e-9) tr = Math.min(tr, (R - C.y) / dy);
      tr = Math.max(0, tr);
      if (hit && tb <= tr) {
        const gx = C.x + dx * tb, gy = C.y + dy * tb;
        let nx = hit.x - gx, ny = hit.y - gy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const dot = dx * nx + dy * ny;
        let tx = dx - dot * nx, ty = dy - dot * ny; const tl = Math.hypot(tx, ty);
        if (tl > 1e-6) { tx /= tl; ty /= tl; }
        return { t: tb, gx, gy, ball: hit, nx, ny, dot, tx, ty, tl };
      }
      return { t: tr, gx: C.x + dx * tr, gy: C.y + dy * tr, ball: null };
    }

    // ---- drawing
    let pulse = 0;
    function draw() {
      const dpr = LY.dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (tableLayer) g.drawImage(tableLayer, 0, 0);
      const rp = R * LY.s * dpr;
      // shadows
      if (shadowSpr) {
        const ss = shadowSpr.width;
        for (const b of balls) {
          if (!b.on) continue;
          const [sx, sy] = toS(b.x, b.y);
          g.drawImage(shadowSpr, sx * dpr - ss / 2 + rp * 0.28, sy * dpr - ss / 2 + rp * 0.38);
        }
      }
      const C = balls[0];
      const aiming = !over && C.on && (phase === 'aim' || phase === 'pull' || phase === 'ai');
      // guide (player only)
      if (aiming && turn === 'p') drawGuide();
      // pocketing animations (under balls)
      for (const a of anims) {
        const k = clamp(a.t / 0.28, 0, 1), b = balls[a.n];
        if (!b.cv) continue;
        const x = a.x + (a.px - a.x) * Math.min(1, k * 1.3), y = a.y + (a.py - a.y) * Math.min(1, k * 1.3);
        const [sx, sy] = toS(x, y), sc = 1 - 0.45 * k;
        g.globalAlpha = 1 - k * 0.85;
        const D = b.cv.width * sc;
        g.drawImage(b.cv, sx * dpr - D / 2, sy * dpr - D / 2, D, D);
        g.globalAlpha = 1;
      }
      // balls
      for (const b of balls) {
        if (!b.on) continue;
        if (b.dirty || !b.cv) renderBall(b);
        const [sx, sy] = toS(b.x, b.y), D = b.cv.width;
        g.drawImage(b.cv, sx * dpr - D / 2, sy * dpr - D / 2);
      }
      // "drag me" ring
      if (aiming && turn === 'p' && phase === 'aim') {
        const [sx, sy] = toS(C.x, C.y);
        const k = (Math.sin(pulse * 3.2) + 1) / 2;
        g.beginPath(); g.arc(sx * dpr, sy * dpr, rp * (1.55 + 0.25 * k), 0, Math.PI * 2);
        g.strokeStyle = `rgba(255,194,26,${0.35 + 0.35 * k})`; g.lineWidth = 1.6 * dpr; g.stroke();
      }
      // cue stick
      if (aiming) {
        let pull = power, ang = aim;
        if (phase === 'ai' && ai) { ang = ai.cur; pull = ai.pull; }
        drawCue(ang, pull, ai && ai.strike);
      }
    }

    function drawGuide() {
      const dpr = LY.dpr, C = balls[0], gd = guide(aim);
      const maxT = L.guide;
      const t = Math.min(gd.t, maxT);
      const [x0, y0] = toS(C.x, C.y), [x1, y1] = toS(C.x + Math.cos(aim) * t, C.y + Math.sin(aim) * t);
      g.save();
      g.lineCap = 'round';
      g.setLineDash([5 * dpr, 4 * dpr]); g.lineWidth = 1.4 * dpr; g.strokeStyle = 'rgba(255,255,255,0.62)';
      g.beginPath(); g.moveTo(x0 * dpr, y0 * dpr); g.lineTo(x1 * dpr, y1 * dpr); g.stroke();
      g.setLineDash([]);
      if (gd.t <= maxT) {
        const [gx, gy] = toS(gd.gx, gd.gy), rp = R * LY.s * dpr;
        g.beginPath(); g.arc(gx * dpr, gy * dpr, rp, 0, Math.PI * 2);
        g.lineWidth = 1.3 * dpr; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.1)'; g.fill();
        if (gd.ball) {
          const legal = legalFirst(gd.ball.n);
          const ol = L.obj * (0.35 + 0.65 * gd.dot);
          const [ox, oy] = toS(gd.ball.x, gd.ball.y), [ox2, oy2] = toS(gd.ball.x + gd.nx * ol, gd.ball.y + gd.ny * ol);
          g.lineWidth = 2 * dpr; g.strokeStyle = legal ? 'rgba(255,194,26,0.9)' : 'rgba(255,51,68,0.9)';
          g.beginPath(); g.moveTo(ox * dpr, oy * dpr); g.lineTo(ox2 * dpr, oy2 * dpr); g.stroke();
          if (gd.tl > 0.05) {
            const tlen = L.tan * gd.tl;
            const [tx2, ty2] = toS(gd.gx + gd.tx * tlen, gd.gy + gd.ty * tlen);
            g.lineWidth = 1.2 * dpr; g.strokeStyle = 'rgba(255,255,255,0.45)';
            g.beginPath(); g.moveTo(gx * dpr, gy * dpr); g.lineTo(tx2 * dpr, ty2 * dpr); g.stroke();
          }
          if (!legal) { g.lineWidth = 1.6 * dpr; g.strokeStyle = 'rgba(255,51,68,0.9)'; const k = rp * 0.5; g.beginPath(); g.moveTo(gx * dpr - k, gy * dpr - k); g.lineTo(gx * dpr + k, gy * dpr + k); g.moveTo(gx * dpr + k, gy * dpr - k); g.lineTo(gx * dpr - k, gy * dpr + k); g.stroke(); }
        }
      }
      g.restore();
    }

    function drawCue(ang, pull, strike) {
      const C = balls[0], dpr = LY.dpr;
      g.save();
      worldTf(g, dpr);
      g.translate(C.x, C.y); g.rotate(ang + Math.PI);
      const off = R + 0.7 + (strike ? 0 : pull * 22);
      const len = 118;
      const seg = (a, b, w0, w1, fill) => { g.beginPath(); g.moveTo(off + a, -w0); g.lineTo(off + b, -w1); g.lineTo(off + b, w1); g.lineTo(off + a, w0); g.closePath(); g.fillStyle = fill; g.fill(); };
      const wAt = (d) => 0.55 + (d / len) * 0.75;
      // shadow
      g.save(); g.translate(0.9, 1.4); g.globalAlpha = 0.28; seg(0, len, wAt(0), wAt(len), '#000'); g.restore();
      const sg = g.createLinearGradient(0, -1.3, 0, 1.3);
      sg.addColorStop(0, '#f6ddb0'); sg.addColorStop(0.5, '#d9ae6c'); sg.addColorStop(1, '#a87b3e');
      seg(0, 0.8, wAt(0), wAt(0.8), '#3d7fd0');
      seg(0.8, 3.2, wAt(0.8), wAt(3.2), '#f2ece0');
      seg(3.2, 72, wAt(3.2), wAt(72), sg);
      seg(72, 73.5, wAt(72), wAt(73.5), '#cfd3da');
      const fg = g.createLinearGradient(0, -1.3, 0, 1.3);
      fg.addColorStop(0, '#6a3517'); fg.addColorStop(0.5, '#3b1a09'); fg.addColorStop(1, '#2a1205');
      seg(73.5, 92, wAt(73.5), wAt(92), fg);
      seg(80, 81, wAt(80), wAt(81), '#ffc21a');
      seg(92, 112, wAt(92), wAt(112), '#17181c');
      seg(112, len, wAt(112), wAt(len), '#2a1408');
      g.restore();
    }

    // ---- HUD
    function legalFirst(n) {
      const mine = groups[turn];
      if (!mine) return n !== 8;
      if (remaining(balls, mine) === 0) return n === 8;
      return groupOf(n) === mine;
    }
    function trayHTML(gp) {
      if (!gp) return '';
      const ns = gp === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      const ballCss = (n) => n > 8 ? `background:linear-gradient(#f4f1e8 0 28%,${css(n)} 28% 72%,#f4f1e8 72%)` : `background:${css(n)}`;
      let h = ns.map((n) => `<span class="pl-mb${balls[n].on ? '' : ' gone'}" style="${ballCss(n)}"></span>`).join('');
      if (remaining(balls, gp) === 0) h += `<span class="pl-mb${balls[8].on ? '' : ' gone'}" style="background:#16161a;outline:1px solid #ffc21a"></span>`;
      return h;
    }
    const gname = (gp, who) => !gp ? 'Open' : remaining(balls, gp) === 0 ? '8-ball' : gp === 'solids' ? 'Solids' : 'Stripes';
    function hud() {
      sideP.querySelector('.pl-who').innerHTML = `You: <b>${gname(groups.p)}</b>`;
      sideC.querySelector('.pl-who').innerHTML = `CPU ${L.name}: <b>${gname(groups.c)}</b>`;
      sideP.querySelector('.pl-tray').innerHTML = trayHTML(groups.p);
      sideC.querySelector('.pl-tray').innerHTML = trayHTML(groups.c);
      sideP.classList.toggle('on', turn === 'p' && !over);
      sideC.classList.toggle('on', turn === 'c' && !over);
      let t;
      if (over) t = 'Game over';
      else if (turn === 'p') t = phase === 'roll' ? 'Rolling…' : isBreak ? 'Your break' : 'Your shot';
      else t = phase === 'roll' ? 'CPU shot…' : 'CPU is lining up…';
      turnEl.textContent = t;
      turnEl.classList.toggle('cpu', turn === 'c');
    }
    function setPow(p, label) {
      powFill.style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
      powTxt.textContent = label != null ? label : p > 0 ? `Power ${Math.round(p * 100)}%` : turn === 'p' ? 'Pull back to shoot' : 'CPU';
    }
    let toastTimer = null;
    function toast(msg, sub, bad, ms) {
      toastEl.innerHTML = msg + (sub ? `<small>${sub}</small>` : '');
      toastEl.classList.toggle('bad', !!bad);
      toastEl.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 1500);
    }

    // ---- turn flow
    function takeShot(ang, speed) {
      before = cloneBallsKeep();
      shooter = turn;
      ev = newEv(); simT = 0; acc = 0;
      shoot(balls[0], ang, isBreak ? speed * BREAK_BOOST : speed);
      phase = 'roll'; power = 0; shots++;
      ctx.sound('kick');
      setPow(0, turn === 'p' ? '' : '');
      hud();
    }
    function cloneBallsKeep() { return balls.map((b) => ({ n: b.n, x: b.x, y: b.y, on: b.on })); }

    function endShot() {
      const o = judge(before, groups, shooter, ev, isBreak);
      const who = shooter === 'p' ? 'You' : 'CPU';
      if (o.end) {
        const shooterWins = o.end === 'win';
        const playerWon = shooter === 'p' ? shooterWins : !shooterWins;
        const detail = shooter === 'p'
          ? (shooterWins ? 'You sank the 8!' : o.endReason === 'scratched on the 8' ? 'Scratched on the 8' : o.endReason === 'sank the 8 too early' ? 'You sank the 8 too early' : 'Foul on the 8-ball shot')
          : (shooterWins ? `CPU (${L.name}) sank the 8` : `CPU ${o.endReason}`);
        toast(playerWon ? 'You win!' : 'Game over', detail, !playerWon, 4000);
        return gameOver(playerWon, detail);
      }
      if (o.respot8) { const p = freeSpot(balls, FOOT, 8); Object.assign(balls[8], { x: p.x, y: p.y, on: true, m: false, vx: 0, vy: 0, ux: 0, uy: 0 }); balls[8].dirty = true; }
      if (o.scratch) { const p = freeSpot(balls, HEAD, 0); Object.assign(balls[0], { x: p.x, y: p.y, on: true, m: false, vx: 0, vy: 0, ux: 0, uy: 0 }); balls[0].dirty = true; }
      if (o.assign) {
        groups[shooter] = o.assign; groups[shooter === 'p' ? 'c' : 'p'] = other(o.assign);
      }
      const wasBreak = isBreak;
      isBreak = false;
      let msg = null, sub = null, bad = false;
      if (o.foul) {
        msg = o.scratch ? 'Scratch!' : 'Foul'; sub = (o.scratch ? 'Cue ball back on the head spot. ' : o.reason + '. ') + (shooter === 'p' ? "CPU's turn" : 'Your turn'); bad = shooter === 'p';
        ctx.sound(shooter === 'p' ? 'bad' : 'good');
      } else if (o.assign) {
        msg = `${who === 'You' ? 'You' : 'CPU'}: ${o.assign === 'solids' ? 'Solids' : 'Stripes'}`;
        sub = shooter === 'p' ? `CPU has ${other(o.assign)}. Keep shooting!` : `You have ${other(o.assign)}`;
        ctx.sound(shooter === 'p' ? 'good' : 'tap');
      } else if (o.keep) { if (shooter === 'p') { ctx.sound('good'); } }
      else if (o.respot8) { msg = '8 re-spotted'; }
      else if (wasBreak) { msg = 'Nothing dropped'; sub = "CPU's turn"; }
      if (o.respot8 && msg !== '8 re-spotted') sub = (sub ? sub + ' ' : '') + '(8 re-spotted)';
      if (msg) toast(msg, sub, bad);
      if (!o.keep) turn = shooter === 'p' ? 'c' : 'p';
      if (turn === 'p') { phase = 'aim'; aim = defaultAim(); setPow(0); hud(); }
      else { phase = 'wait'; hud(); setPow(0, 'CPU'); later(cpuTurn, msg ? 900 : 450); }
    }

    function defaultAim() {
      const C = balls[0], tg = targetsFor(balls, groups.p);
      let best = null, bd = Infinity;
      for (const n of tg) { const b = balls[n], d = Math.hypot(b.x - C.x, b.y - C.y); if (d < bd) { bd = d; best = b; } }
      return best ? Math.atan2(best.y - C.y, best.x - C.x) : aim;
    }

    function cpuTurn() {
      phase = 'ai'; hud();
      const plan = aiPlan(balls, groups, level, rnd);
      const shot = aiNoise(plan, level, rnd);
      const from = aim, to = from + angDiff(shot.ang, from);
      ai = { from, to, cur: from, pull: 0, strike: false, t: 0, shot, dur: 0.75 + Math.min(0.6, Math.abs(to - from) * 0.25), wig: (rnd() - 0.5) * 0.06 };
    }
    function aiTick(dt) {
      ai.t += dt;
      const t = ai.t, d = ai.dur;
      if (t < d) {
        const k = t / d, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        ai.cur = ai.from + (ai.to - ai.from) * e + Math.sin(k * Math.PI) * ai.wig;
      } else ai.cur = ai.to;
      const p = ai.shot.speed / V_MAX;
      if (t > d + 0.15 && t < d + 0.7) { ai.pull = p * clamp((t - d - 0.15) / 0.4, 0, 1); setPow(ai.pull, `CPU power ${Math.round(p * 100)}%`); }
      if (t >= d + 0.7 && !ai.strike) { ai.strike = true; ai.st = t; }
      if (ai.strike && t >= ai.st + 0.06) {
        aim = ai.to; const s = ai.shot; ai = null;
        takeShot(s.ang, s.speed);
      }
    }

    function gameOver(won, detail) {
      if (over) return;
      over = true; phase = 'over';
      hud();
      for (const id of timers) clearTimeout(id); timers.clear();
      cleanup();
      const mine = groups.p;
      const score = mine ? 7 - remaining(balls, mine) : 0;
      const result = { won: !!won, detail, score, stats: { shots, level, seconds: Math.round((performance.now() - t0) / 1000) } };
      later2(() => ctx.finish(result), 900);
      draw();
    }
    function later2(fn, ms) { setTimeout(fn, ms); }

    // ---- main loop
    let raf = 0, last = performance.now();
    function frame(now) {
      raf = 0;
      if (over && !anims.length) { draw(); return; }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      pulse += dt;
      if (phase === 'roll') {
        acc += dt;
        let n = 0;
        while (acc >= HSTEP && n < 60) { step(balls, HSTEP, ev); acc -= HSTEP; n++; }
        simT += n * HSTEP;
        // sounds + pocket anims
        if (ev.clacks.length) { const nowS = now; if (nowS - lastClack > 55) { ctx.sound('tap'); lastClack = nowS; } ev.clacks.length = 0; }
        while (ev.pockets.length) { const p = ev.pockets.shift(); anims.push(Object.assign({ t: 0 }, p)); ctx.sound('catch'); }
        if (!anyMoving(balls) || simT > MAX_SHOT_T) {
          for (const b of balls) { b.vx = b.vy = b.ux = b.uy = 0; b.m = false; }
          phase = 'settle';
          later(endShot, 120);
        }
      }
      if (phase === 'ai' && ai) aiTick(dt);
      // rolling orientation
      for (const b of balls) {
        if (!b.on || !b.M) continue;
        const d = Math.hypot(b.rx, b.ry);
        if (d > 1e-4) { rotate(b, -b.ry / d, b.rx / d, d / R); }
        b.rx = b.ry = 0;
      }
      for (let i = anims.length - 1; i >= 0; i--) { anims[i].t += dt; if (anims[i].t > 0.3) anims.splice(i, 1); }
      draw();
      if (!over || anims.length) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && (!over || anims.length)) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    // ---- input
    let drag = null;
    const maxPull = () => clamp(Math.min(LY.cw, LY.ch) * 0.42, 110, 220);
    function evPos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function onDown(e) {
      if (over || turn !== 'p' || phase !== 'aim' || !balls[0].on) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      const [sx, sy] = evPos(e), [cx, cy] = toS(balls[0].x, balls[0].y);
      const dc = Math.hypot(sx - cx, sy - cy);
      const hitR = Math.max(R * LY.s * 2.4, 30);
      if (dc <= hitR) { drag = { mode: 'pull', id: e.pointerId, sx, sy, started: false, lock: false }; phase = 'pull'; }
      else drag = { mode: 'dial', id: e.pointerId, sx, sy, prev: Math.atan2(sy - cy, sx - cx), moved: 0 };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const [sx, sy] = evPos(e), [cx, cy] = toS(balls[0].x, balls[0].y);
      if (drag.mode === 'dial') {
        const a = Math.atan2(sy - cy, sx - cx);
        drag.moved = Math.max(drag.moved, Math.hypot(sx - drag.sx, sy - drag.sy));
        if (drag.moved > 6) aim += screenToWorldAng(angDiff(a, drag.prev));
        drag.prev = a;
        return;
      }
      // pull: vector from finger to cue ball = shot direction
      const vx = cx - sx, vy = cy - sy, dist = Math.hypot(vx, vy);
      if (!drag.started) {
        if (dist < 10) return;
        drag.started = true;
        const a0 = screenAngToWorld(Math.atan2(vy, vx));
        drag.lock = Math.abs(angDiff(a0, aim)) < 25 * Math.PI / 180;
        drag.a0 = a0; drag.base = aim;
      }
      const a = screenAngToWorld(Math.atan2(vy, vx));
      aim = drag.lock ? drag.base + angDiff(a, drag.a0) * 0.5 : a;
      power = clamp((dist - 10) / maxPull(), 0, 1);
      setPow(power);
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const d = drag; drag = null;
      if (d.mode === 'dial') {
        if (d.moved <= 6) { const [sx, sy] = evPos(e), [wx, wy] = toW(sx, sy), C = balls[0]; aim = Math.atan2(wy - C.y, wx - C.x); ctx.sound('tap'); }
        return;
      }
      phase = 'aim';
      if (power >= 0.04) takeShot(aim, power * V_MAX);
      else { power = 0; setPow(0); }
    }
    function onCancel(e) { if (drag && e.pointerId === drag.id) { drag = null; if (phase === 'pull') phase = 'aim'; power = 0; setPow(0); } }
    // world angle <-> screen angle (vertical layout rotates the table by -90deg)
    const screenAngToWorld = (a) => (LY.vert ? a + Math.PI / 2 : a);
    const screenToWorldAng = (d) => d; // rotation preserves angle deltas
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // fine aim buttons (hold to repeat)
    function nudger(btn, dir) {
      let iv = null, n = 0;
      const stop = () => { clearInterval(iv); iv = null; };
      const go = (e) => {
        e.preventDefault(); if (over || turn !== 'p' || phase !== 'aim') return;
        n = 0; const tick = () => { n++; aim += dir * (n > 12 ? 0.6 : 0.12) * Math.PI / 180; };
        tick(); stop(); iv = setInterval(tick, 70);
      };
      btn.addEventListener('pointerdown', go);
      for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, stop);
      return stop;
    }
    // in vertical layout "left" on screen is a counter-clockwise turn as seen; keep it intuitive: left button = rotate CCW on screen
    const stopL = nudger($('.pl-l'), -1), stopR = nudger($('.pl-r'), 1);
    function onKey(e) {
      if (over || turn !== 'p' || phase !== 'aim') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        aim += (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 2 : 0.15) * Math.PI / 180;
      }
    }
    window.addEventListener('keydown', onKey);
    const quit = $('.quit');
    let armT = null;
    quit.addEventListener('click', () => {
      if (over) return;
      if (!quit.classList.contains('arm')) { quit.classList.add('arm'); quit.textContent = 'Sure?'; clearTimeout(armT); armT = setTimeout(() => { quit.classList.remove('arm'); quit.textContent = 'Give up'; }, 2500); return; }
      toast('Game over', 'You gave up', true, 3000);
      gameOver(false, 'You gave up');
    });

    let ro = null, rsPending = false;
    const onResize = () => { if (rsPending) return; rsPending = true; requestAnimationFrame(() => { rsPending = false; const w = Math.floor(root.clientWidth); if (w !== LY.cw || Math.abs((window.innerHeight || 0) - lastVH) > 80) { lastVH = window.innerHeight; layout(); } }); };
    let lastVH = window.innerHeight;
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }
    window.addEventListener('resize', onResize);

    function cleanup() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      stopL(); stopR();
    }

    // Read-only debug view for automated tests: positions/turn/layout, no way to change the game.
    function snapshot() {
      const r = canvas.getBoundingClientRect();
      return {
        phase, turn, isBreak, over, shots, level, groups: Object.assign({}, groups), aim, maxPull: maxPull(),
        balls: balls.map((b) => ({ n: b.n, x: b.x, y: b.y, on: b.on, moving: !!b.m })),
        layout: { vert: LY.vert, s: LY.s, ox: LY.ox, oy: LY.oy, left: r.left, top: r.top, w: LY.cw, h: LY.ch },
      };
    }
    window.__poolDebug = Object.freeze({
      state: () => snapshot(),
      client: (x, y) => { const r = canvas.getBoundingClientRect(), [sx, sy] = toS(x, y); return { x: r.left + sx, y: r.top + sy }; },
      geometry: () => ({ W, H, R, pockets: POCKETS.map((p) => ({ x: p.x, y: p.y, aim: p.aim })) }),
    });

    layout();
    hud(); setPow(0);
    toast('Your break', 'Drag back from the cue ball and let go', false, 2200);
    ctx.sound('whistle');
    kick();
    // keep the loop alive (it stops only after game over)
    const keep = setInterval(() => { if (over) clearInterval(keep); else kick(); }, 500);
  }

  window.MFLArcade.register('pool', { start });
})();
