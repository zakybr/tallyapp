import { useState } from 'react'
import { PiggyBank, SlidersHorizontal, X } from 'lucide-react'
import { api, nzd } from '@/lib/api'
import { SplitBar } from './Charts'
import { BUCKETS, BUCKET_LABEL, splitRevenue, type Bucket, type RevenueSplit } from '@shared/money'
import { localDate } from '@shared/rules'
import { MOVE_KINDS, MOVE_LABEL, type MoneyMove, type MoveKind, type Revenue, type Settings } from '@shared/domain'

const COLOR: Record<Bucket, string> = { pay: 'var(--viz-pay)', save: 'var(--viz-save)', tax: 'var(--viz-tax)', opex: 'var(--viz-opex)' }
/* Which bucket each logged transfer counts against. The car fund is saving. */
const MOVE_BUCKET: Record<MoveKind, Bucket> = { pay: 'pay', save: 'save', car: 'save', tax: 'tax' }

export function MoneySplitCard({ settings, revenue, moves }: { settings: Settings; revenue: Revenue[]; moves: MoneyMove[] }) {
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [editing, setEditing] = useState(false)
  const [move, setMove] = useState<{ kind: MoveKind; amount: string; movedAt: string }>({ kind: 'save', amount: '', movedAt: localDate() })
  const split = settings.split
  const thisMonth = localDate().slice(0, 7)
  const yearAgo = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return localDate(d) })()
  const inPeriod = (date: string) => (period === 'month' ? date.slice(0, 7) === thisMonth : date > yearAgo)
  const received = revenue.filter((r) => inPeriod(r.receivedAt)).reduce((t, r) => t + r.amount, 0)
  const s = splitRevenue(received, split)
  const moved = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>
  for (const m of moves) if (inPeriod(m.movedAt)) moved[MOVE_BUCKET[m.kind]] += m.amount
  const shareTotal = BUCKETS.reduce((t, b) => t + split[b], 0)
  const save = (patch: Partial<RevenueSplit>) => void api.saveSettings({ split: { ...split, ...patch } })

  return (
    <section className="rounded-lg border border-rule bg-paper-raised p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-wash text-amber-ink"><PiggyBank size={18} /></span>
          <div>
            <div className="label">Money split</div>
            <h2 className="display text-[22px] leading-none">Save vs pay yourself</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-rule-strong p-0.5 text-[12px]">
            {(['month', 'year'] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded px-2 py-0.5 ${period === p ? 'bg-paper-3 text-ink' : 'text-ink-3'}`}>{p === 'month' ? 'This month' : '12 months'}</button>)}
          </div>
          <button onClick={() => setEditing((e) => !e)} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${editing ? 'bg-paper-3 text-ink' : 'text-ink-3 hover:text-ink'}`}><SlidersHorizontal size={13} />Split</button>
        </div>
      </header>

      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink-2">Revenue received{split.gstRegistered && s.gst > 0 ? `, less ${nzd(s.gst)} GST` : ''}</span>
        <span className="num text-[24px] font-bold">{nzd(s.net)}</span>
      </div>
      <SplitBar parts={BUCKETS.map((b) => ({ key: b, label: BUCKET_LABEL[b], value: split[b], color: COLOR[b] }))} />

      <table className="mt-3 w-full text-[12.5px]">
        <thead><tr className="text-left">{['', 'Share', 'Suggested', 'Moved', 'Still to move'].map((h) => <th key={h} className="label pb-1.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {BUCKETS.map((b) => {
            const left = s.buckets[b] - (b === 'opex' ? 0 : moved[b])
            return (
              <tr key={b} className="border-t border-rule">
                <td className="py-1.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COLOR[b] }} />{BUCKET_LABEL[b]}{b === 'save' && <span className="text-ink-3"> (incl. car fund)</span>}</td>
                <td className="num text-[14px]">{shareTotal ? Math.round((split[b] / shareTotal) * 100) : 0}%</td>
                <td className="num text-[14px]">{nzd(s.buckets[b])}</td>
                <td className="num text-[14px] text-ink-2">{b === 'opex' ? <span className="text-ink-3">spent as needed</span> : nzd(moved[b])}</td>
                <td className={`num text-[14px] ${b !== 'opex' && left > 0.5 ? 'text-amber-ink' : 'text-ink-3'}`}>{b === 'opex' ? '' : left > 0.5 ? nzd(left) : 'Done'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {editing && (
        <div className="mt-4 border-t border-rule pt-4">
          <div className="grid grid-cols-4 gap-2">
            {BUCKETS.map((b) => (
              <label key={b} className="flex flex-col gap-1">
                <span className="label">{BUCKET_LABEL[b]}</span>
                <span className="flex h-8 items-center rounded-md border border-rule-strong bg-paper-raised px-2 focus-within:border-amber">
                  <input aria-label={`${BUCKET_LABEL[b]} share`} type="number" min={0} max={100} defaultValue={split[b]} onBlur={(e) => { const n = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (n !== split[b]) save({ [b]: n }) }} className="num w-full bg-transparent text-[15px] focus:outline-none" />
                  <span className="text-[12px] text-ink-3">%</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className={shareTotal === 100 ? 'text-ink-3' : 'text-amber-ink'}>Adds to {shareTotal}%{shareTotal !== 100 ? ', so the split is scaled to 100%' : ''}</span>
            <label className="flex items-center gap-1.5 text-ink-2"><input type="checkbox" checked={split.gstRegistered} onChange={(e) => save({ gstRegistered: e.target.checked })} className="accent-[var(--amber)]" />GST registered (take 15% off first)</label>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
            The default follows the usual small-business rule of paying yourself first and parking tax before it is spent: 50% pay, 25% running costs, 15% tax, 10% savings. Your accountant can tell you the right tax share for how you pay yourself.
          </p>
        </div>
      )}

      <form className="mt-4 flex items-end gap-2 border-t border-rule pt-4" onSubmit={(e) => {
        e.preventDefault()
        const amount = Number(move.amount)
        if (!amount || amount <= 0) return
        void api.addMoneyMove({ kind: move.kind, amount, movedAt: move.movedAt, note: null })
        setMove({ ...move, amount: '' })
      }}>
        <label className="flex flex-col gap-1"><span className="label">Log a transfer</span>
          <select aria-label="Transfer kind" value={move.kind} onChange={(e) => setMove({ ...move, kind: e.target.value as MoveKind })} className="h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]">
            {MOVE_KINDS.map((k) => <option key={k} value={k}>{MOVE_LABEL[k]}</option>)}
          </select>
        </label>
        <input aria-label="Amount" type="number" min={0} placeholder="Amount" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} className="num h-8 w-28 rounded-md border border-rule-strong bg-paper-raised px-2 text-[14px] focus:border-amber focus:outline-none" />
        <input aria-label="Date" type="date" value={move.movedAt} onChange={(e) => setMove({ ...move, movedAt: e.target.value })} className="h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]" />
        <button type="submit" className="h-8 rounded-md bg-amber px-3 text-[13px] font-medium text-on-amber hover:bg-amber-hover">Log</button>
      </form>
      {moves.length > 0 && (
        <ul className="mt-3 max-h-36 overflow-y-auto">
          {moves.slice(0, 12).map((m) => (
            <li key={m.id} className="group flex items-center justify-between border-b border-rule py-1 text-[12.5px] last:border-0">
              <span><span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: COLOR[MOVE_BUCKET[m.kind]] }} />{MOVE_LABEL[m.kind]} <span className="text-ink-3">· {new Date(m.movedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span></span>
              <span className="flex items-center gap-2"><span className="num text-[14px]">{nzd(m.amount)}</span><button aria-label="Remove transfer" onClick={() => void api.removeMoneyMove(m.id)} className="text-ink-3 opacity-0 hover:text-ink group-hover:opacity-100"><X size={13} /></button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
