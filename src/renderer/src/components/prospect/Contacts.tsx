import { useState } from 'react'
import { Plus, Trash2, ShieldAlert, Ban, FileDown } from 'lucide-react'
import { api } from '@/lib/api'
import { InlineField } from '../InlineField'
import { useToast } from '../Toast'
import { CONSENT_BASES, CONSENT_LABEL, type Contact, type ConsentBasis, type Suppression } from '@shared/domain'
import { isSuppressed } from '@shared/rules'

export function Contacts({ companyId, contacts, suppression }: { companyId: number; contacts: Contact[]; suppression: Suppression[] }) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const save = (c: Contact, patch: Partial<Contact>) => api.upsertContact({ id: c.id, companyId, ...patch })

  const remove = async (c: Contact) => {
    if (!window.confirm(`Delete ${c.name ?? c.email ?? 'this person'} and all their data? This removes the contact, any drafts addressed to them, and scrubs them from the timeline. It cannot be undone.`)) return
    const r = await api.deletePerson(c.id)
    toast(`Deleted. ${r.removedDrafts} draft${r.removedDrafts === 1 ? '' : 's'} removed.`)
  }
  const optOut = async (c: Contact) => {
    if (!c.email) return
    await api.addSuppression({ email: c.email, reason: 'Opted out' })
    await api.addNote(companyId, 'A contact opted out. Their address is on the suppression list.')
    toast('Added to the suppression list. They will never be drafted to again.')
  }

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c) => {
        const suppressed = isSuppressed(c.email, suppression)
        const risky = c.email && (c.consentBasis === 'guessed' || c.consentBasis === 'unknown' || !c.emailSourceUrl)
        return (
          <div key={c.id} className="group rounded-md border border-rule bg-paper-raised p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <InlineField value={c.name} placeholder="Name" className="font-semibold" onSave={(v) => save(c, { name: v })} />
                <InlineField value={c.role} placeholder="Role" className="text-ink-2" onSave={(v) => save(c, { role: v })} />
              </div>
              <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                {c.email && !suppressed && <button title="Opted out: add to suppression list" onClick={() => void optOut(c)} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"><Ban size={14} /></button>}
                <button title="Export everything held on this person (Privacy Act access request)" onClick={async () => { const r = await api.exportPerson(c.id); if (r) { toast('Saved. Send them this file.'); void api.revealPath(r.file) } }} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"><FileDown size={14} /></button>
                <button title="Delete this person (Privacy Act)" onClick={() => void remove(c)} className="rounded p-1 text-ink-3 hover:bg-pass-wash hover:text-danger"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="mt-1 grid grid-cols-[64px_1fr] items-center gap-x-2 text-[12.5px]">
              <span className="text-ink-3">Email</span><InlineField value={c.email} placeholder="name@business.co.nz" onSave={(v) => save(c, { email: v?.toLowerCase() ?? null })} />
              <span className="text-ink-3">Phone</span><InlineField value={c.phone} placeholder="—" onSave={(v) => save(c, { phone: v })} />
              <span className="text-ink-3">Found at</span><InlineField value={c.emailSourceUrl} placeholder="URL where the email is published" onSave={(v) => save(c, { emailSourceUrl: v })} />
              <span className="text-ink-3">Basis</span>
              <select value={c.consentBasis} onChange={(e) => void save(c, { consentBasis: e.target.value as ConsentBasis })} className="-mx-1 h-7 rounded border border-transparent bg-transparent px-1 text-[12.5px] hover:border-rule">
                {CONSENT_BASES.map((b) => <option key={b} value={b}>{CONSENT_LABEL[b]}</option>)}
              </select>
            </div>
            {suppressed && <div className="mt-2 flex items-center gap-1.5 rounded bg-pass-wash px-2 py-1 text-[12px] text-pass"><Ban size={13} />Opted out. Never draft to this address.</div>}
            {!suppressed && risky && <div className="mt-2 flex items-center gap-1.5 rounded bg-conv-wash px-2 py-1 text-[12px] text-conv"><ShieldAlert size={13} />Not confirmed as conspicuously published.</div>}
          </div>
        )
      })}
      {adding ? null : (
        <button onClick={async () => { setAdding(true); await api.upsertContact({ companyId, consentBasis: 'unknown' }); setAdding(false) }} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-rule-strong text-[12.5px] text-ink-3 hover:border-amber hover:text-ink">
          <Plus size={14} />Add contact
        </button>
      )}
    </div>
  )
}
