/*
  Relationships SQL. Takes the same better-sqlite3 handle as Repo so tests
  can run it against a temp file. Every write re-plans the person's next
  touch from their stage and cadence unless Zak set the date by hand.
*/
import type Database from 'better-sqlite3'
import {
  CLOSED_STAGES, DEFAULT_CADENCE, TOUCH_TO_STAGE, daysBetween, nextTouch, splitPromises, stageIndex,
  type DraftChannel, type DueItem, type Interaction, type InteractionInput, type Person, type PersonDetail,
  type PersonInput, type PersonPatch, type PersonPromise, type RelDraft, type RelStage, type TouchKind
} from '@shared/relationships'
import { localDate } from '@shared/rules'

type Row = Record<string, unknown>
const now = () => new Date().toISOString()
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

function toPerson(r: Row): Person {
  return {
    id: r.id as number, name: r.name as string, role: r.role as string | null, companyId: r.company_id as number | null,
    companyName: (r.company_name as string | null) ?? null, phone: r.phone as string | null, phoneSource: r.phone_source as string | null,
    email: r.email as string | null, emailSourceUrl: r.email_source_url as string | null, linkedinUrl: r.linkedin_url as string | null,
    howMet: r.how_met as string | null, introducedBy: r.introduced_by as string | null, interests: r.interests as string | null,
    tags: JSON.parse(String(r.tags || '[]')), stage: r.stage as RelStage,
    cadence: { ...DEFAULT_CADENCE, ...JSON.parse(String(r.cadence || '{}')) },
    metOn: r.met_on as string | null, lastTouchOn: r.last_touch_on as string | null, nextTouchOn: r.next_touch_on as string | null,
    nextTouchKind: r.next_touch_kind as TouchKind | null, nextTouchManual: r.next_touch_manual === 1,
    pitchOverrideAt: r.pitch_override_at as string | null, externalIds: JSON.parse(String(r.external_ids || '{}')),
    createdAt: r.created_at as string, updatedAt: r.updated_at as string
  }
}

function mapRow<T>(r: Row): T {
  const out: Row = {}
  for (const [k, v] of Object.entries(r)) out[camel(k)] = v
  return out as T
}

const toDraft = (r: Row): RelDraft => ({ ...mapRow<RelDraft>(r), overrodePitchGate: r.overrode_pitch_gate === 1 })

const COLUMNS: Record<string, string> = {
  name: 'name', role: 'role', companyId: 'company_id', phone: 'phone', phoneSource: 'phone_source', email: 'email',
  emailSourceUrl: 'email_source_url', linkedinUrl: 'linkedin_url', howMet: 'how_met', introducedBy: 'introduced_by',
  interests: 'interests', tags: 'tags', stage: 'stage', cadence: 'cadence', metOn: 'met_on', lastTouchOn: 'last_touch_on',
  nextTouchOn: 'next_touch_on', nextTouchKind: 'next_touch_kind', nextTouchManual: 'next_touch_manual',
  pitchOverrideAt: 'pitch_override_at', externalIds: 'external_ids'
}
const JSON_COLS = new Set(['tags', 'cadence', 'externalIds'])

function value(k: string, v: unknown): unknown {
  if (JSON_COLS.has(k)) return JSON.stringify(v ?? (k === 'tags' ? [] : {}))
  if (typeof v === 'boolean') return v ? 1 : 0
  return v === undefined ? null : v
}

export class RelRepo {
  constructor(readonly db: Database.Database) {}

  private select = 'SELECT p.*, c.name AS company_name FROM people p LEFT JOIN companies c ON c.id = p.company_id'

  listPeople(): Person[] {
    return (this.db.prepare(`${this.select} ORDER BY p.updated_at DESC`).all() as Row[]).map(toPerson)
  }

  getPerson(id: number): Person | null {
    const r = this.db.prepare(`${this.select} WHERE p.id = ?`).get(id) as Row | undefined
    return r ? toPerson(r) : null
  }

  createPerson(input: PersonInput): Person {
    const t = now()
    const data: Record<string, unknown> = { stage: 'identified', ...input, email: input.email?.trim().toLowerCase() || null }
    const keys = Object.keys(data).filter((k) => k in COLUMNS)
    const info = this.db.prepare(
      `INSERT INTO people (${keys.map((k) => COLUMNS[k]).join(', ')}, created_at, updated_at) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`
    ).run(...keys.map((k) => value(k, data[k])), t, t)
    const id = Number(info.lastInsertRowid)
    this.reschedule(id)
    return this.getPerson(id)!
  }

