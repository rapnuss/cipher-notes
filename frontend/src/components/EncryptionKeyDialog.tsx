import {Button, Flex, Group, Modal, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeEncryptionKeyDialog,
  keyTokenPairChanged,
  qrModeChanged,
  saveEncryptionKey,
  toggleEncryptionKeyDialogVisibility,
} from '../state/user'
import {isValidKeyTokenPair} from '../business/notesEncryption'
import {QRCodeSVG} from 'qrcode.react'
import {QRScanner} from './QRScanner'

export const EncryptionKeyDialog = () => {
  const {open, keyTokenPair, visible, qrMode} = useSelector(
    (state) => state.user.encryptionKeyDialog
  )
  const valid = isValidKeyTokenPair(keyTokenPair)
  return (
    <Modal title='Encryption key' opened={open} onClose={closeEncryptionKeyDialog}>
      <Flex gap='xs' align='end'>
        <TextInput
          flex={1}
          label='Encryption key'
          value={keyTokenPair}
          onChange={(e) => keyTokenPairChanged(e.target.value)}
          error={!valid ? 'Invalid key token pair' : undefined}
          type={visible ? 'text' : 'password'}
        />
        <Button onClick={toggleEncryptionKeyDialogVisibility}>{visible ? 'Hide' : 'Show'}</Button>
      </Flex>
      <Group mt='md'>
        <Button onClick={() => saveEncryptionKey(keyTokenPair)} disabled={!valid}>
          Save new key
        </Button>
        <Button onClick={() => navigator.clipboard.writeText(keyTokenPair)}>
          Copy to Clipboard
        </Button>
      </Group>
      <Group my='md'>
        <Button onClick={() => qrModeChanged(qrMode === 'show' ? 'hide' : 'show')}>
          {qrMode === 'show' ? 'Hide QR' : 'Show QR'}
        </Button>
        <Button onClick={() => qrModeChanged(qrMode === 'scan' ? 'hide' : 'scan')}>
          {qrMode === 'scan' ? 'Stop scan' : 'Scan QR'}
        </Button>
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
