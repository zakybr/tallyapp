/* Menu-bar icon: the tally mark as a black template image (macOS tints it). Writes resources/tray@1x.png and tray@2x.png. */
import { chromium } from 'playwright'
const svg = (px) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 26 24">
  <g stroke="#000" stroke-width="2.6">
    <line x1="4" y1="3" x2="4" y2="21"/><line x1="10.2" y1="3" x2="10.2" y2="21"/>
    <line x1="16.4" y1="3" x2="16.4" y2="21"/><line x1="22.6" y1="3" x2="22.6" y2="21"/>
    <line x1="0.5" y1="18.5" x2="25.5" y2="5.5"/>
  </g></svg>`
const browser = await chromium.launch()
for (const [px, name] of [[18, 'tray@1x.png'], [36, 'tray@2x.png']]) {
  const page = await browser.newPage({ viewport: { width: px, height: px } })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(px)}</body></html>`)
  await page.screenshot({ path: `resources/${name}`, omitBackground: true })
}
await browser.close()
