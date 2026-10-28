import { useEffect, useMemo, useState } from 'react'
import { Copy, Mail, RefreshCw, FileText, FolderOpen, Phone, Check, ShieldAlert, Ban, Wand2, NotebookPen } from 'lucide-react'
import { api, ago, shortDate } from '@/lib/api'
import { ipcMessage, runJob } from '@/lib/jobs'
import { navigate } from '@/lib/router'
import { Button, Section, Textarea, Input } from '../ui'
import { useToast } from '../Toast'
import { useCompanyJob } from './AgentActions'
import { OUTREACH_LABEL, STAGE_LABEL, type CompanyDetail, type Contact, type JobKind, type Outreach, type OutreachKind, type Suppression } from '@shared/domain'
import { checkEmailContact, lintEmail, wordCount, OPT_OUT_LINE } from '@shared/rules'
import { companySuppressed, mailtoHref } from '@shared/drafts'

const latest = (o: Outreach[], kind: OutreachKind) => o.filter((x) => x.kind === kind).sort((a, b) => b.id - a.id)[0]

function useCopy() {
  const toast = useToast()
  return (text: string, what = 'Copied') => { void navigator.clipboard.writeText(text).then(() => toast(what)) }
}

/* Regenerate button for one draft kind. Disabled while any job runs on this company. */
function Redo({ companyId, kind, has, label }: { companyId: number; kind: JobKind; has: boolean; label: string }) {
  const toast = useToast()
  const busy = !!useCompanyJob(companyId)
  return (
    <button disabled={busy} onClick={() => void runJob(kind, { companyId }, toast)} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink disabled:opacity-40">
      {has ? <RefreshCw size={12} /> : <Wand2 size={12} />}{has ? 'Redo' : label}
    </button>
  )
}

/* Editable draft text: saves on blur. Sent drafts are read-only. */
function DraftBody({ o, rows = 6, className = '' }: { o: Outreach; rows?: number; className?: string }) {
  const [v, setV] = useState(o.body)
  useEffect(() => setV(o.body), [o.body])
  return (
    <Textarea
      rows={rows} value={v} readOnly={!!o.sentAt} aria-label={`${OUTREACH_LABEL[o.kind]} text`}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== o.body && void api.updateOutreach(o.id, { body: v })}
      className={`${className} ${o.sentAt ? 'opacity-70' : ''}`}
    />
  )
}

