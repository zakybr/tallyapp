/* Launch the packaged .app and confirm the shell renders. */
import { _electron as electron } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const userData = mkdtempSync(join(tmpdir(), 'tally-pkg-'))
const app = await electron.launch({ executablePath: 'release/mac-arm64/Tally.app/Contents/MacOS/Tally', args: [`--user-data-dir=${userData}`] })
const win = await app.firstWindow()
await win.waitForSelector('aside')
console.log('title:', await win.title(), '| nav:', (await win.locator('nav a').allInnerTexts()).map((t) => t.split('\n')[0]).join(', '))
console.log('appInfo:', JSON.stringify(await win.evaluate(() => window.tally.appInfo())))
await app.close()
