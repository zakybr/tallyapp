import { useMemo, useState } from 'react'
import { Plus, LayoutGrid, Table2 } from 'lucide-react'
import { PageHeader, Button, VerdictBadge, StageChip } from '@/components/ui'
import { TallyCount, EmptyState } from '@/components/Tally'
import { AddProspect } from '@/components/AddProspect'
import { useToast } from '@/components/Toast'
import { api, useData, shortDate, domainOf } from '@/lib/api'
import { navigate } from '@/lib/router'
import { GAP_LABEL, GAP_TYPES, STAGE_LABEL, type Company, type GapType, type Stage, type Verdict } from '@shared/domain'
import { proposalCapCheck } from '@shared/rules'

const BOARD: Stage[] = ['discovered', 'researched', 'go', 'conversation', 'contacted', 'meeting', 'proposal', 'won']
const CLOSED: Stage[] = ['pass', 'lost']

export async function moveStage(c: Company, stage: Stage, all: Company[], cap: number, toast: (t: string, tone?: 'info' | 'warn' | 'error') => void): Promise<boolean> {
  if (stage === c.stage) return false
  if (stage === 'proposal') {
    const check = proposalCapCheck(all, cap)
    if (check.wouldExceed && !window.confirm(`You already have ${check.live} live proposals (cap ${cap}). Open a ${check.live + 1}th for ${c.name}?`)) return false
  }
  await api.updateCompany(c.id, { stage })
  toast(`${c.name} → ${STAGE_LABEL[stage]}`)
  return true
}

