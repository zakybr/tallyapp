import { describe, expect, it } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../src/main/db/repo'
import { BoardStore } from '../../src/main/boards/store'

const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'tally-boards-'))
  return { store: new BoardStore(openDatabase(join(dir, 't.db')), join(dir, 'Boards')), dir }
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('board store', () => {
  it('saves a scene with an image to assets and reloads it', () => {
    const { store } = fresh()
    const b = store.create('Enquiry system')
    store.save(b.id, { elements: [{ id: 'r1', type: 'rectangle' }, { id: 'i1', type: 'image', fileId: 'f1' }], appState: { gridModeEnabled: true } }, [{ id: 'f1', dataURL: PNG, mimeType: 'image/png', created: 1 }])
    const loaded = store.load(b.id)
    expect(loaded.doc.elements).toHaveLength(2)
    expect(loaded.doc.appState.gridModeEnabled).toBe(true)
    expect(loaded.files[0].dataURL).toBe(PNG)
    expect(readdirSync(join(loaded.folderPath, 'assets'))).toHaveLength(1)
  })
  it('snapshots and restores, keeping a backup of the state it replaced', () => {
    const { store } = fresh()
    const b = store.create('B')
    store.save(b.id, { elements: [{ id: 'a' }], appState: {} }, [])
    const snap = store.snapshot(b.id, 'Before the meeting')
    store.save(b.id, { elements: [{ id: 'a' }, { id: 'b' }], appState: {} }, [])
    store.restoreSnapshot(b.id, snap.file)
    expect(store.load(b.id).doc.elements).toHaveLength(1)
    expect(store.snapshots(b.id).map((s) => s.name)).toEqual(['Before restore', 'Before the meeting'])
  })
  it('round-trips a .tallyboard and duplicates boards without their versions', async () => {
    const { store, dir } = fresh()
    const b = store.create('Pools pitch')
    store.update(b.id, { tags: ['pools'] })
    store.save(b.id, { elements: [{ id: 'i1', type: 'image', fileId: 'f1' }], appState: {} }, [{ id: 'f1', dataURL: PNG, mimeType: 'image/png', created: 1 }])
    store.snapshot(b.id, 'v1')
    const zip = join(dir, 'x.tallyboard')
    await store.exportZip(b.id, zip)
    const imported = await store.importZip(zip)
    expect(imported).toMatchObject({ name: 'Pools pitch', tags: ['pools'] })
    expect(store.load(imported.id).files).toHaveLength(1)
    const copy = store.create('Copy', { fromId: b.id })
    expect(store.snapshots(copy.id)).toHaveLength(0)
    expect(store.load(copy.id).files).toHaveLength(1)
  })
  it('rejects zips that are not boards and refuses path tricks', async () => {
    const { store, dir } = fresh()
    const junk = join(dir, 'junk.tallyboard')
    writeFileSync(junk, 'not a zip')
    await expect(store.importZip(junk)).rejects.toBeTruthy()
    expect(() => store.assetPath(store.create('x').id, '../../tally.db')).toThrow()
    expect(() => store.dir('../etc')).toThrow()
  })
  it('trashes, restores and purges old trash', () => {
    const { store } = fresh()
    const b = store.create('Old')
    store.trash(b.id)
    expect(store.list()).toHaveLength(0)
    expect(store.list({ trashed: true })).toHaveLength(1)
    store.db.prepare('UPDATE boards SET trashed_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', b.id)
    expect(store.purgeOldTrash()).toBe(1)
    expect(existsSync(store.dir(b.id))).toBe(false)
    expect(store.presets().map((p) => p.name)).toEqual(['Tally', 'Tally accent'])
  })
})
