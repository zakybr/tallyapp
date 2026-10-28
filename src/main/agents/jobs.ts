/*
  Entry points the renderer can start. Each builds the prompt, runs the
  right agent(s) and saves validated results. Kinds beyond `check` are
  registered by later modules via `registerJob`.
*/
import { z } from 'zod'
import { startJob, type JobContext } from './runner'
import type { Job, JobKind } from '@shared/domain'

export type JobPayload = { companyId?: number; [k: string]: unknown }
type Starter = (payload: JobPayload) => { title: string; companyId: number | null; work: (ctx: JobContext) => Promise<void> }

const starters = new Map<JobKind, Starter>()

export function registerJob(kind: JobKind, s: Starter): void {
  starters.set(kind, s)
}

export function start(kind: JobKind, payload: JobPayload): Job {
  const s = starters.get(kind)
  if (!s) throw new Error(`No agent registered for ${kind}`)
  const { title, companyId, work } = s(payload)
  return startJob(kind, title, companyId, work)
}

/* Connection check: proves auth, skills loading, streaming and structured output end to end. */
registerJob('check', () => ({
  title: 'Connection check',
  companyId: null,
  work: async (ctx) => {
    const { output } = await ctx.runAgent({
      name: 'Check',
      systemPrompt: 'You are a connection check for the Tally desktop app. Answer briefly.',
      prompt: 'List the names of the skills available to you that start with "tally-", then reply with the structured result.',
      builtinTools: [],
      skills: ['tally-qualify', 'tally-site-audit', 'tally-call-script', 'tally-cold-email', 'tally-audit-pdf'],
      schema: z.object({ ok: z.boolean(), skills: z.array(z.string()) }),
      maxTurns: 4
    })
    ctx.log('finding', `Agents are connected. Skills loaded: ${output.skills.join(', ') || 'none'}`)
  }
}))
