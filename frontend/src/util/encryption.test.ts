import {describe, expect, it} from 'vitest'
import {base64ToBin, binToBase64} from './encryption'

describe('binToBase64', () => {
  it('converts large byte arrays without overflowing the stack', () => {
    const data = Uint8Array.from({length: 200_000}, (_, i) => i % 256)

    const base64 = binToBase64(data)

    expect(base64ToBin(base64)).toEqual(data)
  })
})
