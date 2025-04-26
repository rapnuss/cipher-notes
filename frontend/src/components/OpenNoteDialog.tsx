import {Drawer, Flex, ActionIcon, Popover} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  noteClosed,
  openNoteTxtChanged,
  deleteOpenNote,
  openNoteHistoryHandler,
  deleteTodo,
  insertTodo,
  todoChanged,
  todoChecked,
  openNoteTypeToggled,
  openNoteTitleChanged,
  moveTodo,
} from '../state/notes'
import {modals} from '@mantine/modals'
import {IconArrowBackUp} from './icons/IconArrowBackUp'
import {IconArrowForwardUp} from './icons/IconArrowForwardUp'
import {useUndoRedo} from '../util/undoHook'
import {IconTrash} from './icons/IconTrash'
import {IconX} from './icons/IconX'
import {Hue, NoteHistoryItem, OpenNote} from '../business/models'
import {XTextarea} from './XTextarea'
import {TodoControl} from './TodoControl'
import {IconCheckbox} from './icons/IconCheckbox'
import {IconLabel} from './icons/IconLabel'
import {LabelDropdownContent} from './LabelDropdownContent'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {labelColor} from '../business/misc'
import {useCloseOnBack} from '../business/useCloseOnBack'
import {useMyColorScheme} from '../business/useMyColorScheme'

const selectHistoryItem = (openNote: OpenNote | null): NoteHistoryItem | null => {
  if (openNote === null) return null
  return openNote.type === 'note'
    ? {type: 'note', txt: openNote.txt}
    : {type: 'todo', todos: openNote.todos}
}

export const OpenNoteDialog = () => {
  const colorScheme = useMyColorScheme()
  const openNote = useSelector((state) => state.notes.openNote)
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const openNoteLabel = useLiveQuery(
    () => db.notes.get(openNote?.id ?? '').then((n) => n?.labels?.[0]),
    [openNote?.id]
  )
  const hue: Hue = openNoteLabel ? labelsCache[openNoteLabel]?.hue ?? null : null
  const historyItem = selectHistoryItem(openNote)
  const {undo, redo, canUndo, canRedo} = useUndoRedo<NoteHistoryItem | null>(
    historyItem,
    openNoteHistoryHandler,
    500,
    openNote?.id ?? null
  )
  const open = !!openNote
  useCloseOnBack({id: 'open-note-dialog', open, onClose: noteClosed})
  return (
    <Drawer
      opened={open}
      position='top'
      size='100%'
      withCloseButton={false}
      onClose={noteClosed}
      styles={{
        content: {
          height: 'var(--viewport-height, 100dvh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: labelColor(hue, colorScheme === 'dark'),
        },
        body: {
          flex: '0 0 100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        },
      }}
    >
      <input
        id='open-note-title'
        style={{
          border: 'none',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          outline: 'none',
          background: 'transparent',
        }}
        placeholder='Title'
        type='text'
        value={openNote?.title ?? ''}
        onChange={(e) => openNoteTitleChanged(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' ||
            (e.key === 'ArrowDown' && e.currentTarget.selectionEnd === openNote?.title.length)
          ) {
            e.preventDefault()
            e.stopPropagation()
            if (openNote?.type === 'todo' && openNote.todos.every((t) => t.done)) {
              insertTodo(0)
            }
            const parent = e.currentTarget.parentElement
            Promise.resolve().then(() => parent?.querySelector('textarea')?.focus())
          }
        }}
      />
      {openNote?.type === 'note' ? (
        <XTextarea
          placeholder='Note text'
          value={openNote?.txt ?? ''}
          onChange={openNoteTxtChanged}
          onUndo={undo}
          onRedo={redo}
          onUp={focusTitleInput}
        />
      ) : openNote?.type === 'todo' ? (
        <TodoControl
          todos={openNote.todos}
          onTodoChecked={todoChecked}
          onTodoChanged={todoChanged}
          onInsertTodo={insertTodo}
          onTodoDeleted={deleteTodo}
          onMoveTodo={moveTodo}
          onUndo={undo}
          onRedo={redo}
          onUp={focusTitleInput}
        />
      ) : null}
      <Flex gap='xs'>
        <ActionIcon
          variant='default'
          size='xl'
          title='Delete note'
          onClick={() =>
            modals.openConfirmModal({
              title: 'Delete note?',
              centered: true,
              labels: {confirm: 'Delete', cancel: 'Cancel'},
              confirmProps: {color: 'red'},
              onConfirm: deleteOpenNote,
            })
          }
        >
          <IconTrash />
        </ActionIcon>
        <div style={{flex: '1 1 0'}} />
        <Popover width='300px' position='top' withArrow shadow='md'>
          <Popover.Target>
            <ActionIcon title='Add label' size='xl' variant='default'>
              <IconLabel />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            {openNote && <LabelDropdownContent noteId={openNote.id} />}
          </Popover.Dropdown>
        </Popover>
        <ActionIcon
          size='xl'
          title={openNote?.type === 'todo' ? 'Turn into text note' : 'Turn into todo list'}
          onClick={openNoteTypeToggled}
          variant='default'
        >
          <IconCheckbox />
        </ActionIcon>
        <ActionIcon size='xl' title='Undo' onClick={undo} disabled={!canUndo} variant='default'>
          <IconArrowBackUp />
        </ActionIcon>
        <ActionIcon size='xl' title='Redo' onClick={redo} disabled={!canRedo} variant='default'>
          <IconArrowForwardUp />
        </ActionIcon>
        <ActionIcon size='xl' title='Close note' onClick={noteClosed} variant='default'>
          <IconX />
        </ActionIcon>
      </Flex>
    </Drawer>
  )
}

const focusTitleInput = () => {
  const input = document.getElementById('open-note-title') as HTMLInputElement | null
  if (input) {
    input.focus()
  }
}
