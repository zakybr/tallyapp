import type { Job } from '@shared/domain'

/* Live jobs by id. Filled in by the job runner (phase 3). */
export const live = new Map<string, { job: Job; abort: AbortController }>()

export function runningJobs(): Job[] {
  return [...live.values()].map((l) => l.job)
}
