import {Button, Drawer, Flex, Menu, NumberInput, Popover, Text} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  copyFileToClipboard,
  deleteOpenFile,
  fileClosed,
  isClipboardSupported,
  openFileArchivedToggled,
  openFileTitleChanged,
  setLabelDropdownOpen,
  setMoreMenuOpen,
} from '../state/files'
import {useLiveQuery} from 'dexie-react-hooks'
import {db} from '../db'
import {ImageViewer} from './ImageViewer'
import {Hue} from '../business/models'
import {useThemeName} from '../helpers/useMyColorScheme'
import {getFilename, labelBgColor, labelBorderColor} from '../business/misc'
import {TextViewer} from './TextViewer'
import {ActionIconWithText} from './ActionIconWithText'
import {IconX} from './icons/IconX'
import {IconArchive} from './icons/IconArchive'
import {IconTrash} from './icons/IconTrash'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {IconDots} from './icons/IconDots'
import {IconLabel} from './icons/IconLabel'
import {LabelDropdownContent} from './LabelDropdownContent'
import {IconDownload} from './icons/IconDownload'
import {downloadBlob, formatDateTime} from '../util/misc'
import {notifications} from '@mantine/notifications'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {lazy, Suspense, useEffect, useState, type SyntheticEvent} from 'react'
import {useHotkeys} from '@mantine/hooks'
import {FileIconWithExtension} from './FileIconWithExtension'
import {isAndroid, isIOS} from '../helpers/bowser'
import {IconCopy} from './icons/IconCopy'
import {IconClockPlus} from './icons/IconClockPlus'
import {IconClockEdit} from './icons/IconClockEdit'
import type {PdfPageNavigation} from './PdfViewer'

const PdfViewer = lazy(() => import('./PdfViewer').then((module) => ({default: module.PdfViewer})))

const fileNotFound = Symbol('file not found')

const PdfPageControl = ({navigation}: {navigation: PdfPageNavigation}) => {
  const [opened, setOpened] = useState(false)
  const [page, setPage] = useState<string | number>(navigation.currentPage)
  const pageNumber = Number(page)
  const isValidPage =
    Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= navigation.totalPages

  const toggle = () => {
    if (!opened) setPage(navigation.currentPage)
    setOpened(!opened)
  }

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidPage) return
    navigation.goToPage(pageNumber)
    setOpened(false)
  }

  return (
    <Popover
      width={240}
      position='top'
      withArrow
      shadow='md'
      trapFocus={!isIOS()}
      closeOnEscape={false}
      closeOnClickOutside
      opened={opened}
      onDismiss={() => setOpened(false)}
    >
      <Popover.Target>
        <ActionIconWithText
          title={`Page ${navigation.currentPage} of ${navigation.totalPages}. Go to page`}
          text='go to'
          onClick={toggle}
          style={{width: 'auto', paddingInline: '.25rem'}}
        >
          <div
            style={{
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {String(navigation.currentPage).padStart(String(navigation.totalPages).length, '0')}/
            {navigation.totalPages}
          </div>
        </ActionIconWithText>
      </Popover.Target>
      <Popover.Dropdown>
        <form
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setOpened(false)
          }}
        >
          <Text size='sm' fw={600} mb='xs'>
            Go to page
          </Text>
          <Flex gap='xs' align='flex-end'>
            <NumberInput
              value={page}
              onChange={setPage}
              min={1}
              max={navigation.totalPages}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior='strict'
              hideControls
              selectAllOnFocus
              type='tel'
              autoFocus
              aria-label={`Page number, from 1 to ${navigation.totalPages}`}
              style={{flex: '1 1 0'}}
            />
            <Button type='submit' disabled={!isValidPage}>
              Go
            </Button>
          </Flex>
        </form>
      </Popover.Dropdown>
    </Popover>
  )
}

