<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon, { type AppIconName } from '@/components/AppIcon.vue'
import { useArchiveStore } from '@/stores/archive'

const store = useArchiveStore()
const avatarUrl = ref(store.user.avatarUrl)
const nickname = ref(store.user.isLoggedIn ? store.user.name : '')
const loginLoading = ref(false)
const redirectingToLogin = ref(false)
const loginPrompted = ref(false)

onShow(() => {
  if (store.user.isLoggedIn) {
    loginPrompted.value = false
    return
  }
  if (loginPrompted.value) {
    loginPrompted.value = false
    uni.switchTab({ url: '/pages/archive/index' })
    return
  }
  if (redirectingToLogin.value) return
  redirectingToLogin.value = true
  loginPrompted.value = true
  uni.navigateTo({
    url: '/pages/login/index?target=profile',
    complete: () => { redirectingToLogin.value = false },
  })
})
const menuGroups = [
  [{ icon: 'link', label: '对象绑定', desc: '邀请、查看或解除绑定', path: '/pages/binding/index' }],
  [
    { icon: 'shield', label: '隐私与安全', desc: '可见范围、黑名单与数据说明' },
    { icon: 'feedback', label: '意见反馈', desc: '告诉我们你的想法' },
  ],
  [
    { icon: 'document', label: '用户协议', desc: '' },
    { icon: 'shield', label: '隐私政策', desc: '' },
  ],
]

const openItem = (item: { path?: string; label: string }) => {
  if (item.path) uni.navigateTo({ url: item.path })
  else uni.showToast({ title: `${item.label}将在后端接入时完善`, icon: 'none' })
}
const goBinding = () => uni.navigateTo({ url: '/pages/binding/index' })

const chooseAvatar = (event: CustomEvent<{ avatarUrl: string }>) => {
  avatarUrl.value = event.detail.avatarUrl
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
    },
    fail: () => uni.showToast({ title: '未能完成微信登录', icon: 'none' }),
    complete: () => { loginLoading.value = false },
  })
}

