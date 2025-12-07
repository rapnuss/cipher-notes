import {Button, FileInput, Group, Modal, PasswordInput, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeImportDialog, importFileChanged, importNotes, setImportOldPassword} from '../state/import'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const ImportNotesDialog = () => {
  const {open, file, error, needsOldPassword, oldPassword, loading} = useSelector(
    (state) => state.import.importDialog
  )
  const hasCurrentConfig = useSelector((state) => !!state.protectedNotes.config)
  const hasCurrentKey = useSelector((state) => !!state.protectedNotes.derivedKey)

  useCloseOnBack({
    id: 'import-notes-dialog',
    open,
    onClose: closeImportDialog,
  })

  const canImport =
    file && (!needsOldPassword || (oldPassword && (hasCurrentKey || !hasCurrentConfig)))

  return (
    <Modal opened={open} onClose={closeImportDialog} title='Import notes'>
      <FileInput
        value={file}
        onChange={importFileChanged}
        label='Select backup .zip'
        accept='.zip,application/zip,application/x-zip-compressed'
        error={!needsOldPassword ? error : undefined}
        disabled={loading}
      />
      {needsOldPassword && (
        <>
          <Text size='sm' mt='md' c='dimmed'>
            {hasCurrentConfig
              ? 'This backup contains protected notes encrypted with a different password. Enter the old password to re-encrypt them with your current password.'
              : 'This backup contains protected notes. Enter the password used when creating the backup.'}
          </Text>
          <PasswordInput
            mt='sm'
            label={hasCurrentConfig ? 'Old password' : 'Backup password'}
            value={oldPassword}
            onChange={(e) => setImportOldPassword(e.currentTarget.value)}
            error={error}
            disabled={loading}
          />
          {hasCurrentConfig && !hasCurrentKey && (
            <Text size='sm' mt='xs' c='red'>
              Please unlock your protected notes first before importing.
            </Text>
          )}
        </>
      )}
      <Group justify='end' mt='lg'>
        <Button onClick={importNotes} disabled={!canImport} loading={loading}>
          Import
        </Button>
      </Group>
    </Modal>
  )
}
