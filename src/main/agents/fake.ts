/*
  Test-only stand-in for the Claude Agent SDK, switched on by
  TALLY_FAKE_AGENTS=1 (the e2e suite sets it). Each "agent" calls its real
  save tool with fixed fixture data, so validation, compliance checks,
  saving, PDF rendering and the UI are exercised end to end with no model,
  no network and no login. Never active in normal use.
*/
import type { AgentRun } from './runner'
import type { JobContext } from './runner'
import { nextWorkingDay } from '@shared/rules'

const at = new Date().toISOString()
const site = 'https://e2emarine.example.co.nz'

const FIXTURES: Record<string, (prompt: string) => Record<string, unknown>> = {
  save_leads: () => ({
    leads: [
      { name: 'Harbour Hulls Ltd', website: 'https://harbourhulls.example.co.nz', phone: '09 555 0101', address: 'Silverdale', googleListingUrl: null, area: 'Hibiscus Coast', note: 'Custom aluminium boats; site has no tracking', sourceUrl: 'https://example.co.nz/search' },
      { name: 'Orewa Pontoons', website: null, phone: '09 555 0102', address: 'Orewa', googleListingUrl: null, area: 'Hibiscus Coast', note: 'No website found', sourceUrl: 'https://example.co.nz/search' }
    ]
  }),
  save_research: () => ({
    legalName: 'E2E Marine Limited', phone: '09 555 0100', address: '1 Test Road, Silverdale', googleListingUrl: null,
    companiesOffice: { legalName: 'E2E Marine Limited', companyNumber: '1234567', incorporated: '2004-03-01', status: 'Registered', directors: ['Sam Example'], lastAnnualReturn: '2026-03-01', sourceUrl: 'https://app.companiesoffice.govt.nz/co/1234567' },
    findings: [
      { category: 'tracking', finding: 'No GA4 or Meta pixel on the homepage or the contact page.', gapType: 'nothing_measured', sourceUrl: site, pagesChecked: [site, `${site}/contact`], screenshotPath: null, verified: true },
      { category: 'contact_path', finding: 'The phone number on the contact page is not a tap-to-call link at 375px.', gapType: 'broken_contact', sourceUrl: `${site}/contact`, pagesChecked: [site, `${site}/contact`], screenshotPath: null, verified: true },
      { category: 'google_profile', finding: '4.9 stars from 62 Google reviews.', gapType: null, sourceUrl: 'https://www.google.com/search?q=e2e+marine', pagesChecked: [], screenshotPath: null, verified: true },
      { category: 'paid', finding: 'No ads in the Google Ads Transparency Center for this domain.', gapType: 'no_paid', sourceUrl: 'https://adstransparency.google.com/?domain=e2emarine.example.co.nz&region=NZ', pagesChecked: [], screenshotPath: null, verified: true },
      { category: 'pricing', finding: 'Boats listed from $89,000.', gapType: null, sourceUrl: `${site}/boats`, pagesChecked: [`${site}/boats`], screenshotPath: null, verified: true },
      { category: 'tracking', finding: 'No booking form found.', gapType: 'broken_contact', sourceUrl: site, pagesChecked: [site], screenshotPath: null, verified: true }
    ],
    benchmark: [
      { handle: 'e2emarine', isProspect: true, followers: 410, postsLast30: 1, reelsShare: 0, avgEngagement: 0.012, sourceUrl: 'https://www.instagram.com/e2emarine/' },
      { handle: 'peerboats', isProspect: false, followers: 3200, postsLast30: 9, reelsShare: 0.5, avgEngagement: 0.03, sourceUrl: 'https://www.instagram.com/peerboats/' },
      { handle: 'otherpeer', isProspect: false, followers: 2100, postsLast30: 6, reelsShare: 0.4, avgEngagement: 0.025, sourceUrl: 'https://www.instagram.com/otherpeer/' }
    ],
    contacts: [{ name: 'Sam Example', role: 'Director', email: 'sam@e2emarine.example.co.nz', phone: null, emailSourceUrl: `${site}/contact`, consentBasis: 'conspicuously_published' }]
  }),
  save_score: () => ({
    verdict: 'go',
    gates: {
      real_active: { status: 'pass', reason: 'Registered since 2004, annual return filed March 2026.' },
      expensive: { status: 'pass', reason: 'Boats listed from $89,000.' },
      can_afford: { status: 'unverified', reason: 'Not published. Ask on the first call.' },
      easy_to_market: { status: 'pass', reason: 'Visual product, clear buyer, summer season.' }
    },
    verifiedGaps: [{ type: 'nothing_measured', evidence: 'No GA4 or Meta pixel on homepage or contact page.', sourceUrl: site }],
    ruleOuts: [], reason: 'Established builder with 62 strong reviews and nothing measured on the site.',
    firstCallQuestion: 'If the work brought in enquiries, could the business support around $3,000 a month?', familyBuiltSite: false
  }),
  save_opener: () => ({ opener: 'You have 62 five-star reviews on Google, but the phone number on your contact page cannot be tapped on a phone.', observationSource: `${site}/contact` }),
  save_call_script: () => ({
    observation: 'You have 62 five-star reviews on Google, but the phone number on your contact page cannot be tapped on a phone.',
    whatIDo: "I'm Zak from Tally, a small Auckland marketing business. I fix the broken bits online, get things measured, then bring in enquiries.",
    meetingAsk: 'Could I grab 20 minutes on Zoom or at the yard, tomorrow at 10 or Friday at 2?',
    auditOffer: "Either way I'll email you a one-page audit of what I found. It's free.",
    objections: { noBudget: 'No pressure. The audit is free and you can do some of it yourself.', haveSomeone: 'Good. The audit is a second pair of eyes they can use.', sendEmail: 'Happy to. Is sam@ the best address, and what would you most like in it?', notNow: 'The off season is the best time to fix the site, so it is ready when summer starts.' },
    qualifyingQuestion: 'If the work paid for itself, is around $3,000 a month something the business could support?'
  }),
  save_emails: () => ({
    first: { subject: 'Your contact page', body: 'Hi Sam,\n\nThe phone number on your contact page cannot be tapped on a phone. Most people looking at boats are on their phone, so some of them will give up rather than copy the number.\n\nI put together a short audit of this and a few other quick fixes. Want me to send it over?\n\nZak\nTally · 022 305 3853 · tallynz.co' },
    followUp: { subject: 'Quick one', body: 'Hi Sam,\n\nOne more: there is no analytics on the site, so there is no way to see which boats people look at.\n\nHappy to send the audit if useful.\n\nZak' },
    breakup: { subject: 'Last note', body: 'Hi Sam,\n\nI will not keep emailing. If you would like the audit later, just reply and I will send it.\n\nZak' }
  }),
  save_audit: () => ({
    summary: 'Your reviews are excellent and your boats are clearly well regarded. The first thing worth fixing is the contact page, where the phone number cannot be tapped on a phone.',
    findings: [
      { headline: 'Your phone number cannot be tapped on a phone', body: 'On the contact page at phone width, the number is plain text. People browsing on their phone have to copy it by hand.', sourceUrl: `${site}/contact`, checkedAt: at, screenshotPath: null },
      { headline: 'Nothing on the site is measured', body: 'There is no Google Analytics or Meta pixel on the homepage or contact page, so there is no way to see which boats get attention.', sourceUrl: site, checkedAt: at, screenshotPath: null },
      { headline: '62 five-star Google reviews', body: 'This is a real asset, and it is not shown anywhere on your site.', sourceUrl: 'https://www.google.com/search?q=e2e+marine', checkedAt: at, screenshotPath: null }
    ],
    fixes: [{ fix: 'Make the phone number a tap-to-call link', diy: true }, { fix: 'Install GA4 and the Meta pixel', diy: false }, { fix: 'Show your Google reviews on the homepage', diy: true }]
  }),
  save_debrief: (prompt) => {
    const notes = prompt.split('"""')[1] ?? ''
    if (/don'?t (call|contact)|remove me|stop/i.test(notes)) {
      return { summary: 'Asked not to be contacted again.', newStage: 'lost', nextStep: null, nextStepDue: null, followUpEmail: null, optedOut: true, monthlyValue: null }
    }
    return {
      summary: 'Spoke to Sam. Interested, booked a Zoom.', newStage: 'meeting', nextStep: 'Zoom with Sam', nextStepDue: nextWorkingDay(),
      followUpEmail: { subject: 'Zoom confirmed', body: 'Hi Sam,\n\nThanks for the chat today. Zoom confirmed, I will send the audit beforehand.\n\nZak' },
      optedOut: false, monthlyValue: null
    }
  }
}

