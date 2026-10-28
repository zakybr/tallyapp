import { describe, expect, it } from 'vitest'
import { domainCandidates } from '../../src/main/agents/findDomain'

describe('domain guessing', () => {
  it('adds trade words, so AOMAS finds aomasmarine.com', () => {
    const c = domainCandidates('AOMAS', 'Boat builders and marine', 'Hibiscus Coast')
    expect(c).toContain('aomasmarine.com')
    expect(c).toContain('aomas.co.nz')
    expect(c).toContain('aomas-marine.co.nz')
  })
  it('handles multi-word names and initials', () => {
    const c = domainCandidates('White Pointer Boats Ltd', 'Boat builders and marine')
    expect(c).toContain('whitepointerboats.co.nz')
    expect(c).toContain('wpb.co.nz')
  })
})
