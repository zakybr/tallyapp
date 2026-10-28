/* Phase 4 acceptance: research real prospects end to end in a persistent profile. */
import { _electron as electron } from 'playwright'
import { appendFileSync, writeFileSync } from 'node:fs'
const userData = process.env.TALLY_USER_DATA
const out = process.env.OUT ?? 'real-case.log'
writeFileSync(out, '')
const say = (s) => { appendFileSync(out, s + '\n') }
const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`] })
const win = await app.firstWindow()
await win.waitForSelector('aside')
const cases = JSON.parse(process.env.CASES)
const jobs = await win.evaluate(async (cases) => {
  const out = []
  const all = await window.tally.listCompanies()
  for (const c of cases) {
    const existing = all.find((x) => x.name === c.name)
    const co = existing ?? await window.tally.createCompany({ ...c, source: 'Phase 4 real case' })
    out.push(await window.tally.startJob('research', { companyId: co.id }))
  }
  return out
}, cases)
const seen = {}
let live = jobs.map((j) => j.id)
while (live.length) {
  await new Promise((r) => setTimeout(r, 4000))
  for (const id of jobs.map((j) => j.id)) {
    const log = await win.evaluate((id) => window.tally.jobLog(id), id)
    for (const e of log.slice(seen[id] ?? 0)) say(`${id.slice(0, 4)} [${e.level}] ${e.message}`)
    seen[id] = log.length
  }
  const all = await win.evaluate(() => window.tally.listJobs())
  live = live.filter((id) => all.find((j) => j.id === id)?.status === 'running')
}
const all = await win.evaluate(() => window.tally.listJobs())
for (const j of jobs) { const x = all.find((y) => y.id === j.id); say(`RESULT ${x.title}: ${x.status} ${Math.round(x.durationMs / 1000)}s in=${x.inputTokens} out=${x.outputTokens} turns=${x.turns} err=${x.error}`) }
await app.close()
