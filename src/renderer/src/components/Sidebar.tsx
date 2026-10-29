import { CalendarCheck, Search, Columns3, Bot, Settings as Cog, Download, RefreshCw, type LucideIcon } from 'lucide-react'
import { TallyMark } from './Tally'
import { Kbd } from './ui'
import { href, type Route } from '@/lib/router'
import { useUpdate, restartToUpdate } from '@/lib/update'
import { api } from '@/lib/api'
import type { UpdateState } from '@shared/version'

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

      <div className="mt-auto px-3 pb-3">
        <UpdateButton update={update} runningJobs={runningJobs} />
      </div>
      <div className="px-5 pb-5 text-[11px] leading-relaxed text-chrome-ink-3">
        <div className="text-chrome-ink-2">Tally Marketing Limited</div>
        Drafts only. Nothing sends itself.
      </div>
    </aside>
  )
}

/* Always visible: version, update state, and one click to check or install. */
function UpdateButton({ update, runningJobs }: { update: UpdateState | undefined; runningJobs: number }) {
  if (!update) return null
  if (update.state === 'ready') {
    return (
      <button onClick={() => void restartToUpdate(runningJobs)} className="no-drag flex w-full items-center gap-2.5 rounded-md bg-amber px-3 py-2.5 text-left text-on-amber hover:bg-amber-hover">
        <Download size={16} strokeWidth={2} />
        <span className="flex flex-col"><span className="text-[12.5px] font-semibold">Restart to update</span><span className="text-[11px] opacity-80">v{update.version} is ready</span></span>
      </button>
    )
  }
  if (update.state === 'downloading') {
    return (
      <div className="rounded-md border border-chrome-line bg-chrome-2 px-3 py-2.5">
        <div className="flex justify-between text-[12px] text-chrome-ink"><span>Downloading v{update.version}</span><span className="num">{update.percent}%</span></div>
        <div className="mt-1.5 h-1 overflow-hidden rounded bg-chrome-3"><div className="h-full bg-amber transition-[width]" style={{ width: `${update.percent}%` }} /></div>
      </div>
    )
  }
  const sub =
    update.state === 'checking' ? 'Checking…'
    : update.state === 'current' ? 'Up to date'
    : update.state === 'error' ? 'Check failed, try again'
    : update.state === 'unsupported' ? 'New version out: see Settings'
    : 'Check for updates'
  return (
    <button
      onClick={() => (update.state === 'unsupported' ? navigateTo('#/settings') : void api.checkForUpdates())}
      disabled={update.state === 'checking'}
      title={update.state === 'error' ? update.message : update.state === 'unsupported' ? update.message : 'Check GitHub for a new version'}
      className="no-drag flex w-full items-center gap-2.5 rounded-md border border-chrome-line bg-chrome-2 px-3 py-2 text-left hover:border-amber/60 hover:bg-chrome-3 disabled:opacity-70"
    >
      <RefreshCw size={15} strokeWidth={1.75} className={`shrink-0 ${update.state === 'checking' ? 'animate-spin text-amber' : update.state === 'error' ? 'text-[#ef7a62]' : 'text-chrome-ink-2'}`} />
      <span className="flex flex-col">
        <span className="text-[12.5px] font-medium text-chrome-ink">Check for updates</span>
        <span className="text-[11px] text-chrome-ink-3">v{update.current} · {sub}</span>
      </span>
    </button>
  )
}

const navigateTo = (h: string) => { window.location.hash = h }

