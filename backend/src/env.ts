type EnvShape = {
  NODE_ENV: string
  HOSTING_MODE: 'central' | 'self'
  DATABASE_URL: string
  RATE_WINDOW_SEC: string
  RATE_LIMIT: string
  PORT: string
  SESSION_TTL_MIN: string
  HCAPTCHA_SECRET: string
  HCAPTCHA_SITE_KEY: string
  COOKIE_SECRET: string
  TRUST_PROXY: string
  LIMIT_JSON: string
  LIMIT_RAW: string
  NOTES_STORAGE_LIMIT: string
  FILES_STORAGE_LIMIT: string
  S3_ACCESS_KEY_ID: string
  S3_ACCESS_KEY_SECRET: string
  S3_REGION: string
  S3_ENDPOINT: string
  S3_BUCKET: string
  MJ_APIKEY_PUBLIC: string
  MJ_APIKEY_PRIVATE: string
  MAIL_FROM: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
}

const get = (key: string) => process.env[key]

const hostingMode = (get('HOSTING_MODE') ?? 'central') === 'self' ? 'self' : 'central'

const requiredAlways = [
  'NODE_ENV',
  'DATABASE_URL',
  'PORT',
  'SESSION_TTL_MIN',
  'COOKIE_SECRET',
  'TRUST_PROXY',
  'S3_ACCESS_KEY_ID',
  'S3_ACCESS_KEY_SECRET',
  'S3_REGION',
  'S3_ENDPOINT',
  'S3_BUCKET',
]

for (const key of requiredAlways) {
  if (get(key) === undefined) {
    throw new Error(`Missing environment variable: ${key}`)
  }
}

if (hostingMode === 'central') {
  const centralRequired = [
    'HCAPTCHA_SECRET',
    'HCAPTCHA_SITE_KEY',
    'MJ_APIKEY_PUBLIC',
    'MJ_APIKEY_PRIVATE',
    'MAIL_FROM',
  ]
  for (const key of centralRequired) {
    if (get(key) === undefined) {
      throw new Error(`Missing environment variable: ${key}`)
    }
  }
} else {
  if (get('ADMIN_USERNAME') === undefined || get('ADMIN_PASSWORD') === undefined) {
    throw new Error(
      'Missing environment variables: ADMIN_USERNAME and ADMIN_PASSWORD are required in self-hosted mode'
    )
  }
}

const envComputed: EnvShape = {
  NODE_ENV: get('NODE_ENV') ?? 'production',
  HOSTING_MODE: hostingMode,
  DATABASE_URL: get('DATABASE_URL') ?? '',
  RATE_WINDOW_SEC: get('RATE_WINDOW_SEC') ?? '60',
  RATE_LIMIT: get('RATE_LIMIT') ?? '1000',
  PORT: get('PORT') ?? '5100',
  SESSION_TTL_MIN: get('SESSION_TTL_MIN') ?? '1440',
  HCAPTCHA_SECRET:
    hostingMode === 'central' ? get('HCAPTCHA_SECRET') ?? '' : get('HCAPTCHA_SECRET') ?? '',
  HCAPTCHA_SITE_KEY:
    hostingMode === 'central' ? get('HCAPTCHA_SITE_KEY') ?? '' : get('HCAPTCHA_SITE_KEY') ?? '',
  COOKIE_SECRET: get('COOKIE_SECRET') ?? '',
  TRUST_PROXY: get('TRUST_PROXY') ?? 'false',
  LIMIT_JSON: get('LIMIT_JSON') ?? '2mb',
  LIMIT_RAW: get('LIMIT_RAW') ?? '2mb',
  NOTES_STORAGE_LIMIT: get('NOTES_STORAGE_LIMIT') ?? String(100 * 1024 * 1024),
  FILES_STORAGE_LIMIT: get('FILES_STORAGE_LIMIT') ?? String(100 * 1024 * 1024 * 1024),
  S3_ACCESS_KEY_ID: get('S3_ACCESS_KEY_ID') ?? '',
  S3_ACCESS_KEY_SECRET: get('S3_ACCESS_KEY_SECRET') ?? '',
  S3_REGION: get('S3_REGION') ?? '',
  S3_ENDPOINT: get('S3_ENDPOINT') ?? '',
  S3_BUCKET: get('S3_BUCKET') ?? '',
  MJ_APIKEY_PUBLIC: get('MJ_APIKEY_PUBLIC') ?? '',
  MJ_APIKEY_PRIVATE: get('MJ_APIKEY_PRIVATE') ?? '',
  MAIL_FROM: get('MAIL_FROM') ?? '',
  ADMIN_USERNAME: get('ADMIN_USERNAME') ?? '',
  ADMIN_PASSWORD: get('ADMIN_PASSWORD') ?? '',
}

export const env = envComputed
