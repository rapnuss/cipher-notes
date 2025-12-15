export const backendUrl: string = typeof ENV_API_URL === 'string' ? ENV_API_URL : '/api'
export const backendTimeout = 8000
export const hCaptchaSiteCode = ENV_HCAPTCHA_SITE_KEY
export const hostingMode: 'central' | 'self' =
  typeof ENV_HOSTING_MODE === 'string' && ENV_HOSTING_MODE === 'self' ? 'self' : 'central'
