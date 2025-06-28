import createHttpError from 'http-errors'
import {env} from '../env'
import sg from '@sendgrid/mail'

sg.setApiKey(env.SENDGRID_API_KEY)

const impressum = `Raphael Nußbaumer BSc
Address: Sohlstraße 3, 6845 Hohenems, Austria
Email: raphaeln@outlook.com`

export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  if (env.SENDGRID_API_KEY === 'DEV') {
    console.info('EMAIL:', {to, subject, text, html})
    return
  }
  const [res] = await sg.send({to, subject, text, html, from: 'raphaeln@outlook.com'})
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw createHttpError(500, 'Failed to send email')
  }
}

export const sendLoginCode = async (to: string, code: string) => {
  return await sendMail(
    to,
    'ciphernotes login code',
    `Your login code is: ${code}\n\n${impressum}`,
    `<p>Your login code is: <b>${code}</b></p>
      <p></p>
      <pre>${impressum}</pre>`
  )
}

export const sendConfirmCode = async (to: string, code: string) => {
  return await sendMail(
    to,
    'ciphernotes confirm code',
    `Your confirm code is: ${code}\n\n${impressum}`,
    `<p>Your confirm code is: <b>${code}</b></p>
      <p></p>
      <pre>${impressum}</pre>`
  )
}
