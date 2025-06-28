import {ActionIcon, Flex, Menu} from '@mantine/core'
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
import {IconDotsVertical} from './icons/IconDotsVertical'
import {useFileDialog} from '@mantine/hooks'
import {activeLabelIsUuid, FileBlob, FileMeta} from '../business/models'
import {splitFilename} from '../util/misc'
import {useSelector} from '../state/store'

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
        <Menu position='top'>
          <Menu.Target>
            <ActionIcon
              variant='default'
              size='input-md'
              style={{width: '1.5rem', minWidth: '1.5rem'}}
            >
              <IconDotsVertical />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <UploadMenuItem />
          </Menu.Dropdown>
        </Menu>
        <ActionIconWithText onClick={addNote} title='Create new note' text='new'>
          <IconPlus />
        </ActionIconWithText>
      </ActionIcon.Group>
      <NotesGrid />
    </div>
    <StatusBar />
  </>
)

const UploadMenuItem = () => {
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const {open} = useFileDialog({
    multiple: true,
    resetOnOpen: true,
    onChange: async (files) => {
      if (!files) return
      for (const file of files) {
        const [name, ext] = splitFilename(file.name)
        const meta: FileMeta = {
          created_at: Date.now(),
          deleted_at: 0,
          ext,
          id: crypto.randomUUID(),
          name,
          state: 'local',
          mime: file.type,
          labels: activeLabelIsUuid(activeLabel) ? [activeLabel] : [],
          archived: 0,
        }
        const blob: FileBlob = {
          id: crypto.randomUUID(),
          blob: file,
        }
        console.log(meta)
        console.log(blob)
      }
    },
  })
  return <Menu.Item onClick={open}>Upload Image or PDF</Menu.Item>
}
