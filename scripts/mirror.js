// Builds a read-only static copy of the live site for GitHub Pages.
// Usage: node scripts/mirror.js <source-url> <base-path> <out-dir>
//   e.g. node scripts/mirror.js https://mfl.vercel.app /mfl dist
const fs = require('fs');
const path = require('path');

const [SRC, BASE = '', OUT = 'dist'] = process.argv.slice(2);
if (!SRC) throw new Error('usage: mirror.js <source-url> <base-path> <out-dir>');
const origin = new URL(SRC).origin;

// Pages are saved as folders with index.html; ?month=YYYY-MM becomes /YYYY-MM/.
function localPath(u) {
  const url = new URL(u, origin);
  let p = url.pathname.replace(/\/$/, '');
  const month = url.searchParams.get('month');
  if (month && /^\d{4}-\d{2}$/.test(month)) p += '/' + month;
  return p || '';
}
const isAsset = (p) => /^\/(static|media)\//.test(p) || p.endsWith('.ics');
// Admin and Pick'em pages aren't saved; public/bridge.js loads them live.
const skip = (p) => /^\/(admin|pickem|picks|pick-links)(\/|$)/.test(p);

function rewrite(html) {
  return html.replace(/(href|src)="(\/[^"]*)"/g, (m, attr, link) => {
    const url = new URL(link, origin);
    if (skip(url.pathname)) return `${attr}="${BASE}${link}"`;
    if (isAsset(url.pathname)) return `${attr}="${BASE}${url.pathname}${url.search}"`;
    return `${attr}="${BASE}${localPath(link)}/"`;
  }).replace(/url\(\/static\//g, `url(${BASE}/static/`);
}
// Pages get the bridge, which swaps in the live page. The snapshot's own scripts
// only run if the live site can't be reached.
const BRIDGE = `<style>.mfl-loading body{visibility:hidden}.mfl-off{background:#3a2a00;color:#ffd77a;padding:8px 16px;font:600 13px/1.4 system-ui;text-align:center}</style><script src="${BASE}/static/bridge.js" data-base="${BASE}"></script>`;
const page = (html) => rewrite(html).replace(/<script>/g, '<script type="text/x-mfl">').replace('</head>', BRIDGE + '</head>');

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const queue = ['/'], seen = new Set(queue), assets = new Set(['/static/bridge.js']);
  while (queue.length) {
    const link = queue.shift();
    const res = await fetch(origin + link);
    // A server error means the site is down: stop, so the last good copy stays up.
    if (res.status >= 500) throw new Error(`live site returned ${res.status} for ${link}`);
    if (!res.ok) { console.warn('skip', res.status, link); continue; }
    const html = await res.text();
    for (const [, l] of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      const p = new URL(l, origin).pathname;
      if (skip(p)) continue;
      if (isAsset(p)) assets.add(p);
      else if (!seen.has(l)) { seen.add(l); queue.push(l); }
    }
    const file = path.join(OUT, localPath(link), 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page(html));
  }
  for (const p of assets) {
    const res = await fetch(origin + p);
    if (!res.ok) continue;
    let buf = Buffer.from(await res.arrayBuffer());
    if (p.endsWith('.css')) buf = Buffer.from(rewrite(buf.toString()));
    const file = path.join(OUT, p);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
  }
  // 404 page and no Jekyll processing.
  const nf = await fetch(origin + '/this-page-does-not-exist');
  fs.writeFileSync(path.join(OUT, '404.html'), page(await nf.text()));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`mirrored ${seen.size} pages and ${assets.size} files`);
}
main().catch((e) => { console.error(e); process.exit(1); });
