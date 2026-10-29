import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button, Field, Input } from './ui'
import { api } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useToast } from './Toast'
import type { Settings } from '@shared/domain'
import { findDuplicate } from '@shared/rules'
import { Combobox } from './Combobox'
import { AREA_CATALOG, CATEGORY_CATALOG } from '@shared/catalog'

export function AddProspect({ open, onClose, settings }: { open: boolean; onClose: () => void; settings?: Settings }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', website: '', phone: '', area: '', vertical: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
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
  return (
    <Dialog open={open} onClose={onClose} title="Add a prospect">
      <form className="grid grid-cols-2 gap-3.5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <div className="col-span-2"><Field label="Business name"><Input autoFocus value={f.name} onChange={set('name')} placeholder="White Pointer Boats" /></Field></div>
        <Field label="Website"><Input value={f.website} onChange={set('website')} placeholder="whitepointerboats.co.nz" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Area"><Combobox label="Area" value={f.area} onChange={(area) => setF({ ...f, area })} groups={[{ group: 'Your region', items: settings?.regions ?? [] }, ...AREA_CATALOG]} /></Field>
        <Field label="Vertical"><Combobox label="Vertical" value={f.vertical} onChange={(vertical) => setF({ ...f, vertical })} groups={[{ group: 'Your focus', items: settings?.verticals ?? [] }, ...CATEGORY_CATALOG]} /></Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!f.name.trim()}>Add prospect</Button>
        </div>
      </form>
    </Dialog>
  )
}
