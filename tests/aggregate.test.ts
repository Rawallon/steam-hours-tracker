import { describe, it, expect } from 'vitest'
import {
  densify,
  filterByGame,
  bucketBy,
  totalsByGame,
  topIds,
  stackOf,
  colorMap,
  heatmapCells,
  kpis,
  weekdayWeekend,
  cumulative,
  streaks,
  profile,
  ribbon,
  monthGrid,
  OTHER,
  type DayPoint,
} from '../lib/aggregate'

const pt = (date: string, byGame: Record<string, number> = {}): DayPoint => ({ date, byGame })

describe('densify', () => {
  it('fills zeros, length n, ascending', () => {
    const r = densify({ '2026-03-01': { '1': 10 } }, '2026-03-01', 3)
    expect(r.map((p) => p.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
    expect(r[0].byGame).toEqual({})
    expect(r[2].byGame).toEqual({ '1': 10 })
  })
  it('handles leap day', () => {
    expect(densify({}, '2028-03-01', 2).map((p) => p.date)).toEqual(['2028-02-29', '2028-03-01'])
  })
})

describe('filterByGame', () => {
  const s = [pt('2026-01-01', { '1': 5, '2': 7 })]
  it('null leaves unchanged', () => expect(filterByGame(s, null)).toEqual(s))
  it('keeps only appid', () => expect(filterByGame(s, '2')[0].byGame).toEqual({ '2': 7 }))
  it('absent game yields empty byGame', () => expect(filterByGame(s, '9')[0].byGame).toEqual({}))
})

describe('bucketBy', () => {
  const s = ['2025-12-28', '2025-12-29', '2026-01-04', '2026-01-05', '2026-01-31', '2026-02-01'].map((d, i) =>
    pt(d, { '1': 10 * (i + 1) })
  )
  it('day is identity-ish', () => {
    const b = bucketBy(s, 'day')
    expect(b).toHaveLength(6)
    expect(b[0]).toEqual({ key: '2025-12-28', byGame: { '1': 10 }, total: 10 })
  })
  it('week crosses year boundary, Monday start', () => {
    const b = bucketBy(s, 'week')
    expect(b.map((x) => x.key)).toEqual(['2025-12-22', '2025-12-29', '2026-01-05', '2026-01-26'])
    expect(b[0].total).toBe(10)
    expect(b[1].total).toBe(20 + 30)
    expect(b[2].total).toBe(40)
    expect(b[3].total).toBe(110)
  })
  it('month boundary', () => {
    const b = bucketBy(s, 'month')
    expect(b.map((x) => x.key)).toEqual(['2025-12-01', '2026-01-01', '2026-02-01'])
    expect(b[1].total).toBe(30 + 40 + 50)
    expect(b[1].byGame).toEqual({ '1': 120 })
  })
})

describe('totalsByGame / topIds / stackOf', () => {
  const s = [pt('2026-01-01', { a: 5, b: 50 }), pt('2026-01-02', { a: 10, c: 1 })]
  it('orders desc', () => {
    expect(totalsByGame(s)).toEqual([
      { appid: 'b', minutes: 50 },
      { appid: 'a', minutes: 15 },
      { appid: 'c', minutes: 1 },
    ])
  })
  it('8 games -> top 6 + other sums to total', () => {
    const by: Record<string, number> = {}
    for (let i = 1; i <= 8; i++) by[`g${i}`] = i * 10
    const series = [pt('2026-01-01', by)]
    const top = topIds(totalsByGame(series))
    expect(top).toHaveLength(6)
    const [bucket] = bucketBy(series, 'day')
    const st = stackOf(bucket, top)
    expect(st).toHaveLength(7)
    expect(st[6].appid).toBe(OTHER)
    expect(st.reduce((a, e) => a + e.minutes, 0)).toBe(bucket.total)
  })
  it('omits zero entries and other when no remainder', () => {
    const [bucket] = bucketBy([pt('2026-01-01', { a: 5 })], 'day')
    expect(stackOf(bucket, ['a', 'b'])).toEqual([{ appid: 'a', minutes: 5 }])
  })
})

describe('colorMap', () => {
  it('is stable for same totals and OTHER gray', () => {
    const totals = [
      { appid: 'x', minutes: 9 },
      { appid: 'y', minutes: 5 },
    ]
    const a = colorMap(totals)
    expect(a).toEqual(colorMap(totals))
    expect(a.x).not.toBe(a.y)
    expect(a[OTHER]).toBe('#4b5563')
  })
  it('games beyond the palette get distinct non-gray colors', () => {
    const totals = Array.from({ length: 12 }, (_, i) => ({ appid: String(i), minutes: 100 - i }))
    const a = colorMap(totals)
    const vals = totals.map((t) => a[t.appid])
    expect(new Set(vals).size).toBe(12)
    expect(vals).not.toContain('#4b5563')
  })
})

describe('heatmapCells', () => {
  it('col/row for known dates', () => {
    // 2025-12-31 Wed, 2026-01-01 Thu, 2026-01-05 Mon next week
    const cells = heatmapCells([pt('2025-12-31', { a: 1 }), pt('2026-01-01'), pt('2026-01-05', { a: 4 })])
    expect(cells.map((c) => [c.col, c.row])).toEqual([
      [0, 2],
      [0, 3],
      [1, 0],
    ])
  })
  it('all zero -> level 0', () => {
    expect(heatmapCells([pt('2026-01-01'), pt('2026-01-02')]).every((c) => c.level === 0)).toBe(true)
  })
  it('max day -> level 4, small -> 1', () => {
    const cells = heatmapCells([pt('2026-01-05', { a: 100 }), pt('2026-01-06', { a: 1 })])
    expect(cells[0].level).toBe(4)
    expect(cells[1].level).toBe(1)
  })
  it('empty series', () => expect(heatmapCells([])).toEqual([]))
})

describe('kpis', () => {
  it('all-zero -> no NaN', () => {
    expect(kpis([pt('2026-01-01'), pt('2026-01-02')])).toEqual({
      total: 0,
      activeDays: 0,
      avgPerActiveDay: 0,
      topAppid: null,
      longest: null,
    })
  })
  it('computes values', () => {
    const k = kpis([pt('2026-01-01', { a: 30 }), pt('2026-01-02'), pt('2026-01-03', { a: 10, b: 50 })])
    expect(k).toEqual({
      total: 90,
      activeDays: 2,
      avgPerActiveDay: 45,
      topAppid: 'b',
      longest: { date: '2026-01-03', minutes: 60 },
    })
  })
  it('empty series', () => expect(kpis([]).topAppid).toBeNull())
})

describe('weekdayWeekend', () => {
  it('splits Mon-Fri vs Sat/Sun over active days', () => {
    // 2026-10-02 Fri, 03 Sat, 04 Sun, 05 Mon
    const r = weekdayWeekend([
      pt('2026-10-02', { '1': 60 }),
      pt('2026-10-03', { '1': 120, '2': 60 }),
      pt('2026-10-04', { '1': 180 }),
      pt('2026-10-05'),
    ])
    expect(r.weekday).toEqual({ total: 60, days: 1, avg: 60 })
    expect(r.weekend).toEqual({ total: 360, days: 2, avg: 180 })
    expect(r.ratio).toBe(3)
  })
  it('null ratio and zero avg when a side is empty or series empty', () => {
    expect(weekdayWeekend([]).ratio).toBeNull()
    const r = weekdayWeekend([pt('2026-10-05', { '1': 30 }), pt('2026-10-06')])
    expect(r.weekend).toEqual({ total: 0, days: 0, avg: 0 })
    expect(r.ratio).toBeNull()
    const r2 = weekdayWeekend([pt('2026-10-03', { '1': 30 })])
    expect(r2.weekday.avg).toBe(0)
    expect(r2.ratio).toBeNull()
  })
})

describe('cumulative', () => {
  it('running total including zero days', () => {
    const r = cumulative([pt('2026-12-31', { '1': 10 }), pt('2027-01-01'), pt('2027-01-02', { '1': 5, '2': 5 })])
    expect(r).toEqual([
      { date: '2026-12-31', minutes: 10 },
      { date: '2027-01-01', minutes: 10 },
      { date: '2027-01-02', minutes: 20 },
    ])
  })
  it('empty', () => {
    expect(cumulative([])).toEqual([])
  })
})

describe('streaks', () => {
  it('longest across month boundary, current ending at last day', () => {
    const s = [
      pt('2026-01-29', { '1': 1 }),
      pt('2026-01-30', { '1': 1 }),
      pt('2026-01-31', { '1': 1 }),
      pt('2026-02-01', { '1': 1 }),
      pt('2026-02-02'),
      pt('2026-02-03', { '1': 1 }),
      pt('2026-02-04', { '1': 1 }),
    ]
    expect(streaks(s)).toEqual({ longest: { start: '2026-01-29', end: '2026-02-01', days: 4 }, current: 2 })
  })
  it('current 0 when last day is zero; first longest wins ties', () => {
    const s = [pt('2026-03-01', { '1': 1 }), pt('2026-03-02'), pt('2026-03-03', { '1': 1 }), pt('2026-03-04')]
    expect(streaks(s)).toEqual({ longest: { start: '2026-03-01', end: '2026-03-01', days: 1 }, current: 0 })
  })
  it('empty and all-zero', () => {
    expect(streaks([])).toEqual({ longest: null, current: 0 })
    expect(streaks([pt('2026-03-01'), pt('2026-03-02')])).toEqual({ longest: null, current: 0 })
  })
})

describe('profile', () => {
  const meta = { '1': { name: 'A' }, '2': { name: 'B' } }
  it('main game, recent game name, counts', () => {
    const r = profile(
      [pt('2026-03-01', { '1': 100 }), pt('2026-03-02', { '1': 20, '2': 80 }), pt('2026-03-03')],
      meta
    )
    expect(r.mainGame).toEqual({ appid: '1', minutes: 120, share: 0.6 })
    expect(r.recentGame).toBe('B')
    expect(r.activeDays).toBe(2)
    expect(r.distinctGames).toBe(2)
  })
  it('empty is null-safe; unknown meta falls back', () => {
    expect(profile([], meta)).toEqual({ mainGame: null, recentGame: null, activeDays: 0, distinctGames: 0 })
    expect(profile([pt('2026-03-01', { '9': 5 })], {}).recentGame).toBe('App 9')
  })
})

describe('ribbon', () => {
  it('one entry per day with top then OTHER', () => {
    const r = ribbon([pt('2026-03-01', { '1': 10, '2': 5, '3': 2 }), pt('2026-03-02')], ['1', '2'])
    expect(r).toEqual([
      {
        date: '2026-03-01',
        segments: [
          { appid: '1', minutes: 10 },
          { appid: '2', minutes: 5 },
          { appid: OTHER, minutes: 2 },
        ],
      },
      { date: '2026-03-02', segments: [] },
    ])
  })
})

describe('monthGrid', () => {
  it('Feb 2028 (leap, starts Tuesday) pads and has 29 days', () => {
    const g = monthGrid([pt('2028-02-29', { '1': 60 }), pt('2028-02-10', { '1': 30 })], '2028-02')
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g[0][0].date).toBeNull()
    expect(g[0][1].date).toBe('2028-02-01')
    const days = g.flat().filter((c) => c.date)
    expect(days).toHaveLength(29)
    const last = days[days.length - 1]
    expect(last).toMatchObject({ date: '2028-02-29', minutes: 60, level: 4 })
    expect(days.find((c) => c.date === '2028-02-10')).toMatchObject({ minutes: 30, level: 2 })
    expect(days.find((c) => c.date === '2028-02-11')).toMatchObject({ minutes: 0, level: 0 })
  })
  it('month starting on Sunday (Feb 2026... Mar 2026) puts day 1 in last column', () => {
    const g = monthGrid([], '2026-03')
    expect(g[0].slice(0, 6).every((c) => c.date === null)).toBe(true)
    expect(g[0][6].date).toBe('2026-03-01')
    expect(g.flat().every((c) => c.level === 0)).toBe(true)
    expect(g).toHaveLength(6)
  })
})
