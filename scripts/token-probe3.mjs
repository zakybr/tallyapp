import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
const mk = () => createSdkMcpServer({ name: 'tally', version: '1', tools: [tool('ping', 'Call this once.', { x: z.string().optional() }, async () => ({ content: [{ type: 'text', text: 'pong' }] }))] })
const run = async (name, extraEnv, extraOpts) => {
  const env = { ...process.env, ...extraEnv }; delete env.ANTHROPIC_API_KEY; delete env.CLAUDECODE
  for await (const m of query({ prompt: 'Call the ping tool once, then reply "ok".', options: { cwd: process.cwd(), settingSources: ['project'], systemPrompt: 'Follow instructions.', model: 'claude-haiku-5-5', permissionMode: 'dontAsk', persistSession: false, env, maxTurns: 3, tools: [], mcpServers: { tally: mk() }, allowedTools: ['mcp__tally__ping'], ...extraOpts } })) {
    if (m.type === 'system' && m.subtype === 'init') console.log(name, 'mcp servers:', m.mcp_servers.map((s) => `${s.name}:${s.status}`).join(' '))
    if (m.type === 'result') for (const [k, u] of Object.entries(m.modelUsage)) console.log(name, 'cacheW', u.cacheCreationInputTokens, 'cacheR', u.cacheReadInputTokens, 'turns', m.num_turns)
  }
}
await run('default', {}, {})
await run('strict', {}, { strictMcpConfig: true })
await run('noClaudeAi', { ENABLE_CLAUDEAI_MCP_SERVERS: 'false' }, {})
