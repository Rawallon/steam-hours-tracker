import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/stats', () => ({ getStats: vi.fn() }))

import { GET } from '../app/api/stats/route'
import { getStats } from '@/lib/stats'

const empty = { today: '2026-01-02', meta: {}, days: {} }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/stats', () => {
  it('defaults to 30 days', async () => {
    vi.mocked(getStats).mockResolvedValue(empty)
    await GET(new Request('http://localhost/api/stats'))
    expect(getStats).toHaveBeenCalledWith(30)
  })

  it('passes valid days, returns payload and cache header', async () => {
    vi.mocked(getStats).mockResolvedValue(empty)
    const response = await GET(new Request('http://localhost/api/stats?days=366'))
    expect(getStats).toHaveBeenCalledWith(366)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('s-maxage=300, stale-while-revalidate')
    expect(await response.json()).toEqual(empty)
  })

  it.each(['abc', '0', '367', '1.5', '-1'])('rejects days=%s with 400', async (v) => {
    const response = await GET(new Request(`http://localhost/api/stats?days=${v}`))
    expect(response.status).toBe(400)
    expect(getStats).not.toHaveBeenCalled()
  })

  it('returns 500 when getStats throws', async () => {
    vi.mocked(getStats).mockRejectedValue(new Error('Redis unavailable'))
    const response = await GET(new Request('http://localhost/api/stats'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Redis unavailable' })
  })
})
