import { app } from 'electron'
import { createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { Settings } from '@shared/domain'

const req = createRequire(import.meta.url)

/*
  Where agents run. Skills load from <agentHome>/.claude/skills via
  settingSources: ['project'].
  - dev: the repo itself, so editing .claude/skills/* takes effect on the next run
  - packaged: a copy in the user data folder, seeded from the bundle once and
    never overwritten, so Zak's edits survive updates
*/
export function agentHome(): string {
  if (!app.isPackaged) return app.getAppPath()
  const home = join(app.getPath('userData'), 'agent-home')
  const skills = join(home, '.claude', 'skills')
  if (!existsSync(skills)) {
    mkdirSync(home, { recursive: true })
    cpSync(join(process.resourcesPath, 'agent-home'), home, { recursive: true })
  }
  return home
}

export function skillsDir(): string {
  return join(agentHome(), '.claude', 'skills')
}

/* The SDK's bundled native Claude Code binary, unpacked from the asar. */
export function claudeExecutable(): string | undefined {
  const pkg = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`
  const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'
  try {
    return req.resolve(`${pkg}/${bin}`).replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)
  } catch {
    return undefined
  }
}

/*
  Subscription mode: strip any API key from the environment so the bundled
  CLI uses the local Claude Code login (keychain). API key mode: set it.
*/
export function agentEnv(settings: Settings): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDECODE
  if (settings.authMode === 'api_key') {
    if (!settings.apiKey) throw new Error('Auth mode is API key, but no key is saved in Settings.')
    env.ANTHROPIC_API_KEY = settings.apiKey
  }
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'tally-desktop'
  return env
}
