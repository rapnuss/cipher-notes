import {spotlight, Spotlight, SpotlightActionData} from '@mantine/spotlight'
import {addNote, noteOpened, openSyncDialogAndSync} from '../state/notes'
import {
  logout,
  openEncryptionKeyDialog,
  openLoginDialog,
  openRegisterDialog,
  toggleImprint,
  openDeleteServerNotesDialog,
  openChangeEmailDialog,
  openDeleteAccountDialog,
  removeAllSessions,
} from '../state/user'
import {selectCommandCenterDisabled, setCommandCenterOpen, useSelector} from '../state/store'
import {useMantineColorScheme} from '@mantine/core'
import {HotkeyItem, useHotkeys} from '@mantine/hooks'
import {openSettingsDialog} from '../state/settings'
import {openStorageUsageDialog} from '../state/storageUsage'
import {db} from '../db'
import {useLiveQuery} from 'dexie-react-hooks'
import {useEffect} from 'react'
import {ActiveLabel, Note} from '../business/models'
import {exportNotes, openImportDialog, openKeepImportDialog} from '../state/import'
import {labelSelected, selectCachedLabels} from '../state/labels'
import {delay} from '../util/misc'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'

type Command = SpotlightActionData & {shortcut?: string; onClick: () => void}

export const CommandCenter = () => {
  const {toggleColorScheme} = useMantineColorScheme()
  const loggedIn = useSelector((state) => state.user.user.loggedIn)
  const hasKeyTokenPair = useSelector((state) => !!state.user.user.keyTokenPair)
  const email = useSelector((state) => state.user.user.email)
  const commandCenterDisabled = useSelector(selectCommandCenterDisabled)
  const notes: Note[] = useLiveQuery(() => db.notes.where('deleted_at').equals(0).toArray(), [], [])
  const labels = useSelector(selectCachedLabels)
  const activeLabel = useSelector((state) => state.labels.activeLabel)

  const commands: Command[] = [
    {
      id: 'toggleColorScheme',
      label: 'Toggle Dark Mode',
      onClick: toggleColorScheme,
      shortcut: 'alt+shift+d',
    },
    {
      id: 'newNote',
      label: 'New note',
      onClick: addNote,
      shortcut: 'alt+shift+n',
    },
    {
      id: 'searchContent',
      label: 'Search notes content',
      onClick: () => {
        const input = document.getElementById('searchInput') as HTMLInputElement | null
        input?.select()
      },
      shortcut: 'alt+shift+f',
    },
    {
      id: 'select-all',
      label: 'Show all notes (un-archived)',
      onClick: () => labelSelected('all'),
      shortcut: 'alt+shift+a',
      disabled: activeLabel === 'all',
    },
    {
      id: 'select-unlabeled',
      label: 'Show unlabeled notes',
      onClick: () => labelSelected('unlabeled'),
      shortcut: 'alt+shift+u',
      disabled: activeLabel === 'unlabeled',
    },
    {
      id: 'select-archived',
      label: 'Show archived notes',
      onClick: () => labelSelected('archived'),
      shortcut: 'alt+shift+h',
      disabled: activeLabel === 'archived',
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
      id: 'agb',
      label: 'Allgemeine Geschäftsbedingungen (AGB)',
      onClick: () => window.open('/agb.html', '_blank'),
    },
    {
      id: 'datenschutz',
      label: 'Datenschutzerklärung',
      onClick: () => window.open('/datenschutz.html', '_blank'),
    },
    {
      id: 'terms',
      label: 'Terms and Conditions',
      onClick: () => window.open('/terms.html', '_blank'),
    },
    {
      id: 'privacy',
      label: 'Privacy Policy',
      onClick: () => window.open('/privacy.html', '_blank'),
    },
    {
      id: 'encryptionKey',
      label: `${hasKeyTokenPair ? 'Export' : 'New'} Encryption-Key`,
      onClick: () => openEncryptionKeyDialog('export/generate'),
      disabled: !loggedIn,
    },
    {
      id: 'importEncryptionKey',
      label: 'Import Encryption-Key',
      onClick: () => openEncryptionKeyDialog('update'),
      disabled: !loggedIn || !hasKeyTokenPair,
    },
    {
      id: 'sync',
      label: 'Manual server sync (and view sync error)',
      onClick: openSyncDialogAndSync,
      disabled: !loggedIn,
    },
    {
      id: 'issues',
      label: 'Bug Reports & Feature Requests',
      onClick: () => window.open('https://github.com/rapnuss/ciphernotes/issues', '_blank'),
    },
    {
      id: 'storageUsage',
      label: 'Show storage limits',
      onClick: openStorageUsageDialog,
      disabled: !loggedIn,
    },
    {
      id: 'imprint',
      label: 'Imprint',
      onClick: toggleImprint,
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
      id: 'logout',
      label: 'Logout',
      onClick: logout,
      disabled: !loggedIn,
    },
    {
      id: 'logoutAllDevices',
      label: 'Logout from all devices',
      onClick: () => {
        openConfirmModalWithBackHandler({
          id: 'logoutAllDevices',
          title: 'Logout from all devices',
          children: 'Are you sure you want to logout from all devices?',
          labels: {
            confirm: 'Logout',
            cancel: 'Cancel',
          },
          onConfirm: removeAllSessions,
        })
      },
      disabled: !loggedIn,
    },
    {
      id: 'settings',
      label: 'Settings',
      onClick: openSettingsDialog,
      disabled: true,
    },
    {
      id: 'generateNewEncryptionKeyAndResync',
      label: 'Generate new Encryption-Key and resync notes',
      onClick: openDeleteServerNotesDialog,
      disabled: !loggedIn || !hasKeyTokenPair,
    },
    {
      id: 'changeEmail',
      label: 'Change Email',
      onClick: openChangeEmailDialog,
      disabled: !email,
    },
    {
      id: 'deleteAccount',
      label: 'Delete Account',
      onClick: openDeleteAccountDialog,
      disabled: !loggedIn,
    },
    {
      id: 'licenses',
      label: 'Third Party Licenses',
      onClick: () => window.open('/licenses.html', '_blank'),
    },
  ]

  const enabledCommands = commands.filter((c) => !c.disabled)

  const hotkeys: HotkeyItem[] = enabledCommands
    .filter(
      (c): c is typeof c & {shortcut: string; onClick: () => void} => !!c.shortcut && !!c.onClick
    )
    .map(
      (c) =>
        [
          c.shortcut,
          async () => {
            if (commandCenterDisabled) return
            spotlight.close()
            await delay(100)
            c.onClick()
          },
        ] as const
    )

  useHotkeys(hotkeys, [], true)

  const actions: SpotlightActionData[] = enabledCommands.map(({shortcut, onClick, ...a}) => ({
    ...a,
    rightSection: shortcut,
    onClick: async () => {
      spotlight.close()
      await delay(100)
      onClick()
    },
  }))

  const noteActions: SpotlightActionData[] = notes.map((n) => ({
    id: n.id,
    label: n.title,
    onClick: async () => {
      spotlight.close()
      await delay(100)
      noteOpened(n.id)
    },
  }))

  const labelActions: SpotlightActionData[] = labels.map((l) => ({
    id: l.id,
    label: l.name,
    onClick: async () => {
      spotlight.close()
      await delay(100)
      labelSelected(l.id as ActiveLabel)
    },
  }))

  useEffect(() => {
    window.addEventListener('popstate', spotlight.close)
    return () => window.removeEventListener('popstate', spotlight.close)
  }, [])

  return (
    <Spotlight
      shortcut='mod + k'
      tagsToIgnore={emptyArray}
      triggerOnContentEditable
      scrollable
      maxHeight='100%'
      disabled={commandCenterDisabled}
      limit={actions.length}
      actions={[
        {
          group: 'Actions',
          actions,
        },
        {
          group: 'Notes',
          actions: noteActions,
        },
        {
          group: 'Labels',
          actions: labelActions,
        },
      ]}
      onSpotlightOpen={() => {
        setCommandCenterOpen(true)
        history.pushState(null, '', location.href)
      }}
      onSpotlightClose={() => {
        setCommandCenterOpen(false)
        history.back()
      }}
    />
  )
}

const emptyArray: string[] = []
