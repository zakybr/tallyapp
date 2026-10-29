import { useEffect, useState } from 'react'
import { Dialog } from '../Dialog'
import { Button, Field, Textarea } from '../ui'
import { api } from '@/lib/api'
import { useToast } from '../Toast'
import { TOUCH_KINDS, TOUCH_LABEL, pitchAllowed, type DraftChannel, type Person, type TouchKind } from '@shared/relationships'

const CONTEXT_HINT: Partial<Record<TouchKind, string>> = {
  acted_on_advice: 'What did you actually do with their advice? The draft reports this, so be specific.',
  value_touch: 'Anything useful you found for them (an article, an introduction, an observation)?',
  pitch: 'The one idea for their business you want to lead with.'
}

/* Starts the drafter. A pitch before "Invited to share" is refused by main; Zak can override once. */
export function DraftTouch({ person, open, onClose, onDrafted }: { person: Person; open: boolean; onClose: () => void; onDrafted?: () => void }) {
  const toast = useToast()
  const [touch, setTouch] = useState<TouchKind>(person.nextTouchKind ?? 'check_in')
  const [channel, setChannel] = useState<DraftChannel>('email')
  const [context, setContext] = useState('')
  useEffect(() => { if (open) { setTouch(person.nextTouchKind ?? 'check_in'); setContext('') } }, [open, person.nextTouchKind])
  const sel = 'h-8.5 w-full rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]'
  const start = async (overridePitch = false) => {
    try {
      await api.startJob('relationship_touch', { personId: person.id, touchKind: touch, channel, context, overridePitch })
      toast('Drafting. It appears on their page in a few seconds.')
      onClose()
      onDrafted?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const gate = msg.match(/PITCH_GATE: (.*)$/)
      if (gate) {
        if (window.confirm(`${gate[1]}\n\nDraft the pitch anyway? This is noted on their timeline and you won't be asked again for ${person.name}.`)) void start(true)
      } else toast(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error')
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title={`Draft for ${person.name}`} width={560}>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Touch">
          <select aria-label="Touch" className={sel} value={touch} onChange={(e) => setTouch(e.target.value as TouchKind)}>
            {TOUCH_KINDS.filter((k) => k !== 'meeting').map((k) => <option key={k} value={k}>{TOUCH_LABEL[k].split(':')[0].split(',')[0]}{k === 'pitch' && !pitchAllowed(person.stage) ? ' (too early)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Channel">
          <select aria-label="Channel" className={sel} value={channel} onChange={(e) => setChannel(e.target.value as DraftChannel)}>
            <option value="email">Email</option><option value="text">Text</option><option value="linkedin">LinkedIn message</option>
          </select>
        </Field>
        <p className="col-span-2 text-[12.5px] text-ink-3">{TOUCH_LABEL[touch]}. Built only from your notes on {person.name.split(' ')[0]}. Nothing is sent: you copy it or open it in Mail.</p>
        <div className="col-span-2"><Field label="Your context (optional)" hint={CONTEXT_HINT[touch]}><Textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} /></Field></div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void start()}>Draft it</Button>
        </div>
      </div>
    </Dialog>
  )
}
