import { useEffect, useState } from 'react'
import { ToastProvider } from './components/Toast'
import { useJobs } from './lib/jobs'
import { Sidebar } from './components/Sidebar'
import { useRoute, navigate } from './lib/router'
import { Today } from './screens/Today'
import { Find } from './screens/Find'
import { Pipeline } from './screens/Pipeline'
import { Prospect } from './screens/Prospect'
import { CallMode } from './screens/CallMode'
import { Agents } from './screens/Agents'
import { Settings } from './screens/Settings'
import { CommandPalette } from './components/CommandPalette'

export function App() {
  const route = useRoute()
  const [palette, setPalette] = useState(false)
  const running = useJobs().filter((j) => j.status === 'running').length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      const map: Record<string, string> = { '1': '#/today', '2': '#/find', '3': '#/pipeline', '4': '#/agents', ',': '#/settings' }
      if (map[e.key]) { e.preventDefault(); navigate(map[e.key]) }
      if (e.key === 'k') { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (route.name === 'call') return <ToastProvider><CallMode id={route.id} /></ToastProvider>

  return (
    <ToastProvider>
    <div className="flex h-full">
      <Sidebar current={route.name} runningJobs={running} onPalette={() => setPalette(true)} />
      <main className="relative my-2 mr-2 flex-1 overflow-hidden rounded-[10px] bg-paper shadow-[var(--shadow-sheet)]">
        <div className="drag absolute inset-x-0 top-0 h-6" />
        <div key={route.name === 'prospect' ? `p${route.id}` : route.name === 'agents' ? 'agents' : route.name} className="scroll-quiet h-full overflow-y-auto">
          {route.name === 'today' && <Today />}
          {route.name === 'find' && <Find />}
          {route.name === 'pipeline' && <Pipeline />}
          {route.name === 'prospect' && <Prospect id={route.id} />}
          {route.name === 'agents' && <Agents jobId={route.jobId} />}
          {route.name === 'settings' && <Settings />}
        </div>
      </main>
    </div>
    <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </ToastProvider>
  )
}
