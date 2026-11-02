(function () {
  const config = window.MFL_CAREER;
  if (!config?.signedIn) return;
  const hub = document.getElementById('career-hub'), field = document.getElementById('career-field');
  const error = document.getElementById('career-error'), status = document.getElementById('career-status');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const levels = ['Rookie', 'Pro', 'All-Pro', 'Legend'], prizes = config.prizes || [];
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  let store = config, state = store.state, panel = state ? 'home' : 'saves', busy = false, release = null, live = null, newSlot = 1;
  const findTeam = id => state.teams.find(t => t.id === id);
  const shortName = team => team.name.replace(/\s+(Junior High|Middle School)\b/g, '');
  const ours = () => findTeam(state.teamId);
  const gameNow = () => state.rounds[state.week]?.games.find(g => g.home === state.teamId || g.away === state.teamId);
  const button = (label, action, data = '', disabled = false) => `<button type="button" class="pixel-button" data-action="${action}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`;
  const tab = (label, name, extra = '') => `<button type="button" class="pixel-button ${extra}" data-panel="${name}">${label}</button>`;
  const scrollTable = (headers, rows) => `<div class="career-scroll"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  function absorb(body) { if ('saves' in body) { store = { ...store, ...body }; state = store.state; } }
  async function request(action, data = {}, keepalive = false) {
    const response = await fetch('/api/career/' + action, { method: 'POST', keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: store.revision, save: state?.saveId, client: config.client, ...data }) });
    const body = await response.json(); absorb(body);
    if (!body.ok) throw new Error(body.error || 'Could not save your career. Try again.');
    return body;
  }
  async function commitResult(result) {
    try { return await request('finish', result); }
    catch (err) {
      // Recover a committed result whose response was lost, without refreshing
      // the document or granting permission to replay an unfinished matchup.
      try {
        const latest = await (await fetch('/api/career?client=' + encodeURIComponent(config.client))).json();
        if (latest.ok) {
          absorb(latest);
          const game = state?.saveId === result.save && state.rounds.flatMap(r => r.games).find(g => g.id === result.id);
          if (game && game.score !== null) return latest;
        }
      } catch {}
      throw err;
    }
  }
  // Career wins pay the Arcade's "play for coins" prize for this difficulty. The match is
  // started and finished through the Arcade API, which re-checks the saved career result.
  async function startCoinGame() {
    try {
      const r = await fetch('/api/m/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'bowl', level: state.level, career: true }) });
      const body = await r.json();
      return body.ok && body.id ? body.id : null;
    } catch { return null; }
  }
  async function claimCoins(id, result) {
    try {
      const r = await fetch('/api/m/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result: { won: result.score > result.opp, tie: result.score === result.opp, score: result.score, stats: result.stats } }) });
      const body = await r.json();
      if (body.ok && body.balance != null) document.querySelectorAll('[data-balance]').forEach(n => { n.textContent = fmt(body.balance); });
      if (body.ok && body.net > 0) store.coins = (store.coins || 0) + body.net;
      return body;
    } catch { return null; }
  }
  function standings(full = false) {
    let rows = state.standings;
    if (!full) {
      rows = rows.slice(0, 4);
      if (!rows.some(t => t.id === state.teamId)) rows[3] = state.standings.find(t => t.id === state.teamId);
    }
    return scrollTable([full ? 'School / team' : 'McLean County', 'W', 'L', 'T'], rows.map(t => `<tr class="${t.id === state.teamId ? 'ours' : ''}"><td>${esc(full ? t.name : shortName(t))}</td><td>${t.w}</td><td>${t.l}</td><td>${t.t}</td></tr>`).join(''));
  }
  function timeline() {
    return [state.week - 1, state.week, state.week + 1].map((index, i) => {
      const round = state.rounds[index], game = round?.games.find(g => g.home === state.teamId || g.away === state.teamId);
      const opponent = game ? findTeam(game.home === state.teamId ? game.away : game.home) : null;
      const label = round?.label || (index < 0 ? 'Season kickoff' : state.phase === 'complete' ? 'Next school year' : 'County playoffs');
      const played = game && game.score !== null;
      const score = game && (game.home === state.teamId ? game.score : game.opp), opp = game && (game.home === state.teamId ? game.opp : game.score);
      return `<div class="timeline-stop ${i === 1 ? 'current' : ''} ${played ? score > opp ? 'won' : 'lost' : ''}"><b>${esc(label)}</b><span>${opponent ? (game.home === state.teamId ? 'vs ' : 'at ') + esc(shortName(opponent)) : 'Thomas Metcalf'}</span><i aria-hidden="true"></i><strong>${played ? `${score > opp ? 'W' : score < opp ? 'L' : 'T'} ${score}–${opp}${game.forfeit ? ' · FF' : ''}` : i === 1 ? 'UP NEXT' : 'MFL'}</strong></div>`;
    }).join('');
  }
  function stars(rating) {
    const n = Math.max(0, Math.min(5, Math.round(rating / 20)));
    return `<span class="rating-stars" role="img" aria-label="${n} out of 5 stars">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'filled' : ''}"></i>`).join('')}</span>`;
  }
  function home() {
    const team = ours(), morale = Math.round(team.players.reduce((n, p) => n + p.morale, 0) / team.players.length);
    const offense = team.players.reduce((n, p) => n + p.ovr, 0) / team.players.length, defense = team.players.reduce((n, p) => n + p.def, 0) / team.players.length;
    return `<section class="retro-home" aria-label="MFL career home">
      <header class="retro-head"><span class="retro-badge" title="Program credits">${state.budget} C</span><h1><span aria-hidden="true">★✦★</span> MFL FOOTBALL <span aria-hidden="true">★✦★</span></h1><span class="retro-badge">Y${state.season}</span></header>
      <div class="retro-timeline">${timeline()}</div>
      <div class="retro-summary"><fieldset class="retro-standings"><legend>McLean County</legend>${standings()}<button class="all-standings" data-panel="schedule">Full standings ▸</button></fieldset>
        <div class="retro-team-stats"><fieldset class="retro-fans"><legend>Fans ${state.fans ?? 50}%</legend><div class="fans-meter" role="progressbar" aria-label="Fans" aria-valuenow="${state.fans ?? 50}" aria-valuemin="0" aria-valuemax="100"><span aria-hidden="true">♟</span><i style="width:${state.fans ?? 50}%"></i></div></fieldset>
        <div class="retro-ratings"><fieldset><legend>Morale</legend><b>${morale}% <span aria-hidden="true">☻</span></b></fieldset><fieldset><legend>Offense</legend>${stars(offense)}</fieldset><fieldset><legend>Defense</legend>${stars(defense)}</fieldset></div><div class="retro-team-label">${esc(team.name)} · ${esc(state.levelName)}</div></div>
      </div>
      <nav class="retro-nav" aria-label="Career menu">${tab('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5a5 5 0 0 0-6 6L2 17l5 5 6-6a5 5 0 0 0 6-6l-4 4-4-4 4-4z"/></svg><span class="sr-only">Settings</span>', 'settings', 'settings-button')}${tab('FRONT<br>OFFICE', 'office')}${tab('ROSTER', 'roster')}${tab('HALL OF<br>FAME', 'history')}${tab('CONTINUE ▸', 'continue', 'continue-button')}</nav>
    </section><div class="career-save-strip"><span>${esc(state.saveName)} · ${esc(state.coach)}${state.dynamic ? ' · Dynamic Lineup' : ''}<b class="career-coins">+${fmt(store.coins)} coins from career wins</b></span>${tab('SAVE SLOTS', 'saves')}</div>`;
  }
  function saveScreen() {
    const slots = Array.from({ length: store.maxSaves || 5 }, (_, i) => {
      const save = store.saves.find(s => s.slot === i + 1);
      return `<article class="save-slot ${save?.id === store.selected ? 'selected' : ''}"><span class="slot-number">SAVE ${i + 1}</span>${save ? `<h2>${esc(save.name)}</h2><p>${esc(save.team)} · ${esc(save.coach)}</p><p>Year ${save.season} · ${save.complete ? 'Season complete' : 'Week ' + save.week} · ${save.w}–${save.l}${save.t ? '–' + save.t : ''}</p><p>${esc(save.level)} · ${save.titles} County Cups${save.dynamic ? ' · Dynamic Lineup' : ''}</p><div class="slot-actions">${button('LOAD SAVE', 'select', `data-save="${save.id}"`)}${button('DELETE', 'delete', `data-save="${save.id}"`)}</div>` : `<h2>EMPTY SLOT</h2><p>A new Metcalf story starts here.</p><button class="pixel-button" data-panel="new" data-slot="${i + 1}">NEW CAREER</button>`}</article>`;
    }).join('');
    return `<section class="career-panel"><header><h1>MFL SAVE SLOTS</h1>${state ? tab('BACK', 'home') : ''}</header><p>Five independent careers. Deleting a save permanently removes that career.</p><div class="save-grid">${slots}</div></section>`;
  }
  function newScreen() {
    return `<section class="career-panel"><header><h1>NEW MFL CAREER</h1>${tab('BACK', 'saves')}</header><form id="career-new" class="career-start"><input type="hidden" name="slot" value="${newSlot}">
      <label class="wide">Save name<input name="saveName" maxlength="40" value="My MFL career" required></label><div class="career-teams wide">${config.teams.map((t, i) => `<label class="career-team" style="--team:${esc(t.color)}"><input type="radio" name="team" value="${esc(t.id)}" ${!i ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div>
      <label>Coach name<input name="coach" maxlength="32" value="Coach" required></label><label>Difficulty<select name="level">${levels.map((l, i) => `<option value="${i}">${l}${prizes[i] ? ' · wins pay ' + fmt(prizes[i]) : ''}</option>`).join('')}</select></label>
      <div class="career-dynamic wide"><label><input type="checkbox" name="dynamic" value="on" ${config.lineup ? '' : 'disabled'}> DYNAMIC LINEUP</label><p>Your team is always your current card Lineup: each game uses the players in your Lineup at kickoff.${config.lineup ? '' : ' <a href="/pickem/cards">Set a full Lineup</a> to turn this on.'}</p></div>
      <p class="wide">Real MFL players and looks. A full county season. Every win pays site coins at your difficulty. Leaving or refreshing a live game always counts as a loss.</p><button type="submit" class="pixel-button">START CAREER</button></form></section>`;
  }
  function roster() {
    const rows = ours().players.map(p => `<tr><td><b>${esc(p.name)}</b><small>Career grade ${p.grade}</small></td><td>${esc(p.pos)}</td><td>${p.ovr}</td><td>${p.spd}</td><td>${p.pos === 'QB' ? p.acc : p.pos === 'UTIL2' ? p.kick : p.cat}</td><td>${p.condition}%</td><td>${p.morale}%</td></tr>`).join('');
    return `<h2>Your roster</h2><p>${state.dynamic ? 'Dynamic Lineup: these are the cards in your Lineup. Change players on the <a href="/pickem/cards">Cards page</a>; this roster updates at every kickoff and keeps your training.' : 'Condition and morale affect game-day attributes. Eighth graders graduate each school year.'}</p>${scrollTable(['Player', 'Pos', 'OVR', 'Speed', 'Skill', 'Condition', 'Morale'], rows)}${ours().reserves?.length ? `<h2>Practice squad</h2>${ours().reserves.map(p => `<div class="panel-item"><b>${esc(p.name)}</b><p>${p.pos} · Grade ${p.grade} · ${p.ovr} OVR</p>${button('START PLAYER', 'activate', `data-player="${esc(p.id)}"`, state.phase === 'complete')}</div>`).join('')}` : ''}`;
  }
  function office() {
    const complete = state.phase === 'complete', next = gameNow();
    return `<h2>Front office</h2><p>${state.budget} program credits · Thomas Metcalf School</p><div class="office-grid"><section><h3>After-school practice</h3><p>${state.trained ? 'Practice is complete for this matchup.' : 'One session per matchup. Speed and skills improve ratings; recovery restores condition.'}</p><div class="career-actions">${['speed', 'skills', 'recovery'].map(f => button(f.toUpperCase(), 'train', `data-focus="${f}"`, complete || state.trained || !next)).join('')}</div>
      <h3>Facilities</h3>${['training', 'recovery'].map(f => { const n = state.facilities[f], cost = 25 + n * 15; return `<div class="panel-item"><b>${f === 'training' ? 'Practice equipment' : 'Recovery space'} · ${n}/3</b><p>${f === 'training' ? 'Each level adds +1 to attribute gains in practice.' : 'Each level improves recovery and post-game condition.'}</p>${button(n === 3 ? 'MAX LEVEL' : 'UPGRADE · ' + cost + ' C', 'facility', `data-facility="${f}"`, complete || n === 3 || state.budget < cost)}</div>`; }).join('')}</section>
      <section><h3>The Metcalf story</h3><h2>${esc(state.story.title)}</h2><p>${esc(state.story.text)}</p>${state.choice ? '<p>Team activity complete.</p>' : state.story.choices.map(c => button(`${esc(c.label)}<small>${esc(c.detail)}</small>`, 'choice', `data-choice="${c.id}"`)).join('')}<h3>Open tryouts</h3>${state.dynamic ? '<p>Your card Lineup is your roster in a Dynamic Lineup career, so tryouts are closed.</p>' : `<p>12 credits. One sixth grader per matchup. Your current starter joins the practice squad.</p><details><summary>View tryout players</summary>${state.candidates.map(p => `<div class="panel-item"><b>${esc(p.name)}</b><p>${p.pos} · Grade 6 · ${p.ovr} OVR · ${p.spd} speed</p>${button('WELCOME ' + p.pos, 'recruit', `data-player="${esc(p.id)}"`, complete || !next || state.recruited || state.budget < 12)}</div>`).join('')}</details>`}</section></div><h3>School paper</h3>${state.news.slice(0, 6).map(n => `<article class="panel-item"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></article>`).join('')}`;
  }
  function schedule() {
    return `<h2>County standings</h2><p>Top four advance. Tiebreakers: point difference, then points scored.</p>${standings(true)}<h2>County schedule &amp; playoffs</h2>${scrollTable(['Round', 'Home', 'Score', 'Away'], state.rounds.flatMap(r => r.games.filter(g => g.home === state.teamId || g.away === state.teamId || r.kind !== 'regular').map(g => `<tr><td>${esc(r.label)}</td><td>${esc(findTeam(g.home).name)}</td><td>${g.score === null ? 'vs' : g.score + '–' + g.opp + (g.forfeit ? ' FF' : g.overtime ? ' OT' : '')}</td><td>${esc(findTeam(g.away).name)}</td></tr>`)).join(''))}`;
  }
  function continueScreen() {
    const next = gameNow(), round = state.rounds[state.week];
    if (state.phase === 'complete') return `<h2>${state.champion === state.teamId ? 'COUNTY CHAMPIONS!' : esc(findTeam(state.champion).name) + ' won the County Cup'}</h2><p>${esc(state.story.text)}</p>${button('BEGIN NEXT SCHOOL YEAR', 'next-season')}`;
    if (!next) return `<h2>${esc(round.label)}</h2><p>Your team has finished playing this school year. Follow the rest of the county bracket.</p>${button('SIMULATE ROUND', 'watch')}`;
    const other = findTeam(next.home === state.teamId ? next.away : next.home);
    return `<div class="next-match"><span>${esc(round.label)}</span><h2>${esc(ours().name)}<br><small>VS</small><br>${esc(other.name)}</h2><p>${next.home === state.teamId ? 'Home at Thomas Metcalf' : 'Away at ' + esc(other.name)} · ${esc(state.levelName)}</p>${prizes[state.level] ? `<p class="career-prize">A win pays <b>${fmt(prizes[state.level])} coins</b></p>` : ''}<p class="quit-rule">Leaving, closing, or refreshing during this game is an automatic 0–21 loss. Games cannot be resumed.</p>${button('PLAY ' + esc(round.label).toUpperCase(), 'play')}</div>`;
  }
  function render() {
    if (!state && !['saves', 'new'].includes(panel)) panel = 'saves';
    if (panel === 'saves') hub.innerHTML = saveScreen();
    else if (panel === 'new') hub.innerHTML = newScreen();
    else if (panel === 'home') hub.innerHTML = home();
    else {
      let content = '';
      if (panel === 'roster') content = roster();
      else if (panel === 'office') content = office();
      else if (panel === 'schedule') content = schedule();
      else if (panel === 'history') content = `<h2>Hall of Fame</h2><p>${state.titles || 0} County Cups · ${esc(ours().name)}</p>${state.history.length ? state.history.map(h => `<article class="panel-item"><h3>Year ${h.season} · ${h.w}–${h.l}${h.t ? '–' + h.t : ''}${h.title ? ' · CHAMPIONS' : ''}</h3><p>County champions: ${esc(h.champion)}</p></article>`).join('') : '<p>Your legacy starts this season. Complete a school year to add its record here.</p>'}`;
      else if (panel === 'settings') content = `<h2>Career settings</h2><label>Difficulty<select id="career-level">${levels.map((l, i) => `<option value="${i}" ${state.level === i ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p>Roster: ${state.dynamic ? 'Dynamic Lineup (your current card Lineup at every kickoff)' : 'set when this career started'}.</p><p>Wins pay ${levels.map((l, i) => `${l} ${fmt(prizes[i])}`).join(' · ')} coins.</p><p>Leaving or refreshing mid-game always counts as a loss.</p>${tab('MANAGE SAVE SLOTS', 'saves')}${tab('COUNTY SCHEDULE', 'schedule')}`;
      else content = continueScreen();
      hub.innerHTML = `<section class="career-panel"><header><span>MFL FOOTBALL · Y${state.season}</span>${tab('HOME', 'home')}</header>${content}</section>`;
    }
  }
  async function action(name, data = {}) {
    if (busy) return;
    busy = true; error.textContent = ''; status.textContent = 'Saving…';
    hub.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      if (name === 'play') { const arcade = await startCoinGame(); if (arcade) data = { ...data, arcade }; }
      const body = await request(name, data);
      if (name === 'new' || name === 'select' || name === 'next-season') panel = 'home';
      if (name === 'delete') panel = 'saves';
      render(); status.textContent = 'Saved.';
      if (body.match) mount(body.match);
    } catch (err) { error.textContent = err.message; status.textContent = ''; render(); }
    finally { busy = false; }
  }
  function unmount() {
    if (release) release(); release = null;
    field.replaceChildren(); field.hidden = true; hub.hidden = false;
  }
  function mount(match) {
    unmount(); hub.hidden = true; field.hidden = false;
    live = { save: state.saveId, id: match.id, token: match.token, ...(match.arcade ? { arcade: match.arcade } : {}) };
    field.innerHTML = `<div class="career-game"><p role="status">Loading MFL football…</p><iframe title="MFL career football game" allow="autoplay; fullscreen" allowfullscreen></iframe><div class="career-game-toolbar"><button class="pixel-button" data-fullscreen>FULL SCREEN</button><button class="pixel-button" data-quit>QUIT · LOSS</button><p>Leaving or refreshing is an automatic loss.</p></div></div>`;
    const frame = field.querySelector('iframe'), loading = field.querySelector('[role=status]');
    const origin = new URL(window.MFL_API_ORIGIN || location.origin).origin, token = crypto.randomUUID();
    let finished = false;
    async function receive(e) {
      if (e.source !== frame.contentWindow || e.origin !== origin) return;
      const msg = e.data || {};
      if (msg.type === 'mfl-football-ready') frame.contentWindow.postMessage({ type: 'mfl-football-start', token, data: match.data, level: match.level, seed: match.seed }, origin);
      else if (msg.token === token && msg.type === 'mfl-football-playing') { loading.hidden = true; frame.focus(); }
      else if (msg.token === token && msg.type === 'mfl-football-error') { loading.hidden = false; loading.textContent = 'Football could not load. Quitting or refreshing counts as a loss.'; }
      else if (msg.token === token && msg.type === 'mfl-football-finish' && !finished) {
        finished = true;
        const result = { ...live, score: msg.result.score, opp: msg.result.opp, stats: msg.result.stats };
        unmount(); hub.hidden = true; field.hidden = false;
        field.innerHTML = `<section class="career-panel next-match"><h2>${esc(match.data.home.abbr)} ${result.score} – ${result.opp} ${esc(match.data.away.abbr)}</h2><p role="status">Saving result…</p><button class="pixel-button" hidden>RETRY SAVE</button></section>`;
        const save = async () => {
          const retry = field.querySelector('button'), message = field.querySelector('[role=status]'); retry.hidden = true;
          try {
            await commitResult(result);
            const paid = result.arcade ? await claimCoins(result.arcade, result) : null;
            live = null; unmount(); panel = 'home'; render();
            status.innerHTML = 'Final score saved.' + (paid?.ok && paid.net > 0 ? ` <b class="career-coins">+${fmt(paid.net)} coins</b>` : paid?.ok && result.score > result.opp && paid.message ? ' ' + esc(paid.message) : '');
          }
          catch (err) { message.textContent = err.message; retry.hidden = false; }
        };
        field.querySelector('button').addEventListener('click', save); await save();
      }
    }
    window.addEventListener('message', receive);
    release = () => { window.removeEventListener('message', receive); frame.remove(); };
    frame.src = origin + '/play/football';
    field.querySelector('[data-fullscreen]').addEventListener('click', () => { const request = frame.requestFullscreen || frame.webkitRequestFullscreen; if (request) Promise.resolve(request.call(frame)).catch(() => {}); });
    field.querySelector('[data-quit]').addEventListener('click', async e => {
      e.target.disabled = true;
      try { await request('abandon', live); if (live.arcade) claimCoins(live.arcade, { score: 0, opp: 21 }); live = null; unmount(); panel = 'home'; render(); status.textContent = 'Game forfeited. Recorded as a 0–21 loss.'; }
      catch (err) { error.textContent = err.message; e.target.disabled = false; }
    });
    field.scrollIntoView({ block: 'start' });
  }
  hub.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
    if (b.dataset.panel) { panel = b.dataset.panel; if (b.dataset.slot) newSlot = Number(b.dataset.slot); error.textContent = ''; render(); return; }
    const { action: name, ...data } = b.dataset; if (!name) return;
    if (name === 'delete') {
      const slot = store.saves.find(s => s.id === data.save);
      if (!window.confirm(`Permanently delete "${slot.name}"? This career cannot be recovered.`)) return;
    }
    action(name, data);
  });
  hub.addEventListener('submit', e => { if (e.target.id !== 'career-new') return; e.preventDefault(); action('new', Object.fromEntries(new FormData(e.target))); });
  hub.addEventListener('change', e => { if (e.target.id === 'career-level') action('difficulty', { level: Number(e.target.value) }); });
  window.addEventListener('pagehide', () => {
    if (live) {
      // fetch uses the site's authenticated Pages bridge as well as direct
      // cookies. The next server read also settles the loss if this is dropped.
      fetch('/api/career/abandon', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...live, client: config.client }) }).catch(() => {});
    }
    if (release) release();
  });
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  // Older versions retained resumable final results. They cannot restore a game
  // under the new quit policy, and are intentionally never submitted here.
  render();
})();
