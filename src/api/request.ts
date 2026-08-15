import { API_BASE_URL } from '@/config/env'
import { redirectToLogin } from '@/utils/auth-navigation'
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './token'

type HttpMethod = NonNullable<UniApp.RequestOptions['method']>

interface ApiRequestOptions {
  path: string
  method?: HttpMethod
  data?: UniApp.RequestOptions['data']
  auth?: boolean
}

let refreshing: Promise<boolean> | null = null

const refreshAccessToken = () => {
  if (refreshing) return refreshing
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.resolve(false)
  refreshing = uni.request({
    url: `${API_BASE_URL}/auth/refresh`,
    method: 'POST',
    data: { refreshToken },
    header: { 'Content-Type': 'application/json' },
  }).then((response) => {
    if (response.statusCode < 200 || response.statusCode >= 300) return false
    const data = response.data as { accessToken: string; refreshToken: string }
    if (!data.accessToken || !data.refreshToken) return false
    saveTokens(data.accessToken, data.refreshToken)
    return true
  }).catch(() => false).finally(() => { refreshing = null })
  return refreshing
}

interface ApiErrorBody {
  message?: string | string[]
  error?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const resolveErrorMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback
  const body = data as ApiErrorBody
  if (Array.isArray(body.message)) return body.message.join('；')
  return body.message || body.error || fallback
}

export async function apiRequest<T>({
  path,
  method = 'GET',
  data,
  auth = true,
}: ApiRequestOptions, retried = false): Promise<T> {
  const accessToken = getAccessToken()

  if (auth && !accessToken) {
    redirectToLogin()
    throw new ApiError('请先登录', 401)
  }

  try {
    const response = await uni.request({
      url: `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
      method,
      data,
      timeout: 15_000,
      header: {
        'Content-Type': 'application/json',
        ...(auth && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    })

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.data as T
    }

    if (response.statusCode === 401 && auth && !retried) {
      if (await refreshAccessToken()) {
        return apiRequest<T>({ path, method, data, auth }, true)
      }
      clearTokens()
      redirectToLogin()
    }

    throw new ApiError(
      resolveErrorMessage(response.data, `请求失败（${response.statusCode}）`),
      response.statusCode,
    )
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('无法连接服务器，请确认后端已经启动')
  }
}
