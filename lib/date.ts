const TIME_ZONE = 'America/Sao_Paulo'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function todayInTZ(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function lastNDates(n: number, now: Date = new Date()): string[] {
  const dates: string[] = []
  for (let i = 0; i < n; i++) {
    dates.push(todayInTZ(new Date(now.getTime() - i * ONE_DAY_MS)))
  }
  return dates
}
