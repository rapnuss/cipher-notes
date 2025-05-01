import {PWABadge} from './PWABadge.tsx'
import {CommandCenter} from './CommandCenter.tsx'
import {Notifications} from '@mantine/notifications'
import {ImportNotesDialog} from './ImportNotesDialog.tsx'
import {LoginDialog} from './LoginDialog.tsx'
import {RegisterDialog} from './RegisterDialog.tsx'
import {SyncDialog} from './SyncDialog.tsx'
import {EncryptionKeyDialog} from './EncryptionKeyDialog.tsx'
import {Main} from './Main.tsx'
import {ConflictDialog} from './ConflictDialog.tsx'
import {OpenNoteDialog} from './OpenNoteDialog.tsx'
import {ImprintDialog} from './ImprintDialog.tsx'
import {DeleteServerNotesDialog} from './DeleteServerNotesDialog'
import {SettingsDialog} from './SettingsDialog.tsx'
import {KeepImportDialog} from './KeepImportDialog.tsx'
import {debounce, delay} from '../util/misc.ts'
import {LabelSelector} from './LabelSelector.tsx'
import {LabelDialog} from './LabelDialog.tsx'
import {ChangeEmailDialog} from './ChangeEmailDialog.tsx'

window.addEventListener(
  'scroll',
  debounce(() => scrollTo(0, 0), 0)
)

if (window.visualViewport) {
  window.visualViewport.addEventListener(
    'resize',
    debounce(() => {
      document.documentElement.style.setProperty(
        '--viewport-height',
        `${window.visualViewport?.height}px`
      )
    }, 0)
  )
} else {
  window.addEventListener(
    'resize',
    debounce(() => {
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`)
    }, 0)
  )
}

document.addEventListener(
  'focus',
  async (e) => {
    const target = e.target as HTMLElement
    if (!(target instanceof HTMLTextAreaElement)) {
      return
    }
    await delay(300)
    target.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  },
  true
)

export const App = () => (
  <>
    <Main />
    <LabelSelector />
    <LabelDialog />
    <OpenNoteDialog />
    <CommandCenter />
    <ImportNotesDialog />
    <KeepImportDialog />
    <RegisterDialog />
    <LoginDialog />
    <SyncDialog />
    <SettingsDialog />
    <ConflictDialog />
    <EncryptionKeyDialog />
    <DeleteServerNotesDialog />
    <ChangeEmailDialog />
    <ImprintDialog />
    <PWABadge />
    <Notifications autoClose={false} />
  </>
)
