import createHttpError from 'http-errors'
import {env} from '../env'
import {SESClient, SendEmailCommand} from '@aws-sdk/client-ses'

const ses: SESClient | null =
  env.AWS_ACCESS_KEY_ID && env.AWS_ACCESS_KEY_SECRET && env.AWS_REGION
    ? new SESClient({
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_ACCESS_KEY_SECRET,
        },
      })
    : null

const impressum = `Raphael Nußbaumer BSc
Address: Sohlstraße 3, 6845 Hohenems, Austria
Email: raphaeln@outlook.com`

export const sendMail = async (to: string, subject: string, text: string, html?: string) => {
  if (!ses) {
    console.info('EMAIL:', {to, subject, text, html})
    return
  }

  const command = new SendEmailCommand({
    Source: env.MAIL_FROM,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {Data: subject},
      Body: {
        Text: {Data: text},
        ...(html && {Html: {Data: html}}),
      },
    },
  })

  const response = await ses.send(command)
  if (response.MessageId) {
    return
  }
  throw createHttpError(500, 'Failed to send email: ' + JSON.stringify(response.$metadata))
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
