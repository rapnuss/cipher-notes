import {Button, Flex, Modal, Stack, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {formatDateTime} from '../util/misc'
import {pickLocalNote, pickServerNote} from '../state/conflicts'
import {TodoControl} from './TodoControl'
import {monospaceStyle} from '../business/misc'

export const ConflictDialog = () => {
  const conflicts = useSelector((state) => state.conflicts.conflicts)
  const serverNote = conflicts[0]
  const localNote = useLiveQuery(() => db.notes.get(serverNote?.id ?? ''), [serverNote?.id])
  if (!serverNote || !localNote) return null
  return (
    <Modal
      withCloseButton={false}
      size='100%'
      opened={conflicts.length > 0}
      onClose={() => {}}
      title='Conflict Resolution'
    >
      <Flex gap='xs'>
        <Stack flex='1 1 0' gap='xs'>
          <Text size='xl'>Local Note</Text>
          <Text c='dimmed'>
            {localNote.deleted_at
              ? formatDateTime(localNote.deleted_at)
              : formatDateTime(localNote.updated_at)}
          </Text>
          {localNote.deleted_at ? (
            <Text style={{whiteSpace: 'pre-wrap'}} ff='monospace'>
              DELETED
            </Text>
          ) : localNote.type === 'todo' ? (
            <>
              <Text size='lg'>{localNote.title}</Text>
              <TodoControl todos={localNote.todos} />
            </>
          ) : (
            <>
              <Text size='lg'>{localNote.title}</Text>
              <Text
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...monospaceStyle,
                }}
              >
                {localNote.txt}
              </Text>
            </>
          )}
          <Button onClick={pickLocalNote}>Use Local</Button>
        </Stack>
        <Stack flex='1 1 0' gap='xs'>
          <Text size='xl'>Server Note</Text>
          <Text c='dimmed'>
            {serverNote.deleted_at
              ? formatDateTime(serverNote.deleted_at)
              : formatDateTime(serverNote.updated_at)}
          </Text>
          {serverNote.deleted_at ? (
            <Text style={{whiteSpace: 'pre-wrap'}} ff='monospace'>
              DELETED
            </Text>
          ) : serverNote.type === 'todo' ? (
            <>
              <Text size='lg'>{serverNote.title}</Text>
              <TodoControl todos={serverNote.todos} />
            </>
          ) : (
            <>
              <Text size='lg'>{serverNote.title}</Text>
              <Text
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...monospaceStyle,
                }}
              >
                {serverNote.txt}
              </Text>
            </>
          )}
          <Button onClick={pickServerNote}>Use Server</Button>
        </Stack>
      </Flex>
    </Modal>
  )
}
