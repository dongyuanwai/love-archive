export const ACCESS_TOKEN_KEY = 'love-archive:access-token'
export const REFRESH_TOKEN_KEY = 'love-archive:refresh-token'

export const getAccessToken = () =>
  String(uni.getStorageSync(ACCESS_TOKEN_KEY) || '')

export const getRefreshToken = () =>
  String(uni.getStorageSync(REFRESH_TOKEN_KEY) || '')

export const saveTokens = (accessToken: string, refreshToken: string) => {
  uni.setStorageSync(ACCESS_TOKEN_KEY, accessToken)
  uni.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
}

export const clearTokens = () => {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
}
