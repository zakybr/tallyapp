import { it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditSite, closeAuditBrowser } from '../../src/main/audit/siteAudit'

it('audits a live site', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tally-audit-'))
  const r = await auditSite({ url: process.env.AUDIT_URL ?? 'https://www.whitepointerboats.co.nz', dir, gapMs: 1500, onPage: (u, v) => console.log('visit', v, u) })
  console.log(JSON.stringify({ pagesChecked: r.pagesChecked, summary: r.summary, issues: r.issues.map((i) => `${i.kind}: ${i.detail}`), broken: r.brokenLinks.length, dir }, null, 2))
  expect(r.pages.length).toBeGreaterThan(1)
  await closeAuditBrowser()
})
