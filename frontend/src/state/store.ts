import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {notesInit, NotesState, registerNotesSubscriptions} from './notes'
import {subscribeWithSelector} from 'zustand/middleware'
import {registerUserSubscriptions, userInit, UserState} from './user'
import {conflictsInit, ConflictsState} from './conflicts'
import {adminInit, AdminState} from './admin'
import {importInit, ImportState} from './import'
import {labelsInit, LabelsState, registerLabelsSubscriptions} from './labels'
import {historyInit, HistoryState} from './history'
import {filesInit, FilesState, registerFilesSubscriptions} from './files'
import {selectionInit, SelectionState, selectSelectionActive} from './selection'
import {storageUsageInit, StorageUsageState} from './storageUsage'

export type RootState = {
  notes: NotesState
  user: UserState
  conflicts: ConflictsState
  admin: AdminState
  import: ImportState
  labels: LabelsState
  history: HistoryState
  files: FilesState
  commandCenterOpen: boolean
  selection: SelectionState
  storageUsage: StorageUsageState
}
const init: RootState = {
  notes: notesInit,
  user: userInit,
  conflicts: conflictsInit,
  admin: adminInit,
  import: importInit,
  labels: labelsInit,
  history: historyInit,
  files: filesInit,
  commandCenterOpen: false,
  selection: selectionInit,
  storageUsage: storageUsageInit,
}
export const useSelector = create<RootState>()(immer(subscribeWithSelector(() => init)))
export const getState = useSelector.getState
export const setState = useSelector.setState
export const subscribe = useSelector.subscribe

export const setCommandCenterOpen = (open: boolean) =>
  setState((state) => {
    state.commandCenterOpen = open
  })

registerUserSubscriptions()
registerNotesSubscriptions()
registerLabelsSubscriptions()
registerFilesSubscriptions()

const selectAnyDialogExceptCommandCenterOpen = (state: RootState): boolean =>
  state.conflicts.conflicts.length > 0 ||
  state.notes.openNote !== null ||
  state.import.importDialog.open ||
  state.import.keepImportDialog.open ||
  state.notes.sync.dialogOpen ||
  state.user.registerDialog.open ||
  state.user.loginDialog.open ||
  state.user.encryptionKeyDialog.open ||
  state.user.imprintOpen ||
  state.admin.open ||
  state.labels.labelSelectorOpen ||
  state.labels.dialog.open ||
  state.files.openFile !== null ||
  state.storageUsage.open

export const selectCommandCenterDisabled = (state: RootState): boolean =>
  selectAnyDialogExceptCommandCenterOpen(state) || selectSelectionActive(state)

export const selectAnyDialogOpen = (state: RootState): boolean =>
  selectAnyDialogExceptCommandCenterOpen(state) || state.commandCenterOpen

export const selectAnyModeOrDialogActive = (state: RootState): boolean =>
  selectAnyDialogExceptCommandCenterOpen(state) ||
  state.commandCenterOpen ||
  selectSelectionActive(state)
