import {Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {toggleImprint} from '../state/user'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const ImprintDialog = () => {
  const open = useSelector((state) => state.user.imprintOpen)
  useCloseOnBack({
    id: 'imprint-dialog',
    open,
    onClose: toggleImprint,
  })
  return (
    <Modal opened={open} onClose={toggleImprint} title='Imprint'>
      <Text>
        Owner of this Web-App:
        <br />
        Name: Raphael Nußbaumer BSc
        <br />
        Address: Sohlstraße 3, 6845 Hohenems, Austria
        <br />
        Email: <a href='mailto:raphaeln@outlook.com'>raphaeln@outlook.com</a>
        <br />
        <br />
        Version: {ENV_GIT_COMMIT}
        <br />
        Source Code:{' '}
        <a href='https://github.com/rapnuss/cipher-notes' target='_blank' rel='noopener noreferrer'>
          https://github.com/rapnuss/cipher-notes
        </a>
      </Text>
    </Modal>
  )
}
