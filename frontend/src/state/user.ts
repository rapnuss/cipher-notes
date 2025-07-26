import {
  reqLoginWithCode,
  reqSendLoginCode,
  reqRegisterEmail,
  reqDeleteNotes,
  reqSendConfirmCode,
  reqLogout,
  isUnauthorizedRes,
  reqSendChangeEmailCodes,
  reqChangeEmail,
  reqDeleteAccount,
  reqRemoveAllSessions,
} from '../services/backend'
import {loadUser, storeUser} from '../services/localStorage'
import {getState, setState, subscribe} from './store'
import {calcChecksum, isValidKeyTokenPair} from '../business/notesEncryption'
import {generateKey, generateSalt} from '../util/encryption'
import {db} from '../db'
import socket from '../socket'
import {notifications} from '@mantine/notifications'
import {syncNotes} from './notes'
import {Feature} from '../business/models'
import {parseSubscriptionToken} from '../business/misc'

export type UserState = {
  user: {
    email: string
    loggedIn: boolean
    lastSyncedTo: number
    keyTokenPair: {cryptoKey: string; syncToken: string} | null
    jwt?: string
  }
  features: Feature[]
  connected: boolean
  registerDialog: {open: boolean; email: string; loading: boolean; agree: boolean}
  loginDialog: {
    open: boolean
    email: string
    code: string
    loading: boolean
    status: 'email' | 'code'
  }
  encryptionKeyDialog: {
    open: boolean
    keyTokenPair: string
    qrMode: 'hide' | 'show' | 'scan'
    mode: 'export/generate' | 'update'
  }
  deleteAccountDialog: {
    open: boolean
    code: string
    codeLoading: boolean
    deleteLoading: boolean
  }
  deleteServerNotesDialog: {
    open: boolean
    code: string
    codeLoading: boolean
    deleteLoading: boolean
  }
  imprintOpen: boolean
  changeEmailDialog: {
    open: boolean
    email: string
    loading: boolean
    status: 'email' | 'codes'
    oldEmailCode: string
    newEmailCode: string
  }
}

export const userInit: UserState = {
  user: {email: '', loggedIn: false, lastSyncedTo: 0, keyTokenPair: null},
  features: [],
  connected: false,
  registerDialog: {open: false, email: '', loading: false, agree: false},
  loginDialog: {open: false, email: '', code: '', loading: false, status: 'email'},
  encryptionKeyDialog: {open: false, keyTokenPair: '', qrMode: 'hide', mode: 'export/generate'},
  deleteServerNotesDialog: {open: false, code: '', codeLoading: false, deleteLoading: false},
  deleteAccountDialog: {open: false, code: '', codeLoading: false, deleteLoading: false},
  imprintOpen: false,
  changeEmailDialog: {
    open: false,
    email: '',
    loading: false,
    status: 'email',
    oldEmailCode: '',
    newEmailCode: '',
  },
}

// init
loadUser().then(async (user) => {
  if (user) {
    const features = user.jwt ? await parseSubscriptionToken(user.jwt) : []
    setState((state) => {
      state.user.user = user
      state.user.features = features
    })
  }
  if (user?.loggedIn && !socket.connected) {
    socket.connect()
  }
})
window.addEventListener('focus', () => {
  setState((state) => {
    state.user.connected = socket.connected
  })
})

export const registerEmailChanged = (email: string) =>
  setState((state) => {
    state.user.registerDialog.email = email
  })
export const registerAgreeChanged = (agree: boolean) =>
  setState((state) => {
    state.user.registerDialog.agree = agree
  })
export const openRegisterDialog = () =>
  setState((state) => {
    state.user.registerDialog = {
      open: true,
      email: state.user.user.email,
      loading: false,
      agree: false,
    }
  })
export const closeRegisterDialog = () =>
  setState((state) => {
    state.user.registerDialog.open = false
  })
export const registerEmail = async (captchaToken: string) => {
  const state = getState()
  const {email, loading, agree} = state.user.registerDialog
  if (!email || loading || !agree) return
  setState((state) => {
    state.user.registerDialog.loading = true
  })
  const res = await reqRegisterEmail(email, captchaToken)
  setState((state) => {
    state.user.registerDialog.loading = false
    if (!res.success) {
      notifications.show({
        title: 'Register Email Failed',
        message: res.error,
        color: 'red',
      })
    } else {
      notifications.show({
        title: 'Register Email',
        message: 'Email registered, proceed to login',
      })
      state.user.user.email = email
      state.user.registerDialog.open = false
      state.user.loginDialog = {
        open: true,
        email: state.user.user.email,
        code: '',
        loading: false,
        status: 'email',
      }
    }
  })
}

