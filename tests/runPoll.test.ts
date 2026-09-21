import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/steam', () => ({ fetchOwnedGames: vi.fn() }))
vi.mock('../lib/redis', () => ({
  getLastSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  addDailyMinutesBatch: vi.fn(),
  upsertGameMetas: vi.fn(),
}))
vi.mock('../lib/date', () => ({ todayInTZ: vi.fn() }))

import { runPoll } from '../lib/poll'
import { fetchOwnedGames } from '../lib/steam'
import {
  getLastSnapshot,
  saveSnapshot,
  addDailyMinutesBatch,
  upsertGameMetas,
} from '../lib/redis'
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
    expect(addDailyMinutesBatch).toHaveBeenCalledTimes(1)
    expect(addDailyMinutesBatch).toHaveBeenCalledWith('2026-01-02', { '1': 60 })
    expect(upsertGameMetas).toHaveBeenCalledTimes(1)
    expect(upsertGameMetas).toHaveBeenCalledWith({
      '1': {
        name: 'Half-Life',
        icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/1/hash1.jpg',
      },
    })
    expect(saveSnapshot).toHaveBeenCalledWith({
      capturedAt: expect.any(String),
      games: { '1': 560 },
    })
  })

  it('saves the snapshot before writing any deltas', async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 1, name: 'Half-Life', playtime_forever: 560, img_icon_url: 'hash1' },
    ])
    vi.mocked(getLastSnapshot).mockResolvedValue({
      capturedAt: '2026-01-01T00:00:00Z',
      games: { '1': 500 },
    })
    vi.mocked(todayInTZ).mockReturnValue('2026-01-02')

    const order: string[] = []
    vi.mocked(saveSnapshot).mockImplementation(async () => {
      order.push('saveSnapshot')
    })
    vi.mocked(upsertGameMetas).mockImplementation(async () => {
      order.push('upsertGameMetas')
    })
    vi.mocked(addDailyMinutesBatch).mockImplementation(async () => {
      order.push('addDailyMinutesBatch')
    })

    await runPoll()

    // Snapshot must land first: a crash after the deltas but before the
    // snapshot would double-count those minutes on the next poll.
    expect(order).toEqual(['saveSnapshot', 'upsertGameMetas', 'addDailyMinutesBatch'])
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
    expect(addDailyMinutesBatch).toHaveBeenCalledWith('2026-01-02', {})
  })

  it('seeds the snapshot without recording deltas on the first run', async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 1, name: 'Half-Life', playtime_forever: 500, img_icon_url: 'hash1' },
    ])
    vi.mocked(getLastSnapshot).mockResolvedValue(null)
    vi.mocked(todayInTZ).mockReturnValue('2026-01-02')

    const result = await runPoll()

    expect(result.deltas).toEqual({})
    expect(addDailyMinutesBatch).toHaveBeenCalledWith('2026-01-02', {})
    expect(saveSnapshot).toHaveBeenCalledWith({ capturedAt: expect.any(String), games: { '1': 500 } })
  })
})
