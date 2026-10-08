'use client'

import { useEffect, useState } from 'react'
import { OTHER, OTHER_COLOR, stackOf, type Bucket, type Group } from '@/lib/aggregate'
import { formatMinutes, longDate, monthLabel, shortDate } from '@/lib/format'
import { useWidth } from './useWidth'

type Meta = Record<string, { name: string; icon: string }>

interface Props {
  buckets: Bucket[]
  top: string[]
  colors: Record<string, string>
  meta: Meta
  group: Group
  game: string | null
  onToggleGame: (appid: string) => void
}

const M = { left: 38, right: 8, top: 10, bottom: 24 }
const SCROLL_THRESHOLD = 60
const STEPS = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]

function niceScale(maxMinutes: number) {
  const maxH = maxMinutes / 60
  const step = STEPS.find((s) => s * 4 >= maxH) ?? 200
  return { step, max: step * 4 }
}

function bucketTitle(b: Bucket, group: Group): string {
  if (group === 'month') return monthLabel(b.key)
  if (group === 'week') return `Semana de ${longDate(b.key)}`
  return longDate(b.key)
}

function tickLabel(b: Bucket, group: Group): string {
  return group === 'month' ? monthLabel(b.key) : shortDate(b.key)
}

export function nameOf(meta: Meta, appid: string): string {
  return appid === OTHER ? 'Outros' : (meta[appid]?.name ?? `App ${appid}`)
}

export default function StackedBars({ buckets, top, colors, meta, group, game, onToggleGame }: Props) {
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const n = buckets.length
  const innerW = n > SCROLL_THRESHOLD ? Math.max(wrapW, n * 9 + M.left + M.right) : 0
  // long series: start scrolled to the most recent buckets
  useEffect(() => {
    const el = wrapRef.current
    if (el && innerW > 0) el.scrollLeft = el.scrollWidth
  }, [innerW, wrapRef, buckets])
  const scrolls = n > SCROLL_THRESHOLD
  const W = scrolls ? Math.max(wrapW, n * 9 + M.left + M.right) : wrapW
  const H = wrapW < 480 ? 200 : 240
  const plotW = Math.max(0, W - M.left - M.right)
  const plotH = H - M.top - M.bottom
  const maxTotal = Math.max(0, ...buckets.map((b) => b.total))
  const scale = niceScale(maxTotal)
  const slot = n > 0 ? plotW / n : 0
  const barW = Math.max(1, Math.min(48, slot * 0.72))
  const yOf = (minutes: number) => M.top + plotH - (minutes / 60 / scale.max) * plotH
  const every = Math.max(1, Math.ceil(64 / Math.max(slot, 1)))
  const legend = [...top, ...(buckets.some((b) => stackOf(b, top).some((e) => e.appid === OTHER)) ? [OTHER] : [])]
  const gameVisible = top.length > 0

  const hb = hover !== null ? buckets[hover] : null
  const hx = hover !== null ? M.left + slot * hover + slot / 2 : 0
  const tipAlign = hx < 130 ? '0%' : hx > W - 130 ? '-100%' : '-50%'

  return (
    <div className="chart">
      <div className="chart-scroll" ref={wrapRef} tabIndex={scrolls ? 0 : undefined} aria-label={scrolls ? 'Gráfico, rolável horizontalmente' : undefined}>
        {W > 0 && (
          <div className="chart-inner" style={{ width: W, height: H }}>
            <svg width={W} height={H} role="group" aria-label="Horas jogadas por período" onMouseLeave={() => setHover(null)}>
              {[0, 1, 2, 3, 4].map((i) => {
                const v = i * scale.step
                const y = yOf(v * 60)
                return (
                  <g key={i}>
                    <line x1={M.left} x2={W - M.right} y1={y} y2={y} className={i === 0 ? 'axis' : 'grid'} />
                    <text x={M.left - 6} y={y + 3.5} textAnchor="end" className="tick">
                      {`${v % 1 === 0 ? v : v.toFixed(2).replace(/0$/, '')}h`}
                    </text>
                  </g>
                )
              })}
              {buckets.map((b, i) => {
                const x = M.left + slot * i + (slot - barW) / 2
                let acc = 0
                const segs = stackOf(b, top)
                return (
                  <g
                    key={b.key}
                    tabIndex={scrolls ? undefined : 0}
                    role="img"
                    aria-label={`${bucketTitle(b, group)}: ${formatMinutes(b.total)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className={hover === i ? 'bar is-hover' : 'bar'}
                  >
                    <rect x={M.left + slot * i} y={M.top} width={slot} height={plotH} className="hit" />
                    {segs.map((s) => {
                      const y1 = yOf(acc + s.minutes)
                      const y0 = yOf(acc)
                      acc += s.minutes
                      return (
                        <rect
                          key={s.appid}
                          x={x}
                          y={y1}
                          width={barW}
                          height={Math.max(0, y0 - y1 - (segs.length > 1 ? 0.75 : 0))}
                          fill={colors[s.appid] ?? OTHER_COLOR}
                          rx={barW > 6 ? 1.5 : 0}
                        />
                      )
                    })}
                    {i % every === 0 && (
                      <text x={M.left + slot * i + slot / 2} y={H - 7} textAnchor="middle" className="tick">
                        {tickLabel(b, group)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
            {hb && (
              <div className="tooltip" style={{ left: hx, top: 4, transform: `translateX(${tipAlign})` }} role="status">
                <div className="tooltip-title">{bucketTitle(hb, group)}</div>
                {stackOf(hb, top).length === 0 && <div className="tooltip-row muted">Sem jogo</div>}
                {stackOf(hb, top)
                  .slice()
                  .reverse()
                  .map((s) => (
                    <div key={s.appid} className="tooltip-row">
                      <i style={{ background: colors[s.appid] ?? OTHER_COLOR }} />
                      <span>{nameOf(meta, s.appid)}</span>
                      <b>{formatMinutes(s.minutes)}</b>
                    </div>
                  ))}
                <div className="tooltip-total">
                  <span>Total</span>
                  <b>{formatMinutes(hb.total)}</b>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {gameVisible && (
        <ul className="legend" aria-label="Legenda">
          {legend.map((id) => (
            <li key={id}>
              {id === OTHER ? (
                <span className="legend-item static">
                  <i style={{ background: OTHER_COLOR }} />
                  Outros
                </span>
              ) : (
                <button
                  type="button"
                  className="legend-item"
                  aria-pressed={game === id}
                  onClick={() => onToggleGame(id)}
                  title={game === id ? 'Limpar filtro' : `Filtrar por ${nameOf(meta, id)}`}
                >
                  <i style={{ background: colors[id] ?? OTHER_COLOR }} />
                  {nameOf(meta, id)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
