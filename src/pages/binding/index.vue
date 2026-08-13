<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import { useArchiveStore } from '@/stores/archive'

const store = useArchiveStore()
const mode = ref<'invite' | 'enter'>('invite')
const code = ref('')
const redirectingToLogin = ref(false)

onShow(() => {
  if (store.user.isLoggedIn || redirectingToLogin.value) return
  redirectingToLogin.value = true
  uni.redirectTo({
    url: '/pages/login/index?target=binding',
    complete: () => { redirectingToLogin.value = false },
  })
})

const copyCode = () => {
  uni.setClipboardData({ data: store.inviteCode, success: () => uni.showToast({ title: '邀请码已复制', icon: 'success' }) })
}

const join = () => {
  if (code.value.trim().length < 4) {
    uni.showToast({ title: '请输入有效邀请码', icon: 'none' })
    return
  }
  uni.showModal({
    title: '确认共同存档？',
    content: '绑定后，双方可以查看绑定期间对彼此公开的记录和情绪统计。',
    confirmText: '确认绑定', confirmColor: '#d87263',
    success: (result) => {
      if (result.confirm && store.bindWithCode(code.value)) {
        uni.showToast({ title: '绑定成功', icon: 'success' })
        mode.value = 'invite'
      }
    },
  })
}

const unbind = () => {
  uni.showModal({
    title: '确认解除绑定？',
    content: '解除后，你们会立即无法查看彼此的记录和互动。对方过去的互动只会保留在你自己的存档中。',
    confirmText: '解除绑定', confirmColor: '#bd5147',
    success: (result) => {
      if (!result.confirm) return
      store.unbind()
      uni.showToast({ title: '已解除绑定', icon: 'none' })
    },
  })
}
</script>

