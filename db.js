const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const SEASON_START = '2026-10-22';
const SEASON_END = '2027-05-20';

const BOWLS = [
  { date: '2026-10-30', name: 'Halloween Bowl', slug: 'halloween-bowl' },
  { date: '2026-11-24', name: 'Turkey Bowl', slug: 'turkey-bowl' },
  { date: null, name: 'Christmas Bowl', slug: 'christmas-bowl' },
  { date: '2027-03-05', name: 'Spring Bowl', slug: 'spring-bowl' },
  { date: '2027-05-20', name: 'Super Bowl', slug: 'super-bowl' },
];

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function seed() {
  const teams = {
    pedon: {
      id: 'pedon', name: 'Pineapples', city: 'Team Pedon', abbr: 'PDN',
      color: '#f2b705', color2: '#1d6b2f', logo: null, captain: 'Maddox Pedon',
      roster: [
        { name: 'Maddox Pedon', tag: 'C' },
        { name: 'Maddox Marsaglia', tag: 'TR' },
        { name: 'Giovani Pelaez', tag: 'TR' },
        { name: 'Bowen Ince', tag: 'Rd 1' },
        { name: 'Liam Bair', tag: 'Rd 2' },
        { name: 'Finn Hopkins', tag: 'Rd 3' },
        { name: 'Clayton Kinsella', tag: 'Rd 4' },
        { name: 'Theo Miner', tag: 'FA' },
        { name: 'Luther Nuesken', tag: 'FA' },
      ],
    },
    xavier: {
      id: 'xavier', name: 'KTCS', city: 'Team Xavier', abbr: 'KTC',
      color: '#5b2a86', color2: '#111111', logo: null, captain: 'Xavier Davenport',
      roster: [
        { name: 'Xavier Davenport', tag: 'C' },
        { name: 'Charlie Waddell', tag: 'TR' },
        { name: 'Carson Tabaka', tag: 'TR' },
        { name: 'Braxton Iliff-Murphy', tag: 'Rd 1' },
        { name: 'Kamden Doage', tag: 'Rd 2' },
        { name: 'Luka Corrales', tag: 'Rd 3' },
        { name: 'Wally Barrickman', tag: 'Rd 4' },
        { name: 'Dom Chiodo', tag: 'FA' },
        { name: 'Kayson Link', tag: 'FA' },
      ],
    },
  };

  const games = [];
  let n = 1;
  const add = (g) => {
    games.push({
      id: String(n++), time: '12:35', home: 'pedon', away: 'xavier', status: 'scheduled', type: 'regular',
      bowl: null, reason: '', homeScore: null, awayScore: null, events: [], ...g,
    });
  };

  // Preseason exhibition played 10/21
  add({ date: '2026-10-21', type: 'exhibition', status: 'final', reason: 'Preseason game',
    homeScore: 14, awayScore: 7 });

  const bowlByDate = Object.fromEntries(BOWLS.filter((b) => b.date).map((b) => [b.date, b]));
  const d = new Date(SEASON_START + 'T12:00:00Z');
  const end = new Date(SEASON_END + 'T12:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = fmt(d);
    const dow = d.getUTCDay();
    if (bowlByDate[ds]) {
      add({ date: ds, type: 'playoff', bowl: bowlByDate[ds].slug });
    } else if ([1, 2, 4, 5].includes(dow)) {
      add({ date: ds });
    }
  }
  add({ date: null, type: 'playoff', bowl: 'christmas-bowl' });

  return { teams, games, bowls: BOWLS, nextId: n };
}

let db;
const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const BLOB_KEY = 'mfl/db.json';
// The store may be public or private; remember whichever works.
let access = process.env.BLOB_ACCESS || null;
const accessOrder = () => (access ? [access] : ['private', 'public']);

async function blobRead() {
  const { get } = require('@vercel/blob');
  let lastErr;
  for (const a of accessOrder()) {
    try {
      const r = await get(BLOB_KEY, { access: a, useCache: false });
      if (!r) return null;
      access = a;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) {
      if (/not.?found/i.test(e.name + e.message)) return null;
      lastErr = e;
    }
  }
  throw lastErr;
}
async function blobWrite(json) {
  const { put } = require('@vercel/blob');
  let lastErr;
  for (const a of accessOrder()) {
    try {
      await put(BLOB_KEY, json, { access: a, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
      access = a;
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';

// Give every player a stable id (older data stored rosters as name + tag only).
function normalize(d) {
  for (const t of Object.values(d.teams)) {
    const used = new Set();
    for (const p of t.roster) {
      if (!p.id) {
        let id = slug(p.name), i = 2;
        while (used.has(id)) id = `${slug(p.name)}-${i++}`;
        p.id = id;
      }
      used.add(p.id);
    }
  }
  return d;
}

// Load into memory (call before each request so serverless instances stay in sync).
async function refresh() {
  if (useBlob) {
    db = (await blobRead()) || null;
    if (!db) {
      db = seed();
      await save();
    }
    return normalize(db);
  }
  if (!db) {
    try {
      db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      db = seed();
      await save();
    }
  }
  return normalize(db);
}
function load() {
  return db;
}
async function save() {
  if (useBlob) return blobWrite(JSON.stringify(db));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(FILE + '.tmp', FILE);
}

// Uploaded images (player photos) live outside db.json so page loads stay small.
async function putMedia(key, buf, contentType) {
  if (useBlob) {
    const { put } = require('@vercel/blob');
    let lastErr;
    for (const a of accessOrder()) {
      try {
        await put('mfl/media/' + key, buf, { access: a, addRandomSuffix: false, allowOverwrite: true, contentType });
        access = a;
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }
  const f = path.join(DATA_DIR, 'media', key);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
}
async function getMedia(key) {
  if (useBlob) {
    const { get } = require('@vercel/blob');
    for (const a of accessOrder()) {
      try {
        const r = await get('mfl/media/' + key, { access: a });
        if (!r) return null;
        access = a;
        return Buffer.from(await new Response(r.stream).arrayBuffer());
      } catch (e) {
        if (/not.?found/i.test(e.name + e.message)) return null;
      }
    }
    return null;
  }
  try {
    return fs.readFileSync(path.join(DATA_DIR, 'media', key));
  } catch {
    return null;
  }
}

module.exports = { load, save, refresh, putMedia, getMedia, slug };
