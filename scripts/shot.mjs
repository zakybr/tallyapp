/* Dev helper: launch the built app, visit routes, save screenshots. */
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [outDir = 'shots', theme = 'light', ...routes] = process.argv.slice(2)
const userData = process.env.TALLY_USER_DATA ?? mkdtempSync(join(tmpdir(), 'tally-shot-'))
const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], env: { ...process.env, TALLY_USER_DATA: userData } })
const win = await app.firstWindow()
await win.setViewportSize({ width: 1440, height: 900 })
await win.emulateMedia({ colorScheme: theme })
await win.waitForTimeout(600)
for (const r of routes.length ? routes : ['today']) {
  await win.evaluate((h) => (window.location.hash = h), `#/${r}`)
  await win.waitForTimeout(700)
  await win.screenshot({ path: `${outDir}/${theme}-${r.replace(/\//g, '_')}.png` })
}
await app.close()
