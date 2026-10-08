import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/redis', () => ({
  getDailyMinutesBatch: vi.fn(),
  getGamesMeta: vi.fn(),
}))

import { getStats } from '../lib/stats'
import { getDailyMinutesBatch, getGamesMeta } from '../lib/redis'
import { lastNDates } from '../lib/date'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getStats', () => {
  it('returns today, meta for present appids, and non-empty days', async () => {
    vi.mocked(getGamesMeta).mockResolvedValue({
      '1': { name: 'Half-Life', icon: 'i1' },
      '2': { name: 'Portal', icon: 'i2' },
      '3': { name: 'Unused', icon: 'i3' },
    })
    vi.mocked(getDailyMinutesBatch).mockImplementation(async (dates): Promise<Record<string, Record<string, number>>> => ({
      [dates[0]]: { '1': 30, '2': 90 },
    }))

    const result = await getStats(2)

    const dates = lastNDates(2)
    expect(getDailyMinutesBatch).toHaveBeenCalledWith(dates)
    expect(result.today).toBe(lastNDates(1)[0])
    expect(result.days).toEqual({ [dates[0]]: { '1': 30, '2': 90 } })
    expect(result.meta).toEqual({
      '1': { name: 'Half-Life', icon: 'i1' },
      '2': { name: 'Portal', icon: 'i2' },
    })
  })

  it('falls back to a generic name for unknown games', async () => {
    vi.mocked(getGamesMeta).mockResolvedValue({})
    vi.mocked(getDailyMinutesBatch).mockImplementation(async (dates) => ({ [dates[0]]: { '9': 15 } }))
    const result = await getStats(1)
    expect(result.meta['9']).toEqual({ name: 'App 9', icon: '' })
  })

  it('omits zero days and drops entries with minutes <= 0', async () => {
    vi.mocked(getGamesMeta).mockResolvedValue({})
    vi.mocked(getDailyMinutesBatch).mockImplementation(async (dates): Promise<Record<string, Record<string, number>>> => ({
      [dates[0]]: {},
      [dates[1]]: { '1': 10, '2': 0, '3': -5 },
    }))
    const result = await getStats(2)
    const dates = lastNDates(2)
    expect(result.days).toEqual({ [dates[1]]: { '1': 10 } })
    expect(Object.keys(result.meta)).toEqual(['1'])
  })

  it('empty redis -> empty maps', async () => {
    vi.mocked(getGamesMeta).mockResolvedValue({})
    vi.mocked(getDailyMinutesBatch).mockResolvedValue({})
    const result = await getStats(3)
    expect(result.meta).toEqual({})
    expect(result.days).toEqual({})
  })
})
