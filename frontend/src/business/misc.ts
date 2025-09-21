import {verifyJwt} from '../services/jwt'
import {threeWayMerge} from '../util/merge'
import {deepEquals} from '../util/misc'
import {zodParseString} from '../util/zod'
import {
  Feature,
  FileMeta,
  FilePull,
  FilePutTxt,
  filePutTxtSchema,
  Hue,
  jwtPayloadSchema,
  Label,
  labelPutTxtSchema,
  Note,
  NoteCommon,
  TextPutTxt,
  textPutTxtSchema,
  Todo,
  TodoPutTxt,
  todoPutTxtSchema,
  Todos,
} from './models'
import {Put} from './notesEncryption'

export const monospaceStyle = {
  fontFamily: "'Cascadia Code', Monaco, Consolas, monospace",
  fontWeight: '400',
  fontSize: 'var(--mantine-font-size-sm)',
} as const

const emptyRegex = /^\s*$/
const todoRegex = /^( {2,})?- \[([x ])\] (.*)$/

export const textToTodos = (text: string): Todos => {
  const lines = text.split('\n').filter((line) => !emptyRegex.test(line))

  const todos: Todos = []
  let lastParentId: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = todoRegex.exec(line)
    let todo: Todo
    if (!match) {
      const indent = line.startsWith('  ')
      todo = {
        txt: line.trim(),
        done: false,
        id: crypto.randomUUID(),
        updated_at: Date.now(),
        parent: indent ? lastParentId : undefined,
      }
      if (!indent) {
        lastParentId = todo.id
      }
    } else {
      const indent = match[1] ? true : false
      const done = match[2]! === 'x'
      const txt = match[3] ?? ''
      const parent = indent ? lastParentId : undefined
      const id = crypto.randomUUID()
      todo = {txt, done, id, updated_at: Date.now(), parent}
      if (!indent) {
        lastParentId = todo.id
      }
    }
    todos.push(todo)
  }

  return todos.length === 0
    ? [{txt: '', done: false, id: crypto.randomUUID(), updated_at: Date.now()}]
    : todos
}

export const todosToText = (todos: Todos): string =>
  // 3 spaces for md compatibility
  todos.map((t) => `${t.parent ? '   ' : ''}- [${t.done ? 'x' : ' '}] ${t.txt}`).join('\n')

export const putToLabel = (put: Put): Label => {
  const {id, created_at, updated_at, version, deleted_at, type, txt} = put
  if (type !== 'label') {
    throw new Error('Put is not a label')
  } else if (txt === null) {
    return {
      id,
      created_at,
      updated_at,
      version,
      deleted_at: deleted_at ?? 0,
      state: 'synced',
      name: '',
      hue: null,
    }
  } else {
    const {name, hue} = zodParseString(labelPutTxtSchema, put.txt) ?? {name: put.txt, hue: null}
    return {
      id,
      created_at,
      updated_at,
      version,
      deleted_at: deleted_at ?? 0,
      state: 'synced',
      name,
      hue,
    }
  }
}

export const putToNote = (put: Put): Note => {
  const {id, created_at, updated_at, version, deleted_at, type, txt} = put
  const common: NoteCommon = {
    id,
    created_at,
    updated_at,
    version,
    deleted_at: deleted_at ?? 0,
    state: 'synced',
    title: '',
    archived: 0,
  }
  if (txt === null && type === 'note') {
    return {
      ...common,
      type: 'note',
      txt: '',
    }
  } else if (txt === null && type === 'todo') {
    return {
      ...common,
      type: 'todo',
      todos: [],
    }
  } else if (typeof txt === 'string' && type === 'note') {
    const {title, txt, labels, archived} = zodParseString(textPutTxtSchema, put.txt) ?? {
      title: '',
      txt: put.txt,
      archived: false,
    }
    return {
      ...common,
      type: 'note',
      txt,
      title,
      labels,
      archived: archived ? 1 : 0,
    }
  } else if (typeof txt === 'string' && type === 'todo') {
    const {title, todos, labels, archived} = zodParseString(todoPutTxtSchema, put.txt) ?? {
      title: '',
      todos: put.txt
        ? [{done: false, txt: put.txt, id: crypto.randomUUID(), updated_at: Date.now()}]
        : [],
      archived: false,
    }
    return {
      ...common,
      type: 'todo',
      todos,
      title,
      labels,
      archived: archived ? 1 : 0,
    }
  } else {
    throw new Error('put is not a note')
  }
}

