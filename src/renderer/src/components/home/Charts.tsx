import { useEffect, useRef, useState } from 'react'

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!
}

/*
  Single-series column chart: thin columns with 4px rounded tops on the
  baseline, recessive gridlines, one optional dashed reference line, and a
  per-column hover tooltip. One series, so no legend: the title names it.
*/
export function ColumnChart({ data, format, reference, height = 180 }: {
  data: { label: string; sub?: string; value: number }[]
  format: (n: number) => string
  reference?: { value: number; label: string }
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { l: 52, r: 8, t: 12, b: 26 }
  const plotW = Math.max(0, width - pad.l - pad.r)
  const plotH = height - pad.t - pad.b
  const max = niceMax(Math.max(...data.map((d) => d.value), reference?.value ?? 0))
  const ticks = [0, 0.5, 1].map((f) => f * max)
  const slot = data.length ? plotW / data.length : 0
  const bar = Math.max(6, Math.min(28, slot * 0.5))
  const y = (v: number) => pad.t + plotH - (v / max) * plotH
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--ink-3)] text-[10.5px] tabular-nums">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + slot * i + (slot - bar) / 2
            const h = Math.max(0, y(0) - y(d.value))
            const r = Math.min(4, h)
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={plotH} fill="transparent" />
                {h > 0 && <path d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${bar - 2 * r} q${r},0 ${r},${r} v${h - r} z`} fill="var(--amber)" opacity={hover === null || hover === i ? 1 : 0.45} />}
                <text x={pad.l + slot * i + slot / 2} y={height - 8} textAnchor="middle" className="fill-[var(--ink-3)] text-[10.5px]">{d.label}</text>
              </g>
            )
          })}
          {reference && reference.value > 0 && (
            <g>
              <line x1={pad.l} x2={width - pad.r} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--ink-2)" strokeDasharray="4 4" />
              <text x={width - pad.r} y={y(reference.value) - 5} textAnchor="end" className="fill-[var(--ink-2)] text-[10.5px]">{reference.label} {format(reference.value)}</text>
            </g>
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-rule-strong bg-paper-raised px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{ left: Math.min(width - 140, pad.l + slot * hover + slot / 2 - 50), top: Math.max(0, y(data[hover].value) - 52) }}>
          <div className="text-ink-3">{data[hover].sub ?? data[hover].label}</div>
          <div className="num text-[16px] font-semibold text-ink">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  )
}

/* Part-to-whole as one horizontal bar: 2px surface gaps between segments, hover shows the segment. */
export function SplitBar({ parts }: { parts: { key: string; label: string; value: number; color: string }[] }) {
  const total = parts.reduce((t, p) => t + p.value, 0)
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded" onMouseLeave={() => setHover(null)}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <div
          key={p.key}
          title={`${p.label}: ${total ? Math.round((p.value / total) * 100) : 0}%`}
          onMouseEnter={() => setHover(p.key)}
          className="h-full transition-opacity first:rounded-l last:rounded-r"
          style={{ width: `${total ? (p.value / total) * 100 : 0}%`, background: p.color, opacity: hover && hover !== p.key ? 0.45 : 1 }}
        />
      ))}
      {total === 0 && <div className="h-full w-full rounded bg-paper-3" />}
    </div>
  )
}
