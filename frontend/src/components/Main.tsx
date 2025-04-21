import {ActionIcon, Flex} from '@mantine/core'
import {SearchInput} from './SearchInput'
import {NotesGrid} from './NotesGrid'
import {addNote} from '../state/notes'
import {NotesSortSelect} from './NotesSortSelect'
import {IconPlus} from './icons/IconPlus'
import {IconCommand} from './icons/IconCommand'
import {spotlight} from '@mantine/spotlight'
import {StatusBar} from './StatusBar'
import {toggleLabelSelector} from '../state/labels'
import {IconLabel} from './icons/IconLabel'

export const Main = () => (
  <>
    <Flex gap='xs' p='md' bg='rgba(0,0,0,.1)' justify='space-between'>
      <SearchInput />
      <Flex gap='xs' flex='0 1 auto'>
        <NotesSortSelect />
        <ActionIcon title='Open Command Center' size='lg' onClick={spotlight.open}>
          <IconCommand />
        </ActionIcon>
      </Flex>
    </Flex>
    <div style={{flex: '1 1 auto', overflow: 'hidden', position: 'relative'}}>
      <NotesGrid />
      <ActionIcon
        size='xl'
        variant='default'
        radius='xl'
        onClick={toggleLabelSelector}
        pos='absolute'
        bottom='1.25rem'
        left='1.25rem'
        title='Open Label Selector'
      >
        <IconLabel />
      </ActionIcon>
      <ActionIcon
        size='xl'
        variant='default'
        radius='xl'
        onClick={addNote}
        pos='absolute'
        bottom='1.25rem'
        right='1.25rem'
        title='Create new note'
      >
        <IconPlus />
      </ActionIcon>
    </div>
    <StatusBar />
  </>
)
