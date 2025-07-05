/// <reference lib="webworker" />

import {db} from './db'
import {canvasSupportedImageMimeTypes, generateThumbnail} from './util/images'

export const generateThumbnails = async (): Promise<void> => {
  const ids = await db.files_meta
    .where('mime')
    .anyOf(canvasSupportedImageMimeTypes)
    .and(({has_thumb}) => has_thumb === 0)
    .primaryKeys()
  const blobs = await db.files_blob.where('id').anyOf(ids).toArray()

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
  // TODO: handle deletion while generating thumbnails
  await db.transaction('rw', db.files_meta, db.files_thumb, async (tx) => {
    await tx.files_thumb.bulkAdd(thumbs)
    await tx.files_meta.bulkUpdate(thumbs.map((t) => ({key: t.id, changes: {has_thumb: 1}})))
  })
}
