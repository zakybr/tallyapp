/*
  Relationship reminders: a menu-bar tally of due touches, one notification
  each morning listing them, and open-at-login so the morning notice fires
  with no window open. Times are local (NZ).
*/
import { app, Menu, Notification, Tray, nativeImage } from 'electron'
import { readFileSync } from 'node:fs'
import tray1x from '../../../resources/tray@1x.png?asset'
import tray2x from '../../../resources/tray@2x.png?asset'
import { getRelRepo, getRepo } from '../context'
import { localDate } from '@shared/rules'
import { TOUCH_LABEL } from '@shared/relationships'

let tray: Tray | null = null
let timer: NodeJS.Timeout | null = null
let openTo: (hash: string) => void = () => {}

function icon(): Electron.NativeImage {
  const img = nativeImage.createEmpty()
  img.addRepresentation({ scaleFactor: 1, buffer: readFileSync(tray1x) })
  img.addRepresentation({ scaleFactor: 2, buffer: readFileSync(tray2x) })
  img.setTemplateImage(true)
  return img
}

/* Rebuild the menu-bar count and menu. Called after every relationships change. */
export function refreshReminders(): void {
  if (!tray || tray.isDestroyed()) return
  const due = getRelRepo().due()
  tray.setTitle(due.length ? ` ${due.length}` : '')
  tray.setToolTip(due.length ? `${due.length} relationship touch${due.length === 1 ? '' : 'es'} due` : 'Tally: nothing due')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: due.length ? `${due.length} touch${due.length === 1 ? '' : 'es'} due` : 'Nothing due today', enabled: false },
    ...due.slice(0, 12).map((d) => ({
      label: `${d.person.name}: ${d.person.nextTouchKind ? TOUCH_LABEL[d.person.nextTouchKind].split(':')[0].split(',')[0] : 'touch'}${d.overdueDays > 0 ? ` (${d.overdueDays}d late)` : ''}`,
      click: () => openTo(`#/person/${d.person.id}`)
    })),
    { type: 'separator' },
    { label: 'Open Relationships', click: () => openTo('#/relationships') },
    { label: 'Open Tally', click: () => openTo('') },
    { type: 'separator' },
    { label: 'Quit Tally', role: 'quit' }
  ]))
}

/* Fire the morning notification once a day, at or after the chosen time. */
function maybeNotify(): void {
  const repo = getRepo()
  const settings = repo.getSettings()
  const s = settings.reminders
  const today = localDate()
  if (!s.enabled || settings.remindersLastNotifiedOn === today) return
  const [h, m] = s.time.split(':').map(Number)
  const n = new Date()
  if (n.getHours() * 60 + n.getMinutes() < h * 60 + m) return
  const due = getRelRepo().due()
  repo.saveSettings({ remindersLastNotifiedOn: today })
  if (!due.length || !Notification.isSupported()) return
  const names = due.slice(0, 4).map((d) => d.person.name).join(', ')
  const note = new Notification({
    title: `${due.length} relationship touch${due.length === 1 ? '' : 'es'} due`,
    body: due.length > 4 ? `${names} and ${due.length - 4} more` : names,
    silent: false
  })
  note.on('click', () => openTo('#/relationships'))
  note.show()
}

export function applyLoginItem(): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: getRepo().getSettings().reminders.openAtLogin })
}

/* True when macOS launched Tally at login: start in the menu bar with no window. */
export function openedAtLogin(): boolean {
  return app.isPackaged && process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin === true
}

export function startReminders(open: (hash: string) => void): void {
  openTo = open
  if (process.platform === 'darwin' && !process.env.TALLY_E2E) {
    tray = new Tray(icon())
    tray.on('click', () => tray?.popUpContextMenu())
  }
  refreshReminders()
  applyLoginItem()
  if (timer) clearInterval(timer)
  // Check every minute: fires the morning notice and rolls the count over at midnight.
  timer = setInterval(() => { maybeNotify(); refreshReminders() }, 60_000)
  setTimeout(maybeNotify, 5_000)
}