const logout = () => {
  uni.showModal({
    title: '退出微信登录？',
    content: '退出后不会删除已经发布的心情。',
    confirmText: '退出登录',
    confirmColor: '#b65b52',
    success: (result) => {
      if (!result.confirm) return
      store.logout()
      avatarUrl.value = ''
      nickname.value = ''
      uni.showToast({ title: '已退出登录', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="page-shell profile-page">
    <view class="profile-head">
      <text class="eyebrow">MY ARCHIVE</text>
      <text class="profile-head__title">照顾关系，也照顾自己</text>
    </view>
    <view class="identity card">
      <image v-if="store.user.avatarUrl" class="identity__avatar identity__avatar--image" :src="store.user.avatarUrl" mode="aspectFill" />
      <view v-else class="identity__avatar">{{ store.user.initial }}</view>
      <view class="identity__copy">
        <text class="identity__name">{{ store.user.name }}</text>
        <text class="identity__desc">{{ store.user.isLoggedIn ? '微信已登录 · 已记录 28 个心情时刻' : '登录后使用微信头像和昵称' }}</text>
      </view>
      <view v-if="store.user.isLoggedIn" class="login-badge">已登录</view>
    </view>

    <view v-if="!store.user.isLoggedIn" class="wechat-login card">
      <text class="wechat-login__title">用微信身份开启存档</text>
      <text class="wechat-login__desc">头像和昵称由你主动选择，仅用于展示个人身份。</text>
      <view class="wechat-profile-form">
        <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="chooseAvatar">
          <image v-if="avatarUrl" class="avatar-picker__image" :src="avatarUrl" mode="aspectFill" />
          <view v-else class="avatar-picker__placeholder"><AppIcon name="plus" :size="22" /><text>选择头像</text></view>
        </button>
        <view class="nickname-field">
          <text class="nickname-field__label">微信昵称</text>
          <input v-model="nickname" class="nickname-field__input" type="nickname" maxlength="20" placeholder="点击填写昵称" />
        </view>
      </view>
      <button class="wechat-login__button" :loading="loginLoading" :disabled="loginLoading" @tap="loginWithWechat">微信登录</button>
      <text class="wechat-login__tip">点击登录即代表你同意用户协议与隐私政策</text>
    </view>

    <view class="relationship card" @tap="goBinding">
      <view v-if="store.activeRelationship" class="relationship__avatars"><view>{{ store.user.initial }}</view><view>{{ store.activeRelationship.partnerInitial }}</view></view>
      <view v-else class="relationship__empty"><AppIcon name="link" :size="23" /></view>
      <view class="relationship__copy">
        <text class="relationship__label">{{ store.activeRelationship ? '共同存档中' : '还没有绑定对象' }}</text>
        <text class="relationship__title">{{ store.activeRelationship ? `${store.user.name}  &  ${store.activeRelationship.partnerName}` : '邀请 TA 一起记录' }}</text>
        <text class="relationship__desc">{{ store.activeRelationship ? `从 ${store.activeRelationship.startedAt} 开始` : '单身时的记录也会一直为你保留' }}</text>
      </view>
      <AppIcon name="chevron" :size="18" color="#a69591" />
    </view>

    <view v-for="(group, groupIndex) in menuGroups" :key="groupIndex" class="menu card">
      <button v-for="(item, index) in group" :key="item.label" class="menu-row" :class="{ 'menu-row--border': index > 0 }" @tap="openItem(item)">
        <view class="menu-icon" :class="`menu-icon--${groupIndex}`"><AppIcon :name="item.icon as AppIconName" :size="19" /></view>
        <view class="menu-copy"><text class="menu-label">{{ item.label }}</text><text v-if="item.desc" class="menu-desc">{{ item.desc }}</text></view>
        <AppIcon name="chevron" :size="17" color="#aa9994" />
      </button>
    </view>

    <button v-if="store.user.isLoggedIn" class="logout" @tap="logout">退出登录</button>
    <text class="version">爱恋存档 · 前端体验版 0.1.0</text>
  </view>
</template>

<style scoped lang="scss">
.profile-page { padding-bottom: calc(108rpx + env(safe-area-inset-bottom)); }
.profile-head { padding: 12rpx 2rpx 38rpx; }.profile-head__title{display:block;margin-top:18rpx;font-size:46rpx;font-weight:750}
.identity,.relationship,.menu-row{display:flex;align-items:center}.identity{padding:26rpx}.identity__avatar{display:flex;width:92rpx;height:92rpx;flex:none;align-items:center;justify-content:center;border-radius:31rpx;background:linear-gradient(145deg,#f9c9a7,#efa989);color:#784a3e;font-size:33rpx;font-weight:750}.identity__avatar--image{display:block;background:#f5ebe5}.identity__copy{min-width:0;flex:1;margin-left:20rpx}.identity__name,.identity__desc{display:block}.identity__name{font-size:31rpx;font-weight:750}.identity__desc{margin-top:7rpx;color:#958682;font-size:22rpx}.login-badge{padding:8rpx 14rpx;border-radius:999rpx;background:#edf7ef;color:#4f8760;font-size:19rpx;font-weight:650}
.wechat-login{margin-top:20rpx;padding:28rpx}.wechat-login__title,.wechat-login__desc,.wechat-login__tip{display:block}.wechat-login__title{font-size:30rpx;font-weight:750}.wechat-login__desc{margin-top:8rpx;color:#847672;font-size:22rpx;line-height:1.65}.wechat-profile-form{display:flex;gap:20rpx;margin-top:25rpx;align-items:center}.avatar-picker{width:112rpx;height:112rpx;flex:none;overflow:hidden;border:1rpx dashed #dfc8bb;border-radius:31rpx;background:#fff5ee}.avatar-picker__image{display:block;width:100%;height:100%}.avatar-picker__placeholder{display:flex;height:100%;flex-direction:column;gap:7rpx;align-items:center;justify-content:center;color:#a46358;font-size:19rpx}.nickname-field{height:112rpx;flex:1;padding:16rpx 20rpx;border:1rpx solid #eadbd2;border-radius:24rpx;background:#fff}.nickname-field__label{display:block;color:#8b7c77;font-size:20rpx}.nickname-field__input{height:57rpx;color:#4d403d;font-size:27rpx;font-weight:650}.wechat-login__button{width:100%;min-height:88rpx;margin-top:24rpx;border-radius:25rpx;background:#39a866;color:#fff;font-size:28rpx;font-weight:700;box-shadow:0 12rpx 24rpx rgba(57,168,102,.18)}.wechat-login__button[disabled]{opacity:.65}.wechat-login__tip{margin-top:14rpx;color:#a0928e;font-size:19rpx;text-align:center}
.relationship{margin-top:20rpx;padding:27rpx;background:linear-gradient(135deg,#fff,#fff1e7)}.relationship__avatars{display:flex;width:104rpx}.relationship__avatars view,.relationship__empty{display:flex;width:67rpx;height:67rpx;align-items:center;justify-content:center;border:4rpx solid #fff;border-radius:50%;background:#f4b692;color:#7a493c;font-weight:700}.relationship__avatars view+view{margin-left:-25rpx;background:#c8dae8;color:#526b82}.relationship__empty{border:0;background:#fff0e5;color:#a35e52}.relationship__copy{flex:1;margin-left:17rpx}.relationship__label,.relationship__title,.relationship__desc{display:block}.relationship__label{color:#a56a5f;font-size:19rpx;font-weight:700}.relationship__title{margin-top:6rpx;font-size:28rpx;font-weight:750}.relationship__desc{margin-top:6rpx;color:#968682;font-size:20rpx}
.menu{margin-top:24rpx;padding:0 24rpx}.menu-row{width:100%;min-height:120rpx;justify-content:flex-start;background:transparent;line-height:1.2;text-align:left}.menu-row--border{border-top:1rpx solid #f0e8e3}.menu-icon{display:flex;width:64rpx;height:64rpx;align-items:center;justify-content:center;border-radius:19rpx;background:#ffeadf;color:#95584e}.menu-icon--1{background:#e7f0f7;color:#587993}.menu-icon--2{background:#f1edea;color:#71615d}.menu-copy{flex:1;margin-left:19rpx}.menu-label,.menu-desc{display:block}.menu-label{font-size:27rpx;font-weight:650}.menu-desc{margin-top:6rpx;color:#847672;font-size:21rpx}.logout{width:100%;margin-top:28rpx;min-height:92rpx;border:1rpx solid #f0e4dd;border-radius:24rpx;background:#fff;color:#a6554c;font-size:26rpx}.version{display:block;margin-top:22rpx;color:#998a86;font-size:19rpx;text-align:center}
</style>
