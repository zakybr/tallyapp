/* Excalidraw loads its fonts from here (bundled by scripts/excalidraw-assets.mjs) instead of a CDN. */
;(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = 'tally-assets://excalidraw/'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './App'
import { applyTheme } from './lib/theme'

applyTheme('system')
void window.tally.getSettings().then((s) => applyTheme(s.theme))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
