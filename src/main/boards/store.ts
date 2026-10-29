/*
  Board storage. Each board is a folder: Boards/<id>/board.json, assets/
  (media copied in, named by content hash), thumbnail.png and versions/.
  SQLite only indexes boards for the library; the folder is the truth.
  Writes are atomic (temp file + rename) so a crash never leaves half a board.
*/
import { createHash, randomUUID } from 'node:crypto'
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import yazl from 'yazl'
import yauzl from 'yauzl'
import type Database from 'better-sqlite3'
import type { BoardAsset, BoardDoc, BoardFile, BoardMeta, BoardMetaPatch, BoardPreset, BoardSnapshot, LoadedBoard } from '@shared/boards'
import { TALLY_COLOURS, TALLY_FONTS } from '@shared/boards'

type Row = Record<string, unknown>
const now = () => new Date().toISOString()
const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.pdf': 'application/pdf'
}
export const mimeOf = (file: string) => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
const EMPTY: BoardDoc = { version: 1, elements: [], appState: { viewBackgroundColor: TALLY_COLOURS.cream, gridModeEnabled: false }, files: {} }

let snapshotSeq = 0
const MAX_ENTRY = 2 * 1024 ** 3
const MAX_TOTAL = 8 * 1024 ** 3

function writeAtomic(file: string, data: string | Buffer): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, file)
}

export class BoardStore {
  constructor(readonly db: Database.Database, readonly root: string) {
    mkdirSync(root, { recursive: true })
  }

  dir(id: string): string {
    if (!/^[a-z0-9-]{8,64}$/i.test(id)) throw new Error('Bad board id')
    return join(this.root, id)
  }

  private toMeta = (r: Row): BoardMeta => {
    const id = r.id as string
    const thumb = join(this.dir(id), 'thumbnail.png')
    const links = (this.db.prepare(
      `SELECT l.person_id, l.company_id, COALESCE(p.name, c.name) AS label FROM board_links l
       LEFT JOIN people p ON p.id = l.person_id LEFT JOIN companies c ON c.id = l.company_id WHERE l.board_id = ?`
    ).all(id) as Row[]).map((l) => ({ personId: l.person_id as number | null, companyId: l.company_id as number | null, label: String(l.label ?? '') }))
    return {
      id, name: r.name as string, tags: JSON.parse(String(r.tags || '[]')), folder: r.folder as string, favourite: r.favourite === 1,
      isTemplate: r.is_template === 1, trashedAt: r.trashed_at as string | null, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
      thumbnail: existsSync(thumb) ? thumb : null, links
    }
  }

  list(opts: { trashed?: boolean; templates?: boolean } = {}): BoardMeta[] {
    const rows = this.db.prepare(
      'SELECT * FROM boards WHERE (trashed_at IS NOT NULL) = ? AND is_template = ? ORDER BY favourite DESC, updated_at DESC'
    ).all(opts.trashed ? 1 : 0, opts.templates ? 1 : 0) as Row[]
    return rows.map(this.toMeta)
  }

  get(id: string): BoardMeta | null {
    const r = this.db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as Row | undefined
    return r ? this.toMeta(r) : null
  }

