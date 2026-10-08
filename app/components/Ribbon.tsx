'use client'

import { useMemo, useState } from 'react'
import { OTHER, OTHER_COLOR, ribbon, type DayPoint } from '@/lib/aggregate'
import { formatMinutes, longDate, shortDate } from '@/lib/format'
import { niceScale, nameOf } from './StackedBars'
import Legend from './Legend'
import { useWidth } from './useWidth'

type Meta = Record<string, { name: string; icon: string }>

interface Props {
  series: DayPoint[]
  top: string[]
  colors: Record<string, string>
  meta: Meta
  game: string | null
  onToggleGame: (appid: string) => void
}

const M = { left: 38, right: 12, top: 14, bottom: 24 }

export default function Ribbon({ series, top, colors, meta, game, onToggleGame }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const days = useMemo(() => ribbon(series, top), [series, top])
  const layers = useMemo(() => {
    const present = new Set(days.flatMap((d) => d.segments.map((s) => s.appid)))
    return [...top, OTHER].filter((id) => present.has(id))
  }, [days, top])

  const n = days.length
  const H = W < 480 ? 200 : 240
  const plotW = Math.max(0, W - M.left - M.right)
  const plotH = H - M.top - M.bottom
  const maxDay = Math.max(0, ...days.map((d) => d.segments.reduce((a, s) => a + s.minutes, 0)))
  const scale = niceScale(maxDay)
  const xOf = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const yOf = (m: number) => M.top + plotH - (m / 60 / scale.max) * plotH

  // cumulative baselines per day, layer by layer
  const paths = useMemo(() => {
    const base = days.map(() => 0)
    return layers.map((id) => {
      const lower = base.slice()
      const upper = days.map((d, i) => {
        base[i] += d.segments.find((s) => s.appid === id)?.minutes ?? 0
        return base[i]
      })
      return { id, lower, upper }
    })
  }, [days, layers])

  const shape = (lower: number[], upper: number[]) => {
    if (n === 0) return ''
    if (n === 1) {
      const x = xOf(0)
      const w = Math.min(24, plotW / 2)
      return `M${x - w / 2},${yOf(upper[0])} L${x + w / 2},${yOf(upper[0])} L${x + w / 2},${yOf(lower[0])} L${x - w / 2},${yOf(lower[0])} Z`
    }
    const up = upper.map((m, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(m).toFixed(1)}`).join(' ')
    const down = lower
      .map((m, i) => `L${xOf(i).toFixed(1)},${yOf(m).toFixed(1)}`)
      .reverse()
      .join(' ')
    return `${up} ${down} Z`
  }

  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 1 ? [0] : []
  const hd = hover !== null ? days[hover] : null
  const hx = hover !== null ? xOf(hover) : 0

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n === 0 || plotW <= 0) return
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - M.left
    setHover(Math.max(0, Math.min(n - 1, Math.round((x / plotW) * (n - 1)))))
  }

  function onKey(e: React.KeyboardEvent) {
    if (n === 0) return
    const cur = hover ?? n - 1
    const next =
      e.key === 'ArrowLeft' ? cur - 1 : e.key === 'ArrowRight' ? cur + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null
    if (next === null) return
    e.preventDefault()
    setHover(Math.max(0, Math.min(n - 1, next)))
  }

  return (
    <section className="card panel" aria-labelledby="rib-h">
      <div className="panel-head">
        <h2 id="rib-h">Linha do tempo de jogos</h2>
        {game && <span className="muted small">Destacando: {nameOf(meta, game)}</span>}
      </div>
      <div className="chart" ref={ref}>
        {W > 0 && (
          <div
            className="chart-inner ribbon-focus"
            style={{ height: H }}
            tabIndex={0}
            role="group"
            aria-label="Linha do tempo de jogos. Use as setas para navegar pelos dias."
            onKeyDown={onKey}
            onFocus={() => setHover((h) => h ?? n - 1)}
            onBlur={() => setHover(null)}
          >
            <svg width={W} height={H} aria-hidden="true" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
              {[0, 1, 2, 3, 4].map((i) => {
                const y = yOf(i * scale.step * 60)
                return (
                  <g key={i}>
                    <line x1={M.left} x2={W - M.right} y1={y} y2={y} className={i === 0 ? 'axis' : 'grid'} />
                    <text x={M.left - 6} y={y + 3.5} textAnchor="end" className="tick">
                      {`${i * scale.step}h`}
                    </text>
                  </g>
                )
              })}
              {paths.map((p) => (
                <path
                  key={p.id}
                  d={shape(p.lower, p.upper)}
                  fill={colors[p.id] ?? OTHER_COLOR}
                  className="rib-layer"
                  opacity={game && game !== p.id ? 0.22 : 0.92}
                />
              ))}
              {ticks.map((i) => (
                <text
                  key={i}
                  x={xOf(i)}
                  y={H - 7}
                  textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
                  className="tick"
                >
                  {shortDate(days[i].date)}
                </text>
              ))}
              {hd && <line x1={hx} x2={hx} y1={M.top} y2={yOf(0)} className="cum-cursor" />}
            </svg>
            {hd && (
              <div
                className="tooltip"
                style={{ left: hx, top: 4, transform: `translateX(${hx < 130 ? '0%' : hx > W - 130 ? '-100%' : '-50%'})` }}
                role="status"
              >
                <div className="tooltip-title">{longDate(hd.date)}</div>
                {hd.segments.length === 0 && <div className="tooltip-row muted">Sem jogo</div>}
                {hd.segments
                  .slice()
                  .reverse()
                  .map((s) => (
                    <div key={s.appid} className="tooltip-row">
                      <i style={{ background: colors[s.appid] ?? OTHER_COLOR }} />
                      <span>{nameOf(meta, s.appid)}</span>
                      <b>{formatMinutes(s.minutes)}</b>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
      {layers.length > 0 && (
        <Legend ids={layers} colors={colors} meta={meta} game={game} onToggleGame={onToggleGame} />
      )}
    </section>
  )
}
