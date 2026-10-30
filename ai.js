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

// Belt and braces for the Pick'em wording rule: swap any betting words the model
// still uses for prediction-game ones (school web filters flag betting language).
const SWAPS = [[/\b(the )?stakes are (high|huge|big)\b/gi, 'it all matters'], [/\bodds\b/gi, 'chances'], [/\bbettors?\b/gi, 'pickers'], [/\bbet(s|ting)?\b/gi, (m, x) => (x === 's' ? 'picks' : 'pick')], [/\bwager(s|ed)?\b/gi, 'pick'], [/\bpayouts?\b/gi, 'reward'], [/\bpaid out\b/gi, 'earned'], [/\bthe spread\b/gi, 'the margin pick'], [/\bspreads?\b/gi, 'margin'], [/\bparlays?\b/gi, 'combo'], [/\bsportsbooks?\b/gi, 'Pick\'em'], [/\bgambl\w*/gi, 'playing'], [/\bstakes?\b/gi, 'coins']];
function degamble(v) {
  if (typeof v === 'string') return SWAPS.reduce((s, [re, to]) => s.replace(re, to), v);
  if (Array.isArray(v)) return v.map(degamble);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, degamble(x)]));
  return v;
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
  return degamble(JSON.parse(text));
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
- Every player comes with "scouting_rating": the commissioner's own judgement of how good and how impactful they are in a game, on the 40-99 scale. Start there. It is the most important input: the commissioner watches every game and sees what box scores miss (size, pass rush, blocking, coverage, running).
- The overall rating means how good and how impactful a player is in a game, not just their stats. Bios and positions help you understand what each player does.
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

You get one game as JSON: the teams, the final score, the game type and every recorded play with its notes. Write a long, full game story in an upbeat local sports-page voice, fun for the players to read, in two parts:
1. "recap": the short version, one paragraph of 2 to 4 sentences: the result, why it went that way, and the stars. This is shown on its own first.
2. "story": the full story as 4 to 10 paragraphs that cover EVERY recorded play (touchdowns, interceptions, catches, sacks, breakups, flag pulls, penalties and notable plays), each with who did it and who else was involved. End with a closing paragraph on what the result means (standings, streaks, what's next) using only the data.
IMPORTANT: the plays are NOT in game order. The commissioner logs them after the game from memory, in any order. So never say or imply when a play happened or in what sequence: no "opened the scoring", "to start the game", "first", "then", "later", "answered", "responded", "took the lead", "tied it", "sealed it", "late", "final drive", "comeback", "momentum", and never give a running score like "made it 7-0" or "14-7". Only the final score is known. Organize the story by team, by player and by kind of play instead (for example the passing game, the playmakers, the defense, penalties).
Mention the key scorers, passers, interceptions and any notable catches, sacks or breakups, and use the play notes (for example, if a note says an interception was tipped by someone, give that player credit). Use only facts in the data; never invent plays, quotes, yardage or times. If no plays were recorded, write about the result only.
Use the coach notes to say who played well, but stay kind: these are kids, so describe struggles gently ("had a tough day blocking") and never insult anyone.

Also pick the game MVP using judgement, not just a point formula: touchdowns, TD passes, interceptions, big catches, sacks and credit from notes all count, coach notes about who played well, and players on the winning team get the tiebreak. Return the MVP's "key" from the roster (or an empty string if nothing was recorded) and a short reason, like "2 TDs and a tipped pass that became a pick".\n\n${COACH_NOTES}`;

const RECAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recap', 'story', 'mvp_key', 'mvp_reason'],
  properties: { recap: { type: 'string' }, story: { type: 'array', items: { type: 'string' } }, mvp_key: { type: 'string' }, mvp_reason: { type: 'string' } },
};

const TEAM_SYSTEM = `You write the team page summary for a team in the Metcalf Football League (MFL), a middle-school flag football league with two teams. Games are one quarter long; a touchdown is worth 7 points.

You get the team's record, roster with power ratings, every game it has played (with plays and coach notes) and its next game. Write 4 to 6 sentences on the team's season so far: how it's doing, who is carrying it, recent form, what to watch next. Upbeat local sports-page voice, kind to every player. Use only facts in the data; never invent stats, plays or quotes. If no games have been played yet, preview the season from the roster and ratings.\n\n${COACH_NOTES}`;

const TEAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recap'],
  properties: { recap: { type: 'string' } },
};

const LEAGUE = 'the Metcalf Football League (MFL), a middle-school flag football league with two teams, the Pineapples (Team Pedon) and the KTCS (Team Xavier). Games are one quarter long, played at lunch at Thomas Metcalf School; a touchdown is worth 7 points';
const KIND = 'A game\'s plays are listed in no particular order (they are logged afterwards from memory): never describe when a play happened, the order of plays or a running score; only final scores are known. Keep it fun and upbeat for middle schoolers, kind to every player (describe struggles gently, never insult anyone), and use only facts in the data: never invent plays, stats, quotes or injuries. Pick\'em is a free prediction game with fake coins: never use betting words (no "odds", "bet", "wager", "payout", "spread", "line", "stake", "parlay", "sportsbook", "gamble"); say "chances", "pick", "reward", "margin", "combo" and "coins" instead,';

