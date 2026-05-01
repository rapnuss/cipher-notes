import {Divider, Flex, Menu, Paper, UnstyledButton} from '@mantine/core'
import {getState, useSelector} from '../state/store'
import {deleteNote, noteOpened, setNoteArchived} from '../state/notes'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {bisectBy, byProp, deepEquals, sliceUtf, truncateWithEllipsis} from '../util/misc'
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

type NoteWithMatches = (Note | FileMeta) & {
  hasMatches?: boolean
  titleMatches?: RegExpExecArray[]
  txtMatches?: RegExpExecArray[]
  todoMatches?: RegExpExecArray[][]
  fullTitle?: string
}

export const NotesGrid = () => {
  // TODO: limit title length in preview
  // TODO: limit height of preview notes
  // TODO: render todo matches
  const query = useSelector((state) => state.notes.query)
  const sort = useSelector((state) => state.notes.sort)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  let regExp: RegExp
  if (query[0] === '/' && query[query.length - 1] === '/' && query.length > 2) {
    try {
      regExp = new RegExp(query.slice(1, -1), 'igm')
    } catch {
      regExp = new RegExp(RegExp.escape(query), 'igm')
    }
  } else {
    regExp = new RegExp(RegExp.escape(query), 'igm')
  }
  const notes = useLiveQuery(async () => {
    const allNotes = await db.notes.where('deleted_at').equals(0).toArray()
    const allFiles = await db.files_meta.where('deleted_at').equals(0).toArray()
    const notes = [...allNotes, ...allFiles]
      .flatMap((n: NoteWithMatches) => {
        n = {...n, hasMatches: !!query, fullTitle: n.type === 'file' ? getFilename(n) : n.title}
        if (
          !(activeLabel === 'archived' ? n.archived === 1
          : activeLabel === 'all' ? n.archived === 0
          : true &&
            (activeLabel !== 'unlabeled' || !n.labels || n.labels.length === 0) &&
            (!activeLabelIsUuid(activeLabel) || n.labels?.includes(activeLabel)))
        )
          return []
        if (query) {
          n.titleMatches = Array.from(n.fullTitle!.matchAll(regExp).filter((m) => m[0].length))
          if (n.type === 'note') {
            n.txtMatches = Array.from(n.txt.matchAll(regExp).filter((m) => m[0].length))
          }
          if (n.type === 'todo') {
            n.todoMatches = n.todos.map((todo) =>
              Array.from(todo.txt.matchAll(regExp).filter((m) => m[0].length)),
            )
          }
        }
        return (
            !query ||
              n.titleMatches?.length ||
              n.txtMatches?.length ||
              n.todoMatches?.some((matches) => matches.length)
          ) ?
            [n]
          : []
      })
      .sort(byProp(sort.prop, sort.desc))
    return bisectBy(notes ?? [], (n) => n.archived === 1)
  }, [query, sort, activeLabel])
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
        children={`
          button:focus {
            outline: 1px solid var(--mantine-primary-color-5);
          }
          .text-highlight {
            display: inline;
            padding: 0.1em 0.2em;
            border-radius: 0.15em;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            background-color: var(--mantine-color-text);
            color: var(--mantine-color-body);
          }
        `}
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

const NotePreview = ({note}: {note: NoteWithMatches}) => {
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
      }}
      shadow='lg'
      bg={labelBgColor(label?.hue ?? null, theme)}
      bd={borderColor ? `2px solid ${borderColor}` : undefined}
      className='note-preview'
    >
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
          selectionActive ? toggleSelection(note.id, note.type === 'file' ? 'file' : 'note')
          : note.type === 'file' ? fileOpened(note.id)
          : noteOpened(note.id)
        }
      >
        <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>
          {note.hasMatches && note.titleMatches && note.fullTitle ?
            <TitleMatches titleMatches={note.titleMatches} fullTitle={note.fullTitle} />
          : note.type === 'file' ?
            getFilename(note)
          : note.title}
        </div>
        {note.type === 'note' && !note.hasMatches ?
          truncateWithEllipsis(note.txt)
        : note.type === 'note' && note.hasMatches ?
          <NoteMatches note={note} />
        : note.type === 'todo' && note.hasMatches && note.todoMatches ?
          <TodoMatches todos={note.todos} todoMatches={note.todoMatches} />
        : note.type === 'todo' ?
          <TodosPreview todos={note.todos} />
        : note.type === 'file' && note.has_thumb ?
          <img
            alt={getFilename(note)}
            src={`/thumbnails/${note.id}`}
            style={{maxHeight: 200, objectFit: 'contain'}}
          />
        : note.type === 'file' ?
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
        : null}
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
                note.type === 'file' ?
                  setFileArchived(note.id, !note.archived)
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

