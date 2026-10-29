/*
  Relationships: directors approached for advice or a visit, not a sale.
  Stages, touch kinds and the cadence that turns a meeting into a dated list
  of next touches. Pure functions, shared by main (scheduling) and renderer.
*/
import { HYPE_WORDS, US_SPELLINGS, localDate } from './rules'

export const REL_STAGES = [
  'identified', 'first_contact', 'booked', 'met', 'thanked', 'acted_on_advice',
  'value_touch', 'invited_to_share', 'pitched', 'client', 'advisor_only', 'parked'
] as const
export type RelStage = (typeof REL_STAGES)[number]

export const REL_STAGE_LABEL: Record<RelStage, string> = {
  identified: 'Identified',
  first_contact: 'First contact sent',
  booked: 'Visit or call booked',
  met: 'Met',
  thanked: 'Thank-you sent',
  acted_on_advice: 'Acted on their advice',
  value_touch: 'Value touch sent',
  invited_to_share: "Invited to share what I'm building",
  pitched: 'Pitched',
  client: 'Client',
  advisor_only: 'Advisor only',
  parked: 'Parked'
}

export const CLOSED_STAGES: RelStage[] = ['client', 'advisor_only', 'parked']

export const INTERACTION_KINDS = ['met', 'call', 'email', 'text', 'linkedin'] as const
export type InteractionKind = (typeof INTERACTION_KINDS)[number]
export const INTERACTION_LABEL: Record<InteractionKind, string> = { met: 'Met in person', call: 'Call', email: 'Email', text: 'Text', linkedin: 'LinkedIn' }

/* What a touch is for. Logging one of these moves the person to its stage. */
export const TOUCH_KINDS = ['first_contact', 'follow_up', 'meeting', 'thank_you', 'acted_on_advice', 'value_touch', 'invite_to_share', 'pitch', 'check_in'] as const
export type TouchKind = (typeof TOUCH_KINDS)[number]

export const TOUCH_LABEL: Record<TouchKind, string> = {
  first_contact: 'First contact: ask for advice or a visit',
  follow_up: 'Gentle follow-up on the first contact',
  meeting: 'The visit or call',
  thank_you: 'Thank-you, naming one thing they said',
  acted_on_advice: 'Tell them what you did with their advice',
  value_touch: 'Send something useful, no ask',
  invite_to_share: "Ask if they'd like to hear what you're building",
  pitch: 'Pitch',
  check_in: 'Check in'
}

export const TOUCH_TO_STAGE: Partial<Record<TouchKind, RelStage>> = {
  first_contact: 'first_contact',
  meeting: 'met',
  thank_you: 'thanked',
  acted_on_advice: 'acted_on_advice',
  value_touch: 'value_touch',
  invite_to_share: 'invited_to_share',
  pitch: 'pitched'
}

/* Days after the meeting (followUp and checkIn count from the last touch). Editable per person. */
export interface Cadence { thankYou: number; acted: number; value: number; invite: number; followUp: number; checkIn: number }
export const DEFAULT_CADENCE: Cadence = { thankYou: 0, acted: 7, value: 18, invite: 28, followUp: 7, checkIn: 14 }

