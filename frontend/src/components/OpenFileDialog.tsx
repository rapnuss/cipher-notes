import {Drawer} from '@mantine/core'
import {useSelector} from '../state/store'
import {fileClosed} from '../state/files'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {ImageViewer} from './ImageViewer'
import {Hue} from '../business/models'
import {useMyColorScheme} from '../helpers/useMyColorScheme'
import {labelColor} from '../business/misc'
import {TextViewer} from './TextViewer'

export const OpenFileDialog = () => {
  const colorScheme = useMyColorScheme()
  const openFile = useSelector((state) => state.files.openFile)
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const open = openFile !== null
  const file = useLiveQuery(
    () => (openFile ? db.files_meta.get(openFile.id) : undefined),
    [openFile?.id]
  )
  // TODO: close on file delete or missing
  if (!file) return null
  const openNoteLabel = file.labels?.[0]
  const hue: Hue = openNoteLabel ? labelsCache[openNoteLabel]?.hue ?? null : null
  const src = `/files/${file.id}`
  return (
    <Drawer
      opened={open}
      onClose={fileClosed}
      withCloseButton={false}
      position='top'
      size='100%'
      styles={{
        content: {
          height: 'var(--viewport-height, 100dvh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: labelColor(hue, colorScheme === 'dark'),
          overflow: 'hidden',
        },
        body: {
          flex: '0 0 100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        },
      }}
    >
      {file.mime.startsWith('image/') && <ImageViewer src={src} alt={file.title} />}
      {file.mime === 'application/pdf' && (
        <iframe
          style={{flex: '1 1 0', border: 'none'}}
          key={file.id}
          src={src}
          title={file.title}
        />
      )}
      {file.mime.startsWith('video/') && (
        <video style={{flex: '1 1 0', border: 'none'}} src={src} controls />
      )}
      {file.mime.startsWith('audio/') && (
        <audio style={{flex: '1 1 0', border: 'none'}} src={src} controls />
      )}
      {(file.mime.startsWith('text/') || file.mime === 'application/json') && (
        <TextViewer src={src} />
      )}
    </Drawer>
  )
}
