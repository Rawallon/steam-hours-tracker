import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Integration-style: only the true I/O boundaries are mocked (@upstash/redis
// and global fetch). lib/poll, lib/redis, lib/steam and lib/date are the real
// modules, so this exercises the actual wiring and the real Redis commands.
const { mockRedis, mockPipeline } = vi.hoisted(() => {
  const mockPipeline = {
    hincrby: vi.fn(),
    exec: vi.fn(async () => []),
  }
  return {
    mockPipeline,
    mockRedis: {
      get: vi.fn(),
      set: vi.fn(),
      hset: vi.fn(),
      hgetall: vi.fn(),
      pipeline: vi.fn(() => mockPipeline),
    },
  }
})

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => mockRedis },
}))

import { runPoll } from '../lib/poll'

const OWNED_GAMES = {
  response: {
    games: [
      { appid: 1, name: 'Half-Life', playtime_forever: 560, img_icon_url: 'hash1' },
      { appid: 2, name: 'Portal', playtime_forever: 245, img_icon_url: 'hash2' },
      // Unchanged playtime: metadata is refreshed, but no daily increment.
      { appid: 3, name: 'Dota 2', playtime_forever: 100, img_icon_url: 'hash3' },
      // Owned but never played: must not reach games:meta at all.
      { appid: 4, name: 'Unplayed Game', playtime_forever: 0, img_icon_url: 'hash4' },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // 09:00 in America/Sao_Paulo (UTC-3), so todayInTZ() is deterministic.
  vi.setSystemTime(new Date('2026-01-02T12:00:00Z'))
  process.env.STEAM_API_KEY = 'test-key'
  process.env.STEAM_ID64 = '76561197960287930'

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => OWNED_GAMES }))
  )
  mockRedis.get.mockResolvedValue({
    capturedAt: '2026-01-01T00:00:00Z',
    games: { '1': 500, '2': 200, '3': 100, '4': 0 },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runPoll (integration)', () => {
  it('issues the real batched Redis commands for a polled Steam library', async () => {
    const result = await runPoll()

    expect(result).toEqual({ date: '2026-01-02', deltas: { '1': 60, '2': 45 } })

    // Snapshot written to snapshot:last with every owned game's playtime.
    expect(mockRedis.set).toHaveBeenCalledTimes(1)
    expect(mockRedis.set).toHaveBeenCalledWith('snapshot:last', {
      capturedAt: '2026-01-02T12:00:00.000Z',
      games: { '1': 560, '2': 245, '3': 100, '4': 0 },
    })

    // Metadata: ONE hset with the full map, not one call per game, and the
    // never-played game is excluded.
    expect(mockRedis.hset).toHaveBeenCalledTimes(1)
    expect(mockRedis.hset).toHaveBeenCalledWith('games:meta', {
      '1': {
        name: 'Half-Life',
        icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/1/hash1.jpg',
      },
      '2': {
        name: 'Portal',
        icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/2/hash2.jpg',
      },
      '3': {
        name: 'Dota 2',
        icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/3/hash3.jpg',
      },
    })

    // Deltas: ONE pipeline, one hincrby per changed game, a single exec.
    expect(mockRedis.pipeline).toHaveBeenCalledTimes(1)
    expect(mockPipeline.hincrby).toHaveBeenCalledTimes(2)
    expect(mockPipeline.hincrby).toHaveBeenCalledWith('daily:2026-01-02', '1', 60)
    expect(mockPipeline.hincrby).toHaveBeenCalledWith('daily:2026-01-02', '2', 45)
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1)
  })

  it('writes the snapshot before incrementing any daily minutes', async () => {
    const order: string[] = []
    mockRedis.set.mockImplementation(async () => {
      order.push('set snapshot:last')
      return 'OK'
    })
    mockRedis.hset.mockImplementation(async () => {
      order.push('hset games:meta')
      return 3
    })
    mockPipeline.exec.mockImplementation(async () => {
      order.push('pipeline exec')
      return []
    })

    await runPoll()

    expect(order).toEqual(['set snapshot:last', 'hset games:meta', 'pipeline exec'])
  })

  it('makes a constant number of Redis round-trips regardless of library size', async () => {
    const games = Array.from({ length: 300 }, (_, i) => ({
      appid: i + 1,
      name: `Game ${i + 1}`,
      playtime_forever: 10,
      img_icon_url: `hash${i + 1}`,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ response: { games } }) }))
    )
    mockRedis.get.mockResolvedValue({
      capturedAt: '2026-01-01T00:00:00Z',
      games: Object.fromEntries(games.map((g) => [String(g.appid), 5])),
    })

    await runPoll()

    // 3 round-trips total: GET snapshot, SET snapshot, HSET meta, plus one
    // pipelined EXEC for all 300 increments.
    expect(mockRedis.get).toHaveBeenCalledTimes(1)
    expect(mockRedis.set).toHaveBeenCalledTimes(1)
    expect(mockRedis.hset).toHaveBeenCalledTimes(1)
    expect(mockRedis.pipeline).toHaveBeenCalledTimes(1)
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1)
    expect(mockPipeline.hincrby).toHaveBeenCalledTimes(300)
  })
})
