/*
  Prepare → Contact → Follow up. Opener, call script, email sequence, audit
  PDF and debrief. Every result is validated, compliance-checked and saved
  as an editable draft. Nothing here sends anything.
*/
import { getRepo, evidenceDir } from '../context'
import { emit } from '../ipc'
import { realSettings } from '../secrets'
import { registerJob, type JobPayload } from './jobs'
import { DEFS } from './definitions'
import { extraTools, researchRecordFor, runDef } from './research'
import { saveTool } from './tools'
import { ownScreenshot } from './evidence'
import { renderAuditPdf } from '../audit/pdf'
import { applyDebrief } from '../db/debrief'
import type { JobContext } from './runner'
import { AuditContentSchema, CallScriptSchema, DebriefSchema, EmailSequenceSchema, OpenerSchema } from '@shared/schemas'
import { companySuppressed, finaliseEmail, formatCallScript, noEmDash, pickEmailContact } from '@shared/drafts'
import { OPT_OUT_LINE, checkEmailContact, localDate } from '@shared/rules'
import { CALL_OUTCOME_LABEL, STAGE_LABEL, type CallOutcome, type Company, type OutreachKind } from '@shared/domain'

const changed = (companyId: number) => emit('data:changed', { table: 'outreach', companyId })

function drafted(companyId: number, what: string) {
  getRepo().addActivity(companyId, 'draft', `Drafted: ${what}`)
  changed(companyId)
}

/* ---------- UEM Act gate ---------- */

/* Jobs in which Zak confirmed drafting to a guessed or unsourced address. */
const acknowledged = new Set<string>()

function emailBlocked(c: Company): boolean {
  const repo = getRepo()
  return companySuppressed(repo.listContacts(c.id), c.website, repo.listSuppression(), repo.hasOptedOut(c.id))
}

/* Warnings for the address the sequence would go to (guessed, unsourced, unknown basis). */
function emailWarnings(c: Company): string[] {
  const repo = getRepo()
  const suppression = repo.listSuppression()
  const check = checkEmailContact(pickEmailContact(repo.listContacts(c.id), suppression), suppression)
  return check.ok ? check.warnings : []
}

/*
  Gate for any job that drafts email up front: an opted-out company is
  blocked outright; a risky address needs Zak's acknowledgement, which the
  renderer asks for and retries with `acknowledged: true`.
*/
function emailGate(c: Company, p: JobPayload): void {
  if (emailBlocked(c)) throw new Error(`${c.name} opted out. They are never drafted to again.`)
  const w = emailWarnings(c)
  if (w.length && !p.acknowledged) throw new Error(`Compliance check: ${w.join(' ')}`)
}

/* ---------- save tools (also handed to the orchestrator via extraTools) ---------- */

extraTools.set('save_opener', (ctx, companyId, done) =>
  saveTool('save_opener', 'Save the one-sentence opener. Call once.', OpenerSchema, (r) => {
    const opener = noEmDash(r.opener)
    getRepo().saveDraft(companyId, 'opener', opener)
    ctx.log('finding', `Opener: ${opener}`)
    drafted(companyId, 'opener')
    done.add('save_opener')
    return 'Saved.'
  }))

extraTools.set('save_call_script', (ctx, companyId, done) =>
  saveTool('save_call_script', 'Save the call script. Call once.', CallScriptSchema, (r) => {
    getRepo().saveDraft(companyId, 'call_script', noEmDash(formatCallScript(r)))
    ctx.log('finding', 'Call script saved')
    drafted(companyId, 'call script')
    done.add('save_call_script')
    return 'Saved.'
  }))

const EMAIL_LABEL: Record<string, string> = { email_1: 'First email', email_2: 'Follow-up', email_3: 'Breakup' }

