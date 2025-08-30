export const backendUrl = '/api'
export const backendTimeout = 8000
export const hCaptchaSiteCode = 'd79424e2-e326-4dca-8dce-4aa2e8844fb6'
export const hostingMode: 'central' | 'self' =
  typeof VITE_HOSTING_MODE === 'string' && VITE_HOSTING_MODE === 'self' ? 'self' : 'central'
