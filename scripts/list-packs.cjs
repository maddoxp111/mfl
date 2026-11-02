// Lists every pack (group, cost, cards, features, pool size) and opens each one many times
// in-process to check card counts, pools and guarantees, including thin and empty pools.
// Usage: node scripts/list-packs.cjs [path/to/db.json]   (default: the bundled start data)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cards = require('../cards');

const arg = process.argv[2];
const raw = JSON.parse(fs.readFileSync(arg || path.join(__dirname, '..', 'data-start', 'mfl-backup.json'), 'utf8'));
const db = raw.db || raw;
const R = cards.RARITY_ORDER;
const now = '2026-11-02 13:05';
const ctx = { now, own: {}, lineup: [] };
const feats = (P) => [P.free && `free:${P.free}`, P.floor && `floor:${P.floor}`, P.min && `min:${P.min}${P.mins ? '×' + P.mins : ''}`, P.choose && `choose ${P.choose} keep ${P.cards}`, P.pairs && `pairs:${P.pairs}`,
  P.bundle && `bundle:${P.bundle.map(([t, n]) => (n > 1 ? n + '×' : '') + t).join('+')}`, P.mystery && `mystery:${P.mystery.join('-')}`, P.mixed && 'mixed', P.sets && !P.mixed && 'sets',
  P.rotate && `rotate:${JSON.stringify(P.rotate).replace(/"/g, '')}${P.off ? ' (off, back ' + P.back + ')' : ''}`, P.flash && `flash:${P.base} -${Math.round(P.discount * 100)}%`, P.limit && `limit:${P.limit}`, P.live && 'live', P.boost && 'boost'].filter(Boolean).join(' ');

const types = cards.packTypes(db);
console.log(`${types.length} pack types (${types.filter((t) => cards.PACKS[t]?.added).length} new)\n`);
console.log('type'.padEnd(17) + 'group'.padEnd(9) + 'cost'.padStart(6) + ' cards  pool       features');
for (const t of types) {
  const P = cards.packInfo(db, t, ctx), o = cards.packInfo.odds(db, t, ctx);
  console.log(t.padEnd(17) + String(P.group).padEnd(9) + String(P.cost).padStart(6) + String(P.cards).padStart(6) + '  ' + (o.ok ? String(o.size).padEnd(9) : 'EMPTY'.padEnd(9)) + '  ' + feats(P));
}

// Open every pack 40 times and check what comes out.
let opened = 0;
for (const t of types) {
  const P = cards.packInfo(db, t, ctx);
  for (let i = 0; i < 40; i++) {
    const ids = cards.openPack(db, t, new Set(), ctx);
    const want = P.choose || (P.pairs ? P.pairs * 2 : P.cards);
    if (P.mystery) assert.ok(ids.length >= P.mystery[0] && ids.length <= P.mystery[1], `${t}: ${ids.length} cards`);
    else assert.equal(ids.length, want, `${t}: card count`);
    const cs = ids.map((id) => cards.cardInfo(db, id));
    assert.ok(cs.every(Boolean), `${t}: unknown card`);
    if (cards.packInfo.odds(db, t, ctx).ok && t !== 'starter') for (const c of cs) assert.ok(cards.packInfo.canDrop(db, t, c, P), `${t}: ${c.id} outside the pool`);
    if (P.floor) assert.ok(cs.every((c) => c.rarity === 'doh' || R.indexOf(c.rarity) >= R.indexOf(P.floor)), `${t}: below the floor`);
    if (P.min && !P.bundle) assert.ok(cs.filter((c) => R.indexOf(c.rarity) >= R.indexOf(P.min)).length >= Math.min(P.mins || 1, ids.length), `${t}: guarantee missed`);
    if (P.choose) assert.equal(new Set(ids).size, ids.length, `${t}: repeated choices`);
    if (P.pairs) for (let k = 0; k < ids.length; k += 2) assert.ok(cs[k].pid === cs[k + 1].pid && cs[k].id !== cs[k + 1].id, `${t}: bad pair`);
    opened++;
  }
}
// Thin pools: a pack of only 1/1 cards with all but two already pulled, and a pool that matches nothing.
const ones = cards.catalog(db).filter((c) => c.one && !c.set);
cards.PACKS.__thin = { name: 'Thin', cards: 6, cost: 1, group: 'test', pool: (c) => c.one };
const thin = cards.openPack(db, '__thin', new Set(ones.slice(2).map((c) => c.id)));
assert.equal(thin.length, 6);
assert.equal(new Set(thin.filter((id) => cards.cardInfo(db, id).one)).size, thin.filter((id) => cards.cardInfo(db, id).one).length, 'a 1/1 dropped twice');
cards.PACKS.__none = { name: 'None', cards: 3, cost: 1, group: 'test', pool: () => false, floor: 'epic' };
assert.equal(cards.openPack(db, '__none').length, 3);
assert.equal(cards.packInfo.odds(db, '__none').ok, false);
delete cards.PACKS.__thin; delete cards.PACKS.__none;
console.log(`\nopened ${opened} packs in-process: counts, pools, floors, guarantees, choices and pairs all check out; thin and empty pools work`);
