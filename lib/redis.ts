import { Redis } from '@upstash/redis'
import type { Snapshot, GameMeta } from './poll'

const redis = Redis.fromEnv()

export async function getLastSnapshot(): Promise<Snapshot | null> {
  return (await redis.get<Snapshot>('snapshot:last')) ?? null
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await redis.set('snapshot:last', snapshot)
}

export async function addDailyMinutesBatch(
  date: string,
  deltas: Record<string, number>
): Promise<void> {
  const entries = Object.entries(deltas)
  if (entries.length === 0) return
  const pipeline = redis.pipeline()
  for (const [appid, minutes] of entries) {
    pipeline.hincrby(`daily:${date}`, appid, minutes)
  }
  await pipeline.exec()
}

export async function upsertGameMetas(metas: Record<string, GameMeta>): Promise<void> {
  if (Object.keys(metas).length === 0) return
  await redis.hset('games:meta', metas)
}

export async function getGamesMeta(): Promise<Record<string, GameMeta>> {
  return (await redis.hgetall<Record<string, GameMeta>>('games:meta')) ?? {}
}

export async function getDailyMinutes(date: string): Promise<Record<string, number>> {
  return (await redis.hgetall<Record<string, number>>(`daily:${date}`)) ?? {}
}
