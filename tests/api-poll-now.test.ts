import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/poll', () => ({ runPoll: vi.fn() }))

import { POST } from '../app/api/poll-now/route'
import { runPoll } from '@/lib/poll'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/poll-now', () => {
  it('runs the poll and returns the result', async () => {
    vi.mocked(runPoll).mockResolvedValue({ date: '2026-01-02', deltas: { '1': 60 } })
    const response = await POST()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ date: '2026-01-02', deltas: { '1': 60 } })
  })

  it('returns 500 when the poll throws', async () => {
    vi.mocked(runPoll).mockRejectedValue(new Error('Steam API down'))
    const response = await POST()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Steam API down' })
  })
})
