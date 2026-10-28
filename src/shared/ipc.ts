/*
  Typed IPC. The renderer only ever sees `window.tally`, an object whose
  methods are exactly the keys of TallyApi. Main registers one handler per key.
*/
import type { JobLogEntry, Job } from './domain'

export interface AppInfo {
  version: string
  userDataPath: string
  platform: string
}

export interface TallyApi {
  appInfo(): Promise<AppInfo>
}

export type ApiMethod = keyof TallyApi

/* Kept as a runtime list so preload can build the bridge without importing main. */
export const API_METHODS: ApiMethod[] = ['appInfo']

export interface TallyEvents {
  'job:log': JobLogEntry
  'job:update': Job
  'data:changed': { table: string; companyId?: number }
  'nav': { to: string }
}

export type EventName = keyof TallyEvents

export interface TallyBridge extends TallyApi {
  on<E extends EventName>(event: E, cb: (payload: TallyEvents[E]) => void): () => void
}