const SUBAGENT_SAVE: Record<string, string> = { research: 'save_research', scorer: 'save_score', opener: 'save_opener', call_script: 'save_call_script', email: 'save_emails', audit: 'save_audit' }

export async function fakeRun<T>(spec: AgentRun<T>, log: JobContext['log']): Promise<{ output: T; text: string }> {
  log('info', `${spec.name}: fake agent (TALLY_FAKE_AGENTS=1)`)
  const call = async (name: string) => {
    const t = spec.tools?.find((x) => x.name === name)
    const fixture = FIXTURES[name]
    if (!t || !fixture) return
    log('tool', name)
    const r = await t.handler(fixture(spec.prompt), {})
    const text = (r.content as { text?: string }[]).map((c) => c.text ?? '').join('\n')
    if (r.isError) throw new Error(text)
  }
  if (spec.agents) {
    for (const key of Object.keys(spec.agents)) {
      await call(SUBAGENT_SAVE[key])
      if (key === 'scorer' && /pass/i.test(spec.prompt.match(/verdict[^\n]*/i)?.[0] ?? '')) break
    }
  } else {
    const save = spec.tools?.find((x) => x.name.startsWith('save_'))
    if (save) await call(save.name)
  }
  const output = (spec.schema ? { ok: true, skills: spec.skills ?? [] } : undefined) as T
  return { output, text: 'done' }
}
