import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  candidates: [] as string[],
  blobs: new Map<string, {id: string; blob: Blob}>(),
  saved: new Map<string, {id: string; blob: Blob}>(),
  batches: [] as string[][],
  generatePdfThumbnail: vi.fn(),
}))

vi.mock('./db', () => {
  const files_meta = {
    where: () => ({
      anyOf: (ids: string[]) => ({
        and: () => ({primaryKeys: async () => [...mocks.candidates]}),
        primaryKeys: async () => ids,
      }),
    }),
    bulkUpdate: vi.fn(),
  }
  const files_thumb = {
    async bulkPut(thumbs: {id: string; blob: Blob}[]) {
      for (const thumb of thumbs) mocks.saved.set(thumb.id, thumb)
    },
    bulkDelete: vi.fn(),
  }
  return {
    db: {
      files_meta,
      files_thumb,
      files_blob: {
        where: () => ({
          anyOf: (ids: string[]) => ({
            async toArray() {
              mocks.batches.push(ids)
              return ids.flatMap((id) => (mocks.blobs.has(id) ? [mocks.blobs.get(id)!] : []))
            },
          }),
        }),
      },
      transaction: async (
        _mode: string,
        _meta: unknown,
        _thumb: unknown,
        fn: (tx: unknown) => Promise<void>,
      ) => fn({files_meta, files_thumb}),
    },
  }
})
vi.mock('./helpers/pdf', () => ({
  pdfMimeType: 'application/pdf',
  generatePdfThumbnail: mocks.generatePdfThumbnail,
}))
vi.mock('./services/backend', () => ({reqGetPresignedUrls: vi.fn()}))
vi.mock('./config', () => ({thumbnailWidth: 400, thumbnailHeight: 300}))

import {generateThumbnails} from './worker'

beforeEach(() => {
  mocks.candidates.length = 0
  mocks.blobs.clear()
  mocks.saved.clear()
  mocks.batches.length = 0
  mocks.generatePdfThumbnail.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const addPdf = (id: string) => {
  mocks.candidates.push(id)
  mocks.blobs.set(id, {id, blob: new Blob([id], {type: 'application/pdf'})})
}

describe('thumbnail queue progress', () => {
  it('continues beyond a full batch of failed PDFs and retries only on a later run', async () => {
    for (let i = 0; i < 21; i++) addPdf(String(i))
    mocks.generatePdfThumbnail.mockImplementation(async (blob: Blob) => {
      if ((await blob.text()) !== '20') throw new Error('Password required')
      return new Blob(['thumbnail'], {type: 'image/jpeg'})
    })
    await generateThumbnails()
    expect(mocks.generatePdfThumbnail).toHaveBeenCalledTimes(21)
    expect(mocks.batches.map((batch) => batch.length)).toEqual([20, 1])
    expect([...mocks.saved.keys()]).toEqual(['20'])

    mocks.candidates.splice(mocks.candidates.indexOf('20'), 1)
    mocks.generatePdfThumbnail.mockResolvedValue(new Blob(['unlocked']))
    await generateThumbnails()
    expect(mocks.saved.size).toBe(21)
  })

  it('advances past missing blobs without requeueing forever', async () => {
    mocks.candidates.push(...Array.from({length: 20}, (_, i) => `missing-${i}`))
    addPdf('available')
    mocks.generatePdfThumbnail.mockResolvedValue(new Blob(['thumbnail']))
    await generateThumbnails()
    expect(mocks.batches).toHaveLength(2)
    expect(mocks.generatePdfThumbnail).toHaveBeenCalledTimes(1)
    expect(mocks.saved.has('available')).toBe(true)
  })
})
