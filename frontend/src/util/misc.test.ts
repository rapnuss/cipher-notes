import {afterEach, describe, it, expect, vi} from 'vitest'
import {partitionBy, splitFilename, throttle} from './misc'

describe('splitFilenameExtension', () => {
  it('should split filename extension', () => {
    const [name, ext] = splitFilename('test.txt')
    expect(name).toBe('test')
    expect(ext).toBe('.txt')
  })
  it('should split filename without extension', () => {
    const [name, ext] = splitFilename('test')
    expect(name).toBe('test')
    expect(ext).toBe('')
  })
  it('should split filename with multiple dots', () => {
    const [name, ext] = splitFilename('test.test.txt')
    expect(name).toBe('test.test')
    expect(ext).toBe('.txt')
  })
  it('should preserve a dot at the end', () => {
    const [name, ext] = splitFilename('test.test.')
    expect(name).toBe('test.test')
    expect(ext).toBe('.')
  })
  it('should preserve a dot at the beginning', () => {
    const [name, ext] = splitFilename('.gitignore')
    expect(name).toBe('')
    expect(ext).toBe('.gitignore')
  })
})

describe('partitionBy', () => {
  it('should partition by', () => {
    const res = partitionBy([1, 2, 3, 4, 5], (x) => String(x % 2))
    expect(res).toEqual({'0': [2, 4], '1': [1, 3, 5]})
  })
})

describe('throttle', () => {
  afterEach(() => vi.useRealTimers())

  it('uses the latest arguments during sustained calls and after they stop', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 300)
    for (let i = 0; i < 10; i++) {
      throttled(i)
      vi.advanceTimersByTime(100)
    }
    expect(fn.mock.calls.map(([value]) => value)).toEqual([0, 2, 5, 8])
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenLastCalledWith(9)
    throttled.cancel()
  })

  it('cancels pending calls and can be reused', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 300)
    throttled('first')
    throttled('pending')
    throttled.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn.mock.calls).toEqual([['first']])
    throttled('reopened')
    expect(fn).toHaveBeenLastCalledWith('reopened')
    throttled.cancel()
  })
})
