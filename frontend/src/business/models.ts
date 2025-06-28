import {z} from 'zod'
import {XOR} from '../util/type'
import {UUID} from 'crypto'

export type ActiveLabel = UUID | 'unlabeled' | 'all' | 'archived'

export const activeLabelIsUuid = (activeLabel: ActiveLabel): activeLabel is UUID =>
  activeLabel !== 'unlabeled' && activeLabel !== 'all' && activeLabel !== 'archived'

export type NoteCommon = {
  id: string
  title: string
  created_at: number
  updated_at: number
  version: number
  state: 'dirty' | 'synced'
  deleted_at: number
  labels?: string[]
  archived: 0 | 1
}
export type TextNote = NoteCommon & {type: 'note'; txt: string}
export type TodoNote = NoteCommon & {type: 'todo'; todos: Todos}

export type Note = XOR<TextNote, TodoNote>

export type DbFile = {
  id: string
  created_at: number
  deleted_at: number
  state: 'local' | 'synced' | 'remote'
  name: string
  ext: string
  mime: string
  blob: Blob | null
}

export const noteSortProps = ['created_at', 'updated_at'] satisfies (keyof Note)[]
export const noteSortOptions = noteSortProps.map((prop) => ({
  value: prop,
  label: prop === 'created_at' ? 'Created' : 'Modified',
}))

export type NoteSortProp = (typeof noteSortProps)[number]

// TODO: make id mandatory except for imports
export const todoSchema = z.object({
  id: z.string(),
  updated_at: z.number().optional(),
  done: z.boolean(),
  txt: z.string(),
  parent: z.string().optional(),
})
export type Todo = z.infer<typeof todoSchema>
export const todosSchema = z.array(todoSchema)
export type Todos = z.infer<typeof todosSchema>

export type TextOpenNote = {
  type: 'note'
  id: string
  title: string
  txt: string
  updatedAt: number
  archived: boolean
}
export type TodoOpenNote = {
  type: 'todo'
  id: string
  title: string
  todos: Todos
  updatedAt: number
  archived: boolean
}
export type OpenNote = XOR<TextOpenNote, TodoOpenNote>

export type NoteHistoryItem = {type: 'note'; txt: string} | {type: 'todo'; todos: Todos}

export const hueOptions = [null, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const
export type Hue = (typeof hueOptions)[number]
export type Label = {
  id: string
  name: string
  hue: Hue
  version: number
  created_at: number
  updated_at: number
  deleted_at: number
  state: 'dirty' | 'synced'
}

export const textPutTxtSchema = z.object({
  title: z.string(),
  txt: z.string(),
  labels: z.array(z.string().uuid()).optional(),
  archived: z.boolean().optional(),
})
export type TextPutTxt = z.infer<typeof textPutTxtSchema>

export const todoPutTxtSchema = z.object({
  title: z.string(),
  todos: todosSchema,
  labels: z.array(z.string().uuid()).optional(),
  archived: z.boolean().optional(),
})
export type TodoPutTxt = z.infer<typeof todoPutTxtSchema>

export const labelPutTxtSchema = z.object({
  name: z.string(),
  hue: z
    .number()
    .nullable()
    .refine((hue): hue is Hue => hueOptions.includes(hue as Hue)),
})
export type LabelPutTxt = z.infer<typeof labelPutTxtSchema>

export const features = ['password_protected_notes', 'reminders'] as const
export type Feature = (typeof features)[number]

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  features: z.array(z.enum(features)),
})

export type MyJwtPayload = z.infer<typeof jwtPayloadSchema>
