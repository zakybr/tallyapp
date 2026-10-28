import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { openDatabase, Repo } from './db/repo'

/* Process-wide singletons: one database, one repo. */
let repo: Repo | null = null

export function dataDir(): string {
  return app.getPath('userData')
}

export function evidenceDir(companyId: number): string {
  const dir = join(dataDir(), 'evidence', String(companyId))
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getRepo(): Repo {
  if (!repo) {
    mkdirSync(dataDir(), { recursive: true })
    repo = new Repo(openDatabase(join(dataDir(), 'tally.db')))
    repo.closeOrphanJobs()
  }
  return repo
}
