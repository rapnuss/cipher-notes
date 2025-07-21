import {describe, it, expect} from 'vitest'
import {partitionBy, splitFilename} from './misc'

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
