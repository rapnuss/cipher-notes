import {Modal} from '@mantine/core'
import {closeMessage, selectLastMessage} from '../state/messages'
import {useSelector} from '../state/store'

export const MessageBox = () => {
  const lastMessage = useSelector(selectLastMessage)
  return (
    <Modal
      opened={!!lastMessage}
      onClose={closeMessage}
      title={lastMessage?.title}
      closeButtonProps={{title: 'Close message'}}
    >
      {lastMessage?.text}
    </Modal>
  )
}
