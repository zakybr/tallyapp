/*
  Skills are read from <agentHome>/.claude/skills/<name>/SKILL.md on every
  run and inlined into the agent's instructions. Invoking them through the
  CLI's Skill tool injected 100k–490k tokens of context per call (measured
  28 Oct 2026 with scripts/token-probe2.mjs), so the files stay the editable
  source of truth but are delivered directly.
*/
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { skillsDir } from './env'

export function skillText(names: string[] = []): string {
  const parts: string[] = []
  for (const name of names) {
    const file = join(skillsDir(), name, 'SKILL.md')
    if (!existsSync(file)) continue
    const body = readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---\s*/, '').trim()
    parts.push(`<skill name="${name}">\n${body}\n</skill>`)
  }
  return parts.length ? `\n\nThe method you follow (Zak's skills, edited by him; they override anything above):\n\n${parts.join('\n\n')}` : ''
}
