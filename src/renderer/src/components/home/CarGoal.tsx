import { useEffect, useState } from 'react'
import { CarFront, SlidersHorizontal } from 'lucide-react'
import { api, nzd } from '@/lib/api'
import { carPlan, takeHome, MIN_DEPOSIT_PCT, type CarGoal as Goal } from '@shared/money'
import type { Settings } from '@shared/domain'

const pct = (n: number) => `${Math.round(n * 100)}%`

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5 last:border-0">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <span className="text-right"><span className="num text-[16px] font-semibold text-ink">{value}</span>{sub && <span className="ml-1.5 text-[11.5px] text-ink-3">{sub}</span>}</span>
    </div>
  )
}

function NumberField({ label, value, onCommit, min, max, step = 1, suffix }: { label: string; value: number; onCommit: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const [v, setV] = useState(String(value))
  useEffect(() => setV(String(value)), [value])
  const commit = () => {
    let n = Number(v)
    if (!Number.isFinite(n)) n = value
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    setV(String(n))
    if (n !== value) onCommit(n)
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="flex h-8 items-center rounded-md border border-rule-strong bg-paper-raised px-2 focus-within:border-amber">
        <input aria-label={label} type="number" min={min} max={max} step={step} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="num w-full bg-transparent text-[15px] focus:outline-none" />
        {suffix && <span className="text-[12px] text-ink-3">{suffix}</span>}
      </span>
    </label>
  )
}

export function CarGoalCard({ settings, mrr, carFund }: { settings: Settings; mrr: number; carFund: number }) {
  const [editing, setEditing] = useState(false)
  const goal = settings.carGoal
  const plan = carPlan(goal, { mrr, payPct: settings.split.pay, retainerFee: settings.rateCard.monthly, depositSaved: carFund })
  const save = (patch: Partial<Goal>) => void api.saveSettings({ carGoal: { ...goal, ...patch } })
  const onTrack = plan.extraRevenueMonthly <= 0

  return (
    <section className="rounded-lg border border-rule bg-paper-raised p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-wash text-amber-ink"><CarFront size={18} /></span>
          <div>
            <div className="label">Main goal</div>
            <h2 className="display text-[22px] leading-none">{goal.name} · {nzd(goal.price)}</h2>
          </div>
        </div>
        <button onClick={() => setEditing((e) => !e)} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${editing ? 'bg-paper-3 text-ink' : 'text-ink-3 hover:text-ink'}`}><SlidersHorizontal size={13} />Assumptions</button>
      </header>

      <div className="mb-4 rounded-md bg-paper-2 px-4 py-3">
        <div className="label mb-1">{onTrack ? 'Safely affordable now' : 'Extra revenue needed, every month'}</div>
        <div className="flex items-baseline gap-2">
          <span className="num text-[40px] font-bold leading-none text-ink">{onTrack ? 'On track' : nzd(plan.extraRevenueMonthly)}</span>
          {!onTrack && <span className="text-[13px] text-ink-2">≈ {plan.retainersNeeded} more retainer{plan.retainersNeeded === 1 ? '' : 's'} at {nzd(settings.rateCard.monthly)}</span>}
        </div>
        <div className="mt-1 text-[12px] text-ink-3">To keep the car under {goal.safeIncomePct}% of your gross pay, the business needs {nzd(plan.requiredRevenueMonthly)}/month (now {nzd(mrr)}).</div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
          <span className="text-ink-2">Deposit saved ({Math.max(MIN_DEPOSIT_PCT, goal.depositPct)}%, minimum {MIN_DEPOSIT_PCT}%)</span>
          <span className="num text-[14px] text-ink">{nzd(carFund)} / {nzd(plan.deposit)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-3"><div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: pct(plan.depositPctSaved) }} /></div>
        <div className="mt-1 text-[11.5px] text-ink-3">Log transfers "To car fund" in the money split to fill this.</div>
      </div>

      <Fact label="Loan" value={nzd(plan.financed)} sub={`${goal.termYears} yrs at ${goal.ratePct}%`} />
      <Fact label="Repayment" value={`${nzd(plan.payment)}/mo`} sub={`${nzd(plan.totalInterest)} interest overall`} />
      <Fact label="Running costs" value={`${nzd(goal.runningMonthly)}/mo`} sub="insurance, servicing, tyres, fuel" />
      <Fact label="Total car cost" value={`${nzd(plan.monthlyCarCost)}/mo`} />
      <Fact label="Safe gross pay needed" value={`${nzd(plan.requiredGrossAnnual)}/yr`} sub={`${nzd(takeHome(plan.requiredGrossAnnual))} after tax`} />
      <Fact label="Car share of take-home" value={pct(plan.monthlyCarCost * 12 / Math.max(1, takeHome(plan.requiredGrossAnnual)))} sub="at the safe pay level" />
      <Fact label="Your pay now" value={`${nzd(plan.currentGrossAnnual)}/yr`} sub={`${settings.split.pay}% of revenue`} />

      {editing && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-4">
          <label className="col-span-3 flex flex-col gap-1">
            <span className="label">Car</span>
            <input aria-label="Car" defaultValue={goal.name} onBlur={(e) => e.target.value.trim() && e.target.value !== goal.name && save({ name: e.target.value.trim() })} className="h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px] focus:border-amber focus:outline-none" />
          </label>
          <NumberField label="Price" value={goal.price} min={0} step={1000} onCommit={(price) => save({ price })} />
          <NumberField label="Deposit" value={Math.max(MIN_DEPOSIT_PCT, goal.depositPct)} min={MIN_DEPOSIT_PCT} max={100} suffix="%" onCommit={(depositPct) => save({ depositPct })} />
          <NumberField label="Term" value={goal.termYears} min={1} max={7} suffix="yrs" onCommit={(termYears) => save({ termYears })} />
          <NumberField label="Interest" value={goal.ratePct} min={0} max={30} step={0.05} suffix="%" onCommit={(ratePct) => save({ ratePct })} />
          <NumberField label="Running costs" value={goal.runningMonthly} min={0} step={50} suffix="/mo" onCommit={(runningMonthly) => save({ runningMonthly })} />
          <NumberField label="Car cost ≤ pay" value={goal.safeIncomePct} min={5} max={40} suffix="%" onCommit={(safeIncomePct) => save({ safeIncomePct })} />
          <p className="col-span-3 text-[11.5px] leading-relaxed text-ink-3">
            Safe means the whole monthly car cost stays within {goal.safeIncomePct}% of your gross pay, with at least {MIN_DEPOSIT_PCT}% down. Living at home with no rent, 30–40% is your ceiling; most rules of thumb assume housing costs and sit near 10–15%. Tax uses 2024 NZ rates plus ACC. A planning estimate from your numbers, not financial advice: check the rate and terms with the lender.
          </p>
        </div>
      )}
    </section>
  )
}
