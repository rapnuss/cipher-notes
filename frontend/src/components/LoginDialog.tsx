import {Button, Flex, Modal, Stack, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeLoginDialog,
  loginCode,
  loginCodeChanged,
  sendLoginCode,
  loginEmailChanged,
  switchLoginStatus,
} from '../state/user'

export const LoginDialog = () => {
  const {open, email, code, loading, status} = useSelector((state) => state.user.loginDialog)
  return (
    <Modal opened={open} onClose={closeLoginDialog} title='Login'>
      {status === 'email' && (
        <Stack gap='md'>
          <TextInput
            label='Email'
            type='email'
            value={email}
            onChange={(e) => loginEmailChanged(e.target.value)}
          />
          <Button loading={loading} onClick={sendLoginCode}>
            Request login code
          </Button>
          <Flex gap='md' align='center'>
            <p>Already have a code?</p>
            <Button onClick={switchLoginStatus} size='xs'>
              Enter code
            </Button>
          </Flex>
        </Stack>
      )}
      {status === 'code' && (
        <Stack gap='md'>
          <TextInput
            label='Email'
            type='email'
            value={email}
            onChange={(e) => loginEmailChanged(e.target.value)}
          />
          <TextInput label='Code' value={code} onChange={(e) => loginCodeChanged(e.target.value)} />
          <Button loading={loading} onClick={loginCode}>
            Login
          </Button>
          <Flex gap='md' align='center'>
            <p>Need a new code?</p>
            <Button onClick={switchLoginStatus} size='xs'>
              Request code
            </Button>
          </Flex>
        </Stack>
      )}
    </Modal>
  )
}
