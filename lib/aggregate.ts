import { addDays, weekStart, monthStart, dayOfWeek } from './date'

export type Group = 'day' | 'week' | 'month'
export type DayMap = Record<string, Record<string, number>>
export interface DayPoint {
  date: string
  byGame: Record<string, number>
}
export interface Bucket {
  key: string
  byGame: Record<string, number>
  total: number
}
export interface GameTotal {
  appid: string
  minutes: number
}
export interface Cell {
  date: string
  minutes: number
  level: 0 | 1 | 2 | 3 | 4
  col: number
  row: number
}

export const OTHER = 'other'
export const OTHER_COLOR = '#4b5563'
export const PALETTE = ['#66c0f4', '#a4d007', '#f4b942', '#f4695e', '#b180f4', '#4fd1c5']

const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0)

/** n days ending at `today`, ascending, zero days included. */
export function densify(days: DayMap, today: string, n: number): DayPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, -(n - 1 - i))
    return { date, byGame: days[date] ?? {} }
  })
}

export function filterByGame(series: DayPoint[], appid: string | null): DayPoint[] {
  if (appid === null) return series
  return series.map((p) => ({
    date: p.date,
    byGame: p.byGame[appid] ? { [appid]: p.byGame[appid] } : {},
  }))
}

export function bucketBy(series: DayPoint[], group: Group): Bucket[] {
  const keyOf = (d: string) => (group === 'week' ? weekStart(d) : group === 'month' ? monthStart(d) : d)
  const map = new Map<string, Bucket>()
  for (const p of series) {
    const key = keyOf(p.date)
    let b = map.get(key)
    if (!b) {
      b = { key, byGame: {}, total: 0 }
      map.set(key, b)
    }
    for (const [appid, m] of Object.entries(p.byGame)) {
      b.byGame[appid] = (b.byGame[appid] ?? 0) + m
      b.total += m
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export function totalsByGame(series: DayPoint[]): GameTotal[] {
  const t: Record<string, number> = {}
  for (const p of series) for (const [a, m] of Object.entries(p.byGame)) t[a] = (t[a] ?? 0) + m
  return Object.entries(t)
    .map(([appid, minutes]) => ({ appid, minutes }))
    .sort((a, b) => b.minutes - a.minutes || (a.appid < b.appid ? -1 : 1))
}

export function topIds(totals: GameTotal[], n = 6): string[] {
  return totals.slice(0, n).map((t) => t.appid)
}

export function stackOf(bucket: Bucket, top: string[]): { appid: string; minutes: number }[] {
  const out = top
    .filter((a) => (bucket.byGame[a] ?? 0) > 0)
    .map((appid) => ({ appid, minutes: bucket.byGame[appid] }))
  const rest = bucket.total - sum(Object.fromEntries(out.map((e) => [e.appid, e.minutes])))
  if (rest > 0) out.push({ appid: OTHER, minutes: rest })
  return out
}

export function colorMap(totals: GameTotal[]): Record<string, string> {
  const map: Record<string, string> = { [OTHER]: OTHER_COLOR }
  totals.forEach((t, i) => {
    // beyond the palette: golden-angle hues, never the "Outros" gray, so any game
    // that reaches the top 6 of a narrower range keeps a distinct stable color
    map[t.appid] = i < PALETTE.length ? PALETTE[i] : `hsl(${Math.round((i * 137.508) % 360)} 55% 62%)`
  })
  return map
}

export function heatmapCells(series: DayPoint[]): Cell[] {
  if (series.length === 0) return []
  const origin = weekStart(series[0].date)
  const totals = series.map((p) => sum(p.byGame))
  const max = Math.max(0, ...totals)
  return series.map((p, i) => {
    const minutes = totals[i]
    const level = (minutes > 0 && max > 0 ? Math.min(4, Math.ceil((minutes / max) * 4)) : 0) as Cell['level']
    const col = Math.round(
      (Date.parse(weekStart(p.date) + 'T00:00:00Z') - Date.parse(origin + 'T00:00:00Z')) / (7 * 86400000)
    )
    return { date: p.date, minutes, level, col, row: dayOfWeek(p.date) }
  })
}

export function kpis(series: DayPoint[]): {
  total: number
  activeDays: number
  avgPerActiveDay: number
  topAppid: string | null
  longest: { date: string; minutes: number } | null
} {
  let total = 0
  let activeDays = 0
  let longest: { date: string; minutes: number } | null = null
  for (const p of series) {
    const m = sum(p.byGame)
    total += m
    if (m > 0) {
      activeDays++
      if (!longest || m > longest.minutes) longest = { date: p.date, minutes: m }
    }
  }
  const top = totalsByGame(series)[0]
  return {
    total,
    activeDays,
    avgPerActiveDay: activeDays > 0 ? total / activeDays : 0,
    topAppid: top ? top.appid : null,
    longest,
  }
}
