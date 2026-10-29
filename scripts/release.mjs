/*
  Publish a release that installed copies of Tally pick up automatically.
    1. bump "version" in package.json and commit + push to main
    2. node scripts/release.mjs "What changed, in plain English"
  Builds the mac dmg + zip and creates GitHub release v<version> on
  zakybr/tallyapp with both files. Uses the GitHub credential git already has.
*/
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'

const REPO = 'zakybr/tallyapp'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`
const notes = process.argv.slice(2).join(' ').trim()
if (!notes) { console.error('Usage: node scripts/release.mjs "release notes"'); process.exit(1) }

if (execSync('git status --porcelain --untracked-files=no').toString().trim()) { console.error('Commit your changes first.'); process.exit(1) }
execSync('git fetch -q origin main')
if (execSync('git rev-parse HEAD').toString() !== execSync('git rev-parse origin/main').toString()) { console.error('Push main to GitHub first.'); process.exit(1) }

const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n' }).toString()
const token = cred.match(/^password=(.*)$/m)?.[1]
if (!token) { console.error('No GitHub credential found for git.'); process.exit(1) }
const gh = (url, init = {}) => fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'tally-release', ...(init.headers ?? {}) } })

const existing = await gh(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`)
if (existing.ok) { console.error(`${tag} already exists. Bump the version in package.json.`); process.exit(1) }

console.log(`Building ${tag}…`)
// Sign with the local self-signed certificate (PLAN.md section 0) so macOS keeps
// Keychain and login-item grants across updates. Ad-hoc only with ALLOW_ADHOC=1.
const IDENTITY = 'Tally Local Signing'
const hasIdentity = execSync('security find-identity -v -p codesigning').toString().includes(`"${IDENTITY}"`)
if (!hasIdentity && !process.env.ALLOW_ADHOC) {
  console.error(`No "${IDENTITY}" code-signing certificate in Keychain. Create it (see PLAN.md section 0) or run with ALLOW_ADHOC=1.`)
  process.exit(1)
}
execSync(`npx electron-vite build && npx electron-builder --mac${hasIdentity ? ` -c.mac.identity="${IDENTITY}"` : ''}`, { stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } })
const files = [`release/Tally-${version}-arm64-mac.zip`, `release/Tally-${version}-arm64-mac.dmg`]
for (const f of files) statSync(f)

const res = await gh(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  body: JSON.stringify({ tag_name: tag, target_commitish: 'main', name: `Tally ${version}`, body: notes })
})
if (!res.ok) { console.error('Could not create the release:', res.status, await res.text()); process.exit(1) }
const rel = await res.json()
for (const f of files) {
  const up = await gh(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=${encodeURIComponent(basename(f))}`, {
    method: 'POST',
    headers: { 'content-type': f.endsWith('.zip') ? 'application/zip' : 'application/x-apple-diskimage' },
    body: readFileSync(f)
  })
  if (!up.ok) { console.error(`Upload failed for ${f}:`, up.status, await up.text()); process.exit(1) }
  console.log(`Uploaded ${basename(f)}`)
}
console.log(`Released ${rel.html_url}`)
