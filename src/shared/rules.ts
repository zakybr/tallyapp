/*
  Business and compliance rules as pure functions, so they are unit tested
  and shared by main (enforcement) and renderer (warnings).
*/
import type { Company, Contact, Gate, GateResult, RuleOut, GapType, Verdict, Suppression, Revenue, Settings } from './domain'

/* YYYY-MM-DD in the machine's local time zone (NZ), never UTC. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function normaliseDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(limited|ltd|nz|new zealand|co|company|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  let d = phone.replace(/[^\d+]/g, '')
  if (d.startsWith('+64')) d = '0' + d.slice(3)
  else if (d.startsWith('64') && d.length > 9) d = '0' + d.slice(2)
  return d.length >= 7 ? d : null
}

/* Dedupe: same domain, same normalised name, or same phone. */
export function findDuplicate(
  candidate: { name: string; website?: string | null; phone?: string | null },
  existing: Pick<Company, 'id' | 'name' | 'website' | 'phone'>[]
): number | null {
  const d = normaliseDomain(candidate.website)
  const n = normaliseName(candidate.name)
  const p = normalisePhone(candidate.phone)
  for (const c of existing) {
    if (d && normaliseDomain(c.website) === d) return c.id
    if (n && normaliseName(c.name) === n) return c.id
    if (p && normalisePhone(c.phone) === p) return c.id
  }
  return null
}

export const LIVE_PROPOSAL_STAGES = ['proposal'] as const

export function proposalCapCheck(companies: Pick<Company, 'stage'>[], cap: number) {
  const live = companies.filter((c) => c.stage === 'proposal').length
  return { live, cap, atCap: live >= cap, wouldExceed: live + 1 > cap }
}

export function monthlyRecurring(companies: Pick<Company, 'stage' | 'monthlyValue'>[], fallback: number): number {
  return companies.filter((c) => c.stage === 'won').reduce((sum, c) => sum + (c.monthlyValue ?? fallback), 0)
}

export function trailing12(revenue: Pick<Revenue, 'amount' | 'receivedAt'>[], now = new Date()): number {
  const from = new Date(now)
  from.setFullYear(from.getFullYear() - 1)
  return revenue
    .filter((r) => {
      const t = new Date(r.receivedAt)
      return t > from && t <= now
    })
    .reduce((s, r) => s + r.amount, 0)
}

export function gstWarning(trailing: number, s: Pick<Settings, 'gstWarnAt'>): boolean {
  return trailing >= s.gstWarnAt
}

/* ---------- Unsolicited Electronic Messages Act 2007 ---------- */

export type EmailCheck =
  | { ok: true; warnings: string[] }
  | { ok: false; blocked: string; warnings: string[] }

export function isSuppressed(email: string | null | undefined, list: Pick<Suppression, 'email' | 'domain'>[]): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  const dom = e.split('@')[1]
  return list.some((s) => (s.email && s.email.toLowerCase() === e) || (s.domain && dom && s.domain.toLowerCase() === dom))
}

export function checkEmailContact(
  contact: Pick<Contact, 'email' | 'emailSourceUrl' | 'consentBasis'> | null,
  suppression: Pick<Suppression, 'email' | 'domain'>[]
): EmailCheck {
  const warnings: string[] = []
  if (!contact?.email) return { ok: false, blocked: 'No email address on file for this contact.', warnings }
  if (isSuppressed(contact.email, suppression)) {
    return { ok: false, blocked: `${contact.email} is on the suppression list. They opted out and are never drafted to again.`, warnings }
  }
  if (contact.consentBasis === 'guessed') {
    warnings.push('This address was guessed, not published. Under the UEM Act there is no inferred consent for a guessed address.')
  }
  if (contact.consentBasis === 'unknown') {
    warnings.push('Consent basis unknown. Record where this address was found before sending.')
  }
  if (!contact.emailSourceUrl && contact.consentBasis !== 'given_directly' && contact.consentBasis !== 'existing_relationship') {
    warnings.push('No source URL recorded for this address.')
  }
  return { ok: true, warnings }
}

