'use client'

import { useState } from 'react'
import type { GameTotal } from '@/lib/aggregate'
import { OTHER_COLOR } from '@/lib/aggregate'
import { formatMinutes } from '@/lib/format'
import GameIcon from './GameIcon'

interface Props {
  totals: GameTotal[]
  meta: Record<string, { name: string; icon: string }>
  colors: Record<string, string>
  game: string | null
  onToggleGame: (appid: string) => void
  onClear: () => void
}

const COLLAPSED = 8

export default function GameBreakdown({ totals, meta, colors, game, onToggleGame, onClear }: Props) {
  const [expanded, setExpanded] = useState(false)
  const all = totals.reduce((a, t) => a + t.minutes, 0)
  const rows = expanded ? totals : totals.slice(0, COLLAPSED)
  // keep a selected game visible even if beyond the collapsed cut
  const selectedHidden = game && !rows.some((r) => r.appid === game) ? totals.find((t) => t.appid === game) : undefined

  return (
    <section className="card panel" aria-labelledby="games-h">
      <div className="panel-head">
        <h2 id="games-h">Por jogo</h2>
        {game && (
          <button type="button" className="link-btn" onClick={onClear}>
            Limpar filtro
          </button>
        )}
      </div>
      {totals.length === 0 ? (
        <p className="muted small">Nenhum jogo no período.</p>
      ) : (
        <ol className="games">
          {[...rows, ...(selectedHidden ? [selectedHidden] : [])].map((t) => {
            const m = meta[t.appid]
            const pct = all > 0 ? (t.minutes / all) * 100 : 0
            const selected = game === t.appid
            return (
              <li key={t.appid}>
                <button
                  type="button"
                  className={selected ? 'game is-selected' : 'game'}
                  aria-pressed={selected}
                  onClick={() => onToggleGame(t.appid)}
                >
                  <span className="game-icon">
                    <GameIcon src={m?.icon} name={m?.name ?? '?'} size={28} />
                  </span>
                  <span className="game-main">
                    <span className="game-line">
                      <span className="game-name">{m?.name ?? `App ${t.appid}`}</span>
                      <span className="game-time">{formatMinutes(t.minutes)}</span>
                    </span>
                    <span className="game-line">
                      <span className="share" aria-hidden="true">
                        <span style={{ width: `${pct}%`, background: colors[t.appid] ?? OTHER_COLOR }} />
                      </span>
                      <span className="game-pct">{pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {totals.length > COLLAPSED && (
        <button type="button" className="link-btn more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Mostrar menos' : `Mostrar todos (${totals.length})`}
        </button>
      )}
    </section>
  )
}
