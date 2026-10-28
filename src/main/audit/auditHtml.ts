/*
  The one-page audit as HTML, laid out per the tally-audit-pdf skill.
  Pure (no Electron) so it is unit tested; pdf.ts prints it to A4.
*/
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AuditContent } from '@shared/schemas'

export interface AuditMeta {
  businessName: string
  date: string
  sender: { name: string; company: string; phone: string; email: string; website: string }
  fonts: { display: string; sans: string; sansBold: string }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fileHref = (p: string) => pathToFileURL(p).href
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') + new URL(u).pathname.replace(/\/$/, '') } catch { return u } }
const day = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* Tally mark geometry from the tallynz.co lockup. Do not redraw. */
const MARK = `<svg width="30" height="28" viewBox="0 0 26 24" fill="none" aria-hidden="true">${[3, 9.5, 16, 22.5].map((x) => `<line x1="${x}" y1="3" x2="${x}" y2="21" stroke="#ece7dc" stroke-width="2.5"/>`).join('')}<line x1="-0.5" y1="19" x2="25.5" y2="5" stroke="#f0a52c" stroke-width="2.5"/></svg>`

export function buildAuditHtml(c: AuditContent, m: AuditMeta): string {
  const findings = c.findings.map((f, i) => `
    <article class="finding${f.screenshotPath ? ' has-shot' : ''}">
      <div class="n">${i + 1}</div>
      <div class="text">
        <h3>${esc(f.headline)}</h3>
        <p>${esc(f.body)}</p>
        ${f.sourceUrl || f.checkedAt ? `<div class="src">${f.sourceUrl ? `Checked: ${esc(hostOf(f.sourceUrl))}` : ''}${f.checkedAt ? ` · ${esc(day(f.checkedAt))}` : ''}</div>` : ''}
      </div>
      ${f.screenshotPath ? `<img class="shot" src="${esc(fileHref(f.screenshotPath))}" alt="">` : ''}
    </article>`).join('')

  const fixes = c.fixes.map((x) => `<li><span>${esc(x.fix)}</span>${x.diy ? '<em>You can do this one yourself</em>' : ''}</li>`).join('')

  return `<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><title>${esc(m.businessName)} · Online presence audit</title>
<style>
@font-face { font-family: 'Barlow Condensed'; src: url('${esc(fileHref(m.fonts.display))}') format('woff2'); font-weight: 700; }
@font-face { font-family: 'General Sans'; src: url('${esc(fileHref(m.fonts.sans))}') format('woff2'); font-weight: 400; }
@font-face { font-family: 'General Sans'; src: url('${esc(fileHref(m.fonts.sansBold))}') format('woff2'); font-weight: 600; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { width: 210mm; height: 297mm; background: #fbf8f2; color: #1d1b17; font: 9.6pt/1.45 'General Sans', -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column; overflow: hidden; }
header { background: #0e0e0d; color: #ece7dc; padding: 9mm 14mm 8mm; display: flex; justify-content: space-between; align-items: flex-end; }
.brand { display: flex; align-items: center; gap: 9px; font: 700 24pt/1 'Barlow Condensed', sans-serif; letter-spacing: -0.01em; }
.meta { text-align: right; font-size: 8.4pt; color: #a8a295; line-height: 1.5; }
.meta strong { color: #ece7dc; font-weight: 600; }
main { padding: 8mm 14mm 0; flex: 1; display: flex; flex-direction: column; gap: 5.5mm; }
.eyebrow { font-size: 7.4pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a5300; margin-bottom: 1.5mm; }
h1 { font: 700 30pt/0.95 'Barlow Condensed', sans-serif; text-transform: uppercase; margin: 0; }
.summary { font-size: 11pt; line-height: 1.5; max-width: 165mm; margin: 2.5mm 0 0; }
h2 { font: 700 13.5pt/1 'Barlow Condensed', sans-serif; text-transform: uppercase; margin: 0 0 2.5mm; padding-bottom: 1.8mm; border-bottom: 1px solid rgba(29,27,23,.16); display: flex; justify-content: space-between; align-items: baseline; }
h2 small { font: 400 7.6pt 'General Sans', sans-serif; text-transform: none; color: #7b7466; }
.findings { display: flex; flex-direction: column; gap: 3mm; }
.finding { display: grid; grid-template-columns: 7mm 1fr; gap: 3mm; break-inside: avoid; }
.finding.has-shot { grid-template-columns: 7mm 1fr 40mm; }
.n { font: 700 15pt/1 'Barlow Condensed', sans-serif; color: #f0a52c; padding-top: 0.5mm; }
h3 { font-size: 10pt; font-weight: 600; margin: 0 0 0.8mm; }
.finding p { margin: 0; color: #4c473e; }
.src { margin-top: 1mm; font-size: 7.2pt; color: #7b7466; word-break: break-all; }
.shot { width: 40mm; height: 25mm; object-fit: cover; object-position: top; border: 1px solid rgba(29,27,23,.16); border-radius: 2px; }
ol { margin: 0; padding: 0; list-style: none; counter-reset: fix; display: flex; flex-direction: column; gap: 1.8mm; }
ol li { counter-increment: fix; display: grid; grid-template-columns: 7mm 1fr; align-items: baseline; }
ol li::before { content: counter(fix); font: 700 12pt/1 'Barlow Condensed', sans-serif; color: #f0a52c; }
ol li em { grid-column: 2; font-style: normal; font-size: 7.6pt; font-weight: 600; color: #2f6b43; }
.method { font-size: 8pt; color: #7b7466; margin-top: 2mm; }
footer { margin-top: auto; padding: 5mm 14mm 7mm; display: flex; justify-content: space-between; align-items: flex-end; border-top: 3px solid #f0a52c; font-size: 8.4pt; }
footer .line { font: 700 12pt/1.1 'Barlow Condensed', sans-serif; text-transform: uppercase; }
footer .who { text-align: right; color: #4c473e; }
</style></head>
<body>
<header>
  <div class="brand">${MARK}<span>tally</span></div>
  <div class="meta"><strong>Online presence audit</strong><br>${esc(m.date)}<br>Prepared by ${esc(m.sender.name)}, ${esc(m.sender.company)}</div>
</header>
<main>
  <section>
    <div class="eyebrow">Prepared for</div>
    <h1>${esc(m.businessName)}</h1>
    <p class="summary">${esc(c.summary)}</p>
  </section>
  <section>
    <h2>What I found <small>Every finding was checked on the page where it lives.</small></h2>
    <div class="findings">${findings}</div>
  </section>
  <section>
    <h2>What I'd fix first</h2>
    <ol>${fixes}</ol>
    <p class="method">In this order: fix what is broken, start measuring, then fill the funnel.</p>
  </section>
</main>
<footer>
  <div class="line">No targets, no guarantees.<br>Just the fixes.</div>
  <div class="who">${esc(m.sender.name)} · ${esc(m.sender.phone)}<br>${esc(m.sender.email)} · ${esc(m.sender.website)}</div>
</footer>
</body></html>`
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'audit'

/*
  File names carry the company id so two businesses with similar names never
  share a file, and a PDF already marked sent (`keep`) is never overwritten.
*/
export function auditFileName(dir: string, businessName: string, companyId: number, date: string, keep: string[]): string {
  const base = join(dir, `${slug(businessName)}-${companyId}-audit-${date}`)
  let file = `${base}.pdf`
  for (let n = 2; keep.includes(file); n++) file = `${base}-${n}.pdf`
  return file
}
