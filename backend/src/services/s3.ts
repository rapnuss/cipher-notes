import {S3Client, S3Options} from 'bun'
import {env} from '../env'

const options: S3Options = {
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_ACCESS_KEY_SECRET,
  bucket: env.S3_BUCKET,
}

if (env.S3_ENDPOINT) {
  options.endpoint = env.S3_ENDPOINT
} else if (env.S3_REGION) {
  options.region = env.S3_REGION
}

export const s3 = new S3Client(options)
