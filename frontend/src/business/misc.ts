import {verifyJwt} from '../services/jwt'
import {threeWayMerge, threeWayMergeArrays} from '../util/merge'
import {deepEquals} from '../util/misc'
import {zodParseString} from '../util/zod'
import {
  Feature,
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

export const textToTodos = (text: string): Todos => {
  const todos = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({txt: line, done: false, id: crypto.randomUUID(), updated_at: Date.now()}))
  return todos.length === 0
    ? [{txt: '', done: false, id: crypto.randomUUID(), updated_at: Date.now()}]
    : todos
}

export const todosToText = (todos: Todos): string => todos.map((t) => t.txt).join('\n')

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

export const notesIsEmpty = (note: Note): boolean =>
  note.deleted_at === 0 &&
  note.title === '' &&
  (note.type === 'note'
    ? note.txt === ''
    : note.todos.length === 0 || (note.todos.length === 1 && note.todos[0]!.txt === ''))

export const mergeConflicts = (
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
      const merge = mergeConflict(baseVersion, dirtyNote, serverConflict)
      if (merge) {
        merged.push(merge)
      } else {
        conflicts.push(serverConflict)
      }
    }
  }
  return {merged, conflicts}
}

export const mergeConflict = (
  baseVersion: Note,
  dirtyNote: Note,
  serverConflict: Note
): Note | null => {
  if (dirtyNote.type === 'todo') {
    return mergeTodoConflict(baseVersion, dirtyNote, serverConflict)
  } else if (dirtyNote.type === 'note') {
    return mergeNoteConflict(baseVersion, dirtyNote, serverConflict)
  } else {
    return null
  }
}

export const todoHasIdAndUpdatedAt = (todo: Todo): boolean =>
  todo.id !== undefined && todo.updated_at !== undefined
export const todosHaveIdsAndUpdatedAt = (todos: Todos): boolean =>
  todos.every(todoHasIdAndUpdatedAt)

export const mergeTodoConflict = (
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
    const baseIds = baseVersion.todos.map((t) => t.id!)
    const dirtyIds = dirtyNote.todos.map((t) => t.id!)
    const serverIds = serverConflict.todos.map((t) => t.id!)
    const mergedIds = threeWayMergeArrays(baseIds, dirtyIds, serverIds)
    todos = mergedIds.map((id) => {
      const dirtyTodo = dirtyNote.todos.find((t) => t.id === id)
      const serverTodo = serverConflict.todos.find((t) => t.id === id)
      if (!dirtyTodo && serverTodo) {
        return serverTodo
      } else if (!serverTodo && dirtyTodo) {
        return dirtyTodo
      } else if (dirtyTodo && serverTodo) {
        return dirtyTodo.updated_at! > serverTodo.updated_at! ? dirtyTodo : serverTodo
      } else {
        throw new Error('threeWayMergeArrays failed')
      }
    })
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
  }
}

export const mergeNoteConflict = (
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
  }
}

export const mergeLabelConflicts = (dirtyLabels: Label[], serverConflicts: Label[]): Label[] =>
  serverConflicts.map((sl) => {
    const cl = dirtyLabels.find((c) => c.id === sl.id)
    if (!cl) {
      throw new Error('Label not found')
    } else {
      const l = cl.updated_at > sl.updated_at ? cl : sl
      return {
        ...l,
        version: Math.max(cl.version, sl.version) + 1,
        state: 'dirty',
        updated_at: Math.max(cl.updated_at, sl.updated_at),
      }
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
  0: 'hsl(0, 100%, 25%)',
  30: 'hsl(30, 100%, 32%)',
  60: 'hsl(60, 100%, 23%)',
  90: 'hsl(90, 100%, 32%)',
  120: 'hsl(120, 100%, 28%)',
  150: 'hsl(150, 100%, 27%)',
  180: 'hsl(180, 100%, 29%)',
  210: 'hsl(210, 100%, 34%)',
  240: 'hsl(240, 60%, 34%)',
  270: 'hsl(270, 100%, 29%)',
  300: 'hsl(300, 100%, 20%)',
  330: 'hsl(330, 100%, 31%)',
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
