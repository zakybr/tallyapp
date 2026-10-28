import { useEffect, useRef, useState } from 'react'
import { useJobLog } from '@/lib/jobs'
import type { LogLevel } from '@shared/domain'

const MARK: Record<LogLevel, { glyph: string; cls: string }> = {
  info: { glyph: '·', cls: 'text-chrome-ink-3' },
  tool: { glyph: '›', cls: 'text-chrome-ink-2' },
  page: { glyph: '↗', cls: 'text-[#8fb7d9]' },
  finding: { glyph: '◆', cls: 'text-amber' },
  text: { glyph: ' ', cls: 'text-chrome-ink' },
  error: { glyph: '✕', cls: 'text-[#ef7a62]' },
  done: { glyph: '✓', cls: 'text-[#6fbf87]' }
}

/* The run log is always dark: it is a terminal, part of the chrome. */
export function RunLog({ jobId, className = '' }: { jobId?: string; className?: string }) {
  const log = useJobLog(jobId)
  const ref = useRef<HTMLDivElement>(null)
  const [stick, setStick] = useState(true)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => { if (stick && ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [log, stick])
  return (
    <div
      ref={ref}
      onScroll={(e) => { const el = e.currentTarget; setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 40) }}
      className={`scroll-quiet selectable overflow-y-auto rounded-lg bg-chrome px-4 py-3 font-mono text-[11.5px] leading-[1.7] ${className}`}
    >
      {!jobId && <div className="text-chrome-ink-3">Pick a job to see its log.</div>}
      {log.map((e, i) => {
        const m = MARK[e.level]
        return (
          <div key={i} className="group">
            <div className={`flex gap-3 ${e.detail ? 'cursor-pointer' : ''}`} onClick={() => e.detail && setOpen(open === i ? null : i)}>
              <span className="w-[54px] shrink-0 text-chrome-ink-3">{new Date(e.at).toLocaleTimeString('en-NZ', { hour12: false })}</span>
              <span className={`w-3 shrink-0 ${m.cls}`}>{m.glyph}</span>
              <span className={`min-w-0 whitespace-pre-wrap break-words ${m.cls}`}>{e.message}</span>
            </div>
            {open === i && e.detail && <pre className="my-1 ml-[78px] whitespace-pre-wrap break-words rounded bg-chrome-2 p-2 text-chrome-ink-2">{e.detail}</pre>}
          </div>
        )
      })}
    </div>
  )
}
