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
} from '../services/backend'
import {loadUser, storeUser} from '../services/localStorage'
import {getState, setState, subscribe} from './store'
import {calcChecksum, isValidKeyTokenPair} from '../business/notesEncryption'
import {generateKey, generateSalt} from '../util/encryption'
import {db} from '../db'
import socket from '../socket'
import {notifications} from '@mantine/notifications'

export type UserState = {
  user: {
    email: string
    loggedIn: boolean
    lastSyncedTo: number
    keyTokenPair: {cryptoKey: string; syncToken: string} | null
  }
  connected: boolean
  registerDialog: {open: boolean; email: string; loading: boolean}
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
    visible: boolean
    qrMode: 'hide' | 'show' | 'scan'
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
  connected: false,
  registerDialog: {open: false, email: '', loading: false},
  loginDialog: {open: false, email: '', code: '', loading: false, status: 'email'},
  encryptionKeyDialog: {open: false, keyTokenPair: '', visible: false, qrMode: 'hide'},
  deleteServerNotesDialog: {open: false, code: '', codeLoading: false, deleteLoading: false},
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
    setState((state) => {
      state.user.user = user
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

export const registerEmailChanged = (email: string) => {
  setState((state) => {
    state.user.registerDialog.email = email
  })
}
export const openRegisterDialog = () => {
  setState((state) => {
    state.user.registerDialog = {open: true, email: state.user.user.email, loading: false}
  })
}
export const closeRegisterDialog = () => {
  setState((state) => {
    state.user.registerDialog.open = false
  })
}
export const registerEmail = async (captchaToken: string) => {
  const state = getState()
  const {email, loading} = state.user.registerDialog
  if (!email || loading) return
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
      notifications.show({
        title: 'Success',
        message: 'You are logged in',
      })
      state.user.loginDialog.open = false
    }
  })
}

export const socketConnectionChanged = (connected: boolean) => {
  setState((state) => {
    state.user.connected = connected
  })
}

export const openEncryptionKeyDialog = async () => {
  const state = getState()
  let keyTokenPair = state.user.user.keyTokenPair
  if (!keyTokenPair) {
    keyTokenPair = {cryptoKey: await generateKey(), syncToken: generateSalt(16)}
  }
  setState((state) => {
    const checksum = calcChecksum(keyTokenPair.cryptoKey, keyTokenPair.syncToken)
    state.user.encryptionKeyDialog = {
      open: true,
      keyTokenPair: `${keyTokenPair.cryptoKey}:${keyTokenPair.syncToken}:${checksum}`,
      visible: false,
      qrMode: 'hide',
    }
  })
}
export const toggleEncryptionKeyDialogVisibility = () => {
  setState((state) => {
    state.user.encryptionKeyDialog.visible = !state.user.encryptionKeyDialog.visible
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
  if (!isValidKeyTokenPair(keyTokenPair)) return
  const [cryptoKey, syncToken] = keyTokenPair.split(':')
  if (!cryptoKey || !syncToken) return

  const oldKeyTokenPair = getState().user.user.keyTokenPair
  const isNewKey =
    oldKeyTokenPair?.cryptoKey !== cryptoKey || oldKeyTokenPair?.syncToken !== syncToken
  if (isNewKey) {
    const deletedNoteIds = await db.notes.where('deleted_at').notEqual(0).primaryKeys()
    await db.notes.bulkDelete(deletedNoteIds)

    const keys = await db.notes.toCollection().primaryKeys()
    await db.notes.bulkUpdate(keys.map((key) => ({key, changes: {state: 'dirty'}})))
  }
  setState((state) => {
    if (isNewKey) {
      state.user.user.lastSyncedTo = 0
      state.user.user.keyTokenPair = {cryptoKey, syncToken}
    }
    state.user.encryptionKeyDialog.open = false
  })
}

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

  const deletedNotes = await db.notes.where('deleted_at').notEqual(0).toArray()
  await db.notes.bulkDelete(deletedNotes.map((note) => note.id))

  const keys = await db.notes.toCollection().primaryKeys()
  await db.notes.bulkUpdate(keys.map((key) => ({key, changes: {state: 'dirty'}})))

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
    } else {
      notifications.show({
        title: 'Logout Failed',
        message: res.error,
        color: 'red',
      })
    }
  })
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
