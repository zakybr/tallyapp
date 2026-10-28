import { useState } from 'react'
import { Check, X, CircleHelp, ExternalLink, ImageOff } from 'lucide-react'
import { fileUrl, ago, domainOf } from '@/lib/api'
import { Dialog } from '../Dialog'
import { CATEGORY_LABEL, GAP_LABEL, GAP_TYPES, GATES, GATE_LABEL, RULE_OUT_LABEL, type InstagramBenchmarkRow, type ResearchRecord, type Score } from '@shared/domain'

export function VerdictCard({ score }: { score: Score }) {
  const icon = (s: string) => s === 'pass' ? <Check size={14} className="text-go" /> : s === 'fail' ? <X size={14} className="text-pass" /> : <CircleHelp size={14} className="text-conv" />
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="label mb-2">Gates</div>
        <ul className="flex flex-col gap-2">
          {GATES.map((g) => (
            <li key={g} className="flex gap-2">
              <span className="mt-0.5">{icon(score.gates[g].status)}</span>
              <div><div className="text-[13px] font-semibold">{GATE_LABEL[g]} <span className="font-normal text-ink-3">· {score.gates[g].status}</span></div><div className="selectable text-[12.5px] text-ink-2">{score.gates[g].reason}</div></div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="label mb-2">Gaps checklist</div>
          <ul className="flex flex-col gap-1.5">
            {GAP_TYPES.map((t) => {
              const hit = score.verifiedGaps.filter((g) => g.type === t)
              return (
                <li key={t} className="flex gap-2 text-[13px]">
                  <span className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${hit.length ? 'border-amber bg-amber text-on-amber' : 'border-rule-strong'}`}>{hit.length > 0 && <Check size={10} strokeWidth={3} />}</span>
                  <div>
                    <span className={hit.length ? 'font-semibold' : 'text-ink-3'}>{GAP_LABEL[t]}</span>
                    {hit.map((g, i) => <div key={i} className="selectable text-[12.5px] text-ink-2">{g.evidence}{g.sourceUrl && <a className="ml-1 text-amber-ink hover:underline" href={g.sourceUrl} target="_blank" rel="noreferrer">{domainOf(g.sourceUrl)}</a>}</div>)}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        {score.ruleOuts.length > 0 && (
          <div>
            <div className="label mb-1.5 text-pass">Rule-outs</div>
            {score.ruleOuts.map((r, i) => <div key={i} className="text-[12.5px]"><span className="font-semibold">{RULE_OUT_LABEL[r.type]}</span> · {r.reason}</div>)}
          </div>
        )}
        {score.firstCallQuestion && (
          <div className="rounded-md bg-amber-wash px-3 py-2">
            <div className="label mb-0.5 text-amber-ink">First-call question</div>
            <div className="selectable text-[13px]">{score.firstCallQuestion}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EvidenceList({ research }: { research: ResearchRecord[] }) {
  const [zoom, setZoom] = useState<ResearchRecord | null>(null)
  const groups = new Map<string, ResearchRecord[]>()
  for (const r of research) groups.set(r.category, [...(groups.get(r.category) ?? []), r])
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([cat, items]) => (
        <div key={cat}>
          <div className="label mb-2">{CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}</div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {items.map((r) => (
              <article key={r.id} className={`flex gap-3 rounded-md border bg-paper-raised p-3 ${r.gapType && r.verified ? 'border-amber/60' : 'border-rule'}`}>
                {r.screenshotPath ? (
                  <button onClick={() => setZoom(r)} className="h-[68px] w-[96px] shrink-0 overflow-hidden rounded border border-rule bg-paper-2" aria-label="Open screenshot">
                    <img src={fileUrl(r.screenshotPath)} alt="" className="h-full w-full object-cover object-top" />
                  </button>
                ) : (
                  <div className="flex h-[68px] w-[96px] shrink-0 items-center justify-center rounded border border-dashed border-rule text-ink-3"><ImageOff size={16} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="selectable text-[13px] leading-snug text-ink">{r.finding}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
                    {r.gapType && <span className={`rounded px-1.5 py-px font-medium ${r.verified ? 'bg-amber-wash text-amber-ink' : 'bg-paper-2'}`}>{GAP_LABEL[r.gapType]}</span>}
                    <span className={r.verified ? 'text-go' : 'text-conv'}>{r.verified ? 'Verified' : 'Unverified'}</span>
                    {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-amber-ink hover:underline">{domainOf(r.sourceUrl)}<ExternalLink size={10} /></a>}
                    <span title={r.checkedAt}>checked {ago(r.checkedAt)}</span>
                    {r.pagesChecked.length > 1 && <span title={r.pagesChecked.join('\n')}>{r.pagesChecked.length} pages</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
      <Dialog open={!!zoom} onClose={() => setZoom(null)} title="Evidence" width={980}>
        {zoom?.screenshotPath && <img src={fileUrl(zoom.screenshotPath)} alt="" className="max-h-[68vh] w-full rounded border border-rule object-contain object-top" />}
        <p className="selectable mt-3 text-[13px]">{zoom?.finding}</p>
        <div className="mono mt-1 text-ink-3">{zoom?.pagesChecked.join('  ·  ')}</div>
      </Dialog>
    </div>
  )
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
const n = (v: number | null, f = (x: number) => x.toLocaleString('en-NZ')) => (v == null ? <span className="text-ink-3">not published</span> : f(v))

export function Benchmark({ rows }: { rows: InstagramBenchmarkRow[] }) {
  const peers = rows.filter((r) => !r.isProspect)
  const prospect = rows.find((r) => r.isProspect)
  const mFollowers = median(peers.map((p) => p.followers).filter((x): x is number => x != null))
  const mPosts = median(peers.map((p) => p.postsLast30).filter((x): x is number => x != null))
  const below = prospect && ((mFollowers && prospect.followers != null && prospect.followers < mFollowers / 2) || (mPosts && prospect.postsLast30 != null && prospect.postsLast30 < mPosts / 2))
  return (
    <div>
      {below && <div className="mb-3 rounded-md bg-conv-wash px-3 py-2 text-[12.5px] text-conv">Well below the peer median{mFollowers ? ` (median ${mFollowers.toLocaleString('en-NZ')} followers` : ''}{mPosts ? `, ${mPosts} posts in 30 days` : ''}{mFollowers ? ')' : ''}.</div>}
      <table className="w-full border-collapse text-left text-[13px]">
        <thead><tr className="border-b border-rule-strong">{['Account', 'Followers', 'Posts, 30 days', 'Reels share', 'Avg engagement', 'Source'].map((h) => <th key={h} className="label py-2 pr-4">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.handle} className={`border-b border-rule ${r.isProspect ? 'bg-amber-wash/60 font-semibold' : ''}`}>
              <td className="py-2 pr-4">@{r.handle.replace(/^@/, '')}{r.isProspect && <span className="ml-1.5 text-[11px] font-medium text-amber-ink">prospect</span>}</td>
              <td className="num py-2 pr-4 text-[15px]">{n(r.followers)}</td>
              <td className="num py-2 pr-4 text-[15px]">{n(r.postsLast30)}</td>
              <td className="num py-2 pr-4 text-[15px]">{n(r.reelsShare, (x) => `${Math.round(x * 100)}%`)}</td>
              <td className="num py-2 pr-4 text-[15px]">{n(r.avgEngagement, (x) => `${(x * 100).toFixed(1)}%`)}</td>
              <td className="py-2 pr-4 text-[12px]">{r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-amber-ink hover:underline">{domainOf(r.sourceUrl)}</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
