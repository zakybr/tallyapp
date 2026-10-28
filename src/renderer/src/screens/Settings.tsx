import { useEffect, useState, type ReactNode } from 'react'
import { X, Plus, Download, DatabaseBackup, FolderOpen } from 'lucide-react'
import { PageHeader, Button, Field, Input, Textarea } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { api, useData, nzd } from '@/lib/api'
import { applyTheme } from '@/lib/theme'
import type { Settings as S } from '@shared/domain'
import { localDate } from '@shared/rules'

function Block({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[240px_minmax(0,1fr)] gap-8 border-b border-rule py-7">
      <div>
        <h2 className="display text-[20px]">{title}</h2>
        {body && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      <div className="flex max-w-2xl flex-col gap-4">{children}</div>
    </section>
  )
}

function TagList({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft('') }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className="flex items-center gap-1 rounded-md border border-rule-strong bg-paper-raised py-1 pl-2.5 pr-1 text-[12.5px]">
          {v}<button aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="rounded p-0.5 text-ink-3 hover:bg-paper-2 hover:text-ink"><X size={12} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} placeholder={placeholder}
        className="h-7.5 w-48 rounded-md border border-dashed border-rule-strong bg-transparent px-2 text-[12.5px] focus:border-amber focus:outline-none" />
    </div>
  )
}

