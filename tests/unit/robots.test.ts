import { describe, expect, it } from 'vitest'
import { allowedBy, isBlockedHost, parseRobots } from '../../src/main/audit/robots'

describe('robots.txt', () => {
  it('applies the * group with longest match winning', () => {
    const rules = parseRobots('User-agent: Googlebot\nDisallow:\n\nUser-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$')
    expect(allowedBy(rules, '/contact')).toBe(true)
    expect(allowedBy(rules, '/private/x')).toBe(false)
    expect(allowedBy(rules, '/private/ok/page')).toBe(true)
    expect(allowedBy(rules, '/brochure.pdf')).toBe(false)
  })
  it('treats Disallow: / as everything', () => {
    expect(allowedBy(parseRobots('User-agent: *\nDisallow: /'), '/co/123')).toBe(false)
  })
  it('never fetches LinkedIn or Google Maps', () => {
    expect(isBlockedHost(new URL('https://nz.linkedin.com/company/x'))).toBeTruthy()
    expect(isBlockedHost(new URL('https://www.google.com/maps/place/x'))).toBeTruthy()
    expect(isBlockedHost(new URL('https://maps.app.goo.gl/abc'))).toBeTruthy()
    expect(isBlockedHost(new URL('https://www.google.com/search?q=x'))).toBeNull()
  })
})
