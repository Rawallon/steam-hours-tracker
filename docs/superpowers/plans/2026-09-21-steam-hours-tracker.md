# Steam Hours Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app, deployed on Vercel, that tracks and displays how many hours the user played each Steam game per day.

**Architecture:** A daily Vercel Cron job (plus a manual "refresh" button) polls the Steam Web API, diffs `playtime_forever` against the last stored snapshot in Upstash Redis, and books the delta minutes to that day's Redis hash. A single page reads the aggregated data and renders a table + bar chart.

**Tech Stack:** Next.js (App Router, TypeScript), `@upstash/redis`, Vitest for unit tests, Vercel Cron for scheduling.

**Spec:** `docs/superpowers/specs/2026-09-21-steam-hours-tracker-design.md`

## Global Constraints

- Cron runs **once per day only** (Vercel Hobby plan limit) at 23:55 `America/Sao_Paulo` — UTC cron expression `55 2 * * *`.
- All day-bucketing uses timezone `America/Sao_Paulo` (fixed UTC-3, no DST).
- `/api/cron/poll` requires header `Authorization: Bearer $CRON_SECRET`; the page and `/api/poll-now` have no auth (personal, low-risk app).
- Redis keys: `snapshot:last` (JSON snapshot), `daily:<YYYY-MM-DD>` (hash of appid → minutes), `games:meta` (hash of appid → `{name, icon}`).
- Steam account must have "Game details" privacy set to Public (documented in README, not enforced in code).
- Required env vars: `STEAM_API_KEY`, `STEAM_ID64`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `next-env.d.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `tests/sanity.test.ts`

**Interfaces:**
- Produces: a working Next.js App Router project (`npm run dev`, `npm run build`, `npm test` all succeed) that later tasks add files into.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "steam-hours-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@upstash/redis": "^1.34.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
export default nextConfig
```

- [ ] **Step 4: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
.next
.env.local
```

- [ ] **Step 7: Create `app/layout.tsx`**

```tsx
import './globals.css'

export const metadata = {
  title: 'Steam Hours Tracker',
  description: 'Horas jogadas por dia, por jogo, na Steam',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Create `app/page.tsx` (placeholder, replaced in Task 8)**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Steam Hours Tracker</h1>
    </main>
  )
}
```

- [ ] **Step 9: Create `app/globals.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #1b2838;
  color: #c7d5e0;
}

main {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px;
}
```

- [ ] **Step 10: Create `tests/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 11: Install dependencies**

Run: `npm install`

- [ ] **Step 12: Verify build and tests pass**

Run: `npm run build && npm test`
Expected: build succeeds, `sanity` test passes.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs next-env.d.ts vitest.config.ts .gitignore app tests
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Date utilities

**Files:**
- Create: `lib/date.ts`
- Test: `tests/date.test.ts`

**Interfaces:**
- Produces: `todayInTZ(now?: Date): string` — returns `YYYY-MM-DD` for `America/Sao_Paulo`. `lastNDates(n: number, now?: Date): string[]` — returns `n` dates, most recent first, ending at `todayInTZ(now)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { todayInTZ, lastNDates } from '../lib/date'

describe('todayInTZ', () => {
  it('formats as YYYY-MM-DD', () => {
    const result = todayInTZ(new Date('2026-01-15T12:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses America/Sao_Paulo, not UTC, near midnight', () => {
    // 2026-01-15T02:00:00Z is 2026-01-14 23:00 in America/Sao_Paulo (UTC-3)
    const result = todayInTZ(new Date('2026-01-15T02:00:00Z'))
    expect(result).toBe('2026-01-14')
  })
})

describe('lastNDates', () => {
  it('returns n dates ending at "today", most recent first', () => {
    const result = lastNDates(3, new Date('2026-01-15T12:00:00Z'))
    expect(result).toEqual(['2026-01-15', '2026-01-14', '2026-01-13'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- date.test.ts`
Expected: FAIL — `../lib/date` does not exist.

- [ ] **Step 3: Implement `lib/date.ts`**

