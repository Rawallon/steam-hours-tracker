const TIME_ZONE = 'America/Sao_Paulo'

export function todayInTZ(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  const d = toUTC(date)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

/** 0=Mon..6=Sun */
export function dayOfWeek(date: string): number {
  return (toUTC(date).getUTCDay() + 6) % 7
}

export function weekStart(date: string): string {
  return addDays(date, -dayOfWeek(date))
}

export function monthStart(date: string): string {
  return date.slice(0, 8) + '01'
}

export function lastNDates(n: number, now: Date = new Date()): string[] {
  const today = todayInTZ(now)
  return Array.from({ length: n }, (_, i) => addDays(today, -i))
}
