import {createSelector} from 'reselect'
import {Hue, Label} from '../business/models'
import {db, labelsObservable} from '../db'
import {RootState, setState} from './store'
import {byProp} from '../util/misc'

export type LabelsState = {
  labelSelectorOpen: boolean
  activeLabel: string | null | false
  labelsCache: Record<string, Label>
  dialog: {
    open: boolean
    id: string | null
    hue: Hue
    name: string
  }
}
export const labelsInit: LabelsState = {
  labelSelectorOpen: false,
  activeLabel: null,
  labelsCache: {},
  dialog: {
    open: false,
    id: null,
    hue: null,
    name: '',
  },
}

labelsObservable.subscribe((labels) => {
  setState((state) => {
    state.labels.labelsCache = labels.reduce((acc, label) => {
      acc[label.id] = label
      return acc
    }, {} as Record<string, Label>)
    if (
      state.labels.activeLabel &&
      (!(state.labels.activeLabel in state.labels.labelsCache) ||
        state.labels.labelsCache[state.labels.activeLabel]!.deleted_at > 0)
    ) {
      state.labels.activeLabel = null
    }
  })
})

export const toggleLabelSelector = () => {
  setState((state) => {
    state.labels.labelSelectorOpen = !state.labels.labelSelectorOpen
  })
}
export const allLabelsSelected = () => {
  setState((state) => {
    state.labels.activeLabel = null
  })
}
export const unlabeledSelected = () => {
  setState((state) => {
    state.labels.activeLabel = false
  })
}
export const labelSelected = (id: string) => {
  setState((state) => {
    state.labels.activeLabel = id
  })
}
export const openCreateLabelDialog = () => {
  setState((state) => {
    state.labels.dialog.open = true
    state.labels.dialog.id = null
    state.labels.dialog.hue = null
    state.labels.dialog.name = ''
  })
}
export const openEditLabelDialog = (id: string) => {
  setState((state) => {
    state.labels.dialog.open = true
    state.labels.dialog.id = id
    state.labels.dialog.hue = state.labels.labelsCache[id]?.hue ?? null
    state.labels.dialog.name = state.labels.labelsCache[id]?.name ?? ''
  })
}
export const closeLabelDialog = () => {
  setState((state) => {
    state.labels.dialog.open = false
  })
}
export const labelDialogNameChanged = (name: string) => {
  setState((state) => {
    state.labels.dialog.name = name
  })
}
export const labelDialogHueChanged = (hue: Hue) => {
  setState((state) => {
    state.labels.dialog.hue = hue
  })
}

export const createLabel = async (name: string, hue: Hue = null): Promise<Label> => {
  const label: Label = {
    id: crypto.randomUUID(),
    name,
    hue,
    version: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: 0,
    state: 'dirty',
  }
  await db.labels.add(label)
  setState((state) => {
    state.labels.dialog.open = false
  })
  return label
}

export const applyNewLabel = async (noteId: string, labelName: string) => {
  const label = await createLabel(labelName)
  toggleNoteLabel(noteId, label.id)
}

export const updateLabel = (id: string, props: {name?: string; hue?: Hue}) => {
  db.labels
    .where('id')
    .equals(id)
    .and((l) => l.deleted_at === 0)
    .modify((label) => {
      if (props.name !== undefined) {
        label.name = props.name
      }
      if (props.hue !== undefined) {
        label.hue = props.hue
      }
      label.updated_at = Date.now()
      label.state = 'dirty'
    })
  setState((state) => {
    state.labels.dialog.open = false
  })
}

export const deleteLabel = async (id: string) => {
  const label = await db.labels.get(id)
  if (!label || label.deleted_at > 0) {
    return
  }
  if (label.state === 'dirty' && label.version === 1) {
    await db.labels.delete(id)
    return
  }
  await db.labels.update(id, {
    deleted_at: Date.now(),
    state: 'dirty',
    version: label.state === 'dirty' ? label.version : label.version + 1,
  })
  await db.notes
    .where('deleted_at')
    .equals(0)
    .and((note) => note.labels?.includes(id) ?? false)
    .modify((note) => {
      note.labels = note.labels?.filter((l) => l !== id)
      if (note.state === 'synced') {
        note.state = 'dirty'
        note.version = note.version + 1
      }
      note.updated_at = Date.now()
    })
}

export const toggleNoteLabel = (noteId: string, labelId: string) =>
  db.notes
    .where('id')
    .equals(noteId)
    .modify((note) => {
      note.labels = (note.labels ?? []).includes(labelId)
        ? note.labels?.filter((l) => l !== labelId)
        : (note.labels ?? []).concat(labelId)
      if (note.state === 'synced') {
        note.state = 'dirty'
        note.version = note.version + 1
      }
      note.updated_at = Date.now()
    })

export const setNoteMainLabel = (noteId: string, labelId: string) =>
  db.notes
    .where('id')
    .equals(noteId)
    .modify((note) => {
      note.labels = [labelId, ...(note.labels ?? []).filter((l) => l !== labelId)]
      if (note.state === 'synced') {
        note.state = 'dirty'
        note.version = note.version + 1
      }
      note.updated_at = Date.now()
    })

export const selectCachedLabels = createSelector(
  (state: RootState) => state.labels.labelsCache,
  (labelsCache) => Object.values(labelsCache).sort(byProp('name'))
)
