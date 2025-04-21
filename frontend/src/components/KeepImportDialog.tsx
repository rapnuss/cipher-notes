import {Button, Checkbox, FileInput, Group, Modal, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeKeepImportDialog,
  keepImportArchivedChanged,
  keepImportFileChanged,
  keepImportNotes,
} from '../state/import'

export const KeepImportDialog = () => {
  const {open, file, error, importArchived} = useSelector((state) => state.import.keepImportDialog)
  return (
    <Modal opened={open} onClose={closeKeepImportDialog} title='Import notes from Keep'>
      <Text mb='sm'>
        Go to{' '}
        <a href='https://takeout.google.com' target='_blank' rel='noopener noreferrer'>
          takeout.google.com
        </a>{' '}
        and select only Keep to export and zip as format.
      </Text>
      <FileInput
        value={file}
        onChange={keepImportFileChanged}
        label='Select file'
        accept='.zip'
        error={error}
      />
      <Checkbox
        mt='sm'
        label='Import archived notes'
        checked={importArchived}
        onChange={(e) => keepImportArchivedChanged(e.target.checked)}
      />
      <Group justify='end' mt='lg'>
        <Button onClick={keepImportNotes} disabled={!file}>
          Import
        </Button>
      </Group>
    </Modal>
  )
}
