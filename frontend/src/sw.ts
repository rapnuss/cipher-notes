/// <reference lib="webworker" />
import {cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute} from 'workbox-precaching'
import {clientsClaim} from 'workbox-core'
import {NavigationRoute, registerRoute} from 'workbox-routing'
import {NetworkOnly} from 'workbox-strategies'
import {db} from './db'
import {parseRangeHeader} from './util/misc'

declare let self: ServiceWorkerGlobalScope

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

{
  let lastId: string | undefined = undefined
  let lastBlob: Blob | undefined = undefined

  registerRoute(
    ({url, request}) =>
      request.method === 'GET' &&
      url.origin === self.location.origin &&
      url.pathname.startsWith('/files/'),
    async ({url, request}) => {
      const id = url.pathname.replace(/^\/files\//, '')
      if (!id) {
        return new Response('Bad Request', {status: 400})
      }
      const blob = lastId === id ? lastBlob : (await db.files_blob.get(id))?.blob
      if (!blob) {
        return new Response('Not found', {status: 404})
      }
      lastId = id
      lastBlob = blob
      // support range requests for Safari
      const range = parseRangeHeader(request.headers.get('range'), blob.size)
      if (range) {
        const {start, end} = range
        const chunk = blob.slice(start, end + 1)
        const headers = new Headers({
          'Content-Type': blob.type,
          'Content-Range': `bytes ${start}-${end}/${blob.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (end - start + 1).toString(),
        })
        return new Response(chunk, {status: 206, headers})
      }
      const headers = new Headers({
        'Content-Type': blob.type,
        'Accept-Ranges': 'bytes',
        'Content-Length': blob.size.toString(),
      })
      return new Response(blob, {headers})
    }
  )
}

registerRoute(
  ({url, request}) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/thumbnails/'),
  async ({url}) => {
    const id = url.pathname.replace(/^\/thumbnails\//, '')
    const thumb = await db.files_thumb.get(id)
    if (thumb) {
      return new Response(thumb.blob, {headers: {'Content-Type': thumb.blob.type}})
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
