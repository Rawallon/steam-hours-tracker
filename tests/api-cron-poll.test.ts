import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/poll', () => ({ runPoll: vi.fn() }))

import { GET } from '../app/api/cron/poll/route'
import { runPoll } from '@/lib/poll'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('GET /api/cron/poll', () => {
  it('rejects requests without the correct bearer token', async () => {
    const request = new Request('http://localhost/api/cron/poll')
    const response = await GET(request)
    expect(response.status).toBe(401)
    expect(runPoll).not.toHaveBeenCalled()
  })

  it('runs the poll when the bearer token matches CRON_SECRET', async () => {
    vi.mocked(runPoll).mockResolvedValue({ date: '2026-01-02', deltas: { '1': 60 } })
    const request = new Request('http://localhost/api/cron/poll', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ date: '2026-01-02', deltas: { '1': 60 } })
  })

  it('returns 500 when the poll throws', async () => {
    vi.mocked(runPoll).mockRejectedValue(new Error('Steam API down'))
    const request = new Request('http://localhost/api/cron/poll', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const response = await GET(request)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Steam API down' })
  })

  it('rejects when CRON_SECRET is unset, even with Bearer undefined header', async () => {
    delete process.env.CRON_SECRET
    const request = new Request('http://localhost/api/cron/poll', {
      headers: { authorization: 'Bearer undefined' },
    })
    const response = await GET(request)
    expect(response.status).toBe(401)
    expect(runPoll).not.toHaveBeenCalled()
  })
})
