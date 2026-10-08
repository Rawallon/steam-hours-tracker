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
