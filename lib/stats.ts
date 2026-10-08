import { getDailyMinutesBatch, getGamesMeta } from './redis'
import { lastNDates } from './date'

export interface StatsResponse {
  today: string
  meta: Record<string, { name: string; icon: string }>
  days: Record<string, Record<string, number>>
}

export async function getStats(days: number): Promise<StatsResponse> {
  const dates = lastNDates(days)
  const [raw, allMeta] = await Promise.all([getDailyMinutesBatch(dates), getGamesMeta()])

  const result: StatsResponse = { today: dates[0], meta: {}, days: {} }
  for (const date of dates) {
    const entries = Object.entries(raw[date] ?? {}).filter(([, m]) => m > 0)
    if (entries.length === 0) continue
    result.days[date] = Object.fromEntries(entries)
    for (const [appid] of entries) {
      result.meta[appid] ??= {
        name: allMeta[appid]?.name ?? `App ${appid}`,
        icon: allMeta[appid]?.icon ?? '',
      }
    }
  }
  return result
}
