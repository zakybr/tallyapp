/*
  Zod schemas for every agent result. Agents hand results to the app through
  save_* tools; the handler validates against these before anything is saved
  and returns the errors to the agent so it can correct itself.
*/
import { z } from 'zod'
import { CONSENT_BASES, FINDING_CATEGORIES, GAP_TYPES, GATES, RULE_OUTS, STAGES, VERDICTS } from './domain'

const url = z.string().min(4).describe('Full URL including https://')
const nullableUrl = url.nullable()

export const LeadSchema = z.object({
  name: z.string().min(2),
  website: nullableUrl,
  phone: z.string().nullable(),
  address: z.string().nullable(),
  googleListingUrl: nullableUrl.describe('A Google search or listing URL found in search results. Never a scraped Maps page.'),
  area: z.string().nullable(),
  note: z.string().nullable().describe('Why this looks like a fit, or what is visibly broken. One line.'),
  sourceUrl: nullableUrl.describe('Where you found this business')
})
/* The Lead Finder returns at most this many candidates per search. */
export const MAX_LEADS = 24
export const LeadsSchema = z.object({ leads: z.array(LeadSchema).max(MAX_LEADS) })

export const FindingSchema = z.object({
  category: z.enum(FINDING_CATEGORIES),
  finding: z.string().min(5).describe('One plain-English fact, the way Zak would say it on the phone.'),
  gapType: z.enum(GAP_TYPES).nullable().describe('Set only when this finding is evidence of a gap.'),
  sourceUrl: nullableUrl,
  pagesChecked: z.array(z.string()).describe('Every URL checked for this claim. "No form" claims need the homepage AND the contact/booking pages.'),
  screenshotPath: z.string().nullable().describe('Path returned by site_audit or ads_transparency_check, if any.'),
  verified: z.boolean().describe('false when you could not check it directly (e.g. robots.txt blocked, manual check needed).')
})

export const BenchmarkRowSchema = z.object({
  handle: z.string(),
  isProspect: z.boolean(),
  followers: z.number().int().nullable(),
  postsLast30: z.number().int().nullable(),
  reelsShare: z.number().min(0).max(1).nullable().describe('Share of recent posts that are Reels, 0 to 1'),
  avgEngagement: z.number().min(0).nullable().describe('(likes+comments) per post / followers, as a fraction'),
  sourceUrl: nullableUrl
})

export const ContactFoundSchema = z.object({
  name: z.string().nullable(),
  role: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  emailSourceUrl: nullableUrl.describe('The page where this email is published'),
  consentBasis: z.enum(CONSENT_BASES).describe('conspicuously_published only when the address is visibly published on a page you checked')
})

export const ResearchSchema = z.object({
  identity: z.object({
    resolved: z.boolean().describe('true only when you found the business itself: its website, listing, register entry or social page'),
    website: z.string().nullable().describe('The real website you found, even if it ranks badly'),
    howFound: z.string().describe('The search, domain guess or directory that found it, or everything you tried if you could not')
  }),
  legalName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  googleListingUrl: nullableUrl,
  companiesOffice: z.object({
    legalName: z.string().nullable(),
    companyNumber: z.string().nullable(),
    incorporated: z.string().nullable(),
    status: z.string().nullable(),
    directors: z.array(z.string().max(80)).describe('Names only. Never residential addresses.'),
    lastAnnualReturn: z.string().nullable(),
    sourceUrl: nullableUrl
  }).nullable(),
  findings: z.array(FindingSchema).min(3),
  benchmark: z.array(BenchmarkRowSchema).max(5),
  contacts: z.array(ContactFoundSchema).max(6)
})

const GateResultSchema = z.object({ status: z.enum(['pass', 'fail', 'unverified']), reason: z.string().min(3) })

export const ScoreSchema = z.object({
  verdict: z.enum(VERDICTS),
  gates: z.object(Object.fromEntries(GATES.map((g) => [g, GateResultSchema])) as Record<(typeof GATES)[number], typeof GateResultSchema>),
  verifiedGaps: z.array(z.object({ type: z.enum(GAP_TYPES), evidence: z.string(), sourceUrl: nullableUrl })),
  ruleOuts: z.array(z.object({ type: z.enum(RULE_OUTS), reason: z.string() })),
  reason: z.string().min(10).max(300).describe('The single reason for the verdict, one sentence.'),
  firstCallQuestion: z.string().nullable(),
  familyBuiltSite: z.boolean().describe('true if the site looks built by family or friends: pitch off-site only')
})

export const OpenerSchema = z.object({
  opener: z.string().min(10).max(320),
  observationSource: nullableUrl
})

export const CallScriptSchema = z.object({
  observation: z.string(),
  whatIDo: z.string(),
  meetingAsk: z.string(),
  auditOffer: z.string(),
  objections: z.object({ noBudget: z.string(), haveSomeone: z.string(), sendEmail: z.string(), notNow: z.string() }),
  qualifyingQuestion: z.string()
})

const EmailSchema = z.object({ subject: z.string().min(2), body: z.string().min(20) })
export const EmailSequenceSchema = z.object({ first: EmailSchema, followUp: EmailSchema, breakup: EmailSchema })

export const AuditContentSchema = z.object({
  summary: z.string().min(20).max(420).describe('Two sentences'),
  findings: z.array(z.object({ headline: z.string().max(90), body: z.string().max(340).describe('Two or three short sentences'), sourceUrl: nullableUrl, checkedAt: z.string().nullable(), screenshotPath: z.string().nullable() })).min(1).max(6),
  fixes: z.array(z.object({ fix: z.string().max(240), diy: z.boolean() })).min(1).max(5)
})

export const DebriefSchema = z.object({
  summary: z.string(),
  newStage: z.enum(STAGES).nullable(),
  nextStep: z.string().nullable(),
  nextStepDue: z.string().nullable().describe('YYYY-MM-DD in NZ time'),
  followUpEmail: EmailSchema.nullable(),
  optedOut: z.boolean().describe('true if they asked not to be contacted again'),
  monthlyValue: z.number().nullable()
})

export type ResearchResult = z.infer<typeof ResearchSchema>
export type ScoreResult = z.infer<typeof ScoreSchema>
export type AuditContent = z.infer<typeof AuditContentSchema>
