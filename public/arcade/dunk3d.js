// 3D Dunk: an original arcade 5 on 5 basketball game in raw WebGL, no libraries (a fork of the 3D Blitz engine).
// Skinned characters with a keyframed animation system, ball / rim / backboard physics, shadow-mapped lighting and a post pass.
// Exposes window.MFLDunk.play(root, opts) -> Promise<result> and registers the Arcade game 'dunk3d'.
(function () {
  'use strict';
  const P = 'dk';
  const CSS = `
.dk-wrap{position:relative;width:100%;max-width:1000px;margin:0 auto;color:#f5f6f8;font-family:Inter,system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box;overflow:hidden;background:#07080b;border-radius:12px;touch-action:none}
.dk-wrap *{-webkit-touch-callout:none;box-sizing:border-box}
.dk-wrap.dk-edge{border-radius:0;max-width:none}
.dk-wrap:fullscreen{width:100vw;height:100vh;max-width:none;border-radius:0}
.dk-wrap:-webkit-full-screen{width:100vw;height:100vh;max-width:none;border-radius:0}
.dk-stage{position:absolute;inset:0;overflow:hidden;touch-action:none}
.dk-wrap.dk-fixed{position:fixed;left:0;top:0;right:0;bottom:0;width:100%!important;max-width:none;margin:0!important;border-radius:0;z-index:100000}
html.dk-lock,html.dk-lock body{overflow:hidden!important;overscroll-behavior:none}
.dk-cv{display:block;width:100%;height:100%;touch-action:none;outline:none}
.dk-tags,.dk-fx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.dk-fx{z-index:4}
.dk-bug{position:absolute;left:0;right:0;top:0;z-index:6;display:flex;flex-wrap:wrap;align-items:stretch;gap:4px 6px;padding:6px calc(8px + env(safe-area-inset-right,0px)) 14px calc(8px + env(safe-area-inset-left,0px));background:linear-gradient(rgba(7,8,11,.92),rgba(7,8,11,.7) 72%,transparent);pointer-events:none}
.dk-bug>*{pointer-events:auto}
.dk-sb{display:flex;align-items:stretch;border-radius:8px;overflow:hidden;background:#0f1117;border:1px solid #262b38;flex:0 1 auto;min-width:0;box-shadow:0 3px 10px rgba(0,0,0,.4)}
.dk-tm{display:flex;align-items:center;gap:6px;padding:3px 8px 3px 6px;border-left:5px solid var(--c,#ffc21a);min-width:0;position:relative}
.dk-tm b{font:900 15px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px;text-transform:uppercase}
.dk-tm em{font:400 13px/1 'Press Start 2P',monospace;font-style:normal;color:#ffc21a;min-width:22px;text-align:right}
.dk-tm i{position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:#ffc21a;opacity:0}
.dk-tm.fire{box-shadow:inset 0 -3px 0 #ff7a1a;animation:dkfire .6s ease-in-out infinite alternate}.dk-tm.fire em{color:#ff9a3c}.dk-tm.fire b::after{content:' 🔥';font-size:12px}
@keyframes dkfire{from{background:rgba(255,122,26,.08)}to{background:rgba(255,122,26,.28)}}
.dk-bug.dk-clutch .dk-sb{border-color:#ff3344;animation:dkclutch .82s ease-in-out infinite}
@keyframes dkclutch{0%,100%{box-shadow:0 0 0 0 rgba(255,51,68,.0),0 3px 10px rgba(0,0,0,.4)}30%{box-shadow:0 0 0 3px rgba(255,51,68,.55),0 3px 10px rgba(0,0,0,.4)}}
.dk-clutchtag{position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:12;text-align:center;pointer-events:none;animation:dkct 3.2s ease-out forwards}
.dk-clutchtag b{display:block;font:900 clamp(28px,7vw,54px)/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:2px;color:#ff3344;text-shadow:0 0 18px rgba(255,51,68,.7),0 3px 0 #000}
.dk-clutchtag i{display:block;font:700 13px Inter,sans-serif;color:#fff;font-style:normal;margin-top:4px;text-shadow:0 2px 4px #000}
@keyframes dkct{0%{opacity:0;transform:translateX(-50%) scale(1.6)}12%{opacity:1;transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0}}
.dk-noise{position:absolute;inset:-12px;z-index:2;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 38%,rgba(0,0,0,.55) 70%,rgba(0,0,0,.92) 100%);transition:background .07s}
.dk-noise.flash{background:radial-gradient(ellipse at center,rgba(255,255,255,.22) 0%,rgba(255,255,255,.08) 45%,rgba(0,0,0,.6) 100%)}
.dk-pls{display:flex;align-items:center;gap:3px;padding:3px 8px;background:#0f1117;border:1px solid #262b38;border-radius:8px;animation:dkpls var(--pd,1.4s) ease-in-out infinite}
.dk-pls span{font:800 11px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#9aa0ad;margin-right:3px}
.dk-pls i{display:block;width:4px;border-radius:2px;background:#262b38}
.dk-pls i:nth-of-type(1){height:7px}.dk-pls i:nth-of-type(2){height:10px}.dk-pls i:nth-of-type(3){height:13px}.dk-pls i:nth-of-type(4){height:16px}.dk-pls i:nth-of-type(5){height:19px}
.dk-pls i.on{background:#2bd46b}.dk-pls.t3 i.on{background:#ffc21a}.dk-pls.t4 i.on{background:#ff9a3c}.dk-pls.t5 i.on{background:#ff3344}
.dk-pls.t4,.dk-pls.t5{border-color:rgba(255,51,68,.6)}
@keyframes dkpls{0%,100%{transform:scale(1)}12%{transform:scale(1.07)}}
.dk-narrow .dk-pls{padding:3px 6px}.dk-narrow .dk-pls span{display:none}
.dk-dcall{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 4px}
.dk-dcall.vs8{grid-template-columns:repeat(4,1fr)}.dk-dcall.vs4{grid-template-columns:repeat(4,1fr)}.dk-dcall.vs12{grid-template-columns:repeat(4,1fr);gap:5px}.dk-dcall.vs12 button{padding:7px 3px}.dk-dcall.vs12 button b{font-size:14px}
@media (max-width:560px){.dk-dcall.vs8,.dk-dcall.vs4{grid-template-columns:repeat(2,1fr)}.dk-dcall.vs12{grid-template-columns:repeat(3,1fr)}.dk-dcall.vs12 button small{font-size:9px}.dk-vsc{width:92%}.dk-dcall.vs8 button{padding:7px 4px}}
.dk-vsc{max-width:620px}
.dk-vsbadge{position:absolute;left:50%;top:64px;z-index:9;transform:translateX(-50%);max-width:92%;padding:7px 12px;border-radius:9px;background:rgba(15,17,23,.93);border:1px solid #ff9a3c;color:#f5f6f8;font:600 12px/1.4 Inter,sans-serif;text-align:center;pointer-events:none}
.dk-vscoins{text-align:center;margin:4px 0 0;color:#ffc21a;font:900 20px/1.2 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px}
.dk-dcall button{position:relative;display:flex;flex-direction:column;gap:2px;align-items:center;padding:9px 4px;border-radius:9px;border:1px solid #2f3546;background:#161a24;color:#e8e9ed;cursor:pointer;font:inherit;pointer-events:auto}
.dk-dcall button b{font:900 16px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:.5px;text-transform:uppercase}.dk-dcall button small{font-size:10px;color:#9aa0ad;line-height:1.2}
.dk-dcall button.sug{border-color:#ffc21a;box-shadow:inset 0 0 0 1px #ffc21a}.dk-dcall button u{position:absolute;top:3px;right:5px;text-decoration:none;font:400 8px 'Press Start 2P',monospace;color:#ffc21a}
.dk-dct{font-size:11px;color:#9aa0ad;margin:2px 0 0}
.dk-dtm{height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:5px 0 0;overflow:hidden}.dk-dtm i{display:block;height:100%;background:#ffc21a;border-radius:2px}
.dk-tm.pos i{opacity:1}
.dk-tm s{display:flex;gap:2px;text-decoration:none;position:absolute;left:8px;bottom:2px}
.dk-tm s u{display:block;width:9px;height:2px;background:#ffc21a;text-decoration:none}.dk-tm s u.off{background:#2a2f3c}
.dk-clk{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 8px;background:#161922;min-width:64px}
.dk-clk b{font:400 11px/1.2 'Press Start 2P',monospace;color:#f5f6f8}.dk-clk.run b{color:#ffc21a}
.dk-clk span{font:700 9px/1.2 Inter,sans-serif;color:#9aa0ad;letter-spacing:.5px}.dk-clk.lp span{color:#ff5a5a}
.dk-pc{display:flex;align-items:center;justify-content:center;padding:0 7px;font:400 9px 'Press Start 2P',monospace;color:#9aa0ad;background:#0b0d12;min-width:30px}
.dk-pc.low{color:#ff3344}
.dk-dd{display:flex;flex-direction:column;justify-content:center;padding:3px 9px;font:800 14px/1.05 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;color:#ffc21a;background:#0f1117;border:1px solid #262b38;border-radius:8px;white-space:nowrap}
.dk-dd span{color:#9aa0ad;font-size:11px}
.dk-sp{flex:1 1 0;min-width:0}
.dk-ib{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:34px;background:#1d212c;color:#f5f6f8;border:1px solid #2a2f3c;border-radius:8px;cursor:pointer;padding:0 8px;font:400 8px 'Press Start 2P',monospace}
.dk-ib svg{width:16px;height:16px}
.dk-ib.sure{background:#ff3344;border-color:#ff3344}
.dk-tick{position:absolute;left:50%;top:0;z-index:5;transform:translate(-50%,0);max-width:92%;padding:7px 12px;border-radius:999px;background:rgba(15,17,23,.86);border:1px solid #262b38;font:700 12px/1.3 Inter,sans-serif;color:#e6e8ee;text-align:center;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dk-tick.on{opacity:1}
.dk-ban{position:absolute;left:50%;top:48px;z-index:5;transform:translate(-50%,-4px);display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 11px 6px;border-radius:12px;background:rgba(7,8,11,.62);border:1px solid rgba(255,217,59,.35);pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;max-width:94%}
.dk-ban.on{opacity:1;transform:translate(-50%,0)}
.dk-ban-i{display:flex;gap:2px}.dk-ban-i svg{width:19px;height:19px;color:#6d6a5a;opacity:.45;transition:color .15s,opacity .15s,transform .15s}
.dk-ban-i svg.f{color:#ffd93b;opacity:1;transform:scale(1.12)}
.dk-ban b{font:400 12px/1.2 'Press Start 2P',monospace;color:#ffd93b;text-shadow:2px 2px 0 #000;white-space:nowrap;letter-spacing:.5px}
.dk-ban b i{font-style:normal;color:#ff3344}
.dk-ban.go{border-color:#ff3344}.dk-ban.go b{font-size:14px;animation:dk-banpop .45s cubic-bezier(.2,1.6,.4,1) both}
@keyframes dk-banpop{0%{transform:scale(.3);opacity:0}60%{opacity:1}100%{transform:scale(1)}}
.dk-tick b{color:#ffc21a}
.dk-ctl{position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;align-items:flex-end;gap:6px;padding:18px calc(8px + env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) calc(8px + env(safe-area-inset-left,0px));background:linear-gradient(transparent,rgba(7,8,11,.5));pointer-events:none}
.dk-ctl>*{pointer-events:auto}
.dk-btn{flex:1 1 0;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:800 17px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#f5f6f8;background:rgba(22,25,34,.9);border:2px solid rgba(255,255,255,.18);border-radius:12px;padding:6px 6px;cursor:pointer;position:relative;overflow:hidden;touch-action:manipulation}
.dk-btn small{font:600 10px/1.1 Inter,sans-serif;text-transform:none;letter-spacing:0;color:#aeb3bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.dk-btn kbd{font:7px 'Press Start 2P',monospace;color:#6f7584}
.dk-btn.sel{border-color:#ffc21a;color:#ffc21a;background:rgba(42,36,16,.94)}
.dk-btn:active{transform:translateY(2px)}
.dk-btn:disabled{opacity:.35;cursor:default}
.dk-btn.off{opacity:.35}
.dk-y{background:#ffc21a;border-color:#ffc21a;color:#07080b;box-shadow:0 4px 0 #a37a00}.dk-y kbd,.dk-y small{color:#5a4300}
.dk-r{background:#ff3344;border-color:#ff3344;color:#fff;box-shadow:0 4px 0 #9a1422}.dk-r small,.dk-r kbd{color:#ffd0d4}
.dk-g{background:#1f9d55;border-color:#2bd46b;color:#fff;box-shadow:0 4px 0 #136b39}.dk-g small{color:#d2f7e1}
.dk-wide{flex:2 1 0}
.dk-to{flex:0 0 62px}
.dk-msg{flex:1 1 auto;align-self:flex-end;pointer-events:none;display:flex;align-items:center;justify-content:center;text-align:center;font:700 12.5px/1.3 Inter,sans-serif;color:#d6d9e0;background:rgba(15,17,23,.82);border-radius:999px;padding:9px 12px;min-height:38px}
.dk-msg b{color:#ffc21a}
.dk-sta{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 8px;background:#0b0d12;min-width:58px}
.dk-sta span{font:700 8px/1 Inter,sans-serif;color:#9aa0ad;letter-spacing:.6px;text-transform:uppercase}
.dk-sta u{display:block;height:6px;border-radius:3px;background:#262b38;overflow:hidden;text-decoration:none}
.dk-sta u i{display:block;height:100%;width:var(--s,100%);background:linear-gradient(90deg,#2bd46b,#ffc21a);transition:width .08s linear}
.dk-sta.low u i{background:#ff3344}
.dk-mv{display:grid;grid-template-columns:repeat(3,62px);gap:8px;margin-left:auto;flex:0 0 auto}
.dk-mv .dk-btn{min-height:56px;border-radius:50%;width:62px;height:62px;font-size:14px;padding:0}
.dk-sprint{flex:0 0 72px;width:72px;height:72px;min-height:72px;border-radius:50%;font-size:14px;background:rgba(43,212,107,.22);border-color:#2bd46b;color:#fff;align-self:flex-end;touch-action:none}
.dk-sprint.on{background:#2bd46b;color:#07080b}
.dk-sprint i{position:absolute;left:0;bottom:0;height:5px;background:#2bd46b;width:var(--s,100%)}
.dk-aimln{position:absolute;height:4px;background:linear-gradient(90deg,rgba(255,194,26,.95),rgba(255,194,26,.25));transform-origin:0 50%;pointer-events:none;z-index:3;border-radius:2px;box-shadow:0 0 8px rgba(255,194,26,.6)}
.dk-aimrun{position:absolute;padding:5px 10px;border-radius:999px;background:rgba(255,51,68,.9);color:#fff;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;pointer-events:none;z-index:3;transform:translate(-50%,-50%);white-space:nowrap}
.dk-q{font:400 7px 'Press Start 2P',monospace}

.dk-mv .dk-btn i{position:absolute;left:0;bottom:0;height:4px;background:#fff;width:var(--cd,100%)}
.dk-mv .dk-btn.cool{opacity:.45}
.dk-mv .dk-btn:first-child{grid-column:2}.dk-land .dk-mv .dk-btn:first-child{grid-column:auto}
.dk-catch{display:flex;gap:10px;margin-left:auto;flex:0 0 auto}
.dk-catch .dk-btn{width:84px;height:84px;border-radius:50%;flex:0 0 84px;font-size:19px}
.dk-arc{display:flex;flex:0 0 auto;border-radius:12px;overflow:hidden;border:2px solid rgba(255,255,255,.18)}
.dk-arc button{min-height:48px;padding:0 9px;background:rgba(22,25,34,.9);color:#c9ccd4;border:0;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.dk-arc button.sel{background:#ffc21a;color:#07080b}
.dk-arc kbd{font:7px 'Press Start 2P',monospace;color:#6f7584;margin-left:4px}.dk-arc button.sel kbd{color:#5a4300}
.dk-tag{position:absolute;left:0;top:0;pointer-events:auto;display:flex;align-items:center;gap:4px;padding:3px 8px 3px 3px;border-radius:999px;border:2px solid #f5f6f8;background:rgba(15,17,23,.82);color:#f5f6f8;font:800 12px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;cursor:pointer}
.dk-tag i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 2px;border-radius:9px;background:#f5f6f8;color:#07080b;font:400 7px 'Press Start 2P',monospace}
.dk-tag em{font-style:normal;color:#ffc21a;font-size:11px}
.dk-tag.hide{display:none}
.dk-tags.live .dk-tag{pointer-events:none}
.dk-tag.car{border-color:#ffc21a;cursor:default}
.dk-tag.tgt{border-color:#2bd46b}
.dk-tag.open{border-color:#2bd46b}.dk-tag.open i{background:#2bd46b}
.dk-tag.mid{border-color:#ffc21a}.dk-tag.mid i{background:#ffc21a}
.dk-tag.cov{border-color:#ff3344}.dk-tag.cov i{background:#ff3344;color:#fff}
.dk-tag.small{padding:2px;gap:0}.dk-tag.small span,.dk-tag.small .dk-nof{display:none}
.dk-face{display:inline-block;flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:#1d212c 50% 30%/220% auto no-repeat;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
.dk-nof{display:inline-flex;align-items:center;justify-content:center;font:400 9px 'Press Start 2P',monospace;color:#07080b;background:#ffc21a}
.dk-pop{position:absolute;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:11px;text-shadow:2px 2px 0 #000;white-space:nowrap;animation:dk-rise 1.1s ease-out both}
.dk-pop.dk-big{font-size:17px;z-index:6;text-align:center;line-height:1.25;-webkit-text-stroke:1px #000;text-shadow:3px 3px 0 #000,0 0 14px rgba(0,0,0,.6);animation:dk-rise2 1.7s cubic-bezier(.2,.9,.3,1) both}.dk-pop.dk-big small{display:block;font-size:8px;color:#fff;-webkit-text-stroke:0;margin-top:5px;letter-spacing:.5px}
.dk-pop.dk-perk{font-size:12px;z-index:5;text-align:center;line-height:1.3;animation:dk-rise2 1.5s cubic-bezier(.2,.9,.3,1) both}.dk-pop.dk-perk small{display:block;font-size:7px;color:#e8ebf2;margin-top:3px}
@keyframes dk-rise2{0%{opacity:0;transform:translate(-50%,-50%) scale(.3) rotate(-8deg)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.3) rotate(3deg)}24%{transform:translate(-50%,-50%) scale(1) rotate(-2deg)}75%{opacity:1;transform:translate(-50%,-110%) scale(1)}100%{opacity:0;transform:translate(-50%,-190%) scale(.9)}}
.dk-banner{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);text-align:center;font-family:'Press Start 2P',monospace;white-space:nowrap;animation:dk-zoom .6s cubic-bezier(.2,1.6,.4,1) both;text-shadow:3px 3px 0 #000;max-width:96%}
.dk-banner b{display:block;font-size:20px;line-height:1.3}
.dk-banner i{display:block;font-style:normal;font-size:9px;margin-top:8px;color:#f5f6f8;white-space:normal;line-height:1.5}
.dk-stick{position:absolute;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(255,255,255,.08);pointer-events:none;z-index:3}
.dk-stick b{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,194,26,.85)}
.dk-sheet{position:absolute;left:0;right:0;bottom:0;z-index:7;max-height:84%;display:flex;flex-direction:column;background:rgba(10,12,17,.96);border-top:2px solid #ffc21a;border-radius:16px 16px 0 0;padding:10px calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));box-shadow:0 -10px 30px rgba(0,0,0,.6);animation:dk-up .25s ease-out both}
.dk-sh-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.dk-dsh-tm{display:flex;flex-direction:column;gap:4px;margin:-2px 0 8px;font:600 12px Inter,sans-serif;color:#c9ccd4}.dk-dsh-tm b{color:#fff}.dk-dsh-tm i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}.dk-dsh-tm u{display:block;height:100%;width:100%;background:#ffc21a;transition:width .1s linear}
.dk-sh-top h4{margin:0;flex:1 1 auto;font:900 18px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.6px;color:#ffc21a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dk-sh-top h4 span{color:#9aa0ad;font-size:13px;margin-left:6px}
.dk-tabs{display:flex;gap:4px;margin-bottom:8px;overflow-x:auto}
.dk-tabs button{flex:1 0 auto;min-height:38px;padding:0 10px;border-radius:9px;border:1px solid #2a2f3c;background:#161922;color:#c9ccd4;font:800 14px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.dk-tabs button.sel{background:#ffc21a;color:#07080b;border-color:#ffc21a}
.dk-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow-y:auto;touch-action:pan-y;padding-bottom:2px}
.dk-card{display:flex;flex-direction:column;gap:3px;padding:6px;border-radius:10px;border:2px solid #262b38;background:#121520;cursor:pointer;text-align:left;color:#f5f6f8;touch-action:manipulation}
.dk-card.sel{border-color:#ffc21a;background:#211d10}
.dk-card canvas{width:100%;height:auto;aspect-ratio:16/10;border-radius:6px;background:#1c5a2b;display:block}
.dk-card b{font:900 15px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.3px}
.dk-card span{font:600 10.5px/1.25 Inter,sans-serif;color:#9aa0ad}
.dk-card em{font-style:normal;font:800 10px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#ffc21a;letter-spacing:.5px}
.dk-card i{font:600 10.5px/1.25 Inter,sans-serif;font-style:normal;color:#ffe08a}.dk-card i::before{content:'★ ';color:#ffc21a}
.dk-narrow .dk-tabs button{padding:0 7px;font-size:13px}
.dk-meter{position:absolute;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:6;transform:translateX(-50%);width:min(440px,88%);padding:10px 12px;border-radius:12px;background:rgba(10,12,17,.9);border:1px solid #2a2f3c;pointer-events:none}
.dk-meter h5{margin:0 0 6px;font:900 15px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a;display:flex;justify-content:space-between}
.dk-meter h5 span{color:#c9ccd4}
.dk-mbar{position:relative;height:22px;border-radius:6px;background:linear-gradient(90deg,#3a1218,#5a4300 55%,#1f6b3d 82%,#2bd46b 92%,#ff3344);overflow:hidden;border:1px solid #000}
.dk-mbar i{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.dk-mbar u{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.18);text-decoration:none}
.dk-macc{position:relative;height:16px;margin-top:6px;border-radius:6px;background:linear-gradient(90deg,#ff3344,#5a4300 30%,#2bd46b 46%,#2bd46b 54%,#5a4300 70%,#ff3344);border:1px solid #000;opacity:.35}
.dk-macc.on{opacity:1}
.dk-macc i{position:absolute;top:-3px;bottom:-3px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.dk-meter p{margin:6px 0 0;font:600 11px Inter,sans-serif;color:#9aa0ad;text-align:center}
.dk-ons{padding:8px 12px 12px}
.dk-otap{text-align:center;font:900 26px/1 'Barlow Condensed',Inter,sans-serif;letter-spacing:1px;color:#fff;margin:0 0 7px;animation:dk-otap .45s ease-in-out infinite alternate}
.dk-otap small{font:700 11px Inter,sans-serif;letter-spacing:0;color:#9aa0ad;vertical-align:middle;margin-left:4px}
@keyframes dk-otap{from{transform:scale(1);opacity:.8}to{transform:scale(1.12);opacity:1}}
.dk-ons.done .dk-otap{animation:dk-pulse .25s 2;font-size:32px;text-shadow:0 0 12px currentColor}
.dk-obar{position:relative;height:34px}
.dk-ozn{position:absolute;inset:0;border-radius:8px;overflow:hidden;border:2px solid #000;background:#111}
.dk-ozn span{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
.dk-ozn em{font:800 10px/1 'Barlow Condensed',Inter,sans-serif;font-style:normal;letter-spacing:.3px;color:rgba(0,0,0,.72);white-space:nowrap;overflow:hidden}
.dk-ozn .g3 em{font-size:12px;color:#04230f}
.dk-ons.done .dk-ozn span{opacity:.35}.dk-ons.done .dk-ozn span.hit{opacity:1;box-shadow:inset 0 0 0 3px #fff}
.dk-obar b{position:absolute;left:50%;top:-8px;bottom:-8px;width:2px;margin-left:-1px;background:linear-gradient(#fff 0 6px,transparent 6px calc(100% - 6px),#fff calc(100% - 6px))}
.dk-obar i{position:absolute;top:-7px;bottom:-7px;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 2px #000,0 0 10px #fff}
.dk-dcard{position:absolute;left:50%;top:50%;z-index:5;transform:translate(-50%,-50%);min-width:240px;width:max-content;max-width:90%;padding:14px 18px;background:rgba(15,17,23,.95);border:2px solid var(--oc,#ffc21a);border-radius:12px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.6);animation:dk-zoom .45s cubic-bezier(.2,1.4,.4,1) both}
.dk-dcard h3{margin:0 0 8px;font:900 22px/1.05 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:var(--oc,#ffc21a)}
.dk-dcard p{margin:5px 0;font:400 9px/1.6 'Press Start 2P',monospace;color:#c9ccd4}
.dk-dcard p b{color:#f5f6f8}
.dk-dslide{width:min(520px,92%);margin:4px auto 14px;padding:12px 16px 10px;border-radius:12px;background:rgba(15,17,23,.72);border:1px solid #2a2f3c;text-align:center}
.dk-dslide-h{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-bottom:8px}.dk-dslide-h b{font:900 20px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a}.dk-dslide-h span{font:500 12px Inter,sans-serif;color:#9aa0ad}
.dk-dslide input{width:100%;accent-color:#ffc21a;cursor:pointer;height:26px;margin:0}
.dk-dslide-t{display:flex;justify-content:space-between;margin:2px 2px 0;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}.dk-dslide-t i{font-style:normal;width:20%;text-align:center}.dk-dslide-t i:first-child{text-align:left}.dk-dslide-t i:last-child{text-align:right}.dk-dslide-t i.on{color:#ffc21a}
.dk-dslide-d{margin:6px 0 0;font:500 13px Inter,sans-serif;color:#e5e7eb}
.dk-setp{position:absolute;top:54px;right:calc(10px + env(safe-area-inset-right,0px));z-index:30;width:min(340px,calc(100% - 20px));padding:12px 14px;border-radius:12px;background:rgba(15,17,23,.97);border:1px solid #2a2f3c;box-shadow:0 12px 30px rgba(0,0,0,.6);color:#e5e7eb;font:500 13px Inter,sans-serif}
.dk-setp[hidden]{display:none}
.dk-setp h5{margin:0 0 8px;font:900 18px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:#ffc21a}
.dk-sp-row{padding:8px 0;border-top:1px solid #222734}.dk-sp-row>b{display:block;font-weight:700;color:#f5f6f8}.dk-sp-row>small{display:block;margin:2px 0 6px;color:#9aa0ad;font-size:11.5px}
.dk-sp-seg{display:flex;gap:4px}.dk-sp-seg button{flex:1;min-height:34px;padding:0 4px;border-radius:8px;border:1px solid #2a2f3c;background:#1d212c;color:#c9ccd4;font:700 12px Inter,sans-serif;cursor:pointer}.dk-sp-seg button.on{background:#ffc21a;border-color:#ffc21a;color:#111}
.dk-sp-d{margin-top:6px!important;color:#e5e7eb!important}
.dk-sp-tg{display:flex;align-items:center;justify-content:space-between}.dk-sp-tg>b{display:inline}
.dk-sw{min-width:58px;min-height:32px;border-radius:999px;border:1px solid #2a2f3c;background:#1d212c;color:#9aa0ad;font:800 12px Inter,sans-serif;cursor:pointer}.dk-sw.on{background:#2bd46b;border-color:#2bd46b;color:#06210f}
.dk-dcard canvas.dk-mf{display:block;width:300px;max-width:100%;height:64px;margin:2px auto 6px;border-radius:6px;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.dk-dcard .mf-dd{font-size:10px;color:#c9ccd4}.dk-dcard .mf-dd b{color:#ffc21a}
.dk-dcard .mf-lp{min-height:1.6em;color:#f5f6f8}
.dk-dcard .dk-dres{margin-top:10px;font-size:14px;color:#f5f6f8}
.dk-dcard .dk-dsc{margin-top:8px;font-size:11px;color:#ffc21a}
.dk-box{position:absolute;inset:0;z-index:9;background:rgba(7,8,11,.97);overflow-y:auto;touch-action:pan-y;padding:14px calc(12px + env(safe-area-inset-right,0px)) 18px calc(12px + env(safe-area-inset-left,0px))}
.dk-box h2{margin:2px 0 4px;text-align:center;font:900 26px/1 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.5px}
.dk-box .fs{display:flex;justify-content:center;align-items:center;gap:14px;margin:8px 0 12px;font:400 20px 'Press Start 2P',monospace}
.dk-box .fs span{font:900 18px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase}
.dk-box h3{margin:12px 0 4px;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#ffc21a}
.dk-box table{width:100%;border-collapse:collapse;font:600 12px Inter,sans-serif}
.dk-box th{font-weight:700;color:#6f7584;text-align:right;padding:3px 4px;font-size:10.5px;text-transform:uppercase}
.dk-box th:first-child,.dk-box td:first-child{text-align:left}
.dk-box td{text-align:right;padding:4px;border-top:1px solid #1d212c;white-space:nowrap}
.dk-box td:first-child{white-space:normal}
.dk-box .hl{margin:4px 0;padding-left:16px;font:600 12px/1.5 Inter,sans-serif;color:#c9ccd4}
.dk-box .go{display:block;margin:16px auto 4px;font:400 12px 'Press Start 2P',monospace;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer}
.dk-splash{position:absolute;inset:0;z-index:8;background:rgba(7,8,11,.9);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:11px;padding:16px;text-align:center;overflow:auto;touch-action:pan-y}
.dk-splash>:first-child{margin-top:auto}.dk-splash>:last-child{margin-bottom:auto;flex:0 0 auto}
.dk-title{font-family:'Press Start 2P',monospace;color:#ffc21a;font-size:24px;line-height:1.3;text-shadow:3px 3px 0 #6b4f00}
.dk-tag2{font:800 15px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#c9ccd4;margin-top:-6px}
.dk-goal{font:400 9px/1.8 'Press Start 2P',monospace;color:#f5f6f8;background:#161922;padding:10px 12px;border-radius:8px;border:1px solid #2a2f3c;max-width:380px}
.dk-goal em{font-style:normal;color:#ffc21a}
.dk-squad{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.dk-squad div{display:flex;flex-direction:column;align-items:center;gap:4px;font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#c9ccd4;max-width:70px}
.dk-squad .dk-face{width:44px;height:44px;box-shadow:0 0 0 2px #ffc21a}
.dk-squad em{font-style:normal;color:#6f7584;font-size:10px}
.dk-how{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-width:440px;text-align:left}
.dk-how li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:#c9ccd4}
.dk-how li b{color:#f5f6f8}
.dk-how li>i{flex:0 0 auto;font-style:normal;font:400 8px 'Press Start 2P',monospace;color:#07080b;background:#ffc21a;border-radius:6px;padding:5px 6px;margin-top:1px}
.dk-go{font:400 13px 'Press Start 2P',monospace;background:#ffc21a;color:#07080b;border:0;border-radius:10px;padding:14px 22px;box-shadow:0 4px 0 #a37a00;cursor:pointer;animation:dk-pulse 1.1s ease-in-out infinite}
.dk-err{padding:40px 18px;text-align:center;font:600 15px/1.5 Inter,sans-serif;color:#c9ccd4;background:#0f1117;border:1px solid #1d212c;border-radius:12px}
.dk-err b{display:block;font:400 12px 'Press Start 2P',monospace;color:#ff3344;margin-bottom:12px}
.dk-land .dk-splash{gap:6px;padding:8px 14px}.dk-land .dk-title{font-size:16px}.dk-land .dk-squad{display:none}.dk-land .dk-goal{font-size:8px;padding:6px 10px}
.dk-land .dk-how{grid-template-columns:1fr 1fr;max-width:820px;gap:4px 14px}.dk-land .dk-how li{font-size:11.5px;line-height:1.3}.dk-land .dk-go{padding:10px 18px}
.dk-land .dk-btn{min-height:48px}.dk-land .dk-mv .dk-btn{width:56px;height:56px;min-height:52px;font-size:13px}.dk-land .dk-mv{grid-template-columns:repeat(5,56px)}.dk-land .dk-sprint{width:62px;height:62px;min-height:62px;flex-basis:62px}.dk-land .dk-sta{display:none}
.dk-land .dk-catch .dk-btn{width:72px;height:72px;flex-basis:72px}
.dk-land .dk-sheet{max-height:92%}.dk-land .dk-cards{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}
.dk-land .dk-meter{bottom:calc(70px + env(safe-area-inset-bottom,0px))}.dk-land .dk-banner{top:42%}.dk-land .dk-banner b{font-size:17px}
.dk-narrow .dk-tm b{font-size:13px}.dk-narrow .dk-tm em{font-size:11px;min-width:16px}.dk-narrow .dk-clk{min-width:56px}.dk-narrow .dk-clk b{font-size:10px}
.dk-narrow .dk-dd{font-size:12.5px;padding:3px 7px}.dk-narrow .dk-btn{font-size:15px}.dk-narrow .dk-banner b{font-size:15px}.dk-narrow .dk-banner i{font-size:8px}.dk-narrow .dk-title{font-size:19px}
.dk-narrow .dk-ctl{flex-wrap:wrap}.dk-narrow .dk-msg{flex:1 1 100%;order:-1;align-self:stretch;min-height:30px;padding:5px 10px;font-size:11.5px}
.dk-narrow .dk-arc button{padding:0 7px;font-size:12px}.dk-narrow .dk-sprint{width:60px;height:60px;min-height:60px;flex-basis:60px;font-size:12px}.dk-tiny .dk-arc button{padding:0 5px;font-size:11px}
.dk-tiny .dk-snd{display:none}.dk-tiny .dk-vc{display:none}.dk-vtog{display:flex;align-items:center;gap:8px;font:600 13px Inter,sans-serif;color:#c9ccd4;cursor:pointer}.dk-vtog input{width:18px;height:18px;accent-color:#ffc21a}.dk-narrow .dk-sta{min-width:46px;padding:0 5px}.dk-narrow .dk-tag{font-size:11px}.dk-narrow .dk-ib{min-width:32px;height:32px;padding:0 6px}.dk-narrow .dk-bug{gap:4px 4px;padding-left:6px;padding-right:6px}.dk-narrow .dk-tm{padding:3px 6px 3px 5px;gap:4px}.dk-narrow .dk-cards{grid-template-columns:1fr 1fr}.dk-narrow .dk-card span{display:none}.dk-narrow .dk-pc{display:none}
@keyframes dk-rise{0%{opacity:0;transform:translate(-50%,-20%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-240%) scale(1)}}
@keyframes dk-zoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:0}60%{opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}
@keyframes dk-pulse{50%{transform:scale(1.06)}}
@keyframes dk-up{0%{transform:translateY(40%);opacity:0}100%{transform:none;opacity:1}}

/* ---- 3D Dunk ---- */
.dk-face{text-decoration:none}
.dk-fl{display:flex;align-items:center;gap:4px;padding:2px 7px;background:#161922;font:700 8px Inter,sans-serif;color:#9aa0ad;letter-spacing:.4px}
.dk-fl b{font:400 10px 'Press Start 2P',monospace;color:#f5f6f8;min-width:14px;text-align:center}.dk-fl b.bonus{color:#ff5a5a}
.dk-pc{display:flex;align-items:center;justify-content:center;min-width:30px;padding:0 6px;font:400 11px 'Press Start 2P',monospace;color:#ff3b2f;background:#0b0c10}.dk-pc.low{animation:dk-pulse .5s infinite}
.dk-ptag{position:absolute;transform:translate(-50%,-100%);padding:2px 7px;border-radius:7px;background:rgba(10,12,17,.78);border:1px solid rgba(77,210,255,.7);font:800 12px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;pointer-events:none;z-index:2}
.dk-ptag b{color:#4dd2ff;margin-right:4px}.dk-ptag::after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-5px;border:5px solid transparent;border-top-color:rgba(77,210,255,.85);border-bottom:0}.dk-ptag.hide{display:none}
.dk-smeter{position:absolute;width:16px;height:96px;transform:translate(0,-50%);border-radius:8px;background:rgba(10,12,17,.82);border:2px solid rgba(255,255,255,.75);overflow:hidden;pointer-events:none;z-index:4}
.dk-smeter.hide{display:none}.dk-smeter u{position:absolute;left:0;right:0;background:#2bd46b;box-shadow:0 0 8px #2bd46b;text-decoration:none}
.dk-smeter i{position:absolute;left:2px;right:2px;bottom:0;background:linear-gradient(#fff,#ffc21a);border-radius:5px;opacity:.92}
.dk-smeter em{position:absolute;left:22px;top:50%;transform:translateY(-50%);font:400 10px 'Press Start 2P',monospace;font-style:normal;white-space:nowrap;text-shadow:2px 2px 0 #000}
.dk-smeter.g{border-color:#2bd46b;overflow:visible}.dk-smeter.g em{color:#2bd46b}.dk-smeter.r{border-color:#ff5a5a;overflow:visible}.dk-smeter.r em{color:#ff7a6a}
.dk-pad{display:grid;grid-template-columns:64px 64px 88px;grid-template-rows:64px 64px;gap:8px;margin-left:auto;flex:0 0 auto;align-items:end}
.dk-pad .dk-btn{width:64px;height:64px;min-height:64px;border-radius:50%;padding:0;font-size:14px}
.dk-pad .dk-big{grid-column:3;grid-row:1/3;width:84px;height:84px;min-height:84px;align-self:center;font-size:17px;background:rgba(43,212,107,.28);border-color:#2bd46b}
.dk-pad .dk-sprint{grid-column:1;grid-row:2}
.dk-to{flex:0 0 86px}.dk-to.off{opacity:.4}
.dk-subs{position:absolute;inset:0;z-index:9;background:rgba(7,8,11,.94);overflow-y:auto;padding:14px calc(14px + env(safe-area-inset-right,0px)) 18px calc(14px + env(safe-area-inset-left,0px));text-align:center}
.dk-subs.hide{display:none}.dk-subs h3{margin:4px 0;font:900 22px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#ffc21a}.dk-subs h4{margin:10px 0 4px;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;color:#9aa0ad}
.dk-subs p{margin:0 0 8px;font:600 12px Inter,sans-serif;color:#9aa0ad}
.dk-sbl{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.dk-sbp{display:flex;align-items:center;gap:8px;min-width:170px;padding:7px 10px;border-radius:10px;background:#161922;border:2px solid #262b38;color:#f5f6f8;cursor:pointer;position:relative;text-align:left}
.dk-sbp.sel{border-color:#ffc21a;background:#2a2410}.dk-sbp.bench{border-style:dashed}.dk-sbp span{display:flex;flex-direction:column;font:800 13px 'Barlow Condensed',Inter,sans-serif;text-transform:uppercase}
.dk-sbp small{font:600 10px Inter,sans-serif;color:#9aa0ad;text-transform:none}.dk-sbp u{position:absolute;left:8px;right:8px;bottom:3px;height:3px;background:#2a2f3c}.dk-sbp u i{display:block;height:100%;background:#2bd46b}
.dk-subs .dk-go{margin-top:14px}
.dk-land .dk-pad{grid-template-columns:58px 58px 80px;grid-template-rows:58px 58px}.dk-land .dk-pad .dk-btn{width:58px;height:58px;min-height:58px}.dk-land .dk-pad .dk-big{width:76px;height:76px;min-height:76px}
.dk-how{list-style:none;margin:0;padding:0;display:grid;gap:3px;max-width:560px;font:600 12.5px/1.4 Inter,sans-serif;color:#c9ccd4;text-align:left}.dk-how b{color:#ffc21a}
`;
  function injectCSS() {
    if (document.getElementById(P + '-css')) return;
    const s = document.createElement('style'); s.id = P + '-css'; s.textContent = CSS; document.head.appendChild(s);
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
  // (football field constants dropped in the Dunk engine)
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
vec3 finC(vec3 c){return (c.r+c.g+c.b<65000.0&&c.r>=0.0&&c.g>=0.0&&c.b>=0.0)?c:vec3(0.0);} // NaN/Inf/negative -> black (NaN fails every compare)
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
vec3 F_Schlick(vec3 F0,float VH){float f=pow(max(1.0-VH,0.0),5.0);return F0+(1.0-F0)*f;}
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
   if(mode==2){float Dc=D_GGX(NH,0.02);col+=uSunCol*Dc*0.25*pow(max(1.0-VH,0.0),2.0)*NL*sh;}}
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
  if(mode==2){vec3 envC=textureCube(uEnv,R,0.5).rgb*uEnvK;float fr=pow(max(1.0-NV,0.0),4.0);col+=envC*(0.04+0.6*fr)*0.6*ao*specOcc;}
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
  // ---- world geometry: statics, props, ball, markers. aC.a: alpha for unlit, 'emis' material draws unlit; uModel places the statics (the identity but at Metcalf with the ends swapped) ----
  const VS_WORLD = `attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;attribute vec2 aT;
uniform mat4 uVP;uniform mat4 uModel;uniform HP vec3 uEye;uniform vec2 uUV;uniform HP vec3 uCamF;uniform float uFlipV;
varying vec4 vC;varying vec2 vT;varying vec3 vW;varying vec3 vN;varying float vVD;varying float vLit;
void main(){vec3 p=(uModel*vec4(aP,1.0)).xyz;vW=p;vN=mat3(uModel)*aN;vLit=dot(aN,aN)>0.01?1.0:0.0;gl_Position=uVP*vec4(p,1.0);vC=aC;vT=vec2(aT.x,mix(aT.y,1.0-aT.y,uFlipV))+uUV;vVD=dot(p-uEye,uCamF);}`;
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
vec3 w=skinP(b0,p)*w0+skinP(b1,p)*w1;vec3 nn=skinN(b0,aN)*w0+skinN(b1,aN)*w1;vec3 n=dot(nn,nn)>1e-12?normalize(nn):vec3(0.0,1.0,0.0);
bool num=(s==8||s==16);
vT=num?uNumUV.xy+aT*uNumUV.zw:(s==11?uNameUV.xy+aT*uNameUV.zw:(s==9?uFaceUV.xy+aT*uFaceUV.zw:aT));
vS=aS;vA=aA;vP=aP;vW=w;vN=n;gl_Position=uVP*vec4(w,1.0);vVD=dot(w-uEye,uCamF);}`;
  const FS_SKIN = `uniform sampler2D uTex;uniform sampler2D uKit;uniform sampler2D uNrm;uniform HP vec4 uFaceUV;uniform vec3 uCol[26];uniform float uAlpha;uniform float uWet;uniform float uDirt;uniform vec3 uDirtC;uniform vec3 uGaze;uniform float uSweat;uniform float uSeed;uniform vec4 uFx;uniform vec3 uFxC;
varying vec2 vT;varying float vS;varying float vA;varying vec3 vP;
#LIB#
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){int s=int(vS+0.5);vec3 base;float rough=0.6,metal=0.0,alpha=1.0;int mode=0;float specOcc=1.0;float ao=vA;
vec3 N=dot(vN,vN)>1e-12?normalize(vN):normalize(uEye-vW);vec3 c=uCol[s];
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
if(fm>0.5){vec3 V=normalize(uEye-vW);float fres=pow(max(1.0-abs(dot(N,V)),0.0),2.0);float lum=dot(base,vec3(0.3,0.59,0.11));bool skinS=(s==2||s==9||s==10||s==18||s==23||s==25);
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
vec3 col=finC(shadePBR(base,N,rough,metal,ao,1.0,mode,specOcc)+emis); // a NaN here (degenerate scan normals) would smear black through the blur
gl_FragColor=vec4(fogIt(col),alpha);}`;
  // ---- depth-only passes (shadow cascades) ----
  const VS_DEPTH_W = `attribute vec3 aP;uniform mat4 uLVP;uniform mat4 uModel;void main(){gl_Position=uLVP*(uModel*vec4(aP,1.0));}`; // (uModel: Metcalf's half turn of the world, else the identity)
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
vec3 fin4(vec3 c){return (c.r+c.g+c.b<65000.0&&c.r>=0.0&&c.g>=0.0&&c.b>=0.0)?c:vec3(0.0);}
void main(){vec3 c=(fin4(texture2D(uTex,vUV).rgb)+fin4(texture2D(uTex,vUV+vec2(uPx.x,0.0)).rgb)+fin4(texture2D(uTex,vUV+vec2(0.0,uPx.y)).rgb)+fin4(texture2D(uTex,vUV+uPx).rgb))*0.25;
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
#define T(o) {vec2 q=vec2(o.x*R.x-o.y*R.y,o.x*R.y+o.y*R.x);vec3 sv=texture2D(uTex,vUV+q*r).rgb;if(sv.r+sv.g+sv.b<65000.0&&sv.r>=0.0&&sv.g>=0.0&&sv.b>=0.0){c+=sv;n+=1.0;}}
T(vec2(0.0,0.0))T(vec2(-0.613,0.617))T(vec2(0.170,-0.040))T(vec2(-0.299,-0.791))T(vec2(0.645,0.493))T(vec2(-0.651,-0.195))T(vec2(0.421,-0.712))T(vec2(-0.102,0.962))T(vec2(0.946,-0.152))T(vec2(0.3,0.3))T(vec2(-0.3,-0.3))T(vec2(0.0,-0.6))
c/=max(n,1.0);
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
  // Xavier's dance (from his video): feet planted together, knees bent and swinging side to side together, both hands swinging
  // across the other way and switching each beat (one hand crosses low in front, the other swings out by the hip), chest up, head
  // level. Built from targets: for each moment the ankles, knees and hands are placed where they are in the video and the joint
  // angles are solved to reach them (legs: hip 3 axes + knee; arms: shoulder + elbow; feet kept flat and pointing forward). Half a
  // loop is solved once (24 steps) and the other half is its mirror, so the loop is smooth and exactly symmetric.
  const XAV_T = 0.8, XAV_N = 24;
  let xavTab = null;
  function xavSolve(q, vars, resid, it) { // damped least squares with a numeric Jacobian; vars: [[poseIndex, min, max]], resid(q) -> array
    const n = vars.length;
    for (let k = 0; k < (it || 12); k++) {
      const r0 = resid(q), m = r0.length, J = [];
      for (let j = 0; j < n; j++) { const [ix] = vars[j], o = q[ix]; q[ix] = o + 1e-4; const r1 = resid(q); q[ix] = o; J.push(r1.map((v, i) => (v - r0[i]) / 1e-4)); }
      const A = [], g = [];
      for (let a = 0; a < n; a++) { A.push([]); g.push(0); for (let i = 0; i < m; i++) g[a] += J[a][i] * r0[i]; for (let b = 0; b < n; b++) { let s = a === b ? 1e-3 : 0; for (let i = 0; i < m; i++) s += J[a][i] * J[b][i]; A[a].push(s); } }
      for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [g[c], g[p]] = [g[p], g[c]];
        for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let b = c; b < n; b++) A[r][b] -= f * A[c][b]; g[r] -= f * g[c]; } }
      const d = new Array(n).fill(0); for (let c = n - 1; c >= 0; c--) { let s = g[c]; for (let b = c + 1; b < n; b++) s -= A[c][b] * d[b]; d[c] = s / A[c][c]; }
      let mx = 0; for (let j = 0; j < n; j++) { const st = clamp(d[j], -0.3, 0.3); const v = vars[j]; q[v[0]] = clamp(q[v[0]] - st, v[1] ?? -9, v[2] ?? 9); mx = Math.max(mx, Math.abs(st)); }
      if (mx < 1e-4) break;
    }
  }
  function xavKey(u, q) { // u in [0, 0.5): s = +1 knees to his left (-x), hands to his right (+x)
    const x = 2 * Math.PI * u, s = (9 * Math.sin(x) - Math.sin(3 * x)) / 8, bob = 0.5 - 0.5 * Math.cos(2 * x);
    q = q || pb({ hipL: [0.9, 0, 0], knL: [-1.5], hipR: [0.9, 0, 0], knR: [-1.5], shL: [0.4, 0, -0.2], elL: [0.8], shR: [0.4, 0, 0.2], elR: [0.8] });
    // body: low, chest up and a little forward, a small roll and twist with the swing; head level
    q[PN] = -0.3 - 0.025 * bob; q[PN + 1] = 0.16; q[PN + 2] = 0.05 * s; q[PN + 3] = 0;
    const set = (k, a) => { const i = B[k] * 3; for (let j = 0; j < 3; j++) q[i + j] = (LIMB_FLIP[B[k]] && j === 0 ? -1 : 1) * (a[j] || 0); };
    set('spine', [0.08 + 0.06 * s * s, 0.3 * s, -0.08 * s]); set('chest', [0, 0.18 * s, 0]); set('neck', [-0.24 - 0.06 * s * s, -0.48 * s, 0.08 * s]); set('head', [0, 0, 0]);
    set('haL', [0.25, 0, 0]); set('haR', [0.25, 0, 0]);
    const hy = HIP_H - 0.03 + q[PN], kx = -0.15 * s; // knees swing together, 15 cm each way
    // legs: ankles 11 cm apart under the hips, a touch forward; knee tips out over the toes and swung sideways
    for (const [h, k, f, sd] of [['hipL', 'knL', 'ftL', -1], ['hipR', 'knR', 'ftR', 1]]) {
      const ia = B[h] * 3, ik = B[k] * 3, iF = B[f] * 3, A = [sd * 0.055, 0.075, 0.03], K = [sd * 0.075 + kx, hy - 0.42, 0.36];
      xavSolve(q, [[ia], [ia + 1], [ia + 2], [ik]], (p) => { const b = fk(p, 0, 0, 0, 0, 1), a = b[B[f]], kn = b[B[k]];
        return [(a[3] - A[0]) * 4, (a[7] - A[1]) * 4, (a[11] - A[2]) * 4, (kn[3] - K[0]) * 1.5, (kn[11] - K[2]) * 0.6]; }, 14);
      xavSolve(q, [[iF], [iF + 1], [iF + 2]], (p) => { const m = fk(p, 0, 0, 0, 0, 1)[B[f]]; return [m[1], m[9], m[6], m[2] - sd * 0.06]; }, 8);
    }
    // arms (as in the video): they swing together like a pendulum, the other way from the knees. At each end the arm on the far
    // side sweeps nearly straight down and across the front of his body to the other thigh, while the near arm bends with its elbow
    // out to the side and its hand by its own hip; in the middle both arms hang down in front, hands close together.
    const sn = s / 1.25, a = (Math.sqrt(sn * sn + 0.04) - 0.2) / 0.8198; // a smooth |s| (no kink as the arms pass the middle); s >= 0 here (the other half is the mirror)
    // a smooth curve from the middle pose to the end pose (through the halfway pose when there is one)
    [[B.shL, B.elL, xavArm.cL, xavArm.lead, null], [B.shR, B.elR, xavArm.cR, xavArm.trail, xavArm.trailMid]].forEach(([sh, el, c, e, m]) => {
      const v = c.map((c0, j) => { const p1 = m ? 2 * m[j] - (c0 + e[j]) / 2 : (c0 + e[j]) / 2; return (1 - a) * (1 - a) * c0 + 2 * a * (1 - a) * p1 + a * a * e[j]; });
      for (let j = 0; j < 3; j++) q[sh * 3 + j] = v[j]; q[el * 3] = v[3]; });
    return q;
  }
  // the three arm poses (raw joint angles: shoulder x, y, z, elbow), fitted to where his hands and elbows are in the video relative
  // to his hips: the middle (both arms hang down in front, hands close), the sweep (his far arm nearly straight, hand down across his
  // body) and the wing (elbow out to the side, hand back by his hip)
  const xavArm = { cL: [-0.273, 0, 0.295, -0.119], cR: [-0.273, 0, -0.295, -0.119], lead: [-0.5, -0.003, 0.398, -0.1], trail: [1.592, -0.797, 2.114, -1.667],
    trailMid: [0.46, -0.902, 0.558, -1.268] }; // the wing arm halfway (its hand goes steadily out and up to his waist, no doubling back)
  function xavPose(t) {
    if (!xavTab) { xavTab = []; let q = null; for (let i = 0; i < XAV_N; i++) { q = xavKey(i / (2 * XAV_N), q ? lerpPose(q, q, 0) : null); xavTab.push(lerpPose(q, q, 0)); }
      for (let i = 0; i < XAV_N; i++) xavTab.push(mirrorPose(xavTab[i])); }
    const N = 2 * XAV_N, f = (((t / XAV_T) % 1) + 1) % 1 * N, i = Math.floor(f) % N, j = (i + 1) % N;
    return gfit(lerpPose(xavTab[i], xavTab[j], f - Math.floor(f)));
  }

  function clipCeleb(k, t) {
    const w = Math.sin(t * 9), hop = Math.abs(Math.sin(t * 6.5));
    if (k === 1) return kf(Math.min(1, t / 0.9), [ // spike
      [0, gfit(pb({ shR: [2.9, 0, 0.35], elR: [0.2], shL: [0.4, 0, -0.5], elL: [0.9], spine: [-0.15, 0, 0], neck: [-0.4, 0, 0], hipL: [0.3, 0, -0.15], hipR: [0.3, 0, 0.15], knL: [-0.4], knR: [-0.4] }, -0.08, -0.08, 0))],
      [0.4, gfit(pb({ shR: [-0.5, 0, 0.5], elR: [0.3], shL: [0.4, 0, -0.5], elL: [0.9], spine: [0.55, 0, 0], neck: [-0.1, 0, 0], hipL: [0.7, 0, -0.15], hipR: [0.7, 0, 0.15], knL: [-0.9], knR: [-0.9] }, -0.28, 0.28, 0))],
      [1, gfit(pb({ shR: [0.6, 0, 1.4], elR: [0.4], shL: [0.6, 0, -1.4], elL: [0.4], spine: [-0.1, 0, 0], neck: [-0.35, 0, 0], hipL: [0.15, 0, -0.25], hipR: [0.15, 0, 0.25], knL: [-0.3], knR: [-0.3] }, -0.05, -0.05, 0))],
    ]);
    if (k === 2) return gfit(pb({ shR: [0.3, 0, 2.95], elR: [0.1], shL: [0.9, 0, -0.5], elL: [1.9], spine: [-0.2, 0, 0.1], neck: [-0.7, 0, 0], head: [-0.3, 0, 0], hipL: [0.1, 0, -0.2], hipR: [0.1, 0, 0.2], knL: [-0.25], knR: [-0.25] }, 0, -0.1, 0.05));
    if (k === 6) return xavPose(t); // Xavier's dance (xavPose above)
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
  const bodyKey = (s) => [s.bulk, s.belly, s.sw, s.legs, s.arms, s.neck, s.ll || 1, s.cap ? 1 : 0, s.noGear ? 1 : 0, s.headset ? 1 : 0].map((v) => Math.round(v * 100)).join(',') + (s.cas ? ',c' + s.cas.hair + s.cas.bot + s.cas.sock + (s.cas.hoop ? 'h' : '') : '') + (s.bare ? ',b' + s.bare.hair : '');
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
  // ---- shapes shared by the body and the scanned heads (22-heads.js, 09-avatar.js) ----
  // monotone cubic (no overshoot) through points (xs ascending or descending) -> f(x), clamped at the ends
  function pchip(xs, ys) {
    const n = xs.length, d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    for (let i = 0; i < n; i++) {
      if (i === 0) m[i] = d[0] || 0; else if (i === n - 1) m[i] = d[n - 2] || 0;
      else if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    const asc = xs[n - 1] > xs[0];
    return (x) => {
      if (n === 1) return ys[0];
      if (asc ? x <= xs[0] : x >= xs[0]) return ys[0];
      if (asc ? x >= xs[n - 1] : x <= xs[n - 1]) return ys[n - 1];
      let i = 0; while (i < n - 2 && (asc ? x > xs[i + 1] : x < xs[i + 1])) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  // radius round a ring from samples at even angles: r5 = front, front-side, side, back-side, back (left/right mirrored); limbs take
  // r8 = front, front-out, out, back-out, back, back-in, in, front-in (sd: +1 the right side, out = +X; -1 the left). an as in the
  // lofts: 0 = +X, a quarter turn = the front (+Z)
  const crI = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3); };
  function rad5(r, an) {
    let ph = Math.abs(Math.atan2(Math.sin(an - Math.PI / 2), Math.cos(an - Math.PI / 2))) / (Math.PI / 4); // 0 front .. 4 back
    const i = Math.min(3, Math.floor(ph)), t = ph - i, g = (k) => r[k < 0 ? -k : k > 4 ? 8 - k : k];
    return crI(g(i - 1), g(i), g(i + 1), g(i + 2), t);
  }
  function rad8(r, an, sd) {
    let ph = (sd > 0 ? Math.PI / 2 - an : an - Math.PI / 2) / (Math.PI / 4); ph = ((ph % 8) + 8) % 8;
    const i = Math.floor(ph), t = ph - i, g = (k) => r[((k % 8) + 8) % 8];
    return crI(g(i - 1), g(i), g(i + 1), g(i + 2), t);
  }
  // the neck (athlete, neck factor 1): y, centre z, r5. It runs from inside the collar up under the jaw and into the skull, its
  // back meeting the occiput; the sternocleidomastoids are a ridge (scmK) from behind the ears down to the notch at the collar
  const NECK_K = [[0.68, 0.075, 0.085, 0.095, 0.096, 0.08], [0.72, 0.068, 0.077, 0.084, 0.083, 0.069], [0.75, 0.062, 0.072, 0.077, 0.075, 0.066], [0.78, 0.058, 0.068, 0.074, 0.072, 0.066],
    [0.81, 0.056, 0.065, 0.072, 0.071, 0.067], [0.835, 0.048, 0.062, 0.07, 0.071, 0.067], [0.86, 0.036, 0.056, 0.068, 0.068, 0.064], [0.88, 0.026, 0.048, 0.064, 0.063, 0.057], [0.9, 0.015, 0.036, 0.056, 0.052, 0.046]];
  const NECK_CZ = -0.016;
  const NECK_F = [1, 2, 3, 4, 5].map((k) => pchip(NECK_K.map((r) => r[0]), NECK_K.map((r) => r[k])));
  function neckR5(y, NK) { const nk = NK || 1, dk = 1 + (nk - 1) * 0.8; return [NECK_F[0](y) * dk, NECK_F[1](y) * nk, NECK_F[2](y) * nk, NECK_F[3](y) * nk, NECK_F[4](y) * dk]; }
  function neckRad(y, an, NK) { // the neck's radius at height y round angle an, with the sternocleidomastoid ridge
    const r = rad5(neckR5(y, NK), an), ph = Math.abs(Math.atan2(Math.sin(an - Math.PI / 2), Math.cos(an - Math.PI / 2)));
    const c = lerp(0.42, 1.25, clamp((y - 0.74) / 0.12, 0, 1)), k = clamp((y - 0.725) / 0.02, 0, 1) * clamp((0.875 - y) / 0.03, 0, 1);
    return r + 0.0045 * (NK || 1) * k * Math.exp(-Math.pow((ph - c) / 0.2, 2));
  }
  // the neck as built for a player: his neck factor below the jaw line, the standard neck above it (inside the jaw and the skull,
  // where only the head shows), so a scanned head's neck sized the same way always covers it
  function neckRadP(y, an, NK) {
    const r1 = neckRad(y, an, 1); if (!NK || NK === 1) return r1;
    const k = clamp((0.858 - 0.023 * Math.sin(an) - y) / 0.04, 0, 1);
    return r1 * lerp(1, neckRad(y, an, NK) / r1, k);
  }
  // its weights: the collar end blends chest -> neck (the neck bone turns at its base, 0.70), the top neck -> head along the jaw line,
  // low under the chin and high at the nape; the same function weights the jersey's collar and the scanned heads' necks, so they move together
  function neckWt(y, z) {
    if (y < 0.765) { const t = clamp((y - 0.7) / 0.065, 0, 1); return [B.neck, B.chest, t * t * (3 - 2 * t)]; }
    const yj = z > 0.04 ? 0.79 : z < -0.06 ? 0.86 : lerp(0.86, 0.79, (z + 0.06) / 0.1), t = clamp((y - (yj - 0.03)) / 0.06, 0, 1);
    return [B.head, B.neck, t * t * (3 - 2 * t)];
  }
  // a scanned head (22-heads.js, 09-avatar.js), unpacked into the athlete layout in bind-pose body space: weight it like the body's
  // neck (head above the jaw line, neck below, chest at the collar) so the scan's neck bends with the body, and size its neck to this
  // player's (neck factor NK) as the body's own neck is sized: tools/heads.js left it just clear of the body's neck at factor 1, so
  // scaling both alike keeps the body's neck hidden inside it. The neck tools/heads.js rebuilt below the jaw line (e.neck: from v0)
  // is shaded toward the collar. V: Float32Array of nv vertices (VSTRIDE)
  function headNeck(V, nv, e, NK) {
    const nk = e && e.neck, v0 = nk ? nk.v0 : nv, v1 = nk ? v0 + (nk.n || 0) : nv, rows = nk && nk.rows, vj = nk ? v0 + (nk.j || 0) : nv; // the neck: its jaw row from v0, then its columns of rows from vj
    for (let i = 0; i < nv; i++) {
      const o = i * VSTRIDE, x = V[o], y = V[o + 1], z = V[o + 2];
      if (y > 0.92) continue;
      const an = Math.atan2(z - NECK_CZ, x), r = Math.hypot(x, z - NECK_CZ);
      if (i >= vj && i < v1 && rows) V[o + 12] = lerp(1, 0.5, Math.pow(rows[(i - vj) % rows.length], 1.4)); // shade into the collar
      if (NK !== 1 && r > 0.012 && r < 0.14) { const s = neckRadP(y, an, NK) / neckRad(y, an, 1); V[o] = x * s; V[o + 2] = NECK_CZ + (z - NECK_CZ) * s; } // sized as the body's neck is
      const w = neckWt(y, z); V[o + 6] = w[0]; V[o + 7] = w[1]; V[o + 8] = w[2];
    }
  }
  function buildBody(S, lod) {
    const V = [], I = [];
    let nv = 0;
    // detail: the far / shadow mesh, the game's near mesh, and the player page's close-up (S.bare: the avatar viewer only)
    // detail: the player page's hero most; in game a little under 1 (every near player draws it: the scene's cost); far off the light list
    const Q = lod ? 0.6 : S.bare ? 1.45 : 0.86, HPI = Math.PI / 2, TAU = Math.PI * 2, HERO = !lod && !!S.bare;
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
      for (let i = 0; i < nR; i++) { // normals across the ring and along the loft (scalar math: this runs for every point of every body)
        const row = [], r = R[i], cx = r.cx || 0, cz = r.cz || 0, Pi = P[i];
        let im = i - 1, ip = i + 1; while (im > 0 && R[im].dup) im--; while (ip < nR - 1 && R[ip].dup) ip++; im = Math.max(0, im); ip = Math.min(nR - 1, ip);
        const Pm = P[im], Pp = P[ip], sg = o.flip ? -1 : 1;
        for (let j = 0; j <= seg; j++) {
          const jm = full ? (j === 0 ? seg - 1 : j - 1) : Math.max(0, j - 1), jp = full ? (j === seg ? 1 : j + 1) : Math.min(seg, j + 1);
          const a = Pi[jp], b = Pi[jm], c = Pp[j], d = Pm[j], q = Pi[j];
          const rx = a[0] - b[0], ry = a[1] - b[1], rz = a[2] - b[2];
          let lx = c[0] - d[0], ly = c[1] - d[1], lz = c[2] - d[2];
          if (lx * lx + ly * ly + lz * lz < 1e-12) { lx = 0; ly = 1; lz = 0; }
          let nx = ly * rz - lz * ry, ny = lz * rx - lx * rz, nz = lx * ry - ly * rx;
          const ox = q[0] - cx, oy = q[1] - r.y, oz = q[2] - cz, ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
          let l = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (l < 1e-9) { if (ol > 1e-6) { nx = ox / ol; ny = oy / ol; nz = oz / ol; } else { nx = 0; ny = 1; nz = 0; } } else { nx /= l; ny /= l; nz /= l; }
          if (nx * ox + ny * oy + nz * oz < 0 && ol > 1e-6) { nx = -nx; ny = -ny; nz = -nz; }
          row.push([nx * sg, ny * sg, nz * sg]);
        }
        Nn.push(row);
      }
      const ident = m === IDM, base = nv, bodyP = (p) => (ident ? p : mPt(m, p[0], p[1], p[2])), bodyN = (n) => (ident ? n : v3n([m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[4] * n[0] + m[5] * n[1] + m[6] * n[2], m[8] * n[0] + m[9] * n[1] + m[10] * n[2]]));
      for (let i = 0; i < nR; i++) {
        const r = R[i], s = r.s != null ? r.s : o.s, vv = r.v != null ? r.v : tot > 0 ? tv[i] / tot : 0;
        for (let j = 0; j <= seg; j++) {
          const an = a0 + (a1 - a0) * j / seg, p = bodyP(P[i][j]), n = bodyN(Nn[i][j]), w = r.wa ? r.wa(an, P[i][j]) : r.w || o.w || [0, 0, 1]; // per-vertex weights where the ring has them
          let u = j / seg; if (o.mirrorU) u = 1 - u;
          const ao = (r.ao != null ? r.ao : 1) * (o.ao ? o.ao(i, an) : 1) * (r.aoa ? r.aoa(an) : 1);
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
        const r = R[i], w = r.wa ? r.wa(HPI, [r.cx || 0, r.y, r.cz || 0]) : r.w || o.w || [0, 0, 1], s = r.s != null ? r.s : o.s, rad = r.f ? Math.min(r.rx * r.f(0), r.rz * r.f(HPI), r.rx * r.f(Math.PI), r.rz * r.f(-HPI)) : Math.min(r.rx, r.rz), c = bodyP([r.cx || 0, r.y + dir * rad * 0.3, r.cz || 0]), n = bodyN([0, dir * (o.flip ? -1 : 1), 0]);
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
    // keyed loft: anatomical sections (top to bottom) interpolated into dense rings, every number by a monotone cubic in y, so the
    // silhouette is smooth and never bulges past the keys. A key at the same y as the one before starts a new run (a hard edge:
    // a hem, a cuff). key: { y, r (r5, or r8 with o.sd), cx, cz, s (slot, kept down to the next key that names one), ao, v,
    // fx(an) (extra radius) }; o: { sd, step (ring spacing in yards at the near detail), wf(y) | waf(y) -> (an, p) => weights,
    // aof(y) -> (an) => ao, fxf(y) -> (an) => extra radius } plus the loft's own options. Returns the dense rings (for patches).
    function kloft(o, keys) {
      const step = (o.step || 0.03) * (lod ? 2.3 : HERO ? 0.7 : 1), prof = o.sd ? (r, an) => rad8(r, an, o.sd) : rad5;
      if (lod) keys = keys.filter((k, i) => i === 0 || i === keys.length - 1 || k.s != null || i % 2 === 0 || Math.abs(k.y - keys[i - 1].y) < 1e-7 || Math.abs(keys[i + 1].y - k.y) < 1e-7); // far off: half the sections
      const runs = []; let cur = [keys[0]];
      for (let i = 1; i < keys.length; i++) { if (Math.abs(keys[i].y - cur[cur.length - 1].y) < 1e-7) { runs.push(cur); cur = [keys[i]]; } else cur.push(keys[i]); }
      runs.push(cur);
      const out = [];
      let slot = keys[0].s != null ? keys[0].s : o.s;
      for (const run of runs) {
        const ys = run.map((k) => k.y), F = (get, dflt) => { const v = run.map((k) => { const x = get(k); return x == null ? dflt : x; }); return run.length > 1 ? pchip(ys, v) : () => v[0]; };
        const nr = run[0].r.length, fr = []; for (let c = 0; c < nr; c++) fr.push(F((k) => k.r[c], 0));
        const fcx = F((k) => k.cx, 0), fcz = F((k) => k.cz, 0), fao = F((k) => k.ao, 1), hasV = run.every((k) => k.v != null), fv = hasV ? F((k) => k.v, 0) : null;
        for (let k = 0; k < run.length; k++) {
          const n = k === run.length - 1 ? 1 : Math.max(1, Math.round(Math.abs(run[k + 1].y - run[k].y) / step));
          for (let q = 0; q < n; q++) {
            const y = k === run.length - 1 ? run[k].y : lerp(run[k].y, run[k + 1].y, q / n), key = q === 0 ? run[k] : null;
            if (key && key.s != null) slot = key.s;
            const rr = fr.map((f) => f(y)), fx = key && key.fx, gx = o.fxf ? o.fxf(y) : null;
            const ring = { y, rx: 1, rz: 1, cx: fcx(y), cz: fcz(y), ao: fao(y), s: slot, f: fx || gx ? (an) => prof(rr, an) + (fx ? fx(an) : 0) + (gx ? gx(an) : 0) : (an) => prof(rr, an), rr };
            if (hasV) ring.v = fv(y);
            if (o.waf) ring.wa = o.waf(y) || undefined;
            if (!ring.wa && o.wf) ring.w = o.wf(y);
            if (o.aof) ring.aoa = o.aof(y);
            if (o.fyf) ring.fy = o.fyf(y);
            out.push(ring);
          }
        }
      }
      loft(o, out);
      return out;
    }
    const CAS = S.cas || null; // casual clothes (Metcalf): no pads, no helmet, a slimmer natural build in the mesh only
    const HOOP = !!(CAS && CAS.hoop); // basketball: the casual body with a sleeveless jersey, numbers front and back, team shorts
    const W = S.bulk * (CAS ? 0.93 : 1), W2 = 0.6 + 0.4 * S.bulk * (CAS ? 0.93 : 1), BEL = S.belly, gear = !S.noGear && !CAS;
    const torsoW = (y) => { // weights along the spine: hips -> spine (0.16) -> chest (0.40) -> neck (0.70)
      if (y < 0.16) return wt(y, 0, 0.16, B.hips, B.spine, 0.06);
      if (y < 0.40) return wt(y, 0.16, 0.40, B.spine, B.chest, 0.07);
      if (y < 0.7) return [B.chest, B.neck, 1];
      return neckWt(y, 0);
    };
    // the torso's weights per vertex: below the collar by height; from the pads' top up, the neck's own blend (by height and depth)
    const torsoWa = (y) => (y < 0.7 ? null : (an, p) => { const w = neckWt(y, p ? p[2] : 0), d = p ? Math.hypot(p[0], p[2] - NECK_CZ) : 0, k = clamp((0.135 - d) / 0.035, 0, 1); return [B.neck, B.chest, w[2] * k]; });
    // the pads' arches: in game gear the jersey rises over the pads beside the neck to nearly the jaw, then falls away over the caps
    // (an offset in y at the sides of each top ring; a little at the front and back too)
    const ARCH = pchip([0.765, 0.749, 0.743, 0.735, 0.725, 0.711, 0.69, 0.665, 0.635, 0.6, 0.565], [0.006, 0.007, 0.012, 0.015, 0.015, 0.013, 0.01, 0.007, 0.004, 0.002, 0]);
    // no pads (T-shirts, officials): the trapezius still rises beside the neck, so the neckline sits high at the sides
    // (and behind, the crew neck sits higher than in front, at the base of the neck)
    const ARCH_T = pchip([0.765, 0.748, 0.741, 0.726, 0.706, 0.685, 0.66], [0.012, 0.012, 0.022, 0.028, 0.022, 0.012, 0]), BACK_T = pchip([0.765, 0.748, 0.735, 0.715, 0.69], [0.008, 0.008, 0.006, 0.002, 0]);
    const archY = (y) => (gear ? (an) => ARCH(y) * (0.12 + 0.88 * Math.pow(Math.abs(Math.cos(an)), 1.3)) : (an) => ARCH_T(y) * (0.1 + 0.9 * Math.pow(Math.abs(Math.cos(an)), 1.5)) + BACK_T(y) * Math.pow(Math.max(0, -Math.sin(an)), 1.2));
    const bellyK = (y) => BEL * Math.max(0, Math.sin(Math.PI * clamp((y - 0.06) / 0.34, 0, 1))); // 0..1 over the abdomen
    // a torso key: r5 radii scaled by build (side by bulk, front/back by depth), the belly pushing the front out
    // (the shoulder pads grow with a big build less than the body under them: a lineman's pads are a size up, not half again as wide)
    const TK = (y, r, e) => { const bk = bellyK(y), pk = gear && W > 1 ? clamp((y - 0.5) / 0.12, 0, 1) : 0, Wp = W - (W - 1) * 0.45 * pk * pk * (3 - 2 * pk), Wm = (Wp + W2) / 2; return Object.assign({ y, r: [r[0] * W2 * (1 + 0.42 * bk), r[1] * Wm * (1 + 0.25 * bk), r[2] * Wp * (1 + 0.1 * bk), r[3] * Wm, r[4] * W2], cz: 0.045 * bk }, e || {}); };
    // ---- torso ----
    // gear: the jersey stretched over the shoulder pads: the pads' top nearly flat from the collar out to the caps over the deltoids,
    // the caps rounding down to the armpits; a flat chest plate whose lower edge leaves a little shelf where the jersey drops to the
    // body; the flat back plate; then the jersey taut over the ribs and tucked into the pants at the belt
    // casual: a plain T-shirt on a natural build: the trapezius sloping from the neck to the shoulder seams, the chest and lats, the
    // hem hanging straight over the waistband
    let TKEYS;
    if (CAS) {
      TKEYS = [TK(0.748, [0.071, 0.079, 0.087, 0.085, 0.076], { v: 0, ao: 0.55 }), TK(0.741, [0.083, 0.102, 0.122, 0.115, 0.093], { v: 0.02, ao: 0.72 }), TK(0.726, [0.106, 0.146, 0.176, 0.162, 0.122], { v: 0.05, ao: 0.86 }),
        TK(0.706, [0.13, 0.186, 0.224, 0.2, 0.147], { v: 0.09, ao: 0.95 }), TK(0.685, [0.15, 0.21, 0.258, 0.224, 0.164], { v: 0.13 }), TK(0.66, [0.165, 0.224, 0.278, 0.236, 0.176], { v: 0.17 }),
        TK(0.63, [0.173, 0.229, 0.282, 0.24, 0.183], { v: 0.22 }), TK(0.59, [0.177, 0.229, 0.272, 0.238, 0.186], { v: 0.27 }), TK(0.55, [0.177, 0.226, 0.256, 0.231, 0.184], { v: 0.32 }),
        TK(0.5, [0.175, 0.221, 0.244, 0.223, 0.179], { v: 0.38 }), TK(0.42, [0.171, 0.213, 0.235, 0.215, 0.173], { v: 0.48 }), TK(0.33, [0.167, 0.207, 0.229, 0.209, 0.168], { v: 0.6 }),
        TK(0.24, [0.165, 0.204, 0.226, 0.206, 0.165], { v: 0.72 }), TK(0.15, [0.165, 0.204, 0.225, 0.206, 0.165], { v: 0.84 })];
      // the untucked hem: straight down over the waistband, a little fuller, then turned in
      const pk = (0.85 + 0.15 * S.legs) * (1 + 0.08 * BEL) * 1.04, hz = (0.158 * W2 * (1 + 0.12 * BEL) * 1.04) / (0.165 * W2), hx = Math.max(1, (0.226 * pk) / (0.225 * W));
      const hem = (y, ex, v, ao) => { const k = TK(y, [0.165 * hz + ex / W2, 0.204 * (hx + hz) / 2 + ex, 0.225 * hx + ex / W, 0.206 * (hx + hz) / 2 + ex, 0.165 * hz + ex / W2], { v, ao }); k.cz = 0.02 * BEL; return k; };
      TKEYS.push(hem(0.09, 0.008, 0.9, 0.95), hem(0.03, 0.016, 0.96, 0.9), hem(-0.02, 0.019, 0.99, 0.85), hem(-0.02, 0.004, 1, 0.5));
    } else if (gear) { // v: the kit's collar trim (v 0..0.05) stays in the first section, a band about an inch wide round the neck
      TKEYS = [TK(0.749, [0.074, 0.083, 0.094, 0.09, 0.08], { v: 0, ao: 0.55 }), TK(0.743, [0.098, 0.125, 0.15, 0.135, 0.11], { v: 0.055, ao: 0.7 }), TK(0.735, [0.125, 0.19, 0.262, 0.205, 0.14], { v: 0.072, ao: 0.8 }),
        TK(0.725, [0.148, 0.226, 0.318, 0.244, 0.163], { v: 0.088, ao: 0.88 }), TK(0.711, [0.166, 0.249, 0.352, 0.265, 0.182], { v: 0.103, ao: 0.95 }), TK(0.69, [0.18, 0.263, 0.372, 0.279, 0.194], { v: 0.123 }),
        TK(0.665, [0.19, 0.271, 0.378, 0.287, 0.2], { v: 0.145 }), TK(0.635, [0.196, 0.274, 0.372, 0.286, 0.204], { v: 0.19 }), TK(0.6, [0.199, 0.272, 0.35, 0.279, 0.205], { v: 0.24 }),
        TK(0.565, [0.2, 0.266, 0.31, 0.27, 0.203], { v: 0.29 }), TK(0.53, [0.199, 0.258, 0.272, 0.258, 0.199], { v: 0.335, ao: 0.97 }), TK(0.495, [0.194, 0.246, 0.25, 0.246, 0.193], { v: 0.375, ao: 0.96 }),
        TK(0.472, [0.187, 0.236, 0.242, 0.238, 0.188], { v: 0.405 }), TK(0.454, [0.179, 0.226, 0.237, 0.229, 0.183], { v: 0.432, ao: 0.97 }), TK(0.42, [0.168, 0.214, 0.232, 0.218, 0.176], { v: 0.48 }),
        TK(0.37, [0.158, 0.205, 0.228, 0.208, 0.165], { v: 0.54 }), TK(0.3, [0.153, 0.199, 0.224, 0.2, 0.157], { v: 0.63 }), TK(0.22, [0.149, 0.194, 0.219, 0.195, 0.153], { v: 0.73 }),
        TK(0.185, [0.146, 0.189, 0.213, 0.19, 0.15], { v: 0.8, ao: 0.9 }), TK(0.15, [0.135, 0.177, 0.198, 0.178, 0.138], { v: 0.86, ao: 0.7 }), TK(0.09, [0.132, 0.173, 0.194, 0.174, 0.135], { v: 0.94, ao: 0.6 }), TK(0.05, [0.13, 0.17, 0.19, 0.17, 0.133], { v: 1, ao: 0.5 })];
    } else { // referees and coaches: no pads, a shirt over a natural build
      TKEYS = [TK(0.748, [0.074, 0.082, 0.09, 0.088, 0.078], { v: 0, ao: 0.55 }), TK(0.738, [0.092, 0.118, 0.14, 0.13, 0.102], { v: 0.03, ao: 0.75 }), TK(0.72, [0.12, 0.165, 0.2, 0.18, 0.135], { v: 0.06, ao: 0.9 }),
        TK(0.695, [0.148, 0.205, 0.25, 0.22, 0.16], { v: 0.11 }), TK(0.665, [0.168, 0.228, 0.282, 0.24, 0.178], { v: 0.15 }), TK(0.63, [0.178, 0.236, 0.29, 0.247, 0.186], { v: 0.2 }),
        TK(0.58, [0.183, 0.236, 0.278, 0.244, 0.19], { v: 0.27 }), TK(0.5, [0.18, 0.228, 0.256, 0.232, 0.186], { v: 0.38 }), TK(0.42, [0.175, 0.218, 0.243, 0.222, 0.178], { v: 0.48 }),
        TK(0.33, [0.17, 0.21, 0.235, 0.213, 0.17], { v: 0.6 }), TK(0.24, [0.166, 0.206, 0.229, 0.208, 0.166], { v: 0.72 }), TK(0.15, [0.163, 0.203, 0.225, 0.205, 0.163], { v: 0.84, ao: 0.92 }),
        TK(0.085, [0.163, 0.203, 0.224, 0.205, 0.163], { v: 0.94, ao: 0.75 }), TK(0.05, [0.16, 0.2, 0.22, 0.202, 0.16], { v: 1, ao: 0.6 })];
    }
    // the V-neck (game jerseys): the neckline dips VD at the front middle with straight sides; there the top rings slide down the
    // jersey's own surface, so the opening is a V cut into it, and the collar's trim fills it (a V insert), the neck clear above it
    const VD = gear ? 0.046 : 0, TKF = VD ? [0, 1, 2, 3, 4].map((c) => pchip(TKEYS.map((k) => k.y), TKEYS.map((k) => k.r[c]))) : null;
    const tkR = (y, an) => rad5(TKF.map((f) => f(y)), an), vF = (an) => Math.max(0, 1 - Math.abs(angD(an, HPI)) / 0.72);
    const vDy = (y, an) => -VD * vF(an) * clamp((y - 0.69) / 0.059, 0, 1), vDr = (y, an) => { const dy = vDy(y, an); return dy ? tkR(y + dy, an) - tkR(y, an) : 0; };
    // surface detail (radius offsets round the ring): the pads' two halves meeting down the sternum, the shoulder-blade edges of the
    // back plate, jersey folds where it is tucked and gathered at the armpits; the T-shirt's chest, shoulder blades and soft folds
    const torsoFx = (y) => {
      const ph = (an) => Math.atan2(Math.sin(an - HPI), Math.cos(an - HPI)); // 0 front, +-pi back
      if (CAS) {
        const pec = clamp((y - 0.44) / 0.06, 0, 1) * clamp((0.64 - y) / 0.08, 0, 1), sb = clamp((y - 0.46) / 0.08, 0, 1) * clamp((0.68 - y) / 0.08, 0, 1), fold = clamp((0.3 - y) / 0.2, 0, 1) * (HERO || !lod ? 1 : 0);
        return (an) => { const p = ph(an), a = Math.abs(p); return 0.006 * pec * Math.exp(-Math.pow((a - 0.42) / 0.3, 2)) - 0.004 * pec * Math.exp(-Math.pow(a / 0.1, 2)) + 0.005 * sb * Math.exp(-Math.pow((Math.PI - a - 0.55) / 0.28, 2)) + 0.0022 * fold * Math.sin(an * 9 + y * 31) * Math.sin(an * 4 - y * 17); };
      }
      if (!gear) return null;
      const st = clamp((y - 0.48) / 0.03, 0, 1) * clamp((0.7 - y) / 0.05, 0, 1), bp = clamp((y - 0.4) / 0.04, 0, 1) * clamp((0.69 - y) / 0.06, 0, 1);
      const tuck = clamp((y - 0.195) / 0.02, 0, 1) * clamp((0.28 - y) / 0.05, 0, 1) * (lod ? 0 : 1), pit = clamp((y - 0.47) / 0.04, 0, 1) * clamp((0.6 - y) / 0.05, 0, 1) * (lod ? 0 : 1);
      return (an) => {
        const p = ph(an), a = Math.abs(p);
        return -0.0045 * st * Math.exp(-Math.pow(a / 0.07, 2)) + 0.004 * bp * Math.exp(-Math.pow((Math.PI - a - 0.62) / 0.12, 2)) + 0.0028 * tuck * Math.sin(an * 13 + 0.6) * (0.6 + 0.4 * Math.sin(an * 5)) - 0.004 * pit * Math.exp(-Math.pow((a - HPI) / 0.25, 2)) * (0.5 + 0.5 * Math.sin(y * 260));
      };
    };
    const torsoS = S.noGear && S.cap ? SL.stripes : SL.jer;
    const torsoRings = kloft({ s: torsoS, seg: SG(28), step: 0.03, uv: uvOf('torso'), waf: torsoWa, wf: torsoW,
      fxf: VD ? (y) => { const t = torsoFx(y); return (an) => (t ? t(an) : 0) + vDr(y, an); } : torsoFx, fyf: VD ? (y) => { const a = archY(y); return (an) => a(an) + vDy(y, an); } : archY,
      aof: (y) => (an) => 1 - 0.3 * clamp((y - 0.46) / 0.04, 0, 1) * clamp((0.6 - y) / 0.05, 0, 1) * Math.pow(Math.abs(Math.cos(an)), 6) }, TKEYS); // the armpits in shade
    // the torso's surface radius at (y, an), from its dense rings (each ring's height at that angle, the pads' arches included)
    const torsoAt = (y, an) => {
      const ey = (r) => r.y + (r.fy ? r.fy(an) : 0);
      let k = 1; while (k < torsoRings.length - 1 && ey(torsoRings[k]) > y) k++;
      const a = torsoRings[k - 1], b = torsoRings[k], ya = ey(a), yb = ey(b), t = clamp((ya - y) / (ya - yb || 1e-6), 0, 1); return [lerp(a.f(an), b.f(an), t), lerp(a.cz, b.cz, t)];
    };
    // decal patches (numbers / name plate) ride a hair above the jersey, in rings close enough to follow its curve (a chord across
    // the shoulder blades or the chest would sink in)
    const patch = (s, y0, y1, aC, aW, scale) => {
      const rs = [], n = lod ? 3 : Math.max(3, Math.round(Math.abs(y1 - y0) / 0.027));
      for (let i = 0; i <= n; i++) {
        const y = y0 + (y1 - y0) * i / n;
        rs.push({ y, rx: 1, rz: 1, cz: torsoAt(y, aC)[1] * scale, f: (an) => torsoAt(y, an)[0] * scale + 0.003, w: torsoW(y), v: i / n, ao: 0.95 });
      }
      loft({ s, seg: SG(8), a0: aC - aW, a1: aC + aW }, rs);
    };
    if (HOOP) { // a basketball jersey: the number high on the chest and big in the middle of the back
      patch(SL.num, 0.6, 0.44, HPI, 0.42, 1.006);
      patch(SL.num, 0.6, 0.34, -HPI, 0.5, 1.006);
    }
    if (gear) {
      patch(SL.num, 0.645, 0.37, HPI, 0.56, 1.004);          // front number (big, on the chest under the V)
      patch(SL.num, 0.56, 0.24, -HPI, 0.62, 1.004);          // back number
      if (!lod) patch(SL.name, 0.645, 0.585, -HPI, 0.75, 1.004); // name plate
    }
    // ---- neck (shared profile with the scanned heads: neckRad / neckWt) and the collar ----
    const NK = S.neck * (CAS ? 1.0 : 1);
    // the neck's weights, never all head: under a scanned head the shader drops head-only vertices above 0.8 (the drawn head) to the
    // body's origin, and a ring of this loft dropped next to one kept would stretch slivers down to the hips when the neck bends; so
    // the whole neck stays, inside the scan
    const neckLoftWt = (y) => (an, p) => { const w = neckWt(y, p[2]); return w[0] === B.head && w[2] > 0.998 ? [w[0], w[1], 0.998] : w; };
    { // dense rings from inside the collar up into the skull, top first
      const rings = [], n = Math.max(6, Math.round(12 * Q));
      for (let i = 0; i <= n; i++) {
        const y = 0.9 - (0.9 - 0.69) * i / n;
        const tuck = 0.0055 * clamp((y - 0.752) / 0.025, 0, 1); // a little inside the profile where the jaw and the scans' necks cover it
        rings.push({ y, rx: 1, rz: 1, cz: NECK_CZ, f: (an) => neckRadP(y, an, NK) - tuck, wa: neckLoftWt(y), ao: y < 0.735 ? 0.45 : y < 0.765 ? 0.45 + (y - 0.735) * 14 : y > 0.84 ? 0.75 : 0.88 });
      }
      loft({ s: SL.skin, seg: SG(15), capTop: true }, rings);
    }
    // collar: a ribbed band round the neck on the pads' opening (game jerseys), a crew-neck rib on the T-shirt; weighted with the neck
    {
      const top = TKEYS[0], t2 = TKEYS[1], nk = (y) => (an) => neckRadP(y, an, NK);
      const band = gear ? [[0.7535, (an) => nk(0.752)(an) - 0.0015, 0.75], [0.7555, (an) => nk(0.752)(an) + 0.007, 0.95], [0.751, (an) => rad5(top.r, an) + 0.009, 1], [0.7455, (an) => rad5(t2.r, an) * 0.92 + rad5(top.r, an) * 0.08 + 0.004, 0.9], [0.7435, (an) => rad5(t2.r, an) * 0.92 + rad5(top.r, an) * 0.08 - 0.002, 0.8]]
        : [[0.7525, (an) => nk(0.752)(an) - 0.0012, 0.75], [0.754, (an) => nk(0.752)(an) + 0.004, 0.95], [0.7505, (an) => rad5(top.r, an) + 0.0045, 1], [0.7465, (an) => rad5(top.r, an) * 0.6 + rad5(t2.r, an) * 0.4 - 0.001, 0.85]];
      const dip = (an) => -0.006 * Math.exp(-Math.pow(Math.atan2(Math.sin(an - HPI), Math.cos(an - HPI)) / 0.5, 2)); // a touch lower at the throat
      // (game jerseys: the band's outer rings follow the V's edge down the jersey, its inner ones stay round the neck)
      const rs = band.map(([y, f, ao], i) => { const ay = archY(i < 2 ? 0.749 : y), v = VD && i >= 2; return { y, rx: 1, rz: 1, cz: top.cz || 0, f: v ? (an) => f(an) + vDr(0.749, an) : f, fy: (an) => dip(an) + ay(an) + (v ? vDy(0.749, an) : 0), ao, wa: (an, p) => neckWt(Math.min(y, 0.76), p[2]) }; });
      if (CAS) loft({ s: SL.jer, seg: SG(24), uv: uvOf('torso', 0, 1, 0, 0.03) }, rs);
      else loft({ s: SL.trim, seg: SG(24) }, rs);
    }
    // ---- head (human scale: ~0.2 yd wide, 0.26 tall): jaw, cheekbones, brow, crown; eye sockets; nose; ears ----
    const HW = [B.head, B.neck, 1];
    const faceF = (y) => (an) => { // radius modulation round the ring: brow ridge, eye sockets, cheekbones, the hollow under them, lips,
      // chin, the jaw's angle under the ears, occipital bulge (each a smooth bump, so the denser rings make no ledges)
      const f = Math.max(0, Math.sin(an)), d = Math.abs(angD(an, HPI)), g = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
      let k = 1;
      k -= 0.06 * f * Math.max(0, 1 - Math.abs(d - 0.4) * 2.6) * Math.max(0, Math.sin(Math.PI * clamp((y - 0.933) / 0.052, 0, 1))); // sockets
      k += 0.02 * f * g(y, 0.981, 0.009) * Math.max(0, 1 - d / 0.95); // brow ridge
      k += 0.035 * f * Math.max(0, d - 0.5) * clamp((y - 0.895) / 0.01, 0, 1) * clamp((0.955 - y) / 0.01, 0, 1); // cheekbones
      k += 0.022 * g(y, 0.925, 0.014) * g(d, 0.75, 0.22); // the cheekbone's point
      k -= 0.016 * g(y, 0.889, 0.016) * g(d, 0.8, 0.25); // a little hollow below it
      k += 0.012 * g(y, 0.893, 0.007) * g(d, 0, 0.3); // lips
      k += 0.07 * f * (1 - Math.min(1, d * 1.5)) * smo(clamp((0.886 - y) / 0.022, 0, 1)); // chin forward
      k += 0.03 * g(y, 0.862, 0.02) * g(d, 1.15, 0.25); // the jaw's angle
      k += 0.025 * Math.max(0, -Math.sin(an)); // occipital bulge
      return k;
    };
    // the rings: sections through the skull and face (rx, rz, centre z, ao), denser over the face at full detail
    const HRK = [[0.828, 0.04, 0.044, 0.034, 0.6], [0.85, 0.066, 0.072, 0.022, 0.7], [0.878, 0.083, 0.09, 0.011, 0.78], [0.905, 0.093, 0.1, 0.005, 0.85], [0.932, 0.099, 0.104, 0.002, 0.88], [0.957, 0.101, 0.106, 0, 0.9],
      [0.985, 0.1, 0.107, 0.003, 0.85], [1.013, 0.096, 0.1, 0, 0.75], [1.042, 0.082, 0.084, -0.003, 0.6], [1.066, 0.05, 0.051, -0.005, 0.5], [1.08, 0.012, 0.012, -0.005, 0.5]];
    const HRF = [1, 2, 3, 4].map((c) => pchip(HRK.map((k) => k[0]), HRK.map((k) => k[c])));
    const HR = (lod ? HRK.map((k) => k[0]) : [0.828, 0.839, 0.85, 0.864, 0.878, 0.891, 0.905, 0.918, 0.932, 0.944, 0.957, 0.971, 0.985, 0.999, 1.013, 1.028, 1.042, 1.066, 1.08]).map((y) => ({ y, rx: HRF[0](y), rz: HRF[1](y), cz: HRF[2](y), ao: HRF[3](y) }));
    for (const r of HR) { r.w = HW; r.f = faceF(r.y); }
    loft({ s: SL.skin, seg: SG(20), capTop: false, capBot: true }, HR.slice().reverse());
    // face patch: the front arc of the head rings, slightly proud of the skin; photo UVs put the eyes at v ~ 0.4 and the chin at the bottom
    {
      const FR = [];
      const yTop = 1.045, yBot = 0.826;
      for (let i = HR.length - 1; i >= 0; i--) { const r = HR[i]; if (r.y > yTop + 0.02 || r.y < yBot) continue; FR.push(Object.assign({}, r, { f: (an) => { const e = Math.min(1, (1.3 - Math.abs(angD(an, HPI))) / 0.45); return r.f(an) * (1 + 0.004 + 0.011 * e) + (0.0006 + 0.0009 * e) / r.rx; }, v: clamp((yTop - r.y) / (yTop - yBot), 0, 1), ao: 0.95 })); } // (proud of the skin, less so toward its edges, which then barely show)
      loft({ s: SL.face, seg: SG(14), a0: HPI - 1.3, a1: HPI + 1.3, mirrorU: true }, FR);
    }
    if (!lod) {
      // nose: bridge to tip
      loft({ s: SL.face, seg: SG(8), capBot: true, w: HW, uv: [0.49, 0.51, 0.47, 0.55] }, [{ y: 0.975, rx: 0.009, rz: 0.004, cz: 0.1, w: HW, ao: 0.95 }, { y: 0.958, rx: 0.011, rz: 0.006, cz: 0.108, w: HW, ao: 0.95 }, { y: 0.94, rx: 0.0125, rz: 0.009, cz: 0.115, w: HW, ao: 0.95 },
        { y: 0.924, rx: 0.016, rz: 0.012, cz: 0.122, w: HW, ao: 0.92 }, { y: 0.912, rx: 0.019, rz: 0.011, cz: 0.12, w: HW, ao: 0.85 }, { y: 0.904, rx: 0.015, rz: 0.007, cz: 0.112, w: HW, ao: 0.75 }]);
      // eyes: spheres in the sockets (the iris is shaded from the gaze direction)
      for (const sd of [-1, 1]) ellipsoid({ s: SL.eye, seg: SG(10), w: HW, ring: () => ({ w: HW, ao: 1 }) }, [sd * 0.035, 0.955, 0.0885], 0.0135, 0.0085, 0.0125, 0, Math.PI, 5); // (flattened top and bottom: the lids)
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
      // the lining: only its front half (all that shows through the face opening) and well inside the shell, so no depth buffer,
      // however coarse (phones), can mix the dark lining into the shell from outside
      const front = helmSkip(thAt);
      if (!lod) ellipsoid({ s: SL.pad, seg: SG(30), uv: uvOf('helm'), skip: (i, j, an) => front(i, j, an) || Math.abs(angD(an, HPI)) > 1.9, flip: true, ring: (th, i) => Object.assign(helmRing(th, i), { ao: 0.35, rx: Math.max(1e-4, HRR[0] * 0.91 * Math.sin(th)), rz: Math.max(1e-4, HRR[2] * 0.91 * Math.sin(th)) }) }, HEC, HRR[0] * 0.91, HRR[1] * 0.91, HRR[2] * 0.91, 0.35, HELM_TH, NHR);
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
    // ---- arms: the jersey sleeve over the pad's epaulet (a dome that starts under the cap), then the bare arm: deltoid insertion,
    // biceps in front and triceps behind, the elbow with its point (olecranon) behind, the forearm full below the elbow
    // (brachioradialis) tapering to a wrist that is wide across and thin front to back. Bind pose: hanging, palm forward ----
    // a superellipse section (a rounded rectangle for the palm): half widths a (x) and b (z), squareness n
    const se = (an, a, b, n) => Math.pow(Math.pow(Math.abs(Math.cos(an) / a), n) + Math.pow(Math.abs(Math.sin(an) / b), n), -1 / n);
    for (const sd of [-1, 1]) {
      const sh = sd < 0 ? B.shL : B.shR, el = sd < 0 ? B.elL : B.elR, ha = sd < 0 ? B.haL : B.haR, X = BIND[sh][0], AW = S.arms, mir = sd < 0;
      const EY = 0.28;
      // weights: the sleeve's top shares the chest; the elbow blends narrowly at its point (behind) and widely in the crook (in
      // front), so a bent elbow keeps its point and the crook folds instead of pinching; the wrist hands over to the hand
      const phOf = (an) => { let p = sd > 0 ? HPI - an : an - HPI; p = ((p % TAU) + TAU) % TAU; return p > Math.PI ? TAU - p : p; }; // 0 front .. pi back
      const armWa = (y) => {
        if (y > 0.6) { const t = clamp((y - 0.6) / 0.08, 0, 1); return () => [sh, B.chest, 1 - 0.38 * t * t]; }
        if (y > 0.36) return () => [sh, el, 1];
        if (y > 0.19) return (an) => { const z = lerp(0.07, 0.022, Math.pow(phOf(an) / Math.PI, 1.5)), c = EY + 0.012 * (1 - phOf(an) / Math.PI), t = clamp((y - (c - z)) / (2 * z), 0, 1), s = t * t * (3 - 2 * t); return [sh, el, s]; };
        if (y > 0.04) return () => [el, ha, 1];
        const t = clamp((y + 0.03) / 0.07, 0, 1); return () => [el, ha, t * t * (3 - 2 * t)];
      };
      const sleeve = gear || CAS ? SL.jer : SL.stripes, armS = S.sleeves ? SL.arm : SL.skin, A2 = CAS ? AW * 0.88 : AW;
      // the casual upper arm hangs a little inside the (wide) shoulder joint, so a kid's shoulders read narrower than a padded player's
      const ix = (y) => (CAS ? -sd * 0.026 * clamp((y - 0.34) / 0.28, 0, 1) : 0);
      const AK = (y, r, e) => Object.assign({ y, r: r.map((x) => x * A2), cx: X + ix(y) }, e || {});
      let keys;
      const skinArm = [AK(0.5, [0.078, 0.076, 0.075, 0.079, 0.08, 0.07, 0.065, 0.071]), AK(0.46, [0.079, 0.073, 0.07, 0.076, 0.078, 0.067, 0.062, 0.07]), AK(0.41, [0.075, 0.068, 0.065, 0.071, 0.073, 0.063, 0.059, 0.066]),
        AK(0.36, [0.066, 0.063, 0.06, 0.065, 0.066, 0.059, 0.056, 0.06]), AK(0.32, [0.058, 0.058, 0.056, 0.059, 0.06, 0.056, 0.054, 0.055]), AK(0.285, [0.055, 0.057, 0.056, 0.059, 0.062, 0.056, 0.053, 0.052]),
        AK(0.255, [0.058, 0.063, 0.059, 0.058, 0.057, 0.054, 0.053, 0.055]), AK(0.21, [0.058, 0.063, 0.058, 0.055, 0.053, 0.052, 0.052, 0.055]), AK(0.15, [0.052, 0.055, 0.051, 0.048, 0.046, 0.046, 0.047, 0.049]),
        AK(0.08, [0.042, 0.045, 0.043, 0.039, 0.036, 0.038, 0.041, 0.041]), AK(0.02, [0.032, 0.037, 0.041, 0.035, 0.029, 0.034, 0.039, 0.035]), AK(-0.028, [0.03, 0.035, 0.039, 0.033, 0.027, 0.032, 0.037, 0.033])];
      if (HOOP) { // sleeveless: bare shoulders from the jersey's armhole down
        keys = [AK(0.668, [0.045, 0.05, 0.04, 0.05, 0.05, 0.045, 0.04, 0.045], { s: SL.skin, ao: 0.8, v: 0 }), AK(0.645, [0.077, 0.079, 0.071, 0.079, 0.079, 0.073, 0.066, 0.071], { ao: 0.9 }),
          AK(0.6, [0.085, 0.087, 0.084, 0.088, 0.087, 0.081, 0.075, 0.08]), AK(0.54, [0.084, 0.085, 0.084, 0.087, 0.086, 0.08, 0.075, 0.079])].concat(skinArm.slice(1).map((k) => Object.assign({}, k, { r: k.r.map((x) => x * 0.93) })));
      } else if (CAS) { // a T-shirt's short sleeve: loose over the deltoid, hemmed above the elbow
        keys = [AK(0.668, [0.045, 0.05, 0.04, 0.05, 0.05, 0.045, 0.04, 0.045], { s: sleeve, ao: 0.9, v: 0 }), AK(0.645, [0.084, 0.086, 0.078, 0.086, 0.086, 0.08, 0.072, 0.078], { v: 0.15 }),
          AK(0.6, [0.093, 0.095, 0.092, 0.096, 0.095, 0.089, 0.082, 0.087], { v: 0.4 }), AK(0.54, [0.094, 0.095, 0.094, 0.097, 0.096, 0.09, 0.085, 0.089], { v: 0.7 }), AK(0.478, [0.094, 0.094, 0.093, 0.096, 0.095, 0.09, 0.085, 0.088], { v: 1, ao: 0.92 }),
          AK(0.478, [0.084, 0.083, 0.082, 0.085, 0.085, 0.08, 0.076, 0.079], { s: armS, ao: 0.55 }), AK(0.46, [0.078, 0.073, 0.07, 0.076, 0.078, 0.067, 0.062, 0.07], { ao: 0.75 })].concat(skinArm.slice(2).map((k) => Object.assign({}, k, { r: k.r.map((x) => x * 0.93) })));
      } else {
        keys = [AK(0.69, [0.06, 0.062, 0.05, 0.06, 0.065, 0.06, 0.055, 0.058], { s: sleeve, ao: 0.85, v: 0 }), AK(0.66, [0.085, 0.085, 0.072, 0.085, 0.088, 0.08, 0.072, 0.08], { v: 0.12 }),
          AK(0.63, [0.095, 0.097, 0.088, 0.098, 0.098, 0.088, 0.08, 0.088], { v: 0.3 }), AK(0.6, [0.095, 0.1, 0.096, 0.1, 0.098, 0.089, 0.081, 0.088], { v: 0.48 }),
          AK(0.565, [0.091, 0.095, 0.095, 0.096, 0.094, 0.086, 0.079, 0.084], { v: 0.6 }), AK(0.52, [0.089, 0.089, 0.087, 0.091, 0.091, 0.081, 0.075, 0.08], { v: 0.8 }), AK(0.48, [0.088, 0.085, 0.082, 0.087, 0.088, 0.077, 0.071, 0.079], { v: 0.95 }), AK(0.47, [0.087, 0.084, 0.081, 0.086, 0.087, 0.076, 0.07, 0.078], { v: 1, ao: 0.92 }),
          AK(0.47, [0.079, 0.074, 0.071, 0.077, 0.079, 0.068, 0.063, 0.071], { s: armS, ao: 0.55 })].concat(skinArm.slice(2).map((k, i) => (i === 0 ? Object.assign({}, k, { ao: 0.82 }) : k)));
        if (!gear) keys[0].s = sleeve;
      }
      // the arm's own AO: the crook of the elbow in shade
      const armRings = kloft({ sd, seg: SG(15), step: 0.03, uv: uvOf('sleeve'), mirrorU: mir, capTop: true, waf: armWa,
        aof: (y) => (an) => 1 - 0.22 * Math.max(0, Math.cos(phOf(an))) * clamp((0.045 - Math.abs(y - 0.28)) / 0.045, 0, 1) }, keys);
      if (!lod && gear) { // sleeve number on the outside of the sleeve, just over the sleeve's own surface (its dense rings)
        const armAt = (y, an) => { let k = 1; while (k < armRings.length - 1 && armRings[k].y > y) k++; const a = armRings[k - 1], b = armRings[k], t = clamp((a.y - y) / (a.y - b.y || 1e-6), 0, 1); return lerp(a.f(an), b.f(an), t); };
        const rs = []; for (let i = 0; i <= 2; i++) { const y = 0.615 - 0.06 * i; rs.push({ y, rx: 1, rz: 1, cx: X, f: (an) => armAt(y, an) * 1.012 + 0.0032, v: i / 2, ao: 0.95, wa: armWa(y) }); }
        loft({ s: SL.snum, seg: SG(6), a0: (sd > 0 ? 0 : Math.PI) - 0.5, a1: (sd > 0 ? 0 : Math.PI) + 0.5 }, rs);
      }
      // wrist tape over the wrist
      if (!lod && !CAS) loft({ s: SL.tape, seg: SG(12) }, [0.03, 0.012, -0.012, -0.03].map((y, i) => ({ y, rx: 1, rz: 1, cx: X, f: (an) => rad8(i < 2 ? [0.033, 0.038, 0.043, 0.037, 0.031, 0.036, 0.041, 0.037] : [0.032, 0.037, 0.041, 0.035, 0.029, 0.034, 0.039, 0.035], an, sd) * AW + (i === 0 || i === 3 ? 0.002 : 0.0035), wa: armWa(y), ao: i === 0 || i === 3 ? 0.8 : 1 })));
      hand(sd, X, ha, el, gear ? SL.glove : SL.skin, AW, armWa);
    }
    // ---- hands: a palm with the thumb's mound and the knuckles, four jointed fingers in a relaxed curl and a thumb that lies along
    // the index finger; gloved in the game (the glove's palm side white, its back in team colour), bare at Metcalf ----
    function hand(sd, X, ha, el, GS, AW, armWa) {
      const HWt = [ha, el, 1], gl = GS === SL.glove ? 0.0026 : 0, hk = 0.92 + 0.08 * AW, fk = GS === SL.glove ? 1.18 : 1.08; // a glove's thickness (padded fingers); bigger players, bigger hands (a little)
      const gu = (u, v) => [KIT.glove[0] + (KIT.glove[2] - KIT.glove[0]) * u, KIT.glove[1] + (KIT.glove[3] - KIT.glove[1]) * v];
      const out = (an) => (sd > 0 ? Math.cos(an) : -Math.cos(an)); // +1 toward the thumb side
      // palm sections: y, half width, half thickness, squareness, forward shift
      const PS = [[-0.026, 0.037, 0.027, 2.2, 0], [-0.05, 0.045, 0.024, 2.6, 0.002], [-0.085, 0.049, 0.0215, 3.0, 0.002], [-0.12, 0.05, 0.02, 3.2, 0.0015], [-0.143, 0.049, 0.0185, 3.0, 0.0005], [-0.156, 0.045, 0.015, 2.6, 0]];
      if (lod) PS.splice(4, 2, [-0.15, 0.046, 0.015, 2.8, 0]);
      const rings = PS.map(([y, a, b, n, z]) => ({ y: y * hk, rx: 1, rz: 1, cx: X, cz: z, w: HWt, ao: 1,
        f: (an) => {
          const s = Math.sin(an), o = out(an), yy = -y;
          let r = se(an, a * hk, b * hk, n);
          r += 0.0095 * Math.max(0, s) * Math.max(0, o) * clamp((yy - 0.035) / 0.02, 0, 1) * clamp((0.115 - yy) / 0.03, 0, 1); // thenar (the thumb's mound)
          r += 0.0035 * Math.max(0, s) * Math.max(0, -o) * clamp((yy - 0.05) / 0.02, 0, 1) * clamp((0.13 - yy) / 0.03, 0, 1); // hypothenar
          if (yy > 0.13) r += 0.0025 * Math.max(0, -s) * (0.5 + 0.5 * Math.cos((Math.cos(an) * 0.046 - 0.0105) / 0.021 * TAU)); // knuckles
          return r + gl;
        } }));
      loft({ s: GS, seg: SG(12), uv: uvOf('glove'), capBot: true, w: HWt }, rings);
      if (lod) { // far: the fingers as one curled block
        loft({ s: GS, seg: SG(8), w: HWt, capBot: true }, [{ y: -0.15 * hk, rx: 0.046 * hk, rz: 0.015, cx: X, cz: 0.004, w: HWt }, { y: -0.215 * hk, rx: 0.042 * hk, rz: 0.014, cx: X, cz: 0.022, w: HWt }, { y: -0.245 * hk, rx: 0.026 * hk, rz: 0.011, cx: X, cz: 0.038, w: HWt }]);
        tube({ s: GS, w: HWt }, [[X + sd * 0.04 * hk, -0.065 * hk, 0.012], [X + sd * 0.055 * hk, -0.1 * hk, 0.03], [X + sd * 0.058 * hk, -0.13 * hk, 0.042]], 0.012, 5, (t) => 1 - 0.2 * t);
        return;
      }
      // a finger: a chain of segments flexing toward the palm (+Z); its tube's u reads the glove's palm (front) or back
      const digit = (base, dir, side, lens, flex, r0) => {
        const pts = [base.slice()], rad = [r0]; let d = v3n(dir), p = base.slice();
        const ax = v3n(v3c(d, [0, 0, 1])); // the bending axis (across the finger)
        for (let k = 0; k < lens.length; k++) {
          const sub = HERO ? 3 : lod ? 1 : 1;
          for (let q = 1; q <= sub; q++) {
            const a = flex[k] / sub, c = Math.cos(a), s = Math.sin(a); // rotate d about ax toward the palm (+Z): ax x d is +Z's part across d
            d = v3n(v3a([d[0] * c, d[1] * c, d[2] * c], v3c(ax, d), s));
            p = v3a(p, d, lens[k] / sub); pts.push(p.slice()); rad.push(r0 * (1 - 0.22 * (k + q / sub) / lens.length) * (q === sub && k < lens.length - 1 ? 1.06 : 1));
          }
        }
        pts.push(v3a(p, d, r0 * 0.55)); rad.push(r0 * 0.45); // a rounded tip
        const seg = SG(6), base0 = nv, n = pts.length;
        let Xf = null; const frames = [];
        for (let i = 0; i < n; i++) {
          const T = v3n(v3s(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
          if (!Xf) Xf = v3c(T, [0, 0, 1]); else Xf = v3s(Xf, [T[0] * v3d(Xf, T), T[1] * v3d(Xf, T), T[2] * v3d(Xf, T)]);
          Xf = v3n(Xf); frames.push([Xf, v3c(T, Xf)]);
        }
        for (let i = 0; i < n; i++) for (let j = 0; j <= seg; j++) {
          const an = j / seg * TAU, [Xa, Ya] = frames[i], nn = v3a(v3a([0, 0, 0], Xa, Math.cos(an) * 1.08), Ya, Math.sin(an) * 0.94), nr = v3n(nn), rr = (rad[i] * fk + gl) * hk;
          const pz = nr[2], uv = gu(0.25 + 0.25 * pz, 0.55 + 0.4 * i / (n - 1));
          push(v3a(pts[i], nn, rr), nr, HWt[0], HWt[1], HWt[2], GS, uv[0], uv[1], i === 0 ? 0.75 : 1 - 0.15 * Math.max(0, -pz) * (side || 0));
        }
        for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = base0 + i * (seg + 1) + j, c = a + seg + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
        const T = v3n(v3s(pts[n - 1], pts[n - 2])), pole = push(v3a(pts[n - 1], T, rad[n - 1] * hk * 0.6), T, HWt[0], HWt[1], HWt[2], GS, gu(0.4, 0.97)[0], gu(0.4, 0.97)[1], 1);
        for (let j = 0; j < seg; j++) { const a = base0 + (n - 1) * (seg + 1) + j; I.push(pole, a, a + 1); }
      };
      // index, middle, ring, little: knuckle x across the palm (toward the thumb +), length, radius, curl per joint (relaxed: the
      // fingers together, a soft group curl, each a little more than the one before)
      const F = [[0.032, -0.148, 0.084, 0.0102, [0.2, 0.3, 0.16], -0.008], [0.0108, -0.152, 0.091, 0.0106, [0.24, 0.34, 0.18], 0], [-0.0105, -0.149, 0.086, 0.0099, [0.28, 0.38, 0.2], 0.01], [-0.031, -0.142, 0.069, 0.0089, [0.32, 0.42, 0.22], 0.022]];
      for (const [fx, fy, len, r0, flex, spl] of F) digit([X + sd * fx * hk, fy * hk + 0.012, 0.003], [sd * spl, -1, 0.04], 1, [len * 0.45 * hk, len * 0.3 * hk, len * 0.25 * hk], flex, r0);
      // the thumb: from its base in the heel of the hand, down, out and forward, lying along the index finger
      digit([X + sd * 0.032 * hk, -0.048 * hk, 0.009], [sd * 0.16, -0.86, 0.46], 0, [0.033 * hk, 0.029 * hk, 0.025 * hk], [0.1, 0.18, 0.14], 0.0132);
    }
    // ---- hips and legs ----
    // the natural leg (r8 per height on the full-length leg, LW 1): glutes behind the hip, the quads in front, the inner thigh
    // narrowing to the knee with the teardrop of the inner quad above it, the kneecap, the calf (its inner head bigger and lower),
    // the shin flat in front, the Achilles behind, the ankle bones (the outer one lower)
    const LEG = [[0.02, [0.07, 0.062, 0.04, 0.07, 0.08, 0.066, 0.055, 0.062]], [-0.07, [0.116, 0.108, 0.075, 0.114, 0.13, 0.112, 0.11, 0.108]], [-0.11, [0.117, 0.112, 0.086, 0.115, 0.127, 0.114, 0.122, 0.113]], [-0.16, [0.113, 0.11, 0.09, 0.104, 0.105, 0.104, 0.113, 0.11]],
      [-0.24, [0.106, 0.104, 0.09, 0.094, 0.094, 0.093, 0.099, 0.102]], [-0.33, [0.096, 0.095, 0.085, 0.086, 0.085, 0.082, 0.086, 0.09]], [-0.42, [0.083, 0.083, 0.076, 0.075, 0.074, 0.073, 0.077, 0.082]],
      [-0.47, [0.075, 0.074, 0.069, 0.068, 0.068, 0.068, 0.073, 0.076]], [-0.51, [0.071, 0.068, 0.066, 0.066, 0.065, 0.066, 0.068, 0.068]], [-0.555, [0.064, 0.064, 0.064, 0.066, 0.066, 0.066, 0.063, 0.062]],
      [-0.6, [0.059, 0.064, 0.067, 0.072, 0.074, 0.074, 0.065, 0.058]], [-0.66, [0.056, 0.064, 0.069, 0.076, 0.079, 0.079, 0.067, 0.055]], [-0.73, [0.053, 0.06, 0.063, 0.068, 0.07, 0.072, 0.061, 0.052]],
      [-0.8, [0.047, 0.052, 0.054, 0.056, 0.057, 0.057, 0.052, 0.046]], [-0.88, [0.041, 0.045, 0.045, 0.045, 0.045, 0.044, 0.043, 0.04]], [-0.95, [0.037, 0.041, 0.043, 0.041, 0.037, 0.04, 0.042, 0.037]],
      [-0.99, [0.037, 0.043, 0.048, 0.041, 0.036, 0.041, 0.047, 0.038]], [-1.04, [0.041, 0.045, 0.047, 0.043, 0.039, 0.043, 0.046, 0.041]]];
    const LEGF = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => pchip(LEG.map((k) => k[0]), LEG.map((k) => k[1][c])));
    const legAt = (y) => LEGF.map((f) => f(y));
    const legYi = (Y) => (Y >= -0.03 - 0.97 * LL ? (Y + 0.03) / LL - 0.03 : Y - 0.97 * (1 - LL)); // legY's inverse: the full-length leg's height
    const legPY = (y) => (y < -0.03 ? legY(y) : y); // body height of a leg-height (the hips above the hip joints keep their size)
    const PLX = CAS ? 1.04 : 1; // casual bottoms sit a little looser than game pants
    const PS = CAS ? SL.cloth : SL.pant;
    // the hips' outline (r5 round the body's middle, forward with the belly) from the waistband to the crotch: the belt at the top of
    // game pants, the seat and the glutes full behind, the thighs' tops at the crotch
    const PW = PLX * (0.85 + 0.15 * S.legs) * (1 + 0.08 * BEL), PD = PLX * W2 * (1 + 0.12 * BEL), PCZ = 0.02 * BEL;
    const PELK = (CAS ? [[0.05, [0.13, 0.168, 0.19, 0.168, 0.132]], [0.025, [0.142, 0.182, 0.205, 0.183, 0.146]]]
      : [[0.17, [0.143, 0.18, 0.206, 0.18, 0.143]], [0.147, [0.145, 0.183, 0.208, 0.183, 0.146]], [0.1, [0.148, 0.188, 0.212, 0.19, 0.155]]])
      .concat([[0.03, [0.142, 0.19, 0.22, 0.2, 0.17]], [-0.03, [0.132, 0.19, 0.227, 0.206, 0.176]], [-0.09, [0.122, 0.184, 0.226, 0.204, 0.164]]]);
    const PELF = [0, 1, 2, 3, 4].map((c) => pchip(PELK.map((k) => k[0]), PELK.map((k) => k[1][c])));
    const YC0 = -0.09, YC1 = -0.26; // the crotch (the legs part below it) and where each leg is wholly its own ring
    const pelR = (y, an) => { // the hips' radius round (0, PCZ) at leg-height y (frozen below the crotch), with the seat and the belt
      const yy = Math.max(y, YC0), r = PELF.map((f) => f(yy)), p = Math.atan2(Math.sin(an + HPI), Math.cos(an + HPI)); // p: 0 at the back's middle
      const sk = clamp((0.07 - y) / 0.05, 0, 1) * clamp((y + 0.16) / 0.06, 0, 1);
      return rad5([r[0] * PD, r[1] * (PW + PD) / 2, r[2] * PW, r[3] * (PW + PD) / 2, r[4] * PD], an) + sk * (0.013 * Math.exp(-Math.pow((Math.abs(p) - 0.62) / 0.42, 2)) - 0.008 * Math.exp(-Math.pow(p / 0.12, 2))) + (gear && y > 0.148 ? 0.0035 : 0);
    };
    // one leg's surface from the waistband down: rows of leg-heights, and round each row NO columns over the outside (front middle ->
    // outside -> back middle) and NI over the inside (back middle -> inside -> front middle). Above the crotch the ring is this
    // side's half of the hips, closed along the body's middle (x = 0), where the other leg's half meets it point for point (same
    // places, same weights: the hips only there); below YC1 it is the leg's own ring legR(y, an); between them each column blends
    // from one to the other, so the hips flow into the thigh with only the crotch's notch between the legs. Columns sit exactly on
    // the middle's front and back points; below the crotch they ease to an even spread, the angles a kloft with NO + NI segments
    // uses, so a kloft can carry on from the last ring edge to edge. o: { rows: [[y, v]...] (a repeated y is a seam in the
    // texture), s, legR(y, an), waf(y) -> (an, p) -> w, aof(y) -> (an) -> ao, ao(y), us: [u at the front, at the back, inside at
    // the back, inside at the front], uvr }
    function legSurf(sd, X, o) {
      const NO = SG(16), NI = SG(8), NC = NO + NI, LCZ = 0.004, step = TAU / NC, thU0 = -HPI + Math.round((HPI + TAU / 3) / step) * step; // (the even spread starts front-inside)
      const mir = (th) => (sd > 0 ? th : Math.PI - th); // angles are worked out for the right leg and mirrored for the left
      // the hips' edge along a ray from the leg's middle (inside the outline at t = 0, outside by t = 0.4); the body's middle plane
      const pelHit = (y, th) => { const a = mir(th), dx = Math.cos(a), dz = Math.sin(a); let lo = 0, hi = 0.4; for (let it = 0; it < 22; it++) { const t = (lo + hi) / 2, x = X + dx * t, z = LCZ + dz * t - PCZ; if (Math.hypot(x, z) < pelR(y, Math.atan2(z, x))) lo = t; else hi = t; } return (lo + hi) / 2; };
      const midHit = (th) => { const c = Math.cos(th); return c < -1e-6 ? 0.15 / -c : 1e9; };
      const uvr = o.uvr || [0, 1, 0, 1], rows = o.rows, nR = rows.length, W = NC + 2, base = nv, seamV = new Set();
      const jOf = (jj) => (jj <= NO ? jj : jj + 1); // ring position jj -> column (column NO is made twice: the texture's seam at the back)
      for (let ri = 0; ri < nR; ri++) {
        const [y, v] = rows[ri], Y = legPY(y), k = smo(clamp((YC0 - y) / (YC0 - YC1), 0, 1)), yy = Math.max(y, YC0);
        const thf = Math.atan2(PCZ + pelR(yy, HPI) - LCZ, -0.15); let thb = Math.atan2(PCZ - pelR(yy, -HPI) - LCZ, -0.15); if (thb > 0) thb -= TAU;
        const wa = o.waf(y), aoa = o.aof(y), ao = o.ao ? o.ao(y) : 1;
        for (let j = 0; j < W; j++) {
          const jj = j <= NO ? j : j - 1, inside = j > NO;
          const thD = jj <= NO ? thf + (thb - thf) * (jj / NO) : thb + (thf - TAU - thb) * ((jj - NO) / NI), th = thD + (thU0 - jj * step - thD) * k;
          const r = k === 0 && inside ? midHit(th) : Math.min(midHit(th), pelHit(y, th)) * (1 - k) + o.legR(y, mir(th)) * k;
          const a = mir(th), p = [X + r * Math.cos(a), Y, LCZ + r * Math.sin(a)], w = wa(a, p), us = o.us;
          const u = jj <= NO && !inside ? us[0] + (us[1] - us[0]) * (jj / NO) : us[2] + (us[3] - us[2]) * ((jj - NO) / NI);
          push(p, [0, 1, 0], w[0], w[1], w[2], o.s, uvr[0] + (uvr[1] - uvr[0]) * u, uvr[2] + (uvr[3] - uvr[2]) * v, ao * aoa(a));
          if (k === 0 && (jj === 0 || jj === NO || jj === NC)) seamV.add(nv - 1);
        }
      }
      // normals from the surface (across the ring, down the column); at the middle's seams the across direction comes from the
      // outside neighbour and its mirror image, so both legs' halves shade there as one surface
      const P3 = (i) => [V[i * VSTRIDE], V[i * VSTRIDE + 1], V[i * VSTRIDE + 2]], at = (ri, j) => base + ri * W + j;
      for (let ri = 0; ri < nR; ri++) for (let j = 0; j < W; j++) {
        const i = at(ri, j), jj = j <= NO ? j : j - 1, q = P3(i);
        let a = P3(at(ri, jj === NC ? jOf(1) : jOf(jj + 1))), b = P3(at(ri, jj === 0 ? jOf(NC - 1) : jOf(jj - 1)));
        if (seamV.has(i)) { a = P3(at(ri, jj === NO ? NO - 1 : 1)); b = [-a[0], a[1], a[2]]; }
        const up = P3(at(Math.max(0, ri - 1), j)), dn = P3(at(Math.min(nR - 1, ri + 1), j));
        let n = v3c([a[0] - b[0], a[1] - b[1], a[2] - b[2]], [dn[0] - up[0], dn[1] - up[1], dn[2] - up[2]]); const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
        const ox = q[0] - X, oz = q[2] - LCZ; if (n[0] * ox + n[2] * oz < 0) n = [-n[0], -n[1], -n[2]];
        V[i * VSTRIDE + 3] = n[0]; V[i * VSTRIDE + 4] = n[1]; V[i * VSTRIDE + 5] = n[2];
      }
      for (let ri = 0; ri < nR - 1; ri++) {
        if (rows[ri + 1][0] === rows[ri][0]) continue; // (a seam in the texture: the two rows are the same ring)
        const hid = rows[ri][0] >= YC0 && rows[ri + 1][0] >= YC0;
        for (let j = 0; j < W - 1; j++) {
          if (j === NO) continue; // (between the two copies of the back's middle)
          if (j > NO && hid) continue; // the inside above the crotch lies on the body's middle, against the other leg's: never seen
          const a = at(ri, j), c = at(ri + 1, j);
          if (sd > 0) I.push(a, a + 1, c, a + 1, c + 1, c); else I.push(a, c, a + 1, a + 1, c, c + 1);
        }
      }
      return NC;
    }
    // the rows of a leg's surface: fixed leg-heights (a repeated one is a seam in the texture) with even steps between them; vOf(y, n)
    // gives the texture row, n counting the seams above
    const legRows = (keys, vOf) => {
      const st = lod ? 0.078 : HERO ? 0.024 : 0.044, out = []; let n = 0; // (rows between the keys: the keys already hold the knee and the seat)
      for (let i = 0; i < keys.length; i++) {
        const a = keys[i]; if (i > 0 && a === keys[i - 1]) n++; out.push([a, vOf(a, n)]);
        if (i < keys.length - 1 && keys[i + 1] !== a) { const b = keys[i + 1], m = Math.max(1, Math.round((a - b) / st)); for (let q = 1; q < m; q++) { const y = a + (b - a) * q / m; out.push([y, vOf(y, n)]); } }
      }
      return out;
    };
    for (const sd of [-1, 1]) {
      const hp = sd < 0 ? B.hipL : B.hipR, kn = sd < 0 ? B.knL : B.knR, ft = sd < 0 ? B.ftL : B.ftR, X = sd * 0.15, LW = S.legs;
      const KY = -0.53;
      const phOf = (an) => { let p = sd > 0 ? HPI - an : an - HPI; p = ((p % TAU) + TAU) % TAU; return p > Math.PI ? TAU - p : p; }; // 0 front .. pi back
      // weights: the hips over the seat and down the body's middle (both legs' halves move together there), the thigh's bone
      // taking over toward the outside and down the thigh; the knee blends narrowly over the kneecap and widely behind; the ankle
      // hands over to the foot
      const legWa = (y) => {
        if (y > 0.09) return () => [B.hips, B.spine, 0.85]; // the waistband and belt move as one with the pelvis (no stretch across it when the body twists)
        if (y > YC1) { const wv = smo(clamp((0.08 - y) / 0.26, 0, 1)), k = smo(clamp((YC0 - y) / (YC0 - YC1), 0, 1)); return (an, p) => { const wl = smo(clamp(Math.abs(p ? p[0] : X) / 0.1, 0, 1)); return [hp, B.hips, wv * (wl + (1 - wl) * k)]; }; }
        if (y > KY + 0.09) return () => [hp, kn, 1];
        if (y > KY - 0.09) return (an) => { const z = lerp(0.03, 0.075, phOf(an) / Math.PI), t = clamp((y - (KY - z)) / (2 * z), 0, 1); return [kn, hp, 1 - t * t * (3 - 2 * t)]; };
        if (y > -0.92) return () => [kn, ft, 1];
        const t = clamp((-0.92 - y) / 0.12, 0, 1); return () => [kn, ft, 1 - t * t * (3 - 2 * t)];
      };
      const inner = (y) => (an) => 1 - 0.3 * clamp((y + 0.2) / 0.11, 0, 1) * clamp((0.0 - y) / 0.06, 0, 1) * Math.max(0, -Math.cos(an) * sd - 0.3) * 1.43; // the crotch side in shade
      const LK = (y, add, e) => { const r = legAt(y); return Object.assign({ y: legY(y), r: r.map((x, i) => x * LW + (typeof add === 'function' ? add(i) : add || 0)), cx: X, cz: 0.004 }, e || {}); };
      const waf = (Y) => legWa(legYi(Y)), aof = (Y) => inner(legYi(Y));
      const pantU = sd > 0 ? [0.5, 0.012, 0.98, 0.88] : [0.5, 0.988, 0.02, 0.12]; // the kit's stripe down the outside (u 0.25 / 0.75), plain inside
      if (CAS) {
        // casual bottoms: sweats (loose to the shoe), joggers (tapered into a cuff) or shorts (three lengths) over the natural leg,
        // then crew or ankle socks; the cloth from the waistband down is one surface with the hips (legSurf), and the cuffs, hems,
        // skin and socks below are lofts that carry on from it
        const kind = CAS_BOT[CAS.bot] || 'sweats', LW2 = S.legs * 0.96, shorts = kind === 'shorts' || kind === 'midshorts' || kind === 'hoops';
        const yH = kind === 'shorts' ? -0.33 : kind === 'midshorts' ? -0.43 : kind === 'hoops' ? -0.54 : -0.84;
        const lo = kind === 'hoops' ? 1.2 : kind === 'midshorts' ? 1.12 : shorts ? 1.1 : kind === 'joggers' ? 1.08 : 1.12, add = kind === 'sweats' ? 0.016 : 0.014;
        const clothA = (y) => { let r = legAt(y).map((x) => x * LW2 * lo + add); if (kind === 'sweats') r = r.map((x) => Math.max(x, 0.082 * LW2 + 0.004)); if (kind === 'joggers' && y < -0.6) r = r.map((x) => x + 0.004 * Math.max(0, Math.sin((y + 0.45) * 18))); return r; };
        const rows = legRows([0.05, 0.03, -0.06, -0.06, YC0, YC1, yH], (y, n) => (n ? 0.39 + 0.61 * (-0.06 - y) / (-0.06 - yH) : 0.37 * (0.05 - y) / 0.11));
        const NC = legSurf(sd, X, { rows, s: SL.cloth, legR: (y, an) => rad8(clothA(y), an, sd), waf: legWa, aof: inner, us: pantU, uvr: uvOf('pant'), ao: (y) => (y > 0.04 ? 0.85 : 1) });
        const NL = (y, k, ad, e) => { const q = LK(y, 0, e); q.r = legAt(y).map((x) => x * LW2 * k + ad); return q; };
        const top = Object.assign(LK(yH, 0, { s: SL.cloth }), { r: clothA(yH) }); // the surface's last ring (the same angles: edge to edge)
        const cloth = [top], skin = [], sock = [];
        if (shorts) {
          cloth.push(NL(yH + 0.0001, 1, 0.006, { ao: 0.45 })); // the hem turned in
          const sockTop = CAS.sock ? -0.972 : -0.8;
          skin.push(NL(yH, 1, 0.004, { s: SL.skin, ao: 0.55 }));
          for (const y of [-0.42, -0.47, -0.51, -0.555, -0.6, -0.66, -0.73, -0.8, -0.88, -0.95]) if (y < yH - 0.025 && y > sockTop + 0.01) skin.push(NL(y, 1, 0, { ao: 1 }));
          skin.push(NL(sockTop, 1, 0, { ao: 0.9 }));
          sock.push(NL(sockTop, 1, 0.005, { s: SL.wht, ao: 0.9 }), NL(sockTop - 0.014, 1, 0.006));
          for (const y of [-0.88, -0.95, -0.99, -1.04]) if (y < sockTop - 0.03) sock.push(NL(y, 1, 0.004, { ao: y < -0.98 ? 0.75 : 1 }));
          if (sock[sock.length - 1].y > legY(-1.04) + 0.001) sock.push(NL(-1.04, 1, 0.004, { ao: 0.7 }));
        } else if (kind === 'joggers') {
          cloth.push(NL(-0.9, 0, 0.068 * LW2 + 0.004), NL(-0.925, 0, 0.06 * LW2 + 0.004, { ao: 0.8 }), NL(-0.975, 0, 0.054 * LW2 + 0.004), NL(-0.99, 0, 0.05 * LW2, { ao: 0.5 }));
          sock.push(NL(-0.97, 1, 0.002, { s: SL.wht }), NL(-1.0, 1, 0.004), NL(-1.04, 1, 0.004, { ao: 0.7 }));
        } else { // sweats: straight and roomy, bunched over the shoe
          cloth.push(NL(-0.9, 0, 0.084 * LW2 + 0.004), NL(-0.935, 0, 0.089 * LW2 + 0.004, { ao: 0.9 }), NL(-0.965, 0, 0.083 * LW2 + 0.004), NL(-0.995, 0, 0.08 * LW2 + 0.004, { ao: 0.8 }), NL(-1.003, 0, 0.058 * LW2, { ao: 0.4 }));
        }
        cloth.forEach((k, i) => { k.v = i / Math.max(1, cloth.length - 1); });
        if (cloth.length > 1) kloft({ sd, s: SL.cloth, seg: NC, step: 0.04, uv: uvOf('pant', 0, 1, 0.92, 1), mirrorU: sd < 0, waf, aof }, cloth);
        if (skin.length > 1) kloft({ sd, s: SL.skin, seg: SG(14), step: 0.04, waf }, skin);
        if (sock.length > 1) kloft({ sd, s: SL.wht, seg: SG(12), step: 0.05, waf }, sock);
      } else {
        // game pants over the leg: the hip pads a little proud at the sides, the thigh pad a low plate on the front of the thigh, the
        // knee pad a dome over the kneecap; tight below the knee, the hem turned in; then a little calf, the sock from mid-calf, and
        // the cleat
        const thighPad = (y) => clamp((-0.13 - y) / 0.04, 0, 1) * clamp((y + 0.38) / 0.05, 0, 1), kneePad = (y) => clamp((-0.455 - y) / 0.025, 0, 1) * clamp((y + 0.58) / 0.025, 0, 1), hipPad = (y) => clamp((-0.02 - y) / 0.03, 0, 1) * clamp((y + 0.15) / 0.04, 0, 1);
        const pantR = (y, an) => { const ph = phOf(an), out = Math.max(0, Math.cos(an) * sd); return rad8(legAt(y).map((x) => x * LW), an, sd) + 0.007 + 0.0055 * thighPad(y) * Math.exp(-Math.pow(ph / 0.75, 2)) + 0.016 * kneePad(y) * Math.exp(-Math.pow(ph / 0.8, 2)) + 0.006 * hipPad(y) * out * out; };
        const rows = legRows([0.17, 0.15, 0.147, 0.1, -0.06, -0.06, YC0, YC1, -0.42, -0.455, -0.49, -0.53, -0.565, -0.59, -0.605], (y, n) => (n ? 0.39 + 0.61 * (-0.06 - y) / 0.545 : y >= 0.15 ? 0.09 * (0.17 - y) / 0.02 : 0.09 + 0.28 * (0.15 - y) / 0.21));
        legSurf(sd, X, { rows, s: PS, legR: pantR, waf: legWa, aof: inner, us: pantU, uvr: uvOf('pant'), ao: (y) => (y > 0.16 ? 0.85 : y > 0.146 && y < 0.149 ? 0.8 : 1) });
        kloft({ sd, s: PS, seg: SG(14), step: 0.04, uv: uvOf('pant', 0, 1, 0.97, 1), waf }, [LK(-0.605, 0.007, { ao: 0.85 }), LK(-0.598, -0.003, { ao: 0.45 })]); // the hem's lip
        const skinKeys = [LK(-0.603, -0.001, { s: SL.skin, ao: 0.6 }), LK(-0.64, 0, { ao: 0.9 }), LK(-0.7, 0), LK(-0.765, 0)];
        const sockKeys = [LK(-0.765, 0.003, { s: SL.sock, v: 0, ao: 0.9 }), LK(-0.8, 0.004, { v: 0.15 }), LK(-0.88, 0.004, { v: 0.45 }), LK(-0.95, 0.004, { v: 0.72 }), LK(-0.99, 0.004, { v: 0.88, ao: 0.85 }), LK(-1.04, 0.004, { v: 1, ao: 0.7 })];
        kloft({ sd, s: SL.skin, seg: SG(14), step: 0.04, waf }, skinKeys);
        kloft({ sd, s: SL.sock, seg: SG(12), step: 0.05, uv: uvOf('sock'), waf }, sockKeys);
      }
      // shoe: heel counter -> arch -> ball -> toe box, lofted along +Z; sole plate; studs at full detail
      const FW = [ft, ft, 1];
      const shoeM = mMul(mT(IDM, X, legY(-1.05), -0.012), mRX(IDM, -HPI)); // loft -Y -> body +Z, loft +Z -> body +Y
      const shoe = [{ y: 0.1, rx: 0.03, rz: 0.024, w: FW }, { y: 0.082, rx: 0.044, rz: 0.034, w: FW }, { y: 0.045, rx: 0.05, rz: 0.042, cz: 0.006, w: FW, ao: 0.9 }, { y: 0.0, rx: 0.051, rz: 0.04, cz: 0.012, w: FW, ao: 0.85 }, { y: -0.05, rx: 0.053, rz: 0.037, cz: 0.012, w: FW, f: (an) => 1 + 0.07 * Math.max(0, Math.sin(an)) },
        { y: -0.11, rx: 0.056, rz: 0.03, cz: 0.005, w: FW }, { y: -0.16, rx: 0.053, rz: 0.026, cz: 0.002, w: FW }, { y: -0.2, rx: 0.044, rz: 0.021, cz: 0.001, w: FW }, { y: -0.228, rx: 0.026, rz: 0.013, cz: 0.002, w: FW }];
      if (CAS) for (const r of shoe) { r.rx *= 1.07; r.rz *= 1.12; if (r.y > 0.05) r.rz += 0.006; } // sneakers: roomier, a padded collar, a thick cupsole and no studs
      loft({ s: SL.cleat, seg: SG(14), m: shoeM, capTop: true, capBot: true }, shoe);
      loft({ s: SL.sole, seg: SG(12), m: mMul(mT(IDM, X, legY(CAS ? -1.07 : -1.074), -0.012), mRX(IDM, -HPI)), capTop: true, capBot: true }, shoe.map((r) => ({ y: r.y, rx: r.rx + (CAS ? 0.006 : 0.004), rz: CAS ? 0.016 : 0.008, cz: 0, w: FW })));
      if (!lod && !CAS) for (const [sx, sz] of [[-0.03, 0.17], [0.03, 0.17], [-0.035, 0.1], [0.035, 0.1], [0, 0.04], [-0.02, -0.05], [0.02, -0.05]]) tube({ s: SL.sole, w: FW }, [[X + sx, legY(-1.082), sz], [X + sx, legY(-1.1), sz]], 0.006, 4, (t) => 1 - 0.4 * t);
    }
    // ---- belt towel (hidden for players who do not carry one) ----
    if (gear) {
      const TW = [B.hips, B.hips, 1], tx = -0.13, pts = [];
      for (let i = 0; i <= 4; i++) pts.push({ y: 0.1 - i * 0.095, rx: 0.062 - 0.005 * i, rz: 0.005, cx: tx, cz: 0.19 * (0.85 + 0.15 * S.bulk) + 0.006 * i, w: TW, v: i / 4 });
      loft({ s: SL.towel, seg: SG(6), capBot: true, w: TW }, pts);
    }
    if (CAS && !HOOP) { // a schoolkid's head is big for his body: the head (face, ears, hair, hat) scaled 1.1 about the top of the neck
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
    if (cas === 'hoop') { // basketball: a sleeveless jersey in the team colour with a trim collar and armholes, side panels, glossy mesh
      let r = reg('torso'); box(r, 0, 1, 0, 1, C.jer); box(r, 0, 1, 0, 0.045, C.stripe); box(r, 0, 1, 0.97, 1, shade(C.jer, 0.85));
      for (const u of [0.25, 0.75]) { box(r, u - 0.03, u + 0.03, 0.1, 0.97, C.stripe); box(r, u - 0.012, u + 0.012, 0.1, 0.97, shade(C.jer, 0.8)); }
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < r.h; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < r.w; x += 6) g.fillRect(r.x + x, r.y + y, 2, 2);
      r = reg('pant'); box(r, 0, 1, 0, 1, C.pant || C.jer); box(r, 0, 1, 0, 0.08, C.stripe); box(r, 0, 1, 0.9, 1, C.stripe);
      for (const u of [0.25, 0.75]) box(r, u - 0.04, u + 0.04, 0.08, 0.9, C.stripe);
      try { const img = g.getImageData(0, 0, S, S), d = img.data; for (const k of ['torso', 'pant']) { const q = reg(k); for (let y = Math.round(q.y); y < Math.round(q.y + q.h); y++) for (let x = Math.round(q.x); x < Math.round(q.x + q.w); x++) d[(y * S + x) * 4 + 3] = 150; } g.putImageData(img, 0, 0); } catch (e) {}
      return c;
    }
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
  // Game: mounts one full basketball game in `root`. done(result) is called once when it ends or is quit.
  // =====================================================================================
  function Game(root, opts, done) {
    injectCSS();
    opts = opts || {};
    const DBG = window.__dunkDebug || null;
    // a quarter's length on the game clock (seconds) and the shot clock (the 24 seconds, scaled to the short game)
    const QS = clamp(Math.round(+(DBG && DBG.quarterSecs) || +opts.quarterSecs || 120), 20, 720);
    const SHOT = clamp(+opts.shotClock || 14, 8, 30);
    const TOS = clamp(opts.timeouts == null ? 3 : opts.timeouts | 0, 0, 5);
    // difficulty: 0..1 from Rookie to Legend; GOAT 1.3, Hall of Fame 1.1 (the Arcade's 3D Blitz table)
    const DIFF = clamp(+opts.difficulty || 0, 0, 1.3);
    const LEVEL = clamp(opts.level == null ? 1 : opts.level | 0, 0, 5);
    const rng = mkRng((DBG && DBG.seed) || opts.seed || 'dunk-' + Date.now());
    const NOTIES = !!opts.noTies;
    const M2Y = 1.0936133;
    // the football engine's venue flags: the Dunk engine has its own gym (12-gym.js) and none of those
    const VS = null, WX = 'clear', WXK = 'clear', WET = 0, TOD = 'night', MOPT = { touch: false, big: false, crowd: true, field: 'gym' };
    const sfx = Sfx();
    let cs = 20240611; const crandL = () => ((cs = (cs * 1664525 + 1013904223) >>> 0) / 4294967296); // cosmetic only
    crand = crandL;

    // ---------- teams ----------
    const BBK = ['ovr', 'spd', 'vert', 'str', 'hand', 'pass', 'fin', 'dunk', 'mid', 'three', 'ft', 'perD', 'intD', 'stl', 'blk', 'reb', 'sta'];
    const POSS = ['PG', 'SG', 'SF', 'PF', 'C'];
    const normTeam = (t, dn) => {
      t = t || {};
      return { name: String(t.name || dn).slice(0, 28), abbr: String(t.abbr || String(t.name || dn).replace(/[^A-Za-z]/g, '').slice(0, 3) || 'CPU').toUpperCase().slice(0, 4),
        color: hex(t.color), color2: hex(t.color2), mine: !!t.mine, ovr: clamp(+t.ovr || 0, 0, 99), players: Array.isArray(t.players) ? t.players.filter((p) => p && p.name).slice(0, 6) : [] };
    };
    const HOME = normTeam(opts.home, 'Home'), AWAY = normTeam(opts.away, 'Visitors');
    const TEAM = HOME.color || hex('#c8102e');
    let TEAM2 = HOME.color2 || hex('#f2f4f7');
    if (Math.abs(lum(TEAM) - lum(TEAM2)) < 0.12) TEAM2 = lum(TEAM) > 0.5 ? hex('#15171d') : hex('#f2f4f7');
    const O1 = AWAY.color || hex('#1d4fa3'), O2 = AWAY.color2 || hex('#f2f4f7');
    const away2 = cdist(O1, TEAM) < 0.35;
    const DEFA = O1, OPPCSS = css(lum(O1) < 0.2 ? O2 : O1), HOMECSS = css(lum(TEAM) < 0.2 ? TEAM2 : TEAM);
    // kits by side (0 home, 1 away) for the whole game: jersey, shorts, trim, number
    const kitOf = (J, J2) => ({ jer: J, pad: J, pant: J, helm: J2, stripe: J2, num: lum(J) > 0.6 ? shade(J2, 0.9) : cdist(J2, J) < 0.3 ? (lum(J) > 0.5 ? hex('#15171d') : hex('#f2f4f7')) : J2, glove: J2, sock: J2, mask: J2 });
    const OFFC = kitOf(TEAM, TEAM2);
    const DEFC = away2 ? kitOf(O2, O1) : kitOf(O1, O2);
    const WHITEC = hex('#f2f3f5'), DARKC = hex('#15171c'), VISORC = hex('#5a6678'), BALLC = hex('#c8571f');
    const SKIN = ['#f3cfae', '#dcaa83', '#b98056', '#8a5535', '#5a361f'].map(hex);
    const CLEATS = { black: hex('#111318'), white: hex('#f2f4f7'), team: TEAM, gold: hex('#ffc21a'), red: hex('#d81f2a') };
    const safeUrl = (u) => (typeof u === 'string' && /^\/[A-Za-z0-9_\-./%]+$/.test(u) && u.indexOf('..') < 0 ? u : null);
    const rv = (p, k) => (p ? +(p.bb && p.bb[k] != null ? p.bb[k] : p.r && p.r[k] != null ? p.r[k] : p[k]) : NaN);
    const rat = (p, k, d) => { const v = rv(p, k); return clamp(isFinite(v) && v > 0 ? v : d, 25, 99); };
    // the star curve (as 3D Blitz): flat to 72, then each point is worth more
    const starR = (v) => (v <= 72 ? v : v + (v - 72) * (v - 72) * 0.022);
    const BUILDS = BUILDS6;
    // basketball true size: the top of the skull standing straight at hs 1 (hips 1.08 + spine to head 0.78 + crown 0.312) in yards
    const STAND_H = 2.172, MHT = true;
    const normLook = (l, dflt, r) => {
      l = l && typeof l === 'object' ? l : {};
      const sk = Number.isInteger(l.skin) ? clamp(l.skin, 0, 4) : dflt;
      const b = BUILDS[l.build] ? l.build : null;
      const hin0 = r ? +r.hgt : NaN, hin = isFinite(hin0) && hin0 > 40 ? clamp(hin0, 54, 80) : NaN;
      const o = { skin: sk, hs: 1, cleat: CLEATS[l.cleats] || CLEATS.white, visor: false, sleeves: !!l.sleeves, build: b, ll: b ? BUILDS[b].ll || 1 : 1 };
      if (isFinite(hin)) o.hin = hin;
      return o;
    };
    const numOf = (q) => { const s = String(q.num != null ? q.num : q.number != null ? q.number : '').trim(); return /^\d{1,2}$/.test(s) ? +s : null; };
    const fxOf = (q) => (q && q.fx && typeof q.fx === 'object' ? { variant: String(q.fx.variant || ''), set: q.fx.set ? String(q.fx.set) : null, par: q.fx.par ? String(q.fx.par) : null, rarity: String(q.fx.rarity || 'common'), spec: q.fx.spec ? String(q.fx.spec) : null, perk: null, perkLv: 0 } : null);
    const GENN = [['Guard', 3], ['Shooter', 11], ['Wing', 23], ['Forward', 32], ['Center', 50], ['Sixth', 6]];
    // a team's six: five starters (PG SG SF PF C) and the sixth man; idx0 offsets the photo cells
    function mkSquad(T, side) {
      const L = [];
      const base = clamp(T.ovr || (side ? 58 + LEVEL * 6 : 66), 35, 95);
      for (let i = 0; i < 6; i++) {
        const q = T.players[i] || null, g = GENN[i];
        const bb = {}; for (const k of BBK) bb[k] = rat(q, k, base + (k === 'ovr' ? 0 : ((i * 7 + k.length * 3) % 9) - 4));
        const pos = q && POSS.indexOf(String(q.pos || '').toUpperCase()) >= 0 ? String(q.pos).toUpperCase() : POSS[Math.min(i, 4)];
        const num = q && numOf(q) != null ? numOf(q) : g[1] + side * 10;
        const hgt = q && +q.hgt > 40 ? clamp(+q.hgt, 54, 80) : [63, 64, 66, 68, 70, 65][i];
        L.push({ key: (side ? 'a' : 'h') + i, side, idx: side * 6 + i, slot: i, name: q ? String(q.name) : (side ? AWAY.abbr : HOME.abbr) + ' ' + g[0], pid: q ? String(q.id != null ? q.id : q.name) : null,
          num, photo: q ? safeUrl(q.photo) : null, look: normLook(q && q.look, (i * 2 + side) % 5, { hgt }), cell: -1, fx: fxOf(q), pos, hgt, wgt: q && +q.wgt > 0 ? clamp(+q.wgt, 80, 280) : 0, bb, sixth: i === 5, card: q && q.card ? q.card : null });
      }
      return L;
    }
    const SQH = mkSquad(HOME, 0), SQA = mkSquad(AWAY, 1);
    const SQL = SQH.concat(SQA);
    const shortName = (s) => { const p = String(s).trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).slice(0, 12); };
    // ---------- stats (per player and per team) ----------
    const ST = {};
    const stat = (q) => (q ? ST[q.key] || (ST[q.key] = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, oreb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0, dnk: 0, min: 0 }) : null);
    const HL = [];


    // ---------- DOM ----------
    root.innerHTML = '';
    const wrap = el('div', 'dk-wrap');
    const stage = el('div', 'dk-stage');
    const cv = el('canvas', 'dk-cv'); cv.tabIndex = 0; cv.setAttribute('aria-label', 'Basketball court');
    const tagL = el('div', 'dk-tags'), fx = el('div', 'dk-fx');
    stage.append(cv, tagL, fx);
    const bug = el('div', 'dk-bug'), tick = el('div', 'dk-tick'), ctl = el('div', 'dk-ctl');
    wrap.append(stage, bug, tick, ctl);
    root.appendChild(wrap);


    // ---------- WebGL (2 when available, else 1 + extensions) ----------
    let gl = null, GL2 = false;
    try { gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' }); GL2 = !!gl; } catch (e) { gl = null; }
    if (!gl) { try { gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl', { antialias: false, alpha: false }); } catch (e) { gl = null; } }
    if (!gl) {
      root.innerHTML = '<div class="dk-err"><b>NO 3D HERE</b>Sorry, your browser can\'t run 3D graphics (WebGL is turned off or blocked on this device).</div>';
      setTimeout(() => done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, noGL: true, stats: {}, team: {}, highlights: [] }), 0);
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
    if (fixedMode) { wrap.classList.add('dk-fixed'); document.documentElement.classList.add('dk-lock'); }
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
    // the gym's light rig (indoors: a soft key from the roof lights for the shadows, four high-bay banks as point lights, warm bounce
    // off the maple; 12-gym.js adds eight more high-bays as diffuse pools). Linear HDR values, engine units (yards).
    const SKY = { top: [0.16, 0.16, 0.17], hor: [0.12, 0.115, 0.11], fog: [0.2, 0.19, 0.18], fogR: [40, 160, 0.25], amb: [0.42, 0.4, 0.37], gnd: [0.36, 0.26, 0.16], sun: [1.55, 1.5, 1.42], L: [0.22, 0.93, 0.3], night: 0, cloud: 0, glow: 0.4, tower: 1, exp: 0.78, soft: 1.2, env: 0.9 };
    const LDIR = v3n(SKY.L);
    const TOWERS = [[-7, 8.4, -3.6], [7, 8.4, -3.6], [-7, 8.4, 3.6], [7, 8.4, 3.6]];
    const LPOS = TOWERS.map((t) => [t[0], t[1], t[2], 240]);
    const LCOL = [1.0, 0.97, 0.92];
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
      shadowPacked = !X.depthTex;
      const defs = (extra) => X.derivExt + FS_PRE + (X.deriv ? '#define DERIV\n' : '') + (shadowPacked ? '#define SHADOW_PACKED\n' : '') + (extra || '');
      const lib = (fs) => skyShader(fs.replace('#LIB#', SH_LIB)); // the gym's high-bay pools (12-gym.js)
      G.world = mkProg(VS_WORLD, lib(FS_WORLD), defs()); G.worldHi = mkProg(VS_WORLD, lib(FS_WORLD), defs('#define PCF_HI\n'));
      G.skin = mkProg(VS_SKIN, lib(FS_SKIN), defs()); G.skinHi = mkProg(VS_SKIN, lib(FS_SKIN), defs('#define PCF_HI\n'));
      G.depthW = mkProg(VS_DEPTH_W, shadowPacked ? FS_DEPTH_PACK : FS_DEPTH_NONE); G.depthS = mkProg(VS_DEPTH_S, shadowPacked ? FS_DEPTH_PACK : FS_DEPTH_NONE);
      G.sky = mkProg(VS_QUAD, FS_SKY, FS_PRE); G.crowd = mkProg(VS_CROWD, FS_CROWD, FS_PRE);
      G.ao = mkProg(VS_QUAD, FS_AO, FS_PRE); G.blur4 = mkProg(VS_QUAD, FS_BLUR4, FS_PRE);
      G.extract = mkProg(VS_QUAD, FS_EXTRACT, FS_PRE); G.blur = mkProg(VS_QUAD, FS_BLUR, FS_PRE); G.dofmb = mkProg(VS_QUAD, FS_DOFMB, FS_PRE); G.final = mkProg(VS_QUAD, FS_FINAL, FS_PRE);
      for (const k of ['world', 'worldHi', 'skin', 'skinHi', 'depthW', 'depthS', 'sky', 'crowd', 'ao', 'blur4', 'extract', 'blur', 'dofmb', 'final']) if (G[k]) G.progs.push(G[k].pr);
      skyGL();
      G.white = mkTex(new Uint8Array([255, 255, 255, 255]));
      G.black = mkTex(new Uint8Array([0, 0, 0, 255]));
      G.flatN = mkTex(new Uint8Array([128, 128, 255, 128]));
      G.field = G.white; G.detail = G.flatN;
      G.fabric = mkTex(fabricCanvas(), true, false, 4);
      G.board = mkTex(gymBoardCanvas()); boardDirty = false;
      G.table = mkTex(gymTableCanvas(), true, false, 4);
      G.atlas = mkTex(atlas, false, true); atlasDirty = true;
      G.texs.push(G.white, G.black, G.flatN, G.fabric, G.board, G.table, G.atlas);
      G.dyn = gl.createBuffer(); G.tr = gl.createBuffer(); G.quad = gl.createBuffer(); G.fxb = gl.createBuffer(); G.bufs.push(G.fxb);
      G.fxTex = mkTex(spriteCanvas(), false, false, 1); G.texs.push(G.fxTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      G.bufs.push(G.dyn, G.tr, G.quad);
      casPrebuild();
      G.kitO = mkTex(kitCanvas(OFFC, HOME.abbr, HOME.name, false, 'hoop'), false, false, 8); G.kitD = mkTex(kitCanvas(DEFC, AWAY.abbr, AWAY.name, false, 'hoop'), false, false, 8); G.kitR = mkTex(kitCanvas(REFC, '', '', true), false, false, 8);
      G.crowdT = mkTex(crowdRow(crowdCanvas()), false, false, 4);
      G.texs.push(G.kitO, G.kitD, G.kitR, G.crowdT);
      statics.length = 0;
      const W = buildGym(); // Wildcat Gym (12-gym.js)
      gymStatics(W);
      G.crowdB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.crowdB); gl.bufferData(gl.ARRAY_BUFFER, W.crowd.f.subarray(0, Math.max(1, W.crowd.n) * 12), gl.STATIC_DRAW); G.crowdN = W.crowd.n; G.bufs.push(G.crowdB);
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
    function fabricCanvas() { return paintFabric(); } // 07-kit.js
    let boardDirty = true;
    const REFC = { jer: hex('#f2f2f2'), pad: hex('#f2f2f2'), pant: hex('#f6f6f6'), helm: hex('#111111'), stripe: hex('#111111'), num: hex('#111111'), glove: hex('#111111'), sock: hex('#111111'), mask: hex('#111111') };
    // ---------- per-team kit texture (2048): jersey, sleeves, gloves, pants, socks, helmet; alpha carries a roughness variation ----------
    function kitCanvas(C, abbr, teamName, refs, cas) { return paintKit(C, abbr, teamName, refs, cas, 2048); } // 07-kit.js
    // crowd sprite sheet: 16 fans x 3 states (seated / standing / slumped). alpha 1 areas take the seat's tint, alpha 0.6 keep their own colour,
    // alpha 0.7 marks a phone screen (lit on big plays at night)
    // the fans' sheet laid out as the crowd shader reads it: one row of 48 cells (16 fans seated, the same 16 standing, the same 16
    // slumped; the shader adds a third of the width per state). crowdCanvas draws a 16 x 3 grid; read as-is every fan was a thin
    // slice through three figures (the stands looked like static). Each cell is copied into the row, so each fan is one whole figure.
    function crowdRow(src) {
      const c = document.createElement('canvas'); c.width = 48 * 64; c.height = 128; const g2 = c.getContext('2d');
      for (let st = 0; st < 3; st++) for (let k = 0; k < 16; k++) g2.drawImage(src, k * 96, st * 192, 96, 192, (st * 16 + k) * 64, 0, 64, 128);
      return c;
    }
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
      const eye = [0, 2.0, 0];
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
    const AH = 2048, NAMEY = 768, SMALLY = 1024, NAMEY2 = 2816; // head to head: the opponent's photo cells at 32+ (y 2048) and 16 more name plates at y 2816
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
      const k = nameN++, x = (k % 4) * 256, y = k < 16 ? NAMEY + Math.floor(k / 4) * 64 : NAMEY2 + Math.floor((k - 16) / 4) * 64;
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
      if (c >= 200) { const k = c - 200, x = (k % 4) * 256, y = k < 16 ? NAMEY + Math.floor(k / 4) * 64 : NAMEY2 + Math.floor((k - 16) / 4) * 64; return [(x + 2) / 1024, (y + 2) / AH, 252 / 1024, 60 / AH]; }
      if (c >= 100) { const k = c - 100, x = (k % 8) * 128, y = SMALLY + Math.floor(k / 8) * 128; return [(x + 4) / 1024, (y + 4) / AH, 120 / 1024, 120 / AH]; }
      const x = (c % 4) * 256, y = Math.floor(c / 4) * 256; return [(x + 6) / 1024, (y + 6) / AH, 244 / 1024, 244 / AH];
    }
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
      root.querySelectorAll('[data-pf="' + q.key + '"]').forEach((e) => { e.className = 'dk-face dk-nof'; e.removeAttribute('style'); e.textContent = q.num; });
      for (const p of everyone) if (p.sq === q) p.face = -1;
    }
    const faceHTML = (q) => (q && q.photo ? `<s class="dk-face" data-pf="${q.key}" style="background-image:url('${q.photo}')"></s>` : q ? `<s class="dk-face dk-nof">${q.num}</s>` : '');
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
      wrap.classList.toggle('dk-land', mob && land);
      wrap.classList.toggle('dk-edge', mob && land && !fs);
      if (mob && land && !fs && phase !== 'splash') { const l = root.getBoundingClientRect().left; wrap.style.width = vw + 'px'; wrap.style.marginLeft = -l + 'px'; }
      let h;
      const w = Math.max(260, wrap.clientWidth || vw);
      if (fs) h = vh;
      else if (mob) h = Math.max(260, vh - headerH() - 4);
      else h = clamp(Math.round(w * 9 / 16), 300, Math.max(320, vh - headerH() - 20));
      wrap.style.height = h + 'px';
      cssW = w; cssH = h;
      wrap.classList.toggle('dk-narrow', w < 560); wrap.classList.toggle('dk-tiny', w < 400);
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
    // =====================================================================================
    // The court: the ONE place for every court, rim, backboard and ball measure (engine units are yards; authored in feet and
    // inches, converted once). Origin at centre court on the floor, x along the length (baskets at +-x), z across, y up.
    // High school court 84 x 50 ft; rim 10 ft, centre 5 ft 3 in from the baseline (4 ft to the board face + 15 in); 3-point arc
    // 19 ft 9 in from the rim centre; free-throw line 15 ft from the board face; key 12 ft wide.
    // =====================================================================================
    const F2Y = 1 / 3, IN2Y = 1 / 36;
    const COURT = {
      L: 84 * F2Y, W: 50 * F2Y, HL: 42 * F2Y, HW: 25 * F2Y, // length, width, half length (14), half width (8.333)
      line: 2 * IN2Y,                       // 2-inch lines
      keyW: 12 * F2Y,                       // the lane, 12 ft wide
      ftX: 42 * F2Y - 19 * F2Y,             // the free-throw line's x (19 ft from the baseline) = 7.667
      ftR: 6 * F2Y,                         // free-throw circle radius
      ccR: 6 * F2Y,                         // centre circle radius
      three: (19 * 12 + 9) * IN2Y,          // 3-point arc radius from the rim centre (6.583)
      boxX: 28 * F2Y,                       // coaching box line, 28 ft from the baseline
      oobBand: 1.0,                         // the black out-of-bounds band (gym paint), yards past the lines
    };
    const RIM_Y = 10 * F2Y;                   // top of the ring (3.333)
    const RIM_R = 9 * IN2Y;                   // inner radius (18 in ring)
    const RIM_T = 0.3125 * IN2Y;              // tube radius (5/8 in tube)
    const RIM_C = RIM_R + RIM_T;              // the tube's centre circle
    const BOARD_OFF = 4 * F2Y;                // board face in from the baseline
    const BOARD_W = 6 * F2Y, BOARD_H = 3.5 * F2Y, BOARD_Y0 = RIM_Y - 0.5 * F2Y; // 72 x 42 in glass, its bottom 6 in under the rim
    const BALL_R = 0.1305;                    // 29.5 in ball
    const BALL_G = 9.81 * M2Y;                // gravity on the ball (yd/s/s)
    const RIM_X = COURT.HL - BOARD_OFF - 15 * IN2Y; // 12.25
    // HOOP[0] at -x, HOOP[1] at +x; dir points from centre court toward the basket; bx is the board's face
    const HOOP = [-1, 1].map((d) => ({ x: d * RIM_X, y: RIM_Y - RIM_T, z: 0, dir: d, bx: d * (COURT.HL - BOARD_OFF), shake: 0, net: null }));
    const inBounds = (x, z, m) => Math.abs(x) <= COURT.HL - (m || 0) && Math.abs(z) <= COURT.HW - (m || 0);
    // a spot's distance from a hoop's rim centre on the floor, and whether a shot from there is a three
    const rimDist = (x, z, h) => Math.hypot(x - h.x, z - h.z);
    const isThree = (x, z, h) => rimDist(x, z, h) > COURT.three + 0.05 && Math.abs(x) < COURT.HL + 0.5;
    // =====================================================================================
    // Wildcat Gym (Metcalf's gym), first version. Everything about the room lives in this file behind buildGym() / gymStatics(),
    // with its placements as GYM constants (the bleachers along +z behind the benches and the scorer's table; the scoreboard, flag
    // and banners on the far -z wall, as in the photos). Engine units are yards; the court's own measures come from 11-court.js.
    // Cosmetic randomness only (fixed seeds): the gym is identical on every load.
    // =====================================================================================
    // the football engine's venue flags (other files test them): none of those venues here
    const METCALF = false, SCHOOL = false, HANCOCK = false, MHOLO = false;
    const MET = { envEye: [0, 2, 0], keep: [], texBase: '/static/arcade/venue/metcalf/' };
    const MFL = { on: false, I: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), M: null };
    // ---------- small helpers ----------
    const mrng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
    const hx3 = (h, k) => { const n = parseInt(h.slice(1), 16), m = k == null ? 1 : k; return [((n >> 16) & 255) / 255 * m, ((n >> 8) & 255) / 255 * m, (n & 255) / 255 * m, 1]; };
    const TN = 1 / 0.8; // photo textures are normalised to a mean of 0.8, so a textured surface takes its colour / 0.8
    const tc = (h, k) => hx3(h, (k == null ? 1 : k) * TN);
    const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];
    let REALCV_ = null; const realCv = () => REALCV_ !== null ? REALCV_ : (REALCV_ = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 2; const d = c.getContext('2d').getImageData(0, 0, 1, 1).data; return !!d && d.length === 4; } catch (e) { return false; } })());
    const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // value noise / fbm in [0,1] on a wrapping lattice
    function vnoise(seed) {
      const r = mrng(seed), N = 256, t = new Float32Array(N * N); for (let i = 0; i < N * N; i++) t[i] = r();
      const sm = (x) => x * x * (3 - 2 * x);
      return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), a = xi & 255, b = yi & 255, a1 = (a + 1) & 255, b1 = (b + 1) & 255;
        const v00 = t[b * N + a], v10 = t[b * N + a1], v01 = t[b1 * N + a], v11 = t[b1 * N + a1]; return v00 + (v10 - v00) * fx + (v01 - v00) * fy + (v00 - v10 - v01 + v11) * fx * fy; };
    }
    // a grey noise canvas (w x h) from fn(x, y) -> 0..1 (alpha a, or alpha from the value when aFromV)
    function noiseCanvas(w, h, fn, aFromV) {
      const c = mkCv(w, h); if (!realCv()) return c; const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = fn(x, y), o = (y * w + x) * 4, b = Math.max(0, Math.min(255, v * 255)); if (aFromV) { d[o] = d[o + 1] = d[o + 2] = 0; d[o + 3] = b; } else { d[o] = d[o + 1] = d[o + 2] = b; d[o + 3] = 255; } }
      g.putImageData(im, 0, 0); return c;
    }
    // ---------- the official Metcalf Wildcats paw, in its paw-local frame (u = toward the toes, v = left), metres at full size ----------
    // Main pad: an 'M' (two front humps, three rear lobes); four egg-shaped toes in an arc (measured from the painted stencils).
    const PAW_PAD = (() => {
      const V = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
      const R = [-0.56, -0.52, -0.435, -0.335, -0.295, -0.335, -0.54, -0.565, -0.57, -0.545, -0.51, -0.445, -0.3];
      const F = [0.07, 0.1, 0.18, 0.225, 0.245, 0.23, 0.2, 0.15, 0.085, 0.01, -0.05, -0.1, -0.17];
      const pts = [];
      for (let i = V.length - 1; i > 0; i--) pts.push([F[i], -V[i]]);
      for (let i = 0; i < V.length; i++) pts.push([F[i], V[i]]);
      for (let a = 1; a < 6; a++) { const t = (a / 6) * Math.PI, cu = (F[12] + R[12]) / 2, ru = (F[12] - R[12]) / 2; pts.push([cu + Math.cos(t) * ru, 0.6 + Math.sin(t) * 0.04]); }
      for (let i = V.length - 1; i >= 0; i--) pts.push([R[i], V[i]]);
      for (let i = 1; i < V.length; i++) pts.push([R[i], -V[i]]);
      for (let a = 1; a < 6; a++) { const t = (a / 6) * Math.PI, cu = (F[12] + R[12]) / 2, ru = (F[12] - R[12]) / 2; pts.push([cu - Math.cos(t) * ru, -0.6 - Math.sin(t) * 0.04]); }
      // corner cutting (four rounds) turns the measured stations into the stencil's smooth lobes and round-bottomed notches
      let q = pts; for (let it = 0; it < 4; it++) { const o = []; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q = o; }
      return q;
    })();
    const PAW_TOES = [[0.29, 0.61, 0.235, 0.15, 0], [0.29, -0.61, 0.235, 0.15, 0], [0.65, 0.22, 0.235, 0.13, -0.09], [0.65, -0.22, 0.235, 0.13, 0.09]];
    function pawPath(g) { // in paw-local units on a canvas whose x = u and y = v
      g.beginPath(); const P = PAW_PAD, n = P.length;
      g.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      g.closePath();
      for (const [cu, cv, ru, rv, tilt] of PAW_TOES) { // egg: the front end a little fuller than the back
        g.moveTo(cu + ru * Math.cos(tilt), cv + ru * Math.sin(tilt));
        for (let k = 1; k <= 28; k++) { const t = (k / 28) * 6.2832, ct = Math.cos(t), st = Math.sin(t), rr = rv * (1 + 0.14 * ct); const lu = ct * ru, lv = st * rr; g.lineTo(cu + lu * Math.cos(tilt) - lv * Math.sin(tilt), cv + lu * Math.sin(tilt) + lv * Math.cos(tilt)); }
        g.closePath();
      }
    }
    function drawPaw(g, ox, oz, th, s, col) { g.save(); g.translate(ox, oz); g.rotate(th); g.scale(s, s); g.fillStyle = col; pawPath(g); g.fill(); g.restore(); }
    // ---------- extra world primitives (Batch: pos3 nrm3 col4 uv2, non-indexed triangles; grow() before v()) ----------
    // vertical cylinder / cone frustum at (x, z) from y0 to y1, radii r0 -> r1; caps optional
    Batch.prototype.cyl = function (x, z, y0, y1, r0, r1, c, seg, caps, uvU, uvV) {
      seg = seg || 12; this.grow(seg * 6 + (caps ? seg * 6 : 0));
      const h = y1 - y0, sl = (r0 - r1) / (Math.hypot(h, r0 - r1) || 1), cl = h / (Math.hypot(h, r0 - r1) || 1);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const u0 = (uvU || 1) * i / seg, u1 = (uvU || 1) * (i + 1) / seg, vv = uvV || 1;
        const A = [x + c0 * r0, y0, z + s0 * r0, c0 * cl, sl, s0 * cl, u0, vv], B = [x + c1 * r0, y0, z + s1 * r0, c1 * cl, sl, s1 * cl, u1, vv];
        const C = [x + c1 * r1, y1, z + s1 * r1, c1 * cl, sl, s1 * cl, u1, 0], D = [x + c0 * r1, y1, z + s0 * r1, c0 * cl, sl, s0 * cl, u0, 0];
        for (const q of [A, B, C, A, C, D]) this.v(q[0], q[1], q[2], q[3], q[4], q[5], c, q[6], q[7]);
        if (caps) {
          if (r1 > 0) { this.v(x, y1, z, 0, 1, 0, c, 0.5, 0.5); this.v(D[0], y1, D[2], 0, 1, 0, c, 0.5, 0.5); this.v(C[0], y1, C[2], 0, 1, 0, c, 0.5, 0.5); }
          if (r0 > 0) { this.v(x, y0, z, 0, -1, 0, c, 0.5, 0.5); this.v(B[0], y0, B[2], 0, -1, 0, c, 0.5, 0.5); this.v(A[0], y0, A[2], 0, -1, 0, c, 0.5, 0.5); }
        }
      }
    };
    // a round bar between two points; smooth normals, open ends
    Batch.prototype.tube = function (a, b, r, c, seg) {
      seg = seg || 8; this.grow(seg * 6);
      const d = v3n(v3s(b, a)), ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = v3n(v3c(d, ref)), w = v3c(d, u);
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * 6.2832, a1 = ((i + 1) / seg) * 6.2832;
        const n0 = [u[0] * Math.cos(a0) + w[0] * Math.sin(a0), u[1] * Math.cos(a0) + w[1] * Math.sin(a0), u[2] * Math.cos(a0) + w[2] * Math.sin(a0)];
        const n1 = [u[0] * Math.cos(a1) + w[0] * Math.sin(a1), u[1] * Math.cos(a1) + w[1] * Math.sin(a1), u[2] * Math.cos(a1) + w[2] * Math.sin(a1)];
        const P = (p, n) => [p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r];
        for (const [p, n] of [[P(a, n0), n0], [P(a, n1), n1], [P(b, n1), n1], [P(a, n0), n0], [P(b, n1), n1], [P(b, n0), n0]]) this.v(p[0], p[1], p[2], n[0], n[1], n[2], c, 0.5, 0.5);
      }
    };
    Batch.prototype.tubes = function (pts, r, c, seg) { for (let i = 0; i < pts.length - 1; i++) this.tube(pts[i], pts[i + 1], r, c, seg); };
    // surface of revolution around a vertical axis at (x, z): prof = [[r, y], ...] bottom to top
    Batch.prototype.lathe = function (x, z, prof, c, seg) {
      seg = seg || 12; this.grow((prof.length - 1) * seg * 6);
      for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) {
        const [r0, y0] = prof[i], [r1, y1] = prof[i + 1], a0 = j / seg * 6.2832, a1 = (j + 1) / seg * 6.2832, ny = -(r1 - r0), nr = y1 - y0, nl = Math.hypot(ny, nr) || 1;
        const P = (r, y, a) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r], N = (a) => [Math.cos(a) * nr / nl, ny / nl, Math.sin(a) * nr / nl];
        const A = P(r0, y0, a0), B = P(r0, y0, a1), C = P(r1, y1, a1), D = P(r1, y1, a0), na = N(a0), nb = N(a1);
        for (const [p, n] of [[A, na], [D, na], [C, nb], [A, na], [C, nb], [B, nb]]) this.v(p[0], p[1], p[2], n[0], n[1], n[2], c, 0.5, 0.5);
      }
    };
    // ear-clipping triangulation of a simple polygon [[x, z], ...]
    function earcut2(pts) {
      const n = pts.length, idx = []; let area = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
      for (let i = 0; i < n; i++) idx.push(area > 0 ? i : n - 1 - i);
      const out = [], cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
      let guard = 0;
      while (idx.length > 3 && guard++ < 10000) {
        let cut = false;
        for (let i = 0; i < idx.length; i++) {
          const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length], A = pts[ia], B = pts[ib], C = pts[ic];
          if (cross(A, B, C) <= 1e-9) continue;
          let ok = true; for (const j of idx) if (j !== ia && j !== ib && j !== ic && inside(pts[j], A, B, C)) { ok = false; break; }
          if (!ok) continue;
          out.push([ia, ib, ic]); idx.splice(i, 1); cut = true; break;
        }
        if (!cut) break;
      }
      if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
      return out;
    }
    // flat polygon at height y; uvK = texture repeats per metre (world UVs), or a mapper fn(x, z) -> [u, v]
    Batch.prototype.poly = function (pts, y, c, up, uvK) {
      const tri = earcut2(pts); this.grow(tri.length * 3); const ny = up === false ? -1 : 1;
      for (const t of tri) for (const i of t) { const p = pts[i]; const uv = typeof uvK === 'function' ? uvK(p[0], p[1]) : uvK ? [p[0] * uvK, p[1] * uvK] : [0.5, 0.5]; this.v(p[0], y, p[1], 0, ny, 0, c, uv[0], uv[1]); }
    };
    // footprint walls from y0 to y1 (+ top cap unless topC === false); wall UVs in metres * uvK
    Batch.prototype.extrude = function (pts, y0, y1, c, uvK, topC, topUV) {
      const n = pts.length; this.grow(n * 6); let run = 0, area = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
      const s = area > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1, nx = (ez / l) * s, nz = (-ex / l) * s;
        const k = uvK || 0, u0 = run * k, u1 = (run + l) * k, v0 = y1 * k, v1 = y0 * k; run += l;
        const q = [[a[0], y0, a[1], u0, v1], [b[0], y0, b[1], u1, v1], [b[0], y1, b[1], u1, v0], [a[0], y0, a[1], u0, v1], [b[0], y1, b[1], u1, v0], [a[0], y1, a[1], u0, v0]];
        for (const p of q) this.v(p[0], p[1], p[2], nx, 0, nz, c, uvK ? p[3] : 0.5, uvK ? p[4] : 0.5);
      }
      if (topC !== false) this.poly(pts, y1, topC || c, true, topUV || null);
    };
    // box with per-face UVs in metres * k (no bottom)
    Batch.prototype.tbox = function (x0, y0, z0, x1, y1, z1, c, k) {
      k = k || 1; const Q = (a, b, cc, d, n, u0, u1, v0, v1) => this.quad(a, b, cc, d, n, c, [u0 * k, v1 * k, u1 * k, v1 * k, u1 * k, v0 * k, u0 * k, v0 * k]);
      Q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], x0, x1, -y1, -y0);
      Q([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], -x1, -x0, -y1, -y0);
      Q([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], -z1, -z0, -y1, -y0);
      Q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], z0, z1, -y1, -y0);
      Q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], x0, x1, z0, z1);
    };
    // oriented box: centre, length along heading ang (rad, CCW from +x), height, width
    Batch.prototype.obox = function (cx, cy, cz, len, h, wid, ang, c) { this.box(mRY(mT(IDM, cx, cy, cz), -ang), 0, 0, 0, len, h, wid, c); };
    // a vertical quad between two ground points (normal n), UVs in metres * k, or the atlas rectangle uvR
    Batch.prototype.wall = function (x0, z0, x1, z1, y0, y1, c, n, k, uvR) {
      const L = Math.hypot(x1 - x0, z1 - z0); let uv;
      if (uvR) uv = [uvR[0], uvR[3], uvR[2], uvR[3], uvR[2], uvR[1], uvR[0], uvR[1]];
      else { k = k || 0; uv = [0, -y0 * k, L * k, -y0 * k, L * k, -y1 * k, 0, -y1 * k]; }
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], n, c, uv);
    };
    // lumpy ellipsoid with spherical UVs (tree crowns, hedges, shrubs); lump: 0..1 random bulges
    Batch.prototype.blobby = function (cx, cy, cz, rx, ry, rz, c, segs, rows, uvk, lump, rnd) {
      segs = segs || 10; rows = rows || 7; this.grow(segs * rows * 6); const L = lump || 0, ph = rnd ? rnd() * 6.28 : 0, ph2 = rnd ? rnd() * 6.28 : 0;
      const P = (i, j) => { const pa = (i / rows) * Math.PI, th = (j / segs) * 6.2832, nx = Math.sin(pa) * Math.cos(th), ny = Math.cos(pa), nz = Math.sin(pa) * Math.sin(th);
        const k = 1 + L * (0.5 * Math.sin(th * 3 + ph) * Math.sin(pa * 2 + ph2) + 0.35 * Math.sin(th * 5 + ph2 * 2) * Math.cos(pa * 3 + ph));
        const n = v3n([nx / rx, ny / ry, nz / rz]); return [[cx + nx * rx * k, cy + ny * ry * k, cz + nz * rz * k], n, [th * (uvk || 1) * Math.max(rx, rz), pa * (uvk || 1) * ry]]; };
      for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { const a = P(i, j), b = P(i + 1, j), d = P(i + 1, j + 1), e = P(i, j + 1); for (const q of [a, b, d, a, d, e]) this.v(q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], c, q[2][0], q[2][1]); }
    };
    // a leafy crown cluster: an icosphere (subdivided once at detail 1) with its vertices pushed in and out, normals bent outward
    // with a little scatter, colour darker underneath (self-shade); UVs in metres * uvk so the leaf photo keeps its scale
    const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3n);
      const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      const sub = (tris) => { const out = []; for (const [a, b, c] of tris) { const ab = v3n([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]), bc = v3n([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]), ca = v3n([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]); out.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); } return out; };
      const t0 = F.map((f) => f.map((i) => V[i])), t1 = sub(t0); return [t0, t1, sub(t1)]; })();
    Batch.prototype.clump = function (cx, cy, cz, r, ry, c, rnd, detail, uvk) {
      const T = ICO[detail ? 1 : 0], ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], k = uvk || 0.4; this.grow(T.length * 3);
      const disp = (p) => 1 + 0.13 * Math.sin(p[0] * 3.1 + ph[0]) * Math.sin(p[1] * 2.7 + ph[1]) + 0.09 * Math.sin(p[2] * 4.3 + ph[2] + p[0] * 2.0);
      for (const tri of T) for (const p of tri) {
        const d = disp(p), x = cx + p[0] * r * d, y = cy + p[1] * ry * d, z = cz + p[2] * r * d, j = 0.12 * Math.sin(p[0] * 9 + p[2] * 7 + ph[0]);
        const n = v3n([p[0] + j, p[1] + 0.25 + j * 0.5, p[2] - j]), sh = 0.62 + 0.38 * Math.max(0, p[1] * 0.5 + 0.5);
        this.v(x, y, z, n[0], n[1], n[2], [c[0] * sh, c[1] * sh, c[2] * sh, 1], (Math.atan2(p[2], p[0]) * r + cx) * k, (Math.acos(Math.max(-1, Math.min(1, p[1]))) * ry + cy) * k);
      }
    };
    // a whole deciduous crown: an icosphere (detail 1 or 2) swollen by a dozen random lobes into a cauliflower of leaf masses, smooth
    // shared normals, colour darkened in the hollows between masses and underneath, so it reads as clumps of foliage with depth
    Batch.prototype.crown = function (cx, cy, cz, rx, ry, c, rnd, detail, uvk, flatB) {
      const T = ICO[detail], k = uvk || 0.4, lobes = [];
      for (let i = 0; i < 16; i++) { const a = rnd() * 6.2832, e = Math.asin(rnd() * 1.6 - 0.6); lobes.push([Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a), 0.1 + rnd() * 0.16, 4 + rnd() * 6]); }
      const ph = rnd() * 6.28, D = (p) => { let d = 0.8; for (const l of lobes) { const q = p[0] * l[0] + p[1] * l[1] + p[2] * l[2]; if (q > 0) d += l[3] * Math.pow(q, l[4]); } d += 0.045 * Math.sin(p[0] * 11 + ph) * Math.sin(p[1] * 9 + p[2] * 7) + 0.03 * Math.sin(p[2] * 17 - ph + p[0] * 5); if (p[1] < 0) d *= 1 - (flatB || 0.25) * p[1] * p[1]; return d; };
      const key = (p) => (p[0] * 1e4 | 0) + ',' + (p[1] * 1e4 | 0) + ',' + (p[2] * 1e4 | 0), P = new Map(), N = new Map();
      let dmin = 9, dmax = 0; const pos = (p) => { const kk = key(p); let v = P.get(kk); if (!v) { const d = D(p); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); v = [cx + p[0] * rx * d, cy + p[1] * ry * d, cz + p[2] * rx * d, d]; P.set(kk, v); N.set(kk, [0, 0, 0]); } return v; };
      for (const tri of T) { const a = pos(tri[0]), b = pos(tri[1]), cc = pos(tri[2]), n = v3c(v3s(b, a), v3s(cc, a)); for (const p of tri) { const m = N.get(key(p)); m[0] += n[0]; m[1] += n[1]; m[2] += n[2]; } }
      this.grow(T.length * 3);
      for (const tri of T) for (const p of tri) {
        const kk = key(p), v = P.get(kk), n0 = v3n(N.get(kk)), n = v3n([n0[0] * 0.75 + p[0] * 0.25, n0[1] * 0.75 + p[1] * 0.25 + 0.08, n0[2] * 0.75 + p[2] * 0.25]);
        const hol = (v[3] - dmin) / Math.max(1e-3, dmax - dmin), sh = (0.34 + 0.66 * Math.sqrt(hol)) * (0.66 + 0.34 * Math.max(0, p[1] * 0.5 + 0.5)); // deep hollows between the leaf masses
        this.v(v[0], v[1], v[2], n[0], n[1], n[2], [c[0] * sh, c[1] * sh, c[2] * sh, 1], (Math.atan2(p[2], p[0]) * rx * Math.sqrt(Math.max(0.05, 1 - p[1] * p[1])) + cx) * k, (Math.acos(Math.max(-1, Math.min(1, p[1]))) * ry * 1.1) * k);
      }
    };
    // a U-shaped slide trough along a 3D path (bed + two side walls), width w, wall height h
    Batch.prototype.trough = function (path, w, h, c) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1], d = v3n(v3s(b, a)), sd = v3n(v3c([0, 1, 0], d)), up = v3n(v3c(d, sd));
        const off = (p, s, y) => [p[0] + sd[0] * s + up[0] * y, p[1] + sd[1] * s + up[1] * y, p[2] + sd[2] * s + up[2] * y];
        this.quad(off(a, -w / 2, 0), off(b, -w / 2, 0), off(b, w / 2, 0), off(a, w / 2, 0), up, c);
        this.quad(off(a, -w / 2, 0), off(b, -w / 2, 0), off(b, -w / 2, h), off(a, -w / 2, h), sd, c);
        this.quad(off(a, w / 2, 0), off(b, w / 2, 0), off(b, w / 2, h), off(a, w / 2, h), [-sd[0], -sd[1], -sd[2]], c);
        this.quad(off(a, -w / 2, -0.04), off(b, -w / 2, -0.04), off(b, w / 2, -0.04), off(a, w / 2, -0.04), [-up[0], -up[1], -up[2]], c);
      }
    };

    // ---------- the room (yards) ----------
    const GYM = {
      x0: -17.2, x1: 17.2, z0: -11.2, z1: 20.2,           // inside faces of the walls (-z far wall, +z wall behind the bleachers)
      truss: 8.4, deck: 10.2,                             // bottom chord of the trusses, roof deck
      band: [2.65, 3.3], pin: 0.06,                        // the wide red band high on the block walls, and its dark pinstripes
      bl: { z: COURT.HW + 4.2, rows: 10, rise: 10 * IN2Y, tread: 24 * IN2Y, banks: [[-16.2, -0.9], [0.9, 16.2]], aisleW: 1.1 }, // bleachers
      div: { x: 0.9 },                                    // the folded divider wall between the banks
      bench: { z: COURT.HW + 2.15, home: [-11.6, -3.1], away: [3.1, 11.6], n: 9 }, // folding chairs, facing the court (-z)
      table: { x: 0, z: COURT.HW + 1.7, len: 5.4, dep: 0.85, h: 0.83 },          // the scorer's table (front faces -z)
      board: { x: -6.5, y: 5.6, w: 5.4, h: 2.0 },          // the scoreboard on the far wall (upper left from the stands)
      flag: { x: 6.2, y: 5.4, w: 4.0, h: 2.1 },            // the flag on the far wall (upper right)
      lineC: '#16110d', red: '#b3121f', redD: '#7e0b15', cream: '#ebe4d2', maple: '#d6a565',
    };
    const MAPLE = hx3('#ffffff'), CREAM = hx3(GYM.cream), REDC = hx3(GYM.red), REDD = hx3(GYM.redD), BLK = hx3('#121315'), STEELW = hx3('#e4e4df'), GREY = hx3('#55585e'), DGREY = hx3('#2f3135');
    // the gym's light: eight of the dome high-bays as diffuse pools in every lit shader (no shadows), the rest visual only
    const LAMPC = [1.0, 0.95, 0.86];
    const SKX = { on: false, pools: new Float32Array(32), poolK: 6, snow: null, wet: 0 };
    { let i = 0; for (const x of [-10.5, -3.5, 3.5, 10.5]) for (const z of [-4.5, 4.5]) { SKX.pools.set([x, 7.6, z, 22], i * 4); i++; } }
    function skyShader(src) {
      if (SKX.pools && src.indexOf('uniform samplerCube uEnv;') >= 0) {
        src = src.replace('uniform samplerCube uEnv;', 'uniform vec4 uPool[8];uniform vec3 uPoolC;uniform float uPoolK;\nuniform samplerCube uEnv;')
          .replace('  // ambient: hemisphere diffuse + cubemap specular', `  for(int i=0;i<8;i++){vec3 Lv=uPool[i].xyz-vW;float d2=dot(Lv,Lv);vec3 L=Lv*inversesqrt(max(d2,0.01));float att=uPool[i].w/(d2+uPoolK);
   float cone=0.35+0.65*clamp(L.y*1.6,0.0,1.0);float nl=max(dot(N,L),0.0);if(mode==1)nl=clamp((dot(N,L)+0.3)/1.3,0.0,1.0)*0.9;col+=uPoolC*diff*(att*cone*nl*ao/3.14159);}
  // ambient: hemisphere diffuse + cubemap specular`);
      }
      return src;
    }
    function skyGL() {
      if (!G) return;
      for (const k of ['world', 'worldHi', 'skin', 'skinHi']) {
        const P = G[k]; if (!P) continue; gl.useProgram(P.pr);
        if (P.u.uPool) { gl.uniform4fv(P.u.uPool, SKX.pools); gl.uniform3fv(P.u.uPoolC, LAMPC); gl.uniform1f(P.u.uPoolK, SKX.poolK); }
      }
    }
    function skyName() { return 'Wildcat Gym'; }
    // the camera never leaves the room or goes through the bleachers, the walls or the roof
    function gymKeepOut(e) {
      e[0] = clamp(e[0], GYM.x0 + 0.6, GYM.x1 - 0.6); e[2] = clamp(e[2], GYM.z0 + 0.6, GYM.bl.z - 0.35); // never behind the front of the bleachers (the divider stack stands there) e[1] = clamp(e[1], 1.0, GYM.truss - 0.4);
      const b = GYM.bl, dz = e[2] - b.z; if (dz > 0) { const top = Math.min(b.rows, Math.floor(dz / b.tread) + 1) * b.rise + 1.6; if (e[1] < top) e[1] = top; }
      return e;
    }

    // ---------- the court floor canvas: maple strips, the paint, the lines, the paw and the lettering ----------
    const FLR = { x0: -16.6, x1: 16.6, z0: -10.9, z1: 12.3 };
    function gymFloorCanvas(q) {
      const K = q >= 2 ? 72 : q === 1 ? 56 : 36, W = Math.round((FLR.x1 - FLR.x0) * K), H = Math.round((FLR.z1 - FLR.z0) * K);
      const c = mkCv(W, H), g = c.getContext('2d'), r = mrng(0x6d79);
      const X = (x) => (x - FLR.x0) * K, Z = (z) => (z - FLR.z0) * K;
      // maple: strips 2.25 in wide along x, butt joints at random lengths, honey tints, grain streaks, soft dark edges
      g.fillStyle = GYM.maple; g.fillRect(0, 0, W, H);
      const sw = 2.25 * IN2Y;
      const tints = ['#d9a96a', '#d3a061', '#cd9958', '#dcae70', '#c99456', '#d6a666', '#bf8a4c'];
      for (let z = FLR.z0; z < FLR.z1; z += sw) {
        let x = FLR.x0 - r() * 2;
        while (x < FLR.x1) { const l = 0.7 + r() * 2.0; g.fillStyle = tints[(r() * tints.length) | 0]; g.fillRect(X(x), Z(z), l * K + 1, sw * K + 0.6); g.fillStyle = 'rgba(70,40,15,0.35)'; g.fillRect(X(x), Z(z), 1, sw * K); x += l; }
        g.fillStyle = 'rgba(70,40,15,0.18)'; g.fillRect(0, Z(z), W, 1);
      }
      g.globalAlpha = 0.07; for (let i = 0; i < 9000 * (K / 56); i++) { const x = r() * W, y = r() * H; g.fillStyle = r() < 0.5 ? '#6b3e17' : '#f3d29a'; g.fillRect(x, y, 4 + r() * 22, 1); } g.globalAlpha = 1;
      // sheen variation
      for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, rr = (40 + r() * 160) * K / 56, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,235,190,0.06)' : 'rgba(90,50,15,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      const HL = COURT.HL, HW = COURT.HW, lw = Math.max(1.5, COURT.line * K), band = COURT.oobBand;
      // the black out-of-bounds band with its red edge
      g.fillStyle = '#121212';
      g.fillRect(X(-HL - band), Z(-HW - band), (2 * HL + 2 * band) * K, band * K); g.fillRect(X(-HL - band), Z(HW), (2 * HL + 2 * band) * K, band * K);
      g.fillRect(X(-HL - band), Z(-HW), band * K, 2 * HW * K); g.fillRect(X(HL), Z(-HW), band * K, 2 * HW * K);
      g.strokeStyle = GYM.red; g.lineWidth = lw * 1.6; g.strokeRect(X(-HL - band), Z(-HW - band), (2 * HL + 2 * band) * K, (2 * HW + 2 * band) * K);
      // the red keys and the red centre circle
      g.fillStyle = GYM.red;
      for (const d of [-1, 1]) { const x0 = d > 0 ? COURT.ftX : -HL, x1 = d > 0 ? HL : -COURT.ftX; g.fillRect(X(x0), Z(-COURT.keyW / 2), (x1 - x0) * K, COURT.keyW * K); }
      g.beginPath(); g.arc(X(0), Z(0), COURT.ccR * K, 0, 6.2832); g.fill();
      // the paw in the circle (white with a thin black rim), toes toward +x
      g.save(); g.translate(X(0), Z(0)); g.scale(-1, 1); const ps = 1.25 * K; g.lineWidth = 3 / ps * 1.2;
      g.scale(ps, ps); g.fillStyle = '#f6f3ea'; g.strokeStyle = '#111'; pawPath(g); g.fill(); g.stroke(); g.restore();
      // lines (dark, as in the photos)
      g.strokeStyle = GYM.lineC; g.lineWidth = lw;
      g.strokeRect(X(-HL), Z(-HW), 2 * HL * K, 2 * HW * K);
      g.beginPath(); g.moveTo(X(0), Z(-HW)); g.lineTo(X(0), Z(HW)); g.stroke();
      g.beginPath(); g.arc(X(0), Z(0), COURT.ccR * K, 0, 6.2832); g.stroke();
      g.beginPath(); g.arc(X(0), Z(0), 2 * F2Y * K, 0, 6.2832); g.stroke();
      for (const h of HOOP) {
        const d = h.dir, xb = d * HL, xf = d * COURT.ftX;
        g.strokeStyle = '#f2efe6'; g.lineWidth = lw; g.strokeRect(X(Math.min(xb, xf)), Z(-COURT.keyW / 2), Math.abs(xb - xf) * K, COURT.keyW * K); // key outline (white on red)
        g.strokeStyle = GYM.lineC;
        // the free-throw circle: solid outside the lane, dashed inside
        g.beginPath(); g.arc(X(xf), Z(0), COURT.ftR * K, d > 0 ? Math.PI / 2 : -Math.PI / 2, d > 0 ? Math.PI * 1.5 : Math.PI / 2); g.stroke();
        g.setLineDash([0.45 * K, 0.35 * K]); g.beginPath(); g.arc(X(xf), Z(0), COURT.ftR * K, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke(); g.setLineDash([]);
        // the 3-point arc, to the baseline
        const R = COURT.three, dz0 = Math.sqrt(Math.max(0, R * R - Math.pow(HL - RIM_X, 2))), a0 = Math.atan2(dz0, xb - h.x);
        g.beginPath(); if (d > 0) g.arc(X(h.x), Z(0), R * K, Math.PI - (Math.PI - a0), Math.PI + (Math.PI - a0), true); else g.arc(X(h.x), Z(0), R * K, -a0, a0, true);
        g.stroke();
        // lane hashes
        for (const s of [-1, 1]) for (const f of [7, 8, 11, 14]) { const x = d * (HL - f * F2Y); g.beginPath(); g.moveTo(X(x), Z(s * COURT.keyW / 2)); g.lineTo(X(x), Z(s * (COURT.keyW / 2 + 0.22))); g.stroke(); }
        // coaching box ticks on the bench sideline
        g.beginPath(); g.moveTo(X(d * (HL - COURT.boxX)), Z(HW)); g.lineTo(X(d * (HL - COURT.boxX)), Z(HW + 1)); g.stroke();
      }
      // lettering
      const txt = (s, x, z, rot, hYd, col, outline, maxW) => {
        g.save(); g.translate(X(x), Z(z)); g.scale(-1, 1); g.rotate(rot);
        g.font = `900 ${Math.round(hYd * K * 1.25)}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (maxW) { const w = g.measureText(s).width; if (w > maxW * K) g.scale((maxW * K) / w, 1); }
        if (outline) { g.lineWidth = hYd * K * 0.09; g.strokeStyle = outline; g.lineJoin = 'round'; g.strokeText(s, 0, 0); }
        g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
      };
      txt('WILDCATS', 0, -HW - band - 1.25, 0, 1.25, GYM.red, '#1b1b1b', 18);
      for (const d of [-1, 1]) txt('WILDCATS', d * (HL + band + 0.95), 0, -d * Math.PI / 2, 1.0, GYM.red, '#1b1b1b', 12);
      txt('METCALF', 0, HW + band + 0.55, Math.PI, 0.55, '#f2efe6', '#1b1b1b', 7);
      return c;
    }
    // the block wall tile (painted near white, tinted per vertex): running bond 16 x 8 in blocks
    function gymBlockCanvas() {
      const N = 256, c = mkCv(N, N), g = c.getContext('2d'), r = mrng(77);
      g.fillStyle = '#f1efe9'; g.fillRect(0, 0, N, N);
      const bw = N / 2, bh = N / 4;
      for (let row = 0; row < 4; row++) { const off = row % 2 ? bw / 2 : 0, y = row * bh; g.fillStyle = '#cbc5b8'; g.fillRect(0, y, N, 3); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, y + 3, N, 1);
        for (let k = -1; k < 3; k++) { const x = off + k * bw; g.fillStyle = '#cbc5b8'; g.fillRect(x, y, 3, bh); } }
      g.globalAlpha = 0.06; for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * N, r() * N, 2, 2); } g.globalAlpha = 1;
      return c;
    }
    // the atlas: banners, the flag, the pads' lettering, the doors, the exit sign (named rectangles in a 2048 x 1024 canvas)
    const GATL = { banner: [0, 0, 256, 512], banner2: [256, 0, 256, 512], banner3: [512, 0, 256, 512], flag: [768, 0, 760, 400], pad: [768, 400, 1024, 128], exit: [1792, 400, 256, 96], door: [1536, 0, 256, 400], hoopPad: [768, 528, 1024, 96], clock: [1792, 528, 256, 256], header: [0, 512, 768, 128] };
    const guv = (k) => { const a = GATL[k]; return [a[0] / 2048, a[1] / 1024, (a[0] + a[2]) / 2048, (a[1] + a[3]) / 1024]; };
    function gymAtlasCanvas() {
      const c = mkCv(2048, 1024), g = c.getContext('2d');
      g.fillStyle = '#808080'; g.fillRect(0, 0, 2048, 1024);
      const font = (px, w) => `${w || 900} ${px}px "Barlow Condensed", Impact, "Arial Narrow", sans-serif`;
      const banner = (k, l1, l2, l3) => {
        const [x, y, w, h] = GATL[k];
        g.fillStyle = GYM.red; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - 70); g.lineTo(x + w / 2, y + h); g.lineTo(x, y + h - 70); g.closePath(); g.fill();
        g.strokeStyle = '#f4f1e8'; g.lineWidth = 8; g.beginPath(); g.moveTo(x + 14, y + 14); g.lineTo(x + w - 14, y + 14); g.lineTo(x + w - 14, y + h - 80); g.lineTo(x + w / 2, y + h - 18); g.lineTo(x + 14, y + h - 80); g.closePath(); g.stroke();
        g.save(); g.translate(x + w / 2, y + 95); g.rotate(-Math.PI / 2); g.scale(52, 52); g.fillStyle = '#f4f1e8'; pawPath(g); g.fill(); g.restore();
        g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = font(44); g.fillText(l1, x + w / 2, y + 200, w - 30); g.font = font(30, 800); g.fillText(l2, x + w / 2, y + 255, w - 30); g.font = font(56); g.fillText(l3, x + w / 2, y + 330, w - 30);
      };
      banner('banner', 'WILDCATS', 'CONFERENCE CHAMPIONS', '2019'); banner('banner2', 'WILDCATS', 'TOURNAMENT CHAMPIONS', '2022'); banner('banner3', 'WILDCATS', 'UNDEFEATED SEASON', '2024');
      { // the flag: 13 stripes, the canton with stars
        const [x, y, w, h] = GATL.flag, sh = h / 13;
        for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f2ec' : '#b22234'; g.fillRect(x, y + i * sh, w, sh + 1); }
        g.fillStyle = '#3c3b6e'; g.fillRect(x, y, w * 0.4, sh * 7);
        g.fillStyle = '#f4f2ec'; for (let r2 = 0; r2 < 9; r2++) for (let k = 0; k < (r2 % 2 ? 5 : 6); k++) { const sx = x + w * 0.4 * ((k + (r2 % 2 ? 1 : 0.5)) / 6), sy = y + sh * 7 * ((r2 + 0.7) / 10); g.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? 4 : 10; g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } g.fill(); }
      }
      { const [x, y, w, h] = GATL.pad; g.fillStyle = '#a80f1c'; g.fillRect(x, y, w, h); g.fillStyle = '#f4f1e8'; g.font = font(96); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WILDCATS', x + w / 2, y + h / 2 + 4); }
      { const [x, y, w, h] = GATL.hoopPad; g.fillStyle = '#a80f1c'; g.fillRect(x, y, w, h); g.fillStyle = '#f4f1e8'; g.font = font(70); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WILDCATS', x + w / 2, y + h / 2 + 3); }
      { const [x, y, w, h] = GATL.exit; g.fillStyle = '#1a0606'; g.fillRect(x, y, w, h); g.fillStyle = '#ff2a1a'; g.font = font(78); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', x + w / 2, y + h / 2 + 3); }
      { const [x, y, w, h] = GATL.door; g.fillStyle = '#9d1220'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.strokeRect(x + 6, y + 6, w - 12, h - 12); g.beginPath(); g.moveTo(x + w / 2, y + 6); g.lineTo(x + w / 2, y + h - 6); g.stroke();
        g.fillStyle = '#c9ccd0'; g.fillRect(x + 20, y + h * 0.48, w - 40, 12); g.fillStyle = 'rgba(200,220,235,0.8)'; g.fillRect(x + 30, y + 40, 50, 90); g.fillRect(x + w - 80, y + 40, 50, 90); }
      { const [x, y, w, h] = GATL.clock; g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(x + w / 2, y + h / 2, w / 2 - 8, 0, 6.2832); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 10; g.stroke();
        g.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; g.beginPath(); g.moveTo(x + w / 2 + Math.cos(a) * 96, y + h / 2 + Math.sin(a) * 96); g.lineTo(x + w / 2 + Math.cos(a) * 112, y + h / 2 + Math.sin(a) * 112); g.stroke(); }
        g.lineWidth = 8; g.beginPath(); g.moveTo(x + w / 2, y + h / 2); g.lineTo(x + w / 2 + 40, y + h / 2 - 50); g.moveTo(x + w / 2, y + h / 2); g.lineTo(x + w / 2 - 70, y + h / 2 + 10); g.stroke(); }
      { const [x, y, w, h] = GATL.header; g.fillStyle = GYM.red; g.fillRect(x, y, w, h); g.fillStyle = '#f4f1e8'; g.font = font(92); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('METCALF WILDCATS', x + w / 2 + 40, y + h / 2 + 4, w - 160);
        g.save(); g.translate(x + 70, y + h / 2); g.rotate(-Math.PI / 2); g.scale(46, 46); pawPath(g); g.fill(); g.restore(); }
      return c;
    }
    // the scoreboard face (live): red 7-segment digits in a black cabinet; HOME / GUEST / PERIOD / FOULS; two shot clock cells
    const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    function seg7(g, x, y, h, ch) {
      const w = h * 0.52, t = h * 0.12, on = SEG7[ch] || '';
      const S = { a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, h / 2 - 1.5 * t], c: [x + w - t, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t], d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t], f: [x, y + t, t, h / 2 - 1.5 * t], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t] };
      for (const k in S) { const s = S[k], lit = on.indexOf(k) >= 0; g.fillStyle = lit ? '#ff2a1a' : '#2a0707'; g.shadowBlur = lit ? h * 0.12 : 0; g.shadowColor = '#ff3020'; g.fillRect(s[0], s[1], s[2], s[3]); }
      g.shadowBlur = 0; return w;
    }
    function digits(g, x, y, h, s, n) { s = String(s); while (s.length < n) s = ' ' + s; const w = h * 0.52 + h * 0.16; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === ':') { g.fillStyle = '#ff2a1a'; g.fillRect(x + i * w - h * 0.1, y + h * 0.28, h * 0.1, h * 0.1); g.fillRect(x + i * w - h * 0.1, y + h * 0.62, h * 0.1, h * 0.1); x -= w * 0.6; continue; } seg7(g, x + i * w, y, h, ch); } }
    const boardC = mkCv(1024, 512);
    function gymBoardCanvas() {
      const g = boardC.getContext('2d');
      g.fillStyle = '#060607'; g.fillRect(0, 0, 1024, 512);
      g.font = '800 44px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#d8d8d2';
      g.fillText('HOME', 170, 40); g.fillText('GUEST', 854, 40); g.fillText('PERIOD', 512, 300); g.fillText('FOULS', 150, 300); g.fillText('FOULS', 874, 300);
      const H = typeof hs === 'number' ? hs : 0, A = typeof as === 'number' ? as : 0, Q = typeof qtr === 'number' ? Math.min(qtr, 9) : 1, C = typeof clock === 'number' ? clock : QS;
      digits(g, 50, 80, 150, H % 1000, 3); digits(g, 734, 80, 150, A % 1000, 3);
      const mm = Math.floor(Math.ceil(C) / 60), ss = Math.ceil(C) % 60; digits(g, 340, 70, 160, mm + ':' + String(ss).padStart(2, '0'), 4);
      digits(g, 490, 330, 110, Q, 1);
      const F = typeof teams !== 'undefined' && teams ? teams : null;
      digits(g, 90, 330, 110, F ? Math.min(99, F[0].fq) : 0, 2); digits(g, 814, 330, 110, F ? Math.min(99, F[1].fq) : 0, 2);
      // shot clock cells (two small faces read from the bottom strip)
      const sc = typeof shotClk === 'number' ? Math.max(0, Math.ceil(shotClk)) : SHOT;
      g.fillStyle = '#060607'; g.fillRect(0, 448, 1024, 64); digits(g, 30, 452, 56, sc, 2); digits(g, 542, 452, 56, sc, 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 512; y += 4) g.fillRect(0, y, 1024, 1);
      return boardC;
    }
    // the scorer's table screen: HOME OF THE WILDCATS between two paws (live: it flashes the big moments)
    const tableC = mkCv(2048, 256); let tableMsg = '', tableT = 0;
    function gymTableCanvas() {
      const g = tableC.getContext('2d');
      g.fillStyle = '#050506'; g.fillRect(0, 0, 2048, 256);
      g.fillStyle = GYM.red; g.fillRect(0, 10, 2048, 10); g.fillRect(0, 236, 2048, 10);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 150px "Barlow Condensed", Impact, sans-serif';
      const t = tableMsg || 'HOME OF THE WILDCATS';
      g.fillStyle = '#7e0b15'; g.fillText(t, 1024 + 6, 134 + 6, 1500); g.fillStyle = '#f6f3ea'; g.fillText(t, 1024, 134, 1500);
      for (const x of [150, 1898]) { g.save(); g.translate(x, 128); g.rotate(-Math.PI / 2); g.scale(95, 95); g.fillStyle = '#d5232f'; pawPath(g); g.fill(); g.restore(); }
      g.fillStyle = 'rgba(0,0,0,0.45)'; for (let x = 0; x < 2048; x += 5) g.fillRect(x, 0, 1, 256); for (let y = 0; y < 256; y += 5) g.fillRect(0, y, 2048, 1);
      return tableC;
    }
    function tableFlash(s, secs) { tableMsg = s; tableT = secs || 2.2; tableDirty = true; }
    let tableDirty = false;

    // ---------- the room's geometry ----------
    function buildGym() {
      const r = mrng(0x6d79);
      const D = {}, nb = (k, cap) => D[k] || (D[k] = new Batch(cap || 2000));
      const flat = nb('flat', 30000), steel = nb('steel', 30000), glow = nb('glow', 3000), cush = nb('cush', 12000), atl = nb('atl', 2000), seat = nb('seat', 8000);
      const block = nb('block', 2000), floor = nb('floor', 12), boardB = nb('board', 60), tableB = nb('table', 12), glass = nb('glass', 200);
      const up = [0, 1, 0];
      // the floor (court + run-off, the same canvas), and plain boards under the bleachers / outside the canvas
      floor.quad([FLR.x0, 0, FLR.z0], [FLR.x1, 0, FLR.z0], [FLR.x1, 0, FLR.z1], [FLR.x0, 0, FLR.z1], up, [1, 1, 1, 1], [0, 0, 1, 0, 1, 1, 0, 1]);
      const surround = hx3('#b98a52');
      flat.quad([GYM.x0, -0.005, GYM.z0], [GYM.x1, -0.005, GYM.z0], [GYM.x1, -0.005, GYM.z1], [GYM.x0, -0.005, GYM.z1], up, surround);
      // ---- walls: cream block, the wide red band high up with dark pinstripes, cream above to the steel, a grey band to the deck ----
      const wallSeg = (x0, z0, x1, z1, n) => {
        const bands = [[0, GYM.band[0] - GYM.pin, CREAM], [GYM.band[0] - GYM.pin, GYM.band[0], BLK], [GYM.band[0], GYM.band[1], REDC], [GYM.band[1], GYM.band[1] + GYM.pin, BLK], [GYM.band[1] + GYM.pin, GYM.truss + 0.4, CREAM], [GYM.truss + 0.4, GYM.deck, hx3('#c9c7c0')]];
        for (const [y0, y1, col] of bands) block.wall(x0, z0, x1, z1, y0, y1, col, n, 1.15);
      };
      wallSeg(GYM.x1, GYM.z0, GYM.x0, GYM.z0, [0, 0, 1]);     // far wall (-z)
      wallSeg(GYM.x0, GYM.z1, GYM.x1, GYM.z1, [0, 0, -1]);    // wall behind the bleachers (+z)
      wallSeg(GYM.x0, GYM.z0, GYM.x0, GYM.z1, [1, 0, 0]);     // end walls
      wallSeg(GYM.x1, GYM.z1, GYM.x1, GYM.z0, [-1, 0, 0]);
      // end-wall pads behind the baskets
      for (const d of [-1, 1]) { const x = d * (GYM.x1 - 0.06); flat.wbox(x - 0.05, 0.05, -5.5, x + 0.05, 2.2, 5.5, hx3('#a80f1c')); const xf = x - d * 0.056, uv = guv('pad'); atl.quad([xf, 0.9, d * 3.2], [xf, 0.9, -d * 3.2], [xf, 1.9, -d * 3.2], [xf, 1.9, d * 3.2], [-d, 0, 0], [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]); }
      // doors with exit signs (far wall right end, and one in each end wall)
      const door = (x0, z0, x1, z1, n) => { const uv = guv('door'); const o = 0.03; atl.quad([x0 + n[0] * o, 0, z0 + n[2] * o], [x1 + n[0] * o, 0, z1 + n[2] * o], [x1 + n[0] * o, 2.4, z1 + n[2] * o], [x0 + n[0] * o, 2.4, z0 + n[2] * o], n, [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]);
        const ex = guv('exit'), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, tx = (x1 - x0) / Math.hypot(x1 - x0, z1 - z0) * 0.45, tz = (z1 - z0) / Math.hypot(x1 - x0, z1 - z0) * 0.45; glow.quad([cx - tx + n[0] * 0.08, 2.55, cz - tz + n[2] * 0.08], [cx + tx + n[0] * 0.08, 2.55, cz + tz + n[2] * 0.08], [cx + tx + n[0] * 0.08, 2.85, cz + tz + n[2] * 0.08], [cx - tx + n[0] * 0.08, 2.85, cz - tz + n[2] * 0.08], [0, 0, 0], [1, 0.25, 0.2, 1]);
        flat.wbox(cx - tx * 1.1 + n[0] * 0.02, 2.5, cz - tz * 1.1 + n[2] * 0.02, cx + tx * 1.1 + n[0] * 0.07, 2.9, cz + tz * 1.1 + n[2] * 0.07, BLK); void ex; };
      door(14.6, GYM.z0, 12.6, GYM.z0, [0, 0, 1]); door(-12.6, GYM.z0, -14.6, GYM.z0, [0, 0, 1]);
      door(GYM.x0, -9.6, GYM.x0, -7.6, [1, 0, 0]); door(GYM.x1, -7.6, GYM.x1, -9.6, [-1, 0, 0]);
      // a clock high on an end wall
      { const uv = guv('clock'), x = GYM.x0 + 0.05; atl.quad([x, 5.6, 0.5], [x, 5.6, -0.5], [x, 6.6, -0.5], [x, 6.6, 0.5], [1, 0, 0], [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]); }
      // ---- the roof: white steel trusses across the room, purlins, the deck; round dome high-bays on rods ----
      const zA = GYM.z0, zB = GYM.z1;
      for (let x = -15; x <= 15.01; x += 5) {
        steel.wbox(x - 0.09, GYM.truss, zA, x + 0.09, GYM.truss + 0.2, zB, STEELW); steel.wbox(x - 0.09, GYM.truss + 1.55, zA, x + 0.09, GYM.truss + 1.75, zB, STEELW);
        let up2 = true; for (let z = zA; z < zB - 0.1; z += 1.3) { const z2 = Math.min(zB, z + 1.3); steel.tube([x, up2 ? GYM.truss + 0.15 : GYM.truss + 1.6, z], [x, up2 ? GYM.truss + 1.6 : GYM.truss + 0.15, z2], 0.04, STEELW, 5); up2 = !up2; }
      }
      for (let z = zA + 1; z < zB; z += 1.7) steel.wbox(GYM.x0, GYM.truss + 1.75, z - 0.06, GYM.x1, GYM.truss + 1.95, z + 0.06, STEELW);
      flat.quad([GYM.x0, GYM.deck, GYM.z1], [GYM.x1, GYM.deck, GYM.z1], [GYM.x1, GYM.deck, GYM.z0], [GYM.x0, GYM.deck, GYM.z0], [0, -1, 0], hx3('#e9e8e2'));
      for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 5; iz++) {
        const x = -12.5 + ix * 5, z = -7.5 + iz * 4.6, y = 7.4;
        steel.tube([x, y + 0.35, z], [x, GYM.truss + 0.1, z], 0.012, DGREY, 4);
        steel.lathe(x, z, [[0.06, y + 0.45], [0.16, y + 0.42], [0.36, y + 0.12], [0.42, y]], hx3('#d6d6d0'), 14);
        glow.disc(x, z, 0.38, [2.6, 2.5, 2.3, 1], y - 0.005, 14);
      }
      // ---- the far wall: the scoreboard (upper left), the flag (upper right), the banners, folded side backboards ----
      const fz = GYM.z0 + 0.05;
      { const B = GYM.board, x0 = B.x - B.w / 2, x1 = B.x + B.w / 2;
        flat.wbox(x0 - 0.15, B.y - 0.15, GYM.z0, x1 + 0.15, B.y + B.h + 0.7, GYM.z0 + 0.3, BLK);
        const uv = guv('header'); atl.quad([x1, B.y + B.h + 0.02, fz + 0.27], [x0, B.y + B.h + 0.02, fz + 0.27], [x0, B.y + B.h + 0.6, fz + 0.27], [x1, B.y + B.h + 0.6, fz + 0.27], [0, 0, 1], [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]);
        // face: u runs with -x (seen from the court the board reads left to right); the bottom strip (shot clocks) is not on this face
        boardB.quad([x1 - 0.05, B.y, fz + 0.27], [x0 + 0.05, B.y, fz + 0.27], [x0 + 0.05, B.y + B.h, fz + 0.27], [x1 - 0.05, B.y + B.h, fz + 0.27], [0, 0, 0], [1, 1, 1, 1], [0, 448 / 512, 1, 448 / 512, 1, 0, 0, 0]); }
      { const F = GYM.flag, uv = guv('flag'), n = 6; steel.tube([F.x + F.w / 2 + 0.1, F.y + F.h + 0.05, fz + 0.06], [F.x - F.w / 2 - 0.1, F.y + F.h + 0.05, fz + 0.06], 0.02, GREY, 6);
        for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n, xa = F.x + F.w / 2 - a * F.w, xb = F.x + F.w / 2 - b * F.w, za = fz + 0.04 + 0.05 * Math.sin(a * 9), zb2 = fz + 0.04 + 0.05 * Math.sin(b * 9), u0 = uv[0] + (uv[2] - uv[0]) * a, u1 = uv[0] + (uv[2] - uv[0]) * b;
          atl.quad([xa, F.y + 0.04 * Math.sin(a * 3.1), za], [xb, F.y + 0.04 * Math.sin(b * 3.1), zb2], [xb, F.y + F.h, zb2], [xa, F.y + F.h, za], [0, 0, 1], [0.95, 0.95, 0.95, 1], [u0, uv[3], u1, uv[3], u1, uv[1], u0, uv[1]]); } }
      const bannerAt = (x, z, n, k, y) => { const uv = guv(k), w = 1.25, h = 2.5, tx = n[2] ? -n[2] : n[0], tz = n[2] ? 0 : -n[0]; void tz;
        const p = (s, yy) => (n[2] ? [x + s * w / 2 * (n[2] > 0 ? -1 : 1), yy, z + n[2] * 0.06] : [x + n[0] * 0.06, yy, z + s * w / 2 * (n[0] > 0 ? 1 : -1)]); void tx;
        atl.quad(p(-1, y), p(1, y), p(1, y + h), p(-1, y + h), n, [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]); };
      [0.5, 2.1, 3.7].forEach((x, i) => bannerAt(x, GYM.z0, [0, 0, 1], ['banner', 'banner2', 'banner3'][i], 5.2));
      [10, 11.6, 13.2, 14.8].forEach((x, i) => bannerAt(x, GYM.z0, [0, 0, 1], ['banner3', 'banner', 'banner2', 'banner'][i], 5.6));
      for (let i = 0; i < 6; i++) bannerAt(GYM.x1, -7 + i * 2.4, [-1, 0, 0], ['banner', 'banner2', 'banner3'][i % 3], 5.4);
      for (let i = 0; i < 6; i++) bannerAt(GYM.x0, -7 + i * 2.4, [1, 0, 0], ['banner2', 'banner3', 'banner'][i % 3], 5.4);
      for (const x of [-9, 9]) { flat.wbox(x - 1, 5.0, GYM.z0, x + 1, 5.12, GYM.z0 + 1.0, STEELW); glass.quad([x - 1, 5.13, GYM.z0 + 0.06], [x + 1, 5.13, GYM.z0 + 0.06], [x + 1, 5.13, GYM.z0 + 1.0], [x - 1, 5.13, GYM.z0 + 1.0], [0, 0, 0], [0.75, 0.85, 0.9, 0.35]); steel.tube([x, 5.1, GYM.z0 + 0.5], [x, GYM.truss, GYM.z0 + 0.5], 0.04, GREY, 6); }
      // ---- the hoops: masts from the trusses, white-framed glass, the bottom pad; ring and net are drawn per frame (80-render) ----
      for (const h of HOOP) {
        const d = h.dir, bx = h.bx, by0 = BOARD_Y0, by1 = BOARD_Y0 + BOARD_H, bw = BOARD_W / 2;
        const xb = bx + d * 0.25;
        for (const s of [-1, 1]) { steel.tube([xb, by1, s * 0.45], [xb + d * 0.2, GYM.truss, s * 0.7], 0.05, STEELW, 8); steel.tube([xb, by1 - 0.2, s * 0.45], [bx + d * 3.2, GYM.truss, s * 0.9], 0.035, STEELW, 6); }
        steel.wbox(Math.min(bx, xb) - 0.02, by0 + 0.1, -0.5, Math.max(bx, xb) + 0.02, by1 - 0.05, 0.5, STEELW); // back frame
        const fr = 0.035, fx = bx + d * 0.012;
        steel.wbox(fx - 0.02, by1 - fr, -bw, fx + 0.02, by1, bw, STEELW); steel.wbox(fx - 0.02, by0, -bw, fx + 0.02, by0 + fr, bw, STEELW);
        steel.wbox(fx - 0.02, by0, -bw, fx + 0.02, by1, -bw + fr, STEELW); steel.wbox(fx - 0.02, by0, bw - fr, fx + 0.02, by1, bw, STEELW);
        glass.quad([bx, by0, -bw], [bx, by0, bw], [bx, by1, bw], [bx, by1, -bw], [0, 0, 0], [0.78, 0.88, 0.92, 0.22]);
        // painted border and shooter's square on the glass (opaque white, just off the face)
        const gx = bx - d * 0.006, ww = 0.02, sq0 = RIM_Y + 0.02, sq1 = sq0 + 0.5, sqw = 0.333;
        const wl = (y0, y1, z0, z1) => flat.quad([gx, y0, z0], [gx, y0, z1], [gx, y1, z1], [gx, y1, z0], [-d, 0, 0], hx3('#f4f4f2'));
        wl(by0 + 0.05, by0 + 0.05 + ww, -bw + 0.05, bw - 0.05); wl(by1 - 0.05 - ww, by1 - 0.05, -bw + 0.05, bw - 0.05); wl(by0 + 0.05, by1 - 0.05, -bw + 0.05, -bw + 0.05 + ww); wl(by0 + 0.05, by1 - 0.05, bw - 0.05 - ww, bw - 0.05);
        wl(sq0, sq0 + ww, -sqw, sqw); wl(sq1 - ww, sq1, -sqw, sqw); wl(sq0, sq1, -sqw, -sqw + ww); wl(sq0, sq1, sqw - ww, sqw);
        // the bottom pad with WILDCATS
        cush.wbox(bx - d * 0.07, by0 - 0.12, -bw - 0.04, bx + d * 0.07, by0 + 0.01, bw + 0.04, hx3('#a80f1c'));
        { const uv = guv('hoopPad'), px = bx - d * 0.071; atl.quad([px, by0 - 0.11, d * bw], [px, by0 - 0.11, -d * bw], [px, by0, -d * bw], [px, by0, d * bw], [-d, 0, 0], [1, 1, 1, 1], [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]]); }
        // rim bracket from the board
        steel.wbox(Math.min(bx, h.x + d * RIM_C) - 0.005, RIM_Y - 0.1, -0.06, Math.max(bx, h.x + d * RIM_C) + 0.005, RIM_Y - 0.02, 0.06, hx3('#e2571e'));
      }
      // ---- the bleachers (+z): ten rows of red backless seats, two banks, an aisle in the middle of each bank, the folded divider ----
      const BL = GYM.bl, CR = [];
      const crowdPal = [hx3('#b3121f'), hx3('#b3121f'), hx3('#f2f2ee'), hx3('#2a2d36'), hx3('#5a6170'), hx3('#7c2a2a'), hx3('#1f3b6b'), hx3('#c9b28a'), hx3('#3d6b4a'), hx3('#e4e4e0'), DEFC.jer];
      const fan = (x, y, z, fx, fz, amp, kk) => { // one sprite quad per spectator facing (fx, fz)
        const rx = -fz, rz = fx, k = (r() * 16) | 0, w = 0.32, hh = 1.28, ph = r() * 6.28, thr = 0.3 + r() * 0.7;
        const c0 = crowdPal[kk != null ? kk : (r() * crowdPal.length) | 0], c = shade(c0, 0.75 + r() * 0.4), u0 = k / 48, u1 = (k + 1) / 48;
        const a = [x - rx * w, y + hh, z - rz * w], b = [x + rx * w, y + hh, z + rz * w], c2 = [x + rx * w, y, z + rz * w], d = [x - rx * w, y, z - rz * w];
        for (const [v, u, t] of [[a, u0, 0], [b, u1, 0], [c2, u1, 1], [a, u0, 0], [c2, u1, 1], [d, u0, 1]]) CR.push(v[0], v[1], v[2], c[0], c[1], c[2], ph, amp, thr, 0, u, t);
      };
      const deck = hx3('#a99a83'), riser = hx3('#3b3d42');
      for (const [xa, xb] of BL.banks) {
        const ax = (xa + xb) / 2;
        for (let row = 0; row < BL.rows; row++) {
          const y = row * BL.rise, z = BL.z + row * BL.tread, y1 = y + BL.rise;
          flat.wbox(xa, y, z, xb, y1, z + BL.tread, deck);                        // tread block (top = this row's foot deck)
          flat.quad([xa, y1, z + BL.tread], [xb, y1, z + BL.tread], [xb, y1 + BL.rise, z + BL.tread], [xa, y1 + BL.rise, z + BL.tread], [0, 0, -1], riser); // next riser
          // seat planks (red, backless) on the back half of the tread, broken at the aisle
          const sy = y1 + 0.42 * 0 + 0.44, sz0 = z + BL.tread * 0.45, sz1 = z + BL.tread * 0.92;
          for (const [s0, s1] of [[xa + 0.1, ax - BL.aisleW / 2], [ax + BL.aisleW / 2, xb - 0.1]]) {
            seat.wbox(s0, sy - 0.05, sz0, s1, sy, sz1, REDC);
            for (let x = s0 + 0.5; x < s1; x += 0.5) seat.wbox(x - 0.006, sy - 0.051, sz0 - 0.002, x + 0.006, sy + 0.002, sz1 + 0.002, REDD);
            for (let x = s0 + 0.3; x < s1; x += 1.4) flat.wbox(x - 0.04, y1, sz0 + 0.08, x + 0.04, sy - 0.05, sz1 - 0.08, DGREY);
            // spectators: front rows fuller, the home student section in red and white
            for (let x = s0 + 0.28; x < s1 - 0.2; x += 0.5) { if (r() > 0.62 - row * 0.03) continue; fan(x + (r() - 0.5) * 0.1, sy - 0.32, (sz0 + sz1) / 2, 0, -1, 0.05 + r() * 0.07, xa < 0 ? (r() < 0.7 ? (r() < 0.6 ? 0 : 2) : null) : (r() < 0.45 ? 10 : null)); }
          }
          // the aisle: a half step and yellow nosing
          flat.wbox(ax - BL.aisleW / 2, y1, z, ax + BL.aisleW / 2, y1 + BL.rise / 2, z + BL.tread / 2, deck);
          flat.wbox(ax - BL.aisleW / 2, y1 - 0.01, z - 0.02, ax + BL.aisleW / 2, y1 + 0.005, z + 0.04, hx3('#e8c21f'));
        }
        // the aisle handrail
        const yT = BL.rows * BL.rise, zT = BL.z + BL.rows * BL.tread;
        steel.tube([ax, 1.1, BL.z + 0.3], [ax, yT + 1.1, zT - 0.3], 0.024, hx3('#9aa0a4'), 6);
        for (let k = 0; k <= 4; k++) { const t = k / 4, zz = BL.z + 0.3 + t * (zT - BL.z - 0.6), yy = t * yT; steel.tube([ax, yy + 0.1, zz], [ax, yy + 1.1, zz], 0.02, hx3('#9aa0a4'), 5); }
        // end panels and the back rail
        for (const xe of [xa, xb]) flat.quad([xe, 0, BL.z], [xe, 0, zT], [xe, yT + 0.3, zT], [xe, BL.rise, BL.z], [xe < ax ? -1 : 1, 0, 0], riser);
        for (const yy of [0.5, 1.1]) steel.tube([xa, yT + yy, zT - 0.08], [xb, yT + yy, zT - 0.08], 0.022, hx3('#9aa0a4'), 6);
        flat.wbox(xa, 0, BL.z - 0.03, xb, 0.1, BL.z, BLK); // kick plate
      }
      // the folded divider: a stack of accordion panels standing between the banks, floor to ceiling track
      { const dx = GYM.div.x, z0 = BL.z - 0.2, z1 = GYM.z1 - 0.05, n = 18, col = hx3('#cbbfa8');
        steel.wbox(-0.12, GYM.truss - 0.2, GYM.z0, 0.12, GYM.truss, GYM.z1, GREY);
        for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb2 = z0 + (z1 - z0) * (i + 1) / n, xo = i % 2 ? dx * 0.9 : -dx * 0.9, xo2 = i % 2 ? -dx * 0.9 : dx * 0.9;
          flat.quad([xo, 0.05, za], [xo2, 0.05, zb2], [xo2, GYM.truss - 0.2, zb2], [xo, GYM.truss - 0.2, za], [0.8 * Math.sign(xo2 - xo), 0, -0.6], shade(col, i % 2 ? 0.92 : 1.04)); }
        flat.wbox(-dx, 0, z0, dx, 0.06, z1, BLK); }
      // ---- the benches: folding chairs with white seat and back cushions on red frames, either side of the scorer's table ----
      const frame = REDC, white = hx3('#f2f2ee');
      const chair = (cx, cz) => { // faces -z (the court)
        const fl = -1; // front is toward -z
        for (const s of [-1, 1]) { steel.tube([cx + s * 0.21, 0, cz + fl * 0.2], [cx + s * 0.21, 0.48, cz + fl * 0.16], 0.012, frame, 5); steel.tube([cx + s * 0.2, 0, cz - fl * 0.24], [cx + s * 0.2, 0.92, cz - fl * 0.21], 0.012, frame, 5); }
        steel.tube([cx - 0.21, 0.05, cz + fl * 0.2], [cx + 0.21, 0.05, cz + fl * 0.2], 0.011, frame, 5); steel.tube([cx - 0.2, 0.47, cz - fl * 0.2], [cx + 0.2, 0.47, cz - fl * 0.2], 0.011, frame, 5);
        cush.wbox(cx - 0.21, 0.47, cz - 0.2, cx + 0.21, 0.54, cz + 0.2, white);
        cush.box(mRX(mT(IDM, cx, 0.78, cz - fl * 0.23), -0.14), 0, 0, 0, 0.42, 0.24, 0.05, white);
        flat.box(mRX(mT(IDM, cx, 0.78, cz - fl * 0.255), -0.14), 0, 0, 0, 0.44, 0.27, 0.01, frame);
      };
      const B = GYM.bench, chairs = [];
      for (const [xa, xb] of [B.home, B.away]) for (let i = 0; i < B.n; i++) { const x = xa + (xb - xa) * (i + 0.5) / B.n; chair(x, B.z); chairs.push({ x, z: B.z, home: xa < 0 }); }
      for (const xc of [B.home[0] - 0.8, B.away[1] + 0.8]) { flat.wbox(xc - 0.25, 0, B.z - 0.25, xc + 0.25, 0.6, B.z + 0.25, DGREY); flat.wbox(xc - 0.22, 0.6, B.z - 0.22, xc + 0.22, 1.05, B.z + 0.22, REDC); flat.wbox(xc - 0.24, 1.05, B.z - 0.24, xc + 0.24, 1.1, B.z + 0.24, white); }
      // ---- the scorer's table: a black cabinet with red padding and the HOME OF THE WILDCATS screen ----
      { const T = GYM.table, x0 = T.x - T.len / 2, x1 = T.x + T.len / 2, zf = T.z - T.dep / 2, zb2 = T.z + T.dep / 2, red = hx3('#a80f1c');
        flat.wbox(x0, 0.03, zf, x1, T.h - 0.06, zb2, hx3('#0d0e10'));
        cush.wbox(x0 - 0.05, T.h - 0.07, zf - 0.06, x1 + 0.05, T.h, zb2 + 0.04, red);              // padded top
        cush.tube([x0 - 0.04, T.h - 0.05, zf - 0.06], [x1 + 0.04, T.h - 0.05, zf - 0.06], 0.055, red, 10); // front roll
        cush.wbox(x0 - 0.05, 0, zf - 0.07, x1 + 0.05, 0.09, zf + 0.02, red);                       // kick rail
        for (const x of [x0, x1]) cush.wbox(x - 0.07, 0, zf - 0.08, x + 0.07, T.h - 0.05, zf + 0.08, red); // corner posts
        for (let x = x0 + 0.65; x < x1 - 0.3; x += 0.65) cush.wbox(x - 0.01, T.h - 0.072, zf - 0.065, x + 0.01, T.h + 0.002, zb2 + 0.041, hx3('#7e0b15'));
        tableB.quad([x0 + 0.1, 0.12, zf - 0.006], [x1 - 0.1, 0.12, zf - 0.006], [x1 - 0.1, T.h - 0.13, zf - 0.006], [x0 + 0.1, T.h - 0.13, zf - 0.006], [0, 0, 0], [1, 1, 1, 1], [0, 1, 1, 1, 1, 0, 0, 0]);
        // on the table: a laptop and the possession arrow box; two scorers behind it on chairs
        flat.wbox(-0.9, T.h, T.z - 0.1, -0.5, T.h + 0.02, T.z + 0.2, BLK); glow.quad([-0.9, T.h + 0.02, T.z + 0.2], [-0.5, T.h + 0.02, T.z + 0.2], [-0.5, T.h + 0.28, T.z + 0.26], [-0.9, T.h + 0.28, T.z + 0.26], [0, 0, 0], [0.35, 0.55, 0.9, 1]);
        flat.wbox(0.3, T.h, T.z - 0.05, 0.7, T.h + 0.12, T.z + 0.1, BLK);
        for (const x of [-1.6, 1.4]) { chair(x, T.z + 0.85); fan(x, 0.5, T.z + 0.6, 0, -1, 0.03, 3); }
      }
      // ---- a few kids sitting on the floor at the corners, an adult or two by the doors ----
      for (const [x, z] of [[-15.6, -9.6], [-15.2, -9.9], [15.4, -9.7], [15.8, 10.8], [-15.9, 10.6]]) fan(x, 0.0, z, -x / Math.hypot(x, z) * 0.3, -z / Math.hypot(x, z), 0.05, null);
      const W = { defs: [], crowd: { f: new Float32Array(CR.length ? CR : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), n: CR.length / 12 }, chairs, D };
      return W;
    }
    // upload the gym's batches as statics: [key, texture, material (rough, metal, detail, emissive), kind, casts]
    function gymStatics(W) {
      const D = W.D, q = quality;
      const tex = { floor: mkTex(gymFloorCanvas(q), false, false, 16), block: mkTex(gymBlockCanvas(), true, false, 8), atl: mkTex(gymAtlasCanvas(), false, false, 8) };
      G.texs.push(tex.floor, tex.block, tex.atl); G.floorTex = tex.floor;
      const spec = [
        ['floor', tex.floor, [0.3, 0, 0, 0], 0, false], ['block', tex.block, [0.85, 0, 0, 0], 0, true], ['flat', G.white, [0.62, 0, 0, 0], 0, true],
        ['seat', G.white, [0.42, 0, 0, 0], 0, true], ['steel', G.white, [0.42, 0.55, 0, 0], 0, true], ['cush', G.white, [0.5, 0, 0, 0], 0, true],
        ['atl', tex.atl, [0.75, 0, 0, 0], 0, false], ['glow', G.white, [0.5, 0, 0, 3.0], 0, false], ['board', G.board, [0.4, 0, 0, 1.8], 0, false],
        ['table', G.table, [0.4, 0, 0, 1.5], 0, false], ['glass', G.white, [0.08, 0, 0, 0], 0, false],
      ];
      for (const [k, t, mat, kind, cast] of spec) {
        const b = D[k]; if (!b || !b.n) continue;
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, b.f.subarray(0, b.n * 12), gl.STATIC_DRAW); G.bufs.push(buf);
        statics.push({ k, b: buf, n: b.n, tex: t, cast, kind, mat, blend: k === 'glass', c0: k === 'flat' || k === 'steel' });
      }
      // the floor at full size a moment later (the first frames use the quick one)
      if (q >= 1) setTimeout(() => { if (!G || glLost || finished) return; try { const c = gymFloorCanvas(2); gl.bindTexture(gl.TEXTURE_2D, tex.floor); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }, 1200);
    }
    // =====================================================================================
    // Game state: the clock, the score, the ten on the floor, the benches, the ball, the camera and the input.
    // Phases: splash, tip (jump ball), live, dead (whistle; then an inbound or free throws), inb (inbound), ft (free throws),
    // timeout (the sub screen), break (between quarters), over, box.
    // =====================================================================================
    let phase = 'splash', qtr = 1, clock = QS, shotClk = SHOT, hs = 0, as = 0, clockRun = false, tLive = 0, phaseT = 0;
    let everyone = [], onCourt = [], extras = [], parts = [], pile = [], wxp = [];
    let ball = null, ctrl = null, poss = 0, lastBig = null, excite = 0, crowdMood = 0;
    let deadT = 0, deadNext = null, inb = null, ftS = null, tipS = null, toS = null, brk = null, poss1 = 0;
    const teams = [
      { side: 0, T: HOME, sq: SQH, on: [], bench: [], fq: 0, to: TOS, bonus: false },
      { side: 1, T: AWAY, sq: SQA, on: [], bench: [], fq: 0, to: TOS, bonus: false },
    ];
    const cam = { e: [0, 6, 16], c: [0, 1, 0], fov: 1, shake: 0, kick: 0, sx: 0, sy: 0 };
    const input = { l: 0, r: 0, u: 0, d: 0, stick: null, sprint: false, shoot: false, shootT: 0 };
    const GRAV = BALL_G;
    const fmtClock = (c) => { c = Math.max(0, c); if (c < 10) return c.toFixed(1); c = Math.ceil(c); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
    // which basket a side attacks: home attacks +x in the first half, then the teams switch ends
    const dirOf = (side) => ((side === 0) === (qtr <= 2 || qtr > 4 && qtr % 2 === 1) ? 1 : -1);
    const hoopOf = (side) => HOOP[dirOf(side) > 0 ? 1 : 0]; // the basket this side shoots at
    const ownHoop = (side) => HOOP[dirOf(side) > 0 ? 0 : 1];
    const foes = (p) => teams[1 - p.side].on, mates = (p) => teams[p.side].on;
    const D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // body specs by basketball position (the engine's football keys as bases)
    const POSBODY = { PG: 'WR', SG: 'CB', SF: 'S', PF: 'TE', C: 'LB' };
    function mkP(q, side) {
      const role = POSBODY[q.pos] || 'WR', bb = q.bb;
      const p = { side, role, key: q.key, x: 0, z: 0, y: 0, vx: 0, vz: 0, h: side ? -Math.PI / 2 : Math.PI / 2, ph: crand() * 6, fall: 0, fallT: 0, down: false, getup: 0, rising: 0, stun: 0,
        w: 1, reach: null, pose: 'idle', poseT: 0, lk: Object.assign({}, q.look), num: q.num, face: -1, ncell: -1, fcell: -1, nmcell: -1, sq: q, bb,
        jumpY: 0, jumpV: 0, jumpT: 0, an: { clip: 'idle', t: 0, from: null, blendT: 0, blendDur: 0 }, bones: null, rag: null, look: null, lean: 0, leanF: 0, pvx: 0, pvz: 0,
        stumbleT: 0, plant: 0, sta: 1, sprint: false, rad: 0.36, carrySide: 1, mvCd: {}, fx: q.fx, star: 0, wgt: q.wgt,
        // basketball: the dribble hand (1 right, -1 left), the crossover chain, the man he guards, his AI's spot and timers
        dh: 1, cmb: 0, cmbT: 0, cmbHeat: 0, man: null, spot: null, aiT: 0, think: 0, holdT: 0, shotT: -1, act: null, actT: 0, contestT: 0, stealCd: 0, foulCd: 0, boxOut: false, tired: 0, mins: 0 };
      p.spd = starR(bb.spd); p.agi = starR((bb.spd + bb.hand) / 2); p.str = starR(bb.str);
      p.v = 4.6 + (p.spd - 50) * 0.028; p.acc = 8 + (p.spd - 50) * 0.05;
      const bd = bodySpec(BODY[role] || BODY.WR, p.lk, p.wgt);
      p.body = bd; p.lk = Object.assign({}, p.lk, { sw: bd.sw, ll: bd.ll || 1 });
      // true size: his listed height (a kid between about five and six feet), 66 in when none is listed
      p.lk.hs = (p.lk.hin || q.hgt || 66) / 36 / STAND_H;
      p.mass = p.wgt > 0 ? clamp(p.wgt / 140, 0.7, 1.6) : role === 'LB' || role === 'TE' ? 1.15 : 0.95;
      p.staK = 0.7 + clamp(bb.sta || 60, 25, 99) / 99 * 0.6;
      p.w = bd.bulk; p.dirt = 0; p.towel = false; p.mouth = false;
      dunkDress(p); // the basketball uniform: sleeveless jersey with his number, team shorts, socks and sneakers (21-casual.js)
      p.fcell = faceCell(p.lk.skin);
      p.ovr = bb.ovr || 0; p.star = p.ovr >= 99 ? 3 : p.ovr >= 95 ? 2 : p.ovr >= 90 ? 1 : 0;
      fxSetup(p);
      return p;
    }
    // ---------- the ball ----------
    // st: 'held' (a player has it, not dribbling: catch, triple threat, inbound), 'drib' (dribbling: the hand and the floor),
    // 'air' (a shot or a pass in flight), 'loose' (a rebound, a tip, a deflection: physics until someone grabs it), 'dead'
    function mkBall() { return { st: 'dead', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, holder: null, spin: [0, 0, 0], rot: IDM.slice(), u: 0, dribT: 0, shot: null, pass: null, last: null, lastSide: 0, touchRim: false, made: false, prevY: 1, quietT: 0 }; }
    function setupPlay() {
      everyone = []; onCourt = [];
      for (const t of teams) {
        t.on = []; t.bench = [];
        t.sq.forEach((q, i) => {
          const p = mkP(q, t.side);
          if (i < 5) { t.on.push(p); onCourt.push(p); } else t.bench.push(p);
          p.ncell = numCell(p.num); p.nmcell = nameCell(shortName(q.name)); if (q.cell >= 0) p.face = q.cell;
          everyone.push(p);
        });
      }
      // man-to-man by spot: each defender takes the man in his own position
      for (const t of teams) t.on.forEach((p, i) => { p.man = teams[1 - t.side].on[i]; });
      ball = mkBall();
      placeBench();
      placeTip();
    }
    // the sixth man (and anyone subbed out) sits on his team's bench chairs
    function placeBench() {
      for (const t of teams) {
        const B = t.side === 0 ? GYM.bench.home : GYM.bench.away, n = GYM.bench.n;
        t.bench.forEach((p, i) => { const k = t.side === 0 ? n - 2 - i : 1 + i, x = B[0] + (B[1] - B[0]) * (k + 0.5) / n; p.x = x; p.z = GYM.bench.z + 0.06; p.vx = p.vz = 0; p.h = Math.PI; p.jumpY = 0; p.benched = true; setPose(p, 'sit'); });
        t.on.forEach((p) => { p.benched = false; if (p.pose === 'sit') setPose(p, 'idle'); });
      }
    }
    // the jump ball: the two centres in the circle, everyone else around it
    function placeTip() {
      const spots = [[-0.55, 0], [-2.6, 2.9], [-2.6, -2.9], [-4.6, 0.6], [-1.8, -6.2]];
      for (const t of teams) {
        const d = dirOf(t.side); // a side's own half is behind it
        const order = [4, 0, 1, 2, 3]; // the centre jumps
        t.on.forEach((p, i) => { const s = spots[order.indexOf(i) >= 0 ? order.indexOf(i) : i]; p.x = s[0] * d; p.z = s[1] * (t.side ? -1 : 1); p.vx = p.vz = 0; p.h = d > 0 ? Math.PI / 2 : -Math.PI / 2; p.jumpY = 0; p.jumpV = 0; setPose(p, 'idle'); });
      }
      Object.assign(ball, { st: 'dead', holder: null, x: 0, y: 1.2, z: 0, vx: 0, vy: 0, vz: 0, shot: null, pass: null });
    }
    // =====================================================================================
    // Metcalf clothes: a lunch-time game has no helmets, pads or uniforms. Everyone wears a plain T-shirt in his team's main colour
    // (the kit's jersey colour, so the stadium rule that swaps the away side into its second colour when the two main colours are
    // close keeps the teams apart) and his own bottoms: grey, black, navy or team-colour sweats, joggers, gym shorts, khaki or
    // basketball shorts, crew or ankle socks, sneakers, and his own hair (buzz, short, fade, curly, longer; a few backwards caps and
    // beanies). Every pick comes from a hash of the player (card id, else name, else his spot), never from a random stream, so a
    // player looks the same all game and the game's own randomness is untouched. Only the look changes: skeleton, animation,
    // hit boxes and hands are the player's as before.
    // =====================================================================================
    const casHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const casRnd = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const casPick = (r, opts) => { let s = 0; for (const o of opts) s += o[1]; let u = r() * s; for (const o of opts) { u -= o[1]; if (u <= 0) return o[0]; } return opts[opts.length - 1][0]; };
    const CASP = {
      black: hex('#17181b'), charcoal: hex('#3d4045'), grey: hex('#85888e'), heather: hex('#a7a9ae'), navy: hex('#1d2640'), khaki: hex('#b19a72'),
      olive: hex('#5a5d3c'), denim: hex('#4a6185'), red: hex('#b0252d'), royal: hex('#2b4ea6'), white: hex('#e9e9e6'), tan: hex('#c7b38c'), gum: hex('#b07c49'),
      // natural hair colours
      hBlack: hex('#151110'), hDark: hex('#2c1d14'), hBrown: hex('#4f3220'), hLight: hex('#7a5535'), hBlond: hex('#b8935a'), hAuburn: hex('#6e321b'),
    };
    // a player's identity for his look: the card, else the roster name, else the spot on the field for the team
    function casId(p) { const q = p.sq; if (q && q.pid != null) return 'p' + q.pid; if (q && q.name) return 'n' + q.name + ':' + (q.num != null ? q.num : ''); return 's' + p.side + ':' + p.key + ':' + (p.side ? AWAY.name : HOME.name); }
    // the basketball uniform: the casual body (no pads, no helmet) with the hoop jersey and shorts; his own hair and shoes from a
    // hash of the player (never from the game's random streams), white or black crew socks
    function dunkDress(p) {
      if (p.side === 2) return;
      const r = casRnd(casHash(casId(p))), C = CASP;
      const sk = p.lk.skin, dark = sk >= 3;
      const hair = casPick(r, dark ? [[0, 4], [2, 4], [3, 3], [1, 2]] : [[0, 2], [1, 5], [2, 2], [3, 1.5], [4, 2]]);
      const hc = casPick(r, dark ? [[C.hBlack, 6], [C.hDark, 3]] : sk === 2 ? [[C.hBlack, 4], [C.hDark, 4], [C.hBrown, 2]] : [[C.hBlack, 1], [C.hDark, 2.5], [C.hBrown, 3], [C.hLight, 2.5], [C.hBlond, 1.5]]);
      const sc = casPick(r, [[C.white, 7], [C.black, 2]]);
      const shc = casPick(r, [[C.white, 4], [C.black, 4], [C.red, 1.2], [C.royal, 0.8], [C.grey, 1]]);
      const slc = shc === C.black ? casPick(r, [[C.black, 1], [C.white, 2]]) : C.white;
      const g = { hair, bot: 4, sock: 0, hoop: 1 };
      p.cas = { g, hc, bc: null, sc, shc, slc, cc: null, top: 0.028 + (0.284 + [0.0045, 0.012, 0.03, 0.03, 0.016, 0.024, 0.032][hair]) };
      p.lk.visor = false; p.towel = false; p.mouth = false;
      p.body = casSpec(p.body, g);
    }
    // colours for a dressed player (the slot table in 06-body.js; C = his side's kit, so team-colour picks follow the kit swaps)
    function casCols(cols, p, C, skin) {
      const k = p.cas;
      cols[5] = k.shc; cols[14] = k.slc; cols[17] = k.sc; cols[19] = k.cc || C.jer; cols[23] = k.hc; cols[24] = k.bc || C.pant || C.jer;
      cols[10] = skin; cols[12] = skin;
      return cols;
    }
    // new casual meshes cost a few milliseconds each to build, so a frame builds at most a couple and the rest wear a ready-made
    // casual mesh for that frame (only matters on the first frames and when a new unit, e.g. the throw-off team, runs on)
    let casFrame = -1, casBuilt = 0;
    const CAS_BASE = { hair: 1, bot: 4, sock: 0, hoop: 1 };
    function meshForP(p) {
      const s = p.body || BODY.WR;
      if (!s.cas || G.meshes[bodyKey(s)]) return meshFor(s);
      if (casFrame !== perf.n) { casFrame = perf.n; casBuilt = 0; }
      if (casBuilt >= 2) return meshFor(casSpec(BODY[p.role] && !BODY[p.role].noGear ? BODY[p.role] : BODY.WR, CAS_BASE));
      casBuilt++;
      return meshFor(s);
    }
    function casPrebuild() { for (const k of ['WR', 'CB', 'S', 'TE', 'LB']) meshFor(casSpec(BODY[k], CAS_BASE)); }
    // =====================================================================================
    // Real heads (Metcalf): every league player with a scanned head (public/arcade/heads, built offline by tools/heads.js from his
    // site photo) wears his own head instead of the drawn one. The index loads when the game starts; a player's head (mesh + texture)
    // loads the first time he is drawn, and until it is ready, or if it fails, he keeps the drawn head. The head is skinned to the
    // head bone like the rest of the body (bind-pose body space, weight 1), so it follows every animation, ragdoll and the bobblehead
    // card; the drawn head, face, ears and hair are dropped in the shader (uHead). One draw per head, with the shared athlete shader
    // (light, shadows, fog, card effects); the full 8,000-triangle mesh up close, a 1,500-triangle one further out and in the shadow
    // map, and the drawn head again past RH_FAR. In 3D Dunk this is always on.
    // =====================================================================================
    const RH_BASE = '/static/arcade/heads/', RH_NEAR = 9, RH_FAR = 40; // yards from the camera: full mesh within RH_NEAR, drawn head past RH_FAR
    const RH = { idx: null, by: {}, heads: {}, on: !(DBG && DBG.noHeads) }; // basketball: no helmets, so every scanned player wears his own head
    const rhKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
    if (RH.on) {
      try {
        fetch(RH_BASE + 'index.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
          if (!j || !j.heads) return;
          RH.idx = j; for (const n in j.heads) RH.by[rhKey(n)] = j.heads[n];
        }).catch(() => {});
      } catch (e) {}
    }
    // a head's GL objects (rebuilt after a lost context: they belong to the G they were made for)
    function rhGL(h) {
      if (h.g === G) return true;
      if (!h.vd || !h.img || glLost) return false;
      try {
        h.vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, h.vb); gl.bufferData(gl.ARRAY_BUFFER, h.vd, gl.STATIC_DRAW);
        h.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, h.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, h.id, gl.STATIC_DRAW);
        h.tex = mkTex(h.img, false, false, 4); h.g = G;
        return true;
      } catch (e) { h.failed = true; return false; }
    }
    // unpack a head (.bin, see tools/heads.js) into the athlete vertex layout: pos3 nrm3 bone2 weight slot uv2 ao
    function rhUnpack(h, ab, NK) {
      const dv = new DataView(ab);
      if (dv.getUint32(0, true) !== 0x3144484d) throw new Error('bad head file'); // 'MHD1'
      const nv = dv.getUint32(4, true), n0 = dv.getUint32(8, true), n1 = dv.getUint32(12, true), q = dv.getFloat32(16, true);
      const p4 = (n) => (n + 3) & ~3, oP = 20, oN = oP + p4(nv * 6), oT = oN + nv * 4, oI = oT + nv * 4;
      const P = new Int16Array(ab, oP, nv * 3), N = new Int8Array(ab, oN, nv * 4), T = new Uint16Array(ab, oT, nv * 2), a = h.e.anchor || [0, 0.831, 0];
      const V = new Float32Array(nv * VSTRIDE);
      for (let i = 0; i < nv; i++) {
        const o = i * VSTRIDE;
        V[o] = a[0] + P[i * 3] * q; V[o + 1] = a[1] + P[i * 3 + 1] * q; V[o + 2] = a[2] + P[i * 3 + 2] * q;
        V[o + 3] = N[i * 4] / 127; V[o + 4] = N[i * 4 + 1] / 127; V[o + 5] = N[i * 4 + 2] / 127;
        V[o + 6] = B.head; V[o + 7] = B.neck; V[o + 8] = 1; V[o + 9] = 25; V[o + 10] = T[i * 2] / 65535; V[o + 11] = T[i * 2 + 1] / 65535; V[o + 12] = 1;
      }
      headNeck(V, nv, h.e, NK || 1); // weighted like the body's neck, fitted to his (06-body.js)
      h.vd = V; h.id = new Uint16Array(ab.slice(oI, oI + (n0 + n1) * 2)); h.n0 = n0; h.n1 = n1;
    }
    function rhLoad(e, NK) {
      const h = RH.heads[e.slug] = { e, g: null, failed: false };
      const fail = () => { h.failed = true; };
      try {
        fetch(RH_BASE + e.slug + '.bin').then((r) => { if (!r.ok) throw new Error('head ' + r.status); return r.arrayBuffer(); }).then((ab) => rhUnpack(h, ab, NK)).catch(fail);
        const im = new Image(); im.onload = () => { h.img = im; }; im.onerror = fail; im.src = RH_BASE + e.slug + '.jpg';
      } catch (err) { fail(); }
      return h;
    }
    // the ready head for a player (null while loading, for generated players, or when there is none)
    function rhFor(p) {
      if (!RH.idx || p.side === 2) return null;
      if (p.rhE === undefined) {
        const q = p.sq, e = q && q.pid != null && q.name ? RH.by[rhKey(q.name)] : null;
        p.rhE = e || null;
      }
      const e = p.rhE; if (!e) return null;
      if (p.cas) p.cas.top = e.anchor[1] + e.top - 0.772; // the top of his hair over the head bone (props above the head)
      const h = RH.heads[e.slug] || rhLoad(e, (p.body || BODY.WR).neck);
      if (h.failed || !rhGL(h)) return null;
      return h;
    }
    // which head mesh a player wears this frame: 0 the full mesh, 1 the light one, -1 the drawn head
    function rhLevel(p, d, depthOnly) {
      if (!RH.on || !p.cas) return -1;
      const h = rhFor(p); if (!h) return -1;
      p.rhH = h;
      if (depthOnly) return 1;
      return d > RH_FAR ? -1 : d < (quality === 0 ? 0 : RH_NEAR) ? 0 : 1;
    }
    // draw a player's head with the athlete program whose bones and colours are already set for him
    function rhDraw(P, h, lvl) {
      bindMesh(P, h);
      if (P.u.uKit) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, h.tex); }
      if (lvl === 0) { gl.drawElements(gl.TRIANGLES, h.n0, gl.UNSIGNED_SHORT, 0); DRAWS.tris += h.n0 / 3; }
      else { gl.drawElements(gl.TRIANGLES, h.n1, gl.UNSIGNED_SHORT, h.n0 * 2); DRAWS.tris += h.n1 / 3; }
      DRAWS.n++;
    }
    // =====================================================================================
    // Animation runtime (basketball): gameplay sets a semantic pose (setPose); this picks the clip, builds the pose (the procedural
    // gait for every move on the floor, keyframes for the jumps), blends clip changes in matrix space, locks planted feet and puts
    // the hands on the ball with arm IK. The gameplay ball is authoritative: the hands follow it, never the other way round.
    // =====================================================================================
    const ONE_SHOT = { cross: 0.3, btl: 0.36, btb: 0.4, spin: 0.5, hesi: 0.36, pass: 0.34, catch: 0.24, shoot: 1.15, ftshot: 1.15, layup: 0.95, dunk: 1.3, block: 0.95, contest: 0.85, steal: 0.42, rebound: 0.95, fumble: 0.55, tip: 1.0, celebrate: 1.8, getup: 0.9 };
    const BLEND = { idle: 0.2, ready: 0.18, triple: 0.15, dstance: 0.16, run: 0.12, cross: 0.06, btl: 0.06, btb: 0.06, spin: 0.07, hesi: 0.06, pass: 0.06, catch: 0.06, shoot: 0.08, ftshot: 0.1, layup: 0.07, dunk: 0.07, block: 0.06, contest: 0.06, steal: 0.05, rebound: 0.06, fumble: 0.07, tip: 0.08, celebrate: 0.15, sit: 0.3, inbound: 0.2, rag: 0.1, getup: 0.3, hk: 0.4 };
    const DIRT = {};
    function setPose(p, pose, keep) {
      if (p.pose === pose && keep) return;
      p.pose = pose; p.poseT = 0;
    }
    // ---------- clips (keys in seconds; the airborne ones keep their own root height: the jump is p.jumpY) ----------
    const SHOT_REL = 0.62; // the jump shot's release key (the meter's release maps here)
    const SHOT_K = [
      [0, gfit(pb({ hipL: [0.75, 0, -0.08], hipR: [0.7, 0, 0.1], knL: [-1.1], knR: [-1.05], ftL: [0.25], ftR: [0.25], shR: [1.1, 0, 0.25], elR: [2.0], haR: [-0.3], shL: [1.05, 0, -0.3], elL: [1.9], spine: [0.32, 0, 0], neck: [-0.35, 0, 0] }, -0.3, 0.1, 0))],
      [0.24, pb({ hipL: [0.25, 0, -0.06], hipR: [0.2, 0, 0.08], knL: [-0.35], knR: [-0.3], ftL: [0.45], ftR: [0.45], shR: [2.2, 0, 0.3], elR: [1.95], haR: [-0.6], shL: [2.0, 0, -0.45], elL: [1.6], spine: [0.05, 0, 0], neck: [-0.4, 0, 0] }, -0.06, 0.02, 0)],
      [0.48, pb({ hipL: [0.32, 0, -0.06], hipR: [0.26, 0, 0.08], knL: [-0.42], knR: [-0.38], ftL: [0.5], ftR: [0.5], shR: [2.55, 0, 0.22], elR: [1.55], haR: [-0.85], shL: [2.3, 0, -0.5], elL: [1.25], spine: [0.0, 0, 0], neck: [-0.45, 0, 0] }, -0.04, 0.0, 0)],
      [SHOT_REL, pb({ hipL: [0.3, 0, -0.06], hipR: [0.24, 0, 0.08], knL: [-0.38], knR: [-0.34], ftL: [0.5], ftR: [0.5], shR: [2.95, 0, 0.12], elR: [0.15], haR: [0.95], shL: [2.4, 0, -0.35], elL: [0.55], spine: [-0.02, 0, 0], neck: [-0.5, 0, 0] }, -0.04, -0.02, 0)],
      [0.86, pb({ hipL: [0.35, 0, -0.07], hipR: [0.3, 0, 0.08], knL: [-0.45], knR: [-0.4], ftL: [0.4], ftR: [0.4], shR: [2.9, 0, 0.12], elR: [0.2], haR: [1.2], shL: [2.0, 0, -0.4], elL: [0.7], spine: [0.0, 0, 0], neck: [-0.45, 0, 0] }, -0.05, 0.0, 0)],
      [1.15, gfit(pb({ hipL: [0.5, 0, -0.1], hipR: [0.45, 0, 0.12], knL: [-0.75], knR: [-0.7], shR: [1.5, 0, 0.3], elR: [0.6], haR: [0.6], shL: [0.8, 0, -0.4], elL: [0.9], spine: [0.2, 0, 0], neck: [-0.3, 0, 0] }, -0.15, 0.06, 0))],
    ];
    const LAYUP_K = [
      [0, gfit(pb({ hipL: [0.9, 0, -0.06], knL: [-1.1], hipR: [-0.2, 0, 0.1], knR: [-0.5], ftR: [0.4], shR: [1.3, 0, 0.3], elR: [1.7], shL: [1.2, 0, -0.3], elL: [1.7], spine: [0.35, 0, 0], neck: [-0.3, 0, 0] }, -0.2, 0.15, 0))],
      [0.22, pb({ hipL: [1.55, 0, -0.06], knL: [-1.7], ftL: [0.3], hipR: [0.05, 0, 0.08], knR: [-0.2], ftR: [0.6], shR: [2.3, 0, 0.2], elR: [1.3], haR: [-0.4], shL: [1.9, 0, -0.35], elL: [1.2], spine: [0.08, 0, 0], neck: [-0.45, 0, 0] }, 0, -0.02, 0)],
      [0.45, pb({ hipL: [1.35, 0, -0.06], knL: [-1.6], ftL: [0.3], hipR: [0.15, 0, 0.08], knR: [-0.35], ftR: [0.6], shR: [2.95, 0, 0.12], elR: [0.25], haR: [0.5], shL: [1.6, 0, -0.5], elL: [0.9], spine: [-0.05, 0, 0], neck: [-0.6, 0, 0] }, 0, -0.04, 0)],
      [0.65, pb({ hipL: [0.7, 0, -0.06], knL: [-1.0], hipR: [0.3, 0, 0.08], knR: [-0.6], shR: [2.7, 0, 0.12], elR: [0.3], haR: [0.9], shL: [1.2, 0, -0.5], elL: [0.9], spine: [0.0, 0, 0], neck: [-0.5, 0, 0] }, 0, 0.0, 0)],
      [0.95, gfit(pb({ hipL: [0.6, 0, -0.1], hipR: [0.55, 0, 0.12], knL: [-0.85], knR: [-0.8], shR: [1.0, 0, 0.3], elR: [0.7], shL: [0.7, 0, -0.4], elL: [0.9], spine: [0.3, 0, 0], neck: [-0.3, 0, 0] }, -0.2, 0.1, 0))],
    ];
    const DUNK_K = [
      [0, gfit(pb({ hipL: [0.95, 0, -0.08], hipR: [0.9, 0, 0.1], knL: [-1.35], knR: [-1.3], ftL: [0.3], ftR: [0.3], shR: [0.9, 0, 0.3], elR: [1.6], shL: [0.9, 0, -0.3], elL: [1.6], spine: [0.5, 0, 0], neck: [-0.4, 0, 0] }, -0.4, 0.2, 0))],
      [0.2, pb({ hipL: [1.2, 0, -0.08], knL: [-1.4], hipR: [0.1, 0, 0.1], knR: [-0.3], ftR: [0.6], ftL: [0.4], shR: [2.7, 0, 0.25], elR: [0.8], shL: [2.6, 0, -0.25], elL: [0.8], spine: [0.0, 0, 0], neck: [-0.5, 0, 0] }, 0, -0.05, 0)],
      [0.42, pb({ hipL: [0.8, 0, -0.08], knL: [-1.5], hipR: [0.4, 0, 0.1], knR: [-1.2], ftR: [0.5], ftL: [0.5], shR: [3.35, 0, 0.3], elR: [1.4], haR: [-0.4], shL: [3.0, 0, -0.3], elL: [1.2], spine: [-0.25, 0, 0], neck: [-0.55, 0, 0] }, 0, -0.18, 0)],
      [0.56, pb({ hipL: [0.9, 0, -0.08], knL: [-1.3], hipR: [0.7, 0, 0.1], knR: [-1.1], ftR: [0.5], ftL: [0.5], shR: [2.25, 0, 0.2], elR: [0.15], haR: [0.8], shL: [2.2, 0, -0.2], elL: [0.2], spine: [0.35, 0, 0], neck: [-0.3, 0, 0] }, 0, 0.25, 0)],
      [0.92, pb({ hipL: [0.6, 0, -0.1], knL: [-1.3], hipR: [0.5, 0, 0.12], knR: [-1.4], ftR: [0.4], ftL: [0.4], shR: [2.9, 0, 0.15], elR: [0.2], shL: [2.9, 0, -0.15], elL: [0.2], spine: [0.1, 0, 0], neck: [-0.35, 0, 0] }, 0, 0.05, 0)],
      [1.3, gfit(pb({ hipL: [0.75, 0, -0.1], hipR: [0.7, 0, 0.12], knL: [-1.1], knR: [-1.05], shR: [1.2, 0, 0.6], elR: [0.7], shL: [1.2, 0, -0.6], elL: [0.7], spine: [0.3, 0, 0], neck: [-0.25, 0, 0] }, -0.3, 0.12, 0))],
    ];
    const PASS_K = [
      [0, pb({ shR: [1.0, 0, 0.35], elR: [2.0], haR: [-0.4], shL: [1.0, 0, -0.35], elL: [2.0], haL: [-0.4], spine: [0.12, 0, 0] })],
      [0.12, pb({ shR: [1.55, 0, 0.12], elR: [0.25], haR: [0.7], shL: [1.55, 0, -0.12], elL: [0.25], haL: [0.7], spine: [0.22, 0, 0] })],
      [0.34, pb({ shR: [0.5, 0, 0.25], elR: [0.9], shL: [0.5, 0, -0.25], elL: [0.9], spine: [0.12, 0, 0] })],
    ];
    const CATCH_K = [[0, pb({ shR: [1.55, 0, 0.2], elR: [0.4], shL: [1.55, 0, -0.2], elL: [0.4], spine: [0.1, 0, 0] })], [0.24, pb({ shR: [0.9, 0, 0.35], elR: [1.8], shL: [0.9, 0, -0.35], elL: [1.8], spine: [0.15, 0, 0] })]];
    const STEAL_K = [
      [0, pb({ shR: [0.8, 0, 0.4], elR: [1.0], shL: [0.6, 0, -0.5], elL: [1.2], spine: [0.2, 0, 0] })],
      [0.16, pb({ shR: [1.25, 0, 0.35], elR: [0.15], haR: [0.2], shL: [0.4, 0, -0.9], elL: [0.8], spine: [0.55, -0.2, 0], neck: [-0.3, 0.2, 0] })],
      [0.28, pb({ shR: [1.05, 0, -0.55], elR: [0.2], shL: [0.4, 0, -0.9], elL: [0.8], spine: [0.5, 0.25, 0], neck: [-0.3, -0.2, 0] })],
      [0.42, pb({ shR: [0.6, 0, 0.3], elR: [1.0], shL: [0.5, 0, -0.5], elL: [1.1], spine: [0.25, 0, 0] })],
    ];
    const POSE_INB = pb({ shR: [2.6, 0, 0.25], elR: [1.1], shL: [2.6, 0, -0.25], elL: [1.1], spine: [-0.05, 0, 0], neck: [-0.2, 0, 0] });
    // ---------- clip choice ----------
    // the floor clips: legs from the procedural gait (feet planted at ground speed, foot locking on), the upper body overlaid
    const FLOOR = { idle: 1, ready: 1, triple: 1, dstance: 1, run: 1, cross: 1, btl: 1, btb: 1, spin: 1, hesi: 1, pass: 1, catch: 1, steal: 1, fumble: 1, inbound: 1, hk: 1 };
    function pickClip(p) {
      if (p.rag) return 'rag';
      if (p.pose === 'sit') return 'sit';
      if (DBG && DBG.forcePose) return DBG.forcePose;
      if (p.rising > 0) return 'getup';
      const one = ONE_SHOT[p.pose];
      if (one && (p.poseT < one || ((p.pose === 'shoot' || p.pose === 'ftshot') && p.shotA < SHOT_REL))) return p.pose;
      if (p.pose === 'celebrate' || p.pose === 'inbound') return p.pose;
      const sp = Math.hypot(p.vx, p.vz), holder = ball && ball.holder === p;
      if (sp > 0.8 && !p.dstance) return 'run';
      if (holder) return 'triple';
      if (p.dstance) return 'dstance';
      if ((phase === 'dead' || phase === 'ft' || phase === 'timeout' || phase === 'break') && p.an.idleT > 1.5 && (p.sta < 0.5 || p.num % 3 === 1)) return 'hk';
      if (phase === 'live' || phase === 'inb' || phase === 'tip') return 'ready';
      return 'idle';
    }
    function animUpdate(p, dt) {
      const an = p.an, hs = p.lk.hs;
      p.poseT += dt;
      if (p.shotA != null && (p.pose === 'shoot' || p.pose === 'ftshot') && p.shotRel) p.shotA += dt;
      if (!p.rag) locoIn(p, dt);
      const clip = pickClip(p);
      if (clip !== an.clip) { an.from = p.bones; an.blendDur = an.blendT = BLEND[clip] || 0.12; an.clip = clip; an.t = 0; }
      an.t += dt;
      let bones;
      if (clip === 'rag' && p.rag) bones = p.rag.bones();
      else {
        const one = ONE_SHOT[clip], tt = one ? clamp(p.poseT / one, 0, 1) : 0, g = an.g;
        let q;
        if (FLOOR[clip]) {
          locoMoveB(p, clip, tt); gaitOf(g); p.ph += dt * TAU / g.T; g.ph = p.ph;
          q = clipLoco(an.q || (an.q = newPose()), g);
          topLayer(p, clip, q, tt);
        } else {
          switch (clip) {
            case 'shoot': case 'ftshot': q = kf(p.shotA != null ? p.shotA : p.poseT, SHOT_K); if (clip === 'ftshot') { for (const b of ['hipL', 'hipR', 'knL', 'knR', 'ftL', 'ftR']) { const i = B[b] * 3; q[i] *= 0.6; } } break;
            case 'layup': q = kf(p.poseT, LAYUP_K); break;
            case 'dunk': q = kf(p.poseT, DUNK_K); break;
            case 'block': case 'rebound': case 'tip': q = clipJump(tt); if (clip === 'block') { q[B.shL * 3] *= 0.85; q[B.shL * 3 + 2] -= 0.4; } break;
            case 'contest': q = clipJump(tt); q[B.shL * 3] = -1.0; q[B.elL * 3] = -0.6; break;
            case 'celebrate': q = clipCeleb(p.celType || 0, p.poseT); break;
            case 'getup': q = clipGetup(clamp(1 - p.rising / 0.9, 0, 1)); break;
            case 'sit': q = lerpPose(POSE_SIT, POSE_SIT, 0); q[B.neck * 3] -= 0.25; for (const sd of [-1, 1]) { const s3 = (sd < 0 ? B.shL : B.shR) * 3; q[s3] = -0.45; q[s3 + 1] = 0; q[s3 + 2] = sd * 0.12; q[s3 + 3] = -0.7; } break; // hands resting on his thighs
            default: q = lerpPose(POSE_IDLE, POSE_IDLE, 0);
          }
        }
        // breathing, a look around, the head toward what he watches
        if (clip === 'idle' || clip === 'ready' || clip === 'sit' || clip === 'hk' || clip === 'dstance' || clip === 'triple') { const br = Math.sin(an.t * 2.2 + p.ph) * (clip === 'hk' ? 0.03 : 0.012); q[B.spine * 3] += br; }
        if (p.look && clip !== 'rag' && clip !== 'dunk') {
          const dx = p.look[0] - p.x, dz = p.look[2] - p.z, yaw = angDiff(Math.atan2(dx, dz), p.h + q[PN + 3]), dh = Math.hypot(dx, dz) || 1, pitch = -Math.atan2(p.look[1] - 1.9 * hs, dh);
          const y1 = clamp(yaw, -1.2, 1.2), p1 = clamp(pitch, -0.7, 0.5);
          q[B.neck * 3 + 1] += y1 * 0.55; q[B.head * 3 + 1] += y1 * 0.35; q[B.neck * 3] += p1 * 0.5; q[B.head * 3] += p1 * 0.4; q[B.chest * 3 + 1] += y1 * 0.1;
        }
        bones = fk(q, p.x, p.y + p.jumpY, p.z, p.h, hs, p.lk.sw, p.lk.ll);
        if (p.look) { const hm = bones[B.head], gz = v3s(p.look, [hm[3], hm[7] + 0.18 * hs, hm[11]]); p.gaze = v3n(gz); } else p.gaze = [Math.sin(p.h), -0.05, Math.cos(p.h)];
        p.sway = 0;
        if (FLOOR[clip] && p.jumpY < 0.02) footLock(p, bones, dt, an.g ? an.g.yaw : 0, an.g);
        if (clip === 'hk') for (const sd of [-1, 1]) { const km = bones[sd < 0 ? B.knL : B.knR]; armIK(bones, sd, [km[3] + km[2] * 0.06 * hs, km[7] + 0.1 * hs, km[11] + km[10] * 0.06 * hs], hs); }
        handsOnBall(p, bones, clip, hs, dt);
      }
      if (an.blendT > 0 && an.from && an.from.length === NB) {
        an.blendT -= dt; const u = clamp(1 - an.blendT / an.blendDur, 0, 1), s = u * u * (3 - 2 * u);
        for (let i = 0; i < NB; i++) bones[i] = mLerp(an.from[i], bones[i], s);
      }
      p.bones = bones;
    }
    // the legs for a move: a stance sinks the hips and widens the feet; a crossover or between the legs plants wide and low; a spin turns
    function locoMoveB(p, clip, tt) {
      const g = p.an.g;
      g.sink = g.cut > 0 ? Math.sin(Math.PI * (1 - g.cut / 0.3)) * 0.6 : 0; g.wide = 0.16 * g.sink; g.wideS = -g.cutS; g.yaw = 0; g.bankX = 0;
      const base = clip === 'dstance' ? 0.42 : clip === 'triple' ? 0.32 : clip === 'ready' ? 0.24 : clip === 'inbound' ? 0.06 : clip === 'idle' ? 0.05 : 0.15;
      g.sink = Math.max(g.sink, base * (1 - 0.6 * clamp(g.v / 6, 0, 1)));
      if (p.stumbleT > 0 || clip === 'fumble') { g.sink = Math.max(g.sink, 0.7); g.leanF += 0.2; }
      const s = p.mvS || 1;
      if (clip === 'cross' || clip === 'btl' || clip === 'hesi') { const b = bump(tt, 0, 1); g.sink = Math.max(g.sink, 0.55 + 0.4 * b); g.wide = 0.22 * b; g.wideS = clip === 'btl' ? 0 : s; g.bankX = s * 0.16 * b; }
      else if (clip === 'btb') { const b = bump(tt, 0, 1); g.sink = Math.max(g.sink, 0.5 + 0.3 * b); g.bankX = -s * 0.12 * b; }
      else if (clip === 'spin') { g.yaw = s * TAU * smo(clamp(tt * 1.08, 0, 1)); g.sink = Math.max(g.sink, 0.6 * bump(tt, 0, 1) + 0.3); }
      else if (clip === 'steal') { const b = bump(tt, 0, 1); g.sink = Math.max(g.sink, 0.5 + 0.5 * b); g.leanF += 0.25 * b; }
    }
    // the upper body over the gait: the ready stance's hands, the defensive slide's wide arms, the dribble's guard arm, the moves' sell
    function topLayer(p, clip, q, tt) {
      const set = (sd, sx, sz, el) => { const s3 = (sd < 0 ? B.shL : B.shR) * 3, e3 = (sd < 0 ? B.elL : B.elR) * 3; q[s3] = -sx; q[s3 + 2] = sd * sz; q[e3] = -el; };
      const holder = ball && ball.holder === p, drib = holder && ball.st === 'drib';
      if (clip === 'dstance') { const w = Math.sin(p.an.t * 3 + p.num) * 0.06; set(-1, 0.55 + w, 0.95, 0.75); set(1, 0.85 - w, 0.7, 0.9); q[B.spine * 3] += 0.18; q[B.neck * 3] -= 0.2; }
      else if (clip === 'ready') { set(-1, 0.45, 0.45, 1.1); set(1, 0.45, 0.45, 1.1); q[B.spine * 3] += 0.1; }
      if (holder && !drib && (clip === 'triple' || clip === 'run' || clip === 'idle' || clip === 'ready')) { q[B.spine * 3] += 0.12; }
      if (drib) { const dh = p.dh || 1; set(-dh, 0.75, 0.55, 1.45); q[B.spine * 3] += 0.1; q[B.chest * 3 + 1] -= dh * 0.12; } // the off arm guards the ball
      if (clip === 'cross' || clip === 'btl' || clip === 'btb' || clip === 'hesi') {
        const s = p.mvS || 1, f = bump(tt, 0, 0.55), w = bump(tt, 0.3, 1);
        q[B.chest * 3 + 1] += -s * 0.35 * f + s * 0.25 * w; q[B.neck * 3 + 1] += -s * 0.25 * f + s * 0.2 * w; q[B.spine * 3] += 0.18 * bump(tt, 0, 1); q[B.spine * 3 + 2] += s * 0.12 * f;
        if (clip === 'hesi') { q[B.spine * 3] -= 0.25 * bump(tt, 0, 0.6); q[B.neck * 3] -= 0.2 * bump(tt, 0, 0.6); }
      } else if (clip === 'spin') { const b = bump(tt, 0.05, 0.9); q[B.neck * 3 + 1] += (p.mvS || 1) * 0.5 * bump(tt, 0.05, 0.7); q[B.spine * 3] += 0.18 * b; }
      else if (clip === 'pass' || clip === 'catch' || clip === 'steal') { const o = kf(p.poseT, clip === 'pass' ? PASS_K : clip === 'catch' ? CATCH_K : STEAL_K); for (const b of ['spine', 'chest', 'neck', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR']) { const i = B[b] * 3; if (b === 'spine') q[i] += o[i]; else { q[i] = o[i]; q[i + 1] = o[i + 1]; q[i + 2] = o[i + 2]; } } }
      else if (clip === 'inbound') { for (const b of ['shL', 'elL', 'shR', 'elR']) { const i = B[b] * 3; q[i] = POSE_INB[i]; q[i + 1] = POSE_INB[i + 1]; q[i + 2] = POSE_INB[i + 2]; } }
      else if (clip === 'fumble') { set(-1, 1.0, 0.7, 0.4); set(1, 0.9, 0.8, 0.4); q[B.spine * 3] += 0.3; }
    }
    // hands on the ball: the dribble hand meets the ball at the top of each bounce and rides it down to the hip; a held ball sits
    // between both palms (the shooting hand behind it on a shot); a dunker hangs on the rim; a rebounder or shot blocker reaches
    function handsOnBall(p, bones, clip, hs, dt) {
      const b = ball; if (!b || p.benched) return;
      const ch = bones[B.chest], rt = [ch[0], ch[4], ch[8]], up = [ch[1], ch[5], ch[9]], fw = [ch[2], ch[6], ch[10]];
      const ob = [bones[B.shL], bones[B.elL], bones[B.haL], bones[B.shR], bones[B.elR], bones[B.haR]];
      let w = 0;
      if (b.holder === p) {
        if (b.st === 'drib') {
          const dh = p.dh || 1, hipY = bones[B.hips][7], ty = Math.max(b.y + BALL_R * 0.8 + 0.08 * hs, hipY - 0.12 * hs);
          armIK(bones, dh, [b.x - fw[0] * 0.03, ty, b.z - fw[2] * 0.03], hs);
          return;
        }
        // two palms on the ball: the wrists a ball's radius out to the sides (on a shot the shooting hand comes behind and under it)
        const shot = clip === 'shoot' || clip === 'ftshot' || clip === 'layup' || clip === 'dunk';
        const r2 = BALL_R + 0.04 * hs;
        if (shot) {
          armIK(bones, 1, [b.x - fw[0] * r2 + rt[0] * 0.03 - up[0] * 0.05, b.y - fw[1] * r2 - 0.06 * hs, b.z - fw[2] * r2 + rt[2] * 0.03], hs);
          if (clip !== 'dunk' || p.poseT < 0.5) armIK(bones, -1, [b.x - rt[0] * r2, b.y + 0.02, b.z - rt[2] * r2], hs);
        } else {
          armIK(bones, -1, [b.x - rt[0] * r2, b.y + 0.04 * hs, b.z - rt[2] * r2], hs);
          armIK(bones, 1, [b.x + rt[0] * r2, b.y + 0.04 * hs, b.z + rt[2] * r2], hs);
        }
        return;
      }
      // a dunk's hang: both hands on the front of the rim
      if (clip === 'dunk' && p.dunkH && p.poseT > 0.56 && p.poseT < 1.0) {
        const h = p.dunkH, x = h.x - h.dir * RIM_C * 0.92;
        armIK(bones, -1, [x, RIM_Y + 0.03, h.z - 0.13], hs); armIK(bones, 1, [x, RIM_Y + 0.03, h.z + 0.13], hs);
        return;
      }
      // reaching for a loose or flying ball near him (rebounds, blocks, deflections)
      if ((b.st === 'loose' || b.st === 'air') && (clip === 'rebound' || clip === 'block' || clip === 'contest' || clip === 'tip' || clip === 'steal')) {
        const c = [ch[3], ch[7], ch[11]], d = Math.hypot(b.x - c[0], b.y - c[1], b.z - c[2]);
        w = smo(clamp((1.25 - d) / 0.6, 0, 1));
        if (w > 0.01) {
          if (clip === 'block' || clip === 'contest' || clip === 'steal') armIK(bones, clip === 'steal' ? 1 : -1, [b.x, b.y, b.z], hs);
          else { armIK(bones, -1, [b.x - rt[0] * 0.14, b.y, b.z - rt[2] * 0.14], hs); armIK(bones, 1, [b.x + rt[0] * 0.14, b.y, b.z + rt[2] * 0.14], hs); }
          if (w < 0.99) for (let i = 0; i < 6; i++) { const bi = (i < 3 ? B.shL : B.shR) + (i % 3); bones[bi] = mLerp(ob[i], bones[bi], w); }
        }
      }
    }
    // foot locking: a planted foot stays where it touched down until the gait lifts it, so feet never slide
    function footLock(p, bones, dt, yaw, g) {
      const hs = p.lk.hs, fl = p.fl || (p.fl = [{ on: 0, x: 0, z: 0, m: null, fade: 0 }, { on: 0, x: 0, z: 0, m: null, fade: 0 }]);
      const fwd = [Math.sin(p.h + (yaw || 0)), 0, Math.cos(p.h + (yaw || 0))];
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1, ft = side < 0 ? B.ftL : B.ftR, m = bones[ft], L = fl[i];
        const soleY = m[7] - 0.07 * hs, planted = g ? (i ? g.cR : g.cL) && soleY < 0.12 * hs : soleY < 0.045 * hs;
        const P = g ? mPt(m, 0, -0.04 * hs, 0.12 * hs) : [m[3], m[7], m[11]];
        if (planted) {
          if (!L.on) { L.on = 1; L.x = P[0]; L.z = P[2]; L.m = m.slice(); L.fade = 0; if (Math.hypot(p.vx, p.vz) > 4.5 && g && g.cut > 0.2 && !(p.squeakT > 0)) { p.squeakT = 0.5; if (Math.hypot(p.x - cam.c[0], p.z - cam.c[2]) < 9) try { sfx.play('squeak'); } catch (e) {} } }
          const dx = L.x - P[0], dz = L.z - P[2], dd = Math.hypot(dx, dz);
          if (dd > 0.42 * hs) { L.on = 0; continue; }
          if (dd > 0.004) legIK(bones, side, [m[3] + dx, m[7], m[11] + dz], hs, fwd, g ? m : L.m, p.lk.ll);
        } else if (L.on) { L.on = 0; L.fade = 0.08; L.lx = L.x - P[0]; L.lz = L.z - P[2]; }
        if (!L.on && L.fade > 0) { L.fade -= dt; const k = Math.max(0, L.fade / 0.08); legIK(bones, side, [m[3] + L.lx * k, m[7], m[11] + L.lz * k], hs, fwd, g ? m : null, p.lk.ll); }
      }
      if (p.squeakT > 0) p.squeakT -= dt;
    }
    // what the legs should be doing, read from the motion itself (velocity, its change, the turn of the body)
    function locoIn(p, dt) {
      const an = p.an, g = an.g || (an.g = { v: 0, uf: 1, ul: 0, wB: 0, wS: 0, kR: 0, line: 0, brake: 0, drive: 0, sink: 0, leanF: 0, bank: 0, twist: 0, ph: 0, yaw: 0, wide: 0, wideS: 0, T: 1, D: 0.5, Sx: 0, lift: 0, ax: 0, az: 0, pvx: p.vx, pvz: p.vz, hh: p.h, dx: 0, dz: 0, cut: 0, cutS: 0, mS: 0, up: 0 });
      const sp = Math.hypot(p.vx, p.vz);
      an.idleT = sp < 0.5 ? (an.idleT || 0) + dt : 0;
      if (dt < 1e-4) return;
      const fx = Math.sin(p.h), fz = Math.cos(p.h), k8 = Math.min(1, dt * 8);
      g.ax += ((p.vx - g.pvx) / dt - g.ax) * k8; g.az += ((p.vz - g.pvz) / dt - g.az) * k8; g.pvx = p.vx; g.pvz = p.vz;
      g.twist += (clamp(angDiff(p.h, g.hh) / dt, -14, 14) - g.twist) * Math.min(1, dt * 12); g.hh = p.h;
      const sc = p.lk.hs * (p.lk.ll || 1), vf = p.vx * fx + p.vz * fz, vl = p.vx * fz - p.vz * fx, aF = g.ax * fx + g.az * fz, aL = g.ax * fz - g.az * fx;
      g.v = sp / sc;
      if (sp > 0.2) { g.uf = vf / sp; g.ul = vl / sp; }
      const kw = Math.min(1, dt * 9);
      g.wB += (clamp((-g.uf - 0.25) / 0.55, 0, 1) - g.wB) * kw;
      g.wS += (clamp((Math.abs(g.ul) - 0.45) / 0.35, 0, 1) * (1 - g.wB) * clamp(1.5 - g.v / 7, 0, 1) - g.wS) * kw;
      g.kR = clamp((g.v - 1.6) / 6.4 + (p.sprint ? 0.1 : 0), 0, 1);
      g.brake += (clamp(-aF / 24, 0, 1) * clamp(sp / 3, 0, 1) - g.brake) * k8;
      g.drive += (clamp(aF / 30, 0, 1) * clamp(1 - g.v / 9, 0, 1) - g.drive) * k8;
      g.leanF = clamp(aF * 0.003, -0.12, 0.12);
      g.bank += (clamp(-aL * 0.011, -0.3, 0.3) - g.bank) * k8;
      if (sp > 3) {
        const dl = Math.hypot(g.dx, g.dz);
        if (dl > 0.5) { const dot = (g.dx * p.vx + g.dz * p.vz) / (dl * sp); if (g.cut <= 0 && dot < 0.82) { g.cut = 0.3; g.cutS = vl > 0 ? 1 : -1; } }
        const kd = Math.min(1, dt * 6); g.dx += (p.vx - g.dx) * kd; g.dz += (p.vz - g.dz) * kd;
      } else { g.dx = p.vx; g.dz = p.vz; }
      if (g.cut > 0) g.cut -= dt;
    }
    function leanStep(p, dt) {
      const ax = (p.vx - p.pvx) / Math.max(dt, 1e-3), az = (p.vz - p.pvz) / Math.max(dt, 1e-3); p.pvx = p.vx; p.pvz = p.vz;
      const fx = Math.sin(p.h), fz = Math.cos(p.h), rx = fz, rz = -fx;
      const lat = clamp(-(ax * rx + az * rz) * 0.022, -0.3, 0.3), fwd = clamp((ax * fx + az * fz) * 0.016, -0.2, 0.25), k = Math.min(1, dt * 7);
      p.lean += (lat - p.lean) * k; p.leanF += (fwd - p.leanF) * k;
      if (p.plant > 0) p.plant -= dt;
      if (p.stumbleT > 0) p.stumbleT -= dt;
      if (p.rising > 0) { p.rising -= dt; if (p.rising <= 0) p.rising = 0; }
    }
    const handPos = (p, side) => { const m = p.bones ? p.bones[side < 0 ? B.haL : B.haR] : null; return m ? mPt(m, 0, -0.08 * p.lk.hs, 0.03) : [p.x + Math.sin(p.h) * 0.4, 1.3 * p.lk.hs, p.z + Math.cos(p.h) * 0.4]; };
    const chestPos = (p) => { const m = p.bones ? p.bones[B.chest] : null; return m ? mPt(m, 0, 0.12 * p.lk.hs, 0.1) : [p.x, 1.4 * p.lk.hs, p.z]; };
    function ensureBones(p) { if (!p.bones) animUpdate(p, 0); return p.bones; }
    // =====================================================================================
    // Movement (from 3D Blitz): a body with momentum. The stick or the AI asks for a velocity; his legs decide how fast he gets
    // there (burst, braking, grip, the plant on a sharp cut). Speed comes from the card's SPD, the turn from SPD and HND.
    // =====================================================================================
    const effV = (p) => p.v * (p.sprint && p.sta > 0 ? 1.22 + (p.spd - 50) * 0.0012 : 1) * (p.stumbleT > 0 ? 0.6 : 1) * (p.rising > 0 ? 0 : 1) * (ball && ball.holder === p ? 0.92 : 1) * (0.88 + 0.12 * p.sta);
    function steer(p, tx, tz, spd, dt, acc) {
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      let vx = 0, vz = 0;
      if (d > 0.05) { const s = spd * Math.min(1, d * 1.6); vx = (dx / d) * s; vz = (dz / d) * s; }
      drive(p, vx, vz, acc || p.acc || 9, dt);
    }
    function steerDir(p, ux, uz, spd, dt, acc) { drive(p, ux * spd, uz * spd, acc || p.acc || 9, dt); }
    const agN = (p) => clamp(((p.agi || 60) - 30) / 69, 0, 1);
    function drive(p, wx, wz, gain, dt) {
      let ws = Math.hypot(wx, wz);
      const vx = p.vx, vz = p.vz, s = Math.hypot(vx, vz), ag = agN(p), m = p.mass || 1, air = p.jumpY > 0.05 ? 0.1 : 1;
      if (ws > 0.5 && !p.rag) {
        const hx = Math.sin(p.h), hz = Math.cos(p.h), ch = (wx * hx + wz * hz) / ws, run = p.v;
        const bp = run * (0.62 + 0.14 * ag), sh = run * (0.82 + 0.12 * ag), locked = p.face2 != null;
        const cap = locked ? (ch < -0.5 ? bp : ch < 0.5 ? sh : 1e9) : 1e9;
        if (ws > cap) { wx *= cap / ws; wz *= cap / ws; ws = cap; }
      }
      const top = Math.max(p.v * 1.25, ws + 0.5, 2.5);
      const A0 = (7.5 + (p.acc || 9) * 0.75) * Math.pow(1 / m, 0.3) * air;
      if (s < 0.4) { let ax = (wx - vx) * gain, az = (wz - vz) * gain; const al = Math.hypot(ax, az); if (al > A0) { ax *= A0 / al; az *= A0 / al; } p.vx += ax * dt; p.vz += az * dt; return; }
      const ux = vx / s, uz = vz / s, wa = wx * ux + wz * uz, wpx = wx - wa * ux, wpz = wz - wa * uz, wp = Math.hypot(wpx, wpz);
      const cosT = ws > 0.2 ? wa / ws : 1;
      let pk = s > 2.5 ? clamp((0.95 - cosT) / 0.5, 0, 1) : 0;
      if (pk > 0.25 && p.plant <= 0) { p.plant = 0.18 + 0.1 * pk; p.cutK = pk; }
      if (p.plant > 0) pk = Math.max(pk, p.cutK || 0); else p.cutK = 0;
      const pkB = pk * clamp((cosT + 1) / 0.8, 0, 1);
      const up = A0 * Math.max(0.1, 1 - s / top), brake = A0 * (1.1 + 0.4 * ag + pkB * (2 + 0.4 * ag)) * (air < 1 ? 0.3 : 1);
      const lat = (10 + 8 * ag) * Math.pow(1 / m, 0.2) * air * (1 - 0.25 * Math.min(1, s / top)) * (1 + pk * (0.9 + 0.8 * ag));
      let da = (wa - s) * gain, dp = wp * gain;
      const e = Math.hypot(da / (da > 0 ? up : brake), dp / lat), k = e > 1 ? 1 / e : 1;
      da = da * k * (1 - pkB) + clamp(da, -brake, up) * pkB; dp = dp * k * (1 - pkB) + Math.min(dp, lat) * pkB;
      const px = wp > 1e-4 ? wpx / wp : 0, pz = wp > 1e-4 ? wpz / wp : 0;
      p.vx += (ux * da + px * dp) * dt; p.vz += (uz * da + pz * dp) * dt;
    }
    // stamina: sprinting drains it, standing gets it back; a tired player is a step slower and his shot shorter (STA)
    function staminaStep(p, dt, want) {
      p.sprint = !!want && p.sta > 0.03;
      const k = p.staK || 1, sp = Math.hypot(p.vx, p.vz);
      if (p.sprint && sp > 2) p.sta = Math.max(0, p.sta - dt / (6.5 * k));
      else p.sta = Math.min(1, p.sta + dt * k / (sp > 3 ? 40 : 14));
      p.sta = Math.max(0, p.sta - dt * (sp > 3.5 ? 0.0035 : 0) / k); // a long game wears everyone down a little
    }
    function integrate(p, dt) {
      if (p.rag) return;
      if (p.rising > 0) { p.vx *= Math.pow(0.02, dt); p.vz *= Math.pow(0.02, dt); }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const sp = Math.hypot(p.vx, p.vz);
      if (p.face2 != null) p.h += angDiff(p.face2, p.h) * Math.min(1, dt * (p === ctrl ? 14 : 10));
      else if (sp > 0.6) { const back = (p.vx * Math.sin(p.h) + p.vz * Math.cos(p.h)) < -0.6 * sp; if (!back) p.h += angDiff(Math.atan2(p.vx, p.vz), p.h) * Math.min(1, dt * (p === ctrl ? 13 : 9)); }
      if (p.jumpY > 0 || p.jumpV > 0) { p.jumpV -= (p.hang > 0 ? 4 : 17) * dt; p.jumpY = Math.max(0, p.jumpY + p.jumpV * dt); if (p.hang > 0) p.hang -= dt; if (p.jumpY <= 0) { p.jumpV = 0; p.land = 0.15; } }
      if (p.land > 0) { p.land -= dt; p.vx *= Math.pow(0.05, dt); p.vz *= Math.pow(0.05, dt); }
      // walls of the room (and nobody walks through the scorer's table or the benches)
      p.x = clamp(p.x, -COURT.HL - 2.4, COURT.HL + 2.4); p.z = clamp(p.z, -COURT.HW - 2.0, COURT.HW + 1.2);
      leanStep(p, dt);
    }
    // bodies never overlap: each pair is pushed apart (the stronger, heavier, braced body gives less ground), bumps trade momentum
    const brace = (p, nx, nz) => (p.mass || 1) * (0.8 + (p.str || 60) / 250) * (p.vx * nx + p.vz * nz > 1 ? 1.15 : 1);
    function collide() {
      const L = onCourt, n = L.length;
      for (let i = 0; i < n; i++) {
        const a = L[i]; if (a.rag) continue;
        for (let j = i + 1; j < n; j++) {
          const b = L[j]; if (b.rag) continue;
          if (Math.abs(a.jumpY - b.jumpY) > 0.7) continue;
          const dx = a.x - b.x, dz = a.z - b.z, rr = (a.rad + b.rad) * (a.side === b.side ? 0.8 : 0.95), d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
          const ma = brace(a, -nx, -nz), mb = brace(b, nx, nz), wa = mb / (ma + mb), wb = ma / (ma + mb);
          a.x += nx * pen * wa; a.z += nz * pen * wa; b.x -= nx * pen * wb; b.z -= nz * pen * wb;
          const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
          if (rel < 0) { const fa = mb / (ma + mb), fb = ma / (ma + mb); a.vx -= nx * rel * fa * 0.8; a.vz -= nz * rel * fa * 0.8; b.vx += nx * rel * fb * 0.8; b.vz += nz * rel * fb * 0.8; }
          if (a.side !== b.side && rel < -3.5 && phase === 'live') { const l = ma < mb ? a : b; l.stumbleT = Math.max(l.stumbleT, 0.1 + Math.min(0.25, -rel * 0.03)); contact(a, b, -rel); }
        }
      }
    }
    // =====================================================================================
    // The basketball: the dribble (a real bounce under the hand, its period from his speed and handle), the held ball (where it
    // sits for each move, so the hands can follow it), flight with gravity, drag and backspin, the rim (a torus), the glass, the
    // floor, the net's drag, made / missed, out of bounds. Physics substeps at 1/240 s inside the game's 1/60 s step.
    // =====================================================================================
    const BOUNCE_E = 0.74, RIM_E = 0.55, BOARD_E = 0.6;
    const fwdOf = (p) => [Math.sin(p.h), Math.cos(p.h)], rightOf = (p) => [Math.cos(p.h), -Math.sin(p.h)];
    // where the ball sits in his hands for what he is doing (world point; the hands are put on it in 25-animrt.js)
    function holdPoint(p) {
      const hs = p.lk.hs, f = fwdOf(p), r = rightOf(p), J = p.jumpY;
      const at = (fw, rt, y) => [p.x + f[0] * fw * hs + r[0] * rt * hs, y * hs + J, p.z + f[1] * fw * hs + r[1] * rt * hs];
      const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const chest = at(0.3, 0, 1.3), hip = at(0.26, 0.14 * (p.dh || 1), 1.05);
      if (p.pose === 'shoot' || p.pose === 'ftshot') { const a = p.shotA || 0, fh = at(0.16, 0.05, 2.0), set = at(0.12, 0.06, 2.28); return a < 0.24 ? L(chest, fh, smo(a / 0.24)) : L(fh, set, smo(clamp((a - 0.24) / 0.38, 0, 1))); }
      if (p.pose === 'layup') { const t = p.poseT; return t < 0.22 ? L(hip, at(0.3, 0.05, 1.7), smo(t / 0.22)) : L(at(0.3, 0.05, 1.7), at(0.32, 0.1, 2.62), smo(clamp((t - 0.22) / 0.23, 0, 1))); }
      if (p.pose === 'dunk') { const t = p.poseT, top = at(0.15, 0, 2.62), back = at(-0.05, 0, 2.55), slam = at(0.5, 0, 2.3); return t < 0.2 ? L(chest, top, smo(t / 0.2)) : t < 0.42 ? L(top, back, smo((t - 0.2) / 0.22)) : L(back, slam, smo(clamp((t - 0.42) / 0.14, 0, 1))); }
      if (p.pose === 'inbound') return at(0.12, 0, 2.38);
      if (p.pose === 'pass' || p.pose === 'catch') return chest;
      return hip;
    }
    // the dribble: the ball leaves the hand at its top, bounces off the floor out in front and to the side, comes back up into it
    function dribbleStep(b, h, dt) {
      const hs = h.lk.hs, sp = Math.hypot(h.vx, h.vz), f = fwdOf(h), r = rightOf(h);
      const T = clamp(0.56 - sp * 0.022 - (h.bb.hand - 50) * 0.0012, 0.34, 0.6) * (h.dstance ? 0.85 : 1);
      let side = (h.dh || 1) * 0.3, fw = 0.34 + Math.min(0.35, sp * 0.045), Tm = T;
      if (b.mv) { // a move carries the ball across (a crossover), through the legs, behind the back, or round on a spin
        b.mv.t += dt; const k = clamp(b.mv.t / b.mv.dur, 0, 1), s = smo(k);
        side = lerp(b.mv.from, b.mv.to, s) * 0.3; Tm = b.mv.dur;
        if (b.mv.k === 'btl') fw = lerp(0.34, 0.02, bump(k, 0, 1));
        else if (b.mv.k === 'btb') fw = lerp(0.34, -0.3, bump(k, 0, 1));
        else if (b.mv.k === 'spin') { fw = 0.25; side = (h.dh || 1) * 0.3; }
        if (k >= 1) { b.mv = null; b.u = 0; }
        else b.u = k;
      } else { b.u += dt / Tm; if (b.u >= 1) b.u -= 1; }
      const handY = 0.98 * hs + h.jumpY, u = b.u, y = BALL_R + (handY - BALL_R) * Math.abs(Math.cos(Math.PI * u));
      const nx = h.x + f[0] * fw * hs + r[0] * side * hs + h.vx * 0.06, nz = h.z + f[1] * fw * hs + r[1] * side * hs + h.vz * 0.06;
      if (b.prevU < 0.5 && u >= 0.5) { if (Math.hypot(h.x - cam.e[0], h.z - cam.e[2]) < 14) try { sfx.play('tap'); } catch (e) {} }
      b.prevU = u;
      b.vx = (nx - b.x) / Math.max(dt, 1e-3); b.vy = (y - b.y) / Math.max(dt, 1e-3); b.vz = (nz - b.z) / Math.max(dt, 1e-3);
      b.x = nx; b.y = y; b.z = nz;
      b.spin[0] = -b.vz * 3; b.spin[2] = b.vx * 3; b.spin[1] = 0;
    }
    function startDribble(h) { const b = ball; b.st = 'drib'; b.holder = h; b.u = 0; b.prevU = 0; b.mv = null; h.dribbling = true; }
    function giveBall(p, st) { // p has it now: held (catch, rebound, inbound) or dribbling
      const b = ball; b.holder = p; b.st = st || 'held'; b.shot = null; b.pass = null; b.mv = null; b.lastSide = p.side; b.last = p; b.touchRim = false; b.touchBoard = false; b.scored = false; b.thru = null;
      const hp = holdPoint(p); b.x = hp[0]; b.y = hp[1]; b.z = hp[2]; b.vx = b.vy = b.vz = 0;
    }
    // a launch velocity from S that passes through T with launch angle th (radians above horizontal); null if impossible
    function launchAt(S, T, th) {
      const dx = T[0] - S[0], dz = T[2] - S[2], d = Math.hypot(dx, dz), dy = T[1] - S[1], c = Math.cos(th), t = Math.tan(th);
      const den = 2 * c * c * (d * t - dy); if (den <= 1e-4 || d < 1e-3) return null;
      const v = Math.sqrt(BALL_G * d * d / den), vh = v * c;
      return [dx / d * vh, v * Math.sin(th), dz / d * vh, d / vh];
    }
    // one physics step of a free ball (air or loose)
    function freeStep(b, dt) {
      b.prevY = b.y;
      b.vy -= BALL_G * dt;
      if (b.st === 'loose' && b.y <= BALL_R + 0.01) { const dr = Math.pow(0.98, dt * 60); b.vx *= dr; b.vz *= dr; } // no air drag on a flight (the launch solves the vacuum arc); rolling friction on the floor
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      for (const h of HOOP) {
        if (Math.abs(b.x - h.x) > 1.4 || b.y < 2.0 || b.y > 4.8) continue;
        // the glass: a slab at the board face, the court side
        const d = h.dir, rel = (b.x - h.bx) * d; // < 0 in front of the board
        if (rel > -BALL_R && rel < 0.15 && Math.abs(b.z) < BOARD_W / 2 + 0.02 && b.y > BOARD_Y0 - 0.02 && b.y < BOARD_Y0 + BOARD_H + 0.02 && b.vx * d > 0) {
          b.x = h.bx - d * BALL_R; b.vx = -b.vx * BOARD_E; b.vy *= 0.86; b.vz *= 0.86; b.spin[1] *= -0.5; b.touchBoard = true; hitSound('board', Math.abs(b.vx));
        }
        // the ring: a torus (closest point on the tube's centre circle, then a sphere against the tube)
        const rx = b.x - h.x, rz = b.z - h.z, rl = Math.hypot(rx, rz) || 1e-6, cx = h.x + rx / rl * RIM_C, cz = h.z + rz / rl * RIM_C;
        const dx = b.x - cx, dy = b.y - h.y, dz = b.z - cz, dl = Math.hypot(dx, dy, dz), minD = BALL_R + RIM_T;
        if (dl < minD && dl > 1e-6) {
          const nx = dx / dl, ny = dy / dl, nz = dz / dl, vn = b.vx * nx + b.vy * ny + b.vz * nz;
          b.x = cx + nx * minD; b.y = h.y + ny * minD; b.z = cz + nz * minD;
          if (vn < 0) {
            const tx = b.vx - vn * nx, ty = b.vy - vn * ny, tz = b.vz - vn * nz, fr = 0.8 - Math.min(0.2, Math.abs(b.spin[1]) * 0.002);
            b.vx = tx * fr - vn * RIM_E * nx; b.vy = ty * fr - vn * RIM_E * ny; b.vz = tz * fr - vn * RIM_E * nz;
            // backspin softens the next touch: the ball checks up off the iron
            const k = clamp(b.back || 0, 0, 1) * 0.25; b.vx *= 1 - k; b.vz *= 1 - k; b.back = (b.back || 0) * 0.5;
            h.shake = Math.min(1, h.shake + Math.min(1, -vn / 6)); b.touchRim = true; hitSound('rim', -vn);
          }
        }
        // through the hoop: the centre crosses the rim plane going down, inside the ring
        if (b.prevY > h.y && b.y <= h.y && b.vy < 0 && rl < RIM_R - BALL_R * 0.25) { b.thru = h; onThrough(h); }
        // the net: inside it under the rim the ball is slowed and centred
        if (b.y < h.y && b.y > h.y - 0.48 && rl < RIM_R * 0.95) { const k = Math.pow(0.04, dt); b.vx = b.vx * k + (h.x - b.x) * (1 - k) * 2; b.vz = b.vz * k + (h.z - b.z) * (1 - k) * 2; b.vy *= Math.pow(0.35, dt); }
      }
      // the floor
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < -0.6) { hitSound('floor', -b.vy); b.vy = -b.vy * BOUNCE_E; b.vx *= 0.9; b.vz *= 0.9; if (b.st === 'loose' || b.st === 'air') onFloor(b); }
        else { b.vy = 0; const k = Math.pow(0.55, dt); b.vx *= k; b.vz *= k; if (b.st === 'loose' || b.st === 'air') onFloor(b); }
      }
      // the room's walls
      if (Math.abs(b.x) > GYM.x1 - BALL_R) { b.x = Math.sign(b.x) * (GYM.x1 - BALL_R); b.vx = -b.vx * 0.5; }
      if (b.z < GYM.z0 + BALL_R) { b.z = GYM.z0 + BALL_R; b.vz = -b.vz * 0.5; }
      if (b.z > COURT.HW + 3) { b.z = COURT.HW + 3; b.vz = -b.vz * 0.4; }
      if (b.y > GYM.truss - 0.2) { b.y = GYM.truss - 0.2; b.vy = -Math.abs(b.vy) * 0.4; }
      // spin: backspin about the horizontal axis across the flight, slowly decaying
      b.spin[0] *= Math.pow(0.97, dt * 60); b.spin[2] *= Math.pow(0.97, dt * 60);
    }
    let hitT = 0;
    function hitSound(k, v) {
      if (v < 1.2 || hitT > 0) return; hitT = 0.06;
      try { sfx.play(k === 'rim' ? 'clang' : k === 'board' ? 'doink' : 'tap'); } catch (e) {}
    }
    // ball state per game step
    function ballStep(dt) {
      const b = ball; if (!b) return;
      if (hitT > 0) hitT -= dt;
      if (b.holder && (b.st === 'held' || b.st === 'drib')) {
        const h = b.holder;
        if (b.st === 'drib') dribbleStep(b, h, dt);
        else { const hp = holdPoint(h); b.vx = (hp[0] - b.x) / Math.max(dt, 1e-3); b.vy = (hp[1] - b.y) / Math.max(dt, 1e-3); b.vz = (hp[2] - b.z) / Math.max(dt, 1e-3); b.x = hp[0]; b.y = hp[1]; b.z = hp[2]; b.spin[0] *= 0.8; b.spin[2] *= 0.8; }
      } else if (b.st === 'air' || b.st === 'loose') {
        const n = Math.max(1, Math.ceil(dt * 240)), d = dt / n;
        for (let i = 0; i < n && (b.st === 'air' || b.st === 'loose'); i++) freeStep(b, d);
        b.quietT = Math.hypot(b.vx, b.vy, b.vz) < 0.6 && b.y < BALL_R + 0.02 ? (b.quietT || 0) + dt : 0;
      }
      // the ball's own rotation (for the seams): integrate the spin vector
      const w = Math.hypot(b.spin[0], b.spin[1], b.spin[2]);
      if (w > 1e-3) { const a = w * dt, ax = [b.spin[0] / w, b.spin[1] / w, b.spin[2] / w]; b.rot = rotAxis(b.rot, ax, a); }
    }
    // rotate a 3x4 matrix's basis by angle a about the world axis ax (Rodrigues), keeping it orthonormal-ish
    function rotAxis(m, ax, a) {
      const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = ax;
      const R = [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
      const o = m.slice();
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o[r * 4 + k] = R[r * 3] * m[k] + R[r * 3 + 1] * m[4 + k] + R[r * 3 + 2] * m[8 + k];
      return o;
    }
    // =====================================================================================
    // The rules and the plays: jump ball, shots (the meter, the green window, makes and misses), layups and dunks, passes,
    // crossovers, steals, blocks, rebounds, fouls and free throws, out of bounds and inbounds, the shot clock, quarters,
    // timeouts and substitutions, the end of the game. step(dt) runs it all in fixed substeps.
    // =====================================================================================
    const LVLK = [0, 0.33, 0.66, 1, 1.3, 1.1][LEVEL]; // the Arcade's difficulty table (also opts.difficulty)
    const DK = clamp(opts.difficulty != null ? DIFF : LVLK, 0, 1.3);
    const METER_T = 0.95;          // seconds for the shot meter to fill
    const GREEN_C = 0.8;           // where the green window sits on the meter
    const userGreenK = [1.45, 1.2, 1.0, 0.88, 0.74, 0.82][LEVEL]; // the green window for you, by level
    const isUser = (p) => p === ctrl && !(DBG && DBG.auto);
    const rt = (p, k) => (p.bb[k] || 60);
    function say2(t) { try { say(t); } catch (e) {} }
    // ---------- shot quality ----------
    function contestOf(p, h) { // 0 wide open .. 1 smothered: the closest defender between him and the rim, his length and timing
      let c = 0;
      for (const d of foes(p)) {
        const dd = D(d, p); if (dd > 2.8) continue;
        const tx = h.x - p.x, tz = h.z - p.z, tl = Math.hypot(tx, tz) || 1, front = ((d.x - p.x) * tx + (d.z - p.z) * tz) / (tl * (dd || 1));
        const k = Math.pow(clamp((2.3 - dd) / 1.8, 0, 1), 1.5) * clamp(0.3 + front * 0.7, 0.1, 1) * (0.7 + (rt(d, 'perD') + rt(d, 'blk')) / 500) * (d.jumpY > 0.15 ? 1.2 : 1) * clamp(d.lk.hs / p.lk.hs, 0.85, 1.15);
        c = Math.max(c, k);
      }
      return clamp(c, 0, 0.95);
    }
    function skillAt(p, d, ft) { return ft ? rt(p, 'ft') : d < 2.2 ? rt(p, 'fin') : d < COURT.three ? rt(p, 'mid') : rt(p, 'three'); }
    function basePct(p, d, ft) {
      const r = skillAt(p, d, ft), tired = 1 - 0.12 * (1 - p.sta);
      if (ft) return clamp(0.42 + (r - 50) * 0.0105, 0.25, 0.95) * tired;
      let b = lerp(0.62, 0.36, clamp((d - 1.5) / 5.2, 0, 1)) - clamp((d - COURT.three - 1.2) / 4, 0, 0.3);
      return clamp(b + (r - 65) * 0.0065, 0.08, 0.85) * tired;
    }
    // the green window: wider for a good shooter, an open look, a close shot; narrower when contested, deep, or at a higher level
    function shotSetup(p, ft) {
      const h = hoopOf(p.side), d = rimDist(p.x, p.z, h), c = ft ? 0 : contestOf(p, h), r = skillAt(p, d, ft);
      let w = (0.13 + (r - 50) * 0.0019) * (1 - 0.55 * c) * (1 - clamp((d - 3) / 10, 0, 0.45)) * (ft ? 1.15 : 1);
      if (p.side === 0) w *= userGreenK; else w *= 1.05 - 0.2 * DK;
      return { h, d, c, gc: GREEN_C, w: clamp(w, 0.035, 0.3), pts: ft ? 1 : isThree(p.x, p.z, h) ? 3 : 2, ft: !!ft, x: p.x, z: p.z };
    }
    // ---------- starting a shot: a dunk or a layup at the rim, else the jump shot with the meter ----------
    function startShot(p) {
      const b = ball; if (b.holder !== p || p.shotS || phase !== 'live') return false;
      const h = hoopOf(p.side), d = rimDist(p.x, p.z, h), sp = Math.hypot(p.vx, p.vz);
      p.face2 = Math.atan2(h.x - p.x, h.z - p.z);
      // dunk: an athletic finisher close to the rim, going to it (the arcade dunk assist lifts him to the rim)
      const dunkOK = d < 2.0 + sp * 0.12 && (rt(p, 'dunk') + rt(p, 'vert')) / 2 > 52 - 6 * (sp > 3 ? 1 : 0) && sp > 1.2;
      if (dunkOK && d > 0.5) return startDunk(p, h);
      if (d < 2.4 + Math.min(1, sp * 0.15)) return startLayup(p, h);
      b.st = 'held'; b.mv = null;
      p.shotS = shotSetup(p, false); p.meter = 0; p.shotA = 0; p.shotRel = false; p.jumped = false; p.cpuRel = cpuTiming(p);
      setPose(p, 'shoot'); p.vx *= 0.3; p.vz *= 0.3;
      if (p.side === 0 && isUser(p)) meterShow(true);
      shotPressure(p);
      return true;
    }
    function shotPressure(p) { for (const d of foes(p)) if (!isUser(d) && D(d, p) < 3.2) d.react = 0.12 + (1 - rt(d, 'blk') / 100) * 0.3 - DK * 0.08 + rng() * 0.1; }
    // each step while the shot is up: the meter fills, he jumps at the gather's end; held too long = a late release
    function shotStep(p, dt) {
      if (!p.shotS || p.shotRel) return;
      const S = p.shotS;
      p.meter += dt / (METER_T * (S.ft ? 1.05 : 1)); p.shotA = SHOT_REL * Math.min(1, p.meter);
      if (!S.ft && !p.jumped && p.meter > 0.3) { p.jumped = true; p.jumpV = 3.6 + rt(p, 'vert') * 0.022; p.jumpY = 0.001; }
      // the CPU (or the auto player) lets it go at its own timing
      if (!isUser(p) && p.meter >= p.cpuRel) releaseShot(p);
      else if (p.meter >= 1.12) releaseShot(p);
    }
    function cpuTiming(p) { // where on the meter a CPU shooter releases: around the green, tighter for good shooters and higher levels
      const r = skillAt(p, p.shotS.d, p.shotS.ft), s = clamp(0.09 - (r - 50) * 0.0007 + p.shotS.c * 0.05 - (p.side ? DK * 0.025 : 0.01), 0.025, 0.12);
      return GREEN_C + (rng() + rng() + rng() - 1.5) * s * 1.4;
    }
    function releaseShot(p) {
      if (!p.shotS || p.shotRel) return;
      const S = p.shotS, m = p.meter, off = Math.abs(m - S.gc), green = off <= S.w / 2;
      p.shotRel = true; p.shotA = SHOT_REL;
      if (p.side === 0 && isUser(p)) meterResult(green, m - S.gc, S);
      const cNow = S.ft ? 0 : Math.max(S.c, contestOf(p, S.h));
      let P;
      if (green) P = clamp(0.83 + 0.12 * (1 - off / (S.w / 2)) - 0.3 * cNow - (S.d > COURT.three + 2 ? 0.15 : 0), 0.3, 0.97);
      else { const q = clamp(1 - (off - S.w / 2) / 0.22, 0, 1); P = basePct(p, S.d, S.ft) * (1 - 0.55 * cNow) * (0.25 + 0.75 * q); }
      if (S.ft) P = green ? Math.max(P, 0.9) : P;
      const made = rng() < P;
      const LG = DBG && DBG.shotLog ? { side: p.side, d: +S.d.toFixed(1), c: +cNow.toFixed(2), off: +(m - S.gc).toFixed(3), w: +S.w.toFixed(3), P: +P.toFixed(2), made } : null; if (LG) DBG.shotLog.push(LG);
      launchShot(p, S, made, m - S.gc, green); if (LG) ball.shot.lg = LG;
      p.shotS = null; p.meterG = green;
    }
    // the ball leaves his hand on a real arc: a make is aimed at the middle of the rim, a miss off the iron (short, long, left, right)
    function launchShot(p, S, made, early, green) {
      const b = ball, h = S.h, hp = holdPoint(p);
      const ax = h.x - hp[0], az = h.z - hp[2], al = Math.hypot(ax, az) || 1, ux = ax / al, uz = az / al;
      let tx = h.x, tz = h.z, ty = h.y + 0.03;
      if (made) { const e = (rng() - 0.5) * 0.05; tx += ux * (0.04 + e) - uz * (rng() - 0.5) * 0.06; tz += uz * (0.02 + e) + ux * (rng() - 0.5) * 0.06; }
      else {
        const k = rng(), m = 0.2 + rng() * 0.16; // which way it misses follows the timing: early is short, late is long, else to a side
        const ldir = early < -0.04 ? -1 : early > 0.04 ? 1 : k < 0.5 ? -1 : 1;
        if (Math.abs(early) > 0.04 || k < 0.45) { tx += ux * ldir * m; tz += uz * ldir * m; } else { const s = k < 0.72 ? 1 : -1; tx += -uz * s * m; tz += ux * s * m; }
        if (S.d > 6 && rng() < 0.18) { tx += ux * -0.6; tz += uz * -0.6; } // an air ball now and then from deep
      }
      const d = Math.hypot(tx - hp[0], tz - hp[2]), th = (S.ft ? 52 : d < 2.5 ? 58 : d < 6 ? 52 : 49) * Math.PI / 180;
      const v = launchAt(hp, [tx, ty, tz], th) || [ux * 4, 6, uz * 4, 1];
      b.holder = null; b.st = 'air'; b.x = hp[0]; b.y = hp[1]; b.z = hp[2]; b.vx = v[0]; b.vy = v[1]; b.vz = v[2];
      b.spin = [-uz * 14, 0, ux * 14]; b.back = 1; // backspin: about the horizontal axis across the flight
      b.shot = { by: p, side: p.side, pts: S.pts, ft: S.ft, d: S.d, made, h, t: 0, green, x: S.x, z: S.z, ast: b.astBy && b.astBy !== p && tLive - b.astT < 4 ? b.astBy : null };
      b.lastSide = p.side; b.last = p; b.touchRim = false; b.touchBoard = false; b.thru = null; b.astBy = null; b.scored = false;
      if (!S.ft) { const s = stat(p.sq); s.fga++; if (S.pts === 3) s.tpa++; } else stat(p.sq).fta++;
      try { sfx.play('throw'); } catch (e) {}
      p.dribbling = false;
    }
    // ---------- layups and dunks (no meter: the finish is decided by FIN / DNK against the rim protection) ----------
    function startLayup(p, h) {
      const b = ball; b.st = 'held'; b.mv = null;
      setPose(p, 'layup'); p.fin = { h, t: 0, kind: 'layup', rel: 0.42 };
      p.vx *= 0.75; p.vz *= 0.75;
      shotPressure(p);
      return true;
    }
    function startDunk(p, h) {
      const b = ball; b.st = 'held'; b.mv = null;
      setPose(p, 'dunk'); p.fin = { h, t: 0, kind: 'dunk', rel: 0.55 }; p.dunkH = h;
      // the arcade assist: the jump is whatever it takes for his hand to get over the rim at the slam
      const reach = 2.62 * p.lk.hs, need = RIM_Y + 0.35 - reach, T = 0.5;
      p.jumpV = Math.max(4.2, need / T + 0.5 * 17 * T); p.jumpY = 0.001;
      const dx = h.x - h.dir * 0.35 - p.x, dz = h.z - p.z; p.vx = dx / 0.55; p.vz = dz / 0.55;
      shotPressure(p);
      try { sfx.play('ooh'); } catch (e) {}
      return true;
    }
    function finStep(p, dt) {
      const F = p.fin; if (!F) return;
      F.t += dt;
      if (F.kind === 'layup' && F.t > 0.18 && !F.jumped) { F.jumped = true; p.jumpV = 3.8 + rt(p, 'vert') * 0.02; p.jumpY = 0.001; const h = F.h, dx = h.x - h.dir * 0.5 - p.x, dz = h.z - p.z, dl = Math.hypot(dx, dz) || 1; p.vx = dx / dl * Math.min(3.5, dl / 0.45); p.vz = dz / dl * Math.min(3.5, dl / 0.45); }
      if (F.kind === 'dunk' && F.t < 0.55) { const h = F.h, dx = h.x - h.dir * 0.32 - p.x, dz = h.z - p.z; p.vx = dx / Math.max(0.12, 0.55 - F.t); p.vz = dz / Math.max(0.12, 0.55 - F.t); }
      if (F.t >= F.rel && ball.holder === p) {
        const h = F.h, c = contestOf(p, h), dunk = F.kind === 'dunk';
        const sk = dunk ? (rt(p, 'dunk') * 0.6 + rt(p, 'str') * 0.2 + rt(p, 'vert') * 0.2) : rt(p, 'fin');
        let P = dunk ? clamp(0.93 + (sk - 60) * 0.003 - c * 0.35, 0.45, 0.99) : clamp(0.6 + (sk - 60) * 0.008 - c * 0.42, 0.18, 0.92);
        if (p.side === 1) P *= 0.94 + 0.08 * DK; else P *= 1.02 - 0.06 * DK;
        // a rim protector right there can send it back
        let blocker = null; for (const d of foes(p)) if (d.jumpY > 0.25 && D(d, p) < 1.0 && d.lk.hs * 2.6 + d.jumpY > RIM_Y - 0.2 && rng() < (rt(d, 'blk') - 40) / 260 * (dunk ? 0.5 : 1)) { blocker = d; break; }
        if (blocker) { blockShot(blocker, p); p.fin = null; return; }
        const made = rng() < P;
        if (dunk) {
          const b = ball; b.holder = null; b.st = 'air'; b.shot = { by: p, side: p.side, pts: 2, ft: false, d: 0.5, made, h, t: 0, dunk: true, ast: b.astBy && b.astBy !== p && tLive - b.astT < 4 ? b.astBy : null }; b.astBy = null;
          b.x = h.x - h.dir * (made ? 0.05 : 0.2); b.y = h.y + 0.32; b.z = h.z + (made ? 0 : 0.15); b.vx = h.dir * (made ? 0.3 : -1.2); b.vy = made ? -7 : 2.5; b.vz = made ? 0 : 0.9;
          b.lastSide = p.side; b.last = p; b.touchRim = !made; b.thru = null; b.back = 0;
          h.shake = 1; cam.shake = Math.max(cam.shake, 0.9); p.hang = made ? 0.35 : 0.1;
          const s = stat(p.sq); s.fga++; try { sfx.play('clang'); } catch (e) {}
        } else {
          const S = { h, d: rimDist(p.x, p.z, h), c, pts: 2, ft: false, x: p.x, z: p.z };
          launchShot(p, S, made, 0, false); ball.shot.layup = true;
          // a layup off the glass: aim at the board above the rim on an angle (the launch above goes at the rim; bank it when wide)
        }
        p.fin = null;
      }
    }
    // ---------- through the hoop: points ----------
    function onThrough(h) {
      const b = ball, S = b.shot;
      if (b.scored) return;
      // a ball dropped in by the wrong team at its own basket still counts for the side that attacks it
      const side = HOOP.indexOf(h) === (dirOf(0) > 0 ? 1 : 0) ? 0 : 1;
      if (S && S.side !== side) return;
      b.scored = true; if (S && S.lg) S.lg.end = 'in';
      const pts = S ? S.pts : 2, by = S ? S.by : b.last;
      if (side === 0) hs += pts; else as += pts;
      boardDirty = true;
      if (by && by.sq) { const s = stat(by.sq); s.pts += pts; if (S && S.ft) s.ftm++; else { s.fgm++; if (pts === 3) s.tpm++; if (S && S.dunk) s.dnk++; } }
      if (S && S.ast) stat(S.ast.sq).ast++;
      const ft = S && S.ft;
      const andOne = S && S.and1;
      lastBig = { kind: S && S.dunk ? 'dunk' : pts === 3 ? 'three' : 'score', side, t: tLive };
      excite = Math.min(1, excite + (S && S.dunk ? 0.8 : pts === 3 ? 0.6 : 0.35));
      try { sfx.play(side === 0 ? 'cheer' : 'ooh'); if (!ft) setTimeout(() => { try { sfx.play('clap'); } catch (e) {} }, 300); } catch (e) {}
      if (!ft) {
        const txt = S && S.dunk ? (side === 0 ? 'SLAM DUNK!' : 'DUNK') : pts === 3 ? 'THREE!' : S && S.green ? 'GREEN!' : 'BUCKET';
        if (by) popAt(by, txt + ' +' + pts, side === 0 ? '#2bd46b' : '#ff7a6a');
        if (S && S.dunk) tableFlash(side === 0 ? 'SLAM DUNK!' : 'DUNK', 2.2); else if (pts === 3 && side === 0) tableFlash('THREE!', 1.8);
        HL.push({ q: qtr, t: Math.ceil(clock), side, txt: (by ? by.sq.name : '') + (S && S.dunk ? ' dunk' : pts === 3 ? ' three' : ' basket') });
        if (by && side === 0 && (S && (S.dunk || pts === 3))) { by.celType = S.dunk ? 2 : 3; }
      }
      // what happens next: free throws carry on, an and-one goes to the line, else the other team inbounds from under the basket
      if (ft) return; // ftStep decides
      if (andOne && S.fouled) { pendFT = null; const sh = S.fouled.sh; setDead(1.3, () => startFT(sh, 1)); popAt(sh, 'AND ONE!', side === 0 ? '#ffc21a' : '#ff7a6a'); return; }
      endPossession('made', side);
    }
    // ---------- blocks, steals, passes, moves ----------
    function blockShot(d, shooter) {
      const b = ball, h = hoopOf(shooter.side);
      if (b.shot && b.shot.lg) b.shot.lg.end = 'blk';
      b.holder = null; b.st = 'loose'; b.shot = null;
      const ox = shooter.x - h.x, oz = shooter.z - h.z, ol = Math.hypot(ox, oz) || 1;
      b.vx = ox / ol * (3 + rng() * 3) + (rng() - 0.5) * 3; b.vz = oz / ol * (3 + rng() * 3) + (rng() - 0.5) * 3; b.vy = -1 + rng() * 3;
      b.lastSide = d.side; b.last = d; b.back = 0; b.spin = [rng() * 20 - 10, 0, rng() * 20 - 10];
      shooter.shotS = null; shooter.fin = null; shooter.shotRel = true;
      stat(d.sq).blk++;
      popAt(d, 'BLOCKED!', d.side === 0 ? '#4dd2ff' : '#ff7a6a'); tableFlash('BLOCKED!', 1.6);
      excite = Math.min(1, excite + 0.5); cam.shake = Math.max(cam.shake, 0.4);
      try { sfx.play('ooh'); } catch (e) {}
      if (meterOn && shooter === ctrl) meterHide();
    }
    // a contest in the air: his hand gets to a shot that just left (or a shot still in the shooter's hands at the top)
    function tryBlock(d) {
      const b = ball;
      if (b.st === 'air' && b.shot && !b.shot.ft && b.shot.t < 0.32 && b.shot.side !== d.side) {
        const hy = d.jumpY + d.lk.hs * 2.75, hand = [d.x + Math.sin(d.h) * 0.3, hy, d.z + Math.cos(d.h) * 0.3];
        const dd = Math.hypot(b.x - hand[0], b.y - hand[1], b.z - hand[2]);
        if (dd < 0.45 && b.vy > -1) { const pr = clamp(0.04 + (rt(d, 'blk') - 40) / 220 + (d.lk.hs - b.shot.by.lk.hs) * 1.2 + (d.side === 1 ? DK * 0.05 : 0), 0.02, 0.45); if (rng() < pr) { d.blkDone = true; const sh = b.shot.by; blockShot(d, sh); return true; } }
      }
      return false;
    }
    function trySteal(d) {
      if (d.stealCd > 0 || phase !== 'live') return false;
      d.stealCd = 0.7; d.stealHeat = (d.stealHeat || 0) + 1; setPose(d, 'steal');
      const b = ball, h = b.holder;
      if (b.st === 'air' && b.pass) return false;
      if (!h || h.side === d.side) return false;
      const dd = D(d, h); if (dd > 1.45) return false;
      // reach-ins: spamming it, or reaching from behind, is a foul
      const fx = Math.sin(d.h), fz = Math.cos(d.h), front = ((h.x - d.x) * fx + (h.z - d.z) * fz) / (dd || 1);
      const foulP = clamp(0.06 + Math.max(0, d.stealHeat - 2) * 0.12 + (front < 0.2 ? 0.25 : 0), 0, 0.7);
      if (rng() < foulP) { callFoul(d, h, false, 'Reach-in'); return false; }
      const exposed = (b.st === 'drib' && b.u > 0.25 && b.u < 0.75 ? 0.08 : 0) + (b.mv ? 0.1 : 0) + (h.pose === 'pass' ? 0.1 : 0);
      const pr = clamp(0.1 + (rt(d, 'stl') - rt(h, 'hand')) * 0.006 + exposed + (d.side === 1 ? DK * 0.04 : 0) - (dd - 0.8) * 0.15, 0.03, 0.55);
      if (rng() < pr) {
        stat(d.sq).stl++; stat(h.sq).to++;
        popAt(d, 'STEAL!', d.side === 0 ? '#4dd2ff' : '#ff7a6a');
        b.holder = null; b.st = 'loose'; b.shot = null; b.pass = null; b.mv = null;
        const tx = d.x - h.x, tz = d.z - h.z, tl = Math.hypot(tx, tz) || 1;
        b.vx = tx / tl * 2.5 + (rng() - 0.5) * 2; b.vz = tz / tl * 2.5 + (rng() - 0.5) * 2; b.vy = 1.5; b.lastSide = d.side; b.last = d;
        h.shotS = null; h.fin = null; if (meterOn && h === ctrl) meterHide();
        excite = Math.min(1, excite + 0.3);
        try { sfx.play('good'); } catch (e) {}
        return true;
      }
      return false;
    }
    const MOVES = ['cross', 'btl', 'btb', 'hesi', 'spin'];
    const MOVE_D = { cross: 0.3, btl: 0.36, btb: 0.4, hesi: 0.36, spin: 0.5 };
    // Q on offense: the next move in the chain. Too fast or too many in a row and he loses it
    function doMove(p) {
      const b = ball; if (b.holder !== p || phase !== 'live' || p.shotS || p.fin) return false;
      if (b.st !== 'drib') startDribble(p);
      const gap = tLive - (p.cmbLast || -9), minGap = 0.26 - (rt(p, 'hand') - 50) * 0.0012;
      if (gap > 1.6) p.cmb = 0;
      p.cmbHeat = (p.cmbHeat || 0) + 1;
      const tooFast = gap < minGap, risk = clamp((p.cmbHeat - 3.2) * 0.13 + (tooFast ? 0.4 : 0) - (rt(p, 'hand') - 60) * 0.005, 0, 0.92);
      p.cmbLast = tLive;
      if ((tooFast || p.cmbHeat > 3) && rng() < risk) { // lost it off his foot
        stat(p.sq).to++; setPose(p, 'fumble');
        b.holder = null; b.st = 'loose'; b.mv = null; b.vx = Math.sin(p.h) * 2.5 + (rng() - 0.5) * 2.5; b.vz = Math.cos(p.h) * 2.5 + (rng() - 0.5) * 2.5; b.vy = 0.5; b.lastSide = p.side; b.last = p;
        popAt(p, 'LOST IT!', '#ff7a6a'); try { sfx.play('bad'); } catch (e) {}
        return false;
      }
      const k = MOVES[p.cmb % MOVES.length]; p.cmb++;
      const dur = MOVE_D[k] * (1.08 - rt(p, 'hand') * 0.0015);
      const from = p.dh || 1, to = k === 'hesi' || k === 'spin' ? from : -from;
      b.mv = { k, t: 0, dur, from, to }; p.dh = to; p.mvS = to;
      setPose(p, k);
      // the move moves him: a lateral burst (a crossover), a stop and go (hesitation), a spin round the defender
      const r = rightOf(p), f = fwdOf(p), push = 2.2 + rt(p, 'spd') * 0.02;
      if (k === 'hesi') { p.vx *= 0.3; p.vz *= 0.3; p.hesiGo = 0.3; }
      else if (k === 'spin') { p.vx += f[0] * 1.5; p.vz += f[1] * 1.5; }
      else { p.vx += r[0] * to * push; p.vz += r[1] * to * push; }
      // the man guarding him may bite: a stumble (broken ankles) by the handle against his perimeter defense
      for (const d of foes(p)) {
        if (D(d, p) > 1.8) continue;
        const pr = clamp(0.1 + (rt(p, 'hand') - rt(d, 'perD')) * 0.008 + (k === 'spin' || k === 'btb' ? 0.05 : 0) - (d.side === 1 ? DK * 0.06 : 0) - (p.cmbHeat > 2 ? 0 : 0.04), 0.02, 0.5);
        if (rng() < pr) { d.stumbleT = 0.55; d.vx *= 0.2; d.vz *= 0.2; if (pr > 0.25 && rng() < 0.5) { popAt(d, 'ANKLES!', p.side === 0 ? '#ffc21a' : '#ff7a6a'); excite = Math.min(1, excite + 0.35); try { sfx.play('ooh'); } catch (e) {} } }
        break;
      }
      return true;
    }
    // passes: a chest pass (flat), a bounce pass in traffic, a lob over the top; accuracy from PAS; defenders in the lane can pick it
    function startPass(p, to, kind) {
      const b = ball; if (b.holder !== p || !to || to === p || p.shotS || p.fin) return false;
      setPose(p, 'pass'); p.passTo = to; p.passKind = kind || 'chest'; p.passT = 0.1;
      if (b.st === 'drib') { b.st = 'held'; b.mv = null; }
      p.face2 = Math.atan2(to.x - p.x, to.z - p.z);
      return true;
    }
    function passStep(p, dt) {
      if (p.passT == null) return;
      p.passT -= dt; if (p.passT > 0) return;
      const to = p.passTo, b = ball; p.passT = null; p.face2 = null;
      if (b.holder !== p || !to) return;
      const hp = holdPoint(p), sp = 10 + rt(p, 'pass') * 0.05, dist = Math.hypot(to.x - hp[0], to.z - hp[2]), T = clamp(dist / sp, 0.15, 1.4);
      const err = (1 - rt(p, 'pass') / 110) * 0.55 * (p.side === 1 ? 1.1 - 0.25 * DK : 1);
      const tx = to.x + to.vx * T * 0.9 + (rng() - 0.5) * err, tz = to.z + to.vz * T * 0.9 + (rng() - 0.5) * err, ty = 1.25 * to.lk.hs;
      b.holder = null; b.st = 'air'; b.pass = { from: p, to, t: 0, T }; b.shot = null;
      b.x = hp[0]; b.y = hp[1]; b.z = hp[2];
      b.vx = (tx - hp[0]) / T; b.vz = (tz - hp[2]) / T; b.vy = (ty - hp[1] + 0.5 * BALL_G * T * T) / T;
      b.lastSide = p.side; b.last = p; b.spin = [-(tz - hp[2]) * 2, 0, (tx - hp[0]) * 2]; b.back = 0;
      try { sfx.play('throw'); } catch (e) {}
      p.dribbling = false;
      // defenders read the lane: whoever is closest to the line may jump it
      for (const d of foes(p)) {
        const ax = tx - hp[0], az = tz - hp[2], al = Math.hypot(ax, az) || 1, t = clamp(((d.x - hp[0]) * ax + (d.z - hp[2]) * az) / (al * al), 0.15, 0.9), px = hp[0] + ax * t, pz = hp[2] + az * t, off = Math.hypot(d.x - px, d.z - pz);
        if (off < 0.75) { const pr = clamp(0.12 + (rt(d, 'stl') - rt(p, 'pass')) * 0.006 - off * 0.2 + (d.side === 1 ? DK * 0.04 : 0), 0.02, 0.4); if (rng() < pr) { b.pass.pick = d; b.pass.pickT = t * T; break; } }
      }
    }
    // a pass in flight reaches someone: the man it was for catches it, a defender who jumped the lane deflects or picks it
    function passFlight(dt) {
      const b = ball, P = b.pass; if (!P || b.st !== 'air') return;
      P.t += dt;
      if (P.pick && P.t >= P.pickT) {
        const d = P.pick; b.pass = null;
        if (rng() < 0.55) { giveBall(d, 'held'); setPose(d, 'catch'); stat(d.sq).stl++; stat(P.from.sq).to++; popAt(d, 'PICKED OFF!', d.side === 0 ? '#4dd2ff' : '#ff7a6a'); changePoss(d.side, d); try { sfx.play('good'); } catch (e) {} }
        else { b.st = 'loose'; b.vx *= -0.3; b.vz *= -0.3; b.vy = 1.5; b.lastSide = d.side; b.last = d; popAt(d, 'TIPPED', '#c9ccd4'); }
        return;
      }
      const to = P.to, c = [to.x, 1.25 * to.lk.hs + to.jumpY, to.z];
      if (Math.hypot(b.x - c[0], b.y - c[1], b.z - c[2]) < 0.62 + rt(to, 'hand') * 0.002) {
        b.pass = null; giveBall(to, 'held'); setPose(to, 'catch'); b.astBy = P.from; b.astT = tLive;
        try { sfx.play('catch'); } catch (e) {}
        if (to.side === 0) setCtrl(to);
        to.holdT = 0;
        return;
      }
      if (P.t > P.T + 0.5) { b.pass = null; b.st = 'loose'; }
    }
    // ---------- loose balls and rebounds: whoever gets a hand on it ----------
    function grabStep() {
      const b = ball; if (b.holder) return;
      const shot = b.shot;
      if (b.st === 'air' && !shot) return; // passes are handled by passFlight
      if (b.st === 'air' && shot && !(b.touchRim || b.touchBoard || (b.vy < 0 && b.y < shot.h.y - 0.6) || shot.t > 2.2)) return;
      if (b.scored && b.y > 0.6) return; // through the net: nobody catches it under the rim before the floor
      let best = null, bs = -1;
      for (const p of onCourt) {
        if (p.rag || p.benched || p.stumbleT > 0.3 || (p.shotS && !p.shotRel)) continue;
        const reachY = p.jumpY + p.lk.hs * (p.pose === 'rebound' || p.pose === 'block' || p.pose === 'tip' ? 2.75 : 2.3), dh = Math.hypot(b.x - p.x, b.z - p.z);
        if (dh > 0.85 || b.y > reachY + 0.12 || (b.y > RIM_Y && b.vy > 0)) continue;
        const sc = (1 - dh) * 2 + rt(p, 'reb') / 60 + (p.boxOut ? 0.4 : 0) + rng() * 0.5;
        if (sc > bs) { bs = sc; best = p; }
      }
      if (!best) return;
      if (shot && shot.lg && !shot.lg.end) shot.lg.end = 'grab:' + best.key + (b.touchRim ? 'R' : '') + (b.touchBoard ? 'B' : '') + ' y' + b.y.toFixed(1) + ' t' + shot.t.toFixed(2);
      const wasShot = shot && !shot.ft, offReb = wasShot && best.side === shot.side;
      if (b.scored) { b.scored = false; }
      const p = best;
      giveBall(p, 'held'); setPose(p, p.jumpY > 0.1 ? 'catch' : 'catch');
      if (wasShot || (shot && shot.ft)) { const s = stat(p.sq); s.reb++; if (offReb) s.oreb++; if (p.jumpY > 0.2 || rng() < 0.3) popAt(p, offReb ? 'OFF. BOARD' : 'REBOUND', '#c9ccd4'); }
      if (shot && (b.touchRim || b.touchBoard)) shotClk = SHOT;
      if (p.side !== poss) changePoss(p.side, p); else if (p.side === 0) setCtrl(p);
      p.holdT = 0;
    }
    function onFloor(b) {
      // out of bounds: the ball on the floor past the lines (or in the black band) goes to the other team
      if (phase === 'live' && (Math.abs(b.x) > COURT.HL || Math.abs(b.z) > COURT.HW) && !b.scored) { outOfBounds(b.lastSide, b.x, b.z); return; }
      if (b.pass) { b.pass = null; b.st = 'loose'; }
      if (b.shot && b.st === 'air') { b.st = 'loose'; }
    }
    function outOfBounds(lastSide, x, z) {
      if (phase !== 'live') return;
      const side = 1 - lastSide;
      whistle('Out of bounds', (side === 0 ? HOME.abbr : AWAY.abbr) + ' ball');
      ball.st = 'dead'; ball.holder = null; ball.shot = null;
      setDead(0.9, () => startInbound(side, clamp(x, -COURT.HL + 0.5, COURT.HL - 0.5), z));
    }
    // ---------- fouls ----------
    function contact(a, b, v) { // a hard bump in traffic: a charge or a block now and then (by who was moving into whom)
      if (phase !== 'live' || v < 4.5 || rng() > 0.18) return;
      const h = ball.holder; if (!h || (h !== a && h !== b)) return;
      const d = h === a ? b : a, hv = Math.hypot(h.vx, h.vz), dv = Math.hypot(d.vx, d.vz);
      if (hv > dv + 2 && d.stumbleT <= 0) { // charging: the defender had his spot
        stat(h.sq).pf++; stat(h.sq).to++; whistle('Charge!', 'Offensive foul on ' + shortName(h.sq.name));
        ball.st = 'dead'; ball.holder = null;
        setDead(1.0, () => startInbound(d.side, clamp(h.x, -COURT.HL + 1, COURT.HL - 1), h.z > 0 ? COURT.HW : -COURT.HW));
      } else if (dv > hv + 1.5) callFoul(d, h, false, 'Blocking foul');
    }
    function callFoul(d, sh, shooting, why) {
      if (phase !== 'live' && phase !== 'inb') return;
      const t = teams[d.side]; t.fq++; stat(d.sq).pf++;
      if (t.fq >= 5) t.bonus = true;
      const b = ball, shotInAir = b.st === 'air' && b.shot && b.shot.by === sh && !b.shot.ft;
      const isShoot = shooting || (sh.shotS && !sh.shotRel) || !!sh.fin || shotInAir;
      boardDirty = true;
      if (isShoot && shotInAir) { // fouled on the shot: if it goes in it counts plus one, else two or three shots
        b.shot.and1 = true; b.shot.fouled = { d, sh };
        whistle((why || 'Foul') + ' on ' + shortName(d.sq.name), 'Shooting foul');
        pendFT = { sh, d, pts: b.shot.pts };
        return;
      }
      whistle((why || 'Foul') + ' on ' + shortName(d.sq.name), isShoot ? 'Shooting foul · ' + (sh.shotS && sh.shotS.pts === 3 ? 3 : 2) + ' shots' : t.bonus ? 'Bonus · 2 shots' : (sh.side === 0 ? HOME.abbr : AWAY.abbr) + ' ball');
      const n = isShoot ? (sh.shotS && sh.shotS.pts === 3 ? 3 : 2) : t.bonus ? 2 : 0;
      sh.shotS = null; sh.fin = null; sh.shotRel = true; if (meterOn && sh === ctrl) meterHide();
      b.st = 'dead'; b.holder = null; b.shot = null; b.pass = null;
      if (n) setDead(1.2, () => startFT(sh, n));
      else setDead(1.0, () => startInbound(sh.side, clamp(sh.x, -COURT.HL + 1, COURT.HL - 1), sh.z >= 0 ? COURT.HW : -COURT.HW));
    }
    let pendFT = null;
    // F on defense: an intentional foul by your man (or the closest of yours to the ball)
    function intentionalFoul(p) {
      if (phase !== 'live') return false;
      const h = ball.holder; if (!h || h.side === p.side) return false;
      let f = p; if (D(p, h) > 2.0) { let bd = 99; for (const q of mates(p)) { const d = D(q, h); if (d < bd) { bd = d; f = q; } } }
      if (D(f, h) > 3) return false;
      setPose(f, 'steal'); callFoul(f, h, false, 'Foul');
      return true;
    }
    // ---------- whistles, dead balls, inbounds ----------
    function whistle(a, b2) { try { sfx.play('whistle'); } catch (e) {} banner(a, b2, '#ffc21a'); setTimeout(() => clearBanner(), 1600); clockRun = false; }
    function setDead(t, next) { phase = 'dead'; deadT = t; deadNext = next; clockRun = false; for (const p of onCourt) { p.shotS = null; p.fin = null; p.passT = null; p.dstance = false; p.face2 = null; } if (meterOn) meterHide(); }
    function changePoss(side, holder) {
      poss = side; shotClk = SHOT;
      for (const p of onCourt) { p.dstance = false; p.boxOut = false; }
      if (side === 0) { if (holder) setCtrl(holder); }
      else { if (!ctrl || ctrl.side !== 0 || ctrl.benched) setCtrl(nearestTo(teams[0].on, ball)); }
    }
    function nearestTo(list, o) { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < bd) { bd = d; b = p; } } return b; }
    function endPossession(why, scoredSide) {
      // a make: the other team takes it out under the basket the points went in
      const side = 1 - scoredSide, h = hoopOf(scoredSide);
      deadNext = null;
      setTimeout(() => {}, 0);
      phase = 'dead'; deadT = 1.1; clockRun = false;
      deadNext = () => startInbound(side, h.x + h.dir * 0.9, (rng() - 0.5) * 3, true);
      for (const p of onCourt) { p.shotS = null; p.fin = null; }
    }
    // the inbound: the passer out of bounds at the spot, his teammates get open, the pass in after a moment (or E)
    function startInbound(side, x, z, base) {
      phase = 'inb'; phaseT = 0; clockRun = false; poss = side;
      const t = teams[side], h = hoopOf(side), d = h.dir;
      // the spot: past the baseline (after a make) or past the sideline
      let ix = x, iz = z;
      if (base || Math.abs(x) > COURT.HL - 0.6) { ix = Math.sign(x || -d) * (COURT.HL + 0.55); iz = clamp(z, -COURT.keyW / 2 - 1.5, COURT.keyW / 2 + 1.5); if (Math.abs(iz) < COURT.keyW / 2 + 0.3) iz = Math.sign(iz || 1) * (COURT.keyW / 2 + 0.4); }
      else { iz = Math.sign(z || 1) * (COURT.HW + 0.55); ix = clamp(x, -COURT.HL + 1, COURT.HL - 1); }
      // the passer: the point guard after a make, else whoever is nearest
      const passer = base ? t.on[0] : nearestTo(t.on, { x: ix, z: iz });
      inb = { side, x: ix, z: iz, passer, t: 0, wait: 1.1 + rng() * 0.5 };
      passer.x = ix; passer.z = iz; passer.vx = passer.vz = 0; passer.face2 = Math.atan2(-ix * 0.3 - ix, -iz);
      setPose(passer, 'inbound');
      giveBall(passer, 'held');
      ball.st = 'held';
      shotClk = SHOT;
      if (side === 0) setCtrl(passer); else if (!ctrl || ctrl.side !== 0) setCtrl(teams[0].on[0]);
      for (const p of onCourt) { p.shotS = null; p.fin = null; p.dstance = false; p.boxOut = false; p.holdT = 0; }
    }
    function inbStep(dt) {
      const I = inb; if (!I) return;
      I.t += dt;
      const p = I.passer;
      p.x = I.x; p.z = I.z; p.vx = p.vz = 0; p.face2 = Math.atan2(-I.x * 0.25 - I.x * 0.1, -I.z);
      if (I.t > I.wait && (I.side === 1 || (DBG && DBG.auto) || I.t > 2.6 || I.go)) {
        // the most open teammate
        let best = null, bs = -1e9;
        for (const q of teams[I.side].on) { if (q === p) continue; let open = 9; for (const d of foes(q)) open = Math.min(open, D(d, q)); const s = open - D(q, p) * 0.15 + rng() * 0.3; if (s > bs) { bs = s; best = q; } }
        phase = 'live'; inb = null; clockRun = true;
        setPose(p, 'idle'); p.face2 = null; p.inbT = 1.2;
        startPass(p, best, 'chest'); p.passT = 0.05;
      }
    }
    // ---------- free throws ----------
    function startFT(sh, n) {
      phase = 'ft'; phaseT = 0; clockRun = false; poss = sh.side;
      const h = hoopOf(sh.side), d = h.dir;
      ftS = { sh, n, i: 0, side: sh.side, wait: 1.2, state: 'set' };
      const fx = d * COURT.ftX;
      sh.x = fx - d * 0.25; sh.z = 0; sh.vx = sh.vz = 0; sh.face2 = d > 0 ? Math.PI / 2 : -Math.PI / 2; sh.h = sh.face2;
      // the lane: two of each side on the blocks and marks, the rest behind the arc
      const lane = [[1.2, 1], [2.3, 1], [1.2, -1], [2.3, -1]];
      const others = onCourt.filter((p) => p !== sh);
      const defs = others.filter((p) => p.side !== sh.side), offs = others.filter((p) => p.side === sh.side);
      const place = (p, x, z) => { p.x = x; p.z = z; p.vx = p.vz = 0; p.face2 = Math.atan2(h.x - x, h.z - z); setPose(p, 'idle'); };
      place(defs[0], d * (COURT.HL - lane[0][0]), lane[0][1] * (COURT.keyW / 2 + 0.3)); place(defs[1], d * (COURT.HL - lane[2][0]), lane[2][1] * (COURT.keyW / 2 + 0.3));
      place(offs[0], d * (COURT.HL - lane[1][0]), lane[1][1] * (COURT.keyW / 2 + 0.3)); place(offs[1], d * (COURT.HL - lane[3][0]), lane[3][1] * (COURT.keyW / 2 + 0.3));
      const back = others.filter((p) => !(p === defs[0] || p === defs[1] || p === offs[0] || p === offs[1]));
      back.forEach((p, i) => place(p, d * (COURT.ftX - 3.2 - (i % 2) * 1.2), (i - 1.5) * 3.2));
      giveBall(sh, 'held'); setPose(sh, 'idle');
      if (sh.side === 0) setCtrl(sh);
      banner('FREE THROW' + (n > 1 ? 'S' : ''), shortName(sh.sq.name) + ' · ' + n + (n > 1 ? ' shots' : ' shot'), '#ffc21a'); setTimeout(() => clearBanner(), 1400);
    }
    function ftStep(dt) {
      const F = ftS; if (!F) return;
      const sh = F.sh, b = ball;
      if (F.state === 'set') {
        F.wait -= dt;
        if (b.holder !== sh) giveBall(sh, 'held');
        if (F.wait <= 0 && (sh.side === 1 || (DBG && DBG.auto) || F.press || F.wait < -4)) {
          F.state = 'shoot'; setPose(sh, 'ftshot'); sh.shotS = shotSetup(sh, true); sh.meter = 0; sh.shotA = 0; sh.shotRel = false; sh.jumped = true;
          sh.cpuRel = cpuTiming(sh);
          if (sh.side === 0 && isUser(sh)) meterShow(true);
        }
      } else if (F.state === 'shoot') {
        shotStep(sh, dt);
        if (sh.shotRel) { F.state = 'flight'; F.t = 0; }
      } else if (F.state === 'flight') {
        F.t += dt;
        const done = b.scored || (b.shot && b.st === 'loose' && (b.y < 1.2 || F.t > 2.2)) || F.t > 2.6 || b.st === 'dead';
        if (b.st === 'loose' && b.shot) b.shot.t += 0;
        if (done) {
          const made = !!b.scored; F.i++;
          if (!made) popAt(sh, 'MISS', '#c9ccd4');
          if (F.i < F.n) { b.scored = false; F.state = 'set'; F.wait = 0.8; giveBall(sh, 'held'); setPose(sh, 'idle'); return; }
          ftS = null;
          if (made) { b.scored = false; endPossession('ft', F.side); }
          else { phase = 'live'; clockRun = true; b.st = 'loose'; b.shot = { by: sh, side: F.side, pts: 1, ft: true, made: false, h: hoopOf(F.side), t: 3 }; } // a live rebound off the miss
        }
      }
    }
    // ---------- jump ball ----------
    function startTip() {
      phase = 'tip'; phaseT = 0; placeTip();
      const c0 = teams[0].on[4], c1 = teams[1].on[4];
      tipS = { c0, c1, t: 0, up: false, won: -1 };
      setCtrl(c0);
      banner('JUMP BALL', 'Space to jump', '#ffc21a'); setTimeout(() => clearBanner(), 1500);
    }
    function tipStep(dt) {
      const T = tipS; if (!T) return;
      T.t += dt;
      const b = ball;
      if (!T.up && T.t > 1.4) { T.up = true; b.st = 'loose'; b.holder = null; b.x = 0; b.y = 1.6; b.z = 0; b.vx = 0; b.vz = 0; b.vy = 7.2; b.lastSide = -1; try { sfx.play('whistle'); } catch (e) {} T.apex = T.t + b.vy / BALL_G; }
      if (!T.up) return;
      // the centres jump: the CPU on its timing; yours on Space (or his own timing if you don't)
      for (const c of [T.c0, T.c1]) {
        if (c.tipJ) continue;
        const want = T.apex - 0.42 + (c.side === 1 ? (rng() - 0.5) * (0.3 - DK * 0.15) : 0);
        if ((c.side === 1 || !isUser(c) || T.t > T.apex) && T.t >= want) tipJump(c);
      }
      if (T.won < 0 && b.y < 3.2 && b.vy < 0) {
        // whoever reaches it higher (jump timing, VERT, height) tips it back to a teammate
        const sc = (c) => (c.tipJ ? c.lk.hs * 2.7 + c.jumpY + rt(c, 'vert') * 0.004 - Math.abs((c.tipT || 0) - (T.apex - 0.42)) * 0.8 : 0) + rng() * 0.25;
        const w = sc(T.c0) >= sc(T.c1) ? T.c0 : T.c1;
        T.won = w.side; poss1 = w.side;
        const mate = teams[w.side].on[0], dx = mate.x - b.x, dz = mate.z - b.z, dl = Math.hypot(dx, dz) || 1;
        b.vx = dx / dl * 4.5; b.vz = dz / dl * 4.5; b.vy = 1.5; b.lastSide = w.side; b.last = w;
        phase = 'live'; tipS = null; clockRun = true; tLive = 0;
        say2(`<b>${esc(w.side === 0 ? HOME.name : AWAY.name)}</b> win the tip`);
      }
    }
    function tipJump(c) { if (c.tipJ) return; c.tipJ = true; c.tipT = tipS ? tipS.t : 0; setPose(c, 'tip'); c.jumpV = 4.4 + rt(c, 'vert') * 0.02; c.jumpY = 0.001; }
    // ---------- timeouts and subs ----------
    function canTimeout(side) { const t = teams[side]; return t.to > 0 && (phase === 'dead' || phase === 'inb' || phase === 'ft' || (phase === 'live' && poss === side && ball.holder && ball.holder.side === side)); }
    function callTimeout(side) {
      if (!canTimeout(side)) return false;
      const t = teams[side]; t.to--;
      const resume = phase === 'live' ? { k: 'inb', side: poss, x: ball.holder ? ball.holder.x : 0, z: ball.holder ? ball.holder.z : 0 } : phase === 'ft' ? { k: 'ft', F: ftS } : phase === 'inb' ? { k: 'inb', side: inb.side, x: inb.x, z: inb.z, base: Math.abs(inb.x) > COURT.HL } : { k: 'next', next: deadNext };
      toS = { side, resume, t: 0 };
      phase = 'timeout'; clockRun = false; if (meterOn) meterHide();
      try { sfx.play('horn'); } catch (e) {}
      banner('TIMEOUT', (side === 0 ? HOME.name : AWAY.name) + ' · ' + t.to + ' left', '#ffc21a'); setTimeout(() => clearBanner(), 1500);
      // the CPU uses its timeout to sub out its most tired starter
      if (side === 1) cpuSub();
      // both benches: during a timeout the other team can sub too (the CPU does when it has a tired man)
      if (side === 0) { cpuSub(); if (!(DBG && DBG.auto)) openSubs(); }
      return true;
    }
    function cpuSub() {
      const t = teams[1]; if (!t.bench.length) return;
      let worst = null; for (const p of t.on) if (!worst || p.sta < worst.sta) worst = p;
      if (worst && worst.sta < 0.55 && t.bench[0].sta > worst.sta + 0.2) doSub(1, worst, t.bench[0]);
    }
    function doSub(side, out, inn) {
      const t = teams[side], i = t.on.indexOf(out), j = t.bench.indexOf(inn); if (i < 0 || j < 0) return false;
      t.on[i] = inn; t.bench[j] = out;
      inn.x = out.x; inn.z = out.z; inn.h = out.h; inn.vx = inn.vz = 0; inn.benched = false; setPose(inn, 'idle');
      onCourt = teams[0].on.concat(teams[1].on);
      for (const tm of teams) tm.on.forEach((p, k) => { p.man = teams[1 - tm.side].on[k]; });
      if (ctrl === out) setCtrl(inn);
      placeBench();
      say2(`Sub: <b>${esc(shortName(inn.sq.name))}</b> in for <b>${esc(shortName(out.sq.name))}</b>`);
      return true;
    }
    function endTimeout() {
      if (phase !== 'timeout' || !toS) return;
      const R = toS.resume; toS = null; closeSubs();
      if (R.k === 'inb') startInbound(R.side, R.x, R.z, R.base);
      else if (R.k === 'ft' && R.F) { ftS = R.F; phase = 'ft'; ftS.state = 'set'; ftS.wait = 0.8; }
      else if (R.k === 'next' && R.next) { phase = 'dead'; deadT = 0.2; deadNext = R.next; }
      else startInbound(poss, 0, COURT.HW);
    }
    // ---------- quarters ----------
    function endQuarter() {
      clockRun = false; ball.shot = null;
      try { sfx.play('horn'); } catch (e) {}
      const tied = hs === as;
      if (qtr >= 4 && (!tied || !NOTIES)) { gameOver(); return; }
      const label = qtr === 2 ? 'HALFTIME' : qtr >= 4 ? 'END OF REGULATION' : 'END OF Q' + qtr;
      banner(label, `${esc(HOME.abbr)} ${hs} – ${as} ${esc(AWAY.abbr)}`, '#ffc21a');
      phase = 'break'; brk = { t: 2.6 }; for (const p of onCourt) { p.shotS = null; p.fin = null; } if (meterOn) meterHide();
      ball.st = 'dead'; ball.holder = null;
    }
    function nextQuarter() {
      clearBanner(); qtr++; clock = qtr > 4 ? Math.min(60, QS) : QS; teams[0].fq = teams[1].fq = 0; teams[0].bonus = teams[1].bonus = false; boardDirty = true;
      // alternating possession: the team that lost the tip starts the 2nd and 3rd, the winner the 4th (overtime: a jump ball)
      if (qtr > 4) { startTip(); return; }
      const side = qtr === 4 ? poss1 : 1 - poss1;
      startInbound(side, 0, COURT.HW);
      say2(qtr === 3 ? 'Second half: the teams switch ends' : 'Quarter ' + qtr);
    }
    let overT = 0;
    function gameOver() {
      phase = 'over'; overT = 0; clockRun = false; if (meterOn) meterHide();
      const won = hs > as;
      banner(won ? 'FINAL · YOU WIN' : hs === as ? 'FINAL · TIED' : 'FINAL', `${esc(HOME.abbr)} ${hs} – ${as} ${esc(AWAY.abbr)}`, won ? '#2bd46b' : '#ffc21a');
      for (const p of teams[won ? 0 : 1].on) { p.celType = (p.num % 4); setPose(p, 'celebrate'); }
      try { sfx.play(won ? 'win' : 'lose'); } catch (e) {}
      ball.st = 'dead'; ball.holder = null;
    }
    // ---------- control ----------
    function setCtrl(p) { if (!p || p.side !== 0 || p.benched) return; ctrl = p; }
    // =====================================================================================
    // The CPU (both teams, everyone you don't control): offense with spacing (five out, or four out and one in with a real
    // centre), drive and kick, passing to the open man, shot selection by ratings and level; defense man to man with help on
    // drives, contests, steals and boxing out; the rebound scramble; walking to spots at dead balls.
    // =====================================================================================
    // a spot in the frame of the basket a team attacks: u = yards out from the rim toward half court, v = across
    const atRim = (h, u, v) => [h.x - h.dir * u, v];
    const SPOTS5 = [[6.9, 0], [5.4, 4.9], [5.4, -4.9], [1.0, 6.6], [1.0, -6.6]];
    const SPOTS41 = [[6.9, 0], [5.0, 5.0], [5.0, -5.0], [1.2, -6.6], [1.5, 1.9]];
    function teamSpots(t) {
      const c = t.on[4], big = c && (rt(c, 'three') < 58 || rt(c, 'intD') > 70) ? 1 : 0;
      return big ? SPOTS41 : SPOTS5;
    }
    // how good a look this is for him, here and now (0..1-ish: points expected)
    function shotValue(p, x, z) {
      const h = hoopOf(p.side), d = rimDist(x, z, h), save = [p.x, p.z]; p.x = x; p.z = z;
      const c = contestOf(p, h); p.x = save[0]; p.z = save[1];
      const pts = isThree(x, z, h) ? 3 : 2;
      return basePct(p, d, false) * (1 - 0.55 * c) * pts;
    }
    function openness(q) { let o = 9; for (const d of foes(q)) o = Math.min(o, D(d, q)); return o; }
    function laneOpen(p, h) { // nobody standing in the line between him and the rim
      const ax = h.x - p.x, az = h.z - p.z, al = Math.hypot(ax, az) || 1;
      for (const d of foes(p)) { const t = ((d.x - p.x) * ax + (d.z - p.z) * az) / (al * al); if (t < 0.05 || t > 1.05) continue; const off = Math.hypot(d.x - (p.x + ax * t), d.z - (p.z + az * t)); if (off < 0.95 - t * 0.2) return false; }
      return true;
    }
    function bestPass(p, dirPref) {
      let best = null, bs = -1e9;
      for (const q of mates(p)) {
        if (q === p) continue;
        const dd = D(q, p); if (dd < 1.5 || dd > 15) continue;
        let s = openness(q) * 0.6 + shotValue(q, q.x, q.z) * 2 - dd * 0.05;
        // the lane: a defender near the line between them makes it a risk
        const ax = q.x - p.x, az = q.z - p.z, al = dd;
        for (const d of foes(p)) { const t = ((d.x - p.x) * ax + (d.z - p.z) * az) / (al * al); if (t < 0.1 || t > 0.95) continue; const off = Math.hypot(d.x - (p.x + ax * t), d.z - (p.z + az * t)); if (off < 0.8) s -= (0.8 - off) * 3; }
        if (dirPref) s += ((ax * dirPref[0] + az * dirPref[1]) / al) * 3;
        if (s > bs) { bs = s; best = q; }
      }
      return best;
    }
    // ---------- the ball handler ----------
    function handlerAI(p, dt) {
      const b = ball, h = hoopOf(p.side), d = rimDist(p.x, p.z, h), sk = p.side === 1 ? DK : 0.9;
      p.holdT += dt; p.think -= dt;
      if (p.shotS || p.fin || p.passT != null) { p.vx *= 0.9; p.vz *= 0.9; return; }
      if (b.st === 'held' && p.pose !== 'catch' && p.holdT > 0.25) startDribble(p);
      const open = openness(p), sv = shotValue(p, p.x, p.z);
      // the clock is running out: shoot it
      if (shotClk < 1.6 + (1 - sk) * 0.4 || (clock < 1.8 && qtr >= 4 && clockRun)) { if (startShot(p)) return; }
      // at the rim: finish
      if (d < 1.9 && p.holdT > 0.15) { if (startShot(p)) return; }
      if (p.think > 0) { moveHandler(p, dt, h, d); return; }
      p.think = 0.18 + rng() * 0.15;
      const drive = laneOpen(p, h) && d < 9 && d > 1.8 && (rt(p, 'fin') + rt(p, 'spd') + rt(p, 'dunk')) / 3 > 55 - sk * 6;
      const shootT = (p.side === 1 ? 0.62 - sk * 0.12 : 0.6) + (shotClk > 9 ? 0.12 : 0);
      if (open > 1.6 && sv > shootT && p.holdT > 0.45) { if (startShot(p)) return; }
      if (drive && rng() < 0.5 + sk * 0.2) { p.drive = 1.2; }
      // pass when he has held it a while, or a teammate has a much better look (drive and kick)
      const hold = p.holdT > 1.3 + rng() * 1.6, collapse = d < 4.5 && open < 1.1;
      if ((hold || collapse) && rng() < 0.75) { const q = bestPass(p); if (q && (shotValue(q, q.x, q.z) > sv * 0.95 || collapse || hold)) { startPass(p, q); return; } }
      // a move to beat his man (never spammed): sometimes a crossover, a hesitation, a spin
      const man = nearestTo(foes(p), p);
      if (man && D(man, p) < 1.5 && rng() < 0.14 + (rt(p, 'hand') - 60) * 0.004 && tLive - (p.cmbLast || -9) > 0.7) doMove(p);
      moveHandler(p, dt, h, d);
    }
    function moveHandler(p, dt, h, d) {
      const v = effV(p);
      if (p.hesiGo > 0) { p.hesiGo -= dt; if (p.hesiGo > 0) { p.vx *= 0.92; p.vz *= 0.92; return; } p.drive = Math.max(p.drive || 0, 0.8); }
      if (p.drive > 0) { p.drive -= dt; const t = atRim(h, 0.6, 0); steer(p, t[0], t[1], v * 1.15, dt); p.sprint = true; return; }
      // probe: work toward a spot on the wing / top, a step inside the arc for good shooters going back out
      if (!p.probe || p.probeT <= 0) { const a = (rng() - 0.5) * 2.4, r = rt(p, 'three') > 68 ? 6.8 : 5.4; p.probe = atRim(h, Math.cos(a) * r, Math.sin(a) * r); p.probeT = 1.2 + rng() * 1.5; }
      p.probeT -= dt;
      steer(p, p.probe[0], p.probe[1], v * 0.75, dt);
    }
    // ---------- off the ball, on offense ----------
    function offBallAI(p, dt) {
      const t = teams[p.side], h = hoopOf(p.side), i = t.on.indexOf(p), S = teamSpots(t)[i] || SPOTS5[0];
      let u = S[0], v = S[1];
      const hd = ball.holder;
      // a drive: shooters drift to the corners and the slot, the big dives
      if (hd && hd.side === p.side && hd.drive > 0) { if (u > 3) { u -= 1.3; v *= 1.12; } }
      // don't stand on top of the ball handler
      if (hd && hd !== p && hd.side === p.side) { const s = atRim(h, u, v); if (Math.hypot(s[0] - hd.x, s[1] - hd.z) < 2.4) { v += (v >= 0 ? 1 : -1) * 2.5; u += 0.8; } }
      // now and then a cut to the rim (back door when he is denied)
      p.aiT -= dt;
      if (p.aiT <= 0) { p.aiT = 2 + rng() * 3; p.cut = rng() < 0.18 && i !== 0 ? 1.3 : 0; p.jit = [(rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2]; }
      if (p.cut > 0) { p.cut -= dt; u = 1.2; v = v > 0 ? 0.8 : -0.8; }
      const s = atRim(h, u + (p.jit ? p.jit[0] : 0), clamp(v + (p.jit ? p.jit[1] : 0), -COURT.HW + 0.6, COURT.HW - 0.6));
      steer(p, s[0], s[1], effV(p) * (p.cut > 0 ? 1.1 : 0.8), dt);
      p.face2 = null; p.look = [ball.x, 1.4, ball.z];
    }
    // ---------- defense ----------
    function defenseAI(p, dt) {
      const own = ownHoop(p.side), man = p.man && onCourt.includes(p.man) ? p.man : nearestTo(foes(p), p);
      const b = ball, hd = b.holder;
      if (p.react > 0) { p.react -= dt; if (p.react <= 0) defReact(p); }
      p.dstance = false;
      if (!man) return;
      const rimx = own.x, rimz = own.z;
      let tx, tz, spd = effV(p);
      if (hd === man) {
        // on the ball: between him and the rim, a gap by his perimeter defense; face him
        const gap = 1.05 - rt(p, 'perD') * 0.003 - (p.side === 1 ? DK * 0.08 : 0) + (D(man, own) > 8 ? 0.6 : 0);
        const ax = rimx - man.x, az = rimz - man.z, al = Math.hypot(ax, az) || 1;
        tx = man.x + ax / al * gap; tz = man.z + az / al * gap;
        p.face2 = Math.atan2(man.x - p.x, man.z - p.z); p.dstance = D(p, man) < 2.4;
        // a steal try now and then (the better his hands and the level, the more often)
        if (D(p, man) < 1.2 && p.stealCd <= 0 && rng() < dt * (0.06 + rt(p, 'stl') * 0.0016 + (p.side ? DK : 0.3) * 0.08)) trySteal(p);
      } else {
        // off the ball: sag toward the rim and the ball (help), deny a man one pass away
        const bx = b.x, bz = b.z, dball = Math.hypot(man.x - bx, man.z - bz), sag = clamp(0.25 + dball * 0.03, 0.25, 0.5);
        tx = lerp(man.x, rimx, sag * 0.6) * 0.75 + lerp(man.x, bx, 0.25) * 0.25; tz = lerp(man.z, rimz, sag * 0.6) * 0.75 + lerp(man.z, bz, 0.25) * 0.25;
        // help: a drive at the rim pulls the nearest helper into the lane
        if (hd && hd.side !== p.side && rimDist(hd.x, hd.z, own) < 4 && helper(hd) === p) { tx = lerp(hd.x, rimx, 0.45); tz = lerp(hd.z, rimz, 0.45); spd *= 1.15; }
        p.face2 = Math.atan2(bx - p.x, bz - p.z);
        p.dstance = D(p, man) < 2.5 && dball < 7;
      }
      // the rebound: box out his man when a shot goes up, then go get it
      if (b.st === 'air' && b.shot && b.shot.side !== p.side) { const ax = rimx - man.x, az = rimz - man.z, al = Math.hypot(ax, az) || 1; tx = man.x + ax / al * 0.7; tz = man.z + az / al * 0.7; p.boxOut = true; p.dstance = false; }
      else p.boxOut = false;
      if (b.st === 'loose' || (b.st === 'air' && b.shot && (b.touchRim || b.vy < 0))) chaseBall(p, dt);
      else steer(p, tx, tz, spd, dt);
    }
    // the one helper on a drive: the closest defender who isn't guarding the ball
    function helper(hd) { let best = null, bd = 1e9; for (const d of foes(hd)) { if (d.man === hd) continue; const dd = D(d, hd); if (dd < bd) { bd = dd; best = d; } } return best; }
    // a defender's reaction to a shot going up: jump to contest (or block, with good timing and length)
    function defReact(p) {
      const sh = onCourt.find((q) => q.side !== p.side && ((q.shotS && !q.shotRel) || q.fin));
      if (!sh) return;
      const dd = D(p, sh); if (dd > 2.2 || p.jumpY > 0) return;
      const big = rt(p, 'blk') > 62 || (sh.fin && dd < 1.4);
      setPose(p, big ? 'block' : 'contest'); p.jumpV = 3.8 + rt(p, 'vert') * 0.022; p.jumpY = 0.001;
      const ax = sh.x - p.x, az = sh.z - p.z, al = Math.hypot(ax, az) || 1; p.vx = ax / al * Math.min(2.5, dd * 2); p.vz = az / al * Math.min(2.5, dd * 2);
      // a late, hard close-out can be a shooting foul
      if (dd < 0.75 && rng() < 0.1 + (p.side === 0 ? 0.04 : 0.02) - rt(p, 'perD') * 0.0008) setTimeout(() => { if (!finished && phase === 'live') callFoul(p, sh, true, 'Foul'); }, 140);
    }
    function chaseBall(p, dt) {
      const b = ball, d = Math.hypot(b.x - p.x, b.z - p.z);
      // where the ball comes down: aim a little ahead of it
      const lead = clamp(d / 6, 0, 0.5), tx = b.x + b.vx * lead, tz = b.z + b.vz * lead;
      steer(p, tx, tz, effV(p) * 1.1, dt); p.sprint = d > 3;
      p.face2 = null; p.look = [b.x, b.y, b.z];
      // jump for it when it comes down to him
      if (d < 1.0 && p.jumpY <= 0 && b.y > p.lk.hs * 2.2 && b.y < p.lk.hs * 2.8 + 0.9 && b.vy < 1 && p.pose !== 'rebound') { setPose(p, 'rebound'); p.jumpV = 3.6 + rt(p, 'vert') * 0.02 + rt(p, 'reb') * 0.008; p.jumpY = 0.001; }
    }
    // ---------- offense when a shot goes up: the bigs crash, a guard gets back ----------
    function crashAI(p, dt) {
      const t = teams[p.side], i = t.on.indexOf(p), own = ownHoop(p.side);
      if (i === 0 || (i === 1 && rt(p, 'reb') < 60)) { const s = [lerp(own.x, 0, 0.75), 0]; steer(p, s[0], s[1], effV(p), dt); return; }
      chaseBall(p, dt);
    }
    // ---------- per step: everyone the CPU runs ----------
    function aiStep(dt) {
      const b = ball;
      for (const p of onCourt) {
        if (isUser(p) || p.rag) continue;
        if (p.stealCd > 0) p.stealCd -= dt;
        if (p.stealHeat > 0) p.stealHeat = Math.max(0, p.stealHeat - dt * 0.8);
        if (p.cmbHeat > 0) p.cmbHeat = Math.max(0, p.cmbHeat - dt * 0.9);
        if (p.jumpY > 0.02 || p.land > 0) continue; // in the air: momentum only
        if (p.stumbleT > 0) { p.vx *= 0.9; p.vz *= 0.9; continue; }
        p.sprint = false;
        const offense = p.side === poss;
        if (b.holder === p) handlerAI(p, dt);
        else if (b.st === 'loose') chaseBall(p, dt);
        else if (b.st === 'air' && b.shot && !b.shot.ft) { if (offense) crashAI(p, dt); else defenseAI(p, dt); }
        else if (b.st === 'air' && b.pass && b.pass.to === p) { const P = b.pass, lt = Math.max(0, P.T - P.t); steer(p, b.x + b.vx * lt, b.z + b.vz * lt, effV(p) * 0.7, dt); p.face2 = Math.atan2(b.x - p.x, b.z - p.z); }
        else if (offense) offBallAI(p, dt);
        else defenseAI(p, dt);
        staminaStep(p, dt, p.sprint);
      }
    }
    // walking to spots at a dead ball / an inbound / free throws (no ball play)
    function resetStep(dt) {
      for (const p of onCourt) {
        if (isUser(p) && phase === 'inb' && inb && inb.passer !== p) { userMove(p, dt); continue; }
        if (p.jumpY > 0.02) continue;
        if (phase === 'ft' || (inb && inb.passer === p)) { p.vx *= 0.8; p.vz *= 0.8; continue; }
        const offense = p.side === poss;
        if (phase === 'inb') { if (offense) offBallAI(p, dt); else defenseAI(p, dt); continue; }
        // a dead ball: slow down, face the ball
        p.vx *= Math.pow(0.15, dt); p.vz *= Math.pow(0.15, dt); p.face2 = null; p.look = [ball.x, 1.2, ball.z];
      }
    }
    // =====================================================================================
    // Your player: WASD / the stick move him relative to the camera, Shift sprints; Space shoots (hold, release in the green) or
    // jumps to contest / block; E passes (to the open man, or the one you lean toward) or switches to the defender nearest the
    // ball; Q is the next combo move on offense and a steal on defense; F fouls; T calls a timeout. And step(), the game's tick.
    // =====================================================================================
    // the camera's own forward on the floor, and its right as the screen shows it (the view mirrors x: right = up x forward)
    function camBasis() { let fx = cam.c[0] - cam.e[0], fz = cam.c[2] - cam.e[2]; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l; return { fx, fz, rx: fz, rz: -fx }; }
    function userDir() {
      let ix, iz;
      if (input.stick && Math.hypot(input.stick[0], input.stick[1]) > 0.22) { ix = input.stick[0]; iz = input.stick[1]; }
      else { ix = input.r - input.l; iz = input.u - input.d; }
      if (!ix && !iz) return null;
      const l = Math.hypot(ix, iz), k = Math.min(1, l), B = camBasis();
      ix /= l; iz /= l;
      return [(B.fx * iz + B.rx * ix) * k, (B.fz * iz + B.rz * ix) * k];
    }
    function userMove(p, dt) {
      const d = userDir();
      staminaStep(p, dt, input.sprint && !!d);
      if (p.jumpY > 0.02 || p.land > 0 || p.shotS || p.fin || p.passT != null) { if (!p.fin) { p.vx *= 0.92; p.vz *= 0.92; } return; }
      if (p.stumbleT > 0) { p.vx *= 0.9; p.vz *= 0.9; return; }
      const v = effV(p);
      // on defense he squares up to the ball (a slide when moving sideways); on offense he runs where you point
      const def = p.side !== poss;
      if (def && ball.holder && D(p, ball.holder) < 3) { p.face2 = Math.atan2(ball.holder.x - p.x, ball.holder.z - p.z); p.dstance = true; } else { p.face2 = null; p.dstance = false; }
      if (d) { steerDir(p, d[0], d[1], v, dt); if (ball.holder === p && ball.st === 'held' && p.pose !== 'catch' && phase === 'live') startDribble(p); }
      else { p.vx *= Math.pow(0.0005, dt); p.vz *= Math.pow(0.0005, dt); }
    }
    // ---------- actions (keyboard, touch buttons and the debug hook all come here) ----------
    function actShootDown() {
      if (finished) return;
      if (phase === 'ft' && ftS && ftS.sh === ctrl && ftS.state === 'set') { ftS.press = true; ftS.wait = Math.min(ftS.wait, 0); return; }
      if (phase === 'tip' && tipS && tipS.up && ctrl === tipS.c0) { tipJump(ctrl); return; }
      if (phase === 'inb' && inb && inb.side === 0) { inb.go = true; return; }
      if (phase !== 'live' || !ctrl) return;
      if (ball.holder === ctrl) { input.shoot = true; startShot(ctrl); return; }
      // defense (or off the ball): jump to contest or block
      if (ctrl.jumpY > 0.02 || ctrl.land > 0) return;
      const near = ball.holder && ball.holder.side !== 0 ? D(ctrl, ball.holder) : 9, flying = ball.st === 'air' && ball.shot;
      setPose(ctrl, ball.st === 'loose' || (flying && ball.shot.t > 0.4) ? 'rebound' : near < 1.5 || flying ? 'block' : 'contest');
      ctrl.jumpV = 3.9 + rt(ctrl, 'vert') * 0.022; ctrl.jumpY = 0.001; ctrl.blkDone = false;
    }
    function actShootUp() {
      input.shoot = false;
      if (!ctrl) return;
      if (ctrl.shotS && !ctrl.shotRel) releaseShot(ctrl);
    }
    function actPass() {
      if (finished || !ctrl) return;
      if (phase === 'inb' && inb && inb.side === 0) { inb.go = true; return; }
      if (phase !== 'live') return;
      if (ball.holder === ctrl) { const d = userDir(); const q = bestPass(ctrl, d); if (q) startPass(ctrl, q); return; }
      if (poss === 0 && ball.holder && ball.holder.side === 0) { // call for it: the handler passes to you
        if (ball.holder !== ctrl && !ball.holder.shotS && !ball.holder.fin) startPass(ball.holder, ctrl);
        return;
      }
      // defense: the defender nearest the ball
      let best = null, bd = 1e9; for (const p of teams[0].on) { if (p === ctrl) continue; const d = Math.hypot(p.x - ball.x, p.z - ball.z); if (d < bd) { bd = d; best = p; } }
      if (best) { setCtrl(best); try { sfx.play('tap'); } catch (e) {} }
    }
    function actMove() {
      if (finished || !ctrl || phase !== 'live') return;
      if (ball.holder === ctrl) doMove(ctrl);
      else if (ball.holder && ball.holder.side === 1) trySteal(ctrl);
      else if (ball.st === 'air' && ball.pass) { setPose(ctrl, 'steal'); }
    }
    function actFoul() { if (!finished && ctrl && phase === 'live' && poss === 1 && !intentionalFoul(ctrl)) say2('Get closer to the ball handler to foul'); }
    function actTimeout() { if (finished) return; if (phase === 'timeout') { endTimeout(); return; } if (!callTimeout(0)) say2(teams[0].to ? 'Timeout: only on a dead ball or with the ball in your hands' : 'No timeouts left'); }
    // ---------- the tick ----------
    function step(dt) {
      phaseT += dt;
      if (excite > 0) excite = Math.max(0, excite - dt * 0.12);
      if (tableT > 0) { tableT -= dt; if (tableT <= 0) { tableMsg = ''; tableDirty = true; } }
      for (const h of HOOP) h.shake = Math.max(0, h.shake - dt * 2.2);
      if (DBG && DBG.bot) { try { DBG.bot(api, dt); } catch (e) { DBG.bot = null; console.error(e); } }
      if (phase === 'splash' || phase === 'box') return;
      if (phase === 'live') {
        tLive += dt;
        if (clockRun) {
          const c0 = clock; clock = Math.max(0, clock - dt); if (Math.ceil(c0) !== Math.ceil(clock) || clock < 10) boardDirty = true;
          if (ball.holder || ball.st === 'drib') { shotClk = Math.max(0, shotClk - dt); }
          else if (ball.st === 'air' && ball.pass) shotClk = Math.max(0, shotClk - dt);
        }
        // the shot clock: a violation when it runs out with the ball in hand (a shot in the air plays on)
        if (shotClk <= 0 && ball.holder && clock > 0) { const s = ball.holder.side; stat(ball.holder.sq).to++; whistle('Shot clock', 'Violation · ' + (s ? HOME.abbr : AWAY.abbr) + ' ball'); ball.holder = null; ball.st = 'dead'; setDead(1.0, () => startInbound(1 - s, 0, COURT.HW)); }
        // the quarter ends: a shot already in the air still counts
        if (clock <= 0 && phase === 'live' && !(ball.st === 'air' && ball.shot && !ball.shot.ft) && !(ball.holder && ball.holder.fin)) { endQuarter(); }
        if (ball.shot) ball.shot.t += dt;
        // a fouled shot that misses: to the line for two (or three)
        if (pendFT && ball.shot && !ball.scored && (ball.touchRim || ball.y < 1.3 || ball.st === 'loose')) { const f = pendFT; pendFT = null; ball.st = 'dead'; setDead(1.1, () => startFT(f.sh, f.pts)); }
        if (ctrl && isUser(ctrl)) userMove(ctrl, dt);
        if (phase === 'live') aiStep(dt);
        for (const p of onCourt) { if (p.inbT > 0) p.inbT -= dt; shotStep(p, dt); finStep(p, dt); passStep(p, dt); if (p.jumpY > 0.1 && !p.blkDone && p.side !== poss) { if (tryBlock(p)) p.blkDone = true; } }
        if (phase === 'live') { passFlight(dt); grabStep(); }
        // stepping out with the ball
        const hd = ball.holder; if (hd && phase === 'live' && !hd.fin && hd.passT == null && !(hd.inbT > 0) && (Math.abs(hd.x) > COURT.HL + 0.05 || Math.abs(hd.z) > COURT.HW + 0.05)) { stat(hd.sq).to++; outOfBounds(hd.side, hd.x, hd.z); }
        // a loose ball rolling dead: whoever is nearest just picks it up
        if (ball.st === 'loose' && ball.quietT > 1.2) { const p = nearestTo(onCourt, ball); if (p) { giveBall(p, 'held'); if (p.side !== poss) changePoss(p.side, p); else if (p.side === 0) setCtrl(p); } }
      } else if (phase === 'tip') { tipStep(dt); }
      else if (phase === 'dead') { resetStep(dt); deadT -= dt; if (deadT <= 0) { const f = deadNext; deadNext = null; if (f) f(); else startInbound(poss, 0, COURT.HW); } }
      else if (phase === 'inb') { resetStep(dt); inbStep(dt); }
      else if (phase === 'ft') { resetStep(dt); ftStep(dt); }
      else if (phase === 'timeout') { if (DBG && DBG.auto) { toS && (toS.t += dt); if (toS && toS.t > 0.5) endTimeout(); } }
      else if (phase === 'break') { brk.t -= dt; if (brk.t <= 0) nextQuarter(); }
      else if (phase === 'over') { overT += dt; if (overT > 3.2 && !boxShown) showBox(); }
      // a CPU timeout: on a run against it, at a dead ball
      if (phase === 'dead' && teams[1].to > 0 && deadT < 0.5 && deadT > 0.4 && lastBig && lastBig.side === 0 && hs - as > 6 && rng() < 0.08) callTimeout(1);
      for (const p of everyone) { if (p.benched) continue; integrate(p, dt); }
      if (phase === 'live' || phase === 'tip') collide();
      ballStep(dt);
    }

    // ---------- camera & projection ----------
    const VP = new Float32Array(16), PREV_VP = new Float32Array(16); let INV = new Float32Array(16), PROJ = new Float32Array(16), VIEW = new Float32Array(16), INVP = new Float32Array(16);
    const CASC = [new Float32Array(16), new Float32Array(16), new Float32Array(16)];
    let wave = 0, camF = [0, 0, 1], expo = SKY.exp, camSpeed = 0, replayCam = 0;
    const HFOV = 64; // horizontal field of view (degrees) at 16:9 -> about a 32 mm lens; the old framing was authored for 86, so offsets stretch by LENSK
    const LENSK = Math.tan((86 * Math.PI) / 360) / Math.tan((HFOV * Math.PI) / 360);
    const op = { t: 0, x: 0, y: 0 }; // operator imperfection
    // the 2K drone camera: floating behind and above the ball (the man with it, or yours), looking down the floor at the basket
    // being attacked; it swings round smoothly when the ball changes hands. Free throws from behind the shooter, the tip from the
    // side, wide orbits for the splash, timeouts, breaks and the final.
    const drone = { yaw: Math.PI / 2, k: 0 };
    function updateCam(dt) {
      let e, c, rate = 3.0, cdk = 1;
      const b = ball || { x: 0, y: 1, z: 0 };
      replayCam = 0;
      if (phase === 'splash' || phase === 'box' || phase === 'timeout' || phase === 'break' || phase === 'over') {
        const t = performance.now() / 1000 * 0.06 + 1.2;
        e = [Math.sin(t) * 13, 6.2 + 2.5 * por, Math.cos(t) * 9 + 3]; c = [0, 1.2, 0]; rate = 1.5;
      } else if (phase === 'tip') {
        e = [0, 5.2 + 2 * por, -11.5 - 3 * por]; c = [0, 2.2, 0]; rate = 2.5;
      } else if (phase === 'ft' && ftS) {
        const s = ftS.sh, h = hoopOf(s.side), d = h.dir;
        e = [s.x - d * (6.2 + 2 * por), 4.0 + 1.5 * por, s.z * 0.5]; c = [h.x - d * 1.5, 2.6, h.z]; rate = 3;
      } else {
        // the subject: the ball (where it is going when it flies), else your man
        const subj = b.holder ? b.holder : b.st === 'air' && b.shot ? b.shot.h : b.st === 'loose' || b.st === 'air' ? b : ctrl || b;
        const sx = subj.x != null ? subj.x : 0, sz = subj.z != null ? subj.z : 0;
        const side = b.holder ? b.holder.side : poss, att = hoopOf(side);
        // the drone's heading: mostly straight down the floor at the basket, turned a little toward the ball's side of the court
        const ax = att.x - sx, az = att.z - sz, want = Math.atan2(ax * 0.6 + att.dir * 4, az * 0.6);
        if (dt < 0) drone.yaw = want; else drone.yaw += angDiff(want, drone.yaw) * Math.min(1, dt * 1.6);
        const fx = Math.sin(drone.yaw), fz = Math.cos(drone.yaw), dAtt = Math.hypot(ax, az);
        const back = 7.0 + 2.2 * por + 1.6 * lnd - clamp((8 - dAtt) * 0.2, 0, 1.2), hgt = 4.1 + 2.0 * por + 1.1 * lnd;
        const fcx = sx + fx * Math.min(2.6, dAtt * 0.35), fcz = sz + fz * Math.min(2.6, dAtt * 0.35);
        e = [sx - fx * back, hgt, sz - fz * back * 0.92]; c = [fcx, 0.7, fcz]; // the ball handler sits about two thirds down the screen, the rim near the top
        if (!b.holder && b.st === 'air' && b.shot && subj === b.shot.h) c[1] = 2.3; // a shot in the air: frame the rim and the arc, not the floor under it
        rate = phase === 'live' ? 3.2 : 2.4;
      }
      gymKeepOut(e);
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
      const fovy = (clamp(2 * Math.atan(Math.tan((hf * Math.PI) / 360) / asp), 0.5, 1.12 + 0.2 * por)) * (1 + cam.kick * 0.09);
      const f = 1 / Math.tan(fovy / 2), n = 0.3, fa = 160; // the spread Metcalf map reaches MET_K times as far
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
      const spec = [[cam.c, 9 + 3 * por], [mid, 20], [[0, 0, 4], 30]]; // the gym: tight cascades on the court
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
    const DIRTC = [0.3, 0.3, 0.3];
    function playerUniforms(P, p) {
      const C = p.side === 2 ? REFC : p.side ? DEFC : OFFC, lk = p.lk, skin = (p.rhH && p.rhE && p.rhE.skin) || lk.tone || SKIN[lk.skin];
      const iris = lk.skin >= 3 ? [0.22, 0.12, 0.05] : lk.skin === 2 ? [0.3, 0.18, 0.07] : lk.eyes || [0.28, 0.2, 0.1];
      // SL order: jer pant skin helm trim cleat pad mask num face arm name glove sock sole visor snum wht eye tape towel stripes
      const cols = [C.jer, C.pant, skin, C.helm, C.stripe, lk.cleat, C.pad, C.mask, C.num, skin, lk.sleeves ? C.jer : skin, WHITEC, C.glove, C.sock, lk.cleat === CLEATS.white ? DARKC : WHITEC, VISORC, C.num, WHITEC, iris, WHITEC, lum(C.pant) > 0.6 ? C.jer : WHITEC, WHITEC, lk.mouthC || C.jer];
      cols.push(WHITEC, WHITEC); if (p.cas) casCols(cols, p, C, skin);
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
      gl.uniform1f(P.u.uVis, p.lk.visor ? 1 : 0); gl.uniform1f(P.u.uTowel, p.towel ? 1 : 0); gl.uniform1f(P.u.uMouth, 0);
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
        const mesh = meshForP(p)[d < (quality === 0 ? 9 : LOD_D) && !depthOnly ? 0 : 1];
        const rh = rhLevel(p, d, depthOnly); // his own scanned head in place of the drawn one (22-heads.js)
        if (rh >= 0) gl.uniform1f(P.u.uHead, 1);
        if (mesh !== cur) { cur = mesh; bindMesh(P, mesh); }
        if (!depthOnly && p.side !== curSide) { curSide = p.side; gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, p.side === 2 ? G.kitR : p.side ? G.kitD : G.kitO); gl.activeTexture(gl.TEXTURE0); }
        skinCommon(P, p, mesh);
        if (!depthOnly) playerUniforms(P, p);
        if (mesh.vin) { gl.drawElements(gl.TRIANGLES, mesh.vi0, gl.UNSIGNED_SHORT, 0); gl.drawElements(gl.TRIANGLES, mesh.n - mesh.vi0 - mesh.vin, gl.UNSIGNED_SHORT, (mesh.vi0 + mesh.vin) * 2); DRAWS.n += 2; }
        else { gl.drawElements(gl.TRIANGLES, mesh.n, gl.UNSIGNED_SHORT, 0); DRAWS.n++; }
        DRAWS.tris += mesh.n / 3;
        if (rh >= 0) { rhDraw(P, p.rhH, rh); gl.uniform1f(P.u.uHead, 0); cur = null; if (!depthOnly) gl.bindTexture(gl.TEXTURE_2D, G.atlas); }
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
      gl.uniformMatrix4fv(W.u.uModel, false, MFL.on ? MFL.M : MFL.I); // the statics: Metcalf's world turned when the ends are swapped (12-venue.js)
      for (const s of statics) {
        gl.bindTexture(gl.TEXTURE_2D, s.tex); worldMat(W, s.mat, DBG && DBG.shadowView ? 9 : s.kind);
        gl.uniform1f(W.u.uFlipV, 0);
        gl.uniform2f(W.u.uUV, 0, 0);
        if (s.k === 'glass') { gl.enable(gl.BLEND); }
        if (s.blend) { gl.enable(gl.BLEND); gl.depthMask(false); } // see-through venue layers (the schoolyard's picket veil)
        bindWorldAttribs(W, s.b); gl.drawArrays(gl.TRIANGLES, 0, s.n); DRAWS.n++; DRAWS.tris += s.n / 3;
        if (s.k === 'glass') gl.disable(gl.BLEND);
        if (s.blend) { gl.disable(gl.BLEND); gl.depthMask(true); }
      }
      gl.uniformMatrix4fv(W.u.uModel, false, MFL.I);
      disableAll(W);
      // crowd
      { const P = G.crowd; gl.useProgram(P.pr); gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniform1f(P.u.uTime, now); gl.uniform1f(P.u.uExcite, excite); gl.uniform1f(P.u.uWave, wave); gl.uniform1f(P.u.uMood, crowdMood); gl.uniform3f(P.u.uEye, cam.e[0], cam.e[1], cam.e[2]); gl.uniform3f(P.u.uCamF, camF[0], camF[1], camF[2]); gl.uniform3f(P.u.uFogR, SKY.fogR[0], SKY.fogR[1], SKY.fogR[2]); gl.uniform3f(P.u.uFog, SKY.fog[0], SKY.fog[1], SKY.fog[2]);
        const dim = 0.62; gl.uniform1f(P.u.uDim, dim); gl.uniform3f(P.u.uTint, SKY.amb[0] * 2.2 + 0.25, SKY.amb[1] * 2.2 + 0.25, SKY.amb[2] * 2.2 + 0.25);
        gl.uniform1i(P.u.uTex, 0); gl.bindTexture(gl.TEXTURE_2D, G.crowdT);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.crowdB); gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP, 3, gl.FLOAT, false, 48, 0); gl.enableVertexAttribArray(P.a.aC); gl.vertexAttribPointer(P.a.aC, 3, gl.FLOAT, false, 48, 12); gl.enableVertexAttribArray(P.a.aM); gl.vertexAttribPointer(P.a.aM, 4, gl.FLOAT, false, 48, 24); gl.enableVertexAttribArray(P.a.aT); gl.vertexAttribPointer(P.a.aT, 2, gl.FLOAT, false, 48, 40);
        gl.drawArrays(gl.TRIANGLES, 0, G.crowdN); DRAWS.n++; DRAWS.tris += G.crowdN / 3; disableAll(P); }
      if (forEnv) return;
      // athletes, sideline figures
      if (showPlayers) { const S = quality >= 2 ? G.skinHi : G.skin; setLitUniforms(S); gl.bindTexture(gl.TEXTURE_2D, G.atlas); drawPlayers(S, false, everyone); drawFxShells(S, everyone, now); }
      // dynamic lit geometry (ball, chains, confetti) then transparent markers
      setLitUniforms(W); gl.uniform2f(W.u.uUV, 0, 0); gl.uniform1f(W.u.uFlipV, 0); worldMat(W, [0.5, 0, 0, 0], 0); gl.bindTexture(gl.TEXTURE_2D, G.white);
      if (dyn.n) { bindWorldAttribs(W, G.dyn, dyn.f.subarray(0, dyn.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); DRAWS.n++; DRAWS.tris += dyn.n / 3; }
      gl.enable(gl.BLEND);
      if (tr.n) { gl.depthMask(false); worldMat(W, [0.5, 0, 0, 0], 0); bindWorldAttribs(W, G.tr, tr.f.subarray(0, tr.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, tr.n); gl.depthMask(true); DRAWS.n++; }
      if (showPlayers) drawFxParts(W);
      disableAll(W);
    }
    let feedOn = false;
    const flareBuf = new Float32Array(16);
    function render(dt) {
      if (glLost || !G || finished) return;
      const t0 = performance.now();
      DRAWS.n = 0; DRAWS.tris = 0;
      updateCam(dt);
      const now = performance.now() / 1000;
      crowdMood += ((lastBig && lastBig.side === 1 && tLive - lastBig.t < 4 ? -0.6 : 0) - crowdMood) * Math.min(1, dt * 0.8);
      // pose everyone for this frame
      for (const p of everyone) animUpdate(p, Math.max(0, dt));
      dyn.n = 0; tr.n = 0;
      const showPlayers = phase !== 'box';
      if (ball && showPlayers) drawBallNow(now);
      drawHoops(Math.max(0, Math.min(dt, 0.05)));
      drawMarks(now);
      try { fxStep(Math.max(0, Math.min(dt, 0.1)), now); } catch (e) { if (!stepErrLogged) { stepErrLogged = true; console.error('dunk3d: fx error', e); } }
      if (showPlayers) contactBlobs();
      if (boardDirty && ((now * 4) | 0) % 2 === 0) { boardDirty = false; try { gymBoardCanvas(); gl.bindTexture(gl.TEXTURE_2D, G.board); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, boardC); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }
      if (tableDirty) { tableDirty = false; try { gymTableCanvas(); gl.bindTexture(gl.TEXTURE_2D, G.table); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tableC); gl.generateMipmap(gl.TEXTURE_2D); } catch (e) {} }
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
          const P = G.depthW; gl.useProgram(P.pr); gl.uniformMatrix4fv(P.u.uLVP, false, CASC[ci]); gl.uniformMatrix4fv(P.u.uModel, false, MFL.on ? MFL.M : MFL.I);
          for (const s of statics) if (s.cast && (ci > 0 || s.k === 'plain' || s.c0) && !(quality === 0 && s.k === 'seats')) { bindWorldAttribs(P, s.b); gl.drawArrays(gl.TRIANGLES, 0, s.n); DRAWS.n++; }
          gl.uniformMatrix4fv(P.u.uModel, false, MFL.I);
          if (dyn.n) { bindWorldAttribs(P, G.dyn, dyn.f.subarray(0, dyn.n * 12)); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); DRAWS.n++; }
          disableAll(P);
          if (ci < 2) { const S = G.depthS; gl.useProgram(S.pr); gl.uniformMatrix4fv(S.u.uLVP, false, CASC[ci]); if (showPlayers) drawPlayers(S, true, everyone); }
        }
        gl.colorMask(true, true, true, true);
        gl.enable(gl.BLEND);
      }
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
        const dofK = replayCam > 0 ? 0.9 * replayCam : 0, mbK = quality >= 2 && camSpeed > 4 && phase === 'live' ? clamp((camSpeed - 4) / 12, 0, 1) * 0.5 : 0;
        if (G.scene2 && G.scene.dt && (dofK > 0 || mbK > 0)) {
          const P = G.dofmb; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, G.scene2.fb); gl.viewport(0, 0, cv.width, cv.height);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.scene.dt); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.scene.tex);
          gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uDepth, 1); gl.uniform2f(P.u.uPx, 1 / cv.width, 1 / cv.height); gl.uniformMatrix4fv(P.u.uInvVP, false, INV); gl.uniformMatrix4fv(P.u.uPrevVP, false, PREV_VP);
          gl.uniform1f(P.u.uMB, mbK); const fd = Math.hypot(cam.c[0] - cam.e[0], cam.c[1] - cam.e[1], cam.c[2] - cam.e[2]); gl.uniform3f(P.u.uDof, fd, dofK, 0); gl.uniform2f(P.u.uNF, 0.3, 160); // the projection's own far plane (the big Metcalf map reaches MET_K times as far)
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
        if (false) for (let i = 0; i < 4; i++) { const t = TOWERS[i], s = projNDC(t[0] + (t[0] < 0 ? 3.5 : -3.5), t[1] - 2.5, t[2]); if (s && Math.abs(s[0]) < 1.3 && Math.abs(s[1]) < 1.3) { flareBuf[i * 4] = s[0] * 0.5 + 0.5; flareBuf[i * 4 + 1] = s[1] * 0.5 + 0.5; flareBuf[i * 4 + 2] = 0.35; flareBuf[i * 4 + 3] = s[2] * 0.5 + 0.5; nfl++; } else { flareBuf[i * 4 + 2] = 0; } }
        const P = G.final; gl.useProgram(P.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, quality >= 1 && G.bloomA ? G.bloomA.tex : G.black);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, aoTex || G.white);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, G.scene.dt || G.white);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(P.u.uTex, 0); gl.uniform1i(P.u.uBloom, 1); gl.uniform1i(P.u.uAO, 2); gl.uniform1i(P.u.uDepth, 3); gl.uniform2f(P.u.uPx, 1 / cv.width, 1 / cv.height);
        gl.uniform1f(P.u.uBloomK, quality >= 1 && G.bloomA ? 0.32 : 0); gl.uniform1f(P.u.uFxaa, 1); gl.uniform1f(P.u.uVig, 0.42); gl.uniform1f(P.u.uKick, cam.kick * 0.12);
        gl.uniform1f(P.u.uExp, expo); gl.uniform1f(P.u.uAOk, aoTex ? 0.85 : 0); gl.uniform4fv(P.u.uFl, flareBuf); gl.uniform1f(P.u.uFlK, nfl ? 0.9 : 0); gl.uniform1f(P.u.uTime, now); gl.uniform1f(P.u.uLDR, G.scene.hdr ? 0 : 1); gl.uniform1f(P.u.uAsp, cv.width / cv.height);
        quadDraw(P);
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      }
      updTags();
      perf.rend += performance.now() - t0; perf.n++;
    }
    // ---------- the ball: an orange sphere with its black seams, turning with its spin ----------
    const SEAMC = [0.06, 0.04, 0.03, 1];
    function drawBallNow() {
      const b = ball; if (!b) return;
      const m = b.rot.slice(); m[3] = b.x; m[7] = b.y; m[11] = b.z;
      dyn.ellipsoid(m, BALL_R, BALL_R, BALL_R, BALLC, 16, 10);
      const r = BALL_R * 1.012, seg = 18;
      const circ = (fn) => { let pa = null; for (let i = 0; i <= seg; i++) { const a = (i / seg) * 6.2832, q = fn(a), w = mPt(m, q[0] * r, q[1] * r, q[2] * r); if (pa) dyn.tube(pa, w, 0.0055, SEAMC, 4); pa = w; } };
      circ((a) => [Math.cos(a), Math.sin(a), 0]); circ((a) => [0, Math.sin(a), Math.cos(a)]);
      for (const s of [-1, 1]) circ((a) => { const x = Math.cos(a) * 0.62, y = Math.sin(a) * 0.62, z = s * Math.sqrt(Math.max(0, 1 - x * x - y * y)); return [x, y, z]; });
      // its shadow on the floor (soft, under the lights)
      tr.blob(b.x, b.z, BALL_R * (1.2 + b.y * 0.25), clamp(0.5 - b.y * 0.1, 0.08, 0.5), 0.012, 10);
    }
    // ---------- the rims (they shake on a dunk and on hard misses) and the nets (a little cloth: 12 strands, the ball pushes them) ----------
    const RIMC = [0.92, 0.34, 0.08, 1], NETC = [0.95, 0.95, 0.93, 1], NS = 12, NR = 5;
    function netInit(h) {
      const n = { P: new Float32Array(NS * NR * 3), O: new Float32Array(NS * NR * 3), rest: [] };
      for (let r = 0; r < NR; r++) for (let k = 0; k < NS; k++) {
        const a = ((k + (r % 2) * 0.5) / NS) * 6.2832, rad = lerp(RIM_R * 0.96, RIM_R * 0.52, r / (NR - 1)), i = (r * NS + k) * 3;
        n.P[i] = h.x + Math.cos(a) * rad; n.P[i + 1] = h.y - r * 0.115; n.P[i + 2] = h.z + Math.sin(a) * rad;
      }
      n.O.set(n.P);
      const L = [];
      for (let r = 0; r < NR - 1; r++) for (let k = 0; k < NS; k++) { const a = r * NS + k, k2 = r % 2 ? (k + 1) % NS : (k + NS - 1) % NS; L.push([a, (r + 1) * NS + k], [a, (r + 1) * NS + k2]); }
      for (const [a, c] of L) n.rest.push([a, c, Math.hypot(n.P[a * 3] - n.P[c * 3], n.P[a * 3 + 1] - n.P[c * 3 + 1], n.P[a * 3 + 2] - n.P[c * 3 + 2])]);
      h.net = n;
    }
    function drawHoops(dt) {
      const b = ball, t = performance.now() / 1000;
      for (const h of HOOP) {
        if (!h.net) netInit(h);
        const sk = h.shake, dy = -0.035 * sk * Math.abs(Math.sin(t * 38)) - 0.05 * sk * sk, cy = h.y + dy;
        // the ring: a torus of tube segments, the back of it bolted to the bracket
        let pa = null;
        for (let i = 0; i <= 24; i++) { const a = (i / 24) * 6.2832, w = [h.x + Math.cos(a) * RIM_C, cy + Math.max(0, -Math.cos(a) * h.dir) * dy * 0.5, h.z + Math.sin(a) * RIM_C]; if (pa) dyn.tube(pa, w, RIM_T * 1.25, RIMC, 6); pa = w; }
        // the net: verlet, the top row on the ring
        const n = h.net, P = n.P, O = n.O;
        if (dt > 0) {
          const steps = 2, d = dt / steps;
          for (let s = 0; s < steps; s++) {
            for (let i = NS; i < NS * NR; i++) { const o = i * 3; for (let k = 0; k < 3; k++) { const v = (P[o + k] - O[o + k]) * 0.94; O[o + k] = P[o + k]; P[o + k] += v + (k === 1 ? -7 * d * d : 0); } }
            for (let k = 0; k < NS; k++) { const a = (k / NS) * 6.2832, o = k * 3; P[o] = h.x + Math.cos(a) * RIM_R * 0.96; P[o + 1] = cy - 0.01; P[o + 2] = h.z + Math.sin(a) * RIM_R * 0.96; O[o] = P[o]; O[o + 1] = P[o + 1]; O[o + 2] = P[o + 2]; }
            for (let it = 0; it < 3; it++) for (const [a, c, rl] of n.rest) {
              const ia = a * 3, ic = c * 3, dx = P[ic] - P[ia], dy2 = P[ic + 1] - P[ia + 1], dz = P[ic + 2] - P[ia + 2], dl = Math.hypot(dx, dy2, dz) || 1e-6, e = (dl - rl) / dl * 0.5;
              if (a >= NS) { P[ia] += dx * e; P[ia + 1] += dy2 * e; P[ia + 2] += dz * e; } else { P[ic] -= dx * e; P[ic + 1] -= dy2 * e; P[ic + 2] -= dz * e; }
              if (a >= NS) { P[ic] -= dx * e; P[ic + 1] -= dy2 * e; P[ic + 2] -= dz * e; }
            }
            // the ball pushes the strands out of its way (a swish whips the net)
            if (b && Math.abs(b.x - h.x) < 0.6 && b.y < h.y + 0.2 && b.y > h.y - 0.7) for (let i = NS; i < NS * NR; i++) { const o = i * 3, dx = P[o] - b.x, dy2 = P[o + 1] - b.y, dz = P[o + 2] - b.z, dl = Math.hypot(dx, dy2, dz), rr = BALL_R + 0.012; if (dl < rr && dl > 1e-6) { const k = (rr - dl) / dl; P[o] += dx * k; P[o + 1] += dy2 * k; P[o + 2] += dz * k; } }
          }
        }
        for (const [a, c] of n.rest) dyn.tube([P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]], 0.0045, NETC, 3);
      }
    }
    // ---------- floor markers: your man's ring (2K's player indicator), the pass target, the shot's landing on a miss ----------
    function drawMarks() {
      if (phase === 'splash' || phase === 'box' || phase === 'over') return;
      if (ctrl && !ctrl.benched) { const col = poss === 0 ? [0.2, 0.85, 1, 0.9] : [1, 0.78, 0.15, 0.9]; tr.ring(ctrl.x, ctrl.z, 0.42, 0.5, col, 0.014, 22); tr.ring(ctrl.x, ctrl.z, 0.5, 0.53, [col[0], col[1], col[2], 0.35], 0.014, 22); }
    }
    // ---------- DOM over the 3D: your man's name tag and the shot meter beside him ----------
    const ctag = el('div', 'dk-ptag hide', '');
    tagL.appendChild(ctag);
    function updTags() {
      const p = ctrl;
      if (!p || phase === 'splash' || phase === 'box' || phase === 'timeout' || phase === 'over' || phase === 'break') { ctag.classList.add('hide'); }
      else {
        const s = project(p.x, 2.62 * p.lk.hs + p.jumpY + 0.25, p.z);
        if (s && s[0] > -20 && s[0] < cssW + 20 && s[1] > 20) {
          if (ctag.dataset.k !== p.key) { ctag.dataset.k = p.key; ctag.innerHTML = `<b>${esc(String(p.num))}</b>${esc(shortName(p.sq.name))}`; }
          ctag.classList.remove('hide'); ctag.style.left = s[0].toFixed(1) + 'px'; ctag.style.top = s[1].toFixed(1) + 'px';
        } else ctag.classList.add('hide');
      }
      updMeter();
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
      // Season 1
      's1-ttime': { e: ['streak'] }, 's1-23': { l: 'metal', c: '#e0f2fe', e: ['sparkle:silver'] }, 's1-cars': { e: ['streak', 'flame'], o: '#38bdf8' },
      's1-chem': { e: ['teamspark', 'sparkle:gold'] }, 's1-onehand': { e: ['glove', 'sparkle:holo'], o: '#7dd3fc' }, 's1-tabaka': { l: 'prism', e: ['sparkle:holo'], o: '#c084fc' },
      's1-bbmode': { l: 'muscle', e: ['dust'], o: '#38bdf8' }, 's1-shoot': { e: ['flash', 'star'], o: '#fff6c2' }, 's1-fullext': { p: 'halo', l: 'prism', e: ['star', 'sparkle:holo'], o: '#7dd3fc' },
      's1-cover': { e: ['flash', 'sparkle:gold'], o: '#ffd23f' }, 's1-bigboy': { p: 'crown', l: 'metal', c: '#7dd3fc', e: ['star', 'sparkle:holo'], o: '#7dd3fc' },
    };
    const PAR_K = { base: 0.55, silver: 0.75, gold: 0.95, prism: 1.2, black: 1.45 };
    const RAR_K = { common: 0.55, rare: 0.75, epic: 0.95, legendary: 1.2, mythic: 1.45, dark: 1.5, zenith: 1.65, doh: 1.8 };
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
    const fxpb = new Batch(2000);
    function lathe(prof, segs, c, y0, mod, ox, oz) { // revolve [[r, y], ...] around a vertical axis at (ox, oz)
      for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < segs; j++) {
        const a0 = j / segs * 6.2832, a1 = (j + 1) / segs * 6.2832, [r0, y0a] = prof[i], [r1, y1] = prof[i + 1];
        const m0 = mod ? mod(a0) : 1, m1 = mod ? mod(a1) : 1, ny = -(r1 - r0), nr = y1 - y0a, nl = Math.hypot(ny, nr) || 1;
        const P = (r, y, a, m) => [(ox || 0) + Math.cos(a) * r * m, y + (y0 || 0), (oz || 0) + Math.sin(a) * r * m], N = (a) => [Math.cos(a) * nr / nl, ny / nl, Math.sin(a) * nr / nl];
        const A = P(r0, y0a, a0, m0), Bq = P(r0, y0a, a1, m1), Cq = P(r1, y1, a1, m1), D = P(r1, y1, a0, m0), na = N(a0), nb = N(a1);
        for (const [v, n] of [[A, na], [D, na], [Cq, nb], [A, na], [Cq, nb], [Bq, nb]]) fxpb.v(v[0], v[1], v[2], n[0], n[1], n[2], c, 0.5, 0.5);
      }
    }
    const ell = (x, y, z, rx, ry, rz, c, s) => fxpb.ellipsoid(mT(IDM, x, y, z), rx, ry, rz, c, s || 8, 6);
    const bx = (x, y, z, sx, sy, sz, c, ry, rx, rz) => { let m = mT(IDM, x, y, z); if (ry) m = mRY(m, ry); if (rx) m = mRX(m, rx); if (rz) m = mRZ(m, rz); fxpb.box(m, 0, 0, 0, sx, sy, sz, c); };
    function torus(R, r, c, y, segs) { for (let j = 0; j < segs; j++) { const a = j / segs * 6.2832; ell(Math.cos(a) * R, y, Math.sin(a) * R, r, r, r, c, 5); } }
    function prism3(pts, h, c, y) { // a flat triangle slab (x,z points) of thickness h
      const top = pts.map((p) => [p[0], y + h, p[1]]), bot = pts.map((p) => [p[0], y, p[1]]);
      fxpb.quad(top[0], top[1], top[2], top[2], [0, 1, 0], c); fxpb.quad(bot[0], bot[2], bot[1], bot[1], [0, -1, 0], c);
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3, ex = top[j][0] - top[i][0], ez = top[j][2] - top[i][2], l = Math.hypot(ex, ez) || 1; fxpb.quad(bot[i], bot[j], top[j], top[i], [ez / l, 0, -ex / l], c); }
    }
    function star5(R, r, th, c, y, upright) {
      const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 + Math.PI / 2, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      for (let i = 0; i < 10; i++) { const p = pts[i], q = pts[(i + 1) % 10]; const T = (a) => (upright ? [a[0], y + a[1] + R, 0] : [a[0], y, a[1]]); const o = T([0, 0]), A = T(p), Bq = T(q), f = upright ? [0, 0, th] : [0, th, 0];
        fxpb.quad(v3a(o, f), v3a(A, f), v3a(Bq, f), v3a(Bq, f), upright ? [0, 0, 1] : [0, 1, 0], c); fxpb.quad(o, Bq, A, A, upright ? [0, 0, -1] : [0, -1, 0], c); }
    }
    // tilt everything built since n0 about the X axis (props that should face the camera)
    function tilt(n0, a) { const c = Math.cos(a), sn = Math.sin(a), f = fxpb.f; for (let i = n0; i < fxpb.n; i++) { const o = i * 12; for (const k of [0, 3]) { const y = f[o + k + 1], z = f[o + k + 2]; f[o + k + 1] = y * c - z * sn; f[o + k + 2] = y * sn + z * c; } f[o + 1] += 0.06; } }
    const COLS = { gold: [1, 0.78, 0.2, 1], red: [0.85, 0.12, 0.1, 1], white: [0.95, 0.95, 0.92, 1], black: [0.06, 0.06, 0.07, 1], yellow: [1, 0.86, 0.15, 1], orange: [1, 0.48, 0.08, 1], green: [0.15, 0.6, 0.2, 1], brown: [0.45, 0.26, 0.12, 1], pink: [1, 0.55, 0.75, 1], blue: [0.2, 0.45, 0.95, 1], cream: [1, 0.93, 0.7, 1], gem: [0.2, 0.5, 1, 1] };
    const SHAPES = {
      pizza: () => { const n0 = fxpb.n; prism3([[-0.15, -0.07], [0.15, -0.07], [0, 0.24]], 0.025, COLS.yellow, 0.005); bx(0, 0.025, -0.075, 0.32, 0.045, 0.05, COLS.brown); for (const [x, z] of [[-0.03, 0.0], [0.035, 0.03], [0, 0.08]]) lathe([[0.034, 0.03], [0.034, 0.035], [0, 0.035]], 8, COLS.red, 0, null, x * 1.35, z * 1.35); tilt(n0, -1.1); }, // a slice stuck on the helmet like a fin: point up, toppings to the back (the game camera sits behind)
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
      hair: () => { const cs = [COLS.pink, COLS.blue, COLS.green, COLS.yellow, COLS.orange]; for (let i = 0; i < 10; i++) { const a = i * 0.63; const m = mRX(mRY(mT(IDM, Math.cos(a) * 0.07, 0.0, Math.sin(a) * 0.07), a), 0.5 * Math.cos(i)); fxpb.box(m, 0, 0.08, 0, 0.025, 0.17, 0.025, cs[i % 5]); } },
      cloud: () => { for (const [x, y, r] of [[0, 0.32, 0.08], [0.08, 0.3, 0.065], [-0.08, 0.3, 0.065], [0.03, 0.37, 0.06]]) ell(x, y, 0, r, r * 0.8, r, [0.8, 0.82, 0.88, 1], 7); },
      sun: () => { ell(0, 0.14, 0, 0.07, 0.07, 0.07, [1.6, 1.2, 0.3, 1], 8); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; bx(Math.cos(a) * 0.11, 0.14 + Math.sin(a) * 0.11, 0, 0.05, 0.016, 0.016, [1.6, 1.0, 0.2, 1], 0, 0, a); } },
      smoothie: () => { lathe([[0.045, 0], [0.06, 0.16], [0, 0.16]], 10, [0.65, 0.95, 0.3, 1]); lathe([[0.062, 0.16], [0.062, 0.175], [0, 0.175]], 10, COLS.white); bx(0.02, 0.23, 0, 0.012, 0.12, 0.012, COLS.pink, 0, 0.25); },
    };
    function propShape(name) {
      if (PROPS[name]) return PROPS[name];
      fxpb.n = 0; try { SHAPES[name](); } catch (e) { fxpb.n = 0; }
      return (PROPS[name] = fxpb.f.slice(0, fxpb.n * 12));
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
      let r = fxRecipe(p.fx); p.fxAcc = null;
      // the card's overall scales its look: an 80s card a little stronger than its rarity, a 90+ superstar gold-rimmed with gold
      // sparkle, 95+ brighter still, a 99 a white-gold rim with stars coming off him
      const st = p.star || 0;
      if (st) {
        r = r || { k: 0.6 };
        r.e = (r.e || []).slice();
        if (r.e.indexOf('sparkle:gold') < 0) r.e.push('sparkle:gold');
        if (st >= 3 && r.e.indexOf('star') < 0) r.e.push('star');
        if (!r.o || st >= 3) r.o = st >= 3 ? '#fff4c8' : '#ffd23f';
      }
      p.fxr = r;
      if (!r) return;
      p.fxK = clamp(r.k * (p.ovr ? 0.8 + clamp((p.ovr - 75) / 24, 0, 1) * 0.45 : 1) + [0, 0.15, 0.3, 0.5][st], 0.4, 2.2);
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
        if (r.p) { const bob = p.fxBob || 1; emitProp(r.p, hm, 0, ((p.cas ? p.cas.top : 0.35) + (r.p === 'halo' ? 0.04 : 0)) * hs * bob, -0.01 * hs, hs * bob * (1.1 + 0.3 * Math.min(K, 1.4))); }
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
        const d = Math.hypot(p.x - cam.e[0], p.z - cam.e[2]), mesh = meshForP(p)[d < LOD_D ? 0 : 1];
        if (mesh !== cur) { cur = mesh; bindMesh(P, mesh); }
        skinCommon(P, p, mesh); playerUniforms(P, p);
        const c = C3(r.o), k = clamp(0.35 + 0.35 * (p.fxK || 0.6), 0.3, 1.0) * (0.85 + 0.15 * Math.sin(now * 4 + p.ph));
        gl.uniform4f(P.u.uFx, 20, k, 0, 0); gl.uniform3f(P.u.uFxC, c[0], c[1], c[2]); gl.uniform4f(P.u.uFxV, 0.022, 0, 0, 0);
        const rh = rhLevel(p, d, false);
        if (rh >= 0) gl.uniform1f(P.u.uHead, 1);
        gl.drawElements(gl.TRIANGLES, mesh.vi0, gl.UNSIGNED_SHORT, 0); DRAWS.n++;
        if (rh >= 0) { rhDraw(P, p.rhH, rh); gl.uniform1f(P.u.uHead, 0); cur = null; gl.bindTexture(gl.TEXTURE_2D, G.atlas); }
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
    // =====================================================================================
    // The HUD: the score bug (score, quarter, clock, shot clock, fouls, timeouts), the shot meter beside your player, banners,
    // pops and the ticker; the controls (keyboard hints on a computer, the joystick and buttons on a phone); the sub screen at a
    // timeout; the box score at the end.
    // =====================================================================================
    const SVG_FS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>';
    const SVG_X = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3l10 10M13 3L3 13"/></svg>';
    const SVG_SND = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h3l4-3v10l-4-3H2z"/><path d="M11 5c1.2 1.5 1.2 4.5 0 6" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
    bug.innerHTML = `<div class="dk-sb"><div class="dk-tm" data-t="h" style="--c:${HOMECSS}"><b>${esc(HOME.abbr)}</b><em>0</em><i></i><s></s></div><div class="dk-tm" data-t="a" style="--c:${OPPCSS}"><b>${esc(AWAY.abbr)}</b><em>0</em><i></i><s></s></div><div class="dk-clk"><b>${fmtClock(QS)}</b><span>Q1</span></div><div class="dk-pc">${SHOT}</div><div class="dk-fl"><span>FOULS</span><b>0</b><b>0</b></div></div><div class="dk-sp"></div>`;
    const bH = bug.querySelector('[data-t=h]'), bA = bug.querySelector('[data-t=a]'), bClk = bug.querySelector('.dk-clk'), bPc = bug.querySelector('.dk-pc'), bFl = bug.querySelectorAll('.dk-fl b');
    const mkIB = (html, title) => { const b = el('button', 'dk-ib', html); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); bug.appendChild(b); return b; };
    const QN = ['LOW', 'MED', 'HIGH'], qBtn = mkIB('<span class="dk-q">' + QN[quality] + '</span>', 'Graphics quality'), sndBtn = mkIB(SVG_SND, 'Sound'), fsBtn = mkIB(SVG_FS, 'Full screen'), quitBtn = mkIB(SVG_X, 'Quit game');
    qBtn.addEventListener('click', () => { setQuality((quality + 1) % 3); qBtn.innerHTML = '<span class="dk-q">' + QN[quality] + '</span>'; sfx.play('tap'); });
    function showQuality() { qBtn.innerHTML = '<span class="dk-q">' + QN[quality] + '</span>'; }
    sndBtn.addEventListener('click', () => { sfx.mute(!sfx.muted); sndBtn.style.opacity = sfx.muted ? 0.4 : 1; });
    if (!fsOK || fixedMode) fsBtn.style.display = 'none';
    fsBtn.addEventListener('click', toggleFS);
    let quitArm = 0;
    quitBtn.addEventListener('click', () => {
      if (finished) return;
      if (!quitArm) { quitArm = 1; quitBtn.textContent = 'QUIT?'; quitBtn.classList.add('sure'); setTimeout(() => { quitArm = 0; quitBtn.innerHTML = SVG_X; quitBtn.classList.remove('sure'); }, 2400); return; }
      finishGame(true);
    });
    let bugCache = '';
    function updBug() {
      const key = [hs, as, qtr, phase === 'live' && clock < 10 ? clock.toFixed(1) : Math.ceil(clock), Math.ceil(shotClk), teams[0].to, teams[1].to, teams[0].fq, teams[1].fq, poss, clockRun].join('|');
      if (key === bugCache) return; bugCache = key;
      bH.querySelector('em').textContent = hs; bA.querySelector('em').textContent = as;
      bH.classList.toggle('pos', poss === 0); bA.classList.toggle('pos', poss === 1);
      bH.querySelector('s').innerHTML = Array.from({ length: TOS }, (_, i) => `<u class="${i < teams[0].to ? '' : 'off'}"></u>`).join('');
      bA.querySelector('s').innerHTML = Array.from({ length: TOS }, (_, i) => `<u class="${i < teams[1].to ? '' : 'off'}"></u>`).join('');
      bClk.querySelector('b').textContent = fmtClock(clock); bClk.querySelector('span').textContent = qtr > 4 ? (qtr > 5 ? 'OT' + (qtr - 4) : 'OT') : 'Q' + qtr;
      bClk.classList.toggle('run', clockRun && phase === 'live');
      bPc.textContent = Math.ceil(shotClk); bPc.classList.toggle('low', shotClk <= 5);
      bFl[0].textContent = teams[0].fq; bFl[1].textContent = teams[1].fq; bFl[0].classList.toggle('bonus', teams[1].fq >= 5); bFl[1].classList.toggle('bonus', teams[0].fq >= 5);
    }
    // ---------- banners, pops, the ticker ----------
    function pop(txt, col, x, y) {
      const e = el('div', 'dk-pop', esc(txt)); e.style.color = col || '#ffc21a';
      e.style.left = (x == null ? cssW / 2 : x) + 'px'; e.style.top = (y == null ? cssH * 0.55 : y) + 'px';
      fx.appendChild(e); setTimeout(() => e.remove(), (DBG && DBG.popHold) || 1150);
    }
    function popAt(p, txt, col) { const s = p ? project(p.x, 2.4 * p.lk.hs, p.z) : null; pop(txt, col, s ? s[0] : null, s ? s[1] : null); }
    function banner(txt, sub, col) {
      fx.querySelectorAll('.dk-banner').forEach((b) => b.remove());
      const b = el('div', 'dk-banner', `<b style="color:${col || '#ffc21a'}">${txt}</b>${sub ? `<i>${sub}</i>` : ''}`);
      fx.appendChild(b); return b;
    }
    const clearBanner = () => fx.querySelectorAll('.dk-banner').forEach((b) => b.remove());
    let tickT = 0;
    function say(html) {
      if (!html) return;
      tick.innerHTML = html; tick.classList.add('on');
      tick.style.top = (bug.offsetHeight + 2) + 'px';
      clearTimeout(tickT); tickT = setTimeout(() => tick.classList.remove('on'), 3600);
    }
    // ---------- the shot meter: a bar beside your player; the green window, the marker; GREEN / EARLY / LATE when you let go ----------
    const meterEl = el('div', 'dk-smeter hide', '<u></u><i></i><em></em>');
    fx.appendChild(meterEl);
    let meterOn = false, meterHoldT = 0, meterLast = 0;
    function meterShow() { meterOn = true; meterHoldT = 0; meterEl.className = 'dk-smeter'; meterEl.querySelector('em').textContent = ''; }
    function meterHide() { meterOn = false; meterEl.className = 'dk-smeter hide'; }
    function meterResult(green, off, S) {
      const em = meterEl.querySelector('em');
      em.textContent = green ? 'GREEN' : off < 0 ? 'EARLY' : 'LATE'; meterEl.classList.add(green ? 'g' : 'r');
      meterHoldT = 0.9;
      if (green) try { sfx.play('good'); } catch (e) {}
    }
    function updMeter() {
      if (!meterOn) return;
      const p = ctrl, S = p && (p.shotS || p.lastS);
      if (p && p.shotS) p.lastS = p.shotS;
      if (!p || (!p.shotS && meterHoldT <= 0)) { meterHide(); return; }
      const nowM = performance.now() / 1000, dtM = Math.min(0.1, nowM - (meterLast || nowM)); meterLast = nowM;
      if (!p.shotS) meterHoldT -= dtM;
      const s = project(p.x, 1.6 * p.lk.hs + p.jumpY, p.z);
      if (s) { meterEl.style.left = (s[0] + 34).toFixed(1) + 'px'; meterEl.style.top = s[1].toFixed(1) + 'px'; }
      if (S) {
        const u = meterEl.querySelector('u'), i = meterEl.querySelector('i');
        u.style.bottom = ((S.gc - S.w / 2) * 100 / 1.12).toFixed(1) + '%'; u.style.height = (S.w * 100 / 1.12).toFixed(1) + '%';
        i.style.height = (Math.min(1.12, p.meter || 0) * 100 / 1.12).toFixed(1) + '%';
      }
    }
    // ---------- controls ----------
    let ctlKey = '';
    const K = (s) => (touchy ? '' : `<kbd>${s}</kbd>`);
    function btn(cls, html, fn, up) {
      const b = el('button', 'dk-btn ' + (cls || ''), html); b.type = 'button';
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (er) {} fn(e); });
      if (up) { const u = (e) => { up(e); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('lostpointercapture', u); }
      return b;
    }
    function msg(h) { const m = el('div', 'dk-msg', h); ctl.appendChild(m); return m; }
    function setControls(force) {
      const off = ball && ball.holder === ctrl && ctrl, defn = poss === 1;
      const key = [phase, !!off, defn, teams[0].to, phase === 'ft' && ftS ? ftS.sh.side : '', phase === 'inb' && inb ? inb.side : ''].join('|');
      if (key === ctlKey && !force) return;
      ctlKey = key; ctl.innerHTML = '';
      if (phase === 'splash' || phase === 'box') return;
      const to = btn('dk-to' + (canTimeout(0) ? '' : ' off'), `T/O<small>${teams[0].to} left</small>${K('T')}`, () => actTimeout());
      if (phase === 'timeout') { ctl.appendChild(btn('dk-y dk-wide', 'Resume<small>back to the game</small>' + K('T'), () => endTimeout())); return; }
      if (phase === 'over' || phase === 'break') { msg(`<span>${esc(HOME.abbr)} <b>${hs}</b> – <b>${as}</b> ${esc(AWAY.abbr)}</span>`); return; }
      if (!touchy) {
        msg(defn ? '<span><b>WASD</b> slide · <b>SPACE</b> jump / block · <b>Q</b> steal · <b>E</b> switch · <b>F</b> foul · <b>SHIFT</b> sprint</span>'
          : off ? '<span><b>WASD</b> move · hold <b>SPACE</b>, let go in the green · <b>E</b> pass · <b>Q</b> combo moves · <b>SHIFT</b> sprint</span>'
          : phase === 'ft' ? '<span>Free throw: hold <b>SPACE</b>, let go in the green</span>' : '<span><b>WASD</b> move · <b>E</b> call for the ball · <b>SPACE</b> jump · <b>SHIFT</b> sprint</span>');
        ctl.appendChild(to); return;
      }
      // the phone: a cluster of round buttons under the right thumb (the left thumb drags anywhere on the floor for the joystick)
      const g = el('div', 'dk-pad');
      const add = (cls, html, fn, up) => { const b = btn(cls, html, fn, up); g.appendChild(b); return b; };
      if (phase === 'ft') { add('dk-g dk-big', 'SHOOT<small>hold</small>', () => actShootDown(), () => actShootUp()); }
      else if (defn) {
        add('dk-g dk-big', 'BLOCK', () => actShootDown(), () => actShootUp());
        add('', 'SWITCH', () => actPass()); add('dk-r', 'STEAL', () => actMove()); add('', 'FOUL', () => actFoul());
      } else {
        add('dk-g dk-big', 'SHOOT<small>hold</small>', () => actShootDown(), () => actShootUp());
        add('', off ? 'PASS' : 'CALL', () => actPass()); add('dk-r', 'MOVE', () => actMove());
      }
      const sp = add('dk-sprint', 'SPRINT', () => { input.sprint = true; }, () => { input.sprint = false; });
      void sp;
      ctl.appendChild(to); ctl.appendChild(g);
    }
    // ---------- the sub screen (a timeout): tap a starter, then the sixth man, to swap them ----------
    const subsEl = el('div', 'dk-subs hide', ''); wrap.appendChild(subsEl);
    let subPick = null;
    function openSubs() { subPick = null; drawSubs(); subsEl.classList.remove('hide'); }
    function closeSubs() { subsEl.classList.add('hide'); }
    function drawSubs() {
      const t = teams[0], row = (p, bench) => `<button type="button" class="dk-sbp${subPick === p ? ' sel' : ''}${bench ? ' bench' : ''}" data-k="${p.key}">${faceHTML(p.sq)}<span><b>#${p.num} ${esc(shortName(p.sq.name))}</b><small>${p.sq.pos} · ${p.ovr} OVR</small></span><u><i style="width:${Math.round(p.sta * 100)}%"></i></u></button>`;
      subsEl.innerHTML = `<h3>Timeout · Subs</h3><p>Tap a starter, then your sixth man, to swap them. Energy comes back on the bench.</p><div class="dk-sbl">${t.on.map((p) => row(p, false)).join('')}</div><h4>Bench</h4><div class="dk-sbl">${t.bench.map((p) => row(p, true)).join('')}</div><button type="button" class="dk-go dk-resume">RESUME</button>`;
    }
    subsEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    subsEl.addEventListener('click', (e) => {
      const r = e.target.closest('.dk-resume'); if (r) { endTimeout(); return; }
      const b = e.target.closest('.dk-sbp'); if (!b) return;
      const p = everyone.find((q) => q.key === b.dataset.k); if (!p) return;
      const t = teams[0];
      if (!subPick) subPick = p;
      else if (subPick === p) subPick = null;
      else { const a = subPick, onA = t.on.includes(a), onP = t.on.includes(p); if (onA !== onP) doSub(0, onA ? a : p, onA ? p : a); subPick = null; }
      sfx.play('tap'); drawSubs();
    });
    // ---------- the box score ----------
    let boxShown = false;
    function showBox() {
      boxShown = true; phase = 'box'; clearBanner();
      const won = hs > as, line = (p) => { const s = stat(p.sq); return `<tr><td>${faceHTML(p.sq)} ${esc(shortName(p.sq.name))}</td><td>${s.pts}</td><td>${s.fgm}-${s.fga}</td><td>${s.tpm}-${s.tpa}</td><td>${s.ftm}-${s.fta}</td><td>${s.reb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.blk}</td><td>${s.to}</td></tr>`; };
      const tbl = (t) => `<table><tr><th>${esc(t.T.name)}</th><th>PTS</th><th>FG</th><th>3PT</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th></tr>${t.on.concat(t.bench).map(line).join('')}</table>`;
      const box = el('div', 'dk-box', `<h2>${won ? 'You win!' : hs === as ? 'Tied' : 'Final'}</h2><div class="fs"><span style="color:${HOMECSS}">${esc(HOME.abbr)}</span>${hs} – ${as}<span style="color:${OPPCSS}">${esc(AWAY.abbr)}</span></div><h3>Box score</h3>${tbl(teams[0])}${tbl(teams[1])}${HL.length ? '<h3>Highlights</h3>' + HL.slice(-8).map((h) => `<div class="hl">Q${h.q} · ${esc(h.txt)}</div>`).join('') : ''}<button type="button" class="go">CONTINUE</button>`);
      wrap.appendChild(box);
      box.querySelector('.go').addEventListener('click', () => finishGame(false));
      setControls(true);
    }
    // ---------- loop (from 3D Blitz: fixed substeps of at most 1/60 s, one render per frame, adaptive quality) ----------
    let raf = 0, last = 0, running = false, ftAvg = 1 / 60, ftT = 0, qDropped = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const el2 = Math.min(0.2, Math.max(0, (now - last) / 1000)); last = now;
      const mul = (DBG && DBG.speed) || 1;
      let sim = el2 * mul, n = 0, rdt = el2 * mul;
      if (DBG && DBG.stepT) { sim = DBG.stepT; rdt = Math.min(DBG.stepT, 0.1); DBG.stepT = 0; } else if (DBG && DBG.speed === 0) { sim = 0; rdt = 0; }
      const ts = performance.now();
      while (sim > 1e-6 && n < 2400 && !finished) { const d = Math.min(sim, 1 / 60); step(d); sim -= d; n++; }
      perf.sim += performance.now() - ts;
      if (finished) return;
      try { render(Math.min(rdt, 0.1)); } catch (err) { if (!stepErrLogged) { stepErrLogged = true; try { console.error('dunk3d: render error', err); } catch (e2) {} } }
      updBug();
      if (((now / 250) | 0) !== (((now - el2 * 1000) / 250) | 0)) { sfx.crowd(phase === 'splash' || phase === 'box' ? 0.05 : 0.14 + excite * 0.55); setControls(false); }
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
    const onVis = () => { resetPtr(); if (document.hidden) stopLoop(); else { startLoop(); sfx.wake(); setTimeout(() => sfx.wake(), 400); } };
    const onWake = () => sfx.wake();
    window.addEventListener('pageshow', onWake); window.addEventListener('focus', onWake); window.addEventListener('pointerdown', onWake, { capture: true, passive: true }); window.addEventListener('touchend', onWake, { capture: true, passive: true });
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
      if (e.target && e.target.closest && e.target.closest('.dk-splash,.dk-subs,.dk-box')) return;
      if (e.type === 'touchmove' && !aligned()) return;
      e.preventDefault();
    };
    wrap.addEventListener('touchmove', noScroll, { passive: false });
    wrap.addEventListener('gesturestart', noScroll, { passive: false });
    wrap.addEventListener('touchstart', (e) => { if (touchy && !finished && !aligned() && !(e.target && e.target.closest && e.target.closest('.dk-splash,.dk-subs,.dk-box'))) scrollIn(); }, { passive: true });
    wrap.addEventListener('dblclick', (e) => e.preventDefault());
    wrap.addEventListener('contextmenu', (e) => { if (!finished) e.preventDefault(); });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLost = true; });
    cv.addEventListener('webglcontextrestored', () => {
      if (finished) return;
      try { for (const n of ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'ANGLE_instanced_arrays', 'WEBGL_depth_texture', 'WEBKIT_WEBGL_depth_texture', 'OES_standard_derivatives', 'OES_texture_half_float', 'OES_texture_half_float_linear']) gl.getExtension(n); } catch (e) {}
      try { const a = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic'); X.aniso = a; X.maxAniso = a ? gl.getParameter(a.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0; } catch (e) { X.aniso = null; X.maxAniso = 0; }
      glLost = false;
      try { setupGL(); for (const h of HOOP) h.net = null; } catch (e) { glLost = true; }
    });
    // ---------- keyboard: WASD / arrows move (relative to the camera), SPACE shoot (hold) or jump, E pass / switch, Q moves / steal,
    // F foul, T timeout, SHIFT sprint ----------
    const KEYS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
    function onKey(e) {
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (finished) return;
      const down = e.type === 'keydown', k = e.code;
      if (KEYS[k]) { input[KEYS[k]] = down ? 1 : 0; if (phase !== 'splash' && phase !== 'box') e.preventDefault(); return; }
      if (k === 'ShiftLeft' || k === 'ShiftRight') { input.sprint = down; return; }
      if (phase === 'splash') { if (down && (k === 'Space' || k === 'Enter')) { e.preventDefault(); begin(); } return; }
      if (phase === 'box') return;
      if (k === 'Space') { e.preventDefault(); if (e.repeat) return; if (down) actShootDown(); else actShootUp(); return; } // a held key repeats: only the first press counts
      if (!down || e.repeat) return;
      if (k === 'KeyE') { e.preventDefault(); actPass(); }
      else if (k === 'KeyQ') { e.preventDefault(); actMove(); }
      else if (k === 'KeyF') { e.preventDefault(); actFoul(); }
      else if (k === 'KeyT') { e.preventDefault(); actTimeout(); }
    }
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    const onBlur = () => { input.l = input.r = input.u = input.d = 0; input.sprint = false; if (input.shoot) actShootUp(); resetPtr(); };
    window.addEventListener('blur', onBlur);
    // ---------- the floating joystick: drag anywhere on the floor (not on a button) ----------
    const stickEl = el('div', 'dk-stick', '<b></b>'); stickEl.style.display = 'none'; stage.appendChild(stickEl);
    const hideStick = () => { stickEl.style.display = 'none'; };
    let pid = null, origin = null, ptT = 0;
    function resetPtr() { pid = null; origin = null; input.stick = null; try { hideStick(); } catch (e) {} }
    stage.addEventListener('pointerdown', (e) => {
      if (finished || phase === 'splash' || phase === 'box') return;
      if (touchy && !aligned()) { scrollIn(); e.preventDefault(); return; }
      if (pid != null && (e.pointerId === pid || performance.now() - ptT > 8000)) resetPtr();
      if (pid != null) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!touchy && e.pointerType === 'mouse') return; // a computer plays on the keyboard
      pid = e.pointerId; ptT = performance.now(); origin = [x, y]; input.stick = [0, 0];
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      stickEl.style.display = 'block'; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.firstChild.style.transform = '';
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId || !origin) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const dx = x - origin[0], dy = y - origin[1], l = Math.hypot(dx, dy), k = l > 42 ? 42 / l : 1;
      input.stick = [clamp(dx / 42, -1, 1), clamp(-dy / 42, -1, 1)];
      stickEl.firstChild.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    });
    const endPtr = (e) => { if (pid !== e.pointerId) return; resetPtr(); };
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
    stage.addEventListener('lostpointercapture', (e) => { if (e.pointerId === pid) resetPtr(); });

    // ---------- finish / cleanup ----------
    function cleanup() {
      stopLoop(); clearTimeout(tickT);
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pageshow', onWake); window.removeEventListener('focus', onWake); window.removeEventListener('pointerdown', onWake, { capture: true }); window.removeEventListener('touchend', onWake, { capture: true });
      window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onOrient);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize); document.removeEventListener('webkitfullscreenchange', onResize);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
      try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
      if (fixedMode) { wrap.classList.remove('dk-fixed'); document.documentElement.classList.remove('dk-lock'); try { window.scrollTo(0, savedScroll); } catch (e) {} }
      sfx.close();
      try {
        if (G) { for (const b of G.bufs) gl.deleteBuffer(b); for (const t of G.texs) gl.deleteTexture(t); for (const pr of G.progs) gl.deleteProgram(pr); delFBO(G.shadow); delFBO(G.scene); delFBO(G.scene2); delFBO(G.bloomA); delFBO(G.bloomB); delFBO(G.aoA); delFBO(G.aoB); }
        for (const k in RH.heads) { const h = RH.heads[k]; if (h.g === G && h.vb) { gl.deleteBuffer(h.vb); gl.deleteBuffer(h.ib); gl.deleteTexture(h.tex); } }
        const lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext();
      } catch (e) {}
      G = null;
    }
    function teamStats(t) { const o = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 }; for (const q of t.sq) { const s = ST[q.key]; if (!s) continue; for (const k in o) o[k] += s[k] || 0; } return o; }
    function finishGame(quit) {
      if (finished) return;
      finished = true;
      cleanup();
      const box = SQL.map((q) => Object.assign({ id: q.pid, name: q.name, num: q.num, side: q.side ? 'away' : 'home', pos: q.pos }, ST[q.key] || {}));
      const res = { homeScore: hs, awayScore: as, quit: !!quit, overtime: qtr > 4, team: teamStats(teams[0]), opp: teamStats(teams[1]), box, highlights: HL.slice(-10) };
      try { done(res); } catch (e) { console.error(e); }
    }

    // ---------- splash ----------
    const lvlName = ['Rookie', 'Pro', 'All-Pro', 'Legend', 'GOAT', 'Hall of Fame'][LEVEL];
    const splash = el('div', 'dk-splash', `
      <div class="dk-title">3D DUNK</div>
      <div class="dk-tag2"><span style="color:${HOMECSS}">${esc(HOME.name)}</span> vs <span style="color:${OPPCSS}">${esc(AWAY.name)}</span></div>
      <div class="dk-goal">${opts.label ? esc(opts.label) : lvlName} · Wildcat Gym<br>4 quarters × <em>${fmtClock(QS)}</em> · <em>${SHOT}</em>-second shot clock · <em>${TOS}</em> timeouts</div>
      <div class="dk-squad">${SQH.map((q) => `<div>${faceHTML(q)}<span>${esc(shortName(q.name))}</span><em>${q.sixth ? '6th' : q.pos} #${q.num}</em></div>`).join('')}</div>
      <ul class="dk-how">${touchy ? '<li><b>Drag</b> on the floor to move</li><li><b>Hold SHOOT</b>, let go in the green</li><li><b>PASS</b> / <b>SWITCH</b>, <b>MOVE</b> for combo moves</li><li><b>STEAL</b>, <b>BLOCK</b>, <b>FOUL</b> on defense</li>' : '<li><b>WASD</b> move · <b>SHIFT</b> sprint</li><li><b>SPACE</b> hold to shoot, let go in the green · on defense jump / block</li><li><b>E</b> pass / switch · <b>Q</b> combo moves (not too fast!) / steal</li><li><b>F</b> foul · <b>T</b> timeout and subs</li>'}</ul>
      <button type="button" class="dk-go">TIP OFF</button>`);
    wrap.appendChild(splash);
    splash.querySelector('.dk-go').addEventListener('click', begin);
    function begin() {
      if (phase !== 'splash' || finished) return;
      sfx.init(); sfx.play('whistle');
      splash.remove(); fit(); scrollIn(); setTimeout(() => { if (!finished) { fit(); scrollIn(); } }, 400);
      startTip(); setControls(true);
      try { cv.focus({ preventScroll: true }); } catch (e) {}
    }

    // ---------- debug hook (tests only): window.__dunkDebug.api ----------
    const press = (k, down) => { const m = { space: [actShootDown, actShootUp], e: [actPass], q: [actMove], f: [actFoul], t: [actTimeout] }[String(k).toLowerCase()]; if (!m) { const d = { w: 'u', a: 'l', s: 'd', d: 'r' }[String(k).toLowerCase()]; if (d) input[d] = down === false ? 0 : 1; if (String(k).toLowerCase() === 'shift') input.sprint = down !== false; return; } if (down === false) { if (m[1]) m[1](); } else m[0](); };
    const api = {
      get phase() { return phase; }, get clock() { return clock; }, get period() { return qtr; }, get qtr() { return qtr; }, get shotClock() { return shotClk; }, get hs() { return hs; }, get as() { return as; },
      get ball() { return ball; }, get ctrl() { return ctrl; }, get poss() { return poss; }, get teams() { return teams; }, get everyone() { return everyone; }, get onCourt() { return onCourt; }, get cam() { return cam; },
      get players() { return onCourt.map((p) => ({ key: p.key, name: p.sq.name, team: p.side, x: p.x, z: p.z, vx: p.vx, vz: p.vz, anim: p.an.clip, pose: p.pose, hasBall: ball.holder === p, jumpY: p.jumpY })); },
      get meter() { const p = ctrl; return p && p.shotS ? { on: true, t: p.meter, greenLo: p.shotS.gc - p.shotS.w / 2, greenHi: p.shotS.gc + p.shotS.w / 2 } : { on: false }; },
      get stats() { return ST; }, get draws() { return DRAWS; }, get perf() { return perf; }, get rh() { return RH; }, get quality() { return quality; },
      input, begin, press, step(t) { DBG.stepT = t; },
      setInput(o) { Object.assign(input, o || {}); },
      stick(x, z) { input.stick = x == null ? null : [x, z]; },
      setQuality(q) { setQuality(q); showQuality(); },
      // shoot now with your man (or anyone): release at meter value m (default: the middle of the green)
      forceShot(m, who) { const p = who != null ? onCourt[who] : ctrl; if (!p) return false; if (ball.holder !== p) { giveBall(p, 'held'); if (p.side !== poss) changePoss(p.side, p); } phase = 'live'; clockRun = true; if (!startShot(p)) return false; if (p.shotS) p.cpuRel = m != null ? m : p.shotS.gc; return true; },
      giveTo(i) { const p = onCourt[i]; if (!p) return; giveBall(p, 'held'); if (p.side !== poss) changePoss(p.side, p); else if (p.side === 0) setCtrl(p); phase = 'live'; clockRun = true; },
      move(i) { return doMove(onCourt[i] || ctrl); }, steal(i) { return trySteal(onCourt[i] || ctrl); },
      timeout(side) { return callTimeout(side || 0); }, endTimeout() { endTimeout(); }, sub(outKey, inKey) { const t = teams[0], o = everyone.find((p) => p.key === outKey), i = everyone.find((p) => p.key === inKey); return o && i ? doSub(0, o, i) : false; },
      skipQuarter() { if (phase === 'splash') begin(); clock = 0; if (phase !== 'live') { phase = 'live'; clockRun = true; } ball.shot = null; if (ball.st === 'air') ball.st = 'loose'; },
      // play the rest of the game out with the CPU running your team too
      simToEnd(fast) { DBG.auto = true; if (phase === 'splash') begin(); DBG.speed = fast || 40; DBG.lockQ = true; },
      attDir(side) { return dirOf(side || 0); },
      project(x, y, z) { return project(x, y, z); }, get cssW() { return cssW; }, get cssH() { return cssH; },
      debugSet(o) { if (o.clock != null) clock = o.clock; if (o.qtr) qtr = o.qtr; if (o.hs != null) hs = o.hs; if (o.as != null) as = o.as; if (o.shotClk != null) shotClk = o.shotClk; boardDirty = true; },
      quit() { finishGame(true); }, showBox() { if (!boxShown) showBox(); }, finish() { finishGame(false); },
    };
    let elapsedT = 0, stepErrs = 0, stepErrLogged = false;
    const stepRaw = step;
    step = function (dt) {
      if (phase !== 'splash' && phase !== 'box') elapsedT += dt;
      try { stepRaw(dt); stepErrs = 0; }
      catch (err) {
        stepErrs++;
        if (!stepErrLogged) { stepErrLogged = true; try { console.error('dunk3d: step error', err); } catch (e2) {} }
        if (stepErrs >= 30) { stepErrs = 0; try { if (phase === 'live' || phase === 'dead') { ball.holder = null; ball.st = 'dead'; setDead(0.5, () => startInbound(poss, 0, COURT.HW)); } } catch (e3) {} }
      }
    };
    if (DBG) DBG.api = api;

    // ---------- go ----------
    fit();
    try { setupGL(); } catch (err) {
      console.error(err); finished = true; cleanup();
      root.innerHTML = '<div class="dk-err"><b>NO 3D HERE</b>Sorry, your browser couldn\'t start the 3D graphics.</div>';
      setTimeout(() => done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, noGL: true, team: {}, opp: {}, box: [], highlights: [] }), 0);
      return { destroy() {} };
    }
    setupPlay();
    updateCam(-1); updBug(); setControls(true);
    startLoop();
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Barlow Condensed"').then(() => {
        if (!G || glLost || finished) return;
        boardDirty = true; tableDirty = true;
      }).catch(() => {});
    } catch (e) {}
    return { destroy() { finishGame(true); } };
  }
  // =====================================================================================
  // Public API + the Arcade game 'dunk3d'
  // ctx.data (the server's /arcade/start): { home: {name, abbr, color, color2, mine, players: [6 x {id, name, num, photo, look, hgt, wgt,
  // pos, sixth, bb: {ovr, spd, vert, str, hand, pass, fin, dunk, mid, three, ft, perD, intD, stl, blk, reb, sta}}]}, away: {...}, level, quarterSecs, seed }
  // =====================================================================================
  window.MFLDunk = {
    version: 1,
    play(root, opts) {
      return new Promise((resolve) => {
        let settled = false;
        const done = (r) => { if (settled) return; settled = true; resolve(r); };
        try { Game(root, opts || {}, done); } catch (e) {
          console.error(e);
          done({ homeScore: 0, awayScore: 0, quit: true, overtime: false, team: {}, opp: {}, box: [], highlights: [], error: String((e && e.message) || e) });
        }
      });
    },
  };
  if (window.MFLArcade && window.MFLArcade.register) {
    window.MFLArcade.register('dunk3d', {
      start(ctx) {
        const data = ctx.data || {}, lvl = clamp((data.level != null ? data.level : ctx.level) | 0, 0, 5);
        const team = (t, dn) => (t && typeof t === 'object' ? Object.assign({}, t, { players: (Array.isArray(t.players) ? t.players : []).filter((p) => p && p.name).slice(0, 6) }) : { name: dn, players: [] });
        const home = team(data.home, 'MFL Stars');
        let away = team(data.away, '');
        if (!away.players.length && !data.away) { const o = pickOpponent(lvl, { name: home.name, color: home.color || '#c8102e' }, ctx.seed); away = { name: o.name, abbr: o.abbr, color: o.color, color2: o.color2, players: [], ovr: 56 + lvl * 7 }; }
        const lvlN = ctx.levelName || ['Rookie', 'Pro', 'All-Pro', 'Legend', 'GOAT', 'Hall of Fame'][lvl];
        window.MFLDunk.play(ctx.root, { home, away, level: lvl, difficulty: [0, 0.33, 0.66, 1, 1.3, 1.1][lvl], noTies: !ctx.exhibition, seed: data.seed || ctx.seed,
          quarterSecs: clamp(+data.quarterSecs || 120, 30, 600), timeouts: 3, label: lvlN + (ctx.exhibition ? ' · Practice' : ' · Arcade') }).then((r) => {
          const won = !r.quit && r.homeScore > r.awayScore, T = r.team || {}, nm = esc(away.name || 'them');
          ctx.finish({
            won, tie: false, score: r.homeScore,
            detail: r.noGL ? 'Your browser can\'t run 3D (WebGL unavailable).' : r.quit ? `Quit at ${r.homeScore}-${r.awayScore} vs ${nm}` : (won ? 'W ' : r.homeScore === r.awayScore ? 'T ' : 'L ') + r.homeScore + '-' + r.awayScore,
            stats: { pts: r.homeScore, opp: r.awayScore, fgm: T.fgm || 0, fga: T.fga || 0, tpm: T.tpm || 0, tpa: T.tpa || 0, reb: T.reb || 0, ast: T.ast || 0, stl: T.stl || 0, blk: T.blk || 0, to: T.to || 0, level: lvl, overtime: !!r.overtime, box: r.box || [] },
          });
        });
      },
    });
  }
})();