<template>
  <view class="page-shell binding-page">
    <view class="binding-head">
      <text class="eyebrow">TOGETHER</text>
      <text class="binding-head__title">{{ store.activeRelationship ? '两个人的存档入口' : '邀请一个人，分享彼此的心情' }}</text>
      <text class="binding-head__desc">绑定不是交出全部隐私，而是认真选择哪些时刻想让 TA 看见。</text>
    </view>

    <template v-if="store.activeRelationship">
      <view class="bond-hero card">
        <view class="bond-avatars"><view class="bond-avatar bond-avatar--me"><image v-if="store.user.avatarUrl" class="user-avatar-image" :src="store.user.avatarUrl" mode="aspectFill" /><text v-else>{{ store.user.initial }}</text></view><view class="bond-line"><AppIcon name="heart" :size="17" filled color="#c96a5c" /></view><view class="bond-avatar bond-avatar--partner">{{ store.activeRelationship.partnerInitial }}</view></view>
        <text class="bond-title">{{ store.user.name }} & {{ store.activeRelationship.partnerName }}</text>
        <text class="bond-desc">从 {{ store.activeRelationship.startedAt }} 开始共同存档</text>
        <view class="bond-stats"><view><text>56</text><span>陪伴天数</span></view><i/><view><text>19</text><span>共同可见记录</span></view><i/><view><text>27</text><span>温柔回应</span></view></view>
      </view>
      <view class="rules card">
        <text class="rules__title">这段关系里的隐私规则</text>
        <view class="rule-row"><view><AppIcon name="lock" :size="18" /></view><text>“仅自己可见”的记录始终不会向对方展示。</text></view>
        <view class="rule-row"><view><AppIcon name="calendar" :size="18" /></view><text>TA 只能看到本次绑定开始后公开的记录。</text></view>
        <view class="rule-row"><view><AppIcon name="trend" :size="18" /></view><text>对方看到的统计不包含你的私密记录。</text></view>
      </view>
      <button class="danger-button unbind-button" @tap="unbind">解除绑定</button>
      <text class="unbind-tip">解除后立即停止共享；你自己的记录和过去收到的互动仍会为你保留。</text>
    </template>

    <template v-else>
      <view class="mode-switch"><button :class="{ active: mode === 'invite' }" @tap="mode = 'invite'">生成邀请码</button><button :class="{ active: mode === 'enter' }" @tap="mode = 'enter'">输入邀请码</button></view>
      <view v-if="mode === 'invite'" class="invite-card card">
        <view class="invite-icon"><AppIcon name="link" :size="28" /></view>
        <text class="invite-label">你的专属邀请码</text>
        <text class="invite-code">{{ store.inviteCode }}</text>
        <text class="invite-desc">邀请码 24 小时内有效，仅能使用一次</text>
        <button class="primary-button" @tap="copyCode">复制邀请码</button>
        <button class="text-button" @tap="store.regenerateInviteCode">重新生成</button>
      </view>
      <view v-else class="enter-card card">
        <view class="invite-icon"><AppIcon name="heart" :size="28" /></view>
        <text class="invite-label">输入 TA 发来的邀请码</text>
        <input v-model="code" class="code-input" maxlength="10" placeholder="例如 LOV826" />
        <button class="primary-button" @tap="join">确认并绑定</button>
      </view>
      <view class="before-bind card"><text>绑定前请放心</text><view><i/>以前的记录不会自动向 TA 开放</view><view><i/>以后发布时仍能选择“仅自己可见”</view><view><i/>每个人同时只能绑定一位对象</view></view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.binding-head{padding:14rpx 6rpx 31rpx}.binding-head__title{display:block;max-width:620rpx;margin-top:15rpx;font-size:42rpx;font-weight:750;line-height:1.4}.binding-head__desc{display:block;margin-top:12rpx;color:#837471;font-size:24rpx;line-height:1.7}
.bond-hero{padding:43rpx 25rpx;text-align:center;background:linear-gradient(145deg,#fff,#fff0e6)}.bond-avatars{display:flex;align-items:center;justify-content:center}.bond-avatar{display:flex;width:105rpx;height:105rpx;align-items:center;justify-content:center;border-radius:36rpx;background:#f7bb98;color:#79483b;font-size:35rpx;font-weight:750}.bond-avatar--partner{background:#c8dae8;color:#506b82}.bond-line{display:flex;width:78rpx;align-items:center;justify-content:center}.bond-line::before,.bond-line::after{content:'';width:18rpx;border-top:1rpx solid #dba99d}.bond-title,.bond-desc{display:block}.bond-title{margin-top:24rpx;font-size:34rpx;font-weight:750}.bond-desc{margin-top:9rpx;color:#8d7d79;font-size:22rpx}.bond-stats{display:flex;margin-top:34rpx;align-items:center;justify-content:center}.bond-stats>view{flex:1}.bond-stats text,.bond-stats span{display:block}.bond-stats text{font-size:31rpx;font-weight:750}.bond-stats span{margin-top:5rpx;color:#92827e;font-size:18rpx}.bond-stats i{width:1rpx;height:48rpx;background:#e9d8d0}
.user-avatar-image{display:block;width:100%;height:100%;border-radius:inherit}
.rules{margin-top:22rpx;padding:27rpx}.rules__title{font-size:27rpx;font-weight:750}.rule-row{display:flex;gap:15rpx;margin-top:23rpx;align-items:center;color:#766764;font-size:22rpx;line-height:1.55}.rule-row>view{display:flex;width:53rpx;height:53rpx;flex:none;align-items:center;justify-content:center;border-radius:18rpx;background:#f8eee8;color:#956157}.unbind-button{margin-top:27rpx}.unbind-tip{display:block;margin:16rpx 20rpx 0;color:#9a8b87;font-size:20rpx;line-height:1.6;text-align:center}
.mode-switch{display:flex;padding:7rpx;border-radius:22rpx;background:#efe4dd}.mode-switch button{display:flex;height:68rpx;flex:1;align-items:center;justify-content:center;border-radius:17rpx;background:transparent;color:#897a76;font-size:24rpx;line-height:1;text-align:center}.mode-switch button.active{background:#fff;color:#9c564d;font-weight:700;box-shadow:0 5rpx 15rpx rgba(90,65,55,.08)}
.invite-card,.enter-card{margin-top:22rpx;padding:42rpx 32rpx;text-align:center}.invite-icon{display:flex;width:82rpx;height:82rpx;margin:0 auto;align-items:center;justify-content:center;border-radius:28rpx;background:#fff0e5;color:#9c5e53}.invite-label,.invite-code,.invite-desc{display:block}.invite-label{margin-top:22rpx;color:#81716d;font-size:23rpx}.invite-code{margin-top:17rpx;color:#77483f;font-size:54rpx;font-weight:800;letter-spacing:10rpx}.invite-desc{margin:12rpx 0 28rpx;color:#9d8e8a;font-size:20rpx}.text-button{margin:22rpx auto 0;background:transparent;color:#a66156;font-size:23rpx}.code-input{height:100rpx;margin:25rpx 0;border:1rpx solid #e8d9d1;border-radius:25rpx;background:#fffaf6;font-size:35rpx;font-weight:750;letter-spacing:7rpx;text-align:center}.before-bind{margin-top:22rpx;padding:28rpx}.before-bind>text{font-weight:750}.before-bind>view{display:flex;gap:12rpx;margin-top:20rpx;align-items:center;color:#7e6f6b;font-size:22rpx}.before-bind i{width:12rpx;height:12rpx;border-radius:50%;background:#daa18e}
</style>
