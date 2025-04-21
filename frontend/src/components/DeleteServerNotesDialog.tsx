import {Button, Group, Modal, Stack, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeDeleteServerNotesDialog,
  deleteServerNotesAndGenerateNewKey,
  deleteServerNotesCodeChanged,
  openDeleteServerNotesDialog,
} from '../state/user'

export const DeleteServerNotesDialog = () => {
  const {open, code, codeLoading, deleteLoading} = useSelector(
    (state) => state.user.deleteServerNotesDialog
  )
  return (
    <Modal opened={open} onClose={closeDeleteServerNotesDialog} title='Delete Server Notes'>
      <Stack>
        <TextInput
          label='Confirmation Code'
          value={code}
          onChange={(e) => deleteServerNotesCodeChanged(e.target.value)}
          placeholder='Enter the 6-digit code sent to your email'
          disabled={codeLoading || deleteLoading}
        />
        <Group>
          <Button
            loading={deleteLoading}
            onClick={deleteServerNotesAndGenerateNewKey}
            disabled={code.length !== 6}
          >
            Delete Server Notes and generate new crypto key
          </Button>
          <Button variant='light' disabled={codeLoading} onClick={openDeleteServerNotesDialog}>
            Resend Code
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