export function Settings() {
  const toast = useToast()
  const { data: saved } = useData(() => api.getSettings())
  const { data: conflicts } = useData(() => api.listConflicts())
  const { data: suppression } = useData(() => api.listSuppression())
  const { data: revenue } = useData(() => api.listRevenue())
  const { data: info } = useData(() => api.appInfo())
  const [s, setS] = useState<S>()
  useEffect(() => { if (saved) setS((cur) => cur ?? saved) }, [saved])
  const [conflict, setConflict] = useState({ name: '', domain: '' })
  const [supp, setSupp] = useState('')
  const [rev, setRev] = useState({ amount: '', kind: 'retainer', receivedAt: localDate(), note: '' })

  if (!s) return null
  const commit = async (patch: Partial<S>) => {
    const next = await api.saveSettings(patch)
    setS(next)
    if (patch.theme) applyTheme(patch.theme)
    toast('Saved')
  }
  const num = (v: string) => (v === '' ? 0 : Number(v))
  const rc = s.rateCard

  return (
    <div>
      <PageHeader eyebrow="Edit the rules, not the code" title="Settings" />
      <div className="px-8">
        <Block title="Rate card" body="Used in call scripts, audits and the revenue tracker.">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Onboarding"><Input type="number" value={rc.onboarding} onChange={(e) => setS({ ...s, rateCard: { ...rc, onboarding: num(e.target.value) } })} onBlur={() => void commit({ rateCard: s.rateCard })} /></Field>
            <Field label="Same-day onboarding"><Input type="number" value={rc.onboardingSameDay} onChange={(e) => setS({ ...s, rateCard: { ...rc, onboardingSameDay: num(e.target.value) } })} onBlur={() => void commit({ rateCard: s.rateCard })} /></Field>
            <Field label="Per month"><Input type="number" value={rc.monthly} onChange={(e) => setS({ ...s, rateCard: { ...rc, monthly: num(e.target.value) } })} onBlur={() => void commit({ rateCard: s.rateCard })} /></Field>
            <Field label="Minimum months"><Input type="number" value={rc.minimumMonths} onChange={(e) => setS({ ...s, rateCard: { ...rc, minimumMonths: num(e.target.value) } })} onBlur={() => void commit({ rateCard: s.rateCard })} /></Field>
          </div>
          <Field label="Terms line"><Textarea rows={2} value={rc.note} onChange={(e) => setS({ ...s, rateCard: { ...rc, note: e.target.value } })} onBlur={() => void commit({ rateCard: s.rateCard })} /></Field>
        </Block>

        <Block title="Rules" body="The proposal cap warns before a fourth. GST warns as trailing 12-month revenue nears the threshold.">
          <div className="grid grid-cols-4 gap-3">
            <Field label="Live proposal cap"><Input type="number" value={s.proposalCap} onChange={(e) => setS({ ...s, proposalCap: num(e.target.value) })} onBlur={() => void commit({ proposalCap: s.proposalCap })} /></Field>
            <Field label="Retainer goal"><Input type="number" value={s.retainerTarget} onChange={(e) => setS({ ...s, retainerTarget: num(e.target.value) })} onBlur={() => void commit({ retainerTarget: s.retainerTarget })} /></Field>
            <Field label="GST threshold"><Input type="number" value={s.gstThreshold} onChange={(e) => setS({ ...s, gstThreshold: num(e.target.value) })} onBlur={() => void commit({ gstThreshold: s.gstThreshold })} /></Field>
            <Field label="Warn from"><Input type="number" value={s.gstWarnAt} onChange={(e) => setS({ ...s, gstWarnAt: num(e.target.value) })} onBlur={() => void commit({ gstWarnAt: s.gstWarnAt })} /></Field>
          </div>
        </Block>

        <Block title="Region" body="Areas the Lead Finder searches. Auckland first.">
          <TagList values={s.regions} onChange={(regions) => void commit({ regions })} placeholder="Add an area, press Enter" />
        </Block>
        <Block title="Verticals" body="Categories you are prospecting now.">
          <TagList values={s.verticals} onChange={(verticals) => void commit({ verticals })} placeholder="Add a vertical" />
        </Block>

        <Block title="Conflicts" body="Existing clients and relationships. Prospects that match are ruled out.">
          <div className="flex gap-2">
            <Input placeholder="Business name" value={conflict.name} onChange={(e) => setConflict({ ...conflict, name: e.target.value })} />
            <Input placeholder="domain.co.nz" value={conflict.domain} onChange={(e) => setConflict({ ...conflict, domain: e.target.value })} />
            <Button disabled={!conflict.name.trim()} onClick={async () => { await api.addConflict({ name: conflict.name.trim(), domain: conflict.domain || null }); setConflict({ name: '', domain: '' }) }}><Plus size={14} />Add</Button>
          </div>
          <List items={(conflicts ?? []).map((c) => ({ id: c.id, main: c.name, sub: c.domain ?? '' }))} onRemove={(id) => api.removeConflict(id)} empty="No conflicts recorded." />
        </Block>

        <Block title="Suppression list" body="Unsolicited Electronic Messages Act 2007. Anyone here is never drafted to again. Kept when a person is deleted so the opt-out holds.">
          <div className="flex gap-2">
            <Input placeholder="email@business.co.nz or @domain.co.nz" value={supp} onChange={(e) => setSupp(e.target.value)} />
            <Button disabled={!supp.trim()} onClick={async () => {
              const v = supp.trim().toLowerCase()
              await api.addSuppression(v.startsWith('@') ? { domain: v.slice(1), reason: 'Added by hand' } : { email: v, reason: 'Added by hand' })
              setSupp('')
            }}><Plus size={14} />Suppress</Button>
          </div>
          <List items={(suppression ?? []).map((x) => ({ id: x.id, main: x.email ?? `@${x.domain}`, sub: `${x.reason} · ${new Date(x.createdAt).toLocaleDateString('en-NZ')}` }))} onRemove={(id) => { if (window.confirm('Remove from the suppression list? Only do this if they asked to hear from you again.')) void api.removeSuppression(id) }} empty="Nobody has opted out." />
        </Block>

        <Block title="Revenue" body="Payments received. Drives the GST warning. MRR comes from won clients.">
          <div className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] gap-2">
            <Input type="number" placeholder="Amount" value={rev.amount} onChange={(e) => setRev({ ...rev, amount: e.target.value })} />
            <select value={rev.kind} onChange={(e) => setRev({ ...rev, kind: e.target.value })} className="h-8.5 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]">
              <option value="retainer">Retainer</option><option value="onboarding">Onboarding</option><option value="other">Other</option>
            </select>
            <Input type="date" value={rev.receivedAt} onChange={(e) => setRev({ ...rev, receivedAt: e.target.value })} />
            <Input placeholder="Note" value={rev.note} onChange={(e) => setRev({ ...rev, note: e.target.value })} />
            <Button disabled={!rev.amount} onClick={async () => { await api.addRevenue({ amount: Number(rev.amount), kind: rev.kind as 'retainer', receivedAt: rev.receivedAt, note: rev.note || null, companyId: null }); setRev({ ...rev, amount: '', note: '' }) }}><Plus size={14} />Record</Button>
          </div>
          <List items={(revenue ?? []).map((r) => ({ id: r.id, main: nzd(r.amount), sub: `${r.kind} · ${r.receivedAt}${r.note ? ` · ${r.note}` : ''}` }))} onRemove={(id) => api.removeRevenue(id)} empty="No payments recorded." />
        </Block>

        <Block title="Agents" body="Agents use your Claude Code login (subscription) by default. An API key is an optional fallback, stored in the macOS keychain.">
          <div className="flex gap-2">
            {(['subscription', 'api_key'] as const).map((m) => (
              <button key={m} onClick={() => void commit({ authMode: m })} className={`flex-1 rounded-md border px-3 py-2.5 text-left text-[13px] ${s.authMode === m ? 'border-amber bg-amber-wash' : 'border-rule-strong bg-paper-raised'}`}>
                <div className="font-semibold">{m === 'subscription' ? 'Claude Code login' : 'Anthropic API key'}</div>
                <div className="text-[12px] text-ink-3">{m === 'subscription' ? 'Uses the account you are signed in to with `claude`.' : 'Billed per token to your API account.'}</div>
              </button>
            ))}
          </div>
          <Field label="API key (fallback)" hint="Only used when the mode is set to API key."><Input type="password" value={s.apiKey} placeholder="sk-ant-…" onChange={(e) => setS({ ...s, apiKey: e.target.value })} onBlur={() => void commit({ apiKey: s.apiKey })} /></Field>
          <Field label="Google Places API key" hint="Optional. When set, the Lead Finder uses the official Places API instead of web search. Paid by Google per request."><Input type="password" value={s.placesApiKey} onChange={(e) => setS({ ...s, placesApiKey: e.target.value })} onBlur={() => void commit({ placesApiKey: s.placesApiKey })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model" hint="Blank uses the Claude Code default."><Input value={s.model} placeholder="default" onChange={(e) => setS({ ...s, model: e.target.value })} onBlur={() => void commit({ model: s.model })} /></Field>
            <Field label="Site audit delay (ms)" hint="Pause between page loads on one site."><Input type="number" value={s.auditDelayMs} onChange={(e) => setS({ ...s, auditDelayMs: num(e.target.value) })} onBlur={() => void commit({ auditDelayMs: s.auditDelayMs })} /></Field>
          </div>
        </Block>

        <Block title="Sender" body="Your details, used in drafts and the audit PDF.">
          <div className="grid grid-cols-2 gap-3">
            {(['name', 'company', 'phone', 'email', 'website'] as const).map((k) => (
              <Field key={k} label={k}><Input value={s.sender[k]} onChange={(e) => setS({ ...s, sender: { ...s.sender, [k]: e.target.value } })} onBlur={() => void commit({ sender: s.sender })} /></Field>
            ))}
          </div>
        </Block>

        <Block title="Privacy" body="Privacy Act 2020 and the Unsolicited Electronic Messages Act 2007.">
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-relaxed text-ink-2">
            <li><b>What is kept:</b> business contact details needed for outreach (name, role, business email and phone, and where each was found). No home addresses, personal accounts or private details.</li>
            <li><b>Where:</b> one SQLite file and its screenshots on this Mac. Nothing is uploaded to a Tally server. Backups and CSV exports contain personal information: keep them on encrypted storage (FileVault).</li>
            <li><b>Agents:</b> research and drafting send business details to Anthropic for processing through your Claude account. That is an overseas disclosure (IPP 12), so keep it to business details. In claude.ai → Settings → Privacy, turn off the option that lets your chats be used to improve models.</li>
            <li><b>Requests:</b> on each contact, the export button saves everything held about that person (access, IPP 6), fields can be corrected inline (IPP 7), and delete removes them everywhere (IPP 9).</li>
            <li><b>Opt-outs:</b> the suppression list survives deletion so an opt-out is honoured for good.</li>
          </ul>
          <div className="flex items-end gap-3">
            <div className="w-56"><Field label="Delete contacts after (months)" hint="Counted from when a prospect is closed as Pass or Lost. 0 turns this off."><Input type="number" value={s.retentionMonths} onChange={(e) => setS({ ...s, retentionMonths: num(e.target.value) })} onBlur={() => void commit({ retentionMonths: s.retentionMonths })} /></Field></div>
            <Button onClick={async () => { const r = await api.runRetention(); toast(r.people ? `Removed ${r.people} contacts from ${r.companies} closed prospects` : 'Nothing due for deletion') }}>Run now</Button>
          </div>
        </Block>

        <Block title="Appearance">
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <Button key={t} variant={s.theme === t ? 'primary' : 'secondary'} onClick={() => void commit({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</Button>
            ))}
          </div>
        </Block>

        <Block title="Data" body="Everything lives in one SQLite file on this Mac.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={async () => { const r = await api.exportCsv(); if (r) { toast(`Exported ${r.files.length} tables`); void api.revealPath(r.files[0]) } }}><Download size={14} />Export CSV</Button>
            <Button variant="primary" onClick={async () => { const r = await api.backup(); if (r) { toast('Backup saved'); void api.revealPath(r.file) } }}><DatabaseBackup size={14} />Full backup</Button>
            {info && <Button variant="ghost" onClick={() => void api.revealPath(`${info.userDataPath}/tally.db`)}><FolderOpen size={14} />Show data folder</Button>}
          </div>
          {info && <div className="mono text-ink-3">{info.userDataPath} · v{info.version}</div>}
        </Block>
      </div>
    </div>
  )
}

function List({ items, onRemove, empty }: { items: { id: number; main: string; sub: string }[]; onRemove: (id: number) => unknown; empty: string }) {
  if (!items.length) return <p className="text-[12.5px] text-ink-3">{empty}</p>
  return (
    <ul className="divide-y divide-rule rounded-md border border-rule bg-paper-raised">
      {items.map((i) => (
        <li key={i.id} className="flex items-center justify-between px-3 py-2">
          <div><div className="num text-[14px] font-medium">{i.main}</div><div className="text-[11.5px] text-ink-3">{i.sub}</div></div>
          <button onClick={() => void onRemove(i.id)} aria-label="Remove" className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"><X size={14} /></button>
        </li>
      ))}
    </ul>
  )
}
