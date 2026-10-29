import { app, dialog, shell, BrowserWindow } from 'electron'
import { join, resolve, sep } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { handle, emit } from './ipc'
import { getRepo, dataDir } from './context'
import { EXPORTABLE, toCsv } from './db/repo'
import { findDuplicate, localDate, monthlyRecurring, nextWorkingDay, trailing12, gstWarning, proposalCapCheck } from '@shared/rules'
import { CALL_OUTCOME_LABEL, type TodaySummary } from '@shared/domain'
import { runningJobs } from './agents/registry'
import { maskedSettings, saveSettingsSecure } from './secrets'
import { deleteCompanyFully, retentionSweep } from './privacy'
import { applyLoginItem, refreshReminders } from './relationships/reminders'
import { checkForUpdates, installUpdate, updateStatus } from './updater'
import { start } from './agents/jobs'
import './agents/research'
import './agents/prepare'
import { cancelJob } from './agents/runner'
import { claudeExecutable, skillsDir } from './agents/env'

const mainWindow = () => (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0])!
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

export function registerDataHandlers(): void {
  const repo = getRepo()
  const changed = (table: string, companyId?: number) => emit('data:changed', { table, companyId })

  handle('appInfo', async () => ({ version: app.getVersion(), userDataPath: dataDir(), platform: process.platform }))

  handle('listCompanies', async () => repo.listCompanies())
  handle('companyGaps', async () => repo.companyGaps())
  handle('getCompany', async (id) => repo.detail(id))
  handle('createCompany', async (input) => { const c = repo.createCompany(input); changed('companies', c.id); return c })
  handle('updateCompany', async (id, patch) => { const c = repo.updateCompany(id, patch); changed('companies', id); return c })
  handle('deleteCompany', async (id) => { deleteCompanyFully(repo, id); changed('companies', id) })
  handle('addNote', async (companyId, text) => { repo.addActivity(companyId, 'note', text); changed('activities', companyId) })

  handle('upsertContact', async (input) => { const c = repo.upsertContact(input); changed('contacts', c.companyId); return c })
  handle('deletePerson', async (contactId) => { const c = repo.getContact(contactId); const r = repo.deletePerson(contactId); changed('contacts', c?.companyId); return r })

  handle('updateOutreach', async (id, patch) => { const o = repo.updateOutreach(id, patch); changed('outreach', o.companyId); return o })
  handle('markSent', async (id) => { const o = repo.markSent(id); changed('outreach', o.companyId); return o })

  handle('getSettings', async () => maskedSettings(repo))
  handle('saveSettings', async (patch) => {
    const s = saveSettingsSecure(repo, patch)
    if (patch.reminders) { applyLoginItem(); refreshReminders() }
    changed('settings')
    return s
  })

  handle('listSuppression', async () => repo.listSuppression())
  handle('addSuppression', async (e) => { repo.addSuppression(e); changed('suppression') })
  handle('removeSuppression', async (id) => { repo.removeSuppression(id); changed('suppression') })
  handle('listConflicts', async () => repo.listConflicts())
  handle('addConflict', async (c) => { repo.addConflict(c); changed('conflicts') })
  handle('removeConflict', async (id) => { repo.removeConflict(id); changed('conflicts') })
  handle('listRevenue', async () => repo.listRevenue())
  handle('addRevenue', async (r) => { repo.addRevenue(r); changed('revenue') })
  handle('removeRevenue', async (id) => { repo.removeRevenue(id); changed('revenue') })
  handle('listMoneyMoves', async () => repo.listMoneyMoves())
  handle('addMoneyMove', async (m) => { repo.addMoneyMove(m); changed('money_moves') })
  handle('removeMoneyMove', async (id) => { repo.removeMoneyMove(id); changed('money_moves') })

  handle('today', async (): Promise<TodaySummary> => {
    const s = repo.getSettings()
    const all = repo.listCompanies()
    const today = localDate()
    const t12 = trailing12(repo.listRevenue())
    const due = (d: string | null) => !!d && d.slice(0, 10) <= today
    return {
      callsToMake: all.filter((c) => (c.stage === 'go' || c.stage === 'conversation') && !c.nextStepDue),
      followUpsDue: all.filter((c) => due(c.nextStepDue) && !['won', 'lost', 'pass'].includes(c.stage))
        .sort((a, b) => (a.nextStepDue ?? '').localeCompare(b.nextStepDue ?? '')),
      liveProposals: all.filter((c) => c.stage === 'proposal'),
      proposalCap: proposalCapCheck(all, s.proposalCap).cap,
      liveRetainers: all.filter((c) => c.stage === 'won').length,
      retainerTarget: s.retainerTarget,
      mrr: monthlyRecurring(all, s.rateCard.monthly),
      trailing12Revenue: t12,
      gstWarning: gstWarning(t12, s),
      gstThreshold: s.gstThreshold,
      runningJobs: runningJobs(),
      stageCounts: repo.stageCounts()
    }
  })

  handle('exportCsv', async () => {
    const pick = await dialog.showOpenDialog(mainWindow(), { title: 'Export CSV to…', properties: ['openDirectory', 'createDirectory'] })
    if (pick.canceled || !pick.filePaths[0]) return null
    const folder = join(pick.filePaths[0], `tally-export-${stamp()}`)
    mkdirSync(folder, { recursive: true })
    const files: string[] = []
    for (const t of EXPORTABLE) {
      const f = join(folder, `${t}.csv`)
      writeFileSync(f, toCsv(repo.tableRows(t)))
      files.push(f)
    }
    return { folder, files }
  })

  handle('backup', async () => {
    const pick = await dialog.showSaveDialog(mainWindow(), { title: 'Save full backup', defaultPath: `tally-backup-${stamp()}.db` })
    if (pick.canceled || !pick.filePath) return null
    await repo.db.backup(pick.filePath)
    return { file: pick.filePath }
  })

  handle('listLeadRuns', async () => repo.listLeadRuns())
  handle('addLeads', async (leads, vertical) => {
    const ids: number[] = []
    for (const l of leads) {
      const dup = findDuplicate(l, repo.listCompanies())
      if (dup) { ids.push(dup); continue }
      ids.push(repo.createCompany({
        name: l.name, website: l.website, phone: l.phone, address: l.address, googleListingUrl: l.googleListingUrl,
        area: l.area, vertical, notes: l.note, source: 'Lead Finder'
      }).id)
    }
    changed('companies')
    return ids
  })
  handle('startJob', async (kind, payload) => start(kind, payload))
  handle('cancelJob', async (id) => cancelJob(id))
  handle('listJobs', async () => {
    const running = runningJobs()
    const ids = new Set(running.map((j) => j.id))
    return [...running, ...repo.listJobs().filter((j) => !ids.has(j.id))]
  })
  handle('jobLog', async (id) => repo.jobLog(id))
  handle('agentInfo', async () => ({ skillsDir: skillsDir(), executable: claudeExecutable() ?? null, authMode: repo.getSettings().authMode }))
  handle('exportPerson', async (contactId) => {
    const data = repo.personData(contactId)
    if (!data) return null
    const who = String((data.contact as { name?: string | null; email?: string | null }).name ?? (data.contact as { email?: string | null }).email ?? 'person').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const pick = await dialog.showSaveDialog(mainWindow(), { title: 'Save their data (Privacy Act access request)', defaultPath: `privacy-request-${who}-${stamp()}.json` })
    if (pick.canceled || !pick.filePath) return null
    writeFileSync(pick.filePath, JSON.stringify(data, null, 2))
    return { file: pick.filePath }
  })
  handle('runRetention', async () => { const r = retentionSweep(repo); changed('contacts'); return r })
  handle('updateStatus', async () => updateStatus())
  handle('checkForUpdates', async () => checkForUpdates())
  handle('installUpdate', async () => installUpdate())
  handle('revealPath', async (p) => { shell.showItemInFolder(p) })
  // Only files Tally wrote (audits, evidence) can be opened from the renderer.
  handle('openPath', async (p) => {
    const full = resolve(p)
    if (!full.startsWith(resolve(dataDir()) + sep)) throw new Error('Not a Tally file')
    const err = await shell.openPath(full)
    if (err) throw new Error(err)
  })

  handle('logCall', async (companyId, outcome, notes) => {
    const c = repo.getCompany(companyId)
    if (!c) throw new Error('Company not found')
    const text = notes.trim()
    // The notes are kept on the timeline first, so a failed debrief never loses them.
    if (outcome || text) repo.addActivity(companyId, 'call', `Call: ${outcome ? CALL_OUTCOME_LABEL[outcome] : 'notes'}`, text || null)
    changed('activities', companyId)
    if (!text && (!outcome || outcome === 'no_answer')) {
      if (outcome === 'no_answer' && (!c.nextStepDue || c.nextStepDue.slice(0, 10) <= localDate())) {
        repo.updateCompany(companyId, { nextStep: 'Call again', nextStepDue: nextWorkingDay() })
        changed('companies', companyId)
      }
      return null
    }
    return start('debrief', { companyId, notes: text, outcome })
  })
}
