import {Drawer, Flex, Popover} from '@mantine/core'
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
  moveTodoByOne,
  setLabelDropdownOpen,
} from '../state/notes'
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
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useMyColorScheme} from '../helpers/useMyColorScheme'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {ActionIconWithText} from './ActionIconWithText'
import {useHotkeys} from '@mantine/hooks'

const selectHistoryItem = (openNote: OpenNote | null): NoteHistoryItem | null => {
  if (openNote === null) return null
  return openNote.type === 'note'
    ? {type: 'note', txt: openNote.txt}
    : {type: 'todo', todos: openNote.todos}
}

export const OpenNoteDialog = () => {
  const colorScheme = useMyColorScheme()
  const openNote = useSelector((state) => state.notes.openNote)
  const labelDropdownOpen = useSelector((state) => state.notes.labelDropdownOpen)
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
  useHotkeys(
    [
      [
        'Escape',
        () => {
          const activeElement = document.activeElement
          if (labelDropdownOpen) {
            // let the dropdown close itself
          } else if (
            activeElement instanceof HTMLTextAreaElement &&
            activeElement.id === 'open-note-textarea'
          ) {
            Promise.resolve().then(() =>
              document.getElementById('open-note-delete-button')?.focus()
            )
          } else if (open) {
            noteClosed()
          }
        },
      ],
    ],
    [],
    true
  )
  return (
    <Drawer
      opened={open}
      position='top'
      size='100%'
      withCloseButton={false}
      onClose={() => {}}
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
        inner: {
          maxWidth: '750px',
          left: 'max(0px, (100vw - 750px) / 2)',
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
        autoComplete='off'
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
              insertTodo()
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
          textareaId='open-note-textarea'
        />
      ) : openNote?.type === 'todo' ? (
        <TodoControl
          todos={openNote.todos}
          onTodoChecked={todoChecked}
          onTodoChanged={todoChanged}
          onInsertTodo={insertTodo}
          onTodoDeleted={deleteTodo}
          onMoveTodo={moveTodo}
          onMoveTodoByOne={moveTodoByOne}
          onUndo={undo}
          onRedo={redo}
          onUp={focusTitleInput}
        />
      ) : null}
      <Flex gap='xs'>
        <ActionIconWithText
          title='Delete note'
          text='delete'
          id='open-note-delete-button'
          onClick={() =>
            openConfirmModalWithBackHandler({
              id: 'delete-open-note',
              title: 'Delete note?',
              labels: {confirm: 'Delete', cancel: 'Cancel'},
              confirmProps: {color: 'red'},
              onConfirm: deleteOpenNote,
            })
          }
        >
          <IconTrash />
        </ActionIconWithText>
        <div style={{flex: '1 1 0'}} />
        <Popover
          width='300px'
          position='top'
          withArrow
          shadow='md'
          trapFocus
          closeOnEscape
          closeOnClickOutside
          onOpen={() => setLabelDropdownOpen(true)}
          onClose={() => setTimeout(() => setLabelDropdownOpen(false), 0)}
        >
          <Popover.Target>
            <ActionIconWithText title='Add label' text='label'>
              <IconLabel />
            </ActionIconWithText>
          </Popover.Target>
          <Popover.Dropdown>
            {openNote && <LabelDropdownContent noteId={openNote.id} />}
          </Popover.Dropdown>
        </Popover>
        <ActionIconWithText
          title={openNote?.type === 'todo' ? 'Turn into text note' : 'Turn into todo list'}
          text={openNote?.type === 'todo' ? 'text' : 'todo'}
          onClick={openNoteTypeToggled}
        >
          <IconCheckbox />
        </ActionIconWithText>
        <ActionIconWithText title='Undo' text='undo' onClick={undo} disabled={!canUndo}>
          <IconArrowBackUp />
        </ActionIconWithText>
        <ActionIconWithText title='Redo' text='redo' onClick={redo} disabled={!canRedo}>
          <IconArrowForwardUp />
        </ActionIconWithText>
        <ActionIconWithText title='Close note' text='close' onClick={noteClosed}>
          <IconX />
        </ActionIconWithText>
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
