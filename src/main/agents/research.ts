/*
  Find → Research → Score. Lead Finder, Research Agent, Scorer, and the
  orchestrator pipeline that chains them.
*/
import { getRepo, evidenceDir } from '../context'
import { emit } from '../ipc'
import { realSettings } from '../secrets'
import { registerJob } from './jobs'
import { applyEvidenceRule } from './evidence'
import { DEFS, ORCHESTRATOR_PROMPT, asSubagent, type AgentDef } from './definitions'
import { adsTool, companiesOfficeTool, fetchPageTool, pipelineCheckTool, placesTool, saveTool, siteAuditTool } from './tools'
import type { JobContext } from './runner'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { LeadsSchema, ResearchSchema, ScoreSchema } from '@shared/schemas'
import { competingProspects, expectedVerdict, findDuplicate, normaliseDomain } from '@shared/rules'
import { GAP_LABEL, type Company, type RuleOut, type Stage } from '@shared/domain'

/* Extra save tools registered by the prepare module (phase 5), keyed by tool name. */
export const extraTools = new Map<string, (ctx: JobContext, companyId: number, done: Set<string>) => ReturnType<typeof saveTool>>()

export function buildTools(names: string[], ctx: JobContext, companyId: number | null, done: Set<string>, extra: Record<string, ReturnType<typeof saveTool>> = {}) {
  const s = realSettings(getRepo())
  const out = []
  for (const n of names) {
    if (extra[n]) { out.push(extra[n]); continue }
    if (n === 'fetch_page') out.push(fetchPageTool(ctx))
    else if (n === 'check_pipeline') out.push(pipelineCheckTool())
    else if (n === 'places_search') { if (s.placesApiKey) out.push(placesTool(ctx)) }
    else if (n === 'companies_office_link') out.push(companiesOfficeTool())
    else if (n === 'read_record' && companyId) out.push(tool('read_record', 'Read the saved research record, score and contacts for this company.', {}, async () => ({ content: [{ type: 'text' as const, text: researchRecordFor(companyId) }] })))
    else if (n === 'site_audit' && companyId) out.push(siteAuditTool(ctx, companyId))
    else if (n === 'ads_transparency_check' && companyId) out.push(adsTool(ctx, companyId))
    else if (n === 'save_research' && companyId) out.push(researchSaveTool(ctx, companyId, done))
    else if (n === 'save_score' && companyId) out.push(scoreSaveTool(ctx, companyId, done))
    else if (extraTools.has(n) && companyId) out.push(extraTools.get(n)!(ctx, companyId, done))
  }
  return out
}

export async function runDef(ctx: JobContext, def: AgentDef, prompt: string, companyId: number | null, extra: Record<string, ReturnType<typeof saveTool>> = {}) {
  const s = realSettings(getRepo())
  const done = new Set<string>()
  await ctx.runAgent({
    name: def.key, systemPrompt: def.prompt(s), prompt, builtinTools: def.builtinTools,
    tools: buildTools(def.tallyTools, ctx, companyId, done, extra), skills: def.skills, maxTurns: def.maxTurns
  })
  const saveName = def.tallyTools.find((t) => t.startsWith('save_'))
  if (saveName && !done.has(saveName)) throw new Error(`${def.key} finished without saving a result. Nothing was changed.`)
}

/* ---------- concurrency: research is heavy (a browser per site) ---------- */

let active = 0
const waiting: (() => void)[] = []
async function slot<T>(ctx: JobContext, fn: () => Promise<T>): Promise<T> {
  if (active >= 2) {
    ctx.log('info', 'Queued behind other research jobs')
    await new Promise<void>((r) => waiting.push(r))
  }
  active++
  try { return await fn() } finally { active--; waiting.shift()?.() }
}

