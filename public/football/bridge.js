// Adapter for the supplied GameMaker HTML5 build. Keep the vendor runtime intact.
// These names are the compiled symbols in runtime.js; the corresponding original
// script names are recorded in its _Y._OU1 table.
(function () {
  let session, sent = false;
  const parentOrigin = document.referrer ? new URL(document.referrer).origin : location.origin;
  const master = () => Object.values(_si(64))[0];
  const send = (type, extra = {}) => parent.postMessage({ type, token: session && session.token, ...extra }, parentOrigin);
  const field = (obj, name, value) => { obj[_aF2[name]] = value; };
  function rgb(hex) {
    const n = parseInt(String(hex || '#ffffff').slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
  }
  function uniforms(m, team, side) {
    const parts = { helmet: team.color, logo: team.color2, shirt: team.color, sleeve: team.color2,
      pants: team.color2, pants_b: team.color2, stripe: team.color, socks1: team.color, socks2: team.color2, endzone: team.color };
    for (const [part, color] of Object.entries(parts)) field(m, `col_${part}_${side}`, rgb(color));
  }
  function start() {
    const m = master(), { home, away } = session.data;
    // A fresh single-match fixture replaces the bundled franchise schedule.
    // Keep the runtime's own match physics, rendering, controls and sound.
    const fixture = _eF(m, m);
    _Yi(fixture, 'away_team', 1); _Yi(fixture, 'home_team', 0);
    _Yi(fixture, 'away_score', -1); _Yi(fixture, 'home_score', -1);
    _Yi(fixture, 'human_win', 'unplayed');
    field(m, 'myteam_id', 0); field(m, 'myteam', _zi(m._Ej, 0));
    field(m, 'op_difficulty', session.level + 1); // easy, medium, hard, extreme
    field(m, 'op_matchlength', 0); // the supplied game's two-minute quarters
    field(m, 'year', 2); // enables normal timeouts rather than first-season tutorial restrictions
    field(m, 'intro', 0);
    [home, away].forEach((team, i) => {
      const t = _zi(m._Ej, i);
      _Yi(t, 'name', team.name); _Yi(t, 'tla', team.abbr);
      const rating = team.players?.length ? team.players.reduce((sum, p) => sum + p.ovr, 0) / team.players.length / 10 : 3 + session.level * 2;
      _Yi(t, 'offense', Math.min(10, rating));
      _Yi(t, 'defense', Math.min(10, rating));
      _Yi(t, 'roof', 1); // deterministic clear-weather exhibition
    });
    const roster = _4j();
    const positions = { QB: 1, RB: 2, TE: 3, WR1: 4, WR2: 4, WR3: 4, UTIL1: 5, UTIL2: 10 };
    for (const p of home.players.filter(Boolean)) {
      const player = _zH(m, m, positions[p.pos] || 4, 24, 3, 5);
      const names = p.name.trim().split(/\s+/);
      const values = { fname: names.shift(), lname: names.join(' ') || p.name,
        speed: p.spd / 10, strength: (p.pos === 'QB' ? p.thr : p.str) / 10,
        skill: (p.pos === 'QB' ? p.acc : p.pos === 'UTIL2' ? p.kick : p.cat) / 10,
        stamina: p.ovr / 10, condition: 100, attitude: 100, resting: 0, teamid: 0,
        skin: Math.min(2, Math.round((p.look?.skin || 0) / 2)) };
      for (const [key, value] of Object.entries(values)) _Yi(player, key, value);
      _8j(roster, player);
    }
    m._Ln = roster;
    _jY(m, m, false); // reset per-match stats
    _4Q(m, m); // populate the runtime's home/away team references
    uniforms(m, home, 'home'); uniforms(m, away, 'away');
    _Hj(17); // rm_match
    send('mfl-football-playing');
  }
  function finish() {
    if (sent) return;
    sent = true;
    const m = master(), match = Object.values(_si(71))[0];
    const scores = match._Sb1, human = match._0z;
    const score = Number(scores[human]), opp = Number(scores[1 - human]);
    const stats = { td: 0, pass: 0, rush: 0 };
    for (let i = 0; i < _wi(m._Ln); i++) {
      const p = _zi(m._Ln, i), qb = Number(_Ai(p, 'position')) === 1;
      if (qb) stats.pass += Number(_Ai(p, 'stat_yards')) || 0;
      else stats.td += Number(_Ai(p, 'stat_touchdowns')) || 0;
      stats.td += Number(_Ai(p, 'stat_rush_touchdowns')) || 0;
      stats.rush += Number(_Ai(p, 'stat_rush_yards')) || 0;
    }
    send('mfl-football-finish', { result: { won: score > opp, tie: score === opp, score, opp, stats } });
  }
  window.addEventListener('message', e => {
    if (e.source !== parent || e.origin !== parentOrigin || e.data?.type !== 'mfl-football-start' || session) return;
    session = e.data;
    // Register the end hook before script methods are bound to GameMaker objects.
    const index = _Y._OU1.indexOf('gml_Script_s_end_match');
    window._1d1 = finish;
    _Y._PU1[index] = finish;
    _Y._Z[0].__ = []; // extension is already inline; no filtered script URL needed
    window.PokiSDK = null; window.PokiSDK_OK = false; window.PokiSDK_loadState = 0;
    GameMaker_Init();
    const since = Date.now();
    const timer = setInterval(() => {
      try {
        const m = master();
        if (m && m._Ln !== undefined && _wi(m._Ej) === 32 && _eF(m, m) >= 0) {
          clearInterval(timer); start();
        } else if (Date.now() - since > 30000) {
          clearInterval(timer); send('mfl-football-error');
        }
      } catch (err) { clearInterval(timer); console.error(err); send('mfl-football-error'); }
    }, 100);
  });
  send('mfl-football-ready');
})();
