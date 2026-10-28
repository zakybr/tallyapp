/*
  Draft formatting and outreach compliance helpers. Pure, so main enforces
  them when agents save, the renderer shows the same warnings, and both are
  unit tested.
*/
import type { Contact, Suppression } from './domain'
import { OPT_OUT_LINE, checkEmailContact, isSuppressed, lintEmail, type EmailCheck } from './rules'

export interface CallScriptParts {
  observation: string
  whatIDo: string
  meetingAsk: string
  auditOffer: string
  objections: { noBudget: string; haveSomeone: string; sendEmail: string; notNow: string }
  qualifyingQuestion: string
}

/* The script is stored as editable text with the six numbered parts from the brief. */
export function formatCallScript(p: CallScriptParts): string {
  return [
    `1. Observation\n${p.observation}`,
    `2. What I do\n${p.whatIDo}`,
    `3. Meeting\n${p.meetingAsk}`,
    `4. Free audit\n${p.auditOffer}`,
    `5. Objections\n"No budget": ${p.objections.noBudget}\n"We have someone": ${p.objections.haveSomeone}\n"Send me an email": ${p.objections.sendEmail}\n"Not now, it's the off season": ${p.objections.notNow}`,
    `6. Qualifying question\n${p.qualifyingQuestion}`
  ].join('\n\n')
}

/* Splits a stored script back into its titled parts for Call mode. */
export function splitScript(text: string): { title: string; body: string }[] {
  const parts = text.split(/\n(?=\d\.\s)/)
  return parts.map((p) => {
    const m = p.match(/^(\d\.\s[^\n]+)\n?([\s\S]*)$/)
    return m ? { title: m[1].replace(/^\d\.\s/, ''), body: m[2].trim() } : { title: '', body: p.trim() }
  }).filter((p) => p.body)
}

/*
  Every email ends with the opt-out line, word for word (UEM Act 2007).
  If the agent left it out, the app adds it rather than trusting a retry.
*/
export function withOptOut(body: string): string {
  const trimmed = body.trim()
  return trimmed.includes(OPT_OUT_LINE) ? trimmed : `${trimmed}\n\n${OPT_OUT_LINE}`
}

/* Em dashes are banned; the spaces around them go too, so no " ,  " is left behind. */
export const noEmDash = (s: string) => s.replace(/\s*\u2014\s*/g, ', ')

/* Lint plus the opt-out guarantee. Returns the body to save and any rule breaches. */
export function finaliseEmail(subject: string, body: string): { subject: string; body: string; issues: string[] } {
  const b = withOptOut(noEmDash(body))
  const s = noEmDash(subject).trim()
  return { subject: s, body: b, issues: lintEmail(s, b) }
}

/*
  Which contact the email sequence is addressed to: the first contact with a
  published address that is not suppressed, else the first with any address.
*/
export function pickEmailContact(contacts: Contact[], suppression: Pick<Suppression, 'email' | 'domain'>[]): Contact | null {
  const usable = contacts.filter((c) => c.email && !isSuppressed(c.email, suppression))
  return usable.find((c) => c.consentBasis === 'conspicuously_published' || c.consentBasis === 'given_directly' || c.consentBasis === 'existing_relationship')
    ?? usable[0] ?? null
}

/*
  Whole-company block: they opted out (recorded on the timeline), every
  address on file is suppressed, or their domain is.
*/
export function companySuppressed(contacts: Contact[], website: string | null, suppression: Pick<Suppression, 'email' | 'domain'>[], optedOut = false): boolean {
  if (optedOut) return true
  const withEmail = contacts.filter((c) => c.email)
  if (withEmail.length && withEmail.every((c) => isSuppressed(c.email, suppression))) return true
  const host = website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
  return !!host && suppression.some((s) => s.domain && s.domain.toLowerCase() === host)
}

export function emailCheckFor(contact: Contact | null, suppression: Pick<Suppression, 'email' | 'domain'>[]): EmailCheck {
  return checkEmailContact(contact, suppression)
}

export function mailtoHref(to: string | null, subject: string | null, body: string): string {
  const q = new URLSearchParams()
  if (subject) q.set('subject', subject)
  q.set('body', body)
  // URLSearchParams encodes spaces as "+", which mail apps show literally.
  return `mailto:${to ? encodeURIComponent(to).replace(/%40/g, '@') : ''}?${q.toString().replace(/\+/g, '%20')}`
}
