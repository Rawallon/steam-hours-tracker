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
