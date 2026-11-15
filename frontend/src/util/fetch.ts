export class TimeoutError extends Error {
  constructor(ms: number) {
    super('timeout: ' + ms + 'ms')
  }
}

export class AbortError extends Error {
  aborted: true
  constructor(message: string = 'aborted') {
    super(message)
    this.aborted = true
  }
}

export const fetchJson = <D>(
  url: RequestInfo | URL,
  options: RequestInit = {},
  timeout: number = 8 * 1000,
  abortController: AbortController = new AbortController(),
): Promise<D> => {
  options.signal = options.signal || abortController.signal
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      reject(new TimeoutError(timeout))
      abortController.abort()
    }, timeout),
  )
  const fetchPromise = fetch(url, options)
    .then(async (response) => await response.json())
    .catch((e) => {
      if (options.signal && options.signal.aborted) throw new AbortError()
      else throw e
    })
  return Promise.race([fetchPromise, timeoutPromise]) as Promise<D>
}
