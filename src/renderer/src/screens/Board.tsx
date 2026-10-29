import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw, convertToExcalidrawElements, exportToBlob, FONT_FAMILY } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { BinaryFileData, BinaryFiles, ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types'
import { ArrowLeft, ImagePlus, History, Download, LayoutTemplate, Link2, Palette, Check } from 'lucide-react'
import { api, useData, fileUrl, ago } from '@/lib/api'
import { navigate } from '@/lib/router'
import { Button, Field, Input } from '@/components/ui'
import { Dialog } from '@/components/Dialog'
import { TallyLoader } from '@/components/Tally'
import { useToast } from '@/components/Toast'
import { usePrompt } from '@/components/usePrompt'
import { fit, imageSize, pdfPageCount, renderPdfPage, toDataUrl } from '@/components/boards/media'
import { TALLY_COLOURS, TALLY_FONTS, VIDEO_LINK_PREFIX, type BoardAsset, type BoardFile, type BoardPreset, type LoadedBoard } from '@shared/boards'

/* Excalidraw state that is worth keeping between sessions (not selection, menus or collaborators). */
const KEEP: (keyof AppState)[] = [
  'viewBackgroundColor', 'gridModeEnabled', 'gridSize', 'gridStep', 'objectsSnapModeEnabled', 'scrollX', 'scrollY', 'zoom',
  'currentItemStrokeColor', 'currentItemBackgroundColor', 'currentItemFillStyle', 'currentItemStrokeWidth', 'currentItemRoughness',
  'currentItemFontFamily', 'currentItemFontSize', 'currentItemTextAlign', 'currentItemRoundness', 'currentItemOpacity'
]
/* Exports can't show a playing video, so the embed's link text becomes a readable label. */
const forExport = <T extends { type: string; link?: string | null; customData?: Record<string, unknown> }>(els: readonly T[]): T[] =>
  els.map((e) => (e.type === 'embeddable' && e.link?.startsWith(VIDEO_LINK_PREFIX) ? { ...e, link: `▶ ${String(e.customData?.videoName ?? 'Video')}` } : e))
const pick = (s: AppState) => Object.fromEntries(KEEP.filter((k) => k in s).map((k) => [k, s[k]])) as Record<string, unknown>

/* The three Tally text styles: Excalidraw's font slots carry Tally's fonts (see TALLY_FONTS). */
const TEXT_STYLES = [
  { key: 'heading', label: 'Heading', fontFamily: TALLY_FONTS.heading, fontSize: 36 },
  { key: 'body', label: 'Body', fontFamily: TALLY_FONTS.body, fontSize: 20 },
  { key: 'label', label: 'Label', fontFamily: TALLY_FONTS.mono, fontSize: 14 }
] as const

export function BoardEditor({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<LoadedBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.loadBoard(id).then(setLoaded).catch((e) => setError(String(e))) }, [id])
  if (error) return <div className="p-10 text-ink-3">This board could not be opened. {error}</div>
  if (!loaded) return <div className="p-10"><TallyLoader label="Opening board" /></div>
  return <Editor board={loaded} />
}

