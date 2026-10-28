/*
  All SQL lives here. Takes an open better-sqlite3 handle so tests can run it
  against a temp file without Electron.
*/
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'
import {
  DEFAULT_SETTINGS, STAGES,
  type Activity, type ActivityKind, type Company, type CompanyDetail, type CompanyInput, type CompanyPatch,
  type Conflict, type Contact, type GapType, type ContactInput, type Debrief, type InstagramBenchmarkRow, type Job, type JobLogEntry,
  type Outreach, type OutreachKind, type ResearchRecord, type Revenue, type Score, type Settings, type Stage, type Suppression
} from '@shared/domain'
import { normaliseDomain } from '@shared/rules'

type Row = Record<string, unknown>

const now = () => new Date().toISOString()
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

function mapRow<T>(row: Row | undefined, json: string[] = [], bools: string[] = []): T {
  if (!row) return undefined as T
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    const key = camel(k)
    if (json.includes(key) && typeof v === 'string') out[key] = JSON.parse(v)
    else if (bools.includes(key)) out[key] = v === 1
    else out[key] = v
  }
  return out as T
}

const COMPANY_COLS = [
  'name', 'legalName', 'website', 'phone', 'address', 'area', 'vertical', 'googleListingUrl', 'stage', 'verdict',
  'verdictReason', 'nextStep', 'nextStepDue', 'monthlyValue', 'offsiteOnly', 'notes', 'source'
] as const

export function openDatabase(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function migrate(db: Database.Database): number[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)')
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version))
  const applied: number[] = []
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue
    db.transaction(() => {
      db.exec(m.sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, now())
    })()
    applied.push(m.version)
  }
  return applied
}

export class Repo {
  constructor(readonly db: Database.Database) {}

  /* ---------- companies ---------- */

  private toCompany = (r: Row | undefined) => mapRow<Company>(r, [], ['offsiteOnly'])

  listCompanies(): Company[] {
    return (this.db.prepare('SELECT * FROM companies ORDER BY updated_at DESC').all() as Row[]).map(this.toCompany)
  }

  getCompany(id: number): Company | null {
    return this.toCompany(this.db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Row) ?? null
  }

  createCompany(input: CompanyInput): Company {
    const t = now()
    const vals: Row = { stage: 'discovered', offsiteOnly: false, ...input }
    const cols = COMPANY_COLS.filter((c) => c in vals)
    const stmt = this.db.prepare(
      `INSERT INTO companies (${cols.map(snake).join(', ')}, domain, created_at, updated_at)
       VALUES (${cols.map(() => '?').join(', ')}, ?, ?, ?)`
    )
    const info = stmt.run(...cols.map((c) => sqlValue(vals[c])), normaliseDomain(input.website), t, t)
    const company = this.getCompany(Number(info.lastInsertRowid))!
    this.addActivity(company.id, 'note', input.source ? `Added to pipeline (${input.source.toLowerCase()})` : 'Added to pipeline')
    return company
  }

