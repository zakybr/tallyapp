/*
  Renders the app icon from the locked tally mark: near-black squircle, warm
  paper strokes, amber cross-stroke. Writes build/icon.png (1024) and
  build/icon.icns via iconutil.
*/
import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c1b19"/><stop offset="1" stop-color="#0c0c0b"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="185" fill="none" stroke="rgba(236,231,220,0.10)" stroke-width="2"/>
  <g transform="translate(512 512) scale(17) translate(-13 -12)" stroke-linecap="butt">
    <line x1="3" y1="3" x2="3" y2="21" stroke="#f3eee3" stroke-width="2.5"/>
    <line x1="9.5" y1="3" x2="9.5" y2="21" stroke="#f3eee3" stroke-width="2.5"/>
    <line x1="16" y1="3" x2="16" y2="21" stroke="#f3eee3" stroke-width="2.5"/>
    <line x1="22.5" y1="3" x2="22.5" y2="21" stroke="#f3eee3" stroke-width="2.5"/>
    <line x1="-0.5" y1="19" x2="25.5" y2="5" stroke="#f0a52c" stroke-width="2.5"/>
  </g>
</svg>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
await page.screenshot({ path: 'build/icon.png', omitBackground: true })
await browser.close()

rmSync('build/icon.iconset', { recursive: true, force: true })
mkdirSync('build/icon.iconset')
for (const s of [16, 32, 128, 256, 512]) {
  execFileSync('sips', ['-z', String(s), String(s), 'build/icon.png', '--out', `build/icon.iconset/icon_${s}x${s}.png`])
  execFileSync('sips', ['-z', String(s * 2), String(s * 2), 'build/icon.png', '--out', `build/icon.iconset/icon_${s}x${s}@2x.png`])
}
execFileSync('iconutil', ['-c', 'icns', 'build/icon.iconset', '-o', 'build/icon.icns'])
rmSync('build/icon.iconset', { recursive: true, force: true })
console.log('icon written')
