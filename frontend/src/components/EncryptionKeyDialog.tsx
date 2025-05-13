import {Button, Flex, Group, Modal, PasswordInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeEncryptionKeyDialog,
  generateKeyTokenPairString,
  keyTokenPairChanged,
  qrModeChanged,
  saveEncryptionKey,
} from '../state/user'
import {isValidKeyTokenPair} from '../business/notesEncryption'
import {QRCodeSVG} from 'qrcode.react'
import {QRScanner} from './QRScanner'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {ActionIconWithText} from './ActionIconWithText'
import {IconCopy} from './icons/IconCopy'

export const EncryptionKeyDialog = () => {
  const storedKeyTokenPair = useSelector((state) => state.user.user.keyTokenPair)
  const {open, keyTokenPair, qrMode} = useSelector((state) => state.user.encryptionKeyDialog)
  const valid = isValidKeyTokenPair(keyTokenPair)
  useCloseOnBack({
    id: 'encryption-key-dialog',
    open,
    onClose: closeEncryptionKeyDialog,
  })
  return (
    <Modal title='Encryption key' opened={open} onClose={closeEncryptionKeyDialog}>
      <Flex align='start'>
        <PasswordInput
          size='md'
          flex={1}
          value={keyTokenPair}
          onChange={(e) => keyTokenPairChanged(e.target.value)}
          error={!valid ? 'Invalid key token pair' : undefined}
          readOnly={storedKeyTokenPair !== null}
        />
        <ActionIconWithText
          title='Copy to Clipboard'
          text='clipb.'
          onClick={() => navigator.clipboard.writeText(keyTokenPair)}
        >
          <IconCopy />
        </ActionIconWithText>
      </Flex>
      <Group my='md'>
        {storedKeyTokenPair === null && (
          <Button onClick={generateKeyTokenPairString}>Generate new key</Button>
        )}
        {storedKeyTokenPair !== null && (
          <Button onClick={() => qrModeChanged(qrMode === 'show' ? 'hide' : 'show')}>
            {qrMode === 'show' ? 'Hide QR' : 'Show QR'}
          </Button>
        )}
        {storedKeyTokenPair === null && (
          <Button onClick={() => qrModeChanged(qrMode === 'scan' ? 'hide' : 'scan')}>
            {qrMode === 'scan' ? 'Stop scan' : 'Scan QR'}
          </Button>
        )}
        {storedKeyTokenPair === null && (
          <Button onClick={() => saveEncryptionKey(keyTokenPair)} disabled={!valid}>
            Save new key
          </Button>
        )}
      </Group>
      {qrMode === 'show' && (
        <QRCodeSVG
          style={{width: '100%', height: 'auto', padding: '1rem', background: 'white'}}
          value={keyTokenPair}
        />
      )}
      {qrMode === 'scan' && (
        <QRScanner
          style={{width: '100%', height: 'auto'}}
          onScan={(text) => {
            if (isValidKeyTokenPair(text)) {
              saveEncryptionKey(text)
              closeEncryptionKeyDialog()
            }
          }}
        />
      )}
    </Modal>
  )
}
