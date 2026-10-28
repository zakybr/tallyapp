import { ArrowLeft, ExternalLink, Phone, Trash2 } from 'lucide-react'
import { api, useData, domainOf } from '@/lib/api'
import { navigate } from '@/lib/router'
import { VerdictBadge, Section } from '@/components/ui'
import { InlineField } from '@/components/InlineField'
import { Contacts } from '@/components/prospect/Contacts'
import { Timeline } from '@/components/prospect/Timeline'
import { TallyLoader } from '@/components/Tally'
import { useToast } from '@/components/Toast'
import { moveStage } from './Pipeline'
import { STAGES, STAGE_LABEL, type CompanyPatch, type Stage } from '@shared/domain'
import { competingProspects } from '@shared/rules'

export function Prospect({ id }: { id: number }) {
  const toast = useToast()
  const { data: d } = useData(() => api.getCompany(id), [id])
  const { data: all } = useData(() => api.listCompanies())
  const { data: settings } = useData(() => api.getSettings())
  const { data: suppression } = useData(() => api.listSuppression())

  if (d === undefined) return <div className="p-10"><TallyLoader label="Loading" /></div>
  if (d === null) return <div className="p-10 text-ink-3">That prospect no longer exists.</div>
  const c = d.company
  const save = (patch: CompanyPatch) => api.updateCompany(id, patch)
  const competing = all ? competingProspects(c, all) : []

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule px-8 pb-5 pt-6">
        <button onClick={() => navigate({ name: 'pipeline' })} className="mb-3 flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"><ArrowLeft size={14} />Pipeline</button>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="display truncate text-[40px] text-ink">{c.name}</h1>
              <VerdictBadge verdict={c.verdict} large />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              {c.legalName && c.legalName !== c.name && <span>{c.legalName}</span>}
              {c.website && <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-amber-ink hover:underline">{domainOf(c.website)}<ExternalLink size={12} /></a>}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-ink"><Phone size={12} />{c.phone}</a>}
              {[c.area, c.vertical].filter(Boolean).join(' · ')}
            </div>
            {c.verdictReason && <p className="mt-2 max-w-3xl text-[13.5px] text-ink">{c.verdictReason}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2" id="prospect-actions">
            <select
              aria-label="Stage"
              value={c.stage}
              onChange={(e) => all && settings && void moveStage(c, e.target.value as Stage, all, settings.proposalCap, toast)}
              className="h-8.5 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px] font-medium"
            >
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        {competing.length > 0 && (
          <div className="mt-3 rounded-md bg-conv-wash px-3 py-2 text-[12.5px] text-conv">
            Competes with {competing.map((o) => o.name).join(', ')} ({c.vertical}, {c.area}). Pick one to pitch.
          </div>
        )}
        {c.offsiteOnly && <div className="mt-3 rounded-md bg-conv-wash px-3 py-2 text-[12.5px] text-conv">Site built by family or friends. Pitch off-site work only.</div>}
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] gap-8 px-8 py-6">
        <div className="flex min-w-0 flex-col gap-8" id="prospect-main">
          <ProspectWork id={id} />
        </div>
        <aside className="flex flex-col gap-7">
          <Section title="Next step">
            <InlineField value={c.nextStep} placeholder="What happens next" onSave={(v) => save({ nextStep: v })} />
            <InlineField type="date" value={c.nextStepDue?.slice(0, 10) ?? null} onSave={(v) => save({ nextStepDue: v })} className="mt-1 text-ink-2" />
          </Section>
          <Section title="Facts">
            <dl className="grid grid-cols-[86px_1fr] items-center gap-x-2 gap-y-0.5 text-[12.5px]">
              {([
                ['Name', 'name'], ['Legal name', 'legalName'], ['Website', 'website'], ['Phone', 'phone'], ['Address', 'address'],
                ['Area', 'area'], ['Vertical', 'vertical'], ['Google', 'googleListingUrl']
              ] as const).map(([label, key]) => (
                <div key={key} className="contents">
                  <dt className="text-ink-3">{label}</dt>
                  <dd><InlineField value={c[key]} onSave={(v) => save({ [key]: key === 'name' ? v ?? c.name : v })} /></dd>
                </div>
              ))}
              <dt className="text-ink-3">$/month</dt>
              <dd><InlineField type="number" value={c.monthlyValue?.toString() ?? null} placeholder={settings ? String(settings.rateCard.monthly) : ''} onSave={(v) => save({ monthlyValue: v ? Number(v) : null })} /></dd>
              <dt className="text-ink-3">Off-site only</dt>
              <dd><input type="checkbox" checked={c.offsiteOnly} onChange={(e) => void save({ offsiteOnly: e.target.checked })} className="accent-[var(--amber)]" /></dd>
            </dl>
          </Section>
          <Section title="Contacts"><Contacts companyId={id} contacts={d.contacts} suppression={suppression ?? []} /></Section>
          <Section title="Notes"><InlineField multiline value={c.notes} placeholder="Anything worth remembering" onSave={(v) => save({ notes: v })} /></Section>
          <Section title="Timeline"><Timeline companyId={id} activities={d.activities} /></Section>
          <button
            onClick={async () => { if (window.confirm(`Delete ${c.name} and everything recorded about it?`)) { await api.deleteCompany(id); navigate({ name: 'pipeline' }) } }}
            className="flex items-center gap-1.5 self-start text-[12px] text-ink-3 hover:text-danger"
          ><Trash2 size={13} />Delete company</button>
        </aside>
      </div>
    </div>
  )
}

/* Agent-produced sections (evidence, score, drafts) arrive in phases 4 and 5. */
function ProspectWork({ id }: { id: number }) {
  void id
  return null
}