```ts
const TIME_ZONE = 'America/Sao_Paulo'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function todayInTZ(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function lastNDates(n: number, now: Date = new Date()): string[] {
  const dates: string[] = []
  for (let i = 0; i < n; i++) {
    dates.push(todayInTZ(new Date(now.getTime() - i * ONE_DAY_MS)))
  }
  return dates
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- date.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/date.ts tests/date.test.ts
git commit -m "feat: add timezone-aware date utilities"
```

---

### Task 3: Steam client and delta computation

**Files:**
- Create: `lib/steam.ts`
- Create: `lib/poll.ts`
- Test: `tests/poll.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `OwnedGame { appid: number; name: string; playtime_forever: number; img_icon_url: string }` and `fetchOwnedGames(): Promise<OwnedGame[]>` from `lib/steam.ts`. `Snapshot { capturedAt: string; games: Record<string, number> }`, `GameMeta { name: string; icon: string }`, `iconUrl(appid: number, imgIconUrl: string): string`, and `computeDeltas(last: Snapshot | null, currentGames: OwnedGame[], now?: Date): { deltas: Record<string, number>; newSnapshot: Snapshot; metas: Record<string, GameMeta> }` from `lib/poll.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/poll.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeDeltas, iconUrl, type Snapshot } from '../lib/poll'
import type { OwnedGame } from '../lib/steam'

function game(overrides: Partial<OwnedGame>): OwnedGame {
  return { appid: 100, name: 'Test Game', playtime_forever: 0, img_icon_url: 'abc123', ...overrides }
}

describe('computeDeltas', () => {
  it('records no delta for a game seen for the first time', () => {
    const result = computeDeltas(null, [game({ appid: 1, playtime_forever: 500 })])
    expect(result.deltas).toEqual({})
    expect(result.newSnapshot.games['1']).toBe(500)
  })

  it('computes the delta for a game that gained playtime', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 560 })])
    expect(result.deltas).toEqual({ '1': 60 })
    expect(result.newSnapshot.games['1']).toBe(560)
  })

  it('ignores a game whose playtime did not change', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 500 })])
    expect(result.deltas).toEqual({})
  })

  it('treats a decrease as a baseline reset, not a negative delta', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 100 })])
    expect(result.deltas).toEqual({})
    expect(result.newSnapshot.games['1']).toBe(100)
  })

  it('handles multiple games independently', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500, '2': 200 } }
    const result = computeDeltas(last, [
      game({ appid: 1, playtime_forever: 520 }),
      game({ appid: 2, playtime_forever: 200 }),
    ])
    expect(result.deltas).toEqual({ '1': 20 })
  })

  it('builds metadata with an icon URL from appid and img_icon_url', () => {
    const result = computeDeltas(null, [game({ appid: 42, name: 'Half-Life', img_icon_url: 'hash123' })])
    expect(result.metas['42']).toEqual({
      name: 'Half-Life',
      icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/42/hash123.jpg',
    })
  })
})

