import { apiRequest } from './request'
import { saveTokens } from './token'

export interface LoginUser {
  id: string
  nickname: string
  avatarUrl: string | null
  createdAt: string
}

export function logoutWechat(): Promise<{ success: boolean }> {
  return apiRequest({ path: '/auth/logout', method: 'POST' })
}

export interface WechatLoginResponse {
  user: LoginUser
  requiresProfile: boolean
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export async function loginWithWechat(
  code: string,
  nickname?: string,
): Promise<WechatLoginResponse> {
  const result = await apiRequest<WechatLoginResponse>({
    path: '/auth/wechat/login',
    method: 'POST',
    auth: false,
    data: { code, ...(nickname ? { nickname } : {}) },
  })

  saveTokens(result.accessToken, result.refreshToken)
  return result
}
