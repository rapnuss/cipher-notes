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

export const Main = () => (
  <>
    <Flex gap='xs' p='md' bg='rgba(0,0,0,.1)' justify='space-between'>
      <SearchInput />
      <Flex gap='xs' flex='0 1 auto'>
        <NotesSortSelect />
        <ActionIcon title='Menu' size='lg' onClick={spotlight.open}>
          <IconMenu2 />
        </ActionIcon>
      </Flex>
    </Flex>
    <div style={{flex: '1 1 auto', overflow: 'hidden', position: 'relative'}}>
      <ActionIconWithText
        onClick={toggleLabelSelector}
        style={{position: 'absolute', bottom: '1.25rem', left: '1.25rem'}}
        title='Open Label Selector'
        text='labels'
      >
        <IconLabel />
      </ActionIconWithText>
      <ActionIconWithText
        onClick={addNote}
        style={{position: 'absolute', bottom: '1.25rem', right: '1.25rem'}}
        title='Create new note'
        text='new'
      >
        <IconPlus />
      </ActionIconWithText>
      <NotesGrid />
    </div>
    <StatusBar />
  </>
)
