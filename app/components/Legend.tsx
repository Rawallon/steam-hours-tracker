import { OTHER, OTHER_COLOR } from '@/lib/aggregate'
import { nameOf } from './StackedBars'

interface Props {
  ids: string[]
  colors: Record<string, string>
  meta: Record<string, { name: string; icon: string }>
  game: string | null
  onToggleGame: (appid: string) => void
}

export default function Legend({ ids, colors, meta, game, onToggleGame }: Props) {
  return (
    <ul className="legend" aria-label="Legenda">
      {ids.map((id) => (
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
  )
}
