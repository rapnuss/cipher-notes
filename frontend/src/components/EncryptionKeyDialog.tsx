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
  const lastSyncedTo = useSelector((state) => state.user.user.lastSyncedTo)
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
          readOnly={lastSyncedTo !== 0}
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
        {lastSyncedTo === 0 && (
          <Button onClick={generateKeyTokenPairString}>Generate new key</Button>
        )}
        {valid && (
          <Button onClick={() => qrModeChanged(qrMode === 'show' ? 'hide' : 'show')}>
            {qrMode === 'show' ? 'Hide QR' : 'Show QR'}
          </Button>
        )}
        {lastSyncedTo === 0 && (
          <Button onClick={() => qrModeChanged(qrMode === 'scan' ? 'hide' : 'scan')}>
            {qrMode === 'scan' ? 'Stop scan' : 'Scan QR'}
          </Button>
        )}
        {lastSyncedTo === 0 && valid && (
          <Button onClick={() => saveEncryptionKey(keyTokenPair)} disabled={!valid}>
            Save new key
          </Button>
        )}
      </Group>
      {qrMode === 'show' && valid && (
        <QRCodeSVG
          style={{width: '100%', height: 'auto', padding: '1rem', background: 'white'}}
          value={keyTokenPair}
        />
      )}
      {qrMode === 'scan' && lastSyncedTo === 0 && (
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
