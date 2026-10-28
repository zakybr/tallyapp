/*
  Playwright site audit. Visits the homepage plus contact and booking pages
  at desktop and 375px, records tags, forms, contact links, schema, og:image,
  broken links and load problems, and screenshots every page and issue.
  Respects robots.txt and rate-limits per host.
*/
import { chromium, type Browser, type Page, type Request } from 'playwright'
import { join } from 'node:path'
import { robotsAllows, rateLimit, USER_AGENT } from './robots'

export interface PageAudit {
  url: string
  finalUrl: string
  viewport: 'desktop' | 'mobile'
  status: number | null
  loadMs: number | null
  title: string
  blockedReason?: string
  error?: string
  tags: { ga4: string[]; gtm: string[]; ua: string[]; metaPixel: boolean; tiktokPixel: boolean }
  forms: { action: string; method: string; fields: number; hasEmailField: boolean; errorText: string | null }[]
  telLinks: string[]
  mailtoLinks: string[]
  schemaTypes: string[]
  ogImage: string | null
  metaDescription: string | null
  generator: string | null
  builderCredit: string | null
  forSale: boolean
  horizontalOverflow: boolean
  consoleErrors: string[]
  screenshot: string | null
}

export interface AuditIssue {
  page: string
  kind: string
  detail: string
  screenshot: string | null
}

export interface SiteAuditReport {
  startUrl: string
  checkedAt: string
  robots: string
  pagesChecked: string[]
  pages: PageAudit[]
  brokenLinks: { url: string; status: number | string; foundOn: string }[]
  issues: AuditIssue[]
  summary: {
    ga4: boolean
    gtm: boolean
    metaPixel: boolean
    uaOnly: boolean
    contactFormPages: string[]
    tapToCallOnMobile: boolean
    schema: boolean
    ogImage: boolean
    redirectsToOtherDomain: string | null
    builtWith: string | null
  }
}

let browser: Browser | null = null
let idle: NodeJS.Timeout | null = null

async function getBrowser(): Promise<Browser> {
  if (idle) clearTimeout(idle)
  if (!browser || !browser.isConnected()) {
    try {
      browser = await chromium.launch({ headless: true })
    } catch (e) {
      throw new Error(`Could not start Chromium for the site audit. Run "npx playwright install chromium" once. (${e instanceof Error ? e.message.split('\n')[0] : e})`)
    }
  }
  return browser
}

function releaseBrowser(): void {
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => { void browser?.close(); browser = null }, 120_000)
}

export async function closeAuditBrowser(): Promise<void> {
  await browser?.close()
  browser = null
}

