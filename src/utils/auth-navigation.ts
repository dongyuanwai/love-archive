import { getAccessToken } from '@/api/token'

export type LoginTarget = 'archive' | 'create' | 'insights' | 'profile' | 'binding' | 'suggestion' | 'suggestionAdmin'

const userStorageKey = 'love-archive:test-new-user'

const protectedRouteTargets: Record<string, LoginTarget> = {
  '/pages/create/index': 'create',
  '/pages/insights/index': 'insights',
  '/pages/profile/index': 'profile',
  '/pages/binding/index': 'binding',
  '/pages/suggestion/index': 'suggestion',
  '/pages/suggestion/list': 'suggestionAdmin',
  '/pages/record/detail': 'archive',
}

let guardInstalled = false
let redirectingToLogin = false

const normalizePath = (url = '') => {
  const path = url.split('?')[0] || ''
  return path.startsWith('/') ? path : `/${path}`
}

const currentRoute = () => {
  const pages = getCurrentPages()
  const route = pages.length ? pages[pages.length - 1]?.route || '' : ''
  return normalizePath(route)
}

export const isLocallyAuthenticated = () => {
  const user = uni.getStorageSync(userStorageKey) as { isLoggedIn?: boolean } | undefined
  return Boolean(user?.isLoggedIn && getAccessToken())
}

export const getLoginTarget = (url?: string): LoginTarget =>
  protectedRouteTargets[normalizePath(url || currentRoute())] || 'archive'

export const redirectToLogin = (target: LoginTarget = getLoginTarget()) => {
  if (currentRoute() === '/pages/login/index' || redirectingToLogin) return

  redirectingToLogin = true
  uni.navigateTo({
    url: `/pages/login/index?target=${target}`,
    fail: () => {
      uni.redirectTo({ url: `/pages/login/index?target=${target}` })
    },
    complete: () => {
      setTimeout(() => { redirectingToLogin = false }, 500)
    },
  })
}

const interceptProtectedNavigation = (options: { url?: string }) => {
  const target = protectedRouteTargets[normalizePath(options.url)]
  if (!target || isLocallyAuthenticated()) return options

  redirectToLogin(target)
  return false
}

export const installAuthNavigationGuard = () => {
  if (guardInstalled) return
  guardInstalled = true

  ;(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const).forEach((method) => {
    uni.addInterceptor(method, { invoke: interceptProtectedNavigation })
  })
}
