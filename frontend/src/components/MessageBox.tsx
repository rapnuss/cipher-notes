import {Modal} from '@mantine/core'
import {closeMessage, selectLastMessage} from '../state/messages'
import {useSelector} from '../state/store'
import {useCloseOnBack} from '../business/useCloseOnBack'

export const MessageBox = () => {
  const lastMessage = useSelector(selectLastMessage)
  useCloseOnBack({
    id: 'message-box',
    open: !!lastMessage,
    onClose: closeMessage,
  })
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
