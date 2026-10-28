import type { TallyBridge } from '../shared/ipc'
declare global {
  interface Window {
    tally: TallyBridge
  }
}
export {}
