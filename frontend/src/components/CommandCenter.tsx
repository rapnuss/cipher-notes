import {spotlight, Spotlight, SpotlightActionData} from '@mantine/spotlight'
import {addNote, noteOpened, openSyncDialogAndSync} from '../state/notes'
import {
  logout,
  openEncryptionKeyDialog,
  openLoginDialog,
  openRegisterDialog,
  toggleImpressum,
  openDeleteServerNotesDialog,
} from '../state/user'
import {selectAnyDialogOpen, useSelector} from '../state/store'
import {useMantineColorScheme} from '@mantine/core'
import {useHotkeys} from '@mantine/hooks'
import {openSettingsDialog} from '../state/settings'
import {db} from '../db'
import {useLiveQuery} from 'dexie-react-hooks'
import {useCallback, useEffect, useMemo} from 'react'
import {Note} from '../business/models'
import {exportNotes, openImportDialog, openKeepImportDialog} from '../state/import'

export const CommandCenter = () => {
  const {toggleColorScheme} = useMantineColorScheme()
  const loggedIn = useSelector((state) => state.user.user.loggedIn)
  const anyDialogOpen = useSelector(selectAnyDialogOpen)
  const notes: Note[] = useLiveQuery(() => db.notes.where('deleted_at').equals(0).toArray(), [], [])

  const commands: (SpotlightActionData & {shortcut?: string})[] = useMemo(
    () => [
      {
        id: 'newNote',
        label: 'New note',
        onClick: addNote,
        shortcut: 'alt+shift+n',
      },
      {
        id: 'toggleColorScheme',
        label: 'Toggle Dark Mode',
        onClick: toggleColorScheme,
        shortcut: 'alt+shift+t',
      },
      {
        id: 'sync',
        label: 'Synchronize notes with server',
        onClick: openSyncDialogAndSync,
        disabled: !loggedIn,
        shortcut: 'alt+shift+s',
      },
      {
        id: 'exportNotes',
        label: 'Export notes',
        onClick: exportNotes,
      },
      {
        id: 'importNotes',
        label: 'Import notes',
        onClick: openImportDialog,
      },
      {
        id: 'keepImportNotes',
        label: 'Import notes from Keep',
        onClick: openKeepImportDialog,
      },
      {
        id: 'register',
        label: 'Register',
        onClick: openRegisterDialog,
        disabled: loggedIn,
      },
      {
        id: 'login',
        label: 'Login',
        onClick: openLoginDialog,
        disabled: loggedIn,
        shortcut: 'alt+shift+l',
      },
      {
        id: 'encryptionKey',
        label: 'Encryption-Key (Generate/Import/Export)',
        onClick: openEncryptionKeyDialog,
      },
      {
        id: 'impressum',
        label: 'Impressum',
        onClick: toggleImpressum,
      },
      {
        id: 'logout',
        label: 'Logout',
        onClick: logout,
        disabled: !loggedIn,
        shortcut: 'alt+shift+o',
      },
      {
        id: 'settings',
        label: 'Settings',
        onClick: openSettingsDialog,
      },
      {
        id: 'deleteServerNotes',
        label: 'Delete Server Notes and generate new crypto key',
        onClick: openDeleteServerNotesDialog,
        disabled: !loggedIn,
      },
    ],
    [loggedIn, toggleColorScheme]
  )

  const enabledCommands = useMemo(() => commands.filter((c) => !c.disabled), [commands])

  const hotkeys: [string, () => void][] = useMemo(
    () =>
      enabledCommands
        .filter(
          (c): c is typeof c & {shortcut: string; onClick: () => void} =>
            !!c.shortcut && !!c.onClick
        )
        .map((c) => [c.shortcut, c.onClick]),
    [enabledCommands]
  )

  useHotkeys(hotkeys, [], true)

  const actions = useMemo(
    () => enabledCommands.map(({shortcut, ...a}) => ({...a, rightSection: shortcut})),
    [enabledCommands]
  )

  const noteActions = useMemo(
    () =>
      notes.map((n) => ({
        id: n.id,
        label: n.title,
        onClick: () => noteOpened(n.id),
      })),
    [notes]
  )

  const actionGroups = useMemo(
    () => [
      {
        group: 'Actions',
        actions,
      },
      {
        group: 'Notes',
        actions: noteActions,
      },
    ],
    [actions, noteActions]
  )

  useEffect(() => {
    window.addEventListener('popstate', spotlight.close)
    return () => window.removeEventListener('popstate', spotlight.close)
  }, [])

  const onOpen = useCallback(() => {
    history.pushState(null, '', location.href)
  }, [])

  const onClose = useCallback(() => {
    history.back()
  }, [])

  return (
    <Spotlight
      shortcut='mod + k'
      tagsToIgnore={emptyArray}
      triggerOnContentEditable
      scrollable
      maxHeight='100%'
      disabled={anyDialogOpen}
      limit={actions.length}
      actions={actionGroups}
      onSpotlightOpen={onOpen}
      onSpotlightClose={onClose}
    />
  )
}

const emptyArray: string[] = []