export function Pipeline() {
  const toast = useToast()
  const { data: companies } = useData(() => api.listCompanies())
  const { data: gaps } = useData(() => api.companyGaps())
  const { data: settings } = useData(() => api.getSettings())
  const [view, setView] = useState<'board' | 'table'>(() => (localStorage.getItem('pipeline.view') as 'board' | 'table') ?? 'board')
  const [adding, setAdding] = useState(false)
  const [filters, setFilters] = useState<{ vertical: string; area: string; verdict: string; gap: string; q: string }>({ vertical: '', area: '', verdict: '', gap: '', q: '' })
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<Stage | null>(null)

  const all = companies ?? []
  const filtered = useMemo(() => all.filter((c) =>
    (!filters.vertical || c.vertical === filters.vertical) &&
    (!filters.area || c.area === filters.area) &&
    (!filters.verdict || (filters.verdict === 'none' ? !c.verdict : c.verdict === filters.verdict)) &&
    (!filters.gap || (gaps?.[c.id] ?? []).includes(filters.gap as GapType)) &&
    (!filters.q || `${c.name} ${c.website ?? ''} ${c.area ?? ''}`.toLowerCase().includes(filters.q.toLowerCase()))
  ), [all, filters, gaps])

  const setV = (v: 'board' | 'table') => { setView(v); localStorage.setItem('pipeline.view', v) }
  const drop = async (stage: Stage) => {
    const c = all.find((x) => x.id === dragId)
    setDragId(null); setOver(null)
    if (c && settings) await moveStage(c, stage, all, settings.proposalCap, toast)
  }

  const sel = 'h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[12.5px] text-ink-2'
  const verticals = [...new Set([...(settings?.verticals ?? []), ...all.map((c) => c.vertical).filter(Boolean) as string[]])]
  const areas = [...new Set([...(settings?.regions ?? []), ...all.map((c) => c.area).filter(Boolean) as string[]])]

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={`${all.length} companies · ${all.filter((c) => c.stage === 'proposal').length}/${settings?.proposalCap ?? 3} live proposals`}
        title="Pipeline"
        actions={<>
          <div className="flex rounded-md border border-rule-strong p-0.5">
            <button onClick={() => setV('board')} className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[12.5px] ${view === 'board' ? 'bg-paper-3 text-ink' : 'text-ink-3'}`}><LayoutGrid size={14} />Board</button>
            <button onClick={() => setV('table')} className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[12.5px] ${view === 'table' ? 'bg-paper-3 text-ink' : 'text-ink-3'}`}><Table2 size={14} />Table</button>
          </div>
          <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} />Add prospect</Button>
        </>}
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-8 py-2.5">
        <input className={`${sel} w-56`} placeholder="Filter by name or site" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className={sel} value={filters.vertical} onChange={(e) => setFilters({ ...filters, vertical: e.target.value })}>
          <option value="">All verticals</option>{verticals.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className={sel} value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
          <option value="">All areas</option>{areas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className={sel} value={filters.verdict} onChange={(e) => setFilters({ ...filters, verdict: e.target.value })}>
          <option value="">Any verdict</option><option value="go">Go</option><option value="conversation">Conversation</option><option value="pass">Pass</option><option value="none">Unscored</option>
        </select>
        <select className={sel} value={filters.gap} onChange={(e) => setFilters({ ...filters, gap: e.target.value })}>
          <option value="">Any gap</option>{GAP_TYPES.map((g) => <option key={g} value={g}>{GAP_LABEL[g]}</option>)}
        </select>
        {(filters.vertical || filters.area || filters.verdict || filters.gap || filters.q) && (
          <button className="text-[12.5px] text-amber-ink underline-offset-2 hover:underline" onClick={() => setFilters({ vertical: '', area: '', verdict: '', gap: '', q: '' })}>Clear</button>
        )}
      </div>

      {companies && all.length === 0 ? (
        <EmptyState title="No prospects yet" body="Run the Lead Finder or add one by hand." action={<Button variant="primary" onClick={() => navigate({ name: 'find' })}>Find leads</Button>} />
      ) : view === 'board' ? (
        <div className="scroll-quiet flex flex-1 gap-3 overflow-x-auto px-8 py-5">
          {[...BOARD, ...CLOSED].map((stage) => {
            const cards = filtered.filter((c) => c.stage === stage)
            const closed = CLOSED.includes(stage)
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setOver(stage) }}
                onDragLeave={() => setOver((o) => (o === stage ? null : o))}
                onDrop={() => void drop(stage)}
                className={`flex shrink-0 flex-col rounded-lg transition-colors ${closed ? 'w-[200px]' : 'w-[248px]'} ${over === stage ? 'bg-amber-wash ring-1 ring-amber' : 'bg-paper-2/60'}`}
              >
                <div className="flex items-center justify-between px-3 pb-2 pt-3">
                  <span className={`label ${stage === 'go' ? 'text-go' : stage === 'pass' ? 'text-pass' : ''}`}>{STAGE_LABEL[stage]}</span>
                  <span className="flex items-center gap-1.5 text-ink-3"><TallyCount n={cards.length} size={11} max={10} /><span className="num text-[13px] font-semibold text-ink-2">{cards.length}</span></span>
                </div>
                <div className="scroll-quiet flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
                  {cards.map((c) => (
                    <article
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setOver(null) }}
                      onClick={() => navigate({ name: 'prospect', id: c.id })}
                      className={`cursor-pointer rounded-md border border-rule bg-paper-raised p-2.5 transition hover:border-rule-strong hover:shadow-sm ${dragId === c.id ? 'opacity-40' : ''} ${closed ? 'opacity-80' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13.5px] font-semibold leading-snug text-ink">{c.name}</div>
                        {c.verdict && stage !== c.verdict && <VerdictBadge verdict={c.verdict} />}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-3">{[c.area, domainOf(c.website)].filter(Boolean).join(' · ') || 'No site on file'}</div>
                      {(gaps?.[c.id]?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {gaps![c.id].slice(0, 3).map((g) => <span key={g} className="rounded bg-paper-2 px-1.5 py-px text-[10.5px] text-ink-2">{GAP_LABEL[g]}</span>)}
                        </div>
                      )}
                      {c.nextStep && (
                        <div className="mt-2 border-t border-rule pt-1.5 text-[11.5px] text-ink-2">
                          <span className="text-amber-ink">{c.nextStepDue ? shortDate(c.nextStepDue) : 'Next'}</span> · {c.nextStep}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-8 py-4">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule-strong">
                {['Company', 'Area', 'Vertical', 'Stage', 'Verdict', 'Gaps', 'Next step', 'Updated'].map((h) => <th key={h} className="label py-2 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => navigate({ name: 'prospect', id: c.id })} className="cursor-pointer border-b border-rule hover:bg-paper-2">
                  <td className="py-2 pr-4"><div className="font-semibold">{c.name}</div><div className="text-[11.5px] text-ink-3">{domainOf(c.website)}</div></td>
                  <td className="py-2 pr-4 text-ink-2">{c.area}</td>
                  <td className="py-2 pr-4 text-ink-2">{c.vertical}</td>
                  <td className="py-2 pr-4"><StageChip stage={c.stage} /></td>
                  <td className="py-2 pr-4"><VerdictBadge verdict={c.verdict as Verdict | null} /></td>
                  <td className="num py-2 pr-4 text-[14px]">{gaps?.[c.id]?.length ?? 0}</td>
                  <td className="py-2 pr-4 text-ink-2">{c.nextStep}{c.nextStepDue && <span className="text-amber-ink"> · {shortDate(c.nextStepDue)}</span>}</td>
                  <td className="num py-2 pr-4 text-[13px] text-ink-3">{new Date(c.updatedAt).toLocaleDateString('en-NZ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState title="Nothing matches" body="Loosen a filter." />}
        </div>
      )}
      <AddProspect open={adding} onClose={() => setAdding(false)} settings={settings} />
    </div>
  )
}

