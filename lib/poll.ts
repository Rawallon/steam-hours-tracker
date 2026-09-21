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

import { fetchOwnedGames } from './steam'
import { getLastSnapshot, saveSnapshot, addDailyMinutes, upsertGameMeta } from './redis'
import { todayInTZ } from './date'

export interface PollSummary {
  date: string
  deltas: Record<string, number>
}

export async function runPoll(): Promise<PollSummary> {
  const [games, last] = await Promise.all([fetchOwnedGames(), getLastSnapshot()])
  const { deltas, newSnapshot, metas } = computeDeltas(last, games)
  const date = todayInTZ()

  for (const [appid, minutes] of Object.entries(deltas)) {
    await addDailyMinutes(date, appid, minutes)
  }
  for (const [appid, meta] of Object.entries(metas)) {
    await upsertGameMeta(appid, meta)
  }
  await saveSnapshot(newSnapshot)

  return { date, deltas }
}
