import { describe, expect, it, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, Repo } from '../../src/main/db/repo'
import { applyDebrief } from '../../src/main/db/debrief'
import { applyEvidenceRule } from '../../src/main/agents/evidence'
import { auditFileName, buildAuditHtml } from '../../src/main/audit/auditHtml'
import { companySuppressed, finaliseEmail, noEmDash, formatCallScript, mailtoHref, pickEmailContact, splitScript, withOptOut } from '@shared/drafts'
import { OPT_OUT_LINE, nextWorkingDay } from '@shared/rules'
import type { Contact } from '@shared/domain'

const contact = (p: Partial<Contact>): Contact => ({ id: 1, companyId: 1, name: null, role: null, email: null, phone: null, emailSourceUrl: null, consentBasis: 'unknown', createdAt: '', ...p })

describe('evidence rule', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tally-ev-'))
  const base = { category: 'contact_path' as const, gapType: 'broken_contact' as const, sourceUrl: 'https://x.co.nz', screenshotPath: null, verified: true }

  it('downgrades an absence claim when the contact page was not checked', () => {
    const [r] = applyEvidenceRule([{ ...base, finding: 'No contact form on the site.', pagesChecked: ['https://x.co.nz/'] }], dir)
    expect(r.verified).toBe(false)
    expect(r.finding).toMatch(/not verified/)
  })
  it('keeps it verified when the homepage and /contact were both checked', () => {
    const [r] = applyEvidenceRule([{ ...base, finding: 'No contact form on the site.', pagesChecked: ['https://x.co.nz/', 'https://x.co.nz/contact'] }], dir)
    expect(r.verified).toBe(true)
  })
  it('leaves positive findings alone', () => {
    const [r] = applyEvidenceRule([{ ...base, finding: 'The contact form shows a reCAPTCHA config error.', pagesChecked: ['https://x.co.nz/contact'] }], dir)
    expect(r.verified).toBe(true)
  })
  it('keeps only screenshots inside this company folder, not a sibling with the same prefix', () => {
    const mine = join(dir, '1'); const sibling = join(dir, '12')
    mkdirSync(mine, { recursive: true }); mkdirSync(sibling, { recursive: true })
    writeFileSync(join(mine, 'a.png'), ''); writeFileSync(join(sibling, 'b.png'), '')
    const out = applyEvidenceRule([
      { ...base, finding: 'Homepage is slow on mobile.', pagesChecked: [], screenshotPath: join(mine, 'a.png') },
      { ...base, finding: 'Homepage is slow on mobile.', pagesChecked: [], screenshotPath: join(sibling, 'b.png') }
    ], mine)
    expect(out[0].screenshotPath).toBe(join(mine, 'a.png'))
    expect(out[1].screenshotPath).toBeNull()
  })
})

describe('drafts', () => {
  it('round-trips the call script into Call mode parts', () => {
    const text = formatCallScript({
      observation: 'Obs.', whatIDo: 'I fix things.', meetingAsk: 'Friday?', auditOffer: 'Free audit.',
      objections: { noBudget: 'a', haveSomeone: 'b', sendEmail: 'c', notNow: 'd' }, qualifyingQuestion: '$2.5k?'
    })
    const parts = splitScript(text)
    expect(parts.map((p) => p.title)).toEqual(['Observation', 'What I do', 'Meeting', 'Free audit', 'Objections', 'Qualifying question'])
    expect(parts[4].body).toContain('"Not now, it\'s the off season": d')
  })

  it('always ends emails with the opt-out line, once, and strips em dashes', () => {
    expect(withOptOut('Hi')).toBe(`Hi\n\n${OPT_OUT_LINE}`)
    expect(withOptOut(`Hi\n\n${OPT_OUT_LINE}`)).toBe(`Hi\n\n${OPT_OUT_LINE}`)
    const f = finaliseEmail('Your site', 'Hi — there')
    expect(f.body).not.toContain('—')
    expect(f.issues).toEqual([])
  })

  it('flags rule breaches', () => {
    const f = finaliseEmail('This subject line is far too long', 'We will skyrocket your leads, guaranteed.')
    expect(f.issues.join(' ')).toMatch(/Subject is 7 words/)
    expect(f.issues.join(' ')).toMatch(/skyrocket/)
  })

  it('picks a published, unsuppressed address first', () => {
    const list = [
      contact({ id: 1, email: 'guess@x.co.nz', consentBasis: 'guessed' }),
      contact({ id: 2, email: 'out@x.co.nz', consentBasis: 'conspicuously_published' }),
      contact({ id: 3, email: 'sam@x.co.nz', consentBasis: 'conspicuously_published' })
    ]
    expect(pickEmailContact(list, [{ email: 'out@x.co.nz', domain: null }])?.id).toBe(3)
    expect(pickEmailContact([list[0]], [])?.id).toBe(1)
  })

  it('removes em dashes with their surrounding spaces', () => {
    expect(noEmDash('62 reviews \u2014 but no tap-to-call')).toBe('62 reviews, but no tap-to-call')
  })

  it('blocks a company that opted out even with no address on file', () => {
    expect(companySuppressed([], null, [], true)).toBe(true)
  })

  it('blocks a company when every address or the domain is suppressed', () => {
    const list = [contact({ email: 'a@x.co.nz' })]
    expect(companySuppressed(list, null, [{ email: 'a@x.co.nz', domain: null }])).toBe(true)
    expect(companySuppressed([], 'https://www.x.co.nz/', [{ email: null, domain: 'x.co.nz' }])).toBe(true)
    expect(companySuppressed(list, 'x.co.nz', [])).toBe(false)
  })

  it('builds a mailto with spaces encoded for mail apps', () => {
    const href = mailtoHref('sam@x.co.nz', 'Your site', 'Hi Sam,\nLine two')
    expect(href.startsWith('mailto:sam@x.co.nz?subject=Your%20site&body=Hi%20Sam')).toBe(true)
    expect(href).not.toContain('+')
  })

  it('skips weekends for the next working day', () => {
    expect(nextWorkingDay(new Date(2026, 9, 30))).toBe('2026-11-02') // Friday → Monday
    expect(nextWorkingDay(new Date(2026, 9, 27))).toBe('2026-10-28')
  })
})

