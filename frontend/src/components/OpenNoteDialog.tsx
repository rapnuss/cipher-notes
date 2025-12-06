import {Drawer, Flex, Menu, Popover} from '@mantine/core'
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
  openNoteArchivedToggled,
  setMoreMenuOpen,
  openNoteProtectedToggled,
} from '../state/notes'
import {IconArrowBackUp} from './icons/IconArrowBackUp'
import {IconArrowForwardUp} from './icons/IconArrowForwardUp'
import {useUndoRedo} from '../util/undoHook'
import {IconTrash} from './icons/IconTrash'
import {IconX} from './icons/IconX'
import {Hue, NoteHistoryItem, OpenNote} from '../business/models'
import {Editor} from './Editor'
import {TodoControl} from './TodoControl'
import {IconCheckbox} from './icons/IconCheckbox'
import {IconLabel} from './icons/IconLabel'
import {LabelDropdownContent} from './LabelDropdownContent'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {labelBgColor, labelBorderColor, todosToText} from '../business/misc'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useThemeName} from '../helpers/useMyColorScheme'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {ActionIconWithText} from './ActionIconWithText'
import {useHotkeys} from '@mantine/hooks'
import {IconDots} from './icons/IconDots'
import {IconArchive} from './icons/IconArchive'
import {isDesktop} from '../helpers/bowser'
import {IconCopy} from './icons/IconCopy'
import {notifications} from '@mantine/notifications'
import {EditorView} from '@codemirror/view'
import {useRef} from 'react'
import {IconClockPlus} from './icons/IconClockPlus'
import {IconClockEdit} from './icons/IconClockEdit'
import {formatDateTime} from '../util/misc'
import {IconShieldCode} from './icons/IconShieldCode'

const selectHistoryItem = (openNote: OpenNote | null): NoteHistoryItem | null => {
  if (openNote === null) return null
  return openNote.type === 'note'
    ? {type: 'note', txt: openNote.txt, selections: openNote.selections}
    : {type: 'todo', todos: openNote.todos}
}

