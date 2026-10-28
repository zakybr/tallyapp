import { FlaskConical, Scale, Workflow, Square } from 'lucide-react'
import { Button } from '../ui'
import { TallyLoader } from '../Tally'
import { RunLog } from '../RunLog'
import { api } from '@/lib/api'
import { useJobs } from '@/lib/jobs'
import { navigate } from '@/lib/router'

export function useCompanyJob(companyId: number) {
  return useJobs().find((j) => j.companyId === companyId && j.status === 'running')
}

export function AgentButtons({ companyId, hasResearch }: { companyId: number; hasResearch: boolean }) {
  const running = useCompanyJob(companyId)
  if (running) return <Button variant="danger" onClick={() => void api.cancelJob(running.id)}><Square size={12} />Cancel {running.title.split(':')[0].toLowerCase()}</Button>
  return (
    <>
      <Button onClick={() => void api.startJob('research', { companyId, force: true })}><FlaskConical size={14} />{hasResearch ? 'Re-research' : 'Research'}</Button>
      {hasResearch && <Button onClick={() => void api.startJob('score', { companyId })}><Scale size={14} />Score</Button>}
      <Button variant="primary" onClick={() => void api.startJob('pipeline', { companyId })}><Workflow size={14} />Full workup</Button>
    </>
  )
}

export function LiveRun({ companyId }: { companyId: number }) {
  const running = useCompanyJob(companyId)
  if (!running) return null
  return (
    <section className="rise">
      <div className="mb-2 flex items-center justify-between">
        <TallyLoader label={`${running.title} · running`} />
        <button onClick={() => navigate({ name: 'agents', jobId: running.id })} className="text-[12px] text-amber-ink hover:underline">Open in Agents</button>
      </div>
      <RunLog jobId={running.id} className="h-56" />
    </section>
  )
}
