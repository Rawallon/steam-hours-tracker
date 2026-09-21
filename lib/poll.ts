import type { OwnedGame } from './steam'
import { fetchOwnedGames } from './steam'
import {
  getLastSnapshot,
  saveSnapshot,
  addDailyMinutesBatch,
  upsertGameMetas,
} from './redis'
import { todayInTZ } from './date'

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

    // Only games with recorded playtime can ever appear in a `daily:*` hash, so
    // metadata for a never-played game would only ever be written, never read.
    if (currentMinutes > 0) {
      metas[appid] = {
        name: game.name,
        icon: iconUrl(game.appid, game.img_icon_url),
      }
    }
  }

  return {
    deltas,
    newSnapshot: { capturedAt: now.toISOString(), games: newGames },
    metas,
  }
}

export interface PollSummary {
  date: string
  deltas: Record<string, number>
}

export async function runPoll(): Promise<PollSummary> {
  const [games, last] = await Promise.all([fetchOwnedGames(), getLastSnapshot()])
  const { deltas, newSnapshot, metas } = computeDeltas(last, games)
  const date = todayInTZ()

  // Snapshot first, deltas last. HINCRBY is not idempotent, so if we wrote the
  // deltas first and then died before saving the snapshot, the next run would
  // recompute and re-apply the same delta, silently inflating recorded hours.
  // Saving the snapshot first means a partial failure under-counts one poll
  // interval instead, which is the far safer failure mode.
  await saveSnapshot(newSnapshot)
  await upsertGameMetas(metas)
  await addDailyMinutesBatch(date, deltas)

  return { date, deltas }
}