extraTools.set('save_emails', (ctx, companyId, done) =>
  saveTool('save_emails', 'Save the email sequence (first, follow-up, breakup). Rule breaches come back as errors: rewrite and save again.', EmailSequenceSchema, (r) => {
    const repo = getRepo()
    const c = repo.getCompany(companyId)!
    if (emailBlocked(c)) throw new Error('This company opted out. Do not draft email to them. Skip this step.')
    // The orchestrator reaches this without an up-front gate, so the check repeats here.
    const warnings = emailWarnings(c)
    if (warnings.length && !acknowledged.has(ctx.jobId)) {
      ctx.log('error', `Emails not drafted: ${warnings.join(' ')} Use "Draft sequence" on the prospect to confirm.`)
      throw new Error(`Not saved: Zak has not confirmed drafting to this address (${warnings.join(' ')}). Skip the email step.`)
    }
    const emails = ([['email_1', r.first], ['email_2', r.followUp], ['email_3', r.breakup]] as const).map(([kind, e]) => ({ kind, ...finaliseEmail(e.subject, e.body) }))
    const issues = emails.flatMap((e) => e.issues.map((i) => `${EMAIL_LABEL[e.kind]}: ${i}`))
    if (issues.length) throw new Error(`These break the email rules:\n- ${issues.join('\n- ')}`)
    const to = pickEmailContact(repo.listContacts(companyId), repo.listSuppression())
    repo.db.transaction(() => { for (const e of emails) repo.saveDraft(companyId, e.kind as OutreachKind, e.body, e.subject, to?.id ?? null) })()
    ctx.log('finding', `Emails: "${emails[0].subject}" + follow-up + breakup${to?.email ? ` to ${to.email}` : ' (no address on file yet)'}`)
    drafted(companyId, 'email sequence')
    done.add('save_emails')
    return 'Saved.'
  }))

extraTools.set('save_audit', (ctx, companyId, done) =>
  saveTool('save_audit', 'Save the audit content. The app renders the branded one-page PDF. Call once.', AuditContentSchema, async (r) => {
    const repo = getRepo()
    const c = repo.getCompany(companyId)!
    const dir = evidenceDir(companyId)
    const content = { ...r, findings: r.findings.map((f) => ({ ...f, screenshotPath: ownScreenshot(f.screenshotPath, dir) })) }
    const sent = repo.listOutreach(companyId).filter((o) => o.kind === 'audit_pdf' && o.sentAt && o.filePath).map((o) => o.filePath!)
    ctx.log('tool', 'Rendering audit PDF')
    const file = await renderAuditPdf(content, { companyId, businessName: c.name, sender: realSettings(repo).sender, keep: sent })
    const summary = [content.summary, '', ...content.findings.map((f, i) => `${i + 1}. ${f.headline}`), '', 'Fixes:', ...content.fixes.map((f, i) => `${i + 1}. ${f.fix}${f.diy ? ' (DIY)' : ''}`)].join('\n')
    repo.saveDraft(companyId, 'audit_pdf', summary, `${c.name} audit`, null, file)
    ctx.log('finding', `Audit PDF saved: ${file}`)
    drafted(companyId, 'audit PDF')
    done.add('save_audit')
    return 'Saved and rendered.'
  }))

/* ---------- prompts (one copy each, shared by single jobs and Prepare) ---------- */

function needsResearch(companyId: number): Company {
  const repo = getRepo()
  const c = repo.getCompany(companyId)
  if (!c) throw new Error('Company not found')
  if (!repo.listResearch(companyId).length) throw new Error(`Research ${c.name} first. Drafts are built only from verified findings.`)
  return c
}

const recordBlock = (id: number) => `Research record (the only facts you may use):\n${researchRecordFor(id)}`

const PROMPTS = {
  opener: (c: Company) => `Write the opener for ${c.name}.\n\n${recordBlock(c.id)}`,
  call_script: (c: Company) => `Write the call script for ${c.name}.\n\n${recordBlock(c.id)}`,
  audit: (c: Company) => `Build the one-page audit for ${c.name}.${c.offsiteOnly ? ' The site was built by family or friends: off-site findings only.' : ''}\n\n${recordBlock(c.id)}`,
  email: (c: Company) => {
    const repo = getRepo()
    const to = pickEmailContact(repo.listContacts(c.id), repo.listSuppression())
    return `Draft the email sequence for ${c.name}.\n\nAddress it to: ${to?.name ? `${to.name}${to.role ? ` (${to.role})` : ''}` : 'the owner (no name on file: open with "Hi there")'}\nOpt-out line, word for word, last line of every body:\n${OPT_OUT_LINE}\n\n${recordBlock(c.id)}`
  }
}

