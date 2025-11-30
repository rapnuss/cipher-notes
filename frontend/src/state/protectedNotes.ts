import {db, ProtectedNotesConfig} from '../db'
import {createVerifier, deriveKey, generateMasterSalt, verifyPassword} from '../util/pbkdf2'
import {getState, setState} from './store'

export type SetupDialogState = {
  open: boolean
  password: string
  confirmPassword: string
  loading: boolean
  error: string
}

export type UnlockDialogState = {
  open: boolean
  password: string
  loading: boolean
  error: string
}

export type ChangePasswordDialogState = {
  open: boolean
  currentPassword: string
  newPassword: string
  confirmPassword: string
  loading: boolean
  error: string
}

export type ProtectedNotesState = {
  unlocked: boolean
  derivedKey: CryptoKey | null
  configLoaded: boolean
  hasConfig: boolean
  setupDialog: SetupDialogState
  unlockDialog: UnlockDialogState
  changePasswordDialog: ChangePasswordDialogState
}

const setupDialogInit: SetupDialogState = {
  open: false,
  password: '',
  confirmPassword: '',
  loading: false,
  error: '',
}

const unlockDialogInit: UnlockDialogState = {
  open: false,
  password: '',
  loading: false,
  error: '',
}

const changePasswordDialogInit: ChangePasswordDialogState = {
  open: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  loading: false,
  error: '',
}

export const protectedNotesInit: ProtectedNotesState = {
  unlocked: false,
  derivedKey: null,
  configLoaded: false,
  hasConfig: false,
  setupDialog: setupDialogInit,
  unlockDialog: unlockDialogInit,
  changePasswordDialog: changePasswordDialogInit,
}

export const openSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialog.open = true
  })

export const closeSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialog = {...setupDialogInit}
  })

export const setSetupDialogPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.setupDialog.password = password
  })

export const setSetupDialogConfirmPassword = (confirmPassword: string) =>
  setState((state) => {
    state.protectedNotes.setupDialog.confirmPassword = confirmPassword
  })

export const openUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialog.open = true
  })

export const closeUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialog = {...unlockDialogInit}
  })

export const setUnlockDialogPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.unlockDialog.password = password
  })

export const openChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.open = true
  })

export const closeChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog = {...changePasswordDialogInit}
  })

export const setChangePasswordCurrentPassword = (currentPassword: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.currentPassword = currentPassword
  })

export const setChangePasswordNewPassword = (newPassword: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.newPassword = newPassword
  })

export const setChangePasswordConfirmPassword = (confirmPassword: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.confirmPassword = confirmPassword
  })

export const lockProtectedNotes = () =>
  setState((state) => {
    state.protectedNotes.unlocked = false
    state.protectedNotes.derivedKey = null
  })

export const loadProtectedNotesConfig = async () => {
  const localConfig = await db.protected_notes_config.get('config')
  setState((state) => {
    state.protectedNotes.configLoaded = true
    state.protectedNotes.hasConfig = !!localConfig
  })
  return localConfig
}

export const submitSetupDialog = async () => {
  const {password, confirmPassword} = getState().protectedNotes.setupDialog

  if (password.length < 4) {
    setState((state) => {
      state.protectedNotes.setupDialog.error = 'Password must be at least 4 characters'
    })
    return
  }
  if (password !== confirmPassword) {
    setState((state) => {
      state.protectedNotes.setupDialog.error = 'Passwords do not match'
    })
    return
  }

  setState((state) => {
    state.protectedNotes.setupDialog.loading = true
    state.protectedNotes.setupDialog.error = ''
  })

  try {
    const masterSalt = generateMasterSalt()
    const key = await deriveKey(password, masterSalt)
    const {verifier, verifier_iv} = await createVerifier(key)
    const updated_at = Date.now()

    const config: ProtectedNotesConfig = {
      id: 'config',
      master_salt: masterSalt,
      verifier,
      verifier_iv,
      updated_at,
      state: 'dirty',
    }

    await db.protected_notes_config.put(config)

    setState((state) => {
      state.protectedNotes.hasConfig = true
      state.protectedNotes.unlocked = true
      state.protectedNotes.derivedKey = key
      state.protectedNotes.setupDialog = {...setupDialogInit}
    })
  } catch (e) {
    console.error('Failed to setup protected notes:', e)
    setState((state) => {
      state.protectedNotes.setupDialog.loading = false
      state.protectedNotes.setupDialog.error = 'Failed to setup protected notes'
    })
  }
}

