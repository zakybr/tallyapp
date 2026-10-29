import { describe, expect, it } from 'vitest'
import { newerThan } from '@shared/version'
import { AREA_CATALOG, CATEGORY_CATALOG } from '@shared/catalog'
import { LeadsSchema, MAX_LEADS } from '@shared/schemas'

describe('updates', () => {
  it('compares versions numerically', () => {
    expect(newerThan('v0.2.0', '0.1.0')).toBe(true)
    expect(newerThan('0.10.0', '0.9.9')).toBe(true)
    expect(newerThan('0.1.0', '0.1.0')).toBe(false)
    expect(newerThan('0.1.0', '0.2.0')).toBe(false)
    expect(newerThan('1.0', '0.99.99')).toBe(true)
  })
})

describe('find catalogue and limits', () => {
  it('ships a full catalogue with no duplicates inside a group', () => {
    expect(CATEGORY_CATALOG.flatMap((g) => g.items).length).toBeGreaterThan(50)
    expect(AREA_CATALOG.flatMap((g) => g.items).length).toBeGreaterThan(60)
    for (const g of [...CATEGORY_CATALOG, ...AREA_CATALOG]) expect(new Set(g.items).size).toBe(g.items.length)
  })
  it('caps a lead search at 24', () => {
    const lead = { name: 'X Ltd', website: null, phone: null, address: null, googleListingUrl: null, area: null, note: null, sourceUrl: null }
    expect(MAX_LEADS).toBe(24)
    expect(LeadsSchema.safeParse({ leads: Array(24).fill(lead) }).success).toBe(true)
    expect(LeadsSchema.safeParse({ leads: Array(25).fill(lead) }).success).toBe(false)
  })
})
