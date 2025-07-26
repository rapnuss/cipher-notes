import {Button, Flex, Group, Modal, PasswordInput, Text} from '@mantine/core'
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
  const {open, keyTokenPair, qrMode, mode} = useSelector((state) => state.user.encryptionKeyDialog)
  const hasStoredKeyTokenPair = useSelector((state) => !!state.user.user.keyTokenPair)
  const valid = isValidKeyTokenPair(keyTokenPair)
  useCloseOnBack({
    id: 'encryption-key-dialog',
    open,
    onClose: closeEncryptionKeyDialog,
  })
  return (
    <Modal title='Encryption key' opened={open} onClose={closeEncryptionKeyDialog}>
      {!hasStoredKeyTokenPair && (
        <Text mb='md'>Generate a new key or import from a different device to sync notes.</Text>
      )}
      <Flex align='start'>
        <PasswordInput
          size='md'
          flex={1}
          value={keyTokenPair}
          onChange={(e) => keyTokenPairChanged(e.target.value)}
          error={keyTokenPair && !valid ? 'Invalid key token pair' : undefined}
          readOnly={lastSyncedTo !== 0 && mode !== 'update'}
        />
        <ActionIconWithText
          title='Copy to Clipboard'
          text='copy'
          onClick={() => navigator.clipboard.writeText(keyTokenPair)}
        >
          <IconCopy />
        </ActionIconWithText>
      </Flex>
      <Group my='md'>
        {mode === 'export/generate' && lastSyncedTo === 0 && (
          <Button onClick={generateKeyTokenPairString}>Generate new key</Button>
        )}
        {valid && hasStoredKeyTokenPair && mode === 'export/generate' && (
          <Button onClick={() => qrModeChanged(qrMode === 'show' ? 'hide' : 'show')}>
            {qrMode === 'show' ? 'Hide QR' : 'Show QR'}
          </Button>
        )}
        {(lastSyncedTo === 0 || mode === 'update') && (
          <Button onClick={() => qrModeChanged(qrMode === 'scan' ? 'hide' : 'scan')}>
            {qrMode === 'scan' ? 'Stop scan' : 'Scan QR'}
          </Button>
        )}
        {(lastSyncedTo === 0 || mode === 'update') && valid && (
          <Button onClick={() => saveEncryptionKey(keyTokenPair)} disabled={!valid}>
            {mode === 'update' ? 'Update key' : 'Save new key'}
          </Button>
        )}
      </Group>
      {qrMode === 'show' && valid && (
        <QRCodeSVG
          style={{width: '100%', height: 'auto', padding: '1rem', background: 'white'}}
          value={keyTokenPair}
        />
      )}
      {qrMode === 'scan' && (
        <QRScanner
          style={{width: '100%', height: 'auto'}}
          onScan={(text) => {
            if (qrMode !== 'scan') return
            if (isValidKeyTokenPair(text)) {
              qrModeChanged('hide')
              saveEncryptionKey(text)
              closeEncryptionKeyDialog()
            }
          }}
        />
      )}
    </Modal>
  )
}
