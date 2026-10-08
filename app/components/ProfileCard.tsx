import { kpis, profile, streaks, type DayPoint } from '@/lib/aggregate'
import { formatMinutes, longDate, shortDate } from '@/lib/format'

export default function ProfileCard({
  series,
  meta,
}: {
  series: DayPoint[]
  meta: Record<string, { name: string; icon: string }>
}) {
  const p = profile(series, meta)
  const s = streaks(series)
  const longest = kpis(series).longest
  const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

  const facts: { label: string; value: string; sub?: string }[] = [
    {
      label: 'Jogo principal',
      value: p.mainGame ? (meta[p.mainGame.appid]?.name ?? `App ${p.mainGame.appid}`) : '—',
      sub: p.mainGame ? `${Math.round(p.mainGame.share * 100)}% do tempo · ${formatMinutes(p.mainGame.minutes)}` : undefined,
    },
    { label: 'Jogado mais recentemente', value: p.recentGame ?? '—' },
    {
      label: 'Dia mais longo',
      value: longest ? formatMinutes(longest.minutes) : '—',
      sub: longest ? longDate(longest.date) : undefined,
    },
    {
      label: 'Maior sequência',
      value: s.longest ? days(s.longest.days) : '—',
      sub: s.longest ? `${shortDate(s.longest.start)} a ${shortDate(s.longest.end)}` : undefined,
    },
    {
      label: 'Sequência atual',
      value: days(s.current),
      sub: s.current === 0 ? 'sem jogo no último dia' : undefined,
    },
  ]

  return (
    <section className="card panel" aria-labelledby="prof-h">
      <div className="panel-head">
        <h2 id="prof-h">Seu perfil recente</h2>
      </div>
      <dl className="facts">
        {facts.map((f) => (
          <div key={f.label} className="fact">
            <dt>{f.label}</dt>
            <dd>
              <strong title={f.value}>{f.value}</strong>
              {f.sub && <span className="muted small">{f.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
