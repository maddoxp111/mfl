(function () {
  const config = window.MFL_CAREER;
  if (!config?.signedIn) return;
  const hub = document.getElementById('career-hub'), field = document.getElementById('career-field');
  const error = document.getElementById('career-error'), status = document.getElementById('career-status');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const levels = ['Rookie', 'Pro', 'All-Pro', 'Legend'];
  let state = config.state, busy = false, release = null;
  const resultKey = 'mfl-career-result:' + config.account;
  function rememberResult(result) {
    try { if (result) sessionStorage.setItem(resultKey, JSON.stringify(result)); else sessionStorage.removeItem(resultKey); } catch {}
  }
  const ourTeam = () => state.teams.find(t => t.id === state.teamId);
  const gameNow = () => state.rounds[state.week]?.games.find(g => g.home === state.teamId || g.away === state.teamId);
  const findTeam = id => state.teams.find(t => t.id === id);
  const button = (label, action, extra = '', disabled = false) => `<button type="button" class="btn ghost sm" data-action="${action}" ${extra} ${disabled ? 'disabled' : ''}>${label}</button>`;
  async function request(action, data = {}) {
    const response = await fetch('/api/career/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, revision: state?.revision || 0 }) });
    const body = await response.json();
    if (body.state) state = body.state;
    if (!body.ok) throw new Error(body.error || 'Career could not be saved. Try again.');
    return body;
  }
  async function commitResult(result) {
    try { const body = await request('finish', result); rememberResult(null); return body; }
    catch (err) {
      // A save may succeed even when its response is lost. Recover the server
      // state before retrying, so a completed matchup cannot trap the result UI.
      try {
        const latest = await (await fetch('/api/career')).json();
        if (latest.ok && latest.state) {
          state = latest.state;
          const played = state.rounds.flatMap(r => r.games).find(g => g.id === result.id);
          if (played && played.score !== null) { rememberResult(null); return latest; }
        }
      } catch {}
      throw err;
    }
  }
  function render() {
    if (!state) {
      hub.innerHTML = `<section class="card"><h2>Your first season starts at Metcalf</h2><p class="muted">Lead one of the site’s two teams. Your roster starts with its real MFL players, ratings, appearances and team colors.</p>
        <form id="career-new" class="career-start"><div class="wide career-teams">${config.teams.map((t, i) => `<label class="career-team" style="--team:${esc(t.color)}"><input type="radio" name="team" value="${esc(t.id)}" ${!i ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div>
        <label>Coach name<input name="coach" maxlength="32" value="Coach" required></label><label>Difficulty<select name="level">${levels.map((l, i) => `<option value="${i}">${l}</option>`).join('')}</select></label>
        <div class="wide"><p class="muted sm">A full county schedule, a four-team playoff, and a new class every school year. Your career saves to your account.</p><button class="btn" type="submit">Start MFL career</button></div></form></section>`;
      return;
    }
    const ours = ourTeam(), record = state.standings.find(t => t.id === state.teamId), round = state.rounds[state.week];
    const next = gameNow(), other = next ? findTeam(next.home === state.teamId ? next.away : next.home) : null;
    const locked = !!state.pending, complete = state.phase === 'complete', story = state.story;
    const roster = ours.players.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="career-grade">Grade ${p.grade}${p.fictional ? ' · Generated player' : ' · MFL roster'}</span></td><td>${esc(p.pos)}</td><td>${p.ovr}</td><td>${p.spd}</td><td>${p.pos === 'QB' ? p.acc : p.pos === 'UTIL2' ? p.kick : p.cat}</td><td>${p.condition}%</td><td>${p.morale}%</td></tr>`).join('');
    hub.innerHTML = `<section class="card career-summary" style="--team:${esc(ours.color)}"><div><div class="kicker">School year ${state.season} · ${esc(state.coach)}</div><h2>${esc(ours.name)}</h2><p>Thomas Metcalf School · ${esc(state.levelName)}</p></div><div class="career-stats"><div><b>${record.w}–${record.l}${record.t ? '–' + record.t : ''}</b><small>Season record</small></div><div><b>${state.budget}</b><small>Program credits</small></div><div><b>${state.titles || 0}</b><small>County Cups</small></div></div></section>
      <div class="career-layout"><div>
        <section class="card career-match" style="--team:${esc(ours.color)}"><div class="kicker">${complete ? 'School year complete' : esc(round.label)}</div>
          ${complete ? `<h2>${state.champion === state.teamId ? '🏆 County champions!' : esc(findTeam(state.champion).name) + ' won the County Cup'}</h2><p class="muted">Celebrate the eighth graders and welcome your new sixth-grade class. Facilities and program credits carry into the next school year.</p>${button('Begin next school year', 'next-season')}` : other ? `<div class="career-matchup"><span>${esc(ours.name)}</span><small>vs</small><span>${esc(other.name)}</span></div><p class="muted sm">${next.home === state.teamId ? 'Home at Thomas Metcalf' : 'Away at ' + esc(other.name)} · ${esc(other.city)}</p>
            <button class="btn" type="button" data-action="play">${locked ? 'Resume matchup' : 'Play ' + esc(round.label)}</button>${locked ? button('Forfeit matchup (0–21)', 'forfeit') + '<p class="muted sm">Saved matchup ready. Resuming starts the game again from kickoff.</p>' : ''}` : `<h2>Your season on the field is complete</h2><p class="muted">Follow the remaining county playoff games to the championship.</p>${button('Simulate ' + esc(round.label), 'watch')}`}
        </section>
        <section class="card career-story"><div class="kicker">The Metcalf story</div><h2>${esc(story.title)}</h2><p>${esc(story.text)}</p>${state.choice ? '<p class="muted sm">Your team activity is complete for this matchup.</p>' : story.choices.map(c => `<button type="button" class="btn ghost sm career-choice" data-action="choice" data-choice="${c.id}" ${locked ? 'disabled' : ''}>${esc(c.label)}<small>${esc(c.detail)}</small></button>`).join('')}</section>
        <section class="card"><h2>Your roster</h2><p class="muted sm">Condition and morale affect game-day attributes. Career grades advance each school year; eighth graders graduate.</p><div class="career-scroll"><table><thead><tr><th>Player</th><th>Position</th><th>OVR</th><th>Speed</th><th>Skill</th><th>Condition</th><th>Morale</th></tr></thead><tbody>${roster}</tbody></table></div>${ours.reserves?.length ? `<details><summary>Practice squad · ${ours.reserves.length}</summary><p class="muted sm">Move a player back into their starting position. Your current starter joins the practice squad.</p>${ours.reserves.map(p => `<p><b>${esc(p.name)}</b> · ${esc(p.pos)} · Grade ${p.grade} · ${p.ovr} OVR<br>${button('Start ' + esc(p.name), 'activate', `data-player="${esc(p.id)}"`, locked || complete)}</p>`).join('')}</details>` : ''}</section>
        <section class="card"><h2>County schedule &amp; playoffs</h2><p class="muted sm">Top four by wins (ties count half), then point difference and points scored.</p><div class="career-scroll"><table><thead><tr><th>Round</th><th>Home</th><th>Score</th><th>Away</th></tr></thead><tbody>${state.rounds.map(r => r.games.filter(g => g.home === state.teamId || g.away === state.teamId || r.kind !== 'regular').map(g => `<tr class="${g.id === next?.id ? 'ours' : ''}"><td>${esc(r.label)}</td><td>${esc(findTeam(g.home).abbr)}</td><td>${g.score === null ? 'vs' : `${g.score}–${g.opp}${g.overtime ? ' OT' : ''}`}</td><td>${esc(findTeam(g.away).abbr)}</td></tr>`).join('')).join('')}</tbody></table></div><details><summary>All county results</summary><div class="career-scroll"><table><tbody>${state.rounds.flatMap(r => r.games.map(g => `<tr><td>${esc(r.label)}</td><td>${esc(findTeam(g.home).name)}</td><td>${g.score === null ? 'vs' : g.score + '–' + g.opp}</td><td>${esc(findTeam(g.away).name)}</td></tr>`)).join('')}</tbody></table></div></details></section>
      </div><aside>
        <section class="card career-program"><h2>Manage the program</h2><label>Game difficulty<select id="career-level" ${locked ? 'disabled' : ''}>${levels.map((l, i) => `<option value="${i}" ${state.level === i ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <h3>After-school practice</h3><p>${state.trained ? 'Practice is complete for this matchup.' : 'Choose one session before the next matchup. Skills and speed improve ratings; recovery restores condition.'}</p><div class="career-actions">${['speed', 'skills', 'recovery'].map(f => button(f[0].toUpperCase() + f.slice(1), 'train', `data-focus="${f}"`, locked || state.trained || complete || !next)).join('')}</div>
          <h3>School facilities</h3>${['training', 'recovery'].map(f => { const n = state.facilities[f], cost = 25 + n * 15; return `<div><b>${f === 'training' ? 'Practice equipment' : 'Recovery space'} · ${n}/3</b><p>${f === 'training' ? 'Each level adds +1 to attribute gains in practice.' : 'Each level adds +5 to recovery practice and +3 condition after matches.'}</p>${button(n === 3 ? 'Fully upgraded' : `Upgrade · ${cost} credits`, 'facility', `data-facility="${f}"`, locked || complete || n === 3 || state.budget < cost)}</div>`; }).join('')}
          <details><summary>Open tryouts</summary><p>Welcome one sixth grader per matchup for 12 credits. They replace your current starter at the listed position in this career.</p>${state.candidates.map(p => `<div><b>${esc(p.name)}</b><p>${p.pos} · Grade 6 · ${p.ovr} OVR · ${p.spd} speed</p>${button('Welcome ' + esc(p.pos), 'recruit', `data-player="${esc(p.id)}"`, locked || complete || !next || state.recruited || state.budget < 12)}</div>`).join('')}</details>
        </section>
        <section class="card"><h2>McLean County standings</h2><div class="career-scroll"><table><thead><tr><th>School / team</th><th>W</th><th>L</th><th>T</th></tr></thead><tbody>${state.standings.map((t, i) => `<tr class="${t.id === state.teamId ? 'ours' : ''}"><td>${i + 1}. ${esc(t.name)}</td><td>${t.w}</td><td>${t.l}</td><td>${t.t}</td></tr>`).join('')}</tbody></table></div></section>
        <section class="card"><h2>School paper</h2><ul class="career-news">${state.news.slice(0, 8).map(n => `<li><small>School year ${n.season} · ${n.week < 11 ? 'Week ' + (n.week + 1) : 'County playoffs'}</small><b>${esc(n.title)}</b><p>${esc(n.text)}</p></li>`).join('')}</ul></section>
        ${state.history.length ? `<section class="card"><h2>Program history</h2>${state.history.map(h => `<p><b>Year ${h.season}: ${h.w}–${h.l}${h.t ? '–' + h.t : ''}${h.title ? ' 🏆' : ''}</b><br><small class="muted">County champions: ${esc(h.champion)}</small></p>`).join('')}</section>` : ''}
      </aside></div>`;
  }
  async function action(name, data = {}) {
    if (busy) return;
    busy = true; error.textContent = ''; status.textContent = 'Saving career…';
    hub.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const body = name === 'finish' ? await commitResult(data) : await request(name, data);
      render(); status.textContent = 'Career saved to your account.';
      if (body.match) mount(body.match);
    } catch (err) { error.textContent = err.message; status.textContent = ''; render(); }
    finally { busy = false; }
  }
  function unmount() {
    if (release) release();
    release = null; field.replaceChildren(); field.hidden = true; hub.hidden = false;
  }
  function mount(match) {
    unmount(); hub.hidden = true; field.hidden = false;
    field.innerHTML = `<div class="career-game"><p role="status">Loading MFL football…</p><iframe title="MFL career football game" allow="autoplay; fullscreen" allowfullscreen></iframe><div class="career-game-toolbar"><button type="button" class="btn ghost sm" data-fullscreen>Full screen</button><button type="button" class="btn ghost sm" data-return>Return to career</button><p>Your matchup is saved. Returning lets you restart it from kickoff.</p></div></div>`;
    const frame = field.querySelector('iframe'), loading = field.querySelector('[role=status]');
    const origin = new URL(window.MFL_API_ORIGIN || location.origin).origin, token = crypto.randomUUID();
    let finished = false;
    async function receive(e) {
      if (e.source !== frame.contentWindow || e.origin !== origin) return;
      const msg = e.data || {};
      if (msg.type === 'mfl-football-ready') frame.contentWindow.postMessage({ type: 'mfl-football-start', token, data: match.data, level: match.level, seed: match.seed }, origin);
      else if (msg.token === token && msg.type === 'mfl-football-playing') { loading.hidden = true; frame.focus(); }
      else if (msg.token === token && msg.type === 'mfl-football-error') { loading.hidden = false; loading.textContent = 'Football could not load. Return to career and try again.'; }
      else if (msg.token === token && msg.type === 'mfl-football-finish' && !finished) {
        finished = true;
        const result = { id: match.id, token: match.token, score: msg.result.score, opp: msg.result.opp, stats: msg.result.stats };
        rememberResult(result);
        unmount(); hub.hidden = true; field.hidden = false;
        field.innerHTML = `<section class="card career-result"><h2>${esc(match.data.home.abbr)} ${result.score} – ${result.opp} ${esc(match.data.away.abbr)}</h2><p role="status">Saving your result…</p><button class="btn" type="button" hidden>Retry saving result</button></section>`;
        const save = async () => {
          const retry = field.querySelector('button'), message = field.querySelector('[role=status]'); retry.hidden = true;
          try { await commitResult(result); unmount(); render(); status.textContent = 'Final score saved. Your county season has advanced.'; }
          catch (err) { message.textContent = err.message; retry.hidden = false; }
        };
        field.querySelector('button').addEventListener('click', save); await save();
      }
    }
    window.addEventListener('message', receive);
    release = () => { window.removeEventListener('message', receive); frame.remove(); };
    frame.src = origin + '/play/football';
    field.querySelector('[data-fullscreen]').addEventListener('click', () => { const request = frame.requestFullscreen || frame.webkitRequestFullscreen; if (request) Promise.resolve(request.call(frame)).catch(() => {}); });
    field.querySelector('[data-return]').addEventListener('click', () => { unmount(); render(); status.textContent = 'Matchup saved. Resume to restart from kickoff.'; });
    field.scrollIntoView({ block: 'start' });
  }
  hub.addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
    const { action: name, ...data } = b.dataset;
    if (name === 'forfeit') {
      if (!window.confirm('Forfeit this matchup 0–21 and advance the county season?')) return;
      data.id = state.pending.id;
    }
    action(name, data);
  });
  hub.addEventListener('submit', e => { if (e.target.id !== 'career-new') return; e.preventDefault(); action('new', Object.fromEntries(new FormData(e.target))); });
  hub.addEventListener('change', e => { if (e.target.id === 'career-level') action('difficulty', { level: Number(e.target.value) }); });
  window.addEventListener('pagehide', () => { if (release) release(); });
  render();
  try {
    const saved = JSON.parse(sessionStorage.getItem(resultKey));
    if (saved && state?.pending?.id === saved.id) action('finish', saved);
    else if (saved) rememberResult(null);
  } catch {}
})();