export const openLoginDialog = () => {
  setState((state) => {
    state.user.loginDialog = {
      open: true,
      email: state.user.user.email,
      code: '',
      loading: false,
      status: 'email',
    }
  })
}
export const closeLoginDialog = () => {
  setState((state) => {
    state.user.loginDialog.open = false
  })
}
export const loginEmailChanged = (email: string) => {
  setState((state) => {
    state.user.loginDialog.email = email
  })
}
export const loginCodeChanged = (code: string) => {
  setState((state) => {
    state.user.loginDialog.code = code
  })
}
export const switchLoginStatus = () => {
  setState((state) => {
    state.user.loginDialog.status = state.user.loginDialog.status === 'email' ? 'code' : 'email'
  })
}
export const sendLoginCode = async () => {
  const state = getState()
  const {email, loading} = state.user.loginDialog
  if (!email || loading) return
  setState((state) => {
    state.user.loginDialog.loading = true
  })
  const res = await reqSendLoginCode(email)
  setState((state) => {
    state.user.loginDialog.loading = false
    if (!res.success) {
      notifications.show({
        title: 'Login Email Failed',
        message: res.error,
        color: 'red',
      })
    } else {
      notifications.show({
        title: 'Login Email',
        message: 'Email sent, proceed to enter code',
      })
      state.user.loginDialog.status = 'code'
    }
  })
}
export const loginWithCode = async () => {
  const state = getState()
  const {email, code, loading} = state.user.loginDialog
  if (!email || !code || loading) return
  setState((state) => {
    state.user.loginDialog.loading = true
  })
  const res = await reqLoginWithCode(email, code)
  const features = res.success ? await parseSubscriptionToken(res.data.jwt) : []
  setState((state) => {
    state.user.loginDialog.loading = false
    if (!res.success) {
      notifications.show({
        title: 'Login with code failed',
        message: res.error,
        color: 'red',
      })
    } else {
      state.user.user.loggedIn = true
      state.user.user.email = email
      state.user.user.jwt = res.data.jwt
      state.user.features = features
      notifications.show({
        title: 'Success',
        message: 'You are logged in',
      })
      state.user.loginDialog.open = false

      if (!state.user.user.keyTokenPair) {
        state.user.encryptionKeyDialog = {
          open: true,
          keyTokenPair: '',
          qrMode: 'hide',
          mode: 'export/generate',
        }
      }
    }
  })
  {
    const state = getState()
    if (state.user.user.loggedIn && state.user.user.keyTokenPair) {
      await syncNotes()
    }
  }
}

export const socketConnectionChanged = (connected: boolean) => {
  setState((state) => {
    state.user.connected = connected
  })
}

export const openEncryptionKeyDialog = async (mode: 'export/generate' | 'update') => {
  const state = getState()
  let keyTokenPair = state.user.user.keyTokenPair
  setState((state) => {
    state.user.encryptionKeyDialog = {
      open: true,
      keyTokenPair:
        keyTokenPair && mode === 'export/generate'
          ? `${keyTokenPair.cryptoKey}:${keyTokenPair.syncToken}:${calcChecksum(
              keyTokenPair.cryptoKey,
              keyTokenPair.syncToken
            )}`
          : '',
      qrMode: 'hide',
      mode,
    }
  })
}
export const generateKeyTokenPairString = async () => {
  const cryptoKey = await generateKey()
  const syncToken = generateSalt(16)
  const checksum = calcChecksum(cryptoKey, syncToken)
  setState((state) => {
    state.user.encryptionKeyDialog.keyTokenPair = `${cryptoKey}:${syncToken}:${checksum}`
  })
}
export const qrModeChanged = (qrMode: 'hide' | 'show' | 'scan') => {
  setState((state) => {
    state.user.encryptionKeyDialog.qrMode = qrMode
  })
}
export const closeEncryptionKeyDialog = () => {
  setState((state) => {
    state.user.encryptionKeyDialog = userInit.encryptionKeyDialog
  })
}
export const keyTokenPairChanged = (keyTokenPair: string) => {
  setState((state) => {
    state.user.encryptionKeyDialog.keyTokenPair = keyTokenPair
  })
}
export const saveEncryptionKey = async (keyTokenPair: string) => {
  const state = getState()
  if (!isValidKeyTokenPair(keyTokenPair)) return
  const [cryptoKey, syncToken] = keyTokenPair.split(':')
  if (!cryptoKey || !syncToken) return
  if (state.user.user.keyTokenPair) {
    setState((state) => {
      state.user.user.lastSyncedTo = 0
    })
    await setEverythingDirty()
  }
  setState((state) => {
    state.user.user.keyTokenPair = {cryptoKey, syncToken}
    state.user.encryptionKeyDialog.open = false
  })
  notifications.show({
    message: 'New encryption key saved',
  })
  if (state.user.user.loggedIn) {
    await syncNotes()
  }
}

