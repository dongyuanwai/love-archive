import { API_BASE_URL } from '@/config/env'

const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export const resolveAssetUrl = (url?: string | null) => {
  if (!url) return ''
  if (/^(https?:|wxfile:|data:|blob:)/.test(url)) return url
  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`
}
