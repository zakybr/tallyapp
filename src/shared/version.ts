/* Compares dotted versions ("v0.10.2" > "0.9.9"). Pre-release suffixes are ignored. */
export function newerThan(candidate: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
  const a = parse(candidate)
  const b = parse(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

export type UpdateState =
  | { state: 'idle' | 'checking' | 'current'; current: string; checkedAt?: string }
  | { state: 'downloading'; current: string; version: string; notes: string; percent: number }
  | { state: 'ready'; current: string; version: string; notes: string }
  | { state: 'error'; current: string; message: string }
  | { state: 'unsupported'; current: string; message: string; releaseUrl: string }

export const UPDATE_REPO = 'zakybr/tallyapp'
