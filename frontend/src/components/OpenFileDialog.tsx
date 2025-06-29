import {Drawer} from '@mantine/core'
import {useSelector} from '../state/store'
import {fileClosed} from '../state/files'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'

export const OpenFileDialog = () => {
  const openFile = useSelector((state) => state.files.openFile)
  const open = openFile !== null
  const file = useLiveQuery(
    () => (openFile ? db.files_meta.get(openFile.id) : undefined),
    [openFile?.id]
  )
  // TODO: close on file delete or missing
  if (!file) return null
  return (
    <Drawer opened={open} onClose={fileClosed}>
      {file.mime.startsWith('image/') && <img src={`/files/${file.id}`} alt={file.title} />}
    </Drawer>
  )
}
