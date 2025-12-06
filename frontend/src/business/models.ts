import {z} from 'zod'
import {XOR} from '../util/type'
import {UUID} from 'crypto'

export type ActiveLabel = UUID | 'unlabeled' | 'all' | 'archived'

export const activeLabelIsUuid = (activeLabel: ActiveLabel): activeLabel is UUID =>
  activeLabel !== 'unlabeled' && activeLabel !== 'all' && activeLabel !== 'archived'

export type NoteCommon = {
  id: string
  created_at: number
  updated_at: number
  version: number
  state: 'dirty' | 'synced'
  deleted_at: number
  labels?: string[]
  archived: 0 | 1
}
export type TextNote = NoteCommon & {type: 'note'; title: string; txt: string}
export type TodoNote = NoteCommon & {type: 'todo'; title: string; todos: Todos}

export type ProtectedTextNote = NoteCommon & {
  type: 'note_protected'
  cipher_text: string
  iv: string
}
export type ProtectedTodoNote = NoteCommon & {
  type: 'todo_protected'
  cipher_text: string
  iv: string
}
export type PlainNote = XOR<TextNote, TodoNote>
export type ProtectedNote = XOR<ProtectedTextNote, ProtectedTodoNote>
export type Note = XOR<PlainNote, ProtectedNote>

export type DecryptedProtectedTodoNote = TodoNote & {protected: true}
export type DecryptedProtectedTextNote = TextNote & {protected: true}
export type DecryptedProtectedNote = XOR<DecryptedProtectedTextNote, DecryptedProtectedTodoNote>

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

export type CMSelection = {
  anchor: number
  head: number
}
export const defaultSelection: Readonly<CMSelection> = Object.freeze({
  anchor: 0,
  head: 0,
})
export type TextOpenNote = {
  type: 'note'
  id: string
  title: string
  txt: string
  updatedAt: number
  archived: boolean
  protected: boolean
  selections: CMSelection[]
}
export type TodoOpenNote = {
  type: 'todo'
  id: string
  title: string
  todos: Todos
  updatedAt: number
  archived: boolean
  protected: boolean
}
export type OpenNote = XOR<TextOpenNote, TodoOpenNote>

export type NoteHistoryItem =
  | {type: 'note'; txt: string; selections: CMSelection[]}
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
  labels: z.array(z.uuidv4()).optional(),
  archived: z.boolean().optional(),
})
export type TextPutTxt = z.infer<typeof textPutTxtSchema>

export const todoPutTxtSchema = z.object({
  title: z.string(),
  todos: todosSchema,
  labels: z.array(z.uuidv4()).optional(),
  archived: z.boolean().optional(),
})
export type TodoPutTxt = z.infer<typeof todoPutTxtSchema>

export const protectedPutTxtSchema = z.object({
  labels: z.array(z.uuidv4()).optional(),
  archived: z.boolean().optional(),
  cipher_text: z.string(),
  iv: z.string(),
})
export type ProtectedPutTxt = z.infer<typeof protectedPutTxtSchema>

export const putTxtSchema = z.union([textPutTxtSchema, todoPutTxtSchema, protectedPutTxtSchema])
export type PutTxt = z.infer<typeof putTxtSchema>

export const hueSchema = z.union([
  z.literal(null),
  z.literal(0),
  z.literal(30),
  z.literal(60),
  z.literal(90),
  z.literal(120),
  z.literal(150),
  z.literal(180),
  z.literal(210),
  z.literal(240),
  z.literal(270),
  z.literal(300),
  z.literal(330),
])

export const labelPutTxtSchema = z.object({
  name: z.string(),
  hue: hueSchema,
})
export type LabelPutTxt = z.infer<typeof labelPutTxtSchema>

export const filePutTxtSchema = z.object({
  title: z.string(),
  ext: z.string(),
  mime: z.string(),
  labels: z.array(z.uuidv4()),
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

export const lightThemeOptions = ['light', 'white'] as const
export type LightTheme = (typeof lightThemeOptions)[number]
export const darkThemeOptions = ['dark', 'black'] as const
export type DarkTheme = (typeof darkThemeOptions)[number]
export type ThemeName = LightTheme | DarkTheme
export const settingsOptionsSchema = z.object({
  lightTheme: z.enum(lightThemeOptions),
  darkTheme: z.enum(darkThemeOptions),
})
export type SettingsOptions = z.infer<typeof settingsOptionsSchema>
