/*
  Minimal robots.txt support: fetch once per origin, honour the most
  specific group for our user agent (or *), longest-match Allow/Disallow.
*/
export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36 TallyAudit/1.0 (+https://tallynz.co)'
const UA_TOKEN = 'tallyaudit'

type Rule = { allow: boolean; path: string }
const cache = new Map<string, { rules: Rule[]; at: number }>()

/* Hosts we never fetch, whatever their robots.txt says: scraping them is off-limits. */
const BLOCKED = [/(^|\.)linkedin\.com$/i, /^maps\.google\./i, /^maps\.app\.goo\.gl$/i, /^goo\.gl$/i]
const BLOCKED_PATHS: [RegExp, RegExp][] = [[/(^|\.)google\.[a-z.]+$/i, /^\/maps/i]]

export function isBlockedHost(url: URL): string | null {
  if (BLOCKED.some((re) => re.test(url.hostname))) return `${url.hostname} is on the never-scrape list (LinkedIn, Google Maps).`
  if (BLOCKED_PATHS.some(([h, p]) => h.test(url.hostname) && p.test(url.pathname))) return 'Google Maps pages are never scraped. Use web search or the Places API.'
  return null
}

export function parseRobots(txt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  let cur: { agents: string[]; rules: Rule[] } | null = null
  let lastWasAgent = false
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur) }
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
    } else {
      lastWasAgent = false
      if (!cur) continue
      if (key === 'disallow' && val) cur.rules.push({ allow: false, path: val })
      if (key === 'allow' && val) cur.rules.push({ allow: true, path: val })
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && UA_TOKEN.includes(a)))
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'))
  return chosen.flatMap((g) => g.rules)
}

function matches(path: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
  return re.test(path)
}

export function allowedBy(rules: Rule[], path: string): boolean {
  let best: Rule | null = null
  for (const r of rules) {
    if (matches(path, r.path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r
  }
  return best ? best.allow : true
}

export async function robotsAllows(target: string): Promise<{ allowed: boolean; reason?: string }> {
  const url = new URL(target)
  const blocked = isBlockedHost(url)
  if (blocked) return { allowed: false, reason: blocked }
  const origin = url.origin
  let entry = cache.get(origin)
  if (!entry || Date.now() - entry.at > 3600_000) {
    let rules: Rule[] = []
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(10_000) })
      const type = res.headers.get('content-type') ?? ''
      // A 404 or an HTML error page means no rules.
      if (res.ok && !type.includes('html')) rules = parseRobots(await res.text())
    } catch {
      rules = []
    }
    entry = { rules, at: Date.now() }
    cache.set(origin, entry)
  }
  const ok = allowedBy(entry.rules, url.pathname + url.search)
  return ok ? { allowed: true } : { allowed: false, reason: `${origin}/robots.txt disallows ${url.pathname}` }
}

/* One request per host at a time, with a gap between them. */
const lastHit = new Map<string, number>()
export async function rateLimit(target: string, gapMs: number, signal?: AbortSignal): Promise<void> {
  const host = new URL(target).host
  const wait = (lastHit.get(host) ?? 0) + gapMs - Date.now()
  lastHit.set(host, Math.max(Date.now(), (lastHit.get(host) ?? 0) + gapMs))
  if (wait > 0) await new Promise<void>((res, rej) => {
    const t = setTimeout(res, wait)
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Cancelled')) }, { once: true })
  })
}
