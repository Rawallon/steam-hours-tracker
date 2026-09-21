import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    hincrby: vi.fn(),
    hset: vi.fn(),
    hgetall: vi.fn(),
  },
}))

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
