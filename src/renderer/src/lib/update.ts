import { useEffect, useState } from 'react'
import { api } from './api'
import type { UpdateState } from '@shared/version'

export function useUpdate(): UpdateState | undefined {
  const [s, setS] = useState<UpdateState>()
  useEffect(() => {
    void api.updateStatus().then(setS)
    return api.on('update:status', setS)
  }, [])
  return s
}

export async function restartToUpdate(runningJobs: number): Promise<void> {
  if (runningJobs > 0 && !window.confirm(`${runningJobs} agent job${runningJobs === 1 ? ' is' : 's are'} still running and will be cancelled. Restart now?`)) return
  await api.installUpdate()
}
