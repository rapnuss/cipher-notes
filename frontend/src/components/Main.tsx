import {ActionIcon, Flex} from '@mantine/core'
import {SearchInput} from './SearchInput'
import {NotesGrid} from './NotesGrid'
import {addNote} from '../state/notes'
import {NotesSortSelect} from './NotesSortSelect'
import {IconPlus} from './icons/IconPlus'
import {spotlight} from '@mantine/spotlight'
import {StatusBar} from './StatusBar'
import {toggleLabelSelector} from '../state/labels'
import {IconLabel} from './icons/IconLabel'
import {ActionIconWithText} from './ActionIconWithText'
import {IconMenu2} from './icons/IconMenu2'
import {useFileDialog} from '@mantine/hooks'
import {activeLabelIsUuid, FileBlob, FileMeta} from '../business/models'
import {splitFilename} from '../util/misc'
import {useSelector} from '../state/store'
import {db} from '../db'
import {setFilesImporting} from '../state/files'
import {IconPhoto} from './icons/IconPhoto'

export const Main = () => (
  <>
    <Flex gap='xs' p='md' bg='rgba(0,0,0,.1)' justify='space-between'>
      <SearchInput />
      <Flex gap='xs' flex='0 1 auto'>
        <NotesSortSelect />
        <ActionIcon title='Menu' size='input-sm' onClick={spotlight.open}>
          <IconMenu2 />
        </ActionIcon>
      </Flex>
    </Flex>
    <div style={{flex: '1 1 auto', overflow: 'hidden', position: 'relative'}}>
      <ActionIconWithText
        onClick={toggleLabelSelector}
        style={{position: 'absolute', bottom: '1.25rem', left: '1.25rem', zIndex: 1}}
        title='Open Label Selector'
        text='labels'
      >
        <IconLabel />
      </ActionIconWithText>
      <ActionIcon.Group
        orientation='horizontal'
        style={{position: 'absolute', bottom: '1.25rem', right: '1.25rem', zIndex: 1}}
      >
        <ImportActionIcon />
        <ActionIconWithText onClick={addNote} title='Create new note' text='new'>
          <IconPlus />
        </ActionIconWithText>
      </ActionIcon.Group>
      <NotesGrid />
    </div>
    <StatusBar />
  </>
)
const ImportActionIcon = () => {
  const filesImporting = useSelector((state) => state.files.importing)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const {open} = useFileDialog({
    multiple: true,
    resetOnOpen: true,
    onChange: async (files) => {
      if (!files) return
      try {
        setFilesImporting(true)
        for (const file of files) {
          const [name, ext] = splitFilename(file.name)
          const id = crypto.randomUUID()
          const now = Date.now()
          const meta: FileMeta = {
            type: 'file',
            created_at: now,
            updated_at: now,
            deleted_at: 0,
            ext,
            id,
            title: name,
            state: 'dirty',
            version: 1,
            blobState: 'local',
            mime: file.type,
            labels: activeLabelIsUuid(activeLabel) ? [activeLabel] : [],
            archived: 0,
            has_thumb: 0,
          }
          const blob: FileBlob = {
            id,
            blob: file,
          }
          await db.transaction('rw', db.files_meta, db.files_blob, async (tx) => {
            await tx.files_meta.add(meta)
            await tx.files_blob.add(blob)
          })
        }
      } finally {
        setFilesImporting(false)
      }
    },
  })
  return (
    <ActionIconWithText onClick={open} title='Import Files' text='import' loading={filesImporting}>
      <IconPhoto />
    </ActionIconWithText>
  )
}
