/*
  Applies a validated Debrief Agent result: stage, next step, any follow-up
  draft (lint-checked, opt-out line guaranteed) and opt-outs. Takes the repo
  so it is unit tested without Electron.
*/
import type { Repo } from './repo'
import type { Stage } from '@shared/domain'
import type { z } from 'zod'
import type { DebriefSchema } from '@shared/schemas'
import { finaliseEmail, pickEmailContact } from '@shared/drafts'
import { normaliseDomain, proposalCapCheck } from '@shared/rules'

export type DebriefResult = z.infer<typeof DebriefSchema>

export function applyDebrief(repo: Repo, companyId: number, rawNotes: string, r: DebriefResult): { warnings: string[] } {
  const warnings: string[] = []
  const c = repo.getCompany(companyId)
  if (!c) throw new Error('Company not found')

  let followUp: { subject: string; body: string } | null = null
  if (r.followUpEmail && !r.optedOut) {
    const f = finaliseEmail(r.followUpEmail.subject, r.followUpEmail.body)
    if (f.issues.length) throw new Error(`Follow-up email breaks the email rules:\n- ${f.issues.join('\n- ')}`)
    followUp = { subject: f.subject, body: f.body }
  }
  if (r.newStage === 'proposal' && c.stage !== 'proposal') {
    const cap = proposalCapCheck(repo.listCompanies(), repo.getSettings().proposalCap)
    if (cap.wouldExceed) warnings.push(`This makes ${cap.live + 1} live proposals (cap ${cap.cap}).`)
  }

  repo.db.transaction(() => {
    repo.saveDebrief({
      companyId, rawNotes, summary: r.summary, newStage: r.newStage, nextStep: r.nextStep, nextStepDue: r.nextStepDue,
      followUpDraft: followUp ? `${followUp.subject}\n\n${followUp.body}` : null
    })
    const patch: { stage?: Stage; nextStep?: string | null; nextStepDue?: string | null; monthlyValue?: number | null } = {
      nextStep: r.nextStep, nextStepDue: r.nextStepDue
    }
    if (r.newStage && r.newStage !== c.stage) patch.stage = r.newStage
    if (r.monthlyValue != null) patch.monthlyValue = r.monthlyValue
    repo.updateCompany(companyId, patch)
    repo.addActivity(companyId, 'debrief', r.summary, r.nextStep ? `Next: ${r.nextStep}${r.nextStepDue ? ` (${r.nextStepDue})` : ''}` : null)

    if (r.optedOut) {
      // UEM Act: they are never drafted to again. Unsent drafts are withdrawn.
      const reason = `${c.name} opted out (debrief ${new Date().toLocaleDateString('en-NZ')})`
      for (const ct of repo.listContacts(companyId)) if (ct.email) repo.addSuppression({ email: ct.email, reason })
      // The domain too, so addresses found later are covered.
      const domain = normaliseDomain(c.website)
      if (domain && !repo.listSuppression().some((s) => s.domain === domain)) repo.addSuppression({ domain, reason })
      repo.db.prepare("DELETE FROM outreach WHERE company_id = ? AND sent_at IS NULL AND kind IN ('email_1', 'email_2', 'email_3', 'follow_up')").run(companyId)
      repo.addActivity(companyId, 'opt_out', 'Asked not to be contacted again. Addresses added to the suppression list; unsent emails withdrawn.')
    } else if (followUp) {
      const to = pickEmailContact(repo.listContacts(companyId), repo.listSuppression())
      repo.saveDraft(companyId, 'follow_up', followUp.body, followUp.subject, to?.id ?? null)
    }
  })()
  return { warnings }
}
