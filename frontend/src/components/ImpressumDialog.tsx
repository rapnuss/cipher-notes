import {Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {toggleImpressum} from '../state/user'

export const ImpressumDialog = () => {
  const open = useSelector((state) => state.user.impressumOpen)
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
        <br />
        <br />
        Source-code:{' '}
        <a target='_blank' href='https://github.com/mrNuTz/cipher-notes'>
          https://github.com/mrNuTz/cipher-notes
        </a>
      </Text>
    </Modal>
  )
}
