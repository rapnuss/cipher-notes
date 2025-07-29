import {env} from '../env'
import Mailjet from 'node-mailjet'

const mailjet =
  env.MJ_APIKEY_PUBLIC && env.MJ_APIKEY_PRIVATE
    ? new Mailjet({
        apiKey: env.MJ_APIKEY_PUBLIC,
        apiSecret: env.MJ_APIKEY_PRIVATE,
      })
    : null

const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  if (!mailjet) {
    console.info('EMAIL:', {to, subject, text, html})
    return
  }

  await mailjet.post('send', {version: 'v3.1'}).request({
    Messages: [
      {
        From: {
          Email: env.MAIL_FROM,
          Name: 'Raphael Nußbaumer BSc',
        },
        To: [{Email: to}],
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
      },
    ],
  })
}

const impressum = `
Raphael Nußbaumer BSc

Sohlstraße 3
6845 Hohenems
Austria

raphaeln@outlook.com
https://ciphernotes.com
`.trim()

export const sendLoginCode = async (to: string, code: string) => {
  return await sendMail(
    to,
    'ciphernotes login code',
    `Your login code is: ${code}\n\n${impressum}`,
    `<p>Your login code is: <b>${code}</b><br/><br/></p><pre>${impressum}</pre>`
  )
}

export const sendConfirmCode = async (to: string, code: string) => {
  return await sendMail(
    to,
    'ciphernotes confirm code',
    `Your confirm code is: ${code}\n\n${impressum}`,
    `<p>Your confirm code is: <b>${code}</b><br/><br/></p><pre>${impressum}</pre>`
  )
}
