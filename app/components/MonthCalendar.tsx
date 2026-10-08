'use client'

import { useMemo, useState } from 'react'
import { monthGrid, type DayPoint } from '@/lib/aggregate'
import { formatCompact, formatMinutes, longDate, monthTitle, weekdayName } from '@/lib/format'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export default function MonthCalendar({ series, today }: { series: DayPoint[]; today: string }) {
  const current = today.slice(0, 7)
  const earliest = series.length ? series[0].date.slice(0, 7) : current
  const [month, setMonth] = useState(current)
  const grid = useMemo(() => monthGrid(series, month), [series, month])
  const total = grid.flat().reduce((a, c) => a + c.minutes, 0)

  return (
    <section className="card panel" aria-labelledby="cal-h">
      <div className="panel-head">
        <h2 id="cal-h">Mês</h2>
        <div className="cal-nav">
          <button
            type="button"
            className="cal-btn"
            aria-label="Mês anterior"
            disabled={month <= earliest}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </button>
          <span className="cal-title" aria-live="polite">
            {monthTitle(month)}
          </span>
          <button
            type="button"
            className="cal-btn"
            aria-label="Próximo mês"
            disabled={month >= current}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </button>
        </div>
      </div>
      <table className="cal">
        <thead>
          <tr>
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <th key={r} scope="col">
                {weekdayName(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week, wi) => (
            <tr key={wi}>
              {week.map((c, ci) =>
                c.date === null ? (
                  <td key={ci} className="cal-pad" />
                ) : (
                  <td
                    key={ci}
                    className={`cal-cell lv${c.level}${c.date === today ? ' is-today' : ''}`}
                    title={`${longDate(c.date)}: ${c.minutes > 0 ? formatMinutes(c.minutes) : 'sem jogo'}`}
                    aria-label={`${longDate(c.date)}: ${c.minutes > 0 ? formatMinutes(c.minutes) : 'sem jogo'}`}
                  >
                    <span className="cal-day">{Number(c.date.slice(8, 10))}</span>
                    <span className="cal-time">{formatCompact(c.minutes)}</span>
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small cal-foot">Total no mês: {formatMinutes(total)}</p>
    </section>
  )
}
