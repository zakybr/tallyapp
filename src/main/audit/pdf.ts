/*
  Prints the audit HTML to an A4 PDF with a hidden, sandboxed window.
  Exported locally to <userData>/audits; nothing is uploaded or sent.
*/
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import display from '../../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?asset'
import sans from '../../renderer/src/assets/fonts/GeneralSans-Regular.woff2?asset'
import sansBold from '../../renderer/src/assets/fonts/GeneralSans-Semibold.woff2?asset'
import { dataDir } from '../context'
import { auditFileName, buildAuditHtml, type AuditMeta } from './auditHtml'
import type { AuditContent } from '@shared/schemas'
import { localDate } from '@shared/rules'

export async function renderAuditPdf(content: AuditContent, meta: Omit<AuditMeta, 'fonts' | 'date'> & { companyId: number; keep: string[] }): Promise<string> {
  const dir = join(dataDir(), 'audits')
  mkdirSync(dir, { recursive: true })
  const date = localDate()
  const out = auditFileName(dir, meta.businessName, meta.companyId, date, meta.keep)
  const html = join(dir, `.render-${process.pid}-${Date.now()}.html`)
  const pretty = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
  writeFileSync(html, buildAuditHtml(content, { ...meta, date: pretty, fonts: { display, sans, sansBold } }))
  const win = new BrowserWindow({ show: false, width: 794, height: 1123, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await win.loadFile(html)
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r }))))')
    // One A4 page, always: if the content runs long, scale the whole page down
    // (enlarging the canvas by the same factor so it still fills A4 edge to edge).
    const fits = await win.webContents.executeJavaScript(`(() => {
      const b = document.body, A4 = 297 * 96 / 25.4
      b.style.height = 'auto'; b.style.overflow = 'visible'
      const h = b.scrollHeight
      const z = h > A4 ? Math.max(0.7, A4 / h) : 1
      b.style.width = (210 / z) + 'mm'; b.style.height = (297 / z) + 'mm'; b.style.overflow = 'hidden'; b.style.zoom = String(z)
      return h * z <= A4 + 1
    })()`)
    if (!fits) throw new Error('The audit is too long for one A4 page even scaled down. Shorten the summary, findings and fixes, then save again.')
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: true })
    writeFileSync(out, pdf)
    return out
  } finally {
    win.destroy()
    rmSync(html, { force: true })
  }
}
