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
import {DeleteAccountDialog, DeleteServerNotesDialog} from './DeleteServerNotesDialog'
import {AdminPanel} from './AdminDialog.tsx'
import {KeepImportDialog} from './KeepImportDialog.tsx'
import {LabelSelector} from './LabelSelector.tsx'
import {LabelDialog} from './LabelDialog.tsx'
import {ChangeEmailDialog} from './ChangeEmailDialog.tsx'
import {OpenFileDialog} from './OpenFileDialog.tsx'
import {StorageUsageDialog} from './StorageUsageDialog.tsx'
import {SettingsDialog} from './SettingsDialog.tsx'
import {
  SetupProtectedNotesDialog,
  UnlockProtectedNotesDialog,
  ChangePasswordDialog,
} from './ProtectedNotesDialog.tsx'

export const App = () => (
  <>
    <Main />
    <LabelSelector />
    <LabelDialog />
    <OpenNoteDialog />
    <OpenFileDialog />
    <CommandCenter />
    <ImportNotesDialog />
    <KeepImportDialog />
    <RegisterDialog />
    <LoginDialog />
    <SyncDialog />
    <StorageUsageDialog />
    <AdminPanel />
    <ConflictDialog />
    <EncryptionKeyDialog />
    <DeleteServerNotesDialog />
    <DeleteAccountDialog />
    <ChangeEmailDialog />
    <ImprintDialog />
    <SettingsDialog />
    <SetupProtectedNotesDialog />
    <UnlockProtectedNotesDialog />
    <ChangePasswordDialog />
    <PWABadge />
    <Notifications autoClose={10_000} />
  </>
)
