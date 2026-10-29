import { Phone, ArrowRight, AlertTriangle, Handshake, TrendingUp, FileText, CalendarClock, Wallet, Columns3, type LucideIcon } from 'lucide-react'
import { PageHeader, VerdictBadge, Button } from '@/components/ui'
import { TallyLoader, EmptyState } from '@/components/Tally'
import { api, useData, nzd, domainOf, shortDate } from '@/lib/api'
import { navigate } from '@/lib/router'
import { localDate } from '@shared/rules'
import { STAGE_LABEL, type Company, type Stage } from '@shared/domain'
import { monthlySeries } from '@shared/money'
import { ColumnChart } from '@/components/home/Charts'
import { CarGoalCard } from '@/components/home/CarGoal'
import { MoneySplitCard } from '@/components/home/MoneySplit'

const FLOW: Stage[] = ['discovered', 'researched', 'go', 'conversation', 'contacted', 'meeting', 'proposal', 'won']

/* An icon stat tile: one number, one line of context. */
function Tile({ icon: Icon, label, value, note, warn = false, onClick, children }: { icon: LucideIcon; label: string; value: React.ReactNode; note?: string; warn?: boolean; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex flex-col rounded-lg border bg-paper-raised px-4 py-3.5 text-left transition-colors hover:border-rule-strong ${warn ? 'border-amber' : 'border-rule'}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${warn ? 'bg-amber text-on-amber' : 'bg-amber-wash text-amber-ink'}`}><Icon size={15} /></span>
        <span className="label">{label}</span>
      </div>
      <div className="num text-[32px] font-bold leading-none text-ink">{value}</div>
      {children && <div className="mt-2">{children}</div>}
      {note && <div className={`mt-1.5 truncate text-[11.5px] ${warn ? 'text-amber-ink' : 'text-ink-3'}`}>{note}</div>}
    </button>
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
  const { data: settings } = useData(() => api.getSettings())
  const { data: revenue } = useData(() => api.listRevenue())
  const { data: moves } = useData(() => api.listMoneyMoves())
  const today = localDate()
  const heading = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })

  if (!t || !settings || !revenue || !moves) return <div className="p-10"><TallyLoader label="Loading" /></div>
  const atCap = t.liveProposals.length >= t.proposalCap
  const gstPct = Math.min(100, Math.round((t.trailing12Revenue / t.gstThreshold) * 100))
  const series = monthlySeries(revenue, (r) => r.receivedAt, 12).map((m) => {
    const d = new Date(`${m.month}-01T00:00:00`)
    return { label: d.toLocaleDateString('en-NZ', { month: 'short' }), sub: d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' }), value: m.total }
  })
  const carFund = moves.filter((m) => m.kind === 'car').reduce((sum, m) => sum + m.amount, 0)
  const inPlay = FLOW.slice(2).reduce((sum, st) => sum + (t.stageCounts[st] ?? 0), 0)
  const stageMax = Math.max(1, ...FLOW.map((st) => t.stageCounts[st] ?? 0))
  const kShort = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader eyebrow={heading} title="Home" actions={<Button onClick={() => navigate({ name: 'find' })}>Find leads <ArrowRight size={14} /></Button>} />

      <div className="grid grid-cols-6 gap-3 px-8 pt-6">
        <Tile icon={TrendingUp} label="Recurring" value={nzd(t.mrr)} note={`${t.liveRetainers} retainer${t.liveRetainers === 1 ? '' : 's'}`} onClick={() => navigate({ name: 'pipeline' })} />
        <Tile icon={Handshake} label="Retainer goal" value={<>{t.liveRetainers}<span className="text-[18px] text-ink-3"> / {t.retainerTarget}</span></>} onClick={() => navigate({ name: 'pipeline' })}>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-3"><div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: `${Math.min(100, (t.liveRetainers / Math.max(1, t.retainerTarget)) * 100)}%` }} /></div>
        </Tile>
        <Tile icon={FileText} label="Live proposals" value={<>{t.liveProposals.length}<span className="text-[18px] text-ink-3"> / {t.proposalCap}</span></>} warn={atCap} note={atCap ? 'At the cap' : t.liveProposals.map((c) => c.name).join(', ') || 'None out'} onClick={() => navigate({ name: 'pipeline' })} />
        <Tile icon={Phone} label="Calls to make" value={t.callsToMake.length} note="Scored, not yet called" />
        <Tile icon={CalendarClock} label="Follow-ups due" value={t.followUpsDue.length} warn={t.followUpsDue.some((c) => (c.nextStepDue ?? '') < today)} note={t.followUpsDue.some((c) => (c.nextStepDue ?? '') < today) ? 'Some are overdue' : 'Today and earlier'} />
        <Tile icon={Wallet} label="Last 12 months" value={kShort(t.trailing12Revenue)} warn={t.gstWarning} note={t.gstWarning ? 'Near the GST threshold' : `${gstPct}% of GST threshold`} />
      </div>

      <div className="grid grid-cols-2 gap-4 px-8 pt-4">
        <CarGoalCard settings={settings} mrr={t.mrr} carFund={carFund} />
        <MoneySplitCard settings={settings} revenue={revenue} moves={moves} />
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 px-8 pt-4">
        <section className="rounded-lg border border-rule bg-paper-raised p-5">
          <header className="mb-2 flex items-baseline justify-between"><div><div className="label">Revenue received</div><h2 className="display text-[22px] leading-none">Last 12 months</h2></div><button onClick={() => navigate({ name: 'settings' })} className="text-[12px] text-amber-ink hover:underline">Record a payment</button></header>
          <ColumnChart data={series} format={kShort} reference={{ value: t.retainerTarget * settings.rateCard.monthly, label: 'Retainer goal' }} />
        </section>
        <section className="rounded-lg border border-rule bg-paper-raised p-5">
          <header className="mb-3 flex items-baseline justify-between"><div><div className="label">Pipeline</div><h2 className="display text-[22px] leading-none">{inPlay} in play</h2></div><Columns3 size={16} className="text-ink-3" /></header>
          <ul className="flex flex-col gap-1.5">
            {FLOW.map((st) => {
              const n = t.stageCounts[st] ?? 0
              return (
                <li key={st}>
                  <button onClick={() => navigate({ name: 'pipeline' })} className="group flex w-full items-center gap-2 text-left" title={`${STAGE_LABEL[st]}: ${n}`}>
                    <span className="w-24 shrink-0 text-[12px] text-ink-2">{STAGE_LABEL[st]}</span>
                    <span className="h-3 flex-1 rounded-sm bg-paper-2"><span className="block h-full rounded-r-sm bg-amber transition-[width] duration-500 group-hover:bg-amber-hover" style={{ width: `${(n / stageMax) * 100}%` }} /></span>
                    <span className="num w-6 shrink-0 text-right text-[14px] text-ink">{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
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
        </aside>
      </div>
      {Object.values(t.stageCounts).every((n) => n === 0) && <div className="px-8 pb-10"><EmptyState title="A clean slate" body="Start on Find: pick a vertical and an area, then research the ones that look under-marketed." /></div>}
    </div>
  )
}
