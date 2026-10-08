import { describe, it, expect } from 'vitest'
import { todayInTZ, lastNDates, addDays, weekStart, monthStart, dayOfWeek } from '../lib/date'

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

describe('calendar helpers', () => {
  it('addDays crosses month/year/leap', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
  it('weekStart is Monday', () => {
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
    expect(weekStart('2025-12-29')).toBe('2025-12-29')
    expect(weekStart('2026-01-04')).toBe('2025-12-29')
  })
  it('monthStart/dayOfWeek', () => {
    expect(monthStart('2026-03-17')).toBe('2026-03-01')
    expect(dayOfWeek('2025-12-29')).toBe(0)
    expect(dayOfWeek('2026-01-04')).toBe(6)
  })
  it('lastNDates newest first, calendar-correct', () => {
    expect(lastNDates(3, new Date('2026-03-01T12:00:00Z'))).toEqual(['2026-03-01', '2026-02-28', '2026-02-27'])
  })
})
