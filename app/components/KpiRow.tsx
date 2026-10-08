import { formatMinutes, longDate } from '@/lib/format'
import GameIcon from './GameIcon'

interface Props {
  total: number
  avgPerActiveDay: number
  activeDays: number
  top: { name: string; icon: string } | null
  longest: { date: string; minutes: number } | null
  distinctGames: number
  mainShare: number | null
}

export default function KpiRow({ total, avgPerActiveDay, activeDays, top, longest, distinctGames, mainShare }: Props) {
  return (
    <section className="kpis" aria-label="Resumo">
      <div className="card kpi">
        <span className="kpi-label">Total</span>
        <strong className="kpi-value">{(total / 60).toFixed(1).replace('.', ',')}h</strong>
        <span className="kpi-sub">{formatMinutes(total)}</span>
      </div>
      <div className="card kpi">
        <span className="kpi-label">Média / dia ativo</span>
        <strong className="kpi-value">{formatMinutes(avgPerActiveDay)}</strong>
        <span className="kpi-sub">
          {activeDays} {activeDays === 1 ? 'dia ativo' : 'dias ativos'}
        </span>
      </div>
      <div className="card kpi">
        <span className="kpi-label">Jogo mais jogado</span>
        {top ? (
          <strong className="kpi-value kpi-game" title={top.name}>
            {top.icon && <GameIcon src={top.icon} name="" size={24} />}
            <span>{top.name}</span>
          </strong>
        ) : (
          <strong className="kpi-value kpi-none">—</strong>
        )}
        <span className="kpi-sub">&nbsp;</span>
      </div>
      <div className="card kpi">
        <span className="kpi-label">Maior dia</span>
        {longest ? (
          <>
            <strong className="kpi-value">{formatMinutes(longest.minutes)}</strong>
            <span className="kpi-sub">{longDate(longest.date)}</span>
          </>
        ) : (
          <>
            <strong className="kpi-value kpi-none">—</strong>
            <span className="kpi-sub">&nbsp;</span>
          </>
        )}
      </div>
      <div className="card kpi">
        <span className="kpi-label">Dias jogados</span>
        <strong className="kpi-value">{activeDays}</strong>
        <span className="kpi-sub">com pelo menos 1 min</span>
      </div>
      <div className="card kpi">
        <span className="kpi-label">Jogos diferentes</span>
        <strong className="kpi-value">{distinctGames}</strong>
        <span className="kpi-sub">no período</span>
      </div>
      <div className="card kpi">
        <span className="kpi-label">Tempo no jogo principal</span>
        {mainShare !== null ? (
          <>
            <strong className="kpi-value">{Math.round(mainShare * 100)}%</strong>
            <span className="kpi-sub">do tempo total</span>
          </>
        ) : (
          <>
            <strong className="kpi-value kpi-none">—</strong>
            <span className="kpi-sub">&nbsp;</span>
          </>
        )}
      </div>
    </section>
  )
}
