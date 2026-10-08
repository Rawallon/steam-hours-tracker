# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement. Steps use checkbox syntax.

**Goal:** Replace the day-list page with an interactive dark dashboard (range, group, per-game filter, KPIs, stacked bars, heatmap).

**Architecture:** `/api/stats` returns a compact `{today, meta, days}` payload for up to 366 days via one Redis pipeline. Client fetches once, `lib/aggregate.ts` (pure) does all slicing. Hand-rolled SVG/CSS charts. View state in URL query, read by a server `page.tsx` and passed to a client `Dashboard`.

**Tech Stack:** Next 15 App Router, React 19, TypeScript, Upstash Redis, Vitest. No new deps.

**Spec:** `docs/superpowers/specs/2026-10-07-dashboard-design.md`

## Global Constraints
- No chart library; no new npm deps.
- UI copy in Portuguese. Dates are `YYYY-MM-DD` strings in America/Sao_Paulo; **never** `new Date('YYYY-MM-DD')` with local getters — use `Date.UTC` + `getUTC*` only.
- Weeks start Monday. `days` param clamp: integer 1..366 else 400.
- Cache header: `Cache-Control: s-maxage=300, stale-while-revalidate`.
- Top 6 games + "Outros". Ranges: 7/30/90/365 (default 30). Group: day/week/month (default day).
- Mobile: single column, 16px gutters, no horizontal page scroll.
- Run `npx vitest run` and `npx tsc --noEmit` before each commit.

## Review Focus
- Week bucket across year boundary (2025-12-29 Mon .. 2026-01-04 Sun) and leap day 2028-02-29.
- `days=abc`, `0`, `367`, `1.5` → 400; empty Redis → `{today, meta:{}, days:{}}` renders empty state, no crash.
- Game with 0 minutes in range selected via URL `?game=` → graceful empty chart, clearable.
- Division by zero: all-zero range (bars, share %, heatmap levels, avg per active day).
- Unknown/garbled URL params (`?range=zzz&group=x`) fall back to defaults.

---

### Task 1: Date helpers

**Files:** Modify `lib/date.ts`, `tests/date.test.ts`

**Produces:** `addDays(date: string, n: number): string`, `weekStart(date: string): string` (Monday), `monthStart(date: string): string`, `dayOfWeek(date: string): number` (0=Mon..6=Sun); `lastNDates(n, now?)` still returns newest-first, now via `addDays(todayInTZ(now), -i)`.

- [ ] **Step 1:** Add failing tests to `tests/date.test.ts`:
```ts
import { addDays, weekStart, monthStart, dayOfWeek, lastNDates } from '../lib/date'
it('addDays crosses month/year/leap', () => {
  expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
})
it('weekStart is Monday', () => {
  expect(weekStart('2026-01-01')).toBe('2025-12-29') // Thu
  expect(weekStart('2025-12-29')).toBe('2025-12-29') // Mon
  expect(weekStart('2026-01-04')).toBe('2025-12-29') // Sun
})
it('monthStart/dayOfWeek', () => {
  expect(monthStart('2026-03-17')).toBe('2026-03-01')
  expect(dayOfWeek('2025-12-29')).toBe(0)
  expect(dayOfWeek('2026-01-04')).toBe(6)
})
it('lastNDates newest first, calendar-correct', () => {
  const r = lastNDates(3, new Date('2026-03-01T12:00:00Z'))
  expect(r).toEqual(['2026-03-01', '2026-02-28', '2026-02-27'])
})
```
- [ ] **Step 2:** `npx vitest run tests/date.test.ts` → FAIL.
- [ ] **Step 3:** Implement in `lib/date.ts`:
```ts
function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function addDays(date: string, n: number): string {
  const d = toUTC(date); d.setUTCDate(d.getUTCDate() + n); return fmt(d)
}
export function dayOfWeek(date: string): number {
  return (toUTC(date).getUTCDay() + 6) % 7
}
export function weekStart(date: string): string { return addDays(date, -dayOfWeek(date)) }
export function monthStart(date: string): string { return date.slice(0, 8) + '01' }
export function lastNDates(n: number, now: Date = new Date()): string[] {
  const today = todayInTZ(now)
  return Array.from({ length: n }, (_, i) => addDays(today, -i))
}
```
(remove `ONE_DAY_MS` if unused.)
- [ ] **Step 4:** tests PASS. **Step 5:** commit `feat: UTC-safe date helpers`.

### Task 2: Stats pipeline, new shape, route clamp + cache