const CONTACT_RE = /contact|get-in-touch|enquir|inquir|book|quote|reserv|hire|appointment/i
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const slug = (u: string) => (new URL(u).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home').slice(0, 60)

function tagsFrom(requests: string[], html: string) {
  const all = requests.join('\n') + '\n' + html
  const uniq = (re: RegExp) => [...new Set([...all.matchAll(re)].map((m) => m[1]))]
  return {
    ga4: uniq(/[?&](?:id|tid)=(G-[A-Z0-9]{4,})/g).concat(uniq(/['"](G-[A-Z0-9]{6,})['"]/g)).filter((v, i, a) => a.indexOf(v) === i),
    gtm: uniq(/(GTM-[A-Z0-9]{4,})/g),
    ua: uniq(/(UA-\d{4,}-\d+)/g),
    metaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|facebook\.com\/tr\?|fbq\(\s*['"]init/.test(all),
    tiktokPixel: /analytics\.tiktok\.com/.test(all)
  }
}

async function auditPage(b: Browser, url: string, viewport: 'desktop' | 'mobile', dir: string, gapMs: number, signal?: AbortSignal): Promise<PageAudit> {
  const base: PageAudit = {
    url, finalUrl: url, viewport, status: null, loadMs: null, title: '', tags: { ga4: [], gtm: [], ua: [], metaPixel: false, tiktokPixel: false },
    forms: [], telLinks: [], mailtoLinks: [], schemaTypes: [], ogImage: null, metaDescription: null, generator: null, builderCredit: null,
    forSale: false, horizontalOverflow: false, consoleErrors: [], screenshot: null
  }
  const robots = await robotsAllows(url)
  if (!robots.allowed) return { ...base, blockedReason: robots.reason }
  await rateLimit(url, gapMs, signal)

  const ctx = await b.newContext(
    viewport === 'mobile'
      ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: USER_AGENT.replace('Macintosh; Intel Mac OS X 14_0', 'iPhone; CPU iPhone OS 18_0 like Mac OS X') + ' Mobile' }
      : { viewport: { width: 1366, height: 900 }, userAgent: USER_AGENT }
  )
  const page: Page = await ctx.newPage()
  const requests: string[] = []
  page.on('request', (r: Request) => requests.push(r.url()))
  page.on('console', (m) => { if (m.type() === 'error' && base.consoleErrors.length < 8) base.consoleErrors.push(m.text().slice(0, 200)) })
  try {
    const t0 = Date.now()
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30_000 })
    base.loadMs = Date.now() - t0
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {})
    base.status = res?.status() ?? null
    base.finalUrl = page.url()
    const html = await page.content()
    const info = await page.evaluate(() => {
      const q = (s: string) => Array.from(document.querySelectorAll(s))
      const text = document.body?.innerText ?? ''
      const footer = (document.querySelector('footer')?.innerText ?? text.slice(-1500))
      const credit = footer.match(/(?:website|site|web design|designed|built|developed|powered)\s+(?:by|with)\s+[^\n|·]{2,60}/i)
      const types: string[] = []
      for (const s of q('script[type="application/ld+json"]')) {
        try {
          const j = JSON.parse(s.textContent || 'null')
          const walk = (o: unknown) => {
            if (Array.isArray(o)) o.forEach(walk)
            else if (o && typeof o === 'object') {
              const t = (o as Record<string, unknown>)['@type']
              if (t) types.push(...([] as string[]).concat(t as string))
              if ((o as Record<string, unknown>)['@graph']) walk((o as Record<string, unknown>)['@graph'])
            }
          }
          walk(j)
        } catch { /* ignore bad JSON-LD */ }
      }
      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
        generator: document.querySelector('meta[name="generator"]')?.getAttribute('content') ?? null,
        credit: credit ? credit[0].trim() : null,
        forSale: /(this domain|domain name) (is|may be) for sale|buy this domain|domain is parked|parked free/i.test(text),
        tel: q('a[href^="tel:"]').map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
        mailto: q('a[href^="mailto:"]').map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
        links: q('a[href]').map((a) => ({ href: (a as HTMLAnchorElement).href, text: ((a as HTMLElement).innerText || '').trim().slice(0, 60) })),
        forms: q('form').map((f) => {
          const form = f as HTMLFormElement
          const errEl = form.querySelector('[class*="error" i], [role="alert"]') as HTMLElement | null
          const near = (form.parentElement?.innerText ?? '').match(/(ERROR for site owner[^\n]*|not configured[^\n]*|invalid (?:site )?key[^\n]*|form (?:is )?(?:disabled|unavailable)[^\n]*)/i)
          return {
            action: form.getAttribute('action') || '',
            method: (form.getAttribute('method') || 'get').toLowerCase(),
            fields: form.querySelectorAll('input:not([type=hidden]), textarea, select').length,
            hasEmailField: !!form.querySelector('input[type=email], input[name*="mail" i]'),
            errorText: near ? near[0].slice(0, 160) : errEl && errEl.offsetParent && errEl.innerText.trim() ? errEl.innerText.trim().slice(0, 160) : null
          }
        }).filter((f) => f.fields > 0),
        iframeForms: q('iframe[src*="form"], iframe[src*="jotform"], iframe[src*="typeform"], iframe[src*="hubspot"]').length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        schemaTypes: types
      }
    })
    base.title = info.title
    base.metaDescription = info.metaDescription
    base.ogImage = info.ogImage
    base.generator = info.generator
    base.builderCredit = info.credit
    base.forSale = info.forSale
    base.telLinks = [...new Set(info.tel)]
    base.mailtoLinks = [...new Set(info.mailto)]
    base.forms = info.forms
    if (info.iframeForms && !info.forms.length) base.forms.push({ action: 'embedded iframe form', method: 'post', fields: 1, hasEmailField: false, errorText: null })
    base.horizontalOverflow = viewport === 'mobile' && info.overflow
    base.schemaTypes = [...new Set(info.schemaTypes)]
    base.tags = tagsFrom(requests, html)
    ;(base as PageAudit & { _links?: typeof info.links })._links = info.links
    const file = join(dir, `${viewport}-${slug(base.finalUrl)}.png`)
    await page.screenshot({ path: file, fullPage: false })
    base.screenshot = file
  } catch (e) {
    base.error = e instanceof Error ? e.message.split('\n')[0] : String(e)
  } finally {
    await ctx.close()
  }
  return base
}

async function checkLinks(links: { url: string; foundOn: string }[], gapMs: number, signal?: AbortSignal) {
  const broken: SiteAuditReport['brokenLinks'] = []
  for (const l of links.slice(0, 30)) {
    if (signal?.aborted) break
    const r = await robotsAllows(l.url)
    if (!r.allowed) continue
    await rateLimit(l.url, Math.min(gapMs, 800), signal)
    try {
      let res = await fetch(l.url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) })
      if (res.status === 405 || res.status === 403) res = await fetch(l.url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) })
      if (res.status >= 400) broken.push({ url: l.url, status: res.status, foundOn: l.foundOn })
    } catch (e) {
      broken.push({ url: l.url, status: e instanceof Error ? e.name : 'error', foundOn: l.foundOn })
    }
  }
  return broken
}

