import {Button, Checkbox, Modal, Stack, Text, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeRegisterDialog, registerEmail, registerEmailChanged} from '../state/user'
import {useRef, useState} from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import {hCaptchaSiteCode} from '../config'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const RegisterDialog = () => {
  const {open, email, loading} = useSelector((state) => state.user.registerDialog)
  const [agree, setAgree] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const hcaptchaRef = useRef<HCaptcha>(null)
  useCloseOnBack({
    id: 'register-dialog',
    open,
    onClose: closeRegisterDialog,
  })
  return (
    <Modal
      opened={open}
      onClose={() => {
        closeRegisterDialog()
        if (captchaToken) {
          hcaptchaRef.current?.resetCaptcha()
          setCaptchaToken(null)
        }
      }}
      title='Register Email'
    >
      <Stack gap='md'>
        <TextInput
          label='Email'
          type='email'
          value={email}
          onChange={(e) => registerEmailChanged(e.target.value)}
        />
        <a href='/agb.html' target='_blank'>
          AGB
        </a>
        <a href='/datenschutz.html' target='_blank'>
          Datenschutzerklärung
        </a>
        <Checkbox
          label='Ich stimme den AGB und der Datenschutzerklärung zu'
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <HCaptcha ref={hcaptchaRef} sitekey={hCaptchaSiteCode} onVerify={setCaptchaToken} />
        <Button
          loading={loading}
          disabled={!email || !agree || !captchaToken}
          onClick={async () => {
            if (!captchaToken) return
            await registerEmail(captchaToken)
            if (captchaToken) {
              hcaptchaRef.current?.resetCaptcha()
              setCaptchaToken(null)
            }
          }}
        >
          Register
        </Button>
      </Stack>
    </Modal>
  )
}
