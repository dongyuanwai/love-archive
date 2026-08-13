<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { useArchiveStore } from '@/stores/archive'

type LoginTarget = 'archive' | 'create' | 'profile' | 'binding'

const store = useArchiveStore()
const avatarUrl = ref('')
const nickname = ref('')
const loginLoading = ref(false)
const target = ref<LoginTarget>('archive')

onLoad((query) => {
  const requestedTarget = String(query?.target || 'archive') as LoginTarget
  if (['archive', 'create', 'profile', 'binding'].includes(requestedTarget)) target.value = requestedTarget
})

const chooseAvatar = (event: CustomEvent<{ avatarUrl: string }>) => {
  avatarUrl.value = event.detail.avatarUrl
}

const continueToTarget = () => {
  if (target.value === 'binding') {
    uni.redirectTo({ url: '/pages/binding/index' })
    return
  }
  const tabPaths: Record<Exclude<LoginTarget, 'binding'>, string> = {
    archive: '/pages/archive/index',
    create: '/pages/create/index',
    profile: '/pages/profile/index',
  }
  uni.switchTab({ url: tabPaths[target.value] })
}

const loginWithWechat = () => {
  if (!avatarUrl.value) {
    uni.showToast({ title: '请先选择微信头像', icon: 'none' })
    return
  }
  if (!nickname.value.trim()) {
    uni.showToast({ title: '请填写微信昵称', icon: 'none' })
    return
  }
  loginLoading.value = true
  uni.login({
    provider: 'weixin',
    success: (result) => {
      if (!result.code || !store.completeWechatLogin(nickname.value, avatarUrl.value)) {
        uni.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
        return
      }
      uni.showToast({ title: '微信登录成功', icon: 'success' })
      setTimeout(continueToTarget, 350)
    },
    fail: () => uni.showToast({ title: '未能完成微信登录', icon: 'none' }),
    complete: () => { loginLoading.value = false },
  })
}
</script>

<template>
  <view class="page-shell login-page">
    <view class="login-head">
      <text class="eyebrow">WELCOME</text>
      <text class="login-head__title">先认识一下彼此</text>
      <text class="login-head__desc">登录后，才能安全地保存心情、邀请对象和管理自己的存档。</text>
    </view>

    <view class="login-card card">
      <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="chooseAvatar">
        <image v-if="avatarUrl" class="avatar-picker__image" :src="avatarUrl" mode="aspectFill" />
        <view v-else class="avatar-picker__placeholder">
          <AppIcon name="plus" :size="24" />
          <text>选择微信头像</text>
        </view>
      </button>

      <view class="nickname-field">
        <text class="nickname-field__label">微信昵称</text>
        <input v-model="nickname" class="nickname-field__input" type="nickname" maxlength="20" placeholder="点击填写昵称" />
      </view>

      <button class="login-button" :loading="loginLoading" :disabled="loginLoading" @tap="loginWithWechat">微信登录</button>
      <text class="login-tip">头像和昵称由你主动选择，仅用于展示个人身份。</text>
    </view>

    <view class="privacy-note">
      <AppIcon name="shield" :size="17" />
      <text>点击登录即代表你同意用户协议与隐私政策</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page { padding-top: 74rpx; }
.login-head { padding: 10rpx 4rpx 42rpx; }
.login-head__title { display: block; margin-top: 18rpx; font-size: 48rpx; font-weight: 750; }
.login-head__desc { display: block; margin-top: 15rpx; color: #746663; font-size: 24rpx; line-height: 1.7; }
.login-card { padding: 38rpx 30rpx 30rpx; }
.avatar-picker { width: 176rpx; height: 176rpx; margin: 0 auto; overflow: hidden; border: 2rpx dashed #dfc8bb; border-radius: 52rpx; background: #fff5ee; }
.avatar-picker__image { display: block; width: 100%; height: 100%; }
.avatar-picker__placeholder { display: flex; height: 100%; flex-direction: column; gap: 12rpx; align-items: center; justify-content: center; color: #a46358; font-size: 21rpx; }
.nickname-field { margin-top: 32rpx; padding: 18rpx 22rpx; border: 1rpx solid #eadbd2; border-radius: 24rpx; background: #fff; }
.nickname-field__label { display: block; color: #8b7c77; font-size: 20rpx; }
.nickname-field__input { height: 62rpx; color: #4d403d; font-size: 28rpx; font-weight: 650; }
.login-button { width: 100%; min-height: 92rpx; margin-top: 28rpx; border-radius: 27rpx; background: #39a866; color: #fff; font-size: 29rpx; font-weight: 700; box-shadow: 0 12rpx 24rpx rgba(57,168,102,.18); }
.login-button[disabled] { opacity: .65; }
.login-tip { display: block; margin-top: 16rpx; color: #948681; font-size: 20rpx; text-align: center; }
.privacy-note { display: flex; gap: 9rpx; margin-top: 24rpx; align-items: center; justify-content: center; color: #948681; font-size: 20rpx; }
</style>