function Editor({ board }: { board: LoadedBoard }) {
  const toast = useToast()
  const id = board.meta.id
  const [excal, setExcal] = useState<ExcalidrawImperativeAPI | null>(null)
  const [name, setName] = useState(board.meta.name)
  const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [panel, setPanel] = useState<null | 'snapshots' | 'export' | 'link' | 'pdf' | 'template'>(null)
  const [pdf, setPdf] = useState<{ asset: BoardAsset; pages: number } | null>(null)
  const savedFiles = useRef(new Set(board.files.map((f) => f.id)))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastVersion = useRef<string>('')
  const boardsRoot = board.folderPath.replace(/[/\\][^/\\]+$/, '')
  const { data: presets } = useData(() => api.boardPresets())
  const [promptNode, ask] = usePrompt()

  const initialData = useMemo(() => ({
    elements: board.doc.elements as never,
    appState: { ...board.doc.appState, viewBackgroundColor: (board.doc.appState.viewBackgroundColor as string) ?? TALLY_COLOURS.cream, currentItemFontFamily: (board.doc.appState.currentItemFontFamily as number) ?? TALLY_FONTS.body },
    files: Object.fromEntries(board.files.map((f) => [f.id, f])) as unknown as BinaryFiles,
    scrollToContent: true
  }), [board])

  const saveNow = useCallback(async () => {
    if (!excal) return
    const elements = excal.getSceneElementsIncludingDeleted()
    const files = excal.getFiles()
    const fresh: BoardFile[] = Object.values(files).filter((f) => !savedFiles.current.has(f.id)).map((f) => ({ id: f.id, dataURL: f.dataURL, mimeType: f.mimeType, created: f.created }))
    setStatus('saving')
    await api.saveBoard(id, { elements: elements as unknown[], appState: pick(excal.getAppState()) }, fresh)
    for (const f of fresh) savedFiles.current.add(f.id)
    setStatus('saved')
    if (thumbTimer.current) clearTimeout(thumbTimer.current)
    thumbTimer.current = setTimeout(async () => {
      const live = excal.getSceneElements()
      if (!live.length) return
      const blob = await exportToBlob({ elements: forExport(live) as never, appState: { ...excal.getAppState(), exportBackground: true }, files: excal.getFiles(), maxWidthOrHeight: 640, mimeType: 'image/png' })
      await api.saveBoardThumbnail(id, await blobToDataUrl(blob))
    }, 3000)
  }, [excal, id])

  // Autosave 800 ms after the last change, and once more when leaving the board.
  const onChange = useCallback((elements: readonly { version: number; id: string }[]) => {
    const v = elements.map((e) => `${e.id}:${e.version}`).join('|')
    if (v === lastVersion.current) return
    lastVersion.current = v
    setStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveNow(), 800)
  }, [saveNow])
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); void saveNow() } }, [saveNow])

  /* ---------- inserting media ---------- */

  // Items added in a row cascade instead of stacking on the same spot.
  const cascade = useRef({ at: 0, n: 0 })
  const center = () => {
    const s = excal!.getAppState()
    const c = cascade.current
    c.n = Date.now() - c.at < 10_000 ? c.n + 1 : 0
    c.at = Date.now()
    return { x: -s.scrollX + s.width / 2 / s.zoom.value + c.n * 48, y: -s.scrollY + s.height / 2 / s.zoom.value + c.n * 48 }
  }
  const addElements = (els: ReturnType<typeof convertToExcalidrawElements>) => {
    excal!.updateScene({ elements: [...excal!.getSceneElementsIncludingDeleted(), ...els] })
  }
  const insertImage = async (dataURL: string, mimeType: string, natural?: { width: number; height: number }, at?: { x: number; y: number }) => {
    const fileId = crypto.randomUUID()
    excal!.addFiles([{ id: fileId as BinaryFileData['id'], dataURL: dataURL as BinaryFileData['dataURL'], mimeType: mimeType as BinaryFileData['mimeType'], created: Date.now() }])
    const size = fit((natural ?? (await imageSize(dataURL))).width, (natural ?? (await imageSize(dataURL))).height)
    const c = at ?? center()
    addElements(convertToExcalidrawElements([{ type: 'image', fileId: fileId as never, x: c.x - size.width / 2, y: c.y - size.height / 2, width: size.width, height: size.height }]))
  }
  const insertAsset = async (a: BoardAsset, at?: { x: number; y: number }) => {
    if (a.mimeType.startsWith('image/')) await insertImage(await toDataUrl(a.path), a.mimeType, undefined, at)
    else if (a.mimeType === 'application/pdf') { const pages = await pdfPageCount(a.path); if (pages > 1) { setPdf({ asset: a, pages }); setPanel('pdf') } else await insertPdfPage(a, 1, at) }
    else if (a.mimeType.startsWith('video/')) {
      const c = at ?? center()
      addElements(convertToExcalidrawElements([{ type: 'embeddable', link: `${VIDEO_LINK_PREFIX}${id}/${a.asset}`, x: c.x - 320, y: c.y - 180, width: 640, height: 360, customData: { videoName: a.name } } as never]))
    } else toast(`${a.name} isn't an image, PDF or video`, 'warn')
  }
  const insertPdfPage = async (a: BoardAsset, page: number, at?: { x: number; y: number }) => {
    const r = await renderPdfPage(a.path, page)
    await insertImage(r.dataUrl, 'image/png', { width: r.width, height: r.height }, at)
  }

  // Videos and PDFs dropped from Finder are copied into the board; images go through Excalidraw's own drop.
  const onDropCapture = async (e: React.DragEvent) => {
    const files = [...e.dataTransfer.files].filter((f) => /^(video\/|application\/pdf)/.test(f.type) || /\.(mov|mp4|m4v|pdf)$/i.test(f.name))
    if (!files.length || !excal) return
    e.preventDefault()
    e.stopPropagation()
    const s = excal.getAppState()
    const at = { x: (e.clientX - s.offsetLeft) / s.zoom.value - s.scrollX, y: (e.clientY - s.offsetTop) / s.zoom.value - s.scrollY }
    for (const f of files) await insertAsset(await api.addBoardAsset(id, window.tally.pathForFile(f)), at)
  }

  /* ---------- styles ---------- */

  const selected = () => {
    const ids = excal!.getAppState().selectedElementIds
    return excal!.getSceneElements().filter((e) => ids[e.id])
  }
  const applyTextStyle = (st: (typeof TEXT_STYLES)[number]) => {
    const ids = new Set(selected().map((e) => e.id))
    excal!.updateScene({
      elements: excal!.getSceneElementsIncludingDeleted().map((e) => (ids.has(e.id) && e.type === 'text'
        ? { ...e, fontFamily: st.fontFamily, fontSize: st.fontSize, version: e.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) }
        : e)) as never,
      appState: { currentItemFontFamily: st.fontFamily, currentItemFontSize: st.fontSize } as never
    })
  }
  const applyPreset = (p: BoardPreset) => {
    const ids = new Set(selected().map((e) => e.id))
    const st = p.style
    excal!.updateScene({
      elements: excal!.getSceneElementsIncludingDeleted().map((e) => (ids.has(e.id)
        ? { ...e, strokeColor: st.strokeColor, backgroundColor: e.type === 'text' || e.type === 'arrow' || e.type === 'line' ? e.backgroundColor : st.backgroundColor, fillStyle: st.fillStyle, strokeWidth: st.strokeWidth, roughness: st.roughness, ...(e.type === 'text' ? { fontFamily: st.fontFamily } : {}), version: e.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 31) }
        : e)) as never,
      appState: {
        currentItemStrokeColor: st.strokeColor, currentItemBackgroundColor: st.backgroundColor, currentItemFillStyle: st.fillStyle,
        currentItemStrokeWidth: st.strokeWidth, currentItemRoughness: st.roughness, currentItemFontFamily: st.fontFamily, currentItemFontSize: st.fontSize,
        ...(st.viewBackgroundColor && !ids.size ? { viewBackgroundColor: st.viewBackgroundColor } : {})
      } as never
    })
    toast(ids.size ? `${p.name} applied to ${ids.size} item${ids.size === 1 ? '' : 's'}` : `${p.name} set for new shapes`)
  }
  const savePreset = async () => {
    const s = excal!.getAppState()
    const presetName = await ask('Name this style', `My style ${(presets?.length ?? 0) + 1}`)
    if (!presetName) return
    await api.saveBoardPreset(presetName, {
      strokeColor: s.currentItemStrokeColor, backgroundColor: s.currentItemBackgroundColor, fillStyle: s.currentItemFillStyle,
      strokeWidth: s.currentItemStrokeWidth, roughness: s.currentItemRoughness, fontFamily: s.currentItemFontFamily as number, fontSize: s.currentItemFontSize
    })
    toast(`Saved "${presetName}"`)
  }

  /* ---------- export ---------- */

  const exportAs = async (kind: 'png' | 'pdf', perFrame: boolean) => {
    if (!excal) return
    await saveNow()
    const elements = excal.getSceneElements()
    const appState = { ...excal.getAppState(), exportBackground: true, exportScale: 2 }
    const frames = elements.filter((e) => e.type === 'frame' || e.type === 'magicframe')
    const targets = perFrame && frames.length ? frames : [null]
    const pages = []
    for (const f of targets) {
      const blob = await exportToBlob({ elements: forExport(elements) as never, appState, files: excal.getFiles(), exportingFrame: f as never, mimeType: 'image/png', exportPadding: f ? 0 : 24 })
      const dataUrl = await blobToDataUrl(blob)
      const size = await imageSize(dataUrl)
      pages.push({ name: (f as { name?: string } | null)?.name ?? name, dataUrl, ...size })
    }
    const r = await api.exportBoardImages(id, kind, pages)
    setPanel(null)
    if (r) { toast(`Exported ${pages.length > 1 ? `${pages.length} frames` : 'the board'}`); void api.revealPath(r.file) }
  }

  // Test hook: lets the QA script add media without a native file dialog.
  useEffect(() => {
    if (!excal) return
    const w = window as unknown as { __tallyBoard?: unknown }
    w.__tallyBoard = { excal, insertPath: async (p: string) => insertAsset(await api.addBoardAsset(id, p)), saveNow }
    return () => { delete w.__tallyBoard }
  })

  const frameCount = excal?.getSceneElements().filter((e) => e.type === 'frame').length ?? 0

  return (
    <div className="flex h-full flex-col" onDropCapture={(e) => void onDropCapture(e)}>
      <header className="drag flex h-12 shrink-0 items-center gap-2 border-b border-rule px-4 [&_button]:[-webkit-app-region:no-drag] [&_input]:[-webkit-app-region:no-drag] [&_select]:[-webkit-app-region:no-drag]">
        <button onClick={() => navigate({ name: 'boards' })} aria-label="Back to boards" className="rounded p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink"><ArrowLeft size={16} /></button>
        <input aria-label="Board name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void api.updateBoard(id, { name })}
          className="display h-8 w-72 rounded border border-transparent bg-transparent px-1.5 text-[20px] hover:border-rule focus:border-amber focus:outline-none" />
        <span className="w-20 text-[11.5px] text-ink-3">{status === 'saved' ? <span className="inline-flex items-center gap-1"><Check size={12} />Saved</span> : status === 'saving' ? 'Saving…' : 'Edited'}</span>
        <div className="ml-auto flex items-center gap-1">
          {TEXT_STYLES.map((st) => <Button key={st.key} size="sm" variant="ghost" title={`${st.label} text style for selected text`} onClick={() => applyTextStyle(st)}>{st.label}</Button>)}
          <span className="mx-1 h-5 w-px bg-rule" />
          <select aria-label="Style preset" className="h-7 rounded border border-rule-strong bg-paper-raised px-1.5 text-[12.5px]" value="" onChange={(e) => {
            if (e.target.value === '__save') return void savePreset()
            const p = presets?.find((x) => String(x.id) === e.target.value); if (p) applyPreset(p)
          }}>
            <option value="">Style…</option>
            {presets?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__save">Save current style as preset…</option>
          </select>
          <Button size="sm" onClick={async () => { for (const a of await api.pickBoardMedia(id)) await insertAsset(a) }}><ImagePlus size={14} />Add media</Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel('snapshots')}><History size={14} />Versions</Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel('link')}><Link2 size={14} />Link</Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel('template')}><LayoutTemplate size={14} />Template</Button>
          <Button size="sm" variant="primary" onClick={() => setPanel('export')}><Download size={14} />Export</Button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 tally-board">
        <Excalidraw
          excalidrawAPI={setExcal}
          initialData={initialData}
          onChange={onChange as never}
          theme="light"
          name={name}
          validateEmbeddable={(link) => (link.startsWith(VIDEO_LINK_PREFIX) ? true : undefined)}
          renderEmbeddable={(el) => {
            const m = el.link?.match(/^tally-asset:([a-z0-9-]+)\/([^/\\]+)$/i)
            if (!m) return null
            return <video src={fileUrl(`${boardsRoot}/${m[1]}/assets/${m[2]}`)} controls playsInline preload="metadata" style={{ width: '100%', height: '100%', background: '#000', borderRadius: 4 }} />
          }}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, changeViewBackgroundColor: true, clearCanvas: true, toggleTheme: false } }}
        />
      </div>

      <Dialog open={panel === 'export'} onClose={() => setPanel(null)} title="Export">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void exportAs('png', false)}>Whole board as PNG</Button>
          <Button onClick={() => void exportAs('pdf', false)}>Whole board as PDF</Button>
          <Button disabled={!frameCount} onClick={() => void exportAs('png', true)}>Each frame as PNG{frameCount ? ` (${frameCount})` : ''}</Button>
          <Button disabled={!frameCount} onClick={() => void exportAs('pdf', true)}>Frames as PDF pages</Button>
          <div className="col-span-2 mt-2 border-t border-rule pt-3">
            <Button variant="primary" onClick={async () => { await saveNow(); const r = await api.exportTallyboard(id); setPanel(null); if (r) { toast('Saved .tallyboard'); void api.revealPath(r.file) } }}>Portable .tallyboard (backup or another Mac)</Button>
          </div>
          {!frameCount && <p className="col-span-2 text-[12px] text-ink-3">Add frames (F) to export them as separate slides or pages.</p>}
        </div>
      </Dialog>

      {promptNode}
      <Snapshots open={panel === 'snapshots'} id={id} onClose={() => setPanel(null)} onBeforeSnapshot={saveNow} />
      <LinkPanel open={panel === 'link'} id={id} links={board.meta.links} onClose={() => setPanel(null)} />
      <TemplatePanel open={panel === 'template'} id={id} name={name} onClose={() => setPanel(null)} onBefore={saveNow} />

      <Dialog open={panel === 'pdf' && !!pdf} onClose={() => setPanel(null)} title="Which page?">
        {pdf && <PdfPagePicker pages={pdf.pages} onPick={async (page) => { setPanel(null); await insertPdfPage(pdf.asset, page) }} />}
      </Dialog>
    </div>
  )
}

