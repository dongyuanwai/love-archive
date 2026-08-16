<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon, { type AppIconName } from '@/components/AppIcon.vue'
import { useArchiveStore } from '@/stores/archive'
import { getMyProfile, updateMyProfile } from '@/api/users'
import { getCurrentRelationship } from '@/api/relationships'
import { logoutWechat } from '@/api/auth'
import { syncTabBarSelection } from '@/utils/tab-bar'

const store = useArchiveStore()
const redirectingToLogin = ref(false)
const loginPrompted = ref(false)
const nicknameEditorVisible = ref(false)
const nicknameDraft = ref('')
const profileSaving = ref(false)
const profileLoading = ref(store.user.isLoggedIn)
const profileReady = ref(false)
const logoutLoading = ref(false)
const moodCount = ref(0)

onShow(async () => {
  syncTabBarSelection()
  if (store.user.isLoggedIn) {
    loginPrompted.value = false
    profileLoading.value = true
    try {
      const [profile, relationship] = await Promise.all([
        getMyProfile(),
        getCurrentRelationship(),
      ])
      store.updateUserProfile(profile.nickname, profile.avatarUrl || '')
      store.setCurrentRelationship(relationship)
      moodCount.value = profile.moodCount || 0
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : '个人资料加载失败', icon: 'none' })
    } finally {
      profileLoading.value = false
      profileReady.value = true
    }
    return
  }
  profileLoading.value = false
  if (loginPrompted.value) {
    loginPrompted.value = false
    uni.switchTab({ url: '/pages/index/index' })
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

const openItem = (item: { path: string }) => uni.navigateTo({ url: item.path })
const goBinding = () => uni.navigateTo({ url: '/pages/binding/index' })

const openNicknameEditor = () => {
  nicknameDraft.value = store.user.name
  nicknameEditorVisible.value = true
}

const closeNicknameEditor = () => {
  if (!profileSaving.value) nicknameEditorVisible.value = false
}

const saveNickname = async () => {
  const nextNickname = nicknameDraft.value.trim()
  if (!nextNickname) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  if (nextNickname === store.user.name) {
    nicknameEditorVisible.value = false
    return
  }
  profileSaving.value = true
  try {
    const profile = await updateMyProfile(nextNickname)
    store.updateUserProfile(profile.nickname, profile.avatarUrl || store.user.avatarUrl)
    nicknameEditorVisible.value = false
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '昵称修改失败',
      icon: 'none',
    })
  } finally {
    profileSaving.value = false
  }
}

