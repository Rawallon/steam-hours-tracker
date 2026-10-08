'use client'

import { useState } from 'react'

/** Game icon with letter fallback when src is missing or fails to load. */
export default function GameIcon({ src, name, size }: { src?: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span aria-hidden="true">{name.slice(0, 1)}</span>
  return <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
}