  /* New board, optionally copied from another board or template (versions are not copied). */
  create(name: string, opts: { fromId?: string; isTemplate?: boolean } = {}): BoardMeta {
    const id = randomUUID()
    const dir = this.dir(id)
    const src = opts.fromId ? this.get(opts.fromId) : null
    if (opts.fromId) {
      const from = this.dir(opts.fromId)
      cpSync(from, dir, { recursive: true, filter: (p) => !p.startsWith(join(from, 'versions')) })
    } else {
      mkdirSync(join(dir, 'assets'), { recursive: true })
      writeAtomic(join(dir, 'board.json'), JSON.stringify(EMPTY))
    }
    mkdirSync(join(dir, 'versions'), { recursive: true })
    const t = now()
    const folder = opts.isTemplate || src?.isTemplate ? '' : src?.folder ?? ''
    this.db.prepare('INSERT INTO boards (id, name, tags, folder, is_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name.trim() || 'Untitled board', JSON.stringify(src?.tags ?? []), folder, opts.isTemplate ? 1 : 0, t, t)
    return this.get(id)!
  }

  update(id: string, patch: BoardMetaPatch): BoardMeta {
    const cols: string[] = []
    const vals: unknown[] = []
    if (patch.name !== undefined) { cols.push('name = ?'); vals.push(patch.name.trim() || 'Untitled board') }
    if (patch.tags !== undefined) { cols.push('tags = ?'); vals.push(JSON.stringify(patch.tags)) }
    if (patch.folder !== undefined) { cols.push('folder = ?'); vals.push(patch.folder.trim()) }
    if (patch.favourite !== undefined) { cols.push('favourite = ?'); vals.push(patch.favourite ? 1 : 0) }
    if (cols.length) this.db.prepare(`UPDATE boards SET ${cols.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, now(), id)
    return this.get(id)!
  }

  load(id: string): LoadedBoard {
    const meta = this.get(id)
    if (!meta) throw new Error('Board not found')
    const dir = this.dir(id)
    const doc = JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')) as BoardDoc
    const files: BoardFile[] = []
    for (const [fileId, f] of Object.entries(doc.files ?? {})) {
      const p = join(dir, 'assets', f.asset)
      if (!existsSync(p)) continue
      files.push({ id: fileId, mimeType: f.mimeType, created: f.created, dataURL: `data:${f.mimeType};base64,${readFileSync(p).toString('base64')}` })
    }
    return { meta, doc, files, folderPath: dir }
  }

  /*
    Save the scene. New Excalidraw files arrive as data URLs and are written
    to assets/ once; after that the doc only references them by asset name.
  */
  save(id: string, scene: { elements: unknown[]; appState: Record<string, unknown> }, newFiles: BoardFile[]): void {
    const dir = this.dir(id)
    const cur = JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')) as BoardDoc
    const files = { ...cur.files }
    for (const f of newFiles) {
      if (files[f.id]) continue
      const m = f.dataURL.match(/^data:([^;]+);base64,(.*)$/)
      if (!m) continue
      const buf = Buffer.from(m[2], 'base64')
      const ext = Object.entries(MIME).find(([, v]) => v === m[1])?.[0] ?? '.bin'
      const asset = `${createHash('sha256').update(buf).digest('hex').slice(0, 24)}${ext}`
      const p = join(dir, 'assets', asset)
      if (!existsSync(p)) writeAtomic(p, buf)
      files[f.id] = { asset, mimeType: m[1], created: f.created }
    }
    // A video pasted from another board points at that board's asset: copy it in and repoint the link.
    for (const el of scene.elements as { type?: string; link?: string | null }[]) {
      const m = el.type === 'embeddable' && el.link?.match(/^tally-asset:([a-z0-9-]+)\/([^/\\]+)$/i)
      if (!m || m[1] === id) continue
      const src = join(this.root, m[1], 'assets', m[2])
      const dst = join(dir, 'assets', m[2])
      if (existsSync(src) && !existsSync(dst)) cpSync(src, dst)
      el.link = `tally-asset:${id}/${m[2]}`
    }
    // Mappings are never dropped: an image deleted and then brought back with undo must still find its file.
    const doc: BoardDoc = { version: 1, elements: scene.elements, appState: scene.appState, files }
    writeAtomic(join(dir, 'board.json'), JSON.stringify(doc))
    this.db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now(), id)
  }

  saveThumbnail(id: string, png: Buffer): void {
    writeAtomic(join(this.dir(id), 'thumbnail.png'), png)
  }

  /* Copy a file into the board (videos, PDFs, or images added outside Excalidraw). */
  addAsset(id: string, sourcePath: string): BoardAsset {
    const buf = readFileSync(sourcePath)
    const asset = `${createHash('sha256').update(buf).digest('hex').slice(0, 24)}${extname(sourcePath).toLowerCase()}`
    const p = join(this.dir(id), 'assets', asset)
    if (!existsSync(p)) writeAtomic(p, buf)
    return { asset, path: p, mimeType: mimeOf(sourcePath), name: basename(sourcePath) }
  }

  assetPath(id: string, asset: string): string {
    if (asset.includes('/') || asset.includes('\\') || asset.startsWith('.')) throw new Error('Bad asset name')
    return join(this.dir(id), 'assets', asset)
  }

  /* ---------- versions ---------- */

  snapshot(id: string, name: string): BoardSnapshot {
    const stamp = now()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'snapshot'
    // A per-process sequence keeps order exact when two snapshots land in the same millisecond.
    const file = `${stamp.replace(/[:.]/g, '-')}-${String(++snapshotSeq).padStart(4, '0')}__${slug}.json`
    const dir = join(this.dir(id), 'versions')
    mkdirSync(dir, { recursive: true })
    const doc = JSON.parse(readFileSync(join(this.dir(id), 'board.json'), 'utf8'))
    writeAtomic(join(dir, file), JSON.stringify({ name, createdAt: stamp, doc }))
    return { file, name, createdAt: stamp }
  }

  snapshots(id: string): BoardSnapshot[] {
    const dir = join(this.dir(id), 'versions')
    if (!existsSync(dir)) return []
    return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((file) => {
      const j = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { name: string; createdAt: string }
      return { file, name: j.name, createdAt: j.createdAt }
    })
  }

  /* Restoring snapshots the current state first, so a restore can itself be undone. */
  restoreSnapshot(id: string, file: string): void {
    if (file.includes('/') || file.includes('\\') || !file.endsWith('.json')) throw new Error('Bad snapshot')
    const j = JSON.parse(readFileSync(join(this.dir(id), 'versions', file), 'utf8')) as { doc: BoardDoc }
    this.snapshot(id, 'Before restore')
    writeAtomic(join(this.dir(id), 'board.json'), JSON.stringify(j.doc))
    this.db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now(), id)
  }

  /* ---------- trash ---------- */

  trash(id: string): void { this.db.prepare('UPDATE boards SET trashed_at = ? WHERE id = ?').run(now(), id) }
  restore(id: string): void { this.db.prepare('UPDATE boards SET trashed_at = NULL WHERE id = ?').run(id) }

  purge(id: string): void {
    this.db.prepare('DELETE FROM boards WHERE id = ?').run(id)
    rmSync(this.dir(id), { recursive: true, force: true })
  }

  /* Boards in the trash for more than 30 days are deleted for good. */
  purgeOldTrash(days = 30): number {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const old = this.db.prepare('SELECT id FROM boards WHERE trashed_at IS NOT NULL AND trashed_at < ?').all(cutoff) as { id: string }[]
    for (const b of old) this.purge(b.id)
    return old.length
  }

  /* ---------- links to people and companies ---------- */

  link(id: string, target: { personId?: number | null; companyId?: number | null }): void {
    this.unlink(id, target)
    this.db.prepare('INSERT INTO board_links (board_id, person_id, company_id) VALUES (?, ?, ?)').run(id, target.personId ?? null, target.companyId ?? null)
  }

  unlink(id: string, target: { personId?: number | null; companyId?: number | null }): void {
    this.db.prepare('DELETE FROM board_links WHERE board_id = ? AND person_id IS ? AND company_id IS ?').run(id, target.personId ?? null, target.companyId ?? null)
  }

  linkedTo(target: { personId?: number; companyId?: number }): BoardMeta[] {
    const col = target.personId ? 'l.person_id' : 'l.company_id'
    const rows = this.db.prepare(
      `SELECT DISTINCT b.* FROM boards b JOIN board_links l ON l.board_id = b.id WHERE b.trashed_at IS NULL AND ${col} = ? ORDER BY b.updated_at DESC`
    ).all(target.personId ?? target.companyId) as Row[]
    return rows.map(this.toMeta)
  }

  /* ---------- style presets ---------- */

  presets(): BoardPreset[] {
    const rows = (this.db.prepare('SELECT * FROM board_presets ORDER BY id').all() as Row[])
      .map((r) => ({ id: r.id as number, name: r.name as string, style: JSON.parse(String(r.style)) as BoardPreset['style'] }))
    if (rows.length) return rows
    // First run: the brief's Tally preset (near-black, cream, amber) plus an accent variant.
    this.savePreset('Tally', { strokeColor: TALLY_COLOURS.ink, backgroundColor: TALLY_COLOURS.cream, fillStyle: 'solid', strokeWidth: 2, roughness: 0, fontFamily: TALLY_FONTS.body, fontSize: 20, viewBackgroundColor: TALLY_COLOURS.cream })
    this.savePreset('Tally accent', { strokeColor: TALLY_COLOURS.ink, backgroundColor: TALLY_COLOURS.amber, fillStyle: 'solid', strokeWidth: 2, roughness: 0, fontFamily: TALLY_FONTS.heading, fontSize: 28 })
    return this.presets()
  }

  savePreset(name: string, style: BoardPreset['style']): void {
    this.db.prepare('INSERT INTO board_presets (name, style, created_at) VALUES (?, ?, ?)').run(name, JSON.stringify(style), now())
  }

  deletePreset(id: number): void { this.db.prepare('DELETE FROM board_presets WHERE id = ?').run(id) }

  /* ---------- .tallyboard: a zip of the folder ---------- */

  exportZip(id: string, file: string): Promise<void> {
    const dir = this.dir(id)
    const meta = this.get(id)!
    const zip = new yazl.ZipFile()
    zip.addBuffer(Buffer.from(JSON.stringify({ name: meta.name, tags: meta.tags, exportedAt: now(), format: 'tallyboard/1' })), 'meta.json')
    const walk = (rel: string) => {
      for (const f of readdirSync(join(dir, rel))) {
        const r = rel ? `${rel}/${f}` : f
        if (statSync(join(dir, r)).isDirectory()) walk(r)
        else zip.addFile(join(dir, r), `board/${r}`)
      }
    }
    walk('')
    zip.end()
    return new Promise((res, rej) => { zip.outputStream.pipe(createWriteStream(file)).on('close', () => res()).on('error', rej) })
  }

  /* Importing always makes a new board; only known paths are extracted, so nothing lands outside the folder. */
  importZip(file: string): Promise<BoardMeta> {
    const id = randomUUID()
    const dir = this.dir(id)
    mkdirSync(join(dir, 'assets'), { recursive: true })
    let name = basename(file, extname(file))
    let tags: string[] = []
    let total = 0
    const allowed = /^board\/(board\.json|thumbnail\.png|assets\/[^/\\]+|versions\/[^/\\]+)$/
    return new Promise((res, rej) => {
      yauzl.open(file, { lazyEntries: true }, (err, zf) => {
        if (err || !zf) return rej(err ?? new Error('Could not open the file'))
        zf.readEntry()
        zf.on('entry', (entry: yauzl.Entry) => {
          const n = entry.fileName
          if (n !== 'meta.json' && (!allowed.test(n) || n.includes('..'))) { zf.readEntry(); return }
          // A board is never this big; refuse rather than buffer it all in memory.
          total += entry.uncompressedSize
          if (entry.uncompressedSize > MAX_ENTRY || total > MAX_TOTAL) { zf.close(); rmSync(dir, { recursive: true, force: true }); return rej(new Error('This .tallyboard is too large to import.')) }
          zf.openReadStream(entry, (e2, stream) => {
            if (e2 || !stream) return rej(e2 ?? new Error('Bad zip entry'))
            const chunks: Buffer[] = []
            stream.on('data', (c: Buffer) => chunks.push(c))
            stream.on('end', () => {
              const buf = Buffer.concat(chunks)
              if (n === 'meta.json') {
                try { const m = JSON.parse(buf.toString()); name = m.name ?? name; tags = Array.isArray(m.tags) ? m.tags : [] } catch { /* keep the file name */ }
              } else {
                const target = join(dir, n.slice('board/'.length))
                mkdirSync(join(target, '..'), { recursive: true })
                writeFileSync(target, buf)
              }
              zf.readEntry()
            })
          })
        })
        zf.on('end', () => {
          if (!existsSync(join(dir, 'board.json'))) { rmSync(dir, { recursive: true, force: true }); return rej(new Error('Not a .tallyboard file')) }
          mkdirSync(join(dir, 'versions'), { recursive: true })
          const t = now()
          this.db.prepare('INSERT INTO boards (id, name, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, JSON.stringify(tags), t, t)
          res(this.get(id)!)
        })
        zf.on('error', rej)
      })
    })
  }
}