function researchSaveTool(ctx: JobContext, companyId: number, done: Set<string>) {
  return saveTool('save_research', 'Save the complete evidence record for this company. Call once at the end.', ResearchSchema, (r) => {
    const repo = getRepo()
    const records = applyEvidenceRule(r.findings, evidenceDir(companyId))
    repo.db.transaction(() => {
      repo.replaceResearch(companyId, ctx.jobId, records)
      if (r.companiesOffice) {
        const co = r.companiesOffice
        repo.addResearch(companyId, {
          category: 'companies_office', gapType: null, sourceUrl: co.sourceUrl, pagesChecked: co.sourceUrl ? [co.sourceUrl] : [], screenshotPath: null,
          checkedAt: new Date().toISOString(), verified: !!co.companyNumber, jobId: ctx.jobId,
          finding: [
            co.legalName ?? 'Legal name not confirmed',
            co.companyNumber ? `company ${co.companyNumber}` : null,
            co.incorporated ? `incorporated ${co.incorporated}` : null,
            co.status ? `status: ${co.status}` : null,
            co.directors.length ? `directors: ${co.directors.join(', ')}` : null,
            co.lastAnnualReturn ? `last annual return ${co.lastAnnualReturn}` : null
          ].filter(Boolean).join(' · ')
        })
      }
      const at = new Date().toISOString()
      repo.replaceBenchmark(companyId, r.benchmark.map((b) => ({ ...b, checkedAt: at })))
      const existing = repo.listContacts(companyId)
      for (const c of r.contacts) {
        if (!c.email && !c.name && !c.phone) continue
        if (existing.some((e) => (c.email && e.email === c.email.toLowerCase()) || (!c.email && c.name && e.name === c.name))) continue
        repo.upsertContact({ companyId, ...c, email: c.email?.toLowerCase() ?? null })
      }
      const co = repo.getCompany(companyId)!
      repo.updateCompany(companyId, {
        legalName: r.legalName ?? r.companiesOffice?.legalName ?? co.legalName,
        phone: co.phone ?? r.phone, address: co.address ?? r.address, googleListingUrl: co.googleListingUrl ?? r.googleListingUrl,
        ...(co.stage === 'discovered' ? { stage: 'researched' as Stage } : {})
      })
      const gaps = records.filter((x) => x.gapType && x.verified).length
      const unverified = records.filter((x) => !x.verified).length
      repo.addActivity(companyId, 'research', `Researched: ${records.length} findings, ${gaps} verified gaps, ${unverified} unverified`)
    })()
    done.add('save_research')
    emit('data:changed', { table: 'research', companyId })
    const downgraded = records.filter((x, i) => x.verified !== r.findings[i].verified).length
    return `Saved ${records.length} findings.${downgraded ? ` ${downgraded} absence claims were marked unverified because the contact/booking page was not in pagesChecked.` : ''}`
  })
}

/* Deterministic rule-outs the app knows better than the model. */
function knownRuleOuts(c: Company): { type: RuleOut; reason: string }[] {
  const repo = getRepo()
  const out: { type: RuleOut; reason: string }[] = []
  const d = normaliseDomain(c.website)
  const conflict = repo.listConflicts().find((x) => (d && x.domain === d) || x.name.toLowerCase() === c.name.toLowerCase())
  if (conflict) out.push({ type: 'client_conflict', reason: `On the conflicts list: ${conflict.name}` })
  const rivals = competingProspects(c, repo.listCompanies())
  if (rivals.length) out.push({ type: 'competes_with_prospect', reason: `Competes with ${rivals.map((r) => r.name).join(', ')} (${c.vertical}, ${c.area}). Pick one.` })
  return out
}

function scoreSaveTool(ctx: JobContext, companyId: number, done: Set<string>) {
  return saveTool('save_score', 'Save the verdict for this company. Call once.', ScoreSchema, (sc) => {
    const repo = getRepo()
    const c = repo.getCompany(companyId)!
    const ruleOuts = [...sc.ruleOuts]
    for (const k of knownRuleOuts(c)) if (!ruleOuts.some((r) => r.type === k.type)) ruleOuts.push(k)
    const expected = expectedVerdict(sc.gates, sc.verifiedGaps, ruleOuts)
    if (expected !== sc.verdict) {
      throw new Error(`Verdict "${sc.verdict}" does not follow from your own gates, gaps and rule-outs (they imply "${expected}"). Re-check each gate against the evidence, then save a consistent verdict and reason.`)
    }
    repo.saveScore({ companyId, verdict: sc.verdict, gates: sc.gates, verifiedGaps: sc.verifiedGaps, ruleOuts, reason: sc.reason, firstCallQuestion: sc.firstCallQuestion })
    const patch: Partial<Company> = { offsiteOnly: c.offsiteOnly || sc.familyBuiltSite }
    if (['discovered', 'researched', 'go', 'conversation', 'pass'].includes(c.stage)) patch.stage = sc.verdict
    repo.updateCompany(companyId, patch)
    repo.addActivity(companyId, 'score', `Scored ${sc.verdict.toUpperCase()}: ${sc.reason}`)
    ctx.log('finding', `Verdict: ${sc.verdict.toUpperCase()}. ${sc.reason}`)
    done.add('save_score')
    emit('data:changed', { table: 'scores', companyId })
    return `Saved: ${sc.verdict}.`
  })
}

/* ---------- prompts ---------- */

export function researchRecordFor(companyId: number): string {
  const d = getRepo().detail(companyId)!
  const c = d.company
  return JSON.stringify({
    company: { name: c.name, legalName: c.legalName, website: c.website, phone: c.phone, address: c.address, area: c.area, vertical: c.vertical, googleListingUrl: c.googleListingUrl, offsiteOnly: c.offsiteOnly },
    findings: d.research.map((r) => ({ category: r.category, finding: r.finding, gap: r.gapType ? GAP_LABEL[r.gapType] : null, gapType: r.gapType, verified: r.verified, sourceUrl: r.sourceUrl, pagesChecked: r.pagesChecked, checkedAt: r.checkedAt, screenshotPath: r.screenshotPath })),
    benchmark: d.benchmark,
    contacts: d.contacts.map((x) => ({ name: x.name, role: x.role })),
    score: d.score ? { verdict: d.score.verdict, reason: d.score.reason, gates: d.score.gates, verifiedGaps: d.score.verifiedGaps, ruleOuts: d.score.ruleOuts, firstCallQuestion: d.score.firstCallQuestion } : null
  }, null, 1)
}