function* splitTextByMatches(matches: RegExpExecArray[], fullText: string) {
  if (matches.length === 0) {
    yield (
      <span key={0} className='text-muted'>
        {fullText}
      </span>
    )
    return
  }
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!
    const prevMatch = i === 0 ? null : matches[i - 1]!
    const prevEnd = prevMatch ? prevMatch.index + prevMatch[0].length : 0
    const start = match.index
    const end = start + match[0].length
    if (prevEnd < start)
      yield (
        <span key={prevEnd} className='text-muted'>
          {fullText.slice(prevEnd, start)}
        </span>
      )
    yield (
      <span key={start} className='text-highlight'>
        {fullText.slice(start, end)}
      </span>
    )
  }
  const lastMatch = matches[matches.length - 1]!
  const lastEnd = lastMatch.index + lastMatch[0].length
  if (lastEnd < fullText.length)
    yield (
      <span key={lastEnd} className='text-muted'>
        {fullText.slice(lastEnd)}
      </span>
    )
}

const TitleMatches = ({
  titleMatches,
  fullTitle,
}: {
  titleMatches: RegExpExecArray[]
  fullTitle: string
}) => {
  return <>{Array.from(splitTextByMatches(titleMatches, fullTitle))}</>
}

const NoteMatches = ({note}: {note: NoteWithMatches}) => {
  const matches = note.txtMatches
  if (note.type !== 'note' || !matches || matches.length === 0) {
    return null
  }

  const limit = 200
  const contextSize = 10
  const spans: [boolean, string][] = []
  const txt = note.txt
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!
    const prevMatch = i === 0 ? null : matches[i - 1]!
    const prevEnd = prevMatch ? prevMatch.index + prevMatch[0].length : 0
    const start = match.index
    if (prevEnd < start) {
      spans.push([false, txt.slice(prevEnd, start)])
    }
    spans.push([true, match[0]])
  }
  const lastMatch = matches[matches.length - 1]!
  const lastEnd = lastMatch.index + lastMatch[0].length
  if (lastEnd < txt.length) {
    spans.push([false, txt.slice(lastEnd)])
  }

  let out: [boolean, string][] = []
  if (txt.length <= limit) {
    out = spans
  } else {
    let pos = 0
    for (let i = 0; i < spans.length; i++) {
      const [isMatch, txt] = spans[i]!
      if (isMatch) {
        if (pos + txt.length > limit) {
          let truncated = sliceUtf(txt, 0, limit - pos - 1) + '…'
          out.push([true, truncated])
          break
        }
        out.push([true, txt])
        pos += txt.length
      } else if (!isMatch && i !== 0 && i !== spans.length - 1) {
        if (pos + Math.max(txt.length, contextSize + 1) > limit) {
          let truncated = sliceUtf(txt, 0, limit - pos - 1) + '…'
          out.push([false, truncated])
          break
        }
        let truncated = txt
        if (txt.length > contextSize * 2 + 1) {
          truncated = sliceUtf(txt, 0, contextSize) + '…' + sliceUtf(txt, txt.length - contextSize)
        }
        out.push([false, truncated])
        pos += truncated.length
      } else if (!isMatch && i === 0) {
        let truncated = txt
        if (txt.length > contextSize + 1) {
          truncated = '…' + sliceUtf(txt, txt.length - contextSize)
        }
        out.push([false, truncated])
        pos += truncated.length
      } else if (!isMatch && i === spans.length - 1) {
        if (pos + txt.length <= limit) {
          out.push([false, txt])
          break
        }
        let len = limit - pos - 1
        let truncated = sliceUtf(txt, 0, len) + '…'
        out.push([false, truncated])
      }
    }
  }

  return (
    <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
      {out.map(([isMatch, txt], i) => (
        <span key={i} className={isMatch ? 'text-highlight' : 'text-muted'}>
          {txt}
        </span>
      ))}
    </div>
  )
}

const TodoMatches = ({todoMatches}: {todos: Todo[]; todoMatches: RegExpExecArray[][]}) => {
  if (todoMatches.length === 0) {
    return null
  }
  return <>TODO</>
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
      {todo.done === true ?
        <IconCheckbox style={{flex: '0 0 auto'}} />
      : todo.done === 'indeterminate' ?
        <IconSquareMinus style={{flex: '0 0 auto'}} />
      : <IconSquare style={{flex: '0 0 auto'}} />}
      {truncateWithEllipsis(todo.txt, 1, 50)}
    </Flex>
  ))
}