/* ---------- jobs ---------- */

/* Runs `work` with the job's email acknowledgement recorded for save_emails. */
async function withAck(ctx: JobContext, p: JobPayload, work: () => Promise<void>) {
  if (p.acknowledged) acknowledged.add(ctx.jobId)
  try { await work() } finally { acknowledged.delete(ctx.jobId) }
}

const single = (key: keyof typeof PROMPTS, label: string) => (p: JobPayload) => {
  const id = Number(p.companyId)
  const c = needsResearch(id)
  if (key === 'email') emailGate(c, p)
  return { title: `${label}: ${c.name}`, companyId: id, work: (ctx: JobContext) => withAck(ctx, p, async () => { await runDef(ctx, DEFS[key], PROMPTS[key](c), id) }) }
}

registerJob('opener', single('opener', 'Opener'))
registerJob('call_script', single('call_script', 'Call script'))
registerJob('email_sequence', single('email', 'Emails'))
registerJob('audit_pdf', single('audit', 'Audit PDF'))

/* All four drafts in one job, in the order Zak uses them. `skipEmails` when he declines a risky address. */
registerJob('prepare', (p) => {
  const id = Number(p.companyId)
  const c = needsResearch(id)
  if (c.verdict === 'pass' && !p.force) throw new Error(`${c.name} was scored Pass: ${c.verdictReason ?? ''}`)
  const emails = !p.skipEmails && !emailBlocked(c)
  if (emails) emailGate(c, p)
  return {
    title: `Prepare: ${c.name}`,
    companyId: id,
    work: (ctx) => withAck(ctx, p, async () => {
      await runDef(ctx, DEFS.opener, PROMPTS.opener(c), id)
      await runDef(ctx, DEFS.call_script, PROMPTS.call_script(c), id)
      if (emails) await runDef(ctx, DEFS.email, PROMPTS.email(c), id)
      else ctx.log('info', emailBlocked(c) ? 'Emails skipped: this company opted out' : 'Emails skipped at your request')
      await runDef(ctx, DEFS.audit, PROMPTS.audit(c), id)
    })
  }
})

registerJob('debrief', (p) => {
  const id = Number(p.companyId)
  const repo = getRepo()
  const c = repo.getCompany(id)
  if (!c) throw new Error('Company not found')
  const notes = String(p.notes ?? '').trim()
  const outcome = (p.outcome ?? null) as CallOutcome | null
  if (!notes && !outcome) throw new Error('Paste some notes first.')
  return {
    title: `Debrief: ${c.name}`,
    companyId: id,
    work: async (ctx) => {
      let warnings: string[] = []
      const save = saveTool('save_debrief', 'Save the debrief. Call once.', DebriefSchema, (r) => {
        warnings = applyDebrief(getRepo(), id, notes || `(no notes) ${outcome ? CALL_OUTCOME_LABEL[outcome] : ''}`, r).warnings
        ctx.log('finding', `${r.summary}${r.newStage ? ` → ${STAGE_LABEL[r.newStage]}` : ''}${r.nextStep ? `. Next: ${r.nextStep}${r.nextStepDue ? ` (${r.nextStepDue})` : ''}` : ''}`)
        if (r.optedOut) ctx.log('finding', 'Opted out: added to the suppression list')
        emit('data:changed', { table: 'debriefs', companyId: id })
        return 'Saved.'
      })
      const prompt = [
        `Debrief for ${c.name}. Today is ${localDate()} (NZ).`,
        `Current stage: ${STAGE_LABEL[c.stage]}. Current next step: ${c.nextStep ?? 'none'}${c.nextStepDue ? ` (${c.nextStepDue})` : ''}.`,
        outcome ? `Call outcome Zak pressed: ${CALL_OUTCOME_LABEL[outcome]}.` : '',
        `Opt-out line for any follow-up email, word for word, last line:\n${OPT_OUT_LINE}`,
        `Zak's notes:\n"""\n${notes || '(none)'}\n"""`,
        `Research record for context:\n${researchRecordFor(id)}`
      ].filter(Boolean).join('\n\n')
      await runDef(ctx, DEFS.debrief, prompt, id, { save_debrief: save })
      for (const w of warnings) ctx.log('error', w)
    }
  }
})
