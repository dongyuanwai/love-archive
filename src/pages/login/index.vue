<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { useArchiveStore } from '@/stores/archive'
import { loginWithWechat as requestWechatLogin } from '@/api/auth'
import type { LoginUser } from '@/api/auth'
import { updateMyProfile, uploadMyAvatar } from '@/api/users'
import { DEV_WECHAT_USER, USE_DEV_WECHAT_LOGIN } from '@/config/env'
import type { LoginTarget } from '@/utils/auth-navigation'

const store = useArchiveStore()
const loginLoading = ref(false)
const avatarPath = ref('')
const nickname = ref('')
const loginStep = ref<'identity' | 'profile'>('identity')
const pendingUser = ref<LoginUser | null>(null)
const target = ref<LoginTarget>('archive')
const canLogin = computed(() => Boolean(avatarPath.value && nickname.value.trim()) && !loginLoading.value)

onLoad((query) => {
  const requestedTarget = String(query?.target || 'archive') as LoginTarget
  if (['archive', 'create', 'insights', 'profile', 'binding'].includes(requestedTarget)) target.value = requestedTarget
})

const continueToTarget = () => {
  if (target.value === 'binding') {
    uni.redirectTo({ url: '/pages/binding/index' })
    return
  }
  const tabPaths: Record<Exclude<LoginTarget, 'binding'>, string> = {
    archive: '/pages/index/index',
    create: '/pages/create/index',
    insights: '/pages/insights/index',
    profile: '/pages/profile/index',
  }
  uni.switchTab({ url: tabPaths[target.value] })
}

const getWechatCode = () => new Promise<string>((resolve, reject) => {
  uni.login({
    provider: 'weixin',
    success: (result) => result.code ? resolve(result.code) : reject(new Error('未获取到微信登录凭证')),
    fail: () => reject(new Error('未能完成微信登录')),
  })
})

const onChooseAvatar = (event: { detail?: { avatarUrl?: string } }) => {
  avatarPath.value = event.detail?.avatarUrl || ''
}

const finishLogin = (user: LoginUser) => {
  if (!store.completeWechatLogin(user.nickname, user.avatarUrl || '', user.id)) {
    throw new Error('登录资料保存失败')
  }
  uni.showToast({ title: '微信登录成功', icon: 'success' })
  setTimeout(continueToTarget, 350)
}

const loginWithWechat = async () => {
  loginLoading.value = true
  try {
    const wechatCode = await getWechatCode()
    const loginCode = USE_DEV_WECHAT_LOGIN
      ? `dev:${DEV_WECHAT_USER}`
      : wechatCode
    const result = await requestWechatLogin(loginCode)
    if (result.requiresProfile) {
      pendingUser.value = result.user
      nickname.value = result.user.nickname === '微信用户' ? '' : result.user.nickname
      loginStep.value = 'profile'
      return
    }
    finishLogin(result.user)
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '登录失败，请稍后重试',
      icon: 'none',
      duration: 2500,
    })
  } finally {
    loginLoading.value = false
  }
}

const completeRegistration = async () => {
  if (!avatarPath.value || !nickname.value.trim() || !pendingUser.value) return
  loginLoading.value = true
  try {
    await updateMyProfile(nickname.value.trim())
    const profile = await uploadMyAvatar(avatarPath.value)
    finishLogin({
      ...pendingUser.value,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '资料保存失败，请稍后重试',
      icon: 'none',
      duration: 2500,
    })
  } finally {
    loginLoading.value = false
  }
}
</script>

