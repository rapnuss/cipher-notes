const requiredAlways = [
  'NODE_ENV',
  'HOSTING_MODE',
  'DATABASE_URL',
  'RATE_WINDOW_SEC',
  'RATE_LIMIT',
  'PORT',
  'SESSION_TTL_MIN',
  'COOKIE_SECRET',
  'TRUST_PROXY',
  'LIMIT_JSON',
  'LIMIT_RAW',
  'NOTES_STORAGE_LIMIT',
  'FILES_STORAGE_LIMIT',
  'S3_ACCESS_KEY_ID',
  'S3_ACCESS_KEY_SECRET',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_BUCKET',
] as const

const centralRequired = [
  'HCAPTCHA_SECRET',
  'HCAPTCHA_SITE_KEY',
  'MJ_APIKEY_PUBLIC',
  'MJ_APIKEY_PRIVATE',
  'MAIL_FROM',
] as const

const optional = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'] as const

const allKeys = [...requiredAlways, ...centralRequired, ...optional] as const

type EnvShape = Record<
  (typeof requiredAlways)[number] | (typeof centralRequired)[number] | (typeof optional)[number],
  string
>

const get = (key: string) => process.env[key]

export const hostingMode = get('HOSTING_MODE') === 'self' ? 'self' : 'central'

for (const key of requiredAlways) {
  if (get(key) === undefined) {
    throw new Error(`Missing environment variable: ${key}`)
  }
}

if (hostingMode === 'central') {
  for (const key of centralRequired) {
    if (get(key) === undefined) {
      throw new Error(`Missing environment variable: ${key}`)
    }
  }
}

let envComputed: Partial<EnvShape> = {}
for (const key of allKeys) {
  envComputed[key] = get(key) ?? ''
}
export const env = envComputed as EnvShape