**Files:** Modify `lib/redis.ts`, `lib/stats.ts`, `app/api/stats/route.ts`; Tests `tests/stats.test.ts` (rewrite), `tests/api-stats.test.ts` (update), `tests/redis.test.ts` (add batch test if file mocks the client)

**Consumes:** `lastNDates`.
**Produces:**
```ts
// redis.ts
getDailyMinutesBatch(dates: string[]): Promise<Record<string, Record<string, number>>>  // single pipeline of hgetall daily:<date>; null → {}
// stats.ts
export interface StatsResponse { today: string; meta: Record<string,{name:string;icon:string}>; days: Record<string, Record<string, number>> }
getStats(days: number): Promise<StatsResponse>   // days map only includes dates with >0 total; entries with m<=0 dropped; meta only for appids present, fallback name `App ${appid}`, icon ''
```
- [ ] **Step 1:** Read existing `tests/stats.test.ts`, `tests/api-stats.test.ts`, `tests/redis.test.ts` to match mocking style. Rewrite stats test to mock `getDailyMinutesBatch` + `getGamesMeta`; assert shape, zero-day omission, fallback name, `today` equals `lastNDates(1)[0]`. API test: `days=abc|0|367|1.5` → 400; default 30; valid → 200 with header `Cache-Control: s-maxage=300, stale-while-revalidate`; thrown error → 500.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. redis: `const p = redis.pipeline(); dates.forEach(d => p.hgetall(`daily:${d}`)); const res = await p.exec()`; map `res[i] ?? {}` (coerce values to Number). Route:
```ts
const raw = searchParams.get('days') ?? '30'
const days = Number(raw)
if (!Number.isInteger(days) || days < 1 || days > 366)
  return Response.json({ error: 'days must be an integer 1..366' }, { status: 400 })
```
success: `Response.json(data, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' } })`.
- [ ] **Step 4:** `npx vitest run` + `npx tsc --noEmit` pass. **Step 5:** commit `feat: pipelined stats with compact response`.

### Task 3: Aggregation lib

**Files:** Create `lib/aggregate.ts`, `tests/aggregate.test.ts`

**Consumes:** `addDays, weekStart, monthStart, dayOfWeek` from `./date`.
**Produces (exact):**
```ts
export type Group = 'day' | 'week' | 'month'
export type DayMap = Record<string, Record<string, number>>
export interface DayPoint { date: string; byGame: Record<string, number> }          // ascending, zero days included
export interface Bucket { key: string; byGame: Record<string, number>; total: number } // key = bucket start date, ascending
export interface GameTotal { appid: string; minutes: number }                          // desc by minutes
export interface Cell { date: string; minutes: number; level: 0|1|2|3|4; col: number; row: number } // row 0=Mon
export const OTHER = 'other'
densify(days: DayMap, today: string, n: number): DayPoint[]          // n days ending at today, ascending
filterByGame(series: DayPoint[], appid: string | null): DayPoint[]   // null → unchanged; keeps only that appid in byGame
bucketBy(series: DayPoint[], group: Group): Bucket[]
totalsByGame(series: DayPoint[]): GameTotal[]
topIds(totals: GameTotal[], n = 6): string[]
stackOf(bucket: Bucket, top: string[]): { appid: string; minutes: number }[]  // top order, then OTHER if remainder > 0; zero entries omitted
colorMap(totals: GameTotal[]): Record<string, string>  // palette by rank over provided totals; OTHER → '#4b5563'
heatmapCells(series: DayPoint[]): Cell[]   // col = week index from weekStart(first date); level 0 if 0 else quartile of max (1..4)
kpis(series: DayPoint[]): { total: number; activeDays: number; avgPerActiveDay: number; topAppid: string | null; longest: { date: string; minutes: number } | null }
```
Palette (6): `['#66c0f4','#a4d007','#f4b942','#f4695e','#b180f4','#4fd1c5']`.
- [ ] **Step 1:** Write tests covering: densify fills zeros & length n & ascending; bucketBy week crossing 2025-12-29/2026-01-04 and month boundary, bucket totals; filterByGame; totalsByGame ordering; topIds + stackOf with 8 games → 6 + OTHER sums to total; colorMap stability (same appid same color regardless of series subset when computed from the same totals); heatmapCells col/row for known dates, all-zero series → all level 0, max day → level 4; kpis all-zero → `avgPerActiveDay 0, topAppid null, longest null` (no NaN).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (pure, no Date local getters). Level: `Math.min(4, Math.ceil(minutes / max * 4))` for minutes>0.
- [ ] **Step 4:** pass + tsc. **Step 5:** commit `feat: pure aggregation helpers`.

