import { useState } from 'react'
import { ArrowLeft, PenLine, NotebookPen, Trash2, FileDown, ExternalLink } from 'lucide-react'
import { api, useData, shortDate } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import { Button, Section } from '@/components/ui'
import { InlineField } from '@/components/InlineField'
import { TallyLoader } from '@/components/Tally'
import { useToast } from '@/components/Toast'
import { LogInteraction } from '@/components/relationships/LogInteraction'
import { DraftTouch } from '@/components/relationships/DraftTouch'
import { DraftCard } from '@/components/relationships/DraftCard'
import { useJobs } from '@/lib/jobs'
import { RunLog } from '@/components/RunLog'
import { localDate } from '@shared/rules'
import { DEFAULT_CADENCE, INTERACTION_LABEL, REL_STAGES, REL_STAGE_LABEL, TOUCH_KINDS, TOUCH_LABEL, type Cadence, type PersonPatch, type RelStage, type TouchKind } from '@shared/relationships'

const CADENCE_FIELDS: [keyof Cadence, string][] = [['thankYou', 'Thank-you'], ['acted', 'Acted on advice'], ['value', 'Value touch'], ['invite', 'Invite to share'], ['followUp', 'Follow-up gap'], ['checkIn', 'Check-in gap']]

export function PersonPage({ id }: { id: number }) {
  const toast = useToast()
  const { data: d } = useData(() => api.personDetail(id), [id])
  const job = useJobs().find((j) => j.kind === 'relationship_touch' && j.status === 'running' && j.title.endsWith(`: ${d?.person.name ?? '\u0000'}`))
  const [logging, setLogging] = useState(false)
  const [drafting, setDrafting] = useState(false)
  if (d === undefined) return <div className="p-10"><TallyLoader label="Loading" /></div>
  if (d === null) return <div className="p-10 text-ink-3">This person is no longer in Tally.</div>
  const p = d.person
  const save = (patch: PersonPatch) => api.updatePerson(id, patch)
  const open = d.promises.filter((x) => !x.doneAt)
  const done = d.promises.filter((x) => x.doneAt)
  const unsent = d.drafts.filter((x) => !x.sentByMeAt)
  const late = p.nextTouchOn && p.nextTouchOn <= localDate()

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule px-8 pb-5 pt-6">
        <button onClick={() => navigate({ name: 'relationships' })} className="mb-3 flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={14} />Relationships</button>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="display truncate text-[40px] text-ink">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              {[p.role, p.companyName].filter(Boolean).join(', ')}
              {p.companyId && <a href={href({ name: 'prospect', id: p.companyId })} className="text-amber-ink hover:underline">Company page</a>}
              {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-ink hover:underline">LinkedIn<ExternalLink size={11} /></a>}
            </div>
            <div className="mt-3 text-[13.5px]">
              <span className="label mr-2">Next</span>
              {p.nextTouchKind ? <><span className="font-semibold">{TOUCH_LABEL[p.nextTouchKind]}</span> <span className={late ? 'text-danger' : 'text-ink-2'}>· {shortDate(p.nextTouchOn)}{late ? ' (due)' : ''}</span></> : <span className="text-ink-3">Nothing planned</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select aria-label="Stage" value={p.stage} onChange={(e) => void save({ stage: e.target.value as RelStage })} className="h-8.5 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px] font-medium">
              {REL_STAGES.map((s) => <option key={s} value={s}>{REL_STAGE_LABEL[s]}</option>)}
            </select>
            <Button onClick={() => setLogging(true)}><NotebookPen size={14} />Log interaction</Button>
            <Button variant="primary" onClick={() => setDrafting(true)}><PenLine size={14} />Draft next touch</Button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_330px] gap-8 px-8 py-6">
        <div className="flex min-w-0 flex-col gap-8">
          {job && <section><TallyLoader label={job.title} /><RunLog jobId={job.id} className="mt-2 h-40" /></section>}
          {unsent.length > 0 && <Section title="Draft">{unsent.slice(0, 1).map((x) => <DraftCard key={x.id} draft={x} person={p} />)}</Section>}
          <Section title="Open promises" aside={<span className="text-[12px] text-ink-3">{open.length} open · {done.length} kept</span>}>
            {open.length === 0 ? <p className="text-[13px] text-ink-3">Nothing outstanding.</p> : (
              <ul className="flex flex-col gap-1.5">
                {open.map((x) => (
                  <li key={x.id} className="flex items-start gap-2 text-[13.5px]">
                    <input type="checkbox" aria-label={`Done: ${x.text}`} className="mt-1 accent-[var(--amber)]" onChange={() => void api.setPromiseDone(x.id, true)} />
                    <span>{x.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Timeline">
            {d.interactions.length === 0 ? <p className="text-[13px] text-ink-3">No interactions yet. Log the first contact once it's sent.</p> : (
              <ol className="relative ml-1.5 border-l border-rule">
                {d.interactions.map((i) => (
                  <li key={i.id} className="mb-5 ml-5">
                    <span className={`absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full ${i.kind === 'met' ? 'bg-amber' : 'bg-rule-strong'}`} />
                    <div className="text-[12px] text-ink-3">{shortDate(i.occurredOn)} · {INTERACTION_LABEL[i.kind]}{i.touchKind ? ` · ${TOUCH_LABEL[i.touchKind].split(':')[0].split(',')[0]}` : ''}</div>
                    {i.notes && <div className="selectable text-[13.5px]">{i.notes}</div>}
                    <dl className="selectable mt-1 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]">
                      {i.toldMe && <><dt className="text-ink-3">They told me</dt><dd>“{i.toldMe}”</dd></>}
                      {i.advice && <><dt className="text-ink-3">Their advice</dt><dd>{i.advice}</dd></>}
                      {i.promised && <><dt className="text-ink-3">I promised</dt><dd className="whitespace-pre-line">{i.promised}</dd></>}
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </Section>
          {d.drafts.filter((x) => x.sentByMeAt).length > 0 && (
            <Section title="Sent">{d.drafts.filter((x) => x.sentByMeAt).map((x) => <div key={x.id} className="mb-2"><DraftCard draft={x} person={p} /></div>)}</Section>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Section title="Next touch">
            <div className="flex flex-col gap-1.5">
              <select aria-label="Next touch" value={p.nextTouchKind ?? ''} onChange={(e) => void save({ nextTouchKind: (e.target.value || null) as TouchKind | null })} className="h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[12.5px]">
                <option value="">Nothing planned</option>
                {TOUCH_KINDS.map((k) => <option key={k} value={k}>{TOUCH_LABEL[k].split(':')[0].split(',')[0]}</option>)}
              </select>
              <InlineField type="date" value={p.nextTouchOn} onSave={(v) => save({ nextTouchOn: v })} />
              {p.nextTouchManual && <span className="text-[11.5px] text-ink-3">Set by you. The cadence takes over again at the next logged touch.</span>}
            </div>
          </Section>
          <Section title="Facts">
            <dl className="grid grid-cols-[92px_1fr] items-center gap-x-2 gap-y-0.5 text-[12.5px]">
              {([['Name', 'name'], ['Role', 'role'], ['Email', 'email'], ['Email found at', 'emailSourceUrl'], ['Phone', 'phone'], ['LinkedIn', 'linkedinUrl'], ['How we met', 'howMet'], ['Introduced by', 'introducedBy']] as const).map(([label, key]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-3">{label}</dt>
                  <dd><InlineField value={p[key]} onSave={(v) => save({ [key]: key === 'name' ? v ?? p.name : v })} /></dd>
                </div>
              ))}
              <dt className="text-ink-3">Tags</dt>
              <dd><InlineField value={p.tags.join(', ')} placeholder="marine, Hibiscus Coast" onSave={(v) => save({ tags: (v ?? '').split(',').map((t) => t.trim()).filter(Boolean) })} /></dd>
            </dl>
          </Section>
          <Section title="Interests"><InlineField multiline value={p.interests} placeholder="Things they mentioned outside work" onSave={(v) => save({ interests: v })} /></Section>
          <Section title="Cadence" aside={<span className="text-[11.5px] text-ink-3">days after meeting</span>}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {CADENCE_FIELDS.map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-ink-2">{label}</span>
                  <input type="number" min={0} value={p.cadence[k]} onChange={(e) => void save({ cadence: { ...p.cadence, [k]: Math.max(0, Number(e.target.value) || 0) } })}
                    className="num h-7 w-14 rounded border border-rule-strong bg-paper-raised px-1.5 text-right text-[13px]" />
                </label>
              ))}
            </div>
            <button className="mt-2 text-[11.5px] text-ink-3 hover:text-ink" onClick={() => void save({ cadence: DEFAULT_CADENCE })}>Reset to 0 / 7 / 18 / 28</button>
          </Section>
          <div className="flex flex-col items-start gap-2 border-t border-rule pt-4">
            <button onClick={async () => { const r = await api.exportPersonData(id); if (r) { toast('Saved. Send them this file.'); void api.revealPath(r.file) } }} className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink"><FileDown size={13} />Export their data</button>
            <button onClick={async () => { if (window.confirm(`Delete ${p.name} and everything recorded about them? This cannot be undone.`)) { await api.erasePerson(id); navigate({ name: 'relationships', tab: 'people' }) } }} className="flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-danger"><Trash2 size={13} />Delete person</button>
          </div>
        </aside>
      </div>
      <LogInteraction person={p} open={logging} onClose={() => setLogging(false)} />
      <DraftTouch person={p} open={drafting} onClose={() => setDrafting(false)} />
    </div>
  )
}
