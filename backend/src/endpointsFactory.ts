import {EndpointsFactory, ensureHttpError, ResultHandler} from 'express-zod-api'
import {authMiddleware} from './middleware'
import {z} from 'zod'
import {env} from './env'

const resultHandler = new ResultHandler({
  positive: (data) => ({
    schema: z.object({success: z.literal(true), data}),
    mimeType: 'application/json',
  }),
  negative: z.object({success: z.literal(false), error: z.string(), statusCode: z.number()}),
  handler: ({error, output, response, logger}) => {
    if (error) {
      logger.error(error.stack ?? error.toString())
      const {statusCode, message} = ensureHttpError(error)
      return void response.status(statusCode).json({
        success: false,
        error: statusCode === 500 ? 'Internal Server Error' : message,
        statusCode,
      })
    }
    const {access_token, session_id, remove_session_cookie, ...rest} = output ?? {}
    if (typeof access_token === 'string' && typeof session_id === 'number') {
      response.cookie(
        'session',
        {access_token, session_id},
        {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          maxAge: 1000 * 60 * Number(env.SESSION_TTL_MIN),
          sameSite: 'strict',
          signed: true,
        }
      )
    } else if (remove_session_cookie) {
      response.clearCookie('session')
    }
    response.status(200).json({success: true, data: output == null ? null : (rest as any)})
  },
})

export const endpointsFactory = new EndpointsFactory(resultHandler)

export const authEndpointsFactory = endpointsFactory.addMiddleware(authMiddleware)
