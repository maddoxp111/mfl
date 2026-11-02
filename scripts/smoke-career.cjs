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
    if (server.exitCode !== null) throw new Error('Career test server exited before startup');
    try { if ((await fetch(base + '/career')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Career test server did not start');
}
async function stopServer() { const exited = once(server, 'exit'); server.kill('SIGTERM'); await exited; }
(async () => {
  await startServer();
  browser = await chromium.launch({ ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const dismissNotice = ctx => ctx.addInitScript(() => { try { localStorage.setItem('mfl-notice-metcalf-1', '1'); } catch {} }); // the site-wide notice dialog would sit over every click
  const desktop = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await dismissNotice(desktop);
  const page = await desktop.newPage();
  page.on('pageerror', err => errors.push(err.message));
  // /career is the hub: one tile per career.
  await page.goto(base + '/career');
  assert.equal(await page.locator('.ch-tile').count(), 2);
  assert.deepEqual(await page.locator('.ch-tile').evaluateAll(els => els.map(e => e.getAttribute('href'))), ['/career/bowl', '/career/blitz']);
  assert.equal(await page.locator('header a.nav-career[href="/career"]').count(), 1);
  await page.goto(base + '/career/bowl');
  await page.getByRole('link', { name: 'Log in to save your career' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Log in to save your career' }).getAttribute('href'), '/pickem/login?next=/career/bowl');
  assert.equal((await desktop.request.get(base + '/api/career')).status(), 401);
  await desktop.request.post(base + '/pickem/signup', { form: { name: 'career_test', pin: 'test-only-password' } });
  await page.goto(base + '/career/bowl');
  await page.getByRole('heading', { name: 'MFL SAVE SLOTS', exact: true }).waitFor();
  assert.equal(await page.locator('.save-slot').count(), 5);
  await page.getByRole('button', { name: 'NEW CAREER', exact: true }).first().click();
  await page.locator('[name=saveName]').fill('Metcalf legacy');
  await page.locator('[name=coach]').fill('Coach </script><script>throw 123');
  const created = page.waitForResponse(r => r.url().endsWith('/api/career/new'));
  await page.getByRole('button', { name: 'START CAREER', exact: true }).click();
  let store = await (await created).json(), firstId = store.state.saveId;
  const client = () => page.evaluate(() => window.MFL_CAREER.client);
  async function freshStore() { store = await (await desktop.request.get(base + '/api/career?client=' + await client())).json(); return store; }
  async function post(action, body = {}) {
    const response = await desktop.request.post(base + '/api/career/' + action, { data: { revision: store.revision, save: store.state?.saveId, client: await client(), ...body } });
    const json = await response.json(); if (json.saves) store = json;
    return { response, json };
  }
  async function clickAction(buttonName, action) {
    const [reply] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/career/' + action)),
      page.getByRole('button', { name: buttonName, exact: true }).click(),
    ]);
    store = await reply.json(); assert(store.ok, store.error); return store;
  }
  async function play() {
    await page.getByRole('button', { name: 'CONTINUE ▸', exact: true }).click();
    const reply = page.waitForResponse(r => r.url().endsWith('/api/career/play'));
    await page.getByRole('button', { name: /^PLAY / }).click();
    store = await (await reply).json(); assert(store.ok, store.error);
    await page.locator('#career-field [role=status]').waitFor({ state: 'hidden' });
    const runtime = page.frames().find(f => f.url().endsWith('/play/football')); assert(runtime);
    return { runtime, match: store.match, save: store.state.saveId };
  }
  await page.locator('.retro-home').waitFor(); await page.evaluate(() => document.fonts.ready);
  assert.equal(store.state.teams.length, 12); assert.equal(store.saves.length, 1);
  assert(await page.evaluate(() => document.fonts.check('12px MFLPixel')));
  assert.equal(await page.locator('.retro-nav button').count(), 5);
  await page.screenshot({ path: path.join(data, 'career-desktop.png'), fullPage: true });
  const source = JSON.parse(fs.readFileSync(path.join(data, 'db.json'))), selected = store.state.teams.find(t => t.id === store.state.teamId);
  assert(selected.players.some(p => source.teams[store.state.teamId].roster.some(real => real.name === p.name)));
  await page.getByRole('button', { name: 'FRONT OFFICE', exact: true }).click();
  await clickAction('SPEED', 'train');
  await clickAction(/Team study hall/, 'choice');
  assert.equal(store.state.budget, 46); assert(store.state.trained);
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await page.getByRole('button', { name: 'ROSTER', exact: true }).click();
  await page.getByRole('heading', { name: 'Your roster', exact: true }).waitFor();
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await page.getByRole('button', { name: 'HALL OF FAME', exact: true }).click();
  await page.getByRole('heading', { name: 'Hall of Fame', exact: true }).waitFor();
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Career settings', exact: true }).waitFor();
  await page.getByRole('button', { name: 'HOME', exact: true }).click();
  await page.getByRole('button', { name: 'SAVE SLOTS', exact: true }).click();
  await page.getByRole('button', { name: 'NEW CAREER', exact: true }).first().click();
  await page.locator('[name=saveName]').fill('KTCS second save');
  await page.locator('[name=team][value=xavier]').check();
  await page.locator('[name=level]').selectOption('3');
  await clickAction('START CAREER', 'new');
  const secondId = store.state.saveId;
  assert.equal(store.saves.length, 2); assert.equal(store.state.trained, false); assert.equal(store.state.level, 3); assert.equal(store.state.slot, 2);
  await page.getByRole('button', { name: 'SAVE SLOTS', exact: true }).click();
  const firstCard = page.locator('.save-slot').filter({ has: page.getByRole('heading', { name: 'Metcalf legacy', exact: true }) });
  const loaded = page.waitForResponse(r => r.url().endsWith('/api/career/select'));
  await firstCard.getByRole('button', { name: 'LOAD SAVE' }).click(); store = await (await loaded).json();
  assert.equal(store.state.saveId, firstId); assert(store.state.trained); assert.equal(store.state.budget, 46);
  await page.reload(); await page.locator('.retro-home').waitFor(); await freshStore();
  assert.equal(store.state.week, 0); assert.equal(store.saves.length, 2);
  // Finish an actual native match, dropping the save response to exercise recovery.
  let run = await play();
  assert(run.match.arcade, 'career game linked to a coin game');
  const userFile = path.join(data, 'docs/users/career_test.json');
  const backdated = JSON.parse(fs.readFileSync(userFile)); backdated.arcade.find(m => m.id === run.match.arcade).at = new Date(Date.now() - 600e3).toISOString(); fs.writeFileSync(userFile, JSON.stringify(backdated));
  const native = await run.runtime.evaluate(() => { const m = Object.values(_si(64))[0]; return { roster: _wi(m._Ln), condition: _Ai(_zi(m._Ln, 0), 'condition'), width: _Y33, canvas: canvas.width }; });
  assert.equal(native.roster, 8); assert.equal(native.condition, 94); assert.equal(native.width, native.canvas);
  const box = await page.frameLocator('iframe').locator('canvas').boundingBox();
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .72, { delay: 120 });
  let resolveFinish; const finished = new Promise(resolve => { resolveFinish = resolve; });
  await page.route('**/api/career/finish', async route => { const res = await route.fetch(); const json = await res.json(); await route.abort('failed'); resolveFinish(json); }, { times: 1 });
  await run.runtime.evaluate(() => { const game = Object.values(_si(71))[0]; game._Sb1[game._0z] = 28; game._Sb1[1 - game._0z] = 7; game._Wy = 5; game._Vy = 13; _Ib1(game, game); });
  store = await finished; await page.locator('.retro-home').waitFor();
  await page.locator('#career-status .career-coins').waitFor();
  assert.equal(await page.locator('#career-status .career-coins').innerText(), '+200 coins'); // Rookie: GAMES.bowl.prizes[0]
  assert.match(await page.locator('.career-save-strip').innerText(), /\+200 coins from career wins/);
  assert.equal(store.state.week, 1); assert.equal(store.saves.find(s => s.id === firstId).w, 1); assert.equal(store.saves.find(s => s.id === secondId).w, 0);
  // Leading before a refresh still becomes a loss, and a delayed win cannot replace it.
  run = await play(); const abandoned = { ...run.match, save: run.save, score: 99, opp: 0 };
  await run.runtime.evaluate(() => { const g = Object.values(_si(71))[0]; g._Sb1[g._0z] = 42; g._Sb1[1 - g._0z] = 0; });
  await page.reload(); await page.locator('.retro-home').waitFor(); await freshStore();
  assert.equal(store.state.week, 2); assert.equal(store.saves.find(s => s.id === firstId).l, 1); assert.equal(store.state.pending, null);
  assert.equal((await post('finish', abandoned)).response.status(), 400);
  assert.equal(store.saves.find(s => s.id === firstId).l, 1);
  // Normal navigation away triggers the same policy.
  await play(); await page.goto(base + '/schedule'); await page.goto(base + '/career/bowl');
  await page.locator('.retro-home').waitFor(); await freshStore(); assert.equal(store.saves.find(s => s.id === firstId).l, 2);
  // Explicit quit also loses exactly once and releases the native runtime.
  await play(); await clickAction('QUIT · LOSS', 'abandon');
  await page.locator('.retro-home').waitFor(); assert.equal(await page.locator('iframe').count(), 0);
  assert.equal(store.saves.find(s => s.id === firstId).l, 3);
  // Crash/closed-browser fallback: start via API, restart server without sending
  // a quit event, then visit a new document. It must forfeit, never resume.
  await freshStore(); const crash = (await post('play')).json.match;
  assert(crash); await stopServer(); await startServer();
  await page.goto(base + '/career/bowl'); await page.locator('.retro-home').waitFor(); await freshStore();
  assert.equal(store.saves.find(s => s.id === firstId).l, 4); assert.equal(store.state.pending, null);
  const beforeDelete = structuredClone(store.state);
  await page.getByRole('button', { name: 'SAVE SLOTS', exact: true }).click();
  const secondCard = page.locator('.save-slot').filter({ has: page.getByRole('heading', { name: 'KTCS second save', exact: true }) });
  page.once('dialog', dialog => dialog.dismiss()); await secondCard.getByRole('button', { name: 'DELETE' }).click();
  assert.equal(await page.locator('.save-slot.selected').count(), 1); await freshStore(); assert.equal(store.saves.length, 2);
  page.once('dialog', dialog => dialog.accept());
  const deleted = page.waitForResponse(r => r.url().endsWith('/api/career/delete'));
  await secondCard.getByRole('button', { name: 'DELETE' }).click(); store = await (await deleted).json();
  assert.equal(store.saves.length, 1); assert.equal(store.state.saveId, firstId); assert.equal(store.state.week, beforeDelete.week);
  for (let i = 2; i <= 5; i++) assert((await post('new', { slot: i, team: 'xavier', level: 1, saveName: 'Extra ' + i })).json.ok);
  assert.equal((await post('new', { team: 'pedon', level: 0 })).response.status(), 400);
  assert.equal(store.saves.length, 5);
  const same = { revision: store.revision, save: store.state.saveId, client: await client(), focus: 'speed' };
  const concurrent = await Promise.all(['speed', 'skills'].map(focus => desktop.request.post(base + '/api/career/train', { data: { ...same, focus } })));
  assert.deepEqual(concurrent.map(r => r.status()).sort(), [200, 409]); await freshStore();
  // Save ID is part of the game identity: a stale quit for a deleted slot cannot
  // forfeit a different slot's same Week-1 fixture.
  const newMatch = (await post('play')).json.match;
  await post('abandon', { save: secondId, id: newMatch.id, token: newMatch.token });
  assert.equal(store.state.pending.id, newMatch.id);
  await post('abandon', { id: newMatch.id, token: newMatch.token });
  await post('select', { save: firstId });
  await page.reload(); await page.locator('.retro-home').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(data, 'career-desktop.png'), fullPage: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await desktop.storageState() });
  await dismissNotice(mobile);
  const phone = await mobile.newPage();
  phone.on('pageerror', err => errors.push(err.message)); await phone.goto(base + '/career/bowl');
  await phone.locator('.retro-home').waitFor(); await phone.evaluate(() => document.fonts.ready);
  assert(await phone.evaluate(() => innerWidth === 390 && document.documentElement.scrollWidth <= 390));
  await phone.screenshot({ path: path.join(data, 'career-mobile.png') });
  await phone.getByRole('button', { name: 'ROSTER', exact: true }).tap(); await phone.getByRole('heading', { name: 'Your roster', exact: true }).waitFor();
  await phone.getByRole('button', { name: 'HOME', exact: true }).tap();
  await desktop.request.post(base + '/admin/login', { form: { password: 'test-only-admin-password' } });
  const backup = await (await desktop.request.get(base + '/admin/backup.json')).json();
  assert.equal(backup.docs['careers/career_test'].saves.length, 5);
  // Every career game played on the page was a career coin game: one paid win (Rookie prize), the rest closed as losses.
  const coinGames = JSON.parse(fs.readFileSync(userFile)).arcade || [];
  assert.equal(coinGames.length, 4); assert(coinGames.every(m => m.career && m.game === 'bowl' && !m.risk && m.status !== 'open'));
  assert.deepEqual(coinGames.filter(m => m.status === 'won').map(m => m.payout), [200]);
  // Legacy single-career migration preserves roster, facilities and history,
  // while an old pending game is settled as a loss under the new rule.
  const other = await browser.newContext();
  await dismissNotice(other);
  const otherPage = await other.newPage();
  await other.request.post(base + '/pickem/signup', { form: { name: 'career_other', pin: 'test-only-password' } });
  assert.equal((await (await other.request.get(base + '/api/career')).json()).saves.length, 0);
  const legacy = structuredClone(beforeDelete); legacy.version = 1; legacy.owner = 'career_other'; delete legacy.saveId; delete legacy.saveName; delete legacy.slot;
  const C = require('../career-engine'); C.play(legacy);
  fs.writeFileSync(path.join(data, 'docs/careers/career_other.json'), JSON.stringify(legacy));
  await otherPage.goto(base + '/career/bowl'); await otherPage.locator('.retro-home').waitFor();
  const migrated = await (await other.request.get(base + '/api/career')).json();
  assert.equal(migrated.saves.length, 1); assert.equal(migrated.state.slot, 1); assert.equal(migrated.state.week, beforeDelete.week + 1);
  assert.equal(migrated.state.teams[0].players[0].name, beforeDelete.teams[0].players[0].name);
  assert.deepEqual(migrated.state.facilities, beforeDelete.facilities);
  const erased = await (await other.request.post(base + '/api/career/delete', { data: { revision: migrated.revision, save: migrated.state.saveId, client: await otherPage.evaluate(() => window.MFL_CAREER.client) } })).json();
  assert(erased.ok); assert.equal(erased.state, null); assert.equal(erased.saves.length, 0);
  await otherPage.reload(); await otherPage.getByRole('heading', { name: 'MFL SAVE SLOTS', exact: true }).waitFor();
  assert.equal(await otherPage.getByRole('button', { name: 'NEW CAREER', exact: true }).count(), 5);
  assert.equal((await (await desktop.request.get(base + '/api/career')).json()).saves.length, 5);
  assert.deepEqual(errors, []);
  console.log('PASS: career hub, five independent fixed save slots, create/load/delete/cancel/capacity, legacy migration, desktop pixel home and working menus, native match finish, coins for a career win, lost save response recovery, leading refresh loss, navigation/quit/crash losses, rejected late win, slot token isolation, concurrent revisions, account isolation, backups and mobile navigation');
  console.log('Screenshots: ' + data);
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) server.kill('SIGTERM'); });