### Task 4: Dashboard UI

**Files:** Modify `app/page.tsx`, `app/globals.css`, `app/layout.tsx` (lang `pt-BR`, title); Create `app/components/{Dashboard,Controls,KpiRow,StackedBars,GameBreakdown,Heatmap}.tsx`, `lib/format.ts` (`formatMinutes` moved from page, keeps `Xh Ymin` format) + `tests/format.test.ts`.

**Consumes:** `StatsResponse` (type import from `@/lib/stats`), all of `lib/aggregate.ts`.
**Produces:** `parseView(sp: {range?: string; group?: string; game?: string}): {range: 7|30|90|365; group: Group; game: string|null}` exported from `lib/view.ts` with `tests/view.test.ts` (garbled → defaults 30/day/null).

Behavior:
- `app/page.tsx` (server): `const sp = await searchParams` (Promise in Next 15); `<Dashboard initial={parseView(sp)} />`.
- `Dashboard` ('use client'): fetch `/api/stats?days=365` once; keeps `range/group/game` state; on change `router.replace(\`?range=..&group=..&game=..\`, { scroll: false })` (omit `game` when null). Refresh button: POST `/api/poll-now` then refetch `/api/stats?days=365&t=${Date.now()}`. Keeps loading/error/empty states (copy: `Carregando...`, `Nenhum dado registrado ainda.`). Derived via `useMemo`: `densify(days, today, 365)` once; `slice(-range)`; totals/colors computed from the full-365 series (stable colors), filtered series from range + game.
- `Controls`: sticky top bar; segmented buttons Range `7d 30d 90d 1a`, Group `Dia Semana Mês`; refresh button; active state styled; `aria-pressed`.
- `KpiRow`: 4 tiles: Total (h), Média/dia ativo, Jogo mais jogado (icon+name), Maior dia (date + time).
- `StackedBars`: SVG, `viewBox` responsive, `width:100%`; one bar per bucket, segments via `stackOf`/`colorMap`; hover/focus tooltip (bucket label, per-game minutes, total); x labels thinned to avoid overlap; y axis hours with 4 ticks; legend below (click toggles game filter; `OTHER` not clickable). Horizontal scroll inside the chart container only when >60 buckets.
- `GameBreakdown`: ranked list (icon `<img>` w/ fallback, name, formatted time, share bar `%`); click toggles filter; selected row highlighted; "Limpar filtro" when selected.
- `Heatmap`: CSS grid, columns = weeks, rows Mon..Sun, cell color by level (5 steps of accent), month labels on top, tooltip `title`+custom hover showing date, total and top 3 games; container scrolls horizontally internally on mobile.
- Footnote under the heatmap: "Coleta diária às 23:55 (BRT): horas jogadas após isso ou entre coletas podem cair no dia seguinte."
- CSS: Steam dark palette (`--bg:#171a21; --panel:#1b2838; --panel-2:#16202d; --text:#c7d5e0; --muted:#8f98a0; --accent:#66c0f4`), CSS variables, cards with 1px borders, `max-width:1100px`, grid for KPI (4 → 2 → 1 cols), `@media (max-width: 640px)` single column with 16px gutters. Visible focus rings. No horizontal page scroll.

- [ ] **Step 1:** Write failing tests for `formatMinutes` (0→`0min`, 60→`1h`, 90→`1h 30min`) and `parseView`. **Step 2:** FAIL. **Step 3:** implement format/view libs. **Step 4:** PASS.
- [ ] **Step 5:** Build components + CSS per behavior above; remove old page body. **Step 6:** `npx tsc --noEmit`, `npx vitest run`, `npx next build` all succeed. **Step 7:** Manual check: `npm run dev` with mocked `/api/stats` response if Redis env missing (temporary local fixture, not committed); verify range/group/filter/URL persist/mobile width 375px. **Step 8:** commit `feat: interactive dashboard UI`.

### Task 5: Docs
- [ ] Update `README.md` stats section (new response shape, `days` 1..366, cache). Commit `docs: update stats api docs`.

## Self-review
- Spec coverage: data/API (T2), date (T1), aggregate (T3), UI/state/footnote (T4), tests across tasks, docs (T5). Donut/“all”/day-detail panel intentionally absent.
- Type names consistent across tasks: `StatsResponse`, `DayPoint`, `Bucket`, `GameTotal`, `Cell`, `OTHER`, `Group`.
