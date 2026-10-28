import { useMemo } from 'react'
import { Square, Zap } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { TallyLoader, EmptyState } from '@/components/Tally'
import { RunLog } from '@/components/RunLog'
import { useJobs, fmtDuration, fmtTokens } from '@/lib/jobs'
import { api, useData, ago } from '@/lib/api'
import { navigate } from '@/lib/router'
import { JOB_LABEL, type Job } from '@shared/domain'

const STATUS: Record<Job['status'], string> = {
  running: 'text-amber-ink', done: 'text-go', failed: 'text-danger', cancelled: 'text-ink-3'
}

export function Agents({ jobId }: { jobId?: string }) {
  const jobs = useJobs()
  const { data: info } = useData(() => api.agentInfo())
  const selected = jobId ?? jobs[0]?.id
  const job = jobs.find((j) => j.id === selected)
  const totals = useMemo(() => {
    const since = Date.now() - 7 * 86400_000
    const week = jobs.filter((j) => new Date(j.startedAt).getTime() > since)
    return {
      runs: week.length,
      tokens: week.reduce((s, j) => s + j.inputTokens + j.outputTokens, 0),
      time: week.reduce((s, j) => s + (j.durationMs ?? 0), 0),
      cost: week.reduce((s, j) => s + (j.costUsd ?? 0), 0)
    }
  }, [jobs])
  const running = jobs.filter((j) => j.status === 'running')

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={info ? `${info.authMode === 'subscription' ? 'Claude Code login' : 'API key'} · skills in ${info.skillsDir}` : 'Agents'}
        title="Agents"
        actions={<>
          {running.length > 0 && <Button variant="danger" onClick={() => running.forEach((j) => void api.cancelJob(j.id))}><Square size={13} />Cancel all</Button>}
          <Button onClick={async () => { const j = await api.startJob('check', {}); navigate({ name: 'agents', jobId: j.id }) }}><Zap size={14} />Connection check</Button>
        </>}
      />
      <div className="grid grid-cols-4 border-b border-rule">
        {[
          ['Runs, last 7 days', String(totals.runs)],
          ['Tokens', fmtTokens(totals.tokens)],
          ['Agent time', fmtDuration(totals.time)],
          ['Est. cost (covered by plan)', `US$${totals.cost.toFixed(2)}`]
        ].map(([label, v]) => (
          <div key={label} className="border-r border-rule px-8 py-4 last:border-r-0">
            <div className="label">{label}</div>
            <div className="num mt-1 text-[30px] font-semibold leading-none">{v}</div>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No agent runs yet" body="Research a prospect, or run a connection check to make sure your Claude login works." />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)]">
          <ul className="scroll-quiet overflow-y-auto border-r border-rule">
            {jobs.map((j) => (
              <li key={j.id}>
                <a href={`#/agents/${j.id}`} className={`block border-b border-rule px-5 py-3 ${j.id === selected ? 'bg-paper-2' : 'hover:bg-paper-2/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{j.title}</span>
                    {j.status === 'running' ? <TallyLoader size={12} /> : <span className={`text-[11px] font-semibold uppercase tracking-wider ${STATUS[j.status]}`}>{j.status}</span>}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-[12px] tabular-nums text-ink-3">
                    <span>{JOB_LABEL[j.kind]}</span><span>{ago(j.startedAt)}</span><span>{fmtDuration(j.durationMs)}</span><span>{fmtTokens(j.inputTokens + j.outputTokens)} tok</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          <div className="flex min-h-0 flex-col gap-3 p-5">
            {job && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="display text-[22px]">{job.title}</div>
                  <div className="text-[12px] tabular-nums text-ink-3">
                    {JOB_LABEL[job.kind]} · {fmtDuration(job.durationMs ?? (job.status === 'running' ? Date.now() - new Date(job.startedAt).getTime() : null))} · {fmtTokens(job.inputTokens)} in / {fmtTokens(job.outputTokens)} out · {job.turns} turns{job.costUsd != null ? ` · est. US$${job.costUsd.toFixed(3)}` : ''}
                  </div>
                  {job.error && <div className="mt-1 text-[12.5px] text-danger">{job.error}</div>}
                </div>
                <div className="flex gap-2">
                  {job.companyId && <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'prospect', id: job.companyId! })}>Open prospect</Button>}
                  {job.status === 'running' && <Button size="sm" variant="danger" onClick={() => void api.cancelJob(job.id)}><Square size={12} />Cancel</Button>}
                </div>
              </div>
            )}
            <RunLog jobId={selected} className="min-h-0 flex-1" />
          </div>
        </div>
      )}
    </div>
  )
}
