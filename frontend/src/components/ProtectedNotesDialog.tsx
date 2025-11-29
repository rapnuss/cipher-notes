import {Button, Modal, PasswordInput, Stack, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeSetupDialog,
  closeUnlockDialog,
  closeChangePasswordDialog,
  setSetupDialogPassword,
  setSetupDialogConfirmPassword,
  setUnlockDialogPassword,
  setChangePasswordCurrentPassword,
  setChangePasswordNewPassword,
  setChangePasswordConfirmPassword,
  submitSetupDialog,
  submitUnlockDialog,
  submitChangePasswordDialog,
} from '../state/protectedNotes'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const SetupProtectedNotesDialog = () => {
  const {open, password, confirmPassword, loading, error} = useSelector(
    (state) => state.protectedNotes.setupDialog
  )

  useCloseOnBack({
    id: 'setup-protected-notes-dialog',
    open,
    onClose: closeSetupDialog,
  })

  return (
    <Modal opened={open} onClose={closeSetupDialog} title='Set up Protected Notes'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Create a password to protect sensitive notes. This password cannot be recovered - if you
          forget it, protected notes will be permanently inaccessible.
        </Text>
        <PasswordInput
          label='Password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setSetupDialogPassword(e.target.value)}
        />
        <PasswordInput
          label='Confirm Password'
          placeholder='Confirm password'
          value={confirmPassword}
          onChange={(e) => setSetupDialogConfirmPassword(e.target.value)}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={submitSetupDialog} loading={loading}>
          Set up Protected Notes
        </Button>
      </Stack>
    </Modal>
  )
}

export const UnlockProtectedNotesDialog = () => {
  const {open, password, loading, error} = useSelector((state) => state.protectedNotes.unlockDialog)

  useCloseOnBack({
    id: 'unlock-protected-notes-dialog',
    open,
    onClose: closeUnlockDialog,
  })

  return (
    <Modal opened={open} onClose={closeUnlockDialog} title='Unlock Protected Notes'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Enter your password to view protected notes.
        </Text>
        <PasswordInput
          label='Password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setUnlockDialogPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitUnlockDialog()
          }}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={submitUnlockDialog} loading={loading}>
          Unlock
        </Button>
      </Stack>
    </Modal>
  )
}

export const ChangePasswordDialog = () => {
  const {open, currentPassword, newPassword, confirmPassword, loading, error} = useSelector(
    (state) => state.protectedNotes.changePasswordDialog
  )

  useCloseOnBack({
    id: 'change-password-dialog',
    open,
    onClose: closeChangePasswordDialog,
  })

  return (
    <Modal opened={open} onClose={closeChangePasswordDialog} title='Change Password'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          All protected notes will be re-encrypted with the new password and synced.
        </Text>
        <PasswordInput
          label='Current Password'
          placeholder='Enter current password'
          value={currentPassword}
          onChange={(e) => setChangePasswordCurrentPassword(e.target.value)}
        />
        <PasswordInput
          label='New Password'
          placeholder='Enter new password'
          value={newPassword}
          onChange={(e) => setChangePasswordNewPassword(e.target.value)}
        />
        <PasswordInput
          label='Confirm New Password'
          placeholder='Confirm new password'
          value={confirmPassword}
          onChange={(e) => setChangePasswordConfirmPassword(e.target.value)}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={submitChangePasswordDialog} loading={loading}>
          Change Password
        </Button>
      </Stack>
    </Modal>
  )
}
