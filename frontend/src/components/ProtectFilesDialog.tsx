import {Button, Group, Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeProtectFilesDialog, confirmProtectFilesDialog} from '../state/files'

export const ProtectFilesDialog = () => {
  const {open, files} = useSelector((state) => state.files.protectFilesDialog)
  const fileCount = files.length
  return (
    <Modal
      opened={open}
      onClose={closeProtectFilesDialog}
      title='Protect files?'
      centered
      closeOnEscape
    >
      <Text mb='md'>
        Do you want to password-protect {fileCount === 1 ? 'this file' : `these ${fileCount} files`}
        ?
      </Text>
      <Group justify='flex-end'>
        <Button variant='default' onClick={() => confirmProtectFilesDialog(false)}>
          No
        </Button>
        <Button onClick={() => confirmProtectFilesDialog(true)}>Yes, protect</Button>
      </Group>
    </Modal>
  )
}
