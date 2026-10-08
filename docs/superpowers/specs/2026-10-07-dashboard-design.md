# Dashboard UX/UI Redesign — Design

Date: 2026-10-07

## Goal
Personal dashboard to slice Steam playtime: by day/week/month, by game, over selectable ranges, with heatmap. Dark Steam-like look. Success: answer "how much, when, on what" in 1-2 clicks. UI language: Portuguese.

## Non-goals
Auth, new data sources, per-session timing, history backfill, donut chart, heatmap day-detail panel, "all-time" range (fetch capped at 1y).

## Data / API

### `GET /api/stats?days=N`
- `days`: integer 1..366, default 30. Invalid (NaN, <1, >366, non-integer) -> 400 `{error}`.
- Response shape (changed; page is only consumer):
  ```ts
  { today: string,                       // YYYY-MM-DD, America/Sao_Paulo
    meta: Record<appid, {name, icon}>,
    days: Record<date, Record<appid, minutes>> }  // only days with minutes > 0
  ```
- Header: `Cache-Control: s-maxage=300, stale-while-revalidate`.
- "Atualizar agora": POST `/api/poll-now`, then refetch with cache-buster query param.

### `lib/stats.ts`
- `getStats(days)`: one Upstash pipeline of `hgetall daily:<date>` for all dates + one `getGamesMeta`. No per-day sequential calls.
- Returns new shape above. `meta` limited to appids that appear in `days`; fallback name `App <appid>`.

### `lib/date.ts`
- `lastNDates`: UTC calendar subtraction from `todayInTZ()` (no 24h ms math).
- Add string date helpers (parse via `Date.UTC`, only `getUTC*`): `addDays`, `weekStart` (Monday), `monthStart`, `dayOfWeek`. Never use local-time `Date` parsing of `YYYY-MM-DD`.

## Client aggregation — `lib/aggregate.ts` (pure, unit-tested)
- `densify(days, today, n)`: full date list (zero days included) from server `today`.
- `bucketBy(series, 'day'|'week'|'month')`: weeks start Monday; buckets keyed by start date.
- `filterByRange`, `filterByGame`.
- `totalsByGame`: ranked list.
- `topGames(totals, 6)`: top 6 + "Outros".
- `heatmapCells`: week-column grid, zero cells included, intensity levels.
- `kpis`: total, avg per active day (days with >0 min), most-played game, longest day.
- Stable color per appid: derived from rank over the fetched 1y totals (not per-day order); "Outros" gets neutral gray.

## UI (single page, Steam dark palette: slate/blue bg, `#66c0f4` accent)
- Sticky controls: Range `7d | 30d | 90d | 1y` (default 30d), Group `Dia | Semana | Mês` (default Dia), "Atualizar agora".
- KPI row: total hours, avg per active day, top game, longest day.
- Main chart: hand-rolled SVG stacked bars per bucket (top 6 + Outros), hover tooltip, legend. Legend/list click toggles game filter (click again clears); filter applies to all panels.
- Per-game panel: ranked list with icon, hours, share bar.
- Heatmap: hand-rolled calendar grid, hover tooltip (day total + top games).
- Footnote: cron polls once daily at 23:55 BRT; play after it or across missed/manual polls lands on adjacent day, so per-day values are approximate.
- States: loading, error, empty preserved. Mobile: single-column stack, 16px gutters.
- No chart library.

## State
`range`, `group`, `game` in URL query (`?range=30&group=day&game=<appid>`), bookmarkable. Server `app/page.tsx` reads `searchParams` (Promise in Next 15) and passes initial values to a client `Dashboard` component; client updates via `router.replace(..., {scroll:false})`. Avoids `useSearchParams` Suspense build error.

## Files
- New: `app/components/{Dashboard,Controls,KpiRow,StackedBars,GameBreakdown,Heatmap}.tsx`, `lib/aggregate.ts`.
- Modified: `app/page.tsx`, `app/globals.css`, `app/api/stats/route.ts`, `lib/stats.ts`, `lib/date.ts`.
- Tests: new `tests/aggregate.test.ts`; extend `tests/date.test.ts` (week/month/year edges, leap day, `lastNDates`); rewrite `tests/stats.test.ts` (pipeline, new shape); update `tests/api-stats.test.ts` (clamp, 400, cache header, shape).

## Testing
Vitest for all pure logic and API route. Manual browser check of UI (range/group switches, game filter, URL persistence, mobile width).

## Unresolved questions
- None blocking. Defaults chosen: cache 5 min, top 6 games, drop "all".
