import {afterEach, describe, expect, it, vi} from 'vitest'
import type {Observer, Subscription} from 'dexie'

const sources = vi.hoisted(
  () => [] as {query: () => Promise<unknown>; observer?: Observer<unknown>}[],
)

vi.mock('dexie', async (importOriginal) => ({
  ...(await importOriginal<typeof import('dexie')>()),
  liveQuery(query: () => Promise<unknown>) {
    const source = {query, observer: undefined as Observer<unknown> | undefined}
    sources.push(source)
    return {
      subscribe(observer: Observer<unknown> | ((value: unknown) => void)) {
        source.observer = typeof observer === 'function' ? {next: observer} : observer
        return {
          unsubscribe: () => {
            source.observer = undefined
          },
        }
      },
    }
  },
}))

import {
  db,
  hasDirtyFilesMetaObservable,
  hasDirtyLabelsObservable,
  hasDirtyNotesObservable,
  hasUnsyncedBlobsObservable,
} from './db'

const refresh = async () => {
  for (const source of sources) {
    if (source.observer) source.observer.next?.(await source.query())
  }
}

let subscription: Subscription
afterEach(() => {
  subscription?.unsubscribe()
  vi.restoreAllMocks()
})

describe.each([
  ['notes', hasDirtyNotesObservable],
  ['labels', hasDirtyLabelsObservable],
  ['files_meta', hasDirtyFilesMetaObservable],
] as const)('%s sync notifications', (table, changes) => {
  const watch = (records: object[]) => {
    vi.spyOn(db[table], 'where').mockReturnValue({
      equals: () => ({first: async () => records[0]}),
    } as never)
    const onChange = vi.fn()
    subscription = changes.subscribe(onChange)
    return onChange
  }

  it('notifies later edits even when the table remains dirty after a failed sync', async () => {
    const records = [{id: 'a', state: 'dirty', title: 'before', updated_at: 1, version: 1}]
    const onChange = watch(records)
    await refresh()
    records[0]!.title = 'after'
    await refresh()
    expect(onChange.mock.calls).toEqual([[true], [true]])
  })

  it('notifies remaining batches and stops scheduling when the queue is empty', async () => {
    const records = [
      {id: 'a', state: 'dirty'},
      {id: 'b', state: 'dirty'},
    ]
    const onChange = watch(records)
    await refresh()
    records.shift()
    await refresh()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls.every(([pending]) => Boolean(pending))).toBe(true)
    records.pop()
    await refresh()
    expect(onChange).toHaveBeenLastCalledWith(false)
    await refresh()
    expect(onChange).toHaveBeenCalledTimes(4)
  })

  it('reports false when no dirty records exist', async () => {
    const onChange = watch([])
    await refresh()
    expect(onChange).toHaveBeenCalledWith(false)
  })
})

it('notifies when an empty dirty note is filled in', async () => {
  const records = [{id: 'a', state: 'dirty', title: '', txt: '', updated_at: 1, version: 1}]
  vi.spyOn(db.notes, 'where').mockReturnValue({
    equals: () => ({first: async () => records[0]}),
  } as never)
  const onChange = vi.fn()
  subscription = hasDirtyNotesObservable.subscribe(onChange)
  await refresh()
  records[0]!.txt = 'new content'
  records[0]!.updated_at = 2
  await refresh()
  expect(onChange).toHaveBeenCalledTimes(2)
})

it('checks only the first record without inspecting note contents', async () => {
  const records = [
    {
      id: 'a',
      updated_at: 1,
      version: 1,
      get txt(): string {
        throw new Error('Note contents should not be serialized')
      },
    },
  ]
  const first = vi.fn(async () => records[0])
  vi.spyOn(db.notes, 'where').mockReturnValue({equals: () => ({first})} as never)
  const onChange = vi.fn()
  subscription = hasDirtyNotesObservable.subscribe(onChange)
  await refresh()
  expect(first).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledWith(true)
})

describe('unsynced blob notifications', () => {
  type FileState = {state: string; blob_state: string}
  const watch = (files: FileState[]) => {
    vi.spyOn(db.files_meta, 'where').mockReturnValue({
      equals: (state: string) => ({
        and: (matches: (file: FileState) => boolean) => ({
          first: async () => files.find((file) => file.state === state && matches(file)),
        }),
      }),
    } as never)
    const onChange = vi.fn()
    subscription = hasUnsyncedBlobsObservable.subscribe(onChange)
    return onChange
  }

  it('notifies again while failed transfers or later batches remain pending', async () => {
    const files = [
      {state: 'synced', blob_state: 'local'},
      {state: 'synced', blob_state: 'remote'},
    ]
    const onChange = watch(files)
    await refresh()
    // A failed transfer leaves the result true; the next query must still emit.
    await refresh()
    files[0]!.blob_state = 'synced'
    await refresh()
    files[1]!.blob_state = 'synced'
    await refresh()
    expect(onChange.mock.calls).toEqual([[true], [true], [true], [false]])
  })

  it('waits for metadata sync before reporting pending blobs', async () => {
    const files = [{state: 'dirty', blob_state: 'local'}]
    const onChange = watch(files)
    await refresh()
    expect(onChange).toHaveBeenLastCalledWith(false)
    files[0]!.state = 'synced'
    await refresh()
    expect(onChange).toHaveBeenLastCalledWith(true)
  })
})
