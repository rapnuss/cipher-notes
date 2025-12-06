import {Divider, Flex, Menu, Paper, UnstyledButton} from '@mantine/core'
import {getState, useSelector} from '../state/store'
import {deleteNote, noteOpened, setNoteArchived} from '../state/notes'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {bisectBy, byProp, deepEquals, truncateWithEllipsis} from '../util/misc'
import {IconSquare} from './icons/IconSquare'
import {IconCheckbox} from './icons/IconCheckbox'
import {activeLabelIsUuid, FileMeta, Note, ThemeName, Todo} from '../business/models'
import {deriveTodosData, getFilename, labelBgColor, labelBorderColor} from '../business/misc'
import {useThemeName} from '../helpers/useMyColorScheme'
import {IconDots} from './icons/IconDots'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {deleteFile, fileOpened, setFileArchived} from '../state/files'
import {FileIconWithExtension} from './FileIconWithExtension'
import {selectSelectionActive, toggleSelection, updateCurrentNotes} from '../state/selection'
import {IconSquareMinus} from './icons/IconSquareMinus'
import {useEffect} from 'react'
import {decryptNotes, isDecryptedProtectedNote, isPlainNote} from '../business/notesEncryption'
import {IconShieldCode} from './icons/IconShieldCode'

export const NotesGrid = () => {
  const query = useSelector((state) => state.notes.query)
  const sort = useSelector((state) => state.notes.sort)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const cryptoKey = useSelector((state) => state.protectedNotes.derivedKey)
  const notes = useLiveQuery(async () => {
    const queryLower = query.toLocaleLowerCase()
    const allNotes = await db.notes.where('deleted_at').equals(0).toArray()
    const allFiles = await db.files_meta.where('deleted_at').equals(0).toArray()

    const decryptedNotes = cryptoKey
      ? await decryptNotes(cryptoKey, allNotes).catch((e) => {
          console.error(e)
          return allNotes.filter(isPlainNote)
        })
      : allNotes.filter(isPlainNote)

    const notes = [...decryptedNotes, ...allFiles]
      .filter(
        (n) =>
          (activeLabel === 'archived'
            ? n.archived === 1
            : activeLabel === 'all'
            ? n.archived === 0
            : true) &&
          (activeLabel !== 'unlabeled' || !n.labels || n.labels.length === 0) &&
          (!activeLabelIsUuid(activeLabel) || n.labels?.includes(activeLabel)) &&
          (!query ||
            n.title.toLocaleLowerCase().includes(queryLower) ||
            (n.type === 'note'
              ? n.txt.toLocaleLowerCase().includes(queryLower)
              : n.type === 'todo'
              ? n.todos.some((todo) => todo.txt.toLocaleLowerCase().includes(queryLower))
              : n.type === 'file' && n.ext.toLocaleLowerCase().includes(queryLower)))
      )
      .sort(byProp(sort.prop, sort.desc))
    return bisectBy(notes ?? [], (n) => n.archived === 1)
  }, [query, sort, activeLabel, cryptoKey])
  const [archivedNotes = [], activeNotes = []] = notes ?? []
  useEffect(() => {
    if (
      deepEquals(activeNotes, getState().selection.currentNotes[0]) &&
      deepEquals(archivedNotes, getState().selection.currentNotes[1])
    )
      return
    updateCurrentNotes(activeNotes, archivedNotes)
  }, [activeNotes, archivedNotes])
  return (
    <div
      style={{
        padding: '1rem',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <style
        children={`button:focus {
          outline: 1px solid var(--mantine-primary-color-5);
        }`}
        scoped
      />
      <div
        style={{
          alignContent: 'start',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        {activeNotes.map((note) => (
          <NotePreview key={note.id} note={note} />
        ))}
      </div>
      {archivedNotes.length > 0 && activeLabel !== 'archived' && (
        <Divider my='md' label='Archived' styles={{label: {fontSize: '1rem'}}} size='md' />
      )}
      <div
        style={{
          alignContent: 'start',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        {archivedNotes.map((note) => (
          <NotePreview key={note.id} note={note} />
        ))}
      </div>
      <div style={{height: '3.5rem'}} />
    </div>
  )
}

const getGlowColor = (theme: ThemeName, borderColor: string | null): string | undefined => {
  if (theme !== 'black') return undefined
  if (!borderColor) return 'rgba(255, 255, 255, 0.3)'
  if (borderColor.startsWith('hsl(')) {
    return borderColor.replace(/hsl\(([^)]+)\)/, 'hsla($1, 0.7)')
  }
  if (borderColor.startsWith('var(')) {
    return 'rgba(255, 255, 255, 0.3)'
  }
  return borderColor
}

const NotePreview = ({note}: {note: Note | FileMeta}) => {
  const theme = useThemeName()
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const label = note.labels?.[0] ? labelsCache[note.labels[0]] : null
  const selected = useSelector((state) => !!state.selection.selected[note.id])
  const selectionActive = useSelector(selectSelectionActive)
  const activeLabelArchived = useSelector((state) => state.labels.activeLabel === 'archived')
  const borderColor = labelBorderColor(label?.hue ?? null, theme)
  const glowColor = getGlowColor(theme, borderColor)
  return (
    <Paper
      style={{
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--mantine-color-text)',
        opacity: note.archived && !selected && !activeLabelArchived ? 0.5 : 1,
        outline: selected ? '2px solid var(--mantine-color-bright)' : undefined,
        ...(glowColor ? {'--note-glow-color': glowColor} : {}),
        position: 'relative',
      }}
      shadow='lg'
      bg={labelBgColor(label?.hue ?? null, theme)}
      bd={borderColor ? `2px solid ${borderColor}` : undefined}
      className='note-preview'
    >
      {isDecryptedProtectedNote(note) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: '.75rem',
          }}
        >
          <IconShieldCode size={16} />
        </div>
      )}
      <UnstyledButton
        style={{
          flex: '1 1 auto',
          padding: '1rem 1rem 0 1rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: 'pointer',
          border: 'none',
          textAlign: 'left',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
        onClick={() =>
          selectionActive
            ? toggleSelection(note.id, note.type === 'file' ? 'file' : 'note')
            : note.type === 'file'
            ? fileOpened(note.id)
            : noteOpened(note.id)
        }
      >
        <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>
          {note.type === 'file' ? getFilename(note) : note.title}
        </div>
        {note.type === 'note' ? (
          truncateWithEllipsis(note.txt)
        ) : note.type === 'todo' ? (
          <TodosPreview todos={note.todos} />
        ) : note.type === 'file' && note.has_thumb ? (
          <img
            alt={getFilename(note)}
            src={`/thumbnails/${note.id}`}
            style={{maxHeight: 200, objectFit: 'contain'}}
          />
        ) : note.type === 'file' ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flex: '1 1 0',
            }}
          >
            <FileIconWithExtension ext={note.ext} size={100} />
          </div>
        ) : null}
      </UnstyledButton>
      <Flex justify='flex-end'>
        <Menu shadow='md'>
          <Menu.Target>
            <UnstyledButton
              disabled={selectionActive}
              px='.5rem'
              display='flex'
              title='note options'
              opacity={selectionActive ? 0 : 1}
            >
              <IconDots />
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={() => toggleSelection(note.id, note.type === 'file' ? 'file' : 'note')}
            >
              Select
            </Menu.Item>
            <Menu.Item
              onClick={() =>
                note.type === 'file'
                  ? setFileArchived(note.id, !note.archived)
                  : setNoteArchived(note.id, !note.archived)
              }
            >
              {note.archived ? 'Unarchive' : 'Archive'}
            </Menu.Item>
            <Menu.Item
              onClick={() =>
                openConfirmModalWithBackHandler({
                  id: 'delete-note-from-grid',
                  title: 'Delete note',
                  onConfirm: () =>
                    note.type === 'file' ? deleteFile(note.id) : deleteNote(note.id),
                  labels: {confirm: 'Delete', cancel: 'Cancel'},
                })
              }
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Flex>
    </Paper>
  )
}

