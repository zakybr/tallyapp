import { useMemo, useState } from 'react'
import { Plus, Star, Upload, Copy, Trash2, RotateCcw, FolderInput, MoreHorizontal, LayoutTemplate } from 'lucide-react'
import { PageHeader, Button, Field, Input } from '@/components/ui'
import { EmptyState } from '@/components/Tally'
import { Dialog } from '@/components/Dialog'
import { useToast } from '@/components/Toast'
import { usePrompt } from '@/components/usePrompt'
import { api, useData, ago, fileUrl } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import type { BoardMeta } from '@shared/boards'

type Tab = 'all' | 'favourites' | 'templates' | 'trash'

export function Boards({ tab = 'all' }: { tab?: Tab }) {
  const toast = useToast()
  const { data: boards } = useData(() => api.listBoards({ trashed: tab === 'trash', templates: tab === 'templates' }), [tab])
  const { data: templates } = useData(() => api.listBoards({ templates: true }))
  const [q, setQ] = useState('')
  const [folder, setFolder] = useState('')
  const [creating, setCreating] = useState(false)
  const folders = useMemo(() => [...new Set((boards ?? []).map((b) => b.folder).filter(Boolean))].sort(), [boards])
  const shown = (boards ?? []).filter((b) =>
    (tab !== 'favourites' || b.favourite) &&
    (!folder || b.folder === folder) &&
    (!q || `${b.name} ${b.tags.join(' ')} ${b.folder}`.toLowerCase().includes(q.toLowerCase()))
  )
  const tabs: [Tab, string][] = [['all', 'All'], ['favourites', 'Favourites'], ['templates', 'Templates'], ['trash', 'Trash']]

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        eyebrow="Diagrams and walkthroughs you can show people"
        title="Boards"
        actions={<>
          <div className="flex rounded-md border border-rule-strong p-0.5">
            {tabs.map(([t, label]) => <a key={t} href={href({ name: 'boards', tab: t })} className={`flex h-7 items-center rounded px-3 text-[12.5px] ${tab === t ? 'bg-paper-3 text-ink' : 'text-ink-3 hover:text-ink'}`}>{label}</a>)}
          </div>
          <Button onClick={async () => { const b = await api.importTallyboard(); if (b) { toast(`Imported "${b.name}"`); navigate({ name: 'board', id: b.id }) } }}><Upload size={14} />Import</Button>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} />New board</Button>
        </>}
      />
      <div className="flex items-center gap-2 border-b border-rule px-8 py-2.5">
        <input className="h-8 w-64 rounded-md border border-rule-strong bg-paper-raised px-2.5 text-[12.5px]" placeholder="Search by name or tag" value={q} onChange={(e) => setQ(e.target.value)} />
        {folders.length > 0 && (
          <select aria-label="Folder" className="h-8 rounded-md border border-rule-strong bg-paper-raised px-2 text-[12.5px]" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
      </div>
      {boards && shown.length === 0 ? (
        tab === 'trash' ? <EmptyState title="Trash is empty" body="Deleted boards stay here for 30 days." />
          : tab === 'templates' ? <EmptyState title="No templates yet" body="Open any board and choose Save as template." />
          : <EmptyState title="No boards yet" body="Start one to explain a system to a client or director." action={<Button variant="primary" onClick={() => setCreating(true)}>New board</Button>} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 px-8 py-6">
          {shown.map((b) => <BoardCard key={b.id} board={b} tab={tab} />)}
        </div>
      )}
      <NewBoard open={creating} onClose={() => setCreating(false)} templates={templates ?? []} />
    </div>
  )
}

