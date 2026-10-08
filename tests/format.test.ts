import { describe, it, expect } from 'vitest'
import { formatMinutes, shortDate, longDate, monthLabel, monthTitle, formatCompact, formatHours } from '../lib/format'

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

describe('monthTitle / formatCompact / formatHours', () => {
  it('formats', () => {
    expect(monthTitle('2026-10')).toBe('outubro 2026')
    expect(monthTitle('2028-02')).toBe('fevereiro 2028')
    expect(formatCompact(0)).toBe('')
    expect(formatCompact(45)).toBe('45m')
    expect(formatCompact(120)).toBe('2h')
    expect(formatCompact(125)).toBe('2h05')
    expect(formatCompact(150)).toBe('2h30')
    expect(formatHours(90)).toBe('1,5h')
    expect(formatHours(0)).toBe('0,0h')
  })
})
