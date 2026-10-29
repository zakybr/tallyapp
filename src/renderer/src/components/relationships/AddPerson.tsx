import { useState } from 'react'
import { Dialog } from '../Dialog'
import { Button, Field, Input, Textarea } from '../ui'
import { Combobox } from '../Combobox'
import { api, useData } from '@/lib/api'
import { navigate } from '@/lib/router'
import { AREA_CATALOG, CATEGORY_CATALOG } from '@shared/catalog'

const empty = { name: '', role: '', company: '', email: '', emailSourceUrl: '', phone: '', linkedinUrl: '', howMet: '', introducedBy: '', interests: '', industry: '', region: '' }

export function AddPerson({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: companies } = useData(() => api.listCompanies())
  const [f, setF] = useState(empty)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    if (!f.name.trim()) return
    let companyId: number | null = null
    if (f.company.trim()) {
      const match = companies?.find((c) => c.name.toLowerCase() === f.company.trim().toLowerCase())
      companyId = match ? match.id : (await api.createCompany({ name: f.company.trim(), source: 'Relationships' })).id
    }
    const p = await api.createPerson({
      name: f.name.trim(), role: f.role || null, companyId, email: f.email || null, emailSourceUrl: f.emailSourceUrl || null,
      phone: f.phone || null, linkedinUrl: f.linkedinUrl || null, howMet: f.howMet || null, introducedBy: f.introducedBy || null,
      interests: f.interests || null, tags: [f.industry, f.region].filter(Boolean)
    })
    setF(empty)
    onClose()
    navigate({ name: 'person', id: p.id })
  }
  return (
    <Dialog open={open} onClose={onClose} title="Add a person" width={640}>
      <form className="grid grid-cols-2 gap-3.5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <Field label="Name"><Input autoFocus value={f.name} onChange={set('name')} placeholder="Sam Fictional" /></Field>
        <Field label="Role"><Input value={f.role} onChange={set('role')} placeholder="Director" /></Field>
        <Field label="Company"><Input list="rel-companies" value={f.company} onChange={set('company')} placeholder="Harbour Hulls Ltd" /></Field>
        <datalist id="rel-companies">{companies?.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <Field label="How we met or who introduced us"><Input value={f.howMet} onChange={set('howMet')} placeholder="Boat show, Auckland" /></Field>
        <Field label="Email" hint="Only one they published or gave you."><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Where the email was found"><Input value={f.emailSourceUrl} onChange={set('emailSourceUrl')} placeholder="https://… or 'gave it to me'" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="LinkedIn URL" hint="Paste only. Tally never visits LinkedIn."><Input value={f.linkedinUrl} onChange={set('linkedinUrl')} /></Field>
        <Field label="Industry"><Combobox label="Industry" value={f.industry} onChange={(industry) => setF({ ...f, industry })} groups={CATEGORY_CATALOG} placeholder="Boat builders" /></Field>
        <Field label="Region"><Combobox label="Region" value={f.region} onChange={(region) => setF({ ...f, region })} groups={AREA_CATALOG} placeholder="Hibiscus Coast" /></Field>
        <div className="col-span-2"><Field label="Interests they mentioned"><Textarea rows={2} value={f.interests} onChange={set('interests')} placeholder="Restoring a 1970s launch, coaches junior rugby" /></Field></div>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!f.name.trim()}>Add person</Button>
        </div>
      </form>
    </Dialog>
  )
}
