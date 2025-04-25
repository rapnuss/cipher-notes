import {Button, Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeSyncDialog, syncNotes} from '../state/notes'
import {useCloseOnBack} from '../business/useCloseOnBack'

export const SyncDialog = () => {
  const {syncing, dialogOpen} = useSelector((state) => state.notes.sync)
  const noKey = useSelector((state) => state.user.user.keyTokenPair === null)
  useCloseOnBack({
    id: 'sync-dialog',
    open: dialogOpen,
    onClose: closeSyncDialog,
  })
  return (
    <Modal title='Synchronize notes with the server' opened={dialogOpen} onClose={closeSyncDialog}>
      <Text c='dimmed' pb='md'>
        {noKey
          ? 'You need to generate or import an Encryption-Key first!'
          : 'Your notes are encrypted and stored on the server.'}
      </Text>
      <Button disabled={noKey} loading={syncing} onClick={syncNotes}>
        Synchronize
      </Button>
    </Modal>
  )
}