export function PrepareSections({ d, suppression }: { d: CompanyDetail; suppression: Suppression[] }) {
  const toast = useToast()
  const id = d.company.id
  const running = useCompanyJob(id)
  const hasResearch = d.research.length > 0
  const opener = latest(d.outreach, 'opener')
  const script = latest(d.outreach, 'call_script')
  const audit = latest(d.outreach, 'audit_pdf')
  const anyDraft = !!(opener || script || audit || d.outreach.some((o) => o.kind.startsWith('email')))
  const copy = useCopy()

  const prepareAll = () => {
    const passed = d.company.verdict === 'pass'
    if (passed && !window.confirm(`${d.company.name} was scored Pass. Prepare drafts anyway?`)) return
    void runJob('prepare', { companyId: id, force: passed }, toast)
  }

  if (!hasResearch) return null

  return (
    <>
      <Section
        title="Prepare"
        aside={
          <Button size="sm" variant={anyDraft ? 'secondary' : 'primary'} disabled={!!running} onClick={prepareAll}>
            <Wand2 size={13} />{anyDraft ? 'Redo all drafts' : 'Prepare opener, script, emails and audit'}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label">Opener</span>
              <span className="flex items-center gap-3">
                {opener && <button onClick={() => copy(opener.body)} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"><Copy size={12} />Copy</button>}
                <Redo companyId={id} kind="opener" has={!!opener} label="Write opener" />
              </span>
            </div>
            {opener ? <DraftBody o={opener} rows={2} className="!text-[16px] !leading-snug font-medium" /> : <p className="text-[12.5px] text-ink-3">One sentence from one verified observation. Nothing yet.</p>}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label">Call script</span>
              <span className="flex items-center gap-3">
                {script && <button onClick={() => copy(script.body)} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"><Copy size={12} />Copy</button>}
                <Redo companyId={id} kind="call_script" has={!!script} label="Write script" />
                <Button size="sm" variant="primary" onClick={() => navigate({ name: 'call', id })}><Phone size={13} />Call mode</Button>
              </span>
            </div>
            {script ? <DraftBody o={script} rows={14} className="font-[450]" /> : <p className="text-[12.5px] text-ink-3">Observation, what I do, the meeting ask, the free audit, objections and the $2.5k question. Nothing yet.</p>}
          </div>
        </div>
      </Section>

      <Emails d={d} suppression={suppression} />
      <Audit companyId={id} audit={audit} />
      <Debriefs d={d} />
    </>
  )
}

function Emails({ d, suppression }: { d: CompanyDetail; suppression: Suppression[] }) {
  const id = d.company.id
  const emails = (['email_1', 'email_2', 'email_3', 'follow_up'] as const).map((k) => latest(d.outreach, k)).filter((o): o is Outreach => !!o)
  const withEmail = d.contacts.filter((c) => c.email)
  const blockedCompany = companySuppressed(d.contacts, d.company.website, suppression, d.activities.some((a) => a.kind === 'opt_out'))
  const toId = emails.find((e) => !e.sentAt)?.contactId ?? null
  const to = withEmail.find((c) => c.id === toId) ?? null
  const check = useMemo(() => checkEmailContact(to, suppression), [to, suppression])

  const setTo = async (contactId: number | null) => { for (const e of emails) if (!e.sentAt) await api.updateOutreach(e.id, { contactId }) }

  return (
    <Section title="Emails" aside={<span className="flex items-center gap-3"><span className="text-[12px] text-ink-3">Backup channel. You send them yourself.</span>{!blockedCompany && <Redo companyId={id} kind="email_sequence" has={emails.length > 0} label="Draft sequence" />}</span>}>
      {blockedCompany ? (
        <div className="flex items-center gap-2 rounded-md bg-pass-wash px-3 py-2 text-[13px] text-pass"><Ban size={15} />This company opted out. Tally will not draft email to them again.</div>
      ) : !emails.length ? (
        <p className="text-[12.5px] text-ink-3">First email, one follow-up, one breakup. Under 150 words, the ask is the free audit, opt-out line included.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-ink-3">To</span>
            <select aria-label="Email to" value={toId ?? ''} onChange={(e) => void setTo(e.target.value ? Number(e.target.value) : null)} className="h-7 rounded border border-rule-strong bg-paper-raised px-1.5 text-[12.5px]">
              <option value="">No address yet</option>
              {withEmail.map((c: Contact) => <option key={c.id} value={c.id}>{c.name ? `${c.name} <${c.email}>` : c.email}</option>)}
            </select>
            {!check.ok && <span className="flex items-center gap-1 text-pass"><Ban size={13} />{check.blocked}</span>}
            {check.ok && check.warnings.map((w) => <span key={w} className="flex items-center gap-1 rounded bg-conv-wash px-1.5 py-0.5 text-conv"><ShieldAlert size={13} />{w}</span>)}
          </div>
          {emails.map((e) => <EmailCard key={e.id} o={e} to={to} blocked={!check.ok} warnings={check.ok ? check.warnings : []} />)}
        </div>
      )}
    </Section>
  )
}

function EmailCard({ o, to, blocked, warnings }: { o: Outreach; to: Contact | null; blocked: boolean; warnings: string[] }) {
  const toast = useToast()
  const copy = useCopy()
  const [subject, setSubject] = useState(o.subject ?? '')
  const [body, setBody] = useState(o.body)
  useEffect(() => { setSubject(o.subject ?? ''); setBody(o.body) }, [o.subject, o.body])
  const issues = lintEmail(subject, body)
  const words = wordCount(body.replace(OPT_OUT_LINE, ''))
  const save = () => { if (subject !== (o.subject ?? '') || body !== o.body) void api.updateOutreach(o.id, { subject, body }) }

  const openMail = () => {
    if (blocked) return
    if (warnings.length && !window.confirm(`${warnings.join('\n')}\n\nOpen in your mail app anyway?`)) return
    window.open(mailtoHref(to?.email ?? null, subject, body))
    toast('Opened in your mail app. Press "I sent this" once you have sent it.')
  }

  return (
    <article className="rounded-md border border-rule bg-paper-raised p-3.5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <span className="label">{OUTREACH_LABEL[o.kind]}</span>
        <span className="flex items-center gap-2 text-[11.5px]">
          <span className={`num text-[13px] ${words >= 150 ? 'text-pass' : 'text-ink-3'}`}>{words}/150 words</span>
          {o.sentAt && <span className="flex items-center gap-1 rounded bg-go-wash px-1.5 py-0.5 font-medium text-go"><Check size={12} />Sent by you {shortDate(o.sentAt)}</span>}
        </span>
      </header>
      <Input aria-label={`${OUTREACH_LABEL[o.kind]} subject`} value={subject} readOnly={!!o.sentAt} onChange={(e) => setSubject(e.target.value)} onBlur={save} className="mb-2 font-semibold" />
      <Textarea aria-label={`${OUTREACH_LABEL[o.kind]} body`} rows={9} value={body} readOnly={!!o.sentAt} onChange={(e) => setBody(e.target.value)} onBlur={save} />
      {issues.length > 0 && !o.sentAt && (
        <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-conv">{issues.map((i) => <li key={i} className="flex items-center gap-1"><ShieldAlert size={12} />{i}</li>)}</ul>
      )}
      <footer className="mt-2.5 flex items-center gap-2">
        <Button size="sm" onClick={() => copy(`${subject}\n\n${body}`, 'Subject and body copied')}><Copy size={13} />Copy</Button>
        <Button size="sm" disabled={blocked || !!o.sentAt} onClick={openMail}><Mail size={13} />Open in mail app</Button>
        {!o.sentAt && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { save(); void api.markSent(o.id).then(() => toast('Logged as sent by you')) }}><Check size={13} />I sent this</Button>}
      </footer>
    </article>
  )
}

function Audit({ companyId, audit }: { companyId: number; audit: Outreach | undefined }) {
  const toast = useToast()
  const file = audit?.filePath
  const name = file?.split(/[\\/]/).pop()
  return (
    <Section title="Audit PDF" aside={<Redo companyId={companyId} kind="audit_pdf" has={!!audit} label="Build audit" />}>
      {!audit ? (
        <p className="text-[12.5px] text-ink-3">A branded one-page audit to email. Built from verified findings only, saved on this Mac.</p>
      ) : (
        <div className="flex gap-4 rounded-md border border-rule bg-paper-raised p-3.5">
          <div className="flex h-[84px] w-[60px] shrink-0 flex-col overflow-hidden rounded-sm border border-rule bg-paper shadow-sm">
            <div className="h-3 bg-chrome" /><div className="m-1.5 h-1 w-8 bg-amber" /><div className="mx-1.5 h-0.5 w-10 bg-rule-strong" /><div className="mx-1.5 mt-1 h-0.5 w-9 bg-rule-strong" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold"><FileText size={14} className="text-amber-ink" />{name}</div>
            <div className="text-[11.5px] text-ink-3">Built {ago(audit.updatedAt)}{audit.sentAt ? ` · sent by you ${shortDate(audit.sentAt)}` : ''}</div>
            <pre className="selectable mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] text-ink-2">{audit.body}</pre>
            {file && (
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" variant="primary" onClick={() => void api.openPath(file).catch((e) => toast(ipcMessage(e), 'error'))}><FileText size={13} />Open PDF</Button>
                <Button size="sm" onClick={() => void api.revealPath(file)}><FolderOpen size={13} />Show in Finder</Button>
                {!audit.sentAt && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void api.markSent(audit.id).then(() => toast('Logged as sent by you'))}><Check size={13} />I sent this</Button>}
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}

function Debriefs({ d }: { d: CompanyDetail }) {
  const toast = useToast()
  const id = d.company.id
  const running = useCompanyJob(id)
  const [notes, setNotes] = useState('')
  const go = async () => { if (await runJob('debrief', { companyId: id, notes }, toast)) setNotes('') }
  return (
    <Section title="Debrief" aside={<span className="text-[12px] text-ink-3">After a call or meeting</span>}>
      <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste rough notes. The Debrief Agent sets the stage and next step, and drafts any follow-up." aria-label="Debrief notes" onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey && notes.trim()) void go() }} />
      <div className="mt-2 flex justify-end"><Button size="sm" variant="primary" disabled={!notes.trim() || !!running} onClick={() => void go()}><NotebookPen size={13} />Debrief <span className="opacity-60">⌘↵</span></Button></div>
      {d.debriefs.length > 0 && (
        <ol className="mt-4 flex flex-col gap-3">
          {d.debriefs.map((b) => (
            <li key={b.id} className="rounded-md border border-rule bg-paper-raised p-3 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-2"><span className="selectable font-semibold text-ink">{b.summary}</span><span className="shrink-0 text-[11px] text-ink-3">{ago(b.createdAt)}</span></div>
              <div className="mt-0.5 text-ink-2">{[b.newStage && `Stage → ${STAGE_LABEL[b.newStage]}`, b.nextStep && `Next: ${b.nextStep}${b.nextStepDue ? ` (${b.nextStepDue})` : ''}`].filter(Boolean).join(' · ')}</div>
              <details className="mt-1"><summary className="cursor-pointer text-[11.5px] text-ink-3">Notes</summary><p className="selectable mt-1 whitespace-pre-wrap text-ink-2">{b.rawNotes}</p></details>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}
