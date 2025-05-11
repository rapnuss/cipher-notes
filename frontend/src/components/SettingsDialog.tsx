import {useSelector} from '../state/store'
import {closeSettingsDialog} from '../state/settings'
import {Modal} from '@mantine/core'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

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
    ></Modal>
  )
}
