/*
  Excalidraw fetches its fonts from a CDN unless EXCALIDRAW_ASSET_PATH points
  somewhere else, and Tally's CSP blocks the CDN. Copy the fonts into the
  renderer's public folder, then swap the files behind three font slots for
  Tally's own fonts (see TALLY_FONTS in src/shared/boards.ts).
*/
import { cpSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const src = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts'
const out = 'src/renderer/public/excalidraw/fonts'
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(src, out, { recursive: true })

const swaps = {
  Nunito: 'src/renderer/src/assets/fonts/GeneralSans-Regular.woff2',
  Lilita: 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2',
  ComicShanns: 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2'
}
for (const [dir, font] of Object.entries(swaps)) {
  for (const f of readdirSync(join(out, dir))) copyFileSync(font, join(out, dir, f))
}
console.log('Excalidraw fonts ready (Tally fonts in the Nunito, Lilita and Comic Shanns slots)')
