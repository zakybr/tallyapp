import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ open, onClose, title, children, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/45 pt-[12vh]" onMouseDown={onClose}>
      <div className="rise rounded-[10px] bg-paper shadow-2xl ring-1 ring-rule-strong" style={{ width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 className="display text-xl">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Close"><X size={16} /></button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
