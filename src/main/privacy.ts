/*
  Privacy Act 2020 housekeeping that touches files as well as the database:
  deleting a company removes its screenshots and audit PDFs, and the
  retention sweep runs on every start.
*/
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './context'
import type { Repo } from './db/repo'

export function deleteCompanyFiles(companyId: number): void {
  rmSync(join(dataDir(), 'evidence', String(companyId)), { recursive: true, force: true })
  const audits = join(dataDir(), 'audits')
  if (!existsSync(audits)) return
  for (const f of readdirSync(audits)) if (f.includes(`-${companyId}-audit-`)) rmSync(join(audits, f), { force: true })
}

export function deleteCompanyFully(repo: Repo, companyId: number): void {
  repo.deleteCompany(companyId)
  deleteCompanyFiles(companyId)
}

/* IPP 9: remove contact people from long-closed prospects, plus their screenshots. */
export function retentionSweep(repo: Repo): { companies: number; people: number } {
  const months = repo.getSettings().retentionMonths
  if (!months || months <= 0) return { companies: 0, people: 0 }
  let people = 0
  const due = repo.retentionDue(months)
  for (const { companyId, contactIds } of due) {
    for (const id of contactIds) { repo.deletePerson(id); people++ }
    rmSync(join(dataDir(), 'evidence', String(companyId)), { recursive: true, force: true })
    repo.addActivity(companyId, 'note', `Retention: contact details deleted after ${months} months closed (Privacy Act IPP 9).`)
  }
  return { companies: due.length, people }
}
