import {Button, Modal, PasswordInput, Stack, Text} from '@mantine/core'
import {useState} from 'react'
import {useSelector} from '../state/store'
import {
  closeSetupDialog,
  closeUnlockDialog,
  closeChangePasswordDialog,
  setupProtectedNotes,
  unlockProtectedNotes,
  changePassword,
} from '../state/protectedNotes'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const SetupProtectedNotesDialog = () => {
  const open = useSelector((state) => state.protectedNotes.setupDialogOpen)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useCloseOnBack({
    id: 'setup-protected-notes-dialog',
    open,
    onClose: closeSetupDialog,
  })

  const handleSetup = async () => {
    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    const success = await setupProtectedNotes(password)

    setLoading(false)

    if (!success) {
      setError('Failed to setup protected notes')
    } else {
      setPassword('')
      setConfirmPassword('')
    }
  }

  const handleClose = () => {
    setPassword('')
    setConfirmPassword('')
    setError('')
    closeSetupDialog()
  }

  return (
    <Modal opened={open} onClose={handleClose} title='Set up Protected Notes'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Create a password to protect sensitive notes. This password cannot be recovered - if you
          forget it, protected notes will be permanently inaccessible.
        </Text>
        <PasswordInput
          label='Password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          label='Confirm Password'
          placeholder='Confirm password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={handleSetup} loading={loading}>
          Set up Protected Notes
        </Button>
      </Stack>
    </Modal>
  )
}

export const UnlockProtectedNotesDialog = () => {
  const open = useSelector((state) => state.protectedNotes.unlockDialogOpen)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useCloseOnBack({
    id: 'unlock-protected-notes-dialog',
    open,
    onClose: closeUnlockDialog,
  })

  const handleUnlock = async () => {
    setLoading(true)
    setError('')

    const success = await unlockProtectedNotes(password)

    setLoading(false)

    if (!success) {
      setError('Incorrect password')
    } else {
      setPassword('')
    }
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    closeUnlockDialog()
  }

  return (
    <Modal opened={open} onClose={handleClose} title='Unlock Protected Notes'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Enter your password to view protected notes.
        </Text>
        <PasswordInput
          label='Password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUnlock()
          }}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={handleUnlock} loading={loading}>
          Unlock
        </Button>
      </Stack>
    </Modal>
  )
}

export const ChangePasswordDialog = () => {
  const open = useSelector((state) => state.protectedNotes.changePasswordDialogOpen)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useCloseOnBack({
    id: 'change-password-dialog',
    open,
    onClose: closeChangePasswordDialog,
  })

  const handleChangePassword = async () => {
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    const result = await changePassword(currentPassword, newPassword)

    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to change password')
    } else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    closeChangePasswordDialog()
  }

  return (
    <Modal opened={open} onClose={handleClose} title='Change Password'>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          All protected notes will be re-encrypted with the new password and synced.
        </Text>
        <PasswordInput
          label='Current Password'
          placeholder='Enter current password'
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <PasswordInput
          label='New Password'
          placeholder='Enter new password'
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordInput
          label='Confirm New Password'
          placeholder='Confirm new password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && (
          <Text size='sm' c='red'>
            {error}
          </Text>
        )}
        <Button onClick={handleChangePassword} loading={loading}>
          Change Password
        </Button>
      </Stack>
    </Modal>
  )
}
