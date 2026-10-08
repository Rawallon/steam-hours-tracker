export function formatMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes)
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/** YYYY-MM-DD -> dd/MM */
export function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** YYYY-MM-DD -> "03 out 2026" */
export function longDate(date: string): string {
  return `${date.slice(8, 10)} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

/** YYYY-MM-DD -> "out/26" */
export function monthLabel(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]}/${date.slice(2, 4)}`
}

export function monthName(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1]
}

export function weekdayName(row: number): string {
  return WEEKDAYS[row]
}

const MONTHS_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** YYYY-MM -> "outubro 2026" */
export function monthTitle(month: string): string {
  return `${MONTHS_FULL[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

/** Tight form for small cells: 0 -> "", 45 -> "45m", 120 -> "2h", 150 -> "2h30" */
export function formatCompact(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes)
  if (rounded <= 0) return ''
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Hours with one comma decimal: 90 -> "1,5h" */
export function formatHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(1).replace('.', ',')}h`
}