/* ---------- Cold email rules ---------- */

export const HYPE_WORDS = [
  'revolutionary', 'game-changer', 'game changer', 'skyrocket', 'unlock', 'supercharge', 'cutting-edge',
  'world-class', 'synergy', 'leverage', 'disrupt', 'explode', 'guarantee', 'guaranteed', 'amazing',
  'incredible', 'best-in-class', 'turbocharge', 'massive', '10x', 'boost your', 'grow your business'
]

const US_SPELLINGS: [RegExp, string][] = [
  [/\boptimiz/i, 'optimis'], [/\borganiz/i, 'organis'], [/\banalyz/i, 'analys'], [/\bcolor\b/i, 'colour'],
  [/\bcenter\b/i, 'centre'], [/\bprioritiz/i, 'prioritis'], [/\brealiz/i, 'realis'], [/\bfavorite/i, 'favourite'],
  [/\bbehavior/i, 'behaviour'], [/\bcatalog\b/i, 'catalogue'], [/\bmodeling\b/i, 'modelling']
]

export const OPT_OUT_LINE = 'If you would rather not hear from me again, reply "no thanks" and I will not contact you again.'

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export function lintEmail(subject: string, body: string): string[] {
  const issues: string[] = []
  if (wordCount(subject) >= 6) issues.push(`Subject is ${wordCount(subject)} words. Keep it under six.`)
  const bodyWithoutOptOut = body.replace(OPT_OUT_LINE, '')
  if (wordCount(bodyWithoutOptOut) >= 150) issues.push(`Body is ${wordCount(bodyWithoutOptOut)} words. Keep it under 150.`)
  if (/[—]/.test(subject + body)) issues.push('Contains an em dash. Rewrite without it.')
  const lower = (subject + ' ' + body).toLowerCase()
  for (const w of HYPE_WORDS) if (lower.includes(w)) issues.push(`Hype word: "${w}".`)
  for (const [re, fix] of US_SPELLINGS) if (re.test(subject + ' ' + body)) issues.push(`US spelling, use NZ "${fix}…".`)
  if (!/no thanks|opt out|unsubscribe|not contact you again/i.test(body)) issues.push('Missing the opt-out line.')
  return issues
}

/* ---------- Verdict consistency ---------- */

/*
  The Scorer decides, but its verdict must be consistent with its own
  evidence. Go needs: three verifiable gates passed (can_afford may stay
  unverified, it is a first-call question), at least one verified gap, and
  no rule-outs. Any failed gate or any rule-out is a Pass.
*/
export function expectedVerdict(
  gates: Record<Gate, Pick<GateResult, 'status'>>,
  verifiedGaps: { type: GapType }[],
  ruleOuts: { type: RuleOut }[]
): Verdict {
  if (ruleOuts.length > 0) return 'pass'
  const statuses = Object.entries(gates) as [Gate, Pick<GateResult, 'status'>][]
  if (statuses.some(([, g]) => g.status === 'fail')) return 'pass'
  if (verifiedGaps.length === 0) return 'pass'
  const hardUnverified = statuses.filter(([k, g]) => k !== 'can_afford' && g.status === 'unverified')
  return hardUnverified.length === 0 ? 'go' : 'conversation'
}

/* Two prospects compete when they share a vertical and an area. */
export function competingProspects(
  target: Pick<Company, 'id' | 'vertical' | 'area'>,
  others: Pick<Company, 'id' | 'name' | 'vertical' | 'area' | 'stage'>[]
) {
  const live = new Set(['go', 'conversation', 'contacted', 'meeting', 'proposal'])
  return others.filter(
    (o) => o.id !== target.id && live.has(o.stage) && !!target.vertical && o.vertical === target.vertical && !!target.area && o.area === target.area
  )
}

/* Next Monday–Friday after `d`, as a local YYYY-MM-DD. */
export function nextWorkingDay(d = new Date()): string {
  const n = new Date(d)
  do n.setDate(n.getDate() + 1)
  while (n.getDay() === 0 || n.getDay() === 6)
  return localDate(n)
}
