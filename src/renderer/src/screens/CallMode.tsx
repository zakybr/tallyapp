import { useEffect, useRef, useState } from 'react'
import { X, Phone, PhoneOff, CalendarClock, CalendarCheck, ThumbsDown } from 'lucide-react'
import { api, useData, domainOf } from '@/lib/api'
import { ipcMessage } from '@/lib/jobs'
import { navigate } from '@/lib/router'
import { useToast } from '@/components/Toast'
import { TallyLoader, TallyMark } from '@/components/Tally'
import { VerdictBadge } from '@/components/ui'
import { splitScript } from '@shared/drafts'
import { CALL_OUTCOME_LABEL, GAP_LABEL, type CallOutcome } from '@shared/domain'

const OUTCOMES: { key: CallOutcome; icon: typeof Phone; tone: string }[] = [
  { key: 'no_answer', icon: PhoneOff, tone: 'border-chrome-line text-chrome-ink-2 hover:bg-chrome-3' },
  { key: 'callback', icon: CalendarClock, tone: 'border-chrome-line text-chrome-ink hover:bg-chrome-3' },
  { key: 'meeting_booked', icon: CalendarCheck, tone: 'border-amber bg-amber text-on-amber hover:bg-amber-hover' },
  { key: 'not_interested', icon: ThumbsDown, tone: 'border-chrome-line text-[#ef7a62] hover:bg-chrome-3' }
]

const draftKey = (id: number) => `call-notes-${id}`
const readDraft = (id: number) => { try { return sessionStorage.getItem(draftKey(id)) ?? '' } catch { return '' } }
const writeDraft = (id: number, v: string) => { try { if (v) sessionStorage.setItem(draftKey(id), v); else sessionStorage.removeItem(draftKey(id)) } catch { /* private storage */ } }

