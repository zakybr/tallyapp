/*
  Boards: an Excalidraw canvas per board, saved as a folder on disk
  (Boards/<id>/board.json + assets/). Shared types and the Tally style.
*/

export interface BoardMeta {
  id: string
  name: string
  tags: string[]
  folder: string
  favourite: boolean
  isTemplate: boolean
  trashedAt: string | null
  createdAt: string
  updatedAt: string
  thumbnail: string | null
  links: { personId: number | null; companyId: number | null; label: string }[]
}

export type BoardMetaPatch = Partial<Pick<BoardMeta, 'name' | 'tags' | 'folder' | 'favourite'>>

/* What a board.json holds. Elements and appState are Excalidraw's own shapes. */
export interface BoardDoc {
  version: 1
  elements: unknown[]
  appState: Record<string, unknown>
  /* fileId → asset file in assets/ (images and rendered PDF pages). */
  files: Record<string, { asset: string; mimeType: string; created: number }>
}

/* A file Excalidraw can display: dataURL is built by main from the asset on load. */
export interface BoardFile { id: string; dataURL: string; mimeType: string; created: number }

export interface LoadedBoard {
  meta: BoardMeta
  doc: BoardDoc
  files: BoardFile[]
  folderPath: string
}

export interface BoardAsset { asset: string; path: string; mimeType: string; name: string }

export interface BoardSnapshot { file: string; name: string; createdAt: string }

export interface BoardPreset {
  id: number
  name: string
  style: { strokeColor: string; backgroundColor: string; fillStyle: string; strokeWidth: number; roughness: number; fontFamily: number; fontSize: number; viewBackgroundColor?: string }
}

/* The brief's Tally palette: near-black, warm cream, amber as the only accent. */
export const TALLY_COLOURS = { ink: '#0B0B0A', cream: '#F2EDE4', amber: '#D9711A' }

/*
  Excalidraw's font slots, re-pointed at Tally's fonts by swapping the font
  files we bundle (see scripts/excalidraw-assets.mjs): Nunito → General Sans,
  Lilita One → Barlow Condensed, Comic Shanns → JetBrains Mono.
*/
export const TALLY_FONTS = { body: 6, heading: 7, mono: 8 } as const

export const VIDEO_LINK_PREFIX = 'tally-asset:'
