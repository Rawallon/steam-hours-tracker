import { weekdayWeekend, type DayPoint } from '@/lib/aggregate'
import { formatMinutes } from '@/lib/format'

export default function WeekdayWeekend({ series }: { series: DayPoint[] }) {
  const w = weekdayWeekend(series)
  const max = Math.max(w.weekday.avg, w.weekend.avg)
  const rows = [
    { label: 'Dia útil', hint: 'seg a sex', s: w.weekday, cls: 'wk-weekday' },
    { label: 'Fim de semana', hint: 'sáb e dom', s: w.weekend, cls: 'wk-weekend' },
  ]
  return (
    <section className="card panel" aria-labelledby="wk-h">
      <div className="panel-head">
        <h2 id="wk-h">Dia útil x fim de semana</h2>
      </div>
      {max === 0 ? (
        <p className="muted small">Sem dados no período.</p>
      ) : (
        <>
          <ul className="wk">
            {rows.map((r) => (
              <li key={r.label}>
                <div className="wk-line">
                  <span className="wk-label">
                    {r.label} <span className="muted small">{r.hint}</span>
                  </span>
                  <b>{r.s.days > 0 ? formatMinutes(r.s.avg) : '—'}</b>
                </div>
                <div className="wk-track" aria-hidden="true">
                  <span className={r.cls} style={{ width: `${(r.s.avg / max) * 100}%` }} />
                </div>
                <span className="muted small">
                  média por dia ativo · {r.s.days} {r.s.days === 1 ? 'dia' : 'dias'}
                </span>
              </li>
            ))}
          </ul>
          {w.ratio !== null && (
            <p className="wk-caption">
              Você joga <b>{w.ratio.toFixed(1).replace('.', ',')}×</b> {w.ratio >= 1 ? 'mais' : 'menos'} nos fins de
              semana
            </p>
          )}
        </>
      )}
    </section>
  )
}
