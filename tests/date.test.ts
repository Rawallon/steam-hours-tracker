import { describe, it, expect } from 'vitest'
import { todayInTZ, lastNDates } from '../lib/date'

describe('todayInTZ', () => {
  it('formats as YYYY-MM-DD', () => {
    const result = todayInTZ(new Date('2026-01-15T12:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses America/Sao_Paulo, not UTC, near midnight', () => {
    // 2026-01-15T02:00:00Z is 2026-01-14 23:00 in America/Sao_Paulo (UTC-3)
    const result = todayInTZ(new Date('2026-01-15T02:00:00Z'))
    expect(result).toBe('2026-01-14')
  })
})

describe('lastNDates', () => {
  it('returns n dates ending at "today", most recent first', () => {
    const result = lastNDates(3, new Date('2026-01-15T12:00:00Z'))
    expect(result).toEqual(['2026-01-15', '2026-01-14', '2026-01-13'])
  })
})
