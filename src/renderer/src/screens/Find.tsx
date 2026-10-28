import { useEffect, useMemo, useState } from 'react'
import { Search, ExternalLink, FlaskConical } from 'lucide-react'
import { PageHeader, Button, Field, Input } from '@/components/ui'
import { EmptyState, TallyLoader } from '@/components/Tally'
import { RunLog } from '@/components/RunLog'
import { useToast } from '@/components/Toast'
import { api, useData, domainOf, ago } from '@/lib/api'
import { useJobs } from '@/lib/jobs'
import { navigate } from '@/lib/router'

export function Find() {
  const toast = useToast()
  const { data: settings } = useData(() => api.getSettings())
  const { data: runs } = useData(() => api.listLeadRuns())
  const jobs = useJobs()
  const [category, setCategory] = useState('')
  const [area, setArea] = useState('')
  const [runId, setRunId] = useState<number | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (settings && !category) { setCategory(settings.verticals[0] ?? ''); setArea(settings.regions[0] ?? '') } }, [settings, category])
  const run = runs?.find((r) => r.id === runId) ?? runs?.[0]
  useEffect(() => { setPicked(new Set()) }, [run?.id])
  const finder = jobs.find((j) => j.kind === 'lead_finder' && j.status === 'running')
  const leads = run?.leads ?? []
  const fresh = useMemo(() => leads.map((l, i) => ({ l, i })).filter(({ l }) => !l.duplicateOf), [leads])

  const start = async () => {
    if (!category.trim() || !area.trim()) return
    await api.startJob('lead_finder', { category: category.trim(), area: area.trim() })
    setRunId(null)
  }
  const researchSelected = async () => {
    if (!run) return
    setBusy(true)
    const chosen = [...picked].map((i) => run.leads[i])
    const vertical = settings?.verticals.find((v) => v.toLowerCase() === run.category.toLowerCase()) ?? run.category
    const ids = await api.addLeads(chosen, vertical)
    for (const id of ids) await api.startJob('research', { companyId: id })
    setBusy(false)
    setPicked(new Set())
    toast(`Researching ${ids.length} ${ids.length === 1 ? 'company' : 'companies'}. One runs at a time.`)
    navigate({ name: 'agents' })
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader eyebrow="Web search, never Maps or LinkedIn scraping" title="Find" />
      <form className="flex items-end gap-3 border-b border-rule px-8 py-5" onSubmit={(e) => { e.preventDefault(); void start() }}>
        <div className="w-80"><Field label="Category"><Input list="verticals" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Boat builders" /></Field></div>
        <datalist id="verticals">{settings?.verticals.map((v) => <option key={v} value={v} />)}</datalist>
        <div className="w-64"><Field label="Area"><Input list="regions" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Hibiscus Coast" /></Field></div>
        <datalist id="regions">{settings?.regions.map((v) => <option key={v} value={v} />)}</datalist>
        <Button type="submit" variant="primary" disabled={!!finder || !category.trim() || !area.trim()}><Search size={15} />Find leads</Button>
        {settings?.placesApiKey ? <span className="pb-2 text-[12px] text-go">Using Google Places API</span> : <span className="pb-2 text-[12px] text-ink-3">Web search. Add a Places key in Settings for listings data.</span>}
      </form>

      {finder && (
        <div className="border-b border-rule px-8 py-4">
          <div className="mb-2 flex items-center justify-between"><TallyLoader label={finder.title} /><Button size="sm" variant="danger" onClick={() => void api.cancelJob(finder.id)}>Cancel</Button></div>
          <RunLog jobId={finder.id} className="h-48" />
        </div>
      )}

      <div className="flex-1 px-8 py-5">
        {!run ? (
          !finder && <EmptyState title="No searches yet" body="Pick a category and an area. Results land here with duplicates already marked." />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="display text-[22px]">{run.category} · {run.area}</h2>
                <span className="text-[12.5px] text-ink-3">{leads.length} found · {leads.length - fresh.length} already known · {ago(run.createdAt)}</span>
                {runs && runs.length > 1 && (
                  <select className="h-7 rounded border border-rule-strong bg-paper-raised px-1.5 text-[12px]" value={run.id} onChange={(e) => setRunId(Number(e.target.value))}>
                    {runs.map((r) => <option key={r.id} value={r.id}>{r.category} · {r.area} · {new Date(r.createdAt).toLocaleDateString('en-NZ')}</option>)}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="text-[12.5px] text-ink-2 hover:text-ink" onClick={() => setPicked(new Set(fresh.map((f) => f.i)))}>Select all new</button>
                <Button variant="primary" disabled={!picked.size || busy} onClick={() => void researchSelected()}><FlaskConical size={15} />Research selected{picked.size ? ` (${picked.size})` : ''}</Button>
              </div>
            </div>
            <table className="w-full border-collapse text-left text-[13px]">
              <thead><tr className="border-b border-rule-strong">{['', 'Business', 'Website', 'Phone', 'Area', 'Why it might fit'].map((h) => <th key={h} className="label py-2 pr-4">{h}</th>)}</tr></thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={i} className={`border-b border-rule ${l.duplicateOf ? 'text-ink-3' : ''}`}>
                    <td className="w-8 py-2.5"><input type="checkbox" aria-label={`Select ${l.name}`} disabled={!!l.duplicateOf} checked={picked.has(i)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(i); else n.delete(i); setPicked(n) }} className="accent-[var(--amber)]" /></td>
                    <td className="py-2.5 pr-4 font-semibold">
                      {l.name}
                      {l.duplicateOf && <button onClick={() => navigate({ name: 'prospect', id: l.duplicateOf! })} className="ml-2 rounded bg-paper-2 px-1.5 py-px text-[11px] font-medium text-ink-2 hover:text-ink">In pipeline</button>}
                    </td>
                    <td className="py-2.5 pr-4">{l.website ? <a href={l.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-ink hover:underline">{domainOf(l.website)}<ExternalLink size={11} /></a> : <span className="text-pass">No website</span>}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-ink-2">{l.phone}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{l.area}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
