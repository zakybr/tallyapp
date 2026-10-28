/*
  Typed IPC. The renderer only ever sees `window.tally`, an object whose
  methods are exactly the keys of TallyApi. Main registers one handler per key.
*/
import type {
  Company, CompanyDetail, CompanyInput, CompanyPatch, Conflict, Contact, ContactInput, Job, JobLogEntry,
  GapType, Outreach, Revenue, Settings, Suppression, TodaySummary
} from './domain'

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

  today(): Promise<TodaySummary>

  exportCsv(): Promise<{ folder: string; files: string[] } | null>
  backup(): Promise<{ file: string } | null>
  revealPath(path: string): Promise<void>
}

export type ApiMethod = keyof TallyApi

/* Kept as a runtime list so preload can build the bridge without importing main. */
export const API_METHODS: ApiMethod[] = [
  'appInfo', 'listCompanies', 'companyGaps', 'getCompany', 'createCompany', 'updateCompany', 'deleteCompany', 'addNote',
  'upsertContact', 'deletePerson', 'updateOutreach', 'markSent', 'getSettings', 'saveSettings',
  'listSuppression', 'addSuppression', 'removeSuppression', 'listConflicts', 'addConflict', 'removeConflict',
  'listRevenue', 'addRevenue', 'removeRevenue', 'today', 'exportCsv', 'backup', 'revealPath'
]

export interface TallyEvents {
  'job:log': JobLogEntry
  'job:update': Job
  'data:changed': { table: string; companyId?: number }
  nav: { to: string }
}

export type EventName = keyof TallyEvents

export interface TallyBridge extends TallyApi {
  on<E extends EventName>(event: E, cb: (payload: TallyEvents[E]) => void): () => void
}
