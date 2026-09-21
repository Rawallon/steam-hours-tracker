import type { OwnedGame } from './steam'

export interface Snapshot {
  capturedAt: string
  games: Record<string, number>
}

export interface GameMeta {
  name: string
  icon: string
}

export interface DeltaResult {
  deltas: Record<string, number>
  newSnapshot: Snapshot
  metas: Record<string, GameMeta>
}

export function iconUrl(appid: number, imgIconUrl: string): string {
  if (!imgIconUrl) return ''
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${imgIconUrl}.jpg`
}

export function computeDeltas(
  last: Snapshot | null,
  currentGames: OwnedGame[],
  now: Date = new Date()
): DeltaResult {
  const lastGames = last?.games ?? {}
  const deltas: Record<string, number> = {}
  const newGames: Record<string, number> = {}
  const metas: Record<string, GameMeta> = {}

  for (const game of currentGames) {
    const appid = String(game.appid)
    const lastMinutes = lastGames[appid]
    const currentMinutes = game.playtime_forever
    newGames[appid] = currentMinutes

    if (typeof lastMinutes === 'number' && currentMinutes > lastMinutes) {
      deltas[appid] = currentMinutes - lastMinutes
    }

    metas[appid] = {
      name: game.name,
      icon: iconUrl(game.appid, game.img_icon_url),
    }
  }

  return {
    deltas,
    newSnapshot: { capturedAt: now.toISOString(), games: newGames },
    metas,
  }
}
