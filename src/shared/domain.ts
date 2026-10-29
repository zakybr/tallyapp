import { DEFAULT_CAR_GOAL, DEFAULT_SPLIT, type CarGoal, type RevenueSplit } from './money'
/*
  The Tally domain. One file so the main process, preload and renderer agree
  on every shape that crosses IPC.
*/

export const STAGES = [
  'discovered', 'researched', 'go', 'conversation', 'pass',
  'contacted', 'meeting', 'proposal', 'won', 'lost'
] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  discovered: 'Discovered', researched: 'Researched', go: 'Go', conversation: 'Conversation',
  pass: 'Pass', contacted: 'Contacted', meeting: 'Meeting', proposal: 'Proposal', won: 'Won', lost: 'Lost'
}

export const VERDICTS = ['go', 'conversation', 'pass'] as const
export type Verdict = (typeof VERDICTS)[number]

/* The six gap families from the brief. Every recorded gap maps to one. */
export const GAP_TYPES = [
  'not_findable', 'broken_contact', 'outdated_info', 'nothing_measured', 'no_paid', 'weak_social'
] as const
export type GapType = (typeof GAP_TYPES)[number]

export const GAP_LABEL: Record<GapType, string> = {
  not_findable: 'Not findable',
  broken_contact: 'Broken site or contact path',
  outdated_info: 'Outdated or conflicting info',
  nothing_measured: 'Nothing measured',
  no_paid: 'No paid activity',
  weak_social: 'Weak social relative to size'
}

export const GATES = ['real_active', 'expensive', 'can_afford', 'easy_to_market'] as const
export type Gate = (typeof GATES)[number]

export const GATE_LABEL: Record<Gate, string> = {
  real_active: 'Real and active',
  expensive: 'Sells something expensive',
  can_afford: 'Can afford $2.5k+/month',
  easy_to_market: 'Easy to market'
}

export const RULE_OUTS = [
  'already_marketed', 'operational_risk', 'competes_with_prospect', 'family_built_site', 'client_conflict'
] as const
export type RuleOut = (typeof RULE_OUTS)[number]

export const RULE_OUT_LABEL: Record<RuleOut, string> = {
  already_marketed: 'Already marketed (pixel + GA4 + agency site)',
  operational_risk: 'Operational risk',
  competes_with_prospect: 'Competes with a live prospect',
  family_built_site: 'Site built by family or friends',
  client_conflict: 'Conflicts with an existing client'
}

export type GateStatus = 'pass' | 'fail' | 'unverified'

export interface Company {
  id: number
  name: string
  legalName: string | null
  website: string | null
  phone: string | null
  address: string | null
  area: string | null
  vertical: string | null
  googleListingUrl: string | null
  stage: Stage
  verdict: Verdict | null
  verdictReason: string | null
  nextStep: string | null
  nextStepDue: string | null
  monthlyValue: number | null
  /* Set when the site was built by family or friends: pitch off-site work only. */
  offsiteOnly: boolean
  notes: string | null
  source: string | null
  createdAt: string
  updatedAt: string
}

export type CompanyInput = Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>> & { name: string }
export type CompanyPatch = Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>

export const CONSENT_BASES = [
  'conspicuously_published', 'given_directly', 'existing_relationship', 'guessed', 'unknown'
] as const
export type ConsentBasis = (typeof CONSENT_BASES)[number]

export const CONSENT_LABEL: Record<ConsentBasis, string> = {
  conspicuously_published: 'Conspicuously published',
  given_directly: 'Given to me directly',
  existing_relationship: 'Existing business relationship',
  guessed: 'Guessed (not published)',
  unknown: 'Unknown'
}

export interface Contact {
  id: number
  companyId: number
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
  emailSourceUrl: string | null
  consentBasis: ConsentBasis
  createdAt: string
}

export type ContactInput = Partial<Omit<Contact, 'id' | 'createdAt'>> & { companyId: number }

