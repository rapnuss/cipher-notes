import {ActionIcon, Flex, Popover, Text} from '@mantine/core'
import {Dropzone} from '@mantine/dropzone'
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
import {useFileDialog, useHotkeys} from '@mantine/hooks'
import {selectAnyModeOrDialogActive, useSelector} from '../state/store'
import {importFiles} from '../state/files'
import {IconPhoto} from './icons/IconPhoto'
import {
  archiveSelected,
  clearSelection,
  closeBulkLabelDropdown,
  deleteSelected,
  selectAll,
  selectSelectionActive,
  toggleBulkLabelDropdown,
  unarchiveSelected,
} from '../state/selection'
import {IconX} from './icons/IconX'
import {IconArchive} from './icons/IconArchive'
import {IconArchiveOff} from './icons/IconArchiveOff'
import {IconTrash} from './icons/IconTrash'
import {BulkLabelDropdownContent} from './LabelDropdownContent'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {IconChecks} from './icons/IconChecks'

export const Main = () => (
  <>
    <Header />
    <div style={{flex: '1 1 auto', overflow: 'hidden', position: 'relative'}}>
      <FloatingButtons />
      <NotesGrid />
    </div>
    <StatusBar />
    <FullScreenImport />
  </>
)
const FloatingButtons = () => {
  const selectionActive = useSelector(selectSelectionActive)
  if (selectionActive) return null
  return (
    <>
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
        <ActionIconWithText onClick={() => addNote(false)} title='Create new note' text='new'>
          <IconPlus />
        </ActionIconWithText>
      </ActionIcon.Group>
    </>
  )
}
const Header = () => {
  const selectionActive = useSelector(selectSelectionActive)
  const selected = useSelector((state) => state.selection.selected)
  const selectedCount = Object.keys(selected).length
  const bulkLabelOpen = useSelector((state) => state.selection.bulkLabelOpen)
  useCloseOnBack({id: 'selectionMode', open: selectionActive, onClose: clearSelection})
  useCloseOnBack({id: 'bulkLabelDropdown', open: bulkLabelOpen, onClose: closeBulkLabelDropdown})
  useHotkeys(
    [['esc', () => (bulkLabelOpen ? closeBulkLabelDropdown() : clearSelection())]],
    [],
    true
  )
  return (
    <Flex gap='xs' mih='4rem' px='md' className='header' justify='space-between' align='center'>
      {selectionActive ? (
        <>
          <Text fz='sm' lh='1.2'>
            {selectedCount} {selectedCount === 1 ? 'note' : 'notes'}
          </Text>
          <Flex gap='4'>
            <ActionIconWithText title='Select all' text='all' onClick={selectAll}>
              <IconChecks />
            </ActionIconWithText>
            <Popover
              opened={bulkLabelOpen}
              onDismiss={closeBulkLabelDropdown}
              withArrow
              trapFocus
              closeOnEscape={false}
            >
              <Popover.Target>
                <ActionIconWithText title='Label' text='label' onClick={toggleBulkLabelDropdown}>
                  <IconLabel />
                </ActionIconWithText>
              </Popover.Target>
              <Popover.Dropdown>
                <BulkLabelDropdownContent opened={bulkLabelOpen} />
              </Popover.Dropdown>
            </Popover>
            <ActionIconWithText title='Unarchive' text='unarch' onClick={unarchiveSelected}>
              <IconArchiveOff />
            </ActionIconWithText>
            <ActionIconWithText title='Archive' text='arch.' onClick={archiveSelected}>
              <IconArchive />
            </ActionIconWithText>
            <ActionIconWithText title='Delete' text='delete' onClick={deleteSelected}>
              <IconTrash />
            </ActionIconWithText>
            <ActionIconWithText title='Quit Selection' text='quit' onClick={clearSelection}>
              <IconX />
            </ActionIconWithText>
          </Flex>
        </>
      ) : (
        <>
          <SearchInput />
          <Flex gap='xs' flex='0 1 auto'>
            <NotesSortSelect />
            <ActionIcon title='Menu' size='input-sm' onClick={spotlight.open}>
              <IconMenu2 />
            </ActionIcon>
          </Flex>
        </>
      )}
    </Flex>
  )
}
const ImportActionIcon = () => {
  const filesImporting = useSelector((state) => state.files.importing)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const {open} = useFileDialog({
    multiple: true,
    resetOnOpen: true,
    onChange: async (files) => {
      if (!files) return
      await importFiles(files, activeLabel)
    },
  })
  return (
    <ActionIconWithText onClick={open} title='Add Files' text='add' loading={filesImporting}>
      <IconPhoto />
    </ActionIconWithText>
  )
}
const FullScreenImport = () => {
  const filesImporting = useSelector((state) => state.files.importing)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const anythingActive = useSelector(selectAnyModeOrDialogActive)
  return (
    <Dropzone.FullScreen
      active={!anythingActive && !filesImporting}
      onDrop={async (files) => {
        if (files.length === 0) return
        await importFiles(files, activeLabel)
      }}
    >
      Drop Files anywhere to import them
    </Dropzone.FullScreen>
  )
}
