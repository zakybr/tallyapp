/* Proves the updater against the real latest GitHub release, using a copy that pretends to be older. */
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const exe = join(process.argv[2], 'Contents/MacOS/Tally')
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${mkdtempSync(join(tmpdir(), 'tally-upd-'))}`], env: { ...process.env, TALLY_UPDATE_AS_VERSION: '0.1.9' } })
const win = await app.firstWindow()
await win.waitForSelector('aside')
await win.evaluate(() => window.tally.checkForUpdates())
let s
for (let i = 0; i < 300; i++) {
  s = await win.evaluate(() => window.tally.updateStatus())
  if (s.state === 'ready' || s.state === 'error' || s.state === 'unsupported' || s.state === 'current') break
  if (i % 10 === 0) console.log('status', s.state, s.percent ?? '')
  await new Promise((r) => setTimeout(r, 1000))
}
console.log('final', JSON.stringify({ state: s.state, version: s.version, message: s.message }))
const sidebar = await win.locator('aside').innerText()
console.log('sidebar shows restart:', sidebar.includes('Restart to update'))
if (s.state === 'ready') await win.evaluate(() => window.tally.installUpdate()).catch(() => {})
await app.close().catch(() => {})
