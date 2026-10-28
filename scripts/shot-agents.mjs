import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'
const app = await electron.launch({ args: ['.', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tally-ag-'))}`] })
const win = await app.firstWindow(); await win.setViewportSize({ width: 1440, height: 900 })
await win.waitForSelector('aside')
await win.evaluate(() => (window.location.hash = '#/agents'))
await win.getByRole('button', { name: 'Connection check' }).click()
await win.waitForTimeout(9000)
await win.screenshot({ path: process.argv[2] })
await app.close()
