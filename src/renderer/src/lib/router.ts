import { useEffect, useState } from 'react'

/* Hash routing: #/today, #/prospect/12, #/call/12. Enough for one window. */
export type Route =
  | { name: 'today' }
  | { name: 'find' }
  | { name: 'pipeline' }
  | { name: 'prospect'; id: number }
  | { name: 'call'; id: number }
  | { name: 'agents'; jobId?: string }
  | { name: 'settings' }
  | { name: 'relationships'; tab?: 'due' | 'board' | 'people' }
  | { name: 'person'; id: number }

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  switch (parts[0]) {
    case 'find': return { name: 'find' }
    case 'pipeline': return { name: 'pipeline' }
    case 'prospect': return { name: 'prospect', id: Number(parts[1]) }
    case 'call': return { name: 'call', id: Number(parts[1]) }
    case 'agents': return { name: 'agents', jobId: parts[1] }
    case 'settings': return { name: 'settings' }
    case 'relationships': return { name: 'relationships', tab: (parts[1] as 'due' | 'board' | 'people') || undefined }
    case 'person': return { name: 'person', id: Number(parts[1]) }
    default: return { name: 'today' }
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'prospect': return `#/prospect/${r.id}`
    case 'call': return `#/call/${r.id}`
    case 'agents': return r.jobId ? `#/agents/${r.jobId}` : '#/agents'
    case 'relationships': return r.tab ? `#/relationships/${r.tab}` : '#/relationships'
    case 'person': return `#/person/${r.id}`
    default: return `#/${r.name}`
  }
}

export function navigate(r: Route | string): void {
  window.location.hash = typeof r === 'string' ? r : href(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