export const putToFile = (put: Put): FilePull => {
  if (put.type !== 'file') {
    throw new Error('Put is not a file')
  }
  if (put.txt === null || put.deleted_at !== null) {
    return {
      id: put.id,
      type: 'file',
      created_at: put.created_at,
      updated_at: put.updated_at,
      version: put.version,
      deleted_at: put.deleted_at,
    }
  }
  const parse = zodParseString(filePutTxtSchema, put.txt)
  if (!parse) {
    throw new Error('Invalid file put')
  }
  const {title, ext, mime, labels, archived, size} = parse
  return {
    id: put.id,
    created_at: put.created_at,
    updated_at: put.updated_at,
    version: put.version,
    deleted_at: 0,
    archived: archived ? 1 : 0,
    type: 'file',
    title,
    ext,
    mime,
    labels,
    size,
  }
}

export const noteToPut = (n: Note): Put => {
  if (n.deleted_at !== 0) {
    return {
      id: n.id,
      created_at: n.created_at,
      txt: null,
      updated_at: n.updated_at,
      version: n.version,
      deleted_at: n.deleted_at,
      type: n.type,
    }
  } else if (n.type === 'todo') {
    const txtObj: TodoPutTxt = {
      title: n.title,
      todos: n.todos,
      labels: n.labels,
      archived: !!n.archived,
    }
    return {
      id: n.id,
      created_at: n.created_at,
      txt: JSON.stringify(txtObj),
      updated_at: n.updated_at,
      version: n.version,
      deleted_at: null,
      type: n.type,
    }
  } else if (n.type === 'note') {
    const txtObj: TextPutTxt = {
      title: n.title,
      txt: n.txt,
      labels: n.labels,
      archived: !!n.archived,
    }
    return {
      id: n.id,
      created_at: n.created_at,
      txt: JSON.stringify(txtObj),
      updated_at: n.updated_at,
      version: n.version,
      deleted_at: null,
      type: n.type,
    }
  } else {
    throw new Error('Invalid note')
  }
}

export const labelToPut = (l: Label): Put => {
  if (l.deleted_at !== 0) {
    return {
      id: l.id,
      created_at: l.created_at,
      txt: null,
      updated_at: l.updated_at,
      version: l.version,
      deleted_at: l.deleted_at,
      type: 'label',
    }
  } else {
    return {
      id: l.id,
      created_at: l.created_at,
      txt: JSON.stringify({name: l.name, hue: l.hue}),
      updated_at: l.updated_at,
      version: l.version,
      deleted_at: null,
      type: 'label',
    }
  }
}

export const fileToPut = (f: FileMeta): Put => {
  const txtObj: FilePutTxt = {
    title: f.title,
    ext: f.ext,
    mime: f.mime,
    labels: f.labels,
    archived: !!f.archived,
    size: f.size,
  }
  if (f.deleted_at !== 0) {
    return {
      type: 'file',
      deleted_at: f.deleted_at,
      txt: null,
      id: f.id,
      created_at: f.created_at,
      updated_at: f.updated_at,
      version: f.version,
    }
  }
  return {
    id: f.id,
    created_at: f.created_at,
    txt: JSON.stringify(txtObj),
    updated_at: f.updated_at,
    version: f.version,
    deleted_at: null,
    type: 'file',
  }
}

export const notesIsEmpty = (note: Note): boolean =>
  note.deleted_at === 0 &&
  note.title === '' &&
  (note.type === 'note'
    ? note.txt === ''
    : note.todos.length === 0 || (note.todos.length === 1 && note.todos[0]!.txt === ''))

export const mergeNoteConflicts = (
  baseVersions: Note[],
  dirtyNotes: Note[],
  serverConflicts: Note[]
): {merged: Note[]; conflicts: Note[]} => {
  const merged: Note[] = []
  const conflicts: Note[] = []
  for (const serverConflict of serverConflicts) {
    const baseVersion = baseVersions.find((n) => n.id === serverConflict.id)
    const dirtyNote = dirtyNotes.find((n) => n.id === serverConflict.id)
    if (
      !baseVersion ||
      !dirtyNote ||
      dirtyNote.type !== serverConflict.type ||
      dirtyNote.deleted_at !== 0 ||
      serverConflict.deleted_at !== 0
    ) {
      conflicts.push(serverConflict)
    } else {
      const merge = mergeNoteConflict(baseVersion, dirtyNote, serverConflict)
      if (merge) {
        merged.push(merge)
      } else {
        conflicts.push(serverConflict)
      }
    }
  }
  return {merged, conflicts}
}