function PdfPagePicker({ pages, onPick }: { pages: number; onPick: (p: number) => void }) {
  const [page, setPage] = useState(1)
  return (
    <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); onPick(page) }}>
      <Field label={`Page (1–${pages})`}><Input type="number" min={1} max={pages} value={page} onChange={(e) => setPage(Number(e.target.value) || 1)} autoFocus /></Field>
      <Button type="submit" variant="primary">Add page</Button>
    </form>
  )
}

function Snapshots({ open, id, onClose, onBeforeSnapshot }: { open: boolean; id: string; onClose: () => void; onBeforeSnapshot: () => Promise<void> }) {
  const toast = useToast()
  const { data: list, reload } = useData(() => (open ? api.boardSnapshots(id) : Promise.resolve([])), [open, id])
  const [label, setLabel] = useState('')
  return (
    <Dialog open={open} onClose={onClose} title="Versions" width={520}>
      <form className="mb-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await onBeforeSnapshot(); await api.snapshotBoard(id, label || 'Snapshot'); setLabel(''); reload(); toast('Snapshot saved') }}>
        <Input placeholder="Name this version (e.g. Before the Rowan meeting)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button type="submit" variant="primary">Save</Button>
      </form>
      {!list?.length ? <p className="text-[13px] text-ink-3">No versions yet. Autosave keeps the latest; save a version before big changes.</p> : (
        <ul className="divide-y divide-rule rounded-md border border-rule">
          {list.map((s) => (
            <li key={s.file} className="flex items-center justify-between px-3 py-2 text-[13px]">
              <span><span className="font-semibold">{s.name}</span> <span className="text-ink-3">· {ago(s.createdAt)}</span></span>
              <Button size="sm" onClick={async () => { if (window.confirm(`Restore "${s.name}"? The current board is saved as a version first.`)) { await api.restoreBoardSnapshot(id, s.file); window.location.reload() } }}>Restore</Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

function LinkPanel({ open, id, links, onClose }: { open: boolean; id: string; links: LoadedBoard['meta']['links']; onClose: () => void }) {
  const { data: people } = useData(() => api.listPeople())
  const { data: companies } = useData(() => api.listCompanies())
  const [current, setCurrent] = useState(links)
  const refresh = async () => setCurrent((await api.listBoards()).find((b) => b.id === id)?.links ?? [])
  const sel = 'h-8.5 w-full rounded-md border border-rule-strong bg-paper-raised px-2 text-[13px]'
  return (
    <Dialog open={open} onClose={onClose} title="Link this board" width={480}>
      <p className="mb-3 text-[12.5px] text-ink-3">A linked board shows on that person's or company's page.</p>
      <div className="flex flex-col gap-3">
        <Field label="Person"><select aria-label="Link person" className={sel} value="" onChange={async (e) => { if (e.target.value) { await api.linkBoard(id, { personId: Number(e.target.value) }); void refresh() } }}><option value="">Choose…</option>{people?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.companyName ? `, ${p.companyName}` : ''}</option>)}</select></Field>
        <Field label="Company"><select aria-label="Link company" className={sel} value="" onChange={async (e) => { if (e.target.value) { await api.linkBoard(id, { companyId: Number(e.target.value) }); void refresh() } }}><option value="">Choose…</option>{companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        {current.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {current.map((l) => (
              <li key={`${l.personId}-${l.companyId}`} className="flex items-center gap-1 rounded-md border border-rule-strong bg-paper-raised py-1 pl-2.5 pr-1 text-[12.5px]">
                {l.label}<button aria-label={`Unlink ${l.label}`} className="rounded px-1 text-ink-3 hover:text-ink" onClick={async () => { await api.unlinkBoard(id, { personId: l.personId, companyId: l.companyId }); void refresh() }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

function TemplatePanel({ open, id, name, onClose, onBefore }: { open: boolean; id: string; name: string; onClose: () => void; onBefore: () => Promise<void> }) {
  const toast = useToast()
  const [tname, setTname] = useState(name)
  useEffect(() => { if (open) setTname(name) }, [open, name])
  return (
    <Dialog open={open} onClose={onClose} title="Save as template">
      <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); await onBefore(); await api.saveBoardAsTemplate(id, tname); onClose(); toast(`Template "${tname}" saved. Use it from New board.`) }}>
        <Field label="Template name"><Input value={tname} onChange={(e) => setTname(e.target.value)} autoFocus /></Field>
        <div className="flex justify-end"><Button type="submit" variant="primary"><Palette size={14} />Save template</Button></div>
      </form>
    </Dialog>
  )
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })
}

export { FONT_FAMILY }