<template>
  <view class="page-shell login-page">
    <view class="login-head">
      <text class="eyebrow">WELCOME</text>
      <text class="login-head__title">欢迎来到爱恋存档</text>
      <text class="login-head__desc">{{ loginStep === 'identity' ? '用微信身份安全登录，继续你的心情存档。' : '第一次见面，请先设置你的头像和昵称。' }}</text>
    </view>

    <view v-if="loginStep === 'identity'" class="login-card card">
      <view class="login-mark">
        <AppIcon name="heart" :size="34" filled />
      </view>
      <text class="login-card__title">微信安全登录</text>
      <text class="login-card__desc">已注册用户会直接读取保存的头像和昵称，无需重复设置。</text>
      <button class="login-button" :loading="loginLoading" :disabled="loginLoading" @tap="loginWithWechat">微信登录</button>
      <text class="login-tip">首次登录后，再完善你的心情身份。</text>
    </view>

    <view v-else class="login-card card">
      <text class="login-card__title">创建你的心情身份</text>
      <text class="login-card__desc">头像和昵称会展示在你和对象共同的心情存档中。</text>

      <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="avatarPath" class="avatar-picker__image" :src="avatarPath" mode="aspectFill" />
        <view v-else class="avatar-picker__empty">
          <view class="avatar-picker__icon"><AppIcon name="heart" :size="28" /></view>
          <text class="avatar-picker__label">选择头像</text>
        </view>
      </button>

      <view class="nickname-field">
        <text class="nickname-field__label">昵称</text>
        <input
          v-model="nickname"
          class="nickname-field__input"
          type="nickname"
          maxlength="64"
          placeholder="请填写你的昵称"
          confirm-type="done"
        />
      </view>

      <button class="login-button" :loading="loginLoading" :disabled="!canLogin" @tap="completeRegistration">完成注册</button>
      <text class="login-tip">登录后仍可在“我的”页面修改昵称。</text>
    </view>

    <view class="privacy-note">
      <AppIcon name="shield" :size="17" />
      <text>点击登录即代表你同意用户协议与隐私政策</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page { padding-top: 32rpx; }
.login-head { padding: 10rpx 4rpx 42rpx; }
.login-head__title { display: block; margin-top: 18rpx; font-size: 48rpx; font-weight: 750; }
.login-head__desc { display: block; margin-top: 15rpx; color: #746663; font-size: 24rpx; line-height: 1.7; }
.login-card { padding: 42rpx 30rpx 30rpx; text-align: center; }
.login-mark { display: flex; width: 112rpx; height: 112rpx; margin: 0 auto; align-items: center; justify-content: center; border-radius: 38rpx; background: #edf7ef; color: #43845a; }
.login-card__title { display: block; margin-top: 24rpx; font-size: 30rpx; font-weight: 750; }
.login-card__desc { display: block; max-width: 500rpx; margin: 12rpx auto 0; color: #847672; font-size: 22rpx; line-height: 1.65; }
.avatar-picker { display: flex; width: 142rpx; height: 142rpx; margin: 30rpx auto 0; padding: 0; overflow: hidden; align-items: center; justify-content: center; border: 2rpx dashed #e6c8bd; border-radius: 44rpx; background: #fff8f3; color: #a86d61; }
.avatar-picker::after { border: 0; }
.avatar-picker__image { width: 100%; height: 100%; }
.avatar-picker__empty { display: flex; width: 100%; height: 100%; gap: 10rpx; flex-direction: column; align-items: center; justify-content: center; }
.avatar-picker__icon { display: flex; width: 58rpx; height: 58rpx; flex: none; align-items: center; justify-content: center; line-height: 1; }
.avatar-picker__label { display: block; height: 24rpx; flex: none; font-size: 19rpx; line-height: 24rpx; text-align: center; }
.nickname-field { display: flex; min-height: 92rpx; margin-top: 26rpx; padding: 0 24rpx; align-items: center; border: 2rpx solid #eee2dc; border-radius: 26rpx; background: #fff; text-align: left; }
.nickname-field__label { flex: 0 0 88rpx; color: #514541; font-size: 24rpx; font-weight: 700; }
.nickname-field__input { min-width: 0; height: 92rpx; flex: 1; color: #352d2b; font-size: 25rpx; }
.login-button { width: 100%; min-height: 92rpx; margin-top: 28rpx; border-radius: 27rpx; background: #39a866; color: #fff; font-size: 29rpx; font-weight: 700; box-shadow: 0 12rpx 24rpx rgba(57,168,102,.18); }
.login-button[disabled] { opacity: .65; }
.login-tip { display: block; margin-top: 16rpx; color: #948681; font-size: 20rpx; text-align: center; }
.privacy-note { display: flex; gap: 9rpx; margin-top: 24rpx; align-items: center; justify-content: center; color: #948681; font-size: 20rpx; }
</style>