export const mergeNoteConflict = (
  baseVersion: Note,
  dirtyNote: Note,
  serverConflict: Note
): Note | null => {
  if (dirtyNote.type === 'todo') {
    return mergeTodoNoteConflict(baseVersion, dirtyNote, serverConflict)
  } else if (dirtyNote.type === 'note') {
    return mergeTextNoteConflict(baseVersion, dirtyNote, serverConflict)
  } else {
    return null
  }
}

export const todoHasIdAndUpdatedAt = (todo: Todo): boolean =>
  todo.id !== undefined && todo.updated_at !== undefined
export const todosHaveIdsAndUpdatedAt = (todos: Todos): boolean =>
  todos.every(todoHasIdAndUpdatedAt)

export const mergeTodoNoteConflict = (
  baseVersion: Note,
  dirtyNote: Note,
  serverConflict: Note
): Note | null => {
  if (
    dirtyNote.todos === undefined ||
    serverConflict.todos === undefined ||
    !todosHaveIdsAndUpdatedAt(dirtyNote.todos) ||
    !todosHaveIdsAndUpdatedAt(serverConflict.todos)
  ) {
    return null
  }
  let todos: Todos
  if (deepEquals(dirtyNote.todos, serverConflict.todos, ['id', 'updated_at'])) {
    todos = dirtyNote.todos
  } else if (baseVersion.todos === undefined || !todosHaveIdsAndUpdatedAt(baseVersion.todos)) {
    return null
  } else {
    // TODO: merge todos, be careful with child/parent relations
    return null
  }
  return {
    type: 'todo',
    id: baseVersion.id,
    created_at: baseVersion.created_at,
    updated_at: Date.now(),
    deleted_at: 0,
    version: Math.max(dirtyNote.version, serverConflict.version) + 1,
    state: 'dirty',
    title:
      dirtyNote.updated_at > serverConflict.updated_at ? dirtyNote.title : serverConflict.title,
    archived:
      dirtyNote.updated_at > serverConflict.updated_at
        ? dirtyNote.archived
        : serverConflict.archived,
    todos,
    // TODO: merge labels
    labels:
      dirtyNote.updated_at > serverConflict.updated_at ? dirtyNote.labels : serverConflict.labels,
  }
}

export const mergeTextNoteConflict = (
  baseVersion: Note,
  dirtyNote: Note,
  serverConflict: Note
): Note | null => {
  if (dirtyNote.txt === undefined || serverConflict.txt === undefined) {
    return null
  }
  let txt: string
  if (dirtyNote.txt === serverConflict.txt) {
    txt = dirtyNote.txt
  } else if (baseVersion.txt === undefined) {
    return null
  } else {
    txt = threeWayMerge(baseVersion.txt, dirtyNote.txt, serverConflict.txt)
  }
  return {
    type: 'note',
    id: baseVersion.id,
    created_at: baseVersion.created_at,
    updated_at: Date.now(),
    txt,
    title:
      dirtyNote.updated_at > serverConflict.updated_at ? dirtyNote.title : serverConflict.title,
    archived:
      dirtyNote.updated_at > serverConflict.updated_at
        ? dirtyNote.archived
        : serverConflict.archived,
    version: Math.max(dirtyNote.version, serverConflict.version) + 1,
    state: 'dirty',
    deleted_at: 0,
    // TODO: merge labels
    labels:
      dirtyNote.updated_at > serverConflict.updated_at ? dirtyNote.labels : serverConflict.labels,
  }
}

export const mergeLabelConflicts = (dirtyLabels: Label[], serverConflicts: Label[]): Label[] =>
  serverConflicts.map((serverLabel) => {
    const clientLabel = dirtyLabels.find((c) => c.id === serverLabel.id)
    if (!clientLabel) {
      throw new Error('Label not found')
    } else {
      const label = clientLabel.updated_at > serverLabel.updated_at ? clientLabel : serverLabel
      return {
        ...label,
        version: Math.max(clientLabel.version, serverLabel.version) + 1,
        state: 'dirty',
        updated_at: Math.max(clientLabel.updated_at, serverLabel.updated_at),
      }
    }
  })

export const fileMetaToPull = (file: FileMeta): FilePull => {
  const {
    created_at,
    deleted_at,
    id,
    type,
    updated_at,
    version,
    archived,
    ext,
    labels,
    mime,
    title,
    size,
  } = file
  if (deleted_at !== 0) {
    return {
      deleted_at,
      created_at,
      id,
      type,
      updated_at,
      version,
    }
  } else {
    return {
      deleted_at: 0,
      created_at,
      id,
      type,
      updated_at,
      version,
      archived,
      ext,
      mime,
      labels,
      title,
      size,
    }
  }
}

