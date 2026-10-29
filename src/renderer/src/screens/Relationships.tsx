import { useMemo, useState } from 'react'
import { Plus, PenLine, NotebookPen } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { EmptyState, TallyCount } from '@/components/Tally'
import { AddPerson } from '@/components/relationships/AddPerson'
import { LogInteraction } from '@/components/relationships/LogInteraction'
import { DraftTouch } from '@/components/relationships/DraftTouch'
import { useToast } from '@/components/Toast'
import { api, useData, shortDate } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import { localDate } from '@shared/rules'
import { CLOSED_STAGES, REL_STAGES, REL_STAGE_LABEL, TOUCH_LABEL, daysBetween, type DueItem, type Person, type RelStage } from '@shared/relationships'

type Tab = 'due' | 'board' | 'people'
const sinceTouch = (p: Person) => (p.lastTouchOn ? daysBetween(p.lastTouchOn, localDate()) : null)
const touchShort = (p: Person) => (p.nextTouchKind ? TOUCH_LABEL[p.nextTouchKind].split(':')[0].split(',')[0] : 'Nothing planned')

export function Relationships({ tab = 'due' }: { tab?: Tab }) {
  const { data: people } = useData(() => api.listPeople())
  const { data: due } = useData(() => api.relationshipsDue())
  const [adding, setAdding] = useState(false)
  const tabs: [Tab, string][] = [['due', `Due${due?.length ? ` · ${due.length}` : ''}`], ['board', 'Board'], ['people', 'People']]
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        eyebrow="Advice first. The pitch comes about a month in."
        title="Relationships"
        actions={<>
          <div className="flex rounded-md border border-rule-strong p-0.5">
            {tabs.map(([t, label]) => (
              <a key={t} href={href({ name: 'relationships', tab: t })} className={`flex h-7 items-center rounded px-3 text-[12.5px] ${tab === t ? 'bg-paper-3 text-ink' : 'text-ink-3 hover:text-ink'}`}>{label}</a>
            ))}
          </div>
          <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} />Add person</Button>
        </>}
      />
      {people && people.length === 0 ? (
        <EmptyState title="No one yet" body="Add the first director you'd like advice from." action={<Button variant="primary" onClick={() => setAdding(true)}>Add person</Button>} />
      ) : tab === 'due' ? <DueList items={due ?? []} /> : tab === 'board' ? <Board people={people ?? []} /> : <PeopleTable people={people ?? []} />}
      <AddPerson open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function DueList({ items }: { items: DueItem[] }) {
  const [log, setLog] = useState<Person | null>(null)
  const [draft, setDraft] = useState<Person | null>(null)
  if (!items.length) return <EmptyState title="Nothing due" body="Every touch is up to date. The next ones show here on the day they're due." />
  return (
    <div className="flex flex-col gap-3 px-8 py-6">
      {items.map(({ person: p, overdueDays, lastInteraction: li, openPromises }) => (
        <article key={p.id} className="rise grid grid-cols-[minmax(0,1fr)_auto] gap-5 rounded-md border border-rule bg-paper-raised p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <a href={href({ name: 'person', id: p.id })} className="display text-[22px] text-ink hover:text-amber-ink">{p.name}</a>
              <span className="text-[13px] text-ink-2">{[p.role, p.companyName].filter(Boolean).join(', ')}</span>
              <span className="label">{REL_STAGE_LABEL[p.stage]}</span>
            </div>
            <div className="mt-1 text-[13.5px]">
              <span className="font-semibold">{p.nextTouchKind ? TOUCH_LABEL[p.nextTouchKind] : 'Touch'}</span>
              <span className={`ml-2 text-[12.5px] ${overdueDays > 0 ? 'text-danger' : 'text-amber-ink'}`}>{overdueDays > 0 ? `${overdueDays} day${overdueDays === 1 ? '' : 's'} late` : 'due today'}</span>
            </div>
            {li && (
              <dl className="selectable mt-3 grid grid-cols-[132px_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-rule pt-3 text-[12.5px]">
                <dt className="text-ink-3">{shortDate(li.occurredOn)}</dt><dd className="text-ink-2">{li.notes ?? '—'}</dd>
                {li.toldMe && <><dt className="text-ink-3">They told me</dt><dd>“{li.toldMe}”</dd></>}
                {li.advice && <><dt className="text-ink-3">Their advice</dt><dd>{li.advice}</dd></>}
              </dl>
            )}
            {openPromises.length > 0 && (
              <div className="mt-2 text-[12.5px]"><span className="text-ink-3">You promised: </span>{openPromises.map((x) => x.text).join(' · ')}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button variant="primary" size="sm" onClick={() => setDraft(p)}><PenLine size={13} />Draft</Button>
            <Button size="sm" onClick={() => setLog(p)}><NotebookPen size={13} />Log it</Button>
          </div>
        </article>
      ))}
      {log && <LogInteraction person={log} open onClose={() => setLog(null)} />}
      {draft && <DraftTouch person={draft} open onClose={() => setDraft(null)} onDrafted={() => navigate({ name: 'person', id: draft.id })} />}
    </div>
  )
}

function Board({ people }: { people: Person[] }) {
  const toast = useToast()
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<RelStage | null>(null)
  const drop = async (stage: RelStage) => {
    const p = people.find((x) => x.id === dragId)
    setDragId(null); setOver(null)
    if (!p || p.stage === stage) return
    await api.updatePerson(p.id, { stage })
    toast(`${p.name} → ${REL_STAGE_LABEL[stage]}`)
  }
  return (
    <div className="scroll-quiet flex flex-1 gap-3 overflow-x-auto px-8 py-5">
      {REL_STAGES.map((stage) => {
        const cards = people.filter((p) => p.stage === stage)
        const closed = CLOSED_STAGES.includes(stage)
        return (
          <div key={stage} onDragOver={(e) => { e.preventDefault(); setOver(stage) }} onDragLeave={() => setOver((o) => (o === stage ? null : o))} onDrop={() => void drop(stage)}
            className={`flex shrink-0 flex-col rounded-lg transition-colors ${closed ? 'w-[190px]' : 'w-[220px]'} ${over === stage ? 'bg-amber-wash ring-1 ring-amber' : 'bg-paper-2/60'}`}>
            <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
              <span className="label leading-snug">{REL_STAGE_LABEL[stage]}</span>
              <span className="flex items-center gap-1.5 text-ink-3"><TallyCount n={cards.length} size={11} max={10} /></span>
            </div>
            <div className="flex flex-col gap-2 px-2 pb-3">
              {cards.map((p) => {
                const since = sinceTouch(p)
                const late = p.nextTouchOn && p.nextTouchOn <= localDate()
                return (
                  <article key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => { setDragId(null); setOver(null) }} onClick={() => navigate({ name: 'person', id: p.id })}
                    className={`cursor-pointer rounded-md border bg-paper-raised p-2.5 hover:border-rule-strong ${late ? 'border-amber/70' : 'border-rule'} ${dragId === p.id ? 'opacity-40' : ''}`}>
                    <div className="text-[13.5px] font-semibold leading-snug">{p.name}</div>
                    <div className="truncate text-[12px] text-ink-3">{p.companyName ?? p.role ?? ''}</div>
                    <div className="mt-1.5 flex justify-between text-[11.5px]">
                      <span className="tabular-nums text-ink-2">{since === null ? 'No touch yet' : since === 0 ? 'Touched today' : `${since}d since touch`}</span>
                      {late && <span className="text-amber-ink">due</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PeopleTable({ people }: { people: Person[] }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => people.filter((p) => `${p.name} ${p.companyName ?? ''} ${p.role ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())), [people, q])
  return (
    <div className="px-8 py-4">
      <input className="mb-3 h-8 w-72 rounded-md border border-rule-strong bg-paper-raised px-2.5 text-[13px]" placeholder="Search people, companies, tags" value={q} onChange={(e) => setQ(e.target.value)} />
      <table className="w-full border-collapse text-left text-[13px]">
        <thead><tr className="border-b border-rule-strong">{['Person', 'Company', 'Stage', 'Last touch', 'Next touch', 'Tags'].map((h) => <th key={h} className="label py-2 pr-4">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => navigate({ name: 'person', id: p.id })} className="cursor-pointer border-b border-rule hover:bg-paper-2">
              <td className="py-2 pr-4"><div className="font-semibold">{p.name}</div><div className="text-[11.5px] text-ink-3">{p.role}</div></td>
              <td className="py-2 pr-4 text-ink-2">{p.companyName}</td>
              <td className="py-2 pr-4 text-ink-2">{REL_STAGE_LABEL[p.stage]}</td>
              <td className="py-2 pr-4 tabular-nums text-ink-2">{p.lastTouchOn ? shortDate(p.lastTouchOn) : '—'}</td>
              <td className="py-2 pr-4 text-ink-2">{p.nextTouchOn ? <><span className={p.nextTouchOn <= localDate() ? 'text-amber-ink' : ''}>{shortDate(p.nextTouchOn)}</span> · {touchShort(p)}</> : '—'}</td>
              <td className="py-2 pr-4 text-[12px] text-ink-3">{p.tags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
