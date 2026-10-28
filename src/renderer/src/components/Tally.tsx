/*
  The tally mark: four strokes and the cross-stroke. Geometry matches the
  tallynz.co lockup (26x24 viewBox) and must not be redrawn. Strokes take
  currentColor; the cross-stroke is always amber.
*/
const STROKES = [3, 9.5, 16, 22.5]

export function TallyMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size * (26 / 24)} height={size} viewBox="0 0 26 24" fill="none" aria-hidden="true" className={className}>
      {STROKES.map((x) => (
        <line key={x} x1={x} y1="3" x2={x} y2="21" stroke="currentColor" strokeWidth="2.5" />
      ))}
      <line x1="-0.5" y1="19" x2="25.5" y2="5" stroke="var(--amber)" strokeWidth="2.5" />
    </svg>
  )
}

export function TallyLoader({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-3" role="status" aria-label={label ?? 'Working'}>
      <svg width={size * (26 / 24)} height={size} viewBox="0 0 26 24" fill="none" className="tally-loader">
        {STROKES.map((x) => (
          <line key={x} x1={x} y1="3" x2={x} y2="21" stroke="currentColor" strokeWidth="2.5" pathLength={1} />
        ))}
        <line x1="-0.5" y1="19" x2="25.5" y2="5" stroke="var(--amber)" strokeWidth="2.5" pathLength={1} />
      </svg>
      {label && <span className="text-xs">{label}</span>}
    </span>
  )
}

/* A count drawn as tally groups: full gates of five, then the remainder. */
export function TallyCount({ n, size = 12, max = 20 }: { n: number; size?: number; max?: number }) {
  const shown = Math.min(n, max)
  const groups = Math.floor(shown / 5)
  const rest = shown % 5
  const h = size
  const w = (k: number) => (k === 5 ? h * (26 / 24) : ((k * 6.5 - 1) / 24) * h)
  return (
    <span className="inline-flex items-end gap-1 align-middle" aria-label={`${n}`} title={`${n}`}>
      {Array.from({ length: groups }, (_, i) => (
        <TallyMark key={i} size={h} />
      ))}
      {rest > 0 && (
        <svg width={w(rest)} height={h} viewBox={`0 0 ${rest * 6.5} 24`} fill="none" aria-hidden="true">
          {Array.from({ length: rest }, (_, i) => (
            <line key={i} x1={3 + i * 6.5} y1="3" x2={3 + i * 6.5} y2="21" stroke="currentColor" strokeWidth="2.5" />
          ))}
        </svg>
      )}
      {n > max && <span className="num text-[11px] leading-none">+{n - max}</span>}
    </span>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <TallyMark size={44} className="text-rule-strong" />
      <div className="display text-2xl text-ink-2">{title}</div>
      {body && <p className="max-w-sm text-ink-3">{body}</p>}
      {action}
    </div>
  )
}
