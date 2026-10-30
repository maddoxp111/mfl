// Run with Playwright available on NODE_PATH; uses system Chromium when present.
// This starts a private server and writes fixtures only to a temporary DATA_DIR.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'mfl-bowl-'));
const port = process.env.BOWL_TEST_PORT || '3234';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: port, DATA_DIR: data, ADMIN_PASSWORD: 'test-only-admin-password', BLOB_READ_WRITE_TOKEN: '', BLOB_STORE_ID: '', ANTHROPIC_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const errors = [];
async function start(page, options = {}) {
  page.on('pageerror', error => (errors.push(error.message), console.error('BROWSER', error.message)));
  await page.goto((options.parentBase || base) + '/arcade/bowl');
  if (options.coins) await page.locator('label.mode').first().click();
  if (options.risk) await page.locator('label.risk').click();
  if (options.level) await page.locator('label.lvl').nth(options.level).click();
  const reply = page.waitForResponse(r => r.url().endsWith('/api/m/start'));
  await page.locator('.arc-go').click();
  const match = await (await reply).json(); assert.equal(match.ok, true, match.error);
  const frame = page.frameLocator('iframe');
  await page.locator('.bowl-runtime [role=status]').waitFor({ state: 'hidden' });
  const runtime = page.frames().find(f => f.url().endsWith('/play/football'));
  assert(runtime);
  const state = await runtime.evaluate(() => {
    const m = Object.values(_si(64))[0];
    return { roster: _wi(m._Ln), name: _Ai(_zi(m._Ej, 0), 'name'), difficulty: m._2t, quarter: Object.values(_si(71))[0]._Wy };
  });
  assert.equal(state.roster, 8); assert.equal(state.name, match.data.home.name);
  assert.equal(state.difficulty, (options.level || 0) + 1); assert.equal(state.quarter, 1);
  // Exercise actual pointer input, rather than calling the kickoff script.
  const canvas = frame.locator('canvas'); const box = await canvas.boundingBox();
  if (options.mobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .5, y: box.y + box.height * .72 }] });
    await page.waitForTimeout(120);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
  else await page.mouse.click(box.x + box.width * .5, box.y + box.height * .72, { delay: 120 });
  await runtime.waitForFunction(() => { const m = Object.values(_si(71))[0]; return m._7z || m._Vy !== 0 || m._kp !== 1; }, null, { timeout: 6000 });
  return { runtime, match };
}
async function end(runtime, score, opp) {
  // Enter the real engine's final-quarter transition with fixture scores. No
  // accelerated run is presented as a full manually played football game.
  await runtime.evaluate(({ score, opp }) => {
    const m = Object.values(_si(64))[0], game = Object.values(_si(71))[0];
    game._Sb1[game._0z] = score; game._Sb1[1 - game._0z] = opp;
    const receiver = Array.from({ length: _wi(m._Ln) }, (_, i) => _zi(m._Ln, i)).find(p => _Ai(p, 'position') === 4);
    _Yi(receiver, 'stat_touchdowns', 3);
    game._Wy = score === opp ? 6 : 5; game._Vy = 13; _Ib1(game, game);
  }, { score, opp });
}
(async () => {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i === 99) throw new Error('Test server did not start');
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ ...(fs.existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}), args: ['--no-sandbox'] });
  const desktop = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const page = await desktop.newPage();
  // Save appearance and color changes through the real admin forms.
  await desktop.request.post(base + '/admin/login', { form: { password: 'test-only-admin-password' } });
  await page.goto(base + '/admin/looks');
  const lookForm = page.locator('form.look').first();
  const beforePreview = await lookForm.locator('canvas').evaluate(c => c.toDataURL());
  await lookForm.locator('[name=skin]').selectOption('4');
  await lookForm.locator('[name=height]').selectOption('tall');
  await lookForm.locator('[name=cleats]').selectOption('red');
  await lookForm.locator('[name=visor]').check(); await lookForm.locator('[name=sleeves]').check();
  assert.notEqual(await lookForm.locator('canvas').evaluate(c => c.toDataURL()), beforePreview);
  await lookForm.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/saved=1/);
  const league = JSON.parse(fs.readFileSync(path.join(data, 'db.json')));
  const team = Object.values(league.teams)[0];
  assert.deepEqual(team.roster[0].look, { skin: 4, height: 'tall', cleats: 'red', visor: true, sleeves: true });
  for (const player of team.roster.slice(1)) {
    await desktop.request.post(base + `/admin/looks/${team.id}/${player.id}`, { form: { skin: '4', height: 'tall', cleats: 'red', visor: '1', sleeves: '1' } });
  }
  await page.goto(base + '/admin/teams');
  const teamForm = page.locator(`form[action="/admin/teams/${team.id}"]`);
  await teamForm.locator('[name=color]').evaluate(el => { el.value = '#ed1234'; });
  await teamForm.locator('[name=color2]').evaluate(el => { el.value = '#127bed'; });
  await teamForm.locator('button').click(); await page.waitForURL(/saved=1/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'db.json'))).teams[team.id].color, '#ed1234');
  console.log('PASS: admin appearance preview, appearance save, team-color save');
  let run = await start(page);
  // Exercise the real native player formation and shader, not just match data.
  const rendered = await run.runtime.evaluate(() => {
    const game = Object.values(_si(71))[0];
    game._6F = 25; game._t11 = 0; game._kp = 0; _eb1(game, game, false);
    const player = Object.values(_si(73)).find(p => p._lT && p._7j >= 0);
    if (!player) throw new Error('No roster player in the native formation');
    const values = {}, uniform = window._UQ;
    window._UQ = (handle, ...v) => { values[handle] = v; return uniform(handle, ...v); };
    const sprite = _Te2._Ue2(26), draw = sprite._Ch2;
    let scale;
    sprite._Ch2 = function (...args) { scale = args[4]; return draw.apply(this, args); };
    try {
      _SQ(player, player); const pose = player.__T; player.__T = 26;
      _mh1(player,26,0,player.x,player.y,2,2,0,16777215,1); player.__T = pose;
      return { shirt: values[player._HQ], skin: values[player._OQ], cleats: values[player._PQ],
        flags: values[_uQ(0,'mflOptions')], scale };
    } finally { sprite._Ch2 = draw; window._UQ = uniform; _HE1(); }
  });
  function near(actual, expected) { assert.equal(actual.length, expected.length); actual.forEach((n,i) => assert(Math.abs(n - expected[i]) < .0001, `${actual} != ${expected}`)); }
  near(rendered.shirt, [237/255,18/255,52/255]); near(rendered.skin,[90/255,58/255,34/255]);
  near(rendered.cleats,[214/255,40/255,40/255]); near(rendered.flags,[1,1]); assert.equal(rendered.scale, 2.3);
  console.log('PASS: saved team RGB, exact skin, red cleats, visor/sleeves, tall scale in native renderer');
  // Clear the native tutorial dialogs so their dimmer cannot tint the pixels.
  await run.runtime.evaluate(() => { const game = Object.values(_si(71))[0]; _Lr(game,game); });
  await page.waitForTimeout(200);
  const fieldImage = await page.frameLocator('iframe').locator('canvas').screenshot({ path: path.join(data, 'field.png') });
  const colorPixels = await run.runtime.evaluate(encoded => new Promise(resolve => {
    const image = new Image(); image.onload = () => {
      const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height;
      const ctx = copy.getContext('2d'); ctx.drawImage(image,0,0);
      const pixels = ctx.getImageData(0,0,copy.width,copy.height).data;
      let primary = 0, secondary = 0;
      for (let i=0;i<pixels.length;i+=4) {
        if (pixels[i]===237 && pixels[i+1]===18 && pixels[i+2]===52) primary++;
        if (pixels[i]===18 && pixels[i+1]===123 && pixels[i+2]===237) secondary++;
      }
      resolve({primary,secondary});
    }; image.src = 'data:image/png;base64,' + encoded;
  }), fieldImage.toString('base64'));
  assert(colorPixels.primary > 10 && colorPixels.secondary > 10, JSON.stringify(colorPixels));
  console.log('PASS: saved primary and secondary colors appear in actual game pixels');


  await page.screenshot({ path: path.join(data, 'desktop.png') });
  await end(run.runtime, 21, 7);
  await page.getByRole('heading', { name: 'You win!', exact: true }).waitFor();
  assert.equal(await page.locator('iframe').count(), 0);
  console.log('PASS: desktop kickoff, imported roster, engine win, practice result, runtime cleanup');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage(); run = await start(phone, { level: 3, mobile: true });
  assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await phone.screenshot({ path: path.join(data, 'mobile.png') });
  await end(run.runtime, 7, 14);
  await phone.getByRole('heading', { name: 'Game over', exact: true }).waitFor();
  console.log('PASS: 390px mobile layout, Legend difficulty, loss result');

  // Create a real local account and Starting 8 for the coin settlement check.
  const signup = await desktop.request.post(base + '/pickem/signup', { form: { name: 'bowl_test', pin: 'test-only-password' } });
  assert(signup.ok());
  const userFile = path.join(data, 'docs/users/bowl_test.json');
  const user = JSON.parse(fs.readFileSync(userFile));
  const db = JSON.parse(fs.readFileSync(path.join(data, 'db.json')));
  const catalog = require('../cards').catalog(db);
  const cards = [...new Map(catalog.map(c => [c.p.id, c.id])).values()].slice(0, 8);
  assert.equal(cards.length, 8);
  user.packs = [{ cards }]; user.lineups = [{ cards }];
  fs.writeFileSync(userFile, JSON.stringify(user));
  run = await start(page, { coins: true, risk: true, level: 2 });
  assert(run.match.id);
  const active = JSON.parse(fs.readFileSync(userFile));
  active.arcade.find(m => m.id === run.match.id).at = new Date(Date.now() - 60000).toISOString();
  fs.writeFileSync(userFile, JSON.stringify(active));
  const settlement = page.waitForResponse(r => r.url().endsWith('/api/m/finish'));
  await end(run.runtime, 21, 7);
  const result = await (await settlement).json();
  assert.equal(result.ok, true); assert.equal(result.won, true); assert(result.net > 0);
  const saved = JSON.parse(fs.readFileSync(userFile)).arcade.find(m => m.id === run.match.id);
  assert.equal(saved.status, 'won'); assert.equal(saved.stats.td, 3);
  const duplicate = await desktop.request.post(base + '/api/m/finish', { data: { id: run.match.id, result: { won: true, score: 21 } } });
  assert.equal((await duplicate.json()).ok, false);
  console.log('PASS: Starting 8, Risk mode, server coin settlement, TD challenge stats, duplicate rejection');
  const bridgeContext = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const bridged = await bridgeContext.newPage();
  await bridged.addInitScript(origin => { window.MFL_API_ORIGIN = origin; }, base);
  run = await start(bridged, { parentBase: `http://localhost:${port}`, level: 1 });
  await end(run.runtime, 14, 14);
  await bridged.getByRole('heading', { name: "It's a tie", exact: true }).waitFor();
  console.log('PASS: different parent/runtime origins (Pages bridge), tie result');
  assert.deepEqual(errors, []);
  console.log('PASS: no JavaScript runtime errors; screenshots in ' + data);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.kill('SIGTERM'); });
