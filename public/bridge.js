// GitHub Pages bridge. The github.io copy is a snapshot; this script swaps in the
// live page from the real server, so logins, Pick'em and Admin all work there too.
// Logins are kept in localStorage, since the two sites can't share cookies.
(function () {
  const API = document.currentScript.dataset.api || 'https://metcalffootballleague.vercel.app';
  const BASE = document.currentScript.dataset.base || '';
  const JAR = 'mfl_auth';
  window.MFL_ORIGIN = location.origin + BASE;
  document.documentElement.classList.add('mfl-loading');

  const jar = () => { try { return JSON.parse(localStorage.getItem(JAR)) || {}; } catch { return {}; } };
  const auth = () => Object.entries(jar()).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('; ');
  function absorb(r) {
    const set = r.headers.get('X-MFL-Set');
    if (!set) return;
    const j = jar();
    for (const c of JSON.parse(set)) {
      const i = c.indexOf('='), k = c.slice(0, i), v = decodeURIComponent(c.slice(i + 1));
      if (v) j[k] = v; else delete j[k];
    }
    try { localStorage.setItem(JAR, JSON.stringify(j)); } catch {}
  }

  // github.io path <-> real site path. The snapshot saves ?month=YYYY-MM as /YYYY-MM/.
  function sitePath() {
    let p = location.pathname.slice(BASE.length) || '/';
    let q = location.search;
    const m = /^(.*)\/(\d{4}-\d{2})\/?$/.exec(p);
    if (m) { p = m[1]; q = '?month=' + m[2]; }
    if (p.length > 1) p = p.replace(/\/$/, '');
    return p + q;
  }
  // Folder URLs get a trailing slash so GitHub Pages doesn't redirect (and drop ?month=).
  function local(p) {
    if (!p.startsWith('/') || p.startsWith('//') || p.startsWith(BASE + '/')) return p;
    const m = /^([^?#]*)(.*)$/.exec(p);
    const dir = m[1].endsWith('/') || /\.[a-z]+$/i.test(m[1]) ? m[1] : m[1] + '/';
    return BASE + dir + m[2];
  }

  async function call(path, init = {}) {
    const r = await fetch(API + path, {
      ...init,
      credentials: 'omit',
      headers: { ...(init.headers || {}), 'X-MFL-Bridge': '1', 'X-MFL-Auth': auth(), 'X-MFL-Path': sitePath() },
    });
    absorb(r);
    return r;
  }

  // Page scripts call fetch('/pickem/...'); send those to the real server.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (u, init) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? call(u, init) : nativeFetch(u, init));

  function runScripts(root) {
    root.querySelectorAll('script').forEach((old) => {
      if (old.src) return;
      const s = document.createElement('script');
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }
  function show(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('[href],[src],[action]').forEach((el) => {
      for (const a of ['href', 'src', 'action']) {
        const v = el.getAttribute(a);
        if (!v || !v.startsWith('/') || v.startsWith('//')) continue;
        el.setAttribute(a, v.startsWith('/media/') ? API + v : local(v));
      }
    });
    document.title = doc.title;
    document.body.replaceWith(document.adoptNode(doc.body));
    runScripts(document.body);
    document.documentElement.classList.remove('mfl-loading');
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
  function offline() {
    // Live site unreachable: keep the snapshot and run its own scripts.
    document.querySelectorAll('script[type="text/x-mfl"]').forEach((s) => s.removeAttribute('type'));
    runScripts(document.body);
    const n = document.createElement('div');
    n.className = 'mfl-off';
    n.textContent = "Can't reach the live site right now, so this is a saved copy. Logins and Pick'em need the live site.";
    document.body.prepend(n);
    document.documentElement.classList.remove('mfl-loading');
  }
  function follow(r) {
    const to = r.headers.get('X-MFL-Redirect');
    if (!to) return false;
    const u = new URL(to, API);
    location.assign(local(u.pathname) + u.search + u.hash);
    return true;
  }

  const domReady = () => (document.readyState === 'loading' ? new Promise((r) => document.addEventListener('DOMContentLoaded', r)) : null);
  async function load() {
    await domReady();
    try {
      const saved = JSON.parse(sessionStorage.getItem('mfl_post') || 'null');
      sessionStorage.removeItem('mfl_post');
      if (saved && saved.path === sitePath()) return show(saved.html);
    } catch {}
    try {
      const r = await call(sitePath());
      if (r.status >= 500) return offline();
      if (follow(r)) return;
      const html = await r.text();
      show(html);
    } catch { offline(); }
  }

  // Forms post to the real server; the answer is shown here.
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if ((f.method || 'get').toLowerCase() !== 'post' || e.defaultPrevented) return;
    e.preventDefault();
    const fd = new FormData(f);
    if (e.submitter && e.submitter.name) fd.append(e.submitter.name, e.submitter.value);
    const u = new URL(f.getAttribute('action') || location.href, location.href);
    const path = (u.pathname.slice(BASE.length).replace(/(.)\/$/, '$1') || '/') + u.search;
    try {
      const r = await call(path, { method: 'POST', body: new URLSearchParams(fd) });
      if (follow(r)) return;
      // Show the answer (like "wrong password") on a fresh page load, so page scripts run once.
      try { sessionStorage.setItem('mfl_post', JSON.stringify({ path, html: await r.text() })); } catch {}
      location.replace(local(path));
    } catch { alert("Couldn't reach the live site. Try again in a moment."); }
  });
  // Links added by scripts (like "My picks" after locking in) still point at /...
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) a.setAttribute('href', local(a.getAttribute('href')));
  }, true);

  load();
  setTimeout(() => document.documentElement.classList.remove('mfl-loading'), 6000);
})();
