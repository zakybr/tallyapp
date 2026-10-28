import { useCallback, useEffect, useRef, useState } from 'react'

export const api = window.tally

/*
  Tiny data hook: runs the loader, then re-runs it whenever main reports a
  change. `deps` re-keys the query (e.g. a company id).
*/
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; reload: () => void; loading: boolean } {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const ref = useRef(loader)
  ref.current = loader
  const reload = useCallback(() => {
    ref.current().then((d) => { setData(d); setLoading(false) }).catch((e) => { console.error(e); setLoading(false) })
  }, [])
  useEffect(() => {
    setLoading(true)
    reload()
    const off = api.on('data:changed', reload)
    const offJob = api.on('job:update', reload)
    return () => { off(); offJob() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, reload, loading }
}

export const nzd = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n)

export function ago(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function domainOf(url: string | null | undefined): string {
  if (!url) return ''
  try { return new URL(/^https?:/.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return url }
}

/* Screenshot paths live in the user data folder; the main process serves them. */
export const fileUrl = (path: string) => `tally-file://local/?p=${encodeURIComponent(path)}`
