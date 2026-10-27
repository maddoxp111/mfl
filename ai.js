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

// How to read the commissioner's free-text notes on each game (used by every prompt).
const COACH_NOTES = `Games may include "coach_notes": the commissioner's own observations of how people played (for example "dom blocked terribly, pedon pressured the ball well, chuck threw the ball in cover well"). Treat them as reliable firsthand scouting. They usually use first names, last names or nicknames: match each one to the roster carefully (a last name, a first name or an obvious nickname like Chuck for Charlie), and ignore any part you can't match with confidence. Two players can share a first name, so a first name alone that fits two players is ambiguous.`;

const RATINGS_SYSTEM = `You are the stats analyst for the Metcalf Football League (MFL), a middle-school flag football league with two teams. Games are one quarter long; a touchdown is worth 7 points.

You get a JSON snapshot of the league and return a power rating for every player.

How to rate:
- Every player comes with "scouting_rating": the commissioner's own judgement of how good they are, already converted to the 40-99 scale from their tendencies. Start there. It is the most important input: the commissioner watches every game.
- Then adjust for what actually happened in games, using judgement. Early in the season (a handful of games) moves are small, usually within 4 points of scouting_rating; over many games strong evidence can move a player up to about 10 points. The final rating must stay within 12 of scouting_rating.
- Box scores are incomplete: most plays are never recorded. A player with no recorded stats has NOT played badly; leave them at their scouting_rating. Never pull someone down just because they have no stats.
- Credit touchdowns, TD passes, interceptions, notable catches, notable plays, sacks, pass breakups and flag pulls. Read every play note with judgement: "tipped by Pedon" on an interception gives Pedon real but partial credit; a note can make a play more impressive (one-handed, in traffic, game-winning) or less. Only credit players a note clearly refers to.
- Judge mistakes by role. A quarterback who throws most of his team's passes will throw some interceptions; weigh picks against the touchdowns he throws, and don't sink a star passer for a couple of picks. Interceptions thrown by someone who rarely passes matter more.
- Winning and losing matter only a little for individual ratings.
- Exhibition games count slightly less than regular games; playoff bowls slightly more.
- Coach notes count like a modest stat: clear praise or criticism of a player moves their rating a couple of points, more if the same thing shows up across games.
- Keep the order sensible: a clearly better player by scouting should only fall below a weaker one if the games give a strong reason.

For each player also write "take": one short sentence (at most 20 words) explaining the rating in plain, friendly language. Use only facts from the data; never invent plays, positions or stats.
Write "summary": two or three sentences on the state of the league for the power rankings page.
Return every player in the input exactly once, using their "key".\n\n${COACH_NOTES}`;

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
Use the coach notes to say who played well, but stay kind: these are kids, so describe struggles gently ("had a tough day blocking") and never insult anyone.

Also pick the game MVP using judgement, not just a point formula: touchdowns, TD passes, interceptions, big catches, sacks and credit from notes all count, coach notes about who played well, and players on the winning team get the tiebreak. Return the MVP's "key" from the roster (or an empty string if nothing was recorded) and a short reason, like "2 TDs and a tipped pass that became a pick".\n\n${COACH_NOTES}`;

const RECAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recap', 'mvp_key', 'mvp_reason'],
  properties: { recap: { type: 'string' }, mvp_key: { type: 'string' }, mvp_reason: { type: 'string' } },
};

const TEAM_SYSTEM = `You write the team page summary for a team in the Metcalf Football League (MFL), a middle-school flag football league with two teams. Games are one quarter long; a touchdown is worth 7 points.

You get the team's record, roster with power ratings, every game it has played (with plays and coach notes) and its next game. Write 4 to 6 sentences on the team's season so far: how it's doing, who is carrying it, recent form, what to watch next. Upbeat local sports-page voice, kind to every player. Use only facts in the data; never invent stats, plays or quotes. If no games have been played yet, preview the season from the roster and ratings.\n\n${COACH_NOTES}`;

const TEAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recap'],
  properties: { recap: { type: 'string' } },
};

const rateLeague = (input) => ask(RATINGS_SYSTEM, input, RATINGS_SCHEMA);
const writeTeamRecap = (input) => ask(TEAM_SYSTEM, input, TEAM_SCHEMA);
const writeRecap = (input) => ask(RECAP_SYSTEM, input, RECAP_SCHEMA);

module.exports = { MODEL, apiKey, setApiKey, keySource, rateLeague, writeRecap, writeTeamRecap, describeError };
