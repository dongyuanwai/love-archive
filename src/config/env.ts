const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1',
)

// 是否使用模拟微信身份完全由本地环境变量控制。
// 后端在 NODE_ENV=production 时仍会拒绝 dev: code，避免误用于正式环境。
export const USE_DEV_WECHAT_LOGIN =
  import.meta.env.VITE_USE_DEV_WECHAT_LOGIN === 'true'

export const DEV_WECHAT_USER =
  import.meta.env.VITE_DEV_WECHAT_USER?.trim() || 'local-user'
