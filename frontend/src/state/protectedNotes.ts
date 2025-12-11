import {ProtectedNote} from '../business/models'
import {reEncryptNotes, reEncryptProtectedNote} from '../business/notesEncryption'
import {db} from '../db'
import {loadProtectedNotesConfig, storeProtectedNotesConfig} from '../services/localStorage'
import {createVerifier, deriveKey, generateMasterSalt, verifyPassword} from '../util/pbkdf2'
import {getState, setState, subscribe} from './store'

export type ProtectedNotesConfig = {
  master_salt: string
  verifier: string
  verifier_iv: string
  updated_at: number
  state: 'dirty' | 'synced'
}
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
export type RescueDialogState = {
  open: boolean
  password: string
  loading: boolean
  error: string
  message: string
}
export type ProtectedNotesState = {
  config: ProtectedNotesConfig | null
  derivedKey: CryptoKey | null
  setupDialog: SetupDialogState
  unlockDialog: UnlockDialogState
  changePasswordDialog: ChangePasswordDialogState
  rescueDialog: RescueDialogState
}
const setupDialogInit: SetupDialogState = Object.freeze({
  open: false,
  password: '',
  confirmPassword: '',
  loading: false,
  error: '',
})
const unlockDialogInit: UnlockDialogState = Object.freeze({
  open: false,
  password: '',
  loading: false,
  error: '',
})
const changePasswordDialogInit: ChangePasswordDialogState = Object.freeze({
  open: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  loading: false,
  error: '',
})
const rescueDialogInit: RescueDialogState = Object.freeze({
  open: false,
  password: '',
  loading: false,
  error: '',
  message: '',
})
export const protectedNotesInit: ProtectedNotesState = Object.freeze({
  config: null,
  derivedKey: null,
  setupDialog: setupDialogInit,
  unlockDialog: unlockDialogInit,
  changePasswordDialog: changePasswordDialogInit,
  rescueDialog: rescueDialogInit,
})

loadProtectedNotesConfig().then((config) =>
  setState((state) => {
    state.protectedNotes.config = config
  })
)

export const openProtectedNotesSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialog = {...setupDialogInit, open: true}
  })

export const openProtectedNotesUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialog = {...unlockDialogInit, open: true}
  })

export const openProtectedNotesChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog = {...changePasswordDialogInit, open: true}
  })
export const openRescueProtectedNotesDialog = () =>
  setState((state) => {
    state.protectedNotes.rescueDialog = {...rescueDialogInit, open: true}
  })

export const closeSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialog = setupDialogInit
  })
export const closeUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialog = unlockDialogInit
  })
export const closeChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog = changePasswordDialogInit
  })
export const closeRescueProtectedNotesDialog = () =>
  setState((state) => {
    state.protectedNotes.rescueDialog = rescueDialogInit
  })
export const setSetupDialogPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.setupDialog.password = password
  })
export const setSetupDialogConfirmPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.setupDialog.confirmPassword = password
  })
export const setUnlockDialogPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.unlockDialog.password = password
  })
export const setChangePasswordCurrentPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.currentPassword = password
  })
export const setChangePasswordNewPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.newPassword = password
  })
export const setChangePasswordConfirmPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.changePasswordDialog.confirmPassword = password
  })
