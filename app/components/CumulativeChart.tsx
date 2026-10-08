'use client'

import { useState } from 'react'
import { cumulative, type DayPoint } from '@/lib/aggregate'
import { formatMinutes, longDate, shortDate } from '@/lib/format'
import { niceScale } from './StackedBars'
import { useWidth } from './useWidth'

const M = { left: 38, right: 12, top: 14, bottom: 24 }

export default function CumulativeChart({ series }: { series: DayPoint[] }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pts = cumulative(series)
  const total = pts.length ? pts[pts.length - 1].minutes : 0
  const H = W < 480 ? 180 : 210
  const plotW = Math.max(0, W - M.left - M.right)
  const plotH = H - M.top - M.bottom
  const scale = niceScale(total)
  const n = pts.length
  const xOf = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const yOf = (m: number) => M.top + plotH - (m / 60 / scale.max) * plotH
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.minutes).toFixed(1)}`).join(' ')
  const area = n ? `${line} L${xOf(n - 1).toFixed(1)},${yOf(0)} L${xOf(0).toFixed(1)},${yOf(0)} Z` : ''
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 1 ? [0] : []
  const hp = hover !== null ? pts[hover] : null

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n === 0 || plotW <= 0) return
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left - M.left
    setHover(Math.max(0, Math.min(n - 1, Math.round((x / plotW) * (n - 1)))))
  }

  return (
    <section className="card panel" aria-labelledby="cum-h">
      <div className="panel-head">
        <h2 id="cum-h">Horas acumuladas</h2>
        <span className="cum-total">Total: {formatMinutes(total)}</span>
      </div>
      <div className="chart" ref={ref}>
        {W > 0 && (
          <div className="chart-inner" style={{ height: H }}>
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={`Horas acumuladas no período, total ${formatMinutes(total)}`}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
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
              {n > 0 && (
                <>
                  <path d={area} className="cum-area" />
                  <path d={line} className="cum-line" />
                  <circle cx={xOf(n - 1)} cy={yOf(total)} r={3.5} className="cum-dot" />
                </>
              )}
              {ticks.map((i) => (
                <text
                  key={i}
                  x={xOf(i)}
                  y={H - 7}
                  textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
                  className="tick"
                >
                  {shortDate(pts[i].date)}
                </text>
              ))}
              {hp && hover !== null && (
                <>
                  <line x1={xOf(hover)} x2={xOf(hover)} y1={M.top} y2={yOf(0)} className="cum-cursor" />
                  <circle cx={xOf(hover)} cy={yOf(hp.minutes)} r={3.5} className="cum-dot" />
                </>
              )}
            </svg>
            {hp && hover !== null && (
              <div
                className="tooltip tooltip-sm"
                style={{
                  left: xOf(hover),
                  top: 4,
                  transform: `translateX(${xOf(hover) < 100 ? '0%' : xOf(hover) > W - 100 ? '-100%' : '-50%'})`,
                }}
              >
                <div className="tooltip-title">{longDate(hp.date)}</div>
                <div className="tooltip-total">
                  <span>Acumulado</span>
                  <b>{formatMinutes(hp.minutes)}</b>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
