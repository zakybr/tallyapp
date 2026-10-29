import { useCallback, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { Button, Field, Input } from './ui'

/* window.prompt doesn't exist in Electron; this is the in-app equivalent. */
export function usePrompt(): [React.ReactNode, (title: string, initial?: string) => Promise<string | null>] {
  const [state, setState] = useState<{ title: string; value: string } | null>(null)
  const resolver = useRef<((v: string | null) => void) | null>(null)
  const ask = useCallback((title: string, initial = '') => new Promise<string | null>((res) => { resolver.current = res; setState({ title, value: initial }) }), [])
  const finish = (v: string | null) => { resolver.current?.(v); resolver.current = null; setState(null) }
  const node = (
    <Dialog open={!!state} onClose={() => finish(null)} title={state?.title ?? ''} width={420}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); finish(state!.value.trim()) }}>
        <Field label={state?.title ?? ''}><Input autoFocus value={state?.value ?? ''} onChange={(e) => setState((s) => (s ? { ...s, value: e.target.value } : s))} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => finish(null)}>Cancel</Button><Button type="submit" variant="primary">OK</Button></div>
      </form>
    </Dialog>
  )
  return [node, ask]
}
