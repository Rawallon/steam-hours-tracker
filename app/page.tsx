'use client'

import { useEffect, useState, useCallback } from 'react'

interface DayGameStats {
  appid: string
  name: string
  icon: string
  minutes: number
}

interface DayStats {
  date: string
  games: DayGameStats[]
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

const COLORS = ['#66c0f4', '#c6f4d6', '#f4d166', '#f47f66', '#a866f4', '#f466cf']

function colorFor(index: number): string {
  return COLORS[index % COLORS.length]
}

export default function Home() {
  const [stats, setStats] = useState<DayStats[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats?days=30')
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Falha ao carregar dados')
      }
      const data = await res.json()
      setStats(data)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/poll-now', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Falha ao atualizar')
      }
      await loadStats()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main>
      <h1>Steam Hours Tracker</h1>
      <button onClick={handleRefresh} disabled={refreshing}>
        {refreshing ? 'Atualizando...' : 'Atualizar agora'}
      </button>
      {error && <p className="error">{error}</p>}
      {stats === null && !error && <p>Carregando...</p>}
      {stats !== null && stats.length === 0 && <p>Nenhum dado registrado ainda.</p>}
      {stats?.map((day) => {
        const total = day.games.reduce((sum, g) => sum + g.minutes, 0)
        return (
          <section key={day.date} className="day">
            <h2>{day.date}</h2>
            <div className="bar">
              {day.games.map((game, i) => (
                <div
                  key={game.appid}
                  className="bar-segment"
                  style={{ width: `${(game.minutes / total) * 100}%`, backgroundColor: colorFor(i) }}
                  title={`${game.name}: ${formatMinutes(game.minutes)}`}
                />
              ))}
            </div>
            <table>
              <tbody>
                {day.games.map((game) => (
                  <tr key={game.appid}>
                    <td>{game.name}</td>
                    <td>{formatMinutes(game.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </main>
  )
}
