import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button, Field, Input } from './ui'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useToast } from './Toast'
import type { Settings } from '@shared/domain'
import { findDuplicate } from '@shared/rules'

export function AddProspect({ open, onClose, settings }: { open: boolean; onClose: () => void; settings?: Settings }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', website: '', phone: '', area: '', vertical: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.name.trim()) return
    const all = await api.listCompanies()
    const dup = findDuplicate(f, all)
    if (dup) { toast('Already in the pipeline. Opening it.', 'warn'); onClose(); navigate({ name: 'prospect', id: dup }); return }
    const c = await api.createCompany({ name: f.name.trim(), website: f.website || null, phone: f.phone || null, area: f.area || null, vertical: f.vertical || null, source: 'Added by hand' })
    setF({ name: '', website: '', phone: '', area: '', vertical: '' })
    onClose()
    navigate({ name: 'prospect', id: c.id })
  }
  const sel = 'h-8.5 w-full rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]'
  return (
    <Dialog open={open} onClose={onClose} title="Add a prospect">
      <form className="grid grid-cols-2 gap-3.5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <div className="col-span-2"><Field label="Business name"><Input autoFocus value={f.name} onChange={set('name')} placeholder="White Pointer Boats" /></Field></div>
        <Field label="Website"><Input value={f.website} onChange={set('website')} placeholder="whitepointerboats.co.nz" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Area">
          <select className={sel} value={f.area} onChange={set('area')}>
            <option value="">—</option>{settings?.regions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Vertical">
          <select className={sel} value={f.vertical} onChange={set('vertical')}>
            <option value="">—</option>{settings?.verticals.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!f.name.trim()}>Add prospect</Button>
        </div>
      </form>
    </Dialog>
  )
}
