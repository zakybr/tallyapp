/* Dev helper: start an agent job inside the built app and stream its log. node scripts/run-job.mjs <kind> '<json payload>' */
import { _electron as electron } from 'playwright'
const [kind = 'check', payload = '{}'] = process.argv.slice(2)
const args = ['.']
if (process.env.TALLY_USER_DATA) args.push(`--user-data-dir=${process.env.TALLY_USER_DATA}`)
const app = await electron.launch({ args })
const win = await app.firstWindow()
await win.waitForSelector('aside')
const job = await win.evaluate(([k, p]) => window.tally.startJob(k, JSON.parse(p)), [kind, payload])
let seen = 0, status = 'running'
if (process.env.CANCEL_AFTER) setTimeout(() => void win.evaluate((id) => window.tally.cancelJob(id), job.id), Number(process.env.CANCEL_AFTER))
while (status === 'running') {
  await new Promise((r) => setTimeout(r, 1500))
  const log = await win.evaluate((id) => window.tally.jobLog(id), job.id)
  for (const e of log.slice(seen)) console.log(`[${e.level}] ${e.message}`)
  seen = log.length
  const jobs = await win.evaluate(() => window.tally.listJobs())
  const j = jobs.find((x) => x.id === job.id)
  status = j.status
  if (status !== 'running') console.log(JSON.stringify({ status, durationMs: j.durationMs, in: j.inputTokens, out: j.outputTokens, costUsd: j.costUsd, turns: j.turns, error: j.error }))
}
await app.close()
