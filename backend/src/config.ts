import {createConfig} from 'express-zod-api'
import {env} from './env'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import express, {Application} from 'express'

export const config = createConfig({
  http: {
    listen: env.PORT,
  },
  cors: false,
  jsonParser: express.json({limit: env.LIMIT_JSON}),
  rawParser: express.raw({limit: env.LIMIT_RAW}),
  upload: false,
  beforeRouting: ({app}) => {
    ;(app as Application).set('trust proxy', JSON.parse(env.TRUST_PROXY)) // number of proxies between user and server
    app.use(
      rateLimit({
        limit: Number(env.RATE_LIMIT),
        windowMs: Number(env.RATE_WINDOW_SEC) * 1000,
        handler: (_, res) => {
          res.status(429).json({
            success: false,
            error: 'Too many requests',
            statusCode: 429,
          })
        },
      })
    )
    app.use(cookieParser(env.COOKIE_SECRET))
  },
  startupLogo: false,
})
