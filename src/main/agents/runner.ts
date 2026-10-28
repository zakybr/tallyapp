/*
  Job runner. A job is one unit of agent work shown in the run log: it owns
  an AbortController, streams log lines to the renderer, accumulates usage
  across every query() it makes, and is persisted to the jobs table.
*/
import { createSdkMcpServer, query, type AgentDefinition, type SdkMcpToolDefinition, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getRepo } from '../context'
import { emit } from '../ipc'
import { realSettings } from '../secrets'
import { live } from './registry'
import { agentEnv, agentHome, claudeExecutable } from './env'
import { fakeRun } from './fake'
import type { Job, JobKind, JobLogEntry, LogLevel } from '@shared/domain'

export interface JobContext {
  jobId: string
  signal: AbortSignal
  log(level: LogLevel, message: string, detail?: string): void
  /* Run one agent to completion. Returns validated structured output when a schema is given. */
  runAgent<T>(spec: AgentRun<T>): Promise<{ output: T; text: string }>
}

export interface AgentRun<T> {
  name: string
  systemPrompt: string
  prompt: string
  /* Built-in Claude Code tools this agent may use. Everything else is denied. */
  builtinTools: string[]
  /* Tally's own in-process tools (site audit, save results…), exposed as mcp__tally__<name>. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: SdkMcpToolDefinition<any>[]
  skills?: string[]
  schema?: z.ZodType<T>
  maxTurns?: number
  /* Default model for this agent; Settings → Model overrides it. */
  model?: string
  agents?: Record<string, AgentDefinition>
}

class Cancelled extends Error {}

const now = () => new Date().toISOString()
const short = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function startJob(kind: JobKind, title: string, companyId: number | null, work: (ctx: JobContext) => Promise<unknown>): Job {
  const repo = getRepo()
  const job: Job = {
    id: randomUUID(), kind, companyId, title, status: 'running', startedAt: now(), endedAt: null, durationMs: null,
    inputTokens: 0, outputTokens: 0, costUsd: null, turns: 0, error: null
  }
  const abort = new AbortController()
  live.set(job.id, { job, abort })
  repo.saveJob(job)
  emit('job:update', job)

  const log = (level: LogLevel, message: string, detail?: string) => {
    const e: JobLogEntry = { jobId: job.id, at: now(), level, message, detail }
    repo.addLog(e)
    emit('job:log', e)
  }

  const ctx: JobContext = {
    jobId: job.id,
    signal: abort.signal,
    log,
    runAgent: (spec) => runAgent(job, abort, log, spec)
  }

  const started = Date.now()
  void (async () => {
    try {
      log('info', `${title} started`)
      await work(ctx)
      job.status = 'done'
      log('done', 'Finished')
    } catch (err) {
      if (abort.signal.aborted || err instanceof Cancelled) {
        job.status = 'cancelled'
        log('error', 'Cancelled')
      } else {
        job.status = 'failed'
        job.error = err instanceof Error ? err.message : String(err)
        log('error', job.error)
      }
    } finally {
      job.endedAt = now()
      job.durationMs = Date.now() - started
      live.delete(job.id)
      repo.saveJob(job)
      emit('job:update', { ...job })
      emit('data:changed', { table: 'jobs', companyId: companyId ?? undefined })
    }
  })()
  return job
}

export function cancelJob(id: string): boolean {
  const l = live.get(id)
  if (!l) return false
  l.abort.abort()
  return true
}

export function cancelAll(): void {
  for (const l of live.values()) l.abort.abort()
}

