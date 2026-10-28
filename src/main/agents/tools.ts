/*
  Tally's in-process MCP tools. Every fetch goes through robots.txt and the
  never-scrape list; every save validates against the zod schema and hands
  the errors back to the agent so it can fix its output.
*/
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { getRepo, evidenceDir } from '../context'
import { realSettings } from '../secrets'
import { robotsAllows, rateLimit, USER_AGENT } from '../audit/robots'
import { auditSite, adsTransparency } from '../audit/siteAudit'
import { findDuplicate, normaliseDomain } from '@shared/rules'
import type { JobContext } from './runner'
import { findDomains } from './findDomain'

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (v: unknown): Result => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }] })
const fail = (msg: string): Result => ({ content: [{ type: 'text', text: msg }], isError: true })

function stripHtml(html: string): { title: string; description: string; text: string; links: { href: string; text: string }[] } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? ''
  const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 50)
    .map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) }))
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim()
  return { title, description, text: text.slice(0, 6000), links }
}

export function fetchPageTool(ctx: JobContext) {
  return tool(
    'fetch_page',
    'Fetch one public web page as text (title, description, visible text, links). Respects robots.txt and refuses LinkedIn and Google Maps. Use instead of guessing what a page says.',
    { url: z.string().describe('Full URL') },
    async ({ url }) => {
      try {
        const u = new URL(/^https?:/.test(url) ? url : `https://${url}`)
        const r = await robotsAllows(u.href)
        if (!r.allowed) return fail(`Not fetched: ${r.reason}. Record this as "not checked" with the URL so Zak can check it by hand.`)
        await rateLimit(u.href, 1200, ctx.signal)
        const res = await fetch(u.href, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
        const body = await res.text()
        return ok({ status: res.status, finalUrl: res.url, checkedAt: new Date().toISOString(), ...stripHtml(body) })
      } catch (e) {
        return fail(`Fetch failed: ${e instanceof Error ? e.message : e}`)
      }
    }
  )
}

export function siteAuditTool(ctx: JobContext, companyId: number) {
  return tool(
    'site_audit',
    'Audit a website with a real browser at desktop and 375px mobile: GA4/GTM/Meta pixel/old UA tags, forms and where they are, tap-to-call, mailto, schema, og:image, broken links, load problems, domain-for-sale, builder credit. Visits the homepage plus contact and booking pages (pass any you know in `pages`). Takes screenshots of every page. Respects robots.txt and rate-limits. Run it once per site.',
    { url: z.string(), pages: z.array(z.string()).optional().describe('Extra contact/booking/enquiry page URLs to check') },
    async ({ url, pages }) => {
      try {
        const s = realSettings(getRepo())
        const report = await auditSite({
          url, pages, dir: evidenceDir(companyId), gapMs: s.auditDelayMs, signal: ctx.signal,
          onPage: (u, v) => ctx.log('page', `audit ${v} ${u}`)
        })
        for (const i of report.issues) ctx.log('finding', `${i.kind.replace(/_/g, ' ')}: ${i.detail}`)
        // Compact view for the model: per-page essentials, then issues.
        return ok({
          checkedAt: report.checkedAt, robots: report.robots, pagesChecked: report.pagesChecked, summary: report.summary,
          issues: report.issues, brokenLinks: report.brokenLinks,
          pages: report.pages.map((p) => ({
            url: p.url, finalUrl: p.finalUrl, viewport: p.viewport, status: p.status, loadMs: p.loadMs, title: p.title, error: p.error, blockedReason: p.blockedReason,
            tags: p.tags, forms: p.forms, telLinks: p.telLinks, mailtoLinks: p.mailtoLinks, schemaTypes: p.schemaTypes, ogImage: p.ogImage,
            builderCredit: p.builderCredit, generator: p.generator, screenshot: p.screenshot
          }))
        })
      } catch (e) {
        return fail(`Audit failed: ${e instanceof Error ? e.message : e}`)
      }
    }
  )
}

export function adsTool(ctx: JobContext, companyId: number) {
  return tool(
    'ads_transparency_check',
    'Check paid activity. Loads the Google Ads Transparency Center for a domain (NZ) and screenshots it. Also returns the Meta Ad Library search URL: facebook.com disallows bots in robots.txt, so that one is a link for Zak to check by hand (record it unverified).',
    { domain: z.string().describe('e.g. aomas.co.nz'), businessName: z.string() },
    async ({ domain, businessName }) => {
      const meta = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=NZ&q=${encodeURIComponent(businessName)}&search_type=keyword_unordered`
      try {
        ctx.log('page', `Google Ads Transparency: ${domain}`)
        const g = await adsTransparency(normaliseDomain(domain) ?? domain, evidenceDir(companyId), ctx.signal)
        return ok({ checkedAt: new Date().toISOString(), google: g, metaAdLibrary: { url: meta, verified: false, note: 'robots.txt disallows automated access; manual check' } })
      } catch (e) {
        return ok({ google: { error: e instanceof Error ? e.message : String(e) }, metaAdLibrary: { url: meta, verified: false } })
      }
    }
  )
}

export function companiesOfficeTool() {
  return tool(
    'companies_office_link',
    'The NZ Companies Office register disallows automated access in robots.txt, so this returns the official search URL for Zak to click. Get the facts (company number, incorporation date, status, directors) from WebSearch results instead, and cite the register URL.',
    { name: z.string() },
    async ({ name }) => ok({
      searchUrl: `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=${encodeURIComponent(name)}&type=entities`,
      tip: `WebSearch: "${name}" site:app.companiesoffice.govt.nz  or  "${name}" NZBN`
    })
  )
}

export function findDomainTool(ctx: JobContext) {
  return tool(
    'find_domain',
    'Find the website of a business that ranks badly on Google. Guesses domains from the name plus trade words (AOMAS + marine → aomasmarine.com), area and TLDs (.co.nz .nz .com .net.nz), keeps those that resolve in DNS and returns each homepage title and whether it mentions the name. Costs no search quota: use it early, always before concluding a business cannot be found.',
    { name: z.string(), vertical: z.string().nullable().optional(), area: z.string().nullable().optional(), extraWords: z.array(z.string()).optional().describe('Other words seen with the name, e.g. "outboards", "engineering"') },
    async ({ name, vertical, area, extraWords }) => {
      ctx.log('tool', `find_domain ${name}${extraWords?.length ? ` + ${extraWords.join(', ')}` : ''}`)
      const hits = await findDomains(name, vertical, area, extraWords ?? [], ctx.signal)
      for (const h of hits.filter((x) => x.mentionsName)) ctx.log('finding', `Possible site: ${h.domain} · ${h.title ?? 'no title'}`)
      return ok(hits.length ? hits : 'No guessed domain resolved. Try other spellings, the legal name, or directories.')
    }
  )
}

export function pipelineCheckTool() {
  return tool(
    'check_pipeline',
    'Check whether a business is already in Tally\'s pipeline, was passed on before (with the reason), or matches the conflicts list. Call this for every candidate before including it.',
    { name: z.string(), website: z.string().nullable().optional(), phone: z.string().nullable().optional() },
    async ({ name, website, phone }) => {
      const repo = getRepo()
      const all = repo.listCompanies()
      const dup = findDuplicate({ name, website, phone }, all)
      const passed = repo.passedBefore(normaliseDomain(website), name)
      const d = normaliseDomain(website)
      const conflict = repo.listConflicts().find((c) => (d && c.domain === d) || c.name.toLowerCase() === name.toLowerCase())
      return ok({
        alreadyInPipeline: dup ? all.find((c) => c.id === dup)?.name : null,
        passedBefore: passed ? passed.reason : null,
        conflict: conflict ? conflict.name : null
      })
    }
  )
}

export function placesTool(ctx: JobContext) {
  return tool(
    'places_search',
    'Official Google Places API text search (only available because Zak added a Places key). Returns name, address, phone, website, rating, review count, business status and the Maps URL.',
    { query: z.string() },
    async ({ query }) => {
      const key = realSettings(getRepo()).placesApiKey
      if (!key) return fail('No Places API key in Settings.')
      ctx.log('tool', `Places API: ${query}`)
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri'
        },
        body: JSON.stringify({ textQuery: query, regionCode: 'NZ', pageSize: 20 }),
        signal: AbortSignal.timeout(20_000)
      })
      if (!res.ok) return fail(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return ok(await res.json())
    }
  )
}

/* A save_* tool: validates, then persists. Errors go back to the agent to fix. */
export function saveTool<S extends z.ZodObject>(name: string, description: string, schema: S, onSave: (v: z.infer<S>) => string | void | Promise<string | void>) {
  return tool(name, description, schema.shape, async (args) => {
    const parsed = schema.safeParse(args)
    if (!parsed.success) return fail(`Not saved. Fix these and call ${name} again:\n${z.prettifyError(parsed.error)}`)
    try {
      const msg = await onSave(parsed.data)
      return ok(msg ?? 'Saved.')
    } catch (e) {
      return fail(`Not saved: ${e instanceof Error ? e.message : e}`)
    }
  })
}
