import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedis, mockPipeline } = vi.hoisted(() => {
  const mockPipeline = {
    hincrby: vi.fn(),
    exec: vi.fn(),
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

import {
  getLastSnapshot,
  saveSnapshot,
  addDailyMinutesBatch,
  upsertGameMetas,
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

describe('addDailyMinutesBatch', () => {
  it('increments every appid field on the day hash in one pipeline', async () => {
    await addDailyMinutesBatch('2026-01-15', { '42': 30, '7': 15 })
    expect(mockRedis.pipeline).toHaveBeenCalledTimes(1)
    expect(mockPipeline.hincrby).toHaveBeenCalledTimes(2)
    expect(mockPipeline.hincrby).toHaveBeenCalledWith('daily:2026-01-15', '42', 30)
    expect(mockPipeline.hincrby).toHaveBeenCalledWith('daily:2026-01-15', '7', 15)
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1)
  })

  it('issues no request when there are no deltas', async () => {
    await addDailyMinutesBatch('2026-01-15', {})
    expect(mockRedis.pipeline).not.toHaveBeenCalled()
    expect(mockPipeline.exec).not.toHaveBeenCalled()
  })
})

describe('upsertGameMetas', () => {
  it('writes the whole map to games:meta in a single hset', async () => {
    const metas = {
      '42': { name: 'Half-Life', icon: 'https://example.com/icon.jpg' },
      '7': { name: 'Portal', icon: 'https://example.com/portal.jpg' },
    }
    await upsertGameMetas(metas)
    expect(mockRedis.hset).toHaveBeenCalledTimes(1)
    expect(mockRedis.hset).toHaveBeenCalledWith('games:meta', metas)
  })

  it('issues no request when there is no metadata', async () => {
    await upsertGameMetas({})
    expect(mockRedis.hset).not.toHaveBeenCalled()
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