const companyBrief = (c: Company) =>
  `Company: ${c.name}\nWebsite: ${c.website ?? 'none on file'}\nPhone: ${c.phone ?? 'unknown'}\nAddress: ${c.address ?? 'unknown'}\nArea: ${c.area ?? 'unknown'}\nVertical: ${c.vertical ?? 'unknown'}\nGoogle listing: ${c.googleListingUrl ?? 'unknown'}`

function scorePrompt(companyId: number): string {
  const c = getRepo().getCompany(companyId)!
  const known = knownRuleOuts(c)
  return `Score this company.\n\nResearch record:\n${researchRecordFor(companyId)}\n\nRule-outs the app already knows: ${known.length ? JSON.stringify(known) : 'none'}\nConflicts list: ${JSON.stringify(getRepo().listConflicts().map((x) => x.name))}`
}

/* ---------- jobs ---------- */

registerJob('lead_finder', (p) => {
  const category = String(p.category ?? '').trim()
  const area = String(p.area ?? '').trim()
  if (!category || !area) throw new Error('Category and area are both needed.')
  return {
    title: `Find: ${category}, ${area}`,
    companyId: null,
    work: async (ctx) => {
      const repo = getRepo()
      let saved = 0
      const save = saveTool('save_leads', 'Save the candidate list. Call once at the end.', LeadsSchema, (r) => {
        const all = repo.listCompanies()
        const leads = r.leads.map((l) => ({ ...l, duplicateOf: findDuplicate(l, all) }))
        repo.saveLeadRun(ctx.jobId, category, area, leads)
        saved = leads.length
        for (const l of leads) ctx.log('finding', `${l.name}${l.website ? ` · ${normaliseDomain(l.website)}` : ' · no website'}${l.duplicateOf ? ' (already in pipeline)' : ''}`)
        emit('data:changed', { table: 'lead_runs' })
        return `Saved ${leads.length} candidates.`
      })
      await runDef(ctx, DEFS.lead_finder, `Category: ${category}\nArea: ${area}, New Zealand\nRegions Zak works: ${realSettings(repo).regions.join(', ')}`, null, { save_leads: save })
      ctx.log('info', `${saved} candidates ready on the Find screen`)
    }
  }
})

registerJob('research', (p) => {
  const id = Number(p.companyId)
  const c = getRepo().getCompany(id)
  if (!c) throw new Error('Company not found')
  return {
    title: `Research: ${c.name}`,
    companyId: id,
    work: async (ctx) => {
      const prior = getRepo().passedBefore(normaliseDomain(c.website), c.name)
      if (prior && prior.id !== id && !p.force) {
        ctx.log('finding', `Skipped: ${prior.name} was already passed on. ${prior.reason ?? ''}`)
        return
      }
      await slot(ctx, () => runDef(ctx, DEFS.research, `Research this company.\n\n${companyBrief(c)}`, id))
      if (p.thenScore !== false) await runDef(ctx, DEFS.scorer, scorePrompt(id), id)
    }
  }
})

registerJob('score', (p) => {
  const id = Number(p.companyId)
  const c = getRepo().getCompany(id)
  if (!c) throw new Error('Company not found')
  return { title: `Score: ${c.name}`, companyId: id, work: (ctx) => runDef(ctx, DEFS.scorer, scorePrompt(id), id) }
})

/* The orchestrator: one agent that delegates to subagents with the Agent tool. */
registerJob('pipeline', (p) => {
  const id = Number(p.companyId)
  const c = getRepo().getCompany(id)
  if (!c) throw new Error('Company not found')
  return {
    title: `Full workup: ${c.name}`,
    companyId: id,
    work: async (ctx) => {
      const s = realSettings(getRepo())
      const keys = ['research', 'scorer', ...[...extraTools.keys()].length ? ['opener', 'call_script', 'email', 'audit'] : []]
      const done = new Set<string>()
      const toolNames = [...new Set(keys.flatMap((k) => DEFS[k].tallyTools))]
      await slot(ctx, () => ctx.runAgent({
        name: 'orchestrator',
        systemPrompt: ORCHESTRATOR_PROMPT(s),
        prompt: `Work up this prospect.\n\n${companyBrief(c)}\n\nEvery agent after research reads the saved record with read_record. Conflicts list: ${JSON.stringify(getRepo().listConflicts().map((x) => x.name))}. Known rule-outs: ${JSON.stringify(knownRuleOuts(c))}.`,
        builtinTools: [],
        tools: buildTools(toolNames, ctx, id, done),
        agents: Object.fromEntries(keys.map((k) => [k, asSubagent(DEFS[k], s)])),
        maxTurns: 30
      }))
      if (!done.has('save_research')) throw new Error('The research step did not save a record.')
      ctx.log('info', `Steps saved: ${[...done].join(', ')}`)
    }
  }
})
