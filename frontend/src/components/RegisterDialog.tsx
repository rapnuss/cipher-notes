import {Button, Checkbox, Modal, Stack, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeRegisterDialog,
  registerAgreeChanged,
  registerEmail,
  registerEmailChanged,
} from '../state/user'
import {useRef, useState} from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import {hCaptchaSiteCode} from '../config'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const RegisterDialog = () => {
  const {open, email, loading, agree} = useSelector((state) => state.user.registerDialog)
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
          AGB Deutsch
        </a>
        <a href='/datenschutz.html' target='_blank'>
          Datenschutzerklärung Deutsch
        </a>
        <a href='/terms.html' target='_blank'>
          Terms and Conditions English
        </a>
        <a href='/privacy.html' target='_blank'>
          Privacy Policy English
        </a>
        <Checkbox
          label={
            <>
              Ich stimme den AGB und der Datenschutzerklärung zu.
              <br />I accept the Terms and Conditions and the Privacy Policy.
            </>
          }
          checked={agree}
          onChange={(e) => registerAgreeChanged(e.target.checked)}
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