async function runAgent<T>(job: Job, abort: AbortController, log: JobContext['log'], spec: AgentRun<T>): Promise<{ output: T; text: string }> {
  if (abort.signal.aborted) throw new Cancelled()
  if (process.env.TALLY_FAKE_AGENTS === '1') return fakeRun(spec, log)
  const settings = realSettings(getRepo())
  const mcpToolNames = (spec.tools ?? []).map((t) => `mcp__tally__${t.name}`)
  const mcp = spec.tools?.length ? createSdkMcpServer({ name: 'tally', version: '1.0.0', tools: spec.tools }) : undefined
  const builtins = [...spec.builtinTools, ...(spec.skills?.length ? ['Skill'] : []), ...(spec.agents ? ['Agent'] : [])]

  const q = query({
    prompt: spec.prompt,
    options: {
      cwd: agentHome(),
      settingSources: ['project'],
      skills: spec.skills ?? [],
      systemPrompt: spec.systemPrompt,
      tools: builtins,
      allowedTools: [...builtins, ...mcpToolNames],
      permissionMode: 'dontAsk',
      mcpServers: mcp ? { tally: mcp } : undefined,
      agents: spec.agents,
      outputFormat: spec.schema ? { type: 'json_schema', schema: z.toJSONSchema(spec.schema, { target: 'draft-7' }) as Record<string, unknown> } : undefined,
      maxTurns: spec.maxTurns ?? 40,
      model: settings.model || spec.model || undefined,
      abortController: abort,
      env: agentEnv(settings),
      pathToClaudeCodeExecutable: claudeExecutable(),
      persistSession: false
    }
  })

  let text = ''
  let structured: unknown
  try {
    for await (const m of q as AsyncIterable<SDKMessage>) {
      if (abort.signal.aborted) throw new Cancelled()
      const r = handleMessage(job, log, spec.name, m)
      if (r?.text) text = r.text
      if (r && 'structured' in r) structured = r.structured
      if (r?.error) throw new Error(r.error)
    }
  } catch (e) {
    if (abort.signal.aborted) throw new Cancelled()
    throw e
  }

  if (!spec.schema) return { output: undefined as T, text }
  const parsed = spec.schema.safeParse(structured ?? tryJson(text))
  if (!parsed.success) {
    log('error', `${spec.name} returned output that failed validation`, short(z.prettifyError(parsed.error), 1200))
    throw new Error(`${spec.name} output failed validation. Nothing was saved.`)
  }
  return { output: parsed.data, text }
}

function tryJson(s: string): unknown {
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return undefined
  try { return JSON.parse(m[0]) } catch { return undefined }
}

/* Turns SDK messages into run-log lines and usage. */
function handleMessage(job: Job, log: JobContext['log'], agent: string, m: SDKMessage): { text?: string; structured?: unknown; error?: string } | void {
  switch (m.type) {
    case 'system':
      if (m.subtype === 'init') {
        const auth = m.apiKeySource === 'none' ? 'Claude Code login' : `API key (${m.apiKeySource})`
        log('info', `${agent}: ${m.model} via ${auth}`, `tools: ${m.tools.join(', ')}`)
      }
      return
    case 'assistant': {
      const sub = m.parent_tool_use_id ? '  ↳ ' : ''
      for (const block of m.message.content) {
        if (block.type === 'text' && block.text.trim()) log('text', sub + short(block.text.trim(), 400))
        if (block.type === 'tool_use') {
          const input = block.input as Record<string, unknown>
          const name = block.name.replace(/^mcp__tally__/, '')
          const url = (input.url ?? input.query ?? input.pages ?? input.name ?? input.handle) as unknown
          const level: LogLevel = name === 'WebFetch' || name === 'site_audit' || name === 'fetch_page' ? 'page' : 'tool'
          log(level, `${sub}${name}${url ? ` ${short(typeof url === 'string' ? url : JSON.stringify(url), 160)}` : ''}`, short(JSON.stringify(input), 1500))
        }
      }
      return
    }
    case 'user': {
      const content = (m.message as { content?: unknown }).content
      if (Array.isArray(content)) {
        for (const b of content as { type: string; is_error?: boolean; content?: unknown }[]) {
          if (b.type === 'tool_result' && b.is_error) log('error', `Tool error: ${short(typeof b.content === 'string' ? b.content : JSON.stringify(b.content), 300)}`)
        }
      }
      return
    }
    case 'result': {
      job.turns += m.num_turns
      job.costUsd = (job.costUsd ?? 0) + (m.total_cost_usd ?? 0)
      for (const u of Object.values(m.modelUsage ?? {})) {
        job.inputTokens += u.inputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens
        job.outputTokens += u.outputTokens
      }
      getRepo().saveJob(job)
      emit('job:update', { ...job })
      if (m.subtype === 'success') return { text: m.result, structured: m.structured_output }
      return { error: `${agent} stopped: ${m.subtype.replace(/_/g, ' ')}` }
    }
    default:
      return
  }
}
