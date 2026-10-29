/*
  Typed IPC. The renderer only ever sees `window.tally`, an object whose
  methods are exactly the keys of TallyApi. Main registers one handler per key.
*/
import type {
  Company, CompanyDetail, CompanyInput, CompanyPatch, Conflict, Contact, ContactInput, Job, JobLogEntry,
  CallOutcome, GapType, JobKind, LeadCandidate, Outreach, Revenue, Settings, Suppression, TodaySummary, MoneyMove
} from './domain'
import type { UpdateState } from './version'

export interface AppInfo {
  version: string
  userDataPath: string
  platform: string
}

export interface TallyApi {
  appInfo(): Promise<AppInfo>

  listCompanies(): Promise<Company[]>
  companyGaps(): Promise<Record<number, GapType[]>>
  getCompany(id: number): Promise<CompanyDetail | null>
  createCompany(input: CompanyInput): Promise<Company>
  updateCompany(id: number, patch: CompanyPatch): Promise<Company>
  deleteCompany(id: number): Promise<void>
  addNote(companyId: number, text: string): Promise<void>

  upsertContact(input: ContactInput & { id?: number }): Promise<Contact>
  deletePerson(contactId: number): Promise<{ removedDrafts: number }>
  exportPerson(contactId: number): Promise<{ file: string } | null>
  runRetention(): Promise<{ companies: number; people: number }>

  updateOutreach(id: number, patch: { body?: string; subject?: string | null; contactId?: number | null }): Promise<Outreach>
  markSent(id: number): Promise<Outreach>

  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>

  listSuppression(): Promise<Suppression[]>
  addSuppression(entry: { email?: string | null; domain?: string | null; reason: string }): Promise<void>
  removeSuppression(id: number): Promise<void>
  listConflicts(): Promise<Conflict[]>
  addConflict(c: { name: string; domain?: string | null; note?: string | null }): Promise<void>
  removeConflict(id: number): Promise<void>
  listRevenue(): Promise<Revenue[]>
  addRevenue(r: Omit<Revenue, 'id'>): Promise<void>
  removeRevenue(id: number): Promise<void>
  listMoneyMoves(): Promise<MoneyMove[]>
  addMoneyMove(m: Omit<MoneyMove, 'id'>): Promise<void>
  removeMoneyMove(id: number): Promise<void>

  today(): Promise<TodaySummary>

  listLeadRuns(): Promise<{ id: number; jobId: string; category: string; area: string; leads: LeadCandidate[]; createdAt: string }[]>
  addLeads(leads: LeadCandidate[], vertical: string | null): Promise<number[]>

  startJob(kind: JobKind, payload: { companyId?: number; [k: string]: unknown }): Promise<Job>
  cancelJob(id: string): Promise<boolean>
  listJobs(): Promise<Job[]>
  jobLog(id: string): Promise<JobLogEntry[]>
  agentInfo(): Promise<{ skillsDir: string; executable: string | null; authMode: string }>

  exportCsv(): Promise<{ folder: string; files: string[] } | null>
  backup(): Promise<{ file: string } | null>
  revealPath(path: string): Promise<void>

  updateStatus(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  installUpdate(): Promise<void>
  openPath(path: string): Promise<void>

  /* Call mode: logs the call, and hands any notes to the Debrief Agent. */
  logCall(companyId: number, outcome: CallOutcome | null, notes: string): Promise<Job | null>
}

export type ApiMethod = keyof TallyApi

/* Kept as a runtime list so preload can build the bridge without importing main. */
export const API_METHODS: ApiMethod[] = [
  'appInfo', 'listCompanies', 'companyGaps', 'getCompany', 'createCompany', 'updateCompany', 'deleteCompany', 'addNote',
  'upsertContact', 'deletePerson', 'exportPerson', 'runRetention', 'updateOutreach', 'markSent', 'getSettings', 'saveSettings',
  'listSuppression', 'addSuppression', 'removeSuppression', 'listConflicts', 'addConflict', 'removeConflict',
  'listRevenue', 'addRevenue', 'removeRevenue', 'listMoneyMoves', 'addMoneyMove', 'removeMoneyMove', 'today', 'listLeadRuns', 'addLeads', 'startJob', 'cancelJob', 'listJobs', 'jobLog', 'agentInfo', 'exportCsv', 'backup', 'revealPath', 'updateStatus', 'checkForUpdates', 'installUpdate', 'openPath', 'logCall'
]

export interface TallyEvents {
  'job:log': JobLogEntry
  'job:update': Job
  'data:changed': { table: string; companyId?: number }
  nav: { to: string }
  'update:status': UpdateState
}

export type EventName = keyof TallyEvents

export interface TallyBridge extends TallyApi {
  on<E extends EventName>(event: E, cb: (payload: TallyEvents[E]) => void): () => void
}
