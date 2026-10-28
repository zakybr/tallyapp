import { it } from 'vitest'
import { robotsAllows, rateLimit, USER_AGENT } from '../../src/main/audit/robots'

it('fetches the pages the stalled run was on', async () => {
  for (const u of ['https://whitepointerboats.co.nz/social', 'https://whitepointerboats.co.nz/for-sale', 'https://www.boatingnz.co.nz/2025/02/white-pointer-boats-celebrates-30-years-with-anniversary-fishing-competition']) {
    const t = Date.now()
    const r = await robotsAllows(u)
    console.log('robots', u, r.allowed, Date.now() - t, 'ms')
    await rateLimit(u, 1200)
    const res = await fetch(u, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    const body = await res.text()
    console.log('fetched', res.status, body.length, Date.now() - t, 'ms')
  }
})