const setEverythingDirty = (deleteFilesMetaWithBlobStateRemote = false) =>
  db.transaction('rw', ['notes', 'note_base_versions', 'labels', 'files_meta'], async (tx) => {
    await tx.note_base_versions.clear()
    await tx.notes.toCollection().modify((note) => {
      note.state = 'dirty'
    })
    await tx.labels.toCollection().modify((label) => {
      label.state = 'dirty'
    })
    await tx.files_meta.toCollection().modify((file, ref: any) => {
      file.state = 'dirty'
      if (file.blob_state === 'synced') {
        file.blob_state = 'local'
      } else if (file.blob_state === 'remote' && deleteFilesMetaWithBlobStateRemote) {
        delete ref.value
      }
    })
  })

export const openDeleteServerNotesDialog = async () => {
  const state = getState()
  const loggedIn = state.user.user.loggedIn
  if (!loggedIn) return

  setState((state) => {
    state.user.deleteServerNotesDialog = {
      open: true,
      code: '',
      codeLoading: true,
      deleteLoading: false,
    }
  })

  const res = await reqSendConfirmCode()

  setState((state) => {
    state.user.deleteServerNotesDialog.codeLoading = false
    if (isUnauthorizedRes(res)) {
      state.user.user.loggedIn = false
    }
  })
  if (!res.success) {
    notifications.show({
      title: 'Failed to send confirmation code',
      message: res.error,
      color: 'red',
    })
  } else {
    notifications.show({
      title: 'Confirmation code sent',
      message: 'Check your email for the confirmation code',
    })
  }
}

export const closeDeleteServerNotesDialog = () =>
  setState((state) => {
    if (
      state.user.deleteServerNotesDialog.deleteLoading ||
      state.user.deleteServerNotesDialog.codeLoading
    )
      return
    state.user.deleteServerNotesDialog.open = false
  })
export const deleteServerNotesCodeChanged = (code: string) =>
  setState((state) => {
    state.user.deleteServerNotesDialog.code = code
  })
export const deleteServerNotesAndGenerateNewKey = async () => {
  const state = getState()
  const {code, deleteLoading} = state.user.deleteServerNotesDialog
  const loggedIn = state.user.user.loggedIn
  if (!code || deleteLoading || !loggedIn) return

  setState((state) => {
    state.user.deleteServerNotesDialog.deleteLoading = true
  })

  const res = await reqDeleteNotes(code)

  if (!res.success) {
    setState((state) => {
      state.user.deleteServerNotesDialog.deleteLoading = false
      if (isUnauthorizedRes(res)) {
        state.user.user.loggedIn = false
      }
    })
    notifications.show({
      title: 'Failed to delete notes',
      message: res.error,
      color: 'red',
    })
    return
  }

  await setEverythingDirty(true)

  const cryptoKey = await generateKey()
  setState((state) => {
    state.user.deleteServerNotesDialog.deleteLoading = false
    state.user.deleteServerNotesDialog.open = false
    state.user.user.lastSyncedTo = 0
    state.user.user.keyTokenPair = {cryptoKey, syncToken: generateSalt(16)}
  })
  notifications.show({
    title: 'Success',
    message: 'Server notes deleted and new crypto key generated',
  })
}

export const openDeleteAccountDialog = async () => {
  const state = getState()
  const loggedIn = state.user.user.loggedIn
  if (!loggedIn) return

  setState((state) => {
    state.user.deleteAccountDialog = {open: true, code: '', codeLoading: true, deleteLoading: false}
  })

  const res = await reqSendConfirmCode()

  setState((state) => {
    state.user.deleteAccountDialog.codeLoading = false
    if (isUnauthorizedRes(res)) {
      state.user.user.loggedIn = false
    }
  })
  if (!res.success) {
    notifications.show({
      title: 'Failed to send confirmation code',
      message: res.error,
      color: 'red',
    })
  } else {
    notifications.show({
      title: 'Confirmation code sent',
      message: 'Check your email for the confirmation code',
    })
  }
}
export const closeDeleteAccountDialog = () =>
  setState((state) => {
    if (state.user.deleteAccountDialog.deleteLoading || state.user.deleteAccountDialog.codeLoading)
      return
    state.user.deleteAccountDialog.open = false
  })
export const deleteAccountCodeChanged = (code: string) =>
  setState((state) => {
    state.user.deleteAccountDialog.code = code
  })
export const deleteAccount = async () => {
  const state = getState()
  const {code, deleteLoading} = state.user.deleteAccountDialog
  const loggedIn = state.user.user.loggedIn
  if (!code || deleteLoading || !loggedIn) return

  setState((state) => {
    state.user.deleteAccountDialog.deleteLoading = true
  })

  const res = await reqDeleteAccount(code)

  setState((state) => {
    state.user.deleteAccountDialog.deleteLoading = false
  })

  if (!res.success) {
    notifications.show({
      title: 'Failed to delete account',
      message: res.error,
      color: 'red',
    })
  } else {
    notifications.show({
      title: 'Account deleted',
      message: 'Your account has been deleted',
    })
    setState((state) => {
      state.user.deleteAccountDialog.open = false
      state.user.user = {loggedIn: false, email: '', keyTokenPair: null, lastSyncedTo: 0}
    })

    await setEverythingDirty(true)
  }
}

