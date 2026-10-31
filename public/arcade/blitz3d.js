// Blitz 3D (engine v2): an original arcade football game in raw WebGL, no libraries.
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
.bz-mv{display:grid;grid-template-columns:repeat(2,68px);gap:8px;margin-left:auto;flex:0 0 auto}
.bz-mv .bz-btn{min-height:60px;border-radius:50%;width:68px;height:68px;font-size:15px;padding:0}
.bz-mv .bz-btn i{position:absolute;left:0;bottom:0;height:4px;background:#fff;width:var(--cd,100%)}
.bz-mv .bz-btn.cool{opacity:.45}
.bz-catch{display:flex;gap:10px;margin-left:auto;flex:0 0 auto}
.bz-catch .bz-btn{width:84px;height:84px;border-radius:50%;flex:0 0 84px;font-size:19px}
.bz-arc{display:flex;flex:0 0 auto;border-radius:12px;overflow:hidden;border:2px solid rgba(255,255,255,.18)}
.bz-arc button{min-height:48px;padding:0 9px;background:rgba(22,25,34,.9);color:#c9ccd4;border:0;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.bz-arc button.sel{background:#ffc21a;color:#07080b}
.bz-tag{position:absolute;left:0;top:0;pointer-events:auto;display:flex;align-items:center;gap:4px;padding:3px 8px 3px 3px;border-radius:999px;border:2px solid #f5f6f8;background:rgba(15,17,23,.82);color:#f5f6f8;font:800 12px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;cursor:pointer}
.bz-tag i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 2px;border-radius:9px;background:#f5f6f8;color:#07080b;font:400 7px 'Press Start 2P',monospace}
.bz-tag em{font-style:normal;color:#ffc21a;font-size:11px}
.bz-tag.hide{display:none}
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
.bz-aim{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid rgba(255,255,255,.7);pointer-events:none;z-index:3}
.bz-aimln{position:absolute;height:3px;background:rgba(255,255,255,.55);transform-origin:0 50%;pointer-events:none;z-index:3;border-radius:2px}
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
.bz-land .bz-btn{min-height:48px}.bz-land .bz-mv .bz-btn{width:60px;height:60px;min-height:56px}.bz-land .bz-mv{grid-template-columns:repeat(4,60px)}
.bz-land .bz-catch .bz-btn{width:72px;height:72px;flex-basis:72px}
.bz-land .bz-sheet{max-height:92%}.bz-land .bz-cards{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}
.bz-land .bz-meter{bottom:calc(70px + env(safe-area-inset-bottom,0px))}.bz-land .bz-banner{top:42%}.bz-land .bz-banner b{font-size:17px}
.bz-narrow .bz-tm b{font-size:13px}.bz-narrow .bz-tm em{font-size:11px;min-width:16px}.bz-narrow .bz-clk{min-width:56px}.bz-narrow .bz-clk b{font-size:10px}
.bz-narrow .bz-dd{font-size:12.5px;padding:3px 7px}.bz-narrow .bz-btn{font-size:15px}.bz-narrow .bz-banner b{font-size:15px}.bz-narrow .bz-banner i{font-size:8px}.bz-narrow .bz-title{font-size:19px}
.bz-tiny .bz-snd{display:none}.bz-narrow .bz-tag{font-size:11px}.bz-narrow .bz-ib{min-width:32px;height:32px;padding:0 6px}.bz-narrow .bz-bug{gap:4px 4px;padding-left:6px;padding-right:6px}.bz-narrow .bz-tm{padding:3px 6px 3px 5px;gap:4px}.bz-narrow .bz-cards{grid-template-columns:1fr 1fr}.bz-narrow .bz-card span{display:none}.bz-narrow .bz-pc{display:none}
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

  // ---------- tiny affine matrix helpers (3x4 row-major) ----------
  const IDM = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  function mT(m, x, y, z) { return [m[0], m[1], m[2], m[0] * x + m[1] * y + m[2] * z + m[3], m[4], m[5], m[6], m[4] * x + m[5] * y + m[6] * z + m[7], m[8], m[9], m[10], m[8] * x + m[9] * y + m[10] * z + m[11]]; }
  function mRX(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0], m[1] * c + m[2] * s, m[2] * c - m[1] * s, m[3], m[4], m[5] * c + m[6] * s, m[6] * c - m[5] * s, m[7], m[8], m[9] * c + m[10] * s, m[10] * c - m[9] * s, m[11]]; }
  function mRY(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0] * c - m[2] * s, m[1], m[0] * s + m[2] * c, m[3], m[4] * c - m[6] * s, m[5], m[4] * s + m[6] * c, m[7], m[8] * c - m[10] * s, m[9], m[8] * s + m[10] * c, m[11]]; }
  function mRZ(m, a) { const c = Math.cos(a), s = Math.sin(a); return [m[0] * c + m[1] * s, m[1] * c - m[0] * s, m[2], m[3], m[4] * c + m[5] * s, m[5] * c - m[4] * s, m[6], m[7], m[8] * c + m[9] * s, m[9] * c - m[8] * s, m[10], m[11]]; }

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

  const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute vec2 aT;
