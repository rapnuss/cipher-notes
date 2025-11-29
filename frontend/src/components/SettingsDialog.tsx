import {Modal, Select, Stack} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeSettings, setDarkTheme, setLightTheme} from '../state/settings'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const SettingsDialog = () => {
  const {open, options} = useSelector((state) => state.settings)
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
      </Stack>
    </Modal>
  )
}
