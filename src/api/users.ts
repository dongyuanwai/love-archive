import { apiRequest } from './request'
import { API_BASE_URL } from '@/config/env'
import { getAccessToken } from './token'

export interface MyProfile {
  id: string
  nickname: string
  avatarUrl: string | null
  createdAt?: string
  updatedAt?: string
  moodCount?: number
  status?: 'ACTIVE' | 'DISABLED'
}

export function getMyProfile(): Promise<MyProfile> {
  return apiRequest<MyProfile>({ path: '/users/me' })
}

export function updateMyProfile(nickname: string): Promise<MyProfile> {
  return apiRequest<MyProfile>({
    path: '/users/me',
    method: 'PUT',
    data: { nickname },
  })
}

export function uploadMyAvatar(filePath: string): Promise<MyProfile> {
  const accessToken = getAccessToken()
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE_URL}/users/me/avatar`,
      filePath,
      name: 'avatar',
      header: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      success: (response) => {
        let data: MyProfile | { message?: string }
        try {
          data = JSON.parse(response.data) as MyProfile | { message?: string }
        } catch {
          reject(new Error('头像上传响应异常'))
          return
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data as MyProfile)
          return
        }
        reject(new Error('message' in data && data.message ? data.message : '头像上传失败'))
      },
      fail: () => reject(new Error('头像上传失败，请检查网络')),
    })
  })
}
