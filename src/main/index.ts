import { app, BrowserWindow, shell, nativeTheme, protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { resolve, sep } from 'node:path'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerDataHandlers } from './handlers'
import { cancelAll } from './agents/runner'

const here = fileURLToPath(new URL('.', import.meta.url))

app.setName('Tally')

/* tally-file://evidence/<path> serves screenshots from the user data folder only. */
protocol.registerSchemesAsPrivileged([{ scheme: 'tally-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
function registerFileProtocol(): void {
  const root = resolve(app.getPath('userData'))
  protocol.handle('tally-file', (req) => {
    const p = resolve(decodeURIComponent(new URL(req.url).searchParams.get('p') ?? ''))
    if (!p.startsWith(root + sep)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(p).href)
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    title: 'Tally',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f0f0e' : '#0f0f0e',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Links open in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto|tel):/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      e.preventDefault()
      if (/^(https?|mailto|tel):/.test(url)) void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(here, '../renderer/index.html'))
  }
  return win
}


app.whenReady().then(() => {
  registerFileProtocol()
  registerDataHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => cancelAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