export interface Person {
  id: number
  name: string
  role: string | null
  companyId: number | null
  companyName: string | null
  phone: string | null
  phoneSource: string | null
  email: string | null
  emailSourceUrl: string | null
  linkedinUrl: string | null
  howMet: string | null
  introducedBy: string | null
  interests: string | null
  tags: string[]
  stage: RelStage
  cadence: Cadence
  metOn: string | null
  lastTouchOn: string | null
  nextTouchOn: string | null
  nextTouchKind: TouchKind | null
  nextTouchManual: boolean
  pitchOverrideAt: string | null
  externalIds: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type PersonInput = Partial<Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'companyName'>> & { name: string }
export type PersonPatch = Partial<Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'companyName'>>

export interface Interaction {
  id: number
  personId: number
  occurredOn: string
  kind: InteractionKind
  touchKind: TouchKind | null
  notes: string | null
  toldMe: string | null
  advice: string | null
  promised: string | null
  createdAt: string
}

export type InteractionInput = Omit<Interaction, 'id' | 'createdAt'>

export interface PersonPromise {
  id: number
  personId: number
  interactionId: number | null
  text: string
  doneAt: string | null
  createdAt: string
}

export type DraftChannel = 'email' | 'text' | 'linkedin'

export interface RelDraft {
  id: number
  personId: number
  touchKind: TouchKind
  channel: DraftChannel
  subject: string | null
  body: string
  overrodePitchGate: boolean
  sentByMeAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonDetail {
  person: Person
  interactions: Interaction[]
  promises: PersonPromise[]
  drafts: RelDraft[]
}

export interface DueItem {
  person: Person
  overdueDays: number
  /* The most recent interaction with their words or advice in it, else the most recent one. */
  lastInteraction: Interaction | null
  openPromises: PersonPromise[]
}

/* ---------- dates ---------- */

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00`)
  const b = new Date(`${to.slice(0, 10)}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/* ---------- scheduling ---------- */

/*
  The next touch for a person, from their stage, meeting date and last touch.
  After a meeting everything counts from the meeting day, so a late thank-you
  doesn't push the later touches out.
*/
export function nextTouch(p: Pick<Person, 'stage' | 'metOn' | 'lastTouchOn' | 'cadence'>, today = localDate()): { kind: TouchKind; on: string } | null {
  const c = { ...DEFAULT_CADENCE, ...p.cadence }
  const met = p.metOn ?? today
  const last = p.lastTouchOn ?? today
  switch (p.stage) {
    case 'identified': return { kind: 'first_contact', on: today }
    case 'first_contact': return { kind: 'follow_up', on: addDays(last, c.followUp) }
    case 'booked': return null // the meeting date is set by hand when booking
    case 'met': return { kind: 'thank_you', on: addDays(met, c.thankYou) }
    case 'thanked': return { kind: 'acted_on_advice', on: addDays(met, c.acted) }
    case 'acted_on_advice': return { kind: 'value_touch', on: addDays(met, c.value) }
    case 'value_touch': return { kind: 'invite_to_share', on: addDays(met, c.invite) }
    case 'invited_to_share': return { kind: 'pitch', on: addDays(last, c.checkIn) }
    case 'pitched': return { kind: 'check_in', on: addDays(last, c.checkIn) }
    default: return null
  }
}

export const stageIndex = (s: RelStage) => REL_STAGES.indexOf(s)

/* No pitching before they have been invited to share. */
export function pitchAllowed(stage: RelStage): boolean {
  return stageIndex(stage) >= stageIndex('invited_to_share') && !CLOSED_STAGES.includes(stage)
}

/* "What I promised to do" can hold several promises, one per line. */
export function splitPromises(text: string | null | undefined): string[] {
  if (!text) return []
  return text.split(/\n+|;\s+/).map((s) => s.replace(/^[-•*\d.)\s]+/, '').trim()).filter((s) => s.length > 2)
}

export const SIGN_OFF = 'Zak\nTally\ntallynz.co'

/* ---------- writing rules for relationship messages ---------- */

const CALENDAR_LINK = /calendly\.com|cal\.com\/|savvycal|tidycal|zcal\.co|youcanbook\.me|hubspot\.com\/meetings|book a (time|slot) (here|via|using)/i
const GUARANTEE = /\bguarantee[ds]?\b|agreed target|\b(hit|reach|meet) (a|the|your|an agreed) target\b|\bwe promise\b|\bresults? guaranteed\b/i
const APHORISMS = /(is everything\.?$|makes all the difference|that'?s the point|the rest follows|less is more|it all starts with|at the end of the day)/i
export const PITCH_OPT_OUT = "If you'd rather I didn't follow up on this, just say and I won't."

export function wordsIn(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

/*
  Every relationship draft: NZ English, short lines with blank lines between,
  no em dashes, exclamation marks, emoji or calendar links, no guarantee or
  "agreed target" language, plain sign-off "Zak / Tally / tallynz.co", no AI
  tells. Returns the problems; empty means it passes.
*/
export function lintRelationship(subject: string | null, body: string, opts: { channel: DraftChannel; touchKind: TouchKind }): string[] {
  const issues: string[] = []
  const text = `${subject ?? ''}\n${body}`
  const signed = body.trimEnd()
  const lines = signed.split('\n').map((l) => l.trim())
  const tail = lines.filter(Boolean).slice(opts.touchKind === 'pitch' ? -4 : -3)
  const signOffOk = opts.touchKind === 'pitch'
    ? tail.slice(0, 3).join('\n') === SIGN_OFF && tail[3] === PITCH_OPT_OUT
    : tail.join('\n') === SIGN_OFF
  if (!signOffOk) issues.push(`End with the sign-off on three lines: Zak / Tally / tallynz.co${opts.touchKind === 'pitch' ? ', then the opt-out line' : ''}.`)
  if (/[—–]/.test(text)) issues.push('Contains an em or en dash. Rewrite without it.')
  if (text.includes('!')) issues.push('Contains an exclamation mark.')
  if (/\p{Extended_Pictographic}/u.test(text)) issues.push('Contains an emoji.')
  if (CALENDAR_LINK.test(text)) issues.push('Contains a calendar link. Suggest a time in words instead.')
  if (GUARANTEE.test(text)) issues.push('Guarantee or target language. Tally makes no guarantees.')
  const lower = text.toLowerCase()
  for (const w of HYPE_WORDS.filter((h) => !/guarantee/.test(h))) if (lower.includes(w)) issues.push(`Hype word: "${w}".`)
  for (const [re, fix] of US_SPELLINGS) if (re.test(text)) issues.push(`US spelling, use NZ "${fix}…".`)
  if (opts.channel === 'email') {
    if (!subject?.trim()) issues.push('An email needs a subject.')
    else if (wordsIn(subject) >= 6) issues.push(`Subject is ${wordsIn(subject)} words. Keep it under six.`)
  }
  const content = signed.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && p !== SIGN_OFF && p !== PITCH_OPT_OUT)
  const words = content.reduce((n, p) => n + wordsIn(p), 0)
  if (words >= 150) issues.push(`${words} words. Keep it under 150.`)
  for (const p of content) {
    const sentences = p.split(/(?<=[.?])\s+/).filter(Boolean)
    if (sentences.length > 3 || wordsIn(p) > 55) { issues.push('A paragraph is too long. Use short lines with a blank line between them.'); break }
  }
  // AI tells: three clipped fragments in a row ("Simple. Clear. Done."), or a closing maxim.
  const sentences = content.join(' ').split(/(?<=[.?])\s+/).map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i + 2 < sentences.length; i++) {
    if ([0, 1, 2].every((k) => wordsIn(sentences[i + k]) <= 3)) { issues.push('Three clipped fragments in a row reads as AI. Write it as one plain sentence.'); break }
  }
  const lastLine = content[content.length - 1] ?? ''
  if (APHORISMS.test(lastLine)) issues.push('Ends on a slogan. Close with a plain line instead.')
  return issues
}
