import { describe, it, expect } from 'vitest'
import { formatMinutes, shortDate, longDate, monthLabel } from '../lib/format'

describe('formatMinutes', () => {
  it('formats', () => {
    expect(formatMinutes(0)).toBe('0min')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(90)).toBe('1h 30min')
    expect(formatMinutes(119.6)).toBe('2h')
  })
})

describe('date labels', () => {
  it('formats', () => {
    expect(shortDate('2026-03-07')).toBe('07/03')
    expect(longDate('2026-10-03')).toBe('03 out 2026')
    expect(monthLabel('2026-10-01')).toBe('out/26')
  })
})
