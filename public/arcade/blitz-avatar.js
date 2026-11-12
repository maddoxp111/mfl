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
.bz-tm.fire{box-shadow:inset 0 -3px 0 #ff7a1a;animation:bzfire .6s ease-in-out infinite alternate}.bz-tm.fire em{color:#ff9a3c}.bz-tm.fire b::after{content:' 🔥';font-size:12px}
@keyframes bzfire{from{background:rgba(255,122,26,.08)}to{background:rgba(255,122,26,.28)}}
.bz-bug.bz-clutch .bz-sb{border-color:#ff3344;animation:bzclutch .82s ease-in-out infinite}
@keyframes bzclutch{0%,100%{box-shadow:0 0 0 0 rgba(255,51,68,.0),0 3px 10px rgba(0,0,0,.4)}30%{box-shadow:0 0 0 3px rgba(255,51,68,.55),0 3px 10px rgba(0,0,0,.4)}}
.bz-clutchtag{position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:12;text-align:center;pointer-events:none;animation:bzct 3.2s ease-out forwards}
.bz-clutchtag b{display:block;font:900 clamp(28px,7vw,54px)/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:2px;color:#ff3344;text-shadow:0 0 18px rgba(255,51,68,.7),0 3px 0 #000}
.bz-clutchtag i{display:block;font:700 13px Inter,sans-serif;color:#fff;font-style:normal;margin-top:4px;text-shadow:0 2px 4px #000}
@keyframes bzct{0%{opacity:0;transform:translateX(-50%) scale(1.6)}12%{opacity:1;transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0}}
.bz-noise{position:absolute;inset:-12px;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 38%,rgba(0,0,0,.55) 70%,rgba(0,0,0,.92) 100%);transition:background .07s}
.bz-noise.flash{background:radial-gradient(ellipse at center,rgba(255,255,255,.22) 0%,rgba(255,255,255,.08) 45%,rgba(0,0,0,.6) 100%)}
.bz-pls{display:flex;align-items:center;gap:3px;padding:3px 8px;background:#0f1117;border:1px solid #262b38;border-radius:8px;animation:bzpls var(--pd,1.4s) ease-in-out infinite}
.bz-pls span{font:800 11px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#9aa0ad;margin-right:3px}
.bz-pls i{display:block;width:4px;border-radius:2px;background:#262b38}
.bz-pls i:nth-of-type(1){height:7px}.bz-pls i:nth-of-type(2){height:10px}.bz-pls i:nth-of-type(3){height:13px}.bz-pls i:nth-of-type(4){height:16px}.bz-pls i:nth-of-type(5){height:19px}
.bz-pls i.on{background:#2bd46b}.bz-pls.t3 i.on{background:#ffc21a}.bz-pls.t4 i.on{background:#ff9a3c}.bz-pls.t5 i.on{background:#ff3344}
.bz-pls.t4,.bz-pls.t5{border-color:rgba(255,51,68,.6)}
@keyframes bzpls{0%,100%{transform:scale(1)}12%{transform:scale(1.07)}}
.bz-narrow .bz-pls{padding:3px 6px}.bz-narrow .bz-pls span{display:none}
.bz-dcall{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 4px}
.bz-dcall.vs8{grid-template-columns:repeat(4,1fr)}.bz-dcall.vs4{grid-template-columns:repeat(4,1fr)}.bz-dcall.vs12{grid-template-columns:repeat(4,1fr);gap:5px}.bz-dcall.vs12 button{padding:7px 3px}.bz-dcall.vs12 button b{font-size:14px}
@media (max-width:560px){.bz-dcall.vs8,.bz-dcall.vs4{grid-template-columns:repeat(2,1fr)}.bz-dcall.vs12{grid-template-columns:repeat(3,1fr)}.bz-dcall.vs12 button small{font-size:9px}.bz-vsc{width:92%}.bz-dcall.vs8 button{padding:7px 4px}}
.bz-vsc{max-width:620px}
.bz-vsbadge{position:absolute;left:50%;top:64px;z-index:9;transform:translateX(-50%);max-width:92%;padding:7px 12px;border-radius:9px;background:rgba(15,17,23,.93);border:1px solid #ff9a3c;color:#f5f6f8;font:600 12px/1.4 Inter,sans-serif;text-align:center;pointer-events:none}
.bz-vscoins{text-align:center;margin:4px 0 0;color:#ffc21a;font:900 20px/1.2 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px}
.bz-dcall button{position:relative;display:flex;flex-direction:column;gap:2px;align-items:center;padding:9px 4px;border-radius:9px;border:1px solid #2f3546;background:#161a24;color:#e8e9ed;cursor:pointer;font:inherit;pointer-events:auto}
.bz-dcall button b{font:900 16px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px;text-transform:uppercase}.bz-dcall button small{font-size:10px;color:#9aa0ad;line-height:1.2}
.bz-dcall button.sug{border-color:#ffc21a;box-shadow:inset 0 0 0 1px #ffc21a}.bz-dcall button u{position:absolute;top:3px;right:5px;text-decoration:none;font:400 8px 'Press Start 2P',monospace;color:#ffc21a}
.bz-dct{font-size:11px;color:#9aa0ad;margin:2px 0 0}
.bz-dtm{height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:5px 0 0;overflow:hidden}.bz-dtm i{display:block;height:100%;background:#ffc21a;border-radius:2px}
.bz-tm.pos i{opacity:1}
.bz-tm s{display:flex;gap:2px;text-decoration:none;position:absolute;left:8px;bottom:2px}
.bz-tm s u{display:block;width:9px;height:2px;background:#ffc21a;text-decoration:none}.bz-tm s u.off{background:#2a2f3c}
.bz-clk{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 8px;background:#161922;min-width:64px}
.bz-clk b{font:400 11px/1.2 'Press Start 2P',monospace;color:#f5f6f8}.bz-clk.run b{color:#ffc21a}
.bz-clk span{font:700 9px/1.2 Inter,sans-serif;color:#9aa0ad;letter-spacing:.5px}.bz-clk.lp span{color:#ff5a5a}
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
.bz-ban{position:absolute;left:50%;top:48px;z-index:5;transform:translate(-50%,-4px);display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 11px 6px;border-radius:12px;background:rgba(7,8,11,.62);border:1px solid rgba(255,217,59,.35);pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;max-width:94%}
.bz-ban.on{opacity:1;transform:translate(-50%,0)}
.bz-ban-i{display:flex;gap:2px}.bz-ban-i svg{width:19px;height:19px;color:#6d6a5a;opacity:.45;transition:color .15s,opacity .15s,transform .15s}
.bz-ban-i svg.f{color:#ffd93b;opacity:1;transform:scale(1.12)}
.bz-ban b{font:400 12px/1.2 'Press Start 2P',monospace;color:#ffd93b;text-shadow:2px 2px 0 #000;white-space:nowrap;letter-spacing:.5px}
.bz-ban b i{font-style:normal;color:#ff3344}
.bz-ban.go{border-color:#ff3344}.bz-ban.go b{font-size:14px;animation:bz-banpop .45s cubic-bezier(.2,1.6,.4,1) both}
@keyframes bz-banpop{0%{transform:scale(.3);opacity:0}60%{opacity:1}100%{transform:scale(1)}}
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
.bz-pop.bz-big{font-size:17px;z-index:6;text-align:center;line-height:1.25;-webkit-text-stroke:1px #000;text-shadow:3px 3px 0 #000,0 0 14px rgba(0,0,0,.6);animation:bz-rise2 1.7s cubic-bezier(.2,.9,.3,1) both}.bz-pop.bz-big small{display:block;font-size:8px;color:#fff;-webkit-text-stroke:0;margin-top:5px;letter-spacing:.5px}
.bz-pop.bz-perk{font-size:12px;z-index:5;text-align:center;line-height:1.3;animation:bz-rise2 1.5s cubic-bezier(.2,.9,.3,1) both}.bz-pop.bz-perk small{display:block;font-size:7px;color:#e8ebf2;margin-top:3px}
@keyframes bz-rise2{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-8deg)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.3) rotate(3deg)}24%{transform:translate(-50%,-50%) scale(1) rotate(-2deg)}75%{opacity:1;transform:translate(-50%,-110%) scale(1)}100%{opacity:0;transform:translate(-50%,-190%) scale(.9)}}
.bz-banner{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:bz-zoom .6s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000;max-width:96%}
.bz-banner b{display:block;font-size:20px;line-height:1.3}
.bz-banner i{display:block;font-style:normal;font-size:9px;margin-top:8px;color:#f5f6f8;white-space:normal;line-height:1.5}
.bz-stick{position:absolute;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(255,255,255,.08);pointer-events:none;z-index:3}
.bz-stick b{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,194,26,.85)}
.bz-sheet{position:absolute;left:0;right:0;bottom:0;z-index:7;max-height:84%;display:flex;flex-direction:column;background:rgba(10,12,17,.96);border-top:2px solid #ffc21a;border-radius:16px 16px 0 0;padding:10px calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));box-shadow:0 -10px 30px rgba(0,0,0,.6);animation:bz-up .25s ease-out both}
.bz-sh-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.bz-dsh-tm{display:flex;flex-direction:column;gap:4px;margin:-2px 0 8px;font:600 12px Inter,sans-serif;color:#c9ccd4}.bz-dsh-tm b{color:#fff}.bz-dsh-tm i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}.bz-dsh-tm u{display:block;height:100%;width:100%;background:#ffc21a;transition:width .1s linear}
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
.bz-ons{padding:8px 12px 12px}
.bz-otap{text-align:center;font:900 26px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:1px;color:#fff;margin:0 0 7px;animation:bz-otap .45s ease-in-out infinite alternate}
.bz-otap small{font:700 11px Inter,sans-serif;letter-spacing:0;color:#9aa0ad;vertical-align:middle;margin-left:4px}
@keyframes bz-otap{from{transform:scale(1);opacity:.8}to{transform:scale(1.12);opacity:1}}
.bz-ons.done .bz-otap{animation:bz-pulse .25s 2;font-size:32px;text-shadow:0 0 12px currentColor}
.bz-obar{position:relative;height:34px}
.bz-ozn{position:absolute;inset:0;border-radius:8px;overflow:hidden;border:2px solid #000;background:#111}
.bz-ozn span{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
.bz-ozn em{font:800 10px/1 'Barlow Condensed',Inter,sans-serif;font-style:normal;letter-spacing:.3px;color:rgba(0,0,0,.72);white-space:nowrap;overflow:hidden}
.bz-ozn .g3 em{font-size:12px;color:#04230f}
.bz-ons.done .bz-ozn span{opacity:.35}.bz-ons.done .bz-ozn span.hit{opacity:1;box-shadow:inset 0 0 0 3px #fff}
.bz-obar b{position:absolute;left:50%;top:-8px;bottom:-8px;width:2px;margin-left:-1px;background:linear-gradient(#fff 0 6px,transparent 6px calc(100% - 6px),#fff calc(100% - 6px))}
.bz-obar i{position:absolute;top:-7px;bottom:-7px;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 2px #000,0 0 10px #fff}
.bz-dcard{position:absolute;left:50%;top:50%;z-index:5;transform:translate(-50%,-50%);min-width:240px;width:max-content;max-width:90%;padding:14px 18px;background:rgba(15,17,23,.95);border:2px solid var(--oc,#ffc21a);border-radius:12px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.6);animation:bz-zoom .45s cubic-bezier(.2,1.4,.4,1) both}
.bz-dcard h3{margin:0 0 8px;font:900 22px/1.05 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--oc,#ffc21a)}
.bz-dcard p{margin:5px 0;font:400 9px/1.6 'Press Start 2P',monospace;color:#c9ccd4}
.bz-dcard p b{color:#f5f6f8}
.bz-dslide{width:min(520px,92%);margin:4px auto 14px;padding:12px 16px 10px;border-radius:12px;background:rgba(15,17,23,.72);border:1px solid #2a2f3c;text-align:center}
.bz-dslide-h{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-bottom:8px}.bz-dslide-h b{font:900 20px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a}.bz-dslide-h span{font:500 12px Inter,sans-serif;color:#9aa0ad}
.bz-dslide input{width:100%;accent-color:#ffc21a;cursor:pointer;height:26px;margin:0}
.bz-dslide-t{display:flex;justify-content:space-between;margin:2px 2px 0;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}.bz-dslide-t i{font-style:normal;width:20%;text-align:center}.bz-dslide-t i:first-child{text-align:left}.bz-dslide-t i:last-child{text-align:right}.bz-dslide-t i.on{color:#ffc21a}
.bz-dslide-d{margin:6px 0 0;font:500 13px Inter,sans-serif;color:#e5e7eb}
.bz-setp{position:absolute;top:54px;right:calc(10px + env(safe-area-inset-right,0px));z-index:30;width:min(340px,calc(100% - 20px));padding:12px 14px;border-radius:12px;background:rgba(15,17,23,.97);border:1px solid #2a2f3c;box-shadow:0 12px 30px rgba(0,0,0,.6);color:#e5e7eb;font:500 13px Inter,sans-serif}
.bz-setp[hidden]{display:none}
.bz-setp h5{margin:0 0 8px;font:900 18px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a}
.bz-sp-row{padding:8px 0;border-top:1px solid #222734}.bz-sp-row>b{display:block;font-weight:700;color:#f5f6f8}.bz-sp-row>small{display:block;margin:2px 0 6px;color:#9aa0ad;font-size:11.5px}
.bz-sp-seg{display:flex;gap:4px}.bz-sp-seg button{flex:1;min-height:34px;padding:0 4px;border-radius:8px;border:1px solid #2a2f3c;background:#1d212c;color:#c9ccd4;font:700 12px Inter,sans-serif;cursor:pointer}.bz-sp-seg button.on{background:#ffc21a;border-color:#ffc21a;color:#111}
.bz-sp-d{margin-top:6px!important;color:#e5e7eb!important}
.bz-sp-tg{display:flex;align-items:center;justify-content:space-between}.bz-sp-tg>b{display:inline}
.bz-sw{min-width:58px;min-height:32px;border-radius:999px;border:1px solid #2a2f3c;background:#1d212c;color:#9aa0ad;font:800 12px Inter,sans-serif;cursor:pointer}.bz-sw.on{background:#2bd46b;border-color:#2bd46b;color:#06210f}
.bz-dcard canvas.bz-mf{display:block;width:300px;max-width:100%;height:64px;margin:2px auto 6px;border-radius:6px;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.bz-dcard .mf-dd{font-size:10px;color:#c9ccd4}.bz-dcard .mf-dd b{color:#ffc21a}
.bz-dcard .mf-lp{min-height:1.6em;color:#f5f6f8}
.bz-dcard .bz-dres{margin-top:10px;font-size:14px;color:#f5f6f8}
.bz-dcard .bz-dsc{margin-top:8px;font-size:11px;color:#ffc21a}
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
.bz-tiny .bz-snd{display:none}.bz-tiny .bz-vc{display:none}.bz-vtog{display:flex;align-items:center;gap:8px;font:600 13px Inter,sans-serif;color:#c9ccd4;cursor:pointer}.bz-vtog input{width:18px;height:18px;accent-color:#ffc21a}.bz-narrow .bz-sta{min-width:46px;padding:0 5px}.bz-narrow .bz-tag{font-size:11px}.bz-narrow .bz-ib{min-width:32px;height:32px;padding:0 6px}.bz-narrow .bz-bug{gap:4px 4px;padding-left:6px;padding-right:6px}.bz-narrow .bz-tm{padding:3px 6px 3px 5px;gap:4px}.bz-narrow .bz-cards{grid-template-columns:1fr 1fr}.bz-narrow .bz-card span{display:none}.bz-narrow .bz-pc{display:none}
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
    const f = function () { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.st = (v) => { if (v != null) a = v >>> 0; return a; }; // its state, for a game saved and picked up again (78-resume.js)
    return f;
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
    let ac = null, out = null, noise = null, crowdG = null, crowdN = null, muted = false, lvl = 0.15, ka = null;
    // a looped, near-silent media element: on iPhones it makes the page a media player, so game sound and the booth play with the ring switch on silent
    const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAABwAAAW0AkZGRkZGRkZGRkZGRkZGkpKSkpKSkpKSkpKSkpLe3t7e3t7e3t7e3t7e3ycnJycnJycnJycnJycnJ29vb29vb29vb29vb29vt7e3t7e3t7e3t7e3t7f//////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQDKgAAAAAAAAFtxrSMoAAAAAAAAAAAAAAAAAD/8xDEAAAAA0gAAAAATEFNRTMuMTAwVVVVVf/zEsQNAAADSAAAAABVVVVVVVVVVVVVVVVVVf/zEMQbAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxCgAAANIAAAAAFVVVVVVVVVVVVVVVVX/8xDENQAAA0gAAAAAVVVVVVVVVVVVVVVVVf/zEMRCAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxE8AAANIAAAAAFVVVVVVVVVVVVVVVVU=';
    function keepAlive() {
      if (ka) { if (ka.paused) { try { ka.play().catch(() => {}); } catch (e) {} } return; }
      try { ka = document.createElement('audio'); ka.src = SILENT_MP3; ka.loop = true; ka.volume = 0.01; ka.setAttribute('playsinline', ''); ka.setAttribute('aria-hidden', 'true'); ka.style.display = 'none'; document.body.appendChild(ka); ka.play().catch(() => {}); } catch (e) {}
    }
    let s = 9137;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    function init() {
      if (ac || muted) return ac;
      try {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // newer iPhones: play through the silent switch
        keepAlive();
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
      stomp: () => { tone(52, 0.13, 'sine', 0.2, 38); burst(0.07, 110, 0.32, 0.9); },
      clap: () => { burst(0.05, 1700, 0.22, 1.4); burst(0.05, 2300, 0.16, 1.6, 0.012); },
      beat: () => { tone(60, 0.1, 'sine', 0.18, 42); tone(54, 0.12, 'sine', 0.14, 38, 0.18); },
      horn: () => { tone(233, 0.6, 'sawtooth', 0.04); tone(294, 0.6, 'sawtooth', 0.035); tone(349, 0.6, 'sawtooth', 0.03); },
      cheer: () => burst(2.2, 1000, 0.35, 0.5),
      boo: () => burst(1.4, 300, 0.18, 0.6),
      ooh: () => { burst(1.3, 650, 0.3, 0.55); tone(330, 0.6, 'sine', 0.025, 200); },
      clang: () => { tone(900, 0.35, 'triangle', 0.06, 700); burst(0.12, 1800, 0.25, 2); },
      doink: () => { tone(1250, 0.7, 'triangle', 0.09); tone(1875, 0.5, 'triangle', 0.05); tone(2500, 0.3, 'sine', 0.03); },
      squeak: () => { tone(1500, 0.08, 'square', 0.035, 2600); tone(2400, 0.1, 'square', 0.03, 1400, 0.09); },
      boing: () => tone(160, 0.38, 'sine', 0.09, 620),
      zap: () => { tone(1800, 0.12, 'sawtooth', 0.03, 300); burst(0.08, 3000, 0.15, 1); },
      coin: () => { tone(988, 0.07, 'square', 0.035); tone(1319, 0.2, 'square', 0.035, 0, 0.07); },
      win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.11)),
      lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'square', 0.04, 0, i * 0.15)),
      banana: () => tone(1046, 0.045, 'triangle', 0.022), // Metcalf: the banana count, one soft tick each
      rushgo: () => { tone(784, 0.06, 'square', 0.03); tone(1175, 0.12, 'square', 0.03, 0, 0.07); },
    };
    return {
      init,
      play(n) { if (muted || !init() || !SEQ[n]) return; try { if (ac.state === 'suspended') ac.resume(); SEQ[n](); } catch (e) {} },
      crowd(v) { lvl = v; if (ac && crowdG && !muted) try { crowdG.gain.setTargetAtTime(Math.max(0.0001, v * 0.5), ac.currentTime, 0.25); } catch (e) {} },
      mute(m) { muted = m; if (crowdG) try { crowdG.gain.setTargetAtTime(m ? 0.0001 : lvl * 0.5, ac.currentTime, 0.05); } catch (e) {} },
      get muted() { return muted; },
      ctx() { return init(); }, get out() { return out; },
      // after another app or a lock screen: iPhones suspend the audio; pick it back up on return and on the next touch
      wake() { if (!ac) return; if (ac.state !== 'running') { try { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } keepAlive(); },
      close() { try { if (crowdN) crowdN.stop(); if (ac) ac.close(); } catch (e) {} ac = null; },
    };
  }

  // ---------- Arcade CPU teams ----------
  const CPU_TEAMS = [
    { name: 'JV Squad', abbr: 'JV', color: '#64748b', color2: '#e2e8f0', ovrOff: 46, ovrDef: 45 },
    { name: 'Hall Monitors', abbr: 'HMS', color: '#7c3aed', color2: '#f5f3ff', ovrOff: 60, ovrDef: 60 },
    { name: 'Detention Kings', abbr: 'DK', color: '#b91c1c', color2: '#111111', ovrOff: 72, ovrDef: 72 },
    { name: 'The Faculty', abbr: 'FAC', color: '#0f172a', color2: '#facc15', ovrOff: 84, ovrDef: 85 },
    { name: 'The Board', abbr: 'BRD', color: '#111827', color2: '#f87171', ovrOff: 95, ovrDef: 96 },
    { name: 'The Principals', abbr: 'PRI', color: '#1e3a8a', color2: '#fbbf24', ovrOff: 92, ovrDef: 88 }, // Hall of Fame (level index 5)
  ];
  // Who you play in an Arcade game: a different team every game (name, colors), with the level's strength. The level teams
  // above are in the draw too. A team whose main color is too close to yours sits out that game.
  const OPP_TEAMS = CPU_TEAMS.map((t) => ({ name: t.name, abbr: t.abbr, color: t.color, color2: t.color2 })).concat([
    { name: 'Lunch Ladies', abbr: 'LUN', color: '#15803d', color2: '#fde047' },
    { name: 'Bus Drivers', abbr: 'BUS', color: '#eab308', color2: '#111827' },
    { name: 'The Substitutes', abbr: 'SUB', color: '#0891b2', color2: '#ecfeff' },
    { name: 'Pop Quizzes', abbr: 'POP', color: '#db2777', color2: '#fdf2f8' },
    { name: 'Gym Rats', abbr: 'GYM', color: '#ea580c', color2: '#1c1917' },
    { name: 'Lab Partners', abbr: 'LAB', color: '#65a30d', color2: '#f7fee7' },
    { name: 'Honor Roll', abbr: 'HNR', color: '#7f1d1d', color2: '#fbbf24' },
    { name: 'Marching Band', abbr: 'BND', color: '#f8fafc', color2: '#be123c' },
    { name: 'Recess Rebels', abbr: 'REC', color: '#0284c7', color2: '#fb923c' },
    { name: 'Fire Drills', abbr: 'FIR', color: '#dc2626', color2: '#facc15' },
    { name: 'Snow Days', abbr: 'SNW', color: '#e0f2fe', color2: '#0369a1' },
    { name: 'Tardy Slips', abbr: 'TDY', color: '#92400e', color2: '#fef3c7' },
    { name: 'Chess Club', abbr: 'CHS', color: '#334155', color2: '#f1f5f9' },
    { name: 'Summer School', abbr: 'SUM', color: '#0f766e', color2: '#fb923c' },
    { name: 'Spelling Bees', abbr: 'BEE', color: '#171717', color2: '#facc15' },
    { name: 'Science Fair', abbr: 'SCI', color: '#4338ca', color2: '#a3e635' },
  ]);
  const hexRGB = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x777777; return [n >> 16, (n >> 8) & 255, n & 255]; };
  const colorGap = (a, b) => { const A = hexRGB(a), B = hexRGB(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  function pickOpponent(lvl, home, seed) {
    const ok = OPP_TEAMS.filter((t) => colorGap(t.color, home.color) > 120 && t.name !== home.name);
    const list = ok.length ? ok : OPP_TEAMS;
    let h = 2166136261; for (const ch of String(seed == null ? Math.random() : seed) + '|opp') { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const id = list[(h >>> 0) % list.length], S = CPU_TEAMS[lvl];
    return Object.assign({}, id, { ovrOff: S.ovrOff, ovrDef: S.ovrDef });
  }

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
  // Metcalf is 7 on 7: the QB, the back, three receivers, the tight end and one lineman (the center) against one down lineman, two
  // linebackers, two corners and two safeties. The playbook there is this table laid over the one above: null drops a play that
  // needs a full line (a trap needs a guard to pull and kick out), an object renames or redraws one, ADD has plays drawn for 7 on 7.
  // The run game has no guards to pull: Power and Counter become lead and cutback runs behind the center and the back.
  const M7BOOK = {
    trap: null,
    zone: { desc: 'Downhill behind the center, read the hole' },
    ozone: { desc: 'Stretch it wide, the receivers seal the edge' },
    power: { name: 'Lead Strong', desc: 'The fullback leads off the tight end' },
    iso: { desc: 'The fullback leads straight at the linebacker' },
    counter: { name: 'Cutback', desc: 'Jab step right, cut it back left' },
    hbdive: { desc: 'Short yardage behind the center and the fullback' },
    sneak: { desc: 'Short yardage push behind the center' },
    qbpower: { name: 'QB Lead', desc: 'QB keeps it behind the back' },
    leaddraw: { desc: 'Pass look, then the back follows the fullback' },
    swing: { desc: 'Swing it wide, the slot and tight end block in front' },
    rbscreen: { desc: 'Let the rusher in, dump it over him' },
    pashot: { desc: 'Back and tight end stay in, two deep' },
  };
  const M7ADD = [
    { id: 'rub', name: 'Bunch Rub', form: 'bunch', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'The bunch crosses, someone comes open off the rub', routes: { Z: R([[0, 7], [5, 7]]), S: R([[2, 1], [8, 2.5]]), Y: R([[0, 3], [-9, 8]]), X: CURL, RB: CHK } },
    { id: 'yoption', name: 'Y Option', form: 'gun', cat: 'mid', type: 'pass', yd: 9, risk: 0.25, clk: 0.4, desc: 'One linebacker over the middle: the tight end breaks away from him', routes: { Y: R([[0, 7], [-1, 8.5]], { sit: 1 }), X: GO, Z: GO, S: R([[0, 12], [-10, 16]]), RB: R([[3, 0], [8, 1.5]]) } },
    { id: 'spotfl', name: 'Spot', form: 'trips', cat: 'quick', type: 'pass', yd: 7, risk: 0.2, clk: 0.5, desc: 'Corner, spot and flat flood one side', routes: { Z: CORNER, S: SNAG, Y: FLAT, X: SLANT, RB: CHK } },
  ];
  const m7Plays = (L) => { const out = []; for (const p of L) { if (!(p.id in M7BOOK)) out.push(p); else if (M7BOOK[p.id]) out.push(Object.assign({}, p, M7BOOK[p.id])); } for (const p of M7ADD) out.push(p); return out; };
  const PLAYS_STD = PLAYS;
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
      cbV: L(6.8, 8.3), lbV: L(6.0, 7.5), dlV: L(5.3, 6.7), sV: L(6.7, 8.2),
      lag: L(0.7, 0.3), react: L(0.66, 0.36), cush: L(7.5, 4.5), zoneTight: L(0.45, 0.72),
      shedPass: L(4.0, 2.4), shedRun: L(2.2, 1.3), read: L(0.7, 0.34), bite: L(0.9, 0.25),
      tackle: L(40, 84), intSkill: L(0.06, 0.1), deflect: L(0.2, 0.3), stare: L(0.15, 0.6),
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
  // slots (SL): 0 jer 1 pant 2 skin 3 helm 4 trim 5 cleat 6 pad 7 mask 8 num 9 face 10 arm 11 name 12 glove 13 sock 14 sole 15 visor 16 snum 17 wht 18 eye 19 tape 20 towel 21 stripes 22 mouth 23 hair 24 cloth 25 scanned head (22-heads.js)
  const VS_SKIN = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aB;attribute float aW;attribute float aS;attribute vec2 aT;attribute float aA;
uniform vec4 uBones[51];uniform vec3 uScale;uniform mat4 uVP;uniform HP vec3 uEye;uniform HP vec3 uCamF;uniform vec4 uNumUV;uniform HP vec4 uFaceUV;uniform vec4 uNameUV;uniform float uVis;uniform float uTowel;uniform float uSway;uniform float uMouth;uniform vec4 uFxV;uniform float uHead;
varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vVD;varying float vS;varying float vA;varying vec3 vP;
vec3 skinP(int b,vec4 p){return vec3(dot(uBones[b],p),dot(uBones[b+1],p),dot(uBones[b+2],p));}
vec3 skinN(int b,vec3 n){return vec3(dot(uBones[b].xyz,n),dot(uBones[b+1].xyz,n),dot(uBones[b+2].xyz,n));}
void main(){int b0=int(aB.x)*3;int b1=int(aB.y)*3;int s=int(aS);vec3 lp=aP*uScale;
if((s==15&&uVis<0.5)||(s==20&&uTowel<0.5)||(s==22&&uMouth<0.5))lp=vec3(0.0);
if(uHead>0.5&&aB.x>3.5&&aB.x<4.5&&aW>0.999&&aP.y>0.8&&s!=25)lp=vec3(0.0); // bone 4 = head (05-anim BONES)
if(s==20){float k=clamp(-aP.y*4.0,0.0,1.0);lp.z+=uSway*k*k;lp.x+=uSway*0.35*k;}
lp+=aN*uFxV.x;
vec4 p=vec4(lp,1.0);float w0=aW,w1=1.0-aW;
vec3 w=skinP(b0,p)*w0+skinP(b1,p)*w1;vec3 n=normalize(skinN(b0,aN)*w0+skinN(b1,aN)*w1);
bool num=(s==8||s==16);
vT=num?uNumUV.xy+aT*uNumUV.zw:(s==11?uNameUV.xy+aT*uNameUV.zw:(s==9?uFaceUV.xy+aT*uFaceUV.zw:aT));
vS=aS;vA=aA;vP=aP;vW=w;vN=n;gl_Position=uVP*vec4(w,1.0);vVD=dot(w-uEye,uCamF);}`;
  const FS_SKIN = `uniform sampler2D uTex;uniform sampler2D uKit;uniform sampler2D uNrm;uniform HP vec4 uFaceUV;uniform vec3 uCol[26];uniform float uAlpha;uniform float uWet;uniform float uDirt;uniform vec3 uDirtC;uniform vec3 uGaze;uniform float uSweat;uniform float uSeed;uniform vec4 uFx;uniform vec3 uFxC;
varying vec2 vT;varying float vS;varying float vA;varying vec3 vP;
#LIB#
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){int s=int(vS+0.5);vec3 base;float rough=0.6,metal=0.0,alpha=1.0;int mode=0;float specOcc=1.0;float ao=vA;
vec3 N=normalize(vN);vec3 c=uCol[s];
bool kit=(s==0||s==1||s==3||s==12||s==13||s==21);bool numS=(s==8||s==16);
vec4 t=vec4(1.0);
if(kit){t=texture2D(uKit,vT);base=toLin(t.rgb);}
else if(s==9||s==25){t=texture2D(uTex,vT);base=toLin(t.rgb);}
else if(numS||s==11){t=texture2D(uTex,vT);if(t.a<0.45)discard;base=toLin(c*t.rgb);}
else base=toLin(c);
if(s==0||s==1||s==13||s==21||s==10||s==12||numS||s==11||s==24){ // fabrics: woven normal map, roughness from the kit alpha
  float scale=(s==1?7.0:(s==13?9.0:5.0));vec3 nm=texture2D(uNrm,vT*scale).rgb;N=perturb(N,vW,vT,nm,s==1?0.35:0.55);
  rough=(s==1?0.55:(s==13?0.85:0.72))*(0.75+0.5*t.a);
  if(numS||s==11){rough=0.42;N=normalize(vN);}
  if(s==10){rough=0.7;}
  if(s==24){base*=0.93+0.14*noise(vT*vec2(420.0,260.0));} // casual cotton / fleece: a faint heather
  // grass and mud stains build up on players who have been tackled
  if(uDirt>0.0&&(s==0||s==1||s==13||s==24||numS)){float n=noise(vT*18.0+uSeed)*0.6+noise(vT*47.0+uSeed*3.0)*0.4;float st=smoothstep(0.62-uDirt*0.3,0.9,n)*uDirt*(s==1?1.0:0.6)*(1.0-smoothstep(0.1,0.85,vT.y)*0.3);base=mix(base,uDirtC*(0.6+0.4*n),st);rough=mix(rough,0.95,st);}
}
if(s==2||s==9){mode=1;rough=mix(0.55,0.3,uSweat);specOcc=0.6+0.5*uSweat;if(s==9){ // face: photo blended into skin at the edges
  vec2 q=(vT-uFaceUV.xy)/uFaceUV.zw;float m=1.0-smoothstep(0.44,0.8,length((q-vec2(0.5,0.5))*vec2(1.0,0.8))*2.0);base=mix(toLin(uCol[2]),base,m*t.a);}}
if(s==25){rough=0.92;specOcc=0.1;base*=0.8;} // scanned heads: their texture already holds the photo's light, so matte with no skin sheen
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
if(s==23){ // hair: fine streaks along the strands, soft sheen
  float a=atan(vP.x,vP.z);float st=noise(vec2(a*34.0,vP.y*70.0))*0.6+noise(vec2(a*90.0,vP.y*160.0))*0.4;base*=0.72+0.5*st;rough=0.5;specOcc=0.55;}
if(s==15){rough=0.05;base=mix(base,vec3(0.02,0.025,0.03),0.7);alpha=uAlpha;specOcc=2.0;metal=0.3;}
if(s==20){rough=0.9;}
if(uWet>0.0&&(s==3||s==0||s==1||s==2||s==5||s==9)){rough=mix(rough,0.18,uWet*0.5);}
// card effects (uFx: mode, strength, time, seed; uFxC: colour)
vec3 emis=vec3(0.0);float fm=uFx.x,fk=uFx.y,ft=uFx.z;
if(fm>0.5){vec3 V=normalize(uEye-vW);float fres=pow(1.0-abs(dot(N,V)),2.0);float lum=dot(base,vec3(0.3,0.59,0.11));bool skinS=(s==2||s==9||s==10||s==18||s==23||s==25);
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
 else if(fm<11.5){if(skinS&&s!=18&&s!=23)emis+=uFxC*(0.5+0.45*sin(ft*5.0))*fk;}
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
  const VS_DEPTH_S = `attribute vec3 aP;attribute vec2 aB;attribute float aW;attribute float aS;uniform vec4 uBones[51];uniform vec3 uScale;uniform mat4 uLVP;uniform float uVis;uniform float uTowel;uniform float uMouth;uniform float uHead;
void main(){int b0=int(aB.x)*3;int b1=int(aB.y)*3;vec3 lp=aP*uScale;if(uHead>0.5&&aB.x>3.5&&aB.x<4.5&&aW>0.999&&aP.y>0.8&&aS<24.5)lp=vec3(0.0);if((aS>14.5&&aS<15.5&&uVis<0.5)||(aS>19.5&&aS<20.5&&uTowel<0.5)||(aS>21.5&&aS<22.5&&uMouth<0.5))lp=vec3(0.0);vec4 p=vec4(lp,1.0);
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
    if (t <= keys[0][0]) return lerpPose(keys[0][1], keys[0][1], 0); // a copy: the procedural layers edit the pose they get
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const u = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); const s = u * u * (3 - 2 * u); return lerpPose(keys[i - 1][1], keys[i][1], s); }
    return lerpPose(keys[keys.length - 1][1], keys[keys.length - 1][1], 0);
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
  // ---------- procedural locomotion: walk, jog, run, sprint, backpedal, shuffle, chop steps, cuts ----------
  // Every gait comes from one model. Each foot follows a path relative to the hips: on the ground it moves back at exactly the
  // body's speed (so a planted foot stays put on the turf), then it lifts (heel up behind, knee driven through) and swings to the
  // next plant. Cadence, stride and contact time scale with speed like a real runner's; leg IK turns the foot spots into
  // hip/knee/ankle angles, so lean, banking, pelvis twist and the bob never drag a planted foot.
  const LL1 = 0.5, LL2 = 0.47, LEGR = LL1 + LL2 - 0.006, TAU = 6.2832;
  // closed-form leg IK in the pelvis frame: ankle at (x, y, z) from the hip joint; raw hip X/Z, knee X, foot X (fp: wanted world
  // foot pitch, + = toes down; bp: the pelvis pitch the foot sits under)
  function legSolve(q, side, x, y, z, fp, bp) {
    const hp = (side < 0 ? B.hipL : B.hipR) * 3, kn = (side < 0 ? B.knL : B.knR) * 3, ft = (side < 0 ? B.ftL : B.ftR) * 3;
    let d = Math.sqrt(x * x + y * y + z * z);
    if (d > LEGR) { const s = LEGR / d; x *= s; y *= s; z *= s; d = LEGR; }
    const ck = clamp((d * d - LL1 * LL1 - LL2 * LL2) / (2 * LL1 * LL2), -0.85, 1), k = Math.acos(ck);
    const r = LL1 + LL2 * ck, b = Math.asin(clamp(x / r, -0.8, 0.8)), Y0 = -r * Math.cos(b), Z0 = -LL2 * Math.sin(k);
    let a = Math.atan2(z, y) - Math.atan2(Z0, Y0); if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU;
    q[hp] = a; q[hp + 1] = 0; q[hp + 2] = b; q[kn] = k; q[kn + 1] = 0; q[kn + 2] = 0; q[ft] = clamp(fp - bp - a - k, -1.2, 1.4); q[ft + 1] = 0; q[ft + 2] = 0;
  }
  const smo = (u) => u * u * (3 - 2 * u), bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));
  // gait timing from speed (yards/s in leg units): steps per second, contact share of the cycle, stride while planted
  function gaitOf(g) {
    const v = g.v, wB = g.wB, wS = g.wS;
    let cad = 1.5 + 0.38 * v - 0.0095 * v * v; // ~1.9 steps/s walking, 2.6 jogging, 4 at a sprint
    cad *= (1 + 0.5 * wB + 0.3 * wS) * (1 + 0.22 * g.line) * (1 + 0.35 * g.brake + 0.22 * g.drive + 0.25 * g.sink);
    g.T = 2 / Math.max(1.2, cad);
    const dPref = clamp(0.62 - 0.045 * v, 0.36, 0.62) + 0.06 * (wB + wS);
    const sxM = Math.max(0.36, (0.8 - 0.2 * wB - 0.36 * wS) * (1 - 0.32 * g.line) * (1 - 0.3 * g.sink));
    g.Sx = Math.min(sxM, v * dPref * g.T);
    g.D = v > 0.05 ? clamp(g.Sx / (v * g.T), 0.12, 0.75) : dPref;
    // how high the foot comes up in the swing: a shuffle and a backpedal skim the turf, a sprinter's heel nearly reaches his seat
    g.lift = (Math.max(0.12, clamp(0.06 + 0.07 * v, 0.06, 0.58) * (1 - 0.6 * wB - 0.55 * wS) * (1 - 0.4 * g.line)) + 0.12 * g.drive) * clamp(v / 1.2, 0, 1);
    return g;
  }
  // one foot at cycle position u (0 = touchdown): fills F = [along-stride offset, ankle height, foot pitch]
  const F = [0, 0, 0, 0]; // + planted flag
  // ankle height that puts the lower of heel and toe on the turf for a foot pitched by th (+ = toes down)
  const gAnk = (th) => { const c = Math.cos(th), s = Math.sin(th); return Math.max(0.06 * c - 0.08 * s, 0.04 * c + 0.2 * s); };
  function footAt(g, u) {
    const D = g.D, Sx = g.Sx, kR = g.kR, c = -0.07 * kR * (1 - g.wB - g.wS);
    // tb: up on the balls of the feet (a backpedal, a shuffle, a lineman's chop); td: the foot's angle as it lands (heel first
    // walking, the ball of the foot sprinting); late in the stance the heel peels up and the foot rolls over the toes
    const tb = 0.3 * clamp(g.wB + 0.7 * g.wS + 0.5 * g.line, 0, 1), tE = tb + 0.65 * kR, td = (0.12 * kR - 0.2 * (1 - kR)) * (1 - g.wB - g.wS) + tb;
    F[3] = u < D ? 1 : 0;
    if (u < D) { // planted: moves back at ground speed (+ the ankle's shift as the foot rolls over the toes)
      const s = u / D, th = s < 0.2 ? lerp(td, tb, s / 0.2) : tb + 0.65 * kR * sq(clamp((s - 0.62) / 0.38, 0, 1));
      F[0] = c + Sx * (0.5 - s) + (th > tb ? 0.2 - 0.2 * Math.cos(th) + 0.04 * Math.sin(th) - (0.2 - 0.2 * Math.cos(tb) + 0.04 * Math.sin(tb)) : 0); F[1] = gAnk(th); F[2] = th;
    } else { // swing: toe-off, heel kicks up behind (higher the faster), the knee drives through, the foot reaches and paws down
      const s = (u - D) / (1 - D), e = 1 - 0.12 * kR, lift = Math.sin(Math.PI * Math.pow(s, e)), rl = 0.2 - 0.2 * Math.cos(tE) + 0.04 * Math.sin(tE) - (0.2 - 0.2 * Math.cos(tb) + 0.04 * Math.sin(tb));
      F[0] = c - Sx * 0.5 + rl * (1 - smo(Math.min(1, s * 3))) + Sx * (s - Math.sin(TAU * s) / TAU) - 0.42 * kR * Math.sin(Math.PI * s) * sq(1 - s) + 0.2 * kR * bump(s, 0.45, 1); // trail leg stays long behind, lead leg reaches then claws back
      const p1 = 0.5 * kR + 0.05 + tb;
      F[2] = s < 0.35 ? lerp(tE, p1, s / 0.35) : lerp(p1, td, smo((s - 0.35) / 0.65)); F[1] = gAnk(F[2]) + g.lift * lift; // toes always clear the turf
    }
    return F;
  }
  // g: v (leg-units speed), uf/ul (move direction in the body frame), wB/wS (backpedal/shuffle share), kR (run effort 0 walk..1
  // sprint), line (lineman chop), brake/drive/sink (0..1), leanF, bank, twist (heading rate), ph (cycle phase), yaw (extra body
  // turn: spins); writes a full pose into q
  function clipLoco(q, g) {
    q.fill(0);
    const kR = g.kR, wB = g.wB, wS = g.wS, wF = Math.max(0, 1 - wB - wS), lo = wB * (1 - 0.65 * (g.up || 0)), u0 = (g.ph / TAU) % 1, uL = u0 < 0 ? u0 + 1 : u0, uR = (uL + 0.5) % 1; // lo: how low the backpedal sits (a quarterback's drop stays tall)
    // pelvis: forward tilt (more with effort, the burst and a low backpedal), turned with the stepping leg, a slight bob
    const A = 0.035 * clamp((g.v - 2.2) / 4, 0, 1) - 0.014 * clamp((2.5 - g.v) / 1.5, 0, 1);
    const bob = -A * Math.cos(2 * TAU * (uL - g.D / 2));
    const rootY = -0.02 - 0.035 * kR - 0.17 * lo - 0.2 * wS - 0.1 * g.line - 0.14 * g.sink - 0.05 * g.drive - 0.04 * g.brake + bob;
    const pitch = 0.05 + 0.13 * kR + 0.2 * lo + 0.14 * wS + g.leanF + 0.18 * g.drive + 0.12 * g.sink - 0.08 * g.brake;
    const pyaw = 0.13 * kR * wF * Math.cos(TAU * uL) + clamp(g.twist * 0.05, -0.3, 0.3);
    const yaw = pyaw + (g.yaw || 0), roll = clamp(g.bank + (g.bankX || 0), -0.42, 0.42);
    q[PN] = rootY; q[PN + 1] = pitch; q[PN + 2] = roll; q[PN + 3] = yaw;
    // feet in the ground frame under the hips (x = right, z = forward), then into the pelvis frame for the IK
    const H = HIP_H + rootY, W = 0.115 - 0.04 * kR + 0.16 * wS + 0.05 * wB + 0.07 * g.line + 0.08 * g.sink, bx = H * Math.sin(roll) * 0.9;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    for (let i = 0; i < 2; i++) {
      // stride along the move direction (the ground frame ignores the body's extra turn, so a spinning runner's feet stay on his
      // path); a hard plant pushes the outside foot wide
      const side = i ? 1 : -1, f = footAt(g, i ? uR : uL);
      let x = side * W + g.ul * f[0] + bx + (side === g.wideS ? g.wide : 0), y = f[1] - H, z = g.uf * f[0];
      { const tx = x * cy - z * sy; z = x * sy + z * cy; x = tx; } // undo the yaw
      { const ty = y * cp + z * sp; z = -y * sp + z * cp; y = ty; } // undo the pitch
      { const tx = x * cr + y * sr; y = -x * sr + y * cr; x = tx; } // undo the roll
      legSolve(q, side, x - side * 0.15, y + 0.03, z, f[2], pitch); if (i) g.cR = f[3]; else g.cL = f[3];
    }
    // arms: elbows near 90 degrees, hands hip to chin, opposite to the legs; a backpedal pumps short, a shuffle keeps them out
    // in front ready to punch; linemen keep their hands up
    const As = (0.18 + 0.62 * kR + 0.25 * g.drive) * (wF + 0.45 * wB) * (1 - 0.45 * g.line), sw = Math.cos(TAU * (uL - 0.4));
    const rdy = clamp(wS + 0.6 * g.line + 0.5 * g.sink, 0, 1);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, a = -side * As * sw, s3 = (side < 0 ? B.shL : B.shR) * 3, e3 = (side < 0 ? B.elL : B.elR) * 3, h3 = (side < 0 ? B.haL : B.haR) * 3;
      const shx = lerp(0.12 + 0.12 * kR + 0.15 * wB + a, 0.55, rdy), elb = lerp(1.3 + 0.15 * kR + 0.35 * Math.max(0, a) - 0.12 * Math.max(0, -a), 1.5, rdy);
      q[s3] = -shx; q[s3 + 1] = 0; q[s3 + 2] = side * (0.13 + 0.05 * kR + 0.12 * rdy); q[e3] = -elb; q[h3] = -0.2;
    }
    // trunk: forward with effort, chest counter-turns the hips, head stays level and looks where he's going
    q[B.spine * 3] = 0.05 + 0.1 * kR + 0.12 * lo + 0.06 * wS + 0.35 * g.leanF + 0.1 * g.drive + 0.05 * g.sink;
    q[B.chest * 3] = 0.02; q[B.chest * 3 + 1] = -1.25 * pyaw - clamp(g.twist * 0.03, -0.2, 0.2);
    q[B.neck * 3] = -0.85 * (pitch + q[B.spine * 3] + 0.02); q[B.neck * 3 + 1] = 0.5 * pyaw; q[B.neck * 3 + 2] = -0.5 * roll; q[B.head * 3] = -0.05;
    return q;
  }
  // two-point stance (receivers, backs, defensive backs): staggered feet, slight crouch, arms loose, one hand up
  const POSE_STANCE2 = gfit(pb({ hipL: [0.62, 0, -0.08], knL: [-0.75], ftL: [0.05], hipR: [0.2, 0, 0.1], knR: [-0.6], ftR: [0.35], shL: [0.42, 0, -0.18], elL: [0.75], haL: [0.2], shR: [0.75, 0, 0.12], elR: [1.5], haR: [0.3], spine: [0.42, 0, 0], chest: [0.05, 0, 0], neck: [-0.55, 0, 0], head: [-0.18, 0, 0] }, -0.23, 0.12, 0));
  // three-point stance (linemen): hips up, back flat, right hand on the ground, left forearm on the thigh, head up
  const POSE_STANCE3 = gfit(pb({ hipL: [1.4, 0, -0.14], knL: [-1.75], ftL: [0.0], hipR: [0.95, 0, 0.16], knR: [-1.6], ftR: [0.6], shL: [0.95, 0, -0.28], elL: [1.6], haL: [0.3], shR: [2.05, 0, 0.1], elR: [0.05], haR: [-0.3], spine: [0.8, 0, 0], chest: [0.25, 0, 0], neck: [-1.1, 0, 0], head: [-0.35, 0, 0] }, 0, 0.75, 0.04));
  // catching his breath between plays: bent at the hips, hands on the knees (placed by arm IK), head up
  const POSE_HK = gfit(pb({ hipL: [0.55, 0, -0.1], hipR: [0.5, 0, 0.12], knL: [-0.45], knR: [-0.4], ftL: [0.0], ftR: [0.0], shL: [0.9, 0, -0.2], shR: [0.9, 0, 0.2], elL: [0.3], elR: [0.3], spine: [0.5, 0, 0], chest: [0.15, 0, 0], neck: [-0.75, 0, 0], head: [-0.2, 0, 0] }, 0, 0.32, 0));
  const POSE_IDLE = gfit(pb({ hipL: [0.04, 0, -0.07], hipR: [0.04, 0, 0.07], knL: [-0.12], knR: [-0.12], shL: [0.1, 0, -0.2], shR: [0.1, 0, 0.2], elL: [0.4], elR: [0.4], haL: [0.15], haR: [0.15], spine: [0.06, 0, 0], neck: [-0.08, 0, 0] }, -0.02, 0.02, 0));
  const POSE_KNEEL = gfit(pb({ hipL: [1.35, 0, -0.12], knL: [-2.05], ftL: [0.5], hipR: [0.45, 0, 0.18], knR: [-1.35], ftR: [1.1], shL: [0.9, 0, -0.3], shR: [0.6, 0, 0.3], elL: [0.8], elR: [1.2], spine: [0.2, 0, 0], neck: [-0.15, 0, 0] }, -0.5, 0.05, 0));
  const POSE_HOLD = gfit(pb({ hipL: [0.75, 0, -0.1], knL: [-1.2], hipR: [1.3, 0, 0.3], knR: [-2.1], ftR: [1.0], shL: [1.1, 0, -0.3], shR: [1.1, 0, 0.3], elL: [0.4], elR: [0.4], spine: [0.55, 0, 0], neck: [-0.4, 0, 0] }, -0.54, 0.2, 0));
  // shotgun quarterback: knees bent, hands out at the waist, a single clap at t ~ 0.9 s
  function clipQB(t) {
    const cl = t > 0.7 && t < 1.25 ? Math.sin(Math.PI * (t - 0.7) / 0.55) : 0; // 0..1..0 hands together
    return gfit(pb({ hipL: [0.32, 0, -0.12], hipR: [0.32, 0, 0.12], knL: [-0.5], knR: [-0.5], shL: [0.55 + 0.15 * cl, 0, -0.32 + 0.3 * cl], shR: [0.55 + 0.15 * cl, 0, 0.32 - 0.3 * cl], elL: [1.35 - 0.1 * cl], elR: [1.35 - 0.1 * cl], haL: [0.4], haR: [0.4], spine: [0.26, 0, 0], chest: [0.04, 0, 0], neck: [-0.38, 0, 0], head: [-0.1, 0, 0] }, 0, 0.08, 0));
  }
  // ---------- throwing (right-handed) ----------
  // the ball leaves his hand THROW_REL seconds into the motion: 40-ball releases it then, and every throw clip has its release key there
  const THROW_REL = 0.2;
  // keys are in seconds. Set feet: load (ball by the ear, front shoulder at the target), stride, hips open, then the chest,
  // the elbow leads, the arm whips over the top and the ball comes out at THROW_REL; the arm finishes across to the far hip
  // and the back leg swings through
  const THR_SET = [
    [0, gfit(pb({ shR: [1.25, 0.2, 1.05], elR: [2.15], haR: [0.2], shL: [1.05, 0, -0.1], elL: [1.95], haL: [0.2], chest: [-0.02, 0.55, 0], spine: [0.08, 0.2, 0], neck: [-0.15, -0.7, 0], head: [-0.05, -0.15, 0], hipL: [0.35, 0.2, -0.12], hipR: [0.05, 0.1, 0.16], knL: [-0.45], knR: [-0.55] }, -0.05, 0.04, 0, 0.3))],
    [0.08, gfit(pb({ shR: [1.95, 0.3, 1.45], elR: [2.1], haR: [0.15], shL: [1.55, 0, -0.25], elL: [0.75], haL: [0.1], chest: [-0.1, 0.95, 0.04], spine: [-0.06, 0.3, 0], neck: [-0.1, -1.05, 0], head: [0, -0.2, 0], hipL: [0.85, 0.25, -0.1], hipR: [-0.12, 0.1, 0.18], knL: [-0.75], knR: [-0.6], ftL: [0.25] }, -0.1, -0.06, 0.05, 0.45))],
    [0.14, gfit(pb({ shR: [2.05, 0.4, 1.35], elR: [2.15], haR: [0.0], shL: [1.0, 0, -0.55], elL: [1.3], haL: [0.2], chest: [-0.12, 0.8, 0.05], spine: [-0.02, 0.15, 0], neck: [-0.15, -0.85, 0], head: [0, -0.2, 0], hipL: [0.6, 0.1, -0.1], hipR: [-0.35, 0, 0.2], knL: [-0.3], knR: [-0.55], ftR: [0.3] }, -0.12, 0.0, 0.06, 0.15))],
    [THROW_REL, gfit(pb({ shR: [2.95, 0.1, 0.35], elR: [0.35], haR: [0.55], shL: [0.4, 0, -0.75], elL: [1.65], haL: [0.2], chest: [0.1, -0.25, -0.04], spine: [0.14, -0.12, 0], neck: [-0.3, 0.2, 0], head: [-0.05, 0.1, 0], hipL: [0.45, 0, -0.1], hipR: [-0.55, 0, 0.2], knL: [-0.3], knR: [-0.35], ftR: [0.75] }, -0.14, 0.08, 0.05, -0.08))],
    [0.32, gfit(pb({ shR: [1.15, 0.1, -0.4], elR: [0.45], haR: [0.75], shL: [0.15, 0, -0.55], elL: [1.3], chest: [0.15, -0.75, -0.06], spine: [0.42, -0.25, 0], neck: [-0.4, 0.55, 0], head: [-0.05, 0.15, 0], hipL: [0.4, 0, -0.1], hipR: [0.15, 0, 0.12], knL: [-0.45], knR: [-1.0], ftR: [0.55] }, -0.16, 0.24, 0.08, -0.2))],
    [0.56, gfit(pb({ shR: [0.45, 0, 0.15], elR: [1.0], haR: [0.3], shL: [0.25, 0, -0.35], elL: [1.0], chest: [0.06, -0.3, 0], spine: [0.24, -0.08, 0], neck: [-0.28, 0.25, 0], hipL: [0.3, 0, -0.1], hipR: [0.05, 0, 0.14], knL: [-0.45], knR: [-0.5] }, -0.1, 0.1, 0.03, -0.08))],
  ];
  // the quick flick with a man in his face: no stride, a short arm from the ear, the same release beat, a short finish
  const THR_QUICK = [
    [0, gfit(pb({ shR: [1.5, 0.25, 1.15], elR: [2.25], haR: [0.2], shL: [1.1, 0, -0.15], elL: [1.85], chest: [-0.04, 0.5, 0], spine: [0.15, 0.15, 0], neck: [-0.2, -0.6, 0], hipL: [0.42, 0, -0.18], hipR: [0.32, 0, 0.18], knL: [-0.7], knR: [-0.7] }, -0.12, 0.1, 0, 0.2))],
    [0.11, gfit(pb({ shR: [1.85, 0.35, 1.25], elR: [2.25], haR: [0.0], shL: [0.9, 0, -0.45], elL: [1.4], chest: [-0.06, 0.62, 0.03], spine: [0.1, 0.18, 0], neck: [-0.2, -0.7, 0], hipL: [0.45, 0, -0.18], hipR: [0.3, 0, 0.18], knL: [-0.72], knR: [-0.7] }, -0.13, 0.08, 0.03, 0.22))],
    [THROW_REL, gfit(pb({ shR: [2.7, 0.15, 0.45], elR: [0.5], haR: [0.6], shL: [0.55, 0, -0.65], elL: [1.6], chest: [0.1, -0.1, -0.03], spine: [0.22, -0.05, 0], neck: [-0.3, 0.05, 0], hipL: [0.45, 0, -0.18], hipR: [0.25, 0, 0.18], knL: [-0.7], knR: [-0.62] }, -0.13, 0.14, 0.02, 0.02))],
    [0.3, gfit(pb({ shR: [1.35, 0.1, -0.15], elR: [0.7], haR: [0.7], shL: [0.4, 0, -0.5], elL: [1.3], chest: [0.12, -0.45, -0.04], spine: [0.3, -0.12, 0], neck: [-0.32, 0.3, 0], hipL: [0.42, 0, -0.18], hipR: [0.3, 0, 0.18], knL: [-0.66], knR: [-0.64] }, -0.12, 0.16, 0.03, -0.05))],
    [0.42, gfit(pb({ shR: [0.7, 0, 0.2], elR: [1.2], shL: [0.5, 0, -0.35], elL: [1.3], chest: [0.05, -0.2, 0], spine: [0.22, 0, 0], neck: [-0.3, 0.1, 0], hipL: [0.38, 0, -0.16], hipR: [0.32, 0, 0.16], knL: [-0.6], knR: [-0.6] }, -0.1, 0.1, 0, 0))],
  ];
  // the lob: he sits back, the arm comes through high and finishes up and out rather than across
  const THR_LOB = [
    THR_SET[0], THR_SET[1],
    [0.14, gfit(pb({ shR: [2.0, 0.4, 1.35], elR: [2.25], haR: [-0.1], shL: [1.2, 0, -0.45], elL: [1.1], chest: [-0.2, 0.8, 0.05], spine: [-0.12, 0.15, 0], neck: [-0.05, -0.85, 0], head: [0.05, -0.2, 0], hipL: [0.6, 0.1, -0.1], hipR: [-0.3, 0, 0.2], knL: [-0.3], knR: [-0.65], ftR: [0.3] }, -0.13, -0.08, 0.06, 0.15))],
    [THROW_REL, gfit(pb({ shR: [2.95, 0.05, 0.25], elR: [0.15], haR: [0.4], shL: [0.6, 0, -0.75], elL: [1.5], chest: [-0.05, -0.15, -0.03], spine: [0.0, -0.08, 0], neck: [-0.05, 0.15, 0], head: [0.1, 0.05, 0], hipL: [0.4, 0, -0.1], hipR: [-0.45, 0, 0.2], knL: [-0.25], knR: [-0.35], ftR: [0.6] }, -0.12, -0.02, 0.04, -0.06))],
    [0.34, gfit(pb({ shR: [2.0, 0.05, 0.1], elR: [0.3], haR: [0.6], shL: [0.3, 0, -0.55], elL: [1.2], chest: [0.05, -0.5, -0.04], spine: [0.2, -0.15, 0], neck: [-0.15, 0.4, 0], hipL: [0.35, 0, -0.1], hipR: [0.0, 0, 0.12], knL: [-0.4], knR: [-0.7], ftR: [0.5] }, -0.12, 0.08, 0.05, -0.15))],
    THR_SET[5],
  ];
  // keyed in seconds (kf takes the first key's time as its start)
  const THROWS = { set: THR_SET, quick: THR_QUICK, lob: THR_LOB };
  function clipThrow(ts, kind) { return kf(ts, THROWS[kind] || THR_SET); }
  // throwing on the run: the legs keep running where he is going, the hips stay with the legs and the chest turns back to the target
  function clipThrowRun(ts, ph, k, off) {
    const up = kf(ts, THR_QUICK), q = clipRun(ph, k), o = lerpPose(q, q, 0);
    for (const b of UPPER) { const i = B[b] * 3; o[i] = up[i]; o[i + 1] = up[i + 1]; o[i + 2] = up[i + 2]; }
    const tw = clamp(off, -1.3, 1.3); o[PN + 3] += tw; o[B.spine * 3 + 1] -= tw * 0.45; o[B.chest * 3 + 1] -= tw * 0.45; o[B.neck * 3 + 1] -= tw * 0.1;
    o[B.spine * 3] += up[B.spine * 3] * 0.5; o[PN + 1] += 0.04;
    return o;
  }
  const UPPER = ['chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR'];
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
  function clipHurdle(t) { // leap a low tackler: plant and drive up, both knees tucked high at the top, legs reach down to land running
    return kf(t, [
      [0, gfit(pb({ hipL: [0.75, 0, -0.1], hipR: [-0.1, 0, 0.1], knL: [-1.1], knR: [-0.55], ftL: [0.1], ftR: [0.4], shL: [-0.6, 0, -0.3], shR: [1.0, 0, 0.3], elL: [0.9], elR: [1.1], spine: [0.45, 0, 0], neck: [-0.35, 0, 0] }, -0.2, 0.12, 0))],
      [0.16, pb({ hipL: [1.75, 0, -0.12], hipR: [0.1, 0, 0.12], knL: [-1.5], knR: [-0.35], ftL: [0.4], ftR: [0.7], shL: [-0.2, 0, -0.55], shR: [1.6, 0, 0.45], elL: [0.8], elR: [0.7], spine: [0.42, 0, 0], neck: [-0.4, 0, 0] }, 0, 0.1, 0)],
      [0.34, pb({ hipL: [2.0, 0, -0.16], hipR: [1.55, 0, 0.16], knL: [-1.75], knR: [-2.1], ftL: [0.45], ftR: [0.55], shL: [0.7, 0, -0.85], shR: [1.1, 0, 0.75], elL: [0.6], elR: [0.6], spine: [0.5, 0, 0], neck: [-0.45, 0, 0], head: [-0.1, 0, 0] }, 0.02, 0.12, 0)],
      [0.6, pb({ hipL: [1.9, 0, -0.16], hipR: [1.5, 0, 0.16], knL: [-1.6], knR: [-2.05], ftL: [0.4], ftR: [0.5], shL: [0.6, 0, -0.8], shR: [1.0, 0, 0.7], elL: [0.7], elR: [0.7], spine: [0.45, 0, 0], neck: [-0.45, 0, 0] }, 0.02, 0.1, 0)],
      [0.82, pb({ hipL: [0.95, 0, -0.1], hipR: [0.55, 0, 0.1], knL: [-0.45], knR: [-0.9], ftL: [0.0], ftR: [0.2], shL: [0.4, 0, -0.55], shR: [0.6, 0, 0.5], elL: [0.9], elR: [0.9], spine: [0.32, 0, 0], neck: [-0.3, 0, 0] }, -0.02, 0.08, 0)],
      [1, gfit(pb({ hipL: [0.75, 0, -0.1], hipR: [0.35, 0, 0.1], knL: [-1.1], knR: [-0.8], shL: [0.4, 0, -0.4], shR: [-0.1, 0, 0.4], elL: [1.1], elR: [1.1], spine: [0.4, 0, 0], neck: [-0.35, 0, 0] }, -0.24, 0.14, 0))],
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
  // Xavier's dance, motion-captured from his video: his body tracked in all 41 frames (30 per second, one 1.37 s loop), the camera
  // tilt taken out, the game's skeleton fitted to every frame (limb directions plus hand, elbow, knee and ankle positions, ankles held
  // together). Each joint's motion is then kept as two smooth waves over the loop (its sway plus the switch back), which keeps the
  // moves and drops the frame-to-frame jitter (it used to stutter as a hand crossed over). XAV_W: per joint [mean, [cos1, sin1], [cos2, sin2]].
  const XAV_P = ["rp", "rr", "ry", "spx", "spy", "spz", "nkx", "nky", "shLx", "shLy", "shLz", "elL", "shRx", "shRy", "shRz", "elR", "hipLx", "hipLy", "hipLz", "knL", "hipRx", "hipRy", "hipRz", "knR", "ftL", "ftR"], XAV_T = 41 / 30;
  const XAV_W = [[[-0.081,0],[-0.085,-0.024],[0.067,-0.079]],[[0.108,0],[-0.066,0.023],[0.039,-0.048]],[[-0.352,0],[-0.041,0.013],[0.036,-0.066]],[[0.164,0],[0.027,0.128],[-0.071,0.019]],[[0.494,0],[0.156,-0.036],[-0.145,0.167]],[[-0.059,0],[0.116,-0.09],[-0.097,0.113]],[[0.94,0],[0.085,-0.096],[-0.015,0.085]],[[0,0],[0,0],[0,0]],[[0.655,0],[-0.841,0.218],[0.458,-0.161]],[[-0.333,0],[0.761,0.088],[-0.374,-0.223]],[[-0.497,0],[1.03,-0.146],[-0.725,0.357]],[[-0.159,0],[0.474,-0.116],[-0.242,0.047]],[[0.05,0],[-0.48,0.006],[0.127,-0.577]],[[-0.912,0],[-0.128,0.05],[0.072,-0.09]],[[0.341,0],[0.581,0.026],[-0.165,0.654]],[[0.625,0],[0.234,-0.062],[-0.14,0.228]],[[0.265,0],[-0.082,-0.042],[0.081,-0.076]],[[0.22,0],[-0.197,0.058],[0.248,-0.35]],[[0.055,0],[0.028,0.005],[0.058,-0.027]],[[-0.724,0],[0.112,0.025],[-0.018,0.031]],[[0.306,0],[0.024,-0.082],[-0.109,0.189]],[[0.011,0],[-0.105,0.044],[0.18,-0.233]],[[-0.293,0],[0.071,0.01],[0.035,-0.006]],[[-0.793,0],[-0.083,0.091],[0.234,-0.338]],[[0.878,0],[0.044,0.034],[-0.11,0.235]],[[0.329,0],[-0.011,0.116],[0.014,0.069]]];
  const xavBuild = (v, adL, adR, rL, rR) => gfit(pb({ spine: [v.spx, v.spy, v.spz], neck: [v.nkx, v.nky, 0], shL: [v.shLx, v.shLy, v.shLz], elL: [v.elL], shR: [v.shRx, v.shRy, v.shRz], elR: [v.elR],
    hipL: [v.hipLx, v.hipLy + rL, v.hipLz + adL], knL: [v.knL], hipR: [v.hipRx, v.hipRy - rR, v.hipRz - adR], knR: [v.knR], ftL: [v.ftL], ftR: [v.ftR], haL: [0.3], haR: [0.3] }, 0, v.rp, v.rr, v.ry));
  const xavCache = { t: -1, q: null };
  function xavPose(t) {
    if (t === xavCache.t && xavCache.q) return lerpPose(xavCache.q, xavCache.q, 0);
    const ph = 2 * Math.PI * (t / XAV_T), v = {};
    XAV_P.forEach((k, j) => { const c = XAV_W[j]; let y = c[0][0]; for (let h = 1; h < c.length; h++) y += c[h][0] * Math.cos(h * ph) + c[h][1] * Math.sin(h * ph); v[k] = y; });
    v.ry -= -0.349; v.spy -= 0.349; v.rr -= 0.105; // he faces forward: the 20-degree turn of his whole body in the clip was the camera's angle (the twist stays)
    { const d = 0.28; v.hipLx += d; v.hipRx += d; v.knL -= 2 * d; v.knR -= 2 * d; v.ftL += d; v.ftR += d; }
    v.nkx = -0.12 + (v.nkx - 0.94) * 0.4; v.nky *= 0.5; // head up, eyes forward (the fit aimed his neck at his nose, tipping the head down 54 degrees), a little nod kept // bent down low (a deep knee bend, feet flat under him, chest a little forward)
    // his legs like in the video: ankles together (10-12 cm) and his shins about straight down to them, knees just apart (13 cm), never
    // knock-kneed: per frame, each hip is drawn in (adduction) and turned (rotation) until both gaps are right
    const gaps = (q) => { const b = fk(q, 0, 0, 0, 0, 1), L = b[B.ftL], R = b[B.ftR], KL = b[B.knL], KR = b[B.knR]; return [Math.hypot(L[3] - R[3], L[11] - R[11]), Math.hypot(KL[3] - KR[3], KL[11] - KR[11])]; };
    const err = (g) => (g[0] - 0.11) ** 2 + 0.6 * (g[1] - 0.14) ** 2;
    let a = 0.035, r = 0, q = xavBuild(v, a, a, r, r), g = gaps(q), e = err(g);
    for (let it = 0, st = 0.06; it < 8 && e > 1e-5; it++, st *= 0.7) {
      for (const [da, dr] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { const a2 = clamp(a + da, -0.3, 0.4), r2 = clamp(r + dr, -0.6, 0.6), q2 = xavBuild(v, a2, a2, r2, r2), g2 = gaps(q2), e2 = err(g2); if (e2 < e) { a = a2; r = r2; q = q2; g = g2; e = e2; } }
    }
    xavCache.t = t; xavCache.q = q;
    return lerpPose(q, q, 0);
  }

  function clipCeleb(k, t) {
    const w = Math.sin(t * 9), hop = Math.abs(Math.sin(t * 6.5));
    if (k === 1) return kf(Math.min(1, t / 0.9), [ // spike
      [0, gfit(pb({ shR: [2.9, 0, 0.35], elR: [0.2], shL: [0.4, 0, -0.5], elL: [0.9], spine: [-0.15, 0, 0], neck: [-0.4, 0, 0], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.4], knR: [-0.4] }, -0.08, -0.08, 0))],
      [0.4, gfit(pb({ shR: [-0.5, 0, 0.5], elR: [0.3], shL: [0.4, 0, -0.5], elL: [0.9], spine: [0.55, 0, 0], neck: [-0.1, 0, 0], hipL: [0.7, 0, -0.15], hipR: [0.7, 0, 0.15], knL: [-0.9], knR: [-0.9] }, -0.28, 0.28, 0))],
      [1, gfit(pb({ shR: [0.6, 0, 1.4], elR: [0.4], shL: [0.6, 0, -1.4], elL: [0.4], spine: [-0.1, 0, 0], neck: [-0.35, 0, 0], hipL: [0.15, 0, -0.25], hipR: [0.15, 0, 0.25], knL: [-0.3], knR: [-0.3] }, -0.05, -0.05, 0))],
    ]);
    if (k === 2) return gfit(pb({ shR: [0.3, 0, 2.95], elR: [0.1], shL: [0.9, 0, -0.5], elL: [1.9], spine: [-0.2, 0, 0.1], neck: [-0.7, 0, 0], head: [-0.3, 0, 0], hipL: [0.1, 0, -0.2], hipR: [0.1, 0, 0.2], knL: [-0.25], knR: [-0.25] }, 0, -0.1, 0.05));
    if (k === 6) return xavPose(t); // Xavier's dance: motion-captured from his own video (XAV_MC below)
    if (k === 4) { const s = Math.sin(t * 7.5), c = Math.cos(t * 7.5); return gfit(pb({ shR: [1.3 + 0.9 * s, 0, 0.9], elR: [1.3 + 0.6 * c], shL: [1.3 - 0.9 * s, 0, -0.9], elL: [1.3 - 0.6 * c], spine: [0.08, 0, 0.22 * s], neck: [-0.25, 0, -0.2 * s], hipL: [0.35 + 0.3 * s, 0, -0.2], hipR: [0.35 - 0.3 * s, 0, 0.2], knL: [-0.6 - 0.4 * s], knR: [-0.6 + 0.4 * s] }, 0, 0.05, 0.12 * s), 0.07 * Math.abs(c)); } // the dance
    if (k === 3) return gfit(pb({ shR: [0.4, 0, 1.7 + 0.1 * w], elR: [2.4], shL: [0.4, 0, -1.7 - 0.1 * w], elL: [2.4], spine: [0.2, 0, 0], neck: [-0.2, 0, 0], hipL: [0.5, 0, -0.3], hipR: [0.5, 0, 0.3], knL: [-0.7], knR: [-0.7] }, 0, 0.1, 0));
    return gfit(pb({ shR: [2.7 + 0.25 * w, 0, 0.5], elR: [0.35], shL: [2.7 - 0.25 * w, 0, -0.5], elL: [0.35], spine: [-0.1, 0, 0], neck: [-0.4, 0, 0], hipL: [0.3 - 0.2 * hop, 0, -0.15], hipR: [0.3 - 0.2 * hop, 0, 0.15], knL: [-0.5 + 0.3 * hop], knR: [-0.5 + 0.3 * hop] }, 0, -0.05, 0), 0.14 * hop);
  }
  // ---------- tackling: keyed in seconds; past the last key he stays wrapped up and churns his legs (25-animrt puts his hands on the man) ----------
  // form: sink the hips, eyes up, explode through with the arms shooting up and around, wrap and drive
  const TK_FORM = [
    [0, gfit(pb({ shL: [-0.35, 0, -0.35], shR: [-0.35, 0, 0.35], elL: [1.45], elR: [1.45], haL: [0.3], haR: [0.3], spine: [0.6, 0, 0], chest: [0.05, 0, 0], neck: [-0.7, 0, 0], head: [-0.25, 0, 0], hipL: [0.95, 0, -0.16], hipR: [0.55, 0, 0.16], knL: [-1.3], knR: [-1.0], ftL: [0.2], ftR: [0.3] }, -0.16, 0.28, 0))],
    [0.13, gfit(pb({ shL: [1.35, 0, -0.75], shR: [1.35, 0, 0.75], elL: [0.75], elR: [0.75], haL: [0.2], haR: [0.2], spine: [0.55, 0, 0], neck: [-0.8, 0, 0], head: [-0.25, 0, 0], hipL: [0.55, 0, -0.12], hipR: [-0.25, 0, 0.12], knL: [-0.7], knR: [-0.35], ftR: [0.6] }, -0.1, 0.48, 0))],
    [0.3, gfit(pb({ shL: [1.25, 0, 0.15], shR: [1.25, 0, -0.15], elL: [1.65], elR: [1.65], haL: [0.4], haR: [0.4], spine: [0.62, 0, 0], neck: [-0.75, 0, 0], head: [-0.2, 0, 0], hipL: [0.6, 0, -0.12], hipR: [0.1, 0, 0.12], knL: [-0.9], knR: [-0.6], ftR: [0.4] }, -0.12, 0.52, 0))],
  ];
  // the big shoulder: right shoulder leads, that arm tucked, the far arm swings through to wrap
  const TK_SHOULDER = [
    [0, gfit(pb({ shL: [0.3, 0, -0.5], shR: [-0.2, 0, 0.3], elL: [1.3], elR: [1.8], spine: [0.55, 0.2, 0.1], chest: [0, 0.25, 0], neck: [-0.7, -0.3, 0], head: [-0.2, 0, 0], hipL: [0.9, 0, -0.16], hipR: [0.4, 0, 0.16], knL: [-1.2], knR: [-0.9], ftR: [0.3] }, -0.15, 0.3, 0.05, 0.1))],
    [0.13, gfit(pb({ shL: [1.5, 0, -0.6], shR: [0.6, 0, 0.35], elL: [0.9], elR: [2.0], spine: [0.6, -0.25, 0.1], chest: [0.05, -0.4, 0.1], neck: [-0.85, 0.35, 0], head: [-0.2, 0, 0], hipL: [0.4, 0, -0.12], hipR: [-0.3, 0, 0.12], knL: [-0.6], knR: [-0.3], ftR: [0.6] }, -0.1, 0.55, 0.15, -0.15))],
    [0.3, TK_FORM[2][1]],
  ];
  // diving / shoestring from behind or the side: he launches, lays out flat and reaches for the ankles
  const TK_DIVE = [
    [0, gfit(pb({ shL: [0.6, 0, -0.4], shR: [0.6, 0, 0.4], elL: [0.9], elR: [0.9], spine: [0.55, 0, 0], neck: [-0.7, 0, 0], hipL: [0.9, 0, -0.14], hipR: [0.3, 0, 0.14], knL: [-1.2], knR: [-0.6], ftR: [0.4] }, -0.2, 0.4, 0))],
    [0.14, pb({ shL: [2.6, 0, -0.25], shR: [2.6, 0, 0.25], elL: [0.2], elR: [0.2], spine: [0.1, 0, 0], neck: [-0.9, 0, 0], head: [-0.3, 0, 0], hipL: [-0.15, 0, -0.1], hipR: [-0.3, 0, 0.1], knL: [-0.3], knR: [-0.2], ftL: [0.6], ftR: [0.6] }, -0.3, 1.15, 0)],
    [0.32, pb({ shL: [2.75, 0, -0.3], shR: [2.75, 0, 0.3], elL: [0.15], elR: [0.15], spine: [0.0, 0, 0], neck: [-0.95, 0, 0], head: [-0.3, 0, 0], hipL: [-0.2, 0, -0.12], hipR: [-0.15, 0, 0.12], knL: [-0.35], knR: [-0.3], ftL: [0.6], ftR: [0.6] }, -0.5, 1.3, 0)],
  ];
  const TACKLES = { form: TK_FORM, shoulder: TK_SHOULDER, dive: TK_DIVE };
  function clipTackle(ts, ph, kind) {
    const keys = TACKLES[kind] || TK_FORM, q = kf(ts, keys);
    if (kind !== 'dive' && ts > 0.2) { const s = Math.sin(ph) * Math.min(1, (ts - 0.2) * 6); q[B.hipL * 3] -= 0.3 * s; q[B.hipR * 3] += 0.3 * s; q[B.knL * 3] += 0.25 * Math.max(0, s); q[B.knR * 3] += 0.25 * Math.max(0, -s); } // legs keep driving (raw knee: positive bends)
    return q;
  }
  // blocking. Pass set (st = 1): sit in the stance, wide base, hands cocked at the chest, short sets of the feet. Run block (st = 0):
  // low pad level, hands out, driving the legs; drive leans him in. Engaged, 25-animrt puts the hands on the man's chest.
  function clipBlock(ph, drive, st) {
    const s = Math.sin(ph), a = Math.max(0, s), b = Math.max(0, -s), r = 1 - st, sh = 0.9 + 0.35 * r + drive * 0.15, el = 1.85 - 0.5 * r - drive * 0.2;
    return gfit(pb({ shL: [sh, 0, -0.2 - 0.1 * st], shR: [sh, 0, 0.2 + 0.1 * st], elL: [el], elR: [el], haL: [0.7], haR: [0.7],
      spine: [0.2 + 0.25 * r + drive * 0.2, 0, 0], chest: [0.04, 0, 0], neck: [-0.4 - 0.25 * r - drive * 0.15, 0, 0], head: [-0.12, 0, 0],
      hipL: [0.6 + (0.14 + 0.12 * r) * s, 0, -0.22 - 0.12 * st], hipR: [0.6 - (0.14 + 0.12 * r) * s, 0, 0.22 + 0.12 * st], knL: [-1.0 - 0.22 * a], knR: [-1.0 - 0.22 * b], ftL: [0.15], ftR: [0.15] }, 0, 0.06 + 0.2 * r + drive * 0.2, 0));
  }
  // pass rush, low and leaning in. sw / rp / bu: how far into a swim, a rip or a bull rush (0 = hand fighting); sd: the side he is
  // beating the man to (+1 his right).
  // The hands are put on the blocker by 25-animrt; this sets the body: a swim turns the chest and rises over, a rip dips the shoulder.
  function clipRush(ph, drive, sw, rp, bu, sd) {
    const s = Math.sin(ph), c = Math.cos(ph), k = sd || 1; sw = sw || 0; rp = rp || 0; bu = bu || 0;
    return gfit(pb({ shL: [1.15 + 0.3 * s, 0.2 * c, -0.45 + 0.3 * c], shR: [1.15 - 0.3 * s, -0.2 * c, 0.45 - 0.3 * c], elL: [1.1 + 0.3 * Math.max(0, s)], elR: [1.1 + 0.3 * Math.max(0, -s)], haL: [0.4], haR: [0.4],
      spine: [0.42 + drive * 0.2 + 0.15 * bu - 0.1 * sw, 0.12 * s * (1 - sw - rp), 0], chest: [0, 0.18 * s * (1 - sw - rp) - k * (0.45 * sw - 0.25 * rp), 0], neck: [-0.6 - drive * 0.15 - 0.15 * bu, -0.1 * s + k * 0.3 * sw, 0], head: [-0.15, 0, 0],
      hipL: [0.5 - 0.22 * s, 0, -0.18], hipR: [0.5 + 0.22 * s, 0, 0.18], knL: [-0.85 - 0.15 * bu], knR: [-0.85 - 0.15 * bu], ftL: [0.1], ftR: [0.1] }, 0, 0.2 + drive * 0.2 + 0.12 * bu - 0.06 * sw, 0.03 * s + k * (0.16 * rp - 0.06 * sw), k * 0.25 * (sw + rp)));
  }
  // ---------- hands: catching, securing the ball and swatting it, laid over the upper body of whatever the legs are doing ----------
  // keys on 0..1 of HANDS_D; the ball sits between the hands until `tuck`, then goes into the right arm (mirrored for a left-arm carry)
  const HP = (o, sp, nk) => pb(Object.assign({ spine: [sp || 0.12, 0, 0], neck: [nk == null ? -0.2 : nk, 0, 0] }, o));
  const H_TUCK = HP({ shR: [0.25, 0, 0.25], elR: [2.15], haR: [0.3], shL: [0.45, 0, -0.25], elL: [1.45], haL: [0.2] }, 0.15, -0.2);
  const HANDS = {
    chest: [[0, HP({ shL: [1.1, 0, 0.22], elL: [0.65], haL: [-0.2], shR: [1.1, 0, -0.22], elR: [0.65], haR: [-0.2] }, 0.1, -0.15)], [0.3, HP({ shL: [0.85, 0, 0.42], elL: [1.95], shR: [0.85, 0, -0.42], elR: [1.95] }, 0.24, -0.32)], [0.62, H_TUCK]],
    high: [[0, HP({ shL: [2.9, 0, 0.15], elL: [0.15], haL: [-0.2], shR: [2.9, 0, -0.15], elR: [0.15], haR: [-0.2], head: [-0.2, 0, 0] }, -0.12, -0.55)], [0.28, HP({ shL: [1.9, 0, 0.35], elL: [1.7], shR: [1.9, 0, -0.35], elR: [1.7] }, 0.05, -0.35)], [0.52, HP({ shL: [0.9, 0, 0.42], elL: [2.0], shR: [0.9, 0, -0.42], elR: [2.0] }, 0.28, -0.25)], [0.8, H_TUCK]],
    low: [[0, HP({ shL: [0.65, 0, 0.25], elL: [0.3], haL: [0.45], shR: [0.65, 0, -0.25], elR: [0.3], haR: [0.45] }, 0.6, -0.65)], [0.35, HP({ shL: [0.55, 0, 0.42], elL: [1.75], shR: [0.55, 0, -0.42], elR: [1.75] }, 0.35, -0.45)], [0.68, H_TUCK]],
    basket: [[0, HP({ shL: [0.75, 0, 0.05], elL: [1.3], haL: [0.35], shR: [0.75, 0, -0.05], elR: [1.3], haR: [0.35] }, 0.04, -0.45)], [0.32, HP({ shL: [0.7, 0, 0.42], elL: [2.0], shR: [0.7, 0, -0.42], elR: [2.0] }, 0.2, -0.3)], [0.64, H_TUCK]],
    dive: [[0, HP({ shL: [3.0, 0, 0.15], elL: [0.1], shR: [3.0, 0, -0.15], elR: [0.1] }, 0, -0.8)], [0.45, HP({ shL: [1.7, 0, 0.4], elL: [1.95], shR: [1.7, 0, -0.4], elR: [1.95] }, 0.1, -0.6)], [1, HP({ shL: [1.6, 0, 0.42], elL: [2.0], shR: [1.6, 0, -0.42], elR: [2.0] }, 0.15, -0.55)]],
    onehand: [[0, HP({ shR: [2.35, 0, 0.85], elR: [0.1], haR: [0.3], shL: [0.7, 0, -0.85], elL: [0.8], chest: [0, -0.3, 0] }, 0.08, -0.3)], [0.3, HP({ shR: [1.2, 0, 0.1], elR: [1.95], shL: [0.95, 0, 0.35], elL: [1.9], chest: [0, -0.1, 0] }, 0.2, -0.3)], [0.62, H_TUCK]],
    swat: [[0, HP({ shR: [2.95, 0, 0.3], elR: [0.2], shL: [1.0, 0, -0.5], elL: [1.0], chest: [0, 0.25, 0] }, -0.05, -0.5)], [0.26, HP({ shR: [1.0, 0, -0.45], elR: [0.2], shL: [0.6, 0, -0.5], elL: [1.1], chest: [0, -0.5, 0] }, 0.35, -0.3)], [0.62, HP({ shR: [0.45, 0, -0.3], elR: [0.6], shL: [0.4, 0, -0.4], elL: [1.1], chest: [0, -0.3, 0] }, 0.25, -0.25)], [1, HP({ shR: [0.3, 0, 0.2], elR: [1.0], shL: [0.3, 0, -0.2], elL: [1.0] }, 0.15, -0.2)]],
    swatlo: [[0, HP({ shR: [1.9, 0, 0.6], elR: [0.3], shL: [0.9, 0, -0.5], elL: [1.0], chest: [0, 0.3, 0] }, 0.2, -0.35)]],
  };
  HANDS.body = [[0, HANDS.chest[1][1]], [0.35, HANDS.chest[1][1]], [0.62, H_TUCK]]; // trapped against the body
  HANDS.drop = [[0, HANDS.chest[0][1]], [0.3, HP({ shL: [0.75, 0, -0.55], elL: [0.55], haL: [0.4], shR: [0.75, 0, 0.55], elR: [0.55], haR: [0.4] }, 0.22, -0.45)], [1, HP({ shL: [0.3, 0, -0.25], elL: [0.9], shR: [0.3, 0, 0.25], elR: [0.9] }, 0.12, -0.3)]]; // it went off his hands
  HANDS.swatlo = [HANDS.swatlo[0], ...HANDS.swat.slice(1)];
  const HANDS_D = { chest: 0.55, high: 0.62, low: 0.55, basket: 0.6, dive: 0.5, onehand: 0.55, body: 0.45, swat: 0.5, swatlo: 0.5, drop: 0.5 };
  const HANDS_TUCK = { chest: 0.5, high: 0.62, low: 0.55, basket: 0.52, dive: 9, onehand: 0.5, body: 0.5 }; // where the ball starts into the tuck
  function clipKick(t) {
    return kf(t, [
      [0, gfit(pb({ hipL: [0.25, 0, -0.1], knL: [-0.25], hipR: [-0.95, 0, 0.1], knR: [-1.35], shL: [0.3, 0, -1.3], shR: [-0.6, 0, 0.5], elL: [0.5], elR: [0.8], spine: [-0.15, -0.25, 0.1], neck: [-0.25, 0, 0] }, -0.06, -0.1, -0.08))],
      [0.45, gfit(pb({ hipL: [0.15, 0, -0.1], knL: [-0.15], hipR: [1.45, 0, 0.15], knR: [-0.15], ftR: [0.6], shL: [0.9, 0, -1.3], shR: [-0.8, 0, 0.6], elL: [0.3], elR: [0.8], spine: [-0.15, 0.25, 0.15], neck: [-0.3, 0, 0] }, -0.04, -0.18, -0.1))],
      [1, gfit(pb({ hipL: [0.15, 0, -0.1], knL: [-0.2], hipR: [1.0, 0, 0.15], knR: [-0.3], shL: [0.4, 0, -0.8], shR: [-0.2, 0, 0.5], elL: [0.5], elR: [0.8], spine: [0.05, 0.1, 0.05], neck: [-0.2, 0, 0] }, -0.05, -0.05, -0.05))],
    ]);
  }
  const POSE_SLIDE = pb({ hipL: [1.5, 0, -0.1], knL: [-0.1], hipR: [1.1, 0, 0.2], knR: [-1.3], shL: [-0.4, 0, -0.9], shR: [2.0, 0, 0.6], elL: [0.4], elR: [0.3], spine: [-0.5, 0, 0], neck: [0.2, 0, 0] }, -0.7, -1.15, 0.1);
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
  // verlet step: gravity, joint links (4 passes), the turf and the pile under him. A part touching the turf grips it (friction in
  // proportion to how hard it lands and its weight, so a sliding body skids a short way to a stop instead of sticking dead or
  // gliding). Once everything is still he goes to sleep (no jitter at rest) until something hits him again.
  const RAG_MU = [0.75, 0.75, 0.7, 0.9, 0.9, 0.9, 0.9, 0.95, 1.05, 0.95, 1.05], RAG_FL = [0.16, 0.16, 0.17, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07];
  Rag.prototype.step = function (dt, floorAt) {
    this.t += dt;
    if (this.rest) return;
    const pts = this.pts, prev = this.prev, n = pts.length, hs = this.hs, dn = this.dn || (this.dn = new Float32Array(n)), fl = this.fl || (this.fl = new Float32Array(n));
    let ke = 0;
    for (let i = 0; i < n; i++) {
      const q = pts[i], o = prev[i], vx = (q[0] - o[0]) * 0.985, vy = (q[1] - o[1]) * 0.985, vz = (q[2] - o[2]) * 0.985;
      o[0] = q[0]; o[1] = q[1]; o[2] = q[2];
      q[0] += vx; q[1] += vy - 24 * dt * dt; q[2] += vz;
      ke += vx * vx + vy * vy + vz * vz;
      dn[i] = 0; fl[i] = (floorAt ? floorAt(q, i) : 0) + RAG_FL[i] * hs;
    }
    for (let it = 0; it < 4; it++) {
      for (const c of this.cons) {
        const a = pts[c.a], b = pts[c.b], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1e-4;
        if ((c.t === 1 && d <= c.d) || (c.t === -1 && d >= c.d)) continue;
        const k = (d - c.d) / d * 0.5, wa = c.a === 0 ? 0.35 : 0.5, wb = c.b === 0 ? 0.35 : 0.5, s = wa + wb;
        a[0] += dx * k * wa / s * 2; a[1] += dy * k * wa / s * 2; a[2] += dz * k * wa / s * 2;
        b[0] -= dx * k * wb / s * 2; b[1] -= dy * k * wb / s * 2; b[2] -= dz * k * wb / s * 2;
      }
      for (let i = 0; i < n; i++) { const q = pts[i]; if (q[1] < fl[i]) { dn[i] += fl[i] - q[1]; q[1] = fl[i]; } }
    }
    for (let i = 0; i < n; i++) { // Coulomb friction on every part on the turf
      const q = pts[i]; if (q[1] > fl[i] + 0.004) continue;
      const o = prev[i], hx = q[0] - o[0], hz = q[2] - o[2], hv = Math.hypot(hx, hz);
      if (hv < 1e-7) continue;
      const k = Math.max(0, 1 - RAG_MU[i] * (dn[i] + 24 * dt * dt) / hv);
      q[0] = o[0] + hx * k; q[2] = o[2] + hz * k;
    }
    this.still = ke < 0.00004 * n / 11 ? (this.still || 0) + 1 : 0;
    if (this.still > 12 && this.t > 0.5) { this.rest = true; for (let i = 0; i < n; i++) { prev[i][0] = pts[i][0]; prev[i][1] = pts[i][1]; prev[i][2] = pts[i][2]; } }
    this.vel = [(pts[0][0] - prev[0][0]) / dt, (pts[0][1] - prev[0][1]) / dt, (pts[0][2] - prev[0][2]) / dt];
  };
  Rag.prototype.impulse = function (ix, iy, iz, spread) {
    const w = [1, 0.95, 0.9, 0.6, 0.55, 0.6, 0.55, 0.5, 0.4, 0.5, 0.4];
    const dt = this.dt;
    this.rest = false; this.still = 0;
    for (let i = 0; i < this.pts.length; i++) { const k = w[i] * (1 + (spread || 0) * (crand() - 0.5)) * dt; this.prev[i][0] -= ix * k; this.prev[i][1] -= iy * k; this.prev[i][2] -= iz * k; }
  };
  Rag.prototype.bones = function () {
    const q = this.pts, hs = this.hs, out = new Array(NB);
    const hips = q[0], chest = q[1], head = q[2];
    let up = v3n(v3s(chest, hips));
    // the body's own left-right axis (right elbow and knee minus the left ones), so the frame rolls with the body and never
    // flips when the spine lines up with the old heading; the heading is only the tie-breaker
    const hd = [Math.sin(this.h), 0, Math.cos(this.h)], hX = v3c(up, hd);
    const lr = (k) => 2 * (q[9][k] - q[7][k]) + q[10][k] - q[8][k] + q[5][k] - q[3][k]; // knees count double: legs rarely cross
    let X = [lr(0), lr(1), lr(2)];
    const xu = v3d(X, up); X = [X[0] - up[0] * xu, X[1] - up[1] * xu, X[2] - up[2] * xu];
    if (Math.hypot(X[0], X[1], X[2]) < 0.05 * hs) X = hX;
    if (Math.hypot(X[0], X[1], X[2]) < 1e-3) X = [1, 0, 0];
    X = v3n(X);
    if (this.X) { const k = v3d(X, this.X) < 0 ? 0.1 : 0.4; X = v3n([this.X[0] * (1 - k) + X[0] * k, this.X[1] * (1 - k) + X[1] * k, this.X[2] * (1 - k) + X[2] * k]); const xu2 = v3d(X, up); X = v3n([X[0] - up[0] * xu2, X[1] - up[1] * xu2, X[2] - up[2] * xu2]); }
    this.X = X;
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
  const SL = { jer: 0, pant: 1, skin: 2, helm: 3, trim: 4, cleat: 5, pad: 6, mask: 7, num: 8, face: 9, arm: 10, name: 11, glove: 12, sock: 13, sole: 14, visor: 15, snum: 16, wht: 17, eye: 18, tape: 19, towel: 20, stripes: 21, mouth: 22, hair: 23, cloth: 24 };
  const NSL = 25;
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
  const bodyKey = (s) => [s.bulk, s.belly, s.sw, s.legs, s.arms, s.neck, s.ll || 1, s.cap ? 1 : 0, s.noGear ? 1 : 0, s.headset ? 1 : 0].map((v) => Math.round(v * 100)).join(',') + (s.cas ? ',c' + s.cas.hair + s.cas.bot + s.cas.sock : '') + (s.bare ? ',b' + s.bare.hair : '');
  // casual clothes (Metcalf): the same skeleton and body numbers, dressed as kids at lunch: a plain T-shirt, their own sweats or
  // shorts, socks, sneakers and real hair. c = { hair: CAS_HAIR index, bot: CAS_BOT index, sock: 0 crew / 1 ankle }; mesh only
  const CAS_HAIR = ['buzz', 'short', 'fade', 'curly', 'long', 'capback', 'beanie'];
  const CAS_BOT = ['sweats', 'joggers', 'shorts', 'midshorts', 'hoops'];
  const HEADK = 1.1; // casual head scale (see buildBody)
  const casSpec = (spec, c) => (c ? Object.assign({}, spec, { cas: c }) : spec);
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
    const CAS = S.cas || null; // casual clothes (Metcalf): no pads, no helmet, a slimmer natural build in the mesh only
    const W = S.bulk * (CAS ? 0.93 : 1), W2 = 0.6 + 0.4 * S.bulk * (CAS ? 0.93 : 1), BEL = S.belly, gear = !S.noGear && !CAS;
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
    if (CAS) { // a T-shirt: natural shoulders (no pads) and an untucked hem that hangs straight over the waistband
      // the shoulder line slopes from the neck down to the deltoids instead of the pads' flat shelf
      torso.length = 0;
      for (const [y, rx, rz, v, ao] of [[0.745, 0.075, 0.066, 0, 0.5], [0.735, 0.11, 0.09, 0.02, 0.68], [0.72, 0.16, 0.12, 0.05, 0.82], [0.7, 0.207, 0.148, 0.09, 1], [0.68, 0.242, 0.17, 0.13, 1], [0.655, 0.264, 0.186, 0.17, 1],
        [0.625, 0.274, 0.195, 0.22, 0.95], [0.58, 0.272, 0.2, 0.28, 0.95], [0.5, 0.26, 0.193, 0.38, 0.9], [0.42, 0.245, 0.178, 0.48, 1], [0.33, 0.232, 0.166, 0.6, 1], [0.24, 0.225, 0.159, 0.72, 1], [0.15, 0.222, 0.156, 0.84, 0.95]]) torso.push(T(y, rx, rz, { v, ao }));
      for (const r of torso) { if (r.y > 0.45 && r.y < 0.65) r.f = (an) => 1 + 0.03 * Math.max(0, Math.sin(an)) * Math.abs(Math.cos(an)) * 2; }
      const pk = (0.85 + 0.15 * S.legs) * (1 + 0.08 * BEL) * 1.04, pz = W2 * (1 + 0.12 * BEL) * 1.04;
      const hem = (y, ex, v, ao) => ({ y, rx: Math.max(0.212 * W * 0.97, 0.226 * pk) + ex, rz: Math.max(0.148 * W2, 0.158 * pz) + ex, cz: 0.02 * BEL, w: torsoW(Math.max(0, y)), v, ao });
      torso.push(hem(0.09, 0.01, 0.9, 0.95), hem(0.03, 0.02, 0.96, 0.9), hem(-0.02, 0.022, 0.99, 0.85), hem(-0.026, 0.008, 1, 0.55));
    }
    if (S.bare) for (const r of torso) if (r.y < 0.26) { r.rx *= 0.93; r.rz *= 0.93; } // the avatar close up: the jersey tucked well inside the pants (no zigzag at the belt)
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
    const NK = S.neck * (CAS ? 1.1 : 1);
    loft({ s: SL.skin, seg: SG(12) }, [{ y: 0.69, rx: 0.068 * NK, rz: 0.062 * NK, w: [B.chest, B.neck, 0.7], ao: 0.5, cz: -0.005 }, { y: 0.745, rx: 0.062 * NK, rz: 0.058 * NK, w: [B.neck, B.chest, 0.8], ao: 0.6, cz: -0.004 }, { y: 0.8, rx: 0.06 * NK, rz: 0.057 * NK, w: [B.neck, B.head, 0.6], ao: 0.62 }, { y: 0.85, rx: 0.062 * NK, rz: 0.06 * NK, w: [B.head, B.neck, 0.85], ao: 0.6, cz: 0.004 }]);
    if (CAS) loft({ s: SL.jer, seg: SG(14), uv: uvOf('torso', 0, 1, 0, 0.03) }, [{ y: 0.738, rx: 0.074 * W, rz: 0.064 * W2, w: torsoW(0.72), ao: 0.7 }, { y: 0.749, rx: 0.084 * W, rz: 0.072 * W2, w: torsoW(0.72) }, { y: 0.741, rx: 0.098 * W, rz: 0.082 * W2, w: torsoW(0.72) }]); // a slim crew-neck rib
    else loft({ s: SL.trim, seg: SG(14) }, [{ y: 0.735, rx: 0.095 * W, rz: 0.082 * W2, w: torsoW(0.72), ao: 0.8 }, { y: 0.752, rx: 0.115 * W, rz: 0.098 * W2, w: torsoW(0.72) }, { y: 0.74, rx: 0.132 * W, rz: 0.112 * W2, w: torsoW(0.72) }]);
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
    // ---- helmet (or a cap for sideline staff; S.bare: the uniform with the helmet off and his hair showing, S.bare.hair a CAS_HAIR index) ----
    const HEC = [0, 0.972, -0.01], HRR = [0.158, 0.172, 0.182];
    if (gear && !S.bare) {
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
    } else if (CAS || S.bare) {
      casHair(CAS ? CAS.hair : S.bare.hair);
    } else {
      // cap: crown + bill
      ellipsoid({ s: SL.cleat, seg: SG(16), w: HW, ring: () => ({ w: HW, ao: 0.9 }) }, [0, 0.975, -0.004], 0.108, 0.105, 0.112, 0, 1.75, 6);
      loft({ s: SL.cleat, seg: SG(8), w: HW, a0: HPI - 1.2, a1: HPI + 1.2 }, [{ y: 0.978, rx: 0.108, rz: 0.112, cz: -0.004, w: HW }, { y: 0.973, rx: 0.13, rz: 0.155, cz: 0.015, w: HW }, { y: 0.965, rx: 0.125, rz: 0.185, cz: 0.025, w: HW }]);
      if (S.headset && !lod) { tube({ s: SL.wht, w: HW }, arcPts2(0.995, 0.112, 0.115, 0, Math.PI, 8), 0.01, 5); tube({ s: SL.wht, w: HW }, [[-0.115, 0.94, 0.0], [-0.1, 0.925, 0.06], [-0.06, 0.9, 0.105]], 0.007, 4); }
    }
    function arcPts2(y, r0, r2, aA, aB, n) { const pts = []; for (let i = 0; i <= n; i++) { const an = aA + (aB - aA) * i / n; pts.push([r0 * Math.cos(an), y + 0.02 * Math.sin(an), -0.004 + r2 * Math.sin(an) * 0.1]); } return pts; }
    // visor: its own index range, drawn blended, hidden when not worn
    const vi0 = I.length;
    if (!lod && gear && !S.bare) ellipsoid({ s: SL.visor, seg: SG(12), a0: HPI - 1.0, a1: HPI + 1.0, w: HW, ring: () => ({ ao: 1, w: HW }) }, [0, 0.958, -0.004], 0.142, 0.148, 0.162, 1.15, 1.68, 3);
    const vin = I.length - vi0;
    // ---- casual clothes: hair and hats, sweats / joggers / shorts, socks (Metcalf) ----
    // grid surface: P(i, j) for rows i = 0..nr and columns j = 0..nc (j wraps when closed); normals from the grid's own tangents
    function grid(o, nr, nc, P) {
      const pts = [];
      for (let i = 0; i <= nr; i++) { const row = []; for (let j = 0; j <= nc; j++) row.push(P(i, j)); pts.push(row); }
      const base = nv, w = o.w || HW;
      for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) {
        const jm = o.closed ? (j === 0 ? nc - 1 : j - 1) : Math.max(0, j - 1), jp = o.closed ? (j === nc ? 1 : j + 1) : Math.min(nc, j + 1);
        const im = Math.max(0, i - 1), ip = Math.min(nr, i + 1);
        let n = v3c(v3s(pts[ip][j], pts[im][j]), v3s(pts[i][jp], pts[i][jm]));
        if (Math.hypot(n[0], n[1], n[2]) < 1e-10) n = o.pole || [0, 1, 0];
        n = v3n(n); const c = o.c || [0, 0.96, 0], out = v3s(pts[i][j], c); if (v3d(n, out) < 0) n = [-n[0], -n[1], -n[2]];
        push(pts[i][j], n, w[0], w[1], w[2], o.s, j / nc, i / nr, o.ao ? o.ao(i / nr, j / nc) : 1);
      }
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const a = base + i * (nc + 1) + j, c = a + nc + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
    }
    // a point on the scalp at height y, angle an (0 = +X, a quarter turn = the face), pushed out by th along the skull's normal;
    // hang: long hair falls straight from the widest part of the head instead of following the skull in to the nape
    function scalp(y, an, th, hang) {
      const raw = (y) => {
        let rx, rz, cz;
        if (y >= 1.066) { const u = clamp((y - 1.066) / 0.018, 0, 1), k = Math.sqrt(Math.max(0, 1 - u * u)); rx = 0.05 * k; rz = 0.051 * k; cz = -0.005; }
        else { let i = 0; while (i < HR.length - 2 && HR[i + 1].y < y) i++; const a = HR[i], b = HR[i + 1], t = clamp((y - a.y) / (b.y - a.y), 0, 1); rx = lerp(a.rx, b.rx, t); rz = lerp(a.rz, b.rz, t); cz = lerp(a.cz, b.cz, t); }
        const k = faceF(clamp(y, 0.83, 1.08))(an);
        return [rx * k * Math.cos(an), Math.min(y, 1.084), cz + rz * k * Math.sin(an)];
      };
      let p = raw(y);
      if (hang && y < 0.95) { // straight down from the ring at 0.95, drawn in a touch toward the collar
        const h = clamp((0.2 - Math.sin(an)) / 0.4, 0, 1), q = raw(0.95), s = 1 - 0.35 * (0.95 - y);
        p = [lerp(p[0], q[0] * s, h), y, lerp(p[2], q[2] * s, h)];
      }
      const n = v3n([p[0] / 0.0102, (p[1] - 0.955) / 0.0156, (p[2] + 0.004) / 0.0118]);
      return v3a(p, n, th);
    }
    // hair: a shell over the scalp from the crown down to a hairline that sits high at the forehead, above the ears and low at the
    // nape; its edge folds back onto the scalp so it has a little thickness. Styles: buzz, short, fade (tall top, short sides),
    // curly, long (over the ears, down to the collar), a cap worn backwards, a beanie
    function casHair(st) {
      const name = CAS_HAIR[st] || 'short', nc = SG(name === 'curly' ? 26 : 20), nr = lod ? 6 : name === 'curly' ? 12 : 9;
      const shell = (s, line, thick, o) => grid({ s, closed: true, c: [0, 0.955, -0.004], pole: [0, 1, 0], ao: (v) => (o && o.ao ? o.ao(v) : 1 - 0.25 * v * v) }, nr + 1, nc, (i, j) => {
        const an = -HPI + TAU * j / nc, last = i > nr, v = Math.min(1, i / nr), jag = s === SL.hair ? 0.009 * (0.4 + 0.6 * Math.max(0, Math.sin(an))) * (0.5 + 0.5 * Math.sin(an * 17 + 0.7) * Math.sin(an * 7)) : 0; // a ragged edge: tufts, not a swim cap
        const y = 1.084 - (1.084 - line(an) + jag) * Math.pow(v, 1.5);
        return scalp(y, an, last ? 0.0042 : Math.max(0.0062, thick(v, an)), o && o.hang); // the edge stays proud of the face decal
      });
      const hl = (f, sd, bk) => (an) => { const s = Math.sin(an); return s > 0 ? sd + (f - sd) * s * s : sd + (bk - sd) * Math.pow(-s, 1.2); };
      const taper = (v, k) => (v < 0.8 ? 1 : 1 - (1 - k) * (v - 0.8) / 0.2);
      if (name === 'buzz') shell(SL.hair, hl(1.032, 0.972, 0.885), (v) => 0.0045 * taper(v, 0.6));
      else if (name === 'fade') shell(SL.hair, hl(1.034, 0.975, 0.89), (v) => (0.004 + 0.026 * (1 - smo(clamp((v - 0.3) / 0.3, 0, 1)))) * taper(v, 0.7));
      else if (name === 'curly') shell(SL.hair, hl(1.028, 0.962, 0.875), (v, an) => (0.024 + 0.008 * Math.sin(an * 7 + v * 9) * Math.sin(an * 4 - v * 13 + 1.3) + 0.004 * Math.sin(an * 13 + v * 21)) * taper(v, 0.45));
      else if (name === 'long') shell(SL.hair, hl(1.025, 0.9, 0.84), (v, an) => (0.016 + 0.006 * (1 - Math.max(0, Math.sin(an)))) * taper(v, 0.6), { hang: 1 });
      else shell(SL.hair, hl(1.034, 0.972, 0.887), (v) => (name === 'short' ? 0.012 - 0.004 * v : 0.008) * taper(v, 0.5));
      if (name === 'capback') { // a ball cap turned backwards: the crown, then the bill over the nape
        const cl = hl(1.0, 0.982, 0.97);
        shell(SL.tape, cl, (v) => 0.02 - 0.004 * v, { ao: (v) => 1 - 0.15 * v });
        const nb = SG(10), bill = (side) => grid({ s: SL.tape, c: [0, side > 0 ? 0.85 : 1.25, -0.02], pole: [0, side, 0] }, 2, nb, (i, j) => {
          const an = -HPI + (j / nb - 0.5) * 1.9, e = scalp(cl(an), an, 0.02), dir = [Math.cos(an), 0, Math.sin(an)], L = 0.085 * Math.sqrt(Math.max(0, Math.cos((j / nb - 0.5) * Math.PI))) * i / 2;
          return [e[0] + dir[0] * L, e[1] - 0.004 - L * 0.12 - (side < 0 ? 0.006 : 0), e[2] + dir[2] * L];
        });
        bill(1); bill(-1);
        if (!lod) ellipsoid({ s: SL.tape, seg: SG(6), w: HW, ring: () => ({ w: HW }) }, [0, 1.09, -0.005], 0.009, 0.006, 0.009, 0, Math.PI, 3); // button
      } else if (name === 'beanie') { // a knit beanie with a folded cuff, sitting over the tops of the ears
        const bl = hl(1.006, 0.955, 0.925);
        shell(SL.tape, bl, (v) => 0.02 + 0.012 * (1 - v) + (v > 0.72 ? 0.007 : 0), { ao: (v) => (v > 0.72 ? 0.9 : 1) });
      }
    }
    // a casual leg: sweats (loose to the shoe), joggers (tapered into a cuff) or shorts (three lengths) over a bare knee and calf, then
    // crew or ankle socks. Radii are a lean natural leg (no thigh or knee pads)
    function casLeg(sd, hp, kn, ft, X, inner) {
      const LW = S.legs * 0.96, kind = CAS_BOT[CAS.bot] || 'sweats', KY = -0.53;
      const LT = [[-0.02, 0.134, 0.012], [-0.14, 0.126, 0.02], [-0.27, 0.113, 0.018], [-0.4, 0.097, 0.01], [-0.49, 0.087, 0.014], [-0.555, 0.081, 0.01], [-0.63, 0.075, 0], [-0.7, 0.079, -0.012], [-0.78, 0.071, -0.008], [-0.88, 0.061, -0.004], [-0.95, 0.054, 0], [-1.0, 0.05, 0], [-1.04, 0.046, -0.006]];
      const at = (y) => { let i = 0; while (i < LT.length - 2 && LT[i + 1][0] > y) i++; const a = LT[i], b = LT[i + 1], t = clamp((a[0] - y) / (a[0] - b[0]), 0, 1); return [lerp(a[1], b[1], t) * LW, lerp(a[2], b[2], t)]; };
      const wL = (y) => (y > -0.05 ? [hp, B.hips, 0.75] : y > KY + 0.07 ? [hp, kn, 1] : y > KY - 0.07 ? wt(y, 0, KY, hp, kn, 0.07) : y > -0.76 ? [kn, hp, 1] : y > -0.92 ? [kn, ft, 1] : [kn, ft, 1 - smo(clamp((-0.92 - y) / 0.12, 0, 1))]);
      const ring = (y, r, e) => { const q = at(y); return Object.assign({ y: legY(y), rx: r, rz: r * 1.03, cx: X, cz: q[1], w: wL(y) }, e || {}); };
      const calf = (an) => 1 + 0.1 * Math.max(0, -Math.sin(an)), knee = (an) => 1 + 0.04 * Math.max(0, Math.sin(an));
      const cloth = [], skin = [], sock = [];
      const shorts = kind === 'shorts' || kind === 'midshorts' || kind === 'hoops';
      if (shorts) {
        const yH = kind === 'shorts' ? -0.33 : kind === 'midshorts' ? -0.43 : -0.54, lo = kind === 'hoops' ? 1.2 : kind === 'midshorts' ? 1.12 : 1.1;
        for (const y of [-0.02, -0.14, -0.24, -0.33, -0.43, -0.54]) if (y > yH + 0.01) cloth.push(ring(y, at(y)[0] * lo + 0.014, { ao: y < -0.05 ? 1 : 0.85 }));
        const rH = at(yH)[0] * lo + 0.016;
        cloth.push(ring(yH, rH, { ao: 0.95 }), ring(yH + 0.008, at(yH)[0] + 0.006, { ao: 0.45 }));
        const sockTop = CAS.sock ? -0.972 : -0.8;
        for (const y of [yH + 0.004, -0.4, -0.49, -0.53, -0.57, -0.63, -0.7, -0.78, -0.8]) if (y <= yH + 0.004 && y > sockTop + 0.005) skin.push(ring(y, at(y)[0], { f: y < -0.66 && y > -0.75 ? calf : y < -0.5 && y > -0.56 ? knee : null, ao: y > yH - 0.03 ? 0.7 : 1 }));
        skin.push(ring(sockTop + 0.004, at(sockTop)[0], { ao: 0.9 }));
        sock.push(ring(sockTop + 0.006, at(sockTop)[0] + 0.006, { ao: 0.9 }), ring(sockTop - 0.012, at(sockTop - 0.012)[0] + 0.007));
        for (const y of [-0.88, -0.95, -1.0, -1.04]) if (y < sockTop - 0.03) sock.push(ring(y, at(y)[0] + 0.004, { ao: y < -0.99 ? 0.75 : 1 }));
        if (sock[sock.length - 1].y > legY(-1.04) + 0.001) sock.push(ring(-1.04, at(-1.04)[0] + 0.004, { ao: 0.7 }));
      } else if (kind === 'joggers') {
        for (const y of [-0.02, -0.14, -0.27, -0.4, -0.49, -0.57, -0.66, -0.75, -0.84]) cloth.push(ring(y, at(y)[0] * 1.08 + 0.014, { f: y === -0.49 ? knee : null }));
        cloth.push(ring(-0.9, 0.068 * LW + 0.004), ring(-0.925, 0.06 * LW + 0.004, { ao: 0.8 }), ring(-0.975, 0.054 * LW + 0.004), ring(-0.99, 0.05 * LW, { ao: 0.5 }));
        sock.push(ring(-0.97, at(-0.97)[0] + 0.002), ring(-1.0, at(-1.0)[0] + 0.004), ring(-1.04, at(-1.04)[0] + 0.004, { ao: 0.7 }));
      } else { // sweats: straight and roomy, bunched over the shoe
        for (const y of [-0.02, -0.14, -0.27, -0.4, -0.49, -0.57, -0.66, -0.75, -0.84]) cloth.push(ring(y, Math.max(at(y)[0] * 1.12 + 0.016, 0.082 * LW + 0.004), { f: y === -0.49 ? knee : null }));
        cloth.push(ring(-0.9, 0.084 * LW + 0.004), ring(-0.935, 0.089 * LW + 0.004, { ao: 0.9 }), ring(-0.965, 0.083 * LW + 0.004), ring(-0.995, 0.08 * LW + 0.004, { ao: 0.8 }), ring(-1.003, 0.058 * LW, { ao: 0.4 }));
      }
      loft({ s: SL.cloth, seg: SG(16), uv: uvOf('pant', 0, 1, 0.38, 1), mirrorU: sd < 0, ao: inner }, cloth);
      if (skin.length > 1) loft({ s: SL.skin, seg: SG(14) }, skin);
      if (sock.length > 1) loft({ s: SL.wht, seg: SG(12) }, sock);
    }
    // ---- arms: deltoid -> biceps -> elbow -> forearm -> wrist as one surface ----
    for (const sd of [-1, 1]) {
      const sh = sd < 0 ? B.shL : B.shR, el = sd < 0 ? B.elL : B.elR, ha = sd < 0 ? B.haL : B.haR, X = BIND[sh][0], AW = S.arms, mir = sd < 0;
      const SY = 0.64, EY = 0.28, HY = -0.04; // joint heights
      const aw = (y) => (y > EY + 0.06 ? [sh, el, 1] : y < EY - 0.06 ? [el, sh, 1] : wt(y, SY, EY, sh, el, 0.06));
      const sleeve = gear || CAS ? SL.jer : SL.stripes, armS = S.sleeves ? SL.arm : SL.skin;
      let rings = [
        { y: 0.705, rx: 0.075 * AW, rz: 0.072 * AW, cx: X + sd * 0.025, s: sleeve, ao: 0.85, w: [sh, B.chest, 0.6] }, { y: 0.675, rx: 0.118 * AW, rz: 0.11 * AW, cx: X + sd * 0.03, s: sleeve, w: [sh, B.chest, 0.8] }, { y: 0.62, rx: 0.125 * AW, rz: 0.118 * AW, cx: X + sd * 0.022, s: sleeve, w: [sh, el, 1] },
        { y: 0.55, rx: 0.112 * AW, rz: 0.106 * AW, cx: X + sd * 0.012, s: sleeve, ao: 0.9, w: [sh, el, 1] }, { y: 0.5, rx: 0.1 * AW, rz: 0.095 * AW, cx: X + sd * 0.006, s: sleeve, ao: 0.85, w: [sh, el, 1] },
        { y: 0.5, rx: 0.092 * AW, rz: 0.088 * AW, cx: X + sd * 0.004, s: armS, ao: 0.8, w: [sh, el, 1] }, { y: 0.44, rx: 0.088 * AW, rz: 0.09 * AW, cx: X + sd * 0.002, cz: 0.004, s: armS, w: [sh, el, 1], f: (an) => 1 + 0.06 * Math.max(0, Math.sin(an)) }, // biceps
        { y: 0.37, rx: 0.08 * AW, rz: 0.08 * AW, cx: X, s: armS, w: [sh, el, 1] }, { y: 0.31, rx: 0.071 * AW, rz: 0.069 * AW, cx: X, s: armS, w: aw(0.31) }, { y: 0.28, rx: 0.068 * AW, rz: 0.066 * AW, cx: X, cz: -0.004, s: armS, w: aw(0.28) },
        { y: 0.25, rx: 0.069 * AW, rz: 0.067 * AW, cx: X, s: armS, w: aw(0.25) }, { y: 0.19, rx: 0.074 * AW, rz: 0.072 * AW, cx: X, s: armS, w: [el, sh, 1] }, { y: 0.11, rx: 0.062 * AW, rz: 0.058 * AW, cx: X, s: armS, w: [el, sh, 1] },
        { y: 0.03, rx: 0.052 * AW, rz: 0.046 * AW, cx: X, s: armS, w: [el, ha, 1] }, { y: 0.0, rx: 0.05 * AW, rz: 0.043 * AW, cx: X, s: armS, w: [el, ha, 0.85] }];
      if (CAS) { // a T-shirt's short sleeve: loose over the deltoid, hemmed at mid upper arm; slimmer arms without the pads' bulk
        // the upper arm hangs a little inside the (wide) shoulder joint, so the shoulders read as a kid's, not a padded player's
        const A2 = AW * 0.88, ix = (y) => -sd * 0.024 * clamp((y - 0.36) / 0.26, 0, 1);
        rings = [{ y: 0.662, rx: 0.045 * A2, rz: 0.045 * A2, cx: X + ix(0.662), s: sleeve, ao: 0.9, w: [sh, B.chest, 0.6] }, { y: 0.642, rx: 0.094 * A2, rz: 0.09 * A2, cx: X + ix(0.642) + sd * 0.006, s: sleeve, w: [sh, B.chest, 0.8] }, { y: 0.6, rx: 0.108 * A2, rz: 0.103 * A2, cx: X + ix(0.6) + sd * 0.008, s: sleeve, w: [sh, el, 1] },
          { y: 0.55, rx: 0.106 * A2, rz: 0.101 * A2, cx: X + ix(0.55) + sd * 0.006, s: sleeve, w: [sh, el, 1] }, { y: 0.475, rx: 0.104 * A2, rz: 0.1 * A2, cx: X + ix(0.475) + sd * 0.005, s: sleeve, ao: 0.9, w: [sh, el, 1] }, { y: 0.47, rx: 0.094 * A2, rz: 0.09 * A2, cx: X + ix(0.47) + sd * 0.004, s: sleeve, ao: 0.6, w: [sh, el, 1] },
          { y: 0.47, rx: 0.086 * A2, rz: 0.084 * A2, cx: X + ix(0.47) + sd * 0.003, s: armS, ao: 0.62, w: [sh, el, 1] }, { y: 0.42, rx: 0.086 * A2, rz: 0.088 * A2, cx: X + ix(0.42) + sd * 0.002, cz: 0.004, s: armS, w: [sh, el, 1], f: (an) => 1 + 0.05 * Math.max(0, Math.sin(an)) },
          { y: 0.36, rx: 0.078 * A2, rz: 0.078 * A2, cx: X, s: armS, w: [sh, el, 1] }].concat(rings.slice(8).map((r) => Object.assign({}, r, { rx: r.rx * 0.92, rz: r.rz * 0.92 })));
      }
      loft({ s: sleeve, seg: SG(16), uv: uvOf('sleeve'), mirrorU: mir, capTop: true, ao: (i, an) => (i >= 2 && i <= 5 && Math.cos(an) * sd < -0.5 ? 0.72 : 1) }, rings);
      if (!lod && gear) { // sleeve number
        const rs = []; for (let i = 0; i <= 2; i++) { const y = 0.645 - 0.08 * i; rs.push({ y, rx: (0.127 - 0.011 * i) * AW, rz: (0.119 - 0.011 * i) * AW, cx: X + sd * 0.024, v: i / 2, ao: 0.95, w: [sh, el, 1] }); }
        loft({ s: SL.snum, seg: SG(6), a0: (sd > 0 ? 0 : Math.PI) - 0.5, a1: (sd > 0 ? 0 : Math.PI) + 0.5 }, rs);
      }
      // wrist tape
      if (!lod && !CAS) loft({ s: SL.tape, seg: SG(10) }, [{ y: 0.015, rx: 0.054 * AW, rz: 0.048 * AW, cx: X, w: [el, ha, 0.7] }, { y: -0.02, rx: 0.054 * AW, rz: 0.047 * AW, cx: X, w: [ha, el, 0.9] }, { y: -0.045, rx: 0.052 * AW, rz: 0.046 * AW, cx: X, w: [ha, el, 1] }]);
      // hand: gloved palm with knuckles, four fingers and a thumb (fingers only at full detail)
      const HWt = [ha, el, 1], GS = gear ? SL.glove : SL.skin;
      loft({ s: GS, seg: SG(10), uv: uvOf('glove'), capBot: true, w: HWt }, [{ y: -0.035, rx: 0.048, rz: 0.03, cx: X, w: HWt }, { y: -0.09, rx: 0.06, rz: 0.032, cx: X, cz: 0.004, w: HWt }, { y: -0.14, rx: 0.062, rz: 0.03, cx: X, cz: 0.006, w: HWt }, { y: -0.175, rx: 0.058, rz: 0.028, cx: X, cz: 0.006, w: HWt, ao: 0.85 }]);
      if (!lod) {
        for (let f = 0; f < 4; f++) { const fx = X + sd * (-0.042 + 0.028 * f), len = [0.075, 0.085, 0.08, 0.065][f], curl = 0.35; tube({ s: GS, w: HWt }, [[fx, -0.175, 0.008], [fx, -0.175 - len * 0.5, 0.008 + curl * len * 0.3], [fx, -0.175 - len * 0.82, 0.008 + curl * len * 0.9], [fx, -0.175 - len, 0.008 + curl * len * 1.6]], 0.0125, 5, (t) => 1 - 0.25 * t); }
        tube({ s: GS, w: HWt }, [[X + sd * 0.045, -0.07, 0.012], [X + sd * 0.072, -0.1, 0.034], [X + sd * 0.085, -0.13, 0.05]], 0.016, 5, (t) => 1 - 0.2 * t);
      } else loft({ s: GS, seg: SG(8), w: HWt, capBot: true }, [{ y: -0.175, rx: 0.055, rz: 0.028, cx: X, cz: 0.012, w: HWt }, { y: -0.245, rx: 0.042, rz: 0.024, cx: X, cz: 0.03, w: HWt }, { y: -0.27, rx: 0.02, rz: 0.012, cx: X, cz: 0.04, w: HWt }]);
    }
    // ---- pelvis + legs: hip -> thigh (pads) -> knee -> calf -> ankle as one surface; socks; cleats ----
    const PLX = CAS ? 1.04 : 1; // casual bottoms sit a little looser than game pants
    const pel = (y, rx, rz, e) => Object.assign({ y: y < -0.03 ? legY(y) : y, rx: rx * PLX * (0.85 + 0.15 * S.legs) * (1 + 0.08 * BEL), rz: rz * PLX * W2 * (1 + 0.12 * BEL), cz: 0.02 * BEL, w: torsoW(Math.max(0, y)) }, e || {});
    const PS = CAS ? SL.cloth : SL.pant;
    loft({ s: PS, seg: SG(24), uv: uvOf('pant', 0, 1, 0, 0.38), capBot: true }, [CAS ? pel(0.07, 0.19, 0.13, { v: 0 }) : pel(0.17, 0.205, 0.142, { v: 0 }), CAS ? pel(0.04, 0.208, 0.145, { v: 0.3 }) : pel(0.1, 0.212, 0.148, { v: 0.3 }), pel(0.0, 0.228, 0.16, { v: 0.6, f: (an) => 1 + 0.05 * Math.max(0, -Math.sin(an)) }), pel(-0.1, 0.212, 0.155, { v: 0.85, ao: 0.82, w: [B.hips, B.hips, 1], f: (an) => 1 + 0.08 * Math.max(0, -Math.sin(an)) }), pel(-0.18, 0.165, 0.13, { v: 1, ao: 0.62, w: [B.hips, B.hips, 1] })]);
    for (const sd of [-1, 1]) {
      const hp = sd < 0 ? B.hipL : B.hipR, kn = sd < 0 ? B.knL : B.knR, ft = sd < 0 ? B.ftL : B.ftR, X = sd * 0.15, LW = S.legs;
      const KY = -0.53, FY = -1.0;
      const lw = (y) => (y > KY + 0.07 ? [hp, kn, 1] : y < KY - 0.07 ? [kn, hp, 1] : wt(y, 0, KY, hp, kn, 0.07));
      const inner = (i, an) => (i <= 2 && Math.cos(an) * sd < -0.6 ? 0.7 : 1);
      if (CAS) casLeg(sd, hp, kn, ft, X, inner); else {
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
      }
      // shoe: heel counter -> arch -> ball -> toe box, lofted along +Z; sole plate; studs at full detail
      const FW = [ft, ft, 1];
      const shoeM = mMul(mT(IDM, X, legY(-1.05), -0.012), mRX(IDM, -HPI)); // loft -Y -> body +Z, loft +Z -> body +Y
      const shoe = [{ y: 0.1, rx: 0.03, rz: 0.024, w: FW }, { y: 0.075, rx: 0.046, rz: 0.034, w: FW }, { y: 0.02, rx: 0.052, rz: 0.04, cz: 0.008, w: FW, ao: 0.85 }, { y: -0.05, rx: 0.054, rz: 0.038, cz: 0.012, w: FW, f: (an) => 1 + 0.08 * Math.max(0, Math.sin(an)) }, { y: -0.12, rx: 0.056, rz: 0.03, cz: 0.004, w: FW }, { y: -0.18, rx: 0.05, rz: 0.024, w: FW }, { y: -0.225, rx: 0.028, rz: 0.012, w: FW }];
      if (CAS) for (const r of shoe) { r.rx *= 1.07; r.rz *= 1.12; if (r.y > 0.05) r.rz += 0.006; } // sneakers: roomier, a padded collar, a thick cupsole and no studs
      loft({ s: SL.cleat, seg: SG(12), m: shoeM, capTop: true, capBot: true }, shoe);
      loft({ s: SL.sole, seg: SG(10), m: mMul(mT(IDM, X, legY(CAS ? -1.07 : -1.074), -0.012), mRX(IDM, -HPI)), capTop: true, capBot: true }, shoe.map((r) => ({ y: r.y, rx: r.rx + (CAS ? 0.006 : 0.004), rz: CAS ? 0.016 : 0.008, cz: 0, w: FW })));
      if (!lod && !CAS) for (const [sx, sz] of [[-0.03, 0.17], [0.03, 0.17], [-0.035, 0.1], [0.035, 0.1], [0, 0.04], [-0.02, -0.05], [0.02, -0.05]]) tube({ s: SL.sole, w: FW }, [[X + sx, legY(-1.082), sz], [X + sx, legY(-1.1), sz]], 0.006, 4, (t) => 1 - 0.4 * t);
    }
    // ---- belt towel (hidden for players who do not carry one) ----
    if (gear) {
      const TW = [B.hips, B.hips, 1], tx = -0.13, pts = [];
      for (let i = 0; i <= 4; i++) pts.push({ y: 0.1 - i * 0.095, rx: 0.062 - 0.005 * i, rz: 0.005, cx: tx, cz: 0.19 * (0.85 + 0.15 * S.bulk) + 0.006 * i, w: TW, v: i / 4 });
      loft({ s: SL.towel, seg: SG(6), capBot: true, w: TW }, pts);
    }
    if (CAS) { // a schoolkid's head is big for his body: the head (face, ears, hair, hat) scaled 1.1 about the top of the neck
      for (let k = 0; k < nv; k++) { const o = k * VSTRIDE; if (V[o + 6] === B.head && V[o + 8] === 1 && V[o + 1] > 0.8) { V[o] *= HEADK; V[o + 1] = 0.8 + (V[o + 1] - 0.8) * HEADK; V[o + 2] *= HEADK; } }
    }
    return { v: new Float32Array(V), i: new Uint16Array(I), n: I.length, nv, vi0, vin, bind: BIND, sw: S.sw, ll: LL };
  }
  // =====================================================================================
  // Kit painting (module level so the avatar viewer, 09-avatar.js, paints the same uniform as the game):
  // the team kit texture (KIT layout in 06-body.js) and the woven fabric normal map
  // =====================================================================================
  function paintFabric() {
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
  function paintKit(C, abbr, teamName, refs, cas, size) { // size: the canvas side (the game paints 2048)
    const S0 = size || 2048, c = document.createElement('canvas'); c.width = c.height = S0; const g = c.getContext('2d');
    const S = S0, reg = (k) => { const r = KIT[k]; return { x: r[0] * S, y: r[1] * S, w: (r[2] - r[0]) * S, h: (r[3] - r[1]) * S }; };
    const box = (r, u0, u1, v0, v1, col) => { g.fillStyle = typeof col === 'string' ? col : css(col); g.fillRect(r.x + r.w * u0, r.y + r.h * v0, r.w * (u1 - u0) + 0.6, r.h * (v1 - v0) + 0.6); };
    if (cas) { // Metcalf: a plain T-shirt in the team colour (no numbers, stripes or logos): ribbed crew collar, side seams, hems
      let r = reg('torso'); box(r, 0, 1, 0, 1, C.jer); box(r, 0, 1, 0, 0.03, shade(C.jer, 0.92)); box(r, 0, 1, 0.965, 1, shade(C.jer, 0.9));
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (const u of [0.25, 0.75]) g.fillRect(r.x + r.w * u - 1.5, r.y + r.h * 0.12, 3, r.h * 0.88);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 6; i++) g.fillRect(r.x, r.y + r.h * (0.003 + i * 0.0045), r.w, 2);
      r = reg('sleeve'); box(r, 0, 1, 0, 1, C.jer); box(r, 0, 1, 0.9, 1, shade(C.jer, 0.88)); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(r.x, r.y + r.h * 0.1, r.w, 3);
      try { // cotton: matte all over
        const img = g.getImageData(0, 0, S, S), d = img.data;
        for (const k of ['torso', 'sleeve']) { const q = reg(k); for (let y = Math.round(q.y); y < Math.round(q.y + q.h); y++) for (let x = Math.round(q.x); x < Math.round(q.x + q.w); x++) d[(y * S + x) * 4 + 3] = 215; }
        g.putImageData(img, 0, 0);
      } catch (e) {}
      return c;
    }
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
  // =====================================================================================
  // Emotes: looping signature moves for the player avatars (09-avatar.js, the site's player pages). Each is { name, T (loop
  // seconds), pose(t) -> a pose (05-anim.js pb layout, ground-fitted), still (the time shown when motion is reduced) }.
  // Poses use the 05-anim conventions: limb X swings forward (arm raise, thigh lift), elbow flex positive, knee flex negative;
  // shoulder Z lifts the arm out to the side (R positive, L negative), hip Z spreads the legs the same way; spine X bends forward;
  // neck X negative looks up; root extras are hip lift, pitch (forward), roll, yaw.
  // Which player does which move is the site's table (emotes.js at the site root), keyed by player id.
  // =====================================================================================
  const EM_STAND = { hipL: [0.04, 0, -0.07], hipR: [0.04, 0, 0.07], knL: [-0.1], knR: [-0.1], shL: [0.1, 0, -0.18], shR: [0.1, 0, 0.18], elL: [0.35], elR: [0.35], haL: [0.1], haR: [0.1], spine: [0.04, 0, 0], neck: [-0.06, 0, 0] };
  const emM = (...os) => Object.assign({}, ...os);
  const emP = (o, y, p, r, w) => pb(emM(EM_STAND, o), y, p, r, w);
  const emG = (o, lift, p, r, w) => gfit(emP(o, 0, p, r, w), lift);
  const emS = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const emSeg = (t, a, b) => emS((t - a) / (b - a));
  // looping Catmull-Rom through key poses: keys [[t, pose], ...] with times in [0, T) (smooth motion through every key)
  function emCyc(t, T, keys) {
    const n = keys.length; t = ((t % T) + T) % T;
    let i = n - 1; for (let k = 0; k < n; k++) if (keys[k][0] > t) { i = k - 1; break; }
    if (i < 0) i = n - 1;
    const k1 = keys[i], k2 = keys[(i + 1) % n], k0 = keys[(i - 1 + n) % n], k3 = keys[(i + 2) % n];
    let t2 = k2[0]; if (t2 <= k1[0]) t2 += T; let tt = t; if (tt < k1[0]) tt += T;
    const u = (tt - k1[0]) / (t2 - k1[0]), u2 = u * u, u3 = u2 * u, out = newPose();
    for (let j = 0; j < PLEN; j++) { const p0 = k0[1][j], p1 = k1[1][j], p2 = k2[1][j], p3 = k3[1][j]; out[j] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); }
    return out;
  }
  // the same, ground-fitted every frame (keys hold unfitted poses; a lift curve can raise him)
  const emCycG = (t, T, keys, lift) => gfit(emCyc(t, T, keys), lift || 0);
  // both feet on the ground: bend the knee (and hip) of whichever leg reaches lower until the two feet's lowest points match
  function emPlant(q) {
    const lowF = (b, f) => { const m = b[f]; return Math.min(m[7] - 0.04 * m[5] + 0.2 * m[6], m[7] - 0.06 * m[5] - 0.08 * m[6]); };
    for (let it = 0; it < 5; it++) {
      const b = fk(q, 0, 0, 0, 0, 1), d = lowF(b, B.ftL) - lowF(b, B.ftR);
      if (Math.abs(d) < 0.005) break;
      const kn = d < 0 ? B.knL : B.knR, hp = d < 0 ? B.hipL : B.hipR, k = Math.abs(d) * 2.2;
      q[kn * 3] += k; q[hp * 3] -= k * 0.5; // raw (flipped) angles: more knee flex, a little more thigh lift
    }
    return q;
  }
  // a held key pose: the same pose twice
  const emHold = (a, b, q) => [[a, q], [b, q]];

  // ---- the backflip: load, drive the arms up, a tucked back somersault (one full turn about the hips), land in a crouch, stick it ----
  const BF = {
    stand: emP({}),
    load: emP({ hipL: [1.05, 0, -0.08], hipR: [1.05, 0, 0.08], knL: [-1.7], knR: [-1.7], ftL: [-0.6], ftR: [-0.6], spine: [0.5, 0, 0], neck: [-0.35, 0, 0], shL: [-0.85, 0, -0.15], shR: [-0.85, 0, 0.15], elL: [0.25], elR: [0.25] }),
    take: emP({ hipL: [-0.05, 0, -0.06], hipR: [-0.05, 0, 0.06], knL: [-0.05], knR: [-0.05], ftL: [0.55], ftR: [0.55], spine: [-0.15, 0, 0], neck: [-0.45, 0, 0], shL: [2.95, 0, -0.2], shR: [2.95, 0, 0.2], elL: [0.1], elR: [0.1] }, 0, -0.22),
    land: emP({ hipL: [1.15, 0, -0.14], hipR: [1.15, 0, 0.14], knL: [-1.75], knR: [-1.75], ftL: [-0.6], ftR: [-0.6], spine: [0.45, 0, 0], neck: [-0.4, 0, 0], shL: [1.2, 0, -0.65], shR: [1.2, 0, 0.65], elL: [0.35], elR: [0.35] }, 0, 0.15),
    stick: emP({ hipL: [0.05, 0, -0.14], hipR: [0.05, 0, 0.14], knL: [-0.12], knR: [-0.12], spine: [-0.12, 0, 0], neck: [-0.25, 0, 0], shL: [0.45, 0, -2.45], shR: [0.45, 0, 2.45], elL: [0.15], elR: [0.15], haL: [-0.3], haR: [-0.3] }),
  };
  const BF_T = 3.0, BF_T0 = 0.86, BF_T1 = 1.5; // takeoff and touchdown
  const BF_K = [[0, BF.stand], [0.32, BF.stand], [0.66, BF.load], [BF_T0, BF.take], [BF_T1, BF.land], [1.78, BF.land], [2.15, BF.stick], [2.55, BF.stick], [2.95, BF.stand]];
  function emBackflip(t) {
    if (t < BF_T0 || t > BF_T1) return gfit(kf(t, BF_K));
    const u = (t - BF_T0) / (BF_T1 - BF_T0);
    const a = gfit(lerpPose(BF.take, BF.take, 0)), b = gfit(lerpPose(BF.land, BF.land, 0));
    const q = lerpPose(a, b, emS(u)), tk = emS(u / 0.22) * (1 - emS((u - 0.72) / 0.24)); // the tuck: in fast, out before landing
    const tuck = pb({ hipL: [2.15, 0, -0.18], hipR: [2.15, 0, 0.18], knL: [-2.35], knR: [-2.35], ftL: [0.5], ftR: [0.5], spine: [0.55, 0, 0], neck: [0.25, 0, 0], shL: [1.05, 0, -0.35], shR: [1.05, 0, 0.35], elL: [1.25], elR: [1.25] });
    for (let i = 0; i < PN; i++) q[i] += (tuck[i] - q[i]) * tk;
    // one full turn backwards about the hips, quickest in the tuck; the hips fly up and come down on a parabola
    const s = u < 0.5 ? 0.5 * Math.pow(2 * u, 1.6) : 1 - 0.5 * Math.pow(2 - 2 * u, 1.6);
    q[PN + 1] = -0.22 + (-TAU + 0.15 + 0.22) * s;
    q[PN] = a[PN] + (b[PN] - a[PN]) * u + 0.95 * 4 * u * (1 - u);
    return q;
  }
  // ---- the jump spin: crouch, jump, a full turn in the air with the arms pulled in, land, arms up ----
  const JS = {
    load: emP({ hipL: [0.9, 0, -0.1], hipR: [0.9, 0, 0.1], knL: [-1.45], knR: [-1.45], ftL: [-0.55], ftR: [-0.55], spine: [0.4, 0.25, 0], neck: [-0.3, 0, 0], shL: [0.5, 0, -0.9], shR: [-0.5, 0, 0.6], elL: [0.9], elR: [0.6] }, 0, 0, 0, -0.35),
    take: emP({ hipL: [0.1, 0, -0.04], hipR: [0.1, 0, 0.04], knL: [-0.15], knR: [-0.15], ftL: [0.5], ftR: [0.5], spine: [-0.05, 0, 0], neck: [-0.2, 0, 0], shL: [1.0, 0, -0.25], shR: [1.0, 0, 0.25], elL: [2.2], elR: [2.2] }, 0, 0, 0, -0.1),
    air: pb({ hipL: [0.35, 0, -0.03], hipR: [0.55, 0, 0.03], knL: [-0.6], knR: [-0.9], ftL: [0.45], ftR: [0.45], spine: [0.0, 0, 0], neck: [-0.15, 0, 0], shL: [1.0, 0, -0.15], shR: [1.0, 0, 0.15], elL: [2.4], elR: [2.4] }),
    land: emP({ hipL: [0.95, 0, -0.16], hipR: [0.95, 0, 0.16], knL: [-1.45], knR: [-1.45], ftL: [-0.5], ftR: [-0.5], spine: [0.35, 0, 0], neck: [-0.3, 0, 0], shL: [0.9, 0, -0.9], shR: [0.9, 0, 0.9], elL: [0.4], elR: [0.4] }),
    up: emP({ hipL: [0.04, 0, -0.16], hipR: [0.04, 0, 0.16], spine: [-0.1, 0, 0], neck: [-0.3, 0, 0], shL: [0.4, 0, -2.6], shR: [0.4, 0, 2.6], elL: [0.2], elR: [0.2] }),
  };
  const JS_T = 2.8, JS_T0 = 0.75, JS_T1 = 1.3;
  const JS_K = [[0, BF.stand], [0.25, BF.stand], [0.58, JS.load], [JS_T0, JS.take], [JS_T1, JS.land], [1.55, JS.land], [1.9, JS.up], [2.35, JS.up], [2.75, BF.stand]];
  function emJumpSpin(t) {
    if (t < JS_T0 || t > JS_T1) return gfit(kf(t, JS_K));
    const u = (t - JS_T0) / (JS_T1 - JS_T0);
    const a = gfit(lerpPose(JS.take, JS.take, 0)), b = gfit(lerpPose(JS.land, JS.land, 0));
    const q = lerpPose(a, b, emS(u)), k = Math.sin(Math.PI * Math.min(1, u * 1.15));
    for (let i = 0; i < PN; i++) q[i] += (JS.air[i] - q[i]) * k;
    q[PN + 3] = -0.1 + (TAU + 0.1) * (u < 0.5 ? 0.5 * Math.pow(2 * u, 1.3) : 1 - 0.5 * Math.pow(2 - 2 * u, 1.3));
    q[PN] = a[PN] + (b[PN] - a[PN]) * u + 0.55 * 4 * u * (1 - u);
    q[PN + 3] = q[PN + 3] % TAU;
    return q;
  }

  // ---- the rest: keyframed loops ----
  const EM_HEIS = emP({ hipL: [1.55, 0, -0.1], knL: [-2.0], ftL: [0.35], hipR: [-0.05, 0, 0.1], knR: [-0.15], spine: [0.08, 0.28, 0], chest: [0, 0.1, 0], neck: [-0.1, -0.35, 0], shL: [1.45, 0, -0.45], elL: [0.05], haL: [-0.9], shR: [-0.16, -0.56, 0], elR: [1.93], haR: [0.3] }, 0, 0.05, 0, 1.15);
  const EM_FLEX1 = emP({ hipL: [0.06, 0, -0.2], hipR: [0.06, 0, 0.2], knL: [-0.1], knR: [-0.1], spine: [-0.1, 0, 0], neck: [-0.15, 0, 0], shL: [1.5, 0, -1.45], shR: [1.5, 0, 1.45], elL: [2.0], elR: [2.0], haL: [0.4], haR: [0.4] });
  const EM_FLEX2 = emP({ hipL: [0.3, 0, -0.22], hipR: [0.3, 0, 0.22], knL: [-0.45], knR: [-0.45], spine: [0.3, 0, 0], chest: [0.1, 0, 0], neck: [-0.35, 0, 0], shL: [0.27, 0.96, -0.16], shR: [0.27, -0.96, 0.16], elL: [1.41], elR: [1.41], haL: [0.6], haR: [0.6] });
  const EM_SAL0 = emP({ hipL: [0, 0, -0.03], hipR: [0, 0, 0.03], knL: [-0.02], knR: [-0.02], spine: [-0.06, 0, 0], neck: [-0.05, 0, 0], shL: [0.02, 0, -0.08], shR: [0.02, 0, 0.08], elL: [0.08], elR: [0.08], haL: [0], haR: [0] });
  const EM_SAL1 = emP({ hipL: [0, 0, -0.03], hipR: [0, 0, 0.03], knL: [-0.02], knR: [-0.02], spine: [-0.06, 0, 0], neck: [-0.05, 0, 0], shL: [0.02, 0, -0.08], elL: [0.08], haL: [0], shR: [1.54, -0.92, 0.83], elR: [1.94], haR: [-0.15] });
  const EM_HERO = (nod, look, br) => emP({ hipL: [0.02, 0, -0.24], hipR: [0.02, 0, 0.24], knL: [-0.06], knR: [-0.06], spine: [-0.14 + br, 0, 0], chest: [-0.05, 0, 0], neck: [nod, look, 0], shL: [-0.56, 0.72, -0.41], shR: [-0.56, -0.72, 0.41], elL: [1.04], elR: [1.04], haL: [0.3], haR: [0.3] });
  const EM_BOWD = emP({ hipL: [0.05, 0, -0.24], hipR: [0.05, 0, 0.24], knL: [-0.15], knR: [-0.1], spine: [-0.04, 0, 0.04], neck: [-0.25, -0.9, 0], shL: [1.12, 0.74, -1.65], elL: [0.14], haL: [0], shR: [0.99, -1.12, 2.23], elR: [2.2], haR: [0.3] }, 0, -0.03, 0, 0.35);
  const EM_BOWR = emP({ hipL: [0.05, 0, -0.24], hipR: [0.05, 0, 0.24], knL: [-0.15], knR: [-0.1], spine: [-0.06, 0, 0.06], neck: [-0.28, -0.9, 0], shL: [1.12, 0.74, -1.65], elL: [0.14], haL: [0], shR: [3.01, -0.14, 0.85], elR: [1.23], haR: [-0.4] }, 0, -0.05, 0, 0.35);

  const EMOTES = {
    // Xavier Davenport's dance, motion-captured from his own video (05-anim.js xavPose)
    xavdance: { name: 'Signature Dance', T: XAV_T, pose: (t) => xavPose(t), still: 0.35 },
    backflip: { name: 'Backflip', T: BF_T, pose: emBackflip, still: 1.18 },
    jumpspin: { name: '360 Jump Spin', T: JS_T, pose: emJumpSpin, still: 1.02 },
    // a heel-tap shuffle: hop, tap one heel out in front, hop, the other; arms swinging across like he is rowing
    heelshuffle: { name: 'Heel-Tap Shuffle', T: 0.96, still: 0.24, pose(t) {
      const ph = (t / 0.96) * TAU, s = Math.sin(ph), c = Math.cos(ph), L = Math.max(0, s), R = Math.max(0, -s);
      return gfit(emP({ hipL: [0.3 + 0.35 * L - 0.15 * R, 0, -0.1], knL: [-0.55 + 0.45 * L], ftL: [-0.2 - 0.25 * L + 0.2 * R], hipR: [0.3 + 0.35 * R - 0.15 * L, 0, 0.1], knR: [-0.55 + 0.45 * R], ftR: [-0.2 - 0.25 * R + 0.2 * L],
        spine: [0.28, 0.18 * s, 0], neck: [-0.25, -0.12 * s, 0], shL: [0.55 - 0.65 * s, 0, -0.35], shR: [0.55 + 0.65 * s, 0, 0.35], elL: [1.5 + 0.2 * c], elR: [1.5 - 0.2 * c], haL: [0.4], haR: [0.4] }, 0, 0.06, 0.04 * s), 0.06 * Math.abs(Math.sin(ph)));
    } },
    heisman: { name: 'Stiff-Arm Pose', T: 3.4, still: 1.6, pose: (t) => emCycG(t, 3.4, [[0, BF.stand], [0.35, emP({ hipL: [0.6, 0, -0.1], knL: [-0.9], spine: [0.15, 0.1, 0], shL: [0.6, 0, -0.3], shR: [0.4, 0, 0.2], elR: [1.6] }, 0, 0, 0, 0.6)], [0.75, EM_HEIS],
      [1.7, pb(emM(EM_STAND, { hipL: [1.6, 0, -0.1], knL: [-2.05], ftL: [0.35], hipR: [-0.05, 0, 0.1], knR: [-0.12], spine: [0.06, 0.3, 0], chest: [0, 0.1, 0], neck: [-0.12, -0.35, 0], shL: [1.5, 0, -0.45], elL: [0.03], haL: [-0.9], shR: [-0.16, -0.56, 0], elR: [1.93], haR: [0.3] }), 0, 0.04, 0, 1.15)],
      [2.55, EM_HEIS], [2.95, emP({ shR: [0.3, 0, 0.2], elR: [1.0] }, 0, 0, 0, 0.4)]]) },
    flex: { name: 'Double Flex', T: 3.6, still: 0.9, pose: (t) => emCycG(t, 3.6, [[0, BF.stand], [0.45, EM_FLEX1], [0.8, emP({ hipL: [0.06, 0, -0.2], hipR: [0.06, 0, 0.2], spine: [-0.14, 0, 0], neck: [-0.2, 0, 0], shL: [1.55, 0, -1.6], shR: [1.55, 0, 1.6], elL: [2.3], elR: [2.3], haL: [0.5], haR: [0.5] })], [1.15, EM_FLEX1],
      [1.75, EM_FLEX2], [2.15, emP({ hipL: [0.32, 0, -0.22], hipR: [0.32, 0, 0.22], knL: [-0.5], knR: [-0.5], spine: [0.38, 0, 0], neck: [-0.45, 0, 0], shL: [0.3, 0.96, -0.1], shR: [0.3, -0.96, 0.1], elL: [1.55], elR: [1.55], haL: [0.6], haR: [0.6] })], [2.55, EM_FLEX2], [3.1, BF.stand]]) },
    // the robot: stiff, popping from shape to shape and freezing in between
    robot: { name: 'The Robot', T: 4.2, still: 0.9, pose(t) {
      const K = [
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], shL: [0, 0, -0.1], shR: [0, 0, 0.1], elL: [1.57], elR: [1.57], haL: [0], haR: [0] },
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], shL: [0, 0, -0.1], shR: [1.5, 0, 1.5], elL: [1.57], elR: [1.57], haL: [0], haR: [0] },
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], shL: [1.5, 0, -1.5], shR: [1.5, 0, 1.5], elL: [1.57], elR: [1.57], haL: [0], haR: [0], neck: [0, 0.6, 0] },
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], shL: [1.57, 0, -0.05], shR: [1.57, 0, 0.05], elL: [0], elR: [0], haL: [0], haR: [0], neck: [0, -0.6, 0] },
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], spine: [0, 0.6, 0], shL: [1.57, 0, -0.05], shR: [0, 0, 0.1], elL: [1.57], elR: [1.57], haL: [0], haR: [0], neck: [0, -0.5, 0] },
        { hipL: [0.15, 0, -0.12], hipR: [0.15, 0, 0.12], knL: [-0.3], knR: [-0.3], spine: [0.45, 0, 0], neck: [-0.2, 0, 0], shL: [0.3, 0, -0.1], shR: [0.3, 0, 0.1], elL: [1.57], elR: [1.57], haL: [0], haR: [0] },
      ];
      const n = K.length, seg = 4.2 / n, i = Math.floor(t / seg) % n, u = (t - i * seg) / seg, k = emS(Math.min(1, u / 0.18));
      const a = emP(K[(i + n - 1) % n]), b = emP(K[i]), q = lerpPose(a, b, k);
      q[PN + 3] = 0.004 * Math.sin(t * 90) * (k < 1 && k > 0 ? 1 : 0); // a buzz as each joint locks in
      return gfit(q, 0.012 * Math.max(0, 1 - Math.abs(u - 0.2) * 8));
    } },
    shimmy: { name: 'Shoulder Shimmy', T: 2.4, still: 0.6, pose(t) {
      const ph = (t / 2.4) * TAU, f = Math.sin(t * 26), sw = Math.sin(ph), dn = Math.abs(Math.sin(ph * 2));
      return gfit(emP({ hipL: [0.4 + 0.15 * dn, 0, -0.18], hipR: [0.4 + 0.15 * dn, 0, 0.18], knL: [-0.75 - 0.3 * dn], knR: [-0.75 - 0.3 * dn], ftL: [-0.35 - 0.15 * dn], ftR: [-0.35 - 0.15 * dn],
        spine: [0.3, 0.12 * sw, 0.12 * sw], chest: [0, 0.2 * f, 0], neck: [-0.35, -0.15 * sw, -0.1 * sw], shL: [0.45 + 0.28 * f, 0, -0.6], shR: [0.45 - 0.28 * f, 0, 0.6], elL: [1.3], elR: [1.3], haL: [0.3], haR: [0.3] }, 0, 0.1, 0.08 * sw));
    } },
    // the sprinkler: one hand behind the head, the other arm ticking across in steps and sweeping back
    sprinkler: { name: 'The Sprinkler', T: 2.6, still: 0.7, pose(t) {
      const ticks = 6, tA = 1.8; let a;
      if (t < tA) { const i = Math.floor(t / (tA / ticks)), u = (t - i * (tA / ticks)) / (tA / ticks); a = (i + emS(Math.min(1, u / 0.3))) / ticks; } else a = 1 - emS((t - tA) / (2.6 - tA));
      const tick = t < tA ? Math.max(0, 1 - ((t % (tA / ticks)) / (tA / ticks)) * 5) : 0;
      return gfit(emP({ hipL: [0.55, 0, -0.12], knL: [-0.75], ftL: [-0.2], hipR: [0.1, 0, 0.16], knR: [-0.45], ftR: [-0.3], spine: [0.2, -0.45 + 0.9 * a, 0], neck: [-0.2, 0.3 - 0.6 * a, 0],
        shL: [-2.47, 0.95, 0.19], elL: [1.7], haL: [0.4], shR: [1.45, 0, -0.55 + 1.9 * a], elR: [0.15], haR: [0] }, 0, 0.05, 0, 0.05), 0.015 * tick);
    } },
    // a moon glide: one foot flat and sliding back while the other rides on its toes; the two swap
    moonglide: { name: 'Moon Glide', T: 1.7, still: 0.4, pose(t) {
      const ph = (t / 1.7) * TAU, s = Math.sin(ph), c = Math.cos(ph), A = 0.5 + 0.5 * s, Bv = 1 - A;
      const hL = 0.3 - 0.65 * Bv + 0.1 * A, kL = -0.05 - 0.95 * A, hR = 0.3 - 0.65 * A + 0.1 * Bv, kR = -0.05 - 0.95 * Bv; // the flat foot slides back, the other rides its toes
      return gfit(emPlant(emP({ hipL: [hL, 0, -0.06], knL: [kL], ftL: [hL + kL + 1.1 * A], hipR: [hR, 0, 0.06], knR: [kR], ftR: [hR + kR + 1.1 * Bv],
        spine: [0.04, 0.12 * c, 0], neck: [-0.1, -0.35, 0], shL: [0.05 - 0.3 * c, 0, -0.15], shR: [0.05 + 0.3 * c, 0, 0.15], elL: [0.45], elR: [0.45], haL: [0.3], haR: [0.3] }, 0, -0.04, 0, 1.2 + 0.06 * c)));
    } },
    spike: { name: 'Spike and Point', T: 3.0, still: 1.7, pose: (t) => emCycG(t, 3.0, [[0, BF.stand], [0.45, emP({ hipL: [0.75, 0, -0.1], knL: [-1.0], hipR: [0, 0, 0.1], spine: [-0.18, 0, 0], neck: [-0.3, 0, 0], shR: [2.7, 0, 0.35], elR: [0.5], shL: [0.6, 0, -0.5], elL: [0.8] })],
      [0.66, emP({ hipL: [0.95, 0, -0.14], hipR: [0.8, 0, 0.14], knL: [-1.4], knR: [-1.3], ftL: [-0.45], ftR: [-0.5], spine: [0.65, 0, 0], neck: [-0.45, 0, 0], shR: [-0.35, 0, 0.3], elR: [0.15], shL: [0.4, 0, -0.7], elL: [0.6] })],
      [0.95, emP({ hipL: [0.8, 0, -0.14], hipR: [0.7, 0, 0.14], knL: [-1.2], knR: [-1.1], ftL: [-0.4], ftR: [-0.4], spine: [0.55, 0, 0], neck: [-0.4, 0, 0], shR: [-0.25, 0, 0.35], elR: [0.3], shL: [0.4, 0, -0.7], elL: [0.6] })],
      [1.4, emP({ spine: [-0.15, 0, 0], neck: [-0.6, 0, 0], shL: [2.9, 0, -0.3], shR: [2.9, 0, 0.3], elL: [0.05], elR: [0.05], haL: [-0.2], haR: [-0.2] })],
      [1.75, emP({ spine: [-0.12, 0, 0], neck: [-0.65, 0, 0], shL: [2.75, 0, -0.35], shR: [2.75, 0, 0.35], elL: [0.15], elR: [0.15] })], [2.1, emP({ spine: [-0.15, 0, 0], neck: [-0.6, 0, 0], shL: [2.9, 0, -0.3], shR: [2.9, 0, 0.3], elL: [0.05], elR: [0.05] })],
      [2.5, BF.stand]]) },
    salute: { name: 'Salute', T: 3.4, still: 1.5, pose: (t) => emCycG(t, 3.4, [[0, BF.stand], [0.4, EM_SAL0], [0.6, EM_SAL0], [0.85, EM_SAL1], ...emHold(1.2, 2.3, EM_SAL1), [2.55, EM_SAL0], [2.85, EM_SAL0], [3.15, BF.stand]]) },
    // shadow boxing: bouncing on his toes behind his guard, jab, jab, cross
    boxer: { name: 'Shadow Boxer', T: 1.8, still: 1.1, pose(t) {
      const bo = Math.abs(Math.sin((t / 1.8) * TAU * 3)), j1 = Math.sin(Math.PI * clamp((t - 0.2) / 0.28, 0, 1)), j2 = Math.sin(Math.PI * clamp((t - 0.6) / 0.28, 0, 1)), cr = Math.sin(Math.PI * clamp((t - 1.05) / 0.4, 0, 1)), jab = Math.max(j1, j2);
      return gfit(emP({ hipL: [0.42, 0, -0.14], knL: [-0.55], ftL: [-0.15], hipR: [-0.05, 0, 0.16], knR: [-0.5], ftR: [0.15], spine: [0.2, -0.25 + 0.55 * cr - 0.15 * jab, 0], neck: [-0.15, 0.25 - 0.45 * cr, 0],
        shL: [0.62 + 1.2 * jab, 0.38 - 0.58 * jab, 0.09 + 0.16 * jab], elL: [2.51 - 2.33 * jab], haL: [0.2], shR: [0.57 + 0.87 * cr, -0.41 + 1.0 * cr, -0.11 - 0.69 * cr], elR: [2.56 - 2.54 * cr], haR: [0.2] }, 0, 0.08, 0, 0.3), 0.05 * bo);
    } },
    hero: { name: 'Hands-on-Hips Nod', T: 3.2, still: 0.5, pose(t) {
      const nod = 0.3 * Math.max(Math.sin(Math.PI * clamp((t - 0.9) / 0.35, 0, 1)), Math.sin(Math.PI * clamp((t - 1.35) / 0.35, 0, 1))), look = 0.4 * Math.sin((t / 3.2) * TAU), br = 0.03 * Math.sin((t / 3.2) * TAU * 2);
      return gfit(EM_HERO(-0.05 + nod, look, br));
    } },
    qbclap: { name: 'QB Clap', T: 2.0, still: 1.2, pose: (t) => emCycG(t, 2.0, [[0, emP({ spine: [0.15, 0, 0], shL: [0.24, 0.31, -0.38], shR: [0.24, -0.31, 0.38], elL: [1.87], elR: [1.87], haL: [0.3], haR: [0.3], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.45], knR: [-0.45] })],
      [0.2, emP({ spine: [0.15, 0, 0], shL: [0.62, 0.77, 0.14], shR: [0.62, -0.77, -0.14], elL: [1.54], elR: [1.54], haL: [0.2], haR: [0.2], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.45], knR: [-0.45] })],
      [0.4, emP({ spine: [0.15, 0, 0], shL: [0.24, 0.31, -0.38], shR: [0.24, -0.31, 0.38], elL: [1.87], elR: [1.87], haL: [0.3], haR: [0.3], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.45], knR: [-0.45] })],
      [0.6, emP({ spine: [0.15, 0, 0], shL: [0.62, 0.77, 0.14], shR: [0.62, -0.77, -0.14], elL: [1.54], elR: [1.54], haL: [0.2], haR: [0.2], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.45], knR: [-0.45] })],
      [1.0, emP({ spine: [0.3, -0.25, 0], neck: [-0.4, 0.2, 0], shR: [1.55, 0, 0.1], elR: [0.03], haR: [-0.1], shL: [0.5, 0, -0.4], elL: [1.9], hipL: [0.55, 0, -0.15], knL: [-0.7], hipR: [0.1, 0, 0.15], knR: [-0.35] })],
      ...emHold(1.3, 1.55, emP({ spine: [0.3, -0.25, 0], neck: [-0.4, 0.2, 0], shR: [1.6, 0, 0.1], elR: [0.03], haR: [-0.1], shL: [0.5, 0, -0.4], elL: [1.9], hipL: [0.55, 0, -0.15], knL: [-0.7], hipR: [0.1, 0, 0.15], knR: [-0.35] }))]) },
    lasso: { name: 'Lasso Throw', T: 3.2, still: 0.5, pose(t) {
      const tA = 1.7;
      if (t < tA) { const ph = t * TAU * 1.6, sw = Math.sin((t / tA) * TAU);
        return gfit(emP({ hipL: [0.3, 0, -0.18], hipR: [0.15, 0, 0.18], knL: [-0.45], knR: [-0.35], spine: [0.05, 0.1 * sw, 0.06 * sw], neck: [-0.45, 0, 0], shR: [2.55 + 0.25 * Math.cos(ph), 0.3, 0.55 + 0.35 * Math.sin(ph)], elR: [0.6 + 0.2 * Math.sin(ph)], haR: [0.2], shL: [-0.2, -0.5, -0.65], elL: [1.8], haL: [0.4] }, 0, 0, 0.05 * sw)); }
      return emCycG(t, 3.2, [[tA - 0.01, emP({ hipL: [0.3, 0, -0.18], hipR: [0.15, 0, 0.18], knL: [-0.45], knR: [-0.35], neck: [-0.45, 0, 0], shR: [2.8, 0.3, 0.55], elR: [0.6], haR: [0.2], shL: [-0.2, -0.5, -0.65], elL: [1.8], haL: [0.4] })],
        [1.95, emP({ hipL: [0.55, 0, -0.18], hipR: [-0.1, 0, 0.18], knL: [-0.6], knR: [-0.2], spine: [0.35, 0, 0], neck: [-0.4, 0, 0], shR: [1.45, 0, 0.1], elR: [0.05], haR: [0], shL: [0.4, 0, -0.5], elL: [0.9] })],
        [2.25, emP({ hipL: [0.35, 0, -0.18], hipR: [-0.05, 0, 0.18], knL: [-0.5], knR: [-0.3], spine: [0.1, 0, 0], neck: [-0.2, 0, 0], shR: [0.9, 0, 0.25], elR: [1.6], shL: [1.4, 0, -0.2], elL: [0.4] })],
        [2.55, emP({ hipL: [0.35, 0, -0.18], hipR: [-0.05, 0, 0.18], knL: [-0.5], knR: [-0.3], spine: [0.1, 0, 0], neck: [-0.2, 0, 0], shR: [1.4, 0, 0.2], elR: [0.4], shL: [0.9, 0, -0.25], elL: [1.6] })],
        [2.85, emP({ hipL: [0.3, 0, -0.18], hipR: [0.05, 0, 0.18], knL: [-0.45], knR: [-0.35], neck: [-0.3, 0, 0], shR: [0.9, 0, 0.25], elR: [1.6], shL: [1.4, 0, -0.2], elL: [0.4] })],
        [3.19, emP({ hipL: [0.3, 0, -0.18], hipR: [0.15, 0, 0.18], knL: [-0.45], knR: [-0.35], neck: [-0.45, 0, 0], shR: [2.8, 0.3, 0.55], elR: [0.6], haR: [0.2], shL: [-0.2, -0.5, -0.65], elL: [1.8], haL: [0.4] })]]);
    } },
    bow: { name: 'Bow and Arrow', T: 3.2, still: 1.2, pose: (t) => emCycG(t, 3.2, [[0, BF.stand], [0.35, emP({ neck: [-0.1, -0.7, 0], shL: [0.4, 0, -1.2], elL: [0.4], shR: [0.6, -0.5, 0.6], elR: [1.9] }, 0, 0, 0, 0.25)],
      [0.75, EM_BOWD], [1.5, (() => { const q = lerpPose(EM_BOWD, EM_BOWD, 0); q[B.elR * 3] -= 0.12; return q; })()], [1.62, EM_BOWR], [2.3, EM_BOWR], [2.8, emP({ neck: [-0.1, -0.4, 0] }, 0, 0, 0, 0.15)]]) },
    // the airplane: arms out like wings, banking left and right as he turns a full circle on the spot
    airplane: { name: 'Airplane', T: 4.0, still: 0.6, pose(t) {
      const ph = (t / 4.0) * TAU, bank = Math.sin(ph * 2), st = Math.sin(ph * 6);
      return gfit(emP({ hipL: [0.35 + 0.25 * Math.max(0, st), 0, -0.1], hipR: [0.35 + 0.25 * Math.max(0, -st), 0, 0.1], knL: [-0.55 - 0.35 * Math.max(0, st)], knR: [-0.55 - 0.35 * Math.max(0, -st)], ftL: [-0.15], ftR: [-0.15],
        spine: [0.32, 0, 0.12 * bank], neck: [-0.45, 0, -0.1 * bank], shL: [0.25, 0, -1.55 + 0.2 * bank], shR: [0.25, 0, 1.55 + 0.2 * bank], elL: [0.08], elR: [0.08], haL: [0], haR: [0] }, 0, 0.12, 0.3 * bank, ph), 0.02 * Math.abs(st));
    } },
    raiseroof: { name: 'Raise the Roof', T: 1.1, still: 0.3, pose(t) {
      const ph = (t / 1.1) * TAU * 2, s = 0.5 + 0.5 * Math.sin(ph), bo = Math.abs(Math.sin(ph / 2 + 0.5));
      return gfit(emP({ hipL: [0.3 + 0.2 * (1 - s), 0, -0.18], hipR: [0.3 + 0.2 * (1 - s), 0, 0.18], knL: [-0.5 - 0.35 * (1 - s)], knR: [-0.5 - 0.35 * (1 - s)], ftL: [-0.2 - 0.15 * (1 - s)], ftR: [-0.2 - 0.15 * (1 - s)], spine: [0.08, 0, 0], neck: [-0.25 - 0.2 * s, 0, 0],
        shL: [0.87 + 0.48 * s, -0.22 + 1.32 * s, -0.97 - 0.74 * s], shR: [0.87 + 0.48 * s, 0.22 - 1.32 * s, 0.97 + 0.74 * s], elL: [2.67 - 2.08 * s], elR: [2.67 - 2.08 * s], haL: [-0.9], haR: [-0.9] }, 0, 0, 0.06 * Math.sin(ph / 2)), 0.03 * bo);
    } },
    kick: { name: 'Karate Kick', T: 2.6, still: 0.82, pose: (t) => emCycG(t, 2.6, [[0, emP({ hipL: [0.3, 0, -0.15], hipR: [0.15, 0, 0.15], knL: [-0.5], knR: [-0.4], shL: [0.56, 0.46, 0.13], shR: [0.38, -0.42, -0.07], elL: [1.91], elR: [2.04] }, 0, 0, 0, 0.3)],
      [0.45, emP({ hipL: [0.15, 0, -0.1], knL: [-0.3], hipR: [1.7, 0, 0.1], knR: [-2.1], ftR: [-0.3], spine: [-0.05, 0, 0], shL: [0.56, 0.46, 0.13], shR: [0.38, -0.42, -0.07], elL: [1.91], elR: [2.04] }, 0, 0, 0, 0.3)],
      [0.7, emP({ hipL: [0.1, 0, -0.1], knL: [-0.2], hipR: [1.85, 0, 0.1], knR: [-0.1], ftR: [-0.5], spine: [-0.2, 0, 0], neck: [0.1, 0, 0], shL: [0.9, 0, -0.5], shR: [-0.3, 0, 0.6], elL: [1.6], elR: [1.5] }, 0, -0.1, 0, 0.3)],
      [0.95, emP({ hipL: [0.15, 0, -0.1], knL: [-0.3], hipR: [1.7, 0, 0.1], knR: [-2.1], ftR: [-0.3], spine: [-0.05, 0, 0], shL: [0.56, 0.46, 0.13], shR: [0.38, -0.42, -0.07], elL: [1.91], elR: [2.04] }, 0, 0, 0, 0.3)],
      [1.3, emP({ hipL: [0.3, 0, -0.15], hipR: [0.15, 0, 0.15], knL: [-0.5], knR: [-0.4], shL: [0.56, 0.46, 0.13], shR: [0.38, -0.42, -0.07], elL: [1.91], elR: [2.04] }, 0, 0, 0, 0.3)],
      [1.75, emP({ hipL: [0.15, 0, -0.08], hipR: [0.15, 0, 0.08], spine: [0.55, 0, 0], neck: [0.15, 0, 0], shL: [1.0, 0.3, 0.1], shR: [1.0, -0.3, -0.1], elL: [1.9], elR: [1.9] })],
      [2.2, emP({ hipL: [0.15, 0, -0.08], hipR: [0.15, 0, 0.08], spine: [0.05, 0, 0], shL: [1.0, 0.3, 0.1], shR: [1.0, -0.3, -0.1], elL: [1.9], elR: [1.9] })]]) },
    // can't hear you: a hand cupped to his ear leaning towards the crowd, waving them on, then fist pumps
    cupear: { name: "Can't Hear You", T: 3.0, still: 0.8, pose(t) {
      if (t < 1.6) { const w = Math.sin(t * 9), e = emS(t / 0.35) * (1 - emS((t - 1.35) / 0.25));
        const a = emP({}), b = emP({ hipL: [0.15, 0, -0.22], hipR: [0.15, 0, 0.22], knL: [-0.25], knR: [-0.2], spine: [0.1, -0.2, -0.3], neck: [-0.1, 0.4, -0.25], shR: [1.86, -0.79, 1.14], elR: [2.51], haR: [-0.5], shL: [1.3, 0, -0.5], elL: [1.2 + 0.6 * w], haL: [-0.4] }, 0, 0, -0.1);
        return gfit(lerpPose(a, b, e)); }
      const u = (t - 1.6) / 1.4, p = Math.max(0, Math.sin(u * TAU * 2.5)), e = emS(u / 0.15) * (1 - emS((u - 0.8) / 0.2));
      const a = emP({}), b = emP({ hipL: [0.35 + 0.2 * p, 0, -0.2], hipR: [0.35 + 0.2 * p, 0, 0.2], knL: [-0.6 - 0.25 * p], knR: [-0.6 - 0.25 * p], spine: [0.12, 0, 0], neck: [-0.5, 0, 0], shL: [2.1 + 0.6 * p, 0, -0.35], shR: [2.1 + 0.6 * p, 0, 0.35], elL: [1.6 - 1.2 * p], elR: [1.6 - 1.2 * p] });
      return gfit(lerpPose(a, b, e), 0.04 * p * e);
    } },
  };
  const EMOTE_IDS = Object.keys(EMOTES);
  // =====================================================================================
  // Avatar viewer: window.MFLBlitz.avatar(el, opts) draws ONE player, full body, in his team's uniform with the helmet off and his
  // scanned head (the drawn face and hair when he has no scan), on a transparent canvas (the page paints the backdrop), looping his
  // emote (08-emotes.js) with the whole move in frame. No field, stadium, crowd or game: one skinned mesh, his head and a contact
  // shadow (three draws a frame). It only renders while it is on screen and the tab is visible, and caps the pixel ratio.
  // opts: player { id, name, num, pos, look { skin, build, height, cleats, sleeves }, hgt, wgt }, team { name, abbr, color, color2 },
  //   emote (an EMOTES id), interactive (drag / touch to spin, pinch or wheel to zoom, double tap to reset), place (0..1: where
  //   across the canvas he stands, default the middle), yaw (his turn towards the camera, radians), fps (a frame cap), heads (the
  //   scanned heads' folder), onReady(ctrl), onError(reason).
  // Returns { ok, canvas, destroy, reset, setEmote, emote, emoteName, scanned, view, setView, pause, play, frame(t), frames } (frame(t) draws
  // the emote at time t and stops the clock: tests; frames counts the frames drawn).
  // =====================================================================================
  const AV_HEADS = '/static/arcade/heads/';
  const avHeadIdx = {}, avHeadData = {}; // folder -> Promise of { name key -> entry }; slug -> Promise of the unpacked head (shared by the banner and the viewer)
  const avKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const avHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function avHeadEntry(base, name) {
    if (!avHeadIdx[base]) avHeadIdx[base] = fetch(base + 'index.json').then((r) => (r.ok ? r.json() : null)).then((j) => { const by = {}; if (j && j.heads) for (const n in j.heads) by[avKey(n)] = j.heads[n]; return by; }).catch(() => ({}));
    return avHeadIdx[base].then((by) => by[avKey(name)] || null);
  }
  // a scanned head (.bin from tools/heads.js) in the athlete vertex layout: pos3 nrm3 bone2 weight slot uv2 ao (as 22-heads.js)
  function avUnpackHead(e, ab) {
    const dv = new DataView(ab);
    if (dv.getUint32(0, true) !== 0x3144484d) throw new Error('bad head file');
    const nv = dv.getUint32(4, true), n0 = dv.getUint32(8, true), n1 = dv.getUint32(12, true), q = dv.getFloat32(16, true);
    const p4 = (n) => (n + 3) & ~3, oP = 20, oN = oP + p4(nv * 6), oT = oN + nv * 4, oI = oT + nv * 4;
    const P = new Int16Array(ab, oP, nv * 3), N = new Int8Array(ab, oN, nv * 4), T = new Uint16Array(ab, oT, nv * 2), a = e.anchor || [0, 0.831, 0];
    const V = new Float32Array(nv * VSTRIDE);
    for (let i = 0; i < nv; i++) {
      const o = i * VSTRIDE;
      V[o] = a[0] + P[i * 3] * q; V[o + 1] = a[1] + P[i * 3 + 1] * q; V[o + 2] = a[2] + P[i * 3 + 2] * q;
      V[o + 3] = N[i * 4] / 127; V[o + 4] = N[i * 4 + 1] / 127; V[o + 5] = N[i * 4 + 2] / 127;
      V[o + 6] = B.head; V[o + 7] = B.neck; V[o + 8] = 1; V[o + 9] = 25; V[o + 10] = T[i * 2] / 65535; V[o + 11] = T[i * 2 + 1] / 65535; V[o + 12] = 1;
    }
    return { v: V, i: new Uint16Array(ab.slice(oI, oI + n0 * 2)), n: n0 };
  }
  const AV_SKIN = ['#f3cfae', '#dcaa83', '#b98056', '#8a5535', '#5a361f'];
  const AV_CLEATS = { black: '#111318', white: '#f2f4f7', gold: '#ffc21a', red: '#d81f2a' };
  const AV_HAIRC = ['#151110', '#2c1d14', '#4f3220', '#7a5535', '#b8935a'];
  // a site position -> the engine's body spec
  function avPos(s) {
    s = String(s || '').toUpperCase();
    if (/\bQB\b|QUARTER/.test(s)) return 'QB'; if (/\bRB\b|RUNNING|HALF/.test(s)) return 'RB'; if (/\bTE\b|TIGHT/.test(s)) return 'TE';
    if (/\bOL\b|O-LINE|OFFENSIVE LINE|CENTER|GUARD|TACKLE/.test(s)) return 'OL'; if (/\bDL\b|DEFENSIVE LINE|D-LINE/.test(s)) return 'DL';
    if (/\bLB\b|LINEBACK/.test(s)) return 'LB'; if (/\bCB\b|\bDB\b|CORNER/.test(s)) return 'CB'; if (/\bS\b|SAFETY/.test(s)) return 'S';
    if (/\bK\b|KICK/.test(s)) return 'K';
    return 'WR';
  }
  // the emote's extent in body space (yards, standing at the origin facing +Z at height scale 1): every joint over the loop,
  // padded by the body's own thickness and the top of the head
  const avBoxes = {};
  function avBox(id) {
    if (avBoxes[id]) return avBoxes[id];
    const E = EMOTES[id], n = 72, bx = [9, -9, 9, -9, 9, -9], pts2 = [];
    for (let k = 0; k < n; k++) {
      const q = E.pose((k / n) * E.T), b = fk(q, 0, 0, 0, 0, 1);
      for (let i = 0; i < NB; i++) {
        const m = b[i], pts = [[m[3], m[7], m[11]]];
        if (i === B.head) pts.push(mPt(m, 0, 0.3, 0));
        if (i === B.haL || i === B.haR) pts.push(mPt(m, 0, -0.12, 0));
        if (i === B.ftL || i === B.ftR) pts.push(mPt(m, 0, -0.05, 0.2));
        if (k % 2 === 0) for (const p of pts) pts2.push(p[0], p[2]);
        for (const p of pts) { bx[0] = Math.min(bx[0], p[0]); bx[1] = Math.max(bx[1], p[0]); bx[2] = Math.min(bx[2], p[1]); bx[3] = Math.max(bx[3], p[1]); bx[4] = Math.min(bx[4], p[2]); bx[5] = Math.max(bx[5], p[2]); }
      }
    }
    const pad = 0.16;
    const r = [bx[0] - pad, bx[1] + pad, Math.max(0, bx[2] - 0.05), bx[3] + 0.12, bx[4] - pad, bx[5] + pad];
    r.xz = new Float32Array(pts2); r.pad = pad; r.yaw = {}; // the sampled points across the ground, for a tight fit from one side
    return (avBoxes[id] = r);
  }
  // GLSL: the athlete shader with a tone map at the end (the game tone maps in its post pass; here he draws straight to the page)
  const AV_TONE = 'uniform float uExpo;vec3 avTone(vec3 c){c*=uExpo;c=clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);return pow(c,vec3(1.0/2.2));}\n';
  function avSkinFS() {
    let fs = FS_SKIN.replace('#LIB#', SH_LIB);
    const a = 'void main(){int s=int(vS+0.5);', z = 'gl_FragColor=vec4(fogIt(col),alpha);}';
    if (fs.indexOf(a) < 0 || fs.indexOf(z) < 0) throw new Error('avatar shader hooks');
    return fs.replace(a, AV_TONE + a).replace(z, 'gl_FragColor=vec4(avTone(col),alpha);}');
  }
  const AV_VS_SH = 'attribute vec2 aP;uniform mat4 uVP;uniform vec4 uC;varying vec2 vQ;void main(){vQ=aP;gl_Position=uVP*vec4(uC.x+aP.x*uC.z,0.002,uC.y+aP.y*uC.w,1.0);}';
  const AV_FS_SH = 'precision mediump float;uniform float uK;varying vec2 vQ;void main(){float r=length(vQ);float a=uK*pow(1.0-smoothstep(0.0,1.0,r),1.6);gl_FragColor=vec4(0.0,0.0,0.0,a);}';

  function avatarMount(el, opts) {
    opts = opts || {};
    const pl = opts.player || {}, tm = opts.team || {};
    const fail = (why) => { try { if (opts.onError) opts.onError(why); } catch (e) {} };
    const noop = { destroy() {}, reset() {}, setEmote() {}, pause() {}, play() {}, frame() {}, emote: null, ok: false };
    if (!el) return noop;
    let emote = EMOTES[opts.emote] ? opts.emote : EMOTE_IDS[avHash(String(pl.id || pl.name || '')) % EMOTE_IDS.length];
    const cv = document.createElement('canvas');
    cv.className = 'bz-av'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', (pl.name ? pl.name + ': ' : '') + EMOTES[emote].name);
    cv.style.cssText = 'display:block;width:100%;height:100%;' + (opts.interactive ? 'touch-action:none;cursor:grab;' : 'pointer-events:none;');
    let gl = null, GL2 = false;
    const ca = { alpha: true, antialias: true, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.keep, powerPreference: 'low-power' };
    try { gl = cv.getContext('webgl2', ca); GL2 = !!gl; } catch (e) { gl = null; }
    if (!gl) { try { gl = cv.getContext('webgl', ca) || cv.getContext('experimental-webgl', ca); } catch (e) { gl = null; } }
    if (!gl) { fail('nogl'); return noop; }
    el.appendChild(cv);

    // ---------- who he is: body, colours, head ----------
    const posK = avPos(pl.pos), base = BODY[posK] || BODY.WR, L0 = pl.look && typeof pl.look === 'object' ? pl.look : {};
    const build = BUILDS6[L0.build] ? L0.build : null, hin = +pl.hgt;
    let hs = isFinite(hin) && hin > 40 ? clamp(1 + (clamp(hin, 54, 78) - 64) * 0.011, 0.88, 1.15) : L0.height === 'short' ? 0.93 : L0.height === 'tall' ? 1.07 : 1;
    if (build) hs *= BUILDS6[build].hs || 1;
    const lk = { build, hs, ll: build ? BUILDS6[build].ll || 1 : 1 };
    const skinI = Number.isInteger(L0.skin) ? clamp(L0.skin, 0, 4) : avHash('s' + (pl.id || pl.name)) % 3;
    const hr = avHash('h' + (pl.id || pl.name || ''));
    const hairI = [0, 1, 2, 3, 1, 2][hr % 6], hairC = hex(AV_HAIRC[skinI >= 3 ? hr % 2 : (hr >>> 3) % 5]);
    const spec = Object.assign({}, bodySpec(base, lk, +pl.wgt > 0 ? +pl.wgt : 0), { bare: { hair: hairI } });
    const TEAM = hex(tm.color) || hex('#ffc21a'); let TEAM2 = hex(tm.color2) || hex('#1b1e27');
    if (Math.abs(lum(TEAM) - lum(TEAM2)) < 0.12) TEAM2 = lum(TEAM) > 0.5 ? hex('#15171d') : hex('#f2f4f7');
    const WHITE = hex('#f2f3f5'), DARK = hex('#15171c');
    const KC = { jer: TEAM, pad: shade(TEAM, 1.15), pant: TEAM2, helm: TEAM2, stripe: TEAM, num: lum(TEAM) > 0.5 ? shade(TEAM2, 0.9) : mixc(TEAM2, [1, 1, 1, 1], 0.5), glove: TEAM2, sock: TEAM, mask: lum(TEAM2) < 0.4 ? TEAM2 : hex('#8d93a0') };
    const cleat = hex(AV_CLEATS[L0.cleats]) || (L0.cleats === 'team' ? TEAM : hex(AV_CLEATS.black));
    let skin = hex(AV_SKIN[skinI]);
    const iris = skinI >= 3 ? [0.22, 0.12, 0.05] : skinI === 2 ? [0.3, 0.18, 0.07] : [0.28, 0.2, 0.1];
    const numS = String(pl.num != null ? pl.num : '').trim(), num = /^\d{1,2}$/.test(numS) ? numS : '';
    const abbr = String(tm.abbr || tm.name || 'MFL').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    const surname = (() => { const p = String(pl.name || '').trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0] || '').slice(0, 12); })();
    // decals: number (0,0), drawn face (128,0), name plate (256,0); 512 x 256
    const atlas = document.createElement('canvas'); atlas.width = 512; atlas.height = 256;
    {
      const g = atlas.getContext('2d');
      if (num) {
        g.font = '900 100px "Barlow Condensed", Impact, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.lineJoin = 'round'; g.strokeStyle = '#6a6a6a'; g.strokeText(num, 64, 70, 112);
        g.fillStyle = '#ffffff'; g.fillText(num, 64, 70, 112);
        g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.setLineDash([3, 3]); g.strokeText(num, 64, 70, 112); g.setLineDash([]);
      }
      const x = 128, sc = skin, sh = (kk, a) => `rgba(${Math.round(sc[0] * 255 * kk)},${Math.round(sc[1] * 255 * kk)},${Math.round(sc[2] * 255 * kk)},${a})`;
      g.fillStyle = css(sc); g.fillRect(x, 0, 128, 128); // a drawn face (when there is no scan), as the game's faceCell
      g.fillStyle = sh(0.78, 0.8); for (const ex of [42, 86]) { g.beginPath(); g.ellipse(x + ex, 58, 17, 10, 0, 0, 6.3); g.fill(); }
      g.strokeStyle = sh(0.45, 0.9); g.lineWidth = 5; g.lineCap = 'round'; for (const ex of [42, 86]) { g.beginPath(); g.moveTo(x + ex - 14, 46); g.quadraticCurveTo(x + ex, 41, x + ex + 14, 45); g.stroke(); }
      g.fillStyle = sh(0.82, 0.7); g.beginPath(); g.moveTo(x + 58, 62); g.lineTo(x + 52, 92); g.lineTo(x + 64, 96); g.closePath(); g.fill();
      g.fillStyle = sh(1.1, 0.5); g.beginPath(); g.moveTo(x + 64, 60); g.lineTo(x + 61, 92); g.lineTo(x + 68, 92); g.closePath(); g.fill();
      g.fillStyle = sh(0.6, 0.6); for (const nx of [57, 71]) { g.beginPath(); g.ellipse(x + nx, 95, 4, 2.5, 0, 0, 6.3); g.fill(); }
      g.fillStyle = sh(0.9, 0.5); for (const ex of [42, 86]) { g.beginPath(); g.ellipse(x + ex, 58, 14, 8, 0, 0, 6.3); g.fill(); }
      g.strokeStyle = sh(0.5, 0.9); g.lineWidth = 3; g.beginPath(); g.moveTo(x + 50, 110); g.quadraticCurveTo(x + 64, 116, x + 78, 110); g.stroke();
      g.fillStyle = sh(0.72, 0.45); g.beginPath(); g.ellipse(x + 64, 115, 13, 4, 0, 0, Math.PI); g.fill();
      const grd = g.createRadialGradient(x + 64, 70, 30, x + 64, 70, 70); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = grd; g.fillRect(x, 0, 128, 128);
      if (surname) { g.font = '800 46px "Barlow Condensed", Impact, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText(surname.toUpperCase(), 384, 34, 236); }
    }
    const NUMUV = num ? [4 / 512, 4 / 256, 120 / 512, 120 / 256] : [4 / 512, 132 / 256, 120 / 512, 120 / 256], FACEUV = [132 / 512, 4 / 256, 120 / 512, 120 / 256], NAMEUV = [258 / 512, 2 / 256, 252 / 512, 60 / 256];

    // ---------- GL ----------
    let R = null, lost = false, dead = false;
    const hp = (() => { try { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); return f && f.precision > 0 ? 'highp' : 'mediump'; } catch (e) { return 'mediump'; } })();
    const deriv = GL2 || !!gl.getExtension('OES_standard_derivatives');
    function es3(src, isFS) {
      src = src.replace(/#extension[^\n]*\n/g, '');
      if (isFS) { src = src.replace(/varying /g, 'in ').replace(/texture2D\(/g, 'texture(').replace(/textureCube\(/g, 'texture(').replace(/gl_FragColor/g, 'oC'); if (src.indexOf('//OUT') >= 0) src = src.replace('//OUT', 'out vec4 oC;'); else src = src.replace(/(precision (?:highp|mediump) float;)/, '$1out vec4 oC;'); }
      else src = src.replace(/attribute /g, 'in ').replace(/varying /g, 'out ');
      return '#version 300 es\n' + src;
    }
    function mkProg(vs, fs) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      let vsrc = '#define HP ' + hp + '\n' + vs, fsrc = '#define HP ' + hp + '\n' + fs;
      if (GL2) { vsrc = es3(vsrc, false); fsrc = es3(fsrc, true); }
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsrc)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const P = { pr, a: {}, u: {} };
      const na = gl.getProgramParameter(pr, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(pr, i).name; P.a[n] = gl.getAttribLocation(pr, n); }
      const nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(pr, i).name.replace(/\[0\]$/, ''); P.u[n] = gl.getUniformLocation(pr, n); }
      return P;
    }
    function mkTex(src, repeat, mip) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (src.width) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const m = !!src.width && mip !== false;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, m ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (m) gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    }
    // a studio environment: a bright soft top, a neutral horizon and a dark floor (the cube the specular reflects)
    function envCube() {
      const S = 16, t = gl.createTexture(), px = new Uint8Array(S * S * 4);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
      const face = [(u, v) => [1, -v, -u], (u, v) => [-1, -v, u], (u, v) => [u, 1, v], (u, v) => [u, -1, -v], (u, v) => [u, -v, 1], (u, v) => [-u, -v, -1]];
      const tc = mixc(TEAM, [1, 1, 1, 1], 0.55);
      for (let f = 0; f < 6; f++) {
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
          const d = v3n(face[f]((i + 0.5) / S * 2 - 1, (j + 0.5) / S * 2 - 1)), y = d[1], o = (j * S + i) * 4;
          const top = clamp(y, 0, 1), bot = clamp(-y, 0, 1), side = Math.max(0, d[2]) * (1 - top); // a soft box light in front
          let c = [0.42, 0.43, 0.46];
          c = c.map((v, k) => v + (0.95 - v) * Math.pow(top, 0.7) - v * 0.8 * Math.pow(bot, 0.6) + 0.25 * side * side + 0.12 * Math.max(0, -d[2]) * tc[k] * (1 - bot));
          px[o] = clamp(c[0], 0, 1) * 255; px[o + 1] = clamp(c[1], 0, 1) * 255; px[o + 2] = clamp(c[2], 0, 1) * 255; px[o + 3] = 255;
        }
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      return t;
    }
    let kitC = null, fabC = null, body = null, head = null, headE = null, headData = null;
    function setupGL() {
      R = {};
      const pre = (deriv && !GL2 ? '#extension GL_OES_standard_derivatives : enable\n' : '') + FS_PRE + (deriv ? '#define DERIV\n' : '');
      R.skin = mkProg(VS_SKIN, pre + avSkinFS());
      R.sh = mkProg(AV_VS_SH, AV_FS_SH);
      if (!kitC) kitC = paintKit(KC, abbr, tm.name || '', false, false, 1024);
      if (!fabC) fabC = paintFabric();
      if (!body) body = buildBody(spec, 0);
      R.kit = mkTex(kitC, false); R.fab = mkTex(fabC, true); R.atlas = mkTex(atlas, false); R.white = mkTex(new Uint8Array([255, 255, 255, 255])); R.env = envCube();
      R.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.vb); gl.bufferData(gl.ARRAY_BUFFER, body.v, gl.STATIC_DRAW);
      R.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, body.i, gl.STATIC_DRAW);
      R.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      R.head = null; if (headData) headGL();
    }
    function headGL() {
      const h = { vb: gl.createBuffer(), ib: gl.createBuffer(), n: headData.n };
      gl.bindBuffer(gl.ARRAY_BUFFER, h.vb); gl.bufferData(gl.ARRAY_BUFFER, headData.v, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, h.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, headData.i, gl.STATIC_DRAW);
      h.tex = mkTex(headData.img, false); R.head = h;
    }
    try { setupGL(); } catch (e) { try { el.removeChild(cv); } catch (e2) {} fail('gl: ' + (e && e.message)); return noop; }
    // his scanned head: the index (shared by every avatar on the page), then the mesh and the photo texture
    if (!(opts.noHead) && pl.name) {
      avHeadEntry(opts.heads || AV_HEADS, pl.name).then((e) => {
        if (!e || dead) return;
        headE = e;
        const base = opts.heads || AV_HEADS;
        const k = base + e.slug;
        if (!avHeadData[k]) {
          avHeadData[k] = Promise.all([fetch(base + e.slug + '.bin').then((r) => { if (!r.ok) throw new Error('head ' + r.status); return r.arrayBuffer(); }),
            new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = base + e.slug + '.jpg'; })]).then(([ab, im]) => { const h = avUnpackHead(e, ab); h.img = im; return h; });
          avHeadData[k].catch(() => { delete avHeadData[k]; });
        }
        return avHeadData[k].then((h) => {
          if (dead) return;
          headData = h;
          if (e.skin) skin = [e.skin[0], e.skin[1], e.skin[2], 1];
          if (R && !lost) headGL();
          want();
        });
      }).catch(() => {});
    }

    // ---------- camera ----------
    const FOVY = 0.5; // radians: a long lens, little distortion
    const cam = { yaw: opts.yaw != null ? +opts.yaw : -0.32, pitch: 0.06, zoom: 1, vy: 0 };
    const cam0 = { yaw: cam.yaw, pitch: cam.pitch, zoom: 1 };
    let W = 1, H = 1, dpr = 1, VP = new Float32Array(16), eye = [0, 1, 5], camF = [0, 0, -1];
    let boxW = 0, boxH = 0; // the element's size, kept up to date by the ResizeObserver (measured every frame without one)
    function sizeTo() {
      const r = boxW && ro ? { width: boxW, height: boxH } : el.getBoundingClientRect(), cap = opts.interactive ? 2 : 1.5;
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; }
      W = w; H = h;
    }
    function camera() {
      const bx = avBox(emote), asp = W / H;
      const cyB = (bx[2] + bx[3]) / 2 * hs, hh = (bx[3] - bx[2]) / 2 * hs;
      const rad = Math.max(Math.abs(bx[0]), Math.abs(bx[1]), Math.abs(bx[4]), Math.abs(bx[5])) * hs; // he may face any way while it spins
      const ty = Math.tan(FOVY / 2), tx = ty * asp;
      const place = opts.place != null ? clamp(+opts.place, 0.2, 0.8) : 0.5; // where across the frame he stands
      const halfX = Math.min(place, 1 - place) * 2; // the share of the half-width available on his narrow side
      let wx = rad, wz = rad; // half his width across the view and how far he comes towards the camera: any way round when he can be spun
      if (!opts.interactive) { // seen from one side: how wide the move really is across the view
        const key = cam.yaw.toFixed(3);
        if (!bx.yaw[key]) { const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), P = bx.xz; let a = 0, z = 0; for (let i = 0; i < P.length; i += 2) { a = Math.max(a, Math.abs(P[i] * cy - P[i + 1] * sy)); z = Math.max(z, P[i] * sy + P[i + 1] * cy); } bx.yaw[key] = [a + bx.pad, z + bx.pad]; }
        wx = bx.yaw[key][0] * hs; wz = bx.yaw[key][1] * hs;
      }
      let d = Math.max(hh / ty, wx / (tx * halfX)) + wz;
      d *= cam.zoom;
      const tgt = [0, cyB, 0];
      if (cam.zoom < 1) tgt[1] = cyB + (1.72 * hs * (spec.ll || 1) - cyB) * clamp((1 - cam.zoom) / 0.58, 0, 1); // zooming in drifts towards his face and shoulders (where they are standing)
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      eye = [tgt[0] + Math.sin(cam.yaw) * cp * d, tgt[1] + sp * d, tgt[2] + Math.cos(cam.yaw) * cp * d];
      camF = v3n(v3s(tgt, eye));
      // view (mirrored in X like the game's renderer, so his left is on screen right as we face him) and projection, with the frame
      // shifted so he stands at `place`
      const Vm = m4LookAt(eye, tgt, [0, 1, 0]);
      const f = 1 / ty, n = Math.max(0.05, d - rad * 3 - 2), fa = d + rad * 3 + 4, sx = (place - 0.5) * 2;
      const Pm = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, -sx, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
      const flip = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      VP = m4Mul(Pm, m4Mul(flip, Vm));
    }

    // ---------- drawing ----------
    const I16 = new Float32Array(16), boneBuf = new Float32Array(NB * 12), colBuf = new Float32Array(NSL * 3), lp = new Float32Array(16), lc = new Float32Array(12);
    const LDIR = v3n([0.5, 0.78, 0.62]), rimC = mixc(TEAM, [1, 1, 1, 1], 0.45);
    function bindMesh(P, vb, ib) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      const ST = VSTRIDE * 4, A = P.a;
      const at = (k, n, off) => { if (A[k] == null || A[k] < 0) return; gl.enableVertexAttribArray(A[k]); gl.vertexAttribPointer(A[k], n, gl.FLOAT, false, ST, off); };
      at('aP', 3, 0); at('aN', 3, 12); at('aB', 2, 24); at('aW', 1, 32); at('aS', 1, 36); at('aT', 2, 40); at('aA', 1, 48);
    }
    function disable(P) { for (const k in P.a) if (P.a[k] >= 0) gl.disableVertexAttribArray(P.a[k]); }
    let tNow = 0, nFrames = 0;
    function render(t) {
      if (!R || lost) return;
      sizeTo(); camera();
      const E = EMOTES[emote], q = E.pose(((t % E.T) + E.T) % E.T);
      const bones = fk(q, 0, 0, 0, 0, hs, spec.sw, spec.ll || 1); nFrames++;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.CULL_FACE);
      // contact shadow: under his hips, smaller and lighter as he leaves the ground
      {
        const hp0 = bones[B.hips], fl = Math.min(bones[B.ftL][7], bones[B.ftR][7]), up = clamp(Math.min(hp0[7] - 1.0 * hs, fl) / (1.2 * hs), 0, 1);
        const P = R.sh; gl.useProgram(P.pr);
        gl.uniformMatrix4fv(P.u.uVP, false, VP);
        const sx = (bones[B.ftL][3] + bones[B.ftR][3] + hp0[3] * 2) / 4, sz = (bones[B.ftL][11] + bones[B.ftR][11] + hp0[11] * 2) / 4;
        gl.uniform4f(P.u.uC, sx, sz, 0.55 * hs * (1 - 0.35 * up), 0.42 * hs * (1 - 0.35 * up));
        gl.uniform1f(P.u.uK, 0.5 * (1 - 0.7 * up));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(P.a.aP);
        gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
      }
      const P = R.skin; gl.useProgram(P.pr);
      const u = P.u;
      gl.uniformMatrix4fv(u.uVP, false, VP);
      gl.uniform3f(u.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(u.uCamF, camF[0], camF[1], camF[2]);
      gl.uniform3f(u.uFogR, 1e4, 2e4, 0); gl.uniform3f(u.uFog, 0, 0, 0);
      // the key light turns with the camera (a studio light on the photographer's side), so he is lit from the front at every angle
      const ky = cam.yaw - 0.55, kd = v3n([Math.sin(ky) * 0.62, LDIR[1], Math.cos(ky) * 0.62]);
      gl.uniform3f(u.uSunDir, kd[0], kd[1], kd[2]); gl.uniform3f(u.uSunCol, 2.5, 2.4, 2.25);
      gl.uniform3f(u.uAmbC, 0.5, 0.53, 0.6); gl.uniform3f(u.uGndC, 0.2, 0.19, 0.18);
      // fills: two team-tinted rims behind him, a soft fill on the other side, one off
      const rims = [[cam.yaw + Math.PI - 0.9, 2.6, 260, rimC], [cam.yaw + Math.PI + 0.9, 2.6, 260, rimC], [cam.yaw + 0.9, 1.6, 120, [0.9, 0.93, 1, 1]], [0, -50, 0, [0, 0, 0, 1]]];
      for (let i = 0; i < 4; i++) { const r = rims[i]; lp[i * 4] = Math.sin(r[0]) * 3.2 * hs; lp[i * 4 + 1] = r[1] * hs; lp[i * 4 + 2] = Math.cos(r[0]) * 3.2 * hs; lp[i * 4 + 3] = r[2]; lc[i * 3] = r[3][0]; lc[i * 3 + 1] = r[3][1]; lc[i * 3 + 2] = r[3][2]; }
      gl.uniform4fv(u.uLP, lp); gl.uniform3fv(u.uLC, lc);
      gl.uniform1f(u.uEnvK, 0.9); gl.uniform1f(u.uTime, (t % 100));
      gl.uniform4f(u.uShadowP, 0, 0, 0, 0); gl.uniform3f(u.uSplit, 0, 0, 0);
      gl.uniformMatrix4fv(u.uLVP0, false, I16); gl.uniformMatrix4fv(u.uLVP1, false, I16); gl.uniformMatrix4fv(u.uLVP2, false, I16);
      if (u.uWet) gl.uniform1f(u.uWet, 0);
      gl.uniform1f(u.uExpo, 0.95);
      gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uShadow, 1); if (u.uKit) gl.uniform1i(u.uKit, 2); if (u.uEnv) gl.uniform1i(u.uEnv, 3); if (u.uNrm) gl.uniform1i(u.uNrm, 4);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.white);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.kit);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_CUBE_MAP, R.env);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, R.fab);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.atlas);
      // colours (06-body.js SL order)
      const cols = [KC.jer, KC.pant, skin, KC.helm, KC.stripe, cleat, KC.pad, KC.mask, KC.num, skin, L0.sleeves ? KC.jer : skin, WHITE, KC.glove, KC.sock, cleat === hex(AV_CLEATS.white) ? DARK : WHITE, hex('#5a6678'), KC.num, WHITE, iris, WHITE, WHITE, WHITE, KC.jer, hairC, WHITE];
      for (let i = 0; i < NSL; i++) { const c = cols[i] || WHITE; colBuf[i * 3] = c[0]; colBuf[i * 3 + 1] = c[1]; colBuf[i * 3 + 2] = c[2]; }
      gl.uniform3fv(u.uCol, colBuf);
      gl.uniform4f(u.uNumUV, NUMUV[0], NUMUV[1], NUMUV[2], NUMUV[3]); gl.uniform4f(u.uFaceUV, FACEUV[0], FACEUV[1], FACEUV[2], FACEUV[3]); gl.uniform4f(u.uNameUV, NAMEUV[0], NAMEUV[1], NAMEUV[2], NAMEUV[3]);
      gl.uniform1f(u.uAlpha, 0); gl.uniform1f(u.uDirt, 0); gl.uniform3f(u.uDirtC, 0.25, 0.3, 0.1); gl.uniform1f(u.uSweat, 0.15); gl.uniform1f(u.uSeed, 1.3);
      const hb = bones[B.head]; gl.uniform3f(u.uGaze, eye[0] - hb[3], eye[1] - hb[7], eye[2] - hb[11]);
      gl.uniform4f(u.uFx, 0, 0, 0, 0); gl.uniform3f(u.uFxC, 0, 0, 0); if (u.uFxV) gl.uniform4f(u.uFxV, 0, 0, 0, 0);
      gl.uniform3f(u.uScale, hs, hs, hs); gl.uniform1f(u.uVis, 0); gl.uniform1f(u.uTowel, 0); gl.uniform1f(u.uMouth, 0); if (u.uSway) gl.uniform1f(u.uSway, 0);
      packBones(bones, boneBuf, body.bind, hs); gl.uniform4fv(u.uBones, boneBuf);
      const hasHead = !!R.head;
      gl.uniform1f(u.uHead, hasHead ? 1 : 0);
      bindMesh(P, R.vb, R.ib);
      gl.drawElements(gl.TRIANGLES, body.n, gl.UNSIGNED_SHORT, 0);
      if (hasHead) {
        bindMesh(P, R.head.vb, R.head.ib);
        gl.bindTexture(gl.TEXTURE_2D, R.head.tex);
        gl.drawElements(gl.TRIANGLES, R.head.n, gl.UNSIGNED_SHORT, 0);
      }
      disable(P);
    }

    // ---------- the clock: only while on screen and the tab is visible ----------
    const reduce = !opts.interactive && !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const fpsCap = +opts.fps || (opts.interactive ? 60 : 30);
    let raf = 0, onScreen = true, paused = false, frozen = null, last = 0, clockT = 0, prevNow = 0;
    function loop(now) {
      raf = 0;
      if (dead || lost) return;
      if (!onScreen || document.hidden || paused) { prevNow = 0; return; }
      if (reduce) { tNow = EMOTES[emote].still || 0; try { render(tNow); } catch (e) { fail('render: ' + (e && e.message)); } return; } // a still frame, drawn once
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fpsCap - 2) return;
      last = now;
      const dt = prevNow ? Math.min(0.1, (now - prevNow) / 1000) : 0; prevNow = now;
      clockT += dt * (opts.speed || 1);
      spinStep(dt);
      tNow = frozen != null ? frozen : clockT;
      try { render(tNow); } catch (e) { stop(); fail('render: ' + (e && e.message)); }
    }
    function want() { if (!raf && !dead && !lost) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    let io = null, ro = null;
    try { io = new IntersectionObserver((es) => { onScreen = es.some((e) => e.isIntersecting); if (onScreen) want(); }, { rootMargin: '80px' }); io.observe(el); } catch (e) { io = null; }
    try { ro = new ResizeObserver((es) => { const r = es[0] && es[0].contentRect; if (r) { boxW = r.width; boxH = r.height; } if (frozen != null || reduce) { try { render(tNow); } catch (e) {} } }); ro.observe(el); } catch (e) { ro = null; }
    const onVis = () => { if (!document.hidden) want(); };
    document.addEventListener('visibilitychange', onVis);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; stop(); }, false);
    cv.addEventListener('webglcontextrestored', () => { lost = false; try { setupGL(); want(); } catch (e) { fail('gl lost'); } }, false);

    // ---------- spinning him around (interactive) ----------
    const ptrs = new Map(); let pinch0 = 0, zoom0 = 1, lastTap = 0, spinV = 0, resetting = 0;
    function spinStep(dt) {
      if (resetting > 0) {
        resetting = Math.max(0, resetting - dt); const k = 1 - Math.pow(0.0005, dt);
        let dy = angDiff(cam0.yaw, cam.yaw); cam.yaw += dy * k; cam.pitch += (cam0.pitch - cam.pitch) * k; cam.zoom += (cam0.zoom - cam.zoom) * k;
        if (!resetting) { cam.yaw = cam0.yaw; cam.pitch = cam0.pitch; cam.zoom = cam0.zoom; }
        return;
      }
      if (!ptrs.size && Math.abs(spinV) > 0.01) { cam.yaw += spinV * dt; spinV *= Math.pow(0.08, dt); }
    }
    if (opts.interactive) {
      const pd = (e) => { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }); resetting = 0; spinV = 0; cv.style.cursor = 'grabbing';
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; zoom0 = cam.zoom; }
        if (ptrs.size === 1) { const now = performance.now(); if (now - lastTap < 300) reset(); lastTap = now; }
        want(); };
      const pm = (e) => {
        const p = ptrs.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y, now = performance.now(), dtp = Math.max(1, now - p.t);
        p.x = e.clientX; p.y = e.clientY; p.t = now;
        if (ptrs.size === 1) {
          const k = 5.5 / Math.max(240, cv.clientWidth);
          cam.yaw -= dx * k; spinV = spinV * 0.5 + (-dx * k / (dtp / 1000)) * 0.5;
          cam.pitch = clamp(cam.pitch + dy * k * 0.6, -0.25, 0.75);
        } else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          cam.zoom = clamp(zoom0 * pinch0 / d, 0.42, 1.35);
        }
        want();
      };
      const pu = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (!ptrs.size) cv.style.cursor = 'grab'; want(); };
      cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', pu);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * 0.0012), 0.42, 1.35); resetting = 0; want(); }, { passive: false });
      cv.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowLeft') cam.yaw += 0.2; else if (k === 'ArrowRight') cam.yaw -= 0.2; else if (k === '+' || k === '=') cam.zoom = clamp(cam.zoom * 0.88, 0.42, 1.35); else if (k === '-') cam.zoom = clamp(cam.zoom / 0.88, 0.42, 1.35); else if (k === '0' || k === 'r') reset(); else return; e.preventDefault(); want(); });
      cv.tabIndex = 0;
    }
    function reset() { resetting = 1.2; spinV = 0; want(); }
    const ctrl = {
      ok: true, canvas: cv,
      get emote() { return emote; }, get emoteName() { return EMOTES[emote].name; }, get scanned() { return !!(R && R.head); },
      get view() { return { yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom }; }, get frames() { return nFrames; },
      setView(v) { if (!v) return; if (v.yaw != null) cam.yaw = +v.yaw; if (v.pitch != null) cam.pitch = clamp(+v.pitch, -0.25, 0.75); if (v.zoom != null) cam.zoom = clamp(+v.zoom, 0.42, 1.35); resetting = 0; spinV = 0; if (frozen != null) render(frozen); want(); },
      setEmote(id) { if (!EMOTES[id]) return; emote = id; clockT = 0; cv.setAttribute('aria-label', (pl.name ? pl.name + ': ' : '') + EMOTES[id].name); want(); },
      reset, pause() { paused = true; stop(); }, play() { paused = false; frozen = null; want(); },
      frame(t) { frozen = +t || 0; tNow = frozen; try { render(frozen); } catch (e) { fail('render: ' + (e && e.message)); } },
      destroy() {
        dead = true; stop(); document.removeEventListener('visibilitychange', onVis);
        try { io && io.disconnect(); ro && ro.disconnect(); } catch (e) {}
        try { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
        try { el.removeChild(cv); } catch (e) {}
      },
    };
    want();
    try { if (opts.onReady) setTimeout(() => { if (!dead) opts.onReady(ctrl); }, 0); } catch (e) {}
    return ctrl;
  }
  // light build export: keeps a full engine's MFLBlitz (play, venues) when both are on the page
  window.MFLBlitz = window.MFLBlitz || {};
  if (!window.MFLBlitz.avatar) { window.MFLBlitz.avatar = avatarMount; window.MFLBlitz.emotes = EMOTE_IDS.map((id) => ({ id, name: EMOTES[id].name, secs: EMOTES[id].T })); }
})();
