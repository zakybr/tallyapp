import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'error' }
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setItems((t) => [...t, { id, text, tone }])
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), tone === 'info' ? 2600 : 6000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {items.map((t) => (
          <div key={t.id} className={`rise pointer-events-auto max-w-md rounded-md px-3.5 py-2.5 text-[13px] shadow-lg ${
            t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'warn' ? 'bg-amber text-on-amber' : 'bg-chrome-3 text-chrome-ink'
          }`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
