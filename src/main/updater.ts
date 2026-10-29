/*
  Self-updater for an unsigned app. Electron's built-in updater (Squirrel.Mac)
  refuses unsigned apps, so this does it directly: read the latest GitHub
  release of zakybr/tallyapp, download the mac zip, check its SHA-256 against
  GitHub's digest, unpack it, and on restart swap the .app bundle in place.
  Files fetched by Node carry no quarantine flag, so Gatekeeper does not block
  the new version.
*/
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { accessSync, constants, createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { emit } from './ipc'
import { newerThan, UPDATE_REPO, type UpdateState } from '@shared/version'

const run = promisify(execFile)
/* TALLY_UPDATE_AS_VERSION lets a test copy pretend to be older, to exercise a real update end to end. */
const current = () => process.env.TALLY_UPDATE_AS_VERSION ?? app.getVersion()
let status: UpdateState = { state: 'idle', current: current() }
let staged: { version: string; appPath: string } | null = null
let busy = false

function set(s: UpdateState): void {
  status = s
  emit('update:status', s)
}

export function updateStatus(): UpdateState {
  return status
}

/* /Applications/Tally.app, derived from the running executable. */
function bundlePath(): string {
  return resolve(app.getPath('exe'), '..', '..', '..')
}

function whyCannotInstall(): string | null {
  if (!app.isPackaged) return 'Updates install only in the packaged app.'
  if (process.platform !== 'darwin') return 'Automatic install is macOS only. Download the new installer from GitHub.'
  const b = bundlePath()
  if (!b.endsWith('.app')) return 'Could not find the app bundle.'
  if (b.startsWith('/Volumes/')) return 'Tally is running from the disk image. Drag it to Applications first, then open it from there.'
  try { accessSync(dirname(b), constants.W_OK) } catch { return `Tally can't write to ${dirname(b)}. Move it to your Applications folder.` }
  return null
}

interface Release { tag_name: string; body: string | null; html_url: string; assets: { name: string; browser_download_url: string; size: number; digest?: string | null }[] }

export async function checkForUpdates(): Promise<UpdateState> {
  if (busy) return status
  if (staged) return status
  busy = true
  set({ state: 'checking', current: current() })
  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Tally-Updater' },
      signal: AbortSignal.timeout(20_000)
    })
    if (res.status === 404) { set({ state: 'current', current: current(), checkedAt: new Date().toISOString() }); return status }
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
    const rel = (await res.json()) as Release
    const version = rel.tag_name.replace(/^v/, '')
    if (!newerThan(version, current())) { set({ state: 'current', current: current(), checkedAt: new Date().toISOString() }); return status }

    const notes = (rel.body ?? '').trim()
    const blocked = whyCannotInstall()
    if (blocked) { set({ state: 'unsupported', current: current(), message: `Version ${version} is out. ${blocked}`, releaseUrl: rel.html_url }); return status }
    const asset = rel.assets.find((a) => a.name.endsWith(`-${process.arch}-mac.zip`))
    if (!asset) throw new Error(`Release ${version} has no ${process.arch} mac zip`)

    const dir = join(app.getPath('userData'), 'updates', version)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const zip = join(dir, asset.name)
    set({ state: 'downloading', current: current(), version, notes, percent: 0 })
    const dl = await fetch(asset.browser_download_url, { headers: { 'user-agent': 'Tally-Updater' }, redirect: 'follow' })
    if (!dl.ok || !dl.body) throw new Error(`Download failed (${dl.status})`)
    const hash = createHash('sha256')
    let got = 0
    let lastPct = -1
    const body = Readable.fromWeb(dl.body as never)
    body.on('data', (chunk: Buffer) => {
      hash.update(chunk)
      got += chunk.length
      const pct = Math.floor((got / asset.size) * 100)
      if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; set({ state: 'downloading', current: current(), version, notes, percent: pct }) }
    })
    await pipeline(body, createWriteStream(zip))
    const sha = hash.digest('hex')
    if (asset.digest && asset.digest.startsWith('sha256:') && asset.digest.slice(7) !== sha) {
      rmSync(dir, { recursive: true, force: true })
      throw new Error('The download did not match GitHub\'s checksum, so it was discarded.')
    }
    await run('/usr/bin/ditto', ['-x', '-k', zip, dir])
    rmSync(zip, { force: true })
    const appPath = join(dir, 'Tally.app')
    if (!existsSync(appPath)) throw new Error('The update zip did not contain Tally.app')
    staged = { version, appPath }
    set({ state: 'ready', current: current(), version, notes })
  } catch (e) {
    set({ state: 'error', current: current(), message: e instanceof Error ? e.message : String(e) })
  } finally {
    busy = false
  }
  return status
}

/*
  Quit, then a detached shell script waits for this process to exit, swaps
  the bundles (keeping the old one until the new one is in place), and
  reopens Tally. The database lives in the user data folder, so it is untouched.
*/
export function installUpdate(): void {
  if (!staged) throw new Error('No update is ready.')
  const target = bundlePath()
  const backup = `${target}.previous`
  const script = join(app.getPath('userData'), 'updates', 'install.sh')
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  writeFileSync(script, `#!/bin/sh
while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done
rm -rf ${q(backup)}
if mv ${q(target)} ${q(backup)} && mv ${q(staged.appPath)} ${q(target)}; then
  xattr -dr com.apple.quarantine ${q(target)} 2>/dev/null
  rm -rf ${q(backup)}
else
  [ -d ${q(target)} ] || mv ${q(backup)} ${q(target)}
fi
open ${q(target)}
`, { mode: 0o755 })
  spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref()
  app.quit()
}

export function scheduleUpdateChecks(): void {
  if (!app.isPackaged || process.env.TALLY_E2E) return
  setTimeout(() => void checkForUpdates(), 15_000)
  setInterval(() => void checkForUpdates(), 6 * 3600_000)
}