export const mergeFileConflicts = (
  dirtyFiles: FilePull[],
  serverConflicts: FilePull[]
): FilePull[] =>
  serverConflicts.map((serverFile) => {
    const clientFile = dirtyFiles.find((c) => c.id === serverFile.id)
    if (!clientFile) {
      throw new Error('File not found')
    }
    const file = clientFile.updated_at > serverFile.updated_at ? clientFile : serverFile
    if (file.deleted_at !== 0 && file.title === undefined) {
      return {
        ...file,
        version: Math.max(clientFile.version, serverFile.version) + 1,
        updated_at: Math.max(clientFile.updated_at, serverFile.updated_at),
      }
    } else if (file.deleted_at === 0 && file.title !== undefined) {
      return {
        ...file,
        version: Math.max(clientFile.version, serverFile.version) + 1,
        updated_at: Math.max(clientFile.updated_at, serverFile.updated_at),
      }
    } else {
      throw new Error('Invalid file conflict')
    }
  })

const lightColorByHue = {
  0: 'hsl(0, 92%, 65%)',
  30: 'hsl(30, 100%, 68%)',
  60: 'hsl(60, 100%, 68%)',
  90: 'hsl(90, 100%, 63%)',
  120: 'hsl(120, 100%, 65%)',
  150: 'hsl(150, 100%, 50%)',
  180: 'hsl(180, 100%, 50%)',
  210: 'hsl(210, 100%, 60%)',
  240: 'hsl(240, 100%, 73%)',
  270: 'hsl(270, 100%, 71%)',
  300: 'hsl(300, 80%, 65%)',
  330: 'hsl(330, 100%, 65%)',
} as const
const darkColorByHue = {
  0: 'hsl(0, 58%, 33%)',
  30: 'hsl(30, 74%, 29%)',
  60: 'hsl(60, 100%, 22%)',
  90: 'hsl(90, 43%, 23%)',
  120: 'hsl(120, 50%, 26%)',
  150: 'hsl(150, 62%, 25%)',
  180: 'hsl(180, 100%, 26%)',
  210: 'hsl(210, 80%, 36%)',
  240: 'hsl(240, 42%, 35%)',
  270: 'hsl(270, 56%, 33%)',
  300: 'hsl(300, 50%, 22%)',
  330: 'hsl(330, 70%, 30%)',
} as const

export const lightColorsGradient = `linear-gradient(90deg,${Object.values(lightColorByHue).join(
  ','
)})`
export const darkColorsGradient = `linear-gradient(90deg,${Object.values(darkColorByHue).join(
  ','
)})`

export const labelColor = (hue: Hue, darkMode: boolean): string =>
  hue === null ? `var(--mantine-color-body)` : darkMode ? darkColorByHue[hue] : lightColorByHue[hue]

export const deriveTodosData = (todos: Todo[]) => {
  const parentToChildIds: Record<string, string[]> = {}
  const idToTodo = {} as Record<string, Todo>
  for (const todo of todos) {
    idToTodo[todo.id] = todo
    if (todo.parent) {
      if (!parentToChildIds[todo.parent]) {
        parentToChildIds[todo.parent] = [todo.id]
      } else {
        parentToChildIds[todo.parent]!.push(todo.id)
      }
    }
  }
  const todoTree: [string, string[]][] = []
  const visualOrderUndone: string[] = []
  for (const todo of todos) {
    if (todo.parent) {
      continue
    }
    todoTree.push([todo.id, parentToChildIds[todo.id] ?? []])
    if (!todo.done) {
      visualOrderUndone.push(
        todo.id,
        ...(parentToChildIds[todo.id] ?? []).filter((id) => !idToTodo[id]!.done)
      )
    }
  }
  const visualOrderDone: string[] = []
  for (const [id, childIds] of todoTree) {
    const todo = idToTodo[id]!
    const doneChildren = childIds.filter((id) => idToTodo[id]!.done)
    if (todo.done || doneChildren.length > 0) {
      visualOrderDone.push(id, ...doneChildren)
    }
  }
  return {
    idToTodo,
    todoTree,
    visualOrderUndone,
    visualOrderDone,
    parentToChildIds,
  }
}

export const parseSubscriptionToken = async (token: string): Promise<Feature[]> => {
  try {
    const payload = await verifyJwt(token)
    const myPayload = jwtPayloadSchema.parse(payload)
    return myPayload.features
  } catch {
    return []
  }
}

export const getFilename = ({title, ext}: Pick<FileMeta, 'title' | 'ext'>): string =>
  `${title}${ext}`
