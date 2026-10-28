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
if (process.env.SEED) {
  await win.evaluate(async () => {
    const t = window.tally
    const rows = [
      ['AOMAS', 'aomas.co.nz', 'Hibiscus Coast', 'Boat builders and marine', 'researched'],
      ['White Pointer Boats', 'whitepointerboats.co.nz', 'Wairau Valley', 'Boat builders and marine', 'go'],
      ['Shore Pools Ltd', 'shorepools.co.nz', 'North Shore', 'Pools', 'conversation'],
      ['Westgate Motorhomes', 'westgatemotorhomes.co.nz', 'West Auckland', 'Motorhomes', 'contacted'],
      ['Orewa Jet Ski Hire', null, 'Hibiscus Coast', 'Seasonal leisure (jet ski hire, venues)', 'discovered'],
      ['Albany Luxury Builds', 'albanyluxury.co.nz', 'North Shore', 'Luxury homes', 'proposal'],
      ['Gulf Harbour Marine', 'gulfharbourmarine.co.nz', 'Hibiscus Coast', 'Boat builders and marine', 'pass']
    ]
    for (const [name, website, area, vertical, stage] of rows) {
      const c = await t.createCompany({ name, website, area, vertical, source: 'seed' })
      await t.updateCompany(c.id, { stage, verdict: ['go', 'conversation', 'pass'].includes(stage) ? stage : null, nextStep: stage === 'contacted' ? 'Call back re: audit' : null, nextStepDue: stage === 'contacted' ? new Date().toISOString().slice(0, 10) : null })
    }
  })
}
for (const r of routes.length ? routes : ['today']) {
  await win.evaluate((h) => (window.location.hash = h), `#/${r}`)
  await win.waitForTimeout(700)
  await win.screenshot({ path: `${outDir}/${theme}-${r.replace(/\//g, '_')}.png` })
}
await app.close()