describe('audit file names', () => {
  it('carry the company id and never reuse a sent file', () => {
    const a = auditFileName('/d', 'Harbour Marine', 3, '2026-10-28', [])
    expect(a).toBe('/d/harbour-marine-3-audit-2026-10-28.pdf')
    expect(auditFileName('/d', 'Harbour Marine', 4, '2026-10-28', [])).not.toBe(a)
    expect(auditFileName('/d', 'Harbour Marine', 3, '2026-10-28', [a])).toBe('/d/harbour-marine-3-audit-2026-10-28-2.pdf')
  })
})

describe('audit html', () => {
  it('escapes agent text and includes the footer line', () => {
    const html = buildAuditHtml(
      { summary: 'Good <b>reviews</b>.', findings: [{ headline: 'A & B', body: 'x', sourceUrl: 'https://x.co.nz/contact', checkedAt: '2026-10-28T00:00:00Z', screenshotPath: null }], fixes: [{ fix: 'Fix it', diy: true }] },
      { businessName: 'White Pointer Boats', date: '28 October 2026', sender: { name: 'Zak Rachmadi', company: 'Tally Marketing Limited', phone: '022', email: 'zak@tallynz.co', website: 'tallynz.co' }, fonts: { display: '/f/a.woff2', sans: '/f/b.woff2', sansBold: '/f/c.woff2' } }
    )
    expect(html).toContain('Good &lt;b&gt;reviews&lt;/b&gt;.')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('No targets, no guarantees.')
    expect(html).toContain('You can do this one yourself')
    expect(html).not.toContain('—')
  })
})

describe('debrief', () => {
  let repo: Repo
  beforeEach(() => { repo = new Repo(openDatabase(join(mkdtempSync(join(tmpdir(), 'tally-db-')), 'tally.db'))) })

  it('moves the stage, sets the next step and saves a lint-clean follow-up', () => {
    const c = repo.createCompany({ name: 'White Pointer Boats', stage: 'go' })
    repo.upsertContact({ companyId: c.id, name: 'Sam', email: 'sam@wp.co.nz', consentBasis: 'conspicuously_published', emailSourceUrl: 'https://wp.co.nz/contact' })
    applyDebrief(repo, c.id, 'booked zoom fri', {
      summary: 'Booked a Zoom.', newStage: 'meeting', nextStep: 'Zoom', nextStepDue: '2026-10-30',
      followUpEmail: { subject: 'Zoom Friday', body: 'Hi Sam, see you Friday.' }, optedOut: false, monthlyValue: null
    })
    const d = repo.detail(c.id)!
    expect(d.company.stage).toBe('meeting')
    expect(d.company.nextStepDue).toBe('2026-10-30')
    const f = d.outreach.find((o) => o.kind === 'follow_up')!
    expect(f.body.endsWith(OPT_OUT_LINE)).toBe(true)
    expect(f.contactId).toBe(d.contacts[0].id)
    expect(d.debriefs).toHaveLength(1)
  })

  it('suppresses everyone and withdraws unsent email on an opt-out', () => {
    const c = repo.createCompany({ name: 'AOMAS', website: 'https://www.aomas.co.nz', stage: 'contacted' })
    repo.upsertContact({ companyId: c.id, email: 'info@aomas.co.nz', consentBasis: 'conspicuously_published' })
    repo.saveDraft(c.id, 'email_2', 'body', 'subj')
    applyDebrief(repo, c.id, 'said stop', { summary: 'Opted out.', newStage: 'lost', nextStep: null, nextStepDue: null, followUpEmail: { subject: 'x', body: 'y' }, optedOut: true, monthlyValue: null })
    const d = repo.detail(c.id)!
    expect(repo.listSuppression().map((s) => s.email)).toContain('info@aomas.co.nz')
    expect(repo.hasOptedOut(c.id)).toBe(true)
    expect(d.outreach.filter((o) => o.kind.startsWith('email') || o.kind === 'follow_up')).toHaveLength(0)
    expect(d.activities.some((a) => a.kind === 'opt_out')).toBe(true)
    expect(repo.listSuppression().some((s) => s.domain === 'aomas.co.nz')).toBe(true)
  })

  it('refuses a follow-up that breaks the email rules, saving nothing', () => {
    const c = repo.createCompany({ name: 'X' })
    expect(() => applyDebrief(repo, c.id, 'n', { summary: 's', newStage: null, nextStep: null, nextStepDue: null, followUpEmail: { subject: 'ok', body: 'This will skyrocket you.' }, optedOut: false, monthlyValue: null })).toThrow(/skyrocket/)
    expect(repo.detail(c.id)!.debriefs).toHaveLength(0)
  })
})
