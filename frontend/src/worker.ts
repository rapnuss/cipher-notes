/// <reference lib="webworker" />

import {db} from './db'
import {canvasSupportedImageMimeTypes, generateThumbnail} from './util/images'
import {nonConcurrent} from './util/misc'
import XSet from './util/XSet'

export const generateThumbnails = nonConcurrent(async (): Promise<void> => {
  const ids = await db.files_meta
    .where('mime')
    .anyOf(canvasSupportedImageMimeTypes)
    .and(({has_thumb, blobState}) => has_thumb === 0 && blobState !== 'remote')
    .primaryKeys()

  if (ids.length === 0) return

  const blobs = await db.files_blob.where('id').anyOf(ids).limit(20).toArray()

  const promises = blobs.map(async (blob) => {
    try {
      const thumb = await generateThumbnail(blob.blob)
      return {id: blob.id, blob: thumb}
    } catch (e) {
      console.error(e)
      return null
    }
  })
  const thumbs = (await Promise.all(promises)).filter((t) => t !== null)
  await db.transaction('rw', db.files_meta, db.files_thumb, async (tx) => {
    await tx.files_thumb.bulkAdd(thumbs)
    // > "If a key is not found, its corresponding changes wont be applied but the method will still succeed."
    await tx.files_meta.bulkUpdate(thumbs.map((t) => ({key: t.id, changes: {has_thumb: 1}})))
  })

  // delete dangling thumbs
  {
    const thumbIds = thumbs.map((t) => t.id)
    const metaIds = await db.files_meta.where('id').anyOf(thumbIds).primaryKeys()
    const danglingThumbs = XSet.fromItr(thumbIds).without(metaIds).toArray()
    if (danglingThumbs.length > 0) {
      await db.files_thumb.bulkDelete(danglingThumbs)
    }
  }

  if (ids.length > blobs.length) {
    queueMicrotask(generateThumbnails)
  }
})
