import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CatalogGroup } from '@shared/catalog'

/*
  Free-text input with a grouped, searchable dropdown. Typing filters; the
  arrow keys move, Enter picks, Escape closes. Anything typed is allowed.
*/
export function Combobox({ value, onChange, groups, placeholder, label }: {
  value: string
  onChange: (v: string) => void
  groups: CatalogGroup[]
  placeholder?: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const seen = new Set<string>()
    return groups
      .map((g) => ({ group: g.group, items: g.items.filter((i) => { const k = i.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return !q || k.includes(q) }) }))
      .filter((g) => g.items.length)
  }, [groups, query])
  const flat = filtered.flatMap((g) => g.items)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const pick = (v: string) => { onChange(v); setQuery(''); setOpen(false) }
  let i = -1
  return (
    <div ref={wrap} className="relative">
      <div className="flex h-8.5 items-center rounded-md border border-rule-strong bg-paper-raised focus-within:border-amber">
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          value={open ? query || value : value}
          placeholder={placeholder}
          onFocus={(e) => { setOpen(true); setQuery(''); e.currentTarget.select() }}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && open && flat[active]) { e.preventDefault(); pick(flat[active]) }
            else if (e.key === 'Escape') setOpen(false)
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button type="button" tabIndex={-1} aria-label={`Show ${label} options`} onClick={() => setOpen((o) => !o)} className="px-2 text-ink-3 hover:text-ink"><ChevronDown size={15} /></button>
      </div>
      {open && flat.length > 0 && (
        <ul ref={list} role="listbox" className="scroll-quiet absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-80 overflow-y-auto rounded-md border border-rule-strong bg-paper-raised py-1 shadow-xl">
          {filtered.map((g) => (
            <li key={g.group}>
              <div className="label sticky top-0 bg-paper-raised px-3 pb-1 pt-2">{g.group}</div>
              <ul>
                {g.items.map((item) => {
                  i++
                  const idx = i
                  return (
                    <li
                      key={item}
                      data-i={idx}
                      role="option"
                      aria-selected={idx === active}
                      onMouseEnter={() => setActive(idx)}
                      onMouseDown={(e) => { e.preventDefault(); pick(item) }}
                      className={`cursor-pointer px-3 py-1.5 text-[13px] ${idx === active ? 'bg-amber-wash text-ink' : 'text-ink-2'} ${item === value ? 'font-semibold' : ''}`}
                    >{item}</li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
