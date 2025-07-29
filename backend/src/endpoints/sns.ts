import {endpointsFactory} from '../endpointsFactory'
import {z} from 'zod'
import {db} from '../db'
import {usersTbl} from '../db/schema'
import {eq} from 'drizzle-orm'
import {SNSClient, ConfirmSubscriptionCommand} from '@aws-sdk/client-sns'
import {env} from '../env'
import MessageValidator from 'sns-validator'

// SNS message types
const snsMessageSchema = z.object({
  Type: z.string(),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  SignatureVersion: z.string(),
  Signature: z.string(),
  SigningCertURL: z.string(),
})

// SES bounce notification schema
const sesBounceSchema = z.object({
  bounceType: z.string(),
  bounceSubType: z.string(),
  bouncedRecipients: z.array(
    z.object({
      emailAddress: z.string(),
      action: z.string().optional(),
      status: z.string().optional(),
      diagnosticCode: z.string().optional(),
    })
  ),
  timestamp: z.string(),
  feedbackId: z.string(),
  reportingMTA: z.string().optional(),
})

// SES complaint notification schema
const sesComplaintSchema = z.object({
  complainedRecipients: z.array(
    z.object({
      emailAddress: z.string(),
    })
  ),
  timestamp: z.string(),
  feedbackId: z.string(),
  userAgent: z.string().optional(),
  complaintFeedbackType: z.string().optional(),
  arrivalDate: z.string().optional(),
})

// SNS subscription confirmation schema
const snsSubscriptionConfirmationSchema = z.object({
  Type: z.literal('SubscriptionConfirmation'),
  MessageId: z.string(),
  Token: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  SubscribeURL: z.string(),
  Timestamp: z.string(),
  SignatureVersion: z.string(),
  Signature: z.string(),
  SigningCertURL: z.string(),
})

// Initialize SNS client
const snsClient = new SNSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_ACCESS_KEY_SECRET,
  },
})

const validator = new MessageValidator()

const verifySNSMessage = (message: any): Promise<void> =>
  new Promise((resolve, reject) => {
    validator.validate(message, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })

export const snsEndpoint = endpointsFactory.build({
  method: 'post',
  input: snsMessageSchema,
  output: z.object({
    status: z.string(),
  }),
  handler: async ({input, logger}) => {
    const snsMessage = input

    await verifySNSMessage(snsMessage)

    // Handle subscription confirmation
    if (snsMessage.Type === 'SubscriptionConfirmation') {
      const subscriptionData = snsSubscriptionConfirmationSchema.parse(input)
      logger.info('SNS Subscription confirmation received:', subscriptionData.MessageId)

      try {
        // Confirm the subscription using AWS SDK
        const command = new ConfirmSubscriptionCommand({
          TopicArn: subscriptionData.TopicArn,
          Token: subscriptionData.Token,
        })
        await snsClient.send(command)
        logger.info('SNS subscription confirmed successfully')
      } catch (error) {
        logger.error('Failed to confirm SNS subscription:', error)
        // Don't throw here as the subscription might already be confirmed
      }

      return {status: 'Subscription confirmation received and processed'}
    }

    // Handle notification messages
    if (snsMessage.Type === 'Notification') {
      const messageData = JSON.parse(snsMessage.Message)

      // Check if this is an SES notification
      if (messageData.notificationType === 'Bounce') {
        const bounceData = sesBounceSchema.parse(messageData.bounce)

        // Handle bounce notifications
        for (const recipient of bounceData.bouncedRecipients) {
          logger.info(
            `Bounce for email: ${recipient.emailAddress}, Type: ${bounceData.bounceType}, SubType: ${bounceData.bounceSubType}`
          )

          // If it's a permanent bounce, you might want to mark the user as inactive
          if (bounceData.bounceType === 'Permanent') {
            // Find user by email and mark as inactive or delete
            const [user] = await db
              .select()
              .from(usersTbl)
              .where(eq(usersTbl.email, recipient.emailAddress))
              .limit(1)

            if (user) {
              logger.info(`Marking user ${user.id} as inactive due to permanent bounce`)
              await db.update(usersTbl).set({is_active: false}).where(eq(usersTbl.id, user.id))
            }
          }
        }
      } else if (messageData.notificationType === 'Complaint') {
        const complaintData = sesComplaintSchema.parse(messageData.complaint)

        // Handle complaint notifications
        for (const recipient of complaintData.complainedRecipients) {
          logger.info(`Complaint for email: ${recipient.emailAddress}`)

          // Find user by email and mark as inactive or delete
          const [user] = await db
            .select()
            .from(usersTbl)
            .where(eq(usersTbl.email, recipient.emailAddress))
            .limit(1)

          if (user) {
            logger.info(`Marking user ${user.id} as inactive due to complaint`)
            await db.update(usersTbl).set({is_active: false}).where(eq(usersTbl.id, user.id))
          }
        }
      }

      return {status: 'Notification processed'}
    }

    return {status: 'Unknown message type'}
  },
})
