import {Button, Flex} from '@mantine/core'
import {Modal, Stack, TextInput} from '@mantine/core'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useSelector} from '../state/store'
import {
  changeEmail,
  changeEmailDialogEmailChanged,
  changeEmailDialogNewEmailCodeChanged,
  changeEmailDialogOldEmailCodeChanged,
  closeChangeEmailDialog,
  sendChangeEmailCodes,
  switchChangeEmailStatus,
} from '../state/user'

export const ChangeEmailDialog = () => {
  const oldEmail = useSelector((state) => state.user.user.email)
  const {open, email, loading, status, oldEmailCode, newEmailCode} = useSelector(
    (state) => state.user.changeEmailDialog
  )
  useCloseOnBack({
    id: 'change-email-dialog',
    open,
    onClose: closeChangeEmailDialog,
  })
  return (
    <Modal opened={open} onClose={closeChangeEmailDialog} title='Change Email'>
      {status === 'email' ? (
        <Stack gap='md'>
          <TextInput label='Old Email' value={oldEmail} disabled readOnly />
          <TextInput
            label='New Email'
            type='email'
            value={email}
            onChange={(e) => changeEmailDialogEmailChanged(e.target.value)}
          />
          <Button loading={loading} onClick={sendChangeEmailCodes}>
            Send Change Email Codes
          </Button>
          <Flex gap='md' align='center'>
            <p>Already have the codes?</p>
            <Button onClick={switchChangeEmailStatus} size='xs'>
              Enter code
            </Button>
          </Flex>
        </Stack>
      ) : (
        <Stack gap='md'>
          <TextInput
            label={`Code sent to ${oldEmail}`}
            value={oldEmailCode}
            onChange={(e) => changeEmailDialogOldEmailCodeChanged(e.target.value)}
          />
          <TextInput
            label={`Code sent to ${email}`}
            value={newEmailCode}
            onChange={(e) => changeEmailDialogNewEmailCodeChanged(e.target.value)}
          />
          <Button loading={loading} onClick={changeEmail}>
            Change Email
          </Button>
          <Flex gap='md' align='center'>
            <p>Need new codes?</p>
            <Button onClick={switchChangeEmailStatus} size='xs'>
              Request codes
            </Button>
          </Flex>
        </Stack>
      )}
    </Modal>
  )
}
