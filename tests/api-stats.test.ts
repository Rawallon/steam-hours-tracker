import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/stats', () => ({ getStats: vi.fn() }))

import { GET } from '../app/api/stats/route'
import { getStats } from '@/lib/stats'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/stats', () => {
  it('defaults to 30 days when no query param is given', async () => {
    vi.mocked(getStats).mockResolvedValue([])
    const request = new Request('http://localhost/api/stats')
    await GET(request)
    expect(getStats).toHaveBeenCalledWith(30)
  })

  it('passes through the days query param', async () => {
    vi.mocked(getStats).mockResolvedValue([{ date: '2026-01-02', games: [] }])
    const request = new Request('http://localhost/api/stats?days=7')
    const response = await GET(request)
    expect(getStats).toHaveBeenCalledWith(7)
    expect(await response.json()).toEqual([{ date: '2026-01-02', games: [] }])
  })
})