const TodosPreview = ({todos}: {todos: Todo[]}) => {
  const {idToTodo, visualOrderUndone, visualOrderDone} = deriveTodosData(todos)
  const result: {
    id: string
    indent: boolean
    done: boolean | 'indeterminate'
    txt: string
    translucent: boolean
  }[] = []
  const undoneCount = Math.min(5, visualOrderUndone.length)
  for (let i = 0; i < undoneCount; i++) {
    const id = visualOrderUndone[i]!
    const todo = idToTodo[id]!
    result.push({
      id,
      indent: !!todo.parent,
      done: false,
      txt: todo.txt,
      translucent: false,
    })
  }
  const remainingSlots = Math.max(0, 5 - undoneCount)
  for (let i = 0; i < remainingSlots && i < visualOrderDone.length; i++) {
    const id = visualOrderDone[i]!
    const todo = idToTodo[id]!
    result.push({
      id,
      indent: !!todo.parent,
      done: todo.done ? true : 'indeterminate',
      txt: todo.txt,
      translucent: true,
    })
  }
  return result.map((todo) => (
    <Flex
      key={todo.done + todo.id}
      align='center'
      gap='xs'
      ml={todo.indent ? '1rem' : 0}
      style={{textDecoration: todo.done === true ? 'line-through' : 'none'}}
      opacity={todo.translucent ? 0.5 : 1}
    >
      {todo.done === true ? (
        <IconCheckbox style={{flex: '0 0 auto'}} />
      ) : todo.done === 'indeterminate' ? (
        <IconSquareMinus style={{flex: '0 0 auto'}} />
      ) : (
        <IconSquare style={{flex: '0 0 auto'}} />
      )}
      {truncateWithEllipsis(todo.txt, 1, 50)}
    </Flex>
  ))
}
