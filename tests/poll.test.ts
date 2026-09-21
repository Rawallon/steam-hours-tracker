import { describe, it, expect } from 'vitest'
import { computeDeltas, iconUrl, type Snapshot } from '../lib/poll'
import type { OwnedGame } from '../lib/steam'

function game(overrides: Partial<OwnedGame>): OwnedGame {
  return { appid: 100, name: 'Test Game', playtime_forever: 0, img_icon_url: 'abc123', ...overrides }
}

describe('computeDeltas', () => {
  it('records no delta for a game seen for the first time', () => {
    const result = computeDeltas(null, [game({ appid: 1, playtime_forever: 500 })])
    expect(result.deltas).toEqual({})
    expect(result.newSnapshot.games['1']).toBe(500)
  })

  it('computes the delta for a game that gained playtime', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 560 })])
    expect(result.deltas).toEqual({ '1': 60 })
    expect(result.newSnapshot.games['1']).toBe(560)
  })

  it('ignores a game whose playtime did not change', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 500 })])
    expect(result.deltas).toEqual({})
  })

  it('treats a decrease as a baseline reset, not a negative delta', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500 } }
    const result = computeDeltas(last, [game({ appid: 1, playtime_forever: 100 })])
    expect(result.deltas).toEqual({})
    expect(result.newSnapshot.games['1']).toBe(100)
  })

  it('handles multiple games independently', () => {
    const last: Snapshot = { capturedAt: '2026-01-01T00:00:00Z', games: { '1': 500, '2': 200 } }
    const result = computeDeltas(last, [
      game({ appid: 1, playtime_forever: 520 }),
      game({ appid: 2, playtime_forever: 200 }),
    ])
    expect(result.deltas).toEqual({ '1': 20 })
  })

  it('builds metadata with an icon URL from appid and img_icon_url', () => {
    const result = computeDeltas(null, [game({ appid: 42, name: 'Half-Life', img_icon_url: 'hash123' })])
    expect(result.metas['42']).toEqual({
      name: 'Half-Life',
      icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/42/hash123.jpg',
    })
  })
})

describe('iconUrl', () => {
  it('returns an empty string when there is no icon hash', () => {
    expect(iconUrl(1, '')).toBe('')
  })
})
