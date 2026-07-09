import {drizzle} from 'drizzle-orm/node-postgres'
import pg from 'pg'
import {env} from '../env'

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
})

const getSql = (queryArg: unknown) =>
  typeof queryArg === 'string' ? queryArg
  : queryArg && typeof queryArg === 'object' && 'text' in queryArg ? String(queryArg.text)
  : '<unknown>'

const wrapQuery = <Query extends (...args: any[]) => any>(query: Query): Query =>
  ((...args: any[]) => {
    const start = performance.now()
    const sql = getSql(args[0])
    const logDuration = () => {
      const durationMs = performance.now() - start
      console.info(`db.query duration: ${Number(durationMs.toFixed(1))} ms, sql: ${sql}`)
    }
    const lastArg = args[args.length - 1]

    if (typeof lastArg === 'function') {
      args[args.length - 1] = (...callbackArgs: any[]) => {
        logDuration()
        return lastArg(...callbackArgs)
      }
      try {
        return query(...args)
      } catch (err) {
        logDuration()
        throw err
      }
    }

    try {
      const res = query(...args)
      if (res && typeof res === 'object' && 'finally' in res && typeof res.finally === 'function') {
        return res.finally(logDuration)
      }
      return res
    } catch (err) {
      logDuration()
      throw err
    }
  }) as Query

const wrappedClients = new WeakSet<object>()
const wrapClient = <Client extends {query: (...args: any[]) => any}>(client: Client): Client => {
  if (!wrappedClients.has(client)) {
    wrappedClients.add(client)
    client.query = wrapQuery(client.query.bind(client))
  }
  return client
}

const originalConnect = pool.connect.bind(pool) as any
pool.connect = ((...args: any[]) => {
  const start = performance.now()
  const lastArg = args[args.length - 1]
  const logDuration = () => {
    const durationMs = performance.now() - start
    console.info(`db.connect duration: ${Number(durationMs.toFixed(1))} ms`)
  }

  if (typeof lastArg === 'function') {
    args[args.length - 1] = (err: Error | undefined, client: any, done: any) => {
      logDuration()
      if (client) {
        wrapClient(client)
      }
      return lastArg(err, client, done)
    }
    return originalConnect(...args)
  }

  return originalConnect(...args).then((client: any) => {
    logDuration()
    return wrapClient(client)
  })
}) as typeof pool.connect

export const db = drizzle(pool)
