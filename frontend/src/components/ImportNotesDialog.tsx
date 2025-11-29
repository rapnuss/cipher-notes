import {Button, FileInput, Group, Modal, PasswordInput, Stack, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeImportDialog,
  importFileChanged,
  importNotes,
  importNotesWithPassword,
  setProtectedNotesPassword,
} from '../state/import'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

export const ImportNotesDialog = () => {
  const {
    open,
    file,
    error,
    hasProtectedNotes,
    protectedNotesPassword,
    protectedNotesLoading,
    protectedNotesError,
  } = useSelector((state) => state.import.importDialog)

  useCloseOnBack({
    id: 'import-notes-dialog',
    open,
    onClose: closeImportDialog,
  })

  return (
    <Modal opened={open} onClose={closeImportDialog} title='Import notes'>
      <Stack gap='md'>
        <FileInput
          value={file}
          onChange={importFileChanged}
          label='Select backup .zip'
          accept='.zip,application/zip,application/x-zip-compressed'
          error={error}
          disabled={hasProtectedNotes}
        />

        {hasProtectedNotes && (
          <>
            <Text size='sm' c='dimmed'>
              This backup contains protected notes. Enter the password that was used to protect them
              to import.
            </Text>
            <PasswordInput
              label='Protected Notes Password'
              placeholder='Enter password from backup'
              value={protectedNotesPassword}
              onChange={(e) => setProtectedNotesPassword(e.target.value)}
              error={protectedNotesError}
              onKeyDown={(e) => {
                if (e.key === 'Enter') importNotesWithPassword()
              }}
            />
          </>
        )}

        <Group justify='end'>
          {hasProtectedNotes ? (
            <Button
              onClick={importNotesWithPassword}
              loading={protectedNotesLoading}
              disabled={!protectedNotesPassword}
            >
              Import with Password
            </Button>
          ) : (
            <Button onClick={importNotes} disabled={!file}>
              Import
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