const logout = () => {
  uni.showModal({
    title: '退出微信登录？',
    content: '退出后不会删除已经发布的心情。',
    confirmText: '退出登录',
    confirmColor: '#b65b52',
    success: async (result) => {
      if (!result.confirm) return
      logoutLoading.value = true
      try {
        await logoutWechat()
      } catch {
        // 即使会话已经过期，也允许清除本机登录状态。
      }
      store.logout()
      uni.showToast({ title: '已退出登录', icon: 'none' })
      uni.switchTab({ url: '/pages/index/index' })
      logoutLoading.value = false
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
    <template v-if="profileLoading && !profileReady">
      <view class="identity card profile-skeleton" aria-label="正在加载个人资料">
        <view class="identity__avatar skeleton-block" />
        <view class="identity__copy">
          <view class="skeleton-block skeleton-line skeleton-line--identity-name" />
          <view class="skeleton-block skeleton-line skeleton-line--identity-desc" />
        </view>
        <view class="identity__actions">
          <view class="skeleton-block skeleton-badge" />
          <view class="skeleton-block skeleton-edit" />
        </view>
      </view>

      <view class="relationship card profile-skeleton" aria-label="正在加载绑定关系">
        <view class="relationship__empty skeleton-block" />
        <view class="relationship__copy">
          <view class="skeleton-block skeleton-line skeleton-line--relationship-label" />
          <view class="skeleton-block skeleton-line skeleton-line--relationship-title" />
          <view class="skeleton-block skeleton-line skeleton-line--relationship-desc" />
        </view>
        <view class="skeleton-block skeleton-chevron" />
      </view>
    </template>

    <template v-else>
      <view class="identity card">
        <image v-if="store.user.avatarUrl" class="identity__avatar identity__avatar--image" :src="store.user.avatarUrl" mode="aspectFill" />
        <view v-else class="identity__avatar">{{ store.user.initial }}</view>
        <view class="identity__copy">
          <text class="identity__name">{{ store.user.name }}</text>
          <text class="identity__desc">{{ store.user.isLoggedIn ? `微信已登录 · 已记录 ${moodCount} 个心情时刻` : '登录后使用微信头像和昵称' }}</text>
        </view>
        <view v-if="store.user.isLoggedIn" class="identity__actions">
          <view class="login-badge">已登录</view>
          <button class="edit-nickname" @tap="openNicknameEditor">修改昵称</button>
        </view>
      </view>

      <view class="relationship card" @tap="goBinding">
        <view v-if="store.activeRelationship" class="relationship__avatars">
          <view><image v-if="store.user.avatarUrl" class="relationship__avatar-image" :src="store.user.avatarUrl" mode="aspectFill" /><text v-else>{{ store.user.initial }}</text></view>
          <view><image v-if="store.activeRelationship.partnerAvatarUrl" class="relationship__avatar-image" :src="store.activeRelationship.partnerAvatarUrl" mode="aspectFill" /><text v-else>{{ store.activeRelationship.partnerInitial }}</text></view>
        </view>
        <view v-else class="relationship__empty"><AppIcon name="link" :size="23" /></view>
        <view class="relationship__copy">
          <text class="relationship__label">{{ store.activeRelationship ? '共同存档中' : '还没有绑定对象' }}</text>
          <text class="relationship__title">{{ store.activeRelationship ? `${store.user.name}  &  ${store.activeRelationship.partnerName}` : '邀请 TA 一起记录' }}</text>
          <text class="relationship__desc">{{ store.activeRelationship ? `从 ${store.activeRelationship.startedAt} 开始` : '单身时的记录也会一直为你保留' }}</text>
        </view>
        <AppIcon name="chevron" :size="18" color="#a69591" />
      </view>
    </template>


    <button v-if="store.user.isLoggedIn" class="logout" :loading="logoutLoading" :disabled="logoutLoading" @tap="logout">{{ logoutLoading ? '正在退出…' : '退出登录' }}</button>
    <text class="version">爱恋存档 · 前端体验版 0.1.0</text>

    <view v-if="nicknameEditorVisible" class="editor-mask" @tap="closeNicknameEditor">
      <view class="nickname-editor" @tap.stop>
        <text class="nickname-editor__title">修改昵称</text>
        <text class="nickname-editor__desc">这个昵称会展示在你发布的心情和评论中。</text>
        <input v-model="nicknameDraft" class="nickname-editor__input" type="text" maxlength="20" focus confirm-type="done" placeholder="请输入昵称" @confirm="saveNickname" />
        <view class="nickname-editor__actions">
          <button class="editor-button editor-button--cancel" :disabled="profileSaving" @tap="closeNicknameEditor">取消</button>
          <button class="editor-button editor-button--save" :loading="profileSaving" :disabled="profileSaving" @tap="saveNickname">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.profile-page { padding-bottom: calc(108rpx + env(safe-area-inset-bottom)); }
.profile-head { padding: 12rpx 2rpx 38rpx; }.profile-head__title{display:block;margin-top:18rpx;font-size:46rpx;font-weight:750}
.identity,.relationship,.menu-row{display:flex;align-items:center}.identity{padding:26rpx}.identity__avatar{display:flex;width:92rpx;height:92rpx;flex:none;align-items:center;justify-content:center;border-radius:31rpx;background:linear-gradient(145deg,#f9c9a7,#efa989);color:#784a3e;font-size:33rpx;font-weight:750}.identity__avatar--image{display:block;background:#f5ebe5}.identity__copy{min-width:0;flex:1;margin-left:20rpx}.identity__name,.identity__desc{display:block}.identity__name{font-size:31rpx;font-weight:750}.identity__desc{margin-top:7rpx;color:#958682;font-size:22rpx}.login-badge{padding:8rpx 14rpx;border-radius:999rpx;background:#edf7ef;color:#4f8760;font-size:19rpx;font-weight:650}
.identity__actions{display:flex;flex:none;gap:9rpx;align-items:flex-end;flex-direction:column}.edit-nickname{min-height:44rpx;padding:0 10rpx;background:transparent;color:#a35e52;font-size:20rpx;line-height:44rpx}
.relationship{margin-top:20rpx;padding:27rpx;background:linear-gradient(135deg,#fff,#fff1e7)}.relationship__avatars{display:flex;width:104rpx}.relationship__avatars>view,.relationship__empty{display:flex;width:67rpx;height:67rpx;overflow:hidden;align-items:center;justify-content:center;border:4rpx solid #fff;border-radius:50%;background:#f4b692;color:#7a493c;font-weight:700}.relationship__avatars>view+view{margin-left:-25rpx;background:#c8dae8;color:#526b82}.relationship__avatar-image{display:block;width:100%;height:100%;border-radius:inherit}.relationship__empty{border:0;background:#fff0e5;color:#a35e52}.relationship__copy{flex:1;margin-left:17rpx}.relationship__label,.relationship__title,.relationship__desc{display:block}.relationship__label{color:#a56a5f;font-size:19rpx;font-weight:700}.relationship__title{margin-top:6rpx;font-size:28rpx;font-weight:750}.relationship__desc{margin-top:6rpx;color:#968682;font-size:20rpx}
.profile-skeleton { pointer-events: none; }
.skeleton-block { overflow: hidden; border: 0; background: linear-gradient(100deg, #f3e6e4 20%, #fbeeed 42%, #f3e6e4 64%); background-size: 220% 100%; animation: skeleton-shimmer 1.35s ease-in-out infinite; }
.skeleton-line { border-radius: 999rpx; }
.skeleton-line--identity-name { width: 152rpx; height: 31rpx; }
.skeleton-line--identity-desc { width: 290rpx; height: 22rpx; margin-top: 7rpx; }
.skeleton-badge { width: 78rpx; height: 38rpx; border-radius: 999rpx; }
.skeleton-edit { width: 88rpx; height: 44rpx; border-radius: 14rpx; }
.profile-skeleton .relationship__empty { background: linear-gradient(100deg, #f3e6e4 20%, #fbeeed 42%, #f3e6e4 64%); background-size: 220% 100%; }
.skeleton-line--relationship-label { width: 104rpx; height: 19rpx; }
.skeleton-line--relationship-title { width: 210rpx; height: 28rpx; margin-top: 6rpx; }
.skeleton-line--relationship-desc { width: 260rpx; height: 20rpx; margin-top: 6rpx; }
.skeleton-chevron { width: 18rpx; height: 30rpx; flex: none; border-radius: 999rpx; }
@keyframes skeleton-shimmer { to { background-position: -220% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton-block { animation: none; } }
.menu{margin-top:24rpx;padding:0 24rpx}.menu-row{width:100%;min-height:120rpx;justify-content:flex-start;background:transparent;line-height:1.2;text-align:left}.menu-row--border{border-top:1rpx solid #f0e8e3}.menu-icon{display:flex;width:64rpx;height:64rpx;align-items:center;justify-content:center;border-radius:19rpx;background:#ffeadf;color:#95584e}.menu-copy{flex:1;margin-left:19rpx}.menu-label,.menu-desc{display:block}.menu-label{font-size:27rpx;font-weight:650}.menu-desc{margin-top:6rpx;color:#847672;font-size:21rpx}.logout{width:100%;margin-top:28rpx;min-height:92rpx;border:1rpx solid #f0e4dd;border-radius:24rpx;background:#fff;color:#a6554c;font-size:26rpx}.version{display:block;margin-top:22rpx;color:#998a86;font-size:19rpx;text-align:center}
.editor-mask{position:fixed;z-index:100;inset:0;display:flex;padding:32rpx;align-items:center;justify-content:center;background:rgba(48,39,37,.4)}.nickname-editor{width:100%;padding:34rpx 30rpx 28rpx;border-radius:32rpx;background:#fffaf6;box-shadow:0 24rpx 60rpx rgba(66,47,42,.2)}.nickname-editor__title,.nickname-editor__desc{display:block}.nickname-editor__title{font-size:32rpx;font-weight:750}.nickname-editor__desc{margin-top:10rpx;color:#847672;font-size:22rpx;line-height:1.6}.nickname-editor__input{height:88rpx;margin-top:26rpx;padding:0 22rpx;border:1rpx solid #eadbd2;border-radius:22rpx;background:#fff;color:#4d403d;font-size:28rpx}.nickname-editor__actions{display:flex;gap:18rpx;margin-top:24rpx}.editor-button{display:flex;min-height:82rpx;flex:1;align-items:center;justify-content:center;border-radius:22rpx;font-size:26rpx;font-weight:700;line-height:1}.editor-button--cancel{background:#f3ebe6;color:#746663}.editor-button--save{background:#c96f61;color:#fff}.editor-button[disabled]{opacity:.6}
</style>
