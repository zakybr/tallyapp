import { useEffect, useMemo, useState } from 'react'
import { Copy, Mail, Check } from 'lucide-react'
import { Button, Input, Textarea } from '../ui'
import { api } from '@/lib/api'
import { useToast } from '../Toast'
import { mailtoHref } from '@shared/drafts'
import { TOUCH_LABEL, lintRelationship, type Person, type RelDraft } from '@shared/relationships'

/* An editable draft with the writing rules checked as you type. Sending is always Zak's. */
export function DraftCard({ draft, person }: { draft: RelDraft; person: Person }) {
  const toast = useToast()
  const [subject, setSubject] = useState(draft.subject ?? '')
  const [body, setBody] = useState(draft.body)
  useEffect(() => { setSubject(draft.subject ?? ''); setBody(draft.body) }, [draft.id, draft.subject, draft.body])
  const issues = useMemo(() => lintRelationship(draft.channel === 'email' ? subject : null, body, { channel: draft.channel, touchKind: draft.touchKind }), [subject, body, draft.channel, draft.touchKind])
  const save = () => { if (subject !== (draft.subject ?? '') || body !== draft.body) void api.updateRelDraft(draft.id, { subject: draft.channel === 'email' ? subject : null, body }) }
  const sent = !!draft.sentByMeAt
  return (
    <article className={`rounded-md border bg-paper-raised p-4 ${sent ? 'border-rule opacity-70' : 'border-rule-strong'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="label">{TOUCH_LABEL[draft.touchKind].split(':')[0].split(',')[0]} · {draft.channel}{draft.overrodePitchGate ? ' · pitch gate overridden' : ''}</div>
        {sent && <span className="text-[12px] text-go">Sent by you {new Date(draft.sentByMeAt!).toLocaleDateString('en-NZ')}</span>}
      </div>
      {draft.channel === 'email' && <Input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={save} className="mb-2 font-semibold" disabled={sent} />}
      <Textarea aria-label="Message" rows={Math.min(16, body.split('\n').length + 2)} value={body} onChange={(e) => setBody(e.target.value)} onBlur={save} disabled={sent} className="font-sans" />
      {!sent && (issues.length ? (
        <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-conv">{issues.map((i) => <li key={i}>· {i}</li>)}</ul>
      ) : <div className="mt-2 text-[12px] text-go">Passes the writing rules.</div>)}
      {!sent && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(draft.channel === 'email' ? `${subject}\n\n${body}` : body); toast('Copied') }}><Copy size={13} />Copy</Button>
          {draft.channel === 'email' && <Button size="sm" disabled={!person.email} title={person.email ? undefined : 'No email on file'} onClick={() => window.open(mailtoHref(person.email, subject, body))}><Mail size={13} />Open in Mail</Button>}
          <Button size="sm" variant="primary" onClick={async () => { save(); const p = await api.markRelDraftSent(draft.id); toast(`Logged as sent. Next: ${p.nextTouchOn ?? 'nothing scheduled'}`) }}><Check size={13} />I sent this</Button>
        </div>
      )}
    </article>
  )
}
