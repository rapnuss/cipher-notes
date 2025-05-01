import {Routing} from 'express-zod-api'
import {helloEndpoint} from './endpoints/hello'
import {
  loginWithCodeEndpoint,
  sendLoginCodeEndpoint,
  registerEmailEndpoint,
} from './endpoints/login'
import {syncNotesEndpoint} from './endpoints/syncNotes'
import {deleteNotesEndpoint} from './endpoints/deleteNotes'
import {sendConfirmCodeEndpoint} from './endpoints/sendConfirmCode'
import {logoutEndpoint} from './endpoints/logout'
import {changeEmailEndpoint, sendChangeEmailCodesEndpoint} from './endpoints/changeEmail'

export const routing: Routing = {
  hello: helloEndpoint,
  registerEmail: registerEmailEndpoint,
  sendLoginCode: sendLoginCodeEndpoint,
  loginWithCode: loginWithCodeEndpoint,
  syncNotes: syncNotesEndpoint,
  deleteNotes: deleteNotesEndpoint,
  sendConfirmCode: sendConfirmCodeEndpoint,
  logout: logoutEndpoint,
  sendChangeEmailCodes: sendChangeEmailCodesEndpoint,
  changeEmail: changeEmailEndpoint,
}
