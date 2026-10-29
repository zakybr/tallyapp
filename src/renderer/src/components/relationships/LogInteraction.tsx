import { useEffect, useState } from 'react'
import { Dialog } from '../Dialog'
import { Button, Field, Input, Textarea } from '../ui'
import { api } from '@/lib/api'
import { useToast } from '../Toast'
import { localDate } from '@shared/rules'
import { INTERACTION_KINDS, INTERACTION_LABEL, REL_STAGE_LABEL, TOUCH_KINDS, TOUCH_LABEL, TOUCH_TO_STAGE, type InteractionKind, type Person, type TouchKind } from '@shared/relationships'

export function LogInteraction({ person, open, onClose, defaultTouch }: { person: Person; open: boolean; onClose: () => void; defaultTouch?: TouchKind | null }) {
  const toast = useToast()
  const planned = (defaultTouch ?? person.nextTouchKind ?? '') as TouchKind | ''
  // An in-person meeting is the meeting; anything else defaults to the planned touch.
  const startKind: InteractionKind = planned && planned !== 'meeting' ? 'email' : 'met'
  const blank = () => ({ occurredOn: localDate(), kind: startKind as InteractionKind, touchKind: (startKind === 'met' ? '' : planned) as TouchKind | '', notes: '', toldMe: '', advice: '', promised: '' })
  const [f, setF] = useState(blank)
  useEffect(() => { if (open) setF(blank()) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const sel = 'h-8.5 w-full rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]'
  const save = async () => {
    const touch = f.touchKind || (f.kind === 'met' ? 'meeting' : null)
    const p = await api.logInteraction({
      personId: person.id, occurredOn: f.occurredOn, kind: f.kind, touchKind: (touch || null) as TouchKind | null,
      notes: f.notes || null, toldMe: f.toldMe || null, advice: f.advice || null, promised: f.promised || null
    })
    toast(p.stage !== person.stage ? `${person.name} → ${REL_STAGE_LABEL[p.stage]}` : 'Logged')
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title={`Log: ${person.name}`} width={640}>
      <form className="grid grid-cols-3 gap-3.5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <Field label="Date"><Input type="date" value={f.occurredOn} onChange={set('occurredOn')} /></Field>
        <Field label="How">
          <select aria-label="How" className={sel} value={f.kind} onChange={(e) => { const kind = e.target.value as InteractionKind; setF({ ...f, kind, touchKind: kind === 'met' ? '' : planned }) }}>{INTERACTION_KINDS.map((k) => <option key={k} value={k}>{INTERACTION_LABEL[k]}</option>)}</select>
        </Field>
        <Field label="Which touch" hint={f.touchKind && TOUCH_TO_STAGE[f.touchKind as TouchKind] ? `Moves them to "${REL_STAGE_LABEL[TOUCH_TO_STAGE[f.touchKind as TouchKind]!]}"` : undefined}>
          <select aria-label="Which touch" className={sel} value={f.touchKind} onChange={set('touchKind')}>
            <option value="">{f.kind === 'met' ? 'The visit or call' : 'Just a note'}</option>
            {TOUCH_KINDS.map((k) => <option key={k} value={k}>{TOUCH_LABEL[k].split(':')[0].split(',')[0]}</option>)}
          </select>
        </Field>
        <div className="col-span-3"><Field label="What they told me" hint="Their words, as close as you can."><Textarea rows={2} value={f.toldMe} onChange={set('toldMe')} /></Field></div>
        <div className="col-span-3"><Field label="Advice they gave"><Textarea rows={2} value={f.advice} onChange={set('advice')} /></Field></div>
        <div className="col-span-3"><Field label="What I promised to do" hint="One per line. Each becomes an open promise until you tick it off."><Textarea rows={2} value={f.promised} onChange={set('promised')} /></Field></div>
        <div className="col-span-3"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
        <div className="col-span-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Log it</Button>
        </div>
      </form>
    </Dialog>
  )
}
