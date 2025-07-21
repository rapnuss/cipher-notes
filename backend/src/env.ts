const keys = [
  'NODE_ENV',
  'DATABASE_URL',
  'SENDGRID_API_KEY',
  'RATE_WINDOW_SEC',
  'RATE_LIMIT',
  'PORT',
  'SESSION_TTL_MIN',
  'HCAPTCHA_SECRET',
  'HCAPTCHA_SITE_KEY',
  'COOKIE_SECRET',
  'TRUST_PROXY',
  'LIMIT_JSON',
  'LIMIT_RAW',
  'NOTES_STORAGE_LIMIT',
  'S3_ACCESS_KEY_ID',
  'S3_ACCESS_KEY_SECRET',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_BUCKET',
] as const
type Key = (typeof keys)[number]

const vars: {[K in Key]?: string} = {}
for (const key of keys) {
  if (process.env[key] === undefined) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  vars[key] = process.env[key]
}

export const env = vars as Record<Key, string>
