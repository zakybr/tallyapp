import { BrowserWindow, dialog } from 'electron'
import { writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { handle, emit } from '../ipc'
import { getBoardStore } from '../context'

const win = () => (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0])!
const changed = () => emit('data:changed', { table: 'boards' })
const safeName = (s: string) => s.replace(/[^a-z0-9 _-]+/gi, '').trim().slice(0, 60) || 'board'
const fromDataUrl = (d: string) => Buffer.from(d.replace(/^data:[^;]+;base64,/, ''), 'base64')

export function registerBoardHandlers(): void {
  const store = getBoardStore()
  store.purgeOldTrash()

  handle('listBoards', async (opts) => store.list(opts))
  handle('createBoard', async (name, fromId) => { const b = store.create(name, { fromId }); changed(); return b })
  handle('updateBoard', async (id, patch) => { const b = store.update(id, patch); changed(); return b })
  handle('loadBoard', async (id) => store.load(id))
  handle('saveBoard', async (id, scene, newFiles) => store.save(id, scene, newFiles))
  handle('saveBoardThumbnail', async (id, png) => { store.saveThumbnail(id, fromDataUrl(png)); changed() })
  handle('pickBoardMedia', async (id) => {
    const r = await dialog.showOpenDialog(win(), {
      title: 'Add to board', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images, PDFs and videos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'mp4', 'mov', 'm4v'] }]
    })
    return r.canceled ? [] : r.filePaths.map((p) => store.addAsset(id, p))
  })
  handle('addBoardAsset', async (id, path) => store.addAsset(id, path))
  handle('snapshotBoard', async (id, name) => store.snapshot(id, name))
  handle('boardSnapshots', async (id) => store.snapshots(id))
  handle('restoreBoardSnapshot', async (id, file) => { store.restoreSnapshot(id, file); changed() })
  handle('saveBoardAsTemplate', async (id, name) => { const t = store.create(name, { fromId: id, isTemplate: true }); changed(); return t })
  handle('trashBoard', async (id) => { store.trash(id); changed() })
  handle('restoreBoard', async (id) => { store.restore(id); changed() })
  handle('purgeBoard', async (id) => { store.purge(id); changed() })
  handle('linkBoard', async (id, target) => { store.link(id, target); changed() })
  handle('unlinkBoard', async (id, target) => { store.unlink(id, target); changed() })
  handle('boardsFor', async (target) => store.linkedTo(target))
  handle('boardPresets', async () => store.presets())
  handle('saveBoardPreset', async (name, style) => { store.savePreset(name, style); changed() })
  handle('deleteBoardPreset', async (id) => { store.deletePreset(id); changed() })

  handle('exportTallyboard', async (id) => {
    const b = store.get(id)!
    const r = await dialog.showSaveDialog(win(), { title: 'Export board', defaultPath: `${safeName(b.name)}.tallyboard`, filters: [{ name: 'Tally board', extensions: ['tallyboard'] }] })
    if (r.canceled || !r.filePath) return null
    await store.exportZip(id, r.filePath)
    return { file: r.filePath }
  })
  handle('importTallyboard', async () => {
    const r = await dialog.showOpenDialog(win(), { title: 'Import a board', properties: ['openFile'], filters: [{ name: 'Tally board', extensions: ['tallyboard'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    const b = await store.importZip(r.filePaths[0])
    changed()
    return b
  })

  /* PNG: one image, or a folder of images (one per frame). PDF: one page per image, each page sized to its image. */
  handle('exportBoardImages', async (id, kind, pages) => {
    const b = store.get(id)!
    if (!pages.length) return null
    if (kind === 'png') {
      if (pages.length === 1) {
        const r = await dialog.showSaveDialog(win(), { title: 'Export PNG', defaultPath: `${safeName(b.name)}.png` })
        if (r.canceled || !r.filePath) return null
        writeFileSync(r.filePath, fromDataUrl(pages[0].dataUrl))
        return { file: r.filePath }
      }
      const r = await dialog.showOpenDialog(win(), { title: 'Choose a folder for the frame images', properties: ['openDirectory', 'createDirectory'] })
      if (r.canceled || !r.filePaths[0]) return null
      pages.forEach((p, i) => writeFileSync(join(r.filePaths[0], `${String(i + 1).padStart(2, '0')} ${safeName(p.name)}.png`), fromDataUrl(p.dataUrl)))
      return { file: r.filePaths[0] }
    }
    const r = await dialog.showSaveDialog(win(), { title: 'Export PDF', defaultPath: `${safeName(b.name)}.pdf` })
    if (r.canceled || !r.filePath) return null
    const html = join(tmpdir(), `tally-board-${process.pid}-${Date.now()}.html`)
    const w = Math.max(...pages.map((p) => p.width))
    const h = Math.max(...pages.map((p) => p.height))
    writeFileSync(html, `<!doctype html><html><head><style>
      @page { size: ${w}px ${h}px; margin: 0 } html, body { margin: 0 }
      section { width: ${w}px; height: ${h}px; display: flex; align-items: center; justify-content: center; page-break-after: always; background: #fff }
      img { max-width: 100%; max-height: 100%; }
    </style></head><body>${pages.map((p) => `<section><img src="${p.dataUrl}"></section>`).join('')}</body></html>`)
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try {
      await pdfWin.loadFile(html)
      const pdf = await pdfWin.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
      writeFileSync(r.filePath, pdf)
      return { file: r.filePath }
    } finally {
      pdfWin.destroy()
      rmSync(html, { force: true })
    }
  })
}
