# Steam Hours Tracker — Design Spec

Date: 2026-09-21

## Purpose

Personal web app that tracks how many hours the user played each Steam
game, per day, and shows it on a page hosted on Vercel. Single-user
(the app owner's own Steam account), no login/auth for viewers.

## Why polling instead of the Steam API's native history

Steam's Web API only exposes `playtime_forever` (lifetime total) and
`playtime_2weeks` (rolling two-week total) per game — there is no
per-day breakdown. To get daily numbers we take periodic snapshots of
`playtime_forever` and store the deltas ourselves, bucketed by date.

## Cron frequency

Vercel Cron Jobs are free on the Hobby plan but capped at one
invocation per day per cron. This fits the use case: a single poll
late at night (23:55 America/Sao_Paulo) captures that day's total
delta per game. No need for intraday polling — "hours played today" is
just `playtime_forever(now) - playtime_forever(last snapshot)`.

Known limitation: a play session that crosses the poll time (e.g.
playing 23:50–00:20) has its minutes attributed to whichever day the
next poll lands on, not split precisely. Acceptable for informal
personal tracking.

## Architecture

Next.js app (App Router) deployed on Vercel, using Upstash Redis
(Vercel Marketplace integration) as the only datastore.

```
Vercel Cron (daily, 23:55 America/Sao_Paulo)
        │
        ▼
GET /api/cron/poll  ──┐
                       │  shared poll logic
POST /api/poll-now  ──┘        │
                                ▼
                    Steam Web API: GetOwnedGames
                                │
                                ▼
                    diff vs snapshot:last in Redis
                                │
                                ▼
                    HINCRBY daily:<YYYY-MM-DD> <appid> <deltaMinutes>
                    update snapshot:last, games:meta
                                │
                                ▼
GET /api/stats  ← reads daily:* + games:meta ─── frontend page renders table + chart
```

## Data model (Upstash Redis)

- `snapshot:last` — JSON string: `{ "capturedAt": ISOString, "games": { "<appid>": <playtime_forever_minutes> } }`
- `daily:<YYYY-MM-DD>` — hash, field `<appid>` → minutes played that day (built via `HINCRBY`)
- `games:meta` — hash, field `<appid>` → JSON `{ "name": string, "icon": url }`, refreshed on every poll from the API response (`include_appinfo=true`)

Dates are computed in `America/Sao_Paulo` regardless of the server's
UTC clock (Vercel functions run in UTC).

## API routes

- `GET /api/cron/poll` — invoked by Vercel Cron. Requires the
  `Authorization: Bearer $CRON_SECRET` header Vercel Cron sends
  automatically; rejects any request missing/mismatching it.
- `POST /api/poll-now` — invoked by the "Atualizar agora" button on
  the page. No auth (personal app, low-risk action — worst case is
  extra Steam API calls). Runs the same shared poll function.
- `GET /api/stats?days=30` — returns the last N days of data, games
  joined with `games:meta`, for the frontend to render. Default 30.

Shared poll function (`lib/poll.ts`):
1. Fetch `GetOwnedGames` from Steam Web API (`STEAM_API_KEY`, `STEAM_ID64` env vars), `include_appinfo=true`, `include_played_free_games=true`.
2. Read `snapshot:last` from Redis (empty on first run — first poll only seeds the snapshot, no deltas recorded, since there's nothing to diff against).
3. For each game, compute `delta = playtime_forever_now - playtime_forever_last` (skip if negative/missing — can't go backwards; treat as 0 and reset baseline).
4. If `delta > 0`, `HINCRBY daily:<today> <appid> delta` and upsert `games:meta`.
5. Overwrite `snapshot:last` with the new totals + timestamp.

## Frontend

Single page (`/`):
- "Atualizar agora" button → calls `/api/poll-now`, then re-fetches `/api/stats`.
- Table: rows grouped by date (most recent first), each row lists games played that day with hours (minutes / 60, 1 decimal).
- A simple per-day stacked bar chart (hours by game) below the table, built following the project's dataviz conventions at implementation time.

## Error handling

- Steam API unreachable or returns an error: the poll function logs and exits without touching `snapshot:last` or `daily:*` — next successful poll just has a bigger (correct) delta to distribute to whichever day it lands on.
- Profile privacy: Steam requires "Game details" set to Public for `GetOwnedGames` to return playtime, even when using your own API key against your own SteamID. This is a one-time account setting, documented in the README, not handled in code.
- Missing env vars: routes return 500 with a clear message rather than silently no-oping.

## Environment variables

- `STEAM_API_KEY`
- `STEAM_ID64`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (auto-set by the Vercel Marketplace Upstash integration)

## Testing

- Unit test the diff/delta logic in `lib/poll.ts` (pure function: given last snapshot + current API response, produce deltas) with fake data — no real Steam/Redis calls.
- Manual end-to-end check: hit `/api/poll-now` locally against a real (or test) Redis + real Steam API, confirm `daily:<today>` updates as expected.

## Out of scope

- Multi-user support / login.
- Splitting a session's minutes precisely across a midnight boundary.
- Historical backfill of days before the app started tracking (Steam doesn't expose that data).
