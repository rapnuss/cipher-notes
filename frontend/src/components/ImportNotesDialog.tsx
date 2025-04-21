import {Button, FileInput, Group, Modal} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeImportDialog, importFileChanged, importNotes} from '../state/import'

export const ImportNotesDialog = () => {
  const {open, file, error} = useSelector((state) => state.import.importDialog)
  return (
    <Modal opened={open} onClose={closeImportDialog} title='Import notes'>
      <FileInput
        value={file}
        onChange={importFileChanged}
        label='Select file'
        accept='application/json'
        error={error}
      />
      <Group justify='end' mt='lg'>
        <Button onClick={importNotes} disabled={!file}>
          Import
        </Button>
      </Group>
    </Modal>
  )
}
