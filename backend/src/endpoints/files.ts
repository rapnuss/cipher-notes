import {z} from 'zod'
import {authEndpointsFactory} from '../endpointsFactory'
import {db} from '../db'
import {notesTbl} from '../db/schema'
import {and, eq, inArray, isNull} from 'drizzle-orm'
import {s3} from '../services/s3'
import {indexByProp} from '../util/misc'
import createHttpError from 'http-errors'
import {env} from '../env'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import {getSignedUrl} from '@aws-sdk/s3-request-presigner'
import {createPresignedPost} from '@aws-sdk/s3-presigned-post'

export const getUploadUrlsEndpoint = authEndpointsFactory.build({
  method: 'post',
  input: z.object({
    note_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    urls: z.array(
      z.object({
        note_id: z.string().uuid(),
        url: z.string().url(),
        fields: z.record(z.string(), z.string()),
      })
    ),
  }),
  handler: async ({input: {note_ids}, options: {user_id}}) => {
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
    if (currentSize > maxSize) {
      throw createHttpError(
        400,
        `You have reached the maximum size of ${maxSize / 1024 / 1024} MB for your files.`
      )
    }

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

    const urls = await db.transaction(async (tx) => {
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
      const urls = await Promise.all(
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
      return urls
    })

    return {urls}
  },
})

export const getDownloadUrlsEndpoint = authEndpointsFactory.build({
  method: 'get',
  input: z.object({
    note_ids: z.array(z.string().uuid()),
  }),
  output: z.object({
    urls: z.array(z.object({note_id: z.string().uuid(), url: z.string().url()})),
  }),
  handler: async ({input: {note_ids}, options: {user_id}}) => {
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

    const urls = await Promise.all(
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
    return {urls}
  },
})
