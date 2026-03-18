import {Flex, Loader, Text, Tooltip, UnstyledButton} from '@mantine/core'
import {useSelector} from '../state/store'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {openSyncDialogAndSync} from '../state/notes'
import {openLoginDialog} from '../state/user'

export const StatusBar = () => {
  const {email, loggedIn} = useSelector((state) => state.user.user)
  const connected = useSelector((state) => state.user.connected)
  const syncing = useSelector((state) => state.notes.sync.syncing)
  const upDownloading = useSelector((state) => state.files.upDownloading)
  const syncError = useSelector((state) => state.notes.sync.error)
  const registered = !!email
  const numDirtyNotes = useLiveQuery(() => db.notes.where('state').equals('dirty').count())
  if (!registered) return null
  const status =
    connected === true ? 'connected'
    : connected === null && loggedIn ? 'connecting...'
    : loggedIn ? 'offline'
    : 'logged out'
  return (
    <Flex
      px='xs'
      py='.25rem'
      justify='space-between'
      align='center'
      className='status-bar'
      h='1.5625rem'
    >
      {status === 'logged out' ?
        <UnstyledButton
          style={{fontSize: 'var(--mantine-font-size-xs)', textDecoration: 'underline'}}
          onClick={() => openLoginDialog()}
        >
          {status}
        </UnstyledButton>
      : <Text size='xs'>{status}</Text>}
      {syncing || upDownloading ?
        <Tooltip
          label={
            syncing && upDownloading ? 'Syncing notes and files'
            : syncing ?
              'Syncing notes'
            : 'Syncing files'
          }
        >
          <Loader color={syncing ? undefined : 'cyan'} style={{margin: '-10px 0'}} type='dots' />
        </Tooltip>
      : syncError ?
        <Tooltip label={syncError}>
          <UnstyledButton
            onClick={openSyncDialogAndSync}
            style={{fontSize: 'var(--mantine-font-size-xs)', textDecoration: 'underline'}}
          >
            sync failed
          </UnstyledButton>
        </Tooltip>
      : numDirtyNotes ?
        <Text size='xs'>{numDirtyNotes} unsynced notes</Text>
      : null}
    </Flex>
  )
}
