import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CalendarCheck, Columns3, Bot, Settings as Cog, Building2, Phone, HardDriveDownload, FileSpreadsheet, Moon, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import { applyTheme } from '@/lib/theme'
import { useToast } from './Toast'
import { VerdictBadge } from './ui'
import type { Company } from '@shared/domain'

interface Command { id: string; label: string; hint?: string; icon: LucideIcon; group: string; run: () => void; company?: Company }

/* Every word typed must appear somewhere in the label or hint. */
const matches = (c: Command, q: string) => {
  const hay = `${c.label} ${c.hint ?? ''}`.toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [companies, setCompanies] = useState<Company[]>([])
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    setQ(''); setSel(0)
    void api.listCompanies().then(setCompanies)
    setTimeout(() => input.current?.focus(), 0)
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const go = (label: string, to: string, icon: LucideIcon, hint?: string): Command => ({ id: `go-${to}`, label, hint, icon, group: 'Go to', run: () => navigate(to) })
    const base: Command[] = [
      go('Today', '#/today', CalendarCheck, '⌘1'), go('Find leads', '#/find', Search, '⌘2'), go('Pipeline', '#/pipeline', Columns3, '⌘3'),
      go('Agents and run log', '#/agents', Bot, '⌘4'), go('Settings', '#/settings', Cog, '⌘,'),
      { id: 'backup', label: 'Back up everything now', icon: HardDriveDownload, group: 'Actions', run: () => void api.backup().then((r) => r && toast(`Backup saved: ${r.file}`)) },
      { id: 'csv', label: 'Export to CSV', icon: FileSpreadsheet, group: 'Actions', run: () => void api.exportCsv().then((r) => r && toast(`Exported ${r.files.length} files`)) },
      { id: 'dark', label: 'Toggle dark mode', icon: Moon, group: 'Actions', run: () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(next); void api.saveSettings({ theme: next }) } }
    ]
    const people = companies.flatMap((c): Command[] => {
      const hint = [c.area, c.vertical, c.website].filter(Boolean).join(' · ')
      const open: Command = { id: `c-${c.id}`, label: c.name, hint, icon: Building2, group: 'Prospects', run: () => navigate({ name: 'prospect', id: c.id }), company: c }
      const call: Command = { id: `call-${c.id}`, label: `Call ${c.name}`, hint: c.phone ?? undefined, icon: Phone, group: 'Call mode', run: () => navigate({ name: 'call', id: c.id }), company: c }
      return ['go', 'conversation', 'contacted', 'meeting', 'proposal'].includes(c.stage) ? [open, call] : [open]
    })
    return [...base, ...people]
  }, [companies, toast])

  const shown = useMemo(() => {
    const hits = q ? commands.filter((c) => matches(c, q)) : commands.filter((c) => c.group !== 'Call mode')
    return hits.slice(0, 40)
  }, [commands, q])

  useEffect(() => setSel(0), [q])
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  if (!open) return null
  const pick = (c: Command | undefined) => { if (!c) return; onClose(); c.run() }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(shown[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 pt-[14vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Command palette" className="rise w-[600px] overflow-hidden rounded-[12px] bg-chrome-2 text-chrome-ink shadow-2xl ring-1 ring-chrome-line" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-chrome-line px-4">
          <Search size={16} className="text-chrome-ink-3" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Jump to a prospect, screen or action…" aria-label="Search commands"
            className="h-12 flex-1 bg-transparent text-[15px] text-chrome-ink placeholder:text-chrome-ink-3 focus:outline-none" />
          <kbd className="rounded border border-chrome-line px-1 font-mono text-[10.5px] text-chrome-ink-3">esc</kbd>
        </div>
        <ul ref={list} className="scroll-quiet max-h-[52vh] overflow-y-auto py-1.5" role="listbox">
          {shown.map((c, i) => {
            const header = c.group !== lastGroup ? (lastGroup = c.group) : null
            const Icon = c.icon
            return (
              <li key={c.id}>
                {header && <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-chrome-ink-3">{header}</div>}
                <button role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => pick(c)}
                  className={`relative flex w-full items-center gap-3 px-4 py-2 text-left text-[13.5px] ${i === sel ? 'bg-chrome-3 text-chrome-ink' : 'text-chrome-ink-2'}`}>
                  {i === sel && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-amber" />}
                  <Icon size={15} strokeWidth={1.75} className={i === sel ? 'text-amber' : 'text-chrome-ink-3'} />
                  <span className="truncate">{c.label}</span>
                  {c.company?.verdict && c.group === 'Prospects' && <VerdictBadge verdict={c.company.verdict} />}
                  {c.hint && <span className="ml-auto truncate pl-3 text-[11.5px] text-chrome-ink-3">{c.hint}</span>}
                </button>
              </li>
            )
          })}
          {!shown.length && <li className="px-4 py-6 text-center text-[13px] text-chrome-ink-3">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  )
}