export const submitUnlockDialog = async () => {
  const {password} = getState().protectedNotes.unlockDialog

  setState((state) => {
    state.protectedNotes.unlockDialog.loading = true
    state.protectedNotes.unlockDialog.error = ''
  })

  try {
    const config = await db.protected_notes_config.get('config')
    if (!config) {
      setState((state) => {
        state.protectedNotes.unlockDialog.loading = false
        state.protectedNotes.unlockDialog.error = 'No config found'
      })
      return
    }

    const key = await deriveKey(password, config.master_salt)
    const isValid = await verifyPassword(key, config.verifier, config.verifier_iv)

    if (!isValid) {
      setState((state) => {
        state.protectedNotes.unlockDialog.loading = false
        state.protectedNotes.unlockDialog.error = 'Incorrect password'
      })
      return
    }

    setState((state) => {
      state.protectedNotes.unlocked = true
      state.protectedNotes.derivedKey = key
      state.protectedNotes.unlockDialog = {...unlockDialogInit}
    })
  } catch (e) {
    console.error('Failed to unlock protected notes:', e)
    setState((state) => {
      state.protectedNotes.unlockDialog.loading = false
      state.protectedNotes.unlockDialog.error = 'Failed to unlock'
    })
  }
}

export const getProtectedNotesKey = (): CryptoKey | null => {
  return getState().protectedNotes.derivedKey
}

export const isProtectedNotesUnlocked = (): boolean => {
  return getState().protectedNotes.unlocked
}

export const submitChangePasswordDialog = async () => {
  const {currentPassword, newPassword, confirmPassword} =
    getState().protectedNotes.changePasswordDialog

  if (newPassword.length < 4) {
    setState((state) => {
      state.protectedNotes.changePasswordDialog.error = 'New password must be at least 4 characters'
    })
    return
  }
  if (newPassword !== confirmPassword) {
    setState((state) => {
      state.protectedNotes.changePasswordDialog.error = 'New passwords do not match'
    })
    return
  }

  setState((state) => {
    state.protectedNotes.changePasswordDialog.loading = true
    state.protectedNotes.changePasswordDialog.error = ''
  })

  try {
    const config = await db.protected_notes_config.get('config')
    if (!config) {
      setState((state) => {
        state.protectedNotes.changePasswordDialog.loading = false
        state.protectedNotes.changePasswordDialog.error = 'No protected notes config found'
      })
      return
    }

    const oldKey = await deriveKey(currentPassword, config.master_salt)
    const isValid = await verifyPassword(oldKey, config.verifier, config.verifier_iv)

    if (!isValid) {
      setState((state) => {
        state.protectedNotes.changePasswordDialog.loading = false
        state.protectedNotes.changePasswordDialog.error = 'Current password is incorrect'
      })
      return
    }

    const {decryptNoteFromStorage, encryptNoteForStorage} = await import(
      '../business/protectedNotesEncryption'
    )

    const protectedNotes = await db.notes.where('protected').equals(1).toArray()

    const decryptedNotes = await Promise.all(
      protectedNotes.map(async (note) => {
        const decrypted = await decryptNoteFromStorage(note, oldKey)
        return decrypted
      })
    )

    const newMasterSalt = generateMasterSalt()
    const newKey = await deriveKey(newPassword, newMasterSalt)
    const {verifier, verifier_iv} = await createVerifier(newKey)

    const reEncryptedNotes = await Promise.all(
      decryptedNotes.map(async (note) => {
        const encrypted = await encryptNoteForStorage(note, newKey)
        return {
          ...encrypted,
          state: 'dirty' as const,
          version: note.version + 1,
        }
      })
    )

    const updated_at = Date.now()

    await db.transaction('rw', db.notes, db.protected_notes_config, async () => {
      for (const note of reEncryptedNotes) {
        await db.notes.put(note)
      }

      await db.protected_notes_config.put({
        id: 'config',
        master_salt: newMasterSalt,
        verifier,
        verifier_iv,
        updated_at,
        state: 'dirty',
      })
    })

    setState((state) => {
      state.protectedNotes.derivedKey = newKey
      state.protectedNotes.changePasswordDialog = {...changePasswordDialogInit}
    })
  } catch (e) {
    console.error('Failed to change password:', e)
    setState((state) => {
      state.protectedNotes.changePasswordDialog.loading = false
      state.protectedNotes.changePasswordDialog.error = 'Failed to change password'
    })
  }
}

loadProtectedNotesConfig()
