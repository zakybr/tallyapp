/*
  Badly set-up businesses often have a site Google barely ranks, under a
  domain that adds a trade word to the name (AOMAS → aomasmarine.com).
  Guess those domains, keep the ones that resolve, and read each homepage
  title so the agent can confirm it is the right business. DNS lookups cost
  no search quota.
*/
import { lookup } from 'node:dns/promises'
import { robotsAllows, USER_AGENT } from '../audit/robots'

const STOP = new Set(['ltd', 'limited', 'the', 'and', 'nz', 'co', 'company', 'group', 'services', 'new', 'zealand'])
const TLDS = ['.co.nz', '.nz', '.com', '.net.nz']

export function tradeWords(vertical: string | null | undefined): string[] {
  const v = (vertical ?? '').toLowerCase()
  const out = new Set<string>()
  if (/marine|boat/.test(v)) ['marine', 'boats', 'boat', 'boating', 'outboards'].forEach((w) => out.add(w))
  if (/pool/.test(v)) ['pools', 'pool', 'spas', 'poolsandspas'].forEach((w) => out.add(w))
  if (/motorhome|caravan/.test(v)) ['motorhomes', 'rv', 'caravans', 'campers'].forEach((w) => out.add(w))
  if (/home|build/.test(v)) ['homes', 'builders', 'construction', 'build'].forEach((w) => out.add(w))
  if (/jet|ski|hire|venue|leisure/.test(v)) ['hire', 'jetski', 'rentals', 'venue', 'events'].forEach((w) => out.add(w))
  return [...out]
}

export function domainCandidates(name: string, vertical?: string | null, area?: string | null, extraWords: string[] = []): string[] {
  const words = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w))
  if (!words.length) return []
  const joined = words.join('')
  const bases = new Set<string>([joined, words.join('-')])
  if (words.length > 1) bases.add(words.map((w) => w[0]).join('')) // initials
  const extras = [...tradeWords(vertical), ...extraWords.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')), ...(area ? [area.toLowerCase().split(/\s+/)[0]] : []), 'nz']
  for (const w of extras) if (w && !words.includes(w)) { bases.add(joined + w); bases.add(`${joined}-${w}`) }
  const out: string[] = []
  for (const b of bases) for (const t of TLDS) out.push(b + t)
  return [...new Set(out)].slice(0, 80)
}

export interface DomainHit { domain: string; finalUrl: string | null; status: number | null; title: string | null; mentionsName: boolean; note?: string }

export async function findDomains(name: string, vertical?: string | null, area?: string | null, extraWords: string[] = [], signal?: AbortSignal): Promise<DomainHit[]> {
  const cands = domainCandidates(name, vertical, area, extraWords)
  const resolved: string[] = []
  // DNS in small batches; parked registrar pages still resolve, so we read the title next.
  for (let i = 0; i < cands.length; i += 10) {
    if (signal?.aborted) break
    const batch = cands.slice(i, i + 10)
    const r = await Promise.all(batch.map((d) => lookup(d).then(() => d).catch(() => null)))
    resolved.push(...(r.filter(Boolean) as string[]))
  }
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => !STOP.has(w))[0] ?? ''
  const hits: DomainHit[] = []
  for (const d of resolved.slice(0, 12)) {
    const url = `https://${d}/`
    const ok = await robotsAllows(url)
    if (!ok.allowed) { hits.push({ domain: d, finalUrl: null, status: null, title: null, mentionsName: false, note: ok.reason }); continue }
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(12_000) })
      const html = (await res.text()).slice(0, 200_000)
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
      const forSale = /domain (is )?for sale|buy this domain|parked/i.test(html)
      hits.push({ domain: d, finalUrl: res.url, status: res.status, title, mentionsName: !!key && html.toLowerCase().includes(key), note: forSale ? 'looks parked or for sale' : undefined })
    } catch (e) {
      hits.push({ domain: d, finalUrl: null, status: null, title: null, mentionsName: false, note: `resolves but no web response (${e instanceof Error ? e.message : e})` })
    }
  }
  return hits
}
