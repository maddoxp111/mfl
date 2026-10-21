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
const isAsset = (p) => /^\/(static|media)\//.test(p);
const skip = (p) => /^\/admin(\/|$)/.test(p);

function rewrite(html) {
  return html.replace(/(href|src)="(\/[^"]*)"/g, (m, attr, link) => {
    const url = new URL(link, origin);
    if (skip(url.pathname)) return `${attr}="${origin}${link}"`;
    if (isAsset(url.pathname)) return `${attr}="${BASE}${url.pathname}${url.search}"`;
    return `${attr}="${BASE}${localPath(link)}/"`;
  }).replace(/url\(\/static\//g, `url(${BASE}/static/`);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const queue = ['/'], seen = new Set(queue), assets = new Set();
  while (queue.length) {
    const link = queue.shift();
    const res = await fetch(origin + link);
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
    fs.writeFileSync(file, rewrite(html));
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
  fs.writeFileSync(path.join(OUT, '404.html'), rewrite(await nf.text()));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`mirrored ${seen.size} pages and ${assets.size} files`);
}
main().catch((e) => { console.error(e); process.exit(1); });