function BoardCard({ board: b, tab }: { board: BoardMeta; tab: Tab }) {
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [promptNode, ask] = usePrompt()
  const open = () => { if (tab !== 'trash') navigate({ name: 'board', id: b.id }) }
  const act = async (fn: () => Promise<unknown>, msg?: string) => { setMenu(false); await fn(); if (msg) toast(msg) }
  return (
    <article onMouseLeave={() => setMenu(false)} className="group relative overflow-hidden rounded-lg border border-rule bg-paper-raised transition hover:border-rule-strong hover:shadow-sm">
      <button onClick={open} className="block aspect-[16/10] w-full overflow-hidden border-b border-rule bg-[#F2EDE4]" aria-label={`Open ${b.name}`}>
        {b.thumbnail ? <img src={`${fileUrl(b.thumbnail)}&v=${encodeURIComponent(b.updatedAt)}`} alt="" className="h-full w-full object-contain" /> : <span className="label">Empty board</span>}
      </button>
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">{b.name}</div>
          <div className="truncate text-[11.5px] text-ink-3">{[b.folder, ...b.tags].filter(Boolean).join(' · ') || ago(b.updatedAt)}</div>
          {b.links.length > 0 && <div className="truncate text-[11.5px] text-amber-ink">{b.links.map((l) => l.label).join(', ')}</div>}
        </div>
        {tab !== 'trash' && tab !== 'templates' && (
          <button aria-label={b.favourite ? 'Unfavourite' : 'Favourite'} onClick={() => void api.updateBoard(b.id, { favourite: !b.favourite })} className={`rounded p-1 ${b.favourite ? 'text-amber' : 'text-ink-3 opacity-0 group-hover:opacity-100'}`}><Star size={15} fill={b.favourite ? 'currentColor' : 'none'} /></button>
        )}
        <button aria-label="Board menu" onClick={() => setMenu((m) => !m)} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink"><MoreHorizontal size={15} /></button>
      </div>
      {promptNode}
      {menu && (
        <div className="absolute bottom-12 right-2 z-20 flex w-48 flex-col rounded-md border border-rule-strong bg-paper-raised py-1 text-[13px] shadow-lg">
          {tab === 'trash' ? (<>
            <MenuItem icon={RotateCcw} onClick={() => act(() => api.restoreBoard(b.id), 'Restored')}>Restore</MenuItem>
            <MenuItem icon={Trash2} danger onClick={() => { if (window.confirm(`Delete "${b.name}" for good? Its media goes too.`)) void act(() => api.purgeBoard(b.id), 'Deleted') }}>Delete for good</MenuItem>
          </>) : (<>
            {tab === 'templates' && <MenuItem icon={LayoutTemplate} onClick={() => act(async () => { const n = await api.createBoard(b.name, b.id); navigate({ name: 'board', id: n.id }) })}>New board from this</MenuItem>}
            <MenuItem icon={Copy} onClick={() => act(() => api.createBoard(`${b.name} copy`, b.id), 'Duplicated')}>Duplicate</MenuItem>
            {tab !== 'templates' && <MenuItem icon={FolderInput} onClick={async () => { setMenu(false); const f = await ask('Move to folder', b.folder); if (f !== null) await api.updateBoard(b.id, { folder: f }) }}>Move to folder…</MenuItem>}
            <MenuItem icon={Trash2} danger onClick={() => act(() => api.trashBoard(b.id), 'Moved to trash')}>Delete</MenuItem>
          </>)}
        </div>
      )}
    </article>
  )
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: typeof Copy; children: React.ReactNode; onClick: () => unknown; danger?: boolean }) {
  return <button onClick={() => void onClick()} className={`flex items-center gap-2 px-3 py-1.5 text-left hover:bg-paper-2 ${danger ? 'text-danger' : ''}`}><Icon size={14} />{children}</button>
}

function NewBoard({ open, onClose, templates }: { open: boolean; onClose: () => void; templates: BoardMeta[] }) {
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const create = async () => {
    const b = await api.createBoard(name.trim() || 'Untitled board', from || undefined)
    setName(''); setFrom(''); onClose()
    navigate({ name: 'board', id: b.id })
  }
  return (
    <Dialog open={open} onClose={onClose} title="New board">
      <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); void create() }}>
        <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Enquiry-to-revenue system" /></Field>
        <Field label="Start from">
          <select aria-label="Start from" className="h-8.5 rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">A blank board</option>{templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Create board</Button></div>
      </form>
    </Dialog>
  )
}
