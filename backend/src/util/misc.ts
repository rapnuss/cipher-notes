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

export const parseCookieHeader = (
  cookieHeader: string | undefined | null
): Record<string, string> => {
  if (!cookieHeader) {
    return {}
  }
  return cookieHeader.split('; ').reduce((acc, row) => {
    const [key, value] = row.split('=')
    if (!key || !value) {
      return acc
    }
    acc[decodeURIComponent(key)] = decodeURIComponent(value)
    return acc
  }, {} as Record<string, string>)
}

export const indexBy = <T, K extends string>(arr: T[], keyFn: (item: T) => K): Map<K, T> => {
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
