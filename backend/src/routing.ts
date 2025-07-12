import {Routing} from 'express-zod-api'
import {helloEndpoint} from './endpoints/hello'
import {
  loginWithCodeEndpoint,
  sendLoginCodeEndpoint,
  registerEmailEndpoint,
} from './endpoints/login'
import {syncNotesEndpoint} from './endpoints/syncNotes'
import {deleteAccountEndpoint, deleteNotesEndpoint} from './endpoints/deleteNotes'
import {sendConfirmCodeEndpoint} from './endpoints/sendConfirmCode'
import {logoutEndpoint, removeAllSessionsEndpoint} from './endpoints/logout'
import {changeEmailEndpoint, sendChangeEmailCodesEndpoint} from './endpoints/changeEmail'
import {getDownloadUrlsEndpoint, getUploadUrlsEndpoint} from './endpoints/files'

export const routing: Routing = {
  hello: helloEndpoint,
  registerEmail: registerEmailEndpoint,
  sendLoginCode: sendLoginCodeEndpoint,
  loginWithCode: loginWithCodeEndpoint,
  syncNotes: syncNotesEndpoint,
  deleteNotes: deleteNotesEndpoint,
  deleteAccount: deleteAccountEndpoint,
  sendConfirmCode: sendConfirmCodeEndpoint,
  logout: logoutEndpoint,
  removeAllSessions: removeAllSessionsEndpoint,
  sendChangeEmailCodes: sendChangeEmailCodesEndpoint,
  changeEmail: changeEmailEndpoint,
  getUploadUrls: getUploadUrlsEndpoint,
  getDownloadUrls: getDownloadUrlsEndpoint,
}
