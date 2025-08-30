import {useSelector} from '../state/store'
import {closeSettingsDialog} from '../state/settings'
import {Button, Group, Modal, Stack, TextInput, Title} from '@mantine/core'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {hostingMode} from '../config'
import {useState} from 'react'
import {reqAdminCreateUser, reqAdminSetPassword} from '../services/backend'
import {notifications} from '@mantine/notifications'

export const SettingsDialog = () => {
  const {open} = useSelector((state) => state.settings)
  useCloseOnBack({
    id: 'settings-dialog',
    open,
    onClose: closeSettingsDialog,
  })
  return (
    <Modal
      title='Settings'
      opened={open}
      onClose={closeSettingsDialog}
      closeButtonProps={{title: 'Close settings'}}
    >
      {hostingMode === 'self' && (
        <Stack>
          <Title order={4}>Admin</Title>
          <Group grow>
            <CreateUserForm />
            <SetPasswordForm />
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

const CreateUserForm = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <Stack>
      <TextInput
        label='New username'
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextInput
        label='Initial password'
        type='password'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        loading={loading}
        disabled={!username || !password}
        onClick={async () => {
          setLoading(true)
          const res = await reqAdminCreateUser(username, password)
          setLoading(false)
          if (!res.success)
            notifications.show({title: 'Create user failed', message: res.error, color: 'red'})
          else notifications.show({title: 'User created', message: username})
        }}
      >
        Create user
      </Button>
    </Stack>
  )
}

const SetPasswordForm = () => {
  const [target, setTarget] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <Stack>
      <TextInput
        label='Target username/email'
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <TextInput
        label='New password'
        type='password'
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <TextInput
        label='Your admin password'
        type='password'
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
      />
      <Button
        loading={loading}
        disabled={!target || !newPassword || !adminPassword}
        onClick={async () => {
          setLoading(true)
          const res = await reqAdminSetPassword(target, newPassword, adminPassword)
          setLoading(false)
          if (!res.success)
            notifications.show({title: 'Set password failed', message: res.error, color: 'red'})
          else notifications.show({title: 'Password set', message: target})
        }}
      >
        Set password
      </Button>
    </Stack>
  )
}
