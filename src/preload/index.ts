import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, type EventName, type TallyBridge } from '../shared/ipc'

const bridge: Record<string, unknown> = {}
for (const method of API_METHODS) {
  bridge[method] = (...args: unknown[]) => ipcRenderer.invoke(`tally:${method}`, ...args)
}
bridge.on = (event: EventName, cb: (payload: unknown) => void) => {
  const listener = (_e: unknown, payload: unknown) => cb(payload)
  ipcRenderer.on(`tally:${event}`, listener)
  return () => ipcRenderer.removeListener(`tally:${event}`, listener)
}

contextBridge.exposeInMainWorld('tally', bridge as unknown as TallyBridge)
