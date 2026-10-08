import { describe, it, expect } from 'vitest'
import { parseView, viewQuery } from '../lib/view'

describe('parseView', () => {
  it('defaults', () => {
    expect(parseView({})).toEqual({ range: 30, group: 'day', game: null })
  })
  it('garbled -> defaults', () => {
    expect(parseView({ range: 'zzz', group: 'x', game: '<script>' })).toEqual({ range: 30, group: 'day', game: null })
    expect(parseView({ range: '31' }).range).toBe(30)
  })
  it('valid values', () => {
    expect(parseView({ range: '365', group: 'month', game: '730' })).toEqual({ range: 365, group: 'month', game: '730' })
  })
})

describe('viewQuery', () => {
  it('omits game when null', () => {
    expect(viewQuery({ range: 7, group: 'week', game: null })).toBe('?range=7&group=week')
    expect(viewQuery({ range: 7, group: 'week', game: '1' })).toBe('?range=7&group=week&game=1')
  })
})