export const FINDING_CATEGORIES = [
  'companies_office', 'site', 'tracking', 'contact_path', 'google_profile',
  'social', 'paid', 'pricing', 'benchmark', 'risk', 'other'
] as const
export type FindingCategory = (typeof FINDING_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  companies_office: 'Companies Office', site: 'Website', tracking: 'Tracking',
  contact_path: 'Contact path', google_profile: 'Google Business Profile', social: 'Social',
  paid: 'Paid activity', pricing: 'Pricing', benchmark: 'Benchmark', risk: 'Risk', other: 'Other'
}

export interface ResearchRecord {
  id: number
  companyId: number
  category: FindingCategory
  finding: string
  /* Set when the finding is evidence for a gap. */
  gapType: GapType | null
  sourceUrl: string | null
  /* Every page actually checked for this claim (homepage, /contact, booking page). */
  pagesChecked: string[]
  screenshotPath: string | null
  checkedAt: string
  verified: boolean
  jobId: string | null
}

export interface GateResult {
  status: GateStatus
  reason: string
}

export interface Score {
  id: number
  companyId: number
  verdict: Verdict
  gates: Record<Gate, GateResult>
  verifiedGaps: { type: GapType; evidence: string; sourceUrl: string | null }[]
  ruleOuts: { type: RuleOut; reason: string }[]
  reason: string
  firstCallQuestion: string | null
  createdAt: string
}

export type OutreachKind = 'opener' | 'call_script' | 'email_1' | 'email_2' | 'email_3' | 'follow_up' | 'audit_pdf'

export const OUTREACH_LABEL: Record<OutreachKind, string> = {
  opener: 'Opener', call_script: 'Call script', email_1: 'First email',
  email_2: 'Follow-up', email_3: 'Breakup', follow_up: 'Debrief follow-up', audit_pdf: 'Audit PDF'
}

export interface Outreach {
  id: number
  companyId: number
  contactId: number | null
  kind: OutreachKind
  subject: string | null
  body: string
  filePath: string | null
  /* Only ever set by Zak pressing "I sent this". The app never sends. */
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export type ActivityKind =
  | 'note' | 'call' | 'email_sent' | 'meeting' | 'stage_change'
  | 'research' | 'score' | 'draft' | 'debrief' | 'proposal' | 'opt_out'

export const CALL_OUTCOMES = ['no_answer', 'callback', 'meeting_booked', 'not_interested'] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  no_answer: 'No answer', callback: 'Callback', meeting_booked: 'Meeting booked', not_interested: 'Not interested'
}

export interface Activity {
  id: number
  companyId: number
  kind: ActivityKind
  summary: string
  outcome: string | null
  at: string
}

export interface Debrief {
  id: number
  companyId: number
  rawNotes: string
  summary: string
  newStage: Stage | null
  nextStep: string | null
  nextStepDue: string | null
  followUpDraft: string | null
  createdAt: string
}

export interface Suppression {
  id: number
  email: string | null
  domain: string | null
  reason: string
  createdAt: string
}

export interface Conflict {
  id: number
  name: string
  domain: string | null
  note: string | null
  createdAt: string
}

/* Money Zak moved out of the business account: to himself, to savings, to the tax account, or to the car fund. */
export const MOVE_KINDS = ['pay', 'save', 'tax', 'car'] as const
export type MoveKind = (typeof MOVE_KINDS)[number]
export const MOVE_LABEL: Record<MoveKind, string> = { pay: 'Paid to me', save: 'To savings', tax: 'To tax account', car: 'To car fund' }

export interface MoneyMove {
  id: number
  kind: MoveKind
  amount: number
  movedAt: string
  note: string | null
}

export interface Revenue {
  id: number
  companyId: number | null
  amount: number
  kind: 'onboarding' | 'retainer' | 'other'
  receivedAt: string
  note: string | null
}