export const setRescueDialogPassword = (password: string) =>
  setState((state) => {
    state.protectedNotes.rescueDialog.password = password
  })

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

  try {
    const master_salt = generateMasterSalt()
    const key = await deriveKey(password, master_salt)
    const {verifier, verifier_iv} = await createVerifier(key)
    const updated_at = Date.now()

    const config: ProtectedNotesConfig = {
      master_salt,
      verifier,
      verifier_iv,
      updated_at,
      state: 'dirty',
    }

    setState((state) => {
      state.protectedNotes.config = config
      state.protectedNotes.derivedKey = key
      state.protectedNotes.setupDialog = setupDialogInit
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
  const {password, open, loading} = getState().protectedNotes.unlockDialog
  const {config} = getState().protectedNotes

  if (!open || !config || loading) {
    return
  }

  setState((state) => {
    state.protectedNotes.unlockDialog.loading = true
    state.protectedNotes.unlockDialog.error = ''
  })

  try {
    const key = await deriveKey(password, config.master_salt)
    const ok = await verifyPassword(key, config.verifier, config.verifier_iv)
    if (!ok) {
      setState((state) => {
        state.protectedNotes.unlockDialog.error = 'Invalid password'
        state.protectedNotes.unlockDialog.loading = false
      })
      return
    }

    setState((state) => {
      state.protectedNotes.unlockDialog.loading = false
      state.protectedNotes.unlockDialog.error = ''
      state.protectedNotes.unlockDialog.open = false
      state.protectedNotes.derivedKey = key
    })
  } catch (e) {
    console.error('Failed to unlock protected notes:', e)
    setState((state) => {
      state.protectedNotes.unlockDialog.loading = false
      state.protectedNotes.unlockDialog.error = 'Failed to unlock protected notes'
    })
  }
}

export const submitChangePasswordDialog = async () => {
  const {currentPassword, newPassword, confirmPassword, loading} =
    getState().protectedNotes.changePasswordDialog
  const {config} = getState().protectedNotes

  if (!config || loading) {
    return
  }

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
    const oldKey = await deriveKey(currentPassword, config.master_salt)
    const ok = await verifyPassword(oldKey, config.verifier, config.verifier_iv)
    if (!ok) {
      setState((state) => {
        state.protectedNotes.changePasswordDialog.error = 'Invalid current password'
        state.protectedNotes.changePasswordDialog.loading = false
      })
      return
    }

    const newMasterSalt = generateMasterSalt()
    const newKey = await deriveKey(newPassword, newMasterSalt)
    const {verifier: newVerifier, verifier_iv: newVerifier_iv} = await createVerifier(newKey)
    const updated_at = Date.now()

    const newConfig: ProtectedNotesConfig = {
      master_salt: newMasterSalt,
      verifier: newVerifier,
      verifier_iv: newVerifier_iv,
      updated_at,
      state: 'dirty',
    }

    await db.transaction('rw', db.notes, async () => {
      const allNotes = await db.notes.where('deleted_at').equals(0).toArray()

      const protectedNotes: ProtectedNote[] = allNotes.filter(
        (n): n is ProtectedNote => n.type === 'note_protected' || n.type === 'todo_protected'
      )

      const reEncryptedNotes = await reEncryptNotes(oldKey, newKey, protectedNotes, newMasterSalt)
      await db.notes.bulkPut(reEncryptedNotes)
      setState((state) => {
        state.protectedNotes.config = newConfig
        state.protectedNotes.derivedKey = newKey
        state.protectedNotes.changePasswordDialog = changePasswordDialogInit
      })
    })
  } catch (e) {
    console.error('Failed to change password:', e)
    setState((state) => {
      state.protectedNotes.changePasswordDialog.loading = false
      state.protectedNotes.changePasswordDialog.error = 'Failed to change password'
    })
  }
}

export const submitRescueProtectedNotesDialog = async () => {
  const {password, loading, open} = getState().protectedNotes.rescueDialog
  const {config, derivedKey} = getState().protectedNotes

  if (!open || !config || !derivedKey || loading) {
    return
  }
  if (password.length === 0) {
    setState((state) => {
      state.protectedNotes.rescueDialog.error = 'Password is required'
      state.protectedNotes.rescueDialog.message = ''
    })
    return
  }

  setState((state) => {
    state.protectedNotes.rescueDialog.loading = true
    state.protectedNotes.rescueDialog.error = ''
    state.protectedNotes.rescueDialog.message = ''
  })

  try {
    const notes = await db.notes.where('deleted_at').equals(0).toArray()
    const candidates = notes.filter(
      (n): n is ProtectedNote =>
        (n.type === 'note_protected' || n.type === 'todo_protected') &&
        n.salt !== config.master_salt
    )

    if (candidates.length === 0) {
      setState((state) => {
        state.protectedNotes.rescueDialog.loading = false
        state.protectedNotes.rescueDialog.message = 'No protected notes need rescue'
      })
      return
    }

    const saltToKey = new Map<string, CryptoKey>()
    const rescued: ProtectedNote[] = []

    for (const note of candidates) {
      let oldKey = saltToKey.get(note.salt)
      if (!oldKey) {
        oldKey = await deriveKey(password, note.salt)
        saltToKey.set(note.salt, oldKey)
      }
      const reEncrypted = await reEncryptProtectedNote(oldKey, derivedKey, note, config.master_salt)
      if (reEncrypted) {
        rescued.push(reEncrypted)
      }
    }

    if (rescued.length === 0) {
      setState((state) => {
        state.protectedNotes.rescueDialog.loading = false
        state.protectedNotes.rescueDialog.error =
          'Failed to decrypt notes with the entered password'
      })
      return
    }

    await db.notes.bulkPut(rescued)
    setState((state) => {
      state.protectedNotes.rescueDialog.loading = false
      state.protectedNotes.rescueDialog.password = ''
      state.protectedNotes.rescueDialog.message = `Rescued ${rescued.length} protected note${
        rescued.length === 1 ? '' : 's'
      }`
    })
  } catch (e) {
    console.error('Failed to rescue protected notes:', e)
    setState((state) => {
      state.protectedNotes.rescueDialog.loading = false
      state.protectedNotes.rescueDialog.error = 'Failed to rescue protected notes'
    })
  }
}

export const registerProtectedNotesSubscriptions = () => {
  subscribe((state) => state.protectedNotes.config, storeProtectedNotesConfig)
}

export const lockProtectedNotes = () =>
  setState((state) => {
    state.protectedNotes.derivedKey = null
  })