uniform mat4 uVP;uniform vec3 uL;uniform vec3 uEye;uniform vec3 uFogR;uniform vec2 uUV;uniform vec2 uAmb;
varying vec4 vC;varying vec2 vT;varying float vF;
void main(){vec3 p=aP;gl_Position=uVP*vec4(p,1.0);float lit=1.0;
if(dot(aN,aN)>0.01){lit=uAmb.x+uAmb.y*max(dot(aN,uL),0.0)+0.14*aN.y;}
vC=vec4(aC.rgb*lit,aC.a);vT=aT+uUV;vF=clamp((distance(p,uEye)-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0)*uFogR.z;}`;
  const FS = `precision mediump float;uniform sampler2D uTex;uniform vec3 uFog;varying vec4 vC;varying vec2 vT;varying float vF;
void main(){vec4 c=vC*texture2D(uTex,vT);gl_FragColor=vec4(mix(c.rgb,uFog,vF),c.a);}`;

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
  // Formation spots (x, depth from the line of scrimmage). Keys: QB, RB, X (WR1), Z (WR2), S (slot / FB), Y (TE).
  const FORMS = {
    gun: { name: 'Shotgun', QB: [0, -5], RB: [-1.9, -5.2], X: [-13, -0.7], Z: [13, -0.7], S: [7.5, -1.4], Y: [3.9, -1.1], under: 0 },
    single: { name: 'Singleback', QB: [0, -1.3], RB: [0, -6.5], X: [-13, -0.7], Z: [13, -0.7], S: [8, -1.4], Y: [3.9, -1.1], under: 1 },
    iform: { name: 'I-Form', QB: [0, -1.3], RB: [0, -7], S: [0, -4.4], X: [-13, -0.7], Z: [13, -0.7], Y: [3.9, -1.1], under: 1 },
    trips: { name: 'Trips', QB: [0, -5], RB: [-1.9, -5.2], X: [-13, -0.7], Z: [14, -0.7], S: [10, -1.4], Y: [6, -1.4], under: 0 },
    empty: { name: 'Empty', QB: [0, -5], RB: [-7, -1.4], X: [-14, -0.7], Z: [14, -0.7], S: [8.5, -1.4], Y: [-3.9, -1.1], under: 0 },
  };
  // Route = waypoints [out, up] relative to the player's spot (out = toward his sideline), optional
  // sit (stop at the end), d (delay before release), blk (pass-block first, seconds). 'B' = block.
  const R = (w, o) => Object.assign({ w }, o || {});
  const PLAYS = [
    { id: 'zone', name: 'Inside Zone', form: 'single', cat: 'run', type: 'run', lane: 1.5, desc: 'Downhill run, read the hole', routes: { X: 'B', Z: 'B', S: 'B', Y: 'B' } },
    { id: 'power', name: 'Power O', form: 'iform', cat: 'run', type: 'run', lane: 3.4, lead: 1, desc: 'Fullback leads off tackle', routes: { X: 'B', Z: 'B', S: 'B', Y: 'B' } },
    { id: 'toss', name: 'Toss Sweep', form: 'iform', cat: 'run', type: 'run', lane: 11, toss: 1, lead: 1, desc: 'Pitch it outside, beat them to the edge', routes: { X: 'B', Z: 'B', S: 'B', Y: 'B' } },
    { id: 'draw', name: 'Draw', form: 'gun', cat: 'run', type: 'draw', lane: 0.8, desc: 'Fake pass, delayed handoff', routes: { X: R([[0, 14]]), Z: R([[0, 14]]), S: R([[0, 10]]), Y: 'B' } },
    { id: 'sneak', name: 'QB Sneak', form: 'single', cat: 'run', type: 'sneak', lane: 0, desc: 'Short yardage push', routes: { X: 'B', Z: 'B', S: 'B', Y: 'B', RB: 'B' } },
    { id: 'slant', name: 'Slant Flat', form: 'gun', cat: 'short', type: 'pass', desc: 'Quick inside breaks', routes: { X: R([[0, 3], [-10, 10]]), Z: R([[0, 3], [-10, 10]]), S: R([[3, 1], [9, 2]]), Y: R([[0, 18]]), RB: R([[-3, 0], [-8, 2]], { blk: 1 }) } },
    { id: 'mesh', name: 'Mesh', form: 'gun', cat: 'short', type: 'pass', desc: 'Two crossers rub underneath', routes: { X: R([[0, 10], [-10, 10]]), Z: R([[0, 10], [6, 17]]), S: R([[0, 2], [-18, 4]]), Y: R([[0, 2.5], [-16, 5]]), RB: R([[-3, 0], [-8, 1.5]], { blk: 0.8 }) } },
    { id: 'outs', name: 'Spread Outs', form: 'empty', cat: 'short', type: 'pass', desc: 'Five wide, quick outs', routes: { X: R([[0, 6], [5, 6]]), Z: R([[0, 6], [5, 6]]), S: R([[0, 5], [0.5, 4.5]], { sit: 1 }), Y: R([[0, 3], [-9, 9]]), RB: R([[0, 4], [4, 4]]) } },
    { id: 'curl', name: 'Curl Flat', form: 'single', cat: 'short', type: 'pass', desc: 'Curls sit in the holes', routes: { X: R([[0, 10], [1, 8.5]], { sit: 1 }), Z: R([[0, 10], [1, 8.5]], { sit: 1 }), S: R([[3, 1], [9, 2]]), Y: R([[0, 15]]), RB: 'B' } },
    { id: 'verts', name: 'Four Verts', form: 'gun', cat: 'deep', type: 'pass', desc: 'Stretch them deep', routes: { X: R([[0, 44]]), Z: R([[0, 44]]), S: R([[0, 6], [-2, 40]]), Y: R([[0, 40]]), RB: 'B' } },
    { id: 'smash', name: 'Smash', form: 'trips', cat: 'deep', type: 'pass', desc: 'Hitch under, corner over', routes: { Z: R([[0, 5], [0.5, 4.5]], { sit: 1 }), S: R([[0, 10], [7, 19]]), Y: R([[2, 1], [7, 2.5]]), X: R([[0, 12], [-8, 26]]), RB: 'B' } },
    { id: 'flood', name: 'Flood', form: 'trips', cat: 'deep', type: 'pass', desc: 'Three levels to one side', routes: { Z: R([[0, 40]]), S: R([[0, 11], [6, 11]]), Y: R([[3, 1], [8, 2.5]]), X: R([[0, 12], [-14, 12]]), RB: R([[-3, 0], [-8, 2]], { blk: 1.2 }) } },
    { id: 'papost', name: 'PA Post', form: 'single', cat: 'deep', type: 'pa', desc: 'Fake the run, go over the top', routes: { X: R([[0, 12], [-9, 28]]), Z: R([[0, 12], [-11, 12]]), S: R([[0, 40]]), Y: R([[0, 2], [-15, 6]], { d: 0.4 }), RB: 'B' } },
    { id: 'boot', name: 'PA Boot', form: 'iform', cat: 'trick', type: 'boot', desc: 'Fake, roll right, flood', routes: { X: R([[0, 8], [-24, 16]]), Z: R([[0, 30]]), S: R([[4, 0], [11, 2]], { d: 0.5 }), Y: R([[0, 6], [7, 13]], { d: 0.2 }), RB: 'B' } },
    { id: 'bubble', name: 'Bubble Screen', form: 'gun', cat: 'trick', type: 'screen', desc: 'Get it to the slot in space', routes: { S: R([[3, -2], [7, -2]], { sit: 1 }), X: 'B', Z: 'B', Y: 'B', RB: 'B' }, scr: 'S' },
    { id: 'rbscreen', name: 'RB Screen', form: 'gun', cat: 'trick', type: 'screen', desc: 'Let them in, dump it off', routes: { RB: R([[-4, -1], [-8, -1]], { sit: 1, d: 0.9 }), X: R([[0, 30]]), Z: R([[0, 30]]), S: R([[0, 25]]), Y: 'B' }, scr: 'RB' },
  ];
  const CATS = [['run', 'Run'], ['short', 'Short'], ['deep', 'Deep'], ['trick', 'Trick']];
  const ROUTE_NAMES = { go: 'Go', slant: 'Slant', out: 'Out', curl: 'Curl', post: 'Post' };
  const HOT = { go: R([[0, 40]]), slant: R([[0, 3], [-10, 10]]), out: R([[0, 6], [6, 6]]), curl: R([[0, 10], [1, 8.5]], { sit: 1 }), post: R([[0, 12], [-9, 26]]) };
  const HOT_ORDER = ['go', 'slant', 'out', 'curl', 'post'];

  // ---------- difficulty curve (0 = Rookie .. 1 = Legend) ----------
  // k: defensive talent 0..~1.1 from difficulty and the CPU team's ovrDef
  function defParams(k) {
    const L = (a, b) => a + (b - a) * clamp(k, 0, 1.15);
    return {
      cbV: L(6.75, 8.4), lbV: L(6.1, 7.5), dlV: L(5.4, 6.7), sV: L(6.6, 8.3),
      lag: L(0.62, 0.26), react: L(0.6, 0.3), cush: L(7.5, 4.5), zoneTight: L(0.45, 1),
      shedPass: L(4.2, 2.5), shedRun: L(2.4, 1.4), read: L(0.7, 0.34), bite: L(0.9, 0.25),
      tackle: L(46, 86), intSkill: L(0.08, 0.27), deflect: L(0.22, 0.4), stare: L(0.15, 0.6),
      blitz: L(0.06, 0.32), disguise: L(0, 0.7), pursuit: L(6.4, 8.35), stun: L(1.1, 0.5),
    };
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
    let cs = 20240611; const crand = () => ((cs = (cs * 1664525 + 1013904223) >>> 0) / 4294967296); // cosmetic only

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
    const away2 = cdist(O1, TEAM) < 0.35; // colors clash: CPU wears its alternate set
    const DEFA = O1, OPPCSS = css(lum(O1) < 0.2 ? O2 : O1), HOMECSS = css(lum(TEAM) < 0.2 ? TEAM2 : TEAM);
    const OFFC = { jer: TEAM, pad: shade(TEAM, 1.12), pant: TEAM2, helm: TEAM2, stripe: TEAM, num: TEAM2 };
    const DEFC = away2 ? { jer: O2, pad: shade(O2, 1.05), pant: O1, helm: O1, stripe: O2, num: O1 } : { jer: O1, pad: shade(O1, 1.12), pant: O2, helm: O1, stripe: O2, num: O2 };
    const VISOR = [0.04, 0.05, 0.08, 1], MASK = hex('#9aa0ad'), BALLC = hex('#7a3e17'), LACE = hex('#f5f6f8');
    const SKIN = ['#f3cfae', '#dcaa83', '#b98056', '#8a5535', '#5a361f'].map(hex);
    const CLEATS = { black: hex('#111318'), white: hex('#f2f4f7'), team: TEAM, gold: hex('#ffc21a'), red: hex('#d81f2a') };
    // defensive talent: mostly difficulty, nudged by the CPU team's defense rating
    const KDEF = clamp(Math.pow(DIFF, 0.8) * 0.8 + (AWAY.ovrDef - 62) / 250 + 0.05, 0, 1.12);
    const DP = defParams(KDEF);

    // ---------- the user's roster ----------
    const normPos = (p) => { const s = String(p.pos || '').toUpperCase().replace(/[^A-Z]/g, ''); return s === 'UTIL' || s === 'FLEX' || s === 'ATH' || s === 'SLOT' ? 'WR' : s; };
    const rat = (p, k, d) => { const v = p ? +p[k] : NaN; return clamp(isFinite(v) && v > 0 ? v : d, 25, 99); };
    const safeUrl = (u) => (typeof u === 'string' && /^\/[A-Za-z0-9_\-./%]+$/.test(u) && u.indexOf('..') < 0 ? u : null);
    const normLook = (l, dflt) => {
      l = l && typeof l === 'object' ? l : {};
      const sk = Number.isInteger(l.skin) ? clamp(l.skin, 0, 4) : dflt;
      return { skin: sk, hs: l.height === 'short' ? 0.93 : l.height === 'tall' ? 1.07 : 1, cleat: CLEATS[l.cleats] || CLEATS.black, visor: !!l.visor, sleeves: !!l.sleeves };
    };
    const pool = HOME.players.slice(), used = new Set();
    const take = (pred) => { const p = pool.find((q) => !used.has(q) && pred(q)); if (p) used.add(p); return p || null; };
    const isPos = (...ps) => (q) => ps.indexOf(normPos(q)) >= 0;
    const SK = {};
    SK.QB = take(isPos('QB')) || take((q) => !normPos(q) || normPos(q) === 'QB') || take(() => true);
    SK.RB = take(isPos('RB'));
    SK.X = take(isPos('WR')); SK.Z = take(isPos('WR')); SK.S = take(isPos('WR'));
    SK.Y = take(isPos('TE'));
    for (const k of ['X', 'Z', 'S', 'Y', 'RB']) if (!SK[k]) SK[k] = take(isPos('WR', 'TE', 'RB')) || take((q) => ['OL', 'DL', 'LB', 'DB', 'K'].indexOf(normPos(q)) < 0);
    const KICKER = take(isPos('K'));
    const OLP = [take(isPos('OL')), take(isPos('OL')), take(isPos('OL')), take(isPos('OL')), take(isPos('OL'))];
    const baseR = clamp(HOME.ovrOff, 35, 95);
    const GEN = { QB: ['QB', 7], RB: ['Runner', 22], X: ['Flash', 1], Z: ['Hands', 81], S: ['Rocket', 19], Y: ['Tank', 88] };
    const SQ = {}; // squad entries for the 6 skill spots (photos, names, ratings, stat ids)
    let sqi = 0;
    for (const k of ['QB', 'RB', 'X', 'Z', 'S', 'Y']) {
      const q = SK[k], g = GEN[k];
      const num = q && /^\d{1,2}$/.test(String(q.num != null ? q.num : q.number != null ? q.number : '').trim()) ? +(q.num != null ? q.num : q.number) : g[1];
      SQ[k] = {
        key: k, idx: sqi++, name: q ? String(q.name) : g[0], pid: q ? String(q.id != null ? q.id : q.name) : null, num, photo: q ? safeUrl(q.photo) : null,
        look: normLook(q && q.look, [1, 2, 0, 3, 1, 2][sqi - 1]), cell: -1,
        r: { spd: rat(q, 'spd', baseR), agi: rat(q, 'agi', rat(q, 'spd', baseR)), str: rat(q, 'str', baseR), cat: rat(q, 'cat', baseR), thr: rat(q, 'thr', baseR), acc: rat(q, 'acc', baseR), ovr: rat(q, 'ovr', baseR) },
      };
    }
    const KR = { name: KICKER ? String(KICKER.name) : 'Kicker', pid: KICKER ? String(KICKER.id != null ? KICKER.id : KICKER.name) : null, kick: rat(KICKER, 'kick', clamp(52 + (HOME.ovrOff - 60) * 0.5, 40, 80)) };
    const OLR = OLP.map((q, i) => ({ name: q ? String(q.name) : 'Lineman', num: q && (q.num != null ? +q.num : q.number != null ? +q.number : 0) || [72, 65, 55, 61, 77][i], str: rat(q, 'str', clamp(HOME.ovrOff, 40, 90)) }));
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

    // ---------- WebGL ----------
    let gl = null;
    try { gl = cv.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'low-power' }) || cv.getContext('experimental-webgl', { antialias: true, alpha: false }); } catch (e) { gl = null; }
    if (!gl) {
      root.innerHTML = '<div class="bz-err"><b>NO 3D HERE</b>Sorry, your browser can\'t run 3D graphics (WebGL is turned off or blocked on this device).</div>';
      setTimeout(() => done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, noGL: true, stats: {}, team: Object.assign({}, TS), highlights: [] }), 0);
      return { destroy() {} };
    }
    let G = null, glLost = false;
    const statics = [];
    function mkTex(src, repeat) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (src.width) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const mip = !!src.width;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (mip) {
        gl.generateMipmap(gl.TEXTURE_2D);
        const an = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
      return t;
    }
    // sky / light / fog per weather
    const SKY = {
      night: { top: [0.015, 0.025, 0.07], hor: [0.13, 0.17, 0.3], fog: [0.13, 0.17, 0.3], fogR: [70, 230, 0.75], amb: [0.42, 0.62], L: [0.35, 0.86, -0.38], glow: 1 },
      clear: { top: [0.2, 0.42, 0.78], hor: [0.62, 0.74, 0.88], fog: [0.62, 0.72, 0.84], fogR: [90, 300, 0.6], amb: [0.5, 0.6], L: [-0.45, 0.8, 0.3], glow: 0.35 },
      rain: { top: [0.1, 0.12, 0.15], hor: [0.27, 0.3, 0.34], fog: [0.27, 0.3, 0.34], fogR: [35, 150, 0.85], amb: [0.45, 0.45], L: [0.2, 0.9, -0.3], glow: 0.9 },
      snow: { top: [0.33, 0.36, 0.42], hor: [0.7, 0.72, 0.76], fog: [0.7, 0.72, 0.76], fogR: [30, 140, 0.85], amb: [0.55, 0.45], L: [0.2, 0.9, -0.3], glow: 0.7 },
    }[WX];
    function setupGL() {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      G = { pr, a: {}, u: {}, bufs: [], texs: [] };
      ['aP', 'aN', 'aC', 'aT'].forEach((n) => { G.a[n] = gl.getAttribLocation(pr, n); gl.enableVertexAttribArray(G.a[n]); });
      ['uVP', 'uL', 'uEye', 'uFogR', 'uFog', 'uTex', 'uUV', 'uAmb'].forEach((n) => { G.u[n] = gl.getUniformLocation(pr, n); });
      G.white = mkTex(new Uint8Array([255, 255, 255, 255]));
      G.field = mkTex(fieldCanvas());
      G.crowd = mkTex(crowdCanvas(), true);
      G.board = mkTex(boardCanvas()); boardDirty = false;
      G.atlas = mkTex(atlas); atlasDirty = true;
      G.texs.push(G.white, G.field, G.crowd, G.board, G.atlas);
      G.dyn = gl.createBuffer(); G.tr = gl.createBuffer(); G.fb = gl.createBuffer();
      G.bufs.push(G.dyn, G.tr, G.fb);
      statics.length = 0;
      const W = buildWorld();
      for (const k of ['plain', 'field', 'crowd', 'glow', 'board']) {
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, W[k].f.subarray(0, W[k].n * 12), gl.STATIC_DRAW);
        G.bufs.push(b);
        statics.push({ k, b, n: W[k].n, tex: k === 'field' ? G.field : k === 'crowd' ? G.crowd : k === 'board' ? G.board : G.white });
      }
      const sky = new Batch(8), top = SKY.top.concat(1), hor = SKY.hor.concat(1);
      sky.v(-1, -1, 0.999, 0, 0, 0, hor, 0.5, 0.5); sky.v(1, -1, 0.999, 0, 0, 0, hor, 0.5, 0.5); sky.v(1, 1, 0.999, 0, 0, 0, top, 0.5, 0.5);
      sky.v(-1, -1, 0.999, 0, 0, 0, hor, 0.5, 0.5); sky.v(1, 1, 0.999, 0, 0, 0, top, 0.5, 0.5); sky.v(-1, 1, 0.999, 0, 0, 0, top, 0.5, 0.5);
      G.sky = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.sky); gl.bufferData(gl.ARRAY_BUFFER, sky.f.subarray(0, 72), gl.STATIC_DRAW); G.bufs.push(G.sky);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(SKY.hor[0], SKY.hor[1], SKY.hor[2], 1);
      gl.uniform1i(G.u.uTex, 0);
      const l = SKY.L, ll = Math.hypot(l[0], l[1], l[2]);
      gl.uniform3f(G.u.uL, l[0] / ll, l[1] / ll, l[2] / ll);
      gl.uniform3f(G.u.uFog, SKY.fog[0], SKY.fog[1], SKY.fog[2]);
      gl.uniform2f(G.u.uAmb, SKY.amb[0], SKY.amb[1]);
      gl.uniform2f(G.u.uUV, 0, 0);
    }

    // ---------- textures ----------
    const ezOwn = shade(TEAM, 0.55), ezFar = shade(DEFA, 0.6);
    function fieldCanvas() {
      cs = 20240611;
      const c = document.createElement('canvas'); c.width = 1024; c.height = 2048; const g = c.getContext('2d');
      const SX = 1024 / 60, SZ = 2048 / 124, X = (x) => (x + 30) * SX, Z = (z) => (z + 12) * SZ;
      const dark = WX === 'snow' ? '#5f7f68' : '#1d4f27', st1 = WX === 'snow' ? '#7f9c84' : WX === 'rain' ? '#27693a' : '#2e7a37', st2 = WX === 'snow' ? '#86a28b' : WX === 'rain' ? '#2c723f' : '#34873f';
      g.fillStyle = dark; g.fillRect(0, 0, 1024, 2048);
      for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? st1 : st2; g.fillRect(X(-HW), Z(i * 5), X(HW) - X(-HW), 5 * SZ + 1); }
      g.fillStyle = css(ezOwn); g.fillRect(X(-HW), Z(-10), X(HW) - X(-HW), 10 * SZ);
      g.fillStyle = css(ezFar); g.fillRect(X(-HW), Z(100), X(HW) - X(-HW), 10 * SZ);
      for (let i = 0; i < 14000; i++) { g.fillStyle = crand() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'; g.fillRect(crand() * 1024, crand() * 2048, 1 + crand() * 2, 2 + crand() * 4); }
      if (WX === 'snow') for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.1 + crand() * 0.25) + ')'; g.fillRect(crand() * 1024, crand() * 2048, 2 + crand() * 6, 2 + crand() * 6); }
      g.fillStyle = '#f2f5ee';
      const ln = (x0, z0, x1, z1) => g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
      for (let z = 0; z <= 100; z += 5) { const w = z % 100 === 0 ? 0.2 : 0.12; ln(-HW, z - w, HW, z + w); }
      ln(-HW - 1.4, -10.4, -HW, 110.4); ln(HW, -10.4, HW + 1.4, 110.4); ln(-HW - 1.4, -11.4, HW + 1.4, -10); ln(-HW - 1.4, 110, HW + 1.4, 111.4);
      for (let z = 1; z < 100; z++) {
        if (z % 5 === 0) continue;
        for (const hx of [-3.08, 3.08]) ln(hx - 0.35, z - 0.06, hx + 0.35, z + 0.06);
        ln(-HW + 0.3, z - 0.06, -HW + 1.0, z + 0.06); ln(HW - 1.0, z - 0.06, HW - 0.3, z + 0.06);
      }
      ln(-0.5, 2.94, 0.5, 3.06); ln(-0.5, 96.94, 0.5, 97.06); // try-point marks
      const txt = (s, x, z, rot, hYd, col, maxW) => {
        g.save(); g.translate(X(x), Z(z)); g.scale(1, -1); g.rotate(rot);
        g.font = `900 ${Math.round(hYd * SZ * 1.32)}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (maxW) { const w = g.measureText(s).width; if (w > maxW * SX) g.scale((maxW * SX) / w, 1); }
        g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
      };
      for (let z = 10; z <= 90; z += 10) {
        const n = String(z <= 50 ? z : 100 - z);
        txt(n, -HW + 9, z, -Math.PI / 2, 2, 'rgba(242,245,238,.92)'); txt(n, HW - 9, z, Math.PI / 2, 2, 'rgba(242,245,238,.92)');
        if (z !== 50) {
          const dz = z < 50 ? -1 : 1;
          for (const sx of [-1, 1]) { const x = sx * (HW - 9), zz = z + dz * 2.6; g.beginPath(); g.moveTo(X(x - 0.45), Z(zz)); g.lineTo(X(x + 0.45), Z(zz)); g.lineTo(X(x), Z(zz + dz * 0.8)); g.fill(); }
        }
      }
      g.beginPath(); g.arc(X(0), Z(50), 5.2 * SX, 0, 6.2832); g.fillStyle = css(shade(TEAM, 0.9)); g.fill();
      g.lineWidth = 0.35 * SX; g.strokeStyle = '#f2f5ee'; g.stroke();
      txt(HOME.abbr, 0, 50, 0, 3.2, css(TEAM2), 8);
      txt(HOME.name.toUpperCase(), 0, -5, Math.PI, 5.2, css(lum(TEAM) > 0.55 ? shade(TEAM, 1.15) : hex('#f2f5ee')), 40);
      txt(AWAY.name.toUpperCase(), 0, 105, 0, 5.4, css(O2[0] + O2[1] + O2[2] > 1.2 ? O2 : hex('#f2f5ee')), 40);
      // sideline team areas
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(X(-29.9), Z(30), X(-28.3) - X(-29.9), Z(70) - Z(30)); g.fillRect(X(28.3), Z(30), X(29.9) - X(28.3), Z(70) - Z(30));
      return c;
    }
    function crowdCanvas() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#0c0e14'; g.fillRect(0, 0, 256, 256);
      const pal = [css(TEAM), css(TEAM), css(TEAM2), css(DEFA), '#eef1f5', '#3a4152', '#6f7584', '#2a3b6b', css(shade(TEAM, 0.6))];
      for (let row = 0; row < 8; row++) {
        const y = row * 32;
        g.fillStyle = '#161922'; g.fillRect(0, y + 26, 256, 6);
        for (let x = 2; x < 256; x += 7 + crand() * 4) {
          if (crand() < 0.08) continue;
          const up = crand() < 0.25 ? 5 : 0;
          g.fillStyle = pal[(crand() * pal.length) | 0]; g.fillRect(x, y + 13 - up, 6, 13 + up);
          g.fillStyle = SKIN[(crand() * 5) | 0] ? css(SKIN[(crand() * 5) | 0]) : '#e0b48a'; g.fillRect(x + 1, y + 7 - up, 4, 5);
          if (up) g.fillRect(x - 1, y + 2, 2, 8);
        }
      }
      return c;
    }
    // jumbotron at the far end, redrawn when the score changes
    let boardDirty = true;
    const boardC = document.createElement('canvas'); boardC.width = 512; boardC.height = 256;
    function boardCanvas() {
      const g = boardC.getContext('2d');
      g.fillStyle = '#05070c'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = css(TEAM); g.fillRect(0, 0, 256, 54); g.fillStyle = css(DEFA); g.fillRect(256, 0, 256, 54);
      g.font = '900 40px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = css(TEAM2); g.fillText(HOME.abbr, 128, 29); g.fillStyle = css(away2 ? O1 : O2); g.fillText(AWAY.abbr, 384, 29);
      g.fillStyle = '#ffc21a'; g.font = '900 120px "Barlow Condensed", Impact, sans-serif';
      g.fillText(String(typeof hs === 'number' ? hs : 0), 128, 140); g.fillText(String(typeof as === 'number' ? as : 0), 384, 140);
      g.fillStyle = '#9aa0ad'; g.font = '800 34px "Barlow Condensed", Impact, sans-serif';
      g.fillText(typeof qtr === 'number' ? (qtr > 4 ? 'OT' : 'Q' + qtr) + '  ' + fmtClock(clock) : '', 256, 226);
      return boardC;
    }
    function buildWorld() {
      cs = 777;
      const W = { plain: new Batch(6000), field: new Batch(12), crowd: new Batch(80), glow: new Batch(600), board: new Batch(12) };
      const up = [0, 1, 0];
      W.field.quad([-30, 0, -12], [30, 0, -12], [30, 0, 112], [-30, 0, 112], up, [1, 1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
      const turf = WX === 'snow' ? [0.55, 0.6, 0.58, 1] : [0.1, 0.27, 0.14, 1], wall = [0.07, 0.08, 0.1, 1], dark = [0.05, 0.055, 0.07, 1], band = TEAM;
      W.plain.quad([-80, -0.02, -60], [80, -0.02, -60], [80, -0.02, 170], [-80, -0.02, 170], up, turf);
      // side walls with padding band and ad boards, stands, upper deck
      for (const s of [-1, 1]) {
        W.plain.wbox(s * 34, 0, -24, s * 34.7, 1.9, 124, wall);
        for (let z = -22; z < 122; z += 12) W.plain.wbox(s * 33.97, 0.5, z, s * 34.05, 1.75, z + 11.2, (Math.round(z / 12) & 1) ? band : shade(DEFA, 0.9));
        const sl = Math.hypot(25.3, 19.1);
        W.crowd.quad([s * 34.7, 1.9, -24], [s * 34.7, 1.9, 124], [s * 60, 21, 124], [s * 60, 21, -24], [-s * 0.6, 0.8, 0], [1, 1, 1, 1], [0, 0, 148 / 9, 0, 148 / 9, sl / 6, 0, sl / 6]);
        W.plain.wbox(s * 47, 10.5, -24, s * 47.6, 11.4, 124, [0.1, 0.11, 0.14, 1]); // aisle rail / club level
        W.glow.wbox(s * 46.95, 10.6, -24, s * 47.0, 11.3, 124, mixc(TEAM, [1, 1, 1, 1], 0.25));
        W.plain.wbox(s * 60, 0, -50, s * 62, 26, 124, dark);
        W.plain.wbox(s * 40, 23, -50, s * 62, 24, 124, [0.1, 0.11, 0.14, 1]);
        for (let z = -40; z <= 120; z += 20) W.plain.wbox(s * 41, 21, z - 0.4, s * 41.8, 23, z + 0.4, [0.12, 0.13, 0.16, 1]);
        W.glow.wbox(s * 40.2, 22.6, -50, s * 41, 23, 124, [1, 0.95, 0.75, 1].map((v, i) => (i < 3 ? v * (0.4 + 0.6 * SKY.glow) : 1)));
        // benches and sideline crowd of players / staff
        W.plain.wbox(s * 31, 0, 32, s * 32.2, 0.55, 68, [0.15, 0.16, 0.2, 1]);
        for (let z = 30; z <= 70; z += 1.3) {
          if (crand() < 0.3) continue;
          const x = s * (29.6 + crand() * 2.6), h = 1.7 + crand() * 0.4, cc = s < 0 ? shade(TEAM, 0.7 + crand() * 0.3) : shade(DEFA, 0.7 + crand() * 0.3);
          W.plain.wbox(x - 0.25, 0, z - 0.2, x + 0.25, h, z + 0.2, cc);
          W.plain.wbox(x - 0.18, h, z - 0.18, x + 0.18, h + 0.34, z + 0.18, s < 0 ? TEAM2 : DEFC.helm);
        }
      }
      // end zones: walls, stands, jumbotron (far), stands (near)
      for (const [zw, dir] of [[123, 1], [-24.7, -1]]) {
        W.plain.wbox(-34.7, 0, zw, 34.7, 1.9, zw + 0.7, wall);
        W.plain.wbox(-34.7, 0.5, dir > 0 ? zw - 0.03 : zw + 0.73, 34.7, 1.75, dir > 0 ? zw + 0.05 : zw + 0.65, band);
        const z0 = dir > 0 ? zw + 0.7 : zw, z1 = z0 + dir * 24, sl = Math.hypot(24, 19.1);
        W.crowd.quad([-62, 1.9, z0], [62, 1.9, z0], [62, 21, z1], [-62, 21, z1], [0, 0.8, -0.6 * dir], [1, 1, 1, 1], [0, 0, 124 / 9, 0, 124 / 9, sl / 6, 0, sl / 6]);
        W.plain.wbox(-62, 0, z1, 62, 26, z1 + dir * 2, dark);
      }
      W.plain.wbox(-15, 21, 140, 15, 35, 142, [0.06, 0.065, 0.08, 1]);
      W.board.quad([14, 22.2, 139.9], [-14, 22.2, 139.9], [-14, 33.8, 139.9], [14, 33.8, 139.9], [0, 0, 0], [1, 1, 1, 1], [0, 1, 1, 1, 1, 0, 0, 0]);
      for (let i = 0; i < 4; i++) W.plain.wbox(-6 + i * 4, 0, 141, -5 + i * 4, 21, 142, dark);
      // light towers
      for (const [x, z] of [[-48, -6], [48, -6], [-48, 60], [48, 60], [-48, 116], [48, 116]]) {
        W.plain.wbox(x - 0.5, 0, z - 0.5, x + 0.5, 34, z + 0.5, [0.18, 0.19, 0.22, 1]);
        const sx = x < 0 ? 1 : -1;
        W.plain.wbox(x - 3, 33, z - 3.5, x + 3, 38, z + 3.5, [0.12, 0.13, 0.15, 1]);
        const lc = [1, 0.97, 0.86, 1].map((v, i) => (i < 3 ? v * (0.35 + 0.65 * SKY.glow) : 1));
        for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) W.glow.wbox(x + sx * 3.02, 33.5 + r * 1.4, z - 3.1 + q * 1.6, x + sx * 3.1, 34.6 + r * 1.4, z - 1.8 + q * 1.6, lc);
      }
      // goal posts
      const gp = [1, 0.84, 0.1, 1];
      for (const [zl, dir] of [[110, 1], [-10, -1]]) {
        const zb = zl + dir * 1.2;
        W.plain.wbox(-0.15, 0, zb - 0.15, 0.15, 3.35, zb + 0.15, gp);
        W.plain.wbox(-0.12, 3.2, Math.min(zb, zl) - 0.1, 0.12, 3.4, Math.max(zb, zl) + 0.1, gp);
        W.plain.wbox(-3.1, 3.25, zl - 0.1, 3.1, 3.45, zl + 0.1, gp);
        for (const s of [-1, 1]) { W.plain.wbox(s * 3.08 - 0.08, 3.25, zl - 0.08, s * 3.08 + 0.08, 11, zl + 0.08, gp); W.plain.wbox(s * 3.08 - 0.05, 11, zl - 0.05, s * 3.08 + 0.05, 11.6, zl + 0.05, [1, 0.3, 0.2, 1]); }
        W.plain.wbox(-0.4, 0, zb - 0.4, 0.4, 0.9, zb + 0.4, [0.12, 0.13, 0.16, 1]);
      }
      for (const z of [-10, 0, 100, 110]) for (const s of [-1, 1]) W.plain.wbox(s * HW - 0.17, 0, z - 0.17, s * HW + 0.17, 0.55, z + 0.17, [1, 0.45, 0.05, 1]);
      return W;
    }

    // ---------- atlas: player photos (6 cells of 256) + jersey/helmet numbers (128px, transparent) ----------
    const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 1024;
    const ag = atlas.getContext('2d');
    let atlasDirty = true;
    const numMap = {};
    let numN = 0;
    function numCell(n, team) {
      const key = n + '|' + team;
      if (numMap[key] != null) return numMap[key];
      if (numN >= 32) return -1;
      const k = numN++, x = (k % 8) * 128, y = 512 + Math.floor(k / 8) * 128;
      ag.clearRect(x, y, 128, 128);
      ag.font = '900 96px "Barlow Condensed", Impact, "Arial Narrow", sans-serif'; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      ag.lineWidth = 9; ag.strokeStyle = css(team ? DEFC.jer : OFFC.jer); ag.strokeText(String(n), x + 64, y + 68, 112);
      ag.fillStyle = css(team ? DEFC.num : OFFC.num); ag.fillText(String(n), x + 64, y + 68, 112);
      atlasDirty = true;
      return (numMap[key] = 100 + k);
    }
    function cellUV(c) {
      if (c >= 100) { const k = c - 100, x = (k % 8) * 128, y = 512 + Math.floor(k / 8) * 128; return [(x + 6) / 1024, (y + 6) / 1024, (x + 122) / 1024, (y + 122) / 1024]; }
      const x = (c % 4) * 256, y = Math.floor(c / 4) * 256; return [(x + 6) / 1024, (y + 6) / 1024, (x + 250) / 1024, (y + 250) / 1024];
    }
    const SQL = Object.values(SQ);
    SQL.forEach((q) => {
      if (!q.photo) return;
      const img = new Image();
      img.onload = () => {
        if (finished) return;
        try {
          const w = img.naturalWidth, h = img.naturalHeight, sz = Math.min(w, h) * 0.42, cx = (q.idx % 4) * 256, cy = Math.floor(q.idx / 4) * 256;
          ag.fillStyle = css(SKIN[q.look.skin]); ag.fillRect(cx, cy, 256, 256);
          ag.drawImage(img, w * 0.5 - sz / 2, h * 0.43 - sz / 2, sz, sz, cx, cy, 256, 256);
          q.cell = q.idx; atlasDirty = true;
          for (const p of everyone) if (p.sq === q) { p.face = q.cell; }
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

    // ---------- layout: fills the viewport on phones, 16:9 on desktop; edge-to-edge in landscape ----------
    let cssW = 360, cssH = 270, rscale = 1, por = 0, lnd = 0;
    const touchy = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window && (navigator.maxTouchPoints || 0) > 0);
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
      const fs = fsEl() === wrap, mob = fs || touchy || vw < 700, land = vw > vh;
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
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }
    function scrollIn() {
      if (fsEl()) return;
      try { const t = wrap.getBoundingClientRect().top + window.scrollY - headerH() - 2; window.scrollTo(0, Math.max(0, t)); } catch (e) {}
    }
    function toggleFS() {
      try {
        if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        const r = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
        if (r) { const pr = r.call(wrap, { navigationUI: 'hide' }); if (pr && pr.catch) pr.catch(() => {}); }
      } catch (e) {}
    }

    // ---------- game state ----------
    let phase = 'splash', qtr = 1, clock = QS, hs = 0, as = 0, finished = false;
    let los = 25, down = 1, fdz = 35, play = PLAYS[5], flip = false, hot = {}, dcall = null, tryMode = false, lastCat = 'short';
    let tPlay = 0, clockRun = false, toLeft = TOS, playClock = 20, warned = [false, false], recv2 = 'away', otLeft = 0, suddenDeath = false, otCount = 0;
    let everyone = [], off = [], def = [], OK = {}, DK = {};
    let ball = null, ctrl = null, carrier = null, mode = 'none', passer = null, target = null, thrown = false, handed = false, runSeen = -1, crossed = false;
    let aim = null, arc = 1, pend = null, deadT = 0, deadTot = 0, closeP = null, intro = 0, introCut = false, kick = null, cpuD = null, brk = null;
    let pr = null; // current play record (for stats / commentary)
    let excite = 0, parts = [], wxp = [], driveStart = 25, drivePlays = 0, possT = 0, replayBuf = [], replay = null, recT = 0, lastBig = null;
    const cam = { e: [0, 15, 6], c: [0, 0, 34], fov: 1 };
    const input = { l: 0, r: 0, u: 0, d: 0, stick: null };
    const GRAV = 12;
    const fmtClock = (c) => { c = Math.max(0, Math.ceil(c)); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
    const ballTxt = (z) => { z = Math.round(z); return z === 50 ? 'Midfield' : z < 50 ? 'Own ' + z : 'Opp ' + (100 - z); };
    const ddTxt = () => (tryMode ? 'Try' : `${ORD[Math.min(down, 4)]} & ${fdz >= 100 ? 'Goal' : Math.max(1, Math.round(fdz - los))}`);
    const WARN = QS >= 240 ? 120 : Math.round(QS * 0.25);

    function mkP(side, role, key, x, z, o) {
      return Object.assign({ side, role, key, x, z, y: 0, vx: 0, vz: 0, h: side ? Math.PI : 0, ph: crand() * 6, fall: 0, fallT: 0, stun: 0, eng: null, engT: 0, shed: 2, imm: 0, immOf: null,
        w: 1, armT: 0, cel: 0, reach: 0, pose: 'stance', lk: normLook(null, (crand() * 5) | 0), num: 0, face: -1, ncell: -1, hcell: -1, sq: null, v: 7, acc: 9, str: 60, agi: 60, cat: 50,
        jumpY: 0, jumpV: 0, jumpT: 0, diveT: 0, ddx: 0, ddz: 1, mvT: 0, mvCd: { juke: 0, spin: 0, stiff: 0 }, spin: 0, wrapT: 0, wrapBy: null, touched: 0, tried: 0, hold: false, face2: null, R: null, ass: null, tgt: null, blk: null, lastTackle: -9 }, o || {});
    }
    // offense speeds: ratings 30..99 -> yd/s
    const spdV = (s) => 6.6 + (s - 30) * 0.036;
    function offPlayer(key, x, z) {
      const q = SQ[key];
      const role = key === 'QB' ? 'QB' : key === 'RB' ? 'RB' : key === 'Y' ? 'TE' : 'WR';
      const p = mkP(0, role, key, x, z, { lk: q.look, num: q.num, sq: q, face: q.cell, v: spdV(q.r.spd) * (key === 'Y' ? 0.96 : key === 'QB' ? 0.94 : 1) * (1 - WET * 0.03), str: q.r.str, agi: q.r.agi, cat: q.r.cat });
      p.acc = 8 + (q.r.agi - 50) * 0.06;
      return p;
    }
    function buildRoute(p, r) {
      const s = p.x < -0.5 ? -1 : p.x > 0.5 ? 1 : (flip ? -1 : 1), pts = [[p.x, p.z]];
      for (const [o, u] of r.w) pts.push([clamp(p.x + s * o, -25.5, 25.5), clamp(p.z + u, -9, 108.5)]);
      const seg = [];
      for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 0.001; seg.push({ x: pts[i - 1][0], z: pts[i - 1][1], dx: dx / l, dz: dz / l, l }); }
      return { pts, seg, sit: !!r.sit, s, d: (r.d || 0) + (r.blk || 0), blk: r.blk || 0, v: p.v * 0.97 };
    }
    function posAt(R, t) {
      const v = R.v;
      let d = Math.max(0, t - 0.08 - R.d) * v;
      const moving = t > 0.08 + R.d;
      for (const s of R.seg) {
        if (d <= s.l) return { x: s.x + s.dx * d, z: s.z + s.dz * d, vx: moving ? s.dx * v : 0, vz: moving ? s.dz * v : 0 };
        d -= s.l;
      }
      const s = R.seg[R.seg.length - 1], ex = s.x + s.dx * s.l, ez = s.z + s.dz * s.l;
      if (R.sit) return { x: ex, z: ez, vx: 0, vz: 0 };
      const x = ex + s.dx * d, z = ez + s.dz * d, cx = clamp(x, -25.5, 25.5), cz = clamp(z, -9, 108.5);
      return { x: cx, z: cz, vx: cx === x ? s.dx * v : 0, vz: cz === z ? s.dz * v : 0 };
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
    function clearPlayers() { off = []; def = []; everyone = []; OK = {}; DK = {}; }
    function addOff(p) { off.push(p); everyone.push(p); OK[p.key] = p; return p; }
    function addDef(p) { def.push(p); everyone.push(p); DK[p.key] = p; return p; }
    function setupPlay() {
      clearPlayers();
      tPlay = 0; ctrl = null; carrier = null; mode = 'none'; thrown = false; handed = false; runSeen = -1; crossed = false; aim = null; target = null; passer = null;
      parts = parts.filter((q) => q.life > 0); recT = 0; replayBuf = [];
      const F = FORMS[play.form], fx = flip ? -1 : 1, zc = (z) => clamp(z, -8, 108);
      for (const k of ['QB', 'RB', 'X', 'Z', 'S', 'Y']) {
        const sp = F[k]; let x = sp[0] * fx, z = los + sp[1];
        if (k === 'Y' && play.form === 'gun' && play.id !== 'rbscreen') x = 3.9 * fx;
        addOff(offPlayer(k, x, z));
      }
      for (let i = 0; i < 5; i++) {
        const o = OLR[i];
        addOff(mkP(0, 'OL', 'OL' + i, (i - 2) * 1.95, los - 0.9, { w: 1.32, num: o.num, str: o.str, v: 5.6 + (o.str - 50) * 0.01, lk: normLook(null, (crand() * 5) | 0) }));
      }
      // routes / jobs
      for (const k of ['X', 'Z', 'S', 'Y', 'RB']) {
        const p = OK[k], r0 = hot[k] ? HOT[hot[k]] : play.routes[k];
        p.blk = null; p.R = null;
        if (r0 && r0 !== 'B') p.R = buildRoute(p, r0);
        else p.blk = 'block';
        if (r0 && r0.blk) p.blk = 'chip';
      }
      if (play.type === 'run' || play.type === 'draw' || play.type === 'sneak') for (const k of ['X', 'Z', 'S', 'Y']) if (!play.routes[k] || play.routes[k] === 'B') { OK[k].R = null; OK[k].blk = 'block'; }
      // defense
      dcall = chooseDef();
      const sgn = OK.Y.x >= 0 ? 1 : -1, cush = DP.cush;
      const D = (role, key, x, z, o) => addDef(mkP(1, role, key, x, z, Object.assign({ v: role === 'CB' ? DP.cbV : role === 'S' ? DP.sV : role === 'LB' ? DP.lbV : DP.dlV, str: 50 + 30 * KDEF + (role === 'DL' ? 6 : 0), agi: 48 + 38 * KDEF }, o)));
      D('DL', 'DE1', -4.6, los + 0.9, { w: 1.22, num: 91 }); D('DL', 'DT1', -1.35, los + 0.9, { w: 1.32, num: 97 });
      D('DL', 'DT2', 1.35, los + 0.9, { w: 1.32, num: 93 }); D('DL', 'DE2', 4.6, los + 0.9, { w: 1.22, num: 99 });
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
      // assignments
      const Z_ = (x, z, deep) => ({ t: 'zone', x, z, deep: !!deep });
      const man = (k) => ({ t: 'man', tgt: OK[k] });
      const A = {};
      const c = dcall.cov;
      if (c === 0) Object.assign(A, { CB1: man('X'), CB2: man('Z'), LBS: man('S'), SS: man('Y'), LBM: man('RB'), LBW: { t: 'rush' }, FS: { t: 'rush' } });
      else if (c === 1) Object.assign(A, { CB1: man('X'), CB2: man('Z'), LBS: man('S'), SS: man('Y'), LBM: man('RB'), FS: Z_(0, 22, 1), LBW: dcall.blitz ? { t: 'rush' } : Z_(0, 8) });
      else if (c === 2) Object.assign(A, { CB1: Z_(-16, 4), CB2: Z_(16, 4), FS: Z_(-10, 20, 1), SS: Z_(10, 20, 1), LBW: Z_(-8, 9), LBM: Z_(0, 10), LBS: Z_(8, 9) });
      else if (c === 3) Object.assign(A, { CB1: Z_(-16, 20, 1), CB2: Z_(16, 20, 1), FS: Z_(0, 23, 1), SS: Z_(sgn * 14, 6), LBW: Z_(-sgn * 14, 5), LBM: Z_(0, 9), LBS: Z_(sgn * 6, 9) });
      else Object.assign(A, { CB1: Z_(-17, 18, 1), FS: Z_(-6, 21, 1), SS: Z_(6, 21, 1), CB2: Z_(17, 18, 1), LBW: Z_(-14, 5), LBM: Z_(0, 9), LBS: Z_(14, 5) });
      if (c >= 2 && dcall.blitz) A[rng() < 0.5 ? 'LBM' : 'LBW'] = { t: 'rush' };
      for (const k of ['DE1', 'DT1', 'DT2', 'DE2']) A[k] = { t: 'rush' };
      // man assignment on a blocker -> green-dog rush or robber
      for (const k in A) if (A[k].t === 'man' && A[k].tgt && A[k].tgt.blk === 'block') A[k] = KDEF > 0.5 && rng() < 0.5 ? { t: 'rush' } : Z_(0, 8);
      for (const d of def) {
        d.ass = A[d.key] || Z_(0, 9);
        d.lagK = 0.8 + rng() * 0.45; d.spdK = 0.96 + rng() * 0.08;
        d.tackle = DP.tackle * (0.9 + rng() * 0.2);
      }
      if (dcall.stunt) { DK.DT1.stunt = -1; DK.DE1.stunt = 1; }
      // numbers / faces
      for (const p of everyone) {
        p.ncell = p.num ? numCell(p.num, p.side) : -1;
        p.hcell = p.side === 0 && p.sq && p.face < 0 ? p.ncell : -1;
        p.h = p.side ? Math.PI : 0;
      }
      ball = { st: 'spot', x: 0, y: 0.15, z: los, holder: null };
      pr = null;
    }

    // ---------- movement ----------
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
    function integrate(p, dt) {
      if (p.fallT || p.fall > 0.5) { p.vx *= Math.pow(0.02, dt); p.vz *= Math.pow(0.02, dt); }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const sp = Math.hypot(p.vx, p.vz);
      if (p.face2 != null) p.h += angDiff(p.face2, p.h) * Math.min(1, dt * 9);
      else if (sp > 0.6 && p.fall <= 0 && !p.hold) { const dh = angDiff(Math.atan2(p.vx, p.vz), p.h) * Math.min(1, dt * (p === ctrl ? 14 : 9)); p.h += dh; p.roll = (p.roll || 0) * 0.85 + clamp(dh / Math.max(dt, 1e-3), -6, 6) * 0.15 * Math.min(1, sp / 6); }
      else p.roll = (p.roll || 0) * 0.85;
      p.ph += sp * dt * 1.9;
      if (p.jumpT > 0 || p.jumpY > 0) { p.jumpV -= 22 * dt; p.jumpY = Math.max(0, p.jumpY + p.jumpV * dt); p.jumpT = Math.max(0, p.jumpT - dt); }
      if (p.diveT > 0) p.diveT -= dt;
    }
    const isRec = (p) => p.side === 0 && (p.key === 'X' || p.key === 'Z' || p.key === 'S' || p.key === 'Y' || p.key === 'RB');
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    function ballXZ() {
      if (!ball) return { x: 0, z: los };
      if (ball.holder) return ball.holder;
      return ball;
    }
    function nearest(list, x, z, filt) {
      let best = null, bd = 1e9;
      for (const p of list) { if (filt && !filt(p)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
      return [best, bd];
    }
    const free = (p) => !p.eng && p.stun <= 0 && !p.fallT && p.fall <= 0;

    // ---------- engagements (blocks) ----------
    function engage(b, d, run) {
      if (!b || !d || b.eng || d.eng || d.fallT || b.fallT || (d.imm > 0 && d.immOf === b)) return false;
      b.eng = d; d.eng = b; b.engT = d.engT = 0;
      const ratio = clamp(b.str / Math.max(25, d.str), 0.55, 1.7);
      d.shed = (run ? DP.shedRun : DP.shedPass) * ratio * (0.65 + rng() * 0.7) * (d.dbl ? 1.5 : 1) * (d.ko ? 0.55 : 1);
      return true;
    }
    function shedEng(d) {
      const b = d.eng; if (!b) return;
      b.eng = null; b.stun = Math.max(b.stun, 0.4); d.eng = null; d.imm = 1.1; d.immOf = b; d.dbl = 0;
    }
    function engStep(d, dt) {
      const b = d.eng;
      if (!b || b.eng !== d) { d.eng = null; return; }
      d.engT += dt; b.engT = d.engT;
      const g = carrier || (ball && ball.holder) || OK.QB || ball || d;
      let gx = g.x - d.x, gz = g.z - d.z; const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
      const winning = d.engT > d.shed * 0.55;
      const push = clamp((d.str - b.str) / 110 + (winning ? 0.45 : -0.2), -0.7, 0.9) * 1.7;
      d.vx = gx * push; d.vz = gz * push;
      steer(b, d.x + gx * 0.9, d.z + gz * 0.9, 6, dt, 18);
      b.face2 = Math.atan2(d.x - b.x, d.z - b.z); d.face2 = Math.atan2(b.x - d.x, b.z - d.z);
      b.pose = d.pose = 'block';
      if (d.engT > d.shed) { shedEng(d); d.vx = gx * d.v * 0.8; d.vz = gz * d.v * 0.8; }
    }

    // ---------- offense AI ----------
    function offenseAI(dt) {
      const qb = OK.QB, F = FORMS[play.form], fx = flip ? -1 : 1, pt = play.type;
      for (const p of off) {
        p.face2 = null;
        if (p === ctrl || p.fallT || p.fall > 0) continue;
        if (p.eng) continue;
        if (p.stun > 0) { p.vx *= 0.9; p.vz *= 0.9; continue; }
        if (p === carrier && p !== ctrl) { autoRun(p, dt); continue; }
        if (p.role === 'QB') { qbAI(p, dt); continue; }
        if (p.key === 'RB' && (pt === 'run' || pt === 'draw') && !handed) { rbMesh(p, dt); continue; }
        if (carrier && carrier.side === 0 && carrier !== p) { leadBlock(p, dt); continue; }
        if (carrier && carrier.side === 1) { chaseCarrier(p, dt); continue; }
        if (p.role === 'OL') { olAI(p, dt); continue; }
        // skill players: route, pass-pro or run block
        if (p.R && !(p.blk === 'chip' && tPlay < p.R.blk)) {
          if (thrown && p === target) continue;
          const q = posAt(p.R, tPlay);
          if (pt === 'pa' || pt === 'boot') { if (tPlay < 0.25) { p.vx *= 0.8; p.vz *= 0.8; continue; } }
          steer(p, q.x, q.z, p.R.v * 1.05, dt, 14);
          if (Math.hypot(q.x - p.x, q.z - p.z) < 0.6 && !q.vx && !q.vz) { p.face2 = Math.atan2(qb.x - p.x, qb.z - p.z); }
          continue;
        }
        if (pt === 'run' || pt === 'sneak' || (pt === 'draw' && handed)) runBlock(p, dt);
        else passPro(p, dt);
      }
    }
    function qbAI(p, dt) {
      const pt = play.type, fx = flip ? -1 : 1, rb = OK.RB, under = FORMS[play.form].under;
      p.hold = !!(ball && ball.holder === p && !thrown);
      if (ball && ball.holder !== p && (handed || thrown)) { // after the ball is gone: carry out the fake / watch
        if (pt === 'run' || pt === 'draw') steer(p, p.x - fx * 1.2, p.z - 1, 3, dt);
        else { p.vx *= 0.85; p.vz *= 0.85; }
        p.face2 = carrier ? Math.atan2(carrier.x - p.x, carrier.z - p.z) : null;
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
    }
    function rbMesh(p, dt) {
      const pt = play.type, qb = OK.QB, fx = flip ? -1 : 1, lane = (play.lane || 0) * fx;
      if (pt === 'draw' && tPlay < 0.75) { steer(p, p.x, p.z, 1, dt); p.face2 = 0; return; }
      if (play.toss) { steer(p, lane * 0.85, los - 4.2, p.v, dt, 10); return; }
      steer(p, qb.x + (lane - qb.x) * 0.12 + Math.sign(lane || fx) * 0.5, qb.z - 0.4, p.v * 0.9, dt, 10);
      if (Math.hypot(p.x - qb.x, p.z - qb.z) < 1.05 && tPlay > 0.3 && ball.holder === qb) doHandoff(p);
    }
    function passPro(p, dt) {
      const qb = OK.QB;
      // pick up the nearest unblocked rusher threatening the QB
      const [r, rd] = nearest(def, qb.x, qb.z, (d) => d.ass && d.ass.t === 'rush' && !d.eng && !d.fallT && d.z > qb.z - 1.5);
      if (r && rd < 9) { steer(p, r.x + (qb.x - r.x) * 0.25, r.z + (qb.z - r.z) * 0.25, p.v * 0.9, dt, 10); if (dist(p, r) < 1.15) engage(p, r, false); return; }
      steer(p, qb.x + (p.x > qb.x ? 1.6 : -1.6), qb.z + 0.8, 4, dt); p.face2 = 0;
    }
    function olAI(p, dt) {
      const qb = OK.QB, pt = play.type;
      if (pt === 'run' || pt === 'sneak' || (pt === 'draw' && handed)) { runBlock(p, dt); return; }
      if (pt === 'screen' && tPlay > 1.0 && thrown) { leadBlock(p, dt); return; }
      // pass set: stay between the nearest rusher and the QB
      const idx = +p.key.slice(2), home = { x: (idx - 2) * 2.05, z: los - 1.5 - Math.abs(idx - 2) * 0.35 };
      if (!p.tgt || p.tgt.eng && p.tgt.eng !== p || p.tgt.fallT) {
        const [r, rd] = nearest(def, home.x, home.z + 1, (d) => d.ass && d.ass.t === 'rush' && !d.fallT && (!d.eng || (d.eng.role !== 'OL' || rng() < 0.002)) && Math.abs(d.x - home.x) < 3.4);
        p.tgt = r && rd < 6 ? r : null;
        if (!p.tgt) { const [e] = nearest(def, home.x, home.z, (d) => d.eng && d.eng !== p && d.role === 'DL' && Math.abs(d.x - home.x) < 3); if (e) { e.dbl = 1; p.help = e; } }
      }
      const r = p.tgt;
      if (r && !r.eng) {
        const tx = r.x + (qb.x - r.x) * 0.3, tz = Math.max(los - 5, r.z + (qb.z - r.z) * 0.3);
        steer(p, tx, tz, p.v, dt, 12); p.face2 = Math.atan2(r.x - p.x, r.z - p.z);
        if (dist(p, r) < 1.15 && (pt !== 'screen' || tPlay < 0.9)) engage(p, r, false);
        if (pt === 'screen' && tPlay > 0.6) { p.tgt = null; }
      } else if (p.help && p.help.eng) { steer(p, p.help.x - (p.help.x - p.x) * 0.3, p.help.z - 0.9, 4, dt); p.face2 = 0; p.pose = 'block'; }
      else steer(p, home.x, home.z, 3.5, dt);
      if (!p.eng && !(p.help && p.help.eng)) p.face2 = p.face2 == null ? 0 : p.face2;
    }
    function runBlock(p, dt) {
      const fx = flip ? -1 : 1, lane = (play.lane || 0) * fx;
      if (!p.tgt || p.tgt.fallT || (p.tgt.eng && p.tgt.eng !== p)) {
        // nearest defender in front, biased to the play side; lead blocker takes the first linebacker
        let best = null, bs = 1e9;
        for (const d of def) {
          if (d.fallT || (d.eng && d.eng !== p)) continue;
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
      if (!d) { steer(p, p.x, p.z + 2, 3, dt); return; }
      const g = carrier || OK.RB;
      const tx = d.x + (g.x - d.x) * 0.25, tz = d.z + (g.z - d.z) * 0.25;
      steer(p, tx, tz, p.v * (p.role === 'OL' ? 1 : 0.95), dt, 12);
      p.face2 = Math.atan2(d.x - p.x, d.z - p.z);
      if (dist(p, d) < 1.1) engage(p, d, true);
    }
    function leadBlock(p, dt) {
      const c = carrier;
      if (!c) return;
      if (!p.tgt || p.tgt.fallT || p.tgt.eng && p.tgt.eng !== p || dist(p.tgt, c) > 14) {
        let best = null, bs = 1e9;
        for (const d of def) { if (d.fallT || d.eng) continue; const s = dist(d, c) + dist(d, p) * 0.7 + (d.z < c.z - 2 ? 6 : 0); if (s < bs) { bs = s; best = d; } }
        p.tgt = best;
      }
      const d = p.tgt;
      if (!d) { steer(p, p.x, p.z + 2, 3, dt); return; }
      steer(p, (d.x + c.x) / 2 * 0.25 + d.x * 0.75, (d.z + c.z) / 2 * 0.25 + d.z * 0.75, p.v * (d.ko ? 0.82 : 0.95), dt, 9);
      if (dist(p, d) < (d.ko ? 0.85 : 1.05) && (!d.ko || rng() < 0.6)) engage(p, d, true);
    }
    function chaseCarrier(p, dt) { // offense chasing an interception / fumble return
      const c = carrier, lead = Math.min(dist(p, c) / p.v, 1) * 0.6;
      steer(p, c.x + c.vx * lead, c.z + c.vz * lead, p.v * (p.role === 'OL' ? 0.85 : 1), dt, 9);
      if (dist(p, c) < 0.95 && !c.fallT && tPlay - (c.lastTackle || -9) > 0.5) { c.lastTackle = tPlay; if (rng() < 0.75) downCarrier(c, p, 'tackle'); }
    }

    // ---------- defense AI ----------
    function defenseAI(dt) {
      const qb = OK.QB || { x: 0, z: los - 5 };
      const runMode = runSeen >= 0;
      for (const d of def) {
        d.face2 = null;
        if (d.fallT || d.fall > 0) continue;
        if (d.stun > 0) { d.vx *= Math.pow(0.05, dt); d.vz *= Math.pow(0.05, dt); continue; }
        if (d === carrier) { returnRun(d, dt); continue; }
        if (carrier && carrier.side === 1) { leadBlockDef(d, dt); continue; }
        if (d.eng) { engStep(d, dt); continue; }
        if (carrier || (ball && ball.st === 'loose')) {
          if (ball && ball.st === 'loose') { steer(d, ball.x, ball.z, d.v, dt, 9); continue; }
          const readT = d.role === 'DL' ? 0 : d.role === 'LB' ? DP.read : DP.read * 1.2;
          if (!runMode || tPlay - runSeen > readT || dist(d, carrier) < 4 || carrier.z > los + 1) { pursue(d, dt); continue; }
        }
        if (thrown && ball && ball.st === 'air') { if (playBall(d, dt)) continue; }
        const a = d.ass || { t: 'rush' };
        if (a.t === 'rush') { rushQB(d, dt); continue; }
        // play-action / draw bite: linebackers step up toward the line
        if ((play.type === 'pa' || play.type === 'boot') && d.role === 'LB' && tPlay < 0.4 + DP.bite * 0.6) { steer(d, d.x * 0.9, los + 2, d.v * 0.8, dt); continue; }
        if (a.t === 'man') manCover(d, dt);
        else zoneCover(d, dt);
        // backpedal: face the quarterback while moving downfield
        if (d.vz > 0.5 && Math.hypot(d.vx, d.vz) < 6.2 && (d.role === 'CB' || d.role === 'S')) d.face2 = Math.atan2(qb.x - d.x, qb.z - d.z);
      }
      // keep defenders from stacking on top of each other
      for (let i = 0; i < everyone.length; i++) {
        const a = everyone[i]; if (a.fallT) continue;
        for (let j = i + 1; j < everyone.length; j++) {
          const b = everyone[j]; if (b.fallT || a.eng === b) continue;
          const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.55 && d2 > 1e-4) { const d = Math.sqrt(d2), k = (0.75 - d) * 0.5 / d; if (a !== ctrl) { a.x += dx * k; a.z += dz * k; } if (b !== ctrl) { b.x -= dx * k; b.z -= dz * k; } }
        }
      }
    }
    function manCover(d, dt) {
      const r = d.ass.tgt;
      if (!r) { zoneCover(d, dt); return; }
      let tx, tz;
      if (r.R && !thrown && !(r.blk === 'chip' && tPlay < r.R.blk)) {
        const lag = DP.lag * d.lagK, q = posAt(r.R, Math.max(0, tPlay - lag));
        // cushion at the snap, then trail technique: shadow where the receiver was a moment ago (lag) from the inside
        const k = Math.max(0, 1 - tPlay / 1.6), sp = Math.hypot(q.vx, q.vz) || 1;
        tx = q.x - r.R.s * 0.4 - (q.vx / sp) * 0.5; tz = q.z + DP.cush * k - (q.vz / sp) * 0.5 * (1 - k);
      } else { tx = r.x; tz = r.z + 1.2; }
      steer(d, tx, tz, d.v * d.spdK, dt, 8);
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
      if (aim && aim.spot && aim.dur > 0.25) { // reading the quarterback's eyes
        const s = DP.stare * clamp((aim.dur - 0.25) / 1.2, 0, 1) * (Math.hypot(aim.spot.x - d.x, aim.spot.z - d.z) < 14 ? 1 : 0.3);
        tx = lerp(tx, aim.spot.x, s * 0.55); tz = lerp(tz, aim.spot.z, s * 0.4);
      }
      steer(d, tx, tz, d.v * (tPlay < 0.45 ? 0.8 : 1), dt, 7);
    }
    function rushQB(d, dt) {
      const qb = carrier || OK.QB, fx = d.x < 0 ? -1 : 1;
      let tx = qb.x, tz = qb.z;
      if (d.stunt && tPlay < 0.55) { tx = d.x + d.stunt * 3; tz = los + 0.2; }
      else if (d.role === 'DL' && Math.abs(d.x) > 3 && d.z > qb.z + 2.2) { tx = qb.x + fx * 2.4; tz = qb.z + 1.2; } // edge rush bends around the tackle
      steer(d, tx, tz, d.v * (d.role === 'DL' ? 1 : 0.95), dt, 8);
      // a free rusher meets a blocker standing in his path
      if (!d.eng && !(d.imm > 0)) for (const b of off) { if ((b.role === 'OL' || b.blk) && !b.eng && b !== ctrl && !b.fallT && dist(b, d) < 1.0 && b.z <= d.z + 0.3) { if (engage(b, d, false)) break; } }
    }
    function pursue(d, dt) {
      const c = carrier || ballXZ(); if (!c) return;
      const sp = d.v * (d.spdK || 1) * (d.role === 'DL' ? 0.92 : 1);
      const dd = dist(d, c), lead = Math.min(dd / sp, 1.1) * 0.75;
      steer(d, c.x + (c.vx || 0) * lead, c.z + (c.vz || 0) * lead, sp, dt, 8);
      if (!d.eng && dd > 1.6 && !(d.imm > 0)) for (const b of off) { if (b !== carrier && b !== ctrl && b.eng == null && !b.fallT && (b.tgt === d || b.role === 'OL') && dist(b, d) < 0.95) { if (engage(b, d, true)) break; } }
    }
    function leadBlockDef(d, dt) { // defense escorting its own interception return
      const c = carrier;
      const [o, od] = nearest(off, c.x, c.z, (p) => !p.fallT);
      if (o && od < 10) steer(d, (o.x + c.x) / 2, (o.z + c.z) / 2, d.v * 0.9, dt);
      else steer(d, c.x + (d.x > c.x ? 3 : -3), c.z - 3, d.v * 0.8, dt);
    }
    function returnRun(c, dt) { // CPU runs back an interception toward the user's end zone
      let ux = 0, uz = -1;
      for (const o of off) { if (o.fallT) continue; const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz); if (d < 7 && dz > -2) { ux += dx / d / d * 4; uz += dz / d / d * 2; } }
      if (Math.abs(c.x) > HW - 3) ux -= Math.sign(c.x) * 1.5;
      const l = Math.hypot(ux, uz) || 1;
      steerDir(c, ux / l, uz / l, c.v * 1.02, dt, 8);
    }

    // ---------- snap, handoff, pitch ----------
    function snap() {
      if (phase !== 'pre' || finished) return;
      phase = 'live'; tPlay = 0; introT0(); clearBanner(); closeSheet();
      sfx.play('hike'); sfx.crowd(0.18 + excite * 0.3);
      const qb = OK.QB, under = FORMS[play.form].under;
      ball = { st: 'snap', x: 0, y: 0.3, z: los, t: 0, T: under ? 0.08 : 0.24, holder: null };
      pr = { type: play.type, start: los, down, togo: fdz - los, third: down === 3, cov: dcall.name, kind: play.type === 'pass' || play.type === 'pa' || play.type === 'boot' || play.type === 'screen' ? 'pass' : 'rush', passer: null, tgt: null, rec: null, rusher: null, catchZ: null, yac: 0, notes: [] };
      if (play.type === 'sneak') pr.rusher = qb;
      for (const p of everyone) p.pose = 'run';
      setControls(true); drivePlays++;
    }
    function ballHeldByQB() {
      const qb = OK.QB;
      ball = { st: 'held', holder: qb, x: qb.x, y: 1.3, z: qb.z };
      if (play.type === 'sneak') { carrier = qb; ctrl = qb; mode = 'run'; runSeen = tPlay; pr.rusher = qb; setControls(true); return; }
      if (play.type === 'run' || play.type === 'draw') { mode = 'none'; setControls(true); return; }
      mode = 'aim'; setControls(true);
    }
    function doHandoff(rb) {
      if (handed || ball.holder !== OK.QB) return;
      handed = true; runSeen = tPlay;
      ball = { st: 'held', holder: rb, x: rb.x, y: 1.3, z: rb.z };
      carrier = rb; ctrl = rb; mode = 'run'; pr.rusher = rb; pr.kind = 'rush';
      setControls(true);
    }
    function doPitch() {
      const qb = OK.QB, rb = OK.RB;
      if (handed || ball.holder !== qb) return;
      handed = true; runSeen = tPlay;
      const T = 0.42, tx = rb.x + rb.vx * T, tz = rb.z + rb.vz * T;
      ball = { st: 'pitch', x: qb.x, y: 1.3, z: qb.z, fx: qb.x, fz: qb.z, tx, tz, t: 0, T, holder: null, to: rb };
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
        if (u >= 1) { const rb = b.to; ball = { st: 'held', holder: rb, x: rb.x, y: 1.3, z: rb.z }; carrier = rb; ctrl = rb; mode = 'run'; pr.rusher = rb; setControls(true); sfx.play('catch'); }
      }
      if (play.toss && b.st === 'held' && b.holder === qb && tPlay > 0.32) doPitch();
    }

    // ---------- passing: QB arm, aim, error cone ----------
    const QBR = SQ.QB.r;
    const maxDist = () => 26 + (QBR.thr - 30) * 0.52 - WET * 3;
    const bulletV = () => 17 + (QBR.thr - 30) * 0.13;
    function pressure() {
      const qb = OK.QB; let p = 0;
      for (const d of def) if (!d.eng && !d.fallT && d.stun <= 0) p = Math.max(p, clamp((3.2 - dist(d, qb)) / 3.2, 0, 1));
      return p;
    }
    function sigma(D, arcT) {
      const qb = OK.QB, mv = Math.hypot(qb.vx, qb.vz);
      return D * (0.016 + (100 - QBR.acc) * 0.00068) * (1 + pressure() * 1.4) * (1 + Math.min(1, mv / 6) * 0.8) * [1.12, 1, 1.18][arcT] * (1 + WET * 0.14) + 0.15;
    }
    function aimSpot() {
      if (!aim) return null;
      const dx = aim.px - aim.ax, dy = aim.py - aim.ay, tx = -dx, ty = dy, len = Math.hypot(tx, ty);
      if (len < 16) return null;
      const Lp = Math.max(110, Math.min(cssW, cssH) * 0.42), k = Math.min(1.0, len / Lp), D = Math.max(2, k * maxDist());
      const qb = OK.QB;
      return { x: clamp(qb.x + (tx / len) * D, -HW - 2, HW + 2), z: qb.z + (ty / len) * D, D, k, over: len > Lp };
    }
    function flightOf(D, arcT) {
      const v = bulletV() * [1, 0.8, 0.62][arcT];
      return 0.12 + D / v + (arcT === 2 ? 0.25 : 0);
    }
    function nearestRec(x, z, maxd) {
      const [r, d] = nearest(off, x, z, (p) => isRec(p) && !p.fallT && p !== OK.QB);
      return r && d < maxd ? r : null;
    }
    function gauss() { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * rng()); }
    function throwBall(spot, arcT) {
      const qb = OK.QB;
      if (!ball || ball.holder !== qb || thrown || mode !== 'aim' || tPlay < 0.3 || qb.fallT) return false;
      if (qb.z > los + 0.2) return false;
      const D0 = Math.hypot(spot.x - qb.x, spot.z - qb.z), D = Math.min(D0, maxDist());
      const ux = (spot.x - qb.x) / (D0 || 1), uz = (spot.z - qb.z) / (D0 || 1);
      const sg = sigma(D, arcT), ex = gauss() * sg * 0.75, ez = gauss() * sg;
      const tx = qb.x + ux * D + ex, tz = qb.z + uz * D + ez;
      const D2 = Math.hypot(tx - qb.x, tz - qb.z), T = flightOf(D2, arcT);
      const y0 = 2.25, y1 = [1.5, 1.6, 2.0][arcT];
      ball = { st: 'air', x: qb.x + 0.2, y: y0, z: qb.z, vx: (tx - qb.x) / T, vz: (tz - qb.z) / T, vy: (y1 - y0 + 0.5 * GRAV * T * T) / T, t: 0, T, tx, tz, arc: arcT, D: D2, played: [], fromZ: qb.z, holder: null, kind: 'pass' };
      thrown = true; passer = qb; qb.armT = 0.35; qb.face2 = Math.atan2(ux, uz);
      target = nearestRec(tx, tz, 10);
      if (target) {
        const sp = Math.hypot(target.vx, target.vz), px = target.x + target.vx * T * 0.6, pz = target.z + target.vz * T * 0.6, dx = tx - px, dz = tz - pz, dl = Math.hypot(dx, dz) || 1;
        ball.behind = sp > 4 && dl > 2 && (dx * target.vx + dz * target.vz) / (sp * dl) < -0.3;
        target.rxT = 0.34 - (target.agi - 50) * 0.003; // he keeps running his route for a beat before he adjusts
      }
      const st = stat(SQ.QB.pid); if (st) st.passAtt++;
      pr.kind = 'pass'; pr.passer = qb; pr.tgt = target; pr.thrown = true;
      // defenders read the throw (sooner if you stared the target down)
      const stare = aim && aim.dur > 0.8 && aim.tgt && aim.tgt === target ? Math.min(0.28, (aim.dur - 0.8) * 0.25) * (0.4 + DP.stare) : 0;
      for (const d of def) {
        const man = d.ass && d.ass.t === 'man' && d.ass.tgt === target;
        d.breakAt = tPlay + DP.react * (0.75 + rng() * 0.5) * (man ? 0.7 : 1) - stare;
        d.tried = 0;
      }
      for (const p of off) p.tried = 0;
      aim = null; hideAim();
      if (target) { ctrl = target; mode = 'catch'; target.face2 = null; } else { ctrl = null; mode = 'none'; }
      sfx.play('throw'); setControls(true);
      return true;
    }
    // when will the ball pass this player, and how high will it be?
    function ballOver(p) {
      const b = ball, hv = Math.hypot(b.vx, b.vz) || 1, ux = b.vx / hv, uz = b.vz / hv;
      const along = (p.x - b.x) * ux + (p.z - b.z) * uz, tc = Math.max(0, along / hv);
      return [tc, b.y + b.vy * tc - 0.5 * GRAV * tc * tc, Math.abs((p.x - b.x) * uz - (p.z - b.z) * ux)];
    }
    function playBall(d, dt) {
      if (tPlay < (d.breakAt || 0) || !ball || ball.st !== 'air' || ball.kind !== 'pass') return false;
      const b = ball, tl = Math.max(0, b.T - b.t), dSpot = Math.hypot(b.tx - d.x, b.tz - d.z);
      if (dSpot > 24) return false;
      let tx = b.tx, tz = b.tz;
      if (dSpot > d.v * tl + 2.5 && target) { tx = target.x + (target.vx || 0) * 0.4; tz = target.z + (target.vz || 0) * 0.4; }
      steer(d, tx, tz, d.v * (d.spdK || 1) * 1.02, dt, 9);
      if (d.jumpY <= 0 && d.jumpT <= 0) { const [tc, yc, side] = ballOver(d); if (tc > 0.08 && tc < 0.36 && side < 1.2 && yc > 2.2 && yc < 3.6) doJump(d); }
      return true;
    }

    // ---------- ball in the air: who can reach it ----------
    function reachOf(p) {
      const hs = p.lk.hs, fx = Math.sin(p.h), fz = Math.cos(p.h);
      if (p.diveT > 0 || p.pose === 'dive') return { x: p.x + fx * 1.1, z: p.z + fz * 1.1, r: 1.05, lo: 0.0, hi: 1.75 };
      const jump = p.jumpY > 0.05;
      return { x: p.x + fx * 0.3, z: p.z + fz * 0.3, r: p.side ? 0.7 : 0.9 + (p.cat - 60) * 0.002, lo: 0.25, hi: (p.side ? 2.4 : 2.5 * hs) + p.jumpY * 1.15 + (jump ? 0.35 : 0) };
    }
    function airStep(dt) {
      const b = ball;
      b.t += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= GRAV * dt; b.y += b.vy * dt;
      // the controlled receiver: steer, or let him run to the spot
      if (target && !target.fallT) {
        if (target === ctrl && userDir()) {
          const d = userDir(); steerDir(target, d[0], d[1], target.v * (target.jumpY > 0 ? 0.3 : 1), dt, target.acc * 1.4);
        } else if (b.t < (target.rxT || 0) && target.R) {
          const q = posAt(target.R, tPlay); steer(target, q.x, q.z, target.R.v * 1.05, dt, 14);
        } else if (target.diveT <= 0 && target.jumpY <= 0) {
          const tl = Math.max(0.05, b.T - b.t), dd = Math.hypot(b.tx - target.x, b.tz - target.z);
          steer(target, b.tx, b.tz, Math.min(target.v, Math.max(dd / tl * 1.1, target.v * 0.55)), dt, 12);
          if (dd < 0.8 && tl < 0.4) target.face2 = Math.atan2(-b.vx, -b.vz);
        }
        // kid assist on Rookie: jump automatically for balls that will sail over his hands
        if (DIFF < 0.2 && target.jumpY <= 0 && target.jumpT <= 0) {
          const tl = b.T - b.t;
          const [tc, yc, side] = ballOver(target);
          if (tl > 0.05 && tc > 0.1 && tc < 0.38 && side < 1.3 && yc > 2.35 * target.lk.hs && yc < 3.6) doJump(target);
        }
        target.reach = b.T - b.t < 0.55 ? 1 : 0;
      }
      // contacts
      const cands = [];
      for (const p of everyone) {
        if (p.fallT || p.stun > 0 || p.eng || b.played.indexOf(p) >= 0 || p === passer) continue;
        if (Math.abs(p.x - b.x) > 2.4 || Math.abs(p.z - b.z) > 2.4 || b.y > 4.5) continue;
        const R = reachOf(p);
        if (Math.hypot(b.x - R.x, b.z - R.z) <= R.r && b.y >= R.lo && b.y <= R.hi) cands.push(p);
      }
      if (cands.length) {
        const o = cands.find((p) => p.side === 0 && isRec(p)), d = cands.find((p) => p.side === 1);
        if (o) recAttempt(o, d); else if (d) defAttempt(d);
        if (ball !== b || b.st !== 'air') return;
      }
      if (b.y <= 0.08) { ball.st = 'dead'; ball.y = 0.1; ball.vy = Math.abs(b.vy) * 0.3; endPlay('inc', 0, b.tipped ? 'Batted down' : b.drop ? 'Dropped' : Math.abs(b.x) > HW ? 'Out of bounds' : 'Nobody there'); return; }
      if (Math.abs(b.x) > HW + 3 || b.z > 113 || b.z < -12) { ball.st = 'dead'; endPlay('inc', 0, 'Thrown away'); }
    }
    function contestOf(r) {
      let best = null, bd = 9;
      for (const d of def) { if (d.fallT || d.stun > 0 || d.eng) continue; const dd = Math.hypot(d.x - ball.x, d.z - ball.z); if (dd < bd) { bd = dd; best = d; } }
      return [best, clamp((1.35 - bd) / 1.35, 0, 1)];
    }
    function recAttempt(r, dIn) {
      const b = ball;
      b.played.push(r);
      const [dN, cf0] = contestOf(r), cf = dIn ? Math.max(cf0, 0.75) : cf0, dd = dIn || dN;
      const diving = r.diveT > 0 || r.pose === 'dive', jumping = r.jumpY > 0.1;
      const R = reachOf(r), off2 = Math.hypot(b.x - R.x, b.z - R.z);
      let p = 0.7 + r.cat / 300;
      if (b.arc === 0 && b.D < 12) p -= 0.06;
      if (b.arc === 2) p += 0.03;
      if (b.behind) p -= 0.1;
      if (diving) p -= 0.13;
      if (jumping && b.y < 2.1) p -= 0.08;
      if (off2 > 0.6) p -= (off2 - 0.6) * 0.25;
      p -= WET * 0.03;
      const recS = r.cat + (r.str - 50) * 0.3 + (r.lk.hs - 1) * 150 + (jumping && b.y > 2.2 ? 14 : 0) - (b.behind ? 12 : 0), defS = 36 + 52 * KDEF + (dd && dd.jumpY > 0.1 ? 10 : 0);
      const win = recS / (recS + defS);
      p *= 1 - cf * (1 - win) * 1.05;
      p = clamp(p, 0.03, 0.985);
      if (rng() < p) { catchBall(r, diving, jumping); return; }
      if (cf > 0.2 && dd) {
        if (rng() < cf * DP.intSkill * 0.5 * (tPlay < (dd.breakAt || 0) ? 0.4 : 1)) { intercept(dd); return; }
        if (rng() < 0.45) { tipBall(r, 'TIPPED!'); return; }
        knockDown(dd ? 'BROKEN UP!' : 'DROPPED');
        return;
      }
      if (rng() < 0.25) { tipBall(r, 'BOBBLED!'); return; }
      ball.drop = true; ball.vy = Math.min(ball.vy, -1.5); ball.vx *= 0.3; ball.vz *= 0.3;
      popAt(r, 'DROPPED', '#ff3344');
    }
    function defAttempt(d) {
      const b = ball;
      b.played.push(d);
      const ok = b.y < 2.3 + d.jumpY;
      let pI = DP.intSkill * 0.85 * (b.arc === 2 ? 1.25 : b.arc === 0 ? 0.7 : 1) * (ok ? 1 : 0.4) * (1 - WET * 0.15);
      if (target && dist(target, b) < 1.2) pI *= 0.6;
      if (!target || dist(target, b) > 3.5) pI = Math.min(0.8, pI * 2.6 + 0.2); // thrown right to him
      const looking = tPlay >= (d.breakAt || 0);
      if (!looking) pI *= 0.3;
      if (rng() < pI) { intercept(d); return; }
      if (rng() < DP.deflect * (looking ? 1 : 0.5)) { if (rng() < 0.4) tipBall(d, 'TIPPED!'); else knockDown('KNOCKED AWAY!'); return; }
    }
    function tipBall(p, msg) {
      const b = ball; b.tipped = true;
      b.vy = 3.5 + rng() * 2.5; b.vx = (rng() - 0.5) * 3 + b.vx * 0.2; b.vz = (rng() - 0.2) * 3 + b.vz * 0.15;
      b.y = Math.max(b.y, 1.2); popAt(p, msg, '#ffc21a'); sfx.play('catch');
    }
    function knockDown(msg) {
      const b = ball; b.tipped = true; b.vy = -3; b.vx *= -0.25; b.vz *= -0.2;
      popAt(target || OK.QB, msg, '#ff3344');
    }
    function catchBall(r, diving, jumping) {
      const b = ball;
      if (Math.abs(r.x) > HW + 0.05) { ball.st = 'dead'; ball.vy = -1; endPlay('inc', 0, 'Out of bounds'); return; }
      ball = { st: 'held', holder: r, x: r.x, y: 1.3, z: r.z };
      carrier = r; ctrl = r; mode = 'run'; target = r; r.reach = 0;
      pr.rec = r; pr.catchZ = r.z; pr.caught = true;
      const notes = [];
      if (Math.abs(r.x) > HW - 1.25) notes.push('TOE TAP!');
      if (diving) notes.push('DIVING CATCH!'); else if (jumping) notes.push(b.y > 2.6 ? 'HIGH-POINTED!' : 'LEAPING GRAB!');
      const [, cf] = contestOf(r);
      if (cf > 0.45 && !notes.length) notes.push('CONTESTED CATCH!');
      pr.notes = notes;
      popAt(r, notes[0] || 'CATCH!', '#2bd46b');
      sfx.play('catch'); excite = Math.min(1, excite + 0.25);
      const st = stat(SQ.QB.pid); if (st) st.passCmp++;
      if (r.z >= 100) { endPlay('td', r.z); return; }
      if (diving) { r.fallT = 1; endPlay('tackle', r.z, 'Diving catch'); return; }
      setControls(true);
    }
    function intercept(d) {
      ball = { st: 'held', holder: d, x: d.x, y: 1.3, z: d.z };
      carrier = d; ctrl = null; mode = 'none'; d.v = Math.max(d.v, 7.4);
      pr.int = d; pr.intZ = d.z;
      const st = stat(SQ.QB.pid); if (st) st.passInt++;
      popAt(d, 'PICKED OFF!', '#ff3344'); sfx.play('boo'); excite = Math.max(0, excite - 0.3);
      setControls(true);
    }
    function doJump(p) {
      if (!p || p.jumpY > 0 || p.jumpT > 0 || p.fallT || p.diveT > 0) return;
      p.jumpV = 7 + (p.agi - 50) * 0.02; p.jumpT = 0.65; p.jumpY = 0.01; sfx.play('tap');
    }
    function doDive(p) {
      if (!p || p.diveT > 0 || p.fallT || p.jumpY > 0) return;
      const d = userDir() || [Math.sin(p.h), Math.cos(p.h)];
      p.diveT = 0.5; p.ddx = d[0]; p.ddz = d[1]; p.vx = d[0] * (p.v + 3); p.vz = d[1] * (p.v + 3); p.pose = 'dive'; p.h = Math.atan2(d[0], d[1]);
    }
    function receiverDiveStep(p, dt) {
      if (p.diveT > 0) { p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; if (p.diveT - dt <= 0 && (!ball || ball.holder !== p)) { p.fallT = 1; p.getup = 1.3; } }
    }

    // ---------- user input direction ----------
    function userDir() {
      if (input.stick && Math.hypot(input.stick[0], input.stick[1]) > 0.25) { const l = Math.hypot(input.stick[0], input.stick[1]); return [input.stick[0] / l, input.stick[1] / l]; }
      const ix = input.r - input.l; let iz = input.u - input.d;
      if (!ix && !iz) return null;
      if (!iz && !input.d && mode === 'run') iz = 0.6;
      const l = Math.hypot(ix, iz); return [ix / l, iz / l];
    }
    // a sensible path when the player doesn't steer: hit the hole, then go north and avoid tacklers
    const AUTO = lerp(3.2, 0.9, DIFF); // the no-input run assist dodges less on harder levels
    function autoDir(c) {
      const fx = flip ? -1 : 1;
      let ux = 0, uz = 1;
      if (c.side === 0 && c.key === 'RB' && (play.type === 'run' || play.type === 'draw') && c.z < los + 1 && !kick) {
        const lx = (play.lane || 0) * fx; ux = (lx - c.x) * 0.5; uz = 1;
      }
      if (c.role === 'QB' && c.z < los && play.type !== 'sneak') { ux = c.x >= 0 ? 0.8 : -0.8; uz = 0.6; }
      for (const d of def) {
        if (d.fallT || d.eng) continue;
        const dx = c.x - d.x, dz = c.z - d.z, dd = Math.hypot(dx, dz);
        if (dd < 7 && dz < 1.5) { ux += dx / dd / dd * AUTO; uz += Math.max(0, dz) / dd / dd; }
      }
      if (Math.abs(c.x) > HW - 3) ux -= Math.sign(c.x) * 1.5;
      const l = Math.hypot(ux, uz) || 1;
      return [ux / l, uz / l];
    }
    function autoRun(c, dt) { const d = autoDir(c); steerDir(c, d[0], d[1], c.v, dt, c.acc); }

    // ---------- moves ----------
    const MV = { juke: 'J', spin: 'K', stiff: 'L', dive: 'Space' };
    function moveCd(c, m) { const a = (c.agi - 50) / 50, s = (c.str - 50) / 50; return { juke: 2.4 - a * 0.7 + DIFF * 0.5, spin: 2.8 - a * 0.6 + DIFF * 0.5, stiff: 2.1 - s * 0.5 + DIFF * 0.4 }[m]; }
    function doMove(m) {
      const c = ctrl;
      if (!c || mode !== 'run' || c.fallT || c !== carrier || c.diveT > 0) return;
      if (m === 'dive') {
        if (c.role === 'QB' && c.z < los + 30 && play.type !== 'sneak' && (c === OK.QB)) { slide(c); return; }
        const d = userDir() || [Math.sin(c.h), Math.cos(c.h)];
        c.diveT = 0.42; c.ddx = d[0]; c.ddz = d[1]; c.vx = d[0] * (c.v + 2.5); c.vz = d[1] * (c.v + 2.5); c.pose = 'dive'; c.mv = 'dive'; c.mvT = 0.42;
        sfx.play('tap'); return;
      }
      if (c.mvCd[m] > 0) return;
      c.mvCd[m] = moveCd(c, m); c.mv = m;
      if (m === 'juke') {
        c.mvT = 0.36 + (c.agi - 50) * 0.002;
        let near = null, nd = 1e9;
        for (const d of def) { const dd = dist(d, c); if (dd < nd) { nd = dd; near = d; } }
        const dir = userDir() || [0, 1];
        let side = Math.abs(dir[0]) > 0.3 ? Math.sign(dir[0]) : near ? (near.x > c.x ? -1 : 1) : 1;
        if (Math.abs(c.x + side * 3) > HW - 1) side = -side;
        const jx = side * 0.95, jz = 0.55, l = Math.hypot(jx, jz); c.jdx = jx / l; c.jdz = jz / l;
        let fooled = 0;
        for (const d of def) if (dist(d, c) < 3.4 && d.stun <= 0 && !d.fallT && rng() < 0.55 + (c.agi - d.agi) / 160 + (1 - KDEF) * 0.25) { d.stun = DP.stun * (0.8 + rng() * 0.4); fooled++; }
        sfx.play(fooled ? 'good' : 'tap');
        if (fooled) popAt(c, fooled > 1 ? 'DOUBLE JUKE!' : 'JUKED HIM!', '#2bd46b');
      } else if (m === 'spin') { c.mvT = 0.48; sfx.play('tap'); }
      else if (m === 'stiff') { c.mvT = 0.6; sfx.play('tap'); }
    }
    function slide(c) {
      c.pose = 'slide'; c.fallT = 1; c.vx *= 0.4; c.vz = Math.max(0, c.vz * 0.4);
      popAt(c, 'SLIDE', '#c9ccd4');
      endPlay(c.z > los ? 'tackle' : 'sack', c.z, 'Gives himself up', true);
    }
    function carrierStep(c, dt) {
      for (const k in c.mvCd) if (c.mvCd[k] > 0) c.mvCd[k] -= dt;
      if (c.mvT > 0) c.mvT -= dt; else c.mv = null;
      let spd = c.v * (c.wrapT > 0 ? 0.32 : 1);
      if (c.diveT > 0) {
        c.diveT -= dt; c.vx *= 1 - dt * 1.4; c.vz *= 1 - dt * 1.4;
        if (c.diveT <= 0) { c.fallT = 1; downCarrier(c, null, 'dive'); return; }
      } else if (c.mv === 'juke' && c.mvT > 0) { c.vx = c.jdx * (c.v + 4.2); c.vz = c.jdz * (c.v + 4.2); }
      else if (c === ctrl) {
        const d = userDir() || (c.side === 0 ? autoDir(c) : [0, -1]);
        if (c.mv === 'spin' && c.mvT > 0) spd *= 0.88;
        steerDir(c, d[0], d[1], spd, dt, c.acc * (c.mv === 'spin' ? 0.6 : 1));
      }
      if (c.mv === 'spin' && c.mvT > 0) c.spin = (c.spin || 0) + dt * 15;
      if (c.wrapT > 0) {
        c.wrapT -= dt;
        if (c.wrapT <= 0) {
          const pB = clamp(0.1 + (c.str - DP.tackle) / 200, 0.02, 0.4);
          if (rng() < pB) { if (c.wrapBy) { c.wrapBy.stun = 0.9; c.wrapBy.fallT = 1; c.wrapBy.getup = 1; } popAt(c, 'SHED THE TACKLE!', '#2bd46b'); c.wrapBy = null; }
          else { downCarrier(c, c.wrapBy, 'tackle'); return; }
        }
      }
    }
    // ---------- tackling ----------
    function tackleChecks(c) {
      if (!c || c.fallT || c.side !== 0) return;
      if (c.mv === 'juke' && c.mvT > 0) return;
      const behindLOS = c.role === 'QB' && !crossed && !handed && thrown === false;
      let gang = 0;
      for (const d of def) {
        if (d.fallT || d.stun > 0 || d.eng) continue;
        const dd = dist(d, c);
        if (dd > (c.diveT > 0 ? 0.6 : 0.95)) continue;
        if (tPlay - (d.lastTry || -9) < 0.7) continue;
        d.lastTry = tPlay; gang++;
        if (c.wrapT > 0 && d !== c.wrapBy) { downCarrier(c, d, behindLOS ? 'sack' : 'tackle', 0, true); return; }
        const front = (d.z - c.z) * Math.sign(c.vz || 1) > 0;
        let pB = 0.12 + (c.str - d.tackle) / 170 + (c.agi - 60) / 600 + (1 - KDEF) * 0.12;
        if (c.mv === 'spin' && c.mvT > 0) pB += 0.3 + (c.agi - 50) / 400;
        if (c.mv === 'stiff' && c.mvT > 0 && front) pB += 0.28 + (c.str - 50) / 260;
        if (!front) pB += 0.06;
        if (behindLOS) pB -= 0.08;
        pB = clamp(pB - (gang - 1) * 0.12, 0.02, 0.72);
        if (rng() < pB) {
          d.stun = 0.75 + rng() * 0.5; d.tried = 1;
          if (c.mv === 'stiff' && c.mvT > 0) { d.fallT = 1; d.getup = 1.1; popAt(c, 'STIFF ARM!', '#2bd46b'); }
          else popAt(c, c.mv === 'spin' && c.mvT > 0 ? 'SPIN MOVE!' : 'BROKE A TACKLE!', '#2bd46b');
          sfx.play('good'); excite = Math.min(1, excite + 0.12);
          continue;
        }
        if (c.wrapT <= 0 && !behindLOS && rng() < 0.4 + (c.str - 50) / 250) { c.wrapT = 0.42; c.wrapBy = d; d.vx = c.vx * 0.5; d.vz = c.vz * 0.5; d.pose = 'tackle'; sfx.play('tackle'); continue; }
        downCarrier(c, d, behindLOS ? 'sack' : 'tackle');
        return;
      }
    }
    function downCarrier(c, d, kind, _x, gang) {
      if (phase !== 'live') return;
      c.fallT = 1; c.getup = 1.4;
      if (d) { d.fallT = 1; d.getup = 1.2; d.pose = 'tackle'; }
      sfx.play('tackle');
      // fumbles: rare, more likely on gang tackles and big hits, less for strong carriers
      if (kind !== 'dive' && c.side === 0 && c.role !== 'QB' || (kind === 'sack' && c.side === 0)) {
        const pF = 0.007 + (gang ? 0.012 : 0) + (kind === 'sack' ? 0.025 : 0) - (c.str - 50) / 9000 + KDEF * 0.006;
        if (rng() < pF) { fumble(c); return; }
      }
      if (c.side === 1) { endPlay('intdown', c.z); return; }
      endPlay(kind === 'sack' ? 'sack' : 'tackle', c.z);
    }
    function fumble(c) {
      ball = { st: 'loose', x: c.x, y: 1.1, z: c.z, vx: (rng() - 0.5) * 6, vy: 3, vz: (rng() - 0.5) * 6, holder: null, t: 0 };
      carrier = null; ctrl = null; mode = 'none';
      popAt(c, 'FUMBLE!', '#ff3344'); sfx.play('bad'); pr.fumble = true; setControls(true);
    }
    function looseStep(dt) {
      const b = ball; b.t += dt;
      b.vy -= 20 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
      if (b.y < 0.12) { b.y = 0.12; b.vy = Math.abs(b.vy) * 0.45; b.vx *= 0.7; b.vz *= 0.7; }
      for (const p of everyone) {
        if (p.fallT || p.stun > 0) continue;
        if (p.side === 0 && p !== ctrl) steer(p, b.x, b.z, p.v, dt, 10);
      }
      if (b.t < 0.35) return;
      let best = null, bd = 0.75;
      for (const p of everyone) { if (p.fallT) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd && b.y < 0.7) { bd = d; best = p; } }
      if (best) {
        best.fallT = 1; best.getup = 1.2;
        popAt(best, best.side === 0 ? 'RECOVERED!' : 'THEY RECOVER!', best.side === 0 ? '#2bd46b' : '#ff3344');
        endPlay(best.side === 0 ? 'tackle' : 'fumlost', best.z);
      } else if (Math.abs(b.x) > HW) endPlay('tackle', b.z, 'Fumble out of bounds');
    }
    // ---------- per-step play checks ----------
    function liveChecks() {
      const c = carrier;
      if (!c || c.fallT) return;
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
    const fgRange = () => 36 + KK * 0.3 - WET * 3;
    const fgDist = () => Math.round(117 - los);
    function fgPct(d) { return clamp(1.08 - Math.max(0, d - 22) * (0.019 - (KK - 50) * 0.00012) - DIFF * 0.03 - WET * 0.06, 0.08, 0.98); }
    function startKick(type) {
      if (finished) return;
      clearBanner(); closeSheet(); hideTags();
      clearPlayers();
      const kz = type === 'punt' ? los - 13 : los - 7;
      for (let i = 0; i < 5; i++) addOff(mkP(0, 'OL', 'OL' + i, (i - 2) * 1.95, los - 0.9, { w: 1.32, num: OLR[i].num, str: OLR[i].str, v: 5.6 }));
      const kq = { key: 'K', look: normLook(null, 1), num: 3, r: { spd: 50, agi: 50, str: 50, cat: 50 } };
      const kp = addOff(mkP(0, 'K', 'K', type === 'punt' ? 0 : -1.2, kz - 1.5, { num: 3, lk: kq.look, v: 5 }));
      if (type !== 'punt') addOff(mkP(0, 'QB', 'H', 0, kz, { num: SQ.QB.num, lk: SQ.QB.look, sq: SQ.QB, face: SQ.QB.cell, pose: 'kneel' }));
      for (let i = 0; i < 4; i++) addDef(mkP(1, 'DL', 'DL' + i, (i - 1.5) * 2.2, los + 0.9, { w: 1.25, v: DP.dlV }));
      for (let i = 0; i < 3; i++) addDef(mkP(1, 'LB', 'LB' + i, (i - 1) * 4, los + 3.5, { v: DP.lbV }));
      if (type === 'punt') addDef(mkP(1, 'S', 'PR', 0, Math.min(108, los + 40), { v: DP.sV }));
      for (const p of everyone) { p.ncell = p.num ? numCell(p.num, p.side) : -1; p.pose = p.pose === 'kneel' ? 'kneel' : 'stance'; p.h = p.side ? Math.PI : 0; }
      kick = { type, st: 'power', p: 0, dir: 1, a: 0, adir: 1, t: 0, kz, kp, spdP: 1.05 + (100 - KK) * 0.011, spdA: 1.5 + (100 - KK) * 0.02 };
      ball = { st: 'spot', x: type === 'punt' ? 0 : 0, y: 0.3, z: type === 'punt' ? kz + 0.5 : kz, holder: null };
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
      } else if (k.st === 'fly') {
        const b = ball; b.t += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= GRAV * dt; b.y += b.vy * dt;
        if (k.type !== 'punt' && !k.judged && b.z >= 110) {
          k.judged = 1; k.good = Math.abs(b.x) < 3.08 && b.y > 3.33;
          endKick();
        }
        if (k.type !== 'punt' && !k.judged && (b.y <= 0.1 || b.vz <= 0)) { k.judged = 1; k.good = false; endKick(); }
        if (k.type === 'punt' && b.y <= 0.12 && b.vy < 0) { b.y = 0.12; b.vy = 0; b.vx *= 0.3; b.vz *= 0.3; if (!k.judged) { k.judged = 1; endKick(); } }
        if (b.y <= 0.12 && k.judged) { b.y = 0.12; b.vy = Math.abs(b.vy) * 0.35; b.vx *= 0.5; b.vz *= 0.5; }
      }
      // rushers and blockers during the kick
      if (k.st === 'fly' || k.st === 'acc') for (const d of def) if (d.key !== 'PR') steer(d, d.x * 0.7, los - 2, d.v * 0.6, dt); else steer(d, ball.tx != null ? ball.tx : d.x, ball.tzz != null ? ball.tzz : d.z, d.v * 0.8, dt);
      for (const p of everyone) integrate(p, dt);
    }
    function launchKick() {
      const k = kick, kp = k.kp; k.st = 'fly'; hideMeter();
      kp.armT = 0.4; kp.pose = 'kick'; sfx.play('kick');
      const wind = WET ? (rng() - 0.5) * 0.06 : 0;
      if (k.type === 'punt') {
        const R = (40 + KK * 0.3) * (0.5 + 0.55 * k.pow) - WET * 3, ang = k.acc * 0.3 + wind, th = 0.95, v = Math.sqrt(R * GRAV / Math.sin(2 * th));
        ball = { st: 'kick', x: 0, y: 1.2, z: k.kz + 0.8, vx: Math.sin(ang) * v * Math.cos(th), vz: Math.cos(ang) * v * Math.cos(th), vy: v * Math.sin(th), t: 0 };
        ball.tx = Math.sin(ang) * R; ball.tzz = k.kz + Math.cos(ang) * R;
      } else {
        const R = (36 + KK * 0.3) * (0.42 + 0.62 * k.pow) - WET * 3, ang = k.acc * 0.15 + wind, th = 0.58, v = Math.sqrt(R * GRAV / Math.sin(2 * th));
        ball = { st: 'kick', x: 0, y: 0.35, z: k.kz, vx: Math.sin(ang) * v * Math.cos(th), vz: Math.cos(ang) * v * Math.cos(th), vy: v * Math.sin(th), t: 0 };
      }
      setControls(true);
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
        addPts('home', 3); banner('IT\'S GOOD!', `${d}-yard field goal`, '#2bd46b'); sfx.play('good'); sfx.play('cheer'); excite = 0.8; confetti(0, 110);
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
      // returner: the RB unless a receiver is faster
      let rk = 'RB'; for (const k of ['X', 'Z', 'S']) if (SQ[k].r.spd > SQ[rk].r.spd + 4) rk = k;
      const R = addOff(offPlayer(rk, 0, 3));
      const others = ['RB', 'X', 'Z', 'S', 'Y'].filter((k) => k !== rk);
      others.forEach((k, i) => addOff(offPlayer(k, [-12, -5, 5, 12][i], 22 + (i % 2) * 3)));
      for (let i = 0; i < 5; i++) addOff(mkP(0, 'OL', 'OL' + i, (i - 2) * 6, 31, { w: 1.32, num: OLR[i].num, str: OLR[i].str, v: 6 }));
      for (let i = 0; i < 10; i++) addDef(mkP(1, i < 4 ? 'LB' : 'S', 'KC' + i, -22 + i * 4.9 + (i >= 5 ? 0.6 : 0), 64, { v: Math.max(7.5, DP.sV) * (1.02 + 0.03 * (i % 3)), lane: -22 + i * 4.9, num: 40 + i, tackle: DP.tackle + 6, str: 55 + 40 * KDEF, agi: 50 + 40 * KDEF, ko: 1 }));
      addDef(mkP(1, 'K', 'KK', 0, 66, { v: 6, num: 6, tackle: 30, str: 40 }));
      for (const p of everyone) { p.ncell = p.num ? numCell(p.num, p.side) : -1; p.hcell = p.side === 0 && p.sq && p.face < 0 ? p.ncell : -1; p.pose = 'stance'; p.h = p.side ? Math.PI : 0; }
      const lz = clamp(Math.round(-4 + rng() * 12 - DIFF * 3), -8, 9), lx = (rng() - 0.5) * 12;
      kick = { type: 'ko', st: 'wait', t: 0, lx, lz, R, tbOK: false };
      ball = { st: 'spot', x: 0, y: 0.3, z: 65, holder: null };
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
        for (const d of def) steer(d, d.x, 64 + (k.t < 0.9 ? 0 : -3), d.v * 0.6, dt);
        if (k.t > 1.1) {
          const T = 3.2, x0 = 0, z0 = 65; k.st = 'air'; sfx.play('kick'); clearBanner();
          ball = { st: 'kick', x: x0, y: 0.4, z: z0, vx: (k.lx - x0) / T, vz: (k.lz - z0) / T, vy: (1.4 - 0.4 + 0.5 * GRAV * T * T) / T, t: 0, T, tx: k.lx, tz: k.lz };
        }
      } else if (k.st === 'air') {
        const b = ball; b.t += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= GRAV * dt; b.y += b.vy * dt;
        steer(R, b.tx, b.tz, R.v, dt, 12); R.face2 = Math.PI;
        for (const d of def) steer(d, lerp(d.lane || 0, b.tx, 0.35), Math.max(b.tz + 6, d.z - 20), d.v, dt, 7);
        for (const p of off) if (p !== R) { steer(p, p.x * 0.8, Math.max(b.tz + 12, p.z - 6), p.v * 0.7, dt); p.face2 = Math.PI; }
        if (b.t >= b.T - 0.02) {
          if (b.tz < -10) { touchback(); return; }
          ball = { st: 'held', holder: R, x: R.x, y: 1.3, z: R.z }; carrier = R; ctrl = R; mode = 'run'; k.st = 'ret'; k.catchT = tPlay;
          k.tbOK = R.z < 0; sfx.play('catch'); pr.start = R.z; pr.rusher = R; setControls(true);
        }
      } else if (k.st === 'ret') {
        if (k.tbOK && (carrier.z > 0.5 || tPlay - k.catchT > 2.6)) { if (carrier.z <= 0.5 && Math.hypot(carrier.vx, carrier.vz) < 1) { touchback(); return; } k.tbOK = false; setControls(true); }
      }
    }
    function touchback() {
      if (phase !== 'live') return;
      if (carrier) { carrier.vx = carrier.vz = 0; carrier.pose = 'kneel'; }
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
    function nm(p) { return p && p.sq ? shortName(p.sq.name) : p && p.side === 1 ? AWAY.abbr + ' #' + p.num : 'he'; }

    // ---------- end of a play ----------
    function endPlay(kind, spot, extra, slid) {
      if (phase !== 'live' || finished) return;
      phase = 'dead'; deadT = 2.2; mode = 'none'; ctrl = null;
      input.stick = null; hideStick(); hideAim(); aim = null;
      sfx.play('whistle');
      const P = pr || {}, ko = kick && kick.type === 'ko';
      const nx = { los, down, fdz, next: null };
      let head = '', sub = '', col = '#ffc21a', line = '';
      closeP = null; clockRun = true;
      const endZ = kind === 'td' || kind === 'krtd' ? 100 : spot;
      const gained = Math.round(endZ - los);
      if (ko) {
        kick = null; clockRun = false;
        const ret = Math.round(endZ - (P.start || 0));
        if (kind === 'krtd') {
          addPts('home', 6); head = 'TOUCHDOWN!'; sub = 'Kickoff return!'; col = '#2bd46b'; closeP = carrier; if (carrier) carrier.cel = 3;
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
          closeP = carrier; if (carrier) { carrier.cel = 3; carrier.celType = (crand() * 3) | 0; if (carrier.celType === 1) setTimeout(() => { if (ball && ball.holder === carrier && phase === 'dead') { ball = { st: 'dead', x: carrier.x + 0.3, y: 1.4, z: carrier.z + 0.4, vx: 0.5, vy: -9, vz: 0.6 }; sfx.play('tap'); } }, 450); }
          confetti(carrier ? carrier.x : 0, 100); clockRun = false;
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
      pend = nx; deadTot = deadT;
      if (closeP) { closeP.hold = true; deadT += 0.5; deadTot = deadT; }
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
    const CD = { g: lerp(3.5, 4.75, CS), big: lerp(0.04, 0.078, CS), loss: lerp(0.24, 0.15, CS), to: lerp(0.06, 0.04, CS), fg: lerp(0.6, 0.86, CS) };
    function simCpu(spot, clk) {
      const start = spot; let dn = 1, fd = spot + 10, plays = 0, used = 0, yds = 0;
      const lead = as - hs, endHalf = clk.q === 2 || clk.q >= 4;
      const fin = (res) => ({ res, plays, yds: Math.max(0, Math.round(spot - start)), spot: Math.round(spot), used, t: Math.max(0, clk.t) });
      const tick = (t) => { t = Math.min(t, clk.t); used += t; clk.t -= t; };
      for (let guard = 0; guard < 60; guard++) {
        if (clk.t <= 0) return fin('CLOCK');
        const late = endHalf && clk.t < QS * 0.33, hurry = late && (clk.q === 2 || lead <= 0 || clk.q >= 5), burn = clk.q >= 4 && lead > 0;
        const needTD = clk.q >= 4 && lead + 3 <= 0 && clk.t < QS * 0.6;
        if (spot >= 62 && ((endHalf && clk.t < 14 && !needTD) || (dn === 4 && !needTD) || (suddenDeath && dn >= 3))) {
          const d = 117 - spot; tick(5); plays++;
          return fin(rng() < clamp(CD.fg * (1.25 - (d - 20) * 0.012), 0.2, 0.97) ? 'FG' : 'MISS');
        }
        if (dn === 4 && !(fd - spot <= 2 && spot >= 40) && !(clk.q >= 4 && lead < 0 && clk.t < QS * 1.2)) { tick(6); plays++; return fin('PUNT'); }
        const r = rng();
        let g;
        if (r < CD.loss) g = -1 - Math.floor(rng() * 5);
        else if (r < CD.loss + CD.big) g = 15 + Math.floor(rng() * 35);
        else g = Math.round(CD.g * (0.2 + 1.6 * rng()));
        plays++;
        tick((hurry ? 4 + rng() * 3 : burn ? 11 + rng() * 5 : 6 + rng() * 5) * QS / 120);
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
    let qbMan = false;
    const POSES = ['stance', 'run', 'block', 'tackle', 'dive', 'kneel', 'slide', 'kick'];
    function step(dt) {
      if (DBG && DBG.bot) { try { DBG.bot(api, dt); } catch (e) { console.error(e); DBG.bot = null; } }
      if (finished) return;
      excite = Math.max(0, excite - dt * 0.09);
      for (const q of parts) { if (q.life <= 0) continue; q.life -= dt; q.vy -= 12 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; } q.r += dt * 8; }
      for (const p of everyone) {
        if (p.stun > 0) p.stun -= dt;
        if (p.imm > 0) p.imm -= dt;
        if (p.armT > 0) p.armT -= dt;
        if (p.cel > 0) { p.cel -= dt; if (p.cel < 0) p.cel = 0; }
        if (p.fallT) { p.fall = Math.min(1, p.fall + dt * 4); if (p.getup > 0 && (phase === 'live' || phase === 'dead') && p !== carrier && p !== closeP) { p.getup -= dt; if (p.getup <= 0) { p.fallT = 0; p.diveT = 0; } } }
        else if (p.fall > 0) p.fall = Math.max(0, p.fall - dt * 1.8);
      }
      if (phase === 'pre') {
        if (intro > 0) { intro -= dt; if (intro <= 0) clearBanner(); }
        if (clockRun && clock > 0) { clockTick(dt); if (clock <= 0) { endQuarter(() => toPre(false)); return; } }
        playClock -= dt; if (playClock <= 0 && !tryMode) { delayOfGame(); return; }
        idle(dt); return;
      }
      if (phase === 'live') { liveStep(dt); return; }
      if (phase === 'dead') {
        if (clockRun && clock > 0) clockTick(dt);
        for (const p of everyone) { if (p !== closeP) { p.vx *= Math.pow(0.04, dt); p.vz *= Math.pow(0.04, dt); } integrate(p, dt); }
        if (closeP && deadTot - deadT > 0.5) { const c = closeP; c.fallT = 0; if (c.fall <= 0 && !c.cel) c.point = 1; c.face2 = 0; }
        if (ball && (ball.st === 'dead' || ball.st === 'loose' || ball.st === 'kick')) { ball.vy = (ball.vy || 0) - 20 * dt; ball.x += (ball.vx || 0) * dt; ball.z += (ball.vz || 0) * dt; ball.y += ball.vy * dt; if (ball.y < 0.12) { ball.y = 0.12; ball.vy = Math.abs(ball.vy) * 0.35; ball.vx *= 0.6; ball.vz *= 0.6; } }
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
    function idle(dt) { for (const p of everyone) { p.vx *= 0.8; p.vz *= 0.8; p.ph += dt * 0.4; integrate(p, dt); } }
    function liveStep(dt) {
      tPlay += dt;
      if (clock > 0) clockTick(dt);
      if (kick && kick.type === 'ko') {
        kickoffStep(dt);
        if (phase !== 'live') return;
        if (kick.st !== 'ret') { for (const p of everyone) integrate(p, dt); recordFrame(dt); return; }
      }
      if (ball.st === 'snap' || ball.st === 'pitch' || (play.toss && ball.st === 'held')) snapStep(dt);
      if (ball.st === 'air') { airStep(dt); if (phase !== 'live') return; }
      if (ball.st === 'loose') { looseStep(dt); if (phase !== 'live') return; }
      qbMan = mode === 'aim' && !!userDir();
      offenseAI(dt);
      defenseAI(dt);
      if (qbMan) { const d = userDir(), q = OK.QB; steerDir(q, d[0], d[1], q.v * 0.8, dt, 10); }
      if (carrier && carrier === ctrl && mode === 'run') carrierStep(carrier, dt);
      if (target && target !== carrier) receiverDiveStep(target, dt);
      for (const p of everyone) integrate(p, dt);
      const h = ball.holder;
      if (h && h.side === 0 && !h.fallT) tackleChecks(h);
      if (phase !== 'live') return;
      if (mode === 'aim' && OK.QB.z > los + 0.3) { carrier = OK.QB; ctrl = OK.QB; mode = 'run'; crossed = true; pr.kind = 'rush'; pr.rusher = OK.QB; runSeen = tPlay; aim = null; hideAim(); setControls(true); }
      if (mode === 'aim' || (ball.holder === OK.QB && !handed)) { const q = OK.QB; if (Math.abs(q.x) > HW && phase === 'live') { endPlay('oob', q.z); return; } }
      liveChecks();
      if (phase === 'live' && tPlay > 14 && mode === 'none' && !carrier && ball.st !== 'air' && ball.st !== 'loose') endPlay('inc', 0, 'Play blown dead');
      recordFrame(dt);
    }

    // ---------- instant replay: record the play, then play it back from a cinematic angle ----------
    function recordFrame(dt) {
      recT += dt;
      if (recT < 1 / 30) return;
      recT = 0;
      if (replayBuf.length > 900) replayBuf.shift();
      const n = everyone.length, f = new Float32Array(n * 9 + 5);
      for (let i = 0; i < n; i++) {
        const p = everyone[i], o = i * 9;
        f[o] = p.x; f[o + 1] = p.jumpY; f[o + 2] = p.z; f[o + 3] = p.h + (p.mv === 'spin' && p.mvT > 0 ? Math.sin(p.spin || 0) * 0.6 : 0); f[o + 4] = p.fall; f[o + 5] = p.ph; f[o + 6] = POSES.indexOf(p.pose); f[o + 7] = Math.hypot(p.vx, p.vz); f[o + 8] = (p.cel > 0 ? 1 : 0) + (p.reach ? 2 : 0) + (p.diveT > 0 ? 4 : 0);
      }
      const b = ball || {}, hp = b.holder;
      f[n * 9] = hp ? hp.x : b.x || 0; f[n * 9 + 1] = hp ? 1.3 + hp.jumpY : b.y || 0; f[n * 9 + 2] = hp ? hp.z : b.z || 0; f[n * 9 + 3] = hp ? everyone.indexOf(hp) : -1; f[n * 9 + 4] = b.st === 'air' || b.st === 'kick' ? 1 : 0;
      replayBuf.push(f);
    }
    function markBig(kind) { if (!lastBig || kind === 'td') lastBig = { kind, played: false, want: false }; }
    function startReplay() {
      lastBig.played = true;
      const n = replayBuf.length;
      replay = { i0: Math.max(0, n - 330), n, t: 0, sp: 0.55, orbit: crand() * 6 };
      phase = 'replay'; clearBanner(); hideTags(); setControls(true);
      banner('REPLAY', '', '#ffc21a'); setTimeout(() => { if (phase === 'replay') clearBanner(); }, 900);
    }
    function replayStep(dt) {
      const r = replay; r.t += dt * r.sp;
      const fi = r.i0 + Math.floor(r.t * 30);
      if (fi >= r.n - 1) { endReplay(); return; }
      applyFrame(replayBuf[fi]);
    }
    function applyFrame(f) {
      const n = everyone.length;
      if (!f || f.length !== n * 9 + 5) return;
      for (let i = 0; i < n; i++) {
        const p = everyone[i], o = i * 9;
        p.x = f[o]; p.jumpY = f[o + 1]; p.z = f[o + 2]; p.h = f[o + 3]; p.fall = f[o + 4]; p.ph = f[o + 5]; p.pose = POSES[f[o + 6]] || 'run';
        const sp = f[o + 7]; p.vx = Math.sin(p.h) * sp; p.vz = Math.cos(p.h) * sp; p.rcel = f[o + 8] & 1; p.reach = f[o + 8] & 2 ? 1 : 0; p.rdive = f[o + 8] & 4;
        p.fallT = 0;
      }
      const hi = f[n * 9 + 3];
      ball = hi >= 0 ? { st: 'held', holder: everyone[hi], x: f[n * 9], y: f[n * 9 + 1], z: f[n * 9 + 2] } : { st: f[n * 9 + 4] ? 'air' : 'dead', x: f[n * 9], y: f[n * 9 + 1], z: f[n * 9 + 2], vx: 0, vy: 0, vz: 0, replay: true };
    }
    function endReplay() {
      if (phase !== 'replay') return;
      replay = null; for (const p of everyone) { p.rcel = 0; p.rdive = 0; }
      nextPlay();
    }

    // ---------- camera & projection ----------
    const VP = new Float32Array(16);
    function updateCam(dt) {
      let e, c, rate = 3.2;
      const qb = OK.QB || { x: 0, z: los - 5, lk: { hs: 1 } };
      const fl = (p, back) => { // follow-cam behind a runner (or in front of a defender running the other way)
        const dir = p.side === 1 ? -1 : 1;
        return [[p.x * (0.8 + 0.15 * por), 8.2 + 12 * por + 1.5 * lnd, p.z - dir * (back || 11.5) + dir * 2 * por], [p.x * 0.95, 0.4, p.z + dir * (8 - 4 * por)]];
      };
      if (phase === 'replay' && replay && ball) {
        const a = replay.orbit + replay.t * 0.45, bx = ball.x || 0, bz = ball.z || los;
        e = [bx + Math.sin(a) * (10 + 4 * por), 2.6 + 3 * por, bz + Math.cos(a) * (10 + 4 * por) - 4]; c = [bx, 1.2, bz]; rate = 5;
      } else if (phase === 'splash' || phase === 'cpu' || phase === 'break' || phase === 'over' || phase === 'box') {
        const t = performance.now() / 1000 * 0.1, z0 = phase === 'splash' ? los : 50;
        e = [Math.sin(t) * 26, 15 + 8 * por, z0 - 4 - Math.cos(t) * 30]; c = [0, 0, z0 + 4];
      } else if (closeP && phase === 'dead' && deadTot - deadT > 0.35) {
        const q = closeP, hh = 2.05 * 1.12 * q.lk.hs;
        e = [q.x + 0.6, hh + 0.55, q.z + 3.7 + por * 1.5]; c = [q.x, hh - 0.25, q.z]; rate = 4;
      } else if (phase === 'pre' && intro > 0 && OK.QB) {
        const hh = 2.05 * 1.12 * qb.lk.hs;
        e = [0.45, hh + 0.3, qb.z + 2.75 + por]; c = [0, hh - 0.05, qb.z];
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
        [e, c] = fl(carrier); rate = phase === 'live' ? 6 : 3;
        if (phase === 'dead') { e[1] += 1; }
      } else if (phase === 'live' && ball && ball.st === 'air' && !kick) {
        const b = ball, k = Math.min(1, b.t / b.T), ez = lerp(b.fromZ || los - 6, b.tz, 0.5 * k);
        if (target) {
          const cx = lerp(target.x, b.tx, 0.55), cz = lerp(target.z, b.tz, 0.55) + 2;
          c = [cx, 0.6, cz]; e = [cx * 0.8, 9 + 9 * por + 2 * lnd, cz - 13 - 4 * por]; rate = 4;
        } else {
        e = [b.tx * 0.45 * k, 10 + Math.min(10, (b.D || 10) * 0.18) + 12 * por, Math.min(ez - 11 - 4 * por, b.tz - 13 - 4 * por)]; c = [lerp(b.x, b.tx, 0.6), 0.5, lerp(b.z, b.tz, 0.75)]; rate = 3.6;
        }
      } else {
        const look = phase === 'live' ? Math.min(tPlay, 3) * 1.2 : 0;
        const bootX = play.type === 'boot' && phase === 'live' ? qb.x * 0.5 : 0;
        e = [bootX, 15 + 15 * por + 3 * lnd, los - 19 - 5 * por - 2 * lnd]; c = [bootX, 0, los + 7 + look + 3 * por - 1.5 * lnd];
      }
      const k = dt < 0 ? 1 : 1 - Math.exp(-dt * rate);
      for (let i = 0; i < 3; i++) { cam.e[i] += (e[i] - cam.e[i]) * k; cam.c[i] += (c[i] - cam.c[i]) * k; }
      const asp = cv.width / cv.height, fovy = clamp(2 * Math.atan(Math.tan((78 * Math.PI) / 360) / asp), 0.75, 1.2 + 0.12 * por);
      const f = 1 / Math.tan(fovy / 2), n = 0.6, fa = 420;
      const ex = -cam.e[0], ey = cam.e[1], ez = cam.e[2], cx = -cam.c[0], cy = cam.c[1], cz = cam.c[2];
      let zx = ex - cx, zy = ey - cy, zz = ez - cz; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = zz, xz = -zx; l = Math.hypot(xx, xz) || 1; xx /= l; xz /= l; const xy = 0;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const V = [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
      V[0] = -V[0]; V[1] = -V[1]; V[2] = -V[2];
      const Pm = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
      for (let cI = 0; cI < 4; cI++) for (let r = 0; r < 4; r++) { let s = 0; for (let kk = 0; kk < 4; kk++) s += Pm[kk * 4 + r] * V[cI * 4 + kk]; VP[cI * 4 + r] = s; }
    }
    function project(x, y, z) {
      const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (w <= 0.1) return null;
      const px = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w, py = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
      return [(px + 1) / 2 * cssW, (1 - py) / 2 * cssH];
    }

    // ---------- drawing ----------
    const dyn = new Batch(26000), tr = new Batch(5000), fb = new Batch(800);
    dyn.nb = true;
    const SC = 1.12;
    function tquad(m, cx, cy, cz, w, h, dir, cell) {
      const [u0, v0, u1, v1] = cellUV(cell), hw = w / 2, hh = h / 2;
      const L = dir === 1 ? [[hw, 0], [-hw, 0]] : dir === -1 ? [[-hw, 0], [hw, 0]] : [[0, dir > 0 ? -hw : hw], [0, dir > 0 ? hw : -hw]];
      const P = (lx, ly, lz) => [m[0] * lx + m[1] * ly + m[2] * lz + m[3], m[4] * lx + m[5] * ly + m[6] * lz + m[7], m[8] * lx + m[9] * ly + m[10] * lz + m[11]];
      const a = P(cx + L[0][0], cy + hh, cz + L[0][1]), b2 = P(cx + L[1][0], cy + hh, cz + L[1][1]), c2 = P(cx + L[1][0], cy - hh, cz + L[1][1]), d = P(cx + L[0][0], cy - hh, cz + L[0][1]);
      const ax = Math.abs(dir) === 1 ? 2 : 0, sg = dir < 0 ? -1 : 1, nrm = [m[ax] * sg, m[4 + ax] * sg, m[8 + ax] * sg];
      fb.quad(a, b2, c2, d, nrm, [1, 1, 1, 1], [u0, v0, u1, v0, u1, v1, u0, v1]);
    }
    function drawPlayer(b, p) {
      const C = p.side ? DEFC : OFFC, lk = p.lk, s = SC * lk.hs, wx = p.w || 1, skin = SKIN[lk.skin];
      const sp = Math.hypot(p.vx, p.vz), downish = p.fall > 0.05;
      const far = Math.hypot(p.x - cam.e[0], p.z - cam.e[2]) > 30 + 8 * por && phase !== 'replay' && !closeP && intro <= 0;
      let pose = p.pose;
      if (p.rdive) pose = 'dive';
      if (pose === 'stance' && phase !== 'pre' && phase !== 'kick' && phase !== 'pat' && phase !== 'splash') pose = 'run';
      const backward = (p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h)) < -0.8;
      const amp = downish ? 0 : Math.min(1, sp / 5.5);
      const sw = Math.sin(p.ph) * 0.95 * amp * (backward ? -0.7 : 1);
      const cel = p.cel > 0 || p.rcel;
      const jump = (p.jumpY || 0) + (cel ? Math.abs(Math.sin((p.cel || performance.now() / 300) * 7)) * 0.4 : 0);
      const isDive = pose === 'dive' || p.diveT > 0;
      let m = mT(IDM, p.x, jump + (isDive ? 0.35 : 0) + p.fall * 0.12, p.z);
      m = mRY(m, p.h + (p.mv === 'spin' && p.mvT > 0 ? (p.spin || 0) : 0));
      const lineman = p.role === 'OL' || p.role === 'DL';
      const stance3 = pose === 'stance' && lineman, stance2 = pose === 'stance' && !lineman;
      let pitch = 0.06 + 0.2 * amp;
      if (downish) pitch = pose === 'slide' ? -p.fall * 1.35 : p.fall * 1.42;
      else if (isDive) pitch = 1.3;
      else if (stance3) pitch = 0.62;
      else if (stance2) pitch = p.role === 'QB' ? 0.08 : 0.28;
      else if (pose === 'block') pitch = 0.32;
      else if (pose === 'tackle') pitch = 0.85;
      else if (backward) pitch = -0.08;
      else if (pose === 'kneel') pitch = 0.05;
      m = mRX(m, pitch);
      if (p.roll && !downish) m = mRZ(m, clamp(-p.roll * 0.07, -0.35, 0.35));
      const B = (mm, cx, cy, cz, sx, sy, sz, col) => b.box(mm, cx * s, cy * s, cz * s, sx * s, sy * s, sz * s, col);
      const bend = stance3 ? 0.7 : stance2 ? 0.35 : p.jumpY > 0.2 ? 0.8 : 0;
      for (const sd of [-1, 1]) {
        let lm = mT(m, sd * 0.15 * wx * s, 0.95 * s, 0);
        let la = sd * sw * 0.9 - bend;
        if (pose === 'kneel') la = sd < 0 ? -1.5 : 0.9;
        if (pose === 'kick' && sd === 1 && p.armT > 0) la = -1.6 * (p.armT / 0.4);
        if (isDive) la = 0.25 * sd;
        lm = mRX(lm, la);
        if (far) { B(lm, 0, -0.42, 0, 0.22, 0.86, 0.25, C.pant); continue; }
        B(lm, 0, -0.23, 0, 0.24, 0.46, 0.27, C.pant);
        let km = lm;
        if (pose === 'kneel' && sd < 0) { km = mT(lm, 0, -0.45 * s, 0); km = mRX(km, 1.5); km = mT(km, 0, 0.45 * s, 0); }
        else if (bend > 0) { km = mT(lm, 0, -0.45 * s, 0); km = mRX(km, bend * 1.3); km = mT(km, 0, 0.45 * s, 0); }
        B(km, 0, -0.66, 0, 0.17, 0.42, 0.19, skin);
        B(km, 0, -0.89, 0.06, 0.2, 0.12, 0.34, lk.cleat);
      }
      B(m, 0, 1.3, 0, 0.62 * wx, 0.66, 0.36, C.jer);
      B(m, 0, 1.63, 0, 0.88 * wx, 0.17, 0.44, C.pad);
      if (far) { B(m, 0, 1.97, 0, 0.38, 0.38, 0.38, C.helm); for (const sd of [-1, 1]) { let am = mT(m, sd * 0.42 * wx * s, 1.6 * s, 0); am = mRX(am, p.reach ? -2.35 : -sd * sw * 0.85); B(am, 0, -0.3, 0, 0.17, 0.6, 0.18, C.jer); } return m; }
      B(m, 0, 1.76, 0, 0.17, 0.12, 0.17, skin);
      B(m, 0, 1.95, 0.09, 0.27, 0.3, 0.14, skin);
      B(m, 0, 1.98, -0.04, 0.38, 0.36, 0.36, C.helm);
      B(m, 0, 2.165, -0.04, 0.09, 0.02, 0.38, C.stripe);
      B(m, 0, 1.79, 0.19, 0.3, 0.035, 0.035, MASK);
      for (const sd of [-1, 1]) B(m, sd * 0.155, 1.84, 0.12, 0.03, 0.1, 0.12, MASK);
      if (lk.visor) B(m, 0, 2.035, 0.168, 0.28, 0.07, 0.02, VISOR);
      if (p.face >= 0) tquad(m, 0, 1.95 * s, 0.1615 * s, 0.26 * s, 0.29 * s, 1, p.face);
      else if (p.hcell >= 0) for (const sd of [-2, 2]) tquad(m, (sd > 0 ? 0.192 : -0.192) * s, 1.99 * s, -0.05 * s, 0.22 * s, 0.22 * s, sd, p.hcell);
      if (p.ncell >= 0) { tquad(m, 0, 1.3 * s, -0.185 * s, 0.4 * s * wx, 0.4 * s, -1, p.ncell); tquad(m, 0, 1.32 * s, 0.185 * s, 0.3 * s, 0.3 * s, 1, p.ncell); }
      const hasBall = ball && ball.holder === p && phase !== 'replay' || (phase === 'replay' && ball && ball.holder === p);
      for (const sd of [-1, 1]) {
        let a = -sd * sw * 0.85, rz = 0;
        if (cel && p.celType === 2) { a = sd === 1 ? Math.PI - 0.1 : -0.3; rz = sd === 1 ? 0.2 : 0; }
        else if (cel && p.celType === 1) { a = sd === 1 ? (p.cel > 2.6 ? 2.6 : -0.4) : -0.2; }
        else if (cel) { a = Math.PI - 0.2; rz = sd * (0.35 + Math.sin(performance.now() / 120) * 0.15); }
        else if (p.reach) { a = -2.35; rz = sd * 0.1; }
        else if (isDive) { a = -2.9; rz = sd * 0.15; }
        else if (p.role === 'QB' && sd === 1 && hasBall && mode === 'aim') a = p.armT > 0 ? -1.6 : 2.1;
        else if (p.role === 'QB' && sd === 1 && p.armT > 0) a = p.armT > 0.2 ? 2.4 : -1.6;
        else if (pose === 'block') { a = -1.45; rz = -sd * 0.18; }
        else if (pose === 'tackle') { a = -1.25; rz = sd * 0.35; }
        else if (stance3) a = sd === 1 ? -0.55 : -0.25;
        else if (stance2) a = -0.35;
        else if (p.mv === 'stiff' && p.mvT > 0 && sd === -1) { a = -1.55; rz = -0.1; }
        else if (hasBall && sd === 1) { a = -0.55; rz = 0.55; }
        else if (p.stun > 0) { a = -1.4; rz = sd * 0.9; }
        else if (p.point && sd === 1) { a = -2.6; rz = 0.2; }
        else if (pose === 'kneel') a = -0.6;
        let am = mT(m, sd * 0.42 * wx * s, 1.6 * s, 0); am = mRZ(am, rz); am = mRX(am, a);
        B(am, 0, -0.15, 0, 0.19, 0.3, 0.2, C.jer);
        B(am, 0, -0.45, 0, 0.15, 0.32, 0.16, lk.sleeves ? C.jer : skin);
      }
      return m;
    }
    function drawBall(b, x, y, z, yaw, pitch) {
      let m = mT(IDM, x, y, z); m = mRY(m, yaw); m = mRX(m, pitch);
      b.box(m, 0, 0, 0, 0.2, 0.2, 0.36, BALLC); b.box(m, 0, 0.1, 0, 0.04, 0.02, 0.18, LACE);
      b.box(m, 0, 0, 0, 0.17, 0.17, 0.42, shade(BALLC, 0.8));
    }
    const COL = { open: [0.17, 0.83, 0.42, 0.8], mid: [1, 0.76, 0.1, 0.8], cov: [1, 0.2, 0.27, 0.75] };
    const sepClass = (d) => (d >= 3 ? 'open' : d >= 1.6 ? 'mid' : 'cov');
    function sepOf(r) { let bd = 99; for (const d of def) { if (d.fallT) continue; const dd = dist(d, r); if (dd < bd) bd = dd; } return bd; }
    // weather particles live in a box around the camera target
    const WXN = WX === 'rain' ? 340 : WX === 'snow' ? 260 : 0;
    for (let i = 0; i < WXN; i++) wxp.push({ x: (crand() - 0.5) * 50, y: crand() * 18, z: (crand() - 0.5) * 50, s: 0.6 + crand() * 0.6 });
    const flashes = [];
    function render(dt) {
      if (glLost || !G || finished) return;
      updateCam(dt);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const bindDraw = (buf, n, tex, data) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        if (data) gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(G.a.aP, 3, gl.FLOAT, false, 48, 0); gl.vertexAttribPointer(G.a.aN, 3, gl.FLOAT, false, 48, 12);
        gl.vertexAttribPointer(G.a.aC, 4, gl.FLOAT, false, 48, 24); gl.vertexAttribPointer(G.a.aT, 2, gl.FLOAT, false, 48, 40);
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.drawArrays(gl.TRIANGLES, 0, n);
      };
      const now = performance.now() / 1000;
      // sky
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.uniformMatrix4fv(G.u.uVP, false, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
      gl.uniform3f(G.u.uFogR, 1e5, 2e5, 0); gl.uniform3f(G.u.uEye, 0, 0, 0); gl.uniform2f(G.u.uUV, 0, 0);
      bindDraw(G.sky, 6, G.white);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      gl.uniformMatrix4fv(G.u.uVP, false, VP);
      gl.uniform3f(G.u.uEye, cam.e[0], cam.e[1], cam.e[2]); gl.uniform3f(G.u.uFogR, SKY.fogR[0], SKY.fogR[1], SKY.fogR[2]);
      if (boardDirty && ((now * 4) | 0) % 2 === 0) { boardDirty = false; try { boardCanvas(); gl.bindTexture(gl.TEXTURE_2D, G.board); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, boardC); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }
      for (const s of statics) {
        if (s.k === 'crowd') gl.uniform2f(G.u.uUV, 0, Math.max(0, Math.sin(now * 13)) * 0.02 * excite);
        bindDraw(s.b, s.n, s.tex);
        if (s.k === 'crowd') gl.uniform2f(G.u.uUV, 0, 0);
      }
      // dynamic scene
      dyn.n = 0; tr.n = 0; fb.n = 0;
      const showPlayers = phase !== 'box';
      if (showPlayers) for (const p of everyone) drawPlayer(dyn, p);
      if (ball && showPlayers) {
        const h = ball.holder;
        if (h) {
          const f = h.fall, hx = Math.sin(h.h), hz = Math.cos(h.h), hs = h.lk.hs;
          if (h.role === 'QB' && mode === 'aim' && h === OK.QB) drawBall(dyn, h.x + hz * 0.45 - hx * 0.1, 2.05 * hs + (h.jumpY || 0), h.z - hx * 0.45 - hz * 0.1, h.h, -0.5);
          else drawBall(dyn, h.x + hx * (0.32 + f * 0.8) - hz * 0.28, 1.35 * hs - f * 0.9 + (h.jumpY || 0) + (h.cel > 0 ? Math.abs(Math.sin(h.cel * 7)) * 0.4 : 0), h.z + hz * (0.32 + f * 0.8) + hx * 0.28, h.h, 0.3);
        } else if (ball.st === 'air' || ball.st === 'kick' || ball.st === 'pitch') {
          const b = ball, spin = now * 12;
          if (ball.st === 'kick') { let m = mT(IDM, b.x, b.y, b.z); m = mRX(m, spin); dyn.box(m, 0, 0, 0, 0.2, 0.2, 0.36, BALLC); dyn.box(m, 0, 0, 0, 0.17, 0.17, 0.42, shade(BALLC, 0.8)); }
          else drawBall(dyn, b.x, b.y, b.z, Math.atan2(b.vx || 0, b.vz || 1), -Math.atan2(b.vy || 0, Math.hypot(b.vx || 0, b.vz || 0) || 1));
          tr.disc(b.x, b.z, 0.28, [0, 0, 0, 0.32], 0.035, 8);
          if (ball.st === 'air' && b.tx != null && !b.replay) { const pul = 0.9 + Math.sin(now * 11) * 0.12; tr.ring(b.tx, b.tz, 0.85 * pul, 1.12 * pul, [1, 1, 1, 0.7], 0.05, 20); }
        } else if (ball.st === 'spot' || ball.st === 'snap') drawBall(dyn, ball.x, Math.max(0.15, ball.y), ball.z, 0, ball.st === 'spot' ? 1.57 : 0.3);
        else drawBall(dyn, ball.x, Math.max(0.12, ball.y), ball.z, 0.6, 1.2);
      }
      for (const q of parts) if (q.life > 0) { let m = mT(IDM, q.x, q.y, q.z); m = mRY(m, q.r); m = mRX(m, q.r * 0.7); dyn.box(m, 0, 0, 0, 0.22, 0.02, 0.14, q.c); }
      drawMarks(now);
      if (showPlayers) for (const p of everyone) tr.disc(p.x + 0.12, p.z - 0.1, 0.62 * (p.w || 1) + p.fall * 0.5, [0, 0, 0, 0.32], 0.02, 9);
      drawWeather(dt, now);
      if (dyn.n) bindDraw(G.dyn, dyn.n, G.white, dyn.f.subarray(0, dyn.n * 12));
      if (atlasDirty) {
        atlasDirty = false;
        try { gl.bindTexture(gl.TEXTURE_2D, G.atlas); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas); gl.generateMipmap(gl.TEXTURE_2D); }
        catch (e) { SQL.forEach((q) => { if (q.photo) noPhoto(q); }); ag.clearRect(0, 0, 1024, 512); atlasDirty = true; }
      }
      if (fb.n) bindDraw(G.fb, fb.n, G.atlas, fb.f.subarray(0, fb.n * 12));
      if (tr.n) { gl.depthMask(false); bindDraw(G.tr, tr.n, G.white, tr.f.subarray(0, tr.n * 12)); gl.depthMask(true); }
      updTags();
    }
    function drawMarks(now) {
      const live = phase === 'pre' || phase === 'live' || phase === 'dead' || phase === 'splash' || phase === 'pat';
      const scrim = live && !(kick && kick.type === 'ko') && phase !== 'pat';
      if (scrim && !tryMode) {
        tr.seg(-HW, los, HW, los, 0.3, [0.25, 0.55, 1, 0.85], 0.03);
        if (fdz < 100) tr.seg(-HW, fdz, HW, fdz, 0.3, [1, 0.86, 0.1, 0.92], 0.03);
      }
      // chain crew on the right sideline: down marker and the two sticks
      if (scrim && phase !== 'splash') {
        const sx = HW + 2.6, orange = [1, 0.45, 0.1, 1];
        dyn.box(IDM, sx, 1.1, los, 0.12, 2.2, 0.12, orange); dyn.box(IDM, sx, 2.35, los, 0.45, 0.45, 0.08, orange);
        if (fdz < 100) {
          dyn.box(IDM, sx, 1.1, fdz - 10, 0.12, 2.2, 0.12, orange); dyn.box(IDM, sx, 1.1, fdz, 0.12, 2.2, 0.12, orange);
          tr.seg(sx, fdz - 10, sx, fdz, 0.06, [0.85, 0.85, 0.85, 0.9], 0.6);
        }
      }
      // pre-snap route art
      if (phase === 'pre' || phase === 'splash') {
        const fx = flip ? -1 : 1;
        for (const p of off) {
          if (p.R) {
            const pts = p.R.pts, rc = hot[p.key] ? [0.3, 0.9, 1, 0.9] : p.key === 'X' ? [1, 0.76, 0.1, 0.9] : [1, 1, 1, 0.78];
            for (let k = 1; k < pts.length; k++) tr.seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.3, rc, 0.045);
            const a = pts[pts.length - 2], z = pts[pts.length - 1], dx = z[0] - a[0], dz = z[1] - a[1], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
            if (p.R.sit) tr.ring(z[0], z[1], 0.35, 0.65, rc, 0.045, 12);
            else tr.quad([z[0] + ux * 1.4, 0.046, z[1] + uz * 1.4], [z[0] - uz * 0.7, 0.046, z[1] + ux * 0.7], [z[0], 0.046, z[1]], [z[0] + uz * 0.7, 0.046, z[1] - ux * 0.7], [0, 0, 0], rc);
          } else if (p.role !== 'OL' && p.role !== 'QB' && p.blk) {
            tr.seg(p.x - 0.5, p.z + 0.9, p.x + 0.5, p.z + 0.9, 0.18, [1, 1, 1, 0.5], 0.045);
          }
        }
        if (play.type === 'run' || play.type === 'draw' || play.type === 'sneak') {
          const c = play.type === 'sneak' ? OK.QB : OK.RB, lx = (play.lane || 0) * fx, mid = [lx * 0.5, los - 1.5];
          tr.seg(c.x, c.z, mid[0], mid[1], 0.34, [1, 0.6, 0.2, 0.9], 0.045); tr.seg(mid[0], mid[1], lx, los + 4, 0.34, [1, 0.6, 0.2, 0.9], 0.045);
          tr.quad([lx, 0.046, los + 5.4], [lx - 0.7, 0.046, los + 4], [lx, 0.046, los + 4.3], [lx + 0.7, 0.046, los + 4], [0, 0, 0], [1, 0.6, 0.2, 0.9]);
        }
      }
      // aiming: predicted arc, landing spot with the error cone, intended receiver
      if (phase === 'live' && mode === 'aim' && aim) {
        const s = aimSpot(); aim.spot = s;
        if (s) {
          const qb = OK.QB, D = Math.min(s.D, maxDist()), ux = (s.x - qb.x) / (s.D || 1), uz = (s.z - qb.z) / (s.D || 1);
          const T = flightOf(D, arc), vy = ([1.5, 1.6, 2.0][arc] - 2.25 + 0.5 * GRAV * T * T) / T, sg = sigma(D, arc);
          for (let i = 1; i <= 16; i++) { const t = (i / 16) * T; tr.box(IDM, qb.x + ux * D * (i / 16), 2.25 + vy * t - 0.5 * GRAV * t * t, qb.z + uz * D * (i / 16), 0.3, 0.3, 0.3, [1, 0.86, 0.25, 0.92]); }
          const lx = qb.x + ux * D, lz = qb.z + uz * D, rr = 0.5 + sg * 1.4;
          tr.disc(lx, lz, rr, [1, 1, 1, 0.16], 0.055, 24);
          tr.ring(lx, lz, rr, rr + 0.4, s.over ? [1, 0.5, 0.2, 0.95] : [1, 1, 1, 0.95], 0.06, 28);
          tr.disc(lx, lz, 0.4, [1, 0.86, 0.1, 0.95], 0.065, 12);
          const r = nearestRec(lx, lz, 9);
          aim.tgt = r;
          if (r) tr.ring(r.x, r.z, 0.95, 1.25, [0.17, 0.83, 0.42, 0.85], 0.05, 18);
        }
      }
      if (phase === 'live' && mode === 'aim' && !aim) for (const r of off) if (isRec(r) && r.R && !(r.blk === 'chip' && tPlay < r.R.blk)) { const c = COL[sepClass(sepOf(r))], pul = 1 + Math.sin(now * 8) * 0.08; tr.ring(r.x, r.z, 0.95 * pul, 1.25 * pul, c, 0.05, 16); }
      if (phase === 'live' && ctrl && mode === 'catch') tr.ring(ctrl.x, ctrl.z, 0.9, 1.2, [0.17, 0.83, 0.42, 0.9], 0.05, 18);
      if ((phase === 'live' || phase === 'dead') && carrier && mode === 'run') tr.ring(carrier.x, carrier.z, 0.9, 1.2, [1, 0.76, 0.1, 0.85], 0.05, 18);
      // camera flashes in the stands on big moments
      if (excite > 0.3 && flashes.length < 40 && crand() < excite * 0.5) { const s = crand() < 0.5 ? -1 : 1; flashes.push({ x: s * (36 + crand() * 22), y: 3 + crand() * 15, z: -20 + crand() * 140, life: 0.08 }); }
      for (let i = flashes.length - 1; i >= 0; i--) { const q = flashes[i]; q.life -= 1 / 60; if (q.life <= 0) { flashes.splice(i, 1); continue; } tr.quad([q.x, q.y - 0.3, q.z - 0.3], [q.x, q.y - 0.3, q.z + 0.3], [q.x, q.y + 0.3, q.z + 0.3], [q.x, q.y + 0.3, q.z - 0.3], [0, 0, 0], [1, 1, 1, 0.9]); }
    }
    function drawWeather(dt, now) {
      if (!WXN) return;
      const cx = cam.c[0] * 0.5 + cam.e[0] * 0.5, cz = cam.c[2] * 0.5 + cam.e[2] * 0.5, rain = WX === 'rain', d = Math.min(dt, 0.05);
      for (const q of wxp) {
        q.y -= (rain ? 26 : 2.2) * q.s * d; q.x += (rain ? 1.5 : Math.sin(now + q.s * 9) * 0.8) * d;
        if (q.y < 0) { q.y += 18; q.x = (crand() - 0.5) * 50; q.z = (crand() - 0.5) * 50; }
        const x = cx + q.x, z = cz + q.z;
        if (rain) tr.streak(x, q.y, z, 1.3, 0.045, [0.8, 0.85, 0.95, 0.5]);
        else tr.quad([x - 0.07, q.y - 0.07, z], [x + 0.07, q.y - 0.07, z], [x + 0.07, q.y + 0.07, z], [x - 0.07, q.y + 0.07, z], [0, 0, 0], [1, 1, 1, 0.85]);
      }
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
    function updTags() {
      const pre = phase === 'pre' && !sheetOpen && intro <= 0, aiming = phase === 'live' && mode === 'aim';
      for (const k of tagKeys) {
        const p = OK[k], t = tags[k];
        const show = p && ((pre && (p.R || hot[k])) || (aiming && p.R && !(p.blk === 'chip' && tPlay < p.R.blk)) || (phase === 'live' && mode === 'catch' && p === ctrl));
        setTag(t, show ? project(p.x, 2.95 * p.lk.hs, p.z) : null, show);
        if (!show) continue;
        const c = aiming ? sepClass(sepOf(p)) : mode === 'catch' ? 'tgt' : '';
        const cls = 'bz-tag' + (c ? ' ' + c : '') + (aiming ? ' small' : '');
        if (t.className !== cls) t.className = cls;
        const em = pre && hot[k] ? ROUTE_NAMES[hot[k]] : mode === 'catch' ? '▼' : '';
        const e2 = t.querySelector('em'); if (e2.textContent !== em) e2.textContent = em;
      }
      const showC = carrier && carrier.side === 0 && (phase === 'live' || phase === 'dead') && !closeP && mode !== 'catch';
      if (showC && carTag.dataset.k !== carrier.key) { carTag.dataset.k = carrier.key; carTag.innerHTML = faceHTML(carrier.sq) + `<span>${esc(carrier.sq ? carrier.sq.name : '')}</span>`; }
      setTag(carTag, showC && carrier.sq ? project(carrier.x, 2.95 * carrier.lk.hs, carrier.z) : null, showC && !!carrier.sq);
      if (mvBtns && (ctrl && (performance.now() | 0) % 2 === 0)) for (const k in mvBtns) { const cd = ctrl.mvCd[k] || 0, tot = moveCd(ctrl, k) || 1; mvBtns[k].classList.toggle('cool', cd > 0); mvBtns[k].style.setProperty('--cd', ((1 - Math.max(0, cd) / tot) * 100).toFixed(0) + '%'); }
    }

    // ---------- scorebug ----------
    const SVG_FS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>';
    const SVG_SND = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 5c1.2 1.5 1.2 4.5 0 6" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
    const SVG_MUTE = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.5"/></svg>';
    bug.innerHTML = `<div class="bz-sb"><div class="bz-tm" data-t="h" style="--c:${HOMECSS}"><b>${esc(HOME.abbr)}</b><em>0</em><i></i><s></s></div><div class="bz-tm" data-t="a" style="--c:${OPPCSS}"><b>${esc(AWAY.abbr)}</b><em>0</em><i></i></div><div class="bz-clk"><b>2:00</b><span>Q1</span></div><div class="bz-pc">20</div></div><div class="bz-dd"><b>1st & 10</b><span>Own 25</span></div><div class="bz-sp"></div>`;
    const bH = bug.querySelector('[data-t=h]'), bA = bug.querySelector('[data-t=a]'), bClk = bug.querySelector('.bz-clk'), bPc = bug.querySelector('.bz-pc'), bDD = bug.querySelector('.bz-dd');
    const mkIB = (html, title) => { const b = el('button', 'bz-ib', html); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); bug.appendChild(b); return b; };
    const SVG_X = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3l10 10M13 3L3 13"/></svg>';
    const sndBtn = mkIB(SVG_SND, 'Sound'); sndBtn.classList.add('bz-snd'); const _x = 0, fsBtn = mkIB(SVG_FS, 'Full screen'), quitBtn = mkIB(SVG_X, 'Quit game');
    if (!fsOK) fsBtn.style.display = 'none';
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
      ctlKey = key; ctl.innerHTML = ''; mvBtns = null;
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
        msg(touchy ? '<span>Pull back &amp; release to throw · <b>slide back</b> to cancel</span>' : '<span>Drag back with the mouse &amp; release to throw · arrows move the QB</span>');
        const seg = el('div', 'bz-arc');
        ['Bullet', 'Touch', 'Lob'].forEach((n, i) => { const b = el('button', i === arc ? 'sel' : '', n); b.type = 'button'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setArc(i); }); seg.appendChild(b); });
        ctl.appendChild(seg);
        btn('bz-r', `Run${K('R')}`, scramble, 'pointerdown').style.flex = '0 0 76px';
      } else if (phase === 'live' && mode === 'catch') {
        msg(touchy ? '<span>Steer to the <b>ring</b> · time your catch</span>' : '<span>Arrows to the <b>ring</b> · SPACE jump · SHIFT dive</span>');
        const g = el('div', 'bz-catch'); ctl.appendChild(g);
        const d = el('button', 'bz-btn', `Dive${K('SHIFT')}`); d.type = 'button'; d.addEventListener('pointerdown', (e) => { e.preventDefault(); doDive(ctrl); }); g.appendChild(d);
        const j = el('button', 'bz-btn bz-g', `Jump${K('SPACE')}`); j.type = 'button'; j.addEventListener('pointerdown', (e) => { e.preventDefault(); doJump(ctrl); }); g.appendChild(j);
      } else if (phase === 'live' && mode === 'run') {
        if (kick && kick.type === 'ko' && kick.tbOK) btn('bz-y', `Take a knee<small>touchback</small>${K('T')}`, touchback, 'pointerdown');
        else msg(touchy ? '<span>Drag on the field to steer</span>' : '<span>Arrows / WASD to steer</span>');
        const g = el('div', 'bz-mv'); ctl.appendChild(g); mvBtns = {};
        const qbSlide = ctrl && ctrl.role === 'QB' && play.type !== 'sneak' && !(kick && kick.type === 'ko');
        [['juke', 'Juke', 'J', 'bz-r'], ['spin', 'Spin', 'K', ''], ['stiff', 'Stiff', 'L', ''], ['dive', qbSlide ? 'Slide' : 'Dive', 'SPACE', 'bz-y']].forEach(([m, n, k, c]) => {
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
    function setArc(i) { arc = i; sfx.play('tap'); ctl.querySelectorAll('.bz-arc button').forEach((b, k) => b.classList.toggle('sel', k === arc)); }
    function scramble() {
      if (phase !== 'live' || mode !== 'aim' || !OK.QB || ball.holder !== OK.QB) return;
      const q = OK.QB; aim = null; hideAim();
      carrier = q; ctrl = q; mode = 'run'; pr.kind = 'rush'; pr.rusher = q; runSeen = tPlay; q.hold = false; q.face2 = null;
      sfx.play('tap'); setControls(true);
    }
    function cycleHot(k) {
      if (phase !== 'pre' || sheetOpen || !(play.type === 'pass' || play.type === 'pa' || play.type === 'boot') || !OK[k] || k === 'RB') return;
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
        } else if (k !== 'QB') { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(x) - 4, Y(d) - 6); g.lineTo(X(x) + 4, Y(d) - 6); g.stroke(); }
        g.fillStyle = k === 'QB' ? '#ffc21a' : css(TEAM); g.beginPath(); g.arc(X(x), Y(d), 4, 0, 6.3); g.fill();
      }
      if (pl.type === 'run' || pl.type === 'draw' || pl.type === 'sneak') {
        const c = pl.type === 'sneak' ? F.QB : F.RB, lx = pl.lane || 0;
        g.strokeStyle = '#ff9a3c'; g.fillStyle = '#ff9a3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(c[0]), Y(c[1])); g.lineTo(X(lx * 0.5), Y(-1.5)); g.lineTo(X(lx), Y(5)); g.stroke(); tip(X(lx * 0.5), Y(-1.5), X(lx), Y(5));
      }
      if (pl.type === 'pa' || pl.type === 'boot') { g.fillStyle = 'rgba(255,154,60,.9)'; g.font = 'bold 10px Inter,sans-serif'; g.fillText('PA', 4, 12); }
    }
    function openSheet() {
      closeSheet(true);
      if (phase !== 'pre') return;
      sheetCat = play.cat;
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
    function drawCards() {
      if (!sheet) return;
      const cards = sheet.querySelector('.bz-cards'); cards.innerHTML = '';
      PLAYS.filter((p) => p.cat === sheetCat).forEach((p, i) => {
        const c = el('button', 'bz-card' + (p === play ? ' sel' : ''), ''); c.type = 'button';
        const cvs = document.createElement('canvas'); cvs.width = 176; cvs.height = 110; diagram(cvs, p, flip);
        c.appendChild(cvs);
        c.appendChild(el('b', '', `${touchy ? '' : '<span style="color:#ffc21a;font:400 8px \'Press Start 2P\',monospace;margin-right:5px">' + (i + 1) + '</span>'}${esc(p.name)}`));
        c.appendChild(el('em', '', esc(FORMS[p.form].name)));
        c.appendChild(el('span', '', esc(p.desc)));
        c.addEventListener('click', () => pickPlay(p));
        cards.appendChild(c);
      });
    }
    function pickPlay(p) {
      if (phase !== 'pre') return;
      if (p !== play) hot = {};
      play = p; lastCat = p.cat; sfx.play('tap'); if (intro > 0) intro = Math.min(intro, 0.3);
      setupPlay(); closeSheet();
      say(`<b>${esc(p.name)}</b> · ${esc(FORMS[p.form].name)}${flip ? ' (flipped)' : ''}${p.type === 'pass' || p.type === 'pa' || p.type === 'boot' ? ' · tap a receiver tag for a hot route' : ''}`);
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
    const aimEl = el('div', 'bz-aim'), aimLn = el('div', 'bz-aimln'), stickEl = el('div', 'bz-stick', '<b></b>');
    aimEl.style.display = aimLn.style.display = stickEl.style.display = 'none';
    stage.append(aimEl, aimLn, stickEl);
    function showAim() {
      if (!aim) return;
      aimEl.style.display = aimLn.style.display = 'block';
      aimEl.style.left = aim.ax + 'px'; aimEl.style.top = aim.ay + 'px';
      const dx = aim.px - aim.ax, dy = aim.py - aim.ay, l = Math.hypot(dx, dy);
      aimLn.style.left = aim.ax + 'px'; aimLn.style.top = aim.ay + 'px'; aimLn.style.width = l + 'px'; aimLn.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      aimEl.style.borderColor = l < 16 ? 'rgba(255,51,68,.8)' : 'rgba(255,255,255,.7)';
    }
    function hideAim() { aimEl.style.display = aimLn.style.display = 'none'; }
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
    let raf = 0, last = 0, running = false, ftAvg = 1 / 60, ftT = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const el2 = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      const mul = (DBG && DBG.speed) || 1;
      let sim = el2 * mul, n = 0;
      while (sim > 1e-6 && n < 400 && !finished) { const d = Math.min(sim, 1 / 60); if (aim) aim.dur += d; step(d); sim -= d; n++; }
      if (finished) return;
      render(el2);
      updBug();
      if (((now / 250) | 0) !== (((now - el2 * 1000) / 250) | 0)) { sfx.crowd(phase === 'splash' || phase === 'box' ? 0.05 : 0.12 + excite * 0.6); setControls(false); }
      if (el2 > 0 && el2 < 0.25) {
        ftAvg += (el2 - ftAvg) * 0.05; ftT += el2;
        if (ftT > 1.5 && ftAvg > 0.036 && rscale > 0.55) { rscale = Math.max(0.55, rscale - 0.15); ftT = 0; sizeBuffer(); }
        else if (ftT > 5 && ftAvg < 0.02 && rscale < 1) { rscale = Math.min(1, rscale + 0.1); ftT = 0; sizeBuffer(); }
        else if (ftT > 5) ftT = 0;
      }
    }
    function startLoop() { if (running || finished) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stopLoop() { running = false; cancelAnimationFrame(raf); }
    const onVis = () => { if (document.hidden) stopLoop(); else startLoop(); };
    let rzT = 0;
    const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!finished) { fit(); bugCache = ''; } }, 80); };
    const onOrient = () => { onResize(); setTimeout(() => { if (!finished && phase !== 'splash') { fit(); scrollIn(); } }, 350); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrient);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize); document.addEventListener('webkitfullscreenchange', onResize);
    const noScroll = (e) => { if (!finished && !(e.target && e.target.closest && e.target.closest('.bz-splash,.bz-cards,.bz-box'))) e.preventDefault(); };
    wrap.addEventListener('touchmove', noScroll, { passive: false });
    wrap.addEventListener('gesturestart', noScroll, { passive: false });
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
      if (!dn) return;
      const c = e.code;
      if (c === 'KeyT' && phase === 'pre') { callTimeout(); return; }
      if (sheet) {
        if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') { e.preventDefault(); pickPlay(play); return; }
        if (c === 'KeyF') { e.preventDefault(); sheet.querySelector('.bz-sh-top .bz-btn').click(); return; }
        if (c === 'Tab') { e.preventDefault(); const i = CATS.findIndex((x) => x[0] === sheetCat); sheet.querySelectorAll('.bz-tabs button')[(i + (e.shiftKey ? 3 : 1)) % 4].click(); return; }
        const n = /^Digit([1-9])$/.exec(c); if (n) { const pl = PLAYS.filter((p) => p.cat === sheetCat)[+n[1] - 1]; if (pl) { e.preventDefault(); pickPlay(pl); } return; }
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
      if (e.key === 'Shift') { if (mode === 'catch') doDive(ctrl); else if (mode === 'run') doMove('juke'); return; }
      if (c === 'KeyJ') { doMove('juke'); return; }
      if (c === 'KeyK') { doMove('spin'); return; }
      if (c === 'KeyL') { doMove('stiff'); return; }
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
    const onBlur = () => { input.l = input.r = input.u = input.d = 0; };
    window.addEventListener('blur', onBlur);
    let pid = null, origin = null, ptype = '';
    stage.addEventListener('pointerdown', (e) => {
      if (finished) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (phase === 'kick') { kickTap(); e.preventDefault(); return; }
      if (phase === 'replay') { endReplay(); return; }
      if (pid != null) return;
      if (phase === 'live' && mode === 'aim') {
        const q = OK.QB, s = project(q.x, 1.2, q.z);
        if (s && Math.hypot(s[0] - x, s[1] - y) < (touchy ? 34 : 24) && tPlay > 0.3) { scramble(); }
        else {
          pid = e.pointerId; ptype = 'aim';
          aim = { ax: x, ay: y, px: x, py: y, dur: 0, spot: null, tgt: null };
          try { stage.setPointerCapture(e.pointerId); } catch (er) {}
          showAim(); e.preventDefault(); return;
        }
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
      if (ptype === 'aim' && aim) { aim.px = x; aim.py = y; showAim(); return; }
      if (ptype === 'stick' && origin) {
        const dx = x - origin[0], dy = y - origin[1], l = Math.hypot(dx, dy), k = l > 42 ? 42 / l : 1;
        input.stick = [dx / 42, -dy / 42];
        stickEl.firstChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      }
    });
    const endPtr = (e) => {
      if (pid !== e.pointerId) return;
      if (ptype === 'aim' && aim) {
        const s = phase === 'live' && mode === 'aim' ? aimSpot() : null;
        if (s && e.type === 'pointerup') throwBall(s, arc);
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
      sfx.close();
      try {
        if (G) { for (const b of G.bufs) gl.deleteBuffer(b); for (const t of G.texs) gl.deleteTexture(t); gl.deleteProgram(G.pr); }
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
      <div class="bz-goal">${opts.label ? esc(opts.label) : lvlName} · ${wxName}<br>4 quarters × <em>${fmtClock(QS)}</em> · running clock · <em>${TOS}</em> timeouts a half</div>
      <div class="bz-squad">${['QB', 'RB', 'X', 'Z', 'S', 'Y'].map((k) => `<div>${faceHTML(SQ[k])}<span>${esc(shortName(SQ[k].name))}</span><em>${{ QB: 'QB', RB: 'RB', X: 'WR', Z: 'WR', S: 'WR', Y: 'TE' }[k]} #${SQ[k].num}</em></div>`).join('')}</div>
      <ul class="bz-how">
        <li><i>1</i><span><b>Call a play</b> from the playbook (runs, quick passes, deep shots, trick plays) and <b>SNAP</b>${touchy ? '' : ' (Space)'}. Tap a receiver's tag before the snap for a hot route.</span></li>
        <li><i>2</i><span><b>Throw</b>: ${touchy ? 'touch the field, pull back like a slingshot and let go' : 'drag back with the mouse and let go'}. The ring shows where it lands; pressure makes it wobble. Pick <b>Bullet / Touch / Lob</b>. Lead your receiver!</span></li>
        <li><i>3</i><span><b>Catch</b>: you control the receiver while the ball is in the air. Get to the ring, then <b>JUMP</b> for high balls or <b>DIVE</b> for low ones.</span></li>
        <li><i>4</i><span><b>Run</b>: ${touchy ? 'drag on the field to steer' : 'arrows / WASD'}, with <b>Juke, Spin, Stiff arm, Dive</b>${touchy ? '' : ' (J K L Space)'}. <b>Run</b> button${touchy ? ' (or drag the QB)' : ' (R)'} to scramble.</span></li>
        <li><i>5</i><span>On 4th down go for it, punt or kick a field goal with the <b>kick meter</b>. After a TD: kick the extra point or go for 2. The clock keeps running between plays.</span></li>
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
      throwAt(x, z, a) { if (mode !== 'aim') return false; return throwBall({ x, z, D: Math.hypot(x - OK.QB.x, z - OK.QB.z) }, a == null ? arc : a); },
      jump() { doJump(ctrl); }, dive() { doDive(ctrl); },
      debugSet(o) { if (phase !== 'pre') return; if (o.los != null) los = o.los; if (o.down) down = o.down; if (o.togo) fdz = Math.min(100, los + o.togo); if (o.clock != null) clock = o.clock; if (o.qtr) qtr = o.qtr; if (o.hs != null) hs = o.hs; if (o.as != null) as = o.as; if (o.run != null) clockRun = o.run; go4 = false; closeSheet(); toPre(false); },
      quit() { finishGame(true); },
      kickoff() { if (phase === 'pre') { closeSheet(); goHome(null, true); } },
      get cssW() { return cssW; }, get cssH() { return cssH; }, project(x, y, z) { return project(x, y, z); },
    };
    let elapsedT = 0;
    const stepRaw = step;
    step = function (dt) { if (phase !== 'splash' && phase !== 'box') elapsedT += dt; stepRaw(dt); };
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
    updateCam(-1); updBug(); setControls(true);
    startLoop();
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Barlow Condensed"').then(() => {
        if (!G || glLost || finished) return;
        gl.deleteTexture(G.field); G.field = mkTex(fieldCanvas()); G.texs.push(G.field); statics.forEach((s) => { if (s.k === 'field') s.tex = G.field; });
        for (const k in numMap) delete numMap[k]; numN = 0; for (const p of everyone) { p.ncell = p.num ? numCell(p.num, p.side) : -1; p.hcell = p.side === 0 && p.sq && p.face < 0 ? p.ncell : -1; }
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
