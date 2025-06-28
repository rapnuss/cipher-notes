import {setState} from './store'

export type FilesState = {
  importing: boolean
}
export const filesInit = {
  importing: false,
}

export const setFilesImporting = (importing: boolean) =>
  setState((state) => {
    state.files.importing = importing
  })
