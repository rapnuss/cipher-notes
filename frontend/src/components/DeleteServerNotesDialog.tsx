import {Button, Group, Modal, Stack, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeDeleteAccountDialog,
  closeDeleteServerNotesDialog,
  deleteAccount,
  deleteAccountCodeChanged,
  deleteServerNotesAndGenerateNewKey,
  deleteServerNotesCodeChanged,
  openDeleteAccountDialog,
  openDeleteServerNotesDialog,
} from '../state/user'
import {hostingMode} from '../config'

export const DeleteServerNotesDialog = () => {
  const {open, code, codeLoading, deleteLoading} = useSelector(
    (state) => state.user.deleteServerNotesDialog
  )
  return (
    <Modal opened={open} onClose={closeDeleteServerNotesDialog} title='Delete Server Notes'>
      <Stack>
        {hostingMode === 'self' ? (
          <TextInput
            label='Password'
            type='password'
            value={code}
            onChange={(e) => deleteServerNotesCodeChanged(e.target.value)}
            placeholder='Enter your password'
            disabled={deleteLoading}
          />
        ) : (
          <TextInput
            label='Confirmation Code'
            value={code}
            onChange={(e) => deleteServerNotesCodeChanged(e.target.value)}
            placeholder='Enter the 6-digit code sent to your email'
            disabled={codeLoading || deleteLoading}
          />
        )}
        <Group>
          <Button
            loading={deleteLoading}
            onClick={deleteServerNotesAndGenerateNewKey}
            disabled={hostingMode === 'self' ? code.length === 0 : code.length !== 6}
          >
            Delete Server Notes and generate new crypto key
          </Button>
          {hostingMode === 'central' && (
            <Button variant='light' loading={codeLoading} onClick={openDeleteServerNotesDialog}>
              Resend Code
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}

export const DeleteAccountDialog = () => {
  const {open, code, codeLoading, deleteLoading} = useSelector(
    (state) => state.user.deleteAccountDialog
  )
  return (
    <Modal opened={open} onClose={closeDeleteAccountDialog} title='Delete Account'>
      <Stack>
        {hostingMode === 'self' ? (
          <TextInput
            label='Password'
            type='password'
            value={code}
            onChange={(e) => deleteAccountCodeChanged(e.target.value)}
            placeholder='Enter your password'
            disabled={deleteLoading}
          />
        ) : (
          <TextInput
            label='Confirmation Code'
            value={code}
            onChange={(e) => deleteAccountCodeChanged(e.target.value)}
            placeholder='Enter the 6-digit code sent to your email'
            disabled={codeLoading || deleteLoading}
          />
        )}
        <Group>
          <Button
            loading={deleteLoading}
            onClick={deleteAccount}
            disabled={hostingMode === 'self' ? code.length === 0 : code.length !== 6}
          >
            Delete Account
          </Button>
          {hostingMode === 'central' && (
            <Button variant='light' loading={codeLoading} onClick={openDeleteAccountDialog}>
              Resend Code
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
