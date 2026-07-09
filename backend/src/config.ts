import {createConfig} from 'express-zod-api'
import {env} from './env'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import express, {Application, NextFunction, Request, Response} from 'express'

export const config = createConfig({
  http: {
    listen: env.PORT,
  },
  cors: false,
  jsonParser: express.json({limit: env.LIMIT_JSON}),
  rawParser: express.raw({limit: env.LIMIT_RAW}),
  upload: false,
  logger: {
    level: 'debug',
    color: true,
  },
  beforeRouting: ({app}) => {
    ;(app as Application).set('trust proxy', JSON.parse(env.TRUST_PROXY)) // number of proxies between user and server
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = performance.now()
      res.on('finish', () => {
        const duration = performance.now() - start
        console.log(`[${req.method}] ${req.originalUrl} - ${duration.toFixed(1)}ms`)
      })
      next()
    })
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
      }),
    )
    app.use(cookieParser(env.COOKIE_SECRET))
    app.get('/ip', (req, res) => {
      res.send(req.ip)
    })
  },
  startupLogo: false,
})
