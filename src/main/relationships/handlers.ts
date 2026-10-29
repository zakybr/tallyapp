import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'node:fs'
import { handle, emit } from '../ipc'
import { getRelRepo } from '../context'
import { refreshReminders } from './reminders'

const changed = (personId?: number) => {
  emit('data:changed', { table: 'people', companyId: personId })
  refreshReminders()
}

export function registerRelationshipHandlers(): void {
  const rel = getRelRepo()
  handle('listPeople', async () => rel.listPeople())
  handle('personDetail', async (id) => rel.detail(id))
  handle('createPerson', async (input) => { const p = rel.createPerson(input); changed(p.id); return p })
  handle('updatePerson', async (id, patch) => { const p = rel.updatePerson(id, patch); changed(id); return p })
  handle('erasePerson', async (id) => { rel.erasePerson(id); changed(id) })
  handle('exportPersonData', async (id) => {
    const data = rel.personData(id)
    if (!data) return null
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const name = String((data.person as { name: string }).name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const pick = await dialog.showSaveDialog(win, { title: 'Save their data (Privacy Act access request)', defaultPath: `privacy-request-${name}.json` })
    if (pick.canceled || !pick.filePath) return null
    writeFileSync(pick.filePath, JSON.stringify(data, null, 2))
    return { file: pick.filePath }
  })
  handle('logInteraction', async (input) => { const r = rel.logInteraction(input); changed(input.personId); return r.person })
  handle('setPromiseDone', async (id, done) => { rel.setPromiseDone(id, done); changed() })
  handle('relationshipsDue', async () => rel.due())
  handle('relationshipsDueCount', async () => rel.dueCount())
  handle('updateRelDraft', async (id, patch) => { const d = rel.updateDraft(id, patch); changed(d.personId); return d })
  handle('markRelDraftSent', async (id) => { const p = rel.markDraftSent(id); changed(p.id); return p })
}
