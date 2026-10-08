import type { Group } from './aggregate'

export type Range = 7 | 30 | 90 | 365
export interface View {
  range: Range
  group: Group
  game: string | null
}

export const RANGES: Range[] = [7, 30, 90, 365]
export const GROUPS: Group[] = ['day', 'week', 'month']

export function parseView(sp: { range?: string; group?: string; game?: string }): View {
  const r = Number(sp.range)
  const range = (RANGES as number[]).includes(r) ? (r as Range) : 30
  const group = (GROUPS as string[]).includes(sp.group ?? '') ? (sp.group as Group) : 'day'
  const game = sp.game && /^\d+$/.test(sp.game) ? sp.game : null
  return { range, group, game }
}

export function viewQuery(v: View): string {
  const p = new URLSearchParams({ range: String(v.range), group: v.group })
  if (v.game) p.set('game', v.game)
  return `?${p.toString()}`
}
