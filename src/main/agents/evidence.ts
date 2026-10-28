/*
  The evidence rule, enforced in code: an absence claim about something that
  lives on the site (no form, no tracking, no booking) is only verified when
  the homepage AND a contact/booking page were checked. Pure apart from the
  screenshot existence check, so it is unit tested without Electron.
*/
import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { ResearchRecord } from '@shared/domain'
import type { ResearchResult } from '@shared/schemas'

const ABSENCE = /\b(no|not|missing|without|absent|lacks?|none|doesn'?t|isn'?t)\b/i
const CONTACTISH = /contact|enquir|inquir|book|quote|reserv|hire|get-in-touch/i

/* A screenshot is kept only if it exists inside this company's own evidence folder. */
export function ownScreenshot(path: string | null | undefined, evidenceDir: string): string | null {
  if (!path) return null
  return resolve(path).startsWith(resolve(evidenceDir) + sep) && existsSync(path) ? path : null
}

export function applyEvidenceRule(findings: ResearchResult['findings'], evidenceDir: string, checkedAt = new Date().toISOString()): Omit<ResearchRecord, 'id' | 'companyId' | 'jobId'>[] {
  return findings.map((f) => {
    let verified = f.verified
    let finding = f.finding
    const onSitePath = f.category === 'contact_path' || f.category === 'tracking' || f.gapType === 'broken_contact' || f.gapType === 'nothing_measured'
    if (verified && onSitePath && ABSENCE.test(f.finding)) {
      const pages = new Set(f.pagesChecked.map((p) => p.replace(/\/$/, '')))
      const sawContactPage = f.pagesChecked.some((p) => CONTACTISH.test(p))
      if (pages.size < 2 || !sawContactPage) {
        verified = false
        finding = `${finding} (not verified: the contact/booking page was not checked)`
      }
    }
    return { category: f.category, finding, gapType: f.gapType, sourceUrl: f.sourceUrl, pagesChecked: f.pagesChecked, screenshotPath: ownScreenshot(f.screenshotPath, evidenceDir), checkedAt, verified }
  })
}
