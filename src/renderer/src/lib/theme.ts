import type { Settings } from '@shared/domain'

let mode: Settings['theme'] = 'system'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function resolve(): 'light' | 'dark' {
  return mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
}

export function applyTheme(next: Settings['theme']): void {
  mode = next
  document.documentElement.dataset.theme = resolve()
}

media.addEventListener('change', () => applyTheme(mode))
