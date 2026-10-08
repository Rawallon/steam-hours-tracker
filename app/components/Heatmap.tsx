'use client'

import { useState } from 'react'
import type { Cell, DayPoint } from '@/lib/aggregate'
import { formatMinutes, longDate, monthName, weekdayName } from '@/lib/format'
import { nameOf } from './StackedBars'

interface Props {
  series: DayPoint[]
  cells: Cell[]
  meta: Record<string, { name: string; icon: string }>
}

export default function Heatmap({ series, cells, meta }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const cols = cells.length ? cells[cells.length - 1].col + 1 : 0

  // month labels: first column where a cell with day-of-month <= 7 and row === 0..6 starts a new month
  const labels: { col: number; text: string }[] = []
  let lastMonth = ''
  cells.forEach((c) => {
    const m = c.date.slice(0, 7)
    if (m !== lastMonth) {
      lastMonth = m
      // avoid overlapping labels: need at least 3 columns of room
      const prev = labels[labels.length - 1]
      if (!prev || c.col - prev.col >= 3) labels.push({ col: c.col, text: monthName(c.date) })
    }
  })

  const a = active !== null ? cells[active] : null
  const aTop = a
    ? Object.entries(series[active!].byGame)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
    : []

  return (
    <section className="card panel" aria-labelledby="heat-h">
      <div className="panel-head">
        <h2 id="heat-h">Calendário</h2>
        <div className="heat-legend" aria-hidden="true">
          menos
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`lv lv${l}`} />
          ))}
          mais
        </div>
      </div>
      {cells.length === 0 ? (
        <p className="muted small">Sem dados.</p>
      ) : (
        <div className="heat-scroll" tabIndex={0} aria-label="Calendário de atividade, rolável horizontalmente">
          <div className="heat-body" onMouseLeave={() => setActive(null)}>
            <div className="heat-rows" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <span key={r} style={{ gridRow: r + 2 }}>
                  {r % 2 === 0 ? weekdayName(r) : ''}
                </span>
              ))}
            </div>
            <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${cols}, var(--cell))` }}>
              {labels.map((l) => (
                <span key={l.col} className="heat-month" style={{ gridColumn: l.col + 1, gridRow: 1 }}>
                  {l.text}
                </span>
              ))}
              {cells.map((c, i) => (
                <button
                  type="button"
                  key={c.date}
                  className={`cell lv${c.level}${active === i ? ' is-active' : ''}`}
                  style={{ gridColumn: c.col + 1, gridRow: c.row + 2 }}
                  title={`${longDate(c.date)}: ${c.minutes > 0 ? formatMinutes(c.minutes) : 'sem jogo'}`}
                  aria-label={`${longDate(c.date)}: ${c.minutes > 0 ? formatMinutes(c.minutes) : 'sem jogo'}`}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="heat-detail" aria-live="polite">
        {a ? (
          <>
            <b>{longDate(a.date)}</b>
            <span>{a.minutes > 0 ? formatMinutes(a.minutes) : 'sem jogo'}</span>
            {aTop.map(([id, m]) => (
              <span key={id} className="muted">
                {nameOf(meta, id)} {formatMinutes(m)}
              </span>
            ))}
          </>
        ) : (
          <span className="muted">Passe o mouse sobre um dia para ver os detalhes.</span>
        )}
      </div>
      <p className="muted small foot">
        Coleta diária às 23:55 (BRT): horas jogadas após isso ou entre coletas podem cair no dia seguinte.
      </p>
    </section>
  )
}
