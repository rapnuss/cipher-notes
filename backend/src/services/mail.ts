import {env} from '../env'

const mailjetSendUrl = 'https://api.mailjet.com/v3.1/send'
const timeoutMs = 7_000

const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  if (!env.MJ_APIKEY_PUBLIC || !env.MJ_APIKEY_PRIVATE) {
    console.info('EMAIL:', {to, subject, text, html})
    return
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)
  const res = await fetch(mailjetSendUrl, {
    method: 'POST',
    signal: abortController.signal,
    headers: {
      Authorization: `Basic ${btoa(`${env.MJ_APIKEY_PUBLIC}:${env.MJ_APIKEY_PRIVATE}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
  }).finally(() => clearTimeout(timeout))
  if (!res.ok) {
    throw new Error(`Mailjet send failed: ${res.status} ${await res.text()}`)
  }
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
    `<p>Your login code is: <b>${code}</b><br/><br/></p><pre>${impressum}</pre>`,
  )
}

export const sendConfirmCode = async (to: string, code: string) => {
  return await sendMail(
    to,
    'ciphernotes confirm code',
    `Your confirm code is: ${code}\n\n${impressum}`,
    `<p>Your confirm code is: <b>${code}</b><br/><br/></p><pre>${impressum}</pre>`,
  )
}
