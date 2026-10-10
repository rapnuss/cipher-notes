import Dexie, {
  EntityTable,
  liveQuery,
  type Observable,
  type Observer,
  type Subscription,
} from 'dexie'
import {FileBlob, FileMeta, FileThumb, Label, Note} from './business/models'

export const db = new Dexie('DexieDB') as Dexie & {
  notes: EntityTable<Note, 'id'>
  note_base_versions: EntityTable<Note, 'id'>
  labels: EntityTable<Label, 'id'>
  files_meta: EntityTable<FileMeta, 'id'>
  files_blob: EntityTable<FileBlob, 'id'>
  files_thumb: EntityTable<FileThumb, 'id'>
}

db.version(1).stores({notes: 'id, txt, created_at, updated_at, version, state, deleted_at'})

db.version(2)
  .stores({notes: 'id, created_at, updated_at, version, state, deleted_at, type'})
  .upgrade((tx) =>
    tx
      .table('notes')
      .toCollection()
      .modify((note) => {
        note.type = 'note'
      }),
  )

db.version(3)
  .stores({notes: 'id, created_at, updated_at, version, state, deleted_at, type'})
  .upgrade((tx) =>
    tx
      .table('notes')
      .toCollection()
      .modify((note) => {
        note.title = ''
      }),
  )

db.version(4)
  .stores({note_base_versions: 'id'})
  .upgrade(async (tx) => {
    const notes = await tx.table('notes').where('state').equals('synced').toArray()
    await tx.table('note_base_versions').bulkAdd(notes)
  })

db.version(5).stores({labels: 'id, deleted_at, state'})

db.version(6)
  .stores({notes: 'id, created_at, updated_at, version, state, deleted_at, type, archived'})
  .upgrade((tx) =>
    tx
      .table('notes')
      .toCollection()
      .modify((note) => {
        note.archived = 0
      }),
  )

db.version(7).stores({
  files_meta:
    'id, created_at, updated_at, deleted_at, state, ext, mime, archived, has_thumb, size, blob_state',
  files_blob: 'id',
  files_thumb: 'id',
})

export const distinctUntilChanged = <T>(observable: Observable<T>): Observable<T> => {
  function subscribe(observerOrNext?: Observer<T> | ((value: T) => void)): Subscription
  function subscribe(
    next?: ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null,
  ): Subscription
  function subscribe(
    observerOrNext?: Observer<T> | ((value: T) => void) | null,
    error?: ((error: unknown) => void) | null,
    complete?: (() => void) | null,
  ): Subscription {
    const observer: Observer<T> =
      typeof observerOrNext === 'function' ?
        {next: observerOrNext, error: error ?? undefined, complete: complete ?? undefined}
      : (observerOrNext ?? {})
    let hasPreviousValue = false
    let previousValue: T

    return observable.subscribe({
      start: observer.start,
      next(value) {
        if (hasPreviousValue && Object.is(previousValue, value)) return

        hasPreviousValue = true
        previousValue = value
        observer.next?.(value)
      },
      error: observer.error,
      complete: observer.complete,
    })
  }

  const distinctObservable: Observable<T> = {
    subscribe,
    [Symbol.observable]() {
      return distinctObservable
    },
  }

  return distinctObservable
}

export const distinctLiveQuery = <T>(query: () => Promise<T>): Observable<T> =>
  distinctUntilChanged(liveQuery(query))

export const hasDirtyNotesObservable = distinctLiveQuery(() =>
  db.notes
    .where('state')
    .equals('dirty')
    .first()
    .then((n) => n !== undefined),
)

export const labelsObservable = distinctLiveQuery(() =>
  db.labels.where('deleted_at').equals(0).toArray(),
)

export const hasDirtyLabelsObservable = distinctLiveQuery(() =>
  db.labels
    .where('state')
    .equals('dirty')
    .first()
    .then((l) => l !== undefined),
)

export const hasDirtyFilesMetaObservable = distinctLiveQuery(() =>
  db.files_meta
    .where('state')
    .equals('dirty')
    .first()
    .then((f) => f !== undefined),
)

export const hasUnsyncedBlobsObservable = distinctLiveQuery(() =>
  db.files_meta
    .where('state')
    .equals('synced')
    .and((f) => f.blob_state !== 'synced')
    .first()
    .then((f) => f !== undefined),
)

declare global {
  interface Window {
    db: typeof db
  }
}

if (import.meta.env.DEV && typeof window === 'object') {
  window.db = db
}
