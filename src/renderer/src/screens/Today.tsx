import { Phone, ArrowRight, AlertTriangle } from 'lucide-react'
import { PageHeader, VerdictBadge, Button } from '@/components/ui'
import { TallyCount, TallyLoader, EmptyState } from '@/components/Tally'
import { api, useData, nzd, domainOf, shortDate } from '@/lib/api'
import { navigate } from '@/lib/router'
import { localDate } from '@shared/rules'
import { STAGE_LABEL, type Company, type Stage } from '@shared/domain'

const FLOW: Stage[] = ['discovered', 'researched', 'go', 'conversation', 'contacted', 'meeting', 'proposal', 'won']

/* A stat panel: big tabular number, a tally strip, one line of context. */
function Stat({ label, value, of, note, warn = false, children }: { label: string; value: string | number; of?: string | number; note?: string; warn?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border bg-paper-raised px-5 py-4 ${warn ? 'border-amber' : 'border-rule'}`}>
      <div className="label mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[44px] font-bold leading-none text-ink">{value}</span>
        {of !== undefined && <span className="num text-[22px] text-ink-3">/ {of}</span>}
      </div>
      {children && <div className="mt-2.5 text-ink">{children}</div>}
      {note && <div className={`mt-2 text-[12px] ${warn ? 'text-amber-ink' : 'text-ink-3'}`}>{note}</div>}
    </div>
  )
}

function Row({ c, right, sub }: { c: Company; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <li className="group flex items-center gap-3 border-b border-rule py-2.5 last:border-0">
      <button onClick={() => navigate({ name: 'prospect', id: c.id })} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2"><span className="truncate text-[13.5px] font-semibold text-ink group-hover:text-amber-ink">{c.name}</span><VerdictBadge verdict={c.verdict} /></div>
        <div className="truncate text-[12px] text-ink-3">{sub ?? [c.area, domainOf(c.website), c.phone].filter(Boolean).join(' · ')}</div>
      </button>
      {right}
    </li>
  )
}

export function Today() {
  const { data: t } = useData(() => api.today())
  const today = localDate()
  const heading = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!t) return <div className="p-10"><TallyLoader label="Loading" /></div>
  const atCap = t.liveProposals.length >= t.proposalCap
  const gstPct = Math.min(100, Math.round((t.trailing12Revenue / t.gstThreshold) * 100))

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader eyebrow={heading} title="Today" actions={<Button onClick={() => navigate({ name: 'find' })}>Find leads <ArrowRight size={14} /></Button>} />

      <div className="grid grid-cols-3 gap-4 px-8 pt-6">
        <Stat label="Live proposals" value={t.liveProposals.length} of={t.proposalCap} warn={atCap} note={atCap ? 'At the cap. Close one before opening another.' : t.liveProposals.map((c) => c.name).join(', ') || 'None out'}>
          <span className="inline-flex items-end gap-1">
            {t.liveProposals.length > 0 && <TallyCount n={t.liveProposals.length} size={16} />}
            {t.proposalCap > t.liveProposals.length && <span className="text-rule-strong"><TallyCount n={t.proposalCap - t.liveProposals.length} size={16} /></span>}
          </span>
        </Stat>
        <Stat label="Retainers" value={t.liveRetainers} of={t.retainerTarget} note={`${nzd(t.mrr)} monthly recurring`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-3"><div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: `${Math.min(100, (t.liveRetainers / Math.max(1, t.retainerTarget)) * 100)}%` }} /></div>
        </Stat>
        <Stat label="Revenue, last 12 months" value={nzd(t.trailing12Revenue)} warn={t.gstWarning} note={t.gstWarning ? `Approaching the ${nzd(t.gstThreshold)} GST threshold. Talk to your accountant about registering.` : `${gstPct}% of the ${nzd(t.gstThreshold)} GST threshold`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-3"><div className={`h-full rounded-full transition-[width] duration-500 ${t.gstWarning ? 'bg-amber' : 'bg-ink-3'}`} style={{ width: `${gstPct}%` }} /></div>
        </Stat>
      </div>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px] gap-8 px-8 py-7">
        <section>
          <header className="mb-2 flex items-baseline justify-between border-b border-rule pb-2"><h2 className="display text-[19px]">Calls to make</h2><span className="num text-[15px] text-ink-3">{t.callsToMake.length}</span></header>
          {t.callsToMake.length ? (
            <ul>{t.callsToMake.map((c) => <Row key={c.id} c={c} right={<Button size="sm" variant="primary" onClick={() => navigate({ name: 'call', id: c.id })}><Phone size={13} />Call</Button>} />)}</ul>
          ) : <p className="py-4 text-[12.5px] text-ink-3">No scored prospects waiting. Research a few from Find.</p>}
        </section>

        <section>
          <header className="mb-2 flex items-baseline justify-between border-b border-rule pb-2"><h2 className="display text-[19px]">Follow-ups due</h2><span className="num text-[15px] text-ink-3">{t.followUpsDue.length}</span></header>
          {t.followUpsDue.length ? (
            <ul>{t.followUpsDue.map((c) => {
              const overdue = (c.nextStepDue ?? '') < today
              return <Row key={c.id} c={c} sub={c.nextStep ?? 'Next step not set'} right={<span className={`shrink-0 text-[12px] font-medium ${overdue ? 'text-pass' : 'text-amber-ink'}`}>{overdue && <AlertTriangle size={12} className="mr-1 inline" />}{c.nextStepDue === today ? 'Today' : shortDate(c.nextStepDue)}</span>} />
            })}</ul>
          ) : <p className="py-4 text-[12.5px] text-ink-3">Nothing due. Clear desk.</p>}
        </section>

        <aside className="flex flex-col gap-7">
          <section>
            <header className="mb-2 flex items-baseline justify-between border-b border-rule pb-2"><h2 className="display text-[19px]">Agents</h2><button onClick={() => navigate({ name: 'agents' })} className="text-[12px] text-amber-ink hover:underline">Run log</button></header>
            {t.runningJobs.length ? (
              <ul className="flex flex-col gap-2">{t.runningJobs.map((j) => (
                <li key={j.id}><button onClick={() => navigate({ name: 'agents', jobId: j.id })} className="w-full text-left"><TallyLoader size={14} label={j.title} /></button></li>
              ))}</ul>
            ) : <p className="text-[12.5px] text-ink-3">Nothing running.</p>}
          </section>
          <section>
            <header className="mb-2 border-b border-rule pb-2"><h2 className="display text-[19px]">Pipeline</h2></header>
            <ul className="flex flex-col gap-1">
              {FLOW.map((s) => (
                <li key={s}>
                  <button onClick={() => navigate({ name: 'pipeline' })} className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-paper-2">
                    <span className="w-24 text-[12.5px] text-ink-2">{STAGE_LABEL[s]}</span>
                    <span className="flex-1 text-ink-2">{t.stageCounts[s] ? <TallyCount n={t.stageCounts[s]} size={11} /> : <span className="text-ink-3">·</span>}</span>
                    <span className="num w-6 text-right text-[14px] text-ink">{t.stageCounts[s] || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {Object.values(t.stageCounts).every((n) => n === 0) && <div className="px-8 pb-10"><EmptyState title="A clean slate" body="Start on Find: pick a vertical and an area, then research the ones that look under-marketed." /></div>}
    </div>
  )
}