  updatePerson(id: number, patch: PersonPatch): Person {
    // "Nothing planned" clears the date too, so they leave the Due list.
    if ('nextTouchKind' in patch && patch.nextTouchKind === null) patch = { ...patch, nextTouchOn: null }
    const keys = Object.keys(patch).filter((k) => k in COLUMNS && k !== 'nextTouchManual')
    if (keys.length) {
      this.db.prepare(`UPDATE people SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
        .run(...keys.map((k) => value(k, (patch as Record<string, unknown>)[k])), now(), id)
    }
    if ('nextTouchOn' in patch || 'nextTouchKind' in patch) {
      // Zak set the next touch himself: keep it until the next logged touch.
      this.db.prepare('UPDATE people SET next_touch_manual = 1 WHERE id = ?').run(id)
    } else if ('stage' in patch || 'cadence' in patch || 'metOn' in patch) {
      this.db.prepare('UPDATE people SET next_touch_manual = 0 WHERE id = ?').run(id)
      this.reschedule(id)
    }
    return this.getPerson(id)!
  }

  private reschedule(id: number): void {
    const p = this.getPerson(id)
    if (!p || p.nextTouchManual) return
    const n = nextTouch(p)
    this.db.prepare('UPDATE people SET next_touch_on = ?, next_touch_kind = ? WHERE id = ?').run(n?.on ?? null, n?.kind ?? null, id)
  }

  /*
    Logging an interaction records what they said, extracts promises and, if
    it was one of the planned touches, moves the stage forward (never back).
  */
  logInteraction(input: InteractionInput): { interaction: Interaction; person: Person } {
    return this.db.transaction(() => {
      const info = this.db.prepare(
        'INSERT INTO interactions (person_id, occurred_on, kind, touch_kind, notes, told_me, advice, promised, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(input.personId, input.occurredOn, input.kind, input.touchKind, input.notes, input.toldMe, input.advice, input.promised, now())
      const interactionId = Number(info.lastInsertRowid)
      for (const text of splitPromises(input.promised)) {
        this.db.prepare('INSERT INTO promises (person_id, interaction_id, text, created_at) VALUES (?, ?, ?, ?)').run(input.personId, interactionId, text, now())
      }
      const p = this.getPerson(input.personId)!
      const touch = input.touchKind ?? (input.kind === 'met' ? 'meeting' : null)
      const target = touch ? TOUCH_TO_STAGE[touch] : undefined
      const patch: Record<string, unknown> = {}
      if (!p.lastTouchOn || input.occurredOn >= p.lastTouchOn) patch.last_touch_on = input.occurredOn
      if (touch === 'meeting') patch.met_on = input.occurredOn
      if (target && stageIndex(target) > stageIndex(p.stage) && !CLOSED_STAGES.includes(p.stage)) patch.stage = target
      const keys = Object.keys(patch)
      this.db.prepare(`UPDATE people SET ${[...keys.map((k) => `${k} = ?`), 'next_touch_manual = 0', 'updated_at = ?'].join(', ')} WHERE id = ?`)
        .run(...keys.map((k) => patch[k]), now(), p.id)
      this.reschedule(p.id)
      return { interaction: this.getInteraction(interactionId)!, person: this.getPerson(p.id)! }
    })()
  }

  getInteraction(id: number): Interaction | null {
    const r = this.db.prepare('SELECT * FROM interactions WHERE id = ?').get(id) as Row | undefined
    return r ? mapRow<Interaction>(r) : null
  }

  listInteractions(personId: number): Interaction[] {
    return (this.db.prepare('SELECT * FROM interactions WHERE person_id = ? ORDER BY occurred_on DESC, id DESC').all(personId) as Row[]).map((r) => mapRow<Interaction>(r))
  }

  listPromises(personId: number): PersonPromise[] {
    return (this.db.prepare('SELECT * FROM promises WHERE person_id = ? ORDER BY done_at IS NOT NULL, id DESC').all(personId) as Row[]).map((r) => mapRow<PersonPromise>(r))
  }

  setPromiseDone(id: number, done: boolean): void {
    this.db.prepare('UPDATE promises SET done_at = ? WHERE id = ?').run(done ? now() : null, id)
  }

  saveDraft(d: { personId: number; touchKind: TouchKind; channel: DraftChannel; subject: string | null; body: string; overrodePitchGate: boolean }): RelDraft {
    const t = now()
    const info = this.db.prepare(
      'INSERT INTO relationship_drafts (person_id, touch_kind, channel, subject, body, overrode_pitch_gate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(d.personId, d.touchKind, d.channel, d.subject, d.body, d.overrodePitchGate ? 1 : 0, t, t)
    return this.getDraft(Number(info.lastInsertRowid))!
  }

  getDraft(id: number): RelDraft | null {
    const r = this.db.prepare('SELECT * FROM relationship_drafts WHERE id = ?').get(id) as Row | undefined
    return r ? toDraft(r) : null
  }

  listDrafts(personId: number): RelDraft[] {
    return (this.db.prepare('SELECT * FROM relationship_drafts WHERE person_id = ? ORDER BY id DESC').all(personId) as Row[]).map(toDraft)
  }

  updateDraft(id: number, patch: { subject?: string | null; body?: string }): RelDraft {
    const cur = this.getDraft(id)
    if (!cur) throw new Error('Draft not found')
    this.db.prepare('UPDATE relationship_drafts SET subject = ?, body = ?, updated_at = ? WHERE id = ?')
      .run(patch.subject !== undefined ? patch.subject : cur.subject, patch.body ?? cur.body, now(), id)
    return this.getDraft(id)!
  }

  /* Zak sent it himself. Logging the touch moves the stage on. */
  markDraftSent(id: number): Person {
    const d = this.getDraft(id)
    if (!d) throw new Error('Draft not found')
    if (!d.sentByMeAt) {
      this.db.prepare('UPDATE relationship_drafts SET sent_by_me_at = ? WHERE id = ?').run(now(), id)
      this.logInteraction({
        personId: d.personId, occurredOn: localDate(), kind: d.channel, touchKind: d.touchKind,
        notes: `Sent: ${d.subject ?? d.body.split('\n')[0]}`, toldMe: null, advice: null, promised: null
      })
    }
    return this.getPerson(d.personId)!
  }

  detail(id: number): PersonDetail | null {
    const person = this.getPerson(id)
    if (!person) return null
    return { person, interactions: this.listInteractions(id), promises: this.listPromises(id), drafts: this.listDrafts(id) }
  }

  /* Everyone whose next touch is today or earlier, most overdue first. */
  due(today = localDate()): DueItem[] {
    const rows = this.db.prepare(
      `${this.select} WHERE p.next_touch_on IS NOT NULL AND p.next_touch_kind IS NOT NULL AND p.next_touch_on <= ? AND p.stage NOT IN ('client', 'advisor_only', 'parked') ORDER BY p.next_touch_on`
    ).all(today) as Row[]
    return rows.map(toPerson).map((person) => ({
      person,
      overdueDays: daysBetween(person.nextTouchOn!, today),
      // The last conversation where they actually said something, so the notes are on screen when writing.
      lastInteraction: ((xs) => xs.find((i) => i.toldMe || i.advice) ?? xs[0] ?? null)(this.listInteractions(person.id)),
      openPromises: this.listPromises(person.id).filter((pr) => !pr.doneAt)
    }))
  }

  dueCount(today = localDate()): number {
    return (this.db.prepare(
      `SELECT COUNT(*) n FROM people WHERE next_touch_on IS NOT NULL AND next_touch_kind IS NOT NULL AND next_touch_on <= ? AND stage NOT IN ('client', 'advisor_only', 'parked')`
    ).get(today) as { n: number }).n
  }

  /* Privacy Act: erasing a person removes their interactions, promises and drafts (cascade). */
  erasePerson(id: number): void {
    this.db.prepare('DELETE FROM people WHERE id = ?').run(id)
  }

  /* Privacy Act IPP 6: everything held about one person. */
  personData(id: number): Record<string, unknown> | null {
    const d = this.detail(id)
    if (!d) return null
    return { exportedAt: now(), heldBy: 'Tally Marketing Limited, on one computer (local database, not shared).', purpose: 'Keeping in touch after asking for advice.', ...d }
  }
}
