# MFL site: working notes

## Patch notes (the owner's standing rule)
- Every update to the site gets a new entry in `updates.js`: the next number (Update 2, Update 3, ...), today's date, a short
  title and plain bullets of what changed for players. The newest entry is what pops up ("UPDATE N") on everyone's next page
  and what /updates shows first.
- Skip it only for a really small bug fix.

## Don'ts
- Never commit secrets (API keys live only on the server and in the session scratchpad).
- Don't modify `public/football/*`.
- The hidden card (Big Doh Mi) stays hidden.
- No assistant or model names in code, comments, page text or commit messages.

## How money works
- Balances are never stored: `accountOf` (server.js) recomputes them from picks, Lineup, player rewards, Arcade, packs and
  the rest on every request, so a change to a rule changes everyone's balance at once (and retroactively).
- `/coins` lists every way to earn coins from the code's own constants; keep it that way when adding a new source.