export const OpenNoteDialog = () => {
  const theme = useThemeName()
  const openNote = useSelector((state) => state.notes.openNote)
  const {labelDropdownOpen, moreMenuOpen} = useSelector((state) => state.notes.noteDialog)
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const unlockedProtectedNotes = useSelector((state) => !!state.protectedNotes.derivedKey)
  const note = useLiveQuery(
    () => (!openNote ? undefined : db.notes.get(openNote.id)),
    [openNote?.id]
  )
  const openNoteLabel = note?.labels?.[0]
  const hue: Hue = openNoteLabel ? labelsCache[openNoteLabel]?.hue ?? null : null
  const borderColor = labelBorderColor(hue, theme)
  const historyItem = selectHistoryItem(openNote)
  const {undo, redo, canUndo, canRedo} = useUndoRedo<NoteHistoryItem | null>(
    historyItem,
    openNoteHistoryHandler,
    500,
    openNote?.id ?? null
  )
  const open = !!openNote
  useCloseOnBack({id: 'open-note-dialog', open, onClose: noteClosed})
  const isNewNote =
    !!openNote && openNote.type === 'note' && openNote.txt === '' && openNote.title === ''
  const viewRef = useRef<EditorView | null>(null)
  useHotkeys(
    [
      [
        'Escape',
        () => {
          const activeElement = document.activeElement
          const editorDiv = document.getElementById('open-note-editor')
          if (moreMenuOpen) {
            setMoreMenuOpen(false)
            const button = document.querySelector('.open-note-more-menu')
            if (button instanceof HTMLElement) {
              button.focus()
            }
          } else if (labelDropdownOpen) {
            setLabelDropdownOpen(false)
            const button = document.querySelector('.open-note-label-button')
            if (button instanceof HTMLElement) {
              button.focus()
            }
          } else if (editorDiv?.contains(activeElement)) {
            const button = document.querySelector('.open-note-more-menu')
            if (button instanceof HTMLElement) {
              button.focus()
            }
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
      closeOnEscape={false}
      onClose={noteClosed}
      styles={{
        content: {
          height: 'var(--viewport-height, 100dvh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: labelBgColor(hue, theme),
          border: borderColor ? `2px solid ${borderColor}` : undefined,
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
      <Flex align='center' gap='xs'>
        {openNote?.protected && <IconShieldCode />}
        <input
          id='open-note-title'
          style={{
            border: 'none',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            outline: 'none',
            background: 'transparent',
            flex: 1,
          }}
          autoComplete='off'
          placeholder='Title'
          type='text'
          value={openNote?.title ?? ''}
          onChange={(e) => openNoteTitleChanged(e.target.value)}
          onKeyDown={(e) => {
            if (
              !openNote ||
              (e.key !== 'Enter' &&
                (e.key !== 'ArrowDown' || e.currentTarget.selectionEnd !== openNote.title.length))
            ) {
              return
            }
            e.preventDefault()
            e.stopPropagation()
            if (openNote.type === 'todo') {
              const existingTextarea = (e.currentTarget.parentElement?.querySelector(
                'textarea:not(:disabled)'
              ) ?? null) as HTMLTextAreaElement | null
              const parent = e.currentTarget.parentElement
              if (e.key === 'ArrowDown' && !openNote.todos.some((t) => !t.done)) {
                insertTodo()
                queueMicrotask(() => parent?.querySelector('textarea')?.focus())
              } else if (
                e.key === 'Enter' &&
                (!existingTextarea || existingTextarea.value !== '')
              ) {
                insertTodo()
                queueMicrotask(() => parent?.querySelector('textarea')?.focus())
              } else if (existingTextarea) {
                queueMicrotask(() => existingTextarea.focus())
              }
            } else if (openNote.type === 'note') {
              viewRef.current?.focus()
            }
          }}
          data-autofocus={isNewNote ? true : undefined}
        />
      </Flex>
      {openNote?.type === 'note' ? (
        <Editor
          placeholder='Note text'
          value={openNote.txt}
          selections={openNote.selections}
          onChange={openNoteTxtChanged}
          onUndo={undo}
          onRedo={redo}
          onUp={focusTitleInput}
          id='open-note-editor'
          autoFocus={isDesktop() && !isNewNote}
          viewCb={(view) => (viewRef.current = view)}
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
          autoFocus={isDesktop() && !isNewNote}
        />
      ) : null}
      <Flex gap='xs'>
        <Menu
          shadow='md'
          width={230}
          opened={moreMenuOpen}
          onDismiss={() => setMoreMenuOpen(false)}
          closeOnClickOutside
          closeOnEscape={false}
        >
          <Menu.Target>
            <ActionIconWithText
              title='open menu'
              text='more'
              className='open-note-more-menu'
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              data-autofocus={isDesktop() && !isNewNote ? undefined : true}
            >
              <IconDots />
            </ActionIconWithText>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconClockPlus />} disabled title='Created'>
              {!note ? '' : formatDateTime(note.created_at)}
            </Menu.Item>
            <Menu.Item leftSection={<IconClockEdit />} disabled title='Updated'>
              {!openNote ? '' : formatDateTime(openNote.updatedAt)}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCopy />}
              onClick={() => {
                if (!openNote) return
                setMoreMenuOpen(false)
                navigator.clipboard.writeText(
                  openNote.type === 'note' ? openNote.txt : todosToText(openNote.todos)
                )
                notifications.show({message: 'Note copied to clipboard.   '})
              }}
            >
              Copy to clipboard
            </Menu.Item>
            <Menu.Item
              leftSection={<IconTrash />}
              onClick={() => {
                setMoreMenuOpen(false)
                openConfirmModalWithBackHandler({
                  id: 'delete-open-note',
                  title: 'Delete note?',
                  labels: {confirm: 'Delete', cancel: 'Cancel'},
                  confirmProps: {color: 'red'},
                  onConfirm: deleteOpenNote,
                })
              }}
            >
              Delete note
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArchive />}
              onClick={() => {
                setMoreMenuOpen(false)
                openNoteArchivedToggled()
              }}
            >
              {openNote?.archived ? 'Unarchive note' : 'Archive note'}
            </Menu.Item>
            {unlockedProtectedNotes && (
              <Menu.Item
                leftSection={<IconShieldCode />}
                onClick={() => {
                  setMoreMenuOpen(false)
                  openNoteProtectedToggled()
                }}
              >
                {openNote?.protected ? 'Unprotect note' : 'Protect note'}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
        <div style={{flex: '1 1 0'}} />
        <Popover
          width='300px'
          position='top'
          withArrow
          shadow='md'
          trapFocus
          closeOnEscape={false}
          closeOnClickOutside
          opened={labelDropdownOpen}
          onDismiss={() => {
            setLabelDropdownOpen(false)
          }}
        >
          <Popover.Target>
            <ActionIconWithText
              className='open-note-label-button'
              title='Add label'
              text='label'
              onClick={() => setLabelDropdownOpen(!labelDropdownOpen)}
            >
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
        <ActionIconWithText
          title='Undo'
          text='undo'
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          onClick={() => {
            undo()
            queueMicrotask(() => {
              const view = viewRef.current
              if (view) {
                view.focus()
                view.dispatch({scrollIntoView: true})
              }
            })
          }}
          disabled={!canUndo}
        >
          <IconArrowBackUp />
        </ActionIconWithText>
        <ActionIconWithText
          title='Redo'
          text='redo'
          onMouseDown={(e) => {
            e.preventDefault()
          }}
          onClick={() => {
            redo()
            queueMicrotask(() => {
              const view = viewRef.current
              if (view) {
                view.focus()
                view.dispatch({scrollIntoView: true})
              }
            })
          }}
          disabled={!canRedo}
        >
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
