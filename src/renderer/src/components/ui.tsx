import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import type { Verdict, Stage } from '@shared/domain'
import { STAGE_LABEL } from '@shared/domain'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }>(
  function Button({ variant = 'secondary', size = 'md', className = '', ...rest }, ref) {
    const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap'
    const sizes = size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8.5 px-3.5 text-[13px]'
    const variants: Record<Variant, string> = {
      primary: 'bg-amber text-on-amber hover:bg-amber-hover',
      secondary: 'border border-rule-strong bg-paper-raised text-ink hover:bg-paper-2',
      ghost: 'text-ink-2 hover:bg-paper-2 hover:text-ink',
      danger: 'border border-rule-strong text-danger hover:bg-pass-wash'
    }
    return <button ref={ref} className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest} />
  }
)

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`h-8.5 w-full rounded-md border border-rule-strong bg-paper-raised px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-amber focus:outline-none ${className}`}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-md border border-rule-strong bg-paper-raised px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-3 focus:border-amber focus:outline-none ${className}`}
      {...rest}
    />
  )
})

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </label>
  )
}

const VERDICT_STYLE: Record<Verdict, string> = {
  go: 'bg-go-wash text-go',
  conversation: 'bg-conv-wash text-conv',
  pass: 'bg-pass-wash text-pass'
}
const VERDICT_TEXT: Record<Verdict, string> = { go: 'Go', conversation: 'Conversation', pass: 'Pass' }

export function VerdictBadge({ verdict, large = false }: { verdict: Verdict | null; large?: boolean }) {
  if (!verdict) return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 ring-1 ring-rule-strong`}>Unscored</span>
  return (
    <span className={`rounded font-display font-bold uppercase tracking-wide ${large ? 'px-2.5 py-1 text-lg' : 'px-1.5 py-0.5 text-[12.5px]'} ${VERDICT_STYLE[verdict]}`}>
      {VERDICT_TEXT[verdict]}
    </span>
  )
}

export function StageChip({ stage }: { stage: Stage }) {
  return <span className="rounded border border-rule-strong px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2">{STAGE_LABEL[stage]}</span>
}

export function Section({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rise ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <h2 className="display text-[19px] text-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 border-b border-rule px-8 pb-5 pt-7">
      <div>
        {eyebrow && <div className="label mb-1.5">{eyebrow}</div>}
        <h1 className="display text-[40px] text-ink">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-chrome-line bg-chrome-3 px-1 font-mono text-[10.5px] text-chrome-ink-2">{children}</kbd>
}
