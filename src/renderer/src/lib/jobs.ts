import { useEffect, useState } from 'react'
import { api } from './api'
import type { Job, JobKind, JobLogEntry } from '@shared/domain'

/* All jobs, newest first, kept live from job:update events. */
export function useJobs(): Job[] {
  const [jobs, setJobs] = useState<Job[]>([])
  useEffect(() => {
    void api.listJobs().then(setJobs)
    return api.on('job:update', (j) => {
      setJobs((cur) => {
        const i = cur.findIndex((x) => x.id === j.id)
        if (i === -1) return [j, ...cur]
        const next = cur.slice()
        next[i] = j
        return next
      })
    })
  }, [])
  return jobs
}

export function useJobLog(jobId: string | undefined): JobLogEntry[] {
  const [log, setLog] = useState<JobLogEntry[]>([])
  useEffect(() => {
    if (!jobId) { setLog([]); return }
    let alive = true
    void api.jobLog(jobId).then((l) => alive && setLog(l))
    const off = api.on('job:log', (e) => { if (e.jobId === jobId) setLog((cur) => [...cur, e]) })
    return () => { alive = false; off() }
  }, [jobId])
  return log
}

export const fmtDuration = (ms: number | null) => {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
export const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n))

/* IPC errors arrive as "Error invoking remote method 'tally:x': Error: <message>". */
export const ipcMessage = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/*
  Starts a job. A compliance warning from main (guessed or unsourced email
  address) is shown as a confirm, and the job retried only if Zak agrees.
*/
export async function runJob(kind: JobKind, payload: { companyId?: number; [k: string]: unknown }, toast: (t: string, tone?: 'info' | 'warn' | 'error') => void): Promise<Job | null> {
  try {
    return await api.startJob(kind, payload)
  } catch (e) {
    const msg = ipcMessage(e)
    if (!msg.startsWith('Compliance check:')) { toast(msg, 'error'); return null }
    if (window.confirm(`${msg}\n\nDraft email to this address anyway? Nothing is sent: you decide later.`)) return runJob(kind, { ...payload, acknowledged: true }, toast)
    // Declining still prepares the opener, script and audit.
    if (kind === 'prepare') return runJob(kind, { ...payload, skipEmails: true }, toast)
    return null
  }
}
