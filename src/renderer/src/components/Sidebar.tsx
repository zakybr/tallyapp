import { CalendarCheck, Search, Columns3, Bot, Settings as Cog, type LucideIcon } from 'lucide-react'
import { TallyMark } from './Tally'
import { Kbd } from './ui'
import { href, type Route } from '@/lib/router'
import { useUpdate, restartToUpdate } from '@/lib/update'

const NAV: { route: Route; label: string; icon: LucideIcon; key: string }[] = [
  { route: { name: 'today' }, label: 'Today', icon: CalendarCheck, key: '1' },
  { route: { name: 'find' }, label: 'Find', icon: Search, key: '2' },
  { route: { name: 'pipeline' }, label: 'Pipeline', icon: Columns3, key: '3' },
  { route: { name: 'agents' }, label: 'Agents', icon: Bot, key: '4' },
  { route: { name: 'settings' }, label: 'Settings', icon: Cog, key: ',' }
]

export function Sidebar({ current, runningJobs, onPalette }: { current: Route['name']; runningJobs: number; onPalette: () => void }) {
  const update = useUpdate()
  return (
    <aside className="flex w-[212px] shrink-0 flex-col bg-chrome text-chrome-ink">
      <div className="drag flex h-[52px] items-center justify-end pr-4" />
      <div className="flex items-center gap-2.5 px-5 pb-6 pt-1">
        <TallyMark size={22} className="text-chrome-ink" />
        <span className="font-display text-[26px] font-bold lowercase leading-none tracking-tight">tally</span>
      </div>

      <button
        onClick={onPalette}
        className="no-drag mx-3 mb-5 flex h-8 items-center justify-between rounded-md border border-chrome-line bg-chrome-2 px-2.5 text-[12.5px] text-chrome-ink-3 hover:text-chrome-ink-2"
      >
        <span>Jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ route, label, icon: Icon, key }) => {
          const active = current === route.name || (route.name === 'pipeline' && current === 'prospect')
          return (
            <a
              key={label}
              href={href(route)}
              className={`group relative flex h-8.5 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors ${
                active ? 'bg-chrome-3 text-chrome-ink' : 'text-chrome-ink-2 hover:bg-chrome-2 hover:text-chrome-ink'
              }`}
            >
              {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-amber" />}
              <Icon size={16} strokeWidth={1.75} className={active ? 'text-amber' : ''} />
              <span className="flex-1">{label}</span>
              {label === 'Agents' && runningJobs > 0 && (
                <span className="num rounded bg-amber px-1.5 text-[12px] font-bold text-on-amber">{runningJobs}</span>
              )}
              <span className="font-mono text-[10px] text-chrome-ink-3 opacity-0 group-hover:opacity-100">⌘{key}</span>
            </a>
          )
        })}
      </nav>

      {update?.state === 'ready' && (
        <button onClick={() => void restartToUpdate(runningJobs)} className="no-drag mx-3 mt-auto mb-3 flex flex-col items-start rounded-md bg-amber px-3 py-2 text-left text-on-amber hover:bg-amber-hover">
          <span className="text-[12.5px] font-semibold">Restart to update</span>
          <span className="text-[11px] opacity-80">Version {update.version} is ready</span>
        </button>
      )}
      {update?.state === 'downloading' && <div className="mx-3 mt-auto mb-3 text-[11px] text-chrome-ink-3">Downloading {update.version}… {update.percent}%</div>}
      <div className={`${update?.state === 'ready' || update?.state === 'downloading' ? '' : 'mt-auto '}px-5 pb-5 text-[11px] leading-relaxed text-chrome-ink-3`}>
        <div className="text-chrome-ink-2">Tally Marketing Limited</div>
        Drafts only. Nothing sends itself.
      </div>
    </aside>
  )
}
