import {JsonAny, JsonRoot} from './type'

export const compare = (a: any, b: any) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; ++i) {
      const _a = a[i]
      const _b = b[i]
      if (_a < _b) return -1
      else if (_a > _b) return 1
    }
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b)
  }
  return a < b ? -1 : a > b ? 1 : 0
}

export const sort = <T>(arr: Array<T>, cmp: (a: T, b: T) => number = compare) =>
  arr.slice().sort(cmp)

export const bySelector =
  <Item>(selector: (item: Item) => any) =>
  (a: Item, b: Item) =>
    compare(selector(a), selector(b))

export const byProp =
  <Key extends keyof any, Item extends {[key in Key]: any}>(key: Key, desc?: boolean) =>
  (a: Item, b: Item) =>
    desc ? compare(b[key], a[key]) : compare(a[key], b[key])

export const last = <T>(array: T[]): T | undefined => array[array.length - 1]

export const debounce = <Args extends unknown[]>(fn: (...args: Args) => unknown, delay: number) => {
  let id: ReturnType<typeof setTimeout> | undefined = undefined
  return (...args: Args): void => {
    if (id) clearTimeout(id)
    id = setTimeout(() => fn(...args), delay)
  }
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export type PromiseCancelable<T> = Promise<T> & {cancel: () => void}

export const setTimeoutPromise = <Fn extends (...args: any[]) => any, AbortValue>(
  fn: Fn,
  timeout: number,
  abortValue: AbortValue,
  ...args: Parameters<Fn>
): PromiseCancelable<Awaited<ReturnType<Fn>>> => {
  type Ret = Awaited<ReturnType<Fn>>
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined
  let cancel = () => {}
  const promise = new Promise<Ret>((resolve, reject) => {
    cancel = () => {
      clearTimeout(timeoutId)
      reject(abortValue)
    }
    timeoutId = setTimeout(() => {
      Promise.resolve()
        .then(() => fn(...args))
        .then((res) => resolve(res))
        .catch((err) => reject(err))
    }, timeout)
  }) as PromiseCancelable<Ret>
  promise.cancel = cancel
  return promise
}

export const debouncePromise = <Fn extends (...args: any[]) => any, AbortValue>(
  fn: Fn,
  timeout: number,
  abortValue: AbortValue
) => {
  type Ret = Awaited<ReturnType<Fn>>
  let promise = {cancel: () => {}}
  return (...args: Parameters<Fn>): PromiseCancelable<Ret> => {
    promise.cancel()
    return (promise = setTimeoutPromise(fn, timeout, abortValue, ...args))
  }
}

export const getUniqueBy = <T>(array: T[], getKey: (el: T) => string) => {
  return array.reduce(uniqueByReducer<T>(getKey), [] as T[])
}

const uniqueByReducer = <T>(getKey: (el: T) => string) => {
  const set = new Set<string>()
  return (prev: T[], curr: T) => {
    const key = getKey(curr)
    if (set.has(key)) {
      return prev
    }
    set.add(key)
    prev.push(curr)
    return prev
  }
}

export function log<T>(x: T): T {
  console.info(x)
  return x
}

/**
 * Calls {fn} immediately when the returned function is called, after that at most once per {timeout}.
 */
export const throttle = <Args extends any[]>(fn: (...args: Args) => unknown, timeout: number) => {
  let pending = false
  let waiting = false
  let lastArgs: Args
  const wait = () =>
    delay(timeout).then(() => {
      if (pending) {
        pending = false
        fn(...lastArgs)
        wait()
      } else {
        waiting = false
      }
    })
  return (...args: Args) => {
    lastArgs = args
    if (pending) return
    if (waiting) {
      pending = true
      return
    }
    waiting = true
    Promise.resolve().then(() => fn(...args))
    wait()
  }
}

export const indexBy = <T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Map<K, T> => {
  const map = new Map<K, T>()
  for (const item of arr) {
    map.set(keyFn(item), item)
  }
  return map
}

export const indexByProp = <T, K extends keyof T>(arr: T[], key: K): Map<T[K], T> => {
  const map = new Map<T[K], T>()
  for (const item of arr) {
    map.set(item[key], item)
  }
  return map
}

export const downloadJson = (data: JsonRoot, filename = 'data.json') => {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], {type: 'application/json'})
  downloadBlob(blob, filename)
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const androidDownloader = (globalThis as any)?.AndroidDownloader
  if (androidDownloader && typeof androidDownloader.saveBase64 === 'function') {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        androidDownloader.saveBase64(result, filename)
      }
    }
    reader.readAsDataURL(blob)
    return
  }

  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const safeJsonParse = (str: string): unknown => {
  try {
    return JSON.parse(str)
  } catch {
    return undefined
  }
}

