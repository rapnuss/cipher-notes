import {backendUrl, backendTimeout} from '../config'
import {fetchJson} from '../util/fetch'
import {Overwrite} from '../util/type'

export type ResPos<D> = {
  success: true
  data: D
}
export type ResNeg = {
  success: false
  error: string
  statusCode: number
}
export type Res<D> = ResPos<D> | ResNeg

export const request = async <D>(
  path: string,
  options: Overwrite<RequestInit, {body?: BodyInit | object}> = {},
  timeout: number = backendTimeout,
  abortController: AbortController = new AbortController()
): Promise<Res<D>> => {
  if (typeof options.body === 'object') {
    options.body = JSON.stringify(options.body)
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    }
  }
  options.credentials = 'include'
  try {
    return await fetchJson<Res<D>>(
      backendUrl + path,
      options as RequestInit,
      timeout,
      abortController
    )
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      statusCode: -1,
    }
  }
}

export const reqRegisterEmail = (email: string, captchaToken: string) =>
  request<void>('/registerEmail', {
    method: 'POST',
    body: {email, captcha_token: captchaToken},
  })

export const reqSendLoginCode = (email: string) =>
  request<void>('/sendLoginCode', {method: 'POST', body: {email}})

export const reqLoginWithCode = (email: string, code: string) =>
  request<{jwt: string}>('/loginWithCode', {
    method: 'POST',
    body: {email, login_code: code},
  })

export const reqLoginWithPassword = (identifier: string, password: string) =>
  request<{jwt: string}>('/loginWithPassword', {
    method: 'POST',
    body: {identifier, password},
  })

export const reqAdminCreateUser = (username: string, password: string) =>
  request<void>('/adminCreateUser', {method: 'POST', body: {username, password}})

export const reqAdminSetPassword = (
  targetIdentifier: string,
  newPassword: string,
  adminPassword: string
) =>
  request<void>('/adminSetPassword', {
    method: 'POST',
    body: {
      target_identifier: targetIdentifier,
      new_password: newPassword,
      admin_password: adminPassword,
    },
  })

type EncUpsertPut = {
  id: string
  type: 'note' | 'todo' | 'label' | 'file'
  created_at: number
  updated_at: number
  cipher_text: string
  iv: string
  version: number
  deleted_at: null
}
export type EncPut =
  | EncUpsertPut
  | {
      id: string
      type: 'note' | 'todo' | 'label' | 'file'
      created_at: number
      updated_at: number
      cipher_text: null
      iv: null
      version: number
      deleted_at: number
    }

export type EncSyncRes = {puts: EncPut[]; synced_to: number; conflicts: EncPut[]}

export const reqSyncNotes = (lastSyncedTo: number, puts: EncPut[], syncToken: string) =>
  request<EncSyncRes>('/syncNotes', {
    method: 'POST',
    body: {last_synced_to: lastSyncedTo, sync_token: syncToken, puts},
  })

export const reqDeleteNotes = (confirm: string) =>
  request<void>('/deleteNotes', {
    method: 'POST',
    body: {confirm},
  })

export const reqDeleteAccount = (confirm: string) =>
  request<void>('/deleteAccount', {
    method: 'POST',
    body: {confirm},
  })

export const reqSendConfirmCode = () =>
  request<void>('/sendConfirmCode', {
    method: 'POST',
  })

export const reqLogout = () => request<void>('/logout', {method: 'POST'})

export const reqRemoveAllSessions = () => request<void>('/removeAllSessions', {method: 'POST'})

export const isUnauthorizedRes = (res: Res<unknown>) => !res.success && res.statusCode === 401

export const reqSendChangeEmailCodes = ({
  newEmail,
  oldEmail,
}: {
  newEmail: string
  oldEmail: string
}) =>
  request<void>('/sendChangeEmailCodes', {
    method: 'POST',
    body: {new_email: newEmail, old_email: oldEmail},
  })

export const reqChangeEmail = ({
  oldEmail,
  oldEmailCode,
  newEmailCode,
}: {
  oldEmail: string
  oldEmailCode: string
  newEmailCode: string
}) =>
  request<void>('/changeEmail', {
    method: 'POST',
    body: {
      old_email: oldEmail,
      old_email_code: oldEmailCode,
      new_email_code: newEmailCode,
    },
  })

export type GetPresignedUrlsReq = {
  uploads: {id: string; size: number}[]
  download_ids: string[]
}
export type GetPresignedUrlsRes = {
  upload_urls: {note_id: string; url: string; fields: Record<string, string>}[]
  download_urls: {note_id: string; url: string}[]
  hit_storage_limit: boolean
}
export const reqGetPresignedUrls = (req: GetPresignedUrlsReq) =>
  request<GetPresignedUrlsRes>('/getPresignedUrls', {
    method: 'POST',
    body: req,
  })

export const reqStorageUsage = () =>
  request<{files: {used: number; limit: number}; notes: {used: number; limit: number}}>(
    '/storageUsage',
    {method: 'GET'}
  )
