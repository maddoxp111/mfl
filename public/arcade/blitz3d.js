// Blitz 3D (engine v3): an original arcade football game in raw WebGL, no libraries.
// Skinned characters with a keyframed animation system and light ragdolls, shadow-mapped lighting and a post pass.
// Exposes window.MFLBlitz.play(root, opts) -> Promise<result> (used by Franchise mode) and registers the
// Arcade game 'blitz3d' (your Arcade team vs the level's CPU team). You play offense; CPU drives are simulated.
(function () {
  'use strict';
  const P = 'bz';
  const CSS = `
.bz-wrap{position:relative;width:100%;max-width:1000px;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box;overflow:hidden;background:#07080b;border-radius:12px;touch-action:none}
.bz-wrap *{-webkit-touch-callout:none;box-sizing:border-box}
.bz-wrap.bz-edge{border-radius:0;max-width:none}
.bz-wrap:fullscreen{width:100vw;height:100vh;max-width:none;border-radius:0}
.bz-wrap:-webkit-full-screen{width:100vw;height:100vh;max-width:none;border-radius:0}
.bz-stage{position:absolute;inset:0;overflow:hidden;touch-action:none}
.bz-wrap.bz-fixed{position:fixed;left:0;top:0;right:0;bottom:0;width:100%!important;max-width:none;margin:0!important;border-radius:0;z-index:100000}
html.bz-lock,html.bz-lock body{overflow:hidden!important;overscroll-behavior:none}
.bz-cv{display:block;width:100%;height:100%;touch-action:none;outline:none}
.bz-tags,.bz-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bz-fx{z-index:4}
.bz-bug{position:absolute;left:0;right:0;top:0;z-index:6;display:flex;flex-wrap:wrap;align-items:stretch;gap:4px 6px;padding:6px calc(8px + env(safe-area-inset-right,0px)) 14px calc(8px + env(safe-area-inset-left,0px));background:linear-gradient(rgba(7,8,11,.92),rgba(7,8,11,.7) 72%,transparent);pointer-events:none}
.bz-bug>*{pointer-events:auto}
.bz-sb{display:flex;align-items:stretch;border-radius:8px;overflow:hidden;background:#0f1117;border:1px solid #262b38;flex:0 1 auto;min-width:0;box-shadow:0 3px 10px rgba(0,0,0,.4)}
.bz-tm{display:flex;align-items:center;gap:6px;padding:3px 8px 3px 6px;border-left:5px solid var(--c,#ffc21a);min-width:0;position:relative}
.bz-tm b{font:900 15px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px;text-transform:uppercase}
.bz-tm em{font:400 13px/1 'Press Start 2P',monospace;font-style:normal;color:#ffc21a;min-width:22px;text-align:right}
.bz-tm i{position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:#ffc21a;opacity:0}
.bz-tm.pos i{opacity:1}
.bz-tm s{display:flex;gap:2px;text-decoration:none;position:absolute;left:8px;bottom:2px}
.bz-tm s u{display:block;width:9px;height:2px;background:#ffc21a;text-decoration:none}.bz-tm s u.off{background:#2a2f3c}
.bz-clk{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 8px;background:#161922;min-width:64px}
.bz-clk b{font:400 11px/1.2 'Press Start 2P',monospace;color:#f5f6f8}.bz-clk.run b{color:#ffc21a}
.bz-clk span{font:700 9px/1.2 Inter,sans-serif;color:#9aa0ad;letter-spacing:.5px}
.bz-pc{display:flex;align-items:center;justify-content:center;padding:0 7px;font:400 9px 'Press Start 2P',monospace;color:#9aa0ad;background:#0b0d12;min-width:30px}
.bz-pc.low{color:#ff3344}
.bz-dd{display:flex;flex-direction:column;justify-content:center;padding:3px 9px;font:800 14px/1.05 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#ffc21a;background:#0f1117;border:1px solid #262b38;border-radius:8px;white-space:nowrap}
.bz-dd span{color:#9aa0ad;font-size:11px}
.bz-sp{flex:1 1 0;min-width:0}
.bz-ib{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:34px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;cursor:pointer;padding:0 8px;font:400 8px 'Press Start 2P',monospace}
.bz-ib svg{width:16px;height:16px}
.bz-ib.sure{background:#ff3344;border-color:#ff3344}
.bz-tick{position:absolute;left:50%;top:0;z-index:5;transform:translate(-50%,0);max-width:92%;padding:7px 12px;border-radius:999px;background:rgba(15,17,23,.86);border:1px solid #262b38;font:700 12px/1.3 Inter,sans-serif;color:#e6e8ee;text-align:center;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bz-tick.on{opacity:1}
.bz-tick b{color:#ffc21a}
.bz-ctl{position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;align-items:flex-end;gap:6px;padding:18px calc(8px + env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) calc(8px + env(safe-area-inset-left,0px));background:linear-gradient(transparent,rgba(7,8,11,.5));pointer-events:none}
.bz-ctl>*{pointer-events:auto}
.bz-btn{flex:1 1 0;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:800 17px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#f5f6f8;background:rgba(22,25,34,.9);border:2px solid rgba(255,255,255,.18);border-radius:12px;padding:6px 6px;cursor:pointer;position:relative;overflow:hidden;touch-action:manipulation}
.bz-btn small{font:600 10px/1.1 Inter,sans-serif;text-transform:none;letter-spacing:0;color:#aeb3bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.bz-btn kbd{font:7px 'Press Start 2P',monospace;color:#6f7584}
.bz-btn.sel{border-color:#ffc21a;color:#ffc21a;background:rgba(42,36,16,.94)}
.bz-btn:active{transform:translateY(2px)}
.bz-btn:disabled{opacity:.35;cursor:default}
.bz-btn.off{opacity:.35}
.bz-y{background:#ffc21a;border-color:#ffc21a;color:#07080b;box-shadow:0 4px 0 #a37a00}.bz-y kbd,.bz-y small{color:#5a4300}
.bz-r{background:#ff3344;border-color:#ff3344;color:#fff;box-shadow:0 4px 0 #9a1422}.bz-r small,.bz-r kbd{color:#ffd0d4}
.bz-g{background:#1f9d55;border-color:#2bd46b;color:#fff;box-shadow:0 4px 0 #136b39}.bz-g small{color:#d2f7e1}
.bz-wide{flex:2 1 0}
.bz-to{flex:0 0 62px}
.bz-msg{flex:1 1 auto;align-self:flex-end;pointer-events:none;display:flex;align-items:center;justify-content:center;text-align:center;font:700 12.5px/1.3 Inter,sans-serif;color:#d6d9e0;background:rgba(15,17,23,.82);border-radius:999px;padding:9px 12px;min-height:38px}
.bz-msg b{color:#ffc21a}
.bz-sta{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 8px;background:#0b0d12;min-width:58px}
.bz-sta span{font:700 8px/1 Inter,sans-serif;color:#9aa0ad;letter-spacing:.6px;text-transform:uppercase}
.bz-sta u{display:block;height:6px;border-radius:3px;background:#262b38;overflow:hidden;text-decoration:none}
.bz-sta u i{display:block;height:100%;width:var(--s,100%);background:linear-gradient(90deg,#2bd46b,#ffc21a);transition:width .08s linear}
.bz-sta.low u i{background:#ff3344}
.bz-mv{display:grid;grid-template-columns:repeat(3,62px);gap:8px;margin-left:auto;flex:0 0 auto}
.bz-mv .bz-btn{min-height:56px;border-radius:50%;width:62px;height:62px;font-size:14px;padding:0}
.bz-sprint{flex:0 0 72px;width:72px;height:72px;min-height:72px;border-radius:50%;font-size:14px;background:rgba(43,212,107,.22);border-color:#2bd46b;color:#fff;align-self:flex-end;touch-action:none}
.bz-sprint.on{background:#2bd46b;color:#07080b}
.bz-sprint i{position:absolute;left:0;bottom:0;height:5px;background:#2bd46b;width:var(--s,100%)}
.bz-aimln{position:absolute;height:4px;background:linear-gradient(90deg,rgba(255,194,26,.95),rgba(255,194,26,.25));transform-origin:0 50%;pointer-events:none;z-index:3;border-radius:2px;box-shadow:0 0 8px rgba(255,194,26,.6)}
.bz-aimrun{position:absolute;padding:5px 10px;border-radius:999px;background:rgba(255,51,68,.9);color:#fff;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;pointer-events:none;z-index:3;transform:translate(-50%,-50%);white-space:nowrap}
.bz-q{font:400 7px 'Press Start 2P',monospace}

.bz-mv .bz-btn i{position:absolute;left:0;bottom:0;height:4px;background:#fff;width:var(--cd,100%)}
.bz-mv .bz-btn.cool{opacity:.45}
.bz-mv .bz-btn:first-child{grid-column:2}.bz-land .bz-mv .bz-btn:first-child{grid-column:auto}
.bz-catch{display:flex;gap:10px;margin-left:auto;flex:0 0 auto}
.bz-catch .bz-btn{width:84px;height:84px;border-radius:50%;flex:0 0 84px;font-size:19px}
.bz-arc{display:flex;flex:0 0 auto;border-radius:12px;overflow:hidden;border:2px solid rgba(255,255,255,.18)}
.bz-arc button{min-height:48px;padding:0 9px;background:rgba(22,25,34,.9);color:#c9ccd4;border:0;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.bz-arc button.sel{background:#ffc21a;color:#07080b}
.bz-arc kbd{font:7px 'Press Start 2P',monospace;color:#6f7584;margin-left:4px}.bz-arc button.sel kbd{color:#5a4300}
.bz-tag{position:absolute;left:0;top:0;pointer-events:auto;display:flex;align-items:center;gap:4px;padding:3px 8px 3px 3px;border-radius:999px;border:2px solid #f5f6f8;background:rgba(15,17,23,.82);color:#f5f6f8;font:800 12px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;cursor:pointer}
.bz-tag i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 2px;border-radius:9px;background:#f5f6f8;color:#07080b;font:400 7px 'Press Start 2P',monospace}
.bz-tag em{font-style:normal;color:#ffc21a;font-size:11px}
.bz-tag.hide{display:none}
.bz-tags.live .bz-tag{pointer-events:none}
.bz-tag.car{border-color:#ffc21a;cursor:default}
.bz-tag.tgt{border-color:#2bd46b}
.bz-tag.open{border-color:#2bd46b}.bz-tag.open i{background:#2bd46b}
.bz-tag.mid{border-color:#ffc21a}.bz-tag.mid i{background:#ffc21a}
.bz-tag.cov{border-color:#ff3344}.bz-tag.cov i{background:#ff3344;color:#fff}
.bz-tag.small{padding:2px;gap:0}.bz-tag.small span,.bz-tag.small .bz-nof{display:none}
.bz-face{display:inline-block;flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:#1d212c 50% 30%/220% auto no-repeat;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
.bz-nof{display:inline-flex;align-items:center;justify-content:center;font:400 9px 'Press Start 2P',monospace;color:#07080b;background:#ffc21a}
.bz-pop{position:absolute;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:11px;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:bz-rise 1.1s ease-out both}
.bz-banner{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:bz-zoom .6s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000;max-width:96%}
.bz-banner b{display:block;font-size:20px;line-height:1.3}
.bz-banner i{display:block;font-style:normal;font-size:9px;margin-top:8px;color:#f5f6f8;white-space:normal;line-height:1.5}
.bz-stick{position:absolute;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(255,255,255,.08);pointer-events:none;z-index:3}
.bz-stick b{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,194,26,.85)}
.bz-sheet{position:absolute;left:0;right:0;bottom:0;z-index:7;max-height:84%;display:flex;flex-direction:column;background:rgba(10,12,17,.96);border-top:2px solid #ffc21a;border-radius:16px 16px 0 0;padding:10px calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));box-shadow:0 -10px 30px rgba(0,0,0,.6);animation:bz-up .25s ease-out both}
.bz-sh-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.bz-sh-top h4{margin:0;flex:1 1 auto;font:900 18px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.6px;color:#ffc21a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bz-sh-top h4 span{color:#9aa0ad;font-size:13px;margin-left:6px}
.bz-tabs{display:flex;gap:4px;margin-bottom:8px;overflow-x:auto}
.bz-tabs button{flex:1 0 auto;min-height:38px;padding:0 10px;border-radius:9px;border:1px solid #2a2f3c;background:#161922;color:#c9ccd4;font:800 14px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.bz-tabs button.sel{background:#ffc21a;color:#07080b;border-color:#ffc21a}
.bz-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow-y:auto;touch-action:pan-y;padding-bottom:2px}
.bz-card{display:flex;flex-direction:column;gap:3px;padding:6px;border-radius:10px;border:2px solid #262b38;background:#121520;cursor:pointer;text-align:left;color:#f5f6f8;touch-action:manipulation}
.bz-card.sel{border-color:#ffc21a;background:#211d10}
.bz-card canvas{width:100%;height:auto;aspect-ratio:16/10;border-radius:6px;background:#1c5a2b;display:block}
.bz-card b{font:900 15px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.3px}
.bz-card span{font:600 10.5px/1.25 Inter,sans-serif;color:#9aa0ad}
.bz-card em{font-style:normal;font:800 10px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#ffc21a;letter-spacing:.5px}
.bz-card i{font:600 10.5px/1.25 Inter,sans-serif;font-style:normal;color:#ffe08a}.bz-card i::before{content:'★ ';color:#ffc21a}
.bz-narrow .bz-tabs button{padding:0 7px;font-size:13px}
.bz-meter{position:absolute;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:6;transform:translateX(-50%);width:min(440px,88%);padding:10px 12px;border-radius:12px;background:rgba(10,12,17,.9);border:1px solid #2a2f3c;pointer-events:none}
.bz-meter h5{margin:0 0 6px;font:900 15px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a;display:flex;justify-content:space-between}
.bz-meter h5 span{color:#c9ccd4}
.bz-mbar{position:relative;height:22px;border-radius:6px;background:linear-gradient(90deg,#3a1218,#5a4300 55%,#1f6b3d 82%,#2bd46b 92%,#ff3344);overflow:hidden;border:1px solid #000}
.bz-mbar i{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.bz-mbar u{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.18);text-decoration:none}
.bz-macc{position:relative;height:16px;margin-top:6px;border-radius:6px;background:linear-gradient(90deg,#ff3344,#5a4300 30%,#2bd46b 46%,#2bd46b 54%,#5a4300 70%,#ff3344);border:1px solid #000;opacity:.35}
.bz-macc.on{opacity:1}
.bz-macc i{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.bz-meter p{margin:6px 0 0;font:600 11px Inter,sans-serif;color:#9aa0ad;text-align:center}
.bz-dcard{position:absolute;left:50%;top:50%;z-index:5;transform:translate(-50%,-50%);min-width:240px;width:max-content;max-width:90%;padding:14px 18px;background:rgba(15,17,23,.95);border:2px solid var(--oc,#ffc21a);border-radius:12px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.6);animation:bz-zoom .45s cubic-bezier(.2,1.4,.4,1) both}
.bz-dcard h3{margin:0 0 8px;font:900 22px/1.05 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--oc,#ffc21a)}
.bz-dcard p{margin:5px 0;font:400 9px/1.6 'Press Start 2P',monospace;color:#c9ccd4}
.bz-dcard p b{color:#f5f6f8}
.bz-dcard .res{margin-top:10px;font-size:14px;color:#f5f6f8}
.bz-dcard .sc{margin-top:8px;font-size:11px;color:#ffc21a}
.bz-box{position:absolute;inset:0;z-index:9;background:rgba(7,8,11,.97);overflow-y:auto;touch-action:pan-y;padding:14px calc(12px + env(safe-area-inset-right,0px)) 18px calc(12px + env(safe-area-inset-left,0px))}
.bz-box h2{margin:2px 0 4px;text-align:center;font:900 26px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px}
.bz-box .fs{display:flex;justify-content:center;align-items:center;gap:14px;margin:8px 0 12px;font:400 20px 'Press Start 2P',monospace}
.bz-box .fs span{font:900 18px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase}
.bz-box h3{margin:12px 0 4px;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#ffc21a}
.bz-box table{width:100%;border-collapse:collapse;font:600 12px Inter,sans-serif}
.bz-box th{font-weight:700;color:#6f7584;text-align:right;padding:3px 4px;font-size:10.5px;text-transform:uppercase}
.bz-box th:first-child,.bz-box td:first-child{text-align:left}
.bz-box td{text-align:right;padding:4px;border-top:1px solid #1d212c;white-space:nowrap}
.bz-box td:first-child{white-space:normal}
.bz-box .hl{margin:4px 0;padding-left:16px;font:600 12px/1.5 Inter,sans-serif;color:#c9ccd4}
.bz-box .go{display:block;margin:16px auto 4px;font:400 12px 'Press Start 2P',monospace;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer}
.bz-splash{position:absolute;inset:0;z-index:8;background:rgba(7,8,11,.9);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:11px;padding:16px;text-align:center;overflow:auto;touch-action:pan-y}
.bz-splash>:first-child{margin-top:auto}.bz-splash>:last-child{margin-bottom:auto;flex:0 0 auto}
.bz-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:24px;line-height:1.3;text-shadow:3px 3px 0 #6b4f00}
.bz-tag2{font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#c9ccd4;margin-top:-6px}
.bz-goal{font:400 9px/1.8 'Press Start 2P',monospace;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c;max-width:380px}
.bz-goal em{font-style:normal;color:#ffc21a}
.bz-squad{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.bz-squad div{display:flex;flex-direction:column;align-items:center;gap:4px;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#c9ccd4;max-width:70px}
.bz-squad .bz-face{width:44px;height:44px;box-shadow:0 0 0 2px #ffc21a}
.bz-squad em{font-style:normal;color:#6f7584;font-size:10px}
.bz-how{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-width:440px;text-align:left}
.bz-how li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:#c9ccd4}
.bz-how li b{color:#f5f6f8}
.bz-how li>i{flex:0 0 auto;font-style:normal;font:400 8px 'Press Start 2P',monospace;color:#07080b;background:#ffc21a;border-radius:6px;padding:5px 6px;margin-top:1px}
.bz-go{font:400 13px 'Press Start 2P',monospace;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:bz-pulse 1.1s ease-in-out infinite}
.bz-err{padding:40px 18px;text-align:center;font:600 15px/1.5 Inter,sans-serif;color:#c9ccd4;background:#0f1117;border:1px solid #1d212c;border-radius:12px}
.bz-err b{display:block;font:400 12px 'Press Start 2P',monospace;color:#ff3344;margin-bottom:12px}
.bz-land .bz-splash{gap:6px;padding:8px 14px}.bz-land .bz-title{font-size:16px}.bz-land .bz-squad{display:none}.bz-land .bz-goal{font-size:8px;padding:6px 10px}
.bz-land .bz-how{grid-template-columns:1fr 1fr;max-width:820px;gap:4px 14px}.bz-land .bz-how li{font-size:11.5px;line-height:1.3}.bz-land .bz-go{padding:10px 18px}
.bz-land .bz-btn{min-height:48px}.bz-land .bz-mv .bz-btn{width:56px;height:56px;min-height:52px;font-size:13px}.bz-land .bz-mv{grid-template-columns:repeat(5,56px)}.bz-land .bz-sprint{width:62px;height:62px;min-height:62px;flex-basis:62px}.bz-land .bz-sta{display:none}
.bz-land .bz-catch .bz-btn{width:72px;height:72px;flex-basis:72px}
.bz-land .bz-sheet{max-height:92%}.bz-land .bz-cards{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}
.bz-land .bz-meter{bottom:calc(70px + env(safe-area-inset-bottom,0px))}.bz-land .bz-banner{top:42%}.bz-land .bz-banner b{font-size:17px}
.bz-narrow .bz-tm b{font-size:13px}.bz-narrow .bz-tm em{font-size:11px;min-width:16px}.bz-narrow .bz-clk{min-width:56px}.bz-narrow .bz-clk b{font-size:10px}
.bz-narrow .bz-dd{font-size:12.5px;padding:3px 7px}.bz-narrow .bz-btn{font-size:15px}.bz-narrow .bz-banner b{font-size:15px}.bz-narrow .bz-banner i{font-size:8px}.bz-narrow .bz-title{font-size:19px}
.bz-narrow .bz-ctl{flex-wrap:wrap}.bz-narrow .bz-msg{flex:1 1 100%;order:-1;align-self:stretch;min-height:30px;padding:5px 10px;font-size:11.5px}
.bz-narrow .bz-arc button{padding:0 7px;font-size:12px}.bz-narrow .bz-sprint{width:60px;height:60px;min-height:60px;flex-basis:60px;font-size:12px}.bz-tiny .bz-arc button{padding:0 5px;font-size:11px}
.bz-tiny .bz-snd{display:none}.bz-narrow .bz-sta{min-width:46px;padding:0 5px}.bz-narrow .bz-tag{font-size:11px}.bz-narrow .bz-ib{min-width:32px;height:32px;padding:0 6px}.bz-narrow .bz-bug{gap:4px 4px;padding-left:6px;padding-right:6px}.bz-narrow .bz-tm{padding:3px 6px 3px 5px;gap:4px}.bz-narrow .bz-cards{grid-template-columns:1fr 1fr}.bz-narrow .bz-card span{display:none}.bz-narrow .bz-pc{display:none}
@keyframes bz-rise{0%{opacity:0;transform:translate(-50%,-20%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-240%) scale(1)}}
@keyframes bz-zoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes bz-pulse{50%{transform:scale(1.06)}}
@keyframes bz-up{0%{transform:translateY(40%);opacity:0}100%{transform:none;opacity:1}}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css2')) return;
    const s = document.createElement('style'); s.id = P + '-css2'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; };
  const shade = (c, k) => [clamp(c[0] * k, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k, 0, 1), c[3]];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
  const css = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };
  // same generator as the Arcade harness, so a seed always replays the same game randomness
  function mkRng(seed) {
    let h = 2166136261 >>> 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return function () { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const HW = 26.65, ORD = ['', '1st', '2nd', '3rd', '4th'];
  let crand = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })(); // cosmetic randomness; each game swaps in its own

  // ---------- tiny affine matrix helpers (3x4 row-major) ----------
  const IDM = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  function mT(m, x, y, z) { return [m[0], m[1], m[2], m[0] * x + m[1] * y + m[2] * z + m[3], m[4], m[5], m[6], m[4] * x + m[5] * y + m[6] * z + m[7], m[8], m[9], m[10], m[8] * x + m[9] * y + m[10] * z + m[11]]; }
  function mRX(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0], m[1] * c + m[2] * s, m[2] * c - m[1] * s, m[3], m[4], m[5] * c + m[6] * s, m[6] * c - m[5] * s, m[7], m[8], m[9] * c + m[10] * s, m[10] * c - m[9] * s, m[11]]; }
  function mRY(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0] * c - m[2] * s, m[1], m[0] * s + m[2] * c, m[3], m[4] * c - m[6] * s, m[5], m[4] * s + m[6] * c, m[7], m[8] * c - m[10] * s, m[9], m[8] * s + m[10] * c, m[11]]; }
  function mRZ(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0] * c + m[1] * s, m[1] * c - m[0] * s, m[2], m[3], m[4] * c + m[5] * s, m[5] * c - m[4] * s, m[6], m[7], m[8] * c + m[9] * s, m[9] * c - m[8] * s, m[10], m[11]]; }


  function mMul(a, b) { // 3x4 * 3x4
    return [a[0] * b[0] + a[1] * b[4] + a[2] * b[8], a[0] * b[1] + a[1] * b[5] + a[2] * b[9], a[0] * b[2] + a[1] * b[6] + a[2] * b[10], a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3],
      a[4] * b[0] + a[5] * b[4] + a[6] * b[8], a[4] * b[1] + a[5] * b[5] + a[6] * b[9], a[4] * b[2] + a[5] * b[6] + a[6] * b[10], a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7],
      a[8] * b[0] + a[9] * b[4] + a[10] * b[8], a[8] * b[1] + a[9] * b[5] + a[10] * b[9], a[8] * b[2] + a[9] * b[6] + a[10] * b[10], a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11]];
  }
  const mPt = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]];
  // matrix from a position and an orthonormal basis (columns)
  const mAxes = (p, X, Y, Z) => [X[0], Y[0], Z[0], p[0], X[1], Y[1], Z[1], p[1], X[2], Y[2], Z[2], p[2]];
  const v3n = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const v3c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const v3d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const v3s = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v3a = (a, b, k) => [a[0] + b[0] * (k == null ? 1 : k), a[1] + b[1] * (k == null ? 1 : k), a[2] + b[2] * (k == null ? 1 : k)];
  // bone matrix whose -Y axis points along `down` from `p`, with `fwd` as the forward hint
  function mFromDown(p, down, fwd) {
    const Y = v3n([-down[0], -down[1], -down[2]]);
    let Z = v3s(fwd, [Y[0] * v3d(fwd, Y), Y[1] * v3d(fwd, Y), Y[2] * v3d(fwd, Y)]);
    if (Math.hypot(Z[0], Z[1], Z[2]) < 1e-4) Z = v3c([1, 0, 0], Y);
    Z = v3n(Z); const X = v3c(Y, Z);
    return mAxes(p, X, Y, Z);
  }
  function mLerp(a, b, t) { const o = new Array(12); for (let i = 0; i < 12; i++) o[i] = a[i] + (b[i] - a[i]) * t; return o; }
  // column-major 4x4
  function m4Mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function m4LookAt(e, c, up) {
    let z = v3n(v3s(e, c)); let x = v3n(v3c(up, z)); const y = v3c(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3d(x, e), -v3d(y, e), -v3d(z, e), 1]);
  }
  function m4Ortho(l, r, b, t, n, f) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]); }
  function m4Inv(m) {
    const o = new Float32Array(16), a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7], a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return o; det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  }

  // ---------- geometry batch: pos(3) normal(3) color(4) uv(2) ----------
  const BOXF = [[0, 1, 1, 3, 7, 5], [0, -1, 0, 4, 6, 2], [1, 1, 2, 6, 7, 3], [1, -1, 0, 1, 5, 4], [2, 1, 4, 5, 7, 6], [2, -1, 0, 2, 3, 1]];
  function Batch(cap) { this.f = new Float32Array(cap * 12); this.n = 0; this.P = new Float32Array(24); this.nb = false; }
  Batch.prototype.grow = function (k) {
    if ((this.n + k) * 12 <= this.f.length) return;
    const g = new Float32Array(Math.max(this.f.length * 2, (this.n + k) * 12)); g.set(this.f); this.f = g;
  };
  Batch.prototype.v = function (x, y, z, nx, ny, nz, c, u, w) {
    const f = this.f, o = this.n * 12; f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = nx; f[o + 4] = ny; f[o + 5] = nz;
    f[o + 6] = c[0]; f[o + 7] = c[1]; f[o + 8] = c[2]; f[o + 9] = c[3]; f[o + 10] = u; f[o + 11] = w; this.n++;
  };
  Batch.prototype.box = function (m, cx, cy, cz, sx, sy, sz, c) {
    this.grow(36);
    const P = this.P, hx = sx / 2, hy = sy / 2, hz = sz / 2;
    for (let i = 0; i < 8; i++) {
      const lx = cx + (i & 1 ? hx : -hx), ly = cy + (i & 2 ? hy : -hy), lz = cz + (i & 4 ? hz : -hz);
      P[i * 3] = m[0] * lx + m[1] * ly + m[2] * lz + m[3];
      P[i * 3 + 1] = m[4] * lx + m[5] * ly + m[6] * lz + m[7];
      P[i * 3 + 2] = m[8] * lx + m[9] * ly + m[10] * lz + m[11];
    }
    for (let f = 0; f < 6; f++) {
      if (f === 3 && this.nb) continue;
      const F = BOXF[f], ax = F[0], sg = F[1];
      const nx = m[ax] * sg, ny = m[4 + ax] * sg, nz = m[8 + ax] * sg;
      const a = F[2] * 3, b = F[3] * 3, d = F[4] * 3, e = F[5] * 3;
      this.v(P[a], P[a + 1], P[a + 2], nx, ny, nz, c, 0.5, 0.5); this.v(P[b], P[b + 1], P[b + 2], nx, ny, nz, c, 0.5, 0.5); this.v(P[d], P[d + 1], P[d + 2], nx, ny, nz, c, 0.5, 0.5);
      this.v(P[a], P[a + 1], P[a + 2], nx, ny, nz, c, 0.5, 0.5); this.v(P[d], P[d + 1], P[d + 2], nx, ny, nz, c, 0.5, 0.5); this.v(P[e], P[e + 1], P[e + 2], nx, ny, nz, c, 0.5, 0.5);
    }
  };
  Batch.prototype.wbox = function (x0, y0, z0, x1, y1, z1, c) { this.box(IDM, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), c); };
  Batch.prototype.quad = function (a, b, c, d, n, col, uv) {
    this.grow(6); uv = uv || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const V = [a, b, c, a, c, d], U = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) this.v(V[i][0], V[i][1], V[i][2], n[0], n[1], n[2], col, uv[U[i] * 2], uv[U[i] * 2 + 1]);
  };
  Batch.prototype.disc = function (x, z, r, c, y, seg) {
    seg = seg || 10; y = y || 0.03; this.grow(seg * 3);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832;
      this.v(x, y, z, 0, 0, 0, c, 0.5, 0.5); this.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, 0, 0, 0, c, 0.5, 0.5); this.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, 0, 0, 0, c, 0.5, 0.5);
    }
  };
  // soft contact shadow: a fan whose alpha fades to zero at the rim (unlit, blended)
  Batch.prototype.blob = function (x, z, r, a, y, seg) {
    seg = seg || 10; y = y || 0.025; this.grow(seg * 3);
    const c0 = [0, 0, 0, a], c1 = [0, 0, 0, 0];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832;
      this.v(x, y, z, 0, 0, 0, c0, 0.5, 0.5); this.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, 0, 0, 0, c1, 0.5, 0.5); this.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, 0, 0, 0, c1, 0.5, 0.5);
    }
  };
  Batch.prototype.ring = function (x, z, r0, r1, c, y, seg) {
    seg = seg || 16; y = y || 0.04; this.grow(seg * 6);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad([x + c0 * r0, y, z + s0 * r0], [x + c0 * r1, y, z + s0 * r1], [x + c1 * r1, y, z + s1 * r1], [x + c1 * r0, y, z + s1 * r0], [0, 0, 0], c);
    }
  };
  Batch.prototype.seg = function (x0, z0, x1, z1, w, c, y) {
    y = y || 0.05; const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, px = -dz / l * w / 2, pz = dx / l * w / 2;
    this.quad([x0 + px, y, z0 + pz], [x1 + px, y, z1 + pz], [x1 - px, y, z1 - pz], [x0 - px, y, z0 - pz], [0, 0, 0], c);
  };
  // a camera-facing-ish vertical streak / flake (weather), unlit
  Batch.prototype.streak = function (x, y, z, len, w, c) {
    this.quad([x - w, y, z], [x + w, y, z], [x + w * 0.4, y + len, z + len * 0.08], [x - w * 0.4, y + len, z + len * 0.08], [0, 0, 0], c);
  };

  // ---------- small WebAudio helper (both Arcade and Franchise) ----------
  function Sfx() {
    let ac = null, out = null, noise = null, crowdG = null, crowdN = null, muted = false, lvl = 0.15;
    let s = 9137;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    function init() {
      if (ac || muted) return ac;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination);
        const n = Math.floor(ac.sampleRate * 2), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
        let br = 0; for (let i = 0; i < n; i++) { br = br * 0.97 + (r() * 2 - 1) * 0.3; d[i] = br; }
        noise = b;
        crowdN = ac.createBufferSource(); crowdN.buffer = noise; crowdN.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
        crowdG = ac.createGain(); crowdG.gain.value = 0;
        crowdN.connect(f); f.connect(crowdG); crowdG.connect(out); crowdN.start();
      } catch (e) { ac = null; }
      return ac;
    }
    function tone(f, d, type, v, f2, t0) {
      const t = ac.currentTime + (t0 || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.03);
    }
    function burst(d, fq, v, q, t0) {
      const t = ac.currentTime + (t0 || 0), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noise; f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q || 1;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.06, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(out); src.start(t, r() * 1.5); src.stop(t + d + 0.05);
    }
    const SEQ = {
      tap: () => tone(660, 0.04, 'square', 0.03),
      good: () => { tone(660, 0.07, 'square', 0.04); tone(880, 0.09, 'square', 0.04, 0, 0.06); },
      bad: () => { tone(220, 0.12, 'square', 0.04); tone(160, 0.16, 'square', 0.04, 0, 0.1); },
      whistle: () => { tone(2100, 0.09, 'sine', 0.05, 2000); tone(2050, 0.22, 'sine', 0.05, 1900, 0.1); },
      hike: () => burst(0.09, 300, 0.25, 2),
      kick: () => { tone(120, 0.12, 'triangle', 0.12, 60); burst(0.06, 500, 0.2); },
      catch: () => { burst(0.05, 1200, 0.2, 3); tone(520, 0.05, 'square', 0.025); },
      tackle: () => { burst(0.16, 140, 0.5, 0.8); tone(70, 0.14, 'sine', 0.12, 45); },
      throw: () => burst(0.18, 2200, 0.08, 0.7),
      horn: () => { tone(233, 0.6, 'sawtooth', 0.04); tone(294, 0.6, 'sawtooth', 0.035); tone(349, 0.6, 'sawtooth', 0.03); },
      cheer: () => burst(2.2, 1000, 0.35, 0.5),
      boo: () => burst(1.4, 300, 0.18, 0.6),
      win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.11)),
      lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'square', 0.04, 0, i * 0.15)),
    };
    return {
      init,
      play(n) { if (muted || !init() || !SEQ[n]) return; try { if (ac.state === 'suspended') ac.resume(); SEQ[n](); } catch (e) {} },
      crowd(v) { lvl = v; if (ac && crowdG && !muted) try { crowdG.gain.setTargetAtTime(Math.max(0.0001, v * 0.5), ac.currentTime, 0.25); } catch (e) {} },
      mute(m) { muted = m; if (crowdG) try { crowdG.gain.setTargetAtTime(m ? 0.0001 : lvl * 0.5, ac.currentTime, 0.05); } catch (e) {} },
      get muted() { return muted; },
      close() { try { if (crowdN) crowdN.stop(); if (ac) ac.close(); } catch (e) {} ac = null; },
    };
  }

  // ---------- Arcade CPU teams ----------
  const CPU_TEAMS = [
    { name: 'JV Squad', abbr: 'JV', color: '#64748b', color2: '#e2e8f0', ovrOff: 46, ovrDef: 45 },
    { name: 'Hall Monitors', abbr: 'HMS', color: '#7c3aed', color2: '#f5f3ff', ovrOff: 60, ovrDef: 60 },
    { name: 'Detention Kings', abbr: 'DK', color: '#b91c1c', color2: '#111111', ovrOff: 72, ovrDef: 72 },
    { name: 'The Faculty', abbr: 'FAC', color: '#0f172a', color2: '#facc15', ovrOff: 84, ovrDef: 85 },
  ];

  // ---------- playbook ----------
  // Formation spots (x, depth from the line of scrimmage). Keys: QB, RB, X (WR1), Z (WR2), S (slot / FB / wing), Y (TE).
  const FORMS = {
    gun: { name: 'Shotgun', QB: [0, -5], RB: [-1.9, -5.2], X: [-13, -0.7], Z: [13, -0.7], S: [7.5, -1.4], Y: [3.9, -1.1], under: 0 },
    single: { name: 'Singleback', QB: [0, -1.3], RB: [0, -6.5], X: [-13, -0.7], Z: [13, -0.7], S: [8, -1.4], Y: [3.9, -1.1], under: 1 },
    iform: { name: 'I-Form', QB: [0, -1.3], RB: [0, -7], S: [0, -4.4], X: [-13, -0.7], Z: [13, -0.7], Y: [3.9, -1.1], under: 1 },
    trips: { name: 'Trips', QB: [0, -5], RB: [-1.9, -5.2], X: [-13, -0.7], Z: [14, -0.7], S: [10, -1.4], Y: [6, -1.4], under: 0 },
    empty: { name: 'Empty', QB: [0, -5], RB: [-7, -1.4], X: [-14, -0.7], Z: [14, -0.7], S: [8.5, -1.4], Y: [-3.9, -1.1], under: 0 },
    pistol: { name: 'Pistol', QB: [0, -3.6], RB: [0, -6.8], X: [-13, -0.7], Z: [13, -0.7], S: [8, -1.4], Y: [5.3, -1.1], under: 0 },
    bunch: { name: 'Bunch', QB: [0, -5], RB: [-1.9, -5.2], X: [-13, -0.7], Z: [11.5, -0.7], S: [9, -1.8], Y: [13.5, -1.6], under: 0 },
    spread: { name: 'Spread', QB: [0, -5], RB: [1.9, -5.2], X: [-14, -0.7], Z: [14, -0.7], S: [-8, -1.4], Y: [8, -1.4], under: 0 },
    heavy: { name: 'Heavy', QB: [0, -1.3], RB: [0, -6.5], X: [-13, -0.7], Z: [13, -0.7], S: [-5.3, -1.1], Y: [5.3, -1.1], under: 1 },
    wing: { name: 'Wing', QB: [0, -1.3], RB: [0, -6.5], X: [-13, -0.7], Z: [13, -0.7], S: [5.4, -2.3], Y: [5.3, -1.1], under: 1 },
    split: { name: 'Split Backs', QB: [0, -5], RB: [-3.6, -5], S: [3.6, -5], X: [-13, -0.7], Z: [13, -0.7], Y: [5.3, -1.1], under: 0 },
    jumbo: { name: 'Jumbo', QB: [0, -1.3], RB: [0, -5.6], S: [0, -3.5], X: [-6.9, -1.1], Z: [13, -0.7], Y: [5.3, -1.1], under: 1 },
  };
  // Route = waypoints [out, up] relative to the player's spot (out = toward his sideline), optional
  // sit (stop at the end), d (delay before release), blk (pass-block first, seconds). 'B' = block.
  const R = (w, o) => Object.assign({ w }, o || {});
  const GO = R([[0, 40]]), SLANT = R([[0, 3], [-10, 10]]), OUT = R([[0, 6], [5, 6]]), CURL = R([[0, 10], [1, 8.5]], { sit: 1 }), HITCH = R([[0, 5], [0.5, 4.5]], { sit: 1 }),
    POST = R([[0, 12], [-9, 28]]), CORNER = R([[0, 10], [7, 19]]), DIG = R([[0, 12], [-14, 12]]), FLAT = R([[3, 1], [9, 2]]), DRAG = R([[0, 2], [-18, 4]]),
    SEAM = R([[0, 6], [-2, 40]]), COMEBACK = R([[0, 14], [2, 11]], { sit: 1 }), FADE = R([[0, 4], [2, 32]]), STICK = R([[0, 5], [2, 5]], { sit: 1 }), SNAG = R([[0, 6], [-3, 6]], { sit: 1 }),
    WHIP = R([[0, 4], [-3, 5], [3, 6]], { sit: 1 }), OVER = R([[0, 14], [-22, 20]]), SLUGGO = R([[0, 3], [-4, 7], [-4, 36]]), OUTUP = R([[0, 6], [4, 6], [4, 36]]), PCORNER = R([[0, 10], [-4, 16], [5, 27]]),
    CHK = R([[-3, 0], [-8, 2]], { blk: 1 }), SWING = R([[4, -1], [9, 0], [11, 2]]), WHEEL = R([[4, 0], [8, 3], [8, 32]]), ANGLE = R([[3, 0], [2, 2], [-4, 7]]), DEEPOUT = R([[0, 14], [6, 14]]),
    BLK = 'B', ALLB = { X: BLK, Z: BLK, S: BLK, Y: BLK };
  // yd = the gain the play is drawn up for, risk = turnover / loss chance (0..1), clk = how much clock it burns (runs 1, sideline throws 0)
  const PLAYS = [
    // runs
    { id: 'zone', name: 'Inside Zone', form: 'single', cat: 'run', type: 'run', lane: 1.5, yd: 4, risk: 0.1, clk: 1, desc: 'Downhill run, read the hole', routes: ALLB },
    { id: 'ozone', name: 'Outside Zone', form: 'single', cat: 'run', type: 'run', lane: 7, yd: 5, risk: 0.2, clk: 1, desc: 'Stretch it wide, cut it back', routes: ALLB },
    { id: 'power', name: 'Power O', form: 'iform', cat: 'run', type: 'run', lane: 3.4, lead: 1, yd: 4, risk: 0.1, clk: 1, desc: 'Fullback leads off tackle', routes: ALLB },
    { id: 'iso', name: 'Iso', form: 'iform', cat: 'run', type: 'run', lane: -1.5, lead: 1, yd: 3, risk: 0.05, clk: 1, desc: 'Fullback leads through the A gap', routes: ALLB },
    { id: 'toss', name: 'Toss Sweep', form: 'iform', cat: 'run', type: 'run', lane: 11, toss: 1, lead: 1, yd: 6, risk: 0.3, clk: 1, desc: 'Pitch it outside, beat them to the edge', routes: ALLB },
    { id: 'counter', name: 'Counter', form: 'single', cat: 'run', type: 'run', lane: -3.4, cnt: 1, yd: 5, risk: 0.2, clk: 1, desc: 'Jab step right, hit it back left', routes: ALLB },
    { id: 'hbdive', name: 'HB Dive', form: 'jumbo', cat: 'run', type: 'run', lane: -0.8, lead: 1, yd: 2, risk: 0.05, clk: 1, desc: 'Short yardage, everybody in', routes: ALLB },
    { id: 'trap', name: 'Trap', form: 'pistol', cat: 'run', type: 'run', lane: -1.2, yd: 4, risk: 0.15, clk: 1, desc: 'Quick hitter inside, corners get pulled deep', routes: { X: GO, Z: GO, S: BLK, Y: BLK } },
    { id: 'stretch', name: 'Pistol Stretch', form: 'pistol', cat: 'run', type: 'run', lane: 8, toss: 1, yd: 5, risk: 0.25, clk: 1, desc: 'Pitch to the edge from the pistol', routes: ALLB },
    { id: 'draw', name: 'Draw', form: 'gun', cat: 'run', type: 'draw', lane: 0.8, yd: 5, risk: 0.15, clk: 0.9, desc: 'Fake pass, delayed handoff', routes: { X: R([[0, 14]]), Z: R([[0, 14]]), S: R([[0, 10]]), Y: BLK } },
    { id: 'leaddraw', name: 'Lead Draw', form: 'iform', cat: 'run', type: 'draw', lane: 0, lead: 1, yd: 5, risk: 0.15, clk: 0.9, desc: 'Pass look, then the back follows his fullback', routes: { X: R([[0, 14]]), Z: R([[0, 14]]), S: BLK, Y: BLK } },
    { id: 'sneak', name: 'QB Sneak', form: 'single', cat: 'run', type: 'sneak', lane: 0, yd: 1, risk: 0.05, clk: 1, desc: 'Short yardage push', routes: { X: BLK, Z: BLK, S: BLK, Y: BLK, RB: BLK } },
    { id: 'qbpower', name: 'QB Power', form: 'pistol', cat: 'run', type: 'sneak', lane: 3.4, lead: 1, yd: 4, risk: 0.2, clk: 1, desc: 'QB keeps it behind the lead block', routes: { X: BLK, Z: BLK, S: BLK, Y: BLK, RB: BLK } },
    { id: 'qbsweep', name: 'QB Sweep', form: 'gun', cat: 'run', type: 'sneak', lane: 9, yd: 5, risk: 0.3, clk: 1, desc: 'QB takes it around the edge', routes: { X: BLK, Z: BLK, S: BLK, Y: BLK, RB: BLK } },
    // quick game
    { id: 'slant', name: 'Slant Flat', form: 'gun', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'Quick inside breaks', routes: { X: SLANT, Z: SLANT, S: FLAT, Y: R([[0, 18]]), RB: CHK } },
    { id: 'mesh', name: 'Mesh', form: 'gun', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'Two crossers rub underneath', routes: { X: R([[0, 10], [-10, 10]]), Z: R([[0, 10], [6, 17]]), S: R([[0, 2], [-18, 4]]), Y: R([[0, 2.5], [-16, 5]]), RB: R([[-3, 0], [-8, 1.5]], { blk: 0.8 }) } },
    { id: 'outs', name: 'Spread Outs', form: 'empty', cat: 'quick', type: 'pass', yd: 6, risk: 0.15, clk: 0.2, sl: 1, desc: 'Five wide, quick outs', routes: { X: OUT, Z: OUT, S: R([[0, 5], [0.5, 4.5]], { sit: 1 }), Y: R([[0, 3], [-9, 9]]), RB: R([[0, 4], [4, 4]]) } },
    { id: 'curl', name: 'Curl Flat', form: 'single', cat: 'quick', type: 'pass', yd: 8, risk: 0.2, clk: 0.5, desc: 'Curls sit in the holes', routes: { X: CURL, Z: CURL, S: FLAT, Y: R([[0, 15]]), RB: BLK } },
    { id: 'stick', name: 'Stick', form: 'trips', cat: 'quick', type: 'pass', yd: 6, risk: 0.15, clk: 0.5, desc: 'Stick sits, flat stretches the flat defender', routes: { Z: FADE, S: FLAT, Y: STICK, X: SLANT, RB: CHK } },
    { id: 'snag', name: 'Snag', form: 'bunch', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'Triangle read out of the bunch', routes: { Z: CORNER, S: SNAG, Y: FLAT, X: DIG, RB: CHK } },
    { id: 'hitches', name: 'All Hitches', form: 'spread', cat: 'quick', type: 'pass', yd: 5, risk: 0.1, clk: 0.5, desc: 'Take the free five yards', routes: { X: HITCH, Z: HITCH, S: R([[0, 6], [0.5, 5.5]], { sit: 1 }), Y: R([[0, 6], [0.5, 5.5]], { sit: 1 }), RB: CHK } },
    { id: 'dslant', name: 'Double Slants', form: 'gun', cat: 'quick', type: 'pass', yd: 7, risk: 0.25, clk: 0.5, desc: 'Slants from both sides, hit the open one', routes: { X: SLANT, Z: SLANT, S: R([[0, 2], [-8, 8]]), Y: FLAT, RB: CHK } },
    { id: 'shallow', name: 'Shallow Cross', form: 'single', cat: 'quick', type: 'pass', yd: 8, risk: 0.25, clk: 0.5, desc: 'Shallow drag with a dig over the top', routes: { Y: DRAG, X: DIG, Z: POST, S: FLAT, RB: CHK } },
    { id: 'spacing', name: 'Spacing', form: 'empty', cat: 'quick', type: 'pass', yd: 6, risk: 0.15, clk: 0.4, desc: 'Five short routes, all spaced out', routes: { X: HITCH, Z: HITCH, S: SNAG, Y: SNAG, RB: OUT } },
    { id: 'whip', name: 'Whip', form: 'bunch', cat: 'quick', type: 'pass', yd: 6, risk: 0.2, clk: 0.5, desc: 'Whip route breaks back outside', routes: { Z: GO, S: WHIP, Y: FLAT, X: SLANT, RB: CHK } },
    { id: 'texas', name: 'Texas', form: 'split', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'Backs out of the backfield: angle and swing', routes: { RB: ANGLE, S: SWING, Y: STICK, X: HITCH, Z: CURL } },
    // intermediate
    { id: 'levels', name: 'Levels', form: 'gun', cat: 'mid', type: 'pass', yd: 11, risk: 0.3, clk: 0.3, desc: 'Two in-cuts at different depths', routes: { X: R([[0, 10], [-14, 10]]), S: R([[0, 5], [-12, 5]]), Z: POST, Y: FLAT, RB: CHK } },
    { id: 'drive', name: 'Drive', form: 'single', cat: 'mid', type: 'pass', yd: 10, risk: 0.3, clk: 0.3, desc: 'Drag underneath, dig right behind it', routes: { X: DRAG, Y: DIG, Z: GO, S: FLAT, RB: CHK } },
    { id: 'ycross', name: 'Y Cross', form: 'iform', cat: 'mid', type: 'pass', yd: 14, risk: 0.35, clk: 0.3, desc: 'Tight end crosses deep behind the linebackers', routes: { Y: OVER, X: POST, Z: DIG, S: FLAT, RB: CHK } },
    { id: 'dagger', name: 'Dagger', form: 'gun', cat: 'mid', type: 'pass', yd: 13, risk: 0.35, clk: 0.3, desc: 'Seam clears it out, dig comes in under', routes: { S: SEAM, X: R([[0, 15], [-14, 15]]), Z: CURL, Y: FLAT, RB: CHK } },
    { id: 'smash', name: 'Smash', form: 'trips', cat: 'mid', type: 'pass', yd: 12, risk: 0.3, clk: 0.3, desc: 'Hitch under, corner over', routes: { Z: R([[0, 5], [0.5, 4.5]], { sit: 1 }), S: R([[0, 10], [7, 19]]), Y: R([[2, 1], [7, 2.5]]), X: R([[0, 12], [-8, 26]]), RB: BLK } },
    { id: 'flood', name: 'Flood', form: 'trips', cat: 'mid', type: 'pass', yd: 11, risk: 0.3, clk: 0.3, desc: 'Three levels to one side', routes: { Z: R([[0, 40]]), S: R([[0, 11], [6, 11]]), Y: R([[3, 1], [8, 2.5]]), X: R([[0, 12], [-14, 12]]), RB: R([[-3, 0], [-8, 2]], { blk: 1.2 }) } },
    { id: 'sail', name: 'Sail', form: 'bunch', cat: 'mid', type: 'pass', yd: 12, risk: 0.3, clk: 0.2, sl: 1, desc: 'Three levels on the sideline', routes: { Z: GO, S: R([[0, 12], [7, 13]]), Y: FLAT, X: DIG, RB: BLK } },
    { id: 'comebacks', name: 'Comebacks', form: 'gun', cat: 'mid', type: 'pass', yd: 13, risk: 0.3, clk: 0.1, sl: 1, desc: 'Drive them off, snap it back to the sideline', routes: { X: COMEBACK, Z: COMEBACK, S: SEAM, Y: R([[0, 8], [6, 8]]), RB: CHK } },
    { id: 'mills', name: 'Mills', form: 'gun', cat: 'mid', type: 'pass', yd: 14, risk: 0.4, clk: 0.3, desc: 'Post over the top of the dig', routes: { X: POST, Z: R([[0, 14], [-14, 14]]), S: CURL, Y: FLAT, RB: CHK } },
    { id: 'scissors', name: 'Scissors', form: 'spread', cat: 'mid', type: 'pass', yd: 14, risk: 0.4, clk: 0.3, desc: 'Post and corner cross each other', routes: { Z: POST, Y: CORNER, X: CURL, S: FLAT, RB: CHK } },
    { id: 'curlwheel', name: 'Curl Wheel', form: 'gun', cat: 'mid', type: 'pass', yd: 12, risk: 0.35, clk: 0.3, desc: 'Back wheels up the sideline under the curl', routes: { X: R([[0, 12], [1, 10.5]], { sit: 1 }), RB: WHEEL, Z: SLANT, S: R([[0, 8], [5, 8]]), Y: FLAT } },
    { id: 'dblouts', name: 'Deep Outs', form: 'single', cat: 'mid', type: 'pass', yd: 13, risk: 0.3, clk: 0.1, sl: 1, desc: 'Sideline throws that stop the clock', routes: { X: DEEPOUT, Z: DEEPOUT, Y: SEAM, S: FLAT, RB: BLK } },
    // deep shots
    { id: 'verts', name: 'Four Verts', form: 'gun', cat: 'deep', type: 'pass', yd: 25, risk: 0.5, clk: 0, desc: 'Stretch them deep', routes: { X: R([[0, 44]]), Z: R([[0, 44]]), S: R([[0, 6], [-2, 40]]), Y: R([[0, 40]]), RB: BLK } },
    { id: 'postcorner', name: 'Post Corner', form: 'gun', cat: 'deep', type: 'pass', yd: 24, risk: 0.5, clk: 0, desc: 'Post fake, break to the corner', routes: { X: PCORNER, Z: POST, S: SEAM, Y: R([[0, 8], [6, 8]]), RB: BLK } },
    { id: 'dblpost', name: 'Double Post', form: 'gun', cat: 'deep', type: 'pass', yd: 24, risk: 0.5, clk: 0, desc: 'Two posts split the safety', routes: { X: POST, Z: POST, S: FLAT, Y: DRAG, RB: BLK } },
    { id: 'sluggo', name: 'Sluggo', form: 'spread', cat: 'deep', type: 'pass', yd: 28, risk: 0.55, clk: 0, desc: 'Slant fake, then go', routes: { X: SLUGGO, Z: SLANT, S: R([[0, 8], [5, 8]]), Y: SEAM, RB: BLK } },
    { id: 'outup', name: 'Out and Up', form: 'gun', cat: 'deep', type: 'pass', yd: 26, risk: 0.5, clk: 0, desc: 'Sell the out, then take off', routes: { Z: OUTUP, X: HITCH, S: CURL, Y: FLAT, RB: BLK } },
    { id: 'rzfade', name: 'Fade Pair', form: 'gun', cat: 'deep', type: 'pass', yd: 18, risk: 0.45, clk: 0.1, desc: 'Back-shoulder balls to the corners of the end zone', routes: { X: FADE, Z: FADE, S: FLAT, Y: STICK, RB: CHK } },
    { id: 'hbwheel', name: 'HB Wheel', form: 'gun', cat: 'deep', type: 'pass', yd: 22, risk: 0.5, clk: 0, desc: 'Back sneaks up the sideline', routes: { RB: WHEEL, X: POST, Z: DIG, S: DRAG, Y: GO } },
    { id: 'deepcross', name: 'Deep Cross', form: 'bunch', cat: 'deep', type: 'pass', yd: 22, risk: 0.5, clk: 0, desc: 'Crosser comes all the way across', routes: { Z: OVER, S: POST, Y: FLAT, X: GO, RB: BLK } },
    { id: 'seamshot', name: 'Seam Shot', form: 'pistol', cat: 'deep', type: 'pass', yd: 20, risk: 0.45, clk: 0, desc: 'Tight end splits the safeties', routes: { Y: SEAM, X: COMEBACK, Z: COMEBACK, S: FLAT, RB: BLK } },
    { id: 'hailmary', name: 'Hail Mary', form: 'empty', cat: 'deep', type: 'pass', yd: 45, risk: 0.9, clk: 0, desc: 'Everybody deep, throw it up', routes: { X: POST, Z: POST, S: GO, Y: GO, RB: R([[0, 30], [4, 38]]) } },
    // play action
    { id: 'papost', name: 'PA Post', form: 'single', cat: 'pa', type: 'pa', yd: 22, risk: 0.45, clk: 0.1, desc: 'Fake the run, go over the top', routes: { X: R([[0, 12], [-9, 28]]), Z: R([[0, 12], [-11, 12]]), S: R([[0, 40]]), Y: R([[0, 2], [-15, 6]], { d: 0.4 }), RB: BLK } },
    { id: 'boot', name: 'PA Boot', form: 'iform', cat: 'pa', type: 'boot', yd: 12, risk: 0.3, clk: 0.3, desc: 'Fake, roll right, flood', routes: { X: R([[0, 8], [-24, 16]]), Z: R([[0, 30]]), S: R([[4, 0], [11, 2]], { d: 0.5 }), Y: R([[0, 6], [7, 13]], { d: 0.2 }), RB: BLK } },
    { id: 'pacross', name: 'PA Crossers', form: 'iform', cat: 'pa', type: 'pa', yd: 16, risk: 0.4, clk: 0.2, desc: 'Fake the dive, crossers behind the linebackers', routes: { X: OVER, Z: DIG, S: R([[4, 0], [11, 2]], { d: 0.5 }), Y: POST, RB: BLK } },
    { id: 'padig', name: 'PA Dig', form: 'single', cat: 'pa', type: 'pa', yd: 15, risk: 0.35, clk: 0.2, desc: 'Linebackers bite, the dig is open', routes: { X: R([[0, 15], [-14, 15]]), Z: POST, Y: SEAM, S: R([[3, 1], [9, 2]], { d: 0.4 }), RB: BLK } },
    { id: 'pawheel', name: 'PA Wheel', form: 'wing', cat: 'pa', type: 'pa', yd: 20, risk: 0.45, clk: 0.1, desc: 'Wing back leaks out and wheels', routes: { S: R([[3, 0], [6, 3], [6, 32]], { d: 0.3 }), Y: DRAG, X: POST, Z: COMEBACK, RB: BLK } },
    { id: 'pashot', name: 'PA Shot', form: 'heavy', cat: 'pa', type: 'pa', yd: 28, risk: 0.55, clk: 0, desc: 'Max protect, two deep', routes: { X: GO, Z: POST, Y: R([[0, 10], [7, 19]], { d: 0.5 }), S: R([[3, 1], [9, 2]], { d: 0.5 }), RB: BLK } },
    { id: 'waggle', name: 'Waggle', form: 'iform', cat: 'pa', type: 'boot', yd: 14, risk: 0.35, clk: 0.3, desc: 'Roll out, three options on the move', routes: { X: R([[0, 8], [-26, 18]]), Z: COMEBACK, S: R([[4, 0], [11, 2]], { d: 0.5 }), Y: R([[0, 4], [8, 8]], { d: 0.2 }), RB: BLK } },
    { id: 'paverts', name: 'PA Verts', form: 'pistol', cat: 'pa', type: 'pa', yd: 28, risk: 0.6, clk: 0, desc: 'Suck up the safeties, go over the top', routes: { S: SEAM, Y: SEAM, X: GO, Z: GO, RB: BLK } },
    // screens and gadgets
    { id: 'bubble', name: 'Bubble Screen', form: 'gun', cat: 'trick', type: 'screen', yd: 7, risk: 0.2, clk: 0.5, desc: 'Get it to the slot in space', routes: { S: R([[3, -2], [7, -2]], { sit: 1 }), X: BLK, Z: BLK, Y: BLK, RB: BLK }, scr: 'S' },
    { id: 'rbscreen', name: 'RB Screen', form: 'gun', cat: 'trick', type: 'screen', yd: 9, risk: 0.25, clk: 0.5, desc: 'Let them in, dump it off', routes: { RB: R([[-4, -1], [-8, -1]], { sit: 1, d: 0.9 }), X: R([[0, 30]]), Z: R([[0, 30]]), S: R([[0, 25]]), Y: BLK }, scr: 'RB' },
    { id: 'wrscreen', name: 'WR Screen', form: 'spread', cat: 'trick', type: 'screen', yd: 8, risk: 0.2, clk: 0.5, desc: 'Quick toss out wide, the slot blocks', routes: { X: R([[1, -1.5], [2, -1.5]], { sit: 1 }), S: BLK, Z: GO, Y: GO, RB: BLK }, scr: 'X' },
    { id: 'tunnel', name: 'Tunnel Screen', form: 'gun', cat: 'trick', type: 'screen', yd: 9, risk: 0.25, clk: 0.5, desc: 'Receiver comes inside behind the blockers', routes: { Z: R([[-3, -1], [-7, -1.5]], { sit: 1 }), S: BLK, Y: BLK, X: GO, RB: BLK }, scr: 'Z' },
    { id: 'slip', name: 'Slip Screen', form: 'single', cat: 'trick', type: 'screen', yd: 10, risk: 0.25, clk: 0.5, desc: 'Tight end slips out behind the rush', routes: { Y: R([[0, -1], [-4, -1.5]], { sit: 1, d: 0.5 }), X: GO, Z: GO, S: SEAM, RB: BLK }, scr: 'Y' },
    { id: 'swing', name: 'Swing Screen', form: 'gun', cat: 'trick', type: 'screen', yd: 8, risk: 0.25, clk: 0.5, desc: 'Swing it wide, linemen get out in front', routes: { RB: R([[5, -2], [10, -1]], { sit: 1, d: 0.4 }), X: GO, Z: GO, S: BLK, Y: BLK }, scr: 'RB' },
    { id: 'jet', name: 'Jet Sweep', form: 'wing', cat: 'trick', type: 'run', carrier: 'S', lane: -11, yd: 7, risk: 0.35, clk: 0.8, desc: 'Wing back flies across for the handoff', routes: { X: BLK, Z: BLK, Y: BLK, RB: BLK } },
    { id: 'endaround', name: 'End Around', form: 'single', cat: 'trick', type: 'run', carrier: 'X', lane: 12, yd: 9, risk: 0.5, clk: 0.8, desc: 'Receiver comes all the way around', routes: { Z: BLK, S: BLK, Y: BLK, RB: BLK } },
    { id: 'qbdraw', name: 'QB Draw', form: 'empty', cat: 'trick', type: 'qbdraw', yd: 7, risk: 0.25, clk: 0.8, desc: 'Show pass, then take off up the middle', routes: { X: GO, Z: GO, S: SEAM, Y: SEAM, RB: OUT } },
    { id: 'screengo', name: 'Screen and Go', form: 'gun', cat: 'trick', type: 'pass', yd: 24, risk: 0.55, clk: 0, desc: 'Fake the bubble, the slot takes off', routes: { S: R([[3, -2], [3, 0], [0, 32]]), X: R([[0, 34]], { blk: 0.7 }), Z: POST, Y: BLK, RB: CHK } },
  ];
  const CATS = [['coach', 'Coach'], ['run', 'Run'], ['quick', 'Quick'], ['mid', 'Mid'], ['deep', 'Deep'], ['pa', 'PA'], ['trick', 'Trick']];
  const ROUTE_NAMES = { go: 'Go', slant: 'Slant', out: 'Out', curl: 'Curl', post: 'Post' };
  const HOT = { go: R([[0, 40]]), slant: R([[0, 3], [-10, 10]]), out: R([[0, 6], [6, 6]]), curl: R([[0, 10], [1, 8.5]], { sit: 1 }), post: R([[0, 12], [-9, 26]]) };
  const HOT_ORDER = ['go', 'slant', 'out', 'curl', 'post'];
  const isPassPlay = (p) => p.type === 'pass' || p.type === 'pa' || p.type === 'boot' || p.type === 'screen' || p.type === 'qbdraw';
  const isRunPlay = (p) => p.type === 'run' || p.type === 'draw' || p.type === 'sneak';

  // ---------- difficulty curve (0 = Rookie .. 1 = Legend) ----------
  // k: defensive talent 0..~1.1 from difficulty and the CPU team's ovrDef
  function defParams(k) {
    const L = (a, b) => a + (b - a) * clamp(k, 0, 1.15);
    return {
      cbV: L(6.75, 8.4), lbV: L(6.1, 7.5), dlV: L(5.4, 6.7), sV: L(6.6, 8.3),
      lag: L(0.62, 0.26), react: L(0.6, 0.3), cush: L(7.5, 4.5), zoneTight: L(0.45, 1),
      shedPass: L(4.0, 2.4), shedRun: L(2.2, 1.3), read: L(0.7, 0.34), bite: L(0.9, 0.25),
      tackle: L(46, 86), intSkill: L(0.06, 0.17), deflect: L(0.2, 0.34), stare: L(0.15, 0.6),
      blitz: L(0.06, 0.32), disguise: L(0, 0.7), pursuit: L(6.4, 8.35), stun: L(1.1, 0.5),
    };
  }

  // =====================================================================================
  // Shaders (GLSL ES 1.00 so the same source runs on WebGL1 and WebGL2 contexts)
  // Physically based: GGX specular, Schlick Fresnel, Smith visibility, hemispheric + cubemap ambient,
  // one shadowed key light (3 cascades, rotated PCF) plus four unshadowed stadium fills, HDR output.
  // =====================================================================================
  const FS_PRE = `precision HP float;
//OUT
`;
  // shared fragment lighting library; #defines: DERIV (derivatives available), SHADOW_PACKED (RGBA depth), NCASC n, PCF_HI
  const SH_LIB = `uniform HP vec3 uEye;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec4 uLP[4];uniform vec3 uLC[4];uniform vec3 uAmbC;uniform vec3 uGndC;uniform float uEnvK;
uniform samplerCube uEnv;uniform vec3 uFog;uniform vec3 uFogR;uniform sampler2D uShadow;uniform mat4 uLVP0;uniform mat4 uLVP1;uniform mat4 uLVP2;uniform vec4 uShadowP;uniform vec3 uSplit;uniform float uTime;
varying vec3 vW;varying vec3 vN;varying float vVD;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
float unpackD(vec4 c){return dot(c,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}
float shD(vec2 uv){
#ifdef SHADOW_PACKED
  return unpackD(texture2D(uShadow,uv));
#else
  return texture2D(uShadow,uv).r;
#endif
}
// cascaded shadow lookup: pick the tightest cascade whose box holds the point; rotated 8-tap disc; returns 0 (shadow) .. 1 (lit)
float shadowAt(vec3 N,float NL){
  if(uShadowP.x<0.5)return 1.0;
  float nc=uShadowP.z;float no=1.3-NL;
  vec4 s4=uLVP0*vec4(vW+N*0.03*no,1.0);int c=0;float csc=0.0;
  if(max(abs(s4.x),abs(s4.y))>0.97){
    if(nc<1.5)return 1.0;
    s4=uLVP1*vec4(vW+N*0.1*no,1.0);c=1;csc=1.0;
    if(max(abs(s4.x),abs(s4.y))>0.97){
      if(nc<2.5)return 1.0;
      s4=uLVP2*vec4(vW+N*0.35*no,1.0);c=2;csc=2.0;
      if(max(abs(s4.x),abs(s4.y))>0.99)return 1.0;}}
  vec3 s=s4.xyz*0.5+0.5;if(s.z>1.0)return 1.0;
  vec2 uv=vec2((s.x+csc)/nc,s.y);
  float d=s.z-uShadowP.w*(c==0?1.0:(c==1?2.0:4.0));
  float r=uShadowP.y*(c==0?3.0:(c==1?2.0:1.2));
  float a=ign(gl_FragCoord.xy+fract(uTime)*17.0)*6.2832;vec2 R=vec2(cos(a),sin(a));
  vec2 tx=vec2(r/nc,r);
  float acc=0.0;
#define TAP(o) {vec2 q=vec2(o.x*R.x-o.y*R.y,o.x*R.y+o.y*R.x)*tx;acc+=step(d,shD(uv+q));}
  TAP(vec2(-0.613,0.617))TAP(vec2(0.170,-0.040))TAP(vec2(-0.299,-0.791))TAP(vec2(0.645,0.493))
#ifdef PCF_HI
  TAP(vec2(-0.651,-0.195))TAP(vec2(0.421,-0.712))TAP(vec2(-0.102,0.962))TAP(vec2(0.946,-0.152))
  return acc*0.125;
#else
  return acc*0.25;
#endif
}
float D_GGX(float NH,float a){float a2=a*a;float d=NH*NH*(a2-1.0)+1.0;return a2/(3.14159*d*d+1e-6);}
float V_Smith(float NV,float NL,float a){float a2=a*a;float gv=NL*sqrt(NV*NV*(1.0-a2)+a2);float gl=NV*sqrt(NL*NL*(1.0-a2)+a2);return 0.5/(gv+gl+1e-5);}
vec3 F_Schlick(vec3 F0,float VH){float f=pow(1.0-VH,5.0);return F0+(1.0-F0)*f;}
vec3 envBRDF(vec3 F0,float rough,float NV){vec4 r=rough*vec4(-1.0,-0.0275,-0.572,0.022)+vec4(1.0,0.0425,1.04,-0.04);float a004=min(r.x*r.x,exp2(-9.28*NV))*r.x+r.y;vec2 AB=vec2(-1.04,1.04)*a004+r.zw;return F0*AB.x+AB.y;}
vec3 toLin(vec3 c){return c*(c*(c*0.305306011+0.682171111)+0.012522878);}
// direct + ambient shading. mode: 0 dielectric/metal, 1 skin (wrap + subsurface), 2 clearcoat (helmet)
vec3 shadePBR(vec3 albedo,vec3 N,float rough,float metal,float ao,float cav,int mode,float specOcc){
  vec3 V=normalize(uEye-vW);float NV=max(dot(N,V),1e-3);
  vec3 F0=mix(vec3(0.04),albedo,metal);vec3 diff=albedo*(1.0-metal);
  float a=max(rough*rough,0.003);
  // key light (shadowed)
  float NLr=dot(N,uSunDir);float NL=max(NLr,0.0);
  float sh=shadowAt(N,NL)*ao;
  vec3 col=vec3(0.0);
  {vec3 H=normalize(V+uSunDir);float NH=max(dot(N,H),0.0),VH=max(dot(V,H),0.0);
   vec3 F=F_Schlick(F0,VH);float D=D_GGX(NH,a),Vs=V_Smith(NV,NL,a);
   vec3 kd=diff*(1.0-F)/3.14159*NL;
   if(mode==1){float w=0.45;float wrap=clamp((NLr+w)/(1.0+w),0.0,1.0);float band=smoothstep(0.0,0.45,wrap)*(1.0-smoothstep(0.45,1.0,wrap));kd=diff*(wrap*0.85+0.15*NL)/3.14159+vec3(0.45,0.07,0.02)*band*0.11*diff.r;}
   col+=uSunCol*(kd*mix(0.08,1.0,sh)+D*Vs*F*NL*sh*(mode==1?0.5:1.0));
   if(mode==2){float Dc=D_GGX(NH,0.02);col+=uSunCol*Dc*0.25*pow(1.0-VH,2.0)*NL*sh;}}
  // fills: stadium towers (point lights with a soft downward cone)
  for(int i=0;i<4;i++){vec3 Lv=uLP[i].xyz-vW;float dist=length(Lv);vec3 L=Lv/max(dist,0.1);
   float att=uLP[i].w/(dist*dist+40.0);float cone=0.35+0.65*clamp(L.y*1.6,0.0,1.0);
   float nl=max(dot(N,L),0.0);if(mode==1)nl=clamp((dot(N,L)+0.3)/1.3,0.0,1.0)*0.9;
   vec3 H=normalize(V+L);float NH=max(dot(N,H),0.0),VH=max(dot(V,H),0.0);vec3 F=F_Schlick(F0,VH);
   float ar=clamp(a+2.6/dist,a,1.0);float D=D_GGX(NH,ar)*(a*a)/(ar*ar);float Vs=V_Smith(NV,nl,ar);
   col+=uLC[i]*att*cone*(diff*(1.0-F)/3.14159*nl*ao+D*Vs*F*nl*ao*specOcc*(mode==2?1.6:1.0));}
  // ambient: hemisphere diffuse + cubemap specular
  float hemi=N.y*0.5+0.5;vec3 amb=mix(uGndC,uAmbC,hemi);
  col+=amb*diff*ao*cav;
  vec3 R=reflect(-V,N);float lod=rough*5.5;
  vec3 env=textureCube(uEnv,R,lod).rgb*uEnvK;
  vec3 kS=envBRDF(F0,rough,NV);
  col+=env*kS*ao*specOcc*(mode==2?1.35:1.0);
  if(mode==2){vec3 envC=textureCube(uEnv,R,0.5).rgb*uEnvK;float fr=pow(1.0-NV,4.0);col+=envC*(0.04+0.6*fr)*0.6*ao*specOcc;}
  return col;
}
vec3 fogIt(vec3 c){float d=distance(vW,uEye);float f=clamp((d-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);f=f*f*uFogR.z;return mix(c,uFog,f);}
#ifdef DERIV
// tangent frame from screen-space derivatives (no tangent attributes)
mat3 cotangent(vec3 N,vec3 p,vec2 uv){vec3 dp1=dFdx(p),dp2=dFdy(p);vec2 duv1=dFdx(uv),duv2=dFdy(uv);vec3 dp2perp=cross(dp2,N),dp1perp=cross(N,dp1);vec3 T=dp2perp*duv1.x+dp1perp*duv2.x;vec3 B=dp2perp*duv1.y+dp1perp*duv2.y;float invmax=inversesqrt(max(dot(T,T),dot(B,B))+1e-9);return mat3(T*invmax,B*invmax,N);}
vec3 perturb(vec3 N,vec3 p,vec2 uv,vec3 nm,float k){nm=nm*2.0-1.0;nm.xy*=k;return normalize(cotangent(N,p,uv)*normalize(nm));}
#else
vec3 perturb(vec3 N,vec3 p,vec2 uv,vec3 nm,float k){return N;}
#endif
`;
  // ---- world geometry: statics, props, ball, markers. aC.a: alpha for unlit, 'emis' material draws unlit ----
  const VS_WORLD = `attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute vec2 aT;
uniform mat4 uVP;uniform HP vec3 uEye;uniform vec2 uUV;uniform HP vec3 uCamF;uniform float uFlipV;
varying vec4 vC;varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vVD;varying float vLit;
void main(){vW=aP;vN=aN;vLit=dot(aN,aN)>0.01?1.0:0.0;gl_Position=uVP*vec4(aP,1.0);vC=aC;vT=vec2(aT.x,mix(aT.y,1.0-aT.y,uFlipV))+uUV;vVD=dot(aP-uEye,uCamF);}`;
  // uMatW: x rough, y metal, z detail/wet, w emissive. uKind: 0 plain, 1 field (turf detail + wet), 2 fabric normal map (tex alpha = roughness mod)
  const FS_WORLD = `uniform sampler2D uTex;uniform sampler2D uDetail;uniform sampler2D uNrm;uniform vec4 uMatW;uniform float uKind;uniform float uWet;
varying vec4 vC;varying vec2 vT;varying float vLit;
#LIB#
void main(){vec4 t=texture2D(uTex,vT);vec3 base=toLin(vC.rgb*t.rgb);
if(uKind>8.5){gl_FragColor=vec4(vec3(shadowAt(normalize(vN),1.0)),1.0);return;}
if(vLit<0.5){float ta=uKind>7.5?t.a:1.0;gl_FragColor=vec4(uMatW.w>0.5?base*uMatW.w*(vC.a):fogIt(base),uMatW.w>0.5?1.0:vC.a*ta);return;}
vec3 N=normalize(vN);float rough=uMatW.x,metal=uMatW.y,ao=1.0,cav=1.0,specOcc=1.0;
if(uKind>0.5&&uKind<1.5){
  // turf: blade-scale detail (colour + normal) fades with distance, mow-stripe sheen, wet puddles in rain
  float d=distance(vW,uEye);float dk=1.0-smoothstep(12.0,70.0,d);
  vec2 duv=vW.xz*0.9;vec4 det=texture2D(uDetail,duv);vec4 det2=texture2D(uDetail,duv*0.23+0.37);
  float h=mix(0.5,det.a,dk)*0.6+det2.a*0.4;
  base*=mix(1.0,0.72+0.56*det.r,dk*0.9)*(0.86+0.28*det2.r);
  vec3 nm=vec3(det.g,det.b,1.0);N=perturb(N,vW,duv,nm,0.55*dk);
  cav=0.75+0.5*h;rough=mix(0.9,0.55,h*0.3);
  if(uWet>0.0){float pud=smoothstep(0.52,0.62,det2.g*0.7+det.g*0.3+0.05*sin(vW.x*0.7)*sin(vW.z*0.5))*uWet;
    vec3 rip=vec3(sin(vW.x*31.0+uTime*3.0)*0.5+0.5,cos(vW.z*27.0-uTime*2.4)*0.5+0.5,1.0);N=normalize(mix(N,perturb(vec3(0.0,1.0,0.0),vW,duv,rip,0.08),pud));
    rough=mix(mix(rough,0.35,uWet*0.7),0.06,pud);base*=mix(1.0,0.55,uWet*0.5+pud*0.3);metal=mix(metal,0.0,pud);specOcc=mix(1.0,2.2,pud);}
}else if(uKind>1.5){vec3 nm=texture2D(uNrm,vT*uMatW.z).rgb;N=perturb(N,vW,vT,nm,0.6);rough=rough*(0.7+0.6*t.a);}
vec3 col=shadePBR(base,N,rough,metal,ao,cav,0,specOcc);
if(uMatW.w>0.0)col+=base*uMatW.w;
gl_FragColor=vec4(fogIt(col),1.0);}`;
  // ---- skinned athletes: two bone weights per vertex ----
  // slots (SL): 0 jer 1 pant 2 skin 3 helm 4 trim 5 cleat 6 pad 7 mask 8 num 9 face 10 arm 11 name 12 glove 13 sock 14 sole 15 visor 16 snum 17 wht 18 eye 19 tape 20 towel 21 stripes
  const VS_SKIN = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aB;attribute float aW;attribute float aS;attribute vec2 aT;attribute float aA;
uniform vec4 uBones[51];uniform vec3 uScale;uniform mat4 uVP;uniform HP vec3 uEye;uniform HP vec3 uCamF;uniform vec4 uNumUV;uniform HP vec4 uFaceUV;uniform vec4 uNameUV;uniform float uVis;uniform float uTowel;uniform float uSway;uniform float uMouth;uniform vec4 uFxV;
varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vVD;varying float vS;varying float vA;varying vec3 vP;
vec3 skinP(int b,vec4 p){return vec3(dot(uBones[b],p),dot(uBones[b+1],p),dot(uBones[b+2],p));}
vec3 skinN(int b,vec3 n){return vec3(dot(uBones[b].xyz,n),dot(uBones[b+1].xyz,n),dot(uBones[b+2].xyz,n));}
void main(){int b0=int(aB.x)*3;int b1=int(aB.y)*3;int s=int(aS);vec3 lp=aP*uScale;
if((s==15&&uVis<0.5)||(s==20&&uTowel<0.5)||(s==22&&uMouth<0.5))lp=vec3(0.0);
if(s==20){float k=clamp(-aP.y*4.0,0.0,1.0);lp.z+=uSway*k*k;lp.x+=uSway*0.35*k;}
lp+=aN*uFxV.x;
vec4 p=vec4(lp,1.0);float w0=aW,w1=1.0-aW;
vec3 w=skinP(b0,p)*w0+skinP(b1,p)*w1;vec3 n=normalize(skinN(b0,aN)*w0+skinN(b1,aN)*w1);
bool num=(s==8||s==16);
vT=num?uNumUV.xy+aT*uNumUV.zw:(s==11?uNameUV.xy+aT*uNameUV.zw:(s==9?uFaceUV.xy+aT*uFaceUV.zw:aT));
vS=aS;vA=aA;vP=aP;vW=w;vN=n;gl_Position=uVP*vec4(w,1.0);vVD=dot(w-uEye,uCamF);}`;
  const FS_SKIN = `uniform sampler2D uTex;uniform sampler2D uKit;uniform sampler2D uNrm;uniform HP vec4 uFaceUV;uniform vec3 uCol[23];uniform float uAlpha;uniform float uWet;uniform float uDirt;uniform vec3 uDirtC;uniform vec3 uGaze;uniform float uSweat;uniform float uSeed;uniform vec4 uFx;uniform vec3 uFxC;
varying vec2 vT;varying float vS;varying float vA;varying vec3 vP;
#LIB#
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){int s=int(vS+0.5);vec3 base;float rough=0.6,metal=0.0,alpha=1.0;int mode=0;float specOcc=1.0;float ao=vA;
vec3 N=normalize(vN);vec3 c=uCol[s];
bool kit=(s==0||s==1||s==3||s==12||s==13||s==21);bool numS=(s==8||s==16);
vec4 t=vec4(1.0);
if(kit){t=texture2D(uKit,vT);base=toLin(t.rgb);}
else if(s==9){t=texture2D(uTex,vT);base=toLin(t.rgb);}
else if(numS||s==11){t=texture2D(uTex,vT);if(t.a<0.45)discard;base=toLin(c*t.rgb);}
else base=toLin(c);
if(s==0||s==1||s==13||s==21||s==10||s==12||numS||s==11){ // fabrics: woven normal map, roughness from the kit alpha
  float scale=(s==1?7.0:(s==13?9.0:5.0));vec3 nm=texture2D(uNrm,vT*scale).rgb;N=perturb(N,vW,vT,nm,s==1?0.35:0.55);
  rough=(s==1?0.55:(s==13?0.85:0.72))*(0.75+0.5*t.a);
  if(numS||s==11){rough=0.42;N=normalize(vN);}
  if(s==10){rough=0.7;}
  // grass and mud stains build up on players who have been tackled
  if(uDirt>0.0&&(s==0||s==1||s==13||numS)){float n=noise(vT*18.0+uSeed)*0.6+noise(vT*47.0+uSeed*3.0)*0.4;float st=smoothstep(0.62-uDirt*0.3,0.9,n)*uDirt*(s==1?1.0:0.6)*(1.0-smoothstep(0.1,0.85,vT.y)*0.3);base=mix(base,uDirtC*(0.6+0.4*n),st);rough=mix(rough,0.95,st);}
}
if(s==2||s==9){mode=1;rough=mix(0.55,0.3,uSweat);specOcc=0.6+0.5*uSweat;if(s==9){ // face: photo blended into skin at the edges
  vec2 q=(vT-uFaceUV.xy)/uFaceUV.zw;float m=1.0-smoothstep(0.44,0.8,length((q-vec2(0.5,0.5))*vec2(1.0,0.8))*2.0);base=mix(toLin(uCol[2]),base,m*t.a);}}
if(s==18){ // eyes: sclera with an iris that looks along uGaze
  float g=dot(N,normalize(uGaze));float ir=smoothstep(0.80,0.86,g),pu=smoothstep(0.955,0.965,g);
  base=mix(vec3(0.78,0.72,0.68),mix(c*0.5,c*0.15,smoothstep(0.86,0.95,g)),ir);base=mix(base,vec3(0.01),pu);rough=0.08;specOcc=2.5;}
if(s==3){mode=2;rough=0.14;}
if(s==7){rough=0.45;metal=0.0;}
if(s==4){rough=0.7;}
if(s==5){rough=0.38;specOcc=1.2;}
if(s==14){rough=0.8;}
if(s==6){rough=0.5;}
if(s==17||s==19){rough=0.78;}
if(s==22){rough=0.25;specOcc=1.5;}
if(s==15){rough=0.05;base=mix(base,vec3(0.02,0.025,0.03),0.7);alpha=uAlpha;specOcc=2.0;metal=0.3;}
if(s==20){rough=0.9;}
if(uWet>0.0&&(s==3||s==0||s==1||s==2||s==5||s==9)){rough=mix(rough,0.18,uWet*0.5);}
// card effects (uFx: mode, strength, time, seed; uFxC: colour)
vec3 emis=vec3(0.0);float fm=uFx.x,fk=uFx.y,ft=uFx.z;
if(fm>0.5){vec3 V=normalize(uEye-vW);float fres=pow(1.0-abs(dot(N,V)),2.0);float lum=dot(base,vec3(0.3,0.59,0.11));bool skinS=(s==2||s==9||s==10||s==18);
 if(fm>19.5){float rim=pow(fres,1.5);gl_FragColor=vec4(uFxC*fk*(0.1+rim*1.8),clamp(rim*1.3,0.0,1.0)*min(fk,1.0));return;}
 else if(fm<1.5){base=mix(base,vec3(0.2,0.14,0.08)+lum*vec3(1.15,0.92,0.62),0.85*fk);}
 else if(fm<2.5){base=mix(base,vec3(0.62,0.45,0.26)*(0.6+0.6*lum),0.85*fk);rough=1.0;specOcc=0.2;
#ifdef DERIV
  vec3 fn=normalize(cross(dFdx(vW),dFdy(vW)));N=dot(fn,V)<0.0?-fn:fn;
#endif
 }
 else if(fm<3.5){float n=noise(vT*vec2(90.0,30.0)+uSeed);base=mix(base,vec3(0.05,0.11,0.08)+lum*0.15,0.8*fk);emis+=vec3(0.8,0.9,0.85)*smoothstep(0.72,0.86,n)*0.35*fk;}
 else if(fm<4.5){vec2 g=fract(vec2(vP.y*22.0,(vP.x+vP.z)*16.0));float ln=max(step(0.9,g.x),step(0.9,g.y));base=mix(base,vec3(0.03,0.1,0.32),0.9*fk);emis+=vec3(0.35,0.65,1.3)*ln*fk;rough=0.9;}
 else if(fm<5.5){vec2 c=floor(vT*vec2(6.0,9.0));float h=hash(c+uSeed);vec2 e=fract(vT*vec2(6.0,9.0));float lead=step(0.9,max(e.x,e.y));vec3 pc=0.5+0.5*cos(6.2832*(h+vec3(0.0,0.33,0.67)));if(!skinS){base=mix(base,pc*0.7,0.8*fk*(1.0-lead));base*=1.0-lead*0.85;emis+=pc*0.25*fk*(1.0-lead);}}
 else if(fm<6.5){if(!skinS){base=mix(base,uFxC,0.6*fk);metal=0.85;rough=mix(rough,0.22,fk);specOcc=1.6;}}
 else if(fm<7.5){base=mix(base,vec3(0.15,0.75,0.95)*(0.4+lum),0.75*fk);emis+=vec3(0.2,0.9,1.2)*(0.25+0.25*sin(vW.y*90.0-ft*8.0))*fk;}
 else if(fm<8.5){base=floor(base*5.0+0.5)/5.0;vec2 g=fract(vT*48.0);base*=1.0-0.35*step(0.86,max(g.x,g.y))*fk;}
 else if(fm<9.5){float gl=step(0.86,fract(ft*2.3+uSeed));base=mix(base,base.gbr,gl*fk);emis+=vec3(1.0,0.1,0.9)*gl*0.5*fk*step(0.5,fract(vW.y*12.0+ft*20.0));}
 else if(fm<10.5){vec3 rb=0.5+0.5*cos(6.2832*(fract(vP.y*1.2-ft*0.4)+vec3(0.0,0.33,0.67)));if(!skinS)base=mix(base,rb,0.6*fk);emis+=rb*0.12*fk;}
 else if(fm<11.5){if(skinS&&s!=18)emis+=uFxC*(0.5+0.45*sin(ft*5.0))*fk;}
 else if(fm<12.5){base*=mix(1.0,0.28,fk);emis+=uFxC*fres*1.4*fk;}
 else if(fm<13.5){vec3 ir=0.5+0.5*cos(6.2832*(fres*1.5+vP.y*0.6+ft*0.15+vec3(0.0,0.33,0.67)));if(!skinS){base=mix(base,ir,0.45*fk);metal=0.55;rough=0.2;}emis+=ir*fres*0.5*fk;}
 else if(fm<14.5){base=mix(base,vec3(lum),0.9*fk);}
 else if(fm<15.5){if(!skinS)base=mix(base,vec3(0.9)-base*0.85,0.8*fk);}
 else if(fm<16.5){if(!skinS)base*=mix(1.0,0.35,fk);if(s==4||s==21||s==8||s==16||s==3)emis+=uFxC*1.5*fk;}
 else if(fm<17.5){float st=hash(floor(gl_FragCoord.xy*0.5)+floor(ft*24.0));base=mix(base,vec3(st),0.3*fk);}
 else if(fm<18.5){if(!skinS){base=mix(base,vec3(0.72,0.88,1.0),0.45*fk);rough=0.12;metal=0.25;specOcc=1.8;}}
 else{float sp=step(0.985,hash(floor(vT*120.0)+floor(ft*6.0)));emis+=uFxC*sp*2.0*fk;}
}
vec3 col=shadePBR(base,N,rough,metal,ao,1.0,mode,specOcc)+emis;
gl_FragColor=vec4(fogIt(col),alpha);}`;
  // ---- depth-only passes (shadow cascades) ----
  const VS_DEPTH_W = `attribute vec3 aP;uniform mat4 uLVP;void main(){gl_Position=uLVP*vec4(aP,1.0);}`;
  const VS_DEPTH_S = `attribute vec3 aP;attribute vec2 aB;attribute float aW;attribute float aS;uniform vec4 uBones[51];uniform vec3 uScale;uniform mat4 uLVP;uniform float uVis;uniform float uTowel;uniform float uMouth;
void main(){int b0=int(aB.x)*3;int b1=int(aB.y)*3;vec3 lp=aP*uScale;if((aS>14.5&&aS<15.5&&uVis<0.5)||(aS>19.5&&aS<20.5&&uTowel<0.5)||(aS>21.5&&aS<22.5&&uMouth<0.5))lp=vec3(0.0);vec4 p=vec4(lp,1.0);
vec3 w=vec3(dot(uBones[b0],p),dot(uBones[b0+1],p),dot(uBones[b0+2],p))*aW+vec3(dot(uBones[b1],p),dot(uBones[b1+1],p),dot(uBones[b1+2],p))*(1.0-aW);gl_Position=uLVP*vec4(w,1.0);}`;
  const FS_DEPTH_PACK = `precision mediump float;void main(){vec4 e=fract(gl_FragCoord.z*vec4(1.0,255.0,65025.0,16581375.0));gl_FragColor=e-e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);}`;
  const FS_DEPTH_NONE = `precision mediump float;void main(){gl_FragColor=vec4(1.0);}`;
  const VS_QUAD = `attribute vec2 aP;varying vec2 vUV;void main(){vUV=aP*0.5+0.5;gl_Position=vec4(aP,0.999,1.0);}`;
  // ---- sky: gradient haze, light-pollution glow above the bowl, faint stars; day variant with sun and clouds ----
  const FS_SKY = `uniform mat4 uInvVP;uniform vec3 uSun;uniform float uNight;uniform float uTime;uniform vec3 uTop;uniform vec3 uHor;uniform float uCloud;uniform float uGlow;varying vec2 vUV;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
vec3 toLin(vec3 c){return c*(c*(c*0.305306011+0.682171111)+0.012522878);}
void main(){vec4 a=uInvVP*vec4(vUV*2.0-1.0,1.0,1.0);vec4 b=uInvVP*vec4(vUV*2.0-1.0,-1.0,1.0);vec3 d=normalize(a.xyz/a.w-b.xyz/b.w);
float h=clamp(d.y,0.0,1.0);vec3 col=mix(toLin(uHor),toLin(uTop),pow(h,0.5));
if(uNight>0.5){vec2 sp=d.xz/max(d.y,0.03)*70.0;float st=step(0.992,hash(floor(sp)))*smoothstep(0.1,0.4,d.y)*(0.3+0.7*hash(floor(sp)+7.0));col+=vec3(0.7,0.78,1.0)*st*0.35;
  col+=toLin(uHor)*uGlow*0.9*pow(1.0-h,6.0);}
else{float s=max(dot(d,uSun),0.0);float disc=smoothstep(0.9992,0.9997,s);col+=vec3(1.0,0.95,0.85)*disc*40.0+vec3(1.0,0.8,0.5)*pow(s,12.0)*0.35+vec3(0.9,0.9,1.0)*pow(s,2.0)*0.12;}
if(d.y>0.0&&uCloud>0.0){vec2 cp=d.xz/(d.y+0.12)*1.6+vec2(uTime*0.012,0.0);float n=noise(cp)*0.5+noise(cp*2.3+3.1)*0.26+noise(cp*4.9+9.0)*0.14+noise(cp*9.7+2.0)*0.1;
float c=smoothstep(0.45,0.68,n)*uCloud*smoothstep(0.0,0.2,d.y);vec3 cc=uNight>0.5?toLin(uHor)*0.5:mix(vec3(0.5,0.52,0.58),vec3(1.4),smoothstep(0.5,0.85,n));col=mix(col,cc,c*0.9);}
gl_FragColor=vec4(col,1.0);}`;
  // ---- crowd: one quad per fan; 3 states (seated / standing / slumped) selected per fan by excitement and mood ----
  const VS_CROWD = `attribute vec3 aP;attribute vec3 aC;attribute vec4 aM;attribute vec2 aT;uniform mat4 uVP;uniform float uTime;uniform float uExcite;uniform float uWave;uniform float uMood;uniform HP vec3 uEye;uniform HP vec3 uCamF;
varying vec3 vC;varying vec2 vT;varying vec3 vW;varying float vVD;varying float vPh;varying float vUp;
void main(){float ph=aM.x;float amp=aM.y;float thr=aM.z;float up=1.0-aT.y;
float stand=step(thr,uExcite);float slump=step(0.5,-uMood)*(1.0-stand)*step(thr,0.6);
float bob=max(0.0,sin(uTime*2.6+ph))*amp*(0.35+0.9*uExcite)*(0.5+stand);
float wv=max(0.0,sin(uTime*1.8-aP.z*0.07+aP.x*0.02))*uWave*amp*3.0;vec3 p=aP;
p.y+=(bob+wv)*(0.4+0.6*up)+stand*0.45*up;p.x+=sin(uTime*1.3+ph)*0.03*up*(1.0+stand);
vC=aC;vT=vec2(aT.x+(stand*1.0+slump*2.0)/3.0,aT.y);vW=p;vPh=aM.w*step(0.35,uExcite)*step(0.5,fract(uTime*0.8+ph));vUp=up;gl_Position=uVP*vec4(p,1.0);vVD=dot(p-uEye,uCamF);}`;
  const FS_CROWD = `uniform sampler2D uTex;uniform vec3 uFog;uniform vec3 uFogR;uniform HP vec3 uEye;uniform float uDim;uniform vec3 uTint;varying vec3 vC;varying vec2 vT;varying vec3 vW;varying float vPh;varying float vUp;
vec3 toLin(vec3 c){return c*(c*(c*0.305306011+0.682171111)+0.012522878);}
void main(){vec4 t=texture2D(uTex,vT);if(t.a<0.35)discard;vec3 c=toLin(t.a>0.8?t.rgb*vC:t.rgb);
c*=uDim*uTint*(0.75+0.5*vUp);
if(vPh>0.5&&t.a<0.8&&t.a>0.55)c+=vec3(1.2,1.2,1.4);
float d=distance(vW,uEye);float f=clamp((d-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);f=f*f*uFogR.z;gl_FragColor=vec4(mix(c,uFog,f),1.0);}`;
  // ---- instanced grass blades around the camera target ----
  const VS_GRASS = `attribute vec3 aP;attribute vec2 aT;attribute vec4 aI;uniform mat4 uVP;uniform HP vec3 uEye;uniform HP vec3 uCamF;uniform vec3 uOrg;uniform float uTime;uniform vec4 uPl[12];uniform float uCell;uniform float uN;uniform float uWet;
varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vVD;varying float vK;varying float vFade;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){float i=aI.x;float row=floor(i/uN);float colI=i-row*uN;vec2 cell=vec2(colI,row);
vec2 g=floor(uOrg.xz/uCell)+cell-uN*0.5;vec2 jit=vec2(hash(g),hash(g+3.7));vec2 xz=(g+jit)*uCell;
float ang=hash(g+9.1)*6.2832;float hgt=0.035+0.045*hash(g+1.3);float lean=0.3+0.4*hash(g+5.5);
float y=aP.y*hgt;float t=aP.y;
vec2 dir=vec2(cos(ang),sin(ang));
vec3 p=vec3(xz.x+aP.x*dir.y*0.011,y,xz.y-aP.x*dir.x*0.011);
// bend: wind + lean, flattened under players' feet
vec2 wind=vec2(sin(uTime*1.7+xz.x*0.5+xz.y*0.3),cos(uTime*1.3+xz.y*0.6))*0.03;
vec2 bend=dir*lean*t*t*0.09+wind*t*t;
float fl=0.0;vec2 fd=vec2(0.0);
for(int k=0;k<12;k++){vec2 dxz=xz-uPl[k].xy;float dd=length(dxz);float f=uPl[k].z*(1.0-smoothstep(0.0,0.55,dd));if(f>fl){fl=f;fd=dxz/max(dd,0.05);}}
bend+=fd*fl*t*0.22;p.y*=1.0-fl*0.8;
p.xz+=bend;
float dc=distance(p,uEye);vFade=1.0-smoothstep(6.0,10.0,dc);
vK=0.7+0.4*hash(g+2.2);vT=aT;vW=p;vN=normalize(vec3(-bend.x*0.5,1.0,-bend.y*0.5));gl_Position=uVP*vec4(p,1.0);vVD=dot(p-uEye,uCamF);}`;
  const FS_GRASS = `uniform sampler2D uTex;uniform vec3 uFog;uniform vec3 uFogR;uniform HP vec3 uEye;uniform vec3 uBase;uniform vec3 uAmbC;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec4 uLP[4];uniform vec3 uLC[4];
varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vK;varying float vFade;
void main(){if(vFade<0.02)discard;vec3 f=texture2D(uTex,vec2(vW.x*0.5,vW.z*0.5)*0.0+vec2(0.5)).rgb;
vec3 base=uBase*vK*(0.55+0.4*vT.y);
vec3 N=normalize(vN);float nl=max(dot(N,uSunDir),0.0)*0.6+0.4;
vec3 col=base*(uAmbC*0.8+uSunCol*nl*0.55);
for(int i=0;i<4;i++){vec3 Lv=uLP[i].xyz-vW;float dist=length(Lv);float att=uLP[i].w/(dist*dist+40.0);col+=base*uLC[i]*att*0.5;}
float d=distance(vW,uEye);float fg=clamp((d-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0);fg=fg*fg*uFogR.z;
gl_FragColor=vec4(mix(col,uFog,fg),vFade);}`;
  // ---- post ----
  const FS_AO = `uniform sampler2D uDepth;uniform vec2 uPx;uniform mat4 uInvP;uniform vec4 uProj;uniform float uRad;varying vec2 vUV;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
vec3 posAt(vec2 uv){float z=texture2D(uDepth,uv).r;vec4 p=uInvP*vec4(uv*2.0-1.0,z*2.0-1.0,1.0);return p.xyz/p.w;}
void main(){vec3 P=posAt(vUV);if(-P.z>160.0){gl_FragColor=vec4(1.0);return;}
vec3 dx=posAt(vUV+vec2(uPx.x,0.0))-P,dy=posAt(vUV+vec2(0.0,uPx.y))-P;vec3 N=normalize(cross(dx,dy));
float r=uRad;float a=ign(gl_FragCoord.xy)*6.2832;float ca=cos(a),sa=sin(a);
vec3 T=normalize(vec3(ca,sa,0.0)-N*dot(vec3(ca,sa,0.0),N));vec3 B=cross(N,T);
float occ=0.0;
#define S(kx,ky,kz) {vec3 s=P+(T*kx+B*ky+N*kz)*r;vec4 c=vec4(s.x*uProj.x,s.y*uProj.y,s.z,1.0);vec2 suv=vec2(c.x/-s.z,c.y/-s.z)*0.5+0.5;float sz=posAt(suv).z;float rc=smoothstep(0.0,1.0,r/abs(P.z-sz+1e-4));occ+=step(s.z+0.02,sz)*rc;}
S(0.2,0.1,0.3)S(-0.3,0.2,0.5)S(0.1,-0.4,0.6)S(0.5,0.3,0.2)S(-0.1,-0.1,0.9)S(0.6,-0.5,0.4)S(-0.6,-0.2,0.7)S(0.3,0.7,0.5)S(-0.4,0.6,0.3)S(0.0,0.3,0.95)S(0.8,0.1,0.5)S(-0.7,-0.6,0.3)
occ=1.0-occ/12.0;gl_FragColor=vec4(vec3(occ),1.0);}`;
  const FS_BLUR4 = `uniform sampler2D uTex;uniform vec2 uPx;varying vec2 vUV;
void main(){float s=0.0;for(int i=-2;i<2;i++)for(int j=-2;j<2;j++)s+=texture2D(uTex,vUV+vec2(float(i)+0.5,float(j)+0.5)*uPx).r;gl_FragColor=vec4(vec3(s/16.0),1.0);}`;
  const FS_EXTRACT = `uniform sampler2D uTex;uniform vec2 uPx;uniform float uThr;varying vec2 vUV;
void main(){vec3 c=(texture2D(uTex,vUV).rgb+texture2D(uTex,vUV+vec2(uPx.x,0.0)).rgb+texture2D(uTex,vUV+vec2(0.0,uPx.y)).rgb+texture2D(uTex,vUV+uPx).rgb)*0.25;
float l=max(c.r,max(c.g,c.b));float k=max(l-uThr,0.0)/(l+1e-4);gl_FragColor=vec4(c*k*0.25,1.0);}`;
  const FS_BLUR = `uniform sampler2D uTex;uniform vec2 uDir;varying vec2 vUV;
void main(){vec3 c=texture2D(uTex,vUV).rgb*0.227;c+=(texture2D(uTex,vUV+uDir*1.385).rgb+texture2D(uTex,vUV-uDir*1.385).rgb)*0.316;c+=(texture2D(uTex,vUV+uDir*3.23).rgb+texture2D(uTex,vUV-uDir*3.23).rgb)*0.07;gl_FragColor=vec4(c,1.0);}`;
  // depth of field + camera motion blur, HDR in / HDR out
  const FS_DOFMB = `uniform sampler2D uTex;uniform sampler2D uDepth;uniform vec2 uPx;uniform mat4 uInvVP;uniform mat4 uPrevVP;uniform float uMB;uniform vec3 uDof;uniform vec2 uNF;varying vec2 vUV;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
float linZ(float z){float zn=z*2.0-1.0;return 2.0*uNF.x*uNF.y/(uNF.y+uNF.x-zn*(uNF.y-uNF.x));}
void main(){float z=texture2D(uDepth,vUV).r;float d=linZ(z);
vec4 wp=uInvVP*vec4(vUV*2.0-1.0,z*2.0-1.0,1.0);wp/=wp.w;
vec4 pp=uPrevVP*wp;vec2 puv=pp.xy/pp.w*0.5+0.5;vec2 vel=(vUV-puv)*uMB;float vl=length(vel);if(vl>0.05)vel*=0.05/vl;
float coc=clamp((abs(d-uDof.x)-0.14*uDof.x)/max(uDof.x,1.0)*uDof.y,0.0,1.0)*step(0.01,uDof.y);
vec2 r=coc*uPx*10.0;float a=ign(gl_FragCoord.xy)*6.2832;vec2 R=vec2(cos(a),sin(a));
vec3 c=vec3(0.0);float n=0.0;
#define T(o) {vec2 q=vec2(o.x*R.x-o.y*R.y,o.x*R.y+o.y*R.x);c+=texture2D(uTex,vUV+q*r).rgb;n+=1.0;}
T(vec2(0.0,0.0))T(vec2(-0.613,0.617))T(vec2(0.170,-0.040))T(vec2(-0.299,-0.791))T(vec2(0.645,0.493))T(vec2(-0.651,-0.195))T(vec2(0.421,-0.712))T(vec2(-0.102,0.962))T(vec2(0.946,-0.152))T(vec2(0.3,0.3))T(vec2(-0.3,-0.3))T(vec2(0.0,-0.6))
c/=n;
if(uMB>0.0){vec3 m=vec3(0.0);for(int i=0;i<6;i++){float t=(float(i)+0.5)/6.0-0.5;m+=texture2D(uTex,vUV+vel*t).rgb;}c=mix(c,m/6.0,0.75*min(1.0,vl*60.0));}
gl_FragColor=vec4(c,1.0);}`;
  const FS_FINAL = `uniform sampler2D uTex;uniform sampler2D uBloom;uniform sampler2D uAO;uniform sampler2D uDepth;uniform vec2 uPx;uniform float uBloomK;uniform float uFxaa;uniform float uVig;uniform float uKick;uniform float uExp;uniform float uAOk;uniform vec4 uFl[4];uniform float uFlK;uniform float uTime;uniform float uLDR;uniform float uAsp;varying vec2 vUV;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
vec3 tm(vec3 c){c*=uExp;return aces(c);}
vec3 S(vec2 uv){vec3 c=texture2D(uTex,uv).rgb;return tm(c);}
vec3 fxaa(vec2 uv){vec3 rgbNW=S(uv+vec2(-1.0,-1.0)*uPx);vec3 rgbNE=S(uv+vec2(1.0,-1.0)*uPx);vec3 rgbSW=S(uv+vec2(-1.0,1.0)*uPx);vec3 rgbSE=S(uv+vec2(1.0,1.0)*uPx);vec3 rgbM=S(uv);
vec3 lm=vec3(0.299,0.587,0.114);float lNW=dot(rgbNW,lm),lNE=dot(rgbNE,lm),lSW=dot(rgbSW,lm),lSE=dot(rgbSE,lm),lM=dot(rgbM,lm);
float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE)));float lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));float dr=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125);float rc=1.0/(min(abs(dir.x),abs(dir.y))+dr);
dir=min(vec2(8.0),max(vec2(-8.0),dir*rc))*uPx;
vec3 A=0.5*(S(uv+dir*(1.0/3.0-0.5))+S(uv+dir*(2.0/3.0-0.5)));vec3 B=A*0.5+0.25*(S(uv+dir*-0.5)+S(uv+dir*0.5));
float lB=dot(B,lm);return (lB<lMin||lB>lMax)?A:B;}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
void main(){vec3 c=uFxaa>0.5?fxaa(vUV):S(vUV);
float ao=uAOk>0.0?mix(1.0,texture2D(uAO,vUV).r,uAOk):1.0;c*=ao;
vec3 bl=texture2D(uBloom,vUV).rgb*4.0;c+=tm(bl*uBloomK*1.5)*0.6*step(0.01,uBloomK);
// lens flare ghosts for stadium lights in frame
if(uFlK>0.0){vec2 cen=vUV-0.5;for(int i=0;i<4;i++){vec4 L=uFl[i];if(L.z<=0.0)continue;vec2 l=L.xy-0.5;vec2 ax=vec2(1.0,1.0/uAsp);
  float occ=L.w;vec2 dv=(cen-l)*ax;float dd=length(dv);
  float core=exp(-dd*dd*220.0)*1.4+exp(-dd*55.0)*0.35;
  float streak=exp(-abs(dv.y)*260.0)*exp(-abs(dv.x)*9.0)*0.5;
  float g=0.0;for(int k=1;k<4;k++){vec2 gp=-l*(0.4*float(k)+0.2);float gd=length((cen-gp)*ax);g+=exp(-gd*gd*(400.0+200.0*float(k)))*0.18/float(k);}
  c+=vec3(1.0,0.95,0.85)*(core+streak)*occ*uFlK*L.z+vec3(0.6,0.8,1.0)*g*occ*uFlK*L.z;}}
vec2 q=vUV-0.5;float v=1.0-dot(q,q)*uVig;c*=v;c+=uKick*vec3(1.0,0.95,0.8)*(1.0-smoothstep(0.0,0.6,length(q)));
c=pow(max(c,0.0),vec3(1.0/2.2));
c+=(ign(gl_FragCoord.xy+fract(uTime)*99.0)-0.5)*0.012;
gl_FragColor=vec4(c,1.0);}`;

  // =====================================================================================
  // Characters: skeleton, skinned mesh, keyframed clips, blending, arm IK and a light ragdoll
  // =====================================================================================
  // bone: parent index and offset from the parent joint (yards, unscaled); legs and arms hang along -Y in the bind pose
  const BONES = [
    ['hips', -1, 0, 0, 0], ['spine', 0, 0, 0.16, 0], ['chest', 1, 0, 0.24, 0], ['neck', 2, 0, 0.3, 0], ['head', 3, 0, 0.08, 0],
    ['shL', 2, -0.3, 0.24, 0], ['elL', 5, 0, -0.36, 0], ['haL', 6, 0, -0.32, 0],
    ['shR', 2, 0.3, 0.24, 0], ['elR', 8, 0, -0.36, 0], ['haR', 9, 0, -0.32, 0],
    ['hipL', 0, -0.15, -0.03, 0], ['knL', 11, 0, -0.5, 0], ['ftL', 12, 0, -0.47, 0],
    ['hipR', 0, 0.15, -0.03, 0], ['knR', 14, 0, -0.5, 0], ['ftR', 15, 0, -0.47, 0],
  ];
  const NB = BONES.length, B = {};
  BONES.forEach((b, i) => { B[b[0]] = i; });
  const LEGB = new Float32Array(NB); for (const k of ['knL', 'ftL', 'knR', 'ftR']) LEGB[B[k]] = 1;
  const HIP_H = 1.08; // standing hip height (unscaled)
  // ---------- poses ----------
  const PN = NB * 3, PLEN = PN + 4; // + rootY, pitch, roll, yaw
  const RX = (m, a) => (a ? mRX(m, a) : m), RY = (m, a) => (a ? mRY(m, a) : m), RZ = (m, a) => (a ? mRZ(m, a) : m);
  const newPose = () => new Float32Array(PLEN);
  // build a pose from {boneName:[rx,ry,rz]} plus root extras
  // limb X rotations are authored as "positive swings the limb forward" (arm raise, thigh lift, elbow/knee flexion is
  // positive for the arm and negative for the knee); the raw rotation of a bone that hangs along -Y goes the other way
  const LIMB_FLIP = new Float32Array(NB); for (const k of ['shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'hipL', 'knL', 'hipR', 'knR']) LIMB_FLIP[B[k]] = 1;
  function pb(o, rootY, pitch, roll, yaw) {
    const q = newPose();
    for (const k in o) { const i = B[k] * 3, v = o[k], bi = B[k]; q[i] = LIMB_FLIP[bi] ? -(v[0] || 0) : (v[0] || 0); q[i + 1] = v[1] || 0; q[i + 2] = v[2] || 0; }
    q[PN] = rootY || 0; q[PN + 1] = pitch || 0; q[PN + 2] = roll || 0; q[PN + 3] = yaw || 0;
    return q;
  }
  function lerpPose(a, b, t, out) { out = out || newPose(); for (let i = 0; i < PLEN; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }
  function kf(t, keys) { // keys: [[t0, pose], [t1, pose], ...]
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const u = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); const s = u * u * (3 - 2 * u); return lerpPose(keys[i - 1][1], keys[i][1], s); }
    return keys[keys.length - 1][1];
  }
  function mirrorPose(q) {
    const o = newPose(); o.set(q);
    const sw = [[B.shL, B.shR], [B.elL, B.elR], [B.haL, B.haR], [B.hipL, B.hipR], [B.knL, B.knR], [B.ftL, B.ftR]];
    for (const [l, r] of sw) for (let k = 0; k < 3; k++) { o[l * 3 + k] = q[r * 3 + k]; o[r * 3 + k] = q[l * 3 + k]; }
    for (let b = 0; b < NB; b++) { o[b * 3 + 1] = -o[b * 3 + 1]; o[b * 3 + 2] = -o[b * 3 + 2]; }
    o[PN + 2] = -q[PN + 2]; o[PN + 3] = -q[PN + 3];
    return o;
  }
  const sq = (x) => x * x;
  // ground fit: shift the root so the lowest contact point (heels, toes, knee pads) of the pose sits on the ground (+ lift)
  function lowestPt(q) {
    const b = fk(q, 0, 0, 0, 0, 1);
    let lo = 9;
    for (const f of [B.ftL, B.ftR]) { const m = b[f]; lo = Math.min(lo, m[7] - 0.04 * m[5] + 0.2 * m[6], m[7] - 0.06 * m[5] - 0.08 * m[6]); }
    for (const k of [B.knL, B.knR]) lo = Math.min(lo, b[k][7] - 0.09);
    return lo;
  }
  function gfit(q, lift) { q[PN] += (lift || 0) - lowestPt(q); return q; }

  // run cycle: p = phase (left leg forward at sin(p) = 1), k = 0..1 effort, lean = extra forward lean
  // elbows stay near 90 degrees, hands swing hip-to-chin, shoulders counter-rotate the hips, head stays level
  function clipRun(p, k, lean) {
    const s = Math.sin(p), c = Math.cos(p), s2 = -s;
    const knee = (ph) => -(0.22 + 1.35 * k * sq(Math.max(0, Math.cos(ph + 0.55))) + 0.25 * k * Math.max(0, -Math.cos(ph)) * Math.max(0, Math.sin(ph)));
    const hipL = 0.72 * k * s + 0.08, hipR = 0.72 * k * s2 + 0.08, knL = knee(p), knR = knee(p + Math.PI);
    const foot = (h, kn, ph) => clamp(-0.7 * (h + kn), -0.5, 0.9) + 0.35 * k * Math.max(0, Math.sin(ph + Math.PI)); // flat on the ground, toes down after toe-off
    const L = lean || 0, yaw = 0.09 * k * s;
    return gfit(pb({
      hipL: [hipL, 0, -0.04], hipR: [hipR, 0, 0.04], knL: [knL], knR: [knR], ftL: [foot(hipL, knL, p)], ftR: [foot(hipR, knR, p + Math.PI)],
      shL: [-0.58 * k * s + 0.12 + 0.1 * k, 0, -0.14 - 0.05 * k], shR: [0.58 * k * s + 0.12 + 0.1 * k, 0, 0.14 + 0.05 * k],
      elL: [1.45 + 0.35 * k * Math.max(0, s2) + 0.1 * k], elR: [1.45 + 0.35 * k * Math.max(0, s) + 0.1 * k], haL: [0.25], haR: [0.25],
      spine: [0.08 + 0.18 * k + L, 0, 0.02 * k * s], chest: [0.02, -0.26 * k * s - yaw, 0], neck: [-(0.16 + 0.25 * k + L * 0.8), 0.17 * k * s, 0], head: [-0.06, 0, 0],
    }, 0, 0.03 + 0.07 * k + L * 0.35, 0.025 * k * s, yaw), 0.045 * k * Math.abs(s));
  }
  function clipBackpedal(p) {
    const s = Math.sin(p), s2 = -s;
    return gfit(pb({
      hipL: [-0.35 * s - 0.08, 0, -0.06], hipR: [-0.35 * s2 - 0.08, 0, 0.06], knL: [-(0.5 + 0.45 * Math.max(0, -s))], knR: [-(0.5 + 0.45 * Math.max(0, -s2))], ftL: [0.2], ftR: [0.2],
      shL: [0.5 + 0.15 * s, 0, -0.3], shR: [0.5 + 0.15 * s2, 0, 0.3], elL: [1.2], elR: [1.2],
      spine: [0.18, 0, 0], chest: [0, 0.06 * s, 0], neck: [-0.3, 0, 0],
    }, 0, -0.06, 0));
  }
  // two-point stance (receivers, backs, defensive backs): staggered feet, slight crouch, arms loose, one hand up
  const POSE_STANCE2 = gfit(pb({ hipL: [0.62, 0, -0.08], knL: [-0.75], ftL: [0.05], hipR: [0.2, 0, 0.1], knR: [-0.6], ftR: [0.35], shL: [0.42, 0, -0.18], elL: [0.75], haL: [0.2], shR: [0.75, 0, 0.12], elR: [1.5], haR: [0.3], spine: [0.42, 0, 0], chest: [0.05, 0, 0], neck: [-0.55, 0, 0], head: [-0.18, 0, 0] }, -0.23, 0.12, 0));
  // three-point stance (linemen): hips up, back flat, right hand on the ground, left forearm on the thigh, head up
  const POSE_STANCE3 = gfit(pb({ hipL: [1.4, 0, -0.14], knL: [-1.75], ftL: [0.0], hipR: [0.95, 0, 0.16], knR: [-1.6], ftR: [0.6], shL: [0.95, 0, -0.28], elL: [1.6], haL: [0.3], shR: [2.05, 0, 0.1], elR: [0.05], haR: [-0.3], spine: [0.8, 0, 0], chest: [0.25, 0, 0], neck: [-1.1, 0, 0], head: [-0.35, 0, 0] }, 0, 0.75, 0.04));
  const POSE_IDLE = gfit(pb({ hipL: [0.04, 0, -0.07], hipR: [0.04, 0, 0.07], knL: [-0.12], knR: [-0.12], shL: [0.1, 0, -0.2], shR: [0.1, 0, 0.2], elL: [0.4], elR: [0.4], haL: [0.15], haR: [0.15], spine: [0.06, 0, 0], neck: [-0.08, 0, 0] }, -0.02, 0.02, 0));
  const POSE_KNEEL = gfit(pb({ hipL: [1.35, 0, -0.12], knL: [-2.05], ftL: [0.5], hipR: [0.45, 0, 0.18], knR: [-1.35], ftR: [1.1], shL: [0.9, 0, -0.3], shR: [0.6, 0, 0.3], elL: [0.8], elR: [1.2], spine: [0.2, 0, 0], neck: [-0.15, 0, 0] }, -0.5, 0.05, 0));
  const POSE_HOLD = gfit(pb({ hipL: [0.75, 0, -0.1], knL: [-1.2], hipR: [1.3, 0, 0.3], knR: [-2.1], ftR: [1.0], shL: [1.1, 0, -0.3], shR: [1.1, 0, 0.3], elL: [0.4], elR: [0.4], spine: [0.55, 0, 0], neck: [-0.4, 0, 0] }, -0.54, 0.2, 0));
  // shotgun quarterback: knees bent, hands out at the waist, a single clap at t ~ 0.9 s
  function clipQB(t) {
    const cl = t > 0.7 && t < 1.25 ? Math.sin(Math.PI * (t - 0.7) / 0.55) : 0; // 0..1..0 hands together
    return gfit(pb({ hipL: [0.32, 0, -0.12], hipR: [0.32, 0, 0.12], knL: [-0.5], knR: [-0.5], shL: [0.55 + 0.15 * cl, 0, -0.32 + 0.3 * cl], shR: [0.55 + 0.15 * cl, 0, 0.32 - 0.3 * cl], elL: [1.35 - 0.1 * cl], elR: [1.35 - 0.1 * cl], haL: [0.4], haR: [0.4], spine: [0.26, 0, 0], chest: [0.04, 0, 0], neck: [-0.38, 0, 0], head: [-0.1, 0, 0] }, 0, 0.08, 0));
  }
  // right-handed throw: front (left) shoulder to the target, back foot planted, hips then chest rotate, over-the-top release at t ~ 0.5, follow-through across the body
  function clipThrow(t) {
    return kf(t, [
      [0, gfit(pb({ shR: [1.0, 0, 0.55], elR: [2.0], haR: [0.2], shL: [0.9, 0, -0.45], elL: [1.9], chest: [-0.05, 0.75, 0], spine: [-0.04, 0.2, 0], neck: [-0.15, -0.85, 0], head: [0, -0.2, 0], hipL: [0.42, 0.25, -0.12], hipR: [-0.25, 0.1, 0.18], knL: [-0.35], knR: [-0.45], ftR: [0.1] }, -0.1, -0.03, 0, 0.35))],
      [0.3, gfit(pb({ shR: [1.5, 0.3, 1.45], elR: [1.75], haR: [0.3], shL: [1.35, 0, -0.55], elL: [1.1], chest: [-0.12, 0.9, 0.05], spine: [-0.08, 0.25, 0], neck: [-0.1, -1.0, 0], head: [0, -0.2, 0], hipL: [0.5, 0.25, -0.12], hipR: [-0.3, 0.1, 0.18], knL: [-0.3], knR: [-0.5], ftR: [0.2] }, -0.1, -0.06, 0.04, 0.4))],
      [0.5, gfit(pb({ shR: [2.55, 0.1, 0.45], elR: [0.35], haR: [0.5], shL: [0.4, 0, -0.65], elL: [1.4], chest: [0.1, -0.2, -0.04], spine: [0.22, -0.1, 0], neck: [-0.3, 0.15, 0], hipL: [0.35, 0, -0.1], hipR: [-0.5, 0, 0.2], knL: [-0.5], knR: [-0.35], ftR: [0.7] }, -0.13, 0.12, 0.05, -0.05))],
      [0.75, gfit(pb({ shR: [1.35, 0.2, -0.35], elR: [0.6], haR: [0.6], shL: [0.15, 0, -0.5], elL: [1.1], chest: [0.15, -0.65, -0.06], spine: [0.38, -0.2, 0], neck: [-0.35, 0.45, 0], hipL: [0.3, 0, -0.1], hipR: [-0.55, 0, 0.2], knL: [-0.55], knR: [-0.3], ftR: [0.8] }, -0.16, 0.2, 0.08, -0.12))],
      [1, gfit(pb({ shR: [0.5, 0, 0.1], elR: [0.9], shL: [0.2, 0, -0.35], elL: [0.9], chest: [0.08, -0.35, 0], spine: [0.28, -0.1, 0], neck: [-0.3, 0.25, 0], hipL: [0.25, 0, -0.1], hipR: [-0.3, 0, 0.15], knL: [-0.45], knR: [-0.35], ftR: [0.4] }, -0.12, 0.12, 0.04, -0.08))],
    ]);
  }
  function clipJump(t) {
    return kf(t, [
      [0, gfit(pb({ hipL: [0.85, 0, -0.1], hipR: [0.85, 0, 0.1], knL: [-1.25], knR: [-1.25], ftL: [0.3], ftR: [0.3], shL: [-0.9, 0, -0.3], shR: [-0.9, 0, 0.3], elL: [0.7], elR: [0.7], spine: [0.5, 0, 0], neck: [-0.4, 0, 0] }, -0.4, 0.1, 0))],
      [0.15, pb({ hipL: [0.3, 0, -0.1], hipR: [0.3, 0, 0.1], knL: [-0.5], knR: [-0.5], ftL: [0.4], ftR: [0.4], shL: [1.4, 0, -0.3], shR: [1.4, 0, 0.3], elL: [0.5], elR: [0.5], spine: [0.1, 0, 0], neck: [-0.5, 0, 0] }, -0.1, 0.0, 0)],
      [0.3, pb({ hipL: [-0.15, 0, -0.08], hipR: [0.25, 0, 0.08], knL: [-0.15], knR: [-0.95], ftL: [0.5], ftR: [0.5], shL: [2.75, 0, -0.3], shR: [2.75, 0, 0.3], elL: [0.3], elR: [0.3], spine: [-0.1, 0, 0], neck: [-0.6, 0, 0] }, 0.02, -0.05, 0)],
      [0.55, pb({ hipL: [0.3, 0, -0.1], hipR: [0.35, 0, 0.1], knL: [-0.75], knR: [-0.8], shL: [3.0, 0, -0.2], shR: [3.0, 0, 0.2], elL: [0.12], elR: [0.12], spine: [-0.05, 0, 0], neck: [-0.7, 0, 0], head: [-0.2, 0, 0] }, 0, -0.03, 0)],
      [0.8, pb({ hipL: [0.45, 0, -0.1], hipR: [0.45, 0, 0.1], knL: [-0.6], knR: [-0.6], shL: [2.0, 0, -0.3], shR: [2.0, 0, 0.3], elL: [0.9], elR: [0.9], spine: [0.15, 0, 0], neck: [-0.3, 0, 0] }, -0.05, 0.05, 0)],
      [1, gfit(pb({ hipL: [0.7, 0, -0.1], hipR: [0.7, 0, 0.1], knL: [-1.0], knR: [-1.0], shL: [0.4, 0, -0.4], shR: [0.4, 0, 0.4], elL: [1.1], elR: [1.1], spine: [0.4, 0, 0], neck: [-0.3, 0, 0] }, -0.28, 0.12, 0))],
    ]);
  }
  function clipDive(t) {
    return kf(t, [
      [0, pb({ hipL: [0.6, 0, -0.1], hipR: [-0.2, 0, 0.1], knL: [-0.9], knR: [-0.4], shL: [1.4, 0, -0.4], shR: [1.4, 0, 0.4], elL: [0.5], elR: [0.5], spine: [0.5, 0, 0], neck: [-0.5, 0, 0] }, -0.22, 0.35, 0)],
      [0.2, pb({ hipL: [-0.25, 0, -0.12], hipR: [-0.2, 0, 0.12], knL: [-0.25], knR: [-0.3], ftL: [0.5], ftR: [0.5], shL: [3.0, 0, -0.25], shR: [3.0, 0, 0.25], elL: [0.05], elR: [0.05], spine: [-0.1, 0, 0], neck: [-0.8, 0, 0], head: [-0.3, 0, 0] }, -0.2, 1.2, 0)],
      [0.5, pb({ hipL: [-0.3, 0, -0.12], hipR: [-0.25, 0, 0.12], knL: [-0.2], knR: [-0.25], ftL: [0.5], ftR: [0.5], shL: [3.05, 0, -0.25], shR: [3.05, 0, 0.25], elL: [0.05], elR: [0.05], spine: [-0.12, 0, 0], neck: [-0.85, 0, 0], head: [-0.3, 0, 0] }, -0.42, 1.38, 0)],
      [0.75, pb({ hipL: [-0.15, 0, -0.15], hipR: [-0.1, 0, 0.15], knL: [-0.4], knR: [-0.35], ftL: [0.6], ftR: [0.6], shL: [3.0, 0, -0.35], shR: [3.0, 0, 0.35], elL: [0.1], elR: [0.1], spine: [0.0, 0, 0], neck: [-0.75, 0, 0], head: [-0.3, 0, 0] }, -0.68, 1.45, 0)],
      [1, pb({ hipL: [0.1, 0, -0.2], hipR: [0.15, 0, 0.2], knL: [-0.6], knR: [-0.5], shL: [2.3, 0, -0.5], shR: [2.4, 0, 0.5], elL: [0.9], elR: [0.9], spine: [0.1, 0, 0], neck: [-0.4, 0, 0] }, -0.74, 1.5, 0)],
    ]);
  }
  function clipHurdle(t) { // leap over a low tackler: drive the lead knee, tuck the trail leg, land running
    return kf(t, [
      [0, gfit(pb({ hipL: [0.9, 0, -0.1], hipR: [0.45, 0, 0.1], knL: [-1.3], knR: [-0.8], ftL: [0.2], shL: [-0.5, 0, -0.35], shR: [1.1, 0, 0.35], elL: [0.9], elR: [0.8], spine: [0.42, 0, 0], neck: [-0.3, 0, 0] }, -0.26, 0.1, 0))],
      [0.22, pb({ hipL: [1.8, 0, -0.12], hipR: [0.35, 0, 0.12], knL: [-0.55], knR: [-1.9], ftL: [0.35], ftR: [0.5], shL: [-0.7, 0, -0.5], shR: [1.5, 0, 0.5], elL: [0.7], elR: [0.6], spine: [0.5, 0, 0], neck: [-0.45, 0, 0] }, 0, 0.08, 0)],
      [0.48, pb({ hipL: [1.5, 0, -0.14], hipR: [1.05, 0, 0.14], knL: [-0.35], knR: [-2.15], ftL: [0.45], ftR: [0.6], shL: [0.5, 0, -0.75], shR: [0.9, 0, 0.75], elL: [0.5], elR: [0.5], spine: [0.38, 0, 0], neck: [-0.35, 0, 0] }, 0.02, 0.04, 0)],
      [0.75, pb({ hipL: [0.65, 0, -0.1], hipR: [1.0, 0, 0.1], knL: [-0.5], knR: [-1.1], ftL: [0.1], shL: [0.3, 0, -0.5], shR: [0.4, 0, 0.5], elL: [0.8], elR: [0.8], spine: [0.3, 0, 0], neck: [-0.3, 0, 0] }, -0.04, 0.06, 0)],
      [1, gfit(pb({ hipL: [0.5, 0, -0.1], hipR: [0.6, 0, 0.1], knL: [-1.0], knR: [-0.9], shL: [0.3, 0, -0.4], shR: [-0.2, 0, 0.4], elL: [1.0], elR: [1.0], spine: [0.36, 0, 0], neck: [-0.3, 0, 0] }, -0.2, 0.1, 0))],
    ]);
  }
  function clipJuke(t) { // sidestep to the left (mirror for right)
    return kf(t, [
      [0, gfit(pb({ hipL: [0.3, 0, -0.75], hipR: [0.35, 0, 0.2], knL: [-0.5], knR: [-0.85], shL: [-0.3, 0, -1.1], shR: [0.6, 0, 0.9], elL: [0.8], elR: [1.1], spine: [0.28, 0, 0.3], chest: [0, 0.35, 0.1], neck: [-0.2, -0.2, 0] }, -0.2, 0.12, -0.3))],
      [0.55, gfit(pb({ hipL: [0.6, 0, -0.1], hipR: [-0.2, 0, 0.55], knL: [-0.8], knR: [-0.4], shL: [0.4, 0, -0.5], shR: [-0.4, 0, 0.9], elL: [1.1], elR: [0.8], spine: [0.3, 0, -0.2], chest: [0, -0.2, 0], neck: [-0.2, 0.1, 0] }, -0.12, 0.15, 0.22))],
      [1, clipRun(1.2, 0.9)],
    ]);
  }
  function clipSpin(t) {
    const q = pb({ hipL: [0.5, 0, -0.12], hipR: [0.3, 0, 0.14], knL: [-0.7], knR: [-0.6], shL: [0.9, 0, -0.5], shR: [0.6, 0, 0.3], elL: [1.9], elR: [2.0], spine: [0.25, 0, 0], chest: [0, 0.3, 0], neck: [-0.2, 0, 0] }, -0.1, 0.1, 0.1, t * 6.2832);
    return q;
  }
  function clipStiff(t) {
    return kf(t, [
      [0, gfit(pb({ shL: [1.0, 0, -0.5], elL: [0.9], shR: [0.4, 0, 0.3], elR: [2.0], spine: [0.3, 0, 0], chest: [0, 0.2, 0], hipL: [0.6, 0, -0.1], hipR: [-0.3, 0, 0.1], knL: [-0.6], knR: [-0.4] }, -0.08, 0.12, 0))],
      [0.3, gfit(pb({ shL: [1.75, 0, -0.45], elL: [0.05], shR: [0.5, 0, 0.3], elR: [2.0], spine: [0.38, 0, 0.05], chest: [0, 0.45, 0], neck: [-0.3, -0.3, 0], hipL: [0.7, 0, -0.1], hipR: [-0.4, 0, 0.1], knL: [-0.6], knR: [-0.35] }, -0.1, 0.2, 0.06))],
      [1, gfit(pb({ shL: [1.6, 0, -0.45], elL: [0.1], shR: [0.5, 0, 0.3], elR: [2.0], spine: [0.36, 0, 0.05], chest: [0, 0.4, 0], neck: [-0.3, -0.3, 0], hipL: [-0.2, 0, -0.1], hipR: [0.7, 0, 0.1], knL: [-0.4], knR: [-0.7] }, -0.1, 0.18, 0.05))],
    ]);
  }
  function clipGetup(t) {
    return kf(t, [
      [0, pb({ hipL: [0.15, 0, -0.2], hipR: [0.2, 0, 0.2], knL: [-0.5], knR: [-0.4], shL: [1.9, 0, -0.6], shR: [1.9, 0, 0.6], elL: [1.2], elR: [1.2], spine: [0.0, 0, 0], neck: [-0.6, 0, 0] }, -0.74, 1.5, 0)],
      [0.3, pb({ hipL: [1.3, 0, -0.25], hipR: [0.9, 0, 0.3], knL: [-1.9], knR: [-1.6], shL: [1.5, 0, -0.5], shR: [1.5, 0, 0.5], elL: [0.4], elR: [0.4], spine: [0.1, 0, 0], neck: [-0.7, 0, 0] }, -0.58, 0.95, 0)],
      [0.6, pb({ hipL: [1.35, 0, -0.12], knL: [-2.05], ftL: [0.5], hipR: [0.6, 0, 0.2], knR: [-1.4], shL: [0.9, 0, -0.3], shR: [0.4, 0, 0.3], elL: [0.9], elR: [0.9], spine: [0.3, 0, 0], neck: [-0.3, 0, 0] }, -0.55, 0.25, 0)],
      [0.85, pb({ hipL: [0.7, 0, -0.1], knL: [-1.1], hipR: [0.5, 0, 0.1], knR: [-0.9], shL: [0.3, 0, -0.3], shR: [0.3, 0, 0.3], elL: [0.7], elR: [0.7], spine: [0.3, 0, 0], neck: [-0.15, 0, 0] }, -0.3, 0.1, 0)],
      [1, POSE_IDLE],
    ]);
  }
  function clipCeleb(k, t) {
    const w = Math.sin(t * 9), hop = Math.abs(Math.sin(t * 6.5));
    if (k === 1) return kf(Math.min(1, t / 0.9), [ // spike
      [0, gfit(pb({ shR: [2.9, 0, 0.35], elR: [0.2], shL: [0.4, 0, -0.5], elL: [0.9], spine: [-0.15, 0, 0], neck: [-0.4, 0, 0], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.4], knR: [-0.4] }, -0.08, -0.08, 0))],
      [0.4, gfit(pb({ shR: [-0.5, 0, 0.5], elR: [0.3], shL: [0.4, 0, -0.5], elL: [0.9], spine: [0.55, 0, 0], neck: [-0.1, 0, 0], hipL: [0.7, 0, -0.15], hipR: [0.7, 0, 0.15], knL: [-0.9], knR: [-0.9] }, -0.28, 0.28, 0))],
      [1, gfit(pb({ shR: [0.6, 0, 1.4], elR: [0.4], shL: [0.6, 0, -1.4], elL: [0.4], spine: [-0.1, 0, 0], neck: [-0.35, 0, 0], hipL: [0.15, 0, -0.25], hipR: [0.15, 0, 0.25], knL: [-0.3], knR: [-0.3] }, -0.05, -0.05, 0))],
    ]);
    if (k === 2) return gfit(pb({ shR: [0.3, 0, 2.95], elR: [0.1], shL: [0.9, 0, -0.5], elL: [1.9], spine: [-0.2, 0, 0.1], neck: [-0.7, 0, 0], head: [-0.3, 0, 0], hipL: [0.1, 0, -0.2], hipR: [0.1, 0, 0.2], knL: [-0.25], knR: [-0.25] }, 0, -0.1, 0.05));
    if (k === 3) return gfit(pb({ shR: [0.4, 0, 1.7 + 0.1 * w], elR: [2.4], shL: [0.4, 0, -1.7 - 0.1 * w], elL: [2.4], spine: [0.2, 0, 0], neck: [-0.2, 0, 0], hipL: [0.5, 0, -0.3], hipR: [0.5, 0, 0.3], knL: [-0.7], knR: [-0.7] }, 0, 0.1, 0));
    return gfit(pb({ shR: [2.7 + 0.25 * w, 0, 0.5], elR: [0.35], shL: [2.7 - 0.25 * w, 0, -0.5], elL: [0.35], spine: [-0.1, 0, 0], neck: [-0.4, 0, 0], hipL: [0.3 - 0.2 * hop, 0, -0.15], hipR: [0.3 - 0.2 * hop, 0, 0.15], knL: [-0.5 + 0.3 * hop], knR: [-0.5 + 0.3 * hop] }, 0, -0.05, 0), 0.14 * hop);
  }
  function clipTackle(t, ph) {
    const s = Math.sin(ph);
    return kf(t, [
      [0, gfit(pb({ shL: [1.0, 0, -0.55], shR: [1.0, 0, 0.55], elL: [1.05], elR: [1.05], haL: [0.3], haR: [0.3], spine: [0.68, 0, 0], neck: [-0.7, 0, 0], head: [-0.25, 0, 0], hipL: [0.65 + 0.35 * s, 0, -0.14], hipR: [0.65 - 0.35 * s, 0, 0.14], knL: [-0.95], knR: [-0.95] }, 0, 0.25, 0))],
      [1, gfit(pb({ shL: [1.5, 0, 0.05], shR: [1.5, 0, -0.05], elL: [1.6], elR: [1.6], haL: [0.4], haR: [0.4], spine: [0.72, 0, 0], neck: [-0.6, 0, 0], head: [-0.25, 0, 0], hipL: [0.35, 0, -0.1], hipR: [0.2, 0, 0.1], knL: [-0.65], knR: [-0.55], ftR: [0.5] }, 0, 0.6, 0), 0.05)],
    ]);
  }
  // blocking: hands at chest height punching, elbows in, feet chopping; drive leans into the defender
  function clipBlock(ph, drive) {
    const s = Math.sin(ph), p = Math.max(0, Math.sin(ph * 1.5)); // p: punch 0..1
    return gfit(pb({ shL: [0.95 + 0.25 * p + drive * 0.2, 0, -0.16], shR: [0.95 + 0.25 * p + drive * 0.2, 0, 0.16], elL: [1.55 - 0.65 * p - drive * 0.25], elR: [1.55 - 0.65 * p - drive * 0.25], haL: [0.5], haR: [0.5],
      spine: [0.28 + drive * 0.25, 0, 0], neck: [-0.45 - drive * 0.2, 0, 0], head: [-0.1, 0, 0], hipL: [0.5 + 0.18 * s, 0, -0.2], hipR: [0.5 - 0.18 * s, 0, 0.2], knL: [-0.85 - 0.15 * Math.max(0, s)], knR: [-0.85 - 0.15 * Math.max(0, -s)], ftL: [0.1], ftR: [0.1] }, 0, 0.12 + drive * 0.22, 0));
  }
  // pass rush: hand fighting (alternating swipes / a rip with the inside arm), low and leaning in
  function clipRush(ph, drive) {
    const s = Math.sin(ph), c = Math.cos(ph), rip = Math.max(0, Math.sin(ph * 0.5));
    return gfit(pb({ shL: [1.1 + 0.35 * s, 0.2 * c, -0.45 + 0.3 * c], shR: [1.1 - 0.35 * s + 0.5 * rip, -0.2 * c, 0.45 - 0.3 * c - 0.5 * rip], elL: [1.1 + 0.3 * Math.max(0, s)], elR: [1.1 + 0.3 * Math.max(0, -s) + 0.6 * rip], haL: [0.4], haR: [0.4],
      spine: [0.4 + drive * 0.25, 0.12 * s, 0], chest: [0, 0.18 * s, 0], neck: [-0.6 - drive * 0.15, -0.1 * s, 0], head: [-0.15, 0, 0], hipL: [0.45 - 0.2 * s, 0, -0.18], hipR: [0.45 + 0.2 * s, 0, 0.18], knL: [-0.8], knR: [-0.8], ftL: [0.1], ftR: [0.1] }, 0, 0.18 + drive * 0.22, 0.03 * s));
  }
  function clipKick(t) {
    return kf(t, [
      [0, gfit(pb({ hipL: [0.25, 0, -0.1], knL: [-0.25], hipR: [-0.95, 0, 0.1], knR: [-1.35], shL: [0.3, 0, -1.3], shR: [-0.6, 0, 0.5], elL: [0.5], elR: [0.8], spine: [-0.15, -0.25, 0.1], neck: [-0.25, 0, 0] }, -0.06, -0.1, -0.08))],
      [0.45, gfit(pb({ hipL: [0.15, 0, -0.1], knL: [-0.15], hipR: [1.45, 0, 0.15], knR: [-0.15], ftR: [0.6], shL: [0.9, 0, -1.3], shR: [-0.8, 0, 0.6], elL: [0.3], elR: [0.8], spine: [-0.15, 0.25, 0.15], neck: [-0.3, 0, 0] }, -0.04, -0.18, -0.1))],
      [1, gfit(pb({ hipL: [0.15, 0, -0.1], knL: [-0.2], hipR: [1.0, 0, 0.15], knR: [-0.3], shL: [0.4, 0, -0.8], shR: [-0.2, 0, 0.5], elL: [0.5], elR: [0.8], spine: [0.05, 0.1, 0.05], neck: [-0.2, 0, 0] }, -0.05, -0.05, -0.05))],
    ]);
  }
  const POSE_SLIDE = pb({ hipL: [1.5, 0, -0.1], knL: [-0.1], hipR: [1.1, 0, 0.2], knR: [-1.3], shL: [-0.4, 0, -0.9], shR: [2.0, 0, 0.6], elL: [0.4], elR: [0.3], spine: [-0.5, 0, 0], neck: [0.2, 0, 0] }, -0.7, -1.15, 0.1);
  function clipStumble(p) {
    const q = clipRun(p, 1, 0.5);
    q[B.spine * 3] += 0.35; q[B.shL * 3] = -1.0; q[B.shR * 3] = -1.0; q[B.shL * 3 + 2] = -0.7; q[B.shR * 3 + 2] = 0.7; q[B.elL * 3] = -0.5; q[B.elR * 3] = -0.5; q[PN + 1] += 0.22; q[B.neck * 3] += 0.3; // raw limb values: arms forward, elbows bent
    return q;
  }
  const POSE_REACH = pb({ shL: [2.2, 0, -0.35], shR: [2.2, 0, 0.35], elL: [0.3], elR: [0.3], neck: [-0.5, 0, 0], head: [-0.2, 0, 0] });
  // quarterback in the pocket: ball held at the chest with both hands, knees soft, a little bounce, eyes downfield
  function clipPocket(t) {
    const b = Math.sin(t * 5.2) * 0.5 + 0.5, b2 = Math.sin(t * 2.6);
    return gfit(pb({ hipL: [0.3 + 0.04 * b, 0, -0.14], hipR: [0.28 + 0.04 * b, 0, 0.14], knL: [-0.55 - 0.08 * b], knR: [-0.5 - 0.08 * b], ftL: [0.05], ftR: [0.05],
      shL: [0.95, 0.15, -0.35], elL: [2.1], haL: [0.3, 0, 0.3], shR: [0.85, -0.1, 0.5], elR: [2.15], haR: [0.2, 0, -0.3],
      spine: [0.16, 0.05 * b2, 0], chest: [0.04, 0.08 * b2, 0], neck: [-0.22, 0, 0], head: [-0.05, 0, 0] }, 0.0 - 0.02 * b, 0.06, 0));
  }
  // bench: seated on a 0.5-yard bench, elbows on the knees
  const POSE_SIT = pb({ hipL: [1.55, 0, -0.14], hipR: [1.55, 0, 0.14], knL: [-1.5], knR: [-1.5], ftL: [0.05], ftR: [0.05], shL: [0.9, 0, -0.15], shR: [0.9, 0, 0.15], elL: [1.3], elR: [1.3], haL: [0.2], haR: [0.2], spine: [0.3, 0, 0], neck: [-0.25, 0, 0] }, -0.58, 0.05, 0);
  const POSE_SIT_BACK = pb({ hipL: [1.5, 0, -0.2], hipR: [1.5, 0, 0.2], knL: [-1.35], knR: [-1.35], ftL: [0.1], ftR: [0.1], shL: [0.2, 0, -0.3], shR: [0.2, 0, 0.3], elL: [0.6], elR: [0.6], spine: [-0.1, 0, 0], neck: [0.05, 0, 0] }, -0.6, -0.08, 0);
  // officials' signals: touchdown (arms up), incomplete (arms sweep across), first down (point)
  function clipSignal(kind, t) {
    const u = Math.min(1, t / 0.45), s = u * u * (3 - 2 * u);
    if (kind === 'sigtd') return gfit(lerpPose(POSE_IDLE, pb({ shL: [3.0, 0, -0.12], shR: [3.0, 0, 0.12], elL: [0.05], elR: [0.05], haL: [0.1], haR: [0.1], spine: [-0.08, 0, 0], neck: [-0.15, 0, 0], hipL: [0.05, 0, -0.1], hipR: [0.05, 0, 0.1], knL: [-0.1], knR: [-0.1] }, 0, -0.03, 0), s));
    if (kind === 'sigfirst') return gfit(lerpPose(POSE_IDLE, pb({ shR: [1.55, 0, 0.1], elR: [0.05], haR: [0.0], shL: [0.4, 0, -0.5], elL: [1.6], spine: [0.1, 0.2, 0], chest: [0, 0.3, 0], neck: [-0.1, -0.3, 0], hipL: [0.5, 0, -0.1], hipR: [-0.2, 0, 0.1], knL: [-0.7], knR: [-0.2] }, -0.08, 0.05, 0), s));
    const w = Math.sin(t * 6.5); // incomplete: arms sweep back and forth across the body
    return gfit(pb({ shL: [0.75, 0, -0.45 + 0.75 * w], shR: [0.75, 0, 0.45 - 0.75 * w], elL: [0.35], elR: [0.35], spine: [0.12, 0, 0], neck: [-0.15, 0, 0], hipL: [0.1, 0, -0.14], hipR: [0.1, 0, 0.14], knL: [-0.2], knR: [-0.2] }, -0.03, 0.02, 0));
  }
  // two-bone leg IK: put the foot at a world target, knee bending toward `fwd`
  function legIK(bones, side, tgt, hs, fwd, footM, ll) {
    const hp = side < 0 ? B.hipL : B.hipR, kn = side < 0 ? B.knL : B.knR, ft = side < 0 ? B.ftL : B.ftR;
    ll = ll || 1;
    const J = [bones[hp][3], bones[hp][7], bones[hp][11]], L1 = 0.5 * hs * ll, L2 = 0.47 * hs * ll;
    let d = v3s(tgt, J), dl = Math.hypot(d[0], d[1], d[2]);
    const maxR = L1 + L2 - 0.005; if (dl > maxR) { d = [d[0] / dl * maxR, d[1] / dl * maxR, d[2] / dl * maxR]; dl = maxR; }
    if (dl < 0.1) return;
    const T = v3a(J, d), dir = [d[0] / dl, d[1] / dl, d[2] / dl];
    const cosA = clamp((L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl), -1, 1), a = Math.acos(cosA);
    let pp = v3s(fwd, [dir[0] * v3d(fwd, dir), dir[1] * v3d(fwd, dir), dir[2] * v3d(fwd, dir)]);
    if (Math.hypot(pp[0], pp[1], pp[2]) < 1e-3) pp = [0, 0, 1];
    pp = v3n(pp);
    const K = v3a(v3a(J, dir, L1 * Math.cos(a)), pp, L1 * Math.sin(a));
    bones[hp] = mFromDown(J, v3s(K, J), fwd);
    bones[kn] = mFromDown(K, v3s(T, K), fwd);
    bones[ft] = footM ? [footM[0], footM[1], footM[2], T[0], footM[4], footM[5], footM[6], T[1], footM[8], footM[9], footM[10], T[2]] : mFromDown(T, v3s(T, K), fwd);
  }

  // ---------- forward kinematics ----------
  // ll: leg length factor (stubby builds): thigh and shin shorten, the hips ride lower, the foot below the ankle keeps its size
  function fk(q, x, y, z, heading, hs, sw, ll) {
    const out = new Array(NB); sw = sw || 1; ll = ll || 1;
    let root = mT(IDM, x, y + ((HIP_H + q[PN]) * ll + 0.08 * (1 - ll)) * hs, z);
    root = RY(root, heading + q[PN + 3]); root = RX(root, q[PN + 1]); root = RZ(root, q[PN + 2]);
    for (let i = 0; i < NB; i++) {
      const b = BONES[i], par = b[1], sx = (i === B.shL || i === B.shR) ? sw : 1;
      let m = par < 0 ? root : mT(out[par], b[2] * hs * sx, b[3] * hs * (LEGB[i] ? ll : 1), b[4] * hs);
      const o = i * 3;
      m = RX(m, q[o]); m = RY(m, q[o + 1]); m = RZ(m, q[o + 2]);
      out[i] = m;
    }
    return out;
  }
  // two-bone arm IK: point the hand at a world target; pole bends the elbow out and down
  function armIK(bones, side, tgt, hs) {
    const sh = side < 0 ? B.shL : B.shR, el = side < 0 ? B.elL : B.elR, ha = side < 0 ? B.haL : B.haR, ch = bones[B.chest];
    const S = [bones[sh][3], bones[sh][7], bones[sh][11]], L1 = 0.36 * hs, L2 = 0.32 * hs;
    let d = v3s(tgt, S), dl = Math.hypot(d[0], d[1], d[2]);
    const maxR = L1 + L2 - 0.01; if (dl > maxR) { d = [d[0] / dl * maxR, d[1] / dl * maxR, d[2] / dl * maxR]; dl = maxR; }
    if (dl < 0.05) return;
    const T = v3a(S, d), dir = [d[0] / dl, d[1] / dl, d[2] / dl];
    const cosA = clamp((L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl), -1, 1), a = Math.acos(cosA);
    const right = [ch[0], ch[4], ch[8]], fwd = [ch[2], ch[6], ch[10]];
    let pole = v3a(v3a([0, 0, 0], right, side * 0.6), [0, -0.35, 0]); pole = v3a(pole, fwd, -0.15);
    let pp = v3s(pole, [dir[0] * v3d(pole, dir), dir[1] * v3d(pole, dir), dir[2] * v3d(pole, dir)]);
    if (Math.hypot(pp[0], pp[1], pp[2]) < 1e-3) pp = [right[0] * side, right[1] * side, right[2] * side];
    pp = v3n(pp);
    const E = v3a(v3a(S, dir, L1 * Math.cos(a)), pp, L1 * Math.sin(a));
    const fh = [ch[2], ch[6], ch[10]];
    bones[sh] = mFromDown(S, v3s(E, S), fh);
    bones[el] = mFromDown(E, v3s(T, E), fh);
    bones[ha] = mFromDown(T, v3s(T, E), fh);
  }
  // flatten bone matrices to vec4 rows for the shader, premultiplied by the inverse bind translation (mesh vertices are in body space)
  function packBones(bones, out, bind, hs) {
    out = out || new Float32Array(NB * 12);
    for (let i = 0; i < NB; i++) {
      const m = bones[i], o = i * 12, bp = bind ? bind[i] : null, bx = bp ? bp[0] * hs : 0, by = bp ? bp[1] * hs : 0, bz = bp ? bp[2] * hs : 0;
      out[o] = m[0]; out[o + 1] = m[1]; out[o + 2] = m[2]; out[o + 3] = m[3] - (m[0] * bx + m[1] * by + m[2] * bz);
      out[o + 4] = m[4]; out[o + 5] = m[5]; out[o + 6] = m[6]; out[o + 7] = m[7] - (m[4] * bx + m[5] * by + m[6] * bz);
      out[o + 8] = m[8]; out[o + 9] = m[9]; out[o + 10] = m[10]; out[o + 11] = m[11] - (m[8] * bx + m[9] * by + m[10] * bz);
    }
    return out;
  }

  // ---------- light ragdoll: 11 verlet points with distance constraints and ground contact ----------
  const RP = { hips: 0, chest: 1, head: 2, elL: 3, haL: 4, elR: 5, haR: 6, knL: 7, ftL: 8, knR: 9, ftR: 10 };
  function Rag(p, bones, vel, dt) {
    const hs = p.lk.hs, ll = p.lk.ll || 1;
    const P = (b, oy) => { const m = bones[b]; return oy ? mPt(m, 0, oy, 0) : [m[3], m[7], m[11]]; };
    this.pts = [P(B.hips), P(B.chest), P(B.head, 0.16 * hs), P(B.elL), P(B.haL), P(B.elR), P(B.haR), P(B.knL), P(B.ftL), P(B.knR), P(B.ftR)];
    this.prev = this.pts.map((q, i) => { const k = i === 0 || i === 1 ? 1 : i === 2 ? 0.95 : 0.75 + 0.3 * crand(); return [q[0] - vel[0] * k * dt, q[1] - vel[1] * k * dt, q[2] - vel[2] * k * dt]; });
    this.hs = hs; this.sw = p.lk.sw || 1; this.t = 0; this.rest = false; this.h = p.h; this.floor = 0; this.dt = dt;
    const L = (a, b, d, t) => ({ a, b, d: d * hs * ((a === 0 || a === 7 || a === 9) && b >= 7 ? ll : 1), t: t || 0 }); // t: 0 = equal, 1 = max, -1 = min (leg links scale with the leg length)
    this.cons = [L(0, 1, 0.4), L(1, 2, 0.54), L(0, 2, 0.94, 1), L(0, 2, 0.8, -1),
      L(1, 3, 0.48), L(3, 4, 0.32), L(1, 4, 0.78, 1), L(1, 4, 0.3, -1), L(1, 5, 0.48), L(5, 6, 0.32), L(1, 6, 0.78, 1), L(1, 6, 0.3, -1), L(3, 5, 0.5, -1), L(0, 3, 0.7, 1), L(0, 5, 0.7, 1),
      L(0, 7, 0.52), L(7, 8, 0.47), L(0, 8, 0.98, 1), L(0, 8, 0.5, -1), L(0, 9, 0.52), L(9, 10, 0.47), L(0, 10, 0.98, 1), L(0, 10, 0.5, -1), L(7, 9, 0.26, -1), L(8, 10, 0.2, -1), L(1, 7, 0.75, -1), L(1, 9, 0.75, -1), L(2, 7, 1.0, -1), L(2, 9, 1.0, -1)];
  }
  Rag.prototype.step = function (dt, floorAt) {
    const pts = this.pts, prev = this.prev; this.t += dt;
    let ke = 0;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i], o = prev[i], vx = (q[0] - o[0]) * 0.985, vy = (q[1] - o[1]) * 0.985, vz = (q[2] - o[2]) * 0.985;
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
      q[0] += vx; q[1] += vy - 24 * dt * dt; q[2] += vz;
      ke += vx * vx + vy * vy + vz * vz;
    }
    for (let it = 0; it < 4; it++) {
      for (const c of this.cons) {
        const a = pts[c.a], b = pts[c.b], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1e-4;
        if ((c.t === 1 && d <= c.d) || (c.t === -1 && d >= c.d)) continue;
        const k = (d - c.d) / d * 0.5, wa = c.a === 0 ? 0.35 : 0.5, wb = c.b === 0 ? 0.35 : 0.5, s = wa + wb;
        a[0] += dx * k * wa / s * 2; a[1] += dy * k * wa / s * 2; a[2] += dz * k * wa / s * 2;
        b[0] -= dx * k * wb / s * 2; b[1] -= dy * k * wb / s * 2; b[2] -= dz * k * wb / s * 2;
      }
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i], fl = (floorAt ? floorAt(q, i) : 0) + (i === 2 ? 0.17 : i === 0 || i === 1 ? 0.16 : 0.07) * this.hs;
        if (q[1] < fl) { q[1] = fl; const o = prev[i]; o[0] += (q[0] - o[0]) * 0.55; o[2] += (q[2] - o[2]) * 0.55; }
      }
    }
    if (ke < 0.00012 && this.t > 0.35) this.rest = true;
    this.vel = [(pts[0][0] - prev[0][0]) / dt, (pts[0][1] - prev[0][1]) / dt, (pts[0][2] - prev[0][2]) / dt];
  };
  Rag.prototype.impulse = function (ix, iy, iz, spread) {
    const w = [1, 0.95, 0.9, 0.6, 0.55, 0.6, 0.55, 0.5, 0.4, 0.5, 0.4];
    const dt = this.dt;
    for (let i = 0; i < this.pts.length; i++) { const k = w[i] * (1 + (spread || 0) * (crand() - 0.5)) * dt; this.prev[i][0] -= ix * k; this.prev[i][1] -= iy * k; this.prev[i][2] -= iz * k; }
  };
  Rag.prototype.bones = function () {
    const q = this.pts, hs = this.hs, out = new Array(NB);
    const hips = q[0], chest = q[1], head = q[2];
    let up = v3n(v3s(chest, hips));
    const hd = [Math.sin(this.h), 0, Math.cos(this.h)];
    let X = v3c(up, hd); if (Math.hypot(X[0], X[1], X[2]) < 1e-3) X = [1, 0, 0]; X = v3n(X);
    const Z = v3c(X, up);
    out[B.hips] = mAxes(hips, X, up, Z);
    out[B.spine] = mAxes(v3a(hips, up, 0.16 * hs), X, up, Z);
    const cj = v3a(hips, up, 0.4 * hs);
    out[B.chest] = mAxes(cj, X, up, Z);
    const nj = v3a(cj, up, 0.3 * hs);
    let up2 = v3n(v3s(head, nj)); let X2 = v3c(up2, Z); if (Math.hypot(X2[0], X2[1], X2[2]) < 1e-3) X2 = X; X2 = v3n(X2); const Z2 = v3c(X2, up2);
    out[B.neck] = mAxes(nj, X2, up2, Z2);
    out[B.head] = mAxes(v3a(nj, up2, 0.08 * hs), X2, up2, Z2);
    const fwd = Z;
    for (const [sh, el, ha, pe, ph, sd] of [[B.shL, B.elL, B.haL, 3, 4, -1], [B.shR, B.elR, B.haR, 5, 6, 1]]) {
      const S = mPt(out[B.chest], sd * 0.3 * hs * (this.sw || 1), 0.24 * hs, 0), E = q[pe], H = q[ph];
      out[sh] = mFromDown(S, v3s(E, S), fwd); out[el] = mFromDown(E, v3s(H, E), fwd); out[ha] = mFromDown(H, v3s(H, E), fwd);
    }
    for (const [hp, kn, ft, pk, pf, sd] of [[B.hipL, B.knL, B.ftL, 7, 8, -1], [B.hipR, B.knR, B.ftR, 9, 10, 1]]) {
      const J = mPt(out[B.hips], sd * 0.15 * hs, -0.03 * hs, 0), K = q[pk], F = q[pf];
      out[hp] = mFromDown(J, v3s(K, J), fwd); out[kn] = mFromDown(K, v3s(F, K), fwd); out[ft] = mFromDown(F, v3s(F, K), [fwd[0], -0.3, fwd[2]]);
    }
    return out;
  };

  // =====================================================================================
  // Athlete mesh: one smooth skinned surface per body type (two bone weights per vertex), lofted from anatomical
  // cross-sections, with the gear modelled as geometry over the body. Vertex: pos3 nrm3 bone2 weight slot uv2 ao (13 floats)
  // =====================================================================================
  const SL = { jer: 0, pant: 1, skin: 2, helm: 3, trim: 4, cleat: 5, pad: 6, mask: 7, num: 8, face: 9, arm: 10, name: 11, glove: 12, sock: 13, sole: 14, visor: 15, snum: 16, wht: 17, eye: 18, tape: 19, towel: 20, stripes: 21, mouth: 22 };
  const NSL = 23;
  // kit texture layout (fractions of the kit canvas), shared by the mesh UVs and the painter in Game
  const KIT = { torso: [0, 0, 1, 0.34], sleeve: [0, 0.34, 0.5, 0.47], glove: [0.5, 0.34, 1, 0.47], pant: [0, 0.47, 0.5, 0.72], sock: [0.5, 0.47, 1, 0.6], helm: [0, 0.72, 1, 1], stripes: [0.5, 0.6, 1, 0.72] };
  const HELM_TH = 2.62; // polar extent of the helmet shell (radians) -> v = theta / HELM_TH in the helmet region
  const VSTRIDE = 13;
  // bind-pose joint positions in body space for a shoulder width factor
  function bindFor(sw, ll) { const q = new Float32Array(PLEN); const m = fk(q, 0, 0, 0, 0, 1, sw, ll), y0 = m[0][7]; return m.map((b) => [b[3], b[7] - y0, b[11]]); }
  // body specs by position: height scale, girth, belly, shoulder width, leg/arm girth
  const BODY = {
    QB: { hs: 0.985, bulk: 1.0, belly: 0.05, sw: 1.0, legs: 1.06, arms: 1.0, neck: 1.0 },
    RB: { hs: 0.92, bulk: 1.06, belly: 0.05, sw: 1.0, legs: 1.22, arms: 1.05, neck: 1.08 },
    WR: { hs: 0.96, bulk: 0.9, belly: 0.0, sw: 0.95, legs: 1.0, arms: 0.9, neck: 0.95 },
    TE: { hs: 1.0, bulk: 1.14, belly: 0.15, sw: 1.06, legs: 1.1, arms: 1.1, neck: 1.1 },
    OL: { hs: 1.01, bulk: 1.3, belly: 0.9, sw: 1.14, legs: 1.28, arms: 1.24, neck: 1.2 },
    DL: { hs: 1.01, bulk: 1.26, belly: 0.7, sw: 1.12, legs: 1.25, arms: 1.22, neck: 1.18 },
    LB: { hs: 0.995, bulk: 1.12, belly: 0.1, sw: 1.05, legs: 1.1, arms: 1.1, neck: 1.1 },
    CB: { hs: 0.955, bulk: 0.88, belly: 0.0, sw: 0.94, legs: 1.0, arms: 0.88, neck: 0.95 },
    S: { hs: 0.965, bulk: 0.92, belly: 0.0, sw: 0.96, legs: 1.02, arms: 0.92, neck: 0.97 },
    K: { hs: 0.95, bulk: 0.88, belly: 0.0, sw: 0.96, legs: 0.95, arms: 0.85, neck: 0.95 },
    REF: { hs: 0.94, bulk: 0.9, belly: 0.25, sw: 0.96, legs: 0.9, arms: 0.85, neck: 0.95, cap: 1, noGear: 1 },
    COACH: { hs: 0.95, bulk: 1.0, belly: 0.5, sw: 1.0, legs: 1.0, arms: 0.95, neck: 1.0, cap: 1, noGear: 1, headset: 1 },
  };
  // body builds (look.build): multipliers on the position's body spec; hs height, ll leg length, belly -1 = flat, bellyAdd = extra belly
  const BUILDS6 = {
    slim: { bulk: 0.86, arms: 0.85, legs: 0.88, neck: 0.92, sw: 0.96, belly: -1 },
    lanky: { hs: 1.06, bulk: 0.84, arms: 0.84, legs: 0.86, neck: 0.9, sw: 0.95, belly: -1, ll: 1.06 },
    normal: {},
    stocky: { hs: 0.96, bulk: 1.12, arms: 1.1, legs: 1.14, neck: 1.12, sw: 1.04, bellyAdd: 0.15, ll: 0.95 },
    tank: { hs: 1.03, bulk: 1.24, arms: 1.22, legs: 1.2, neck: 1.22, sw: 1.12, bellyAdd: 0.25 },
    fat: { bulk: 1.2, arms: 1.12, legs: 1.18, neck: 1.18, sw: 1.04, bellyAdd: 1.7 },
    stubby: { hs: 0.92, bulk: 1.1, arms: 1.06, legs: 1.3, neck: 1.1, ll: 0.78, bellyAdd: 0.2 },
    tall: { hs: 1.07 },
    short: { hs: 0.93 },
  };
  const bodyKey = (s) => [s.bulk, s.belly, s.sw, s.legs, s.arms, s.neck, s.ll || 1, s.cap ? 1 : 0, s.noGear ? 1 : 0, s.headset ? 1 : 0].map((v) => Math.round(v * 100)).join(',');
  // a player's body: the position spec, shaped by his build (look.build) and his weight for his height; quantized so players share meshes
  const q20 = (v) => Math.round(v * 20) / 20;
  function bodySpec(base, lk, wgt) {
    const b = (lk && lk.build && BUILDS6[lk.build]) || null;
    if (!b && !(wgt > 0)) return base;
    const s = Object.assign({}, base);
    if (wgt > 0) { // heavier for his height -> thicker; the position spec already makes linemen big, so this only shades it
      const hsr = (lk && lk.hs) || 1, k = clamp(wgt / (135 * hsr * hsr * (base.bulk || 1)), 0.75, 1.5) - 1;
      s.bulk *= 1 + k * 0.45; s.arms *= 1 + k * 0.35; s.legs *= 1 + k * 0.35; s.neck *= 1 + k * 0.3; s.belly = Math.max(s.belly, s.belly + Math.max(0, k - 0.15) * 1.3);
    }
    if (b) {
      for (const k of ['bulk', 'arms', 'legs', 'neck', 'sw']) if (b[k]) s[k] *= b[k];
      if (b.belly === -1) s.belly = Math.min(s.belly, 0.02); if (b.bellyAdd) s.belly += b.bellyAdd;
      if (b.ll) s.ll = b.ll;
    }
    for (const k of ['bulk', 'arms', 'legs', 'neck', 'sw', 'belly']) s[k] = q20(s[k]);
    return s;
  }
  function buildBody(S, lod) {
    const V = [], I = [];
    let nv = 0;
    const Q = lod ? 0.62 : 1, HPI = Math.PI / 2, TAU = Math.PI * 2;
    const SG = (n) => Math.max(5, Math.round(n * Q));
    const BIND = bindFor(S.sw, S.ll || 1), LL = S.ll || 1;
    // leg rings are authored for the full-length leg: between the hip and the ankle they scale with the leg length, below it they just move up
    const legY = (y) => (y >= -1.0 ? -0.03 + (y + 0.03) * LL : y + 0.97 * (1 - LL));
    const push = (p, n, b0, b1, w0, s, u, v, ao) => { V.push(p[0], p[1], p[2], n[0], n[1], n[2], b0, b1, w0, s, u, v, ao); return nv++; };
    const angD = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
    // smooth two-bone weight for a ring at height y between joints j0 (bone a) and j1 (bone b); zone = half width of the blend
    const wt = (y, y0, y1, a, b, zone) => { zone = zone || 0.07; const mid = (y0 + y1) / 2; const t = clamp((y - (y1 - zone)) / (2 * zone), 0, 1); const s = t * t * (3 - 2 * t); return y <= y1 - zone ? [a, b, 1] : y >= y1 + zone ? [b, a, 1] : [a, b, 1 - s]; };
    // loft: rings = [{y, rx, rz, cx, cz, v, ao, w:[b0,b1,w0], f(an)->radius mult, s slot}] in loft space (axis Y, ring in XZ, angle 0 at +X; the front (+Z) at a quarter turn)
    // o: { s slot, seg, m placement (loft -> body space), uv [u0,u1,v0,v1], a0/a1 arc, mirrorU, capTop/capBot, skip(i,j,an), ao(i,an), flip, w default weights, open (no wrap seam) }
    function loft(o, rings) {
      const seg = o.seg || SG(12), m = o.m || IDM, uv = o.uv || [0, 1, 0, 1];
      const full = o.a0 == null, a0 = full ? -HPI : o.a0, a1 = full ? a0 + TAU : o.a1;
      // duplicate rings where the slot changes so each quad strip has one material
      const R = [];
      for (let i = 0; i < rings.length; i++) { const r = rings[i]; if (i > 0 && r.s != null && rings[i - 1].s != null && r.s !== rings[i - 1].s) R.push(Object.assign({}, rings[i - 1], { s: r.s, dup: 1 })); R.push(r); }
      const nR = R.length;
      let tot = 0; const tv = [0];
      for (let i = 1; i < nR; i++) { const a = R[i - 1], b = R[i]; tot += Math.hypot(b.y - a.y, (b.rx - a.rx) * 0.7, (b.rz - a.rz) * 0.7); tv.push(tot); }
      const P = [], Nn = [];
      for (let i = 0; i < nR; i++) {
        const r = R[i], cx = r.cx || 0, cz = r.cz || 0, row = [];
        for (let j = 0; j <= seg; j++) { const an = a0 + (a1 - a0) * j / seg, k = r.f ? r.f(an) : 1; row.push([cx + r.rx * k * Math.cos(an), r.y + (r.fy ? r.fy(an) : 0), cz + r.rz * k * Math.sin(an)]); }
        P.push(row);
      }
      for (let i = 0; i < nR; i++) {
        const row = [], r = R[i], cx = r.cx || 0, cz = r.cz || 0;
        for (let j = 0; j <= seg; j++) {
          const jm = full ? (j === 0 ? seg - 1 : j - 1) : Math.max(0, j - 1), jp = full ? (j === seg ? 1 : j + 1) : Math.min(seg, j + 1);
          const dR = v3s(P[i][jp], P[i][jm]);
          let im = i - 1, ip = i + 1; while (im > 0 && R[im].dup) im--; while (ip < nR - 1 && R[ip].dup) ip++; im = Math.max(0, im); ip = Math.min(nR - 1, ip);
          let dL = v3s(P[ip][j], P[im][j]);
          if (Math.hypot(dL[0], dL[1], dL[2]) < 1e-6) dL = [0, 1, 0];
          let n = v3c(dL, dR); const l = Math.hypot(n[0], n[1], n[2]);
          if (l < 1e-9) { const out = v3s(P[i][j], [cx, r.y, cz]); n = Math.hypot(out[0], out[1], out[2]) > 1e-6 ? v3n(out) : [0, 1, 0]; } else { n = [n[0] / l, n[1] / l, n[2] / l]; }
          const out = v3s(P[i][j], [cx, r.y, cz]); if (v3d(n, out) < 0 && Math.hypot(out[0], out[1], out[2]) > 1e-6) n = [-n[0], -n[1], -n[2]];
          if (o.flip) n = [-n[0], -n[1], -n[2]];
          row.push(n);
        }
        Nn.push(row);
      }
      const base = nv, bodyP = (p) => mPt(m, p[0], p[1], p[2]), bodyN = (n) => v3n([m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[4] * n[0] + m[5] * n[1] + m[6] * n[2], m[8] * n[0] + m[9] * n[1] + m[10] * n[2]]);
      for (let i = 0; i < nR; i++) {
        const r = R[i], w = r.w || o.w || [0, 0, 1], s = r.s != null ? r.s : o.s, vv = r.v != null ? r.v : tot > 0 ? tv[i] / tot : 0;
        for (let j = 0; j <= seg; j++) {
          const an = a0 + (a1 - a0) * j / seg, p = bodyP(P[i][j]), n = bodyN(Nn[i][j]);
          let u = j / seg; if (o.mirrorU) u = 1 - u;
          const ao = (r.ao != null ? r.ao : 1) * (o.ao ? o.ao(i, an) : 1);
          push(p, n, w[0], w[1], w[2], s, uv[0] + (uv[1] - uv[0]) * u, uv[2] + (uv[3] - uv[2]) * vv, ao);
        }
      }
      for (let i = 0; i < nR - 1; i++) {
        if (R[i + 1].dup) continue;
        for (let j = 0; j < seg; j++) {
          if (o.skip && o.skip(i, j, a0 + (a1 - a0) * (j + 0.5) / seg)) continue;
          const a = base + i * (seg + 1) + j, c = a + seg + 1;
          if (o.flip) I.push(a, a + 1, c, a + 1, c + 1, c); else I.push(a, c, a + 1, a + 1, c, c + 1);
        }
      }
      const cap = (i, dir) => {
        const r = R[i], w = r.w || o.w || [0, 0, 1], s = r.s != null ? r.s : o.s, c = bodyP([r.cx || 0, r.y + dir * Math.min(r.rx, r.rz) * 0.3, r.cz || 0]), n = bodyN([0, dir * (o.flip ? -1 : 1), 0]);
        const pole = push(c, n, w[0], w[1], w[2], s, uv[0] + (uv[1] - uv[0]) * 0.5, uv[2] + (uv[3] - uv[2]) * (r.v != null ? r.v : tot > 0 ? tv[i] / tot : 0), (r.ao != null ? r.ao : 1));
        for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j; if ((dir > 0) !== !!o.flip) I.push(pole, a, a + 1); else I.push(pole, a + 1, a); }
      };
      if (o.capTop) cap(0, 1); if (o.capBot) cap(nR - 1, -1);
    }
    function ellipsoid(o, c, rx, ry, rz, th0, th1, nR) {
      const rings = [];
      for (let i = 0; i <= nR; i++) { const th = th0 + (th1 - th0) * i / nR, s = Math.sin(th); rings.push(Object.assign({ y: c[1] + ry * Math.cos(th), rx: Math.max(1e-4, rx * s), rz: Math.max(1e-4, rz * s), cx: c[0], cz: c[2] }, o.ring ? o.ring(th, i) : {})); }
      loft(Object.assign({ capTop: th0 < 0.01, capBot: th1 > Math.PI - 0.01 }, o), rings);
    }
    // tube along a polyline (body space), circular section, closed ends; w = weights
    function tube(o, pts, r, seg, taper) {
      seg = seg || SG(6); const base = nv, n = pts.length, w = o.w || [0, 0, 1];
      const frames = []; let X = null;
      for (let i = 0; i < n; i++) {
        const T = v3n(v3s(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
        if (!X) { X = v3c(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]); } else { X = v3s(X, [T[0] * v3d(X, T), T[1] * v3d(X, T), T[2] * v3d(X, T)]); }
        X = v3n(X); const Y = v3c(T, X); frames.push([X, Y]);
      }
      for (let i = 0; i < n; i++) { const rr = taper ? r * taper(i / (n - 1)) : r; for (let j = 0; j <= seg; j++) { const an = j / seg * TAU, [X, Y] = frames[i], nn = v3a(v3a([0, 0, 0], X, Math.cos(an)), Y, Math.sin(an)), p = v3a(pts[i], nn, rr); push(p, nn, w[0], w[1], w[2], o.s, j / seg, i / (n - 1), o.ao == null ? 1 : o.ao); } }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j, c = a + seg + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
      for (const [i, dir] of [[0, -1], [n - 1, 1]]) {
        const T = v3n(v3s(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), c = pts[i], nn = [T[0] * dir, T[1] * dir, T[2] * dir];
        const pole = push(c, nn, w[0], w[1], w[2], o.s, 0.5, i / (n - 1), o.ao == null ? 1 : o.ao);
        for (let j = 0; j < seg; j++) { const a = base + i * (seg + 1) + j; if (dir > 0) I.push(pole, a, a + 1); else I.push(pole, a + 1, a); }
      }
    }
    const uvOf = (k, u0, u1, v0, v1) => { const r = KIT[k]; return [r[0] + (r[2] - r[0]) * (u0 || 0), r[0] + (r[2] - r[0]) * (u1 == null ? 1 : u1), r[1] + (r[3] - r[1]) * (v0 || 0), r[1] + (r[3] - r[1]) * (v1 == null ? 1 : v1)]; };
    const W = S.bulk, W2 = 0.6 + 0.4 * S.bulk, BEL = S.belly, gear = !S.noGear;
    const torsoW = (y) => { // weights along the spine: hips -> spine (0.16) -> chest (0.40) -> neck (0.70)
      if (y < 0.16) return wt(y, 0, 0.16, B.hips, B.spine, 0.06);
      if (y < 0.40) return wt(y, 0.16, 0.40, B.spine, B.chest, 0.07);
      return wt(y, 0.40, 0.70, B.chest, B.neck, 0.05);
    };
    const bellyK = (y) => BEL * Math.max(0, Math.sin(Math.PI * clamp((y - 0.06) / 0.34, 0, 1))); // 0..1 over the abdomen
    const T = (y, rx, rz, e) => { const bk = bellyK(y), r = Object.assign({ y, rx: rx * W * (1 + 0.1 * bk), rz: rz * W2 * (1 + 0.42 * bk), cz: 0.045 * bk, w: torsoW(y) }, e || {}); return r; };
    // ---- torso: jersey stretched over the shoulder pads (hard shelf + rounded caps), chest plate, tucked at the belt ----
    const shelf = gear ? 1 : 0;
    const torso = [T(0.745, 0.08, 0.07, { v: 0, ao: 0.5 }), T(0.728, 0.12, 0.098, { v: 0.025, ao: 0.68 }), T(0.705, 0.22 + 0.03 * shelf, 0.148, { v: 0.06, ao: 0.85 }),
      T(0.685, 0.305 + 0.05 * shelf, 0.182, { v: 0.1 }), T(0.665, 0.325 + 0.05 * shelf, 0.2, { v: 0.14 }), T(0.635, 0.32 + 0.045 * shelf, 0.208, { v: 0.19, ao: 0.92 }),
      T(0.58, 0.295 + 0.02 * shelf, 0.208, { v: 0.27 }), T(0.5, 0.268, 0.195, { v: 0.38, ao: 0.9 }), T(0.42, 0.245, 0.176, { v: 0.48 }), T(0.33, 0.228, 0.162, { v: 0.6 }),
      T(0.24, 0.218, 0.153, { v: 0.72 }), T(0.15, 0.212, 0.148, { v: 0.84, ao: 0.92 }), T(0.085, 0.212, 0.148, { v: 0.94, ao: 0.75 }), T(0.05, 0.205, 0.144, { v: 1, ao: 0.6 })];
    // pectoral / lat shaping: a little fuller at the front top and at the back for the lats
    for (const r of torso) { if (r.y > 0.45 && r.y < 0.65) r.f = (an) => 1 + 0.035 * Math.max(0, Math.sin(an)) * Math.abs(Math.cos(an)) * 2; }
    loft({ s: S.noGear && S.cap ? SL.stripes : SL.jer, seg: SG(28), uv: uvOf('torso'), ao: (i, an) => (i >= 4 && i <= 7 && Math.abs(Math.cos(an)) > 0.9 ? 0.72 : 1) }, torso);
    // decal patches (numbers / name plate) ride a hair above the jersey
    const patch = (s, y0, y1, aC, aW, scale) => {
      const rs = [];
      for (let i = 0; i <= 3; i++) {
        const y = y0 + (y1 - y0) * i / 3; let k = 1; while (k < torso.length - 1 && torso[k].y > y) k++;
        const a = torso[k - 1], b = torso[k], t = clamp((a.y - y) / (a.y - b.y || 1e-6), 0, 1);
        rs.push({ y, rx: lerp(a.rx, b.rx, t) * scale, rz: lerp(a.rz, b.rz, t) * scale, cz: lerp(a.cz, b.cz, t) * scale, w: torsoW(y), v: i / 3, ao: 0.95 });
      }
      loft({ s, seg: SG(8), a0: aC - aW, a1: aC + aW }, rs);
    };
    if (gear) {
      patch(SL.num, 0.5, 0.26, HPI, 0.5, 1.012);            // front number
      patch(SL.num, 0.56, 0.24, -HPI, 0.62, 1.012);          // back number
      if (!lod) patch(SL.name, 0.645, 0.585, -HPI, 0.75, 1.012); // name plate
    }
    // ---- neck + collar ----
    const NK = S.neck;
    loft({ s: SL.skin, seg: SG(12) }, [{ y: 0.69, rx: 0.068 * NK, rz: 0.062 * NK, w: [B.chest, B.neck, 0.7], ao: 0.5, cz: -0.005 }, { y: 0.745, rx: 0.062 * NK, rz: 0.058 * NK, w: [B.neck, B.chest, 0.8], ao: 0.6, cz: -0.004 }, { y: 0.8, rx: 0.06 * NK, rz: 0.057 * NK, w: [B.neck, B.head, 0.6], ao: 0.62 }, { y: 0.85, rx: 0.062 * NK, rz: 0.06 * NK, w: [B.head, B.neck, 0.85], ao: 0.6, cz: 0.004 }]);
    loft({ s: SL.trim, seg: SG(14) }, [{ y: 0.735, rx: 0.095 * W, rz: 0.082 * W2, w: torsoW(0.72), ao: 0.8 }, { y: 0.752, rx: 0.115 * W, rz: 0.098 * W2, w: torsoW(0.72) }, { y: 0.74, rx: 0.132 * W, rz: 0.112 * W2, w: torsoW(0.72) }]);
    // ---- head (human scale: ~0.2 yd wide, 0.26 tall): jaw, cheekbones, brow, crown; eye sockets; nose; ears ----
    const HW = [B.head, B.neck, 1];
    const faceF = (y) => (an) => { // radius modulation around the ring: eye sockets, cheekbones, chin, occipital bulge
      const f = Math.max(0, Math.sin(an));
      let k = 1;
      if (y > 0.935 && y < 0.985) k -= 0.06 * f * Math.max(0, 1 - Math.abs(Math.abs(angD(an, HPI)) - 0.4) * 2.6); // sockets
      if (y > 0.9 && y < 0.95) k += 0.035 * f * Math.max(0, Math.abs(angD(an, HPI)) - 0.5); // cheekbones
      if (y < 0.875) k += 0.07 * f * (1 - Math.min(1, Math.abs(angD(an, HPI)) * 1.5)); // chin forward
      k += 0.025 * Math.max(0, -Math.sin(an)); // occipital bulge
      return k;
    };
    const HR = [{ y: 0.828, rx: 0.04, rz: 0.044, cz: 0.034, ao: 0.6 }, { y: 0.85, rx: 0.066, rz: 0.072, cz: 0.022, ao: 0.7 }, { y: 0.878, rx: 0.083, rz: 0.09, cz: 0.011, ao: 0.78 }, { y: 0.905, rx: 0.093, rz: 0.1, cz: 0.005, ao: 0.85 }, { y: 0.932, rx: 0.099, rz: 0.104, cz: 0.002, ao: 0.88 },
      { y: 0.957, rx: 0.101, rz: 0.106, cz: 0.0, ao: 0.9 }, { y: 0.985, rx: 0.1, rz: 0.107, cz: 0.003, ao: 0.85 }, { y: 1.013, rx: 0.096, rz: 0.1, cz: 0.0, ao: 0.75 }, { y: 1.042, rx: 0.082, rz: 0.084, cz: -0.003, ao: 0.6 }, { y: 1.066, rx: 0.05, rz: 0.051, cz: -0.005, ao: 0.5 }, { y: 1.08, rx: 0.012, rz: 0.012, cz: -0.005, ao: 0.5 }];
    for (const r of HR) { r.w = HW; r.f = faceF(r.y); }
    loft({ s: SL.skin, seg: SG(20), capTop: false, capBot: true }, HR.slice().reverse());
    // face patch: the front arc of the head rings, slightly proud of the skin; photo UVs put the eyes at v ~ 0.4 and the chin at the bottom
    {
      const FR = [];
      const yTop = 1.045, yBot = 0.826;
      for (let i = HR.length - 1; i >= 0; i--) { const r = HR[i]; if (r.y > yTop + 0.02 || r.y < yBot) continue; FR.push(Object.assign({}, r, { rx: r.rx * 1.015 + 0.0015, rz: r.rz * 1.015 + 0.0015, v: clamp((yTop - r.y) / (yTop - yBot), 0, 1), ao: 0.95 })); }
      loft({ s: SL.face, seg: SG(10), a0: HPI - 1.3, a1: HPI + 1.3, mirrorU: true }, FR);
    }
    if (!lod) {
      // nose: bridge to tip
      loft({ s: SL.face, seg: SG(6), capBot: true, w: HW, uv: [0.49, 0.51, 0.47, 0.55] }, [{ y: 0.962, rx: 0.011, rz: 0.005, cz: 0.106, w: HW, ao: 0.95 }, { y: 0.942, rx: 0.013, rz: 0.009, cz: 0.113, w: HW, ao: 0.95 }, { y: 0.922, rx: 0.017, rz: 0.012, cz: 0.12, w: HW, ao: 0.92 }, { y: 0.909, rx: 0.015, rz: 0.009, cz: 0.116, w: HW, ao: 0.85 }]);
      // eyes: spheres in the sockets (the iris is shaded from the gaze direction)
      for (const sd of [-1, 1]) ellipsoid({ s: SL.eye, seg: SG(10), w: HW, ring: () => ({ w: HW, ao: 1 }) }, [sd * 0.035, 0.956, 0.09], 0.0145, 0.014, 0.0145, 0, Math.PI, 5);
      // ears
      for (const sd of [-1, 1]) ellipsoid({ s: SL.skin, seg: SG(8), w: HW, ring: () => ({ w: HW, ao: 0.7 }) }, [sd * 0.1, 0.945, -0.01], 0.01, 0.027, 0.019, 0, Math.PI, 4);
    }
    // ---- helmet (or a cap for sideline staff) ----
    const HEC = [0, 0.972, -0.01], HRR = [0.158, 0.172, 0.182];
    if (gear) {
      const helmSkip = (th) => (i, j, an) => { // face opening from just above the brow to the chin, widest at the cheeks, jaw flaps wrap back in; neck notch at the back
        const t = th(i + 0.5), d = Math.abs(angD(an, HPI));
        if (t > 1.2) { const w = t < 1.7 ? 0.45 + 0.5 * (t - 1.2) / 0.5 : t < 2.3 ? 0.95 - 0.33 * (t - 1.7) / 0.6 : 0.62 + (t - 2.3) * 2.4; if (d < w) return true; }
        if (t > 2.42 && Math.abs(angD(an, -HPI)) < 0.3 + (t - 2.42) * 2.5) return true;
        return false;
      };
      const NHR = lod ? 9 : 14, thAt = (i) => HELM_TH * i / NHR;
      const helmRing = (th, i) => { const flare = th > 2.0 ? 1 + 0.06 * (th - 2.0) : 1, brow = th > 0.9 && th < 1.4 ? 1.03 : 1, flat = th < 0.5 ? 0.985 + 0.015 * (th / 0.5) : 1; return { rx: Math.max(1e-4, HRR[0] * Math.sin(th) * flare * flat), rz: Math.max(1e-4, HRR[2] * Math.sin(th) * brow * flat), cz: HEC[2] + (th > 1.9 ? 0.028 * (th - 1.9) : 0), v: th / HELM_TH, w: HW,
        f: (an) => 1 + (th > 1.6 && th < 2.5 ? 0.04 * Math.pow(Math.abs(Math.cos(an)), 4) * Math.sin((th - 1.6) / 0.9 * Math.PI) : 0) }; }; // ear flap bulge
      ellipsoid({ s: SL.helm, seg: SG(30), uv: uvOf('helm'), skip: helmSkip(thAt), ring: helmRing, capTop: true }, HEC, HRR[0], HRR[1], HRR[2], 0, HELM_TH, NHR);
      if (!lod) ellipsoid({ s: SL.pad, seg: SG(30), uv: uvOf('helm'), skip: helmSkip(thAt), flip: true, ring: (th, i) => Object.assign(helmRing(th, i), { ao: 0.35, rx: Math.max(1e-4, HRR[0] * 0.94 * Math.sin(th)), rz: Math.max(1e-4, HRR[2] * 0.94 * Math.sin(th)) }) }, HEC, HRR[0] * 0.94, HRR[1] * 0.94, HRR[2] * 0.94, 0.35, HELM_TH, NHR);
      // jaw pads inside the ear flaps
      if (!lod) for (const sd of [-1, 1]) loft({ s: SL.pad, seg: SG(8), w: HW, capBot: true }, [{ y: 0.905, rx: 0.02, rz: 0.058, cx: sd * 0.118, cz: 0.025, w: HW, ao: 0.5 }, { y: 0.86, rx: 0.022, rz: 0.054, cx: sd * 0.112, cz: 0.032, w: HW, ao: 0.5 }, { y: 0.83, rx: 0.016, rz: 0.042, cx: sd * 0.1, cz: 0.036, w: HW, ao: 0.5 }]);
      // facemask: tubular bars (open cage; linemen get the extra lower bar)
      const arcPts = (y, r0, r2, aA, aB, n, bulge) => { const pts = []; for (let i = 0; i <= n; i++) { const an = aA + (aB - aA) * i / n, k = 1 + (bulge || 0) * Math.sin((i / n) * Math.PI); pts.push([HEC[0] + r0 * k * Math.cos(an), y, HEC[2] + r2 * k * Math.sin(an)]); } return pts; };
      const MR = lod ? 0.0115 : 0.0105, MSG = lod ? 5 : 8, NA = lod ? 8 : 14;
      for (const y of [0.962, 0.912, 0.862]) tube({ s: SL.mask, w: HW }, arcPts(y, 0.168, 0.196, HPI - 1.2, HPI + 1.2, NA, 0.03), MR, MSG);
      if (S.bulk > 1.15) tube({ s: SL.mask, w: HW }, arcPts(0.826, 0.155, 0.18, HPI - 0.95, HPI + 0.95, NA, 0.03), MR, MSG);
      tube({ s: SL.mask, w: HW }, [[0, 1.03, 0.168], [0, 0.995, 0.198], [0, 0.962, 0.206], [0, 0.912, 0.205], [0, 0.862, 0.197], [0, 0.828, 0.176]], MR, MSG);
      if (!lod) for (const sd of [-1, 1]) tube({ s: SL.mask, w: HW }, [[sd * 0.1, 0.99, 0.17], [sd * 0.104, 0.962, 0.176], [sd * 0.102, 0.912, 0.174], [sd * 0.098, 0.862, 0.167]], MR * 0.9, MSG);
      // chin strap with cups, snapped to the shell
      tube({ s: SL.wht, ao: 0.8, w: HW }, arcPts(0.822, 0.15, 0.14, HPI - 1.3, HPI + 1.3, 10, 0.02).map((p, i, a) => [p[0], p[1] - 0.01 * Math.sin((i / (a.length - 1)) * Math.PI), p[2]]), 0.008, 4);
      if (!lod) ellipsoid({ s: SL.wht, seg: SG(8), w: HW, ring: () => ({ w: HW }) }, [0, 0.818, 0.128], 0.036, 0.024, 0.024, 0, Math.PI, 3);
      // back bumper
      if (!lod) loft({ s: SL.trim, seg: SG(8), w: HW, capBot: true }, [{ y: 0.875, rx: 0.056, rz: 0.01, cz: -0.175, w: HW, ao: 0.8 }, { y: 0.848, rx: 0.052, rz: 0.01, cz: -0.167, w: HW, ao: 0.8 }]);
      // mouthguard dangling from the mask (between plays, some players)
      if (!lod) { tube({ s: SL.mouth, w: HW }, [[0.03, 0.862, 0.2], [0.035, 0.84, 0.205], [0.03, 0.815, 0.2]], 0.006, 4); loft({ s: SL.mouth, seg: SG(6), w: HW, capBot: true, m: mMul(mT(IDM, 0.03, 0.8, 0.2), mRX(IDM, 0.3)) }, [{ y: 0.012, rx: 0.028, rz: 0.012, w: HW }, { y: -0.012, rx: 0.026, rz: 0.01, w: HW }]); }
    } else {
      // cap: crown + bill
      ellipsoid({ s: SL.cleat, seg: SG(16), w: HW, ring: () => ({ w: HW, ao: 0.9 }) }, [0, 0.975, -0.004], 0.108, 0.105, 0.112, 0, 1.75, 6);
      loft({ s: SL.cleat, seg: SG(8), w: HW, a0: HPI - 1.2, a1: HPI + 1.2 }, [{ y: 0.978, rx: 0.108, rz: 0.112, cz: -0.004, w: HW }, { y: 0.973, rx: 0.13, rz: 0.155, cz: 0.015, w: HW }, { y: 0.965, rx: 0.125, rz: 0.185, cz: 0.025, w: HW }]);
      if (S.headset && !lod) { tube({ s: SL.wht, w: HW }, arcPts2(0.995, 0.112, 0.115, 0, Math.PI, 8), 0.01, 5); tube({ s: SL.wht, w: HW }, [[-0.115, 0.94, 0.0], [-0.1, 0.925, 0.06], [-0.06, 0.9, 0.105]], 0.007, 4); }
    }
    function arcPts2(y, r0, r2, aA, aB, n) { const pts = []; for (let i = 0; i <= n; i++) { const an = aA + (aB - aA) * i / n; pts.push([r0 * Math.cos(an), y + 0.02 * Math.sin(an), -0.004 + r2 * Math.sin(an) * 0.1]); } return pts; }
    // visor: its own index range, drawn blended, hidden when not worn
    const vi0 = I.length;
    if (!lod && gear) ellipsoid({ s: SL.visor, seg: SG(12), a0: HPI - 1.0, a1: HPI + 1.0, w: HW, ring: () => ({ ao: 1, w: HW }) }, [0, 0.958, -0.004], 0.142, 0.148, 0.162, 1.15, 1.68, 3);
    const vin = I.length - vi0;
    // ---- arms: deltoid -> biceps -> elbow -> forearm -> wrist as one surface ----
    for (const sd of [-1, 1]) {
      const sh = sd < 0 ? B.shL : B.shR, el = sd < 0 ? B.elL : B.elR, ha = sd < 0 ? B.haL : B.haR, X = BIND[sh][0], AW = S.arms, mir = sd < 0;
      const SY = 0.64, EY = 0.28, HY = -0.04; // joint heights
      const aw = (y) => (y > EY + 0.06 ? [sh, el, 1] : y < EY - 0.06 ? [el, sh, 1] : wt(y, SY, EY, sh, el, 0.06));
      const sleeve = gear ? SL.jer : SL.stripes, armS = S.sleeves ? SL.arm : SL.skin;
      const rings = [
        { y: 0.705, rx: 0.075 * AW, rz: 0.072 * AW, cx: X + sd * 0.025, s: sleeve, ao: 0.85, w: [sh, B.chest, 0.6] }, { y: 0.675, rx: 0.118 * AW, rz: 0.11 * AW, cx: X + sd * 0.03, s: sleeve, w: [sh, B.chest, 0.8] }, { y: 0.62, rx: 0.125 * AW, rz: 0.118 * AW, cx: X + sd * 0.022, s: sleeve, w: [sh, el, 1] },
        { y: 0.55, rx: 0.112 * AW, rz: 0.106 * AW, cx: X + sd * 0.012, s: sleeve, ao: 0.9, w: [sh, el, 1] }, { y: 0.5, rx: 0.1 * AW, rz: 0.095 * AW, cx: X + sd * 0.006, s: sleeve, ao: 0.85, w: [sh, el, 1] },
        { y: 0.5, rx: 0.092 * AW, rz: 0.088 * AW, cx: X + sd * 0.004, s: armS, ao: 0.8, w: [sh, el, 1] }, { y: 0.44, rx: 0.088 * AW, rz: 0.09 * AW, cx: X + sd * 0.002, cz: 0.004, s: armS, w: [sh, el, 1], f: (an) => 1 + 0.06 * Math.max(0, Math.sin(an)) }, // biceps
        { y: 0.37, rx: 0.08 * AW, rz: 0.08 * AW, cx: X, s: armS, w: [sh, el, 1] }, { y: 0.31, rx: 0.071 * AW, rz: 0.069 * AW, cx: X, s: armS, w: aw(0.31) }, { y: 0.28, rx: 0.068 * AW, rz: 0.066 * AW, cx: X, cz: -0.004, s: armS, w: aw(0.28) },
        { y: 0.25, rx: 0.069 * AW, rz: 0.067 * AW, cx: X, s: armS, w: aw(0.25) }, { y: 0.19, rx: 0.074 * AW, rz: 0.072 * AW, cx: X, s: armS, w: [el, sh, 1] }, { y: 0.11, rx: 0.062 * AW, rz: 0.058 * AW, cx: X, s: armS, w: [el, sh, 1] },
        { y: 0.03, rx: 0.052 * AW, rz: 0.046 * AW, cx: X, s: armS, w: [el, ha, 1] }, { y: 0.0, rx: 0.05 * AW, rz: 0.043 * AW, cx: X, s: armS, w: [el, ha, 0.85] }];
      loft({ s: sleeve, seg: SG(16), uv: uvOf('sleeve'), mirrorU: mir, capTop: true, ao: (i, an) => (i >= 2 && i <= 5 && Math.cos(an) * sd < -0.5 ? 0.72 : 1) }, rings);
      if (!lod && gear) { // sleeve number
        const rs = []; for (let i = 0; i <= 2; i++) { const y = 0.645 - 0.08 * i; rs.push({ y, rx: (0.127 - 0.011 * i) * AW, rz: (0.119 - 0.011 * i) * AW, cx: X + sd * 0.024, v: i / 2, ao: 0.95, w: [sh, el, 1] }); }
        loft({ s: SL.snum, seg: SG(6), a0: (sd > 0 ? 0 : Math.PI) - 0.5, a1: (sd > 0 ? 0 : Math.PI) + 0.5 }, rs);
      }
      // wrist tape
      if (!lod) loft({ s: SL.tape, seg: SG(10) }, [{ y: 0.015, rx: 0.054 * AW, rz: 0.048 * AW, cx: X, w: [el, ha, 0.7] }, { y: -0.02, rx: 0.054 * AW, rz: 0.047 * AW, cx: X, w: [ha, el, 0.9] }, { y: -0.045, rx: 0.052 * AW, rz: 0.046 * AW, cx: X, w: [ha, el, 1] }]);
      // hand: gloved palm with knuckles, four fingers and a thumb (fingers only at full detail)
      const HWt = [ha, el, 1], GS = gear ? SL.glove : SL.skin;
      loft({ s: GS, seg: SG(10), uv: uvOf('glove'), capBot: true, w: HWt }, [{ y: -0.035, rx: 0.048, rz: 0.03, cx: X, w: HWt }, { y: -0.09, rx: 0.06, rz: 0.032, cx: X, cz: 0.004, w: HWt }, { y: -0.14, rx: 0.062, rz: 0.03, cx: X, cz: 0.006, w: HWt }, { y: -0.175, rx: 0.058, rz: 0.028, cx: X, cz: 0.006, w: HWt, ao: 0.85 }]);
      if (!lod) {
        for (let f = 0; f < 4; f++) { const fx = X + sd * (-0.042 + 0.028 * f), len = [0.075, 0.085, 0.08, 0.065][f], curl = 0.35; tube({ s: GS, w: HWt }, [[fx, -0.175, 0.008], [fx, -0.175 - len * 0.5, 0.008 + curl * len * 0.3], [fx, -0.175 - len * 0.82, 0.008 + curl * len * 0.9], [fx, -0.175 - len, 0.008 + curl * len * 1.6]], 0.0125, 5, (t) => 1 - 0.25 * t); }
        tube({ s: GS, w: HWt }, [[X + sd * 0.045, -0.07, 0.012], [X + sd * 0.072, -0.1, 0.034], [X + sd * 0.085, -0.13, 0.05]], 0.016, 5, (t) => 1 - 0.2 * t);
      } else loft({ s: GS, seg: SG(8), w: HWt, capBot: true }, [{ y: -0.175, rx: 0.055, rz: 0.028, cx: X, cz: 0.012, w: HWt }, { y: -0.245, rx: 0.042, rz: 0.024, cx: X, cz: 0.03, w: HWt }, { y: -0.27, rx: 0.02, rz: 0.012, cx: X, cz: 0.04, w: HWt }]);
    }
    // ---- pelvis + legs: hip -> thigh (pads) -> knee -> calf -> ankle as one surface; socks; cleats ----
    const pel = (y, rx, rz, e) => Object.assign({ y: y < -0.03 ? legY(y) : y, rx: rx * (0.85 + 0.15 * S.legs) * (1 + 0.08 * BEL), rz: rz * W2 * (1 + 0.12 * BEL), cz: 0.02 * BEL, w: torsoW(Math.max(0, y)) }, e || {});
    const PS = gear ? SL.pant : SL.pant;
    loft({ s: PS, seg: SG(24), uv: uvOf('pant', 0, 1, 0, 0.38), capBot: true }, [pel(0.17, 0.205, 0.142, { v: 0 }), pel(0.1, 0.212, 0.148, { v: 0.3 }), pel(0.0, 0.228, 0.16, { v: 0.6, f: (an) => 1 + 0.05 * Math.max(0, -Math.sin(an)) }), pel(-0.1, 0.212, 0.155, { v: 0.85, ao: 0.82, w: [B.hips, B.hips, 1], f: (an) => 1 + 0.08 * Math.max(0, -Math.sin(an)) }), pel(-0.18, 0.165, 0.13, { v: 1, ao: 0.62, w: [B.hips, B.hips, 1] })]);
    for (const sd of [-1, 1]) {
      const hp = sd < 0 ? B.hipL : B.hipR, kn = sd < 0 ? B.knL : B.knR, ft = sd < 0 ? B.ftL : B.ftR, X = sd * 0.15, LW = S.legs;
      const KY = -0.53, FY = -1.0;
      const lw = (y) => (y > KY + 0.07 ? [hp, kn, 1] : y < KY - 0.07 ? [kn, hp, 1] : wt(y, 0, KY, hp, kn, 0.07));
      const inner = (i, an) => (i <= 2 && Math.cos(an) * sd < -0.6 ? 0.7 : 1);
      const legR = [
        { y: -0.02, rx: 0.14 * LW, rz: 0.135 * LW, cx: X, cz: 0.012, v: 0, ao: 0.8, w: [hp, B.hips, 0.75], s: PS }, { y: -0.14, rx: 0.135 * LW, rz: 0.135 * LW, cx: X, cz: 0.02, v: 0.2, w: [hp, kn, 1], s: PS, f: (an) => 1 + 0.03 * Math.max(0, Math.sin(an)) },
        { y: -0.27, rx: 0.122 * LW, rz: 0.125 * LW, cx: X, cz: 0.018, v: 0.42, w: [hp, kn, 1], s: PS, f: (an) => 1 + 0.05 * Math.max(0, Math.sin(an)) }, // thigh pad
        { y: -0.4, rx: 0.105 * LW, rz: 0.108 * LW, cx: X, cz: 0.01, v: 0.62, w: lw(-0.4), s: PS }, { y: -0.49, rx: 0.094 * LW, rz: 0.1 * LW, cx: X, cz: 0.014, v: 0.78, w: lw(-0.49), s: PS, f: (an) => 1 + 0.06 * Math.max(0, Math.sin(an)) }, // knee pad
        { y: -0.555, rx: 0.088 * LW, rz: 0.092 * LW, cx: X, cz: 0.01, v: 0.9, w: lw(-0.555), s: PS }, { y: -0.63, rx: 0.081 * LW, rz: 0.081 * LW, cx: X, v: 1, w: [kn, hp, 1], s: PS, ao: 0.85 },
        { y: -0.63, rx: 0.076 * LW, rz: 0.076 * LW, cx: X, w: [kn, hp, 1], s: SL.skin, ao: 0.75 }, { y: -0.7, rx: 0.08 * LW, rz: 0.084 * LW, cx: X, cz: -0.012, w: [kn, hp, 1], s: SL.skin, f: (an) => 1 + 0.1 * Math.max(0, -Math.sin(an)) }, // calf
        { y: -0.78, rx: 0.072 * LW, rz: 0.074 * LW, cx: X, cz: -0.008, w: [kn, ft, 1], s: SL.skin }, { y: -0.8, rx: 0.07 * LW, rz: 0.072 * LW, cx: X, cz: -0.008, w: [kn, ft, 1], s: SL.sock },
        { y: -0.88, rx: 0.062 * LW, rz: 0.064 * LW, cx: X, cz: -0.004, w: [kn, ft, 1], s: SL.sock }, { y: -0.95, rx: 0.054 * LW, rz: 0.056 * LW, cx: X, w: [kn, ft, 0.8], s: SL.sock }, { y: -1.0, rx: 0.05 * LW, rz: 0.054 * LW, cx: X, w: [ft, kn, 0.8], s: SL.sock, ao: 0.8 }, { y: -1.04, rx: 0.046 * LW, rz: 0.05 * LW, cx: X, cz: -0.006, w: [ft, kn, 1], s: SL.sock, ao: 0.7 }];
      // pants and socks have their own UV regions; the loft takes one uv box, so split the strip by slot
      for (const r of legR) r.y = legY(r.y); // weights above were set on the full-length leg
      loft({ s: PS, seg: SG(16), uv: uvOf('pant', 0, 1, 0.38, 1), mirrorU: sd < 0, ao: inner }, legR.filter((r) => r.s === PS));
      loft({ s: SL.skin, seg: SG(16) }, legR.filter((r) => r.s === SL.skin));
      loft({ s: SL.sock, seg: SG(12), uv: uvOf('sock') }, legR.filter((r) => r.s === SL.sock));
      // shoe: heel counter -> arch -> ball -> toe box, lofted along +Z; sole plate; studs at full detail
      const FW = [ft, ft, 1];
      const shoeM = mMul(mT(IDM, X, legY(-1.05), -0.012), mRX(IDM, -HPI)); // loft -Y -> body +Z, loft +Z -> body +Y
      const shoe = [{ y: 0.1, rx: 0.03, rz: 0.024, w: FW }, { y: 0.075, rx: 0.046, rz: 0.034, w: FW }, { y: 0.02, rx: 0.052, rz: 0.04, cz: 0.008, w: FW, ao: 0.85 }, { y: -0.05, rx: 0.054, rz: 0.038, cz: 0.012, w: FW, f: (an) => 1 + 0.08 * Math.max(0, Math.sin(an)) }, { y: -0.12, rx: 0.056, rz: 0.03, cz: 0.004, w: FW }, { y: -0.18, rx: 0.05, rz: 0.024, w: FW }, { y: -0.225, rx: 0.028, rz: 0.012, w: FW }];
      loft({ s: SL.cleat, seg: SG(12), m: shoeM, capTop: true, capBot: true }, shoe);
      loft({ s: SL.sole, seg: SG(10), m: mMul(mT(IDM, X, legY(-1.074), -0.012), mRX(IDM, -HPI)), capTop: true, capBot: true }, shoe.map((r) => ({ y: r.y, rx: r.rx + 0.004, rz: 0.008, cz: 0, w: FW })));
      if (!lod) for (const [sx, sz] of [[-0.03, 0.17], [0.03, 0.17], [-0.035, 0.1], [0.035, 0.1], [0, 0.04], [-0.02, -0.05], [0.02, -0.05]]) tube({ s: SL.sole, w: FW }, [[X + sx, legY(-1.082), sz], [X + sx, legY(-1.1), sz]], 0.006, 4, (t) => 1 - 0.4 * t);
    }
    // ---- belt towel (hidden for players who do not carry one) ----
    if (gear) {
      const TW = [B.hips, B.hips, 1], tx = -0.13, pts = [];
      for (let i = 0; i <= 4; i++) pts.push({ y: 0.1 - i * 0.095, rx: 0.062 - 0.005 * i, rz: 0.005, cx: tx, cz: 0.19 * (0.85 + 0.15 * S.bulk) + 0.006 * i, w: TW, v: i / 4 });
      loft({ s: SL.towel, seg: SG(6), capBot: true, w: TW }, pts);
    }
    return { v: new Float32Array(V), i: new Uint16Array(I), n: I.length, nv, vi0, vin, bind: BIND, sw: S.sw, ll: LL };
  }

  // =====================================================================================
  // Game: mounts one full game in `root`. done(result) is called once when it ends or is quit.
  // =====================================================================================
  function Game(root, opts, done) {
    injectCSS();
    opts = opts || {};
    const QS = clamp(Math.round(+opts.quarterSecs || 120), 30, 900);
    const TOS = clamp(opts.timeouts == null ? 2 : opts.timeouts | 0, 0, 5);
    const DIFF = clamp(+opts.difficulty || 0, 0, 1);
    const WX = ['clear', 'rain', 'snow', 'night'].indexOf(opts.weather) >= 0 ? opts.weather : 'night';
    const WET = WX === 'rain' ? 1 : WX === 'snow' ? 0.8 : 0;
    const rng = mkRng(opts.seed || 'blitz-' + Date.now());
    const DBG = window.__blitzDebug || null;
    const sfx = Sfx();
    let cs = 20240611; const crandL = () => ((cs = (cs * 1664525 + 1013904223) >>> 0) / 4294967296); // cosmetic only
    crand = crandL;

    // ---------- teams ----------
    const normTeam = (t, dn) => {
      t = t || {};
      return { name: String(t.name || dn).slice(0, 28), abbr: String(t.abbr || String(t.name || dn).replace(/[^A-Za-z]/g, '').slice(0, 3) || 'CPU').toUpperCase().slice(0, 4),
        color: hex(t.color), color2: hex(t.color2), ovrOff: clamp(+t.ovrOff || 60, 20, 99), ovrDef: clamp(+t.ovrDef || 60, 20, 99), players: Array.isArray(t.players) ? t.players.filter((p) => p && p.name) : [] };
    };
    const HOME = normTeam(opts.home, 'Home'), AWAY = normTeam(opts.away, 'Visitors');
    const TEAM = HOME.color || hex('#ffc21a');
    let TEAM2 = HOME.color2 || hex('#1b1e27');
    if (Math.abs(lum(TEAM) - lum(TEAM2)) < 0.12) TEAM2 = lum(TEAM) > 0.5 ? hex('#15171d') : hex('#f2f4f7');
    const O1 = AWAY.color || hex('#c8102e'), O2 = AWAY.color2 || hex('#f2f4f7');
    const away2 = cdist(O1, TEAM) < 0.35;
    const DEFA = O1, OPPCSS = css(lum(O1) < 0.2 ? O2 : O1), HOMECSS = css(lum(TEAM) < 0.2 ? TEAM2 : TEAM);
    const OFFC = { jer: TEAM, pad: shade(TEAM, 1.15), pant: TEAM2, helm: TEAM2, stripe: TEAM, num: lum(TEAM) > 0.5 ? shade(TEAM2, 0.9) : mixc(TEAM2, [1, 1, 1, 1], 0.5) };
    OFFC.glove = TEAM2; OFFC.sock = TEAM; OFFC.mask = lum(TEAM2) < 0.4 ? TEAM2 : hex('#8d93a0');
    const DEFC = away2 ? { jer: O2, pad: shade(O2, 1.05), pant: O1, helm: O1, stripe: O2, num: O1 } : { jer: O1, pad: shade(O1, 1.12), pant: O2, helm: O1, stripe: O2, num: lum(O1) > 0.5 ? shade(O2, 0.9) : mixc(O2, [1, 1, 1, 1], 0.5) };
    DEFC.glove = DEFC.helm; DEFC.sock = DEFC.jer; DEFC.mask = hex('#8d93a0');
    const WHITEC = hex('#f2f3f5'), DARKC = hex('#15171c'), VISORC = hex('#5a6678'), BALLC = hex('#7a3e17'), LACE = hex('#f5f6f8');
    const SKIN = ['#f3cfae', '#dcaa83', '#b98056', '#8a5535', '#5a361f'].map(hex);
    const CLEATS = { black: hex('#111318'), white: hex('#f2f4f7'), team: TEAM, gold: hex('#ffc21a'), red: hex('#d81f2a') };
    const KDEF = clamp(Math.pow(DIFF, 0.8) * 0.8 + (AWAY.ovrDef - 62) / 250 + 0.05, 0, 1.12);
    const DP = defParams(KDEF);

    // ---------- the user's roster ----------
    // Two shapes arrive: the 11-player Lineup (pos QB, RB, WR1-3, TE, UTIL1-2, OL1-3 with ratings in `r`) and the older lists
    // (pos QB/RB/WR/TE/OL/K/UTIL with flat ratings, e.g. Franchise). The Lineup maps WR1->X, WR2->Z, WR3->S, TE->Y and
    // UTIL1, UTIL2, OL1, OL2, OL3 -> the five offensive linemen, left to right.
    const rawPos = (p) => String(p.pos || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normPos = (p) => { const s = String(p.pos || '').toUpperCase().replace(/[^A-Z]/g, ''); return s === 'UTIL' || s === 'FLEX' || s === 'ATH' || s === 'SLOT' ? 'WR' : s; };
    const rv = (p, k) => (p ? +(p.r && typeof p.r === 'object' && p.r[k] != null ? p.r[k] : p[k]) : NaN);
    const rat = (p, k, d) => { const v = rv(p, k); return clamp(isFinite(v) && v > 0 ? v : d, 25, 99); };
    const safeUrl = (u) => (typeof u === 'string' && /^\/[A-Za-z0-9_\-./%]+$/.test(u) && u.indexOf('..') < 0 ? u : null);
    // body builds (look.build): multipliers on the position's body spec; ll = leg length, hs = height
    const BUILDS = BUILDS6;
    const normLook = (l, dflt, r) => {
      l = l && typeof l === 'object' ? l : {};
      const sk = Number.isInteger(l.skin) ? clamp(l.skin, 0, 4) : dflt;
      const b = BUILDS[l.build] ? l.build : null;
      // real height in inches (54..78) sets the size; otherwise the look's short / tall
      const hin = r ? rv(r, 'hgt') : NaN;
      let hs = isFinite(hin) && hin > 40 ? clamp(1 + (clamp(hin, 54, 78) - 64) * 0.011, 0.88, 1.15) : l.height === 'short' ? 0.93 : l.height === 'tall' ? 1.07 : 1;
      if (b) hs *= BUILDS[b].hs || 1;
      return { skin: sk, hs, cleat: CLEATS[l.cleats] || CLEATS.black, visor: !!l.visor, sleeves: !!l.sleeves, build: b, ll: b ? BUILDS[b].ll || 1 : 1 };
    };
    const pool = HOME.players.slice(), used = new Set();
    const take = (pred) => { const p = pool.find((q) => !used.has(q) && pred(q)); if (p) used.add(p); return p || null; };
    const isPos = (...ps) => (q) => ps.indexOf(normPos(q)) >= 0;
    const LSLOT = { QB: 'QB', RB: 'RB', WR1: 'X', WR2: 'Z', WR3: 'S', TE: 'Y', UTIL1: 'OL0', UTIL2: 'OL1', OL1: 'OL2', OL2: 'OL3', OL3: 'OL4' };
    const LINEUP = pool.some((q) => /^(WR[123]|UTIL[12]|OL[123])$/.test(rawPos(q)));
    const SK = {}, OLP = [null, null, null, null, null];
    if (LINEUP) {
      for (const q of pool) { const s = LSLOT[rawPos(q)]; if (!s) continue; if (s.startsWith('OL')) { const i = +s.slice(2); if (!OLP[i]) { OLP[i] = q; used.add(q); } } else if (!SK[s]) { SK[s] = q; used.add(q); } }
      // a short Lineup: fill the empty skill spots from anyone left over, then from the utility linemen
      for (const k of ['QB', 'X', 'Z', 'S', 'Y', 'RB']) if (!SK[k]) { SK[k] = take(() => true); if (!SK[k]) for (const i of [1, 0, 4, 3, 2]) if (OLP[i]) { SK[k] = OLP[i]; OLP[i] = null; break; } }
    } else {
      SK.QB = take(isPos('QB')) || take((q) => !normPos(q) || normPos(q) === 'QB') || take(() => true);
      SK.RB = take(isPos('RB'));
      SK.X = take(isPos('WR')); SK.Z = take(isPos('WR')); SK.S = take(isPos('WR'));
      SK.Y = take(isPos('TE'));
      for (const k of ['X', 'Z', 'S', 'Y', 'RB']) if (!SK[k]) SK[k] = take(isPos('WR', 'TE', 'RB')) || take((q) => ['OL', 'DL', 'LB', 'DB', 'K'].indexOf(normPos(q)) < 0);
      for (let i = 0; i < 5; i++) OLP[i] = take(isPos('OL'));
    }
    // the kicker: a real K if the roster has one, otherwise whoever in the Lineup has the best leg
    let KICKER = take(isPos('K'));
    if (!KICKER) { let bk = 0; for (const q of HOME.players) { const k = rv(q, 'kick'); if (isFinite(k) && k > bk) { bk = k; KICKER = q; } } }
    const baseR = clamp(HOME.ovrOff, 35, 95);
    const GEN = { QB: ['QB', 7], RB: ['Runner', 22], X: ['Flash', 1], Z: ['Hands', 81], S: ['Rocket', 19], Y: ['Tank', 88] };
    const numOf = (q) => { const s = String(q.num != null ? q.num : q.number != null ? q.number : '').trim(); return /^\d{1,2}$/.test(s) ? +s : null; };
    const fxOf = (q) => (q && q.fx && typeof q.fx === 'object' ? { variant: String(q.fx.variant || ''), set: q.fx.set ? String(q.fx.set) : null, par: q.fx.par ? String(q.fx.par) : null, rarity: String(q.fx.rarity || 'common'), spec: q.fx.spec ? String(q.fx.spec) : null } : null);
    const SQ = {};
    let sqi = 0;
    for (const k of ['QB', 'RB', 'X', 'Z', 'S', 'Y']) {
      const q = SK[k], g = GEN[k];
      const num = q && numOf(q) != null ? numOf(q) : g[1];
      SQ[k] = {
        key: k, idx: sqi++, name: q ? String(q.name) : g[0], pid: q ? String(q.id != null ? q.id : q.name) : null, num, photo: q ? safeUrl(q.photo) : null,
        look: normLook(q && q.look, [1, 2, 0, 3, 1, 2][sqi - 1], q), cell: -1, fx: fxOf(q),
        r: { spd: rat(q, 'spd', baseR), agi: rat(q, 'agi', rat(q, 'spd', baseR)), str: rat(q, 'str', baseR), cat: rat(q, 'cat', baseR), thr: rat(q, 'thr', baseR), acc: rat(q, 'acc', baseR), ovr: rat(q, 'ovr', baseR), sta: rat(q, 'sta', baseR), wgt: clamp(isFinite(rv(q, 'wgt')) && rv(q, 'wgt') > 0 ? rv(q, 'wgt') : 0, 0, 260) },
      };
    }
    // the offensive line: real Lineup players (name, number, face, ratings, look) or generated linemen
    for (let i = 0; i < 5; i++) {
      const q = OLP[i], k = 'OL' + i;
      SQ[k] = {
        key: k, idx: sqi++, ol: true, real: !!q, name: q ? String(q.name) : 'Lineman', pid: q ? String(q.id != null ? q.id : q.name) : null, num: q && numOf(q) != null ? numOf(q) : [72, 65, 55, 61, 77][i],
        photo: q ? safeUrl(q.photo) : null, look: q ? normLook(q.look, (i * 2 + 1) % 5, q) : null, cell: -1, fx: fxOf(q),
        r: { str: rat(q, 'str', clamp(HOME.ovrOff, 40, 90)), spd: rat(q, 'spd', 45), agi: rat(q, 'agi', 50), sta: rat(q, 'sta', 60), cat: rat(q, 'cat', 40), wgt: clamp(isFinite(rv(q, 'wgt')) && rv(q, 'wgt') > 0 ? rv(q, 'wgt') : 0, 0, 260) },
      };
    }
    const KR = { name: KICKER ? String(KICKER.name) : 'Kicker', pid: KICKER ? String(KICKER.id != null ? KICKER.id : KICKER.name) : null, kick: rat(KICKER, 'kick', clamp(52 + (HOME.ovrOff - 60) * 0.5, 40, 80)) };
    const shortName = (s) => { const p = String(s).trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).slice(0, 12); };

    // ---------- stats ----------
    const ST = {};
    const stat = (pid) => (pid ? ST[pid] || (ST[pid] = { passAtt: 0, passCmp: 0, passYds: 0, passTD: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTD: 0, rec: 0, recYds: 0, recTD: 0, fgAtt: 0, fgMade: 0, sacked: 0, yac: 0, long: 0 }) : null);
    const TS = { plays: 0, yards: 0, timeOfPoss: 0, turnovers: 0, sacks: 0, thirdDownConv: 0, thirdDownAtt: 0, firstDowns: 0, passYds: 0, rushYds: 0, penalties: 0 };
    const CPUS = { plays: 0, yards: 0, drives: 0, top: 0 };
    const HL = [];

    // ---------- DOM ----------
    root.innerHTML = '';
    const wrap = el('div', 'bz-wrap');
    const stage = el('div', 'bz-stage');
    const cv = el('canvas', 'bz-cv'); cv.tabIndex = 0; cv.setAttribute('aria-label', 'Football field');
    const tagL = el('div', 'bz-tags'), fx = el('div', 'bz-fx');
    stage.append(cv, tagL, fx);
    const bug = el('div', 'bz-bug'), tick = el('div', 'bz-tick'), ctl = el('div', 'bz-ctl');
    wrap.append(stage, bug, tick, ctl);
    root.appendChild(wrap);


    // ---------- WebGL (2 when available, else 1 + extensions) ----------
    let gl = null, GL2 = false;
    try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' }); GL2 = !!gl; } catch (e) { gl = null; }
    if (!gl) { try { gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl', { antialias: false, alpha: false }); } catch (e) { gl = null; } }
    if (!gl) {
      root.innerHTML = '<div class="bz-err"><b>NO 3D HERE</b>Sorry, your browser can\'t run 3D graphics (WebGL is turned off or blocked on this device).</div>';
      setTimeout(() => done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, noGL: true, stats: {}, team: Object.assign({}, TS), highlights: [] }), 0);
      return { destroy() {} };
    }
    // capability shim
    const X = (() => {
      const x = { gl2: GL2 };
      const ext = (n) => { try { return gl.getExtension(n); } catch (e) { return null; } };
      if (GL2) {
        x.inst = { drawArraysInstanced: (m, f, c, n) => gl.drawArraysInstanced(m, f, c, n), drawElementsInstanced: (m, c, t, o, n) => gl.drawElementsInstanced(m, c, t, o, n), vertexAttribDivisor: (i, d) => gl.vertexAttribDivisor(i, d) };
        x.depthTex = true; x.deriv = true; x.derivExt = '';
        const cbf = ext('EXT_color_buffer_float'), cbh = ext('EXT_color_buffer_half_float');
        x.half = !!(cbf || cbh); x.halfLinear = x.half; x.halfFmt = gl.RGBA16F; x.halfType = gl.HALF_FLOAT;
      } else {
        const ia = ext('ANGLE_instanced_arrays');
        x.inst = ia ? { drawArraysInstanced: (m, f, c, n) => ia.drawArraysInstancedANGLE(m, f, c, n), drawElementsInstanced: (m, c, t, o, n) => ia.drawElementsInstancedANGLE(m, c, t, o, n), vertexAttribDivisor: (i, d) => ia.vertexAttribDivisorANGLE(i, d) } : null;
        x.depthTex = !!ext('WEBGL_depth_texture') || !!ext('WEBKIT_WEBGL_depth_texture');
        x.deriv = !!ext('OES_standard_derivatives'); x.derivExt = x.deriv ? '#extension GL_OES_standard_derivatives : enable\n' : '';
        const th = ext('OES_texture_half_float'), cbh = ext('EXT_color_buffer_half_float');
        x.half = !!(th && cbh); x.halfLinear = !!ext('OES_texture_half_float_linear'); x.halfFmt = gl.RGBA; x.halfType = th ? th.HALF_FLOAT_OES : 0;
      }
      x.aniso = ext('EXT_texture_filter_anisotropic') || ext('WEBKIT_EXT_texture_filter_anisotropic');
      x.maxAniso = x.aniso ? gl.getParameter(x.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
      x.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      x.maxVU = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 128;
      let hp = false; try { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); hp = !!(f && f.precision > 0); } catch (e) { hp = false; }
      x.hp = hp ? 'highp' : 'mediump';
      return x;
    })();
    let G = null, glLost = false, finished = false;
    const touchy = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window && (navigator.maxTouchPoints || 0) > 0);
    // on a phone or tablet the game takes the whole screen until you quit or finish (iPhones have no fullscreen API for pages)
    const fixedMode = touchy && !(opts && opts.inline);
    const savedScroll = window.scrollY || 0;
    if (fixedMode) { wrap.classList.add('bz-fixed'); document.documentElement.classList.add('bz-lock'); }
    let quality = touchy ? 1 : 2; // 0 = low (1 cascade, no post effects), 1 = medium (2 cascades, bloom), 2 = high (3 cascades, SSAO, grass, DOF, motion blur)
    const statics = [];
    const DRAWS = { n: 0, tris: 0 };
    function mkTex(src, repeat, nomip, linearMip) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (src.width) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const mip = !!src.width && !nomip;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (mip) {
        gl.generateMipmap(gl.TEXTURE_2D);
        if (X.aniso) gl.texParameterf(gl.TEXTURE_2D, X.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(linearMip || 8, X.maxAniso));
      }
      return t;
    }
    // light rig, sky and fog per weather (linear HDR values)
    const SKY = {
      night: { top: [0.004, 0.006, 0.016], hor: [0.05, 0.07, 0.13], fog: [0.012, 0.016, 0.03], fogR: [50, 330, 0.55], amb: [0.07, 0.085, 0.14], gnd: [0.04, 0.055, 0.04], sun: [2.4, 2.25, 1.95], L: [0.36, 0.78, -0.34], night: 1, cloud: 0.3, glow: 1.0, tower: 1.15, exp: 0.9, soft: 1.0, env: 1.0 },
      clear: { top: [0.1, 0.28, 0.75], hor: [0.55, 0.68, 0.85], fog: [0.5, 0.62, 0.82], fogR: [110, 520, 0.4], amb: [0.42, 0.55, 0.85], gnd: [0.22, 0.28, 0.16], sun: [2.7, 2.5, 2.2], L: [-0.48, 0.72, 0.42], night: 0, cloud: 0.5, glow: 0.0, tower: 0.0, exp: 0.52, soft: 0.7, env: 1.0 },
      rain: { top: [0.08, 0.09, 0.11], hor: [0.26, 0.28, 0.31], fog: [0.22, 0.24, 0.27], fogR: [30, 220, 0.8], amb: [0.36, 0.38, 0.42], gnd: [0.12, 0.14, 0.12], sun: [0.75, 0.77, 0.8], L: [0.22, 0.9, -0.3], night: 0, cloud: 1.4, glow: 0.6, tower: 0.55, exp: 0.85, soft: 2.2, env: 0.8 },
      snow: { top: [0.3, 0.33, 0.4], hor: [0.62, 0.64, 0.7], fog: [0.6, 0.62, 0.68], fogR: [28, 190, 0.85], amb: [0.6, 0.62, 0.7], gnd: [0.42, 0.42, 0.45], sun: [1.1, 1.1, 1.15], L: [0.22, 0.9, -0.3], night: 0, cloud: 1.3, glow: 0.4, tower: 0.4, exp: 0.7, soft: 2.4, env: 0.9 },
    }[WX];
    const LDIR = v3n(SKY.L);
    // the four light banks: position + intensity, colour (slightly cool metal-halide white)
    const TOWERS = [[-50, 36, 18], [50, 36, 18], [-50, 36, 82], [50, 36, 82]];
    const LPOS = TOWERS.map((t) => [t[0], t[1], t[2], 1500 * SKY.tower]);
    const LCOL = [0.98, 0.97, 1.0];
    // the shaders are written in GLSL ES 1.00; on a WebGL2 context they are mechanically lifted to 3.00 (derivatives need it there)
    function es3(src, isFS) {
      src = src.replace(/#extension[^\n]*\n/g, '');
      if (isFS) { src = src.replace(/varying /g, 'in ').replace(/texture2D\(/g, 'texture(').replace(/textureCube\(/g, 'texture(').replace(/gl_FragColor/g, 'oC'); if (src.indexOf('//OUT') >= 0) src = src.replace('//OUT', 'out vec4 oC;'); else src = src.replace(/(precision (?:highp|mediump) float;)/, '$1out vec4 oC;'); }
      else src = src.replace(/attribute /g, 'in ').replace(/varying /g, 'out ');
      return '#version 300 es\n' + src;
    }
    function mkProg(vs, fs, defines) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 300)); return s; };
      const hpd = '#define HP ' + X.hp + '\n';
      let vsrc = hpd + vs, fsrc = hpd + (defines || '') + fs;
      if (GL2) { vsrc = es3(vsrc, false); fsrc = es3(fsrc, true); }
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsrc)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const P = { pr, a: {}, u: {} };
      const na = gl.getProgramParameter(pr, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(pr, i).name; P.a[n] = gl.getAttribLocation(pr, n); }
      const nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); P.u[n] = gl.getUniformLocation(pr, n); }
      return P;
    }
    // framebuffer: colour texture (RGBA8 or half float) + optional depth (texture when available, else renderbuffer)
    function mkFBO(w, h, depth, hdr, depthTex) {
      const fb = gl.createFramebuffer(), tex = gl.createTexture();
      const useHalf = hdr && X.half;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (useHalf) gl.texImage2D(gl.TEXTURE_2D, 0, X.halfFmt, w, h, 0, gl.RGBA, X.halfType, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const filt = useHalf && !X.halfLinear ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      let rb = null, dt = null;
      if (depth) {
        if (depthTex && X.depthTex) {
          dt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dt);
          if (GL2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
          else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0);
        } else { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
      }
      let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      if (!ok && useHalf) { // half float colour not renderable after all: fall back to RGBA8
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; X.half = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex, rb, dt, w, h, ok, hdr: useHalf && ok };
    }
    // shadow atlas: n cascades side by side; a depth texture when available, else packed RGBA depth
    function mkShadow(size, n) {
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      let tex = null, rb = null, dt = null;
      if (X.depthTex) {
        dt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dt);
        if (GL2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size * n, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size * n, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0);
        if (!GL2) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size * n, size); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb); }
      } else {
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size * n, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size * n, size); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      }
      let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex: dt || tex, rb, dt, w: size * n, h: size, size, n, ok, packed: !dt };
    }
    function delFBO(f) { if (!f) return; try { gl.deleteFramebuffer(f.fb); if (f.tex) gl.deleteTexture(f.tex); if (f.dt && f.dt !== f.tex) gl.deleteTexture(f.dt); if (f.rb) gl.deleteRenderbuffer(f.rb); } catch (e) {} }
    const NCASC = () => (quality >= 2 ? 3 : quality === 1 ? 2 : 1);
    const SHADOW_SZ = () => (quality >= 2 ? 2048 : quality === 1 ? 1024 : 768);
    let shadowPacked = false;
    // ---- body meshes per body type (two LODs) ----
    function meshFor(spec) {
      const key = bodyKey(spec);
      let m = G.meshes[key];
      if (!m) {
        m = G.meshes[key] = [];
        for (const lod of [0, 1]) {
          const b = buildBody(spec, lod), vb = gl.createBuffer(), ib = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, b.v, gl.STATIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.i, gl.STATIC_DRAW);
          m[lod] = { vb, ib, n: b.n, vi0: b.vi0, vin: b.vin, bind: b.bind, nv: b.nv }; G.bufs.push(vb, ib);
        }
      }
      return m;
    }
    function setupGL() {
      G = { bufs: [], texs: [], progs: [], meshes: {} };
      const ncasc = NCASC();
      shadowPacked = !X.depthTex;
      const defs = (extra) => X.derivExt + FS_PRE + (X.deriv ? '#define DERIV\n' : '') + (shadowPacked ? '#define SHADOW_PACKED\n' : '') + (extra || '');
      const lib = (fs) => fs.replace('#LIB#', SH_LIB);
      G.world = mkProg(VS_WORLD, lib(FS_WORLD), defs()); G.worldHi = mkProg(VS_WORLD, lib(FS_WORLD), defs('#define PCF_HI\n'));
      G.skin = mkProg(VS_SKIN, lib(FS_SKIN), defs()); G.skinHi = mkProg(VS_SKIN, lib(FS_SKIN), defs('#define PCF_HI\n'));
      G.depthW = mkProg(VS_DEPTH_W, shadowPacked ? FS_DEPTH_PACK : FS_DEPTH_NONE); G.depthS = mkProg(VS_DEPTH_S, shadowPacked ? FS_DEPTH_PACK : FS_DEPTH_NONE);
      G.sky = mkProg(VS_QUAD, FS_SKY, FS_PRE); G.crowd = mkProg(VS_CROWD, FS_CROWD, FS_PRE);
      G.grass = X.inst ? mkProg(VS_GRASS, FS_GRASS, FS_PRE) : null;
      G.ao = mkProg(VS_QUAD, FS_AO, FS_PRE); G.blur4 = mkProg(VS_QUAD, FS_BLUR4, FS_PRE);
      G.extract = mkProg(VS_QUAD, FS_EXTRACT, FS_PRE); G.blur = mkProg(VS_QUAD, FS_BLUR, FS_PRE); G.dofmb = mkProg(VS_QUAD, FS_DOFMB, FS_PRE); G.final = mkProg(VS_QUAD, FS_FINAL, FS_PRE);
      for (const k of ['world', 'worldHi', 'skin', 'skinHi', 'depthW', 'depthS', 'sky', 'crowd', 'grass', 'ao', 'blur4', 'extract', 'blur', 'dofmb', 'final']) if (G[k]) G.progs.push(G[k].pr);
      G.white = mkTex(new Uint8Array([255, 255, 255, 255]));
      G.black = mkTex(new Uint8Array([0, 0, 0, 255]));
      G.flatN = mkTex(new Uint8Array([128, 128, 255, 128]));
      G.field = mkTex(fieldCanvas(quality >= 2 ? 2 : 1), false, false, 16);
      G.detail = mkTex(detailCanvas(), true, false, 8);
      G.fabric = mkTex(fabricCanvas(), true, false, 4);
      G.board = mkTex(boardCanvas()); boardDirty = false;
      G.ribbon = mkTex(ribbonCanvas(), true, false, 4);
      G.seats = mkTex(seatCanvas(), true, false, 8);
      G.atlas = mkTex(atlas, false, true); atlasDirty = true;
      G.texs.push(G.white, G.black, G.flatN, G.field, G.detail, G.fabric, G.board, G.ribbon, G.seats, G.atlas);
      G.dyn = gl.createBuffer(); G.tr = gl.createBuffer(); G.quad = gl.createBuffer(); G.fxb = gl.createBuffer(); G.bufs.push(G.fxb);
      G.fxTex = mkTex(spriteCanvas(), false, false, 1); G.texs.push(G.fxTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      G.bufs.push(G.dyn, G.tr, G.quad);
      for (const k in BODY) if (!BODY[k].noGear) meshFor(BODY[k]);
      G.kitO = mkTex(kitCanvas(OFFC, HOME.abbr, HOME.name), false, false, 8); G.kitD = mkTex(kitCanvas(DEFC, AWAY.abbr, AWAY.name), false, false, 8); G.kitR = mkTex(kitCanvas(REFC, '', '', true), false, false, 8);
      G.crowdT = mkTex(crowdCanvas(), false, false, 4);
      G.texs.push(G.kitO, G.kitD, G.kitR, G.crowdT);
      statics.length = 0;
      const W = buildWorld();
      for (const k of ['plain', 'seats', 'field', 'glow', 'board', 'ribbon', 'glass']) {
        if (!W[k] || !W[k].n) continue;
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, W[k].f.subarray(0, W[k].n * 12), gl.STATIC_DRAW);
        G.bufs.push(b);
        const S = { k, b, n: W[k].n, tex: k === 'field' ? G.field : k === 'board' ? G.board : k === 'ribbon' ? G.ribbon : k === 'seats' ? G.seats : G.white, cast: k === 'plain' || k === 'seats', kind: k === 'field' ? 1 : 0 };
        S.mat = k === 'field' ? [0.85, 0, 1, 0] : k === 'plain' ? [0.7, 0, 0, 0] : k === 'seats' ? [0.75, 0, 0, 0] : k === 'glow' ? [0.5, 0, 0, 6.0 * (0.25 + 0.75 * SKY.glow)] : k === 'board' ? [0.4, 0, 0, 1.6] : k === 'ribbon' ? [0.4, 0, 0, 2.2] : [0.08, 0.6, 0, 0];
        statics.push(S);
      }
      G.crowdB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.crowdB); gl.bufferData(gl.ARRAY_BUFFER, W.crowd.f.subarray(0, W.crowd.n * 12), gl.STATIC_DRAW); G.crowdN = W.crowd.n; G.bufs.push(G.crowdB);
      // grass blade mesh + instance ids
      if (G.grass) {
        const bl = [], NSEG = 3; // blade: 2 strips of quads tapering to a point
        for (let s = 0; s < NSEG; s++) { const t0 = s / NSEG, t1 = (s + 1) / NSEG, w0 = 1 - t0 * 0.8, w1 = 1 - t1 * 0.85; bl.push(-w0, t0, 0, t0, w0, t0, 1, t0, -w1, t1, 0, t1, -w1, t1, 0, t1, w0, t0, 1, t0, w1, t1, 1, t1); }
        bl.push(-0.15, 1, 0, 1, 0.15, 1, 1, 1, 0, 1.12, 0.5, 1);
        G.bladeB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.bladeB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bl), gl.STATIC_DRAW); G.bladeN = bl.length / 4;
        G.GN = 112; const ids = new Float32Array(G.GN * G.GN * 4); for (let i = 0; i < G.GN * G.GN; i++) { ids[i * 4] = i; }
        G.instB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.instB); gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW); G.bufs.push(G.bladeB, G.instB);
      }
      G.env = null; G.shadow = null; G.scene = null; G.scene2 = null; G.bloomA = null; G.bloomB = null; G.aoA = null; G.aoB = null; G.feed = null;
      setupTargets();
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.clearColor(SKY.hor[0], SKY.hor[1], SKY.hor[2], 0);
      buildEnv();
    }
    function setupTargets() {
      delFBO(G.shadow); delFBO(G.scene); delFBO(G.scene2); delFBO(G.bloomA); delFBO(G.bloomB); delFBO(G.aoA); delFBO(G.aoB);
      G.shadow = G.scene = G.scene2 = G.bloomA = G.bloomB = G.aoA = G.aoB = null;
      G.shadow = mkShadow(Math.min(SHADOW_SZ(), Math.floor(X.maxTex / NCASC())), NCASC());
      if (!G.shadow.ok) { delFBO(G.shadow); G.shadow = null; }
      G.scene = mkFBO(cv.width, cv.height, true, quality >= 1, quality >= 1);
      if (!G.scene.ok) { delFBO(G.scene); G.scene = null; }
      if (quality >= 1 && G.scene) {
        const bw = Math.max(64, cv.width >> 2), bh = Math.max(64, cv.height >> 2);
        G.bloomA = mkFBO(bw, bh, false); G.bloomB = mkFBO(bw, bh, false);
        if (!G.bloomA.ok || !G.bloomB.ok) { delFBO(G.bloomA); delFBO(G.bloomB); G.bloomA = G.bloomB = null; }
      }
      delFBO(G.feed); G.feed = null;
      if (quality >= 2 && G.scene && G.scene.dt) {
        G.feed = mkFBO(384, 192, true, true); if (!G.feed.ok) { delFBO(G.feed); G.feed = null; }
        G.scene2 = mkFBO(cv.width, cv.height, false, true);
        const aw = Math.max(64, cv.width >> 1), ah = Math.max(64, cv.height >> 1);
        G.aoA = mkFBO(aw, ah, false); G.aoB = mkFBO(aw, ah, false);
        if (!G.aoA.ok || !G.aoB.ok) { delFBO(G.aoA); delFBO(G.aoB); G.aoA = G.aoB = null; }
        if (!G.scene2.ok) { delFBO(G.scene2); G.scene2 = null; }
      }
    }

    // ---------- textures ----------
    const ezOwn = shade(TEAM, 0.5), ezFar = shade(DEFA, 0.55);
    let fieldC = null, fieldScale = 1;
    function fieldCanvas(k) {
      cs = 20240611;
      const c = document.createElement('canvas'); const CW = 1024 * k, CH = 2048 * k; c.width = CW; c.height = CH; const g = c.getContext('2d');
      fieldC = c; fieldScale = k;
      const SX = CW / 60, SZ = CH / 124, X = (x) => (x + 30) * SX, Z = (z) => (z + 12) * SZ;
      const snow = WX === 'snow', wet = WX === 'rain';
      // base turf tones
      const base = snow ? '#5f7a63' : wet ? '#1d4a26' : '#265d2f';
      g.fillStyle = base; g.fillRect(0, 0, CW, CH);
      // mow pattern: alternating 5-yard bands with a soft edge, the far bands slightly bluer
      for (let i = -2; i < 24; i++) {
        const light = i % 2 === 0;
        g.fillStyle = snow ? (light ? '#6e8a70' : '#627e68') : wet ? (light ? '#235632' : '#193f22') : (light ? '#2e7239' : '#1e4f27');
        g.fillRect(X(-HW) - 2 * SX, Z(i * 5), (X(HW) - X(-HW)) + 4 * SX, 5 * SZ + 1);
      }
      // large-scale patchiness
      for (let i = 0; i < 500 * k; i++) { const x = crand() * CW, y = crand() * CH, r = (10 + crand() * 50) * k; const gr = g.createRadialGradient(x, y, 0, x, y, r); const dark = crand() < 0.5; gr.addColorStop(0, dark ? 'rgba(10,40,10,0.05)' : 'rgba(150,190,90,0.035)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
      // blade strokes
      const nb = 42000 * k * k;
      for (let i = 0; i < nb; i++) {
        const x = crand() * CW, y = crand() * CH, l = (2 + crand() * 5) * k, v = crand();
        g.strokeStyle = v < 0.35 ? 'rgba(140,200,110,0.1)' : v < 0.7 ? 'rgba(0,30,0,0.12)' : 'rgba(90,150,60,0.08)'; g.lineWidth = k;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (crand() - 0.5) * 2 * k, y - l); g.stroke();
      }
      // wear between the hashes and the numbers (brown earth showing through), heavier in the middle of the field
      for (let i = 0; i < 900 * k; i++) { const zz = 8 + crand() * 84, mid = 1 - Math.abs(zz - 50) / 50; if (crand() > 0.3 + 0.7 * mid) continue; g.fillStyle = (wet ? 'rgba(60,45,25,' : 'rgba(105,85,45,') + (0.035 + crand() * 0.06) + ')'; const x = X((crand() - 0.5) * 2 * (4 + crand() * 8)), y = Z(zz); g.beginPath(); g.ellipse(x, y, (4 + crand() * 16) * k, (2 + crand() * 7) * k, crand() * 3, 0, 6.3); g.fill(); }
      // end zones: painted turf in team colours with a faint stripe texture and the team names
      g.fillStyle = css(ezOwn); g.fillRect(X(-HW), Z(-10), X(HW) - X(-HW), 10 * SZ);
      g.fillStyle = css(ezFar); g.fillRect(X(-HW), Z(100), X(HW) - X(-HW), 10 * SZ);
      for (let i = 0; i < 9000 * k; i++) { g.fillStyle = crand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; const y = crand() < 0.5 ? Z(-10 + crand() * 10) : Z(100 + crand() * 10); g.fillRect(crand() * CW, y, (1 + crand() * 2) * k, (2 + crand() * 5) * k); }
      if (snow) for (let i = 0; i < 20000 * k; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.1 + crand() * 0.3) + ')'; g.fillRect(crand() * CW, crand() * CH, (2 + crand() * 6) * k, (2 + crand() * 6) * k); }
      // painted lines: a soft bleed halo under a crisp core, worn by noise toward the middle
      const paint = (x0, z0, x1, z1, alpha) => { for (const [o, a] of [[1.6 * k, 0.22], [0, 0.93 * (alpha || 1)]]) { g.fillStyle = `rgba(240,243,236,${a})`; g.fillRect(X(x0) - o, Z(z0) - o, X(x1) - X(x0) + o * 2, Z(z1) - Z(z0) + o * 2); } };
      for (let z = 0; z <= 100; z += 5) { const w = z % 100 === 0 ? 0.18 : 0.11; paint(-HW, z - w, HW, z + w); }
      paint(-HW - 1.4, -10.4, -HW, 110.4); paint(HW, -10.4, HW + 1.4, 110.4); paint(-HW - 1.4, -11.4, HW + 1.4, -10); paint(-HW - 1.4, 110, HW + 1.4, 111.4);
      for (let z = 1; z < 100; z++) {
        if (z % 5 === 0) continue;
        for (const hx of [-3.08, 3.08]) paint(hx - 0.35, z - 0.055, hx + 0.35, z + 0.055);
        paint(-HW + 0.3, z - 0.055, -HW + 1.0, z + 0.055); paint(HW - 1.0, z - 0.055, HW - 0.3, z + 0.055);
      }
      paint(-0.5, 2.94, 0.5, 3.06); paint(-0.5, 96.94, 0.5, 97.06);
      // wear on the paint
      for (let i = 0; i < 6000 * k; i++) { const zl = Math.round(crand() * 20) * 5, x = X((crand() - 0.5) * 2 * HW), y = Z(zl) + (crand() - 0.5) * 0.3 * SZ; g.fillStyle = 'rgba(40,90,40,' + (0.1 + crand() * 0.25) + ')'; g.fillRect(x, y, (1 + crand() * 3) * k, (1 + crand() * 2) * k); }
      const txt = (s, x, z, rot, hYd, col, maxW, weight) => {
        g.save(); g.translate(X(x), Z(z)); g.scale(1, -1); g.rotate(rot);
        g.font = `${weight || 900} ${Math.round(hYd * SZ * 1.32)}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (maxW) { const w = g.measureText(s).width; if (w > maxW * SX) g.scale((maxW * SX) / w, 1); }
        g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
      };
      for (let z = 10; z <= 90; z += 10) {
        const n = String(z <= 50 ? z : 100 - z);
        txt(n, -HW + 9, z, -Math.PI / 2, 2, 'rgba(240,243,236,.88)'); txt(n, HW - 9, z, Math.PI / 2, 2, 'rgba(240,243,236,.88)');
        if (z !== 50) { const dz = z < 50 ? -1 : 1; for (const sx of [-1, 1]) { const x = sx * (HW - 9), zz = z + dz * 2.6; g.fillStyle = 'rgba(240,243,236,.88)'; g.beginPath(); g.moveTo(X(x - 0.45), Z(zz)); g.lineTo(X(x + 0.45), Z(zz)); g.lineTo(X(x), Z(zz + dz * 0.8)); g.fill(); } }
      }
      // midfield logo painted on the grass
      g.globalAlpha = 0.88;
      g.beginPath(); g.arc(X(0), Z(50), 5.4 * SX, 0, 6.2832); g.fillStyle = css(shade(TEAM, 0.85)); g.fill();
      g.lineWidth = 0.4 * SX; g.strokeStyle = '#f2f5ee'; g.stroke();
      g.beginPath(); g.arc(X(0), Z(50), 4.3 * SX, 0, 6.2832); g.lineWidth = 0.15 * SX; g.strokeStyle = css(TEAM2); g.stroke();
      txt(HOME.abbr, 0, 50, 0, 3.2, css(TEAM2), 8);
      g.globalAlpha = 0.92;
      txt(HOME.name.toUpperCase(), 0, -5, Math.PI, 5.2, css(lum(TEAM) > 0.55 ? shade(TEAM, 1.15) : hex('#f2f5ee')), 40);
      txt(AWAY.name.toUpperCase(), 0, 105, 0, 5.4, css(O2[0] + O2[1] + O2[2] > 1.2 ? O2 : hex('#f2f5ee')), 40);
      g.globalAlpha = 1;
      // sideline mats and the coaches' box lines
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(X(-29.9), Z(30), X(-28.3) - X(-29.9), Z(70) - Z(30)); g.fillRect(X(28.3), Z(30), X(29.9) - X(28.3), Z(70) - Z(30));
      g.fillStyle = 'rgba(70,75,85,.75)'; g.fillRect(X(-33.6), Z(-11), X(-30.5) - X(-33.6), Z(111) - Z(-11)); g.fillRect(X(30.5), Z(-11), X(33.6) - X(30.5), Z(111) - Z(-11));
      return c;
    }
    // divots / scuffs appear where players go down
    function scuff(x, z, big) {
      if (!fieldC || !G) return;
      const g = fieldC.getContext('2d'), k = fieldScale, SX = fieldC.width / 60, SZ = fieldC.height / 124, px = (x + 30) * SX, pz = (z + 12) * SZ;
      if (z < -9 || z > 109 || Math.abs(x) > HW) return;
      for (let i = 0; i < (big ? 5 : 3); i++) { g.fillStyle = (WX === 'rain' ? 'rgba(50,38,22,' : 'rgba(95,78,45,') + (0.18 + crand() * 0.2) + ')'; g.beginPath(); g.ellipse(px + (crand() - 0.5) * 14 * k, pz + (crand() - 0.5) * 14 * k, (3 + crand() * 6) * k, (1.5 + crand() * 3) * k, crand() * 3, 0, 6.3); g.fill(); }
      scuffs.push([px, pz]); if (scuffs.length > 60) scuffs.shift();
      fieldDirty = true;
    }
    const scuffs = []; let fieldDirty = false, fieldUpT = 0;
    // tiled grass detail: r = brightness variation, gb = normal xy, a = height
    function detailCanvas() {
      cs = 4242;
      const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      const h = new Float32Array(N * N);
      const stamp = (x, y, l, w, a, v) => { // a blade: a short line into the height field (wrapping)
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let t = 0; t <= l; t += 0.7) { const px = x + ca * t, py = y + sa * t, k = v * (0.4 + 0.6 * t / l); for (let dx = -w; dx <= w; dx++) for (let dy = -w; dy <= w; dy++) { const ix = ((px + dx) % N + N) % N | 0, iy = ((py + dy) % N + N) % N | 0; const f = 1 - Math.hypot(dx, dy) / (w + 1); if (f > 0) h[iy * N + ix] = Math.max(h[iy * N + ix], k * f); } }
      };
      for (let i = 0; i < 14000; i++) stamp(crand() * N, crand() * N, 6 + crand() * 14, 1 + (crand() < 0.3 ? 1 : 0), crand() * 6.28, 0.45 + crand() * 0.55);
      const img = g.createImageData(N, N), d = img.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
        const nx = -hx * 1.6, ny = -hy * 1.6, nl = Math.hypot(nx, ny, 1);
        const o = i * 4; d[o] = 128 + (h[i] - 0.45) * 110 + (crand() - 0.5) * 30; d[o + 1] = 128 + (nx / nl) * 127; d[o + 2] = 128 + (ny / nl) * 127; d[o + 3] = clamp(h[i] * 255, 0, 255);
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    // tiled woven-fabric normal map (rgb) with a roughness variation in alpha
    function fabricCanvas() {
      const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      const img = g.createImageData(N, N), d = img.data, cell = 16;
      const hAt = (x, y) => { // mesh holes on a grid with a slight weave
        const u = ((x % cell) + cell) % cell - cell / 2, v = ((y % cell) + cell) % cell - cell / 2, r = Math.hypot(u, v);
        const hole = Math.max(0, 1 - r / (cell * 0.32)); const weave = 0.08 * (Math.sin(x * 0.8) + Math.sin(y * 0.8));
        return -hole * 0.9 + weave;
      };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const hx = hAt(x + 1, y) - hAt(x - 1, y), hy = hAt(x, y + 1) - hAt(x, y - 1), nx = -hx * 1.5, ny = -hy * 1.5, nl = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
        d[o] = 128 + (nx / nl) * 127; d[o + 1] = 128 + (ny / nl) * 127; d[o + 2] = 128 + (1 / nl) * 127; d[o + 3] = 110 + 60 * Math.max(0, -hAt(x, y));
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    let boardDirty = true;
    const boardC = document.createElement('canvas'); boardC.width = 1024; boardC.height = 512;
    function boardCanvas() {
      const g = boardC.getContext('2d');
      g.fillStyle = '#05070c'; g.fillRect(0, 0, 1024, 512);
      // LED pixel grid
      g.fillStyle = css(TEAM); g.fillRect(0, 0, 512, 108); g.fillStyle = css(DEFA); g.fillRect(512, 0, 512, 108);
      g.font = '900 80px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = css(TEAM2); g.fillText(HOME.abbr, 256, 58); g.fillStyle = css(away2 ? O1 : O2); g.fillText(AWAY.abbr, 768, 58);
      g.fillStyle = '#ffc21a'; g.font = '900 240px "Barlow Condensed", Impact, sans-serif';
      g.fillText(String(typeof hs === 'number' ? hs : 0), 256, 280); g.fillText(String(typeof as === 'number' ? as : 0), 768, 280);
      g.fillStyle = '#c9ccd4'; g.font = '800 66px "Barlow Condensed", Impact, sans-serif';
      g.fillText(typeof qtr === 'number' ? (qtr > 4 ? 'OT' : 'Q' + qtr) + '   ' + fmtClock(clock) : '', 512, 450);
      if (typeof down === 'number' && typeof phase === 'string' && phase !== 'splash') { g.font = '800 48px "Barlow Condensed", Impact, sans-serif'; g.fillStyle = '#9aa0ad'; g.fillText(ddTxt().toUpperCase() + '  ·  ' + ballTxt(los).toUpperCase(), 512, 395); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 1024, 1);
      return boardC;
    }
    // LED ribbon: team names and the matchup, scrolls by UV offset
    function ribbonCanvas() {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#060810'; g.fillRect(0, 0, 2048, 64);
      g.font = '900 44px "Barlow Condensed", Impact, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
      const items = [[HOME.name.toUpperCase(), HOMECSS], ['•', '#ffc21a'], [AWAY.name.toUpperCase(), OPPCSS], ['•', '#ffc21a'], ['BLITZ 3D', '#f5f6f8'], ['•', '#ffc21a'], [(opts.label || 'ARCADE FOOTBALL').toUpperCase(), '#c9ccd4'], ['•', '#ffc21a']];
      let x = 20; for (let rep = 0; rep < 3 && x < 2048; rep++) for (const [t, col] of items) { g.fillStyle = col; g.fillText(t, x, 32); x += g.measureText(t).width + 40; }
      g.fillStyle = 'rgba(0,0,0,0.4)'; for (let y = 0; y < 64; y += 3) g.fillRect(0, y, 2048, 1);
      return c;
    }
    // seat rows texture for the tiers (a row of seats in two team colours with gaps)
    function seatCanvas() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#3a3d45'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#2b2e36'; g.fillRect(0, 44, 256, 20);
      for (let i = 0; i < 8; i++) { const x = i * 32 + 2; g.fillStyle = css(shade(TEAM, 0.55 + 0.1 * (i % 2))); g.fillRect(x, 6, 28, 36); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, 6, 28, 5); g.fillRect(x + 12, 6, 4, 36); }
      return c;
    }
    const REFC = { jer: hex('#f2f2f2'), pad: hex('#f2f2f2'), pant: hex('#f6f6f6'), helm: hex('#111111'), stripe: hex('#111111'), num: hex('#111111'), glove: hex('#111111'), sock: hex('#111111'), mask: hex('#111111') };
    // ---------- per-team kit texture (2048): jersey, sleeves, gloves, pants, socks, helmet; alpha carries a roughness variation ----------
    function kitCanvas(C, abbr, teamName, refs) {
      const c = document.createElement('canvas'); c.width = c.height = 2048; const g = c.getContext('2d');
      const S = 2048, reg = (k) => { const r = KIT[k]; return { x: r[0] * S, y: r[1] * S, w: (r[2] - r[0]) * S, h: (r[3] - r[1]) * S }; };
      const box = (r, u0, u1, v0, v1, col) => { g.fillStyle = typeof col === 'string' ? col : css(col); g.fillRect(r.x + r.w * u0, r.y + r.h * v0, r.w * (u1 - u0) + 0.6, r.h * (v1 - v0) + 0.6); };
      const white = [0.94, 0.95, 0.96, 1], dark = [0.08, 0.085, 0.1, 1];
      const contrast = (a, b) => (cdist(a, b) < 0.28 ? (lum(b) > 0.5 ? dark : white) : a);
      const stripeC = contrast(C.stripe, C.jer);
      const seam = (x0, y0, x1, y1) => { g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(x0 + 2, y0); g.lineTo(x1 + 2, y1); g.stroke(); };
      // torso
      let r = reg('torso'); box(r, 0, 1, 0, 1, C.jer);
      // side mesh panels (darker inserts) with seams
      for (const u of [0.25, 0.75]) { const grd = g.createLinearGradient(r.x + r.w * (u - 0.075), 0, r.x + r.w * (u + 0.075), 0); const sc = css(shade(C.jer, 0.8)); grd.addColorStop(0, css(C.jer)); grd.addColorStop(0.25, sc); grd.addColorStop(0.75, sc); grd.addColorStop(1, css(C.jer)); g.fillStyle = grd; g.fillRect(r.x + r.w * (u - 0.075), r.y + r.h * 0.28, r.w * 0.15, r.h * 0.72); seam(r.x + r.w * (u - 0.06), r.y + r.h * 0.3, r.x + r.w * (u - 0.06), r.y + r.h); seam(r.x + r.w * (u + 0.06), r.y + r.h * 0.3, r.x + r.w * (u + 0.06), r.y + r.h); }
      // shadow under the pad shelf
      { const grd = g.createLinearGradient(0, r.y + r.h * 0.17, 0, r.y + r.h * 0.34); grd.addColorStop(0, 'rgba(0,0,0,0.3)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(r.x, r.y + r.h * 0.17, r.w, r.h * 0.17); }
      // collar and shoulder stripes
      box(r, 0, 1, 0, 0.04, stripeC); box(r, 0, 1, 0.04, 0.05, white);
      for (const u of [0.25, 0.75]) for (const [du, col, w] of [[-0.045, stripeC, 0.018], [0.045, stripeC, 0.018], [-0.018, white, 0.008], [0.018, white, 0.008]]) box(r, u + du - w / 2, u + du + w / 2, 0.05, 0.14, col);
      if (refs) { for (let i = 0; i < 12; i++) box(r, i / 12, i / 12 + 1 / 24, 0, 1, dark); }
      box(r, 0, 1, 0.94, 1, shade(C.jer, 0.76));
      // cap sleeves
      r = reg('sleeve'); box(r, 0, 1, 0, 1, C.jer); box(r, 0, 1, 0.7, 0.82, stripeC); box(r, 0, 1, 0.84, 0.9, white); box(r, 0, 1, 0.96, 1, shade(C.jer, 0.76));
      if (refs) { for (let i = 0; i < 6; i++) box(r, i / 6, i / 6 + 1 / 12, 0, 1, dark); }
      seam(r.x, r.y + r.h * 0.12, r.x + r.w, r.y + r.h * 0.12);
      // gloves: team-coloured back with a textured sticky palm (white) and finger seams
      r = reg('glove'); box(r, 0, 1, 0, 1, C.glove); box(r, 0.26, 0.74, 0.1, 1, white); box(r, 0, 1, 0, 0.1, dark);
      g.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 40; i++) for (let j = 0; j < 14; j++) g.fillRect(r.x + r.w * (0.27 + 0.46 * i / 40), r.y + r.h * (0.12 + 0.86 * j / 14), 3, 3);
      g.fillStyle = css(shade(C.glove, 0.55)); for (const u of [0.05, 0.12, 0.19, 0.81, 0.88, 0.95]) g.fillRect(r.x + r.w * (u - 0.025), r.y + r.h * 0.5, r.w * 0.05, r.h * 0.14);
      g.fillStyle = 'rgba(0,0,0,0.14)'; for (const u of [0.35, 0.47, 0.59]) g.fillRect(r.x + r.w * u, r.y + r.h * 0.55, 3, r.h * 0.45);
      // pants: belt with buckle, side stripes, hip/thigh pad outlines
      r = reg('pant'); box(r, 0, 1, 0, 1, C.pant); box(r, 0, 1, 0, 0.09, dark); box(r, 0.47, 0.53, 0.012, 0.08, [0.72, 0.74, 0.77, 1]);
      const pstripe = contrast(C.stripe, C.pant);
      for (const u of [0.25, 0.75]) { box(r, u - 0.03, u + 0.03, 0.09, 1, pstripe); box(r, u - 0.038, u - 0.03, 0.09, 1, white); box(r, u + 0.03, u + 0.038, 0.09, 1, white); }
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3; for (const u of [0.5, 1.0]) { g.beginPath(); g.ellipse(r.x + r.w * (u - 0.25), r.y + r.h * 0.52, r.w * 0.11, r.h * 0.12, 0, 0, 6.3); g.stroke(); }
      seam(r.x, r.y + r.h * 0.38, r.x + r.w, r.y + r.h * 0.38);
      // socks
      r = reg('sock'); box(r, 0, 1, 0, 1, C.sock); box(r, 0, 1, 0.1, 0.42, white); box(r, 0, 1, 0.21, 0.3, contrast(C.stripe, white));
      // officials' stripes region (plain reference)
      r = reg('stripes'); box(r, 0, 1, 0, 1, white); for (let i = 0; i < 10; i++) box(r, i / 10, i / 10 + 0.05, 0, 1, dark);
      // helmet: centre stripe, logo + ear hole on both sides, vents, bumper text
      r = reg('helm'); box(r, 0, 1, 0, 1, C.helm);
      const hstripe = contrast(C.stripe, C.helm), hs2 = contrast(C.pant, hstripe);
      for (let py = 0; py < r.h; py++) {
        const th = (py / r.h) * HELM_TH, s = Math.max(0.06, Math.sin(th)), hw = Math.min(0.5, 0.013 / s), hw2 = Math.min(0.5, 0.005 / s), y = r.y + py, front = th < 1.05;
        g.fillStyle = css(hstripe); if (front) g.fillRect(r.x + r.w * (0.5 - hw), y, r.w * hw * 2, 1); g.fillRect(r.x, y, r.w * hw, 1); g.fillRect(r.x + r.w * (1 - hw), y, r.w * hw, 1);
        g.fillStyle = css(hs2); if (front) g.fillRect(r.x + r.w * (0.5 - hw2), y, r.w * hw2 * 2, 1); g.fillRect(r.x, y, r.w * hw2, 1); g.fillRect(r.x + r.w * (1 - hw2), y, r.w * hw2, 1);
      }
      const letters = String(abbr || 'M').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || 'M';
      for (const u of [0.25, 0.75]) {
        const cx = r.x + r.w * u, cy = r.y + r.h * (1.5 / HELM_TH), ex = r.w * 0.05, ey = r.h * 0.105;
        g.fillStyle = css(white); g.beginPath(); g.ellipse(cx, cy, ex, ey, 0, 0, 6.2832); g.fill();
        g.strokeStyle = css(hstripe); g.lineWidth = 6; g.stroke();
        g.save(); g.translate(cx, cy); g.scale(ex / ey, 1); g.fillStyle = css(lum(C.helm) > 0.55 ? shade(C.helm, 0.6) : C.helm); g.font = `900 ${Math.round(ey * 1.25)}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(letters).width; if (tw > ey * 1.5) g.scale((ey * 1.5) / tw, 1); g.fillText(letters, 0, ey * 0.06); g.restore();
        const hx = r.x + r.w * (u + (u < 0.5 ? -0.03 : 0.03)), hy = r.y + r.h * (1.98 / HELM_TH);
        g.fillStyle = 'rgba(14,15,18,0.95)'; g.beginPath(); g.ellipse(hx, hy, r.w * 0.013, r.h * 0.03, 0, 0, 6.2832); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.6)'; for (const u of [0.42, 0.58, 0.36, 0.64]) for (const th of [0.6, 0.78]) { const sinT = Math.sin(th); g.beginPath(); g.ellipse(r.x + r.w * (0.5 + (u - 0.5) * 0.45 / sinT), r.y + r.h * (th / HELM_TH), r.w * 0.004 / sinT, r.h * 0.012, 0, 0, 6.2832); g.fill(); }
      g.fillStyle = 'rgba(230,232,236,0.9)'; for (const u of [0.39, 0.61]) { g.beginPath(); g.ellipse(r.x + r.w * u, r.y + r.h * (2.35 / HELM_TH), r.w * 0.006, r.h * 0.014, 0, 0, 6.2832); g.fill(); }
      // roughness variation in alpha: fabric 0.5, side panels shinier, stripes matte
      try {
        const img = g.getImageData(0, 0, S, S), d = img.data;
        const setA = (rr, u0, u1, v0, v1, a) => { const x0 = Math.round(rr.x + rr.w * u0), x1 = Math.round(rr.x + rr.w * u1), y0 = Math.round(rr.y + rr.h * v0), y1 = Math.round(rr.y + rr.h * v1); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d[(y * S + x) * 4 + 3] = a; };
        setA(reg('torso'), 0, 1, 0, 1, 128); for (const u of [0.25, 0.75]) setA(reg('torso'), u - 0.06, u + 0.06, 0.3, 1, 70);
        setA(reg('sleeve'), 0, 1, 0, 1, 128); setA(reg('pant'), 0, 1, 0, 1, 90); setA(reg('sock'), 0, 1, 0, 1, 160); setA(reg('glove'), 0, 1, 0, 1, 110); setA(reg('stripes'), 0, 1, 0, 1, 150);
        g.putImageData(img, 0, 0);
      } catch (e) {}
      return c;
    }
    // crowd sprite sheet: 16 fans x 3 states (seated / standing / slumped). alpha 1 areas take the seat's tint, alpha 0.6 keep their own colour,
    // alpha 0.7 marks a phone screen (lit on big plays at night)
    function crowdCanvas() {
      cs = 99;
      const CW = 96, CH = 192, c = document.createElement('canvas'); c.width = CW * 16; c.height = CH * 3; const g = c.getContext('2d');
      const skins = ['#f1cdb0', '#d9a87f', '#b57f57', '#8b5a3c', '#5b3a24', '#e9c3a4', '#a86e4b', '#73482d'], hairs = ['#2b1d14', '#5a3b22', '#c9a15a', '#1a1a1a', '#6b6b6b', '#2b1d14', '#3d2a1b', '#d9c7a0'];
      const own = (col, a) => { g.globalAlpha = a || 0.6; g.fillStyle = col; }, tint = () => { g.globalAlpha = 1; g.fillStyle = '#ffffff'; };
      for (let k = 0; k < 16; k++) for (let st = 0; st < 3; st++) {
        const x0 = k * CW, y0 = st * CH, cx = x0 + CW / 2, skin = skins[k % 8], hair = hairs[(k * 3) % 8], cap = k % 3 === 0, jacket = k % 4 === 1, scarf = k % 5 === 2, fem = k % 2 === 1;
        const stand = st === 1, slump = st === 2;
        const shoulder = y0 + (stand ? 70 : 100), bottom = y0 + CH, bw = fem ? 26 : 32;
        // legs (dark own colour) for standing
        if (stand) { own('#23262e'); g.fillRect(cx - 18, y0 + 130, 14, 60); g.fillRect(cx + 4, y0 + 130, 14, 60); }
        // body (tinted shirt or own jacket)
        if (jacket) own(k % 8 < 4 ? '#2f3340' : '#4a3b2e'); else tint();
        g.beginPath(); g.moveTo(cx - bw, stand ? y0 + 135 : bottom); g.lineTo(cx - bw - 2, shoulder + 18); g.quadraticCurveTo(cx - bw - 2, shoulder, cx - 12, shoulder); g.lineTo(cx + 12, shoulder); g.quadraticCurveTo(cx + bw + 2, shoulder, cx + bw + 2, shoulder + 18); g.lineTo(cx + bw, stand ? y0 + 135 : bottom); g.closePath(); g.fill();
        if (scarf) { own('#c23b2e'); g.fillRect(cx - 14, shoulder - 2, 28, 10); }
        // arms
        const armsUp = stand && (k % 3 !== 1);
        if (armsUp) { for (const s of [-1, 1]) { if (jacket) own('#2f3340'); else tint(); g.fillRect(cx + s * 28 - 7, shoulder - 58, 14, 74); own(skin); g.beginPath(); g.arc(cx + s * 28, shoulder - 62, 9, 0, 6.3); g.fill(); } if (k % 4 === 2) { own('#ffffff', 0.7); g.fillRect(cx + 22, shoulder - 76, 12, 20); } }
        else if (slump) { for (const s of [-1, 1]) { if (jacket) own('#2f3340'); else tint(); g.fillRect(cx + s * 24 - 7, shoulder + 10, 14, 50); own(skin); g.beginPath(); g.arc(cx + s * 16, shoulder + 24, 9, 0, 6.3); g.fill(); } }
        else { for (const s of [-1, 1]) { if (jacket) own('#2f3340'); else tint(); g.fillRect(cx + s * (bw + 4) - 7, shoulder + 14, 14, 44); own(skin); g.beginPath(); g.arc(cx + s * (bw + 4), shoulder + 62, 9, 0, 6.3); g.fill(); } }
        // head, hair / cap, face shadow
        const hy = shoulder - (slump ? 10 : 26);
        own(skin); g.beginPath(); g.ellipse(cx, hy, 18, 22, 0, 0, 6.3); g.fill();
        if (cap) { tint(); g.beginPath(); g.ellipse(cx, hy - 10, 20, 13, 0, Math.PI, 0); g.fill(); g.fillRect(cx - 24, hy - 12, 46, 6); }
        else { own(hair); g.beginPath(); g.ellipse(cx, hy - 8, 19, fem ? 20 : 14, 0, Math.PI, 0); g.fill(); if (fem) { g.fillRect(cx - 19, hy - 8, 8, 30); g.fillRect(cx + 11, hy - 8, 8, 30); } }
        own('rgba(0,0,0,0.3)'); g.fillRect(cx - 7, hy - 2, 4, 3); g.fillRect(cx + 3, hy - 2, 4, 3);
        g.globalAlpha = 1;
      }
      return c;
    }
    // ---------- stadium ----------
    function buildWorld() {
      cs = 777;
      const W = { plain: new Batch(14000), seats: new Batch(3000), field: new Batch(12), glow: new Batch(1200), board: new Batch(12), ribbon: new Batch(60), glass: new Batch(60), crowd: null };
      const up = [0, 1, 0];
      W.field.quad([-30, 0, -12], [30, 0, -12], [30, 0, 112], [-30, 0, 112], up, [1, 1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
      const turf = WX === 'snow' ? [0.5, 0.52, 0.5, 1] : [0.1, 0.24, 0.12, 1], wall = [0.12, 0.13, 0.16, 1], dark = [0.05, 0.055, 0.07, 1], concrete = [0.3, 0.3, 0.32, 1], steel = [0.26, 0.27, 0.3, 1], rail = [0.6, 0.62, 0.65, 1];
      W.plain.quad([-120, -0.02, -90], [120, -0.02, -90], [120, -0.02, 200], [-120, -0.02, 200], up, turf);
      // ---- crowd ----
      const CR = [];
      const pal = [TEAM, TEAM, shade(TEAM, 0.7), TEAM2, DEFA, [0.8, 0.8, 0.82, 1], [0.2, 0.22, 0.28, 1], [0.35, 0.36, 0.4, 1], [0.16, 0.23, 0.42, 1], shade(TEAM, 0.5), [0.5, 0.14, 0.14, 1], [0.1, 0.1, 0.12, 1], [0.12, 0.12, 0.14, 1], [0.18, 0.16, 0.14, 1], [0.25, 0.3, 0.28, 1]];
      const secPal = (sec) => { const h = Math.abs(Math.sin(sec * 12.9898) * 43758.5453) % 1; return h < 0.22 ? 0 : h < 0.4 ? 3 : h < 0.5 ? 4 : h < 0.62 ? 6 : h < 0.74 ? 11 : h < 0.84 ? 13 : h < 0.92 ? 7 : 5; };
      const seat = (x, y, z, fx, fz, amp, sec) => { // one sprite quad per fan facing (fx,fz); aM: phase, amp, stand threshold, phone flag
        const rx = -fz, rz = fx, k = (crand() * 16) | 0, w = 0.4, h = 1.6, ph = crand() * 6.28, thr = 0.25 + crand() * 0.75, phone = SKY.night && crand() < 0.18 ? 1 : 0;
        const c0 = pal[crand() < 0.25 ? (crand() * pal.length) | 0 : secPal(sec || 0)], c = shade(c0, 0.6 + crand() * 0.45);
        const u0 = k / 48, u1 = (k + 1) / 48;
        const a = [x - rx * w, y + h, z - rz * w], b = [x + rx * w, y + h, z + rz * w], c2 = [x + rx * w, y, z + rz * w], d = [x - rx * w, y, z - rz * w];
        for (const [v, u, t] of [[a, u0, 0], [b, u1, 0], [c2, u1, 1], [a, u0, 0], [c2, u1, 1], [d, u0, 1]]) CR.push(v[0], v[1], v[2], c[0], c[1], c[2], ph, amp, thr, phone, u, t);
      };
      // a tiered stand: rows of treads/risers with aisles; fx,fz face the field
      const stand = (x0, z0, x1, z1, fx, fz, rows, rise, y0, depth, aisleEvery, dense) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
        for (let r = 0; r < rows; r++) {
          const y = y0 + r * rise, back = r * depth;
          const A = [x0 + ux * 0 - fx * back, y, z0 + uz * 0 - fz * back], Bp = [x0 + ux * len - fx * back, y, z0 + uz * len - fz * back];
          const A2 = [A[0] - fx * depth, y, A[2] - fz * depth], B2 = [Bp[0] - fx * depth, y, Bp[2] - fz * depth];
          W.seats.quad(A, Bp, B2, A2, up, [1, 1, 1, 1], [0, 0, len / 1.5, 0, len / 1.5, 1, 0, 1]);
          W.plain.quad(A2, B2, [B2[0], y + rise, B2[2]], [A2[0], y + rise, A2[2]], [fx, 0, fz], concrete);
          for (let d = 0.55 + crand() * 0.3; d < len; d += dense ? 0.85 + crand() * 0.25 : 1.0 + crand() * 0.5) {
            if (((d / aisleEvery) % 1) < 0.08) continue; // aisle
            if (crand() < (dense ? 0.06 : 0.14)) continue;
            seat(x0 + ux * d - fx * (back + depth * 0.55), y + 0.02, z0 + uz * d - fz * (back + depth * 0.55), fx, fz, 0.04 + crand() * 0.08, Math.floor(d / aisleEvery) * 7 + Math.floor(r / 6) * 31 + Math.round(x0 * 3 + z0));
          }
        }
        // front railing
        const ry = y0 + 0.9; W.plain.wbox(Math.min(x0, x1) - (fx ? 0.05 : 0), ry, Math.min(z0, z1) - (fz ? 0.05 : 0), Math.max(x0, x1) + (fx ? 0.05 : 0), ry + 0.06, Math.max(z0, z1) + (fz ? 0.05 : 0), rail);
        for (let d = 0; d < len; d += 3) W.plain.wbox(x0 + ux * d - 0.03, y0, z0 + uz * d - 0.03, x0 + ux * d + 0.03, ry, z0 + uz * d + 0.03, rail);
      };
      for (const s of [-1, 1]) {
        // field wall with padded team-colour panels
        W.plain.wbox(s * 34, 0, -24, s * 34.7, 1.9, 124, wall);
        for (let z = -22; z < 122; z += 12) W.plain.wbox(s * 33.97, 0.45, z, s * 34.05, 1.75, z + 11.2, (Math.round(z / 12) & 1) ? TEAM : shade(DEFA, 0.9));
        // lower bowl: 24 rows
        stand(s * 35.2, -22, s * 35.2, 122, -s, 0, 24, 0.82, 1.95, 0.95, 14, true);
        // tunnels in the lower bowl wall
        for (const z of [-10, 50, 110]) W.plain.wbox(s * 34.1, 0, z - 2.2, s * 36, 2.3, z + 2.2, [0.01, 0.01, 0.015, 1]);
        // fascia with the ribbon board, then the upper deck
        W.plain.wbox(s * 58.5, 21.6, -24, s * 59.4, 23.6, 124, [0.08, 0.09, 0.11, 1]);
        W.ribbon.quad([s * 58.45, 21.8, -24], [s * 58.45, 21.8, 124], [s * 58.45, 23.3, 124], [s * 58.45, 23.3, -24], [0, 0, 0], [1, 1, 1, 1], [0, 1, 9, 1, 9, 0, 0, 0]);
        stand(s * 59.5, -22, s * 59.5, 122, -s, 0, 20, 0.95, 23.8, 1.0, 14, false);
        // press box / suites on the home side, glass front
        W.plain.wbox(s * 60, 43, -22, s * 82, 48, 122, [0.07, 0.075, 0.09, 1]);
        W.glass.quad([s * 60.05, 43.2, -22], [s * 60.05, 43.2, 122], [s * 60.05, 47.6, 122], [s * 60.05, 47.6, -22], [-s, 0, 0], [0.3, 0.4, 0.55, 1]);
        for (let z = -20; z <= 120; z += 10) W.plain.wbox(s * 59.9, 43, z - 0.15, s * 60.3, 48, z + 0.15, steel);
        // back wall
        W.plain.wbox(s * 80, 0, -50, s * 83, 50, 124, dark);
        // bench area: bench, backrest, coolers, kicking net frame
        const bx = s * 30.6;
        W.plain.wbox(bx - 0.65, 0.42, 34, bx + 0.65, 0.5, 66, [0.72, 0.72, 0.74, 1]);
        for (let z = 35; z <= 65; z += 6) W.plain.wbox(bx - 0.5, 0, z - 0.06, bx + 0.5, 0.42, z + 0.06, steel);
        W.plain.wbox(bx + s * 0.6, 0.5, 34, bx + s * 0.7, 1.0, 66, [0.72, 0.72, 0.74, 1]);
        for (const z of [31, 32.2]) { W.plain.wbox(bx - 0.3, 0, z - 0.3, bx + 0.3, 0.75, z + 0.3, [0.95, 0.4, 0.05, 1]); W.plain.wbox(bx - 0.32, 0.75, z - 0.32, bx + 0.32, 0.8, z + 0.32, [0.95, 0.95, 0.95, 1]); }
        W.plain.wbox(bx - 0.1, 0, 71.5, bx + 0.1, 3.0, 71.6, steel); W.plain.wbox(bx - 0.1, 0, 74.4, bx + 0.1, 3.0, 74.5, steel); W.plain.wbox(bx - 0.1, 2.95, 71.5, bx + 0.1, 3.05, 74.5, steel);
        // end-zone cameras on tripods
        for (const z of [-7, 107]) { W.plain.wbox(s * 20 - 0.08, 0, z - 0.08, s * 20 + 0.08, 1.4, z + 0.08, steel); W.plain.wbox(s * 20 - 0.25, 1.4, z - 0.35, s * 20 + 0.25, 1.75, z + 0.35, [0.1, 0.1, 0.12, 1]); }
      }
      // end stands + corners
      for (const [zw, dir] of [[123, 1], [-24.7, -1]]) {
        W.plain.wbox(-34.7, 0, zw, 34.7, 1.9, zw + 0.7, wall);
        W.plain.wbox(-34.7, 0.45, dir > 0 ? zw - 0.03 : zw + 0.73, 34.7, 1.75, dir > 0 ? zw + 0.05 : zw + 0.65, TEAM);
        const z0 = dir > 0 ? zw + 0.7 : zw;
        stand(-58, z0 + dir * 0.5, 58, z0 + dir * 0.5, 0, -dir, 24, 0.82, 1.95, 0.95, 16, true);
        W.plain.wbox(-60, 0, z0 + dir * 24, 60, 24, z0 + dir * 27, dark);
        for (const z of [z0 + dir * 1]) W.plain.wbox(-2.2, 0, Math.min(z, z + dir * 1.9), 2.2, 2.3, Math.max(z, z + dir * 1.9), [0.01, 0.01, 0.015, 1]);
      }
      // jumbotron behind the far end zone: housing, screen, support
      W.plain.wbox(-16, 26, 151, 16, 41, 153.5, [0.06, 0.065, 0.08, 1]);
      W.plain.wbox(-16.4, 25.6, 150.8, 16.4, 26.0, 153.6, steel); W.plain.wbox(-16.4, 41, 150.8, 16.4, 41.4, 153.6, steel);
      W.board.quad([15.4, 26.6, 150.75], [-15.4, 26.6, 150.75], [-15.4, 40.4, 150.75], [15.4, 40.4, 150.75], [0, 0, 0], [1, 1, 1, 1], [1, 1, 0, 1, 0, 0, 1, 0]);
      for (let i = 0; i < 3; i++) W.plain.wbox(-8 + i * 8 - 0.6, 24, 151.5, -8 + i * 8 + 0.6, 26, 153, dark);
      // light towers: lattice masts with banks of lamps facing the field
      for (const t of TOWERS) {
        const [x, , z] = t, sx = x < 0 ? 1 : -1, H = t[1] + 3;
        W.plain.wbox(x - 0.45, 0, z - 0.45, x + 0.45, H, z + 0.45, steel);
        for (let y = 4; y < H; y += 6) { W.plain.wbox(x - 1.2, y, z - 0.08, x + 1.2, y + 0.16, z + 0.08, steel); W.plain.wbox(x - 0.08, y, z - 1.2, x + 0.08, y + 0.16, z + 1.2, steel); }
        W.plain.wbox(x - 3.4, H - 5.5, z - 4.2, x + 3.4, H - 0.4, z + 4.2, [0.14, 0.15, 0.17, 1]);
        const lc = [1, 0.97, 0.9, 1];
        for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) { const yy = H - 5.1 + r * 1.2, zz = z - 3.7 + q * 1.35; W.glow.wbox(x + sx * 3.42, yy, zz, x + sx * 3.5, yy + 0.95, zz + 1.05, lc); }
      }
      // goal posts with pads, nets behind them
      const gp = [1, 0.84, 0.1, 1];
      for (const [zl, dir] of [[110, 1], [-10, -1]]) {
        const zb = zl + dir * 1.2;
        W.plain.wbox(-0.15, 0, zb - 0.15, 0.15, 3.35, zb + 0.15, gp);
        W.plain.wbox(-0.12, 3.2, Math.min(zb, zl) - 0.1, 0.12, 3.4, Math.max(zb, zl) + 0.1, gp);
        W.plain.wbox(-3.1, 3.25, zl - 0.1, 3.1, 3.45, zl + 0.1, gp);
        for (const s of [-1, 1]) { W.plain.wbox(s * 3.08 - 0.08, 3.25, zl - 0.08, s * 3.08 + 0.08, 11, zl + 0.08, gp); W.plain.wbox(s * 3.08 - 0.05, 11, zl - 0.05, s * 3.08 + 0.05, 11.6, zl + 0.05, [1, 0.3, 0.2, 1]); }
        W.plain.wbox(-0.42, 0, zb - 0.42, 0.42, 1.9, zb + 0.42, shade(TEAM, 0.8));
        // field-goal net frame
        const zn = zl + dir * 9; for (const s of [-1, 1]) W.plain.wbox(s * 8 - 0.1, 0, zn - 0.1, s * 8 + 0.1, 14, zn + 0.1, steel); W.plain.wbox(-8, 13.9, zn - 0.1, 8, 14.1, zn + 0.1, steel);
      }
      for (const z of [-10, 0, 100, 110]) for (const s of [-1, 1]) W.plain.wbox(s * HW - 0.17, 0, z - 0.17, s * HW + 0.17, 0.55, z + 0.17, [1, 0.45, 0.05, 1]);
      W.crowd = { f: new Float32Array(CR), n: CR.length / 12 };
      return W;
    }
    // ---------- environment cubemap: the lit stadium from the middle of the field, for reflections ----------
    function buildEnv() {
      if (!G) return;
      const S = 64, tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
      for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer(), rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, S, S);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      const eye = [0, 2.0, 50];
      const dirs = [[[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]], [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, -1]], [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]]];
      const Pm = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -(420 + 0.5) / (420 - 0.5), -1, 0, 0, -(2 * 420 * 0.5) / (420 - 0.5), 0]);
      const saveVP = VP.slice(), saveE = cam.e.slice(), saveQ = quality;
      G.envPass = true;
      for (let f = 0; f < 6; f++) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue;
        gl.viewport(0, 0, S, S); gl.clearColor(SKY.hor[0], SKY.hor[1], SKY.hor[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const [d, u] = dirs[f];
        const Vm = m4LookAt(eye, [eye[0] + d[0], eye[1] + d[1], eye[2] + d[2]], u);
        // the renderer mirrors X (see updateCam): apply the same flip so the cube matches world handedness
        const flip = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        const vp = m4Mul(m4Mul(Pm, Vm), flip);
        for (let i = 0; i < 16; i++) VP[i] = vp[i];
        cam.e[0] = eye[0]; cam.e[1] = eye[1]; cam.e[2] = eye[2];
        drawScenePass(true, { forEnv: true, skyOnly: false });
      }
      G.envPass = false;
      for (let i = 0; i < 16; i++) VP[i] = saveVP[i]; cam.e[0] = saveE[0]; cam.e[1] = saveE[1]; cam.e[2] = saveE[2]; quality = saveQ;
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex); gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb);
      if (G.env) gl.deleteTexture(G.env);
      G.env = tex; G.texs.push(tex);
    }

    // ---------- atlas (1024 x 2048): player photos (12 x 256px cells, rows 0-2), name plates (16 x 256x64 cells at y 768),
    // numbers and generic faces (64 x 128px cells from y 1024) ----------
    const AH = 2048, NAMEY = 768, SMALLY = 1024;
    const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = AH;
    const ag = atlas.getContext('2d');
    let atlasDirty = true;
    const numMap = {};
    let numN = 0;
    function smallCell() { if (numN >= 64) return -1; const k = numN++; return k; }
    function numCell(n) {
      const key = 'n' + n;
      if (numMap[key] != null) return numMap[key];
      const k = smallCell(); if (k < 0) return -1;
      const x = (k % 8) * 128, y = SMALLY + Math.floor(k / 8) * 128;
      ag.clearRect(x, y, 128, 128);
      ag.font = '900 100px "Barlow Condensed", Impact, "Arial Narrow", sans-serif'; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      ag.lineWidth = 10; ag.lineJoin = 'round'; ag.strokeStyle = '#6a6a6a'; ag.strokeText(String(n), x + 64, y + 70, 112); // stitched outline (tinted darker)
      ag.fillStyle = '#ffffff'; ag.fillText(String(n), x + 64, y + 70, 112);
      ag.lineWidth = 2; ag.strokeStyle = 'rgba(0,0,0,0.25)'; ag.setLineDash([3, 3]); ag.strokeText(String(n), x + 64, y + 70, 112); ag.setLineDash([]);
      atlasDirty = true;
      return (numMap[key] = 100 + k);
    }
    let nameN = 0;
    function nameCell(name) {
      const key = 'nm' + name;
      if (numMap[key] != null) return numMap[key];
      if (nameN >= 16) return -1;
      const k = nameN++, x = (k % 4) * 256, y = NAMEY + Math.floor(k / 4) * 64;
      ag.clearRect(x, y, 256, 64);
      ag.font = '800 46px "Barlow Condensed", Impact, "Arial Narrow", sans-serif'; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      ag.fillStyle = '#ffffff'; ag.fillText(String(name).toUpperCase(), x + 128, y + 34, 236);
      atlasDirty = true;
      return (numMap[key] = 200 + k);
    }
    function faceCell(skin) { // a drawn generic face for players without a photo: brow, eye shadow, nose shading, lips, stubble
      const key = 'f' + skin;
      if (numMap[key] != null) return numMap[key];
      const k = smallCell(); if (k < 0) return -1;
      const x = (k % 8) * 128, y = SMALLY + Math.floor(k / 8) * 128, sc = SKIN[skin];
      ag.fillStyle = css(sc); ag.fillRect(x, y, 128, 128);
      const sh = (kk, a) => `rgba(${Math.round(sc[0] * 255 * kk)},${Math.round(sc[1] * 255 * kk)},${Math.round(sc[2] * 255 * kk)},${a})`;
      // brow ridge shadow and eye sockets
      ag.fillStyle = sh(0.78, 0.8); for (const ex of [42, 86]) { ag.beginPath(); ag.ellipse(x + ex, y + 58, 17, 10, 0, 0, 6.3); ag.fill(); }
      ag.strokeStyle = sh(0.45, 0.9); ag.lineWidth = 5; ag.lineCap = 'round'; for (const ex of [42, 86]) { ag.beginPath(); ag.moveTo(x + ex - 14, y + 46); ag.quadraticCurveTo(x + ex, y + 41, x + ex + 14, y + 45); ag.stroke(); }
      // nose: shaded sides, lit bridge
      ag.fillStyle = sh(0.82, 0.7); ag.beginPath(); ag.moveTo(x + 58, y + 62); ag.lineTo(x + 52, y + 92); ag.lineTo(x + 64, y + 96); ag.closePath(); ag.fill();
      ag.fillStyle = sh(1.1, 0.5); ag.beginPath(); ag.moveTo(x + 64, y + 60); ag.lineTo(x + 61, y + 92); ag.lineTo(x + 68, y + 92); ag.closePath(); ag.fill();
      ag.fillStyle = sh(0.6, 0.6); for (const nx of [57, 71]) { ag.beginPath(); ag.ellipse(x + nx, y + 95, 4, 2.5, 0, 0, 6.3); ag.fill(); }
      ag.fillStyle = sh(0.9, 0.5); for (const ex of [42, 86]) { ag.beginPath(); ag.ellipse(x + ex, y + 58, 14, 8, 0, 0, 6.3); ag.fill(); } // sockets stay soft: the eyes are geometry
      // mouth
      ag.strokeStyle = sh(0.5, 0.9); ag.lineWidth = 3; ag.beginPath(); ag.moveTo(x + 50, y + 110); ag.quadraticCurveTo(x + 64, y + 116, x + 78, y + 110); ag.stroke();
      ag.fillStyle = sh(0.72, 0.45); ag.beginPath(); ag.ellipse(x + 64, y + 115, 13, 4, 0, 0, Math.PI); ag.fill();
      // cheek shading
      const grd = ag.createRadialGradient(x + 64, y + 70, 30, x + 64, y + 70, 70); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)'); ag.fillStyle = grd; ag.fillRect(x, y, 128, 128);
      atlasDirty = true;
      return (numMap[key] = 100 + k);
    }
    function cellUV(c) {
      if (c >= 200) { const k = c - 200, x = (k % 4) * 256, y = NAMEY + Math.floor(k / 4) * 64; return [(x + 2) / 1024, (y + 2) / AH, 252 / 1024, 60 / AH]; }
      if (c >= 100) { const k = c - 100, x = (k % 8) * 128, y = SMALLY + Math.floor(k / 8) * 128; return [(x + 4) / 1024, (y + 4) / AH, 120 / 1024, 120 / AH]; }
      const x = (c % 4) * 256, y = Math.floor(c / 4) * 256; return [(x + 6) / 1024, (y + 6) / AH, 244 / 1024, 244 / AH];
    }
    const SQL = Object.values(SQ);
    SQL.forEach((q) => {
      if (!q.photo) return;
      const img = new Image();
      img.onload = () => {
        if (finished) return;
        try {
          const w = img.naturalWidth, h = img.naturalHeight, sz = Math.min(w, h) * 0.46, cx = (q.idx % 4) * 256, cy = Math.floor(q.idx / 4) * 256;
          // sample the photo's skin tone from the cheeks and forehead so neck and arms match the face
          const tmp = document.createElement('canvas'); tmp.width = tmp.height = 32; const tg = tmp.getContext('2d');
          tg.drawImage(img, w * 0.5 - sz / 2, h * 0.42 - sz / 2, sz, sz, 0, 0, 32, 32);
          let tone = null;
          try {
            const d = tg.getImageData(0, 0, 32, 32).data; let r = 0, g2 = 0, b = 0, n = 0;
            for (const [px, py] of [[10, 18], [22, 18], [16, 9], [12, 20], [20, 20], [16, 12]]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = ((py + dy) * 32 + px + dx) * 4; r += d[o]; g2 += d[o + 1]; b += d[o + 2]; n++; }
            r /= n * 255; g2 /= n * 255; b /= n * 255;
            if (r > 0.12 && r >= g2 && g2 >= b * 0.9) tone = [r, g2, b, 1];
          } catch (e) { tone = null; }
          if (tone) q.look.tone = tone;
          const base = tone || SKIN[q.look.skin];
          // feather the photo into the skin tone on a scratch canvas so it reads as a face rather than a sticker
          const fc = document.createElement('canvas'); fc.width = fc.height = 256; const fg = fc.getContext('2d');
          fg.drawImage(img, w * 0.5 - sz / 2, h * 0.42 - sz / 2, sz, sz, 0, 0, 256, 256);
          fg.globalCompositeOperation = 'destination-in';
          const m = fg.createRadialGradient(128, 128, 48, 128, 132, 112); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.45, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
          fg.fillStyle = m; fg.fillRect(0, 0, 256, 256);
          ag.fillStyle = css(base); ag.fillRect(cx, cy, 256, 256);
          ag.drawImage(fc, cx, cy);
          q.cell = q.idx; atlasDirty = true;
          for (const p of everyone) if (p.sq === q) { p.face = q.cell; if (tone) p.lk.tone = tone; }
        } catch (e) { noPhoto(q); }
      };
      img.onerror = () => noPhoto(q);
      img.src = q.photo;
    });
    function noPhoto(q) {
      q.photo = null; q.cell = -1;
      root.querySelectorAll('[data-pf="' + q.key + '"]').forEach((e) => { e.className = 'bz-face bz-nof'; e.removeAttribute('style'); e.textContent = q.num; });
      for (const p of everyone) if (p.sq === q) p.face = -1;
    }
    const faceHTML = (q) => (q && q.photo ? `<s class="bz-face" data-pf="${q.key}" style="background-image:url('${q.photo}')"></s>` : q ? `<s class="bz-face bz-nof">${q.num}</s>` : '');
    // ---------- layout ----------
    let cssW = 360, cssH = 270, rscale = 1, por = 0, lnd = 0;
    const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    function headerH() {
      try {
        let e = document.elementFromPoint((document.documentElement.clientWidth || 360) / 2, 3);
        while (e && e !== document.body && e !== document.documentElement) {
          if (wrap.contains(e)) return 0;
          const p = getComputedStyle(e).position;
          if (p === 'fixed' || p === 'sticky') { const b = e.getBoundingClientRect().bottom; return b > 0 && b < 160 ? b : 0; }
          e = e.parentElement;
        }
      } catch (er) {}
      return 0;
    }
    function fit() {
      const vw = document.documentElement.clientWidth || window.innerWidth || 360;
      const vh = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight || 700);
      const fs = fsEl() === wrap || fixedMode, mob = fs || touchy || vw < 700, land = vw > vh;
      wrap.style.marginLeft = ''; wrap.style.width = ''; wrap.style.height = '';
      wrap.classList.toggle('bz-land', mob && land);
      wrap.classList.toggle('bz-edge', mob && land && !fs);
      if (mob && land && !fs && phase !== 'splash') { const l = root.getBoundingClientRect().left; wrap.style.width = vw + 'px'; wrap.style.marginLeft = -l + 'px'; }
      let h;
      const w = Math.max(260, wrap.clientWidth || vw);
      if (fs) h = vh;
      else if (mob) h = Math.max(260, vh - headerH() - 4);
      else h = clamp(Math.round(w * 9 / 16), 300, Math.max(320, vh - headerH() - 20));
      wrap.style.height = h + 'px';
      cssW = w; cssH = h;
      wrap.classList.toggle('bz-narrow', w < 560); wrap.classList.toggle('bz-tiny', w < 400);
      por = clamp((1.3 - w / h) / 0.75, 0, 1); lnd = mob && land ? 1 : 0;
      sizeBuffer();
    }
    function sizeBuffer() {
      const small = Math.min(cssW, cssH) < 500;
      let dpr = Math.min(window.devicePixelRatio || 1, small ? 1.35 : 1.5) * rscale;
      const budget = small ? 0.9e6 : 1.3e6;
      if (cssW * cssH * dpr * dpr > budget) dpr = Math.sqrt(budget / (cssW * cssH));
      const w = Math.max(160, Math.round(cssW * dpr)), h = Math.max(120, Math.round(cssH * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; if (G) { setupTargets(); try { render(0); } catch (e) {} } }
    }
    function setQuality(q) { quality = clamp(q, 0, 2); if (G) { setupTargets(); try { render(0); } catch (e) {} } }
    function scrollIn() {
      if (fsEl() || fixedMode) return;
      try { const t = wrap.getBoundingClientRect().top + window.scrollY - headerH() - 2; window.scrollTo(0, Math.max(0, t)); } catch (e) {}
    }
    // is the game lined up under the site header? On a phone the page can get scrolled away from it.
    function aligned() { try { if (fsEl() || fixedMode) return true; const r = wrap.getBoundingClientRect(); return r.top <= headerH() + 28 && r.bottom >= Math.min(cssH || 300, window.innerHeight || 700) * 0.6; } catch (e) { return true; } }
    function toggleFS() {
      try {
        if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        const r = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
        if (r) { const pr = r.call(wrap, { navigationUI: 'hide' }); if (pr && pr.catch) pr.catch(() => {}); }
      } catch (e) {}
    }

    // ---------- game state ----------
    let phase = 'splash', qtr = 1, clock = QS, hs = 0, as = 0;
    let los = 25, down = 1, fdz = 35, play = PLAYS.find((p) => p.id === 'slant'), flip = false, hot = {}, dcall = null, tryMode = false, lastCat = 'short', hist = [];
    const RUNOFF = 4; // seconds the clock keeps running after a play that ends in bounds
    let runoff = 0;
    let tPlay = 0, clockRun = false, toLeft = TOS, playClock = 20, warned = [false, false], recv2 = 'away', otLeft = 0, suddenDeath = false;
    let everyone = [], off = [], def = [], OK = {}, DK = {};
    let ball = null, ctrl = null, carrier = null, mode = 'none', passer = null, target = null, thrown = false, handed = false, runSeen = -1, crossed = false;
    let aim = null, arc = 1, pend = null, deadT = 0, deadTot = 0, closeP = null, intro = 0, introCut = false, kick = null, cpuD = null, brk = null;
    let pr = null;
    let excite = 0, parts = [], wxp = [], driveStart = 25, drivePlays = 0, replayBuf = [], replay = null, recT = 0, lastBig = null, pile = [], playRes = '';
    const cam = { e: [0, 15, 6], c: [0, 0, 34], fov: 1, shake: 0, kick: 0, sx: 0, sy: 0 };
    const input = { l: 0, r: 0, u: 0, d: 0, stick: null, sprint: false };
    const GRAV = 12;
    const fmtClock = (c) => { c = Math.max(0, Math.ceil(c)); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
    const ballTxt = (z) => { z = Math.round(z); return z === 50 ? 'Midfield' : z < 50 ? 'Own ' + z : 'Opp ' + (100 - z); };
    const ddTxt = () => (tryMode ? 'Try' : `${ORD[Math.min(down, 4)]} & ${fdz >= 100 ? 'Goal' : Math.max(1, Math.round(fdz - los))}`);
    const WARN = QS >= 240 ? 120 : Math.round(QS * 0.25);

    function mkP(side, role, key, x, z, o) {
      const p = Object.assign({ side, role, key, x, z, y: 0, vx: 0, vz: 0, h: side ? Math.PI : 0, ph: crand() * 6, fall: 0, fallT: 0, down: false, getup: 0, rising: 0, stun: 0, eng: null, engT: 0, shed: 2, imm: 0, immOf: null,
        w: 1, armT: 0, cel: 0, celType: 0, reach: null, pose: 'stance', poseT: 0, lk: normLook(null, (crand() * 5) | 0), num: 0, face: -1, ncell: -1, fcell: -1, sq: null, v: 7, acc: 9, str: 60, agi: 60, cat: 50, spd: 60,
        jumpY: 0, jumpV: 0, jumpT: 0, jumpDelay: 0, jumpPow: 0, diveT: 0, ddx: 0, ddz: 1, mvT: 0, mv: null, mvCd: { juke: 0, spin: 0, stiff: 0, hurdle: 0 }, spin: 0, wrapT: 0, wrapBy: null, tried: 0, hold: false, face2: null, R: null, ass: null, tgt: null, blk: null, lastTackle: -9,
        sta: 1, sprint: false, rad: 0.42, carrySide: 1, carryT: 0, an: { clip: 'idle', t: 0, from: null, blendT: 0, blendDur: 0 }, bones: null, rag: null, look: null, lean: 0, leanF: 0, ax: 0, az: 0, pvx: 0, pvz: 0, stumbleT: 0, plant: 0, hitT: 0, downAt: 0, handsT: null, throwT: -1 }, o || {});
      const bd = bodySpec(BODY[role] || BODY.WR, p.lk, p.wgt);
      p.body = bd; p.lk = Object.assign({}, p.lk, { hs: p.lk.hs * bd.hs, sw: bd.sw, ll: bd.ll || 1 });
      // mass for collisions, blocks and tackles: real weight when we have it, else by position
      p.mass = p.wgt > 0 ? clamp(p.wgt / 140, 0.6, 1.8) : role === 'OL' || role === 'DL' ? 1.35 : role === 'TE' || role === 'LB' ? 1.1 : role === 'QB' ? 1 : 0.95;
      p.staK = 0.7 + clamp(p.staR || 60, 25, 99) / 99 * 0.6;
      if (!(o && o.lk)) { p.lk.visor = crand() < 0.2; p.lk.sleeves = crand() < 0.25; p.lk.cleat = crand() < 0.5 ? CLEATS.black : crand() < 0.5 ? CLEATS.white : (side ? DEFC.helm : TEAM); }
      p.w = bd.bulk;
      p.dirt = DIRT[side + ':' + key] || 0;
      p.towel = (role === 'QB' || role === 'RB' || role === 'WR') && ((p.num || key.length) % 3) !== 0;
      p.mouth = role !== 'QB' && ((p.num || key.length) % 4) === 1;
      p.fcell = faceCell(p.lk.skin);
      fxSetup(p); // the card in this spot: helmet prop, particles, kit look
      return p;
    }
    const spdV = (s) => 6.6 + (s - 30) * 0.036;
    function offPlayer(key, x, z) {
      const q = SQ[key];
      const role = key === 'QB' ? 'QB' : key === 'RB' ? 'RB' : key === 'Y' ? 'TE' : 'WR';
      const p = mkP(0, role, key, x, z, { lk: q.look, num: q.num, sq: q, face: q.cell, v: spdV(q.r.spd) * (key === 'Y' ? 0.96 : key === 'QB' ? 0.94 : 1) * (1 - WET * 0.03), str: q.r.str, agi: q.r.agi, cat: q.r.cat, spd: q.r.spd, wgt: q.r.wgt, staR: q.r.sta, fx: q.fx });
      p.acc = 8 + (q.r.agi - 50) * 0.06;
      return p;
    }
    // an offensive lineman: the real Lineup player in that spot, or a generated one with a fixed look
    const OLLOOK = [0, 1, 2, 3, 4].map((i) => Object.assign(normLook(null, (i * 2 + 1) % 5), { visor: crand() < 0.2, sleeves: crand() < 0.25, cleat: crand() < 0.6 ? CLEATS.black : CLEATS.white }));
    function olPlayer(i, x, z, o) {
      const q = SQ['OL' + i], r = q.r;
      return mkP(0, 'OL', 'OL' + i, x, z, Object.assign({ w: 1.2, rad: 0.5, num: q.num, str: r.str, agi: r.agi, cat: r.cat, spd: r.spd, v: 5.6 + (r.str - 50) * 0.01 + (r.spd - 45) * 0.012, lk: q.look || OLLOOK[i], sq: q.real ? q : null, face: q.real ? q.cell : -1, wgt: r.wgt, staR: r.sta, fx: q.fx }, o || {}));
    }
    function buildRoute(p, r) {
      const s = p.x < -0.5 ? -1 : p.x > 0.5 ? 1 : (flip ? -1 : 1), pts = [[p.x, p.z]];
      for (const [o, u] of r.w) pts.push([clamp(p.x + s * o, -25.5, 25.5), clamp(p.z + u, -9, 108)]); // routes stay inside the end zone
      const seg = [];
      for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 0.001; seg.push({ x: pts[i - 1][0], z: pts[i - 1][1], dx: dx / l, dz: dz / l, l }); }
      return { pts, seg, sit: !!r.sit, s, d: (r.d || 0) + (r.blk || 0), blk: r.blk || 0, v: p.v * 0.97, len: seg.reduce((a, q) => a + q.l, 0) };
    }
    // position along a route at time t, with a slowdown into each break
    function posAt(R, t) {
      const v = R.v;
      let d = Math.max(0, t - 0.08 - R.d) * v;
      const moving = t > 0.08 + R.d;
      for (let i = 0; i < R.seg.length; i++) {
        const s = R.seg[i];
        if (d <= s.l) { const brk = i < R.seg.length - 1 && s.l - d < 1.2 ? 0.8 : 1; return { x: s.x + s.dx * d, z: s.z + s.dz * d, vx: moving ? s.dx * v * brk : 0, vz: moving ? s.dz * v * brk : 0, seg: i }; }
        d -= s.l;
      }
      const s = R.seg[R.seg.length - 1], ex = s.x + s.dx * s.l, ez = s.z + s.dz * s.l;
      if (R.sit) return { x: ex, z: ez, vx: 0, vz: 0, seg: R.seg.length - 1, end: true };
      const x = ex + s.dx * d, z = ez + s.dz * d, cx = clamp(x, -25.5, 25.5), cz = clamp(z, -9, 108);
      return { x: cx, z: cz, vx: cx === x ? s.dx * v : 0, vz: cz === z ? s.dz * v : 0, seg: R.seg.length - 1, end: true };
    }

    // ---------- CPU defensive play-calling ----------
    const COVN = ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4'];
    function chooseDef() {
      const togo = fdz - los, rz = los >= 78;
      let w;
      if (KDEF < 0.25) w = [0, 0.08, 0.35, 0.57, 0];
      else if (down >= 3 && togo >= 7) w = [0.04 + 0.1 * KDEF, 0.16, 0.2, 0.34, 0.26];
      else if (togo <= 2) w = [0.18 + 0.15 * KDEF, 0.42, 0.1, 0.3, 0];
      else if (rz) w = [0.14, 0.34, 0.27, 0.25, 0];
      else w = [0.03 + 0.06 * KDEF, 0.25, 0.25, 0.34, 0.13];
      let r = rng() * w.reduce((a, b) => a + b, 0), cov = 0;
      for (; cov < 4 && r > w[cov]; cov++) r -= w[cov];
      const blitz = cov === 0 ? 2 : rng() < DP.blitz * (down >= 3 ? 1.35 : 1) ? 1 : 0;
      return { cov, blitz, stunt: rng() < 0.12 + 0.25 * KDEF, disguise: rng() < DP.disguise, name: COVN[cov] + (blitz && cov ? ' Blitz' : '') };
    }

    // ---------- lining up ----------
    function clearPlayers() { off = []; def = []; everyone = []; OK = {}; DK = {}; pile = []; }
    function addOff(p) { off.push(p); everyone.push(p); OK[p.key] = p; return p; }
    function addDef(p) { def.push(p); everyone.push(p); DK[p.key] = p; return p; }
    function finalizePlayers() {
      for (const p of everyone) {
        p.ncell = p.num ? numCell(p.num) : -1;
        p.nmcell = p.sq && p.sq.name ? nameCell(shortName(p.sq.name)) : -1;
        p.h = p.side ? Math.PI : 0;
        p.bones = null; p.rag = null; p.down = false; p.fall = 0; p.fallT = 0; p.rising = 0;
      }
    }
    function setupPlay() {
      clearPlayers();
      tPlay = 0; ctrl = null; carrier = null; mode = 'none'; thrown = false; handed = false; runSeen = -1; crossed = false; aim = null; target = null; passer = null; playRes = '';
      parts = parts.filter((q) => q.life > 0); recT = 0; replayBuf = [];
      const F = FORMS[play.form], fx = flip ? -1 : 1, zc = (z) => clamp(z, -8, 108);
      for (const k of ['QB', 'RB', 'X', 'Z', 'S', 'Y']) {
        const sp = F[k]; let x = sp[0] * fx, z = los + sp[1];
        if (k === 'Y' && play.form === 'gun' && play.id !== 'rbscreen') x = 3.9 * fx;
        addOff(offPlayer(k, x, z));
      }
      for (let i = 0; i < 5; i++) {
        addOff(olPlayer(i, (i - 2) * 1.95, los - 0.9));
      }
      const RK = play.carrier || 'RB'; // who takes the handoff on a run (jet sweeps and end arounds hand it to a receiver)
      for (const k of ['X', 'Z', 'S', 'Y', 'RB']) {
        const p = OK[k], r0 = hot[k] ? HOT[hot[k]] : play.routes[k];
        p.blk = null; p.R = null;
        if (k === RK && isRunPlay(play)) continue;
        if (r0 && r0 !== 'B') p.R = buildRoute(p, r0);
        else p.blk = 'block';
        if (r0 && r0.blk) p.blk = 'chip';
      }
      if (isRunPlay(play)) for (const k of ['X', 'Z', 'S', 'Y']) if (k !== RK && (!play.routes[k] || play.routes[k] === 'B')) { OK[k].R = null; OK[k].blk = 'block'; }
      dcall = chooseDef();
      const sgn = OK.Y.x >= 0 ? 1 : -1, cush = DP.cush;
      const D = (role, key, x, z, o) => addDef(mkP(1, role, key, x, z, Object.assign({ v: role === 'CB' ? DP.cbV : role === 'S' ? DP.sV : role === 'LB' ? DP.lbV : DP.dlV, str: 50 + 30 * KDEF + (role === 'DL' ? 6 : 0), agi: 48 + 38 * KDEF, spd: 45 + 45 * KDEF + (role === 'CB' || role === 'S' ? 8 : 0) }, o)));
      D('DL', 'DE1', -4.6, los + 0.9, { w: 1.2, rad: 0.5, num: 91 }); D('DL', 'DT1', -1.35, los + 0.9, { w: 1.2, rad: 0.5, num: 97 });
      D('DL', 'DT2', 1.35, los + 0.9, { w: 1.2, rad: 0.5, num: 93 }); D('DL', 'DE2', 4.6, los + 0.9, { w: 1.2, rad: 0.5, num: 99 });
      const slot = OK.S, nickel = Math.abs(slot.x) > 5.5;
      D('LB', 'LBW', -4.2 * sgn, los + 4.6, { num: 54 }); D('LB', 'LBM', 0.3, los + 4.9, { num: 50 });
      D('LB', 'LBS', nickel ? slot.x - Math.sign(slot.x) * 0.9 : 4.2 * sgn, los + (nickel ? 4.2 : 4.6), { num: nickel ? 26 : 52, v: nickel ? DP.cbV * 0.97 : DP.lbV });
      const press = KDEF > 0.7 && rng() < 0.35;
      const X = OK.X, Z = OK.Z;
      D('CB', 'CB1', X.x - Math.sign(X.x || -1) * 0.6, zc(los + (press ? 1.4 : cush + rng() * 1.2)), { num: 24 });
      D('CB', 'CB2', Z.x - Math.sign(Z.x || 1) * 0.6, zc(los + (press ? 1.4 : cush + rng() * 1.2)), { num: 21 });
      const twoHigh = [2, 4].indexOf(dcall.cov) >= 0 ? !dcall.disguise : dcall.disguise;
      D('S', 'FS', twoHigh ? -10 : 0, zc(los + (twoHigh ? 13 : 14.5)), { num: 31 });
      D('S', 'SS', twoHigh ? 10 : 5 * sgn, zc(los + (twoHigh ? 13 : 7.5)), { num: 42 });
      const Z_ = (x, z, deep) => ({ t: 'zone', x, z, deep: !!deep });
      const man = (k) => ({ t: 'man', tgt: OK[k] });
      const A = {}, c = dcall.cov;
      if (c === 0) Object.assign(A, { CB1: man('X'), CB2: man('Z'), LBS: man('S'), SS: man('Y'), LBM: man('RB'), LBW: { t: 'rush' }, FS: { t: 'rush' } });
      else if (c === 1) Object.assign(A, { CB1: man('X'), CB2: man('Z'), LBS: man('S'), SS: man('Y'), LBM: man('RB'), FS: Z_(0, 22, 1), LBW: dcall.blitz ? { t: 'rush' } : Z_(0, 8) });
      else if (c === 2) Object.assign(A, { CB1: Z_(-16, 4), CB2: Z_(16, 4), FS: Z_(-10, 20, 1), SS: Z_(10, 20, 1), LBW: Z_(-8, 9), LBM: Z_(0, 10), LBS: Z_(8, 9) });
      else if (c === 3) Object.assign(A, { CB1: Z_(-16, 20, 1), CB2: Z_(16, 20, 1), FS: Z_(0, 23, 1), SS: Z_(sgn * 14, 6), LBW: Z_(-sgn * 14, 5), LBM: Z_(0, 9), LBS: Z_(sgn * 6, 9) });
      else Object.assign(A, { CB1: Z_(-17, 18, 1), FS: Z_(-6, 21, 1), SS: Z_(6, 21, 1), CB2: Z_(17, 18, 1), LBW: Z_(-14, 5), LBM: Z_(0, 9), LBS: Z_(14, 5) });
      if (c >= 2 && dcall.blitz) A[rng() < 0.5 ? 'LBM' : 'LBW'] = { t: 'rush' };
      for (const k of ['DE1', 'DT1', 'DT2', 'DE2']) A[k] = { t: 'rush' };
      for (const k in A) if (A[k].t === 'man' && A[k].tgt && A[k].tgt.blk === 'block') A[k] = KDEF > 0.5 && rng() < 0.5 ? { t: 'rush' } : Z_(0, 8);
      for (const d of def) {
        d.ass = A[d.key] || Z_(0, 9);
        d.lagK = 0.8 + rng() * 0.45; d.spdK = 0.96 + rng() * 0.08;
        d.tackle = DP.tackle * (0.9 + rng() * 0.2);
      }
      if (dcall.stunt) { DK.DT1.stunt = -1; DK.DE1.stunt = 1; }
      finalizePlayers();
      for (const p of everyone) p.pose = p.role === 'OL' || p.role === 'DL' ? 'stance3' : p.role === 'QB' ? 'qbstance' : 'stance2';
      ball = { st: 'spot', x: 0, y: 0.15, z: los, holder: null, vx: 0, vy: 0, vz: 0, spin: 0 };
      pr = null;
    }

    // ---------- animation runtime: semantic pose -> clip, blending, procedural layers, ragdoll ----------
    const ONE_SHOT = { throw: 0.42, jump: 1.05, dive: 0.75, juke: 0.36, spin: 0.5, stiff: 0.6, tackle: 0.45, getup: 0.9, kick: 0.8, stumble: 0.5, hurdle: 0.62 };
    const BLEND = { hurdle: 0.07, run: 0.14, idle: 0.2, backpedal: 0.16, throw: 0.07, jump: 0.08, dive: 0.07, juke: 0.06, spin: 0.08, stiff: 0.08, tackle: 0.08, getup: 0.3, block: 0.12, rush: 0.12, stance2: 0.3, stance3: 0.3, qbstance: 0.3, kneel: 0.3, kick: 0.1, slide: 0.08, celebrate: 0.15, hold: 0.3, stumble: 0.08, rag: 0.1, reach: 0.12, sit: 0.3, sigtd: 0.2, siginc: 0.2, sigfirst: 0.2, pocket: 0.22 };
    const DIRT = {};
    function setPose(p, pose, keep) {
      if (p.pose === pose && keep) return;
      p.pose = pose; p.poseT = 0;
    }
    function pickClip(p) {
      if (p.rag) return 'rag';
      if (p.extra) { if (p.pose === 'sit' || p.pose === 'sigtd' || p.pose === 'siginc' || p.pose === 'sigfirst' || p.pose === 'celebrate') return p.pose; const sp = Math.hypot(p.vx, p.vz); return sp > 0.6 ? 'run' : 'idle'; }
      if (DBG && DBG.forcePose) return DBG.forcePose; // model-sheet / test hook
      if (p.rising > 0) return 'getup';
      const one = ONE_SHOT[p.pose];
      if (one && p.poseT < one) return p.pose;
      if (p.pose === 'celebrate' || p.pose === 'block' || p.pose === 'rush' || p.pose === 'kneel' || p.pose === 'slide' || p.pose === 'hold') return p.pose;
      if (phase === 'pre' || phase === 'pat' || phase === 'splash' || (phase === 'kick' && kick && kick.st !== 'fly') || (phase === 'live' && kick && kick.type === 'ko' && kick.st === 'wait')) {
        if (p.pose === 'stance2' || p.pose === 'stance3' || p.pose === 'qbstance') return p.pose;
      }
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0.9) { const back = (p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h)) < -0.6 * sp; return back ? 'backpedal' : (p.stumbleT > 0 ? 'stumble' : 'run'); }
      if (p.pose === 'reach') return 'reach';
      if (phase === 'live' && p.role === 'QB' && p === OK.QB && ball && ball.holder === p && (mode === 'aim' || mode === 'none')) return 'pocket';
      return 'idle';
    }
    function animUpdate(p, dt) {
      const an = p.an, hs = p.lk.hs;
      p.poseT += dt;
      const clip = pickClip(p);
      if (clip !== an.clip) { an.from = p.bones; an.blendDur = an.blendT = BLEND[clip] || 0.12; an.clip = clip; an.t = 0; if (clip === 'rag') { an.blendDur = an.blendT = 0.1; } }
      an.t += dt;
      let bones;
      if (clip === 'rag' && p.rag) bones = p.rag.bones();
      else {
        const sp = Math.hypot(p.vx, p.vz), k = clamp(sp / 8.4, 0, 1);
        if (clip === 'run' || clip === 'stumble' || clip === 'backpedal' || clip === 'reach') p.ph += dt * 6.2832 * Math.max(sp, 1.5) / (2.3 + 0.9 * k);
        else if (clip === 'block' || clip === 'rush' || clip === 'tackle') p.ph += dt * 7;
        const one = ONE_SHOT[clip], tt = one ? clamp(p.poseT / one, 0, 1) : 0;
        let q;
        switch (clip) {
          case 'run': q = clipRun(p.ph, k, (p.plant > 0 ? 0.25 : 0) + (p.sprint && p.sta > 0 ? 0.12 : 0)); if (p.plant > 0) { q[B.knL * 3] += 0.3; q[B.knR * 3] += 0.3; q[PN] -= 0.08; } break; // (raw knee: positive = deeper bend)
          case 'stumble': q = clipStumble(p.ph); break;
          case 'backpedal': q = clipBackpedal(p.ph); break;
          case 'reach': q = lerpPose(clipRun(p.ph, k * 0.9, 0.1), POSE_REACH, 0.5); break;
          case 'idle': q = POSE_IDLE; break;
          case 'pocket': q = clipPocket(an.t + p.ph); break;
          case 'stance2': q = POSE_STANCE2; break;
          case 'stance3': q = POSE_STANCE3; break;
          case 'qbstance': q = clipQB(an.t); break;
          case 'hold': q = POSE_HOLD; break;
          case 'kneel': q = POSE_KNEEL; break;
          case 'slide': q = POSE_SLIDE; break;
          case 'throw': q = clipThrow(tt); break;
          case 'jump': q = clipJump(tt); break;
          case 'dive': q = clipDive(tt); break;
          case 'juke': q = p.mvSide < 0 ? clipJuke(tt) : mirrorPose(clipJuke(tt)); break;
          case 'spin': q = clipSpin(tt); break;
          case 'stiff': q = clipStiff(tt); break;
          case 'hurdle': q = clipHurdle(tt); break;
          case 'tackle': q = clipTackle(tt, p.ph); break;
          case 'block': q = clipBlock(p.ph, clamp(p.drive || 0, 0, 1)); break;
          case 'rush': q = clipRush(p.ph, clamp(p.drive || 0, 0, 1)); break;
          case 'kick': q = clipKick(tt); break;
          case 'getup': q = clipGetup(clamp(1 - p.rising / 0.9, 0, 1)); break;
          case 'celebrate': q = clipCeleb(p.celType, p.poseT); break;
          case 'sit': q = (p.num & 1) ? POSE_SIT_BACK : POSE_SIT; break;
          case 'sigtd': case 'siginc': case 'sigfirst': q = clipSignal(clip, p.poseT); break;
          default: q = POSE_IDLE;
        }
        if (q === POSE_IDLE || q === POSE_STANCE2 || q === POSE_STANCE3 || q === POSE_KNEEL || q === POSE_SLIDE || q === POSE_HOLD || q === POSE_REACH || q === POSE_SIT || q === POSE_SIT_BACK) q = lerpPose(q, q, 0); // copy before edits
        // procedural layers: lean into acceleration and cuts, breathing, head look
        q[PN + 1] += p.leanF; q[PN + 2] += p.lean;
        if (clip === 'idle' || clip === 'stance2' || clip === 'qbstance') { const br = Math.sin(an.t * 2.2 + p.ph) * 0.012; q[B.spine * 3] += br; q[PN] += br * 0.5; }
        if (p.look && !one && clip !== 'rag') {
          const dx = p.look[0] - p.x, dz = p.look[2] - p.z, yaw = angDiff(Math.atan2(dx, dz), p.h + q[PN + 3]), dh = Math.hypot(dx, dz) || 1, pitch = -Math.atan2(p.look[1] - 1.9 * hs, dh);
          const y1 = clamp(yaw, -1.3, 1.3), p1 = clamp(pitch, -0.7, 0.5);
          q[B.neck * 3 + 1] += y1 * 0.55; q[B.head * 3 + 1] += y1 * 0.35; q[B.neck * 3] += p1 * 0.5; q[B.head * 3] += p1 * 0.4; q[B.chest * 3 + 1] += y1 * 0.12;
        }
        bones = fk(q, p.x, p.y + p.jumpY, p.z, p.h, hs, p.lk.sw, p.lk.ll);
        // eyes: toward the look target, else straight ahead
        if (p.look) { const hm = bones[B.head], g = v3s(p.look, [hm[3], hm[7] + 0.18 * hs, hm[11]]); p.gaze = v3n(g); } else { p.gaze = [Math.sin(p.h), -0.05, Math.cos(p.h)]; }
        // towel sway from lateral motion and stride
        { const lat = p.vx * Math.cos(p.h) - p.vz * Math.sin(p.h), sp = Math.hypot(p.vx, p.vz); p.sway = clamp(-lat * 0.035, -0.3, 0.3) + 0.09 * Math.sin(p.ph) * Math.min(1, sp / 6); }
        if (!one && clip !== 'jump' && clip !== 'hurdle' && clip !== 'dive' && clip !== 'slide' && clip !== 'kick' && clip !== 'getup' && p.jumpY < 0.02 && !p.extra) footLock(p, bones, dt);
        if (p.reach && (clip === 'run' || clip === 'reach' || clip === 'jump' || clip === 'dive' || clip === 'backpedal' || clip === 'idle' || clip === 'stumble')) {
          const t = p.reach, ch = bones[B.chest], rx = [ch[0], ch[4], ch[8]], sep = t[1] > 1.7 * hs ? 0.055 : t[1] < 1.0 * hs ? 0.045 : 0.1; // diamond up high, scoop down low
          armIK(bones, -1, [t[0] - rx[0] * sep, t[1], t[2] - rx[2] * sep], hs);
          armIK(bones, 1, [t[0] + rx[0] * sep, t[1], t[2] + rx[2] * sep], hs);
        } else if (ball && ball.holder === p && clip !== 'throw' && clip !== 'stiff' && clip !== 'celebrate' && clip !== 'kick' && clip !== 'pocket') {
          // tuck the ball high and tight in the arm away from the nearest defender; the other arm keeps pumping
          if (clip === 'run' || clip === 'stumble') carrySideStep(p, dt);
          const sd = p.carrySide || 1, ch = bones[B.chest], tgt = mPt(ch, sd * 0.22 * hs, -0.02 * hs, 0.2 * hs);
          armIK(bones, sd, tgt, hs);
        }
      }
      if (an.blendT > 0 && an.from && an.from.length === NB) {
        an.blendT -= dt; const u = clamp(1 - an.blendT / an.blendDur, 0, 1), s = u * u * (3 - 2 * u);
        for (let i = 0; i < NB; i++) bones[i] = mLerp(an.from[i], bones[i], s);
      }
      p.bones = bones;
    }
    // foot locking: a foot that is on the ground stays where it first touched down until the clip lifts it, so feet never slide
    function footLock(p, bones, dt) {
      const hs = p.lk.hs, fl = p.fl || (p.fl = [{ on: 0, x: 0, z: 0, m: null, fade: 0 }, { on: 0, x: 0, z: 0, m: null, fade: 0 }]);
      const fwd = [Math.sin(p.h), 0, Math.cos(p.h)];
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1, ft = side < 0 ? B.ftL : B.ftR, m = bones[ft], L = fl[i];
        const soleY = m[7] - 0.07 * hs, planted = soleY < 0.045 * hs;
        if (planted) {
          if (!L.on) { L.on = 1; L.x = m[3]; L.z = m[11]; L.m = m.slice(); L.fade = 0; const sp = Math.hypot(p.vx, p.vz); if (sp > 6 && parts.length < 90 && crand() < 0.35) for (let k = 0; k < 2; k++) parts.push({ x: m[3], y: 0.06, z: m[11], vx: -p.vx * 0.25 + (crand() - 0.5) * 1.5, vy: 1.8 + crand() * 1.6, vz: -p.vz * 0.25 + (crand() - 0.5) * 1.5, life: 0.5 + crand() * 0.3, r: crand() * 6, c: WX === 'rain' ? [0.2, 0.14, 0.08, 1] : [0.1 + crand() * 0.1, 0.25 + crand() * 0.1, 0.06, 1], sz: 0.05 }); }
          const dx = L.x - m[3], dz = L.z - m[11], dd = Math.hypot(dx, dz);
          if (dd > 0.42 * hs) { L.on = 0; continue; }
          if (dd > 0.004) { const tgt = [L.x, m[7], L.z]; legIK(bones, side, tgt, hs, fwd, L.m, p.lk.ll); }
        } else if (L.on) {
          // just lifted: ease out of the locked position over a few frames
          L.on = 0; L.fade = 0.08; L.lx = L.x - m[3]; L.lz = L.z - m[11];
        }
        if (!L.on && L.fade > 0) { L.fade -= dt; const k = Math.max(0, L.fade / 0.08); const tgt = [m[3] + L.lx * k, m[7], m[11] + L.lz * k]; legIK(bones, side, tgt, hs, fwd, null, p.lk.ll); }
      }
    }
    function carrySideStep(p, dt) {
      p.carryT -= dt;
      if (p.carryT > 0) return;
      const foes = p.side ? off : def, fx = Math.sin(p.h), fz = Math.cos(p.h);
      let bd = 36, lat = 0;
      for (const d of foes) { if (d.rag) continue; const dx = d.x - p.x, dz = d.z - p.z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; lat = dx * fz - dz * fx; } }
      const want = Math.abs(lat) > 0.5 ? (lat > 0 ? -1 : 1) : p.carrySide;
      if (want !== p.carrySide) { p.carrySide = want; p.carryT = 0.7; }
    }
    const handPos = (p, side) => { const m = p.bones ? p.bones[side < 0 ? B.haL : B.haR] : null; return m ? mPt(m, 0, -0.04 * p.lk.hs, 0) : [p.x + Math.sin(p.h) * 0.5, 1.4, p.z + Math.cos(p.h) * 0.5]; };
    const chestPos = (p) => { const m = p.bones ? p.bones[B.chest] : null; return m ? mPt(m, 0, 0.12 * p.lk.hs, 0.1) : [p.x, 1.5, p.z]; };
    function ensureBones(p) { if (!p.bones) animUpdate(p, 0); return p.bones; }
    // knock a player down: starts the ragdoll from the current pose with the body's velocity plus an impact impulse
    function knockDown(p, vel, imp, getup) {
      if (p.rag) { if (imp) p.rag.impulse(imp[0] * 0.5, imp[1] * 0.5, imp[2] * 0.5, 0.3); return; }
      ensureBones(p);
      p.rag = new Rag(p, p.bones, vel || [p.vx, 0, p.vz], 1 / 60);
      if (imp) p.rag.impulse(imp[0], imp[1], imp[2], 0.35);
      p.dirt = Math.min(1, (p.dirt || 0) + 0.22 + crand() * 0.18); DIRT[p.side + ':' + p.key] = p.dirt; try { scuff(p.x, p.z, true); } catch (e) {}
      p.down = true; p.fall = 1; p.fallT = 1; p.getup = getup == null ? 1.3 : getup; p.rising = 0; p.reach = null; p.wrapT = 0; p.eng = null; p.jumpY = 0; p.jumpT = 0; p.diveT = 0; p.mv = null; p.mvT = 0;
      p.vx = p.vz = 0;
      pile.push(p);
    }
    function riseUp(p) {
      if (!p.rag) return;
      const q = p.rag.pts[0]; p.x = q[0]; p.z = q[2];
      const hd = v3s(p.rag.pts[1], p.rag.pts[0]);
      p.rag = null; p.down = false; p.fall = 0; p.fallT = 0; p.rising = 0.9; p.getup = 0; p.vx = p.vz = 0;
      setPose(p, 'idle');
      const i = pile.indexOf(p); if (i >= 0) pile.splice(i, 1);
    }
    function ragStep(p, dt) {
      const r = p.rag; if (!r) return;
      r.step(dt, (q, i) => { // pile up on bodies already down nearby
        let f = 0;
        for (const o of pile) { if (o === p || !o.rag || o.rag.t < 0.2) continue; const h = o.rag.pts[0]; if (Math.hypot(q[0] - h[0], q[2] - h[2]) < 0.55) f = Math.max(f, 0.26 * o.lk.hs); }
        return f;
      });
      p.x = r.pts[0][0]; p.z = r.pts[0][2];
      if (p.getup > 0 && (r.rest || r.t > 0.9)) { p.getup -= dt; if (p.getup <= 0 && (phase === 'live' || phase === 'dead' || phase === 'replay') && p !== closeP) riseUp(p); }
      else if (p.getup > 0 && r.t > 2.2) { p.getup = 0; if (p !== closeP) riseUp(p); }
    }
    function leanStep(p, dt) {
      const ax = (p.vx - p.pvx) / Math.max(dt, 1e-3), az = (p.vz - p.pvz) / Math.max(dt, 1e-3); p.pvx = p.vx; p.pvz = p.vz;
      const fx = Math.sin(p.h), fz = Math.cos(p.h), rx = fz, rz = -fx;
      const lat = clamp(-(ax * rx + az * rz) * 0.022, -0.3, 0.3), fwd = clamp((ax * fx + az * fz) * 0.016, -0.2, 0.25);
      const k = Math.min(1, dt * 7);
      p.lean += (lat - p.lean) * k; p.leanF += (fwd - p.leanF) * k;
      if (p.plant > 0) p.plant -= dt;
      if (p.stumbleT > 0) p.stumbleT -= dt;
      if (p.rising > 0) { p.rising -= dt; if (p.rising <= 0) p.rising = 0; }
    }

    // ---------- movement ----------
    const effV = (p) => p.v * (p.sprint && p.sta > 0 ? 1.2 + (p.spd - 50) * 0.0012 : 1) * (p.wrapT > 0 ? 0.3 : 1) * (p.stumbleT > 0 ? 0.72 : 1) * (p.rising > 0 ? 0 : 1);
    function steer(p, tx, tz, spd, dt, acc) {
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (d > 0.05) { const s = spd * Math.min(1, d * 1.5); vx = (dx / d) * s; vz = (dz / d) * s; }
      const k = Math.min(1, (acc || p.acc || 9) * dt);
      p.vx += (vx - p.vx) * k; p.vz += (vz - p.vz) * k;
    }
    function steerDir(p, ux, uz, spd, dt, acc) {
      const k = Math.min(1, (acc || p.acc || 9) * dt);
      p.vx += (ux * spd - p.vx) * k; p.vz += (uz * spd - p.vz) * k;
    }
    function staminaStep(p, dt, want) {
      p.sprint = !!want && p.sta > 0.02;
      const k = p.staK || 1; // stamina rating: how long he can sprint and how fast he gets his wind back
      if (p.sprint) p.sta = Math.max(0, p.sta - dt / (1.85 * k));
      else p.sta = Math.min(1, p.sta + dt * k / (Math.hypot(p.vx, p.vz) > 4 ? 5.5 : 3.6));
    }
    function integrate(p, dt) {
      if (p.rag) return;
      if (p.rising > 0) { p.vx *= Math.pow(0.02, dt); p.vz *= Math.pow(0.02, dt); }
      // a sharp cut plants the foot
      const sp = Math.hypot(p.vx, p.vz), psp = Math.hypot(p.pvx, p.pvz);
      if (sp > 3.5 && psp > 3.5 && p.plant <= 0) { const dot = (p.vx * p.pvx + p.vz * p.pvz) / (sp * psp); if (dot < 0.55) p.plant = 0.22; }
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.face2 != null) p.h += angDiff(p.face2, p.h) * Math.min(1, dt * 9);
      else if (sp > 0.6 && !p.hold) { const back = (p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h)) < -0.6 * sp; if (!back) p.h += angDiff(Math.atan2(p.vx, p.vz), p.h) * Math.min(1, dt * (p === ctrl ? 13 : 9)); }
      if (p.jumpT > 0 || p.jumpY > 0) { p.jumpV -= 17 * dt; p.jumpY = Math.max(0, p.jumpY + p.jumpV * dt); p.jumpT = Math.max(0, p.jumpT - dt); if (p.jumpY <= 0 && p.jumpT <= 0 && p.pose === 'jump' && p.poseT > 0.3) { p.poseT = Math.max(p.poseT, 0.74); } }
      if (p.diveT > 0) p.diveT -= dt;
      if (p.jumpDelay > 0) { p.jumpDelay -= dt; if (p.jumpDelay <= 0) { p.jumpV = p.jumpPow; p.jumpT = 0.7; p.jumpY = 0.01; } }
      leanStep(p, dt);
    }
    // capsule push-out so players never overlap; engaged pairs keep contact distance
    function collide() {
      const n = everyone.length;
      for (let i = 0; i < n; i++) {
        const a = everyone[i]; if (a.rag) continue;
        for (let j = i + 1; j < n; j++) {
          const b = everyone[j]; if (b.rag) continue;
          if (a.side !== b.side && ((a.mv === 'hurdle' && a.jumpY > 0.3) || (b.mv === 'hurdle' && b.jumpY > 0.3))) continue; // a hurdler is in the air over him
          const dx = a.x - b.x, dz = a.z - b.z, rr = (a.rad + b.rad) * (a.side === b.side ? 0.58 : a.eng === b ? 1 : 0.9), d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), k = (rr - d) / d, ma = a.mass || 1, mb = b.mass || 1, ws = (a.rad + b.rad) / rr, wa = ws * ma / (ma + mb), wb = ws * mb / (ma + mb); // the heavier body gives less ground
          const stat = (p) => (p.rising > 0 ? 0.2 : 1);
          const sa = stat(a), sb = stat(b), ssum = sa + sb || 1;
          a.x += dx * k * wb * (sa / ssum) * 2 * 0.5; a.z += dz * k * wb * (sa / ssum) * 2 * 0.5;
          b.x -= dx * k * wa * (sb / ssum) * 2 * 0.5; b.z -= dz * k * wa * (sb / ssum) * 2 * 0.5;
          if (a.eng !== b) { // bodies bump: trade a bit of momentum
            const nx = dx / d, nz = dz / d, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
            if (rel < 0) { const fa = mb / (ma + mb), fb = ma / (ma + mb); a.vx -= nx * rel * fa; a.vz -= nz * rel * fa; b.vx += nx * rel * fb; b.vz += nz * rel * fb; }
          }
        }
      }
    }
    const isRec = (p) => p.side === 0 && (p.key === 'X' || p.key === 'Z' || p.key === 'S' || p.key === 'Y' || p.key === 'RB');
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    function ballXZ() { if (!ball) return { x: 0, z: los, vx: 0, vz: 0 }; if (ball.holder) return ball.holder; return ball; }
    function nearest(list, x, z, filt) {
      let best = null, bd = 1e9;
      for (const p of list) { if (filt && !filt(p)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
      return [best, bd];
    }
    const free = (p) => !p.eng && p.stun <= 0 && !p.rag && p.rising <= 0;
    // where to run to meet a moving target (iterated intercept)
    function interceptPt(d, c, spd) {
      let t = 0, px = c.x, pz = c.z;
      const vx = c.vx || 0, vz = c.vz || 0;
      for (let i = 0; i < 4; i++) { px = c.x + vx * t; pz = c.z + vz * t; t = Math.min(1.8, Math.hypot(px - d.x, pz - d.z) / Math.max(spd, 1)); }
      return [c.x + vx * t, c.z + vz * t, t];
    }

    // ---------- engagements (blocks): two bodies pushing, the stronger one drives ----------
    function engage(b, d, run) {
      if (!b || !d || b.eng || d.eng || d.rag || b.rag || b.rising > 0 || d.rising > 0 || (d.imm > 0 && d.immOf === b)) return false;
      // the blocker has to be between the defender and the ball
      const g = carrier || (ball && ball.holder) || OK.QB; if (g && g !== b) { const gx = g.x - d.x, gz = g.z - d.z, bx = b.x - d.x, bz = b.z - d.z, gl = Math.hypot(gx, gz) || 1, bl = Math.hypot(bx, bz) || 1; if ((gx * bx + gz * bz) / (gl * bl) < 0.25) return false; }
      b.eng = d; d.eng = b; b.engT = d.engT = 0;
      const ratio = clamp(b.str / Math.max(25, d.str) * Math.pow((b.mass || 1) / (d.mass || 1), 0.35), 0.55, 1.7);
      d.shed = (run ? DP.shedRun : DP.shedPass) * ratio * (0.65 + rng() * 0.7) * (d.dbl ? 1.3 : 1) * (d.ko ? 0.55 : 1);
      d.shedSide = rng() < 0.5 ? -1 : 1;
      setPose(b, 'block'); setPose(d, 'rush');
      sfx.play('tackle');
      return true;
    }
    function shedEng(d) {
      const b = d.eng; if (!b) return;
      b.eng = null; b.stun = Math.max(b.stun, 0.35); b.stumbleT = 0.4; d.eng = null; d.imm = 2.6; d.immOf = b; d.dbl = 0;
      setPose(b, 'stumble'); setPose(d, 'run');
    }
    function engStep(d, dt) {
      const b = d.eng;
      if (!b || b.eng !== d) { d.eng = null; return; }
      d.engT += dt; b.engT = d.engT;
      const g = carrier || (ball && ball.holder) || OK.QB || ball || d;
      let gx = g.x - d.x, gz = g.z - d.z; const gl2 = Math.hypot(gx, gz) || 1; gx /= gl2; gz /= gl2;
      const winning = d.engT > d.shed * 0.55;
      const push = clamp((d.str - b.str) / 110 + ((d.mass || 1) - (b.mass || 1)) * 0.25 + (winning ? 0.5 : -0.25), -0.8, 0.9) * 1.6;
      // the rusher works toward the ball; the blocker stays square and drives
      let sx = 0, sz = 0;
      if (winning) { const side = d.shedSide; sx = -gz * side * 1.2; sz = gx * side * 1.2; }
      d.vx = gx * push + sx; d.vz = gz * push + sz;
      b.vx = gx * push * 0.9; b.vz = gz * push * 0.9;
      b.face2 = Math.atan2(d.x - b.x, d.z - b.z); d.face2 = Math.atan2(b.x - d.x, b.z - d.z);
      b.drive = clamp(0.5 - push * 0.5, 0, 1); d.drive = clamp(0.5 + push * 0.5, 0, 1);
      if (b.pose !== 'block') setPose(b, 'block'); if (d.pose !== 'rush') setPose(d, 'rush');
      if (d.engT > d.shed) { shedEng(d); d.vx = gx * d.v * 0.85; d.vz = gz * d.v * 0.85; }
    }

    // ---------- offense AI ----------
    function offenseAI(dt) {
      const qb = OK.QB, pt = play.type;
      if (!qb) { // kick-return unit: block for the returner, chase a defensive carrier or the ball
        for (const p of off) {
          p.face2 = null;
          if (p.rag || p.rising > 0 || p.eng || (p === ctrl && mode !== 'catch')) continue;
          if (p.stun > 0) { p.vx *= 0.9; p.vz *= 0.9; continue; }
          if (p === carrier) { autoRun(p, dt); continue; }
          if (thrown && ball && ball.st === 'air' && ball.kind === 'pass' && isRec(p) && recTrack(p, dt)) continue; // test scenarios (no passer on the field)
          if (carrier && carrier.side === 0) leadBlock(p, dt);
          else if (carrier) chaseCarrier(p, dt);
          else if (ball) steer(p, ball.x, ball.z, p.v, dt, 10);
        }
        return;
      }
      for (const p of off) {
        p.face2 = null;
        if (p.rag || p.rising > 0) continue;
        if (p === ctrl && mode !== 'catch') continue;
        if (p.eng) continue;
        if (p.stun > 0) { p.vx *= 0.9; p.vz *= 0.9; continue; }
        if (p === carrier && p !== ctrl) { autoRun(p, dt); continue; }
        if (thrown && ball && ball.st === 'air' && isRec(p)) { if (recTrack(p, dt)) continue; }
        if (p.role === 'QB') { qbAI(p, dt); continue; }
        if (p.key === (play.carrier || 'RB') && (pt === 'run' || pt === 'draw') && !handed) { rbMesh(p, dt); continue; }
        if (carrier && carrier.side === 0 && carrier !== p) { leadBlock(p, dt); continue; }
        if (carrier && carrier.side === 1) { chaseCarrier(p, dt); continue; }
        if (p.role === 'OL') { olAI(p, dt); continue; }
        if (p.R && !(p.blk === 'chip' && tPlay < p.R.blk)) {
          if (pt === 'pa' || pt === 'boot') { if (tPlay < 0.25) { p.vx *= 0.8; p.vz *= 0.8; continue; } }
          runRoute(p, dt);
          continue;
        }
        if (pt === 'run' || pt === 'sneak' || (pt === 'draw' && handed)) runBlock(p, dt);
        else passPro(p, dt);
      }
    }
    // a receiver on his route: sharp breaks, settle into zone holes, keep moving against tight man coverage
    function runRoute(p, dt) {
      const q = posAt(p.R, tPlay), qb = OK.QB;
      let tx = q.x, tz = q.z;
      const [nd, dd] = nearest(def, p.x, p.z, (d) => !d.rag);
      if (q.end && p.R.sit) {
        if (nd && dd < 3.2) { // find the soft spot away from the nearest defender
          const ax = p.x - nd.x, az = p.z - nd.z, al = Math.hypot(ax, az) || 1;
          tx = q.x + ax / al * 1.6; tz = q.z + Math.max(-0.5, az / al * 0.8);
          if (nd.ass && nd.ass.t === 'man') { tx = q.x + (ax / al) * 2.2 + Math.sin(tPlay * 2.5) * 0.4; tz = q.z + 1.2; }
        }
        steer(p, tx, tz, p.R.v * 0.9, dt, 9);
        if (Math.hypot(tx - p.x, tz - p.z) < 0.7) { p.face2 = Math.atan2(qb.x - p.x, qb.z - p.z); p.vx *= 0.7; p.vz *= 0.7; }
      } else {
        const spd = p.R.v * 1.05;
        steer(p, tx, tz, spd, dt, 14);
      }
      p.look = thrown ? null : [qb.x, 1.6, qb.z];
      staminaStep(p, dt, !q.end && q.seg === p.R.seg.length - 1 && p.R.len > 25 && tPlay > 1);
    }
    // ball in the air: the target (and anyone who can get there) adjusts to it on the run. He times his path to meet the ball where
    // it comes down rather than sprinting to the spot and waiting: a ball led in front keeps him at full speed, a well-placed
    // one he catches in stride, an under-thrown one makes him throttle down and come back for it (and lets a trailing defender in).
    function recTrack(p, dt) {
      const b = ball, cp = b.cp; if (!cp) return false;
      const dd = Math.hypot(cp.x - p.x, cp.z - p.z), tl = Math.max(0.02, cp.t), mine = p === target;
      if (!mine && (dd > 6 || dd / effV(p) > tl + 0.6)) return false; // teammates within a few yards converge for a tip
      const user = p === ctrl && userDir();
      // eyes back to the ball a beat after it leaves the hand: until then he keeps running the route
      if (!user && p.R && b.t < (p.findT || 0) && !b.tipped) { runRoute(p, dt); p.look = [b.x, b.y, b.z]; return true; }
      if (user) { const d = userDir(); steerDir(p, d[0], d[1], effV(p) * (p.jumpY > 0 ? 0.3 : 1), dt, p.acc * 1.4); }
      else if (p.diveT <= 0 && p.jumpY <= 0 && p.jumpDelay <= 0) {
        // his running and his sprinting speed (he sprints only when he would otherwise be late, so he does not flicker between them)
        const wasSpr = p.sprint; p.sprint = false; const vRun = effV(p); p.sprint = true; const vSpr = p.sta > 0.02 ? effV(p) : vRun; p.sprint = wasSpr;
        const sp = Math.hypot(p.vx, p.vz), hv = Math.hypot(b.vx, b.vz) || 1;
        // stay in bounds: he works to the boundary and reaches for a ball going out rather than running out after it
        let ax = clamp(cp.x, -HW + 0.45, HW - 0.45), az = Math.min(cp.z, 109.4);
        if (!mine) { const ox = p.x - cp.x, oz = p.z - cp.z, ol = Math.hypot(ox, oz) || 1; ax = clamp(cp.x + ox / ol * 1.3, -HW + 0.45, HW - 0.45); az = Math.min(cp.z + oz / ol * 1.3, 109.4); }
        // a ball coming right to him (curl, hitch, under-thrown): step back toward the passer to meet it and shield it
        if (sp < 2.6 && dd < 1.6) { ax -= b.vx / hv * 0.55; az -= b.vz / hv * 0.55; }
        // a defender breaking on the ball would get there first: attack it now and fight for the spot instead of timing it
        // (he beats the defender there by a step rather than sprinting to the spot to wait)
        let threat = false, tD = 9; if (mine) for (const d of def) { if (d.rag || d.eng || d.stun > 0 || tPlay < (d.breakAt || 0)) continue; const t = Math.hypot(cp.x - d.x, cp.z - d.z) / (effV(d) || 1); if (t < tl - 0.12 && t < tD) { threat = true; tD = t; } }
        const tArr = Math.max(0.06, threat ? Math.min(tl - 0.05, tD - 0.12) : tl - 0.05);
        let vx = (ax - p.x) / tArr, vz = (az - p.z) / tArr, need = Math.hypot(vx, vz);
        const late = need > vRun * (wasSpr ? 0.9 : 0.97) || threat;
        staminaStep(p, dt, late || (p === ctrl && input.sprint)); // hunting a ball he would be late for: full sprint
        const top = p.sprint ? vSpr : vRun;
        const nl = need || 1, ux = vx / nl, uz = vz / nl;
        if (need > top) need = top;
        if (threat) need = Math.min(need, Math.max(Math.hypot(ax - p.x, az - p.z) * 3.2 + 0.4, top * 0.6)); // fighting for the spot: get there first, still on the move (no dead stop: he has to run after the catch)
        if (need > 0.05) steerDir(p, ux, uz, need, dt, p.acc * 1.5); else { p.vx *= 0.85; p.vz *= 0.85; }
        if (dd < 0.9 && tl < 0.45) p.face2 = Math.atan2(b.x - p.x, b.z - p.z);
      }
      // hands go to the ball on the way in
      if (tl < 0.75 && dd < 3.5) { const ahead = Math.min(tl, 0.12); p.reach = [b.x + b.vx * ahead, Math.max(0.5, b.y + b.vy * ahead - 0.5 * GRAV * ahead * ahead), b.z + b.vz * ahead]; if (p.pose !== 'jump' && p.pose !== 'dive') setPose(p, 'reach', true); }
      else p.reach = null;
      p.look = [b.x, b.y, b.z];
      // AI receivers time a jump for a high ball or lay out for one just beyond reach; for the player's receiver it is an assist
      // that fires only if he has not jumped or dived himself by then
      {
        if (p.jumpY <= 0 && p.jumpT <= 0 && p.jumpDelay <= 0 && p.diveT <= 0) {
          const [tc, yc, side] = ballOver(p), top = effV(p), lp = b.lp || cp, dl = Math.hypot(lp.x - p.x, lp.z - p.z);
          // go up when the ball will cross over his head within jumping reach, or to high-point it over a defender who is right there
          const [, nd] = nearest(def, cp.x, cp.z, (d) => !d.rag && !d.eng), jt = Math.max(0, tc - 0.16), jy = Math.max(0, (5.6 + (p.agi - 50) * 0.02) * jt - 8.5 * jt * jt), hs = p.lk.hs;
          if ((mine || b.tipped) && tc > 0.2 && tc < 0.55 && side < 0.9 && yc > (nd < 1.6 ? 2.15 : 2.45) * hs && yc < 2.45 * hs + jy + 0.2) doJump(p);
          // lay out when he cannot get to it on foot, not even at the last catchable moment (waist high)
          else if ((mine || b.tipped) && lp.t < 0.45 && dl > 0.8) { const [gt, gap, gapAny] = reachGap(p, lp, Math.max(top, p.v * 1.15)); if (gt < 0.36 && gapAny > 1.15 && gap < 2.8) doDive(p); }
        }
      }
      return true;
    }
    function qbAI(p, dt) {
      const pt = play.type, fx = flip ? -1 : 1, rb = OK.RB, under = FORMS[play.form].under;
      p.hold = !!(ball && ball.holder === p && !thrown);
      if (ball && ball.holder !== p && (handed || thrown)) {
        if (pt === 'run' || pt === 'draw') steer(p, p.x - fx * 1.2, p.z - 1, 3, dt);
        else { p.vx *= 0.85; p.vz *= 0.85; }
        p.face2 = carrier ? Math.atan2(carrier.x - p.x, carrier.z - p.z) : null; p.look = carrier ? [carrier.x, 1.5, carrier.z] : ball ? [ball.x, ball.y, ball.z] : null;
        return;
      }
      if (pt === 'run' || pt === 'sneak') {
        if (pt === 'sneak') return;
        const lane = (play.lane || 0) * fx;
        if (play.toss) { p.face2 = Math.atan2(lane, -1); steer(p, p.x + fx * 0.6, p.z - 0.8, 2.5, dt); return; }
        steer(p, lane * 0.25, los - 3.0, 4.2, dt); p.face2 = Math.atan2(lane - p.x, -1.5);
        return;
      }
      if (pt === 'draw') { steer(p, 0, los - (under ? 5.5 : 6.4), 4.5, dt); p.face2 = 0; return; }
      if (pt === 'pa' || pt === 'boot') {
        if (tPlay < 0.75) { steer(p, fx * 0.7, los - 3.4, 4, dt); p.face2 = Math.atan2(rb.x - p.x, rb.z - p.z); return; }
        if (pt === 'boot') { steer(p, fx * 9, los - 7.2, 6.2, dt); p.face2 = Math.atan2(fx * 0.6, 1); return; }
        steer(p, 0, los - 7.2, 5, dt); p.face2 = 0; return;
      }
      const dz = under ? 6.8 : 6.3;
      steer(p, p.x * 0.97, los - dz, under ? 5.4 : 3.5, dt); p.face2 = aim && aim.spot ? Math.atan2(aim.spot.x - p.x, aim.spot.z - p.z) : 0;
      p.look = aim && aim.spot ? [aim.spot.x, 1.5, aim.spot.z] : [p.x, 1.6, p.z + 20];
    }
    function rbMesh(p, dt) {
      const pt = play.type, qb = OK.QB, fx = flip ? -1 : 1, lane = (play.lane || 0) * fx;
      if (pt === 'draw' && tPlay < 0.75) { steer(p, p.x, p.z, 1, dt); p.face2 = 0; return; }
      if (play.toss) { steer(p, lane * 0.85, los - 4.2, p.v, dt, 10); return; }
      if (play.cnt && tPlay < 0.28) { steer(p, p.x - Math.sign(lane || fx) * 1.6, p.z + 0.2, p.v * 0.7, dt, 10); return; } // counter: jab step away from the hole
      const wide = p.key !== 'RB'; // a receiver on a sweep sprints to the mesh point
      steer(p, qb.x + (lane - qb.x) * 0.12 + Math.sign(lane || fx) * 0.5, qb.z - 0.4, p.v * (wide ? 1 : 0.9), dt, 10);
      if (Math.hypot(p.x - qb.x, p.z - qb.z) < (wide ? 1.4 : 1.05) && tPlay > 0.3 && ball.holder === qb) doHandoff(p);
    }
    function passPro(p, dt) {
      const qb = OK.QB;
      const [r, rd] = nearest(def, qb.x, qb.z, (d) => d.ass && d.ass.t === 'rush' && !d.eng && !d.rag && d.z > qb.z - 1.5);
      if (r && rd < 9) { steer(p, r.x + (qb.x - r.x) * 0.25, r.z + (qb.z - r.z) * 0.25, p.v * 0.9, dt, 10); if (dist(p, r) < p.rad + r.rad + 0.25) engage(p, r, false); return; }
      steer(p, qb.x + (p.x > qb.x ? 1.6 : -1.6), qb.z + 0.8, 4, dt); p.face2 = 0; setPose(p, 'block', true);
    }
    function olAI(p, dt) {
      const qb = OK.QB, pt = play.type;
      if (pt === 'run' || pt === 'sneak' || (pt === 'draw' && handed)) { runBlock(p, dt); return; }
      if (pt === 'screen' && tPlay > 1.0 && thrown) { leadBlock(p, dt); return; }
      const idx = +p.key.slice(2), home = { x: (idx - 2) * 2.05, z: los - 1.5 - Math.abs(idx - 2) * 0.35 };
      if (!p.tgt || (p.tgt.eng && p.tgt.eng !== p) || p.tgt.rag) {
        const [r, rd] = nearest(def, home.x, home.z + 1, (d) => d.ass && d.ass.t === 'rush' && !d.rag && !(d.imm > 0 && d.immOf === p) && (!d.eng || (d.eng.role !== 'OL' || rng() < 0.002)) && Math.abs(d.x - home.x) < 3.4);
        p.tgt = r && rd < 6 ? r : null;
        if (!p.tgt) { const [e] = nearest(def, home.x, home.z, (d) => d.eng && d.eng !== p && d.role === 'DL' && Math.abs(d.x - home.x) < 3); if (e) { e.dbl = 1; p.help = e; } }
      }
      const r = p.tgt;
      setPose(p, 'block', true); p.drive = 0.2;
      if (r && !r.eng) {
        const tx = r.x + (qb.x - r.x) * 0.3, tz = Math.max(los - 5, r.z + (qb.z - r.z) * 0.3);
        steer(p, tx, tz, p.v, dt, 12); p.face2 = Math.atan2(r.x - p.x, r.z - p.z);
        if (dist(p, r) < p.rad + r.rad + 0.25 && (pt !== 'screen' || tPlay < 0.9)) engage(p, r, false);
        if (pt === 'screen' && tPlay > 0.6) { p.tgt = null; }
      } else if (p.help && p.help.eng) { steer(p, p.help.x - (p.help.x - p.x) * 0.3, p.help.z - 0.9, 4, dt); p.face2 = 0; }
      else steer(p, home.x, home.z, 3.5, dt);
      if (!p.eng && !(p.help && p.help.eng)) p.face2 = p.face2 == null ? 0 : p.face2;
    }
    function runBlock(p, dt) {
      const fx = flip ? -1 : 1, lane = (play.lane || 0) * fx;
      if (!p.tgt || p.tgt.rag || (p.tgt.eng && p.tgt.eng !== p)) {
        let best = null, bs = 1e9;
        for (const d of def) {
          if (d.rag || (d.eng && d.eng !== p)) continue;
          if (d.z < p.z - 1.5) continue;
          let s = Math.hypot(d.x - (p.x + lane * 0.15), (d.z - p.z) * 0.8);
          if (p.role !== 'OL' && p.key !== 'S' && d.role === 'DL') s += 4;
          if (p.key === 'S' && play.lead && d.role === 'LB') s -= 3;
          if (p.role === 'WR' && (d.role === 'CB' || d.role === 'S')) s -= 4;
          if (s < bs) { bs = s; best = d; }
        }
        p.tgt = best;
      }
      const d = p.tgt;
      setPose(p, 'block', true); p.drive = 0.5;
      if (!d) { steer(p, p.x, p.z + 2, 3, dt); return; }
      const g = carrier || OK.RB;
      const tx = d.x + (g.x - d.x) * 0.25, tz = d.z + (g.z - d.z) * 0.25;
      steer(p, tx, tz, p.v * (p.role === 'OL' ? 1 : 0.95), dt, 12);
      p.face2 = Math.atan2(d.x - p.x, d.z - p.z);
      if (dist(p, d) < p.rad + d.rad + 0.25) engage(p, d, true);
    }
    function leadBlock(p, dt) {
      const c = carrier;
      if (!c) return;
      if (!p.tgt || p.tgt.rag || (p.tgt.eng && p.tgt.eng !== p) || dist(p.tgt, c) > 14) {
        let best = null, bs = 1e9;
        for (const d of def) { if (d.rag || d.eng) continue; const s = dist(d, c) + dist(d, p) * 0.7 + (d.z < c.z - 2 ? 6 : 0); if (s < bs) { bs = s; best = d; } }
        p.tgt = best;
      }
      const d = p.tgt;
      if (!d) { steer(p, p.x, p.z + 2, 3, dt); return; }
      steer(p, (d.x + c.x) / 2 * 0.25 + d.x * 0.75, (d.z + c.z) / 2 * 0.25 + d.z * 0.75, p.v * (d.ko ? 0.82 : 0.95), dt, 9);
      if (dist(p, d) < p.rad + d.rad + 0.2 && (!d.ko || rng() < 0.6)) engage(p, d, true);
      p.look = [c.x, 1.5, c.z];
    }
    function chaseCarrier(p, dt) {
      const c = carrier, ip = interceptPt(p, c, effV(p));
      staminaStep(p, dt, dist(p, c) < 12);
      steer(p, ip[0], ip[1], effV(p) * (p.role === 'OL' ? 0.85 : 1), dt, 9);
      p.look = [c.x, 1.5, c.z];
      if (dist(p, c) < p.rad + c.rad + 0.2 && !c.rag && tPlay - (c.lastTackle || -9) > 0.5) { c.lastTackle = tPlay; if (rng() < 0.75) hitCarrier(c, p); }
    }

    // ---------- defense AI ----------
    function defenseAI(dt) {
      const qb = OK.QB || { x: 0, z: los - 5 };
      const runMode = runSeen >= 0;
      for (const d of def) {
        d.face2 = null;
        if (d.rag || d.rising > 0) continue;
        if (d.stun > 0) { d.vx *= Math.pow(0.05, dt); d.vz *= Math.pow(0.05, dt); continue; }
        if (d === carrier) { returnRun(d, dt); continue; }
        if (carrier && carrier.side === 1) { leadBlockDef(d, dt); continue; }
        if (d.eng) { engStep(d, dt); continue; }
        d.look = ball ? (ball.holder ? [ball.holder.x, 1.5, ball.holder.z] : [ball.x, ball.y, ball.z]) : null;
        if (ball && ball.st === 'loose') { steer(d, ball.x, ball.z, effV(d), dt, 9); continue; }
        if (carrier) {
          const readT = d.role === 'DL' ? 0 : d.role === 'LB' ? DP.read : DP.read * 1.2;
          if (!runMode || tPlay - runSeen > readT || dist(d, carrier) < 4 || carrier.z > los + 1) { pursue(d, dt); continue; }
        }
        if (thrown && ball && ball.st === 'air') { if (playBall(d, dt)) continue; }
        const a = d.ass || { t: 'rush' };
        if (a.t === 'rush') { rushQB(d, dt); continue; }
        if ((play.type === 'pa' || play.type === 'boot') && d.role === 'LB' && tPlay < 0.4 + DP.bite * 0.6) { steer(d, d.x * 0.9, los + 2, d.v * 0.8, dt); continue; }
        if (a.t === 'man') manCover(d, dt);
        else zoneCover(d, dt);
        if (d.vz > 0.5 && Math.hypot(d.vx, d.vz) < 6.2 && (d.role === 'CB' || d.role === 'S')) d.face2 = Math.atan2(qb.x - d.x, qb.z - d.z);
      }
    }
    function manCover(d, dt) {
      const r = d.ass.tgt;
      if (!r) { zoneCover(d, dt); return; }
      let tx, tz;
      if (r.R && !thrown && !(r.blk === 'chip' && tPlay < r.R.blk)) {
        const lag = DP.lag * d.lagK, q = posAt(r.R, Math.max(0, tPlay - lag));
        const k = Math.max(0, 1 - tPlay / 1.6), sp = Math.hypot(q.vx, q.vz) || 1;
        tx = q.x - r.R.s * 0.4 - (q.vx / sp) * 0.5; tz = q.z + DP.cush * k - (q.vz / sp) * 0.5 * (1 - k);
      } else { tx = r.x; tz = r.z + 1.2; }
      staminaStep(d, dt, dist(d, r) > 2.5 && tPlay > 1);
      steer(d, tx, tz, effV(d) * d.spdK, dt, 8);
    }
    const ZR = { X: 1, Z: 1, S: 1, Y: 1, RB: 1 };
    function zoneCover(d, dt) {
      const a = d.ass, Lx = a.x, Lz = los + a.z;
      let tx = Lx, tz = Lz, best = null, bs = 1e9;
      for (const r of off) {
        if (!ZR[r.key] || !r.R || r.blk === 'block') continue;
        const dx = r.x - Lx, dz = r.z - Lz;
        let s;
        if (a.deep) { if (r.z < Lz - 10 || Math.abs(dx) > 11) continue; s = -r.z + Math.abs(dx) * 0.4; }
        else { const dd = Math.hypot(dx, dz * 1.25); if (dd > 8.5) continue; s = dd; }
        if (s < bs) { bs = s; best = r; }
      }
      if (best) {
        if (a.deep) { tx = lerp(Lx, best.x, 0.75); tz = Math.max(Lz - 3, best.z + 3.2); }
        else { const k = DP.zoneTight; tx = lerp(Lx, best.x, k); tz = lerp(Lz, best.z - 0.5, k * 0.9); }
      }
      if (aim && aim.spot && aim.dur > 0.25) {
        const s = DP.stare * clamp((aim.dur - 0.25) / 1.2, 0, 1) * (Math.hypot(aim.spot.x - d.x, aim.spot.z - d.z) < 14 ? 1 : 0.3);
        tx = lerp(tx, aim.spot.x, s * 0.55); tz = lerp(tz, aim.spot.z, s * 0.4);
      }
      staminaStep(d, dt, false);
      steer(d, tx, tz, d.v * (tPlay < 0.45 ? 0.8 : 1), dt, 7);
    }
    function rushQB(d, dt) {
      const qb = carrier || OK.QB, fx = d.x < 0 ? -1 : 1;
      if (!qb) return;
      let tx = qb.x, tz = qb.z;
      const scrambling = carrier === OK.QB || (mode === 'aim' && Math.hypot(qb.vx, qb.vz) > 3);
      if (d.stunt && tPlay < 0.55) { tx = d.x + d.stunt * 3; tz = los + 0.2; }
      else if (scrambling) { const ip = interceptPt(d, qb, effV(d)); tx = ip[0]; tz = ip[1]; if (d.role === 'DL' && Math.abs(d.x) > 3 && Math.sign(qb.x) === Math.sign(d.x)) tx += fx * 1.2; } // contain the edge
      else if (d.role === 'DL' && Math.abs(d.x) > 3 && d.z > qb.z + 2.2) { tx = qb.x + fx * 2.4; tz = qb.z + 1.2; }
      staminaStep(d, dt, scrambling || tPlay > 2.2);
      steer(d, tx, tz, effV(d) * (d.role === 'DL' ? 1 : 0.95), dt, 8);
      if (!d.eng && !(d.imm > 0)) for (const b of off) { if ((b.role === 'OL' || b.blk) && !b.eng && b !== ctrl && !b.rag && dist(b, d) < b.rad + d.rad + 0.2 && b.z <= d.z + 0.3) { if (engage(b, d, false)) break; } }
    }
    function pursue(d, dt) {
      const c = carrier || ballXZ(); if (!c) return;
      const dd = dist(d, c);
      staminaStep(d, dt, dd < 11 && dd > 1.5);
      const sp = effV(d) * (d.spdK || 1) * (d.role === 'DL' ? 0.92 : 1);
      const ip = interceptPt(d, c, sp);
      // take the sideline angle: aim slightly ahead on the inside of a runner heading for the boundary
      let tx = ip[0], tz = ip[1];
      if (c.vx && Math.abs(c.x) > 12 && Math.sign(c.vx) === Math.sign(c.x) && d.z > c.z) tx += Math.sign(c.x) * 0.6;
      steer(d, tx, tz, sp, dt, 8);
      d.look = [c.x, 1.4, c.z];
      if (!d.eng && dd > 1.6 && !(d.imm > 0)) for (const b of off) { if (b !== carrier && b !== ctrl && b.eng == null && !b.rag && (b.tgt === d || b.role === 'OL') && dist(b, d) < b.rad + d.rad + 0.15) { if (engage(b, d, true)) break; } }
      // lunge when close and closing
      // a runner in the air: a good defender stays on his feet and catches him instead of diving under him
      if (c.jumpY > 0.2) { if (d.stayUp == null) d.stayUp = rng() < 0.25 + KDEF * 0.55; } else d.stayUp = null;
      if (dd < 1.55 && d.pose !== 'tackle' && !c.rag && c.side === 0 && !(c.jumpY > 0.2 && d.stayUp)) {
        const cl = (d.vx * (c.x - d.x) + d.vz * (c.z - d.z)) / (dd || 1);
        if (cl > 0.5) { setPose(d, 'tackle'); d.lunge = 0.3; const ux = (c.x - d.x) / dd, uz = (c.z - d.z) / dd; d.vx += ux * 2.2; d.vz += uz * 2.2; }
      }
    }
    // the ball is up: who can get there drives to the catch point; the rest close on the receiver
    function playBall(d, dt) {
      if (!ball || ball.st !== 'air' || ball.kind !== 'pass' || !ball.cp) return false;
      const b = ball, cp = b.cp, tl = Math.max(0.02, cp.t), dd = Math.hypot(cp.x - d.x, cp.z - d.z);
      const canSee = tPlay >= (d.breakAt || 0);
      if (!canSee) return false;
      const sp = effV(d) * (d.spdK || 1);
      const arrive = dd / sp;
      staminaStep(d, dt, dd < 14);
      if (dd < 16 && arrive < tl + 0.2) {
        // trailing the receiver to the spot: he can't go through him, so he works to the receiver's shoulder and plays the hands
        let ax = cp.x, az = cp.z; const t = target;
        if (t && t !== d && !t.rag) { const rx = cp.x - t.x, rz = cp.z - t.z, rl = Math.hypot(rx, rz), qx = cp.x - d.x, qz = cp.z - d.z; if (rl + 0.3 < dd && (rx * qx + rz * qz) > 0.7 * rl * dd && dist(d, t) < 3) { const px = -rz / (rl || 1), pz = rx / (rl || 1), sd = (d.x - t.x) * px + (d.z - t.z) * pz >= 0 ? 1 : -1; ax = cp.x + px * sd * 0.7 - rx / (rl || 1) * 0.3; az = cp.z + pz * sd * 0.7 - rz / (rl || 1) * 0.3; } }
        steer(d, ax, az, sp * 1.02, dt, 9);
        if (dd < 2.6 && tl < 0.7) { const ahead = Math.min(tl, 0.1); d.reach = [b.x + b.vx * ahead, b.y + b.vy * ahead, b.z + b.vz * ahead]; if (d.pose !== 'jump') setPose(d, 'reach', true); } else d.reach = null;
        if (d.jumpY <= 0 && d.jumpT <= 0 && d.jumpDelay <= 0 && d.diveT <= 0) {
          const [tc, yc, side] = ballOver(d);
          if (tc > 0.3 && tc < 0.56 && side < 1.3 && yc > 2.2 && yc < 3.6) doJump(d);
          // lay out for a pick (or to get a hand on it) when it is coming down just out of reach
          else if (!d.dvTry && tl < 0.3 && dd > sp * tl + 0.4 && dd < sp * tl + 2.1 && cp.y < 1.9) { d.dvTry = 1; if (rng() < 0.4 + 0.45 * KDEF) doDive(d); }
        }
        return true;
      }
      if (target) {
        const ip = interceptPt(d, target, sp); steer(d, ip[0], ip[1], sp, dt, 8);
        // on the receiver's hip as it arrives: play through his hands
        if (dist(d, target) < 2.2 && tl < 0.6) { const ahead = Math.min(tl, 0.1); d.reach = [b.x + b.vx * ahead, b.y + b.vy * ahead, b.z + b.vz * ahead]; if (d.pose !== 'jump' && d.pose !== 'dive') setPose(d, 'reach', true); } else d.reach = null;
        return true;
      }
      return false;
    }
    function leadBlockDef(d, dt) {
      const c = carrier;
      const [o, od] = nearest(off, c.x, c.z, (p) => !p.rag);
      if (o && od < 10) steer(d, (o.x + c.x) / 2, (o.z + c.z) / 2, d.v * 0.9, dt);
      else steer(d, c.x + (d.x > c.x ? 3 : -3), c.z - 3, d.v * 0.8, dt);
    }
    function returnRun(c, dt) {
      let ux = 0, uz = -1;
      for (const o of off) { if (o.rag) continue; const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz); if (d < 7 && dz > -2) { ux += dx / d / d * 4; uz += dz / d / d * 2; } }
      if (Math.abs(c.x) > HW - 3) ux -= Math.sign(c.x) * 1.5;
      const l = Math.hypot(ux, uz) || 1;
      staminaStep(c, dt, true);
      steerDir(c, ux / l, uz / l, effV(c) * 1.02, dt, 8);
    }

    // ---------- snap, handoff, pitch ----------
    function snap() {
      if (phase !== 'pre' || finished) return;
      phase = 'live'; tPlay = 0; introT0(); clearBanner(); closeSheet();
      sfx.play('hike'); sfx.crowd(0.18 + excite * 0.3);
      const qb = OK.QB, under = FORMS[play.form].under;
      ball = { st: 'snap', x: 0, y: 0.3, z: los, t: 0, T: under ? 0.08 : 0.24, holder: null, vx: 0, vy: 0, vz: 0, spin: 0 };
      pr = { type: play.type, start: los, down, togo: fdz - los, third: down === 3, cov: dcall.name, kind: isPassPlay(play) ? 'pass' : 'rush', passer: null, tgt: null, rec: null, rusher: null, catchZ: null, yac: 0, notes: [] };
      if (play.type === 'sneak') pr.rusher = qb;
      hist.push({ id: play.id, cat: play.cat, blitz: dcall ? dcall.blitz : 0 }); if (hist.length > 6) hist.shift();
      for (const p of everyone) setPose(p, 'run');
      setControls(true); drivePlays++;
    }
    function ballHeldByQB() {
      const qb = OK.QB;
      ball = { st: 'held', holder: qb, x: qb.x, y: 1.3, z: qb.z, vx: 0, vy: 0, vz: 0 };
      if (play.type === 'sneak') { carrier = qb; ctrl = qb; mode = 'run'; runSeen = tPlay; pr.rusher = qb; setControls(true); return; }
      if (play.type === 'run' || play.type === 'draw') { mode = 'none'; setControls(true); return; }
      mode = 'aim'; setControls(true);
    }
    function doHandoff(rb) {
      if (handed || ball.holder !== OK.QB) return;
      handed = true; runSeen = tPlay;
      ball = { st: 'held', holder: rb, x: rb.x, y: 1.3, z: rb.z, vx: 0, vy: 0, vz: 0 };
      carrier = rb; ctrl = rb; mode = 'run'; pr.rusher = rb; pr.kind = 'rush';
      setControls(true);
    }
    function doPitch() {
      const qb = OK.QB, rb = OK.RB;
      if (handed || ball.holder !== qb) return;
      handed = true; runSeen = tPlay;
      const T = 0.42, tx = rb.x + rb.vx * T, tz = rb.z + rb.vz * T;
      ball = { st: 'pitch', x: qb.x, y: 1.3, z: qb.z, fx: qb.x, fz: qb.z, tx, tz, t: 0, T, holder: null, to: rb, vx: 0, vy: 0, vz: 0 };
      qb.armT = 0.3;
    }
    function snapStep(dt) {
      const qb = OK.QB, b = ball;
      if (b.st === 'snap') {
        b.t += dt; const u = Math.min(1, b.t / b.T);
        b.x = lerp(0, qb.x, u); b.z = lerp(los, qb.z, u); b.y = lerp(0.3, 1.3, u) + Math.sin(u * Math.PI) * 0.4;
        if (u >= 1) ballHeldByQB();
      } else if (b.st === 'pitch') {
        b.t += dt; const u = Math.min(1, b.t / b.T);
        b.x = lerp(b.fx, b.tx, u); b.z = lerp(b.fz, b.tz, u); b.y = 1.2 + Math.sin(u * Math.PI) * 0.8;
        if (u >= 1) { const rb = b.to; ball = { st: 'held', holder: rb, x: rb.x, y: 1.3, z: rb.z, vx: 0, vy: 0, vz: 0 }; carrier = rb; ctrl = rb; mode = 'run'; pr.rusher = rb; setControls(true); sfx.play('catch'); }
      }
      if (play.toss && b.st === 'held' && b.holder === qb && tPlay > 0.32) doPitch();
    }

    // ---------- passing: arm strength, accuracy, pressure ----------
    const QBR = SQ.QB.r;
    const maxDist = () => 26 + (QBR.thr - 30) * 0.52 - WET * 3;
    const bulletV = () => 17 + (QBR.thr - 30) * 0.13;
    function pressure() {
      const qb = OK.QB; let p = 0;
      for (const d of def) if (!d.eng && !d.rag && d.stun <= 0) p = Math.max(p, clamp((3.2 - dist(d, qb)) / 3.2, 0, 1));
      return p;
    }
    function sigma(D, arcT) {
      const qb = OK.QB, mv = Math.hypot(qb.vx, qb.vz);
      return D * (0.019 + (100 - QBR.acc) * 0.00078) * (1 + pressure() * 1.4) * (1 + Math.min(1, mv / 6) * 0.8) * [1.12, 1, 1.18][arcT] * (1 + WET * 0.14) + 0.15;
    }
    // swipe -> field vector: screen axes of the field at the QB's feet, solved for the swipe direction
    function aimSpot() {
      if (!aim) return null;
      // pull back to aim: the throw goes the opposite way from the drag, like a slingshot
      const dx = aim.ax - aim.px, dy = aim.ay - aim.py, len = Math.hypot(dx, dy);
      if (len < 14) return null;
      const qb = OK.QB, o = project(qb.x, 0, qb.z), ex = project(qb.x + 1, 0, qb.z), ez = project(qb.x, 0, qb.z + 1);
      if (!o || !ex || !ez) return null;
      const ax = ex[0] - o[0], ay = ex[1] - o[1], bx = ez[0] - o[0], by = ez[1] - o[1], det = ax * by - ay * bx;
      let ux, uz;
      if (Math.abs(det) < 1e-4) { ux = dx; uz = -dy; } else { ux = (dx * by - dy * bx) / det; uz = (ax * dy - ay * dx) / det; }
      const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const Lp = Math.max(120, Math.min(cssW, cssH) * 0.42), k = Math.min(1, len / Lp), D = Math.max(3, k * maxDist());
      return { x: clamp(qb.x + ux * D, -HW - 2, HW + 2), z: qb.z + uz * D, D, k, over: len > Lp * 1.02, ux, uz, back: uz < -0.3 };
    }
    function flightOf(D, arcT) { const v = bulletV() * [1, 0.8, 0.62][arcT]; return 0.12 + D / v + (arcT === 2 ? 0.25 : 0); }
    function nearestRec(x, z, maxd) { const [r, d] = nearest(off, x, z, (p) => isRec(p) && !p.rag && p !== OK.QB); return r && d < maxd ? r : null; }
    function gauss() { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * rng()); }
    const AIRDRAG = 0.045;
    // release = the user let go of the swipe; the QB winds up and the ball leaves his hand ~0.2 s later
    function throwBall(spot, arcT) {
      const qb = OK.QB;
      if (!ball || ball.holder !== qb || thrown || mode !== 'aim' || tPlay < 0.3 || qb.rag || qb.throwT >= 0) return false;
      if (qb.z > los + 0.2) return false;
      qb.throwT = 0; qb.throwSpot = spot; qb.throwArc = arcT; qb.hold = true;
      setPose(qb, 'throw'); qb.face2 = Math.atan2(spot.x - qb.x, spot.z - qb.z);
      qb.look = [spot.x, 1.5, spot.z];
      aim = null; hideAim();
      setControls(true);
      return true;
    }
    // where a receiver will be after t seconds: on his route if he is running one, else carried by his velocity
    function leadPt(r, t) {
      if (r.R && !(r.blk === 'chip' && tPlay < r.R.blk) && !(r.R.sit && Math.hypot(r.vx, r.vz) < 1.5)) { const q = posAt(r.R, tPlay + t); return { x: q.x, z: q.z }; }
      return { x: clamp(r.x + r.vx * t, -HW + 0.5, HW - 0.5), z: Math.min(109.5, r.z + r.vz * t) };
    }
    // the receiver a throw at `spot` is meant for, and his spot when the ball gets there
    function leadFor(spot, arcT, maxd) {
      const qb = OK.QB; let best = null, bd = maxd || 7, bl = null;
      for (const r of off) {
        if (!isRec(r) || r.rag || r === qb || r.blk === 'block' || (r.blk === 'chip' && tPlay < (r.R ? r.R.blk : 9))) continue;
        let T = flightOf(Math.hypot(spot.x - qb.x, spot.z - qb.z), arcT), lp = null;
        for (let i = 0; i < 3; i++) { lp = leadPt(r, T); T = flightOf(Math.hypot(lp.x - qb.x, lp.z - qb.z), arcT); }
        const d = Math.hypot(lp.x - spot.x, lp.z - spot.z);
        if (d < bd) { bd = d; best = r; bl = lp; }
      }
      return best ? { r: best, x: bl.x, z: bl.z, d: bd } : null;
    }
    // lead help: the throw's timing error along the receiver's path is pulled in (a lot at Rookie, a little at Legend);
    // the side-to-side placement (back shoulder, away from the defender) is mostly kept
    const LEAD_K = clamp(0.85 - DIFF * 0.6, 0.25, 0.85);
    function assistSpot(spot, arcT) {
      const L = leadFor(spot, arcT, 7); if (!L) return { spot, L: null };
      const r = L.r, sp = Math.hypot(r.vx, r.vz), ux = sp > 1 ? r.vx / sp : 0, uz = sp > 1 ? r.vz / sp : 1, cx = -uz, cz = ux;
      const ex = spot.x - L.x, ez = spot.z - L.z, al = ex * ux + ez * uz, ac = ex * cx + ez * cz, k = LEAD_K * clamp(1.4 - L.d / 7, 0, 1);
      const nal = al * (1 - k), nac = ac * (1 - k * 0.5);
      return { spot: { x: L.x + ux * nal + cx * nac, z: L.z + uz * nal + cz * nac }, L };
    }
    function releaseBall() {
      const qb = OK.QB, arcT = qb.throwArc, as0 = assistSpot(qb.throwSpot, arcT), spot = as0.spot;
      qb.throwT = -1;
      const D0 = Math.hypot(spot.x - qb.x, spot.z - qb.z), D = Math.min(D0, maxDist());
      const ux = (spot.x - qb.x) / (D0 || 1), uz = (spot.z - qb.z) / (D0 || 1);
      const sg = sigma(D, arcT), ex = gauss() * sg * 0.75, ez = gauss() * sg;
      const tx = qb.x + ux * D + ex, tz = qb.z + uz * D + ez;
      const D2 = Math.hypot(tx - qb.x, tz - qb.z), T = flightOf(D2, arcT);
      const hp = handPos(qb, 1), y0 = hp[1] > 1.2 ? hp[1] : 2.2, y1 = [1.5, 1.6, 2.0][arcT];
      // launch so the ball reaches (tx, y1, tz) after T with gravity and drag: solve the drag-free arc then nudge for drag
      const kd = 1 + AIRDRAG * T * 0.5;
      ball = { st: 'air', x: hp[0], y: y0, z: hp[2], vx: (tx - hp[0]) / T * kd, vz: (tz - hp[2]) / T * kd, vy: (y1 - y0 + 0.5 * GRAV * T * T) / T, t: 0, T, tx, tz, ty: y1, arc: arcT, D: D2, played: [], fromZ: qb.z, holder: null, kind: 'pass', spin: 0, wob: rng() * 6.28, wobA: 0.05 + sg * 0.03 };
      thrown = true; passer = qb; qb.armT = 0.35;
      updateCatchPoint();
      const L = as0.L && Math.hypot(as0.L.x - tx, as0.L.z - tz) < 9 ? as0.L : null;
      target = hunter(ball.cp, L ? L.r : nearestRec(tx, tz, 10));
      if (target) {
        // thrown behind him: the ball lands well back of where he is going
        const sp = Math.hypot(target.vx, target.vz), lp = L || leadPt(target, T), dx = tx - lp.x, dz = tz - lp.z, dl = Math.hypot(dx, dz) || 1;
        ball.behind = sp > 4 && dl > 1.8 && (dx * target.vx + dz * target.vz) / (sp * dl) < -0.5;
      }
      const st = stat(SQ.QB.pid); if (st) st.passAtt++;
      pr.kind = 'pass'; pr.passer = qb; pr.tgt = target; pr.thrown = true;
      const stare = aim && aim.dur > 0.8 && aim.tgt && aim.tgt === target ? Math.min(0.28, (aim.dur - 0.8) * 0.25) * (0.4 + DP.stare) : 0;
      for (const d of def) {
        const man = d.ass && d.ass.t === 'man' && d.ass.tgt === target;
        d.breakAt = tPlay + DP.react * (0.75 + rng() * 0.5) * (man ? 0.7 : 1) - stare;
        d.tried = 0; d.dvTry = 0;
      }
      huntGo();
      sfx.play('throw'); setControls(true);
    }
    // whoever can get to where it comes down soonest hunts it (nearly always the one it was meant for, who gets a small edge):
    // time to the spot at sprint speed, plus a beat to turn around if he is running away from it
    function hunter(cp, aimed) {
      let hb = null, ht = 9;
      if (cp) for (const r of off) {
        if (!isRec(r) || r.rag || r.eng || r.role === 'QB' || r === passer) continue;
        const d = Math.hypot(cp.x - r.x, cp.z - r.z), sp = Math.hypot(r.vx, r.vz), back = sp > 2 && ((cp.x - r.x) * r.vx + (cp.z - r.z) * r.vz) < 0 ? 0.25 : 0;
        const t = Math.max(0, d - 0.6) / (effV(r) * 1.08) + back - (r === aimed ? 0.35 : 0);
        if (d < 14 && t < ht) { ht = t; hb = r; }
      }
      return hb || aimed || null;
    }
    // the hunter goes the instant it is thrown and becomes the player's man; teammates near the spot pick it up a beat later
    function huntGo() {
      for (const p of off) { p.tried = 0; p.findT = p === target ? 0 : 0.2; }
      if (target) { ctrl = target; mode = 'catch'; target.face2 = null; } else { ctrl = null; mode = 'none'; }
    }
    function throwStep(dt) {
      const qb = OK.QB;
      if (!qb || qb.throwT < 0) return;
      qb.throwT += dt;
      if (qb.throwT >= 0.2) { if (ball && ball.holder === qb && !thrown) releaseBall(); else qb.throwT = -1; }
    }
    // where a receiver should meet the ball: the point where it comes down to hands height (chest to helmet);
    // once it is already below that, a little further along its path
    function updateCatchPoint() {
      const b = ball; if (!b || b.st !== 'air') return;
      const g = GRAV;
      let ch = 1.75;
      if (b.y <= ch && b.vy <= 0) ch = Math.max(0.55, b.y - 0.35);
      let t;
      const disc = b.vy * b.vy - 2 * g * (ch - b.y);
      if (disc < 0) t = Math.max(0, b.vy / g);
      else t = (b.vy + Math.sqrt(disc)) / g;
      t = Math.max(0, t);
      const dk = 1 - AIRDRAG * t * 0.5;
      b.cp = { x: b.x + b.vx * t * dk, z: b.z + b.vz * t * dk, t, y: Math.max(0.5, b.y + b.vy * t - 0.5 * g * t * t) };
      // last catchable moment (about waist high): what a diving receiver reaches for
      const lh = Math.min(0.8, b.y), d2 = b.vy * b.vy - 2 * g * (lh - b.y), t2 = d2 < 0 ? t : Math.max(t, (b.vy + Math.sqrt(d2)) / g), dk2 = 1 - AIRDRAG * t2 * 0.5;
      b.lp = { x: b.x + b.vx * t2 * dk2, z: b.z + b.vz * t2 * dk2, t: t2 };
    }
    // where the ball and this player (carried on by his run) come closest in the next ~0.8 s: [time, ball height, gap]
    function ballOver(p) {
      const b = ball; let bt = 0, by = b.y, bg = 99;
      for (let t = 0.05; t <= 0.8; t += 0.05) { const g = Math.hypot(b.x + b.vx * t - p.x - p.vx * t, b.z + b.vz * t - p.z - p.vz * t); if (g < bg) { bg = g; bt = t; by = b.y + b.vy * t - 0.5 * GRAV * t * t; } }
      return [bt, by, bg];
    }
    // can he get a hand on it on foot? Run him flat out toward where it comes down (he stops there) and find how close the ball passes
    // while it is at a height he can catch it: [time of closest approach, gap from his body]. A gap past his reach means lay out.
    function reachGap(p, lp, top) {
      const b = ball, dx = lp.x - p.x, dz = lp.z - p.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl, hi = 2.45 * p.lk.hs + 0.1;
      let bt = 9, bg = 99, ba = 99;
      for (let t = 0.03; t <= 0.7; t += 0.03) {
        const by = b.y + b.vy * t - 0.5 * GRAV * t * t; if (by < 0.2) break;
        const run = Math.min(top * Math.max(0, t - 0.04), dl), g = Math.hypot(b.x + b.vx * t - p.x - ux * run, b.z + b.vz * t - p.z - uz * run);
        if (g < ba) ba = g; // over his head counts here: that ball is one to go up for, not to lay out for
        if (by <= hi && g < bg) { bg = g; bt = t; }
      }
      return [bt, bg, ba];
    }
    // ---------- flight, contact and bounces ----------
    function flyStep(b, dt) {
      const dr = 1 - AIRDRAG * dt;
      b.vx *= dr; b.vz *= dr; b.vy = (b.vy - GRAV * dt) * (1 - AIRDRAG * 0.4 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.t = (b.t || 0) + dt;
      b.spin = (b.spin || 0) + dt * (b.tipped ? 9 : 14);
    }
    // a football bounce: energy loss, a random end-over-end kick and side hop
    function bounce(b) {
      const sp = Math.hypot(b.vx, b.vz);
      b.y = 0.14; b.vy = Math.abs(b.vy) * (0.35 + rng() * 0.3);
      const a = (rng() - 0.5) * 1.2, k = 0.55 + rng() * 0.3;
      const c = Math.cos(a), s = Math.sin(a);
      const nx = b.vx * c - b.vz * s, nz = b.vx * s + b.vz * c;
      b.vx = nx * k + (rng() - 0.5) * sp * 0.25; b.vz = nz * k + (rng() - 0.5) * sp * 0.25;
      if (b.vy < 0.9) { b.vy = 0; b.rolling = true; }
      b.bounces = (b.bounces || 0) + 1;
      if (b.bounces < 3) sfx.play('tap');
    }
    function groundStep(b, dt) { // dead or loose ball on the ground
      if (b.rolling) { b.vx *= Math.pow(0.08, dt); b.vz *= Math.pow(0.08, dt); b.x += b.vx * dt; b.z += b.vz * dt; b.spin += Math.hypot(b.vx, b.vz) * dt * 3; b.y = 0.14; return; }
      b.vy -= GRAV * 1.6 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spin += dt * 10;
      if (b.y <= 0.14 && b.vy < 0) bounce(b);
    }
    const inField = (x, z) => Math.abs(x) <= HW && z <= 110 && z >= -10;
    function airStep(dt) {
      const b = ball;
      // placement is judged as thrown: on the first step in the air, against everyone near where it comes down
      flyStep(b, dt); updateCatchPoint();
      if (!b.lev && b.cp && b.kind === 'pass') { b.lev = {}; for (const r of off) if (isRec(r) && Math.hypot(r.x - b.cp.x, r.z - b.cp.z) < 40) for (const d of def) if (Math.hypot(d.x - b.cp.x, d.z - b.cp.z) < 40) leverage(r, d); }
      if (target && !target.rag) target.reachT = b.T - b.t;
      // contact: swept along this step's travel so fast balls can't skip a hand. The first hand to the ball touches it; if a hand
      // from the other side gets there in the next instant too, it is a contested ball and placement decides it
      const px = b.x - b.vx * dt, py = b.y - b.vy * dt, pz = b.z - b.vz * dt;
      const LA = 0.12, fx = b.x + b.vx * LA, fy = b.y + b.vy * LA - 0.5 * GRAV * LA * LA, fz = b.z + b.vz * LA;
      let bO = null, dO = 9, bD = null, dD = 9;
      for (const p of everyone) {
        if (p.rag || p.stun > 0 || p.eng || tPlay - (p.lastTouch || -9) < 0.22 || p === passer || p.rising > 0) continue;
        if (Math.abs(p.x - b.x) > 2.6 || Math.abs(p.z - b.z) > 2.6 || b.y > 4.2) continue;
        if (p.side === 0 && !isRec(p)) continue;
        if (p.side === 1 && tPlay < (p.breakAt || 0) - 0.15) continue;
        const d = contactDist(p, px, py, pz);
        if (p.side === 0) { if (d < dO) { dO = d; bO = p; } } else if (d < dD) { dD = d; bD = p; }
      }
      const RO = bO ? catchRadius(bO) : 0, RD = bD ? catchRadius(bD) : 0;
      if (b.killed) { bO = bD = null; }
      else if (b.tips >= 2 && ((bO && dO <= RO) || (bD && dD <= RD))) {
        // tipped twice already: the next hand on it bats it down (a defender might still haul it in)
        const p = bD && dD <= RD ? bD : bO; p.lastTouch = tPlay;
        if (p.side === 1 && facesBall(p) && rng() < 0.12 + 0.5 * DP.intSkill) { intercept(p, 'tips'); return; }
        knockDown2('BATTED DOWN'); b.killed = true; return;
      }
      if ((bO && dO <= RO) || (bD && dD <= RD)) {
        const wO = bO ? Math.min(dO, contactDist(bO, b.x, b.y, b.z, fx, fy, fz)) : 9, wD = bD ? Math.min(dD, contactDist(bD, b.x, b.y, b.z, fx, fy, fz)) : 9;
        if (bO && bD && wO <= RO + 0.12 && wD <= RD + (dist(bD, bO) < 1.25 ? 0.58 : 0.42)) contestCatch(bO, bD, wO, wD); // a defender on his hip gets an arm in
        else if (bO && dO <= RO) recAttempt(bO);
        else defAttempt(bD);
        if (ball !== b || b.st !== 'air') return;
      } else {
        const best = bO && (!bD || dO - RO < dD - RD) ? bO : bD, bd = best === bO ? dO : dD, R = best === bO ? RO : RD;
        if (best && bd <= R + 0.32 && !b.fingers && b.t > 0.2) {
          // only a near miss once the ball is getting away from him
          const nd = contactDist(best, b.x, b.y, b.z, b.x + b.vx * dt, b.y + b.vy * dt, b.z + b.vz * dt);
          if (nd > bd + 0.02) { b.fingers = true; fingertips(best); if (ball !== b || b.st !== 'air') return; }
        }
      }
      if (b.y <= 0.14) { b.st = 'dead'; bounce(b); endPlay('inc', 0, b.tipped ? 'Batted down' : b.drop ? 'Dropped' : !inField(b.x, b.z) ? 'Out of bounds' : 'Nobody there'); return; }
      if (Math.abs(b.x) > HW + 3 || b.z > 113 || b.z < -12) { b.st = 'dead'; endPlay('inc', 0, b.z > 110 ? 'Out of the back of the end zone' : 'Thrown away'); }
    }
    const catchRadius = (p) => (p.side === 0 ? 0.36 + (p.cat - 50) * 0.0014 : 0.32) * (p.diveT > 0 ? 1.25 : 1);
    // where a hand is when the player reaches for the ball: shoulder (from the body, not the last drawn skeleton) plus the arm toward the reach point
    // how far the ball's path (from the previous position to now) passes from what this player can touch
    function contactDist(p, px, py, pz, qx, qy, qz) {
      const b = ball; if (qx == null) { qx = b.x; qy = b.y; qz = b.z; }
      const ex = qx - px, ey = qy - py, ez = qz - pz, l2 = ex * ex + ey * ey + ez * ez || 1e-6;
      const segD = (h) => { const t = clamp(((h[0] - px) * ex + (h[1] - py) * ey + (h[2] - pz) * ez) / l2, 0, 1); return Math.hypot(h[0] - px - ex * t, h[1] - py - ey * t, h[2] - pz - ez * t); };
      let bd = 9;
      for (const sd of [-1, 1]) { const d = p.reach ? Math.max(0, segD(shoulderPos(p, sd)) - 0.66 * p.lk.hs) : segD(handPos(p, sd)); if (d < bd) bd = d; }
      const dc = segD(chestPos(p)); if (dc < bd) bd = dc + 0.1;
      return bd;
    }
    function shoulderPos(p, sd) {
      const hs = p.lk.hs, rx = Math.cos(p.h), rz = -Math.sin(p.h), fx = Math.sin(p.h), fz = Math.cos(p.h), diving = p.diveT > 0 || p.pose === 'dive';
      return diving ? [p.x + fx * 0.45 + rx * sd * 0.25 * hs, 0.85 + (p.jumpY || 0) * 0.5, p.z + fz * 0.45 + rz * sd * 0.25 * hs] : [p.x + rx * sd * 0.3 * hs + fx * 0.05, (1.85 - 0.97 * (1 - (p.lk.ll || 1))) * hs + (p.jumpY || 0), p.z + rz * sd * 0.3 * hs + fz * 0.05];
    }
    function contestOf(r) {
      let best = null, bd = 9;
      for (const d of def) { if (d.rag || d.stun > 0 || d.eng) continue; const dd = Math.hypot(d.x - ball.x, d.z - ball.z); if (dd < bd) { bd = dd; best = d; } }
      return [best, clamp((1.35 - bd) / 1.35, 0, 1)];
    }
    // does the defender see the ball coming (it is not arriving over his back)?
    function facesBall(d) { const b = ball, hv = Math.hypot(b.vx, b.vz) || 1; return Math.sin(d.h) * -b.vx / hv + Math.cos(d.h) * -b.vz / hv > -0.35 || Math.hypot(d.vx, d.vz) < 1.5; }
    // highest point a player can get a hand to right now
    const topReach = (p) => (2.42 - 0.97 * (1 - (p.lk.ll || 1))) * p.lk.hs + (p.jumpY || 0) * 1.1;
    // defenders around the receiver when the ball gets there (a ball thrown into a crowd)
    function crowdAt(r) { let n = 0; for (const d of def) if (!d.rag && !d.eng && d.stun <= 0 && d.rising <= 0 && Math.hypot(d.x - r.x, d.z - r.z) < 2.3) n++; return n; }
    function fingertips(p) {
      const b = ball;
      popAt(p, p.side === 0 ? 'FINGERTIPS!' : 'JUST MISSED', '#ffc21a');
      if (rng() < 0.45) { tipBall(p, null, 0.5); }
    }
    // the ball reaches a receiver with no defender's hand on it (a defender arriving as it does can still jar it loose)
    function recAttempt(r) {
      const b = ball;
      r.lastTouch = tPlay; if (pr) pr.cpath = (pr.cpath ? pr.cpath + '>' : '') + 'rec';
      const [dN, cf] = contestOf(r);
      const diving = r.diveT > 0 || r.pose === 'dive', jumping = r.jumpY > 0.1;
      let p = 0.7 + r.cat / 330;
      if (b.arc === 0 && b.D < 12) p -= 0.06;
      if (b.arc === 2) p += 0.02;
      if (b.behind) p -= 0.1;
      if (diving) p -= 0.12;
      if (jumping && b.y < 2.1) p -= 0.08;
      if (b.tipped) p -= 0.08;
      p -= WET * 0.03;
      const hv = Math.hypot(b.vx, b.vz); if (hv > 20) p -= (hv - 20) * 0.012;
      p -= cf * (0.16 + 0.12 * KDEF) * (dN && dN.jumpY > 0.1 ? 1.3 : 1);
      const crowd = crowdAt(r); if (crowd >= 2) p *= Math.pow(0.5, crowd - 1);
      p = clamp(p, 0.05, 0.98);
      if (rng() < p) { catchBall(r, diving, jumping); return; }
      if (cf > 0.35 && dN) { if (rng() < 0.4) tipBall(r, 'JARRED LOOSE!'); else knockDown2('BROKEN UP!'); return; }
      if (rng() < 0.25) { tipBall(r, 'BOBBLED!'); return; }
      ball.drop = true; ball.vy = Math.min(ball.vy, -1.5) * 0.4; ball.vx *= 0.25; ball.vz *= 0.25;
      popAt(r, 'DROPPED', '#ff3344');
    }
    // ball placement against a defender: where the ball comes down relative to the pair as they will be when it gets there (each carried
    // on by his route / run). +1 = on the receiver's side of the pair (led away, back shoulder away from him), 0 = right on the receiver,
    // -1 = on the defender's side (under-thrown into a trailing man, led into the safety over the top, thrown inside at the man inside)
    function leverage(r, d) {
      const b = ball, c = b.cp; if (!c) return 0;
      const key = r.key + '|' + d.key; if (b.lev && b.lev[key] != null) return b.lev[key];
      const t = clamp(c.t || 0, 0, 2.5), R = leadPt(r, t), dx = d.x + d.vx * t, dz = d.z + d.vz * t;
      const ux = dx - R.x, uz = dz - R.z, L = Math.hypot(ux, uz);
      const m = L < 0.3 ? 0 : ((c.x - R.x) * ux + (c.z - R.z) * uz) / L;
      const v = clamp(-(m - 0.25) / 1.0, -1, 1);
      (b.lev || (b.lev = {}))[key] = v;
      return v;
    }
    // receiver and defender both get a hand to it. Placement decides: a ball on the receiver's side of the pair (led away from
    // the defender, back shoulder, high point he can win) is his; a ball on the defender's side or short of the receiver is the
    // defender's to break up or pick off. Hands, height, strength and the defender's skill shade it.
    function contestCatch(r, d, wO, wD) {
      const b = ball;
      r.lastTouch = tPlay; d.lastTouch = tPlay; if (pr) pr.cpath = (pr.cpath ? pr.cpath + '>' : '') + 'contest';
      const RO = catchRadius(r), RD = catchRadius(d);
      const diving = r.diveT > 0 || r.pose === 'dive', jumping = r.jumpY > 0.1;
      const qO = clamp(1 - wO / RO, 0, 1), qD = clamp(1 - wD / (RD + 0.42), 0, 1);
      const side = clamp((Math.hypot(b.x - d.x, b.z - d.z) - Math.hypot(b.x - r.x, b.z - r.z)) / 0.9, -1, 1);
      const hi = b.y > 2.15 ? clamp((topReach(r) - topReach(d)) * 0.8, -0.15, 0.15) + (jumping ? 0.03 : 0) : 0;
      const sees = facesBall(d);
      const skill = (r.cat - 62) / 150 + (r.str - 60) / 420 + ((r.mass || 1) - 1) * 0.12 - (0.04 + 0.17 * KDEF);
      const crowd = crowdAt(r);
      const plc = leverage(r, d);
      const W = clamp(0.4 + 0.27 * plc + 0.1 * side + 0.25 * (qO - qD) + hi + skill + (sees ? 0 : 0.08) - (b.behind ? 0.1 : 0) - (diving ? 0.08 : 0) - (b.tipped ? 0.06 : 0), 0.04, 0.95) * (crowd >= 2 ? Math.pow(0.45, crowd - 1) : 1);
      b.contest = { W: +W.toFixed(2), plc: +plc.toFixed(2), side: +side.toFixed(2), qO: +qO.toFixed(2), qD: +qD.toFixed(2), hi: +hi.toFixed(2), sees, crowd }; if (pr) pr.contest = b.contest;
      if (rng() < W) {
        const hv = Math.hypot(b.vx, b.vz);
        const pc = clamp(0.9 + (r.cat - 66) / 260 - (1 - W) * 0.3 - WET * 0.04 - (hv > 20 ? (hv - 20) * 0.012 : 0), 0.35, 0.97);
        if (rng() < pc) { catchBall(r, diving, jumping); return; }
        if (rng() < 0.45) tipBall(r, 'KNOCKED LOOSE!'); else knockDown2('BROKEN UP!');
        return;
      }
      // the defender wins it: a pick if the ball was on his side and he sees it, otherwise he breaks it up
      const pI = clamp(DP.intSkill * 1.25 * (plc < -0.3 ? 1.7 : plc < 0.3 ? 0.85 : 0.4) * (sees ? 1 : 0.4) * (crowd >= 2 ? 1.3 : 1) * (b.arc === 2 ? 1.2 : b.arc === 0 ? 0.8 : 1) * (1 - WET * 0.2) * (b.y > topReach(d) - 0.1 ? 0.4 : 1), 0, 0.7);
      if (rng() < pI) { intercept(d, 'contest'); return; }
      if (rng() < 0.38) tipBall(d, 'TIPPED!'); else knockDown2(d.jumpY > 0.15 ? 'SWATTED!' : 'BROKEN UP!');
    }
    // a defender gets to the ball and no receiver is there with him (undercut, jumped route, overthrow into the safety)
    function defAttempt(d) {
      const b = ball;
      d.lastTouch = tPlay; if (pr) pr.cpath = (pr.cpath ? pr.cpath + '>' : '') + 'def';
      const ok = b.y < topReach(d) - 0.05, sees = facesBall(d), looking = tPlay >= (d.breakAt || 0);
      let pI = DP.intSkill * 1.45 * (b.arc === 2 ? 1.25 : b.arc === 0 ? 0.75 : 1) * (ok ? 1 : 0.35) * (1 - WET * 0.15) * (sees ? 1 : 0.35);
      if (!target || dist(target, b) > 4) pI = pI * 1.6 + 0.1;
      if (!looking) pI *= 0.3;
      pI = Math.min(0.75, pI);
      if (rng() < pI) { intercept(d, 'undercut'); return; }
      if (rng() < DP.deflect * 1.6 * (looking ? 1 : 0.5) * (sees ? 1 : 0.6) + (d.jumpY > 0.2 ? 0.2 : 0)) { if (rng() < 0.4) tipBall(d, 'TIPPED!'); else knockDown2('SWATTED!'); return; }
    }
    function tipBall(p, msg, k) {
      const b = ball;
      if ((b.tips || 0) >= 2) { knockDown2(msg || 'BATTED DOWN'); b.killed = true; return; } // tipped twice already: this touch kills it
      b.tips = (b.tips || 0) + 1; if (pr) pr.tipsMax = Math.max(pr.tipsMax || 0, b.tips);
      b.tipped = true; b.lev = null; k = k || 1; // a tipped ball is anybody's: placement is judged again from where it now comes down
      b.vy = (3 + rng() * 2.5) * k; b.vx = (rng() - 0.5) * 3 * k + b.vx * 0.2; b.vz = (rng() - 0.2) * 3 * k + b.vz * 0.15;
      b.y = Math.max(b.y, 1.0); updateCatchPoint(); if (msg) popAt(p, msg, '#ffc21a'); sfx.play('catch');
      if (target) { ctrl = target; }
    }
    function knockDown2(msg) { // broken up / batted down: the ball is dead, nobody gets another hand on it
      const b = ball; b.tipped = true; b.killed = true; b.vy = -3; b.vx *= -0.25; b.vz *= -0.2;
      popAt(target || OK.QB, msg, '#ff3344');
    }
    // in bounds: a foot down inside the sidelines and the end lines (airborne: where he comes down)
    function landsIn(r) {
      if (r.jumpY > 0.05 || r.jumpT > 0 || r.diveT > 0) {
        const v = Math.max(0, r.jumpV || 0), tl = r.jumpY > 0.05 ? (v + Math.sqrt(v * v + 2 * 17 * r.jumpY)) / 17 : 0.12;
        return inField(r.x + r.vx * tl, r.z + r.vz * tl);
      }
      // feet from the drawn pose, placed at where he is now (the skeleton is posed once per rendered frame and can trail the simulation)
      if (r.bones) { const hm = r.bones[B.hips]; let low = 0; for (const f of [B.ftL, B.ftR]) { const m = r.bones[f]; if (m[7] < 0.35) { low++; if (inField(r.x + m[3] - hm[3], r.z + m[11] - hm[11])) return true; } } if (low) return false; }
      return inField(r.x, r.z);
    }
    function catchBall(r, diving, jumping) {
      const b = ball;
      if (!landsIn(r)) { ball.st = 'dead'; ball.vy = -1; popAt(r, 'NO FOOT DOWN', '#ff9a3c'); endPlay('inc', 0, r.z > 110 || r.z < -10 ? 'Out of bounds, past the end line' : 'Out of bounds'); return; }
      ball = { st: 'held', holder: r, x: r.x, y: 1.3, z: r.z, vx: 0, vy: 0, vz: 0 };
      carrier = r; ctrl = r; mode = 'run'; target = r; r.reach = null; r.pose = r.pose === 'reach' ? 'run' : r.pose;
      pr.rec = r; pr.catchZ = r.z; pr.caught = true; pr.tips = b.tips || 0;
      const notes = [];
      if (Math.abs(r.x) > HW - 1.25 || r.z > 108.8) notes.push('TOE TAP!');
      if (diving) notes.push('DIVING CATCH!'); else if (jumping) notes.push(b.y > 2.6 ? 'HIGH-POINTED!' : 'LEAPING GRAB!');
      const [, cf] = contestOf(r);
      if ((cf > 0.45 || b.contest) && !notes.length) notes.push('CONTESTED CATCH!');
      pr.notes = notes;
      popAt(r, notes[0] || 'CATCH!', '#2bd46b');
      sfx.play('catch'); excite = Math.min(1, excite + 0.25);
      for (const d of def) if (!d.rag && dist(d, r) < 3.2) { d.stun = Math.max(d.stun, 0.12 + 0.22 * (1 - KDEF)); d.stumbleT = Math.max(d.stumbleT, 0.2); }
      if (notes.length) cam.kick = Math.max(cam.kick, 0.5);
      const st = stat(SQ.QB.pid); if (st) st.passCmp++;
      if (r.z >= 100) { endPlay('td', r.z); return; }
      if (diving) { r.diveT = Math.max(r.diveT, 0.25); r.diveCatch = 1; setTimeout(() => { if (phase === 'live' && carrier === r) { knockDown(r, [r.vx * 0.6, -1, r.vz * 0.6], null, 1.2); endPlay('tackle', r.z, 'Diving catch'); } }, 220 / ((DBG && DBG.speed) || 1)); return; }
      setControls(true);
    }
    function intercept(d, how) {
      const tips = (ball && ball.tips) || 0;
      ball = { st: 'held', holder: d, x: d.x, y: 1.3, z: d.z, vx: 0, vy: 0, vz: 0 };
      carrier = d; ctrl = null; mode = 'none'; d.v = Math.max(d.v, 7.4); d.reach = null; setPose(d, 'run');
      pr.int = d; pr.intZ = d.z; pr.intInfo = { how: how || '', tips, role: d.role, man: !!(d.ass && d.ass.t === 'man'), dT: target ? +dist(target, ball).toFixed(1) : null, tgt: target ? target.key : null, t: +tPlay.toFixed(2), brk: +((d.breakAt || 0)).toFixed(2), D: ball.D ? Math.round(ball.D) : null, arc: ball.arc, y: +ball.y.toFixed(1) };
      const st = stat(SQ.QB.pid); if (st) st.passInt++;
      popAt(d, 'PICKED OFF!', '#ff3344'); sfx.play('boo'); excite = Math.max(0, excite - 0.3);
      setControls(true);
    }
    function doJump(p) {
      if (!p || p.jumpY > 0 || p.jumpT > 0 || p.jumpDelay > 0 || p.rag || p.diveT > 0 || p.rising > 0) return;
      p.jumpPow = 5.6 + (p.agi - 50) * 0.02; p.jumpDelay = 0.16; setPose(p, 'jump'); sfx.play('tap');
    }
    function doDive(p) {
      if (!p || p.diveT > 0 || p.rag || p.jumpY > 0 || p.rising > 0) return;
      // lay out to where the ball will be at its last catchable moment (about waist high), not where it passes chest height
      const aimP = ball && ball.st === 'air' ? (ball.lp && ball.lp.t > 0.05 ? ball.lp : ball.cp) : null;
      const toBall = aimP ? [aimP.x - p.x, aimP.z - p.z] : null, bd = toBall ? Math.hypot(toBall[0], toBall[1]) : 9;
      const ud = p === ctrl ? userDir() : null;
      const d = ud || (toBall && bd > 0.3 ? v2n(toBall) : [Math.sin(p.h), Math.cos(p.h)]);
      const sp = ud ? p.v + 3.5 : clamp(bd * 4.5, 3.5, p.v + 3.5);
      p.diveT = 0.62; p.ddx = d[0]; p.ddz = d[1]; p.vx = d[0] * sp; p.vz = d[1] * sp; setPose(p, 'dive'); p.h = Math.atan2(d[0], d[1]); p.jumpY = 0.35; p.jumpV = 1.6; p.jumpT = 0.4;
    }
    const v2n = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
    function receiverDiveStep(p, dt) {
      if (p.diveT > 0) { p.vx *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2; if (p.diveT - dt <= 0 && (!ball || ball.holder !== p)) { knockDown(p, [p.vx * 0.8, -1.2, p.vz * 0.8], null, 1.0); } }
    }

    // ---------- user input direction ----------
    function userDir() {
      if (input.stick && Math.hypot(input.stick[0], input.stick[1]) > 0.25) { const l = Math.hypot(input.stick[0], input.stick[1]); return [input.stick[0] / l, input.stick[1] / l]; }
      const ix = input.r - input.l; let iz = input.u - input.d;
      if (!ix && !iz) return null;
      if (!iz && !input.d && mode === 'run') iz = 0.6;
      const l = Math.hypot(ix, iz); return [ix / l, iz / l];
    }
    const AUTO = lerp(3.2, 0.9, DIFF);
    function autoDir(c) {
      const fx = flip ? -1 : 1;
      let ux = 0, uz = 1;
      if (c.side === 0 && c.key === (play.carrier || 'RB') && (play.type === 'run' || play.type === 'draw') && c.z < los + 1 && !kick) { const lx = (play.lane || 0) * fx; ux = (lx - c.x) * 0.5; uz = 1; }
      if (c.role === 'QB' && c.z < los + 1 && play.type === 'sneak' && play.lane && !kick) { const lx = play.lane * fx; ux = (lx - c.x) * 0.5; uz = 1; }
      else if (c.role === 'QB' && c.z < los && !qbRunPlay()) { ux = c.x >= 0 ? 0.8 : -0.8; uz = 0.6; }
      for (const d of def) {
        if (d.rag || d.eng) continue;
        const dx = c.x - d.x, dz = c.z - d.z, dd = Math.hypot(dx, dz);
        if (dd < 7 && dz < 1.5) { ux += dx / dd / dd * AUTO; uz += Math.max(0, dz) / dd / dd; }
      }
      if (Math.abs(c.x) > HW - 3) ux -= Math.sign(c.x) * 1.5;
      const l = Math.hypot(ux, uz) || 1;
      return [ux / l, uz / l];
    }
    function autoRun(c, dt) { const d = autoDir(c); staminaStep(c, dt, true); steerDir(c, d[0], d[1], effV(c), dt, c.acc); }

    // ---------- moves ----------
    const qbRunPlay = () => play.type === 'sneak' || play.type === 'qbdraw';
    function moveCd(c, m) { const a = (c.agi - 50) / 50, s = (c.str - 50) / 50; return { juke: 2.4 - a * 0.7 + DIFF * 0.5, spin: 2.8 - a * 0.6 + DIFF * 0.5, stiff: 2.1 - s * 0.5 + DIFF * 0.4, hurdle: 1.6 - a * 0.4 + DIFF * 0.3 }[m]; }
    function doMove(m) {
      const c = ctrl;
      if (!c || mode !== 'run' || c.rag || c !== carrier || c.diveT > 0 || c.rising > 0) return;
      if (m === 'dive') {
        if (c.role === 'QB' && c.z < los + 30 && !qbRunPlay() && c === OK.QB) { slide(c); return; }
        const d = userDir() || [Math.sin(c.h), Math.cos(c.h)];
        c.diveT = 0.45; c.ddx = d[0]; c.ddz = d[1]; c.vx = d[0] * (c.v + 2.5); c.vz = d[1] * (c.v + 2.5); setPose(c, 'dive'); c.mv = 'dive'; c.mvT = 0.45; c.jumpY = 0.25; c.jumpV = 1.2; c.jumpT = 0.3;
        sfx.play('tap'); return;
      }
      if (m === 'hurdle' && (c.jumpY > 0 || c.jumpT > 0 || c.wrapT > 0)) return;
      if (c.mvCd[m] > 0) return;
      c.mvCd[m] = moveCd(c, m); c.mv = m;
      if (m === 'hurdle') { // leap: clears a diving tackler, but a standing one can catch him in the air
        c.mvT = 0.62; c.hurdHit = 0;
        const sp = Math.hypot(c.vx, c.vz); if (sp < 3) { const d = userDir() || [Math.sin(c.h), Math.cos(c.h)]; c.vx = d[0] * 3.5; c.vz = d[1] * 3.5; }
        c.jumpY = 0.01; c.jumpV = 4.9 + (c.agi - 50) * 0.006; c.jumpT = 0.58; setPose(c, 'hurdle'); sfx.play('tap');
        return;
      }
      if (m === 'juke') {
        c.mvT = 0.36 + (c.agi - 50) * 0.002;
        let near = null, nd = 1e9;
        for (const d of def) { const dd = dist(d, c); if (dd < nd) { nd = dd; near = d; } }
        const dir = userDir() || [0, 1];
        let side = Math.abs(dir[0]) > 0.3 ? Math.sign(dir[0]) : near ? (near.x > c.x ? -1 : 1) : 1;
        if (Math.abs(c.x + side * 3) > HW - 1) side = -side;
        c.mvSide = side;
        const jx = side * 0.95, jz = 0.55, l = Math.hypot(jx, jz); c.jdx = jx / l; c.jdz = jz / l;
        setPose(c, 'juke');
        let fooled = 0;
        for (const d of def) if (dist(d, c) < 3.4 && d.stun <= 0 && !d.rag && rng() < 0.55 + (c.agi - d.agi) / 160 + (1 - KDEF) * 0.25) { d.stun = DP.stun * (0.8 + rng() * 0.4); d.stumbleT = 0.5; fooled++; }
        sfx.play(fooled ? 'good' : 'tap');
        if (fooled) popAt(c, fooled > 1 ? 'DOUBLE JUKE!' : 'JUKED HIM!', '#2bd46b');
      } else if (m === 'spin') { c.mvT = 0.5; setPose(c, 'spin'); sfx.play('tap'); }
      else if (m === 'stiff') { c.mvT = 0.6; setPose(c, 'stiff'); sfx.play('tap'); }
    }
    function slide(c) {
      setPose(c, 'slide'); c.down = true; c.fall = 1; c.fallT = 1; c.vx *= 0.4; c.vz = Math.max(0, c.vz * 0.4); c.getup = 1.2;
      popAt(c, 'SLIDE', '#c9ccd4');
      endPlay(c.z > los ? 'tackle' : 'sack', c.z + 0.8, 'Gives himself up', true);
    }
    function carrierStep(c, dt) {
      for (const k in c.mvCd) if (c.mvCd[k] > 0) c.mvCd[k] -= dt;
      if (c.mvT > 0) c.mvT -= dt; else c.mv = null;
      if (c === ctrl) staminaStep(c, dt, input.sprint);
      let spd = effV(c);
      if (c.diveT > 0) {
        c.diveT -= dt; c.vx *= 1 - dt * 1.4; c.vz *= 1 - dt * 1.4;
        if (c.diveT <= 0) { knockDown(c, [c.vx, -2, c.vz], null, 1.3); c.downAt = tPlay + 0.3; return; }
      } else if (c.mv === 'juke' && c.mvT > 0) { c.vx = c.jdx * (c.v + 4.2); c.vz = c.jdz * (c.v + 4.2); }
      else if (c === ctrl) {
        const d = userDir() || (c.side === 0 ? autoDir(c) : [0, -1]);
        if (c.mv === 'spin' && c.mvT > 0) spd *= 0.88;
        steerDir(c, d[0], d[1], spd, dt, c.acc * (c.mv === 'spin' ? 0.6 : c.jumpY > 0.05 ? 0.18 : 1)); // little steering in the air
        if (c.mv === 'hurdle' && c.jumpY <= 0 && c.mvT > 0 && c.mvT < 0.3 && !c.landed) { c.landed = 1; c.vx *= 0.9; c.vz *= 0.9; } else if (c.mv !== 'hurdle') c.landed = 0;
      }
      wrapStep(c, dt);
      if (c.downAt && tPlay >= c.downAt) { c.downAt = 0; resolveDown(c); }
    }
    function wrapStep(c, dt) {
      if (c.wrapT > 0) {
        c.wrapT -= dt;
        const d = c.wrapBy;
        if (d && !d.rag) { // the tackler hangs on and gets dragged
          const ox = c.x - d.x, oz = c.z - d.z, ol = Math.hypot(ox, oz) || 1, want = c.rad + d.rad + 0.05;
          d.x = c.x - ox / ol * want; d.z = c.z - oz / ol * want; d.vx = c.vx; d.vz = c.vz; d.face2 = Math.atan2(ox, oz); setPose(d, 'tackle', true);
        }
        if (c.wrapT <= 0) {
          const pB = clamp(0.06 + (c.str - DP.tackle) / 260, 0.02, 0.3);
          if (rng() < pB && d) { knockDown(d, [c.vx * 0.5, 0, c.vz * 0.5], [-(c.x - d.x) * 1.5, 0.6, -(c.z - d.z) * 1.5], 1.1); popAt(c, 'SHED THE TACKLE!', '#2bd46b'); c.wrapBy = null; c.stumbleT = 0.35; }
          else { finishTackle(c, d, 'wrap'); return; }
        }
      }
    }
    // ---------- contact: tackles as collisions with momentum ----------
    function hitCarrier(c, d) {
      if (phase !== 'live' || c.rag || !d || d.rag) return;
      if (c.mv === 'juke' && c.mvT > 0.12) return;
      const dx = c.x - d.x, dz = c.z - d.z, dl = Math.hypot(dx, dz) || 1, nx = dx / dl, nz = dz / dl;
      const airborne = c.mv === 'hurdle' && c.jumpY > 0.25;
      if (airborne) {
        const low = d.lunge > 0 || d.pose === 'tackle' || d.diveT > 0 || d.stumbleT > 0 || d.stun > 0 || d.rising > 0;
        if (low) {
          if (c.hurdHit) return;
          c.hurdHit = 1; d.tried = 1;
          const pH = clamp(0.62 + (c.agi - 50) / 160 - KDEF * 0.22, 0.3, 0.9);
          if (rng() < pH) { // clean: he goes right over the top of him
            knockDown(d, [d.vx * 0.5, 0, d.vz * 0.5], [0, 0.2, 0], 0.9); popAt(c, 'HURDLED HIM!', '#2bd46b'); sfx.play('good'); excite = Math.min(1, excite + 0.12); cam.shake = Math.max(cam.shake, 0.15); if (pr) pr.notes.push('hurdle');
            return;
          }
          popAt(c, 'TRIPPED UP!', '#ff9a3c'); sfx.play('tackle'); // caught a leg: he comes down hard
          finishTackle(c, d, 'hit', nx, nz, 3); return;
        }
      }
      const behindLOS = c.role === 'QB' && !crossed && !handed && !thrown;
      const vc = Math.hypot(c.vx, c.vz), closing = Math.max(0, (d.vx * nx + d.vz * nz) - (c.vx * nx + c.vz * nz));
      const fromFront = (c.vx * -nx + c.vz * -nz) > vc * 0.3, fromBehind = (c.vx * nx + c.vz * nz) > vc * 0.5;
      const power = (d.tackle / 70) * (0.6 + d.str / 150) * (1 + closing / 12) * (d.pose === 'tackle' ? 1.15 : 0.95) * Math.pow((d.mass || 1) / (c.mass || 1), 0.4); // weight matters
      let resist = (0.6 + c.str / 150) * (1 + vc / 16);
      if (c.mv === 'stiff' && c.mvT > 0 && fromFront) resist += 0.45 + (c.str - 50) / 250;
      if (c.mv === 'spin' && c.mvT > 0) resist += 0.35 + (c.agi - 50) / 300;
      if (behindLOS) resist -= 0.3;
      if (c.wrapT > 0) resist -= 0.5;
      if (airborne) resist -= 0.45; // caught in mid-air by a defender who stayed on his feet
      let gang = 0; for (const o of def) if (o !== d && dist(o, c) < 1.6 && !o.rag) gang++;
      let pB = clamp(0.05 + (resist - power) * 0.3 + (1 - KDEF) * 0.06 - gang * 0.12, 0.02, 0.5);
      if (DBG && DBG.forceBreak != null) pB = DBG.forceBreak;
      cam.shake = Math.max(cam.shake, 0.25 + Math.min(0.5, closing * 0.05));
      if (rng() < pB && c.wrapT <= 0) {
        // broken tackle: the defender bounces off
        const vel = [c.vx * 0.5 + nx * -2.5, 0.5, c.vz * 0.5 + nz * -2.5];
        knockDown(d, [d.vx * 0.3, 0, d.vz * 0.3], [-nx * (1.6 + vc * 0.25), 0.9, -nz * (1.6 + vc * 0.25)], 1.0);
        d.tried = 1;
        if (c.mv === 'stiff' && c.mvT > 0) popAt(c, 'STIFF ARM!', '#2bd46b');
        else popAt(c, c.mv === 'spin' && c.mvT > 0 ? 'SPIN MOVE!' : 'BROKE A TACKLE!', '#2bd46b');
        c.stumbleT = 0.42; c.vx *= 0.75; c.vz *= 0.75; c.vx += nx * 1.5; c.vz += nz * 1.5;
        sfx.play('tackle'); sfx.play('good'); excite = Math.min(1, excite + 0.12);
        return;
      }
      sfx.play('tackle');
      if (c.wrapT > 0 || behindLOS || gang > 0 || closing > 7 || fromBehind && vc < 3) { finishTackle(c, d, behindLOS ? 'sack' : 'hit', nx, nz, closing); return; }
      // wrap-up: the carrier drags him for a moment, then goes down (or sheds him)
      c.wrapT = 0.22 + Math.min(0.3, vc * 0.03) * (c.str / 70); c.wrapBy = d; d.vx = c.vx; d.vz = c.vz; setPose(d, 'tackle'); c.stumbleT = 0.5;
    }
    function finishTackle(c, d, kind, nx, nz, closing) {
      if (c.rag) return;
      if (nx == null) { const dx = c.x - (d ? d.x : c.x - 1), dz = c.z - (d ? d.z : c.z), l = Math.hypot(dx, dz) || 1; nx = dx / l; nz = dz / l; closing = 4; }
      const vc = Math.hypot(c.vx, c.vz);
      // momentum carries the pile: a sprinting back falls forward, a stood-up runner gets driven back
      const carry = clamp(vc * 0.55 - closing * 0.28, -2.5, 4.5);
      const fx = vc > 0.3 ? c.vx / vc : nx, fz = vc > 0.3 ? c.vz / vc : nz;
      const vel = [fx * carry + nx * closing * 0.35, 0.3, fz * carry + nz * closing * 0.35];
      knockDown(c, vel, [nx * closing * 0.12, 0.25 + closing * 0.03, nz * closing * 0.12], 1.0);
      if (d && !d.rag) { knockDown(d, [vel[0] * 0.75, 0.2, vel[2] * 0.75], [-nx * 0.3, 0.2, -nz * 0.3], 0.8); setPose(d, 'tackle'); }
      // others nearby pile on
      for (const o of def) if (o !== d && !o.rag && dist(o, c) < 1.5 && rng() < 0.7) knockDown(o, [vel[0] * 0.5, 0.3, vel[2] * 0.5], [(c.x - o.x) * 0.6, 0.35, (c.z - o.z) * 0.6], 0.9);
      cam.shake = Math.max(cam.shake, 0.3 + Math.min(0.5, (closing || 0) * 0.05));
      c.tackleKind = kind === 'sack' ? 'sack' : 'tackle'; c.contactZ = c.z;
      c.downAt = tPlay + 0.42; if (!carrier) carrier = c; aim = null; hideAim(); c.throwT = -1;
      mode = 'none'; ctrl = null; input.stick = null; hideStick();
      setControls(true);
    }
    function resolveDown(c) {
      if (phase !== 'live') return;
      const z = c.rag ? Math.max(c.rag.pts[0][2], (c.contactZ || c.z) - 1.8) : c.z;
      c.x = c.rag ? c.rag.pts[0][0] : c.x;
      if (c.side === 1) { endPlay('intdown', z); return; }
      if (c.tackleKind !== 'sack' && c.role !== 'QB' || c.tackleKind === 'sack') {
        const pF = 0.007 + (c.tackleKind === 'sack' ? 0.025 : 0) - (c.str - 50) / 9000 + KDEF * 0.006 + (pile.length > 2 ? 0.012 : 0);
        if (c.tackleKind !== 'dive' && rng() < pF) { fumble(c); return; }
      }
      endPlay(c.tackleKind === 'sack' ? 'sack' : 'tackle', z);
    }
    function fumble(c) {
      ball = { st: 'loose', x: c.x, y: 1.1, z: c.z, vx: (rng() - 0.5) * 6, vy: 3 + rng() * 2, vz: (rng() - 0.5) * 6, holder: null, t: 0, spin: 0 };
      carrier = null; ctrl = null; mode = 'none';
      popAt(c, 'FUMBLE!', '#ff3344'); sfx.play('bad'); pr.fumble = true; setControls(true);
    }
    function looseStep(dt) {
      const b = ball; b.t += dt;
      groundStep(b, dt);
      for (const p of everyone) { // both sides go for the loose ball
        if (p.rag || p.stun > 0 || p.rising > 0) continue;
        p.eng = null; p.face2 = null;
        if (p !== ctrl) steer(p, b.x, b.z, p.side ? effV(p) : p.v, dt, 10);
        p.look = [b.x, b.y, b.z];
      }
      if (b.t < 0.35) return;
      let best = null, bd = 0.8;
      for (const p of everyone) { if (p.rag || p.rising > 0) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd && b.y < 0.7) { bd = d; best = p; } }
      if (best) {
        knockDown(best, [best.vx * 0.4, -1, best.vz * 0.4], null, 1.2); ball.holder = best; ball.st = 'held';
        popAt(best, best.side === 0 ? 'RECOVERED!' : 'THEY RECOVER!', best.side === 0 ? '#2bd46b' : '#ff3344');
        endPlay(best.side === 0 ? 'tackle' : 'fumlost', best.z);
      } else if (Math.abs(b.x) > HW) endPlay('tackle', b.z, 'Fumble out of bounds');
    }
    function liveChecks() {
      const c = carrier;
      if (!c || c.rag) return;
      if (c.side === 0) {
        if (!crossed && c.z > los + 0.3) { crossed = true; if (c.role === 'QB' && mode === 'aim') { mode = 'run'; ctrl = c; carrier = c; pr.kind = 'rush'; pr.rusher = c; runSeen = tPlay; setControls(true); } }
        if (c.z >= 100) { endPlay(kick ? 'krtd' : 'td', c.z); return; }
        if (Math.abs(c.x) > HW) { endPlay('oob', c.z); return; }
      } else {
        if (c.z <= 0) { endPlay('pick6', c.z); return; }
        if (Math.abs(c.x) > HW) { endPlay('intdown', c.z); return; }
      }
    }

    // ---------- place kicks and punts with a two-tap meter (power, then accuracy) ----------
    const KK = KR.kick;
    const KQ = KR.pid ? Object.values(SQ).find((q) => q.pid === KR.pid && (!q.ol || q.real)) || null : null, KLOOK = normLook(null, 1);
    const fgRange = () => 36 + KK * 0.3 - WET * 3;
    const fgDist = () => Math.round(117 - los);
    function fgPct(d) { return clamp(1.08 - Math.max(0, d - 22) * (0.019 - (KK - 50) * 0.00012) - DIFF * 0.03 - WET * 0.06, 0.08, 0.98); }
    function startKick(type) {
      if (finished) return;
      clearBanner(); closeSheet(); hideTags();
      clearPlayers();
      const kz = type === 'punt' ? los - 13 : los - 7;
      for (let i = 0; i < 5; i++) addOff(olPlayer(i, (i - 2) * 1.95, los - 0.9, { v: 5.6 }));
      // the kicker: the Lineup player with the best leg when there is one (the RB holds if he is the QB)
      const kq = KQ || { key: 'K', look: KLOOK, num: 3 }, hq = KQ === SQ.QB ? SQ.RB : SQ.QB;
      const kp = addOff(mkP(0, 'K', 'K', type === 'punt' ? 0 : -1.0, type === 'punt' ? kz - 0.4 : kz - 1.4, { num: kq.num, lk: kq.look || KLOOK, sq: KQ, face: KQ ? KQ.cell : -1, v: 5, spd: 50, fx: KQ ? KQ.fx : null }));
      kp.h = type === 'punt' ? 0 : 0.35;
      if (type !== 'punt') { const h = addOff(mkP(0, 'QB', 'H', 0.3, kz - 0.1, { num: hq.num, lk: hq.look, sq: hq, face: hq.cell, spd: 50, fx: hq.fx })); h.h = 0.6; }
      for (let i = 0; i < 4; i++) addDef(mkP(1, 'DL', 'DL' + i, (i - 1.5) * 2.2, los + 0.9, { w: 1.2, rad: 0.5, v: DP.dlV, num: 90 + i }));
      for (let i = 0; i < 3; i++) addDef(mkP(1, 'LB', 'LB' + i, (i - 1) * 4, los + 3.5, { v: DP.lbV, num: 50 + i }));
      if (type === 'punt') addDef(mkP(1, 'S', 'PR', 0, Math.min(108, los + 40), { v: DP.sV, num: 23 }));
      finalizePlayers();
      for (const p of everyone) setPose(p, p.key === 'H' ? 'kneel' : p.role === 'OL' || p.role === 'DL' ? 'stance3' : p.key === 'K' ? 'idle' : 'stance2');
      kick = { type, st: 'power', p: 0, dir: 1, a: 0, adir: 1, t: 0, kz, kp, spdP: 1.05 + (100 - KK) * 0.011, spdA: 1.5 + (100 - KK) * 0.02 };
      ball = { st: 'spot', x: 0, y: 0.3, z: type === 'punt' ? kz + 0.5 : kz, holder: null, vx: 0, vy: 0, vz: 0, spin: 0 };
      phase = 'kick'; mode = 'none'; ctrl = null; carrier = null;
      showMeter(type); setControls(true);
      say(type === 'punt' ? `Punt formation · ${esc(KR.name)} to kick` : type === 'xp' ? 'Extra point try' : `${fgDist()}-yard field goal try · ${esc(KR.name)}`);
    }
    function kickTap() {
      if (!kick || phase !== 'kick') return;
      if (kick.st === 'power') { kick.pow = kick.p; kick.st = 'acc'; kick.a = -1; sfx.play('tap'); updMeter(); return; }
      if (kick.st === 'acc') { kick.acc = kick.a; launchKick(); }
    }
    function kickStep(dt) {
      const k = kick; k.t += dt;
      if (k.st === 'power') {
        k.p += k.dir * dt * k.spdP; if (k.p >= 1) { k.p = 1; k.dir = -1; } if (k.p <= 0) { k.p = 0; k.dir = 1; }
        if (k.t > 7) { k.pow = 0.75; k.st = 'acc'; k.a = -1; }
        updMeter();
      } else if (k.st === 'acc') {
        k.a += k.adir * dt * k.spdA; if (k.a >= 1) { k.a = 1; k.adir = -1; } if (k.a <= -1) { k.a = -1; k.adir = 1; }
        if (k.t > 10) { k.acc = k.a; launchKick(); }
        updMeter();
      } else if (k.st === 'run') { // the kicker steps into the ball; it leaves his foot at the swing
        k.runT += dt;
        const kp = k.kp;
        if (k.type === 'punt') { if (k.runT < 0.45) steer(kp, 0, k.kz + 0.3, 3.5, dt); else { kp.vx = kp.vz = 0; } if (k.runT >= 0.3 && kp.pose !== 'kick') setPose(kp, 'kick'); if (k.runT >= 0.3 + 0.36) { k.st = 'fly'; fireKick(); } }
        else { if (k.runT < 0.35) steer(kp, -0.3, k.kz + 0.1, 3.5, dt); else { kp.vx = kp.vz = 0; } if (k.runT >= 0.2 && kp.pose !== 'kick') setPose(kp, 'kick'); if (k.runT >= 0.2 + 0.36) { k.st = 'fly'; fireKick(); } }
      } else if (k.st === 'fly') {
        const b = ball;
        flyStep(b, dt);
        if (k.type !== 'punt' && !k.judged && b.z >= 110) { k.judged = 1; k.good = Math.abs(b.x) < 3.08 && b.y > 3.33; endKick(); }
        if (k.type !== 'punt' && !k.judged && (b.y <= 0.14 || b.vz <= 0)) { k.judged = 1; k.good = false; endKick(); }
        if (k.type === 'punt' && b.y <= 0.14 && b.vy < 0) { bounce(b); if (!k.judged) { k.judged = 1; endKick(); } }
      }
      if (k.st === 'fly' || k.st === 'acc' || k.st === 'run') for (const d of def) if (d.key !== 'PR') steer(d, d.x * 0.7, los - 2, d.v * 0.6, dt); else steer(d, ball.tx != null ? ball.tx : d.x, ball.tzz != null ? ball.tzz : d.z, d.v * 0.8, dt);
      for (const p of everyone) if (p !== k.kp || k.st === 'fly') integrate(p, dt);
      if (k.st === 'run') integrate(k.kp, dt);
      collide();
    }
    function launchKick() {
      const k = kick; k.st = 'run'; k.runT = 0; hideMeter();
      for (const p of off) if (p.role === 'OL') setPose(p, 'block');
      for (const d of def) if (d.role === 'DL') setPose(d, 'run');
      setControls(true);
    }
    function fireKick() {
      const k = kick, kp = k.kp;
      sfx.play('kick'); cam.shake = Math.max(cam.shake, 0.12);
      const wind = WET ? (rng() - 0.5) * 0.06 : 0;
      if (k.type === 'punt') {
        const R = (40 + KK * 0.3) * (0.5 + 0.55 * k.pow) - WET * 3, ang = k.acc * 0.3 + wind, th = 0.95, v = Math.sqrt(R * GRAV / Math.sin(2 * th)) * 1.04;
        ball = { st: 'kick', x: kp.x, y: 1.0, z: kp.z + 0.6, vx: Math.sin(ang) * v * Math.cos(th), vz: Math.cos(ang) * v * Math.cos(th), vy: v * Math.sin(th), t: 0, spin: 0, holder: null };
        ball.tx = Math.sin(ang) * R; ball.tzz = k.kz + Math.cos(ang) * R;
      } else {
        const R = (36 + KK * 0.3) * (0.42 + 0.62 * k.pow) - WET * 3, ang = k.acc * 0.15 + wind, th = 0.58, v = Math.sqrt(R * GRAV / Math.sin(2 * th)) * 1.04;
        ball = { st: 'kick', x: 0, y: 0.35, z: k.kz, vx: Math.sin(ang) * v * Math.cos(th), vz: Math.cos(ang) * v * Math.cos(th), vy: v * Math.sin(th), t: 0, spin: 0, holder: null };
        const h = OK.H; if (h) setPose(h, 'kneel');
      }
    }
    function endKick() {
      const k = kick, b = ball;
      if (k.type === 'punt') {
        let land = b.z, ret = 0, how;
        if (Math.abs(b.x) > HW) how = 'out of bounds';
        else if (land >= 100) { land = 80; how = 'touchback'; }
        else { const hang = b.t; ret = hang > 3.6 || rng() < 0.3 ? 0 : Math.round(rng() * 9 * (0.4 + KDEF * 0.6)); how = ret ? `returned ${ret} yards` : 'fair catch'; }
        const net = Math.round(Math.min(land, 100) - los - ret);
        const cpuStart = clamp(Math.round(100 - land + ret), 1, 99);
        say(`<b>${esc(KR.name)}</b> punts ${Math.round(Math.min(land, 100) - los)} yards, ${how}. Net ${net}.`);
        banner('PUNT', `${how === 'touchback' ? 'Touchback' : 'Net ' + net + ' yards'}`, '#c9ccd4');
        pend = { next: ['cpu', cpuStart] }; finishSpecial(2.6, 'punt');
        return;
      }
      const d = Math.round(110 - k.kz), st = stat(KR.pid);
      if (k.type === 'xp') {
        if (k.good) { addPts('home', 1); banner('EXTRA POINT GOOD', `${HOME.abbr} ${hs} – ${as} ${AWAY.abbr}`, '#2bd46b'); sfx.play('good'); say('The extra point is <b>good</b>.'); }
        else { banner('NO GOOD', 'Extra point missed', '#ff3344'); sfx.play('bad'); say('The extra point is <b>no good</b>.'); }
        pend = { next: ['cpu', 25, 'ko'] }; finishSpecial(2.4, 'xp');
        return;
      }
      if (st) { st.fgAtt++; if (k.good) st.fgMade++; }
      if (k.good) {
        addPts('home', 3); banner('IT\'S GOOD!', `${d}-yard field goal`, '#2bd46b'); sfx.play('good'); sfx.play('cheer'); excite = 0.8; confetti(0, 110); cam.kick = 0.6;
        say(`<b>${esc(KR.name)}</b> drills it from ${d} yards.`); addHL(`${shortName(KR.name)} ${d}-yd FG`);
        pend = { next: ['cpu', 25, 'ko'] };
      } else {
        banner('NO GOOD', `${d}-yard try ${Math.abs(b.x) >= 3.08 ? (b.x > 0 ? 'wide right' : 'wide left') : 'falls short'}`, '#ff3344'); sfx.play('bad'); sfx.play('boo');
        say(`The ${d}-yard try is <b>no good</b>.`);
        pend = { next: ['cpu', clamp(Math.round(100 - k.kz), 20, 99)] };
      }
      finishSpecial(2.8, 'fg');
    }
    function finishSpecial(t, kind) {
      phase = 'dead'; deadT = t; deadTot = t; clockRun = false; mode = 'none'; ctrl = null;
      boardDirty = true; setControls(true);
      kick.st = 'done';
    }

    // ---------- kickoffs: the CPU kicks, you return ----------
    function startKickoff() {
      clearBanner(); closeSheet();
      clearPlayers();
      tPlay = 0; ctrl = null; carrier = null; mode = 'none'; thrown = false; handed = true; runSeen = 0; crossed = true; target = null; passer = null;
      parts = parts.filter((q) => q.life > 0); replayBuf = []; recT = 0;
      let rk = 'RB'; for (const k of ['X', 'Z', 'S']) if (SQ[k].r.spd > SQ[rk].r.spd + 4) rk = k;
      const R = addOff(offPlayer(rk, 0, 3));
      const others = ['RB', 'X', 'Z', 'S', 'Y'].filter((k) => k !== rk);
      others.forEach((k, i) => addOff(offPlayer(k, [-12, -5, 5, 12][i], 22 + (i % 2) * 3)));
      for (let i = 0; i < 5; i++) addOff(olPlayer(i, (i - 2) * 6, 31, { v: 6 }));
      for (let i = 0; i < 10; i++) addDef(mkP(1, i < 4 ? 'LB' : 'S', 'KC' + i, -22 + i * 4.9 + (i >= 5 ? 0.6 : 0), 64, { v: Math.max(7.5, DP.sV) * (1.02 + 0.03 * (i % 3)), lane: -22 + i * 4.9, num: 40 + i, tackle: DP.tackle + 6, str: 55 + 40 * KDEF, agi: 50 + 40 * KDEF, spd: 60 + 30 * KDEF, ko: 1 }));
      addDef(mkP(1, 'K', 'KK', 0, 66, { v: 6, num: 6, tackle: 30, str: 40, spd: 40 }));
      finalizePlayers();
      for (const p of everyone) setPose(p, 'stance2');
      const lz = clamp(Math.round(-4 + rng() * 12 - DIFF * 3), -8, 9), lx = (rng() - 0.5) * 12;
      kick = { type: 'ko', st: 'wait', t: 0, lx, lz, R, tbOK: false };
      ball = { st: 'spot', x: 0, y: 0.3, z: 65, holder: null, vx: 0, vy: 0, vz: 0, spin: 0 };
      dcall = { name: 'Kickoff' };
      pr = { type: 'ko', start: 0, kind: 'ret', notes: [] };
      phase = 'live'; mode = 'none'; poss = 'home';
      setControls(true); hideTags();
      banner('KICKOFF', `${esc(AWAY.name)} kick to ${esc(HOME.name)}`, '#ffc21a');
      say(`<b>${esc(SQ[rk].name)}</b> deep to receive.`);
    }
    function kickoffStep(dt) {
      const k = kick, R = k.R;
      k.t += dt;
      if (k.st === 'wait') {
        for (const d of def) { steer(d, d.x, 64 + (k.t < 0.9 ? 0 : -3), d.v * 0.6, dt); if (k.t > 0.6) setPose(d, 'run', true); }
        const kk = DK.KK; if (k.t > 0.55 && kk.pose !== 'kick') setPose(kk, 'kick');
        if (k.t > 0.85) {
          const T = 3.2, x0 = 0, z0 = 65; k.st = 'air'; sfx.play('kick'); clearBanner();
          ball = { st: 'kick', x: x0, y: 0.4, z: z0, vx: (k.lx - x0) / T * 1.07, vz: (k.lz - z0) / T * 1.07, vy: (1.4 - 0.4 + 0.5 * GRAV * T * T) / T, t: 0, T, tx: k.lx, tz: k.lz, spin: 0, holder: null };
        }
      } else if (k.st === 'air') {
        const b = ball; flyStep(b, dt);
        const cpz = b.tz, cpx = b.tx, tl = Math.max(0.05, b.T - b.t), dd = Math.hypot(cpx - R.x, cpz - R.z);
        steer(R, cpx, cpz, Math.min(R.v, Math.max(dd / tl * 1.1, 2.5)), dt, 12); R.face2 = Math.PI; R.look = [b.x, b.y, b.z];
        if (tl < 0.6 && dd < 3) { R.reach = [b.x + b.vx * 0.1, b.y + b.vy * 0.1, b.z + b.vz * 0.1]; setPose(R, 'reach', true); } else R.reach = null;
        for (const d of def) steer(d, lerp(d.lane || 0, b.tx, 0.35), Math.max(b.tz + 6, d.z - 20), d.v, dt, 7);
        for (const p of off) if (p !== R) { steer(p, p.x * 0.8, Math.max(b.tz + 12, p.z - 6), p.v * 0.7, dt); p.face2 = Math.PI; }
        const hL = handPos(R, -1), hR = handPos(R, 1), near = Math.min(Math.hypot(hL[0] - b.x, hL[1] - b.y, hL[2] - b.z), Math.hypot(hR[0] - b.x, hR[1] - b.y, hR[2] - b.z)) < 0.5 || (Math.hypot(R.x - b.x, R.z - b.z) < 0.6 && b.y < 1.9);
        if (near && b.vy < 0 || b.y < 0.3) {
          if (b.z < -10 || b.y < 0.3 && b.z < 0) { touchback(); return; }
          ball = { st: 'held', holder: R, x: R.x, y: 1.3, z: R.z, vx: 0, vy: 0, vz: 0 }; carrier = R; ctrl = R; mode = 'run'; k.st = 'ret'; k.catchT = tPlay; R.reach = null; setPose(R, 'run');
          k.tbOK = R.z < 0; sfx.play('catch'); pr.start = R.z; pr.rusher = R; setControls(true);
        }
      } else if (k.st === 'ret') {
        if (k.tbOK && !carrier) k.tbOK = false; // fumbled: no touchback option any more
        if (k.tbOK && carrier && (carrier.z > 0.5 || tPlay - k.catchT > 2.6)) { if (carrier.z <= 0.5 && Math.hypot(carrier.vx, carrier.vz) < 1) { touchback(); return; } k.tbOK = false; setControls(true); }
      }
    }
    function touchback() {
      if (phase !== 'live') return;
      if (carrier) { carrier.vx = carrier.vz = 0; setPose(carrier, 'kneel'); }
      banner('TOUCHBACK', 'Ball at your 25', '#c9ccd4'); say('Touchback. Ball at the 25.');
      phase = 'dead'; deadT = 1.6; deadTot = 1.6; mode = 'none'; ctrl = null; carrier = null;
      pend = { next: ['home', 25, 'same'] }; clockRun = false; kick = null; setControls(true);
    }

    // ---------- scoring helpers ----------
    let poss = 'home', go4 = false, warnPend = false, sheetOpen = false;
    const PCL = Math.round(25 + (1 - DIFF) * 15);
    function addPts(side, n) {
      if (side === 'home') hs += n; else as += n;
      boardDirty = true;
      if (side === 'home') { excite = 1; sfx.play('horn'); sfx.play('cheer'); } else sfx.play('boo');
    }
    function addHL(s) { if (HL.length < 10) HL.push(s); }
    function celebrate(c) {
      c.celType = (crand() * 4) | 0; c.celAt = 0.55;
      if (c.celType === 1) setTimeout(() => { if (ball && ball.holder === c && (phase === 'dead' || phase === 'replay')) { ball = { st: 'dead', x: c.x + Math.sin(c.h) * 0.5, y: 1.6, z: c.z + Math.cos(c.h) * 0.5, vx: Math.sin(c.h) * 1.5, vy: -9, vz: Math.cos(c.h) * 1.5, spin: 0, holder: null }; sfx.play('tap'); } }, 950 / ((DBG && DBG.speed) || 1));
    }
    function nm(p) { return p && p.sq ? shortName(p.sq.name) : p && p.side === 1 ? AWAY.abbr + ' #' + p.num : 'he'; }

    // ---------- end of a play ----------
    function endPlay(kind, spot, extra, slid) {
      if (phase !== 'live' || finished) return;
      phase = 'dead'; deadT = pile.length ? 3.1 : 2.2; mode = 'none'; ctrl = null;
      input.stick = null; hideStick(); hideAim(); aim = null; input.sprint = false;
      sfx.play('whistle');
      const P = pr || {}, ko = kick && kick.type === 'ko';
      const nx = { los, down, fdz, next: null };
      let head = '', sub = '', col = '#ffc21a', line = '';
      closeP = null; clockRun = true;
      const endZ = kind === 'td' || kind === 'krtd' ? 100 : spot;
      const gained = Math.round(endZ - los);
      playRes = kind; if ((kind === 'run' || kind === 'tackle' || kind === 'oob' || kind === 'catch') && endZ >= fdz && !tryMode) playRes = 'first';
      if (ko) {
        kick = null; clockRun = false;
        const ret = Math.round(endZ - (P.start || 0));
        if (kind === 'fumlost') {
          const s = clamp(Math.round(100 - endZ), 1, 99); nx.next = ['cpu', s]; head = 'FUMBLE LOST'; sub = `${esc(AWAY.name)} recover`; col = '#ff3344'; TS.turnovers++;
          line = 'The return man coughs it up and the kicking team falls on it.';
        } else if (kind === 'krtd') {
          addPts('home', 6); head = 'TOUCHDOWN!'; sub = 'Kickoff return!'; col = '#2bd46b'; closeP = carrier; if (carrier) celebrate(carrier);
          confetti(carrier ? carrier.x : 0, 100); nx.next = ['pat']; line = `<b>${esc(nm(carrier))}</b> takes the kickoff all the way back!`;
          addHL(`${nm(carrier)} kickoff-return TD`); markBig('td');
          const st = stat(carrier && carrier.sq && carrier.sq.pid); if (st) st.long = Math.max(st.long, ret);
        } else {
          const s = endZ <= 0.5 ? 25 : clamp(Math.round(endZ), 1, 99);
          nx.next = ['home', s, 'same']; head = endZ <= 0.5 ? 'TOUCHBACK' : 'RETURN'; sub = endZ <= 0.5 ? 'Ball at your 25' : `${Math.max(0, ret)}-yard return to the ${ballTxt(s).toLowerCase()}`; col = '#c9ccd4';
          line = endZ <= 0.5 ? 'Downed in the end zone. Touchback.' : `<b>${esc(nm(carrier))}</b> brings it out to the ${ballTxt(s).toLowerCase()}.`;
          if (ret >= 30) { addHL(`${nm(carrier)} ${ret}-yd kick return`); markBig('big'); }
        }
      } else {
        TS.plays++;
        if (P.third && !tryMode) TS.thirdDownAtt++;
        const qbS = stat(SQ.QB.pid), rec = P.rec, recS = rec && stat(rec.sq && rec.sq.pid), rus = P.rusher, rusS = rus && stat(rus.sq && rus.sq.pid);
        const yd = (n) => (n === 1 ? '1 yard' : n + ' yards');
        if (kind === 'td') {
          if (tryMode) { addPts('home', 2); head = 'TWO-POINT TRY GOOD!'; col = '#2bd46b'; nx.next = ['cpu', 25, 'ko']; line = 'The two-point try is <b>good</b>!'; }
          else {
            addPts('home', 6); head = 'TOUCHDOWN!'; col = '#2bd46b'; nx.next = ['pat'];
            sub = `${HOME.abbr} ${hs} – ${as} ${AWAY.abbr}`;
            if (P.caught) line = `<b>${esc(nm(passer))}</b> to <b>${esc(nm(rec))}</b>, ${yd(gained)}, TOUCHDOWN!`;
            else line = `<b>${esc(nm(rus || carrier))}</b> punches it in from ${yd(gained)} out!`;
            addHL(P.caught ? `${nm(passer)} ${gained}-yd TD to ${nm(rec)}` : `${nm(rus || carrier)} ${gained}-yd TD run`);
            markBig('td');
          }
          closeP = carrier; if (carrier) celebrate(carrier);
          confetti(carrier ? carrier.x : 0, 100); clockRun = false; cam.kick = 1;
        } else if (kind === 'pick6') {
          addPts('away', 7); head = 'PICK SIX'; sub = `${esc(AWAY.name)} return it for a score`; col = '#ff3344'; nx.next = ['home', null, 'ko']; clockRun = false;
          line = `Intercepted and returned for a touchdown by <b>${esc(AWAY.abbr)} #${P.int ? P.int.num : ''}</b>.`; TS.turnovers++; markBig('int');
        } else if (kind === 'intdown') {
          const s = clamp(Math.round(100 - spot), 1, 99); nx.next = tryMode ? ['cpu', 25, 'ko'] : ['cpu', s]; clockRun = false;
          head = 'INTERCEPTED'; sub = `${esc(AWAY.name)} ball`; col = '#ff3344'; TS.turnovers++;
          line = `<b>${esc(nm(passer))}</b> is picked off${P.tgt ? ' going for ' + esc(nm(P.tgt)) : ''}.`; markBig('int');
        } else if (kind === 'fumlost') {
          const s = clamp(Math.round(100 - spot), 1, 99); nx.next = tryMode ? ['cpu', 25, 'ko'] : ['cpu', s]; clockRun = false;
          head = 'FUMBLE LOST'; sub = `${esc(AWAY.name)} recover`; col = '#ff3344'; TS.turnovers++; line = 'Ball comes loose and the defense falls on it.';
        } else if (kind === 'inc') {
          head = 'INCOMPLETE'; col = '#c9ccd4'; nx.down = down + 1; sub = extra || ''; clockRun = false; sfx.play('bad');
          line = `<b>${esc(nm(passer))}</b>'s pass ${P.tgt ? 'for <b>' + esc(nm(P.tgt)) + '</b> ' : ''}falls incomplete${extra ? ' (' + extra.toLowerCase() + ')' : ''}.`;
        } else {
          const ns = Math.round(spot * 2) / 2;
          if (ns <= 0 && !tryMode) {
            addPts('away', 2); head = 'SAFETY'; sub = `${esc(AWAY.name)} +2`; col = '#ff3344'; nx.next = ['cpu', 35]; clockRun = false;
            line = 'Tackled in the end zone. Safety.';
          } else {
            nx.los = clamp(ns, 1, 99.5);
            if (kind === 'sack') { head = 'SACKED!'; col = '#ff3344'; if (!slid) { TS.sacks++; if (qbS) qbS.sacked++; sfx.play('bad'); } else head = 'DOWN'; }
            else if (kind === 'oob') { head = 'OUT OF BOUNDS'; clockRun = false; }
            else head = 'TACKLED';
            sub = gained > 0 ? `+${yd(gained)}` : gained < 0 ? `${gained} yards` : 'No gain';
            if (kind === 'sack') line = slid ? `<b>${esc(nm(carrier))}</b> slides for ${yd(gained)}.` : `<b>${esc(nm(OK.QB))}</b> is sacked for a loss of ${Math.abs(gained)}.`;
            else if (P.caught) line = `<b>${esc(nm(passer))}</b> to <b>${esc(nm(rec))}</b> for ${yd(gained)}${P.notes && P.notes[0] ? ' · ' + P.notes[0].toLowerCase().replace('!', '') : ''}.`;
            else line = `<b>${esc(nm(rus || carrier))}</b> ${gained >= 8 ? 'breaks free' : 'runs'} for ${yd(gained)}.`;
            if (nx.los >= fdz && !tryMode) {
              const close = nx.los - fdz < 0.6;
              nx.down = 1; nx.fdz = Math.min(nx.los + 10, 100); head = 'FIRST DOWN!'; col = '#2bd46b'; sfx.play('good'); TS.firstDowns++;
              if (P.third) TS.thirdDownConv++;
              if (close) { sub = 'Measurement… by inches!'; line += ' Measured: first down.'; }
              if (carrier && kind !== 'sack') closeP = carrier;
            } else nx.down = down + 1;
            if (tryMode) { head = 'TWO-POINT TRY FAILS'; col = '#ff3344'; nx.next = ['cpu', 25, 'ko']; }
          }
        }
        if (!nx.next && nx.down > 4) { nx.next = ['cpu', clamp(Math.round(100 - nx.los), 1, 99)]; clockRun = false; head = 'TURNOVER ON DOWNS'; sub = `${esc(AWAY.name)} ball`; col = '#ff3344'; TS.turnovers++; }
        // stats
        if (!tryMode) {
          if (kind !== 'inc' && kind !== 'intdown' && kind !== 'pick6') TS.yards += gained;
          if (P.caught && rec) {
            if (qbS) { qbS.passYds += gained; if (kind === 'td') qbS.passTD++; }
            if (recS) { recS.rec++; recS.recYds += gained; recS.yac += Math.max(0, Math.round(endZ - (P.catchZ || los))); recS.long = Math.max(recS.long, gained); if (kind === 'td') recS.recTD++; }
            TS.passYds += gained;
            if (gained >= 25 && kind !== 'td') { addHL(`${nm(passer)} ${gained}-yd strike to ${nm(rec)}`); markBig('big'); }
            if (P.notes && P.notes.length && (P.notes[0] === 'TOE TAP!' || P.notes[0] === 'DIVING CATCH!' || P.notes[0] === 'HIGH-POINTED!')) { addHL(`${nm(rec)} ${P.notes[0].toLowerCase().replace('!', '')}`); markBig('big'); }
          } else if (P.kind === 'rush' && rus && kind !== 'sack') {
            if (rusS) { rusS.rushAtt++; rusS.rushYds += gained; rusS.long = Math.max(rusS.long, gained); if (kind === 'td') rusS.rushTD++; }
            TS.rushYds += gained;
            if (gained >= 20 && kind !== 'td') { addHL(`${nm(rus)} ${gained}-yd run`); markBig('big'); }
          }
        }
      }
      if (P.cov && line && !ko && kind !== 'td') line += ` <span style="color:#6f7584">vs ${esc(P.cov)}</span>`;
      // the clock: after an in-bounds play it runs 4 more seconds of the dead ball, then stops until the snap
      runoff = clockRun ? RUNOFF : 0;
      pend = nx; deadTot = deadT;
      if (closeP) { closeP.hold = true; deadT += 0.6; deadTot = deadT; }
      if (carrier && carrier.rag) { deadT += 0.3; deadTot = deadT; }
      if (lastBig && lastBig.kind === 'td') { deadT += 0.3; deadTot = deadT; }
      banner(head, sub, col);
      say(line);
      if (warnPend) { warnPend = false; twoMin(); }
      setControls(true);
    }
    function nextPlay() {
      const nx = pend; pend = null;
      if (nx && nx.los != null) { los = nx.los; down = nx.down; fdz = nx.fdz; }
      clearBanner(); closeP = null; go4 = false; carrier = null; kick = null; lastBig = null;
      const next = nx && nx.next;
      let cont;
      if (!next) cont = () => toPre(false);
      else if (next[0] === 'pat') cont = () => startPAT();
      else if (next[0] === 'cpu') cont = () => goCpu(next[1]);
      else cont = () => (next[2] === 'ko' ? goHome(null, true) : next[2] === 'same' ? startDrive(next[1]) : goHome(next[1]));
      if (clock <= 0 && (!next || next[0] !== 'pat')) endQuarter(cont); else cont();
    }
    function toPre(isNewDrive) {
      phase = 'pre'; poss = 'home'; setupPlay(); playClock = PCL;
      sheetOpen = !(down === 4 && !tryMode) || go4;
      if (!isNewDrive) clearBanner();
      setControls(true);
      if (sheetOpen) openSheet();
      if (isNewDrive) startIntro();
    }
    function startDrive(yd) {
      los = clamp(Math.round(yd), 1, 99); down = 1; fdz = Math.min(los + 10, 100); tryMode = false; go4 = false;
      driveStart = los; drivePlays = 0; clockRun = false; poss = 'home';
      toPre(true);
    }
    function startIntro() {
      intro = 2.0; introCut = true;
      banner('1st & 10', `${esc(nm(OK.QB))} and the ${esc(HOME.name)} offense · ${ballTxt(los)}`, '#ffc21a');
    }
    function introT0() { intro = 0; }
    function startPAT() {
      phase = 'pat'; poss = 'home'; tryMode = false; clockRun = false; los = 85; down = 1; fdz = 100;
      setupPlay(); setControls(true);
      say('Extra point or go for two?');
    }
    function chooseTry(two) {
      if (phase !== 'pat') return;
      if (two) { tryMode = true; los = 98; down = 1; fdz = 100; toPre(false); banner('TWO-POINT TRY', 'Get it in from the 2', '#ffc21a'); }
      else { los = 85; startKick('xp'); }
    }
    function choose4th(k) {
      if (phase !== 'pre' || down !== 4 || go4 || tryMode || finished) return;
      if (k === 'go') { go4 = true; sfx.play('tap'); sheetOpen = true; setControls(true); openSheet(); return; }
      if (k === 'fg' && 117 - los > fgRange() + 3) return;
      startKick(k === 'fg' ? 'fg' : 'punt');
    }
    // ---------- possession changes / overtime ----------
    function otCheck() {
      if (qtr < 5) return true;
      if (suddenDeath) { if (hs !== as) { gameOver(); return false; } return true; }
      otLeft--;
      if (otLeft < 0) {
        if (hs !== as) { gameOver(); return false; }
        if (opts.playoff) { suddenDeath = true; banner('SUDDEN DEATH', 'Next score wins', '#ffc21a'); return true; }
        gameOver(); return false;
      }
      return true;
    }
    function goCpu(start) { if (!otCheck()) return; startCpuDrive(start); }
    function goHome(start, ko) { if (!otCheck()) return; if (ko) startKickoff(); else startDrive(start); }

    // ---------- simulated CPU drives ----------
    const CS = clamp(0.55 + (AWAY.ovrOff - HOME.ovrDef) / 70 + (DIFF - 0.5) * 0.5, 0, 1);
    // per-play outcomes of a simulated drive (tuned so the CPU scores roughly 10-14 a game at Rookie up to 28-35 at Legend)
    // (strength curved and capped so each level sits in its range: about 1.8 / 2.5 / 3.9 / 4.8 points per full drive; the CPU gets 6-9
    // drives a game, more when the player's drives stall)
    const CSc = Math.pow(CS, 1.8) * 0.8;
    const CD = { g: lerp(6.0, 8.6, CSc), big: lerp(0.085, 0.19, CSc), loss: lerp(0.13, 0.055, CSc), to: lerp(0.034, 0.014, CSc), fg: lerp(0.8, 0.96, CSc), inc: lerp(0.17, 0.1, CSc), oob: 0.1, go4: lerp(1, 3, CSc) };
    function simCpu(spot, clk, log) {
      const start = spot; let dn = 1, fd = spot + 10, plays = 0, used = 0, yds = 0;
      const lead = as - hs, endHalf = clk.q === 2 || clk.q >= 4;
      const fin = (res) => ({ res, plays, yds: Math.max(0, Math.round(spot - start)), spot: Math.round(spot), used, t: Math.max(0, clk.t) });
      const tick = (t) => { t = Math.min(t, clk.t); used += t; clk.t -= t; };
      for (let guard = 0; guard < 60; guard++) {
        if (clk.t <= 0) return fin('CLOCK');
        const needTD = clk.q >= 4 && lead + 3 <= 0 && clk.t < QS * 0.6;
        if (spot >= 63 && ((endHalf && clk.t < 14 && !needTD) || (dn === 4 && !needTD) || (suddenDeath && dn >= 3))) {
          const d = 117 - spot; tick(5); plays++;
          return fin(rng() < clamp(CD.fg * (1.25 - (d - 20) * 0.012), 0.2, 0.97) ? 'FG' : 'MISS');
        }
        if (dn === 4 && !(fd - spot <= CD.go4 && spot >= 40) && !(clk.q >= 4 && lead < 0 && clk.t < QS * 1.2)) { tick(6); plays++; return fin('PUNT'); }
        const r = rng();
        let g, stop = false;
        if (r < CD.loss) g = -1 - Math.floor(rng() * 5);
        else if (r < CD.loss + CD.big) g = 15 + Math.floor(rng() * 35);
        else if (r < CD.loss + CD.big + CD.inc) { g = 0; stop = true; } // incomplete
        else g = Math.round(CD.g * (0.2 + 1.6 * rng()));
        if (!stop && g > 0 && rng() < CD.oob) stop = true; // out of bounds
        plays++;
        // same clock as the user: the play itself, then 4 more seconds after an in-bounds play before it stops for the next snap
        const c0 = clk.t; tick((3.5 + rng() * 2.5 + (stop ? 0 : RUNOFF)) * QS / 120);
        if (log) log.push({ g, stop, secs: +(c0 - clk.t).toFixed(2) });
        if (rng() < CD.to) { spot = clamp(spot + Math.max(0, g), 1, 99); return fin(rng() < 0.6 ? 'INT' : 'FUMBLE'); }
        spot = Math.max(1, spot + g);
        if (spot >= 100) { spot = 100; return fin('TD'); }
        if (spot >= fd) { dn = 1; fd = Math.min(spot + 10, 100); } else dn++;
        if (dn > 4) return fin('DOWNS');
      }
      return fin('PUNT');
    }
    const RES = { TD: ['TOUCHDOWN', '#ff3344'], FG: ['FIELD GOAL', '#ff3344'], MISS: ['MISSED FG', '#2bd46b'], PUNT: ['PUNT', '#c9ccd4'], INT: ['INTERCEPTED!', '#2bd46b'], FUMBLE: ['FUMBLE! YOUR BALL', '#2bd46b'], DOWNS: ['STOPPED ON DOWNS', '#2bd46b'], CLOCK: ['', '#c9ccd4'] };
    function startCpuDrive(start) {
      clearBanner(); closeSheet(); carrier = null; clockRun = false; ctrl = null; mode = 'none'; kick = null;
      phase = 'cpu'; poss = 'away'; los = clamp(100 - start, 1, 99); down = 1; fdz = Math.min(100, los + 10);
      setupPlay(); hideTags();
      const clk = { q: qtr, t: clock }, r = simCpu(start, clk);
      CPUS.drives++; CPUS.plays += r.plays; CPUS.yards += r.yds; CPUS.top += r.used;
      cpuD = { r, start, c0: clock, t: 0, dur: Math.min(5, 1.1 + r.plays * 0.32), shown: false, el: el('div', 'bz-dcard') };
      cpuD.el.style.setProperty('--oc', OPPCSS);
      fx.appendChild(cpuD.el); drawCard();
      setControls(true);
      say(`<b>${esc(AWAY.name)}</b> ball at their ${start}.`);
    }
    function drawCard() {
      const d = cpuD, k = Math.min(1, d.t / d.dur), r = d.r, n = Math.max(1, Math.round(r.plays * k)), y = Math.round(r.yds * k);
      const res = d.shown ? RES[r.res] : null;
      const label = r.res === 'CLOCK' ? (qtr === 2 ? 'END OF HALF' : qtr >= 4 ? 'TIME RUNS OUT' : 'END OF QUARTER') : res ? res[0] : '';
      d.el.innerHTML = `<h3>${esc(AWAY.name)} drive</h3><p>Plays <b>${n}</b> · Yards <b>${y}</b></p><p>Started at their ${d.start}</p>` +
        (d.shown ? `<p class="res" style="color:${res[1]}">${label}</p><p class="sc">${esc(HOME.abbr)} ${hs} – ${as} ${esc(AWAY.abbr)}</p>` : '<p class="res">…</p>');
    }
    function cpuStep(dt) {
      const d = cpuD; d.t += dt;
      clock = d.c0 + (d.r.t - d.c0) * Math.min(1, d.t / d.dur);
      if (!d.shown && d.t >= d.dur) {
        d.shown = true; clock = d.r.t;
        if (d.r.res === 'TD') { addPts('away', 7); } else if (d.r.res === 'FG') { addPts('away', 3); }
        else if (d.r.res !== 'CLOCK' && d.r.res !== 'PUNT') { sfx.play('good'); excite = 0.6; } else sfx.play('whistle');
        drawCard(); boardDirty = true;
        say(d.r.res === 'TD' ? `<b>${esc(AWAY.name)}</b> score a touchdown.` : d.r.res === 'FG' ? `<b>${esc(AWAY.name)}</b> kick a field goal.` : d.r.res === 'PUNT' ? `<b>${esc(AWAY.name)}</b> punt it away.` : d.r.res === 'CLOCK' ? 'Time runs out on the drive.' : 'Your defense comes up with the ball!');
      } else if (!d.shown && ((d.t * 8) | 0) !== ((d.t - dt) * 8 | 0)) drawCard();
      if (d.shown && d.t >= d.dur + 2.1) {
        d.el.remove(); cpuD = null;
        const r = d.r, sp = r.spot;
        let cont;
        if (r.res === 'TD' || r.res === 'FG') cont = () => goHome(null, true);
        else if (r.res === 'MISS') cont = () => goHome(clamp(107 - sp, 20, 80));
        else if (r.res === 'PUNT') cont = () => goHome(18 + Math.floor(rng() * 17));
        else if (r.res === 'CLOCK') cont = () => startCpuDrive(sp);
        else cont = () => goHome(clamp(100 - sp, 15, 70));
        if (clock <= 0 || r.res === 'CLOCK') endQuarter(cont); else cont();
      }
    }
    // ---------- quarters, halftime, overtime, two-minute warning ----------
    function brkTo(title, sub, then, t) {
      phase = 'break'; clockRun = false; clearBanner(); closeSheet(); brk = { t: t || 2.6, then };
      banner(title, sub, '#ffc21a'); setControls(true); sfx.play('whistle'); hideTags();
    }
    function endQuarter(cont) {
      clockRun = false; clock = 0; boardDirty = true;
      const sc = `${esc(HOME.abbr)} ${hs} – ${as} ${esc(AWAY.abbr)}`;
      if (qtr >= 4) {
        if (hs === as && (qtr === 4 || opts.playoff)) {
          brkTo(qtr === 4 ? 'END OF REGULATION' : `END OF OVERTIME`, `Tied ${hs}–${as} · ${qtr === 4 ? 'overtime!' : 'another period'}`, () => {
            const first = qtr === 4;
            qtr++; clock = QS; boardDirty = true;
            if (first) { otLeft = 2; suddenDeath = false; toLeft = Math.min(TOS, 2); const youFirst = rng() < 0.5; say(`Overtime coin toss: <b>${youFirst ? esc(HOME.name) : esc(AWAY.name)}</b> receive.`); if (youFirst) goHome(null, true); else goCpu(25); }
            else { suddenDeath = true; cont(); }
          }, 3);
        } else gameOver();
        return;
      }
      if (qtr === 2) {
        brkTo('HALFTIME', `${sc} · ${TOS} timeouts again`, () => { qtr = 3; clock = QS; toLeft = TOS; boardDirty = true; if (recv2 === 'home') goHome(null, true); else goCpu(25); }, 3.4);
        return;
      }
      brkTo(`END OF Q${qtr}`, sc, () => { qtr++; clock = QS; boardDirty = true; cont(); });
    }
    function clockTick(dt) {
      const before = clock; clock = Math.max(0, clock - dt);
      if (poss === 'home') TS.timeOfPoss += dt;
      const wi = qtr === 2 ? 0 : qtr === 4 ? 1 : -1;
      if (wi >= 0 && !warned[wi] && before > WARN && clock <= WARN && clock > 0) { warned[wi] = true; if (phase === 'live' || phase === 'kick') warnPend = true; else twoMin(); }
      if (((before * 2) | 0) !== ((clock * 2) | 0)) boardDirty = true;
    }
    function twoMin() { clockRun = false; banner('TWO-MINUTE WARNING', `${fmtClock(clock)} left in the ${qtr === 2 ? 'half' : 'game'} · clock stopped`, '#ffc21a'); sfx.play('whistle'); say('Two-minute warning. The clock stops.'); }
    function callTimeout() {
      if (!canTimeout() || finished) return;
      toLeft--; clockRun = false; sfx.play('whistle'); playClock = PCL;
      banner('TIMEOUT', `${toLeft} left this half · clock stopped`, '#ffc21a'); say(`<b>${esc(HOME.name)}</b> call timeout.`);
      setControls(true);
    }
    const canTimeout = () => (phase === 'pre' || phase === 'dead') && clockRun && toLeft > 0 && clock > 0 && poss === 'home';
    function delayOfGame() {
      sfx.play('whistle'); TS.penalties++;
      los = Math.max(1, los - 5); clockRun = false;
      toPre(false);
      banner('DELAY OF GAME', '5-yard penalty · replay the down', '#ff3344'); say('Flag: delay of game, offense. Five yards.');
    }
    function gameOver() {
      if (phase === 'over' || phase === 'box') return;
      phase = 'over'; clockRun = false; boardDirty = true; closeSheet(); hideTags();
      const won = hs > as, tie = hs === as;
      banner(won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'FINAL', `${esc(HOME.abbr)} ${hs} – ${as} ${esc(AWAY.abbr)}`, won ? '#2bd46b' : tie ? '#ffc21a' : '#ff3344');
      sfx.play(won ? 'win' : 'lose'); if (won) { sfx.play('cheer'); excite = 1; }
      setControls(true);
      say(won ? `Final: <b>${esc(HOME.name)}</b> win it!` : tie ? 'It ends in a tie.' : `Final: <b>${esc(AWAY.name)}</b> hold on.`);
      setTimeout(() => { if (!finished) showBox(); }, 2400 / ((DBG && DBG.speed) || 1));
    }
    function confetti(x, z) {
      const cols = [TEAM, TEAM2, [1, 1, 1, 1], hex('#2bd46b')];
      for (let i = 0; i < 90; i++) {
        const a = crand() * 6.283, v = 2 + crand() * 5;
        parts.push({ x, y: 2.5, z, vx: Math.cos(a) * v, vy: 5 + crand() * 7, vz: Math.sin(a) * v, life: 2 + crand() * 1.2, c: cols[i % 4], r: crand() * 6 });
      }
    }

    // ---------- simulation step ----------
    const POSES = ['stance2', 'stance3', 'qbstance', 'run', 'block', 'tackle', 'dive', 'kneel', 'slide', 'kick', 'throw', 'jump', 'juke', 'spin', 'stiff', 'celebrate', 'reach', 'idle', 'hold', 'stumble', 'getup', 'rush', 'pocket', 'sit', 'sigtd', 'siginc', 'sigfirst', 'hurdle'];
    function step(dt) {
      if (DBG && DBG.bot) { try { DBG.bot(api, dt); } catch (e) { console.error(e); DBG.bot = null; } }
      if (finished) return;
      excite = Math.max(0, excite - dt * 0.09);
      for (const q of parts) { if (q.life <= 0) continue; q.life -= dt; q.vy -= 12 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; } q.r += dt * 8; }
      for (const p of everyone) {
        if (p.stun > 0) p.stun -= dt;
        if (p.imm > 0) p.imm -= dt;
        if (p.armT > 0) p.armT -= dt;
        if (p.lunge > 0) { p.lunge -= dt; if (p.lunge <= 0 && p.pose === 'tackle' && !p.rag) setPose(p, 'run'); }
        if (p.rag) ragStep(p, dt);
        if (p.celAt > 0) { p.celAt -= dt; if (p.celAt <= 0) { if (p.rag) riseUp(p); p.rising = 0; setPose(p, 'celebrate'); p.vx = p.vz = 0; } }
      }
      if (phase === 'pre') {
        if (intro > 0) { intro -= dt; if (intro <= 0) clearBanner(); }
        if (clockRun && clock > 0) { runoffTick(dt); if (clock <= 0) { endQuarter(() => toPre(false)); return; } }
        playClock -= dt; if (playClock <= 0 && !tryMode) { delayOfGame(); return; }
        idle(dt); return;
      }
      if (phase === 'live') { liveStep(dt); return; }
      if (phase === 'dead') {
        if (clockRun && clock > 0) runoffTick(dt);
        for (const p of everyone) { if (p.rag) continue; if (p !== closeP && p.pose !== 'celebrate') { p.vx *= Math.pow(0.04, dt); p.vz *= Math.pow(0.04, dt); } integrate(p, dt); }
        collide();
        if (closeP && deadTot - deadT > 0.5 && closeP.celType == null) { const c = closeP; if (c.rag) riseUp(c); c.rising = 0; c.face2 = 0; setPose(c, 'celebrate', true); c.celType = 2; }
        if (ball && (ball.st === 'dead' || ball.st === 'loose' || ball.st === 'kick')) groundStep(ball, dt);
        deadT -= dt;
        if (deadT <= 0) { if (lastBig && (lastBig.kind === 'td' || lastBig.want) && !lastBig.played && replayBuf.length > 20) startReplay(); else nextPlay(); }
        return;
      }
      if (phase === 'replay') { replayStep(dt); return; }
      if (phase === 'kick') { if (kick.st === 'fly' && clock > 0) clockTick(dt); kickStep(dt); return; }
      if (phase === 'cpu') { cpuStep(dt); idle(dt); return; }
      if (phase === 'break') { brk.t -= dt; idle(dt); if (brk.t <= 0) { const f = brk.then; brk = null; clearBanner(); f(); } return; }
      if (phase === 'pat' || phase === 'over' || phase === 'splash' || phase === 'box') idle(dt);
    }
    // between plays the clock only runs out the rest of the 4-second run-off, then stops for the next snap
    function runoffTick(dt) { const d = Math.min(dt, Math.max(0, runoff)); if (d > 0) clockTick(d); runoff -= dt; if (runoff <= 0) { clockRun = false; boardDirty = true; } }
    function idle(dt) { for (const p of everyone) { if (p.rag) continue; p.vx *= 0.8; p.vz *= 0.8; integrate(p, dt); } }
    function liveStep(dt) {
      tPlay += dt;
      if (clock > 0) clockTick(dt);
      if (kick && kick.type === 'ko') {
        kickoffStep(dt);
        if (phase !== 'live') return;
        if (kick.st !== 'ret') { for (const p of everyone) integrate(p, dt); collide(); recordFrame(dt); return; }
      }
      if (ball.st === 'snap' || ball.st === 'pitch' || (play.toss && ball.st === 'held')) snapStep(dt);
      throwStep(dt);
      if (ball.st === 'air') { airStep(dt); if (phase !== 'live') return; }
      const loose = ball.st === 'loose';
      if (loose) { looseStep(dt); if (phase !== 'live') return; } // everyone chases the ball; the regular AI stays out of it
      const qbMan = !loose && mode === 'aim' && !!userDir();
      if (!loose) { offenseAI(dt); defenseAI(dt); }
      if (qbMan) { const d = userDir(), q = OK.QB; staminaStep(q, dt, input.sprint); steerDir(q, d[0], d[1], effV(q) * 0.8, dt, 10); }
      else if (!loose && mode === 'aim' && OK.QB && ctrl !== OK.QB) staminaStep(OK.QB, dt, false);
      if (carrier && carrier === ctrl && mode === 'run') carrierStep(carrier, dt);
      else if (carrier) { if (carrier.wrapT > 0) wrapStep(carrier, dt); if (carrier.downAt && tPlay >= carrier.downAt) { carrier.downAt = 0; resolveDown(carrier); } if (phase !== 'live') return; }
      for (const p of everyone) if (p.diveT > 0 && p !== carrier && !p.rag) receiverDiveStep(p, dt); // receivers and defenders laying out for a pass
      for (const p of everyone) integrate(p, dt);
      collide();
      const h = ball.holder;
      if (h && h.side === 0 && !h.rag && h.wrapT <= 0) {
        for (const d of def) { if (d.rag || d.stun > 0 || d.eng || d.rising > 0) continue; const dd = dist(d, h); if (dd < h.rad + d.rad + 0.12 && tPlay - (d.lastTry || -9) > 0.6) { d.lastTry = tPlay; hitCarrier(h, d); if (phase !== 'live' || h.rag) break; } }
      }
      if (phase !== 'live') return;
      if (play.type === 'qbdraw' && mode === 'aim' && tPlay > 0.85 && ball && ball.holder === OK.QB && !thrown && !aim) scramble(); // the draw: show pass, then go
      if (mode === 'aim' && OK.QB.z > los + 0.3) { carrier = OK.QB; ctrl = OK.QB; mode = 'run'; crossed = true; pr.kind = 'rush'; pr.rusher = OK.QB; runSeen = tPlay; aim = null; hideAim(); setControls(true); }
      if (mode === 'aim' || (ball.holder === OK.QB && !handed)) { const q = OK.QB; if (Math.abs(q.x) > HW && phase === 'live') { endPlay('oob', q.z); return; } }
      liveChecks();
      if (phase === 'live' && tPlay > 14 && mode === 'none' && !carrier && ball.st !== 'air' && ball.st !== 'loose') endPlay('inc', 0, 'Play blown dead');
      recordFrame(dt);
    }

    // ---------- instant replay: record the play, then play it back from a cinematic angle ----------
    const RF = 10 + 33;
    function recordFrame(dt) {
      recT += dt;
      if (recT < 1 / 30) return;
      recT = 0;
      if (replayBuf.length > 700) replayBuf.shift();
      const n = everyone.length, f = new Float32Array(n * RF + 6);
      for (let i = 0; i < n; i++) {
        const p = everyone[i], o = i * RF;
        f[o] = p.x; f[o + 1] = p.jumpY; f[o + 2] = p.z; f[o + 3] = p.h; f[o + 4] = POSES.indexOf(p.pose); f[o + 5] = p.poseT; f[o + 6] = p.vx; f[o + 7] = p.vz; f[o + 8] = p.rag ? 1 : (p.rising > 0 ? 2 + p.rising : 0); f[o + 9] = (p.reach ? 1 : 0) + (p.sprint ? 2 : 0) + ((p.celType || 0) << 2);
        if (p.rag) for (let k = 0; k < 11; k++) { f[o + 10 + k * 3] = p.rag.pts[k][0]; f[o + 11 + k * 3] = p.rag.pts[k][1]; f[o + 12 + k * 3] = p.rag.pts[k][2]; }
      }
      const b = ball || {}, hp = b.holder;
      f[n * RF] = hp ? hp.x : b.x || 0; f[n * RF + 1] = hp ? 1.3 : b.y || 0; f[n * RF + 2] = hp ? hp.z : b.z || 0; f[n * RF + 3] = hp ? everyone.indexOf(hp) : -1; f[n * RF + 4] = b.st === 'air' || b.st === 'kick' ? 1 : 0; f[n * RF + 5] = b.spin || 0;
      replayBuf.push(f);
    }
    function markBig(kind) { if (!lastBig || kind === 'td') lastBig = { kind, played: false, want: false }; }
    function startReplay() {
      lastBig.played = true;
      const n = replayBuf.length;
      replay = { i0: Math.max(0, n - 300), n, t: 0, sp: 0.5, orbit: crand() * 6, bones: everyone.map((p) => p.bones) };
      phase = 'replay'; clearBanner(); hideTags(); setControls(true);
      banner('REPLAY', '', '#ffc21a'); setTimeout(() => { if (phase === 'replay') clearBanner(); }, 900);
    }
    function replayStep(dt) {
      const r = replay; r.t += dt * r.sp;
      const fi = r.i0 + Math.floor(r.t * 30);
      if (fi >= r.n - 1) { endReplay(); return; }
      applyFrame(replayBuf[fi], replayBuf[Math.min(r.n - 1, fi + 1)], (r.t * 30) % 1);
    }
    function applyFrame(f, g, u) {
      const n = everyone.length;
      if (!f || f.length !== n * RF + 6) return;
      for (let i = 0; i < n; i++) {
        const p = everyone[i], o = i * RF, L = (k) => (g && g.length === f.length ? f[o + k] + (g[o + k] - f[o + k]) * u : f[o + k]);
        p.x = L(0); p.jumpY = L(1); p.z = L(2); p.h = f[o + 3] + angDiff(g ? g[o + 3] : f[o + 3], f[o + 3]) * u;
        p.pose = POSES[f[o + 4]] || 'run'; p.poseT = f[o + 5]; p.vx = f[o + 6]; p.vz = f[o + 7];
        const st = f[o + 8]; p.rising = st >= 2 ? st - 2 : 0; p.reach = null; p.sprint = !!(f[o + 9] & 2); p.celType = (f[o + 9] | 0) >> 2;
        if (st === 1) {
          if (!p.rag) { ensureBones(p); p.rag = new Rag(p, p.bones, [0, 0, 0], 1 / 60); }
          for (let k = 0; k < 11; k++) { const q = p.rag.pts[k]; q[0] = f[o + 10 + k * 3]; q[1] = f[o + 11 + k * 3]; q[2] = f[o + 12 + k * 3]; if (g) { q[0] += (g[o + 10 + k * 3] - q[0]) * u; q[1] += (g[o + 11 + k * 3] - q[1]) * u; q[2] += (g[o + 12 + k * 3] - q[2]) * u; } }
          p.rag.h = p.h;
        } else if (p.rag) p.rag = null;
      }
      const hi = f[n * RF + 3];
      ball = hi >= 0 ? { st: 'held', holder: everyone[hi], x: f[n * RF], y: f[n * RF + 1], z: f[n * RF + 2], spin: f[n * RF + 5] } : { st: f[n * RF + 4] ? 'air' : 'dead', x: f[n * RF], y: f[n * RF + 1], z: f[n * RF + 2], vx: 0, vy: 0, vz: 0, replay: true, spin: f[n * RF + 5] };
    }
    function endReplay() {
      if (phase !== 'replay') return;
      replay = null;
      nextPlay();
    }

    // ---------- camera & projection ----------
    const VP = new Float32Array(16), PREV_VP = new Float32Array(16); let INV = new Float32Array(16), PROJ = new Float32Array(16), VIEW = new Float32Array(16), INVP = new Float32Array(16);
    const CASC = [new Float32Array(16), new Float32Array(16), new Float32Array(16)];
    let wave = 0, camF = [0, 0, 1], expo = SKY.exp, camSpeed = 0, replayCam = 0;
    const HFOV = 64; // horizontal field of view (degrees) at 16:9 -> about a 32 mm lens; the old framing was authored for 86, so offsets stretch by LENSK
    const LENSK = Math.tan((86 * Math.PI) / 360) / Math.tan((HFOV * Math.PI) / 360);
    const op = { t: 0, x: 0, y: 0 }; // operator imperfection
    function updateCam(dt) {
      let e, c, rate = 3.2, cdk = LENSK;
      const qb = OK.QB || { x: 0, z: los - 5, lk: { hs: 1 } };
      // follow a ball carrier: low and close; closer still in the open field
      const fl = (p, back) => {
        const dir = p.side === 1 ? -1 : 1, vx = p.vx || 0, vz = p.vz || 0;
        let near = 99; for (const d of (p.side ? off : def)) { if (d.rag) continue; const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < near) near = dd; }
        const open = clamp((near - 4) / 5, 0, 1), bk = (back || 9.0) - 1.5 * open + 1.0 * por, hgt = 5.9 - 0.8 * open + 2.2 * por + 1.2 * lnd;
        return [[p.x * 0.85 + vx * 0.1, hgt, p.z - dir * bk + vz * 0.05], [p.x * 0.95 + vx * 0.2, 0.9, p.z + dir * (6 - 2 * por) + vz * 0.12]];
      };
      replayCam = 0;
      if (phase === 'replay' && replay && ball) {
        const a = replay.orbit + replay.t * 0.35, bx = ball.x || 0, bz = ball.z || los;
        e = [bx + Math.sin(a) * (5.5 + 3 * por), 1.6 + 2.0 * por, bz + Math.cos(a) * (5.5 + 3 * por) - 1.5]; c = [bx, 1.0, bz]; rate = 5; cdk = LENSK * 0.8; replayCam = 1;
      } else if (phase === 'splash' || phase === 'cpu' || phase === 'break' || phase === 'over' || phase === 'box') {
        const t = performance.now() / 1000 * 0.07, z0 = phase === 'splash' ? los : 50;
        e = [Math.sin(t) * 26, 14 + 8 * por, z0 - 4 - Math.cos(t) * 30]; c = [0, 0.5, z0 + 4];
      } else if (closeP && phase === 'dead' && deadTot - deadT > 0.35) {
        const q = closeP, hh = 2.0 * q.lk.hs + (q.rag ? -0.9 : 0);
        e = [q.x + 0.6, hh + 0.55, q.z + 3.7 + por * 1.5]; c = [q.x, hh - 0.25, q.z]; rate = 4; replayCam = 0.7;
      } else if (phase === 'pre' && intro > 0 && OK.QB) {
        const hh = 2.0 * qb.lk.hs;
        e = [0.45, hh + 0.3, qb.z + 2.75 + por]; c = [0, hh - 0.05, qb.z]; replayCam = 0.8;
        if (introCut) { introCut = false; dt = -1; }
      } else if (phase === 'kick' && kick) {
        if (kick.st === 'fly' && ball) { e = [ball.x * 0.5 - 9 - 3 * por, Math.max(4, ball.y * 0.6 + 3 + 3 * por), ball.z - 9 - 3 * por]; c = [ball.x * 0.7, ball.y * 0.6 + 1, ball.z + 12]; rate = 5; }
        else { e = [-9 - 4 * lnd, 5.5 + 5 * por, kick.kz - 9 - 4 * por]; c = [0, 3, kick.kz + (kick.type === 'punt' ? 24 : 20)]; }
      } else if (phase === 'pat') {
        e = [0, 13 + 10 * por, 74 - 4 * por]; c = [0, 0, 100];
      } else if (kick && kick.type === 'ko' && (kick.st === 'wait' || kick.st === 'air')) {
        const R = kick.R, bz = ball ? ball.z : 65;
        e = [R.x * 0.5 + 4.5, 11 + 8 * por, R.z - 9 - 3 * por]; c = [(ball ? ball.x : 0) * 0.5, 3, Math.max(R.z + 14, Math.min(bz, R.z + 45))];
      } else if ((phase === 'live' || phase === 'dead') && carrier && (mode === 'run' || carrier.side === 1 || phase === 'dead')) {
        [e, c] = fl(carrier); rate = phase === 'live' ? 5 : 3;
        if (phase === 'dead') { e[1] += 1; }
      } else if (phase === 'live' && ball && ball.st === 'air' && !kick) {
        const b = ball, k = Math.min(1, b.t / b.T), ez = lerp(b.fromZ || los - 6, b.tz, 0.5 * k);
        if (target) {
          const cx = lerp(target.x, b.tx, 0.55 + 0.3 * k), cz = lerp(target.z, b.tz, 0.55 + 0.3 * k) + 1.2;
          c = [cx, 0.9, cz]; e = [cx * 0.85, 6.4 + 5 * por + 1.5 * lnd, cz - 10.5 - 3 * por]; rate = 4;
        } else {
          e = [b.tx * 0.45 * k, 7.5 + Math.min(8, (b.D || 10) * 0.14) + 8 * por, Math.min(ez - 9 - 3 * por, b.tz - 11 - 3 * por)]; c = [lerp(b.x, b.tx, 0.6), 0.6, lerp(b.z, b.tz, 0.75)]; rate = 3.6;
        }
      } else {
        const bootX = play.type === 'boot' && phase === 'live' ? qb.x * 0.5 : 0;
        if (phase === 'live') {
          const look = Math.min(tPlay, 3) * 1.1, qx = mode === 'aim' ? qb.x * 0.6 : 0, qz = Math.min(qb.z, los - 4);
          e = [bootX + qx, 8.0 + 1.0 * por + 1.2 * lnd, qz - 7.3 - 0.6 * por - 1 * lnd]; c = [bootX + qx, 0.6, qz + 6.8 + look + 1.2 * por];
        } else {
          e = [bootX, 11.5 + 5 * por + 2 * lnd, los - 15 - 1.5 * por - 1.5 * lnd]; c = [bootX, 0, los + 6 + 2 * por - lnd];
        }
      }
      // lens: keep the subject the same size on screen with the narrower field of view by backing the camera off
      e = [c[0] + (e[0] - c[0]) * cdk, c[1] + (e[1] - c[1]) * cdk, c[2] + (e[2] - c[2]) * cdk];
      let dbg = false;
      if (DBG && DBG.cam) { e = DBG.cam.e; c = DBG.cam.c; dt = -1; dbg = true; }
      const k = dt < 0 ? 1 : 1 - Math.exp(-dt * rate);
      const pe = cam.e.slice();
      for (let i = 0; i < 3; i++) { cam.e[i] += (e[i] - cam.e[i]) * k; cam.c[i] += (c[i] - cam.c[i]) * k; }
      camSpeed = dt > 0 ? Math.hypot(cam.e[0] - pe[0], cam.e[1] - pe[1], cam.e[2] - pe[2]) / dt : 0;
      // operator: slow drift of the framing, a little lag on fast pans, impact shake and FOV kick
      if (dt > 0) { op.t += dt; cam.shake = Math.max(0, cam.shake - dt * 1.6); cam.kick = Math.max(0, cam.kick - dt * 1.1); }
      const opx = dbg ? 0 : (Math.sin(op.t * 0.7) * 0.6 + Math.sin(op.t * 1.9 + 1.0) * 0.3) * 0.06, opy = dbg ? 0 : (Math.sin(op.t * 0.9 + 2.0) * 0.6 + Math.sin(op.t * 2.3) * 0.25) * 0.04;
      const sh = cam.shake * cam.shake * 0.35, sx = (crand() - 0.5) * sh + opx, sy = (crand() - 0.5) * sh + opy;
      const asp = cv.width / cv.height;
      const hf = dbg ? 86 : HFOV * (replayCam ? 1 - 0.25 * replayCam : 1);
      const fovy = clamp(2 * Math.atan(Math.tan((hf * Math.PI) / 360) / asp), 0.5, 1.12 + 0.2 * por) * (1 + cam.kick * 0.09);
      const f = 1 / Math.tan(fovy / 2), n = 0.6, fa = 420;
      const ex = -(cam.e[0] + sx), ey = cam.e[1] + sy, ez = cam.e[2], cx = -(cam.c[0] + sx), cy = cam.c[1] + sy, cz = cam.c[2];
      let zx = ex - cx, zy = ey - cy, zz = ez - cz; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = zz, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l; const xy = 0;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const V = [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
      V[0] = -V[0]; V[1] = -V[1]; V[2] = -V[2];
      camF = v3n([cam.c[0] - cam.e[0], cam.c[1] - cam.e[1], cam.c[2] - cam.e[2]]);
      const Pm = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
      for (let i = 0; i < 16; i++) { PREV_VP[i] = VP[i]; PROJ[i] = Pm[i]; VIEW[i] = V[i]; }
      for (let cI = 0; cI < 4; cI++) for (let r = 0; r < 4; r++) { let s = 0; for (let kk = 0; kk < 4; kk++) s += Pm[kk * 4 + r] * V[cI * 4 + kk]; VP[cI * 4 + r] = s; }
      INV = m4Inv(VP); INVP = m4Inv(PROJ);
      // exposure drifts down when the camera looks up into the lights
      const et = SKY.exp * (1 - 0.35 * Math.max(0, camF[1]) * SKY.night) * (replayCam ? 1.05 : 1);
      expo += (et - expo) * (dt < 0 ? 1 : Math.min(1, dt * 1.5));
      // shadow cascades: three light-space boxes, the near one on the camera target, the far one over the whole bowl; texel-snapped
      const nc = NCASC(), sz = G && G.shadow ? G.shadow.size : 1024;
      const flipX = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const mid = [(cam.e[0] + cam.c[0]) * 0.5 + camF[0] * 6, 1, (cam.e[2] + cam.c[2]) * 0.5 + camF[2] * 6];
      const spec = [[cam.c, 13 + 5 * por], [mid, 42], [[0, 0, 50], 150]];
      for (let i = 0; i < 3; i++) {
        const [ctr, R] = spec[i], texel = (2 * R) / sz;
        const lv = m4LookAt([-LDIR[0] * 220, LDIR[1] * 220, LDIR[2] * 220], [0, 0, 0], [0, 1, 0]);
        // snap the centre in light space
        const lc = [-ctr[0], ctr[1], ctr[2]];
        let lx = lv[0] * lc[0] + lv[4] * lc[1] + lv[8] * lc[2], ly = lv[1] * lc[0] + lv[5] * lc[1] + lv[9] * lc[2];
        lx = Math.round(lx / texel) * texel; ly = Math.round(ly / texel) * texel;
        const ortho = m4Ortho(lx - R, lx + R, ly - R, ly + R, 10, 420);
        CASC[i] = m4Mul(m4Mul(ortho, lv), flipX);
      }
    }
    function project(x, y, z) {
      const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (w <= 0.1) return null;
      const px = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w, py = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
      return [(px + 1) / 2 * cssW, (1 - py) / 2 * cssH];
    }
    const projNDC = (x, y, z) => { const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (w <= 0.1) return null; return [(VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w, (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w, (VP[2] * x + VP[6] * y + VP[10] * z + VP[14]) / w]; };

    // ---------- drawing ----------
    const dyn = new Batch(6000), tr = new Batch(6000);
    const boneBuf = new Float32Array(NB * 12), colBuf = new Float32Array(NSL * 3), plBuf = new Float32Array(48);
    Batch.prototype.ellipsoid = function (m, rx, ry, rz, c, segs, rows) {
      segs = segs || 8; rows = rows || 6; this.grow(segs * rows * 6);
      const P = (i, j) => { const ph = (i / rows) * Math.PI, th = (j / segs) * 6.2832, nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th); const w = mPt(m, nx * rx, ny * ry, nz * rz); const n = [m[0] * nx / rx + m[1] * ny / ry + m[2] * nz / rz, m[4] * nx / rx + m[5] * ny / ry + m[6] * nz / rz, m[8] * nx / rx + m[9] * ny / ry + m[10] * nz / rz]; const nl = Math.hypot(n[0], n[1], n[2]) || 1; return [w, [n[0] / nl, n[1] / nl, n[2] / nl]]; };
      for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) {
        const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
        for (const q of [a, b, cc, a, cc, d]) this.v(q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], c, 0.5, 0.5);
      }
    };
    function drawBall(b, x, y, z, yaw, pitch, spin, tumble) {
      let m = mT(IDM, x, y, z); m = mRY(m, yaw); m = mRX(m, pitch);
      if (tumble) m = mRX(m, spin || 0); else m = mRZ(m, spin || 0);
      b.ellipsoid(m, 0.165, 0.165, 0.29, BALLC, 12, 8);
      b.box(m, 0, 0.16, 0.01, 0.03, 0.02, 0.13, LACE);
      for (let i = -2; i <= 2; i++) b.box(m, 0, 0.17, 0.01 + i * 0.03, 0.06, 0.012, 0.012, LACE);
      b.box(m, 0, 0, 0.0, 0.17, 0.012, 0.3, [0.95, 0.95, 0.95, 1]);
      b.box(m, 0, 0, 0.0, 0.012, 0.17, 0.3, [0.95, 0.95, 0.95, 1]);
    }
    const COL = { open: [0.17, 0.83, 0.42, 0.8], mid: [1, 0.76, 0.1, 0.8], cov: [1, 0.2, 0.27, 0.75] };
    const sepClass = (d) => (d >= 3 ? 'open' : d >= 1.6 ? 'mid' : 'cov');
    function sepOf(r) { let bd = 99; for (const d of def) { if (d.rag) continue; const dd = dist(d, r); if (dd < bd) bd = dd; } return bd; }
    const WXN = WX === 'rain' ? 1100 : WX === 'snow' ? 480 : 0;
    for (let i = 0; i < WXN; i++) wxp.push({ x: (crand() - 0.5) * 30, y: crand() * 14, z: (crand() - 0.5) * 30, s: 0.6 + crand() * 0.6, w: crand() });
    const flashes = [], breaths = [];
    function setLitUniforms(P, env) {
      gl.useProgram(P.pr);
      gl.uniformMatrix4fv(P.u.uVP, false, VP);
      gl.uniform3f(P.u.uEye, cam.e[0], cam.e[1], cam.e[2]); gl.uniform3f(P.u.uCamF, camF[0], camF[1], camF[2]);
      gl.uniform3f(P.u.uFogR, SKY.fogR[0], SKY.fogR[1], SKY.fogR[2]);
      gl.uniform3f(P.u.uFog, SKY.fog[0], SKY.fog[1], SKY.fog[2]); gl.uniform3f(P.u.uSunDir, LDIR[0], LDIR[1], LDIR[2]);
      gl.uniform3f(P.u.uAmbC, SKY.amb[0], SKY.amb[1], SKY.amb[2]); gl.uniform3f(P.u.uSunCol, SKY.sun[0], SKY.sun[1], SKY.sun[2]); gl.uniform3f(P.u.uGndC, SKY.gnd[0], SKY.gnd[1], SKY.gnd[2]);
      for (let i = 0; i < 4; i++) { plBuf[i * 4] = LPOS[i][0]; plBuf[i * 4 + 1] = LPOS[i][1]; plBuf[i * 4 + 2] = LPOS[i][2]; plBuf[i * 4 + 3] = LPOS[i][3]; }
      gl.uniform4fv(P.u.uLP, plBuf.subarray(0, 16));
      for (let i = 0; i < 4; i++) { plBuf[16 + i * 3] = LCOL[0]; plBuf[16 + i * 3 + 1] = LCOL[1]; plBuf[16 + i * 3 + 2] = LCOL[2]; }
      gl.uniform3fv(P.u.uLC, plBuf.subarray(16, 28));
      gl.uniform1f(P.u.uEnvK, env ? 0 : SKY.env); gl.uniform1f(P.u.uTime, performance.now() / 1000);
      gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uShadow, 1); if (P.u.uKit) gl.uniform1i(P.u.uKit, 2); if (P.u.uEnv) gl.uniform1i(P.u.uEnv, 3); if (P.u.uNrm) gl.uniform1i(P.u.uNrm, 4); if (P.u.uDetail) gl.uniform1i(P.u.uDetail, 5);
      const sh = G.shadow && !env;
      gl.uniform4f(P.u.uShadowP, sh ? 1 : 0, sh ? 1 / G.shadow.size : 0, sh ? G.shadow.n : 0, 0.00035 * (quality >= 2 ? 0.8 : 1.2));
      gl.uniform3f(P.u.uSplit, 0, 0, 0);
      gl.uniformMatrix4fv(P.u.uLVP0, false, CASC[0]); gl.uniformMatrix4fv(P.u.uLVP1, false, CASC[1]); gl.uniformMatrix4fv(P.u.uLVP2, false, CASC[2]);
      if (P.u.uWet) gl.uniform1f(P.u.uWet, WET ? 1 : 0);
    }
    function bindWorldAttribs(P, buf, data) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      if (data) gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 48, 0);
      if (P.a.aN != null) { gl.enableVertexAttribArray(P.a.aN); gl.vertexAttribPointer(P.a.aN, 3, gl.FLOAT, false, 48, 12); }
      if (P.a.aC != null) { gl.enableVertexAttribArray(P.a.aC); gl.vertexAttribPointer(P.a.aC, 4, gl.FLOAT, false, 48, 24); }
      if (P.a.aT != null) { gl.enableVertexAttribArray(P.a.aT); gl.vertexAttribPointer(P.a.aT, 2, gl.FLOAT, false, 48, 40); }
    }
    function disableAll(P) { for (const k in P.a) gl.disableVertexAttribArray(P.a[k]); }
    const worldMat = (P, mat, kind) => { gl.uniform4f(P.u.uMatW, mat[0], mat[1], mat[2], mat[3]); gl.uniform1f(P.u.uKind, kind || 0); };
    const DIRTC = WX === 'rain' ? [0.16, 0.12, 0.07] : WX === 'snow' ? [0.3, 0.3, 0.3] : [0.25, 0.3, 0.1];
    function playerUniforms(P, p) {
      const C = p.side === 2 ? REFC : p.side ? DEFC : OFFC, lk = p.lk, skin = lk.tone || SKIN[lk.skin];
      const iris = lk.skin >= 3 ? [0.22, 0.12, 0.05] : lk.skin === 2 ? [0.3, 0.18, 0.07] : lk.eyes || [0.28, 0.2, 0.1];
      // SL order: jer pant skin helm trim cleat pad mask num face arm name glove sock sole visor snum wht eye tape towel stripes
      const cols = [C.jer, C.pant, skin, C.helm, C.stripe, lk.cleat, C.pad, C.mask, C.num, skin, lk.sleeves ? C.jer : skin, WHITEC, C.glove, C.sock, lk.cleat === CLEATS.white ? DARKC : WHITEC, VISORC, C.num, WHITEC, iris, WHITEC, lum(C.pant) > 0.6 ? C.jer : WHITEC, WHITEC, lk.mouthC || C.jer];
      for (let i = 0; i < NSL; i++) { colBuf[i * 3] = cols[i][0]; colBuf[i * 3 + 1] = cols[i][1]; colBuf[i * 3 + 2] = cols[i][2]; }
      gl.uniform3fv(P.u.uCol, colBuf);
      const nu = cellUV(p.ncell >= 0 ? p.ncell : 207), fu = cellUV(p.face >= 0 ? p.face : p.fcell >= 0 ? p.fcell : 100), nm = cellUV(p.nmcell >= 0 ? p.nmcell : 207);
      gl.uniform4f(P.u.uNumUV, nu[0], nu[1], nu[2], nu[3]); gl.uniform4f(P.u.uFaceUV, fu[0], fu[1], fu[2], fu[3]); gl.uniform4f(P.u.uNameUV, nm[0], nm[1], nm[2], nm[3]);
      gl.uniform1f(P.u.uDirt, p.dirt || 0); gl.uniform3f(P.u.uDirtC, DIRTC[0], DIRTC[1], DIRTC[2]);
      gl.uniform1f(P.u.uSweat, clamp(elapsedT / 420, 0, 1) * 0.85); gl.uniform1f(P.u.uSeed, (p.num || 7) * 0.37);
      const g = p.gaze || camF; gl.uniform3f(P.u.uGaze, g[0], g[1], g[2]);
      fxUniforms(P, p, performance.now() / 1000);
    }
    function skinCommon(P, p, mesh) {
      gl.uniform3f(P.u.uScale, p.lk.hs, p.lk.hs, p.lk.hs);
      gl.uniform1f(P.u.uVis, p.lk.visor ? 1 : 0); gl.uniform1f(P.u.uTowel, p.towel ? 1 : 0); gl.uniform1f(P.u.uMouth, p.mouth && (phase === 'pre' || phase === 'dead' || phase === 'break' || phase === 'cpu' || phase === 'splash') ? 1 : 0);
      if (P.u.uSway != null) gl.uniform1f(P.u.uSway, p.sway || 0);
      packBones(p.bones, boneBuf, mesh.bind, p.lk.hs); if (p.fxr && (p.fxr.b || p.fxr.g)) fxBones(p, boneBuf, mesh.bind, performance.now() / 1000);
      gl.uniform4fv(P.u.uBones, boneBuf);
    }
    const LOD_D = 22; // full mesh within this many yards of the camera
    function bindMesh(P, mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
      const ST = VSTRIDE * 4;
      gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, ST, 0);
      if (P.a.aN != null) { gl.enableVertexAttribArray(P.a.aN); gl.vertexAttribPointer(P.a.aN, 3, gl.FLOAT, false, ST, 12); }
      gl.enableVertexAttribArray(P.a.aB); gl.vertexAttribPointer(P.a.aB, 2, gl.FLOAT, false, ST, 24);
      gl.enableVertexAttribArray(P.a.aW); gl.vertexAttribPointer(P.a.aW, 1, gl.FLOAT, false, ST, 32);
      gl.enableVertexAttribArray(P.a.aS); gl.vertexAttribPointer(P.a.aS, 1, gl.FLOAT, false, ST, 36);
      if (P.a.aT != null) { gl.enableVertexAttribArray(P.a.aT); gl.vertexAttribPointer(P.a.aT, 2, gl.FLOAT, false, ST, 40); }
      if (P.a.aA != null) { gl.enableVertexAttribArray(P.a.aA); gl.vertexAttribPointer(P.a.aA, 1, gl.FLOAT, false, ST, 48); }
    }
    function drawPlayers(P, depthOnly, list) {
      gl.useProgram(P.pr);
      let cur = null, curSide = -1;
      if (!depthOnly) gl.uniform1f(P.u.uAlpha, 0);
      for (const p of list) {
        if (!p.bones) continue;
        const d = depthOnly ? 99 : Math.hypot(p.x - cam.e[0], p.z - cam.e[2]);
        const mesh = meshFor(p.body || BODY.WR)[d < (quality === 0 ? 9 : LOD_D) && !depthOnly ? 0 : 1];
        if (mesh !== cur) { cur = mesh; bindMesh(P, mesh); }
        if (!depthOnly && p.side !== curSide) { curSide = p.side; gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, p.side === 2 ? G.kitR : p.side ? G.kitD : G.kitO); gl.activeTexture(gl.TEXTURE0); }
        skinCommon(P, p, mesh);
        if (!depthOnly) playerUniforms(P, p);
        if (mesh.vin) { gl.drawElements(gl.TRIANGLES, mesh.vi0, gl.UNSIGNED_SHORT, 0); gl.drawElements(gl.TRIANGLES, mesh.n - mesh.vi0 - mesh.vin, gl.UNSIGNED_SHORT, (mesh.vi0 + mesh.vin) * 2); DRAWS.n += 2; }
        else { gl.drawElements(gl.TRIANGLES, mesh.n, gl.UNSIGNED_SHORT, 0); DRAWS.n++; }
        DRAWS.tris += mesh.n / 3;
        if (!depthOnly && p.lk.visor && mesh.vin && d < LOD_D) visors.push([p, mesh]);
      }
      if (!depthOnly && visors.length) { // tinted visors: blended over the face
        gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(P.u.uAlpha, 0.62);
        for (const [p, mesh] of visors) {
          if (mesh !== cur) { cur = mesh; bindMesh(P, mesh); }
          if (p.side !== curSide) { curSide = p.side; gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, p.side === 2 ? G.kitR : p.side ? G.kitD : G.kitO); gl.activeTexture(gl.TEXTURE0); }
          skinCommon(P, p, mesh); playerUniforms(P, p);
          gl.drawElements(gl.TRIANGLES, mesh.vin, gl.UNSIGNED_SHORT, mesh.vi0 * 2); DRAWS.n++;
        }
        gl.uniform1f(P.u.uAlpha, 0); gl.depthMask(true); gl.disable(gl.BLEND);
      }
      visors.length = 0;
      disableAll(P);
    }
    const visors = [];
    // soft contact shadows under feet and bodies (the shadow map alone never quite grounds a foot)
    function contactBlobs() {
      const k = G.shadow ? 0.7 : 1.6;
      for (const p of everyone) {
        if (!p.bones) continue;
        if (p.rag) { const q = p.rag.pts; tr.blob((q[0][0] + q[1][0]) / 2, (q[0][2] + q[1][2]) / 2, 0.8, 0.26 * k, 0.02, 12); continue; }
        const hs = p.lk.hs;
        for (const b of [B.ftL, B.ftR]) { const m = p.bones[b], fy = m[7] - 0.07 * hs, h = clamp(1 - fy / 0.45, 0, 1); if (h > 0.02) tr.blob(m[3] + m[2] * 0.07, m[11] + m[10] * 0.07, (0.16 + 0.1 * (1 - h)) * hs, 0.42 * h * k, 0.02, 10); }
        const hm = p.bones[B.hips]; tr.blob(hm[3], hm[11], 0.6 * (p.w || 1) * hs, (0.1 + (p.jumpY > 0.05 ? 0 : 0.03)) * k * clamp(1 - p.jumpY / 1.2, 0.2, 1), 0.018, 12);
      }
    }
    let frameT = 0, perf = { sim: 0, rend: 0, n: 0 };
    const quadDraw = (P) => { gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(P.a.aP); DRAWS.n++; };
    // the opaque scene: sky, statics, crowd, athletes, grass, dynamic geometry; shared with the cubemap bake
    function drawScenePass(forEnv, o) {
      const now = performance.now() / 1000, showPlayers = phase !== 'box' && !forEnv;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.shadow && !forEnv ? G.shadow.tex : G.white);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_CUBE_MAP, G.env || null);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, G.fabric);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, G.detail);
      gl.activeTexture(gl.TEXTURE0);
      // sky
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND);
      { const P = G.sky; gl.useProgram(P.pr); gl.uniformMatrix4fv(P.u.uInvVP, false, forEnv ? m4Inv(VP) : INV); gl.uniform3f(P.u.uSun, LDIR[0], LDIR[1], LDIR[2]); gl.uniform1f(P.u.uNight, SKY.night); gl.uniform1f(P.u.uTime, now); gl.uniform3f(P.u.uTop, SKY.top[0], SKY.top[1], SKY.top[2]); gl.uniform3f(P.u.uHor, SKY.hor[0], SKY.hor[1], SKY.hor[2]); gl.uniform1f(P.u.uCloud, SKY.cloud); gl.uniform1f(P.u.uGlow, SKY.glow); quadDraw(P); }
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      // statics
      const W = quality >= 2 && !forEnv ? G.worldHi : G.world;
      setLitUniforms(W, forEnv); gl.uniform2f(W.u.uUV, 0, 0);
      for (const s of statics) {
        gl.bindTexture(gl.TEXTURE_2D, s.k === 'board' && feedOn && G.feed && !G.feedPass ? G.feed.tex : s.tex); worldMat(W, s.mat, DBG && DBG.shadowView ? 9 : s.kind);
        const fv = s.k === 'board' && feedOn && G.feed && !G.feedPass; gl.uniform1f(W.u.uFlipV, fv ? 1 : 0); if (fv) gl.uniform4f(W.u.uMatW, 0.4, 0, 0, 1.0);
        if (s.k === 'ribbon') gl.uniform2f(W.u.uUV, (now * 0.04) % 1, 0); else gl.uniform2f(W.u.uUV, 0, 0);
        if (s.k === 'glass') { gl.enable(gl.BLEND); }
        bindWorldAttribs(W, s.b); gl.drawArrays(gl.TRIANGLES, 0, s.n); DRAWS.n++; DRAWS.tris += s.n / 3;
        if (s.k === 'glass') gl.disable(gl.BLEND);
      }
      disableAll(W);
      // crowd
      { const P = G.crowd; gl.useProgram(P.pr); gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform1f(P.u.uTime, now); gl.uniform1f(P.u.uExcite, excite); gl.uniform1f(P.u.uWave, wave); gl.uniform1f(P.u.uMood, crowdMood); gl.uniform3f(P.u.uEye, cam.e[0], cam.e[1], cam.e[2]); gl.uniform3f(P.u.uCamF, camF[0], camF[1], camF[2]); gl.uniform3f(P.u.uFogR, SKY.fogR[0], SKY.fogR[1], SKY.fogR[2]); gl.uniform3f(P.u.uFog, SKY.fog[0], SKY.fog[1], SKY.fog[2]);
        const dim = SKY.night ? 0.26 : 0.72; gl.uniform1f(P.u.uDim, dim); gl.uniform3f(P.u.uTint, SKY.amb[0] * 2.2 + 0.25, SKY.amb[1] * 2.2 + 0.25, SKY.amb[2] * 2.2 + 0.25);
        gl.uniform1i(P.u.uTex, 0); gl.bindTexture(gl.TEXTURE_2D, G.crowdT);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.crowdB); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 48, 0); gl.enableVertexAttribArray(P.a.aC); gl.vertexAttribPointer(P.a.aC, 3, gl.FLOAT, false, 48, 12); gl.enableVertexAttribArray(P.a.aM); gl.vertexAttribPointer(P.a.aM, 4, gl.FLOAT, false, 48, 24); gl.enableVertexAttribArray(P.a.aT); gl.vertexAttribPointer(P.a.aT, 2, gl.FLOAT, false, 48, 40);
        gl.drawArrays(gl.TRIANGLES, 0, G.crowdN); DRAWS.n++; DRAWS.tris += G.crowdN / 3; disableAll(P); }
      if (forEnv) return;
      // athletes, sideline figures
      if (showPlayers) { const S = quality >= 2 ? G.skinHi : G.skin; setLitUniforms(S); gl.bindTexture(gl.TEXTURE_2D, G.atlas); drawPlayers(S, false, everyone); if (extras.length) drawPlayers(S, false, quality === 0 ? extras.filter((p) => p.ref || p.crew) : extras); drawFxShells(S, everyone, now); }
      // grass blades around the camera target (full detail only)
      if (quality >= 2 && G.grass && showPlayers && !G.feedPass && WX !== 'snow') drawGrass(now);
      // dynamic lit geometry (ball, chains, confetti) then transparent markers
      setLitUniforms(W); gl.uniform2f(W.u.uUV, 0, 0); gl.uniform1f(W.u.uFlipV, 0); worldMat(W, [0.5, 0, 0, 0], 0); gl.bindTexture(gl.TEXTURE_2D, G.white);
      if (dyn.n) { bindWorldAttribs(W, G.dyn, dyn.f.subarray(0, dyn.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); DRAWS.n++; DRAWS.tris += dyn.n / 3; }
      gl.enable(gl.BLEND);
      if (tr.n) { gl.depthMask(false); worldMat(W, [0.5, 0, 0, 0], 0); bindWorldAttribs(W, G.tr, tr.f.subarray(0, tr.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, tr.n); gl.depthMask(true); DRAWS.n++; }
      if (showPlayers) drawFxParts(W);
      disableAll(W);
    }
    function drawGrass(now) {
      const P = G.grass; gl.useProgram(P.pr);
      gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform3f(P.u.uEye, cam.e[0], cam.e[1], cam.e[2]); gl.uniform3f(P.u.uCamF, camF[0], camF[1], camF[2]);
      // the patch sits around the point on the ground the camera looks at, pulled toward the camera
      const t = clamp(-cam.e[1] / (camF[1] || -0.1), 2, 60), gx = cam.e[0] + camF[0] * t * 0.6, gz = cam.e[2] + camF[2] * t * 0.6;
      const cell = 0.1; gl.uniform3f(P.u.uOrg, gx, 0, gz); gl.uniform1f(P.u.uCell, cell); gl.uniform1f(P.u.uN, G.GN); gl.uniform1f(P.u.uTime, now); gl.uniform1f(P.u.uWet, WET ? 1 : 0);
      const near = everyone.slice().sort((a, b) => Math.hypot(a.x - gx, a.z - gz) - Math.hypot(b.x - gx, b.z - gz)).slice(0, 12);
      for (let i = 0; i < 12; i++) { const p = near[i]; plBuf[i * 4] = p ? p.x : 999; plBuf[i * 4 + 1] = p ? p.z : 999; plBuf[i * 4 + 2] = p ? (p.rag ? 1 : p.jumpY > 0.2 ? 0 : 0.8) : 0; plBuf[i * 4 + 3] = 0; }
      gl.uniform4fv(P.u.uPl, plBuf);
      const turf = WX === 'snow' ? [0.42, 0.46, 0.42] : WX === 'rain' ? [0.07, 0.16, 0.07] : [0.085, 0.23, 0.08];
      gl.uniform3f(P.u.uBase, turf[0], turf[1], turf[2]); gl.uniform3f(P.u.uAmbC, SKY.amb[0], SKY.amb[1], SKY.amb[2]); gl.uniform3f(P.u.uSunDir, LDIR[0], LDIR[1], LDIR[2]); gl.uniform3f(P.u.uSunCol, SKY.sun[0], SKY.sun[1], SKY.sun[2]);
      gl.uniform4fv(P.u.uLP, plBuf.subarray(0, 16) && (() => { const b = new Float32Array(16); for (let i = 0; i < 4; i++) { b[i * 4] = LPOS[i][0]; b[i * 4 + 1] = LPOS[i][1]; b[i * 4 + 2] = LPOS[i][2]; b[i * 4 + 3] = LPOS[i][3]; } return b; })());
      { const b = new Float32Array(12); for (let i = 0; i < 4; i++) { b[i * 3] = LCOL[0]; b[i * 3 + 1] = LCOL[1]; b[i * 3 + 2] = LCOL[2]; } gl.uniform3fv(P.u.uLC, b); }
      gl.uniform3f(P.u.uFog, SKY.fog[0], SKY.fog[1], SKY.fog[2]); gl.uniform3f(P.u.uFogR, SKY.fogR[0], SKY.fogR[1], SKY.fogR[2]); gl.uniform1i(P.u.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bladeB); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(P.a.aT); gl.vertexAttribPointer(P.a.aT, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.instB); gl.enableVertexAttribArray(P.a.aI); gl.vertexAttribPointer(P.a.aI, 4, gl.FLOAT, false, 16, 0); X.inst.vertexAttribDivisor(P.a.aI, 1);
      gl.enable(gl.BLEND);
      X.inst.drawArraysInstanced(gl.TRIANGLES, 0, G.bladeN, G.GN * G.GN); DRAWS.n++; DRAWS.tris += G.bladeN / 3 * G.GN * G.GN;
      X.inst.vertexAttribDivisor(P.a.aI, 0); disableAll(P);
      gl.disable(gl.BLEND);
    }
    let crowdMood = 0, feedOn = false;
    const flareBuf = new Float32Array(16);
    function render(dt) {
      if (glLost || !G || finished) return;
      const t0 = performance.now();
      DRAWS.n = 0; DRAWS.tris = 0;
      updateCam(dt);
      const now = performance.now() / 1000;
      if (wave > 0) wave = Math.max(0, wave - dt * 0.25); else if ((phase === 'cpu' || phase === 'break' || phase === 'pre') && dt > 0 && crand() < dt * 0.012) wave = 1;
      crowdMood += ((lastBig && (lastBig.kind === 'int' || lastBig.kind === 'fum') ? -1 : 0) - crowdMood) * Math.min(1, dt * 0.8);
      // pose everyone for this frame
      for (const p of everyone) animUpdate(p, Math.max(0, dt));
      extrasStep(Math.max(0, dt));
      dyn.n = 0; tr.n = 0;
      const showPlayers = phase !== 'box';
      if (ball && showPlayers) drawBallNow(now);
      for (const q of parts) if (q.life > 0) { let m = mT(IDM, q.x, q.y, q.z); m = mRY(m, q.r); m = mRX(m, q.r * 0.7); if (q.sz) dyn.box(m, 0, 0, 0, q.sz, q.sz * 0.6, q.sz * 1.3, q.c); else dyn.box(m, 0, 0, 0, 0.22, 0.02, 0.14, q.c); }
      drawMarks(now);
      drawExtrasProps();
      try { fxStep(Math.max(0, Math.min(dt, 0.1)), now); } catch (e) { if (!stepErrLogged) { stepErrLogged = true; console.error('blitz3d: fx error', e); } }
      if (showPlayers) contactBlobs();
      drawWeather(dt, now);
      if (boardDirty && ((now * 4) | 0) % 2 === 0) { boardDirty = false; try { boardCanvas(); gl.bindTexture(gl.TEXTURE_2D, G.board); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, boardC); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }
      if (fieldDirty && now - fieldUpT > 1.5) { fieldDirty = false; fieldUpT = now; try { gl.bindTexture(gl.TEXTURE_2D, G.field); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fieldC); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }
      if (atlasDirty) {
        atlasDirty = false;
        try { gl.bindTexture(gl.TEXTURE_2D, G.atlas); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas); }
        catch (e) { SQL.forEach((q) => { if (q.photo) noPhoto(q); }); ag.clearRect(0, 0, 1024, NAMEY); atlasDirty = true; }
      }
      // ---- shadow cascades ----
      if (G.shadow) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, G.shadow.fb);
        gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND);
        if (!G.shadow.dt) gl.colorMask(true, true, true, true); else gl.colorMask(false, false, false, false);
        for (let ci = 0; ci < G.shadow.n; ci++) {
          gl.viewport(ci * G.shadow.size, 0, G.shadow.size, G.shadow.size);
          const P = G.depthW; gl.useProgram(P.pr); gl.uniformMatrix4fv(P.u.uLVP, false, CASC[ci]);
          for (const s of statics) if (s.cast && (ci > 0 || s.k === 'plain') && !(quality === 0 && s.k === 'seats')) { bindWorldAttribs(P, s.b); gl.drawArrays(gl.TRIANGLES, 0, s.n); DRAWS.n++; }
          if (dyn.n) { bindWorldAttribs(P, G.dyn, dyn.f.subarray(0, dyn.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); DRAWS.n++; }
          disableAll(P);
          if (ci < 2) { const S = G.depthS; gl.useProgram(S.pr); gl.uniformMatrix4fv(S.u.uLVP, false, CASC[ci]); if (showPlayers) { drawPlayers(S, true, everyone); if (extras.length && ci === 0) drawPlayers(S, true, extras); } }
        }
        gl.colorMask(true, true, true, true);
        gl.enable(gl.BLEND);
      }
      // ---- jumbotron feed: the current camera view at low resolution, shown on the big screen during replays and close-ups ----
      if (quality >= 2 && G.feed && (replayCam > 0) && ((perf.n & 1) === 0)) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, G.feed.fb); gl.viewport(0, 0, G.feed.w, G.feed.h);
        gl.clearColor(SKY.hor[0], SKY.hor[1], SKY.hor[2], 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        G.feedPass = true; drawScenePass(false); G.feedPass = false;
        feedOn = true;
      } else if (feedOn && replayCam <= 0) { feedOn = false; boardDirty = true; }
      // ---- scene pass (HDR) ----
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.scene ? G.scene.fb : null);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(SKY.hor[0], SKY.hor[1], SKY.hor[2], 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawScenePass(false);
      // ---- post ----
      if (G.scene) {
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        let src = G.scene;
        // ambient occlusion from depth (half res) + blur
        let aoTex = null;
        if (quality >= 2 && G.aoA && G.scene.dt) {
          let P = G.ao; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, G.aoA.fb); gl.viewport(0, 0, G.aoA.w, G.aoA.h);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.scene.dt); gl.uniform1i(P.u.uDepth, 0); gl.uniform2f(P.u.uPx, 1 / G.aoA.w, 1 / G.aoA.h); gl.uniformMatrix4fv(P.u.uInvP, false, INVP); gl.uniform4f(P.u.uProj, PROJ[0], PROJ[5], 0, 0); gl.uniform1f(P.u.uRad, 0.55 + 0.4 * replayCam); quadDraw(P);
          P = G.blur4; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, G.aoB.fb); gl.bindTexture(gl.TEXTURE_2D, G.aoA.tex); gl.uniform1i(P.u.uTex, 0); gl.uniform2f(P.u.uPx, 1 / G.aoA.w, 1 / G.aoA.h); quadDraw(P);
          aoTex = G.aoB.tex;
        }
        // depth of field (replays / close-ups) and camera motion blur
        const dofK = replayCam > 0 ? 0.9 * replayCam : 0, mbK = quality >= 2 && camSpeed > 3 && phase === 'live' ? clamp((camSpeed - 3) / 12, 0, 1) * 0.8 : 0;
        if (G.scene2 && G.scene.dt && (dofK > 0 || mbK > 0)) {
          const P = G.dofmb; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, G.scene2.fb); gl.viewport(0, 0, cv.width, cv.height);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.scene.dt); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.scene.tex);
          gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uDepth, 1); gl.uniform2f(P.u.uPx, 1 / cv.width, 1 / cv.height); gl.uniformMatrix4fv(P.u.uInvVP, false, INV); gl.uniformMatrix4fv(P.u.uPrevVP, false, PREV_VP);
          gl.uniform1f(P.u.uMB, mbK); const fd = Math.hypot(cam.c[0] - cam.e[0], cam.c[1] - cam.e[1], cam.c[2] - cam.e[2]); gl.uniform3f(P.u.uDof, fd, dofK, 0); gl.uniform2f(P.u.uNF, 0.6, 420);
          quadDraw(P); src = G.scene2;
        }
        // bloom
        if (quality >= 1 && G.bloomA) {
          let P = G.extract; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, G.bloomA.fb); gl.viewport(0, 0, G.bloomA.w, G.bloomA.h); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(P.u.uTex, 0); gl.uniform2f(P.u.uPx, 1 / cv.width, 1 / cv.height); gl.uniform1f(P.u.uThr, 1.0 / expo); quadDraw(P);
          P = G.blur; gl.useProgram(P.pr); gl.uniform1i(P.u.uTex, 0);
          gl.bindFramebuffer(gl.FRAMEBUFFER, G.bloomB.fb); gl.bindTexture(gl.TEXTURE_2D, G.bloomA.tex); gl.uniform2f(P.u.uDir, 1 / G.bloomA.w, 0); quadDraw(P);
          gl.bindFramebuffer(gl.FRAMEBUFFER, G.bloomA.fb); gl.bindTexture(gl.TEXTURE_2D, G.bloomB.tex); gl.uniform2f(P.u.uDir, 0, 1 / G.bloomA.h); quadDraw(P);
          gl.bindFramebuffer(gl.FRAMEBUFFER, G.bloomB.fb); gl.bindTexture(gl.TEXTURE_2D, G.bloomA.tex); gl.uniform2f(P.u.uDir, 2 / G.bloomA.w, 0); quadDraw(P);
          gl.bindFramebuffer(gl.FRAMEBUFFER, G.bloomA.fb); gl.bindTexture(gl.TEXTURE_2D, G.bloomB.tex); gl.uniform2f(P.u.uDir, 0, 2 / G.bloomA.h); quadDraw(P);
        }
        // lens flares: towers in frame, occlusion tested against the depth buffer in the shader
        let nfl = 0;
        if (SKY.night && G.scene.dt) for (let i = 0; i < 4; i++) { const t = TOWERS[i], s = projNDC(t[0] + (t[0] < 0 ? 3.5 : -3.5), t[1] - 2.5, t[2]); if (s && Math.abs(s[0]) < 1.3 && Math.abs(s[1]) < 1.3) { flareBuf[i * 4] = s[0] * 0.5 + 0.5; flareBuf[i * 4 + 1] = s[1] * 0.5 + 0.5; flareBuf[i * 4 + 2] = 0.35; flareBuf[i * 4 + 3] = s[2] * 0.5 + 0.5; nfl++; } else { flareBuf[i * 4 + 2] = 0; } }
        const P = G.final; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, quality >= 1 && G.bloomA ? G.bloomA.tex : G.black);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, aoTex || G.white);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, G.scene.dt || G.white);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uBloom, 1); gl.uniform1i(P.u.uAO, 2); gl.uniform1i(P.u.uDepth, 3); gl.uniform2f(P.u.uPx, 1 / cv.width, 1 / cv.height);
        gl.uniform1f(P.u.uBloomK, quality >= 1 && G.bloomA ? (SKY.night ? 0.55 : 0.3) : 0); gl.uniform1f(P.u.uFxaa, 1); gl.uniform1f(P.u.uVig, 0.42); gl.uniform1f(P.u.uKick, cam.kick * 0.12);
        gl.uniform1f(P.u.uExp, expo); gl.uniform1f(P.u.uAOk, aoTex ? 0.85 : 0); gl.uniform4fv(P.u.uFl, flareBuf); gl.uniform1f(P.u.uFlK, nfl ? 0.9 : 0); gl.uniform1f(P.u.uTime, now); gl.uniform1f(P.u.uLDR, G.scene.hdr ? 0 : 1); gl.uniform1f(P.u.uAsp, cv.width / cv.height);
        quadDraw(P);
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      }
      updTags();
      perf.rend += performance.now() - t0; perf.n++;
    }
    function drawBallNow(now) {
      const h = ball.holder;
      if (h) {
        if (h.bones) {
          const m = h.bones[B.haR], hs = h.lk.hs;
          if (h.role === 'QB' && (mode === 'aim' || h.throwT >= 0) && h === OK.QB) { const hp = mPt(m, 0, -0.07 * hs, 0.05); drawBall(dyn, hp[0], hp[1], hp[2], h.h, -0.5, 0, false); }
          else if (h.rag || h.pose === 'celebrate' || h.pose === 'kneel') { const hp = mPt(m, 0.05, -0.13 * hs, 0.08); drawBall(dyn, hp[0], hp[1], hp[2], h.h + 0.6, 0.3, 0, false); }
          else { const sd = h.carrySide || 1, ch = h.bones[B.chest], hp = mPt(ch, sd * 0.25 * hs, -0.04 * hs, 0.18 * hs); drawBall(dyn, hp[0], hp[1], hp[2], h.h + (sd < 0 ? 0.15 : -0.15), 0.35, 0, false); }
        } else drawBall(dyn, h.x + Math.sin(h.h) * 0.3, 1.3, h.z + Math.cos(h.h) * 0.3, h.h, 0.3, 0, false);
      } else if (ball.st === 'air' || ball.st === 'kick' || ball.st === 'pitch') {
        const b = ball, spin = b.spin || now * 12;
        if (ball.st === 'kick' || b.tipped) drawBall(dyn, b.x, b.y, b.z, Math.atan2(b.vx || 0, b.vz || 1), 0, spin, true);
        else { const wob = b.wobA ? Math.sin(now * 9 + b.wob) * b.wobA : 0; drawBall(dyn, b.x, b.y, b.z, Math.atan2(b.vx || 0, b.vz || 1) + wob, -Math.atan2(b.vy || 0, Math.hypot(b.vx || 0, b.vz || 0) || 1) + wob * 0.5, spin, false); }
        tr.blob(b.x, b.z, 0.3, 0.35, 0.03, 10);
        if (ball.st === 'air' && b.cp && !b.replay) { const pul = 0.9 + Math.sin(now * 11) * 0.12; tr.ring(b.cp.x, b.cp.z, 0.85 * pul, 1.12 * pul, [1, 1, 1, 0.7], 0.05, 20); }
      } else if (ball.st === 'spot' || ball.st === 'snap') drawBall(dyn, ball.x, Math.max(0.17, ball.y), ball.z, 0, ball.st === 'spot' ? 1.57 : 0.3, 0, false);
      else drawBall(dyn, ball.x, Math.max(0.15, ball.y), ball.z, 0.6, ball.rolling ? 1.57 : 0.9, ball.spin || 0, true);
    }
    function drawMarks(now) {
      const live = phase === 'pre' || phase === 'live' || phase === 'dead' || phase === 'splash' || phase === 'pat';
      const scrim = live && !(kick && kick.type === 'ko') && phase !== 'pat';
      if (scrim && !tryMode) {
        tr.seg(-HW, los, HW, los, 0.26, [0.25, 0.55, 1, 0.7], 0.03);
        if (fdz < 100) tr.seg(-HW, fdz, HW, fdz, 0.26, [1, 0.86, 0.1, 0.8], 0.03);
      }
      if (phase === 'pre' || phase === 'splash') {
        const fx = flip ? -1 : 1;
        for (const p of off) {
          if (p.R) {
            const pts = p.R.pts, rc = hot[p.key] ? [0.3, 0.9, 1, 0.9] : p.key === 'X' ? [1, 0.76, 0.1, 0.9] : [1, 1, 1, 0.78];
            for (let k = 1; k < pts.length; k++) tr.seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.3, rc, 0.045);
            const a = pts[pts.length - 2], z = pts[pts.length - 1], dx = z[0] - a[0], dz = z[1] - a[1], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
            if (p.R.sit) tr.ring(z[0], z[1], 0.35, 0.65, rc, 0.045, 12);
            else tr.quad([z[0] + ux * 1.4, 0.046, z[1] + uz * 1.4], [z[0] - uz * 0.7, 0.046, z[1] + ux * 0.7], [z[0], 0.046, z[1]], [z[0] + uz * 0.7, 0.046, z[1] - ux * 0.7], [0, 0, 0], rc);
          } else if (p.role !== 'OL' && p.role !== 'QB' && p.blk) tr.seg(p.x - 0.5, p.z + 0.9, p.x + 0.5, p.z + 0.9, 0.18, [1, 1, 1, 0.5], 0.045);
        }
        if (play.type === 'run' || play.type === 'draw' || play.type === 'sneak') {
          const c = play.type === 'sneak' ? OK.QB : OK.RB, lx = (play.lane || 0) * fx, mid = [lx * 0.5, los - 1.5];
          tr.seg(c.x, c.z, mid[0], mid[1], 0.34, [1, 0.6, 0.2, 0.9], 0.045); tr.seg(mid[0], mid[1], lx, los + 4, 0.34, [1, 0.6, 0.2, 0.9], 0.045);
          tr.quad([lx, 0.046, los + 5.4], [lx - 0.7, 0.046, los + 4], [lx, 0.046, los + 4.3], [lx + 0.7, 0.046, los + 4], [0, 0, 0], [1, 0.6, 0.2, 0.9]);
        }
      }
      // aiming: the throw line leaves the QB, with the arc from his hand and the landing ring (error cone)
      if (phase === 'live' && mode === 'aim' && aim) {
        const s = aimSpot(); aim.spot = s;
        if (s && !s.back) {
          const qb = OK.QB, D = Math.min(s.D, maxDist()), ux = s.ux, uz = s.uz;
          const T = flightOf(D, arc), hp = handPos(qb, 1), y0 = hp[1] > 1.2 ? hp[1] : 2.2, vy = ([1.5, 1.6, 2.0][arc] - y0 + 0.5 * GRAV * T * T) / T, sg = sigma(D, arc);
          const lx = qb.x + ux * D, lz = qb.z + uz * D;
          tr.seg(qb.x, qb.z, lx, lz, 0.22, [1, 0.86, 0.25, 0.45], 0.05);
          for (let i = 1; i <= 16; i++) { const t = (i / 16) * T; dyn.box(IDM, qb.x + ux * D * (i / 16), y0 + vy * t - 0.5 * GRAV * t * t, qb.z + uz * D * (i / 16), 0.24, 0.24, 0.24, [1, 0.86, 0.25, 1]); }
          const rr = 0.5 + sg * 1.4;
          tr.disc(lx, lz, rr, [1, 1, 1, 0.16], 0.055, 24);
          tr.ring(lx, lz, rr, rr + 0.4, s.over ? [1, 0.5, 0.2, 0.95] : [1, 1, 1, 0.95], 0.06, 28);
          tr.disc(lx, lz, 0.4, [1, 0.86, 0.1, 0.95], 0.065, 12);
          // the receiver this throw is for, and where he will be when it gets there (lead him: a ghost ring on his path)
          const L = leadFor({ x: lx, z: lz }, arc, 9), r = L ? L.r : nearestRec(lx, lz, 9);
          aim.tgt = r;
          if (r) tr.ring(r.x, r.z, 0.95, 1.25, [0.17, 0.83, 0.42, 0.85], 0.05, 18);
          if (L && Math.hypot(L.x - r.x, L.z - r.z) > 1.2) { tr.seg(r.x, r.z, L.x, L.z, 0.12, [0.17, 0.83, 0.42, 0.45], 0.05); tr.ring(L.x, L.z, 0.55, 0.75, [0.17, 0.83, 0.42, 0.75], 0.055, 16); }
        } else if (s && s.back) {
          const qb = OK.QB; tr.seg(qb.x, qb.z, qb.x + s.ux * 4, qb.z + s.uz * 4, 0.3, [1, 0.25, 0.3, 0.85], 0.05);
        }
      }
      if (phase === 'live' && mode === 'aim' && !aim) for (const r of off) if (isRec(r) && r.R && !(r.blk === 'chip' && tPlay < r.R.blk)) { const c = COL[sepClass(sepOf(r))], pul = 1 + Math.sin(now * 8) * 0.08; tr.ring(r.x, r.z, 0.95 * pul, 1.25 * pul, c, 0.05, 16); }
      if (phase === 'live' && ctrl && mode === 'catch') tr.ring(ctrl.x, ctrl.z, 0.9, 1.2, [0.17, 0.83, 0.42, 0.9], 0.05, 18);
      if ((phase === 'live' || phase === 'dead') && carrier && mode === 'run') tr.ring(carrier.x, carrier.z, 0.9, 1.2, [1, 0.76, 0.1, 0.85], 0.05, 18);
      if (excite > 0.3 && flashes.length < 60 && crand() < excite * 0.7) { const s = crand() < 0.5 ? -1 : 1; flashes.push({ x: s * (37 + crand() * 22), y: 3 + crand() * 18, z: -20 + crand() * 140, life: 0.08 }); }
      for (let i = flashes.length - 1; i >= 0; i--) { const q = flashes[i]; q.life -= 1 / 60; if (q.life <= 0) { flashes.splice(i, 1); continue; } tr.quad([q.x, q.y - 0.3, q.z - 0.3], [q.x, q.y - 0.3, q.z + 0.3], [q.x, q.y + 0.3, q.z + 0.3], [q.x, q.y + 0.3, q.z - 0.3], [0, 0, 0], [3, 3, 3, 0.9]); }
    }
    function drawWeather(dt, now) {
      // breath in the cold: small puffs at the facemask every few seconds
      if (WX === 'snow' && phase !== 'box') {
        for (const p of everyone) { if (!p.bones || p.rag) continue; if (crand() < dt * 0.35) { const m = p.bones[B.head], hp = mPt(m, 0, 0.12 * p.lk.hs, 0.22 * p.lk.hs); breaths.push({ x: hp[0], y: hp[1], z: hp[2], vx: Math.sin(p.h) * 0.6, vz: Math.cos(p.h) * 0.6, t: 0 }); } }
        for (let i = breaths.length - 1; i >= 0; i--) { const q = breaths[i]; q.t += dt; if (q.t > 1.2) { breaths.splice(i, 1); continue; } q.x += q.vx * dt; q.z += q.vz * dt; q.y += 0.25 * dt; const r = 0.08 + q.t * 0.22, a = 0.28 * (1 - q.t / 1.2); tr.quad([q.x - r, q.y - r, q.z], [q.x + r, q.y - r, q.z], [q.x + r, q.y + r, q.z], [q.x - r, q.y + r, q.z], [0, 0, 0], [0.9, 0.92, 0.95, a]); }
      }
      if (!WXN) return;
      const cx = cam.c[0] * 0.5 + cam.e[0] * 0.5, cz = cam.c[2] * 0.5 + cam.e[2] * 0.5, rain = WX === 'rain', d = Math.min(dt, 0.05);
      for (const q of wxp) {
        q.y -= (rain ? 22 : 2.0) * q.s * d; q.x += (rain ? 1.6 : Math.sin(now + q.s * 9) * 0.9) * d; if (!rain) q.z += Math.cos(now * 0.7 + q.w * 7) * 0.4 * d;
        if (q.y < 0) { q.y += 14; q.x = (crand() - 0.5) * 30; q.z = (crand() - 0.5) * 30; }
        const x = cx + q.x, z = cz + q.z;
        if (rain) tr.streak(x, q.y, z, 0.32 * q.s, 0.011, [0.7, 0.75, 0.85, 0.22 + 0.2 * q.w]);
        else { const r = 0.05 + 0.04 * q.w; tr.quad([x - r, q.y - r, z], [x + r, q.y - r, z], [x + r, q.y + r, z], [x - r, q.y + r, z], [0, 0, 0], [1.2, 1.2, 1.25, 0.85]); }
      }
      if (rain && phase !== 'box') for (let i = 0; i < 24; i++) { const x = cam.c[0] + (crand() - 0.5) * 24, z = cam.c[2] + (crand() - 0.5) * 24; tr.ring(x, z, 0.04 + crand() * 0.1, 0.1 + crand() * 0.12, [0.8, 0.85, 0.95, 0.25], 0.03, 8); }
    }

    // ---------- floating name tags ----------
    const tags = {}, tagKeys = ['X', 'Z', 'S', 'Y', 'RB'];
    for (const k of tagKeys) {
      const q = SQ[k], t = el('button', 'bz-tag hide', `<i>${esc(String(q.num))}</i>${faceHTML(q)}<span>${esc(shortName(q.name))}</span><em></em>`); t.type = 'button';
      t.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (phase === 'pre') cycleHot(k); });
      tagL.appendChild(t); tags[k] = t;
    }
    const carTag = el('div', 'bz-tag car hide', ''); tagL.appendChild(carTag);
    function hideTags() { for (const k in tags) tags[k].classList.add('hide'); carTag.classList.add('hide'); }
    function setTag(t, s, show) {
      if (!show || !s || s[0] < -40 || s[0] > cssW + 40 || s[1] < 30 || s[1] > cssH - 20) { t.classList.add('hide'); return; }
      t.classList.remove('hide');
      const hw = (t.offsetWidth || 60) / 2 + 4;
      t.style.left = clamp(s[0], hw, cssW - hw).toFixed(1) + 'px'; t.style.top = s[1].toFixed(1) + 'px';
    }
    function unstackTags() {
      const r = tagKeys.map((k) => tags[k]).filter((t) => !t.classList.contains('hide')).map((t) => ({ t, x: parseFloat(t.style.left) || 0, y: parseFloat(t.style.top) || 0, w: t.offsetWidth || 60, h: t.offsetHeight || 26 }));
      if (r.length < 2) return;
      r.sort((a, b) => b.y - a.y);
      for (let pass = 0; pass < 3; pass++) for (let i = 1; i < r.length; i++) for (let j = 0; j < i; j++) {
        const a = r[j], b = r[i];
        if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && b.y > a.y - a.h - 3 && b.y - b.h < a.y + 3) { b.y = a.y - a.h - 3; b.t.style.top = b.y.toFixed(1) + 'px'; }
      }
    }
    function updTags() {
      const pre = phase === 'pre' && !sheetOpen && intro <= 0, aiming = phase === 'live' && mode === 'aim';
      tagL.classList.toggle('live', phase !== 'pre');
      for (const k of tagKeys) {
        const p = OK[k], t = tags[k];
        const show = p && ((pre && (p.R || hot[k])) || (aiming && p.R && !(p.blk === 'chip' && tPlay < p.R.blk)) || (phase === 'live' && mode === 'catch' && p === ctrl));
        setTag(t, show ? project(p.x, 2.7 * p.lk.hs + p.jumpY, p.z) : null, show);
        if (!show) continue;
        const c = aiming ? sepClass(sepOf(p)) : mode === 'catch' ? 'tgt' : '';
        const cls = 'bz-tag' + (c ? ' ' + c : '') + (aiming ? ' small' : '');
        if (t.className !== cls) t.className = cls;
        const em = pre && hot[k] ? ROUTE_NAMES[hot[k]] : mode === 'catch' ? '▼' : '';
        const e2 = t.querySelector('em'); if (e2.textContent !== em) e2.textContent = em;
      }
      if (pre) unstackTags();
      const showC = carrier && carrier.side === 0 && (phase === 'live' || phase === 'dead') && !closeP && mode !== 'catch' && !carrier.rag;
      if (showC && carTag.dataset.k !== carrier.key) { carTag.dataset.k = carrier.key; carTag.innerHTML = faceHTML(carrier.sq) + `<span>${esc(carrier.sq ? carrier.sq.name : '')}</span>`; }
      setTag(carTag, showC && carrier.sq ? project(carrier.x, 2.7 * carrier.lk.hs + carrier.jumpY, carrier.z) : null, showC && !!carrier.sq);
      if (mvBtns && ctrl) for (const k in mvBtns) { const cd = ctrl.mvCd[k] || 0, tot = moveCd(ctrl, k) || 1; mvBtns[k].classList.toggle('cool', cd > 0); mvBtns[k].style.setProperty('--cd', ((1 - Math.max(0, cd) / tot) * 100).toFixed(0) + '%'); }
      updSprint();
    }

    // ---------- sideline life: officials who signal, the chain crew on the real spots, benches, coaches ----------
    const extras = [];
    const chain = { los: 25, fd: 35, down: 1 };
    const ORANGE = [1, 0.45, 0.08, 1], POLE = [0.95, 0.5, 0.1, 1];
    function mkExtra(side, role, x, z, o) {
      const p = mkP(side, role, 'X' + extras.length, x, z, Object.assign({ v: 3, spd: 40 }, o || {}));
      p.extra = true; p.pose = o && o.pose || 'idle'; p.h = o && o.h != null ? o.h : (x < 0 ? Math.PI / 2 : -Math.PI / 2);
      p.lk = Object.assign({}, p.lk, { cleat: side === 2 ? CLEATS.black : TEAM2, visor: false, sleeves: false, tone: null });
      if (side === 2) p.lk.cleat = hex('#111111');
      p.towel = false; p.face = -1; p.ncell = -1; p.nmcell = -1; p.num = 0;
      extras.push(p);
      return p;
    }
    function setupExtras() {
      if (extras.length || quality < 1) return;
      // officials (white hat referee behind the offense, umpire, two wings)
      mkExtra(2, 'REF', 4, 15, { key: 'R', pose: 'idle' }).ref = 'R';
      mkExtra(2, 'REF', -3, 32, { key: 'U', pose: 'idle' }).ref = 'U';
      mkExtra(2, 'REF', -HW - 0.8, 25, { key: 'HL', pose: 'idle' }).ref = 'HL';
      mkExtra(2, 'REF', HW + 0.8, 25, { key: 'LJ', pose: 'idle' }).ref = 'LJ';
      // chain crew on the far sideline
      for (const k of ['box', 'c0', 'c1']) mkExtra(2, 'REF', HW + 2.9, 25, { key: k, pose: 'idle' }).crew = k;
      // benches: seated and standing players, coaches with headsets
      for (const s of [-1, 1]) {
        const side = s < 0 ? 0 : 1, bx = s * 30.6;
        for (let i = 0; i < 7; i++) { const role = ['OL', 'WR', 'LB', 'DL', 'RB', 'TE', 'CB'][i]; const p = mkExtra(side, role, bx, 36 + i * 4.1 + crand() * 0.8, { pose: 'sit', h: s < 0 ? Math.PI / 2 : -Math.PI / 2 }); p.num = 10 + ((i * 17 + (side ? 3 : 0)) % 80); p.ncell = numCell(p.num); }
        for (let i = 0; i < 4; i++) { const role = ['WR', 'DL', 'QB', 'S'][i]; const p = mkExtra(side, role, s * (29.2 + crand() * 0.8), 40 + i * 6.5 + crand() * 2, { pose: 'idle', h: s < 0 ? Math.PI / 2 : -Math.PI / 2 }); p.num = 2 + ((i * 23 + (side ? 5 : 0)) % 90); p.ncell = numCell(p.num); if (i === 1) p.towel = true; }
        for (let i = 0; i < 2; i++) mkExtra(side, 'COACH', s * 28.4, 44 + i * 12, { pose: 'idle', h: s < 0 ? Math.PI / 2 : -Math.PI / 2 }).coach = true;
      }
      for (const p of extras) { p.ph = crand() * 6; p.body = BODY[p.role] || BODY.WR; }
    }
    function steerExtra(p, tx, tz, v, dt, faceTo) {
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { const sp = Math.min(v, d * 2.5); p.vx = dx / d * sp; p.vz = dz / d * sp; p.h = Math.atan2(dx, dz); }
      else { p.vx *= Math.pow(0.02, dt); p.vz *= Math.pow(0.02, dt); if (faceTo) p.h += angDiff(faceTo, p.h) * Math.min(1, dt * 4); }
      p.x += p.vx * dt; p.z += p.vz * dt;
    }
    function extrasStep(dt) {
      if (!extras.length) return;
      // the chains walk to the new spots between plays
      const k = Math.min(1, dt * 1.4);
      const tl = los, tf = fdz < 100 ? fdz : los + 10;
      chain.los += (tl - chain.los) * k; chain.fd += (tf - chain.fd) * k;
      const pre = phase === 'pre' || phase === 'break' || phase === 'cpu' || phase === 'splash';
      const bx = ball ? ball.x : 0, bz = ball ? ball.z : los;
      for (const p of extras) {
        if (p.ref) {
          let tx = p.x, tz = p.z, face = null;
          if (p.ref === 'R') { tx = pre || phase === 'live' ? 5.5 : bx + 3; tz = pre ? los - 13 : phase === 'live' ? Math.min(p.z, (OK.QB ? OK.QB.z : los) - 6) : bz - 4; face = 0; }
          else if (p.ref === 'U') { tx = -2.5; tz = pre ? los + 5.5 : phase === 'live' ? Math.max(p.z, bz + 3) : bz + 2; face = Math.PI; }
          else if (p.ref === 'HL') { tx = -HW - 0.9; tz = pre ? los : phase === 'live' ? bz : bz; face = Math.PI / 2; }
          else { tx = HW + 0.9; tz = pre ? los : bz; face = -Math.PI / 2; }
          if (phase === 'dead' && (p.ref === 'R' || p.ref === 'HL' || p.ref === 'LJ')) {
            const sig = playRes === 'td' || playRes === 'krtd' || playRes === 'pick6' ? 'sigtd' : playRes === 'inc' ? 'siginc' : (playRes === 'first' ? 'sigfirst' : null);
            if (sig && deadTot - deadT > 0.45) { if (p.pose !== sig) setPose(p, sig); p.vx = p.vz = 0; p.h += angDiff(p.ref === 'R' ? Math.PI : (p.ref === 'HL' ? Math.PI / 2 : -Math.PI / 2), p.h) * Math.min(1, dt * 5); continue; }
          } else if (p.pose !== 'idle') setPose(p, 'idle');
          steerExtra(p, tx, tz, 4.2, dt, face);
          p.look = ball ? [bx, Math.max(0.5, ball.y || 1), bz] : null;
        } else if (p.crew) {
          const zx = p.crew === 'box' ? chain.los : p.crew === 'c0' ? chain.fd - 10 : chain.fd;
          steerExtra(p, HW + 2.9, zx + 0.45, 3.5, dt, -Math.PI / 2);
          if (p.pose !== 'idle') setPose(p, 'idle');
          p.look = [bx, 1, bz];
        } else {
          // bench: coaches and standing players watch the ball; a few stand up on big plays
          p.look = [bx, 1.2, bz];
          if (p.pose === 'idle' && excite > 0.85 && p.celType == null) { p.celType = (crand() * 4) | 0; p.celAt2 = 2.5; setPose(p, 'celebrate'); }
          if (p.celAt2 > 0) { p.celAt2 -= dt; if (p.celAt2 <= 0) { p.celType = null; setPose(p, 'idle'); } }
        }
      }
      for (const p of extras) animUpdate(p, dt);
    }
    // down marker and chains as geometry held by the crew
    function drawExtrasProps() {
      const live = phase === 'pre' || phase === 'live' || phase === 'dead' || phase === 'splash' || phase === 'pat';
      const scrim = live && !(kick && kick.type === 'ko') && phase !== 'pat' && !tryMode;
      if (!scrim) return;
      const sx = HW + 2.9;
      const pole = (z, hgt, top) => { dyn.box(IDM, sx, hgt / 2, z, 0.07, hgt, 0.07, POLE); if (top) dyn.box(IDM, sx, hgt + 0.22, z, 0.42, 0.44, 0.07, ORANGE); else dyn.box(IDM, sx, hgt + 0.1, z, 0.22, 0.2, 0.22, ORANGE); };
      pole(chain.los, 2.1, true);
      if (fdz < 100) { pole(chain.fd - 10, 2.0, false); pole(chain.fd, 2.0, false); tr.seg(sx + 0.05, chain.fd - 10, sx + 0.05, chain.fd, 0.035, [0.8, 0.8, 0.82, 0.95], 0.75); }
      // the crew's hands on the poles
      for (const p of extras) {
        if (!p.crew || !p.bones) continue;
        const z = p.crew === 'box' ? chain.los : p.crew === 'c0' ? chain.fd - 10 : chain.fd;
        p.reach = [sx, 1.35 * p.lk.hs, z];
      }
    }
    // =====================================================================================
    // Card effects in the game: every card variant and every set maps to a look built from a small library of primitives:
    // helmet props (small procedural meshes, lit, cast shadows), particle emitters that follow the player (sprites from a
    // procedural atlas), kit / material looks in the skin shader (uFx modes), glow shells and head / body tweaks.
    // Rarer parallels (and rarer variants) get bigger, brighter versions. Budgets: per player and global, smaller at LOW.
    // =====================================================================================
    // shader looks (FS_SKIN uFx.x)
    const LOOK = { sepia: 1, cardboard: 2, chalk: 3, blueprint: 4, glass: 5, metal: 6, holo: 7, pixel: 8, glitch: 9, rainbow: 10, muscle: 11, void: 12, prism: 13, gray: 14, negative: 15, neon: 16, vhs: 17, ice: 18, glint: 19 };
    const C3 = (h) => { const c = hex(h); return [c[0], c[1], c[2]]; };
    // recipe: p prop, e [emitter...] (kind[:rate]), l look, c look colour, o glow shell colour, b bobble, m body tweak
    const FXV = {
      base: { e: ['dust'] }, team: { e: ['teamspark'] }, silver: { l: 'metal', c: '#cfd6e0', e: ['sparkle:silver'] }, action: { e: ['streak'] },
      'spec-td': { e: ['flame'], o: '#ff7a1a' }, 'spec-pass': { e: ['handspark'] }, 'spec-int': { e: ['glove'] }, 'spec-def': { e: ['steam'] }, 'spec-play': { e: ['star'] },
      gold: { l: 'metal', c: '#ffcc33', e: ['sparkle:gold'] }, holo: { l: 'prism', e: ['sparkle:holo'] }, spec: { p: 'star', e: ['sparkle:gold'], o: '#ffd23f' },
      legend: { p: 'halo', l: 'metal', c: '#ffcc33', e: ['sparkle:gold'] }, allstar: { p: 'star', e: ['star'] }, clutch: { e: ['snow:ice'], o: '#7fd8ff', l: 'ice' },
      icon: { p: 'crown', e: ['sparkle:gold'], o: '#ffe680' }, bench: { e: ['zzz'] }, trophy: { p: 'trophy' }, pizza: { p: 'pizza' }, cutout: { l: 'cardboard' },
      bobble: { b: 1 }, pixel: { l: 'pixel', e: ['pixel'] }, snow: { p: 'snowflake', e: ['snow'] }, upside: { l: 'negative', e: ['qmark'] }, duck: { p: 'duck' },
      built: { l: 'muscle', c: '#ff5a1f', m: 'built', e: ['steam'] }, throwback: { l: 'sepia' }, spooky: { p: 'pumpkin', e: ['wisp'] }, glitch: { l: 'glitch', e: ['glitch'], g: 1 },
      goat: { p: 'crown', l: 'metal', c: '#ffcc33', e: ['sparkle:gold', 'star'], o: '#ffd23f' }, mythic: { e: ['star:purple'], o: '#b45cff', l: 'prism' },
      dark: { l: 'void', c: '#7b2cff', e: ['void'] }, doh: { p: 'crown', l: 'metal', c: '#ffcc33', e: ['coin', 'sparkle:gold'], o: '#ffe066', b: 1 },
      // body-type cards (their build comes through look.build; these add a small tell)
      skinny: { e: ['streak'] }, heavy: { e: ['thump'] }, tall: { e: ['chevron'] }, short: { e: ['sparkle:silver'] }, beanpole: { e: ['streak', 'chevron'] },
      stout: { e: ['thump'] }, giant: { e: ['thump', 'chevron'] }, pocket: { e: ['sparkle:holo'] },
    };
    const FXS = {
      'picture-day': { e: ['flash'] }, 'hall-pass': { p: 'ticket' }, 'gym-class': { p: 'dodgeball', e: ['sweat'] }, 'science-fair': { p: 'beaker', e: ['bubble:green'] },
      library: { p: 'book', e: ['qmark'] }, 'bus-ride': { e: ['exhaust'] },
      'pajama-day': { p: 'nightcap', e: ['zzz'] }, 'crazy-hair': { p: 'hair' }, 'twin-day': { e: ['echo'] }, 'pep-rally': { e: ['confetti', 'note'] }, homecoming: { p: 'crown', e: ['confetti'] },
      'color-war': { e: ['splat:team'] },
      halloween: { p: 'pumpkin', e: ['ember'] }, turkey: { p: 'turkey' }, christmas: { p: 'santa', e: ['snow'] }, spring: { e: ['petal'] }, super: { p: 'trophy', e: ['confetti:gold'] },
      'new-year': { e: ['firework'] },
      galaxy: { e: ['star'], l: 'void', c: '#6c5cff' }, ocean: { e: ['bubble'] }, jungle: { e: ['leaf'] }, volcano: { e: ['ember'], o: '#ff4a00' }, arctic: { e: ['snow'], l: 'ice' },
      desert: { e: ['sand'] },
      chalkboard: { l: 'chalk', o: '#eafff2' }, blueprint: { l: 'blueprint' }, comic: { e: ['pow', 'splat:ink'] }, graffiti: { e: ['splat:paint'] }, 'stained-glass': { l: 'glass' },
      origami: { p: 'crane' },
      neon: { l: 'neon', c: '#ff4fe0', o: '#ff4fe0' }, 'pixel-plus': { l: 'pixel', e: ['pixel'] }, 'high-score': { e: ['coin', 'pixel'] }, circuit: { l: 'glint', c: '#33ff99', e: ['spark:green'] },
      hologram: { l: 'holo', o: '#55e6ff' }, vhs: { l: 'vhs', e: ['static'] },
      thunder: { e: ['bolt'] }, 'rainy-day': { p: 'cloud', e: ['rain'] }, sunshine: { p: 'sun', e: ['sparkle:gold'] }, tornado: { e: ['swirl'] }, rainbow: { e: ['rainbow'], l: 'rainbow' },
      blizzard: { p: 'snowflake', e: ['snow', 'snow'] },
      cereal: { p: 'cereal' }, nachos: { p: 'nacho' }, donut: { p: 'donut' }, 'hot-sauce': { p: 'hotsauce', e: ['ember'] }, popcorn: { p: 'popcorn', e: ['kernel'] },
      smoothie: { p: 'smoothie' },
      highlight: { e: ['flash', 'sparkle:gold'] }, 'film-room': { l: 'gray', e: ['static'] }, playbook: { l: 'chalk', e: ['xo'] }, captains: { p: 'star', e: ['sparkle:gold'] },
      'all-mfl': { p: 'star', e: ['star'] }, 'hall-of-fame': { p: 'halo', l: 'metal', c: '#ffcc33', o: '#ffe680' },
    };
    const PAR_K = { base: 0.55, silver: 0.75, gold: 0.95, prism: 1.2, black: 1.45 };
    const RAR_K = { common: 0.55, rare: 0.75, epic: 0.95, legendary: 1.2, mythic: 1.45, dark: 1.5, doh: 1.8 };
    // what a card does in the game
    function fxRecipe(fx) {
      if (!fx) return null;
      let r = null, k = RAR_K[fx.rarity] || 0.6;
      if (fx.set) {
        r = Object.assign({}, FXS[fx.set] || { e: ['sparkle'] });
        k = PAR_K[fx.par] || k;
        // parallels: silver / gold / black chrome on the kit, prism shimmer, plus the set's own look
        // a set with its own kit look keeps it; its silver / gold parallel adds a matching glint instead
        if (fx.par === 'silver') { if (!r.l) { r.l = 'metal'; r.c = '#cfd6e0'; } else r.e = (r.e || []).concat(['sparkle:silver']); }
        if (fx.par === 'gold') { if (!r.l) { r.l = 'metal'; r.c = '#ffcc33'; } else r.e = (r.e || []).concat(['sparkle:gold']); }
        if (fx.par === 'black' && !r.l) { r.l = 'metal'; r.c = '#26222e'; }
        if (fx.par === 'prism') { if (!r.l) r.l = 'prism'; r.e = (r.e || []).concat(['sparkle:holo']); }
        if (fx.par === 'black') { r.e = (r.e || []).concat(['sparkle:gold']); if (!r.o) r.o = '#ffd23f'; }
      } else {
        const v = String(fx.variant || '');
        r = FXV[v] || (v.indexOf('spec-') === 0 ? FXV['spec-play'] : null);
        if (v === 'spec' && fx.spec && FXV['spec-' + fx.spec]) r = Object.assign({}, FXV['spec-' + fx.spec], { p: 'star', o: '#ffd23f' });
        if (!r) r = { e: [k >= 1.2 ? 'star' : k >= 0.9 ? 'sparkle:gold' : 'sparkle'] }; // a card we have never heard of: a rarity-sized sparkle
        r = Object.assign({}, r);
      }
      r.k = k;
      return r;
    }
    // ---------- props: shapes built once in a local frame (origin on top of the helmet, y up, z forward), drawn per frame into dyn ----------
    const PROPS = {};
    const pb = new Batch(2000);
    function lathe(prof, segs, c, y0, mod, ox, oz) { // revolve [[r, y], ...] around a vertical axis at (ox, oz)
      for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < segs; j++) {
        const a0 = j / segs * 6.2832, a1 = (j + 1) / segs * 6.2832, [r0, y0a] = prof[i], [r1, y1] = prof[i + 1];
        const m0 = mod ? mod(a0) : 1, m1 = mod ? mod(a1) : 1, ny = -(r1 - r0), nr = y1 - y0a, nl = Math.hypot(ny, nr) || 1;
        const P = (r, y, a, m) => [(ox || 0) + Math.cos(a) * r * m, y + (y0 || 0), (oz || 0) + Math.sin(a) * r * m], N = (a) => [Math.cos(a) * nr / nl, ny / nl, Math.sin(a) * nr / nl];
        const A = P(r0, y0a, a0, m0), Bq = P(r0, y0a, a1, m1), Cq = P(r1, y1, a1, m1), D = P(r1, y1, a0, m0), na = N(a0), nb = N(a1);
        for (const [v, n] of [[A, na], [D, na], [Cq, nb], [A, na], [Cq, nb], [Bq, nb]]) pb.v(v[0], v[1], v[2], n[0], n[1], n[2], c, 0.5, 0.5);
      }
    }
    const ell = (x, y, z, rx, ry, rz, c, s) => pb.ellipsoid(mT(IDM, x, y, z), rx, ry, rz, c, s || 8, 6);
    const bx = (x, y, z, sx, sy, sz, c, ry, rx, rz) => { let m = mT(IDM, x, y, z); if (ry) m = mRY(m, ry); if (rx) m = mRX(m, rx); if (rz) m = mRZ(m, rz); pb.box(m, 0, 0, 0, sx, sy, sz, c); };
    function torus(R, r, c, y, segs) { for (let j = 0; j < segs; j++) { const a = j / segs * 6.2832; ell(Math.cos(a) * R, y, Math.sin(a) * R, r, r, r, c, 5); } }
    function prism3(pts, h, c, y) { // a flat triangle slab (x,z points) of thickness h
      const top = pts.map((p) => [p[0], y + h, p[1]]), bot = pts.map((p) => [p[0], y, p[1]]);
      pb.quad(top[0], top[1], top[2], top[2], [0, 1, 0], c); pb.quad(bot[0], bot[2], bot[1], bot[1], [0, -1, 0], c);
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3, ex = top[j][0] - top[i][0], ez = top[j][2] - top[i][2], l = Math.hypot(ex, ez) || 1; pb.quad(bot[i], bot[j], top[j], top[i], [ez / l, 0, -ex / l], c); }
    }
    function star5(R, r, th, c, y, upright) {
      const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 + Math.PI / 2, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      for (let i = 0; i < 10; i++) { const p = pts[i], q = pts[(i + 1) % 10]; const T = (a) => (upright ? [a[0], y + a[1] + R, 0] : [a[0], y, a[1]]); const o = T([0, 0]), A = T(p), Bq = T(q), f = upright ? [0, 0, th] : [0, th, 0];
        pb.quad(v3a(o, f), v3a(A, f), v3a(Bq, f), v3a(Bq, f), upright ? [0, 0, 1] : [0, 1, 0], c); pb.quad(o, Bq, A, A, upright ? [0, 0, -1] : [0, -1, 0], c); }
    }
    // tilt everything built since n0 about the X axis (props that should face the camera)
    function tilt(n0, a) { const c = Math.cos(a), sn = Math.sin(a), f = pb.f; for (let i = n0; i < pb.n; i++) { const o = i * 12; for (const k of [0, 3]) { const y = f[o + k + 1], z = f[o + k + 2]; f[o + k + 1] = y * c - z * sn; f[o + k + 2] = y * sn + z * c; } f[o + 1] += 0.06; } }
    const COLS = { gold: [1, 0.78, 0.2, 1], red: [0.85, 0.12, 0.1, 1], white: [0.95, 0.95, 0.92, 1], black: [0.06, 0.06, 0.07, 1], yellow: [1, 0.86, 0.15, 1], orange: [1, 0.48, 0.08, 1], green: [0.15, 0.6, 0.2, 1], brown: [0.45, 0.26, 0.12, 1], pink: [1, 0.55, 0.75, 1], blue: [0.2, 0.45, 0.95, 1], cream: [1, 0.93, 0.7, 1], gem: [0.2, 0.5, 1, 1] };
    const SHAPES = {
      pizza: () => { const n0 = pb.n; prism3([[-0.15, -0.07], [0.15, -0.07], [0, 0.24]], 0.025, COLS.yellow, 0.005); bx(0, 0.025, -0.075, 0.32, 0.045, 0.05, COLS.brown); for (const [x, z] of [[-0.03, 0.0], [0.035, 0.03], [0, 0.08]]) lathe([[0.034, 0.03], [0.034, 0.035], [0, 0.035]], 8, COLS.red, 0, null, x * 1.35, z * 1.35); tilt(n0, -1.1); }, // a slice stuck on the helmet like a fin: point up, toppings to the back (the game camera sits behind)
      duck: () => { ell(0, 0.07, -0.01, 0.1, 0.07, 0.12, COLS.yellow); ell(0, 0.16, 0.06, 0.06, 0.06, 0.06, COLS.yellow); bx(0, 0.15, 0.13, 0.05, 0.02, 0.05, COLS.orange); for (const s of [-1, 1]) ell(s * 0.035, 0.18, 0.1, 0.012, 0.012, 0.012, COLS.black, 5); ell(0, 0.1, -0.12, 0.04, 0.03, 0.04, COLS.yellow, 6); },
      trophy: () => { lathe([[0.05, 0], [0.05, 0.02], [0.015, 0.03], [0.015, 0.08], [0.03, 0.09], [0.08, 0.15], [0.085, 0.2], [0.07, 0.2], [0, 0.12]], 10, COLS.gold); for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = -1.3 + i * 0.52; ell(s * (0.085 + Math.cos(a) * 0.035), 0.15 + Math.sin(a) * 0.035, 0, 0.011, 0.011, 0.011, COLS.gold, 4); } },
      crown: () => { lathe([[0.11, 0], [0.11, 0.06], [0.1, 0.06], [0.1, 0]], 12, COLS.gold); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; lathe([[0.026, 0], [0, 0.075]], 5, COLS.gold, 0.055, null, Math.cos(a) * 0.105, Math.sin(a) * 0.105); ell(Math.cos(a + 0.52) * 0.112, 0.03, Math.sin(a + 0.52) * 0.112, 0.014, 0.014, 0.014, i % 2 ? COLS.red : COLS.gem, 5); } },
      pumpkin: () => { lathe([[0, 0], [0.09, 0.02], [0.13, 0.07], [0.12, 0.13], [0.06, 0.17], [0, 0.17]], 14, COLS.orange, 0, (a) => 1 + 0.08 * Math.cos(a * 8)); bx(0, 0.2, 0, 0.025, 0.06, 0.025, COLS.green); },
      snowflake: () => { for (let i = 0; i < 3; i++) bx(0, 0.13, 0, 0.26, 0.022, 0.012, [0.85, 0.95, 1.2, 1], 0, 0, i * Math.PI / 3); ell(0, 0.13, 0, 0.03, 0.03, 0.015, [0.9, 1, 1.3, 1], 6); bx(0, 0.02, 0, 0.02, 0.06, 0.02, [0.8, 0.9, 1, 1]); },
      cereal: () => { lathe([[0, 0], [0.06, 0], [0.11, 0.05], [0.12, 0.09], [0.11, 0.09], [0.05, 0.02], [0, 0.02]], 12, COLS.white); lathe([[0, 0.07], [0.105, 0.07]], 12, [0.98, 0.97, 0.92, 1]); for (let i = 0; i < 7; i++) { const a = i * 2.3; ell(Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06, 0.018, 0.012, 0.018, [COLS.red, COLS.yellow, COLS.green, COLS.orange, COLS.pink][i % 5], 5); } },
      nacho: () => { lathe([[0.2, 0], [0.2, 0.012], [0.08, 0.02], [0.07, 0.12], [0.03, 0.15], [0, 0.15]], 14, COLS.yellow); torus(0.2, 0.012, COLS.orange, 0.012, 12); prism3([[-0.05, 0.12], [0.05, 0.12], [0, 0.22]], 0.012, [1, 0.75, 0.25, 1], 0.03); },
      donut: () => { torus(0.075, 0.045, [0.8, 0.55, 0.3, 1], 0.05, 12); torus(0.075, 0.04, COLS.pink, 0.065, 12); for (let i = 0; i < 8; i++) { const a = i * 0.8; bx(Math.cos(a) * 0.08, 0.1, Math.sin(a) * 0.08, 0.02, 0.008, 0.008, [COLS.yellow, COLS.blue, COLS.white, COLS.green][i % 4], a); } },
      hotsauce: () => { lathe([[0.045, 0], [0.045, 0.14], [0.02, 0.18], [0.015, 0.22], [0, 0.22]], 10, COLS.red); lathe([[0.017, 0.22], [0.017, 0.26], [0, 0.26]], 8, COLS.white); lathe([[0.047, 0.05], [0.047, 0.1]], 10, COLS.cream); },
      popcorn: () => { lathe([[0.05, 0], [0.085, 0.18], [0, 0.18]], 12, COLS.white, 0, (a) => 1 + 0.02 * Math.sign(Math.sin(a * 6))); lathe([[0.051, 0.0], [0.086, 0.18]], 6, COLS.red); for (let i = 0; i < 9; i++) { const a = i * 2.1, r = 0.04 + (i % 3) * 0.015; ell(Math.cos(a) * r, 0.19 + (i % 2) * 0.02, Math.sin(a) * r, 0.022, 0.02, 0.022, COLS.cream, 5); } },
      crane: () => { prism3([[-0.16, 0], [0.16, 0], [0, 0.06]], 0.006, COLS.white, 0.1); prism3([[-0.03, -0.12], [0.03, -0.12], [0, 0.14]], 0.04, COLS.pink, 0.06); prism3([[-0.01, 0.12], [0.01, 0.12], [0, 0.22]], 0.06, COLS.pink, 0.08); },
      turkey: () => { ell(0, 0.08, 0, 0.09, 0.075, 0.1, COLS.brown); ell(0, 0.15, 0.08, 0.035, 0.04, 0.035, [0.6, 0.35, 0.2, 1], 6); bx(0, 0.15, 0.12, 0.02, 0.015, 0.03, COLS.orange); ell(0, 0.13, 0.11, 0.012, 0.03, 0.012, COLS.red, 5); for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; bx(Math.sin(a) * 0.1, 0.16 + Math.cos(a) * 0.08, -0.1, 0.05, 0.16, 0.012, [COLS.red, COLS.orange, COLS.yellow, COLS.brown][i % 4], 0, 0.3); } },
      santa: () => { lathe([[0.15, 0.0], [0.1, 0.12], [0.05, 0.22], [0.0, 0.26]], 12, COLS.red); torus(0.15, 0.03, COLS.white, 0.01, 14); ell(0.03, 0.27, -0.06, 0.035, 0.035, 0.035, COLS.white, 6); },
      gradcap: () => { lathe([[0.1, 0], [0.1, 0.05], [0, 0.05]], 10, COLS.black); bx(0, 0.06, 0, 0.3, 0.015, 0.3, COLS.black, 0.785); bx(0.1, 0.02, 0.1, 0.01, 0.09, 0.01, COLS.yellow); },
      star: () => { star5(0.11, 0.045, 0.03, COLS.gold, 0.03, true); bx(0, 0.02, 0, 0.02, 0.05, 0.02, COLS.gold); },
      halo: () => { torus(0.13, 0.016, [1.3, 1.05, 0.4, 1], 0.12, 18); },
      ticket: () => { bx(0, 0.1, 0, 0.18, 0.11, 0.01, COLS.yellow, 0.2); bx(0, 0.1, 0.007, 0.12, 0.012, 0.005, COLS.black, 0.2); },
      dodgeball: () => { ell(0, 0.1, 0, 0.1, 0.1, 0.1, [0.85, 0.15, 0.15, 1], 10); },
      beaker: () => { lathe([[0, 0], [0.09, 0.0], [0.09, 0.02], [0.03, 0.14], [0.03, 0.2], [0.035, 0.2], [0, 0.2]], 10, [0.75, 0.9, 1, 1]); lathe([[0, 0.02], [0.085, 0.02], [0.05, 0.08], [0, 0.08]], 10, [0.3, 1.3, 0.4, 1]); },
      book: () => { bx(0, 0.04, 0, 0.2, 0.05, 0.15, COLS.blue, 0.3); bx(0.004, 0.04, 0, 0.19, 0.04, 0.152, COLS.cream, 0.3); },
      nightcap: () => { lathe([[0.15, 0], [0.12, 0.1], [0.06, 0.2], [0, 0.24]], 10, [0.35, 0.45, 0.9, 1]); lathe([[0.135, 0.06], [0.11, 0.12]], 10, COLS.white); ell(0, 0.25, -0.08, 0.035, 0.035, 0.035, COLS.white, 6); },
      hair: () => { const cs = [COLS.pink, COLS.blue, COLS.green, COLS.yellow, COLS.orange]; for (let i = 0; i < 10; i++) { const a = i * 0.63; const m = mRX(mRY(mT(IDM, Math.cos(a) * 0.07, 0.0, Math.sin(a) * 0.07), a), 0.5 * Math.cos(i)); pb.box(m, 0, 0.08, 0, 0.025, 0.17, 0.025, cs[i % 5]); } },
      cloud: () => { for (const [x, y, r] of [[0, 0.32, 0.08], [0.08, 0.3, 0.065], [-0.08, 0.3, 0.065], [0.03, 0.37, 0.06]]) ell(x, y, 0, r, r * 0.8, r, [0.8, 0.82, 0.88, 1], 7); },
      sun: () => { ell(0, 0.14, 0, 0.07, 0.07, 0.07, [1.6, 1.2, 0.3, 1], 8); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; bx(Math.cos(a) * 0.11, 0.14 + Math.sin(a) * 0.11, 0, 0.05, 0.016, 0.016, [1.6, 1.0, 0.2, 1], 0, 0, a); } },
      smoothie: () => { lathe([[0.045, 0], [0.06, 0.16], [0, 0.16]], 10, [0.65, 0.95, 0.3, 1]); lathe([[0.062, 0.16], [0.062, 0.175], [0, 0.175]], 10, COLS.white); bx(0.02, 0.23, 0, 0.012, 0.12, 0.012, COLS.pink, 0, 0.25); },
    };
    function propShape(name) {
      if (PROPS[name]) return PROPS[name];
      pb.n = 0; try { SHAPES[name](); } catch (e) { pb.n = 0; }
      return (PROPS[name] = pb.f.slice(0, pb.n * 12));
    }
    function emitProp(name, m, ox, oy, oz, sc) {
      const f = propShape(name), n = f.length / 12; if (!n) return;
      dyn.grow(n); const d = dyn.f;
      for (let i = 0; i < n; i++) {
        const o = i * 12, x = ox + f[o] * sc, y = oy + f[o + 1] * sc, z = oz + f[o + 2] * sc, nx = f[o + 3], ny = f[o + 4], nz = f[o + 5], w = dyn.n * 12;
        d[w] = m[0] * x + m[1] * y + m[2] * z + m[3]; d[w + 1] = m[4] * x + m[5] * y + m[6] * z + m[7]; d[w + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
        d[w + 3] = m[0] * nx + m[1] * ny + m[2] * nz; d[w + 4] = m[4] * nx + m[5] * ny + m[6] * nz; d[w + 5] = m[8] * nx + m[9] * ny + m[10] * nz;
        d[w + 6] = f[o + 6]; d[w + 7] = f[o + 7]; d[w + 8] = f[o + 8]; d[w + 9] = 1; d[w + 10] = 0.5; d[w + 11] = 0.5; dyn.n++;
      }
    }
    // ---------- particle sprites: a 4x4 atlas drawn once ----------
    const SPR = { sparkle: 0, star: 1, heart: 2, note: 3, qmark: 4, snow: 5, leaf: 6, bubble: 7, dot: 8, square: 9, smoke: 10, splat: 11, z: 12, bolt: 13, drop: 14, petal: 15 };
    function spriteCanvas() {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      const cell = (k, f) => { g.save(); g.translate((k % 4) * 64 + 32, Math.floor(k / 4) * 64 + 32); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; f(); g.restore(); };
      const starP = (n, R, r) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.2832 - Math.PI / 2, rr = i % 2 ? r : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); };
      const soft = (r, a) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); };
      cell(0, () => { soft(14, 0.8); starP(4, 30, 5); });
      cell(1, () => { starP(5, 28, 12); });
      cell(2, () => { g.beginPath(); g.moveTo(0, 24); g.bezierCurveTo(-34, 2, -18, -26, 0, -10); g.bezierCurveTo(18, -26, 34, 2, 0, 24); g.fill(); });
      cell(3, () => { g.beginPath(); g.ellipse(-8, 16, 10, 8, -0.4, 0, 6.3); g.fill(); g.fillRect(0, -24, 5, 40); g.beginPath(); g.moveTo(5, -24); g.quadraticCurveTo(22, -16, 16, 0); g.lineTo(13, -2); g.quadraticCurveTo(16, -12, 5, -14); g.fill(); });
      cell(4, () => { g.font = '900 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 3); });
      cell(5, () => { g.lineWidth = 4; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.moveTo(0, -15); g.lineTo(-8, -22); g.moveTo(0, -15); g.lineTo(8, -22); g.stroke(); g.restore(); } });
      cell(6, () => { g.rotate(0.6); g.beginPath(); g.ellipse(0, 0, 12, 26, 0, 0, 6.3); g.fill(); g.globalCompositeOperation = 'destination-out'; g.fillRect(-1, -24, 2, 48); });
      cell(7, () => { g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22, 0, 6.3); g.stroke(); soft(22, 0.25); g.beginPath(); g.arc(-8, -8, 5, 0, 6.3); g.fill(); });
      cell(8, () => { soft(30, 1); });
      cell(9, () => { g.fillRect(-20, -20, 40, 40); });
      cell(10, () => { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); });
      cell(11, () => { g.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832, r = i % 2 ? 12 : 26 + (i % 3) * 3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); });
      cell(12, () => { g.font = '900 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', 0, 3); });
      cell(13, () => { g.beginPath(); g.moveTo(6, -30); g.lineTo(-12, 4); g.lineTo(2, 4); g.lineTo(-6, 30); g.lineTo(14, -6); g.lineTo(0, -6); g.closePath(); g.fill(); });
      cell(14, () => { g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(16, 6, 0, 18); g.quadraticCurveTo(-16, 6, 0, -24); g.fill(); });
      cell(15, () => { g.beginPath(); g.ellipse(0, 0, 10, 22, 0.5, 0, 6.3); g.fill(); });
      return c;
    }
    // ---------- particles ----------
    const fxParts = [], fxAdd = new Batch(3000), fxAlp = new Batch(1500);
    const PBUD = () => (quality >= 2 ? 360 : quality === 1 ? 240 : 80);
    // emitter kinds: sprite, colour, additive?, where (head/hands/feet/body/trail), motion
    const EMIT = {
      dust: { s: 'smoke', c: [0.7, 0.62, 0.5, 0.55], add: 0, at: 'feet', rate: 6, run: 1, life: 0.7, sz: 0.32, vy: 0.5, grow: 1 },
      teamspark: { s: 'sparkle', team: 1, add: 1, at: 'body', rate: 9, life: 0.7, sz: 0.24, vy: 0.3 },
      sparkle: { s: 'sparkle', c: [1.4, 1.4, 1.5, 1], add: 1, at: 'body', rate: 6, life: 0.6, sz: 0.2, vy: 0.4 },
      'sparkle:silver': { s: 'sparkle', c: [1.3, 1.4, 1.6, 1], add: 1, at: 'body', rate: 6, life: 0.6, sz: 0.2, vy: 0.4 },
      'sparkle:gold': { s: 'sparkle', c: [2.0, 1.5, 0.4, 1], add: 1, at: 'body', rate: 7, life: 0.6, sz: 0.22, vy: 0.4 },
      'sparkle:holo': { s: 'sparkle', rainbow: 1, add: 1, at: 'body', rate: 7, life: 0.6, sz: 0.22, vy: 0.4 },
      streak: { s: 'dot', c: [1.5, 1.5, 1.7, 0.7], add: 1, at: 'trail', rate: 18, run: 1, life: 0.3, sz: 0.14, stretch: 1 },
      flame: { s: 'dot', c: [2.2, 0.9, 0.2, 0.8], add: 1, at: 'trail', rate: 16, run: 1, life: 0.35, sz: 0.22, vy: 0.8, shrink: 1 },
      handspark: { s: 'sparkle', c: [1.6, 1.4, 0.6, 1], add: 1, at: 'hands', rate: 8, life: 0.4, sz: 0.12, vy: 0.2 },
      glove: { s: 'dot', c: [0.4, 1.4, 2.0, 0.8], add: 1, at: 'hands', rate: 10, life: 0.35, sz: 0.16 },
      steam: { s: 'smoke', c: [1, 0.9, 0.9, 0.35], add: 0, at: 'head', rate: 4, life: 0.9, sz: 0.2, vy: 0.9, grow: 1 },
      star: { s: 'star', c: [2.0, 1.7, 0.6, 1], add: 1, at: 'body', rate: 4, life: 0.8, sz: 0.18, vy: 0.5, spin: 1 },
      'star:purple': { s: 'star', c: [1.4, 0.6, 2.2, 1], add: 1, at: 'body', rate: 5, life: 0.8, sz: 0.18, vy: 0.5, spin: 1 },
      snow: { s: 'snow', c: [1.3, 1.4, 1.6, 0.9], add: 1, at: 'above', rate: 6, life: 1.4, sz: 0.13, vy: -0.6, spin: 1 },
      'snow:ice': { s: 'snow', c: [0.7, 1.4, 2.0, 0.9], add: 1, at: 'body', rate: 5, life: 1, sz: 0.13, vy: 0.1, spin: 1 },
      zzz: { s: 'z', c: [1.2, 1.2, 1.4, 0.9], add: 0, at: 'head', rate: 1.5, life: 1.6, sz: 0.18, vy: 0.5, idle: 1 },
      pixel: { s: 'square', pal: [[0.3, 1.6, 0.4], [1.6, 1.4, 0.2], [0.3, 0.8, 1.8], [1.8, 0.3, 0.6]], add: 1, at: 'body', rate: 9, life: 0.6, sz: 0.09, vy: 0.2 },
      qmark: { s: 'qmark', c: [1.4, 1.3, 0.5, 1], add: 0, at: 'head', rate: 1.6, life: 1.3, sz: 0.2, vy: 0.4, idle: 1 },
      wisp: { s: 'smoke', c: [0.4, 1.6, 0.6, 0.5], add: 1, at: 'body', rate: 5, life: 0.9, sz: 0.22, vy: 0.5, grow: 1 },
      glitch: { s: 'square', pal: [[1.8, 0.1, 1.2], [0.1, 1.6, 1.8], [1.5, 1.5, 1.5]], add: 1, at: 'body', rate: 12, life: 0.15, sz: 0.14, jit: 1 },
      void: { s: 'smoke', c: [0.04, 0.0, 0.08, 0.7], add: 0, at: 'body', rate: 8, life: 1, sz: 0.3, vy: 0.3, grow: 1 },
      coin: { s: 'dot', c: [2.0, 1.5, 0.3, 1], add: 1, at: 'head', rate: 7, life: 1, sz: 0.1, vy: 2.2, grav: 1, spread: 1.2 },
      thump: { s: 'smoke', c: [0.6, 0.55, 0.45, 0.45], add: 0, at: 'feet', rate: 5, run: 1, life: 0.5, sz: 0.3, grow: 1 },
      chevron: { s: 'sparkle', c: [0.8, 1.6, 1.0, 0.9], add: 1, at: 'above', rate: 3, life: 0.6, sz: 0.14, vy: 1.2 },
      flash: { s: 'sparkle', c: [3, 3, 3, 1], add: 1, at: 'around', rate: 3.5, life: 0.18, sz: 0.6 },
      sweat: { s: 'drop', c: [0.7, 0.85, 1.2, 0.8], add: 0, at: 'head', rate: 4, run: 1, life: 0.6, sz: 0.09, vy: 1, grav: 1, spread: 1 },
      'bubble:green': { s: 'bubble', c: [0.5, 1.6, 0.6, 0.8], add: 1, at: 'head', rate: 5, life: 1, sz: 0.12, vy: 0.7 },
      bubble: { s: 'bubble', c: [0.6, 1.2, 1.8, 0.8], add: 1, at: 'body', rate: 7, life: 1.1, sz: 0.13, vy: 0.8, wob: 1 },
      exhaust: { s: 'smoke', c: [0.3, 0.3, 0.33, 0.7], add: 0, at: 'feet', rate: 8, run: 1, life: 0.9, sz: 0.32, vy: 0.5, grow: 1 },
      echo: { s: 'smoke', team: 1, add: 1, at: 'trail', rate: 10, run: 1, life: 0.35, sz: 0.45 },
      confetti: { s: 'square', pal: [[1.6, 0.3, 0.3], [0.3, 1.4, 0.5], [0.3, 0.6, 1.8], [1.7, 1.5, 0.3], [1.5, 0.4, 1.5]], add: 0, at: 'above', rate: 9, life: 1.3, sz: 0.07, vy: -0.4, spin: 1, wob: 1 },
      'confetti:gold': { s: 'square', pal: [[2.0, 1.5, 0.3], [1.6, 1.6, 1.7]], add: 1, at: 'above', rate: 9, life: 1.3, sz: 0.07, vy: -0.4, spin: 1, wob: 1 },
      'splat:team': { s: 'splat', team: 1, add: 0, at: 'feet', rate: 3, run: 1, life: 1.4, sz: 0.3, flat: 1 },
      'splat:ink': { s: 'splat', c: [0.03, 0.03, 0.05, 0.9], add: 0, at: 'feet', rate: 3, run: 1, life: 1.2, sz: 0.3, flat: 1 },
      'splat:paint': { s: 'splat', pal: [[1.6, 0.2, 1.2], [0.2, 1.5, 1.6], [1.7, 1.5, 0.2], [0.4, 1.6, 0.3]], add: 0, at: 'feet', rate: 3, run: 1, life: 1.4, sz: 0.32, flat: 1 },
      ember: { s: 'dot', c: [2.4, 0.8, 0.15, 1], add: 1, at: 'body', rate: 8, life: 0.8, sz: 0.08, vy: 1.2, wob: 1 },
      petal: { s: 'petal', c: [1.6, 0.8, 1.1, 0.9], add: 0, at: 'above', rate: 5, life: 1.4, sz: 0.11, vy: -0.4, spin: 1, wob: 1 },
      firework: { s: 'sparkle', pal: [[2, 0.4, 0.4], [0.4, 2, 0.6], [0.5, 0.7, 2.2], [2, 1.8, 0.4]], add: 1, at: 'burst', rate: 6, life: 0.7, sz: 0.17 },
      leaf: { s: 'leaf', c: [0.35, 1.2, 0.3, 1], add: 0, at: 'above', rate: 4, life: 1.4, sz: 0.13, vy: -0.4, spin: 1, wob: 1 },
      sand: { s: 'smoke', c: [1.0, 0.82, 0.5, 0.6], add: 0, at: 'feet', rate: 9, run: 1, life: 0.8, sz: 0.28, vy: 0.4, grow: 1 },
      pow: { s: 'star', c: [2.0, 1.6, 0.2, 1], add: 0, at: 'around', rate: 1.2, life: 0.35, sz: 0.4, spin: 1 },
      static: { s: 'square', pal: [[1.4, 1.4, 1.4], [0.5, 0.5, 0.5]], add: 1, at: 'body', rate: 14, life: 0.1, sz: 0.06, jit: 1 },
      'spark:green': { s: 'sparkle', c: [0.3, 2.0, 0.8, 1], add: 1, at: 'body', rate: 6, life: 0.3, sz: 0.12 },
      bolt: { s: 'bolt', c: [1.8, 1.8, 3.0, 1], add: 1, at: 'around', rate: 2.5, life: 0.12, sz: 0.55 },
      rain: { s: 'drop', c: [0.6, 0.75, 1.2, 0.8], add: 0, at: 'cloud', rate: 12, life: 0.45, sz: 0.06, vy: -3.5 },
      swirl: { s: 'smoke', c: [0.85, 0.88, 0.95, 0.65], add: 0, at: 'swirl', rate: 16, life: 0.8, sz: 0.24 },
      rainbow: { s: 'dot', rainbow: 1, add: 1, at: 'trail', rate: 22, run: 1, life: 0.5, sz: 0.2 },
      kernel: { s: 'dot', c: [1.4, 1.3, 1.0, 1], add: 0, at: 'head', rate: 3, life: 0.8, sz: 0.06, vy: 2, grav: 1, spread: 1 },
      xo: { s: 'qmark', c: [1.4, 1.5, 1.4, 1], add: 0, at: 'head', rate: 0, life: 1, sz: 0.2 },
    };
    EMIT.note = { s: 'note', pal: [[1.8, 1.6, 0.4], [1.4, 0.6, 1.8], [0.5, 1.5, 1.8]], add: 0, at: 'head', rate: 2.5, life: 1.3, sz: 0.16, vy: 0.6, wob: 1 };
    EMIT.xo = { s: 'square', c: [1.5, 1.6, 1.5, 0.9], add: 1, at: 'feet', rate: 7, run: 1, life: 1.2, sz: 0.17, flat: 1 }; // chalk marks left on the turf
    const TEAMC = () => [OFFC.jer[0] * 1.3 + 0.55, OFFC.jer[1] * 1.3 + 0.55, OFFC.jer[2] * 1.3 + 0.55, 1]; // team colour, lifted so it reads against the kit
    function fxSetup(p) { // called from mkP: resolve the card into a recipe and its strength
      const r = fxRecipe(p.fx); p.fxr = r; p.fxAcc = null;
      if (!r) return;
      p.fxK = clamp(r.k, 0.4, 2);
      if (r.m === 'built') { p.body = Object.assign({}, p.body, { arms: q20(p.body.arms * 1.22), sw: q20(p.body.sw * 1.06), bulk: q20(p.body.bulk * 1.05) }); p.lk.sw = p.body.sw; } // skeleton shoulders match the mesh
    }
    const hpt = (p, b, x, y, z) => mPt(p.bones[b], x * p.lk.hs, y * p.lk.hs, z * p.lk.hs);
    function fxStep(dt, now) {
      fxAdd.n = 0; fxAlp.n = 0;
      if (phase === 'box') { fxParts.length = 0; return; }
      const budget = PBUD(), live = phase !== 'splash' && phase !== 'cpu';
      let total = fxParts.length;
      const all = extras.length ? everyone : everyone;
      for (const p of all) {
        const r = p.fxr; if (!r || !p.bones) continue;
        const hs = p.lk.hs, hm = p.bones[B.head], K = p.fxK || 0.6;
        // helmet prop
        if (r.p) { const bob = p.fxBob || 1; emitProp(r.p, hm, 0, (0.35 + (r.p === 'halo' ? 0.04 : 0)) * hs * bob, -0.01 * hs, hs * bob * (1.1 + 0.3 * Math.min(K, 1.4))); }
        if (!r.e || !dt) continue;
        const camD = Math.hypot(p.x - cam.e[0], p.z - cam.e[2]); if (camD > 45) continue;
        const sp = Math.hypot(p.vx, p.vz);
        const per = Math.round((quality === 0 ? 6 : 16) * Math.max(0.75, K));
        p.fxAcc = p.fxAcc || {};
        let mine = 0; for (const q of fxParts) if (q.o === p) mine++;
        for (const ek of r.e) {
          const E = EMIT[ek]; if (!E) continue;
          if (E.run && sp < 2.5 && !(DBG && DBG.fxAll)) continue; // fxAll: proof sheets show running-only emitters on a standing player
          let rate = E.rate * Math.max(0.8, K) * (quality === 0 ? 0.4 : 1) * (E.idle && phase === 'live' && !(DBG && DBG.fxAll) ? 0.3 : 1) * (live ? 1 : 0.6);
          p.fxAcc[ek] = (p.fxAcc[ek] || 0) + rate * dt;
          while (p.fxAcc[ek] >= 1) {
            p.fxAcc[ek] -= 1;
            if (mine >= per || total >= budget) { p.fxAcc[ek] = 0; break; }
            mine++; total++;
            let pos, vx = (crand() - 0.5) * 0.4, vy = (E.vy || 0) * (0.7 + crand() * 0.6), vz = (crand() - 0.5) * 0.4;
            const at = E.at;
            if (at === 'head') pos = hpt(p, B.head, (crand() - 0.5) * 0.2, 0.3, (crand() - 0.5) * 0.2);
            else if (at === 'above') pos = hpt(p, B.head, (crand() - 0.5) * 0.9, 0.55 + crand() * 0.3, (crand() - 0.5) * 0.9);
            else if (at === 'cloud') pos = hpt(p, B.head, (crand() - 0.5) * 0.2, 0.62, (crand() - 0.5) * 0.12);
            else if (at === 'hands') pos = hpt(p, crand() < 0.5 ? B.haL : B.haR, 0, -0.05, 0);
            else if (at === 'feet') { pos = hpt(p, crand() < 0.5 ? B.ftL : B.ftR, 0, -0.05, 0.05); pos[1] = 0.06; }
            else if (at === 'trail') { pos = hpt(p, B.chest, (crand() - 0.5) * 0.4, (crand() - 0.6) * 0.6, -0.2); vx = -p.vx * 0.05; vz = -p.vz * 0.05; }
            else if (at === 'around') pos = [p.x + (crand() - 0.5) * 1.2, (0.6 + crand() * 1.6) * hs, p.z + (crand() - 0.5) * 1.2];
            else if (at === 'burst') { pos = hpt(p, B.head, 0, 0.7, 0); const a = crand() * 6.28, b = crand() * 3.14; vx = Math.cos(a) * Math.sin(b) * 1.6; vy = Math.cos(b) * 1.6; vz = Math.sin(a) * Math.sin(b) * 1.6; }
            else if (at === 'swirl') { const a = crand() * 6.28; pos = [p.x + Math.cos(a) * 0.7, crand() * 2 * hs, p.z + Math.sin(a) * 0.7]; }
            else pos = hpt(p, B.chest, (crand() - 0.5) * 0.7, (crand() - 0.5) * 1.1, (crand() - 0.5) * 0.5);
            if (E.spread) { vx += (crand() - 0.5) * E.spread; vz += (crand() - 0.5) * E.spread; }
            const col = E.team ? TEAMC() : E.rainbow ? hsvC((now * 0.3 + crand() * 0.3) % 1) : E.pal ? E.pal[(crand() * E.pal.length) | 0].concat([1]) : E.c;
            fxParts.push({ o: p, x: pos[0], y: pos[1], z: pos[2], vx, vy, vz, t: 0, life: E.life * (0.8 + crand() * 0.4), sz: E.sz * (0.8 + 0.45 * Math.min(K, 1.6)), E, col, rot: crand() * 6.28, sw: (E.at === 'swirl' ? crand() * 6.28 : 0) });
          }
        }
      }
      // move and draw
      const r0 = [VIEW[0], VIEW[4], VIEW[8]], u0 = [VIEW[1], VIEW[5], VIEW[9]];
      for (let i = fxParts.length - 1; i >= 0; i--) {
        const q = fxParts[i], E = q.E;
        q.t += dt;
        if (q.t >= q.life || !q.o || everyone.indexOf(q.o) < 0) { fxParts[i] = fxParts[fxParts.length - 1]; fxParts.pop(); continue; }
        if (E.grav) q.vy -= 6 * dt;
        if (E.wob) q.vx += Math.sin(now * 3 + q.rot * 5) * dt * 0.8;
        if (E.at === 'swirl') { q.sw += dt * 5; const o = q.o; q.x = o.x + Math.cos(q.sw) * (0.6 + q.t); q.z = o.z + Math.sin(q.sw) * (0.6 + q.t); q.y += dt * 0.6; }
        else { q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
        if (E.jit) { q.x += (crand() - 0.5) * 0.1; q.y += (crand() - 0.5) * 0.1; }
        if (q.y < 0.03) { q.y = 0.03; q.vy = 0; }
        const u = q.t / q.life, fade = u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.5) / 0.5);
        let s = q.sz * (E.grow ? 0.6 + u * 1.2 : E.shrink ? 1 - u * 0.7 : 1);
        const c = q.col, col = [c[0], c[1], c[2], (c[3] == null ? 1 : c[3]) * fade];
        const k = SPR[E.s] || 0, uu = (k % 4) * 0.25, vv = Math.floor(k / 4) * 0.25, uv = [uu + 0.003, vv + 0.247, uu + 0.247, vv + 0.247, uu + 0.247, vv + 0.003, uu + 0.003, vv + 0.003];
        const B2 = E.add ? fxAdd : fxAlp;
        if (E.flat) { // lies on the turf
          const a = q.rot, ca = Math.cos(a) * s, sa = Math.sin(a) * s, y = 0.035;
          B2.quad([q.x - ca + sa, y, q.z - sa - ca], [q.x + ca + sa, y, q.z + sa - ca], [q.x + ca - sa, y, q.z + sa + ca], [q.x - ca - sa, y, q.z - sa + ca], [0, 0, 0], col, uv);
          continue;
        }
        let rx = r0, ux = u0;
        if (E.spin) { const a = q.rot + now * 2, ca = Math.cos(a), sa = Math.sin(a); rx = [r0[0] * ca + u0[0] * sa, r0[1] * ca + u0[1] * sa, r0[2] * ca + u0[2] * sa]; ux = [u0[0] * ca - r0[0] * sa, u0[1] * ca - r0[1] * sa, u0[2] * ca - r0[2] * sa]; }
        if (E.stretch) s *= 1;
        const P = (a, b) => [q.x + rx[0] * a * s + ux[0] * b * s, q.y + rx[1] * a * s + ux[1] * b * s, q.z + rx[2] * a * s + ux[2] * b * s];
        B2.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 0, 0], col, uv);
      }
    }
    function hsvC(h) { const f = (n) => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 1.8 + 0.1, f(3) * 1.8 + 0.1, f(1) * 1.8 + 0.1, 1]; }
    // per-player shader look and glow shell
    function fxUniforms(P, p, now) {
      if (!P.u.uFx) return;
      const r = p.fxr;
      if (!r || !r.l) { gl.uniform4f(P.u.uFx, 0, 0, 0, 0); return; }
      const c = r.c ? C3(r.c) : [1, 1, 1];
      gl.uniform4f(P.u.uFx, LOOK[r.l] || 0, clamp(0.55 + 0.4 * (p.fxK || 0.6), 0.5, 1.3), now % 1000, (p.num || 1) * 0.13); gl.uniform3f(P.u.uFxC, c[0], c[1], c[2]);
    }
    // bobblehead: the head bone scaled up (about its joint) with a wobble; the depth pass uses the same bones so the shadow matches
    function fxBones(p, out, bind, now) {
      const r = p.fxr; if (!r || !p.bones) return;
      // glitch: on the same beat as the kit's colour glitch the whole body skips sideways for a moment
      if (r.g && ((now % 1000) * 2.3 + (p.num || 1) * 0.13) % 1 > 0.86) { const jx = (((now * 37) | 0) % 2 ? 1 : -1) * 0.07 * p.lk.hs, jz = (((now * 53) | 0) % 3 - 1) * 0.03; for (let i = 0; i < out.length; i += 12) { out[i + 3] += jx; out[i + 11] += jz; } }
      if (!r.b) return;
      const s = 1.55, i = B.head, m = p.bones[i], o = i * 12, bp = bind[i], hs = p.lk.hs, bx = bp[0] * hs, by = bp[1] * hs, bz = bp[2] * hs;
      const w = Math.sin(now * 9 + p.ph) * 0.12 * (0.4 + Math.min(1, Math.hypot(p.vx, p.vz) / 6)), c = Math.cos(w), sn = Math.sin(w);
      // wobble about the bone's forward axis, then scale
      const R = [m[0] * c + m[1] * sn, m[1] * c - m[0] * sn, m[2], m[4] * c + m[5] * sn, m[5] * c - m[4] * sn, m[6], m[8] * c + m[9] * sn, m[9] * c - m[8] * sn, m[10]];
      for (let row = 0; row < 3; row++) { const a = R[row * 3] * s, b = R[row * 3 + 1] * s, cc = R[row * 3 + 2] * s; out[o + row * 4] = a; out[o + row * 4 + 1] = b; out[o + row * 4 + 2] = cc; out[o + row * 4 + 3] = m[row * 4 + 3] - (a * bx + b * by + cc * bz); }
      p.fxBob = s;
    }
    function drawFxShells(P, list, now) { // additive rim-glow shells for glow / outline cards
      let any = false; for (const p of list) if (p.fxr && p.fxr.o && p.bones) { any = true; break; }
      if (!any || !P.u.uFxV) return;
      gl.useProgram(P.pr); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      let cur = null;
      for (const p of list) {
        const r = p.fxr; if (!r || !r.o || !p.bones) continue;
        const d = Math.hypot(p.x - cam.e[0], p.z - cam.e[2]), mesh = meshFor(p.body || BODY.WR)[d < LOD_D ? 0 : 1];
        if (mesh !== cur) { cur = mesh; bindMesh(P, mesh); }
        skinCommon(P, p, mesh); playerUniforms(P, p);
        const c = C3(r.o), k = clamp(0.35 + 0.35 * (p.fxK || 0.6), 0.3, 1.0) * (0.85 + 0.15 * Math.sin(now * 4 + p.ph));
        gl.uniform4f(P.u.uFx, 20, k, 0, 0); gl.uniform3f(P.u.uFxC, c[0], c[1], c[2]); gl.uniform4f(P.u.uFxV, 0.022, 0, 0, 0);
        gl.drawElements(gl.TRIANGLES, mesh.vi0, gl.UNSIGNED_SHORT, 0); DRAWS.n++;
      }
      gl.uniform4f(P.u.uFxV, 0, 0, 0, 0); gl.uniform4f(P.u.uFx, 0, 0, 0, 0);
      gl.depthMask(true); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.disable(gl.BLEND);
      disableAll(P);
    }
    function drawFxParts(W) { // sprites: additive glows, then alpha-blended smoke / splats / glyphs
      if (!G.fxTex || (!fxAdd.n && !fxAlp.n)) return;
      gl.bindTexture(gl.TEXTURE_2D, G.fxTex); worldMat(W, [0.5, 0, 0, 0], 8); gl.depthMask(false); gl.enable(gl.BLEND);
      if (fxAlp.n) { bindWorldAttribs(W, G.fxb, fxAlp.f.subarray(0, fxAlp.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, fxAlp.n); DRAWS.n++; }
      if (fxAdd.n) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); bindWorldAttribs(W, G.fxb, fxAdd.f.subarray(0, fxAdd.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, fxAdd.n); DRAWS.n++; gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); }
      gl.depthMask(true); gl.bindTexture(gl.TEXTURE_2D, G.white);
    }

    // ---------- scorebug ----------
    const SVG_FS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>';
    const SVG_SND = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 5c1.2 1.5 1.2 4.5 0 6" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
    const SVG_MUTE = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.5"/></svg>';
    bug.innerHTML = `<div class="bz-sb"><div class="bz-tm" data-t="h" style="--c:${HOMECSS}"><b>${esc(HOME.abbr)}</b><em>0</em><i></i><s></s></div><div class="bz-tm" data-t="a" style="--c:${OPPCSS}"><b>${esc(AWAY.abbr)}</b><em>0</em><i></i></div><div class="bz-clk"><b>2:00</b><span>Q1</span></div><div class="bz-pc">20</div><div class="bz-sta"><span>Sprint</span><u><i></i></u></div></div><div class="bz-dd"><b>1st & 10</b><span>Own 25</span></div><div class="bz-sp"></div>`;
    const bH = bug.querySelector('[data-t=h]'), bA = bug.querySelector('[data-t=a]'), bClk = bug.querySelector('.bz-clk'), bPc = bug.querySelector('.bz-pc'), bDD = bug.querySelector('.bz-dd'), bSta = bug.querySelector('.bz-sta');
    const mkIB = (html, title) => { const b = el('button', 'bz-ib', html); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); bug.appendChild(b); return b; };
    const SVG_X = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3l10 10M13 3L3 13"/></svg>';
    const sndBtn = mkIB(SVG_SND, 'Sound'); sndBtn.classList.add('bz-snd'); const QN = ['LOW', 'MED', 'HIGH'], qBtn = mkIB('<span class="bz-q">' + QN[quality] + '</span>', 'Graphics quality'), fsBtn = mkIB(SVG_FS, 'Full screen'), quitBtn = mkIB(SVG_X, 'Quit game');
    qBtn.addEventListener('click', () => { setQuality((quality + 1) % 3); qBtn.innerHTML = '<span class="bz-q">' + QN[quality] + '</span>'; sfx.play('tap'); });
    function showQuality() { qBtn.innerHTML = '<span class="bz-q">' + QN[quality] + '</span>'; }
    if (!fsOK || fixedMode) fsBtn.style.display = 'none';
    sndBtn.addEventListener('click', () => { sfx.mute(!sfx.muted); sndBtn.innerHTML = sfx.muted ? SVG_MUTE : SVG_SND; });
    fsBtn.addEventListener('click', toggleFS);
    let quitArm = 0;
    quitBtn.addEventListener('click', () => {
      if (finished) return;
      if (!quitArm) { quitArm = 1; quitBtn.textContent = 'QUIT?'; quitBtn.classList.add('sure'); setTimeout(() => { quitArm = 0; quitBtn.innerHTML = SVG_X; quitBtn.classList.remove('sure'); }, 2400); return; }
      finishGame(true);
    });
    let bugCache = '';
    function updBug() {
      const pc = Math.ceil(playClock), running = clockRun || phase === 'live' || (phase === 'kick' && kick && kick.st === 'fly');
      const key = [hs, as, qtr, Math.ceil(clock), toLeft, poss, phase === 'pre' ? pc : '', down, Math.round(los * 2), fdz, tryMode, running, phase].join('|');
      if (key === bugCache) return; bugCache = key;
      bH.querySelector('em').textContent = hs; bA.querySelector('em').textContent = as;
      bH.classList.toggle('pos', poss === 'home'); bA.classList.toggle('pos', poss === 'away');
      bH.querySelector('s').innerHTML = Array.from({ length: TOS }, (_, i) => `<u class="${i < toLeft ? '' : 'off'}"></u>`).join('');
      bClk.querySelector('b').textContent = fmtClock(clock); bClk.querySelector('span').textContent = qtr > 4 ? (qtr > 5 ? 'OT' + (qtr - 4) : 'OT') : 'Q' + qtr;
      bClk.classList.toggle('run', running);
      bPc.textContent = phase === 'pre' ? pc : '';
      bPc.classList.toggle('low', phase === 'pre' && pc <= 5);
      const cpuBall = poss === 'away' || phase === 'cpu';
      bDD.innerHTML = cpuBall ? `<b>${esc(AWAY.abbr)} ball</b><span>Defense on the field</span>` : phase === 'pat' ? '<b>Try</b><span>PAT or 2</span>' : `<b>${ddTxt()}</b><span>${ballTxt(los)}</span>`;
      const tb = ctl.querySelector('.bz-to'); if (tb) tb.classList.toggle('off', !canTimeout());
    }
    let sprintBtn = null, staCache = -1;
    function updSprint() {
      const p = ctrl || (mode === 'aim' ? OK.QB : null);
      const v = p ? p.sta : 1, k = Math.round(v * 50);
      if (k !== staCache) { staCache = k; bSta.style.setProperty('--s', (v * 100).toFixed(0) + '%'); bSta.classList.toggle('low', v < 0.2); if (sprintBtn) { sprintBtn.style.setProperty('--s', (v * 100).toFixed(0) + '%'); sprintBtn.classList.toggle('on', !!(p && p.sprint)); } }
      bSta.style.visibility = p ? 'visible' : 'hidden';
    }
    function mkSprint() {
      const b = el('button', 'bz-btn bz-sprint', `Sprint<i></i>${K('SHIFT')}`); b.type = 'button';
      const on = (e) => { e.preventDefault(); input.sprint = true; try { b.setPointerCapture(e.pointerId); } catch (er) {} };
      const off = () => { input.sprint = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
      ctl.appendChild(b); sprintBtn = b; return b;
    }
    // ---------- banners, pops, commentary ----------
    function pop(txt, col, x, y) {
      const e = el('div', 'bz-pop', esc(txt)); e.style.color = col || '#ffc21a';
      e.style.left = (x == null ? cssW / 2 : x) + 'px'; e.style.top = (y == null ? cssH * 0.55 : y) + 'px';
      fx.appendChild(e); setTimeout(() => e.remove(), 1150);
    }
    function popAt(p, txt, col) { const s = p ? project(p.x, 1.2, p.z) : null; pop(txt, col, s ? s[0] : null, s ? s[1] : null); }
    function banner(txt, sub, col) {
      fx.querySelectorAll('.bz-banner').forEach((b) => b.remove());
      const b = el('div', 'bz-banner', `<b style="color:${col || '#ffc21a'}">${txt}</b>${sub ? `<i>${sub}</i>` : ''}`);
      fx.appendChild(b); return b;
    }
    const clearBanner = () => fx.querySelectorAll('.bz-banner').forEach((b) => b.remove());
    let tickT = 0;
    function say(html) {
      if (!html) return;
      tick.innerHTML = html; tick.classList.add('on');
      tick.style.top = (bug.offsetHeight + 2) + 'px';
      clearTimeout(tickT); tickT = setTimeout(() => tick.classList.remove('on'), 4200);
    }

    // ---------- controls ----------
    let ctlKey = '', mvBtns = null;
    const K = (s) => (touchy ? '' : `<kbd>${s}</kbd>`);
    function btn(cls, html, fn, ev) {
      const b = el('button', 'bz-btn ' + (cls || ''), html); b.type = 'button';
      b.addEventListener(ev || 'click', (e) => { if (ev === 'pointerdown') e.preventDefault(); fn(e); });
      ctl.appendChild(b); return b;
    }
    function msg(h) { const m = el('div', 'bz-msg', h); ctl.appendChild(m); return m; }
    function setControls(force) {
      let key = phase + '|' + mode + '|' + sheetOpen + '|' + (down === 4 && !go4) + '|' + tryMode + '|' + (kick ? kick.type + kick.st + (kick.tbOK ? 1 : 0) : '') + '|' + (lastBig ? lastBig.kind : '');
      if (key === ctlKey && !force) return;
      ctlKey = key; ctl.innerHTML = ''; mvBtns = null; sprintBtn = null; staCache = -1;
      if (phase === 'pre') {
        if (sheetOpen) return;
        if (down === 4 && !go4 && !tryMode) {
          const fd = fgDist(), inR = fd <= fgRange() + 3;
          btn('bz-y', `Go for it<small>4th & ${fdz >= 100 ? 'goal' : Math.max(1, Math.round(fdz - los))}</small>`, () => choose4th('go'));
          btn('', `Punt${K('P')}`, () => choose4th('punt'));
          const f = btn('', `Field goal<small>${inR ? fd + ' yd · ' + Math.round(fgPct(fd) * 100) + '%' : 'out of range'}</small>`, () => choose4th('fg')); f.disabled = !inR;
        } else {
          btn('bz-wide', `${esc(play.name)}<small>${esc(FORMS[play.form].name)}${flip ? ' · flipped' : ''} · change play</small>`, () => { sheetOpen = true; setControls(true); openSheet(); });
          const late = (qtr === 2 || qtr >= 4) && clock < 25 && fgDist() <= fgRange() && !tryMode;
          if (late) btn('', `FG<small>${fgDist()} yd</small>`, () => startKick('fg'));
          btn('bz-y bz-wide', `Snap${K('SPACE')}`, snap);
        }
        btn('bz-to' + (canTimeout() ? '' : ' off'), `T/O<small>${toLeft} left</small>${K('T')}`, callTimeout);
      } else if (phase === 'pat') {
        btn('bz-y', `Kick XP<small>+1 · ${esc(KR.name)}</small>${K('1')}`, () => chooseTry(false));
        btn('', `Go for 2<small>one play from the 2</small>${K('2')}`, () => chooseTry(true));
      } else if (phase === 'live' && mode === 'aim') {
        if (play.type === 'qbdraw') msg('<span><b>QB Draw</b> · he takes off on his own · pull back to throw instead</span>');
        else msg(touchy ? '<span><b>Pull back</b> to aim, let go to throw · aim <b>behind</b> the QB to run</span>' : '<span><b>Pull back</b> to aim &amp; release · aim <b>behind</b> the QB to run · arrows move the QB</span>');
        const seg = el('div', 'bz-arc');
        ['Bullet', 'Touch', 'Lob'].forEach((n, i) => { const b = el('button', i === arc ? 'sel' : '', n + K(String(i + 1))); b.type = 'button'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setArc(i); }); seg.appendChild(b); });
        ctl.appendChild(seg);
        btn('bz-r', `Run${K('R')}`, scramble, 'pointerdown').style.flex = '0 0 70px';
        mkSprint();
      } else if (phase === 'live' && mode === 'catch') {
        msg(touchy ? '<span>He runs to the ball · steer to adjust · time your catch</span>' : '<span>Arrows adjust · SPACE jump · X dive · SHIFT sprint</span>');
        mkSprint();
        const g = el('div', 'bz-catch'); ctl.appendChild(g);
        const d = el('button', 'bz-btn', `Dive${K('X')}`); d.type = 'button'; d.addEventListener('pointerdown', (e) => { e.preventDefault(); doDive(ctrl); }); g.appendChild(d);
        const j = el('button', 'bz-btn bz-g', `Jump${K('SPACE')}`); j.type = 'button'; j.addEventListener('pointerdown', (e) => { e.preventDefault(); doJump(ctrl); }); g.appendChild(j);
      } else if (phase === 'live' && mode === 'run') {
        if (kick && kick.type === 'ko' && kick.tbOK) btn('bz-y', `Take a knee<small>touchback</small>${K('T')}`, touchback, 'pointerdown');
        else msg(touchy ? '<span>Drag on the field to steer</span>' : '<span>Arrows / WASD to steer · SHIFT sprint</span>');
        mkSprint();
        const g = el('div', 'bz-mv'); ctl.appendChild(g); mvBtns = {};
        const qbSlide = ctrl && ctrl.role === 'QB' && !qbRunPlay() && !(kick && kick.type === 'ko');
        [['juke', 'Juke', 'J', 'bz-r'], ['spin', 'Spin', 'K', ''], ['stiff', 'Stiff', 'L', ''], ['hurdle', 'Hurdle', 'H', 'bz-g'], ['dive', qbSlide ? 'Slide' : 'Dive', 'SPACE', 'bz-y']].forEach(([m, n, k, c]) => {
          const b = el('button', 'bz-btn ' + c, `${n}${K(k)}<i></i>`); b.type = 'button';
          b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); doMove(m); }); g.appendChild(b); if (m !== 'dive') mvBtns[m] = b;
        });
      } else if (phase === 'live') {
        msg(carrier && carrier.side === 1 ? '<span>Interception! Chase him down…</span>' : kick && kick.type === 'ko' ? '<span>Kickoff · get under it…</span>' : ball && ball.st === 'loose' ? '<span>Ball is loose!</span>' : handed || play.type === 'run' ? '<span>Handoff…</span>' : '<span>…</span>');
      } else if (phase === 'kick') {
        btn('bz-y bz-wide', `${kick.st === 'power' ? 'Set power' : kick.st === 'acc' ? 'Set aim' : 'Kicking…'}${K('SPACE')}`, kickTap, 'pointerdown');
      } else if (phase === 'dead') {
        msg('<span>Next play coming up…</span>');
        if (lastBig && lastBig.kind !== 'td' && !lastBig.played) btn('', 'Replay', () => { if (lastBig) lastBig.want = true; sfx.play('tap'); }).style.flex = '0 0 86px';
        if (poss === 'home' && pend && !pend.next) btn('bz-to' + (canTimeout() ? '' : ' off'), `T/O<small>${toLeft} left</small>${K('T')}`, callTimeout);
      } else if (phase === 'replay') {
        msg('<span>Instant replay</span>');
        btn('bz-y', 'Skip', endReplay, 'pointerdown').style.flex = '0 0 96px';
      } else if (phase !== 'splash' && phase !== 'box') {
        msg(phase === 'cpu' ? `<span><b>${esc(AWAY.name)}</b> have the ball…</span>` : phase === 'over' ? '<span>Final</span>' : `<span>${esc(HOME.abbr)} <b>${hs}</b> – <b>${as}</b> ${esc(AWAY.abbr)}</span>`);
      }
    }
    const hotOK = (p) => p.type === 'pass' || p.type === 'pa' || p.type === 'boot' || p.type === 'qbdraw';
    function setArc(i) { arc = i; sfx.play('tap'); ctl.querySelectorAll('.bz-arc button').forEach((b, k) => b.classList.toggle('sel', k === arc)); }
    function scramble() {
      if (phase !== 'live' || mode !== 'aim' || !OK.QB || ball.holder !== OK.QB) return;
      const q = OK.QB; aim = null; hideAim();
      carrier = q; ctrl = q; mode = 'run'; pr.kind = 'rush'; pr.rusher = q; runSeen = tPlay; q.hold = false; q.face2 = null; q.look = null;
      sfx.play('tap'); setControls(true);
    }
    function cycleHot(k) {
      if (phase !== 'pre' || sheetOpen || !hotOK(play) || !OK[k] || k === 'RB') return;
      const cur = hot[k], i = cur ? HOT_ORDER.indexOf(cur) : -1;
      if (i === HOT_ORDER.length - 1) delete hot[k]; else hot[k] = HOT_ORDER[i + 1];
      sfx.play('tap'); setupPlay(); setControls(true);
      popAt(OK[k], hot[k] ? 'HOT: ' + ROUTE_NAMES[hot[k]].toUpperCase() : 'ORIGINAL ROUTE', '#4dd2ff');
    }

    // ---------- playbook sheet ----------
    let sheet = null, sheetCat = 'short';
    function diagram(cvs, pl, fl) {
      const g = cvs.getContext('2d'), W = cvs.width, H = cvs.height, F = FORMS[pl.form], fx = fl ? -1 : 1;
      const X = (x) => W / 2 + x * fx * (W / 36), Y = (d) => H * 0.62 - d * (H / 34);
      g.fillStyle = '#1f6a32'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; for (let d = -5; d <= 25; d += 5) { g.beginPath(); g.moveTo(0, Y(d)); g.lineTo(W, Y(d)); g.stroke(); }
      g.strokeStyle = '#5aa0ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
      g.fillStyle = '#f5f6f8'; for (let i = 0; i < 5; i++) g.fillRect(X((i - 2) * 1.95) - 3, Y(-0.9) - 3, 6, 6);
      const tip = (x0, y0, x1, y1) => { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 6 * Math.cos(a - 0.5), y1 - 6 * Math.sin(a - 0.5)); g.lineTo(x1 - 6 * Math.cos(a + 0.5), y1 - 6 * Math.sin(a + 0.5)); g.closePath(); g.fill(); };
      for (const k of ['X', 'Z', 'S', 'Y', 'RB', 'QB']) {
        let [x, d] = F[k]; if (k === 'Y' && pl.form === 'gun' && pl.id !== 'rbscreen') x = 3.9;
        const r = pl.routes[k], col = k === 'QB' ? '#ffc21a' : k === 'X' ? '#ffd45c' : '#ffffff';
        if (r && r !== 'B') {
          const s = x < -0.5 ? -1 : x > 0.5 ? 1 : 1;
          g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(X(x), Y(d));
          let px = x, pd = d, lx = X(x), ly = Y(d);
          for (const [o, u] of r.w) { px = x + s * o; pd = d + u; g.lineTo(X(px), Y(pd)); }
          g.stroke();
          const n = r.w.length, prev = n > 1 ? [x + s * r.w[n - 2][0], d + r.w[n - 2][1]] : [x, d];
          tip(X(prev[0]), Y(prev[1]), X(px), Y(pd));
        } else if (k !== 'QB' && !(isRunPlay(pl) && k === (pl.type === 'sneak' ? 'QB' : (pl.carrier || 'RB')))) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(x) - 4, Y(d) - 6); g.lineTo(X(x) + 4, Y(d) - 6); g.stroke(); }
        g.fillStyle = k === 'QB' ? '#ffc21a' : css(TEAM); g.beginPath(); g.arc(X(x), Y(d), 4, 0, 6.3); g.fill();
      }
      if (isRunPlay(pl) || pl.type === 'qbdraw') {
        const c = pl.type === 'sneak' || pl.type === 'qbdraw' ? F.QB : F[pl.carrier || 'RB'], lx = pl.lane || 0;
        g.strokeStyle = '#ff9a3c'; g.fillStyle = '#ff9a3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(c[0]), Y(c[1])); g.lineTo(X(lx * 0.5), Y(-1.5)); g.lineTo(X(lx), Y(5)); g.stroke(); tip(X(lx * 0.5), Y(-1.5), X(lx), Y(5));
      }
      if (pl.type === 'pa' || pl.type === 'boot') { g.fillStyle = 'rgba(255,154,60,.9)'; g.font = 'bold 10px Inter,sans-serif'; g.fillText('PA', 4, 12); }
      else if (pl.type === 'screen') { g.fillStyle = 'rgba(77,210,255,.9)'; g.font = 'bold 10px Inter,sans-serif'; g.fillText('SCREEN', 4, 12); }
      else if (pl.type === 'qbdraw' || (pl.type === 'sneak' && pl.lane)) { g.fillStyle = 'rgba(255,154,60,.9)'; g.font = 'bold 10px Inter,sans-serif'; g.fillText('QB RUN', 4, 12); }
      else if (pl.carrier) { g.fillStyle = 'rgba(255,154,60,.9)'; g.font = 'bold 10px Inter,sans-serif'; g.fillText(pl.carrier === 'S' ? 'JET' : 'REVERSE', 4, 12); }
    }
    function openSheet() {
      closeSheet(true);
      if (phase !== 'pre') return;
      sheetCat = 'coach';
      sheet = el('div', 'bz-sheet');
      const top = el('div', 'bz-sh-top', `<h4>Call a play<span>${ddTxt()} · ${ballTxt(los)}</span></h4>`);
      const same = el('button', 'bz-btn bz-y', `Same play${K('ENTER')}`); same.type = 'button'; same.style.flex = '0 0 auto'; same.style.minHeight = '40px'; same.style.padding = '4px 12px';
      same.addEventListener('click', () => pickPlay(play));
      const fl = el('button', 'bz-btn' + (flip ? ' sel' : ''), `Flip${K('F')}`); fl.type = 'button'; fl.style.flex = '0 0 auto'; fl.style.minHeight = '40px'; fl.style.padding = '4px 12px';
      fl.addEventListener('click', () => { flip = !flip; hot = {}; setupPlay(); fl.classList.toggle('sel', flip); drawCards(); sfx.play('tap'); });
      const to = el('button', 'bz-btn bz-to' + (canTimeout() ? '' : ' off'), `T/O<small>${toLeft} left</small>`); to.type = 'button'; to.style.minHeight = '40px'; to.style.flex = '0 0 auto'; to.style.padding = '4px 10px';
      to.addEventListener('click', () => { callTimeout(); to.classList.toggle('off', !canTimeout()); to.querySelector('small').textContent = toLeft + ' left'; });
      top.append(to, fl, same);
      const tabs = el('div', 'bz-tabs');
      for (const [c, n] of CATS) { const b = el('button', c === sheetCat ? 'sel' : '', n); b.type = 'button'; b.addEventListener('click', () => { sheetCat = c; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); drawCards(); }); tabs.appendChild(b); }
      const cards = el('div', 'bz-cards');
      sheet.append(top, tabs, cards);
      wrap.appendChild(sheet);
      sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
      drawCards();
    }
    const catName = (c) => { const x = CATS.find((q) => q[0] === c); return x ? x[1] : c; };
    function sheetPlays() { return sheetCat === 'coach' ? coachPicks().map((c) => c.p) : PLAYS.filter((p) => p.cat === sheetCat); }
    function drawCards() {
      if (!sheet) return;
      const cards = sheet.querySelector('.bz-cards'); cards.innerHTML = '';
      const coach = sheetCat === 'coach', picks = coach ? coachPicks() : null;
      sheetPlays().forEach((p, i) => {
        const c = el('button', 'bz-card' + (p === play ? ' sel' : ''), ''); c.type = 'button';
        const cvs = document.createElement('canvas'); cvs.width = 176; cvs.height = 110; diagram(cvs, p, flip);
        c.appendChild(cvs);
        c.appendChild(el('b', '', `${touchy ? '' : '<span style="color:#ffc21a;font:400 8px \'Press Start 2P\',monospace;margin-right:5px">' + (i + 1) + '</span>'}${esc(p.name)}`));
        c.appendChild(el('em', '', esc(FORMS[p.form].name) + (coach ? ' · ' + esc(catName(p.cat)) : '')));
        if (coach) c.appendChild(el('i', '', esc(picks[i].why))); else c.appendChild(el('span', '', esc(p.desc)));
        c.addEventListener('click', () => pickPlay(p));
        cards.appendChild(c);
      });
    }
    // ---------- the coach's three suggestions for this down, distance, field position and clock ----------
    let coachMemo = null;
    const ORD = ['', '1st', '2nd', '3rd', '4th'];
    function coachPicks() {
      const key = [down, los, fdz, drivePlays, qtr, Math.floor(clock / 30), hs, as, tryMode ? 1 : 0, hist.length ? hist[hist.length - 1].id : ''].join('|');
      if (coachMemo && coachMemo.key === key) return coachMemo.picks;
      const g2g = fdz >= 100, need = Math.max(1, Math.round(g2g ? 100 - los : fdz - los)), room = 100 - los;
      const lead = hs - as, lateHalf = (qtr === 2 || qtr >= 4) && clock < 120, hurry = lateHalf && (lead < 0 || (qtr >= 4 && lead === 0)), protect = lateHalf && lead > 0 && qtr >= 4;
      const desperate = qtr >= 4 && clock < 20 && lead < 0 && los < 65 && (lead < -3 || los < 50);
      const backedUp = los < 12, rz = los >= 80, gl = los >= 95 || (g2g && need <= 3), wet = WET > 0.3;
      const recent = hist.slice(-3).map((h) => h.id), blitzy = hist.length >= 2 && hist.slice(-2).every((h) => h.blitz);
      const noise = (i) => { const x = Math.sin((down * 7 + los * 13 + drivePlays * 31 + qtr * 101 + i * 17 + hs * 3 + as * 5) * 12.9898) * 43758.5453; return x - Math.floor(x); };
      const scored = PLAYS.map((p, i) => {
        const run = isRunPlay(p) || p.type === 'qbdraw', scr = p.type === 'screen', shot = p.cat === 'deep' || p.type === 'pa', over = p.yd - need;
        let s = 0, why;
        if (down >= 3 || g2g) s += over < 0 ? over * 0.9 : -over * 0.12;
        else if (down === 1) { if (p.yd >= 4 && p.yd <= 15) s += 1; if (run) s += 0.8; if (p.type === 'pa') s += 0.7; }
        else { s += over < -2 ? (over + 2) * 0.5 : -over * 0.08; if (need <= 3 && shot) s += 1.6; }
        if (need <= 1 && (p.id === 'sneak' || p.id === 'hbdive' || p.id === 'iso')) s += 4; else if (need <= 2 && run && p.yd <= 4) s += 1.6;
        if (backedUp) { s -= p.risk * 4; if (p.cat === 'trick') s -= 2; if (run || p.cat === 'quick') s += 0.8; }
        if (rz) { if (p.yd > room + 6) s -= (p.yd - room - 6) * 0.25; if (p.id === 'rzfade' && room <= 12) s += 2.5; if (p.cat === 'quick' || run) s += 0.5; }
        if (gl && !run && p.id !== 'rzfade' && p.cat !== 'quick') s -= 2;
        if (hurry) { s += (1 - p.clk) * 2.5 + (p.sl ? 1 : 0); if (run) s -= 2; if (p.type === 'pa' || p.type === 'boot') s -= 1; }
        else if (protect) { s += p.clk * 2; if (p.cat === 'deep' || p.cat === 'trick') s -= 1.5; }
        if (lead <= -14 && qtr >= 3) s += p.yd * 0.05;
        if (wet) { if (run || p.cat === 'quick') s += 1; if (p.cat === 'deep') s -= 1; }
        if (blitzy) { if (scr || p.cat === 'quick' || p.type === 'draw') s += 1.8; if (shot) s -= 0.8; }
        if (recent.indexOf(p.id) >= 0) s -= 3;
        if (p.id === 'hailmary') s += desperate ? 8 : -8;
        if (p.id === 'rzfade' && !rz) s -= 2.5; // fades are a red-zone call
        if (p.cat === 'trick' && !scr) s -= 0.6;
        s -= p.risk * (0.8 + DIFF * 0.6);
        s += noise(i) * 0.9;
        if (p.id === 'hailmary') why = 'Last chance · throw it up and pray';
        else if (gl || g2g) why = run ? (g2g ? 'Goal to go' : 'Goal line') + ' · punch it in' : p.id === 'rzfade' ? 'Goal to go · fade to the corner' : 'Goal to go · quick throw, nothing deep';
        else if (need <= 1 && run) why = 'Inches to go · power football';
        else if (hurry) why = p.sl ? 'Hurry-up · sideline throw stops the clock' : run ? 'Hurry-up · they will not expect it' : 'Hurry-up · quick strike, then hurry to the line';
        else if (protect && run) why = 'Protect the lead · keep the clock moving';
        else if (blitzy && (scr || p.cat === 'quick' || p.type === 'draw')) why = 'They keep blitzing · make them pay';
        else if (down >= 3) why = run ? ORD[down] + ' & ' + need + ' · they expect a pass' : over >= 0 ? ORD[down] + ' & ' + need + ' · gets you to the sticks' : ORD[down] + ' & ' + need + ' · catch and run for the rest';
        else if (down === 2 && need <= 3 && shot) why = '2nd & short · free play, take a shot';
        else if (backedUp) why = 'Backed up · safe yards, no mistakes';
        else if (rz) why = 'Red zone · short field, short routes';
        else if (wet && (run || p.cat === 'quick')) why = 'Wet turf · keep it simple';
        else if (down === 1) why = run ? '1st down · stay on schedule' : p.type === 'pa' ? '1st down · fake the run they expect' : shot ? '1st down · take a shot' : '1st down · easy completion';
        else why = '2nd & ' + need + ' · ' + p.desc.charAt(0).toLowerCase() + p.desc.slice(1);
        return { p, s, why };
      }).sort((a, b) => b.s - a.s);
      const picks = [];
      for (const c of scored) { if (picks.length >= 3) break; const same = picks.filter((q) => q.p.cat === c.p.cat).length; if (same === 0 || (same === 1 && (need <= 2 || protect) && c.p.cat === 'run')) picks.push(c); }
      for (const c of scored) { if (picks.length >= 3) break; if (picks.indexOf(c) < 0) picks.push(c); }
      coachMemo = { key, picks };
      return picks;
    }
    function pickPlay(p) {
      if (phase !== 'pre') return;
      if (p !== play) hot = {};
      play = p; lastCat = p.cat; sfx.play('tap'); if (intro > 0) intro = Math.min(intro, 0.3);
      setupPlay(); closeSheet();
      say(`<b>${esc(p.name)}</b> · ${esc(FORMS[p.form].name)}${flip ? ' (flipped)' : ''}${hotOK(p) ? ' · tap a receiver tag for a hot route' : ''}`);
    }
    function closeSheet(keep) {
      if (sheet) { sheet.remove(); sheet = null; }
      if (!keep) { sheetOpen = false; if (phase === 'pre') setControls(true); }
    }
    // ---------- kick meter ----------
    let meter = null;
    function showMeter(type) {
      hideMeter();
      meter = el('div', 'bz-meter', `<h5>${type === 'punt' ? 'Punt' : type === 'xp' ? 'Extra point' : fgDist() + '-yd field goal'}<span>${esc(KR.name)} · K ${Math.round(KK)}</span></h5><div class="bz-mbar"><u></u><i></i></div><div class="bz-macc"><i></i></div><p>${touchy ? 'Tap' : 'Click or SPACE'} to set power, then again to aim</p>`);
      wrap.appendChild(meter);
      if (type !== 'punt') {
        const need = 110 - kick.kz + 1, R0 = 36 + KK * 0.3 - WET * 3, pReq = clamp((need / R0 - 0.42) / 0.62, 0, 1);
        const u = meter.querySelector('u'); u.style.left = (pReq * 100) + '%'; u.style.right = '0';
      } else meter.querySelector('u').style.display = 'none';
      updMeter();
    }
    function updMeter() {
      if (!meter || !kick) return;
      meter.querySelector('.bz-mbar i').style.left = ((kick.st === 'power' ? kick.p : kick.pow || 0) * 100) + '%';
      const a = meter.querySelector('.bz-macc'); a.classList.toggle('on', kick.st === 'acc');
      a.querySelector('i').style.left = (50 + (kick.st === 'acc' ? kick.a : 0) * 50) + '%';
    }
    function hideMeter() { if (meter) { meter.remove(); meter = null; } }
    // ---------- aim + stick indicators ----------
    const aimLn = el('div', 'bz-aimln'), aimRun = el('div', 'bz-aimrun', 'Release to run'), stickEl = el('div', 'bz-stick', '<b></b>');
    aimLn.style.display = aimRun.style.display = stickEl.style.display = 'none';
    stage.append(aimLn, aimRun, stickEl);
    function showAim() {
      if (!aim || !OK.QB) return;
      const o = project(OK.QB.x, 1.0, OK.QB.z); if (!o) return;
      const dx = aim.ax - aim.px, dy = aim.ay - aim.py, l = Math.hypot(dx, dy);
      if (l < 14) { aimLn.style.display = 'none'; aimRun.style.display = 'none'; return; }
      const s = aimSpot();
      if (s && s.back) { aimLn.style.display = 'none'; aimRun.style.display = 'block'; aimRun.style.left = o[0] + 'px'; aimRun.style.top = (o[1] - 40) + 'px'; return; }
      aimRun.style.display = 'none'; aimLn.style.display = 'block';
      aimLn.style.left = o[0] + 'px'; aimLn.style.top = o[1] + 'px'; aimLn.style.width = Math.min(l, 260) + 'px'; aimLn.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      aimLn.style.opacity = s && s.over ? '1' : '0.75';
    }
    function hideAim() { aimLn.style.display = aimRun.style.display = 'none'; }
    function hideStick() { stickEl.style.display = 'none'; }

    // ---------- box score ----------
    function showBox() {
      phase = 'box'; setControls(true); hideTags();
      const won = hs > as, tie = hs === as;
      const rows = (keys, f) => keys.map((k) => f(k)).filter(Boolean).join('');
      const pl = SQL.filter((q) => q.pid && ST[q.pid]);
      const S = (q) => ST[q.pid];
      const pass = rows(pl, (q) => S(q).passAtt ? `<tr><td>${esc(q.name)}</td><td>${S(q).passCmp}/${S(q).passAtt}</td><td>${S(q).passYds}</td><td>${S(q).passTD}</td><td>${S(q).passInt}</td><td>${S(q).sacked}</td></tr>` : '');
      const rush = rows(pl, (q) => S(q).rushAtt ? `<tr><td>${esc(q.name)}</td><td>${S(q).rushAtt}</td><td>${S(q).rushYds}</td><td>${S(q).rushTD}</td><td>${S(q).long}</td></tr>` : '');
      const recv = rows(pl, (q) => S(q).rec ? `<tr><td>${esc(q.name)}</td><td>${S(q).rec}</td><td>${S(q).recYds}</td><td>${S(q).recTD}</td><td>${S(q).yac}</td></tr>` : '');
      const kS = KR.pid && ST[KR.pid];
      const top = Math.round(TS.timeOfPoss), cTop = Math.round(CPUS.top);
      const box = el('div', 'bz-box', `
        <h2 style="color:${won ? '#2bd46b' : tie ? '#ffc21a' : '#ff3344'}">${won ? 'Victory' : tie ? 'Tie game' : 'Final'}</h2>
        ${opts.label ? `<p style="text-align:center;margin:0;color:#9aa0ad;font:600 12px Inter,sans-serif">${esc(opts.label)}</p>` : ''}
        <div class="fs"><span style="color:${HOMECSS}">${esc(HOME.name)}</span>${hs}<span style="color:#6f7584">–</span>${as}<span style="color:${OPPCSS}">${esc(AWAY.name)}</span></div>
        <h3>Team</h3><table><tr><th></th><th>${esc(HOME.abbr)}</th><th>${esc(AWAY.abbr)}</th></tr>
        <tr><td>Total yards</td><td>${TS.yards}</td><td>${CPUS.yards}</td></tr><tr><td>Passing / rushing</td><td>${TS.passYds} / ${TS.rushYds}</td><td>–</td></tr>
        <tr><td>Plays</td><td>${TS.plays}</td><td>${CPUS.plays}</td></tr><tr><td>First downs</td><td>${TS.firstDowns}</td><td>–</td></tr>
        <tr><td>3rd down</td><td>${TS.thirdDownConv}/${TS.thirdDownAtt}</td><td>–</td></tr><tr><td>Turnovers</td><td>${TS.turnovers}</td><td>–</td></tr>
        <tr><td>Sacks allowed</td><td>${TS.sacks}</td><td>–</td></tr><tr><td>Time of possession</td><td>${fmtClock(top)}</td><td>${fmtClock(cTop)}</td></tr></table>
        ${pass ? `<h3>Passing</h3><table><tr><th>Player</th><th>C/Att</th><th>Yds</th><th>TD</th><th>Int</th><th>Sk</th></tr>${pass}</table>` : ''}
        ${rush ? `<h3>Rushing</h3><table><tr><th>Player</th><th>Att</th><th>Yds</th><th>TD</th><th>Long</th></tr>${rush}</table>` : ''}
        ${recv ? `<h3>Receiving</h3><table><tr><th>Player</th><th>Rec</th><th>Yds</th><th>TD</th><th>YAC</th></tr>${recv}</table>` : ''}
        ${kS && kS.fgAtt ? `<h3>Kicking</h3><table><tr><th>Player</th><th>FG</th></tr><tr><td>${esc(KR.name)}</td><td>${kS.fgMade}/${kS.fgAtt}</td></tr></table>` : ''}
        ${HL.length ? `<h3>Highlights</h3><ul class="hl">${HL.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
        <button type="button" class="go">CONTINUE</button>`);
      wrap.appendChild(box);
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      box.querySelector('.go').addEventListener('click', () => finishGame(false));
      boxT = setTimeout(() => finishGame(false), 45000);
    }
    let boxT = 0;

    // ---------- loop ----------
    let raf = 0, last = 0, running = false, ftAvg = 1 / 60, ftT = 0, qDropped = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const el2 = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      const mul = (DBG && DBG.speed) || 1;
      let sim = el2 * mul, n = 0, rdt = el2 * mul;
      if (DBG && DBG.stepT) { sim = DBG.stepT; rdt = DBG.stepT; DBG.stepT = 0; } else if (DBG && DBG.speed === 0) { sim = 0; rdt = 0; }
      const ts = performance.now();
      while (sim > 1e-6 && n < 400 && !finished) { const d = Math.min(sim, 1 / 60); if (aim) aim.dur += d; step(d); sim -= d; n++; }
      perf.sim += performance.now() - ts;
      if (finished) return;
      try { render(rdt); } catch (err) { if (!stepErrLogged) { stepErrLogged = true; try { console.error('blitz3d: render error', err); } catch (e2) {} } }
      updBug();
      if (((now / 250) | 0) !== (((now - el2 * 1000) / 250) | 0)) { sfx.crowd(phase === 'splash' || phase === 'box' ? 0.05 : 0.12 + excite * 0.6); setControls(false); }
      if (el2 > 0 && el2 < 0.25) {
        ftAvg += (el2 - ftAvg) * 0.08; ftT += el2;
        if (DBG && DBG.lockQ) ftT = 0;
        else if (ftT > 1.2 && ftAvg > 0.04 && quality > 0 && rscale <= 0.75) { setQuality(quality - 1); showQuality(); qDropped++; ftT = 0; }
        else if (ftT > 1.0 && ftAvg > 0.034 && rscale > 0.55) { rscale = Math.max(0.55, rscale - 0.15); ftT = 0; sizeBuffer(); }
        else if (ftT > 4 && ftAvg < 0.02 && rscale < 1) { rscale = Math.min(1, rscale + 0.1); ftT = 0; sizeBuffer(); }
        else if (ftT > 8 && ftAvg < 0.0125 && qDropped > 0 && rscale >= 1 && quality < 2) { setQuality(quality + 1); showQuality(); qDropped--; ftT = 0; }
        else if (ftT > 8) ftT = 0;
      }
    }
    function startLoop() { if (running || finished) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stopLoop() { running = false; cancelAnimationFrame(raf); }
    const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
    let rzT = 0;
    const onResize = () => { clearTimeout(rzT); const was = touchy && phase !== 'splash' && aligned(); rzT = setTimeout(() => { if (!finished) { fit(); bugCache = ''; if (was && !aligned()) scrollIn(); } }, 80); };
    const onOrient = () => { onResize(); setTimeout(() => { if (!finished && phase !== 'splash') { fit(); scrollIn(); } }, 350); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize); document.addEventListener('webkitfullscreenchange', onResize);
    const noScroll = (e) => {
      if (finished) return;
      if (e.target && e.target.closest && e.target.closest('.bz-splash,.bz-cards,.bz-box')) return;
      if (e.type === 'touchmove' && !aligned()) return; // the page got scrolled away from the game: let the swipe scroll it back
      e.preventDefault();
    };
    wrap.addEventListener('touchmove', noScroll, { passive: false });
    wrap.addEventListener('gesturestart', noScroll, { passive: false });
    // any first touch on the game while it is scrolled out of view snaps it back under the header (the tap still lands)
    wrap.addEventListener('touchstart', (e) => { if (touchy && !finished && !aligned() && !(e.target && e.target.closest && e.target.closest('.bz-splash,.bz-cards,.bz-box'))) scrollIn(); }, { passive: true });
    wrap.addEventListener('dblclick', (e) => e.preventDefault());
    wrap.addEventListener('contextmenu', (e) => { if (!finished) e.preventDefault(); });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLost = true; });
    cv.addEventListener('webglcontextrestored', () => { if (finished) return; try { setupGL(); glLost = false; } catch (err) { console.error(err); } });

    // ---------- input ----------
    const KEYS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
    function onKey(e) {
      if (finished || phase === 'splash' || phase === 'box') return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (!wrap.isConnected) return;
      const dn = e.type === 'keydown', k = KEYS[e.code];
      if (k) { input[k] = dn ? 1 : 0; e.preventDefault(); return; }
      if (e.key === 'Shift') { input.sprint = dn; e.preventDefault(); return; }
      if (!dn) return;
      const c = e.code;
      if (c === 'KeyT' && phase === 'pre') { callTimeout(); return; }
      if (sheet) {
        if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') { e.preventDefault(); pickPlay(play); return; }
        if (c === 'KeyF') { e.preventDefault(); sheet.querySelector('.bz-sh-top .bz-btn').click(); return; }
        if (c === 'Tab') { e.preventDefault(); const i = CATS.findIndex((x) => x[0] === sheetCat), N = CATS.length; sheet.querySelectorAll('.bz-tabs button')[(i + (e.shiftKey ? N - 1 : 1)) % N].click(); return; }
        const n = /^Digit([1-9])$/.exec(c); if (n) { const pl = sheetPlays()[+n[1] - 1]; if (pl) { e.preventDefault(); pickPlay(pl); } return; }
        if (c === 'Escape') { closeSheet(); return; }
        return;
      }
      if (c === 'Space' || c === 'Enter' || c === 'NumpadEnter') {
        e.preventDefault();
        if (phase === 'pre') { if (down === 4 && !go4 && !tryMode) choose4th('go'); else snap(); }
        else if (phase === 'kick') kickTap();
        else if (phase === 'replay') endReplay();
        else if (mode === 'catch') doJump(ctrl);
        else if (mode === 'run') doMove('dive');
        return;
      }
      if (c === 'KeyX') { if (mode === 'catch') doDive(ctrl); else if (mode === 'run') doMove('dive'); return; }
      if (c === 'KeyJ') { doMove('juke'); return; }
      if (c === 'KeyK') { doMove('spin'); return; }
      if (c === 'KeyL') { doMove('stiff'); return; }
      if (c === 'KeyH') { doMove('hurdle'); return; }
      if (phase === 'live' && mode === 'aim' && /^Digit[123]$/.test(c)) { setArc(+c.slice(5) - 1); return; } // 1 bullet, 2 touch, 3 lob
      if (c === 'KeyT') { if (kick && kick.type === 'ko' && kick.tbOK) touchback(); else callTimeout(); return; }
      if (c === 'KeyR') { scramble(); return; }
      if (c === 'KeyQ') { if (mode === 'aim') setArc((arc + 1) % 3); return; }
      if (c === 'KeyP') { choose4th('punt'); return; }
      if (c === 'KeyF') { choose4th('fg'); return; }
      if (c === 'KeyG') { choose4th('go'); return; }
      if (c === 'Digit1' && phase === 'pat') { chooseTry(false); return; }
      if (c === 'Digit2' && phase === 'pat') { chooseTry(true); return; }
      if (c === 'Escape' && aim) { aim = null; hideAim(); return; }
    }
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    const onBlur = () => { input.l = input.r = input.u = input.d = 0; input.sprint = false; };
    window.addEventListener('blur', onBlur);
    let pid = null, origin = null, ptype = '', ptT = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (finished) return;
      if (touchy && !aligned()) { scrollIn(); e.preventDefault(); return; } // first touch while the game is scrolled out of view: bring it back, nothing else
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (phase === 'kick') { kickTap(); e.preventDefault(); return; }
      if (phase === 'replay') { endReplay(); return; }
      if (pid != null) { if (ptype === 'aim') { setArc((arc + 1) % 3); e.preventDefault(); } return; } // second finger while aiming: cycle the arc
      if (phase === 'live' && mode === 'aim') {
        pid = e.pointerId; ptype = 'aim'; ptT = performance.now();
        aim = { ax: x, ay: y, px: x, py: y, dur: 0, spot: null, tgt: null };
        try { stage.setPointerCapture(e.pointerId); } catch (er) {}
        showAim(); e.preventDefault(); return;
      }
      if (phase === 'live' && (mode === 'run' || mode === 'catch')) {
        pid = e.pointerId; ptype = 'stick'; origin = [x, y]; input.stick = [0, 0];
        try { stage.setPointerCapture(e.pointerId); } catch (er) {}
        stickEl.style.display = 'block'; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.firstChild.style.transform = '';
        e.preventDefault();
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (ptype === 'aim' && aim) {
        aim.px = x; aim.py = y; showAim();
        return;
      }
      if (ptype === 'stick' && origin) {
        const dx = x - origin[0], dy = y - origin[1], l = Math.hypot(dx, dy), k = l > 42 ? 42 / l : 1;
        input.stick = [dx / 42, -dy / 42];
        stickEl.firstChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      }
    });
    const endPtr = (e) => {
      if (pid !== e.pointerId) return;
      if (ptype === 'aim' && aim) {
        const s = phase === 'live' && mode === 'aim' ? aimSpot() : null, l = Math.hypot(aim.px - aim.ax, aim.py - aim.ay), tap = l < 16 || performance.now() - ptT < 90;
        if (s && !tap && e.type === 'pointerup') { if (s.back) { if (tPlay > 0.3) scramble(); } else throwBall(s, arc); } // aimed behind the QB: he tucks it and runs
        aim = null; hideAim();
      }
      pid = null; origin = null; input.stick = null; ptype = ''; hideStick();
    };
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);

    // ---------- finish / cleanup ----------
    function cleanup() {
      stopLoop(); clearTimeout(boxT); clearTimeout(tickT);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onOrient);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize); document.removeEventListener('webkitfullscreenchange', onResize);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
      try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
      if (fixedMode) { wrap.classList.remove('bz-fixed'); document.documentElement.classList.remove('bz-lock'); try { window.scrollTo(0, savedScroll); } catch (e) {} }
      sfx.close();
      try {
        if (G) { for (const b of G.bufs) gl.deleteBuffer(b); for (const t of G.texs) gl.deleteTexture(t); for (const pr of G.progs) gl.deleteProgram(pr); delFBO(G.shadow); delFBO(G.scene); delFBO(G.scene2); delFBO(G.bloomA); delFBO(G.bloomB); delFBO(G.aoA); delFBO(G.aoB); delFBO(G.feed); }
        const lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext();
      } catch (e) {}
      G = null;
    }
    function finishGame(quit) {
      if (finished) return; finished = true;
      cleanup();
      const stats = {};
      for (const pid2 in ST) { const s = ST[pid2]; stats[pid2] = { passAtt: s.passAtt, passCmp: s.passCmp, passYds: s.passYds, passTD: s.passTD, passInt: s.passInt, rushAtt: s.rushAtt, rushYds: s.rushYds, rushTD: s.rushTD, rec: s.rec, recYds: s.recYds, recTD: s.recTD, fgAtt: s.fgAtt, fgMade: s.fgMade, sacked: s.sacked }; }
      const res = {
        homeScore: hs, awayScore: as, quit: !!quit, overtime: qtr >= 5, stats,
        team: { plays: TS.plays, yards: TS.yards, timeOfPoss: Math.round(TS.timeOfPoss), turnovers: TS.turnovers, sacks: TS.sacks, thirdDownConv: TS.thirdDownConv, thirdDownAtt: TS.thirdDownAtt, firstDowns: TS.firstDowns, passYds: TS.passYds, rushYds: TS.rushYds },
        highlights: HL.slice(0, 10),
      };
      try { done(res); } catch (e) { console.error(e); }
    }

    // ---------- splash ----------
    const lvlName = DIFF < 0.17 ? 'Rookie' : DIFF < 0.5 ? 'Pro' : DIFF < 0.83 ? 'All-Pro' : 'Legend';
    const wxName = { clear: 'Clear skies', rain: 'Rain', snow: 'Snow', night: 'Under the lights' }[WX];
    const splash = el('div', 'bz-splash', `
      <div class="bz-title">BLITZ 3D</div>
      <div class="bz-tag2"><span style="color:${HOMECSS}">${esc(HOME.name)}</span> vs <span style="color:${OPPCSS}">${esc(AWAY.name)}</span></div>
      <div class="bz-goal">${opts.label ? esc(opts.label) : lvlName} · ${wxName}<br>4 quarters × <em>${fmtClock(QS)}</em> · clock stops between plays · <em>${TOS}</em> timeouts a half</div>
      <div class="bz-squad">${['QB', 'RB', 'X', 'Z', 'S', 'Y'].map((k) => `<div>${faceHTML(SQ[k])}<span>${esc(shortName(SQ[k].name))}</span><em>${{ QB: 'QB', RB: 'RB', X: 'WR', Z: 'WR', S: 'WR', Y: 'TE' }[k]} #${SQ[k].num}</em></div>`).join('')}</div>
      <ul class="bz-how">
        <li><i>1</i><span><b>Call a play</b> from the 66-play playbook, or take one of the three the <b>Coach</b> tab suggests for the down, distance and clock, then <b>SNAP</b>${touchy ? '' : ' (Space)'}. Tap a receiver's tag before the snap for a hot route.</span></li>
        <li><i>2</i><span><b>Throw</b>: ${touchy ? 'touch anywhere and pull back' : 'drag the mouse back'}, like a slingshot; the line and arc come out of the QB the opposite way and the ring is where it lands. Pull farther = throw farther. Let go to throw. <b>Bullet / Touch / Lob</b> buttons${touchy ? ' (or tap with a second finger while aiming)' : ' (1 2 3, or Q to cycle)'}. Lead your receiver!</span></li>
        <li><i>3</i><span><b>Scramble</b>: aim <b>behind</b> the QB (${touchy ? 'drag forward so the line points back' : 'drag forward so the line points back'}) and let go: he tucks it and runs. Then ${touchy ? 'drag on the field' : 'use the arrows'} to steer him.</span></li>
        <li><i>4</i><span><b>Catch</b>: lead your man (the small ring shows where he will be when it gets there). The receiver closest to the ball hunts it on his own and goes up or lays out if you don't; steer to adjust, or hit <b>JUMP</b> for high balls and <b>DIVE</b> for ones just out of reach. A ball thrown into a crowd usually gets broken up or picked.</span></li>
        <li><i>5</i><span><b>Run</b>: ${touchy ? 'drag on the field to steer' : 'arrows / WASD'}, hold <b>SPRINT</b>${touchy ? '' : ' (Shift)'} for a burst, and use <b>Juke, Spin, Stiff arm, Hurdle, Dive</b>${touchy ? '' : ' (J K L H Space)'}. Hurdle a diving tackler, but a defender on his feet will catch you in the air. Tacklers hit with momentum: break them or fall forward.</span></li>
        <li><i>6</i><span>On 4th down go for it, punt or kick a field goal with the <b>kick meter</b>. After a TD: kick the extra point or go for 2. After a play that ends in bounds the clock runs 4 more seconds, then stops until the next snap; incompletions, out of bounds and scores stop it right away.</span></li>
      </ul>
      <button type="button" class="bz-go">KICK OFF</button>`);
    wrap.appendChild(splash);
    splash.querySelector('.bz-go').addEventListener('click', begin);
    function begin() {
      if (phase !== 'splash' || finished) return;
      sfx.init(); sfx.play('whistle');
      splash.remove(); fit(); scrollIn(); setTimeout(() => { if (!finished) { fit(); scrollIn(); } }, 400);
      const youRecv = rng() < 0.5; recv2 = youRecv ? 'away' : 'home';
      say(`Coin toss: <b>${youRecv ? esc(HOME.name) : esc(AWAY.name)}</b> will receive.`);
      phase = 'break'; brk = { t: 0.01, then: () => (youRecv ? goHome(null, true) : goCpu(25)) };
      try { cv.focus({ preventScroll: true }); } catch (e) {}
    }

    // ---------- debug hook (tests only) ----------
    const api = {
      get phase() { return phase; }, get mode() { return mode; }, get clock() { return clock; }, get qtr() { return qtr; }, get hs() { return hs; }, get as() { return as; },
      get los() { return los; }, get down() { return down; }, get fdz() { return fdz; }, get tPlay() { return tPlay; }, get toLeft() { return toLeft; }, get clockRun() { return clockRun; },
      get ball() { return ball; }, get ctrl() { return ctrl; }, get carrier() { return carrier; }, get target() { return target; }, get off() { return off; }, get def() { return def; }, get OK() { return OK; },
      get kick() { return kick; }, get play() { return play; }, get go4() { return go4; }, get sheetOpen() { return !!sheet; }, get tryMode() { return tryMode; }, get poss() { return poss; }, get elapsed() { return elapsedT; },
      get dcall() { return dcall; }, get stats() { return ST; }, get team() { return TS; }, get lastBig() { return lastBig; }, get mdist() { return maxDist(); },
      input, snap, begin, choose4th, chooseTry, kickTap, callTimeout, doMove, scramble, touchback, endReplay, setArc,
      pick(id, fl) { const p = PLAYS.find((q) => q.id === id); if (p) { if (fl != null) flip = !!fl; pickPlay(p); } },
      coach() { return coachPicks().map((c) => [c.p.id, c.why, Math.round(c.s * 100) / 100]); },
      get plays() { return PLAYS.map((p) => p.id); }, get cats() { return CATS.map((c) => c[0]); }, get sheetCat() { return sheetCat; },
      hurdle() { doMove('hurdle'); }, move(m) { doMove(m); },
      // card effects: set a player's card (by key or index) and read the table
      setBuild(k, b, wgt) { const p = typeof k === 'number' ? everyone[k] : OK[k] || DK[k]; if (!p) return null; const B6 = BUILDS6[b] || {}, base = BODY[p.role] || BODY.WR; p.lk = Object.assign({}, p.lk, { build: BUILDS6[b] ? b : null, hs: base.hs * (B6.hs || 1), ll: B6.ll || 1 }); if (wgt != null) p.wgt = wgt; p.body = bodySpec(base, p.lk, p.wgt); p.lk.sw = p.body.sw; p.rag = null; p.fl = null; return p.body; },
      setFx(k, f) { const p = typeof k === 'number' ? everyone[k] : OK[k] || DK[k]; if (!p) return null; p.fx = f; p.body = bodySpec(BODY[p.role] || BODY.WR, p.lk, p.wgt); fxSetup(p); return p.fxr; }, fxRecipe, get fxIds() { return { variants: Object.keys(FXV), sets: Object.keys(FXS) }; }, get fxCount() { return fxParts.length; },
      throwAt(x, z, a) { if (mode !== 'aim') return false; if (a != null) arc = a; return throwBall({ x, z, D: Math.hypot(x - OK.QB.x, z - OK.QB.z) }, arc); },
      jump() { doJump(ctrl); }, dive() { doDive(ctrl); },
      debugSet(o) { if (phase !== 'pre') return; if (o.los != null) los = o.los; if (o.down) down = o.down; if (o.togo) fdz = Math.min(100, los + o.togo); if (o.clock != null) clock = o.clock; if (o.qtr) qtr = o.qtr; if (o.hs != null) hs = o.hs; if (o.as != null) as = o.as; if (o.run != null) clockRun = o.run; go4 = false; closeSheet(); toPre(false); },
      quit() { finishGame(true); },
      scenario(o) {
        if (finished) return;
        closeSheet(); clearBanner(); hideTags(); clearPlayers();
        phase = 'live'; tPlay = 0; thrown = false; handed = true; runSeen = 0; crossed = true; aim = null; target = null; passer = null; kick = null; lastBig = null; replayBuf = []; recT = 0; carrier = null;
        los = o.los || 50; down = 1; fdz = los + 10; poss = 'home';
        const c = o.role ? (o.side ? addDef(mkP(1, o.role, o.key || 'T', o.x || 0, o.z || 40, { num: o.num || 24 })) : addOff(mkP(0, o.role, o.key || 'T', o.x || 0, o.z || 40, { num: o.num || 72 }))) : addOff(offPlayer(o.key || 'RB', o.x || 0, o.z || 40)); c.h = o.h || 0;
        (o.def || []).forEach((d, i) => addDef(mkP(1, d.role || 'LB', 'T' + i, d.x, d.z, { v: d.v || 7.6, str: d.str || 70, agi: 60, tackle: d.tackle || 70, spd: 70, num: 40 + i })));
        // more receivers on the field (hunt / converge scenarios): { key, x, z, vx, vz }
        (o.mates || []).forEach((m) => { const q = addOff(offPlayer(m.key, m.x, m.z)); q.vx = m.vx || 0; q.vz = m.vz || 0; });
        if (o.rv) { c.vx = o.rv[0]; c.vz = o.rv[1]; }
        finalizePlayers();
        for (const p of off) if (Math.hypot(p.vx, p.vz) > 0.5) p.h = Math.atan2(p.vx, p.vz);
        for (const p of everyone) setPose(p, 'run');
        pr = { type: 'run', start: los, kind: 'rush', rusher: c, notes: [] };
        if (o.ball) {
          const b = o.ball, y0 = b.y || 2.2, ty = b.ty || 1.5;
          ball = { st: 'air', x: b.x, y: y0, z: b.z, vx: (b.tx - b.x) / b.T, vz: (b.tz - b.z) / b.T, vy: (ty - y0 + 0.5 * GRAV * b.T * b.T) / b.T, t: 0, T: b.T, tx: b.tx, tz: b.tz, ty, arc: b.arc || 1, D: Math.hypot(b.tx - b.x, b.tz - b.z), played: [], fromZ: b.z, holder: null, kind: 'pass', spin: 0, wob: 0, wobA: 0.03 };
          thrown = true; target = c; ctrl = c; mode = 'catch'; updateCatchPoint(); for (const d of def) d.breakAt = 0; pr.kind = 'pass'; pr.tgt = c;
          // o.hunt: the same pick as a real throw (c is the man it was aimed at); o.noCtrl: nobody under the player's control
          if (o.hunt) { target = hunter(ball.cp, c); huntGo(); pr.tgt = target; }
          if (o.noCtrl) { ctrl = null; mode = 'none'; }
        } else { ball = { st: 'held', holder: c, x: c.x, y: 1.3, z: c.z, vx: 0, vy: 0, vz: 0 }; carrier = c; ctrl = c; mode = 'run'; c.vx = o.vx || 0; c.vz = o.vz == null ? 6 : o.vz; if (o.pocket) { handed = false; crossed = false; } }
        setControls(true);
      },
      reachGap, ballOver, leverage, leadPt, get pr() { return pr; }, routePos(k, dt) { const p = OK[k]; return p && p.R ? posAt(p.R, tPlay + dt) : null; }, get perf() { return perf; }, get aim() { return aim; }, aimSpot, flightT: flightOf, contactDist, catchRadius, shoulderPos, get quality() { return quality; }, setQuality(q) { setQuality(q); showQuality(); }, get draws() { return DRAWS; }, atlasURL() { try { return atlas.toDataURL(); } catch (e) { return 'ERR ' + e.message; } }, get shadowOn() { return !!(G && G.shadow); }, get shadowInfo() { return G && G.shadow ? { n: G.shadow.n, size: G.shadow.size, packed: G.shadow.packed, ok: G.shadow.ok } : null; }, get hdr() { return !!(G && G.scene && G.scene.hdr); }, get gl2() { return X.gl2; }, get caps() { return X; }, get extras() { return extras; }, get cam() { return cam; }, get everyone() { return everyone; }, get pile() { return pile; }, handPos, knockDown, setPose,
      swipe(ux, uz, k) { if (mode !== 'aim') return false; const D = Math.max(3, Math.min(1, k || 1) * maxDist()); return throwBall({ x: OK.QB.x + ux * D, z: OK.QB.z + uz * D, D }, arc); },
      kickoff() { if (phase === 'pre') { closeSheet(); goHome(null, true); } },
      get playClock() { return playClock; }, set playClock(v) { playClock = v; }, get cpuStats() { return CPUS; }, get cpuCS() { return CS; },
      cpuSim(start, q, t) { const log = [], r = simCpu(start, { q: q || 1, t: t == null ? QS : t }, log); return { r, log }; },
      fumble() { if (phase === 'live' && carrier && ball && ball.holder === carrier) { fumble(carrier); return true; } return false; },
      get cssW() { return cssW; }, get cssH() { return cssH; }, project(x, y, z) { return project(x, y, z); },
    };
    let elapsedT = 0, stepErrs = 0, stepErrLogged = false;
    const stepRaw = step;
    // a per-frame exception must never freeze a play: after ~30 failing frames the play is blown dead and the game goes on
    function blowDead() {
      if (phase !== 'live') return;
      if (kick && kick.type === 'ko') { kick = null; endPlay('inc', los, 'Play blown dead'); }
      else endPlay('inc', los, 'Play blown dead');
    }
    step = function (dt) {
      if (phase !== 'splash' && phase !== 'box') elapsedT += dt;
      try { stepRaw(dt); stepErrs = 0; }
      catch (err) {
        stepErrs++;
        if (!stepErrLogged) { stepErrLogged = true; try { console.error('blitz3d: step error', err); } catch (e2) {} }
        if (stepErrs >= 30) { stepErrs = 0; try { if (phase === 'live') blowDead(); else if (phase === 'dead') { deadT = 0; } } catch (e3) { try { console.error('blitz3d: recovery failed', e3); } catch (e4) {} } }
      }
    };
    if (DBG) DBG.api = api;

    // ---------- go ----------
    fit();
    try { setupGL(); } catch (err) {
      console.error(err); finished = true; cleanup();
      root.innerHTML = '<div class="bz-err"><b>NO 3D HERE</b>Sorry, your browser couldn\'t start the 3D graphics.</div>';
      setTimeout(() => done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, noGL: true, stats: {}, team: Object.assign({}, TS), highlights: [] }), 0);
      return { destroy() {} };
    }
    setupPlay();
    try { setupExtras(); } catch (e) { console.error(e); }
    updateCam(-1); updBug(); setControls(true);
    startLoop();
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Barlow Condensed"').then(() => {
        if (!G || glLost || finished) return;
        gl.deleteTexture(G.field); G.field = mkTex(fieldCanvas(quality >= 2 ? 2 : 1), false, false, 16); G.texs.push(G.field); statics.forEach((s) => { if (s.k === 'field') s.tex = G.field; });
        for (const k in numMap) delete numMap[k]; numN = 0; nameN = 0; for (const p of everyone) { p.ncell = p.num ? numCell(p.num) : -1; p.nmcell = p.sq && p.sq.name ? nameCell(shortName(p.sq.name)) : -1; }
        boardDirty = true;
      }).catch(() => {});
    } catch (e) {}
    return { destroy() { finishGame(true); } };
  }

  // =====================================================================================
  // Public API (Franchise mode) + the Arcade game
  // =====================================================================================
  window.MFLBlitz = {
    version: 2,
    play(root, opts) {
      return new Promise((resolve) => {
        let settled = false;
        const done = (r) => { if (settled) return; settled = true; resolve(r); };
        try { Game(root, opts || {}, done); } catch (e) {
          console.error(e);
          done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, stats: {}, team: { plays: 0, yards: 0, timeOfPoss: 0, turnovers: 0, sacks: 0, thirdDownConv: 0, thirdDownAtt: 0 }, highlights: [], error: String((e && e.message) || e) });
        }
      });
    },
  };
  if (window.MFLArcade && window.MFLArcade.register) {
    window.MFLArcade.register('blitz3d', {
      start(ctx) {
        const lvl = clamp(ctx.level | 0, 0, 3), data = ctx.data || {};
        const players = (Array.isArray(data.players) ? data.players : []).filter((p) => p && p.name).map((p, i) => Object.assign({ id: p.id != null ? p.id : 'arc' + i }, p));
        const t0 = players[0] || {};
        const home = { name: String(t0.team || 'MFL Stars'), abbr: String(t0.abbr || t0.team || 'MFL').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'MFL', color: t0.color || '#ffc21a', color2: t0.color2 || '#1b1e27', ovrOff: 66, ovrDef: 60, players };
        const away = CPU_TEAMS[lvl];
        window.MFLBlitz.play(ctx.root, { home, away, difficulty: [0, 0.33, 0.66, 1][lvl], seed: ctx.seed, quarterSecs: 120, timeouts: 2, weather: data.weather || 'night', label: (ctx.levelName || ['Rookie', 'Pro', 'All-Pro', 'Legend'][lvl]) + ' · Arcade' }).then((r) => {
          const won = !r.quit && r.homeScore > r.awayScore, tie = !r.quit && r.homeScore === r.awayScore;
          let tds = 0; for (const k in r.stats || {}) tds += (r.stats[k].rushTD || 0) + (r.stats[k].recTD || 0);
          const ab = esc(home.abbr), nm = esc(away.name);
          ctx.finish({
            won, tie, score: r.homeScore,
            detail: r.noGL ? 'Your browser can\'t run 3D (WebGL unavailable).' : r.quit ? `Quit at ${r.homeScore}–${r.awayScore} vs ${nm}` : won ? `You won ${r.homeScore}–${r.awayScore} vs ${nm}` : tie ? `Tied ${r.homeScore}–${r.awayScore} with ${nm}` : `You lost ${r.homeScore}–${r.awayScore} vs ${nm}`,
            stats: { tds, plays: r.team ? r.team.plays : 0, level: lvl, opp: r.awayScore, overtime: !!r.overtime, team: ab },
          });
        });
      },
    });
  }
})();
