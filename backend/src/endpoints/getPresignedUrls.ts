import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {notesTbl} from '../db/schema'
import {and, eq, gt, inArray, isNull} from 'drizzle-orm'
import {s3} from '../services/s3'
import {indexByProp} from '../util/misc'
import {env, hostingMode} from '../env'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'
import {bulkUpdateCommittedSize} from '../db/helpers'

export const getPresignedUrlsEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    uploads: z.array(z.object({id: z.string().uuid(), size: z.number().int().positive()})),
    download_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    upload_urls: z.array(
      z.object({
        note_id: z.string().uuid(),
        url: z.string(),
        fields: z.record(z.string(), z.string()),
      })
    ),
    hit_storage_limit: z.boolean(),
    download_urls: z.array(
      z.object({
        note_id: z.string().uuid(),
        url: z.string(),
      })
    ),
  }),
  handler: async ({input, options: {user_id}}) => {
    const [download_urls, uploadResult] = await Promise.all([
      getDownloadUrls(input.download_ids, user_id),
      getUploadUrls(input.uploads, user_id),
    ])
    const {upload_urls, hit_storage_limit} = uploadResult
    return {download_urls, upload_urls, hit_storage_limit}
  },
})

const getUploadUrls = async (
  uploads: {id: string; size: number}[],
  user_id: number
): Promise<{
  upload_urls: {note_id: string; url: string; fields: Record<string, string>}[]
  hit_storage_limit: boolean
}> => {
  return await db.transaction(async (tx) => {
    // TODO: read transaction semantics
    const notes = await tx
      .select({
        clientside_id: notesTbl.clientside_id,
        committed_size: notesTbl.committed_size,
      })
      .from(notesTbl)
      .where(
        and(
          eq(notesTbl.user_id, user_id),
          eq(notesTbl.type, 'file'),
          isNull(notesTbl.clientside_deleted_at)
        )
      )

    let currentSize = 0
    for (const note of notes) {
      currentSize += note.committed_size
    }
    const maxSize = Number(env.FILES_STORAGE_LIMIT)
    const notesById = indexByProp(notes, 'clientside_id')
    const uploadsById = indexByProp(uploads, 'id')
    let newSize = currentSize
    const selectedNotes: typeof notes = []
    let hit_storage_limit = false

    for (const upload of uploads) {
      const note = notesById.get(upload.id)
      if (!note) {
        continue
      } else if (note.committed_size > 0) {
        selectedNotes.push(note)
        continue
      }
      if (newSize + upload.size <= maxSize) {
        selectedNotes.push(note)
        newSize += upload.size
      } else {
        hit_storage_limit = true
        // don't break to select all already committed files
      }
    }

    await bulkUpdateCommittedSize(
      tx,
      selectedNotes.map((u) => ({
        id: u.clientside_id,
        size: uploadsById.get(u.clientside_id)!.size,
      }))
    )

    const upload_urls = await Promise.all(
      selectedNotes.map(async (note) => {
        const size = uploadsById.get(note.clientside_id)!.size
        const {url, fields} = await createPresignedPost(s3, {
          Bucket: env.S3_BUCKET,
          Key: `${user_id}/${note.clientside_id}`,
          Conditions: [
            ['content-length-range', size, size],
            ['eq', '$key', `${user_id}/${note.clientside_id}`],
          ],
          Expires: 60,
        })
        return {
          note_id: note.clientside_id,
          url: hostingMode !== 'self' ? url : url.replace(/http:\/\/[^\/]+\//, '/s3/'),
          fields,
        }
      })
    )

    return {upload_urls, hit_storage_limit}
  })
}

const getDownloadUrls = async (note_ids: string[], user_id: number) => {
  const notes = await db
    .select()
    .from(notesTbl)
    .where(
      and(
        eq(notesTbl.user_id, user_id),
        inArray(notesTbl.clientside_id, note_ids),
        eq(notesTbl.type, 'file'),
        isNull(notesTbl.clientside_deleted_at),
        gt(notesTbl.committed_size, 0)
      )
    )
  return await Promise.all(
    notes.map(async (note) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `${user_id}/${note.clientside_id}`,
        }),
        {expiresIn: 60}
      )
      return {
        note_id: note.clientside_id,
        url: hostingMode !== 'self' ? url : url.replace(/http:\/\/[^\/]+\//, '/s3/'),
      }
    })
  )
}
