import {Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {toggleImpressum} from '../state/user'
import {useCloseOnBack} from '../business/useCloseOnBack'

export const ImpressumDialog = () => {
  const open = useSelector((state) => state.user.impressumOpen)
  useCloseOnBack({
    id: 'impressum-dialog',
    open,
    onClose: toggleImpressum,
  })
  return (
    <Modal opened={open} onClose={toggleImpressum} title='Impressum'>
      <Text>
        Owner of this Web-App:
        <br />
        Name: Raphael Nußbaumer
        <br />
        Address: Sohlstraße 3, 6845 Hohenems, Austria
        <br />
        Email: <a href='mailto:raphaeln@outlook.com'>raphaeln@outlook.com</a>
      </Text>
    </Modal>
  )
}
