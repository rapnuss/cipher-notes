import {S3Client} from '@aws-sdk/client-s3'
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