export const OpenFileDialog = () => {
  const theme = useThemeName()
  const openFile = useSelector((state) => state.files.openFile)
  const {moreMenuOpen, labelDropdownOpen} = useSelector((state) => state.files.fileDialog)
  const labelsCache = useSelector((state) => state.labels.labelsCache)
  const [pdfPageNavigation, setPdfPageNavigation] = useState<PdfPageNavigation | null>(null)
  const open = openFile !== null
  const file = useLiveQuery(
    async () => (openFile ? ((await db.files_meta.get(openFile.id)) ?? fileNotFound) : undefined),
    [openFile?.id],
  )
  const fileBlob = useLiveQuery(
    async () => (openFile ? (await db.files_blob.get(openFile.id))?.blob : undefined),
    [openFile?.id],
  )
  useCloseOnBack({id: 'open-file-dialog', open, onClose: fileClosed})
  useEffect(() => {
    if (file === fileNotFound) {
      fileClosed()
    }
  }, [file])
  useHotkeys(
    [
      [
        'Escape',
        () => {
          if (moreMenuOpen) {
            setMoreMenuOpen(false)
            const button = document.querySelector('.open-file-more-menu')
            if (button instanceof HTMLElement) {
              button.focus()
            }
          } else if (labelDropdownOpen) {
            setLabelDropdownOpen(false)
            const button = document.querySelector('.open-file-label-button')
            if (button instanceof HTMLElement) {
              button.focus()
            }
          } else if (open) {
            fileClosed()
          }
        },
      ],
    ],
    [],
    true,
  )
  if (!file || file === fileNotFound) return null
  const openNoteLabel = file.labels[0]
  const hue: Hue = openNoteLabel ? (labelsCache[openNoteLabel]?.hue ?? null) : null
  const borderColor = labelBorderColor(hue, theme)
  const src = `/files/${file.id}`
  return (
    <Drawer
      opened={open}
      onClose={fileClosed}
      withCloseButton={false}
      closeOnEscape={false}
      position='top'
      size='100%'
      styles={{
        content: {
          height: 'var(--viewport-height, 100dvh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: labelBgColor(hue, theme),
          overflow: 'hidden',
          border: borderColor ? `2px solid ${borderColor}` : undefined,
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
      <Flex align='center' gap='xs'>
        <input
          style={{
            flex: '1 1 0',
            minWidth: '0',
            border: 'none',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            outline: 'none',
            background: 'transparent',
          }}
          autoComplete='off'
          placeholder='Title'
          name='title'
          type='text'
          value={openFile?.title ?? ''}
          onChange={(e) => openFileTitleChanged(e.target.value)}
        />
        {file.ext && (
          <div style={{flex: '0 0 auto', fontSize: '1.5rem', opacity: 0.5, fontWeight: 'bold'}}>
            {file.ext}
          </div>
        )}
      </Flex>
      {file.blob_state === 'remote' ?
        <div
          style={{flex: '1 1 0', display: 'flex', justifyContent: 'center', alignItems: 'center'}}
        >
          File not downloaded
        </div>
      : file.mime.startsWith('image/') ?
        <ImageViewer src={src} alt={file.title} />
      : file.mime === 'application/pdf' ?
        <Suspense
          fallback={
            <div
              style={{
                flex: '1 1 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              Loading PDF viewer…
            </div>
          }
        >
          {fileBlob ?
            <PdfViewer
              key={file.id}
              file={fileBlob}
              title={file.title}
              onPageNavigationChange={setPdfPageNavigation}
            />
          : <div
              style={{
                flex: '1 1 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              Loading PDF…
            </div>
          }
        </Suspense>
      : file.mime.startsWith('video/') ?
        <video style={{flex: '1 1 0', minHeight: 0}} src={src} controls />
      : file.mime.startsWith('audio/') ?
        <div
          style={{
            flex: '1 1 0',
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <audio style={{flex: '0 0 auto'}} src={src} controls />
        </div>
      : file.mime.startsWith('text/') || file.mime === 'application/json' ?
        <TextViewer src={src} />
      : <div
          style={{flex: '1 1 0', display: 'flex', justifyContent: 'center', alignItems: 'center'}}
        >
          <FileIconWithExtension ext={file.ext} />
        </div>
      }
      <Flex gap='xs'>
        <Menu
          closeOnEscape={false}
          opened={moreMenuOpen}
          onDismiss={() => setMoreMenuOpen(false)}
          closeOnClickOutside
        >
          <Menu.Target>
            <ActionIconWithText
              title='open menu'
              text='more'
              className='open-file-more-menu'
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              data-autofocus
            >
              <IconDots />
            </ActionIconWithText>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconClockPlus />} disabled title='Created'>
              {!file ? '' : formatDateTime(file.created_at)}
            </Menu.Item>
            <Menu.Item leftSection={<IconClockEdit />} disabled title='Updated'>
              {!file ? '' : formatDateTime(file.updated_at)}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconCopy />}
              disabled={!isClipboardSupported(file.mime)}
              onClick={async () => {
                setMoreMenuOpen(false)
                await copyFileToClipboard(file)
              }}
            >
              Copy to clipboard
            </Menu.Item>
            <Menu.Item
              leftSection={<IconTrash />}
              onClick={() => {
                setMoreMenuOpen(false)
                openConfirmModalWithBackHandler({
                  id: 'delete-open-file',
                  title: 'Delete file?',
                  labels: {confirm: 'Delete', cancel: 'Cancel'},
                  confirmProps: {color: 'red'},
                  onConfirm: deleteOpenFile,
                })
              }}
            >
              Delete note
            </Menu.Item>
            <Menu.Item
              leftSection={<IconArchive />}
              onClick={() => {
                setMoreMenuOpen(false)
                openFileArchivedToggled()
              }}
            >
              {openFile?.archived ? 'Unarchive note' : 'Archive note'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <div style={{flex: '1 1 0'}} />
        {file.mime === 'application/pdf' && pdfPageNavigation && (
          <PdfPageControl navigation={pdfPageNavigation} />
        )}
        <div style={{flex: '1 1 0'}} />
        <Popover
          width='300px'
          position='top'
          withArrow
          shadow='md'
          trapFocus={!isIOS()}
          closeOnEscape={false}
          closeOnClickOutside
          opened={labelDropdownOpen}
          onDismiss={() => {
            setLabelDropdownOpen(false)
          }}
        >
          <Popover.Target>
            <ActionIconWithText
              className='open-file-label-button'
              title='Add label'
              text='label'
              onClick={() => setLabelDropdownOpen(!labelDropdownOpen)}
            >
              <IconLabel />
            </ActionIconWithText>
          </Popover.Target>
          <Popover.Dropdown>
            {openFile && <LabelDropdownContent fileId={openFile.id} />}
          </Popover.Dropdown>
        </Popover>
        <ActionIconWithText
          title={'Download ' + getFilename(file)}
          text='store'
          onClick={async () => {
            const record = await db.files_blob.get(file.id)
            if (!record || !record.blob) return
            downloadBlob(record.blob, getFilename(file))
            if (isAndroid()) {
              notifications.show({
                title: 'File downloaded',
                message: 'Check notifications to find it.',
              })
            }
          }}
        >
          <IconDownload />
        </ActionIconWithText>
        <ActionIconWithText title='Close note' text='close' onClick={fileClosed}>
          <IconX />
        </ActionIconWithText>
      </Flex>
    </Drawer>
  )
}