describe('iconUrl', () => {
  it('returns an empty string when there is no icon hash', () => {
    expect(iconUrl(1, '')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- poll.test.ts`
Expected: FAIL — `../lib/poll` and `../lib/steam` do not exist.

- [ ] **Step 3: Implement `lib/steam.ts`**

```ts
export interface OwnedGame {
  appid: number
  name: string
  playtime_forever: number
  img_icon_url: string
}

export async function fetchOwnedGames(): Promise<OwnedGame[]> {
  const key = process.env.STEAM_API_KEY
  const steamId = process.env.STEAM_ID64
  if (!key || !steamId) {
    throw new Error('Missing STEAM_API_KEY or STEAM_ID64 environment variable')
  }

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId}&format=json&include_appinfo=true&include_played_free_games=true`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Steam API request failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.response?.games ?? []) as OwnedGame[]
}
```

- [ ] **Step 4: Implement `lib/poll.ts`**

```ts
import type { OwnedGame } from './steam'

export interface Snapshot {
  capturedAt: string
  games: Record<string, number>
}

export interface GameMeta {
  name: string
  icon: string
}

export interface DeltaResult {
  deltas: Record<string, number>
  newSnapshot: Snapshot
  metas: Record<string, GameMeta>
}

export function iconUrl(appid: number, imgIconUrl: string): string {
  if (!imgIconUrl) return ''
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${imgIconUrl}.jpg`
}

export function computeDeltas(
  last: Snapshot | null,
  currentGames: OwnedGame[],
  now: Date = new Date()
): DeltaResult {
  const lastGames = last?.games ?? {}
  const deltas: Record<string, number> = {}
  const newGames: Record<string, number> = {}
  const metas: Record<string, GameMeta> = {}

  for (const game of currentGames) {
    const appid = String(game.appid)
    const lastMinutes = lastGames[appid]
    const currentMinutes = game.playtime_forever
    newGames[appid] = currentMinutes

    if (typeof lastMinutes === 'number' && currentMinutes > lastMinutes) {
      deltas[appid] = currentMinutes - lastMinutes
    }

    metas[appid] = {
      name: game.name,
      icon: iconUrl(game.appid, game.img_icon_url),
    }
  }

  return {
    deltas,
    newSnapshot: { capturedAt: now.toISOString(), games: newGames },
    metas,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- poll.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/steam.ts lib/poll.ts tests/poll.test.ts
git commit -m "feat: add Steam client and playtime delta computation"
```

---

### Task 4: Redis data layer

**Files:**
- Create: `lib/redis.ts`
- Test: `tests/redis.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `GameMeta` types from `lib/poll.ts` (Task 3).
- Produces: `getLastSnapshot(): Promise<Snapshot | null>`, `saveSnapshot(snapshot: Snapshot): Promise<void>`, `addDailyMinutes(date: string, appid: string, minutes: number): Promise<void>`, `upsertGameMeta(appid: string, meta: GameMeta): Promise<void>`, `getGamesMeta(): Promise<Record<string, GameMeta>>`, `getDailyMinutes(date: string): Promise<Record<string, number>>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/redis.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  hincrby: vi.fn(),
  hset: vi.fn(),
  hgetall: vi.fn(),
}

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => mockRedis },
}))

import {
  getLastSnapshot,
  saveSnapshot,
  addDailyMinutes,
  upsertGameMeta,
  getGamesMeta,
  getDailyMinutes,
} from '../lib/redis'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getLastSnapshot', () => {
  it('returns null when nothing is stored', async () => {
    mockRedis.get.mockResolvedValue(null)
    expect(await getLastSnapshot()).toBeNull()
  })

  it('returns the stored snapshot', async () => {
    const snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    mockRedis.get.mockResolvedValue(snapshot)
    expect(await getLastSnapshot()).toEqual(snapshot)
    expect(mockRedis.get).toHaveBeenCalledWith('snapshot:last')
  })
})

describe('saveSnapshot', () => {
  it('stores the snapshot under snapshot:last', async () => {
    const snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    await saveSnapshot(snapshot)
    expect(mockRedis.set).toHaveBeenCalledWith('snapshot:last', snapshot)
  })
})

describe('addDailyMinutes', () => {
  it('increments the appid field on the day hash', async () => {
    await addDailyMinutes('2026-01-15', '42', 30)
    expect(mockRedis.hincrby).toHaveBeenCalledWith('daily:2026-01-15', '42', 30)
  })
})

describe('upsertGameMeta', () => {
  it('sets the appid field on the games:meta hash', async () => {
    const meta = { name: 'Half-Life', icon: 'https://example.com/icon.jpg' }
    await upsertGameMeta('42', meta)
    expect(mockRedis.hset).toHaveBeenCalledWith('games:meta', { '42': meta })
  })
})

describe('getGamesMeta', () => {
  it('returns an empty object when nothing is stored', async () => {
    mockRedis.hgetall.mockResolvedValue(null)
    expect(await getGamesMeta()).toEqual({})
  })

  it('returns the stored metadata map', async () => {
    const meta = { '42': { name: 'Half-Life', icon: 'https://example.com/icon.jpg' } }
    mockRedis.hgetall.mockResolvedValue(meta)
    expect(await getGamesMeta()).toEqual(meta)
    expect(mockRedis.hgetall).toHaveBeenCalledWith('games:meta')
  })
})

describe('getDailyMinutes', () => {
  it('returns an empty object when the day has no data', async () => {
    mockRedis.hgetall.mockResolvedValue(null)
    expect(await getDailyMinutes('2026-01-15')).toEqual({})
  })

  it('returns the stored minutes map for a day', async () => {
    const minutes = { '42': 30 }
    mockRedis.hgetall.mockResolvedValue(minutes)
    expect(await getDailyMinutes('2026-01-15')).toEqual(minutes)
    expect(mockRedis.hgetall).toHaveBeenCalledWith('daily:2026-01-15')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- redis.test.ts`
Expected: FAIL — `../lib/redis` does not exist.

- [ ] **Step 3: Implement `lib/redis.ts`**

```ts
import { Redis } from '@upstash/redis'
import type { Snapshot, GameMeta } from './poll'

const redis = Redis.fromEnv()

export async function getLastSnapshot(): Promise<Snapshot | null> {
  return (await redis.get<Snapshot>('snapshot:last')) ?? null
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await redis.set('snapshot:last', snapshot)
}

export async function addDailyMinutes(date: string, appid: string, minutes: number): Promise<void> {
  await redis.hincrby(`daily:${date}`, appid, minutes)
}

export async function upsertGameMeta(appid: string, meta: GameMeta): Promise<void> {
  await redis.hset('games:meta', { [appid]: meta })
}

export async function getGamesMeta(): Promise<Record<string, GameMeta>> {
  return (await redis.hgetall<Record<string, GameMeta>>('games:meta')) ?? {}
}

export async function getDailyMinutes(date: string): Promise<Record<string, number>> {
  return (await redis.hgetall<Record<string, number>>(`daily:${date}`)) ?? {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- redis.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/redis.ts tests/redis.test.ts
git commit -m "feat: add Redis data layer for snapshots and daily minutes"
```

---

### Task 5: Poll orchestration

**Files:**
- Modify: `lib/poll.ts`
- Test: `tests/runPoll.test.ts`

**Interfaces:**
- Consumes: `fetchOwnedGames` (Task 3), `getLastSnapshot`/`saveSnapshot`/`addDailyMinutes`/`upsertGameMeta` (Task 4), `todayInTZ` (Task 2), `computeDeltas` (this file, Task 3).
- Produces: `PollSummary { date: string; deltas: Record<string, number> }` and `runPoll(): Promise<PollSummary>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/runPoll.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/steam', () => ({ fetchOwnedGames: vi.fn() }))
vi.mock('../lib/redis', () => ({
  getLastSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  addDailyMinutes: vi.fn(),
  upsertGameMeta: vi.fn(),
}))
vi.mock('../lib/date', () => ({ todayInTZ: vi.fn() }))

import { runPoll } from '../lib/poll'
import { fetchOwnedGames } from '../lib/steam'
import { getLastSnapshot, saveSnapshot, addDailyMinutes, upsertGameMeta } from '../lib/redis'
import { todayInTZ } from '../lib/date'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runPoll', () => {
  it('stores deltas, refreshes metadata, and saves the new snapshot', async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 1, name: 'Half-Life', playtime_forever: 560, img_icon_url: 'hash1' },
    ])
    vi.mocked(getLastSnapshot).mockResolvedValue({
      capturedAt: '2026-01-01T00:00:00Z',
      games: { '1': 500 },
    })
    vi.mocked(todayInTZ).mockReturnValue('2026-01-02')

    const result = await runPoll()

    expect(result).toEqual({ date: '2026-01-02', deltas: { '1': 60 } })
    expect(addDailyMinutes).toHaveBeenCalledWith('2026-01-02', '1', 60)
    expect(upsertGameMeta).toHaveBeenCalledWith('1', {
      name: 'Half-Life',
      icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/1/hash1.jpg',
    })
    expect(saveSnapshot).toHaveBeenCalledWith({
      capturedAt: expect.any(String),
      games: { '1': 560 },
    })
  })

  it('records nothing for a game with no playtime change', async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 1, name: 'Half-Life', playtime_forever: 500, img_icon_url: 'hash1' },
    ])
    vi.mocked(getLastSnapshot).mockResolvedValue({
      capturedAt: '2026-01-01T00:00:00Z',
      games: { '1': 500 },
    })
    vi.mocked(todayInTZ).mockReturnValue('2026-01-02')

    const result = await runPoll()

    expect(result.deltas).toEqual({})
    expect(addDailyMinutes).not.toHaveBeenCalled()
  })

  it('seeds the snapshot without recording deltas on the first run', async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 1, name: 'Half-Life', playtime_forever: 500, img_icon_url: 'hash1' },
    ])
    vi.mocked(getLastSnapshot).mockResolvedValue(null)
    vi.mocked(todayInTZ).mockReturnValue('2026-01-02')

    const result = await runPoll()

    expect(result.deltas).toEqual({})
    expect(addDailyMinutes).not.toHaveBeenCalled()
    expect(saveSnapshot).toHaveBeenCalledWith({ capturedAt: expect.any(String), games: { '1': 500 } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- runPoll.test.ts`
Expected: FAIL — `runPoll` is not exported from `../lib/poll`.

- [ ] **Step 3: Add `runPoll` to `lib/poll.ts`**

Append to `lib/poll.ts` (keep the existing `computeDeltas`/`iconUrl`/types from Task 3):

```ts
import { fetchOwnedGames } from './steam'
import { getLastSnapshot, saveSnapshot, addDailyMinutes, upsertGameMeta } from './redis'
import { todayInTZ } from './date'

export interface PollSummary {
  date: string
  deltas: Record<string, number>
}

export async function runPoll(): Promise<PollSummary> {
  const [games, last] = await Promise.all([fetchOwnedGames(), getLastSnapshot()])
  const { deltas, newSnapshot, metas } = computeDeltas(last, games)
  const date = todayInTZ()

  for (const [appid, minutes] of Object.entries(deltas)) {
    await addDailyMinutes(date, appid, minutes)
  }
  for (const [appid, meta] of Object.entries(metas)) {
    await upsertGameMeta(appid, meta)
  }
  await saveSnapshot(newSnapshot)

  return { date, deltas }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- runPoll.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/poll.ts tests/runPoll.test.ts
git commit -m "feat: add runPoll orchestration"
```

---

### Task 6: Cron and manual-refresh API routes

**Files:**
- Create: `app/api/cron/poll/route.ts`
- Create: `app/api/poll-now/route.ts`
- Test: `tests/api-cron-poll.test.ts`
- Test: `tests/api-poll-now.test.ts`

**Interfaces:**
- Consumes: `runPoll` from `@/lib/poll` (Task 5).
- Produces: `GET` handler at `/api/cron/poll` (requires `Authorization: Bearer $CRON_SECRET`), `POST` handler at `/api/poll-now` (no auth). Both return `{ date, deltas }` JSON on success or `{ error }` with status 500 on failure.

- [ ] **Step 1: Write the failing tests**

Create `tests/api-cron-poll.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/poll', () => ({ runPoll: vi.fn() }))

import { GET } from '../app/api/cron/poll/route'
import { runPoll } from '@/lib/poll'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('GET /api/cron/poll', () => {
  it('rejects requests without the correct bearer token', async () => {
    const request = new Request('http://localhost/api/cron/poll')
    const response = await GET(request)
    expect(response.status).toBe(401)
    expect(runPoll).not.toHaveBeenCalled()
  })

  it('runs the poll when the bearer token matches CRON_SECRET', async () => {
    vi.mocked(runPoll).mockResolvedValue({ date: '2026-01-02', deltas: { '1': 60 } })
    const request = new Request('http://localhost/api/cron/poll', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ date: '2026-01-02', deltas: { '1': 60 } })
  })

  it('returns 500 when the poll throws', async () => {
    vi.mocked(runPoll).mockRejectedValue(new Error('Steam API down'))
    const request = new Request('http://localhost/api/cron/poll', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Steam API down' })
  })
})
```

Create `tests/api-poll-now.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/poll', () => ({ runPoll: vi.fn() }))

import { POST } from '../app/api/poll-now/route'
import { runPoll } from '@/lib/poll'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/poll-now', () => {
  it('runs the poll and returns the result', async () => {
    vi.mocked(runPoll).mockResolvedValue({ date: '2026-01-02', deltas: { '1': 60 } })
    const response = await POST()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ date: '2026-01-02', deltas: { '1': 60 } })
  })

  it('returns 500 when the poll throws', async () => {
    vi.mocked(runPoll).mockRejectedValue(new Error('Steam API down'))
    const response = await POST()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Steam API down' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api-cron-poll.test.ts api-poll-now.test.ts`
Expected: FAIL — route files do not exist.

- [ ] **Step 3: Implement `app/api/cron/poll/route.ts`**

```ts
import { runPoll } from '@/lib/poll'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await runPoll()
    return Response.json(result)
  } catch (err) {
    console.error('poll failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Implement `app/api/poll-now/route.ts`**

```ts
import { runPoll } from '@/lib/poll'

export async function POST() {
  try {
    const result = await runPoll()
    return Response.json(result)
  } catch (err) {
    console.error('poll failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- api-cron-poll.test.ts api-poll-now.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/poll/route.ts app/api/poll-now/route.ts tests/api-cron-poll.test.ts tests/api-poll-now.test.ts
git commit -m "feat: add cron and manual poll API routes"
```

---

### Task 7: Stats aggregation and API route

**Files:**
- Create: `lib/stats.ts`
- Create: `app/api/stats/route.ts`
- Test: `tests/stats.test.ts`
- Test: `tests/api-stats.test.ts`

**Interfaces:**
- Consumes: `getDailyMinutes`/`getGamesMeta` from `lib/redis.ts` (Task 4), `lastNDates` from `lib/date.ts` (Task 2).
- Produces: `DayGameStats { appid: string; name: string; icon: string; minutes: number }`, `DayStats { date: string; games: DayGameStats[] }`, `getStats(days: number): Promise<DayStats[]>` from `lib/stats.ts`; `GET` handler at `/api/stats?days=N` (default 30) returning `DayStats[]` JSON.

- [ ] **Step 1: Write the failing tests**

Create `tests/stats.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/redis', () => ({
  getDailyMinutes: vi.fn(),
  getGamesMeta: vi.fn(),
}))
vi.mock('../lib/date', () => ({ lastNDates: vi.fn() }))

import { getStats } from '../lib/stats'
import { getDailyMinutes, getGamesMeta } from '../lib/redis'
import { lastNDates } from '../lib/date'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getStats', () => {
  it('joins daily minutes with game metadata, sorted by minutes descending', async () => {
    vi.mocked(lastNDates).mockReturnValue(['2026-01-02'])
    vi.mocked(getGamesMeta).mockResolvedValue({
      '1': { name: 'Half-Life', icon: 'icon1.jpg' },
      '2': { name: 'Portal', icon: 'icon2.jpg' },
    })
    vi.mocked(getDailyMinutes).mockResolvedValue({ '1': 30, '2': 90 })

    const result = await getStats(1)

    expect(result).toEqual([
      {
        date: '2026-01-02',
        games: [
          { appid: '2', name: 'Portal', icon: 'icon2.jpg', minutes: 90 },
          { appid: '1', name: 'Half-Life', icon: 'icon1.jpg', minutes: 30 },
        ],
      },
    ])
  })

  it('falls back to a generic name for a game missing from metadata', async () => {
    vi.mocked(lastNDates).mockReturnValue(['2026-01-02'])
    vi.mocked(getGamesMeta).mockResolvedValue({})
    vi.mocked(getDailyMinutes).mockResolvedValue({ '9': 15 })

    const result = await getStats(1)

    expect(result[0].games[0]).toEqual({ appid: '9', name: 'App 9', icon: '', minutes: 15 })
  })

  it('omits days with no recorded playtime', async () => {
    vi.mocked(lastNDates).mockReturnValue(['2026-01-02', '2026-01-01'])
    vi.mocked(getGamesMeta).mockResolvedValue({})
    vi.mocked(getDailyMinutes)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ '1': 10 })

    const result = await getStats(2)

    expect(result).toEqual([{ date: '2026-01-01', games: [{ appid: '1', name: 'App 1', icon: '', minutes: 10 }] }])
  })
})
```

Create `tests/api-stats.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/stats', () => ({ getStats: vi.fn() }))

import { GET } from '../app/api/stats/route'
import { getStats } from '@/lib/stats'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/stats', () => {
  it('defaults to 30 days when no query param is given', async () => {
    vi.mocked(getStats).mockResolvedValue([])
    const request = new Request('http://localhost/api/stats')
    await GET(request)
    expect(getStats).toHaveBeenCalledWith(30)
  })

  it('passes through the days query param', async () => {
    vi.mocked(getStats).mockResolvedValue([{ date: '2026-01-02', games: [] }])
    const request = new Request('http://localhost/api/stats?days=7')
    const response = await GET(request)
    expect(getStats).toHaveBeenCalledWith(7)
    expect(await response.json()).toEqual([{ date: '2026-01-02', games: [] }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- stats.test.ts api-stats.test.ts`
Expected: FAIL — `lib/stats.ts` and `app/api/stats/route.ts` do not exist.

- [ ] **Step 3: Implement `lib/stats.ts`**

```ts
import { getDailyMinutes, getGamesMeta } from './redis'
import { lastNDates } from './date'

export interface DayGameStats {
  appid: string
  name: string
  icon: string
  minutes: number
}

export interface DayStats {
  date: string
  games: DayGameStats[]
}

export async function getStats(days: number): Promise<DayStats[]> {
  const dates = lastNDates(days)
  const meta = await getGamesMeta()
  const result: DayStats[] = []

  for (const date of dates) {
    const minutes = await getDailyMinutes(date)
    const games = Object.entries(minutes)
      .filter(([, m]) => m > 0)
      .map(([appid, m]) => ({
        appid,
        name: meta[appid]?.name ?? `App ${appid}`,
        icon: meta[appid]?.icon ?? '',
        minutes: m,
      }))
      .sort((a, b) => b.minutes - a.minutes)

    if (games.length > 0) {
      result.push({ date, games })
    }
  }

  return result
}
```

- [ ] **Step 4: Implement `app/api/stats/route.ts`**

```ts
import { getStats } from '@/lib/stats'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? '30')
  const data = await getStats(days)
  return Response.json(data)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- stats.test.ts api-stats.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/stats.ts app/api/stats/route.ts tests/stats.test.ts tests/api-stats.test.ts
git commit -m "feat: add stats aggregation and API route"
```

---

### Task 8: Frontend page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `GET /api/stats?days=30` (Task 7), `POST /api/poll-now` (Task 6).
- Produces: the only user-facing page, no exports consumed by other tasks.

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'

interface DayGameStats {
  appid: string
  name: string
  icon: string
  minutes: number
}

interface DayStats {
  date: string
  games: DayGameStats[]
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1)
}

const COLORS = ['#66c0f4', '#c6f4d6', '#f4d166', '#f47f66', '#a866f4', '#f466cf']

function colorFor(index: number): string {
  return COLORS[index % COLORS.length]
}

export default function Home() {
  const [stats, setStats] = useState<DayStats[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/stats?days=30')
    const data = await res.json()
    setStats(data)
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/poll-now', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Falha ao atualizar')
      }
      await loadStats()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main>
      <h1>Steam Hours Tracker</h1>
      <button onClick={handleRefresh} disabled={refreshing}>
        {refreshing ? 'Atualizando...' : 'Atualizar agora'}
      </button>
      {error && <p className="error">{error}</p>}
      {stats === null && <p>Carregando...</p>}
      {stats !== null && stats.length === 0 && <p>Nenhum dado registrado ainda.</p>}
      {stats?.map((day) => {
        const total = day.games.reduce((sum, g) => sum + g.minutes, 0)
        return (
          <section key={day.date} className="day">
            <h2>{day.date}</h2>
            <div className="bar">
              {day.games.map((game, i) => (
                <div
                  key={game.appid}
                  className="bar-segment"
                  style={{ width: `${(game.minutes / total) * 100}%`, backgroundColor: colorFor(i) }}
                  title={`${game.name}: ${formatHours(game.minutes)}h`}
                />
              ))}
            </div>
            <table>
              <tbody>
                {day.games.map((game) => (
                  <tr key={game.appid}>
                    <td>{game.name}</td>
                    <td>{formatHours(game.minutes)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </main>
  )
}
```

- [ ] **Step 2: Append styles to `app/globals.css`**

```css
button {
  background: #66c0f4;
  color: #1b2838;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: #f47f66;
}

.day {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #2a3f5a;
}

.bar {
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 4px 0;
}

td:last-child {
  text-align: right;
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: page shows "Carregando...", then "Nenhum dado registrado ainda." (no `.env.local` yet, so `/api/stats` returns `[]` — Redis calls will fail without env vars; if that happens instead, confirm the page still renders without crashing and shows the loading state before the fetch settles). Click "Atualizar agora": button shows "Atualizando...", then an error message appears (expected, since `STEAM_API_KEY`/Redis env vars aren't set yet) instead of the page crashing.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat: add stats table, bar chart, and manual refresh button"
```

---

### Task 9: Deployment config and setup docs

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (final wiring/documentation task).
- Produces: a deployable repo with documented setup steps.

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/poll",
      "schedule": "55 2 * * *"
    }
  ]
}
```

- [ ] **Step 2: Create `.env.example`**

```
STEAM_API_KEY=
STEAM_ID64=
CRON_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 3: Create `README.md`**

```md
# Steam Hours Tracker

Rastreia quantas horas você jogou cada jogo da Steam, por dia, e mostra numa página.

## Como funciona

Uma vez por dia (23:55, horário de Brasília), um cron job da Vercel busca seu
tempo total jogado em cada jogo na Steam Web API e compara com o snapshot do
dia anterior. A diferença vira "horas jogadas hoje" para cada jogo. Também dá
pra forçar essa atualização a qualquer momento clicando em "Atualizar agora"
na página.

## Setup

### 1. Steam API key e SteamID64

- Gere uma key em https://steamcommunity.com/dev/apikey
- Pegue seu SteamID64 (ex: via https://steamid.io/)
- Nas configurações de privacidade da Steam, deixe "Detalhes do jogo" como
  Público — sem isso a API não retorna tempo jogado, mesmo usando sua própria
  key.

### 2. Upstash Redis

No dashboard da Vercel, adicione a integração Upstash Redis (Marketplace) ao
projeto. Isso preenche `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
automaticamente nas env vars do projeto.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` para rodar localmente, preenchendo
`STEAM_API_KEY`, `STEAM_ID64` e um `CRON_SECRET` (qualquer string aleatória).
Na Vercel, adicione as mesmas três variáveis em Project Settings → Environment
Variables (as duas do Upstash já vêm da integração).

### 4. Deploy

```bash
npm install
vercel --prod
```

O cron configurado em `vercel.json` já entra em ação automaticamente após o
deploy.

### 5. Testar

- Localmente: `npm run dev`, clique em "Atualizar agora" (vai dar erro sem as
  env vars reais preenchidas em `.env.local`).
- Em produção: abra a página publicada e clique em "Atualizar agora", ou
  dispare o cron manualmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-APP.vercel.app/api/cron/poll
```

## Rodando os testes

```bash
npm test
```
```

- [ ] **Step 4: Verify the full build one last time**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add vercel.json .env.example README.md
git commit -m "docs: add deployment config and setup instructions"
```
