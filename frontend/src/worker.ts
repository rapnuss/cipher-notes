/// <reference lib="webworker" />

import {db} from './db'
import {GetPresignedUrlsReq, reqGetPresignedUrls} from './services/backend'
import {canvasSupportedImageMimeTypes, generateThumbnail} from './util/images'
import {nonConcurrent} from './util/misc'
import XSet from './util/XSet'

export const generateThumbnails = nonConcurrent(async (): Promise<void> => {
  const ids = await db.files_meta
    .where('mime')
    .anyOf(canvasSupportedImageMimeTypes)
    .and(({has_thumb, blob_state}) => has_thumb === 0 && blob_state !== 'remote')
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

export const upDownloadBlobs = async (): Promise<void> => {
  const files = await db.files_meta.where('blob_state').notEqual('synced').toArray()
  const req: GetPresignedUrlsReq = {
    upload_ids: files.filter((f) => f.blob_state === 'local').map((f) => f.id),
    download_ids: files.filter((f) => f.blob_state === 'remote').map((f) => f.id),
  }
  if (req.upload_ids.length === 0 && req.download_ids.length === 0) {
    queueMicrotask(generateThumbnails)
    return
  }
  const res = await reqGetPresignedUrls(req)
  if (!res.success) {
    throw new Error(`Failed to get presigned urls: ${res.error}`)
  }
  const {upload_urls, download_urls} = res.data

  for (const {note_id, url, fields} of upload_urls) {
    const file = files.find((f) => f.id === note_id)
    if (!file) continue

    const formData = new FormData()
    for (const key in fields) {
      formData.append(key, fields[key]!)
    }
    const fb = await db.files_blob.get(file.id)
    if (!fb) continue
    formData.append('file', fb.blob)
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      throw new Error(`Failed to upload blob ${file.id}: ${res.statusText}`)
    }
    await db.files_meta.update(file.id, {blob_state: 'synced'})
  }

  for (const {note_id, url} of download_urls) {
    const file = files.find((f) => f.id === note_id)
    if (!file) continue

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to download blob ${file.id}: ${res.statusText}`)
    }
    const blob = await res.blob()
    await db.transaction('rw', db.files_meta, db.files_blob, async (tx) => {
      await tx.files_meta.update(file.id, {blob_state: 'synced'})
      await tx.files_blob.put({id: file.id, blob})
    })
  }
  queueMicrotask(generateThumbnails)
}
