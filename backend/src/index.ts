import {createServer} from 'express-zod-api'
import {config} from './config'
import {routing} from './routing'
import {startCronJobs} from './cron'
import {createSocketServer} from './socket'
import {env, hostingMode} from './env'
import {db} from './db'
import {usersTbl} from './db/schema'
import {eq} from 'drizzle-orm'
import {hashPassword} from './util/password.js'

console.info('NODE_ENV', process.env.NODE_ENV)

startCronJobs()
const {servers} = await createServer(config, routing)
const server = servers[0]!

createSocketServer(server)

if (hostingMode === 'self' && env.ADMIN_USERNAME && env.ADMIN_PASSWORD) {
  const [user] = await db
    .select()
    .from(usersTbl)
    .where(eq(usersTbl.email, env.ADMIN_USERNAME))
    .limit(1)
  const password_hash = await hashPassword(env.ADMIN_PASSWORD)
  if (!user) {
    await db.insert(usersTbl).values({
      email: env.ADMIN_USERNAME,
      password_hash,
      is_admin: true,
    })
    console.info('Admin user created')
  } else {
    await db.update(usersTbl).set({password_hash, is_admin: true}).where(eq(usersTbl.id, user.id))
    console.info('Admin user updated')
  }
}
