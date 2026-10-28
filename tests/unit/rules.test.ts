import { describe, expect, it } from 'vitest'
import {
  checkEmailContact, competingProspects, expectedVerdict, findDuplicate, gstWarning, lintEmail, monthlyRecurring,
  normaliseDomain, normalisePhone, OPT_OUT_LINE, proposalCapCheck, trailing12
} from '@shared/rules'

const gates = (s: Partial<Record<string, 'pass' | 'fail' | 'unverified'>> = {}) => ({
  real_active: { status: s.real_active ?? 'pass' },
  expensive: { status: s.expensive ?? 'pass' },
  can_afford: { status: s.can_afford ?? 'unverified' },
  easy_to_market: { status: s.easy_to_market ?? 'pass' }
}) as never

describe('dedupe', () => {
  it('normalises domains and phones', () => {
    expect(normaliseDomain('https://www.WhitePointerBoats.co.nz/contact')).toBe('whitepointerboats.co.nz')
    expect(normaliseDomain('aomas.co.nz')).toBe('aomas.co.nz')
    expect(normalisePhone('+64 9 426 1234')).toBe('094261234')
  })
  it('matches on domain, name or phone', () => {
    const existing = [{ id: 7, name: 'White Pointer Boats Ltd', website: 'whitepointerboats.co.nz', phone: null }]
    expect(findDuplicate({ name: 'Other', website: 'http://www.whitepointerboats.co.nz' }, existing)).toBe(7)
    expect(findDuplicate({ name: 'White Pointer Boats' }, existing)).toBe(7)
    expect(findDuplicate({ name: 'Formula Cruisers' }, existing)).toBeNull()
  })
})

describe('business rules', () => {
  it('warns before a fourth live proposal', () => {
    const three = [{ stage: 'proposal' }, { stage: 'proposal' }, { stage: 'proposal' }] as never
    expect(proposalCapCheck(three, 3)).toMatchObject({ live: 3, atCap: true, wouldExceed: true })
    expect(proposalCapCheck([{ stage: 'proposal' }] as never, 3).wouldExceed).toBe(false)
  })
  it('computes MRR from won clients, falling back to the rate card', () => {
    expect(monthlyRecurring([{ stage: 'won', monthlyValue: 3500 }, { stage: 'won', monthlyValue: null }, { stage: 'lost', monthlyValue: 3000 }] as never, 3000)).toBe(6500)
  })
  it('flags GST as trailing 12 month revenue approaches $60k', () => {
    const now = new Date('2026-10-28')
    const rev = [{ amount: 30000, receivedAt: '2026-06-01' }, { amount: 21000, receivedAt: '2026-01-01' }, { amount: 99999, receivedAt: '2024-01-01' }]
    const t = trailing12(rev, now)
    expect(t).toBe(51000)
    expect(gstWarning(t, { gstWarnAt: 50000 })).toBe(true)
  })
})

describe('UEM Act checks', () => {
  it('blocks suppressed addresses and warns on guessed ones', () => {
    const supp = [{ email: 'owner@boats.co.nz', domain: null }]
    expect(checkEmailContact({ email: 'Owner@boats.co.nz', emailSourceUrl: null, consentBasis: 'conspicuously_published' }, supp).ok).toBe(false)
    const guessed = checkEmailContact({ email: 'info@x.co.nz', emailSourceUrl: null, consentBasis: 'guessed' }, [])
    expect(guessed.ok).toBe(true)
    expect(guessed.warnings.join(' ')).toMatch(/guessed/)
  })
})

describe('email lint', () => {
  it('passes a clean NZ email', () => {
    const body = `Hi Sam,\n\nClick Website on your Google listing and it opens a page selling another domain.\nPeople searching for you land somewhere else.\n\nWant me to send the short audit?\n\nZak\n\n${OPT_OUT_LINE}`
    expect(lintEmail('Your Google listing', body)).toEqual([])
  })
  it('catches em dashes, hype, US spelling, long subjects and missing opt-out', () => {
    const issues = lintEmail('We will skyrocket your business growth today', 'Let us optimize this — guaranteed.')
    expect(issues.join('|')).toMatch(/Subject/)
    expect(issues.join('|')).toMatch(/em dash/)
    expect(issues.join('|')).toMatch(/skyrocket/)
    expect(issues.join('|')).toMatch(/optimis/)
    expect(issues.join('|')).toMatch(/opt-out/)
  })
})

describe('verdict consistency', () => {
  it('is Go with three verified gates, a gap and no rule-outs', () => {
    expect(expectedVerdict(gates(), [{ type: 'nothing_measured' }], [])).toBe('go')
  })
  it('is Conversation when a hard gate is unverified', () => {
    expect(expectedVerdict(gates({ expensive: 'unverified' }), [{ type: 'no_paid' }], [])).toBe('conversation')
  })
  it('is Pass on a failed gate, no gap, or any rule-out', () => {
    expect(expectedVerdict(gates({ real_active: 'fail' }), [{ type: 'no_paid' }], [])).toBe('pass')
    expect(expectedVerdict(gates(), [], [])).toBe('pass')
    expect(expectedVerdict(gates(), [{ type: 'no_paid' }], [{ type: 'already_marketed' }])).toBe('pass')
  })
  it('finds competing live prospects in the same vertical and area', () => {
    const others = [
      { id: 2, name: 'A', vertical: 'Pools', area: 'North Shore', stage: 'proposal' },
      { id: 3, name: 'B', vertical: 'Pools', area: 'North Shore', stage: 'pass' },
      { id: 4, name: 'C', vertical: 'Pools', area: 'West Auckland', stage: 'go' }
    ] as never
    expect(competingProspects({ id: 1, vertical: 'Pools', area: 'North Shore' }, others).map((o: { id: number }) => o.id)).toEqual([2])
  })
})
