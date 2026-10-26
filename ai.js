// AI analyst: Claude Haiku 5.5 rates players and writes game recaps from the
// commissioner's tendencies, the box scores and the notes on each play.
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const { DATA_DIR } = require('./db');

const MODEL = 'claude-haiku-5-5';
const KEY_FILE = path.join(DATA_DIR, 'secrets.json');

// The key comes from the ANTHROPIC_API_KEY variable, or is pasted in Admin > AI and
// kept in the data folder (never in db.json, so it isn't in backups or the repo).
function readSecrets() {
  try { return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch { return {}; }
}
function apiKey() {
  return process.env.ANTHROPIC_API_KEY || readSecrets().anthropicKey || null;
}
function setApiKey(key) {
  const s = readSecrets();
  if (key) s.anthropicKey = key; else delete s.anthropicKey;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(s), { mode: 0o600 });
}
const keySource = () => (process.env.ANTHROPIC_API_KEY ? 'variable' : readSecrets().anthropicKey ? 'admin' : null);

let client = null, clientKey = null;
function getClient() {
  const key = apiKey();
  if (!key) return null;
  if (key !== clientKey) { client = new Anthropic({ apiKey: key }); clientKey = key; }
  return client;
}

async function ask(system, input, schema) {
  const c = getClient();
  if (!c) throw new Error('No Anthropic API key set.');
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });
  if (res.stop_reason === 'refusal') throw new Error('The model declined this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off (too long).');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// Friendly message for the admin page.
function describeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was rejected. Check it in Admin > AI.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use Claude Haiku 5.5.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by Anthropic. It will try again on the next update.';
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ''}: ${e.message}`.trim();
  return e.message || String(e);
}

const RATINGS_SYSTEM = `You are the stats analyst for the Metcalf Football League (MFL), a middle-school flag football league with two teams. Games are one quarter long; a touchdown is worth 7 points.

You get a JSON snapshot of the league and return a power rating for every player.

How to rate:
- Scale is 40 to 99. 60 means an average player we know little about; 70s are good starters; 80s are stars; 90+ is reserved for players who have dominated over several games.
- The commissioner's tendencies are the scouting base. Each is 0-100 (50 = neutral or no information) for scoring TDs, throwing TDs and getting interceptions. Strong tendencies justify a starting point in the mid 60s to low 70s; weak ones the mid 50s.
- Game results are the evidence, and outweigh tendencies as games pile up. Recent games count more than old ones. With only one or two games, stay close to the base and previous rating; one great game is not enough to make a star.
- Credit touchdowns, TD passes, interceptions, notable catches, sacks, pass breakups and flag pulls. Read every play note and use it with judgement: "tipped by Pedon" on an interception means Pedon gets real but partial credit for that pick; a note can also make a play more impressive (one-handed, in traffic, game-winning) or less (wide open, dropped first). Only credit players a note clearly refers to.
- Throwing interceptions, getting sacked and losing pull ratings down. A player who has not done anything recently drifts slowly toward 60.
- Winning matters a little: players on the winning side of close games deserve a small bump, especially if they made the key plays.
- Keep ratings stable: compared with previous_rating, nobody should move more than about 6 points after one new game unless it was historic.
- Exhibition games count, slightly less than regular games. Playoff bowls count a little more.

For each player also write "take": one short sentence (at most 20 words) explaining the rating in plain, friendly language. Use only facts from the data; never invent plays, positions or stats.
Write "summary": two or three sentences on the state of the league for the power rankings page.
Return every player in the input exactly once, using their "key".`;

const RATINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'players'],
  properties: {
    summary: { type: 'string' },
    players: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'rating', 'take'],
        properties: { key: { type: 'string' }, rating: { type: 'integer' }, take: { type: 'string' } },
      },
    },
  },
};

const RECAP_SYSTEM = `You write game recaps for the Metcalf Football League (MFL), a middle-school flag football league. Games are one quarter long, all played at Thomas Metcalf School; a touchdown is worth 7 points.

You get one game as JSON: the teams, the final score, the game type and every recorded play with its notes. Write a recap of 3 to 5 sentences in an upbeat local sports-page voice, fun for the players to read. Mention the key scorers, passers, interceptions and any notable catches, sacks or breakups, and use the play notes (for example, if a note says an interception was tipped by someone, give that player credit). Use only facts in the data; never invent plays, quotes, yardage or times. If no plays were recorded, write about the result only.

Also pick the game MVP using judgement, not just a point formula: touchdowns, TD passes, interceptions, big catches, sacks and credit from notes all count, and players on the winning team get the tiebreak. Return the MVP's "key" from the roster (or an empty string if nothing was recorded) and a short reason, like "2 TDs and a tipped pass that became a pick".`;

const RECAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recap', 'mvp_key', 'mvp_reason'],
  properties: { recap: { type: 'string' }, mvp_key: { type: 'string' }, mvp_reason: { type: 'string' } },
};

const rateLeague = (input) => ask(RATINGS_SYSTEM, input, RATINGS_SCHEMA);
const writeRecap = (input) => ask(RECAP_SYSTEM, input, RECAP_SCHEMA);

module.exports = { MODEL, apiKey, setApiKey, keySource, rateLeague, writeRecap, describeError };
