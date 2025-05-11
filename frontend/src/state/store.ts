import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {notesInit, NotesState, registerNotesSubscriptions} from './notes'
import {subscribeWithSelector} from 'zustand/middleware'
import {registerUserSubscriptions, userInit, UserState} from './user'
import {conflictsInit, ConflictsState} from './conflicts'
import {registerSettingsSubscriptions, settingsInit, SettingsState} from './settings'
import {importInit, ImportState} from './import'
import {labelsInit, LabelsState, registerLabelsSubscriptions} from './labels'
import {historyInit, HistoryState} from './history'

export type RootState = {
  notes: NotesState
  user: UserState
  conflicts: ConflictsState
  settings: SettingsState
  import: ImportState
  labels: LabelsState
  history: HistoryState
}
const init: RootState = {
  notes: notesInit,
  user: userInit,
  conflicts: conflictsInit,
  settings: settingsInit,
  import: importInit,
  labels: labelsInit,
  history: historyInit,
}
export const useSelector = create<RootState>()(immer(subscribeWithSelector(() => init)))
export const getState = useSelector.getState
export const setState = useSelector.setState
export const subscribe = useSelector.subscribe

registerUserSubscriptions()
registerNotesSubscriptions()
registerSettingsSubscriptions()
registerLabelsSubscriptions()

export const selectAnyDialogOpen = (state: RootState): boolean =>
  state.conflicts.conflicts.length > 0 ||
  state.notes.openNote !== null ||
  state.import.importDialog.open ||
  state.import.keepImportDialog.open ||
  state.notes.sync.dialogOpen ||
  state.user.registerDialog.open ||
  state.user.loginDialog.open ||
  state.user.encryptionKeyDialog.open ||
  state.user.imprintOpen ||
  state.settings.open ||
  state.labels.labelSelectorOpen ||
  state.labels.dialog.open
