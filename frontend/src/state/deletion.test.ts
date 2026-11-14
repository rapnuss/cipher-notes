import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => {
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', new EventTarget())
  const table = () => ({
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    where: vi.fn(),
  })
  return {
    tables: {
      notes: table(),
      labels: table(),
      files_meta: table(),
      files_blob: table(),
      files_thumb: table(),
    },
    transaction: vi.fn(),
    notify: vi.fn(),
    confirm: vi.fn(),
    state: {
      notes: {openNote: null as {id: string} | null, noteDialog: {}},
      files: {openFile: null as {id: string} | null},
      labels: {activeLabel: 'all'},
      selection: {selected: {} as Record<string, 'note' | 'file'>},
    },
  }
})

vi.mock('../db', () => {
  const observable = {subscribe: vi.fn()}
  return {
    db: {...mocks.tables, transaction: mocks.transaction},
    labelsObservable: observable,
    hasUnsyncedBlobsObservable: observable,
    hasDirtyNotesObservable: observable,
    hasDirtyLabelsObservable: observable,
    hasDirtyFilesMetaObservable: observable,
  }
})
vi.mock('./store', () => ({
  getState: () => mocks.state,
  setState: (update: (state: typeof mocks.state) => void) => update(mocks.state),
  subscribe: vi.fn(),
}))
vi.mock('@mantine/notifications', () => ({notifications: {show: mocks.notify}}))
vi.mock('../helpers/openConfirmModal', () => ({openConfirmModalWithBackHandler: mocks.confirm}))
vi.mock('../comlink', () => ({comlink: {}}))
vi.mock('../socket', () => ({default: {on: vi.fn()}}))
vi.mock('../business/misc', () => ({}))
vi.mock('../business/notesEncryption', () => ({encryptSyncData: vi.fn(), decryptSyncData: vi.fn()}))
vi.mock('../services/backend', () => ({isUnauthorizedRes: vi.fn(), reqSyncNotes: vi.fn()}))
vi.mock('../services/localStorage', () => ({
  loadOpenFileId: async () => null,
  storeOpenFileId: vi.fn(),
  loadOpenNoteId: async () => null,
  storeOpenNoteId: vi.fn(),
  loadNotesSortOrder: async () => null,
  storeNotesSortOrder: vi.fn(),
  loadActiveLabelId: async () => 'all',
  storeActiveLabelId: vi.fn(),
}))

import {deleteFile, deleteOpenFile} from './files'
import {deleteLabel} from './labels'
import {deleteOpenNote} from './notes'
import {deleteSelected} from './selection'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const table of Object.values(mocks.tables)) {
    table.get.mockResolvedValue({
      id: 'item',
      state: 'dirty',
      version: 2,
      updated_at: 100,
      deleted_at: 0,
    })
    const collection = {
      equals: () => collection,
      and: () => collection,
      anyOf: () => collection,
      modify: vi.fn().mockResolvedValue(0),
    }
    table.where.mockReturnValue(collection)
  }
  mocks.transaction.mockImplementation(async (...args: unknown[]) => {
    const callback = args[args.length - 1] as (tx: typeof mocks.tables) => Promise<unknown>
    return callback(mocks.tables)
  })
  mocks.state.notes.openNote = {id: 'item'}
  mocks.state.files.openFile = {id: 'item'}
  mocks.state.selection.selected = {item: 'note'}
})
afterEach(() => vi.restoreAllMocks())

