import {Button, Divider, Group, Modal, Select, Stack, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeSettings, setDarkTheme, setLightTheme} from '../state/settings'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {
  lockProtectedNotes,
  openSetupDialog,
  openUnlockDialog,
  openChangePasswordDialog,
} from '../state/protectedNotes'

export const SettingsDialog = () => {
  const {open, options} = useSelector((state) => state.settings)
  const {hasConfig, unlocked} = useSelector((state) => state.protectedNotes)
  useCloseOnBack({
    id: 'settings-dialog',
    open,
    onClose: closeSettings,
  })
  return (
    <Modal opened={open} onClose={closeSettings} title='Settings'>
      <Stack gap='md'>
        <Select
          label='Light Theme'
          data={[
            {value: 'light', label: 'Light'},
            {value: 'white', label: 'White'},
          ]}
          value={options.lightTheme}
          onChange={(value) => value && setLightTheme(value as 'light' | 'white')}
        />
        <Select
          label='Dark Theme'
          data={[
            {value: 'dark', label: 'Dark'},
            {value: 'black', label: 'Black'},
          ]}
          value={options.darkTheme}
          onChange={(value) => value && setDarkTheme(value as 'dark' | 'black')}
        />

        <Divider label='Protected Notes' labelPosition='center' />

        {!hasConfig && (
          <>
            <Text size='sm' c='dimmed'>
              Set up a password to protect sensitive notes with additional encryption.
            </Text>
            <Button variant='outline' onClick={openSetupDialog}>
              Set up Protected Notes
            </Button>
          </>
        )}

        {hasConfig && !unlocked && (
          <>
            <Text size='sm' c='dimmed'>
              Protected notes are hidden. Enter your password to view them.
            </Text>
            <Button variant='outline' onClick={openUnlockDialog}>
              Unlock Protected Notes
            </Button>
          </>
        )}

        {hasConfig && unlocked && (
          <>
            <Text size='sm' c='dimmed'>
              Protected notes are currently visible.
            </Text>
            <Group>
              <Button variant='outline' onClick={lockProtectedNotes}>
                Lock
              </Button>
              <Button variant='outline' onClick={openChangePasswordDialog}>
                Change Password
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  )
}
