// Player page: his 3D avatar doing his move in the banner behind his photo, and "View in 3D" (a bigger viewer you can spin).
// The 3D code (public/arcade/blitz-avatar.js, ~280 KB) loads only once the banner is on screen and the page is idle, and only
// when the browser has WebGL; until then (or without it) the banner is a plain team-colour panel.
(function () {
  const st = document.querySelector('.pp-stage');
  if (!st) return;
  let cfg = null;
  try { cfg = JSON.parse(st.getAttribute('data-av')); } catch (e) { return; }
  const SRC = st.getAttribute('data-src');
  const btn = st.querySelector('.pp-3d');
  const phone = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const hasGL = (() => {
    try {
      const c = document.createElement('canvas'), g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!g) return false;
      const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext();
      return true;
    } catch (e) { return false; }
  })();
  if (!hasGL) { st.classList.add('no3d'); return; }
  st.classList.add('can3d');
  let loading = null;
  function load() {
    if (window.MFLBlitz && window.MFLBlitz.avatar) return Promise.resolve();
    if (loading) return loading;
    const ok = () => { if (!(window.MFLBlitz && window.MFLBlitz.avatar)) throw new Error('no avatar'); };
    // the script's text run inline (some school devices block script files from the page's own server), else a plain <script src>
    loading = fetch(SRC).then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.text(); }).then((code) => {
      const s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); ok();
    }).catch(() => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = SRC; s.onload = () => { try { ok(); res(); } catch (e) { rej(e); } }; s.onerror = rej; document.head.appendChild(s);
    }));
    loading.catch(() => { loading = null; });
    return loading;
  }
  const opts = (o) => Object.assign({ player: cfg.player, team: cfg.team, emote: cfg.emote }, o);
  // ---------- the banner ----------
  let banner = null;
  function startBanner() {
    if (banner) return;
    load().then(() => {
      if (banner) return;
      banner = window.MFLBlitz.avatar(st.querySelector('.pp-av'), opts({ place: phone() ? 0.66 : 0.64, onError: () => st.classList.add('no3d') }));
      st.mflAvatar = banner; // (for checks from the console)
      if (banner && banner.ok) st.classList.add('live'); else st.classList.add('no3d');
    }).catch(() => st.classList.add('no3d'));
  }
  const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 700));
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  if (!saveData) {
    const go = () => idle(startBanner);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true }); } });
      io.observe(st);
    } else window.addEventListener('load', go, { once: true });
  }
  // ---------- the viewer ----------
  let dlg = null, view = null, back = null;
  function close() {
    if (!dlg) return;
    if (view) { view.destroy(); view = null; }
    dlg.remove(); dlg = null;
    document.documentElement.classList.remove('av3d-lock');
    document.removeEventListener('keydown', onKey);
    if (banner) banner.play();
    if (back && back.focus) back.focus();
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function open() {
    if (dlg) return;
    back = document.activeElement;
    dlg = document.createElement('div');
    dlg.className = 'av3d';
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', cfg.player.name + ' in 3D');
    dlg.style.setProperty('--a', cfg.team.color || '#444'); dlg.style.setProperty('--b', cfg.team.color2 || '#111');
    dlg.innerHTML = `<div class="av3d-bg"></div><div class="av3d-box">
      <div class="av3d-top"><div><b>${esc(cfg.player.name)}</b><small>${esc(cfg.emoteName)}</small></div><button type="button" class="av3d-x" aria-label="Close">✕</button></div>
      <div class="av3d-stage"><div class="av3d-load">Loading 3D…</div></div>
      <div class="av3d-bar"><span class="av3d-hint">Drag to spin him around · pinch or scroll to zoom</span><span class="av3d-btns"><button type="button" class="av3d-pause">Pause</button><button type="button" class="av3d-reset">Reset view</button></span></div>
    </div>`;
    document.body.appendChild(dlg);
    document.documentElement.classList.add('av3d-lock');
    document.addEventListener('keydown', onKey);
    dlg.querySelector('.av3d-bg').addEventListener('click', close);
    dlg.querySelector('.av3d-x').addEventListener('click', close);
    dlg.querySelector('.av3d-x').focus();
    if (banner) banner.pause();
    const stage = dlg.querySelector('.av3d-stage');
    load().then(() => {
      if (!dlg) return;
      view = window.MFLBlitz.avatar(stage, opts({ interactive: true, onError: () => { const l = stage.querySelector('.av3d-load'); if (l) l.textContent = 'Sorry, 3D isn\'t working on this device.'; } }));
      if (!view || !view.ok) { const l = stage.querySelector('.av3d-load'); if (l) l.textContent = 'Sorry, 3D isn\'t working on this device.'; return; }
      stage.classList.add('live');
      if (view.canvas) view.canvas.setAttribute('aria-label', cfg.player.name + ' doing his ' + cfg.emoteName + '. Drag to spin him around.');
      const pz = dlg.querySelector('.av3d-pause');
      pz.addEventListener('click', () => { if (pz.textContent === 'Pause') { view.pause(); pz.textContent = 'Play'; } else { view.play(); pz.textContent = 'Pause'; } });
      dlg.querySelector('.av3d-reset').addEventListener('click', () => view.reset());
    }).catch(() => { const l = stage.querySelector('.av3d-load'); if (l) l.textContent = 'Sorry, 3D couldn\'t load. Check your connection and try again.'; });
  }
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  st.addEventListener('click', (e) => { if (e.target.closest('a')) return; if (st.classList.contains('live')) open(); });
})();
