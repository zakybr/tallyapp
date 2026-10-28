import { useState } from 'react'
import { api, ago } from '@/lib/api'
import { Textarea, Button } from '../ui'
import type { Activity } from '@shared/domain'

const DOT: Record<string, string> = {
  stage_change: 'bg-amber', call: 'bg-go', meeting: 'bg-go', email_sent: 'bg-go', debrief: 'bg-amber', opt_out: 'bg-pass'
}

export function Timeline({ companyId, activities }: { companyId: number; activities: Activity[] }) {
  const [note, setNote] = useState('')
  const add = async () => { if (!note.trim()) return; await api.addNote(companyId, note.trim()); setNote('') }
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) void add() }} />
        <div className="flex justify-end"><Button size="sm" onClick={() => void add()} disabled={!note.trim()}>Add note <span className="text-ink-3">⌘↵</span></Button></div>
      </div>
      <ol className="relative ml-1.5 border-l border-rule">
        {activities.map((a) => (
          <li key={a.id} className="mb-3 ml-4">
            <span className={`absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full ${DOT[a.kind] ?? 'bg-rule-strong'}`} />
            <div className="selectable text-[12.5px] leading-snug text-ink">{a.summary}</div>
            {a.outcome && <div className="text-[12px] text-ink-2">{a.outcome}</div>}
            <div className="text-[11px] text-ink-3">{ago(a.at)}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}