export interface Settings {
  rateCard: {
    onboarding: number
    onboardingSameDay: number
    monthly: number
    minimumMonths: number
    note: string
  }
  proposalCap: number
  retainerTarget: number
  gstThreshold: number
  gstWarnAt: number
  regions: string[]
  verticals: string[]
  authMode: 'subscription' | 'api_key'
  apiKey: string
  placesApiKey: string
  model: string
  auditDelayMs: number
  /* Months after a Pass or Lost before contact people are deleted (Privacy Act IPP 9). */
  retentionMonths: number
  carGoal: CarGoal
  split: RevenueSplit
  sender: { name: string; company: string; phone: string; email: string; website: string }
  theme: 'system' | 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  rateCard: {
    onboarding: 1400,
    onboardingSameDay: 700,
    monthly: 3000,
    minimumMonths: 4,
    note: 'No targets or guarantees. Fix what is broken, start measuring, then fill the funnel.'
  },
  proposalCap: 3,
  retainerTarget: 3,
  gstThreshold: 60000,
  gstWarnAt: 50000,
  regions: ['North Shore', 'Hibiscus Coast', 'West Auckland', 'Wairau Valley'],
  verticals: [
    'Boat builders and marine',
    'Pools',
    'Motorhomes',
    'Luxury homes',
    'Seasonal leisure (jet ski hire, venues)'
  ],
  authMode: 'subscription',
  apiKey: '',
  placesApiKey: '',
  model: '',
  auditDelayMs: 2500,
  retentionMonths: 12,
  carGoal: DEFAULT_CAR_GOAL,
  split: DEFAULT_SPLIT,
  sender: {
    name: 'Zak Rachmadi',
    company: 'Tally Marketing Limited',
    phone: '+64 22 305 3853',
    email: 'zak@tallynz.co',
    website: 'tallynz.co'
  },
  theme: 'system'
}

export type JobKind =
  | 'lead_finder' | 'research' | 'score' | 'opener' | 'call_script'
  | 'email_sequence' | 'audit_pdf' | 'debrief' | 'prepare' | 'pipeline' | 'check'

export const JOB_LABEL: Record<JobKind, string> = {
  lead_finder: 'Lead Finder',
  research: 'Research Agent',
  score: 'Scorer',
  opener: 'Opener Writer',
  call_script: 'Call Script Writer',
  email_sequence: 'Email Drafter',
  audit_pdf: 'Audit Builder',
  debrief: 'Debrief Agent',
  prepare: 'Prepare',
  pipeline: 'Orchestrator',
  check: 'Connection check'
}

export type JobStatus = 'running' | 'done' | 'failed' | 'cancelled'

export interface Job {
  id: string
  kind: JobKind
  companyId: number | null
  title: string
  status: JobStatus
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  turns: number
  error: string | null
}

export type LogLevel = 'info' | 'tool' | 'page' | 'finding' | 'text' | 'error' | 'done'

export interface JobLogEntry {
  jobId: string
  at: string
  level: LogLevel
  message: string
  detail?: string
}

export interface LeadCandidate {
  name: string
  website: string | null
  phone: string | null
  address: string | null
  googleListingUrl: string | null
  area: string | null
  note: string | null
  duplicateOf: number | null
}

export interface InstagramBenchmarkRow {
  handle: string
  isProspect: boolean
  followers: number | null
  postsLast30: number | null
  reelsShare: number | null
  avgEngagement: number | null
  sourceUrl: string | null
  checkedAt: string
}

export interface CompanyDetail {
  company: Company
  contacts: Contact[]
  research: ResearchRecord[]
  score: Score | null
  outreach: Outreach[]
  activities: Activity[]
  debriefs: Debrief[]
  benchmark: InstagramBenchmarkRow[]
}

export interface TodaySummary {
  callsToMake: Company[]
  followUpsDue: Company[]
  liveProposals: Company[]
  proposalCap: number
  liveRetainers: number
  retainerTarget: number
  mrr: number
  trailing12Revenue: number
  gstWarning: boolean
  gstThreshold: number
  runningJobs: Job[]
  stageCounts: Record<Stage, number>
}
