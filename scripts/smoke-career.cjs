// Uses a temporary data store and the real website, account API and football engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'mfl-career-'));
const port = process.env.CAREER_TEST_PORT || '3235', base = `http://127.0.0.1:${port}`;
let browser, server;
const errors = [];
async function startServer() {
  server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: port, DATA_DIR: data, ADMIN_PASSWORD: 'test-only-admin-password', BLOB_READ_WRITE_TOKEN: '', BLOB_STORE_ID: '', ANTHROPIC_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/career')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Career test server did not start');
}
async function stopServer() { const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited; }
(async () => {
  await startServer();
  browser = await chromium.launch({ ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 950 } }), page = await desktop.newPage();
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(base + '/career');
  await page.getByRole('link', { name: 'Log in to save your career' }).waitFor();
  assert.equal((await desktop.request.get(base + '/api/career')).status(), 401);
  assert.equal((await desktop.request.post(base + '/api/career/new', { data: { revision: 0, team: 'pedon', level: 0 } })).status(), 401);
  await desktop.request.post(base + '/pickem/signup', { form: { name: 'career_test', pin: 'test-only-password', next: '/career' } });
  await page.goto(base + '/career');
  await page.locator('[name=coach]').fill('Coach </script><script>throw 123</script>');
  const created = page.waitForResponse(r => r.url().endsWith('/api/career/new'));
  await page.getByRole('button', { name: 'Start MFL career', exact: true }).click();
  let state = (await (await created).json()).state;
  assert.equal(state.teams.length, 12); assert.equal(state.rounds.length, 11);
  assert.equal(state.teams.filter(t => t.site).length, 2);
  assert(state.teams.some(t => t.name === 'Kingsley Junior High'));
  await page.getByRole('heading', { name: 'Your roster', exact: true }).waitFor();
  const choice = page.waitForResponse(r => r.url().endsWith('/api/career/choice'));
  await page.getByRole('button', { name: /Team study hall/ }).click();
  state = (await (await choice).json()).state;
  assert.equal(state.budget, 46);
  const trained = page.waitForResponse(r => r.url().endsWith('/api/career/train'));
  await page.getByRole('button', { name: 'Speed', exact: true }).click();
  state = (await (await trained).json()).state; assert(state.trained);
  await page.reload(); await page.getByRole('heading', { name: 'Your roster', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.MFL_CAREER.state.trained), true);
  await page.screenshot({ path: path.join(data, 'career-desktop.png'), fullPage: true });
  const selected = state.teams.find(t => t.id === state.teamId), sourceLeague = JSON.parse(fs.readFileSync(path.join(data, 'db.json')));
  assert(selected.players.some(p => sourceLeague.teams[state.teamId].roster.some(real => real.name === p.name)));
  const started = page.waitForResponse(r => r.url().endsWith('/api/career/play'));
  await page.getByRole('button', { name: 'Play Week 1', exact: true }).click();
  const response = await (await started).json(), match = response.match; state = response.state;
  await page.locator('#career-field [role=status]').waitFor({ state: 'hidden' });
  let frame = page.frames().find(f => f.url().endsWith('/play/football')); assert(frame);
  const native = await frame.evaluate(() => { const m = Object.values(_si(64))[0]; return { roster: _wi(m._Ln), team: _Ai(_zi(m._Ej, 0), 'name'), condition: _Ai(_zi(m._Ln, 0), 'condition'), attitude: _Ai(_zi(m._Ln, 0), 'attitude'), difficulty: m._2t, width: _Y33, canvas: canvas.width }; });
  assert.equal(native.roster, 8); assert.equal(native.team, selected.name); assert.equal(native.condition, 94); assert.equal(native.attitude, 75); assert.equal(native.difficulty, 2); assert.equal(native.width, native.canvas);
  assert.equal((await desktop.request.post(base + '/api/career/train', { data: { revision: state.revision, focus: 'skills' } })).status(), 400);
  assert.equal((await desktop.request.post(base + '/api/career/finish', { data: { revision: state.revision, id: match.id, token: 'wrong', score: 21, opp: 7 } })).status(), 400);
  await page.getByRole('button', { name: 'Return to career', exact: true }).click();
  assert.equal(await page.locator('iframe').count(), 0);
  await stopServer(); await startServer();
  await page.reload(); await page.getByRole('button', { name: 'Resume matchup', exact: true }).waitFor();
  const resumed = page.waitForResponse(r => r.url().endsWith('/api/career/play'));
  await page.getByRole('button', { name: 'Resume matchup', exact: true }).click();
  const resumedBody = await (await resumed).json(); assert.deepEqual(resumedBody.match, match); state = resumedBody.state;
  await page.locator('#career-field [role=status]').waitFor({ state: 'hidden' });
  frame = page.frames().find(f => f.url().endsWith('/play/football'));
  // Real mouse kickoff followed by the engine's actual end-quarter transition.
  const canvas = page.frameLocator('iframe').locator('canvas'), box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .72, { delay: 120 });
  // Commit the score but drop its response: the UI must discover the completed
  // server save instead of leaving the player stuck on a duplicate retry.
  let resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  await page.route('**/api/career/finish', async route => {
    const response = await route.fetch(); const body = await response.json();
    await route.abort('failed'); resolveFinished(body);
  }, { times: 1 });
  await frame.evaluate(() => { const game = Object.values(_si(71))[0]; game._Sb1[game._0z] = 28; game._Sb1[1 - game._0z] = 7; game._Wy = 5; game._Vy = 13; _Ib1(game, game); });
  state = (await finished).state;
  assert.equal(state.week, 1); assert.equal(state.standings.find(t => t.id === state.teamId).w, 1); assert.equal(state.pending, null);
  await page.getByRole('button', { name: 'Play Week 2', exact: true }).waitFor(); assert.equal(await page.locator('iframe').count(), 0);
  assert.equal((await desktop.request.post(base + '/api/career/finish', { data: { revision: state.revision, id: match.id, token: match.token, score: 28, opp: 7 } })).status(), 400);
  const user = JSON.parse(fs.readFileSync(path.join(data, 'docs/users/career_test.json'))); assert.equal((user.arcade || []).length, 0);
  const concurrent = await Promise.all(['speed', 'skills'].map(focus => desktop.request.post(base + '/api/career/train', { data: { revision: state.revision, focus } })));
  assert.deepEqual(concurrent.map(r => r.status()).sort(), [200, 409]);
  state = (await (await desktop.request.get(base + '/api/career')).json()).state;
  // Complete the school year through the same authenticated season endpoints.
  while (state.phase !== 'complete') {
    const next = state.rounds[state.week].games.find(g => g.home === state.teamId || g.away === state.teamId);
    if (next) {
      const play = await (await desktop.request.post(base + '/api/career/play', { data: { revision: state.revision } })).json(); assert(play.ok, play.error);
      const end = await (await desktop.request.post(base + '/api/career/finish', { data: { revision: play.state.revision, id: play.match.id, token: play.match.token, score: 42, opp: 7 } })).json(); assert(end.ok, end.error); state = end.state;
    } else { const watch = await (await desktop.request.post(base + '/api/career/watch', { data: { revision: state.revision } })).json(); assert(watch.ok, watch.error); state = watch.state; }
  }
  assert.equal(state.champion, state.teamId); assert.equal(state.history.length, 1);
  await page.reload(); await page.getByRole('heading', { name: '🏆 County champions!', exact: true }).waitFor();
  const advanced = page.waitForResponse(r => r.url().endsWith('/api/career/next-season'));
  await page.getByRole('button', { name: 'Begin next school year', exact: true }).click();
  state = (await (await advanced).json()).state; assert.equal(state.season, 2);
  await page.getByRole('button', { name: 'Play Week 1', exact: true }).waitFor();
  // A final score also survives a refresh before the server accepts it.
  const secondStart = page.waitForResponse(r => r.url().endsWith('/api/career/play'));
  await page.getByRole('button', { name: 'Play Week 1', exact: true }).click();
  await secondStart;
  await page.locator('#career-field [role=status]').waitFor({ state: 'hidden' });
  frame = page.frames().find(f => f.url().endsWith('/play/football'));
  await page.route('**/api/career/finish', route => route.abort('failed'));
  await frame.evaluate(() => { const game = Object.values(_si(71))[0]; game._Sb1[game._0z] = 21; game._Sb1[1 - game._0z] = 7; game._Wy = 5; game._Vy = 13; _Ib1(game, game); });
  await page.getByRole('button', { name: 'Retry saving result', exact: true }).waitFor();
  await page.unroute('**/api/career/finish');
  await page.reload();
  await page.getByRole('button', { name: 'Play Week 2', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('mfl-career-result:career_test')), null);
  await desktop.request.post(base + '/admin/login', { form: { password: 'test-only-admin-password' } });
  const backup = await (await desktop.request.get(base + '/admin/backup.json')).json();
  assert.equal(backup.docs['careers/career_test'].season, 2);
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await desktop.storageState() }), phone = await mobile.newPage();
  phone.on('pageerror', err => errors.push(err.message)); await phone.goto(base + '/career');
  await phone.getByRole('heading', { name: 'Your roster', exact: true }).waitFor();
  const mobileSize = await phone.evaluate(() => ({ inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, page: document.querySelector('.career-page').getBoundingClientRect().width }));
  assert.equal(mobileSize.inner, 390, JSON.stringify(mobileSize));
  assert.equal(mobileSize.client, 390, JSON.stringify(mobileSize));
  assert(mobileSize.scroll <= 390 && mobileSize.page <= 390, JSON.stringify(mobileSize));
  await phone.screenshot({ path: path.join(data, 'career-mobile.png') });
  const bridged = await browser.newContext({ viewport: { width: 1100, height: 850 } }), bridgePage = await bridged.newPage();
  bridgePage.on('pageerror', err => errors.push(err.message));
  const parentBase = `http://localhost:${port}`;
  await bridged.request.post(parentBase + '/pickem/login', { form: { name: 'career_test', pin: 'test-only-password' } });
  await bridgePage.addInitScript(origin => { window.MFL_API_ORIGIN = origin; }, base);
  await bridgePage.goto(parentBase + '/career');
  await bridgePage.getByRole('button', { name: 'Play Week 2', exact: true }).click();
  await bridgePage.locator('#career-field [role=status]').waitFor({ state: 'hidden' });
  assert(bridgePage.frames().some(f => f.url() === base + '/play/football'));
  await bridgePage.getByRole('button', { name: 'Return to career', exact: true }).click();
  assert.equal(await bridgePage.locator('iframe').count(), 0);
  await desktop.request.post(base + '/pickem/signup', { form: { name: 'career_other', pin: 'test-only-password' } });
  const isolated = await (await desktop.request.get(base + '/api/career')).json(); assert.equal(isolated.state, null);
  assert.deepEqual(errors, []);
  console.log('PASS: logged-in career UI, real site players, school league, training/story persistence, actual native match input and finish, pending fixture across server restart, token/duplicate/stale-tab protection, lost save response and refresh recovery, coin isolation, season/playoffs/graduation, backups, account isolation, different frame origin and 390px layout');
  console.log('Screenshots: ' + data);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) server.kill('SIGTERM'); });
