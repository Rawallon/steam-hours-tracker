import { getDailyMinutes, getGamesMeta } from './redis'
import { lastNDates } from './date'

export interface DayGameStats {
  appid: string
  name: string
  icon: string
  minutes: number
}

export interface DayStats {
  date: string
  games: DayGameStats[]
}

export async function getStats(days: number): Promise<DayStats[]> {
  const dates = lastNDates(days)
  const meta = await getGamesMeta()
  const result: DayStats[] = []

  for (const date of dates) {
    const minutes = await getDailyMinutes(date)
    const games = Object.entries(minutes)
      .filter(([, m]) => m > 0)
      .map(([appid, m]) => ({
        appid,
        name: meta[appid]?.name ?? `App ${appid}`,
        icon: meta[appid]?.icon ?? '',
        minutes: m,
      }))
      .sort((a, b) => b.minutes - a.minutes)

    if (games.length > 0) {
      result.push({ date, games })
    }
  }

  return result
}