describe('delete failures', () => {
  it('keeps the file open until the transaction commits', async () => {
    let commit!: () => void
    mocks.transaction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          commit = resolve
        }),
    )
    const deleting = deleteOpenFile()
    await Promise.resolve()
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.state.files.openFile).toEqual({id: 'item'})
    commit()
    await deleting
    expect(mocks.state.files.openFile).toBeNull()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('shows a notification and keeps the file open if deletion fails', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('Storage unavailable'))
    await deleteOpenFile()
    expect(mocks.state.files.openFile).toEqual({id: 'item'})
    expect(mocks.notify).toHaveBeenCalledWith({message: 'Failed to delete file', color: 'red'})
  })

  it('awaits deletion of a new local file as well', async () => {
    mocks.tables.files_meta.get.mockResolvedValueOnce({state: 'dirty', version: 1})
    mocks.tables.files_meta.delete.mockRejectedValueOnce(new Error('Delete failed'))
    expect(await deleteFile('item')).toBe(false)
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  it('does not close another file opened while deletion was pending', async () => {
    let commit!: () => void
    mocks.transaction.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          commit = resolve
        }),
    )
    const deleting = deleteOpenFile()
    await Promise.resolve()
    mocks.state.files.openFile = {id: 'another-file'}
    commit()
    await deleting
    expect(mocks.state.files.openFile).toEqual({id: 'another-file'})
  })

  it('shows a notification and keeps the note open if deletion fails', async () => {
    mocks.tables.notes.update.mockRejectedValueOnce(new Error('Storage unavailable'))
    await deleteOpenNote()
    expect(mocks.state.notes.openNote).toEqual({id: 'item'})
    expect(mocks.notify).toHaveBeenCalledWith({message: 'Failed to delete note', color: 'red'})
  })

  it('shows a notification if label deletion fails', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('Storage unavailable'))
    expect(await deleteLabel('item')).toBe(false)
    expect(mocks.notify).toHaveBeenCalledWith({message: 'Failed to delete label', color: 'red'})
  })

  it('keeps selected items selected if bulk deletion fails', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('Storage unavailable'))
    deleteSelected()
    await mocks.confirm.mock.calls[0]![0].onConfirm()
    expect(mocks.state.selection.selected).toEqual({item: 'note'})
    expect(mocks.notify).toHaveBeenCalledWith({
      message: 'Failed to delete selected items',
      color: 'red',
    })
  })
})

it('sets both label deletion timestamps even when the label was already dirty', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(200)
  expect(await deleteLabel('item')).toBe(true)
  expect(mocks.tables.labels.update).toHaveBeenCalledWith('item', {
    deleted_at: 200,
    updated_at: 200,
    state: 'dirty',
    version: 2,
  })
  expect(mocks.notify).not.toHaveBeenCalled()
})

describe('bulk file cleanup', () => {
  it('deletes blobs and thumbnails for local and synced files in the metadata transaction', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(200)
    mocks.state.selection.selected = {note: 'note', local: 'file', synced: 'file'}
    const local = {value: {state: 'dirty', version: 1, deleted_at: 0, updated_at: 100}}
    const synced = {value: {state: 'synced', version: 2, deleted_at: 0, updated_at: 100}}
    const modify = vi.fn(async (mutate) => {
      for (const ref of [local, synced]) mutate(ref.value, ref)
    })
    mocks.tables.files_meta.where.mockReturnValue({anyOf: () => ({modify})})
    deleteSelected()
    await mocks.confirm.mock.calls[0]![0].onConfirm()

    expect(local.value).toBeUndefined()
    expect(synced.value).toMatchObject({state: 'dirty', version: 3, deleted_at: 200})
    expect(mocks.tables.files_blob.bulkDelete).toHaveBeenCalledWith(['local', 'synced'])
    expect(mocks.tables.files_thumb.bulkDelete).toHaveBeenCalledWith(['local', 'synced'])
    expect(mocks.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.tables.notes,
      mocks.tables.files_meta,
      mocks.tables.files_blob,
      mocks.tables.files_thumb,
      expect.any(Function),
    )
    expect(mocks.state.selection.selected).toEqual({})
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it.each(['files_blob', 'files_thumb'] as const)(
    'reports %s cleanup failures and retains selection',
    async (table) => {
      mocks.state.selection.selected = {local: 'file'}
      mocks.tables[table].bulkDelete.mockRejectedValueOnce(new Error('Cleanup failed'))
      deleteSelected()
      await mocks.confirm.mock.calls[0]![0].onConfirm()
      expect(mocks.state.selection.selected).toEqual({local: 'file'})
      expect(mocks.notify).toHaveBeenCalledWith({
        message: 'Failed to delete selected items',
        color: 'red',
      })
    },
  )

  it('does not delete file data when only notes were selected', async () => {
    deleteSelected()
    await mocks.confirm.mock.calls[0]![0].onConfirm()
    expect(mocks.tables.files_blob.bulkDelete).not.toHaveBeenCalled()
    expect(mocks.tables.files_thumb.bulkDelete).not.toHaveBeenCalled()
  })
})
