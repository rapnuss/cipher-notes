import {describe, it, expect} from 'vitest'
import {partitionBy, sliceUtf, splitFilename} from './misc'

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
    expect(res).toEqual({
      '0': [2, 4],
      '1': [1, 3, 5],
    })
  })
})

describe('sliceUtf', () => {
  it('should slice utf', () => {
    expect(sliceUtf('Hello, world!', 0, 5)).toBe('Hello')
  })
  it('should slice utf with surrogate pairs', () => {
    const emoji = '\ud83e\udec4\ud83c\udffe'
    const txt = `Hello${emoji}world!`
    expect(splitUtf(txt, 6)).toEqual(['Hello', `${emoji}world!`])
    expect(splitUtf(txt, 7)).toEqual(['Hello', `${emoji}world!`])
    expect(splitUtf(txt, 8)).toEqual(['Hello', `${emoji}world!`])
    expect(splitUtf(txt, 9)).toEqual([`Hello${emoji}`, 'world!'])
    expect(splitUtf(txt, 10)).toEqual([`Hello${emoji}w`, 'orld!'])
    expect(splitUtf(emoji, 0)).toEqual(['', emoji])
    expect(splitUtf(emoji, 1)).toEqual(['', emoji])
    expect(splitUtf(emoji, 2)).toEqual(['', emoji])
    expect(splitUtf(emoji, 3)).toEqual(['', emoji])
    expect(splitUtf(emoji, 4)).toEqual([emoji, ''])
    expect(splitUtf(emoji, 11)).toEqual([emoji, ''])
  })

  function splitUtf(txt: string, index: number) {
    return [sliceUtf(txt, 0, index), sliceUtf(txt, index)]
  }
})
