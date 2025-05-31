import {z} from 'zod'

const importTodosSchema = z.array(
  z
    .object({
      id: z.string().uuid().optional(),
      updated_at: z.number().optional(),
      done: z.boolean(),
      txt: z.string(),
      parent: z.string().uuid().optional(),
    })
    .strip()
)
export const importNotesSchema = z.array(
  z
    .object({
      id: z.string().uuid().optional(),
      title: z.string().optional(),
      txt: z.string().optional(),
      created_at: z.number().int().positive().optional(),
      updated_at: z.number().int().positive().optional(),
      todos: importTodosSchema.optional(),
      labels: z.array(z.string()).optional(),
      archived: z.boolean().optional(),
    })
    .strip()
)
export type ImportNote = z.infer<typeof importNotesSchema>[number]

export const keepNoteCommon = z
  .object({
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
