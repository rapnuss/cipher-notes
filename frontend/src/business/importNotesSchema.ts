import {z} from 'zod'
import {hueSchema} from './models'

const importTodosSchema = z.array(
  z
    .object({
      id: z.uuidv4().optional(),
      updated_at: z.number().optional(),
      done: z.boolean(),
      txt: z.string(),
      parent: z.uuidv4().optional(),
    })
    .strip()
)
export const importNotesSchema = z.array(
  z
    .object({
      id: z.uuidv4().optional(),
      title: z.string().optional(),
      txt: z.string().optional(),
      created_at: z.number().int().positive().optional(),
      updated_at: z.number().int().positive().optional(),
      todos: importTodosSchema.optional(),
      labels: z.array(z.string()).optional(),
      archived: z.boolean().optional(),
      protected: z.boolean().optional(),
      protected_iv: z.string().optional(),
      protected_type: z.enum(['note', 'todo']).optional(),
    })
    .strip()
)
export type ImportNote = z.infer<typeof importNotesSchema>[number]

export const keepNoteCommon = z
  .object({
    attachments: z.array(z.object({filePath: z.string(), mimetype: z.string()}).strip()).optional(),
    title: z.string(),
    userEditedTimestampUsec: z.number(),
    createdTimestampUsec: z.number(),
    labels: z.array(z.object({name: z.string()}).strip()).optional(),
    isTrashed: z.boolean(),
    isPinned: z.boolean(),
    isArchived: z.boolean(),
    color: z.string(),
  })
  .strip()
export const keepTextNote = keepNoteCommon.extend({
  textContent: z.string(),
})
export const keepTodoNote = keepNoteCommon.extend({
  listContent: z.array(
    z
      .object({
        text: z.string(),
        isChecked: z.boolean(),
      })
      .strip()
  ),
})
export const keepNoteSchema = z.union([keepTextNote, keepTodoNote] as const)
export type KeepNote = z.infer<typeof keepNoteSchema>

// Export/Import schema for files_meta inside notes.json backup
export const importFilesMetaSchema = z.array(
  z
    .object({
      id: z.uuidv4(),
      title: z.string(),
      ext: z.string(),
      mime: z.string(),
      size: z.number().int().nonnegative(),
      labels: z.array(z.string()).optional(), // label names
      archived: z.boolean().optional(),
      created_at: z.number().int().positive().optional(),
      updated_at: z.number().int().positive().optional(),
      deleted_at: z.number().int().nonnegative().optional(),
      protected: z.boolean().optional(),
      protected_iv: z.string().optional(),
    })
    .strip()
)
export type ImportFileMeta = z.infer<typeof importFilesMetaSchema>[number]

// Full notes.json schema
export const notesZipSchema = z
  .object({
    notes: importNotesSchema,
    files_meta: importFilesMetaSchema,
    labelColors: z.record(z.string(), hueSchema).optional(),
    protected_notes_salt: z.string().optional(),
  })
  .strip()
export type NotesZip = z.infer<typeof notesZipSchema>
