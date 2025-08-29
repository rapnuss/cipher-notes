import {Button, Flex, Modal, Stack, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeLoginDialog,
  loginWithCode,
  loginCodeChanged,
  sendLoginCode,
  loginEmailChanged,
  switchLoginStatus,
} from '../state/user'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const LoginDialog = () => {
  const {open, email, code, loading, status} = useSelector((state) => state.user.loginDialog)
  useCloseOnBack({
    id: 'login-dialog',
    open,
    onClose: closeLoginDialog,
  })
  return (
    <Modal opened={open} onClose={closeLoginDialog} title='Login'>
      {status === 'email' && (
        <Stack gap='md'>
          <TextInput
            label='Email'
            type='email'
            value={email}
            onChange={(e) => loginEmailChanged(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && email) sendLoginCode()
            }}
          />
          <Button loading={loading} onClick={sendLoginCode} disabled={loading || !email}>
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
          <TextInput
            label='Code'
            value={code}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && code.length === 6) loginWithCode()
            }}
            onChange={(e) => loginCodeChanged(e.target.value)}
          />
          <Button loading={loading} onClick={loginWithCode} disabled={loading || code.length !== 6}>
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
