'use client'

import type { Group } from '@/lib/aggregate'
import { RANGES, GROUPS, type Range } from '@/lib/view'

const RANGE_LABEL: Record<Range, string> = { 7: '7d', 30: '30d', 90: '90d', 365: '1a' }
const GROUP_LABEL: Record<Group, string> = { day: 'Dia', week: 'Semana', month: 'Mês' }

interface Props {
  range: Range
  group: Group
  refreshing: boolean
  onRange: (r: Range) => void
  onGroup: (g: Group) => void
  onRefresh: () => void
}

export default function Controls({ range, group, refreshing, onRange, onGroup, onRefresh }: Props) {
  return (
    <header className="controls">
      <div className="controls-inner">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Steam Hours
        </h1>
        <div className="controls-groups">
          <div className="seg" role="group" aria-label="Período">
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={r === range} onClick={() => onRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Agrupar por">
            {GROUPS.map((g) => (
              <button key={g} type="button" aria-pressed={g === group} onClick={() => onGroup(g)}>
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Atualizando...' : 'Atualizar agora'}
          </button>
        </div>
      </div>
    </header>
  )
}