export async function auditSite(opts: { url: string; pages?: string[]; dir: string; gapMs: number; signal?: AbortSignal; onPage?: (u: string, v: string) => void }): Promise<SiteAuditReport> {
  const start = /^https?:\/\//.test(opts.url) ? opts.url : `https://${opts.url}`
  const b = await getBrowser()
  try {
    const startRobots = await robotsAllows(start)
    const pages: PageAudit[] = []
    const visit = async (u: string) => {
      for (const v of ['desktop', 'mobile'] as const) {
        if (opts.signal?.aborted) throw new Error('Cancelled')
        opts.onPage?.(u, v)
        pages.push(await auditPage(b, u, v, opts.dir, opts.gapMs, opts.signal))
      }
    }
    await visit(start)
    const home = pages[0]
    const siteHost = host(home.finalUrl)
    const links = ((home as PageAudit & { _links?: { href: string; text: string }[] })._links ?? [])
    const internal = links.filter((l) => /^https?:/.test(l.href) && host(l.href) === siteHost)
    // Contact and booking pages: from the nav, plus the common paths. Gaps are only ever verified on these.
    const discovered = internal.filter((l) => CONTACT_RE.test(l.href) || CONTACT_RE.test(l.text)).map((l) => l.href.split('#')[0])
    const extra = (opts.pages ?? []).map((p) => (/^https?:/.test(p) ? p : new URL(p, home.finalUrl).href))
    const candidates = [...new Set([...extra, ...discovered])].filter((u) => u.replace(/\/$/, '') !== home.finalUrl.replace(/\/$/, '')).slice(0, 4)
    if (!candidates.some((u) => /contact/i.test(u)) && !home.error && !home.blockedReason) {
      const guess = new URL('/contact', home.finalUrl).href
      if (!candidates.includes(guess)) candidates.push(guess)
    }
    for (const u of candidates) await visit(u)

    const brokenLinks = await checkLinks(
      [...new Set(internal.map((l) => l.href.split('#')[0]))].filter((u) => !pages.some((p) => p.url === u)).map((url) => ({ url, foundOn: home.finalUrl })),
      opts.gapMs, opts.signal
    )
    for (const p of pages) if (p.status && p.status >= 400 && p.viewport === 'desktop') brokenLinks.push({ url: p.url, status: p.status, foundOn: 'direct visit' })

    const ok = pages.filter((p) => !p.error && !p.blockedReason && (p.status ?? 0) < 400)
    const any = (f: (p: PageAudit) => boolean) => ok.some(f)
    const issues: AuditIssue[] = []
    const add = (p: PageAudit, kind: string, detail: string) => issues.push({ page: p.finalUrl, kind, detail, screenshot: p.screenshot })
    for (const p of pages) {
      if (p.blockedReason) issues.push({ page: p.url, kind: 'not_checked', detail: p.blockedReason, screenshot: null })
      if (p.error) issues.push({ page: p.url, kind: 'load_error', detail: p.error, screenshot: null })
      if (p.forSale) add(p, 'domain_for_sale', 'Page text says the domain is for sale or parked.')
      for (const f of p.forms) if (f.errorText) add(p, 'form_error', `Form shows: "${f.errorText}"`)
      for (const t of p.telLinks) if (t.replace(/[^\d]/g, '').length < 7) add(p, 'broken_tel', `tel: link "${t}" has no valid number.`)
      for (const m of p.mailtoLinks) if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+/.test(m)) add(p, 'broken_mailto', `mailto: link "${m}" is malformed.`)
      if (p.horizontalOverflow) add(p, 'mobile_overflow', 'Page scrolls sideways at 375px.')
      if (p.viewport === 'desktop' && p.loadMs && p.loadMs > 8000) add(p, 'slow', `Took ${(p.loadMs / 1000).toFixed(1)}s to load.`)
      if (p.viewport === 'desktop' && p.consoleErrors.length >= 3) add(p, 'console_errors', `${p.consoleErrors.length} JavaScript errors.`)
    }
    const redirected = home.finalUrl && host(home.finalUrl) && host(home.finalUrl) !== host(start) ? home.finalUrl : null
    if (redirected) add(home, 'redirects_elsewhere', `${start} redirects to ${home.finalUrl}.`)
    const ga4 = any((p) => p.tags.ga4.length > 0)
    const gtm = any((p) => p.tags.gtm.length > 0)
    const metaPixel = any((p) => p.tags.metaPixel)
    const uaOnly = !ga4 && any((p) => p.tags.ua.length > 0)
    if (ok.length && !ga4 && !gtm) add(home, 'no_ga4', `No GA4 or Tag Manager found on ${ok.length} page loads checked.`)
    if (uaOnly) add(home, 'dead_ua', 'Only a Universal Analytics tag, which stopped collecting data in 2023.')
    if (ok.length && !metaPixel) add(home, 'no_meta_pixel', 'No Meta pixel on any page checked.')
    const mobileTel = ok.filter((p) => p.viewport === 'mobile').some((p) => p.telLinks.length > 0)
    if (ok.some((p) => p.viewport === 'mobile') && !mobileTel) add(home, 'no_tap_to_call', 'No tap-to-call link on any page at 375px.')
    const formPages = [...new Set(ok.filter((p) => p.forms.length > 0).map((p) => p.finalUrl))]
    const contactPagesChecked = ok.filter((p) => CONTACT_RE.test(p.finalUrl))
    if (ok.length && formPages.length === 0) add(contactPagesChecked[0] ?? home, 'no_form', `No enquiry form on the homepage or ${contactPagesChecked.length ? contactPagesChecked.map((p) => new URL(p.finalUrl).pathname).filter((v, i, a) => a.indexOf(v) === i).join(', ') : 'any contact page (none found)'}.`)
    if (ok.length && !any((p) => p.schemaTypes.length > 0)) add(home, 'no_schema', 'No structured data (schema.org JSON-LD).')
    if (ok.length && !any((p) => !!p.ogImage)) add(home, 'no_og_image', 'No og:image, so shared links show no picture.')
    for (const bl of brokenLinks) issues.push({ page: bl.foundOn, kind: 'broken_link', detail: `${bl.url} returned ${bl.status}`, screenshot: null })

    for (const p of pages) delete (p as PageAudit & { _links?: unknown })._links
    return {
      startUrl: start,
      checkedAt: new Date().toISOString(),
      robots: startRobots.allowed ? 'allowed' : startRobots.reason ?? 'disallowed',
      pagesChecked: [...new Set(pages.map((p) => p.finalUrl || p.url))],
      pages,
      brokenLinks,
      issues,
      summary: {
        ga4, gtm, metaPixel, uaOnly, contactFormPages: formPages, tapToCallOnMobile: mobileTel,
        schema: any((p) => p.schemaTypes.length > 0), ogImage: any((p) => !!p.ogImage), redirectsToOtherDomain: redirected,
        builtWith: home.builderCredit ?? home.generator
      }
    }
  } finally {
    releaseBrowser()
  }
}

/* Google Ads Transparency Center has no robots.txt restrictions; load it and read the result. */
export async function adsTransparency(domain: string, dir: string, signal?: AbortSignal): Promise<{ url: string; result: string; adCount: number | null; screenshot: string | null }> {
  const url = `https://adstransparency.google.com/?region=NZ&domain=${encodeURIComponent(domain)}`
  const b = await getBrowser()
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, userAgent: USER_AGENT })
  try {
    if (signal?.aborted) throw new Error('Cancelled')
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(6000)
    const text = await page.evaluate(() => document.body.innerText)
    const m = text.match(/(\d[\d,]*)\s+ads?\b/i)
    const none = /no ads|didn'?t find any|0 ads/i.test(text)
    const file = join(dir, `ads-transparency-${domain.replace(/[^a-z0-9]+/gi, '-')}.png`)
    await page.screenshot({ path: file })
    return { url, result: none ? 'No ads found for this domain in NZ.' : m ? `${m[1]} ads listed.` : 'Page loaded; result unclear, check the screenshot.', adCount: none ? 0 : m ? Number(m[1].replace(/,/g, '')) : null, screenshot: file }
  } finally {
    await ctx.close()
    releaseBrowser()
  }
}
