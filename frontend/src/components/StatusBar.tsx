import {Flex, Loader, Text, Tooltip} from '@mantine/core'
import {useSelector} from '../state/store'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'

export const StatusBar = () => {
  const {email, loggedIn} = useSelector((state) => state.user.user)
  const connected = useSelector((state) => state.user.connected)
  const syncing = useSelector((state) => state.notes.sync.syncing)
  const upDownloading = useSelector((state) => state.files.upDownloading)
  const registered = !!email
  const numDirtyNotes = useLiveQuery(() => db.notes.where('state').equals('dirty').count())
  if (!registered) return null
  return (
    <Flex p='xs' justify='space-between' align='center' bg='rgba(0,0,0,.1)'>
      <Text size='xs'>
        {email} {connected ? 'connected' : loggedIn ? 'offline' : 'logged out'}
      </Text>
      {!!numDirtyNotes && !syncing && !upDownloading && (
        <Text size='xs'>{numDirtyNotes} unsynced notes</Text>
      )}
      {(syncing || upDownloading) && (
        <Tooltip
          label={
            syncing && upDownloading
              ? 'Syncing notes and files'
              : syncing
              ? 'Syncing notes'
              : 'Syncing files'
          }
        >
          <Loader color={syncing ? undefined : 'cyan'} style={{margin: '-10px 0'}} type='dots' />
        </Tooltip>
      )}
    </Flex>
  )
}
