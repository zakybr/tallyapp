/*
  Phase 2 QA: one board with every shape type, Tally text styles, a preset,
  an image, a PDF page, an MP4 and a QuickTime MOV. Quits, relaunches, and
  checks everything reloads and the videos play.
  node scripts/qa-board.mjs <userDataDir> <mediaDir> <shotsDir>
*/
import { _electron as electron } from 'playwright'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
const [dir, media, shots] = process.argv.slice(2)
const launch = async () => {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${dir}`], env: { ...process.env, TALLY_E2E: '1' } })
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 })
  await win.waitForSelector('aside')
  return { app, win }
}
const errors = []

// ---------- session 1: build the board ----------
let { app, win } = await launch()
win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
const board = await win.evaluate(() => window.tally.createBoard('QA: every shape'))
await win.evaluate((h) => (window.location.hash = h), `#/board/${board.id}`)
await win.waitForFunction(() => !!window.__tallyBoard, null, { timeout: 30_000 })
await win.waitForTimeout(800)
await win.mouse.click(1300, 820) // focus the canvas so tool shortcuts reach Excalidraw
await win.screenshot({ path: join(shots, 'board-0-empty.png') })
const drag = async (key, [x1, y1], [x2, y2]) => {
  await win.keyboard.press(key)
  await win.mouse.move(x1, y1); await win.mouse.down(); await win.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await win.mouse.move(x2, y2, { steps: 4 }); await win.mouse.up()
  await win.keyboard.press('Escape')
}
await drag('r', [570, 160], [720, 250])        // rectangle
await drag('d', [810, 150], [930, 260])        // diamond
await drag('o', [1010, 160], [1150, 250])        // ellipse
await drag('a', [720, 205], [1010, 205])        // arrow, bound rectangle → ellipse
await drag('l', [570, 330], [770, 380])        // line
await win.keyboard.press('p')                  // freehand pen
await win.mouse.move(830, 330); await win.mouse.down()
for (let i = 0; i < 12; i++) await win.mouse.move(830 + i * 12, 330 + Math.sin(i) * 25)
await win.mouse.up(); await win.keyboard.press('Escape')
await win.keyboard.press('t'); await win.mouse.click(580, 450); await win.keyboard.type('Enquiry to revenue'); await win.keyboard.press('Escape'); await win.keyboard.press('Escape')
await drag('r', [580, 520], [750, 620])        // sticky note: rectangle with text inside
await win.evaluate(() => {
  const { excal } = window.__tallyBoard
  const els = excal.getSceneElements()
  const sticky = els.filter((e) => e.type === 'rectangle').at(-1)
  excal.updateScene({ appState: { selectedElementIds: { [sticky.id]: true } } })
})
await win.keyboard.press('Enter'); await win.keyboard.type('Call back Tuesday'); await win.keyboard.press('Escape'); await win.keyboard.press('Escape')
await drag('f', [1000, 420], [1400, 700])       // frame (usable as a slide)
await win.screenshot({ path: join(shots, 'board-0-drawn.png') })

// Heading style on the text, rounded corners on the first rectangle, Tally accent on the sticky.
await win.evaluate(() => {
  const { excal } = window.__tallyBoard
  const t = excal.getSceneElements().find((e) => e.type === 'text' && e.text.startsWith('Enquiry'))
  if (!t) throw new Error('no text element; have: ' + excal.getSceneElements().map((e) => `${e.type}:${e.text ?? ''}`).join(', '))
  excal.updateScene({ appState: { selectedElementIds: { [t.id]: true } } })
})
await win.getByRole('button', { name: 'Heading' }).click()
await win.evaluate(() => {
  const { excal } = window.__tallyBoard
  const els = excal.getSceneElementsIncludingDeleted()
  const first = els.find((e) => e.type === 'rectangle' && !e.isDeleted)
  excal.updateScene({ elements: els.map((e) => (e.id === first.id ? { ...e, roundness: { type: 3 }, version: e.version + 1 } : e)) })
  const sticky = excal.getSceneElements().filter((e) => e.type === 'rectangle').at(-1)
  excal.updateScene({ appState: { selectedElementIds: { [sticky.id]: true } } })
})
await win.getByLabel('Style preset').selectOption({ label: 'Tally accent' })
await win.keyboard.press('Escape')

for (const f of [join(process.cwd(), 'build/icon.png'), join(media, 'test.pdf'), join(media, 'walkthrough.mp4'), join(media, 'quicktime.mov')]) {
  await win.evaluate((p) => window.__tallyBoard.insertPath(p), f)
  await win.waitForTimeout(400)
}
await win.evaluate(() => window.__tallyBoard.excal.scrollToContent())
await win.waitForTimeout(1500)
await win.evaluate(() => window.__tallyBoard.saveNow())
await win.waitForTimeout(4500) // thumbnail is written 3 s after a save
await win.screenshot({ path: join(shots, 'board-1.png') })
const before = await win.evaluate(() => {
  const { excal } = window.__tallyBoard
  const els = excal.getSceneElements()
  const count = {}
  for (const e of els) count[e.type] = (count[e.type] ?? 0) + 1
  const arrow = els.find((e) => e.type === 'arrow')
  return { count, files: Object.keys(excal.getFiles()).length, arrowBound: !!(arrow?.startBinding && arrow?.endBinding), fonts: [...new Set(els.filter((e) => e.type === 'text').map((e) => e.fontFamily))] }
})
await win.evaluate((id) => window.tally.snapshotBoard(id, 'QA snapshot'), board.id)
await app.close()

// ---------- session 2: relaunch and check ----------
;({ app, win } = await launch())
win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
await win.evaluate((h) => (window.location.hash = h), `#/board/${board.id}`)
await win.waitForFunction(() => !!window.__tallyBoard, null, { timeout: 30_000 })
await win.waitForTimeout(2500)
const after = await win.evaluate(async () => {
  const { excal } = window.__tallyBoard
  const els = excal.getSceneElements()
  const count = {}
  for (const e of els) count[e.type] = (count[e.type] ?? 0) + 1
  const videos = [...document.querySelectorAll('video')]
  const played = []
  for (const v of videos) {
    v.muted = true
    try { await v.play() } catch (e) { played.push(`play failed: ${e}`); continue }
    await new Promise((r) => setTimeout(r, 1200))
    played.push({ src: v.src.slice(-40), currentTime: Math.round(v.currentTime * 10) / 10, duration: Math.round(v.duration * 10) / 10, width: v.videoWidth })
    v.pause()
  }
  return { count, files: Object.keys(excal.getFiles()).length, videos: played, fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i) }
})
await win.screenshot({ path: join(shots, 'board-2-relaunched.png') })
const meta = (await win.evaluate(() => window.tally.listBoards()))[0]
const snaps = await win.evaluate((id) => window.tally.boardSnapshots(id), board.id)
await win.evaluate(() => (window.location.hash = '#/boards'))
await win.waitForTimeout(800)
await win.screenshot({ path: join(shots, 'boards-library.png') })
await app.close()
console.log(JSON.stringify({ before, after, thumbnail: !!meta.thumbnail && existsSync(meta.thumbnail), snapshots: snaps.map((s) => s.name), consoleErrors: errors.slice(0, 8) }, null, 1))