export const toggleImprint = () =>
  setState((state) => {
    state.user.imprintOpen = !state.user.imprintOpen
  })

export const openChangeEmailDialog = () => {
  setState((state) => {
    state.user.changeEmailDialog = {
      open: true,
      email: '',
      loading: false,
      status: 'email',
      oldEmailCode: '',
      newEmailCode: '',
    }
  })
}
export const changeEmailDialogEmailChanged = (email: string) => {
  setState((state) => {
    state.user.changeEmailDialog.email = email
  })
}
export const changeEmailDialogOldEmailCodeChanged = (code: string) =>
  setState((state) => {
    state.user.changeEmailDialog.oldEmailCode = code
  })
export const changeEmailDialogNewEmailCodeChanged = (code: string) =>
  setState((state) => {
    state.user.changeEmailDialog.newEmailCode = code
  })
export const switchChangeEmailStatus = () =>
  setState((state) => {
    state.user.changeEmailDialog.status =
      state.user.changeEmailDialog.status === 'email' ? 'codes' : 'email'
  })
export const closeChangeEmailDialog = () =>
  setState((state) => {
    state.user.changeEmailDialog = userInit.changeEmailDialog
  })
export const sendChangeEmailCodes = async () => {
  const state = getState()
  const {email: newEmail, loading} = state.user.changeEmailDialog
  const oldEmail = state.user.user.email
  if (!newEmail || loading || !oldEmail) return

  setState((state) => {
    state.user.changeEmailDialog.loading = true
  })
  const res = await reqSendChangeEmailCodes({newEmail, oldEmail})
  setState((state) => {
    state.user.changeEmailDialog.loading = false
    if (!res.success) {
      notifications.show({
        title: 'Failed to send confirmation code',
        message: res.error,
        color: 'red',
      })
    } else {
      state.user.changeEmailDialog.status = 'codes'
      notifications.show({
        title: 'Confirmation code sent',
        message: 'Check both your new and old email for the confirmation codes.',
      })
    }
  })
}
export const changeEmail = async () => {
  const state = getState()
  const {email: newEmail, loading, oldEmailCode, newEmailCode} = state.user.changeEmailDialog
  const oldEmail = state.user.user.email
  if (!newEmail || loading || !oldEmail || !oldEmailCode || !newEmailCode) return

  setState((state) => {
    state.user.changeEmailDialog.loading = true
  })
  const res = await reqChangeEmail({oldEmail, oldEmailCode, newEmailCode})
  setState((state) => {
    state.user.changeEmailDialog.loading = false
    if (!res.success) {
      notifications.show({
        title: 'Failed to change email',
        message: res.error,
        color: 'red',
      })
    } else {
      state.user.user.email = newEmail
      state.user.changeEmailDialog.open = false
      notifications.show({
        title: 'Email changed',
        message: 'Your email has been changed',
      })
    }
  })
}

export const logout = async () => {
  const state = getState()
  const loggedIn = state.user.user.loggedIn
  if (!loggedIn) return
  const res = await reqLogout()
  setState((state) => {
    if (res.success || isUnauthorizedRes(res)) {
      state.user.user.loggedIn = false
      notifications.show({
        title: 'Logged out',
        message: 'You have been logged out',
      })
    } else {
      notifications.show({
        title: 'Logout Failed',
        message: res.error,
        color: 'red',
      })
    }
  })
}

export const removeAllSessions = async () => {
  const state = getState()
  const loggedIn = state.user.user.loggedIn
  if (!loggedIn) return
  const res = await reqRemoveAllSessions()
  if (!res.success) {
    notifications.show({
      title: 'Failed to remove all sessions',
      message: res.error,
      color: 'red',
    })
    if (isUnauthorizedRes(res)) {
      setState((state) => {
        state.user.user.loggedIn = false
      })
    }
  } else {
    notifications.show({
      title: 'All sessions removed',
      message: 'You have been logged out from all devices',
    })
    setState((state) => {
      state.user.user.loggedIn = false
    })
  }
}

// subscriptions
export const registerUserSubscriptions = () => {
  subscribe(
    (state) => state.user.user,
    (user) => storeUser(user)
  )
  subscribe(
    (state) => state.user.user.loggedIn,
    (loggedIn) => {
      if (loggedIn && !socket.connected) {
        socket.connect()
      } else if (!loggedIn && socket.connected) {
        socket.disconnect()
      }
    }
  )
}
