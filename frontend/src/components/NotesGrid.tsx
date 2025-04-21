import {Flex, Paper, useComputedColorScheme} from '@mantine/core'
import {useSelector} from '../state/store'
import {noteOpened} from '../state/notes'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {byProp, compare, truncateWithEllipsis} from '../util/misc'
import {IconSquare} from './icons/IconSquare'
import {IconCheckbox} from './icons/IconCheckbox'
import {Note} from '../business/models'
import {labelColor} from '../business/misc'

export const NotesGrid = () => {
  const query = useSelector((state) => state.notes.query)
  const sort = useSelector((state) => state.notes.sort)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const notes = useLiveQuery(async () => {
    const queryLower = query.toLocaleLowerCase()
    const allNotes = await db.notes.where('deleted_at').equals(0).toArray()
    return allNotes
      .filter(
        (n) =>
          (activeLabel !== false || !n.labels || n.labels.length === 0) &&
          (typeof activeLabel !== 'string' || n.labels?.includes(activeLabel)) &&
          (!query ||
            n.title.toLocaleLowerCase().includes(queryLower) ||
            (n.type === 'note'
              ? n.txt.toLocaleLowerCase().includes(queryLower)
              : n.todos.some((todo) => todo.txt.toLocaleLowerCase().includes(queryLower))))
      )
      .sort(byProp(sort.prop, sort.desc))
  }, [query, sort, activeLabel])
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
        padding: '1rem',
        overflowY: 'auto',
        alignContent: 'start',
        height: '100%',
      }}
    >
      <style
        children={`button:focus {
          outline: 1px solid var(--mantine-primary-color-5);
        }`}
        scoped
      />
      {notes?.map((note) => (
        <NotePreview key={note.id} note={note} />
      ))}
    </div>
  )
}

const NotePreview = ({note}: {note: Note}) => {
  const colorScheme = useComputedColorScheme()
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const label = note.labels?.[0] ? labelsCache[note.labels[0]] : null
  return (
    <Paper
      component='button'
      title={`Open note ${note.title}`}
      style={{
        padding: '1rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        color: 'var(--mantine-color-text)',
        display: 'flex',
        flexDirection: 'column',
      }}
      shadow='sm'
      onClick={() => noteOpened(note.id)}
      role='button'
      bg={labelColor(label?.hue ?? null, colorScheme === 'dark')}
    >
      <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{note.title}</div>
      {note.type === 'note'
        ? truncateWithEllipsis(note.txt)
        : note.todos
            .map((t, i) => [t.done, i, t] as const)
            .sort(compare)
            .slice(0, 5)
            .map(([, i, todo]) => (
              <Flex
                align='center'
                gap='xs'
                style={{textDecoration: todo.done ? 'line-through' : 'none'}}
                key={i}
              >
                {todo.done ? (
                  <IconCheckbox style={{flex: '0 0 auto'}} />
                ) : (
                  <IconSquare style={{flex: '0 0 auto'}} />
                )}
                {truncateWithEllipsis(todo.txt, 1, 50)}
              </Flex>
            ))}
    </Paper>
  )
}
