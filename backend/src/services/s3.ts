import {DeleteObjectsCommand, S3Client} from '@aws-sdk/client-s3'
import {env} from '../env'

const options: Record<string, string> = {
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_ACCESS_KEY_SECRET,
  bucket: env.S3_BUCKET,
}

if (env.S3_ENDPOINT) {
  options.endpoint = env.S3_ENDPOINT
} else if (env.S3_REGION) {
  options.region = env.S3_REGION
}

export const s3 = new S3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_ACCESS_KEY_SECRET,
  },
  region: env.S3_REGION || undefined,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: env.S3_ENDPOINT ? true : undefined,
})

export async function s3DeleteKeys(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return []
  const res = await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: {
        Quiet: true,
        Objects: keys.slice(0, 1000).map((k) => ({Key: k})),
      },
    })
  )
  if (res.Errors && res.Errors.length) {
    console.warn('Some keys failed to delete:', res.Errors)
  }
  return res.Deleted?.map((d) => d.Key).filter((k) => k !== undefined) ?? []
}
