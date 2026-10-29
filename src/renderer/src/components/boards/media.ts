/* Turn board assets into canvas elements: images and PDF pages become image files, videos become embeds. */
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { fileUrl } from '@/lib/api'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export async function toDataUrl(path: string): Promise<string> {
  const blob = await (await fetch(fileUrl(path))).blob()
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob) })
}

export function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((res) => { const i = new Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => res({ width: 800, height: 600 }); i.src = dataUrl })
}

export async function pdfPageCount(path: string): Promise<number> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await (await fetch(fileUrl(path))).arrayBuffer()) }).promise
  return doc.numPages
}

/* Render one PDF page to a PNG data URL at a readable resolution. */
export async function renderPdfPage(path: string, page: number): Promise<{ dataUrl: string; width: number; height: number }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await (await fetch(fileUrl(path))).arrayBuffer()) }).promise
  const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages))
  const viewport = p.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await p.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
  return { dataUrl: canvas.toDataURL('image/png'), width: viewport.width / 2, height: viewport.height / 2 }
}

/* Fit within maxW × maxH, keeping the aspect ratio. */
export function fit(w: number, h: number, maxW = 640, maxH = 480): { width: number; height: number } {
  const s = Math.min(1, maxW / w, maxH / h)
  return { width: Math.round(w * s), height: Math.round(h * s) }
}
