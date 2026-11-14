import {describe, expect, it, vi} from 'vitest'
import type {Transaction} from 'dexie'

const upgrades = vi.hoisted(() => new Map<number, (tx: Transaction) => Promise<void>>())

vi.mock('dexie', () => ({
  default: class {
    version(number: number) {
      const version = {
        stores: () => version,
        upgrade(callback: (tx: Transaction) => Promise<void>) {
          upgrades.set(number, callback)
          return version
        },
      }
      return version
    }
  },
  liveQuery: () => ({subscribe: vi.fn()}),
}))

import './db'

type Row = {id: string; deleted_at?: number; scroll_pos?: unknown; blob?: Blob}

const migrate = async (files: {metadata: Row[]; blobs: Row[]; thumbs: Row[]}) => {
  const rows: Record<string, Row[]> = {
    notes: [{id: 'note', scroll_pos: {top: 10}}],
    note_base_versions: [{id: 'note', scroll_pos: {top: 20}}],
    files_meta: files.metadata,
    files_blob: files.blobs,
    files_thumb: files.thumbs,
  }
  const tx = {
    table(name: string) {
      return {
        toCollection: () => ({
          primaryKeys: async () => rows[name]!.map(({id}) => id),
          modify: async (update: (row: Row) => void) => rows[name]!.forEach(update),
        }),
        bulkDelete: async (ids: string[]) => {
          rows[name] = rows[name]!.filter(({id}) => !ids.includes(id))
        },
      }
    },
  }
  await upgrades.get(8)!(tx as unknown as Transaction)
  return rows
}

describe('v8 migration', () => {
  it('deletes orphaned blobs and thumbnails independently while preserving existing files', async () => {
    const rows = await migrate({
      metadata: [{id: 'blob-only'}, {id: 'thumb-only'}, {id: 'pending-delete', deleted_at: 100}],
      blobs: [{id: 'blob-only'}, {id: 'pending-delete'}, {id: 'orphan-blob'}, {id: 'orphan-both'}],
      thumbs: [
        {id: 'thumb-only'},
        {id: 'pending-delete'},
        {id: 'orphan-thumb'},
        {id: 'orphan-both'},
      ],
    })
    expect(rows.files_blob!.map(({id}) => id)).toEqual(['blob-only', 'pending-delete'])
    expect(rows.files_thumb!.map(({id}) => id)).toEqual(['thumb-only', 'pending-delete'])
    expect(rows.files_meta).toHaveLength(3)
    expect(
      [...rows.notes!, ...rows.note_base_versions!, ...rows.files_meta!].every(
        (row) => row.scroll_pos === null,
      ),
    ).toBe(true)
  })

  it('removes all file data when no metadata remains', async () => {
    const rows = await migrate({metadata: [], blobs: [{id: 'orphan'}], thumbs: [{id: 'orphan'}]})
    expect(rows.files_blob).toEqual([])
    expect(rows.files_thumb).toEqual([])
  })

  it('checks ownership by key without reading blob contents', async () => {
    const file = {
      id: 'existing',
      get blob(): Blob {
        throw new Error('Blob contents should not be read')
      },
    }
    const rows = await migrate({metadata: [{id: 'existing'}], blobs: [file], thumbs: [file]})
    expect(rows.files_blob![0]).toBe(file)
    expect(rows.files_thumb![0]).toBe(file)
  })
})