/*
  A focused view for one call: opener and script on the left, the facts and
  a notes box on the right, outcomes along the bottom. Closing hands any
  notes to the Debrief Agent. Nothing is dialled or sent by the app.
*/
export function CallMode({ id }: { id: number }) {
  const toast = useToast()
  const { data: d } = useData(() => api.getCompany(id), [id])
  const [notes, setNotes] = useState(() => readDraft(id))
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const closing = useRef(false)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => writeDraft(id, notes), [id, notes])

  const finish = async (outcome: CallOutcome | null) => {
    if (closing.current) return
    closing.current = true
    setBusy(true)
    try {
      const job = await api.logCall(id, outcome, notes)
      writeDraft(id, '')
      toast(job ? 'Notes sent to the Debrief Agent' : outcome ? `Logged: ${CALL_OUTCOME_LABEL[outcome]}` : 'Closed')
      navigate({ name: 'prospect', id })
    } catch (e) {
      toast(ipcMessage(e), 'error')
      closing.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    // Esc inside the notes only leaves the box (it also dismisses autocorrect); Esc again closes.
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || e.isComposing) return
      e.preventDefault()
      const el = document.activeElement
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) { el.blur(); return }
      void finish(null)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  if (!d) return <div className="flex h-full items-center justify-center bg-chrome"><TallyLoader label="Loading" /></div>
  const c = d.company
  const opener = d.outreach.filter((o) => o.kind === 'opener').sort((a, b) => b.id - a.id)[0]
  const script = d.outreach.filter((o) => o.kind === 'call_script').sort((a, b) => b.id - a.id)[0]
  const parts = script ? splitScript(script.body) : []
  const gaps = d.research.filter((r) => r.gapType && r.verified).slice(0, 5)
  const strengths = d.research.filter((r) => !r.gapType && r.verified && ['google_profile', 'pricing', 'social', 'companies_office'].includes(r.category)).slice(0, 4)
  const secs = Math.floor((now - started) / 1000)
  const phone = c.phone ?? d.contacts.find((x) => x.phone)?.phone

  return (
    <div className="flex h-full flex-col bg-chrome text-chrome-ink">
      <header className="drag flex h-[64px] shrink-0 items-center gap-5 border-b border-chrome-line pl-24 pr-5">
        <TallyMark size={18} className="text-chrome-ink-2" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5"><h1 className="display truncate text-[26px]">{c.name}</h1><VerdictBadge verdict={c.verdict} /></div>
          <div className="text-[12px] text-chrome-ink-3">{[d.contacts.find((x) => x.name)?.name, c.area, domainOf(c.website)].filter(Boolean).join(' · ')}</div>
        </div>
        {phone && <a href={`tel:${phone}`} className="no-drag ml-4 flex items-center gap-2 rounded-md bg-chrome-3 px-3 py-1.5 font-display text-[22px] font-bold tabular-nums tracking-wide hover:text-amber"><Phone size={16} />{phone}</a>}
        <div className="num ml-auto text-[22px] text-chrome-ink-2" aria-label="Call timer">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</div>
        <button onClick={() => void finish(null)} className="no-drag flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-chrome-ink-2 hover:bg-chrome-3 hover:text-chrome-ink" aria-label="Close call mode"><X size={15} />Close <span className="font-mono text-[10.5px] text-chrome-ink-3">esc esc</span></button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)] gap-2 p-2">
        <section className="scroll-quiet min-h-0 overflow-y-auto rounded-[10px] bg-paper px-9 py-7 text-ink">
          <div className="label mb-2 text-amber-ink">Open with</div>
          <p className="selectable mb-8 border-l-[3px] border-amber pl-4 text-[23px] font-medium leading-snug">{opener?.body ?? <span className="text-ink-3">No opener yet. Prepare drafts on the prospect page.</span>}</p>
          {parts.length ? (
            <ol className="flex flex-col gap-5">
              {parts.filter((p) => !/^Observation$/i.test(p.title)).map((p, i) => (
                <li key={i} className="grid grid-cols-[28px_1fr] gap-x-2">
                  <span className="num pt-0.5 text-[20px] text-amber">{i + 2}</span>
                  <div>
                    <div className="display mb-1 text-[17px]">{p.title}</div>
                    <p className="selectable whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : script ? <p className="selectable whitespace-pre-wrap text-[14.5px]">{script.body}</p> : <p className="text-ink-3">No call script yet.</p>}
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <div className="scroll-quiet max-h-[52%] overflow-y-auto rounded-[10px] bg-paper px-6 py-5 text-ink">
            {d.score?.firstCallQuestion && (
              <div className="mb-4 rounded-md bg-amber-wash px-3 py-2.5">
                <div className="label mb-0.5 text-amber-ink">Ask before you hang up</div>
                <div className="selectable text-[14px] font-medium">{d.score.firstCallQuestion}</div>
              </div>
            )}
            {c.verdictReason && <p className="selectable mb-4 text-[13.5px]">{c.verdictReason}</p>}
            {gaps.length > 0 && <>
              <div className="label mb-1.5">Verified gaps</div>
              <ul className="mb-4 flex flex-col gap-1.5">{gaps.map((g) => <li key={g.id} className="selectable text-[13px] leading-snug"><span className="font-semibold">{GAP_LABEL[g.gapType!]}.</span> {g.finding}</li>)}</ul>
            </>}
            {strengths.length > 0 && <>
              <div className="label mb-1.5">Worth mentioning</div>
              <ul className="flex flex-col gap-1">{strengths.map((g) => <li key={g.id} className="selectable text-[13px] leading-snug text-ink-2">{g.finding}</li>)}</ul>
            </>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-[10px] bg-paper p-4 text-ink">
            <label htmlFor="call-notes" className="label mb-2">Notes · go to the Debrief Agent when you close</label>
            <textarea id="call-notes" autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you spoke to, what they said, what happens next…" className="min-h-0 flex-1 resize-none rounded-md border border-rule bg-paper-raised p-3 text-[14px] leading-relaxed focus:border-amber focus:outline-none" />
          </div>
        </section>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-chrome-line px-5 py-3">
        <span className="label mr-2 text-chrome-ink-3">Outcome</span>
        {OUTCOMES.map(({ key, icon: Icon, tone }) => (
          <button key={key} disabled={busy} onClick={() => void finish(key)} className={`flex h-10 items-center gap-2 rounded-md border px-4 text-[14px] font-medium transition-colors disabled:opacity-50 ${tone}`}>
            <Icon size={16} />{CALL_OUTCOME_LABEL[key]}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-chrome-ink-3">Tally never dials or sends. You do.</span>
      </footer>
    </div>
  )
}
