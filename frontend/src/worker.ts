/// <reference lib="webworker" />

import {db} from './db'
import {GetPresignedUrlsReq, reqGetPresignedUrls} from './services/backend'
import {decryptBlob, encryptBlob, encryptedBlobSize, importKey} from './util/encryption'
import {canvasSupportedImageMimeTypes, generateThumbnail} from './util/images'
import {indexByProp, nonConcurrent, takeSum} from './util/misc'
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

export const upDownloadBlobs = async (
  cryptoKey: string
): Promise<{selectedAll: boolean; hit_storage_limit: boolean}> => {
  const key = await importKey(cryptoKey)
  let selectedAll, hit_storage_limit
  while (true) {
    const res = await _upDownloadBlobs(key)
    selectedAll = res.selectedAll
    hit_storage_limit = res.hit_storage_limit
    if (selectedAll || hit_storage_limit) {
      break
    }
  }

  queueMicrotask(generateThumbnails)
  return {selectedAll, hit_storage_limit}
}

const _upDownloadBlobs = async (
  cryptoKey: CryptoKey
): Promise<{selectedAll: boolean; hit_storage_limit: boolean}> => {
  const unsynced = await db.files_meta.where('blob_state').notEqual('synced').toArray()

  const downloadIds = unsynced.filter((f) => f.blob_state === 'remote').map((f) => f.id)
  const localFiles = unsynced.filter((f) => f.blob_state === 'local')
  const selectedUploadIds = takeSum(localFiles, 100 * 1024 * 1024, (f) =>
    encryptedBlobSize(f.size)
  ).map((f) => f.id)

  const uploadBlobs = await db.files_blob.where('id').anyOf(selectedUploadIds).toArray()
  const encryptedUploadBlobs = await Promise.all(
    uploadBlobs.map(async (b) => ({id: b.id, blob: await encryptBlob(cryptoKey, b.blob)}))
  )
  const encryptedUploadBlobsById = indexByProp(encryptedUploadBlobs, 'id')

  const selectedAll = encryptedUploadBlobs.length === localFiles.length

  const req: GetPresignedUrlsReq = {
    uploads: encryptedUploadBlobs.map((b) => ({id: b.id, size: b.blob.size})),
    download_ids: downloadIds,
  }
  if (req.uploads.length === 0 && req.download_ids.length === 0) {
    return {selectedAll: true, hit_storage_limit: false}
  }
  const res = await reqGetPresignedUrls(req)
  if (!res.success) {
    throw new Error(`Failed to get presigned urls: ${res.error}`)
  }
  const {upload_urls, download_urls, hit_storage_limit} = res.data

  for (const {note_id, url, fields} of upload_urls) {
    const file = unsynced.find((f) => f.id === note_id)
    if (!file) continue

    const formData = new FormData()
    for (const key in fields) {
      formData.append(key, fields[key]!)
    }

    const blob = encryptedUploadBlobsById.get(file.id)?.blob
    if (!blob) continue
    formData.append('file', blob)
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
    const file = unsynced.find((f) => f.id === note_id)
    if (!file) continue

    const res = await fetch(url)
    if (!res.ok) {
      console.info(`Failed to download blob ${file.id}: ${res.status}`)
      continue
    }
    let encBlob
    try {
      encBlob = await res.blob()
    } catch (error) {
      console.info('Failed to get Blob ' + error)
      continue
    }
    const decryptedBlob = await decryptBlob(cryptoKey, encBlob, file.mime).catch(
      (e) => new Blob([`Decryption failed: ${e}`], {type: 'text/plain'})
    )
    await db.transaction('rw', db.files_meta, db.files_blob, async (tx) => {
      await tx.files_meta.update(file.id, {blob_state: 'synced'})
      await tx.files_blob.put({id: file.id, blob: decryptedBlob})
    })
  }
  return {selectedAll, hit_storage_limit}
}
