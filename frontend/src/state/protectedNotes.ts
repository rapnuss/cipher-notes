import {db, ProtectedNotesConfig} from '../db'
import {createVerifier, deriveKey, generateMasterSalt, verifyPassword} from '../util/pbkdf2'
import {getState, setState} from './store'
import {reqGetProtectedNotesConfig, reqPutProtectedNotesConfig} from '../services/backend'

export type ProtectedNotesState = {
  unlocked: boolean
  derivedKey: CryptoKey | null
  configLoaded: boolean
  hasConfig: boolean
  setupDialogOpen: boolean
  unlockDialogOpen: boolean
  changePasswordDialogOpen: boolean
}

export const protectedNotesInit: ProtectedNotesState = {
  unlocked: false,
  derivedKey: null,
  configLoaded: false,
  hasConfig: false,
  setupDialogOpen: false,
  unlockDialogOpen: false,
  changePasswordDialogOpen: false,
}

export const openSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialogOpen = true
  })

export const closeSetupDialog = () =>
  setState((state) => {
    state.protectedNotes.setupDialogOpen = false
  })

export const openUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialogOpen = true
  })

export const closeUnlockDialog = () =>
  setState((state) => {
    state.protectedNotes.unlockDialogOpen = false
  })

export const openChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialogOpen = true
  })

export const closeChangePasswordDialog = () =>
  setState((state) => {
    state.protectedNotes.changePasswordDialogOpen = false
  })

export const lockProtectedNotes = () =>
  setState((state) => {
    state.protectedNotes.unlocked = false
    state.protectedNotes.derivedKey = null
  })

export const loadProtectedNotesConfig = async () => {
  const localConfig = await db.protected_notes_config.get('config')

  const isLoggedIn = getState().user.user.loggedIn
  if (isLoggedIn) {
    const res = await reqGetProtectedNotesConfig()
    if (res.success && res.data.config) {
      const serverConfig = res.data.config
      if (!localConfig || serverConfig.updated_at > localConfig.updated_at) {
        await db.protected_notes_config.put({
          id: 'config',
          master_salt: serverConfig.master_salt,
          verifier: serverConfig.verifier,
          verifier_iv: serverConfig.verifier_iv,
          updated_at: serverConfig.updated_at,
          state: 'synced',
        })
        setState((state) => {
          state.protectedNotes.configLoaded = true
          state.protectedNotes.hasConfig = true
        })
        return await db.protected_notes_config.get('config')
      }
    }
  }

  setState((state) => {
    state.protectedNotes.configLoaded = true
    state.protectedNotes.hasConfig = !!localConfig
  })
  return localConfig
}

export const setupProtectedNotes = async (password: string): Promise<boolean> => {
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

    const isLoggedIn = getState().user.user.loggedIn
    if (isLoggedIn) {
      const res = await reqPutProtectedNotesConfig({
        master_salt: masterSalt,
        verifier,
        verifier_iv,
        updated_at,
      })
      if (res.success) {
        await db.protected_notes_config.update('config', {state: 'synced'})
      }
    }

    setState((state) => {
      state.protectedNotes.hasConfig = true
      state.protectedNotes.unlocked = true
      state.protectedNotes.derivedKey = key
      state.protectedNotes.setupDialogOpen = false
    })

    return true
  } catch (e) {
    console.error('Failed to setup protected notes:', e)
    return false
  }
}

export const unlockProtectedNotes = async (password: string): Promise<boolean> => {
  try {
    const config = await db.protected_notes_config.get('config')
    if (!config) {
      return false
    }

    const key = await deriveKey(password, config.master_salt)
    const isValid = await verifyPassword(key, config.verifier, config.verifier_iv)

    if (!isValid) {
      return false
    }

    setState((state) => {
      state.protectedNotes.unlocked = true
      state.protectedNotes.derivedKey = key
      state.protectedNotes.unlockDialogOpen = false
    })

    return true
  } catch (e) {
    console.error('Failed to unlock protected notes:', e)
    return false
  }
}

export const getProtectedNotesKey = (): CryptoKey | null => {
  return getState().protectedNotes.derivedKey
}

export const isProtectedNotesUnlocked = (): boolean => {
  return getState().protectedNotes.unlocked
}

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{success: boolean; error?: string}> => {
  try {
    const config = await db.protected_notes_config.get('config')
    if (!config) {
      return {success: false, error: 'No protected notes config found'}
    }

    const oldKey = await deriveKey(currentPassword, config.master_salt)
    const isValid = await verifyPassword(oldKey, config.verifier, config.verifier_iv)

    if (!isValid) {
      return {success: false, error: 'Current password is incorrect'}
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

    const isLoggedIn = getState().user.user.loggedIn
    if (isLoggedIn) {
      const res = await reqPutProtectedNotesConfig({
        master_salt: newMasterSalt,
        verifier,
        verifier_iv,
        updated_at,
      })
      if (res.success) {
        await db.protected_notes_config.update('config', {state: 'synced'})
      }
    }

    setState((state) => {
      state.protectedNotes.derivedKey = newKey
      state.protectedNotes.changePasswordDialogOpen = false
    })

    return {success: true}
  } catch (e) {
    console.error('Failed to change password:', e)
    return {success: false, error: 'Failed to change password'}
  }
}

export const syncProtectedNotesConfig = async () => {
  const config = await db.protected_notes_config.get('config')
  if (!config || config.state !== 'dirty') {
    return
  }

  const isLoggedIn = getState().user.user.loggedIn
  if (!isLoggedIn) {
    return
  }

  const res = await reqPutProtectedNotesConfig({
    master_salt: config.master_salt,
    verifier: config.verifier,
    verifier_iv: config.verifier_iv,
    updated_at: config.updated_at,
  })

  if (res.success) {
    await db.protected_notes_config.update('config', {state: 'synced'})
  }
}

loadProtectedNotesConfig()