/**
 * Value types are compared with Object.is.
 * For Objects and Arrays the properties are compared with deepEquals.
 * deepEquals({ 0: 'a', 1: 'b' }, [ 'a', 'b' ]) returns true
 */
export const deepEquals = (
  a: unknown,
  b: unknown,
  ignoreProps: string[] = [],
  prop: string | null = null
): boolean => {
  if (prop !== null && ignoreProps.includes(prop)) return true
  if (typeof a !== typeof b) return false
  if (
    a === undefined ||
    b === undefined ||
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return Object.is(a, b)
  }
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false

  for (const k of ak) {
    if (!deepEquals((a as any)[k], (b as any)[k], ignoreProps, k)) {
      return false
    }
  }
  return true
}

export const truncateWithEllipsis = (txt: string, maxLines = 5, maxChars = 200) => {
  const lines = txt.split('\n')
  let ellipsis: boolean = false
  if (lines.length > maxLines) {
    txt = lines.slice(0, maxLines).join('\n')
    ellipsis = true
  }
  if (txt.length > maxChars) {
    txt = txt.slice(0, maxChars)
    ellipsis = true
  }
  if (ellipsis) {
    txt += '...'
  }
  return txt
}

export const nonConcurrent = (fn: () => Promise<void>): (() => Promise<void>) => {
  let running = false
  let pending = false
  let promise: Promise<void> = Promise.resolve()

  async function execute() {
    if (running) {
      pending = true
      return promise
    }
    running = true
    try {
      await fn()
    } finally {
      running = false
    }
    if (pending) {
      pending = false
      promise = execute()
      await promise
    }
  }
  return () => {
    promise = execute()
    return promise
  }
}

export const bisectBy = <T>(arr: T[], pred: (x: T) => boolean): readonly [T[], T[]] => {
  const ts: T[] = []
  const fs: T[] = []
  for (const x of arr) {
    if (pred(x)) {
      ts.push(x)
    } else {
      fs.push(x)
    }
  }
  return [ts, fs]
}

export const partitionBy = <T, Key extends string>(
  arr: T[],
  keyFn: (x: T) => Key
): Partial<Record<Key, T[]>> => {
  const res: Partial<Record<Key, T[]>> = {}
  for (const x of arr) {
    const key = keyFn(x)
    res[key] = res[key] ?? []
    res[key].push(x)
  }
  return res
}

export const getColorScheme = () => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const moveWithinListViaDnD = <Item>(
  list: Item[],
  dragIndex: number,
  dropIndex: number,
  closestEdge: 'top' | 'bottom'
) => {
  const movingForward = dragIndex < dropIndex
  const goingAfter = closestEdge === 'bottom'
  let targetIndex = 0
  if (movingForward) {
    targetIndex = goingAfter ? dropIndex : dropIndex - 1
  } else {
    targetIndex = goingAfter ? dropIndex + 1 : dropIndex
  }
  const [item] = list.splice(dragIndex, 1)
  if (item) {
    list.splice(targetIndex, 0, item)
  }
}

export const findIndex = <T>(arr: T[], pred: (x: T) => boolean): number | null => {
  const index = arr.findIndex(pred)
  return index === -1 ? null : index
}

export const splitFilename = (filename: string): [string, string] => {
  const i = filename.lastIndexOf('.')
  if (i === -1) {
    return [filename, '']
  }
  return [filename.slice(0, i), filename.slice(i)]
}

export const takeJsonSize = <T extends JsonAny>(arr: T[], limit: number): T[] => {
  let totalSize = 2
  const res: T[] = []
  for (const item of arr) {
    const size = 1 + JSON.stringify(item).length
    if (totalSize + size > limit) {
      break
    }
    res.push(item)
    totalSize += size
  }
  return res
}

export const takeSum = <T>(arr: T[], limit: number, getSize: (x: T) => number): T[] => {
  if (arr.length === 0) return []
  let totalSize = 0
  const res: T[] = []
  for (const item of arr) {
    const size = getSize(item)
    if (totalSize + size > limit) {
      break
    }
    res.push(item)
    totalSize += size
  }
  return res
}

export function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number
): {start: number; end: number} | null {
  if (!rangeHeader) return null
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match || !match[1]) return null

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1

  if (start >= fileSize || end >= fileSize || start > end) {
    return null
  }

  return {start, end}
}

export const formatDateTime = (date: string | number | Date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const localTime = d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})
  return `${year}-${month}-${day} ${localTime}`
}
