# Modern Bowl runtime

`runtime.js`, the textures, data files, sounds and `uph_poki.js` are from the user's supplied `football-game.zip` HTML5 build. The runtime is retained byte for byte. The archive's `img/README.md` describes it as an existing runtime for study and noncommercial experimentation, and does not grant a license. No new license is asserted here.

`/play/football` serves `frame.html` with the runtime and `bridge.js` inline. Only the requested game loads this runtime; the main site does not carry its assets. The frame isolates the GameMaker globals, input handlers and audio. `quality.js` overrides the HTML5 helper's 480×270 application-surface cap so the native routes and field render at the canvas resolution on startup and resize; camera coordinates and sprite filtering stay intact. `var cpd` accommodates a stray final expression in the supplied build.

The adapter imports the selected MFL teams and Starting 8, starts a single match instead of the franchise introduction, maps the four Arcade levels to progressively stronger native defense profiles, and reports final scores and touchdown stats to the existing Arcade harness. It preserves the supplied renderer, formations, physics, passing, running, kicking, opponent simulation, sounds and two-minute quarters. The native formation determines which roster positions are on the field. `appearance.js` and `renderer.js` connect all five skin tones, height, visor, sleeves and cleats to the native sprite shader and draw scale. The admin preview uses the same palette and a standing frame from the supplied atlas. Uniform arrays use GameMaker BGR storage, while shader replacement colors use RGB.

The adapter and renderer hooks depend on this build's compiled symbols. The `HEADS` bounds in `appearance.js` were generated from the helmet pixels in each player-animation texture-page entry; regenerate them if replacing the atlas. Its original script names are listed in `_Y._OU1` with matching functions in `_Y._PU1`. Update and retest the adapter whenever replacing the build.

Browser smoke test (Playwright installed separately, system Chromium supported):

```
NODE_PATH=/path/to/playwright/node_modules node scripts/smoke-bowl.cjs
```

The test uses an isolated temporary data directory, saves real admin appearance and team-color forms, checks their native shader/draw values, exercises kickoff input on desktop and a 390px viewport, and enters the engine's end-of-quarter transition to test win/loss and server coin settlement. It does not claim to play an entire match. Existing server limits and checks remain in force.

`difficulty.js` uses native Medium for Rookie, Hard for Pro, and Extreme for All-Pro/Legend. After native role initialization it sets effective defensive acceleration and strength by role, and bounds moving coverage commitment per level. These are explicit values so native Extreme attributes cannot override a lower tuning. Legend targets 80% of the previous All-Pro acceleration, strength and measured pass-closing movement; Rookie, Pro and All-Pro scale beneath it. Opponent defense ratings also have level-specific floors. Website/card ratings on the playable roster are preserved. The browser test runs the same pass scenario through the native coverage and movement functions at all four levels, checking increasing closing speed, strength and pass rush, the Legend ceiling, and refresh repeatability.
