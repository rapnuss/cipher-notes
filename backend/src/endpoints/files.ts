import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {notesTbl} from '../db/schema'
import {and, eq, inArray, isNull} from 'drizzle-orm'
import {s3} from '../services/s3'
import {indexByProp} from '../util/misc'
import {env} from '../env'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'

export const getPresignedUrlsEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    upload_ids: z.array(z.string().uuid()),
    download_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    upload_urls: z.array(
      z.object({
        note_id: z.string().uuid(),
        url: z.string().url(),
        fields: z.record(z.string(), z.string()),
      })
    ),
    download_urls: z.array(
      z.object({
        note_id: z.string().uuid(),
        url: z.string().url(),
      })
    ),
  }),
  handler: async ({input, options: {user_id}}) => {
    const [download_urls, upload_urls] = await Promise.all([
      getDownloadUrls(input.download_ids, user_id),
      getUploadUrls(input.upload_ids, user_id),
    ])
    return {download_urls, upload_urls}
  },
})

const getUploadUrls = async (note_ids: string[], user_id: number) => {
  const notes = await db
    .select({
      clientside_id: notesTbl.clientside_id,
      upload_url_was_signed: notesTbl.upload_url_was_signed,
      size: notesTbl.size,
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
    if (note.upload_url_was_signed) {
      currentSize += note.size
    }
  }
  const maxSize = 100 * 1024 * 1024
  const serverNotes = indexByProp(notes, 'clientside_id')
  let newSize = currentSize
  const selectedNotes: typeof notes = []

  for (const note_id of note_ids) {
    const note = serverNotes.get(note_id)
    if (!note) {
      continue
    } else if (note.upload_url_was_signed) {
      selectedNotes.push(note)
      continue
    }
    if (newSize + note.size > maxSize) {
      break
    }
    selectedNotes.push(note)
    newSize += note.size
  }

  return await db.transaction(async (tx) => {
    await tx
      .update(notesTbl)
      .set({
        upload_url_was_signed: true,
      })
      .where(
        inArray(
          notesTbl.clientside_id,
          selectedNotes.map((note) => note.clientside_id)
        )
      )
    return await Promise.all(
      selectedNotes.map(async (note) => {
        const {url, fields} = await createPresignedPost(s3, {
          Bucket: env.S3_BUCKET,
          Key: `${user_id}/${note.clientside_id}`,
          Conditions: [
            ['content-length-range', 0, note.size],
            ['eq', '$key', `${user_id}/${note.clientside_id}`],
          ],
          Expires: 60 * 60,
        })
        return {
          note_id: note.clientside_id,
          url,
          fields,
        }
      })
    )
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
        isNull(notesTbl.clientside_deleted_at)
      )
    )
  return await Promise.all(
    notes
      .filter((note) => note.upload_url_was_signed)
      .map(async (note) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: `${user_id}/${note.clientside_id}`,
          }),
          {expiresIn: 60 * 60}
        )
        return {
          note_id: note.clientside_id,
          url,
        }
      })
  )
}