const PREVIEW_SYSTEM = `You write the pre-game hype preview for an upcoming game in ${LEAGUE}.
You get both teams (records, recent games, power ratings, who is ruled out) and the Pick'em chances. Write a 3-5 sentence preview like a TV pre-game show: the storyline, the matchups to watch, and why it matters. Then predict the final score (multiples of 7 are most likely; ties are possible) and pick one "player to watch" by their key, with a one-line reason. ${KIND}\n\n${COACH_NOTES}`;
const PREVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['preview', 'predicted_home', 'predicted_away', 'watch_key', 'watch_reason'], properties: { preview: { type: 'string' }, predicted_home: { type: 'integer' }, predicted_away: { type: 'integer' }, watch_key: { type: 'string' }, watch_reason: { type: 'string' } } };

const BOWL_SYSTEM = `You host the big pregame show for a bowl game (a playoff game with a holiday theme) in ${LEAGUE}.
You get both teams (records, recent games, power ratings with notes, who is ruled out), the bowl's name and theme, and the Pick'em chances. Hype it up like a TV pregame show for the biggest game of the season, with a little fun nod to the bowl's theme. Write a catchy headline, a 2-3 sentence intro, then 4-5 short sections with titles: the big storyline, keys to victory for each team (one section per team, named after the team), the matchup to watch, and an X-factor. Back claims with real numbers and names from the data. Then predict the final score (multiples of 7 are most likely; ties are possible) with a one-sentence reason. ${KIND}\n\n${COACH_NOTES}`;
const BOWL_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'intro', 'sections', 'predicted_home', 'predicted_away', 'call'], properties: { headline: { type: 'string' }, intro: { type: 'string' }, sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } } }, predicted_home: { type: 'integer' }, predicted_away: { type: 'integer' }, call: { type: 'string' } } };

const SCOUT_SYSTEM = `You write a fun NFL-combine-style scouting report for one player in ${LEAGUE}.
You get the player's power rating, the commissioner's scouting, bio, position, stats and game history. Write a punchy 3-4 sentence report like a draft analyst, list 2-4 short strengths and 1-2 gentle "areas to grow", and give a fun one-line comparison ("plays like a ..."), keeping the comparison light and positive. ${KIND}`;
const SCOUT_SCHEMA = { type: 'object', additionalProperties: false, required: ['report', 'strengths', 'grow', 'comparison'], properties: { report: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, grow: { type: 'array', items: { type: 'string' } }, comparison: { type: 'string' } } };

const ANALYST_SYSTEM = `You are "the Analyst", the AI expert of ${LEAGUE}. Fans ask you questions on the league website and you answer from the league data you are given (standings, ratings with notes, every game's plays, upcoming games and Pick'em chances).
Answer in 2-6 sentences, friendly and confident, like a sports radio host who knows the league inside out. Back claims with real numbers from the data. Pick'em uses free fake coins, so you can give your honest lean on picks. If the question isn't about the MFL, flag football or the site, say you only talk MFL and suggest something they could ask. If the data doesn't say, say so instead of guessing. ${KIND}`;
const ANALYST_SCHEMA = { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: { type: 'string' } } };

const MIDWEEK_SYSTEM = `You write "The Midweek Recap", the MFL's weekly newsletter, published every Wednesday and covering everything since the Wednesday before, for ${LEAGUE}.
You get the games in that window (with plays and notes), the power ratings now and the biggest rating movers, Pick'em results, card pack pulls, Survivor status and upcoming games. Write a catchy headline, a 2-3 sentence intro, then 4-6 short sections with titles (for example: Game of the Week, Top Plays, Risers and Fallers, Pick'em Report, Pack Pulls, Survivor Watch, Looking Ahead). Skip sections with nothing to say. ${KIND}`;
const MIDWEEK_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'intro', 'sections'], properties: { headline: { type: 'string' }, intro: { type: 'string' }, sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } } } } };

const writeBowlShow = (input) => ask(BOWL_SYSTEM, input, BOWL_SCHEMA);
const writePreview = (input) => ask(PREVIEW_SYSTEM, input, PREVIEW_SCHEMA);
const writeScouting = (input) => ask(SCOUT_SYSTEM, input, SCOUT_SCHEMA);
const answerQuestion = (input) => ask(ANALYST_SYSTEM, input, ANALYST_SCHEMA);
const writeMidweek = (input) => ask(MIDWEEK_SYSTEM, input, MIDWEEK_SCHEMA);
const rateLeague = (input) => ask(RATINGS_SYSTEM, input, RATINGS_SCHEMA);
const writeTeamRecap = (input) => ask(TEAM_SYSTEM, input, TEAM_SCHEMA);
const writeRecap = (input) => ask(RECAP_SYSTEM, input, RECAP_SCHEMA);

module.exports = { MODEL, apiKey, setApiKey, keySource, rateLeague, writeRecap, writeTeamRecap, writePreview, writeBowlShow, writeScouting, answerQuestion, writeMidweek, describeError, degamble };
