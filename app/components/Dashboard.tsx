'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { StatsResponse } from '@/lib/stats'
import {
  bucketBy,
  colorMap,
  densify,
  filterByGame,
  heatmapCells,
  kpis,
  profile,
  topIds,
  totalsByGame,
  type Group,
} from '@/lib/aggregate'
import { viewQuery, type Range, type View } from '@/lib/view'
import Controls from './Controls'
import KpiRow from './KpiRow'
import StackedBars from './StackedBars'
import GameBreakdown from './GameBreakdown'
import Heatmap from './Heatmap'
import WeekdayWeekend from './WeekdayWeekend'
import CumulativeChart from './CumulativeChart'
import ProfileCard from './ProfileCard'
import Ribbon from './Ribbon'
import MonthCalendar from './MonthCalendar'

const HEATMAP_MIN_DAYS = 180

export default function Dashboard({ initial }: { initial: View }) {
  const [range, setRange] = useState<Range>(initial.range)
  const [group, setGroup] = useState<Group>(initial.group)
  const [game, setGame] = useState<string | null>(initial.game)
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (bust = false) => {
    try {
      const res = await fetch(`/api/stats?days=365${bust ? `&t=${Date.now()}` : ''}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Falha ao carregar dados')
      setData(body)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function update(next: Partial<View>) {
    const v: View = { range, group, game, ...next }
    if (next.range !== undefined) setRange(v.range)
    if (next.group !== undefined) setGroup(v.group)
    if ('game' in next) setGame(v.game)
    // URL sync only: state stays client-side, no server round trip
    window.history.replaceState(null, '', viewQuery(v))
  }

  const toggleGame = (appid: string) => update({ game: game === appid ? null : appid })

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/poll-now', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Falha ao atualizar')
      }
      await load(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  const derived = useMemo(() => {
    if (!data) return null
    const full = densify(data.days, data.today, 365)
    const colors = colorMap(totalsByGame(full))
    const rangeSeries = full.slice(-range)
    const rangeTotals = totalsByGame(rangeSeries)
    const filtered = filterByGame(rangeSeries, game)
    const filteredTotals = totalsByGame(filtered)
    const heatSeries = filterByGame(full.slice(-Math.max(range, HEATMAP_MIN_DAYS)), game)
    return {
      colors,
      rangeSeries,
      filtered,
      ribbonTop: topIds(rangeTotals),
      calendarSeries: filterByGame(full, game),
      prof: profile(filtered, {}),
      rangeTotals,
      top: topIds(filteredTotals),
      buckets: bucketBy(filtered, group),
      stats: kpis(filtered),
      heatSeries,
      cells: heatmapCells(heatSeries),
      isEmpty: Object.keys(data.days).length === 0,
    }
  }, [data, range, group, game])

  const meta = data?.meta ?? {}
  const gameName = game ? (meta[game]?.name ?? `App ${game}`) : null

  return (
    <>
      <Controls
        range={range}
        group={group}
        refreshing={refreshing}
        onRange={(r) => update({ range: r })}
        onGroup={(g) => update({ group: g })}
        onRefresh={handleRefresh}
      />
      <main className="page">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!derived && !error && (
          <p className="muted state" role="status">
            Carregando...
          </p>
        )}
        {derived?.isEmpty && <p className="muted state">Nenhum dado registrado ainda.</p>}
        {derived && !derived.isEmpty && (
          <>
            {game && (
              <div className="filter-chip" role="status">
                <span>
                  Filtrando: <b>{gameName}</b>
                </span>
                <button type="button" onClick={() => update({ game: null })} aria-label="Limpar filtro">
                  ×
                </button>
              </div>
            )}
            <KpiRow
              total={derived.stats.total}
              avgPerActiveDay={derived.stats.avgPerActiveDay}
              activeDays={derived.stats.activeDays}
              top={derived.stats.topAppid ? (meta[derived.stats.topAppid] ?? { name: `App ${derived.stats.topAppid}`, icon: '' }) : null}
              longest={derived.stats.longest}
              distinctGames={derived.prof.distinctGames}
              mainShare={derived.prof.mainGame ? derived.prof.mainGame.share : null}
            />
            <div className="layout">
              <section className="card panel" aria-labelledby="chart-h">
                <div className="panel-head">
                  <h2 id="chart-h">Horas jogadas</h2>
                </div>
                {derived.stats.total === 0 ? (
                  <div className="empty">
                    <p>{game ? `Sem horas de ${gameName} neste período.` : 'Sem horas neste período.'}</p>
                    {game && (
                      <button type="button" className="link-btn" onClick={() => update({ game: null })}>
                        Limpar filtro
                      </button>
                    )}
                  </div>
                ) : (
                  <StackedBars
                    buckets={derived.buckets}
                    top={derived.top}
                    colors={derived.colors}
                    meta={meta}
                    group={group}
                    game={game}
                    onToggleGame={toggleGame}
                  />
                )}
              </section>
              <GameBreakdown
                totals={derived.rangeTotals}
                meta={meta}
                colors={derived.colors}
                game={game}
                onToggleGame={toggleGame}
                onClear={() => update({ game: null })}
              />
            </div>
            <div className="grid-2">
              <CumulativeChart series={derived.filtered} />
              <WeekdayWeekend series={derived.filtered} />
            </div>
            <Ribbon
              series={derived.rangeSeries}
              top={derived.ribbonTop}
              colors={derived.colors}
              meta={meta}
              game={game}
              onToggleGame={toggleGame}
            />
            <div className="grid-2">
              <ProfileCard series={derived.filtered} meta={meta} />
              <MonthCalendar series={derived.calendarSeries} today={data!.today} />
            </div>
            <Heatmap series={derived.heatSeries} cells={derived.cells} meta={meta} />
          </>
        )}
      </main>
    </>
  )
}
