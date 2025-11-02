export const backendUrl = import.meta.env.DEV ? '/api' : 'https://ciphernotes.com/api'
export const backendTimeout = 8000
export const hCaptchaSiteCode = ENV_HCAPTCHA_SITE_KEY
export const hostingMode: 'central' | 'self' =
  typeof ENV_HOSTING_MODE === 'string' && ENV_HOSTING_MODE === 'self' ? 'self' : 'central'
