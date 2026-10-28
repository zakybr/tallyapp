/* Launch the packaged .app, confirm the shell renders, the database works and an agent runs. */
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const userData = mkdtempSync(join(tmpdir(), 'tally-pkg-'))
const app = await electron.launch({ executablePath: 'release/mac-arm64/Tally.app/Contents/MacOS/Tally', args: [`--user-data-dir=${userData}`] })
const win = await app.firstWindow()
await win.waitForSelector('aside')
console.log('title:', await win.title())
const c = await win.evaluate(() => window.tally.createCompany({ name: 'Packaged Check Ltd' }))
console.log('database ok, company id', c.id)
console.log('agent:', JSON.stringify(await win.evaluate(() => window.tally.agentInfo())))
if (process.argv.includes('--agent')) {
  const job = await win.evaluate(() => window.tally.startJob('check', {}))
  let j = job
  while (j.status === 'running') { await new Promise((r) => setTimeout(r, 1500)); j = (await win.evaluate(() => window.tally.listJobs())).find((x) => x.id === job.id) }
  const log = await win.evaluate((id) => window.tally.jobLog(id), job.id)
  console.log('check job:', j.status, j.error ?? '', '|', log.filter((e) => e.level === 'finding' || e.message.includes('via')).map((e) => e.message).join(' | '))
}
await app.close()
