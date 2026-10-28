import { useEffect, useState } from 'react'

/* Click-to-edit text that saves on blur or Enter. Empty saves as null. */
export function InlineField({ value, onSave, placeholder = 'Add…', multiline = false, className = '', type = 'text' }: {
  value: string | null
  onSave: (v: string | null) => unknown
  placeholder?: string
  multiline?: boolean
  className?: string
  type?: string
}) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = () => { const next = v.trim() || null; if (next !== (value ?? null)) void onSave(next) }
  const cls = `w-full rounded border border-transparent bg-transparent px-1.5 py-1 -mx-1.5 text-[13px] text-ink placeholder:text-ink-3 hover:border-rule focus:border-amber focus:bg-paper-raised focus:outline-none ${className}`
  return multiline ? (
    <textarea className={`${cls} min-h-16 resize-y leading-relaxed`} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
  ) : (
    <input type={type} className={cls} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  )
}