  updateCompany(id: number, patch: CompanyPatch): Company {
    const before = this.getCompany(id)
    if (!before) throw new Error(`Company ${id} not found`)
    const cols = COMPANY_COLS.filter((c) => c in patch)
    if (cols.length) {
      const sets = cols.map((c) => `${snake(c)} = ?`)
      const args = cols.map((c) => sqlValue((patch as Row)[c]))
      if ('website' in patch) { sets.push('domain = ?'); args.push(normaliseDomain(patch.website)) }
      this.db.prepare(`UPDATE companies SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...args, now(), id)
    }
    if (patch.stage && patch.stage !== before.stage) {
      this.addActivity(id, 'stage_change', `Stage: ${before.stage} → ${patch.stage}`)
    }
    return this.getCompany(id)!
  }

  deleteCompany(id: number): void {
    this.db.prepare('DELETE FROM companies WHERE id = ?').run(id)
  }

  /* Gap types per company, from research findings that carry one. */
  companyGaps(): Record<number, GapType[]> {
    const out: Record<number, GapType[]> = {}
    for (const r of this.db.prepare('SELECT DISTINCT company_id, gap_type FROM research_records WHERE gap_type IS NOT NULL AND verified = 1').all() as { company_id: number; gap_type: GapType }[]) {
      ;(out[r.company_id] ??= []).push(r.gap_type)
    }
    return out
  }

  stageCounts(): Record<Stage, number> {
    const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>
    for (const r of this.db.prepare('SELECT stage, COUNT(*) n FROM companies GROUP BY stage').all() as { stage: Stage; n: number }[]) {
      counts[r.stage] = r.n
    }
    return counts
  }

  detail(id: number): CompanyDetail | null {
    const company = this.getCompany(id)
    if (!company) return null
    return {
      company,
      contacts: this.listContacts(id),
      research: this.listResearch(id),
      score: this.latestScore(id),
      outreach: this.listOutreach(id),
      activities: this.listActivities(id),
      debriefs: (this.db.prepare('SELECT * FROM debriefs WHERE company_id = ? ORDER BY created_at DESC').all(id) as Row[]).map((r) => mapRow<Debrief>(r)),
      benchmark: this.listBenchmark(id)
    }
  }

  /* ---------- contacts ---------- */

  listContacts(companyId: number): Contact[] {
    return (this.db.prepare('SELECT * FROM contacts WHERE company_id = ? ORDER BY id').all(companyId) as Row[]).map((r) => mapRow<Contact>(r))
  }

  getContact(id: number): Contact | null {
    return mapRow<Contact>(this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Row) ?? null
  }

  upsertContact(input: ContactInput & { id?: number }): Contact {
    const fields = ['name', 'role', 'email', 'phone', 'emailSourceUrl', 'consentBasis'] as const
    if (input.id) {
      const cols = fields.filter((f) => f in input)
      if (cols.length) {
        this.db.prepare(`UPDATE contacts SET ${cols.map((c) => `${snake(c)} = ?`).join(', ')} WHERE id = ?`)
          .run(...cols.map((c) => sqlValue((input as Row)[c])), input.id)
      }
      return this.getContact(input.id)!
    }
    const info = this.db.prepare(
      'INSERT INTO contacts (company_id, name, role, email, phone, email_source_url, consent_basis, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(input.companyId, input.name ?? null, input.role ?? null, input.email?.trim().toLowerCase() ?? null, input.phone ?? null,
      input.emailSourceUrl ?? null, input.consentBasis ?? 'unknown', now())
    return this.getContact(Number(info.lastInsertRowid))!
  }

  /*
    Privacy Act 2020: "delete this person" removes the contact, every draft
    addressed to them, and scrubs their name and email from the timeline.
    A suppression entry (if they opted out) is kept so they are never
    contacted again; that is the minimum needed to honour the opt-out.
  */
  deletePerson(contactId: number): { removedDrafts: number } {
    const c = this.getContact(contactId)
    if (!c) return { removedDrafts: 0 }
    return this.db.transaction(() => {
      const drafts = this.db.prepare('DELETE FROM outreach WHERE contact_id = ?').run(contactId).changes
      const patterns = [c.email, c.phone, c.name]
        .filter((v): v is string => !!v && v.trim().length > 1)
        .map((v) => new RegExp(`(?<![\\w@.])${v.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w@])`, 'gi'))
      const scrub = (s: string) => patterns.reduce((out, re) => out.replace(re, '[removed]'), s)
      for (const a of this.listActivities(c.companyId)) {
        const next = scrub(a.summary)
        const nextOutcome = a.outcome ? scrub(a.outcome) : a.outcome
        if (next !== a.summary || nextOutcome !== a.outcome) {
          this.db.prepare('UPDATE activities SET summary = ?, outcome = ? WHERE id = ?').run(next, nextOutcome, a.id)
        }
      }
      for (const r of this.listResearch(c.companyId)) {
        const next = scrub(r.finding)
        if (next !== r.finding) this.db.prepare('UPDATE research_records SET finding = ? WHERE id = ?').run(next, r.id)
      }
      for (const d of this.db.prepare('SELECT id, raw_notes, summary, follow_up_draft FROM debriefs WHERE company_id = ?').all(c.companyId) as Row[]) {
        this.db.prepare('UPDATE debriefs SET raw_notes = ?, summary = ?, follow_up_draft = ? WHERE id = ?')
          .run(scrub(String(d.raw_notes)), scrub(String(d.summary)), d.follow_up_draft ? scrub(String(d.follow_up_draft)) : null, d.id)
      }
      for (const o of this.listOutreach(c.companyId)) {
        this.db.prepare('UPDATE outreach SET body = ?, subject = ? WHERE id = ?').run(scrub(o.body), o.subject ? scrub(o.subject) : null, o.id)
      }
      this.db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId)
      this.addActivity(c.companyId, 'note', 'A contact was deleted at their request (Privacy Act).')
      return { removedDrafts: drafts }
    })()
  }

  /* ---------- research ---------- */

  listResearch(companyId: number): ResearchRecord[] {
    return (this.db.prepare('SELECT * FROM research_records WHERE company_id = ? ORDER BY category, id').all(companyId) as Row[])
      .map((r) => mapRow<ResearchRecord>(r, ['pagesChecked'], ['verified']))
  }

  replaceResearch(companyId: number, jobId: string | null, records: Omit<ResearchRecord, 'id' | 'companyId' | 'jobId'>[]): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM research_records WHERE company_id = ?').run(companyId)
      const ins = this.db.prepare(
        `INSERT INTO research_records (company_id, category, finding, gap_type, source_url, pages_checked, screenshot_path, checked_at, verified, job_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const r of records) {
        ins.run(companyId, r.category, r.finding, r.gapType, r.sourceUrl, JSON.stringify(r.pagesChecked ?? []), r.screenshotPath,
          r.checkedAt, r.verified ? 1 : 0, jobId)
      }
    })()
  }

  addResearch(companyId: number, r: Omit<ResearchRecord, 'id' | 'companyId'>): void {
    this.db.prepare(
      `INSERT INTO research_records (company_id, category, finding, gap_type, source_url, pages_checked, screenshot_path, checked_at, verified, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(companyId, r.category, r.finding, r.gapType, r.sourceUrl, JSON.stringify(r.pagesChecked ?? []), r.screenshotPath, r.checkedAt, r.verified ? 1 : 0, r.jobId)
  }

  listBenchmark(companyId: number): InstagramBenchmarkRow[] {
    return (this.db.prepare('SELECT * FROM benchmarks WHERE company_id = ? ORDER BY is_prospect DESC, followers DESC').all(companyId) as Row[])
      .map((r) => mapRow<InstagramBenchmarkRow>(r, [], ['isProspect']))
  }

  replaceBenchmark(companyId: number, rows: InstagramBenchmarkRow[]): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM benchmarks WHERE company_id = ?').run(companyId)
      const ins = this.db.prepare(
        `INSERT INTO benchmarks (company_id, handle, is_prospect, followers, posts_last30, reels_share, avg_engagement, source_url, checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const b of rows) {
        ins.run(companyId, b.handle, b.isProspect ? 1 : 0, b.followers, b.postsLast30, b.reelsShare, b.avgEngagement, b.sourceUrl, b.checkedAt)
      }
    })()
  }

  /* ---------- scores ---------- */

  latestScore(companyId: number): Score | null {
    const r = this.db.prepare('SELECT * FROM scores WHERE company_id = ? ORDER BY id DESC LIMIT 1').get(companyId) as Row | undefined
    return r ? mapRow<Score>(r, ['gates', 'verifiedGaps', 'ruleOuts']) : null
  }

  saveScore(s: Omit<Score, 'id' | 'createdAt'>): Score {
    const info = this.db.prepare(
      'INSERT INTO scores (company_id, verdict, gates, verified_gaps, rule_outs, reason, first_call_question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(s.companyId, s.verdict, JSON.stringify(s.gates), JSON.stringify(s.verifiedGaps), JSON.stringify(s.ruleOuts), s.reason, s.firstCallQuestion, now())
    this.updateCompany(s.companyId, { verdict: s.verdict, verdictReason: s.reason })
    return mapRow<Score>(this.db.prepare('SELECT * FROM scores WHERE id = ?').get(info.lastInsertRowid) as Row, ['gates', 'verifiedGaps', 'ruleOuts'])
  }

  /* Pass reasons are kept so nobody researches the same company twice. */
  passedBefore(domain: string | null, name: string): { id: number; name: string; reason: string | null } | null {
    const r = this.db.prepare(
      `SELECT id, name, verdict_reason reason FROM companies WHERE verdict = 'pass' AND ((domain IS NOT NULL AND domain = ?) OR lower(name) = lower(?)) LIMIT 1`
    ).get(domain, name) as { id: number; name: string; reason: string | null } | undefined
    return r ?? null
  }

  /* ---------- outreach ---------- */

  listOutreach(companyId: number): Outreach[] {
    return (this.db.prepare('SELECT * FROM outreach WHERE company_id = ? ORDER BY kind, id DESC').all(companyId) as Row[]).map((r) => mapRow<Outreach>(r))
  }

  getOutreach(id: number): Outreach | null {
    return mapRow<Outreach>(this.db.prepare('SELECT * FROM outreach WHERE id = ?').get(id) as Row) ?? null
  }

  /* One current draft per kind per company: saving replaces the unsent one. */
  saveDraft(companyId: number, kind: OutreachKind, body: string, subject: string | null = null, contactId: number | null = null, filePath: string | null = null): Outreach {
    const t = now()
    const existing = this.db.prepare('SELECT id FROM outreach WHERE company_id = ? AND kind = ? AND sent_at IS NULL ORDER BY id DESC LIMIT 1').get(companyId, kind) as { id: number } | undefined
    if (existing) {
      this.db.prepare('UPDATE outreach SET body = ?, subject = ?, contact_id = ?, file_path = COALESCE(?, file_path), updated_at = ? WHERE id = ?')
        .run(body, subject, contactId, filePath, t, existing.id)
      return this.getOutreach(existing.id)!
    }
    const info = this.db.prepare(
      'INSERT INTO outreach (company_id, contact_id, kind, subject, body, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(companyId, contactId, kind, subject, body, filePath, t, t)
    return this.getOutreach(Number(info.lastInsertRowid))!
  }

  updateOutreach(id: number, patch: { body?: string; subject?: string | null; contactId?: number | null }): Outreach {
    const cur = this.getOutreach(id)
    if (!cur) throw new Error('Draft not found')
    this.db.prepare('UPDATE outreach SET body = ?, subject = ?, contact_id = ?, updated_at = ? WHERE id = ?')
      .run(patch.body ?? cur.body, patch.subject !== undefined ? patch.subject : cur.subject, patch.contactId !== undefined ? patch.contactId : cur.contactId, now(), id)
    return this.getOutreach(id)!
  }

  /* Zak sent it himself. This is a log entry, not a send. */
  markSent(id: number): Outreach {
    const o = this.getOutreach(id)
    if (!o) throw new Error('Draft not found')
    if (o.sentAt) return o
    this.db.prepare('UPDATE outreach SET sent_at = ? WHERE id = ?').run(now(), id)
    this.addActivity(o.companyId, 'email_sent', `Sent by me: ${o.subject ?? o.kind}`)
    return this.getOutreach(id)!
  }

  /* ---------- activities, debriefs ---------- */

  listActivities(companyId: number): Activity[] {
    return (this.db.prepare('SELECT * FROM activities WHERE company_id = ? ORDER BY at DESC, id DESC').all(companyId) as Row[]).map((r) => mapRow<Activity>(r))
  }

  addActivity(companyId: number, kind: ActivityKind, summary: string, outcome: string | null = null): void {
    this.db.prepare('INSERT INTO activities (company_id, kind, summary, outcome, at) VALUES (?, ?, ?, ?, ?)').run(companyId, kind, summary, outcome, now())
  }

  saveDebrief(d: Omit<Debrief, 'id' | 'createdAt'>): Debrief {
    const info = this.db.prepare(
      'INSERT INTO debriefs (company_id, raw_notes, summary, new_stage, next_step, next_step_due, follow_up_draft, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(d.companyId, d.rawNotes, d.summary, d.newStage, d.nextStep, d.nextStepDue, d.followUpDraft, now())
    return mapRow<Debrief>(this.db.prepare('SELECT * FROM debriefs WHERE id = ?').get(info.lastInsertRowid) as Row)
  }

  /* ---------- suppression, conflicts, revenue ---------- */

  listSuppression(): Suppression[] {
    return (this.db.prepare('SELECT * FROM suppression_list ORDER BY created_at DESC').all() as Row[]).map((r) => mapRow<Suppression>(r))
  }

  addSuppression(entry: { email?: string | null; domain?: string | null; reason: string }): void {
    this.db.prepare('INSERT OR IGNORE INTO suppression_list (email, domain, reason, created_at) VALUES (?, ?, ?, ?)')
      .run(entry.email?.trim().toLowerCase() || null, entry.domain?.trim().toLowerCase() || null, entry.reason, now())
  }

  removeSuppression(id: number): void {
    this.db.prepare('DELETE FROM suppression_list WHERE id = ?').run(id)
  }

  listConflicts(): Conflict[] {
    return (this.db.prepare('SELECT * FROM conflicts ORDER BY name').all() as Row[]).map((r) => mapRow<Conflict>(r))
  }

  addConflict(c: { name: string; domain?: string | null; note?: string | null }): void {
    this.db.prepare('INSERT INTO conflicts (name, domain, note, created_at) VALUES (?, ?, ?, ?)').run(c.name, normaliseDomain(c.domain) ?? null, c.note ?? null, now())
  }

  removeConflict(id: number): void {
    this.db.prepare('DELETE FROM conflicts WHERE id = ?').run(id)
  }

  listRevenue(): Revenue[] {
    return (this.db.prepare('SELECT * FROM revenue ORDER BY received_at DESC').all() as Row[]).map((r) => mapRow<Revenue>(r))
  }

  addRevenue(r: Omit<Revenue, 'id'>): void {
    this.db.prepare('INSERT INTO revenue (company_id, amount, kind, received_at, note) VALUES (?, ?, ?, ?, ?)').run(r.companyId, r.amount, r.kind, r.receivedAt, r.note)
  }

  removeRevenue(id: number): void {
    this.db.prepare('DELETE FROM revenue WHERE id = ?').run(id)
  }

  /* ---------- settings ---------- */

  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)])) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      rateCard: { ...DEFAULT_SETTINGS.rateCard, ...(stored.rateCard ?? {}) },
      sender: { ...DEFAULT_SETTINGS.sender, ...(stored.sender ?? {}) }
    }
  }

  saveSettings(patch: Partial<Settings>): Settings {
    const ins = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    this.db.transaction(() => {
      for (const [k, v] of Object.entries(patch)) ins.run(k, JSON.stringify(v))
    })()
    return this.getSettings()
  }

  /* ---------- jobs ---------- */

  saveJob(j: Job): void {
    this.db.prepare(
      `INSERT INTO jobs (id, kind, company_id, title, status, started_at, ended_at, duration_ms, input_tokens, output_tokens, cost_usd, turns, error)
       VALUES (@id, @kind, @companyId, @title, @status, @startedAt, @endedAt, @durationMs, @inputTokens, @outputTokens, @costUsd, @turns, @error)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, ended_at = excluded.ended_at, duration_ms = excluded.duration_ms,
         input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens, cost_usd = excluded.cost_usd, turns = excluded.turns, error = excluded.error`
    ).run(j)
  }

  listJobs(limit = 200): Job[] {
    return (this.db.prepare('SELECT * FROM jobs ORDER BY started_at DESC LIMIT ?').all(limit) as Row[]).map((r) => mapRow<Job>(r))
  }

  /* Jobs left "running" by a crash or quit are closed on startup. */
  closeOrphanJobs(): void {
    this.db.prepare(`UPDATE jobs SET status = 'cancelled', error = 'App closed while running', ended_at = ? WHERE status = 'running'`).run(now())
  }

  addLog(e: JobLogEntry): void {
    this.db.prepare('INSERT INTO job_logs (job_id, at, level, message, detail) VALUES (?, ?, ?, ?, ?)').run(e.jobId, e.at, e.level, e.message, e.detail ?? null)
  }

  jobLog(jobId: string): JobLogEntry[] {
    return (this.db.prepare('SELECT job_id, at, level, message, detail FROM job_logs WHERE job_id = ? ORDER BY id').all(jobId) as Row[]).map((r) => mapRow<JobLogEntry>(r))
  }

  /* ---------- export ---------- */

  tableRows(table: string): Row[] {
    if (!EXPORTABLE.includes(table)) throw new Error(`Not exportable: ${table}`)
    return this.db.prepare(`SELECT * FROM ${table}`).all() as Row[]
  }
}

export const EXPORTABLE = [
  'companies', 'contacts', 'research_records', 'benchmarks', 'scores', 'outreach', 'activities', 'debriefs',
  'suppression_list', 'conflicts', 'revenue', 'jobs'
]

function sqlValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === undefined) return null
  return v
}

export function toCsv(rows: Row[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
