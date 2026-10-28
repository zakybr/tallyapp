import { ipcMain, BrowserWindow } from 'electron'
import type { TallyApi, EventName, TallyEvents } from '@shared/ipc'

export function handle<K extends keyof TallyApi>(name: K, fn: TallyApi[K]): void {
  ipcMain.handle(`tally:${name}`, (_event, ...args: unknown[]) =>
    (fn as (...a: unknown[]) => unknown)(...args)
  )
}

export function emit<E extends EventName>(event: E, payload: TallyEvents[E]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(`tally:${event}`, payload)
  }
}
