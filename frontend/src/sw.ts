/// <reference lib="webworker" />
import {cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute} from 'workbox-precaching'
import {clientsClaim} from 'workbox-core'
import {NavigationRoute, registerRoute} from 'workbox-routing'
import {NetworkOnly} from 'workbox-strategies'
import {db} from './db'

declare let self: ServiceWorkerGlobalScope

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

registerRoute(
  ({url, request}) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/files/'),
  async ({url}) => {
    const id = url.pathname.replace(/^\/files\//, '')
    const file = await db.files_blob.get(id)
    if (file && file.blob) {
      return new Response(file.blob, {headers: {'Content-Type': file.blob.type}})
    }
    return new Response('Not found', {status: 404})
  }
)

registerRoute(({url}) => url.pathname.startsWith('/api'), new NetworkOnly())

let allowlist: RegExp[] | undefined
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV) allowlist = [/^\/$/]
// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {allowlist}))

self.skipWaiting()
clientsClaim()
