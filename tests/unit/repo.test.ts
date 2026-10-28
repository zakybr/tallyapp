import { describe, expect, it, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, migrate, Repo, toCsv } from '../../src/main/db/repo'

let repo: Repo
beforeEach(() => {
  repo = new Repo(openDatabase(join(mkdtempSync(join(tmpdir(), 'tally-test-')), 'tally.db')))
})

describe('repo', () => {
  it('migrates idempotently', () => {
    expect(migrate(repo.db)).toEqual([])
  })

  it('creates, updates and logs stage changes', () => {
    const c = repo.createCompany({ name: 'AOMAS', website: 'https://www.aomas.co.nz', area: 'Hibiscus Coast', vertical: 'Boat builders and marine' })
    expect(c.stage).toBe('discovered')
    repo.updateCompany(c.id, { stage: 'researched' })
    const d = repo.detail(c.id)!
    expect(d.company.stage).toBe('researched')
    expect(d.activities.some((a) => a.kind === 'stage_change')).toBe(true)
    expect(repo.stageCounts().researched).toBe(1)
  })

  it('remembers pass reasons by domain', () => {
    const c = repo.createCompany({ name: 'Dead Domain Ltd', website: 'deaddomain.co.nz' })
    repo.saveScore({
      companyId: c.id, verdict: 'pass', reason: 'Domain for sale', firstCallQuestion: null,
      gates: { real_active: { status: 'fail', reason: 'x' }, expensive: { status: 'pass', reason: '' }, can_afford: { status: 'unverified', reason: '' }, easy_to_market: { status: 'pass', reason: '' } },
      verifiedGaps: [], ruleOuts: [{ type: 'operational_risk', reason: 'dead domain' }]
    })
    expect(repo.passedBefore('deaddomain.co.nz', 'whatever')?.reason).toBe('Domain for sale')
  })

  it('deletes a person and every trace of them', () => {
    const c = repo.createCompany({ name: 'Pools Co' })
    const p = repo.upsertContact({ companyId: c.id, name: 'Jo Bloggs', email: 'jo@pools.co.nz', consentBasis: 'conspicuously_published' })
    repo.saveDraft(c.id, 'email_1', 'Hi Jo', 'Your site', p.id)
    repo.addActivity(c.id, 'note', 'Spoke to Jo Bloggs on jo@pools.co.nz')
    expect(repo.deletePerson(p.id).removedDrafts).toBe(1)
    const d = repo.detail(c.id)!
    expect(d.contacts).toHaveLength(0)
    expect(JSON.stringify(d)).not.toMatch(/Jo Bloggs|jo@pools/)
  })

  it('keeps one unsent draft per kind and logs a manual send', () => {
    const c = repo.createCompany({ name: 'X' })
    const a = repo.saveDraft(c.id, 'opener', 'one')
    const b = repo.saveDraft(c.id, 'opener', 'two')
    expect(a.id).toBe(b.id)
    repo.markSent(b.id)
    const fresh = repo.saveDraft(c.id, 'opener', 'three')
    expect(fresh.id).not.toBe(b.id)
  })

  it('merges settings over defaults', () => {
    repo.saveSettings({ proposalCap: 4, rateCard: { ...repo.getSettings().rateCard, monthly: 3200 } })
    const s = repo.getSettings()
    expect(s.proposalCap).toBe(4)
    expect(s.rateCard.monthly).toBe(3200)
    expect(s.rateCard.onboarding).toBe(1400)
  })

  it('suppresses case-insensitively and exports CSV', () => {
    repo.addSuppression({ email: 'NO@Thanks.nz', reason: 'opted out' })
    repo.addSuppression({ email: 'no@thanks.nz', reason: 'dup' })
    expect(repo.listSuppression()).toHaveLength(1)
    repo.createCompany({ name: 'Comma, Ltd' })
    expect(toCsv(repo.tableRows('companies'))).toMatch(/"Comma, Ltd"/)
  })
})

describe('delete person scrubbing', () => {
  it('does not corrupt words that merely contain a short name, and scrubs debriefs', () => {
    const r = new Repo(openDatabase(join(mkdtempSync(join(tmpdir(), 'tally-test-')), 't.db')))
    const c = r.createCompany({ name: 'Albany Luxury Builds' })
    const p = r.upsertContact({ companyId: c.id, name: 'Al', email: 'al@albany.nz' })
    r.addActivity(c.id, 'note', 'Albany site is slow. Al said call Friday.')
    r.saveDebrief({ companyId: c.id, rawNotes: 'Al keen, al@albany.nz', summary: 'Al keen', newStage: null, nextStep: null, nextStepDue: null, followUpDraft: 'Hi Al' })
    r.deletePerson(p.id)
    const d = r.detail(c.id)!
    expect(d.activities.find((a) => a.summary.startsWith('Albany'))?.summary).toBe('Albany site is slow. [removed] said call Friday.')
    expect(JSON.stringify(d.debriefs)).not.toMatch(/al@albany|"Al |Hi Al"/)
  })
})
