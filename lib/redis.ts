import { Redis } from '@upstash/redis'
import type { Snapshot, GameMeta } from './poll'

const redis = Redis.fromEnv()

export async function getLastSnapshot(): Promise<Snapshot | null> {
  return (await redis.get<Snapshot>('snapshot:last')) ?? null
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await redis.set('snapshot:last', snapshot)
}

export async function addDailyMinutes(date: string, appid: string, minutes: number): Promise<void> {
  await redis.hincrby(`daily:${date}`, appid, minutes)
}

export async function upsertGameMeta(appid: string, meta: GameMeta): Promise<void> {
  await redis.hset('games:meta', { [appid]: meta })
}

export async function getGamesMeta(): Promise<Record<string, GameMeta>> {
  return (await redis.hgetall<Record<string, GameMeta>>('games:meta')) ?? {}
}

export async function getDailyMinutes(date: string): Promise<Record<string, number>> {
  return (await redis.hgetall<Record<string, number>>(`daily:${date}`)) ?? {}
}
