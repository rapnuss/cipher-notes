import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import {env} from '../env'

export const s3 = new S3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_ACCESS_KEY_SECRET,
  },
  region: env.S3_REGION || undefined,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_ENDPOINT ? true : undefined,
})

export async function s3DeleteKeys(
  keys: string[]
): Promise<{deletedKeys: string[]; errorKeys: string[]}> {
  if (keys.length === 0) return {deletedKeys: [], errorKeys: []}
  if (keys.length > 1000) {
    throw new Error('Too many keys to delete')
  }
  const res = await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: {
        Quiet: true,
        Objects: keys.map((k) => ({Key: k})),
      },
    })
  )
  const deletedKeys = res.Deleted?.map((d) => d.Key).filter((k) => k !== undefined) ?? []
  const errorKeys = res.Errors?.map((e) => e.Key).filter((k) => k !== undefined) ?? []
  return {deletedKeys, errorKeys}
}

export async function s3DeletePrefix(
  prefix: string
): Promise<{deletedKeys: string[]; errorKeys: string[]}> {
  let continuationToken: string | undefined = undefined
  let deletedKeys: string[] = []
  let errorKeys: string[] = []
  do {
    const listRes: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    )

    const keys: string[] = listRes.Contents?.map((obj) => obj.Key!) ?? []
    if (keys.length > 0) {
      const {deletedKeys: deletedKeysForThisBatch, errorKeys: errorKeysForThisBatch} =
        await s3DeleteKeys(keys)
      deletedKeys.push(...deletedKeysForThisBatch)
      errorKeys.push(...errorKeysForThisBatch)
    }

    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
  } while (continuationToken)
  return {deletedKeys, errorKeys}
}
