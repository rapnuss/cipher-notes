import {Checkbox} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeSettingsDialog, toggleNewNoteOnLaunch} from '../state/settings'
import {Modal} from '@mantine/core'
import {useCloseOnBack} from '../business/useCloseOnBack'
export const SettingsDialog = () => {
  const {open, settings} = useSelector((state) => state.settings)
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
      <Checkbox
        label='Open new note on launch'
        checked={settings.newNoteOnLaunch}
        onChange={toggleNewNoteOnLaunch}
      />
    </Modal>
  )
}
