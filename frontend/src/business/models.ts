import {z} from 'zod'
import {XOR} from '../util/type'
import {UUID} from 'crypto'
import {ISelection} from 'monaco-editor'

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

export type FileMeta = {
  id: string
  type: 'file'
  created_at: number
  updated_at: number
  deleted_at: number
  version: number
  state: 'dirty' | 'synced'
  blob_state: 'local' | 'synced' | 'remote'
  title: string
  ext: string
  mime: string
  labels: string[]
  archived: 0 | 1
  has_thumb: 0 | 1
  size: number
}
export type FileBlob = {
  id: string
  blob: Blob
}
export type FileThumb = {
  id: string
  blob: Blob
}

export const filePullDellKeys = Object.freeze([
  'id',
  'type',
  'created_at',
  'updated_at',
  'version',
  'deleted_at',
]) satisfies Readonly<(keyof FileMeta)[]>
export type FilePullDellKeys = (typeof filePullDellKeys)[number]
export type FilePullDel = Pick<FileMeta, FilePullDellKeys>
export type FilePullDef = Omit<FileMeta, 'deleted_at' | 'blob_state' | 'has_thumb' | 'state'> & {
  deleted_at: 0
}
export type FilePull = XOR<FilePullDel, FilePullDef>
export type FilePullWithState = FilePull & {state: FileMeta['state']}

// use record instead of array to make sure we don't forget any extra keys
const filePullDefExtraKeysEnum: {[K in FilePullDefExtraKeys]: K} = {
  title: 'title',
  ext: 'ext',
  mime: 'mime',
  labels: 'labels',
  archived: 'archived',
  size: 'size',
}
type FilePullDefExtraKeys = Exclude<keyof FilePullDef, FilePullDellKeys>
export const filePullDefExtraKeys: Readonly<FilePullDefExtraKeys[]> = Object.freeze(
  Object.values(filePullDefExtraKeysEnum)
)

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

export const initialSelection: Readonly<ISelection> = Object.freeze({
  positionColumn: 1,
  positionLineNumber: 1,
  selectionStartColumn: 1,
  selectionStartLineNumber: 1,
})

export type TextOpenNote = {
  type: 'note'
  id: string
  title: string
  txt: string
  updatedAt: number
  archived: boolean
  selections: ISelection[]
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

export type NoteHistoryItem =
  | {type: 'note'; txt: string; selections: ISelection[]}
  | {type: 'todo'; todos: Todos}

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

export const filePutTxtSchema = z.object({
  title: z.string(),
  ext: z.string(),
  mime: z.string(),
  labels: z.array(z.string().uuid()),
  archived: z.boolean(),
  size: z.number().int().positive(),
})
export type FilePutTxt = z.infer<typeof filePutTxtSchema>

export const features = ['password_protected_notes', 'reminders'] as const
export type Feature = (typeof features)[number]

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  features: z.array(z.enum(features)),
})

export type MyJwtPayload = z.infer<typeof jwtPayloadSchema>
